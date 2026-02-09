import { useRef, useEffect, useCallback, useState } from 'react';
import { CONFIG, getResponsiveConfig } from '../constants/config';
import { useUIStore } from '../stores/useUIStore';

export const useCanvas = (fixedWidth?: number, fixedHeight?: number, fullscreen?: boolean) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const uiScale = useUIStore((s) => s.uiScale);

  const getPanelHeight = useCallback(() => {
    // RPG 모바일: fullscreen 모드면 패널 높이 0 (터치 컨트롤이 오버레이)
    if (fullscreen) return 0;
    return getResponsiveConfig(uiScale).UI_PANEL_HEIGHT;
  }, [uiScale, fullscreen]);

  const [dimensions, setDimensions] = useState({
    width: fixedWidth ?? window.innerWidth,
    height: fixedHeight ?? window.innerHeight - (fullscreen ? 0 : CONFIG.UI_PANEL_HEIGHT),
  });

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = fixedWidth ?? window.innerWidth;
    const height = fixedHeight ?? window.innerHeight - getPanelHeight();

    canvas.width = width;
    canvas.height = height;
    setDimensions({ width, height });
  }, [fixedWidth, fixedHeight, getPanelHeight]);

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
