import React from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { useGameStore } from '../../stores/useGameStore';
import { useTutorialStore } from '../../stores/useTutorialStore';
import { soundManager } from '../../services/SoundManager';
import { ProfileButton } from '../ui/ProfileButton';
import { FriendSidebar } from '../ui/FriendSidebar';

export const ModeSelectScreen: React.FC = () => {
  const setScreen = useUIStore((state) => state.setScreen);
  const resetGameUI = useUIStore((state) => state.resetGameUI);
  const initGame = useGameStore((state) => state.initGame);
  const startGame = useGameStore((state) => state.startGame);
  const startTutorial = useTutorialStore((state) => state.startTutorial);

  const handleTutorial = () => {
    soundManager.init(); // 사운드 시스템 초기화
    soundManager.play('ui_click');
    resetGameUI(); // 이전 게임의 UI 상태 초기화
    initGame('tutorial', 'easy');
    startTutorial();
    startGame(); // 카운트다운 없이 바로 게임 시작
    setScreen('game');
  };

  return (
    <div className="fixed inset-0 bg-menu-gradient grid-overlay flex overflow-hidden">
      {/* 배경 효과 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 bg-neon-cyan/5 rounded-full blur-3xl animate-pulse-slow" style={{ width: 'min(24rem, 50vw)', height: 'min(24rem, 50vw)' }} />
        <div className="absolute bottom-1/4 right-1/4 bg-neon-purple/5 rounded-full blur-3xl animate-pulse-slow" style={{ width: 'min(24rem, 50vw)', height: 'min(24rem, 50vw)', animationDelay: '1s' }} />
      </div>

      {/* 왼쪽 상단 프로필 버튼 */}
      <div className="absolute z-20" style={{ top: 'clamp(1rem, 3vw, 2rem)', left: 'clamp(1rem, 3vw, 2rem)' }}>
        <ProfileButton />
      </div>

      {/* 메인 컨텐츠 영역 */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="relative z-10 flex flex-col items-center animate-fade-in" style={{ padding: '0 clamp(1rem, 4vw, 2rem)' }}>
          {/* 타이틀 */}
          <h1 className="font-game text-neon-cyan" style={{ fontSize: 'clamp(1.5rem, 4vw, 2.25rem)', marginBottom: 'clamp(0.5rem, 1.5vh, 1rem)' }}>
            RTS 모드
          </h1>
          <p className="text-gray-400" style={{ fontSize: 'clamp(0.75rem, 2vw, 1rem)', marginBottom: 'clamp(1rem, 3vh, 2rem)' }}>플레이할 모드를 선택하세요</p>

          <div style={{ height: 'clamp(1rem, 3vh, 1.875rem)' }} />

          {/* 모드 버튼들 */}
          <div className="flex flex-wrap justify-center" style={{ padding: '0 clamp(0.5rem, 2vw, 1rem)', gap: 'clamp(1rem, 3vw, 2rem)' }}>
            {/* 튜토리얼 */}
            <button
              onClick={handleTutorial}
              className="group relative rounded-lg overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
              style={{ width: 'clamp(8rem, 20vw, 12rem)', height: 'clamp(11rem, 28vh, 16rem)' }}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-green-500/20 to-emerald-600/20 group-hover:from-green-500/30 group-hover:to-emerald-600/30 transition-all duration-300" />
              <div className="absolute inset-0 border-2 border-green-500/50 rounded-lg group-hover:border-green-400 group-hover:shadow-[0_0_20px_rgba(34,197,94,0.3)] transition-all duration-300" />

              <div className="relative h-full flex flex-col items-center justify-center" style={{ padding: 'clamp(0.75rem, 2vw, 1.5rem)' }}>
                <div style={{ fontSize: 'clamp(2rem, 5vw, 3.75rem)', marginBottom: 'clamp(0.5rem, 1.5vh, 1rem)' }}>📖</div>
                <br></br>
                <h2 className="font-game text-white" style={{ fontSize: 'clamp(0.875rem, 2vw, 1.25rem)', marginBottom: 'clamp(0.25rem, 0.75vh, 0.5rem)' }}>튜토리얼</h2>
                <p className="text-gray-400 text-center" style={{ fontSize: 'clamp(0.625rem, 1.5vw, 0.875rem)' }}>
                  게임 방법을 배우세요
                </p>
                <p className="text-green-400" style={{ fontSize: 'clamp(0.5rem, 1.2vw, 0.75rem)', marginTop: 'clamp(0.25rem, 0.75vh, 0.5rem)' }}>
                  초보자 추천
                </p>
              </div>
            </button>

            {/* AI 대전 */}
            <button
              onClick={() => {
                soundManager.init();
                soundManager.play('ui_click');
                setScreen('difficultySelect');
              }}
              className="group relative rounded-lg overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
              style={{ width: 'clamp(8rem, 20vw, 12rem)', height: 'clamp(11rem, 28vh, 16rem)' }}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-neon-cyan/20 to-neon-blue/20 group-hover:from-neon-cyan/30 group-hover:to-neon-blue/30 transition-all duration-300" />
              <div className="absolute inset-0 border-2 border-neon-cyan/50 rounded-lg group-hover:border-neon-cyan group-hover:shadow-neon-cyan transition-all duration-300" />

              <div className="relative h-full flex flex-col items-center justify-center" style={{ padding: 'clamp(0.75rem, 2vw, 1.5rem)' }}>
                <div style={{ fontSize: 'clamp(2rem, 5vw, 3.75rem)', marginBottom: 'clamp(0.5rem, 1.5vh, 1rem)' }}>🤖</div>
                <br></br>
                <h2 className="font-game text-white" style={{ fontSize: 'clamp(0.875rem, 2vw, 1.25rem)', marginBottom: 'clamp(0.25rem, 0.75vh, 0.5rem)' }}>AI 대전</h2>
                <p className="text-gray-400 text-center" style={{ fontSize: 'clamp(0.625rem, 1.5vw, 0.875rem)' }}>
                  AI와 대결하세요
                </p>
                <p className="text-neon-cyan" style={{ fontSize: 'clamp(0.5rem, 1.2vw, 0.75rem)', marginTop: 'clamp(0.25rem, 0.75vh, 0.5rem)' }}>
                  난이도 선택 가능
                </p>
              </div>
            </button>

            {/* 1vs1 대전 */}
            <button
              onClick={() => {
                soundManager.init();
                soundManager.play('ui_click');
                setScreen('lobby');
              }}
              className="group relative rounded-lg overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
              style={{ width: 'clamp(8rem, 20vw, 12rem)', height: 'clamp(11rem, 28vh, 16rem)' }}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-neon-purple/20 to-neon-pink/20 group-hover:from-neon-purple/30 group-hover:to-neon-pink/30 transition-all duration-300" />
              <div className="absolute inset-0 border-2 border-neon-purple/50 rounded-lg group-hover:border-neon-purple group-hover:shadow-neon-purple transition-all duration-300" />

              <div className="relative h-full flex flex-col items-center justify-center" style={{ padding: 'clamp(0.75rem, 2vw, 1.5rem)' }}>
                <div style={{ fontSize: 'clamp(2rem, 5vw, 3.75rem)', marginBottom: 'clamp(0.5rem, 1.5vh, 1rem)' }}>⚔️</div>
                <br></br>
                <h2 className="font-game text-white" style={{ fontSize: 'clamp(0.875rem, 2vw, 1.25rem)', marginBottom: 'clamp(0.25rem, 0.75vh, 0.5rem)' }}>1vs1 대전</h2>
                <p className="text-gray-400 text-center" style={{ fontSize: 'clamp(0.625rem, 1.5vw, 0.875rem)' }}>
                  다른 플레이어와 대결
                </p>
                <p className="text-neon-purple" style={{ fontSize: 'clamp(0.5rem, 1.2vw, 0.75rem)', marginTop: 'clamp(0.25rem, 0.75vh, 0.5rem)' }}>
                  실시간 매칭
                </p>
              </div>
            </button>
          </div>

          <div style={{ height: 'clamp(1rem, 3vh, 1.875rem)' }} />

          {/* 뒤로 가기 */}
          <button
            onClick={() => {
              soundManager.play('ui_click');
              setScreen('gameTypeSelect');
            }}
            className="rounded-lg border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white transition-all cursor-pointer"
            style={{ padding: 'clamp(0.4rem, 1.2vh, 0.75rem) clamp(1rem, 3vw, 2rem)', marginTop: 'clamp(1.5rem, 4vh, 3rem)', fontSize: 'clamp(0.75rem, 2vw, 1rem)' }}
          >
            뒤로 가기
          </button>
        </div>
      </div>

      {/* 오른쪽 친구 사이드바 */}
      <div className="relative z-20 h-full">
        <FriendSidebar />
      </div>

      {/* 코너 장식 */}
      <div className="absolute border-l-2 border-t-2 border-neon-cyan/30" style={{ top: 'clamp(0.5rem, 1vw, 1rem)', left: 'clamp(0.5rem, 1vw, 1rem)', width: 'clamp(2rem, 4vw, 4rem)', height: 'clamp(2rem, 4vw, 4rem)' }} />
      <div className="absolute border-l-2 border-b-2 border-neon-cyan/30" style={{ bottom: 'clamp(0.5rem, 1vw, 1rem)', left: 'clamp(0.5rem, 1vw, 1rem)', width: 'clamp(2rem, 4vw, 4rem)', height: 'clamp(2rem, 4vw, 4rem)' }} />
    </div>
  );
};
