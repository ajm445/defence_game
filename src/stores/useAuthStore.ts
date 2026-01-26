import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { PlayerProfile, AuthStatus, ClassProgress } from '../types/auth';
import {
  signUpWithEmail,
  signInWithEmail,
  signInAsGuest,
  signOut as authSignOut,
  getPlayerProfile,
  onAuthStateChange,
  updateSoundSettings,
  updateNickname as authUpdateNickname,
  deleteAccount as authDeleteAccount,
} from '../services/authService';
import { getClassProgress } from '../services/profileService';
import { useProfileStore } from './useProfileStore';
import { useUIStore } from './useUIStore';
import { soundManager } from '../services/SoundManager';
import { wsClient } from '../services/WebSocketClient';

// 사용자 타입 정의
interface User {
  id: string;
  email?: string;
  isGuest?: boolean;
}

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
  updateNickname: (newNickname: string) => Promise<{ success: boolean; error?: string }>;
  deleteAccount: () => Promise<{ success: boolean; error?: string }>;

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

// 세션 저장 키
const SESSION_KEY = 'defence_game_session';

// sessionStorage에 세션 저장 (브라우저/탭 종료 시 자동 삭제)
const saveSessionToStorage = (user: { id: string; email?: string; isGuest?: boolean }, profile: PlayerProfile) => {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ user, profile }));
  } catch (e) {
    console.error('Failed to save session to sessionStorage:', e);
  }
};

// sessionStorage에서 세션 로드
const loadSessionFromStorage = (): { user: { id: string; email?: string; isGuest?: boolean }; profile: PlayerProfile } | null => {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load session from sessionStorage:', e);
  }
  return null;
};

// sessionStorage에서 세션 삭제
const clearSessionFromStorage = () => {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch (e) {
    console.error('Failed to clear session from sessionStorage:', e);
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
  let volume: number;
  let muted: boolean;

  if (!profile.isGuest) {
    // 로그인 사용자: DB 값만 사용
    volume = profile.soundVolume ?? 0.5;
    muted = profile.soundMuted ?? false;
  } else {
    // 게스트: localStorage 또는 기본값 사용
    const storedSettings = loadSoundSettingsFromStorage();
    if (storedSettings) {
      volume = storedSettings.volume;
      muted = storedSettings.muted;
    } else {
      volume = 0.5;
      muted = false;
    }
  }

  useUIStore.getState().setSoundVolume(volume);
  useUIStore.getState().setSoundMuted(muted);
  soundManager.setVolume(volume);
  soundManager.setBGMVolume(volume); // BGM도 마스터 볼륨과 동기화
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
          saveSessionToStorage(result.user, profile);
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
        const profile = result.profile || await getPlayerProfile(result.user.id);
        if (profile) {
          syncSoundSettings(profile);
          saveSessionToStorage(result.user, profile);
        }

        // classProgress 로드
        let classProgressData: ClassProgress[] = [];
        if (profile && !profile.isGuest) {
          classProgressData = await getClassProgress(result.user.id);
        }

        set({
          status: 'authenticated',
          user: result.user,
          profile,
          classProgress: classProgressData,
          isLoading: false,
        });

        // 서버에 로그인 알림
        wsClient.notifyLogin(result.user.id, profile?.nickname || 'Unknown', false, profile?.playerLevel);
      }

      return true;
    },

    // 게스트 로그인
    signInGuest: async (nickname) => {
      set({ isLoading: true, error: null });

      const result = await signInAsGuest(nickname);

      // API 결과에 프로필이 포함되어 있으면 사용, 아니면 로컬 프로필 생성
      const profile = result.profile || createLocalGuestProfile(nickname);
      const user = result.user || { id: profile.id, isGuest: true };

      syncSoundSettings(profile);
      set({
        status: 'authenticated',
        user,
        profile,
        isLoading: false,
      });

      // 로컬스토리지에 세션 저장
      saveSessionToStorage(user, profile);

      // 서버에 로그인 알림
      wsClient.notifyLogin(user.id, profile.nickname, true, profile.playerLevel);

      return true;
    },

    // 로그아웃
    signOut: async () => {
      // 로그아웃 전 현재 사용자 정보 저장
      const currentUser = get().user;
      const currentProfile = get().profile;

      // 서버에 로그아웃 알림
      if (currentUser && currentProfile) {
        wsClient.notifyLogout(currentUser.id, currentProfile.nickname);
      }

      set({ isLoading: true });

      await authSignOut();

      // ProfileStore 초기화
      useProfileStore.getState().reset();

      // 세션 삭제
      clearSessionFromStorage();

      // 로그아웃 시 localStorage 사운드 설정 삭제 (다른 계정과 혼동 방지)
      clearSoundSettingsFromStorage();

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

      // 기존 localStorage 세션 정리 (마이그레이션)
      try {
        localStorage.removeItem(SESSION_KEY);
      } catch (e) {
        // ignore
      }

      // 타임아웃 설정 (5초 내 응답 없으면 로그아웃 상태로)
      const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), 5000);
      });

      try {
        // sessionStorage에서 세션 복원
        const storedSession = loadSessionFromStorage();

        if (storedSession?.user && storedSession?.profile) {
          // 저장된 세션이 있으면 서버에서 프로필 확인 (타임아웃 적용)
          const profile = await Promise.race([
            getPlayerProfile(storedSession.user.id),
            timeoutPromise,
          ]);

          if (profile) {
            // 프로필이 존재하면 세션 유효
            syncSoundSettings(profile);

            // 게스트가 아니면 classProgress도 로드
            let classProgressData: ClassProgress[] = [];
            if (!profile.isGuest) {
              const classProgressResult = await Promise.race([
                getClassProgress(storedSession.user.id),
                timeoutPromise.then(() => [] as ClassProgress[]),
              ]);
              classProgressData = classProgressResult || [];
            }

            set({
              status: 'authenticated',
              user: storedSession.user,
              profile,
              classProgress: classProgressData,
              isLoading: false,
            });
          } else {
            // 프로필이 없거나 타임아웃 → 세션 무효
            console.log('Session invalid or timeout - clearing session');
            clearSessionFromStorage();
            set({
              status: 'unauthenticated',
              isLoading: false,
            });
          }
        } else {
          set({
            status: 'unauthenticated',
            isLoading: false,
          });
        }

        // 인증 상태 변화 구독 (현재는 사용하지 않음)
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
        clearSessionFromStorage();
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

      // 새 프로필 생성
      const newProfile = { ...profile, soundVolume: volume, soundMuted: muted };

      // 로컬 프로필 업데이트
      set({ profile: newProfile });

      // UIStore와 soundManager 동기화
      useUIStore.getState().setSoundVolume(volume);
      useUIStore.getState().setSoundMuted(muted);
      soundManager.setVolume(volume);
      soundManager.setBGMVolume(volume); // BGM도 마스터 볼륨과 동기화
      soundManager.setMuted(muted);

      if (profile.isGuest) {
        // 게스트: localStorage에만 저장
        saveSoundSettingsToStorage(volume, muted);
      } else {
        // 로그인 사용자: DB에만 저장
        const success = await updateSoundSettings(user.id, volume, muted);
        if (!success) {
          console.error('Failed to save sound settings to server');
        }
      }

      // 세션 업데이트 (로그인 상태 유지를 위해)
      saveSessionToStorage(user, newProfile);
    },

    // 에러 설정
    setError: (error) => set({ error }),
    clearError: () => set({ error: null }),

    // 게스트 확인
    isGuest: () => {
      const { profile } = get();
      return profile?.isGuest ?? true;
    },

    // 닉네임 변경
    updateNickname: async (newNickname) => {
      const { user, profile } = get();
      if (!user || !profile) {
        return { success: false, error: '로그인이 필요합니다.' };
      }

      set({ isLoading: true, error: null });

      // 로컬 프로필(게스트) 처리
      if (profile.isGuest) {
        set({
          profile: { ...profile, nickname: newNickname },
          isLoading: false,
        });
        return { success: true };
      }

      const result = await authUpdateNickname(user.id, newNickname);

      if (result.success) {
        set({
          profile: { ...profile, nickname: newNickname },
          isLoading: false,
        });
      } else {
        set({ isLoading: false, error: result.error });
      }

      return result;
    },

    // 회원 탈퇴
    deleteAccount: async () => {
      const { user, profile } = get();
      if (!user || !profile) {
        return { success: false, error: '로그인이 필요합니다.' };
      }

      set({ isLoading: true, error: null });

      // 게스트는 단순 로그아웃 처리
      if (profile.isGuest) {
        useProfileStore.getState().reset();
        clearSessionFromStorage();
        clearSoundSettingsFromStorage();
        set({
          status: 'unauthenticated',
          user: null,
          profile: null,
          classProgress: [],
          isLoading: false,
          error: null,
        });
        return { success: true };
      }

      const result = await authDeleteAccount(user.id);

      if (result.success) {
        useProfileStore.getState().reset();
        clearSessionFromStorage();
        clearSoundSettingsFromStorage();
        set({
          status: 'unauthenticated',
          user: null,
          profile: null,
          classProgress: [],
          isLoading: false,
          error: null,
        });
      } else {
        set({ isLoading: false, error: result.error });
      }

      return result;
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
