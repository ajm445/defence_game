import { RPGEnemy, HeroUnit, Buff } from '../../types/rpg';
import { UnitType } from '../../types/unit';
import { ENEMY_AI_CONFIGS, RPG_CONFIG } from '../../constants/rpgConfig';
import { distance, clamp } from '../../utils/math';

export interface EnemyAIResult {
  enemy: RPGEnemy;
  heroDamage?: number;
  isAttacking: boolean;
}

/**
 * 적 AI 업데이트 - 개선된 버전
 */
export function updateEnemyAI(
  enemy: RPGEnemy,
  hero: HeroUnit,
  deltaTime: number,
  gameTime: number
): EnemyAIResult {
  // 기절 상태면 아무것도 하지 않음
  const isStunned = enemy.buffs?.some(b => b.type === 'stun' && b.duration > 0);
  if (isStunned) {
    return {
      enemy: {
        ...enemy,
        state: 'idle',
        buffs: updateBuffs(enemy.buffs, deltaTime),
      },
      isAttacking: false,
    };
  }

  const aiConfig = enemy.aiConfig;
  const heroX = hero.x;
  const heroY = hero.y;

  // 영웅과의 거리 계산
  const dist = distance(enemy.x, enemy.y, heroX, heroY);

  let updatedEnemy = { ...enemy };
  let heroDamage: number | undefined;
  let isAttacking = false;

  // 쿨다운 감소
  if (updatedEnemy.attackCooldown > 0) {
    updatedEnemy.attackCooldown -= deltaTime;
  }

  // AI 행동 결정
  if (dist <= aiConfig.detectionRange) {
    // 탐지 범위 내
    if (dist <= aiConfig.attackRange) {
      // 공격 사거리 내: 공격
      if (updatedEnemy.attackCooldown <= 0) {
        heroDamage = aiConfig.attackDamage;
        updatedEnemy.attackCooldown = aiConfig.attackSpeed;
        updatedEnemy.state = 'attacking';
        isAttacking = true;
      } else {
        // 공격 대기
        updatedEnemy.state = 'idle';
      }
    } else {
      // 사거리 밖: 플레이어 방향으로 이동
      const angle = Math.atan2(heroY - enemy.y, heroX - enemy.x);
      const moveX = Math.cos(angle) * aiConfig.moveSpeed * deltaTime * 60;
      const moveY = Math.sin(angle) * aiConfig.moveSpeed * deltaTime * 60;

      updatedEnemy.x = clamp(enemy.x + moveX, 30, RPG_CONFIG.MAP_WIDTH - 30);
      updatedEnemy.y = clamp(enemy.y + moveY, 30, RPG_CONFIG.MAP_HEIGHT - 30);
      updatedEnemy.state = 'moving';
    }
  } else {
    // 탐지 범위 밖: 랜덤 이동 또는 대기
    if (Math.random() < 0.01) {
      // 1% 확률로 랜덤 이동
      const randomAngle = Math.random() * Math.PI * 2;
      const wanderDist = 30;
      updatedEnemy.x = clamp(
        enemy.x + Math.cos(randomAngle) * wanderDist * deltaTime * 60,
        30,
        RPG_CONFIG.MAP_WIDTH - 30
      );
      updatedEnemy.y = clamp(
        enemy.y + Math.sin(randomAngle) * wanderDist * deltaTime * 60,
        30,
        RPG_CONFIG.MAP_HEIGHT - 30
      );
      updatedEnemy.state = 'moving';
    } else {
      updatedEnemy.state = 'idle';
    }
  }

  // 버프 업데이트
  updatedEnemy.buffs = updateBuffs(enemy.buffs, deltaTime);

  return {
    enemy: updatedEnemy,
    heroDamage,
    isAttacking,
  };
}

/**
 * 버프 시간 업데이트
 */
function updateBuffs(buffs: Buff[] | undefined, deltaTime: number): Buff[] {
  if (!buffs) return [];
  return buffs
    .map(b => ({ ...b, duration: b.duration - deltaTime }))
    .filter(b => b.duration > 0);
}

/**
 * 적에게 기절 적용
 */
export function applyStunToEnemy(
  enemy: RPGEnemy,
  stunDuration: number,
  gameTime: number
): RPGEnemy {
  const stunBuff: Buff = {
    type: 'stun',
    duration: stunDuration,
    startTime: gameTime,
  };

  const existingBuffs = enemy.buffs?.filter(b => b.type !== 'stun') || [];

  return {
    ...enemy,
    buffs: [...existingBuffs, stunBuff],
    state: 'idle',
  };
}

/**
 * 적 그룹 AI 업데이트
 */
export function updateAllEnemiesAI(
  enemies: RPGEnemy[],
  hero: HeroUnit,
  deltaTime: number,
  gameTime: number
): { updatedEnemies: RPGEnemy[]; totalHeroDamage: number } {
  let totalHeroDamage = 0;
  const updatedEnemies: RPGEnemy[] = [];

  for (const enemy of enemies) {
    if (enemy.hp <= 0) {
      updatedEnemies.push(enemy);
      continue;
    }

    const result = updateEnemyAI(enemy, hero, deltaTime, gameTime);
    updatedEnemies.push(result.enemy);

    if (result.heroDamage) {
      totalHeroDamage += result.heroDamage;
    }
  }

  return { updatedEnemies, totalHeroDamage };
}

/**
 * 영웅의 철벽 방어 버프로 데미지 감소 계산
 */
export function calculateDamageAfterReduction(
  damage: number,
  hero: HeroUnit
): number {
  const ironwallBuff = hero.buffs?.find(b => b.type === 'ironwall');
  if (ironwallBuff && ironwallBuff.damageReduction) {
    return Math.floor(damage * (1 - ironwallBuff.damageReduction));
  }
  return damage;
}

/**
 * 적이 플레이어 시야 내에 있는지 확인
 */
export function isEnemyInVision(
  enemy: RPGEnemy,
  heroX: number,
  heroY: number,
  visibilityRadius: number
): boolean {
  const dist = distance(enemy.x, enemy.y, heroX, heroY);
  return dist <= visibilityRadius;
}

/**
 * 가장 가까운 적 찾기
 */
export function findNearestEnemy(
  enemies: RPGEnemy[],
  x: number,
  y: number
): RPGEnemy | null {
  let nearest: RPGEnemy | null = null;
  let minDist = Infinity;

  for (const enemy of enemies) {
    if (enemy.hp <= 0) continue;
    const dist = distance(x, y, enemy.x, enemy.y);
    if (dist < minDist) {
      minDist = dist;
      nearest = enemy;
    }
  }

  return nearest;
}

/**
 * 범위 내 모든 적 찾기
 */
export function findEnemiesInRadius(
  enemies: RPGEnemy[],
  x: number,
  y: number,
  radius: number
): RPGEnemy[] {
  return enemies.filter(enemy => {
    if (enemy.hp <= 0) return false;
    return distance(x, y, enemy.x, enemy.y) <= radius;
  });
}
