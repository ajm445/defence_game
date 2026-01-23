import { UnitType } from '../../types/unit';
import { UpgradeLevels } from '../../types/rpg';
import { GOLD_CONFIG, UPGRADE_CONFIG } from '../../constants/rpgConfig';

/**
 * 적 처치 시 골드 보상 계산 (goldRate 보너스 적용)
 */
export function getGoldReward(enemyType: UnitType, goldRateBonus: number = 0): number {
  const baseReward = GOLD_CONFIG.REWARDS[enemyType] || 5;
  const multiplier = 1 + goldRateBonus;
  return Math.floor(baseReward * multiplier);
}

/**
 * 업그레이드 비용 계산
 * 공식: baseCost * (multiplier ^ currentLevel)
 */
export function getUpgradeCost(currentLevel: number): number {
  const { UPGRADE_BASE_COST, UPGRADE_COST_MULTIPLIER } = GOLD_CONFIG;
  return Math.floor(UPGRADE_BASE_COST * Math.pow(UPGRADE_COST_MULTIPLIER, currentLevel));
}

/**
 * 업그레이드 가능 여부 확인
 * - 충분한 골드가 있는지
 * - 캐릭터 레벨 상한에 도달하지 않았는지
 */
export function canUpgrade(
  gold: number,
  currentLevel: number,
  characterLevel: number
): boolean {
  // 캐릭터 레벨이 최대 레벨
  if (currentLevel >= characterLevel) {
    return false;
  }

  // 골드 확인
  const cost = getUpgradeCost(currentLevel);
  return gold >= cost;
}

/**
 * 업그레이드 타입
 */
export type UpgradeType = keyof UpgradeLevels;

/**
 * 업그레이드 보너스 계산
 */
export function getUpgradeBonus(upgradeType: UpgradeType, level: number): number {
  const config = UPGRADE_CONFIG[upgradeType];
  return config.perLevel * level;
}

/**
 * 모든 업그레이드 보너스 계산
 */
export function calculateAllUpgradeBonuses(upgradeLevels: UpgradeLevels): {
  attackBonus: number;
  speedBonus: number;
  hpBonus: number;
  goldRateBonus: number;
} {
  return {
    attackBonus: getUpgradeBonus('attack', upgradeLevels.attack),
    speedBonus: getUpgradeBonus('speed', upgradeLevels.speed),
    hpBonus: getUpgradeBonus('hp', upgradeLevels.hp),
    goldRateBonus: getUpgradeBonus('goldRate', upgradeLevels.goldRate),
  };
}

/**
 * 초기 업그레이드 레벨 생성
 */
export function createInitialUpgradeLevels(): UpgradeLevels {
  return {
    attack: 0,
    speed: 0,
    hp: 0,
    goldRate: 0,
  };
}

/**
 * 업그레이드 설명 텍스트 생성
 */
export function getUpgradeDescription(upgradeType: UpgradeType, currentLevel: number): string {
  const config = UPGRADE_CONFIG[upgradeType];
  const currentBonus = getUpgradeBonus(upgradeType, currentLevel);
  const nextBonus = getUpgradeBonus(upgradeType, currentLevel + 1);

  if (upgradeType === 'speed') {
    return `${config.description}: +${currentBonus.toFixed(2)} → +${nextBonus.toFixed(2)}`;
  } else {
    return `${config.description}: +${currentBonus} → +${nextBonus}`;
  }
}

/**
 * 현재 업그레이드 보너스 텍스트
 */
export function getCurrentBonusText(upgradeType: UpgradeType, level: number): string {
  const bonus = getUpgradeBonus(upgradeType, level);

  if (upgradeType === 'speed') {
    return `+${bonus.toFixed(2)}`;
  } else {
    return `+${bonus}`;
  }
}
