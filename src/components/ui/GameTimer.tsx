import React, { useState, useEffect, useRef } from 'react';
import { useGameTime, useGameStore } from '../../stores/useGameStore';
import { useMultiplayerStore } from '../../stores/useMultiplayerStore';
import { formatTime } from '../../utils/format';

// 부드러운 시간 보간 훅
function useSmoothTime(): number {
  const gameMode = useGameStore((state) => state.gameMode);
  const singlePlayerTime = useGameTime();
  const gameState = useMultiplayerStore((state) => state.gameState);

  const [smoothTime, setSmoothTime] = useState(0);
  const lastServerTimeRef = useRef(0);
  const lastUpdateRef = useRef(performance.now());

  useEffect(() => {
    if (gameMode !== 'multiplayer' || !gameState) {
      setSmoothTime(singlePlayerTime);
      return;
    }

    // 서버 시간 업데이트
    const serverTime = gameState.maxTime - gameState.time;
    if (serverTime !== lastServerTimeRef.current) {
      setSmoothTime(serverTime);
      lastServerTimeRef.current = serverTime;
      lastUpdateRef.current = performance.now();
    }
  }, [gameMode, gameState, singlePlayerTime]);

  // 부드러운 감소 (매 프레임)
  useEffect(() => {
    if (gameMode !== 'multiplayer') return;

    const interval = setInterval(() => {
      const now = performance.now();
      const deltaTime = (now - lastUpdateRef.current) / 1000;
      lastUpdateRef.current = now;

      setSmoothTime((prev) => Math.max(0, prev - deltaTime));
    }, 16);

    return () => clearInterval(interval);
  }, [gameMode]);

  return smoothTime;
}

export const GameTimer: React.FC = () => {
  const time = useSmoothTime();

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
            className={`h-full transition-all duration-100 ${isLowTime ? 'bg-neon-red' : 'bg-neon-cyan'}`}
            style={{ width: `${(time / (10 * 60)) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};
