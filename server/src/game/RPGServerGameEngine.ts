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
  createBoss2,
  updateSpawning,
  updateEnemies,
  enemyAttackHero,
  enemyAttackNexus,
  handleEnemyDeath,
  type EnemyContext,
} from './rpgServerEnemySystem';

import {
  updateBossSkills,
  updateVoidZones,
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
  serializeDeltaGameState,
  serializeEffectState,
  type DirtyFlags,
} from './rpgServerGameSystems';
import type { SerializedEffectState } from '../../../shared/types/hostBasedNetwork';

export class RPGServerGameEngine {
  private readonly TICK_RATE = 60;  // 60fps
  private readonly TICK_INTERVAL = 1000 / 60;  // 16.67ms
  private readonly BROADCAST_INTERVAL = 33;  // 33ms (~30Hz)
  private readonly EFFECT_BROADCAST_INTERVAL = 66;  // 66ms (~15Hz)
  private readonly FULL_SNAPSHOT_INTERVAL = 10;  // 10프레임마다 풀 스냅샷

  private roomId: string;
  private playerInfos: CoopPlayerInfo[];
  private difficulty: RPGDifficulty;
  private broadcastFn: (state: SerializedGameState) => void;
  private effectBroadcastFn?: (effects: SerializedEffectState) => void;
  private onGameOverFn?: (result: { victory: boolean; stats: any }) => void;

  private state: ServerGameState;
  private inputQueues: Map<string, PlayerInput[]>;
  private gameLoopInterval: NodeJS.Timeout | null = null;

  private lastTickTime: bigint;
  private lastBroadcastTime: number = 0;
  private lastEffectBroadcastTime: number = 0;

  // 델타 업데이트 추적
  private frameCounter: number = 0;
  private dirtyFlags: DirtyFlags = {
    nexus: true,
    enemyBases: true,
    gold: true,
    upgradeLevels: true,
    stats: true,
  };
  private prevNexusHp: number = 0;
  private prevBaseHps: number[] = [];
  private prevGold: number = 0;
  private prevUpgradeLevels: string = '';
  private prevTotalKills: number = 0;
  private prevBasesDestroyed: number = 0;
  private prevBossesKilled: number = 0;

  // 입력 시퀀스 ACK 추적
  private lastProcessedSeq: Map<string, number> = new Map();

  // 컨텍스트 객체들
  private skillContext: SkillContext;
  private enemyContext: EnemyContext;
  private bossContext: BossContext;

  constructor(
    roomId: string,
    playerInfos: CoopPlayerInfo[],
    difficulty: RPGDifficulty,
    broadcastFn: (state: SerializedGameState) => void,
    onGameOverFn?: (result: { victory: boolean; stats: any }) => void,
    effectBroadcastFn?: (effects: SerializedEffectState) => void
  ) {
    this.roomId = roomId;
    this.playerInfos = playerInfos;
    this.difficulty = difficulty;
    this.broadcastFn = broadcastFn;
    this.effectBroadcastFn = effectBroadcastFn;
    this.onGameOverFn = onGameOverFn;
    this.inputQueues = new Map();
    this.lastTickTime = process.hrtime.bigint();

    // 각 플레이어의 입력 큐 초기화
    for (const player of playerInfos) {
      this.inputQueues.set(player.id, []);
    }

    // 게임 상태 초기화
    this.state = this.initializeGameState();

    // 델타 추적 초기값 설정
    this.prevNexusHp = Math.round(this.state.nexus.hp);
    this.prevBaseHps = this.state.enemyBases.map(b => Math.round(b.hp));
    this.prevGold = Math.floor(this.state.gold);
    this.prevUpgradeLevels = JSON.stringify(this.state.upgradeLevels);
    this.prevTotalKills = this.state.stats.totalKills;
    this.prevBasesDestroyed = this.state.stats.basesDestroyed;
    this.prevBossesKilled = this.state.stats.bossesKilled;

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

    // 넥서스 초기화 (난이도별 HP 배율 적용)
    const nexusHp = Math.floor(NEXUS_CONFIG.hp * difficultyConfig.nexusHpMultiplier);
    const nexus: ServerNexus = {
      x: NEXUS_CONFIG.position.x,
      y: NEXUS_CONFIG.position.y,
      hp: nexusHp,
      maxHp: nexusHp,
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
      bossActiveZones: [],
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

      const elapsedMs = deltaTimeNs / 1_000_000;
      this.lastBroadcastTime += elapsedMs;
      this.lastEffectBroadcastTime += elapsedMs;

      if (this.lastBroadcastTime >= this.BROADCAST_INTERVAL) {
        this.broadcastState();
        this.lastBroadcastTime = 0;
      }

      if (this.lastEffectBroadcastTime >= this.EFFECT_BROADCAST_INTERVAL) {
        this.broadcastEffects();
        this.lastEffectBroadcastTime = 0;
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

  public restoreInputQueue(playerId: string): void {
    if (!this.inputQueues.has(playerId)) {
      this.inputQueues.set(playerId, []);
    }
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

    // 8.5. Void Zone 지속 데미지 처리
    updateVoidZones(this.state, deltaTime);

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
        const input = queue[i];
        this.processInput(playerId, input);
        // 입력 시퀀스 ACK 추적
        if (input.seq != null) {
          this.lastProcessedSeq.set(playerId, input.seq);
        }
      }
      queue.length = 0;
    }
  }

  /**
   * 영웅의 현재 최대 이동 속도 계산 (버프 포함)
   */
  private getHeroMaxSpeed(hero: ServerHero): number {
    let speed = hero.config?.speed || hero.baseSpeed || 3;
    const swiftnessBuff = hero.buffs?.find(b => b.type === 'swiftness' && b.duration > 0);
    if (swiftnessBuff?.moveSpeedBonus) {
      speed *= (1 + swiftnessBuff.moveSpeedBonus);
    }
    return speed;
  }

  private processInput(playerId: string, input: PlayerInput): void {
    const heroId = `hero_${playerId}`;
    const hero = this.state.heroes.get(heroId);
    if (!hero || hero.isDead) return;

    // 이동 방향 업데이트
    if (input.moveDirection !== undefined) {
      hero.moveDirection = input.moveDirection ?? null;
      // 이동 중이면 마지막 입력 시각 기록 (타임아웃 자동 정지용)
      if (hero.moveDirection) {
        hero._lastMoveInputTime = this.state.currentTickTimestamp;
      }
    }

    // 위치 보정: 클라이언트 로컬 예측과 서버 위치 차이 최소화
    if (input.position) {
      const dx = input.position.x - hero.x;
      const dy = input.position.y - hero.y;
      const distSq = dx * dx + dy * dy;

      // 이동 속도 검증: 돌진/시전/스턴 중이 아닐 때만
      // 돌진 중에는 서버가 직접 위치를 제어하므로 클라이언트 위치 무시
      const isDashing = !!hero.dashState;
      const isCasting = !!(hero.castingUntil && this.state.gameTime < hero.castingUntil);
      const isStunned = !!hero.buffs?.some(b => b.type === 'stun' && b.duration > 0);

      // 넉백 직후 1초간 속도 검증 완화 (보스 넉백으로 큰 거리 이동)
      const recentKnockback = hero._lastKnockbackTime != null
        && (this.state.gameTime - hero._lastKnockbackTime) < 1.0;

      if (!isDashing && !isCasting && !isStunned && !recentKnockback && distSq > 25) {
        // 서버 위치 대비 클라이언트 위치가 이동 속도 기준 비합리적인지 검증
        // maxSpeed × deltaTime(33ms broadcast) × 60 × margin
        // 네트워크 지터/패킷 누적 고려: 3배 마진 + 80px 고정 마진
        const maxSpeed = this.getHeroMaxSpeed(hero);
        const maxDistPerUpdate = maxSpeed * (this.BROADCAST_INTERVAL / 1000) * 60 * 3.0 + 80;
        const maxDistSq = maxDistPerUpdate * maxDistPerUpdate;

        if (distSq > maxDistSq) {
          // 비합리적 이동: 클라이언트 위치 무시 (서버 위치 유지)
          // 200px 하드 스냅도 차단 → 속도핵 방지
        } else if (distSq >= 40000) {
          // 200px 이상이지만 속도 범위 내: 즉시 스냅 (심각한 불일치)
          hero.x = input.position.x;
          hero.y = input.position.y;
        } else {
          // 5~200px: 방향 기반 보정
          let ratio = 0.5;
          if (hero.moveDirection) {
            const dirLen = Math.sqrt(hero.moveDirection.x ** 2 + hero.moveDirection.y ** 2);
            if (dirLen > 0) {
              const dist = Math.sqrt(distSq);
              const dot = (dx * hero.moveDirection.x + dy * hero.moveDirection.y) / (dist * dirLen);
              ratio = dot > 0 ? 0.5 : 0.15;
            }
          }
          hero.x += dx * ratio;
          hero.y += dy * ratio;
        }
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
      processHeroMovement(hero, deltaTime, this.state.gameTime, this.state.currentTickTimestamp);

      // 자동 공격
      if (canHeroAutoAttack(hero, this.state.gameTime)) {
        const attackRange = hero.config?.range || hero.range || 80;
        const nearestEnemy = findNearestEnemy(this.state.enemies, hero.x, hero.y, attackRange);

        if (nearestEnemy) {
          executeSkill(this.skillContext, hero, 'Q', nearestEnemy.x, nearestEnemy.y);
          // 다크나이트/아크메이지/힐러: pendingSkill 핸들러에서 데미지/이펙트/사운드 동시 생성 (프레임 싱크)
          if (hero.advancedClass !== 'darkKnight' && hero.advancedClass !== 'archmage' && hero.advancedClass !== 'healer') {
            const isRanged = hero.heroClass === 'archer' || hero.heroClass === 'mage';
            const now = this.state.currentTickTimestamp;
            this.state.basicAttackEffects.push({
              id: `hero_attack_${now}_${hero.id}`,
              type: isRanged ? 'ranged' : 'melee',
              x: nearestEnemy.x,
              y: nearestEnemy.y,
              timestamp: now,
              advancedClass: hero.advancedClass as string | undefined,
            });
          }
        } else {
          const nearestBase = findNearestEnemyBase(this.state.enemyBases, hero.x, hero.y, attackRange + 50);
          if (nearestBase) {
            // pendingSkill 프레임 싱크 클래스: 기지 공격도 executeSkill 경유
            if (hero.advancedClass === 'darkKnight' || hero.advancedClass === 'archmage' || hero.advancedClass === 'healer') {
              executeSkill(this.skillContext, hero, 'Q', nearestBase.x, nearestBase.y);
            } else {
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
                advancedClass: hero.advancedClass as string | undefined,
              });
            }
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

        // HP 0 이하 시 사망 처리 (자동 해제보다 먼저 체크)
        if (hero.hp <= 0) {
          this.handleHeroDeath(hero);
        } else {
          // 자동 해제: HP <= 10% 또는 스턴
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
        }
      }

      applyKnightPassiveRegen(hero, deltaTime);
      applyHealerAura(hero, this.state.heroes, deltaTime);
    }
  }

  private onEnemyAttackHero(enemy: RPGEnemy, hero: ServerHero): void {
    enemyAttackHero(enemy, hero, this.state.damageNumbers, this.state.currentTickTimestamp);

    // 보스 기본공격 이펙트
    if (enemy.type === 'boss' || enemy.type === 'boss2') {
      this.state.basicAttackEffects.push({
        id: `enemy_attack_${this.state.currentTickTimestamp}_${enemy.id}`,
        type: enemy.type as 'boss' | 'boss2',
        x: hero.x,
        y: hero.y,
        timestamp: this.state.currentTickTimestamp,
      });
    }

    // 영웅 사망 처리
    if (hero.hp <= 0) {
      this.handleHeroDeath(hero);
    }
  }

  private onEnemyAttackNexus(enemy: RPGEnemy): void {
    enemyAttackNexus(enemy, this.state.nexus, this.state.damageNumbers, this.state.currentTickTimestamp);

    // 보스 기본공격 이펙트 (넥서스 공격)
    if (enemy.type === 'boss' || enemy.type === 'boss2') {
      this.state.basicAttackEffects.push({
        id: `enemy_nexus_attack_${this.state.currentTickTimestamp}_${enemy.id}`,
        type: enemy.type as 'boss' | 'boss2',
        x: this.state.nexus.x,
        y: this.state.nexus.y,
        timestamp: this.state.currentTickTimestamp,
      });
    }
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

      // hell/apocalypse 난이도에서 boss2 (암흑 마법사)도 스폰
      if (this.difficulty === 'hell' || this.difficulty === 'apocalypse') {
        const boss2 = createBoss2(base.id, base.x + 100, base.y + 50, this.difficulty, this.playerInfos.length);
        this.state.enemies.push(boss2);
      }
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
    this.frameCounter++;

    // 변경 감지 (dirty flags 업데이트)
    this.updateDirtyFlags();

    // 입력 ACK 맵 생성
    const inputAcks: Record<string, number> = {};
    for (const [playerId, seq] of this.lastProcessedSeq) {
      inputAcks[playerId] = seq;
    }

    const isFullSnapshot = this.frameCounter % this.FULL_SNAPSHOT_INTERVAL === 0;

    if (isFullSnapshot) {
      // 풀 스냅샷: 모든 필드 포함
      const serializedState = serializeGameState(this.state);
      serializedState.frameId = this.frameCounter;
      serializedState.inputAcks = inputAcks;
      this.broadcastFn(serializedState);
    } else {
      // 델타: 변경된 섹션만 포함
      const deltaState = serializeDeltaGameState(
        this.state,
        this.dirtyFlags,
        this.frameCounter,
        inputAcks
      );
      this.broadcastFn(deltaState);
    }

    // dirty flags 리셋
    this.dirtyFlags.nexus = false;
    this.dirtyFlags.enemyBases = false;
    this.dirtyFlags.gold = false;
    this.dirtyFlags.upgradeLevels = false;
    this.dirtyFlags.stats = false;
  }

  private broadcastEffects(): void {
    if (!this.effectBroadcastFn) return;
    const effects = serializeEffectState(this.state);
    // 이펙트가 모두 비어있으면 전송 생략
    if (effects.damageNumbers.length === 0 &&
        effects.basicAttackEffects.length === 0 &&
        effects.nexusLaserEffects.length === 0 &&
        effects.bossSkillExecutedEffects.length === 0) {
      return;
    }
    this.effectBroadcastFn(effects);
  }

  private updateDirtyFlags(): void {
    // 넥서스 HP 변경 감지
    const nexusHp = Math.round(this.state.nexus.hp);
    if (nexusHp !== this.prevNexusHp) {
      this.dirtyFlags.nexus = true;
      this.prevNexusHp = nexusHp;
    }

    // 적 기지 HP 변경 감지
    for (let i = 0; i < this.state.enemyBases.length; i++) {
      const hp = Math.round(this.state.enemyBases[i].hp);
      if (hp !== (this.prevBaseHps[i] ?? -1)) {
        this.dirtyFlags.enemyBases = true;
        this.prevBaseHps[i] = hp;
      }
    }

    // 골드 변경 감지
    const gold = Math.floor(this.state.gold);
    if (gold !== this.prevGold) {
      this.dirtyFlags.gold = true;
      this.prevGold = gold;
    }

    // 업그레이드 변경 감지 (JSON 비교 — 드물게 발생)
    const upgradeStr = JSON.stringify(this.state.upgradeLevels);
    if (upgradeStr !== this.prevUpgradeLevels) {
      this.dirtyFlags.upgradeLevels = true;
      this.prevUpgradeLevels = upgradeStr;
    }

    // 통계 변경 감지 (kills, basesDestroyed, bossesKilled 모두 체크)
    const stats = this.state.stats;
    if (stats.totalKills !== this.prevTotalKills ||
        stats.basesDestroyed !== this.prevBasesDestroyed ||
        stats.bossesKilled !== this.prevBossesKilled) {
      this.dirtyFlags.stats = true;
      this.prevTotalKills = stats.totalKills;
      this.prevBasesDestroyed = stats.basesDestroyed;
      this.prevBossesKilled = stats.bossesKilled;
    }
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

  private handleHeroDeath(hero: any): void {
    hero.hp = 0;
    hero.isDead = true;
    hero.darkBladeActive = false;
    hero.deathTime = this.state.gameTime;
    hero.reviveTimer = COOP_CONFIG.REVIVE.BASE_TIME;

    // 버서커 E 버프 중 사망: 남은 버프 시간 제외, 실제 쿨다운만 적용
    const berserkerBuff = hero.buffs?.find((b: any) => b.type === 'berserker' && b.duration > 0);
    if (berserkerBuff) {
      hero.skillCooldowns.E = hero._skillE.cooldown;
      hero._skillE.currentCooldown = hero._skillE.cooldown;
    }

    hero.buffs = [];

    // 다크나이트 E 쿨다운 초기화
    if (hero.advancedClass === 'darkKnight') {
      hero.skillCooldowns.E = 0;
      hero._skillE.currentCooldown = 0;
    }

    // 다크블레이드/스프링오브라이프 이펙트 제거
    for (let i = this.state.activeSkillEffects.length - 1; i >= 0; i--) {
      const eff = this.state.activeSkillEffects[i];
      if (eff.heroId === hero.id && (eff.type === 'dark_blade' || eff.type === 'spring_of_life')) {
        this.state.activeSkillEffects.splice(i, 1);
      }
    }

    console.log(`[ServerEngine] 영웅 사망: ${hero.id}, 부활 ${hero.reviveTimer}초`);
  }

  public swapHeroPlayerId(oldPlayerId: string, newPlayerId: string): void {
    const oldHeroId = `hero_${oldPlayerId}`;
    const newHeroId = `hero_${newPlayerId}`;
    const hero = this.state.heroes.get(oldHeroId);
    if (hero) {
      hero.id = newHeroId;
      hero.playerId = newPlayerId;
      this.state.heroes.delete(oldHeroId);
      this.state.heroes.set(newHeroId, hero);
      console.log(`[ServerEngine] 영웅 playerId 교체: ${oldHeroId} → ${newHeroId}`);
    }
  }

  public pauseHero(playerId: string): void {
    const heroId = `hero_${playerId}`;
    const hero = this.state.heroes.get(heroId);
    if (hero) {
      // 입력 큐 제거 (영웅은 정지 상태로 유지)
      this.inputQueues.delete(playerId);
      this.lastProcessedSeq.delete(playerId);
      hero.moveDirection = null;
      console.log(`[ServerEngine] 영웅 일시정지 (재접속 대기): ${heroId}`);
    }
  }

  public removeHero(playerId: string): void {
    const heroId = `hero_${playerId}`;
    const hero = this.state.heroes.get(heroId);
    if (hero) {
      // 해당 영웅의 이펙트 정리 (dark_blade, spring_of_life 등 장기 지속)
      for (let i = this.state.activeSkillEffects.length - 1; i >= 0; i--) {
        if (this.state.activeSkillEffects[i].heroId === heroId) {
          this.state.activeSkillEffects.splice(i, 1);
        }
      }

      // 해당 영웅의 pendingSkills 정리
      for (let i = this.state.pendingSkills.length - 1; i >= 0; i--) {
        if (this.state.pendingSkills[i].casterId === heroId) {
          this.state.pendingSkills.splice(i, 1);
        }
      }

      this.state.heroes.delete(heroId);
      this.lastProcessedSeq.delete(playerId);
      this.inputQueues.delete(playerId);
      console.log(`[ServerEngine] 영웅 제거 (연결 해제): ${heroId}`);
    }
  }
}
