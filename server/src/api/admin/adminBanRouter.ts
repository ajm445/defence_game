import { Router, Response } from 'express';
import { getSupabaseAdmin } from '../../services/supabaseAdmin';
import { requireAdmin, requireSuperAdmin, AuthenticatedRequest } from '../../middleware/adminAuth';

const router = Router();

// POST /api/admin/players/:id/ban - 플레이어 밴 처리 (Super Admin만)
router.post('/:id/ban', requireAdmin, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { reason, expiresAt } = req.body;

  if (!reason || reason.trim().length === 0) {
    return res.status(400).json({ error: '밴 사유를 입력해주세요.' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase || !req.admin) {
    return res.status(500).json({ error: 'Server error' });
  }

  try {
    // 플레이어 존재 확인
    const { data: player, error: fetchError } = await supabase
      .from('player_profiles')
      .select('id, nickname, is_banned')
      .eq('id', id)
      .single();

    if (fetchError || !player) {
      return res.status(404).json({ error: '플레이어를 찾을 수 없습니다.' });
    }

    if (player.is_banned) {
      return res.status(400).json({ error: '이미 밴 처리된 플레이어입니다.' });
    }

    // 밴 만료일 처리
    let expiresAtDate: string | null = null;
    if (expiresAt) {
      expiresAtDate = new Date(expiresAt).toISOString();
    }

    // 밴 기록 생성
    const { data: ban, error: banError } = await supabase
      .from('player_bans')
      .insert({
        player_id: id,
        banned_by: req.admin.adminId,
        reason: reason.trim(),
        expires_at: expiresAtDate,
        is_active: true,
      })
      .select()
      .single();

    if (banError) {
      throw banError;
    }

    // 플레이어 밴 상태 업데이트
    await supabase
      .from('player_profiles')
      .update({
        is_banned: true,
        banned_until: expiresAtDate,
      })
      .eq('id', id);

    // 활동 로그 기록
    await supabase.from('admin_activity_logs').insert({
      admin_id: req.admin.adminId,
      action: 'BAN_PLAYER',
      target_type: 'player',
      target_id: id,
      details: {
        nickname: player.nickname,
        reason: reason.trim(),
        expiresAt: expiresAtDate,
        isPermanent: !expiresAtDate,
      },
      ip_address: req.ip,
    });

    res.json({
      success: true,
      message: expiresAtDate
        ? `플레이어가 ${new Date(expiresAtDate).toLocaleDateString('ko-KR')}까지 밴 처리되었습니다.`
        : '플레이어가 영구 밴 처리되었습니다.',
      ban: {
        id: ban.id,
        playerId: ban.player_id,
        reason: ban.reason,
        bannedAt: ban.banned_at,
        expiresAt: ban.expires_at,
      },
    });
  } catch (err) {
    console.error('Ban player error:', err);
    res.status(500).json({ error: '밴 처리 중 오류가 발생했습니다.' });
  }
});

// DELETE /api/admin/players/:id/ban - 밴 해제 (Super Admin만)
router.delete('/:id/ban', requireAdmin, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const supabase = getSupabaseAdmin();
  if (!supabase || !req.admin) {
    return res.status(500).json({ error: 'Server error' });
  }

  try {
    // 플레이어 존재 및 밴 상태 확인
    const { data: player, error: fetchError } = await supabase
      .from('player_profiles')
      .select('id, nickname, is_banned')
      .eq('id', id)
      .single();

    if (fetchError || !player) {
      return res.status(404).json({ error: '플레이어를 찾을 수 없습니다.' });
    }

    if (!player.is_banned) {
      return res.status(400).json({ error: '밴 상태가 아닌 플레이어입니다.' });
    }

    // 활성 밴 기록 업데이트
    await supabase
      .from('player_bans')
      .update({
        is_active: false,
        unbanned_at: new Date().toISOString(),
        unbanned_by: req.admin.adminId,
      })
      .eq('player_id', id)
      .eq('is_active', true);

    // 플레이어 밴 상태 해제
    await supabase
      .from('player_profiles')
      .update({
        is_banned: false,
        banned_until: null,
      })
      .eq('id', id);

    // 활동 로그 기록
    await supabase.from('admin_activity_logs').insert({
      admin_id: req.admin.adminId,
      action: 'UNBAN_PLAYER',
      target_type: 'player',
      target_id: id,
      details: { nickname: player.nickname },
      ip_address: req.ip,
    });

    res.json({
      success: true,
      message: '플레이어의 밴이 해제되었습니다.',
    });
  } catch (err) {
    console.error('Unban player error:', err);
    res.status(500).json({ error: '밴 해제 중 오류가 발생했습니다.' });
  }
});

// GET /api/admin/bans - 밴 목록 조회
router.get('/', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const {
    page = '1',
    limit = '20',
    isActive,
  } = req.query;

  const pageNum = Math.max(1, parseInt(page as string, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
  const offset = (pageNum - 1) * limitNum;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Database connection error' });
  }

  try {
    let query = supabase
      .from('player_bans')
      .select(`
        *,
        player:player_profiles!player_bans_player_id_fkey(id, nickname),
        banned_by_admin:admin_accounts!player_bans_banned_by_fkey(nickname),
        unbanned_by_admin:admin_accounts!player_bans_unbanned_by_fkey(nickname)
      `, { count: 'exact' });

    // 활성 밴 필터
    if (isActive === 'true') {
      query = query.eq('is_active', true);
    } else if (isActive === 'false') {
      query = query.eq('is_active', false);
    }

    query = query
      .order('banned_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    const { data: bans, error, count } = await query;

    if (error) {
      throw error;
    }

    res.json({
      bans: bans?.map(ban => ({
        id: ban.id,
        player: ban.player ? {
          id: ban.player.id,
          nickname: ban.player.nickname,
        } : null,
        reason: ban.reason,
        bannedAt: ban.banned_at,
        expiresAt: ban.expires_at,
        unbannedAt: ban.unbanned_at,
        isActive: ban.is_active,
        bannedBy: ban.banned_by_admin?.nickname,
        unbannedBy: ban.unbanned_by_admin?.nickname,
      })) || [],
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limitNum),
      },
    });
  } catch (err) {
    console.error('Fetch bans error:', err);
    res.status(500).json({ error: '밴 목록을 가져오는 중 오류가 발생했습니다.' });
  }
});

export default router;
