import { RPGEnemy, EnemyAIConfig, EnemyBase, EnemyBaseId } from '../../types/rpg';
import { UnitType } from '../../types/unit';
import { CONFIG } from '../../constants/config';
import { SPAWN_CONFIG, GOLD_CONFIG, ENEMY_AI_CONFIGS, NEXUS_CONFIG } from '../../constants/rpgConfig';
import { generateId } from '../../utils/math';

/**
 * 스폰 설정 가져오기 (게임 시간 기반)
 */
export function getSpawnConfig(gameTime: number): {
  spawnInterval: number;
  statMultiplier: number;
  enemyTypes: { type: UnitType; weight: number }[];
} {
  const minutes = gameTime / 60;

  // 스폰 간격: 시간이 지날수록 빨라짐 (최소 1.5초)
  const spawnInterval = Math.max(
    SPAWN_CONFIG.MIN_INTERVAL,
    SPAWN_CONFIG.BASE_INTERVAL - minutes * SPAWN_CONFIG.INTERVAL_DECREASE_PER_MINUTE
  );

  // 스탯 배율: 시간이 지날수록 강해짐
  const statMultiplier = 1 + minutes * SPAWN_CONFIG.STAT_MULTIPLIER_PER_MINUTE;

  // 적 구성: 시간에 따라 다양해짐
  const enemyTypes = SPAWN_CONFIG.getEnemyTypesForTime(minutes);

  return {
    spawnInterval,
    statMultiplier,
    enemyTypes,
  };
}

/**
 * 가중치 기반 랜덤 적 타입 선택
 */
export function selectRandomEnemyType(
  enemyTypes: { type: UnitType; weight: number }[]
): UnitType {
  const totalWeight = enemyTypes.reduce((sum, e) => sum + e.weight, 0);
  let random = Math.random() * totalWeight;

  for (const enemy of enemyTypes) {
    random -= enemy.weight;
    if (random <= 0) {
      return enemy.type;
    }
  }

  return enemyTypes[0].type;
}

/**
 * 기지에서 적 생성
 */
export function createEnemyFromBase(
  base: EnemyBase,
  gameTime: number
): RPGEnemy | null {
  if (base.destroyed) return null;

  const config = getSpawnConfig(gameTime);
  const enemyType = selectRandomEnemyType(config.enemyTypes);

  return createNexusEnemy(enemyType, base.id, base.x, base.y, config.statMultiplier);
}

/**
 * 넥서스 디펜스용 적 유닛 생성
 */
export function createNexusEnemy(
  type: UnitType,
  fromBase: EnemyBaseId,
  spawnX: number,
  spawnY: number,
  statMultiplier: number
): RPGEnemy {
  const unitConfig = CONFIG.UNITS[type];

  // 골드 보상
  const goldReward = GOLD_CONFIG.REWARDS[type] || 5;

  // AI 설정
  const baseAIConfig = ENEMY_AI_CONFIGS[type];
  const aiConfig: EnemyAIConfig = {
    detectionRange: baseAIConfig.detectionRange,
    attackRange: baseAIConfig.attackRange,
    moveSpeed: baseAIConfig.moveSpeed,
    attackDamage: Math.floor(baseAIConfig.attackDamage * statMultiplier),
    attackSpeed: baseAIConfig.attackSpeed,
  };

  // 스폰 위치에 약간의 랜덤 오프셋 추가
  const offsetX = (Math.random() - 0.5) * 60;
  const offsetY = (Math.random() - 0.5) * 60;

  return {
    id: generateId(),
    type,
    config: { ...unitConfig },
    x: spawnX + offsetX,
    y: spawnY + offsetY,
    hp: Math.floor(unitConfig.hp * statMultiplier),
    maxHp: Math.floor(unitConfig.hp * statMultiplier),
    state: 'moving',
    attackCooldown: 0,
    team: 'enemy',
    goldReward: Math.floor(goldReward * statMultiplier),
    targetHero: false,
    aiConfig,
    buffs: [],
    fromBase,
    aggroOnHero: false, // 초기에는 넥서스를 향해 이동, 공격받으면 어그로
  };
}

/**
 * 스폰 결과 타입
 */
export interface SpawnResult {
  shouldSpawn: boolean;
  spawns: { baseId: EnemyBaseId; count: number }[];
}

/**
 * 양쪽 기지에서 동시에 스폰
 * 시간이 지날수록 더 많은 적이 스폰됨
 */
export function shouldSpawnEnemy(
  gameTime: number,
  lastSpawnTime: number,
  bases: EnemyBase[]
): SpawnResult {
  const config = getSpawnConfig(gameTime);
  const timeSinceLastSpawn = gameTime - lastSpawnTime;

  if (timeSinceLastSpawn < config.spawnInterval) {
    return { shouldSpawn: false, spawns: [] };
  }

  // 파괴되지 않은 기지 목록
  const activeBases = bases.filter(b => !b.destroyed);
  if (activeBases.length === 0) {
    return { shouldSpawn: false, spawns: [] };
  }

  const minutes = gameTime / 60;

  // 시간에 따른 스폰 수 (기본 1, 시간이 지날수록 증가)
  // 0-2분: 1마리, 2-4분: 1-2마리, 4-6분: 2마리, 6분+: 2-3마리
  let baseSpawnCount = 1;
  if (minutes >= 6) {
    baseSpawnCount = Math.random() < 0.5 ? 2 : 3;
  } else if (minutes >= 4) {
    baseSpawnCount = 2;
  } else if (minutes >= 2) {
    baseSpawnCount = Math.random() < 0.5 ? 1 : 2;
  }

  // 각 활성 기지에서 스폰
  const spawns = activeBases.map(base => ({
    baseId: base.id,
    count: baseSpawnCount,
  }));

  return { shouldSpawn: true, spawns };
}

/**
 * 넥서스 방향으로의 이동 벡터 계산
 */
export function getDirectionToNexus(enemyX: number, enemyY: number): { x: number; y: number } {
  const dx = NEXUS_CONFIG.position.x - enemyX;
  const dy = NEXUS_CONFIG.position.y - enemyY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist === 0) return { x: 0, y: 0 };

  return {
    x: dx / dist,
    y: dy / dist,
  };
}

/**
 * 적과 넥서스 사이의 거리 계산
 */
export function getDistanceToNexus(enemyX: number, enemyY: number): number {
  const dx = NEXUS_CONFIG.position.x - enemyX;
  const dy = NEXUS_CONFIG.position.y - enemyY;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 적과 기지 사이의 거리 계산
 */
export function getDistanceToBase(enemyX: number, enemyY: number, base: EnemyBase): number {
  const dx = base.x - enemyX;
  const dy = base.y - enemyY;
  return Math.sqrt(dx * dx + dy * dy);
}
