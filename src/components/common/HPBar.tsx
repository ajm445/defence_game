import React from 'react';

interface HPBarProps {
  current: number;
  max: number;
  variant?: 'player' | 'enemy';
  showLabel?: boolean;
  label?: string;
}

export const HPBar: React.FC<HPBarProps> = ({
  current,
  max,
  variant = 'player',
  showLabel = true,
  label,
}) => {
  const percent = Math.max(0, Math.min(100, (current / max) * 100));

  const gradients = {
    player: 'bg-gradient-to-r from-green-600 to-green-400',
    enemy: 'bg-gradient-to-r from-red-600 to-orange-500',
  };

  return (
    <div className="w-full">
      {showLabel && label && (
        <div className="text-white text-sm mb-1">{label}</div>
      )}
      <div className="w-full h-5 bg-gray-700 rounded-lg overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${gradients[variant]}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};
