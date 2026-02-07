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
import type { SerializedGameState, SerializedHero, SerializedEnemy } from '../../../shared/types/hostBasedNetwork';
import {
  NEXUS_CONFIG,
  GOLD_CONFIG,
  UPGRADE_CONFIG,
  CLASS_CONFIGS,
} from './rpgServerConfig';
import { distance, generateId } from './rpgServerUtils';

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
    // 범위 내 모든 생존 적 찾기
    const enemiesInRange = enemies.filter(e =>
      e.hp > 0 && distance(nexus.x, nexus.y, e.x, e.y) <= NEXUS_CONFIG.laser.range
    );

    // 범위 내 적이 있으면 모든 적에게 동시 공격
    if (enemiesInRange.length > 0) {
      const now = Date.now();

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
    if (currentAttackSpeed <= 0.3) return;
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
    createdAt: Date.now(),
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

  // 모든 영웅이 죽으면 패배
  const aliveHeroes = Array.from(state.heroes.values()).filter(h => !h.isDead);
  if (aliveHeroes.length === 0) {
    const revisingHeroes = Array.from(state.heroes.values()).filter(h => h.isDead && h.reviveTimer > 0);
    if (revisingHeroes.length === 0) {
      return 'defeat';
    }
  }

  // 승리: 보스 페이즈에서 모든 보스 처치
  if (gamePhase === 'boss_phase') {
    const bosses = enemies.filter(e => e.type === 'boss');
    const allBossesDead = bosses.length > 0 && bosses.every(b => b.hp <= 0);
    if (allBossesDead) {
      return 'victory';
    }
  }

  return null;
}

/**
 * 이펙트 정리
 */
export function cleanupEffects(state: ServerGameState): void {
  const { gameTime } = state;
  const now = Date.now();
  const effectDuration = 500; // 0.5초
  const damageNumberDuration = 1000; // 1초

  // 스킬 이펙트 정리
  state.activeSkillEffects = state.activeSkillEffects.filter(
    e => gameTime < e.startTime + e.duration
  );

  // 기본 공격 이펙트 정리
  state.basicAttackEffects = state.basicAttackEffects.filter(
    e => now - e.timestamp < effectDuration
  );

  // 넥서스 레이저 이펙트 정리
  state.nexusLaserEffects = state.nexusLaserEffects.filter(
    e => now - e.timestamp < effectDuration
  );

  // 보스 스킬 경고 정리
  state.bossSkillWarnings = state.bossSkillWarnings.filter(
    w => gameTime < w.startTime + w.duration
  );

  // 보스 스킬 실행 이펙트 정리
  state.bossSkillExecutedEffects = state.bossSkillExecutedEffects.filter(
    e => now - e.timestamp < effectDuration
  );

  // 데미지 넘버 정리
  state.damageNumbers = state.damageNumbers.filter(
    d => now - d.createdAt < damageNumberDuration
  );

  // 죽은 적 정리
  state.enemies = state.enemies.filter(e => e.hp > 0);
}

/**
 * 게임 상태 직렬화
 */
export function serializeGameState(state: ServerGameState): SerializedGameState {
  // 영웅 직렬화
  const heroes: SerializedHero[] = [];
  for (const hero of state.heroes.values()) {
    heroes.push({
      id: hero.id,
      playerId: hero.playerId || '',
      heroClass: hero.heroClass,
      x: hero.x,
      y: hero.y,
      hp: hero.hp,
      maxHp: hero.maxHp,
      attack: hero.config?.attack || hero.baseAttack || 50,
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
      // hero.skills에서 쿨다운을 가져와서 skillCooldowns에 동기화 (key 필드로 찾기)
      skillCooldowns: {
        Q: hero.skills?.find(s => s.key === 'Q')?.currentCooldown ?? 0,
        W: hero.skills?.find(s => s.key === 'W')?.currentCooldown ?? 0,
        E: hero.skills?.find(s => s.key === 'E')?.currentCooldown ?? 0,
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
    });
  }

  // 적 직렬화
  const enemies: SerializedEnemy[] = state.enemies
    .filter(e => e.hp > 0)
    .map(e => ({
      id: e.id,
      type: e.type,
      x: e.x,
      y: e.y,
      hp: e.hp,
      maxHp: e.maxHp,
      goldReward: e.goldReward,
      targetHeroId: e.targetHeroId,
      aggroOnHero: e.aggroOnHero,
      aggroExpireTime: e.aggroExpireTime,
      fromBase: e.fromBase,
      buffs: e.buffs || [],
      isStunned: e.buffs?.some(b => b.type === 'stun' && b.duration > 0) || false,
      dashState: e.dashState,
    }));

  return {
    gameTime: state.gameTime,
    gamePhase: state.gamePhase,
    heroes,
    enemies,
    nexus: state.nexus,
    enemyBases: state.enemyBases,
    gold: state.gold,
    upgradeLevels: state.upgradeLevels,
    activeSkillEffects: state.activeSkillEffects,
    basicAttackEffects: state.basicAttackEffects,
    nexusLaserEffects: state.nexusLaserEffects,
    pendingSkills: state.pendingSkills,
    bossSkillWarnings: state.bossSkillWarnings,
    bossSkillExecutedEffects: state.bossSkillExecutedEffects,
    damageNumbers: state.damageNumbers,
    running: state.running,
    paused: state.paused,
    gameOver: state.gameOver,
    victory: state.victory,
    lastSpawnTime: state.lastSpawnTime,
    stats: state.stats,
  };
}
