/**
 * RPG 서버 게임 시스템
 * - 넥서스 레이저
 * - 골드 수급
 * - 업그레이드 처리
 * - 기지 데미지
 * - 승패 조건
 * - 이펙트 정리
 */

import type { RPGEnemy, EnemyBaseId, UpgradeLevels, RPGDifficulty } from '../../../src/types/rpg';
import type { ServerHero, ServerGameState, ServerEnemyBase, ServerNexus } from './rpgServerTypes';
import type { SerializedGameState, SerializedHero, SerializedEnemy, SerializedEffectState } from '../../../shared/types/hostBasedNetwork';
import {
  NEXUS_CONFIG,
  GOLD_CONFIG,
  UPGRADE_CONFIG,
  CLASS_CONFIGS,
} from './rpgServerConfig';
import { distance, distanceSquared, generateId } from './rpgServerUtils';
import { isBossType } from '../utils/bossUtils';

export interface GameSystemsContext {
  difficulty: RPGDifficulty;
  onEnemyDeath: (enemy: RPGEnemy) => void;
}

/**
 * 넥서스 레이저 업데이트
 * - 범위 내 모든 적을 동시에 공격
 */
export function updateNexusLaser(
  state: ServerGameState,
  deltaTime: number,
  onEnemyDeath: (enemy: RPGEnemy) => void
): void {
  const { nexus, enemies } = state;

  state.nexusLaserCooldown -= deltaTime;

  if (state.nexusLaserCooldown <= 0) {
    // 범위 내 모든 생존 적 찾기 (distanceSquared로 Math.sqrt 제거)
    const laserRangeSq = NEXUS_CONFIG.laser.range * NEXUS_CONFIG.laser.range;
    const enemiesInRange = enemies.filter(e =>
      e.hp > 0 && distanceSquared(nexus.x, nexus.y, e.x, e.y) <= laserRangeSq
    );

    // 범위 내 적이 있으면 모든 적에게 동시 공격
    if (enemiesInRange.length > 0) {
      const now = state.currentTickTimestamp;

      for (const enemy of enemiesInRange) {
        enemy.hp -= NEXUS_CONFIG.laser.damage;

        // 레이저 이펙트 생성
        state.nexusLaserEffects.push({
          id: `nexus_laser_${now}_${enemy.id}`,
          targetX: enemy.x,
          targetY: enemy.y,
          timestamp: now,
        });

        // 적 사망 처리
        if (enemy.hp <= 0) {
          onEnemyDeath(enemy);
        }
      }

      // 쿨다운 리셋 (적이 있을 때만)
      state.nexusLaserCooldown = NEXUS_CONFIG.laser.attackSpeed;
    }
  }
}

/**
 * 패시브 골드 업데이트
 */
export function updatePassiveGold(state: ServerGameState, deltaTime: number): void {
  const baseGoldRate = GOLD_CONFIG.PASSIVE_GOLD_PER_SECOND;

  for (const hero of state.heroes.values()) {
    if (hero.isDead) continue;

    const goldRateBonus = hero.upgradeLevels.goldRate * UPGRADE_CONFIG.goldRate.perLevel;
    const goldPerSecond = baseGoldRate + goldRateBonus;

    hero.goldAccumulator += goldPerSecond * deltaTime;
    if (hero.goldAccumulator >= 1) {
      const goldToAdd = Math.floor(hero.goldAccumulator);
      hero.gold += goldToAdd;
      hero.goldAccumulator -= goldToAdd;
    }
  }
}

/**
 * 업그레이드 처리
 */
export function processUpgrade(hero: ServerHero, upgradeType: string): void {
  const currentLevel = hero.upgradeLevels[upgradeType as keyof UpgradeLevels] || 0;
  const cost = GOLD_CONFIG.UPGRADE_BASE_COST * (currentLevel + 1);

  // 사거리 업그레이드 제한 체크
  if (upgradeType === 'range') {
    if (hero.heroClass !== 'archer' && hero.heroClass !== 'mage') return;
    if (currentLevel >= (UPGRADE_CONFIG.range.maxLevel || 10)) return;
  }

  // 공격속도 0.3초 캡 체크 (이미 최대치면 업그레이드 불가)
  if (upgradeType === 'attackSpeed') {
    const currentAttackSpeed = hero.config?.attackSpeed || hero.baseAttackSpeed || 1;
    if (currentAttackSpeed < 0.31) return;
  }

  if (hero.gold < cost) return;

  hero.gold -= cost;
  hero.upgradeLevels[upgradeType as keyof UpgradeLevels]++;

  // 스탯 적용
  // 참고: attack은 데미지 계산 시 upgradeLevels.attack을 기반으로 보너스가 적용되므로
  //       여기서 hero.config.attack을 수정하면 중복 적용됨
  // 참고: goldRate는 골드 계산 시 upgradeLevels.goldRate을 기반으로 보너스가 적용됨
  const config = UPGRADE_CONFIG[upgradeType as keyof typeof UPGRADE_CONFIG];
  if (upgradeType === 'speed') {
    hero.config = { ...hero.config, speed: (hero.config?.speed || hero.baseSpeed || 3) + config.perLevel };
  } else if (upgradeType === 'hp') {
    const hpIncrease = config.perLevel;
    hero.maxHp += hpIncrease;
    hero.hp += hpIncrease;
  } else if (upgradeType === 'attackSpeed') {
    // 공격속도 업그레이드: 더 빠른 공격 (쿨다운 감소)
    const currentAttackSpeed = hero.config?.attackSpeed || hero.baseAttackSpeed || 1;
    hero.config = { ...hero.config, attackSpeed: Math.max(0.3, currentAttackSpeed - config.perLevel) };
  } else if (upgradeType === 'range' && (hero.heroClass === 'archer' || hero.heroClass === 'mage')) {
    hero.config = { ...hero.config, range: (hero.config?.range || CLASS_CONFIGS[hero.heroClass].range) + config.perLevel };
  }
}

/**
 * 기지 데미지 처리
 */
export function damageBase(
  state: ServerGameState,
  baseId: EnemyBaseId,
  damage: number,
  difficulty: RPGDifficulty,
  attackerId?: string
): void {
  const base = state.enemyBases.find(b => b.id === baseId);
  if (!base || base.destroyed) return;

  base.hp -= damage;

  // 데미지 넘버 추가
  state.damageNumbers.push({
    id: generateId(),
    x: base.x,
    y: base.y - 20,
    amount: damage,
    type: 'damage',
    createdAt: state.currentTickTimestamp,
  });

  if (base.hp <= 0) {
    base.hp = 0;
    base.destroyed = true;
    state.stats.basesDestroyed++;

    // 기지 파괴 골드 보상
    const goldReward = GOLD_CONFIG.BASE_DESTROY_REWARDS[difficulty];
    if (attackerId) {
      const hero = state.heroes.get(attackerId);
      if (hero) {
        hero.gold += goldReward;
      }
    } else {
      // 전체 분배
      const heroCount = state.heroes.size;
      const goldPerHero = Math.floor(goldReward / heroCount);
      for (const hero of state.heroes.values()) {
        hero.gold += goldPerHero;
      }
    }
    state.stats.totalGoldEarned += goldReward;
    console.log(`[ServerEngine] 기지 파괴: ${baseId}, 골드 보상: ${goldReward}`);
  }
}

/**
 * 승패 조건 확인
 * @returns 'victory' | 'defeat' | null (게임 진행 중)
 */
export function checkWinCondition(state: ServerGameState): 'victory' | 'defeat' | null {
  const { nexus, enemies, gamePhase, gameOver } = state;

  if (gameOver) return null;

  // 패배: 넥서스 HP 0
  if (nexus.hp <= 0) {
    return 'defeat';
  }

  // 모든 영웅이 죽으면 패배 (배열 할당 없이 직접 카운트)
  let aliveCount = 0;
  let revivingCount = 0;
  for (const hero of state.heroes.values()) {
    if (!hero.isDead) {
      aliveCount++;
    } else if (hero.reviveTimer > 0) {
      revivingCount++;
    }
  }
  if (aliveCount === 0 && revivingCount === 0) {
    return 'defeat';
  }

  // 승리: 보스 페이즈에서 모든 보스 처치
  if (gamePhase === 'boss_phase') {
    let bossCount = 0;
    let deadBossCount = 0;
    for (const e of enemies) {
      if (isBossType(e.type)) {
        bossCount++;
        if (e.hp <= 0) deadBossCount++;
      }
    }
    if (bossCount > 0 && bossCount === deadBossCount) {
      return 'victory';
    }
  }

  return null;
}

/**
 * 이펙트 정리 (인플레이스 - 매 틱 배열 재할당 제거)
 */
export function cleanupEffects(state: ServerGameState): void {
  const { gameTime } = state;
  const now = state.currentTickTimestamp;
  const effectDuration = 500; // 0.5초
  const damageNumberDuration = 1000; // 1초

  // 스킬 이펙트 정리
  for (let i = state.activeSkillEffects.length - 1; i >= 0; i--) {
    if (gameTime >= state.activeSkillEffects[i].startTime + state.activeSkillEffects[i].duration) {
      state.activeSkillEffects.splice(i, 1);
    }
  }

  // 기본 공격 이펙트 정리
  for (let i = state.basicAttackEffects.length - 1; i >= 0; i--) {
    if (now - state.basicAttackEffects[i].timestamp >= effectDuration) {
      state.basicAttackEffects.splice(i, 1);
    }
  }

  // 넥서스 레이저 이펙트 정리
  for (let i = state.nexusLaserEffects.length - 1; i >= 0; i--) {
    if (now - state.nexusLaserEffects[i].timestamp >= effectDuration) {
      state.nexusLaserEffects.splice(i, 1);
    }
  }

  // 보스 스킬 경고 정리
  for (let i = state.bossSkillWarnings.length - 1; i >= 0; i--) {
    if (gameTime >= state.bossSkillWarnings[i].startTime + state.bossSkillWarnings[i].duration) {
      state.bossSkillWarnings.splice(i, 1);
    }
  }

  // 보스 스킬 실행 이펙트 정리
  for (let i = state.bossSkillExecutedEffects.length - 1; i >= 0; i--) {
    if (now - state.bossSkillExecutedEffects[i].timestamp >= effectDuration) {
      state.bossSkillExecutedEffects.splice(i, 1);
    }
  }

  // 데미지 넘버 정리
  for (let i = state.damageNumbers.length - 1; i >= 0; i--) {
    if (now - state.damageNumbers[i].createdAt >= damageNumberDuration) {
      state.damageNumbers.splice(i, 1);
    }
  }

  // 죽은 적 정리
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    if (state.enemies[i].hp <= 0) {
      state.enemies.splice(i, 1);
    }
  }
}

/**
 * 영웅/적 직렬화 (매 프레임 공통)
 */
function serializeHeroes(state: ServerGameState): SerializedHero[] {
  const heroes: SerializedHero[] = [];
  for (const hero of state.heroes.values()) {
    heroes.push({
      id: hero.id,
      playerId: hero.playerId || '',
      heroClass: hero.heroClass,
      x: Math.round(hero.x),
      y: Math.round(hero.y),
      hp: Math.round(hero.hp),
      maxHp: Math.round(hero.maxHp),
      attack: Math.round(hero.config?.attack || hero.baseAttack || 50),
      attackSpeed: hero.config?.attackSpeed || hero.baseAttackSpeed || 1,
      speed: hero.config?.speed || hero.baseSpeed || 3,
      range: hero.config?.range || 50,
      baseAttack: hero.baseAttack,
      baseSpeed: hero.baseSpeed,
      baseAttackSpeed: hero.baseAttackSpeed,
      gold: Math.floor(hero.gold),
      upgradeLevels: hero.upgradeLevels,
      isDead: hero.isDead,
      reviveTimer: hero.reviveTimer,
      deathTime: hero.deathTime,
      facingRight: hero.facingRight,
      facingAngle: hero.facingAngle,
      buffs: hero.buffs || [],
      passiveGrowth: hero.passiveGrowth || { currentValue: 0, currentLevel: 0, overflowValue: 0 },
      // hero._skill 캐시에서 쿨다운 참조 (find 호출 제거), 0.1초 단위 양자화
      skillCooldowns: {
        Q: Math.round(hero._skillQ.currentCooldown * 10) / 10,
        W: Math.round(hero._skillW.currentCooldown * 10) / 10,
        E: Math.round(hero._skillE.currentCooldown * 10) / 10,
      },
      moveDirection: hero.moveDirection,
      state: hero.state,
      characterLevel: hero.characterLevel || 1,
      dashState: hero.dashState,
      statUpgrades: hero.statUpgrades,
      kills: hero.kills || 0,
      advancedClass: hero.advancedClass,
      tier: hero.tier,
      castingUntil: hero.castingUntil,
      darkBladeActive: hero.darkBladeActive || false,
    });
  }
  return heroes;
}

function serializeEnemies(state: ServerGameState): SerializedEnemy[] {
  const enemies: SerializedEnemy[] = [];
  for (const e of state.enemies) {
    if (e.hp <= 0) continue;
    enemies.push({
      id: e.id,
      type: e.type,
      x: Math.round(e.x),
      y: Math.round(e.y),
      hp: Math.round(e.hp),
      maxHp: Math.round(e.maxHp),
      goldReward: e.goldReward,
      targetHeroId: e.targetHeroId,
      aggroOnHero: e.aggroOnHero,
      aggroExpireTime: e.aggroExpireTime,
      fromBase: e.fromBase,
      buffs: e.buffs || [],
      isStunned: e.buffs?.some(b => b.type === 'stun' && b.duration > 0) || false,
      dashState: e.dashState,
    });
  }
  return enemies;
}

/**
 * 게임 상태 직렬화 (풀 스냅샷)
 */
export function serializeGameState(state: ServerGameState): SerializedGameState {
  return {
    gameTime: Math.round(state.gameTime * 10) / 10,
    gamePhase: state.gamePhase,
    heroes: serializeHeroes(state),
    enemies: serializeEnemies(state),
    nexus: {
      ...state.nexus,
      x: Math.round(state.nexus.x),
      y: Math.round(state.nexus.y),
      hp: Math.round(state.nexus.hp),
      maxHp: Math.round(state.nexus.maxHp),
    },
    enemyBases: state.enemyBases.map(b => ({
      ...b,
      x: Math.round(b.x),
      y: Math.round(b.y),
      hp: Math.round(b.hp),
      maxHp: Math.round(b.maxHp),
    })),
    gold: state.gold,
    upgradeLevels: state.upgradeLevels,
    activeSkillEffects: state.activeSkillEffects,
    pendingSkills: state.pendingSkills,
    bossSkillWarnings: state.bossSkillWarnings,
    bossActiveZones: state.bossActiveZones,
    running: state.running,
    paused: state.paused,
    gameOver: state.gameOver,
    victory: state.victory,
    lastSpawnTime: state.lastSpawnTime,
    stats: state.stats,
  };
}

/**
 * 델타 게임 상태 직렬화 (변경된 섹션만 포함)
 * dirtyFlags: nexus/bases/gold/upgrades/stats 변경 여부
 */
export interface DirtyFlags {
  nexus: boolean;
  enemyBases: boolean;
  gold: boolean;
  upgradeLevels: boolean;
  stats: boolean;
}

export function serializeDeltaGameState(
  state: ServerGameState,
  dirty: DirtyFlags,
  frameId: number,
  inputAcks: Record<string, number>
): SerializedGameState {
  const result: SerializedGameState = {
    gameTime: Math.round(state.gameTime * 10) / 10,
    gamePhase: state.gamePhase,
    heroes: serializeHeroes(state),
    enemies: serializeEnemies(state),
    activeSkillEffects: state.activeSkillEffects,
    pendingSkills: state.pendingSkills,
    bossSkillWarnings: state.bossSkillWarnings,
    bossActiveZones: state.bossActiveZones,
    running: state.running,
    paused: state.paused,
    gameOver: state.gameOver,
    victory: state.victory,
    frameId,
    inputAcks,
  };

  // 변경된 섹션만 포함
  if (dirty.nexus) {
    result.nexus = {
      ...state.nexus,
      x: Math.round(state.nexus.x),
      y: Math.round(state.nexus.y),
      hp: Math.round(state.nexus.hp),
      maxHp: Math.round(state.nexus.maxHp),
    };
  }
  if (dirty.enemyBases) {
    result.enemyBases = state.enemyBases.map(b => ({
      ...b,
      x: Math.round(b.x),
      y: Math.round(b.y),
      hp: Math.round(b.hp),
      maxHp: Math.round(b.maxHp),
    }));
  }
  if (dirty.gold) {
    result.gold = state.gold;
  }
  if (dirty.upgradeLevels) {
    result.upgradeLevels = state.upgradeLevels;
  }
  if (dirty.stats) {
    result.stats = state.stats;
    result.lastSpawnTime = state.lastSpawnTime;
  }

  return result;
}

/**
 * 시각 이펙트 직렬화 (15Hz 분리 스트림)
 */
export function serializeEffectState(state: ServerGameState): SerializedEffectState {
  return {
    damageNumbers: state.damageNumbers,
    basicAttackEffects: state.basicAttackEffects,
    nexusLaserEffects: state.nexusLaserEffects,
    bossSkillExecutedEffects: state.bossSkillExecutedEffects,
  };
}
