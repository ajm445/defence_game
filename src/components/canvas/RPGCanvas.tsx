import React, { useEffect, useRef } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { useRPGInput } from '../../hooks/useRPGInput';
import { useRPGStore } from '../../stores/useRPGStore';
import { renderRPG } from '../../renderer/rpgRenderer';

export const RPGCanvas: React.FC = () => {
  const { canvasRef, dimensions, getContext } = useCanvas();
  const { handleMouseDown, handleMouseMove, handleMouseUp, handleContextMenu } =
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
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={handleContextMenu}
    />
  );
};
