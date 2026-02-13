import {
  PlayerProfile,
  ClassProgress,
  GameRecord,
  LevelUpResult,
  CharacterStatUpgrades,
  calculatePlayerExp,
  calculateClassExp,
  getRequiredPlayerExp,
  getRequiredClassExp,
  createDefaultStatUpgrades,
  SP_PER_CLASS_LEVEL,
  StatUpgradeType,
} from '../types/auth';
import { HeroClass, RPGDifficulty, AdvancedHeroClass } from '../types/rpg';

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

    // 기존 데이터에 attackSpeed가 없을 수 있으므로 기본값과 병합
    const defaultStats = createDefaultStatUpgrades();
    return data.progress.map(p => ({
      ...p,
      statUpgrades: {
        ...defaultStats,
        ...p.statUpgrades,
      },
    }));
  } catch (err) {
    console.error('Get class progress error:', err);
    return [];
  }
};

// 클래스 진행 상황 업데이트/생성
export const upsertClassProgress = async (
  playerId: string,
  className: HeroClass,
  updates: {
    classLevel: number;
    classExp: number;
    sp?: number;
    statUpgrades?: CharacterStatUpgrades;
    advancedClass?: AdvancedHeroClass;
    tier?: 1 | 2;
  }
): Promise<boolean> => {
  try {
    const data = await apiRequest<{ success: boolean }>('/api/profile/class-progress', {
      method: 'POST',
      body: JSON.stringify({
        playerId,
        className,
        classLevel: updates.classLevel,
        classExp: updates.classExp,
        sp: updates.sp ?? 0,
        statUpgrades: updates.statUpgrades ?? createDefaultStatUpgrades(),
        advancedClass: updates.advancedClass,
        tier: updates.tier,
      }),
    });

    return data.success;
  } catch (err) {
    console.error('Upsert class progress error:', err);
    return false;
  }
};

// SP 사용하여 스탯 업그레이드
export const upgradeCharacterStat = async (
  playerId: string,
  className: HeroClass,
  statType: StatUpgradeType,
  currentProgress: ClassProgress
): Promise<ClassProgress | null> => {
  if (currentProgress.sp <= 0) {
    console.error('Not enough SP');
    return null;
  }

  const newStatUpgrades = {
    ...currentProgress.statUpgrades,
    [statType]: (currentProgress.statUpgrades[statType] ?? 0) + 1,
  };

  const newSp = currentProgress.sp - 1;

  try {
    await upsertClassProgress(playerId, className, {
      classLevel: currentProgress.classLevel,
      classExp: currentProgress.classExp,
      sp: newSp,
      statUpgrades: newStatUpgrades,
    });

    return {
      ...currentProgress,
      sp: newSp,
      statUpgrades: newStatUpgrades,
    };
  } catch (err) {
    console.error('Upgrade character stat error:', err);
    return null;
  }
};

// SP 초기화 (스탯 리셋)
export const resetCharacterStats = async (
  playerId: string,
  className: HeroClass,
  currentProgress: ClassProgress
): Promise<ClassProgress | null> => {
  // 사용한 SP 계산 (모든 스탯 포함)
  const spentSP =
    currentProgress.statUpgrades.attack +
    currentProgress.statUpgrades.speed +
    currentProgress.statUpgrades.hp +
    currentProgress.statUpgrades.attackSpeed +
    currentProgress.statUpgrades.range +
    currentProgress.statUpgrades.hpRegen +
    (currentProgress.statUpgrades.skillCooldown ?? 0);

  // 이미 0이면 리셋할 필요 없음
  if (spentSP === 0) {
    return currentProgress;
  }

  // SP 반환 및 스탯 초기화
  const newSp = currentProgress.sp + spentSP;
  const newStatUpgrades = createDefaultStatUpgrades();

  try {
    await upsertClassProgress(playerId, className, {
      classLevel: currentProgress.classLevel,
      classExp: currentProgress.classExp,
      sp: newSp,
      statUpgrades: newStatUpgrades,
    });

    return {
      ...currentProgress,
      sp: newSp,
      statUpgrades: newStatUpgrades,
    };
  } catch (err) {
    console.error('Reset character stats error:', err);
    return null;
  }
};

// 전직 처리 (advancedClass 저장) - 전직 변경도 지원
export const advanceJob = async (
  playerId: string,
  className: HeroClass,
  advancedClass: AdvancedHeroClass,
  currentProgress: ClassProgress
): Promise<ClassProgress | null> => {
  // 레벨 조건 확인 (Lv.15 이상)
  if (currentProgress.classLevel < 15) {
    console.error('Level requirement not met for job advancement');
    return null;
  }

  // 같은 전직으로 변경하는 경우 무시
  if (currentProgress.advancedClass === advancedClass) {
    console.log('Already in this advanced class');
    return currentProgress;
  }

  // 전직 변경 여부 확인
  const isJobChange = !!currentProgress.advancedClass;

  // 전직 변경 시: 레벨 15로 초기화, tier 1로 리셋, SP 14로 리셋, 스탯 업그레이드 초기화
  // 최초 전직 시: 현재 레벨/SP/스탯 유지
  const newClassLevel = isJobChange ? 15 : currentProgress.classLevel;
  const newClassExp = isJobChange ? 0 : currentProgress.classExp;
  const newSp = isJobChange ? 14 : currentProgress.sp;  // 레벨 15 = SP 14
  const newStatUpgrades = isJobChange ? createDefaultStatUpgrades() : currentProgress.statUpgrades;
  const newTier = 1;  // 전직 시 항상 tier 1로

  try {
    const success = await upsertClassProgress(playerId, className, {
      classLevel: newClassLevel,
      classExp: newClassExp,
      sp: newSp,
      statUpgrades: newStatUpgrades,
      advancedClass,
      tier: newTier,
    });

    if (!success) return null;

    return {
      ...currentProgress,
      classLevel: newClassLevel,
      classExp: newClassExp,
      sp: newSp,
      statUpgrades: newStatUpgrades,
      advancedClass,
      tier: newTier,
    };
  } catch (err) {
    console.error('Advance job error:', err);
    return null;
  }
};

// 2차 강화 처리 (tier 업그레이드)
export const applySecondEnhancement = async (
  playerId: string,
  className: HeroClass,
  currentProgress: ClassProgress
): Promise<ClassProgress | null> => {
  // 레벨 조건 확인 (Lv.40 이상)
  if (currentProgress.classLevel < 40) {
    console.error('Level requirement not met for second enhancement');
    return null;
  }

  // 전직했는지 확인
  if (!currentProgress.advancedClass) {
    console.error('Must advance job first');
    return null;
  }

  // 이미 2차 강화했는지 확인
  if (currentProgress.tier === 2) {
    console.error('Already at tier 2');
    return null;
  }

  try {
    const success = await upsertClassProgress(playerId, className, {
      classLevel: currentProgress.classLevel,
      classExp: currentProgress.classExp,
      sp: currentProgress.sp,
      statUpgrades: currentProgress.statUpgrades,
      advancedClass: currentProgress.advancedClass as AdvancedHeroClass,
      tier: 2,  // 2차 강화
    });

    if (!success) return null;

    return {
      ...currentProgress,
      tier: 2,
    };
  } catch (err) {
    console.error('Apply second enhancement error:', err);
    return null;
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

// 게임 결과 처리 및 경험치 적용 (넥서스 디펜스)
export const processGameResult = async (
  playerId: string,
  profile: PlayerProfile,
  existingClassProgress: ClassProgress[],
  gameData: {
    mode: 'single' | 'coop';
    classUsed: HeroClass;
    basesDestroyed: number;
    bossesKilled: number;
    kills: number;
    playTime: number;  // 초 단위
    victory: boolean;
    difficulty?: RPGDifficulty;  // 난이도 (경험치 배율 적용)
  }
): Promise<{
  playerExpGained: number;
  classExpGained: number;
  levelUpResult: LevelUpResult;
  newProfile: PlayerProfile;
  newClassProgress: ClassProgress;
}> => {
  const difficulty = gameData.difficulty || 'easy';

  // VIP 여부 확인 (경험치 2배)
  const isVip = profile.role === 'vip';

  // 경험치 계산 (넥서스 디펜스) - 난이도 배율 및 VIP 보너스 적용
  const playerExpGained = calculatePlayerExp(
    gameData.basesDestroyed,
    gameData.bossesKilled,
    gameData.kills,
    gameData.playTime,
    gameData.victory,
    gameData.mode,
    difficulty,
    isVip
  );
  const classExpGained = calculateClassExp(
    gameData.basesDestroyed,
    gameData.bossesKilled,
    gameData.kills,
    difficulty,
    gameData.victory,
    isVip
  );

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
  let spGained = 0;
  const previousLevel = newClassLevel;

  while (newClassExp >= getRequiredClassExp(newClassLevel)) {
    newClassExp -= getRequiredClassExp(newClassLevel);
    newClassLevel++;
    classLeveledUp = true;
    spGained += SP_PER_CLASS_LEVEL; // 레벨당 SP 획득
  }

  // 기존 SP + 새로 획득한 SP
  const existingSp = existingProgress?.sp ?? 0;
  const newSp = existingSp + spGained;

  // 기존 스탯 업그레이드 유지
  const existingStatUpgrades = existingProgress?.statUpgrades ?? createDefaultStatUpgrades();

  // 새 프로필 데이터
  const newProfile: PlayerProfile = {
    ...profile,
    playerLevel: newPlayerLevel,
    playerExp: newPlayerExp,
  };

  // 새 클래스 진행 상황 (전직 정보 보존)
  const newClassProgress: ClassProgress = {
    playerId,
    className: gameData.classUsed,
    classLevel: newClassLevel,
    classExp: newClassExp,
    sp: newSp,
    statUpgrades: existingStatUpgrades,
    advancedClass: existingProgress?.advancedClass,
    tier: existingProgress?.tier,
  };

  // 레벨업 결과
  const levelUpResult: LevelUpResult = {
    playerLeveledUp,
    newPlayerLevel: playerLeveledUp ? newPlayerLevel : undefined,
    classLeveledUp,
    newClassLevel: classLeveledUp ? newClassLevel : undefined,
    className: classLeveledUp ? gameData.classUsed : undefined,
    advancedClassName: classLeveledUp ? existingProgress?.advancedClass as AdvancedHeroClass | undefined : undefined,
    spGained: spGained > 0 ? spGained : undefined,
  };

  // 게스트가 아닌 경우 DB에 저장 (백엔드 API 통해)
  if (!profile.isGuest) {
    // 프로필 업데이트
    await updatePlayerProfile(playerId, {
      playerLevel: newPlayerLevel,
      playerExp: newPlayerExp,
    });

    // 클래스 진행 상황 업데이트 (전직 정보 포함)
    await upsertClassProgress(playerId, gameData.classUsed, {
      classLevel: newClassLevel,
      classExp: newClassExp,
      sp: newSp,
      statUpgrades: existingStatUpgrades,
      advancedClass: existingProgress?.advancedClass as AdvancedHeroClass | undefined,
      tier: existingProgress?.tier,
    });

    // 게임 기록 저장
    await saveGameRecord({
      playerId,
      mode: gameData.mode,
      classUsed: gameData.classUsed,
      basesDestroyed: gameData.basesDestroyed,
      bossesKilled: gameData.bossesKilled,
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

// RTS 게임 결과 처리 (플레이어 경험치만 적용)
export const processRTSGameResult = async (
  playerId: string,
  profile: PlayerProfile,
  gameData: {
    victory: boolean;
    playTime: number;  // 초 단위
    mode: 'tutorial' | 'ai' | 'multiplayer';
    difficulty?: 'easy' | 'normal' | 'hard' | 'nightmare' | 'bosstest';
  }
): Promise<{
  playerExpGained: number;
  levelUpResult: { playerLeveledUp: boolean; newPlayerLevel?: number };
  newProfile: PlayerProfile;
}> => {
  // 튜토리얼, 멀티플레이어는 경험치 없음
  if (gameData.mode === 'tutorial' || gameData.mode === 'multiplayer') {
    return {
      playerExpGained: 0,
      levelUpResult: { playerLeveledUp: false },
      newProfile: profile,
    };
  }

  // 패배 시 경험치 없음
  if (!gameData.victory) {
    return {
      playerExpGained: 0,
      levelUpResult: { playerLeveledUp: false },
      newProfile: profile,
    };
  }

  // 난이도별 클리어 경험치
  const RTS_VICTORY_EXP: Record<string, number> = {
    easy: 100,
    normal: 250,
    hard: 700,
    nightmare: 1600,
    bosstest: 0,
  };

  const difficulty = gameData.difficulty || 'easy';
  const isVip = profile.role === 'vip';
  const vipMultiplier = isVip ? 2 : 1;
  const playerExpGained = (RTS_VICTORY_EXP[difficulty] ?? 100) * vipMultiplier;

  // 플레이어 레벨업 계산
  let newPlayerLevel = profile.playerLevel;
  let newPlayerExp = profile.playerExp + playerExpGained;
  let playerLeveledUp = false;

  while (newPlayerExp >= getRequiredPlayerExp(newPlayerLevel)) {
    newPlayerExp -= getRequiredPlayerExp(newPlayerLevel);
    newPlayerLevel++;
    playerLeveledUp = true;
  }

  // 새 프로필 데이터
  const newProfile: PlayerProfile = {
    ...profile,
    playerLevel: newPlayerLevel,
    playerExp: newPlayerExp,
  };

  // 레벨업 결과
  const levelUpResult = {
    playerLeveledUp,
    newPlayerLevel: playerLeveledUp ? newPlayerLevel : undefined,
  };

  // 게스트가 아닌 경우 DB에 저장
  if (!profile.isGuest) {
    await updatePlayerProfile(playerId, {
      playerLevel: newPlayerLevel,
      playerExp: newPlayerExp,
    });
  }

  return {
    playerExpGained,
    levelUpResult,
    newProfile,
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
