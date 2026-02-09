import React from 'react';
import { VirtualJoystick } from './VirtualJoystick';
import { TouchSkillButtons } from './TouchSkillButtons';
import { TouchUpgradeToggle } from './TouchUpgradeToggle';
import { SkillType } from '../../types/rpg';

interface RPGTouchControlsProps {
  requestSkill: (skillType: SkillType) => boolean;
  onUseSkill: (skillType: SkillType) => void;
}

export const RPGTouchControls: React.FC<RPGTouchControlsProps> = ({ requestSkill, onUseSkill }) => {
  return (
    <>
      {/* 가상 조이스틱 - 왼쪽 하단 (자체 포지셔닝) */}
      <VirtualJoystick />

      {/* 오른쪽 하단: 업그레이드 토글(좌) + 스킬 버튼(우) - 항상 표시 */}
      <div
        className="absolute right-4 bottom-8 z-40 flex items-end"
        style={{ gap: 8 }}
      >
        <TouchUpgradeToggle />
        <TouchSkillButtons
          requestSkill={requestSkill}
          onUseSkill={onUseSkill}
        />
      </div>
    </>
  );
};
