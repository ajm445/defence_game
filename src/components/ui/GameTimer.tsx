import React from 'react';
import { useGameTime, useGameStore } from '../../stores/useGameStore';
import { useMultiplayerStore } from '../../stores/useMultiplayerStore';
import { formatTime } from '../../utils/format';

export const GameTimer: React.FC = () => {
  const gameMode = useGameStore((state) => state.gameMode);
  const singlePlayerTime = useGameTime();
  const gameState = useMultiplayerStore((state) => state.gameState);

  // 멀티플레이어 모드에서는 서버 상태의 시간 사용
  const time = gameMode === 'multiplayer' && gameState
    ? gameState.maxTime - gameState.time // 남은 시간
    : singlePlayerTime;

  const isLowTime = time < 60; // 1분 미만

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2">
      <div className={`
        glass-dark rounded-xl px-6 py-3 border transition-all duration-300
        ${isLowTime ? 'border-neon-red/50 shadow-neon-red' : 'border-dark-500/50'}
      `}>
        <div className="flex items-center gap-3">
          {/* 타이머 아이콘 */}
          <div className={`w-2 h-2 rounded-full animate-pulse ${isLowTime ? 'bg-neon-red' : 'bg-neon-cyan'}`} />

          {/* 시간 표시 */}
          <div className={`
            font-game text-2xl tracking-wider tabular-nums
            ${isLowTime ? 'text-neon-red text-glow-red' : 'text-white'}
          `}>
            {formatTime(time)}
          </div>

          {/* 타이머 아이콘 */}
          <div className={`w-2 h-2 rounded-full animate-pulse ${isLowTime ? 'bg-neon-red' : 'bg-neon-cyan'}`} />
        </div>

        {/* 프로그레스 바 */}
        <div className="mt-2 h-1 bg-dark-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-1000 ${isLowTime ? 'bg-neon-red' : 'bg-neon-cyan'}`}
            style={{ width: `${(time / (20 * 60)) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};
