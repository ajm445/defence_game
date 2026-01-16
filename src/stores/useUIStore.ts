import { create } from 'zustand';
import { GameScreen, AIDifficulty } from '../types';

export type PlacementMode = 'none' | 'wall';

interface UIState {
  currentScreen: GameScreen;
  notification: string | null;
  notificationKey: number;
  placementMode: PlacementMode;
  selectedDifficulty: AIDifficulty;
}

interface UIActions {
  setScreen: (screen: GameScreen) => void;
  showNotification: (message: string) => void;
  setPlacementMode: (mode: PlacementMode) => void;
  setSelectedDifficulty: (difficulty: AIDifficulty) => void;
}

interface UIStore extends UIState, UIActions {}

export const useUIStore = create<UIStore>((set) => ({
  currentScreen: 'menu',
  notification: null,
  notificationKey: 0,
  placementMode: 'none',
  selectedDifficulty: 'easy',

  setScreen: (screen) => set({ currentScreen: screen }),

  showNotification: (message) =>
    set((state) => ({
      notification: message,
      notificationKey: state.notificationKey + 1,
    })),

  setPlacementMode: (mode) => set({ placementMode: mode }),

  setSelectedDifficulty: (difficulty) => set({ selectedDifficulty: difficulty }),
}));
