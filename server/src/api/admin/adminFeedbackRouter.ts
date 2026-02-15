import { Router, Response } from 'express';
import { getSupabaseAdmin } from '../../services/supabaseAdmin';
import { requireAdmin, AuthenticatedRequest } from '../../middleware/adminAuth';

const router = Router();

// GET /api/admin/feedback/stats - 피드백 통계 요약
router.get('/stats', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Database connection error' });
  }

  try {
    const { data, error } = await supabase
      .from('user_feedback')
      .select('rating');

    if (error) {
      console.error('Get feedback stats error:', error);
      return res.status(500).json({ error: '피드백 통계 조회에 실패했습니다.' });
    }

    const totalCount = data.length;
    const averageRating = totalCount > 0
      ? Math.round(data.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / totalCount * 10) / 10
      : 0;

    // 별점 분포
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const row of data) {
      distribution[row.rating] = (distribution[row.rating] || 0) + 1;
    }

    res.json({
      totalCount,
      averageRating,
      distribution,
    });
  } catch (err) {
    console.error('Get feedback stats error:', err);
    res.status(500).json({ error: '피드백 통계 조회 중 오류가 발생했습니다.' });
  }
});

// GET /api/admin/feedback - 피드백 목록 (페이지네이션 + 필터)
router.get('/', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Database connection error' });
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const ratingFilter = req.query.rating ? parseInt(req.query.rating as string) : null;
  const sortOrder = (req.query.sortOrder as string) === 'asc' ? 'asc' : 'desc';
  const offset = (page - 1) * limit;

  try {
    // 총 개수 쿼리
    let countQuery = supabase
      .from('user_feedback')
      .select('*', { count: 'exact', head: true });

    if (ratingFilter && ratingFilter >= 1 && ratingFilter <= 5) {
      countQuery = countQuery.eq('rating', ratingFilter);
    }

    const { count: totalCount, error: countError } = await countQuery;

    if (countError) {
      console.error('Get feedback count error:', countError);
      return res.status(500).json({ error: '피드백 조회에 실패했습니다.' });
    }

    // 피드백 목록 쿼리 (player_profiles 조인)
    let listQuery = supabase
      .from('user_feedback')
      .select(`
        id,
        player_id,
        rating,
        comment,
        created_at,
        updated_at,
        player_profiles!inner(nickname, player_level)
      `)
      .order('created_at', { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);

    if (ratingFilter && ratingFilter >= 1 && ratingFilter <= 5) {
      listQuery = listQuery.eq('rating', ratingFilter);
    }

    const { data, error } = await listQuery;

    if (error) {
      console.error('Get feedback list error:', error);
      return res.status(500).json({ error: '피드백 목록 조회에 실패했습니다.' });
    }

    const feedback = (data || []).map((row: Record<string, unknown>) => {
      const profile = row.player_profiles as Record<string, unknown> | null;
      return {
        id: row.id,
        playerId: row.player_id,
        playerNickname: profile?.nickname ?? '알 수 없음',
        playerLevel: profile?.player_level ?? 0,
        rating: row.rating,
        comment: row.comment,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });

    res.json({
      feedback,
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limit),
      },
    });
  } catch (err) {
    console.error('Get feedback list error:', err);
    res.status(500).json({ error: '피드백 목록 조회 중 오류가 발생했습니다.' });
  }
});

// DELETE /api/admin/feedback/:id - 피드백 삭제
router.delete('/:id', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Database connection error' });
  }

  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('user_feedback')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Delete feedback error:', error);
      return res.status(500).json({ error: '피드백 삭제에 실패했습니다.' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Delete feedback error:', err);
    res.status(500).json({ error: '피드백 삭제 중 오류가 발생했습니다.' });
  }
});

export default router;
