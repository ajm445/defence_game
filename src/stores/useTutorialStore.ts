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
  | 'has_herb_30' // 약초 보유 (30개 이상)
  | 'has_gold_from_mine' // 금광에서 골드 획득
  | 'has_wall' // 벽 건설됨
  | 'has_upgrade' // 기지 업그레이드됨
  | 'sold_herb' // 약초 판매함
  | 'enemy_destroyed'; // 적 본진 파괴

// 하이라이트 대상 타입
export type HighlightTarget =
  | 'unit-melee'
  | 'unit-ranged'
  | 'unit-knight'
  | 'unit-mage'
  | 'unit-woodcutter'
  | 'unit-miner'
  | 'unit-gatherer'
  | 'unit-goldminer'
  | 'unit-healer'
  | 'action-wall'
  | 'action-upgrade'
  | 'action-sell-herb'
  | 'resource-bar'
  | null;

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  highlight?: HighlightTarget; // 하이라이트할 UI 요소
  conditionType: TutorialConditionType; // 완료 조건 타입
  conditionHint?: string; // 조건 힌트 (선택적)
}

interface TutorialState {
  isActive: boolean;
  currentStepIndex: number;
  completedSteps: string[];
  showOverlay: boolean;
  herbSold: boolean; // 약초 판매 여부 추적
  tutorialSkipped: boolean; // 건너뛰기 눌렀는지 여부
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

// 튜토리얼 단계 정의 - 지원 유닛 우선, 공격 유닛은 후반
export const TUTORIAL_STEPS: TutorialStep[] = [
  // === Phase 1: 기본 설명 (1~3) ===
  {
    id: 'welcome',
    title: '🎮 막아라! 무너트려라!',
    description: '이 게임은 직접 싸우는 것이 아닌, 아군 유닛을 소환하여 적 본진을 파괴하는 전략 게임입니다!\n\n• 왼쪽: 내 본진 (파란색)\n• 오른쪽: 적 본진 (빨간색)\n\n유닛을 잘 조합하여 적을 물리치세요!',
    conditionType: 'none',
  },
  {
    id: 'camera',
    title: '📷 카메라 조작',
    description: '넓은 전장을 살펴보세요!\n\n• 마우스 우클릭 드래그: 화면 이동\n• Space 키: 내 본진으로 즉시 이동\n• 마우스 휠: 확대/축소',
    conditionType: 'none',
  },
  {
    id: 'resources_intro',
    title: '💎 자원 시스템',
    description: '유닛을 소환하려면 자원이 필요합니다.\n\n💰 골드: 기본 자원, 모든 유닛에 필요\n🪵 나무: 궁수, 기사, 벽 건설에 필요\n🪨 돌: 기사, 벽 건설에 필요\n🌿 약초: 힐러 고용, 판매하여 골드 획득\n💎 수정: 마법사 고용 (맵 중앙에서 획득)\n\n먼저 자원 수집 유닛부터 배치해봅시다!',
    highlight: 'resource-bar',
    conditionType: 'none',
  },

  // === Phase 2: 지원 유닛 + 경제 (4~12) ===
  {
    id: 'spawn_gatherer',
    title: '🧺 채집꾼 - 약초 & 크리스탈 수집',
    description: '채집꾼은 약초를 채집합니다.\n\n📊 스펙:\n• 체력 50 / 공격력 3\n• 비용: 💰50\n• 약초 🌿 채집\n\n💡 전략 팁:\n약초 외에도 특정 확률로 크리스탈💎을 함께 얻을 수 있습니다!\n약초는 판매하여 골드를 얻는 핵심 자원이에요.\n\n👆 채집꾼 버튼을 클릭하세요!',
    highlight: 'unit-gatherer',
    conditionType: 'has_gatherer',
    conditionHint: '채집꾼 버튼을 클릭하여 소환하세요',
  },
  {
    id: 'wait_herb',
    title: '🌿 약초 30개 수집 대기',
    description: '채집꾼이 약초를 채집하고 있습니다!\n\n약초는 맵 곳곳의 풀에서 수집됩니다. 채집꾼이 자동으로 가장 가까운 약초로 이동하여 채집합니다.\n\n💡 약초 30개를 모으면 판매하여 골드를 얻을 수 있어요!\n\n⏳ 상단 자원 바에서 약초 🌿가 30개 이상 모일 때까지 기다려주세요.',
    conditionType: 'has_herb_30',
    conditionHint: '약초 30개 수집 대기 중...',
  },
  {
    id: 'sell_herb',
    title: '💵 약초 판매 - 초반 핵심 골드 전략!',
    description: '채집꾼으로 약초를 모아 판매하는 것이 초반 골드 수급의 핵심 전략입니다!\n\n📊 교환 비율:\n• 🌿30 → 💰70\n\n💡 전략 팁:\n초반에 골드가 부족할 때 약초를 적극 판매하세요.\n채집꾼을 여러 명 배치하면 약초 수급이 빨라집니다!\n\n👆 약초 판매 버튼(E)을 클릭하세요!',
    highlight: 'action-sell-herb',
    conditionType: 'sold_herb',
    conditionHint: '약초 판매 버튼을 클릭하세요',
  },
  {
    id: 'spawn_woodcutter',
    title: '🪓 나무꾼 - 나무 수집',
    description: '나무꾼은 나무를 채집합니다.\n\n📊 스펙:\n• 체력 60 / 공격력 5\n• 비용: 💰30\n• 나무 🪵 채집\n\n💡 전략 팁:\n나무는 궁수, 기사, 마법사를 위해 필수! 초반에 1~2명 배치하세요.\n\n👆 나무꾼 버튼을 클릭하세요!',
    highlight: 'unit-woodcutter',
    conditionType: 'has_woodcutter',
    conditionHint: '나무꾼 버튼을 클릭하여 소환하세요',
  },
  {
    id: 'wait_wood',
    title: '🪵 나무 수집 대기',
    description: '나무꾼이 나무를 채집하고 있습니다!\n\n나무는 맵 곳곳에 있는 나무에서 수집됩니다. 나무꾼이 자동으로 가장 가까운 나무로 이동하여 채집합니다.\n\n⏳ 상단 자원 바에서 나무 🪵가 10개 이상 모일 때까지 기다려주세요.',
    conditionType: 'has_wood',
    conditionHint: '나무 10개 수집 대기 중...',
  },
  {
    id: 'spawn_miner',
    title: '⛏️ 광부 - 돌 수집',
    description: '광부는 돌을 채집합니다.\n\n📊 스펙:\n• 체력 70 / 공격력 6\n• 비용: 💰40 + 🪵5\n• 돌 🪨 채집\n\n💡 전략 팁:\n돌은 기사와 벽 건설에 필요합니다. 안정적인 돌 수급을 위해 배치하세요.\n\n👆 광부 버튼을 클릭하세요!',
    highlight: 'unit-miner',
    conditionType: 'has_miner',
    conditionHint: '광부 버튼을 클릭하여 소환하세요',
  },
  {
    id: 'wait_stone',
    title: '🪨 돌 수집 대기',
    description: '광부가 돌을 채집하고 있습니다!\n\n돌은 맵에 있는 바위에서 수집됩니다.\n\n⏳ 상단 자원 바에서 돌 🪨이 10개 이상 모일 때까지 기다려주세요.',
    conditionType: 'has_stone',
    conditionHint: '돌 10개 수집 대기 중...',
  },
  {
    id: 'spawn_goldminer',
    title: '💰 금광부 - 골드 채굴',
    description: '금광부는 금광에서 골드를 채굴합니다.\n\n📊 스펙:\n• 체력 70 / 공격력 4\n• 비용: 💰100 + 🪵20\n• 골드 💰 채굴\n\n💡 전략 팁:\n맵 중앙의 금광에서 추가 골드를 얻을 수 있어요. 경제력 강화에 필수!\n\n👆 금광부 버튼을 클릭하세요!',
    highlight: 'unit-goldminer',
    conditionType: 'has_goldminer',
    conditionHint: '금광부 버튼을 클릭하여 소환하세요',
  },
  {
    id: 'spawn_healer',
    title: '💚 힐러 - 아군 치료',
    description: '힐러는 주변 아군 유닛을 치료합니다.\n\n📊 스펙:\n• 체력 60 / 회복량 5HP/초\n• 비용: 💰70 + 🌿15\n• 치료 범위 130\n\n💡 전략 팁:\n탱커인 기사와 함께 운용하면 전투 지속력이 크게 올라갑니다!\n\n👆 힐러 버튼을 클릭하세요!',
    highlight: 'unit-healer',
    conditionType: 'has_healer',
    conditionHint: '힐러 버튼을 클릭하여 소환하세요',
  },

  // === Phase 3: 액션 (13~15) ===
  {
    id: 'upgrade_base',
    title: '🏰 본진 강화 - 영구 버프',
    description: '본진을 업그레이드하여 강화하세요!\n\n📊 효과:\n• 본진 HP +200\n• 골드 수입 +1/초\n• 최대 5단계까지 강화 가능\n\n💡 전략 팁:\n기지를 강화하면 체력이 늘어나고 골드 수입도 증가합니다. 장기전에서 유리해요!\n\n👆 본진 강화 버튼(W)을 클릭하세요!',
    highlight: 'action-upgrade',
    conditionType: 'has_upgrade',
    conditionHint: '본진 강화 버튼을 클릭하세요',
  },
  {
    id: 'build_wall',
    title: '🧱 벽 건설 - 방어 시설',
    description: '벽을 건설하여 적의 진격을 막으세요!\n\n📊 스펙:\n• 체력 150\n• 비용: 🪵40 + 🪨20\n• 지속시간: 30초\n\n💡 전략 팁:\n벽으로 적의 진격을 차단하고, 뒤에 있는 자원 유닛을 보호하세요!\n\n👆 벽 버튼(Q)을 클릭한 후, 맵에서 건설 위치를 클릭하세요!',
    highlight: 'action-wall',
    conditionType: 'has_wall',
    conditionHint: '벽 버튼 클릭 → 맵에서 위치 클릭',
  },
  {
    id: 'enemy_incoming',
    title: '⚠️ 적 출격 예고!',
    description: '경제 기반이 갖춰졌습니다!\n\n이제 공격 유닛을 고용하면, 적 기지에서 적이 출격합니다!\n\n💡 전투 준비:\n• 벽을 전방에 배치하여 방어선 구축\n• 힐러가 전투 유닛 근처에 있도록 배치\n• 자원 유닛은 안전한 후방에 유지\n\n준비가 되었다면 다음으로 넘어가세요!',
    conditionType: 'none',
  },

  // === Phase 4: 공격 유닛 (16~20) — 이 시점부터 적 소환 시작 ===
  {
    id: 'spawn_melee',
    title: '⚔️ 검병 - 기본 전투 유닛',
    description: '검병은 가장 기본적인 전투 유닛입니다.\n\n📊 스펙:\n• 체력 100 / 공격력 15\n• 비용: 💰50\n• 근접 공격\n\n💡 전략 팁:\n저렴하고 빠르게 소환됩니다. 초반 러시나 물량 싸움에 유용해요!\n\n👆 아래 검병 버튼을 클릭하세요!',
    highlight: 'unit-melee',
    conditionType: 'has_melee',
    conditionHint: '검병 버튼을 클릭하여 소환하세요',
  },
  {
    id: 'spawn_ranged',
    title: '🏹 궁수 - 원거리 딜러',
    description: '궁수는 멀리서 적을 공격합니다.\n\n📊 스펙:\n• 체력 50 / 공격력 25\n• 비용: 💰80 + 🪵10\n• 사거리 150\n\n💡 전략 팁:\n체력은 낮지만 공격력이 높습니다. 검병이나 기사 뒤에서 딜을 넣으세요!\n\n👆 궁수 버튼을 클릭하세요!',
    highlight: 'unit-ranged',
    conditionType: 'has_ranged',
    conditionHint: '궁수 버튼을 클릭하여 소환하세요',
  },
  {
    id: 'spawn_knight',
    title: '🛡️ 기사 - 탱커',
    description: '기사는 팀의 방패 역할을 합니다.\n\n📊 스펙:\n• 체력 300 / 공격력 10\n• 비용: 💰120 + 🪵20 + 🪨30\n• 느린 이동속도\n\n💡 전략 팁:\n높은 체력으로 적의 공격을 버텨줍니다. 궁수와 함께 운용하면 효과적!\n\n👆 기사 버튼을 클릭하세요!',
    highlight: 'unit-knight',
    conditionType: 'has_knight',
    conditionHint: '기사 버튼을 클릭하여 소환하세요',
  },
  {
    id: 'spawn_mage',
    title: '🔮 마법사 - 광역 딜러',
    description: '마법사는 강력한 범위 공격을 합니다!\n\n📊 스펙:\n• 체력 40 / 공격력 50 (범위)\n• 비용: 💰150 + 🪵50 + 💎10\n• 사거리 200\n\n💡 전략 팁:\n수정💎은 맵 중앙에서 획득 가능합니다. 몰려오는 적을 한 번에 처리!\n\n👆 마법사 버튼을 클릭하세요!',
    highlight: 'unit-mage',
    conditionType: 'has_mage',
    conditionHint: '마법사 버튼을 클릭하여 소환하세요',
  },
  {
    id: 'combat_tip',
    title: '💡 전투 전략 팁',
    description: '유닛 조합이 승리의 열쇠입니다!\n\n🛡️ 기사 + 💚 힐러:\n기사가 전방에서 버티고, 힐러가 뒤에서 회복하면 전투 지속력이 극대화됩니다.\n\n🏹 궁수 후방 배치:\n궁수는 체력이 낮으니 기사 뒤에 배치하세요.\n\n🔮 마법사 광역 딜:\n적이 몰려올 때 마법사의 광역 공격이 빛을 발합니다.\n\n이제 실전입니다!',
    conditionType: 'none',
  },

  // === Phase 5: 최종 전투 (21) ===
  {
    id: 'combat',
    title: '⚔️ 최종 목표: 적 본진 파괴!',
    description: '축하합니다! 모든 유닛과 기능을 배웠습니다.\n\n🎯 전략 가이드:\n1. 자원 유닛으로 경제력 확보\n2. 전투 유닛 조합 (탱커 + 딜러)\n3. 힐러로 유닛 유지\n4. 벽으로 방어선 구축\n5. 본진 강화로 지속 성장\n\n이제 적 본진을 파괴하여 승리하세요! 💪',
    conditionType: 'enemy_destroyed',
    conditionHint: '적 본진을 파괴하세요!',
  },
];

export const useTutorialStore = create<TutorialState & TutorialActions>((set, get) => ({
  isActive: false,
  currentStepIndex: 0,
  completedSteps: [],
  showOverlay: true,
  herbSold: false,
  tutorialSkipped: false,

  startTutorial: () => {
    set({
      isActive: true,
      currentStepIndex: 0,
      completedSteps: [],
      showOverlay: true,
      herbSold: false,
      tutorialSkipped: false,
    });
  },

  endTutorial: () => {
    set({
      isActive: false,
      currentStepIndex: 0,
      completedSteps: [],
      showOverlay: false,
      herbSold: false,
      tutorialSkipped: true, // 건너뛰기 표시
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
