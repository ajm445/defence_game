import { Unit, Base, Wall } from '../../types';
import { distance } from '../../utils/math';

export interface MageUpdateResult {
  unit: Unit;
  baseDamage?: { team: 'player' | 'enemy'; damage: number };
  aoeDamage?: { targetId: string; damage: number; attackerId: string }[];
  wallDamage?: { wallId: string; damage: number };
}

export function updateMageUnit(
  unit: Unit,
  deltaTime: number,
  enemyBase: Base,
  enemies: Unit[],
  enemyWalls: Wall[] = []
): MageUpdateResult {
  const config = unit.config;
  const range = config.range || 180;
  const attack = config.attack || 35;
  const aoeRadius = config.aoeRadius || 50;
  const cooldownTime = 2; // 2초 쿨다운

  let updatedUnit = { ...unit };
  let baseDamage: { team: 'player' | 'enemy'; damage: number } | undefined;
  let aoeDamage: { targetId: string; damage: number; attackerId: string }[] | undefined;
  let wallDamage: { wallId: string; damage: number } | undefined;

  // 쿨다운 감소
  if (updatedUnit.attackCooldown > 0) {
    updatedUnit.attackCooldown -= deltaTime;
  }

  const distToBase = distance(unit.x, unit.y, enemyBase.x, enemyBase.y);

  // 0. 반격 대상 확인 (공격받은 경우 우선 반격)
  let attacker: Unit | null = null;
  if (unit.attackerId) {
    attacker = enemies.find(e => e.id === unit.attackerId && e.hp > 0) || null;
  }

  if (attacker) {
    const attackerDist = distance(unit.x, unit.y, attacker.x, attacker.y);
    if (attackerDist <= range) {
      // 사거리 내: AOE 반격
      if (updatedUnit.attackCooldown <= 0) {
        aoeDamage = calculateAoeDamage(unit, attacker, enemies, attack, aoeRadius);
        updatedUnit.attackCooldown = cooldownTime;
        updatedUnit.state = 'attacking';
      }
    } else {
      // 사거리 밖: 반격 대상에게 이동
      const angle = Math.atan2(attacker.y - unit.y, attacker.x - unit.x);
      updatedUnit.x += Math.cos(angle) * config.speed;
      updatedUnit.y += Math.sin(angle) * config.speed;
      updatedUnit.state = 'moving';
    }
    return { unit: updatedUnit, baseDamage, aoeDamage, wallDamage };
  }

  // 1. 가장 가까운 적 유닛 찾기
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

  // 2. 경로상에 있는 벽 찾기 (본진 방향에 있고 본진보다 가까운 벽)
  let targetWall: Wall | null = null;
  let minWallDist = Infinity;

  for (const wall of enemyWalls) {
    if (wall.hp > 0) {
      const wallDist = distance(unit.x, unit.y, wall.x, wall.y);
      // 벽이 본진보다 가깝고, 본진 방향에 있는지 확인
      if (wallDist < distToBase) {
        const toWallX = wall.x - unit.x;
        const toBaseX = enemyBase.x - unit.x;
        // 같은 방향인지 확인 (부호가 같은지)
        if ((toWallX > 0 && toBaseX > 0) || (toWallX < 0 && toBaseX < 0)) {
          if (wallDist < minWallDist) {
            minWallDist = wallDist;
            targetWall = wall;
          }
        }
      }
    }
  }

  // 우선순위: 가장 가까운 적 유닛 > 경로상 벽 > 본진
  const wallOrBaseDist = targetWall ? minWallDist : distToBase;

  // 1순위: 가장 가까운 적 유닛 (벽/본진보다 가까운 경우, AOE 공격)
  if (nearestEnemy && minEnemyDist <= wallOrBaseDist) {
    if (minEnemyDist <= range) {
      // 사거리 내: AOE 공격
      if (updatedUnit.attackCooldown <= 0) {
        aoeDamage = calculateAoeDamage(unit, nearestEnemy, enemies, attack, aoeRadius);
        updatedUnit.attackCooldown = cooldownTime;
        updatedUnit.state = 'attacking';
      }
    } else {
      // 사거리 밖: 적에게 이동
      const angle = Math.atan2(nearestEnemy.y - unit.y, nearestEnemy.x - unit.x);
      updatedUnit.x += Math.cos(angle) * config.speed;
      updatedUnit.y += Math.sin(angle) * config.speed;
      updatedUnit.state = 'moving';
    }
    return { unit: updatedUnit, baseDamage, aoeDamage, wallDamage };
  }

  // 2순위: 벽 (본진보다 가까운 경우, 단일 타겟)
  if (targetWall && minWallDist < distToBase) {
    if (minWallDist <= range) {
      if (updatedUnit.attackCooldown <= 0) {
        wallDamage = { wallId: targetWall.id, damage: attack };
        updatedUnit.attackCooldown = cooldownTime;
        updatedUnit.state = 'attacking';
      }
    } else {
      const angle = Math.atan2(targetWall.y - unit.y, targetWall.x - unit.x);
      updatedUnit.x += Math.cos(angle) * config.speed;
      updatedUnit.y += Math.sin(angle) * config.speed;
      updatedUnit.state = 'moving';
    }
    return { unit: updatedUnit, baseDamage, aoeDamage, wallDamage };
  }

  // 3순위: 본진으로 이동/공격 (단일 타겟)
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
      updatedUnit.attackCooldown = cooldownTime;
      updatedUnit.state = 'attacking';
    }
  }

  return { unit: updatedUnit, baseDamage, aoeDamage, wallDamage };
}

// AOE 데미지 계산: 타겟 중심으로 범위 내 모든 적에게 피해
function calculateAoeDamage(
  attacker: Unit,
  target: Unit,
  enemies: Unit[],
  baseDamage: number,
  aoeRadius: number
): { targetId: string; damage: number; attackerId: string }[] {
  const damages: { targetId: string; damage: number; attackerId: string }[] = [];

  for (const enemy of enemies) {
    if (enemy.hp <= 0) continue;

    const distFromTarget = distance(target.x, target.y, enemy.x, enemy.y);

    if (distFromTarget <= aoeRadius) {
      // 중심에서 가장자리로 갈수록 데미지 감소 (100% → 50%)
      const damageMultiplier = 1 - (distFromTarget / aoeRadius) * 0.5;
      const damage = Math.floor(baseDamage * damageMultiplier);

      damages.push({
        targetId: enemy.id,
        damage,
        attackerId: attacker.id,
      });
    }
  }

  return damages;
}
