import { useEffect } from 'react';
import { useUIStore } from './stores/useUIStore';
import { useGameStore } from './stores/useGameStore';
import { useAuthStore } from './stores/useAuthStore';
import { useNetworkSync } from './hooks/useNetworkSync';
import { useDeviceDetect } from './hooks/useDeviceDetect';
import { OrientationPrompt } from './components/ui/OrientationPrompt';
import { MainMenu } from './components/screens/MainMenu';
import { GameTypeSelectScreen } from './components/screens/GameTypeSelectScreen';
import { ModeSelectScreen } from './components/screens/ModeSelectScreen';
import { DifficultySelectScreen } from './components/screens/DifficultySelectScreen';
import { LobbyScreen } from './components/screens/LobbyScreen';
import { CountdownScreen } from './components/screens/CountdownScreen';
import { GameScreen } from './components/screens/GameScreen';
import { RPGModeScreen } from './components/screens/RPGModeScreen';
import { RPGClassSelectScreen } from './components/screens/RPGClassSelectScreen';
import { RPGCoopLobbyScreen } from './components/screens/RPGCoopLobbyScreen';
import { RPGTutorialScreen } from './components/screens/RPGTutorialScreen';
import { LoginScreen } from './components/screens/LoginScreen';
import { ProfileScreen } from './components/screens/ProfileScreen';
import { GameOverScreen } from './components/screens/GameOverScreen';
import { PauseScreen } from './components/screens/PauseScreen';
import { MaintenanceToast, MaintenanceAlert } from './components/ui/MaintenanceToast';
import { preloadGameEmojis } from './utils/canvasEmoji';
import { preloadAllUnitImages } from './utils/unitImages';
import { preloadAllAdvancedHeroImages } from './utils/heroImages';

function App() {
  const currentScreen = useUIStore((state) => state.currentScreen);
  const gameMode = useGameStore((state) => state.gameMode);
  const initializeAuth = useAuthStore((state) => state.initialize);

  // 서버 권위 모델 네트워크 동기화 (항상 활성화)
  useNetworkSync();

  // 디바이스 감지 (모바일/태블릿/데스크톱 분류, 방향 추적)
  useDeviceDetect();

  // 앱 시작 시 게임에서 사용하는 이모지 및 유닛 이미지 미리 로드
  useEffect(() => {
    preloadGameEmojis();
    preloadAllUnitImages();
    preloadAllAdvancedHeroImages();
  }, []);

  // 앱 시작 시 인증 상태 초기화
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return (
    <div className="h-full overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900">
      {/* 모바일 세로 모드 회전 안내 */}
      <OrientationPrompt />
      {/* 서버 점검 알림 */}
      <MaintenanceToast />
      <MaintenanceAlert />

      {currentScreen === 'menu' && <MainMenu />}
      {currentScreen === 'gameTypeSelect' && <GameTypeSelectScreen />}
      {currentScreen === 'modeSelect' && <ModeSelectScreen />}
      {currentScreen === 'difficultySelect' && <DifficultySelectScreen />}
      {currentScreen === 'login' && <LoginScreen />}
      {currentScreen === 'profile' && <ProfileScreen />}
      {currentScreen === 'rpgClassSelect' && <RPGClassSelectScreen />}
      {currentScreen === 'rpgCoopLobby' && <RPGCoopLobbyScreen />}
      {currentScreen === 'rpgTutorial' && <RPGTutorialScreen />}
      {currentScreen === 'lobby' && <LobbyScreen />}
      {(currentScreen === 'countdown' || currentScreen === 'game') && gameMode !== 'rpg' && <GameScreen />}
      {(currentScreen === 'game' || currentScreen === 'paused') && gameMode === 'rpg' && <RPGModeScreen />}
      {currentScreen === 'countdown' && <CountdownScreen />}
      {currentScreen === 'gameover' && <GameOverScreen />}
      {currentScreen === 'paused' && <PauseScreen />}
    </div>
  );
}

export default App;
