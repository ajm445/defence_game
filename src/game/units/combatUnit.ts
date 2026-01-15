import { Unit, Base } from '../../types';
import { distance } from '../../utils/math';

export interface CombatUpdateResult {
  unit: Unit;
  baseDamage?: { team: 'player' | 'enemy'; damage: number };
}

export function updateCombatUnit(
  unit: Unit,
  deltaTime: number,
  enemyBase: Base,
  enemies: Unit[]
): CombatUpdateResult {
  const config = unit.config;
  const range = config.range || 30;
  const attack = config.attack || 0;

  let updatedUnit = { ...unit };
  let baseDamage: { team: 'player' | 'enemy'; damage: number } | undefined;

  // 쿨다운 감소
  if (updatedUnit.attackCooldown > 0) {
    updatedUnit.attackCooldown -= deltaTime;
  }

  // 가장 가까운 적 전투 유닛 찾기
  let target: Unit | null = null;
  let minDist = Infinity;

  for (const enemy of enemies) {
    if (enemy.config.type === 'combat' && enemy.hp > 0) {
      const dist = distance(unit.x, unit.y, enemy.x, enemy.y);
      if (dist < minDist) {
        minDist = dist;
        target = enemy;
      }
    }
  }

  if (!target) {
    // 적 유닛이 없으면 적 본진으로
    const distToBase = distance(unit.x, unit.y, enemyBase.x, enemyBase.y);

    if (distToBase > range) {
      // 본진으로 이동
      const angle = Math.atan2(enemyBase.y - unit.y, enemyBase.x - unit.x);
      updatedUnit.x += Math.cos(angle) * config.speed;
      updatedUnit.y += Math.sin(angle) * config.speed;
      updatedUnit.state = 'moving';
    } else {
      // 본진 공격
      if (updatedUnit.attackCooldown <= 0) {
        baseDamage = {
          team: unit.team === 'player' ? 'enemy' : 'player',
          damage: attack,
        };
        updatedUnit.attackCooldown = 1;
        updatedUnit.state = 'attacking';
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
        // 타겟에게 데미지 (반환하지 않고 직접 수정됨)
        target.hp -= attack;
        updatedUnit.attackCooldown = 1;
        updatedUnit.state = 'attacking';
      }
    }
  }

  return { unit: updatedUnit, baseDamage };
}
