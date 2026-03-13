import React from 'react';
import { AdvancedHeroClass } from '../../types/rpg';
import { ADVANCED_CLASS_CONFIGS } from '../../constants/rpgConfig';
import { Emoji } from '../common/Emoji';

interface SecondEnhancementNotificationProps {
  advancedClass: AdvancedHeroClass;
  onClose: () => void;
}

export const SecondEnhancementNotification: React.FC<SecondEnhancementNotificationProps> = ({
  advancedClass,
  onClose,
}) => {
  const config = ADVANCED_CLASS_CONFIGS[advancedClass];

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-[60] animate-fade-in">
      <div className="bg-gradient-to-b from-purple-900/90 to-dark-800/95 backdrop-blur-sm rounded-2xl p-5 sm:p-8 border-2 border-purple-500/50 w-[90vw] sm:w-auto sm:min-w-[400px] max-w-[450px] text-center">
        {/* 2차 강화 아이콘 */}
        <div className="mb-4 animate-pulse flex items-center justify-center gap-1">
          <Emoji emoji="✨" size={48} /><Emoji emoji="🔮" size={48} /><Emoji emoji="✨" size={48} />
        </div>

        {/* 타이틀 */}
        <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-4">
          2차 강화 완료!
        </h2>

        {/* 직업 정보 */}
        <div className="bg-purple-500/20 rounded-lg p-4 border border-purple-500/30 mb-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Emoji emoji={config.emoji} size={24} />
            <span className="text-xl text-white font-bold">{config.name}</span>
          </div>
          <div className="text-2xl text-purple-300 font-bold">
            Tier 2
          </div>
        </div>

        {/* 강화 효과 설명 */}
        <div className="bg-dark-700/50 rounded-lg p-4 mb-6 text-left">
          <h3 className="text-lg font-bold text-purple-300 mb-2 text-center">
            모든 스탯 20% 증가!
          </h3>
          <ul className="text-sm text-gray-300 space-y-1">
            <li className="flex items-center gap-2">
              <span className="text-green-400">▲</span>
              <span>HP +20%</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-400">▲</span>
              <span>공격력 +20%</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-400">▲</span>
              <span>공격 속도 +20%</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-400">▲</span>
              <span>이동 속도 +20%</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-400">▲</span>
              <span>사거리 +20%</span>
            </li>
          </ul>
        </div>

        {/* 새 이미지 안내 */}
        <p className="text-sm text-gray-400 mb-4">
          캐릭터의 외형이 더욱 강력해졌습니다!
        </p>

        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white font-bold rounded-lg transition-colors cursor-pointer"
        >
          확인
        </button>
      </div>
    </div>
  );
};
