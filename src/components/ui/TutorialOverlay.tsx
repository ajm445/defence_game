import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTutorialStore, TUTORIAL_STEPS, TutorialConditionType, HighlightTarget } from '../../stores/useTutorialStore';
import { useGameStore } from '../../stores/useGameStore';
import { useUIStore } from '../../stores/useUIStore';
import { Emoji } from '../common/Emoji';

// 하이라이트 요소의 위치 정보
interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

// 터치 환경용 설명 변환
function adaptForTouch(description: string, stepId: string): string {
  if (stepId === 'camera') {
    return '넓은 전장을 살펴보세요!\n\n• 한 손가락 드래그: 화면 이동\n• 두 손가락 핀치: 확대/축소';
  }

  return description
    .replace(/\(Q\)/g, '')
    .replace(/\(W\)/g, '')
    .replace(/\(E\)/g, '')
    .replace(/클릭/g, '터치');
}

export const TutorialOverlay: React.FC = () => {
  const isActive = useTutorialStore((state) => state.isActive);
  const currentStepIndex = useTutorialStore((state) => state.currentStepIndex);
  const showOverlay = useTutorialStore((state) => state.showOverlay);
  const nextStep = useTutorialStore((state) => state.nextStep);
  const setShowOverlay = useTutorialStore((state) => state.setShowOverlay);
  const endTutorial = useTutorialStore((state) => state.endTutorial);
  const herbSold = useTutorialStore((state) => state.herbSold);
  const mineExploded = useTutorialStore((state) => state.mineExploded);
  const isTouchDevice = useUIStore((state) => state.isTouchDevice);

  // 게임 상태 구독
  const units = useGameStore((state) => state.units);
  const resources = useGameStore((state) => state.resources);
  const mines = useGameStore((state) => state.mines);
  const playerBase = useGameStore((state) => state.playerBase);
  const enemyBase = useGameStore((state) => state.enemyBase);

  const currentStep = TUTORIAL_STEPS[currentStepIndex];
  const isLastStep = currentStepIndex === TUTORIAL_STEPS.length - 1;

  // 중복 진행 방지를 위한 ref
  const lastCompletedStepRef = useRef<number>(-1);

  // 스텝 진입 시간 추적 (minDisplayTime 구현용)
  const stepEnteredAtRef = useRef<number>(Date.now());

  // 하이라이트 요소 위치 상태
  const [highlightRect, setHighlightRect] = useState<HighlightRect | null>(null);

  // 하이라이트 대상 요소 찾기
  const findHighlightElement = useCallback((target: HighlightTarget): HTMLElement | null => {
    if (!target) return null;
    return document.querySelector(`[data-tutorial-id="${target}"]`);
  }, []);

  // 하이라이트 요소 위치 업데이트
  const updateHighlightRect = useCallback(() => {
    if (!currentStep?.highlight) {
      setHighlightRect(null);
      return;
    }

    const element = findHighlightElement(currentStep.highlight);
    if (element) {
      const rect = element.getBoundingClientRect();
      const padding = 8; // 여백
      setHighlightRect({
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      });
    } else {
      setHighlightRect(null);
    }
  }, [currentStep?.highlight, findHighlightElement]);

  // 하이라이트 위치 주기적 업데이트
  useEffect(() => {
    if (!isActive || !showOverlay) return;

    updateHighlightRect();
    const interval = setInterval(updateHighlightRect, 100);

    return () => clearInterval(interval);
  }, [isActive, showOverlay, currentStepIndex, updateHighlightRect]);

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
      case 'has_herb_30':
        return resources.herb >= 30;
      case 'has_mine':
        return mines.length > 0;
      case 'mine_exploded':
        return mineExploded;
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
      // minDisplayTime이 있으면 최소 표시 시간만큼 대기
      const minTime = currentStep.minDisplayTime;
      if (minTime) {
        const elapsed = (Date.now() - stepEnteredAtRef.current) / 1000;
        if (elapsed < minTime) {
          // 남은 시간 후 재체크
          const remaining = (minTime - elapsed) * 1000;
          const timer = setTimeout(() => {
            // 다시 조건 확인 후 진행
            if (lastCompletedStepRef.current < currentStepIndex) {
              lastCompletedStepRef.current = currentStepIndex;
              nextStep();
            }
          }, remaining + 500);
          return () => clearTimeout(timer);
        }
      }

      lastCompletedStepRef.current = currentStepIndex;
      // 약간의 딜레이 후 다음 단계로
      setTimeout(() => {
        nextStep();
      }, 500);
    }
  }, [isActive, currentStep, currentStepIndex, isLastStep, units, resources, mines, playerBase.upgradeLevel, enemyBase.hp, herbSold, mineExploded, nextStep]);

  // 튜토리얼 시작 시 ref 리셋
  useEffect(() => {
    if (isActive && currentStepIndex === 0) {
      lastCompletedStepRef.current = -1;
    }
  }, [isActive, currentStepIndex]);

  // 스텝 변경 시 진입 시간 기록
  useEffect(() => {
    stepEnteredAtRef.current = Date.now();
  }, [currentStepIndex]);

  if (!isActive || !currentStep) return null;

  // 오버레이가 숨겨진 상태면 미니 표시
  if (!showOverlay) {
    return (
      <button
        onClick={() => setShowOverlay(true)}
        className="fixed top-20 left-4 z-50 bg-dark-800/90 border border-neon-cyan/50 rounded-lg px-3 py-2 text-neon-cyan text-sm hover:bg-dark-700 transition-colors animate-pulse"
      >
        <Emoji emoji="📖" size={14} className="mr-2" />
        튜토리얼 ({currentStepIndex + 1}/{TUTORIAL_STEPS.length})
      </button>
    );
  }

  // 패널 위치 계산 (하이라이트 요소 기준)
  const getPanelPosition = (): React.CSSProperties => {
    if (!highlightRect) {
      // 하이라이트 없으면 화면 중앙 상단
      return {
        top: '120px',
        left: '50%',
        transform: 'translateX(-50%)',
      };
    }

    const panelWidth = 380;
    const panelHeight = 400; // 대략적인 높이
    const margin = 20;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // 하이라이트 요소의 중심
    const highlightCenterX = highlightRect.left + highlightRect.width / 2;
    const highlightCenterY = highlightRect.top + highlightRect.height / 2;

    // 기본: 하이라이트 요소 위에 배치
    let top = highlightRect.top - panelHeight - margin;
    let left = highlightCenterX - panelWidth / 2;

    // 위에 공간이 없으면 아래에 배치
    if (top < 80) {
      top = highlightRect.top + highlightRect.height + margin;
    }

    // 아래에도 공간이 없으면 옆에 배치
    if (top + panelHeight > viewportHeight - 20) {
      top = Math.max(80, highlightCenterY - panelHeight / 2);
      // 왼쪽 또는 오른쪽에 배치
      if (highlightRect.left > viewportWidth / 2) {
        left = highlightRect.left - panelWidth - margin;
      } else {
        left = highlightRect.left + highlightRect.width + margin;
      }
    }

    // 화면 밖으로 나가지 않도록 조정
    left = Math.max(margin, Math.min(left, viewportWidth - panelWidth - margin));
    top = Math.max(80, Math.min(top, viewportHeight - panelHeight - margin));

    return { top: `${top}px`, left: `${left}px` };
  };

  return (
    <>
      {/* 어두운 오버레이 (하이라이트 요소 제외) */}
      {highlightRect && (
        <div className="fixed inset-0 z-40 pointer-events-none">
          {/* SVG로 스포트라이트 효과 구현 */}
          <svg className="w-full h-full">
            <defs>
              <mask id="spotlight-mask">
                <rect width="100%" height="100%" fill="white" />
                <rect
                  x={highlightRect.left}
                  y={highlightRect.top}
                  width={highlightRect.width}
                  height={highlightRect.height}
                  rx="12"
                  ry="12"
                  fill="black"
                />
              </mask>
            </defs>
            <rect
              width="100%"
              height="100%"
              fill="rgba(0, 0, 0, 0.75)"
              mask="url(#spotlight-mask)"
            />
          </svg>

          {/* 하이라이트 테두리 애니메이션 */}
          <div
            className="absolute border-2 border-neon-cyan rounded-xl animate-pulse"
            style={{
              top: highlightRect.top,
              left: highlightRect.left,
              width: highlightRect.width,
              height: highlightRect.height,
              boxShadow: '0 0 20px rgba(0, 255, 255, 0.5), 0 0 40px rgba(0, 255, 255, 0.3)',
            }}
          />

          {/* 클릭 유도 화살표 */}
          <div
            className="absolute animate-bounce"
            style={{
              top: highlightRect.top - 40,
              left: highlightRect.left + highlightRect.width / 2 - 16,
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 4L12 20M12 20L6 14M12 20L18 14" stroke="#00FFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      )}

      {/* 하이라이트 없을 때 전체 어두운 배경 */}
      {!highlightRect && currentStep.conditionType !== 'none' && (
        <div className="fixed inset-0 z-40 bg-black/60 pointer-events-none" />
      )}

      {/* 튜토리얼 패널 */}
      <div
        className="fixed z-50 pointer-events-auto"
        style={getPanelPosition()}
      >
        <div className="bg-dark-900/95 border-2 border-neon-cyan rounded-2xl p-5 w-[380px] shadow-2xl shadow-neon-cyan/30 backdrop-blur-sm">
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Emoji emoji="📖" size={24} />
              <span className="text-neon-cyan font-bold">튜토리얼</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">
                {currentStepIndex + 1} / {TUTORIAL_STEPS.length}
              </span>
              <button
                onClick={() => setShowOverlay(false)}
                className="text-gray-500 hover:text-gray-300 transition-colors"
                title="최소화"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

          {/* 진행 바 */}
          <div className="h-2 bg-dark-600 rounded-full mb-4 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-neon-cyan to-neon-blue transition-all duration-500 ease-out"
              style={{ width: `${((currentStepIndex + 1) / TUTORIAL_STEPS.length) * 100}%` }}
            />
          </div>

          {/* 제목 */}
          <h3 className="text-white text-lg font-bold mb-3">{currentStep.title}</h3>

          {/* 설명 */}
          <div className="text-gray-300 text-sm whitespace-pre-line leading-relaxed mb-4 max-h-[200px] overflow-y-auto">
            {isTouchDevice ? adaptForTouch(currentStep.description, currentStep.id) : currentStep.description}
          </div>

          {/* 조건 힌트 */}
          {currentStep.conditionHint && currentStep.conditionType !== 'none' && (
            <div className="bg-neon-cyan/10 border border-neon-cyan/30 rounded-lg px-3 py-2 mb-4">
              <div className="flex items-center gap-2 text-neon-cyan text-sm">
                <span className="animate-pulse"><Emoji emoji="👆" size={14} /></span>
                <span>{isTouchDevice ? currentStep.conditionHint.replace(/클릭/g, '터치') : currentStep.conditionHint}</span>
              </div>
            </div>
          )}

          {/* 버튼 */}
          <div className="flex gap-2 justify-end">
            {/* 건너뛰기 버튼 */}
            <button
              onClick={endTutorial}
              className="px-4 py-2 bg-dark-600 text-gray-300 rounded-lg text-sm hover:bg-dark-500 transition-colors"
            >
              건너뛰기
            </button>

            {/* 다음 버튼 (none 조건 단계에서만) */}
            {currentStep.conditionType === 'none' && (
              <button
                onClick={nextStep}
                className="px-4 py-2 bg-gradient-to-r from-neon-cyan to-neon-blue text-dark-900 rounded-lg text-sm font-bold hover:opacity-90 transition-opacity"
              >
                다음 →
              </button>
            )}

            {/* 마지막 단계에서 완료 버튼 */}
            {isLastStep && currentStep.conditionType !== 'none' && (
              <button
                onClick={endTutorial}
                className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg text-sm font-bold hover:opacity-90 transition-opacity"
              >
                튜토리얼 완료
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
