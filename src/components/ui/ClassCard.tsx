import React from 'react';
import { HeroClass, AdvancedHeroClass } from '../../types/rpg';
import { CLASS_CONFIGS, ADVANCED_CLASS_CONFIGS } from '../../constants/rpgConfig';

// 클래스별 색상 테마
export const classColors: Record<HeroClass, { bg: string; border: string; text: string; gradient: string; glow: string }> = {
  warrior: {
    bg: 'bg-red-500/20',
    border: 'border-red-500',
    text: 'text-red-400',
    gradient: 'from-red-500/20 to-orange-500/20',
    glow: 'shadow-[0_0_15px_rgba(239,68,68,0.3)]',
  },
  archer: {
    bg: 'bg-green-500/20',
    border: 'border-green-500',
    text: 'text-green-400',
    gradient: 'from-green-500/20 to-emerald-500/20',
    glow: 'shadow-[0_0_15px_rgba(34,197,94,0.3)]',
  },
  knight: {
    bg: 'bg-blue-500/20',
    border: 'border-blue-500',
    text: 'text-blue-400',
    gradient: 'from-blue-500/20 to-cyan-500/20',
    glow: 'shadow-[0_0_15px_rgba(59,130,246,0.3)]',
  },
  mage: {
    bg: 'bg-purple-500/20',
    border: 'border-purple-500',
    text: 'text-purple-400',
    gradient: 'from-purple-500/20 to-pink-500/20',
    glow: 'shadow-[0_0_15px_rgba(168,85,247,0.3)]',
  },
};

interface ClassCardProps {
  heroClass: HeroClass;
  advancedClass?: AdvancedHeroClass;
  isSelected: boolean;
  isLocked: boolean;
  unlockLevel: number;
  onClick: () => void;
  size?: 'small' | 'medium';
}

export const ClassCard: React.FC<ClassCardProps> = ({
  heroClass,
  advancedClass,
  isSelected,
  isLocked,
  unlockLevel,
  onClick,
  size = 'medium',
}) => {
  const baseConfig = CLASS_CONFIGS[heroClass];
  const advConfig = advancedClass ? ADVANCED_CLASS_CONFIGS[advancedClass] : null;
  const colors = classColors[heroClass];

  const displayName = advConfig ? advConfig.name : baseConfig.name;
  const displayEmoji = advConfig ? advConfig.emoji : baseConfig.emoji;
  const displayNameEn = advConfig ? advConfig.nameEn : baseConfig.nameEn;

  const sizeClasses = size === 'small'
    ? 'w-28 h-36 p-2'
    : 'w-36 h-44 p-3';

  const emojiSize = size === 'small' ? 'text-3xl' : 'text-4xl';
  const nameSize = size === 'small' ? 'text-sm' : 'text-base';
  const subTextSize = size === 'small' ? 'text-[10px]' : 'text-xs';

  return (
    <button
      onClick={onClick}
      disabled={isLocked}
      className={`
        group relative ${sizeClasses} rounded-xl overflow-hidden
        transition-all duration-200
        ${isLocked
          ? 'cursor-not-allowed opacity-60'
          : 'hover:scale-105 active:scale-95 cursor-pointer'}
        ${isSelected && !isLocked ? `${colors.glow} scale-105` : ''}
      `}
    >
      {/* 배경 그라데이션 */}
      <div className={`absolute inset-0 bg-gradient-to-b ${colors.gradient} ${!isLocked ? 'group-hover:opacity-150' : ''} transition-opacity`} />

      {/* 테두리 */}
      <div className={`
        absolute inset-0 border-2 rounded-xl transition-all
        ${isLocked ? 'border-gray-700' : isSelected ? colors.border : 'border-gray-600 group-hover:border-gray-500'}
      `} />

      {/* 잠금 오버레이 */}
      {isLocked && (
        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center z-10 rounded-xl">
          <span className="text-2xl mb-1">🔒</span>
          <p className="text-gray-300 text-xs font-bold">Lv.{unlockLevel}</p>
        </div>
      )}

      {/* 선택 표시 */}
      {isSelected && !isLocked && (
        <div className="absolute top-2 right-2 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center z-20">
          <span className="text-white text-xs">✓</span>
        </div>
      )}

      {/* 컨텐츠 */}
      <div className={`relative h-full flex flex-col items-center justify-center ${isLocked ? 'opacity-50' : ''}`}>
        {/* 이모지 아이콘 */}
        <div className={`${emojiSize} mb-2 transform ${!isLocked ? 'group-hover:scale-110' : ''} transition-transform`}>
          {displayEmoji}
        </div>

        {/* 직업명 */}
        <h3 className={`font-bold ${nameSize} text-white`}>{displayName}</h3>
        <p className={`text-gray-400 ${subTextSize}`}>{displayNameEn}</p>

        {/* 해금 레벨 표시 */}
        {!isLocked && unlockLevel > 1 && (
          <p className={`${subTextSize} ${colors.text} mt-1`}>Lv.{unlockLevel} 해금</p>
        )}
        {!isLocked && unlockLevel === 1 && (
          <p className={`${subTextSize} text-gray-500 mt-1`}>기본 캐릭터</p>
        )}
      </div>
    </button>
  );
};
