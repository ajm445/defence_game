import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { useMultiplayerStore } from '../../stores/useMultiplayerStore';
import { useUIStore } from '../../stores/useUIStore';
import { useTutorialStore } from '../../stores/useTutorialStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useProfileStore } from '../../stores/useProfileStore';
import { soundManager } from '../../services/SoundManager';
import { CONFIG } from '../../constants/config';

export const GameOverScreen: React.FC = () => {
  const gameMode = useGameStore((state) => state.gameMode);
  const playerBase = useGameStore((state) => state.playerBase);
  const enemyBase = useGameStore((state) => state.enemyBase);
  const time = useGameStore((state) => state.time);
  const initGame = useGameStore((state) => state.initGame);
  const startGame = useGameStore((state) => state.startGame);
  const setScreen = useUIStore((state) => state.setScreen);
  const selectedDifficulty = useUIStore((state) => state.selectedDifficulty);
  const multiplayerResult = useMultiplayerStore((state) => state.gameResult);
  const resetMultiplayer = useMultiplayerStore((state) => state.reset);
  const endTutorial = useTutorialStore((state) => state.endTutorial);

  const isTutorial = gameMode === 'tutorial';

  // 경험치 저장 상태
  const expSavedRef = useRef(false);
  const [expResult, setExpResult] = useState<{
    playerExpGained: number;
    playerLeveledUp: boolean;
    newPlayerLevel?: number;
  } | null>(null);

  // 승리 조건 확인
  let victory = false;
  let isDraw = false;
  let resultMessage = '';

  if (gameMode === 'multiplayer' && multiplayerResult) {
    // 멀티플레이어 결과
    victory = multiplayerResult.result === 'win';
    isDraw = multiplayerResult.result === 'draw';
    // 간단한 메시지만 표시
    if (multiplayerResult.reason.includes('연결 끊김')) {
      resultMessage = '상대방 연결 끊김';
    } else if (multiplayerResult.reason.includes('시간 종료')) {
      resultMessage = '시간 종료';
    } else {
      resultMessage = ''; // 기지 파괴 메시지는 표시하지 않음
    }
  } else if (isTutorial) {
    // 튜토리얼 결과
    if (enemyBase.hp <= 0) {
      victory = true;
      resultMessage = '튜토리얼 완료! 이제 실전 게임에 도전해보세요!';
    } else if (playerBase.hp <= 0) {
      victory = false;
      resultMessage = '다시 도전해보세요!';
    } else if (time <= 0) {
      victory = playerBase.hp > enemyBase.hp;
      resultMessage = '튜토리얼 완료!';
    }
  } else {
    // 싱글플레이어 결과
    if (enemyBase.hp <= 0) {
      victory = true;
      resultMessage = '적 본진을 파괴했습니다!';
    } else if (playerBase.hp <= 0) {
      victory = false;
      resultMessage = '본진이 파괴되었습니다...';
    } else if (time <= 0) {
      victory = playerBase.hp > enemyBase.hp;
      resultMessage = victory ? '시간 종료 - HP 우위!' : '시간 종료 - HP 열세...';
    }
  }

  const handleBackToMenu = () => {
    soundManager.play('ui_click');
    if (gameMode === 'multiplayer') {
      resetMultiplayer();
    }
    if (isTutorial) {
      endTutorial();
    }
    setScreen('menu');
  };

  const handleRestartGame = () => {
    soundManager.play('ui_click');
    if (gameMode === 'multiplayer') {
      // 멀티플레이어에서는 로비로 돌아가기
      resetMultiplayer();
      setScreen('lobby');
    } else if (isTutorial) {
      // 튜토리얼에서는 모드 선택으로
      endTutorial();
      setScreen('modeSelect');
    } else {
      // 싱글플레이어에서는 동일한 난이도로 재시작
      initGame('ai', selectedDifficulty);
      startGame();
      setScreen('game');
    }
  };

  // RTS 게임 경험치 저장 (AI 대전에서만)
  useEffect(() => {
    const profile = useAuthStore.getState().profile;

    // AI 모드에서만 경험치 저장 (멀티플레이어, 튜토리얼 제외)
    // 게스트가 아니고 아직 저장하지 않은 경우에만
    if (gameMode === 'ai' && profile && !profile.isGuest && !expSavedRef.current) {
      expSavedRef.current = true;

      // 플레이 시간 계산 (CONFIG.GAME_TIME - 남은 시간)
      const playTime = CONFIG.GAME_TIME - time;

      useProfileStore.getState().handleRTSGameEnd({
        victory,
        playTime,
        mode: 'ai',
        difficulty: selectedDifficulty,
      }).then((result) => {
        if (result) {
          setExpResult(result);
          if (result.playerLeveledUp) {
            soundManager.play('level_up');
          }
        }
      });
    }
  }, [gameMode, victory, time]);

  return (
    <div className="fixed inset-0 bg-dark-900/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center animate-fade-in">
      {/* 배경 효과 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl ${victory ? 'bg-neon-cyan/10' : 'bg-neon-red/10'}`} style={{ width: 'min(37.5rem, 80vw)', height: 'min(37.5rem, 80vw)' }} />
      </div>

      {/* 결과 */}
      <div className="relative z-10 flex flex-col items-center" style={{ padding: '0 clamp(1rem, 4vw, 2rem)' }}>
        {/* 아이콘 */}
        <div className={`${victory ? 'animate-float' : ''}`} style={{ fontSize: 'clamp(3rem, 10vw, 8rem)', marginBottom: 'clamp(0.75rem, 2vh, 1.5rem)' }}>
          {isDraw ? '🤝' : victory ? '🏆' : '💀'}
        </div>

        <div style={{ height: 'clamp(1rem, 3vh, 1.875rem)' }} />

        {/* 메인 텍스트 */}
        <h1
          className={`
            font-game font-bold
            ${isDraw
              ? 'text-transparent bg-clip-text bg-gradient-to-b from-yellow-400 to-orange-500'
              : victory
                ? 'text-transparent bg-clip-text bg-gradient-to-b from-neon-cyan to-neon-blue text-glow-cyan'
                : 'text-transparent bg-clip-text bg-gradient-to-b from-neon-red to-orange-500 text-glow-red'
            }
          `}
          style={{ fontSize: 'clamp(2rem, 8vw, 4.5rem)', marginBottom: 'clamp(0.5rem, 1.5vh, 1rem)' }}
        >
          {isDraw ? 'DRAW' : victory ? 'VICTORY' : 'DEFEAT'}
        </h1>

        <div style={{ height: 'clamp(1rem, 3vh, 1.875rem)' }} />

        {(resultMessage || gameMode !== 'multiplayer') && (
          <p className="text-gray-400 text-center" style={{ fontSize: 'clamp(0.875rem, 2.5vw, 1.125rem)', marginBottom: 'clamp(1rem, 3vh, 2rem)' }}>
            {resultMessage || (victory ? '적 본진을 파괴했습니다!' : '본진이 파괴되었습니다...')}
          </p>
        )}

        {/* 경험치 획득 표시 */}
        {expResult && expResult.playerExpGained > 0 && (
          <div className="flex flex-col items-center mb-6" style={{ gap: 'clamp(0.25rem, 1vh, 0.5rem)', marginBottom: 'clamp(0.75rem, 2vh, 1.5rem)' }}>
            <div className="flex items-center text-yellow-400" style={{ gap: 'clamp(0.25rem, 1vw, 0.5rem)' }}>
              <span style={{ fontSize: 'clamp(1.25rem, 3vw, 1.5rem)' }}>⭐</span>
              <span className="font-bold" style={{ fontSize: 'clamp(1rem, 2.5vw, 1.25rem)' }}>+{expResult.playerExpGained} EXP</span>
            </div>
            {expResult.playerLeveledUp && expResult.newPlayerLevel && (
              <div className="text-neon-cyan font-bold animate-pulse" style={{ fontSize: 'clamp(0.875rem, 2.2vw, 1.125rem)' }}>
                레벨 업! Lv.{expResult.newPlayerLevel}
              </div>
            )}
          </div>
        )}

        <div style={{ height: 'clamp(1rem, 3vh, 1.875rem)' }} />

        {/* 버튼 */}
        <div className="flex" style={{ gap: 'clamp(0.5rem, 2vw, 1rem)' }}>
          <button
            onClick={handleRestartGame}
            className="group relative rounded-lg overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
            style={{ padding: 'clamp(0.4rem, 1.2vh, 0.75rem) clamp(1rem, 3vw, 2rem)' }}
          >
            <div className={`absolute inset-0 ${victory || isDraw ? 'bg-neon-cyan/20' : 'bg-neon-red/20'}`} />
            <div className={`absolute inset-0 border rounded-lg ${victory || isDraw ? 'border-neon-cyan/50 group-hover:border-neon-cyan group-hover:shadow-neon-cyan' : 'border-neon-red/50 group-hover:border-neon-red group-hover:shadow-neon-red'} transition-all duration-300`} />
            <span className={`relative font-game tracking-wider ${victory || isDraw ? 'text-neon-cyan' : 'text-neon-red'}`} style={{ fontSize: 'clamp(0.75rem, 2.2vw, 1.125rem)' }}>
              {gameMode === 'multiplayer' ? '로비로' : isTutorial ? '실전 게임' : '다시 시작'}
            </span>
          </button>

          <button
            onClick={handleBackToMenu}
            className="group relative rounded-lg overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
            style={{ padding: 'clamp(0.4rem, 1.2vh, 0.75rem) clamp(1rem, 3vw, 2rem)' }}
          >
            <div className="absolute inset-0 bg-dark-600/50" />
            <div className="absolute inset-0 border border-dark-400 rounded-lg group-hover:border-gray-500 transition-all duration-300" />
            <span className="relative font-korean text-gray-400 group-hover:text-white transition-colors duration-300" style={{ fontSize: 'clamp(0.75rem, 2.2vw, 1.125rem)' }}>
              메인 메뉴
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
