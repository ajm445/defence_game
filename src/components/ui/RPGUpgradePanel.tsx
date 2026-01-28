import React, { useEffect, useCallback, useMemo } from 'react';
import { useRPGStore, useGold, useUpgradeLevels, useHero } from '../../stores/useRPGStore';
import { getUpgradeCost, UpgradeType, getRangeMaxLevel } from '../../game/rpg/goldSystem';
import { UPGRADE_CONFIG } from '../../constants/rpgConfig';

// 업그레이드 타입별 정보
const UPGRADE_INFO: Record<UpgradeType, { key: string; icon: string; label: string; color: string }> = {
  attack: { key: '1', icon: '⚔️', label: '공격', color: 'from-red-500/30 to-orange-500/30' },
  speed: { key: '2', icon: '👟', label: '속도', color: 'from-blue-500/30 to-cyan-500/30' },
  hp: { key: '3', icon: '❤️', label: 'HP', color: 'from-green-500/30 to-emerald-500/30' },
  attackSpeed: { key: '4', icon: '⚡', label: '공속', color: 'from-purple-500/30 to-violet-500/30' },
  goldRate: { key: '5', icon: '💰', label: '골드', color: 'from-yellow-500/30 to-amber-500/30' },
  range: { key: '6', icon: '🎯', label: '사거리', color: 'from-pink-500/30 to-rose-500/30' },
};

interface UpgradeButtonProps {
  type: UpgradeType;
  currentLevel: number;
  maxLevel: number | null;  // null = 무제한
  gold: number;
  onUpgrade: () => void;
  isHidden?: boolean;
}

const UpgradeButton: React.FC<UpgradeButtonProps> = ({
  type,
  currentLevel,
  maxLevel,
  gold,
  onUpgrade,
  isHidden,
}) => {
  if (isHidden) return null;

  const info = UPGRADE_INFO[type];
  const cost = getUpgradeCost(currentLevel);
  const canAfford = gold >= cost;
  const isMaxed = maxLevel !== null && currentLevel >= maxLevel;
  const isDisabled = isMaxed || !canAfford;

  return (
    <div className="relative group">
      <button
        onClick={onUpgrade}
        disabled={isDisabled}
        className={`
          relative w-14 h-14 rounded-lg border-2 overflow-hidden
          transition-all duration-200
          ${isDisabled
            ? 'bg-dark-700/80 border-dark-500 cursor-not-allowed'
            : `bg-gradient-to-br ${info.color} border-neon-cyan/50 hover:border-neon-cyan hover:scale-105 cursor-pointer`
          }
        `}
      >
        {/* 아이콘 */}
        <div className="relative z-10 flex flex-col items-center justify-center h-full">
          <span className="text-2xl">{info.icon}</span>
          <span className="text-[10px] text-white/70 font-bold">{info.key}</span>
        </div>

        {/* 레벨 표시 */}
        {currentLevel > 0 && (
          <div className="absolute top-0 right-0 bg-neon-cyan/80 text-dark-900 text-[10px] font-bold px-1 rounded-bl">
            Lv{currentLevel}
          </div>
        )}

        {/* MAX 표시 */}
        {isMaxed && (
          <div className="absolute inset-0 flex items-center justify-center bg-dark-900/50 z-20">
            <span className="text-xs font-bold text-yellow-400">MAX</span>
          </div>
        )}
      </button>

      {/* 툴팁 */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
        <div className="bg-dark-800/95 border border-dark-500 rounded-lg px-3 py-2 whitespace-nowrap text-center min-w-[100px]">
          <div className="font-bold text-white">{info.label} 업그레이드</div>
          <div className="text-xs text-gray-400 mt-1">
            레벨: {currentLevel}{maxLevel !== null ? `/${maxLevel}` : ''}
          </div>
          {!isMaxed && (
            <div className={`text-xs mt-1 ${canAfford ? 'text-yellow-400' : 'text-red-400'}`}>
              비용: {cost} 골드
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const RPGUpgradePanel: React.FC = () => {
  const gold = useGold();
  const upgradeLevels = useUpgradeLevels();
  const hero = useHero();
  const upgradeHeroStat = useRPGStore((state) => state.upgradeHeroStat);

  const heroClass = hero?.heroClass;
  const isRangedClass = heroClass === 'archer' || heroClass === 'mage';

  // 사거리 업그레이드 최대 레벨
  const rangeMaxLevel = getRangeMaxLevel();

  // 표시할 업그레이드 목록 (사거리는 원거리 캐릭터만)
  const upgradeTypes = useMemo(() => {
    const baseTypes: UpgradeType[] = ['attack', 'speed', 'hp', 'attackSpeed', 'goldRate'];
    if (isRangedClass) {
      baseTypes.push('range');
    }
    return baseTypes;
  }, [isRangedClass]);

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

      // 사망한 영웅은 업그레이드 불가
      const hero = useRPGStore.getState().hero;
      if (!hero || hero.hp <= 0) return;

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
          handleUpgrade('attackSpeed');
          break;
        case '5':
          handleUpgrade('goldRate');
          break;
        case '6':
          if (isRangedClass) {
            handleUpgrade('range');
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUpgrade, isRangedClass]);

  // 업그레이드별 최대 레벨 결정 (사거리만 제한, 나머지는 무제한)
  const getMaxLevel = (type: UpgradeType): number | null => {
    if (type === 'range') {
      return rangeMaxLevel;
    }
    return null;  // 무제한
  };

  return (
    <>
      {upgradeTypes.map((type) => (
        <div key={type} className="flex flex-col items-center gap-1">
          <div className="text-[10px] text-gray-400 font-medium">
            {UPGRADE_INFO[type].label}
          </div>
          <UpgradeButton
            type={type}
            currentLevel={upgradeLevels[type]}
            maxLevel={getMaxLevel(type)}
            gold={gold}
            onUpgrade={() => handleUpgrade(type)}
          />
        </div>
      ))}
    </>
  );
};
