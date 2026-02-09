import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { useGameStore } from '../../stores/useGameStore';
import { AI_DIFFICULTY_CONFIG } from '../../constants/config';
import { AIDifficulty } from '../../types';
import { soundManager } from '../../services/SoundManager';
import { ProfileButton } from '../ui/ProfileButton';
import { FriendSidebar } from '../ui/FriendSidebar';

const difficulties: AIDifficulty[] = ['easy', 'normal', 'hard', 'nightmare'];

const difficultyStars: Record<AIDifficulty, string> = {
  easy: '★☆☆☆☆',
  normal: '★★★☆☆',
  hard: '★★★★★',
  nightmare: '💀',
  bosstest: '🧪',
};

const difficultyColors: Record<AIDifficulty, string> = {
  easy: 'from-green-500/20 to-green-600/20 border-green-500',
  normal: 'from-yellow-500/20 to-yellow-600/20 border-yellow-500',
  hard: 'from-red-500/20 to-red-600/20 border-red-500',
  nightmare: 'from-purple-500/20 to-purple-900/20 border-purple-500',
  bosstest: 'from-cyan-500/20 to-cyan-600/20 border-cyan-500',
};

export const DifficultySelectScreen: React.FC = () => {
  const setScreen = useUIStore((state) => state.setScreen);
  const setSelectedDifficulty = useUIStore((state) => state.setSelectedDifficulty);
  const initGame = useGameStore((state) => state.initGame);

  const [hoveredDifficulty, setHoveredDifficulty] = useState<AIDifficulty>('easy');

  const resetGameUI = useUIStore((state) => state.resetGameUI);

  const handleSelectDifficulty = (difficulty: AIDifficulty) => {
    soundManager.play('ui_click');
    setSelectedDifficulty(difficulty);
    resetGameUI(); // UI 상태 초기화
    initGame('ai', difficulty);
    // 카운트다운 화면으로 이동 (게임은 카운트다운 후 시작)
    setScreen('countdown');
  };

  return (
    <div className="fixed inset-0 bg-menu-gradient grid-overlay flex overflow-hidden">
      {/* 배경 효과 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 bg-neon-cyan/5 rounded-full blur-3xl animate-pulse-slow" style={{ width: 'min(24rem, 50vw)', height: 'min(24rem, 50vw)' }} />
        <div className="absolute bottom-1/4 right-1/4 bg-neon-purple/5 rounded-full blur-3xl animate-pulse-slow" style={{ width: 'min(24rem, 50vw)', height: 'min(24rem, 50vw)', animationDelay: '1s' }} />
      </div>

      {/* 왼쪽 상단 프로필 버튼 */}
      <div className="absolute z-20" style={{ top: 'clamp(1rem, 3vw, 2rem)', left: 'clamp(1rem, 3vw, 2rem)' }}>
        <ProfileButton />
      </div>

      {/* 메인 컨텐츠 영역 */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="relative z-10 flex flex-col items-center animate-fade-in" style={{ padding: '0 clamp(1rem, 4vw, 2rem)' }}>
          {/* 타이틀 */}
          <h1 className="font-game text-neon-cyan" style={{ fontSize: 'clamp(1.5rem, 4vw, 2.25rem)', marginBottom: 'clamp(0.5rem, 1.5vh, 1rem)' }}>
            AI 난이도 선택
          </h1>
          <p className="text-gray-400" style={{ fontSize: 'clamp(0.75rem, 2vw, 1rem)', marginBottom: 'clamp(1rem, 3vh, 2rem)' }}>난이도를 선택하세요</p>

          <div style={{ height: 'clamp(1rem, 3vh, 1.875rem)' }} />

          {/* 난이도 버튼들 */}
          <div className="flex flex-wrap justify-center" style={{ padding: '0 clamp(0.5rem, 2vw, 1rem)', gap: 'clamp(0.5rem, 1.5vw, 1rem)', marginBottom: 'clamp(1rem, 3vh, 2rem)' }}>
            {difficulties.map((difficulty) => {
              const config = AI_DIFFICULTY_CONFIG[difficulty];
              const colors = difficultyColors[difficulty];
              const stars = difficultyStars[difficulty];

              return (
                <button
                  key={difficulty}
                  onClick={() => handleSelectDifficulty(difficulty)}
                  onMouseEnter={() => setHoveredDifficulty(difficulty)}
                  className="group relative rounded-lg overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
                  style={{ width: 'clamp(5rem, 14vw, 9rem)', height: 'clamp(7rem, 18vh, 12rem)' }}
                >
                  <div className={`absolute inset-0 bg-gradient-to-b ${colors.split(' ')[0]} ${colors.split(' ')[1]} group-hover:opacity-80 transition-all duration-300`} />
                  <div className={`absolute inset-0 border-2 ${colors.split(' ')[2]} rounded-lg group-hover:shadow-lg transition-all duration-300`} />

                  <div className="relative h-full flex flex-col items-center justify-center" style={{ padding: 'clamp(0.5rem, 1.5vw, 1rem)' }}>
                    <h2 className="font-game text-white" style={{ fontSize: 'clamp(0.75rem, 2vw, 1.25rem)', marginBottom: 'clamp(0.25rem, 0.75vh, 0.5rem)' }}>{config.name}</h2>
                    <div className="text-yellow-400 tracking-wider" style={{ fontSize: 'clamp(0.75rem, 1.8vw, 1.125rem)', marginBottom: 'clamp(0.375rem, 1vh, 0.75rem)' }}>
                      {stars}
                    </div>
                    <div className="text-gray-300" style={{ fontSize: 'clamp(0.5rem, 1.2vw, 0.75rem)' }}>
                      골드 {config.goldPerSecond}/초
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{ height: 'clamp(1rem, 3vh, 1.875rem)' }} />

          {/* 선택된 난이도 설명 */}
          <div className="bg-dark-800/80 border border-neon-cyan/20 rounded-lg" style={{ width: 'min(90vw, 32rem)', padding: 'clamp(0.75rem, 2vw, 1.5rem)', marginBottom: 'clamp(1rem, 3vh, 2rem)' }}>
            <h3 className="font-game text-neon-cyan" style={{ fontSize: 'clamp(0.875rem, 2.2vw, 1.125rem)', marginBottom: 'clamp(0.25rem, 0.75vh, 0.5rem)' }}>
              {AI_DIFFICULTY_CONFIG[hoveredDifficulty].name}
            </h3>

            <p className="text-gray-300" style={{ fontSize: 'clamp(0.625rem, 1.6vw, 0.875rem)', marginBottom: 'clamp(0.5rem, 1.5vh, 1rem)' }}>
              {AI_DIFFICULTY_CONFIG[hoveredDifficulty].description}
            </p>

            <div className="grid grid-cols-2" style={{ gap: 'clamp(0.5rem, 1.5vw, 1rem)', fontSize: 'clamp(0.5rem, 1.4vw, 0.875rem)' }}>
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

          <div style={{ height: 'clamp(1rem, 3vh, 1.875rem)' }} />

          {/* 뒤로 가기 */}
          <button
            onClick={() => {
              soundManager.play('ui_click');
              setScreen('modeSelect');
            }}
            className="rounded-lg border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white transition-all cursor-pointer"
            style={{ padding: 'clamp(0.4rem, 1.2vh, 0.75rem) clamp(1rem, 3vw, 2rem)', fontSize: 'clamp(0.75rem, 2vw, 1rem)' }}
          >
            뒤로 가기
          </button>
        </div>
      </div>

      {/* 오른쪽 친구 사이드바 */}
      <div className="relative z-20 h-full">
        <FriendSidebar />
      </div>

      {/* 코너 장식 */}
      <div className="absolute border-l-2 border-t-2 border-neon-cyan/30" style={{ top: 'clamp(0.5rem, 1vw, 1rem)', left: 'clamp(0.5rem, 1vw, 1rem)', width: 'clamp(2rem, 4vw, 4rem)', height: 'clamp(2rem, 4vw, 4rem)' }} />
      <div className="absolute border-l-2 border-b-2 border-neon-cyan/30" style={{ bottom: 'clamp(0.5rem, 1vw, 1rem)', left: 'clamp(0.5rem, 1vw, 1rem)', width: 'clamp(2rem, 4vw, 4rem)', height: 'clamp(2rem, 4vw, 4rem)' }} />
    </div>
  );
};
