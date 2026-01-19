import React from 'react';
import { UnitType, Resources } from '../../types';
import { CONFIG } from '../../constants/config';

interface UnitButtonProps {
  type: UnitType;
  resources: Resources;
  onSpawn: () => void;
  cooldown?: number; // 남은 쿨타임 (초)
}

const UNIT_CONFIG: Record<UnitType, { icon: string; name: string; color: string }> = {
  melee: { icon: '⚔️', name: '검병', color: 'from-red-500 to-red-700' },
  ranged: { icon: '🏹', name: '궁수', color: 'from-green-500 to-green-700' },
  knight: { icon: '🛡️', name: '기사', color: 'from-blue-500 to-blue-700' },
  woodcutter: { icon: '🪓', name: '나무꾼', color: 'from-amber-500 to-amber-700' },
  miner: { icon: '⛏️', name: '광부', color: 'from-gray-400 to-gray-600' },
  gatherer: { icon: '🧺', name: '채집꾼', color: 'from-emerald-400 to-emerald-600' },
  goldminer: { icon: '💰', name: '금광부', color: 'from-yellow-400 to-yellow-600' },
  healer: { icon: '💚', name: '힐러', color: 'from-pink-400 to-pink-600' },
  mage: { icon: '🔮', name: '마법사', color: 'from-purple-500 to-purple-700' },
};

export const UnitButton: React.FC<UnitButtonProps> = ({
  type,
  resources,
  onSpawn,
  cooldown = 0,
}) => {
  const config = CONFIG.UNITS[type];
  const unitInfo = UNIT_CONFIG[type];
  const maxCooldown = config.spawnCooldown || 1;

  // 쿨타임 중인지 확인
  const isOnCooldown = cooldown > 0;

  // 비용 확인
  const canAfford = Object.entries(config.cost).every(
    ([resource, amount]) => resources[resource as keyof Resources] >= (amount || 0)
  );

  // 소환 가능 여부 (비용 충분 + 쿨타임 아님)
  const canSpawn = canAfford && !isOnCooldown;

  // 비용 문자열 생성
  const costItems = Object.entries(config.cost).map(([resource, amount]) => {
    const icons: Record<string, string> = {
      gold: '💰',
      wood: '🪵',
      stone: '🪨',
      herb: '🌿',
      crystal: '💎',
    };
    return { icon: icons[resource] || '', amount };
  });

  // 쿨타임 진행률 (0~1)
  const cooldownProgress = isOnCooldown ? cooldown / maxCooldown : 0;

  return (
    <button
      onClick={onSpawn}
      disabled={!canSpawn}
      className={`
        group relative w-20 h-24 rounded-xl overflow-hidden
        transition-all duration-200
        ${canSpawn
          ? 'hover:scale-105 hover:-translate-y-1 cursor-pointer'
          : 'cursor-not-allowed'
        }
        ${!canAfford && !isOnCooldown ? 'opacity-40' : ''}
      `}
    >
      {/* 배경 */}
      <div className="absolute inset-0 bg-dark-700/80" />
      <div className={`
        absolute inset-0 bg-gradient-to-b ${unitInfo.color} opacity-20
        ${canSpawn ? 'group-hover:opacity-30' : ''}
        transition-opacity duration-200
      `} />

      {/* 테두리 */}
      <div className={`
        absolute inset-0 border-2 rounded-xl transition-all duration-200
        ${canSpawn
          ? 'border-dark-400 group-hover:border-neon-cyan group-hover:shadow-neon-cyan'
          : isOnCooldown
            ? 'border-neon-cyan/30'
            : 'border-dark-600'
        }
      `} />

      {/* 쿨타임 오버레이 */}
      {isOnCooldown && (
        <div
          className="absolute inset-0 bg-dark-900/70 transition-all"
          style={{
            clipPath: `inset(${(1 - cooldownProgress) * 100}% 0 0 0)`,
          }}
        />
      )}

      {/* 컨텐츠 */}
      <div className="relative h-full flex flex-col items-center justify-center p-2">
        {/* 아이콘 */}
        <div className={`
          text-3xl mb-1 transition-transform duration-200
          ${canSpawn ? 'group-hover:scale-110' : ''}
          ${isOnCooldown ? 'opacity-50' : ''}
        `}>
          {unitInfo.icon}
        </div>

        {/* 이름 또는 쿨타임 */}
        {isOnCooldown ? (
          <div className="text-sm text-neon-cyan font-bold tabular-nums">
            {cooldown.toFixed(1)}s
          </div>
        ) : (
          <div className="text-[10px] text-gray-400 mb-1">{unitInfo.name}</div>
        )}

        {/* 비용 */}
        {!isOnCooldown && (
          <div className="flex gap-1">
            {costItems.map((item, i) => (
              <div key={i} className="flex items-center text-[10px]">
                <span>{item.icon}</span>
                <span className="text-gray-300">{item.amount}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 호버 효과 */}
      {canSpawn && (
        <div className="absolute inset-0 bg-gradient-to-t from-neon-cyan/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
      )}
    </button>
  );
};
