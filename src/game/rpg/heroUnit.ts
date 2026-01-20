import { HeroUnit, RPGEnemy } from '../../types/rpg';
import { distance, clamp } from '../../utils/math';
import { RPG_CONFIG } from '../../constants/rpgConfig';

export interface HeroUpdateResult {
  hero: HeroUnit;
  enemyDamage?: { targetId: string; damage: number };
  reachedTarget: boolean;
}

/**
 * 영웅 유닛 업데이트
 */
export function updateHeroUnit(
  hero: HeroUnit,
  deltaTime: number,
  enemies: RPGEnemy[]
): HeroUpdateResult {
  let updatedHero = { ...hero };
  let enemyDamage: { targetId: string; damage: number } | undefined;
  let reachedTarget = false;

  // 쿨다운 감소
  if (updatedHero.attackCooldown > 0) {
    updatedHero.attackCooldown -= deltaTime;
  }

  const config = updatedHero.config;
  const range = config.range || RPG_CONFIG.HERO.RANGE;
  const attack = config.attack || updatedHero.baseAttack;
  const attackSpeed = config.attackSpeed || RPG_CONFIG.HERO.ATTACK_SPEED;
  const speed = config.speed || updatedHero.baseSpeed;

  // 1. 공격 대상이 있는 경우
  if (updatedHero.attackTarget) {
    const target = enemies.find((e) => e.id === updatedHero.attackTarget && e.hp > 0);

    if (target) {
      const dist = distance(updatedHero.x, updatedHero.y, target.x, target.y);

      if (dist <= range) {
        // 사거리 내: 공격
        if (updatedHero.attackCooldown <= 0) {
          enemyDamage = { targetId: target.id, damage: attack };
          updatedHero.attackCooldown = attackSpeed;
          updatedHero.state = 'attacking';
        }
      } else {
        // 사거리 밖: 타겟으로 이동
        const angle = Math.atan2(target.y - updatedHero.y, target.x - updatedHero.x);
        updatedHero.x += Math.cos(angle) * speed * deltaTime * 60;
        updatedHero.y += Math.sin(angle) * speed * deltaTime * 60;
        updatedHero.state = 'moving';
      }
    } else {
      // 타겟이 죽었거나 없음
      updatedHero.attackTarget = undefined;
      updatedHero.state = 'idle';
    }
  }
  // 2. 이동 목표가 있는 경우
  else if (updatedHero.targetPosition) {
    const target = updatedHero.targetPosition;
    const dist = distance(updatedHero.x, updatedHero.y, target.x, target.y);
    const moveDistance = speed * deltaTime * 60;

    if (dist <= moveDistance) {
      // 목표 지점 도착
      updatedHero.x = target.x;
      updatedHero.y = target.y;
      updatedHero.targetPosition = undefined;
      updatedHero.state = 'idle';
      reachedTarget = true;
    } else {
      // 목표 지점으로 이동
      const angle = Math.atan2(target.y - updatedHero.y, target.x - updatedHero.x);
      updatedHero.x += Math.cos(angle) * moveDistance;
      updatedHero.y += Math.sin(angle) * moveDistance;
      updatedHero.state = 'moving';
    }
  } else {
    updatedHero.state = 'idle';
  }

  // 맵 경계 처리
  updatedHero.x = clamp(updatedHero.x, 30, RPG_CONFIG.MAP_WIDTH - 30);
  updatedHero.y = clamp(updatedHero.y, 30, RPG_CONFIG.MAP_HEIGHT - 30);

  return { hero: updatedHero, enemyDamage, reachedTarget };
}

/**
 * 영웅과 가장 가까운 적 찾기
 */
export function findNearestEnemy(
  hero: HeroUnit,
  enemies: RPGEnemy[]
): RPGEnemy | null {
  let nearest: RPGEnemy | null = null;
  let minDist = Infinity;

  for (const enemy of enemies) {
    if (enemy.hp > 0) {
      const dist = distance(hero.x, hero.y, enemy.x, enemy.y);
      if (dist < minDist) {
        minDist = dist;
        nearest = enemy;
      }
    }
  }

  return nearest;
}

/**
 * 범위 내 적 찾기
 */
export function findEnemiesInRange(
  x: number,
  y: number,
  range: number,
  enemies: RPGEnemy[]
): RPGEnemy[] {
  return enemies.filter((enemy) => {
    if (enemy.hp <= 0) return false;
    const dist = distance(x, y, enemy.x, enemy.y);
    return dist <= range;
  });
}

/**
 * 영웅이 적에게 데미지 받음
 */
export function heroTakeDamage(hero: HeroUnit, damage: number): HeroUnit {
  const newHp = Math.max(0, hero.hp - damage);
  return { ...hero, hp: newHp };
}

/**
 * 영웅 회복
 */
export function heroHeal(hero: HeroUnit, amount: number): HeroUnit {
  const newHp = Math.min(hero.maxHp, hero.hp + amount);
  return { ...hero, hp: newHp };
}

/**
 * 영웅 레벨업 가능 여부 확인
 */
export function canLevelUp(hero: HeroUnit): boolean {
  return hero.exp >= hero.expToNextLevel;
}

/**
 * 클릭 위치에서 적 찾기 (선택용)
 */
export function findEnemyAtPosition(
  x: number,
  y: number,
  enemies: RPGEnemy[],
  clickRadius: number = 30
): RPGEnemy | null {
  for (const enemy of enemies) {
    if (enemy.hp > 0) {
      const dist = distance(x, y, enemy.x, enemy.y);
      if (dist <= clickRadius) {
        return enemy;
      }
    }
  }
  return null;
}
