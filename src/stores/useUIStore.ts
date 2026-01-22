import { create } from 'zustand';
import { GameScreen, AIDifficulty } from '../types';

export type PlacementMode = 'none' | 'wall';

interface UIState {
  currentScreen: GameScreen;
  previousScreen: GameScreen | null; // 이전 화면 추적 (프로필 등에서 뒤로 가기용)
  notification: string | null;
  notificationKey: number;
  placementMode: PlacementMode;
  selectedDifficulty: AIDifficulty;
  massSpawnAlert: boolean; // 대량 발생 경고 표시 여부
  edgeScrollEnabled: boolean; // 마우스 가장자리 스크롤 활성화 여부
  soundVolume: number; // 0.0 ~ 1.0
  soundMuted: boolean;
}

interface UIActions {
  setScreen: (screen: GameScreen) => void;
  goBack: () => void; // 이전 화면으로 돌아가기
  showNotification: (message: string) => void;
  clearNotification: () => void;
  setPlacementMode: (mode: PlacementMode) => void;
  setSelectedDifficulty: (difficulty: AIDifficulty) => void;
  showMassSpawnAlert: () => void;
  hideMassSpawnAlert: () => void;
  resetGameUI: () => void;
  toggleEdgeScroll: () => void;
  setSoundVolume: (volume: number) => void;
  setSoundMuted: (muted: boolean) => void;
  toggleSoundMuted: () => void;
}

interface UIStore extends UIState, UIActions {}

export const useUIStore = create<UIStore>((set, get) => ({
  currentScreen: 'menu',
  previousScreen: null,
  notification: null,
  notificationKey: 0,
  placementMode: 'none',
  selectedDifficulty: 'easy',
  massSpawnAlert: false,
  edgeScrollEnabled: false, // 기본값: 비활성화
  soundVolume: 0.5, // 기본 볼륨 50%
  soundMuted: false,

  setScreen: (screen) => set((state) => ({
    currentScreen: screen,
    previousScreen: state.currentScreen, // 이전 화면 저장
  })),

  goBack: () => set((state) => ({
    currentScreen: state.previousScreen || 'menu',
    previousScreen: null,
  })),

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

  toggleEdgeScroll: () => set((state) => ({ edgeScrollEnabled: !state.edgeScrollEnabled })),

  setSoundVolume: (volume) => set({ soundVolume: Math.max(0, Math.min(1, volume)) }),

  setSoundMuted: (muted) => set({ soundMuted: muted }),

  toggleSoundMuted: () => set((state) => ({ soundMuted: !state.soundMuted })),
}));
