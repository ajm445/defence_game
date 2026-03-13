import React, { useCallback, useState, useEffect } from 'react';
import { HeroClass, AdvancedHeroClass } from '../../types/rpg';
import {
  ClassProgress,
  StatUpgradeType,
  STAT_UPGRADE_CONFIG,
  getUpgradeableStats,
  getStatBonus,
  getTotalSpentSP,
} from '../../types/auth';
import {
  CLASS_CONFIGS,
  PASSIVE_UNLOCK_LEVEL,
  PASSIVE_GROWTH_CONFIGS,
  ADVANCEMENT_OPTIONS,
  ADVANCED_CLASS_CONFIGS,
  ADVANCED_W_SKILLS,
  ADVANCED_E_SKILLS,
  JOB_ADVANCEMENT_REQUIREMENTS,
} from '../../constants/rpgConfig';
import { useProfileStore } from '../../stores/useProfileStore';
import { soundManager } from '../../services/SoundManager';
import {
  getPassiveFromCharacterLevel,
  formatPassiveValue,
  getPassiveDescription,
} from '../../game/rpg/passiveSystem';
import { Emoji } from '../common/Emoji';

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
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const baseConfig = CLASS_CONFIGS[heroClass];
  const advancedConfig = progress.advancedClass
    ? ADVANCED_CLASS_CONFIGS[progress.advancedClass as AdvancedHeroClass]
    : null;

  // 표시용 설정 (전직 시 전직 캐릭터 정보 사용)
  const displayConfig = advancedConfig
    ? {
        name: advancedConfig.name,
        nameEn: advancedConfig.nameEn,
        emoji: advancedConfig.emoji,
        // 2차 강화 시 스탯 1.2배 적용
        hp: progress.tier === 2
          ? Math.floor(advancedConfig.stats.hp * 1.2)
          : advancedConfig.stats.hp,
        attack: progress.tier === 2
          ? Math.floor(advancedConfig.stats.attack * 1.2)
          : advancedConfig.stats.attack,
        attackSpeed: progress.tier === 2
          ? Number((advancedConfig.stats.attackSpeed / 1.2).toFixed(2))
          : advancedConfig.stats.attackSpeed,
        speed: progress.tier === 2
          ? Math.floor(advancedConfig.stats.speed * 1.2)
          : advancedConfig.stats.speed,
        range: progress.tier === 2
          ? Math.floor(advancedConfig.stats.range * 1.2)
          : advancedConfig.stats.range,
      }
    : baseConfig;

  const upgradeCharacterStatAction = useProfileStore((state) => state.upgradeCharacterStatAction);
  const canUpgradeStat = useProfileStore((state) => state.canUpgradeStat);
  const resetCharacterStatsAction = useProfileStore((state) => state.resetCharacterStatsAction);

  const upgradeableStats = getUpgradeableStats(heroClass);

  // statUpgrades가 없거나 새 필드가 누락된 경우 기본값 병합
  const statUpgrades = progress.statUpgrades ?? {};
  const safeStatUpgrades = {
    attack: statUpgrades.attack ?? 0,
    speed: statUpgrades.speed ?? 0,
    hp: statUpgrades.hp ?? 0,
    attackSpeed: statUpgrades.attackSpeed ?? 0,
    range: statUpgrades.range ?? 0,
    hpRegen: statUpgrades.hpRegen ?? 0,
    skillCooldown: statUpgrades.skillCooldown ?? 0,
  };
  const totalSpentSP = getTotalSpentSP(safeStatUpgrades);

  // 초기화 확인 상태
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // 전직 관련 상태
  const [showJobAdvancement, setShowJobAdvancement] = useState(false);
  const [showAdvancementConfirm, setShowAdvancementConfirm] = useState<AdvancedHeroClass | null>(null);
  const advanceJobAction = useProfileStore((state) => state.advanceJobAction);

  // 전직 가능 여부 확인
  const canAdvanceJob = progress.classLevel >= JOB_ADVANCEMENT_REQUIREMENTS.minClassLevel && !progress.advancedClass;
  // 전직 변경 가능 여부 (이미 전직했고 레벨 15 이상)
  const canChangeJob = progress.classLevel >= JOB_ADVANCEMENT_REQUIREMENTS.minClassLevel && !!progress.advancedClass;
  const advancementOptions = ADVANCEMENT_OPTIONS[heroClass];

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

  // 전직 관련 핸들러
  const handleShowJobAdvancement = useCallback(() => {
    soundManager.play('ui_click');
    setShowJobAdvancement(true);
  }, []);

  const handleCloseJobAdvancement = useCallback(() => {
    soundManager.play('ui_click');
    setShowJobAdvancement(false);
  }, []);

  const handleSelectAdvancedClass = useCallback((advancedClass: AdvancedHeroClass) => {
    soundManager.play('ui_click');
    setShowAdvancementConfirm(advancedClass);
  }, []);

  const handleConfirmAdvancement = useCallback(async () => {
    if (!showAdvancementConfirm) return;
    soundManager.play('ui_click');
    const success = await advanceJobAction(heroClass, showAdvancementConfirm);
    if (success) {
      soundManager.play('level_up');
      setShowAdvancementConfirm(null);
      setShowJobAdvancement(false);
    }
  }, [heroClass, showAdvancementConfirm, advanceJobAction]);

  const handleCancelAdvancement = useCallback(() => {
    soundManager.play('ui_click');
    setShowAdvancementConfirm(null);
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
        className={`bg-gray-900 rounded-xl border ${classBorderColors[heroClass]} p-4 sm:p-6 w-[92vw] sm:w-auto sm:min-w-[400px] max-w-[500px] max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center gap-4 mb-6" style={{ paddingLeft: '5px', paddingRight: '5px' }}>
          <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${classColors[heroClass]} flex items-center justify-center`}>
            <Emoji emoji={displayConfig.emoji} size={36} />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl text-white font-bold">
              {displayConfig.name}
              {progress.tier === 2 && <span className="ml-2 text-orange-400 text-lg">★★</span>}
            </h2>
            <p className="text-gray-400">{displayConfig.nameEn}</p>
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
            <Emoji emoji="🔒" size={36} />
            <p className="text-gray-400 mt-2">이 캐릭터는 아직 해금되지 않았습니다.</p>
          </div>
        )}

        {/* 현재 스탯 (기본 + SP 업그레이드 합산) */}
        <div className="bg-gray-800/50 rounded-lg p-4 mb-4" style={{ paddingLeft: '5px', paddingRight: '5px' }}>
          <h3 className="text-white font-bold mb-3">
            현재 스탯
            {progress.tier === 2 && <span className="ml-2 text-orange-400 text-sm">(2차 강화)</span>}
          </h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">HP</span>
              <span className="text-white">{displayConfig.hp + getStatBonus('hp', safeStatUpgrades.hp, progress.tier)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">공격력</span>
              <span className="text-white">{displayConfig.attack + getStatBonus('attack', safeStatUpgrades.attack, progress.tier)}</span>
            </div>
            {heroClass === 'mage' ? (
              <div className="flex justify-between">
                <span className="text-gray-400">스킬 쿨감</span>
                <span className="text-white">{getStatBonus('skillCooldown', safeStatUpgrades.skillCooldown ?? 0, progress.tier)}%</span>
              </div>
            ) : (
              <div className="flex justify-between">
                <span className="text-gray-400">공격속도</span>
                <span className="text-white">{Math.max(0.3, displayConfig.attackSpeed - getStatBonus('attackSpeed', safeStatUpgrades.attackSpeed ?? 0, progress.tier)).toFixed(2)}초</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-400">이동속도</span>
              <span className="text-white">{(displayConfig.speed + getStatBonus('speed', safeStatUpgrades.speed, progress.tier)).toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">사거리</span>
              <span className="text-white">{displayConfig.range + getStatBonus('range', safeStatUpgrades.range, progress.tier)}</span>
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

          {/* 전직 특수 효과 */}
          {progress.advancedClass && advancedConfig?.specialEffects && (
            <div className="mt-4 pt-3 border-t border-gray-700">
              <h4 className="text-yellow-400 font-bold mb-2 text-sm">전직 특수 효과</h4>
              <div className="text-orange-300 font-bold">
                {advancedConfig.specialEffects.lifestealMultiplier && (
                  <span>피해흡혈 {advancedConfig.specialEffects.lifestealMultiplier}배</span>
                )}
                {advancedConfig.specialEffects.damageReduction && (
                  <span>받는 피해 {Math.round(advancedConfig.specialEffects.damageReduction * 100)}% 감소</span>
                )}
                {advancedConfig.specialEffects.critChance && (
                  <span>크리티컬 확률 {Math.round(advancedConfig.specialEffects.critChance * 100)}%</span>
                )}
                {advancedConfig.specialEffects.multiTarget && (
                  <span>다중 타겟 {advancedConfig.specialEffects.multiTarget}명</span>
                )}
                {advancedConfig.specialEffects.lifesteal && (
                  <span>피해흡혈 {Math.round(advancedConfig.specialEffects.lifesteal * 100)}%</span>
                )}
                {advancedConfig.specialEffects.bossBonus && (
                  <span>보스에게 {Math.round(advancedConfig.specialEffects.bossBonus * 100)}% 추가 데미지</span>
                )}
                {advancedConfig.specialEffects.healAlly && (
                  <span>아군 힐 가능</span>
                )}
              </div>
            </div>
          )}
        </div>

        <div style={{ height: '10px' }} />

        {/* 전직 섹션 */}
        <div className="bg-gray-800/50 rounded-lg p-4 mb-4" style={{ paddingLeft: '5px', paddingRight: '5px' }}>
          <h3 className="text-white font-bold mb-2">
            전직
            {progress.advancedClass ? (
              <span className="ml-2 text-yellow-400 text-sm">
                ({ADVANCED_CLASS_CONFIGS[progress.advancedClass as AdvancedHeroClass].name})
              </span>
            ) : canAdvanceJob ? (
              <span className="ml-2 text-green-400 text-sm">(가능!)</span>
            ) : (
              <span className="ml-2 text-gray-500 text-sm">(Lv.{JOB_ADVANCEMENT_REQUIREMENTS.minClassLevel} 필요)</span>
            )}
          </h3>

          {progress.advancedClass ? (
            // 전직 완료 상태
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                <Emoji emoji={ADVANCED_CLASS_CONFIGS[progress.advancedClass as AdvancedHeroClass].emoji} size={30} />
                <div className="flex-1">
                  <div className="text-yellow-400 font-bold">
                    {ADVANCED_CLASS_CONFIGS[progress.advancedClass as AdvancedHeroClass].name}
                    {progress.tier === 2 && <span className="ml-2 text-orange-400">★★</span>}
                  </div>
                  <div className="text-gray-400 text-sm">
                    {ADVANCED_CLASS_CONFIGS[progress.advancedClass as AdvancedHeroClass].description}
                  </div>
                </div>
              </div>
              {/* 전직 변경 버튼 */}
              {canChangeJob && (
                <button
                  onClick={handleShowJobAdvancement}
                  className="w-full py-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/40 hover:to-pink-500/40 rounded-lg text-purple-300 font-bold transition-all cursor-pointer border border-purple-500/50 flex items-center justify-center gap-2 text-sm"
                >
                  <span>🔄</span>
                  전직 변경하기
                  <span className="text-xs text-gray-400">(Lv.15, SP 14, 스탯 초기화)</span>
                </button>
              )}
            </div>
          ) : canAdvanceJob ? (
            // 전직 가능 상태
            <button
              onClick={handleShowJobAdvancement}
              className="w-full py-3 bg-gradient-to-r from-yellow-500/30 to-orange-500/30 hover:from-yellow-500/50 hover:to-orange-500/50 rounded-lg text-yellow-300 font-bold transition-all cursor-pointer border border-yellow-500/50 flex items-center justify-center gap-2"
            >
              <Emoji emoji="⚔️" size={20} />
              전직하기
              <Emoji emoji="⚔️" size={20} />
            </button>
          ) : (
            // 전직 불가 상태
            <div className="p-3 bg-gray-700/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Emoji emoji="🔒" size={24} />
                <div className="text-gray-400">
                  <span className="text-white font-bold">Lv.{JOB_ADVANCEMENT_REQUIREMENTS.minClassLevel}</span>
                  에 전직 가능 (현재 Lv.{progress.classLevel})
                </div>
              </div>
              <div className="mt-2 w-full bg-gray-600 rounded-full h-2">
                <div
                  className="bg-yellow-500 h-2 rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (progress.classLevel / JOB_ADVANCEMENT_REQUIREMENTS.minClassLevel) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* 전직 선택 모달 */}
        {showJobAdvancement && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-60" onClick={handleCloseJobAdvancement}>
            <div
              className={`bg-gray-900 rounded-xl border ${progress.advancedClass ? 'border-purple-500/50' : 'border-yellow-500/50'} p-4 sm:p-6 w-[95vw] max-w-[700px] max-h-[90vh] overflow-y-auto`}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className={`text-2xl ${progress.advancedClass ? 'text-purple-400' : 'text-yellow-400'} font-bold text-center mb-2`}>
                {progress.advancedClass ? '전직 변경' : `${baseConfig.name} 전직 선택`}
              </h2>
              {progress.advancedClass && (
                <p className="text-center text-red-400 text-sm mb-4">
                  전직 변경 시 레벨 15, SP 14로 초기화되며 스탯 업그레이드가 리셋됩니다!
                </p>
              )}

              <div className="grid grid-cols-2 gap-4">
                {advancementOptions.map((advClass) => {
                  const advConfig = ADVANCED_CLASS_CONFIGS[advClass];
                  const wSkill = ADVANCED_W_SKILLS[advClass];
                  const eSkill = ADVANCED_E_SKILLS[advClass];
                  const isCurrentClass = progress.advancedClass === advClass;

                  return (
                    <div
                      key={advClass}
                      className={`bg-gray-800/70 rounded-lg p-4 border transition-all ${
                        isCurrentClass
                          ? 'border-green-500/50 opacity-60 cursor-not-allowed'
                          : 'border-gray-600 hover:border-yellow-500/50 cursor-pointer'
                      }`}
                      onClick={() => !isCurrentClass && handleSelectAdvancedClass(advClass)}
                    >
                      {/* 현재 전직 표시 */}
                      {isCurrentClass && (
                        <div className="absolute top-2 right-2 px-2 py-1 bg-green-500/20 rounded text-green-400 text-xs font-bold">
                          현재 전직
                        </div>
                      )}

                      {/* 직업 헤더 */}
                      <div className="flex items-center gap-3 mb-3">
                        <Emoji emoji={advConfig.emoji} size={36} />
                        <div>
                          <div className="text-white font-bold text-lg">
                            {advConfig.name}
                            {isCurrentClass && <span className="ml-2 text-green-400 text-sm">(현재)</span>}
                          </div>
                          <div className="text-gray-400 text-sm">{advConfig.nameEn}</div>
                        </div>
                      </div>

                      {/* 설명 */}
                      <p className="text-gray-300 text-sm mb-3">{advConfig.description}</p>

                      {/* 스탯 변화 */}
                      <div className="text-xs text-gray-400 mb-3">
                        <div className="grid grid-cols-2 gap-1">
                          <span>HP: {advConfig.stats.hp}</span>
                          <span>공격력: {advConfig.stats.attack}</span>
                          <span>공속: {advConfig.stats.attackSpeed.toFixed(2)}초</span>
                          <span>사거리: {advConfig.stats.range}</span>
                        </div>
                      </div>

                      {/* 특수 효과 */}
                      <div className="text-cyan-400 text-xs mb-3">
                        {advConfig.specialEffects.damageReduction && `피해량 ${advConfig.specialEffects.damageReduction * 100}% 감소`}
                        {advConfig.specialEffects.lifestealMultiplier && `흡혈 ${advConfig.specialEffects.lifestealMultiplier}배`}
                        {advConfig.specialEffects.lifesteal && `흡혈 ${advConfig.specialEffects.lifesteal * 100}%`}
                        {advConfig.specialEffects.critChance && `크리티컬 ${advConfig.specialEffects.critChance * 100}%`}
                        {advConfig.specialEffects.multiTarget && `다중타겟 ${advConfig.specialEffects.multiTarget}명`}
                        {advConfig.specialEffects.healAlly && '아군 힐 가능'}
                        {advConfig.specialEffects.bossBonus && `보스 +${advConfig.specialEffects.bossBonus * 100}% 데미지`}
                      </div>

                      {/* 스킬 */}
                      <div className="space-y-2 text-xs">
                        <div className="bg-gray-700/50 p-2 rounded">
                          <span className="text-orange-400 font-bold">Shift</span>
                          <span className="text-white ml-2">{wSkill.name}</span>
                          <span className="text-gray-500 ml-2">({wSkill.cooldown}초)</span>
                        </div>
                        <div className="bg-gray-700/50 p-2 rounded">
                          <span className="text-purple-400 font-bold">R</span>
                          <span className="text-white ml-2">{eSkill.name}</span>
                          <span className="text-gray-500 ml-2">({eSkill.cooldown}초)</span>
                        </div>
                      </div>

                      {/* 선택 버튼 */}
                      <button
                        className={`w-full mt-3 py-2 rounded font-bold transition-all ${
                          isCurrentClass
                            ? 'bg-gray-600/50 text-gray-500 cursor-not-allowed'
                            : 'bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-300'
                        }`}
                        disabled={isCurrentClass}
                      >
                        {isCurrentClass ? '현재 전직' : '선택'}
                      </button>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={handleCloseJobAdvancement}
                className="w-full mt-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-bold transition-colors cursor-pointer"
              >
                취소
              </button>
            </div>
          </div>
        )}

        {/* 전직 확인 모달 */}
        {showAdvancementConfirm && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-70" onClick={handleCancelAdvancement}>
            <div
              className={`bg-gray-900 rounded-xl border ${progress.advancedClass ? 'border-purple-500/50' : 'border-yellow-500/50'} p-4 sm:p-6 w-[90vw] sm:w-auto sm:min-w-[400px] max-w-[450px]`}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl text-white font-bold text-center mb-4">
                <span className={progress.advancedClass ? 'text-purple-400' : 'text-yellow-400'}>
                  {ADVANCED_CLASS_CONFIGS[showAdvancementConfirm].name}
                </span>
                {progress.advancedClass ? '으로 전직 변경하시겠습니까?' : '으로 전직하시겠습니까?'}
              </h2>

              <div className="bg-gray-800/50 rounded-lg p-4 mb-4">
                <ul className="text-sm text-gray-300 space-y-1">
                  <li>• 스탯이 전직 직업에 맞게 변경됩니다</li>
                  <li>• Shift, R 스킬이 새로운 스킬로 변경됩니다</li>
                  {progress.advancedClass ? (
                    <>
                      <li className="text-red-400 font-bold">• 캐릭터 레벨이 15로 초기화됩니다!</li>
                      <li className="text-red-400 font-bold">• SP가 14로 초기화됩니다!</li>
                      <li className="text-red-400 font-bold">• 스탯 업그레이드가 리셋됩니다!</li>
                      <li className="text-red-400">• 2차 강화(Tier 2) 상태도 초기화됩니다</li>
                    </>
                  ) : (
                    <>
                      <li>• SP 업그레이드는 유지됩니다</li>
                      <li className="text-gray-400">• 전직 후에도 다른 전직으로 변경 가능합니다</li>
                    </>
                  )}
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleConfirmAdvancement}
                  className={`flex-1 py-3 ${progress.advancedClass ? 'bg-purple-500/30 hover:bg-purple-500/50 border-purple-500/50 text-purple-300' : 'bg-yellow-500/30 hover:bg-yellow-500/50 border-yellow-500/50 text-yellow-300'} rounded-lg font-bold transition-all cursor-pointer border`}
                >
                  {progress.advancedClass ? '전직 변경하기' : '전직하기'}
                </button>
                <button
                  onClick={handleCancelAdvancement}
                  className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-bold transition-colors cursor-pointer"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}

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
              const currentBonus = getStatBonus(statType, currentLevel, progress.tier);
              const nextBonus = getStatBonus(statType, currentLevel + 1, progress.tier);

              // 공격속도 0.3초 캡 체크
              const isAttackSpeedCapped = statType === 'attackSpeed' &&
                (displayConfig.attackSpeed - getStatBonus('attackSpeed', safeStatUpgrades.attackSpeed ?? 0, progress.tier)) < 0.31;
              const isTier2 = progress.tier === 2;
              const isMaxed = isAttackSpeedCapped || (!isTier2 && currentLevel >= statConfig.maxLevel);
              const canUpgrade = isAttackSpeedCapped ? false : canUpgradeStat(heroClass, statType);
              // 소수점 표시가 필요한 스탯들 (부동소수점 오류 방지)
              const needsDecimalFormat = statType === 'speed' || statType === 'attackSpeed';
              const decimalPlaces = statType === 'attackSpeed' ? 2 : 1;
              const bonusDisplay = needsDecimalFormat ? currentBonus.toFixed(decimalPlaces) : currentBonus;
              const perLevelDisplay = needsDecimalFormat ? statConfig.perLevel.toFixed(decimalPlaces) : statConfig.perLevel;

              return (
                <div
                  key={statType}
                  className="flex items-center justify-between bg-gray-700/50 rounded-lg p-3"
                  style={{ paddingRight: '5px' }}
                >
                  <div className="flex items-center gap-3">
                    <Emoji emoji={statConfig.icon} size={24} />
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

                  <div className="ml-4 mr-2 flex flex-col items-end gap-1">
                    {isMaxed ? (
                      <>
                        <span className="px-3 py-1 bg-yellow-500/20 rounded text-yellow-400 text-sm font-bold">
                          MAX
                        </span>
                        {isAttackSpeedCapped && (
                          <span className="text-[10px] text-yellow-400/80">최대 공격속도는 0.3초입니다</span>
                        )}
                      </>
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
