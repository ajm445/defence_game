import { RPGEnemy, EnemyBase, EnemyAIConfig } from '../../types/rpg';
import { GOLD_CONFIG, ENEMY_AI_CONFIGS, NEXUS_CONFIG } from '../../constants/rpgConfig';
import { CONFIG } from '../../constants/config';
import { generateId } from '../../utils/math';

// 보스 설정
const BOSS_CONFIG = {
  HP_MULTIPLIER: 5,       // 기본 보스 HP * 5
  DAMAGE_MULTIPLIER: 2,   // 기본 보스 데미지 * 2
  GOLD_REWARD: 200,       // 보스 처치 시 골드
  SIZE_MULTIPLIER: 1.5,   // 보스 크기
};

/**
 * 보스 2마리 생성 (각 파괴된 기지 위치에서 스폰)
 */
export function createBosses(
  destroyedBases: EnemyBase[],
  gameTime: number
): RPGEnemy[] {
  const bosses: RPGEnemy[] = [];

  for (const base of destroyedBases) {
    if (base.destroyed) {
      const boss = createBoss(base.id, base.x, base.y, gameTime);
      bosses.push(boss);
    }
  }

  return bosses;
}

/**
 * 보스 유닛 생성
 */
export function createBoss(
  baseId: 'left' | 'right',
  spawnX: number,
  spawnY: number,
  gameTime: number
): RPGEnemy {
  const unitConfig = CONFIG.UNITS.boss;
  const baseAIConfig = ENEMY_AI_CONFIGS.boss;

  // 시간에 따른 스탯 증가
  const minutes = gameTime / 60;
  const timeMultiplier = 1 + minutes * 0.1;

  // AI 설정
  const aiConfig: EnemyAIConfig = {
    detectionRange: baseAIConfig.detectionRange,
    attackRange: baseAIConfig.attackRange,
    moveSpeed: baseAIConfig.moveSpeed * 0.8, // 보스는 약간 느림
    attackDamage: Math.floor(baseAIConfig.attackDamage * BOSS_CONFIG.DAMAGE_MULTIPLIER * timeMultiplier),
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
    hp: Math.floor(unitConfig.hp * BOSS_CONFIG.HP_MULTIPLIER * timeMultiplier),
    maxHp: Math.floor(unitConfig.hp * BOSS_CONFIG.HP_MULTIPLIER * timeMultiplier),
    state: 'idle',
    attackCooldown: 0,
    team: 'enemy',
    goldReward: BOSS_CONFIG.GOLD_REWARD,
    targetHero: false,
    aiConfig,
    buffs: [],
    fromBase: baseId,
    aggroOnHero: false, // 초기에는 넥서스를 향해 이동, 공격받으면 어그로
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
