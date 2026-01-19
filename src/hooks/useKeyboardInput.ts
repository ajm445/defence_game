import { useEffect, useCallback } from 'react';
import { useGameStore } from '../stores/useGameStore';
import { useUIStore } from '../stores/useUIStore';
import { wsClient } from '../services/WebSocketClient';
import { CONFIG } from '../constants/config';

export const useKeyboardInput = () => {
  const moveCamera = useGameStore((state) => state.moveCamera);
  const setCameraPosition = useGameStore((state) => state.setCameraPosition);
  const playerBase = useGameStore((state) => state.playerBase);
  const running = useGameStore((state) => state.running);
  const gameMode = useGameStore((state) => state.gameMode);
  const stopGame = useGameStore((state) => state.stopGame);
  const startGame = useGameStore((state) => state.startGame);
  const resources = useGameStore((state) => state.resources);
  const upgradePlayerBase = useGameStore((state) => state.upgradePlayerBase);
  const sellHerb = useGameStore((state) => state.sellHerb);
  const canBuildWall = useGameStore((state) => state.canBuildWall);
  const canUpgradeBase = useGameStore((state) => state.canUpgradeBase);
  const canSellHerb = useGameStore((state) => state.canSellHerb);
  const setScreen = useUIStore((state) => state.setScreen);
  const currentScreen = useUIStore((state) => state.currentScreen);
  const placementMode = useUIStore((state) => state.placementMode);
  const setPlacementMode = useUIStore((state) => state.setPlacementMode);
  const showNotification = useUIStore((state) => state.showNotification);

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
          moveCamera(-speed, 0);
          break;
        case 'arrowright':
          moveCamera(speed, 0);
          break;
        case 'arrowup':
          moveCamera(0, -speed);
          break;
        case 'arrowdown':
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
        // Q: 벽 배치 모드 토글
        case 'q':
          if (placementMode === 'wall') {
            setPlacementMode('none');
            showNotification('벽 배치 취소');
          } else if (canBuildWall()) {
            setPlacementMode('wall');
            showNotification('벽을 배치할 위치를 클릭하세요!');
          } else {
            showNotification('자원이 부족합니다!');
          }
          break;
        // W: 본진 강화
        case 'w':
          if (gameMode === 'multiplayer') {
            wsClient.upgradeBase();
            showNotification('본진 강화 요청!');
          } else {
            if (canUpgradeBase()) {
              const currentLevel = playerBase.upgradeLevel ?? 0;
              if (upgradePlayerBase()) {
                const newLevel = currentLevel + 1;
                const newGoldPerSec = CONFIG.GOLD_PER_SECOND + (newLevel * CONFIG.BASE_UPGRADE.GOLD_BONUS);
                showNotification(`본진 강화! (+${CONFIG.BASE_UPGRADE.HP_BONUS} HP, 골드 수입 ${newGoldPerSec}/초)`);
              }
            } else {
              showNotification('자원이 부족하거나 최대 레벨입니다!');
            }
          }
          break;
        // E: 약초 판매
        case 'e':
          if (gameMode === 'multiplayer') {
            wsClient.sellHerb();
            showNotification('약초 판매 요청!');
          } else {
            if (canSellHerb()) {
              if (sellHerb()) {
                showNotification(`약초 판매! (+${CONFIG.HERB_SELL_GOLD} 골드)`);
              }
            } else {
              showNotification('약초가 부족합니다!');
            }
          }
          break;
      }
    },
    [running, gameMode, currentScreen, moveCamera, setCameraPosition, playerBase, stopGame, startGame, setScreen, placementMode, setPlacementMode, showNotification, canBuildWall, canUpgradeBase, canSellHerb, upgradePlayerBase, sellHerb, resources]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
};
