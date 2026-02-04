import { RPGEnemy, EnemyBase, EnemyBaseId, EnemyAIConfig, RPGDifficulty, BossSkill, BossSkillType, BossSkillCast, BossSkillWarning, HeroUnit, Buff, DashState } from '../../types/rpg';
import { GOLD_CONFIG, ENEMY_AI_CONFIGS, NEXUS_CONFIG, DIFFICULTY_CONFIGS, RPG_ENEMY_CONFIGS, BOSS_SKILL_CONFIGS, DIFFICULTY_BOSS_SKILLS, TUTORIAL_BOSS_CONFIG } from '../../constants/rpgConfig';
import { generateId, distance } from '../../utils/math';

// 보스 설정
const BOSS_CONFIG = {
  // 플레이어 수에 따른 보스 HP (고정값)
  HP_BY_PLAYER_COUNT: {
    1: 3500,   // 싱글플레이
    2: 4000,   // 2인
    3: 5500,   // 3인
    4: 7500,   // 4인
  } as Record<number, number>,
  // 플레이어 수에 따른 보스 공격력 (고정값)
  DAMAGE_BY_PLAYER_COUNT: {
    1: 100,    // 싱글플레이
    2: 110,    // 2인
    3: 130,    // 3인
    4: 160,    // 4인
  } as Record<number, number>,
  GOLD_REWARD: 200,       // 보스 처치 시 골드
  SIZE_MULTIPLIER: 1.5,   // 보스 크기
};

/**
 * 보스 생성 (각 파괴된 기지 위치에서 스폰)
 * @param playerCount 플레이어 수 (1~4)
 * @param difficulty 난이도 (easy/normal/hard/extreme)
 * @param isTutorial 튜토리얼 모드 여부 (약한 보스 1마리만)
 */
export function createBosses(
  destroyedBases: EnemyBase[],
  playerCount: number,
  difficulty: RPGDifficulty = 'easy',
  isTutorial: boolean = false
): RPGEnemy[] {
  const bosses: RPGEnemy[] = [];

  // 튜토리얼 모드: 첫 번째 파괴된 기지에서 약한 보스 1마리만 스폰
  if (isTutorial) {
    const firstDestroyedBase = destroyedBases.find(b => b.destroyed);
    if (firstDestroyedBase) {
      const boss = createTutorialBoss(firstDestroyedBase.id, firstDestroyedBase.x, firstDestroyedBase.y);
      bosses.push(boss);
    }
    return bosses;
  }

  // 일반 모드: 모든 파괴된 기지에서 보스 스폰
  for (const base of destroyedBases) {
    if (base.destroyed) {
      const boss = createBoss(base.id, base.x, base.y, playerCount, difficulty);
      bosses.push(boss);
    }
  }

  return bosses;
}

/**
 * 튜토리얼용 약한 보스 생성
 */
function createTutorialBoss(
  baseId: EnemyBaseId,
  spawnX: number,
  spawnY: number
): RPGEnemy {
  const baseAIConfig = ENEMY_AI_CONFIGS.boss;

  // 튜토리얼 보스 스탯 (약한 보스)
  const bossHp = TUTORIAL_BOSS_CONFIG.hp;
  const bossDamage = TUTORIAL_BOSS_CONFIG.attack;

  // AI 설정
  const aiConfig: EnemyAIConfig = {
    detectionRange: baseAIConfig.detectionRange,
    attackRange: baseAIConfig.attackRange,
    moveSpeed: baseAIConfig.moveSpeed * 0.8,
    attackDamage: bossDamage,
    attackSpeed: baseAIConfig.attackSpeed * 1.2,
  };

  // RPG용 보스 config 생성
  const bossConfig = {
    name: '튜토리얼 보스',
    cost: {},
    hp: bossHp,
    attack: bossDamage,
    attackSpeed: 2.0,
    speed: 1.5,
    range: baseAIConfig.attackRange,
    type: 'combat' as const,
  };

  return {
    id: `boss_tutorial_${generateId()}`,
    type: 'boss',
    config: bossConfig,
    x: spawnX,
    y: spawnY,
    hp: bossHp,
    maxHp: bossHp,
    state: 'idle',
    attackCooldown: 0,
    team: 'enemy',
    goldReward: 100,
    targetHero: false,
    aiConfig,
    buffs: [],
    fromBase: baseId,
    aggroOnHero: false,
    damagedBy: [],
    bossSkills: [], // 튜토리얼 보스는 스킬 없음
  };
}

/**
 * 보스 유닛 생성
 * @param playerCount 플레이어 수 (1~4)
 * @param difficulty 난이도 (easy/normal/hard/extreme)
 */
export function createBoss(
  baseId: EnemyBaseId,
  spawnX: number,
  spawnY: number,
  playerCount: number,
  difficulty: RPGDifficulty = 'easy'
): RPGEnemy {
  const rpgBossConfig = RPG_ENEMY_CONFIGS.boss;
  const baseAIConfig = ENEMY_AI_CONFIGS.boss;
  const difficultyConfig = DIFFICULTY_CONFIGS[difficulty];

  // 플레이어 수에 따른 보스 스탯 (고정값) + 난이도 배율 적용
  const clampedPlayerCount = Math.max(1, Math.min(4, playerCount));
  const baseBossHp = BOSS_CONFIG.HP_BY_PLAYER_COUNT[clampedPlayerCount] || BOSS_CONFIG.HP_BY_PLAYER_COUNT[1];
  const baseBossDamage = BOSS_CONFIG.DAMAGE_BY_PLAYER_COUNT[clampedPlayerCount] || BOSS_CONFIG.DAMAGE_BY_PLAYER_COUNT[1];

  // 난이도 배율 적용
  const bossHp = Math.floor(baseBossHp * difficultyConfig.bossHpMultiplier);
  const bossDamage = Math.floor(baseBossDamage * difficultyConfig.bossAttackMultiplier);

  // 골드 보상에도 난이도 보상 배율 적용
  const goldReward = Math.floor(BOSS_CONFIG.GOLD_REWARD * difficultyConfig.goldRewardMultiplier);

  // AI 설정
  const aiConfig: EnemyAIConfig = {
    detectionRange: baseAIConfig.detectionRange,
    attackRange: baseAIConfig.attackRange,
    moveSpeed: baseAIConfig.moveSpeed * 0.8, // 보스는 약간 느림
    attackDamage: bossDamage,
    attackSpeed: baseAIConfig.attackSpeed * 1.2, // 공격 속도 약간 느림
  };

  // RPG용 보스 config 생성
  const bossConfig = {
    name: baseId === 'left' ? '왼쪽 보스' : '오른쪽 보스',
    cost: {},
    hp: rpgBossConfig.hp,
    attack: rpgBossConfig.attack,
    attackSpeed: rpgBossConfig.attackSpeed,
    speed: rpgBossConfig.speed,
    range: baseAIConfig.attackRange,
    type: 'combat' as const,
  };

  // 난이도별 보스 스킬 생성
  const bossSkills = createBossSkills(difficulty);

  return {
    id: `boss_${baseId}_${generateId()}`,
    type: 'boss',
    config: bossConfig,
    x: spawnX,
    y: spawnY,
    hp: bossHp,
    maxHp: bossHp,
    state: 'idle',
    attackCooldown: 0,
    team: 'enemy',
    goldReward,
    targetHero: false,
    aiConfig,
    buffs: [],
    fromBase: baseId,
    aggroOnHero: false, // 초기에는 넥서스를 향해 이동, 공격받으면 어그로
    damagedBy: [], // 데미지 관여자 추적 (멀티플레이 골드 분배용)
    bossSkills,    // 난이도별 보스 스킬
  };
}

/**
 * 난이도에 따른 보스 스킬 목록 생성
 */
function createBossSkills(difficulty: RPGDifficulty): BossSkill[] {
  const skillTypes = DIFFICULTY_BOSS_SKILLS[difficulty];
  return skillTypes.map(type => {
    const config = BOSS_SKILL_CONFIGS[type];
    return {
      type,
      cooldown: config.cooldown,
      currentCooldown: config.cooldown * 0.5, // 초기 쿨다운 (50%로 시작)
      damage: config.damage,
      radius: config.radius,
      angle: config.angle,
      castTime: config.castTime,
      stunDuration: config.stunDuration,
      summonCount: config.summonCount,
      hpThreshold: config.hpThreshold,
      knockbackDistance: config.knockbackDistance,
      oneTimeUse: config.oneTimeUse,
      used: false,
      chargeDistance: config.chargeDistance,
      healPercent: config.healPercent,
    };
  });
}

/**
 * 모든 보스가 죽었는지 확인
 */
export function areAllBossesDead(enemies: RPGEnemy[]): boolean {
  const bosses = enemies.filter(e => e.type === 'boss');
  if (bosses.length === 0) return true;
  return bosses.every(b => b.hp <= 0);
}

/**
 * 보스 수 확인
 */
export function getBossCount(enemies: RPGEnemy[]): { total: number; alive: number } {
  const bosses = enemies.filter(e => e.type === 'boss');
  const aliveBosses = bosses.filter(b => b.hp > 0);
  return {
    total: bosses.length,
    alive: aliveBosses.length,
  };
}

/**
 * 보스가 존재하는지 확인
 */
export function hasBosses(enemies: RPGEnemy[]): boolean {
  return enemies.some(e => e.type === 'boss' && e.hp > 0);
}

/**
 * 보스 단계가 완료되었는지 확인 (두 기지 파괴 후 보스 2마리 처치)
 */
export function isBossPhaseComplete(
  enemies: RPGEnemy[],
  bossesSpawned: boolean
): boolean {
  if (!bossesSpawned) return false;
  return areAllBossesDead(enemies);
}

// ============================================
// 보스 스킬 시스템
// ============================================

export interface BossSkillResult {
  updatedBoss: RPGEnemy;
  newWarnings: BossSkillWarning[];
  heroDamages: Map<string, number>;  // heroId -> damage
  stunnedHeroes: Map<string, number>; // heroId -> stun duration
  summonedEnemies: RPGEnemy[];
  skillExecuted: BossSkillType | null;
  knockbackHeroes: Map<string, { x: number; y: number }>; // heroId -> new position
  bossNewPosition?: { x: number; y: number }; // 보스 새 위치 (돌진용 - 즉시 이동)
  bossDashState?: DashState; // 보스 돌진 상태 (자연스러운 이동용)
  bossHeal?: number; // 보스 회복량
}

/**
 * 보스 스킬 쿨다운 업데이트 및 스킬 선택
 */
export function updateBossSkills(
  boss: RPGEnemy,
  heroes: HeroUnit[],
  gameTime: number,
  deltaTime: number
): BossSkillResult {
  const result: BossSkillResult = {
    updatedBoss: { ...boss },
    newWarnings: [],
    heroDamages: new Map(),
    stunnedHeroes: new Map(),
    summonedEnemies: [],
    skillExecuted: null,
    knockbackHeroes: new Map(),
  };

  if (!boss.bossSkills || boss.bossSkills.length === 0) {
    return result;
  }

  // 보스가 기절 상태면 스킬 사용 불가
  const isStunned = boss.buffs?.some(b => b.type === 'stun' && b.duration > 0);
  if (isStunned) {
    return result;
  }

  // 보스가 돌진 중이면 스킬 사용 불가
  if (boss.dashState && boss.dashState.progress < 1) {
    return result;
  }

  // 살아있는 영웅만 대상
  const aliveHeroes = heroes.filter(h => h.hp > 0);
  if (aliveHeroes.length === 0) {
    return result;
  }

  // 현재 시전 중인 스킬 처리
  if (boss.currentCast) {
    const castProgress = gameTime - boss.currentCast.startTime;
    if (castProgress >= boss.currentCast.castTime) {
      // 시전 완료 - 스킬 실행
      const executeResult = executeBossSkill(boss, boss.currentCast, aliveHeroes, gameTime);
      result.updatedBoss = executeResult.updatedBoss;
      result.heroDamages = executeResult.heroDamages;
      result.stunnedHeroes = executeResult.stunnedHeroes;
      result.summonedEnemies = executeResult.summonedEnemies;
      result.knockbackHeroes = executeResult.knockbackHeroes;
      result.bossNewPosition = executeResult.bossNewPosition;
      result.bossDashState = executeResult.bossDashState;
      result.bossHeal = executeResult.bossHeal;
      result.skillExecuted = boss.currentCast.skillType;
      result.updatedBoss.currentCast = undefined;

      // 강타 시전 완료 시 무적 버프 제거
      if (boss.currentCast.skillType === 'smash') {
        result.updatedBoss.buffs = (result.updatedBoss.buffs || []).filter(b => b.type !== 'invincible');
      }
    }
    return result;
  }

  // HP 비율 계산
  const hpRatio = boss.hp / boss.maxHp;

  // 스킬 쿨다운 감소 + HP 조건 첫 충족 시 쿨다운 리셋
  const updatedSkills = boss.bossSkills.map(skill => {
    let newCooldown = Math.max(0, skill.currentCooldown - deltaTime);
    let activated = skill.hpThresholdActivated || false;

    // HP 조건이 있고, 처음 충족되면 쿨다운 즉시 리셋
    if (skill.hpThreshold !== undefined && !activated && hpRatio <= skill.hpThreshold) {
      newCooldown = 0;
      activated = true;
    }

    return {
      ...skill,
      currentCooldown: newCooldown,
      hpThresholdActivated: activated,
    };
  });
  result.updatedBoss.bossSkills = updatedSkills;

  // 사용 가능한 스킬 선택
  const availableSkill = selectBossSkill(updatedSkills, hpRatio, aliveHeroes, boss);
  if (availableSkill) {
    // 스킬 시전 시작
    const nearestHero = findNearestHero(boss, aliveHeroes);
    const targetAngle = nearestHero
      ? Math.atan2(nearestHero.y - boss.y, nearestHero.x - boss.x)
      : 0;

    const cast: BossSkillCast = {
      skillType: availableSkill.type,
      startTime: gameTime,
      castTime: availableSkill.castTime || 1,
      targetX: nearestHero?.x ?? boss.x,
      targetY: nearestHero?.y ?? boss.y,
      targetAngle,
    };

    result.updatedBoss.currentCast = cast;
    result.updatedBoss.state = 'casting';

    // 강타 시전 중 무적 부여
    if (availableSkill.type === 'smash') {
      const invincibleBuff: Buff = {
        type: 'invincible',
        duration: availableSkill.castTime || 1,
        startTime: gameTime,
      };
      result.updatedBoss.buffs = [...(result.updatedBoss.buffs || []), invincibleBuff];
    }

    // 스킬 쿨다운 리셋 (1회용 스킬은 used 표시)
    result.updatedBoss.bossSkills = updatedSkills.map(skill =>
      skill.type === availableSkill.type
        ? { ...skill, currentCooldown: skill.cooldown, used: skill.oneTimeUse ? true : skill.used }
        : skill
    );

    // 경고 표시 생성
    const warning = createSkillWarning(boss, availableSkill, cast, gameTime);
    if (warning) {
      result.newWarnings.push(warning);
    }
  }

  return result;
}

/**
 * 가장 가까운 영웅 찾기
 */
function findNearestHero(boss: RPGEnemy, heroes: HeroUnit[]): HeroUnit | null {
  let nearest: HeroUnit | null = null;
  let minDist = Infinity;

  for (const hero of heroes) {
    const dist = distance(boss.x, boss.y, hero.x, hero.y);
    if (dist < minDist) {
      minDist = dist;
      nearest = hero;
    }
  }

  return nearest;
}

/**
 * 사용 가능한 스킬 선택 (쿨다운, HP 조건 확인)
 */
function selectBossSkill(
  skills: BossSkill[],
  hpRatio: number,
  _heroes: HeroUnit[],
  _boss: RPGEnemy
): BossSkill | null {
  // HP 조건을 만족하고 쿨다운이 끝난 스킬 중 선택
  const availableSkills = skills.filter(skill => {
    if (skill.currentCooldown > 0) return false;
    if (skill.hpThreshold !== undefined && hpRatio > skill.hpThreshold) return false;
    if (skill.oneTimeUse && skill.used) return false; // 1회용 스킬은 사용 후 제외

    return true;
  });

  if (availableSkills.length === 0) return null;

  // 우선순위: 회복 > 충격파 > 밀어내기 > 돌진 > 소환 > 강타
  const priorityOrder: BossSkillType[] = ['heal', 'shockwave', 'knockback', 'charge', 'summon', 'smash'];
  for (const type of priorityOrder) {
    const skill = availableSkills.find(s => s.type === type);
    if (skill) return skill;
  }

  return availableSkills[0];
}

/**
 * 스킬 경고 표시 생성
 */
function createSkillWarning(
  boss: RPGEnemy,
  skill: BossSkill,
  cast: BossSkillCast,
  gameTime: number
): BossSkillWarning | null {
  const config = BOSS_SKILL_CONFIGS[skill.type];

  const warning: BossSkillWarning = {
    id: `warning_${boss.id}_${skill.type}_${gameTime}`,
    skillType: skill.type,
    x: boss.x,
    y: boss.y,
    radius: config.radius,
    angle: cast.targetAngle,
    startTime: gameTime,
    duration: config.castTime,
  };

  // 돌진 스킬의 경우 경로 끝점 계산
  if (skill.type === 'charge' && config.chargeDistance) {
    const chargeAngle = cast.targetAngle ?? 0;
    const targetX = boss.x + Math.cos(chargeAngle) * config.chargeDistance;
    const targetY = boss.y + Math.sin(chargeAngle) * config.chargeDistance;
    // 맵 경계 내로 제한
    warning.targetX = Math.max(50, Math.min(2950, targetX));
    warning.targetY = Math.max(50, Math.min(1950, targetY));
  }

  return warning;
}

/**
 * 보스 스킬 실행
 */
function executeBossSkill(
  boss: RPGEnemy,
  cast: BossSkillCast,
  heroes: HeroUnit[],
  gameTime: number
): {
  updatedBoss: RPGEnemy;
  heroDamages: Map<string, number>;
  stunnedHeroes: Map<string, number>;
  summonedEnemies: RPGEnemy[];
  knockbackHeroes: Map<string, { x: number; y: number }>;
  bossNewPosition?: { x: number; y: number };
  bossDashState?: DashState;
  bossHeal?: number;
} {
  const heroDamages = new Map<string, number>();
  const stunnedHeroes = new Map<string, number>();
  const knockbackHeroes = new Map<string, { x: number; y: number }>();
  let summonedEnemies: RPGEnemy[] = [];
  let bossNewPosition: { x: number; y: number } | undefined;
  let bossDashState: DashState | undefined;
  let bossHeal: number | undefined;
  const updatedBoss = { ...boss };

  const config = BOSS_SKILL_CONFIGS[cast.skillType];
  const baseDamage = boss.aiConfig.attackDamage;

  switch (cast.skillType) {
    case 'smash': {
      // 강타: 전방 부채꼴 범위 공격
      const damage = Math.floor(baseDamage * config.damage);
      const targetAngle = cast.targetAngle ?? 0;

      for (const hero of heroes) {
        if (isInConeRange(boss.x, boss.y, hero.x, hero.y, config.radius, config.angle!, targetAngle)) {
          heroDamages.set(hero.id, damage);
          if (config.stunDuration) {
            stunnedHeroes.set(hero.id, config.stunDuration);
          }
        }
      }
      break;
    }

    case 'shockwave': {
      // 충격파: 전방위 원형 범위 공격
      const damage = Math.floor(baseDamage * config.damage);

      for (const hero of heroes) {
        const dist = distance(boss.x, boss.y, hero.x, hero.y);
        if (dist <= config.radius) {
          heroDamages.set(hero.id, damage);
        }
      }
      break;
    }

    case 'summon': {
      // 소환: 졸개 생성
      summonedEnemies = createSummonedEnemies(boss, config.summonCount || 2, gameTime);
      break;
    }

    case 'knockback': {
      // 밀어내기: 전방위 넉백
      const damage = Math.floor(baseDamage * config.damage);
      const knockbackDist = config.knockbackDistance || 700;

      for (const hero of heroes) {
        const dist = distance(boss.x, boss.y, hero.x, hero.y);
        if (dist <= config.radius) {
          // 데미지 적용
          heroDamages.set(hero.id, damage);

          // 밀어내기 위치 계산 (보스로부터 반대 방향으로)
          const angle = Math.atan2(hero.y - boss.y, hero.x - boss.x);
          const newX = hero.x + Math.cos(angle) * knockbackDist;
          const newY = hero.y + Math.sin(angle) * knockbackDist;

          // 맵 경계 내로 제한 (MAP: 3000x2000)
          const clampedX = Math.max(50, Math.min(2950, newX));
          const clampedY = Math.max(50, Math.min(1950, newY));

          knockbackHeroes.set(hero.id, { x: clampedX, y: clampedY });
        }
      }
      break;
    }

    case 'charge': {
      // 돌진: 타겟 방향으로 돌진하며 경로상 영웅에게 데미지
      const damage = Math.floor(baseDamage * config.damage);
      const chargeDist = config.chargeDistance || 300;
      const chargeAngle = cast.targetAngle ?? 0;
      const pathWidth = config.radius; // 경로 폭

      // 보스 새 위치 계산
      const newBossX = boss.x + Math.cos(chargeAngle) * chargeDist;
      const newBossY = boss.y + Math.sin(chargeAngle) * chargeDist;

      // 맵 경계 내로 제한
      const clampedBossX = Math.max(50, Math.min(2950, newBossX));
      const clampedBossY = Math.max(50, Math.min(1950, newBossY));

      // 자연스러운 이동을 위해 dashState 설정 (0.3초 동안 이동)
      const dashDuration = 0.3;
      const dirX = clampedBossX - boss.x;
      const dirY = clampedBossY - boss.y;
      const dirLen = Math.sqrt(dirX * dirX + dirY * dirY);

      bossDashState = {
        startX: boss.x,
        startY: boss.y,
        targetX: clampedBossX,
        targetY: clampedBossY,
        progress: 0,
        duration: dashDuration,
        dirX: dirLen > 0 ? dirX / dirLen : 0,
        dirY: dirLen > 0 ? dirY / dirLen : 0,
      };

      // 경로상 영웅에게 데미지 (선분과 점 사이 거리 계산)
      for (const hero of heroes) {
        const distToPath = distanceToLineSegment(
          boss.x, boss.y,
          clampedBossX, clampedBossY,
          hero.x, hero.y
        );
        if (distToPath <= pathWidth) {
          heroDamages.set(hero.id, damage);
        }
      }
      break;
    }

    case 'heal': {
      // 회복: 보스 자가 회복
      const healAmount = Math.floor(boss.maxHp * (config.healPercent || 0.1));
      bossHeal = healAmount;
      break;
    }
  }

  updatedBoss.state = 'idle';
  return { updatedBoss, heroDamages, stunnedHeroes, summonedEnemies, knockbackHeroes, bossNewPosition, bossDashState, bossHeal };
}

/**
 * 부채꼴 범위 내에 있는지 확인
 */
function isInConeRange(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  radius: number,
  coneAngle: number,
  facingAngle: number
): boolean {
  const dist = distance(sourceX, sourceY, targetX, targetY);
  if (dist > radius) return false;

  const angleToTarget = Math.atan2(targetY - sourceY, targetX - sourceX);
  let angleDiff = angleToTarget - facingAngle;

  // 각도 정규화 (-PI ~ PI)
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

  return Math.abs(angleDiff) <= coneAngle / 2;
}

/**
 * 점과 선분 사이의 최단 거리 계산 (돌진 경로 판정용)
 */
function distanceToLineSegment(
  x1: number, y1: number,  // 선분 시작점
  x2: number, y2: number,  // 선분 끝점
  px: number, py: number   // 점
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    // 선분이 점인 경우
    return distance(x1, y1, px, py);
  }

  // 선분 위 가장 가까운 점의 파라미터 t (0~1 범위로 클램프)
  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));

  // 선분 위 가장 가까운 점
  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;

  return distance(px, py, closestX, closestY);
}

/**
 * 소환된 졸개 생성
 */
function createSummonedEnemies(
  boss: RPGEnemy,
  count: number,
  _gameTime: number
): RPGEnemy[] {
  const enemies: RPGEnemy[] = [];
  const spawnRadius = 100;

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
    const spawnX = boss.x + Math.cos(angle) * spawnRadius;
    const spawnY = boss.y + Math.sin(angle) * spawnRadius;

    const knightConfig = RPG_ENEMY_CONFIGS.knight;
    const aiConfig = ENEMY_AI_CONFIGS.knight;

    const enemy: RPGEnemy = {
      id: `summoned_${boss.id}_${i}_${generateId()}`,
      type: 'knight',
      config: {
        name: '소환된 기사',
        cost: {},
        hp: knightConfig.hp,
        attack: knightConfig.attack,
        attackSpeed: knightConfig.attackSpeed,
        speed: knightConfig.speed,
        range: aiConfig.attackRange,
        type: 'combat' as const,
      },
      x: spawnX,
      y: spawnY,
      hp: Math.floor(knightConfig.hp * 0.7), // 소환 유닛은 HP 70%
      maxHp: Math.floor(knightConfig.hp * 0.7),
      state: 'idle',
      attackCooldown: 0,
      team: 'enemy',
      goldReward: 15, // 소환 유닛 골드 낮음
      targetHero: false,
      aiConfig: {
        ...aiConfig,
        attackDamage: Math.floor(knightConfig.attack * 0.8), // 공격력 80%
      },
      buffs: [],
      fromBase: boss.fromBase,
      aggroOnHero: true, // 소환되자마자 어그로
    };

    enemies.push(enemy);
  }

  return enemies;
}

/**
 * 영웅에게 스턴 적용
 */
export function applyStunToHero(
  hero: HeroUnit,
  stunDuration: number,
  gameTime: number
): HeroUnit {
  const stunBuff: Buff = {
    type: 'stun',
    duration: stunDuration,
    startTime: gameTime,
  };

  const existingBuffs = hero.buffs?.filter(b => b.type !== 'stun') || [];

  return {
    ...hero,
    buffs: [...existingBuffs, stunBuff],
    moveDirection: undefined, // 이동 중단
  };
}

/**
 * 보스 스킬 경고 업데이트 (만료된 경고 제거)
 */
export function updateBossSkillWarnings(
  warnings: BossSkillWarning[],
  gameTime: number
): BossSkillWarning[] {
  return warnings.filter(w => gameTime < w.startTime + w.duration);
}
