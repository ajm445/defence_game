import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { handleMessage, getRoom, getCoopRoom, handleCoopDisconnect, handleAdminDisconnect, broadcastToAdmins, getServerStatus } from './MessageHandler';
import { handlePlayerDisconnect } from '../room/RoomManager';
import { players, sendMessage, Player, registerUserOffline } from '../state/players';
import { gameInviteManager } from '../friend/GameInviteManager';
import authRouter from '../api/authRouter';
import profileRouter from '../api/profileRouter';
import adminRouter from '../api/admin/adminRouter';
import rankingsRouter from '../api/rankingsRouter';

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
  app.use('/api/admin', adminRouter);
  app.use('/api/rankings', rankingsRouter);

  // HTTP 서버 생성 (Express 앱 사용)
  const httpServer = createServer(app);

  // WebSocket 서버를 HTTP 서버에 연결
  const wss = new WebSocketServer({ server: httpServer });

  // HTTP 서버 시작
  httpServer.listen(port, () => {
    console.log(`서버 시작: http://localhost:${port} (WebSocket + REST API 지원)`);
  });

  // 관리자에게 주기적으로 서버 상태 전송 (10초마다)
  const adminStatusInterval = setInterval(() => {
    broadcastToAdmins({
      type: 'ADMIN_SERVER_STATUS',
      status: getServerStatus(),
    });
  }, 10000);

  wss.on('connection', (ws: WebSocket) => {
    const playerId = uuidv4();

    // 플레이어 생성
    const player: Player = {
      id: playerId,
      userId: null,
      name: '',
      ws,
      roomId: null,
      isInGame: false,
      gameMode: null,
    };

    players.set(playerId, player);
    console.log(`플레이어 연결: ${playerId} (현재 ${players.size}명)`);

    // 관리자에게 접속 이벤트 브로드캐스트
    broadcastToAdmins({
      type: 'ADMIN_PLAYER_ACTIVITY',
      activity: {
        type: 'connect',
        playerId,
        playerName: `Player_${playerId.slice(0, 4)}`,
        timestamp: new Date().toISOString(),
      },
    });

    // 관리자에게 서버 상태 업데이트
    broadcastToAdmins({
      type: 'ADMIN_SERVER_STATUS',
      status: getServerStatus(),
    });

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
    ws.on('close', async () => {
      console.log(`플레이어 연결 해제: ${playerId}`);

      const player = players.get(playerId);
      const playerName = player?.name || `Player_${playerId.slice(0, 4)}`;
      const userId = player?.userId;
      const roomId = player?.roomId; // roomId를 미리 저장 (방 처리 중 null이 될 수 있음)

      // 온라인 사용자 목록에서 제거 및 친구들에게 오프라인 알림
      if (userId) {
        await registerUserOffline(userId);
      }

      // 관리자에게 접속 종료 이벤트 브로드캐스트
      broadcastToAdmins({
        type: 'ADMIN_PLAYER_ACTIVITY',
        activity: {
          type: 'disconnect',
          playerId,
          playerName,
          timestamp: new Date().toISOString(),
        },
      });

      // 로그인된 사용자라면 로그아웃 이벤트도 브로드캐스트 (브라우저 종료 시 자동 로그아웃)
      if (userId) {
        console.log(`[Auth] 연결 종료로 인한 자동 로그아웃: ${playerName} (userId: ${userId})`);
        broadcastToAdmins({
          type: 'ADMIN_PLAYER_ACTIVITY',
          activity: {
            type: 'logout',
            playerId,
            playerName,
            timestamp: new Date().toISOString(),
          },
        });
      }

      if (roomId) {
        // PvP 게임 방에서 플레이어 제거 처리
        const room = getRoom(roomId);
        if (room) {
          room.handlePlayerDisconnect(playerId);
        }

        // 협동 게임 방에서 플레이어 제거 처리
        const coopRoom = getCoopRoom(roomId);
        if (coopRoom) {
          coopRoom.handlePlayerDisconnect(playerId);
        }
      }

      // 대기 방에서 제거 (PvP)
      handlePlayerDisconnect(playerId);

      // 협동 대기 방에서 제거 (roomId를 미리 저장했으므로 player.roomId가 null이어도 처리됨)
      handleCoopDisconnect(playerId);

      // 게임 초대 정리 (플레이어가 보낸 초대 취소)
      if (userId) {
        gameInviteManager.cancelUserInvites(userId);
      }

      // 관리자 구독 해제
      handleAdminDisconnect(playerId);

      players.delete(playerId);
      console.log(`현재 접속자: ${players.size}명`);

      // 관리자에게 서버 상태 업데이트
      broadcastToAdmins({
        type: 'ADMIN_SERVER_STATUS',
        status: getServerStatus(),
      });
    });

    // 에러 처리
    ws.on('error', (error) => {
      console.error(`WebSocket 에러 (${playerId}):`, error);
    });
  });

  // 서버 종료 함수
  const close = () => {
    clearInterval(adminStatusInterval);
    gameInviteManager.cleanup(); // 게임 초대 타이머 정리
    wss.clients.forEach((ws) => {
      ws.close();
    });
    wss.close();
    httpServer.close();
    console.log('서버 종료됨');
  };

  return { wss, httpServer, close };
}
