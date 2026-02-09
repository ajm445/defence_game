import React, { useEffect, useCallback, useState } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { useUIStore } from '../../stores/useUIStore';
import { useTutorialStore } from '../../stores/useTutorialStore';
import { useRPGStore } from '../../stores/useRPGStore';
import { useProfileStore } from '../../stores/useProfileStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { createDefaultStatUpgrades } from '../../types/auth';
import { soundManager } from '../../services/SoundManager';
import { leaveMultiplayerRoom } from '../../hooks/useNetworkSync';
import { wsClient } from '../../services/WebSocketClient';

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
  const saveSoundSettings = useAuthStore((state) => state.saveSoundSettings);

  const [showSettings, setShowSettings] = useState(false);

  const isTutorial = gameMode === 'tutorial';
  const isRPG = gameMode === 'rpg';

  // 멀티플레이어 상태 확인
  const { isMultiplayer, isHost } = useRPGStore.getState().multiplayer;

  // 멀티플레이어 클라이언트인지 확인
  const isMultiplayerClient = isRPG && isMultiplayer && !isHost;

  // 호스트가 일시정지 화면에 진입하면 서버에 알림
  useEffect(() => {
    if (isRPG && isMultiplayer && isHost) {
      wsClient.pauseCoopGame();
    }
  }, [isRPG, isMultiplayer, isHost]);

  const handleResume = useCallback(() => {
    if (isRPG) {
      // 호스트인 경우 서버에 재개 알림
      if (isMultiplayer && isHost) {
        wsClient.resumeCoopGame();
      }
      // RPG 모드: 일시정지 해제
      useRPGStore.getState().setPaused(false);
      setScreen('game');
    } else {
      // 일반 모드
      startGame();
      setScreen('game');
    }
  }, [isRPG, isMultiplayer, isHost, startGame, setScreen]);

  // 클라이언트용 설정 닫기 (게임으로 돌아가기)
  const handleCloseClientSettings = useCallback(() => {
    setScreen('game');
  }, [setScreen]);

  // ESC 키 처리
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isMultiplayerClient) {
          // 클라이언트는 설정 화면만 닫기
          handleCloseClientSettings();
        } else {
          // 호스트 또는 싱글플레이어는 게임 재개
          handleResume();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMultiplayerClient, handleResume, handleCloseClientSettings]);

  const handleRestart = () => {
    // 호스트인 경우 서버에 재개 알림 (일시정지 해제 후 재시작)
    if (isRPG && isMultiplayer && isHost) {
      wsClient.resumeCoopGame();
    }

    resetGameUI(); // UI 상태 초기화
    if (isRPG) {
      // RPG 모드 재시작
      const rpgState = useRPGStore.getState();
      const heroClass = rpgState.selectedClass || 'warrior';
      const classProgressList = useProfileStore.getState().classProgress;
      const classProgress = classProgressList.find(p => p.className === heroClass);
      const characterLevel = classProgress?.classLevel ?? 1;
      const statUpgrades = classProgress?.statUpgrades ?? createDefaultStatUpgrades();
      const advancedClass = classProgress?.advancedClass;
      const tier = classProgress?.tier;

      useRPGStore.getState().resetGame();
      useRPGStore.getState().initGame(characterLevel, statUpgrades, undefined, advancedClass, tier);
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
    // 호스트인 경우 서버에 재개 알림
    if (isRPG && isMultiplayer && isHost) {
      wsClient.resumeCoopGame();
    }

    resetGameUI(); // UI 상태 초기화
    if (isRPG) {
      // RPG 모드 정리 - 대기방 로비로 이동
      useRPGStore.getState().resetGame();
      setScreen('rpgCoopLobby');
    } else if (isTutorial) {
      // RTS 튜토리얼 - 모드 선택 화면으로 이동
      endTutorial();
      setScreen('modeSelect');
    } else {
      // RTS AI 대전 - 난이도 선택 화면으로 이동
      setScreen('difficultySelect');
    }
  };

  // RPG 모드 게임 중단 (현재까지의 진행 저장 후 게임 오버 처리)
  const handleQuitGame = () => {
    if (isRPG) {
      // 일시정지 해제
      useRPGStore.getState().setPaused(false);
      // 게임 오버로 처리 (패배로 기록)
      useRPGStore.getState().setGameOver(false);

      // 멀티플레이어인 경우 방 나가기
      const { isMultiplayer: isMP } = useRPGStore.getState().multiplayer;
      if (isMP) {
        leaveMultiplayerRoom();
      }

      // 게임 화면으로 돌아가서 게임 오버 모달 표시
      setScreen('game');
    }
  };

  // 멀티플레이어: 게임 중단 (호스트만) - 모든 플레이어에게 게임 오버 처리
  const handleStopGame = () => {
    if (isRPG && isMultiplayer && isHost) {
      // 서버에 게임 중단 요청 (모든 클라이언트에게 게임 오버 브로드캐스트)
      wsClient.stopCoopGame();
    }
  };

  const handleToggleSettings = () => {
    if (!showSettings) {
      // 설정 열 때 soundManager 동기화
      soundManager.setVolume(soundVolume);
      soundManager.setBGMVolume(soundVolume); // BGM도 동기화
      soundManager.setMuted(soundMuted);
    }
    setShowSettings(!showSettings);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setSoundVolume(newVolume);
    soundManager.setVolume(newVolume);
    soundManager.setBGMVolume(newVolume); // BGM도 동기화
    // 설정 저장 (로그인 사용자: DB, 게스트: localStorage)
    saveSoundSettings(newVolume, soundMuted);
  };

  const handleToggleMute = () => {
    const newMuted = !soundMuted;
    setSoundMuted(newMuted);
    soundManager.setMuted(newMuted);
    // 설정 저장 (로그인 사용자: DB, 게스트: localStorage)
    saveSoundSettings(soundVolume, newMuted);
    // 음소거 해제 시 테스트 사운드 재생
    if (!newMuted) {
      soundManager.play('ui_click');
    }
  };

  // 클라이언트용 설정 전용 UI
  if (isMultiplayerClient) {
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

          <div style={{ height: '20px' }} />

          {/* 메인 텍스트 */}
          <h1 className="font-game text-3xl sm:text-4xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-b from-gray-200 to-gray-400">
            일시정지
          </h1>

          {/* 방장 대기 안내 */}
          <p className="text-gray-400 mb-6 text-center">
            방장의 결정을 기다리는 중...
          </p>

          {/* 설정 패널 (항상 표시) */}
          <div className="bg-dark-800/90 rounded-xl p-4 sm:p-6 border border-gray-600 w-[80vw] sm:w-auto sm:min-w-[300px] max-w-[350px]">
            <h3 className="text-white font-bold text-lg mb-4 text-center">소리 설정</h3>

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
              onClick={handleCloseClientSettings}
              className="mt-4 w-full py-2 bg-dark-600 hover:bg-dark-500 text-gray-300 rounded-lg transition-colors cursor-pointer"
            >
              닫기 (ESC)
            </button>
          </div>

          {/* 게임 나가기 버튼 */}
          <button
            onClick={handleQuitGame}
            className="mt-4 group relative px-8 py-3 rounded-lg overflow-hidden transition-all duration-200 hover:scale-105 active:scale-95"
            style={{ paddingTop: '5px', paddingBottom: '5px' }}
          >
            <div className="absolute inset-0 bg-red-500/20" />
            <div className="absolute inset-0 border border-red-500/50 rounded-lg group-hover:border-red-400 group-hover:shadow-[0_0_10px_rgba(239,68,68,0.3)] transition-all duration-300" />
            <span className="relative font-korean text-lg text-red-400 group-hover:text-white transition-colors duration-300">
              🚪 게임 나가기
            </span>
          </button>
        </div>
      </div>
    );
  }

  // 호스트 또는 싱글플레이어용 전체 UI
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
        <h1 className="font-game text-3xl sm:text-5xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-b from-gray-200 to-gray-400">
          일시정지
        </h1>

        <div style={{ height: '15px' }} />

        {/* 버튼들 */}
        <div className="flex flex-col gap-4 w-[80vw] sm:w-auto sm:min-w-[250px] max-w-[300px]">
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

          {/* 멀티플레이어에서는 다시 시작 버튼 숨김 (로비에서만 재시작 가능) */}
          {!(isRPG && isMultiplayer) && (
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
          )}

          {/* RPG 멀티플레이어 호스트 전용: 게임 중단 버튼 */}
          {isRPG && isMultiplayer && isHost && (
            <button
              onClick={handleStopGame}
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

          {/* RPG 싱글 모드 전용: 게임 중단 버튼 */}
          {isRPG && !isMultiplayer && (
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

          {/* 멀티플레이어에서는 로비 버튼 숨김 */}
          {!(isRPG && isMultiplayer) && (
            <button
              onClick={handleMainMenu}
              className="group relative px-8 py-3 rounded-lg overflow-hidden transition-all duration-200 hover:scale-105 active:scale-95"
              style={{ paddingTop: '5px', paddingBottom: '5px' }}
            >
              <div className="absolute inset-0 bg-dark-600/50" />
              <div className="absolute inset-0 border border-dark-400 rounded-lg group-hover:border-gray-500 transition-all duration-300" />
              <span className="relative font-korean text-lg text-gray-400 group-hover:text-white transition-colors duration-300">
                로비로 돌아가기
              </span>
            </button>
          )}
        </div>

        {/* 설정 패널 */}
        {showSettings && (
          <div className="mt-8 bg-dark-800/90 rounded-xl p-4 sm:p-6 border border-gray-600 w-[80vw] sm:w-auto sm:min-w-[300px] max-w-[350px]">
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
