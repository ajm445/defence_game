import { getSupabaseAdmin } from '../services/supabaseAdmin';
import { getPlayerByUserId, sendToPlayer } from '../state/players';
import { friendManager } from './FriendManager';
import type { FriendRequestInfo, FriendInfo } from '../../../shared/types/friendNetwork';

export class FriendRequestHandler {
  private static instance: FriendRequestHandler;

  private constructor() {}

  public static getInstance(): FriendRequestHandler {
    if (!FriendRequestHandler.instance) {
      FriendRequestHandler.instance = new FriendRequestHandler();
    }
    return FriendRequestHandler.instance;
  }

  /**
   * 친구 요청 보내기
   */
  async sendFriendRequest(fromUserId: string, toUserId: string): Promise<{ success: boolean; message: string; request?: FriendRequestInfo }> {
    const supabase = getSupabaseAdmin();
    if (!supabase) return { success: false, message: '서버 오류' };

    // 자기 자신에게는 요청 불가
    if (fromUserId === toUserId) {
      return { success: false, message: '자기 자신에게는 친구 요청을 보낼 수 없습니다.' };
    }

    try {
      // 이미 친구인지 확인
      const areFriends = await friendManager.areFriends(fromUserId, toUserId);
      if (areFriends) {
        return { success: false, message: '이미 친구입니다.' };
      }

      // 이미 보낸 요청이 있는지 확인
      const { data: existingRequest } = await supabase
        .from('friend_requests')
        .select('id, status')
        .eq('from_user_id', fromUserId)
        .eq('to_user_id', toUserId)
        .single();

      if (existingRequest) {
        if (existingRequest.status === 'pending') {
          return { success: false, message: '이미 친구 요청을 보냈습니다.' };
        }
        // 거절된 요청이 있으면 삭제하고 새로 생성
        if (existingRequest.status === 'rejected') {
          await supabase.from('friend_requests').delete().eq('id', existingRequest.id);
        }
      }

      // 상대방이 나에게 보낸 요청이 있는지 확인
      const { data: reverseRequest } = await supabase
        .from('friend_requests')
        .select('id, status')
        .eq('from_user_id', toUserId)
        .eq('to_user_id', fromUserId)
        .eq('status', 'pending')
        .single();

      if (reverseRequest) {
        // 상대방이 이미 요청을 보냈으면 자동으로 수락 처리
        return await this.respondFriendRequest(reverseRequest.id, true, fromUserId);
      }

      // 상대방 프로필 조회
      const { data: toUserProfile } = await supabase
        .from('player_profiles')
        .select('id, nickname, player_level')
        .eq('id', toUserId)
        .single();

      if (!toUserProfile) {
        return { success: false, message: '존재하지 않는 사용자입니다.' };
      }

      // 보낸 사람 프로필 조회
      const { data: fromUserProfile } = await supabase
        .from('player_profiles')
        .select('id, nickname, player_level')
        .eq('id', fromUserId)
        .single();

      if (!fromUserProfile) {
        return { success: false, message: '프로필을 찾을 수 없습니다.' };
      }

      // 친구 요청 생성
      const { data: newRequest, error } = await supabase
        .from('friend_requests')
        .insert({
          from_user_id: fromUserId,
          to_user_id: toUserId,
          status: 'pending',
        })
        .select('id, created_at')
        .single();

      if (error || !newRequest) {
        console.error('[FriendRequestHandler] 친구 요청 생성 오류:', error);
        return { success: false, message: '친구 요청 생성 실패' };
      }

      const requestInfo: FriendRequestInfo = {
        id: newRequest.id,
        fromUserId,
        fromUserName: fromUserProfile.nickname,
        fromUserLevel: fromUserProfile.player_level || 1,
        toUserId,
        toUserName: toUserProfile.nickname,
        status: 'pending',
        createdAt: newRequest.created_at,
      };

      console.log(`[FriendRequestHandler] 친구 요청 전송: ${fromUserProfile.nickname} -> ${toUserProfile.nickname}`);

      // 상대방에게 알림 (온라인인 경우)
      const toPlayer = getPlayerByUserId(toUserId);
      if (toPlayer) {
        sendToPlayer(toPlayer.id, {
          type: 'FRIEND_REQUEST_RECEIVED',
          request: requestInfo,
        });
      }

      return { success: true, message: '친구 요청을 보냈습니다.', request: requestInfo };
    } catch (err) {
      console.error('[FriendRequestHandler] 친구 요청 예외:', err);
      return { success: false, message: '친구 요청 처리 중 오류가 발생했습니다.' };
    }
  }

  /**
   * 친구 요청 응답 (수락/거절)
   */
  async respondFriendRequest(requestId: string, accept: boolean, responderId: string): Promise<{ success: boolean; message: string; request?: FriendRequestInfo }> {
    const supabase = getSupabaseAdmin();
    if (!supabase) return { success: false, message: '서버 오류' };

    try {
      // 요청 조회
      const { data: request, error: fetchError } = await supabase
        .from('friend_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (fetchError || !request) {
        return { success: false, message: '친구 요청을 찾을 수 없습니다.' };
      }

      // 요청 받은 사람인지 확인
      if (request.to_user_id !== responderId) {
        return { success: false, message: '이 요청에 응답할 권한이 없습니다.' };
      }

      // 이미 처리된 요청인지 확인
      if (request.status !== 'pending') {
        return { success: false, message: '이미 처리된 요청입니다.' };
      }

      // 요청 상태 업데이트
      const { error: updateError } = await supabase
        .from('friend_requests')
        .update({
          status: accept ? 'accepted' : 'rejected',
          responded_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (updateError) {
        console.error('[FriendRequestHandler] 요청 상태 업데이트 오류:', updateError);
        return { success: false, message: '요청 처리 실패' };
      }

      let friendInfo: FriendInfo | undefined;

      if (accept) {
        // 친구 관계 추가
        const added = await friendManager.addFriendship(request.from_user_id, request.to_user_id);
        if (!added) {
          return { success: false, message: '친구 관계 추가 실패' };
        }

        // 새 친구 정보 조회 (요청 보낸 사람 정보)
        const { data: fromUserProfile } = await supabase
          .from('player_profiles')
          .select('id, nickname, player_level')
          .eq('id', request.from_user_id)
          .single();

        if (fromUserProfile) {
          const fromPlayer = getPlayerByUserId(request.from_user_id);
          friendInfo = {
            id: fromUserProfile.id,
            name: fromUserProfile.nickname,
            isOnline: !!fromPlayer,
            playerLevel: fromUserProfile.player_level || 1,
            // 게임 진행 중인 경우에만 currentRoom 표시
            currentRoom: fromPlayer?.isInGame ? fromPlayer.roomId || undefined : undefined,
          };
        }
      }

      const statusText = accept ? '수락' : '거절';
      console.log(`[FriendRequestHandler] 친구 요청 ${statusText}: ${requestId}`);

      // 요청 보낸 사람에게 알림 (온라인인 경우)
      const fromPlayer = getPlayerByUserId(request.from_user_id);
      if (fromPlayer) {
        // 수락된 경우 상대방(응답자) 정보도 포함
        if (accept) {
          const { data: toUserProfile } = await supabase
            .from('player_profiles')
            .select('id, nickname, player_level')
            .eq('id', responderId)
            .single();

          if (toUserProfile) {
            const responderPlayer = getPlayerByUserId(responderId);
            const responderInfo: FriendInfo = {
              id: toUserProfile.id,
              name: toUserProfile.nickname,
              isOnline: !!responderPlayer,
              playerLevel: toUserProfile.player_level || 1,
              // 게임 진행 중인 경우에만 currentRoom 표시
              currentRoom: responderPlayer?.isInGame ? responderPlayer.roomId || undefined : undefined,
            };
            sendToPlayer(fromPlayer.id, {
              type: 'FRIEND_REQUEST_RESPONDED',
              requestId,
              accepted: accept,
              friendInfo: responderInfo,
            });
          }
        } else {
          sendToPlayer(fromPlayer.id, {
            type: 'FRIEND_REQUEST_RESPONDED',
            requestId,
            accepted: accept,
          });
        }
      }

      // 응답자(수락한 사람)에게도 친구 추가 알림 (수락된 경우)
      if (accept && friendInfo) {
        const responderPlayer = getPlayerByUserId(responderId);
        if (responderPlayer) {
          sendToPlayer(responderPlayer.id, {
            type: 'FRIEND_ADDED',
            friend: friendInfo,
          });
        }
      }

      return {
        success: true,
        message: accept ? '친구 요청을 수락했습니다.' : '친구 요청을 거절했습니다.',
      };
    } catch (err) {
      console.error('[FriendRequestHandler] 친구 요청 응답 예외:', err);
      return { success: false, message: '요청 처리 중 오류가 발생했습니다.' };
    }
  }

  /**
   * 친구 요청 취소 (보낸 요청)
   */
  async cancelFriendRequest(requestId: string, cancellerId: string): Promise<{ success: boolean; message: string }> {
    const supabase = getSupabaseAdmin();
    if (!supabase) return { success: false, message: '서버 오류' };

    try {
      // 요청 조회
      const { data: request, error: fetchError } = await supabase
        .from('friend_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (fetchError || !request) {
        return { success: false, message: '친구 요청을 찾을 수 없습니다.' };
      }

      // 요청 보낸 사람인지 확인
      if (request.from_user_id !== cancellerId) {
        return { success: false, message: '이 요청을 취소할 권한이 없습니다.' };
      }

      // 이미 처리된 요청인지 확인
      if (request.status !== 'pending') {
        return { success: false, message: '이미 처리된 요청입니다.' };
      }

      // 요청 삭제
      const { error: deleteError } = await supabase
        .from('friend_requests')
        .delete()
        .eq('id', requestId);

      if (deleteError) {
        console.error('[FriendRequestHandler] 요청 삭제 오류:', deleteError);
        return { success: false, message: '요청 취소 실패' };
      }

      console.log(`[FriendRequestHandler] 친구 요청 취소: ${requestId}`);

      // 상대방에게 알림 (온라인인 경우)
      const toPlayer = getPlayerByUserId(request.to_user_id);
      if (toPlayer) {
        sendToPlayer(toPlayer.id, {
          type: 'FRIEND_REQUEST_CANCELLED',
          requestId,
        });
      }

      return { success: true, message: '친구 요청을 취소했습니다.' };
    } catch (err) {
      console.error('[FriendRequestHandler] 친구 요청 취소 예외:', err);
      return { success: false, message: '요청 취소 중 오류가 발생했습니다.' };
    }
  }

  /**
   * 받은 친구 요청 목록 조회
   */
  async getPendingRequests(userId: string): Promise<FriendRequestInfo[]> {
    const supabase = getSupabaseAdmin();
    if (!supabase) return [];

    try {
      const { data: requests, error } = await supabase
        .from('friend_requests')
        .select(`
          id,
          from_user_id,
          to_user_id,
          status,
          created_at,
          from_user:player_profiles!friend_requests_from_user_id_fkey(id, nickname, player_level),
          to_user:player_profiles!friend_requests_to_user_id_fkey(id, nickname)
        `)
        .eq('to_user_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error || !requests) {
        console.error('[FriendRequestHandler] 대기 중 요청 조회 오류:', error);
        return [];
      }

      return requests.map(r => {
        const fromUser = r.from_user as any;
        const toUser = r.to_user as any;
        return {
          id: r.id,
          fromUserId: r.from_user_id,
          fromUserName: fromUser?.nickname || '알 수 없음',
          fromUserLevel: fromUser?.player_level || 1,
          toUserId: r.to_user_id,
          toUserName: toUser?.nickname || '알 수 없음',
          status: r.status as 'pending',
          createdAt: r.created_at,
        };
      });
    } catch (err) {
      console.error('[FriendRequestHandler] 대기 중 요청 조회 예외:', err);
      return [];
    }
  }

  /**
   * 보낸 친구 요청 목록 조회
   */
  async getSentRequests(userId: string): Promise<FriendRequestInfo[]> {
    const supabase = getSupabaseAdmin();
    if (!supabase) return [];

    try {
      const { data: requests, error } = await supabase
        .from('friend_requests')
        .select(`
          id,
          from_user_id,
          to_user_id,
          status,
          created_at,
          from_user:player_profiles!friend_requests_from_user_id_fkey(id, nickname, player_level),
          to_user:player_profiles!friend_requests_to_user_id_fkey(id, nickname)
        `)
        .eq('from_user_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error || !requests) {
        console.error('[FriendRequestHandler] 보낸 요청 조회 오류:', error);
        return [];
      }

      return requests.map(r => {
        const fromUser = r.from_user as any;
        const toUser = r.to_user as any;
        return {
          id: r.id,
          fromUserId: r.from_user_id,
          fromUserName: fromUser?.nickname || '알 수 없음',
          fromUserLevel: fromUser?.player_level || 1,
          toUserId: r.to_user_id,
          toUserName: toUser?.nickname || '알 수 없음',
          status: r.status as 'pending',
          createdAt: r.created_at,
        };
      });
    } catch (err) {
      console.error('[FriendRequestHandler] 보낸 요청 조회 예외:', err);
      return [];
    }
  }
}

export const friendRequestHandler = FriendRequestHandler.getInstance();
