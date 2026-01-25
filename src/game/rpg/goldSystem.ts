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
 * - 1레벨 (0→1): 50골드 고정
 * - 2레벨 이상: 레벨에 비례하여 증가 (50 * (currentLevel + 1))
 * 예: 0→1: 50, 1→2: 100, 2→3: 150, 3→4: 200...
 */
export function getUpgradeCost(currentLevel: number): number {
  const { UPGRADE_BASE_COST } = GOLD_CONFIG;
  // 1레벨은 고정 비용, 이후 레벨에 비례하여 증가
  return UPGRADE_BASE_COST * (currentLevel + 1);
}

/**
 * 업그레이드 가능 여부 확인
 * - 충분한 골드가 있는지
 * - 사거리 업그레이드의 경우 최대 레벨 확인
 */
export function canUpgrade(
  gold: number,
  currentLevel: number,
  _characterLevel: number,  // 레벨 제한 해제로 사용하지 않음
  upgradeType?: UpgradeType,
  heroClass?: string
): boolean {
  // 사거리 업그레이드는 궁수/마법사만 가능하고 최대 레벨 있음
  if (upgradeType === 'range') {
    // 궁수/마법사가 아니면 불가
    if (heroClass !== 'archer' && heroClass !== 'mage') {
      return false;
    }
    // 최대 레벨 체크
    const maxLevel = UPGRADE_CONFIG.range.maxLevel;
    if (currentLevel >= maxLevel) {
      return false;
    }
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
  attackSpeedBonus: number;
  goldRateBonus: number;
  rangeBonus: number;
} {
  return {
    attackBonus: getUpgradeBonus('attack', upgradeLevels.attack),
    speedBonus: getUpgradeBonus('speed', upgradeLevels.speed),
    hpBonus: getUpgradeBonus('hp', upgradeLevels.hp),
    attackSpeedBonus: getUpgradeBonus('attackSpeed', upgradeLevels.attackSpeed),
    goldRateBonus: getUpgradeBonus('goldRate', upgradeLevels.goldRate),
    rangeBonus: getUpgradeBonus('range', upgradeLevels.range),
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
    attackSpeed: 0,
    goldRate: 0,
    range: 0,
  };
}

/**
 * 업그레이드 설명 텍스트 생성
 */
export function getUpgradeDescription(upgradeType: UpgradeType, currentLevel: number): string {
  const config = UPGRADE_CONFIG[upgradeType];
  const currentBonus = getUpgradeBonus(upgradeType, currentLevel);
  const nextBonus = getUpgradeBonus(upgradeType, currentLevel + 1);

  if (upgradeType === 'speed' || upgradeType === 'attackSpeed') {
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

  if (upgradeType === 'speed' || upgradeType === 'attackSpeed') {
    return `+${bonus.toFixed(2)}`;
  } else {
    return `+${bonus}`;
  }
}

/**
 * 사거리 업그레이드 최대 레벨 확인
 */
export function getRangeMaxLevel(): number {
  return UPGRADE_CONFIG.range.maxLevel;
}
