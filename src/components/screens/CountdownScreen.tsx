import React, { useEffect, useState } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { useUIStore } from '../../stores/useUIStore';

export const CountdownScreen: React.FC = () => {
  const [count, setCount] = useState(3);
  const startGame = useGameStore((state) => state.startGame);
  const setScreen = useUIStore((state) => state.setScreen);

  useEffect(() => {
    if (count > 0) {
      const timer = setTimeout(() => {
        setCount(count - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      // 카운트다운 종료 → 게임 시작
      startGame();
      setScreen('game');
    }
  }, [count, startGame, setScreen]);

  return (
    <div className="fixed inset-0 bg-dark-900/70 flex items-center justify-center z-50">
      {/* 배경 효과 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl bg-neon-cyan/10 animate-pulse" style={{ width: 'min(37.5rem, 80vw)', height: 'min(37.5rem, 80vw)' }} />
      </div>

      {/* 카운트다운 숫자 */}
      <div className="relative z-10 flex flex-col items-center">
        {count > 0 ? (
          <div
            key={count}
            className="animate-bounce-in"
          >
            <span className="font-game font-bold text-transparent bg-clip-text bg-gradient-to-b from-neon-cyan to-neon-purple drop-shadow-2xl" style={{ fontSize: 'clamp(5rem, 20vw, 12.5rem)' }}>
              {count}
            </span>
          </div>
        ) : (
          <div className="animate-bounce-in">
            <span className="font-game font-bold text-neon-cyan" style={{ fontSize: 'clamp(2.5rem, 10vw, 5rem)' }}>
              START!
            </span>
          </div>
        )}

        {/* 안내 텍스트 */}
        <div className="text-gray-400" style={{ marginTop: 'clamp(1rem, 3vh, 2rem)', fontSize: 'clamp(0.875rem, 2.5vw, 1.125rem)' }}>
          게임이 곧 시작됩니다...
        </div>
      </div>
    </div>
  );
};
