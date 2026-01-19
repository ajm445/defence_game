import React from 'react';
import { useGameStore, useResources } from '../../stores/useGameStore';
import { useMultiplayerStore } from '../../stores/useMultiplayerStore';
import { useUIStore } from '../../stores/useUIStore';
import { CONFIG } from '../../constants/config';
import { wsClient } from '../../services/WebSocketClient';
import { Emoji } from '../common/Emoji';

interface CostItem {
  amount: number | string;
  icon: string;
}

interface ActionButtonProps {
  icon: string;
  label: string;
  costItems: CostItem[];
  costLabel?: string; // 추가 텍스트 (예: "→", "최대 레벨")
  onClick: () => void;
  disabled: boolean;
  active?: boolean;
  hoverColor?: string;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  icon,
  label,
  costItems,
  costLabel,
  onClick,
  disabled,
  active = false,
  hoverColor = 'border-neon-cyan',
}) => (
  <button
    onClick={onClick}
    disabled={disabled && !active}
    className={`
      group relative p-2 rounded-lg
      transition-all duration-200
      ${active
        ? 'bg-neon-purple/20'
        : disabled
          ? 'bg-dark-700/30 opacity-50 cursor-not-allowed'
          : 'bg-dark-600/50 hover:bg-dark-500/50 cursor-pointer'
      }
    `}
  >
    <div className={`
      absolute inset-0 border rounded-lg transition-all duration-200
      ${active
        ? 'border-neon-purple animate-pulse'
        : disabled
          ? 'border-dark-600'
          : `border-dark-400 group-hover:${hoverColor}`
      }
    `} />
    <div className="relative flex flex-col items-center gap-0.5">
      <Emoji emoji={icon} size={20} />
      <span className="text-[9px] text-gray-400 whitespace-nowrap">{label}</span>
    </div>
    {/* 커스텀 호버 툴팁 */}
    <div className="
      absolute bottom-full left-1/2 -translate-x-1/2 mb-2
      px-2 py-1 rounded bg-dark-800/95 border border-dark-500
      opacity-0 group-hover:opacity-100 transition-opacity duration-200
      pointer-events-none z-50 whitespace-nowrap
    ">
      <div className="flex items-center gap-1 text-[10px] text-gray-300">
        {costLabel && <span>{costLabel}</span>}
        {costItems.map((item, idx) => (
          <span key={idx} className="flex items-center gap-0.5">
            {idx > 0 && !costLabel && <span className="mx-0.5"></span>}
            <span>{item.amount}</span>
            <Emoji emoji={item.icon} size={12} />
          </span>
        ))}
      </div>
    </div>
  </button>
);

export const ActionPanel: React.FC = () => {
  const gameMode = useGameStore((state) => state.gameMode);
  const upgradePlayerBase = useGameStore((state) => state.upgradePlayerBase);
  const getNextUpgradeCost = useGameStore((state) => state.getNextUpgradeCost);
  const playerGoldPerSecond = useGameStore((state) => state.playerGoldPerSecond);
  const playerBaseLevel = useGameStore((state) => state.playerBase.upgradeLevel);
  const sellHerb = useGameStore((state) => state.sellHerb);
  const showNotification = useUIStore((state) => state.showNotification);
  const setPlacementMode = useUIStore((state) => state.setPlacementMode);
  const placementMode = useUIStore((state) => state.placementMode);
  const singlePlayerResources = useResources();
  const gameState = useMultiplayerStore((state) => state.gameState);
  const mySide = useMultiplayerStore((state) => state.mySide);

  // 멀티플레이어 모드에서는 서버 상태의 자원 및 레벨 사용
  const myPlayerState = gameMode === 'multiplayer' && gameState && mySide
    ? (mySide === 'left' ? gameState.leftPlayer : gameState.rightPlayer)
    : null;
  const resources = myPlayerState ? myPlayerState.resources : singlePlayerResources;

  // 멀티플레이어 모드에서는 서버 상태의 레벨 사용
  const currentBaseLevel = myPlayerState ? myPlayerState.upgradeLevel : (playerBaseLevel ?? 0);

  const upgradeCost = getNextUpgradeCost();
  const isMaxLevel = currentBaseLevel >= CONFIG.BASE_UPGRADE.MAX_LEVEL;
  const canBuildWall = resources.wood >= CONFIG.WALL_COST.wood && resources.stone >= CONFIG.WALL_COST.stone;
  const canUpgrade = !isMaxLevel && resources.gold >= upgradeCost.gold && resources.stone >= upgradeCost.stone;
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
    if (gameMode === 'multiplayer') {
      // 멀티플레이어: 서버로 요청 전송
      wsClient.upgradeBase();
      showNotification('본진 강화 요청!');
    } else {
      // 싱글플레이어: 로컬에서 처리
      if (upgradePlayerBase()) {
        const newLevel = (playerBaseLevel ?? 0) + 1;
        const newGoldPerSec = CONFIG.GOLD_PER_SECOND + (newLevel * CONFIG.BASE_UPGRADE.GOLD_BONUS);
        showNotification(`본진 강화! (+${CONFIG.BASE_UPGRADE.HP_BONUS} HP, 골드 수입 ${newGoldPerSec}/초)`);
      } else {
        showNotification('자원이 부족합니다!');
      }
    }
  };

  const handleSellHerb = () => {
    if (gameMode === 'multiplayer') {
      // 멀티플레이어: 서버로 요청 전송
      wsClient.sellHerb();
      showNotification(`약초 판매 요청!`);
    } else {
      // 싱글플레이어: 로컬에서 처리
      if (sellHerb()) {
        showNotification(`약초 판매! (+${CONFIG.HERB_SELL_GOLD} 골드)`);
      } else {
        showNotification('약초가 부족합니다!');
      }
    }
  };

  return (
    <div className="flex flex-col gap-1 p-2 glass-light rounded-xl border border-dark-500/50">
      <div className="text-[10px] text-gray-500 uppercase tracking-wider px-1">Actions</div>

      <div className="grid grid-cols-3 gap-1">
        <ActionButton
          icon="🧱"
          label={placementMode === 'wall' ? '취소' : '벽'}
          costItems={[
            { amount: 20, icon: '🪵' },
            { amount: 10, icon: '🪨' },
          ]}
          onClick={handleBuildWall}
          disabled={!canBuildWall}
          active={placementMode === 'wall'}
          hoverColor="border-neon-purple"
        />
        <ActionButton
          icon="🏰"
          label={isMaxLevel ? '강화 MAX' : `강화 Lv${currentBaseLevel + 1}`}
          costItems={isMaxLevel ? [] : [
            { amount: upgradeCost.gold, icon: '💰' },
            { amount: upgradeCost.stone, icon: '🪨' },
          ]}
          costLabel={isMaxLevel ? '최대 레벨' : undefined}
          onClick={handleUpgradeBase}
          disabled={!canUpgrade}
          hoverColor="border-neon-green"
        />
        <ActionButton
          icon="🌿"
          label="판매"
          costItems={[
            { amount: 10, icon: '🌿' },
            { amount: '→ 30', icon: '💰' },
          ]}
          onClick={handleSellHerb}
          disabled={!canSellHerb}
          hoverColor="border-yellow-500"
        />
      </div>
    </div>
  );
};
