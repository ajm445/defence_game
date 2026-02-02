import { WebSocket } from 'ws';
import type { ServerMessage } from '../../../shared/types/network';

export type GameMode = 'rts' | 'rpg' | null;

export interface Player {
  id: string;           // WebSocket 연결 ID
  userId: string | null; // 데이터베이스 사용자 ID (로그인 후 설정)
  name: string;
  ws: WebSocket;
  roomId: string | null;
  isInGame: boolean;    // 게임 진행 중 여부 (방에 입장만 해도 false, 게임 시작 후 true)
  gameMode: GameMode;   // 현재 이용 중인 게임 모드 (RTS/RPG)
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
// Promise를 반환할 수 있도록 타입 확장
type OnlineStatusCallback = (userId: string, isOnline: boolean, currentRoom?: string) => void | Promise<void>;
let onlineStatusCallback: OnlineStatusCallback | null = null;

export function setOnlineStatusCallback(callback: OnlineStatusCallback): void {
  onlineStatusCallback = callback;
}

// 사용자 온라인 등록 (로그인 시)
export async function registerUserOnline(userId: string): Promise<void> {
  onlineUserIds.add(userId);
  if (onlineStatusCallback) {
    await onlineStatusCallback(userId, true, undefined);
  }
}

// 사용자 오프라인 등록 (로그아웃/연결 해제 시)
export async function registerUserOffline(userId: string): Promise<void> {
  onlineUserIds.delete(userId);
  if (onlineStatusCallback) {
    await onlineStatusCallback(userId, false, undefined);
  }
}

// 사용자 방 상태 변경 알림 (방 입장/퇴장 시)
export async function notifyUserRoomChange(userId: string, roomId: string | null): Promise<void> {
  if (onlineStatusCallback && onlineUserIds.has(userId)) {
    await onlineStatusCallback(userId, true, roomId || undefined);
  }
}

// 사용자 게임 모드 변경
export function setPlayerGameMode(playerId: string, gameMode: GameMode): void {
  const player = players.get(playerId);
  if (player) {
    player.gameMode = gameMode;
  }
}

// 사용자 ID로 게임 모드 조회
export function getPlayerGameModeByUserId(userId: string): GameMode {
  const player = getPlayerByUserId(userId);
  return player?.gameMode || null;
}
