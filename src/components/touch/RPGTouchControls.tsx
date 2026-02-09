import React from 'react';
import { VirtualJoystick } from './VirtualJoystick';
import { TouchSkillButtons } from './TouchSkillButtons';
import { TouchUpgradeToggle } from './TouchUpgradeToggle';
import { SkillType } from '../../types/rpg';
import { useUIStore } from '../../stores/useUIStore';

interface RPGTouchControlsProps {
  requestSkill: (skillType: SkillType) => boolean;
  onUseSkill: (skillType: SkillType) => void;
}

export const RPGTouchControls: React.FC<RPGTouchControlsProps> = ({ requestSkill, onUseSkill }) => {
  const isTablet = useUIStore((s) => s.isTablet);

  return (
    <>
      {/* 가상 조이스틱 - 왼쪽 하단 (자체 포지셔닝) */}
      <VirtualJoystick />

      {/* 스킬 버튼(W/E) - 가로 배치, 우측 중앙 하단 */}
      <div
        className="absolute z-40"
        style={isTablet
          ? { right: '18%', bottom: '10%' }
          : { right: '20%', bottom: '12%' }
        }
      >
        <TouchSkillButtons
          requestSkill={requestSkill}
          onUseSkill={onUseSkill}
        />
      </div>

      {/* 업그레이드 버튼 - 우측 하단 (미니맵과 겹치지 않도록) */}
      <div
        className="absolute z-40"
        style={isTablet
          ? { right: 12, bottom: '10%' }
          : { right: 12, bottom: '14%' }
        }
      >
        <TouchUpgradeToggle />
      </div>
    </>
  );
};
