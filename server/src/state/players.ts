import { WebSocket } from 'ws';
import type { ServerMessage } from '../../../shared/types/network';

export interface Player {
  id: string;           // WebSocket 연결 ID
  userId: string | null; // 데이터베이스 사용자 ID (로그인 후 설정)
  name: string;
  ws: WebSocket;
  roomId: string | null;
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
