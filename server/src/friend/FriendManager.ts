import { getSupabaseAdmin } from '../services/supabaseAdmin';
import { players, onlineUserIds, getPlayerByUserId, sendToPlayer } from '../state/players';
import type { FriendInfo, OnlinePlayerInfo, ServerStatusInfo } from '../../../shared/types/friendNetwork';

export class FriendManager {
  private static instance: FriendManager;

  private constructor() {}

  public static getInstance(): FriendManager {
    if (!FriendManager.instance) {
      FriendManager.instance = new FriendManager();
    }
    return FriendManager.instance;
  }

  /**
   * 친구 목록 조회 (온라인 상태 포함)
   */
  async getFriendsList(userId: string): Promise<FriendInfo[]> {
    const supabase = getSupabaseAdmin();
    if (!supabase) return [];

    try {
      // user_id로 친구 목록 조회
      const { data: friendsAsUser, error: error1 } = await supabase
        .from('friends')
        .select(`
          friend_id,
          created_at,
          friend:player_profiles!friends_friend_id_fkey(id, nickname, player_level)
        `)
        .eq('user_id', userId);

      // friend_id로 친구 목록 조회 (역방향)
      const { data: friendsAsFriend, error: error2 } = await supabase
        .from('friends')
        .select(`
          user_id,
          created_at,
          friend:player_profiles!friends_user_id_fkey(id, nickname, player_level)
        `)
        .eq('friend_id', userId);

      if (error1 || error2) {
        console.error('[FriendManager] 친구 목록 조회 오류:', error1 || error2);
        return [];
      }

      const friends: FriendInfo[] = [];

      // user_id 기준 친구들
      if (friendsAsUser) {
        for (const f of friendsAsUser) {
          const friendProfile = f.friend as any;
          if (!friendProfile) continue;

          const isOnline = onlineUserIds.has(friendProfile.id);
          const onlinePlayer = isOnline ? getPlayerByUserId(friendProfile.id) : null;

          friends.push({
            id: friendProfile.id,
            name: friendProfile.nickname,
            isOnline,
            playerLevel: friendProfile.player_level || 1,
            // 게임 진행 중인 경우에만 currentRoom 표시
            currentRoom: onlinePlayer?.isInGame ? onlinePlayer.roomId || undefined : undefined,
            gameMode: onlinePlayer?.gameMode || undefined,
          });
        }
      }

      // friend_id 기준 친구들 (역방향)
      if (friendsAsFriend) {
        for (const f of friendsAsFriend) {
          const friendProfile = f.friend as any;
          if (!friendProfile) continue;

          // 중복 체크
          if (friends.some(friend => friend.id === friendProfile.id)) continue;

          const isOnline = onlineUserIds.has(friendProfile.id);
          const onlinePlayer = isOnline ? getPlayerByUserId(friendProfile.id) : null;

          friends.push({
            id: friendProfile.id,
            name: friendProfile.nickname,
            isOnline,
            playerLevel: friendProfile.player_level || 1,
            // 게임 진행 중인 경우에만 currentRoom 표시
            currentRoom: onlinePlayer?.isInGame ? onlinePlayer.roomId || undefined : undefined,
            gameMode: onlinePlayer?.gameMode || undefined,
          });
        }
      }

      // 온라인 친구 먼저, 그 다음 레벨 순 정렬
      friends.sort((a, b) => {
        if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
        return b.playerLevel - a.playerLevel;
      });

      return friends;
    } catch (err) {
      console.error('[FriendManager] 친구 목록 조회 예외:', err);
      return [];
    }
  }

  /**
   * 온라인 플레이어 목록 조회 (친구 여부 표시)
   */
  async getOnlinePlayers(userId: string): Promise<OnlinePlayerInfo[]> {
    const supabase = getSupabaseAdmin();
    if (!supabase) return [];

    try {
      // 현재 온라인인 사용자 ID들
      const onlineIds = Array.from(onlineUserIds);
      if (onlineIds.length === 0) return [];

      // 온라인 사용자 프로필 조회
      const { data: profiles, error } = await supabase
        .from('player_profiles')
        .select('id, nickname, player_level')
        .in('id', onlineIds);

      if (error || !profiles) {
        console.error('[FriendManager] 온라인 플레이어 조회 오류:', error);
        return [];
      }

      // 친구 ID 목록 조회
      const friendIds = await this.getFriendIds(userId);

      const onlinePlayers: OnlinePlayerInfo[] = profiles
        .map(p => {
          const player = getPlayerByUserId(p.id);
          const isMe = p.id === userId;
          return {
            id: p.id,
            name: p.nickname,
            playerLevel: p.player_level || 1,
            isFriend: friendIds.has(p.id),
            // 게임 진행 중인 경우에만 currentRoom 표시
            currentRoom: player?.isInGame ? player.roomId || undefined : undefined,
            isMe,
            gameMode: player?.gameMode || undefined,
          };
        });

      // 본인 먼저, 그 다음 친구, 그 다음 레벨 순 정렬
      onlinePlayers.sort((a, b) => {
        // 본인이 최우선
        if (a.isMe && !b.isMe) return -1;
        if (!a.isMe && b.isMe) return 1;
        // 친구가 다음
        if (a.isFriend !== b.isFriend) return a.isFriend ? -1 : 1;
        return b.playerLevel - a.playerLevel;
      });

      return onlinePlayers;
    } catch (err) {
      console.error('[FriendManager] 온라인 플레이어 조회 예외:', err);
      return [];
    }
  }

  /**
   * 친구 ID 목록 조회 (Set으로 반환)
   */
  async getFriendIds(userId: string): Promise<Set<string>> {
    const supabase = getSupabaseAdmin();
    if (!supabase) return new Set();

    try {
      const { data: friendsAsUser } = await supabase
        .from('friends')
        .select('friend_id')
        .eq('user_id', userId);

      const { data: friendsAsFriend } = await supabase
        .from('friends')
        .select('user_id')
        .eq('friend_id', userId);

      const friendIds = new Set<string>();

      if (friendsAsUser) {
        friendsAsUser.forEach(f => friendIds.add(f.friend_id));
      }
      if (friendsAsFriend) {
        friendsAsFriend.forEach(f => friendIds.add(f.user_id));
      }

      return friendIds;
    } catch (err) {
      console.error('[FriendManager] 친구 ID 목록 조회 예외:', err);
      return new Set();
    }
  }

  /**
   * 친구 여부 확인
   */
  async areFriends(userId1: string, userId2: string): Promise<boolean> {
    const supabase = getSupabaseAdmin();
    if (!supabase) return false;

    try {
      const { data, error } = await supabase
        .from('friends')
        .select('id')
        .or(`and(user_id.eq.${userId1},friend_id.eq.${userId2}),and(user_id.eq.${userId2},friend_id.eq.${userId1})`)
        .limit(1);

      return !error && data && data.length > 0;
    } catch (err) {
      console.error('[FriendManager] 친구 여부 확인 예외:', err);
      return false;
    }
  }

  /**
   * 친구 삭제 (양방향)
   */
  async removeFriend(userId: string, friendId: string): Promise<boolean> {
    const supabase = getSupabaseAdmin();
    if (!supabase) return false;

    try {
      // 양방향 삭제
      const { error: error1 } = await supabase
        .from('friends')
        .delete()
        .eq('user_id', userId)
        .eq('friend_id', friendId);

      const { error: error2 } = await supabase
        .from('friends')
        .delete()
        .eq('user_id', friendId)
        .eq('friend_id', userId);

      // 둘 중 하나라도 실패하면 오류 로그 (데이터 무결성 문제)
      if (error1 || error2) {
        console.error('[FriendManager] 친구 삭제 오류:', { error1, error2 });
        // 부분 실패도 실패로 처리 (한쪽만 삭제되면 데이터 불일치 발생)
        return false;
      }

      console.log(`[FriendManager] 친구 삭제 완료: ${userId} <-> ${friendId}`);

      // 상대방에게 알림 (온라인인 경우)
      const friendPlayer = getPlayerByUserId(friendId);
      if (friendPlayer) {
        sendToPlayer(friendPlayer.id, { type: 'FRIEND_REMOVED', friendId: userId });
      }

      return true;
    } catch (err) {
      console.error('[FriendManager] 친구 삭제 예외:', err);
      return false;
    }
  }

  /**
   * 친구 관계 추가 (양방향)
   */
  async addFriendship(userId1: string, userId2: string): Promise<boolean> {
    const supabase = getSupabaseAdmin();
    if (!supabase) return false;

    try {
      // 양방향 관계 생성
      const { error } = await supabase
        .from('friends')
        .insert([
          { user_id: userId1, friend_id: userId2 },
          { user_id: userId2, friend_id: userId1 },
        ]);

      if (error) {
        console.error('[FriendManager] 친구 관계 추가 오류:', error);
        return false;
      }

      console.log(`[FriendManager] 친구 관계 추가 완료: ${userId1} <-> ${userId2}`);
      return true;
    } catch (err) {
      console.error('[FriendManager] 친구 관계 추가 예외:', err);
      return false;
    }
  }

  /**
   * 서버 상태 조회
   */
  getServerStatus(): ServerStatusInfo {
    // MessageHandler에서 가져오는 함수 import 필요
    // 여기서는 간단히 players 맵 사이즈로 계산
    return {
      onlinePlayers: players.size,
      activeGames: 0, // 외부에서 설정해야 함
      waitingRooms: 0, // 외부에서 설정해야 함
    };
  }

  /**
   * 친구에게 온라인 상태 변경 알림
   */
  async notifyFriendsStatusChange(userId: string, isOnline: boolean, currentRoom?: string, gameMode?: 'rts' | 'rpg' | null): Promise<void> {
    const friendIds = await this.getFriendIds(userId);

    for (const friendId of friendIds) {
      const friendPlayer = getPlayerByUserId(friendId);
      // WebSocket이 열려있는 경우만 전송 (TOCTOU 방지)
      if (friendPlayer && friendPlayer.ws.readyState === 1) {
        sendToPlayer(friendPlayer.id, {
          type: 'FRIEND_STATUS_CHANGED',
          friendId: userId,
          isOnline,
          currentRoom,
          gameMode: gameMode ?? undefined,
        });
      }
    }
  }

  /**
   * 모든 온라인 플레이어에게 사용자 접속 알림
   */
  async broadcastPlayerJoined(userId: string): Promise<void> {
    const supabase = getSupabaseAdmin();
    if (!supabase) return;

    try {
      // 접속한 사용자 프로필 조회
      const { data: profile, error } = await supabase
        .from('player_profiles')
        .select('id, nickname, player_level')
        .eq('id', userId)
        .single();

      if (error || !profile) {
        console.error('[FriendManager] 프로필 조회 오류:', error);
        return;
      }

      // 접속한 사용자의 친구 목록 한 번만 조회 (성능 최적화)
      const newUserFriendIds = await this.getFriendIds(userId);

      // 접속한 사용자의 게임 모드 조회
      const newPlayer = getPlayerByUserId(userId);
      const newPlayerGameMode = newPlayer?.gameMode || undefined;

      // 모든 온라인 플레이어에게 브로드캐스트 (본인 제외)
      for (const onlineUserId of onlineUserIds) {
        if (onlineUserId === userId) continue;

        const player = getPlayerByUserId(onlineUserId);
        if (player && player.ws.readyState === 1) {
          // 친구 여부는 미리 조회한 Set으로 확인 (DB 쿼리 없음)
          const isFriend = newUserFriendIds.has(onlineUserId);

          sendToPlayer(player.id, {
            type: 'ONLINE_PLAYER_JOINED',
            player: {
              id: profile.id,
              name: profile.nickname,
              playerLevel: profile.player_level || 1,
              isFriend,
              currentRoom: undefined,
              isMe: false,
              gameMode: newPlayerGameMode,
            },
          });
        }
      }

      console.log(`[FriendManager] 플레이어 접속 브로드캐스트: ${profile.nickname}`);
    } catch (err) {
      console.error('[FriendManager] 플레이어 접속 브로드캐스트 예외:', err);
    }
  }

  /**
   * 모든 온라인 플레이어에게 사용자 접속 해제 알림
   */
  async broadcastPlayerLeft(userId: string): Promise<void> {
    // 모든 온라인 플레이어에게 브로드캐스트 (본인 제외)
    for (const onlineUserId of onlineUserIds) {
      if (onlineUserId === userId) continue;

      const player = getPlayerByUserId(onlineUserId);
      if (player && player.ws.readyState === 1) {
        sendToPlayer(player.id, {
          type: 'ONLINE_PLAYER_LEFT',
          playerId: userId,
        });
      }
    }

    console.log(`[FriendManager] 플레이어 접속 해제 브로드캐스트: ${userId}`);
  }
}

export const friendManager = FriendManager.getInstance();
