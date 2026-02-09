import React, { useEffect, useRef } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { useRPGInput } from '../../hooks/useRPGInput';
import { useRPGStore } from '../../stores/useRPGStore';
import { renderRPG } from '../../renderer/rpgRenderer';

export const RPGCanvas: React.FC = () => {
  // RPG: 모바일에서는 캔버스 전체 화면 (터치 컨트롤이 오버레이)
  const { canvasRef, dimensions, getContext } = useCanvas(undefined, undefined, true);
  const { handlePointerDown, handlePointerMove, handlePointerUp, handleContextMenu } =
    useRPGInput(canvasRef);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const ctx = getContext();
    if (!ctx) return;

    const animate = () => {
      const state = useRPGStore.getState();
      renderRPG(ctx, state, dimensions.width, dimensions.height);
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [dimensions, getContext]);

  return (
    <canvas
      ref={canvasRef}
      className="block bg-dark-900 cursor-crosshair"
      style={{ touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onContextMenu={handleContextMenu}
    />
  );
};
