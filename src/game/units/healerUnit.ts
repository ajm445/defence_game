import { Unit, Base } from '../../types';
import { distance } from '../../utils/math';

export interface HealerUpdateResult {
  unit: Unit;
  healTarget?: { targetId: string; healAmount: number };
  unitDamage?: { targetId: string; damage: number; attackerId: string };
}

export function updateHealerUnit(
  unit: Unit,
  deltaTime: number,
  allies: Unit[],
  enemies: Unit[],
  allyBase: Base
): HealerUpdateResult {
  const config = unit.config;
  const healRate = config.healRate || 10;
  const healRange = config.healRange || 100;
  const attack = config.attack || 3;
  const range = config.range || 25;

  let updatedUnit = { ...unit };
  let healTarget: { targetId: string; healAmount: number } | undefined;
  let unitDamage: { targetId: string; damage: number; attackerId: string } | undefined;

  // 쿨다운 감소
  if (updatedUnit.attackCooldown > 0) {
    updatedUnit.attackCooldown -= deltaTime;
  }

  // 우선순위: 회복 > 반격 > 본진 대기

  // 1순위: HP 비율이 가장 낮은 아군 찾기 (HP가 max가 아닌 아군만)
  let lowestHpAlly: Unit | null = null;
  let lowestHpRatio = 1;

  for (const ally of allies) {
    if (ally.id === unit.id) continue; // 자기 자신 제외
    if (ally.hp <= 0) continue; // 죽은 유닛 제외
    if (ally.hp >= ally.maxHp) continue; // 풀피 유닛 제외

    const hpRatio = ally.hp / ally.maxHp;
    if (hpRatio < lowestHpRatio) {
      lowestHpRatio = hpRatio;
      lowestHpAlly = ally;
    }
  }

  // 회복 대상이 있으면 회복 우선
  if (lowestHpAlly) {
    const distToAlly = distance(unit.x, unit.y, lowestHpAlly.x, lowestHpAlly.y);

    if (distToAlly > healRange) {
      // 아군에게 이동
      const angle = Math.atan2(lowestHpAlly.y - unit.y, lowestHpAlly.x - unit.x);
      updatedUnit.x += Math.cos(angle) * config.speed;
      updatedUnit.y += Math.sin(angle) * config.speed;
      updatedUnit.state = 'moving';
    } else {
      // 회복
      updatedUnit.state = 'healing';
      const healAmount = healRate * deltaTime;
      healTarget = { targetId: lowestHpAlly.id, healAmount };
    }
    return { unit: updatedUnit, healTarget, unitDamage };
  }

  // 2순위: 회복 대상 없으면 반격 (attackerId가 있으면)
  if (unit.attackerId) {
    const attacker = enemies.find((e) => e.id === unit.attackerId && e.hp > 0);

    if (attacker) {
      const distToAttacker = distance(unit.x, unit.y, attacker.x, attacker.y);

      if (distToAttacker > range) {
        // 공격자에게 이동
        const angle = Math.atan2(attacker.y - unit.y, attacker.x - unit.x);
        updatedUnit.x += Math.cos(angle) * config.speed;
        updatedUnit.y += Math.sin(angle) * config.speed;
        updatedUnit.state = 'moving';
      } else {
        // 반격
        if (updatedUnit.attackCooldown <= 0) {
          unitDamage = { targetId: attacker.id, damage: attack, attackerId: unit.id };
          updatedUnit.attackCooldown = 1;
          updatedUnit.state = 'attacking';
        }
      }
      return { unit: updatedUnit, healTarget, unitDamage };
    } else {
      // 공격자가 죽었으면 attackerId 초기화
      updatedUnit.attackerId = undefined;
    }
  }

  // 3순위: 본진 근처로 대기
  const distToBase = distance(unit.x, unit.y, allyBase.x, allyBase.y);

  if (distToBase > 150) {
    // 본진으로 이동
    const angle = Math.atan2(allyBase.y - unit.y, allyBase.x - unit.x);
    updatedUnit.x += Math.cos(angle) * config.speed;
    updatedUnit.y += Math.sin(angle) * config.speed;
    updatedUnit.state = 'moving';
  } else {
    updatedUnit.state = 'idle';
  }

  return { unit: updatedUnit, healTarget, unitDamage };
}
