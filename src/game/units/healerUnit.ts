import { Unit, Base } from '../../types';
import { distance } from '../../utils/math';

// 전투 유닛 타입 목록
const COMBAT_UNIT_TYPES = ['melee', 'ranged', 'knight', 'mage'];

export interface HealerUpdateResult {
  unit: Unit;
  healTargets?: { targetId: string; healAmount: number }[]; // 광역 회복을 위해 배열로 변경
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
  const attackSpeed = config.attackSpeed || 1;
  const range = config.range || 25;

  let updatedUnit = { ...unit };
  let healTargets: { targetId: string; healAmount: number }[] | undefined;
  let unitDamage: { targetId: string; damage: number; attackerId: string } | undefined;

  // 쿨다운 감소
  if (updatedUnit.attackCooldown > 0) {
    updatedUnit.attackCooldown -= deltaTime;
  }

  // 아군 전투 유닛 목록
  const allyCombatUnits = allies.filter(
    (a) => a.id !== unit.id && a.hp > 0 && COMBAT_UNIT_TYPES.includes(a.type)
  );

  // 적 전투 유닛 목록
  const enemyCombatUnits = enemies.filter(
    (e) => e.hp > 0 && COMBAT_UNIT_TYPES.includes(e.type)
  );

  // 우선순위: 전투유닛 회복 > 아군 전투유닛 따라가기 > 적 공격 > 본진 대기
  // (지원 유닛이 피해를 입어도 전투 유닛만 회복하고 따라다님)

  // 피해를 입은 아군 전투 유닛 찾기 (HP 비율이 가장 낮은 전투 유닛)
  let lowestHpCombatUnit: Unit | null = null;
  let lowestHpRatio = 1;

  for (const combatUnit of allyCombatUnits) {
    if (combatUnit.hp >= combatUnit.maxHp) continue; // 풀피 유닛 제외

    const hpRatio = combatUnit.hp / combatUnit.maxHp;
    if (hpRatio < lowestHpRatio) {
      lowestHpRatio = hpRatio;
      lowestHpCombatUnit = combatUnit;
    }
  }

  // 1순위: 피해를 입은 전투 유닛이 있으면 회복 우선
  if (lowestHpCombatUnit) {
    const distToAlly = distance(unit.x, unit.y, lowestHpCombatUnit.x, lowestHpCombatUnit.y);

    if (distToAlly > healRange) {
      // 전투 유닛에게 이동
      const angle = Math.atan2(lowestHpCombatUnit.y - unit.y, lowestHpCombatUnit.x - unit.x);
      updatedUnit.x += Math.cos(angle) * config.speed;
      updatedUnit.y += Math.sin(angle) * config.speed;
      updatedUnit.state = 'moving';
    } else {
      // 광역 회복: 힐러 범위 내의 모든 피해 입은 전투 유닛 회복
      updatedUnit.state = 'healing';
      const healAmount = healRate * deltaTime;
      healTargets = [];

      for (const combatUnit of allyCombatUnits) {
        if (combatUnit.hp >= combatUnit.maxHp) continue; // 풀피 유닛 제외

        const distToTarget = distance(unit.x, unit.y, combatUnit.x, combatUnit.y);
        if (distToTarget <= healRange) {
          healTargets.push({ targetId: combatUnit.id, healAmount });
        }
      }
    }
    return { unit: updatedUnit, healTargets, unitDamage };
  }

  // 2순위: 아군 전투 유닛이 있으면 가장 가까운 전투 유닛 따라가기 (피해 입은 전투유닛 없어도)
  if (allyCombatUnits.length > 0) {
    let nearestCombatUnit: Unit | null = null;
    let nearestDist = Infinity;

    for (const combatUnit of allyCombatUnits) {
      const dist = distance(unit.x, unit.y, combatUnit.x, combatUnit.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestCombatUnit = combatUnit;
      }
    }

    if (nearestCombatUnit) {
      // 전투 유닛 근처에 있으면 대기, 멀면 따라가기
      const followDistance = healRange * 0.8; // 회복 범위 내에 머무름

      if (nearestDist > followDistance) {
        const angle = Math.atan2(nearestCombatUnit.y - unit.y, nearestCombatUnit.x - unit.x);
        updatedUnit.x += Math.cos(angle) * config.speed;
        updatedUnit.y += Math.sin(angle) * config.speed;
        updatedUnit.state = 'moving';
      } else {
        updatedUnit.state = 'idle';
      }
    }
    return { unit: updatedUnit, healTargets, unitDamage };
  }

  // 3순위: 아군 전투 유닛이 없고 적 전투 유닛이 있으면 공격
  if (enemyCombatUnits.length > 0) {
    // 가장 가까운 적 전투 유닛 찾기
    let nearestEnemy: Unit | null = null;
    let nearestDist = Infinity;

    for (const enemy of enemyCombatUnits) {
      const dist = distance(unit.x, unit.y, enemy.x, enemy.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestEnemy = enemy;
      }
    }

    if (nearestEnemy) {
      if (nearestDist > range) {
        // 적에게 이동
        const angle = Math.atan2(nearestEnemy.y - unit.y, nearestEnemy.x - unit.x);
        updatedUnit.x += Math.cos(angle) * config.speed;
        updatedUnit.y += Math.sin(angle) * config.speed;
        updatedUnit.state = 'moving';
      } else {
        // 공격
        if (updatedUnit.attackCooldown <= 0) {
          unitDamage = { targetId: nearestEnemy.id, damage: attack, attackerId: unit.id };
          updatedUnit.attackCooldown = attackSpeed;
          updatedUnit.state = 'attacking';
        }
      }
    }
    return { unit: updatedUnit, healTargets, unitDamage };
  }

  // 4순위: 반격 (attackerId가 있고 사거리 내일 때만)
  if (unit.attackerId) {
    const attacker = enemies.find((e) => e.id === unit.attackerId && e.hp > 0);

    if (attacker) {
      const distToAttacker = distance(unit.x, unit.y, attacker.x, attacker.y);

      if (distToAttacker <= range) {
        // 사거리 내: 반격
        if (updatedUnit.attackCooldown <= 0) {
          unitDamage = { targetId: attacker.id, damage: attack, attackerId: unit.id };
          updatedUnit.attackCooldown = attackSpeed;
          updatedUnit.state = 'attacking';
        }
        return { unit: updatedUnit, healTargets, unitDamage };
      }
      // 사거리 밖이면 반격하지 않고 아래 로직으로 진행 (본진 대기)
    } else {
      // 공격자가 죽었으면 attackerId 초기화
      updatedUnit.attackerId = undefined;
    }
  }

  // 5순위: 본진 근처로 대기
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

  return { unit: updatedUnit, healTargets, unitDamage };
}
