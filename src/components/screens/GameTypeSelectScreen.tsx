import React from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { useAuthStore, useAuthStatus } from '../../stores/useAuthStore';
import { soundManager } from '../../services/SoundManager';
import { wsClient } from '../../services/WebSocketClient';

export const GameTypeSelectScreen: React.FC = () => {
  const setScreen = useUIStore((state) => state.setScreen);
  const authStatus = useAuthStatus();

  const handleRTSMode = () => {
    soundManager.init();
    soundManager.play('ui_click');
    // 인증되지 않은 경우 로그인 화면으로 이동
    if (authStatus !== 'authenticated') {
      setScreen('login');
    } else {
      wsClient.notifyModeChange('rts');
      setScreen('modeSelect');
    }
  };

  const handleRPGMode = () => {
    soundManager.init();
    soundManager.play('ui_click');
    // 인증되지 않은 경우 로그인 화면으로 이동
    if (authStatus !== 'authenticated') {
      setScreen('login');
    } else {
      wsClient.notifyModeChange('rpg');
      // 대기방 목록 화면으로 바로 이동
      setScreen('rpgCoopLobby');
    }
  };

  return (
    <div className="fixed inset-0 bg-menu-gradient grid-overlay flex flex-col items-center justify-center overflow-hidden">
      {/* 배경 효과 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/3 bg-neon-cyan/5 rounded-full blur-3xl animate-pulse-slow" style={{ width: 'min(24rem, 50vw)', height: 'min(24rem, 50vw)' }} />
        <div className="absolute bottom-1/4 right-1/3 bg-neon-purple/5 rounded-full blur-3xl animate-pulse-slow" style={{ width: 'min(24rem, 50vw)', height: 'min(24rem, 50vw)', animationDelay: '1s' }} />
      </div>

      {/* 메인 컨텐츠 */}
      <div className="relative z-10 flex flex-col items-center animate-fade-in" style={{ padding: '0 clamp(1rem, 4vw, 2rem)' }}>
        {/* 타이틀 */}
        <h1 className="font-game text-neon-cyan" style={{ fontSize: 'clamp(1.5rem, 4vw, 2.25rem)', marginBottom: 'clamp(0.5rem, 1.5vh, 1rem)' }}>
          게임 모드 선택
        </h1>
        <p className="text-gray-400" style={{ fontSize: 'clamp(0.75rem, 2vw, 1rem)', marginBottom: 'clamp(1.5rem, 4vh, 3rem)' }}>플레이할 게임 유형을 선택하세요</p>

        <div style={{ height: 'clamp(1rem, 3vh, 1.875rem)' }} />

        {/* 모드 카드들 */}
        <div className="flex flex-wrap justify-center" style={{ padding: '0 clamp(0.5rem, 2vw, 1rem)', gap: 'clamp(1.5rem, 4vw, 3rem)' }}>
          {/* RTS 모드 */}
          <button
            onClick={handleRTSMode}
            className="group relative rounded-xl overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
            style={{ width: 'clamp(10rem, 28vw, 18rem)', height: 'clamp(14rem, 38vh, 24rem)' }}
          >
            {/* 배경 그라데이션 */}
            <div className="absolute inset-0 bg-gradient-to-b from-neon-cyan/20 via-neon-blue/15 to-dark-800 group-hover:from-neon-cyan/30 group-hover:via-neon-blue/25 transition-all duration-300" />
            <div className="absolute inset-0 border-2 border-neon-cyan/50 rounded-xl group-hover:border-neon-cyan group-hover:shadow-[0_0_30px_rgba(34,211,238,0.3)] transition-all duration-300" />

            {/* 컨텐츠 */}
            <div className="relative h-full flex flex-col items-center justify-center" style={{ padding: 'clamp(1rem, 3vw, 2rem)' }}>
              {/* 아이콘 */}
              <div className="group-hover:scale-110 transition-transform duration-300" style={{ fontSize: 'clamp(2.5rem, 7vw, 4.5rem)', marginBottom: 'clamp(0.75rem, 2vh, 1.5rem)' }}>
                🏰
              </div>

              <div style={{ height: 'clamp(1rem, 3vh, 1.875rem)' }} />

              {/* 타이틀 */}
              <h2 className="font-game text-white" style={{ fontSize: 'clamp(1rem, 2.5vw, 1.5rem)', marginBottom: 'clamp(0.375rem, 1vh, 0.75rem)' }}>RTS 모드</h2>

              {/* 구분선 */}
              <div className="h-0.5 bg-gradient-to-r from-transparent via-neon-cyan to-transparent" style={{ width: 'clamp(4rem, 10vw, 6rem)', marginBottom: 'clamp(0.5rem, 1.5vh, 1rem)' }} />

              <div style={{ height: 'clamp(0.25rem, 1vh, 0.625rem)' }} />

              {/* 설명 */}
              <p className="text-gray-300 text-center" style={{ fontSize: 'clamp(0.625rem, 1.5vw, 0.875rem)', marginBottom: 'clamp(0.5rem, 1.5vh, 1rem)' }}>
                자원을 채집하고<br />
                유닛을 생산하여<br />
                적 기지를 파괴하세요
              </p>

              {/* 서브 모드 목록 */}
              <div className="flex flex-col text-gray-400" style={{ gap: 'clamp(0.125rem, 0.5vh, 0.25rem)', fontSize: 'clamp(0.5rem, 1.2vw, 0.75rem)' }}>
                <span>• 튜토리얼</span>
                <span>• AI 대전</span>
                <span>• 1vs1 대전</span>
              </div>

              {/* 하단 태그 */}
              <div className="absolute bg-neon-cyan/20 rounded-full border border-neon-cyan/50" style={{ bottom: 'clamp(0.5rem, 1.5vh, 1rem)', padding: 'clamp(0.25rem, 0.8vw, 0.5rem) clamp(0.5rem, 1.5vw, 0.75rem)' }}>
                <span className="text-neon-cyan font-bold" style={{ fontSize: 'clamp(0.5rem, 1.2vw, 0.75rem)' }}>전략 시뮬레이션</span>
              </div>
            </div>
          </button>

          {/* RPG 모드 */}
          <button
            onClick={handleRPGMode}
            className="group relative rounded-xl overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
            style={{ width: 'clamp(10rem, 28vw, 18rem)', height: 'clamp(14rem, 38vh, 24rem)' }}
          >
            {/* 배경 그라데이션 */}
            <div className="absolute inset-0 bg-gradient-to-b from-purple-500/20 via-orange-500/15 to-dark-800 group-hover:from-purple-500/30 group-hover:via-orange-500/25 transition-all duration-300" />
            <div className="absolute inset-0 border-2 border-purple-500/50 rounded-xl group-hover:border-purple-400 group-hover:shadow-[0_0_30px_rgba(168,85,247,0.3)] transition-all duration-300" />

            {/* 컨텐츠 */}
            <div className="relative h-full flex flex-col items-center justify-center" style={{ padding: 'clamp(1rem, 3vw, 2rem)' }}>
              {/* 아이콘 */}
              <div className="group-hover:scale-110 transition-transform duration-300" style={{ fontSize: 'clamp(2.5rem, 7vw, 4.5rem)', marginBottom: 'clamp(0.75rem, 2vh, 1.5rem)' }}>
                ⚔️
              </div>

              <div style={{ height: 'clamp(1rem, 3vh, 1.875rem)' }} />

              {/* 타이틀 */}
              <h2 className="font-game text-white" style={{ fontSize: 'clamp(1rem, 2.5vw, 1.5rem)', marginBottom: 'clamp(0.375rem, 1vh, 0.75rem)' }}>RPG 모드</h2>

              {/* 구분선 */}
              <div className="h-0.5 bg-gradient-to-r from-transparent via-purple-400 to-transparent" style={{ width: 'clamp(4rem, 10vw, 6rem)', marginBottom: 'clamp(0.5rem, 1.5vh, 1rem)' }} />

              <div style={{ height: 'clamp(0.25rem, 1vh, 0.625rem)' }} />

              {/* 설명 */}
              <p className="text-gray-300 text-center" style={{ fontSize: 'clamp(0.625rem, 1.5vw, 0.875rem)', marginBottom: 'clamp(0.5rem, 1.5vh, 1rem)' }}>
                영웅을 선택하고<br />
                스킬을 사용하여<br />
                넥서스를 지키고 보스를 처치하세요
              </p>

              {/* 서브 모드 목록 */}
              <div className="flex flex-col text-gray-400" style={{ gap: 'clamp(0.125rem, 0.5vh, 0.25rem)', fontSize: 'clamp(0.5rem, 1.2vw, 0.75rem)' }}>
                <span>• 싱글 / 협동 플레이</span>
                <span>• 4가지 직업</span>
                <span>• 다양한 전직</span>
              </div>

              {/* 하단 태그 */}
              <div className="absolute bg-purple-500/20 rounded-full border border-purple-500/50" style={{ bottom: 'clamp(0.5rem, 1.5vh, 1rem)', padding: 'clamp(0.25rem, 0.8vw, 0.5rem) clamp(0.5rem, 1.5vw, 0.75rem)' }}>
                <span className="text-purple-400 font-bold" style={{ fontSize: 'clamp(0.5rem, 1.2vw, 0.75rem)' }}>액션 서바이벌</span>
              </div>
            </div>
          </button>
        </div>

        <div style={{ height: 'clamp(1rem, 3vh, 1.875rem)' }} />

        {/* 뒤로 가기 */}
        <button
          onClick={() => {
            soundManager.init();
            soundManager.play('ui_click');
            wsClient.notifyModeChange(null);
            setScreen('menu');
          }}
          className="rounded-lg border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white transition-all cursor-pointer"
          style={{ padding: 'clamp(0.4rem, 1.2vh, 0.75rem) clamp(1rem, 3vw, 2rem)', marginTop: 'clamp(1.5rem, 4vh, 3rem)', fontSize: 'clamp(0.75rem, 2vw, 1rem)' }}>
          뒤로 가기
        </button>
      </div>

      {/* 코너 장식 */}
      <div className="absolute border-l-2 border-t-2 border-neon-cyan/30" style={{ top: 'clamp(0.5rem, 1vw, 1rem)', left: 'clamp(0.5rem, 1vw, 1rem)', width: 'clamp(2rem, 4vw, 4rem)', height: 'clamp(2rem, 4vw, 4rem)' }} />
      <div className="absolute border-r-2 border-t-2 border-neon-cyan/30" style={{ top: 'clamp(0.5rem, 1vw, 1rem)', right: 'clamp(0.5rem, 1vw, 1rem)', width: 'clamp(2rem, 4vw, 4rem)', height: 'clamp(2rem, 4vw, 4rem)' }} />
      <div className="absolute border-l-2 border-b-2 border-neon-cyan/30" style={{ bottom: 'clamp(0.5rem, 1vw, 1rem)', left: 'clamp(0.5rem, 1vw, 1rem)', width: 'clamp(2rem, 4vw, 4rem)', height: 'clamp(2rem, 4vw, 4rem)' }} />
      <div className="absolute border-r-2 border-b-2 border-neon-cyan/30" style={{ bottom: 'clamp(0.5rem, 1vw, 1rem)', right: 'clamp(0.5rem, 1vw, 1rem)', width: 'clamp(2rem, 4vw, 4rem)', height: 'clamp(2rem, 4vw, 4rem)' }} />
    </div>
  );
};
