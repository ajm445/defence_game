import { HeroClass, RPGDifficulty } from './rpg';
import { DIFFICULTY_CONFIGS } from '../constants/rpgConfig';

// 플레이어 프로필
export interface PlayerProfile {
  id: string;
  nickname: string;
  playerLevel: number;
  playerExp: number;
  isGuest: boolean;
  // 사운드 설정
  soundVolume?: number;
  soundMuted?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// 캐릭터 스탯 업그레이드 (SP 투자)
export interface CharacterStatUpgrades {
  attack: number;      // 공격력 (모든 캐릭터)
  speed: number;       // 이동속도 (모든 캐릭터)
  hp: number;          // 체력 (모든 캐릭터)
  attackSpeed: number; // 공격속도 (모든 캐릭터)
  range: number;       // 사거리 (원거리: archer, mage)
  hpRegen: number;     // 체력 재생 (근거리: warrior, knight)
}

// 클래스 진행 상황
export interface ClassProgress {
  id?: string;
  playerId: string;
  className: HeroClass;
  classLevel: number;
  classExp: number;
  sp: number;                         // 사용 가능한 스킬 포인트
  statUpgrades: CharacterStatUpgrades; // 스탯 업그레이드
  advancedClass?: string;              // 전직 직업 (클래스 레벨 10 이상 시)
  createdAt?: string;
  updatedAt?: string;
}

// 게임 기록 (넥서스 디펜스)
export interface GameRecord {
  id?: string;
  playerId: string;
  mode: 'single' | 'coop';
  classUsed: HeroClass;
  basesDestroyed: number;  // 파괴한 적 기지 수 (0-2)
  bossesKilled: number;    // 처치한 보스 수 (0-2)
  kills: number;
  playTime: number;        // 초 단위
  victory: boolean;
  expEarned: number;
  playedAt?: string;
}

// 캐릭터 해금 조건 (필요 플레이어 레벨)
export const CHARACTER_UNLOCK_LEVELS: Record<HeroClass, number> = {
  archer: 1,    // 기본 캐릭터
  warrior: 10,
  knight: 25,
  mage: 50,
} as const;

// 플레이어 경험치 계산 (넥서스 디펜스)
export const calculatePlayerExp = (
  basesDestroyed: number,
  bossesKilled: number,
  kills: number,
  playTimeSeconds: number,
  victory: boolean,
  mode: 'single' | 'coop',
  difficulty: RPGDifficulty = 'easy'
): number => {
  // 기지 파괴: 각 30점
  const baseExp = basesDestroyed * 30;
  // 보스 처치: 각 50점
  const bossExp = bossesKilled * 50;
  // 킬당: 1점
  const killExp = kills;
  // 5분 생존 보너스: 30점
  const survivalBonus = playTimeSeconds >= 300 ? 30 : 0;
  // 승리 보너스: 50점
  const victoryBonus = victory ? 50 : 0;

  const totalExp = baseExp + bossExp + killExp + survivalBonus + victoryBonus;

  // 난이도 경험치 배율 적용
  const difficultyConfig = DIFFICULTY_CONFIGS[difficulty];
  const difficultyMultiplier = difficultyConfig?.expRewardMultiplier ?? 1.0;

  // 협동 모드: 1.2배 + 난이도 배율
  const modeMultiplier = mode === 'coop' ? 1.2 : 1.0;
  return Math.floor(totalExp * modeMultiplier * difficultyMultiplier);
};

// 직업 경험치 계산 (넥서스 디펜스)
export const calculateClassExp = (
  basesDestroyed: number,
  bossesKilled: number,
  kills: number,
  difficulty: RPGDifficulty = 'easy'
): number => {
  // 기지 파괴: 각 15점
  const baseExp = basesDestroyed * 15;
  // 보스 처치: 각 25점
  const bossExp = bossesKilled * 25;
  // 킬당: 1점
  const killExp = kills;

  // 난이도 경험치 배율 적용
  const difficultyConfig = DIFFICULTY_CONFIGS[difficulty];
  const difficultyMultiplier = difficultyConfig?.expRewardMultiplier ?? 1.0;

  return Math.floor((baseExp + bossExp + killExp) * difficultyMultiplier);
};

// ============================================
// 협동 모드용 레거시 경험치 계산 (웨이브 기반)
// ============================================

// 협동 모드 플레이어 경험치 계산 (웨이브 기반)
export const calculateCoopPlayerExp = (
  waveReached: number,
  victory: boolean
): number => {
  // 웨이브 × 15 + 승리 보너스 75
  return waveReached * 15 + (victory ? 75 : 0);
};

// 협동 모드 직업 경험치 계산 (웨이브 기반)
export const calculateCoopClassExp = (waveReached: number, kills: number): number => {
  // 웨이브 × 5 + 킬 × 2
  return waveReached * 5 + kills * 2;
};

// 레벨업 요구 경험치
export const getRequiredPlayerExp = (level: number): number => {
  return level * 100;
};

export const getRequiredClassExp = (level: number): number => {
  return level * 50;
};

// 캐릭터 해금 확인
export const isCharacterUnlocked = (
  heroClass: HeroClass,
  playerLevel: number,
  isGuest: boolean
): boolean => {
  // 게스트는 궁수만 사용 가능
  if (isGuest) {
    return heroClass === 'archer';
  }
  return playerLevel >= CHARACTER_UNLOCK_LEVELS[heroClass];
};

// 인증 상태 타입
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

// 레벨업 결과
export interface LevelUpResult {
  playerLeveledUp: boolean;
  newPlayerLevel?: number;
  classLeveledUp: boolean;
  newClassLevel?: number;
  className?: HeroClass;
  spGained?: number;
}

// SP 시스템 상수
export const SP_PER_CLASS_LEVEL = 1; // 클래스 레벨당 SP 획득

// 기본 스탯 업그레이드 생성
export const createDefaultStatUpgrades = (): CharacterStatUpgrades => ({
  attack: 0,
  speed: 0,
  hp: 0,
  attackSpeed: 0,
  range: 0,
  hpRegen: 0,
});

// 스탯 업그레이드 타입 (캐릭터별)
export type StatUpgradeType = keyof CharacterStatUpgrades;

// 캐릭터별 업그레이드 가능한 스탯
export const getUpgradeableStats = (heroClass: HeroClass): StatUpgradeType[] => {
  // 근거리 캐릭터: 공격력, 이동속도, 체력, 공격속도, 체력 재생
  if (heroClass === 'warrior' || heroClass === 'knight') {
    return ['attack', 'speed', 'hp', 'attackSpeed', 'hpRegen'];
  }
  // 원거리 캐릭터: 공격력, 이동속도, 체력, 공격속도, 사거리
  return ['attack', 'speed', 'hp', 'attackSpeed', 'range'];
};

// 스탯 업그레이드 정보
// maxLevel을 Infinity로 설정하여 레벨 제한 없음 (플레이어 레벨로만 제한)
export const STAT_UPGRADE_CONFIG: Record<StatUpgradeType, {
  name: string;
  icon: string;
  perLevel: number;
  unit: string;
  maxLevel: number;
}> = {
  attack: {
    name: '공격력',
    icon: '⚔️',
    perLevel: 5,      // 레벨당 +5 공격력
    unit: '',
    maxLevel: Infinity,
  },
  speed: {
    name: '이동속도',
    icon: '👟',
    perLevel: 0.1,    // 레벨당 +0.1 이동속도
    unit: '',
    maxLevel: Infinity,
  },
  hp: {
    name: '체력',
    icon: '❤️',
    perLevel: 20,     // 레벨당 +20 체력
    unit: '',
    maxLevel: Infinity,
  },
  attackSpeed: {
    name: '공격속도',
    icon: '⚡',
    perLevel: 0.05,   // 레벨당 +0.05초 공격속도 감소 (더 빠른 공격)
    unit: '초',
    maxLevel: Infinity,
  },
  range: {
    name: '사거리',
    icon: '🎯',
    perLevel: 5,     // 레벨당 +5 사거리
    unit: '',
    maxLevel: Infinity,
  },
  hpRegen: {
    name: '체력 재생',
    icon: '💚',
    perLevel: 2,      // 레벨당 +2/초 체력 재생
    unit: '/초',
    maxLevel: Infinity,
  },
};

// 특정 스탯의 총 보너스 계산
export const getStatBonus = (upgradeType: StatUpgradeType, level: number): number => {
  return STAT_UPGRADE_CONFIG[upgradeType].perLevel * level;
};

// 사용한 총 SP 계산 (모든 스탯 레벨의 합)
export const getTotalSpentSP = (statUpgrades: CharacterStatUpgrades): number => {
  return statUpgrades.attack + statUpgrades.speed + statUpgrades.hp + statUpgrades.attackSpeed + statUpgrades.range + statUpgrades.hpRegen;
};
