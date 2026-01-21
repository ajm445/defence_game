import React from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { soundManager } from '../../services/SoundManager';

export const GameTypeSelectScreen: React.FC = () => {
  const setScreen = useUIStore((state) => state.setScreen);

  const handleRTSMode = () => {
    soundManager.init();
    soundManager.play('ui_click');
    setScreen('modeSelect');
  };

  const handleRPGMode = () => {
    soundManager.init();
    soundManager.play('ui_click');
    setScreen('rpgClassSelect');
  };

  return (
    <div className="fixed inset-0 bg-menu-gradient grid-overlay flex flex-col items-center justify-center overflow-hidden">
      {/* 배경 효과 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-neon-cyan/5 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-neon-purple/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
      </div>

      {/* 메인 컨텐츠 */}
      <div className="relative z-10 flex flex-col items-center animate-fade-in">
        {/* 타이틀 */}
        <h1 className="font-game text-3xl md:text-4xl text-neon-cyan mb-4">
          게임 모드 선택
        </h1>
        <p className="text-gray-400 mb-12">플레이할 게임 유형을 선택하세요</p>

        <div style={{ height: '30px' }} />

        {/* 모드 카드들 */}
        <div className="flex gap-12">
          {/* RTS 모드 */}
          <button
            onClick={handleRTSMode}
            className="group relative w-72 h-96 rounded-xl overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
          >
            {/* 배경 그라데이션 */}
            <div className="absolute inset-0 bg-gradient-to-b from-neon-cyan/20 via-neon-blue/15 to-dark-800 group-hover:from-neon-cyan/30 group-hover:via-neon-blue/25 transition-all duration-300" />
            <div className="absolute inset-0 border-2 border-neon-cyan/50 rounded-xl group-hover:border-neon-cyan group-hover:shadow-[0_0_30px_rgba(34,211,238,0.3)] transition-all duration-300" />

            {/* 컨텐츠 */}
            <div className="relative h-full flex flex-col items-center justify-center p-8">
              {/* 아이콘 */}
              <div className="text-7xl mb-6 group-hover:scale-110 transition-transform duration-300">
                🏰
              </div>

              <div style={{ height: '30px' }} />

              {/* 타이틀 */}
              <h2 className="font-game text-2xl text-white mb-3">RTS 모드</h2>

              {/* 구분선 */}
              <div className="w-24 h-0.5 bg-gradient-to-r from-transparent via-neon-cyan to-transparent mb-4" />

              <div style={{ height: '10px' }} />

              {/* 설명 */}
              <p className="text-gray-300 text-center text-sm mb-4">
                자원을 채집하고<br />
                유닛을 생산하여<br />
                적 기지를 파괴하세요
              </p>

              {/* 서브 모드 목록 */}
              <div className="flex flex-col gap-1 text-xs text-gray-400">
                <span>• 튜토리얼</span>
                <span>• AI 대전</span>
                <span>• 1vs1 대전</span>
              </div>

              {/* 하단 태그 */}
              <div className="absolute bottom-4 px-3 py-1 bg-neon-cyan/20 rounded-full border border-neon-cyan/50"
              style={{ paddingLeft: '10px', paddingRight: '10px', paddingTop: '5px', paddingBottom: '5px' }}>
                <span className="text-neon-cyan text-xs font-bold">전략 시뮬레이션</span>
              </div>
            </div>
          </button>

          {/* RPG 모드 */}
          <button
            onClick={handleRPGMode}
            className="group relative w-72 h-96 rounded-xl overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
          >
            {/* 배경 그라데이션 */}
            <div className="absolute inset-0 bg-gradient-to-b from-purple-500/20 via-orange-500/15 to-dark-800 group-hover:from-purple-500/30 group-hover:via-orange-500/25 transition-all duration-300" />
            <div className="absolute inset-0 border-2 border-purple-500/50 rounded-xl group-hover:border-purple-400 group-hover:shadow-[0_0_30px_rgba(168,85,247,0.3)] transition-all duration-300" />

            {/* 컨텐츠 */}
            <div className="relative h-full flex flex-col items-center justify-center p-8">
              {/* 아이콘 */}
              <div className="text-7xl mb-6 group-hover:scale-110 transition-transform duration-300">
                ⚔️
              </div>

              <div style={{ height: '30px' }} />

              {/* 타이틀 */}
              <h2 className="font-game text-2xl text-white mb-3">RPG 모드</h2>

              {/* 구분선 */}
              <div className="w-24 h-0.5 bg-gradient-to-r from-transparent via-purple-400 to-transparent mb-4" />

              <div style={{ height: '10px' }} />

              {/* 설명 */}
              <p className="text-gray-300 text-center text-sm mb-4">
                영웅을 선택하고<br />
                스킬을 사용하여<br />
                웨이브를 생존하세요
              </p>

              {/* 서브 모드 목록 */}
              <div className="flex flex-col gap-1 text-xs text-gray-400">
                <span>• 4가지 직업</span>
                <span>• Q/W/E 스킬</span>
                <span>• 레벨업 시스템</span>
              </div>

              {/* 하단 태그 */}
              <div className="absolute bottom-4 px-3 py-1 bg-purple-500/20 rounded-full border border-purple-500/50"
              style={{ paddingLeft: '10px', paddingRight: '10px', paddingTop: '5px', paddingBottom: '5px' }}>
                <span className="text-purple-400 text-xs font-bold">액션 서바이벌</span>
              </div>
            </div>
          </button>
        </div>

        <div style={{ height: '30px' }} />

        {/* 뒤로 가기 */}
        <button
          onClick={() => setScreen('menu')}
          className="mt-12 px-8 py-3 rounded-lg border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white transition-all cursor-pointer"
          style={{ paddingLeft: '10px', paddingRight: '10px', paddingTop: '5px', paddingBottom: '5px' }}>
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
