import React from 'react';
import { usePlayerBase, useEnemyBase } from '../../stores/useGameStore';

export const HPStatusPanel: React.FC = () => {
  const playerBase = usePlayerBase();
  const enemyBase = useEnemyBase();

  const playerPercent = Math.max(0, (playerBase.hp / playerBase.maxHp) * 100);
  const enemyPercent = Math.max(0, (enemyBase.hp / enemyBase.maxHp) * 100);

  return (
    <div className="absolute top-4 right-4 glass-dark rounded-xl p-4 border border-dark-500/50 min-w-[240px]">
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
