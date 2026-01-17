import React from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { useMultiplayerStore } from '../../stores/useMultiplayerStore';
import { useUIStore } from '../../stores/useUIStore';

export const GameOverScreen: React.FC = () => {
  const gameMode = useGameStore((state) => state.gameMode);
  const playerBase = useGameStore((state) => state.playerBase);
  const enemyBase = useGameStore((state) => state.enemyBase);
  const time = useGameStore((state) => state.time);
  const initGame = useGameStore((state) => state.initGame);
  const startGame = useGameStore((state) => state.startGame);
  const setScreen = useUIStore((state) => state.setScreen);
  const multiplayerResult = useMultiplayerStore((state) => state.gameResult);
  const resetMultiplayer = useMultiplayerStore((state) => state.reset);

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
    if (gameMode === 'multiplayer') {
      resetMultiplayer();
    }
    setScreen('menu');
  };

  const handleRestartGame = () => {
    if (gameMode === 'multiplayer') {
      // 멀티플레이어에서는 로비로 돌아가기
      resetMultiplayer();
      setScreen('lobby');
    } else {
      // 싱글플레이어에서는 바로 재시작
      initGame();
      startGame();
      setScreen('game');
    }
  };

  return (
    <div className="fixed inset-0 bg-dark-900/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center animate-fade-in">
      {/* 배경 효과 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-3xl ${victory ? 'bg-neon-cyan/10' : 'bg-neon-red/10'}`} />
      </div>

      {/* 결과 */}
      <div className="relative z-10 flex flex-col items-center">
        {/* 아이콘 */}
        <div className={`text-8xl mb-6 ${victory ? 'animate-float' : ''}`}>
          {isDraw ? '🤝' : victory ? '🏆' : '💀'}
        </div>

        <div style={{ height: '30px' }} />

        {/* 메인 텍스트 */}
        <h1 className={`
          font-game text-6xl md:text-7xl font-bold mb-4
          ${isDraw
            ? 'text-transparent bg-clip-text bg-gradient-to-b from-yellow-400 to-orange-500'
            : victory
              ? 'text-transparent bg-clip-text bg-gradient-to-b from-neon-cyan to-neon-blue text-glow-cyan'
              : 'text-transparent bg-clip-text bg-gradient-to-b from-neon-red to-orange-500 text-glow-red'
          }
        `}>
          {isDraw ? 'DRAW' : victory ? 'VICTORY' : 'DEFEAT'}
        </h1>

        {(resultMessage || gameMode !== 'multiplayer') && (
          <p className="text-gray-400 text-lg mb-8">
            {resultMessage || (victory ? '적 본진을 파괴했습니다!' : '본진이 파괴되었습니다...')}
          </p>
        )}
        
        {/* 통계 - AI 대전에서만 표시 */}
        {gameMode !== 'multiplayer' && (
          <>
            <div style={{ height: '30px' }} />
            <div className="glass-dark rounded-xl p-6 mb-8 min-w-[300px] border border-dark-500/50">
              <div className="flex justify-between mb-3">
                <span className="text-gray-400">내 본진 HP</span>
                <span className="text-white font-bold tabular-nums">{Math.floor(playerBase.hp)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">적 본진 HP</span>
                <span className="text-white font-bold tabular-nums">{Math.floor(enemyBase.hp)}</span>
              </div>
            </div>
          </>
        )}

        <div style={{ height: '30px' }} />
        
        {/* 버튼 */}
        <div className="flex gap-4">
          <button
            onClick={handleRestartGame}
            className={`
              group relative px-8 py-3 rounded-lg overflow-hidden
              transition-all duration-300 hover:scale-105 active:scale-95
            `}
          >
            <div className={`absolute inset-0 ${victory || isDraw ? 'bg-neon-cyan/20' : 'bg-neon-red/20'}`} />
            <div className={`absolute inset-0 border rounded-lg ${victory || isDraw ? 'border-neon-cyan/50 group-hover:border-neon-cyan group-hover:shadow-neon-cyan' : 'border-neon-red/50 group-hover:border-neon-red group-hover:shadow-neon-red'} transition-all duration-300`} />
            <span className={`relative font-game text-lg tracking-wider ${victory || isDraw ? 'text-neon-cyan' : 'text-neon-red'}`}>
              {gameMode === 'multiplayer' ? '로비로' : '다시 시작'}
            </span>
          </button>

          <button
            onClick={handleBackToMenu}
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
