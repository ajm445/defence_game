import { Resources, Unit, UnitType, AIDifficultyConfig } from '../../types';
import { CONFIG } from '../../constants/config';

export interface AIDecision {
  spawnUnit?: UnitType;
  sellHerb?: boolean;
}

export function makeAIDecision(
  aiResources: Resources,
  enemyUnits: Unit[],
  difficultyConfig: AIDifficultyConfig
): AIDecision {
  const decision: AIDecision = {};

  // 약초가 충분하면 판매 (행동 확률과 무관하게 항상 체크)
  if (aiResources.herb >= CONFIG.HERB_SELL_COST) {
    decision.sellHerb = true;
  }

  // 난이도별 행동 확률 (actionChance 확률로 행동 안 함)
  if (Math.random() >= difficultyConfig.actionChance) {
    return decision;
  }

  // 유닛 수 확인
  const supportCount = enemyUnits.filter((u) => u.config.type === 'support').length;
  const combatCount = enemyUnits.filter((u) => u.config.type === 'combat').length;
  const goldminerCount = enemyUnits.filter((u) => u.type === 'goldminer').length;
  const healerCount = enemyUnits.filter((u) => u.type === 'healer').length;
  const mageCount = enemyUnits.filter((u) => u.type === 'mage').length;

  // 초반: 지원 유닛이 최소 수보다 적으면 지원 유닛 생산
  if (supportCount < difficultyConfig.minSupportUnits && aiResources.gold >= 30) {
    const roll = Math.random();
    if (roll < 0.6) {
      decision.spawnUnit = 'woodcutter';
    } else if (roll < 0.8) {
      decision.spawnUnit = 'gatherer';
    } else if (aiResources.wood >= 5) {
      decision.spawnUnit = 'miner';
    } else {
      decision.spawnUnit = 'woodcutter';
    }
    return decision;
  }

  // 중후반: 지원 유닛이 충분하면 전투 유닛 우선 (80% 확률)
  // 자원이 풍부할수록 전투 유닛 생산 확률 증가
  const hasSufficientSupport = supportCount >= difficultyConfig.minSupportUnits;
  const hasGoodResources = aiResources.wood >= 20 && aiResources.stone >= 10;
  const combatPriority = hasSufficientSupport ? (hasGoodResources ? 0.85 : 0.7) : 0.3;

  if (Math.random() < combatPriority) {
    // 전투 유닛 생산 시도

    // 마법사: 수정이 10개 이상이면 마법사 생산 시도
    if (
      aiResources.gold >= 150 &&
      aiResources.crystal >= 10 &&
      Math.random() < difficultyConfig.mageChance
    ) {
      decision.spawnUnit = 'mage';
      return decision;
    }

    // 돌이 충분하면 기사 생산 시도
    if (
      aiResources.gold >= 120 &&
      aiResources.wood >= 20 &&
      aiResources.stone >= 30 &&
      Math.random() < difficultyConfig.knightChance
    ) {
      decision.spawnUnit = 'knight';
      return decision;
    }

    // 나무가 있으면 궁수 생산 시도
    if (
      aiResources.wood >= 10 &&
      aiResources.gold >= 80 &&
      Math.random() < difficultyConfig.archerChance
    ) {
      decision.spawnUnit = 'ranged';
      return decision;
    }

    // 기본: 검병 생산
    if (aiResources.gold >= 50) {
      decision.spawnUnit = 'melee';
      return decision;
    }
  }

  // 추가 지원 유닛 생산 (낮은 확률)

  // 금광부가 없고 자원 충분하면 금광부 생산
  if (
    goldminerCount < 1 &&
    aiResources.gold >= 100 &&
    aiResources.wood >= 20 &&
    Math.random() < difficultyConfig.goldminerChance * 0.5
  ) {
    decision.spawnUnit = 'goldminer';
    return decision;
  }

  // 힐러: 전투 유닛이 3명 이상이고 힐러가 2명 미만이면 힐러 생산
  if (
    combatCount >= 3 &&
    healerCount < 2 &&
    aiResources.gold >= 70 &&
    aiResources.herb >= 15 &&
    Math.random() < difficultyConfig.healerChance
  ) {
    decision.spawnUnit = 'healer';
    return decision;
  }

  // 추가 채집꾼/광부 (매우 낮은 확률)
  if (aiResources.gold >= 35 && Math.random() < difficultyConfig.gathererChance * 0.3) {
    decision.spawnUnit = 'gatherer';
    return decision;
  }

  if (aiResources.gold >= 40 && aiResources.wood >= 5 && Math.random() < difficultyConfig.minerChance * 0.3) {
    decision.spawnUnit = 'miner';
    return decision;
  }

  // 폴백: 검병 생산
  if (aiResources.gold >= 50) {
    decision.spawnUnit = 'melee';
    return decision;
  }

  return decision;
}
