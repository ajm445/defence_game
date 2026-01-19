import React, { useEffect, useCallback } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { useUIStore } from '../../stores/useUIStore';

export const PauseScreen: React.FC = () => {
  const startGame = useGameStore((state) => state.startGame);
  const initGame = useGameStore((state) => state.initGame);
  const setScreen = useUIStore((state) => state.setScreen);
  const selectedDifficulty = useUIStore((state) => state.selectedDifficulty);
  const resetGameUI = useUIStore((state) => state.resetGameUI);

  const handleResume = useCallback(() => {
    startGame();
    setScreen('game');
  }, [startGame, setScreen]);

  // ESC 키로 게임 재개
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleResume();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleResume]);

  const handleRestart = () => {
    resetGameUI(); // UI 상태 초기화
    initGame('ai', selectedDifficulty);
    // 카운트다운 화면으로 이동
    setScreen('countdown');
  };

  const handleMainMenu = () => {
    resetGameUI(); // UI 상태 초기화
    setScreen('menu');
  };

  return (
    <div className="fixed inset-0 bg-dark-900/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center animate-fade-in">
      {/* 배경 효과 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full blur-3xl bg-neon-purple/10" />
      </div>

      <div className="relative z-10 flex flex-col items-center">
        {/* 아이콘 */}
        <div className="text-6xl mb-6">
          ⏸️
        </div>

        <div style={{ height: '30px' }} />

        {/* 메인 텍스트 */}
        <h1 className="font-game text-5xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-b from-gray-200 to-gray-400">
          일시정지
        </h1>

        <div style={{ height: '30px' }} />

        {/* 버튼들 */}
        <div className="flex flex-col gap-4 min-w-[250px]">
          <button
            onClick={handleResume}
            className="group relative px-8 py-3 rounded-lg overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95"
          >
            <div className="absolute inset-0 bg-neon-cyan/20" />
            <div className="absolute inset-0 border rounded-lg border-neon-cyan/50 group-hover:border-neon-cyan group-hover:shadow-neon-cyan transition-all duration-300" />
            <span className="relative font-game text-lg tracking-wider text-neon-cyan">
              계속하기
            </span>
          </button>

          <button
            onClick={handleRestart}
            className="group relative px-8 py-3 rounded-lg overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95"
          >
            <div className="absolute inset-0 bg-neon-purple/20" />
            <div className="absolute inset-0 border rounded-lg border-neon-purple/50 group-hover:border-neon-purple group-hover:shadow-neon-purple transition-all duration-300" />
            <span className="relative font-game text-lg tracking-wider text-neon-purple">
              다시 시작
            </span>
          </button>

          <button
            onClick={handleMainMenu}
            className="group relative px-8 py-3 rounded-lg overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95"
          >
            <div className="absolute inset-0 bg-dark-600/50" />
            <div className="absolute inset-0 border border-dark-400 rounded-lg group-hover:border-gray-500 transition-all duration-300" />
            <span className="relative font-korean text-lg text-gray-400 group-hover:text-white transition-colors duration-300">
              메인 메뉴
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
