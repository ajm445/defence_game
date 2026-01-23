import { HeroClass } from './rpg';

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

// 클래스 진행 상황
export interface ClassProgress {
  id?: string;
  playerId: string;
  className: HeroClass;
  classLevel: number;
  classExp: number;
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
  warrior: 15,
  knight: 40,
  mage: 70,
} as const;

// 플레이어 경험치 계산 (넥서스 디펜스)
export const calculatePlayerExp = (
  basesDestroyed: number,
  bossesKilled: number,
  kills: number,
  playTimeSeconds: number,
  victory: boolean,
  mode: 'single' | 'coop'
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

  // 협동 모드: 1.2배
  return mode === 'coop' ? Math.floor(totalExp * 1.2) : totalExp;
};

// 직업 경험치 계산 (넥서스 디펜스)
export const calculateClassExp = (
  basesDestroyed: number,
  bossesKilled: number,
  kills: number
): number => {
  // 기지 파괴: 각 15점
  const baseExp = basesDestroyed * 15;
  // 보스 처치: 각 25점
  const bossExp = bossesKilled * 25;
  // 킬당: 1점
  const killExp = kills;

  return baseExp + bossExp + killExp;
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
}
