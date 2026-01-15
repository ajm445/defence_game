import React from 'react';
import { useGameStore, useResources } from '../../stores/useGameStore';
import { useUIStore } from '../../stores/useUIStore';
import { UnitButton } from './UnitButton';
import { UnitType } from '../../types';

const UNIT_TYPES: UnitType[] = ['melee', 'ranged', 'woodcutter', 'miner', 'gatherer', 'goldminer'];

export const UnitPanel: React.FC = () => {
  const spawnUnit = useGameStore((state) => state.spawnUnit);
  const resources = useResources();
  const showNotification = useUIStore((state) => state.showNotification);

  const handleSpawn = (type: UnitType) => {
    const success = spawnUnit(type, 'player');
    if (success) {
      const config: Record<UnitType, string> = { melee: '검병', ranged: '궁수', woodcutter: '나무꾼', miner: '광부', gatherer: '채집꾼', goldminer: '금광부' };
      showNotification(`${config[type]} 고용!`);
    } else {
      showNotification('자원이 부족합니다!');
    }
  };

  return (
    <div className="flex gap-2 flex-1">
      {UNIT_TYPES.map((type) => (
        <UnitButton
          key={type}
          type={type}
          resources={resources}
          onSpawn={() => handleSpawn(type)}
        />
      ))}
    </div>
  );
};
