import React, { useState, useEffect } from 'react';
import { DifficultyRanking, RankingDifficulty, getDifficultyRankings } from '../../services/rankingService';
import { CLASS_CONFIGS, ADVANCED_CLASS_CONFIGS } from '../../constants/rpgConfig';
import { HeroClass, AdvancedHeroClass } from '../../types/rpg';
import { soundManager } from '../../services/SoundManager';

interface RankingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type PlayerCountTab = 1 | 2 | 3 | 4;

const DIFFICULTY_TABS: { key: RankingDifficulty; label: string; color: string; borderColor: string; bgColor: string }[] = [
  { key: 'extreme', label: '극한', color: 'text-red-400', borderColor: 'border-red-500', bgColor: 'bg-red-500/20' },
  { key: 'hell', label: '지옥', color: 'text-orange-400', borderColor: 'border-orange-500', bgColor: 'bg-orange-500/20' },
  { key: 'apocalypse', label: '종말', color: 'text-purple-400', borderColor: 'border-purple-500', bgColor: 'bg-purple-500/20' },
];

// 시간 포맷팅 (초 -> "X분 XX초")
const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}분 ${secs.toString().padStart(2, '0')}초`;
};

// 플레이어 정보 표시
const PlayerInfo: React.FC<{
  nickname: string;
  heroClass: HeroClass;
  advancedClass?: AdvancedHeroClass;
  characterLevel: number;
}> = ({ nickname, heroClass, advancedClass, characterLevel }) => {
  const baseConfig = CLASS_CONFIGS[heroClass];
  const advConfig = advancedClass ? ADVANCED_CLASS_CONFIGS[advancedClass] : null;

  // 방어 코드: heroClass가 유효하지 않은 경우 기본값 사용
  if (!baseConfig) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-lg">❓</span>
        <span className="text-white font-medium">{nickname}</span>
        <span className="text-gray-500 text-xs">(Lv.{characterLevel})</span>
      </div>
    );
  }

  const displayEmoji = advConfig ? advConfig.emoji : baseConfig.emoji;
  const displayName = advConfig ? advConfig.name : baseConfig.name;

  return (
    <div className="flex items-center gap-2">
      <span className="text-lg">{displayEmoji}</span>
      <span className="text-white font-medium">{nickname}</span>
      <span className="text-gray-500 text-xs">
        ({displayName} Lv.{characterLevel})
      </span>
    </div>
  );
};

export const RankingModal: React.FC<RankingModalProps> = ({ isOpen, onClose }) => {
  const [selectedDifficulty, setSelectedDifficulty] = useState<RankingDifficulty>('extreme');
  const [activeTab, setActiveTab] = useState<PlayerCountTab>(1);
  const [rankings, setRankings] = useState<DifficultyRanking[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const currentDiffTab = DIFFICULTY_TABS.find(d => d.key === selectedDifficulty)!;

  // ESC 키로 닫기
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // 랭킹 데이터 로드
  useEffect(() => {
    if (!isOpen) return;

    const fetchRankings = async () => {
      setIsLoading(true);
      const data = await getDifficultyRankings(selectedDifficulty, activeTab);
      setRankings(data);
      setIsLoading(false);
    };

    fetchRankings();
  }, [isOpen, selectedDifficulty, activeTab]);

  if (!isOpen) return null;

  const handleDifficultyChange = (diff: RankingDifficulty) => {
    soundManager.play('ui_click');
    setSelectedDifficulty(diff);
  };

  const handleTabChange = (tab: PlayerCountTab) => {
    soundManager.play('ui_click');
    setActiveTab(tab);
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="relative w-[95vw] max-w-[700px] max-h-[85vh] bg-gray-900/95 border border-gray-700 rounded-2xl overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏆</span>
            <h1 className="text-xl font-bold text-white">
              <span className={currentDiffTab.color}>{currentDiffTab.label}</span> 난이도 랭킹
            </h1>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* 난이도 탭 */}
        <div className="flex gap-2 px-6 py-3 border-b border-gray-700/50">
          {DIFFICULTY_TABS.map((diff) => (
            <button
              key={diff.key}
              onClick={() => handleDifficultyChange(diff.key)}
              className={`
                px-4 py-2 rounded-lg font-bold text-sm transition-all cursor-pointer
                ${selectedDifficulty === diff.key
                  ? `${diff.bgColor} ${diff.color} border ${diff.borderColor}`
                  : 'bg-gray-800/50 text-gray-400 border border-gray-700 hover:bg-gray-800 hover:text-gray-300'}
              `}
            >
              {diff.label}
            </button>
          ))}
        </div>

        {/* 인원수 탭 */}
        <div className="flex gap-2 px-6 py-3 border-b border-gray-700/50">
          {([1, 2, 3, 4] as PlayerCountTab[]).map((count) => (
            <button
              key={count}
              onClick={() => handleTabChange(count)}
              className={`
                px-4 py-2 rounded-lg font-bold text-sm transition-all cursor-pointer
                ${activeTab === count
                  ? `${currentDiffTab.bgColor} ${currentDiffTab.color} border ${currentDiffTab.borderColor}`
                  : 'bg-gray-800/50 text-gray-400 border border-gray-700 hover:bg-gray-800 hover:text-gray-300'}
              `}
            >
              {count}인
            </button>
          ))}
        </div>

        {/* 랭킹 목록 */}
        <div className="p-6 overflow-y-auto max-h-[calc(85vh-210px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-400 animate-pulse">로딩 중...</div>
            </div>
          ) : rankings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <span className="text-4xl mb-3">📭</span>
              <p className="text-gray-400">아직 클리어 기록이 없습니다.</p>
              <p className="text-gray-500 text-sm mt-1">
                {activeTab}인 {currentDiffTab.label} 난이도를 클리어하고 첫 기록을 세워보세요!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* 테이블 헤더 */}
              <div className="grid grid-cols-[60px_120px_1fr] gap-4 px-4 py-2 text-sm text-gray-500 border-b border-gray-700">
                <div className="text-center">순위</div>
                <div>클리어 시간</div>
                <div>플레이어</div>
              </div>

              {/* 랭킹 항목 */}
              {rankings.map((ranking, index) => {
                const rank = index + 1;
                const isTop3 = rank <= 3;
                const rankColors = {
                  1: 'text-yellow-400',
                  2: 'text-gray-300',
                  3: 'text-amber-600',
                };
                const rankEmoji = {
                  1: '🥇',
                  2: '🥈',
                  3: '🥉',
                };

                return (
                  <div
                    key={ranking.id}
                    className={`
                      grid grid-cols-[60px_120px_1fr] gap-4 px-4 py-3 rounded-lg
                      ${isTop3 ? 'bg-gray-800/50 border border-gray-700' : 'bg-gray-800/30'}
                    `}
                  >
                    {/* 순위 */}
                    <div className={`text-center font-bold ${isTop3 ? rankColors[rank as 1 | 2 | 3] : 'text-gray-400'}`}>
                      {isTop3 ? (
                        <span className="text-lg">{rankEmoji[rank as 1 | 2 | 3]}</span>
                      ) : (
                        rank
                      )}
                    </div>

                    {/* 클리어 시간 */}
                    <div className="text-neon-cyan font-bold">
                      {formatTime(ranking.clear_time)}
                    </div>

                    {/* 플레이어 목록 */}
                    <div className="space-y-1">
                      {ranking.players.map((player, playerIndex) => (
                        <PlayerInfo
                          key={`${ranking.id}-${playerIndex}`}
                          nickname={player.nickname}
                          heroClass={player.heroClass}
                          advancedClass={player.advancedClass}
                          characterLevel={player.characterLevel}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
