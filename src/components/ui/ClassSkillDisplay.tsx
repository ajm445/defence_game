import React from 'react';
import { HeroClass, AdvancedHeroClass } from '../../types/rpg';
import { CLASS_SKILLS, ADVANCED_W_SKILLS, ADVANCED_E_SKILLS, AdvancedSkillConfig } from '../../constants/rpgConfig';
import { SKILL_ICON_IMAGES } from '../../constants/skillIconConfig';
import { classColors } from './ClassCard';
import { Emoji } from '../common/Emoji';

interface SkillInfo {
  key: string;
  keyLabel: string;  // 실제 키보드 키
  type: 'auto' | 'skill' | 'ultimate';  // 스킬 타입
  skillType: string; // 스킬 타입 ID (아이콘 매핑용)
  name: string;
  cooldown: number;
  description: string;
  isAdvanced?: boolean;
  isToggle?: boolean;       // 토글 스킬 여부
  reuseCooldown?: number;   // 토글 재사용 딜레이
}

interface ClassSkillDisplayProps {
  heroClass: HeroClass;
  advancedClass?: AdvancedHeroClass;
  showAdvancedSkills?: boolean;
}

export const ClassSkillDisplay: React.FC<ClassSkillDisplayProps> = ({
  heroClass,
  advancedClass,
  showAdvancedSkills = false,
}) => {
  const baseSkills = CLASS_SKILLS[heroClass];
  const colors = classColors[heroClass];

  // 스킬 목록 생성
  const skills: SkillInfo[] = [];

  // W 스킬 (Shift - 일반 스킬)
  if (showAdvancedSkills && advancedClass) {
    const advWSkill = ADVANCED_W_SKILLS[advancedClass] as AdvancedSkillConfig;
    skills.push({
      key: 'W',
      keyLabel: 'Shift',
      type: 'skill',
      skillType: advWSkill.type,
      name: advWSkill.name,
      cooldown: advWSkill.cooldown,
      description: advWSkill.description,
      isAdvanced: true,
    });
  } else {
    skills.push({
      key: 'W',
      keyLabel: 'Shift',
      type: 'skill',
      skillType: baseSkills.w.type,
      name: baseSkills.w.name,
      cooldown: baseSkills.w.cooldown,
      description: baseSkills.w.description,
      isAdvanced: false,
    });
  }

  // E 스킬 (R - 궁극기)
  if (showAdvancedSkills && advancedClass) {
    const advESkill = ADVANCED_E_SKILLS[advancedClass] as AdvancedSkillConfig;
    skills.push({
      key: 'E',
      keyLabel: 'R',
      type: 'ultimate',
      skillType: advESkill.type,
      name: advESkill.name,
      cooldown: advESkill.cooldown,
      description: advESkill.description,
      isAdvanced: true,
      isToggle: advESkill.isToggle,
      reuseCooldown: advESkill.reuseCooldown,
    });
  } else {
    skills.push({
      key: 'E',
      keyLabel: 'R',
      type: 'ultimate',
      skillType: baseSkills.e.type,
      name: baseSkills.e.name,
      cooldown: baseSkills.e.cooldown,
      description: baseSkills.e.description,
      isAdvanced: false,
    });
  }

  // 스킬 타입별 라벨
  const typeLabels: Record<SkillInfo['type'], { label: string; color: string }> = {
    auto: { label: '자동 공격', color: 'text-gray-400' },
    skill: { label: '일반 스킬', color: 'text-blue-400' },
    ultimate: { label: '궁극기', color: 'text-purple-400' },
  };

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-4">
        <Emoji emoji="⚔️" size={18} />
        <h3 className="text-white font-bold">스킬</h3>
        {showAdvancedSkills && advancedClass && (
          <span className="text-xs text-orange-400 ml-2">전직 스킬</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-5">
        {skills.map((skill) => {
          const typeInfo = typeLabels[skill.type];
          return (
            <div
              key={skill.key}
              className={`
                p-5 rounded-xl border transition-all
                ${skill.isAdvanced
                  ? 'border-orange-500/50 bg-orange-500/10'
                  : 'border-gray-600 bg-gray-800/50'}
              `}
            >
              {/* 헤더: 아이콘 + 스킬명 + 키 */}
              <div className="flex items-center gap-3 mb-3">
                {/* 스킬 아이콘 */}
                {SKILL_ICON_IMAGES[skill.skillType] ? (
                  <img
                    src={SKILL_ICON_IMAGES[skill.skillType]}
                    alt={skill.name}
                    className="w-12 h-12 rounded-lg object-cover border border-gray-600 flex-shrink-0"
                    draggable={false}
                  />
                ) : (
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl flex-shrink-0 ${skill.isAdvanced ? 'bg-orange-500/20 border border-orange-500/50' : 'bg-gray-700/50 border border-gray-600'}`}>
                    {skill.type === 'skill' ? <Emoji emoji="⚔️" size={24} /> : <Emoji emoji="💫" size={24} />}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  {/* 스킬명 */}
                  <p className={`font-bold text-base ${skill.isAdvanced ? 'text-orange-300' : 'text-white'}`}>
                    {skill.name}
                    {skill.isAdvanced && <span className="text-orange-400 ml-1">★</span>}
                  </p>
                  {/* 키 + 타입 */}
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`
                      px-2 py-0.5 rounded text-[10px] font-bold
                      ${skill.isAdvanced
                        ? 'bg-orange-500 text-white'
                        : `${colors.bg} ${colors.text} border ${colors.border}`}
                    `}>
                      {skill.keyLabel}
                    </span>
                    <span className={`text-xs ${typeInfo.color}`}>
                      {typeInfo.label}
                    </span>
                  </div>
                </div>
              </div>

              {/* 쿨다운 */}
              <p className="text-sm text-yellow-400 mb-3">
                {skill.isToggle
                  ? `ON/OFF 토글 (재사용 ${skill.reuseCooldown || 0}초)`
                  : `쿨타임: ${skill.cooldown}초`
                }
              </p>

              {/* 설명 */}
              <p className="text-sm text-gray-400 leading-relaxed">
                {skill.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
