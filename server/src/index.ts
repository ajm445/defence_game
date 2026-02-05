import 'dotenv/config';
import { createWebSocketServer } from './websocket/WebSocketServer';

const PORT = Number(process.env.PORT) || 8080;

console.log('=================================');
console.log('  Defence Game Server v1.0.0');
console.log('=================================');

const server = createWebSocketServer(PORT);

// Graceful shutdown 함수
let isShuttingDown = false;
function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n[${signal}] 서버 종료 중...`);

  // 서버 종료
  server.close();
  console.log('서버가 정상적으로 종료되었습니다.');
  process.exit(0);
}

// Unix 시그널
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Windows: IPC shutdown 메시지 처리
if (process.platform === 'win32') {
  process.on('message', (msg) => {
    if (msg === 'shutdown') {
      gracefulShutdown('IPC_SHUTDOWN');
    }
  });
}
