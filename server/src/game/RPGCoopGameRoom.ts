import { players, sendToPlayer, sendPreStringifiedMessage } from '../state/players';
import { removeCoopRoom } from '../websocket/MessageHandler';
import { setWaitingRoomState, syncWaitingRoomPlayers, deleteWaitingRoom } from '../room/CoopRoomManager';
import { friendManager } from '../friend/FriendManager';
import { gameInviteManager } from '../friend/GameInviteManager';
import { RPGServerGameEngine } from './RPGServerGameEngine';
import type { HeroClass, SkillType, UpgradeLevels, RPGDifficulty } from '../../../src/types/rpg';
import type {
  CoopPlayerInfo,
  RPGCoopGameState,
} from '../../../shared/types/rpgNetwork';
import type { SerializedGameState, PlayerInput } from '../../../shared/types/hostBasedNetwork';

/**
 * 서버 권위 게임 방
 * - 게임 로직은 서버에서 실행 (RPGServerGameEngine)
 * - 모든 클라이언트는 입력만 전송, 상태는 서버에서 수신
 * - 클라이언트: PLAYER_INPUT 전송 → 서버 → 게임 엔진 처리
 * - 서버: 게임 상태 브로드캐스트 → 모든 클라이언트
 */
export class RPGCoopGameRoom {
  public id: string;
  public roomCode: string;
  private playerIds: string[];
  private playerInfos: CoopPlayerInfo[];
  private hostPlayerId: string;

  private gameState: 'waiting' | 'countdown' | 'playing' | 'ended' = 'waiting';
  private countdownTimer: NodeJS.Timeout | null = null;

  // 서버 게임 엔진 (서버 권위 모델)
  private gameEngine: RPGServerGameEngine | null = null;

  // 각 플레이어의 heroId 매핑
  private playerHeroMap: Map<string, string> = new Map();

  // 방 설정 (로비 복귀 시 유지)
  public isPrivate: boolean = false;
  public difficulty: string = 'easy';

  constructor(id: string, roomCode: string, playerIds: string[], playerInfos: CoopPlayerInfo[], isPrivate: boolean = false, difficulty: string = 'easy') {
    this.id = id;
    this.roomCode = roomCode;
    this.playerIds = playerIds;
    this.playerInfos = playerInfos;
    this.isPrivate = isPrivate;
    this.difficulty = difficulty;

    // 호스트 식별 (첫 번째 플레이어가 방장 - 로비 관리용으로만 사용)
    this.hostPlayerId = playerInfos.find(p => p.isHost)?.id || playerIds[0];

    console.log(`[ServerAuth] 게임 방 생성: ${id} (${roomCode}), 방장: ${this.hostPlayerId}, 플레이어: ${playerIds.length}명, 난이도: ${difficulty}`);
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

    console.log(`[ServerAuth] 게임 시작: Room ${this.id} (${this.playerIds.length}명, 난이도: ${this.difficulty})`);

    // 모든 플레이어의 isInGame 상태를 true로 설정하고 친구들에게 알림
    this.playerIds.forEach((playerId) => {
      const player = players.get(playerId);
      if (player) {
        player.isInGame = true;
        // 친구들에게 게임 중 상태 알림
        if (player.userId) {
          friendManager.notifyFriendsStatusChange(player.userId, true, player.roomId || undefined);
        }
      }
    });

    try {
      // 서버 게임 엔진 생성 및 시작
      this.gameEngine = new RPGServerGameEngine(
        this.id,
        this.playerInfos,
        this.difficulty as RPGDifficulty,
        (state) => this.broadcastGameState(state),
        (result) => this.handleGameOverFromEngine(result)
      );
      this.gameEngine.start();
    } catch (error) {
      console.error(`[ServerAuth] 게임 엔진 생성/시작 오류: Room ${this.id}`, error);
    }

    // 각 플레이어에게 자신의 인덱스 전달 (서버 권위 모델에서는 isHost 불필요)
    this.playerIds.forEach((playerId, index) => {
      sendToPlayer(playerId, {
        type: 'COOP_GAME_START',
        playerIndex: index,
        players: this.playerInfos,
        difficulty: this.difficulty,
      });
    });
  }

  /**
   * 서버가 직접 게임 상태 브로드캐스트
   * JSON.stringify를 1회만 수행하여 플레이어 수만큼 중복 stringify 방지
   */
  private broadcastGameState(state: SerializedGameState): void {
    const jsonString = JSON.stringify({
      type: 'COOP_GAME_STATE',
      state,
    });
    for (const playerId of this.playerIds) {
      const player = players.get(playerId);
      if (player) {
        sendPreStringifiedMessage(player.ws, jsonString);
      }
    }
  }

  /**
   * 게임 엔진에서 게임 종료 콜백
   */
  private handleGameOverFromEngine(result: { victory: boolean; stats: any }): void {
    this.gameState = 'ended';

    // 모든 플레이어의 isInGame 상태를 false로 설정하고 친구들에게 알림
    this.playerIds.forEach((pid) => {
      const player = players.get(pid);
      if (player) {
        player.isInGame = false;
        if (player.userId) {
          friendManager.notifyFriendsStatusChange(player.userId, true, undefined);
        }
      }
    });

    // 모든 플레이어에게 게임 종료 알림
    this.broadcast({ type: 'COOP_GAME_OVER', result });

    console.log(`[ServerAuth] 게임 종료: Room ${this.id}, 승리: ${result?.victory}`);

    // 엔진 정리
    if (this.gameEngine) {
      this.gameEngine.stop();
      this.gameEngine = null;
    }
  }

  // ============================================
  // 플레이어 입력 처리 (서버 권위 모델)
  // ============================================

  /**
   * 클라이언트로부터 플레이어 입력 수신
   * → 서버 게임 엔진에서 직접 처리
   */
  public handlePlayerInput(playerId: string, input: PlayerInput): void {
    if (this.gameEngine && this.gameState === 'playing') {
      this.gameEngine.handlePlayerInput(playerId, {
        ...input,
        playerId,
      });
    }
  }

  // ============================================
  /**
   * 게임 중 또는 게임 종료 후 로비로 복귀
   * → 방장만 호출 가능
   */
  public returnToLobby(playerId: string): void {
    console.log(`[ServerAuth] 로비 복귀 요청: Room ${this.id}, playerId=${playerId}, hostPlayerId=${this.hostPlayerId}, gameState=${this.gameState}`);

    if (playerId !== this.hostPlayerId) {
      console.log(`[ServerAuth] 로비 복귀 실패: 방장이 아님 (${playerId} !== ${this.hostPlayerId})`);
      return;
    }

    // 대기 중이거나 카운트다운 중에는 로비 복귀 불가
    if (this.gameState === 'waiting' || this.gameState === 'countdown') {
      console.log(`[ServerAuth] 로비 복귀 실패: 이미 대기 중 또는 카운트다운 중 (${this.gameState})`);
      return;
    }

    // 게임 엔진 정리
    if (this.gameEngine) {
      this.gameEngine.stop();
      this.gameEngine = null;
    }

    // 카운트다운 타이머 정리
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }

    this.gameState = 'waiting';

    // 모든 플레이어의 isInGame 상태를 false로 설정하고 친구들에게 알림
    this.playerIds.forEach((pid) => {
      const player = players.get(pid);
      if (player) {
        player.isInGame = false;
        // 친구들에게 로비 복귀 상태 알림
        if (player.userId) {
          friendManager.notifyFriendsStatusChange(player.userId, true, undefined);
        }
      }
    });

    // 플레이어 준비 상태 초기화
    this.playerInfos = this.playerInfos.map(p => ({
      ...p,
      isReady: false, // 호스트 포함 모두 준비 상태 해제
    }));

    // 모든 플레이어에게 로비 복귀 알림 (플레이어 정보 및 방 설정 포함)
    this.broadcast({
      type: 'COOP_RETURN_TO_LOBBY',
      roomCode: this.roomCode,
      roomId: this.id,
      players: this.playerInfos,
      hostPlayerId: this.hostPlayerId,
      isPrivate: this.isPrivate,
      difficulty: this.difficulty,
    });

    // 대기 방 상태를 'waiting'으로 변경하여 로비에 표시
    setWaitingRoomState(this.id, 'waiting');
    syncWaitingRoomPlayers(this.id, this.playerIds, this.playerInfos);

    console.log(`[ServerAuth] 로비 복귀: Room ${this.id} (${this.roomCode})`);
  }

  /**
   * 게임 재시작 (로비에서 방장이 시작)
   * → 방장만 호출 가능
   */
  public restartGame(playerId: string): void {
    console.log(`[ServerAuth] 게임 재시작 요청: Room ${this.id}, playerId=${playerId}, hostPlayerId=${this.hostPlayerId}, gameState=${this.gameState}`);

    if (playerId !== this.hostPlayerId) {
      console.log(`[ServerAuth] 게임 재시작 실패: 방장이 아님 (${playerId} !== ${this.hostPlayerId})`);
      return;
    }

    if (this.gameState !== 'waiting' && this.gameState !== 'ended') {
      console.log(`[ServerAuth] 게임 재시작 실패: 잘못된 상태 (${this.gameState})`);
      return;
    }

    // 모든 플레이어가 준비되었는지 확인 (방장 제외, 혼자일 때는 스킵)
    if (this.playerInfos.length > 1) {
      const readyStates = this.playerInfos.map(p => `${p.id.slice(0, 8)}: isHost=${p.isHost}, isReady=${p.isReady}`);
      console.log(`[ServerAuth] 플레이어 준비 상태: ${readyStates.join(', ')}`);
      const allReady = this.playerInfos.every(p => p.isHost || p.isReady);
      if (!allReady) {
        console.log(`[ServerAuth] 게임 재시작 실패: 모든 플레이어가 준비되지 않음`);
        sendToPlayer(playerId, {
          type: 'COOP_ROOM_ERROR',
          message: '모든 플레이어가 준비되지 않았습니다.',
        });
        return;
      }
    }

    // 카운트다운 시작
    this.gameState = 'countdown';
    this.broadcast({ type: 'COOP_RESTART_COUNTDOWN' });

    console.log(`[ServerAuth] 게임 재시작 카운트다운: Room ${this.id}`);

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

        // 게임 시작 (서버 게임 엔진 생성)
        this.startGame();

        console.log(`[ServerAuth] 게임 재시작: Room ${this.id}`);
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

    console.log(`[ServerAuth] 방 파기: Room ${this.id}`);

    // 방 정리
    this.cleanup();
  }

  /**
   * 게임 일시정지 (방장 전용)
   */
  public pauseGame(playerId: string): void {
    if (playerId !== this.hostPlayerId) {
      return;
    }

    if (this.gameState !== 'playing') {
      return;
    }

    // 게임 엔진 일시정지
    if (this.gameEngine) {
      this.gameEngine.pause();
    }

    // 모든 플레이어에게 일시정지 알림
    this.broadcast({ type: 'COOP_GAME_PAUSED' });
    console.log(`[ServerAuth] 게임 일시정지: Room ${this.id}`);
  }

  /**
   * 게임 재개 (방장 전용)
   */
  public resumeGame(playerId: string): void {
    if (playerId !== this.hostPlayerId) {
      return;
    }

    if (this.gameState !== 'playing') {
      return;
    }

    // 게임 엔진 재개
    if (this.gameEngine) {
      this.gameEngine.resume();
    }

    // 모든 플레이어에게 재개 알림
    this.broadcast({ type: 'COOP_GAME_RESUMED' });
    console.log(`[ServerAuth] 게임 재개: Room ${this.id}`);
  }

  /**
   * 게임 중단 (방장 전용)
   * → 게임 엔진 중지 후 모든 플레이어에게 알림
   */
  public stopGame(playerId: string): void {
    if (playerId !== this.hostPlayerId) {
      return;
    }

    if (this.gameState !== 'playing') {
      return;
    }

    this.gameState = 'ended';

    // 게임 엔진 중지
    if (this.gameEngine) {
      this.gameEngine.stop();
      this.gameEngine = null;
    }

    // 모든 플레이어에게 게임 중단 알림
    this.broadcast({ type: 'COOP_GAME_STOPPED' });
    console.log(`[ServerAuth] 게임 중단: Room ${this.id}`);
  }

  /**
   * 플레이어 직업 변경 (로비에서)
   */
  public changePlayerClass(playerId: string, heroClass: HeroClass, characterLevel: number = 1, statUpgrades?: any, advancedClass?: string, tier?: 1 | 2): void {
    // 로비 상태에서만 직업 변경 가능
    if (this.gameState !== 'waiting') {
      return;
    }

    const playerInfo = this.playerInfos.find(p => p.id === playerId);
    if (!playerInfo) {
      return;
    }

    playerInfo.heroClass = heroClass;
    playerInfo.characterLevel = characterLevel;
    playerInfo.statUpgrades = statUpgrades;
    playerInfo.advancedClass = advancedClass;
    playerInfo.tier = tier;
    // 직업 변경 시 준비 상태 해제 (호스트 제외)
    if (!playerInfo.isHost) {
      playerInfo.isReady = false;
    }

    // 모든 플레이어에게 직업 변경 알림
    this.broadcast({
      type: 'COOP_PLAYER_CLASS_CHANGED',
      playerId,
      heroClass,
      characterLevel,
      advancedClass,
      tier,
    });

    // 준비 상태도 함께 알림 (호스트 제외)
    if (!playerInfo.isHost) {
      this.broadcast({
        type: 'COOP_PLAYER_READY',
        playerId,
        isReady: false,
      });
    }

    console.log(`[ServerAuth] ${playerId} 직업 변경: ${heroClass} (Lv.${characterLevel})`);
  }

  /**
   * 플레이어 준비 상태 변경 (로비에서)
   */
  public setPlayerReady(playerId: string, isReady: boolean): void {
    // 게임 종료 후 로비 상태에서만 준비 상태 변경 가능
    if (this.gameState !== 'waiting') {
      return;
    }

    const playerInfo = this.playerInfos.find(p => p.id === playerId);
    if (!playerInfo) {
      return;
    }

    // 호스트는 항상 준비 상태 유지
    if (playerInfo.isHost) {
      return;
    }

    playerInfo.isReady = isReady;

    // 모든 플레이어에게 준비 상태 변경 알림
    this.broadcast({
      type: 'COOP_PLAYER_READY',
      playerId,
      isReady,
    });

    console.log(`[ServerAuth] ${playerId} 준비 상태: ${isReady}`);
  }

  // ============================================
  // 레거시 호환 함수들 (기존 메시지 타입 지원 - PlayerInput으로 변환)
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
    return true; // 실제 성공 여부는 서버 엔진에서 결정
  }

  // ============================================
  // 연결 관리
  // ============================================

  /**
   * 플레이어 연결 해제 처리
   */
  public handlePlayerDisconnect(playerId: string): void {
    console.log(`[ServerAuth] 플레이어 연결 해제: ${playerId}`);

    // 방장이 연결 해제되면 새 방장 선정 (게임 진행 중에도 계속 진행)
    if (playerId === this.hostPlayerId) {
      // 카운트다운 중이면 타이머 정리
      if (this.gameState === 'countdown' && this.countdownTimer) {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
        console.log(`[ServerAuth] 방장 연결 해제로 카운트다운 취소`);
      }

      const remainingPlayers = this.playerIds.filter(id => id !== playerId);

      if (remainingPlayers.length > 0) {
        // 새 방장 선정
        this.hostPlayerId = remainingPlayers[0];
        const newHostInfo = this.playerInfos.find(p => p.id === this.hostPlayerId);
        if (newHostInfo) {
          newHostInfo.isHost = true;
        }

        console.log(`[ServerAuth] 새 방장 선정: ${this.hostPlayerId}`);

        // 카운트다운 중이었다면 로비로 복귀
        if (this.gameState === 'countdown') {
          this.gameState = 'waiting';
          this.broadcast({ type: 'COOP_COUNTDOWN_CANCELLED', reason: '방장 연결 해제' });
        }

        // 모든 플레이어에게 방장 변경 알림
        this.broadcast({
          type: 'COOP_HOST_CHANGED',
          newHostPlayerId: this.hostPlayerId,
        });

        // 새 방장에게 권한 부여 알림 (게임 중에도 로비 관리 권한 용도)
        sendToPlayer(this.hostPlayerId, {
          type: 'COOP_YOU_ARE_NOW_HOST',
          gameState: this.gameState,
        });

        // 참고: 게임 진행 중일 때는 서버 게임 엔진이 계속 실행됨
        // 방장 변경은 로비 관리 권한만 위임함
      } else {
        // 모든 플레이어가 나감
        this.endGame(false);
      }
    }

    // 나가는 플레이어의 상태 초기화
    const leavingPlayer = players.get(playerId);
    if (leavingPlayer) {
      leavingPlayer.roomId = null;    // 방 ID 초기화
      leavingPlayer.isInGame = false;
      // 친구들에게 상태 변경 알림
      if (leavingPlayer.userId) {
        friendManager.notifyFriendsStatusChange(leavingPlayer.userId, true, undefined);
      }
    }

    // 플레이어 목록에서 제거
    this.playerIds = this.playerIds.filter(id => id !== playerId);
    this.playerInfos = this.playerInfos.filter(p => p.id !== playerId);

    // 대기 방 플레이어 동기화
    syncWaitingRoomPlayers(this.id, this.playerIds, this.playerInfos);

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
    console.log(`[ServerAuth] 플레이어 재접속: ${playerId}`);

    const playerInfo = this.playerInfos.find(p => p.id === playerId);
    if (playerInfo) {
      playerInfo.connected = true;
    }

    // 재접속 알림
    this.broadcast({
      type: 'COOP_PLAYER_RECONNECTED',
      playerId,
    });

    // 재접속한 플레이어에게 현재 상태 정보 전달
    sendToPlayer(playerId, {
      type: 'COOP_RECONNECT_INFO',
      hostPlayerId: this.hostPlayerId,
      isHost: playerId === this.hostPlayerId,
      gameState: this.gameState,
    });

    // 게임 진행 중이면 현재 상태도 전송 (서버 권위 모델에서는 엔진이 브로드캐스트 중)
    // 재접속 플레이어는 다음 브로드캐스트 때 자동으로 상태를 받게 됨
  }

  // ============================================
  // 유틸리티
  // ============================================

  private broadcast(message: any): void {
    this.playerIds.forEach(playerId => {
      sendToPlayer(playerId, message);
    });
  }

  private endGame(_victory: boolean): void {
    this.gameState = 'ended';
    this.cleanup();
  }

  public cleanup(): void {
    // 게임 엔진 정리
    if (this.gameEngine) {
      this.gameEngine.stop();
      this.gameEngine = null;
    }

    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }

    // 방에 대한 모든 게임 초대 취소
    gameInviteManager.cancelRoomInvites(this.id);

    // 방 정리 (coopGameRooms + waitingCoopRooms 모두 삭제)
    removeCoopRoom(this.id);
    deleteWaitingRoom(this.id);
    this.playerIds.forEach(playerId => {
      const player = players.get(playerId);
      if (player) {
        player.roomId = null;
        player.isInGame = false;
        // 친구들에게 오프라인/온라인 상태 알림
        if (player.userId) {
          friendManager.notifyFriendsStatusChange(player.userId, true, undefined);
        }
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

  public getGameState(): string {
    return this.gameState;
  }

  /**
   * 로비 상태인지 확인 (대기 중)
   */
  public isInLobby(): boolean {
    return this.gameState === 'waiting';
  }

  /**
   * 호스트 위임 후 나가기 (로비 상태에서만 사용)
   * - 다른 플레이어에게 호스트 위임
   * - 나가는 플레이어 제거
   * - 아무도 없으면 방 삭제
   */
  public transferHostAndLeave(playerId: string): void {
    if (!this.isHost(playerId)) {
      // 호스트가 아니면 그냥 퇴장 처리
      this.handlePlayerDisconnect(playerId);
      return;
    }

    // 호스트가 나감 - 상태 초기화
    const leavingPlayer = players.get(playerId);
    if (leavingPlayer) {
      leavingPlayer.roomId = null;    // 방 ID 초기화
      leavingPlayer.isInGame = false;
      // 친구들에게 상태 변경 알림
      if (leavingPlayer.userId) {
        friendManager.notifyFriendsStatusChange(leavingPlayer.userId, true, undefined);
      }
    }

    const playerIndex = this.playerIds.indexOf(playerId);
    if (playerIndex !== -1) {
      this.playerIds.splice(playerIndex, 1);
      this.playerInfos = this.playerInfos.filter(p => p.id !== playerId);
    }

    if (this.playerIds.length === 0) {
      // 아무도 없으면 방 삭제
      console.log(`[ServerAuth] 마지막 플레이어 퇴장 - 방 삭제: ${this.id}`);
      this.cleanup();
      return;
    }

    // 다음 플레이어를 새 호스트로 지정
    const newHostId = this.playerIds[0];
    this.hostPlayerId = newHostId;

    // playerInfos에서 호스트 상태 업데이트
    this.playerInfos = this.playerInfos.map(p => ({
      ...p,
      isHost: p.id === newHostId,
    }));

    console.log(`[ServerAuth] 방장 위임: ${playerId} → ${newHostId}, Room ${this.id}`);

    // 모든 플레이어에게 알림
    this.playerIds.forEach((pid, index) => {
      sendToPlayer(pid, {
        type: 'COOP_PLAYER_LEFT',
        playerId,
      });
      // 새 호스트 정보로 방 정보 갱신
      sendToPlayer(pid, {
        type: 'COOP_ROOM_JOINED',
        roomId: this.id,
        roomCode: this.roomCode,
        players: this.playerInfos,
        yourIndex: index,
      });
    });

    // 대기 방 정보도 동기화
    syncWaitingRoomPlayers(this.id, this.playerIds, this.playerInfos);
  }
}
