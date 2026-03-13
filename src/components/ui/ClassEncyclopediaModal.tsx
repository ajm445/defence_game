import React, { useState, useEffect } from 'react';
import { HeroClass, AdvancedHeroClass } from '../../types/rpg';
import {
  CLASS_CONFIGS,
  ADVANCED_CLASS_CONFIGS,
  ADVANCEMENT_OPTIONS,
  PASSIVE_GROWTH_CONFIGS,
  PASSIVE_UNLOCK_LEVEL,
  SECOND_ENHANCEMENT_MULTIPLIER,
  JOB_ADVANCEMENT_REQUIREMENTS,
} from '../../constants/rpgConfig';
import { CHARACTER_UNLOCK_LEVELS } from '../../types/auth';
import { ClassCard, classColors } from './ClassCard';
import { ClassSkillDisplay } from './ClassSkillDisplay';
import { ClassAdvancementPath } from './ClassAdvancementPath';
import { soundManager } from '../../services/SoundManager';
import { Emoji } from '../common/Emoji';
import { getHeroImagePath } from '../../utils/heroImages';

type TabType = 'basic' | 'advanced';

interface ClassEncyclopediaModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerLevel?: number;
}

const CLASS_LIST: HeroClass[] = ['archer', 'warrior', 'knight', 'mage'];

// 패시브 설명 헬퍼
const getPassiveDescription = (heroClass: HeroClass): { name: string; description: string; unlockInfo: string } => {
  const config = PASSIVE_GROWTH_CONFIGS[heroClass];

  switch (config.type) {
    case 'lifesteal':
      return {
        name: '피해흡혈',
        description: `공격 시 피해량의 일정 비율을 HP로 회복 (최대 ${config.maxValue * 100}%)`,
        unlockInfo: `Lv.${PASSIVE_UNLOCK_LEVEL} 해금`,
      };
    case 'multiTarget':
      return {
        name: '멀티타겟',
        description: `기본 공격이 최대 3명의 적을 동시에 공격 (최대 ${config.maxValue * 100}% 확률)`,
        unlockInfo: `Lv.${PASSIVE_UNLOCK_LEVEL} 해금`,
      };
    case 'hpRegen':
      return {
        name: 'HP 재생',
        description: `초당 HP를 자동 회복 (최대 ${config.maxValue}/초)`,
        unlockInfo: `Lv.${PASSIVE_UNLOCK_LEVEL} 해금`,
      };
    case 'bossDamageBonus':
      return {
        name: '보스 특공',
        description: `보스에게 주는 피해량 증가 (최대 ${config.maxValue * 100}%)`,
        unlockInfo: `Lv.${PASSIVE_UNLOCK_LEVEL} 해금`,
      };
    default:
      return { name: '-', description: '-', unlockInfo: '' };
  }
};

export const ClassEncyclopediaModal: React.FC<ClassEncyclopediaModalProps> = ({
  isOpen,
  onClose,
  playerLevel = 1,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('basic');
  const [selectedBaseClass, setSelectedBaseClass] = useState<HeroClass>('archer');
  const [selectedAdvancedClass, setSelectedAdvancedClass] = useState<AdvancedHeroClass | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleTabChange = (tab: TabType) => {
    soundManager.play('ui_click');
    setActiveTab(tab);
    if (tab === 'advanced' && !selectedAdvancedClass) {
      // 전직 탭으로 이동 시 첫 번째 전직 직업 선택
      setSelectedAdvancedClass(ADVANCEMENT_OPTIONS[selectedBaseClass][0]);
    }
  };

  const handleBaseClassSelect = (heroClass: HeroClass) => {
    soundManager.play('ui_click');
    setSelectedBaseClass(heroClass);
    if (activeTab === 'advanced') {
      setSelectedAdvancedClass(ADVANCEMENT_OPTIONS[heroClass][0]);
    }
  };

  const handleAdvancedClassSelect = (advClass: AdvancedHeroClass) => {
    soundManager.play('ui_click');
    setSelectedAdvancedClass(advClass);
    // 해당 전직의 기본 직업으로 탭 동기화
    const baseClass = ADVANCED_CLASS_CONFIGS[advClass].baseClass;
    setSelectedBaseClass(baseClass);
  };

  const baseConfig = CLASS_CONFIGS[selectedBaseClass];
  const advConfig = selectedAdvancedClass ? ADVANCED_CLASS_CONFIGS[selectedAdvancedClass] : null;
  const colors = classColors[selectedBaseClass];
  const passive = getPassiveDescription(selectedBaseClass);
  const isLocked = playerLevel < CHARACTER_UNLOCK_LEVELS[selectedBaseClass];

  // 현재 표시할 스탯 (기본 또는 전직)
  const displayStats = activeTab === 'advanced' && advConfig
    ? advConfig.stats
    : {
        hp: baseConfig.hp,
        attack: baseConfig.attack,
        attackSpeed: baseConfig.attackSpeed,
        speed: baseConfig.speed,
        range: baseConfig.range,
      };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="relative w-[95vw] max-w-[900px] max-h-[85vh] bg-gray-900/95 border border-gray-700 rounded-2xl overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <Emoji emoji="📚" size={24} />
            <h1 className="text-xl font-bold text-white">직업 도감</h1>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* 탭 네비게이션 */}
        <div className="flex gap-2 px-6 py-3 border-b border-gray-700/50">
          <button
            onClick={() => handleTabChange('basic')}
            className={`
              px-4 py-2 rounded-lg font-bold text-sm transition-all cursor-pointer
              ${activeTab === 'basic'
                ? 'bg-green-500/20 text-green-400 border border-green-500'
                : 'bg-gray-800/50 text-gray-400 border border-gray-700 hover:bg-gray-800 hover:text-gray-300'}
            `}
          >
            기본 직업
          </button>
          <button
            onClick={() => handleTabChange('advanced')}
            className={`
              px-4 py-2 rounded-lg font-bold text-sm transition-all cursor-pointer
              ${activeTab === 'advanced'
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500'
                : 'bg-gray-800/50 text-gray-400 border border-gray-700 hover:bg-gray-800 hover:text-gray-300'}
            `}
          >
            전직 직업
          </button>
        </div>

        {/* 메인 컨텐츠 */}
        <div className="flex h-[calc(85vh-130px)]">
          {/* 왼쪽: 직업 목록 */}
          <div className="w-[200px] border-r border-gray-700/50 p-4 overflow-y-auto">
            {activeTab === 'basic' ? (
              // 기본 직업 목록
              <div className="space-y-3">
                {CLASS_LIST.map((heroClass) => {
                  const config = CLASS_CONFIGS[heroClass];
                  const unlockLevel = CHARACTER_UNLOCK_LEVELS[heroClass];
                  const locked = playerLevel < unlockLevel;
                  const isSelected = selectedBaseClass === heroClass;
                  const classColor = classColors[heroClass];

                  return (
                    <button
                      key={heroClass}
                      onClick={() => handleBaseClassSelect(heroClass)}
                      className={`
                        w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer
                        ${isSelected
                          ? `${classColor.border} ${classColor.bg}`
                          : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'}
                        ${locked ? 'opacity-60' : ''}
                      `}
                    >
                      <Emoji emoji={config.emoji} size={24} />
                      <div className="text-left">
                        <p className={`font-bold text-sm ${isSelected ? classColor.text : 'text-white'}`}>
                          {config.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {locked ? `Lv.${unlockLevel} 해금` : unlockLevel === 1 ? '기본' : `Lv.${unlockLevel}`}
                        </p>
                      </div>
                      {locked && <span className="ml-auto"><Emoji emoji="🔒" size={14} /></span>}
                    </button>
                  );
                })}
              </div>
            ) : (
              // 전직 직업 목록
              <div>
                {CLASS_LIST.map((heroClass, idx) => {
                  const baseConf = CLASS_CONFIGS[heroClass];
                  const advOptions = ADVANCEMENT_OPTIONS[heroClass];
                  const classColor = classColors[heroClass];

                  const sectionBorderColors: Record<HeroClass, string> = {
                    warrior: 'border-red-500/40',
                    archer: 'border-green-500/40',
                    knight: 'border-blue-500/40',
                    mage: 'border-purple-500/40',
                  };

                  return (
                    <div key={heroClass}>
                      {/* 계열 구분 여백 */}
                      {idx > 0 && <div className="h-4 border-b border-gray-700/40 mb-4" />}
                      {/* 계열 헤더 */}
                      <div className={`flex items-center gap-1.5 px-2 py-1 mb-1.5`}>
                        <Emoji emoji={baseConf.emoji} size={14} />
                        <span className={`text-xs font-bold ${classColor.text}`}>{baseConf.name} 계열</span>
                        <div className={`flex-1 border-b ${sectionBorderColors[heroClass]} ml-1`} />
                      </div>
                      {/* 전직 버튼 */}
                      <div className="space-y-1 pl-1">
                        {advOptions.map((advClass) => {
                          const advConf = ADVANCED_CLASS_CONFIGS[advClass];
                          const isSelected = selectedAdvancedClass === advClass;

                          return (
                            <button
                              key={advClass}
                              onClick={() => handleAdvancedClassSelect(advClass)}
                              className={`
                                w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition-all cursor-pointer
                                ${isSelected
                                  ? 'bg-orange-500/25 text-orange-300'
                                  : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'}
                              `}
                            >
                              <Emoji emoji={advConf.emoji} size={18} />
                              <span className={`font-bold text-sm ${isSelected ? 'text-orange-300' : ''}`}>
                                {advConf.name}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 오른쪽: 상세 정보 */}
          <div className="flex-1 p-6 overflow-y-auto">
            {/* 직업 헤더 */}
            <div className="flex items-start gap-4 mb-8">
              <div className={`
                w-20 h-20 rounded-xl flex items-center justify-center overflow-hidden
                bg-gradient-to-br ${colors.gradient} border-2 ${colors.border}
              `}>
                <img
                  src={activeTab === 'advanced' && selectedAdvancedClass
                    ? getHeroImagePath(selectedBaseClass, selectedAdvancedClass)
                    : getHeroImagePath(selectedBaseClass)}
                  alt={activeTab === 'advanced' && advConfig ? advConfig.name : baseConfig.name}
                  className="w-16 h-16 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
                  draggable={false}
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold text-white">
                    {activeTab === 'advanced' && advConfig ? advConfig.name : baseConfig.name}
                  </h2>
                  {activeTab === 'advanced' && (
                    <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded-full border border-orange-500/50">
                      전직
                    </span>
                  )}
                  {isLocked && (
                    <span className="px-2 py-0.5 bg-gray-700 text-gray-400 text-xs rounded-full">
                      <Emoji emoji="🔒" size={12} className="mr-1" /> Lv.{CHARACTER_UNLOCK_LEVELS[selectedBaseClass]} 필요
                    </span>
                  )}
                </div>
                <p className="text-gray-400 text-sm mt-1">
                  {activeTab === 'advanced' && advConfig ? advConfig.description : baseConfig.description}
                </p>
              </div>
            </div>

            {/* 스탯 및 패시브 */}
            <div className="grid grid-cols-2 gap-5 mb-8">
              {/* 기본 정보 */}
              <div className="p-5 bg-gray-800/30 rounded-xl border border-gray-700">
                <div className="flex items-center gap-2 mb-4">
                  <Emoji emoji="📊" size={18} />
                  <h3 className="text-white font-bold">기본 정보</h3>
                  {activeTab === 'advanced' && (
                    <span className="text-xs text-orange-400 ml-auto">1차 전직 기준</span>
                  )}
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400"><Emoji emoji="❤️" size={14} className="mr-1" /> HP</span>
                    <span className="text-white font-bold">{displayStats.hp}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400"><Emoji emoji="⚔️" size={14} className="mr-1" /> 공격력</span>
                    <span className="text-red-400 font-bold">{displayStats.attack}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400"><Emoji emoji="⚡" size={14} className="mr-1" /> 공격속도</span>
                    <span className="text-yellow-400 font-bold">{displayStats.attackSpeed}초</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400"><Emoji emoji="👟" size={14} className="mr-1" /> 이동속도</span>
                    <span className="text-blue-400 font-bold">{displayStats.speed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400"><Emoji emoji="🎯" size={14} className="mr-1" /> 사거리</span>
                    <span className="text-green-400 font-bold">{displayStats.range}</span>
                  </div>
                </div>
                {activeTab === 'advanced' && (
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <p className="text-xs text-gray-500">
                      2차 강화(Lv.{JOB_ADVANCEMENT_REQUIREMENTS.secondEnhancementLevel}): 모든 스탯 ×{SECOND_ENHANCEMENT_MULTIPLIER}
                    </p>
                  </div>
                )}
              </div>

              {/* 패시브 / 특수 효과 */}
              <div className="p-5 bg-gray-800/30 rounded-xl border border-gray-700">
                <div className="flex items-center gap-2 mb-4">
                  <Emoji emoji="✨" size={18} />
                  <h3 className="text-white font-bold">
                    {activeTab === 'advanced' ? '특수 효과' : '패시브'}
                  </h3>
                </div>
                {activeTab === 'advanced' && advConfig ? (
                  // 전직 특수 효과
                  <div className="space-y-3 text-sm">
                    {advConfig.specialEffects.damageReduction && (
                      <div className="flex justify-between">
                        <span className="text-gray-400"><Emoji emoji="🛡️" size={14} className="mr-1" /> 피해 감소</span>
                        <span className="text-blue-400 font-bold">{advConfig.specialEffects.damageReduction * 100}%</span>
                      </div>
                    )}
                    {advConfig.specialEffects.lifestealMultiplier && (
                      <div className="flex justify-between">
                        <span className="text-gray-400"><Emoji emoji="🩸" size={14} className="mr-1" /> 피해흡혈 배율</span>
                        <span className="text-red-400 font-bold">×{advConfig.specialEffects.lifestealMultiplier}</span>
                      </div>
                    )}
                    {advConfig.specialEffects.lifesteal && (
                      <div className="flex justify-between">
                        <span className="text-gray-400"><Emoji emoji="🩸" size={14} className="mr-1" /> 피해흡혈</span>
                        <span className="text-red-400 font-bold">{advConfig.specialEffects.lifesteal * 100}%</span>
                      </div>
                    )}
                    {advConfig.specialEffects.critChance && (
                      <div className="flex justify-between">
                        <span className="text-gray-400"><Emoji emoji="💥" size={14} className="mr-1" /> 크리티컬 확률</span>
                        <span className="text-orange-400 font-bold">{advConfig.specialEffects.critChance * 100}%</span>
                      </div>
                    )}
                    {advConfig.specialEffects.multiTarget && (
                      <div className="flex justify-between">
                        <span className="text-gray-400"><Emoji emoji="🎯" size={14} className="mr-1" /> 동시 공격</span>
                        <span className="text-green-400 font-bold">{advConfig.specialEffects.multiTarget}명</span>
                      </div>
                    )}
                    {advConfig.specialEffects.bossBonus && (
                      <div className="flex justify-between">
                        <span className="text-gray-400"><Emoji emoji="👹" size={14} className="mr-1" /> 보스 추가 데미지</span>
                        <span className="text-purple-400 font-bold">+{advConfig.specialEffects.bossBonus * 100}%</span>
                      </div>
                    )}
                    {advConfig.specialEffects.healAlly && (
                      <div className="text-green-400 text-sm">
                        <Emoji emoji="💚" size={14} className="mr-1" /> 아군 치유 가능
                      </div>
                    )}
                    {advConfig.specialEffects.basicAttackHeal && (
                      <div className="text-sm text-gray-400 leading-relaxed">
                        기본 공격 시 주변 {advConfig.specialEffects.basicAttackHeal.range}px 내 아군
                        HP {advConfig.specialEffects.basicAttackHeal.healPercent * 100}% 회복
                      </div>
                    )}
                    {advConfig.specialEffects.healAura && (
                      <div className="text-sm text-gray-400 leading-relaxed">
                        주변 {advConfig.specialEffects.healAura.radius}px 내 아군
                        초당 최대 HP의 {advConfig.specialEffects.healAura.healPerSecond * 100}% 회복
                      </div>
                    )}
                  </div>
                ) : (
                  // 기본 패시브
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${colors.text}`}>{passive.name}</span>
                      <span className="text-xs text-gray-500">(Lv.{PASSIVE_UNLOCK_LEVEL} 해금)</span>
                    </div>
                    <p className="text-sm text-gray-400 leading-relaxed">{passive.description}</p>
                  </div>
                )}
              </div>
            </div>

            {/* 스킬 섹션 */}
            <div className="mb-8">
              <ClassSkillDisplay
                heroClass={selectedBaseClass}
                advancedClass={activeTab === 'advanced' ? selectedAdvancedClass ?? undefined : undefined}
                showAdvancedSkills={activeTab === 'advanced'}
              />
            </div>

            {/* 전직 경로 */}
            <ClassAdvancementPath
              heroClass={selectedBaseClass}
              selectedAdvancedClass={activeTab === 'advanced' ? selectedAdvancedClass ?? undefined : undefined}
              onAdvancedClassSelect={activeTab === 'advanced' ? handleAdvancedClassSelect : undefined}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
