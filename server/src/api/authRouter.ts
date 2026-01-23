import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getSupabaseAdmin, getSupabaseClient, isSupabaseConfigured } from '../services/supabaseAdmin';

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

// 회원가입
router.post('/signup', async (req: Request, res: Response) => {
  const { email, password, nickname } = req.body;

  if (!email || !password || !nickname) {
    res.status(400).json({ success: false, error: '이메일, 비밀번호, 닉네임을 입력해주세요.' });
    return;
  }

  const supabase = getSupabaseAdmin()!;

  try {
    // 1. Auth 사용자 생성
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // 이메일 확인 건너뛰기
      user_metadata: { nickname },
    });

    if (authError) {
      const errorMessage = translateAuthError(authError.message);
      res.status(400).json({ success: false, error: errorMessage });
      return;
    }

    // 2. 플레이어 프로필 생성
    const { error: profileError } = await supabase
      .from('player_profiles')
      .insert({
        id: authData.user.id,
        nickname,
        player_level: 1,
        player_exp: 0,
        is_guest: false,
        sound_volume: 0.5,
        sound_muted: false,
      });

    if (profileError) {
      console.error('Create profile error:', profileError);
      // 프로필 생성 실패 시 Auth 사용자도 삭제
      await supabase.auth.admin.deleteUser(authData.user.id);
      res.status(500).json({ success: false, error: '프로필 생성에 실패했습니다.' });
      return;
    }

    res.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
      },
    });
  } catch (err) {
    console.error('Sign up error:', err);
    res.status(500).json({ success: false, error: '회원가입 중 오류가 발생했습니다.' });
  }
});

// 로그인 (비밀번호 검증 포함)
router.post('/signin', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ success: false, error: '이메일과 비밀번호를 입력해주세요.' });
    return;
  }

  const supabaseClient = getSupabaseClient();
  const supabaseAdmin = getSupabaseAdmin()!;

  try {
    // 1. 일반 클라이언트로 비밀번호 검증
    if (supabaseClient) {
      const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        res.status(401).json({ success: false, error: translateAuthError(authError.message) });
        return;
      }

      if (!authData.user) {
        res.status(401).json({ success: false, error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
        return;
      }

      // 2. 프로필 확인
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('player_profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (profileError || !profile) {
        res.status(401).json({ success: false, error: '프로필이 존재하지 않습니다. 탈퇴된 계정일 수 있습니다.' });
        return;
      }

      // 3. 성공 응답
      res.json({
        success: true,
        user: {
          id: authData.user.id,
          email: authData.user.email,
        },
        profile: {
          id: profile.id,
          nickname: profile.nickname,
          playerLevel: profile.player_level,
          playerExp: profile.player_exp,
          isGuest: profile.is_guest,
          soundVolume: profile.sound_volume,
          soundMuted: profile.sound_muted,
        },
      });
    } else {
      res.status(503).json({ success: false, error: 'Supabase 클라이언트가 설정되지 않았습니다.' });
    }
  } catch (err) {
    console.error('Sign in error:', err);
    res.status(500).json({ success: false, error: '로그인 중 오류가 발생했습니다.' });
  }
});

// 게스트 로그인
// 게스트는 Supabase Auth 계정을 생성하지 않고, 로컬 UUID로 임시 프로필만 반환
router.post('/guest', async (req: Request, res: Response) => {
  const { nickname } = req.body;

  if (!nickname) {
    res.status(400).json({ success: false, error: '닉네임을 입력해주세요.' });
    return;
  }

  try {
    // 로컬 UUID 생성 (Supabase Auth 계정 생성 안 함)
    const guestId = uuidv4();

    // 게스트 프로필은 DB에 저장하지 않고 클라이언트에 직접 반환
    // 세션 간 데이터가 유지되지 않음 (게스트 특성)
    res.json({
      success: true,
      user: {
        id: guestId,
        isGuest: true,
      },
      profile: {
        id: guestId,
        nickname,
        playerLevel: 1,
        playerExp: 0,
        isGuest: true,
        soundVolume: 0.5,
        soundMuted: false,
      },
    });
  } catch (err) {
    console.error('Guest sign in error:', err);
    res.status(500).json({ success: false, error: '게스트 로그인 중 오류가 발생했습니다.' });
  }
});

// 회원 탈퇴
router.delete('/account/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;

  if (!userId) {
    res.status(400).json({ success: false, error: '사용자 ID가 필요합니다.' });
    return;
  }

  const supabase = getSupabaseAdmin()!;

  try {
    // 1. 게임 기록 삭제
    await supabase.from('game_history').delete().eq('player_id', userId);

    // 2. 클래스 진행 상황 삭제
    await supabase.from('class_progress').delete().eq('player_id', userId);

    // 3. 플레이어 프로필 삭제
    const { error: profileError } = await supabase
      .from('player_profiles')
      .delete()
      .eq('id', userId);

    if (profileError) {
      console.error('Delete profile error:', profileError);
      res.status(500).json({ success: false, error: '프로필 삭제에 실패했습니다.' });
      return;
    }

    // 4. Auth에서 사용자 삭제
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);

    if (authError) {
      console.error('Delete auth user error:', authError);
      // 프로필은 이미 삭제되었으므로 경고만 로그
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ success: false, error: '회원 탈퇴 중 오류가 발생했습니다.' });
  }
});

// 프로필 조회
router.get('/profile/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;

  if (!userId) {
    res.status(400).json({ success: false, error: '사용자 ID가 필요합니다.' });
    return;
  }

  const supabase = getSupabaseAdmin()!;

  try {
    const { data: profile, error } = await supabase
      .from('player_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      res.status(404).json({ success: false, error: '프로필을 찾을 수 없습니다.' });
      return;
    }

    res.json({
      success: true,
      profile: {
        id: profile.id,
        nickname: profile.nickname,
        playerLevel: profile.player_level,
        playerExp: profile.player_exp,
        isGuest: profile.is_guest,
        soundVolume: profile.sound_volume,
        soundMuted: profile.sound_muted,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
      },
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ success: false, error: '프로필 조회 중 오류가 발생했습니다.' });
  }
});

// 닉네임 변경
router.patch('/profile/:userId/nickname', async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { nickname } = req.body;

  if (!userId || !nickname) {
    res.status(400).json({ success: false, error: '사용자 ID와 닉네임이 필요합니다.' });
    return;
  }

  const supabase = getSupabaseAdmin()!;

  try {
    const { error } = await supabase
      .from('player_profiles')
      .update({ nickname })
      .eq('id', userId);

    if (error) {
      res.status(500).json({ success: false, error: '닉네임 변경에 실패했습니다.' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Update nickname error:', err);
    res.status(500).json({ success: false, error: '닉네임 변경 중 오류가 발생했습니다.' });
  }
});

// 사운드 설정 변경
router.patch('/profile/:userId/sound', async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { soundVolume, soundMuted } = req.body;

  if (!userId) {
    res.status(400).json({ success: false, error: '사용자 ID가 필요합니다.' });
    return;
  }

  const supabase = getSupabaseAdmin()!;

  try {
    const { error } = await supabase
      .from('player_profiles')
      .update({
        sound_volume: soundVolume,
        sound_muted: soundMuted,
      })
      .eq('id', userId);

    if (error) {
      res.status(500).json({ success: false, error: '사운드 설정 변경에 실패했습니다.' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Update sound settings error:', err);
    res.status(500).json({ success: false, error: '사운드 설정 변경 중 오류가 발생했습니다.' });
  }
});

// 에러 메시지 번역
function translateAuthError(message: string): string {
  const errorMessages: Record<string, string> = {
    'User already registered': '이미 사용 중인 아이디입니다.',
    'Password should be at least 6 characters': '비밀번호는 최소 6자 이상이어야 합니다.',
    'Invalid email': '아이디 형식이 올바르지 않습니다.',
    'Email rate limit exceeded': '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
  };

  return errorMessages[message] || message;
}

export default router;
