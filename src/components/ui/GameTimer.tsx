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
    <div className="absolute left-1/2 -translate-x-1/2" style={{ top: 'max(1rem, env(safe-area-inset-top, 0px))' }}>
      <div
        className={`glass-dark rounded-xl border transition-all duration-300 ${isLowTime ? 'border-neon-red/50 shadow-neon-red' : 'border-dark-500/50'}`}
        style={{ padding: 'clamp(0.5rem, 1vw, 0.75rem) clamp(1rem, 2vw, 1.5rem)' }}
      >
        <div className="flex items-center gap-3">
          {/* 타이머 아이콘 */}
          <div className={`w-2 h-2 rounded-full animate-pulse ${isLowTime ? 'bg-neon-red' : 'bg-neon-cyan'}`} />

          {/* 시간 표시 - 고정 너비 */}
          <div
            className={`font-game tracking-wider tabular-nums text-center ${isLowTime ? 'text-neon-red text-glow-red' : 'text-white'}`}
            style={{ fontSize: 'clamp(1.25rem, 2vw, 1.5rem)', minWidth: 'clamp(4rem, 5vw, 5.5rem)' }}
          >
            {formatTime(time)}
          </div>

          {/* 타이머 아이콘 */}
          <div className={`w-2 h-2 rounded-full animate-pulse ${isLowTime ? 'bg-neon-red' : 'bg-neon-cyan'}`} />
        </div>
      </div>
    </div>
  );
};
