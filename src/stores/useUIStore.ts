import { create } from 'zustand';
import { GameScreen, AIDifficulty } from '../types';

export type PlacementMode = 'none' | 'mine';

// localStorage에서 사운드 설정 로드
const SOUND_SETTINGS_KEY = 'defence_game_sound_settings';
const loadInitialSoundSettings = (): { volume: number; muted: boolean } => {
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
    // localStorage 접근 실패 시 기본값 사용
  }
  return { volume: 0.5, muted: false };
};

const initialSoundSettings = loadInitialSoundSettings();

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
  // 점검 알림 (닫을 수 있는 토스트 - 로비/메뉴용)
  maintenanceNotice: string | null;
  // 점검 알림 (자동 사라짐 - 인게임용, 5초)
  maintenanceAlert: string | null;
  maintenanceAlertKey: number;
  // 모바일/태블릿 지원
  isMobile: boolean;
  isTablet: boolean;
  isTouchDevice: boolean;
  isPortrait: boolean;
  uiScale: number;
  isFullscreen: boolean;
  mobileControlMode: 'skills' | 'upgrades';
  connectionLost: boolean;
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
  setMaintenanceNotice: (notice: string | null) => void;
  showMaintenanceAlert: (message: string) => void;
  // 모바일/태블릿 지원
  setDeviceInfo: (info: { isMobile: boolean; isTablet: boolean; isTouchDevice: boolean; isPortrait: boolean; uiScale: number }) => void;
  setFullscreen: (isFullscreen: boolean) => void;
  setMobileControlMode: (mode: 'skills' | 'upgrades') => void;
  setConnectionLost: (lost: boolean) => void;
}

interface UIStore extends UIState, UIActions {}

export const useUIStore = create<UIStore>((set) => ({
  currentScreen: 'menu',
  previousScreen: null,
  notification: null,
  notificationKey: 0,
  placementMode: 'none',
  selectedDifficulty: 'easy',
  massSpawnAlert: false,
  edgeScrollEnabled: false, // 기본값: 비활성화
  soundVolume: initialSoundSettings.volume, // localStorage에서 로드
  soundMuted: initialSoundSettings.muted, // localStorage에서 로드
  maintenanceNotice: null,
  maintenanceAlert: null,
  maintenanceAlertKey: 0,
  // 모바일/태블릿 지원
  isMobile: false,
  isTablet: false,
  isTouchDevice: false,
  isPortrait: false,
  uiScale: 1.0,
  isFullscreen: false,
  mobileControlMode: 'skills',
  connectionLost: false,

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

  setMaintenanceNotice: (notice) => set({ maintenanceNotice: notice }),
  showMaintenanceAlert: (message) => set((state) => ({
    maintenanceAlert: message,
    maintenanceAlertKey: state.maintenanceAlertKey + 1,
  })),

  // 모바일/태블릿 지원
  setDeviceInfo: (info) => set(info),
  setFullscreen: (isFullscreen) => set({ isFullscreen }),
  setMobileControlMode: (mode) => set({ mobileControlMode: mode }),
  setConnectionLost: (lost) => set({ connectionLost: lost }),
}));
