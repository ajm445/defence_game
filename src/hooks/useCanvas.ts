import { useRef, useEffect, useCallback, useState } from 'react';
import { CONFIG } from '../constants/config';

export const useCanvas = (fixedWidth?: number, fixedHeight?: number) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({
    width: fixedWidth ?? window.innerWidth,
    height: fixedHeight ?? window.innerHeight - CONFIG.UI_PANEL_HEIGHT,
  });

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = fixedWidth ?? window.innerWidth;
    const height = fixedHeight ?? window.innerHeight - CONFIG.UI_PANEL_HEIGHT;

    canvas.width = width;
    canvas.height = height;
    setDimensions({ width, height });
  }, [fixedWidth, fixedHeight]);

  useEffect(() => {
    resize();

    if (!fixedWidth && !fixedHeight) {
      window.addEventListener('resize', resize);
      return () => window.removeEventListener('resize', resize);
    }
  }, [resize, fixedWidth, fixedHeight]);

  const getContext = useCallback(() => {
    return canvasRef.current?.getContext('2d') ?? null;
  }, []);

  return { canvasRef, dimensions, getContext };
};
