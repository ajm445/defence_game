import React, { useCallback, useMemo } from 'react';
import { useHero, useRPGStore } from '../../stores/useRPGStore';
import { Skill, SkillType, HeroClass, AdvancedHeroClass, HeroUnit, RPGEnemy } from '../../types/rpg';
import { getSkillDescription } from '../../game/rpg/skillSystem';
import { CLASS_SKILLS, CLASS_CONFIGS, ADVANCED_W_SKILLS, ADVANCED_E_SKILLS } from '../../constants/rpgConfig';
import { distance } from '../../utils/math';

interface SkillButtonProps {
  skill: Skill;
  heroClass: HeroClass;
  onUse: () => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  disabled?: boolean;  // 타겟 없음 등의 이유로 비활성화
  disabledReason?: string;  // 비활성화 이유
  active?: boolean;  // 토글 스킬 활성화 상태
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
    knight_q: '💪',
    knight_w: '🛡️',
    knight_e: '🏰',
    // 마법사
    mage_q: '✨',
    mage_w: '🔥',
    mage_e: '☄️',
    // 전직 W 스킬
    blood_rush: '🩸',      // 버서커 - 피의 돌진
    guardian_rush: '🛡️',   // 가디언 - 수호의 돌진
    backflip_shot: '🔙',   // 저격수 - 후방 도약
    multi_arrow: '🏹',     // 레인저 - 다중 화살
    holy_charge: '✝️',     // 팔라딘 - 신성한 돌진
    shadow_slash: '🗡️',    // 다크나이트 - 암흑 베기 (레거시)
    heavy_strike: '⚔️',    // 다크나이트 - 강타
    inferno: '🔥',         // 대마법사 - 폭발 화염구
    healing_light: '💚',   // 힐러 - 치유의 빛
    // 전직 E 스킬
    rage: '😡',            // 버서커 - 광란
    shield: '🛡️',          // 가디언 - 보호막
    snipe: '🎯',           // 저격수 - 저격
    arrow_storm: '🌪️',     // 레인저 - 화살 폭풍
    divine_light: '☀️',    // 팔라딘 - 신성한 빛
    dark_blade: '⚫',      // 다크나이트 - 어둠의 칼날
    meteor_shower: '☄️',   // 대마법사 - 메테오 샤워
    spring_of_life: '💧',  // 힐러 - 생명의 샘
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

// 스킬 키 표시 변환 (W -> Shift, E -> R)
const getDisplayKey = (key: string): string => {
  if (key === 'W') return 'Shift';
  if (key === 'E') return 'R';
  return key;
};

// 스킬 타입 이름 표시 (W -> 스킬, E -> 궁극기)
const getSkillLabel = (key: string): string => {
  if (key === 'W') return '스킬';
  if (key === 'E') return '궁극기';
  return key;
};

const SkillButton: React.FC<SkillButtonProps> = ({ skill, heroClass, onUse, onHoverStart, onHoverEnd, disabled, disabledReason, active }) => {
  const isOnCooldown = skill.currentCooldown > 0;
  const cooldownPercent = isOnCooldown ? (skill.currentCooldown / skill.cooldown) * 100 : 0;
  const isDisabled = active ? false : (isOnCooldown || disabled);

  const skillIcon = getSkillIcon(skill.type, heroClass);
  const skillColor = getSkillColor(skill.key, heroClass);
  const displayKey = getDisplayKey(skill.key);

  return (
    <div
      className="relative group"
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
    >
      <button
        onClick={onUse}
        disabled={isDisabled}
        className={`
          relative w-14 h-14 rounded-lg border-2 overflow-hidden
          transition-all duration-200
          ${active
            ? 'bg-gradient-to-br from-purple-600/50 to-purple-900/50 border-purple-400 shadow-[0_0_12px_rgba(147,51,234,0.5)] cursor-pointer'
            : isDisabled
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

        {/* 스킬 아이콘 */}
        <div className="relative z-10 flex flex-col items-center justify-center h-full">
          <span className="text-2xl">{skillIcon}</span>
          <span className="text-[10px] text-white/70 font-bold">{displayKey}</span>
        </div>

        {/* 쿨다운 텍스트 */}
        {isOnCooldown && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <span className="text-lg font-bold text-white drop-shadow-lg">
              {Math.ceil(skill.currentCooldown)}
            </span>
          </div>
        )}

        {/* 토글 활성 표시 */}
        {active && (
          <div className="absolute top-0 left-0 bg-purple-500 text-white text-[10px] font-bold px-1 rounded-br animate-pulse">
            ON
          </div>
        )}

        {/* 레벨 표시 */}
        {skill.level > 1 && (
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
            {getSkillDescription(skill)}
          </div>
          <div className="text-xs text-neon-cyan mt-1">
            쿨타임: {skill.cooldown}초
          </div>
          {disabled && disabledReason && (
            <div className="text-xs text-red-400 mt-1">
              {disabledReason}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 스나이퍼 E 스킬 타겟 존재 여부 체크
function checkSniperTarget(hero: HeroUnit, enemies: RPGEnemy[], mouseX: number, mouseY: number): boolean {
  const targetAngle = Math.atan2(mouseY - hero.y, mouseX - hero.x);

  for (const enemy of enemies) {
    if (enemy.hp <= 0) continue;
    const enemyAngle = Math.atan2(enemy.y - hero.y, enemy.x - hero.x);
    const angleDiff = Math.abs(enemyAngle - targetAngle);
    const normalizedDiff = Math.min(angleDiff, 2 * Math.PI - angleDiff);

    if (normalizedDiff < Math.PI / 6) {  // 30도 이내
      return true;
    }
  }
  return false;
}

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

  // 전직 W 스킬 사거리 정보
  for (const [advClass, skillConfig] of Object.entries(ADVANCED_W_SKILLS)) {
    if (skillConfig.type === skillType) {
      if (skillConfig.distance) {
        // 돌진 스킬 (버서커, 가디언, 팔라딘, 다크나이트, 저격수)
        return { type: 'line', range: skillConfig.distance };
      }
      if (skillConfig.radius) {
        // 범위 스킬 (대마법사 화염구, 힐러 치유의 빛, 레인저 다중화살)
        return { type: 'circle', range: baseRange, radius: skillConfig.radius };
      }
      return null;
    }
  }

  // 전직 E 스킬 사거리 정보
  for (const [advClass, skillConfig] of Object.entries(ADVANCED_E_SKILLS)) {
    if (skillConfig.type === skillType) {
      if (skillConfig.radius) {
        // 범위 스킬 - 무제한 사거리, 마우스 위치에 AoE 표시
        return { type: 'aoe', range: 0, radius: skillConfig.radius };
      }
      // 버프 스킬 (버서커 광란, 레인저 화살 폭풍 등)은 사거리 표시 없음
      return null;
    }
  }

  return null;
}

export const RPGSkillBar: React.FC<RPGSkillBarProps> = ({ onUseSkill }) => {
  const hero = useHero();
  const enemies = useRPGStore((state) => state.enemies);
  const mousePosition = useRPGStore((state) => state.mousePosition);

  const handleSkillHoverStart = useCallback((skillType: SkillType, heroClass: HeroClass) => {
    const rangeInfo = getSkillRangeInfo(skillType, heroClass);
    useRPGStore.getState().setHoveredSkillRange(rangeInfo);
  }, []);

  const handleSkillHoverEnd = useCallback(() => {
    useRPGStore.getState().setHoveredSkillRange(null);
  }, []);

  // 스나이퍼 E 스킬 타겟 체크
  const hasSniperTarget = useMemo(() => {
    if (!hero || hero.advancedClass !== 'sniper') return true;
    return checkSniperTarget(hero, enemies, mousePosition.x, mousePosition.y);
  }, [hero, enemies, mousePosition.x, mousePosition.y]);

  if (!hero) return null;

  // Q 스킬 제외 (자동 공격이므로), W와 E만 표시
  const displaySkills = hero.skills.filter(skill => skill.key === 'W' || skill.key === 'E');

  // 스킬별 비활성화 상태 계산
  const getSkillDisabledState = (skill: Skill): { disabled: boolean; reason?: string } => {
    // 스나이퍼 E 스킬: 타겟 없으면 비활성화
    if (hero.advancedClass === 'sniper' && skill.key === 'E' && !hasSniperTarget) {
      return { disabled: true, reason: '타겟 없음 (마우스 방향 30도 내)' };
    }
    return { disabled: false };
  };

  return (
    <>
      {displaySkills.map((skill) => {
        const { disabled, reason } = getSkillDisabledState(skill);
        return (
          <div key={skill.type} className="flex flex-col items-center gap-1">
            <div className="text-[10px] text-gray-400 font-medium">
              {getSkillLabel(skill.key)}
            </div>
            <SkillButton
              skill={skill}
              heroClass={hero.heroClass}
              onUse={() => onUseSkill(skill.type)}
              onHoverStart={() => handleSkillHoverStart(skill.type, hero.heroClass)}
              onHoverEnd={handleSkillHoverEnd}
              disabled={disabled}
              disabledReason={reason}
              active={skill.type === 'dark_blade' && hero.darkBladeActive}
            />
          </div>
        );
      })}
    </>
  );
};
