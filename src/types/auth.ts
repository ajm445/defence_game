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

// 게임 기록
export interface GameRecord {
  id?: string;
  playerId: string;
  mode: 'single' | 'coop';
  classUsed: HeroClass;
  waveReached: number;
  kills: number;
  playTime: number;
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

// 경험치 계산 함수들 (50% 감소 적용)
export const calculatePlayerExp = (
  waveReached: number,
  victory: boolean,
  mode: 'single' | 'coop'
): number => {
  if (mode === 'single') {
    // 기존: waveReached * 10 + (victory ? 50 : 0)
    return waveReached * 5 + (victory ? 25 : 0);
  } else {
    // 기존: waveReached * 15 + (victory ? 75 : 0)
    return waveReached * 8 + (victory ? 40 : 0);
  }
};

// 직업 경험치 (50% 감소)
export const calculateClassExp = (waveReached: number, kills: number): number => {
  // 기존: waveReached * 5 + kills * 2
  return waveReached * 3 + kills * 1;
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
