import React, { useCallback, useMemo } from 'react';
import { useRPGStore, useGold, useUpgradeLevels, useHero } from '../../stores/useRPGStore';
import { useUIStore } from '../../stores/useUIStore';
import { getUpgradeCost, UpgradeType, getRangeMaxLevel } from '../../game/rpg/goldSystem';
import { soundManager } from '../../services/SoundManager';

const UPGRADE_INFO: Record<UpgradeType, { icon: string; label: string }> = {
  attack: { icon: '⚔️', label: '공격' },
  speed: { icon: '👟', label: '속도' },
  hp: { icon: '❤️', label: 'HP' },
  attackSpeed: { icon: '⚡', label: '공속' },
  goldRate: { icon: '💰', label: '골드' },
  range: { icon: '🎯', label: '거리' },
};

interface TouchUpgradeButtonProps {
  type: UpgradeType;
  currentLevel: number;
  maxLevel: number | null;
  gold: number;
  onUpgrade: () => void;
  size: number;
}

const TouchUpgradeButton: React.FC<TouchUpgradeButtonProps> = ({
  type, currentLevel, maxLevel, gold, onUpgrade, size,
}) => {
  const info = UPGRADE_INFO[type];
  const cost = getUpgradeCost(currentLevel);
  const canAfford = gold >= cost;
  const isMaxed = maxLevel !== null && currentLevel >= maxLevel;
  const isDisabled = isMaxed || !canAfford;

  return (
    <button
      onClick={onUpgrade}
      disabled={isDisabled}
      className={`
        relative rounded-lg border flex flex-col items-center justify-center
        ${isDisabled
          ? 'bg-dark-900/90 border-dark-600/40'
          : 'bg-gradient-to-br from-cyan-900/30 to-dark-700/60 border-neon-cyan/50 shadow-[0_0_6px_rgba(0,245,255,0.15)] active:scale-95'
        }
      `}
      style={{ width: size, height: size }}
    >
      <span className={`text-lg ${isDisabled ? 'opacity-40' : ''}`}>{info.icon}</span>
      <span className={`text-[8px] font-bold ${isDisabled ? 'text-white/30' : 'text-white/60'}`}>{info.label}</span>

      {/* Level badge */}
      {currentLevel > 0 && (
        <div className="absolute -top-1.5 -left-1.5 bg-neon-cyan text-dark-900 text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full shadow-sm">
          {currentLevel}
        </div>
      )}

      {/* Cost */}
      {!isMaxed && (
        <div className={`absolute bottom-0 left-0 right-0 text-[7px] font-bold text-center py-0.5 ${canAfford ? 'text-yellow-400 bg-dark-900/60' : 'text-red-400/60 bg-dark-900/40'}`}>
          {cost}G
        </div>
      )}

      {/* MAX overlay */}
      {isMaxed && (
        <div className="absolute inset-0 flex items-center justify-center bg-dark-900/50">
          <span className="text-[9px] font-bold text-yellow-400">MAX</span>
        </div>
      )}
    </button>
  );
};

export const TouchUpgradeToggle: React.FC = () => {
  const hero = useHero();
  const gold = useGold();
  const upgradeLevels = useUpgradeLevels();
  const upgradeHeroStat = useRPGStore((state) => state.upgradeHeroStat);

  const heroClass = hero?.heroClass;
  const isRangedClass = heroClass === 'archer' || heroClass === 'mage';
  const rangeMaxLevel = getRangeMaxLevel();

  const isAttackSpeedCapped = hero?.config.attackSpeed !== undefined && hero.config.attackSpeed <= 0.3;

  const upgradeTypes = useMemo(() => {
    const baseTypes: UpgradeType[] = ['attack', 'speed', 'hp', 'attackSpeed', 'goldRate'];
    if (isRangedClass) {
      baseTypes.push('range');
    }
    return baseTypes;
  }, [isRangedClass]);

  const getMaxLevel = (type: UpgradeType): number | null => {
    if (type === 'range') return rangeMaxLevel;
    if (type === 'attackSpeed' && isAttackSpeedCapped) return upgradeLevels.attackSpeed;
    return null;
  };

  const handleUpgrade = useCallback((type: UpgradeType) => {
    upgradeHeroStat(type);
    soundManager.play('ui_click');
  }, [upgradeHeroStat]);

  const isTablet = useUIStore((s) => s.isTablet);

  if (!hero || hero.hp <= 0) return null;

  const btnSize = isTablet ? 52 : 62;
  const gridGap = isTablet ? 6 : 10;

  return (
    <div
      className="grid grid-cols-3 bg-dark-800/90 backdrop-blur-sm rounded-xl p-2 border border-dark-600/50"
      style={{ gap: gridGap }}
    >
      {upgradeTypes.map((type) => (
        <TouchUpgradeButton
          key={type}
          type={type}
          currentLevel={upgradeLevels[type]}
          maxLevel={getMaxLevel(type)}
          gold={gold}
          onUpgrade={() => handleUpgrade(type)}
          size={btnSize}
        />
      ))}
    </div>
  );
};
