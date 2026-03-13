import React from 'react';
import { useRPGEnemies, useNexus, useEnemyBases, useRPGGamePhase } from '../../stores/useRPGStore';
import { Emoji } from '../common/Emoji';

export const RPGWaveInfo: React.FC = () => {
  const enemies = useRPGEnemies();
  const nexus = useNexus();
  const enemyBases = useEnemyBases();
  const gamePhase = useRPGGamePhase();

  const aliveEnemies = enemies.filter((e) => e.hp > 0).length;
  const bossEnemies = enemies.filter((e) => e.hp > 0 && (e.type === 'boss' || e.type === 'boss2')).length;
  const totalBosses = enemies.filter((e) => e.type === 'boss' || e.type === 'boss2').length;
  const destroyedBases = enemyBases.filter((b) => b.destroyed).length;
  const isBossPhase = gamePhase === 'boss_phase';

  // 넥서스 HP 비율
  const nexusHpPercent = nexus ? nexus.hp / nexus.maxHp : 1;

  return (
    <div
      className={`bg-dark-800/90 backdrop-blur-sm rounded-xl border ${isBossPhase ? 'border-red-500/50' : 'border-dark-600/50'}`}
      style={{ padding: 'clamp(0.5rem, 1.5vw, 1rem)', minWidth: 'clamp(140px, 16vw, 200px)' }}
    >
      {/* 게임 상태 */}
      <div className="flex items-center justify-between mb-2">
        <div className={`
          text-xl font-bold
          ${isBossPhase ? 'text-red-400' : 'text-white'}
        `}>
          {isBossPhase ? (
            <>
              <span className="mr-2"><Emoji emoji="👹" size={20} /></span>
              보스 페이즈
            </>
          ) : (
            <>전투 중</>
          )}
        </div>
        {isBossPhase && (
          <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded uppercase">
            보스
          </span>
        )}
      </div>

      {/* 넥서스 상태 */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-cyan-400"><Emoji emoji="💎" size={16} /></span>
          <span className="text-sm text-gray-400">넥서스</span>
        </div>
        <div className="h-3 bg-dark-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              nexusHpPercent > 0.5 ? 'bg-cyan-500' :
              nexusHpPercent > 0.25 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${nexusHpPercent * 100}%` }}
          />
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {nexus ? `${Math.floor(nexus.hp)} / ${nexus.maxHp}` : 'N/A'}
        </div>
      </div>

      {/* 적 기지 상태 */}
      <div className="space-y-2 mb-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">적 기지</span>
          <span className="text-red-400 font-bold">{destroyedBases}/2 파괴</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {enemyBases.map((base) => (
            <div
              key={base.id}
              className={`text-xs px-2 py-1 rounded ${
                base.destroyed
                  ? 'bg-gray-600/50 text-gray-400 line-through'
                  : 'bg-red-500/20 text-red-400'
              }`}
            >
              {base.id === 'left' ? '좌측' : '우측'} 기지
              {!base.destroyed && (
                <span className="ml-1 text-gray-500">
                  ({Math.floor((base.hp / base.maxHp) * 100)}%)
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 적 정보 */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">적 유닛</span>
          <span className="text-red-400 font-bold">{aliveEnemies}</span>
        </div>
        {isBossPhase && bossEnemies > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">보스</span>
            <span className="text-purple-400 font-bold">{bossEnemies}/{totalBosses}</span>
          </div>
        )}
      </div>

      {/* 목표 안내 */}
      <div className="mt-3 pt-3 border-t border-dark-600/50">
        <div className="text-xs text-gray-400">
          {isBossPhase
            ? <><Emoji emoji="⚔️" size={14} /> 보스를 모두 처치하세요!</>
            : destroyedBases < 2
              ? <><Emoji emoji="🎯" size={14} /> 적 기지를 파괴하세요!</>
              : <><Emoji emoji="⏳" size={14} /> 보스 등장 준비 중...</>}
        </div>
      </div>
    </div>
  );
};

// 게임 상태 알림 컴포넌트 (기존 RPGWaveAlert 대체)
export const RPGGameAlert: React.FC<{
  type: 'boss_spawn' | 'base_destroyed' | 'victory' | 'defeat';
  visible: boolean;
  baseName?: string;
}> = ({ type, visible, baseName }) => {
  if (!visible) return null;

  const configs = {
    boss_spawn: {
      title: '보스 등장!',
      subtitle: '모든 기지가 파괴되었습니다',
      bgColor: 'from-red-500/20 to-orange-500/20',
      borderColor: 'border-red-500/50',
      textColor: 'text-red-400',
      emoji: <Emoji emoji="👹" size={48} />,
    },
    base_destroyed: {
      title: '기지 파괴!',
      subtitle: `${baseName || ''} 기지가 파괴되었습니다`,
      bgColor: 'from-green-500/20 to-emerald-500/20',
      borderColor: 'border-green-500/50',
      textColor: 'text-green-400',
      emoji: <Emoji emoji="💥" size={48} />,
    },
    victory: {
      title: '승리!',
      subtitle: '모든 보스를 처치했습니다',
      bgColor: 'from-yellow-500/20 to-amber-500/20',
      borderColor: 'border-yellow-500/50',
      textColor: 'text-yellow-400',
      emoji: <Emoji emoji="🏆" size={48} />,
    },
    defeat: {
      title: '패배',
      subtitle: '넥서스가 파괴되었습니다',
      bgColor: 'from-gray-500/20 to-gray-600/20',
      borderColor: 'border-gray-500/50',
      textColor: 'text-gray-400',
      emoji: <Emoji emoji="💀" size={48} />,
    },
  };

  const config = configs[type];

  return (
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
      <div
        className={`bg-gradient-to-r ${config.bgColor} backdrop-blur-sm rounded-2xl border ${config.borderColor} animate-pulse`}
        style={{ padding: 'clamp(1rem, 3vw, 1.5rem)' }}
      >
        <div className={`font-bold ${config.textColor} text-center`} style={{ fontSize: 'clamp(1.5rem, 4vw, 2.25rem)' }}>
          <span className="block mb-2" style={{ fontSize: 'clamp(2rem, 5vw, 3rem)' }}>{config.emoji}</span>
          {config.title}
        </div>
        <div className="text-white/80 text-center mt-1" style={{ fontSize: 'clamp(0.875rem, 2vw, 1.25rem)' }}>
          {config.subtitle}
        </div>
      </div>
    </div>
  );
};

// 기존 RPGWaveAlert 호환성을 위한 별칭 (사용하는 곳이 있으면)
export const RPGWaveAlert = RPGGameAlert;
