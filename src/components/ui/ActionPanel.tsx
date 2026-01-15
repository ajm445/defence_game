import React from 'react';
import { useGameStore, useResources } from '../../stores/useGameStore';
import { useUIStore } from '../../stores/useUIStore';
import { CONFIG } from '../../constants/config';

export const ActionPanel: React.FC = () => {
  const upgradePlayerBase = useGameStore((state) => state.upgradePlayerBase);
  const sellHerb = useGameStore((state) => state.sellHerb);
  const showNotification = useUIStore((state) => state.showNotification);
  const setPlacementMode = useUIStore((state) => state.setPlacementMode);
  const placementMode = useUIStore((state) => state.placementMode);
  const resources = useResources();

  const canBuildWall = resources.wood >= CONFIG.WALL_COST.wood && resources.stone >= CONFIG.WALL_COST.stone;
  const canUpgrade = resources.gold >= CONFIG.BASE_UPGRADE_COST.gold && resources.stone >= CONFIG.BASE_UPGRADE_COST.stone;
  const canSellHerb = resources.herb >= CONFIG.HERB_SELL_COST;

  const handleBuildWall = () => {
    if (placementMode === 'wall') {
      setPlacementMode('none');
      showNotification('벽 배치 취소');
    } else if (canBuildWall) {
      setPlacementMode('wall');
      showNotification('벽을 배치할 위치를 클릭하세요!');
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

  const handleSellHerb = () => {
    if (sellHerb()) {
      showNotification(`약초 판매! (+${CONFIG.HERB_SELL_GOLD} 골드)`);
    } else {
      showNotification('약초가 부족합니다!');
    }
  };

  return (
    <div className="flex flex-col gap-2 p-2 glass-light rounded-xl border border-dark-500/50">
      <div className="text-[10px] text-gray-500 uppercase tracking-wider px-1">Actions</div>

      {/* 벽 건설 */}
      <button
        onClick={handleBuildWall}
        disabled={!canBuildWall && placementMode !== 'wall'}
        className={`
          group relative px-4 py-2 rounded-lg text-left
          transition-all duration-200
          ${placementMode === 'wall'
            ? 'bg-neon-purple/20 cursor-pointer'
            : canBuildWall
              ? 'bg-dark-600/50 hover:bg-dark-500/50 cursor-pointer'
              : 'bg-dark-700/30 opacity-50 cursor-not-allowed'
          }
        `}
      >
        <div className={`
          absolute inset-0 border rounded-lg transition-all duration-200
          ${placementMode === 'wall'
            ? 'border-neon-purple animate-pulse'
            : canBuildWall
              ? 'border-dark-400 group-hover:border-neon-purple'
              : 'border-dark-600'
          }
        `} />
        <div className="relative flex items-center gap-2">
          <span className="text-lg">🧱</span>
          <div className="flex flex-col">
            <span className="text-xs text-gray-300">
              {placementMode === 'wall' ? '배치 중... (클릭하여 취소)' : '벽 건설'}
            </span>
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

      {/* 약초 판매 */}
      <button
        onClick={handleSellHerb}
        disabled={!canSellHerb}
        className={`
          group relative px-4 py-2 rounded-lg text-left
          transition-all duration-200
          ${canSellHerb
            ? 'bg-dark-600/50 hover:bg-dark-500/50 cursor-pointer'
            : 'bg-dark-700/30 opacity-50 cursor-not-allowed'
          }
        `}
      >
        <div className={`
          absolute inset-0 border rounded-lg transition-all duration-200
          ${canSellHerb ? 'border-dark-400 group-hover:border-yellow-500' : 'border-dark-600'}
        `} />
        <div className="relative flex items-center gap-2">
          <span className="text-lg">🌿</span>
          <div className="flex flex-col">
            <span className="text-xs text-gray-300">약초 판매</span>
            <span className="text-[10px] text-gray-500">10🌿 → 30💰</span>
          </div>
        </div>
      </button>
    </div>
  );
};
