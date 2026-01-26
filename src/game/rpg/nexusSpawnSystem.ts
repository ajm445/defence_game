import { RPGEnemy, EnemyAIConfig, EnemyBase, EnemyBaseId, RPGDifficulty, DifficultyConfig } from '../../types/rpg';
import { UnitType } from '../../types/unit';
import { SPAWN_CONFIG, GOLD_CONFIG, ENEMY_AI_CONFIGS, NEXUS_CONFIG, DIFFICULTY_CONFIGS, RPG_ENEMY_CONFIGS, COOP_CONFIG } from '../../constants/rpgConfig';
import { generateId } from '../../utils/math';

/**
 * 스폰 설정 가져오기 (게임 시간, 난이도, 플레이어 수 기반)
 * @param playerCount 멀티플레이어 인원 수 (1=싱글, 2-4=멀티)
 */
export function getSpawnConfig(gameTime: number, difficulty: RPGDifficulty = 'easy', playerCount: number = 1): {
  spawnInterval: number;
  statMultiplier: number;
  attackMultiplier: number;
  goldMultiplier: number;
  expMultiplier: number;
  enemyTypes: { type: UnitType; weight: number }[];
  difficultyConfig: DifficultyConfig;
} {
  const minutes = gameTime / 60;
  const difficultyConfig = DIFFICULTY_CONFIGS[difficulty];

  // 플레이어 수에 따른 스케일링 (멀티플레이어)
  const clampedPlayerCount = Math.max(1, Math.min(4, playerCount));
  const playerCountScaling = COOP_CONFIG.DIFFICULTY_SCALING[clampedPlayerCount] ?? 1.0;

  // 스폰 간격: 시간이 지날수록 빨라짐 (최소 1.5초) + 난이도 배율
  const baseSpawnInterval = Math.max(
    SPAWN_CONFIG.MIN_INTERVAL,
    SPAWN_CONFIG.BASE_INTERVAL - minutes * SPAWN_CONFIG.INTERVAL_DECREASE_PER_MINUTE
  );
  const spawnInterval = baseSpawnInterval * difficultyConfig.spawnIntervalMultiplier;

  // 스탯 배율: 난이도 HP 배율 × 플레이어 수 스케일링
  const statMultiplier = difficultyConfig.enemyHpMultiplier * playerCountScaling;

  // 공격력 배율: 난이도 공격력 배율 (플레이어 수 스케일링은 HP에만 적용)
  const attackMultiplier = difficultyConfig.enemyAttackMultiplier;

  // 골드 배율: 난이도에 따른 보상 배율
  const goldMultiplier = difficultyConfig.goldRewardMultiplier;

  // 경험치 배율: 난이도에 따른 경험치 배율
  const expMultiplier = difficultyConfig.expRewardMultiplier;

  // 적 구성: 시간에 따라 다양해짐
  const enemyTypes = SPAWN_CONFIG.getEnemyTypesForTime(minutes);

  return {
    spawnInterval,
    statMultiplier,
    attackMultiplier,
    goldMultiplier,
    expMultiplier,
    enemyTypes,
    difficultyConfig,
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
 * @param playerCount 멀티플레이어 인원 수 (1=싱글, 2-4=멀티)
 */
export function createEnemyFromBase(
  base: EnemyBase,
  gameTime: number,
  difficulty: RPGDifficulty = 'easy',
  playerCount: number = 1
): RPGEnemy | null {
  if (base.destroyed) return null;

  const config = getSpawnConfig(gameTime, difficulty, playerCount);
  const enemyType = selectRandomEnemyType(config.enemyTypes);

  return createNexusEnemy(
    enemyType,
    base.id,
    base.x,
    base.y,
    config.statMultiplier,
    config.attackMultiplier,
    config.goldMultiplier
  );
}

/**
 * 넥서스 디펜스용 적 유닛 생성
 */
export function createNexusEnemy(
  type: UnitType,
  fromBase: EnemyBaseId,
  spawnX: number,
  spawnY: number,
  statMultiplier: number,
  attackMultiplier: number = 1.0,
  goldMultiplier: number = 1.0
): RPGEnemy {
  // RPG 전용 적 설정 사용 (없으면 기본값)
  const rpgEnemyConfig = RPG_ENEMY_CONFIGS[type] || {
    name: type,
    hp: 100,
    attack: 10,
    attackSpeed: 1.0,
    speed: 2.0,
  };

  // 골드 보상 (난이도 보상 배율 적용)
  const baseGoldReward = GOLD_CONFIG.REWARDS[type] || 5;
  const goldReward = Math.floor(baseGoldReward * goldMultiplier);

  // AI 설정 (난이도 공격력 배율 적용)
  const baseAIConfig = ENEMY_AI_CONFIGS[type];
  const aiConfig: EnemyAIConfig = {
    detectionRange: baseAIConfig.detectionRange,
    attackRange: baseAIConfig.attackRange,
    moveSpeed: rpgEnemyConfig.speed,
    attackDamage: Math.floor(rpgEnemyConfig.attack * attackMultiplier),
    attackSpeed: rpgEnemyConfig.attackSpeed,
  };

  // 스폰 위치에 약간의 랜덤 오프셋 추가
  const offsetX = (Math.random() - 0.5) * 60;
  const offsetY = (Math.random() - 0.5) * 60;

  // RPG용 유닛 config 생성
  const unitConfig = {
    name: rpgEnemyConfig.name,
    cost: {},
    hp: rpgEnemyConfig.hp,
    attack: rpgEnemyConfig.attack,
    attackSpeed: rpgEnemyConfig.attackSpeed,
    speed: rpgEnemyConfig.speed,
    range: baseAIConfig.attackRange,
    type: 'combat' as const,
  };

  return {
    id: generateId(),
    type,
    config: unitConfig,
    x: spawnX + offsetX,
    y: spawnY + offsetY,
    hp: Math.floor(rpgEnemyConfig.hp * statMultiplier),
    maxHp: Math.floor(rpgEnemyConfig.hp * statMultiplier),
    state: 'moving',
    attackCooldown: 0,
    team: 'enemy',
    goldReward,
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
 * @param playerCount 멀티플레이어 인원 수 (1=싱글, 2-4=멀티)
 */
export function shouldSpawnEnemy(
  gameTime: number,
  lastSpawnTime: number,
  bases: EnemyBase[],
  difficulty: RPGDifficulty = 'easy',
  playerCount: number = 1
): SpawnResult {
  const config = getSpawnConfig(gameTime, difficulty, playerCount);
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
  const { difficultyConfig } = config;

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

  // 난이도별 스폰 수 배율 적용
  const finalSpawnCount = Math.max(1, Math.round(baseSpawnCount * difficultyConfig.spawnCountMultiplier));

  // 각 활성 기지에서 스폰
  const spawns = activeBases.map(base => ({
    baseId: base.id,
    count: finalSpawnCount,
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
