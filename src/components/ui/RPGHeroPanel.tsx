import React from 'react';
import { useHero, useRPGStats } from '../../stores/useRPGStore';
import { HeroClass } from '../../types/rpg';

// 직업별 표시 정보
const CLASS_DISPLAY: Record<HeroClass, { emoji: string; name: string; color: string; bgColor: string }> = {
  warrior: { emoji: '⚔️', name: '전사', color: 'text-orange-400', bgColor: 'from-orange-500/30 to-red-500/30' },
  archer: { emoji: '🏹', name: '궁수', color: 'text-green-400', bgColor: 'from-green-500/30 to-emerald-500/30' },
  knight: { emoji: '🛡️', name: '기사', color: 'text-blue-400', bgColor: 'from-blue-500/30 to-indigo-500/30' },
  mage: { emoji: '🔮', name: '마법사', color: 'text-purple-400', bgColor: 'from-purple-500/30 to-pink-500/30' },
};

export const RPGHeroPanel: React.FC = () => {
  const hero = useHero();
  const stats = useRPGStats();

  if (!hero) return null;

  const hpPercent = (hero.hp / hero.maxHp) * 100;
  const expPercent = (hero.exp / hero.expToNextLevel) * 100;

  const getHpColor = () => {
    if (hpPercent > 50) return 'bg-green-500';
    if (hpPercent > 25) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // 직업 정보 가져오기
  const classInfo = CLASS_DISPLAY[hero.heroClass] || CLASS_DISPLAY.warrior;

  // 활성 버프 확인
  const activeBuffs = hero.buffs?.filter(b => b.duration > 0) || [];

  return (
    <div className="bg-dark-800/90 backdrop-blur-sm rounded-xl p-4 border border-dark-600/50 min-w-[280px]">
      {/* 영웅 정보 헤더 */}
      <div className="flex items-center gap-3 mb-3">
        <div className="relative">
          <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${classInfo.bgColor} border-2 border-current ${classInfo.color} flex items-center justify-center`}>
            <span className="text-3xl">{classInfo.emoji}</span>
          </div>
          {/* 레벨 배지 */}
          <div className="absolute -bottom-1 -right-1 bg-yellow-500 text-dark-900 text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
            {hero.level}
          </div>
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`font-bold ${classInfo.color}`}>{classInfo.name}</span>
            {hero.skillPoints > 0 && (
              <span className="bg-neon-cyan/20 text-neon-cyan text-xs px-2 py-0.5 rounded">
                SP: {hero.skillPoints}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-400">레벨 {hero.level}</div>
        </div>
      </div>

      {/* 활성 버프 표시 */}
      {activeBuffs.length > 0 && (
        <div className="flex gap-2 mb-3">
          {activeBuffs.map((buff, index) => (
            <div
              key={index}
              className={`px-2 py-1 rounded text-xs font-medium ${
                buff.type === 'berserker'
                  ? 'bg-red-500/20 text-red-400'
                  : buff.type === 'ironwall'
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-gray-500/20 text-gray-400'
              }`}
            >
              {buff.type === 'berserker' && '광전사'}
              {buff.type === 'ironwall' && '철벽 방어'}
              <span className="ml-1 opacity-70">{buff.duration.toFixed(1)}s</span>
            </div>
          ))}
        </div>
      )}

      {/* HP 바 */}
      <div className="mb-2">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-400">HP</span>
          <span className="text-white">{Math.floor(hero.hp)} / {hero.maxHp}</span>
        </div>
        <div className="h-3 bg-dark-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${getHpColor()} transition-all duration-300`}
            style={{ width: `${hpPercent}%` }}
          />
        </div>
      </div>

      {/* 경험치 바 */}
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-400">EXP</span>
          <span className="text-blue-400">{hero.exp} / {hero.expToNextLevel}</span>
        </div>
        <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${Math.min(100, expPercent)}%` }}
          />
        </div>
      </div>

      {/* 스탯 정보 */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="bg-dark-700/50 rounded-lg p-2">
          <div className="text-red-400">⚔️ 공격</div>
          <div className="text-white font-bold">{hero.config.attack}</div>
        </div>
        <div className="bg-dark-700/50 rounded-lg p-2">
          <div className="text-blue-400">👟 속도</div>
          <div className="text-white font-bold">{hero.config.speed?.toFixed(2)}</div>
        </div>
        <div className="bg-dark-700/50 rounded-lg p-2">
          <div className="text-yellow-400">🎯 사거리</div>
          <div className="text-white font-bold">{hero.config.range}</div>
        </div>
      </div>

      {/* 통계 */}
      <div className="mt-3 pt-3 border-t border-dark-600/50 flex justify-between text-xs text-gray-400">
        <span>처치: {stats.totalKills}</span>
        <span>경험치: {stats.totalExpGained}</span>
      </div>
    </div>
  );
};
