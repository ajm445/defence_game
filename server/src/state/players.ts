import { WebSocket } from 'ws';
import type { ServerMessage } from '../../../shared/types/network';

export interface Player {
  id: string;
  name: string;
  ws: WebSocket;
  roomId: string | null;
}

// 전역 플레이어 맵
export const players = new Map<string, Player>();

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
