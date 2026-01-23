import { v4 as uuidv4 } from 'uuid';
import { players, sendToPlayer } from '../state/players';
import { removeCoopRoom } from '../websocket/MessageHandler';
import type { HeroClass, SkillType, Buff, PassiveGrowthState, SkillEffect, PendingSkill, UpgradeLevels } from '../../../src/types/rpg';
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

// 게임 단계 타입
type CoopGamePhase = 'playing' | 'boss_phase' | 'victory' | 'defeat';

// 서버측 협동 모드 설정
const CONFIG = {
  MAP_WIDTH: 2000,
  MAP_HEIGHT: 2000,
  MAP_CENTER_X: 1000,
  MAP_CENTER_Y: 1000,
  SPAWN_MARGIN: 50,

  // 넥서스 설정
  NEXUS: {
    X: 1000,
    Y: 1000,
    HP: 5000,
    RADIUS: 80,
  },

  // 적 기지 설정
  ENEMY_BASES: {
    left: { x: 200, y: 1000, hp: 3000, radius: 60 },
    right: { x: 1800, y: 1000, hp: 3000, radius: 60 },
  },

  // 골드 설정
  GOLD: {
    STARTING: 0,
    REWARDS: {
      melee: 5,
      ranged: 8,
      knight: 15,
      mage: 20,
      boss: 200,
    } as Record<string, number>,
    UPGRADE_BASE_COST: 50,
    UPGRADE_COST_MULTIPLIER: 1.5,
  },

  // 업그레이드 설정 (레벨당 보너스)
  UPGRADE: {
    attack: { perLevel: 3 },
    speed: { perLevel: 0.08 },
    hp: { perLevel: 25 },
    goldRate: { perLevel: 0.15 },
  },

  // 스폰 설정
  SPAWN: {
    BASE_INTERVAL: 4,
    INTERVAL_DECREASE_PER_MINUTE: 0.2,
    MIN_INTERVAL: 1.5,
    STAT_MULTIPLIER_PER_MINUTE: 0.1,
  },

  // 보스 설정
  BOSS: {
    HP_MULTIPLIER: 5,
    DAMAGE_MULTIPLIER: 2,
    GOLD_REWARD: 200,
  },

  // 패시브 시스템
  PASSIVE_UNLOCK_LEVEL: 5,

  // 직업별 기본 패시브
  BASE_PASSIVES: {
    warrior: { lifesteal: 0.15 },
    archer: { multiTarget: 3, baseChance: 0.2 },
    knight: { hpRegen: 5 },
    mage: { damageBonus: 0.25 },
  } as Record<HeroClass, any>,

  // 부활 시스템
  REVIVE: {
    BASE_TIME: 10,
    TIME_PER_MINUTE: 2,
    MAX_TIME: 30,
    REVIVE_HP_PERCENT: 0.5,
    SPAWN_OFFSET: 100,
  },

  // 난이도 스케일링 (HP)
  DIFFICULTY_SCALING: {
    1: 1.0,
    2: 1.5,
    3: 2.0,
    4: 2.5,
  } as Record<number, number>,

  // 공격력 스케일링 (인원수에 따른 적 공격력 증가)
  ATTACK_SCALING: {
    1: 1.0,
    2: 1.1,
    3: 1.2,
    4: 1.3,
  } as Record<number, number>,

  // 버프 공유
  BUFF_SHARE: {
    KNIGHT_HP_REGEN_RANGE: 150,
    KNIGHT_HP_REGEN_RATIO: 0.5,
    WARRIOR_BERSERKER_RANGE: 200,
    WARRIOR_BERSERKER_ATK_BONUS: 0.2,
  },

  // 어그로 시스템
  AGGRO: {
    DURATION: 5,  // 어그로 지속 시간 (초)
    MELEE_HERO_BONUS: 1.5,
    CURRENT_TARGET_BONUS: 1.1,
  },

  // 직업별 설정
  CLASS_CONFIGS: {
    warrior: { hp: 350, attack: 35, attackSpeed: 1.0, speed: 2.7, range: 80 },
    archer: { hp: 250, attack: 45, attackSpeed: 0.7, speed: 3.3, range: 180 },
    knight: { hp: 450, attack: 30, attackSpeed: 1.3, speed: 2.1, range: 80 },
    mage: { hp: 220, attack: 55, attackSpeed: 1.8, speed: 2.85, range: 190 },
  } as Record<HeroClass, { hp: number; attack: number; attackSpeed: number; speed: number; range: number }>,

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
};

// 넥서스 인터페이스
interface ServerNexus {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
}

// 적 기지 인터페이스
interface ServerEnemyBase {
  id: 'left' | 'right';
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  destroyed: boolean;
}

// 서버측 영웅 상태 (골드 시스템으로 변경)
interface ServerHero extends Omit<NetworkCoopHero, 'moveDirection'> {
  attackCooldown: number;
  baseAttack: number;
  baseSpeed: number;
  baseAttackSpeed: number;
  baseMaxHp: number;
  moveDirection: { x: number; y: number } | null;
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
  // 캐릭터 레벨 (플레이어 프로필에서, 업그레이드 최대 레벨 결정)
  characterLevel: number;
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
  // 어그로 시스템
  aggroOnHero: boolean;
  aggroExpireTime?: number;
  aggroTargetHeroId?: string;
  // 골드 보상
  goldReward: number;
  // 스폰 기지
  fromBase?: 'left' | 'right';
}

// 플레이어 통계
interface PlayerStats {
  kills: number;
  deaths: number;
  damageDealt: number;
  damageTaken: number;
  goldEarned: number;
  basesDestroyed: number;
  bossesKilled: number;
}

export class RPGCoopGameRoom {
  public id: string;
  private playerIds: string[];
  private playerInfos: CoopPlayerInfo[];

  private gameState: 'waiting' | 'countdown' | 'playing' | 'ended' = 'waiting';
  private gamePhase: CoopGamePhase = 'playing';
  private gameTime: number = 0;
  private gameLoopInterval: NodeJS.Timeout | null = null;
  private countdownTimer: NodeJS.Timeout | null = null;

  private heroes: Map<string, ServerHero> = new Map();  // heroId -> ServerHero
  private playerHeroMap: Map<string, string> = new Map();  // playerId -> heroId
  private enemies: ServerEnemy[] = [];

  // 넥서스 디펜스 시스템
  private nexus: ServerNexus;
  private enemyBases: ServerEnemyBase[];
  private bossesSpawned: boolean = false;
  private lastSpawnTime: number = 0;

  private activeSkillEffects: SkillEffect[] = [];
  private pendingSkills: PendingSkill[] = [];

  private playerStats: Map<string, PlayerStats> = new Map();

  private lastFullSync: number = 0;

  constructor(id: string, playerIds: string[], playerInfos: CoopPlayerInfo[]) {
    this.id = id;
    this.playerIds = playerIds;
    this.playerInfos = playerInfos;

    // 넥서스 초기화
    this.nexus = {
      x: CONFIG.NEXUS.X,
      y: CONFIG.NEXUS.Y,
      hp: CONFIG.NEXUS.HP,
      maxHp: CONFIG.NEXUS.HP,
    };

    // 적 기지 초기화
    this.enemyBases = [
      {
        id: 'left',
        x: CONFIG.ENEMY_BASES.left.x,
        y: CONFIG.ENEMY_BASES.left.y,
        hp: CONFIG.ENEMY_BASES.left.hp,
        maxHp: CONFIG.ENEMY_BASES.left.hp,
        destroyed: false,
      },
      {
        id: 'right',
        x: CONFIG.ENEMY_BASES.right.x,
        y: CONFIG.ENEMY_BASES.right.y,
        hp: CONFIG.ENEMY_BASES.right.hp,
        maxHp: CONFIG.ENEMY_BASES.right.hp,
        destroyed: false,
      },
    ];

    // 플레이어 통계 초기화
    playerIds.forEach(id => {
      this.playerStats.set(id, {
        kills: 0,
        deaths: 0,
        damageDealt: 0,
        damageTaken: 0,
        goldEarned: 0,
        basesDestroyed: 0,
        bossesKilled: 0,
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
    this.gamePhase = 'playing';
    this.gameTime = 0;
    this.bossesSpawned = false;
    this.lastSpawnTime = 0;

    // 영웅 생성
    this.initializeHeroes();

    console.log(`[Coop] 넥서스 디펜스 게임 시작: Room ${this.id} (${this.playerIds.length}명)`);

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
  }

  private initializeHeroes(): void {
    const playerCount = this.playerIds.length;
    const spawnPositions = this.getSpawnPositions(playerCount);

    this.playerIds.forEach((playerId, index) => {
      const playerInfo = this.playerInfos[index];
      const heroClass = playerInfo.heroClass;
      const classConfig = CONFIG.CLASS_CONFIGS[heroClass];
      const pos = spawnPositions[index];

      // TODO: 실제 캐릭터 레벨을 플레이어 프로필에서 가져와야 함
      const characterLevel = 10;  // 기본값

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
        // 골드 시스템
        gold: CONFIG.GOLD.STARTING,
        upgradeLevels: { attack: 0, speed: 0, hp: 0, goldRate: 0 },
        characterLevel,
        // UI 호환성을 위한 레거시 필드 (실제 레벨업 안함)
        level: characterLevel,
        exp: 0,
        expToNextLevel: 100,
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
        baseMaxHp: classConfig.hp,
        moveDirection: null,
      };

      this.heroes.set(heroId, hero);
      this.playerHeroMap.set(playerId, heroId);
    });
  }

  private getSpawnPositions(count: number): { x: number; y: number }[] {
    // 넥서스 근처에서 스폰
    const centerX = CONFIG.NEXUS.X;
    const centerY = CONFIG.NEXUS.Y + 100;  // 넥서스 약간 아래
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

    // 스폰 처리 (연속 스폰)
    this.updateSpawning(deltaTime);

    // 게임 페이즈 체크
    this.checkGamePhase();

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
          const t = hero.dashState.progress;
          const eased = t * (2 - t);
          hero.x = hero.dashState.startX + (hero.dashState.targetX - hero.dashState.startX) * eased;
          hero.y = hero.dashState.startY + (hero.dashState.targetY - hero.dashState.startY) * eased;
        }
      } else if (hero.moveDirection) {
        const baseSpeed = this.getEffectiveSpeed(hero);
        const moveDistance = baseSpeed * deltaTime * 60;
        const moveX = hero.moveDirection.x * moveDistance;
        const moveY = hero.moveDirection.y * moveDistance;
        hero.x += moveX;
        hero.y += moveY;

        hero.facingRight = hero.moveDirection.x >= 0;
        hero.facingAngle = Math.atan2(hero.moveDirection.y, hero.moveDirection.x);
      }

      // 맵 경계 체크
      hero.x = Math.max(0, Math.min(CONFIG.MAP_WIDTH, hero.x));
      hero.y = Math.max(0, Math.min(CONFIG.MAP_HEIGHT, hero.y));

      // 패시브 HP 재생 (기사)
      if (hero.heroClass === 'knight' && hero.hp < hero.maxHp) {
        const baseRegen = hero.characterLevel >= CONFIG.PASSIVE_UNLOCK_LEVEL ? (CONFIG.BASE_PASSIVES.knight.hpRegen || 0) : 0;
        const growthRegen = hero.passiveGrowth.currentValue;
        const totalRegen = baseRegen + growthRegen;
        if (totalRegen > 0) {
          const hpRegen = totalRegen * deltaTime;
          hero.hp = Math.min(hero.maxHp, hero.hp + hpRegen);
        }
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

      // 어그로 만료 체크
      if (enemy.aggroOnHero && enemy.aggroExpireTime && this.gameTime >= enemy.aggroExpireTime) {
        enemy.aggroOnHero = false;
        enemy.aggroExpireTime = undefined;
        enemy.aggroTargetHeroId = undefined;
      }

      // AI 행동 결정
      if (enemy.aggroOnHero && enemy.aggroTargetHeroId) {
        // 어그로 상태: 공격한 영웅 추적
        const targetHero = this.heroes.get(enemy.aggroTargetHeroId);
        if (targetHero && !targetHero.isDead) {
          this.moveAndAttackTarget(enemy, targetHero.x, targetHero.y, 'hero', targetHero.id, deltaTime);
        } else {
          // 어그로 타겟이 사망하면 넥서스로 전환
          enemy.aggroOnHero = false;
          enemy.aggroTargetHeroId = undefined;
          this.moveAndAttackTarget(enemy, this.nexus.x, this.nexus.y, 'nexus', undefined, deltaTime);
        }
      } else {
        // 기본 행동: 넥서스를 향해 이동하고 공격
        this.moveAndAttackTarget(enemy, this.nexus.x, this.nexus.y, 'nexus', undefined, deltaTime);
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
        // 골드 분배 (마지막 공격자에게)
        this.distributeGold(enemy);

        this.broadcastEvent({
          event: 'ENEMY_DIED',
          enemyId,
          expReward: enemy.goldReward,  // 골드로 변경됨
          killerHeroId: '',
        });
        this.enemies = this.enemies.filter(e => e.id !== enemyId);

        // 보스 처치 확인
        if (enemy.type === 'boss') {
          // 모든 플레이어 통계 업데이트
          this.playerStats.forEach(stats => {
            stats.bossesKilled++;
          });
        }
      }
    });
  }

  private moveAndAttackTarget(
    enemy: ServerEnemy,
    targetX: number,
    targetY: number,
    targetType: 'hero' | 'nexus',
    heroId: string | undefined,
    deltaTime: number
  ): void {
    const dx = targetX - enemy.x;
    const dy = targetY - enemy.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= enemy.attackRange) {
      // 공격 범위 내: 공격
      if (enemy.attackCooldown <= 0) {
        if (targetType === 'hero' && heroId) {
          this.damageHero(heroId, enemy.attackDamage, enemy.id);
        } else if (targetType === 'nexus') {
          this.damageNexus(enemy.attackDamage);
        }
        enemy.attackCooldown = enemy.attackSpeed;
      }
    } else {
      // 이동
      const moveX = (dx / dist) * enemy.moveSpeed;
      const moveY = (dy / dist) * enemy.moveSpeed;
      enemy.x += moveX;
      enemy.y += moveY;
    }
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
      // 범위 내 적에게 데미지
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

      const baseRegen = knight.characterLevel >= CONFIG.PASSIVE_UNLOCK_LEVEL ? (CONFIG.BASE_PASSIVES.knight.hpRegen || 0) : 0;
      const growthRegen = knight.passiveGrowth.currentValue;
      const totalRegen = baseRegen + growthRegen;
      if (totalRegen <= 0) return;

      const shareAmount = totalRegen * CONFIG.BUFF_SHARE.KNIGHT_HP_REGEN_RATIO * deltaTime;

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
          const existingBuff = ally.buffs.find(b => b.type === 'berserker');
          if (!existingBuff) {
            ally.buffs.push({
              type: 'berserker',
              duration: 0.1,
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

  private updateSpawning(deltaTime: number): void {
    // 보스 페이즈에서는 스폰하지 않음
    if (this.gamePhase !== 'playing') return;

    // 파괴되지 않은 기지에서만 스폰
    const activeBases = this.enemyBases.filter(b => !b.destroyed);
    if (activeBases.length === 0) return;

    // 스폰 간격 계산 (시간이 지날수록 빨라짐)
    const minutes = this.gameTime / 60;
    const spawnInterval = Math.max(
      CONFIG.SPAWN.MIN_INTERVAL,
      CONFIG.SPAWN.BASE_INTERVAL - minutes * CONFIG.SPAWN.INTERVAL_DECREASE_PER_MINUTE
    );

    // 스폰 시간 체크
    if (this.gameTime - this.lastSpawnTime < spawnInterval) return;

    // 번갈아가며 기지에서 스폰
    const spawnIndex = Math.floor(this.gameTime / spawnInterval) % activeBases.length;
    const selectedBase = activeBases[spawnIndex];

    this.spawnEnemy(selectedBase);
    this.lastSpawnTime = this.gameTime;
  }

  private getEnemyTypesForTime(minutes: number): { type: UnitType; weight: number }[] {
    if (minutes < 2) {
      return [{ type: 'melee', weight: 1 }];
    } else if (minutes < 4) {
      return [
        { type: 'melee', weight: 3 },
        { type: 'ranged', weight: 1 },
      ];
    } else if (minutes < 6) {
      return [
        { type: 'melee', weight: 2 },
        { type: 'ranged', weight: 2 },
        { type: 'knight', weight: 1 },
      ];
    } else {
      return [
        { type: 'melee', weight: 2 },
        { type: 'ranged', weight: 2 },
        { type: 'knight', weight: 2 },
        { type: 'mage', weight: 1 },
      ];
    }
  }

  private selectRandomEnemyType(enemyTypes: { type: UnitType; weight: number }[]): UnitType {
    const totalWeight = enemyTypes.reduce((sum, e) => sum + e.weight, 0);
    let random = Math.random() * totalWeight;

    for (const enemy of enemyTypes) {
      random -= enemy.weight;
      if (random <= 0) {
        return enemy.type;
      }
    }

    return enemyTypes[0].type;
  }

  private spawnEnemy(base: ServerEnemyBase): void {
    const minutes = this.gameTime / 60;
    const enemyTypes = this.getEnemyTypesForTime(minutes);
    const type = this.selectRandomEnemyType(enemyTypes);

    const aiConfig = CONFIG.ENEMY_AI[type] || CONFIG.ENEMY_AI.melee;

    // 난이도 스케일링
    const playerCount = this.playerIds.length;
    const hpMultiplier = CONFIG.DIFFICULTY_SCALING[playerCount] || 1.0;
    const attackMultiplier = CONFIG.ATTACK_SCALING[playerCount] || 1.0;
    const statMultiplier = 1 + minutes * CONFIG.SPAWN.STAT_MULTIPLIER_PER_MINUTE;

    // 스폰 위치에 약간의 랜덤 오프셋
    const offsetX = (Math.random() - 0.5) * 60;
    const offsetY = (Math.random() - 0.5) * 60;

    const enemy: ServerEnemy = {
      id: uuidv4(),
      type,
      x: base.x + offsetX,
      y: base.y + offsetY,
      hp: Math.floor(aiConfig.hp * hpMultiplier * statMultiplier),
      maxHp: Math.floor(aiConfig.hp * hpMultiplier * statMultiplier),
      expReward: 0,  // 골드 시스템으로 변경
      goldReward: Math.floor((CONFIG.GOLD.REWARDS[type] || 5) * statMultiplier),
      buffs: [],
      attackCooldown: 0,
      attackDamage: Math.floor(aiConfig.attackDamage * statMultiplier * attackMultiplier),
      attackSpeed: aiConfig.attackSpeed,
      attackRange: aiConfig.attackRange,
      moveSpeed: aiConfig.moveSpeed,
      detectionRange: aiConfig.detectionRange,
      isStunned: false,
      stunDuration: 0,
      aggroOnHero: false,
      fromBase: base.id,
    };

    this.enemies.push(enemy);
    this.broadcastEvent({
      event: 'ENEMY_SPAWNED',
      enemy: this.getNetworkEnemy(enemy),
    });
  }

  private spawnBosses(): void {
    if (this.bossesSpawned) return;
    this.bossesSpawned = true;

    const playerCount = this.playerIds.length;
    const hpMultiplier = CONFIG.DIFFICULTY_SCALING[playerCount] || 1.0;
    const attackMultiplier = CONFIG.ATTACK_SCALING[playerCount] || 1.0;
    const minutes = this.gameTime / 60;
    const timeMultiplier = 1 + minutes * 0.1;

    const aiConfig = CONFIG.ENEMY_AI.boss;

    // 각 파괴된 기지 위치에서 보스 스폰
    this.enemyBases.forEach(base => {
      if (!base.destroyed) return;

      const boss: ServerEnemy = {
        id: `boss_${base.id}_${uuidv4()}`,
        type: 'boss',
        x: base.x,
        y: base.y,
        hp: Math.floor(aiConfig.hp * CONFIG.BOSS.HP_MULTIPLIER * hpMultiplier * timeMultiplier),
        maxHp: Math.floor(aiConfig.hp * CONFIG.BOSS.HP_MULTIPLIER * hpMultiplier * timeMultiplier),
        expReward: 0,
        goldReward: CONFIG.BOSS.GOLD_REWARD,
        buffs: [],
        attackCooldown: 0,
        attackDamage: Math.floor(aiConfig.attackDamage * CONFIG.BOSS.DAMAGE_MULTIPLIER * timeMultiplier * attackMultiplier),
        attackSpeed: aiConfig.attackSpeed * 1.2,
        attackRange: aiConfig.attackRange,
        moveSpeed: aiConfig.moveSpeed * 0.8,
        detectionRange: aiConfig.detectionRange,
        isStunned: false,
        stunDuration: 0,
        aggroOnHero: false,
        fromBase: base.id,
      };

      this.enemies.push(boss);
      this.broadcastEvent({
        event: 'ENEMY_SPAWNED',
        enemy: this.getNetworkEnemy(boss),
      });
    });

    console.log(`[Coop] 보스 2마리 스폰됨 - Room ${this.id}`);
  }

  private checkGamePhase(): void {
    // 이미 종료된 게임
    if (this.gamePhase === 'victory' || this.gamePhase === 'defeat') return;

    // 패배 조건: 넥서스 HP = 0
    if (this.nexus.hp <= 0) {
      this.endGame(false);
      return;
    }

    if (this.gamePhase === 'playing') {
      // 두 기지 모두 파괴되면 보스 페이즈
      const allBasesDestroyed = this.enemyBases.every(b => b.destroyed);
      if (allBasesDestroyed) {
        this.gamePhase = 'boss_phase';
        this.spawnBosses();
        this.broadcast({
          type: 'COOP_WAVE_START',
          waveNumber: -1,  // 보스 페이즈 표시
          enemyCount: 2,
        });
        console.log(`[Coop] 보스 페이즈 진입 - Room ${this.id}`);
      }
    } else if (this.gamePhase === 'boss_phase') {
      // 승리 조건: 모든 보스 처치
      const bosses = this.enemies.filter(e => e.type === 'boss');
      if (this.bossesSpawned && bosses.length === 0) {
        this.endGame(true);
      }
    }
  }

  private distributeGold(enemy: ServerEnemy): void {
    // 모든 살아있는 플레이어에게 골드 분배
    const aliveHeroes = Array.from(this.heroes.values()).filter(h => !h.isDead);

    aliveHeroes.forEach(hero => {
      const goldRateBonus = hero.upgradeLevels.goldRate * CONFIG.UPGRADE.goldRate.perLevel;
      const actualGold = Math.floor(enemy.goldReward * (1 + goldRateBonus));
      hero.gold += actualGold;

      // 통계 업데이트
      const stats = this.playerStats.get(hero.playerId);
      if (stats) {
        stats.goldEarned += actualGold;
        stats.kills++;
      }
    });

    // 죽은 플레이어는 50% 골드
    const deadHeroes = Array.from(this.heroes.values()).filter(h => h.isDead);
    deadHeroes.forEach(hero => {
      const goldRateBonus = hero.upgradeLevels.goldRate * CONFIG.UPGRADE.goldRate.perLevel;
      const actualGold = Math.floor(enemy.goldReward * 0.5 * (1 + goldRateBonus));
      hero.gold += actualGold;

      const stats = this.playerStats.get(hero.playerId);
      if (stats) {
        stats.goldEarned += actualGold;
      }
    });
  }

  private damageNexus(damage: number): void {
    this.nexus.hp = Math.max(0, this.nexus.hp - damage);
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

    // 통계 업데이트
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
    // 부활 시간: 기본 시간 + 분당 추가 (최대 30초)
    const minutes = Math.floor(this.gameTime / 60);
    hero.reviveTimer = Math.min(
      CONFIG.REVIVE.MAX_TIME,
      CONFIG.REVIVE.BASE_TIME + minutes * CONFIG.REVIVE.TIME_PER_MINUTE
    );

    // 통계 업데이트
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

    // 넥서스 근처에서 부활
    const angle = Math.random() * Math.PI * 2;
    const offset = CONFIG.REVIVE.SPAWN_OFFSET;
    let spawnX = this.nexus.x + Math.cos(angle) * offset;
    let spawnY = this.nexus.y + Math.sin(angle) * offset;

    // 맵 경계 체크
    spawnX = Math.max(50, Math.min(CONFIG.MAP_WIDTH - 50, spawnX));
    spawnY = Math.max(50, Math.min(CONFIG.MAP_HEIGHT - 50, spawnY));

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

    // 어그로 설정
    if (attackerId) {
      enemy.aggroOnHero = true;
      enemy.aggroExpireTime = this.gameTime + CONFIG.AGGRO.DURATION;
      enemy.aggroTargetHeroId = attackerId;
    }

    // 통계 업데이트
    if (attackerId) {
      const hero = this.heroes.get(attackerId);
      if (hero) {
        const stats = this.playerStats.get(hero.playerId);
        if (stats) {
          stats.damageDealt += damage;
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

  private damageBase(baseId: 'left' | 'right', damage: number, attackerId: string): boolean {
    const base = this.enemyBases.find(b => b.id === baseId);
    if (!base || base.destroyed) return false;

    base.hp = Math.max(0, base.hp - damage);

    if (base.hp <= 0) {
      base.destroyed = true;

      // 통계 업데이트
      if (attackerId) {
        const hero = this.heroes.get(attackerId);
        if (hero) {
          const stats = this.playerStats.get(hero.playerId);
          if (stats) {
            stats.basesDestroyed++;
          }
        }
      }

      console.log(`[Coop] 기지 파괴: ${baseId} - Room ${this.id}`);
      return true;
    }

    return false;
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

  private endGame(victory: boolean): void {
    this.gameState = 'ended';
    this.gamePhase = victory ? 'victory' : 'defeat';

    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
    }

    // 파괴된 기지 수, 처치한 보스 수 계산
    const basesDestroyed = this.enemyBases.filter(b => b.destroyed).length;

    // 처치한 보스 수 계산
    const bossesKilled = this.enemies.filter(e => e.type === 'boss' && e.hp <= 0).length;

    // 총 골드 수입 계산
    const totalGoldEarned = Array.from(this.playerStats.values()).reduce((sum, stats) => sum + (stats.goldEarned || 0), 0);

    const result: RPGCoopGameResult = {
      victory,
      basesDestroyed,
      bossesKilled,
      totalGameTime: this.gameTime,
      totalGoldEarned,
      playerResults: this.playerIds.map(playerId => {
        const heroId = this.playerHeroMap.get(playerId);
        const hero = heroId ? this.heroes.get(heroId) : null;
        const stats = this.playerStats.get(playerId);
        const info = this.playerInfos.find(p => p.id === playerId);

        return {
          playerId,
          playerName: info?.name || 'Unknown',
          heroClass: hero?.heroClass || 'warrior',
          kills: stats?.kills || 0,
          deaths: stats?.deaths || 0,
          damageDealt: stats?.damageDealt || 0,
          damageTaken: stats?.damageTaken || 0,
          goldEarned: stats?.goldEarned || 0,
        };
      }),
    };

    this.broadcast({ type: 'COOP_GAME_OVER', result });

    console.log(`[Coop] 게임 종료: Room ${this.id}, ${victory ? '승리' : '패배'}, 기지 ${basesDestroyed}개 파괴`);

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
  public handleHeroMoveDirection(playerId: string, direction: { x: number; y: number } | null): void {
    const heroId = this.playerHeroMap.get(playerId);
    if (!heroId) return;

    const hero = this.heroes.get(heroId);
    if (!hero || hero.isDead) return;

    hero.moveDirection = direction;
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

  // 업그레이드 처리
  public handleUpgrade(playerId: string, upgradeType: keyof UpgradeLevels): boolean {
    const heroId = this.playerHeroMap.get(playerId);
    if (!heroId) return false;

    const hero = this.heroes.get(heroId);
    if (!hero || hero.isDead) return false;

    const currentLevel = hero.upgradeLevels[upgradeType];

    // 캐릭터 레벨이 최대 레벨
    if (currentLevel >= hero.characterLevel) return false;

    // 비용 계산
    const cost = Math.floor(CONFIG.GOLD.UPGRADE_BASE_COST * Math.pow(CONFIG.GOLD.UPGRADE_COST_MULTIPLIER, currentLevel));
    if (hero.gold < cost) return false;

    // 골드 차감 및 레벨 증가
    hero.gold -= cost;
    hero.upgradeLevels[upgradeType]++;

    // 스탯 적용
    switch (upgradeType) {
      case 'attack':
        hero.attack = hero.baseAttack + hero.upgradeLevels.attack * CONFIG.UPGRADE.attack.perLevel;
        break;
      case 'speed':
        hero.speed = hero.baseSpeed + hero.upgradeLevels.speed * CONFIG.UPGRADE.speed.perLevel;
        break;
      case 'hp':
        const hpBonus = CONFIG.UPGRADE.hp.perLevel;
        hero.maxHp = hero.baseMaxHp + hero.upgradeLevels.hp * hpBonus;
        hero.hp = Math.min(hero.hp + hpBonus, hero.maxHp);
        break;
      // goldRate는 골드 획득 시 자동 적용
    }

    return true;
  }

  private executeSkill(hero: ServerHero, slot: 'Q' | 'W' | 'E', targetX: number, targetY: number, config: any): void {
    const dx = targetX - hero.x;
    const dy = targetY - hero.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const dirX = dist > 0 ? dx / dist : 1;
    const dirY = dist > 0 ? dy / dist : 0;

    // 마법사 패시브 데미지 보너스
    const baseMageDamageBonus = hero.characterLevel >= CONFIG.PASSIVE_UNLOCK_LEVEL
      ? (CONFIG.BASE_PASSIVES.mage.damageBonus || 0)
      : 0;
    const damageBonus = hero.heroClass === 'mage' ? baseMageDamageBonus + hero.passiveGrowth.currentValue : 0;

    // 스킬 이펙트 생성
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

  private createSkillEffect(
    hero: ServerHero,
    skillType: SkillType,
    targetX: number,
    targetY: number,
    dirX: number,
    dirY: number,
    config: any
  ): void {
    if (skillType === 'mage_e') return;

    const effect: SkillEffect = {
      type: skillType,
      position: { x: hero.x, y: hero.y },
      targetPosition: { x: targetX, y: targetY },
      direction: { x: dirX, y: dirY },
      radius: config.radius || hero.range || 80,
      duration: 0.4,
      startTime: this.gameTime,
      heroClass: hero.heroClass,
    };

    if (skillType.endsWith('_w')) {
      effect.duration = 0.5;
    }

    if (skillType === 'archer_e' || skillType === 'mage_w') {
      effect.position = { x: targetX, y: targetY };
    }

    this.activeSkillEffects.push(effect);
  }

  private executeWarriorSkill(hero: ServerHero, slot: 'Q' | 'W' | 'E', targetX: number, targetY: number,
                               dirX: number, dirY: number, config: any, damageBonus: number): void {
    // 업그레이드 보너스 적용
    const attackBonus = hero.upgradeLevels.attack * CONFIG.UPGRADE.attack.perLevel;
    let baseDamage = (hero.baseAttack + attackBonus) * (1 + damageBonus);

    const berserkerBuff = hero.buffs.find(b => b.type === 'berserker');
    if (berserkerBuff && berserkerBuff.attackBonus) {
      baseDamage = Math.floor(baseDamage * (1 + berserkerBuff.attackBonus));
    }

    switch (slot) {
      case 'Q':
        this.damageEnemiesInRange(hero.id, hero.x, hero.y, hero.range, baseDamage * config.damageMultiplier, dirX, dirY, true);
        // 기지 공격도 가능
        this.tryAttackNearbyBase(hero, baseDamage * config.damageMultiplier);
        break;

      case 'W':
        const dashDistance = config.distance || 200;
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

        hero.buffs.push({
          type: 'invincible',
          duration: config.invincibleDuration || 2,
          startTime: this.gameTime,
        });
        this.broadcastEvent({ event: 'HERO_BUFF_APPLIED', heroId: hero.id, buff: hero.buffs[hero.buffs.length - 1] });

        this.damageEnemiesInLine(hero.id, hero.x, hero.y, hero.dashState.targetX, hero.dashState.targetY,
                                  60, baseDamage * config.damageMultiplier);
        break;

      case 'E':
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
    const attackBonus = hero.upgradeLevels.attack * CONFIG.UPGRADE.attack.perLevel;
    const baseDamage = (hero.baseAttack + attackBonus) * (1 + damageBonus);

    switch (slot) {
      case 'Q':
        const baseMultiChance = hero.characterLevel >= CONFIG.PASSIVE_UNLOCK_LEVEL
          ? (CONFIG.BASE_PASSIVES.archer.baseChance || 0)
          : 0;
        const multiTargetChance = baseMultiChance + hero.passiveGrowth.currentValue;
        const isMultiTarget = Math.random() < multiTargetChance;
        const archerAngleThreshold = 0.0;

        if (isMultiTarget) {
          const nearEnemies = this.findNearestEnemies(hero.x, hero.y, hero.range, 3, dirX, dirY, archerAngleThreshold);
          nearEnemies.forEach(enemy => {
            this.damageEnemy(enemy.id, baseDamage * config.damageMultiplier, hero.id);
          });
        } else {
          const nearest = this.findNearestEnemy(hero.x, hero.y, hero.range, dirX, dirY, archerAngleThreshold);
          if (nearest) {
            this.damageEnemy(nearest.id, baseDamage * config.damageMultiplier, hero.id);
          }
        }
        // 기지 공격도 가능
        this.tryAttackNearbyBase(hero, baseDamage * config.damageMultiplier);
        break;

      case 'W':
        const pierceDistance = config.pierceDistance || 300;
        this.damageEnemiesInLine(hero.id, hero.x, hero.y,
                                  hero.x + dirX * pierceDistance, hero.y + dirY * pierceDistance,
                                  30, baseDamage * config.damageMultiplier);
        break;

      case 'E':
        const radius = config.radius || 150;
        this.damageEnemiesInRange(hero.id, targetX, targetY, radius, baseDamage * config.damageMultiplier);
        break;
    }
  }

  private executeKnightSkill(hero: ServerHero, slot: 'Q' | 'W' | 'E', targetX: number, targetY: number,
                              dirX: number, dirY: number, config: any, damageBonus: number): void {
    const attackBonus = hero.upgradeLevels.attack * CONFIG.UPGRADE.attack.perLevel;
    const baseDamage = (hero.baseAttack + attackBonus) * (1 + damageBonus);

    switch (slot) {
      case 'Q':
        const hitCount = this.damageEnemiesInRange(hero.id, hero.x, hero.y, hero.range, baseDamage * config.damageMultiplier, dirX, dirY, true);
        if (hitCount > 0) {
          const cooldownReduction = 1.0 * hitCount;
          hero.skillCooldowns.W = Math.max(0, hero.skillCooldowns.W - cooldownReduction);
        }
        // 기지 공격도 가능
        this.tryAttackNearbyBase(hero, baseDamage * config.damageMultiplier);
        break;

      case 'W':
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

        const hpDamage = hero.maxHp * (config.hpDamagePercent || 0.1);
        const enemiesInPath = this.getEnemiesInLine(hero.x, hero.y, hero.dashState.targetX, hero.dashState.targetY, 70);
        enemiesInPath.forEach(enemy => {
          this.damageEnemy(enemy.id, hpDamage, hero.id);
          this.stunEnemy(enemy.id, config.stunDuration || 2);
        });
        break;

      case 'E':
        hero.buffs.push({
          type: 'ironwall',
          duration: config.duration || 5,
          startTime: this.gameTime,
          damageReduction: config.damageReduction || 0.7,
        });
        this.broadcastEvent({ event: 'HERO_BUFF_APPLIED', heroId: hero.id, buff: hero.buffs[hero.buffs.length - 1] });

        const healAmount = Math.floor(hero.maxHp * (config.healPercent || 0.2));
        hero.hp = Math.min(hero.maxHp, hero.hp + healAmount);
        this.broadcastEvent({ event: 'HERO_HEALED', heroId: hero.id, heal: healAmount, hp: hero.hp });
        break;
    }
  }

  private executeMageSkill(hero: ServerHero, slot: 'Q' | 'W' | 'E', targetX: number, targetY: number,
                            dirX: number, dirY: number, config: any, damageBonus: number): void {
    const attackBonus = hero.upgradeLevels.attack * CONFIG.UPGRADE.attack.perLevel;
    const baseDamage = (hero.baseAttack + attackBonus) * (1 + damageBonus);

    switch (slot) {
      case 'Q':
        const mageAngleThreshold = 0.0;
        this.damageEnemiesInRange(hero.id, hero.x, hero.y, hero.range, baseDamage * config.damageMultiplier, dirX, dirY, true, mageAngleThreshold);
        // 기지 공격도 가능
        this.tryAttackNearbyBase(hero, baseDamage * config.damageMultiplier);
        break;

      case 'W':
        const radius = config.radius || 80;
        this.damageEnemiesInRange(hero.id, targetX, targetY, radius, baseDamage * config.damageMultiplier);
        break;

      case 'E':
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

  // 기지 공격 시도
  private tryAttackNearbyBase(hero: ServerHero, damage: number): void {
    const attackRange = hero.range + 50;  // 기지는 크므로 범위 추가

    this.enemyBases.forEach(base => {
      if (base.destroyed) return;
      const dist = this.getDistance(hero.x, hero.y, base.x, base.y);
      if (dist <= attackRange) {
        this.damageBase(base.id, damage, hero.id);
      }
    });
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
    angleThresholdOverride?: number
  ): number {
    const hero = this.heroes.get(attackerId);
    let hitCount = 0;

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
        if (checkDirection && dirX !== undefined && dirY !== undefined && dist > 0) {
          const enemyDx = enemy.x - x;
          const enemyDy = enemy.y - y;
          const enemyDist = Math.sqrt(enemyDx * enemyDx + enemyDy * enemyDy);
          if (enemyDist > 0) {
            const enemyDirX = enemyDx / enemyDist;
            const enemyDirY = enemyDy / enemyDist;
            const dot = dirX * enemyDirX + dirY * enemyDirY;

            if (dot < attackAngleThreshold) return;
          }
        }

        let finalDamage = damage;

        // 전사 피해흡혈
        if (hero && hero.heroClass === 'warrior') {
          const baseLifesteal = hero.characterLevel >= CONFIG.PASSIVE_UNLOCK_LEVEL
            ? (CONFIG.BASE_PASSIVES.warrior.lifesteal || 0)
            : 0;
          const growthLifesteal = hero.passiveGrowth.currentValue;
          const passiveTotal = baseLifesteal + growthLifesteal;

          const berserkerBuff = hero.buffs.find(b => b.type === 'berserker');
          const buffLifesteal = berserkerBuff?.lifesteal || 0;

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
    angleThreshold?: number
  ): ServerEnemy | null {
    let nearest: ServerEnemy | null = null;
    let minDist = maxRange;

    this.enemies.forEach(enemy => {
      const dist = this.getDistance(x, y, enemy.x, enemy.y);
      if (dist >= minDist || dist === 0) return;

      if (dirX !== undefined && dirY !== undefined && angleThreshold !== undefined) {
        const enemyDx = enemy.x - x;
        const enemyDy = enemy.y - y;
        const enemyDist = Math.sqrt(enemyDx * enemyDx + enemyDy * enemyDy);
        if (enemyDist > 0) {
          const enemyDirX = enemyDx / enemyDist;
          const enemyDirY = enemyDy / enemyDist;
          const dot = dirX * enemyDirX + dirY * enemyDirY;
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
    angleThreshold?: number
  ): ServerEnemy[] {
    let filtered = this.enemies
      .map(enemy => ({ enemy, dist: this.getDistance(x, y, enemy.x, enemy.y) }))
      .filter(e => e.dist <= maxRange && e.dist > 0);

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
    const speedBonus = hero.upgradeLevels.speed * CONFIG.UPGRADE.speed.perLevel;
    return hero.baseSpeed + speedBonus;
  }

  private getDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  }

  private getNetworkGameState(): RPGCoopGameState {
    return {
      running: this.gameState === 'playing',
      paused: false,
      gameOver: this.gameState === 'ended',
      victory: this.gamePhase === 'victory',
      gameTime: this.gameTime,
      currentWave: this.enemyBases.filter(b => b.destroyed).length,  // 파괴된 기지 수
      waveInProgress: this.gamePhase === 'boss_phase',
      enemiesRemaining: this.enemies.length,
      heroes: Array.from(this.heroes.values()).map(h => this.getNetworkHero(h)),
      enemies: this.enemies.map(e => this.getNetworkEnemy(e)),
      playerCount: this.playerIds.length,
      activeSkillEffects: this.activeSkillEffects,
      pendingSkills: this.pendingSkills,
      // 넥서스 디펜스 추가 필드 (클라이언트에서 확장 필요)
      nexus: this.nexus,
      enemyBases: this.enemyBases,
      gamePhase: this.gamePhase,
    } as RPGCoopGameState & { nexus: ServerNexus; enemyBases: ServerEnemyBase[]; gamePhase: CoopGamePhase };
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
      gold: hero.gold,
      upgradeLevels: hero.upgradeLevels,
      isDead: hero.isDead,
      reviveTimer: hero.reviveTimer,
      facingRight: hero.facingRight,
      facingAngle: hero.facingAngle,
      buffs: hero.buffs,
      passiveGrowth: hero.passiveGrowth,
      skillCooldowns: hero.skillCooldowns,
      moveDirection: hero.moveDirection,
      // UI 호환성을 위한 레거시 필드
      level: hero.level,
      exp: hero.exp,
      expToNextLevel: hero.expToNextLevel,
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
      expReward: enemy.goldReward,  // 레거시 호환용
      goldReward: enemy.goldReward,
      targetHeroId: enemy.aggroTargetHeroId,
      aggroOnHero: enemy.aggroOnHero,
      fromBase: enemy.fromBase,
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
      if (!hero.isDead) {
        hero.isDead = true;
        hero.reviveTimer = 9999;
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
