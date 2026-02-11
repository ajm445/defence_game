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

  const [dimensions, setDimensions] = useState(() => {
    const zoom = parseFloat(document.documentElement.style.zoom) || 1;
    return {
      width: fixedWidth ?? Math.round(window.innerWidth / zoom),
      height: fixedHeight ?? Math.round(window.innerHeight / zoom) - (fullscreen ? 0 : CONFIG.UI_PANEL_HEIGHT),
    };
  });

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // CSS zoom이 html에 적용된 경우 (모바일 전체화면) 캔버스 버퍼 크기 보상
    // HTML 요소는 zoom이 자동 보상되지만 canvas pixel buffer는 수동 보상 필요
    const zoom = parseFloat(document.documentElement.style.zoom) || 1;
    const width = fixedWidth ?? Math.round(window.innerWidth / zoom);
    const height = fixedHeight ?? Math.round(window.innerHeight / zoom) - getPanelHeight();

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
