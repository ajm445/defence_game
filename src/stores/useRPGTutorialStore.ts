import { create } from 'zustand';

// 튜토리얼 조건 타입
export type RPGTutorialConditionType =
  | 'none'              // 수동 넘기기
  | 'hero_moved'        // 영웅 이동
  | 'enemy_killed'      // 적 처치 (자동공격)
  | 'skill_w_used'      // W 스킬 사용 (Shift)
  | 'skill_e_used'      // E 스킬 사용 (R 궁극기)
  | 'upgrade_purchased' // 업그레이드 구매
  | 'base_destroyed'    // 적 기지 파괴
  | 'boss_killed';      // 보스 처치

// 튜토리얼 단계 정의
export interface RPGTutorialStep {
  id: string;
  title: string;
  description: string;
  conditionType: RPGTutorialConditionType;
  highlight?: string; // 하이라이트할 UI 요소 (선택적)
  touchTitle?: string; // 터치 디바이스 전용 제목
  touchDescription?: string; // 터치 디바이스 전용 설명
}

// 7단계 튜토리얼
export const RPG_TUTORIAL_STEPS: RPGTutorialStep[] = [
  {
    id: 'welcome',
    title: '환영합니다!',
    description: '넥서스 디펜스 RPG에 오신 것을 환영합니다!\n\n게임 목표:\n1. 넥서스(왼쪽 파란 건물)를 지키세요\n2. 적 기지(오른쪽 빨간 건물)를 파괴하세요\n3. 보스를 처치하면 승리!\n\n※ 튜토리얼은 적 기지 1개지만,\n실제 게임에서는 2개입니다.\n(멀티플레이 시 인원수에 따라 증가)\n\n준비가 되면 [다음] 버튼을 클릭하세요.',
    conditionType: 'none',
    touchDescription: '넥서스 디펜스 RPG에 오신 것을 환영합니다!\n\n게임 목표:\n1. 넥서스(왼쪽 파란 건물)를 지키세요\n2. 적 기지(오른쪽 빨간 건물)를 파괴하세요\n3. 보스를 처치하면 승리!\n\n※ 튜토리얼은 적 기지 1개지만,\n실제 게임에서는 2개입니다.\n(멀티플레이 시 인원수에 따라 증가)\n\n준비가 되면 [다음] 버튼을 터치하세요.',
  },
  {
    id: 'movement',
    title: 'WASD로 이동',
    description: 'WASD 키를 사용하여 영웅을 이동시킬 수 있습니다.\n\nW: 위, A: 왼쪽, S: 아래, D: 오른쪽\n\n화면에 표시된 3개의 지점을 순서대로 이동해보세요!',
    conditionType: 'hero_moved',
    highlight: 'hero',
    touchTitle: '조이스틱으로 이동',
    touchDescription: '왼쪽 하단을 터치하면 조이스틱이 나타납니다.\n\n조이스틱을 드래그하여 영웅을 이동시킬 수 있습니다.\n\n화면에 표시된 3개의 지점을 순서대로 이동해보세요!',
  },
  {
    id: 'combat',
    title: '자동 공격',
    description: '영웅은 사거리 내의 적을 자동으로 공격합니다!\n\nC 키를 누르면 공격 사거리를 확인할 수 있습니다.\n\n적에게 다가가서 자동 공격으로 적을 처치해보세요!',
    conditionType: 'enemy_killed',
    highlight: 'hero',
    touchDescription: '영웅은 사거리 내의 적을 자동으로 공격합니다!\n\n조이스틱으로 적에게 다가가면 자동 공격이 시작됩니다.\n\n적을 처치해보세요!',
  },
  {
    id: 'skill_shift',
    title: '일반 스킬 (Shift)',
    description: 'Shift 키를 눌러 일반 스킬을 사용할 수 있습니다.\n\n※ 스킬은 마우스 방향으로 발동됩니다!\n궁수의 경우: 관통 화살 - 마우스 방향으로 적을 관통!\n\n💡 팁: 하단 스킬바에 마우스를 올리면\n스킬 설명을 볼 수 있습니다.\n\nShift 키를 눌러 스킬을 사용해보세요!',
    conditionType: 'skill_w_used',
    highlight: 'skill_w',
    touchTitle: '일반 스킬 (W)',
    touchDescription: '오른쪽 하단의 W 버튼으로 일반 스킬을 사용할 수 있습니다.\n\n• 탭: 가장 가까운 적 방향으로 자동 발동\n• 드래그: 원하는 방향으로 발동\n\n궁수의 경우: 관통 화살 - 지정 방향으로 적을 관통!\n\nW 버튼을 탭하거나 드래그하여 스킬을 사용해보세요!',
  },
  {
    id: 'skill_ultimate',
    title: '궁극기 (R)',
    description: 'R 키를 눌러 궁극기를 사용할 수 있습니다.\n\n궁극기는 강력하지만 쿨타임이 깁니다!\n궁수의 경우: 화살비 - 넓은 범위에 화살을 쏟아붓습니다!\n\n※ 궁극기도 마우스 방향으로 발동됩니다.\n\nR 키를 눌러 궁극기를 사용해보세요!',
    conditionType: 'skill_e_used',
    highlight: 'skill_e',
    touchTitle: '궁극기 (E)',
    touchDescription: '오른쪽 하단의 E 버튼으로 궁극기를 사용할 수 있습니다.\n\n궁극기는 강력하지만 쿨타임이 깁니다!\n궁수의 경우: 화살비 - 넓은 범위에 화살을 쏟아붓습니다!\n\n• 탭: 자동 방향 발동\n• 드래그: 원하는 방향으로 발동\n\nE 버튼을 탭하거나 드래그하여 궁극기를 사용해보세요!',
  },
  {
    id: 'upgrade',
    title: '업그레이드 구매',
    description: '적을 처치하면 골드를 획득합니다.\n\n화면 하단의 업그레이드 패널에서 영웅을 강화할 수 있습니다.\n\n공격력, 이동속도, HP 등을 업그레이드해보세요!',
    conditionType: 'upgrade_purchased',
    highlight: 'upgrade_panel',
    touchDescription: '적을 처치하면 골드를 획득합니다.\n\n오른쪽 하단의 ⬆️ 버튼을 터치하면 업그레이드 패널이 열립니다.\n\n공격력, 이동속도, HP 등을 업그레이드해보세요!',
  },
  {
    id: 'base',
    title: '적 기지 파괴',
    description: '오른쪽에 있는 적 기지를 공격하세요!\n\n적 기지를 파괴하면 보스가 등장합니다.\n\n기지로 이동하여 공격하세요!',
    conditionType: 'base_destroyed',
    highlight: 'enemy_base',
  },
  {
    id: 'boss',
    title: '보스 처치',
    description: '보스가 등장했습니다!\n\n보스는 강력하지만, 처치하면 게임에서 승리합니다.\n\n보스를 처치하여 튜토리얼을 완료하세요!',
    conditionType: 'boss_killed',
    highlight: 'boss',
  },
];

// 튜토리얼 목표 위치
export interface TutorialTargetPosition {
  x: number;
  y: number;
  radius: number; // 도달 인정 반경
  label: string;  // 표시할 텍스트
}

interface RPGTutorialState {
  // 튜토리얼 활성화 여부
  isActive: boolean;
  // 현재 단계 인덱스
  currentStepIndex: number;
  // 최소화 상태
  isMinimized: boolean;
  // 튜토리얼 완료 여부
  isCompleted: boolean;
  // 조건별 완료 상태
  conditionsMet: Record<RPGTutorialConditionType, boolean>;
  // 목표 위치 (이동 튜토리얼용)
  targetPosition: TutorialTargetPosition | null;
  // 이동 목표 인덱스 (여러 지점 순회용)
  movementTargetIndex: number;
}

interface RPGTutorialActions {
  // 튜토리얼 시작
  startTutorial: () => void;
  // 튜토리얼 종료
  endTutorial: () => void;
  // 다음 단계로
  nextStep: () => void;
  // 이전 단계로
  prevStep: () => void;
  // 특정 단계로 이동
  goToStep: (index: number) => void;
  // 건너뛰기 (튜토리얼 종료)
  skipTutorial: () => void;
  // 최소화 토글
  toggleMinimize: () => void;
  // 조건 충족 업데이트
  setConditionMet: (conditionType: RPGTutorialConditionType) => void;
  // 튜토리얼 완료 처리
  completeTutorial: () => void;
  // 상태 초기화
  reset: () => void;
  // 다음 이동 목표로 진행
  advanceMovementTarget: () => boolean; // true면 모든 목표 완료
}

type RPGTutorialStore = RPGTutorialState & RPGTutorialActions;

const initialState: RPGTutorialState = {
  isActive: false,
  currentStepIndex: 0,
  isMinimized: false,
  isCompleted: false,
  conditionsMet: {
    none: true, // 'none'은 항상 충족 (수동 넘기기용)
    hero_moved: false,
    enemy_killed: false,
    skill_w_used: false,
    skill_e_used: false,
    upgrade_purchased: false,
    base_destroyed: false,
    boss_killed: false,
  },
  targetPosition: null,
  movementTargetIndex: 0,
};

// 이동 튜토리얼 목표 위치들 (3곳 순회)
const MOVEMENT_TARGETS: TutorialTargetPosition[] = [
  {
    x: 700,  // 넥서스(400) + 300 (오른쪽)
    y: 600,
    radius: 50,
    label: '1. 여기로!',
  },
  {
    x: 500,  // 위쪽
    y: 400,
    radius: 50,
    label: '2. 여기로!',
  },
  {
    x: 600,  // 아래쪽
    y: 800,
    radius: 50,
    label: '3. 마지막!',
  },
];

export const useRPGTutorialStore = create<RPGTutorialStore>((set, get) => ({
  ...initialState,

  startTutorial: () => {
    set({
      ...initialState,
      isActive: true,
      targetPosition: null, // 첫 단계(환영)에는 목표 위치 없음
    });
  },

  endTutorial: () => {
    set({ isActive: false, targetPosition: null });
  },

  nextStep: () => {
    const { currentStepIndex } = get();
    const nextIndex = currentStepIndex + 1;

    if (nextIndex >= RPG_TUTORIAL_STEPS.length) {
      // 모든 단계 완료
      set({ isCompleted: true, targetPosition: null, movementTargetIndex: 0 });
    } else {
      // 이동 단계(인덱스 1)일 때 첫 번째 목표 위치 설정
      const newTargetPosition = nextIndex === 1 ? MOVEMENT_TARGETS[0] : null;
      set({ currentStepIndex: nextIndex, targetPosition: newTargetPosition, movementTargetIndex: 0 });
    }
  },

  prevStep: () => {
    set((state) => ({
      currentStepIndex: Math.max(0, state.currentStepIndex - 1),
    }));
  },

  goToStep: (index: number) => {
    if (index >= 0 && index < RPG_TUTORIAL_STEPS.length) {
      // 이동 단계(인덱스 1)일 때 첫 번째 목표 위치 설정
      const newTargetPosition = index === 1 ? MOVEMENT_TARGETS[0] : null;
      set({ currentStepIndex: index, targetPosition: newTargetPosition, movementTargetIndex: 0 });
    }
  },

  skipTutorial: () => {
    set({
      isActive: false,
      isCompleted: true,
    });
  },

  toggleMinimize: () => {
    set((state) => ({ isMinimized: !state.isMinimized }));
  },

  setConditionMet: (conditionType: RPGTutorialConditionType) => {
    set((state) => {
      const newConditionsMet = {
        ...state.conditionsMet,
        [conditionType]: true,
      };

      // 현재 단계의 조건이 충족되었는지 확인
      const currentStep = RPG_TUTORIAL_STEPS[state.currentStepIndex];
      if (currentStep && newConditionsMet[currentStep.conditionType]) {
        // 조건 충족 시 자동으로 다음 단계로 (약간의 딜레이 후)
        // 실제 nextStep 호출은 UI에서 처리
      }

      return { conditionsMet: newConditionsMet };
    });
  },

  completeTutorial: () => {
    set({
      isCompleted: true,
      isActive: false,
    });
  },

  reset: () => {
    set(initialState);
  },

  advanceMovementTarget: () => {
    const { movementTargetIndex } = get();
    const nextIndex = movementTargetIndex + 1;

    if (nextIndex >= MOVEMENT_TARGETS.length) {
      // 모든 이동 목표 완료
      set({ targetPosition: null });
      return true;
    } else {
      // 다음 이동 목표 설정
      set({
        movementTargetIndex: nextIndex,
        targetPosition: MOVEMENT_TARGETS[nextIndex],
      });
      return false;
    }
  },
}));

// 선택자 훅
export const useTutorialActive = () => useRPGTutorialStore((state) => state.isActive);
export const useTutorialStep = () => {
  const currentStepIndex = useRPGTutorialStore((state) => state.currentStepIndex);
  return RPG_TUTORIAL_STEPS[currentStepIndex];
};
export const useTutorialStepIndex = () => useRPGTutorialStore((state) => state.currentStepIndex);
export const useTutorialMinimized = () => useRPGTutorialStore((state) => state.isMinimized);
export const useTutorialCompleted = () => useRPGTutorialStore((state) => state.isCompleted);
export const useTutorialConditions = () => useRPGTutorialStore((state) => state.conditionsMet);
export const useTutorialTargetPosition = () => useRPGTutorialStore((state) => state.targetPosition);
export const useTutorialMovementProgress = () => {
  const index = useRPGTutorialStore((state) => state.movementTargetIndex);
  return { current: index + 1, total: MOVEMENT_TARGETS.length };
};
