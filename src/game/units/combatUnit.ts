import { Unit, Base, Wall } from '../../types';
import { distance } from '../../utils/math';

export interface CombatUpdateResult {
  unit: Unit;
  baseDamage?: { team: 'player' | 'enemy'; damage: number };
  unitDamage?: { targetId: string; damage: number; attackerId: string };
  wallDamage?: { wallId: string; damage: number };
}

export function updateCombatUnit(
  unit: Unit,
  deltaTime: number,
  enemyBase: Base,
  enemies: Unit[],
  enemyWalls: Wall[] = []
): CombatUpdateResult {
  const config = unit.config;
  const range = config.range || 30;
  const attack = config.attack || 0;

  let updatedUnit = { ...unit };
  let baseDamage: { team: 'player' | 'enemy'; damage: number } | undefined;
  let unitDamage: { targetId: string; damage: number; attackerId: string } | undefined;
  let wallDamage: { wallId: string; damage: number } | undefined;

  // 쿨다운 감소
  if (updatedUnit.attackCooldown > 0) {
    updatedUnit.attackCooldown -= deltaTime;
  }

  // 1. 공격받은 적 찾기 (반격 대상)
  let attacker: Unit | null = null;
  if (unit.attackerId) {
    attacker = enemies.find(e => e.id === unit.attackerId && e.hp > 0) || null;
    // 공격자가 죽었으면 attackerId 초기화
    if (!attacker) {
      updatedUnit.attackerId = undefined;
    }
  }

  // 2. 현재 타겟 벽 확인 (이미 공격 중인 벽이 있으면 그 벽 유지)
  let targetWall: Wall | null = null;
  if (unit.targetWallId) {
    targetWall = enemyWalls.find(w => w.id === unit.targetWallId && w.hp > 0) || null;
    // 타겟 벽이 파괴되었으면 targetWallId 초기화
    if (!targetWall) {
      updatedUnit.targetWallId = undefined;
    }
  }

  // 타겟 벽이 없으면 가장 가까운 벽 찾기
  let minWallDist = targetWall ? distance(unit.x, unit.y, targetWall.x, targetWall.y) : Infinity;
  if (!targetWall) {
    for (const wall of enemyWalls) {
      if (wall.hp > 0) {
        const dist = distance(unit.x, unit.y, wall.x, wall.y);
        if (dist < minWallDist) {
          minWallDist = dist;
          targetWall = wall;
        }
      }
    }
  }

  // 3. 가장 가까운 적 유닛 찾기 (범위 내에 있는 경우만)
  let nearestEnemy: Unit | null = null;
  let minEnemyDist = Infinity;

  for (const enemy of enemies) {
    if (enemy.hp > 0) {
      const dist = distance(unit.x, unit.y, enemy.x, enemy.y);
      if (dist < minEnemyDist) {
        minEnemyDist = dist;
        nearestEnemy = enemy;
      }
    }
  }

  const distToBase = distance(unit.x, unit.y, enemyBase.x, enemyBase.y);

  // 우선순위: 반격 대상 > 벽(공격중 또는 경로상) > 범위 내 적 > 본진

  // 1순위: 반격 대상 (공격받은 경우)
  if (attacker) {
    const attackerDist = distance(unit.x, unit.y, attacker.x, attacker.y);
    if (attackerDist <= range) {
      if (updatedUnit.attackCooldown <= 0) {
        unitDamage = { targetId: attacker.id, damage: attack, attackerId: unit.id };
        updatedUnit.attackCooldown = 1;
        updatedUnit.state = 'attacking';
      }
    } else {
      // 공격자에게 이동
      const angle = Math.atan2(attacker.y - unit.y, attacker.x - unit.x);
      updatedUnit.x += Math.cos(angle) * config.speed;
      updatedUnit.y += Math.sin(angle) * config.speed;
      updatedUnit.state = 'moving';
    }
    // 반격 중에도 targetWallId는 유지 (공격자 처리 후 벽으로 복귀)
    return { unit: updatedUnit, baseDamage, unitDamage, wallDamage };
  }

  // 2순위: 벽 (이미 공격 중이거나 본진보다 가까운 경우)
  const hasTargetWall = unit.targetWallId && targetWall;
  const shouldAttackWall = targetWall && (hasTargetWall || minWallDist < distToBase);

  if (shouldAttackWall && targetWall) {
    // 벽 타겟 고정
    updatedUnit.targetWallId = targetWall.id;

    if (minWallDist <= range) {
      if (updatedUnit.attackCooldown <= 0) {
        wallDamage = { wallId: targetWall.id, damage: attack };
        updatedUnit.attackCooldown = 1;
        updatedUnit.state = 'attacking';
      }
    } else {
      // 벽으로 이동
      const angle = Math.atan2(targetWall.y - unit.y, targetWall.x - unit.x);
      updatedUnit.x += Math.cos(angle) * config.speed;
      updatedUnit.y += Math.sin(angle) * config.speed;
      updatedUnit.state = 'moving';
    }
    return { unit: updatedUnit, baseDamage, unitDamage, wallDamage };
  }

  // 3순위: 범위 내 적 유닛
  if (nearestEnemy && minEnemyDist <= range) {
    if (updatedUnit.attackCooldown <= 0) {
      unitDamage = { targetId: nearestEnemy.id, damage: attack, attackerId: unit.id };
      updatedUnit.attackCooldown = 1;
      updatedUnit.state = 'attacking';
    }
    return { unit: updatedUnit, baseDamage, unitDamage, wallDamage };
  }

  // 4순위: 본진으로 이동/공격
  if (distToBase > range) {
    const angle = Math.atan2(enemyBase.y - unit.y, enemyBase.x - unit.x);
    updatedUnit.x += Math.cos(angle) * config.speed;
    updatedUnit.y += Math.sin(angle) * config.speed;
    updatedUnit.state = 'moving';
  } else {
    if (updatedUnit.attackCooldown <= 0) {
      baseDamage = {
        team: unit.team === 'player' ? 'enemy' : 'player',
        damage: attack,
      };
      updatedUnit.attackCooldown = 1;
      updatedUnit.state = 'attacking';
    }
  }

  return { unit: updatedUnit, baseDamage, unitDamage, wallDamage };
}
