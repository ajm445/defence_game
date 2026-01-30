import type { PlayerActivity, ServerStatus } from '../types/admin';

type MessageHandler = {
  onPlayerActivity?: (activity: PlayerActivity) => void;
  onServerStatus?: (status: ServerStatus) => void;
  onError?: (error: string) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
};

class AdminWebSocketService {
  private ws: WebSocket | null = null;
  private handlers: MessageHandler = {};
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  connect(handlers: MessageHandler) {
    this.handlers = handlers;
    this.doConnect();
  }

  private doConnect() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080';
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('[AdminWS] Connected');
      this.reconnectAttempts = 0;

      // Subscribe to admin events
      if (this.token) {
        this.send({
          type: 'ADMIN_SUBSCRIBE',
          token: this.token,
        });
      }

      this.handlers.onConnect?.();
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (err) {
        console.error('[AdminWS] Parse error:', err);
      }
    };

    this.ws.onclose = () => {
      console.log('[AdminWS] Disconnected');
      this.handlers.onDisconnect?.();
      this.scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('[AdminWS] Error:', error);
      this.handlers.onError?.('WebSocket connection error');
    };
  }

  private handleMessage(message: { type: string; [key: string]: unknown }) {
    switch (message.type) {
      case 'ADMIN_PLAYER_ACTIVITY':
        this.handlers.onPlayerActivity?.(message.activity as PlayerActivity);
        break;

      case 'ADMIN_SERVER_STATUS':
        this.handlers.onServerStatus?.(message.status as ServerStatus);
        break;

      case 'ADMIN_SUBSCRIBED':
        console.log('[AdminWS] Subscribed to admin events');
        break;

      case 'ADMIN_ERROR':
        this.handlers.onError?.(message.error as string);
        break;

      default:
        // Ignore other message types
        break;
    }
  }

  private send(message: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[AdminWS] Max reconnect attempts reached');
      this.handlers.onError?.('Connection lost. Please refresh the page.');
      return;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    console.log(`[AdminWS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      this.doConnect();
    }, delay);
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.handlers = {};
  }

  requestServerStatus() {
    this.send({ type: 'ADMIN_REQUEST_STATUS' });
  }
}

export const adminWebSocket = new AdminWebSocketService();
