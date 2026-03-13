import React, { useCallback } from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { useAuthProfile, useAuthIsGuest } from '../../stores/useAuthStore';
import { useProfileStore } from '../../stores/useProfileStore';
import { soundManager } from '../../services/SoundManager';
import { Emoji } from '../common/Emoji';

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
        ${className}
      `}
      style={{ padding: 'clamp(0.5rem, 0.85vw, 1rem)' }}
    >
      {/* 내부 컨텐츠 컨테이너 */}
      <div className="flex items-center" style={{ gap: 'clamp(0.5rem, 0.85vw, 1rem)', padding: 'clamp(0.25rem, 0.55vw, 0.625rem)' }}>
        {/* 아바타 */}
        <div
          className="rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center shadow-md flex-shrink-0"
          style={{ width: 'clamp(1.75rem, 2.5vw, 3rem)', height: 'clamp(1.75rem, 2.5vw, 3rem)', fontSize: 'clamp(0.875rem, 1.5vw, 1.5rem)' }}
        >
          {isGuest ? <Emoji emoji="👤" size="clamp(0.875rem, 1.5vw, 1.5rem)" /> : <Emoji emoji="⭐" size="clamp(0.875rem, 1.5vw, 1.5rem)" />}
        </div>

        {/* 정보 영역 */}
        <div className="flex flex-col items-start">
          {/* 닉네임 */}
          <span className="text-white font-bold truncate mb-1" style={{ fontSize: 'clamp(0.625rem, 0.85vw, 1rem)', maxWidth: 'clamp(50px, 6vw, 100px)' }}>
            {profile.nickname}
          </span>

          {/* 레벨 + 게스트 표시 */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-yellow-400 font-bold" style={{ fontSize: 'clamp(0.5rem, 0.73vw, 0.875rem)' }}>
              Lv.{profile.playerLevel}
            </span>
            {isGuest && (
              <span className="text-gray-500 text-xs">(게스트)</span>
            )}
          </div>

          {/* 경험치 바 */}
          <div style={{ width: 'clamp(3rem, 5.5vw, 6rem)' }}>
            <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
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
