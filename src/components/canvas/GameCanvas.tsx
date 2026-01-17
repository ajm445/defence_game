import React, { useEffect, useRef } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { useMouseInput } from '../../hooks/useMouseInput';
import { useGameStore } from '../../stores/useGameStore';
import { useMultiplayerStore } from '../../stores/useMultiplayerStore';
import { render, renderMultiplayer } from '../../renderer';

export const GameCanvas: React.FC = () => {
  const { canvasRef, dimensions, getContext } = useCanvas();
  const { handleMouseDown, handleMouseMove, handleMouseUp, handleContextMenu } =
    useMouseInput(canvasRef);
  const animationRef = useRef<number>(0);
  const gameMode = useGameStore((state) => state.gameMode);

  useEffect(() => {
    const ctx = getContext();
    if (!ctx) return;

    const animate = () => {
      if (gameMode === 'multiplayer') {
        // 멀티플레이어: 서버 상태 렌더링
        const mpState = useMultiplayerStore.getState();
        const camera = useGameStore.getState().camera;
        if (mpState.gameState && mpState.mySide) {
          renderMultiplayer(ctx, mpState.gameState, mpState.mySide, camera, dimensions.width, dimensions.height);
        }
      } else {
        // 싱글플레이어: 로컬 상태 렌더링
        const state = useGameStore.getState();
        render(ctx, state, dimensions.width, dimensions.height);
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
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
