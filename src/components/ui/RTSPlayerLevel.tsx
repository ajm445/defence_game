import React from 'react';
import { useAuthProfile, useAuthIsGuest } from '../../stores/useAuthStore';

export const RTSPlayerLevel: React.FC = () => {
  const profile = useAuthProfile();
  const isGuest = useAuthIsGuest();

  if (!profile) {
    return null;
  }

  return (
    <div className="absolute top-3 left-3 z-20">
      <div className="flex items-center gap-2 bg-dark-800/90 border border-dark-500 rounded-lg px-3 py-2">
        {/* 아바타 */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center text-sm">
          {isGuest ? '👤' : '⭐'}
        </div>

        {/* 레벨 정보 */}
        <div className="flex flex-col">
          <span className="text-gray-400 text-[10px]">{profile.nickname}</span>
          <span className="text-yellow-400 text-sm font-bold">
            Lv.{profile.playerLevel}
          </span>
        </div>

        {/* 게스트 표시 */}
        {isGuest && (
          <span className="text-gray-500 text-[10px]">(게스트)</span>
        )}
      </div>
    </div>
  );
};
