import React from 'react';
import { useGameStore, useResources } from '../../stores/useGameStore';
import { useMultiplayerStore } from '../../stores/useMultiplayerStore';
import { useUIStore } from '../../stores/useUIStore';
import { useTutorialStore } from '../../stores/useTutorialStore';
import { CONFIG } from '../../constants/config';
import { wsClient } from '../../services/WebSocketClient';
import { Emoji } from '../common/Emoji';
import { soundManager } from '../../services/SoundManager';

interface CostItem {
  amount: number;
  icon: string;
  hasEnough: boolean;
}

interface ActionButtonProps {
  icon: string;
  label: string;
  shortcut: string;
  costs: CostItem[];
  onClick: () => void;
  disabled: boolean;
  active?: boolean;
  tutorialId?: string;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  icon,
  label,
  shortcut,
  costs,
  onClick,
  disabled,
  active = false,
  tutorialId,
}) => (
  <button
    onClick={onClick}
    disabled={disabled && !active}
    data-tutorial-id={tutorialId}
    className={`
      group relative p-2 rounded-lg flex flex-col items-center gap-1
      transition-all duration-200 min-w-[60px]
      ${active
        ? 'bg-neon-purple/20 ring-1 ring-neon-purple'
        : disabled
          ? 'bg-dark-700/30 opacity-60 cursor-not-allowed'
          : 'bg-dark-600/50 hover:bg-dark-500/50 cursor-pointer'
      }
    `}
  >
    {/* 단축키 배지 */}
    <div className={`
      absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center
      rounded text-[9px] font-bold z-10
      ${disabled ? 'bg-dark-600 text-gray-600' : 'bg-dark-400 text-gray-200'}
    `}>
      {shortcut}
    </div>

    {/* 아이콘 */}
    <div className={`
      p-1 rounded
      ${active ? 'bg-neon-purple/30' : 'bg-dark-500/50'}
    `}>
      <Emoji emoji={icon} size={18} />
    </div>

    {/* 이름 */}
    <div className="text-[10px] font-medium text-gray-300 text-center leading-tight">
      {label}
    </div>

    {/* 비용 (이모지로 표시) */}
    <div className="flex items-center gap-1">
      {costs.map((cost, idx) => (
        <span
          key={idx}
          className={`flex items-center text-[9px] ${cost.hasEnough ? 'text-gray-400' : 'text-red-400'}`}
        >
          <Emoji emoji={cost.icon} size={12} />
          <span>{cost.amount}</span>
        </span>
      ))}
    </div>
  </button>
);

export const ActionPanel: React.FC = () => {
  const gameMode = useGameStore((state) => state.gameMode);
  const upgradePlayerBase = useGameStore((state) => state.upgradePlayerBase);
  const getNextUpgradeCost = useGameStore((state) => state.getNextUpgradeCost);
  const playerBaseLevel = useGameStore((state) => state.playerBase.upgradeLevel);
  const sellHerb = useGameStore((state) => state.sellHerb);
  const showNotification = useUIStore((state) => state.showNotification);
  const setPlacementMode = useUIStore((state) => state.setPlacementMode);
  const placementMode = useUIStore((state) => state.placementMode);
  const singlePlayerResources = useResources();
  const gameState = useMultiplayerStore((state) => state.gameState);
  const mySide = useMultiplayerStore((state) => state.mySide);
  const setHerbSold = useTutorialStore((state) => state.setHerbSold);

  const myPlayerState = gameMode === 'multiplayer' && gameState && mySide
    ? (mySide === 'left' ? gameState.leftPlayer : gameState.rightPlayer)
    : null;
  const resources = myPlayerState ? myPlayerState.resources : singlePlayerResources;
  const currentBaseLevel = myPlayerState ? myPlayerState.upgradeLevel : (playerBaseLevel ?? 0);

  const upgradeCost = getNextUpgradeCost();
  const isMaxLevel = currentBaseLevel >= CONFIG.BASE_UPGRADE.MAX_LEVEL;
  const canBuildWall = resources.wood >= CONFIG.WALL_COST.wood && resources.stone >= CONFIG.WALL_COST.stone;
  const canUpgrade = !isMaxLevel &&
    resources.gold >= upgradeCost.gold &&
    (!upgradeCost.wood || resources.wood >= upgradeCost.wood) &&
    (!upgradeCost.stone || resources.stone >= upgradeCost.stone);
  const canSellHerb = resources.herb >= CONFIG.HERB_SELL_COST;

  const handleBuildWall = () => {
    soundManager.play('ui_click');
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
    soundManager.play('ui_click');
    if (gameMode === 'multiplayer') {
      wsClient.upgradeBase();
      soundManager.play('upgrade');
      showNotification('본진 강화 요청!');
    } else {
      if (upgradePlayerBase()) {
        soundManager.play('upgrade');
        const newLevel = (playerBaseLevel ?? 0) + 1;
        const newGoldPerSec = CONFIG.GOLD_PER_SECOND + (newLevel * CONFIG.BASE_UPGRADE.GOLD_BONUS);
        showNotification(`본진 강화! (+${CONFIG.BASE_UPGRADE.HP_BONUS} HP, 골드 수입 ${newGoldPerSec}/초)`);
      } else {
        showNotification('자원이 부족합니다!');
      }
    }
  };

  const handleSellHerb = () => {
    soundManager.play('ui_click');
    if (gameMode === 'multiplayer') {
      wsClient.sellHerb();
      soundManager.play('resource_collect');
      showNotification(`약초 판매 요청!`);
    } else {
      if (sellHerb()) {
        soundManager.play('resource_collect');
        showNotification(`약초 판매! (+${CONFIG.HERB_SELL_GOLD} 골드)`);
        // 튜토리얼 진행을 위한 약초 판매 기록
        if (gameMode === 'tutorial') {
          setHerbSold(true);
        }
      } else {
        showNotification('약초가 부족합니다!');
      }
    }
  };

  // 업그레이드 비용 생성
  const getUpgradeCosts = (): CostItem[] => {
    if (isMaxLevel) return [];
    const costs: CostItem[] = [
      { amount: upgradeCost.gold, icon: '💰', hasEnough: resources.gold >= upgradeCost.gold },
    ];
    if (upgradeCost.wood) {
      costs.push({ amount: upgradeCost.wood, icon: '🪵', hasEnough: resources.wood >= upgradeCost.wood });
    }
    if (upgradeCost.stone) {
      costs.push({ amount: upgradeCost.stone, icon: '🪨', hasEnough: resources.stone >= upgradeCost.stone });
    }
    return costs;
  };

  return (
    <div className="flex flex-col gap-1 mr-4">
      <div className="text-[10px] text-gray-500 tracking-wider px-1">액션</div>

      <div className="flex gap-2">
        <ActionButton
          icon="🧱"
          label={placementMode === 'wall' ? '취소' : '벽'}
          shortcut="Q"
          costs={[
            { amount: CONFIG.WALL_COST.wood, icon: '🪵', hasEnough: resources.wood >= CONFIG.WALL_COST.wood },
            { amount: CONFIG.WALL_COST.stone, icon: '🪨', hasEnough: resources.stone >= CONFIG.WALL_COST.stone },
          ]}
          onClick={handleBuildWall}
          disabled={!canBuildWall}
          active={placementMode === 'wall'}
          tutorialId="action-wall"
        />

        <ActionButton
          icon="🏰"
          label={isMaxLevel ? 'MAX' : `Lv${currentBaseLevel + 1}`}
          shortcut="W"
          costs={isMaxLevel ? [] : getUpgradeCosts()}
          onClick={handleUpgradeBase}
          disabled={!canUpgrade}
          tutorialId="action-upgrade"
        />

        <ActionButton
          icon="🌿"
          label="판매"
          shortcut="E"
          costs={[
            { amount: CONFIG.HERB_SELL_COST, icon: '🌿', hasEnough: resources.herb >= CONFIG.HERB_SELL_COST },
          ]}
          onClick={handleSellHerb}
          disabled={!canSellHerb}
          tutorialId="action-sell-herb"
        />
      </div>
    </div>
  );
};
