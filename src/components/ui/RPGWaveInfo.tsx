import React from 'react';
import { useCurrentWave, useWaveInProgress, useRPGEnemies, useRPGStore } from '../../stores/useRPGStore';
import { getWaveDescription } from '../../game/rpg/waveSystem';

export const RPGWaveInfo: React.FC = () => {
  const currentWave = useCurrentWave();
  const waveInProgress = useWaveInProgress();
  const enemies = useRPGEnemies();
  const spawnQueue = useRPGStore((state) => state.spawnQueue);

  const isBossWave = currentWave > 0 && currentWave % 10 === 0;
  const aliveEnemies = enemies.filter((e) => e.hp > 0).length;
  const totalEnemies = aliveEnemies + spawnQueue.length;

  return (
    <div className={`
      bg-dark-800/90 backdrop-blur-sm rounded-xl p-4 border min-w-[200px]
      ${isBossWave ? 'border-red-500/50' : 'border-dark-600/50'}
    `}>
      {/* 웨이브 번호 */}
      <div className="flex items-center justify-between mb-2">
        <div className={`
          text-2xl font-bold
          ${isBossWave ? 'text-red-400' : 'text-white'}
        `}>
          {isBossWave && <span className="mr-2">👹</span>}
          웨이브 {currentWave}
        </div>
        {isBossWave && (
          <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded uppercase">
            보스
          </span>
        )}
      </div>

      {/* 웨이브 상태 */}
      <div className="mb-3">
        {waveInProgress ? (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm text-green-400">진행 중</span>
          </div>
        ) : currentWave > 0 ? (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-yellow-500 rounded-full" />
            <span className="text-sm text-yellow-400">준비 중...</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-gray-500 rounded-full" />
            <span className="text-sm text-gray-400">대기 중</span>
          </div>
        )}
      </div>

      {/* 적 정보 */}
      {waveInProgress && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">남은 적</span>
            <span className="text-white font-bold">{aliveEnemies}</span>
          </div>
          {spawnQueue.length > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">대기 중</span>
              <span className="text-yellow-400">{spawnQueue.length}</span>
            </div>
          )}

          {/* 적 진행 바 */}
          <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${isBossWave ? 'bg-red-500' : 'bg-neon-cyan'}`}
              style={{
                width: `${totalEnemies > 0 ? (1 - aliveEnemies / totalEnemies) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* 웨이브 설명 */}
      {currentWave > 0 && (
        <div className="mt-3 pt-3 border-t border-dark-600/50">
          <div className="text-xs text-gray-400">
            {getWaveDescription(currentWave)}
          </div>
        </div>
      )}
    </div>
  );
};

// 웨이브 시작/클리어 알림 컴포넌트
export const RPGWaveAlert: React.FC<{
  type: 'start' | 'clear' | 'boss';
  waveNumber: number;
  visible: boolean;
}> = ({ type, waveNumber, visible }) => {
  if (!visible) return null;

  const configs = {
    start: {
      title: `웨이브 ${waveNumber}`,
      subtitle: '시작!',
      bgColor: 'from-neon-cyan/20 to-blue-500/20',
      borderColor: 'border-neon-cyan/50',
      textColor: 'text-neon-cyan',
    },
    clear: {
      title: `웨이브 ${waveNumber}`,
      subtitle: '클리어!',
      bgColor: 'from-green-500/20 to-emerald-500/20',
      borderColor: 'border-green-500/50',
      textColor: 'text-green-400',
    },
    boss: {
      title: '보스 웨이브!',
      subtitle: `웨이브 ${waveNumber}`,
      bgColor: 'from-red-500/20 to-orange-500/20',
      borderColor: 'border-red-500/50',
      textColor: 'text-red-400',
    },
  };

  const config = configs[type];

  return (
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
      <div
        className={`
          bg-gradient-to-r ${config.bgColor}
          backdrop-blur-sm rounded-2xl p-6 border ${config.borderColor}
          animate-pulse
        `}
      >
        <div className={`text-4xl font-bold ${config.textColor} text-center`}>
          {type === 'boss' && <span className="block text-5xl mb-2">👹</span>}
          {config.title}
        </div>
        <div className="text-xl text-white/80 text-center mt-1">
          {config.subtitle}
        </div>
      </div>
    </div>
  );
};
