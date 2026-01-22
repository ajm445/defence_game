import React from 'react';

interface RPGCoopReviveTimerProps {
  reviveTimer: number;
}

export const RPGCoopReviveTimer: React.FC<RPGCoopReviveTimerProps> = ({ reviveTimer }) => {
  const seconds = Math.ceil(reviveTimer);

  return (
    <div className="bg-dark-900/95 backdrop-blur-sm rounded-2xl p-8 border border-red-500/50 text-center">
      <div className="text-red-400 text-xl mb-4 font-bold">
        사망했습니다
      </div>

      <div className="relative w-32 h-32 mx-auto mb-4">
        {/* 원형 프로그레스 배경 */}
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="rgba(255, 100, 100, 0.2)"
            strokeWidth="8"
          />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="rgba(255, 100, 100, 0.8)"
            strokeWidth="8"
            strokeDasharray={`${2 * Math.PI * 45}`}
            strokeDashoffset={`${2 * Math.PI * 45 * (1 - reviveTimer / 30)}`}
            strokeLinecap="round"
            className="transition-all duration-200"
          />
        </svg>

        {/* 카운트다운 숫자 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-5xl font-bold text-red-400">
            {seconds}
          </span>
        </div>
      </div>

      <div className="text-gray-400 text-sm">
        부활까지 대기 중...
      </div>

      <div className="mt-4 text-gray-500 text-xs">
        아군 근처에서 부활합니다
      </div>

      <div className="mt-3 text-gray-600 text-xs border-t border-gray-700 pt-3">
        💡 WASD로 맵을 둘러볼 수 있습니다
      </div>
    </div>
  );
};
