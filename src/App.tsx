import { useUIStore } from './stores/useUIStore';
import { MainMenu } from './components/screens/MainMenu';
import { GameScreen } from './components/screens/GameScreen';
import { GameOverScreen } from './components/screens/GameOverScreen';

function App() {
  const currentScreen = useUIStore((state) => state.currentScreen);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900">
      {currentScreen === 'menu' && <MainMenu />}
      {currentScreen === 'game' && <GameScreen />}
      {currentScreen === 'gameover' && <GameOverScreen />}
    </div>
  );
}

export default App;
