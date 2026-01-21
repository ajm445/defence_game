import { HeroUnit } from '../../types/rpg';
import { UnitType } from '../../types/unit';
import { RPG_CONFIG, calculateExpToNextLevel } from '../../constants/rpgConfig';

/**
 * 적 처치 시 경험치 획득
 */
export function getExpReward(unitType: UnitType): number {
  return RPG_CONFIG.EXP_TABLE[unitType] || 10;
}

/**
 * 경험치 추가 및 레벨업 확인
 */
export interface ExpGainResult {
  hero: HeroUnit;
  leveledUp: boolean;
  newLevel?: number;
}

export function addExperience(hero: HeroUnit, expAmount: number): ExpGainResult {
  let updatedHero = { ...hero };
  let leveledUp = false;
  let newLevel: number | undefined;

  updatedHero.exp += expAmount;

  // 레벨업 체크 (여러 레벨 한번에 오를 수 있음)
  while (updatedHero.exp >= updatedHero.expToNextLevel) {
    updatedHero = levelUpHero(updatedHero);
    leveledUp = true;
    newLevel = updatedHero.level;
  }

  return { hero: updatedHero, leveledUp, newLevel };
}

/**
 * 영웅 레벨업 처리
 */
export function levelUpHero(hero: HeroUnit): HeroUnit {
  const newLevel = hero.level + 1;
  const bonus = RPG_CONFIG.LEVEL_UP_BONUS;

  // 스탯 증가
  const newMaxHp = hero.maxHp + bonus.hp;
  const newAttack = hero.baseAttack + bonus.attack;
  const newSpeed = hero.baseSpeed + bonus.speed;

  // 레벨업 시 스킬 쿨타임 초기화
  const updatedSkills = hero.skills.map((skill) => ({
    ...skill,
    currentCooldown: 0,
  }));

  return {
    ...hero,
    level: newLevel,
    exp: hero.exp - hero.expToNextLevel,
    expToNextLevel: calculateExpToNextLevel(newLevel),
    maxHp: newMaxHp,
    hp: newMaxHp, // 레벨업 시 풀 HP 회복
    baseAttack: newAttack,
    baseSpeed: newSpeed,
    config: {
      ...hero.config,
      hp: newMaxHp,
      attack: newAttack,
      speed: newSpeed,
    },
    skills: updatedSkills,
    skillPoints: hero.skillPoints + 1,
  };
}

/**
 * 현재 레벨업 진행률 (0-1)
 */
export function getExpProgress(hero: HeroUnit): number {
  return hero.exp / hero.expToNextLevel;
}

/**
 * 다음 레벨까지 필요한 경험치
 */
export function getExpToNextLevel(level: number): number {
  return calculateExpToNextLevel(level);
}

/**
 * 레벨업 시 보너스 정보 텍스트
 */
export function getLevelUpBonusText(): string {
  const bonus = RPG_CONFIG.LEVEL_UP_BONUS;
  return `HP +${bonus.hp}, 공격력 +${bonus.attack}, 이동속도 +${bonus.speed.toFixed(2)}`;
}

