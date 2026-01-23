import React, { useEffect, useCallback, useState } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { useUIStore } from '../../stores/useUIStore';
import { useTutorialStore } from '../../stores/useTutorialStore';
import { useRPGStore } from '../../stores/useRPGStore';
import { soundManager } from '../../services/SoundManager';

export const PauseScreen: React.FC = () => {
  const startGame = useGameStore((state) => state.startGame);
  const initGame = useGameStore((state) => state.initGame);
  const gameMode = useGameStore((state) => state.gameMode);
  const setScreen = useUIStore((state) => state.setScreen);
  const selectedDifficulty = useUIStore((state) => state.selectedDifficulty);
  const resetGameUI = useUIStore((state) => state.resetGameUI);
  const soundVolume = useUIStore((state) => state.soundVolume);
  const soundMuted = useUIStore((state) => state.soundMuted);
  const setSoundVolume = useUIStore((state) => state.setSoundVolume);
  const setSoundMuted = useUIStore((state) => state.setSoundMuted);
  const endTutorial = useTutorialStore((state) => state.endTutorial);
  const startTutorial = useTutorialStore((state) => state.startTutorial);

  const [showSettings, setShowSettings] = useState(false);

  const isTutorial = gameMode === 'tutorial';
  const isRPG = gameMode === 'rpg';

  const handleResume = useCallback(() => {
    if (isRPG) {
      // RPG 모드: 일시정지 해제
      useRPGStore.getState().setPaused(false);
      setScreen('game');
    } else {
      // 일반 모드
      startGame();
      setScreen('game');
    }
  }, [isRPG, startGame, setScreen]);

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
    if (isRPG) {
      // RPG 모드 재시작
      useRPGStore.getState().resetGame();
      useRPGStore.getState().initGame();
      setScreen('game');
    } else if (isTutorial) {
      // 튜토리얼 재시작
      endTutorial();
      initGame('tutorial', 'easy');
      startTutorial();
      startGame();
      setScreen('game');
    } else {
      initGame('ai', selectedDifficulty);
      // 카운트다운 화면으로 이동
      setScreen('countdown');
    }
  };

  const handleMainMenu = () => {
    resetGameUI(); // UI 상태 초기화
    if (isRPG) {
      // RPG 모드 정리
      useRPGStore.getState().resetGame();
    } else if (isTutorial) {
      endTutorial();
    }
    setScreen('menu');
  };

  // RPG 모드 게임 중단 (현재까지의 진행 저장 후 게임 오버 처리)
  const handleQuitGame = () => {
    if (isRPG) {
      // 게임 오버로 처리 (패배로 기록)
      useRPGStore.getState().setGameOver(false);
      // 게임 화면으로 돌아가서 게임 오버 모달 표시
      setScreen('game');
    }
  };

  const handleToggleSettings = () => {
    if (!showSettings) {
      // 설정 열 때 soundManager 동기화
      soundManager.setVolume(soundVolume);
      soundManager.setMuted(soundMuted);
    }
    setShowSettings(!showSettings);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setSoundVolume(newVolume);
    soundManager.setVolume(newVolume);
  };

  const handleToggleMute = () => {
    const newMuted = !soundMuted;
    setSoundMuted(newMuted);
    soundManager.setMuted(newMuted);
    // 음소거 해제 시 테스트 사운드 재생
    if (!newMuted) {
      soundManager.play('ui_click');
    }
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
            className="group relative px-8 py-3 rounded-lg overflow-hidden transition-all duration-200 hover:scale-105 active:scale-95"
            style={{ paddingTop: '5px', paddingBottom: '5px' }}
          >
            <div className="absolute inset-0 bg-neon-cyan/20" />
            <div className="absolute inset-0 border rounded-lg border-neon-cyan/50 group-hover:border-neon-cyan group-hover:shadow-neon-cyan transition-all duration-300" />
            <span className="relative font-game text-lg tracking-wider text-neon-cyan">
              계속하기
            </span>
          </button>

          <button
            onClick={handleRestart}
            className="group relative px-8 py-3 rounded-lg overflow-hidden transition-all duration-200 hover:scale-105 active:scale-95"
            style={{ paddingTop: '5px', paddingBottom: '5px' }}
          >
            <div className="absolute inset-0 bg-neon-purple/20" />
            <div className="absolute inset-0 border rounded-lg border-neon-purple/50 group-hover:border-neon-purple group-hover:shadow-neon-purple transition-all duration-300" />
            <span className="relative font-game text-lg tracking-wider text-neon-purple">
              다시 시작
            </span>
          </button>

          {/* RPG 모드 전용: 게임 중단 버튼 */}
          {isRPG && (
            <button
              onClick={handleQuitGame}
              className="group relative px-8 py-3 rounded-lg overflow-hidden transition-all duration-200 hover:scale-105 active:scale-95"
              style={{ paddingTop: '5px', paddingBottom: '5px' }}
            >
              <div className="absolute inset-0 bg-red-500/20" />
              <div className="absolute inset-0 border border-red-500/50 rounded-lg group-hover:border-red-400 group-hover:shadow-[0_0_10px_rgba(239,68,68,0.3)] transition-all duration-300" />
              <span className="relative font-korean text-lg text-red-400 group-hover:text-white transition-colors duration-300">
                🛑 게임 중단
              </span>
            </button>
          )}

          <button
            onClick={handleToggleSettings}
            className="group relative px-8 py-3 rounded-lg overflow-hidden transition-all duration-200 hover:scale-105 active:scale-95"
            style={{ paddingTop: '5px', paddingBottom: '5px' }}
          >
            <div className="absolute inset-0 bg-yellow-500/20" />
            <div className="absolute inset-0 border border-yellow-500/50 rounded-lg group-hover:border-yellow-400 group-hover:shadow-[0_0_10px_rgba(234,179,8,0.3)] transition-all duration-300" />
            <span className="relative font-korean text-lg text-yellow-400 group-hover:text-white transition-colors duration-300">
              ⚙️ 설정
            </span>
          </button>

          <button
            onClick={handleMainMenu}
            className="group relative px-8 py-3 rounded-lg overflow-hidden transition-all duration-200 hover:scale-105 active:scale-95"
            style={{ paddingTop: '5px', paddingBottom: '5px' }}
          >
            <div className="absolute inset-0 bg-dark-600/50" />
            <div className="absolute inset-0 border border-dark-400 rounded-lg group-hover:border-gray-500 transition-all duration-300" />
            <span className="relative font-korean text-lg text-gray-400 group-hover:text-white transition-colors duration-300">
              메인 메뉴
            </span>
          </button>
        </div>

        {/* 설정 패널 */}
        {showSettings && (
          <div className="mt-8 bg-dark-800/90 rounded-xl p-6 border border-gray-600 min-w-[300px]">
            <h3 className="text-white font-bold text-lg mb-4 text-center">설정</h3>

            {/* 음량 조절 */}
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-300">음량</span>
                  <span className="text-neon-cyan">{Math.round(soundVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={soundVolume}
                  onChange={handleVolumeChange}
                  className="w-full h-2 bg-dark-600 rounded-lg appearance-none cursor-pointer accent-neon-cyan"
                />
              </div>

              {/* 음소거 토글 */}
              <div className="flex justify-between items-center">
                <span className="text-gray-300">음소거</span>
                <button
                  onClick={handleToggleMute}
                  className={`px-4 py-2 rounded-lg border transition-all cursor-pointer ${
                    soundMuted
                      ? 'bg-red-500/20 border-red-500 text-red-400'
                      : 'bg-green-500/20 border-green-500 text-green-400'
                  }`}
                >
                  {soundMuted ? '🔇 꺼짐' : '🔊 켜짐'}
                </button>
              </div>
            </div>

            {/* 닫기 버튼 */}
            <button
              onClick={handleToggleSettings}
              className="mt-4 w-full py-2 bg-dark-600 hover:bg-dark-500 text-gray-300 rounded-lg transition-colors cursor-pointer"
            >
              닫기
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
