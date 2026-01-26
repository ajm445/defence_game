import { HeroClass, PassiveGrowthState } from '../../types/rpg';
import {
  PASSIVE_UNLOCK_LEVEL,
  PASSIVE_GROWTH_CONFIGS,
} from '../../constants/rpgConfig';

/**
 * 캐릭터 레벨에서 패시브 레벨 계산
 * 캐릭터 레벨 5 이상에서 활성화, 레벨 5 = 패시브 레벨 1
 */
export function calculatePassiveLevelFromCharacter(characterLevel: number): number {
  if (characterLevel < PASSIVE_UNLOCK_LEVEL) {
    return 0;
  }
  return characterLevel - PASSIVE_UNLOCK_LEVEL + 1;
}

/**
 * 캐릭터 레벨에서 패시브 상태 가져오기
 * 게임 시작 시 캐릭터 레벨에 따라 패시브 초기화
 */
export function getPassiveFromCharacterLevel(
  heroClass: HeroClass,
  characterLevel: number
): PassiveGrowthState | null {
  const passiveLevel = calculatePassiveLevelFromCharacter(characterLevel);

  if (passiveLevel <= 0) {
    return null; // 패시브 미활성화
  }

  const { currentValue, overflowBonus } = calculatePassiveValue(heroClass, passiveLevel);

  return {
    level: passiveLevel,
    currentValue,
    overflowBonus,
  };
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

// 패시브 업그레이드는 더 이상 웨이브 기반이 아님
// 캐릭터 레벨 기반으로 게임 시작 시 고정됨

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
export function formatPassiveValue(heroClass: HeroClass, state: PassiveGrowthState, characterLevel: number = 1): string {
  if (state.level === 0) {
    const levelsNeeded = PASSIVE_UNLOCK_LEVEL - characterLevel;
    if (levelsNeeded > 0) {
      return `비활성 (캐릭터 레벨 ${PASSIVE_UNLOCK_LEVEL} 도달 시 활성화, ${levelsNeeded}레벨 필요)`;
    }
    return `비활성 (캐릭터 레벨 ${PASSIVE_UNLOCK_LEVEL} 도달 시 활성화)`;
  }

  const config = PASSIVE_GROWTH_CONFIGS[heroClass];
  let valueText: string;

  switch (config.type) {
    case 'lifesteal':
    case 'multiTarget':
    case 'bossDamageBonus':
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

/**
 * 패시브 활성화 여부 확인
 */
export function isPassiveActive(characterLevel: number): boolean {
  return characterLevel >= PASSIVE_UNLOCK_LEVEL;
}
