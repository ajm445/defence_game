import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { handleMessage } from './MessageHandler';
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

export function createWebSocketServer(port: number) {
  const wss = new WebSocketServer({ port });

  console.log(`WebSocket 서버 시작: ws://localhost:${port}`);

  wss.on('connection', (ws: WebSocket) => {
    const playerId = uuidv4();

    // 플레이어 생성
    const player: Player = {
      id: playerId,
      name: '',
      ws,
      roomId: null,
    };

    players.set(playerId, player);
    console.log(`플레이어 연결: ${playerId} (현재 ${players.size}명)`);

    // 연결 확인 메시지 전송
    sendMessage(ws, {
      type: 'CONNECTED',
      playerId,
    });

    // 메시지 수신
    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        handleMessage(playerId, message);
      } catch (error) {
        console.error('메시지 파싱 오류:', error);
        sendMessage(ws, {
          type: 'ERROR',
          message: '잘못된 메시지 형식입니다.',
        });
      }
    });

    // 연결 종료
    ws.on('close', () => {
      console.log(`플레이어 연결 해제: ${playerId}`);

      const player = players.get(playerId);
      if (player && player.roomId) {
        // 게임 방에서 플레이어 제거 처리는 GameRoom에서
        // 여기서는 상대방에게 알림만
        const { getRoom } = require('./MessageHandler');
        const room = getRoom(player.roomId);
        if (room) {
          room.handlePlayerDisconnect(playerId);
        }
      }

      // 매칭 큐에서 제거
      const { removeFromQueue } = require('../matchmaking/MatchMaker');
      removeFromQueue(playerId);

      players.delete(playerId);
      console.log(`현재 접속자: ${players.size}명`);
    });

    // 에러 처리
    ws.on('error', (error) => {
      console.error(`WebSocket 에러 (${playerId}):`, error);
    });
  });

  // 서버 종료 함수
  const close = () => {
    wss.clients.forEach((ws) => {
      ws.close();
    });
    wss.close();
    console.log('WebSocket 서버 종료됨');
  };

  return { wss, close };
}
