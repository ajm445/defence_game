import React, { useCallback, useState } from 'react';
import { HeroClass } from '../../types/rpg';
import {
  ClassProgress,
  StatUpgradeType,
  STAT_UPGRADE_CONFIG,
  getUpgradeableStats,
  getStatBonus,
  getTotalSpentSP,
} from '../../types/auth';
import { CLASS_CONFIGS, PASSIVE_UNLOCK_LEVEL, PASSIVE_GROWTH_CONFIGS } from '../../constants/rpgConfig';
import { useProfileStore } from '../../stores/useProfileStore';
import { soundManager } from '../../services/SoundManager';
import {
  getPassiveFromCharacterLevel,
  formatPassiveValue,
  getPassiveDescription,
} from '../../game/rpg/passiveSystem';

interface CharacterUpgradeModalProps {
  heroClass: HeroClass;
  progress: ClassProgress;
  isUnlocked: boolean;
  onClose: () => void;
}

export const CharacterUpgradeModal: React.FC<CharacterUpgradeModalProps> = ({
  heroClass,
  progress,
  isUnlocked,
  onClose,
}) => {
  const config = CLASS_CONFIGS[heroClass];
  const upgradeCharacterStatAction = useProfileStore((state) => state.upgradeCharacterStatAction);
  const canUpgradeStat = useProfileStore((state) => state.canUpgradeStat);
  const resetCharacterStatsAction = useProfileStore((state) => state.resetCharacterStatsAction);

  const upgradeableStats = getUpgradeableStats(heroClass);

  // statUpgrades가 없을 경우 기본값 사용
  const safeStatUpgrades = progress.statUpgrades ?? {
    attack: 0,
    speed: 0,
    hp: 0,
    range: 0,
    hpRegen: 0,
  };
  const totalSpentSP = getTotalSpentSP(safeStatUpgrades);

  // 초기화 확인 상태
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleUpgrade = useCallback(async (statType: StatUpgradeType) => {
    soundManager.play('ui_click');
    const success = await upgradeCharacterStatAction(heroClass, statType);
    if (success) {
      soundManager.play('level_up');
    }
  }, [heroClass, upgradeCharacterStatAction]);

  const handleClose = useCallback(() => {
    soundManager.play('ui_click');
    onClose();
  }, [onClose]);

  const handleResetClick = useCallback(() => {
    soundManager.play('ui_click');
    setShowResetConfirm(true);
  }, []);

  const handleResetConfirm = useCallback(async () => {
    soundManager.play('ui_click');
    const success = await resetCharacterStatsAction(heroClass);
    if (success) {
      soundManager.play('level_up');
    }
    setShowResetConfirm(false);
  }, [heroClass, resetCharacterStatsAction]);

  const handleResetCancel = useCallback(() => {
    soundManager.play('ui_click');
    setShowResetConfirm(false);
  }, []);

  // 패시브 정보 가져오기
  const passiveState = getPassiveFromCharacterLevel(heroClass, progress.classLevel);
  const passiveConfig = PASSIVE_GROWTH_CONFIGS[heroClass];

  // 클래스별 색상
  const classColors: Record<HeroClass, string> = {
    warrior: 'from-red-500 to-orange-500',
    archer: 'from-green-500 to-emerald-500',
    knight: 'from-blue-500 to-cyan-500',
    mage: 'from-purple-500 to-pink-500',
  };

  const classBorderColors: Record<HeroClass, string> = {
    warrior: 'border-red-500/50',
    archer: 'border-green-500/50',
    knight: 'border-blue-500/50',
    mage: 'border-purple-500/50',
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={handleClose}>
      <div
        className={`bg-gray-900 rounded-xl border ${classBorderColors[heroClass]} p-6 min-w-[400px] max-w-[500px] max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center gap-4 mb-6" style={{ paddingLeft: '5px', paddingRight: '5px' }}>
          <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${classColors[heroClass]} flex items-center justify-center text-4xl`}>
            {config.emoji}
          </div>
          <div className="flex-1">
            <h2 className="text-2xl text-white font-bold">{config.name}</h2>
            <p className="text-gray-400">{config.nameEn}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-yellow-400 font-bold">Lv.{progress.classLevel}</span>
              {progress.sp > 0 && (
                <span className="px-2 py-0.5 bg-cyan-500/20 rounded text-cyan-400 text-sm font-bold">
                  SP: {progress.sp}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white text-2xl cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* 잠금 상태 */}
        {!isUnlocked && (
          <div className="bg-gray-800/50 rounded-lg p-4 mb-4 text-center">
            <span className="text-4xl">🔒</span>
            <p className="text-gray-400 mt-2">이 캐릭터는 아직 해금되지 않았습니다.</p>
          </div>
        )}

        {/* 기본 스탯 */}
        <div className="bg-gray-800/50 rounded-lg p-4 mb-4" style={{ paddingLeft: '5px', paddingRight: '5px' }}>
          <h3 className="text-white font-bold mb-3">기본 스탯</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">HP</span>
              <span className="text-white">{config.hp}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">공격력</span>
              <span className="text-white">{config.attack}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">공격속도</span>
              <span className="text-white">{config.attackSpeed}초</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">이동속도</span>
              <span className="text-white">{config.speed}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">사거리</span>
              <span className="text-white">{config.range}</span>
            </div>
          </div>
        </div>

        <div style={{ height: '10px' }} />

        {/* 패시브 정보 */}
        <div className="bg-gray-800/50 rounded-lg p-4 mb-4" style={{ paddingLeft: '5px', paddingRight: '5px' }}>
          <h3 className="text-white font-bold mb-2">
            패시브
            {progress.classLevel >= PASSIVE_UNLOCK_LEVEL ? (
              <span className="ml-2 text-green-400 text-sm">(활성화)</span>
            ) : (
              <span className="ml-2 text-gray-500 text-sm">(Lv.{PASSIVE_UNLOCK_LEVEL} 해금)</span>
            )}
          </h3>
          <p className="text-gray-400 text-sm mb-2">{getPassiveDescription(heroClass)}</p>
          {passiveState ? (
            <div className="text-cyan-400 font-bold">
              {formatPassiveValue(heroClass, passiveState, progress.classLevel)}
            </div>
          ) : (
            <div className="text-gray-500">
              {PASSIVE_UNLOCK_LEVEL - progress.classLevel}레벨 더 필요
            </div>
          )}
          <p className="text-gray-500 text-xs mt-2">
            * 캐릭터 레벨 5 이상에서 활성화, 이후 레벨업마다 자동 성장
          </p>
        </div>

        <div style={{ height: '10px' }} />

        {/* SP 업그레이드 */}
        <div className="bg-gray-800/50 rounded-lg p-4" style={{ paddingLeft: '5px', paddingRight: '5px' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-bold">
              스탯 업그레이드
              <span className="ml-2 text-cyan-400 text-sm">(SP 사용)</span>
            </h3>
            {totalSpentSP > 0 && (
              <button
                onClick={handleResetClick}
                className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-sm font-bold transition-all cursor-pointer"
              >
                🔄 초기화
              </button>
            )}
          </div>

          {/* 초기화 확인 모달 */}
          {showResetConfirm && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-300 text-sm mb-3">
                정말 스탯을 초기화하시겠습니까?<br />
                <span className="text-white font-bold">{totalSpentSP} SP</span>가 반환됩니다.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleResetConfirm}
                  className="flex-1 py-2 bg-red-500/30 hover:bg-red-500/50 text-red-300 rounded font-bold transition-all cursor-pointer"
                >
                  초기화
                </button>
                <button
                  onClick={handleResetCancel}
                  className="flex-1 py-2 bg-gray-600/50 hover:bg-gray-600/70 text-gray-300 rounded font-bold transition-all cursor-pointer"
                >
                  취소
                </button>
              </div>
            </div>
          )}

          {progress.sp === 0 && totalSpentSP === 0 && (
            <p className="text-gray-500 text-sm mb-3">
              사용 가능한 SP가 없습니다. 클래스 레벨업 시 SP를 획득합니다.
            </p>
          )}

          <div style={{ height: '10px' }} />

          <div className="space-y-2">
            {upgradeableStats.map((statType) => {
              const statConfig = STAT_UPGRADE_CONFIG[statType];
              const currentLevel = safeStatUpgrades[statType] ?? 0;
              const currentBonus = getStatBonus(statType, currentLevel);
              const nextBonus = getStatBonus(statType, currentLevel + 1);
              const isMaxed = currentLevel >= statConfig.maxLevel;
              const canUpgrade = canUpgradeStat(heroClass, statType);
              const bonusDisplay = statType === 'speed' ? currentBonus.toFixed(1) : currentBonus;
              const perLevelDisplay = statType === 'speed' ? statConfig.perLevel.toFixed(1) : statConfig.perLevel;

              return (
                <div
                  key={statType}
                  className="flex items-center justify-between bg-gray-700/50 rounded-lg p-3"
                  style={{ paddingRight: '5px' }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{statConfig.icon}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">{statConfig.name}</span>
                        {currentLevel > 0 && (
                          <span className="text-green-400 font-bold">
                            +{bonusDisplay}{statConfig.unit}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400">
                        Lv.{currentLevel}
                        <span className="ml-2 text-gray-500">
                          (레벨당 +{perLevelDisplay}{statConfig.unit})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="ml-4 mr-2">
                    {isMaxed ? (
                      <span className="px-3 py-1 bg-yellow-500/20 rounded text-yellow-400 text-sm font-bold">
                        MAX
                      </span>
                    ) : (
                      <button
                        onClick={() => handleUpgrade(statType)}
                        disabled={!canUpgrade}
                        className={`
                          w-8 h-8 rounded-md text-xl font-bold transition-all flex items-center justify-center
                          ${canUpgrade
                            ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/40 hover:scale-105 cursor-pointer border border-cyan-500/50'
                            : 'bg-gray-600/50 text-gray-500 cursor-not-allowed border border-gray-600'
                          }
                        `}
                      >
                        +
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ height: '10px' }} />

        {/* 닫기 버튼 */}
        <button
          onClick={handleClose}
          className="w-full mt-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-bold transition-colors cursor-pointer"
        >
          닫기
        </button>
      </div>
    </div>
  );
};
