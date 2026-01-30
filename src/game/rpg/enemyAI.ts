import { RPGEnemy, HeroUnit, Buff, Nexus } from '../../types/rpg';
import { UnitType } from '../../types/unit';
import { ENEMY_AI_CONFIGS, RPG_CONFIG, NEXUS_CONFIG } from '../../constants/rpgConfig';
import { distance, clamp } from '../../utils/math';

export interface EnemyAIResult {
  enemy: RPGEnemy;
  heroDamage?: number;
  nexusDamage?: number;
  isAttacking: boolean;
  isAttackingNexus: boolean;
}

// 어그로 지속 시간 (초)
const AGGRO_DURATION = 5;

/**
 * 적 AI 업데이트 - 넥서스 디펜스용 (싱글플레이어)
 *
 * 타겟 우선순위:
 * 1순위: 넥서스 (기본 목표)
 * 2순위: 공격 범위 내 플레이어 (지나가는 길에 있으면 공격)
 * 3순위: 피격 시 해당 플레이어 추적 (어그로)
 */
export function updateEnemyAINexus(
  enemy: RPGEnemy,
  hero: HeroUnit,
  nexus: Nexus | null,
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
      isAttackingNexus: false,
    };
  }

  // 보스가 스킬 시전 중이면 이동하지 않음
  if (enemy.type === 'boss' && enemy.currentCast) {
    return {
      enemy: {
        ...enemy,
        state: 'casting',
        buffs: updateBuffs(enemy.buffs, deltaTime),
      },
      isAttacking: false,
      isAttackingNexus: false,
    };
  }

  const aiConfig = enemy.aiConfig;
  const heroX = hero.x;
  const heroY = hero.y;

  // 영웅과의 거리 계산
  const distToHero = distance(enemy.x, enemy.y, heroX, heroY);

  // 넥서스와의 거리 계산
  const nexusX = nexus?.x || NEXUS_CONFIG.position.x;
  const nexusY = nexus?.y || NEXUS_CONFIG.position.y;
  const distToNexus = distance(enemy.x, enemy.y, nexusX, nexusY);

  let updatedEnemy = { ...enemy };
  let heroDamage: number | undefined;
  let nexusDamage: number | undefined;
  let isAttacking = false;
  let isAttackingNexus = false;

  // 쿨다운 감소
  if (updatedEnemy.attackCooldown > 0) {
    updatedEnemy.attackCooldown -= deltaTime;
  }

  // 어그로 만료 체크 - 영웅이 살아있을 때만 어그로 유효
  const hasAggro = hero.hp > 0 && updatedEnemy.aggroOnHero &&
    (!updatedEnemy.aggroExpireTime || gameTime < updatedEnemy.aggroExpireTime);

  // 어그로 만료 시 초기화
  if (updatedEnemy.aggroOnHero && updatedEnemy.aggroExpireTime && gameTime >= updatedEnemy.aggroExpireTime) {
    updatedEnemy.aggroOnHero = false;
    updatedEnemy.aggroExpireTime = undefined;
  }

  // 살아있는 영웅만 타겟 가능
  const canTargetHero = hero.hp > 0;

  // 범위 확인
  const isHeroInAttackRange = canTargetHero && distToHero <= aiConfig.attackRange;
  const isHeroInDetectionRange = canTargetHero && distToHero <= aiConfig.detectionRange;

  // AI 행동 결정
  // 어그로 또는 탐지 범위 내 플레이어가 있으면 추적/공격
  if (hasAggro || isHeroInDetectionRange) {
    if (isHeroInAttackRange) {
      // 공격 범위 내: 공격
      if (updatedEnemy.attackCooldown <= 0) {
        heroDamage = aiConfig.attackDamage;
        updatedEnemy.attackCooldown = aiConfig.attackSpeed;
        updatedEnemy.state = 'attacking';
        isAttacking = true;
      } else {
        // 공격 쿨다운 중: 플레이어 따라다니며 대기
        updatedEnemy.state = 'idle';
      }
    } else {
      // 공격 범위 밖: 플레이어 방향으로 추적
      const angle = Math.atan2(heroY - enemy.y, heroX - enemy.x);
      const moveX = Math.cos(angle) * aiConfig.moveSpeed * deltaTime * 60;
      const moveY = Math.sin(angle) * aiConfig.moveSpeed * deltaTime * 60;
      updatedEnemy.x = clamp(enemy.x + moveX, 30, RPG_CONFIG.MAP_WIDTH - 30);
      updatedEnemy.y = clamp(enemy.y + moveY, 30, RPG_CONFIG.MAP_HEIGHT - 30);
      updatedEnemy.state = 'moving';
    }
  } else {
    // 1순위: 넥서스로 이동/공격
    if (distToNexus <= aiConfig.attackRange) {
      // 넥서스 공격 범위 내: 공격
      if (updatedEnemy.attackCooldown <= 0) {
        nexusDamage = aiConfig.attackDamage;
        updatedEnemy.attackCooldown = aiConfig.attackSpeed;
        updatedEnemy.state = 'attacking';
        isAttackingNexus = true;
      } else {
        updatedEnemy.state = 'idle';
      }
    } else {
      // 넥서스 방향으로 이동
      const angle = Math.atan2(nexusY - enemy.y, nexusX - enemy.x);
      const moveX = Math.cos(angle) * aiConfig.moveSpeed * deltaTime * 60;
      const moveY = Math.sin(angle) * aiConfig.moveSpeed * deltaTime * 60;
      updatedEnemy.x = clamp(enemy.x + moveX, 30, RPG_CONFIG.MAP_WIDTH - 30);
      updatedEnemy.y = clamp(enemy.y + moveY, 30, RPG_CONFIG.MAP_HEIGHT - 30);
      updatedEnemy.state = 'moving';
    }
  }

  // 버프 업데이트
  updatedEnemy.buffs = updateBuffs(enemy.buffs, deltaTime);

  return {
    enemy: updatedEnemy,
    heroDamage,
    nexusDamage,
    isAttacking,
    isAttackingNexus,
  };
}

/**
 * 적에게 어그로 설정 (영웅이 공격했을 때 호출)
 */
export function setEnemyAggro(enemy: RPGEnemy, gameTime: number): RPGEnemy {
  return {
    ...enemy,
    aggroOnHero: true,
    aggroExpireTime: gameTime + AGGRO_DURATION,
  };
}

/**
 * 적 AI 업데이트 - 기존 버전 (영웅만 타겟)
 */
export function updateEnemyAI(
  enemy: RPGEnemy,
  hero: HeroUnit,
  deltaTime: number,
  _gameTime: number
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
      isAttackingNexus: false,
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

  // AI 행동 결정 - 항상 플레이어를 향해 추적
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
    // 사거리 밖: 플레이어 방향으로 이동 (항상 추적)
    const angle = Math.atan2(heroY - enemy.y, heroX - enemy.x);
    const moveX = Math.cos(angle) * aiConfig.moveSpeed * deltaTime * 60;
    const moveY = Math.sin(angle) * aiConfig.moveSpeed * deltaTime * 60;

    updatedEnemy.x = clamp(enemy.x + moveX, 30, RPG_CONFIG.MAP_WIDTH - 30);
    updatedEnemy.y = clamp(enemy.y + moveY, 30, RPG_CONFIG.MAP_HEIGHT - 30);
    updatedEnemy.state = 'moving';
  }

  // 버프 업데이트
  updatedEnemy.buffs = updateBuffs(enemy.buffs, deltaTime);

  return {
    enemy: updatedEnemy,
    heroDamage,
    isAttacking,
    isAttackingNexus: false,
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
 * 적 그룹 AI 업데이트 - 넥서스 디펜스용
 */
export function updateAllEnemiesAINexus(
  enemies: RPGEnemy[],
  hero: HeroUnit,
  nexus: Nexus | null,
  deltaTime: number,
  gameTime: number
): { updatedEnemies: RPGEnemy[]; totalHeroDamage: number; totalNexusDamage: number } {
  let totalHeroDamage = 0;
  let totalNexusDamage = 0;
  const updatedEnemies: RPGEnemy[] = [];

  for (const enemy of enemies) {
    if (enemy.hp <= 0) {
      updatedEnemies.push(enemy);
      continue;
    }

    const result = updateEnemyAINexus(enemy, hero, nexus, deltaTime, gameTime);
    updatedEnemies.push(result.enemy);

    if (result.heroDamage) {
      totalHeroDamage += result.heroDamage;
    }
    if (result.nexusDamage) {
      totalNexusDamage += result.nexusDamage;
    }
  }

  return { updatedEnemies, totalHeroDamage, totalNexusDamage };
}

/**
 * 적 그룹 AI 업데이트 - 기존 버전
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
 * 영웅의 버프로 데미지 감소 계산
 * - 무적 버프: 데미지 0
 * - 철벽 방어 버프: 데미지 감소율 적용
 */
export function calculateDamageAfterReduction(
  damage: number,
  hero: HeroUnit
): number {
  // 무적 버프 체크 (돌진 중) - duration > 0 인 경우만 유효
  const invincibleBuff = hero.buffs?.find(b => b.type === 'invincible' && b.duration > 0);
  if (invincibleBuff) {
    return 0;
  }

  // 철벽 방어 버프 체크 - duration > 0 인 경우만 유효
  const ironwallBuff = hero.buffs?.find(b => b.type === 'ironwall' && b.duration > 0);
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

/**
 * 멀티플레이어용 적 AI 결과
 */
export interface MultiplayerEnemyAIResult {
  updatedEnemies: RPGEnemy[];
  heroDamages: Map<string, number>;  // heroId -> damage
  totalNexusDamage: number;
}

/**
 * 클래스별 타겟 우선순위 (높을수록 우선)
 * 근접 클래스 우선: 기사 > 전사 > 기타
 */
function getClassTargetPriority(heroClass: string | undefined): number {
  switch (heroClass) {
    case 'knight': return 3;  // 기사: 최우선 (탱커)
    case 'warrior': return 2; // 전사: 높음 (근접 딜러)
    default: return 1;        // 궁수/마법사: 기본 (원거리)
  }
}

/**
 * 적 그룹 AI 업데이트 - 멀티플레이어용
 *
 * 타겟 우선순위 (싱글플레이와 동일):
 * 1순위: 넥서스 (기본 목표)
 * 2순위: 공격 범위 내 플레이어 (근접 클래스 우선, 없으면 원거리도 타겟)
 * 3순위: 피격 시 해당 플레이어 추적 (어그로)
 */
export function updateAllEnemiesAINexusMultiplayer(
  enemies: RPGEnemy[],
  allHeroes: HeroUnit[],  // 모든 영웅 (호스트 + 다른 플레이어)
  nexus: Nexus | null,
  deltaTime: number,
  gameTime: number
): MultiplayerEnemyAIResult {
  const heroDamages = new Map<string, number>();
  let totalNexusDamage = 0;
  const updatedEnemies: RPGEnemy[] = [];

  // 살아있는 영웅만 필터링
  const aliveHeroes = allHeroes.filter(h => h.hp > 0);

  const nexusX = nexus?.x ?? NEXUS_CONFIG.position.x;
  const nexusY = nexus?.y ?? NEXUS_CONFIG.position.y;

  for (const enemy of enemies) {
    if (enemy.hp <= 0) {
      updatedEnemies.push(enemy);
      continue;
    }

    const result = updateEnemyAIMultiplayer(
      enemy,
      aliveHeroes,
      nexusX,
      nexusY,
      deltaTime,
      gameTime
    );

    updatedEnemies.push(result.enemy);

    if (result.heroDamage && result.targetHeroId) {
      const currentDamage = heroDamages.get(result.targetHeroId) || 0;
      heroDamages.set(result.targetHeroId, currentDamage + result.heroDamage);
    }

    if (result.nexusDamage) {
      totalNexusDamage += result.nexusDamage;
    }
  }

  return { updatedEnemies, heroDamages, totalNexusDamage };
}

/**
 * 단일 적 AI 업데이트 - 멀티플레이어용
 */
interface MultiplayerSingleEnemyResult {
  enemy: RPGEnemy;
  heroDamage?: number;
  targetHeroId?: string;
  nexusDamage?: number;
}

function updateEnemyAIMultiplayer(
  enemy: RPGEnemy,
  aliveHeroes: HeroUnit[],
  nexusX: number,
  nexusY: number,
  deltaTime: number,
  gameTime: number
): MultiplayerSingleEnemyResult {
  // 기절 상태면 아무것도 하지 않음
  const isStunned = enemy.buffs?.some(b => b.type === 'stun' && b.duration > 0);
  if (isStunned) {
    return {
      enemy: {
        ...enemy,
        state: 'idle',
        buffs: updateBuffs(enemy.buffs, deltaTime),
      },
    };
  }

  // 보스가 스킬 시전 중이면 이동하지 않음
  if (enemy.type === 'boss' && enemy.currentCast) {
    return {
      enemy: {
        ...enemy,
        state: 'casting',
        buffs: updateBuffs(enemy.buffs, deltaTime),
      },
    };
  }

  const aiConfig = enemy.aiConfig;
  const distToNexus = distance(enemy.x, enemy.y, nexusX, nexusY);

  let updatedEnemy = { ...enemy };
  let heroDamage: number | undefined;
  let targetHeroId: string | undefined;
  let nexusDamage: number | undefined;

  // 쿨다운 감소
  if (updatedEnemy.attackCooldown > 0) {
    updatedEnemy.attackCooldown -= deltaTime;
  }

  // 어그로 만료 체크
  if (updatedEnemy.aggroOnHero && updatedEnemy.aggroExpireTime && gameTime >= updatedEnemy.aggroExpireTime) {
    updatedEnemy.aggroOnHero = false;
    updatedEnemy.targetHeroId = undefined;
    updatedEnemy.aggroExpireTime = undefined;
  }

  // 어그로 대상 확인
  let aggroHero: HeroUnit | null = null;
  if (updatedEnemy.aggroOnHero && updatedEnemy.targetHeroId) {
    aggroHero = aliveHeroes.find(h => h.id === updatedEnemy.targetHeroId) || null;
    if (!aggroHero || (updatedEnemy.aggroExpireTime && gameTime >= updatedEnemy.aggroExpireTime)) {
      aggroHero = null;
      updatedEnemy.aggroOnHero = false;
      updatedEnemy.targetHeroId = undefined;
    }
  }

  // 탐지 범위 내 플레이어 찾기 (근접 클래스 우선)
  let heroInDetectionRange: HeroUnit | null = null;
  let heroInDetectionRangeDist = Infinity;
  let heroInDetectionRangePriority = 0;

  for (const hero of aliveHeroes) {
    const dist = distance(enemy.x, enemy.y, hero.x, hero.y);
    if (dist <= aiConfig.detectionRange) {
      const priority = getClassTargetPriority(hero.heroClass);
      // 우선순위가 더 높거나, 같은 우선순위에서 더 가까우면 타겟 변경
      if (priority > heroInDetectionRangePriority ||
          (priority === heroInDetectionRangePriority && dist < heroInDetectionRangeDist)) {
        heroInDetectionRange = hero;
        heroInDetectionRangeDist = dist;
        heroInDetectionRangePriority = priority;
      }
    }
  }

  // 타겟 결정: 어그로 대상 > 탐지 범위 내 플레이어
  const targetHero = aggroHero || heroInDetectionRange;
  const distToTargetHero = targetHero ? distance(enemy.x, enemy.y, targetHero.x, targetHero.y) : Infinity;

  // AI 행동 결정
  if (targetHero) {
    // 탐지 범위 내 플레이어 또는 어그로 대상 추적/공격
    if (distToTargetHero <= aiConfig.attackRange) {
      // 공격 범위 내: 공격
      if (updatedEnemy.attackCooldown <= 0) {
        heroDamage = aiConfig.attackDamage;
        targetHeroId = targetHero.id;
        updatedEnemy.attackCooldown = aiConfig.attackSpeed;
        updatedEnemy.state = 'attacking';
      } else {
        // 공격 쿨다운 중: 대기
        updatedEnemy.state = 'idle';
      }
    } else {
      // 공격 범위 밖: 플레이어 방향으로 추적
      const angle = Math.atan2(targetHero.y - enemy.y, targetHero.x - enemy.x);
      const moveX = Math.cos(angle) * aiConfig.moveSpeed * deltaTime * 60;
      const moveY = Math.sin(angle) * aiConfig.moveSpeed * deltaTime * 60;
      updatedEnemy.x = clamp(enemy.x + moveX, 30, RPG_CONFIG.MAP_WIDTH - 30);
      updatedEnemy.y = clamp(enemy.y + moveY, 30, RPG_CONFIG.MAP_HEIGHT - 30);
      updatedEnemy.state = 'moving';
    }
  } else {
    // 1순위: 넥서스로 이동/공격
    if (distToNexus <= aiConfig.attackRange) {
      // 넥서스 공격 범위 내: 공격
      if (updatedEnemy.attackCooldown <= 0) {
        nexusDamage = aiConfig.attackDamage;
        updatedEnemy.attackCooldown = aiConfig.attackSpeed;
        updatedEnemy.state = 'attacking';
      } else {
        updatedEnemy.state = 'idle';
      }
    } else {
      // 넥서스 방향으로 이동
      const angle = Math.atan2(nexusY - enemy.y, nexusX - enemy.x);
      const moveX = Math.cos(angle) * aiConfig.moveSpeed * deltaTime * 60;
      const moveY = Math.sin(angle) * aiConfig.moveSpeed * deltaTime * 60;
      updatedEnemy.x = clamp(enemy.x + moveX, 30, RPG_CONFIG.MAP_WIDTH - 30);
      updatedEnemy.y = clamp(enemy.y + moveY, 30, RPG_CONFIG.MAP_HEIGHT - 30);
      updatedEnemy.state = 'moving';
    }
  }

  // 버프 업데이트
  updatedEnemy.buffs = updateBuffs(enemy.buffs, deltaTime);

  return {
    enemy: updatedEnemy,
    heroDamage,
    targetHeroId,
    nexusDamage,
  };
}

