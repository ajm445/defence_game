import { useEffect, useCallback } from 'react';
import { useGameStore } from '../stores/useGameStore';
import { useUIStore } from '../stores/useUIStore';

export const useKeyboardInput = () => {
  const moveCamera = useGameStore((state) => state.moveCamera);
  const setCameraPosition = useGameStore((state) => state.setCameraPosition);
  const playerBase = useGameStore((state) => state.playerBase);
  const running = useGameStore((state) => state.running);
  const gameMode = useGameStore((state) => state.gameMode);
  const stopGame = useGameStore((state) => state.stopGame);
  const startGame = useGameStore((state) => state.startGame);
  const setScreen = useUIStore((state) => state.setScreen);
  const currentScreen = useUIStore((state) => state.currentScreen);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // ESC 키는 일시정지/재개 토글 (AI 대전만)
      if (e.key === 'Escape') {
        if (gameMode === 'ai') {
          if (currentScreen === 'paused') {
            // 일시정지 상태에서 ESC → 게임 재개
            startGame();
            setScreen('game');
          } else if (currentScreen === 'game' && running) {
            // 게임 중 ESC → 일시정지
            stopGame();
            setScreen('paused');
          }
        }
        return;
      }

      // 게임이 실행 중이 아니면 다른 키 입력 무시
      if (!running) return;

      const speed = 20;

      switch (e.key.toLowerCase()) {
        case 'arrowleft':
        case 'a':
          moveCamera(-speed, 0);
          break;
        case 'arrowright':
        case 'd':
          moveCamera(speed, 0);
          break;
        case 'arrowup':
        case 'w':
          moveCamera(0, -speed);
          break;
        case 'arrowdown':
        case 's':
          moveCamera(0, speed);
          break;
        case ' ':
          e.preventDefault();
          // 플레이어 본진으로 카메라 이동
          setCameraPosition(
            playerBase.x - window.innerWidth / 2,
            playerBase.y - (window.innerHeight - 120) / 2
          );
          break;
      }
    },
    [running, gameMode, currentScreen, moveCamera, setCameraPosition, playerBase, stopGame, startGame, setScreen]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
};
