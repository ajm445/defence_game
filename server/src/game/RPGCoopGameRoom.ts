import { v4 as uuidv4 } from 'uuid';
import { players, sendToPlayer } from '../state/players';
import { removeCoopRoom } from '../websocket/MessageHandler';
import type { HeroClass, SkillType, Buff, PassiveGrowthState, SkillEffect, PendingSkill } from '../../../src/types/rpg';
import type { UnitType } from '../../../src/types/unit';
import type {
  CoopPlayerInfo,
  RPGCoopGameState,
  RPGCoopGameEvent,
  RPGCoopGameResult,
  NetworkCoopHero,
  NetworkCoopEnemy,
  COOP_CONFIG,
} from '../../../shared/types/rpgNetwork';

// 서버측 협동 모드 설정
const CONFIG = {
  MAP_WIDTH: 2000,
  MAP_HEIGHT: 2000,
  MAP_CENTER_X: 1000,
  MAP_CENTER_Y: 1000,
  SPAWN_MARGIN: 50,

  // 부활 시스템
  REVIVE: {
    BASE_TIME: 10,
    TIME_PER_WAVE: 2,
    MAX_TIME: 30,
    REVIVE_HP_PERCENT: 0.5,
    SPAWN_OFFSET: 100,
  },

  // 난이도 스케일링
  DIFFICULTY_SCALING: {
    1: 1.0,
    2: 1.5,
    3: 2.0,
    4: 2.5,
  } as Record<number, number>,

  // 버프 공유
  BUFF_SHARE: {
    KNIGHT_HP_REGEN_RANGE: 150,
    KNIGHT_HP_REGEN_RATIO: 0.5,
    WARRIOR_BERSERKER_RANGE: 200,
    WARRIOR_BERSERKER_ATK_BONUS: 0.2,
  },

  // 어그로 시스템 (싱글플레이와 유사 - 가장 가까운 타겟, 근접 영웅 우선)
  AGGRO: {
    MELEE_HERO_BONUS: 1.5,  // 근접 영웅(전사, 기사) 우선순위 보너스
    CURRENT_TARGET_BONUS: 1.1,  // 현재 타겟 유지 보너스 (작게 설정)
  },

  // 경험치
  EXP: {
    BASE: 50,
    MULTIPLIER: 30,
    DEAD_PLAYER_RATIO: 0.5,
  },

  EXP_TABLE: {
    melee: 10,
    ranged: 15,
    knight: 25,
    mage: 30,
    boss: 200,
  } as Record<string, number>,

  // 직업별 설정
  CLASS_CONFIGS: {
    warrior: { hp: 350, attack: 35, attackSpeed: 1.0, speed: 2.7, range: 80 },
    archer: { hp: 250, attack: 45, attackSpeed: 0.7, speed: 3.3, range: 180 },
    knight: { hp: 450, attack: 30, attackSpeed: 1.3, speed: 2.1, range: 80 },
    mage: { hp: 220, attack: 55, attackSpeed: 1.8, speed: 2.85, range: 190 },
  } as Record<HeroClass, { hp: number; attack: number; attackSpeed: number; speed: number; range: number }>,

  // 직업별 레벨업 보너스 (싱글플레이어와 동일 - CLASS_LEVEL_UP_BONUS 기준)
  LEVEL_UP_BONUS: {
    warrior: { hp: 30, attack: 5, speed: 0.05 },
    archer: { hp: 30, attack: 5, speed: 0.05 },
    knight: { hp: 50, attack: 5, speed: 0.05 },  // 기사는 HP +50 (싱글플레이 CLASS_LEVEL_UP_BONUS와 동일)
    mage: { hp: 30, attack: 5, speed: 0.05 },
  } as Record<HeroClass, { hp: number; attack: number; speed: number }>,

  // 적 AI 설정
  ENEMY_AI: {
    melee: { detectionRange: 400, attackRange: 60, moveSpeed: 2.25, attackDamage: 15, attackSpeed: 1.0, hp: 60 },
    ranged: { detectionRange: 500, attackRange: 150, moveSpeed: 2.4, attackDamage: 20, attackSpeed: 0.8, hp: 40 },
    knight: { detectionRange: 350, attackRange: 70, moveSpeed: 1.95, attackDamage: 12, attackSpeed: 1.2, hp: 150 },
    mage: { detectionRange: 450, attackRange: 180, moveSpeed: 2.1, attackDamage: 35, attackSpeed: 1.5, hp: 35 },
    boss: { detectionRange: 600, attackRange: 100, moveSpeed: 1.5, attackDamage: 50, attackSpeed: 2.0, hp: 800 },
  } as Record<string, { detectionRange: number; attackRange: number; moveSpeed: number; attackDamage: number; attackSpeed: number; hp: number }>,

  // 스킬 설정
  SKILLS: {
    warrior: {
      q: { cooldown: 1.0, damageMultiplier: 1.0, range: 80 },
      w: { cooldown: 6, damageMultiplier: 1.5, distance: 200, invincibleDuration: 2.0 },
      e: { cooldown: 30, duration: 10, attackBonus: 0.5, speedBonus: 0.3, lifesteal: 0.5 },
    },
    archer: {
      q: { cooldown: 0.7, damageMultiplier: 1.0 },
      w: { cooldown: 5, damageMultiplier: 1.5, pierceDistance: 300 },
      e: { cooldown: 25, damageMultiplier: 2.0, radius: 150 },
    },
    knight: {
      q: { cooldown: 1.3, damageMultiplier: 1.0 },
      w: { cooldown: 8, distance: 150, hpDamagePercent: 0.1, stunDuration: 2.0 },
      e: { cooldown: 35, duration: 5, damageReduction: 0.7, healPercent: 0.2 },
    },
    mage: {
      q: { cooldown: 1.8, damageMultiplier: 1.0 },
      w: { cooldown: 7, damageMultiplier: 1.8, radius: 80 },
      e: { cooldown: 40, damageMultiplier: 3.0, radius: 150, delay: 3.0 },
    },
  } as Record<HeroClass, Record<string, any>>,

  // 웨이브 사이 대기 시간
  WAVE_DELAY: 5,
};

// 서버측 영웅 상태
interface ServerHero extends NetworkCoopHero {
  attackCooldown: number;
  baseAttack: number;
  baseSpeed: number;
  baseAttackSpeed: number;
  skillPoints: number;
  targetPosition?: { x: number; y: number };
  dashState?: {
    startX: number;
    startY: number;
    targetX: number;
    targetY: number;
    progress: number;
    duration: number;
    dirX: number;
    dirY: number;
  };
}

// 서버측 적 상태
interface ServerEnemy extends NetworkCoopEnemy {
  attackCooldown: number;
  attackDamage: number;
  attackSpeed: number;
  attackRange: number;
  moveSpeed: number;
  detectionRange: number;
  targetPosition?: { x: number; y: number };
  isStunned: boolean;
  stunDuration: number;
}

// 플레이어 통계
interface PlayerStats {
  kills: number;
  deaths: number;
  damageDealt: number;
  damageTaken: number;
  expGained: number;
}

export class RPGCoopGameRoom {
  public id: string;
  private playerIds: string[];
  private playerInfos: CoopPlayerInfo[];

  private gameState: 'waiting' | 'countdown' | 'playing' | 'ended' = 'waiting';
  private gameTime: number = 0;
  private gameLoopInterval: NodeJS.Timeout | null = null;
  private countdownTimer: NodeJS.Timeout | null = null;

  private heroes: Map<string, ServerHero> = new Map();  // heroId -> ServerHero
  private playerHeroMap: Map<string, string> = new Map();  // playerId -> heroId
  private enemies: ServerEnemy[] = [];

  private currentWave: number = 0;
  private waveInProgress: boolean = false;
  private enemiesRemaining: number = 0;
  private spawnQueue: { type: UnitType; delay: number }[] = [];
  private lastSpawnTime: number = 0;
  private waveDelayTimer: number = 0;

  private activeSkillEffects: SkillEffect[] = [];
  private pendingSkills: PendingSkill[] = [];

  private playerStats: Map<string, PlayerStats> = new Map();

  private lastFullSync: number = 0;

  constructor(id: string, playerIds: string[], playerInfos: CoopPlayerInfo[]) {
    this.id = id;
    this.playerIds = playerIds;
    this.playerInfos = playerInfos;

    // 플레이어 통계 초기화
    playerIds.forEach(id => {
      this.playerStats.set(id, {
        kills: 0,
        deaths: 0,
        damageDealt: 0,
        damageTaken: 0,
        expGained: 0,
      });
    });
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
    this.gameTime = 0;

    // 영웅 생성
    this.initializeHeroes();

    console.log(`[Coop] 게임 시작: Room ${this.id} (${this.playerIds.length}명)`);

    // 초기 상태 전송 (각 플레이어에게 자신의 heroId 포함)
    const initialState = this.getNetworkGameState();
    this.playerIds.forEach(playerId => {
      const heroId = this.playerHeroMap.get(playerId);
      sendToPlayer(playerId, {
        type: 'COOP_GAME_START',
        state: initialState,
        yourHeroId: heroId || '',
      });
    });

    // 게임 루프 시작 (60fps)
    this.gameLoopInterval = setInterval(() => {
      this.update(1 / 60);
    }, 1000 / 60);

    // 첫 웨이브 시작
    this.waveDelayTimer = 3;  // 3초 후 첫 웨이브
  }

  private initializeHeroes(): void {
    const playerCount = this.playerIds.length;
    const spawnPositions = this.getSpawnPositions(playerCount);

    this.playerIds.forEach((playerId, index) => {
      const playerInfo = this.playerInfos[index];
      const heroClass = playerInfo.heroClass;
      const classConfig = CONFIG.CLASS_CONFIGS[heroClass];
      const pos = spawnPositions[index];

      const heroId = uuidv4();
      const hero: ServerHero = {
        id: heroId,
        playerId,
        heroClass,
        x: pos.x,
        y: pos.y,
        hp: classConfig.hp,
        maxHp: classConfig.hp,
        attack: classConfig.attack,
        attackSpeed: classConfig.attackSpeed,
        speed: classConfig.speed,
        range: classConfig.range,
        level: 1,
        exp: 0,
        expToNextLevel: this.calculateExpToNextLevel(1),
        isDead: false,
        reviveTimer: 0,
        facingRight: true,
        facingAngle: 0,
        buffs: [],
        passiveGrowth: { level: 0, currentValue: 0, overflowBonus: 0 },
        skillCooldowns: { Q: 0, W: 0, E: 0 },
        attackCooldown: 0,
        baseAttack: classConfig.attack,
        baseSpeed: classConfig.speed,
        baseAttackSpeed: classConfig.attackSpeed,
        skillPoints: 0,
      };

      this.heroes.set(heroId, hero);
      this.playerHeroMap.set(playerId, heroId);
    });
  }

  private getSpawnPositions(count: number): { x: number; y: number }[] {
    const centerX = CONFIG.MAP_CENTER_X;
    const centerY = CONFIG.MAP_CENTER_Y;
    const offset = 80;

    switch (count) {
      case 2:
        return [
          { x: centerX - offset, y: centerY },
          { x: centerX + offset, y: centerY },
        ];
      case 3:
        return [
          { x: centerX, y: centerY - offset },
          { x: centerX - offset, y: centerY + offset * 0.5 },
          { x: centerX + offset, y: centerY + offset * 0.5 },
        ];
      case 4:
        return [
          { x: centerX - offset, y: centerY - offset },
          { x: centerX + offset, y: centerY - offset },
          { x: centerX - offset, y: centerY + offset },
          { x: centerX + offset, y: centerY + offset },
        ];
      default:
        return [{ x: centerX, y: centerY }];
    }
  }

  private update(deltaTime: number): void {
    if (this.gameState !== 'playing') return;

    this.gameTime += deltaTime;

    // 영웅 업데이트
    this.updateHeroes(deltaTime);

    // 적 업데이트
    this.updateEnemies(deltaTime);

    // 스킬 효과 업데이트
    this.updateSkillEffects(deltaTime);

    // 보류 중인 스킬 처리
    this.updatePendingSkills(deltaTime);

    // 버프 공유 처리
    this.updateBuffSharing(deltaTime);

    // 웨이브 처리
    this.updateWave(deltaTime);

    // 게임 오버 체크
    this.checkGameOver();

    // 50ms마다 전체 상태 동기화
    if (this.gameTime - this.lastFullSync >= 0.05) {
      this.lastFullSync = this.gameTime;
      this.broadcastState();
    }
  }

  private updateHeroes(deltaTime: number): void {
    this.heroes.forEach((hero, heroId) => {
      // 사망 상태 처리
      if (hero.isDead) {
        hero.reviveTimer -= deltaTime;
        if (hero.reviveTimer <= 0) {
          this.reviveHero(heroId);
        }
        return;
      }

      // 쿨다운 감소
      // 광전사 버프 활성화 시 Q스킬 쿨다운 30% 빠르게 감소 (싱글플레이와 동일)
      const berserkerBuff = hero.buffs.find(b => b.type === 'berserker');
      const attackSpeedMultiplier = berserkerBuff?.speedBonus ? (1 + berserkerBuff.speedBonus) : 1;

      hero.attackCooldown = Math.max(0, hero.attackCooldown - deltaTime);
      hero.skillCooldowns.Q = Math.max(0, hero.skillCooldowns.Q - deltaTime * attackSpeedMultiplier);
      hero.skillCooldowns.W = Math.max(0, hero.skillCooldowns.W - deltaTime);
      hero.skillCooldowns.E = Math.max(0, hero.skillCooldowns.E - deltaTime);

      // 버프 업데이트
      this.updateBuffs(hero, deltaTime);

      // 돌진 상태 업데이트
      if (hero.dashState) {
        hero.dashState.progress += deltaTime / hero.dashState.duration;
        if (hero.dashState.progress >= 1) {
          hero.x = hero.dashState.targetX;
          hero.y = hero.dashState.targetY;
          hero.dashState = undefined;
        } else {
          // easeOutQuad
          const t = hero.dashState.progress;
          const eased = t * (2 - t);
          hero.x = hero.dashState.startX + (hero.dashState.targetX - hero.dashState.startX) * eased;
          hero.y = hero.dashState.startY + (hero.dashState.targetY - hero.dashState.startY) * eased;
        }
      } else if (hero.targetPosition) {
        // 일반 이동 (싱글플레이와 동일한 공식: speed * deltaTime * 60)
        const dx = hero.targetPosition.x - hero.x;
        const dy = hero.targetPosition.y - hero.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 5) {
          const baseSpeed = this.getEffectiveSpeed(hero);
          const moveDistance = baseSpeed * deltaTime * 60;  // 싱글플레이 공식
          const moveX = (dx / dist) * moveDistance;
          const moveY = (dy / dist) * moveDistance;
          hero.x += moveX;
          hero.y += moveY;

          // 바라보는 방향 업데이트
          hero.facingRight = dx >= 0;
          hero.facingAngle = Math.atan2(dy, dx);
        } else {
          hero.targetPosition = undefined;
        }
      }

      // 맵 경계 체크
      hero.x = Math.max(0, Math.min(CONFIG.MAP_WIDTH, hero.x));
      hero.y = Math.max(0, Math.min(CONFIG.MAP_HEIGHT, hero.y));

      // 패시브 HP 재생 (기사)
      if (hero.heroClass === 'knight' && hero.passiveGrowth.currentValue > 0) {
        const hpRegen = hero.passiveGrowth.currentValue * deltaTime;
        hero.hp = Math.min(hero.maxHp, hero.hp + hpRegen);
      }
    });
  }

  private updateBuffs(hero: ServerHero, deltaTime: number): void {
    const expiredBuffs: string[] = [];

    hero.buffs.forEach(buff => {
      buff.duration -= deltaTime;
      if (buff.duration <= 0) {
        expiredBuffs.push(buff.type);
      }
    });

    expiredBuffs.forEach(buffType => {
      hero.buffs = hero.buffs.filter(b => b.type !== buffType);
      this.broadcastEvent({ event: 'HERO_BUFF_REMOVED', heroId: hero.id, buffType });
    });
  }

  private updateEnemies(deltaTime: number): void {
    const enemiesToRemove: string[] = [];

    this.enemies.forEach(enemy => {
      // 스턴 상태 처리
      if (enemy.isStunned) {
        enemy.stunDuration -= deltaTime;
        if (enemy.stunDuration <= 0) {
          enemy.isStunned = false;
        }
        return;
      }

      // 쿨다운 감소
      enemy.attackCooldown = Math.max(0, enemy.attackCooldown - deltaTime);

      // 타겟 영웅 선택 (어그로 시스템)
      const targetHero = this.selectEnemyTarget(enemy);

      if (targetHero) {
        enemy.targetHeroId = targetHero.id;
        const dx = targetHero.x - enemy.x;
        const dy = targetHero.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= enemy.attackRange) {
          // 공격
          if (enemy.attackCooldown <= 0) {
            this.damageHero(targetHero.id, enemy.attackDamage, enemy.id);
            enemy.attackCooldown = enemy.attackSpeed;
          }
        } else {
          // 이동 (싱글플레이와 동일 - 웨이브 스케일링 없음)
          enemy.x += (dx / dist) * enemy.moveSpeed;
          enemy.y += (dy / dist) * enemy.moveSpeed;
        }
      } else {
        enemy.targetHeroId = undefined;
      }

      // 사망 체크
      if (enemy.hp <= 0) {
        enemiesToRemove.push(enemy.id);
      }
    });

    // 죽은 적 처리
    enemiesToRemove.forEach(enemyId => {
      const enemy = this.enemies.find(e => e.id === enemyId);
      if (enemy) {
        this.distributeExp(enemy.expReward);
        this.broadcastEvent({
          event: 'ENEMY_DIED',
          enemyId,
          expReward: enemy.expReward,
          killerHeroId: '',  // TODO: 마지막 타격자 추적
        });
        this.enemies = this.enemies.filter(e => e.id !== enemyId);
        this.enemiesRemaining--;
      }
    });
  }

  private selectEnemyTarget(enemy: ServerEnemy): ServerHero | null {
    const aliveHeroes = Array.from(this.heroes.values()).filter(h => !h.isDead);
    if (aliveHeroes.length === 0) return null;

    let bestTarget: ServerHero | null = null;
    let bestScore = -Infinity;

    aliveHeroes.forEach(hero => {
      const dist = this.getDistance(enemy.x, enemy.y, hero.x, hero.y);
      if (dist > enemy.detectionRange) return;

      // 기본 점수 = 거리 기반 (가까울수록 높음)
      // 싱글플레이와 동일하게 가장 가까운 영웅을 우선 타겟
      let score = 1000 - dist;

      // 근접 영웅 우선순위 (전사, 기사)
      // 적이 원거리 영웅보다 근접 영웅을 더 선호
      const isMeleeHero = hero.heroClass === 'warrior' || hero.heroClass === 'knight';
      if (isMeleeHero) {
        score *= CONFIG.AGGRO.MELEE_HERO_BONUS;
      }

      // 현재 타겟 유지 보너스 (약간만 - 타겟 변경이 너무 잦지 않도록)
      if (enemy.targetHeroId === hero.id) {
        score *= CONFIG.AGGRO.CURRENT_TARGET_BONUS;
      }

      if (score > bestScore) {
        bestScore = score;
        bestTarget = hero;
      }
    });

    return bestTarget;
  }

  private updateSkillEffects(deltaTime: number): void {
    const expiredEffects: string[] = [];

    this.activeSkillEffects.forEach(effect => {
      effect.duration -= deltaTime;
      if (effect.duration <= 0) {
        expiredEffects.push(`${effect.type}_${effect.startTime}`);
      }
    });

    this.activeSkillEffects = this.activeSkillEffects.filter(
      e => e.duration > 0
    );
  }

  private updatePendingSkills(deltaTime: number): void {
    const triggeredSkills: PendingSkill[] = [];

    this.pendingSkills.forEach(skill => {
      if (this.gameTime >= skill.triggerTime) {
        triggeredSkills.push(skill);
      }
    });

    triggeredSkills.forEach(skill => {
      // 스킬 발동 (범위 내 적에게 데미지)
      this.enemies.forEach(enemy => {
        const dist = this.getDistance(skill.position.x, skill.position.y, enemy.x, enemy.y);
        if (dist <= skill.radius) {
          this.damageEnemy(enemy.id, skill.damage, '');
        }
      });

      // 스킬 효과 추가
      const effect: SkillEffect = {
        type: skill.type,
        position: skill.position,
        radius: skill.radius,
        damage: skill.damage,
        duration: 0.5,
        startTime: this.gameTime,
      };
      this.activeSkillEffects.push(effect);
      this.broadcastEvent({ event: 'SKILL_EFFECT_STARTED', effect });
    });

    this.pendingSkills = this.pendingSkills.filter(
      s => this.gameTime < s.triggerTime
    );
  }

  private updateBuffSharing(deltaTime: number): void {
    const aliveHeroes = Array.from(this.heroes.values()).filter(h => !h.isDead);

    // 기사 HP 재생 공유
    aliveHeroes.forEach(knight => {
      if (knight.heroClass !== 'knight') return;
      if (knight.passiveGrowth.currentValue <= 0) return;

      const shareAmount = knight.passiveGrowth.currentValue * CONFIG.BUFF_SHARE.KNIGHT_HP_REGEN_RATIO * deltaTime;

      aliveHeroes.forEach(ally => {
        if (ally.id === knight.id) return;

        const dist = this.getDistance(knight.x, knight.y, ally.x, ally.y);
        if (dist <= CONFIG.BUFF_SHARE.KNIGHT_HP_REGEN_RANGE) {
          ally.hp = Math.min(ally.maxHp, ally.hp + shareAmount);
        }
      });
    });

    // 전사 광전사 버프 공유
    aliveHeroes.forEach(warrior => {
      if (warrior.heroClass !== 'warrior') return;
      const berserkerBuff = warrior.buffs.find(b => b.type === 'berserker');
      if (!berserkerBuff) return;

      aliveHeroes.forEach(ally => {
        if (ally.id === warrior.id) return;

        const dist = this.getDistance(warrior.x, warrior.y, ally.x, ally.y);
        if (dist <= CONFIG.BUFF_SHARE.WARRIOR_BERSERKER_RANGE) {
          // 범위 내 아군에게 공격력 버프
          // 이미 버프가 있으면 갱신
          const existingBuff = ally.buffs.find(b => b.type === 'berserker');
          if (!existingBuff) {
            ally.buffs.push({
              type: 'berserker',
              duration: 0.1,  // 매 프레임 갱신
              startTime: this.gameTime,
              attackBonus: CONFIG.BUFF_SHARE.WARRIOR_BERSERKER_ATK_BONUS,
            });
          } else {
            existingBuff.duration = 0.1;
          }
        }
      });
    });
  }

  private updateWave(deltaTime: number): void {
    // 웨이브 대기 타이머
    if (this.waveDelayTimer > 0) {
      this.waveDelayTimer -= deltaTime;
      if (this.waveDelayTimer <= 0) {
        this.startNextWave();
      }
      return;
    }

    // 스폰 큐 처리
    if (this.spawnQueue.length > 0 && this.gameTime - this.lastSpawnTime >= this.spawnQueue[0].delay) {
      const spawn = this.spawnQueue.shift()!;
      this.spawnEnemy(spawn.type);
      this.lastSpawnTime = this.gameTime;
    }

    // 웨이브 클리어 체크
    if (this.waveInProgress && this.enemiesRemaining === 0 && this.spawnQueue.length === 0) {
      this.waveInProgress = false;
      this.broadcast({
        type: 'COOP_WAVE_CLEAR',
        waveNumber: this.currentWave,
        nextWaveIn: CONFIG.WAVE_DELAY,
      });
      this.waveDelayTimer = CONFIG.WAVE_DELAY;

      // 패시브 성장 (10웨이브마다)
      if (this.currentWave % 10 === 0) {
        this.updatePassiveGrowth();
      }
    }
  }

  private startNextWave(): void {
    this.currentWave++;
    this.waveInProgress = true;

    const waveConfig = this.generateWaveConfig(this.currentWave);
    this.enemiesRemaining = waveConfig.enemies.reduce((sum, e) => sum + e.count, 0);

    // 스폰 큐 생성
    this.spawnQueue = [];
    waveConfig.enemies.forEach(enemyConfig => {
      for (let i = 0; i < enemyConfig.count; i++) {
        this.spawnQueue.push({
          type: enemyConfig.type,
          delay: waveConfig.spawnInterval,
        });
      }
    });
    this.lastSpawnTime = this.gameTime - waveConfig.spawnInterval;  // 즉시 첫 스폰

    this.broadcast({
      type: 'COOP_WAVE_START',
      waveNumber: this.currentWave,
      enemyCount: this.enemiesRemaining,
    });

    console.log(`[Coop] 웨이브 ${this.currentWave} 시작 (적 ${this.enemiesRemaining}마리)`);
  }

  private generateWaveConfig(waveNumber: number): { enemies: { type: UnitType; count: number }[]; spawnInterval: number } {
    const isBossWave = waveNumber % 10 === 0;
    const enemies: { type: UnitType; count: number }[] = [];

    if (isBossWave) {
      enemies.push({ type: 'boss', count: 1 });
      enemies.push({ type: 'melee', count: Math.floor(waveNumber / 2) });
    } else if (waveNumber <= 3) {
      enemies.push({ type: 'melee', count: 3 + waveNumber * 2 });
    } else if (waveNumber <= 6) {
      enemies.push({ type: 'melee', count: 3 + waveNumber });
      enemies.push({ type: 'ranged', count: Math.floor(waveNumber / 2) });
    } else if (waveNumber <= 9) {
      enemies.push({ type: 'melee', count: 2 + waveNumber });
      enemies.push({ type: 'ranged', count: Math.floor(waveNumber / 2) });
      enemies.push({ type: 'knight', count: Math.floor(waveNumber / 3) });
    } else {
      const cycleWave = ((waveNumber - 1) % 10) + 1;
      const multiplier = Math.floor(waveNumber / 10) + 1;

      if (cycleWave <= 3) {
        enemies.push({ type: 'melee', count: (3 + cycleWave * 2) * multiplier });
      } else if (cycleWave <= 6) {
        enemies.push({ type: 'melee', count: (3 + cycleWave) * multiplier });
        enemies.push({ type: 'ranged', count: Math.floor(cycleWave / 2) * multiplier });
      } else {
        enemies.push({ type: 'melee', count: (2 + cycleWave) * multiplier });
        enemies.push({ type: 'ranged', count: Math.floor(cycleWave / 2) * multiplier });
        enemies.push({ type: 'knight', count: Math.floor(cycleWave / 3) * multiplier });
        if (waveNumber >= 20) {
          enemies.push({ type: 'mage', count: Math.floor(multiplier / 2) });
        }
      }
    }

    const spawnInterval = Math.max(0.5, 2 - waveNumber * 0.1);

    return { enemies, spawnInterval };
  }

  private spawnEnemy(type: UnitType): void {
    const pos = this.getRandomSpawnPosition();
    const aiConfig = CONFIG.ENEMY_AI[type] || CONFIG.ENEMY_AI.melee;

    // 난이도 스케일링 (플레이어 수에 따른 체력 배율)
    const playerCount = this.playerIds.length;
    const hpMultiplier = CONFIG.DIFFICULTY_SCALING[playerCount] || 1.0;

    // 웨이브별 스탯 배율
    const waveStatMultiplier = 1 + Math.floor(this.currentWave / 10) * 0.3;

    const enemy: ServerEnemy = {
      id: uuidv4(),
      type,
      x: pos.x,
      y: pos.y,
      hp: Math.floor(aiConfig.hp * hpMultiplier * waveStatMultiplier),
      maxHp: Math.floor(aiConfig.hp * hpMultiplier * waveStatMultiplier),
      expReward: CONFIG.EXP_TABLE[type] || 10,
      buffs: [],
      attackCooldown: 0,
      attackDamage: Math.floor(aiConfig.attackDamage * waveStatMultiplier),
      attackSpeed: aiConfig.attackSpeed,  // 싱글플레이와 동일 - 공격속도 스케일링 없음
      attackRange: aiConfig.attackRange,
      moveSpeed: aiConfig.moveSpeed,
      detectionRange: aiConfig.detectionRange,
      isStunned: false,
      stunDuration: 0,
    };

    this.enemies.push(enemy);
    this.broadcastEvent({
      event: 'ENEMY_SPAWNED',
      enemy: this.getNetworkEnemy(enemy),
    });
  }

  private getRandomSpawnPosition(): { x: number; y: number } {
    const margin = CONFIG.SPAWN_MARGIN;
    const side = Math.floor(Math.random() * 4);

    switch (side) {
      case 0:  // 상
        return { x: margin + Math.random() * (CONFIG.MAP_WIDTH - margin * 2), y: margin };
      case 1:  // 하
        return { x: margin + Math.random() * (CONFIG.MAP_WIDTH - margin * 2), y: CONFIG.MAP_HEIGHT - margin };
      case 2:  // 좌
        return { x: margin, y: margin + Math.random() * (CONFIG.MAP_HEIGHT - margin * 2) };
      case 3:  // 우
      default:
        return { x: CONFIG.MAP_WIDTH - margin, y: margin + Math.random() * (CONFIG.MAP_HEIGHT - margin * 2) };
    }
  }

  private distributeExp(expReward: number): void {
    const aliveHeroes = Array.from(this.heroes.values()).filter(h => !h.isDead);
    const deadHeroes = Array.from(this.heroes.values()).filter(h => h.isDead);

    // 경험치 공유: 싱글플레이와 동일하게 모든 플레이어가 동일한 경험치 획득 (분배 X)
    const expForAlive = expReward;  // 살아있는 플레이어는 전체 경험치 획득
    const expForDead = Math.floor(expReward * CONFIG.EXP.DEAD_PLAYER_RATIO);  // 죽은 플레이어는 50%

    // 살아있는 플레이어 (전체 경험치)
    aliveHeroes.forEach(hero => {
      this.addExp(hero.id, expForAlive);
    });

    // 죽은 플레이어 (50%)
    deadHeroes.forEach(hero => {
      this.addExp(hero.id, expForDead);
    });
  }

  private addExp(heroId: string, amount: number): void {
    const hero = this.heroes.get(heroId);
    if (!hero) return;

    hero.exp += amount;

    // 플레이어 통계 업데이트
    const stats = this.playerStats.get(hero.playerId);
    if (stats) {
      stats.expGained += amount;
    }

    this.broadcastEvent({
      event: 'HERO_EXP_GAINED',
      heroId,
      exp: amount,
      totalExp: hero.exp,
    });

    // 레벨업 체크
    while (hero.exp >= hero.expToNextLevel) {
      hero.exp -= hero.expToNextLevel;
      hero.level++;
      hero.skillPoints++;

      const bonus = CONFIG.LEVEL_UP_BONUS[hero.heroClass];
      hero.maxHp += bonus.hp;
      hero.hp = hero.maxHp;  // 레벨업 시 풀힐
      hero.baseAttack += bonus.attack;
      hero.attack = hero.baseAttack;
      hero.baseSpeed += bonus.speed;
      hero.speed = hero.baseSpeed;
      hero.expToNextLevel = this.calculateExpToNextLevel(hero.level);

      this.broadcastEvent({
        event: 'HERO_LEVEL_UP',
        heroId,
        level: hero.level,
        stats: { hp: hero.maxHp, attack: hero.attack, speed: hero.speed },
      });
    }
  }

  private calculateExpToNextLevel(level: number): number {
    return CONFIG.EXP.BASE + (level * CONFIG.EXP.MULTIPLIER);
  }

  private updatePassiveGrowth(): void {
    this.heroes.forEach(hero => {
      hero.passiveGrowth.level++;
      const level = hero.passiveGrowth.level;

      switch (hero.heroClass) {
        case 'warrior':
          // 피해흡혈 +0.5%/레벨, 최대 50%
          hero.passiveGrowth.currentValue = Math.min(0.5, level * 0.005);
          break;
        case 'archer':
          // 다중타겟 확률 +0.5%/레벨, 최대 100%
          hero.passiveGrowth.currentValue = Math.min(1.0, level * 0.005);
          break;
        case 'knight':
          // HP 재생 +5/초/레벨, 최대 200/초
          hero.passiveGrowth.currentValue = Math.min(200, level * 5);
          break;
        case 'mage':
          // 데미지 보너스 +1%/레벨, 최대 100%
          hero.passiveGrowth.currentValue = Math.min(1.0, level * 0.01);
          break;
      }
    });
  }

  private damageHero(heroId: string, damage: number, attackerId: string): void {
    const hero = this.heroes.get(heroId);
    if (!hero || hero.isDead) return;

    // 무적 버프 체크
    const invincibleBuff = hero.buffs.find(b => b.type === 'invincible');
    if (invincibleBuff) return;

    // 철벽 버프 데미지 감소
    const ironwallBuff = hero.buffs.find(b => b.type === 'ironwall');
    if (ironwallBuff && ironwallBuff.damageReduction) {
      damage = Math.floor(damage * (1 - ironwallBuff.damageReduction));
    }

    hero.hp = Math.max(0, hero.hp - damage);

    // 플레이어 통계 업데이트
    const stats = this.playerStats.get(hero.playerId);
    if (stats) {
      stats.damageTaken += damage;
    }

    this.broadcastEvent({
      event: 'HERO_DAMAGED',
      heroId,
      damage,
      hp: hero.hp,
      attackerId,
    });

    // 사망 체크
    if (hero.hp <= 0) {
      this.killHero(heroId);
    }
  }

  private killHero(heroId: string): void {
    const hero = this.heroes.get(heroId);
    if (!hero) return;

    hero.isDead = true;
    hero.reviveTimer = Math.min(
      CONFIG.REVIVE.MAX_TIME,
      CONFIG.REVIVE.BASE_TIME + this.currentWave * CONFIG.REVIVE.TIME_PER_WAVE
    );

    // 플레이어 통계 업데이트
    const stats = this.playerStats.get(hero.playerId);
    if (stats) {
      stats.deaths++;
    }

    this.broadcastEvent({
      event: 'HERO_DIED',
      heroId,
      reviveTime: hero.reviveTimer,
    });
  }

  private reviveHero(heroId: string): void {
    const hero = this.heroes.get(heroId);
    if (!hero) return;

    // 살아있는 아군 근처에 부활
    const aliveAllies = Array.from(this.heroes.values()).filter(h => !h.isDead);
    let spawnX = CONFIG.MAP_CENTER_X;
    let spawnY = CONFIG.MAP_CENTER_Y;

    if (aliveAllies.length > 0) {
      const ally = aliveAllies[Math.floor(Math.random() * aliveAllies.length)];
      const angle = Math.random() * Math.PI * 2;
      const offset = CONFIG.REVIVE.SPAWN_OFFSET;
      spawnX = ally.x + Math.cos(angle) * offset;
      spawnY = ally.y + Math.sin(angle) * offset;

      // 맵 경계 체크
      spawnX = Math.max(50, Math.min(CONFIG.MAP_WIDTH - 50, spawnX));
      spawnY = Math.max(50, Math.min(CONFIG.MAP_HEIGHT - 50, spawnY));
    }

    hero.isDead = false;
    hero.hp = Math.floor(hero.maxHp * CONFIG.REVIVE.REVIVE_HP_PERCENT);
    hero.x = spawnX;
    hero.y = spawnY;
    hero.reviveTimer = 0;

    this.broadcastEvent({
      event: 'HERO_REVIVED',
      heroId,
      x: spawnX,
      y: spawnY,
      hp: hero.hp,
    });
  }

  private damageEnemy(enemyId: string, damage: number, attackerId: string): void {
    const enemy = this.enemies.find(e => e.id === enemyId);
    if (!enemy) return;

    enemy.hp = Math.max(0, enemy.hp - damage);

    // 플레이어 통계 업데이트
    if (attackerId) {
      const hero = this.heroes.get(attackerId);
      if (hero) {
        const stats = this.playerStats.get(hero.playerId);
        if (stats) {
          stats.damageDealt += damage;
          if (enemy.hp <= 0) {
            stats.kills++;
          }
        }
      }
    }

    this.broadcastEvent({
      event: 'ENEMY_DAMAGED',
      enemyId,
      damage,
      hp: enemy.hp,
      attackerId,
    });
  }

  private stunEnemy(enemyId: string, duration: number): void {
    const enemy = this.enemies.find(e => e.id === enemyId);
    if (!enemy) return;

    enemy.isStunned = true;
    enemy.stunDuration = duration;

    this.broadcastEvent({
      event: 'ENEMY_STUNNED',
      enemyId,
      duration,
    });
  }

  private checkGameOver(): void {
    const allDead = Array.from(this.heroes.values()).every(h => h.isDead);
    if (allDead) {
      this.endGame(false);
    }
  }

  private endGame(victory: boolean): void {
    this.gameState = 'ended';

    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
    }

    const result: RPGCoopGameResult = {
      victory,
      waveReached: this.currentWave,
      totalGameTime: this.gameTime,
      playerResults: this.playerIds.map(playerId => {
        const heroId = this.playerHeroMap.get(playerId);
        const hero = heroId ? this.heroes.get(heroId) : null;
        const stats = this.playerStats.get(playerId);
        const info = this.playerInfos.find(p => p.id === playerId);

        return {
          playerId,
          playerName: info?.name || 'Unknown',
          heroClass: hero?.heroClass || 'warrior',
          level: hero?.level || 1,
          kills: stats?.kills || 0,
          deaths: stats?.deaths || 0,
          damageDealt: stats?.damageDealt || 0,
          damageTaken: stats?.damageTaken || 0,
          expGained: stats?.expGained || 0,
        };
      }),
    };

    this.broadcast({ type: 'COOP_GAME_OVER', result });

    console.log(`[Coop] 게임 종료: Room ${this.id}, 웨이브 ${this.currentWave}, ${victory ? '승리' : '패배'}`);

    // 방 정리
    removeCoopRoom(this.id);
    this.playerIds.forEach(playerId => {
      const player = players.get(playerId);
      if (player) {
        player.roomId = null;
      }
    });
  }

  // 플레이어 입력 처리
  public handleHeroMove(playerId: string, targetX: number, targetY: number): void {
    const heroId = this.playerHeroMap.get(playerId);
    if (!heroId) return;

    const hero = this.heroes.get(heroId);
    if (!hero || hero.isDead) return;

    hero.targetPosition = { x: targetX, y: targetY };

    this.broadcastEvent({
      event: 'HERO_MOVED',
      heroId,
      x: targetX,
      y: targetY,
    });
  }

  public handleUseSkill(playerId: string, skillType: SkillType, targetX: number, targetY: number): void {
    const heroId = this.playerHeroMap.get(playerId);
    if (!heroId) return;

    const hero = this.heroes.get(heroId);
    if (!hero || hero.isDead) return;

    // 스킬 슬롯 확인
    let skillSlot: 'Q' | 'W' | 'E' | null = null;
    if (skillType.includes('_q') || skillType === 'warrior_strike' || skillType === 'archer_shot' ||
        skillType === 'knight_bash' || skillType === 'mage_bolt') {
      skillSlot = 'Q';
    } else if (skillType.includes('_w') || skillType === 'warrior_charge' || skillType === 'archer_pierce' ||
               skillType === 'knight_charge' || skillType === 'mage_fireball') {
      skillSlot = 'W';
    } else if (skillType.includes('_e') || skillType === 'warrior_berserker' || skillType === 'archer_rain' ||
               skillType === 'knight_ironwall' || skillType === 'mage_meteor') {
      skillSlot = 'E';
    }

    if (!skillSlot) return;

    // 쿨다운 체크
    if (hero.skillCooldowns[skillSlot] > 0) return;

    const classSkills = CONFIG.SKILLS[hero.heroClass];
    const slotKey = skillSlot.toLowerCase() as 'q' | 'w' | 'e';
    const skillConfig = classSkills[slotKey];
    if (!skillConfig) return;

    // 쿨다운 적용
    hero.skillCooldowns[skillSlot] = skillConfig.cooldown;

    // 바라보는 방향 업데이트
    const dx = targetX - hero.x;
    const dy = targetY - hero.y;
    hero.facingRight = dx >= 0;
    hero.facingAngle = Math.atan2(dy, dx);

    // 스킬별 처리
    this.executeSkill(hero, skillSlot, targetX, targetY, skillConfig);

    this.broadcastEvent({
      event: 'SKILL_USED',
      heroId,
      skillType,
      x: targetX,
      y: targetY,
      direction: { x: dx, y: dy },
    });
  }

  private executeSkill(hero: ServerHero, slot: 'Q' | 'W' | 'E', targetX: number, targetY: number, config: any): void {
    const dx = targetX - hero.x;
    const dy = targetY - hero.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const dirX = dist > 0 ? dx / dist : 1;
    const dirY = dist > 0 ? dy / dist : 0;

    // 마법사 패시브 데미지 보너스 (기본 25% + 패시브 성장)
    // 싱글플레이와 동일: baseDamageBonus(0.25) + growthDamageBonus
    const baseMageDamageBonus = 0.25;  // 기본 패시브 25%
    const damageBonus = hero.heroClass === 'mage' ? baseMageDamageBonus + hero.passiveGrowth.currentValue : 0;

    // 스킬 이펙트 생성 (싱글플레이와 동일한 시각 효과)
    const skillType = `${hero.heroClass}_${slot.toLowerCase()}` as SkillType;
    this.createSkillEffect(hero, skillType, targetX, targetY, dirX, dirY, config);

    switch (hero.heroClass) {
      case 'warrior':
        this.executeWarriorSkill(hero, slot, targetX, targetY, dirX, dirY, config, damageBonus);
        break;
      case 'archer':
        this.executeArcherSkill(hero, slot, targetX, targetY, dirX, dirY, config, damageBonus);
        break;
      case 'knight':
        this.executeKnightSkill(hero, slot, targetX, targetY, dirX, dirY, config, damageBonus);
        break;
      case 'mage':
        this.executeMageSkill(hero, slot, targetX, targetY, dirX, dirY, config, damageBonus);
        break;
    }
  }

  // 스킬 시각 이펙트 생성
  private createSkillEffect(
    hero: ServerHero,
    skillType: SkillType,
    targetX: number,
    targetY: number,
    dirX: number,
    dirY: number,
    config: any
  ): void {
    // E 스킬 중 mage_e(메테오)는 pendingSkills로 처리되므로 제외
    if (skillType === 'mage_e') return;

    const effect: SkillEffect = {
      type: skillType,
      position: { x: hero.x, y: hero.y },
      targetPosition: { x: targetX, y: targetY },
      direction: { x: dirX, y: dirY },
      radius: config.radius || hero.range || 80,
      duration: 0.4,  // 이펙트 지속 시간
      startTime: this.gameTime,
      heroClass: hero.heroClass,
    };

    // W 스킬 (돌진류)은 더 긴 duration
    if (skillType.endsWith('_w')) {
      effect.duration = 0.5;
    }

    // 범위 스킬은 목표 위치에 이펙트
    if (skillType === 'archer_e' || skillType === 'mage_w') {
      effect.position = { x: targetX, y: targetY };
    }

    this.activeSkillEffects.push(effect);
  }

  private executeWarriorSkill(hero: ServerHero, slot: 'Q' | 'W' | 'E', targetX: number, targetY: number,
                               dirX: number, dirY: number, config: any, damageBonus: number): void {
    let baseDamage = hero.attack * (1 + damageBonus);

    // 광전사 버프 공격력 보너스 적용 (싱글플레이와 동일)
    const berserkerBuff = hero.buffs.find(b => b.type === 'berserker');
    if (berserkerBuff && berserkerBuff.attackBonus) {
      baseDamage = Math.floor(baseDamage * (1 + berserkerBuff.attackBonus));
    }

    switch (slot) {
      case 'Q':
        // 강타 - 범위 내 적 공격 (바라보는 방향만, 전방 110도)
        this.damageEnemiesInRange(hero.id, hero.x, hero.y, hero.range, baseDamage * config.damageMultiplier, dirX, dirY, true);
        break;

      case 'W':
        // 돌진 - 전방 돌진 + 무적
        const dashDistance = config.distance || 200;
        hero.dashState = {
          startX: hero.x,
          startY: hero.y,
          targetX: hero.x + dirX * dashDistance,
          targetY: hero.y + dirY * dashDistance,
          progress: 0,
          duration: 0.25,  // 싱글플레이와 동일 (0.25초)
          dirX,
          dirY,
        };

        // 무적 버프
        hero.buffs.push({
          type: 'invincible',
          duration: config.invincibleDuration || 2,
          startTime: this.gameTime,
        });
        this.broadcastEvent({ event: 'HERO_BUFF_APPLIED', heroId: hero.id, buff: hero.buffs[hero.buffs.length - 1] });

        // 경로상 적에게 데미지
        this.damageEnemiesInLine(hero.id, hero.x, hero.y, hero.dashState.targetX, hero.dashState.targetY,
                                  60, baseDamage * config.damageMultiplier);
        break;

      case 'E':
        // 광전사 - 버프 적용
        hero.buffs.push({
          type: 'berserker',
          duration: config.duration || 10,
          startTime: this.gameTime,
          attackBonus: config.attackBonus || 0.5,
          speedBonus: config.speedBonus || 0.3,
          lifesteal: config.lifesteal || 0.5,
        });
        this.broadcastEvent({ event: 'HERO_BUFF_APPLIED', heroId: hero.id, buff: hero.buffs[hero.buffs.length - 1] });
        break;
    }
  }

  private executeArcherSkill(hero: ServerHero, slot: 'Q' | 'W' | 'E', targetX: number, targetY: number,
                              dirX: number, dirY: number, config: any, damageBonus: number): void {
    const baseDamage = hero.attack * (1 + damageBonus);

    switch (slot) {
      case 'Q':
        // 속사 - 단일/다중 대상 공격 (전방 90도 방향 체크)
        const multiTargetChance = hero.passiveGrowth.currentValue;
        const isMultiTarget = Math.random() < multiTargetChance;
        const archerAngleThreshold = 0.0;  // 90도 (싱글플레이와 동일)

        if (isMultiTarget) {
          // 다중 대상 (최대 3명, 방향 체크 포함)
          const nearEnemies = this.findNearestEnemies(hero.x, hero.y, hero.range, 3, dirX, dirY, archerAngleThreshold);
          nearEnemies.forEach(enemy => {
            this.damageEnemy(enemy.id, baseDamage * config.damageMultiplier, hero.id);
          });
        } else {
          // 단일 대상 (방향 체크 포함)
          const nearest = this.findNearestEnemy(hero.x, hero.y, hero.range, dirX, dirY, archerAngleThreshold);
          if (nearest) {
            this.damageEnemy(nearest.id, baseDamage * config.damageMultiplier, hero.id);
          }
        }
        break;

      case 'W':
        // 관통 화살 - 직선 관통
        const pierceDistance = config.pierceDistance || 300;
        this.damageEnemiesInLine(hero.id, hero.x, hero.y,
                                  hero.x + dirX * pierceDistance, hero.y + dirY * pierceDistance,
                                  30, baseDamage * config.damageMultiplier);
        break;

      case 'E':
        // 화살 비 - 범위 공격
        const radius = config.radius || 150;
        this.damageEnemiesInRange(hero.id, targetX, targetY, radius, baseDamage * config.damageMultiplier);
        break;
    }
  }

  private executeKnightSkill(hero: ServerHero, slot: 'Q' | 'W' | 'E', targetX: number, targetY: number,
                              dirX: number, dirY: number, config: any, damageBonus: number): void {
    const baseDamage = hero.attack * (1 + damageBonus);

    switch (slot) {
      case 'Q':
        // 방패 타격 - 근접 공격 (바라보는 방향만, 전방 110도)
        const hitCount = this.damageEnemiesInRange(hero.id, hero.x, hero.y, hero.range, baseDamage * config.damageMultiplier, dirX, dirY, true);
        // W 스킬 쿨타임 감소: 적중한 적 수 × 1초 (싱글플레이와 동일)
        if (hitCount > 0) {
          const cooldownReduction = 1.0 * hitCount;
          hero.skillCooldowns.W = Math.max(0, hero.skillCooldowns.W - cooldownReduction);
        }
        break;

      case 'W':
        // 방패 돌진 - 전방 돌진 + 기절
        const dashDistance = config.distance || 150;
        hero.dashState = {
          startX: hero.x,
          startY: hero.y,
          targetX: hero.x + dirX * dashDistance,
          targetY: hero.y + dirY * dashDistance,
          progress: 0,
          duration: 0.25,
          dirX,
          dirY,
        };

        // 경로상 적에게 HP 기반 데미지 + 기절
        const hpDamage = hero.maxHp * (config.hpDamagePercent || 0.1);
        const enemiesInPath = this.getEnemiesInLine(hero.x, hero.y, hero.dashState.targetX, hero.dashState.targetY, 70);
        enemiesInPath.forEach(enemy => {
          this.damageEnemy(enemy.id, hpDamage, hero.id);
          this.stunEnemy(enemy.id, config.stunDuration || 2);
        });
        break;

      case 'E':
        // 철벽 방어 - 데미지 감소 + 힐
        hero.buffs.push({
          type: 'ironwall',
          duration: config.duration || 5,
          startTime: this.gameTime,
          damageReduction: config.damageReduction || 0.7,
        });
        this.broadcastEvent({ event: 'HERO_BUFF_APPLIED', heroId: hero.id, buff: hero.buffs[hero.buffs.length - 1] });

        // HP 회복
        const healAmount = Math.floor(hero.maxHp * (config.healPercent || 0.2));
        hero.hp = Math.min(hero.maxHp, hero.hp + healAmount);
        this.broadcastEvent({ event: 'HERO_HEALED', heroId: hero.id, heal: healAmount, hp: hero.hp });
        break;
    }
  }

  private executeMageSkill(hero: ServerHero, slot: 'Q' | 'W' | 'E', targetX: number, targetY: number,
                            dirX: number, dirY: number, config: any, damageBonus: number): void {
    const baseDamage = hero.attack * (1 + damageBonus);

    switch (slot) {
      case 'Q':
        // 마법 화살 - 범위 공격 (전방 90도, 싱글플레이와 동일)
        // 마법사는 원거리 범위 공격으로 사거리 내 모든 적 타격
        const mageAngleThreshold = 0.0;  // 90도 (원거리 직업)
        this.damageEnemiesInRange(hero.id, hero.x, hero.y, hero.range, baseDamage * config.damageMultiplier, dirX, dirY, true, mageAngleThreshold);
        break;

      case 'W':
        // 화염구 - 범위 공격
        const radius = config.radius || 80;
        this.damageEnemiesInRange(hero.id, targetX, targetY, radius, baseDamage * config.damageMultiplier);
        break;

      case 'E':
        // 운석 낙하 - 지연 범위 공격
        const delay = config.delay || 3;
        const meteorRadius = config.radius || 150;
        const meteorDamage = baseDamage * config.damageMultiplier;

        this.pendingSkills.push({
          type: 'mage_meteor',
          position: { x: targetX, y: targetY },
          triggerTime: this.gameTime + delay,
          damage: meteorDamage,
          radius: meteorRadius,
        });
        break;
    }
  }

  private damageEnemiesInRange(
    attackerId: string,
    x: number,
    y: number,
    radius: number,
    damage: number,
    dirX?: number,
    dirY?: number,
    checkDirection: boolean = false,
    angleThresholdOverride?: number  // 각도 임계값 직접 지정 (마법사용)
  ): number {  // 적중 수 반환
    const hero = this.heroes.get(attackerId);
    let hitCount = 0;

    // 방향 체크 임계값 (싱글플레이와 동일)
    // 근거리(전사, 기사): -0.3 (약 110도)
    // 원거리(마법사): 0.0 (90도)
    let attackAngleThreshold: number;
    if (angleThresholdOverride !== undefined) {
      attackAngleThreshold = angleThresholdOverride;
    } else {
      const isMelee = hero && (hero.heroClass === 'warrior' || hero.heroClass === 'knight');
      attackAngleThreshold = isMelee ? -0.3 : 0.0;
    }

    this.enemies.forEach(enemy => {
      const dist = this.getDistance(x, y, enemy.x, enemy.y);
      if (dist <= radius) {
        // 방향 체크가 활성화된 경우, 바라보는 방향 검증
        if (checkDirection && dirX !== undefined && dirY !== undefined && dist > 0) {
          const enemyDx = enemy.x - x;
          const enemyDy = enemy.y - y;
          const enemyDist = Math.sqrt(enemyDx * enemyDx + enemyDy * enemyDy);
          if (enemyDist > 0) {
            const enemyDirX = enemyDx / enemyDist;
            const enemyDirY = enemyDy / enemyDist;
            const dot = dirX * enemyDirX + dirY * enemyDirY;

            // 바라보는 방향 범위 밖이면 스킵
            if (dot < attackAngleThreshold) return;
          }
        }

        let finalDamage = damage;

        // 전사 피해흡혈 (싱글플레이와 동일한 곱연산 공식)
        // 공식: (1 + 기본패시브 + 패시브성장) * (1 + 버프) - 1
        if (hero && hero.heroClass === 'warrior') {
          const baseLifesteal = 0.15;  // 기본 패시브 15%
          const growthLifesteal = hero.passiveGrowth.currentValue;
          const passiveTotal = baseLifesteal + growthLifesteal;

          const berserkerBuff = hero.buffs.find(b => b.type === 'berserker');
          const buffLifesteal = berserkerBuff?.lifesteal || 0;

          // 곱연산: (1 + 패시브) * (1 + 버프) - 1
          const totalLifesteal = (1 + passiveTotal) * (1 + buffLifesteal) - 1;

          if (totalLifesteal > 0) {
            const healAmount = Math.floor(finalDamage * totalLifesteal);
            hero.hp = Math.min(hero.maxHp, hero.hp + healAmount);
          }
        }

        this.damageEnemy(enemy.id, finalDamage, attackerId);
        hitCount++;
      }
    });

    return hitCount;
  }

  private damageEnemiesInLine(attackerId: string, startX: number, startY: number,
                               endX: number, endY: number, width: number, damage: number): void {
    const enemies = this.getEnemiesInLine(startX, startY, endX, endY, width);
    enemies.forEach(enemy => {
      this.damageEnemy(enemy.id, damage, attackerId);
    });
  }

  private getEnemiesInLine(startX: number, startY: number, endX: number, endY: number, width: number): ServerEnemy[] {
    const result: ServerEnemy[] = [];
    const dx = endX - startX;
    const dy = endY - startY;
    const lineLength = Math.sqrt(dx * dx + dy * dy);
    if (lineLength === 0) return result;

    const lineX = dx / lineLength;
    const lineY = dy / lineLength;

    this.enemies.forEach(enemy => {
      // 선까지의 거리 계산
      const toEnemyX = enemy.x - startX;
      const toEnemyY = enemy.y - startY;
      const projLength = toEnemyX * lineX + toEnemyY * lineY;

      if (projLength < 0 || projLength > lineLength) return;

      const closestX = startX + lineX * projLength;
      const closestY = startY + lineY * projLength;
      const distToLine = this.getDistance(enemy.x, enemy.y, closestX, closestY);

      if (distToLine <= width) {
        result.push(enemy);
      }
    });

    return result;
  }

  private findNearestEnemy(
    x: number,
    y: number,
    maxRange: number,
    dirX?: number,
    dirY?: number,
    angleThreshold?: number  // 방향 체크 각도 임계값 (내적 기준)
  ): ServerEnemy | null {
    let nearest: ServerEnemy | null = null;
    let minDist = maxRange;

    this.enemies.forEach(enemy => {
      const dist = this.getDistance(x, y, enemy.x, enemy.y);
      if (dist >= minDist || dist === 0) return;

      // 방향 체크 (angleThreshold가 지정된 경우)
      if (dirX !== undefined && dirY !== undefined && angleThreshold !== undefined) {
        const enemyDx = enemy.x - x;
        const enemyDy = enemy.y - y;
        const enemyDist = Math.sqrt(enemyDx * enemyDx + enemyDy * enemyDy);
        if (enemyDist > 0) {
          const enemyDirX = enemyDx / enemyDist;
          const enemyDirY = enemyDy / enemyDist;
          const dot = dirX * enemyDirX + dirY * enemyDirY;
          // 방향 범위 밖이면 스킵
          if (dot < angleThreshold) return;
        }
      }

      minDist = dist;
      nearest = enemy;
    });

    return nearest;
  }

  private findNearestEnemies(
    x: number,
    y: number,
    maxRange: number,
    count: number,
    dirX?: number,
    dirY?: number,
    angleThreshold?: number  // 방향 체크 각도 임계값
  ): ServerEnemy[] {
    let filtered = this.enemies
      .map(enemy => ({ enemy, dist: this.getDistance(x, y, enemy.x, enemy.y) }))
      .filter(e => e.dist <= maxRange && e.dist > 0);

    // 방향 체크 (angleThreshold가 지정된 경우)
    if (dirX !== undefined && dirY !== undefined && angleThreshold !== undefined) {
      filtered = filtered.filter(e => {
        const enemyDx = e.enemy.x - x;
        const enemyDy = e.enemy.y - y;
        const enemyDist = Math.sqrt(enemyDx * enemyDx + enemyDy * enemyDy);
        if (enemyDist === 0) return false;
        const enemyDirX = enemyDx / enemyDist;
        const enemyDirY = enemyDy / enemyDist;
        const dot = dirX * enemyDirX + dirY * enemyDirY;
        return dot >= angleThreshold;
      });
    }

    return filtered
      .sort((a, b) => a.dist - b.dist)
      .slice(0, count)
      .map(e => e.enemy);
  }

  private getEffectiveSpeed(hero: ServerHero): number {
    // 이동속도는 버프 영향 없음 (speedBonus는 공격속도용)
    return hero.speed;
  }

  private getDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  }

  private getNetworkGameState(): RPGCoopGameState {
    return {
      running: this.gameState === 'playing',
      paused: false,
      gameOver: this.gameState === 'ended',
      victory: false,
      gameTime: this.gameTime,
      currentWave: this.currentWave,
      waveInProgress: this.waveInProgress,
      enemiesRemaining: this.enemiesRemaining,
      heroes: Array.from(this.heroes.values()).map(h => this.getNetworkHero(h)),
      enemies: this.enemies.map(e => this.getNetworkEnemy(e)),
      playerCount: this.playerIds.length,
      activeSkillEffects: this.activeSkillEffects,
      pendingSkills: this.pendingSkills,
    };
  }

  private getNetworkHero(hero: ServerHero): NetworkCoopHero {
    return {
      id: hero.id,
      playerId: hero.playerId,
      heroClass: hero.heroClass,
      x: hero.x,
      y: hero.y,
      hp: hero.hp,
      maxHp: hero.maxHp,
      attack: hero.attack,
      attackSpeed: hero.attackSpeed,
      speed: hero.speed,
      range: hero.range,
      level: hero.level,
      exp: hero.exp,
      expToNextLevel: hero.expToNextLevel,
      isDead: hero.isDead,
      reviveTimer: hero.reviveTimer,
      facingRight: hero.facingRight,
      facingAngle: hero.facingAngle,
      buffs: hero.buffs,
      passiveGrowth: hero.passiveGrowth,
      skillCooldowns: hero.skillCooldowns,
      targetX: hero.targetPosition?.x,
      targetY: hero.targetPosition?.y,
    };
  }

  private getNetworkEnemy(enemy: ServerEnemy): NetworkCoopEnemy {
    return {
      id: enemy.id,
      type: enemy.type,
      x: enemy.x,
      y: enemy.y,
      hp: enemy.hp,
      maxHp: enemy.maxHp,
      expReward: enemy.expReward,
      targetHeroId: enemy.targetHeroId,
      buffs: enemy.buffs,
    };
  }

  private broadcast(message: any): void {
    this.playerIds.forEach(playerId => {
      sendToPlayer(playerId, message);
    });
  }

  private broadcastState(): void {
    const state = this.getNetworkGameState();
    this.broadcast({ type: 'COOP_GAME_STATE', state });
  }

  private broadcastEvent(event: RPGCoopGameEvent): void {
    this.broadcast({ type: 'COOP_GAME_EVENT', event });
  }

  // 플레이어 연결 해제 처리
  public handlePlayerDisconnect(playerId: string): void {
    const heroId = this.playerHeroMap.get(playerId);
    if (!heroId) return;

    const hero = this.heroes.get(heroId);
    if (hero) {
      // 연결 해제된 플레이어의 영웅을 사망 처리
      if (!hero.isDead) {
        hero.isDead = true;
        hero.reviveTimer = 9999;  // 부활 불가
        this.broadcastEvent({
          event: 'HERO_DIED',
          heroId,
          reviveTime: 9999,
        });
      }
    }

    this.broadcast({
      type: 'COOP_PLAYER_DISCONNECTED',
      playerId,
    });

    // 모든 플레이어가 연결 해제되면 게임 종료
    const connectedPlayers = this.playerIds.filter(id => {
      const player = players.get(id);
      return player && player.roomId === this.id;
    });

    if (connectedPlayers.length === 0) {
      this.endGame(false);
    }
  }
}
