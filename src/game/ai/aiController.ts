import { Resources, Unit, UnitType } from '../../types';
import { CONFIG } from '../../constants/config';

export interface AIDecision {
  spawnUnit?: UnitType;
}

export function makeAIDecision(
  aiResources: Resources,
  enemyUnits: Unit[]
): AIDecision {
  const decision: AIDecision = {};

  // 50% 확률로 행동
  if (Math.random() >= 0.6) {
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

  // 지원 유닛이 3마리 미만이면 나무꾼 우선 생산
  if (supportCount < 3 && aiResources.gold >= 30) {
    decision.spawnUnit = 'woodcutter';
    return decision;
  }

  // 금광부가 1마리 미만이고 자원이 충분하면 금광부 생산 (20% 확률)
  if (
    goldminerCount < 1 &&
    aiResources.gold >= 100 &&
    aiResources.wood >= 20 &&
    Math.random() < 0.2
  ) {
    decision.spawnUnit = 'goldminer';
    return decision;
  }

  // 돌이 충분하면 기사 생산 시도 (25% 확률)
  if (
    aiResources.gold >= 120 &&
    aiResources.wood >= 20 &&
    aiResources.stone >= 30 &&
    Math.random() < 0.25
  ) {
    decision.spawnUnit = 'knight';
    return decision;
  }

  // 나무가 있으면 궁수 생산 시도 (30% 확률)
  if (
    aiResources.wood >= 10 &&
    aiResources.gold >= 80 &&
    Math.random() < 0.3
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
