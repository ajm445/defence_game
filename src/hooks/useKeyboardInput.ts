import { useEffect, useCallback } from 'react';
import { useGameStore } from '../stores/useGameStore';
import { useUIStore } from '../stores/useUIStore';

export const useKeyboardInput = () => {
  const moveCamera = useGameStore((state) => state.moveCamera);
  const setCameraPosition = useGameStore((state) => state.setCameraPosition);
  const playerBase = useGameStore((state) => state.playerBase);
  const running = useGameStore((state) => state.running);
  const stopGame = useGameStore((state) => state.stopGame);
  const setScreen = useUIStore((state) => state.setScreen);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
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
        case 'escape':
          stopGame();
          setScreen('menu');
          break;
      }
    },
    [running, moveCamera, setCameraPosition, playerBase, stopGame, setScreen]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
};
