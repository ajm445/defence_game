import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { handleMessage, getRoom, getCoopRoom, handleCoopDisconnect } from './MessageHandler';
import { handlePlayerDisconnect } from '../room/RoomManager';
import { players, sendMessage, Player } from '../state/players';
import authRouter from '../api/authRouter';
import profileRouter from '../api/profileRouter';

// Re-export for backwards compatibility
export { players, sendMessage, sendToPlayer } from '../state/players';
export type { Player } from '../state/players';

export function createWebSocketServer(port: number) {
  // Express 앱 생성
  const app = express();

  // 미들웨어 설정
  app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  }));
  app.use(express.json());

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', players: players.size });
  });

  app.get('/', (req, res) => {
    res.json({ status: 'ok', players: players.size });
  });

  // API 라우터
  app.use('/api/auth', authRouter);
  app.use('/api/profile', profileRouter);

  // HTTP 서버 생성 (Express 앱 사용)
  const httpServer = createServer(app);

  // WebSocket 서버를 HTTP 서버에 연결
  const wss = new WebSocketServer({ server: httpServer });

  // HTTP 서버 시작
  httpServer.listen(port, () => {
    console.log(`서버 시작: http://localhost:${port} (WebSocket + REST API 지원)`);
  });

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
        // PvP 게임 방에서 플레이어 제거 처리
        const room = getRoom(player.roomId);
        if (room) {
          room.handlePlayerDisconnect(playerId);
        }

        // 협동 게임 방에서 플레이어 제거 처리
        const coopRoom = getCoopRoom(player.roomId);
        if (coopRoom) {
          coopRoom.handlePlayerDisconnect(playerId);
        }
      }

      // 대기 방에서 제거 (PvP)
      handlePlayerDisconnect(playerId);

      // 협동 대기 방에서 제거
      handleCoopDisconnect(playerId);

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
    httpServer.close();
    console.log('서버 종료됨');
  };

  return { wss, httpServer, close };
}
