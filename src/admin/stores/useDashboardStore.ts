import { create } from 'zustand';
import { adminApi } from '../services/adminApi';
import type {
  OverviewStats,
  ClassPopularityData,
  GameModeData,
  UserGrowthData,
  DailyGamesData,
} from '../types/admin';

interface DashboardState {
  overview: OverviewStats | null;
  classPopularity: ClassPopularityData[];
  gameModes: GameModeData[];
  userGrowth: UserGrowthData[];
  dailyGames: DailyGamesData[];
  isLoading: boolean;
  error: string | null;

  fetchOverview: () => Promise<void>;
  fetchClassPopularity: () => Promise<void>;
  fetchGameModes: () => Promise<void>;
  fetchUserGrowth: () => Promise<void>;
  fetchDailyGames: () => Promise<void>;
  fetchAll: () => Promise<void>;
  clearError: () => void;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  overview: null,
  classPopularity: [],
  gameModes: [],
  userGrowth: [],
  dailyGames: [],
  isLoading: false,
  error: null,

  fetchOverview: async () => {
    try {
      const overview = await adminApi.getOverviewStats();
      set({ overview });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch overview' });
    }
  },

  fetchClassPopularity: async () => {
    try {
      const { classData } = await adminApi.getClassPopularity();
      set({ classPopularity: classData });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch class popularity' });
    }
  },

  fetchGameModes: async () => {
    try {
      const { modeData } = await adminApi.getGameModes();
      set({ gameModes: modeData });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch game modes' });
    }
  },

  fetchUserGrowth: async () => {
    try {
      const { growthData } = await adminApi.getUserGrowth();
      set({ userGrowth: growthData });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch user growth' });
    }
  },

  fetchDailyGames: async () => {
    try {
      const { gamesData } = await adminApi.getDailyGames();
      set({ dailyGames: gamesData });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch daily games' });
    }
  },

  fetchAll: async () => {
    set({ isLoading: true, error: null });

    const { fetchOverview, fetchClassPopularity, fetchGameModes, fetchUserGrowth, fetchDailyGames } = get();

    try {
      await Promise.all([
        fetchOverview(),
        fetchClassPopularity(),
        fetchGameModes(),
        fetchUserGrowth(),
        fetchDailyGames(),
      ]);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch dashboard data' });
    } finally {
      set({ isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
