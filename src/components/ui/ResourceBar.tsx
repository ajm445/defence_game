import React from 'react';
import { useResources, useGameStore } from '../../stores/useGameStore';
import { useSmoothResources } from '../../hooks/useSmoothResources';
import { Emoji } from '../common/Emoji';

const RESOURCE_CONFIG = [
  { key: 'gold', icon: '💰', label: 'GOLD', color: 'from-yellow-500 to-amber-600', glow: 'shadow-[0_0_10px_rgba(251,191,36,0.3)]', useSmooth: true },
  { key: 'wood', icon: '🪵', label: 'WOOD', color: 'from-amber-600 to-amber-800', glow: 'shadow-[0_0_10px_rgba(161,98,7,0.3)]', useSmooth: false },
  { key: 'stone', icon: '🪨', label: 'STONE', color: 'from-gray-400 to-gray-600', glow: 'shadow-[0_0_10px_rgba(107,114,128,0.3)]', useSmooth: false },
  { key: 'herb', icon: '🌿', label: 'HERB', color: 'from-green-400 to-green-600', glow: 'shadow-[0_0_10px_rgba(34,197,94,0.3)]', useSmooth: false },
  { key: 'crystal', icon: '💎', label: 'CRYS', color: 'from-purple-400 to-purple-600', glow: 'shadow-[0_0_10px_rgba(168,85,247,0.3)]', useSmooth: false },
] as const;

export const ResourceBar: React.FC = () => {
  const gameMode = useGameStore((state) => state.gameMode);
  const singlePlayerResources = useResources();
  const smoothResources = useSmoothResources();

  // 멀티플레이어 모드에서는 부드럽게 보간된 자원 사용
  const isMultiplayer = gameMode === 'multiplayer';

  // 자원 값 가져오기
  const getResourceValue = (key: string, useSmooth: boolean): number => {
    if (isMultiplayer) {
      if (key === 'gold' && useSmooth) {
        return smoothResources.displayGold;
      }
      return smoothResources[key as keyof typeof smoothResources] as number;
    }
    return singlePlayerResources[key as keyof typeof singlePlayerResources];
  };

  return (
    <div className="absolute top-4 left-4 flex gap-2">
      {RESOURCE_CONFIG.map(({ key, icon, label, color, glow, useSmooth }) => (
        <div
          key={key}
          className={`
            glass-dark rounded-xl px-3 py-2 flex items-center gap-2
            border border-dark-500/50 hover:border-dark-400 transition-all duration-200
            ${glow}
          `}
        >
          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center shadow-lg`}>
            <Emoji emoji={icon} size={20} />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-500 tracking-wider">{label}</span>
            <span className="text-white font-bold text-sm tabular-nums">
              {Math.floor(getResourceValue(key, useSmooth))}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};
