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
    <div className="absolute flex" style={{ top: 'max(1rem, env(safe-area-inset-top, 0px))', left: 'max(1rem, env(safe-area-inset-left, 0px))', gap: 'clamp(0.25rem, 0.6vw, 0.5rem)' }} data-tutorial-id="resource-bar">
      {RESOURCE_CONFIG.map(({ key, icon, label, color, glow, useSmooth }) => (
        <div
          key={key}
          className={`glass-dark rounded-xl flex items-center border border-dark-500/50 hover:border-dark-400 transition-all duration-200 ${glow}`}
          style={{ padding: 'clamp(0.25rem, 0.6vw, 0.5rem) clamp(0.5rem, 1vw, 0.75rem)', gap: 'clamp(0.25rem, 0.5vw, 0.5rem)' }}
        >
          <div
            className={`rounded-lg bg-gradient-to-br ${color} flex items-center justify-center shadow-lg`}
            style={{ width: 'clamp(1.5rem, 2.5vw, 2rem)', height: 'clamp(1.5rem, 2.5vw, 2rem)' }}
          >
            <Emoji emoji={icon} size={16} />
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
