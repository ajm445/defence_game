/**
 * 서버 게임 설정 상수
 * 클라이언트의 rpgConfig.ts와 동일한 값들을 서버에서 사용
 */

import type { HeroClass, RPGDifficulty } from '../../../src/types/rpg';

// 넥서스 설정
export const NEXUS_CONFIG = {
  position: { x: 1500, y: 1000 },
  hp: 5000,
  radius: 80,
  laser: {
    range: 200,
    damage: 15,
    attackSpeed: 1.2,
  },
};

// 맵 설정
export const RPG_CONFIG = {
  MAP_WIDTH: 3000,
  MAP_HEIGHT: 2000,
};

// 골드 설정
export const GOLD_CONFIG = {
  REWARDS: {
    melee: 12,
    ranged: 18,
    knight: 35,
    mage: 45,
    boss: 500,
    boss2: 500,
  } as Record<string, number>,
  BASE_DESTROY_REWARDS: {
    easy: 50,
    normal: 100,
    hard: 200,
    extreme: 300,
    hell: 350,
    apocalypse: 500,
  } as Record<RPGDifficulty, number>,
  UPGRADE_BASE_COST: 50,
  STARTING_GOLD: 0,
  PASSIVE_GOLD_PER_SECOND: 2,
};

// 업그레이드 설정
export const UPGRADE_CONFIG = {
  attack: { perLevel: 5, description: '공격력' },
  speed: { perLevel: 0.08, description: '이동속도' },
  hp: { perLevel: 50, description: '최대 HP' },
  attackSpeed: { perLevel: 0.03, description: '공격속도' },
  goldRate: { perLevel: 1, description: '초당 골드' },
  range: { perLevel: 8, description: '사거리', maxLevel: 10 },
};

// 협동 모드 설정
export const COOP_CONFIG = {
  REVIVE: {
    BASE_TIME: 10,
    REVIVE_HP_PERCENT: 0.5,
    SPAWN_OFFSET: 100,
  },
  DIFFICULTY_SCALING: {
    1: 1.0,
    2: 1.5,
    3: 2.0,
    4: 2.5,
  } as Record<number, number>,
};

// 난이도 설정
export const DIFFICULTY_CONFIGS: Record<RPGDifficulty, {
  enemyHpMultiplier: number;
  enemyAttackMultiplier: number;
  spawnIntervalMultiplier: number;
  spawnCountMultiplier: number;
  goldRewardMultiplier: number;
  bossHpMultiplier: number;
  bossAttackMultiplier: number;
  enemyBaseHpMultiplier: number;
  unitTimeMultiplier: number;
  nexusHpMultiplier: number;
}> = {
  easy: {
    enemyHpMultiplier: 1.0,
    enemyAttackMultiplier: 1.0,
    spawnIntervalMultiplier: 1.0,
    spawnCountMultiplier: 1.0,
    goldRewardMultiplier: 1.0,
    bossHpMultiplier: 1.0,
    bossAttackMultiplier: 1.0,
    enemyBaseHpMultiplier: 1.0,
    unitTimeMultiplier: 1.0,
    nexusHpMultiplier: 1.0,
  },
  normal: {
    enemyHpMultiplier: 2.2,
    enemyAttackMultiplier: 1.6,
    spawnIntervalMultiplier: 0.9,
    spawnCountMultiplier: 1.4,
    goldRewardMultiplier: 1.3,
    bossHpMultiplier: 2.2,
    bossAttackMultiplier: 1.6,
    enemyBaseHpMultiplier: 2.2,
    unitTimeMultiplier: 1.3,
    nexusHpMultiplier: 1.0,
  },
  hard: {
    enemyHpMultiplier: 2.8,
    enemyAttackMultiplier: 2.2,
    spawnIntervalMultiplier: 0.8,
    spawnCountMultiplier: 2.0,
    goldRewardMultiplier: 1.6,
    bossHpMultiplier: 2.8,
    bossAttackMultiplier: 2.2,
    enemyBaseHpMultiplier: 2.8,
    unitTimeMultiplier: 1.6,
    nexusHpMultiplier: 1.0,
  },
  extreme: {
    enemyHpMultiplier: 4.0,
    enemyAttackMultiplier: 3.0,
    spawnIntervalMultiplier: 0.7,
    spawnCountMultiplier: 2.8,
    goldRewardMultiplier: 2.2,
    bossHpMultiplier: 4.0,
    bossAttackMultiplier: 3.0,
    enemyBaseHpMultiplier: 4.0,
    unitTimeMultiplier: 2.0,
    nexusHpMultiplier: 1.0,
  },
  hell: {
    enemyHpMultiplier: 4.5,
    enemyAttackMultiplier: 3.3,
    spawnIntervalMultiplier: 0.65,
    spawnCountMultiplier: 3.2,
    goldRewardMultiplier: 2.5,
    bossHpMultiplier: 4.5,
    bossAttackMultiplier: 3.3,
    enemyBaseHpMultiplier: 4.5,
    unitTimeMultiplier: 2.2,
    nexusHpMultiplier: 1.5,
  },
  apocalypse: {
    enemyHpMultiplier: 6.0,
    enemyAttackMultiplier: 4.0,
    spawnIntervalMultiplier: 0.55,
    spawnCountMultiplier: 4.2,
    goldRewardMultiplier: 3.2,
    bossHpMultiplier: 6.0,
    bossAttackMultiplier: 4.0,
    enemyBaseHpMultiplier: 6.0,
    unitTimeMultiplier: 2.7,
    nexusHpMultiplier: 2.0,
  },
};

// 직업별 기본 스탯
export const CLASS_CONFIGS: Record<HeroClass, {
  hp: number;
  attack: number;
  attackSpeed: number;
  speed: number;
  range: number;
}> = {
  warrior: { hp: 500, attack: 40, attackSpeed: 1.0, speed: 3.0, range: 50 },
  archer: { hp: 350, attack: 35, attackSpeed: 0.8, speed: 3.5, range: 180 },
  knight: { hp: 700, attack: 30, attackSpeed: 1.2, speed: 2.5, range: 50 },
  mage: { hp: 300, attack: 50, attackSpeed: 1.5, speed: 3.0, range: 160 },
};

// 적 기지 설정
export const ENEMY_BASE_CONFIG = {
  positions: {
    left: { x: 200, y: 1000 },
    right: { x: 2800, y: 1000 },
  },
  hp: 2000,
  radius: 60,
};

// 적 AI 설정
export const ENEMY_AI_CONFIGS: Record<string, {
  detectionRange: number;
  attackRange: number;
  moveSpeed: number;
  attackDamage: number;
  attackSpeed: number;
}> = {
  melee: { detectionRange: 150, attackRange: 40, moveSpeed: 2.0, attackDamage: 15, attackSpeed: 1.0 },
  ranged: { detectionRange: 200, attackRange: 150, moveSpeed: 1.8, attackDamage: 12, attackSpeed: 1.2 },
  knight: { detectionRange: 180, attackRange: 50, moveSpeed: 1.5, attackDamage: 25, attackSpeed: 1.5 },
  mage: { detectionRange: 250, attackRange: 180, moveSpeed: 1.6, attackDamage: 30, attackSpeed: 2.0 },
  boss: { detectionRange: 300, attackRange: 80, moveSpeed: 1.2, attackDamage: 50, attackSpeed: 2.0 },
  boss2: { detectionRange: 400, attackRange: 250, moveSpeed: 1.0, attackDamage: 120, attackSpeed: 2.5 },
};

// RPG 적 설정
export const RPG_ENEMY_CONFIGS: Record<string, {
  name: string;
  hp: number;
  attack: number;
  attackSpeed: number;
  speed: number;
}> = {
  melee: { name: '근접병', hp: 100, attack: 15, attackSpeed: 1.0, speed: 2.0 },
  ranged: { name: '원거리병', hp: 80, attack: 12, attackSpeed: 1.2, speed: 1.8 },
  knight: { name: '기사', hp: 200, attack: 25, attackSpeed: 1.5, speed: 1.5 },
  mage: { name: '마법사', hp: 120, attack: 30, attackSpeed: 2.0, speed: 1.6 },
  boss: { name: '보스', hp: 3500, attack: 100, attackSpeed: 2.0, speed: 1.2 },
  boss2: { name: '암흑 마법사', hp: 2800, attack: 120, attackSpeed: 2.5, speed: 1.0 },
};

// 보스 스킬 설정 (클라이언트 rpgConfig.ts BOSS_SKILL_CONFIGS와 동일하게 유지)
export const BOSS_SKILL_CONFIGS: Record<string, {
  cooldown: number;
  damage: number;
  radius: number;
  angle?: number;
  castTime: number;
  stunDuration?: number;
  summonCount?: number;
  hpThreshold?: number;
  knockbackDistance?: number;
  oneTimeUse?: boolean;
  chargeDistance?: number;
  healPercent?: number;
  zoneDuration?: number;
  drainHealPercent?: number;
}> = {
  // 강타 - 전방 부채꼴 범위 공격
  smash: {
    cooldown: 8,              // 8초 쿨다운
    damage: 2.0,              // 200% 데미지
    radius: 150,              // 150px 반경
    angle: Math.PI * 2 / 3,   // 120도 부채꼴
    castTime: 1.0,            // 1초 시전
    stunDuration: 0.5,        // 0.5초 기절
  },
  // 충격파 - 전방위 범위 공격
  shockwave: {
    cooldown: 20,             // 20초 쿨다운
    damage: 1.5,              // 150% 데미지
    radius: 250,              // 250px 반경
    castTime: 1.5,            // 1.5초 시전
    hpThreshold: 0.5,         // HP 50% 이하부터 사용
  },
  // 소환 - 졸개 소환
  summon: {
    cooldown: 15,             // 15초 쿨다운
    damage: 0,                // 데미지 없음
    radius: 100,              // 100px 반경 내 소환
    castTime: 1.5,            // 1.5초 시전
    summonCount: 2,           // 2마리 소환
    hpThreshold: 0.7,         // HP 70% 이하부터 사용
  },
  // 밀어내기 - 전방위 넉백 (1회용)
  knockback: {
    cooldown: 18,             // 쿨다운 (1회용이므로 의미 없음)
    damage: 0,                // 데미지 없음 (넉백만)
    radius: 200,              // 200px 반경
    castTime: 1.0,            // 1초 시전
    hpThreshold: 0.5,         // HP 50% 이하부터 사용
    knockbackDistance: 700,   // 700px 밀어내기
    oneTimeUse: true,         // 한 번만 사용
  },
  // 돌진 - 타겟 방향으로 돌진
  charge: {
    cooldown: 10,             // 10초 쿨다운
    damage: 2.0,              // 200% 데미지
    radius: 50,               // 경로 폭 50px
    castTime: 2.0,            // 2초 기 모으기
    hpThreshold: 0.9,         // HP 90% 이하부터 사용
    chargeDistance: 300,      // 300px 돌진
  },
  // 회복 - 자가 회복
  heal: {
    cooldown: 60,             // 60초 쿨다운
    damage: 0,                // 데미지 없음
    radius: 0,                // 범위 없음 (자신만)
    castTime: 3.0,            // 3초 시전
    hpThreshold: 0.6,         // HP 60% 이하부터 사용
    healPercent: 0.1,         // 최대 HP의 10% 회복
  },
  // Boss2 (암흑 마법사) 스킬
  dark_orb: {
    cooldown: 6,
    damage: 2.5,
    radius: 120,
    castTime: 1.0,
  },
  shadow_summon: {
    cooldown: 18,
    damage: 0,
    radius: 100,
    castTime: 1.5,
    summonCount: 3,
    hpThreshold: 0.7,
  },
  void_zone: {
    cooldown: 15,
    damage: 0.5,
    radius: 180,
    castTime: 1.5,
    zoneDuration: 5,
  },
  dark_meteor: {
    cooldown: 20,
    damage: 3.0,
    radius: 100,
    castTime: 2.0,
    hpThreshold: 0.5,
  },
  soul_drain: {
    cooldown: 12,
    damage: 1.5,
    radius: 200,
    castTime: 1.5,
    hpThreshold: 0.6,
    drainHealPercent: 0.05,
  },
  teleport: {
    cooldown: 10,
    damage: 0,
    radius: 0,
    castTime: 0.8,
    hpThreshold: 0.8,
  },
};

// 난이도별 보스 스킬 (클라이언트 rpgConfig.ts와 동일)
export const DIFFICULTY_BOSS_SKILLS: Record<RPGDifficulty, string[]> = {
  easy: [],                                       // 쉬움: 스킬 없음 (기본 공격만)
  normal: ['smash', 'summon'],                    // 중간: 강타 + 소환
  hard: ['smash', 'summon', 'knockback', 'heal'], // 어려움: 강타 + 소환 + 밀어내기 + 회복
  extreme: ['smash', 'summon', 'shockwave', 'knockback', 'charge', 'heal'], // 극한: 모든 스킬
  hell: ['smash', 'summon', 'shockwave', 'knockback', 'charge', 'heal'],    // 지옥: 모든 스킬
  apocalypse: ['smash', 'summon', 'shockwave', 'knockback', 'charge', 'heal'], // 종말: 모든 스킬
};

// 난이도별 Boss2 스킬
export const DIFFICULTY_BOSS2_SKILLS: Record<RPGDifficulty, string[]> = {
  easy: [],
  normal: [],
  hard: [],
  extreme: [],
  hell: ['dark_orb', 'shadow_summon', 'void_zone', 'dark_meteor', 'soul_drain', 'teleport'],
  apocalypse: ['dark_orb', 'shadow_summon', 'void_zone', 'dark_meteor', 'soul_drain', 'teleport'],
};

// 스폰 설정
export const SPAWN_CONFIG = {
  BASE_INTERVAL: 4.0,
  MIN_INTERVAL: 1.5,
  INTERVAL_DECREASE_PER_MINUTE: 0.2,
  getEnemyTypesForTime: (minutes: number, unitTimeMultiplier: number = 1.0): { type: string; weight: number }[] => {
    const adjustedMinutes = minutes * unitTimeMultiplier;
    if (adjustedMinutes < 2) return [{ type: 'melee', weight: 1 }];
    if (adjustedMinutes < 4) return [{ type: 'melee', weight: 3 }, { type: 'ranged', weight: 1 }];
    if (adjustedMinutes < 6) return [{ type: 'melee', weight: 2 }, { type: 'ranged', weight: 2 }, { type: 'knight', weight: 1 }];
    return [{ type: 'melee', weight: 2 }, { type: 'ranged', weight: 2 }, { type: 'knight', weight: 2 }, { type: 'mage', weight: 1 }];
  },
};

// 2차 강화 스탯 배율
export const SECOND_ENHANCEMENT_MULTIPLIER = 1.2;

// 패시브 시스템 상수
export const PASSIVE_UNLOCK_LEVEL = 5;      // 기본 패시브 활성화 레벨

// 패시브 성장 설정 (직업별)
export const PASSIVE_GROWTH_CONFIGS: Record<HeroClass, {
  type: 'lifesteal' | 'multiTarget' | 'hpRegen' | 'bossDamageBonus';
  startValue: number;
  growthPerLevel: number;
  maxValue: number;
  overflowType: 'attack' | 'maxHp';
  overflowPerLevel: number;
  baseChance?: number;
}> = {
  warrior: {
    type: 'lifesteal',
    startValue: 0,
    growthPerLevel: 0.005,   // +0.5%/레벨
    maxValue: 0.5,           // 50% 최대
    overflowType: 'attack',
    overflowPerLevel: 0.005,
  },
  archer: {
    type: 'multiTarget',
    startValue: 0,
    baseChance: 0.2,         // 첫 활성화 시 20% 확률
    growthPerLevel: 0.005,   // +0.5%/레벨
    maxValue: 1.0,           // 100% 최대
    overflowType: 'attack',
    overflowPerLevel: 0.005,
  },
  knight: {
    type: 'hpRegen',
    startValue: 0,
    growthPerLevel: 5,       // +5/초/레벨
    maxValue: 200,           // 200/초 최대
    overflowType: 'maxHp',
    overflowPerLevel: 0.005,
  },
  mage: {
    type: 'bossDamageBonus',
    startValue: 0,
    growthPerLevel: 0.01,    // +1%/레벨
    maxValue: 1.0,           // 100% 최대
    overflowType: 'attack',
    overflowPerLevel: 0.01,
  },
};

// 패시브 레벨 계산 (캐릭터 레벨 기반)
export function calculatePassiveLevelFromCharacter(characterLevel: number): number {
  if (characterLevel < PASSIVE_UNLOCK_LEVEL) {
    return 0;
  }
  return characterLevel - PASSIVE_UNLOCK_LEVEL + 1;
}

// 패시브 값 계산
export function calculatePassiveValue(heroClass: HeroClass, level: number): { currentValue: number; overflowBonus: number } {
  if (level <= 0) {
    return { currentValue: 0, overflowBonus: 0 };
  }

  const config = PASSIVE_GROWTH_CONFIGS[heroClass];

  // 궁수: 첫 활성화 시 baseChance, 이후 성장
  let rawValue: number;
  if (heroClass === 'archer' && config.baseChance !== undefined) {
    rawValue = config.baseChance + (level - 1) * config.growthPerLevel;
  } else {
    rawValue = config.startValue + level * config.growthPerLevel;
  }

  // 최대값 초과 여부 확인
  if (rawValue <= config.maxValue) {
    return { currentValue: rawValue, overflowBonus: 0 };
  }

  // 초과 보너스 계산
  const overflowLevels = Math.floor((rawValue - config.maxValue) / config.growthPerLevel);
  const overflowBonus = overflowLevels * config.overflowPerLevel;

  return {
    currentValue: config.maxValue,
    overflowBonus,
  };
}

// 캐릭터 레벨에서 패시브 상태 가져오기
export function getPassiveFromCharacterLevel(heroClass: HeroClass, characterLevel: number): { level: number; currentValue: number; overflowBonus: number } {
  const passiveLevel = calculatePassiveLevelFromCharacter(characterLevel);
  if (passiveLevel <= 0) {
    return { level: 0, currentValue: 0, overflowBonus: 0 };
  }
  const { currentValue, overflowBonus } = calculatePassiveValue(heroClass, passiveLevel);
  return { level: passiveLevel, currentValue, overflowBonus };
}

// SP 스탯 업그레이드 설정
export const STAT_UPGRADE_CONFIG = {
  attack: { perLevel: 5, maxLevel: 30 },
  speed: { perLevel: 0.1, maxLevel: 30 },
  hp: { perLevel: 35, maxLevel: 30 },
  attackSpeed: { perLevel: 0.02, maxLevel: 30 },
  range: { perLevel: 5, maxLevel: 30 },
  hpRegen: { perLevel: 1, maxLevel: 30 },
  skillCooldown: { perLevel: 1, maxLevel: 50 },
};

// SP 스탯 보너스 계산 (2차 강화 전: maxLevel 제한, 2차 강화 후: 제한 해제)
export function getStatBonus(upgradeType: keyof typeof STAT_UPGRADE_CONFIG, level: number, tier?: number): number {
  const config = STAT_UPGRADE_CONFIG[upgradeType];
  const clampedLevel = tier === 2 ? level : Math.min(level, config.maxLevel);
  return config.perLevel * clampedLevel;
}

// 전직 클래스 타입
export type AdvancedHeroClass = 'berserker' | 'guardian' | 'sniper' | 'ranger' | 'paladin' | 'darkKnight' | 'archmage' | 'healer';

// 전직 클래스 설정
export const ADVANCED_CLASS_CONFIGS: Record<AdvancedHeroClass, {
  name: string;
  baseClass: HeroClass;
  stats: { hp: number; attack: number; attackSpeed: number; speed: number; range: number };
  specialEffects: Record<string, any>;
}> = {
  berserker: {
    name: '버서커',
    baseClass: 'warrior',
    stats: { hp: 440, attack: 68, attackSpeed: 0.77, speed: 3.08, range: 80 },
    specialEffects: { lifestealMultiplier: 1.3 },
  },
  guardian: {
    name: '가디언',
    baseClass: 'warrior',
    stats: { hp: 640, attack: 50, attackSpeed: 0.95, speed: 2.94, range: 80 },
    specialEffects: { damageReduction: 0.3 },
  },
  sniper: {
    name: '저격수',
    baseClass: 'archer',
    stats: { hp: 308, attack: 64, attackSpeed: 0.71, speed: 3.3, range: 280 },
    specialEffects: { critChance: 0.5 },
  },
  ranger: {
    name: '레인저',
    baseClass: 'archer',
    stats: { hp: 336, attack: 48, attackSpeed: 0.54, speed: 3.45, range: 198 },
    specialEffects: { multiTarget: 5 },
  },
  paladin: {
    name: '팔라딘',
    baseClass: 'knight',
    stats: { hp: 770, attack: 46, attackSpeed: 1.0, speed: 2.64, range: 84 },
    specialEffects: { healAlly: true, basicAttackHeal: { range: 200, healPercent: 0.05 } },
  },
  darkKnight: {
    name: '다크나이트',
    baseClass: 'knight',
    stats: { hp: 688, attack: 56, attackSpeed: 0.96, speed: 2.64, range: 84 },
    specialEffects: { lifesteal: 0.2 },
  },
  archmage: {
    name: '대마법사',
    baseClass: 'mage',
    stats: { hp: 253, attack: 102, attackSpeed: 1.27, speed: 2.94, range: 300 },
    specialEffects: { bossBonus: 0.5 },
  },
  healer: {
    name: '힐러',
    baseClass: 'mage',
    stats: { hp: 322, attack: 63, attackSpeed: 1.22, speed: 3.08, range: 252 },
    specialEffects: { healAlly: true, healAura: { radius: 150, healPerSecond: 0.04 } },
  },
};
