import React, { useEffect, useRef } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { useMouseInput } from '../../hooks/useMouseInput';
import { useGameStore } from '../../stores/useGameStore';
import { render } from '../../renderer';

export const GameCanvas: React.FC = () => {
  const { canvasRef, dimensions, getContext } = useCanvas();
  const { handleMouseDown, handleMouseMove, handleMouseUp, handleContextMenu } =
    useMouseInput(canvasRef);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const ctx = getContext();
    if (!ctx) return;

    const animate = () => {
      const state = useGameStore.getState();
      render(ctx, state, dimensions.width, dimensions.height);
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
      className="block bg-green-800 cursor-crosshair"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={handleContextMenu}
    />
  );
};
