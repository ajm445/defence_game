import React, { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { useMultiplayerStore } from '../../stores/useMultiplayerStore';
import { useUIStore } from '../../stores/useUIStore';
import { drawMinimap, drawMinimapMultiplayer } from '../../renderer';
import { CONFIG, getResponsiveConfig } from '../../constants/config';
import { SoundControl } from '../ui/SoundControl';

export const Minimap: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const setCameraPosition = useGameStore((state) => state.setCameraPosition);
  const gameMode = useGameStore((state) => state.gameMode);
  const edgeScrollEnabled = useUIStore((state) => state.edgeScrollEnabled);
  const toggleEdgeScroll = useUIStore((state) => state.toggleEdgeScroll);
  const uiScale = useUIStore((state) => state.uiScale);
  const isMobile = useUIStore((state) => state.isMobile);
  const isTablet = useUIStore((state) => state.isTablet);
  const isTouchDevice = useUIStore((state) => state.isTouchDevice);
  const responsiveConfig = getResponsiveConfig(isTouchDevice ? Math.max(uiScale, 1.0) : uiScale);
  const minimapWidth = responsiveConfig.MINIMAP_WIDTH;
  const minimapHeight = responsiveConfig.MINIMAP_HEIGHT;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = minimapWidth;
    canvas.height = minimapHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      const state = useGameStore.getState();
      const zoom = state.camera.zoom;
      // 줌 비율을 적용한 실제 보이는 영역 크기
      const viewportWidth = window.innerWidth / zoom;
      const viewportHeight = (window.innerHeight - responsiveConfig.UI_PANEL_HEIGHT) / zoom;

      if (state.gameMode === 'multiplayer') {
        // 멀티플레이어 모드
        const mpState = useMultiplayerStore.getState();
        if (mpState.gameState && mpState.mySide) {
          drawMinimapMultiplayer(
            ctx,
            mpState.gameState,
            mpState.mySide,
            state.camera,
            minimapWidth,
            minimapHeight,
            viewportWidth,
            viewportHeight
          );
        }
      } else {
        // 싱글플레이어 모드
        drawMinimap(
          ctx,
          state,
          minimapWidth,
          minimapHeight,
          viewportWidth,
          viewportHeight
        );
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameMode, minimapWidth, minimapHeight]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const mapX = (clickX / minimapWidth) * CONFIG.MAP_WIDTH;
      const mapY = (clickY / minimapHeight) * CONFIG.MAP_HEIGHT;

      const zoom = useGameStore.getState().camera.zoom;
      // 줌 비율을 적용한 실제 보이는 영역 크기
      const viewportWidth = window.innerWidth / zoom;
      const viewportHeight = (window.innerHeight - responsiveConfig.UI_PANEL_HEIGHT) / zoom;

      setCameraPosition(
        mapX - viewportWidth / 2,
        mapY - viewportHeight / 2
      );
    },
    [setCameraPosition]
  );

  return (
    <div
      className="absolute"
      style={{ right: 'max(1.25rem, env(safe-area-inset-right, 0px))', bottom: `max(${isMobile ? 28 : isTablet ? 24 : 20}px, env(safe-area-inset-bottom, 0px))` }}
    >
      {/* 사운드 컨트롤 버튼 */}
      <div className="absolute -top-1 -left-20">
        <SoundControl />
      </div>

      {/* 가장자리 스크롤 토글 버튼 */}
      <button
        onClick={toggleEdgeScroll}
        className={`absolute -top-1 -left-10 w-8 h-8 rounded flex items-center justify-center text-sm transition-all duration-200 z-10 ${
          edgeScrollEnabled
            ? 'bg-neon-cyan/20 border border-neon-cyan/50'
            : 'bg-dark-700/80 border border-dark-500 opacity-50'
        }`}
        title={`가장자리 스크롤: ${edgeScrollEnabled ? 'ON' : 'OFF'} (Y)`}
      >
        📷
      </button>

      {/* 미니맵 프레임 */}
      <div className="relative glass-dark rounded-xl p-2 border border-dark-500/50">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">Map</div>
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-neon-cyan/50" />
            <div className="w-2 h-2 rounded-full bg-neon-red/50" />
          </div>
        </div>

        {/* 캔버스 */}
        <canvas
          ref={canvasRef}
          onClick={handleClick}
          className="rounded-lg cursor-pointer hover:brightness-110 transition-all duration-200"
          style={{ width: minimapWidth, height: minimapHeight }}
        />

        {/* 글로우 효과 */}
        <div className="absolute inset-0 rounded-xl pointer-events-none border border-neon-cyan/10" />
      </div>
    </div>
  );
};
