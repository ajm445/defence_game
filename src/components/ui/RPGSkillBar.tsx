import React, { useCallback } from 'react';
import { useHero, useRPGStore } from '../../stores/useRPGStore';
import { Skill, SkillType, HeroClass } from '../../types/rpg';
import { getSkillDescription } from '../../game/rpg/skillSystem';
import { CLASS_SKILLS, CLASS_CONFIGS } from '../../constants/rpgConfig';

interface SkillButtonProps {
  skill: Skill;
  heroClass: HeroClass;
  onUse: () => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}

// 직업별 스킬 아이콘
const getSkillIcon = (skillType: SkillType, _heroClass: HeroClass): string => {
  const iconMap: Record<string, string> = {
    // 기존 스킬
    dash: '💨',
    spin: '🌀',
    heal: '💚',
    // 전사
    warrior_q: '⚔️',
    warrior_w: '💨',
    warrior_e: '🔥',
    // 궁수
    archer_q: '🏹',
    archer_w: '➡️',
    archer_e: '🌧️',
    // 기사
    knight_q: '🛡️',
    knight_w: '💪',
    knight_e: '🏰',
    // 마법사
    mage_q: '✨',
    mage_w: '🔥',
    mage_e: '☄️',
  };
  return iconMap[skillType] || '⭐';
};

// 직업별 스킬 색상
const getSkillColor = (slot: string, heroClass: HeroClass): string => {
  const colorMap: Record<HeroClass, Record<string, string>> = {
    warrior: {
      Q: 'from-red-500/30 to-orange-500/30',
      W: 'from-yellow-500/30 to-orange-500/30',
      E: 'from-red-600/30 to-red-400/30',
    },
    archer: {
      Q: 'from-green-500/30 to-emerald-500/30',
      W: 'from-teal-500/30 to-green-500/30',
      E: 'from-cyan-500/30 to-blue-500/30',
    },
    knight: {
      Q: 'from-blue-500/30 to-cyan-500/30',
      W: 'from-indigo-500/30 to-blue-500/30',
      E: 'from-yellow-500/30 to-amber-500/30',
    },
    mage: {
      Q: 'from-purple-500/30 to-pink-500/30',
      W: 'from-orange-500/30 to-red-500/30',
      E: 'from-violet-500/30 to-purple-500/30',
    },
  };
  return colorMap[heroClass]?.[slot] || 'from-gray-500/30 to-gray-400/30';
};

const SkillButton: React.FC<SkillButtonProps> = ({ skill, heroClass, onUse, onHoverStart, onHoverEnd }) => {
  const isOnCooldown = skill.currentCooldown > 0;
  const isLocked = !skill.unlocked;
  const cooldownPercent = isOnCooldown ? (skill.currentCooldown / skill.cooldown) * 100 : 0;

  const skillIcon = getSkillIcon(skill.type, heroClass);
  const skillColor = getSkillColor(skill.key, heroClass);

  return (
    <div
      className="relative group"
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
    >
      <button
        onClick={onUse}
        disabled={isOnCooldown || isLocked}
        className={`
          relative w-14 h-14 rounded-lg border-2 overflow-hidden
          transition-all duration-200
          ${isLocked
            ? 'bg-dark-800/80 border-dark-600 cursor-not-allowed'
            : isOnCooldown
              ? 'bg-dark-700/80 border-dark-500 cursor-not-allowed'
              : `bg-gradient-to-br ${skillColor} border-neon-cyan/50 hover:border-neon-cyan hover:scale-105 cursor-pointer`
          }
        `}
      >
        {/* 쿨다운 오버레이 */}
        {isOnCooldown && (
          <div
            className="absolute bottom-0 left-0 right-0 bg-dark-900/80 transition-all"
            style={{ height: `${cooldownPercent}%` }}
          />
        )}

        {/* 잠금 오버레이 */}
        {isLocked && (
          <div className="absolute inset-0 bg-dark-900/60 flex items-center justify-center">
            <span className="text-2xl">🔒</span>
          </div>
        )}

        {/* 스킬 아이콘 */}
        <div className="relative z-10 flex flex-col items-center justify-center h-full">
          <span className="text-2xl">{skillIcon}</span>
          <span className="text-[10px] text-white/70 font-bold">{skill.key}</span>
        </div>

        {/* 쿨다운 텍스트 */}
        {isOnCooldown && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <span className="text-lg font-bold text-white drop-shadow-lg">
              {Math.ceil(skill.currentCooldown)}
            </span>
          </div>
        )}

        {/* 레벨 표시 */}
        {!isLocked && skill.level > 1 && (
          <div className="absolute top-0 right-0 bg-neon-cyan/80 text-dark-900 text-[10px] font-bold px-1 rounded-bl">
            Lv{skill.level}
          </div>
        )}
      </button>

      {/* 툴팁 */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
        <div className="bg-dark-800/95 border border-dark-500 rounded-lg px-3 py-2 whitespace-nowrap text-center min-w-[140px]">
          <div className="font-bold text-white">{skill.name}</div>
          <div className="text-xs text-gray-400 mt-1 max-w-[180px] whitespace-normal">
            {isLocked ? `레벨 ${skill.unlockedAtLevel}에서 해금` : getSkillDescription(skill)}
          </div>
          <div className="text-xs text-neon-cyan mt-1">
            쿨타임: {skill.cooldown}초
          </div>
        </div>
      </div>
    </div>
  );
};

interface RPGSkillBarProps {
  onUseSkill: (skillType: SkillType) => void;
}

// 스킬 타입에 따른 사거리 정보 계산
function getSkillRangeInfo(
  skillType: SkillType,
  heroClass: HeroClass
): { type: 'circle' | 'line' | 'aoe' | null; range: number; radius?: number } | null {
  const classConfig = CLASS_CONFIGS[heroClass];
  const classSkills = CLASS_SKILLS[heroClass];
  const baseRange = classConfig.range;

  // Q 스킬: 기본 공격 - 사거리 표시 없음 (C 키로 표시 가능)
  if (skillType.endsWith('_q')) {
    return null;
  }

  // W 스킬: 돌진/관통/범위 스킬
  if (skillType.endsWith('_w')) {
    const wSkill = classSkills.w as { distance?: number; pierceDistance?: number; radius?: number };
    if (wSkill.distance) {
      // 돌진 스킬 (전사, 기사)
      return { type: 'line', range: wSkill.distance };
    }
    if (wSkill.pierceDistance) {
      // 관통 스킬 (궁수)
      return { type: 'line', range: wSkill.pierceDistance };
    }
    if (wSkill.radius) {
      // 범위 스킬 (마법사 화염구)
      return { type: 'circle', range: baseRange, radius: wSkill.radius };
    }
  }

  // E 스킬: 궁극기
  if (skillType.endsWith('_e')) {
    const eSkill = classSkills.e as { radius?: number; duration?: number };
    if (eSkill.radius) {
      // 범위 스킬 (궁수 화살비, 마법사 운석) - 무제한 사거리, 마우스 위치에 AoE만 표시
      return { type: 'aoe', range: 0, radius: eSkill.radius };
    }
    // 버프 스킬 (전사 광전사, 기사 철벽)은 사거리 표시 없음
    return null;
  }

  return null;
}

export const RPGSkillBar: React.FC<RPGSkillBarProps> = ({ onUseSkill }) => {
  const hero = useHero();

  const handleSkillHoverStart = useCallback((skillType: SkillType, heroClass: HeroClass) => {
    const rangeInfo = getSkillRangeInfo(skillType, heroClass);
    useRPGStore.getState().setHoveredSkillRange(rangeInfo);
  }, []);

  const handleSkillHoverEnd = useCallback(() => {
    useRPGStore.getState().setHoveredSkillRange(null);
  }, []);

  if (!hero) return null;

  return (
    <div className="flex gap-2 bg-dark-800/90 backdrop-blur-sm rounded-xl p-3 border border-dark-600/50">
      <div className="text-xs text-gray-400 uppercase tracking-wider self-center mr-2">
        스킬
      </div>
      {hero.skills.map((skill) => (
        <SkillButton
          key={skill.type}
          skill={skill}
          heroClass={hero.heroClass}
          onUse={() => onUseSkill(skill.type)}
          onHoverStart={() => handleSkillHoverStart(skill.type, hero.heroClass)}
          onHoverEnd={handleSkillHoverEnd}
        />
      ))}
    </div>
  );
};
