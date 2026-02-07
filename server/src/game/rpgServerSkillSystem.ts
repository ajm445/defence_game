/**
 * RPG 서버 스킬 시스템
 * - Q/W/E 스킬 실행
 * - 데미지 계산 및 적용
 * - 패시브 효과 (크리티컬, 피해흡혈, 멀티타겟 등)
 */

import type { RPGEnemy, HeroClass, SkillEffect, PendingSkill, DamageNumber, RPGDifficulty } from '../../../src/types/rpg';
import type { ServerHero, ServerEnemyBase, ServerGameState } from './rpgServerTypes';
import {
  RPG_CONFIG,
  UPGRADE_CONFIG,
  CLASS_CONFIGS,
  ADVANCED_CLASS_CONFIGS,
  PASSIVE_UNLOCK_LEVEL,
  type AdvancedHeroClass,
} from './rpgServerConfig';
import { distance, distanceSquared, clamp, generateId, pointToLineDistance } from './rpgServerUtils';
import { damageBase } from './rpgServerGameSystems';

export interface SkillContext {
  state: ServerGameState;
  difficulty: RPGDifficulty;
  onEnemyDeath: (enemy: RPGEnemy, attacker?: ServerHero) => void;
}

/**
 * 스킬 실행 (Q/W/E)
 */
export function executeSkill(
  ctx: SkillContext,
  hero: ServerHero,
  skillSlot: 'Q' | 'W' | 'E',
  targetX: number,
  targetY: number
): void {
  if (hero.isDead) {
    return;
  }

  // 스킬 쿨다운 체크 (캐시된 직접 참조 사용)
  const skill = skillSlot === 'Q' ? hero._skillQ : skillSlot === 'W' ? hero._skillW : hero._skillE;

  if (skill.currentCooldown > 0) {
    return;
  }

  const { enemies, enemyBases, gameTime } = ctx.state;
  const aliveEnemies = enemies.filter(e => e.hp > 0);
  const attackUpgradeLevel = hero.upgradeLevels.attack;

  // 방향 계산
  const dx = targetX - hero.x;
  const dy = targetY - hero.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const dirX = dist > 0 ? dx / dist : (hero.facingRight ? 1 : -1);
  const dirY = dist > 0 ? dy / dist : 0;

  hero.facingRight = dirX >= 0;
  hero.facingAngle = Math.atan2(dirY, dirX);

  // 기본 데미지 계산
  const baseDamage = hero.config?.attack || hero.baseAttack || 50;
  const attackBonus = attackUpgradeLevel * UPGRADE_CONFIG.attack.perLevel;
  let finalDamage = baseDamage + attackBonus;

  // 광전사 버프 적용
  const berserkerBuff = hero.buffs?.find(b => b.type === 'berserker' && b.duration > 0);
  if (berserkerBuff?.attackBonus) {
    finalDamage = Math.floor(finalDamage * (1 + berserkerBuff.attackBonus));
  }

  switch (skillSlot) {
    case 'Q':
      executeQSkill(ctx, hero, aliveEnemies, dirX, dirY, finalDamage, gameTime);
      break;
    case 'W':
      executeWSkill(ctx, hero, aliveEnemies, enemyBases, targetX, targetY, dirX, dirY, finalDamage, gameTime);
      break;
    case 'E':
      executeESkill(ctx, hero, aliveEnemies, targetX, targetY, finalDamage, gameTime);
      break;
  }
}

/**
 * Q 스킬 실행 (기본 공격)
 */
function executeQSkill(
  ctx: SkillContext,
  hero: ServerHero,
  enemies: RPGEnemy[],
  dirX: number,
  dirY: number,
  damage: number,
  gameTime: number
): void {
  const heroClass = hero.heroClass;
  const advancedClass = hero.advancedClass as AdvancedHeroClass | undefined;
  const attackRange = hero.config?.range || CLASS_CONFIGS[heroClass].range;
  const isAoE = heroClass === 'warrior' || heroClass === 'knight' || heroClass === 'mage';
  const isMelee = heroClass === 'warrior' || heroClass === 'knight';
  const attackAngleThreshold = isMelee ? -0.3 : 0.0;

  // 저격수 크리티컬 확률 체크 (50%)
  const critChance = advancedClass === 'sniper'
    ? (ADVANCED_CLASS_CONFIGS.sniper.specialEffects.critChance || 0)
    : 0;
  const isCriticalHit = critChance > 0 && Math.random() < critChance;
  const criticalMultiplier = 2.0;

  // 마법사 보스 데미지 보너스 계산
  // 1. 패시브 성장 (레벨 5: 25% 시작, 레벨당 +1%, 최대 +100%)
  // 2. 대마법사 전직 보너스: x1.5 (곱연산)
  let bossDamageMultiplier = 1.0;
  if (heroClass === 'mage') {
    const passiveBossDamageBonus = hero.passiveGrowth?.currentValue || 0;
    bossDamageMultiplier = 1 + passiveBossDamageBonus;
    // 대마법사 전직 보너스 (곱연산)
    if (advancedClass === 'archmage') {
      bossDamageMultiplier *= 1 + (ADVANCED_CLASS_CONFIGS.archmage.specialEffects.bossBonus || 0);
    }
  }

  // 궁수 멀티타겟 확률 체크
  const isPassiveUnlocked = (hero.characterLevel || 1) >= PASSIVE_UNLOCK_LEVEL;
  const multiTargetChance = heroClass === 'archer' && isPassiveUnlocked
    ? (hero.passiveGrowth?.currentValue || 0)
    : 0;
  const useMultiTarget = multiTargetChance > 0 && Math.random() < multiTargetChance;
  const rangerTargets = advancedClass === 'ranger'
    ? (ADVANCED_CLASS_CONFIGS.ranger.specialEffects.multiTarget || 5)
    : 0;

  const hitEnemies: { id: string; damage: number; isCritical: boolean; x: number; y: number }[] = [];
  const archerTargets: { enemy: RPGEnemy; dist: number }[] = [];

  const attackRangeSq = attackRange * attackRange;
  for (const enemy of enemies) {
    if (enemy.hp <= 0) continue;
    const distToHeroSq = distanceSquared(hero.x, hero.y, enemy.x, enemy.y);
    if (distToHeroSq > attackRangeSq) continue;

    if (distToHeroSq === 0) continue;
    const enemyDx = enemy.x - hero.x;
    const enemyDy = enemy.y - hero.y;
    const enemyDist = Math.sqrt(distToHeroSq);

    const enemyDirX = enemyDx / enemyDist;
    const enemyDirY = enemyDy / enemyDist;
    const dot = dirX * enemyDirX + dirY * enemyDirY;

    if (dot < attackAngleThreshold) continue;

    if (isAoE) {
      let actualDamage = damage;
      if (enemy.type === 'boss' && heroClass === 'mage') {
        actualDamage = Math.floor(damage * bossDamageMultiplier);
      }
      if (isCriticalHit) {
        actualDamage = Math.floor(actualDamage * criticalMultiplier);
      }
      hitEnemies.push({ id: enemy.id, damage: actualDamage, isCritical: isCriticalHit, x: enemy.x, y: enemy.y });
    } else if (heroClass === 'archer') {
      archerTargets.push({ enemy, dist: distToHeroSq });
    }
  }

  // 궁수 타겟 처리
  if (heroClass === 'archer' && archerTargets.length > 0) {
    archerTargets.sort((a, b) => a.dist - b.dist);
    const targetCount = rangerTargets > 0 ? rangerTargets : (useMultiTarget ? 2 : 1);
    const targets = archerTargets.slice(0, targetCount);
    for (const t of targets) {
      let actualDamage = damage;
      if (t.enemy.type === 'boss') {
        actualDamage = Math.floor(damage * bossDamageMultiplier);
      }
      if (isCriticalHit) {
        actualDamage = Math.floor(actualDamage * criticalMultiplier);
      }
      hitEnemies.push({ id: t.enemy.id, damage: actualDamage, isCritical: isCriticalHit, x: t.enemy.x, y: t.enemy.y });
    }
  }

  // 데미지 적용 및 총 데미지 추적
  let totalDamageDealt = 0;
  for (const hit of hitEnemies) {
    applyDamageToEnemyWithCrit(ctx, hit.id, hit.damage, hero, hit.isCritical);
    totalDamageDealt += hit.damage;
  }

  // 기지 데미지 처리
  const { enemyBases } = ctx.state;
  const baseRangeSq = (attackRange + 50) * (attackRange + 50);
  for (const base of enemyBases) {
    if (base.destroyed) continue;
    const baseDistSq = distanceSquared(hero.x, hero.y, base.x, base.y);
    if (baseDistSq > baseRangeSq) continue; // 기지는 크기가 크므로 추가 반경
    if (baseDistSq === 0) continue;

    const baseDx = base.x - hero.x;
    const baseDy = base.y - hero.y;
    const baseDistNorm = Math.sqrt(baseDistSq);

    const baseDirX = baseDx / baseDistNorm;
    const baseDirY = baseDy / baseDistNorm;
    const dot = dirX * baseDirX + dirY * baseDirY;

    // 기지는 방향 조건이 더 관대 (-0.5)
    if (dot < -0.5) continue;

    let baseDamage = damage;
    if (isCriticalHit) {
      baseDamage = Math.floor(baseDamage * criticalMultiplier);
    }

    damageBase(ctx.state, base.id, baseDamage, ctx.difficulty, hero.id);
    totalDamageDealt += baseDamage;
  }

  // 피해흡혈 적용
  if (totalDamageDealt > 0) {
    let totalLifesteal = 0;

    if (heroClass === 'warrior') {
      const passiveLifesteal = isPassiveUnlocked ? (hero.passiveGrowth?.currentValue || 0) : 0;
      totalLifesteal = passiveLifesteal;
      if (advancedClass === 'berserker') {
        totalLifesteal *= ADVANCED_CLASS_CONFIGS.berserker.specialEffects.lifestealMultiplier || 1;
      }
    }

    if (advancedClass === 'darkKnight') {
      totalLifesteal = ADVANCED_CLASS_CONFIGS.darkKnight.specialEffects.lifesteal || 0.2;
    }

    const berserkerBuff = hero.buffs?.find(b => b.type === 'berserker' && b.duration > 0);
    if (berserkerBuff?.lifesteal) {
      totalLifesteal = (1 + totalLifesteal) * (1 + berserkerBuff.lifesteal) - 1;
    }

    if (totalLifesteal > 0) {
      const healAmount = Math.floor(totalDamageDealt * totalLifesteal);
      hero.hp = Math.min(hero.maxHp, hero.hp + healAmount);
      if (healAmount > 0) {
        ctx.state.damageNumbers.push({
          id: generateId(),
          x: hero.x,
          y: hero.y - 40,
          amount: healAmount,
          type: 'heal',
          createdAt: ctx.state.currentTickTimestamp,
        });
      }
    }
  }

  // 팔라딘 기본 공격 힐
  if (advancedClass === 'paladin' && totalDamageDealt > 0) {
    const healConfig = ADVANCED_CLASS_CONFIGS.paladin.specialEffects.basicAttackHeal;
    if (healConfig) {
      const healRange = healConfig.range || 200;
      const healPercent = healConfig.healPercent || 0.05;
      const healAmount = Math.floor(totalDamageDealt * healPercent);
      if (healAmount > 0) {
        for (const [, otherHero] of ctx.state.heroes) {
          if (otherHero.id === hero.id || otherHero.isDead) continue;
          const dist = distance(hero.x, hero.y, otherHero.x, otherHero.y);
          if (dist <= healRange) {
            otherHero.hp = Math.min(otherHero.maxHp, otherHero.hp + healAmount);
            ctx.state.damageNumbers.push({
              id: generateId(),
              x: otherHero.x,
              y: otherHero.y - 40,
              amount: healAmount,
              type: 'heal',
              createdAt: ctx.state.currentTickTimestamp,
            });
          }
        }
      }
    }
  }

  // 기사/가디언/팔라딘: Q 스킬 적중 시 W 스킬 쿨타임 1초 감소 (적중당)
  // - 기본 기사 (knight without advancedClass)
  // - 팔라딘 (knight + paladin)
  // - 가디언 (warrior + guardian)
  // 참고: 다크나이트(darkKnight)는 이 기능이 없음
  const hasWCooldownReduction =
    advancedClass === 'guardian' ||
    advancedClass === 'paladin' ||
    (heroClass === 'knight' && !advancedClass);

  if (hasWCooldownReduction && hitEnemies.length > 0) {
    const cooldownReduction = 1.0 * hitEnemies.length;
    if (hero.skillCooldowns.W > 0) {
      hero.skillCooldowns.W = Math.max(0, hero.skillCooldowns.W - cooldownReduction);
    }
    if (hero._skillW.currentCooldown > 0) {
      hero._skillW.currentCooldown = Math.max(0, hero._skillW.currentCooldown - cooldownReduction);
    }
  }

  // hitTargets 생성 (피격 이펙트용 - 궁수 화살 피격 마커 등)
  const hitTargets = hitEnemies.map(h => ({ x: h.x, y: h.y, damage: h.damage }));

  // 스킬 이펙트 추가
  ctx.state.activeSkillEffects.push({
    type: `${heroClass}_q` as any,
    position: { x: hero.x, y: hero.y },
    direction: { x: dirX, y: dirY },
    radius: isAoE ? attackRange : undefined,
    damage,
    duration: 0.4,
    startTime: gameTime,
    heroClass,
    advancedClass: hero.advancedClass as any,
    hitTargets: hitTargets.length > 0 ? hitTargets : undefined,
  });

  // 쿨다운 시작 - hero.config.attackSpeed 사용 (업그레이드 반영)
  const attackSpeed = hero.config?.attackSpeed ?? hero.baseAttackSpeed ?? 1.0;
  hero.skillCooldowns.Q = attackSpeed;
  hero._skillQ.currentCooldown = attackSpeed;
}

/**
 * W 스킬 실행
 */
function executeWSkill(
  ctx: SkillContext,
  hero: ServerHero,
  enemies: RPGEnemy[],
  enemyBases: ServerEnemyBase[],
  targetX: number,
  targetY: number,
  dirX: number,
  dirY: number,
  damage: number,
  gameTime: number
): void {
  const heroClass = hero.heroClass;
  const advancedClass = hero.advancedClass as AdvancedHeroClass | undefined;

  // 전직 스킬 먼저 확인
  if (advancedClass) {
    const executed = executeAdvancedWSkill(ctx, hero, enemies, targetX, targetY, dirX, dirY, damage, gameTime, advancedClass);
    if (executed) {
      // 캐시된 W 스킬 쿨다운 동기화
      hero._skillW.currentCooldown = hero.skillCooldowns.W;
      return;
    }
  }

  // 기본 직업 스킬
  const damageMultipliers: Record<HeroClass, number> = { warrior: 1.5, archer: 1.8, knight: 0.1, mage: 2.0 };
  const skillDamage = Math.floor(damage * damageMultipliers[heroClass]);

  switch (heroClass) {
    case 'warrior': {
      const dashDistance = 200;
      const dashDuration = 0.25;
      const invincibleDuration = 2.0;

      const newX = clamp(hero.x + dirX * dashDistance, 30, RPG_CONFIG.MAP_WIDTH - 30);
      const newY = clamp(hero.y + dirY * dashDistance, 30, RPG_CONFIG.MAP_HEIGHT - 30);

      for (const enemy of enemies) {
        const enemyDist = pointToLineDistance(enemy.x, enemy.y, hero.x, hero.y, newX, newY);
        if (enemyDist <= 50) {
          applyDamageToEnemy(ctx, enemy.id, skillDamage, hero);
        }
      }

      // 기지 데미지 (경로상 기지)
      for (const base of enemyBases) {
        if (base.destroyed) continue;
        const baseDist = pointToLineDistance(base.x, base.y, hero.x, hero.y, newX, newY);
        if (baseDist <= 80) { // 기지는 더 큰 히트박스
          damageBase(ctx.state, base.id, skillDamage, ctx.difficulty, hero.id);
        }
      }

      hero.dashState = {
        startX: hero.x, startY: hero.y,
        targetX: newX, targetY: newY,
        progress: 0, duration: dashDuration,
        dirX, dirY,
      };

      hero.buffs = hero.buffs || [];
      hero.buffs.push({ type: 'invincible', duration: invincibleDuration, startTime: gameTime });

      ctx.state.activeSkillEffects.push({
        type: 'warrior_w' as any,
        position: { x: hero.x, y: hero.y },
        direction: { x: dirX, y: dirY },
        radius: dashDistance,
        damage: skillDamage,
        duration: 0.4,
        startTime: gameTime,
      });

      hero.skillCooldowns.W = 8.0;
      break;
    }

    case 'archer': {
      const pierceDistance = 300;
      const endX = hero.x + dirX * pierceDistance;
      const endY = hero.y + dirY * pierceDistance;

      for (const enemy of enemies) {
        const enemyDist = pointToLineDistance(enemy.x, enemy.y, hero.x, hero.y, endX, endY);
        if (enemyDist <= 30) {
          applyDamageToEnemy(ctx, enemy.id, skillDamage, hero);
        }
      }

      // 기지 데미지 (관통 화살 경로상 기지)
      for (const base of enemyBases) {
        if (base.destroyed) continue;
        const baseDist = pointToLineDistance(base.x, base.y, hero.x, hero.y, endX, endY);
        if (baseDist <= 60) { // 기지는 더 큰 히트박스
          damageBase(ctx.state, base.id, skillDamage, ctx.difficulty, hero.id);
        }
      }

      ctx.state.activeSkillEffects.push({
        type: 'archer_w' as any,
        position: { x: hero.x, y: hero.y },
        direction: { x: dirX, y: dirY },
        radius: pierceDistance,
        damage: skillDamage,
        duration: 0.4,
        startTime: gameTime,
      });
      hero.skillCooldowns.W = 6.0;
      break;
    }

    case 'knight': {
      const dashDistance = 150;
      const dashDuration = 0.25;
      const stunDuration = 2.0;
      const hpBasedDamage = Math.floor(hero.maxHp * 0.1);

      const newX = clamp(hero.x + dirX * dashDistance, 30, RPG_CONFIG.MAP_WIDTH - 30);
      const newY = clamp(hero.y + dirY * dashDistance, 30, RPG_CONFIG.MAP_HEIGHT - 30);

      for (const enemy of enemies) {
        const enemyDist = pointToLineDistance(enemy.x, enemy.y, hero.x, hero.y, newX, newY);
        if (enemyDist <= 50) {
          applyDamageToEnemy(ctx, enemy.id, hpBasedDamage, hero);
          applyStunToEnemy(ctx.state.enemies, enemy.id, stunDuration, ctx.state.gameTime);
        }
      }

      // 기지 데미지 (경로상 기지)
      for (const base of enemyBases) {
        if (base.destroyed) continue;
        const baseDist = pointToLineDistance(base.x, base.y, hero.x, hero.y, newX, newY);
        if (baseDist <= 80) { // 기지는 더 큰 히트박스
          damageBase(ctx.state, base.id, hpBasedDamage, ctx.difficulty, hero.id);
        }
      }

      hero.dashState = {
        startX: hero.x, startY: hero.y,
        targetX: newX, targetY: newY,
        progress: 0, duration: dashDuration,
        dirX, dirY,
      };

      ctx.state.activeSkillEffects.push({
        type: 'knight_w' as any,
        position: { x: hero.x, y: hero.y },
        direction: { x: dirX, y: dirY },
        radius: dashDistance,
        damage: hpBasedDamage,
        duration: 0.4,
        startTime: gameTime,
      });

      hero.skillCooldowns.W = 10.0;
      break;
    }

    case 'mage': {
      const radius = 80;
      for (const enemy of enemies) {
        const enemyDist = distance(targetX, targetY, enemy.x, enemy.y);
        if (enemyDist <= radius) {
          applyDamageToEnemy(ctx, enemy.id, skillDamage, hero);
        }
      }

      // 기지 데미지 (범위 내 기지)
      for (const base of enemyBases) {
        if (base.destroyed) continue;
        const baseDist = distance(targetX, targetY, base.x, base.y);
        if (baseDist <= radius + 50) { // 기지는 더 큰 히트박스
          damageBase(ctx.state, base.id, skillDamage, ctx.difficulty, hero.id);
        }
      }

      ctx.state.activeSkillEffects.push({
        type: 'mage_w' as any,
        position: { x: targetX, y: targetY },
        direction: { x: dirX, y: dirY },
        radius,
        damage: skillDamage,
        duration: 0.7,
        startTime: gameTime,
      });
      hero.skillCooldowns.W = 5.0;
      break;
    }
  }

  // 캐시된 W 스킬 쿨다운 동기화
  hero._skillW.currentCooldown = hero.skillCooldowns.W;
}

/**
 * E 스킬 실행
 */
function executeESkill(
  ctx: SkillContext,
  hero: ServerHero,
  enemies: RPGEnemy[],
  targetX: number,
  targetY: number,
  damage: number,
  gameTime: number
): void {
  const heroClass = hero.heroClass;
  const advancedClass = hero.advancedClass as AdvancedHeroClass | undefined;

  // 전직 스킬 먼저 확인
  if (advancedClass) {
    const executed = executeAdvancedESkill(ctx, hero, enemies, targetX, targetY, damage, gameTime, advancedClass);
    if (executed) {
      // 캐시된 E 스킬 쿨다운 동기화
      hero._skillE.currentCooldown = hero.skillCooldowns.E;
      return;
    }
  }

  // 기본 직업 스킬
  switch (heroClass) {
    case 'warrior': {
      hero.buffs = hero.buffs || [];
      hero.buffs.push({
        type: 'berserker',
        duration: 10,
        startTime: gameTime,
        attackBonus: 0.5,
        speedBonus: 0.3,
        lifesteal: 0.5,
      });

      ctx.state.activeSkillEffects.push({
        type: 'warrior_e' as any,
        position: { x: hero.x, y: hero.y },
        duration: 1.0,
        startTime: gameTime,
      });

      hero.skillCooldowns.E = 30.0;
      break;
    }

    case 'archer': {
      const radius = 150;
      const skillDamage = Math.floor(damage * 2.5);
      for (const enemy of enemies) {
        const dist = distance(targetX, targetY, enemy.x, enemy.y);
        if (dist <= radius) {
          applyDamageToEnemy(ctx, enemy.id, skillDamage, hero);
        }
      }

      // 기지 데미지 (범위 내 기지)
      const { enemyBases } = ctx.state;
      for (const base of enemyBases) {
        if (base.destroyed) continue;
        const baseDist = distance(targetX, targetY, base.x, base.y);
        if (baseDist <= radius + 50) { // 기지는 더 큰 히트박스
          damageBase(ctx.state, base.id, skillDamage, ctx.difficulty, hero.id);
        }
      }

      ctx.state.activeSkillEffects.push({
        type: 'archer_e' as any,
        position: { x: targetX, y: targetY },
        radius,
        damage: skillDamage,
        duration: 1.0,
        startTime: gameTime,
      });
      hero.skillCooldowns.E = 25.0;
      break;
    }

    case 'knight': {
      // 철벽 방어: 아군 전체 HP 20% 회복 + 5초간 70% 피해 감소
      const healPercent = 0.2;
      const duration = 5;
      const damageReduction = 0.7;

      for (const [, otherHero] of ctx.state.heroes) {
        if (otherHero.isDead) continue;
        const healAmount = Math.floor(otherHero.maxHp * healPercent);
        otherHero.hp = Math.min(otherHero.maxHp, otherHero.hp + healAmount);
        if (healAmount > 0) {
          ctx.state.damageNumbers.push({
            id: generateId(),
            x: otherHero.x, y: otherHero.y - 40,
            amount: healAmount, type: 'heal', createdAt: ctx.state.currentTickTimestamp,
          });
        }
        otherHero.buffs = otherHero.buffs || [];
        otherHero.buffs.push({ type: 'ironwall', duration, startTime: gameTime, damageReduction });
      }

      ctx.state.activeSkillEffects.push({
        type: 'knight_e' as any,
        position: { x: hero.x, y: hero.y },
        duration: 1.0,
        startTime: gameTime,
      });

      hero.skillCooldowns.E = 35.0;
      break;
    }

    case 'mage': {
      const radius = 150;
      const skillDamage = Math.floor(damage * 4.0);
      ctx.state.pendingSkills.push({
        type: 'mage_e' as any,
        position: { x: targetX, y: targetY },
        triggerTime: gameTime + 3.0,
        damage: skillDamage,
        radius,
        casterId: hero.id,
      });
      ctx.state.activeSkillEffects.push({
        type: 'mage_e' as any,
        position: { x: targetX, y: targetY },
        radius,
        damage: 0,
        duration: 3.0,
        startTime: gameTime,
      });
      hero.skillCooldowns.E = 40.0;
      break;
    }
  }

  // 캐시된 E 스킬 쿨다운 동기화
  hero._skillE.currentCooldown = hero.skillCooldowns.E;
}

/**
 * 전직 W 스킬 실행
 */
function executeAdvancedWSkill(
  ctx: SkillContext,
  hero: ServerHero,
  enemies: RPGEnemy[],
  targetX: number,
  targetY: number,
  dirX: number,
  dirY: number,
  damage: number,
  gameTime: number,
  advancedClass: AdvancedHeroClass
): boolean {
  const { state } = ctx;

  switch (advancedClass) {
    case 'berserker': {
      // 피의 돌진: 전방 돌진 + 경로상 적에게 데미지 + 피해량의 50% 체력 회복
      const dashDistance = 200;
      const dashDuration = 0.25;
      const skillDamage = Math.floor(damage * 1.5);
      const lifestealPercent = 0.5;

      const newX = clamp(hero.x + dirX * dashDistance, 30, RPG_CONFIG.MAP_WIDTH - 30);
      const newY = clamp(hero.y + dirY * dashDistance, 30, RPG_CONFIG.MAP_HEIGHT - 30);

      let totalDamageDealt = 0;
      for (const enemy of enemies) {
        const enemyDist = pointToLineDistance(enemy.x, enemy.y, hero.x, hero.y, newX, newY);
        if (enemyDist <= 50) {
          applyDamageToEnemy(ctx, enemy.id, skillDamage, hero);
          totalDamageDealt += skillDamage;
        }
      }

      // 기지 데미지 (경로상 기지)
      for (const base of state.enemyBases) {
        if (base.destroyed) continue;
        const baseDist = pointToLineDistance(base.x, base.y, hero.x, hero.y, newX, newY);
        if (baseDist <= 80) {
          damageBase(state, base.id, skillDamage, ctx.difficulty, hero.id);
          totalDamageDealt += skillDamage;
        }
      }

      // 피해흡혈
      if (totalDamageDealt > 0) {
        const healAmount = Math.floor(totalDamageDealt * lifestealPercent);
        hero.hp = Math.min(hero.maxHp, hero.hp + healAmount);
        if (healAmount > 0) {
          state.damageNumbers.push({
            id: generateId(),
            x: hero.x, y: hero.y - 40,
            amount: healAmount, type: 'heal', createdAt: ctx.state.currentTickTimestamp,
          });
        }
      }

      hero.dashState = {
        startX: hero.x, startY: hero.y,
        targetX: newX, targetY: newY,
        progress: 0, duration: dashDuration,
        dirX, dirY,
      };

      state.activeSkillEffects.push({
        type: 'blood_rush' as any,
        position: { x: hero.x, y: hero.y },
        direction: { x: dirX, y: dirY },
        damage: skillDamage,
        duration: 0.4,
        startTime: gameTime,
      });

      hero.skillCooldowns.W = 6.0;
      return true;
    }

    case 'guardian': {
      // 수호의 돌진: 전방 돌진 + 최대 HP 10% 데미지 + 기절 + 보호막
      const dashDistance = 150;
      const dashDuration = 0.25;
      const hpBasedDamage = Math.floor(hero.maxHp * 0.1);
      const stunDuration = 2.0;
      const shieldPercent = 0.2;
      const shieldDuration = 3.0;

      const newX = clamp(hero.x + dirX * dashDistance, 30, RPG_CONFIG.MAP_WIDTH - 30);
      const newY = clamp(hero.y + dirY * dashDistance, 30, RPG_CONFIG.MAP_HEIGHT - 30);

      for (const enemy of enemies) {
        const enemyDist = pointToLineDistance(enemy.x, enemy.y, hero.x, hero.y, newX, newY);
        if (enemyDist <= 50) {
          applyDamageToEnemy(ctx, enemy.id, hpBasedDamage, hero);
          applyStunToEnemy(state.enemies, enemy.id, stunDuration, gameTime);
        }
      }

      // 기지 데미지 (경로상 기지)
      for (const base of state.enemyBases) {
        if (base.destroyed) continue;
        const baseDist = pointToLineDistance(base.x, base.y, hero.x, hero.y, newX, newY);
        if (baseDist <= 80) {
          damageBase(state, base.id, hpBasedDamage, ctx.difficulty, hero.id);
        }
      }

      hero.dashState = {
        startX: hero.x, startY: hero.y,
        targetX: newX, targetY: newY,
        progress: 0, duration: dashDuration,
        dirX, dirY,
      };

      // 자신과 주변 아군에게 보호막
      hero.buffs = hero.buffs || [];
      hero.buffs.push({ type: 'ironwall', duration: shieldDuration, startTime: gameTime, damageReduction: shieldPercent });

      for (const [, otherHero] of state.heroes) {
        if (otherHero.id === hero.id || otherHero.isDead) continue;
        const dist = distance(hero.x, hero.y, otherHero.x, otherHero.y);
        if (dist <= 200) {
          otherHero.buffs = otherHero.buffs || [];
          otherHero.buffs.push({ type: 'ironwall', duration: shieldDuration, startTime: gameTime, damageReduction: shieldPercent });
        }
      }

      state.activeSkillEffects.push({
        type: 'guardian_rush' as any,
        position: { x: hero.x, y: hero.y },
        direction: { x: dirX, y: dirY },
        radius: dashDistance,
        damage: hpBasedDamage,
        duration: 0.4,
        startTime: gameTime,
      });

      hero.skillCooldowns.W = 8.0;
      return true;
    }

    case 'sniper': {
      // 후방 도약: 뒤로 점프 + 전방에 200% 데미지 화살 발사 + 이동속도 버프
      const jumpDistance = 150;
      const skillDamage = Math.floor(damage * 2.0);
      const speedBuffDuration = 3.0;

      // 뒤로 점프
      const newX = clamp(hero.x - dirX * jumpDistance, 30, RPG_CONFIG.MAP_WIDTH - 30);
      const newY = clamp(hero.y - dirY * jumpDistance, 30, RPG_CONFIG.MAP_HEIGHT - 30);

      hero.dashState = {
        startX: hero.x, startY: hero.y,
        targetX: newX, targetY: newY,
        progress: 0, duration: 0.2,
        dirX: -dirX, dirY: -dirY,
      };

      // 전방에 화살 발사 (가장 가까운 적에게)
      let nearestEnemy: RPGEnemy | null = null;
      let minDistSq = 300 * 300;
      for (const enemy of enemies) {
        if (enemy.hp <= 0) continue;
        const distSq = distanceSquared(hero.x, hero.y, enemy.x, enemy.y);
        if (distSq < minDistSq) {
          minDistSq = distSq;
          nearestEnemy = enemy;
        }
      }
      if (nearestEnemy) {
        applyDamageToEnemy(ctx, nearestEnemy.id, skillDamage, hero);
      }

      // 이동속도 버프
      hero.buffs = hero.buffs || [];
      hero.buffs.push({ type: 'swiftness', duration: speedBuffDuration, startTime: gameTime, moveSpeedBonus: 0.3 });

      state.activeSkillEffects.push({
        type: 'backflip_shot' as any,
        position: { x: hero.x, y: hero.y },
        direction: { x: dirX, y: dirY },
        damage: skillDamage,
        duration: 0.4,
        startTime: gameTime,
      });

      hero.skillCooldowns.W = 5.0;
      return true;
    }

    case 'ranger': {
      // 다중 화살: 부채꼴 방향으로 5발의 관통 화살 발사
      const arrowCount = 5;
      const pierceDistance = 300;
      const skillDamage = Math.floor(damage * 1.0);
      const spreadAngle = Math.PI / 6; // 30도 부채꼴

      // 기지 중복 피해 방지용 Set
      const hitBases = new Set<string>();

      for (let i = 0; i < arrowCount; i++) {
        const angleOffset = (i - (arrowCount - 1) / 2) * (spreadAngle / (arrowCount - 1));
        const arrowDirX = dirX * Math.cos(angleOffset) - dirY * Math.sin(angleOffset);
        const arrowDirY = dirX * Math.sin(angleOffset) + dirY * Math.cos(angleOffset);

        const endX = hero.x + arrowDirX * pierceDistance;
        const endY = hero.y + arrowDirY * pierceDistance;

        for (const enemy of enemies) {
          const enemyDist = pointToLineDistance(enemy.x, enemy.y, hero.x, hero.y, endX, endY);
          if (enemyDist <= 30) {
            applyDamageToEnemy(ctx, enemy.id, skillDamage, hero);
          }
        }

        // 기지 데미지 (경로상 기지, 중복 피해 방지)
        for (const base of state.enemyBases) {
          if (base.destroyed || hitBases.has(base.id)) continue;
          const baseDist = pointToLineDistance(base.x, base.y, hero.x, hero.y, endX, endY);
          if (baseDist <= 60) {
            damageBase(state, base.id, skillDamage, ctx.difficulty, hero.id);
            hitBases.add(base.id);
          }
        }
      }

      state.activeSkillEffects.push({
        type: 'multi_arrow' as any,
        position: { x: hero.x, y: hero.y },
        direction: { x: dirX, y: dirY },
        radius: pierceDistance,
        damage: skillDamage,
        duration: 0.4,
        startTime: gameTime,
      });

      hero.skillCooldowns.W = 5.0;
      return true;
    }

    case 'paladin': {
      // 신성한 돌진: 전방 돌진 + 최대 HP 10% 데미지 + 기절 + 주변 아군 힐
      const dashDistance = 150;
      const dashDuration = 0.25;
      const hpBasedDamage = Math.floor(hero.maxHp * 0.1);
      const stunDuration = 1.5;
      const healRadius = 200;
      const healPercent = 0.1;

      const newX = clamp(hero.x + dirX * dashDistance, 30, RPG_CONFIG.MAP_WIDTH - 30);
      const newY = clamp(hero.y + dirY * dashDistance, 30, RPG_CONFIG.MAP_HEIGHT - 30);

      for (const enemy of enemies) {
        const enemyDist = pointToLineDistance(enemy.x, enemy.y, hero.x, hero.y, newX, newY);
        if (enemyDist <= 50) {
          applyDamageToEnemy(ctx, enemy.id, hpBasedDamage, hero);
          applyStunToEnemy(state.enemies, enemy.id, stunDuration, gameTime);
        }
      }

      // 기지 데미지 (경로상 기지)
      for (const base of state.enemyBases) {
        if (base.destroyed) continue;
        const baseDist = pointToLineDistance(base.x, base.y, hero.x, hero.y, newX, newY);
        if (baseDist <= 80) {
          damageBase(state, base.id, hpBasedDamage, ctx.difficulty, hero.id);
        }
      }

      hero.dashState = {
        startX: hero.x, startY: hero.y,
        targetX: newX, targetY: newY,
        progress: 0, duration: dashDuration,
        dirX, dirY,
      };

      // 주변 아군 힐
      for (const [, otherHero] of state.heroes) {
        if (otherHero.isDead) continue;
        const dist = distance(hero.x, hero.y, otherHero.x, otherHero.y);
        if (dist <= healRadius) {
          const healAmount = Math.floor(otherHero.maxHp * healPercent);
          otherHero.hp = Math.min(otherHero.maxHp, otherHero.hp + healAmount);
          if (healAmount > 0) {
            state.damageNumbers.push({
              id: generateId(),
              x: otherHero.x, y: otherHero.y - 40,
              amount: healAmount, type: 'heal', createdAt: ctx.state.currentTickTimestamp,
            });
          }
        }
      }

      state.activeSkillEffects.push({
        type: 'holy_charge' as any,
        position: { x: hero.x, y: hero.y },
        direction: { x: dirX, y: dirY },
        radius: dashDistance,
        damage: hpBasedDamage,
        duration: 0.4,
        startTime: gameTime,
      });

      hero.skillCooldowns.W = 8.0;
      return true;
    }

    case 'darkKnight': {
      // 강타: 1초 시전 후 전방 120px 범위에 350% 데미지, HP 11% 소모
      const hpCost = Math.floor(hero.maxHp * 0.11);

      // HP가 비용보다 적으면 사용 불가
      if (hero.hp <= hpCost) return false;

      // HP 차감
      hero.hp -= hpCost;

      // 1초 시전 (이동 불가)
      hero.castingUntil = gameTime + 1.0;

      const skillDamage = Math.floor(damage * 3.5);
      const radius = 120;

      // pendingSkill 등록: 1초 후 데미지 발동
      state.pendingSkills.push({
        type: 'heavy_strike' as any,
        position: { x: hero.x, y: hero.y },
        direction: { x: dirX, y: dirY },
        triggerTime: gameTime + 1.0,
        damage: skillDamage,
        radius,
        casterId: hero.id,
        tickCount: 1,
      });

      // 시전 이펙트 (heroId로 영웅 추적)
      state.activeSkillEffects.push({
        type: 'heavy_strike' as any,
        position: { x: hero.x, y: hero.y },
        direction: { x: dirX, y: dirY },
        damage: skillDamage,
        duration: 1.0,
        startTime: gameTime,
        heroId: hero.id,
      });

      hero.skillCooldowns.W = 4.0;
      return true;
    }

    case 'archmage': {
      // 인페르노: 대형 화염구 + 3초간 화상 DoT
      const radius = 120;
      const skillDamage = Math.floor(damage * 2.5);
      const burnDamage = 0.2;  // 초당 20% 데미지
      const burnDuration = 3;  // 3초간 화상

      // 즉발 데미지
      for (const enemy of enemies) {
        const dist = distance(targetX, targetY, enemy.x, enemy.y);
        if (dist <= radius) {
          applyDamageToEnemy(ctx, enemy.id, skillDamage, hero);
        }
      }

      // 기지 데미지 (범위 내 기지)
      for (const base of state.enemyBases) {
        if (base.destroyed) continue;
        const baseDist = distance(targetX, targetY, base.x, base.y);
        if (baseDist <= radius + 50) {
          damageBase(state, base.id, skillDamage, ctx.difficulty, hero.id);
        }
      }

      // 화상 지역 DoT 등록 (3초간 초당 20% 데미지)
      const burnTickDamage = Math.floor(damage * burnDamage);
      state.pendingSkills.push({
        type: 'inferno_burn' as any,
        position: { x: targetX, y: targetY },
        triggerTime: gameTime + 1,  // 1초 후 첫 틱
        damage: burnTickDamage,
        radius,
        casterId: hero.id,
        tickCount: burnDuration,  // 3회 틱
      });

      state.activeSkillEffects.push({
        type: 'inferno' as any,
        position: { x: targetX, y: targetY },
        radius,
        damage: skillDamage,
        duration: 0.5 + burnDuration,  // 폭발 + 화상 지속
        startTime: gameTime,
      });

      hero.skillCooldowns.W = 7.0;
      return true;
    }

    case 'healer': {
      // 치유의 빛: 적에게 데미지 + 아군 HP 회복
      const healRadius = 200;
      const healPercent = 0.15;

      // 범위 내 적에게 데미지
      for (const enemy of enemies) {
        if (enemy.hp <= 0) continue;
        const enemyDist = distance(targetX, targetY, enemy.x, enemy.y);
        if (enemyDist <= healRadius) {
          applyDamageToEnemy(ctx, enemy.id, damage, hero);
        }
      }

      // 기지에 데미지
      for (const base of state.enemyBases) {
        if (base.destroyed) continue;
        const baseDist = distance(targetX, targetY, base.x, base.y);
        if (baseDist <= healRadius + 50) {
          damageBase(state, base.id, damage, ctx.difficulty, hero.id);
        }
      }

      // 자신 포함 범위 내 아군 힐
      for (const [, otherHero] of state.heroes) {
        if (otherHero.isDead) continue;
        const dist = distance(targetX, targetY, otherHero.x, otherHero.y);
        if (dist <= healRadius) {
          const healAmount = Math.floor(otherHero.maxHp * healPercent);
          otherHero.hp = Math.min(otherHero.maxHp, otherHero.hp + healAmount);
          if (healAmount > 0) {
            state.damageNumbers.push({
              id: generateId(),
              x: otherHero.x, y: otherHero.y - 40,
              amount: healAmount, type: 'heal', createdAt: ctx.state.currentTickTimestamp,
            });
          }
        }
      }

      state.activeSkillEffects.push({
        type: 'healing_light' as any,
        position: { x: targetX, y: targetY },  // 타겟 위치 사용
        radius: healRadius,
        duration: 0.5,
        startTime: gameTime,
      });

      hero.skillCooldowns.W = 7.0;
      return true;
    }

    default:
      return false;
  }
}

/**
 * 전직 E 스킬 실행
 */
function executeAdvancedESkill(
  ctx: SkillContext,
  hero: ServerHero,
  enemies: RPGEnemy[],
  targetX: number,
  targetY: number,
  damage: number,
  gameTime: number,
  advancedClass: AdvancedHeroClass
): boolean {
  const { state } = ctx;

  switch (advancedClass) {
    case 'berserker': {
      // 광란: 10초간 공격력/공속 100% 증가 + 50% 피해흡혈 + 받는 피해 50% 증가
      hero.buffs = hero.buffs || [];
      hero.buffs.push({
        type: 'berserker',
        duration: 10,
        startTime: gameTime,
        attackBonus: 1.0,
        speedBonus: 1.0,
        lifesteal: 0.5,
        damageTaken: 0.5,
      });

      state.activeSkillEffects.push({
        type: 'rage' as any,  // 클라이언트 렌더러와 일치
        position: { x: hero.x, y: hero.y },
        duration: 1.0,
        startTime: gameTime,
      });

      hero.skillCooldowns.E = 45.0;
      return true;
    }

    case 'guardian': {
      // 보호막: 아군 전체에게 5초간 받는 피해 50% 감소
      const duration = 5.0;
      const damageReduction = 0.5;

      for (const [, otherHero] of state.heroes) {
        if (otherHero.isDead) continue;
        otherHero.buffs = otherHero.buffs || [];
        otherHero.buffs.push({ type: 'ironwall', duration, startTime: gameTime, damageReduction });
      }

      state.activeSkillEffects.push({
        type: 'shield' as any,  // 클라이언트 렌더러와 일치
        position: { x: hero.x, y: hero.y },
        radius: 500,
        duration: 1.0,
        startTime: gameTime,
      });

      hero.skillCooldowns.E = 40.0;
      return true;
    }

    case 'sniper': {
      // 저격: 마우스 위치의 적에게 1000% 데미지 (캐스팅 없이 즉시, 무제한 사거리)
      const skillDamage = Math.floor(damage * 10.0);

      // 타겟 위치에서 가장 가까운 적 찾기 (무제한 사거리)
      let targetEnemy: RPGEnemy | null = null;
      let minDist = Infinity;
      for (const enemy of enemies) {
        if (enemy.hp <= 0) continue;
        const dist = distance(targetX, targetY, enemy.x, enemy.y);
        if (dist < minDist) {
          minDist = dist;
          targetEnemy = enemy;
        }
      }

      if (targetEnemy) {
        applyDamageToEnemy(ctx, targetEnemy.id, skillDamage, hero);
        state.activeSkillEffects.push({
          type: 'snipe' as any,  // 클라이언트 렌더러와 일치
          position: { x: hero.x, y: hero.y },  // 영웅 위치에서 시작
          targetPosition: { x: targetEnemy.x, y: targetEnemy.y },  // 타겟 위치 추가
          damage: skillDamage,
          duration: 0.5,
          startTime: gameTime,
        });
      }

      hero.skillCooldowns.E = 30.0;
      return true;
    }

    case 'ranger': {
      // 화살 폭풍: 6초간 공격 속도 2배
      hero.buffs = hero.buffs || [];
      hero.buffs.push({
        type: 'berserker',
        duration: 6,
        startTime: gameTime,
        speedBonus: 1.0, // 2배 = 기본 + 100%
      });

      state.activeSkillEffects.push({
        type: 'arrow_storm' as any,  // 클라이언트 렌더러와 일치
        position: { x: hero.x, y: hero.y },
        duration: 1.0,
        startTime: gameTime,
      });

      hero.skillCooldowns.E = 35.0;
      return true;
    }

    case 'paladin': {
      // 신성한 빛: 아군 전체 HP 30% 회복 + 3초 무적
      const healPercent = 0.3;
      const invincibleDuration = 3.0;

      for (const [, otherHero] of state.heroes) {
        if (otherHero.isDead) continue;
        const healAmount = Math.floor(otherHero.maxHp * healPercent);
        otherHero.hp = Math.min(otherHero.maxHp, otherHero.hp + healAmount);
        if (healAmount > 0) {
          state.damageNumbers.push({
            id: generateId(),
            x: otherHero.x, y: otherHero.y - 40,
            amount: healAmount, type: 'heal', createdAt: ctx.state.currentTickTimestamp,
          });
        }
        otherHero.buffs = otherHero.buffs || [];
        otherHero.buffs.push({ type: 'invincible', duration: invincibleDuration, startTime: gameTime });
      }

      state.activeSkillEffects.push({
        type: 'divine_light' as any,  // 클라이언트 렌더러와 일치
        position: { x: hero.x, y: hero.y },
        radius: 500,
        duration: 1.0,
        startTime: gameTime,
      });

      hero.skillCooldowns.E = 60.0;
      return true;
    }

    case 'darkKnight': {
      // 어둠의 칼날 (토글): 온/오프 전환
      if (hero.darkBladeActive) {
        // 비활성화
        hero.darkBladeActive = false;
        hero.darkBladeLastToggleOff = gameTime;
        hero.skillCooldowns.E = 2.0;  // 재사용 딜레이

        // dark_blade 이펙트 제거
        for (let i = state.activeSkillEffects.length - 1; i >= 0; i--) {
          const eff = state.activeSkillEffects[i];
          if (eff.type === 'dark_blade' && eff.heroId === hero.id) {
            state.activeSkillEffects.splice(i, 1);
          }
        }

        // dark_blade pendingSkills 제거
        for (let i = state.pendingSkills.length - 1; i >= 0; i--) {
          const ps = state.pendingSkills[i];
          if (ps.type === 'dark_blade' && ps.casterId === hero.id) {
            state.pendingSkills.splice(i, 1);
          }
        }

        return true;
      } else {
        // 활성화 조건 체크
        const isStunned = hero.buffs?.some(b => b.type === 'stun' && b.duration > 0);
        if (isStunned) return false;
        if (hero.hp <= hero.maxHp * 0.1) return false;

        // 재사용 딜레이 체크 (lastToggleOff + 2초)
        if (hero.darkBladeLastToggleOff && (gameTime - hero.darkBladeLastToggleOff) < 2.0) return false;

        // 활성화
        hero.darkBladeActive = true;
        hero.darkBladeTickTimer = 0;
        hero.skillCooldowns.E = 0;  // 토글이므로 즉시 재사용 가능

        // 지속 이펙트 (무한 지속, heroId로 캐릭터 따라다님)
        state.activeSkillEffects.push({
          type: 'dark_blade' as any,
          position: { x: hero.x, y: hero.y },
          radius: 150,
          damage: 0,
          duration: 9999,
          startTime: gameTime,
          heroId: hero.id,
        });

        return true;
      }
    }

    case 'archmage': {
      // 메테오 샤워: 5초간 랜덤 위치에 운석 10개 낙하
      const duration = 5;
      const meteorCount = 10;
      const meteorDamage = Math.floor(damage * 3.0);
      const meteorRadius = 100;
      const areaRadius = 300;  // 운석 낙하 범위

      // 첫 번째 운석 즉시 낙하
      for (const enemy of enemies) {
        const dist = distance(targetX, targetY, enemy.x, enemy.y);
        if (dist <= meteorRadius) {
          applyDamageToEnemy(ctx, enemy.id, meteorDamage, hero);
        }
      }

      for (const base of state.enemyBases) {
        if (base.destroyed) continue;
        const baseDist = distance(targetX, targetY, base.x, base.y);
        if (baseDist <= meteorRadius + 50) {
          damageBase(state, base.id, meteorDamage, ctx.difficulty, hero.id);
        }
      }

      // 나머지 운석을 pendingSkill로 등록
      state.pendingSkills.push({
        type: 'meteor_shower' as any,
        position: { x: targetX, y: targetY },
        triggerTime: gameTime + duration / meteorCount,  // 균등 간격
        damage: meteorDamage,
        radius: meteorRadius,
        casterId: hero.id,
        meteorCount: meteorCount - 1,  // 남은 운석 수
        duration,
        areaRadius,  // 운석 낙하 범위 저장
      });

      // 전체 범위 표시 이펙트
      state.activeSkillEffects.push({
        type: 'meteor_shower' as any,
        position: { x: targetX, y: targetY },
        radius: areaRadius,
        damage: meteorDamage,
        duration: duration,
        startTime: gameTime,
      });

      hero.skillCooldowns.E = 50.0;
      return true;
    }

    case 'healer': {
      // 생명의 샘: 10초간 시전 범위 내 아군 초당 최대 HP의 10% 회복
      const duration = 10;
      const healPerTick = 0.10;  // 초당 10%
      const radius = 500;
      const skillX = hero.x;
      const skillY = hero.y;

      // 첫 틱 즉시 적용 (범위 내 아군만)
      for (const [, otherHero] of state.heroes) {
        if (otherHero.isDead) continue;
        const dist = distance(skillX, skillY, otherHero.x, otherHero.y);
        if (dist > radius) continue;  // 범위 밖이면 스킵
        const healAmount = Math.floor(otherHero.maxHp * healPerTick);
        otherHero.hp = Math.min(otherHero.maxHp, otherHero.hp + healAmount);
        if (healAmount > 0) {
          state.damageNumbers.push({
            id: generateId(),
            x: otherHero.x, y: otherHero.y - 40,
            amount: healAmount, type: 'heal', createdAt: ctx.state.currentTickTimestamp,
          });
        }
      }

      // 나머지 틱은 pendingSkill로 처리 (이펙트 위치 고정)
      state.pendingSkills.push({
        type: 'spring_of_life' as any,
        position: { x: skillX, y: skillY },  // 시전 위치 고정
        triggerTime: gameTime + 1,  // 1초 후 다음 틱
        damage: 0,
        radius,
        casterId: hero.id,
        healPercent: healPerTick,
        duration,
        tickCount: duration - 1,  // 첫 틱 제외한 나머지
      });

      state.activeSkillEffects.push({
        type: 'spring_of_life' as any,
        position: { x: skillX, y: skillY },
        radius,
        duration: duration,  // 10초간 이펙트 유지
        startTime: gameTime,
        heroId: hero.id,  // 힐러를 따라다니도록 heroId 추가
      });

      hero.skillCooldowns.E = 45.0;
      return true;
    }

    default:
      return false;
  }
}

/**
 * 적에게 데미지 적용 (크리티컬 지원)
 */
export function applyDamageToEnemyWithCrit(
  ctx: SkillContext,
  enemyId: string,
  damage: number,
  attacker?: ServerHero,
  isCritical: boolean = false
): void {
  const enemy = ctx.state.enemies.find(e => e.id === enemyId);
  if (!enemy || enemy.hp <= 0) return;

  enemy.hp -= damage;

  ctx.state.damageNumbers.push({
    id: generateId(),
    x: enemy.x,
    y: enemy.y - 20,
    amount: damage,
    type: isCritical ? 'critical' : 'damage',
    createdAt: ctx.state.currentTickTimestamp,
  });

  if (attacker && !enemy.aggroOnHero) {
    enemy.aggroOnHero = true;
    enemy.targetHeroId = attacker.id;
    enemy.aggroExpireTime = ctx.state.gameTime + 5;
  }

  if (enemy.type === 'boss' && attacker && enemy.damagedBy) {
    if (!enemy.damagedBy.includes(attacker.id)) {
      enemy.damagedBy.push(attacker.id);
    }
  }

  if (enemy.hp <= 0) {
    ctx.onEnemyDeath(enemy, attacker);
  }
}

/**
 * 적에게 데미지 적용
 */
export function applyDamageToEnemy(
  ctx: SkillContext,
  enemyId: string,
  damage: number,
  attacker?: ServerHero
): void {
  applyDamageToEnemyWithCrit(ctx, enemyId, damage, attacker, false);
}

/**
 * 적에게 스턴 적용
 */
export function applyStunToEnemy(enemies: RPGEnemy[], enemyId: string, duration: number, gameTime: number): void {
  const enemy = enemies.find(e => e.id === enemyId);
  if (!enemy) return;

  enemy.buffs = enemy.buffs || [];
  enemy.buffs = enemy.buffs.filter(b => b.type !== 'stun');
  enemy.buffs.push({ type: 'stun', duration, startTime: gameTime });
  enemy.state = 'idle';
}

/**
 * 스킬 이펙트 업데이트
 */
export function updateSkillEffects(state: ServerGameState, deltaTime: number): void {
  // 지속시간이 끝난 이펙트 제거
  state.activeSkillEffects = state.activeSkillEffects.filter(
    effect => state.gameTime < effect.startTime + effect.duration
  );
}

/**
 * 지연 스킬 처리
 */
export function updatePendingSkills(ctx: SkillContext): void {
  const { state } = ctx;
  const triggeredSkillIndices: number[] = [];
  const skillsToAdd: PendingSkill[] = [];

  state.pendingSkills.forEach((skill, index) => {
    if (state.gameTime >= skill.triggerTime) {
      triggeredSkillIndices.push(index);

      // 힐러 생명의 샘: 범위 내 아군 힐
      if (skill.healPercent && skill.healPercent > 0) {
        for (const [, otherHero] of state.heroes) {
          if (otherHero.isDead) continue;
          const dist = distance(skill.position.x, skill.position.y, otherHero.x, otherHero.y);
          if (dist > skill.radius) continue;  // 범위 밖이면 스킵
          const healAmount = Math.floor(otherHero.maxHp * skill.healPercent);
          otherHero.hp = Math.min(otherHero.maxHp, otherHero.hp + healAmount);
          if (healAmount > 0) {
            state.damageNumbers.push({
              id: generateId(),
              x: otherHero.x, y: otherHero.y - 40,
              amount: healAmount, type: 'heal', createdAt: ctx.state.currentTickTimestamp,
            });
          }
        }
      } else if (skill.type === 'heavy_strike') {
        // 강타: 캐스터 전방 방향으로 부채꼴 데미지 (±45도, 120px)
        const caster = skill.casterId ? state.heroes.get(skill.casterId) : undefined;
        const hitX = caster ? caster.x : skill.position.x;
        const hitY = caster ? caster.y : skill.position.y;
        const dir = skill.direction || { x: 1, y: 0 };
        const dirAngle = Math.atan2(dir.y, dir.x);
        const halfAngle = Math.PI / 4; // ±45도 (총 90도 부채꼴)

        // 전방 부채꼴 내 적에게 데미지
        for (const enemy of state.enemies) {
          if (enemy.hp <= 0) continue;
          const dist = distance(hitX, hitY, enemy.x, enemy.y);
          if (dist > skill.radius) continue;
          const enemyAngle = Math.atan2(enemy.y - hitY, enemy.x - hitX);
          let angleDiff = Math.abs(enemyAngle - dirAngle);
          if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
          if (angleDiff <= halfAngle) {
            applyDamageToEnemy(ctx, enemy.id, skill.damage, caster);
          }
        }

        // 전방 부채꼴 내 기지에 데미지
        for (const base of state.enemyBases) {
          if (base.destroyed) continue;
          const baseDist = distance(hitX, hitY, base.x, base.y);
          if (baseDist > skill.radius + 50) continue;
          const baseAngle = Math.atan2(base.y - hitY, base.x - hitX);
          let baseAngleDiff = Math.abs(baseAngle - dirAngle);
          if (baseAngleDiff > Math.PI) baseAngleDiff = 2 * Math.PI - baseAngleDiff;
          if (baseAngleDiff <= halfAngle) {
            damageBase(state, base.id, skill.damage, ctx.difficulty, skill.casterId);
          }
        }

        // 충격파 이펙트 (전방 방향 정보 포함)
        state.activeSkillEffects.push({
          type: 'heavy_strike_impact' as any,
          position: { x: hitX, y: hitY },
          direction: { x: dir.x, y: dir.y },
          radius: skill.radius,
          damage: skill.damage,
          duration: 0.5,
          startTime: state.gameTime,
        });
      } else {
        // 범위 내 적에게 데미지
        for (const enemy of state.enemies) {
          if (enemy.hp <= 0) continue;
          const dist = distance(skill.position.x, skill.position.y, enemy.x, enemy.y);
          if (dist <= skill.radius) {
            const caster = skill.casterId ? state.heroes.get(skill.casterId) : undefined;
            applyDamageToEnemy(ctx, enemy.id, skill.damage, caster);
          }
        }

        // 범위 내 기지에 데미지
        for (const base of state.enemyBases) {
          if (base.destroyed) continue;
          const baseDist = distance(skill.position.x, skill.position.y, base.x, base.y);
          if (baseDist <= skill.radius + 50) {
            damageBase(state, base.id, skill.damage, ctx.difficulty, skill.casterId);
          }
        }

        // 실행 이펙트 추가 (힐 스킬, dark_blade는 메인 이펙트가 유지되므로 제외)
        if (skill.type !== 'dark_blade') {
          state.activeSkillEffects.push({
            type: skill.type,
            position: skill.position,
            radius: skill.radius,
            damage: skill.damage,
            duration: 0.5,
            startTime: state.gameTime,
          });
        }
      }

      // 틱 스킬 재등록 (화상, 힐러 생명의 샘 등)
      if (skill.tickCount && skill.tickCount > 1) {
        if (skill.type === 'inferno_burn') {
          // 화상 지역은 고정 위치
          skillsToAdd.push({
            ...skill,
            triggerTime: state.gameTime + 1,  // 1초 후 다음 틱
            tickCount: skill.tickCount - 1,
          });
        } else if (skill.type === 'spring_of_life') {
          // 생명의 샘: 힐러를 따라다님 (힐러에게 고정)
          const casterHero = skill.casterId ? state.heroes.get(skill.casterId) : undefined;
          if (casterHero && !casterHero.isDead) {
            skillsToAdd.push({
              ...skill,
              position: { x: casterHero.x, y: casterHero.y },  // 힐러 위치로 업데이트
              triggerTime: state.gameTime + 1,
              tickCount: skill.tickCount - 1,
            });
          }
        } else {
          // 다른 틱 스킬은 캐스터를 따라다님
          const casterHero = skill.casterId ? state.heroes.get(skill.casterId) : undefined;
          if (casterHero && !casterHero.isDead) {
            skillsToAdd.push({
              ...skill,
              position: { x: casterHero.x, y: casterHero.y },
              triggerTime: state.gameTime + 1,
              tickCount: skill.tickCount - 1,
            });
          }
        }
      }

      // 메테오 샤워 연속 낙하
      if (skill.meteorCount && skill.meteorCount > 0 && skill.duration) {
        const areaRadius = skill.areaRadius || 300;
        const randomX = skill.position.x + (Math.random() - 0.5) * areaRadius * 2;
        const randomY = skill.position.y + (Math.random() - 0.5) * areaRadius * 2;
        const interval = skill.duration / (skill.meteorCount + 1);

        skillsToAdd.push({
          ...skill,
          position: { x: randomX, y: randomY },
          triggerTime: state.gameTime + interval,
          meteorCount: skill.meteorCount - 1,
        });
      }
    }
  });

  // 처리된 스킬 제거 (역순으로 제거)
  for (let i = triggeredSkillIndices.length - 1; i >= 0; i--) {
    state.pendingSkills.splice(triggeredSkillIndices[i], 1);
  }

  // 재등록할 스킬 추가
  state.pendingSkills.push(...skillsToAdd);
}
