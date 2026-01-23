/**
 * @deprecated 이 파일은 더 이상 사용되지 않습니다.
 * 게임 내 레벨링 시스템이 골드 기반 업그레이드 시스템으로 대체되었습니다.
 * 관련 기능은 goldSystem.ts를 참조하세요.
 */

import { UnitType } from '../../types/unit';
import { RPG_CONFIG } from '../../constants/rpgConfig';

/**
 * 적 처치 시 경험치 값 반환 (레거시 - 참고용)
 * @deprecated 골드 시스템으로 대체됨. goldSystem.ts의 getGoldReward를 사용하세요.
 */
export function getExpReward(unitType: UnitType): number {
  return RPG_CONFIG.EXP_TABLE[unitType] || 10;
}

/**
 * 다음 레벨까지 필요한 경험치 (레거시 - 참고용)
 * @deprecated 인게임 레벨링이 제거되었습니다.
 */
export function getExpToNextLevel(level: number): number {
  return level * 100;
}

/**
 * 레벨업 시 보너스 정보 텍스트 (레거시 - 참고용)
 * @deprecated 인게임 레벨링이 제거되었습니다. 대신 업그레이드 시스템을 사용하세요.
 */
export function getLevelUpBonusText(): string {
  const bonus = RPG_CONFIG.LEVEL_UP_BONUS;
  return `HP +${bonus.hp}, 공격력 +${bonus.attack}, 이동속도 +${bonus.speed.toFixed(2)}`;
}
