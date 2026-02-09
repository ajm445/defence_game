import React from 'react';
import { useRPGStore } from '../../stores/useRPGStore';
import { useUIStore } from '../../stores/useUIStore';

export const RPGGameTimer: React.FC = () => {
  const gameTime = useRPGStore((state) => state.gameTime);
  const isMobile = useUIStore((s) => s.isMobile);

  const minutes = Math.floor(gameTime / 60);
  const seconds = Math.floor(gameTime % 60);

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
      <div className={`glass-dark rounded-xl ${isMobile ? 'px-3 py-1' : 'px-5 py-2'} border border-dark-500/50`}>
        <div className="flex items-center gap-2">
          {/* 타이머 아이콘 */}
          <span className={`text-neon-cyan ${isMobile ? 'text-sm' : ''}`}>⏱️</span>

          {/* 시간 표시 */}
          <div
            className={`font-game ${isMobile ? 'text-base' : 'text-xl'} tracking-wider tabular-nums text-white`}
            style={{ minWidth: isMobile ? '3rem' : '4rem' }}
          >
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </div>
        </div>
      </div>
    </div>
  );
};
