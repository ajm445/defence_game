import { v4 as uuidv4 } from 'uuid';
import { getPlayerByUserId, sendToPlayer, players } from '../state/players';
import { friendManager } from './FriendManager';
import type { GameInviteInfo } from '../../../shared/types/friendNetwork';

const INVITE_TTL_MS = 5 * 60 * 1000; // 5분
const CLEANUP_INTERVAL_MS = 60 * 1000; // 1분마다 정리

interface StoredInvite extends GameInviteInfo {
  toUserId: string;
}

export class GameInviteManager {
  private static instance: GameInviteManager;
  private invites: Map<string, StoredInvite> = new Map();
  private cleanupTimer: NodeJS.Timer | null = null;

  private constructor() {
    this.startCleanupTimer();
  }

  public static getInstance(): GameInviteManager {
    if (!GameInviteManager.instance) {
      GameInviteManager.instance = new GameInviteManager();
    }
    return GameInviteManager.instance;
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanExpiredInvites();
    }, CLEANUP_INTERVAL_MS);
  }

  /**
   * 게임 초대 보내기
   */
  async sendInvite(
    fromUserId: string,
    toUserId: string,
    roomId: string,
    roomCode: string,
    isPrivate: boolean
  ): Promise<{ success: boolean; message: string; invite?: GameInviteInfo }> {
    // 자기 자신에게는 초대 불가
    if (fromUserId === toUserId) {
      return { success: false, message: '자기 자신에게는 초대를 보낼 수 없습니다.' };
    }

    // 친구인지 확인
    const areFriends = await friendManager.areFriends(fromUserId, toUserId);
    if (!areFriends) {
      return { success: false, message: '친구에게만 초대를 보낼 수 있습니다.' };
    }

    // 상대방이 온라인인지 확인
    const toPlayer = getPlayerByUserId(toUserId);
    if (!toPlayer) {
      return { success: false, message: '상대방이 오프라인입니다.' };
    }

    // 보낸 사람 정보 조회
    const fromPlayer = getPlayerByUserId(fromUserId);
    const fromPlayerName = fromPlayer?.name || '알 수 없음';

    // 이미 같은 방에 보낸 초대가 있는지 확인
    for (const [id, invite] of this.invites) {
      if (invite.fromUserId === fromUserId && invite.toUserId === toUserId && invite.roomId === roomId) {
        return { success: false, message: '이미 초대를 보냈습니다.' };
      }
    }

    // 초대 생성
    const now = Date.now();
    const inviteId = uuidv4();
    const inviteInfo: StoredInvite = {
      id: inviteId,
      fromUserId,
      fromUserName: fromPlayerName,
      toUserId,
      roomId,
      roomCode,
      isPrivate,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + INVITE_TTL_MS).toISOString(),
    };

    this.invites.set(inviteId, inviteInfo);

    console.log(`[GameInviteManager] 게임 초대 전송: ${fromPlayerName} -> ${toPlayer.name} (방: ${roomCode})`);

    // 상대방에게 알림
    const { toUserId: _, ...inviteForClient } = inviteInfo;
    sendToPlayer(toPlayer.id, {
      type: 'GAME_INVITE_RECEIVED',
      invite: inviteForClient,
    });

    return { success: true, message: '초대를 보냈습니다.', invite: inviteForClient };
  }

  /**
   * 게임 초대 응답
   */
  async respondInvite(
    inviteId: string,
    accept: boolean,
    responderId: string
  ): Promise<{ success: boolean; message: string; roomId?: string; roomCode?: string }> {
    const invite = this.invites.get(inviteId);

    if (!invite) {
      return { success: false, message: '초대를 찾을 수 없거나 만료되었습니다.' };
    }

    // 응답자가 초대 대상인지 확인
    if (invite.toUserId !== responderId) {
      return { success: false, message: '이 초대에 응답할 권한이 없습니다.' };
    }

    // 만료 확인
    if (new Date(invite.expiresAt).getTime() < Date.now()) {
      this.invites.delete(inviteId);
      return { success: false, message: '초대가 만료되었습니다.' };
    }

    // 초대 삭제
    this.invites.delete(inviteId);

    if (accept) {
      console.log(`[GameInviteManager] 게임 초대 수락: ${inviteId}`);

      // 초대 보낸 사람에게 알림
      const fromPlayer = getPlayerByUserId(invite.fromUserId);
      if (fromPlayer) {
        sendToPlayer(fromPlayer.id, {
          type: 'GAME_INVITE_ACCEPTED',
          roomId: invite.roomId,
          roomCode: invite.roomCode,
        });
      }

      return {
        success: true,
        message: '초대를 수락했습니다.',
        roomId: invite.roomId,
        roomCode: invite.roomCode,
      };
    } else {
      console.log(`[GameInviteManager] 게임 초대 거절: ${inviteId}`);

      // 초대 보낸 사람에게 알림
      const fromPlayer = getPlayerByUserId(invite.fromUserId);
      if (fromPlayer) {
        sendToPlayer(fromPlayer.id, {
          type: 'GAME_INVITE_DECLINED',
          inviteId,
        });
      }

      return { success: true, message: '초대를 거절했습니다.' };
    }
  }

  /**
   * 만료된 초대 정리
   */
  cleanExpiredInvites(): void {
    const now = Date.now();
    const expiredIds: string[] = [];

    for (const [id, invite] of this.invites) {
      if (new Date(invite.expiresAt).getTime() < now) {
        expiredIds.push(id);

        // 초대 받은 사람에게 만료 알림
        const toPlayer = getPlayerByUserId(invite.toUserId);
        if (toPlayer) {
          sendToPlayer(toPlayer.id, {
            type: 'GAME_INVITE_EXPIRED',
            inviteId: id,
          });
        }
      }
    }

    for (const id of expiredIds) {
      this.invites.delete(id);
    }

    if (expiredIds.length > 0) {
      console.log(`[GameInviteManager] 만료된 초대 ${expiredIds.length}개 정리`);
    }
  }

  /**
   * 특정 사용자의 모든 초대 취소 (방 나갈 때 등)
   */
  cancelUserInvites(userId: string): void {
    const cancelledIds: string[] = [];

    for (const [id, invite] of this.invites) {
      if (invite.fromUserId === userId) {
        cancelledIds.push(id);

        // 초대 받은 사람에게 만료 알림
        const toPlayer = getPlayerByUserId(invite.toUserId);
        if (toPlayer) {
          sendToPlayer(toPlayer.id, {
            type: 'GAME_INVITE_EXPIRED',
            inviteId: id,
          });
        }
      }
    }

    for (const id of cancelledIds) {
      this.invites.delete(id);
    }

    if (cancelledIds.length > 0) {
      console.log(`[GameInviteManager] 사용자 ${userId}의 초대 ${cancelledIds.length}개 취소`);
    }
  }

  /**
   * 특정 방의 모든 초대 취소 (방 파기 시)
   */
  cancelRoomInvites(roomId: string): void {
    const cancelledIds: string[] = [];

    for (const [id, invite] of this.invites) {
      if (invite.roomId === roomId) {
        cancelledIds.push(id);

        // 초대 받은 사람에게 만료 알림
        const toPlayer = getPlayerByUserId(invite.toUserId);
        if (toPlayer) {
          sendToPlayer(toPlayer.id, {
            type: 'GAME_INVITE_EXPIRED',
            inviteId: id,
          });
        }
      }
    }

    for (const id of cancelledIds) {
      this.invites.delete(id);
    }

    if (cancelledIds.length > 0) {
      console.log(`[GameInviteManager] 방 ${roomId}의 초대 ${cancelledIds.length}개 취소`);
    }
  }

  /**
   * 초대 유효성 검증 (비밀방 입장 시 사용)
   */
  isValidInvite(inviteId: string, userId: string): boolean {
    const invite = this.invites.get(inviteId);
    if (!invite) return false;
    if (invite.toUserId !== userId) return false;
    if (new Date(invite.expiresAt).getTime() < Date.now()) {
      this.invites.delete(inviteId);
      return false;
    }
    return true;
  }

  /**
   * 초대로 방 정보 조회 (방 입장 시)
   */
  getInviteRoomInfo(inviteId: string, userId: string): { roomId: string; roomCode: string } | null {
    const invite = this.invites.get(inviteId);
    if (!invite || invite.toUserId !== userId) return null;
    if (new Date(invite.expiresAt).getTime() < Date.now()) {
      this.invites.delete(inviteId);
      return null;
    }
    return { roomId: invite.roomId, roomCode: invite.roomCode };
  }

  /**
   * 초대 사용 완료 (방 입장 성공 시 삭제)
   */
  consumeInvite(inviteId: string): void {
    this.invites.delete(inviteId);
  }
}

export const gameInviteManager = GameInviteManager.getInstance();
