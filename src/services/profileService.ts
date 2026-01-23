import {
  PlayerProfile,
  ClassProgress,
  GameRecord,
  LevelUpResult,
  calculatePlayerExp,
  calculateClassExp,
  getRequiredPlayerExp,
  getRequiredClassExp,
} from '../types/auth';
import { HeroClass } from '../types/rpg';

// API 기본 URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// API 요청 헬퍼
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || '요청 처리 중 오류가 발생했습니다.');
  }

  return data;
}

// 플레이어 프로필 업데이트
export const updatePlayerProfile = async (
  userId: string,
  updates: Partial<Pick<PlayerProfile, 'nickname' | 'playerLevel' | 'playerExp'>>
): Promise<boolean> => {
  try {
    const data = await apiRequest<{ success: boolean }>(`/api/profile/player/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });

    return data.success;
  } catch (err) {
    console.error('Update profile error:', err);
    return false;
  }
};

// 클래스 진행 상황 가져오기
export const getClassProgress = async (playerId: string): Promise<ClassProgress[]> => {
  try {
    const data = await apiRequest<{
      success: boolean;
      progress: ClassProgress[];
    }>(`/api/profile/class-progress/${playerId}`);

    if (!data.success) {
      return [];
    }

    return data.progress;
  } catch (err) {
    console.error('Get class progress error:', err);
    return [];
  }
};

// 클래스 진행 상황 업데이트/생성
export const upsertClassProgress = async (
  playerId: string,
  className: HeroClass,
  updates: { classLevel: number; classExp: number }
): Promise<boolean> => {
  try {
    const data = await apiRequest<{ success: boolean }>('/api/profile/class-progress', {
      method: 'POST',
      body: JSON.stringify({
        playerId,
        className,
        classLevel: updates.classLevel,
        classExp: updates.classExp,
      }),
    });

    return data.success;
  } catch (err) {
    console.error('Upsert class progress error:', err);
    return false;
  }
};

// 게임 기록 저장
export const saveGameRecord = async (record: Omit<GameRecord, 'id' | 'playedAt'>): Promise<boolean> => {
  try {
    const data = await apiRequest<{ success: boolean }>('/api/profile/game-record', {
      method: 'POST',
      body: JSON.stringify(record),
    });

    return data.success;
  } catch (err) {
    console.error('Save game record error:', err);
    return false;
  }
};

// 게임 기록 가져오기
export const getGameHistory = async (
  playerId: string,
  limit = 10
): Promise<GameRecord[]> => {
  try {
    const data = await apiRequest<{
      success: boolean;
      history: GameRecord[];
    }>(`/api/profile/game-history/${playerId}?limit=${limit}`);

    if (!data.success) {
      return [];
    }

    return data.history;
  } catch (err) {
    console.error('Get game history error:', err);
    return [];
  }
};

// 게임 결과 처리 및 경험치 적용
export const processGameResult = async (
  playerId: string,
  profile: PlayerProfile,
  existingClassProgress: ClassProgress[],
  gameData: {
    mode: 'single' | 'coop';
    classUsed: HeroClass;
    waveReached: number;
    kills: number;
    playTime: number;
    victory: boolean;
  }
): Promise<{
  playerExpGained: number;
  classExpGained: number;
  levelUpResult: LevelUpResult;
  newProfile: PlayerProfile;
  newClassProgress: ClassProgress;
}> => {
  // 경험치 계산
  const playerExpGained = calculatePlayerExp(gameData.waveReached, gameData.victory, gameData.mode);
  const classExpGained = calculateClassExp(gameData.waveReached, gameData.kills);

  // 플레이어 레벨업 계산
  let newPlayerLevel = profile.playerLevel;
  let newPlayerExp = profile.playerExp + playerExpGained;
  let playerLeveledUp = false;

  while (newPlayerExp >= getRequiredPlayerExp(newPlayerLevel)) {
    newPlayerExp -= getRequiredPlayerExp(newPlayerLevel);
    newPlayerLevel++;
    playerLeveledUp = true;
  }

  // 클래스 진행 상황 찾기 또는 생성
  const existingProgress = existingClassProgress.find(
    (p) => p.className === gameData.classUsed
  );

  let newClassLevel = existingProgress?.classLevel ?? 1;
  let newClassExp = (existingProgress?.classExp ?? 0) + classExpGained;
  let classLeveledUp = false;

  while (newClassExp >= getRequiredClassExp(newClassLevel)) {
    newClassExp -= getRequiredClassExp(newClassLevel);
    newClassLevel++;
    classLeveledUp = true;
  }

  // 새 프로필 데이터
  const newProfile: PlayerProfile = {
    ...profile,
    playerLevel: newPlayerLevel,
    playerExp: newPlayerExp,
  };

  // 새 클래스 진행 상황
  const newClassProgress: ClassProgress = {
    playerId,
    className: gameData.classUsed,
    classLevel: newClassLevel,
    classExp: newClassExp,
  };

  // 레벨업 결과
  const levelUpResult: LevelUpResult = {
    playerLeveledUp,
    newPlayerLevel: playerLeveledUp ? newPlayerLevel : undefined,
    classLeveledUp,
    newClassLevel: classLeveledUp ? newClassLevel : undefined,
    className: classLeveledUp ? gameData.classUsed : undefined,
  };

  // 게스트가 아닌 경우 DB에 저장 (백엔드 API 통해)
  if (!profile.isGuest) {
    // 프로필 업데이트
    await updatePlayerProfile(playerId, {
      playerLevel: newPlayerLevel,
      playerExp: newPlayerExp,
    });

    // 클래스 진행 상황 업데이트
    await upsertClassProgress(playerId, gameData.classUsed, {
      classLevel: newClassLevel,
      classExp: newClassExp,
    });

    // 게임 기록 저장
    await saveGameRecord({
      playerId,
      mode: gameData.mode,
      classUsed: gameData.classUsed,
      waveReached: gameData.waveReached,
      kills: gameData.kills,
      playTime: gameData.playTime,
      victory: gameData.victory,
      expEarned: playerExpGained,
    });
  }

  return {
    playerExpGained,
    classExpGained,
    levelUpResult,
    newProfile,
    newClassProgress,
  };
};

// 플레이어 통계 가져오기
export const getPlayerStats = async (playerId: string): Promise<{
  totalGames: number;
  totalWins: number;
  totalKills: number;
  totalPlayTime: number;
  highestWave: number;
  favoriteClass: HeroClass | null;
} | null> => {
  try {
    const data = await apiRequest<{
      success: boolean;
      stats: {
        totalGames: number;
        totalWins: number;
        totalKills: number;
        totalPlayTime: number;
        highestWave: number;
        favoriteClass: HeroClass | null;
      };
    }>(`/api/profile/stats/${playerId}`);

    if (!data.success) {
      return null;
    }

    return data.stats;
  } catch (err) {
    console.error('Get player stats error:', err);
    return null;
  }
};
