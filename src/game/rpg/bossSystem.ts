import { RPGEnemy, EnemyBase, EnemyBaseId, EnemyAIConfig, RPGDifficulty } from '../../types/rpg';
import { GOLD_CONFIG, ENEMY_AI_CONFIGS, NEXUS_CONFIG, DIFFICULTY_CONFIGS } from '../../constants/rpgConfig';
import { CONFIG } from '../../constants/config';
import { generateId } from '../../utils/math';

// 보스 설정
const BOSS_CONFIG = {
  // 플레이어 수에 따른 보스 HP (고정값)
  HP_BY_PLAYER_COUNT: {
    1: 3500,   // 싱글플레이
    2: 4000,   // 2인
    3: 5500,   // 3인
    4: 7500,   // 4인
  } as Record<number, number>,
  // 플레이어 수에 따른 보스 공격력 (고정값)
  DAMAGE_BY_PLAYER_COUNT: {
    1: 100,    // 싱글플레이
    2: 110,    // 2인
    3: 130,    // 3인
    4: 160,    // 4인
  } as Record<number, number>,
  GOLD_REWARD: 200,       // 보스 처치 시 골드
  SIZE_MULTIPLIER: 1.5,   // 보스 크기
};

/**
 * 보스 2마리 생성 (각 파괴된 기지 위치에서 스폰)
 * @param playerCount 플레이어 수 (1~4)
 * @param difficulty 난이도 (easy/normal/hard/extreme)
 */
export function createBosses(
  destroyedBases: EnemyBase[],
  playerCount: number,
  difficulty: RPGDifficulty = 'easy'
): RPGEnemy[] {
  const bosses: RPGEnemy[] = [];

  for (const base of destroyedBases) {
    if (base.destroyed) {
      const boss = createBoss(base.id, base.x, base.y, playerCount, difficulty);
      bosses.push(boss);
    }
  }

  return bosses;
}

/**
 * 보스 유닛 생성
 * @param playerCount 플레이어 수 (1~4)
 * @param difficulty 난이도 (easy/normal/hard/extreme)
 */
export function createBoss(
  baseId: EnemyBaseId,
  spawnX: number,
  spawnY: number,
  playerCount: number,
  difficulty: RPGDifficulty = 'easy'
): RPGEnemy {
  const unitConfig = CONFIG.UNITS.boss;
  const baseAIConfig = ENEMY_AI_CONFIGS.boss;
  const difficultyConfig = DIFFICULTY_CONFIGS[difficulty];

  // 플레이어 수에 따른 보스 스탯 (고정값) + 난이도 배율 적용
  const clampedPlayerCount = Math.max(1, Math.min(4, playerCount));
  const baseBossHp = BOSS_CONFIG.HP_BY_PLAYER_COUNT[clampedPlayerCount] || BOSS_CONFIG.HP_BY_PLAYER_COUNT[1];
  const baseBossDamage = BOSS_CONFIG.DAMAGE_BY_PLAYER_COUNT[clampedPlayerCount] || BOSS_CONFIG.DAMAGE_BY_PLAYER_COUNT[1];

  // 난이도 배율 적용
  const bossHp = Math.floor(baseBossHp * difficultyConfig.bossHpMultiplier);
  const bossDamage = Math.floor(baseBossDamage * difficultyConfig.bossAttackMultiplier);

  // 골드 보상에도 난이도 보상 배율 적용
  const goldReward = Math.floor(BOSS_CONFIG.GOLD_REWARD * difficultyConfig.goldRewardMultiplier);

  // AI 설정
  const aiConfig: EnemyAIConfig = {
    detectionRange: baseAIConfig.detectionRange,
    attackRange: baseAIConfig.attackRange,
    moveSpeed: baseAIConfig.moveSpeed * 0.8, // 보스는 약간 느림
    attackDamage: bossDamage,
    attackSpeed: baseAIConfig.attackSpeed * 1.2, // 공격 속도 약간 느림
  };

  return {
    id: `boss_${baseId}_${generateId()}`,
    type: 'boss',
    config: {
      ...unitConfig,
      name: baseId === 'left' ? '왼쪽 보스' : '오른쪽 보스',
    },
    x: spawnX,
    y: spawnY,
    hp: bossHp,
    maxHp: bossHp,
    state: 'idle',
    attackCooldown: 0,
    team: 'enemy',
    goldReward,
    targetHero: false,
    aiConfig,
    buffs: [],
    fromBase: baseId,
    aggroOnHero: false, // 초기에는 넥서스를 향해 이동, 공격받으면 어그로
    damagedBy: [], // 데미지 관여자 추적 (멀티플레이 골드 분배용)
  };
}

/**
 * 모든 보스가 죽었는지 확인
 */
export function areAllBossesDead(enemies: RPGEnemy[]): boolean {
  const bosses = enemies.filter(e => e.type === 'boss');
  if (bosses.length === 0) return true;
  return bosses.every(b => b.hp <= 0);
}

/**
 * 보스 수 확인
 */
export function getBossCount(enemies: RPGEnemy[]): { total: number; alive: number } {
  const bosses = enemies.filter(e => e.type === 'boss');
  const aliveBosses = bosses.filter(b => b.hp > 0);
  return {
    total: bosses.length,
    alive: aliveBosses.length,
  };
}

/**
 * 보스가 존재하는지 확인
 */
export function hasBosses(enemies: RPGEnemy[]): boolean {
  return enemies.some(e => e.type === 'boss' && e.hp > 0);
}

/**
 * 보스 단계가 완료되었는지 확인 (두 기지 파괴 후 보스 2마리 처치)
 */
export function isBossPhaseComplete(
  enemies: RPGEnemy[],
  bossesSpawned: boolean
): boolean {
  if (!bossesSpawned) return false;
  return areAllBossesDead(enemies);
}
