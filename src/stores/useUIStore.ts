import { create } from 'zustand';
import { GameScreen, AIDifficulty } from '../types';

export type PlacementMode = 'none' | 'wall';

interface UIState {
  currentScreen: GameScreen;
  notification: string | null;
  notificationKey: number;
  placementMode: PlacementMode;
  selectedDifficulty: AIDifficulty;
  massSpawnAlert: boolean; // 대량 발생 경고 표시 여부
}

interface UIActions {
  setScreen: (screen: GameScreen) => void;
  showNotification: (message: string) => void;
  clearNotification: () => void;
  setPlacementMode: (mode: PlacementMode) => void;
  setSelectedDifficulty: (difficulty: AIDifficulty) => void;
  showMassSpawnAlert: () => void;
  hideMassSpawnAlert: () => void;
  resetGameUI: () => void;
}

interface UIStore extends UIState, UIActions {}

export const useUIStore = create<UIStore>((set) => ({
  currentScreen: 'menu',
  notification: null,
  notificationKey: 0,
  placementMode: 'none',
  selectedDifficulty: 'easy',
  massSpawnAlert: false,

  setScreen: (screen) => set({ currentScreen: screen }),

  showNotification: (message) =>
    set((state) => ({
      notification: message,
      notificationKey: state.notificationKey + 1,
    })),

  clearNotification: () => set({ notification: null }),

  setPlacementMode: (mode) => set({ placementMode: mode }),

  setSelectedDifficulty: (difficulty) => set({ selectedDifficulty: difficulty }),

  showMassSpawnAlert: () => set({ massSpawnAlert: true }),

  hideMassSpawnAlert: () => set({ massSpawnAlert: false }),

  resetGameUI: () => set({
    notification: null,
    placementMode: 'none',
    massSpawnAlert: false,
  }),
}));
