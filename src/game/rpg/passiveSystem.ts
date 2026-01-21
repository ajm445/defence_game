import { HeroClass, PassiveGrowthState } from '../../types/rpg';
import {
  PASSIVE_UNLOCK_WAVE,
  PASSIVE_GROWTH_INTERVAL,
  PASSIVE_GROWTH_CONFIGS,
} from '../../constants/rpgConfig';

/**
 * 웨이브 번호로 패시브 레벨 계산
 * 웨이브 10 클리어 시 레벨 1, 이후 10웨이브마다 +1
 */
export function calculatePassiveLevel(clearedWave: number): number {
  if (clearedWave < PASSIVE_UNLOCK_WAVE) {
    return 0;
  }
  return Math.floor(clearedWave / PASSIVE_GROWTH_INTERVAL);
}

/**
 * 패시브 값 및 오버플로우 보너스 계산
 */
export function calculatePassiveValue(
  heroClass: HeroClass,
  level: number
): { currentValue: number; overflowBonus: number } {
  if (level <= 0) {
    return { currentValue: 0, overflowBonus: 0 };
  }

  const config = PASSIVE_GROWTH_CONFIGS[heroClass];

  // 궁수: 첫 활성화 시 baseChance, 이후 성장
  let rawValue: number;
  if (heroClass === 'archer' && config.baseChance !== undefined) {
    // 레벨 1: baseChance, 레벨 2부터 growthPerLevel 추가
    rawValue = config.baseChance + (level - 1) * config.growthPerLevel;
  } else {
    rawValue = config.startValue + level * config.growthPerLevel;
  }

  // 최대값 초과 여부 확인
  if (rawValue <= config.maxValue) {
    return { currentValue: rawValue, overflowBonus: 0 };
  }

  // 초과 보너스 계산
  const overflowLevels = Math.floor((rawValue - config.maxValue) / config.growthPerLevel);
  const overflowBonus = overflowLevels * config.overflowPerLevel;

  return {
    currentValue: config.maxValue,
    overflowBonus,
  };
}

/**
 * 전사 피해흡혈 계산 (패시브 + 궁극기 버프 곱연산)
 * 공식: (1 + 패시브) * (1 + 버프) - 1
 */
export function calculateWarriorLifesteal(
  passiveLifesteal: number,
  buffLifesteal: number
): number {
  if (passiveLifesteal <= 0 && buffLifesteal <= 0) {
    return 0;
  }
  return (1 + passiveLifesteal) * (1 + buffLifesteal) - 1;
}

/**
 * 궁수 다중타겟 확률 판정
 * @returns 다중타겟 발동 여부
 */
export function rollMultiTarget(passiveValue: number): boolean {
  if (passiveValue <= 0) {
    return false;
  }
  if (passiveValue >= 1) {
    return true; // 100% 이상이면 항상 발동
  }
  return Math.random() < passiveValue;
}

/**
 * 초기 패시브 상태 생성
 */
export function createInitialPassiveState(): PassiveGrowthState {
  return {
    level: 0,
    currentValue: 0,
    overflowBonus: 0,
  };
}

/**
 * 패시브 업그레이드 (웨이브 클리어 시 호출)
 */
export function upgradePassiveState(
  current: PassiveGrowthState,
  heroClass: HeroClass,
  clearedWave: number
): PassiveGrowthState {
  const newLevel = calculatePassiveLevel(clearedWave);

  // 레벨이 변경되지 않으면 현재 상태 유지
  if (newLevel === current.level) {
    return current;
  }

  const { currentValue, overflowBonus } = calculatePassiveValue(heroClass, newLevel);

  return {
    level: newLevel,
    currentValue,
    overflowBonus,
  };
}

/**
 * 패시브 설명 텍스트 생성
 */
export function getPassiveDescription(heroClass: HeroClass): string {
  const config = PASSIVE_GROWTH_CONFIGS[heroClass];
  const descriptions: Record<HeroClass, string> = {
    warrior: `피해흡혈 (최대 ${config.maxValue * 100}%, 초과 시 공격력 증가)`,
    archer: `다중타겟 확률 (최대 ${config.maxValue * 100}%, 초과 시 공격력 증가)`,
    knight: `HP 재생 (최대 ${config.maxValue}/초, 초과 시 체력 증가)`,
    mage: `데미지 보너스 (최대 ${config.maxValue * 100}%, 초과 시 공격력 증가)`,
  };
  return descriptions[heroClass];
}

/**
 * 패시브 상태 포맷팅 (UI 표시용)
 */
export function formatPassiveValue(heroClass: HeroClass, state: PassiveGrowthState): string {
  if (state.level === 0) {
    return '비활성 (웨이브 10 클리어 시 활성화)';
  }

  const config = PASSIVE_GROWTH_CONFIGS[heroClass];
  let valueText: string;

  switch (config.type) {
    case 'lifesteal':
    case 'multiTarget':
    case 'damageBonus':
      valueText = `${(state.currentValue * 100).toFixed(1)}%`;
      break;
    case 'hpRegen':
      valueText = `${state.currentValue.toFixed(0)}/초`;
      break;
    default:
      valueText = `${state.currentValue}`;
  }

  if (state.overflowBonus > 0) {
    const bonusType = config.overflowType === 'attack' ? '공격력' : '체력';
    valueText += ` (+${(state.overflowBonus * 100).toFixed(1)}% ${bonusType})`;
  }

  return valueText;
}
