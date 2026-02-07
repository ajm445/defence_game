import React from 'react';
import { LevelUpResult } from '../../types/auth';
import { CLASS_CONFIGS, ADVANCED_CLASS_CONFIGS } from '../../constants/rpgConfig';

interface LevelUpNotificationProps {
  result: LevelUpResult;
  onClose: () => void;
}

export const LevelUpNotification: React.FC<LevelUpNotificationProps> = ({ result, onClose }) => {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-[60] animate-fade-in">
      <div className="bg-gradient-to-b from-yellow-900/90 to-dark-800/95 backdrop-blur-sm rounded-2xl p-8 border-2 border-yellow-500/50 min-w-[350px] text-center">
        {/* 레벨업 아이콘 */}
        <div className="text-6xl mb-4 animate-bounce">
          {result.playerLeveledUp ? '🌟' : '⬆️'}
        </div>

        {/* 타이틀 */}
        <h2 className="text-3xl font-bold text-yellow-400 mb-6">
          레벨 업!
        </h2>

        {/* 레벨업 정보 */}
        <div className="space-y-4 mb-6">
          {/* 플레이어 레벨업 */}
          {result.playerLeveledUp && result.newPlayerLevel && (
            <div className="bg-yellow-500/20 rounded-lg p-4 border border-yellow-500/30">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-2xl">👤</span>
                <span className="text-xl text-white font-bold">플레이어 레벨</span>
              </div>
              <div className="text-3xl text-yellow-400 font-bold">
                Lv.{result.newPlayerLevel}
              </div>
              <p className="text-gray-400 text-sm mt-2">
                새로운 캐릭터가 해금되었을 수 있습니다!
              </p>
            </div>
          )}

          {/* 클래스 레벨업 */}
          {result.classLeveledUp && result.newClassLevel && result.className && (
            <div className="bg-cyan-500/20 rounded-lg p-4 border border-cyan-500/30">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-2xl">
                  {result.advancedClassName
                    ? ADVANCED_CLASS_CONFIGS[result.advancedClassName].emoji
                    : CLASS_CONFIGS[result.className].emoji}
                </span>
                <span className="text-xl text-white font-bold">
                  {result.advancedClassName
                    ? ADVANCED_CLASS_CONFIGS[result.advancedClassName].name
                    : CLASS_CONFIGS[result.className].name} 레벨
                </span>
              </div>
              <div className="text-3xl text-cyan-400 font-bold">
                Lv.{result.newClassLevel}
              </div>
            </div>
          )}
        </div>

        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          className="px-8 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg transition-colors cursor-pointer"
        >
          확인
        </button>
      </div>
    </div>
  );
};
