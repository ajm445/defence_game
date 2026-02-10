import { Unit, Base } from '../../types';
import { distance } from '../../utils/math';

export interface MageUpdateResult {
  unit: Unit;
  baseDamage?: { team: 'player' | 'enemy'; damage: number };
  aoeDamage?: { targetId: string; damage: number; attackerId: string }[];
}

export function updateMageUnit(
  unit: Unit,
  deltaTime: number,
  enemyBase: Base,
  enemies: Unit[]
): MageUpdateResult {
  const config = unit.config;
  const range = config.range || 180;
  const attack = config.attack || 35;
  const aoeRadius = config.aoeRadius || 50;
  const attackSpeed = config.attackSpeed || 2.5;

  let updatedUnit = { ...unit };
  let baseDamage: { team: 'player' | 'enemy'; damage: number } | undefined;
  let aoeDamage: { targetId: string; damage: number; attackerId: string }[] | undefined;

  // 쿨다운 감소
  if (updatedUnit.attackCooldown > 0) {
    updatedUnit.attackCooldown -= deltaTime;
  }

  const distToBase = distance(unit.x, unit.y, enemyBase.x, enemyBase.y);

  // 0. 반격 대상 확인 (공격받은 경우, 사거리 내에 있을 때만 반격)
  let attacker: Unit | null = null;
  if (unit.attackerId) {
    attacker = enemies.find(e => e.id === unit.attackerId && e.hp > 0) || null;
  }

  if (attacker) {
    const attackerDist = distance(unit.x, unit.y, attacker.x, attacker.y);
    if (attackerDist <= range) {
      if (updatedUnit.attackCooldown <= 0) {
        aoeDamage = calculateAoeDamage(unit, attacker, enemies, attack, aoeRadius);
        updatedUnit.attackCooldown = attackSpeed;
        updatedUnit.state = 'attacking';
      }
      return { unit: updatedUnit, baseDamage, aoeDamage };
    }
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

  // 우선순위: 적 유닛 > 기지
  if (nearestEnemy && minEnemyDist <= distToBase) {
    if (minEnemyDist <= range) {
      if (updatedUnit.attackCooldown <= 0) {
        aoeDamage = calculateAoeDamage(unit, nearestEnemy, enemies, attack, aoeRadius);
        updatedUnit.attackCooldown = attackSpeed;
        updatedUnit.state = 'attacking';
      }
    } else {
      const angle = Math.atan2(nearestEnemy.y - unit.y, nearestEnemy.x - unit.x);
      updatedUnit.x += Math.cos(angle) * config.speed;
      updatedUnit.y += Math.sin(angle) * config.speed;
      updatedUnit.state = 'moving';
    }
    return { unit: updatedUnit, baseDamage, aoeDamage };
  }

  // 기지로 이동/공격
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
      updatedUnit.attackCooldown = attackSpeed;
      updatedUnit.state = 'attacking';
    }
  }

  return { unit: updatedUnit, baseDamage, aoeDamage };
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
