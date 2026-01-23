import { RPGEnemy, EnemyAIConfig } from '../../types/rpg';
import { UnitType } from '../../types/unit';
import { CONFIG } from '../../constants/config';
import {
  RPG_CONFIG,
  GOLD_CONFIG,
  generateWaveConfig,
  getWaveStatMultiplier,
  getRandomSpawnPosition,
  ENEMY_AI_CONFIGS,
} from '../../constants/rpgConfig';
import { generateId } from '../../utils/math';

/**
 * 웨이브 적 생성
 */
export function createWaveEnemies(waveNumber: number): { type: UnitType; delay: number }[] {
  const waveConfig = generateWaveConfig(waveNumber);
  const enemies: { type: UnitType; delay: number }[] = [];

  let totalDelay = 0;

  for (const enemyGroup of waveConfig.enemies) {
    for (let i = 0; i < enemyGroup.count; i++) {
      enemies.push({
        type: enemyGroup.type,
        delay: totalDelay,
      });
      totalDelay += waveConfig.spawnInterval;
    }
  }

  return enemies;
}

/**
 * 적 유닛 생성
 * @deprecated 넥서스 디펜스 모드에서는 nexusSpawnSystem.ts의 createEnemyFromBase를 사용하세요.
 */
export function createRPGEnemy(type: UnitType, waveNumber: number): RPGEnemy {
  const unitConfig = CONFIG.UNITS[type];
  const statMultiplier = getWaveStatMultiplier(waveNumber);
  const spawnPos = getRandomSpawnPosition();

  // 골드 보상
  const goldReward = GOLD_CONFIG.REWARDS[type] || 5;

  // AI 설정 가져오기 (웨이브 배율 적용)
  const baseAIConfig = ENEMY_AI_CONFIGS[type];
  const aiConfig: EnemyAIConfig = {
    detectionRange: baseAIConfig.detectionRange,
    attackRange: baseAIConfig.attackRange,
    moveSpeed: baseAIConfig.moveSpeed * (1 + (waveNumber - 1) * 0.02), // 웨이브마다 2% 빨라짐
    attackDamage: Math.floor(baseAIConfig.attackDamage * statMultiplier),
    attackSpeed: Math.max(0.5, baseAIConfig.attackSpeed - (waveNumber - 1) * 0.02), // 웨이브마다 조금씩 빨라짐
  };

  return {
    id: generateId(),
    type,
    config: { ...unitConfig },
    x: spawnPos.x,
    y: spawnPos.y,
    hp: Math.floor(unitConfig.hp * statMultiplier),
    maxHp: Math.floor(unitConfig.hp * statMultiplier),
    state: 'moving',
    attackCooldown: 0,
    team: 'enemy',
    goldReward: Math.floor(goldReward * statMultiplier),
    targetHero: true,
    aiConfig,
    buffs: [],
    aggroOnHero: false,
  };
}

/**
 * 적 유닛 업데이트 (영웅을 향해 이동 및 공격)
 */
export interface EnemyUpdateResult {
  enemy: RPGEnemy;
  heroDamage?: number;
}

export function updateRPGEnemy(
  enemy: RPGEnemy,
  heroX: number,
  heroY: number,
  deltaTime: number
): EnemyUpdateResult {
  const config = enemy.config;
  const speed = config.speed || 1.5;
  const range = config.range || 30;
  const attack = config.attack || 10;
  const attackSpeed = config.attackSpeed || 1;

  let updatedEnemy = { ...enemy };
  let heroDamage: number | undefined;

  // 쿨다운 감소
  if (updatedEnemy.attackCooldown > 0) {
    updatedEnemy.attackCooldown -= deltaTime;
  }

  // 영웅과의 거리 계산
  const dx = heroX - enemy.x;
  const dy = heroY - enemy.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist <= range) {
    // 사거리 내: 공격
    if (updatedEnemy.attackCooldown <= 0) {
      heroDamage = attack;
      updatedEnemy.attackCooldown = attackSpeed;
      updatedEnemy.state = 'attacking';
    }
  } else {
    // 사거리 밖: 영웅을 향해 이동
    const angle = Math.atan2(dy, dx);
    updatedEnemy.x += Math.cos(angle) * speed * deltaTime * 60;
    updatedEnemy.y += Math.sin(angle) * speed * deltaTime * 60;
    updatedEnemy.state = 'moving';
  }

  return { enemy: updatedEnemy, heroDamage };
}

/**
 * 웨이브 클리어 확인
 */
export function isWaveCleared(
  enemies: RPGEnemy[],
  spawnQueueEmpty: boolean
): boolean {
  return spawnQueueEmpty && enemies.filter((e) => e.hp > 0).length === 0;
}

/**
 * 다음 웨이브까지 대기 시간 (초)
 */
export function getWaveBreakDuration(_waveNumber: number): number {
  // 대기 없이 바로 다음 웨이브 시작
  return 0;
}

/**
 * 웨이브 정보 텍스트 생성
 */
export function getWaveDescription(waveNumber: number): string {
  const waveConfig = generateWaveConfig(waveNumber);

  if (waveConfig.bossWave) {
    return '⚠️ 보스 웨이브!';
  }

  const enemyList = waveConfig.enemies
    .map((e) => `${CONFIG.UNITS[e.type].name} x${e.count}`)
    .join(', ');

  return `웨이브 ${waveNumber}: ${enemyList}`;
}
