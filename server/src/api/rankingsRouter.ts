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

// 랭킹 플레이어 정보 인터페이스
interface RankingPlayer {
  playerId: string;
  nickname: string;
  heroClass: string;
  advancedClass?: string;
  characterLevel: number;
}

// 극한 난이도 랭킹 조회 (플레이어 수별)
router.get('/extreme/:playerCount', async (req: Request, res: Response) => {
  const playerCount = parseInt(req.params.playerCount);

  if (isNaN(playerCount) || playerCount < 1 || playerCount > 4) {
    res.status(400).json({ success: false, error: '플레이어 수는 1~4 사이여야 합니다.' });
    return;
  }

  const supabase = getSupabaseAdmin()!;

  try {
    const { data, error } = await supabase
      .from('extreme_rankings')
      .select('*')
      .eq('player_count', playerCount)
      .order('clear_time', { ascending: true })
      .limit(20);

    if (error) {
      console.error('Get extreme rankings error:', error);
      res.status(500).json({ success: false, error: '랭킹 조회에 실패했습니다.' });
      return;
    }

    const rankings = data.map((row: Record<string, unknown>) => ({
      id: row.id,
      player_count: row.player_count,
      clear_time: row.clear_time,
      players: row.players,
      cleared_at: row.cleared_at,
    }));

    res.json({ success: true, rankings });
  } catch (err) {
    console.error('Get extreme rankings error:', err);
    res.status(500).json({ success: false, error: '랭킹 조회 중 오류가 발생했습니다.' });
  }
});

// 극한 난이도 랭킹 등록
router.post('/extreme', async (req: Request, res: Response) => {
  const { playerCount, clearTime, players } = req.body as {
    playerCount: number;
    clearTime: number;
    players: RankingPlayer[];
  };

  // 유효성 검사
  if (!playerCount || playerCount < 1 || playerCount > 4) {
    res.status(400).json({ success: false, error: '플레이어 수는 1~4 사이여야 합니다.' });
    return;
  }

  if (!clearTime || clearTime <= 0) {
    res.status(400).json({ success: false, error: '클리어 시간이 유효하지 않습니다.' });
    return;
  }

  if (!players || !Array.isArray(players) || players.length === 0 || players.length !== playerCount) {
    res.status(400).json({ success: false, error: '플레이어 정보가 유효하지 않습니다.' });
    return;
  }

  // 플레이어 정보 유효성 검사
  for (const player of players) {
    if (!player.playerId || !player.nickname || !player.heroClass || player.characterLevel === undefined || player.characterLevel === null) {
      res.status(400).json({ success: false, error: '플레이어 정보가 불완전합니다.' });
      return;
    }
  }

  const supabase = getSupabaseAdmin()!;

  try {
    const { error } = await supabase
      .from('extreme_rankings')
      .insert({
        player_count: playerCount,
        clear_time: clearTime,
        players: players,
      });

    if (error) {
      console.error('Save extreme ranking error:', error);
      res.status(500).json({ success: false, error: '랭킹 저장에 실패했습니다.' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Save extreme ranking error:', err);
    res.status(500).json({ success: false, error: '랭킹 저장 중 오류가 발생했습니다.' });
  }
});

// 유효한 난이도 목록
const VALID_DIFFICULTIES = ['extreme', 'hell', 'apocalypse'] as const;

// 난이도별 랭킹 조회
router.get('/:difficulty/:playerCount', async (req: Request, res: Response) => {
  const { difficulty, playerCount: playerCountStr } = req.params;
  const playerCount = parseInt(playerCountStr);

  if (!VALID_DIFFICULTIES.includes(difficulty as typeof VALID_DIFFICULTIES[number])) {
    res.status(400).json({ success: false, error: '유효하지 않은 난이도입니다.' });
    return;
  }

  if (isNaN(playerCount) || playerCount < 1 || playerCount > 4) {
    res.status(400).json({ success: false, error: '플레이어 수는 1~4 사이여야 합니다.' });
    return;
  }

  const supabase = getSupabaseAdmin()!;

  try {
    const { data, error } = await supabase
      .from('difficulty_rankings')
      .select('*')
      .eq('difficulty', difficulty)
      .eq('player_count', playerCount)
      .order('clear_time', { ascending: true })
      .limit(10);

    if (error) {
      console.error('Get difficulty rankings error:', error);
      res.status(500).json({ success: false, error: '랭킹 조회에 실패했습니다.' });
      return;
    }

    const rankings = data.map((row: Record<string, unknown>) => ({
      id: row.id,
      difficulty: row.difficulty,
      player_count: row.player_count,
      clear_time: row.clear_time,
      players: row.players,
      cleared_at: row.cleared_at,
    }));

    res.json({ success: true, rankings });
  } catch (err) {
    console.error('Get difficulty rankings error:', err);
    res.status(500).json({ success: false, error: '랭킹 조회 중 오류가 발생했습니다.' });
  }
});

// 난이도별 랭킹 등록
router.post('/', async (req: Request, res: Response) => {
  const { difficulty, playerCount, clearTime, players } = req.body as {
    difficulty: string;
    playerCount: number;
    clearTime: number;
    players: RankingPlayer[];
  };

  if (!difficulty || !VALID_DIFFICULTIES.includes(difficulty as typeof VALID_DIFFICULTIES[number])) {
    res.status(400).json({ success: false, error: '유효하지 않은 난이도입니다.' });
    return;
  }

  if (!playerCount || playerCount < 1 || playerCount > 4) {
    res.status(400).json({ success: false, error: '플레이어 수는 1~4 사이여야 합니다.' });
    return;
  }

  if (!clearTime || clearTime <= 0) {
    res.status(400).json({ success: false, error: '클리어 시간이 유효하지 않습니다.' });
    return;
  }

  if (!players || !Array.isArray(players) || players.length === 0 || players.length !== playerCount) {
    res.status(400).json({ success: false, error: '플레이어 정보가 유효하지 않습니다.' });
    return;
  }

  for (const player of players) {
    if (!player.playerId || !player.nickname || !player.heroClass || player.characterLevel === undefined || player.characterLevel === null) {
      res.status(400).json({ success: false, error: '플레이어 정보가 불완전합니다.' });
      return;
    }
  }

  const supabase = getSupabaseAdmin()!;

  try {
    const { error } = await supabase
      .from('difficulty_rankings')
      .insert({
        difficulty,
        player_count: playerCount,
        clear_time: clearTime,
        players: players,
      });

    if (error) {
      console.error('Save difficulty ranking error:', error);
      res.status(500).json({ success: false, error: '랭킹 저장에 실패했습니다.' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Save difficulty ranking error:', err);
    res.status(500).json({ success: false, error: '랭킹 저장 중 오류가 발생했습니다.' });
  }
});

export default router;
