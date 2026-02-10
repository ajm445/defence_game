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
  UPGRADE_CONFIG,
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
  private readonly BROADCAST_INTERVAL = 33;  // 33ms (~30Hz)

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
      difficulty: this.difficulty,
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
      currentTickTimestamp: Date.now(),
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
      // deltaTime 클램핑: 0.05초(50ms) 최대 - 클라이언트와 동일하게 설정
      // 서버 지연 발생 시 게임 상태가 급격하게 변하는 것을 방지
      const deltaTime = Math.min(deltaTimeNs / 1_000_000_000, 0.05);
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
      if (queue.length >= 120) return; // 2초분 (60fps×2), DoS 방지
      queue.push(input);
    }
  }

  private update(deltaTime: number): void {
    // Date.now() 틱당 1회 캐시
    this.state.currentTickTimestamp = Date.now();

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
      // 인덱스 순회 + 일괄 정리 (shift() O(n) 제거)
      for (let i = 0; i < queue.length; i++) {
        this.processInput(playerId, queue[i]);
      }
      queue.length = 0;
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

    // 위치 보정: 클라이언트 로컬 예측과 서버 위치 차이 최소화
    if (input.position) {
      const dist = distance(hero.x, hero.y, input.position.x, input.position.y);
      if (dist > 10 && dist < 300) {
        // 10~300px 범위에서 50% 비율로 클라이언트 위치로 보간
        hero.x = hero.x + (input.position.x - hero.x) * 0.5;
        hero.y = hero.y + (input.position.y - hero.y) * 0.5;
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

      updateBuffs(hero, deltaTime);  // 버프 먼저 업데이트 (만료된 버프가 쿨다운 계산에 영향 안 줌)
      updateSkillCooldowns(hero, deltaTime);
      processHeroMovement(hero, deltaTime, this.state.gameTime);

      // 자동 공격
      if (canHeroAutoAttack(hero, this.state.gameTime)) {
        const attackRange = hero.config?.range || hero.range || 80;
        const nearestEnemy = findNearestEnemy(this.state.enemies, hero.x, hero.y, attackRange);

        if (nearestEnemy) {
          executeSkill(this.skillContext, hero, 'Q', nearestEnemy.x, nearestEnemy.y);
          const isRanged = hero.heroClass === 'archer' || hero.heroClass === 'mage';
          const now = this.state.currentTickTimestamp;
          this.state.basicAttackEffects.push({
            id: `hero_attack_${now}_${hero.id}`,
            type: isRanged ? 'ranged' : 'melee',
            x: nearestEnemy.x,
            y: nearestEnemy.y,
            timestamp: now,
          });
        } else {
          const nearestBase = findNearestEnemyBase(this.state.enemyBases, hero.x, hero.y, attackRange + 50);
          if (nearestBase) {
            const damage = calculateHeroDamage(hero);
            damageBase(this.state, nearestBase.id, damage, this.difficulty, hero.id);
            // 쿨다운 시작 - hero.config.attackSpeed 사용 (적 공격과 동일, 업그레이드 반영)
            const attackSpeed = hero.config?.attackSpeed ?? hero.baseAttackSpeed ?? 1.0;
            hero.skillCooldowns.Q = attackSpeed;
            hero._skillQ.currentCooldown = attackSpeed;
            const isRangedBase = hero.heroClass === 'archer' || hero.heroClass === 'mage';
            this.state.basicAttackEffects.push({
              id: `hero_attack_base_${this.state.currentTickTimestamp}_${hero.id}`,
              type: isRangedBase ? 'ranged' : 'melee',
              x: nearestBase.x,
              y: nearestBase.y,
              timestamp: this.state.currentTickTimestamp,
            });
          }
        }
      }

      // 다크나이트 어둠의 칼날 토글 틱 처리
      if (hero.darkBladeActive) {
        // HP 소모: 초당 maxHp * 0.05
        hero.hp -= hero.maxHp * 0.05 * deltaTime;

        // 1초 틱 데미지
        hero.darkBladeTickTimer = (hero.darkBladeTickTimer || 0) + deltaTime;
        if (hero.darkBladeTickTimer >= 1.0) {
          hero.darkBladeTickTimer -= 1.0;

          // 데미지 계산
          const darkBladeAttack = hero.config?.attack || hero.baseAttack || 50;
          const darkBladeUpgradeBonus = (hero.upgradeLevels?.attack || 0) * UPGRADE_CONFIG.attack.perLevel;
          const darkBladeTotalDamage = darkBladeAttack + darkBladeUpgradeBonus;
          const tickDamage = Math.floor(darkBladeTotalDamage * 1.2);

          // 범위 150px 내 적에게 데미지
          const darkBladeRadius = 150;
          let totalDarkBladeDmg = 0;
          for (const enemy of this.state.enemies) {
            if (enemy.hp <= 0) continue;
            const dist = distance(hero.x, hero.y, enemy.x, enemy.y);
            if (dist <= darkBladeRadius) {
              enemy.hp -= tickDamage;
              totalDarkBladeDmg += tickDamage;
              this.state.damageNumbers.push({
                id: `db_${this.state.currentTickTimestamp}_${enemy.id}`,
                x: enemy.x, y: enemy.y - 20,
                amount: tickDamage, type: 'damage',
                createdAt: this.state.currentTickTimestamp,
              });
              if (enemy.hp <= 0) {
                this.handleEnemyDeath(enemy, hero);
              }
            }
          }

          // 범위 내 기지에 데미지
          for (const base of this.state.enemyBases) {
            if (base.destroyed) continue;
            const baseDist = distance(hero.x, hero.y, base.x, base.y);
            if (baseDist <= darkBladeRadius + 50) {
              damageBase(this.state, base.id, tickDamage, this.difficulty, hero.id);
              totalDarkBladeDmg += tickDamage;
            }
          }

          // 피해흡혈 20% 적용 (다크나이트 패시브)
          if (totalDarkBladeDmg > 0) {
            const lifestealAmount = Math.floor(totalDarkBladeDmg * 0.2);
            if (lifestealAmount > 0) {
              hero.hp = Math.min(hero.maxHp, hero.hp + lifestealAmount);
              this.state.damageNumbers.push({
                id: `db_heal_${this.state.currentTickTimestamp}_${hero.id}`,
                x: hero.x, y: hero.y - 40,
                amount: lifestealAmount, type: 'heal',
                createdAt: this.state.currentTickTimestamp,
              });
            }
          }
        }

        // 자동 해제: HP ≤ 10% 또는 스턴
        const isStunned = hero.buffs?.some(b => b.type === 'stun' && b.duration > 0);
        if (hero.hp <= hero.maxHp * 0.1 || isStunned) {
          hero.darkBladeActive = false;
          hero.darkBladeLastToggleOff = this.state.gameTime;
          hero.skillCooldowns.E = 2.0;
          hero._skillE.currentCooldown = 2.0;

          // 이펙트 제거
          for (let i = this.state.activeSkillEffects.length - 1; i >= 0; i--) {
            const eff = this.state.activeSkillEffects[i];
            if (eff.type === 'dark_blade' && eff.heroId === hero.id) {
              this.state.activeSkillEffects.splice(i, 1);
            }
          }
        }

        // HP 0 이하 시 사망 처리
        if (hero.hp <= 0) {
          hero.hp = 0;
          hero.isDead = true;
          hero.darkBladeActive = false;
          hero.buffs = [];
          hero.deathTime = this.state.gameTime;
          hero.reviveTimer = COOP_CONFIG.REVIVE.BASE_TIME;

          // 이펙트 제거
          for (let i = this.state.activeSkillEffects.length - 1; i >= 0; i--) {
            const eff = this.state.activeSkillEffects[i];
            if (eff.type === 'dark_blade' && eff.heroId === hero.id) {
              this.state.activeSkillEffects.splice(i, 1);
            }
          }
        }
      }

      applyKnightPassiveRegen(hero, deltaTime);
      applyHealerAura(hero, this.state.heroes, deltaTime);
    }
  }

  private onEnemyAttackHero(enemy: RPGEnemy, hero: ServerHero): void {
    enemyAttackHero(enemy, hero, this.state.damageNumbers, this.state.currentTickTimestamp);

    // 영웅 사망 처리
    if (hero.hp <= 0) {
      hero.hp = 0;
      hero.isDead = true;
      hero.darkBladeActive = false;
      hero.buffs = [];
      hero.deathTime = this.state.gameTime;
      hero.reviveTimer = COOP_CONFIG.REVIVE.BASE_TIME;

      // 다크블레이드 이펙트 제거
      for (let i = this.state.activeSkillEffects.length - 1; i >= 0; i--) {
        const eff = this.state.activeSkillEffects[i];
        if (eff.type === 'dark_blade' && eff.heroId === hero.id) {
          this.state.activeSkillEffects.splice(i, 1);
        }
      }
      console.log(`[ServerEngine] 영웅 사망: ${hero.id}, 부활 ${hero.reviveTimer}초`);
    }
  }

  private onEnemyAttackNexus(enemy: RPGEnemy): void {
    enemyAttackNexus(enemy, this.state.nexus, this.state.damageNumbers, this.state.currentTickTimestamp);
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
