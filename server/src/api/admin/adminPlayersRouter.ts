import { Router, Response } from 'express';
import { getSupabaseAdmin } from '../../services/supabaseAdmin';
import { requireAdmin, requireSuperAdmin, AuthenticatedRequest } from '../../middleware/adminAuth';
import { onlineUserIds } from '../../state/players';

const router = Router();

// GET /api/admin/players - 플레이어 목록 (페이지네이션, 검색, 필터)
router.get('/', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const {
    page = '1',
    limit = '20',
    search = '',
    sortBy = 'created_at',
    sortOrder = 'desc',
    isBanned,
  } = req.query;

  const pageNum = Math.max(1, parseInt(page as string, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
  const offset = (pageNum - 1) * limitNum;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Database connection error' });
  }

  try {
    // 기본 쿼리 빌더
    let query = supabase
      .from('player_profiles')
      .select(`
        *,
        class_progress (
          class_name,
          class_level,
          class_exp,
          advanced_class,
          tier,
          sp
        ),
        game_history (
          id
        )
      `, { count: 'exact' });

    // 검색 필터
    if (search) {
      query = query.ilike('nickname', `%${search}%`);
    }

    // 밴 상태 필터
    if (isBanned === 'true') {
      query = query.eq('is_banned', true);
    } else if (isBanned === 'false') {
      query = query.eq('is_banned', false);
    }

    // 정렬
    const validSortFields = ['created_at', 'updated_at', 'nickname', 'player_level', 'player_exp'];
    const sortField = validSortFields.includes(sortBy as string) ? sortBy as string : 'created_at';
    const ascending = sortOrder === 'asc';
    query = query.order(sortField, { ascending });

    // 페이지네이션
    query = query.range(offset, offset + limitNum - 1);

    const { data: players, error, count } = await query;

    if (error) {
      console.error('Fetch players error:', error);
      return res.status(500).json({ error: '플레이어 목록을 가져오는 중 오류가 발생했습니다.' });
    }

    // 응답 데이터 가공
    const playersWithStats = players?.map(player => ({
      id: player.id,
      nickname: player.nickname,
      playerLevel: player.player_level,
      playerExp: player.player_exp,
      isGuest: player.is_guest,
      isBanned: player.is_banned,
      bannedUntil: player.banned_until,
      isOnline: onlineUserIds.has(player.id),
      createdAt: player.created_at,
      updatedAt: player.updated_at,
      classProgress: (player.class_progress || []).map((cp: Record<string, unknown>) => ({
        className: cp.class_name,
        classLevel: cp.class_level,
        classExp: cp.class_exp,
        advancedClass: cp.advanced_class,
        tier: cp.tier,
        sp: cp.sp || 0,
      })),
      totalGames: player.game_history?.length || 0,
    })) || [];

    res.json({
      players: playersWithStats,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limitNum),
      },
    });
  } catch (err) {
    console.error('Fetch players error:', err);
    res.status(500).json({ error: '플레이어 목록을 가져오는 중 오류가 발생했습니다.' });
  }
});

// GET /api/admin/players/:id - 플레이어 상세 정보
router.get('/:id', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Database connection error' });
  }

  try {
    // 플레이어 기본 정보
    const { data: player, error: playerError } = await supabase
      .from('player_profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (playerError || !player) {
      return res.status(404).json({ error: '플레이어를 찾을 수 없습니다.' });
    }

    // 클래스 진행 정보
    const { data: classProgress } = await supabase
      .from('class_progress')
      .select('*')
      .eq('player_id', id);

    // 최근 게임 기록 (20개)
    const { data: recentGames } = await supabase
      .from('game_history')
      .select('*')
      .eq('player_id', id)
      .order('played_at', { ascending: false })
      .limit(20);

    // 게임 통계
    const { data: gameStats } = await supabase
      .from('game_history')
      .select('mode, victory, kills, wave_reached, play_time')
      .eq('player_id', id);

    const stats = {
      totalGames: gameStats?.length || 0,
      totalWins: gameStats?.filter(g => g.victory).length || 0,
      totalKills: gameStats?.reduce((sum, g) => sum + g.kills, 0) || 0,
      totalPlayTime: gameStats?.reduce((sum, g) => sum + g.play_time, 0) || 0,
      maxWaveReached: Math.max(...(gameStats?.map(g => g.wave_reached) || [0])),
      singleGames: gameStats?.filter(g => g.mode === 'single').length || 0,
      coopGames: gameStats?.filter(g => g.mode === 'coop').length || 0,
    };

    // 밴 기록
    const { data: banHistory } = await supabase
      .from('player_bans')
      .select(`
        *,
        banned_by_admin:admin_accounts!player_bans_banned_by_fkey(nickname),
        unbanned_by_admin:admin_accounts!player_bans_unbanned_by_fkey(nickname)
      `)
      .eq('player_id', id)
      .order('banned_at', { ascending: false });

    res.json({
      player: {
        id: player.id,
        nickname: player.nickname,
        playerLevel: player.player_level,
        playerExp: player.player_exp,
        isGuest: player.is_guest,
        isBanned: player.is_banned,
        bannedUntil: player.banned_until,
        soundVolume: player.sound_volume,
        soundMuted: player.sound_muted,
        createdAt: player.created_at,
        updatedAt: player.updated_at,
      },
      classProgress: classProgress?.map(cp => ({
        className: cp.class_name,
        classLevel: cp.class_level,
        classExp: cp.class_exp,
        advancedClass: cp.advanced_class,
        tier: cp.tier,
        sp: cp.sp || 0,
        statUpgrades: cp.stat_upgrades || {},
      })) || [],
      recentGames: recentGames?.map(game => ({
        id: game.id,
        mode: game.mode,
        classUsed: game.class_used,
        waveReached: game.wave_reached,
        kills: game.kills,
        playTime: game.play_time,
        victory: game.victory,
        expEarned: game.exp_earned,
        playedAt: game.played_at,
      })) || [],
      stats,
      banHistory: banHistory?.map(ban => ({
        id: ban.id,
        reason: ban.reason,
        bannedAt: ban.banned_at,
        expiresAt: ban.expires_at,
        unbannedAt: ban.unbanned_at,
        isActive: ban.is_active,
        bannedBy: ban.banned_by_admin?.nickname,
        unbannedBy: ban.unbanned_by_admin?.nickname,
      })) || [],
    });
  } catch (err) {
    console.error('Fetch player detail error:', err);
    res.status(500).json({ error: '플레이어 정보를 가져오는 중 오류가 발생했습니다.' });
  }
});

// PATCH /api/admin/players/:id - 플레이어 정보 수정 (Super Admin만)
router.patch('/:id', requireAdmin, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { nickname, playerLevel, playerExp } = req.body;

  const supabase = getSupabaseAdmin();
  if (!supabase || !req.admin) {
    return res.status(500).json({ error: 'Server error' });
  }

  try {
    const updates: Record<string, unknown> = {};
    if (nickname !== undefined) updates.nickname = nickname;
    if (playerLevel !== undefined) updates.player_level = playerLevel;
    if (playerExp !== undefined) updates.player_exp = playerExp;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: '수정할 내용이 없습니다.' });
    }

    const { data: player, error } = await supabase
      .from('player_profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error || !player) {
      return res.status(404).json({ error: '플레이어를 찾을 수 없습니다.' });
    }

    // 활동 로그 기록
    await supabase.from('admin_activity_logs').insert({
      admin_id: req.admin.adminId,
      action: 'UPDATE_PLAYER',
      target_type: 'player',
      target_id: id,
      details: { updates },
      ip_address: req.ip,
    });

    res.json({
      success: true,
      player: {
        id: player.id,
        nickname: player.nickname,
        playerLevel: player.player_level,
        playerExp: player.player_exp,
      },
    });
  } catch (err) {
    console.error('Update player error:', err);
    res.status(500).json({ error: '플레이어 정보 수정 중 오류가 발생했습니다.' });
  }
});

// PATCH /api/admin/players/:id/class/:className - 클래스 진행 정보 수정 (Super Admin만)
router.patch('/:id/class/:className', requireAdmin, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { id, className } = req.params;
  const { classLevel, classExp, sp, statUpgrades } = req.body;

  const supabase = getSupabaseAdmin();
  if (!supabase || !req.admin) {
    return res.status(500).json({ error: 'Server error' });
  }

  try {
    // 클래스 진행 정보 존재 확인
    const { data: existingProgress, error: fetchError } = await supabase
      .from('class_progress')
      .select('*')
      .eq('player_id', id)
      .eq('class_name', className)
      .single();

    if (fetchError || !existingProgress) {
      return res.status(404).json({ error: '해당 클래스 진행 정보를 찾을 수 없습니다.' });
    }

    const updates: Record<string, unknown> = {};
    if (classLevel !== undefined) updates.class_level = classLevel;
    if (classExp !== undefined) updates.class_exp = classExp;
    if (sp !== undefined) updates.sp = sp;
    if (statUpgrades !== undefined) updates.stat_upgrades = statUpgrades;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: '수정할 내용이 없습니다.' });
    }

    const { data: classProgress, error } = await supabase
      .from('class_progress')
      .update(updates)
      .eq('player_id', id)
      .eq('class_name', className)
      .select()
      .single();

    if (error || !classProgress) {
      throw error || new Error('Update failed');
    }

    // 활동 로그 기록
    await supabase.from('admin_activity_logs').insert({
      admin_id: req.admin.adminId,
      action: 'UPDATE_CLASS_PROGRESS',
      target_type: 'class_progress',
      target_id: id,
      details: { className, updates },
      ip_address: req.ip,
    });

    res.json({
      success: true,
      classProgress: {
        className: classProgress.class_name,
        classLevel: classProgress.class_level,
        classExp: classProgress.class_exp,
        sp: classProgress.sp,
        statUpgrades: classProgress.stat_upgrades,
        advancedClass: classProgress.advanced_class,
        tier: classProgress.tier,
      },
    });
  } catch (err) {
    console.error('Update class progress error:', err);
    res.status(500).json({ error: '클래스 정보 수정 중 오류가 발생했습니다.' });
  }
});

// DELETE /api/admin/players/:id - 플레이어 삭제 (Super Admin만)
router.delete('/:id', requireAdmin, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const supabase = getSupabaseAdmin();
  if (!supabase || !req.admin) {
    return res.status(500).json({ error: 'Server error' });
  }

  try {
    // 플레이어 존재 확인
    const { data: player, error: fetchError } = await supabase
      .from('player_profiles')
      .select('nickname')
      .eq('id', id)
      .single();

    if (fetchError || !player) {
      return res.status(404).json({ error: '플레이어를 찾을 수 없습니다.' });
    }

    // 삭제 (CASCADE로 관련 데이터도 삭제됨)
    const { error: deleteError } = await supabase
      .from('player_profiles')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw deleteError;
    }

    // 활동 로그 기록
    await supabase.from('admin_activity_logs').insert({
      admin_id: req.admin.adminId,
      action: 'DELETE_PLAYER',
      target_type: 'player',
      target_id: id,
      details: { nickname: player.nickname },
      ip_address: req.ip,
    });

    res.json({ success: true, message: '플레이어가 삭제되었습니다.' });
  } catch (err) {
    console.error('Delete player error:', err);
    res.status(500).json({ error: '플레이어 삭제 중 오류가 발생했습니다.' });
  }
});

export default router;
