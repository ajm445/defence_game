import type {
  ClientMessage,
  ServerMessage,
  ConnectionState,
} from '@shared/types/network';
import type { UnitType } from '@shared/types/game';
import type { HeroClass, SkillType, AdvancedHeroClass } from '../types/rpg';
import type { UpgradeType } from '../game/rpg/goldSystem';
import type { CharacterStatUpgrades } from '../types/auth';
import type { SerializedGameState, PlayerInput } from '@shared/types/hostBasedNetwork';

type MessageHandler = (message: ServerMessage) => void;

// 보류 중인 로그인 정보
interface PendingLoginInfo {
  userId: string;
  nickname: string;
  isGuest: boolean;
  level?: number;
}

class WebSocketClient {
  private ws: WebSocket | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private serverUrl: string;
  private pendingLogin: PendingLoginInfo | null = null;

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

          // 보류 중인 로그인 알림 전송
          if (this.pendingLogin) {
            const { userId, nickname, isGuest, level } = this.pendingLogin;
            this.send({ type: 'USER_LOGIN', userId, nickname, isGuest, level } as any);
            this.pendingLogin = null;
          }

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
  public createRoom(playerName: string): void {
    this.send({ type: 'CREATE_ROOM', playerName });
  }

  public joinRoom(roomCode: string, playerName: string): void {
    this.send({ type: 'JOIN_ROOM', roomCode, playerName });
  }

  public leaveRoom(): void {
    this.send({ type: 'LEAVE_ROOM' });
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

  // ============================================
  // 사용자 인증 메서드
  // ============================================

  /**
   * 로그인 알림 (서버에 로그 기록용)
   * WebSocket이 연결되지 않은 경우 연결 후 전송
   */
  public notifyLogin(userId: string, nickname: string, isGuest: boolean, level?: number): void {
    if (this.isConnected()) {
      this.send({ type: 'USER_LOGIN', userId, nickname, isGuest, level } as any);
    } else {
      // WebSocket이 연결되지 않은 경우, 연결 후 전송
      this.pendingLogin = { userId, nickname, isGuest, level };
      this.connect().catch((err) => {
        console.warn('로그인 알림을 위한 WebSocket 연결 실패:', err);
      });
    }
  }

  /**
   * 로그아웃 알림 (서버에 로그 기록용)
   */
  public notifyLogout(userId: string, nickname: string): void {
    // 로그아웃 시 보류 중인 로그인 정보 삭제
    this.pendingLogin = null;
    if (this.isConnected()) {
      this.send({ type: 'USER_LOGOUT', userId, nickname } as any);
    }
  }

  // ============================================
  // 협동 모드 메서드
  // ============================================

  public createCoopRoom(
    playerName: string,
    heroClass: HeroClass,
    characterLevel: number = 1,
    statUpgrades?: CharacterStatUpgrades,
    isPrivate: boolean = false,
    difficulty: string = 'easy',
    advancedClass?: AdvancedHeroClass,
    tier?: 1 | 2
  ): void {
    this.send({ type: 'CREATE_COOP_ROOM', playerName, heroClass, characterLevel, statUpgrades, isPrivate, difficulty, advancedClass, tier } as any);
  }

  public joinCoopRoom(
    roomCode: string,
    playerName: string,
    heroClass: HeroClass,
    characterLevel: number = 1,
    statUpgrades?: CharacterStatUpgrades,
    advancedClass?: AdvancedHeroClass,
    tier?: 1 | 2
  ): void {
    this.send({ type: 'JOIN_COOP_ROOM', roomCode, playerName, heroClass, characterLevel, statUpgrades, advancedClass, tier });
  }

  public joinCoopRoomById(
    roomId: string,
    playerName: string,
    heroClass: HeroClass,
    characterLevel: number = 1,
    statUpgrades?: CharacterStatUpgrades,
    advancedClass?: AdvancedHeroClass,
    tier?: 1 | 2
  ): void {
    this.send({ type: 'JOIN_COOP_ROOM_BY_ID', roomId, playerName, heroClass, characterLevel, statUpgrades, advancedClass, tier } as any);
  }

  public getCoopRoomList(): void {
    this.send({ type: 'GET_COOP_ROOM_LIST' } as any);
  }

  public leaveCoopRoom(): void {
    this.send({ type: 'LEAVE_COOP_ROOM' });
  }

  public coopReady(): void {
    this.send({ type: 'COOP_READY' });
  }

  public coopUnready(): void {
    this.send({ type: 'COOP_UNREADY' });
  }

  public changeCoopClass(
    heroClass: HeroClass,
    characterLevel: number = 1,
    statUpgrades?: CharacterStatUpgrades,
    advancedClass?: AdvancedHeroClass,
    tier?: 1 | 2
  ): void {
    this.send({ type: 'CHANGE_COOP_CLASS', heroClass, characterLevel, statUpgrades, advancedClass, tier });
  }

  public startCoopGame(): void {
    this.send({ type: 'START_COOP_GAME' });
  }

  public kickCoopPlayer(playerId: string): void {
    this.send({ type: 'KICK_COOP_PLAYER', playerId });
  }

  public coopHeroMove(direction: { x: number; y: number } | null): void {
    this.send({ type: 'COOP_HERO_MOVE', direction });
  }

  public coopUseSkill(skillType: SkillType, targetX: number, targetY: number): void {
    this.send({ type: 'COOP_USE_SKILL', skillType, targetX, targetY });
  }

  public coopUpgradeHeroStat(upgradeType: UpgradeType): void {
    this.send({ type: 'COOP_UPGRADE_HERO_STAT', upgradeType } as any);
  }

  // ============================================
  // 호스트 기반 메시지 메서드
  // ============================================

  /**
   * 게임 상태 브로드캐스트 (호스트 → 서버 → 클라이언트들)
   */
  public hostBroadcastGameState(state: SerializedGameState): void {
    this.send({ type: 'HOST_GAME_STATE_BROADCAST', state } as any);
  }

  /**
   * 게임 이벤트 브로드캐스트 (호스트 → 서버 → 클라이언트들)
   */
  public hostBroadcastGameEvent(event: any): void {
    this.send({ type: 'HOST_GAME_EVENT_BROADCAST', event } as any);
  }

  /**
   * 플레이어 입력 전송 (클라이언트 → 서버 → 호스트)
   */
  public hostSendPlayerInput(input: PlayerInput): void {
    this.send({ type: 'HOST_PLAYER_INPUT', input } as any);
  }

  /**
   * 게임 종료 알림 (호스트 → 서버 → 클라이언트들)
   */
  public hostBroadcastGameOver(result: any): void {
    this.send({ type: 'HOST_GAME_OVER', result } as any);
  }

  /**
   * 로비 복귀 요청 (호스트만)
   */
  public returnToLobby(): void {
    this.send({ type: 'RETURN_TO_LOBBY' } as any);
  }

  /**
   * 게임 재시작 요청 (호스트만)
   */
  public restartCoopGame(): void {
    this.send({ type: 'RESTART_COOP_GAME' } as any);
  }

  /**
   * 방 파기 요청 (호스트만)
   */
  public destroyCoopRoom(): void {
    this.send({ type: 'DESTROY_COOP_ROOM' } as any);
  }

  /**
   * 게임 일시정지 요청 (호스트만)
   */
  public pauseCoopGame(): void {
    this.send({ type: 'PAUSE_COOP_GAME' } as any);
  }

  /**
   * 게임 재개 요청 (호스트만)
   */
  public resumeCoopGame(): void {
    this.send({ type: 'RESUME_COOP_GAME' } as any);
  }

  /**
   * 게임 중단 요청 (호스트만) - 모든 플레이어에게 게임 오버
   */
  public stopCoopGame(): void {
    this.send({ type: 'STOP_COOP_GAME' } as any);
  }
}

// 싱글톤 인스턴스
export const wsClient = new WebSocketClient();
