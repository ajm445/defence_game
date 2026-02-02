import { create } from 'zustand';
import { adminApi } from '../services/adminApi';
import type { PlayerListItem, PlayerDetail, Pagination } from '../types/admin';

interface PlayersState {
  players: PlayerListItem[];
  selectedPlayer: PlayerDetail | null;
  pagination: Pagination | null;
  isLoading: boolean;
  error: string | null;

  // Filters
  search: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  isBannedFilter: boolean | undefined;

  // Actions
  setSearch: (search: string) => void;
  setSortBy: (sortBy: string) => void;
  setSortOrder: (sortOrder: 'asc' | 'desc') => void;
  setIsBannedFilter: (isBanned: boolean | undefined) => void;

  fetchPlayers: (page?: number) => Promise<void>;
  fetchPlayer: (id: string) => Promise<void>;
  updatePlayer: (id: string, data: { nickname?: string; playerLevel?: number; playerExp?: number; role?: string }) => Promise<boolean>;
  updateClassProgress: (playerId: string, className: string, data: { classLevel?: number; classExp?: number; sp?: number; statUpgrades?: Record<string, number> }) => Promise<boolean>;
  deletePlayer: (id: string) => Promise<boolean>;
  banPlayer: (id: string, reason: string, expiresAt?: string) => Promise<boolean>;
  unbanPlayer: (id: string) => Promise<boolean>;
  clearSelectedPlayer: () => void;
  clearError: () => void;
}

export const usePlayersStore = create<PlayersState>((set, get) => ({
  players: [],
  selectedPlayer: null,
  pagination: null,
  isLoading: false,
  error: null,

  search: '',
  sortBy: 'created_at',
  sortOrder: 'desc',
  isBannedFilter: undefined,

  setSearch: (search) => set({ search }),
  setSortBy: (sortBy) => set({ sortBy }),
  setSortOrder: (sortOrder) => set({ sortOrder }),
  setIsBannedFilter: (isBannedFilter) => set({ isBannedFilter }),

  fetchPlayers: async (page = 1) => {
    const { search, sortBy, sortOrder, isBannedFilter } = get();
    set({ isLoading: true, error: null });

    try {
      const response = await adminApi.getPlayers({
        page,
        limit: 20,
        search: search || undefined,
        sortBy,
        sortOrder,
        isBanned: isBannedFilter,
      });

      set({
        players: response.players,
        pagination: response.pagination,
        isLoading: false,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch players',
        isLoading: false,
      });
    }
  },

  fetchPlayer: async (id: string) => {
    set({ isLoading: true, error: null });

    try {
      const player = await adminApi.getPlayer(id);
      set({ selectedPlayer: player, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch player',
        isLoading: false,
      });
    }
  },

  updatePlayer: async (id, data) => {
    set({ isLoading: true, error: null });

    try {
      await adminApi.updatePlayer(id, data);
      // Refresh player data
      await get().fetchPlayer(id);
      return true;
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to update player',
        isLoading: false,
      });
      return false;
    }
  },

  updateClassProgress: async (playerId, className, data) => {
    set({ isLoading: true, error: null });

    try {
      await adminApi.updateClassProgress(playerId, className, data);
      // Refresh player data
      await get().fetchPlayer(playerId);
      return true;
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to update class progress',
        isLoading: false,
      });
      return false;
    }
  },

  deletePlayer: async (id) => {
    set({ isLoading: true, error: null });

    try {
      await adminApi.deletePlayer(id);
      set({ isLoading: false });
      return true;
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to delete player',
        isLoading: false,
      });
      return false;
    }
  },

  banPlayer: async (id, reason, expiresAt) => {
    set({ isLoading: true, error: null });

    try {
      await adminApi.banPlayer(id, reason, expiresAt);
      // Refresh player data
      const { selectedPlayer } = get();
      if (selectedPlayer?.player.id === id) {
        await get().fetchPlayer(id);
      }
      return true;
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to ban player',
        isLoading: false,
      });
      return false;
    }
  },

  unbanPlayer: async (id) => {
    set({ isLoading: true, error: null });

    try {
      await adminApi.unbanPlayer(id);
      // Refresh player data
      const { selectedPlayer } = get();
      if (selectedPlayer?.player.id === id) {
        await get().fetchPlayer(id);
      }
      return true;
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to unban player',
        isLoading: false,
      });
      return false;
    }
  },

  clearSelectedPlayer: () => set({ selectedPlayer: null }),
  clearError: () => set({ error: null }),
}));
