import React, { useEffect, useCallback } from 'react';
import { useRPGStore, useGold, useUpgradeLevels, useHero } from '../../stores/useRPGStore';
import { getUpgradeCost, UpgradeType } from '../../game/rpg/goldSystem';

// 업그레이드 타입별 정보
const UPGRADE_INFO: Record<UpgradeType, { key: string; icon: string; color: string }> = {
  attack: { key: '1', icon: '⚔️', color: 'text-red-400' },
  speed: { key: '2', icon: '👟', color: 'text-blue-400' },
  hp: { key: '3', icon: '❤️', color: 'text-green-400' },
  goldRate: { key: '4', icon: '💰', color: 'text-yellow-400' },
};

interface UpgradeButtonProps {
  type: UpgradeType;
  currentLevel: number;
  maxLevel: number;
  gold: number;
  onUpgrade: () => void;
}

const UpgradeButton: React.FC<UpgradeButtonProps> = ({
  type,
  currentLevel,
  maxLevel,
  gold,
  onUpgrade,
}) => {
  const info = UPGRADE_INFO[type];
  const cost = getUpgradeCost(currentLevel);
  const canAfford = gold >= cost;
  const isMaxed = currentLevel >= maxLevel;
  const isDisabled = isMaxed || !canAfford;

  return (
    <button
      onClick={onUpgrade}
      disabled={isDisabled}
      className={`
        flex items-center gap-1 px-2 py-1 rounded border transition-all duration-150 text-xs
        ${isDisabled
          ? 'bg-dark-700/50 border-dark-600 opacity-50 cursor-not-allowed'
          : 'bg-dark-700/80 border-dark-500 hover:border-neon-cyan hover:bg-dark-600/80 cursor-pointer'
        }
      `}
    >
      {/* 아이콘 + 키 */}
      <span className={`text-sm ${info.color}`}>{info.icon}</span>
      <span className="text-gray-500">[{info.key}]</span>

      {/* 레벨 */}
      <span className={currentLevel > 0 ? 'text-neon-cyan font-bold' : 'text-gray-400'}>
        {currentLevel}
      </span>
      <span className="text-gray-600">/</span>
      <span className="text-gray-400">{maxLevel}</span>

      {/* 비용 */}
      {!isMaxed ? (
        <span className={`ml-1 ${canAfford ? 'text-yellow-400' : 'text-red-400/70'}`}>
          💰{cost}
        </span>
      ) : (
        <span className="ml-1 text-yellow-400 font-bold">MAX</span>
      )}
    </button>
  );
};

export const RPGUpgradePanel: React.FC = () => {
  const gold = useGold();
  const upgradeLevels = useUpgradeLevels();
  const hero = useHero();
  const upgradeHeroStat = useRPGStore((state) => state.upgradeHeroStat);

  const characterLevel = hero?.characterLevel || 1;

  const handleUpgrade = useCallback((type: UpgradeType) => {
    upgradeHeroStat(type);
  }, [upgradeHeroStat]);

  // 키보드 단축키 처리
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 입력 필드에 포커스된 경우 무시
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case '1':
          handleUpgrade('attack');
          break;
        case '2':
          handleUpgrade('speed');
          break;
        case '3':
          handleUpgrade('hp');
          break;
        case '4':
          handleUpgrade('goldRate');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUpgrade]);

  return (
    <div className="bg-dark-800/90 backdrop-blur-sm rounded-lg p-2 border border-dark-600/50">
      {/* 업그레이드 타이틀 */}
      <div className="text-xs text-gray-500 mb-1 text-center">업그레이드 [1-4]</div>

      {/* 업그레이드 버튼들 - 2x2 그리드 */}
      <div className="grid grid-cols-2 gap-1">
        {(['attack', 'speed', 'hp', 'goldRate'] as UpgradeType[]).map((type) => (
          <UpgradeButton
            key={type}
            type={type}
            currentLevel={upgradeLevels[type]}
            maxLevel={characterLevel}
            gold={gold}
            onUpgrade={() => handleUpgrade(type)}
          />
        ))}
      </div>
    </div>
  );
};
