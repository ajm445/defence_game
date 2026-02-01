import { WebSocket } from 'ws';
import type { ServerMessage } from '../../../shared/types/network';

export interface Player {
  id: string;           // WebSocket 연결 ID
  userId: string | null; // 데이터베이스 사용자 ID (로그인 후 설정)
  name: string;
  ws: WebSocket;
  roomId: string | null;
  isInGame: boolean;    // 게임 진행 중 여부 (방에 입장만 해도 false, 게임 시작 후 true)
}

// 전역 플레이어 맵 (WebSocket ID -> Player)
export const players = new Map<string, Player>();

// 온라인 사용자 ID Set (빠른 조회용)
export const onlineUserIds = new Set<string>();

// 사용자 ID로 플레이어 찾기
export function getPlayerByUserId(userId: string): Player | undefined {
  for (const player of players.values()) {
    if (player.userId === userId) {
      return player;
    }
  }
  return undefined;
}

// 현재 온라인인 사용자 ID 목록 반환
export function getOnlineUserIds(): string[] {
  return Array.from(onlineUserIds);
}

// 로그인된 사용자 수 반환
export function getLoggedInUserCount(): number {
  return onlineUserIds.size;
}

// 메시지 전송 헬퍼
export function sendMessage(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

// 플레이어에게 메시지 전송
export function sendToPlayer(playerId: string, message: ServerMessage): void {
  const player = players.get(playerId);
  if (player) {
    sendMessage(player.ws, message);
  }
}

// 온라인 상태 변경 콜백 (FriendManager에서 등록)
type OnlineStatusCallback = (userId: string, isOnline: boolean, currentRoom?: string) => void;
let onlineStatusCallback: OnlineStatusCallback | null = null;

export function setOnlineStatusCallback(callback: OnlineStatusCallback): void {
  onlineStatusCallback = callback;
}

// 사용자 온라인 등록 (로그인 시)
export function registerUserOnline(userId: string): void {
  onlineUserIds.add(userId);
  if (onlineStatusCallback) {
    onlineStatusCallback(userId, true, undefined);
  }
}

// 사용자 오프라인 등록 (로그아웃/연결 해제 시)
export function registerUserOffline(userId: string): void {
  onlineUserIds.delete(userId);
  if (onlineStatusCallback) {
    onlineStatusCallback(userId, false, undefined);
  }
}

// 사용자 방 상태 변경 알림 (방 입장/퇴장 시)
export function notifyUserRoomChange(userId: string, roomId: string | null): void {
  if (onlineStatusCallback && onlineUserIds.has(userId)) {
    onlineStatusCallback(userId, true, roomId || undefined);
  }
}
