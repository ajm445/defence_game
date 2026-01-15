import { create } from 'zustand';
import { GameScreen } from '../types';

interface UIState {
  currentScreen: GameScreen;
  notification: string | null;
  notificationKey: number;
}

interface UIActions {
  setScreen: (screen: GameScreen) => void;
  showNotification: (message: string) => void;
}

interface UIStore extends UIState, UIActions {}

export const useUIStore = create<UIStore>((set) => ({
  currentScreen: 'menu',
  notification: null,
  notificationKey: 0,

  setScreen: (screen) => set({ currentScreen: screen }),

  showNotification: (message) =>
    set((state) => ({
      notification: message,
      notificationKey: state.notificationKey + 1,
    })),
}));
