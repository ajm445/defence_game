import { UnitType } from '../types/unit';
import { SkillType, ExpTable, LevelUpBonus, WaveConfig, HeroClass, ClassConfig, EnemyAIConfig, GoldTable } from '../types/rpg';

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
    attack: 38,
    attackSpeed: 0.7,
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
    detectionRange: 600,    // 플레이어 탐지 범위 확대 (400 → 600)
    attackRange: 60,
    moveSpeed: 2.25,
    attackDamage: 15,
    attackSpeed: 1.0,
  },
  ranged: {
    detectionRange: 700,    // 플레이어 탐지 범위 확대 (500 → 700)
    attackRange: 150,
    moveSpeed: 2.4,
    attackDamage: 20,
    attackSpeed: 0.8,
  },
  knight: {
    detectionRange: 550,    // 플레이어 탐지 범위 확대 (350 → 550)
    attackRange: 70,
    moveSpeed: 1.95,
    attackDamage: 12,
    attackSpeed: 1.2,
  },
  mage: {
    detectionRange: 650,    // 플레이어 탐지 범위 확대 (450 → 650)
    attackRange: 180,
    moveSpeed: 2.1,
    attackDamage: 35,
    attackSpeed: 1.5,
  },
  boss: {
    detectionRange: 800,    // 플레이어 탐지 범위 확대 (600 → 800)
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

  // 경험치 분배
  EXP_SHARE: {
    DEAD_PLAYER_RATIO: 0.5,  // 죽은 플레이어 경험치 50%
  },

  // 웨이브 대기 시간
  WAVE_DELAY: 5,
} as const;

export type CoopConfig = typeof COOP_CONFIG;
