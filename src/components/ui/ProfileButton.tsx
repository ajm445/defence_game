import React, { useCallback } from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { useAuthProfile, useAuthIsGuest } from '../../stores/useAuthStore';
import { useProfileStore } from '../../stores/useProfileStore';
import { soundManager } from '../../services/SoundManager';

interface ProfileButtonProps {
  className?: string;
}

export const ProfileButton: React.FC<ProfileButtonProps> = ({ className = '' }) => {
  const setScreen = useUIStore((state) => state.setScreen);
  const profile = useAuthProfile();
  const isGuest = useAuthIsGuest();
  const getPlayerExpProgress = useProfileStore((state) => state.getPlayerExpProgress);

  const handleClick = useCallback(() => {
    soundManager.play('ui_click');
    setScreen('profile');
  }, [setScreen]);

  if (!profile) {
    return null;
  }

  const expProgress = getPlayerExpProgress();

  return (
    <button
      onClick={handleClick}
      className={`
        bg-gray-900/80 hover:bg-gray-800/90
        border border-gray-600 hover:border-yellow-500/50
        rounded-xl transition-all cursor-pointer
        shadow-lg hover:shadow-yellow-500/10
        p-4
        ${className}
      `}
    >
      {/* 내부 컨텐츠 컨테이너 */}
      <div className="flex items-center gap-4"
      style={{ paddingLeft: '10px', paddingRight: '10px', paddingTop: '10px', paddingBottom: '10px' }}>
        {/* 아바타 */}
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center text-2xl shadow-md flex-shrink-0">
          {isGuest ? '👤' : '⭐'}
        </div>

        {/* 정보 영역 */}
        <div className="flex flex-col items-start pr-2">
          {/* 닉네임 */}
          <span className="text-white text-base font-bold truncate max-w-[140px] mb-1">
            {profile.nickname}
          </span>

          {/* 레벨 + 게스트 표시 */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-yellow-400 text-sm font-bold">
              Lv.{profile.playerLevel}
            </span>
            {isGuest && (
              <span className="text-gray-500 text-xs">(게스트)</span>
            )}
          </div>

          <div style={{ height: '10px' }} />

          {/* 경험치 바 */}
          <div className="w-36">
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 transition-all duration-300"
                style={{ width: `${expProgress.percentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </button>
  );
};
