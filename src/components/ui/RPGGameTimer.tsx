import React from 'react';
import { useRPGStore } from '../../stores/useRPGStore';
import { useRPGCoopStore } from '../../stores/useRPGCoopStore';

interface RPGGameTimerProps {
  mode: 'single' | 'coop';
}

export const RPGGameTimer: React.FC<RPGGameTimerProps> = ({ mode }) => {
  const singleGameTime = useRPGStore((state) => state.gameTime);
  const coopGameTime = useRPGCoopStore((state) => state.gameState?.gameTime ?? 0);

  const gameTime = mode === 'single' ? singleGameTime : coopGameTime;

  const minutes = Math.floor(gameTime / 60);
  const seconds = Math.floor(gameTime % 60);

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
      <div className="glass-dark rounded-xl px-5 py-2 border border-dark-500/50">
        <div className="flex items-center gap-2">
          {/* 타이머 아이콘 */}
          <span className="text-neon-cyan">⏱️</span>

          {/* 시간 표시 */}
          <div
            className="font-game text-xl tracking-wider tabular-nums text-white"
            style={{ minWidth: '4rem' }}
          >
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </div>
        </div>
      </div>
    </div>
  );
};
