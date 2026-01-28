import { UnitType } from '../types/unit';
import { SkillType, ExpTable, LevelUpBonus, WaveConfig, HeroClass, ClassConfig, EnemyAIConfig, GoldTable, RPGDifficulty, DifficultyConfig, BossSkillType, BossSkill, AdvancedHeroClass } from '../types/rpg';

// ============================================
// 난이도 설정
// ============================================

export const DIFFICULTY_CONFIGS: Record<RPGDifficulty, DifficultyConfig> = {
  easy: {
    id: 'easy',
    name: '쉬움',
    nameEn: 'Easy',
    description: '기본 난이도',
    enemyHpMultiplier: 1.0,
    enemyAttackMultiplier: 1.0,
    spawnIntervalMultiplier: 1.0,
    spawnCountMultiplier: 1.0,    // 기본 스폰 수
    goldRewardMultiplier: 1.0,
    expRewardMultiplier: 1.0,     // 기본 경험치
    bossHpMultiplier: 1.0,
    bossAttackMultiplier: 1.0,
    enemyBaseHpMultiplier: 1.0,
  },
  normal: {
    id: 'normal',
    name: '중간',
    nameEn: 'Normal',
    description: '적 강화, 보상 증가',
    enemyHpMultiplier: 1.3,
    enemyAttackMultiplier: 1.2,
    spawnIntervalMultiplier: 0.9,
    spawnCountMultiplier: 1.2,    // 스폰 수 20% 증가
    goldRewardMultiplier: 1.15,
    expRewardMultiplier: 1.2,     // 경험치 20% 증가
    bossHpMultiplier: 1.3,
    bossAttackMultiplier: 1.2,
    enemyBaseHpMultiplier: 1.3,
  },
  hard: {
    id: 'hard',
    name: '어려움',
    nameEn: 'Hard',
    description: '도전적인 난이도',
    enemyHpMultiplier: 1.6,
    enemyAttackMultiplier: 1.4,
    spawnIntervalMultiplier: 0.85,
    spawnCountMultiplier: 1.5,    // 스폰 수 50% 증가
    goldRewardMultiplier: 1.3,
    expRewardMultiplier: 1.5,     // 경험치 50% 증가
    bossHpMultiplier: 1.6,
    bossAttackMultiplier: 1.4,
    enemyBaseHpMultiplier: 1.6,
  },
  extreme: {
    id: 'extreme',
    name: '극한',
    nameEn: 'Extreme',
    description: '최고의 도전',
    enemyHpMultiplier: 2.0,
    enemyAttackMultiplier: 1.8,
    spawnIntervalMultiplier: 0.8,
    spawnCountMultiplier: 2.0,    // 스폰 수 2배
    goldRewardMultiplier: 1.5,
    expRewardMultiplier: 2.0,     // 경험치 2배
    bossHpMultiplier: 2.0,
    bossAttackMultiplier: 1.8,
    enemyBaseHpMultiplier: 2.0,
  },
};

// 패시브 시스템 상수
export const PASSIVE_UNLOCK_LEVEL = 5;      // 기본 패시브 활성화 레벨
export const PASSIVE_UNLOCK_WAVE = 10;      // 패시브 성장 활성화 웨이브
export const PASSIVE_GROWTH_INTERVAL = 10;  // 성장 간격 (10웨이브마다)

// 패시브 성장 설정 (직업별)
export interface PassiveGrowthConfig {
  type: 'lifesteal' | 'multiTarget' | 'hpRegen' | 'bossDamageBonus';
  startValue: number;      // 시작 값
  growthPerLevel: number;  // 레벨당 성장량
  maxValue: number;        // 최대 값
  overflowType: 'attack' | 'maxHp';  // 초과 보너스 유형
  overflowPerLevel: number; // 초과 시 레벨당 보너스 (%)
  // 궁수 전용
  baseChance?: number;     // 다중타겟 기본 확률 (첫 활성화 시)
}

export const PASSIVE_GROWTH_CONFIGS: Record<HeroClass, PassiveGrowthConfig> = {
  warrior: {
    type: 'lifesteal',
    startValue: 0,
    growthPerLevel: 0.005,   // +0.5%/레벨
    maxValue: 0.5,           // 50% 최대
    overflowType: 'attack',
    overflowPerLevel: 0.005, // 초과 시 공격력 +0.5%
  },
  archer: {
    type: 'multiTarget',
    startValue: 0,
    baseChance: 0.2,         // 첫 활성화 시 20% 확률
    growthPerLevel: 0.005,   // +0.5%/레벨
    maxValue: 1.0,           // 100% 최대 (항상 발동)
    overflowType: 'attack',
    overflowPerLevel: 0.005, // 초과 시 공격력 +0.5%
  },
  knight: {
    type: 'hpRegen',
    startValue: 0,
    growthPerLevel: 5,       // +5/초/레벨
    maxValue: 200,           // 200/초 최대
    overflowType: 'maxHp',
    overflowPerLevel: 0.005, // 초과 시 체력 +0.5%
  },
  mage: {
    type: 'bossDamageBonus',
    startValue: 0,
    growthPerLevel: 0.01,    // +1%/레벨
    maxValue: 1.0,           // 100% 최대
    overflowType: 'attack',
    overflowPerLevel: 0.01,  // 초과 시 공격력 +1%
  },
};

// ============================================
// 골드 시스템 설정
// ============================================

export const GOLD_CONFIG = {
  // 적 처치 시 골드 보상 (상향 조정)
  REWARDS: {
    melee: 12,
    ranged: 18,
    knight: 35,
    mage: 45,
    boss: 500,
  } as GoldTable,

  // 적 기지 파괴 시 골드 보상 (난이도별)
  BASE_DESTROY_REWARDS: {
    easy: 50,
    normal: 100,
    hard: 200,
    extreme: 300,
  } as Record<RPGDifficulty, number>,

  // 업그레이드 기본 비용 (1레벨 고정, 이후 레벨 비례 증가)
  UPGRADE_BASE_COST: 50,

  // 시작 골드
  STARTING_GOLD: 0,

  // 초당 자동 골드 수급 (goldRate 업그레이드 보너스 적용됨)
  PASSIVE_GOLD_PER_SECOND: 2,
} as const;

// 업그레이드 설정 (레벨당 보너스)
export const UPGRADE_CONFIG = {
  attack: {
    perLevel: 5,           // 레벨당 +5 공격력
    description: '공격력',
  },
  speed: {
    perLevel: 0.08,        // 레벨당 +0.08 이동속도
    description: '이동속도',
  },
  hp: {
    perLevel: 25,          // 레벨당 +25 최대 HP
    description: '최대 HP',
  },
  attackSpeed: {
    perLevel: 0.03,        // 레벨당 -0.03초 공격속도 (더 빠른 공격)
    description: '공격속도',
  },
  goldRate: {
    perLevel: 1,           // 레벨당 +1 초당 골드
    description: '초당 골드',
  },
  range: {
    perLevel: 8,           // 레벨당 +8 사거리
    description: '사거리',
    maxLevel: 10,          // 최대 10레벨 (80 사거리 증가)
  },
} as const;

// ============================================
// 넥서스 디펜스 설정
// ============================================

export const NEXUS_CONFIG = {
  position: {
    x: 1500,  // 맵 중앙 (MAP_WIDTH / 2)
    y: 1000,  // 맵 중앙 (MAP_HEIGHT / 2)
  },
  hp: 5000,
  radius: 80,  // 넥서스 크기
  // 넥서스 레이저 방어 시스템
  laser: {
    range: 200,         // 공격 범위 (넥서스 중심 기준)
    damage: 15,         // 기본 데미지 (약한 데미지)
    attackSpeed: 1.2,   // 공격 간격 (초)
  },
} as const;

export const ENEMY_BASE_CONFIG = {
  left: {
    x: 150,    // 왼쪽 끝
    y: 1000,   // 중앙 레인
    hp: 3000,
    radius: 60,
  },
  right: {
    x: 2850,   // 오른쪽 끝
    y: 1000,   // 중앙 레인
    hp: 3000,
    radius: 60,
  },
  top: {
    x: 1500,   // 맵 중앙 X
    y: 150,    // 상단 끝
    hp: 3000,
    radius: 60,
  },
  bottom: {
    x: 1500,   // 맵 중앙 X
    y: 1850,   // 하단 끝
    hp: 3000,
    radius: 60,
  },
} as const;

// 스폰 설정
export const SPAWN_CONFIG = {
  // 기본 스폰 간격 (초)
  BASE_INTERVAL: 4,
  // 분당 스폰 간격 감소 (최소 1.5초까지)
  INTERVAL_DECREASE_PER_MINUTE: 0.2,
  MIN_INTERVAL: 1.5,

  // 적 스탯 배율 (분당 10% 증가)
  STAT_MULTIPLIER_PER_MINUTE: 0.1,

  // 적 구성 (게임 시간에 따라 변화)
  getEnemyTypesForTime: (minutes: number): { type: UnitType; weight: number }[] => {
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
  },
} as const;

// 5분 마일스톤 보상
export const MILESTONE_CONFIG = {
  FIVE_MINUTE_BONUS_EXP: 100,  // 계정 경험치 보너스
} as const;

// ============================================
// 직업별 설정
// ============================================

// 직업별 설정
export const CLASS_CONFIGS: Record<HeroClass, ClassConfig> = {
  warrior: {
    name: '전사',
    nameEn: 'Warrior',
    emoji: '⚔️',
    description: '균형잡힌 스탯의 근접 전사',
    hp: 400,
    attack: 45,
    attackSpeed: 1.0,
    speed: 2.8,
    range: 80,
    passive: {
      lifesteal: 0.20, // 20% 피해흡혈
    },
  },
  archer: {
    name: '궁수',
    nameEn: 'Archer',
    emoji: '🏹',
    description: '기본 공격 중심의 원거리 딜러',
    hp: 280,
    attack: 40,
    attackSpeed: 0.75,
    speed: 3.0,
    range: 180,
    passive: {
      multiTarget: 3, // 기본 공격 3명 동시 공격
    },
  },
  knight: {
    name: '기사',
    nameEn: 'Knight',
    emoji: '🛡️',
    description: '높은 체력과 방어력의 탱커',
    hp: 550,
    attack: 40,
    attackSpeed: 1.1,
    speed: 2.4,
    range: 80,
    passive: {
      hpRegen: 10, // 초당 10 HP 재생
    },
  },
  mage: {
    name: '마법사',
    nameEn: 'Mage',
    emoji: '🔮',
    description: '높은 공격력과 범위 공격의 마법사',
    hp: 230,
    attack: 60,
    attackSpeed: 1.4,
    speed: 2.8,
    range: 210,
    passive: {
      bossDamageBonus: 0.25, // 보스에게 25% 데미지 증가
    },
  },
};

// 적 유형별 AI 설정
export const ENEMY_AI_CONFIGS: Record<UnitType, EnemyAIConfig> = {
  melee: {
    detectionRange: 300,
    attackRange: 60,
    moveSpeed: 2.25,
    attackDamage: 15,
    attackSpeed: 1.0,
  },
  ranged: {
    detectionRange: 450,
    attackRange: 150,
    moveSpeed: 2.4,
    attackDamage: 20,
    attackSpeed: 0.8,
  },
  knight: {
    detectionRange: 300,
    attackRange: 70,
    moveSpeed: 1.95,
    attackDamage: 12,
    attackSpeed: 1.2,
  },
  mage: {
    detectionRange: 450,
    attackRange: 180,
    moveSpeed: 2.1,
    attackDamage: 35,
    attackSpeed: 1.5,
  },
  boss: {
    detectionRange: 650,
    attackRange: 100,
    moveSpeed: 1.5,
    attackDamage: 50,
    attackSpeed: 2.0,
  },
  // 비전투 유닛 (기본값)
  woodcutter: { detectionRange: 0, attackRange: 0, moveSpeed: 1.0, attackDamage: 0, attackSpeed: 0 },
  miner: { detectionRange: 0, attackRange: 0, moveSpeed: 1.0, attackDamage: 0, attackSpeed: 0 },
  gatherer: { detectionRange: 0, attackRange: 0, moveSpeed: 1.0, attackDamage: 0, attackSpeed: 0 },
  goldminer: { detectionRange: 0, attackRange: 0, moveSpeed: 1.0, attackDamage: 0, attackSpeed: 0 },
  healer: { detectionRange: 0, attackRange: 0, moveSpeed: 1.0, attackDamage: 0, attackSpeed: 0 },
};

// RPG 모드 전용 적 기본 스탯 설정
export interface RPGEnemyConfig {
  name: string;
  hp: number;
  attack: number;
  attackSpeed: number;
  speed: number;
}

export const RPG_ENEMY_CONFIGS: Record<string, RPGEnemyConfig> = {
  melee: {
    name: '검병',
    hp: 100,
    attack: 15,
    attackSpeed: 1.0,
    speed: 2.25,
  },
  ranged: {
    name: '궁수',
    hp: 70,       // 50 → 70 (생존력 향상)
    attack: 18,   // 20 → 18 (약간 하향)
    attackSpeed: 0.8,
    speed: 2.4,
  },
  knight: {
    name: '기사',
    hp: 280,      // 300 → 280 (약간 하향)
    attack: 18,   // 12 → 18 (위협적으로)
    attackSpeed: 1.2,
    speed: 1.95,
  },
  mage: {
    name: '마법사',
    hp: 55,       // 40 → 55 (생존력 향상)
    attack: 30,   // 35 → 30 (약간 하향)
    attackSpeed: 1.5,
    speed: 2.1,
  },
  boss: {
    name: '보스',
    hp: 2000,
    attack: 50,
    attackSpeed: 2.0,
    speed: 1.5,
  },
};

// 직업별 스킬 설정
export const CLASS_SKILLS = {
  warrior: {
    q: {
      type: 'warrior_q' as SkillType,
      name: '강타',
      key: 'Q',
      cooldown: 1.0,
      description: '단일 대상에게 공격력 100% 데미지',
      damageMultiplier: 1.0,
    },
    w: {
      type: 'warrior_w' as SkillType,
      name: '돌진',
      key: 'W',
      cooldown: 5,
      description: '전방으로 돌진하며 경로상 적에게 공격력 150% 데미지 (돌진 후 2초 무적)',
      distance: 200,
      damageMultiplier: 1.5,
      invincibleDuration: 2.0,
    },
    e: {
      type: 'warrior_e' as SkillType,
      name: '광전사',
      key: 'E',
      cooldown: 30,
      description: '10초간 공격력 50%, 공격속도 30% 증가, 피해흡혈 50%',
      duration: 10,
      attackBonus: 0.5,
      speedBonus: 0.3,
      lifesteal: 0.5,
    },
  },
  archer: {
    q: {
      type: 'archer_q' as SkillType,
      name: '속사',
      key: 'Q',
      cooldown: 0.7,
      description: '원거리 단일 대상 공격',
      damageMultiplier: 1.0,
    },
    w: {
      type: 'archer_w' as SkillType,
      name: '관통 화살',
      key: 'W',
      cooldown: 8,
      description: '일직선 관통 공격 (공격력 150%)',
      damageMultiplier: 1.5,
      pierceDistance: 300,
    },
    e: {
      type: 'archer_e' as SkillType,
      name: '화살 비',
      key: 'E',
      cooldown: 30,
      description: '범위 내 모든 적에게 공격력 200% 데미지',
      damageMultiplier: 2.0,
      radius: 150,
    },
  },
  knight: {
    q: {
      type: 'knight_q' as SkillType,
      name: '방패 타격',
      key: 'Q',
      cooldown: 1.1,
      description: '근접 공격 (공격력 100%)',
      damageMultiplier: 1.0,
    },
    w: {
      type: 'knight_w' as SkillType,
      name: '방패 돌진',
      key: 'W',
      cooldown: 6,
      description: '전방 돌진하며 경로상 적에게 최대 HP 10% 데미지 + 2초 기절',
      distance: 150,
      hpDamagePercent: 0.1, // 최대 HP의 10% 데미지
      stunDuration: 2.0,
    },
    e: {
      type: 'knight_e' as SkillType,
      name: '철벽 방어',
      key: 'E',
      cooldown: 35,
      description: '5초간 받는 데미지 70% 감소, HP 20% 회복',
      duration: 5,
      damageReduction: 0.7,
      healPercent: 0.2,
    },
  },
  mage: {
    q: {
      type: 'mage_q' as SkillType,
      name: '마법 화살',
      key: 'Q',
      cooldown: 1.4,
      description: '원거리 마법 공격 (공격력 100%)',
      damageMultiplier: 1.0,
    },
    w: {
      type: 'mage_w' as SkillType,
      name: '화염구',
      key: 'W',
      cooldown: 7,
      description: '범위 공격 (공격력 180%)',
      damageMultiplier: 1.8,
      radius: 80,
    },
    e: {
      type: 'mage_e' as SkillType,
      name: '운석 낙하',
      key: 'E',
      cooldown: 40,
      description: '3초 후 대범위 공격 (공격력 300%)',
      damageMultiplier: 3.0,
      radius: 150,
      delay: 3.0,
    },
  },
};

export const RPG_CONFIG = {
  // 맵 설정 (넓은 맵 - 양쪽 레인 형태)
  MAP_WIDTH: 3000,
  MAP_HEIGHT: 2000,
  MAP_CENTER_X: 1500,
  MAP_CENTER_Y: 1000,

  // 시야 설정
  VISIBILITY: {
    RADIUS: 300,           // 플레이어 시야 반경
    CELL_SIZE: 50,         // 탐사 셀 크기
  },

  // 영웅 기본 스탯 (기본값, 직업별로 덮어씀)
  HERO: {
    HP: 300,
    ATTACK: 30,
    ATTACK_SPEED: 1,      // 초
    SPEED: 2.0,
    RANGE: 80,
  },

  // 레벨업 보너스 (기본값)
  LEVEL_UP_BONUS: {
    hp: 30,
    attack: 5,
    speed: 0.05,
  } as LevelUpBonus,

  // 직업별 레벨업 보너스 (기본값 덮어쓰기)
  CLASS_LEVEL_UP_BONUS: {
    warrior: { hp: 30, attack: 5, speed: 0.05 },
    archer: { hp: 30, attack: 5, speed: 0.05 },
    knight: { hp: 50, attack: 5, speed: 0.05 }, // 기사는 HP +50
    mage: { hp: 30, attack: 5, speed: 0.05 },
  } as Record<HeroClass, LevelUpBonus>,

  // 경험치 공식: 필요 경험치 = BASE + (레벨 * MULTIPLIER)
  EXP: {
    BASE: 50,
    MULTIPLIER: 30,
  },

  // 적 유닛별 경험치
  EXP_TABLE: {
    melee: 10,    // 검병
    ranged: 15,   // 궁수
    knight: 25,   // 기사
    mage: 30,     // 마법사
    boss: 200,    // 보스
  } as ExpTable,

  // 카메라 설정
  CAMERA: {
    MIN_ZOOM: 0.5,
    MAX_ZOOM: 2.0,
    DEFAULT_ZOOM: 1.0,
    ZOOM_SPEED: 0.1,
  },

  // 스폰 위치 (맵 가장자리)
  SPAWN_MARGIN: 50, // 맵 가장자리에서의 거리

  // 부활 시스템 (싱글/멀티플레이 공통)
  REVIVE: {
    BASE_TIME: 10,           // 기본 10초
    TIME_PER_WAVE: 2,        // 웨이브당 +2초
    MAX_TIME: 30,            // 최대 30초
    REVIVE_HP_PERCENT: 1.0,  // HP 100%로 부활 (풀피)
    SPAWN_OFFSET: 100,       // 넥서스 근처 100px 내 랜덤 위치
    INVINCIBLE_DURATION: 2.0, // 부활 후 무적 시간 (초)
  },
} as const;

// 웨이브 설정 생성 함수
export function generateWaveConfig(waveNumber: number): WaveConfig {
  const isBossWave = waveNumber % 10 === 0;

  // 적 구성 결정
  const enemies: { type: UnitType; count: number }[] = [];

  if (isBossWave) {
    // 보스 웨이브
    enemies.push({ type: 'boss', count: 1 });
    enemies.push({ type: 'melee', count: Math.floor(waveNumber / 2) });
  } else if (waveNumber <= 3) {
    // 웨이브 1~3: 검병만
    enemies.push({ type: 'melee', count: 3 + waveNumber * 2 });
  } else if (waveNumber <= 6) {
    // 웨이브 4~6: 검병 + 궁수
    enemies.push({ type: 'melee', count: 3 + waveNumber });
    enemies.push({ type: 'ranged', count: Math.floor(waveNumber / 2) });
  } else if (waveNumber <= 9) {
    // 웨이브 7~9: 검병 + 궁수 + 기사
    enemies.push({ type: 'melee', count: 2 + waveNumber });
    enemies.push({ type: 'ranged', count: Math.floor(waveNumber / 2) });
    enemies.push({ type: 'knight', count: Math.floor(waveNumber / 3) });
  } else {
    // 웨이브 11+: 패턴 반복 (스탯 강화는 별도 처리)
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

  // 스폰 간격 (웨이브가 진행될수록 빨라짐)
  const spawnInterval = Math.max(0.5, 2 - waveNumber * 0.1);

  return {
    waveNumber,
    enemies,
    spawnInterval,
    bossWave: isBossWave,
  };
}

// 웨이브별 적 스탯 배율 (10웨이브마다 강화)
export function getWaveStatMultiplier(waveNumber: number): number {
  return 1 + Math.floor(waveNumber / 10) * 0.3;
}

// 필요 경험치 계산
export function calculateExpToNextLevel(level: number): number {
  return RPG_CONFIG.EXP.BASE + (level * RPG_CONFIG.EXP.MULTIPLIER);
}

// 스폰 위치 생성 (맵 가장자리 4방향 중 랜덤)
export function getRandomSpawnPosition(): { x: number; y: number } {
  const margin = RPG_CONFIG.SPAWN_MARGIN;
  const side = Math.floor(Math.random() * 4); // 0: 상, 1: 하, 2: 좌, 3: 우

  switch (side) {
    case 0: // 상
      return {
        x: margin + Math.random() * (RPG_CONFIG.MAP_WIDTH - margin * 2),
        y: margin,
      };
    case 1: // 하
      return {
        x: margin + Math.random() * (RPG_CONFIG.MAP_WIDTH - margin * 2),
        y: RPG_CONFIG.MAP_HEIGHT - margin,
      };
    case 2: // 좌
      return {
        x: margin,
        y: margin + Math.random() * (RPG_CONFIG.MAP_HEIGHT - margin * 2),
      };
    case 3: // 우
    default:
      return {
        x: RPG_CONFIG.MAP_WIDTH - margin,
        y: margin + Math.random() * (RPG_CONFIG.MAP_HEIGHT - margin * 2),
      };
  }
}

export type RPGConfig = typeof RPG_CONFIG;

// ============================================
// 협동 모드 설정
// ============================================

export const COOP_CONFIG = {
  MAX_PLAYERS: 4,
  MIN_PLAYERS: 2,
  COUNTDOWN_SECONDS: 3,

  // 부활 시스템은 RPG_CONFIG.REVIVE 사용

  // 난이도 스케일링 (플레이어 수에 따른 적 체력 배율)
  DIFFICULTY_SCALING: {
    1: 1.0,
    2: 1.5,
    3: 2.0,
    4: 2.5,
  } as Record<number, number>,

  // 버프 공유
  BUFF_SHARE: {
    KNIGHT_HP_REGEN_RANGE: 150,    // 기사 HP 재생 공유 범위
    KNIGHT_HP_REGEN_RATIO: 0.5,    // 공유 시 50%만 적용
    WARRIOR_BERSERKER_RANGE: 200,  // 전사 광전사 버프 공유 범위
    WARRIOR_BERSERKER_ATK_BONUS: 0.2, // 공유 시 공격력 20% 증가
  },

  // 어그로 시스템
  AGGRO: {
    KNIGHT_BONUS: 2.0,          // 기사에게 어그로 보너스 x2
    LOW_HP_THRESHOLD: 0.3,      // HP 30% 미만 시
    LOW_HP_PRIORITY_BONUS: 1.5, // 낮은 HP 우선순위 보너스
    CURRENT_TARGET_BONUS: 1.2,  // 현재 타겟 유지 보너스
  },

  // 웨이브 대기 시간
  WAVE_DELAY: 5,
} as const;

export type CoopConfig = typeof COOP_CONFIG;

// ============================================
// 보스 스킬 설정
// ============================================

// 보스 스킬 기본 설정
export interface BossSkillConfig {
  type: BossSkillType;
  name: string;
  nameEn: string;
  cooldown: number;          // 기본 쿨다운 (초)
  damage: number;            // 데미지 배율 (보스 공격력 기준)
  radius: number;            // 범위 (px)
  angle?: number;            // 부채꼴 각도 (라디안, 강타용)
  castTime: number;          // 시전 시간 (초)
  stunDuration?: number;     // 기절 지속시간 (초)
  summonCount?: number;      // 소환 수 (소환용)
  hpThreshold?: number;      // HP 조건 (0~1, 이하일 때만 사용)
  knockbackDistance?: number; // 밀어내기 거리 (px)
  oneTimeUse?: boolean;       // 한 번만 사용 가능 여부
  chargeDistance?: number;    // 돌진 거리 (px)
  healPercent?: number;       // 회복량 (최대 HP 대비 %)
}

export const BOSS_SKILL_CONFIGS: Record<BossSkillType, BossSkillConfig> = {
  // 강타 - 전방 부채꼴 범위 공격
  smash: {
    type: 'smash',
    name: '강타',
    nameEn: 'Smash',
    cooldown: 8,              // 8초 쿨다운
    damage: 2.0,              // 200% 데미지
    radius: 150,              // 150px 반경
    angle: Math.PI * 2 / 3,   // 120도 부채꼴
    castTime: 1.0,            // 1초 시전
    stunDuration: 0.5,        // 0.5초 기절
  },
  // 소환 - 졸개 소환
  summon: {
    type: 'summon',
    name: '소환',
    nameEn: 'Summon',
    cooldown: 15,             // 15초 쿨다운
    damage: 0,                // 데미지 없음
    radius: 100,              // 100px 반경 내 소환
    castTime: 1.5,            // 1.5초 시전
    summonCount: 2,           // 2마리 소환
    hpThreshold: 0.7,         // HP 70% 이하부터 사용
  },
  // 충격파 - 전방위 범위 공격
  shockwave: {
    type: 'shockwave',
    name: '충격파',
    nameEn: 'Shockwave',
    cooldown: 20,             // 20초 쿨다운
    damage: 1.5,              // 150% 데미지
    radius: 250,              // 250px 반경
    castTime: 1.5,            // 1.5초 시전
    hpThreshold: 0.5,         // HP 50% 이하부터 사용
  },
  // 밀어내기 - 전방위 넉백 (1회용)
  knockback: {
    type: 'knockback',
    name: '밀어내기',
    nameEn: 'Knockback',
    cooldown: 18,             // 쿨다운 (1회용이므로 의미 없음)
    damage: 0.5,              // 50% 데미지 (약함)
    radius: 200,              // 200px 반경
    castTime: 1.0,            // 1초 시전
    hpThreshold: 0.5,         // HP 50% 이하부터 사용
    knockbackDistance: 700,   // 700px 밀어내기
    oneTimeUse: true,         // 한 번만 사용
  },
  // 돌진 - 타겟 방향으로 돌진
  charge: {
    type: 'charge',
    name: '돌진',
    nameEn: 'Charge',
    cooldown: 10,             // 10초 쿨다운
    damage: 2.0,              // 200% 데미지
    radius: 50,               // 경로 폭 50px
    castTime: 2.0,            // 2초 기 모으기
    hpThreshold: 0.9,         // HP 90% 이하부터 사용
    chargeDistance: 300,      // 300px 돌진
  },
  // 회복 - 자가 회복
  heal: {
    type: 'heal',
    name: '회복',
    nameEn: 'Heal',
    cooldown: 60,             // 60초 쿨다운
    damage: 0,                // 데미지 없음
    radius: 0,                // 범위 없음 (자신만)
    castTime: 3.0,            // 3초 시전
    hpThreshold: 0.6,         // HP 60% 이하부터 사용
    healPercent: 0.1,         // 최대 HP의 10% 회복
  },
};

// 난이도별 보스 스킬 활성화
export const DIFFICULTY_BOSS_SKILLS: Record<RPGDifficulty, BossSkillType[]> = {
  easy: [],                           // 쉬움: 스킬 없음 (기본 공격만)
  normal: ['smash', 'summon'],        // 중간: 강타 + 소환
  hard: ['smash', 'summon', 'knockback', 'heal'],  // 어려움: 강타 + 소환 + 밀어내기 + 회복
  extreme: ['smash', 'summon', 'shockwave', 'knockback', 'charge', 'heal'], // 극한: 모든 스킬
};

// ============================================
// 전직 시스템 설정
// ============================================

// 전직 조건
export const JOB_ADVANCEMENT_REQUIREMENTS = {
  minClassLevel: 15,  // 1차 전직 최소 레벨
  secondEnhancementLevel: 50,  // 2차 강화 레벨
} as const;

// 기본 직업 → 전직 직업 매핑
export const ADVANCEMENT_OPTIONS: Record<HeroClass, AdvancedHeroClass[]> = {
  warrior: ['berserker', 'guardian'],
  archer: ['sniper', 'ranger'],
  knight: ['paladin', 'darkKnight'],
  mage: ['archmage', 'healer'],
};

// 전직 직업 설정 (절대 스탯 값 사용)
export interface AdvancedClassConfig {
  name: string;
  nameEn: string;
  emoji: string;
  description: string;
  baseClass: HeroClass;
  // 절대 스탯 값 (1차 전직)
  stats: {
    hp: number;
    attack: number;
    attackSpeed: number;  // 공격 쿨다운 (초) - 낮을수록 빠름
    speed: number;
    range: number;
  };
  // 특수 효과
  specialEffects: {
    damageReduction?: number;      // 받는 피해 감소 (0.3 = 30%)
    lifestealMultiplier?: number;  // 피해흡혈 배율 (2.0 = 2배)
    lifesteal?: number;            // 고정 피해흡혈 (0.3 = 30%)
    critChance?: number;           // 크리티컬 확률 (0.5 = 50%)
    multiTarget?: number;          // 다중 타겟 수
    healAlly?: boolean;            // 아군 힐 가능
    bossBonus?: number;            // 보스 추가 데미지 (0.5 = 50%)
  };
}

// 2차 강화 스탯 배율 (1차 전직 스탯 × 1.2)
export const SECOND_ENHANCEMENT_MULTIPLIER = 1.2;

export const ADVANCED_CLASS_CONFIGS: Record<AdvancedHeroClass, AdvancedClassConfig> = {
  // ============================================
  // 전사 계열 (기본: hp=400, attack=45, attackSpeed=1.0, speed=2.8, range=80)
  // ============================================
  berserker: {
    name: '버서커',
    nameEn: 'Berserker',
    emoji: '🔥',
    description: '공격력과 공격속도에 특화된 광전사',
    baseClass: 'warrior',
    // HP +10%, 공격력 +50%, 공격속도 +30%, 속도 +10%
    stats: {
      hp: 440,           // 400 * 1.10
      attack: 68,        // 45 * 1.50
      attackSpeed: 0.77, // 1.0 / 1.30 (30% 빠름)
      speed: 3.08,       // 2.8 * 1.10
      range: 80,         // 변동 없음
    },
    specialEffects: {
      lifestealMultiplier: 2.0,  // 피해흡혈 2배
    },
  },
  guardian: {
    name: '가디언',
    nameEn: 'Guardian',
    emoji: '🛡️',
    description: '높은 방어력과 체력의 수호자',
    baseClass: 'warrior',
    // HP +60%, 공격력 +10%, 공격속도 +5%, 속도 +5%
    stats: {
      hp: 640,           // 400 * 1.60
      attack: 50,        // 45 * 1.10
      attackSpeed: 0.95, // 1.0 / 1.05 (5% 빠름)
      speed: 2.94,       // 2.8 * 1.05
      range: 80,         // 변동 없음
    },
    specialEffects: {
      damageReduction: 0.3,  // 받는 피해 30% 감소
    },
  },
  // ============================================
  // 궁수 계열 (기본: hp=280, attack=40, attackSpeed=0.75, speed=3.0, range=180)
  // ============================================
  sniper: {
    name: '저격수',
    nameEn: 'Sniper',
    emoji: '🎯',
    description: '높은 단일 공격력과 사거리의 저격수',
    baseClass: 'archer',
    // HP +10%, 공격력 +60%, 공격속도 +5%, 속도 +10%, 사거리 +50%
    stats: {
      hp: 308,           // 280 * 1.10
      attack: 64,        // 40 * 1.60
      attackSpeed: 0.71, // 0.75 / 1.05 (5% 빠름)
      speed: 3.3,        // 3.0 * 1.10
      range: 270,        // 180 * 1.50
    },
    specialEffects: {
      critChance: 0.5,   // 크리티컬 50% 확률
    },
  },
  ranger: {
    name: '레인저',
    nameEn: 'Ranger',
    emoji: '🏹',
    description: '빠른 공격속도와 다중 타겟 공격',
    baseClass: 'archer',
    // HP +20%, 공격력 +20%, 공격속도 +40%, 속도 +15%, 사거리 +10%
    stats: {
      hp: 336,           // 280 * 1.20
      attack: 48,        // 40 * 1.20
      attackSpeed: 0.54, // 0.75 / 1.40 (40% 빠름)
      speed: 3.45,       // 3.0 * 1.15
      range: 198,        // 180 * 1.10
    },
    specialEffects: {
      multiTarget: 5,    // 다중 타겟 5명
    },
  },
  // ============================================
  // 기사 계열 (기본: hp=550, attack=40, attackSpeed=1.1, speed=2.4, range=80)
  // ============================================
  paladin: {
    name: '팔라딘',
    nameEn: 'Paladin',
    emoji: '⚜️',
    description: '신성한 힘으로 아군을 치유하는 성기사',
    baseClass: 'knight',
    // HP +40%, 공격력 +15%, 공격속도 +10%, 속도 +10%, 사거리 +5%
    stats: {
      hp: 770,           // 550 * 1.40
      attack: 46,        // 40 * 1.15
      attackSpeed: 1.0,  // 1.1 / 1.10 (10% 빠름)
      speed: 2.64,       // 2.4 * 1.10
      range: 84,         // 80 * 1.05
    },
    specialEffects: {
      healAlly: true,    // 아군 힐 가능
    },
  },
  darkKnight: {
    name: '다크나이트',
    nameEn: 'Dark Knight',
    emoji: '⚔️',
    description: '어둠의 힘으로 적을 베는 암흑기사',
    baseClass: 'knight',
    // HP +25%, 공격력 +40%, 공격속도 +15%, 속도 +10%, 사거리 +5%
    stats: {
      hp: 688,           // 550 * 1.25
      attack: 56,        // 40 * 1.40
      attackSpeed: 0.96, // 1.1 / 1.15 (15% 빠름)
      speed: 2.64,       // 2.4 * 1.10
      range: 84,         // 80 * 1.05
    },
    specialEffects: {
      lifesteal: 0.3,    // 30% 피해흡혈 부여
    },
  },
  // ============================================
  // 마법사 계열 (기본: hp=230, attack=60, attackSpeed=1.4, speed=2.8, range=210)
  // ============================================
  archmage: {
    name: '대마법사',
    nameEn: 'Archmage',
    emoji: '🌟',
    description: '강력한 범위 마법의 대마법사',
    baseClass: 'mage',
    // HP +10%, 공격력 +70%, 공격속도 +10%, 속도 +5%, 사거리 +50%
    stats: {
      hp: 253,           // 230 * 1.10
      attack: 102,       // 60 * 1.70
      attackSpeed: 1.27, // 1.4 / 1.10 (10% 빠름)
      speed: 2.94,       // 2.8 * 1.05
      range: 315,        // 210 * 1.50
    },
    specialEffects: {
      bossBonus: 0.5,    // 보스에게 50% 추가 데미지
    },
  },
  healer: {
    name: '힐러',
    nameEn: 'Healer',
    emoji: '💚',
    description: '아군을 치유하는 힐러',
    baseClass: 'mage',
    // HP +40%, 공격력 +5%, 공격속도 +15%, 속도 +10%, 사거리 +20%
    stats: {
      hp: 322,           // 230 * 1.40
      attack: 63,        // 60 * 1.05
      attackSpeed: 1.22, // 1.4 / 1.15 (15% 빠름)
      speed: 3.08,       // 2.8 * 1.10
      range: 252,        // 210 * 1.20
    },
    specialEffects: {
      healAlly: true,    // 아군 힐 가능
    },
  },
};

// 전직 스킬 설정 인터페이스
export interface AdvancedSkillConfig {
  type: SkillType;
  name: string;
  nameEn: string;
  key: string;
  cooldown: number;
  description: string;
  // 스킬별 고유 속성
  duration?: number;         // 지속 시간 (버프류)
  damageMultiplier?: number; // 데미지 배율
  healPercent?: number;      // 힐량 (최대 HP 대비 %)
  radius?: number;           // 범위
  attackBonus?: number;      // 공격력 증가율
  speedBonus?: number;       // 공격속도 증가율
  damageTaken?: number;      // 받는 피해 변화 (양수면 증가)
  damageReduction?: number;  // 피해 감소율
  chargeTime?: number;       // 차징 시간
  invincibleDuration?: number; // 무적 지속시간
  distance?: number;         // 돌진 거리
  lifestealPercent?: number; // 피해흡혈 비율
  shieldPercent?: number;    // 보호막 비율 (최대 HP 대비)
  stunDuration?: number;     // 기절 지속시간
  arrowCount?: number;       // 화살 발사 수
  burnDamage?: number;       // 화상 데미지 (초당)
  burnDuration?: number;     // 화상 지속시간
  meteorCount?: number;      // 운석 개수
  range?: number;            // 스킬 사거리
}

// ============================================
// 전직 W 스킬 설정 (Shift 키)
// ============================================
export const ADVANCED_W_SKILLS: Record<AdvancedHeroClass, AdvancedSkillConfig> = {
  // 버서커: 피의 돌진 - 전방 돌진 + 피해량의 50% 체력 회복
  berserker: {
    type: 'blood_rush',
    name: '피의 돌진',
    nameEn: 'Blood Rush',
    key: 'W',
    cooldown: 6,
    description: '전방 돌진 + 경로상 적에게 데미지 + 피해량의 50% 체력 회복',
    damageMultiplier: 1.5,
    distance: 200,
    lifestealPercent: 0.5,
  },
  // 가디언: 수호의 돌진 - 전방 돌진 + 기절 + 보호막
  guardian: {
    type: 'guardian_rush',
    name: '수호의 돌진',
    nameEn: 'Guardian Rush',
    key: 'W',
    cooldown: 8,
    description: '전방 돌진 + 경로상 적에게 최대 HP 10% 데미지 + 2초 기절 + 3초간 보호막 (최대 HP 20%)',
    damageMultiplier: 0.1,  // 최대 HP 10% (특수 계산 필요)
    distance: 150,
    stunDuration: 2.0,
    shieldPercent: 0.2,
    duration: 3,  // 보호막 지속시간
  },
  // 저격수: 후방 도약 - 뒤로 점프하며 전방에 200% 데미지 화살 발사
  sniper: {
    type: 'backflip_shot',
    name: '후방 도약',
    nameEn: 'Backflip Shot',
    key: 'W',
    cooldown: 5,
    description: '뒤로 점프하며 전방에 200% 데미지 화살 발사 + 3초간 이동속도 30% 증가',
    damageMultiplier: 2.0,
    distance: 150,  // 뒤로 점프 거리
    speedBonus: 0.3,
    duration: 3,  // 이동속도 버프 지속시간
  },
  // 레인저: 다중 화살 - 부채꼴 방향으로 5발의 관통 화살 발사
  ranger: {
    type: 'multi_arrow',
    name: '다중 화살',
    nameEn: 'Multi Arrow',
    key: 'W',
    cooldown: 5,
    description: '부채꼴 방향으로 5발의 관통 화살 발사, 각 화살 100% 데미지',
    damageMultiplier: 1.0,
    arrowCount: 5,
    distance: 300,  // 화살 관통 거리 (범위 표시용)
  },
  // 팔라딘: 신성한 돌진 - 전방 돌진 + 기절 + 아군 힐
  paladin: {
    type: 'holy_charge',
    name: '신성한 돌진',
    nameEn: 'Holy Charge',
    key: 'W',
    cooldown: 8,
    description: '전방 돌진 + 경로상 적에게 최대 HP 10% 데미지 + 기절 + 주변 아군 HP 10% 회복',
    damageMultiplier: 0.1,  // 최대 HP 10% (특수 계산 필요)
    distance: 150,
    stunDuration: 1.5,
    healPercent: 0.1,
    radius: 200,  // 힐 범위
  },
  // 다크나이트: 암흑 베기 - 전방 돌진 + 150% 데미지 + 피해흡혈
  darkKnight: {
    type: 'shadow_slash',
    name: '암흑 베기',
    nameEn: 'Shadow Slash',
    key: 'W',
    cooldown: 8,
    description: '전방 돌진 + 경로상 적에게 150% 데미지 + 피해량의 30% 체력 회복',
    damageMultiplier: 1.5,
    distance: 200,
    lifestealPercent: 0.3,
  },
  // 대마법사: 폭발 화염구 - 대형 화염구 + 화상
  archmage: {
    type: 'inferno',
    name: '폭발 화염구',
    nameEn: 'Inferno',
    key: 'W',
    cooldown: 7,
    description: '대형 화염구 발사, 250% 데미지 + 범위 50% 증가 + 3초간 화상 (초당 20% 데미지)',
    damageMultiplier: 2.5,
    radius: 120,  // 기본 화염구 80 * 1.5 = 120
    burnDamage: 0.2,  // 초당 공격력의 20%
    burnDuration: 3,
  },
  // 힐러: 치유의 빛 - 적에게 데미지 + 아군 힐
  healer: {
    type: 'healing_light',
    name: '치유의 빛',
    nameEn: 'Healing Light',
    key: 'W',
    cooldown: 7,
    description: '전방 범위에 치유의 빛 발사, 적에게 100% 데미지 + 범위 내 아군 HP 15% 회복',
    damageMultiplier: 1.0,
    healPercent: 0.15,
    radius: 150,
  },
};

// ============================================
// 전직 E 스킬 설정 (R 키)
// ============================================
export const ADVANCED_E_SKILLS: Record<AdvancedHeroClass, AdvancedSkillConfig> = {
  // 버서커: 광란 - 10초간 공격력/공속 100% 증가, 받는 피해 50% 증가
  berserker: {
    type: 'rage',
    name: '광란',
    nameEn: 'Rage',
    key: 'E',
    cooldown: 45,
    description: '10초간 공격력/공속 100% 증가, 받는 피해 50% 증가',
    duration: 10,
    attackBonus: 1.0,
    speedBonus: 1.0,
    damageTaken: 0.5,
  },
  // 가디언: 보호막 - 아군 전체에게 5초간 피해 50% 감소 버프
  guardian: {
    type: 'shield',
    name: '보호막',
    nameEn: 'Shield',
    key: 'E',
    cooldown: 40,
    description: '아군 전체에게 5초간 받는 피해 50% 감소',
    duration: 5,
    damageReduction: 0.5,
    radius: 500,  // 전체 범위
  },
  // 저격수: 저격 - 3초 조준 후 1000% 데미지 단일 타격 (무제한 사거리)
  sniper: {
    type: 'snipe',
    name: '저격',
    nameEn: 'Snipe',
    key: 'E',
    cooldown: 30,
    description: '3초 조준 후 1000% 데미지 단일 타격 (무제한 사거리)',
    chargeTime: 3,
    damageMultiplier: 10.0,
    range: 2000,  // 무제한 사거리 (맵 전체)
  },
  // 레인저: 화살 폭풍 - 5초간 자동 공격 속도 3배
  ranger: {
    type: 'arrow_storm',
    name: '화살 폭풍',
    nameEn: 'Arrow Storm',
    key: 'E',
    cooldown: 35,
    description: '5초간 공격 속도 3배',
    duration: 5,
    speedBonus: 2.0,  // 3배 = 기본 + 200%
  },
  // 팔라딘: 신성한 빛 - 아군 전체 HP 30% 회복 + 3초 무적
  paladin: {
    type: 'divine_light',
    name: '신성한 빛',
    nameEn: 'Divine Light',
    key: 'E',
    cooldown: 60,
    description: '아군 전체 HP 30% 회복 + 3초 무적',
    healPercent: 0.3,
    invincibleDuration: 3,
    radius: 500,
  },
  // 다크나이트: 어둠의 칼날 - 주변 적에게 5초간 초당 50% 데미지
  darkKnight: {
    type: 'dark_blade',
    name: '어둠의 칼날',
    nameEn: 'Dark Blade',
    key: 'E',
    cooldown: 40,
    description: '5초간 주변 적에게 초당 공격력 50% 데미지',
    duration: 5,
    damageMultiplier: 0.5,
    radius: 150,
  },
  // 대마법사: 메테오 샤워 - 5초간 랜덤 위치에 운석 10개 낙하
  archmage: {
    type: 'meteor_shower',
    name: '메테오 샤워',
    nameEn: 'Meteor Shower',
    key: 'E',
    cooldown: 50,
    description: '5초간 랜덤 위치에 운석 10개 낙하 (각 300% 데미지)',
    duration: 5,
    damageMultiplier: 3.0,
    radius: 100,  // 각 운석 범위
    meteorCount: 10,
  },
  // 힐러: 생명의 샘 - 15초간 아군 전체 초당 5% 힐
  healer: {
    type: 'spring_of_life',
    name: '생명의 샘',
    nameEn: 'Spring of Life',
    key: 'E',
    cooldown: 45,
    description: '15초간 아군 전체 초당 최대 HP의 5% 회복',
    duration: 15,
    healPercent: 0.05,  // 초당 5%
    radius: 500,
  },
};

// 하위 호환성을 위해 기존 이름 유지
export const ADVANCED_CLASS_SKILLS = ADVANCED_E_SKILLS;
