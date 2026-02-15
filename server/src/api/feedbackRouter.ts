import { Router, Request, Response } from 'express';
import { getSupabaseAdmin, isSupabaseConfigured } from '../services/supabaseAdmin';
import { filterProfanity } from '../utils/profanityFilter';

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

// 전체 평균 별점 + 총 개수 (공개)
// NOTE: /summary/stats를 /:playerId보다 먼저 등록해야 'summary'가 playerId로 매칭되지 않음
router.get('/summary/stats', async (req: Request, res: Response) => {
  const supabase = getSupabaseAdmin()!;

  try {
    const { data, error } = await supabase
      .from('user_feedback')
      .select('rating');

    if (error) {
      console.error('Get feedback summary error:', error);
      res.status(500).json({ success: false, error: '피드백 요약 조회에 실패했습니다.' });
      return;
    }

    const totalCount = data.length;
    const averageRating = totalCount > 0
      ? data.reduce((sum: number, row: { rating: number }) => sum + row.rating, 0) / totalCount
      : 0;

    res.json({
      success: true,
      summary: {
        averageRating: Math.round(averageRating * 10) / 10,
        totalCount,
      },
    });
  } catch (err) {
    console.error('Get feedback summary error:', err);
    res.status(500).json({ success: false, error: '피드백 요약 조회 중 오류가 발생했습니다.' });
  }
});

// 내 피드백 조회
router.get('/:playerId', async (req: Request, res: Response) => {
  const { playerId } = req.params;

  if (!playerId) {
    res.status(400).json({ success: false, error: '플레이어 ID가 필요합니다.' });
    return;
  }

  const supabase = getSupabaseAdmin()!;

  try {
    const { data, error } = await supabase
      .from('user_feedback')
      .select('rating, comment')
      .eq('player_id', playerId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found (정상: 아직 피드백 없음)
      console.error('Get feedback error:', error);
      res.status(500).json({ success: false, error: '피드백 조회에 실패했습니다.' });
      return;
    }

    res.json({
      success: true,
      feedback: data ? { rating: data.rating, comment: data.comment } : null,
    });
  } catch (err) {
    console.error('Get feedback error:', err);
    res.status(500).json({ success: false, error: '피드백 조회 중 오류가 발생했습니다.' });
  }
});

// 피드백 작성/수정 (upsert)
router.post('/', async (req: Request, res: Response) => {
  const { playerId, rating, comment } = req.body;

  if (!playerId) {
    res.status(400).json({ success: false, error: '플레이어 ID가 필요합니다.' });
    return;
  }

  if (!rating || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    res.status(400).json({ success: false, error: '별점은 1~5 사이의 정수여야 합니다.' });
    return;
  }

  const rawComment = typeof comment === 'string' ? comment.slice(0, 500) : '';
  const filteredComment = filterProfanity(rawComment);

  const supabase = getSupabaseAdmin()!;

  try {
    const { error } = await supabase
      .from('user_feedback')
      .upsert(
        {
          player_id: playerId,
          rating,
          comment: filteredComment,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'player_id' }
      );

    if (error) {
      console.error('Upsert feedback error:', error);
      res.status(500).json({ success: false, error: '피드백 저장에 실패했습니다.' });
      return;
    }

    // EXP 보상: feedback_exp_claimed가 false인 경우에만 (관리자 삭제 후 재작성 시 중복 방지)
    let expRewarded = 0;
    const { data: profileData, error: profileError } = await supabase
      .from('player_profiles')
      .select('player_exp, player_level, feedback_exp_claimed')
      .eq('id', playerId)
      .single();

    if (!profileError && profileData && !profileData.feedback_exp_claimed) {
      let newExp = profileData.player_exp + 50;
      let newLevel = profileData.player_level;
      // 레벨업 처리 (요구 경험치: level * 100)
      while (newExp >= newLevel * 100) {
        newExp -= newLevel * 100;
        newLevel++;
      }

      await supabase
        .from('player_profiles')
        .update({ player_exp: newExp, player_level: newLevel, feedback_exp_claimed: true })
        .eq('id', playerId);

      expRewarded = 50;
    }

    res.json({ success: true, expRewarded });
  } catch (err) {
    console.error('Upsert feedback error:', err);
    res.status(500).json({ success: false, error: '피드백 저장 중 오류가 발생했습니다.' });
  }
});

export default router;
