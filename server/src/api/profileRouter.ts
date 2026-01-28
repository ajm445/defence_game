import { Router, Request, Response } from 'express';
import { getSupabaseAdmin, isSupabaseConfigured } from '../services/supabaseAdmin';

const router = Router();

// 미들웨어: Supabase 설정 확인
const checkSupabase = (req: Request, res: Response, next: () => void) => {
  if (!isSupabaseConfigured()) {
    res.status(503).json({ success: false, error: 'Supabase가 설정되지 않았습니다.' });
    return;
  }
  next();
};

router.use(checkSupabase);

// 클래스 진행 상황 조회
router.get('/class-progress/:playerId', async (req: Request, res: Response) => {
  const { playerId } = req.params;

  if (!playerId) {
    res.status(400).json({ success: false, error: '플레이어 ID가 필요합니다.' });
    return;
  }

  const supabase = getSupabaseAdmin()!;

  try {
    const { data, error } = await supabase
      .from('class_progress')
      .select('*')
      .eq('player_id', playerId);

    if (error) {
      console.error('Get class progress error:', error);
      res.status(500).json({ success: false, error: '클래스 진행 상황 조회에 실패했습니다.' });
      return;
    }

    const progress = data.map((row: Record<string, unknown>) => ({
      id: row.id,
      playerId: row.player_id,
      className: row.class_name,
      classLevel: row.class_level,
      classExp: row.class_exp,
      sp: row.sp ?? 0,  // SP 포함
      statUpgrades: row.stat_upgrades ?? { attack: 0, speed: 0, hp: 0, attackSpeed: 0, range: 0, hpRegen: 0 },  // 스탯 업그레이드 포함
      advancedClass: row.advanced_class ?? null,  // 전직 직업
      tier: row.tier ?? null,  // 전직 단계
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    res.json({ success: true, progress });
  } catch (err) {
    console.error('Get class progress error:', err);
    res.status(500).json({ success: false, error: '클래스 진행 상황 조회 중 오류가 발생했습니다.' });
  }
});

// 클래스 진행 상황 업데이트/생성
router.post('/class-progress', async (req: Request, res: Response) => {
  const { playerId, className, classLevel, classExp, sp, statUpgrades, advancedClass, tier } = req.body;

  if (!playerId || !className || classLevel === undefined || classExp === undefined) {
    res.status(400).json({ success: false, error: '필수 파라미터가 누락되었습니다.' });
    return;
  }

  const supabase = getSupabaseAdmin()!;

  try {
    const upsertData: Record<string, unknown> = {
      player_id: playerId,
      class_name: className,
      class_level: classLevel,
      class_exp: classExp,
      sp: sp ?? 0,  // SP 저장
      stat_upgrades: statUpgrades ?? { attack: 0, speed: 0, hp: 0, attackSpeed: 0, range: 0, hpRegen: 0 },  // 스탯 업그레이드 저장
      updated_at: new Date().toISOString(),
    };

    // 전직 정보가 있으면 추가 (둘 다 있거나 둘 다 없어야 함)
    if (advancedClass !== undefined) {
      upsertData.advanced_class = advancedClass;
    }
    if (tier !== undefined) {
      upsertData.tier = tier;
    }

    const { error } = await supabase
      .from('class_progress')
      .upsert(upsertData, {
        onConflict: 'player_id,class_name',
      });

    if (error) {
      console.error('Upsert class progress error:', error);
      res.status(500).json({ success: false, error: '클래스 진행 상황 저장에 실패했습니다.' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Upsert class progress error:', err);
    res.status(500).json({ success: false, error: '클래스 진행 상황 저장 중 오류가 발생했습니다.' });
  }
});

// 플레이어 프로필 업데이트 (레벨, 경험치)
router.patch('/player/:playerId', async (req: Request, res: Response) => {
  const { playerId } = req.params;
  const { playerLevel, playerExp } = req.body;

  if (!playerId) {
    res.status(400).json({ success: false, error: '플레이어 ID가 필요합니다.' });
    return;
  }

  const supabase = getSupabaseAdmin()!;

  try {
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (playerLevel !== undefined) updates.player_level = playerLevel;
    if (playerExp !== undefined) updates.player_exp = playerExp;

    const { error } = await supabase
      .from('player_profiles')
      .update(updates)
      .eq('id', playerId);

    if (error) {
      console.error('Update player profile error:', error);
      res.status(500).json({ success: false, error: '프로필 업데이트에 실패했습니다.' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Update player profile error:', err);
    res.status(500).json({ success: false, error: '프로필 업데이트 중 오류가 발생했습니다.' });
  }
});

// 게임 기록 저장
router.post('/game-record', async (req: Request, res: Response) => {
  const { playerId, mode, classUsed, waveReached, kills, playTime, victory, expEarned } = req.body;

  if (!playerId || !mode || !classUsed) {
    res.status(400).json({ success: false, error: '필수 파라미터가 누락되었습니다.' });
    return;
  }

  const supabase = getSupabaseAdmin()!;

  try {
    const { error } = await supabase
      .from('game_history')
      .insert({
        player_id: playerId,
        mode,
        class_used: classUsed,
        wave_reached: waveReached || 0,
        kills: kills || 0,
        play_time: playTime || 0,
        victory: victory || false,
        exp_earned: expEarned || 0,
      });

    if (error) {
      console.error('Save game record error:', error);
      res.status(500).json({ success: false, error: '게임 기록 저장에 실패했습니다.' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Save game record error:', err);
    res.status(500).json({ success: false, error: '게임 기록 저장 중 오류가 발생했습니다.' });
  }
});

// 게임 기록 조회
router.get('/game-history/:playerId', async (req: Request, res: Response) => {
  const { playerId } = req.params;
  const limit = parseInt(req.query.limit as string) || 10;

  if (!playerId) {
    res.status(400).json({ success: false, error: '플레이어 ID가 필요합니다.' });
    return;
  }

  const supabase = getSupabaseAdmin()!;

  try {
    const { data, error } = await supabase
      .from('game_history')
      .select('*')
      .eq('player_id', playerId)
      .order('played_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Get game history error:', error);
      res.status(500).json({ success: false, error: '게임 기록 조회에 실패했습니다.' });
      return;
    }

    const history = data.map((row: Record<string, unknown>) => ({
      id: row.id,
      playerId: row.player_id,
      mode: row.mode,
      classUsed: row.class_used,
      waveReached: row.wave_reached,
      kills: row.kills,
      playTime: row.play_time,
      victory: row.victory,
      expEarned: row.exp_earned,
      playedAt: row.played_at,
    }));

    res.json({ success: true, history });
  } catch (err) {
    console.error('Get game history error:', err);
    res.status(500).json({ success: false, error: '게임 기록 조회 중 오류가 발생했습니다.' });
  }
});

// 플레이어 통계 조회
router.get('/stats/:playerId', async (req: Request, res: Response) => {
  const { playerId } = req.params;

  if (!playerId) {
    res.status(400).json({ success: false, error: '플레이어 ID가 필요합니다.' });
    return;
  }

  const supabase = getSupabaseAdmin()!;

  try {
    const { data, error } = await supabase
      .from('game_history')
      .select('*')
      .eq('player_id', playerId);

    if (error) {
      console.error('Get player stats error:', error);
      res.status(500).json({ success: false, error: '통계 조회에 실패했습니다.' });
      return;
    }

    if (!data || data.length === 0) {
      res.json({
        success: true,
        stats: {
          totalGames: 0,
          totalWins: 0,
          totalKills: 0,
          totalPlayTime: 0,
          highestWave: 0,
          favoriteClass: null,
        },
      });
      return;
    }

    const totalGames = data.length;
    const totalWins = data.filter((g: Record<string, unknown>) => g.victory).length;
    const totalKills = data.reduce((sum: number, g: Record<string, unknown>) => sum + ((g.kills as number) || 0), 0);
    const totalPlayTime = data.reduce((sum: number, g: Record<string, unknown>) => sum + ((g.play_time as number) || 0), 0);
    const highestWave = Math.max(...data.map((g: Record<string, unknown>) => (g.wave_reached as number) || 0));

    // 가장 많이 사용한 클래스 찾기
    const classCounts: Record<string, number> = {};
    for (const game of data) {
      const cls = game.class_used as string;
      classCounts[cls] = (classCounts[cls] ?? 0) + 1;
    }

    let favoriteClass: string | null = null;
    let maxCount = 0;
    for (const [cls, count] of Object.entries(classCounts)) {
      if (count > maxCount) {
        maxCount = count;
        favoriteClass = cls;
      }
    }

    res.json({
      success: true,
      stats: {
        totalGames,
        totalWins,
        totalKills,
        totalPlayTime,
        highestWave,
        favoriteClass,
      },
    });
  } catch (err) {
    console.error('Get player stats error:', err);
    res.status(500).json({ success: false, error: '통계 조회 중 오류가 발생했습니다.' });
  }
});

export default router;
