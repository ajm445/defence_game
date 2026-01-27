import { HeroUnit, RPGEnemy, EnemyBase } from '../../types/rpg';
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
  _enemies: RPGEnemy[],
  gameTime?: number
): HeroUpdateResult {
  let updatedHero = { ...hero };
  let enemyDamage: { targetId: string; damage: number } | undefined;
  let reachedTarget = false;

  // 시전 상태 체크 (gameTime이 제공된 경우)
  const isCasting = gameTime !== undefined && updatedHero.castingUntil && gameTime < updatedHero.castingUntil;

  // 사망 상태면 이동/공격 불가 - 위치 고정
  if (updatedHero.hp <= 0) {
    return {
      hero: {
        ...updatedHero,
        state: 'idle',
        moveDirection: undefined,
        targetPosition: undefined,
        attackTarget: undefined,
      },
      enemyDamage: undefined,
      reachedTarget: false,
    };
  }

  // 쿨다운 감소
  if (updatedHero.attackCooldown > 0) {
    updatedHero.attackCooldown -= deltaTime;
  }

  const config = updatedHero.config;
  const speed = config.speed || updatedHero.baseSpeed;

  // 시전 상태 만료 체크
  if (gameTime !== undefined && updatedHero.castingUntil && gameTime >= updatedHero.castingUntil) {
    updatedHero.castingUntil = undefined;
  }

  // 돌진 중인 경우 - 일반 이동보다 우선
  if (updatedHero.dashState) {
    const dash = updatedHero.dashState;
    const newProgress = dash.progress + deltaTime / dash.duration;

    if (newProgress >= 1) {
      // 돌진 완료
      updatedHero.x = dash.targetX;
      updatedHero.y = dash.targetY;
      updatedHero.dashState = undefined;
      updatedHero.state = 'idle';
      reachedTarget = true;
    } else {
      // 돌진 중 - easeOutQuad 이징 적용 (가속 후 감속)
      const easedProgress = 1 - (1 - newProgress) * (1 - newProgress);
      updatedHero.x = dash.startX + (dash.targetX - dash.startX) * easedProgress;
      updatedHero.y = dash.startY + (dash.targetY - dash.startY) * easedProgress;
      updatedHero.dashState = { ...dash, progress: newProgress };
      updatedHero.state = 'moving';
    }
  }
  // WASD 방향 이동 (새로운 방식) - 시전 중에는 이동 불가
  else if (!isCasting && updatedHero.moveDirection && (updatedHero.moveDirection.x !== 0 || updatedHero.moveDirection.y !== 0)) {
    const dir = updatedHero.moveDirection;
    const moveDistance = speed * deltaTime * 60;

    // 방향 정규화
    const dirLength = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
    const normalizedX = dir.x / dirLength;
    const normalizedY = dir.y / dirLength;

    updatedHero.x += normalizedX * moveDistance;
    updatedHero.y += normalizedY * moveDistance;
    updatedHero.state = 'moving';
  }
  // 이동 목표가 있는 경우 (구 방식 - 호환성 유지)
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
 * @deprecated 인게임 레벨업이 제거되었습니다.
 * 업그레이드는 goldSystem.ts의 canUpgrade를 사용하세요.
 */
export function canLevelUp(_hero: HeroUnit): boolean {
  return false;
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

/**
 * 영웅과 가장 가까운 적 기지 찾기 (파괴되지 않은 기지만)
 */
export function findNearestEnemyBase(
  hero: HeroUnit,
  enemyBases: EnemyBase[]
): EnemyBase | null {
  let nearest: EnemyBase | null = null;
  let minDist = Infinity;

  for (const base of enemyBases) {
    if (!base.destroyed && base.hp > 0) {
      const dist = distance(hero.x, hero.y, base.x, base.y);
      if (dist < minDist) {
        minDist = dist;
        nearest = base;
      }
    }
  }

  return nearest;
}
