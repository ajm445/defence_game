import { create } from 'zustand';

export type TutorialConditionType =
  | 'none' // 조건 없음 (수동 넘기기)
  | 'has_melee' // 검병 소환됨
  | 'has_ranged' // 궁수 소환됨
  | 'has_knight' // 기사 소환됨
  | 'has_mage' // 마법사 소환됨
  | 'has_woodcutter' // 나무꾼 소환됨
  | 'has_miner' // 광부 소환됨
  | 'has_gatherer' // 채집꾼 소환됨
  | 'has_goldminer' // 금광부 소환됨
  | 'has_healer' // 힐러 소환됨
  | 'has_wood' // 나무 보유 (10개 이상)
  | 'has_stone' // 돌 보유 (10개 이상)
  | 'has_herb' // 약초 보유 (5개 이상)
  | 'has_gold_from_mine' // 금광에서 골드 획득
  | 'has_wall' // 벽 건설됨
  | 'has_upgrade' // 기지 업그레이드됨
  | 'sold_herb' // 약초 판매함
  | 'enemy_destroyed'; // 적 본진 파괴

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  highlight?: string; // 하이라이트할 UI 요소 ID
  conditionType: TutorialConditionType; // 완료 조건 타입
}

interface TutorialState {
  isActive: boolean;
  currentStepIndex: number;
  completedSteps: string[];
  showOverlay: boolean;
  herbSold: boolean; // 약초 판매 여부 추적
}

interface TutorialActions {
  startTutorial: () => void;
  endTutorial: () => void;
  nextStep: () => void;
  prevStep: () => void;
  setStepIndex: (index: number) => void;
  isStepCompleted: (stepId: string) => boolean;
  getCurrentStep: () => TutorialStep | null;
  setShowOverlay: (show: boolean) => void;
  setHerbSold: (sold: boolean) => void;
}

// 튜토리얼 단계 정의 - 모든 유닛과 액션 포함
export const TUTORIAL_STEPS: TutorialStep[] = [
  // === 기본 설명 ===
  {
    id: 'welcome',
    title: '게임에 오신 것을 환영합니다!',
    description: '이 게임의 목표는 적의 본진을 파괴하고 내 본진을 지키는 것입니다.\n\n왼쪽이 내 본진, 오른쪽이 적 본진입니다.',
    conditionType: 'none',
  },
  {
    id: 'camera',
    title: '카메라 조작',
    description: '• 오른쪽 마우스 드래그: 화면이동\n• Space: 본진으로 이동\n• 마우스 휠: 줌인/줌아웃',
    conditionType: 'none',
  },
  {
    id: 'resources_intro',
    title: '자원 소개',
    description: '게임에는 5가지 자원이 있습니다:\n\n💰 골드: 유닛 고용, 업그레이드\n🪵 나무: 벽 건설, 업그레이드\n🪨 돌: 벽 건설, 업그레이드\n🌿 약초: 판매하여 골드 획득\n💎 수정: 특수 유닛(마법사) 고용',
    conditionType: 'none',
  },

  // === 전투 유닛 ===
  {
    id: 'spawn_melee',
    title: '전투 유닛 - 검병 ⚔️',
    description: '검병을 소환하세요!\n\n• 비용: 💰50\n• HP 100, 공격력 15\n• 근접 공격 유닛입니다.',
    highlight: 'unit-melee',
    conditionType: 'has_melee',
  },
  {
    id: 'spawn_ranged',
    title: '전투 유닛 - 궁수 🏹',
    description: '궁수를 소환하세요!\n\n• 비용: 💰80 + 🪵10\n• HP 50, 공격력 25\n• 원거리 공격 유닛입니다.',
    highlight: 'unit-ranged',
    conditionType: 'has_ranged',
  },
  {
    id: 'spawn_knight',
    title: '전투 유닛 - 기사 🛡️',
    description: '기사를 소환하세요!\n\n• 비용: 💰120 + 🪵20 + 🪨30\n• HP 300, 공격력 10\n• 탱커 역할을 합니다.',
    highlight: 'unit-knight',
    conditionType: 'has_knight',
  },

  // === 자원 수집 유닛 ===
  {
    id: 'spawn_woodcutter',
    title: '자원 유닛 - 나무꾼 🪓',
    description: '나무꾼을 소환하세요!\n\n• 비용: 💰30\n• 나무를 채집합니다\n• 나무는 벽 건설과 업그레이드에 필요합니다.',
    highlight: 'unit-woodcutter',
    conditionType: 'has_woodcutter',
  },
  {
    id: 'wait_wood',
    title: '나무 수집 대기',
    description: '나무꾼이 나무를 채집하고 있습니다.\n\n나무 10개가 모일 때까지 기다리세요.\n(상단 자원바에서 확인)',
    conditionType: 'has_wood',
  },
  {
    id: 'spawn_miner',
    title: '자원 유닛 - 광부 ⛏️',
    description: '광부를 소환하세요!\n\n• 비용: 💰40 + 🪵5\n• 돌을 채집합니다\n• 돌은 벽 건설과 업그레이드에 필요합니다.',
    highlight: 'unit-miner',
    conditionType: 'has_miner',
  },
  {
    id: 'wait_stone',
    title: '돌 수집 대기',
    description: '광부가 돌을 채집하고 있습니다.\n\n돌 10개가 모일 때까지 기다리세요.',
    conditionType: 'has_stone',
  },
  {
    id: 'spawn_gatherer',
    title: '자원 유닛 - 채집꾼 🧺',
    description: '채집꾼을 소환하세요!\n\n• 비용: 💰50\n• 약초를 채집합니다\n• 약초는 판매하여 골드를 얻을 수 있습니다.',
    highlight: 'unit-gatherer',
    conditionType: 'has_gatherer',
  },
  {
    id: 'wait_herb',
    title: '약초 수집 대기',
    description: '채집꾼이 약초를 채집하고 있습니다.\n\n약초 5개가 모일 때까지 기다리세요.',
    conditionType: 'has_herb',
  },
  {
    id: 'spawn_goldminer',
    title: '자원 유닛 - 금광부 💰',
    description: '금광부를 소환하세요!\n\n• 비용: 💰100 + 🪵20\n• 금광에서 골드를 채굴합니다\n• 골드 수입을 늘릴 수 있습니다.',
    highlight: 'unit-goldminer',
    conditionType: 'has_goldminer',
  },

  // === 지원 유닛 ===
  {
    id: 'spawn_healer',
    title: '지원 유닛 - 힐러 💚',
    description: '힐러를 소환하세요!\n\n• 비용: 💰70 + 🌿15\n• 범위 내 아군 유닛 치료 (5HP/초)\n• 전투 지속력을 높여줍니다.',
    highlight: 'unit-healer',
    conditionType: 'has_healer',
  },

  // === 액션 ===
  {
    id: 'build_wall',
    title: '액션 - 벽 건설 🧱',
    description: '벽 건설 버튼(Q)을 클릭한 후 맵에서 위치를 클릭하세요!\n\n• 비용: 🪵40 + 🪨20\n• HP 150, 적의 진행을 막아줍니다\n• 30초 후 사라집니다.',
    highlight: 'wall-button',
    conditionType: 'has_wall',
  },
  {
    id: 'sell_herb',
    title: '액션 - 약초 판매 💵',
    description: '약초 판매 버튼(E)을 클릭하세요!\n\n• 🌿30 → 💰70\n• 골드가 부족할 때 유용합니다.',
    highlight: 'sell-herb-button',
    conditionType: 'sold_herb',
  },
  {
    id: 'upgrade_base',
    title: '액션 - 기지 업그레이드 🏰',
    description: '기지 업그레이드 버튼(W)을 클릭하세요!\n\n• 1레벨: 💰150\n• 2레벨+: 💰 + 🪵 + 🪨\n• HP +200, 골드 수입 +1/초\n• 최대 5단계',
    highlight: 'upgrade-button',
    conditionType: 'has_upgrade',
  },

  // === 마법사 ===
  {
    id: 'spawn_mage',
    title: '특수 유닛 - 마법사 🔮',
    description: '마법사를 소환하세요!\n\n• 비용: 💰150 + 🪵50 + 💎10\n• HP 40, 공격력 50 (범위 공격)\n• 수정은 맵 중앙에서 획득 가능',
    highlight: 'unit-mage',
    conditionType: 'has_mage',
  },

  // === 최종 전투 ===
  {
    id: 'combat',
    title: '최종 목표 - 적 본진 파괴!',
    description: '이제 배운 모든 것을 활용하여 적 본진을 파괴하세요!\n\n• 전투 유닛으로 공격\n• 자원 유닛으로 경제력 확보\n• 힐러로 유닛 유지\n• 벽으로 방어\n\n행운을 빕니다!',
    conditionType: 'enemy_destroyed',
  },
];

export const useTutorialStore = create<TutorialState & TutorialActions>((set, get) => ({
  isActive: false,
  currentStepIndex: 0,
  completedSteps: [],
  showOverlay: true,
  herbSold: false,

  startTutorial: () => {
    set({
      isActive: true,
      currentStepIndex: 0,
      completedSteps: [],
      showOverlay: true,
      herbSold: false,
    });
  },

  endTutorial: () => {
    set({
      isActive: false,
      currentStepIndex: 0,
      completedSteps: [],
      showOverlay: false,
      herbSold: false,
    });
  },

  nextStep: () => {
    const { currentStepIndex, completedSteps } = get();
    const currentStep = TUTORIAL_STEPS[currentStepIndex];

    if (currentStepIndex < TUTORIAL_STEPS.length - 1) {
      set({
        currentStepIndex: currentStepIndex + 1,
        completedSteps: [...completedSteps, currentStep.id],
        showOverlay: true,
      });
    }
  },

  prevStep: () => {
    const { currentStepIndex } = get();
    if (currentStepIndex > 0) {
      set({ currentStepIndex: currentStepIndex - 1 });
    }
  },

  setStepIndex: (index: number) => {
    if (index >= 0 && index < TUTORIAL_STEPS.length) {
      set({ currentStepIndex: index });
    }
  },

  isStepCompleted: (stepId: string) => {
    return get().completedSteps.includes(stepId);
  },

  getCurrentStep: () => {
    const { currentStepIndex, isActive } = get();
    if (!isActive) return null;
    return TUTORIAL_STEPS[currentStepIndex] || null;
  },

  setShowOverlay: (show: boolean) => {
    set({ showOverlay: show });
  },

  setHerbSold: (sold: boolean) => {
    set({ herbSold: sold });
  },
}));
