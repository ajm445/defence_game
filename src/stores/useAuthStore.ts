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
} from '../services/authService';
import { isSupabaseConfigured } from '../services/supabase';
import { useProfileStore } from './useProfileStore';

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

  // 상태 관리
  setError: (error: string | null) => void;
  clearError: () => void;

  // 게스트 확인
  isGuest: () => boolean;
}

interface AuthStore extends AuthState, AuthActions {}

// 로컬 게스트 프로필 생성
const createLocalGuestProfile = (nickname: string): PlayerProfile => ({
  id: `guest_${Date.now()}`,
  nickname,
  playerLevel: 1,
  playerExp: 0,
  isGuest: true,
});

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
        set({
          status: 'authenticated',
          user: result.user,
          profile: { ...profile, isGuest: true },
          isLoading: false,
        });
      }

      return true;
    },

    // 로그아웃
    signOut: async () => {
      set({ isLoading: true });

      await authSignOut();

      // ProfileStore 초기화
      useProfileStore.getState().reset();

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
