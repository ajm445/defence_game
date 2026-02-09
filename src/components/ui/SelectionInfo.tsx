import React from 'react';
import { useSelectedUnit } from '../../stores/useGameStore';

const STATE_LABELS: Record<string, { text: string; color: string }> = {
  idle: { text: '대기', color: 'text-gray-400' },
  moving: { text: '이동중', color: 'text-neon-blue' },
  attacking: { text: '공격중', color: 'text-neon-red' },
  gathering: { text: '채집중', color: 'text-neon-green' },
};

export const SelectionInfo: React.FC = () => {
  const selectedUnit = useSelectedUnit();

  if (!selectedUnit) return null;

  const stateInfo = STATE_LABELS[selectedUnit.state] || { text: selectedUnit.state, color: 'text-gray-400' };
  const hpPercent = (selectedUnit.hp / selectedUnit.maxHp) * 100;

  return (
    <div className="absolute top-20 left-4 glass-dark rounded-xl border border-neon-cyan/30 animate-slide-up shadow-neon-cyan" style={{ padding: 'clamp(0.5rem, 1.5vw, 1rem)', minWidth: 'clamp(140px, 15vw, 180px)' }}>
      {/* 유닛 이름 */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-neon-cyan animate-pulse" />
        <span className="text-white font-bold">{selectedUnit.config.name}</span>
      </div>

      {/* HP 바 */}
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-400">HP</span>
          <span className="text-gray-300 tabular-nums">
            {Math.floor(selectedUnit.hp)} / {selectedUnit.maxHp}
          </span>
        </div>
        <div className="hp-bar h-2">
          <div
            className="hp-bar-fill player"
            style={{ width: `${hpPercent}%` }}
          />
        </div>
      </div>

      {/* 상태 */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">상태</span>
        <span className={`text-xs font-medium ${stateInfo.color}`}>
          {stateInfo.text}
        </span>
      </div>
    </div>
  );
};
