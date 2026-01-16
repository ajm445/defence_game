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

  // 지원 유닛 수 확인
  const supportCount = enemyUnits.filter(
    (u) => u.config.type === 'support'
  ).length;

  // 각 지원 유닛 수 확인
  const goldminerCount = enemyUnits.filter((u) => u.type === 'goldminer').length;
  const gathererCount = enemyUnits.filter((u) => u.type === 'gatherer').length;
  const minerCount = enemyUnits.filter((u) => u.type === 'miner').length;

  // 지원 유닛이 최소 수보다 적으면 지원 유닛 생산
  if (supportCount < difficultyConfig.minSupportUnits && aiResources.gold >= 30) {
    // 나무꾼, 채집꾼, 광부 중 랜덤 선택
    const roll = Math.random();
    if (roll < 0.5) {
      decision.spawnUnit = 'woodcutter';
    } else if (roll < 0.75) {
      decision.spawnUnit = 'gatherer';
    } else if (aiResources.wood >= 5) {
      decision.spawnUnit = 'miner';
    } else {
      decision.spawnUnit = 'woodcutter';
    }
    return decision;
  }

  // 금광부가 1마리 미만이고 자원이 충분하면 금광부 생산
  if (
    goldminerCount < 1 &&
    aiResources.gold >= 100 &&
    aiResources.wood >= 20 &&
    Math.random() < difficultyConfig.goldminerChance
  ) {
    decision.spawnUnit = 'goldminer';
    return decision;
  }

  // 채집꾼이 2마리 미만이면 채집꾼 생산 시도
  if (
    gathererCount < 2 &&
    aiResources.gold >= 35 &&
    Math.random() < difficultyConfig.gathererChance
  ) {
    decision.spawnUnit = 'gatherer';
    return decision;
  }

  // 광부가 2마리 미만이고 나무가 있으면 광부 생산 시도
  if (
    minerCount < 2 &&
    aiResources.gold >= 40 &&
    aiResources.wood >= 5 &&
    Math.random() < difficultyConfig.minerChance
  ) {
    decision.spawnUnit = 'miner';
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

  return decision;
}
