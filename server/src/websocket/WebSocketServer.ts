import { WebSocketServer, WebSocket } from 'ws';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { handleMessage, getRoom } from './MessageHandler';
import { handlePlayerDisconnect } from '../room/RoomManager';
import { players, sendMessage, Player } from '../state/players';

// Re-export for backwards compatibility
export { players, sendMessage, sendToPlayer } from '../state/players';
export type { Player } from '../state/players';

export function createWebSocketServer(port: number) {
  // HTTP 서버 생성 (health check용)
  const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.url === '/health' || req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', players: players.size }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  // WebSocket 서버를 HTTP 서버에 연결
  const wss = new WebSocketServer({ server: httpServer });

  // HTTP 서버 시작
  httpServer.listen(port, () => {
    console.log(`서버 시작: http://localhost:${port} (WebSocket 지원)`);
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
        // 게임 방에서 플레이어 제거 처리
        const room = getRoom(player.roomId);
        if (room) {
          room.handlePlayerDisconnect(playerId);
        }
      }

      // 대기 방에서 제거
      handlePlayerDisconnect(playerId);

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
