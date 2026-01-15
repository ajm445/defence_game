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

  // 가장 가까운 적 유닛 찾기 (전투/지원 유닛 모두 포함)
  let target: Unit | null = null;
  let minDist = Infinity;

  for (const enemy of enemies) {
    if (enemy.hp > 0) {
      const dist = distance(unit.x, unit.y, enemy.x, enemy.y);
      if (dist < minDist) {
        minDist = dist;
        target = enemy;
      }
    }
  }

  // 가장 가까운 벽 찾기
  let targetWall: Wall | null = null;
  let minWallDist = Infinity;

  for (const wall of enemyWalls) {
    if (wall.hp > 0) {
      const dist = distance(unit.x, unit.y, wall.x, wall.y);
      if (dist < minWallDist) {
        minWallDist = dist;
        targetWall = wall;
      }
    }
  }

  if (!target) {
    // 적 유닛이 없으면 벽 또는 본진 공격

    // 벽이 있고 범위 내에 있으면 벽 공격
    if (targetWall && minWallDist <= range) {
      if (updatedUnit.attackCooldown <= 0) {
        wallDamage = { wallId: targetWall.id, damage: attack };
        updatedUnit.attackCooldown = 1;
        updatedUnit.state = 'attacking';
      }
    } else if (targetWall && minWallDist < distance(unit.x, unit.y, enemyBase.x, enemyBase.y)) {
      // 벽이 본진보다 가까우면 벽으로 이동
      const angle = Math.atan2(targetWall.y - unit.y, targetWall.x - unit.x);
      updatedUnit.x += Math.cos(angle) * config.speed;
      updatedUnit.y += Math.sin(angle) * config.speed;
      updatedUnit.state = 'moving';
    } else {
      // 본진으로 이동/공격
      const distToBase = distance(unit.x, unit.y, enemyBase.x, enemyBase.y);

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
    }
  } else {
    // 적 유닛으로 이동/공격
    if (minDist > range) {
      const angle = Math.atan2(target.y - unit.y, target.x - unit.x);
      updatedUnit.x += Math.cos(angle) * config.speed;
      updatedUnit.y += Math.sin(angle) * config.speed;
      updatedUnit.state = 'moving';
    } else {
      if (updatedUnit.attackCooldown <= 0) {
        // 타겟에게 데미지
        unitDamage = { targetId: target.id, damage: attack, attackerId: unit.id };
        updatedUnit.attackCooldown = 1;
        updatedUnit.state = 'attacking';
      }
    }
  }

  return { unit: updatedUnit, baseDamage, unitDamage, wallDamage };
}
