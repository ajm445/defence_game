import { players, sendToPlayer } from '../state/players';
import { removeCoopRoom } from '../websocket/MessageHandler';
import type { HeroClass, SkillType, UpgradeLevels } from '../../../src/types/rpg';
import type {
  CoopPlayerInfo,
  RPGCoopGameState,
} from '../../../shared/types/rpgNetwork';
import type { SerializedGameState, PlayerInput } from '../../../shared/types/hostBasedNetwork';

/**
 * 호스트 기반 릴레이 전용 게임 방
 * - 게임 로직은 호스트 클라이언트에서 실행
 * - 서버는 메시지 릴레이만 담당
 * - 호스트: GAME_STATE_BROADCAST 전송 → 서버 → 다른 클라이언트들
 * - 클라이언트: PLAYER_INPUT 전송 → 서버 → 호스트
 */
export class RPGCoopGameRoom {
  public id: string;
  private playerIds: string[];
  private playerInfos: CoopPlayerInfo[];
  private hostPlayerId: string;

  private gameState: 'waiting' | 'countdown' | 'playing' | 'ended' = 'waiting';
  private countdownTimer: NodeJS.Timeout | null = null;

  // 각 플레이어의 heroId 매핑 (호스트가 할당)
  private playerHeroMap: Map<string, string> = new Map();

  constructor(id: string, playerIds: string[], playerInfos: CoopPlayerInfo[]) {
    this.id = id;
    this.playerIds = playerIds;
    this.playerInfos = playerInfos;

    // 호스트 식별 (첫 번째 플레이어가 방장)
    this.hostPlayerId = playerInfos.find(p => p.isHost)?.id || playerIds[0];

    console.log(`[Relay] 게임 방 생성: ${id}, 호스트: ${this.hostPlayerId}, 플레이어: ${playerIds.length}명`);
  }

  public startCountdown(): void {
    this.gameState = 'countdown';
    let countdown = 3;

    this.countdownTimer = setInterval(() => {
      this.broadcast({ type: 'COOP_GAME_COUNTDOWN', seconds: countdown });

      if (countdown <= 0) {
        if (this.countdownTimer) {
          clearInterval(this.countdownTimer);
          this.countdownTimer = null;
        }
        this.startGame();
      }
      countdown--;
    }, 1000);
  }

  private startGame(): void {
    this.gameState = 'playing';

    console.log(`[Relay] 게임 시작: Room ${this.id} (${this.playerIds.length}명, 호스트: ${this.hostPlayerId})`);

    // 호스트에게 게임 시작 알림 (호스트가 게임 상태를 초기화함)
    // 각 플레이어에게 자신의 인덱스와 호스트 여부 전달
    this.playerIds.forEach((playerId, index) => {
      const isHost = playerId === this.hostPlayerId;
      sendToPlayer(playerId, {
        type: 'COOP_GAME_START_HOST_BASED',
        isHost,
        playerIndex: index,
        players: this.playerInfos,
        hostPlayerId: this.hostPlayerId,
      });
    });
  }

  // ============================================
  // 메시지 릴레이 함수들
  // ============================================

  /**
   * 호스트로부터 게임 상태 브로드캐스트 수신
   * → 다른 모든 클라이언트에게 전달
   */
  public handleGameStateBroadcast(playerId: string, state: SerializedGameState): void {
    // 호스트만 상태를 브로드캐스트할 수 있음
    if (playerId !== this.hostPlayerId) {
      console.warn(`[Relay] 비호스트 플레이어가 상태 브로드캐스트 시도: ${playerId}`);
      return;
    }

    // 호스트를 제외한 모든 플레이어에게 상태 전송
    this.playerIds.forEach(pid => {
      if (pid !== this.hostPlayerId) {
        sendToPlayer(pid, {
          type: 'COOP_GAME_STATE_FROM_HOST',
          state,
        });
      }
    });
  }

  /**
   * 클라이언트로부터 플레이어 입력 수신
   * → 호스트에게 전달
   */
  public handlePlayerInput(playerId: string, input: PlayerInput): void {
    // 호스트에게 입력 전달 (호스트 자신의 입력은 전달하지 않음)
    if (playerId !== this.hostPlayerId) {
      sendToPlayer(this.hostPlayerId, {
        type: 'COOP_PLAYER_INPUT',
        input: {
          ...input,
          playerId,
        },
      });
    }
  }

  /**
   * 호스트로부터 게임 이벤트 브로드캐스트 수신
   * → 다른 모든 클라이언트에게 전달
   */
  public handleGameEventBroadcast(playerId: string, event: any): void {
    // 호스트만 이벤트를 브로드캐스트할 수 있음
    if (playerId !== this.hostPlayerId) {
      return;
    }

    // 호스트를 제외한 모든 플레이어에게 이벤트 전송
    this.playerIds.forEach(pid => {
      if (pid !== this.hostPlayerId) {
        sendToPlayer(pid, {
          type: 'COOP_GAME_EVENT',
          event,
        });
      }
    });
  }

  /**
   * 호스트로부터 게임 종료 알림
   * → 모든 플레이어에게 전달 (방은 유지)
   */
  public handleGameOver(playerId: string, result: any): void {
    // 호스트만 게임 종료를 선언할 수 있음
    if (playerId !== this.hostPlayerId) {
      return;
    }

    this.gameState = 'ended';

    // 모든 플레이어에게 게임 종료 알림 (방은 유지됨)
    this.broadcast({ type: 'COOP_GAME_OVER', result });

    console.log(`[Relay] 게임 종료: Room ${this.id}, 승리: ${result?.victory}`);

    // cleanup() 호출 제거 - 방 유지하여 재시작 가능
  }

  /**
   * 게임 종료 후 로비로 복귀
   * → 호스트만 호출 가능
   */
  public returnToLobby(playerId: string): void {
    if (playerId !== this.hostPlayerId) {
      return;
    }

    if (this.gameState !== 'ended') {
      return;
    }

    this.gameState = 'waiting';

    // 모든 플레이어에게 로비 복귀 알림
    this.broadcast({ type: 'COOP_RETURN_TO_LOBBY' });

    console.log(`[Relay] 로비 복귀: Room ${this.id}`);
  }

  /**
   * 게임 재시작 (로비에서 호스트가 시작)
   * → 호스트만 호출 가능
   */
  public restartGame(playerId: string): void {
    if (playerId !== this.hostPlayerId) {
      return;
    }

    if (this.gameState !== 'waiting' && this.gameState !== 'ended') {
      return;
    }

    // 카운트다운 시작
    this.gameState = 'countdown';
    this.broadcast({ type: 'COOP_RESTART_COUNTDOWN' });

    console.log(`[Relay] 게임 재시작 카운트다운: Room ${this.id}`);

    // 3초 카운트다운
    let countdown = 3;
    this.countdownTimer = setInterval(() => {
      countdown--;
      this.broadcast({ type: 'COOP_COUNTDOWN', countdown });

      if (countdown <= 0) {
        if (this.countdownTimer) {
          clearInterval(this.countdownTimer);
          this.countdownTimer = null;
        }
        this.gameState = 'playing';
        this.broadcast({ type: 'COOP_GAME_RESTART' });
        console.log(`[Relay] 게임 재시작: Room ${this.id}`);
      }
    }, 1000);
  }

  /**
   * 호스트가 방 파기
   * → 모든 플레이어에게 알림 후 방 삭제
   */
  public destroyRoom(playerId: string): void {
    if (playerId !== this.hostPlayerId) {
      return;
    }

    // 모든 플레이어에게 방 파기 알림
    this.broadcast({ type: 'COOP_ROOM_DESTROYED', reason: '호스트가 방을 파기했습니다.' });

    console.log(`[Relay] 방 파기: Room ${this.id}`);

    // 방 정리
    this.cleanup();
  }

  // ============================================
  // 레거시 호환 함수들 (기존 메시지 타입 지원)
  // ============================================

  /**
   * 영웅 이동 방향 설정 (레거시 - PlayerInput으로 변환)
   */
  public handleHeroMoveDirection(playerId: string, direction: { x: number; y: number } | null): void {
    const input: PlayerInput = {
      playerId,
      moveDirection: direction,
      timestamp: Date.now(),
    };
    this.handlePlayerInput(playerId, input);
  }

  /**
   * 스킬 사용 (레거시 - PlayerInput으로 변환)
   */
  public handleUseSkill(playerId: string, skillType: SkillType, targetX: number, targetY: number): void {
    // 스킬 슬롯 결정
    let skillSlot: 'Q' | 'W' | 'E' = 'Q';
    if (skillType.includes('_w') || skillType.includes('charge') || skillType.includes('pierce') || skillType.includes('fireball')) {
      skillSlot = 'W';
    } else if (skillType.includes('_e') || skillType.includes('berserker') || skillType.includes('rain') || skillType.includes('ironwall') || skillType.includes('meteor')) {
      skillSlot = 'E';
    }

    const input: PlayerInput = {
      playerId,
      moveDirection: null,
      skillUsed: {
        skillSlot,
        targetX,
        targetY,
      },
      timestamp: Date.now(),
    };
    this.handlePlayerInput(playerId, input);
  }

  /**
   * 업그레이드 요청 (레거시 - PlayerInput으로 변환)
   */
  public handleUpgrade(playerId: string, upgradeType: keyof UpgradeLevels): boolean {
    const input: PlayerInput = {
      playerId,
      moveDirection: null,
      upgradeRequested: upgradeType as any,
      timestamp: Date.now(),
    };
    this.handlePlayerInput(playerId, input);
    return true; // 실제 성공 여부는 호스트에서 결정
  }

  // ============================================
  // 연결 관리
  // ============================================

  /**
   * 플레이어 연결 해제 처리
   */
  public handlePlayerDisconnect(playerId: string): void {
    console.log(`[Relay] 플레이어 연결 해제: ${playerId}`);

    // 호스트가 연결 해제되면 새 호스트 선정
    if (playerId === this.hostPlayerId) {
      const remainingPlayers = this.playerIds.filter(id => id !== playerId);

      if (remainingPlayers.length > 0) {
        // 새 호스트 선정
        this.hostPlayerId = remainingPlayers[0];
        const newHostInfo = this.playerInfos.find(p => p.id === this.hostPlayerId);
        if (newHostInfo) {
          newHostInfo.isHost = true;
        }

        console.log(`[Relay] 새 호스트 선정: ${this.hostPlayerId}`);

        // 모든 플레이어에게 호스트 변경 알림
        this.broadcast({
          type: 'COOP_HOST_CHANGED',
          newHostPlayerId: this.hostPlayerId,
        });

        // 새 호스트에게 호스트 권한 부여 알림
        sendToPlayer(this.hostPlayerId, {
          type: 'COOP_YOU_ARE_NOW_HOST',
        });
      } else {
        // 모든 플레이어가 나감
        this.endGame(false);
      }
    }

    // 플레이어 목록에서 제거
    this.playerIds = this.playerIds.filter(id => id !== playerId);
    this.playerInfos = this.playerInfos.filter(p => p.id !== playerId);

    // 연결 해제 알림
    this.broadcast({
      type: 'COOP_PLAYER_DISCONNECTED',
      playerId,
    });

    // 모든 플레이어가 나가면 게임 종료
    if (this.playerIds.length === 0) {
      this.endGame(false);
    }
  }

  /**
   * 플레이어 재접속 처리
   */
  public handlePlayerReconnect(playerId: string): void {
    console.log(`[Relay] 플레이어 재접속: ${playerId}`);

    const playerInfo = this.playerInfos.find(p => p.id === playerId);
    if (playerInfo) {
      playerInfo.connected = true;
    }

    // 재접속 알림
    this.broadcast({
      type: 'COOP_PLAYER_RECONNECTED',
      playerId,
    });

    // 재접속한 플레이어에게 현재 호스트 정보 전달
    sendToPlayer(playerId, {
      type: 'COOP_RECONNECT_INFO',
      hostPlayerId: this.hostPlayerId,
      isHost: playerId === this.hostPlayerId,
      gameState: this.gameState,
    });
  }

  // ============================================
  // 유틸리티
  // ============================================

  private broadcast(message: any): void {
    this.playerIds.forEach(playerId => {
      sendToPlayer(playerId, message);
    });
  }

  private endGame(victory: boolean): void {
    this.gameState = 'ended';
    this.cleanup();
  }

  private cleanup(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }

    // 방 정리
    removeCoopRoom(this.id);
    this.playerIds.forEach(playerId => {
      const player = players.get(playerId);
      if (player) {
        player.roomId = null;
      }
    });
  }

  // ============================================
  // Getter
  // ============================================

  public getHostPlayerId(): string {
    return this.hostPlayerId;
  }

  public isHost(playerId: string): boolean {
    return playerId === this.hostPlayerId;
  }

  public getPlayerIds(): string[] {
    return this.playerIds;
  }
}
