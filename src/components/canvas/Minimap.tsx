import React, { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { useMultiplayerStore } from '../../stores/useMultiplayerStore';
import { useUIStore } from '../../stores/useUIStore';
import { drawMinimap, drawMinimapMultiplayer } from '../../renderer';
import { CONFIG } from '../../constants/config';
import { SoundControl } from '../ui/SoundControl';

export const Minimap: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const setCameraPosition = useGameStore((state) => state.setCameraPosition);
  const gameMode = useGameStore((state) => state.gameMode);
  const edgeScrollEnabled = useUIStore((state) => state.edgeScrollEnabled);
  const toggleEdgeScroll = useUIStore((state) => state.toggleEdgeScroll);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = CONFIG.MINIMAP_WIDTH;
    canvas.height = CONFIG.MINIMAP_HEIGHT;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      const state = useGameStore.getState();
      const zoom = state.camera.zoom;
      // 줌 비율을 적용한 실제 보이는 영역 크기
      const viewportWidth = window.innerWidth / zoom;
      const viewportHeight = (window.innerHeight - CONFIG.UI_PANEL_HEIGHT) / zoom;

      if (state.gameMode === 'multiplayer') {
        // 멀티플레이어 모드
        const mpState = useMultiplayerStore.getState();
        if (mpState.gameState && mpState.mySide) {
          drawMinimapMultiplayer(
            ctx,
            mpState.gameState,
            mpState.mySide,
            state.camera,
            CONFIG.MINIMAP_WIDTH,
            CONFIG.MINIMAP_HEIGHT,
            viewportWidth,
            viewportHeight
          );
        }
      } else {
        // 싱글플레이어 모드
        drawMinimap(
          ctx,
          state,
          CONFIG.MINIMAP_WIDTH,
          CONFIG.MINIMAP_HEIGHT,
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
  }, [gameMode]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const mapX = (clickX / CONFIG.MINIMAP_WIDTH) * CONFIG.MAP_WIDTH;
      const mapY = (clickY / CONFIG.MINIMAP_HEIGHT) * CONFIG.MAP_HEIGHT;

      const zoom = useGameStore.getState().camera.zoom;
      // 줌 비율을 적용한 실제 보이는 영역 크기
      const viewportWidth = window.innerWidth / zoom;
      const viewportHeight = (window.innerHeight - CONFIG.UI_PANEL_HEIGHT) / zoom;

      setCameraPosition(
        mapX - viewportWidth / 2,
        mapY - viewportHeight / 2
      );
    },
    [setCameraPosition]
  );

  return (
    <div className="absolute bottom-5 right-5">
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
          style={{ width: CONFIG.MINIMAP_WIDTH, height: CONFIG.MINIMAP_HEIGHT }}
        />

        {/* 글로우 효과 */}
        <div className="absolute inset-0 rounded-xl pointer-events-none border border-neon-cyan/10" />
      </div>
    </div>
  );
};
