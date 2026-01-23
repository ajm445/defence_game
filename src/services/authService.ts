import { PlayerProfile } from '../types/auth';

// API 기본 URL (환경변수로 설정)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export interface AuthResult {
  success: boolean;
  user?: {
    id: string;
    email?: string;
    isGuest?: boolean;
  };
  profile?: PlayerProfile;
  error?: string;
}

export interface SignUpResult extends AuthResult {
  needsEmailConfirmation?: boolean;
}

// API 요청 헬퍼
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || '요청 처리 중 오류가 발생했습니다.');
  }

  return data;
}

// 이메일로 회원가입
export const signUpWithEmail = async (
  email: string,
  password: string,
  nickname: string
): Promise<SignUpResult> => {
  try {
    const data = await apiRequest<{
      success: boolean;
      user?: { id: string; email: string };
      error?: string;
    }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, nickname }),
    });

    if (!data.success) {
      return { success: false, error: data.error };
    }

    return {
      success: true,
      user: data.user,
    };
  } catch (err) {
    console.error('Sign up error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : '회원가입 중 오류가 발생했습니다.'
    };
  }
};

// 이메일로 로그인
export const signInWithEmail = async (
  email: string,
  password: string
): Promise<AuthResult> => {
  try {
    const data = await apiRequest<{
      success: boolean;
      user?: { id: string; email: string };
      profile?: PlayerProfile;
      error?: string;
    }>('/api/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (!data.success) {
      return { success: false, error: data.error };
    }

    return {
      success: true,
      user: data.user,
      profile: data.profile,
    };
  } catch (err) {
    console.error('Sign in error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : '로그인 중 오류가 발생했습니다.'
    };
  }
};

// 게스트로 로그인
export const signInAsGuest = async (nickname: string): Promise<AuthResult> => {
  try {
    const data = await apiRequest<{
      success: boolean;
      user?: { id: string; isGuest: boolean };
      profile?: PlayerProfile;
      error?: string;
    }>('/api/auth/guest', {
      method: 'POST',
      body: JSON.stringify({ nickname }),
    });

    if (!data.success) {
      // API 실패 시 로컬 게스트 모드로 폴백
      return {
        success: true,
        user: {
          id: `guest_${Date.now()}`,
          isGuest: true,
        },
        profile: {
          id: `guest_${Date.now()}`,
          nickname,
          playerLevel: 1,
          playerExp: 0,
          isGuest: true,
          soundVolume: 0.5,
          soundMuted: false,
        },
      };
    }

    return {
      success: true,
      user: data.user,
      profile: data.profile,
    };
  } catch (err) {
    console.error('Guest sign in error:', err);
    // API 오류 시 로컬 게스트 모드로 폴백
    return {
      success: true,
      user: {
        id: `guest_${Date.now()}`,
        isGuest: true,
      },
      profile: {
        id: `guest_${Date.now()}`,
        nickname,
        playerLevel: 1,
        playerExp: 0,
        isGuest: true,
        soundVolume: 0.5,
        soundMuted: false,
      },
    };
  }
};

// 로그아웃 (클라이언트 세션 정리만)
export const signOut = async (): Promise<{ success: boolean; error?: string }> => {
  // 서버에 별도 로그아웃 API 호출 필요 없음 (세션 기반이 아님)
  // 클라이언트에서 저장된 사용자 정보만 정리
  return { success: true };
};

// 플레이어 프로필 가져오기
export const getPlayerProfile = async (userId: string): Promise<PlayerProfile | null> => {
  try {
    const data = await apiRequest<{
      success: boolean;
      profile?: PlayerProfile;
      error?: string;
    }>(`/api/auth/profile/${userId}`);

    if (!data.success || !data.profile) {
      return null;
    }

    return data.profile;
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
  try {
    const data = await apiRequest<{ success: boolean }>(`/api/auth/profile/${userId}/sound`, {
      method: 'PATCH',
      body: JSON.stringify({ soundVolume, soundMuted }),
    });

    return data.success;
  } catch (err) {
    console.error('Update sound settings error:', err);
    return false;
  }
};

// 닉네임 변경
export const updateNickname = async (
  userId: string,
  newNickname: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const data = await apiRequest<{ success: boolean; error?: string }>(
      `/api/auth/profile/${userId}/nickname`,
      {
        method: 'PATCH',
        body: JSON.stringify({ nickname: newNickname }),
      }
    );

    return data;
  } catch (err) {
    console.error('Update nickname error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : '닉네임 변경 중 오류가 발생했습니다.'
    };
  }
};

// 회원 탈퇴
export const deleteAccount = async (
  userId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const data = await apiRequest<{ success: boolean; error?: string }>(
      `/api/auth/account/${userId}`,
      { method: 'DELETE' }
    );

    return data;
  } catch (err) {
    console.error('Delete account error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : '회원 탈퇴 중 오류가 발생했습니다.'
    };
  }
};

// 인증 상태 변화 구독 (더 이상 Supabase 사용하지 않음)
export const onAuthStateChange = (
  _callback: (user: { id: string; email?: string } | null) => void
): (() => void) => {
  // 서버 기반 인증이므로 실시간 구독 없음
  // 클라이언트에서 상태 관리
  return () => {};
};

// 레거시 호환성을 위한 함수들 (더 이상 사용하지 않음)
export const getCurrentSession = async () => null;
export const getCurrentUser = async () => null;
export const createPlayerProfile = async (
  userId: string,
  nickname: string,
  isGuest: boolean
): Promise<PlayerProfile | null> => {
  // 회원가입 시 서버에서 프로필 생성하므로 별도 호출 불필요
  return {
    id: userId,
    nickname,
    playerLevel: 1,
    playerExp: 0,
    isGuest,
    soundVolume: 0.5,
    soundMuted: false,
  };
};
