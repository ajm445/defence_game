import { HeroUnit, RPGEnemy, Skill, SkillEffect, SkillType, Buff, PendingSkill, HeroClass, HitTarget } from '../../types/rpg';
import { RPG_CONFIG, CLASS_SKILLS, CLASS_CONFIGS, PASSIVE_UNLOCK_LEVEL } from '../../constants/rpgConfig';
import { distance } from '../../utils/math';
import { calculateWarriorLifesteal, rollMultiTarget } from './passiveSystem';

// 스킬 슬롯에서 스킬 타입 가져오기
export function getSkillTypeForSlot(heroClass: HeroClass, slot: 'Q' | 'W' | 'E'): SkillType {
  const classSkills = CLASS_SKILLS[heroClass];
  return classSkills[slot.toLowerCase() as 'q' | 'w' | 'e'].type;
}

// 스킬 설정 가져오기
export function getSkillConfig(heroClass: HeroClass, slot: 'Q' | 'W' | 'E') {
  const classSkills = CLASS_SKILLS[heroClass];
  return classSkills[slot.toLowerCase() as 'q' | 'w' | 'e'];
}

/**
 * 스킬 사용 가능 여부 확인
 */
export function canUseSkill(hero: HeroUnit, skillType: SkillType): boolean {
  const skill = hero.skills.find((s) => s.type === skillType);
  if (!skill) return false;
  return skill.currentCooldown <= 0;
}

/**
 * 스킬 쿨다운 시작
 */
export function startSkillCooldown(hero: HeroUnit, skillType: SkillType): HeroUnit {
  const updatedSkills = hero.skills.map((skill) => {
    if (skill.type === skillType) {
      return { ...skill, currentCooldown: skill.cooldown };
    }
    return skill;
  });
  return { ...hero, skills: updatedSkills };
}

/**
 * 스킬 쿨다운 업데이트
 * - 광전사 버프 활성화 시 Q스킬 쿨다운 30% 빠르게 감소
 */
export function updateSkillCooldowns(hero: HeroUnit, deltaTime: number): HeroUnit {
  // 광전사 버프 확인 (공격속도 증가)
  const berserkerBuff = hero.buffs.find(b => b.type === 'berserker');
  const attackSpeedMultiplier = berserkerBuff?.speedBonus ? (1 + berserkerBuff.speedBonus) : 1;

  const updatedSkills = hero.skills.map((skill) => {
    // Q스킬(기본 공격)에만 공격속도 버프 적용
    const isQSkill = skill.type.endsWith('_q');
    const cooldownReduction = isQSkill
      ? deltaTime * attackSpeedMultiplier  // 광전사 버프 시 30% 빠르게 감소
      : deltaTime;

    return {
      ...skill,
      currentCooldown: Math.max(0, skill.currentCooldown - cooldownReduction),
    };
  });
  return { ...hero, skills: updatedSkills };
}

/**
 * 돌진 스킬 실행
 */
export interface DashResult {
  hero: HeroUnit;
  effect: SkillEffect;
  enemyDamages: { enemyId: string; damage: number }[];
}

export function executeDash(
  hero: HeroUnit,
  enemies: RPGEnemy[],
  targetX: number,
  targetY: number,
  gameTime: number
): DashResult {
  const skillConfig = RPG_CONFIG.SKILLS.dash;
  const skill = hero.skills.find((s) => s.type === 'dash');
  const skillLevel = skill?.level || 1;

  // 레벨에 따른 데미지 보너스
  const damageBonus = (skillLevel - 1) * (RPG_CONFIG.SKILL_UPGRADE.dash.damageBonus || 10);
  const damage = (skillConfig.damage || 50) + damageBonus;
  const dashDistance = skillConfig.distance || 200;

  // 방향 계산
  const dx = targetX - hero.x;
  const dy = targetY - hero.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const dirX = dist > 0 ? dx / dist : 1;
  const dirY = dist > 0 ? dy / dist : 0;

  // 새 위치 계산 (맵 경계 고려)
  const newX = Math.max(30, Math.min(RPG_CONFIG.MAP_WIDTH - 30, hero.x + dirX * dashDistance));
  const newY = Math.max(30, Math.min(RPG_CONFIG.MAP_HEIGHT - 30, hero.y + dirY * dashDistance));

  // 경로상 적에게 데미지
  const enemyDamages: { enemyId: string; damage: number }[] = [];
  for (const enemy of enemies) {
    if (enemy.hp <= 0) continue;

    // 돌진 경로와 적의 거리 계산 (선분-점 거리)
    const enemyDist = pointToLineDistance(
      enemy.x,
      enemy.y,
      hero.x,
      hero.y,
      newX,
      newY
    );

    if (enemyDist <= 40) {
      // 경로 근처의 적에게 데미지
      enemyDamages.push({ enemyId: enemy.id, damage });
    }
  }

  const effect: SkillEffect = {
    type: 'dash',
    position: { x: hero.x, y: hero.y },
    direction: { x: dirX, y: dirY },
    radius: dashDistance,
    damage,
    duration: 0.3,
    startTime: gameTime,
  };

  const updatedHero = startSkillCooldown(
    { ...hero, x: newX, y: newY, targetPosition: undefined },
    'dash'
  );

  return { hero: updatedHero, effect, enemyDamages };
}

/**
 * 회전 베기 스킬 실행
 */
export interface SpinResult {
  hero: HeroUnit;
  effect: SkillEffect;
  enemyDamages: { enemyId: string; damage: number }[];
}

export function executeSpin(
  hero: HeroUnit,
  enemies: RPGEnemy[],
  gameTime: number
): SpinResult {
  const skillConfig = RPG_CONFIG.SKILLS.spin;
  const skill = hero.skills.find((s) => s.type === 'spin');
  const skillLevel = skill?.level || 1;

  // 레벨에 따른 데미지 배율 보너스
  const multiplierBonus = (skillLevel - 1) * (RPG_CONFIG.SKILL_UPGRADE.spin.damageMultiplierBonus || 0.1);
  const damageMultiplier = (skillConfig.damageMultiplier || 1.5) + multiplierBonus;
  const damage = Math.floor((hero.config.attack || hero.baseAttack) * damageMultiplier);
  const radius = skillConfig.radius || 100;

  // 범위 내 적에게 데미지
  const enemyDamages: { enemyId: string; damage: number }[] = [];
  for (const enemy of enemies) {
    if (enemy.hp <= 0) continue;

    const dist = distance(hero.x, hero.y, enemy.x, enemy.y);
    if (dist <= radius) {
      enemyDamages.push({ enemyId: enemy.id, damage });
    }
  }

  const effect: SkillEffect = {
    type: 'spin',
    position: { x: hero.x, y: hero.y },
    radius,
    damage,
    duration: 0.5,
    startTime: gameTime,
  };

  const updatedHero = startSkillCooldown(hero, 'spin');

  return { hero: updatedHero, effect, enemyDamages };
}

/**
 * 회복 스킬 실행
 */
export interface HealResult {
  hero: HeroUnit;
  effect: SkillEffect;
  healAmount: number;
}

export function executeHeal(hero: HeroUnit, gameTime: number): HealResult {
  const skillConfig = RPG_CONFIG.SKILLS.heal;
  const skill = hero.skills.find((s) => s.type === 'heal');
  const skillLevel = skill?.level || 1;

  // 레벨에 따른 회복량 보너스
  const healPercentBonus = (skillLevel - 1) * (RPG_CONFIG.SKILL_UPGRADE.heal.healPercentBonus || 0.05);
  const healPercent = (skillConfig.healPercent || 0.3) + healPercentBonus;
  const healAmount = Math.floor(hero.maxHp * healPercent);

  const newHp = Math.min(hero.maxHp, hero.hp + healAmount);

  const effect: SkillEffect = {
    type: 'heal',
    position: { x: hero.x, y: hero.y },
    heal: healAmount,
    duration: 0.8,
    startTime: gameTime,
  };

  const updatedHero = startSkillCooldown({ ...hero, hp: newHp }, 'heal');

  return { hero: updatedHero, effect, healAmount };
}

/**
 * 스킬 업그레이드
 */
export function upgradeSkill(hero: HeroUnit, skillType: SkillType): HeroUnit | null {
  if (hero.skillPoints <= 0) return null;

  const skill = hero.skills.find((s) => s.type === skillType);
  if (!skill) return null;

  const upgrade = RPG_CONFIG.SKILL_UPGRADE[skillType];
  if (!upgrade) return null;

  const updatedSkills = hero.skills.map((s) => {
    if (s.type === skillType) {
      return {
        ...s,
        level: s.level + 1,
        cooldown: Math.max(1, s.cooldown - upgrade.cooldownReduction),
      };
    }
    return s;
  });

  return {
    ...hero,
    skills: updatedSkills,
    skillPoints: hero.skillPoints - 1,
  };
}

/**
 * 스킬 정보 텍스트 생성
 */
export function getSkillDescription(skill: Skill): string {
  // 구 스킬 시스템 호환성
  if (skill.type === 'dash' || skill.type === 'spin' || skill.type === 'heal') {
    const baseConfig = RPG_CONFIG.SKILLS[skill.type];
    const upgrade = RPG_CONFIG.SKILL_UPGRADE[skill.type];
    let description = '';

    switch (skill.type) {
      case 'dash':
        const dashDamage = (baseConfig.damage || 50) + (skill.level - 1) * (upgrade.damageBonus || 10);
        description = `전방으로 빠르게 돌진하며 경로상 적에게 ${dashDamage} 데미지`;
        break;
      case 'spin':
        const spinMultiplier = ((baseConfig.damageMultiplier || 1.5) + (skill.level - 1) * (upgrade.damageMultiplierBonus || 0.1)) * 100;
        description = `주변 적에게 공격력의 ${spinMultiplier.toFixed(0)}% 데미지`;
        break;
      case 'heal':
        const healPercent = ((baseConfig.healPercent || 0.3) + (skill.level - 1) * (upgrade.healPercentBonus || 0.05)) * 100;
        description = `HP ${healPercent.toFixed(0)}% 회복`;
        break;
    }
    return description;
  }

  // 새로운 직업별 스킬
  for (const [heroClass, skills] of Object.entries(CLASS_SKILLS)) {
    for (const [slot, skillConfig] of Object.entries(skills)) {
      if (skillConfig.type === skill.type) {
        return skillConfig.description;
      }
    }
  }

  return '';
}

// ============================================
// 직업별 스킬 실행 함수들
// ============================================

export interface ClassSkillResult {
  hero: HeroUnit;
  effect?: SkillEffect;
  enemyDamages: { enemyId: string; damage: number }[];
  buff?: Buff;
  pendingSkill?: PendingSkill;
  stunTargets?: string[];
  stunDuration?: number; // 기절 지속시간 (초)
}

/**
 * 직업별 Q 스킬 실행 (일반공격)
 * - 전사, 기사: 근접 범위 공격 (다수 타격)
 * - 마법사: 원거리 범위 공격 (다수 타격)
 * - 궁수: 다중 타겟 공격 (패시브 확률 기반)
 */
export function executeQSkill(
  hero: HeroUnit,
  enemies: RPGEnemy[],
  targetX: number,
  targetY: number,
  gameTime: number
): ClassSkillResult {
  const heroClass = hero.heroClass;
  const skillConfig = CLASS_SKILLS[heroClass].q;
  const classConfig = CLASS_CONFIGS[heroClass];
  const baseDamage = hero.config.attack || hero.baseAttack;
  let damage = Math.floor(baseDamage * (skillConfig.damageMultiplier || 1.0));

  // 마법사: 기본 패시브 + 패시브 성장 데미지 보너스 적용 (레벨 5 이상)
  if (heroClass === 'mage') {
    const baseDamageBonus = hero.level >= PASSIVE_UNLOCK_LEVEL ? (classConfig.passive.damageBonus || 0) : 0;
    const growthDamageBonus = hero.passiveGrowth.currentValue;
    damage = Math.floor(damage * (1 + baseDamageBonus + growthDamageBonus));
  }

  // 버프 적용된 공격력 계산
  let finalDamage = damage;
  const berserkerBuff = hero.buffs.find(b => b.type === 'berserker');
  if (berserkerBuff) {
    finalDamage = Math.floor(finalDamage * (1 + (berserkerBuff.attackBonus || 0)));
  }

  const enemyDamages: { enemyId: string; damage: number }[] = [];
  const hitTargets: HitTarget[] = []; // 피격 대상 위치 수집
  // 직업별 기본 공격 사거리 사용
  const attackRange = hero.config.range || CLASS_CONFIGS[heroClass].range;

  // 공격 방향 계산 (영웅 → 마우스 방향)
  const dx = targetX - hero.x;
  const dy = targetY - hero.y;
  const dirDist = Math.sqrt(dx * dx + dy * dy);
  const dirX = dirDist > 0 ? dx / dirDist : (hero.facingRight ? 1 : -1);
  const dirY = dirDist > 0 ? dy / dirDist : 0;

  // 범위 공격 직업 여부 (전사, 기사: 근접 범위 / 마법사: 원거리 범위)
  const isAoE = heroClass === 'warrior' || heroClass === 'knight' || heroClass === 'mage';
  // 근거리 직업 여부
  const isMelee = heroClass === 'warrior' || heroClass === 'knight';
  // 전방 공격 각도 (내적 기준: 0.0 = 90도, -0.5 = 120도)
  const attackAngleThreshold = isMelee ? -0.3 : 0.0; // 근거리는 약 110도, 원거리는 90도

  // 궁수: 기본 패시브 다중타겟 (레벨 5 이상) + 패시브 성장 확률 판정
  const baseMultiTargetCount = classConfig.passive.multiTarget || 1;
  // 레벨 5 이상이고 패시브 성장 확률 판정 성공 시 다중타겟
  const isPassiveUnlocked = hero.level >= PASSIVE_UNLOCK_LEVEL;
  const useGrowthMultiTarget = heroClass === 'archer' && isPassiveUnlocked && rollMultiTarget(hero.passiveGrowth.currentValue);
  const multiTargetCount = useGrowthMultiTarget ? baseMultiTargetCount : 1;

  const targetEnemies: { enemy: RPGEnemy; dist: number }[] = [];

  for (const enemy of enemies) {
    if (enemy.hp <= 0) continue;

    const distToHero = distance(hero.x, hero.y, enemy.x, enemy.y);
    if (distToHero > attackRange) continue;

    // 바라보는 방향 체크 (내적 사용)
    const enemyDx = enemy.x - hero.x;
    const enemyDy = enemy.y - hero.y;
    const enemyDist = Math.sqrt(enemyDx * enemyDx + enemyDy * enemyDy);
    if (enemyDist === 0) continue;

    const enemyDirX = enemyDx / enemyDist;
    const enemyDirY = enemyDy / enemyDist;
    const dot = dirX * enemyDirX + dirY * enemyDirY;

    // 바라보는 방향 범위 밖이면 스킵
    if (dot < attackAngleThreshold) continue;

    if (isAoE) {
      // 범위 공격 (전사, 기사, 마법사): 범위 내 모든 적에게 데미지
      enemyDamages.push({ enemyId: enemy.id, damage: finalDamage });
      hitTargets.push({ x: enemy.x, y: enemy.y, damage: finalDamage });
    } else {
      // 다중 타겟 (궁수): 가까운 순서로 정렬 후 선택
      targetEnemies.push({ enemy, dist: distToHero });
    }
  }

  // 다중 타겟 캐릭터 (궁수) - 가까운 순서로 정렬 후 multiTargetCount 명 공격
  if (!isAoE && targetEnemies.length > 0) {
    targetEnemies.sort((a, b) => a.dist - b.dist);
    const targets = targetEnemies.slice(0, multiTargetCount);
    for (const t of targets) {
      enemyDamages.push({ enemyId: t.enemy.id, damage: finalDamage });
      hitTargets.push({ x: t.enemy.x, y: t.enemy.y, damage: finalDamage });
    }
  }

  // 이펙트는 타겟 방향으로 표시
  const effectX = hero.x + dirX * attackRange;
  const effectY = hero.y + dirY * attackRange;

  const effect: SkillEffect = {
    type: skillConfig.type,
    position: { x: hero.x, y: hero.y }, // 영웅 위치에서 시작
    direction: { x: dirX, y: dirY },
    radius: isAoE ? attackRange : undefined,
    damage: finalDamage,
    duration: 0.4, // 이펙트 지속시간 증가
    startTime: gameTime,
    hitTargets, // 피격 대상 위치들
    heroClass, // 직업 정보 (렌더링용)
  };

  let updatedHero = startSkillCooldown(hero, skillConfig.type);

  // 전사: 피해흡혈 적용 (기본 패시브 레벨 5 이상 + 패시브 성장 곱연산 with 광전사 버프)
  if (heroClass === 'warrior' && enemyDamages.length > 0) {
    const totalDamage = enemyDamages.reduce((sum, ed) => sum + ed.damage, 0);

    // 기본 패시브 (레벨 5 이상) + 패시브 성장 피해흡혈
    const baseLifesteal = hero.level >= PASSIVE_UNLOCK_LEVEL ? (classConfig.passive.lifesteal || 0) : 0;
    const growthLifesteal = hero.passiveGrowth.currentValue;
    const passiveTotal = baseLifesteal + growthLifesteal;

    // 광전사 버프 피해흡혈
    const buffLifesteal = berserkerBuff?.lifesteal || 0;

    // 곱연산: (1 + 패시브) * (1 + 버프) - 1
    const totalLifesteal = calculateWarriorLifesteal(passiveTotal, buffLifesteal);

    if (totalLifesteal > 0) {
      const healAmount = Math.floor(totalDamage * totalLifesteal);
      if (healAmount > 0) {
        updatedHero = {
          ...updatedHero,
          hp: Math.min(updatedHero.maxHp, updatedHero.hp + healAmount),
        };
      }
    }
  }

  // 기사: Q 스킬 적중 시 W 스킬(방패 돌진) 쿨타임 1초 감소 (적중당)
  if (heroClass === 'knight' && enemyDamages.length > 0) {
    const cooldownReduction = 1.0 * enemyDamages.length; // 적중한 적 수만큼 1초씩 감소
    const wSkillType = CLASS_SKILLS.knight.w.type;
    const updatedSkills = updatedHero.skills.map((skill) => {
      if (skill.type === wSkillType && skill.currentCooldown > 0) {
        return {
          ...skill,
          currentCooldown: Math.max(0, skill.currentCooldown - cooldownReduction),
        };
      }
      return skill;
    });
    updatedHero = { ...updatedHero, skills: updatedSkills };
  }

  return { hero: updatedHero, effect, enemyDamages };
}

/**
 * 직업별 W 스킬 실행
 */
export function executeWSkill(
  hero: HeroUnit,
  enemies: RPGEnemy[],
  targetX: number,
  targetY: number,
  gameTime: number
): ClassSkillResult {
  const heroClass = hero.heroClass;
  const skillConfig = CLASS_SKILLS[heroClass].w;
  const classConfig = CLASS_CONFIGS[heroClass];
  const baseDamage = hero.config.attack || hero.baseAttack;
  let damage = Math.floor(baseDamage * ((skillConfig as any).damageMultiplier || 1.0));

  // 마법사: 기본 패시브 + 패시브 성장 데미지 보너스 적용 (레벨 5 이상)
  if (heroClass === 'mage') {
    const baseDamageBonus = hero.level >= PASSIVE_UNLOCK_LEVEL ? (classConfig.passive.damageBonus || 0) : 0;
    const growthDamageBonus = hero.passiveGrowth.currentValue;
    damage = Math.floor(damage * (1 + baseDamageBonus + growthDamageBonus));
  }

  const enemyDamages: { enemyId: string; damage: number }[] = [];
  const stunTargets: string[] = [];
  let effect: SkillEffect | undefined;
  let updatedHero = hero;
  let returnStunDuration: number | undefined;

  let buff: Buff | undefined;

  switch (heroClass) {
    case 'warrior':
      // 돌진 - 전방으로 돌진하며 경로상 적에게 150% 데미지 (돌진 중 무적)
      {
        const dashDistance = (skillConfig as any).distance || 200;
        const invincibleDuration = (skillConfig as any).invincibleDuration || 2.0;
        const dashDuration = 0.25; // 돌진 애니메이션 지속 시간
        const dx = targetX - hero.x;
        const dy = targetY - hero.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const dirX = dist > 0 ? dx / dist : 1;
        const dirY = dist > 0 ? dy / dist : 0;

        const newX = Math.max(30, Math.min(RPG_CONFIG.MAP_WIDTH - 30, hero.x + dirX * dashDistance));
        const newY = Math.max(30, Math.min(RPG_CONFIG.MAP_HEIGHT - 30, hero.y + dirY * dashDistance));

        // 돌진 경로상 적에게 데미지 (즉시 적용)
        for (const enemy of enemies) {
          if (enemy.hp <= 0) continue;
          const enemyDist = pointToLineDistance(enemy.x, enemy.y, hero.x, hero.y, newX, newY);
          if (enemyDist <= 50) {
            enemyDamages.push({ enemyId: enemy.id, damage });
          }
        }

        effect = {
          type: skillConfig.type,
          position: { x: hero.x, y: hero.y },
          direction: { x: dirX, y: dirY },
          radius: dashDistance,
          damage,
          duration: dashDuration + 0.1,
          startTime: gameTime,
        };

        // 돌진 후 무적 버프 추가
        buff = {
          type: 'invincible',
          duration: invincibleDuration,
          startTime: gameTime,
        };

        // 돌진 상태 설정 (애니메이션용) - 위치는 즉시 변경하지 않음
        updatedHero = {
          ...hero,
          targetPosition: undefined,
          state: 'moving',
          facingRight: dirX >= 0,
          facingAngle: Math.atan2(dirY, dirX),
          dashState: {
            startX: hero.x,
            startY: hero.y,
            targetX: newX,
            targetY: newY,
            progress: 0,
            duration: dashDuration,
            dirX,
            dirY,
          },
        };
      }
      break;

    case 'archer':
      // 관통 화살 - 일직선 관통 공격
      {
        const pierceDistance = (skillConfig as any).pierceDistance || 300;
        const dx = targetX - hero.x;
        const dy = targetY - hero.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const dirX = dist > 0 ? dx / dist : 1;
        const dirY = dist > 0 ? dy / dist : 0;

        const endX = hero.x + dirX * pierceDistance;
        const endY = hero.y + dirY * pierceDistance;

        for (const enemy of enemies) {
          if (enemy.hp <= 0) continue;
          const enemyDist = pointToLineDistance(enemy.x, enemy.y, hero.x, hero.y, endX, endY);
          if (enemyDist <= 30) {
            enemyDamages.push({ enemyId: enemy.id, damage });
          }
        }

        effect = {
          type: skillConfig.type,
          position: { x: hero.x, y: hero.y },
          direction: { x: dirX, y: dirY },
          radius: pierceDistance,
          damage,
          duration: 0.4,
          startTime: gameTime,
        };
      }
      break;

    case 'knight':
      // 방패 돌진 - 전방 돌진하며 경로상 적에게 최대 HP 10% 데미지 + 2초 기절
      {
        const dashDistance = (skillConfig as any).distance || 150;
        const stunDuration = 2.0; // 기절 지속 시간 (초)
        const hpDamagePercent = (skillConfig as any).hpDamagePercent || 0.1; // 최대 HP의 10%
        const hpBasedDamage = Math.floor(hero.maxHp * hpDamagePercent);
        const dashDuration = 0.25; // 돌진 애니메이션 지속 시간
        const dx = targetX - hero.x;
        const dy = targetY - hero.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const dirX = dist > 0 ? dx / dist : 1;
        const dirY = dist > 0 ? dy / dist : 0;

        const newX = Math.max(30, Math.min(RPG_CONFIG.MAP_WIDTH - 30, hero.x + dirX * dashDistance));
        const newY = Math.max(30, Math.min(RPG_CONFIG.MAP_HEIGHT - 30, hero.y + dirY * dashDistance));

        // 돌진 경로상 적에게 HP 기반 데미지 + 기절 적용
        for (const enemy of enemies) {
          if (enemy.hp <= 0) continue;
          const enemyDist = pointToLineDistance(enemy.x, enemy.y, hero.x, hero.y, newX, newY);
          if (enemyDist <= 50) {
            // HP 기반 데미지 적용
            enemyDamages.push({ enemyId: enemy.id, damage: hpBasedDamage });
            // 기절 적용
            stunTargets.push(enemy.id);
          }
        }

        // 기절 지속시간 설정
        returnStunDuration = stunDuration;

        effect = {
          type: skillConfig.type,
          position: { x: hero.x, y: hero.y },
          targetPosition: { x: newX, y: newY },
          direction: { x: dirX, y: dirY },
          radius: dashDistance,
          duration: dashDuration + 0.5, // 이펙트 지속시간
          startTime: gameTime,
        };

        // 돌진 상태 설정 (애니메이션용) - 위치는 즉시 변경하지 않음
        updatedHero = {
          ...hero,
          targetPosition: undefined,
          state: 'moving',
          facingRight: dirX >= 0,
          facingAngle: Math.atan2(dirY, dirX),
          dashState: {
            startX: hero.x,
            startY: hero.y,
            targetX: newX,
            targetY: newY,
            progress: 0,
            duration: dashDuration,
            dirX,
            dirY,
          },
        };
      }
      break;

    case 'mage':
      // 화염구 - 범위 공격
      {
        const radius = (skillConfig as any).radius || 80;

        // 방향 계산 (영웅 → 타겟)
        const dx = targetX - hero.x;
        const dy = targetY - hero.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const dirX = dist > 0 ? dx / dist : 1;
        const dirY = dist > 0 ? dy / dist : 0;

        for (const enemy of enemies) {
          if (enemy.hp <= 0) continue;
          const enemyDist = distance(targetX, targetY, enemy.x, enemy.y);
          if (enemyDist <= radius) {
            enemyDamages.push({ enemyId: enemy.id, damage });
          }
        }

        effect = {
          type: skillConfig.type,
          position: { x: targetX, y: targetY },
          direction: { x: dirX, y: dirY },
          radius,
          damage,
          duration: 0.7, // 화염구 발사 + 폭발 시간
          startTime: gameTime,
        };
      }
      break;
  }

  updatedHero = startSkillCooldown(updatedHero, skillConfig.type);

  return { hero: updatedHero, effect, enemyDamages, stunTargets, stunDuration: returnStunDuration, buff };
}

/**
 * 직업별 E 스킬 실행 (궁극기)
 */
export function executeESkill(
  hero: HeroUnit,
  enemies: RPGEnemy[],
  targetX: number,
  targetY: number,
  gameTime: number
): ClassSkillResult {
  const heroClass = hero.heroClass;
  const skillConfig = CLASS_SKILLS[heroClass].e;
  const classConfig = CLASS_CONFIGS[heroClass];
  const baseDamage = hero.config.attack || hero.baseAttack;
  let damage = Math.floor(baseDamage * ((skillConfig as any).damageMultiplier || 1.0));

  // 마법사: 기본 패시브 + 패시브 성장 데미지 보너스 적용 (레벨 5 이상)
  if (heroClass === 'mage') {
    const baseDamageBonus = hero.level >= PASSIVE_UNLOCK_LEVEL ? (classConfig.passive.damageBonus || 0) : 0;
    const growthDamageBonus = hero.passiveGrowth.currentValue;
    damage = Math.floor(damage * (1 + baseDamageBonus + growthDamageBonus));
  }

  const enemyDamages: { enemyId: string; damage: number }[] = [];
  let effect: SkillEffect | undefined;
  let buff: Buff | undefined;
  let pendingSkill: PendingSkill | undefined;
  let updatedHero = hero;

  switch (heroClass) {
    case 'warrior':
      // 광전사 - 공격력/공속 증가 + 피해흡혈 버프
      {
        const duration = (skillConfig as any).duration || 10;
        const attackBonus = (skillConfig as any).attackBonus || 0.5;
        const speedBonus = (skillConfig as any).speedBonus || 0.3;
        const lifesteal = 0.5; // 피해량의 50% 흡혈

        buff = {
          type: 'berserker',
          duration,
          startTime: gameTime,
          attackBonus,
          speedBonus,
          lifesteal,
        };

        effect = {
          type: skillConfig.type,
          position: { x: hero.x, y: hero.y },
          duration: 1.0,
          startTime: gameTime,
        };
      }
      break;

    case 'archer':
      // 화살 비 - 범위 내 모든 적에게 데미지
      {
        const radius = (skillConfig as any).radius || 150;

        for (const enemy of enemies) {
          if (enemy.hp <= 0) continue;
          const dist = distance(targetX, targetY, enemy.x, enemy.y);
          if (dist <= radius) {
            enemyDamages.push({ enemyId: enemy.id, damage });
          }
        }

        effect = {
          type: skillConfig.type,
          position: { x: targetX, y: targetY },
          radius,
          damage,
          duration: 1.0,
          startTime: gameTime,
        };
      }
      break;

    case 'knight':
      // 철벽 방어 - 데미지 감소 + HP 회복
      {
        const duration = (skillConfig as any).duration || 5;
        const damageReduction = (skillConfig as any).damageReduction || 0.7;
        const healPercent = (skillConfig as any).healPercent || 0.2;

        buff = {
          type: 'ironwall',
          duration,
          startTime: gameTime,
          damageReduction,
        };

        // HP 회복
        const healAmount = Math.floor(hero.maxHp * healPercent);
        updatedHero = { ...hero, hp: Math.min(hero.maxHp, hero.hp + healAmount) };

        effect = {
          type: skillConfig.type,
          position: { x: hero.x, y: hero.y },
          heal: healAmount,
          duration: 1.0,
          startTime: gameTime,
        };
      }
      break;

    case 'mage':
      // 운석 낙하 - 3초 후 대범위 공격
      {
        const radius = (skillConfig as any).radius || 150;
        const delay = (skillConfig as any).delay || 3.0;

        pendingSkill = {
          type: skillConfig.type,
          position: { x: targetX, y: targetY },
          triggerTime: gameTime + delay,
          damage,
          radius,
        };

        // 경고 이펙트
        effect = {
          type: 'mage_e' as SkillType,
          position: { x: targetX, y: targetY },
          radius,
          damage: 0, // 경고용
          duration: delay,
          startTime: gameTime,
        };
      }
      break;
  }

  updatedHero = startSkillCooldown(updatedHero, skillConfig.type);

  return { hero: updatedHero, effect, enemyDamages, buff, pendingSkill };
}

/**
 * 점과 선분 사이의 거리 계산
 */
function pointToLineDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx: number, yy: number;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = px - xx;
  const dy = py - yy;

  return Math.sqrt(dx * dx + dy * dy);
}
