/**
 * RPG 서버 적 시스템
 * - 적 스폰
 * - 적 AI (이동, 공격)
 * - 적 사망 처리
 */

import type { RPGEnemy, EnemyBaseId, RPGDifficulty, BossSkill, BossSkillType } from '../../../src/types/rpg';
import type { ServerHero, ServerEnemyBase, ServerGameState, ServerNexus } from './rpgServerTypes';
import {
  RPG_CONFIG,
  GOLD_CONFIG,
  COOP_CONFIG,
  DIFFICULTY_CONFIGS,
  ENEMY_AI_CONFIGS,
  RPG_ENEMY_CONFIGS,
  BOSS_SKILL_CONFIGS,
  DIFFICULTY_BOSS_SKILLS,
  DIFFICULTY_BOSS2_SKILLS,
  SPAWN_CONFIG,
  ADVANCED_CLASS_CONFIGS,
  type AdvancedHeroClass,
} from './rpgServerConfig';
import { isBossType } from '../../../src/utils/bossUtils';
import { distance, distanceSquared, clamp, generateId } from './rpgServerUtils';

export interface EnemyContext {
  difficulty: RPGDifficulty;
  playerCount: number;
  onBossPhaseStart: () => void;
}

/**
 * 클래스별 타겟 우선순위 (높을수록 우선)
 * 근접 클래스 우선: 기사 > 전사 > 기타
 */
function getClassTargetPriority(heroClass: string | undefined): number {
  switch (heroClass) {
    case 'knight': return 3;  // 기사: 최우선 (탱커)
    case 'warrior': return 2; // 전사: 높음 (근접 딜러)
    default: return 1;        // 궁수, 마법사 등: 기본
  }
}

/**
 * 랜덤 적 타입 선택
 */
export function selectRandomEnemyType(enemyTypes: { type: string; weight: number }[]): string {
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
 * 적 생성
 */
export function createEnemy(
  type: string,
  fromBase: EnemyBaseId,
  spawnX: number,
  spawnY: number,
  difficulty: RPGDifficulty,
  playerCountScaling: number
): RPGEnemy {
  const rpgConfig = RPG_ENEMY_CONFIGS[type] || RPG_ENEMY_CONFIGS.melee;
  const aiConfig = ENEMY_AI_CONFIGS[type] || ENEMY_AI_CONFIGS.melee;
  const difficultyConfig = DIFFICULTY_CONFIGS[difficulty];

  const statMultiplier = difficultyConfig.enemyHpMultiplier * playerCountScaling;
  const attackMultiplier = difficultyConfig.enemyAttackMultiplier;
  const goldMultiplier = difficultyConfig.goldRewardMultiplier;

  const baseGoldReward = GOLD_CONFIG.REWARDS[type] || 5;
  const goldReward = Math.floor(baseGoldReward * goldMultiplier);

  const offsetX = (Math.random() - 0.5) * 60;
  const offsetY = (Math.random() - 0.5) * 60;

  return {
    id: generateId(),
    type: type as any,
    config: {
      name: rpgConfig.name,
      cost: {},
      hp: rpgConfig.hp,
      attack: rpgConfig.attack,
      attackSpeed: rpgConfig.attackSpeed,
      speed: rpgConfig.speed,
      range: aiConfig.attackRange,
      type: 'combat',
    },
    x: spawnX + offsetX,
    y: spawnY + offsetY,
    hp: Math.floor(rpgConfig.hp * statMultiplier),
    maxHp: Math.floor(rpgConfig.hp * statMultiplier),
    state: 'moving',
    attackCooldown: 0,
    team: 'enemy',
    goldReward,
    targetHero: false,
    aiConfig: {
      ...aiConfig,
      attackDamage: Math.floor(rpgConfig.attack * attackMultiplier),
    },
    buffs: [],
    fromBase,
    aggroOnHero: false,
  };
}

/**
 * 보스 생성
 */
export function createBoss(
  baseId: EnemyBaseId,
  spawnX: number,
  spawnY: number,
  difficulty: RPGDifficulty,
  playerCount: number
): RPGEnemy {
  const difficultyConfig = DIFFICULTY_CONFIGS[difficulty];

  const baseHpByPlayerCount: Record<number, number> = { 1: 3500, 2: 4000, 3: 5500, 4: 7500 };
  const baseDamageByPlayerCount: Record<number, number> = { 1: 100, 2: 110, 3: 130, 4: 160 };

  const clampedPlayerCount = Math.max(1, Math.min(4, playerCount));
  const baseBossHp = baseHpByPlayerCount[clampedPlayerCount];
  const baseBossDamage = baseDamageByPlayerCount[clampedPlayerCount];

  const bossHp = Math.floor(baseBossHp * difficultyConfig.bossHpMultiplier);
  const bossDamage = Math.floor(baseBossDamage * difficultyConfig.bossAttackMultiplier);
  const goldReward = Math.floor(500 * difficultyConfig.goldRewardMultiplier);

  const aiConfig = ENEMY_AI_CONFIGS.boss;

  // 보스 스킬 생성
  const skillTypes = DIFFICULTY_BOSS_SKILLS[difficulty];
  const bossSkills: BossSkill[] = skillTypes.map(type => {
    const config = BOSS_SKILL_CONFIGS[type];
    return {
      type: type as BossSkillType,
      cooldown: config.cooldown,
      currentCooldown: config.cooldown * 0.5,
      damage: config.damage,
      radius: config.radius,
      angle: config.angle,
      castTime: config.castTime,
      stunDuration: config.stunDuration,
      summonCount: config.summonCount,
      hpThreshold: config.hpThreshold,
      knockbackDistance: config.knockbackDistance,
      oneTimeUse: config.oneTimeUse,
      chargeDistance: config.chargeDistance,
      healPercent: config.healPercent,
      used: false,
    };
  });

  return {
    id: `boss_${baseId}_${generateId()}`,
    type: 'boss' as any,
    config: {
      name: baseId === 'left' ? '왼쪽 보스' : '오른쪽 보스',
      cost: {},
      hp: bossHp,
      attack: bossDamage,
      attackSpeed: 2.0,
      speed: 1.2,
      range: aiConfig.attackRange,
      type: 'combat',
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
    aiConfig: {
      ...aiConfig,
      attackDamage: bossDamage,
      moveSpeed: aiConfig.moveSpeed * 0.8,
      attackSpeed: aiConfig.attackSpeed * 1.2,
    },
    buffs: [],
    fromBase: baseId,
    aggroOnHero: false,
    damagedBy: [],
    bossSkills,
  };
}

/**
 * Boss2 (암흑 마법사) 생성
 */
export function createBoss2(
  baseId: EnemyBaseId,
  spawnX: number,
  spawnY: number,
  difficulty: RPGDifficulty,
  playerCount: number
): RPGEnemy {
  const difficultyConfig = DIFFICULTY_CONFIGS[difficulty];

  // Boss2 난이도별 고정 HP/ATK (bossHp/AttackMultiplier 미적용 - 별도 스케일링)
  // Boss1 대비 약 10~15% 높은 공격력 유지
  const boss2HpByDifficulty: Partial<Record<RPGDifficulty, Record<number, number>>> = {
    hell: { 1: 5000, 2: 5800, 3: 8000, 4: 10500 },
    apocalypse: { 1: 7500, 2: 8500, 3: 11500, 4: 15000 },
  };
  const boss2AtkByDifficulty: Partial<Record<RPGDifficulty, Record<number, number>>> = {
    hell: { 1: 150, 2: 165, 3: 195, 4: 240 },
    apocalypse: { 1: 180, 2: 200, 3: 235, 4: 290 },
  };
  const defaultHpByPlayerCount: Record<number, number> = { 1: 2800, 2: 3200, 3: 4400, 4: 6000 };
  const baseDamageByPlayerCount: Record<number, number> = { 1: 120, 2: 130, 3: 155, 4: 190 };

  const clampedPlayerCount = Math.max(1, Math.min(4, playerCount));

  const fixedHpTable = boss2HpByDifficulty[difficulty];
  const bossHp = fixedHpTable
    ? fixedHpTable[clampedPlayerCount]
    : Math.floor(defaultHpByPlayerCount[clampedPlayerCount] * difficultyConfig.bossHpMultiplier);
  const fixedAtkTable = boss2AtkByDifficulty[difficulty];
  const bossDamage = fixedAtkTable
    ? fixedAtkTable[clampedPlayerCount]
    : Math.floor(baseDamageByPlayerCount[clampedPlayerCount] * difficultyConfig.bossAttackMultiplier);
  const goldReward = Math.floor(500 * difficultyConfig.goldRewardMultiplier);

  const aiConfig = ENEMY_AI_CONFIGS.boss2;

  // Boss2 스킬 생성
  const skillTypes = DIFFICULTY_BOSS2_SKILLS[difficulty];
  const bossSkills: BossSkill[] = skillTypes.map(type => {
    const config = BOSS_SKILL_CONFIGS[type];
    return {
      type: type as BossSkillType,
      cooldown: config.cooldown,
      currentCooldown: config.cooldown * 0.5,
      damage: config.damage,
      radius: config.radius,
      castTime: config.castTime,
      summonCount: config.summonCount,
      hpThreshold: config.hpThreshold,
      drainHealPercent: config.drainHealPercent,
      zoneDuration: config.zoneDuration,
      used: false,
    };
  });

  return {
    id: `boss2_${baseId}_${generateId()}`,
    type: 'boss2' as any,
    config: {
      name: baseId === 'left' ? '왼쪽 암흑 마법사' : '오른쪽 암흑 마법사',
      cost: {},
      hp: bossHp,
      attack: bossDamage,
      attackSpeed: 2.5,
      speed: 1.0,
      range: aiConfig.attackRange,
      type: 'combat',
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
    aiConfig: {
      ...aiConfig,
      attackDamage: bossDamage,
    },
    buffs: [],
    fromBase: baseId,
    aggroOnHero: false,
    damagedBy: [],
    bossSkills,
  };
}

/**
 * 적 스폰 업데이트
 */
export function updateSpawning(
  state: ServerGameState,
  ctx: EnemyContext
): void {
  const { gameTime, enemyBases, enemies, lastSpawnTime, gamePhase } = state;

  if (gamePhase === 'boss_phase') return;

  // 기지 파괴 여부를 먼저 체크 (스폰 간격과 무관하게 즉시 보스 스폰)
  const activeBases = enemyBases.filter(b => !b.destroyed);
  if (activeBases.length === 0) {
    if (gamePhase === 'playing') {
      ctx.onBossPhaseStart();
    }
    return;
  }

  const minutes = gameTime / 60;
  const difficultyConfig = DIFFICULTY_CONFIGS[ctx.difficulty];
  const playerCountScaling = COOP_CONFIG.DIFFICULTY_SCALING[ctx.playerCount] ?? 1.0;

  const baseSpawnInterval = Math.max(
    SPAWN_CONFIG.MIN_INTERVAL,
    SPAWN_CONFIG.BASE_INTERVAL - minutes * SPAWN_CONFIG.INTERVAL_DECREASE_PER_MINUTE
  );
  const spawnInterval = baseSpawnInterval * difficultyConfig.spawnIntervalMultiplier;

  if (gameTime - lastSpawnTime < spawnInterval) return;

  let baseSpawnCount = 1;
  if (minutes >= 6) {
    baseSpawnCount = Math.random() < 0.5 ? 2 : 3;
  } else if (minutes >= 4) {
    baseSpawnCount = 2;
  } else if (minutes >= 2) {
    baseSpawnCount = Math.random() < 0.5 ? 1 : 2;
  }
  const finalSpawnCount = Math.max(1, Math.round(baseSpawnCount * difficultyConfig.spawnCountMultiplier));

  const enemyTypes = SPAWN_CONFIG.getEnemyTypesForTime(minutes, difficultyConfig.unitTimeMultiplier);

  for (const base of activeBases) {
    for (let i = 0; i < finalSpawnCount; i++) {
      const enemyType = selectRandomEnemyType(enemyTypes);
      const enemy = createEnemy(enemyType, base.id, base.x, base.y, ctx.difficulty, playerCountScaling);
      enemies.push(enemy);
    }
  }

  state.lastSpawnTime = gameTime;
}

/**
 * 적 AI 업데이트
 */
export function updateEnemies(
  state: ServerGameState,
  deltaTime: number,
  onAttackHero: (enemy: RPGEnemy, hero: ServerHero) => void,
  onAttackNexus: (enemy: RPGEnemy) => void
): void {
  const { enemies, nexus } = state;
  const aliveHeroes = Array.from(state.heroes.values()).filter(h => !h.isDead);

  for (const enemy of enemies) {
    if (enemy.hp <= 0) continue;

    // 기절 상태 처리
    const isStunned = enemy.buffs?.some(b => b.type === 'stun' && b.duration > 0);
    if (isStunned) {
      enemy.state = 'idle';
      // 인플레이스 버프 업데이트
      if (enemy.buffs) {
        for (let bi = enemy.buffs.length - 1; bi >= 0; bi--) {
          enemy.buffs[bi].duration -= deltaTime;
          if (enemy.buffs[bi].duration <= 0) {
            enemy.buffs.splice(bi, 1);
          }
        }
      }
      continue;
    }

    // 보스 시전 중이면 이동 안 함
    if (isBossType(enemy.type) && enemy.currentCast) {
      enemy.state = 'casting';
      continue;
    }

    // 보스 돌진 상태 처리
    if (enemy.dashState) {
      const dash = enemy.dashState;
      const newProgress = dash.progress + deltaTime / dash.duration;

      if (newProgress >= 1) {
        enemy.x = dash.targetX;
        enemy.y = dash.targetY;
        enemy.dashState = undefined;
        enemy.state = 'idle';
      } else {
        const easedProgress = 1 - (1 - newProgress) * (1 - newProgress);
        enemy.x = dash.startX + (dash.targetX - dash.startX) * easedProgress;
        enemy.y = dash.startY + (dash.targetY - dash.startY) * easedProgress;
        enemy.dashState = { ...dash, progress: newProgress };
        enemy.state = 'moving';
      }
      continue;
    }

    // 쿨다운 감소
    if (enemy.attackCooldown > 0) {
      enemy.attackCooldown -= deltaTime;
    }

    // 어그로 만료 체크
    if (enemy.aggroOnHero && enemy.aggroExpireTime && state.gameTime >= enemy.aggroExpireTime) {
      enemy.aggroOnHero = false;
      enemy.targetHeroId = undefined;
      enemy.aggroExpireTime = undefined;
    }

    // 타겟 결정: 감지 범위 내 클래스 우선순위 > 어그로 > 넥서스
    // 근접 클래스(기사 > 전사)가 감지 범위 내에 있으면 어그로보다 우선
    let targetHero: ServerHero | null = null;

    // 1. 어그로 대상 확인
    let aggroTarget: ServerHero | null = null;
    if (enemy.aggroOnHero && enemy.targetHeroId) {
      aggroTarget = aliveHeroes.find(h => h.id === enemy.targetHeroId) || null;
    }

    // 2. 감지 범위 내 클래스 우선순위 기반 스캔
    const detectionRangeSq = enemy.aiConfig.detectionRange * enemy.aiConfig.detectionRange;
    let bestDetectionTarget: ServerHero | null = null;
    let bestMinDistSq = detectionRangeSq;
    let bestMaxPriority = 0;
    for (const hero of aliveHeroes) {
      const distSq = distanceSquared(enemy.x, enemy.y, hero.x, hero.y);
      if (distSq > detectionRangeSq) continue;

      const priority = getClassTargetPriority(hero.heroClass);

      if (priority > bestMaxPriority || (priority === bestMaxPriority && distSq < bestMinDistSq)) {
        bestMinDistSq = distSq;
        bestMaxPriority = priority;
        bestDetectionTarget = hero;
      }
    }

    // 3. 최종 타겟 결정
    if (bestDetectionTarget && aggroTarget) {
      const aggroPriority = getClassTargetPriority(aggroTarget.heroClass);
      // 감지 범위 내 더 높은 우선순위 영웅이 있으면 어그로 무시
      targetHero = bestMaxPriority > aggroPriority ? bestDetectionTarget : aggroTarget;
    } else {
      targetHero = bestDetectionTarget || aggroTarget;
    }

    const nexusX = nexus.x;
    const nexusY = nexus.y;
    const attackRangeSq = enemy.aiConfig.attackRange * enemy.aiConfig.attackRange;

    if (targetHero) {
      const distToHeroSq = distanceSquared(enemy.x, enemy.y, targetHero.x, targetHero.y);

      if (distToHeroSq <= attackRangeSq) {
        if (enemy.attackCooldown <= 0) {
          onAttackHero(enemy, targetHero);
          enemy.attackCooldown = enemy.aiConfig.attackSpeed;
          enemy.state = 'attacking';
        } else {
          enemy.state = 'idle';
        }
      } else {
        const angle = Math.atan2(targetHero.y - enemy.y, targetHero.x - enemy.x);
        const moveX = Math.cos(angle) * enemy.aiConfig.moveSpeed * deltaTime * 60;
        const moveY = Math.sin(angle) * enemy.aiConfig.moveSpeed * deltaTime * 60;
        enemy.x = clamp(enemy.x + moveX, 30, RPG_CONFIG.MAP_WIDTH - 30);
        enemy.y = clamp(enemy.y + moveY, 30, RPG_CONFIG.MAP_HEIGHT - 30);
        enemy.state = 'moving';
      }
    } else {
      const distToNexusSq = distanceSquared(enemy.x, enemy.y, nexusX, nexusY);
      if (distToNexusSq <= attackRangeSq) {
        if (enemy.attackCooldown <= 0) {
          onAttackNexus(enemy);
          enemy.attackCooldown = enemy.aiConfig.attackSpeed;
          enemy.state = 'attacking';
        } else {
          enemy.state = 'idle';
        }
      } else {
        const angle = Math.atan2(nexusY - enemy.y, nexusX - enemy.x);
        const moveX = Math.cos(angle) * enemy.aiConfig.moveSpeed * deltaTime * 60;
        const moveY = Math.sin(angle) * enemy.aiConfig.moveSpeed * deltaTime * 60;
        enemy.x = clamp(enemy.x + moveX, 30, RPG_CONFIG.MAP_WIDTH - 30);
        enemy.y = clamp(enemy.y + moveY, 30, RPG_CONFIG.MAP_HEIGHT - 30);
        enemy.state = 'moving';
      }
    }

    // 버프 업데이트 (인플레이스)
    if (enemy.buffs) {
      for (let bi = enemy.buffs.length - 1; bi >= 0; bi--) {
        enemy.buffs[bi].duration -= deltaTime;
        if (enemy.buffs[bi].duration <= 0) {
          enemy.buffs.splice(bi, 1);
        }
      }
    }
  }
}

/**
 * 적 영웅 공격 처리
 */
export function enemyAttackHero(enemy: RPGEnemy, hero: ServerHero, damageNumbers: any[], now: number): void {
  let damage = enemy.aiConfig.attackDamage;

  // 무적 버프 체크
  const invincibleBuff = hero.buffs?.find(b => b.type === 'invincible' && b.duration > 0);
  if (invincibleBuff) {
    damage = 0;
  }

  // 가디언 패시브 피해 감소 (30%)
  const advancedClass = hero.advancedClass as AdvancedHeroClass | undefined;
  if (advancedClass === 'guardian' && damage > 0) {
    const damageReduction = ADVANCED_CLASS_CONFIGS.guardian.specialEffects.damageReduction || 0.3;
    damage = Math.floor(damage * (1 - damageReduction));
  }

  // 철벽 방어 버프 체크
  const ironwallBuff = hero.buffs?.find(b => b.type === 'ironwall' && b.duration > 0);
  if (ironwallBuff && ironwallBuff.damageReduction) {
    damage = Math.floor(damage * (1 - ironwallBuff.damageReduction));
  }

  // 받는 피해 증가 버프 체크 (광란 등)
  const damageTakenBuff = hero.buffs?.find(b => b.damageTaken && b.duration > 0);
  if (damageTakenBuff && damageTakenBuff.damageTaken) {
    damage = Math.floor(damage * (1 + damageTakenBuff.damageTaken));
  }

  hero.hp -= damage;

  if (damage > 0) {
    damageNumbers.push({
      id: generateId(),
      x: hero.x,
      y: hero.y - 30,
      amount: damage,
      type: 'enemy_damage',
      createdAt: now,
    });
  }

  return;
}

/**
 * 적 넥서스 공격 처리
 */
export function enemyAttackNexus(enemy: RPGEnemy, nexus: ServerNexus, damageNumbers: any[], now: number): void {
  const damage = enemy.aiConfig.attackDamage;
  nexus.hp -= damage;

  damageNumbers.push({
    id: generateId(),
    x: nexus.x,
    y: nexus.y - 30,
    amount: damage,
    type: 'enemy_damage',
    createdAt: now,
  });
}

/**
 * 적 사망 처리
 */
export function handleEnemyDeath(state: ServerGameState, enemy: RPGEnemy, attacker?: ServerHero): void {
  enemy.hp = 0;
  state.stats.totalKills++;

  const goldReward = enemy.goldReward;

  if (isBossType(enemy.type)) {
    state.stats.bossesKilled++;

    const contributors = enemy.damagedBy || [];
    if (contributors.length > 0) {
      const goldPerPlayer = Math.floor(goldReward / contributors.length);
      for (const heroId of contributors) {
        const hero = state.heroes.get(heroId);
        if (hero) {
          hero.gold += goldPerPlayer;
          hero.kills++;
        }
      }
    } else if (attacker) {
      attacker.gold += goldReward;
      attacker.kills++;
    }
  } else if (attacker) {
    attacker.gold += goldReward;
    attacker.kills++;
  }

  state.stats.totalGoldEarned += goldReward;
  console.log(`[ServerEngine] 적 처치: ${enemy.id}, 골드: ${goldReward}`);
}
