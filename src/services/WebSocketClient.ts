import type {
  ClientMessage,
  ServerMessage,
  ConnectionState,
} from '@shared/types/network';
import type { UnitType } from '@shared/types/game';

type MessageHandler = (message: ServerMessage) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private serverUrl: string;

  public connectionState: ConnectionState = 'disconnected';
  public playerId: string | null = null;

  constructor() {
    // 기본 서버 URL (개발 환경)
    this.serverUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080';
  }

  public connect(_playerName?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.connectionState = 'connecting';

      try {
        this.ws = new WebSocket(this.serverUrl);

        this.ws.onopen = () => {
          console.log('WebSocket 연결 성공');
          this.connectionState = 'connected';
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: ServerMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('메시지 파싱 오류:', error);
          }
        };

        this.ws.onclose = () => {
          console.log('WebSocket 연결 종료');
          this.connectionState = 'disconnected';
          this.playerId = null;
          this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket 오류:', error);
          this.connectionState = 'disconnected';
          reject(error);
        };
      } catch (error) {
        this.connectionState = 'disconnected';
        reject(error);
      }
    });
  }

  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connectionState = 'disconnected';
    this.playerId = null;
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('최대 재연결 시도 횟수 초과');
      return;
    }

    this.reconnectAttempts++;
    console.log(`재연결 시도 ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`);

    setTimeout(() => {
      this.connect().catch(() => {
        // 재연결 실패 시 다시 시도
      });
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  private handleMessage(message: ServerMessage): void {
    // CONNECTED 메시지 처리
    if (message.type === 'CONNECTED') {
      this.playerId = message.playerId;
    }

    // 등록된 핸들러에 메시지 전달
    this.messageHandlers.forEach((handler) => {
      handler(message);
    });
  }

  public addMessageHandler(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  public send(message: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket이 연결되어 있지 않습니다.');
    }
  }

  // 편의 메서드들
  public joinQueue(playerName: string): void {
    this.send({ type: 'JOIN_QUEUE', playerName });
  }

  public leaveQueue(): void {
    this.send({ type: 'LEAVE_QUEUE' });
  }

  public sendReady(): void {
    this.send({ type: 'GAME_READY' });
  }

  public spawnUnit(unitType: UnitType): void {
    this.send({ type: 'SPAWN_UNIT', unitType });
  }

  public buildWall(x: number, y: number): void {
    this.send({ type: 'BUILD_WALL', x, y });
  }

  public upgradeBase(): void {
    this.send({ type: 'UPGRADE_BASE' });
  }

  public sellHerb(): void {
    this.send({ type: 'SELL_HERB' });
  }

  public collectResource(nodeId: string): void {
    this.send({ type: 'COLLECT_RESOURCE', nodeId });
  }

  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// 싱글톤 인스턴스
export const wsClient = new WebSocketClient();
