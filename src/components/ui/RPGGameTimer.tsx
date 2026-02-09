import React from 'react';
import { useRPGStore } from '../../stores/useRPGStore';

export const RPGGameTimer: React.FC = () => {
  const gameTime = useRPGStore((state) => state.gameTime);

  const minutes = Math.floor(gameTime / 60);
  const seconds = Math.floor(gameTime % 60);

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
      <div
        className="glass-dark rounded-xl border border-dark-500/50"
        style={{ padding: 'clamp(0.25rem, 0.8vw, 0.5rem) clamp(0.75rem, 2vw, 1.25rem)' }}
      >
        <div className="flex items-center gap-2">
          {/* 타이머 아이콘 */}
          <span className="text-neon-cyan" style={{ fontSize: 'clamp(0.875rem, 1.4vw, 1rem)' }}>⏱️</span>

          {/* 시간 표시 */}
          <div
            className="font-game tracking-wider tabular-nums text-white"
            style={{ fontSize: 'clamp(1rem, 1.6vw, 1.25rem)', minWidth: 'clamp(3rem, 4vw, 4rem)' }}
          >
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </div>
        </div>
      </div>
    </div>
  );
};
