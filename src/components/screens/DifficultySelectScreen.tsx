import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { useGameStore } from '../../stores/useGameStore';
import { AI_DIFFICULTY_CONFIG } from '../../constants/config';
import { AIDifficulty } from '../../types';

const difficulties: AIDifficulty[] = ['easy', 'normal', 'hard'];

const difficultyStars: Record<AIDifficulty, string> = {
  easy: '★☆☆☆☆',
  normal: '★★★☆☆',
  hard: '★★★★★',
};

const difficultyColors: Record<AIDifficulty, string> = {
  easy: 'from-green-500/20 to-green-600/20 border-green-500',
  normal: 'from-yellow-500/20 to-yellow-600/20 border-yellow-500',
  hard: 'from-red-500/20 to-red-600/20 border-red-500',
};

export const DifficultySelectScreen: React.FC = () => {
  const setScreen = useUIStore((state) => state.setScreen);
  const setSelectedDifficulty = useUIStore((state) => state.setSelectedDifficulty);
  const initGame = useGameStore((state) => state.initGame);
  const startGame = useGameStore((state) => state.startGame);

  const [hoveredDifficulty, setHoveredDifficulty] = useState<AIDifficulty>('easy');

  const handleSelectDifficulty = (difficulty: AIDifficulty) => {
    setSelectedDifficulty(difficulty);
    initGame(difficulty);
    startGame();
    setScreen('game');
  };

  return (
    <div className="fixed inset-0 bg-menu-gradient grid-overlay flex flex-col items-center justify-center overflow-hidden">
      {/* 배경 효과 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-neon-cyan/5 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-neon-purple/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
      </div>

      {/* 메인 컨텐츠 */}
      <div className="relative z-10 flex flex-col items-center animate-fade-in">
        {/* 타이틀 */}
        <h1 className="font-game text-3xl md:text-4xl text-neon-cyan mb-4">
          AI 난이도 선택
        </h1>
        <p className="text-gray-400 mb-8">난이도를 선택하세요</p>

        <div style={{ height: '30px' }} />

        {/* 난이도 버튼들 */}
        <div className="flex gap-6 mb-8">
          {difficulties.map((difficulty) => {
            const config = AI_DIFFICULTY_CONFIG[difficulty];
            const colors = difficultyColors[difficulty];
            const stars = difficultyStars[difficulty];

            return (
              <button
                key={difficulty}
                onClick={() => handleSelectDifficulty(difficulty)}
                onMouseEnter={() => setHoveredDifficulty(difficulty)}
                className={`group relative w-40 h-48 rounded-lg overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer`}
              >
                <div className={`absolute inset-0 bg-gradient-to-b ${colors.split(' ')[0]} ${colors.split(' ')[1]} group-hover:opacity-80 transition-all duration-300`} />
                <div className={`absolute inset-0 border-2 ${colors.split(' ')[2]} rounded-lg group-hover:shadow-lg transition-all duration-300`} />

                <div className="relative h-full flex flex-col items-center justify-center p-4">
                  <h2 className="font-game text-xl text-white mb-2">{config.name}</h2>
                  <div className="text-yellow-400 text-lg tracking-wider mb-3">
                    {stars}
                  </div>
                  <div className="text-gray-300 text-xs">
                    골드 {config.goldPerSecond}/초
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ height: '30px' }} />

        {/* 선택된 난이도 설명 */}
        <div className="w-full max-w-lg bg-dark-800/80 border border-neon-cyan/20 rounded-lg p-6 mb-8">
          <h3 className="font-game text-lg text-neon-cyan mb-2">
            {AI_DIFFICULTY_CONFIG[hoveredDifficulty].name}
          </h3>
          <p className="text-gray-300 text-sm mb-4">
            {AI_DIFFICULTY_CONFIG[hoveredDifficulty].description}
          </p>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">AI 골드 수입</span>
              <span className="text-white">{AI_DIFFICULTY_CONFIG[hoveredDifficulty].goldPerSecond}/초</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">행동 주기</span>
              <span className="text-white">{AI_DIFFICULTY_CONFIG[hoveredDifficulty].actionInterval}초</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">행동 확률</span>
              <span className="text-white">{Math.round(AI_DIFFICULTY_CONFIG[hoveredDifficulty].actionChance * 100)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">AI 초기 골드</span>
              <span className="text-white">{AI_DIFFICULTY_CONFIG[hoveredDifficulty].initialGold}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">적 기지 체력</span>
              <span className="text-red-400">{AI_DIFFICULTY_CONFIG[hoveredDifficulty].enemyBaseHp}</span>
            </div>
          </div>
        </div>

        <div style={{ height: '30px' }} />
        
        {/* 뒤로 가기 */}
        <button
          onClick={() => setScreen('modeSelect')}
          className="px-8 py-3 rounded-lg border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white transition-all cursor-pointer"
        >
          뒤로 가기
        </button>
      </div>

      {/* 코너 장식 */}
      <div className="absolute top-4 left-4 w-16 h-16 border-l-2 border-t-2 border-neon-cyan/30" />
      <div className="absolute top-4 right-4 w-16 h-16 border-r-2 border-t-2 border-neon-cyan/30" />
      <div className="absolute bottom-4 left-4 w-16 h-16 border-l-2 border-b-2 border-neon-cyan/30" />
      <div className="absolute bottom-4 right-4 w-16 h-16 border-r-2 border-b-2 border-neon-cyan/30" />
    </div>
  );
};
