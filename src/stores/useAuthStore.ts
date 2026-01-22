import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { User } from '@supabase/supabase-js';
import { PlayerProfile, AuthStatus, ClassProgress } from '../types/auth';
import {
  signUpWithEmail,
  signInWithEmail,
  signInAsGuest,
  signOut as authSignOut,
  getCurrentSession,
  getPlayerProfile,
  onAuthStateChange,
  updateSoundSettings,
} from '../services/authService';
import { isSupabaseConfigured } from '../services/supabase';
import { useProfileStore } from './useProfileStore';
import { useUIStore } from './useUIStore';
import { soundManager } from '../services/SoundManager';

interface AuthState {
  // 인증 상태
  status: AuthStatus;
  user: User | null;
  profile: PlayerProfile | null;
  classProgress: ClassProgress[];

  // UI 상태
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  // 인증 액션
  signUp: (email: string, password: string, nickname: string) => Promise<{ success: boolean; needsEmailConfirmation?: boolean }>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signInGuest: (nickname: string) => Promise<boolean>;
  signOut: () => Promise<void>;

  // 초기화
  initialize: () => Promise<void>;

  // 프로필 관련
  refreshProfile: () => Promise<void>;
  updateLocalProfile: (updates: Partial<PlayerProfile>) => void;
  updateClassProgress: (progress: ClassProgress) => void;

  // 사운드 설정
  saveSoundSettings: (volume: number, muted: boolean) => Promise<void>;

  // 상태 관리
  setError: (error: string | null) => void;
  clearError: () => void;

  // 게스트 확인
  isGuest: () => boolean;
}

interface AuthStore extends AuthState, AuthActions {}

// localStorage 키
const SOUND_SETTINGS_KEY = 'defence_game_sound_settings';

// localStorage에서 사운드 설정 로드
const loadSoundSettingsFromStorage = (): { volume: number; muted: boolean } | null => {
  try {
    const stored = localStorage.getItem(SOUND_SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        volume: typeof parsed.volume === 'number' ? parsed.volume : 0.5,
        muted: typeof parsed.muted === 'boolean' ? parsed.muted : false,
      };
    }
  } catch (e) {
    console.error('Failed to load sound settings from localStorage:', e);
  }
  return null;
};

// localStorage에 사운드 설정 저장
const saveSoundSettingsToStorage = (volume: number, muted: boolean) => {
  try {
    localStorage.setItem(SOUND_SETTINGS_KEY, JSON.stringify({ volume, muted }));
  } catch (e) {
    console.error('Failed to save sound settings to localStorage:', e);
  }
};

// localStorage에서 사운드 설정 삭제
const clearSoundSettingsFromStorage = () => {
  try {
    localStorage.removeItem(SOUND_SETTINGS_KEY);
  } catch (e) {
    console.error('Failed to clear sound settings from localStorage:', e);
  }
};

// 로컬 게스트 프로필 생성
const createLocalGuestProfile = (nickname: string): PlayerProfile => {
  // localStorage에서 이전 설정 로드
  const storedSettings = loadSoundSettingsFromStorage();
  return {
    id: `guest_${Date.now()}`,
    nickname,
    playerLevel: 1,
    playerExp: 0,
    isGuest: true,
    soundVolume: storedSettings?.volume ?? 0.5,
    soundMuted: storedSettings?.muted ?? false,
  };
};

// 프로필에서 사운드 설정을 UIStore와 soundManager에 동기화
const syncSoundSettings = (profile: PlayerProfile) => {
  const storedSettings = loadSoundSettingsFromStorage();

  let volume: number;
  let muted: boolean;

  // DB에 실제 사운드 설정이 저장되어 있는지 확인
  const hasDbSoundSettings =
    profile.soundVolume !== undefined && profile.soundVolume !== null;

  if (!profile.isGuest && hasDbSoundSettings) {
    // 로그인 사용자이고 DB에 설정이 있으면 DB 값 사용
    volume = profile.soundVolume!;
    muted = profile.soundMuted ?? false;
    // localStorage도 업데이트 (다음 로그인 전 백업용)
    saveSoundSettingsToStorage(volume, muted);
  } else if (storedSettings) {
    // localStorage에 설정이 있으면 사용 (게스트 또는 DB에 설정이 없는 경우)
    volume = storedSettings.volume;
    muted = storedSettings.muted;
  } else {
    // 둘 다 없으면 기본값
    volume = 0.5;
    muted = false;
  }

  useUIStore.getState().setSoundVolume(volume);
  useUIStore.getState().setSoundMuted(muted);
  soundManager.setVolume(volume);
  soundManager.setMuted(muted);
};

export const useAuthStore = create<AuthStore>()(
  subscribeWithSelector((set, get) => ({
    // 초기 상태
    status: 'loading',
    user: null,
    profile: null,
    classProgress: [],
    isLoading: true,
    error: null,

    // 회원가입
    signUp: async (email, password, nickname) => {
      set({ isLoading: true, error: null });

      const result = await signUpWithEmail(email, password, nickname);

      if (!result.success) {
        set({ isLoading: false, error: result.error ?? '회원가입에 실패했습니다.' });
        return { success: false };
      }

      if (result.needsEmailConfirmation) {
        set({ isLoading: false });
        return { success: true, needsEmailConfirmation: true };
      }

      if (result.user) {
        const profile = await getPlayerProfile(result.user.id);
        if (profile) {
          syncSoundSettings(profile);
        }
        set({
          status: 'authenticated',
          user: result.user,
          profile,
          isLoading: false,
        });
      }

      return { success: true };
    },

    // 이메일 로그인
    signIn: async (email, password) => {
      set({ isLoading: true, error: null });

      const result = await signInWithEmail(email, password);

      if (!result.success) {
        set({ isLoading: false, error: result.error ?? '로그인에 실패했습니다.' });
        return false;
      }

      if (result.user) {
        const profile = await getPlayerProfile(result.user.id);
        if (profile) {
          syncSoundSettings(profile);
        }
        set({
          status: 'authenticated',
          user: result.user,
          profile,
          isLoading: false,
        });
      }

      return true;
    },

    // 게스트 로그인
    signInGuest: async (nickname) => {
      set({ isLoading: true, error: null });

      if (!isSupabaseConfigured()) {
        // Supabase 없이 로컬 게스트 모드
        const localProfile = createLocalGuestProfile(nickname);
        syncSoundSettings(localProfile);
        set({
          status: 'authenticated',
          user: { id: localProfile.id } as User,
          profile: localProfile,
          isLoading: false,
        });
        return true;
      }

      const result = await signInAsGuest(nickname);

      if (!result.success) {
        // Supabase 오류 시에도 로컬 게스트 모드로 진행
        const localProfile = createLocalGuestProfile(nickname);
        syncSoundSettings(localProfile);
        set({
          status: 'authenticated',
          user: { id: localProfile.id } as User,
          profile: localProfile,
          isLoading: false,
        });
        return true;
      }

      if (result.user) {
        const profile = await getPlayerProfile(result.user.id) || createLocalGuestProfile(nickname);
        const guestProfile = { ...profile, isGuest: true };
        syncSoundSettings(guestProfile);
        set({
          status: 'authenticated',
          user: result.user,
          profile: guestProfile,
          isLoading: false,
        });
      }

      return true;
    },

    // 로그아웃
    signOut: async () => {
      const { profile } = get();
      set({ isLoading: true });

      await authSignOut();

      // ProfileStore 초기화
      useProfileStore.getState().reset();

      // 게스트 로그아웃 시 localStorage 사운드 설정 삭제
      if (profile?.isGuest) {
        clearSoundSettingsFromStorage();
      }

      set({
        status: 'unauthenticated',
        user: null,
        profile: null,
        classProgress: [],
        isLoading: false,
        error: null,
      });
    },

    // 초기화 (앱 시작 시 호출)
    initialize: async () => {
      set({ isLoading: true });

      if (!isSupabaseConfigured()) {
        // Supabase가 설정되지 않은 경우 비인증 상태로 시작
        set({
          status: 'unauthenticated',
          isLoading: false,
        });
        return;
      }

      try {
        const session = await getCurrentSession();

        if (session?.user) {
          const profile = await getPlayerProfile(session.user.id);
          if (profile) {
            syncSoundSettings(profile);
          }
          set({
            status: 'authenticated',
            user: session.user,
            profile,
            isLoading: false,
          });
        } else {
          set({
            status: 'unauthenticated',
            isLoading: false,
          });
        }

        // 인증 상태 변화 구독
        onAuthStateChange(async (user) => {
          if (user) {
            const profile = await getPlayerProfile(user.id);
            if (profile) {
              syncSoundSettings(profile);
            }
            set({
              status: 'authenticated',
              user,
              profile,
            });
          } else {
            set({
              status: 'unauthenticated',
              user: null,
              profile: null,
              classProgress: [],
            });
          }
        });
      } catch (err) {
        console.error('Auth initialization error:', err);
        set({
          status: 'unauthenticated',
          isLoading: false,
        });
      }
    },

    // 프로필 새로고침
    refreshProfile: async () => {
      const { user } = get();
      if (!user) return;

      const profile = await getPlayerProfile(user.id);
      if (profile) {
        set({ profile });
      }
    },

    // 로컬 프로필 업데이트 (경험치 등 실시간 업데이트용)
    updateLocalProfile: (updates) => {
      const { profile } = get();
      if (!profile) return;

      set({
        profile: { ...profile, ...updates },
      });
    },

    // 클래스 진행 상황 업데이트
    updateClassProgress: (progress) => {
      const { classProgress } = get();
      const existing = classProgress.findIndex(
        (p) => p.className === progress.className
      );

      if (existing >= 0) {
        const updated = [...classProgress];
        updated[existing] = progress;
        set({ classProgress: updated });
      } else {
        set({ classProgress: [...classProgress, progress] });
      }
    },

    // 사운드 설정 저장
    saveSoundSettings: async (volume, muted) => {
      const { user, profile } = get();
      if (!user || !profile) return;

      // 로컬 프로필 업데이트
      set({
        profile: { ...profile, soundVolume: volume, soundMuted: muted },
      });

      // UIStore와 soundManager 동기화
      useUIStore.getState().setSoundVolume(volume);
      useUIStore.getState().setSoundMuted(muted);
      soundManager.setVolume(volume);
      soundManager.setMuted(muted);

      // localStorage에 항상 저장 (게스트 및 비로그인 상태에서 사용)
      saveSoundSettingsToStorage(volume, muted);

      // 서버에도 저장 (게스트가 아닌 경우)
      if (!profile.isGuest) {
        await updateSoundSettings(user.id, volume, muted);
      }
    },

    // 에러 설정
    setError: (error) => set({ error }),
    clearError: () => set({ error: null }),

    // 게스트 확인
    isGuest: () => {
      const { profile } = get();
      return profile?.isGuest ?? true;
    },
  }))
);

// 셀렉터 훅들
export const useAuth = () => useAuthStore((state) => ({
  status: state.status,
  user: state.user,
  profile: state.profile,
  isLoading: state.isLoading,
}));

export const useAuthStatus = () => useAuthStore((state) => state.status);
export const useAuthProfile = () => useAuthStore((state) => state.profile);
export const useAuthIsGuest = () => useAuthStore((state) => state.profile?.isGuest ?? true);
export const useAuthIsLoading = () => useAuthStore((state) => state.isLoading);
export const useAuthError = () => useAuthStore((state) => state.error);
