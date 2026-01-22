import { supabase, isSupabaseConfigured } from './supabase';
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

// 플레이어 프로필 업데이트
export const updatePlayerProfile = async (
  userId: string,
  updates: Partial<Pick<PlayerProfile, 'nickname' | 'playerLevel' | 'playerExp'>>
): Promise<boolean> => {
  if (!isSupabaseConfigured() || !supabase) {
    return false;
  }

  try {
    const dbUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.nickname !== undefined) dbUpdates.nickname = updates.nickname;
    if (updates.playerLevel !== undefined) dbUpdates.player_level = updates.playerLevel;
    if (updates.playerExp !== undefined) dbUpdates.player_exp = updates.playerExp;

    const { error } = await supabase
      .from('player_profiles')
      .update(dbUpdates)
      .eq('id', userId);

    if (error) {
      console.error('Update profile error:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Update profile error:', err);
    return false;
  }
};

// 클래스 진행 상황 가져오기
export const getClassProgress = async (playerId: string): Promise<ClassProgress[]> => {
  if (!isSupabaseConfigured() || !supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('class_progress')
      .select('*')
      .eq('player_id', playerId);

    if (error) {
      console.error('Get class progress error:', error);
      return [];
    }

    return data.map((row) => ({
      id: row.id,
      playerId: row.player_id,
      className: row.class_name as HeroClass,
      classLevel: row.class_level,
      classExp: row.class_exp,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
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
  updates: { classLevel: number; classExp: number }
): Promise<boolean> => {
  if (!isSupabaseConfigured() || !supabase) {
    return false;
  }

  try {
    const { error } = await supabase
      .from('class_progress')
      .upsert({
        player_id: playerId,
        class_name: className,
        class_level: updates.classLevel,
        class_exp: updates.classExp,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'player_id,class_name',
      });

    if (error) {
      console.error('Upsert class progress error:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Upsert class progress error:', err);
    return false;
  }
};

// 게임 기록 저장
export const saveGameRecord = async (record: Omit<GameRecord, 'id' | 'playedAt'>): Promise<boolean> => {
  if (!isSupabaseConfigured() || !supabase) {
    return false;
  }

  try {
    const { error } = await supabase
      .from('game_history')
      .insert({
        player_id: record.playerId,
        mode: record.mode,
        class_used: record.classUsed,
        wave_reached: record.waveReached,
        kills: record.kills,
        play_time: record.playTime,
        victory: record.victory,
        exp_earned: record.expEarned,
      });

    if (error) {
      console.error('Save game record error:', error);
      return false;
    }

    return true;
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
  if (!isSupabaseConfigured() || !supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('game_history')
      .select('*')
      .eq('player_id', playerId)
      .order('played_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Get game history error:', error);
      return [];
    }

    return data.map((row) => ({
      id: row.id,
      playerId: row.player_id,
      mode: row.mode as 'single' | 'coop',
      classUsed: row.class_used as HeroClass,
      waveReached: row.wave_reached,
      kills: row.kills,
      playTime: row.play_time,
      victory: row.victory,
      expEarned: row.exp_earned,
      playedAt: row.played_at,
    }));
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

  // 게스트가 아닌 경우 DB에 저장
  if (!profile.isGuest && isSupabaseConfigured()) {
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
  if (!isSupabaseConfigured() || !supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('game_history')
      .select('*')
      .eq('player_id', playerId);

    if (error) {
      console.error('Get player stats error:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return {
        totalGames: 0,
        totalWins: 0,
        totalKills: 0,
        totalPlayTime: 0,
        highestWave: 0,
        favoriteClass: null,
      };
    }

    const totalGames = data.length;
    const totalWins = data.filter((g) => g.victory).length;
    const totalKills = data.reduce((sum, g) => sum + g.kills, 0);
    const totalPlayTime = data.reduce((sum, g) => sum + g.play_time, 0);
    const highestWave = Math.max(...data.map((g) => g.wave_reached));

    // 가장 많이 사용한 클래스 찾기
    const classCounts: Partial<Record<HeroClass, number>> = {};
    for (const game of data) {
      const cls = game.class_used as HeroClass;
      classCounts[cls] = (classCounts[cls] ?? 0) + 1;
    }

    let favoriteClass: HeroClass | null = null;
    let maxCount = 0;
    for (const [cls, count] of Object.entries(classCounts)) {
      if (count > maxCount) {
        maxCount = count;
        favoriteClass = cls as HeroClass;
      }
    }

    return {
      totalGames,
      totalWins,
      totalKills,
      totalPlayTime,
      highestWave,
      favoriteClass,
    };
  } catch (err) {
    console.error('Get player stats error:', err);
    return null;
  }
};
