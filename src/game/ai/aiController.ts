import { Resources, Unit, UnitType, AIDifficultyConfig } from '../../types';

export interface AIDecision {
  spawnUnit?: UnitType;
}

export function makeAIDecision(
  aiResources: Resources,
  enemyUnits: Unit[],
  difficultyConfig: AIDifficultyConfig
): AIDecision {
  const decision: AIDecision = {};

  // 난이도별 행동 확률 (actionChance 확률로 행동 안 함)
  if (Math.random() >= difficultyConfig.actionChance) {
    return decision;
  }

  // 지원 유닛 수 확인
  const supportCount = enemyUnits.filter(
    (u) => u.config.type === 'support'
  ).length;

  // 금광부 수 확인
  const goldminerCount = enemyUnits.filter(
    (u) => u.type === 'goldminer'
  ).length;

  // 지원 유닛이 최소 수보다 적으면 나무꾼 우선 생산
  if (supportCount < difficultyConfig.minSupportUnits && aiResources.gold >= 30) {
    decision.spawnUnit = 'woodcutter';
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
