import React from 'react';
import { useResources, useGameStore } from '../../stores/useGameStore';
import { useMultiplayerStore } from '../../stores/useMultiplayerStore';

const RESOURCE_CONFIG = [
  { key: 'gold', icon: '💰', label: 'GOLD', color: 'from-yellow-500 to-amber-600', glow: 'shadow-[0_0_10px_rgba(251,191,36,0.3)]' },
  { key: 'wood', icon: '🪵', label: 'WOOD', color: 'from-amber-600 to-amber-800', glow: 'shadow-[0_0_10px_rgba(161,98,7,0.3)]' },
  { key: 'stone', icon: '🪨', label: 'STONE', color: 'from-gray-400 to-gray-600', glow: 'shadow-[0_0_10px_rgba(107,114,128,0.3)]' },
  { key: 'herb', icon: '🌿', label: 'HERB', color: 'from-green-400 to-green-600', glow: 'shadow-[0_0_10px_rgba(34,197,94,0.3)]' },
  { key: 'crystal', icon: '💎', label: 'CRYS', color: 'from-purple-400 to-purple-600', glow: 'shadow-[0_0_10px_rgba(168,85,247,0.3)]' },
] as const;

export const ResourceBar: React.FC = () => {
  const gameMode = useGameStore((state) => state.gameMode);
  const singlePlayerResources = useResources();
  const gameState = useMultiplayerStore((state) => state.gameState);
  const mySide = useMultiplayerStore((state) => state.mySide);

  // 멀티플레이어 모드에서는 서버 상태의 자원 사용
  const resources = gameMode === 'multiplayer' && gameState && mySide
    ? (mySide === 'left' ? gameState.leftPlayer.resources : gameState.rightPlayer.resources)
    : singlePlayerResources;

  return (
    <div className="absolute top-4 left-4 flex gap-2">
      {RESOURCE_CONFIG.map(({ key, icon, label, color, glow }) => (
        <div
          key={key}
          className={`
            glass-dark rounded-xl px-3 py-2 flex items-center gap-2
            border border-dark-500/50 hover:border-dark-400 transition-all duration-200
            ${glow}
          `}
        >
          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center text-lg shadow-lg`}>
            {icon}
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-500 tracking-wider">{label}</span>
            <span className="text-white font-bold text-sm tabular-nums">
              {Math.floor(resources[key])}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};
