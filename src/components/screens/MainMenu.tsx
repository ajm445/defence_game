import React from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { useUIStore } from '../../stores/useUIStore';

export const MainMenu: React.FC = () => {
  const initGame = useGameStore((state) => state.initGame);
  const startGame = useGameStore((state) => state.startGame);
  const setScreen = useUIStore((state) => state.setScreen);

  const handleStartGame = () => {
    initGame();
    startGame();
    setScreen('game');
  };

  const handleShowHelp = () => {
    alert(`[ 세워라! 무너트려라! - 도움말 ]

🎯 목표: 적 본진을 파괴하세요!

📦 자원:
• 골드: 자동으로 획득
• 나무/돌/약초: 클릭하거나 일꾼 고용
• 수정: 희귀 자원

⚔️ 유닛:
• 검병: 근접 공격, 저렴함
• 궁수: 원거리 공격, 나무 필요
• 나무꾼/광부/채집꾼: 자원 자동 수급

🎮 조작:
• 좌클릭: 유닛 선택, 자원 채집
• 우클릭 드래그: 카메라 이동
• WASD/방향키: 카메라 이동
• 스페이스: 본진으로 이동
• 미니맵 클릭: 해당 위치로 이동

⏱️ 20분 내에 승부를 결정하세요!`);
  };

  return (
    <div className="fixed inset-0 bg-menu-gradient grid-overlay flex flex-col items-center justify-center overflow-hidden">
      {/* 배경 효과 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* 움직이는 원형 글로우 */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-neon-cyan/5 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-neon-purple/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-neon-blue/3 rounded-full blur-3xl" />
      </div>

      {/* 메인 컨텐츠 */}
      <div className="relative z-10 flex flex-col items-center animate-fade-in">
        {/* 서브 타이틀 */}
        <div className="text-neon-cyan/70 text-sm tracking-[0.5em] uppercase font-game">
          Defense Strategy
        </div>

        {/* 간격 */}
        <div style={{ height: '30px' }} />

        {/* 메인 타이틀 */}
        <div className="relative mb-2">
          <h1 className="font-game text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-white via-neon-cyan to-neon-blue animate-float">
            세워라! 무너트려라!
          </h1>
          {/* 타이틀 글로우 효과 */}
          <div className="absolute inset-0 font-game text-4xl md:text-5xl font-bold text-neon-cyan/20 blur-2xl pointer-events-none flex items-center justify-center">
            세워라! 무너트려라!
          </div>
        </div>

        {/* 구분선 */}
        <div className="w-64 h-px bg-gradient-to-r from-transparent via-neon-cyan/50 to-transparent my-8" />

        <div style={{ height: '30px' }} />
        
        {/* 버튼 그룹 */}
        <div className="flex flex-col gap-4 mt-4">
          <button
            onClick={handleStartGame}
            className="group relative px-12 py-4 rounded-lg overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
          >
            {/* 버튼 배경 */}
            <div className="absolute inset-0 bg-gradient-to-r from-neon-cyan/20 to-neon-blue/20 group-hover:from-neon-cyan/30 group-hover:to-neon-blue/30 transition-all duration-300 pointer-events-none" />
            <div className="absolute inset-0 border border-neon-cyan/50 rounded-lg group-hover:border-neon-cyan group-hover:shadow-neon-cyan transition-all duration-300 pointer-events-none" />

            {/* 스캔라인 효과 */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 group-hover:animate-[scanline_2s_linear_infinite] pointer-events-none" />

            {/* 버튼 텍스트 */}
            <span className="relative font-game text-xl tracking-wider text-neon-cyan group-hover:text-white transition-colors duration-300">
              게임 시작
            </span>
          </button>

          <button
            onClick={handleShowHelp}
            className="group relative px-12 py-3 rounded-lg overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
          >
            <div className="absolute inset-0 bg-dark-700/50 group-hover:bg-dark-600/50 transition-all duration-300 pointer-events-none" />
            <div className="absolute inset-0 border border-dark-400 rounded-lg group-hover:border-gray-500 transition-all duration-300 pointer-events-none" />
            <span className="relative font-korean text-lg text-gray-400 group-hover:text-white transition-colors duration-300">
              도움말
            </span>
          </button>
        </div>
      </div>

      {/* 하단 정보 - 메인 컨테이너 기준으로 배치 */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none z-10">
        <div className="text-gray-400 text-xs tracking-widest uppercase">
          Press any button to start
        </div>
        <div className="flex items-center gap-4 text-gray-500 text-xs">
          <span>WASD - Move Camera</span>
          <span className="w-1 h-1 rounded-full bg-gray-500" />
          <span>SPACE - Home Base</span>
          <span className="w-1 h-1 rounded-full bg-gray-500" />
          <span>ESC - Menu</span>
        </div>
      </div>

      {/* 코너 장식 */}
      <div className="absolute top-4 left-4 w-16 h-16 border-l-2 border-t-2 border-neon-cyan/30" />
      <div className="absolute top-4 right-4 w-16 h-16 border-r-2 border-t-2 border-neon-cyan/30" />
      <div className="absolute bottom-4 left-4 w-16 h-16 border-l-2 border-b-2 border-neon-cyan/30" />
      <div className="absolute bottom-4 right-4 w-16 h-16 border-r-2 border-b-2 border-neon-cyan/30" />
    </div>
  );
};
