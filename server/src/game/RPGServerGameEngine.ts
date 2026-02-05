/**
 * RPG 서버 권위 게임 엔진
 *
 * 서버에서 게임 로직을 실행하고, 모든 클라이언트에 상태를 브로드캐스트합니다.
 * - 60fps 게임 루프 (16.67ms)
 * - 50ms 상태 브로드캐스트 (20Hz)
 * - 플레이어 입력 처리
 * - 적 AI, 스킬 시스템, 보스 시스템 등 게임 로직 처리
 */

import type {
  RPGEnemy,
  UpgradeLevels,
  HeroClass,
  RPGDifficulty,
  EnemyBaseId,
} from '../../../src/types/rpg';
import type { CoopPlayerInfo } from '../../../shared/types/rpgNetwork';
import type { SerializedGameState, PlayerInput } from '../../../shared/types/hostBasedNetwork';

import {
  NEXUS_CONFIG,
  GOLD_CONFIG,
  DIFFICULTY_CONFIGS,
  ENEMY_BASE_CONFIG,
  COOP_CONFIG,
} from './rpgServerConfig';

import type {
  ServerNexus,
  ServerEnemyBase,
  ServerHero,
  ServerGameState,
} from './rpgServerTypes';

import { distance } from './rpgServerUtils';

// 모듈 import
import {
  getHeroSpawnPositions,
  createHero,
  updateDeadHero,
  updateSkillCooldowns,
  updateBuffs,
  calculateHeroDamage,
  findNearestEnemy,
  findNearestEnemyBase,
  applyHealerAura,
  applyKnightPassiveRegen,
  processHeroMovement,
  canHeroAutoAttack,
} from './rpgServerHeroSystem';

import {
  executeSkill,
  updateSkillEffects,
  updatePendingSkills,
  type SkillContext,
} from './rpgServerSkillSystem';

import {
  createEnemy,
  createBoss,
  updateSpawning,
  updateEnemies,
  enemyAttackHero,
  enemyAttackNexus,
  handleEnemyDeath,
  type EnemyContext,
} from './rpgServerEnemySystem';

import {
  updateBossSkills,
  type BossContext,
} from './rpgServerBossSystem';

import {
  updateNexusLaser,
  updatePassiveGold,
  processUpgrade,
  damageBase,
  checkWinCondition,
  cleanupEffects,
  serializeGameState,
} from './rpgServerGameSystems';

export class RPGServerGameEngine {
  private readonly TICK_RATE = 60;  // 60fps
  private readonly TICK_INTERVAL = 1000 / 60;  // 16.67ms
  private readonly BROADCAST_INTERVAL = 50;  // 50ms (20Hz)

  private roomId: string;
  private playerInfos: CoopPlayerInfo[];
  private difficulty: RPGDifficulty;
  private broadcastFn: (state: SerializedGameState) => void;
  private onGameOverFn?: (result: { victory: boolean; stats: any }) => void;

  private state: ServerGameState;
  private inputQueues: Map<string, PlayerInput[]>;
  private gameLoopInterval: NodeJS.Timeout | null = null;

  private lastTickTime: bigint;
  private lastBroadcastTime: number = 0;

  // 컨텍스트 객체들
  private skillContext: SkillContext;
  private enemyContext: EnemyContext;
  private bossContext: BossContext;

  constructor(
    roomId: string,
    playerInfos: CoopPlayerInfo[],
    difficulty: RPGDifficulty,
    broadcastFn: (state: SerializedGameState) => void,
    onGameOverFn?: (result: { victory: boolean; stats: any }) => void
  ) {
    this.roomId = roomId;
    this.playerInfos = playerInfos;
    this.difficulty = difficulty;
    this.broadcastFn = broadcastFn;
    this.onGameOverFn = onGameOverFn;
    this.inputQueues = new Map();
    this.lastTickTime = process.hrtime.bigint();

    // 각 플레이어의 입력 큐 초기화
    for (const player of playerInfos) {
      this.inputQueues.set(player.id, []);
    }

    // 게임 상태 초기화
    this.state = this.initializeGameState();

    // 컨텍스트 초기화
    this.skillContext = {
      state: this.state,
      onEnemyDeath: (enemy, attacker) => this.handleEnemyDeath(enemy, attacker),
    };

    this.enemyContext = {
      difficulty: this.difficulty,
      playerCount: this.playerInfos.length,
      onBossPhaseStart: () => this.startBossPhase(),
    };

    this.bossContext = {
      difficulty: this.difficulty,
      createEnemy: (type, fromBase, spawnX, spawnY, scaling) =>
        createEnemy(type, fromBase, spawnX, spawnY, this.difficulty, scaling),
    };

    console.log(`[ServerEngine] 게임 엔진 생성: Room ${roomId}, 플레이어 ${playerInfos.length}명, 난이도 ${difficulty}`);
  }

  private initializeGameState(): ServerGameState {
    const playerCount = this.playerInfos.length;
    const difficultyConfig = DIFFICULTY_CONFIGS[this.difficulty];

    // 영웅 초기화
    const heroes = new Map<string, ServerHero>();
    const spawnPositions = getHeroSpawnPositions(playerCount);

    for (let i = 0; i < this.playerInfos.length; i++) {
      const playerInfo = this.playerInfos[i];
      const spawnPos = spawnPositions[i];
      const hero = createHero(playerInfo, spawnPos);
      console.log(`[ServerEngine] 영웅 생성: ${hero.id}, 클래스: ${hero.heroClass}, 전직: ${hero.advancedClass || 'none'}`);
      heroes.set(hero.id, hero);
    }

    // 넥서스 초기화
    const nexus: ServerNexus = {
      x: NEXUS_CONFIG.position.x,
      y: NEXUS_CONFIG.position.y,
      hp: NEXUS_CONFIG.hp,
      maxHp: NEXUS_CONFIG.hp,
      laserCooldown: 0,
    };

    // 적 기지 초기화
    const baseHp = Math.floor(ENEMY_BASE_CONFIG.hp * difficultyConfig.enemyBaseHpMultiplier);
    const enemyBases: ServerEnemyBase[] = [
      {
        id: 'left',
        x: ENEMY_BASE_CONFIG.positions.left.x,
        y: ENEMY_BASE_CONFIG.positions.left.y,
        hp: baseHp,
        maxHp: baseHp,
        destroyed: false,
        attackers: new Set<string>(),
      },
      {
        id: 'right',
        x: ENEMY_BASE_CONFIG.positions.right.x,
        y: ENEMY_BASE_CONFIG.positions.right.y,
        hp: baseHp,
        maxHp: baseHp,
        destroyed: false,
        attackers: new Set<string>(),
      },
    ];

    return {
      gameTime: 0,
      gamePhase: 'playing',
      heroes,
      enemies: [],
      nexus,
      enemyBases,
      gold: GOLD_CONFIG.STARTING_GOLD,
      upgradeLevels: { attack: 0, speed: 0, hp: 0, attackSpeed: 0, goldRate: 0, range: 0 },
      activeSkillEffects: [],
      basicAttackEffects: [],
      nexusLaserEffects: [],
      pendingSkills: [],
      bossSkillWarnings: [],
      bossSkillExecutedEffects: [],
      damageNumbers: [],
      running: true,
      paused: false,
      gameOver: false,
      victory: false,
      lastSpawnTime: 0,
      stats: {
        totalKills: 0,
        totalGoldEarned: 0,
        basesDestroyed: 0,
        bossesKilled: 0,
        timePlayed: 0,
      },
      goldAccumulator: 0,
      nexusLaserCooldown: 0,
    };
  }

  public start(): void {
    if (this.gameLoopInterval) {
      console.warn(`[ServerEngine] 이미 실행 중: Room ${this.roomId}`);
      return;
    }

    console.log(`[ServerEngine] 게임 시작: Room ${this.roomId}`);
    this.lastTickTime = process.hrtime.bigint();
    this.lastBroadcastTime = 0;

    this.gameLoopInterval = setInterval(() => {
      const now = process.hrtime.bigint();
      const deltaTimeNs = Number(now - this.lastTickTime);
      const deltaTime = deltaTimeNs / 1_000_000_000;
      this.lastTickTime = now;

      if (this.state.paused || !this.state.running) {
        return;
      }

      this.update(deltaTime);

      this.lastBroadcastTime += deltaTimeNs / 1_000_000;
      if (this.lastBroadcastTime >= this.BROADCAST_INTERVAL) {
        this.broadcastState();
        this.lastBroadcastTime = 0;
      }
    }, this.TICK_INTERVAL);
  }

  public stop(): void {
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
      console.log(`[ServerEngine] 게임 중지: Room ${this.roomId}`);
    }
  }

  public pause(): void {
    this.state.paused = true;
    console.log(`[ServerEngine] 게임 일시정지: Room ${this.roomId}`);
  }

  public resume(): void {
    this.state.paused = false;
    this.lastTickTime = process.hrtime.bigint();
    console.log(`[ServerEngine] 게임 재개: Room ${this.roomId}`);
  }

  public handlePlayerInput(playerId: string, input: PlayerInput): void {
    const queue = this.inputQueues.get(playerId);
    if (queue) {
      queue.push(input);
    }
  }

  private update(deltaTime: number): void {
    // 1. 게임 시간 업데이트
    this.state.gameTime += deltaTime;
    this.state.stats.timePlayed = this.state.gameTime;

    // 2. 입력 처리
    this.processAllInputs();

    // 3. 영웅 업데이트
    this.updateHeroes(deltaTime);

    // 4. 적 스폰
    updateSpawning(this.state, this.enemyContext);

    // 5. 적 AI 업데이트
    updateEnemies(
      this.state,
      deltaTime,
      (enemy, hero) => this.onEnemyAttackHero(enemy, hero),
      (enemy) => this.onEnemyAttackNexus(enemy)
    );

    // 6. 스킬 이펙트 업데이트
    updateSkillEffects(this.state, deltaTime);

    // 7. 지연 스킬 처리
    updatePendingSkills(this.skillContext);

    // 8. 보스 스킬 처리
    updateBossSkills(this.state, deltaTime, this.bossContext);

    // 9. 넥서스 레이저 업데이트
    updateNexusLaser(this.state, deltaTime, (enemy) => this.handleEnemyDeath(enemy));

    // 10. 골드 수급
    updatePassiveGold(this.state, deltaTime);

    // 11. 승리/패배 조건 확인
    const result = checkWinCondition(this.state);
    if (result) {
      this.endGame(result === 'victory');
    }

    // 12. 이펙트 정리
    cleanupEffects(this.state);
  }

  private processAllInputs(): void {
    for (const [playerId, queue] of this.inputQueues) {
      while (queue.length > 0) {
        const input = queue.shift()!;
        this.processInput(playerId, input);
      }
    }
  }

  private processInput(playerId: string, input: PlayerInput): void {
    const heroId = `hero_${playerId}`;
    const hero = this.state.heroes.get(heroId);
    if (!hero || hero.isDead) return;

    // 이동 방향 업데이트
    if (input.moveDirection !== undefined) {
      hero.moveDirection = input.moveDirection ?? null;
    }

    // 위치 보정
    if (input.position) {
      const dist = distance(hero.x, hero.y, input.position.x, input.position.y);
      if (dist > 50 && dist < 200) {
        hero.x = hero.x + (input.position.x - hero.x) * 0.3;
        hero.y = hero.y + (input.position.y - hero.y) * 0.3;
      }
    }

    // 스킬 사용 (Q 스킬은 자동 공격이므로 클라이언트 요청 무시)
    if (input.skillUsed && input.skillUsed.skillSlot !== 'Q') {
      executeSkill(this.skillContext, hero, input.skillUsed.skillSlot, input.skillUsed.targetX, input.skillUsed.targetY);
    }

    // 업그레이드 요청
    if (input.upgradeRequested) {
      processUpgrade(hero, input.upgradeRequested);
    }
  }

  private updateHeroes(deltaTime: number): void {
    for (const hero of this.state.heroes.values()) {
      if (hero.isDead) {
        updateDeadHero(hero, deltaTime);
        continue;
      }

      updateSkillCooldowns(hero, deltaTime);
      updateBuffs(hero, deltaTime);
      processHeroMovement(hero, deltaTime, this.state.gameTime);

      // 자동 공격
      if (canHeroAutoAttack(hero, this.state.gameTime)) {
        const attackRange = hero.config?.range || hero.range || 80;
        const nearestEnemy = findNearestEnemy(this.state.enemies, hero.x, hero.y, attackRange);

        if (nearestEnemy) {
          executeSkill(this.skillContext, hero, 'Q', nearestEnemy.x, nearestEnemy.y);
          const isRanged = hero.heroClass === 'archer' || hero.heroClass === 'mage';
          this.state.basicAttackEffects.push({
            id: `hero_attack_${Date.now()}_${hero.id}`,
            type: isRanged ? 'ranged' : 'melee',
            x: nearestEnemy.x,
            y: nearestEnemy.y,
            timestamp: Date.now(),
          });
        } else {
          const nearestBase = findNearestEnemyBase(this.state.enemyBases, hero.x, hero.y, attackRange + 50);
          if (nearestBase) {
            const damage = calculateHeroDamage(hero);
            damageBase(this.state, nearestBase.id, damage, this.difficulty, hero.id);
            const qSkill = hero.skills?.find(s => s.key === 'Q');
            if (qSkill) qSkill.currentCooldown = qSkill.cooldown;
            const isRanged = hero.heroClass === 'archer' || hero.heroClass === 'mage';
            this.state.basicAttackEffects.push({
              id: `hero_attack_base_${Date.now()}_${hero.id}`,
              type: isRanged ? 'ranged' : 'melee',
              x: nearestBase.x,
              y: nearestBase.y,
              timestamp: Date.now(),
            });
          }
        }
      }

      applyKnightPassiveRegen(hero, deltaTime);
      applyHealerAura(hero, this.state.heroes, deltaTime);
    }
  }

  private onEnemyAttackHero(enemy: RPGEnemy, hero: ServerHero): void {
    enemyAttackHero(enemy, hero, this.state.damageNumbers);

    // 영웅 사망 처리
    if (hero.hp <= 0) {
      hero.hp = 0;
      hero.isDead = true;
      hero.deathTime = this.state.gameTime;
      const wave = Math.floor(this.state.gameTime / 60);
      hero.reviveTimer = Math.min(
        COOP_CONFIG.REVIVE.MAX_TIME,
        COOP_CONFIG.REVIVE.BASE_TIME + wave * COOP_CONFIG.REVIVE.TIME_PER_WAVE
      );
      console.log(`[ServerEngine] 영웅 사망: ${hero.id}, 부활 ${hero.reviveTimer}초`);
    }
  }

  private onEnemyAttackNexus(enemy: RPGEnemy): void {
    enemyAttackNexus(enemy, this.state.nexus, this.state.damageNumbers);
  }

  private handleEnemyDeath(enemy: RPGEnemy, attacker?: ServerHero): void {
    handleEnemyDeath(this.state, enemy, attacker);
  }

  private startBossPhase(): void {
    console.log(`[ServerEngine] 보스 페이즈 시작: Room ${this.roomId}`);
    this.state.gamePhase = 'boss_phase';

    const destroyedBases = this.state.enemyBases.filter(b => b.destroyed);
    for (const base of destroyedBases) {
      const boss = createBoss(base.id, base.x, base.y, this.difficulty, this.playerInfos.length);
      this.state.enemies.push(boss);
    }
  }

  private endGame(victory: boolean): void {
    this.state.gameOver = true;
    this.state.victory = victory;
    this.state.running = false;
    this.state.gamePhase = victory ? 'victory' : 'defeat';

    console.log(`[ServerEngine] 게임 종료: Room ${this.roomId}, 승리: ${victory}`);

    this.broadcastState();

    if (this.onGameOverFn) {
      this.onGameOverFn({ victory, stats: this.state.stats });
    }

    this.stop();
  }

  private broadcastState(): void {
    const serializedState = serializeGameState(this.state);
    this.broadcastFn(serializedState);
  }

  // 외부 호출용 메서드들
  public damageBase(baseId: EnemyBaseId, damage: number, attackerId?: string): void {
    damageBase(this.state, baseId, damage, this.difficulty, attackerId);
  }

  public getState(): ServerGameState {
    return this.state;
  }

  public isRunning(): boolean {
    return this.state.running;
  }

  public isPaused(): boolean {
    return this.state.paused;
  }

  public isGameOver(): boolean {
    return this.state.gameOver;
  }
}
