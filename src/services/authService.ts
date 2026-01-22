import { supabase, isSupabaseConfigured } from './supabase';
import { PlayerProfile } from '../types/auth';
import type { User, Session, AuthError } from '@supabase/supabase-js';

export interface AuthResult {
  success: boolean;
  user?: User;
  session?: Session;
  error?: string;
}

export interface SignUpResult extends AuthResult {
  needsEmailConfirmation?: boolean;
}

// 이메일로 회원가입
export const signUpWithEmail = async (
  email: string,
  password: string,
  nickname: string
): Promise<SignUpResult> => {
  if (!isSupabaseConfigured() || !supabase) {
    return { success: false, error: 'Supabase가 설정되지 않았습니다.' };
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nickname,
        },
      },
    });

    if (error) {
      return { success: false, error: translateAuthError(error) };
    }

    if (data.user && !data.session) {
      // 이메일 확인이 필요한 경우
      return {
        success: true,
        user: data.user,
        needsEmailConfirmation: true,
      };
    }

    // 프로필 생성
    if (data.user) {
      await createPlayerProfile(data.user.id, nickname, false);
    }

    return {
      success: true,
      user: data.user ?? undefined,
      session: data.session ?? undefined,
    };
  } catch (err) {
    console.error('Sign up error:', err);
    return { success: false, error: '회원가입 중 오류가 발생했습니다.' };
  }
};

// 이메일로 로그인
export const signInWithEmail = async (
  email: string,
  password: string
): Promise<AuthResult> => {
  if (!isSupabaseConfigured() || !supabase) {
    return { success: false, error: 'Supabase가 설정되지 않았습니다.' };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { success: false, error: translateAuthError(error) };
    }

    return {
      success: true,
      user: data.user,
      session: data.session,
    };
  } catch (err) {
    console.error('Sign in error:', err);
    return { success: false, error: '로그인 중 오류가 발생했습니다.' };
  }
};

// 게스트로 로그인 (익명 세션)
export const signInAsGuest = async (nickname: string): Promise<AuthResult> => {
  if (!isSupabaseConfigured() || !supabase) {
    // Supabase 없이 로컬 게스트 모드
    return {
      success: true,
      user: {
        id: `guest_${Date.now()}`,
        email: undefined,
      } as unknown as User,
    };
  }

  try {
    const { data, error } = await supabase.auth.signInAnonymously();

    if (error) {
      return { success: false, error: translateAuthError(error) };
    }

    // 게스트 프로필 생성
    if (data.user) {
      await createPlayerProfile(data.user.id, nickname, true);
    }

    return {
      success: true,
      user: data.user ?? undefined,
      session: data.session ?? undefined,
    };
  } catch (err) {
    console.error('Guest sign in error:', err);
    // Supabase 오류 시 로컬 게스트 모드로 폴백
    return {
      success: true,
      user: {
        id: `guest_${Date.now()}`,
        email: undefined,
      } as unknown as User,
    };
  }
};

// 로그아웃
export const signOut = async (): Promise<{ success: boolean; error?: string }> => {
  if (!isSupabaseConfigured() || !supabase) {
    return { success: true };
  }

  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return { success: false, error: translateAuthError(error) };
    }

    return { success: true };
  } catch (err) {
    console.error('Sign out error:', err);
    return { success: false, error: '로그아웃 중 오류가 발생했습니다.' };
  }
};

// 현재 세션 가져오기
export const getCurrentSession = async (): Promise<Session | null> => {
  if (!isSupabaseConfigured() || !supabase) {
    return null;
  }

  try {
    const { data } = await supabase.auth.getSession();
    return data.session;
  } catch (err) {
    console.error('Get session error:', err);
    return null;
  }
};

// 현재 유저 가져오기
export const getCurrentUser = async (): Promise<User | null> => {
  if (!isSupabaseConfigured() || !supabase) {
    return null;
  }

  try {
    const { data } = await supabase.auth.getUser();
    return data.user;
  } catch (err) {
    console.error('Get user error:', err);
    return null;
  }
};

// 플레이어 프로필 생성
export const createPlayerProfile = async (
  userId: string,
  nickname: string,
  isGuest: boolean
): Promise<PlayerProfile | null> => {
  if (!isSupabaseConfigured() || !supabase) {
    // 로컬 프로필 반환
    return {
      id: userId,
      nickname,
      playerLevel: 1,
      playerExp: 0,
      isGuest,
      soundVolume: 0.5,
      soundMuted: false,
    };
  }

  try {
    const { data, error } = await supabase
      .from('player_profiles')
      .upsert({
        id: userId,
        nickname,
        player_level: 1,
        player_exp: 0,
        is_guest: isGuest,
        sound_volume: 0.5,
        sound_muted: false,
      }, {
        onConflict: 'id',
      })
      .select()
      .single();

    if (error) {
      console.error('Create profile error:', error);
      return null;
    }

    return {
      id: data.id,
      nickname: data.nickname,
      playerLevel: data.player_level,
      playerExp: data.player_exp,
      isGuest: data.is_guest,
      soundVolume: data.sound_volume ?? 0.5,
      soundMuted: data.sound_muted ?? false,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (err) {
    console.error('Create profile error:', err);
    return null;
  }
};

// 플레이어 프로필 가져오기
export const getPlayerProfile = async (userId: string): Promise<PlayerProfile | null> => {
  if (!isSupabaseConfigured() || !supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('player_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // 프로필이 없는 경우
        return null;
      }
      console.error('Get profile error:', error);
      return null;
    }

    return {
      id: data.id,
      nickname: data.nickname,
      playerLevel: data.player_level,
      playerExp: data.player_exp,
      isGuest: data.is_guest,
      // DB에 값이 있으면 사용, 없으면 undefined (localStorage 우선 사용)
      soundVolume: data.sound_volume !== null && data.sound_volume !== undefined ? data.sound_volume : undefined,
      soundMuted: data.sound_muted !== null && data.sound_muted !== undefined ? data.sound_muted : undefined,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (err) {
    console.error('Get profile error:', err);
    return null;
  }
};

// 사운드 설정 업데이트
export const updateSoundSettings = async (
  userId: string,
  soundVolume: number,
  soundMuted: boolean
): Promise<boolean> => {
  if (!isSupabaseConfigured() || !supabase) {
    return true; // 로컬 모드에서는 항상 성공
  }

  try {
    const { error } = await supabase
      .from('player_profiles')
      .update({
        sound_volume: soundVolume,
        sound_muted: soundMuted,
      })
      .eq('id', userId);

    if (error) {
      console.error('Update sound settings error:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Update sound settings error:', err);
    return false;
  }
};

// 인증 에러 번역
const translateAuthError = (error: AuthError): string => {
  const errorMessages: Record<string, string> = {
    'Invalid login credentials': '이메일 또는 비밀번호가 올바르지 않습니다.',
    'Email not confirmed': '이메일 인증이 필요합니다.',
    'User already registered': '이미 가입된 이메일입니다.',
    'Password should be at least 6 characters': '비밀번호는 최소 6자 이상이어야 합니다.',
    'Invalid email': '올바른 이메일 형식이 아닙니다.',
    'Anonymous sign-ins are disabled': '게스트 로그인이 비활성화되어 있습니다.',
  };

  return errorMessages[error.message] || error.message;
};

// 인증 상태 변화 구독
export const onAuthStateChange = (
  callback: (user: User | null) => void
): (() => void) => {
  if (!isSupabaseConfigured() || !supabase) {
    return () => {};
  }

  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      callback(session?.user ?? null);
    }
  );

  return () => subscription.unsubscribe();
};
