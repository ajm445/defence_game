import React, { useEffect, useRef } from 'react';
import { useTutorialStore, TUTORIAL_STEPS, TutorialConditionType } from '../../stores/useTutorialStore';
import { useGameStore } from '../../stores/useGameStore';

export const TutorialOverlay: React.FC = () => {
  const isActive = useTutorialStore((state) => state.isActive);
  const currentStepIndex = useTutorialStore((state) => state.currentStepIndex);
  const showOverlay = useTutorialStore((state) => state.showOverlay);
  const nextStep = useTutorialStore((state) => state.nextStep);
  const setShowOverlay = useTutorialStore((state) => state.setShowOverlay);
  const endTutorial = useTutorialStore((state) => state.endTutorial);
  const herbSold = useTutorialStore((state) => state.herbSold);

  // 게임 상태 구독
  const units = useGameStore((state) => state.units);
  const resources = useGameStore((state) => state.resources);
  const walls = useGameStore((state) => state.walls);
  const playerBase = useGameStore((state) => state.playerBase);
  const enemyBase = useGameStore((state) => state.enemyBase);

  const currentStep = TUTORIAL_STEPS[currentStepIndex];
  const isLastStep = currentStepIndex === TUTORIAL_STEPS.length - 1;

  // 중복 진행 방지를 위한 ref
  const lastCompletedStepRef = useRef<number>(-1);

  // 조건 확인 함수
  const checkCondition = (conditionType: TutorialConditionType): boolean => {
    switch (conditionType) {
      case 'none':
        return false;
      case 'has_melee':
        return units.some((u) => u.type === 'melee');
      case 'has_ranged':
        return units.some((u) => u.type === 'ranged');
      case 'has_knight':
        return units.some((u) => u.type === 'knight');
      case 'has_mage':
        return units.some((u) => u.type === 'mage');
      case 'has_woodcutter':
        return units.some((u) => u.type === 'woodcutter');
      case 'has_miner':
        return units.some((u) => u.type === 'miner');
      case 'has_gatherer':
        return units.some((u) => u.type === 'gatherer');
      case 'has_goldminer':
        return units.some((u) => u.type === 'goldminer');
      case 'has_healer':
        return units.some((u) => u.type === 'healer');
      case 'has_wood':
        return resources.wood >= 10;
      case 'has_stone':
        return resources.stone >= 10;
      case 'has_herb':
        return resources.herb >= 5;
      case 'has_wall':
        return walls.length > 0;
      case 'has_upgrade':
        return (playerBase.upgradeLevel ?? 0) >= 1;
      case 'sold_herb':
        return herbSold;
      case 'enemy_destroyed':
        return enemyBase.hp <= 0;
      default:
        return false;
    }
  };

  // 조건 충족 시 자동으로 다음 단계로
  useEffect(() => {
    if (!isActive || !currentStep) return;
    if (currentStep.conditionType === 'none') return;
    if (isLastStep) return;

    if (lastCompletedStepRef.current >= currentStepIndex) return;

    if (checkCondition(currentStep.conditionType)) {
      lastCompletedStepRef.current = currentStepIndex;
      nextStep();
    }
  }, [isActive, currentStep, currentStepIndex, isLastStep, units, resources, walls, playerBase.upgradeLevel, enemyBase.hp, herbSold, nextStep]);

  // 튜토리얼 시작 시 ref 리셋
  useEffect(() => {
    if (isActive && currentStepIndex === 0) {
      lastCompletedStepRef.current = -1;
    }
  }, [isActive, currentStepIndex]);

  if (!isActive || !currentStep) return null;

  // 오버레이가 숨겨진 상태면 미니 표시
  if (!showOverlay) {
    return (
      <button
        onClick={() => setShowOverlay(true)}
        className="fixed top-4 left-4 z-50 bg-dark-800/90 border border-neon-cyan/50 rounded-lg px-3 py-2 text-neon-cyan text-sm hover:bg-dark-700 transition-colors"
      >
        <span className="mr-2">📖</span>
        튜토리얼 ({currentStepIndex + 1}/{TUTORIAL_STEPS.length})
      </button>
    );
  }

  return (
    <div className="fixed top-4 left-4 z-40 pointer-events-auto">
      {/* 튜토리얼 패널 - 좌측 상단 고정 */}
      <div className="bg-dark-800/95 border-2 border-neon-cyan rounded-xl p-4 w-80 shadow-lg shadow-neon-cyan/20">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">📖</span>
            <span className="text-neon-cyan font-bold text-sm">튜토리얼</span>
          </div>
          <span className="text-gray-400 text-xs">
            {currentStepIndex + 1} / {TUTORIAL_STEPS.length}
          </span>
        </div>

        {/* 진행 바 */}
        <div className="h-1 bg-dark-600 rounded-full mb-3 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-neon-cyan to-neon-blue transition-all duration-300"
            style={{ width: `${((currentStepIndex + 1) / TUTORIAL_STEPS.length) * 100}%` }}
          />
        </div>

        {/* 제목 */}
        <h3 className="text-white text-sm font-bold mb-2">{currentStep.title}</h3>

        {/* 설명 */}
        <p className="text-gray-300 text-xs whitespace-pre-line leading-relaxed mb-3">
          {currentStep.description}
        </p>

        {/* 버튼 */}
        <div className="flex gap-2 justify-end">
          {/* 최소화 버튼 */}
          <button
            onClick={() => setShowOverlay(false)}
            className="px-2 py-1 text-gray-400 text-xs hover:text-white transition-colors"
          >
            최소화
          </button>

          {/* 건너뛰기 버튼 */}
          <button
            onClick={endTutorial}
            className="px-3 py-1 bg-dark-600 text-gray-300 rounded text-xs hover:bg-dark-500 transition-colors"
          >
            건너뛰기
          </button>

          {/* 다음 버튼 (none 조건 단계에서만) */}
          {currentStep.conditionType === 'none' && (
            <button
              onClick={nextStep}
              className="px-3 py-1 bg-gradient-to-r from-neon-cyan to-neon-blue text-dark-900 rounded text-xs font-bold hover:opacity-90 transition-opacity"
            >
              다음
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
