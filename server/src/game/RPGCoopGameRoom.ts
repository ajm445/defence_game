import { players, sendToPlayer } from '../state/players';
import { removeCoopRoom } from '../websocket/MessageHandler';
import { setWaitingRoomState, syncWaitingRoomPlayers, deleteWaitingRoom } from '../room/CoopRoomManager';
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
  public roomCode: string;
  private playerIds: string[];
  private playerInfos: CoopPlayerInfo[];
  private hostPlayerId: string;

  private gameState: 'waiting' | 'countdown' | 'playing' | 'ended' = 'waiting';
  private countdownTimer: NodeJS.Timeout | null = null;

  // 각 플레이어의 heroId 매핑 (호스트가 할당)
  private playerHeroMap: Map<string, string> = new Map();

  constructor(id: string, roomCode: string, playerIds: string[], playerInfos: CoopPlayerInfo[]) {
    this.id = id;
    this.roomCode = roomCode;
    this.playerIds = playerIds;
    this.playerInfos = playerInfos;

    // 호스트 식별 (첫 번째 플레이어가 방장)
    this.hostPlayerId = playerInfos.find(p => p.isHost)?.id || playerIds[0];

    console.log(`[Relay] 게임 방 생성: ${id} (${roomCode}), 호스트: ${this.hostPlayerId}, 플레이어: ${playerIds.length}명`);
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
   * 게임 중 또는 게임 종료 후 로비로 복귀
   * → 호스트만 호출 가능
   */
  public returnToLobby(playerId: string): void {
    console.log(`[Relay] 로비 복귀 요청: Room ${this.id}, playerId=${playerId}, hostPlayerId=${this.hostPlayerId}, gameState=${this.gameState}`);

    if (playerId !== this.hostPlayerId) {
      console.log(`[Relay] 로비 복귀 실패: 호스트가 아님 (${playerId} !== ${this.hostPlayerId})`);
      return;
    }

    // 대기 중이거나 카운트다운 중에는 로비 복귀 불가
    if (this.gameState === 'waiting' || this.gameState === 'countdown') {
      console.log(`[Relay] 로비 복귀 실패: 이미 대기 중 또는 카운트다운 중 (${this.gameState})`);
      return;
    }

    // 카운트다운 타이머 정리
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }

    this.gameState = 'waiting';

    // 플레이어 준비 상태 초기화
    this.playerInfos = this.playerInfos.map(p => ({
      ...p,
      isReady: p.isHost, // 호스트는 항상 준비 상태
    }));

    // 모든 플레이어에게 로비 복귀 알림 (플레이어 정보 포함)
    this.broadcast({
      type: 'COOP_RETURN_TO_LOBBY',
      roomCode: this.roomCode,
      roomId: this.id,
      players: this.playerInfos,
      hostPlayerId: this.hostPlayerId,
    });

    // 대기 방 상태를 'waiting'으로 변경하여 로비에 표시
    setWaitingRoomState(this.id, 'waiting');
    syncWaitingRoomPlayers(this.id, this.playerIds, this.playerInfos);

    console.log(`[Relay] 로비 복귀: Room ${this.id} (${this.roomCode})`);
  }

  /**
   * 게임 재시작 (로비에서 호스트가 시작)
   * → 호스트만 호출 가능
   */
  public restartGame(playerId: string): void {
    console.log(`[Relay] 게임 재시작 요청: Room ${this.id}, playerId=${playerId}, hostPlayerId=${this.hostPlayerId}, gameState=${this.gameState}`);

    if (playerId !== this.hostPlayerId) {
      console.log(`[Relay] 게임 재시작 실패: 호스트가 아님 (${playerId} !== ${this.hostPlayerId})`);
      return;
    }

    if (this.gameState !== 'waiting' && this.gameState !== 'ended') {
      console.log(`[Relay] 게임 재시작 실패: 잘못된 상태 (${this.gameState})`);
      return;
    }

    // 모든 플레이어가 준비되었는지 확인 (호스트 제외, 혼자일 때는 스킵)
    if (this.playerInfos.length > 1) {
      const readyStates = this.playerInfos.map(p => `${p.id.slice(0, 8)}: isHost=${p.isHost}, isReady=${p.isReady}`);
      console.log(`[Relay] 플레이어 준비 상태: ${readyStates.join(', ')}`);
      const allReady = this.playerInfos.every(p => p.isHost || p.isReady);
      if (!allReady) {
        console.log(`[Relay] 게임 재시작 실패: 모든 플레이어가 준비되지 않음`);
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

  /**
   * 게임 일시정지 (호스트 전용)
   */
  public pauseGame(playerId: string): void {
    if (playerId !== this.hostPlayerId) {
      return;
    }

    if (this.gameState !== 'playing') {
      return;
    }

    // 모든 플레이어에게 일시정지 알림
    this.broadcast({ type: 'COOP_GAME_PAUSED' });
    console.log(`[Relay] 게임 일시정지: Room ${this.id}`);
  }

  /**
   * 게임 재개 (호스트 전용)
   */
  public resumeGame(playerId: string): void {
    if (playerId !== this.hostPlayerId) {
      return;
    }

    if (this.gameState !== 'playing') {
      return;
    }

    // 모든 플레이어에게 재개 알림
    this.broadcast({ type: 'COOP_GAME_RESUMED' });
    console.log(`[Relay] 게임 재개: Room ${this.id}`);
  }

  /**
   * 게임 중단 (호스트 전용)
   * → 모든 플레이어에게 게임 오버 알림
   */
  public stopGame(playerId: string): void {
    if (playerId !== this.hostPlayerId) {
      return;
    }

    if (this.gameState !== 'playing') {
      return;
    }

    this.gameState = 'ended';

    // 모든 플레이어에게 게임 중단 알림
    this.broadcast({ type: 'COOP_GAME_STOPPED' });
    console.log(`[Relay] 게임 중단: Room ${this.id}`);
  }

  /**
   * 플레이어 직업 변경 (로비에서)
   */
  public changePlayerClass(playerId: string, heroClass: HeroClass, characterLevel: number = 1, statUpgrades?: any): void {
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
    });

    // 준비 상태도 함께 알림 (호스트 제외)
    if (!playerInfo.isHost) {
      this.broadcast({
        type: 'COOP_PLAYER_READY',
        playerId,
        isReady: false,
      });
    }

    console.log(`[Relay] ${playerId} 직업 변경: ${heroClass} (Lv.${characterLevel})`);
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

    console.log(`[Coop] ${playerId} 준비 상태: ${isReady}`);
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

    // 방 정리 (coopGameRooms + waitingCoopRooms 모두 삭제)
    removeCoopRoom(this.id);
    deleteWaitingRoom(this.id);
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

    // 호스트가 나감
    const playerIndex = this.playerIds.indexOf(playerId);
    if (playerIndex !== -1) {
      this.playerIds.splice(playerIndex, 1);
      this.playerInfos = this.playerInfos.filter(p => p.id !== playerId);
    }

    if (this.playerIds.length === 0) {
      // 아무도 없으면 방 삭제
      console.log(`[Relay] 마지막 플레이어 퇴장 - 방 삭제: ${this.id}`);
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

    console.log(`[Relay] 호스트 위임: ${playerId} → ${newHostId}, Room ${this.id}`);

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
