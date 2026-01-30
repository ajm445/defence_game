import { create } from 'zustand';
import type { PlayerActivity, ServerStatus } from '../types/admin';

interface MonitoringState {
  serverStatus: ServerStatus | null;
  activities: PlayerActivity[];
  isConnected: boolean;
  error: string | null;

  setServerStatus: (status: ServerStatus) => void;
  addActivity: (activity: PlayerActivity) => void;
  setConnected: (connected: boolean) => void;
  setError: (error: string | null) => void;
  clearActivities: () => void;
}

const MAX_ACTIVITIES = 100;

export const useMonitoringStore = create<MonitoringState>((set) => ({
  serverStatus: null,
  activities: [],
  isConnected: false,
  error: null,

  setServerStatus: (status) => set({ serverStatus: status }),

  addActivity: (activity) =>
    set((state) => ({
      activities: [activity, ...state.activities].slice(0, MAX_ACTIVITIES),
    })),

  setConnected: (connected) => set({ isConnected: connected }),

  setError: (error) => set({ error }),

  clearActivities: () => set({ activities: [] }),
}));
