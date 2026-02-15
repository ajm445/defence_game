import { v4 as uuidv4 } from 'uuid';
import { getPlayerByUserId, sendToPlayer, onlineUserIds } from '../state/players';
import { friendManager } from './FriendManager';
import { filterProfanity } from '../utils/profanityFilter';
import type { DirectMessage } from '../../../shared/types/friendNetwork';

const DM_CHAT_CONFIG = {
  MAX_MESSAGE_LENGTH: 200,
  MIN_MESSAGE_INTERVAL: 500,
  MAX_HISTORY_PER_CONVERSATION: 50,
} as const;

export class DirectMessageManager {
  private static instance: DirectMessageManager;
  // conversationKey → messages (메모리 전용)
  private conversations: Map<string, DirectMessage[]> = new Map();
  // senderUserId → (targetUserId → lastTimestamp) 스팸 방지
  private lastMessageTime: Map<string, Map<string, number>> = new Map();

  private constructor() {}

  public static getInstance(): DirectMessageManager {
    if (!DirectMessageManager.instance) {
      DirectMessageManager.instance = new DirectMessageManager();
    }
    return DirectMessageManager.instance;
  }

  private getConversationKey(userId1: string, userId2: string): string {
    return [userId1, userId2].sort().join(':');
  }

  async sendMessage(
    senderUserId: string,
    targetUserId: string,
    content: string
  ): Promise<{ success: boolean; message: string; dm?: DirectMessage }> {
    // 자기 자신에게는 불가
    if (senderUserId === targetUserId) {
      return { success: false, message: '자기 자신에게 메시지를 보낼 수 없습니다.' };
    }

    // 온라인 확인
    if (!onlineUserIds.has(targetUserId)) {
      return { success: false, message: '상대방이 오프라인입니다.' };
    }

    // 친구 확인
    const areFriends = await friendManager.areFriends(senderUserId, targetUserId);
    if (!areFriends) {
      return { success: false, message: '친구에게만 메시지를 보낼 수 있습니다.' };
    }

    // 콘텐츠 검증
    const trimmed = content.trim();
    if (trimmed.length === 0) {
      return { success: false, message: '빈 메시지는 보낼 수 없습니다.' };
    }
    if (trimmed.length > DM_CHAT_CONFIG.MAX_MESSAGE_LENGTH) {
      return { success: false, message: `메시지가 너무 깁니다. (최대 ${DM_CHAT_CONFIG.MAX_MESSAGE_LENGTH}자)` };
    }

    // 스팸 체크 (대상별 500ms)
    const now = Date.now();
    let senderTimes = this.lastMessageTime.get(senderUserId);
    if (senderTimes) {
      const lastTime = senderTimes.get(targetUserId);
      if (lastTime && now - lastTime < DM_CHAT_CONFIG.MIN_MESSAGE_INTERVAL) {
        return { success: false, message: '너무 빠르게 메시지를 보내고 있습니다.' };
      }
    } else {
      senderTimes = new Map();
      this.lastMessageTime.set(senderUserId, senderTimes);
    }
    senderTimes.set(targetUserId, now);

    // 비속어 필터
    const filteredContent = filterProfanity(trimmed);

    // 보낸 사람 이름 조회
    const senderPlayer = getPlayerByUserId(senderUserId);
    const senderName = senderPlayer?.name || '알 수 없음';

    // DirectMessage 생성
    const dm: DirectMessage = {
      id: uuidv4(),
      fromUserId: senderUserId,
      fromUserName: senderName,
      toUserId: targetUserId,
      content: filteredContent,
      timestamp: now,
    };

    // 대화 저장
    const key = this.getConversationKey(senderUserId, targetUserId);
    let messages = this.conversations.get(key);
    if (!messages) {
      messages = [];
      this.conversations.set(key, messages);
    }
    messages.push(dm);
    // 최대 개수 초과 시 오래된 것 제거
    if (messages.length > DM_CHAT_CONFIG.MAX_HISTORY_PER_CONVERSATION) {
      messages.splice(0, messages.length - DM_CHAT_CONFIG.MAX_HISTORY_PER_CONVERSATION);
    }

    // 상대방에게 전송
    const targetPlayer = getPlayerByUserId(targetUserId);
    if (targetPlayer) {
      sendToPlayer(targetPlayer.id, {
        type: 'DM_RECEIVED',
        message: dm,
      });
    }

    return { success: true, message: '메시지를 보냈습니다.', dm };
  }

  /**
   * 유저의 모든 대화 이력 조회 (게임 중 놓친 메시지 재전송용)
   */
  getConversationsForUser(userId: string): { friendUserId: string; messages: DirectMessage[] }[] {
    const result: { friendUserId: string; messages: DirectMessage[] }[] = [];

    for (const [key, messages] of this.conversations) {
      if (!key.includes(userId)) continue;
      if (messages.length === 0) continue;

      // key = "userId1:userId2" (정렬됨) → 상대방 ID 추출
      const [id1, id2] = key.split(':');
      const friendUserId = id1 === userId ? id2 : id1;

      result.push({ friendUserId, messages: [...messages] });
    }

    return result;
  }

  /**
   * 유저 연결 해제 시 관련 대화 및 스팸 타이머 정리
   */
  cleanupUser(userId: string): void {
    // 스팸 타이머 정리
    this.lastMessageTime.delete(userId);
    // 다른 사람의 스팸 맵에서도 제거
    for (const [, targetMap] of this.lastMessageTime) {
      targetMap.delete(userId);
    }

    // 대화 기록 정리 (해당 유저가 포함된 모든 대화)
    const keysToDelete: string[] = [];
    for (const key of this.conversations.keys()) {
      if (key.includes(userId)) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.conversations.delete(key);
    }
  }
}

export const directMessageManager = DirectMessageManager.getInstance();
