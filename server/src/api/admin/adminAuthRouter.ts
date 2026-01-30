import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { getSupabaseAdmin } from '../../services/supabaseAdmin';
import {
  generateAdminToken,
  verifyAdminToken,
  requireAdmin,
  AuthenticatedRequest
} from '../../middleware/adminAuth';

const router = Router();

// POST /api/admin/auth/login - 관리자 로그인
router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: '아이디와 비밀번호를 입력해주세요.' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Database connection error' });
  }

  try {
    // 관리자 계정 조회
    const { data: admin, error } = await supabase
      .from('admin_accounts')
      .select('*')
      .eq('username', username)
      .eq('is_active', true)
      .single();

    if (error || !admin) {
      return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }

    // 비밀번호 검증
    const isPasswordValid = await bcrypt.compare(password, admin.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }

    // 마지막 로그인 시간 업데이트
    await supabase
      .from('admin_accounts')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', admin.id);

    // 활동 로그 기록
    await supabase.from('admin_activity_logs').insert({
      admin_id: admin.id,
      action: 'LOGIN',
      details: { ip: req.ip },
      ip_address: req.ip,
    });

    // JWT 토큰 생성
    const token = generateAdminToken({
      adminId: admin.id,
      username: admin.username,
      role: admin.role,
    });

    res.json({
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        nickname: admin.nickname,
        role: admin.role,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: '로그인 처리 중 오류가 발생했습니다.' });
  }
});

// POST /api/admin/auth/logout - 로그아웃 (활동 로그 기록)
router.post('/logout', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const supabase = getSupabaseAdmin();
  if (!supabase || !req.admin) {
    return res.status(500).json({ error: 'Server error' });
  }

  try {
    // 활동 로그 기록
    await supabase.from('admin_activity_logs').insert({
      admin_id: req.admin.adminId,
      action: 'LOGOUT',
      ip_address: req.ip,
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: '로그아웃 처리 중 오류가 발생했습니다.' });
  }
});

// GET /api/admin/auth/verify - 토큰 검증
router.get('/verify', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ valid: false });
  }

  const token = authHeader.substring(7);
  const payload = verifyAdminToken(token);

  if (!payload) {
    return res.status(401).json({ valid: false });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Database connection error' });
  }

  try {
    // 관리자 계정 활성화 상태 확인
    const { data: admin, error } = await supabase
      .from('admin_accounts')
      .select('id, username, nickname, role, is_active')
      .eq('id', payload.adminId)
      .single();

    if (error || !admin || !admin.is_active) {
      return res.status(401).json({ valid: false });
    }

    res.json({
      valid: true,
      admin: {
        id: admin.id,
        username: admin.username,
        nickname: admin.nickname,
        role: admin.role,
      },
    });
  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ error: '검증 처리 중 오류가 발생했습니다.' });
  }
});

// POST /api/admin/auth/change-password - 비밀번호 변경
router.post('/change-password', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: '현재 비밀번호와 새 비밀번호를 입력해주세요.' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: '새 비밀번호는 8자 이상이어야 합니다.' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase || !req.admin) {
    return res.status(500).json({ error: 'Server error' });
  }

  try {
    // 현재 비밀번호 확인
    const { data: admin, error } = await supabase
      .from('admin_accounts')
      .select('password_hash')
      .eq('id', req.admin.adminId)
      .single();

    if (error || !admin) {
      return res.status(404).json({ error: '관리자 계정을 찾을 수 없습니다.' });
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, admin.password_hash);
    if (!isPasswordValid) {
      return res.status(400).json({ error: '현재 비밀번호가 올바르지 않습니다.' });
    }

    // 새 비밀번호 해시
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // 비밀번호 업데이트
    await supabase
      .from('admin_accounts')
      .update({ password_hash: newPasswordHash })
      .eq('id', req.admin.adminId);

    // 활동 로그 기록
    await supabase.from('admin_activity_logs').insert({
      admin_id: req.admin.adminId,
      action: 'CHANGE_PASSWORD',
      ip_address: req.ip,
    });

    res.json({ success: true, message: '비밀번호가 변경되었습니다.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: '비밀번호 변경 중 오류가 발생했습니다.' });
  }
});

export default router;
