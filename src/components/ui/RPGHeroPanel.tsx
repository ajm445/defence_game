import React from 'react';
import { useHero, useRPGStats } from '../../stores/useRPGStore';
import { HeroClass, BuffType } from '../../types/rpg';

// 직업별 표시 정보
const CLASS_DISPLAY: Record<HeroClass, { emoji: string; name: string; color: string; bgColor: string }> = {
  warrior: { emoji: '⚔️', name: '전사', color: 'text-orange-400', bgColor: 'from-orange-500/30 to-red-500/30' },
  archer: { emoji: '🏹', name: '궁수', color: 'text-green-400', bgColor: 'from-green-500/30 to-emerald-500/30' },
  knight: { emoji: '🛡️', name: '기사', color: 'text-blue-400', bgColor: 'from-blue-500/30 to-indigo-500/30' },
  mage: { emoji: '🔮', name: '마법사', color: 'text-purple-400', bgColor: 'from-purple-500/30 to-pink-500/30' },
};

// 버프별 표시 정보
const BUFF_DISPLAY: Record<BuffType, { emoji: string; name: string; color: string; maxDuration: number }> = {
  berserker: { emoji: '🔥', name: '광전사', color: '#ef4444', maxDuration: 10 },
  ironwall: { emoji: '🛡️', name: '철벽 방어', color: '#3b82f6', maxDuration: 5 },
  invincible: { emoji: '✨', name: '무적', color: '#fbbf24', maxDuration: 2.0 },
  stun: { emoji: '💫', name: '기절', color: '#9ca3af', maxDuration: 1 },
};

// 원형 프로그레스 버프 아이콘 컴포넌트
const CircularBuffIcon: React.FC<{
  emoji: string;
  color: string;
  progress: number; // 0~1, 남은 시간 비율
  size?: number;
}> = ({ emoji, color, progress, size = 48 }) => {
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* 배경 원 */}
      <svg
        className="absolute inset-0"
        width={size}
        height={size}
        style={{ transform: 'rotate(-90deg)' }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="rgba(0, 0, 0, 0.5)"
          stroke="rgba(255, 255, 255, 0.2)"
          strokeWidth={strokeWidth}
        />
        {/* 프로그레스 원 (시계방향으로 줄어듦) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: 'stroke-dashoffset 0.1s linear' }}
        />
      </svg>
      {/* 이모지 */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span style={{ fontSize: size * 0.5 }}>{emoji}</span>
      </div>
    </div>
  );
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

        {/* 활성 버프 표시 - 원형 프로그레스 바 (헤더 오른쪽) */}
        {activeBuffs.length > 0 && (
          <div className="flex gap-1 items-center">
            {activeBuffs
              .filter(buff => buff.type !== 'invincible') // 무적은 너무 짧아서 표시 제외
              .map((buff, index) => {
                const buffInfo = BUFF_DISPLAY[buff.type];
                const progress = buff.duration / buffInfo.maxDuration;
                return (
                  <div key={index} className="flex flex-col items-center">
                    <CircularBuffIcon
                      emoji={buffInfo.emoji}
                      color={buffInfo.color}
                      progress={Math.min(1, Math.max(0, progress))}
                      size={36}
                    />
                    <span className="text-xs text-gray-400">
                      {buff.duration.toFixed(1)}s
                    </span>
                  </div>
                );
              })}
          </div>
        )}
      </div>

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
    </div>
  );
};
