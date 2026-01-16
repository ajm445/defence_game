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

🎯 승리 조건
• 적 본진의 HP를 0으로 만들면 승리
• 10분 종료 시 HP가 높은 쪽이 승리
• HP가 같으면 패배

━━━━━━━━━━━━━━━━━━━━━━━━

📦 자원
• 골드: 초당 4 자동 획득 (모든 행동의 기본)
• 나무: 나무꾼이 채집, 궁수/기사/건설에 필요
• 돌: 광부가 채집, 기사/벽/업그레이드에 필요
• 약초: 채집꾼이 채집, 10개당 30골드로 판매 가능
• 수정: 맵 중앙에서 획득 가능한 희귀 자원

━━━━━━━━━━━━━━━━━━━━━━━━

⚔️ 전투 유닛
• 검병: 50골드 | HP 100 | 공격력 15 | 근접
• 궁수: 80골드+10나무 | HP 50 | 공격력 25 | 원거리
• 기사: 120골드+20나무+30돌 | HP 250 | 공격력 30 | 근접 탱커

👷 지원 유닛 (자동 채집)
• 나무꾼: 30골드 | 나무 채집 (1.0/초)
• 광부: 40골드+5나무 | 돌 채집 (0.8/초)
• 채집꾼: 35골드 | 약초 채집 (1.2/초)
• 금광부: 100골드+20나무 | 골드 채집 (1.5/초)

━━━━━━━━━━━━━━━━━━━━━━━━

🏗️ 건설/업그레이드
• 벽 건설: 20나무+10돌 → HP 200 방어벽
• 기지 업그레이드: 100골드+50돌 → 본진 HP +200
• 약초 판매: 약초 10개 → 30골드

━━━━━━━━━━━━━━━━━━━━━━━━

🎮 조작법
• 좌클릭: 유닛 선택
• 우클릭 드래그: 카메라 이동
• WASD / 방향키: 카메라 이동
• 스페이스바: 본진으로 카메라 이동
• 미니맵 클릭: 해당 위치로 이동
• ESC: 메인 메뉴로 돌아가기

━━━━━━━━━━━━━━━━━━━━━━━━

💡 전략 팁
• 초반에 나무꾼 2~3명을 먼저 고용하세요
• 궁수는 비싸지만 원거리 공격으로 효율적입니다
• 기사는 HP가 높아 전선 유지에 좋습니다
• 벽으로 적의 공격을 지연시킬 수 있습니다

⏱️ 제한 시간: 10분`);
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
          Press a button to start
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
