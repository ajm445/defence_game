import 'dotenv/config';
import { createWebSocketServer } from './websocket/WebSocketServer';

const PORT = Number(process.env.PORT) || 8080;

console.log('=================================');
console.log('  Defence Game Server v1.0.0');
console.log('=================================');

const server = createWebSocketServer(PORT);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n서버 종료 중...');
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n서버 종료 중...');
  server.close();
  process.exit(0);
});
