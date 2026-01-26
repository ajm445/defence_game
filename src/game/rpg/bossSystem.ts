import { RPGEnemy, EnemyBase, EnemyBaseId, EnemyAIConfig, RPGDifficulty, BossSkill, BossSkillType, BossSkillCast, BossSkillWarning, HeroUnit, Buff } from '../../types/rpg';
import { GOLD_CONFIG, ENEMY_AI_CONFIGS, NEXUS_CONFIG, DIFFICULTY_CONFIGS, RPG_ENEMY_CONFIGS, BOSS_SKILL_CONFIGS, DIFFICULTY_BOSS_SKILLS } from '../../constants/rpgConfig';
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
 * 보스 2마리 생성 (각 파괴된 기지 위치에서 스폰)
 * @param playerCount 플레이어 수 (1~4)
 * @param difficulty 난이도 (easy/normal/hard/extreme)
 */
export function createBosses(
  destroyedBases: EnemyBase[],
  playerCount: number,
  difficulty: RPGDifficulty = 'easy'
): RPGEnemy[] {
  const bosses: RPGEnemy[] = [];

  for (const base of destroyedBases) {
    if (base.destroyed) {
      const boss = createBoss(base.id, base.x, base.y, playerCount, difficulty);
      bosses.push(boss);
    }
  }

  return bosses;
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
  };

  if (!boss.bossSkills || boss.bossSkills.length === 0) {
    return result;
  }

  // 보스가 기절 상태면 스킬 사용 불가
  const isStunned = boss.buffs?.some(b => b.type === 'stun' && b.duration > 0);
  if (isStunned) {
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
      result.skillExecuted = boss.currentCast.skillType;
      result.updatedBoss.currentCast = undefined;

      // 강타 시전 완료 시 무적 버프 제거
      if (boss.currentCast.skillType === 'smash') {
        result.updatedBoss.buffs = (result.updatedBoss.buffs || []).filter(b => b.type !== 'invincible');
      }
    }
    return result;
  }

  // 스킬 쿨다운 감소
  const updatedSkills = boss.bossSkills.map(skill => ({
    ...skill,
    currentCooldown: Math.max(0, skill.currentCooldown - deltaTime),
  }));
  result.updatedBoss.bossSkills = updatedSkills;

  // HP 비율 계산
  const hpRatio = boss.hp / boss.maxHp;

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

    // 스킬 쿨다운 리셋
    result.updatedBoss.bossSkills = updatedSkills.map(skill =>
      skill.type === availableSkill.type
        ? { ...skill, currentCooldown: skill.cooldown }
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
  heroes: HeroUnit[],
  boss: RPGEnemy
): BossSkill | null {
  // HP 조건을 만족하고 쿨다운이 끝난 스킬 중 선택
  const availableSkills = skills.filter(skill => {
    if (skill.currentCooldown > 0) return false;
    if (skill.hpThreshold !== undefined && hpRatio > skill.hpThreshold) return false;

    // 소환 스킬은 주변에 영웅이 있을 때만 사용
    if (skill.type === 'summon') {
      const nearestDist = Math.min(...heroes.map(h => distance(boss.x, boss.y, h.x, h.y)));
      if (nearestDist > 400) return false; // 400px 이내에 영웅이 없으면 소환 안함
    }

    return true;
  });

  if (availableSkills.length === 0) return null;

  // 우선순위: 충격파 > 소환 > 강타
  const priorityOrder: BossSkillType[] = ['shockwave', 'summon', 'smash'];
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

  return {
    id: `warning_${boss.id}_${skill.type}_${gameTime}`,
    skillType: skill.type,
    x: boss.x,
    y: boss.y,
    radius: config.radius,
    angle: cast.targetAngle,
    startTime: gameTime,
    duration: config.castTime,
  };
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
} {
  const heroDamages = new Map<string, number>();
  const stunnedHeroes = new Map<string, number>();
  let summonedEnemies: RPGEnemy[] = [];
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
  }

  updatedBoss.state = 'idle';
  return { updatedBoss, heroDamages, stunnedHeroes, summonedEnemies };
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
