import React, { useEffect, useRef } from 'react';
import {
  useRPGTutorialStore,
  useTutorialActive,
  useTutorialStep,
  useTutorialStepIndex,
  useTutorialMinimized,
  useTutorialCompleted,
  useTutorialConditions,
  RPG_TUTORIAL_STEPS,
} from '../../stores/useRPGTutorialStore';
import { useUIStore } from '../../stores/useUIStore';
import { soundManager } from '../../services/SoundManager';

interface RPGTutorialOverlayProps {
  onSkip: () => void;
  onComplete: () => void;
}

export const RPGTutorialOverlay: React.FC<RPGTutorialOverlayProps> = ({
  onSkip,
  onComplete,
}) => {
  const isActive = useTutorialActive();
  const currentStep = useTutorialStep();
  const currentStepIndex = useTutorialStepIndex();
  const isMinimized = useTutorialMinimized();
  const isCompleted = useTutorialCompleted();
  const conditions = useTutorialConditions();
  const isTouchDevice = useUIStore((s) => s.isTouchDevice);

  const nextStep = useRPGTutorialStore((state) => state.nextStep);
  const prevStep = useRPGTutorialStore((state) => state.prevStep);
  const toggleMinimize = useRPGTutorialStore((state) => state.toggleMinimize);
  const skipTutorial = useRPGTutorialStore((state) => state.skipTutorial);

  const autoAdvanceTimerRef = useRef<number | null>(null);

  // 조건 충족 시 자동 진행 (1.5초 딜레이)
  useEffect(() => {
    if (!isActive || !currentStep || isCompleted) return;

    const conditionMet = conditions[currentStep.conditionType];

    if (conditionMet && currentStep.conditionType !== 'none') {
      // 자동 진행 딜레이
      autoAdvanceTimerRef.current = window.setTimeout(() => {
        soundManager.play('ui_click');
        nextStep();
      }, 1500);

      return () => {
        if (autoAdvanceTimerRef.current) {
          clearTimeout(autoAdvanceTimerRef.current);
        }
      };
    }
  }, [isActive, currentStep, conditions, isCompleted, nextStep]);

  // 튜토리얼 완료 시 콜백
  useEffect(() => {
    if (isCompleted) {
      onComplete();
    }
  }, [isCompleted, onComplete]);

  if (!isActive || !currentStep) return null;

  const displayTitle = (isTouchDevice && currentStep.touchTitle) || currentStep.title;
  const displayDescription = (isTouchDevice && currentStep.touchDescription) || currentStep.description;
  const progress = ((currentStepIndex + 1) / RPG_TUTORIAL_STEPS.length) * 100;
  const isConditionMet = conditions[currentStep.conditionType];
  const canManualAdvance = currentStep.conditionType === 'none' || isConditionMet;

  const handleNext = () => {
    if (canManualAdvance) {
      soundManager.play('ui_click');
      nextStep();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      soundManager.play('ui_click');
      prevStep();
    }
  };

  const handleSkip = () => {
    soundManager.play('ui_click');
    skipTutorial();
    onSkip();
  };

  const handleToggleMinimize = () => {
    soundManager.play('ui_click');
    toggleMinimize();
  };

  // 최소화 상태
  if (isMinimized) {
    return (
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={handleToggleMinimize}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 rounded-lg shadow-lg border border-green-400/50 hover:from-green-500 hover:to-green-600 transition-all cursor-pointer"
        >
          <span className="text-lg">📖</span>
          <span className="text-white font-bold text-sm">
            튜토리얼 ({currentStepIndex + 1}/{RPG_TUTORIAL_STEPS.length})
          </span>
          <span className="text-green-200">▼</span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed top-4 right-4 z-50 w-[90vw] sm:w-[360px] max-w-[360px]">
      {/* 메인 패널 */}
      <div className="bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95 rounded-xl border-2 border-green-500/50 shadow-2xl backdrop-blur-sm">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-green-500/30 bg-green-900/30 rounded-t-xl">
          <div className="flex items-center gap-2">
            <span className="text-xl">📖</span>
            <span className="text-green-400 font-bold">튜토리얼</span>
            <span className="text-gray-400 text-sm">
              ({currentStepIndex + 1}/{RPG_TUTORIAL_STEPS.length})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleMinimize}
              className="text-gray-400 hover:text-white transition-colors p-1 cursor-pointer"
              title="최소화"
            >
              ▲
            </button>
            <button
              onClick={handleSkip}
              className="text-gray-400 hover:text-red-400 transition-colors text-xs px-2 py-1 border border-gray-600 rounded hover:border-red-500 cursor-pointer"
              title="건너뛰기"
            >
              건너뛰기
            </button>
          </div>
        </div>

        {/* 진행 바 */}
        <div className="px-4 pt-3">
          <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* 단계 제목 */}
        <div className="px-4 pt-3">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-green-400">#{currentStepIndex + 1}</span>
            {displayTitle}
            {isConditionMet && currentStep.conditionType !== 'none' && (
              <span className="text-green-400 text-sm ml-auto animate-pulse">✓ 완료!</span>
            )}
          </h3>
        </div>

        {/* 설명 */}
        <div className="px-4 py-3">
          <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">
            {displayDescription}
          </p>
        </div>

        {/* 조건 힌트 (자동 진행 조건이 있는 경우) */}
        {currentStep.conditionType !== 'none' && !isConditionMet && (
          <div className="px-4 pb-3">
            <div className="flex items-center gap-2 text-yellow-400 text-xs bg-yellow-900/20 rounded-lg px-3 py-2 border border-yellow-500/30">
              <span className="animate-pulse">⏳</span>
              <span>조건을 충족하면 자동으로 다음 단계로 넘어갑니다</span>
            </div>
          </div>
        )}

        {/* 버튼 */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700/50 bg-slate-900/50 rounded-b-xl">
          <button
            onClick={handlePrev}
            disabled={currentStepIndex === 0}
            className="px-4 py-2 text-sm text-gray-400 border border-gray-600 rounded-lg hover:text-white hover:border-gray-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            ◀ 이전
          </button>

          <button
            onClick={handleNext}
            disabled={!canManualAdvance}
            className={`px-6 py-2 text-sm font-bold rounded-lg transition-all cursor-pointer ${
              canManualAdvance
                ? 'bg-gradient-to-r from-green-600 to-green-500 text-white hover:from-green-500 hover:to-green-400 shadow-lg shadow-green-500/30'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            {currentStepIndex === RPG_TUTORIAL_STEPS.length - 1 ? '완료' : '다음 ▶'}
          </button>
        </div>
      </div>
    </div>
  );
};
