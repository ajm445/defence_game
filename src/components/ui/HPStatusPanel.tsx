import React from 'react';
import { usePlayerBase, useEnemyBase, useGameStore } from '../../stores/useGameStore';
import { useMultiplayerStore } from '../../stores/useMultiplayerStore';

export const HPStatusPanel: React.FC = () => {
  const gameMode = useGameStore((state) => state.gameMode);
  const singlePlayerBase = usePlayerBase();
  const singleEnemyBase = useEnemyBase();
  const gameState = useMultiplayerStore((state) => state.gameState);
  const mySide = useMultiplayerStore((state) => state.mySide);

  // 멀티플레이어 모드에서는 서버 상태 사용
  let playerBase = singlePlayerBase;
  let enemyBase = singleEnemyBase;

  if (gameMode === 'multiplayer' && gameState && mySide) {
    const myPlayer = mySide === 'left' ? gameState.leftPlayer : gameState.rightPlayer;
    const enemyPlayer = mySide === 'left' ? gameState.rightPlayer : gameState.leftPlayer;
    playerBase = { x: 0, y: 0, hp: myPlayer.baseHp, maxHp: myPlayer.maxBaseHp };
    enemyBase = { x: 0, y: 0, hp: enemyPlayer.baseHp, maxHp: enemyPlayer.maxBaseHp };
  }

  const playerPercent = Math.max(0, (playerBase.hp / playerBase.maxHp) * 100);
  const enemyPercent = Math.max(0, (enemyBase.hp / enemyBase.maxHp) * 100);

  return (
    <div className="glass-dark rounded-xl border border-dark-500/50" style={{ padding: 'clamp(0.5rem, 1.5vw, 1rem)', minWidth: 'clamp(180px, 20vw, 240px)' }}>
      {/* 플레이어 */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-neon-cyan shadow-neon-cyan" />
            <span className="text-sm font-medium text-gray-300">내 본진</span>
          </div>
          <span className="text-xs text-gray-500 tabular-nums">
            {Math.floor(playerBase.hp)} / {playerBase.maxHp}
          </span>
        </div>
        <div className="hp-bar">
          <div
            className="hp-bar-fill player"
            style={{ width: `${playerPercent}%` }}
          />
        </div>
      </div>

      {/* 구분선 */}
      <div className="h-px bg-dark-500 my-3" />

      {/* 적 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-neon-red shadow-neon-red" />
            <span className="text-sm font-medium text-gray-300">적 본진</span>
          </div>
          <span className="text-xs text-gray-500 tabular-nums">
            {Math.floor(enemyBase.hp)} / {enemyBase.maxHp}
          </span>
        </div>
        <div className="hp-bar">
          <div
            className="hp-bar-fill enemy"
            style={{ width: `${enemyPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
};
