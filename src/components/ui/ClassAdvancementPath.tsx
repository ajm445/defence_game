import React from 'react';
import { HeroClass, AdvancedHeroClass } from '../../types/rpg';
import { CLASS_CONFIGS, ADVANCED_CLASS_CONFIGS, ADVANCEMENT_OPTIONS, JOB_ADVANCEMENT_REQUIREMENTS } from '../../constants/rpgConfig';
import { classColors } from './ClassCard';

interface ClassAdvancementPathProps {
  heroClass: HeroClass;
  selectedAdvancedClass?: AdvancedHeroClass;
  onAdvancedClassSelect?: (advClass: AdvancedHeroClass) => void;
}

export const ClassAdvancementPath: React.FC<ClassAdvancementPathProps> = ({
  heroClass,
  selectedAdvancedClass,
  onAdvancedClassSelect,
}) => {
  const baseConfig = CLASS_CONFIGS[heroClass];
  const advancedOptions = ADVANCEMENT_OPTIONS[heroClass];
  const colors = classColors[heroClass];
  const { minClassLevel, secondEnhancementLevel } = JOB_ADVANCEMENT_REQUIREMENTS;

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">📈</span>
        <h3 className="text-white font-bold">전직 경로</h3>
      </div>

      <div className="relative flex items-center justify-center gap-2">
        {/* 기본 직업 */}
        <div className={`
          flex flex-col items-center p-3 rounded-xl border-2
          ${colors.border} ${colors.bg}
        `}>
          <span className="text-3xl mb-1">{baseConfig.emoji}</span>
          <p className="text-white font-bold text-sm">{baseConfig.name}</p>
          <p className="text-gray-400 text-xs">기본</p>
        </div>

        {/* 화살표 1 */}
        <div className="flex flex-col items-center">
          <div className="flex items-center">
            <div className="w-8 h-0.5 bg-gray-600" />
            <span className="text-gray-400 text-lg">→</span>
            <div className="w-8 h-0.5 bg-gray-600" />
          </div>
          <p className="text-xs text-yellow-400 mt-1">Lv.{minClassLevel}</p>
        </div>

        {/* 1차 전직 옵션들 */}
        <div className="flex flex-col gap-2">
          {advancedOptions.map((advClass) => {
            const advConfig = ADVANCED_CLASS_CONFIGS[advClass];
            const isSelected = selectedAdvancedClass === advClass;

            return (
              <button
                key={advClass}
                onClick={() => onAdvancedClassSelect?.(advClass)}
                className={`
                  flex items-center gap-2 p-2 rounded-lg border-2 transition-all
                  ${isSelected
                    ? 'border-orange-400 bg-orange-500/20 scale-105'
                    : 'border-gray-600 bg-gray-800/50 hover:border-gray-500 hover:bg-gray-800/70'}
                  ${onAdvancedClassSelect ? 'cursor-pointer' : 'cursor-default'}
                `}
              >
                <span className="text-2xl">{advConfig.emoji}</span>
                <div className="text-left">
                  <p className={`font-bold text-sm ${isSelected ? 'text-orange-300' : 'text-white'}`}>
                    {advConfig.name}
                  </p>
                  <p className="text-gray-500 text-xs">{advConfig.nameEn}</p>
                </div>
                {isSelected && (
                  <span className="text-orange-400 ml-1">★</span>
                )}
              </button>
            );
          })}
        </div>

        {/* 화살표 2 */}
        <div className="flex flex-col items-center">
          <div className="flex items-center">
            <div className="w-8 h-0.5 bg-gray-600" />
            <span className="text-gray-400 text-lg">→</span>
            <div className="w-8 h-0.5 bg-gray-600" />
          </div>
          <p className="text-xs text-orange-400 mt-1">Lv.{secondEnhancementLevel}</p>
        </div>

        {/* 2차 강화 */}
        <div className={`
          flex flex-col items-center p-3 rounded-xl border-2 border-dashed
          border-orange-500/50 bg-orange-500/10
        `}>
          <span className="text-2xl mb-1">⭐⭐</span>
          <p className="text-orange-300 font-bold text-sm">2차 강화</p>
          <p className="text-gray-400 text-xs text-center">
            스탯 ×1.2
          </p>
        </div>
      </div>

      {/* 설명 */}
      <div className="mt-4 p-3 bg-gray-800/30 rounded-lg">
        <div className="flex items-start gap-2 text-xs text-gray-400">
          <span className="text-yellow-400">💡</span>
          <div>
            <p className="mb-1">
              <span className="text-yellow-400">Lv.{minClassLevel}</span>에 1차 전직이 가능합니다.
              2가지 전직 중 하나를 선택할 수 있습니다.
            </p>
            <p>
              <span className="text-orange-400">Lv.{secondEnhancementLevel}</span>에 2차 강화로
              모든 스탯이 <span className="text-orange-400">1.2배</span> 증가합니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
