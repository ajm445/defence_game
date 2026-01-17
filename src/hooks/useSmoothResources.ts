import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../stores/useGameStore';
import { useMultiplayerStore } from '../stores/useMultiplayerStore';
import type { Resources } from '@shared/types/game';

const GOLD_PER_SECOND = 4;
const UPDATE_INTERVAL = 16; // ~60fps

interface SmoothResources extends Resources {
  displayGold: number; // 부드럽게 보간된 골드 값
}

export function useSmoothResources(): SmoothResources {
  const gameMode = useGameStore((state) => state.gameMode);
  const gameState = useMultiplayerStore((state) => state.gameState);
  const mySide = useMultiplayerStore((state) => state.mySide);

  // 서버에서 받은 자원
  const serverResources = gameMode === 'multiplayer' && gameState && mySide
    ? (mySide === 'left' ? gameState.leftPlayer.resources : gameState.rightPlayer.resources)
    : null;

  const [displayGold, setDisplayGold] = useState(serverResources?.gold ?? 0);
  const lastServerGoldRef = useRef(serverResources?.gold ?? 0);
  const lastUpdateTimeRef = useRef(performance.now());

  // 서버 골드 변경 감지
  useEffect(() => {
    if (serverResources && serverResources.gold !== lastServerGoldRef.current) {
      // 서버 값이 변경되면 즉시 반영
      setDisplayGold(serverResources.gold);
      lastServerGoldRef.current = serverResources.gold;
      lastUpdateTimeRef.current = performance.now();
    }
  }, [serverResources?.gold]);

  // 골드 부드러운 증가 (매 프레임)
  useEffect(() => {
    if (gameMode !== 'multiplayer' || !serverResources) return;

    const interval = setInterval(() => {
      const now = performance.now();
      const deltaTime = (now - lastUpdateTimeRef.current) / 1000;
      lastUpdateTimeRef.current = now;

      setDisplayGold((prev) => {
        const predicted = prev + GOLD_PER_SECOND * deltaTime;
        // 서버 값보다 너무 많이 앞서나가지 않도록 제한
        const maxAllowed = lastServerGoldRef.current + GOLD_PER_SECOND * 0.5; // 0.5초 정도 앞서 예측
        return Math.min(predicted, maxAllowed);
      });
    }, UPDATE_INTERVAL);

    return () => clearInterval(interval);
  }, [gameMode, serverResources]);

  if (!serverResources) {
    return {
      gold: 0,
      wood: 0,
      stone: 0,
      herb: 0,
      crystal: 0,
      displayGold: 0,
    };
  }

  return {
    ...serverResources,
    displayGold,
  };
}

// 상대방 자원용 (보간 없이)
export function useOpponentResources(): Resources | null {
  const gameMode = useGameStore((state) => state.gameMode);
  const gameState = useMultiplayerStore((state) => state.gameState);
  const mySide = useMultiplayerStore((state) => state.mySide);

  if (gameMode !== 'multiplayer' || !gameState || !mySide) {
    return null;
  }

  return mySide === 'left'
    ? gameState.rightPlayer.resources
    : gameState.leftPlayer.resources;
}
