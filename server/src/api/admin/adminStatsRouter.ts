import { Router, Response } from 'express';
import { getSupabaseAdmin } from '../../services/supabaseAdmin';
import { requireAdmin, AuthenticatedRequest } from '../../middleware/adminAuth';
import { players, getLoggedInUserCount } from '../../state/players';

const router = Router();

// GET /api/admin/stats/overview - 전체 통계 개요
router.get('/overview', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Database connection error' });
  }

  try {
    // 총 플레이어 수
    const { count: totalPlayers } = await supabase
      .from('player_profiles')
      .select('*', { count: 'exact', head: true });

    // 밴된 플레이어 수
    const { count: bannedPlayers } = await supabase
      .from('player_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_banned', true);

    // 게스트 플레이어 수
    const { count: guestPlayers } = await supabase
      .from('player_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_guest', true);

    // 오늘 가입한 플레이어 수
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: newPlayersToday } = await supabase
      .from('player_profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());

    // 지난 7일 가입자
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const { count: newPlayersWeek } = await supabase
      .from('player_profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekAgo.toISOString());

    // 총 게임 수
    const { count: totalGames } = await supabase
      .from('game_history')
      .select('*', { count: 'exact', head: true });

    // 오늘 플레이된 게임 수
    const { count: gamesToday } = await supabase
      .from('game_history')
      .select('*', { count: 'exact', head: true })
      .gte('played_at', today.toISOString());

    // 현재 접속자 수 (WebSocket에서 가져옴)
    const currentOnline = players.size;           // WebSocket 연결 수
    const loggedInUsers = getLoggedInUserCount(); // 로그인된 사용자 수

    res.json({
      totalPlayers: totalPlayers || 0,
      bannedPlayers: bannedPlayers || 0,
      guestPlayers: guestPlayers || 0,
      newPlayersToday: newPlayersToday || 0,
      newPlayersWeek: newPlayersWeek || 0,
      totalGames: totalGames || 0,
      gamesToday: gamesToday || 0,
      currentOnline,
      loggedInUsers,
    });
  } catch (err) {
    console.error('Fetch overview stats error:', err);
    res.status(500).json({ error: '통계를 가져오는 중 오류가 발생했습니다.' });
  }
});

// GET /api/admin/stats/class-popularity - 클래스별 인기도
router.get('/class-popularity', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Database connection error' });
  }

  try {
    // 클래스별 사용 횟수
    const { data: classUsage } = await supabase
      .from('game_history')
      .select('class_used');

    const classCount: Record<string, number> = {
      archer: 0,
      warrior: 0,
      knight: 0,
      mage: 0,
    };

    classUsage?.forEach(game => {
      if (classCount.hasOwnProperty(game.class_used)) {
        classCount[game.class_used]++;
      }
    });

    const total = Object.values(classCount).reduce((a, b) => a + b, 0);

    // 클래스별 승률
    const { data: classWins } = await supabase
      .from('game_history')
      .select('class_used, victory');

    const winStats: Record<string, { wins: number; total: number }> = {
      archer: { wins: 0, total: 0 },
      warrior: { wins: 0, total: 0 },
      knight: { wins: 0, total: 0 },
      mage: { wins: 0, total: 0 },
    };

    classWins?.forEach(game => {
      if (winStats[game.class_used]) {
        winStats[game.class_used].total++;
        if (game.victory) winStats[game.class_used].wins++;
      }
    });

    const classData = Object.entries(classCount).map(([className, count]) => {
      const stats = winStats[className] || { wins: 0, total: 0 };
      return {
        className,
        count,
        percentage: total > 0 ? ((count / total) * 100).toFixed(1) : '0',
        winRate: stats.total > 0
          ? ((stats.wins / stats.total) * 100).toFixed(1)
          : '0',
      };
    });

    res.json({ classData, totalGames: total });
  } catch (err) {
    console.error('Fetch class popularity error:', err);
    res.status(500).json({ error: '클래스 통계를 가져오는 중 오류가 발생했습니다.' });
  }
});

// GET /api/admin/stats/game-modes - 게임 모드별 통계
router.get('/game-modes', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Database connection error' });
  }

  try {
    const { data: games } = await supabase
      .from('game_history')
      .select('mode, victory, wave_reached, kills, play_time');

    const modeStats: Record<string, {
      count: number;
      wins: number;
      totalWaves: number;
      totalKills: number;
      totalPlayTime: number;
    }> = {
      single: { count: 0, wins: 0, totalWaves: 0, totalKills: 0, totalPlayTime: 0 },
      coop: { count: 0, wins: 0, totalWaves: 0, totalKills: 0, totalPlayTime: 0 },
    };

    games?.forEach(game => {
      if (modeStats[game.mode]) {
        modeStats[game.mode].count++;
        if (game.victory) modeStats[game.mode].wins++;
        modeStats[game.mode].totalWaves += game.wave_reached;
        modeStats[game.mode].totalKills += game.kills;
        modeStats[game.mode].totalPlayTime += game.play_time;
      }
    });

    const modeData = Object.entries(modeStats).map(([mode, stats]) => ({
      mode,
      count: stats.count,
      wins: stats.wins,
      winRate: stats.count > 0 ? ((stats.wins / stats.count) * 100).toFixed(1) : '0',
      avgWaveReached: stats.count > 0 ? (stats.totalWaves / stats.count).toFixed(1) : '0',
      avgKills: stats.count > 0 ? (stats.totalKills / stats.count).toFixed(1) : '0',
      avgPlayTime: stats.count > 0 ? (stats.totalPlayTime / stats.count / 60).toFixed(1) : '0', // 분 단위
    }));

    res.json({ modeData });
  } catch (err) {
    console.error('Fetch game modes stats error:', err);
    res.status(500).json({ error: '게임 모드 통계를 가져오는 중 오류가 발생했습니다.' });
  }
});

// GET /api/admin/stats/user-growth - 사용자 증가 추이 (최근 30일)
router.get('/user-growth', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Database connection error' });
  }

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: players } = await supabase
      .from('player_profiles')
      .select('created_at')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: true });

    // 날짜별 그룹핑
    const dailyData: Record<string, number> = {};

    // 최근 30일 초기화
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dailyData[dateStr] = 0;
    }

    players?.forEach(player => {
      const dateStr = player.created_at.split('T')[0];
      if (dailyData.hasOwnProperty(dateStr)) {
        dailyData[dateStr]++;
      }
    });

    const growthData = Object.entries(dailyData).map(([date, count]) => ({
      date,
      newUsers: count,
    }));

    // 누적 사용자 수 계산
    const { count: totalBefore } = await supabase
      .from('player_profiles')
      .select('*', { count: 'exact', head: true })
      .lt('created_at', thirtyDaysAgo.toISOString());

    let cumulative = totalBefore || 0;
    const cumulativeData = growthData.map(item => {
      cumulative += item.newUsers;
      return {
        ...item,
        totalUsers: cumulative,
      };
    });

    res.json({ growthData: cumulativeData });
  } catch (err) {
    console.error('Fetch user growth error:', err);
    res.status(500).json({ error: '사용자 증가 통계를 가져오는 중 오류가 발생했습니다.' });
  }
});

// GET /api/admin/stats/games-daily - 일별 게임 수 (최근 30일)
router.get('/games-daily', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Database connection error' });
  }

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: games } = await supabase
      .from('game_history')
      .select('played_at, mode')
      .gte('played_at', thirtyDaysAgo.toISOString());

    // 날짜별 그룹핑
    const dailyData: Record<string, { single: number; coop: number }> = {};

    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dailyData[dateStr] = { single: 0, coop: 0 };
    }

    games?.forEach(game => {
      const dateStr = game.played_at.split('T')[0];
      if (dailyData[dateStr] && game.mode) {
        dailyData[dateStr][game.mode as 'single' | 'coop']++;
      }
    });

    const gamesData = Object.entries(dailyData).map(([date, counts]) => ({
      date,
      single: counts.single,
      coop: counts.coop,
      total: counts.single + counts.coop,
    }));

    res.json({ gamesData });
  } catch (err) {
    console.error('Fetch daily games error:', err);
    res.status(500).json({ error: '일별 게임 통계를 가져오는 중 오류가 발생했습니다.' });
  }
});

export default router;
