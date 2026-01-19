import { useEffect } from 'react';
import { useUIStore } from './stores/useUIStore';
import { MainMenu } from './components/screens/MainMenu';
import { ModeSelectScreen } from './components/screens/ModeSelectScreen';
import { DifficultySelectScreen } from './components/screens/DifficultySelectScreen';
import { LobbyScreen } from './components/screens/LobbyScreen';
import { GameScreen } from './components/screens/GameScreen';
import { GameOverScreen } from './components/screens/GameOverScreen';
import { PauseScreen } from './components/screens/PauseScreen';
import { preloadGameEmojis } from './utils/canvasEmoji';

function App() {
  const currentScreen = useUIStore((state) => state.currentScreen);

  // 앱 시작 시 게임에서 사용하는 이모지 미리 로드
  useEffect(() => {
    preloadGameEmojis();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900">
      {currentScreen === 'menu' && <MainMenu />}
      {currentScreen === 'modeSelect' && <ModeSelectScreen />}
      {currentScreen === 'difficultySelect' && <DifficultySelectScreen />}
      {currentScreen === 'lobby' && <LobbyScreen />}
      {currentScreen === 'game' && <GameScreen />}
      {currentScreen === 'gameover' && <GameOverScreen />}
      {currentScreen === 'paused' && <PauseScreen />}
    </div>
  );
}

export default App;
