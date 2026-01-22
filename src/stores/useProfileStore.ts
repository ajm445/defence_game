import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import {
  ClassProgress,
  GameRecord,
  LevelUpResult,
  getRequiredPlayerExp,
  getRequiredClassExp,
} from '../types/auth';
import { HeroClass } from '../types/rpg';
import {
  getClassProgress,
  getGameHistory,
  processGameResult,
  getPlayerStats,
} from '../services/profileService';
import { useAuthStore } from './useAuthStore';

interface ProfileState {
  // 클래스 진행 상황
  classProgress: ClassProgress[];

  // 게임 기록
  gameHistory: GameRecord[];

  // 통계
  stats: {
    totalGames: number;
    totalWins: number;
    totalKills: number;
    totalPlayTime: number;
    highestWave: number;
    favoriteClass: HeroClass | null;
  } | null;

  // 마지막 게임 결과
  lastGameResult: {
    playerExpGained: number;
    classExpGained: number;
    levelUpResult: LevelUpResult;
  } | null;

  // 로딩 상태
  isLoading: boolean;
}

interface ProfileActions {
  // 데이터 로드
  loadProfileData: () => Promise<void>;
  loadClassProgress: () => Promise<void>;
  loadGameHistory: () => Promise<void>;
  loadStats: () => Promise<void>;

  // 게임 결과 처리
  handleGameEnd: (gameData: {
    mode: 'single' | 'coop';
    classUsed: HeroClass;
    waveReached: number;
    kills: number;
    playTime: number;
    victory: boolean;
  }) => Promise<LevelUpResult | null>;

  // 클래스 진행 상황 가져오기
  getClassProgressFor: (className: HeroClass) => ClassProgress | undefined;

  // 레벨업 요구 경험치 계산
  getPlayerExpProgress: () => { current: number; required: number; percentage: number };
  getClassExpProgress: (className: HeroClass) => { current: number; required: number; percentage: number };

  // 마지막 결과 초기화
  clearLastGameResult: () => void;

  // 전체 초기화 (로그아웃 시)
  reset: () => void;
}

interface ProfileStore extends ProfileState, ProfileActions {}

export const useProfileStore = create<ProfileStore>()(
  subscribeWithSelector((set, get) => ({
    // 초기 상태
    classProgress: [],
    gameHistory: [],
    stats: null,
    lastGameResult: null,
    isLoading: false,

    // 전체 프로필 데이터 로드
    loadProfileData: async () => {
      set({ isLoading: true });
      await Promise.all([
        get().loadClassProgress(),
        get().loadGameHistory(),
        get().loadStats(),
      ]);
      set({ isLoading: false });
    },

    // 클래스 진행 상황 로드
    loadClassProgress: async () => {
      const authState = useAuthStore.getState();
      const profile = authState.profile;
      if (!profile || profile.isGuest) return;

      const progress = await getClassProgress(profile.id);
      set({ classProgress: progress });
    },

    // 게임 기록 로드
    loadGameHistory: async () => {
      const authState = useAuthStore.getState();
      const profile = authState.profile;
      if (!profile || profile.isGuest) return;

      const history = await getGameHistory(profile.id);
      set({ gameHistory: history });
    },

    // 통계 로드
    loadStats: async () => {
      const authState = useAuthStore.getState();
      const profile = authState.profile;
      if (!profile || profile.isGuest) return;

      const stats = await getPlayerStats(profile.id);
      set({ stats });
    },

    // 게임 종료 처리
    handleGameEnd: async (gameData) => {
      const authState = useAuthStore.getState();
      const profile = authState.profile;

      if (!profile) return null;

      const { classProgress } = get();

      const result = await processGameResult(
        profile.id,
        profile,
        classProgress,
        gameData
      );

      // 로컬 상태 업데이트
      set({
        lastGameResult: {
          playerExpGained: result.playerExpGained,
          classExpGained: result.classExpGained,
          levelUpResult: result.levelUpResult,
        },
      });

      // 인증 스토어의 프로필 업데이트
      authState.updateLocalProfile(result.newProfile);

      // 클래스 진행 상황 업데이트
      const existingIndex = classProgress.findIndex(
        (p) => p.className === gameData.classUsed
      );

      if (existingIndex >= 0) {
        const updated = [...classProgress];
        updated[existingIndex] = result.newClassProgress;
        set({ classProgress: updated });
      } else {
        set({ classProgress: [...classProgress, result.newClassProgress] });
      }

      return result.levelUpResult;
    },

    // 특정 클래스 진행 상황 가져오기
    getClassProgressFor: (className) => {
      return get().classProgress.find((p) => p.className === className);
    },

    // 플레이어 경험치 진행률
    getPlayerExpProgress: () => {
      const authState = useAuthStore.getState();
      const profile = authState.profile;

      if (!profile) {
        return { current: 0, required: 100, percentage: 0 };
      }

      const required = getRequiredPlayerExp(profile.playerLevel);
      const percentage = Math.min((profile.playerExp / required) * 100, 100);

      return {
        current: profile.playerExp,
        required,
        percentage,
      };
    },

    // 클래스 경험치 진행률
    getClassExpProgress: (className) => {
      const progress = get().classProgress.find((p) => p.className === className);

      if (!progress) {
        return { current: 0, required: 50, percentage: 0 };
      }

      const required = getRequiredClassExp(progress.classLevel);
      const percentage = Math.min((progress.classExp / required) * 100, 100);

      return {
        current: progress.classExp,
        required,
        percentage,
      };
    },

    // 마지막 게임 결과 초기화
    clearLastGameResult: () => {
      set({ lastGameResult: null });
    },

    // 전체 초기화 (로그아웃 시)
    reset: () => {
      set({
        classProgress: [],
        gameHistory: [],
        stats: null,
        lastGameResult: null,
        isLoading: false,
      });
    },
  }))
);

// 셀렉터 훅들
export const useClassProgress = () => useProfileStore((state) => state.classProgress);
export const useGameHistory = () => useProfileStore((state) => state.gameHistory);
export const useProfileStats = () => useProfileStore((state) => state.stats);
export const useLastGameResult = () => useProfileStore((state) => state.lastGameResult);
export const useProfileIsLoading = () => useProfileStore((state) => state.isLoading);
