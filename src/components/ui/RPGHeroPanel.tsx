import React from 'react';
import { useHero, useRPGStats, useUpgradeLevels, useGold, useIsMultiplayer, useOtherHeroes, usePersonalKills } from '../../stores/useRPGStore';
import { useUIStore } from '../../stores/useUIStore';
import { HeroClass, BuffType, HeroUnit, AdvancedHeroClass } from '../../types/rpg';
import { calculateAllUpgradeBonuses } from '../../game/rpg/goldSystem';
import { ADVANCED_CLASS_CONFIGS } from '../../constants/rpgConfig';

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
  invincible: { emoji: '✨', name: '무적', color: '#fbbf24', maxDuration: 3 },
  swiftness: { emoji: '💨', name: '신속', color: '#22d3ee', maxDuration: 3 },
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
  const upgradeLevels = useUpgradeLevels();
  const gold = useGold();
  const isMultiplayer = useIsMultiplayer();
  const personalKills = usePersonalKills();
  const isMobile = useUIStore((s) => s.isMobile);

  if (!hero) return null;

  // 멀티플레이어에서는 개인 처치 수, 싱글플레이어에서는 총 처치 수 표시
  const displayKills = isMultiplayer ? personalKills : stats.totalKills;

  const hpPercent = (hero.hp / hero.maxHp) * 100;

  const getHpColor = () => {
    if (hpPercent > 50) return 'bg-green-500';
    if (hpPercent > 25) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // 직업 정보 가져오기 (전직 시 전직 정보 사용)
  const baseClassInfo = CLASS_DISPLAY[hero.heroClass] || CLASS_DISPLAY.warrior;
  const advancedConfig = hero.advancedClass ? ADVANCED_CLASS_CONFIGS[hero.advancedClass as AdvancedHeroClass] : null;
  const classInfo = advancedConfig
    ? { ...baseClassInfo, name: advancedConfig.name, emoji: advancedConfig.emoji }
    : baseClassInfo;

  // 활성 버프 확인
  const activeBuffs = hero.buffs?.filter(b => b.duration > 0) || [];

  // 업그레이드 보너스 계산
  const upgradeBonuses = calculateAllUpgradeBonuses(upgradeLevels);

  return (
    <div className={`bg-dark-800/90 backdrop-blur-sm rounded-xl ${isMobile ? 'p-2' : 'p-4'} border border-dark-600/50 ${isMobile ? 'min-w-[180px]' : 'min-w-[280px]'}`}>
      {/* 골드 표시 */}
      <div className={`flex items-center justify-between ${isMobile ? 'mb-2 pb-1' : 'mb-3 pb-2'} border-b border-dark-600/50`}>
        <div className="flex items-center gap-2">
          <span className={isMobile ? 'text-base' : 'text-xl'}>💰</span>
          <span className={`${isMobile ? 'text-sm' : 'text-lg'} font-bold text-yellow-400`}>{gold}</span>
        </div>
        <div className="text-xs text-gray-400">
          처치: <span className="text-red-400 font-bold">{displayKills}</span>
        </div>
      </div>

      {/* 영웅 정보 헤더 */}
      <div className={`flex items-center ${isMobile ? 'gap-2 mb-2' : 'gap-3 mb-3'}`}>
        <div className="relative">
          <div className={`${isMobile ? 'w-10 h-10' : 'w-14 h-14'} rounded-full bg-gradient-to-br ${classInfo.bgColor} border-2 border-current ${classInfo.color} flex items-center justify-center`}>
            <span className={isMobile ? 'text-xl' : 'text-3xl'}>{classInfo.emoji}</span>
          </div>
          {/* 캐릭터 레벨 배지 */}
          <div className={`absolute -bottom-1 -right-1 bg-yellow-500 text-dark-900 text-[10px] font-bold ${isMobile ? 'w-5 h-5' : 'w-6 h-6'} rounded-full flex items-center justify-center`}>
            {hero.characterLevel}
          </div>
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`font-bold ${isMobile ? 'text-xs' : ''} ${classInfo.color}`}>{classInfo.name}</span>
          </div>
          <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-gray-400`}>Lv.{hero.characterLevel}</div>
        </div>

        {/* 활성 버프 표시 - 원형 프로그레스 바 (헤더 오른쪽) */}
        {activeBuffs.length > 0 && (
          <div className="flex gap-1 items-center">
            {activeBuffs
              .map((buff, index) => {
                const buffInfo = BUFF_DISPLAY[buff.type];
                const progress = buff.duration / buffInfo.maxDuration;
                return (
                  <div key={index} className="flex flex-col items-center">
                    <CircularBuffIcon
                      emoji={buffInfo.emoji}
                      color={buffInfo.color}
                      progress={Math.min(1, Math.max(0, progress))}
                      size={isMobile ? 28 : 36}
                    />
                    <span className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-gray-400`}>
                      {buff.duration.toFixed(1)}s
                    </span>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* HP 바 */}
      <div className={isMobile ? 'mb-2' : 'mb-3'}>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-400">HP</span>
          <span className="text-white">{Math.floor(hero.hp)} / {hero.maxHp}</span>
        </div>
        <div className={`${isMobile ? 'h-2' : 'h-3'} bg-dark-700 rounded-full overflow-hidden`}>
          <div
            className={`h-full ${getHpColor()} transition-all duration-300`}
            style={{ width: `${hpPercent}%` }}
          />
        </div>
      </div>

      {/* 스탯 정보 (업그레이드 보너스 포함) - 폰에서 2×2 */}
      <div className={`grid ${isMobile ? 'grid-cols-2' : 'grid-cols-4'} gap-2 text-center text-xs`}>
        <div className="bg-dark-700/50 rounded-lg p-2">
          <div className="text-red-400">{isMobile ? '⚔️' : '⚔️ 공격'}</div>
          <div className="text-white font-bold">
            {hero.baseAttack + upgradeBonuses.attackBonus}
          </div>
        </div>
        <div className="bg-dark-700/50 rounded-lg p-2">
          <div className="text-cyan-400">{isMobile ? '⚡' : '⚡ 공속'}</div>
          <div className="text-white font-bold">
            {(hero.config.attackSpeed ?? 1.0).toFixed(2)}s
          </div>
        </div>
        {!isMobile && (
          <>
            <div className="bg-dark-700/50 rounded-lg p-2">
              <div className="text-blue-400">👟 속도</div>
              <div className="text-white font-bold">
                {(hero.baseSpeed + upgradeBonuses.speedBonus).toFixed(2)}
              </div>
            </div>
            <div className="bg-dark-700/50 rounded-lg p-2">
              <div className="text-yellow-400">🎯 사거리</div>
              <div className="text-white font-bold">{hero.config.range}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// 아군 영웅 HP 바 컴포넌트 (멀티플레이용)
const AllyHeroBar: React.FC<{ hero: HeroUnit }> = ({ hero }) => {
  const hpPercent = (hero.hp / hero.maxHp) * 100;
  // 직업 정보 가져오기 (전직 시 전직 정보 사용)
  const baseClassInfo = CLASS_DISPLAY[hero.heroClass] || CLASS_DISPLAY.warrior;
  const advancedConfig = hero.advancedClass ? ADVANCED_CLASS_CONFIGS[hero.advancedClass as AdvancedHeroClass] : null;
  const classInfo = advancedConfig
    ? { ...baseClassInfo, name: advancedConfig.name, emoji: advancedConfig.emoji }
    : baseClassInfo;
  const isDead = hero.hp <= 0;

  const getHpColor = () => {
    if (hpPercent > 50) return 'bg-green-500';
    if (hpPercent > 25) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className={`flex items-center gap-2 bg-dark-700/50 rounded-lg p-2 ${isDead ? 'opacity-50' : ''}`}>
      {/* 직업 아이콘 */}
      <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${classInfo.bgColor} flex items-center justify-center`}>
        <span className="text-lg">{classInfo.emoji}</span>
      </div>
      {/* HP 바 */}
      <div className="flex-1">
        <div className="flex justify-between text-[10px] mb-0.5">
          <span className={`${classInfo.color} font-bold`}>{classInfo.name}</span>
          <span className="text-gray-400">
            {isDead ? '사망' : `${Math.floor(hero.hp)}/${hero.maxHp}`}
          </span>
        </div>
        <div className="h-2 bg-dark-600 rounded-full overflow-hidden">
          <div
            className={`h-full ${getHpColor()} transition-all duration-300`}
            style={{ width: `${hpPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
};

// 멀티플레이어 팀 패널
export const RPGTeamPanel: React.FC = () => {
  const hero = useHero();
  const otherHeroes = useOtherHeroes();
  const isMultiplayer = useIsMultiplayer();
  const isMobile = useUIStore((s) => s.isMobile);

  if (!isMultiplayer || !hero) return null;

  const allyHeroes = Array.from(otherHeroes.values());
  if (allyHeroes.length === 0) return null;

  // 폰: 원형 HP 인디케이터 (컴팩트)
  if (isMobile) {
    return (
      <div className="flex gap-2 mt-2">
        {allyHeroes.map((ally) => {
          const hpPct = (ally.hp / ally.maxHp) * 100;
          const baseInfo = CLASS_DISPLAY[ally.heroClass] || CLASS_DISPLAY.warrior;
          const advConfig = ally.advancedClass ? ADVANCED_CLASS_CONFIGS[ally.advancedClass as AdvancedHeroClass] : null;
          const emoji = advConfig ? advConfig.emoji : baseInfo.emoji;
          const isDead = ally.hp <= 0;
          return (
            <div key={ally.id} className={`relative w-10 h-10 ${isDead ? 'opacity-50' : ''}`}>
              <svg className="absolute inset-0" width={40} height={40} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={20} cy={20} r={17} fill="rgba(0,0,0,0.5)" stroke="rgba(255,255,255,0.2)" strokeWidth={3} />
                <circle cx={20} cy={20} r={17} fill="none"
                  stroke={hpPct > 50 ? '#22c55e' : hpPct > 25 ? '#eab308' : '#ef4444'}
                  strokeWidth={3} strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 17}`}
                  strokeDashoffset={`${2 * Math.PI * 17 * (1 - hpPct / 100)}`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-lg">
                {emoji}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="bg-dark-800/90 backdrop-blur-sm rounded-xl p-3 border border-dark-600/50 min-w-[200px] mt-3">
      <div className="text-xs text-gray-400 mb-2 font-bold">아군</div>
      <div className="space-y-2">
        {allyHeroes.map((ally) => (
          <AllyHeroBar key={ally.id} hero={ally} />
        ))}
      </div>
    </div>
  );
};
