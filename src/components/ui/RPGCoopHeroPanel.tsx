import React from 'react';
import { useCoopHeroes, useRPGCoopStore } from '../../stores/useRPGCoopStore';
import { CLASS_CONFIGS } from '../../constants/rpgConfig';
import type { NetworkCoopHero } from '@shared/types/rpgNetwork';

export const RPGCoopHeroPanel: React.FC = () => {
  const heroes = useCoopHeroes();
  const myHeroId = useRPGCoopStore((state) => state.myHeroId);
  const players = useRPGCoopStore((state) => state.players);

  // 내 영웅을 맨 위에 표시
  const sortedHeroes = [...heroes].sort((a, b) => {
    if (a.id === myHeroId) return -1;
    if (b.id === myHeroId) return 1;
    return 0;
  });

  return (
    <div className="space-y-2">
      {sortedHeroes.map((hero) => {
        const player = players.find(p => p.id === hero.playerId);
        return (
          <HeroPanelItem
            key={hero.id}
            hero={hero}
            playerName={player?.name || 'Unknown'}
            isMe={hero.id === myHeroId}
          />
        );
      })}
    </div>
  );
};

interface HeroPanelItemProps {
  hero: NetworkCoopHero;
  playerName: string;
  isMe: boolean;
}

const HeroPanelItem: React.FC<HeroPanelItemProps> = ({ hero, playerName, isMe }) => {
  const config = CLASS_CONFIGS[hero.heroClass];
  const hpPercent = (hero.hp / hero.maxHp) * 100;
  const expPercent = (hero.exp / hero.expToNextLevel) * 100;

  return (
    <div
      className={`bg-dark-800/90 backdrop-blur-sm rounded-lg p-3 border min-w-[200px] ${
        isMe ? 'border-neon-cyan' : 'border-dark-600/50'
      } ${hero.isDead ? 'opacity-60' : ''}`}
    >
      {/* 헤더: 이름 + 레벨 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{config.emoji}</span>
          <div>
            <p className={`font-bold text-sm ${isMe ? 'text-neon-cyan' : 'text-white'}`}>
              {playerName}
              {isMe && <span className="ml-1 text-xs text-gray-500">(나)</span>}
            </p>
            <p className="text-gray-500 text-xs">{config.name}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-yellow-400 font-bold text-sm">Lv.{hero.level}</p>
        </div>
      </div>

      {/* HP 바 */}
      <div className="mb-1">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-400">HP</span>
          <span className={hero.isDead ? 'text-red-400' : 'text-white'}>
            {hero.isDead ? '사망' : `${Math.floor(hero.hp)} / ${hero.maxHp}`}
          </span>
        </div>
        <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-200 ${
              hero.isDead
                ? 'bg-gray-600'
                : hpPercent > 50
                ? 'bg-green-500'
                : hpPercent > 25
                ? 'bg-yellow-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${hero.isDead ? 0 : hpPercent}%` }}
          />
        </div>
      </div>

      {/* 경험치 바 */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-400">EXP</span>
          <span className="text-blue-400">
            {hero.exp} / {hero.expToNextLevel}
          </span>
        </div>
        <div className="h-1.5 bg-dark-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-200"
            style={{ width: `${expPercent}%` }}
          />
        </div>
      </div>

      {/* 부활 타이머 (사망 시) */}
      {hero.isDead && hero.reviveTimer > 0 && (
        <div className="mt-2 text-center">
          <span className="text-red-400 text-sm">
            부활까지 {Math.ceil(hero.reviveTimer)}초
          </span>
        </div>
      )}

      {/* 버프 표시 */}
      {hero.buffs.length > 0 && (
        <div className="mt-2 flex gap-1">
          {hero.buffs.map((buff, index) => (
            <div
              key={`${buff.type}-${index}`}
              className="px-1.5 py-0.5 bg-dark-700 rounded text-xs"
              title={buff.type}
            >
              {getBuffIcon(buff.type)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function getBuffIcon(buffType: string): string {
  switch (buffType) {
    case 'berserker':
      return '🔥';
    case 'ironwall':
      return '🛡️';
    case 'invincible':
      return '⭐';
    case 'stun':
      return '💫';
    default:
      return '✨';
  }
}
