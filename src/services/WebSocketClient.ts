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
import { useAuthStore } from '../stores/useAuthStore';
import { useUIStore } from '../stores/useUIStore';

type MessageHandler = (message: ServerMessage) => void;

// 로그인 정보 (재연결 시 재사용)
interface LoginInfo {
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
  private isBanned = false;
  private isDuplicateLogin = false;

  // 로그인 정보 영구 저장 (재연결 시 자동 재전송)
  private currentLogin: LoginInfo | null = null;
  private pendingConnect = false;

  public connectionState: ConnectionState = 'disconnected';
  public playerId: string | null = null;

  constructor() {
    // 기본 서버 URL (개발 환경)
    this.serverUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080';

    // 탭 복귀 시 자동 재연결
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          this.handleTabVisible();
        }
      });
    }
  }

  /**
   * 탭이 다시 보이게 될 때 연결 상태 확인 및 재연결
   */
  private handleTabVisible(): void {
    if (this.isBanned || this.isDuplicateLogin) return;
    if (!this.currentLogin) return; // 로그인 안 된 상태면 무시

    if (!this.isConnected()) {
      // 재연결 카운터 리셋 (탭 복귀 시 새로 시도)
      this.reconnectAttempts = 0;
      this.connect().catch(() => {
        // 재연결 실패 시 attemptReconnect가 처리
      });
    }
  }

  public connect(_playerName?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      // 이미 연결 중이면 중복 방지
      if (this.pendingConnect) {
        resolve();
        return;
      }

      // 수동 연결 시 중복 로그인 플래그 리셋 (다른 기기에서 로그아웃 후 재접속 허용)
      this.isDuplicateLogin = false;
      this.connectionState = 'connecting';
      this.pendingConnect = true;

      try {
        this.ws = new WebSocket(this.serverUrl);

        this.ws.onopen = () => {
          console.log('WebSocket 연결 성공');
          this.connectionState = 'connected';
          this.reconnectAttempts = 0;
          this.pendingConnect = false;
          useUIStore.getState().setConnectionLost(false);

          // 로그인 정보가 있으면 자동 재전송 (재연결 시 온라인 상태 복원)
          if (this.currentLogin) {
            const { userId, nickname, isGuest, level } = this.currentLogin;
            this.send({ type: 'USER_LOGIN', userId, nickname, isGuest, level } as any);
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
          this.pendingConnect = false;
          this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket 오류:', error);
          this.connectionState = 'disconnected';
          this.pendingConnect = false;
          reject(error);
        };
      } catch (error) {
        this.connectionState = 'disconnected';
        this.pendingConnect = false;
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
    this.pendingConnect = false;
  }

  private attemptReconnect(): void {
    // 밴된 경우 재연결 시도하지 않음
    if (this.isBanned) {
      console.log('계정 정지로 인해 재연결이 차단되었습니다.');
      return;
    }

    // 중복 로그인으로 종료된 경우 재연결 시도하지 않음
    if (this.isDuplicateLogin) {
      console.log('중복 로그인으로 인해 재연결이 차단되었습니다.');
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('최대 재연결 시도 횟수 초과 (탭 복귀 시 재시도)');
      useUIStore.getState().setConnectionLost(true);
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

    // BANNED 메시지 처리 - 재연결 방지
    if (message.type === 'BANNED') {
      this.isBanned = true;
      this.currentLogin = null;
      console.log('계정이 정지되어 재연결이 차단됩니다.');
    }

    // DUPLICATE_LOGIN 메시지 처리 - 재연결 방지 및 강제 로그아웃
    if (message.type === 'DUPLICATE_LOGIN') {
      this.isDuplicateLogin = true;
      this.currentLogin = null;
      console.log('다른 기기에서 로그인하여 재연결이 차단됩니다.');

      // 즉시 Supabase 로그아웃 및 로그인 화면으로 이동
      alert(message.message || '이미 다른 곳에서 로그인되어 있습니다. 기존 세션을 먼저 종료해주세요.');
      useAuthStore.getState().signOut();
      useUIStore.getState().setScreen('login');
    }

    // 등록된 핸들러에 메시지 전달 (개별 핸들러 오류가 다른 핸들러를 차단하지 않도록)
    this.messageHandlers.forEach((handler) => {
      try {
        handler(message);
      } catch (error) {
        console.error('[WebSocket] 메시지 핸들러 오류:', message.type, error);
      }
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

  public placeMine(x: number, y: number): void {
    this.send({ type: 'PLACE_MINE', x, y });
  }

  public upgradeBase(): void {
    this.send({ type: 'UPGRADE_BASE' });
  }

  public sellHerb(): void {
    this.send({ type: 'SELL_HERB' });
  }

  public surrender(): void {
    this.send({ type: 'SURRENDER' } as any);
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
    // 로그인 정보 영구 저장 (재연결 시 자동 재전송에 사용)
    this.currentLogin = { userId, nickname, isGuest, level };

    if (this.isConnected()) {
      this.send({ type: 'USER_LOGIN', userId, nickname, isGuest, level } as any);
    } else {
      // WebSocket이 연결되지 않은 경우, 연결 시도 (onopen에서 자동 전송)
      this.connect().catch((err) => {
        console.warn('로그인 알림을 위한 WebSocket 연결 실패:', err);
      });
    }
  }

  /**
   * 로그아웃 알림 (서버에 로그 기록용)
   */
  public notifyLogout(userId: string, nickname: string): void {
    // 로그인 정보 삭제 (재연결 시 재전송 방지)
    this.currentLogin = null;
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

  // ============================================
  // 로비 채팅 메서드
  // ============================================

  /**
   * 로비 채팅 메시지 전송
   */
  public sendLobbyChatMessage(content: string): void {
    this.send({ type: 'LOBBY_CHAT_SEND', content } as any);
  }

  /**
   * 게임 모드 변경 알림
   * @param gameMode 'rts' | 'rpg' | null (null은 메인 메뉴)
   */
  public notifyModeChange(gameMode: 'rts' | 'rpg' | null): void {
    if (this.isConnected()) {
      this.send({ type: 'CHANGE_GAME_MODE', gameMode } as any);
    }
  }
}

// 싱글톤 인스턴스
export const wsClient = new WebSocketClient();
