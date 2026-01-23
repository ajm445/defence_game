import React, { useEffect, useRef } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { useMouseInput } from '../../hooks/useMouseInput';
import { useGameStore } from '../../stores/useGameStore';
import { useMultiplayerStore } from '../../stores/useMultiplayerStore';
import { useUIStore } from '../../stores/useUIStore';
import { render, renderMultiplayer } from '../../renderer';
import {
  initInterpolatedState,
  updateFromServer,
  interpolateFrame,
  resetInterpolatedState,
} from '../../hooks/useInterpolatedGameState';

export const GameCanvas: React.FC = () => {
  const { canvasRef, dimensions, getContext } = useCanvas();
  const { handleMouseDown, handleMouseMove, handleMouseUp, handleContextMenu } =
    useMouseInput(canvasRef);
  const animationRef = useRef<number>(0);
  const gameMode = useGameStore((state) => state.gameMode);
  const lastServerStateRef = useRef<string>('');

  useEffect(() => {
    const ctx = getContext();
    if (!ctx) return;

    // 보간 상태 초기화
    if (gameMode === 'multiplayer') {
      const mpState = useMultiplayerStore.getState();
      if (mpState.gameState) {
        initInterpolatedState(mpState.gameState);
      }
    }

    const animate = () => {
      const placementMode = useUIStore.getState().placementMode;

      if (gameMode === 'multiplayer') {
        // 멀티플레이어: 보간된 상태 렌더링
        const mpState = useMultiplayerStore.getState();
        const camera = useGameStore.getState().camera;

        if (mpState.gameState && mpState.mySide) {
          // 서버 상태 변경 감지 및 보간 상태 업데이트
          const stateKey = `${mpState.gameState.time}-${mpState.gameState.units.length}`;
          if (stateKey !== lastServerStateRef.current) {
            updateFromServer(mpState.gameState);
            lastServerStateRef.current = stateKey;
          }

          // 보간된 프레임 가져오기
          const interpolated = interpolateFrame();
          if (interpolated) {
            // 자원 노드는 서버 상태에서 가져옴
            const stateToRender = {
              ...interpolated,
              resourceNodes: mpState.gameState.resourceNodes,
              leftPlayer: {
                ...interpolated.leftPlayer,
                id: mpState.gameState.leftPlayer.id,
                name: mpState.gameState.leftPlayer.name,
              },
              rightPlayer: {
                ...interpolated.rightPlayer,
                id: mpState.gameState.rightPlayer.id,
                name: mpState.gameState.rightPlayer.name,
              },
            };
            renderMultiplayer(ctx, stateToRender, mpState.mySide, camera, dimensions.width, dimensions.height, placementMode);
          } else {
            renderMultiplayer(ctx, mpState.gameState, mpState.mySide, camera, dimensions.width, dimensions.height, placementMode);
          }
        }
      } else {
        // 싱글플레이어: 로컬 상태 렌더링
        const state = useGameStore.getState();
        render(ctx, state, dimensions.width, dimensions.height, placementMode);
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      // 멀티플레이어 모드에서 나가면 보간 상태 리셋
      if (gameMode === 'multiplayer') {
        resetInterpolatedState();
      }
    };
  }, [dimensions, getContext, gameMode]);

  return (
    <canvas
      ref={canvasRef}
      className="block bg-green-800 cursor-crosshair"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={handleContextMenu}
    />
  );
};
