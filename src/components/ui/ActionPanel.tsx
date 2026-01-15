import React from 'react';
import { useGameStore, useResources } from '../../stores/useGameStore';
import { useUIStore } from '../../stores/useUIStore';
import { CONFIG } from '../../constants/config';

export const ActionPanel: React.FC = () => {
  const buildWall = useGameStore((state) => state.buildWall);
  const upgradePlayerBase = useGameStore((state) => state.upgradePlayerBase);
  const showNotification = useUIStore((state) => state.showNotification);
  const resources = useResources();

  const canBuildWall = resources.wood >= CONFIG.WALL_COST.wood && resources.stone >= CONFIG.WALL_COST.stone;
  const canUpgrade = resources.gold >= CONFIG.BASE_UPGRADE_COST.gold && resources.stone >= CONFIG.BASE_UPGRADE_COST.stone;

  const handleBuildWall = () => {
    if (buildWall()) {
      showNotification('벽 건설 완료!');
    } else {
      showNotification('자원이 부족합니다!');
    }
  };

  const handleUpgradeBase = () => {
    if (upgradePlayerBase()) {
      showNotification('본진 강화! (+200 HP)');
    } else {
      showNotification('자원이 부족합니다!');
    }
  };

  return (
    <div className="flex flex-col gap-2 p-2 glass-light rounded-xl border border-dark-500/50">
      <div className="text-[10px] text-gray-500 uppercase tracking-wider px-1">Actions</div>

      {/* 벽 건설 */}
      <button
        onClick={handleBuildWall}
        disabled={!canBuildWall}
        className={`
          group relative px-4 py-2 rounded-lg text-left
          transition-all duration-200
          ${canBuildWall
            ? 'bg-dark-600/50 hover:bg-dark-500/50 cursor-pointer'
            : 'bg-dark-700/30 opacity-50 cursor-not-allowed'
          }
        `}
      >
        <div className={`
          absolute inset-0 border rounded-lg transition-all duration-200
          ${canBuildWall ? 'border-dark-400 group-hover:border-neon-purple' : 'border-dark-600'}
        `} />
        <div className="relative flex items-center gap-2">
          <span className="text-lg">🧱</span>
          <div className="flex flex-col">
            <span className="text-xs text-gray-300">벽 건설</span>
            <span className="text-[10px] text-gray-500">20🪵 10🪨</span>
          </div>
        </div>
      </button>

      {/* 본진 강화 */}
      <button
        onClick={handleUpgradeBase}
        disabled={!canUpgrade}
        className={`
          group relative px-4 py-2 rounded-lg text-left
          transition-all duration-200
          ${canUpgrade
            ? 'bg-dark-600/50 hover:bg-dark-500/50 cursor-pointer'
            : 'bg-dark-700/30 opacity-50 cursor-not-allowed'
          }
        `}
      >
        <div className={`
          absolute inset-0 border rounded-lg transition-all duration-200
          ${canUpgrade ? 'border-dark-400 group-hover:border-neon-green' : 'border-dark-600'}
        `} />
        <div className="relative flex items-center gap-2">
          <span className="text-lg">🏰</span>
          <div className="flex flex-col">
            <span className="text-xs text-gray-300">본진 강화</span>
            <span className="text-[10px] text-gray-500">100💰 50🪨</span>
          </div>
        </div>
      </button>
    </div>
  );
};
