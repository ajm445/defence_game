import React from 'react';
import { useUIStore } from '../../stores/useUIStore';

export const ModeSelectScreen: React.FC = () => {
  const setScreen = useUIStore((state) => state.setScreen);

  return (
    <div className="fixed inset-0 bg-menu-gradient grid-overlay flex flex-col items-center justify-center overflow-hidden">
      {/* 배경 효과 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-neon-cyan/5 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-neon-purple/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
      </div>

      {/* 메인 컨텐츠 */}
      <div className="relative z-10 flex flex-col items-center animate-fade-in">
        {/* 타이틀 */}
        <h1 className="font-game text-3xl md:text-4xl text-neon-cyan mb-12">
          게임 모드 선택
        </h1>

        <div style={{ height: '30px' }} />

        {/* 모드 버튼들 */}
        <div className="flex gap-8">
          {/* AI 대전 */}
          <button
            onClick={() => setScreen('difficultySelect')}
            className="group relative w-48 h-64 rounded-lg overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-neon-cyan/20 to-neon-blue/20 group-hover:from-neon-cyan/30 group-hover:to-neon-blue/30 transition-all duration-300" />
            <div className="absolute inset-0 border-2 border-neon-cyan/50 rounded-lg group-hover:border-neon-cyan group-hover:shadow-neon-cyan transition-all duration-300" />

            <div className="relative h-full flex flex-col items-center justify-center p-6">
              <div className="text-6xl mb-4">🤖</div>
              <br></br>
              <h2 className="font-game text-xl text-white mb-2">AI 대전</h2>
              <p className="text-gray-400 text-sm text-center">
                AI와 대결하세요
              </p>
              <p className="text-neon-cyan text-xs mt-2">
                난이도 선택 가능
              </p>
            </div>
          </button>

          {/* 1vs1 대전 */}
          <button
            onClick={() => setScreen('lobby')}
            className="group relative w-48 h-64 rounded-lg overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-neon-purple/20 to-neon-pink/20 group-hover:from-neon-purple/30 group-hover:to-neon-pink/30 transition-all duration-300" />
            <div className="absolute inset-0 border-2 border-neon-purple/50 rounded-lg group-hover:border-neon-purple group-hover:shadow-neon-purple transition-all duration-300" />

            <div className="relative h-full flex flex-col items-center justify-center p-6">
              <div className="text-6xl mb-4">⚔️</div>
              <br></br>
              <h2 className="font-game text-xl text-white mb-2">1vs1 대전</h2>
              <p className="text-gray-400 text-sm text-center">
                다른 플레이어와 대결
              </p>
              <p className="text-neon-purple text-xs mt-2">
                실시간 매칭
              </p>
            </div>
          </button>
        </div>

        <div style={{ height: '30px' }} />
        
        {/* 뒤로 가기 */}
        <button
          onClick={() => setScreen('menu')}
          className="mt-12 px-8 py-3 rounded-lg border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white transition-all cursor-pointer"
          style={{ paddingLeft: '10px', paddingRight: '10px', paddingTop: '5px', paddingBottom: '5px' }}
        >
          뒤로 가기
        </button>
      </div>

      {/* 코너 장식 */}
      <div className="absolute top-4 left-4 w-16 h-16 border-l-2 border-t-2 border-neon-cyan/30" />
      <div className="absolute top-4 right-4 w-16 h-16 border-r-2 border-t-2 border-neon-cyan/30" />
      <div className="absolute bottom-4 left-4 w-16 h-16 border-l-2 border-b-2 border-neon-cyan/30" />
      <div className="absolute bottom-4 right-4 w-16 h-16 border-r-2 border-b-2 border-neon-cyan/30" />
    </div>
  );
};
