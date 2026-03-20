import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { v4 as uuidv4 } from 'uuid';
import { handleMessage, getRoom, getCoopRoom, handleCoopDisconnect, handleAdminDisconnect, broadcastToAdmins, getServerStatus, cleanupAllRooms, registerDisconnectedPlayer } from './MessageHandler';
import { handlePlayerDisconnect } from '../room/RoomManager';
import { players, sendMessage, Player, registerUserOffline, removePlayerUserIdIndex } from '../state/players';
import { gameInviteManager } from '../friend/GameInviteManager';
import { directMessageManager } from '../friend/DirectMessageManager';
import { cleanupPlayerRateLimits } from '../middleware/rateLimiter';

/**
 * 연결당 글로벌 메시지 속도 제한
 * 1초 슬라이딩 윈도우 내 최대 메시지 수 초과 시 경고 → 연결 종료
 */
const GLOBAL_MSG_LIMIT = 120;       // 초당 최대 메시지 수
const GLOBAL_MSG_WINDOW = 1000;     // 윈도우 크기 (ms)
const GLOBAL_MSG_WARN_THRESHOLD = 3; // 경고 횟수 초과 시 연결 종료

const PING_INTERVAL = 30000;        // 30초마다 ping 전송
// Ping/Pong: PING_INTERVAL마다 ping 전송, 다음 ping 시점까지 pong 미수신 시 연결 종료

interface ConnectionThrottle {
  messageCount: number;
  windowStart: number;
  warnings: number;
}
import authRouter from '../api/authRouter';
import profileRouter from '../api/profileRouter';
import adminRouter from '../api/admin/adminRouter';
import rankingsRouter from '../api/rankingsRouter';
import feedbackRouter from '../api/feedbackRouter';
import { isMaintenanceActive, getMaintenanceState, cleanupMaintenance } from '../state/maintenance';

// Re-export for backwards compatibility
export { players, sendMessage, sendToPlayer } from '../state/players';
export type { Player } from '../state/players';

export function createWebSocketServer(port: number) {
  // Express 앱 생성
  const app = express();

  // 미들웨어 설정
  app.use(helmet({ contentSecurityPolicy: false }));

  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
    : ['http://localhost:5173', 'http://localhost:4173'];
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) callback(null, true);
      else callback(new Error('CORS policy violation'));
    },
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
  app.use('/api/feedback', feedbackRouter);

  // 점검 상태 조회 (공개 - 인증 불필요)
  app.get('/api/maintenance/status', (_req, res) => {
    res.json({
      isActive: isMaintenanceActive(),
      message: getMaintenanceState().message,
    });
  });

  // HTTP 서버 생성 (Express 앱 사용)
  const httpServer = createServer(app);

  // WebSocket 서버를 HTTP 서버에 연결
  const wss = new WebSocketServer({ server: httpServer, maxPayload: 64 * 1024 });

  // WebSocket 서버 에러 핸들러 (HTTP 서버 에러 전파 방지)
  wss.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[WebSocket] 포트 ${port}이 사용 중입니다.`);
      // httpServer 에러 핸들러에서 처리하므로 여기서는 무시
    } else {
      console.error('[WebSocket] 서버 에러:', err);
    }
  });

  // HTTP 서버 시작 (포트 충돌 시 재시도)
  let retryCount = 0;
  const MAX_RETRIES = 3;

  const startServer = () => {
    httpServer.listen(port, () => {
      console.log(`서버 시작: http://localhost:${port} (WebSocket + REST API 지원)`);
      retryCount = 0; // 성공 시 재시도 횟수 초기화
    });
  };

  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      retryCount++;
      if (retryCount <= MAX_RETRIES) {
        console.log(`포트 ${port}이 사용 중입니다. ${retryCount}/${MAX_RETRIES} 재시도 (2초 후)...`);
        setTimeout(() => {
          httpServer.close();
          startServer();
        }, 2000);
      } else {
        console.error(`포트 ${port}을 ${MAX_RETRIES}번 시도했으나 실패했습니다. 서버를 종료합니다.`);
        console.error(`다음 명령어로 포트를 사용 중인 프로세스를 종료하세요:`);
        console.error(`  Windows: netstat -ano | findstr :${port} 후 taskkill /PID <PID> /F`);
        process.exit(1);
      }
    } else {
      throw err;
    }
  });

  startServer();

  // 관리자에게 주기적으로 서버 상태 전송 (10초마다)
  const adminStatusInterval = setInterval(() => {
    broadcastToAdmins({
      type: 'ADMIN_SERVER_STATUS',
      status: getServerStatus(),
    });
  }, 10000);

  // 연결당 메시지 스로틀 추적
  const connectionThrottles = new Map<string, ConnectionThrottle>();

  // Ping/Pong: 좀비 연결 감지 및 정리
  const aliveConnections = new Map<WebSocket, boolean>();
  const pingInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (aliveConnections.get(ws) === false) {
        // 이전 ping에 대한 pong을 받지 못함 → 연결 종료
        console.log('[Ping/Pong] 응답 없는 연결 종료');
        ws.terminate();
        return;
      }
      aliveConnections.set(ws, false);
      ws.ping();
    });
  }, PING_INTERVAL);

  wss.on('close', () => {
    clearInterval(pingInterval);
  });

  wss.on('connection', (ws: WebSocket) => {
    const playerId = uuidv4();

    // Ping/Pong 초기화
    aliveConnections.set(ws, true);
    ws.on('pong', () => {
      aliveConnections.set(ws, true);
    });

    // 글로벌 메시지 스로틀 초기화
    connectionThrottles.set(playerId, {
      messageCount: 0,
      windowStart: Date.now(),
      warnings: 0,
    });

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
      // 글로벌 메시지 속도 제한 체크
      const throttle = connectionThrottles.get(playerId);
      if (throttle) {
        const now = Date.now();
        if (now - throttle.windowStart >= GLOBAL_MSG_WINDOW) {
          // 새 윈도우 시작
          throttle.messageCount = 1;
          throttle.windowStart = now;
        } else {
          throttle.messageCount++;
          if (throttle.messageCount > GLOBAL_MSG_LIMIT) {
            throttle.warnings++;
            if (throttle.warnings > GLOBAL_MSG_WARN_THRESHOLD) {
              console.warn(`[Security] 메시지 폭주로 연결 종료: ${playerId} (${throttle.messageCount}msg/s, 경고 ${throttle.warnings}회)`);
              ws.close();
              return;
            }
            // 경고 단계: 메시지 무시
            return;
          }
        }
      }

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
        removePlayerUserIdIndex(userId);
        try {
          await registerUserOffline(userId);
        } catch (err) {
          console.error(`[WebSocket] registerUserOffline 오류 (${userId}):`, err);
        }
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
          // 게임 진행 중 연결 해제 시 재접속 대기 등록
          if (userId && coopRoom.getGameState() === 'playing') {
            registerDisconnectedPlayer(userId, roomId);
          }
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
        directMessageManager.cleanupUser(userId);
      }

      // 관리자 구독 해제
      handleAdminDisconnect(playerId);

      cleanupPlayerRateLimits(playerId);
      connectionThrottles.delete(playerId);
      aliveConnections.delete(ws);
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
    console.log('서버 종료 시작...');
    clearInterval(adminStatusInterval);
    clearInterval(pingInterval);
    cleanupMaintenance(); // 점검 카운트다운 타이머 정리
    cleanupAllRooms(); // 모든 게임 방 및 게임 엔진 정리 (setInterval 정리)
    gameInviteManager.cleanup(); // 게임 초대 타이머 정리
    wss.clients.forEach((ws) => {
      ws.close();
    });
    wss.close();
    httpServer.close();
    console.log('서버 종료 완료');
  };

  return { wss, httpServer, close };
}
