import { Resources, Unit, UnitType, AIDifficultyConfig } from '../../types';
import { CONFIG } from '../../constants/config';

export interface AIDecision {
  spawnUnits: UnitType[]; // 다중 유닛 소환 지원
  sellHerb?: boolean;
}

// 유닛 비용 확인 헬퍼 함수
function canAffordUnit(resources: Resources, unitType: UnitType): boolean {
  const config = CONFIG.UNITS[unitType];
  if (!config) return false;

  const cost = config.cost;
  if (cost.gold && resources.gold < cost.gold) return false;
  if (cost.wood && resources.wood < cost.wood) return false;
  if (cost.stone && resources.stone < cost.stone) return false;
  if (cost.herb && resources.herb < cost.herb) return false;
  if (cost.crystal && resources.crystal < cost.crystal) return false;

  return true;
}

// 자원에서 유닛 비용 차감 (시뮬레이션용)
function deductCost(resources: Resources, unitType: UnitType): Resources {
  const config = CONFIG.UNITS[unitType];
  if (!config) return resources;

  const cost = config.cost;
  return {
    gold: resources.gold - (cost.gold || 0),
    wood: resources.wood - (cost.wood || 0),
    stone: resources.stone - (cost.stone || 0),
    herb: resources.herb - (cost.herb || 0),
    crystal: resources.crystal - (cost.crystal || 0),
  };
}

// 단일 유닛 선택 로직
function selectSingleUnit(
  aiResources: Resources,
  enemyUnits: Unit[],
  difficultyConfig: AIDifficultyConfig
): UnitType | null {
  // 유닛 수 확인
  const supportCount = enemyUnits.filter((u) => u.config.type === 'support').length;
  const combatCount = enemyUnits.filter((u) => u.config.type === 'combat').length;
  const goldminerCount = enemyUnits.filter((u) => u.type === 'goldminer').length;
  const healerCount = enemyUnits.filter((u) => u.type === 'healer').length;

  // 초반: 지원 유닛이 최소 수보다 적으면 지원 유닛 생산
  if (supportCount < difficultyConfig.minSupportUnits && aiResources.gold >= 30) {
    const roll = Math.random();
    if (roll < 0.6) {
      return 'woodcutter';
    } else if (roll < 0.8) {
      return 'gatherer';
    } else if (aiResources.wood >= 5) {
      return 'miner';
    } else {
      return 'woodcutter';
    }
  }

  // 중후반: 지원 유닛이 충분하면 전투 유닛 우선
  const hasSufficientSupport = supportCount >= difficultyConfig.minSupportUnits;
  const hasGoodResources = aiResources.wood >= 20 && aiResources.stone >= 10;
  const combatPriority = hasSufficientSupport ? (hasGoodResources ? 0.85 : 0.7) : 0.3;

  if (Math.random() < combatPriority) {
    // 마법사
    if (
      canAffordUnit(aiResources, 'mage') &&
      aiResources.crystal >= 10 &&
      Math.random() < difficultyConfig.mageChance
    ) {
      return 'mage';
    }

    // 기사
    if (
      canAffordUnit(aiResources, 'knight') &&
      Math.random() < difficultyConfig.knightChance
    ) {
      return 'knight';
    }

    // 궁수
    if (
      canAffordUnit(aiResources, 'ranged') &&
      Math.random() < difficultyConfig.archerChance
    ) {
      return 'ranged';
    }

    // 검병
    if (canAffordUnit(aiResources, 'melee')) {
      return 'melee';
    }
  }

  // 금광부
  if (
    goldminerCount < 1 &&
    canAffordUnit(aiResources, 'goldminer') &&
    Math.random() < difficultyConfig.goldminerChance * 0.5
  ) {
    return 'goldminer';
  }

  // 힐러
  if (
    combatCount >= 3 &&
    healerCount < 2 &&
    canAffordUnit(aiResources, 'healer') &&
    Math.random() < difficultyConfig.healerChance
  ) {
    return 'healer';
  }

  // 채집꾼
  if (canAffordUnit(aiResources, 'gatherer') && Math.random() < difficultyConfig.gathererChance * 0.3) {
    return 'gatherer';
  }

  // 광부
  if (canAffordUnit(aiResources, 'miner') && Math.random() < difficultyConfig.minerChance * 0.3) {
    return 'miner';
  }

  // 폴백: 검병
  if (canAffordUnit(aiResources, 'melee')) {
    return 'melee';
  }

  return null;
}

export function makeAIDecision(
  aiResources: Resources,
  enemyUnits: Unit[],
  difficultyConfig: AIDifficultyConfig
): AIDecision {
  const decision: AIDecision = { spawnUnits: [] };

  // 약초가 충분하면 판매 (행동 확률과 무관하게 항상 체크)
  if (aiResources.herb >= CONFIG.HERB_SELL_COST) {
    decision.sellHerb = true;
  }

  // 난이도별 행동 확률
  if (Math.random() >= difficultyConfig.actionChance) {
    return decision;
  }

  // 다중 유닛 소환 (maxUnitsPerAction에 따라)
  let remainingResources = { ...aiResources };
  const maxUnits = difficultyConfig.maxUnitsPerAction || 1;

  for (let i = 0; i < maxUnits; i++) {
    const unitType = selectSingleUnit(remainingResources, enemyUnits, difficultyConfig);
    if (unitType && canAffordUnit(remainingResources, unitType)) {
      decision.spawnUnits.push(unitType);
      remainingResources = deductCost(remainingResources, unitType);
    } else {
      break; // 더 이상 소환할 수 없으면 중단
    }
  }

  return decision;
}
