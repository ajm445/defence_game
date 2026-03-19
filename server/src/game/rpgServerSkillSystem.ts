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
import { isBossType } from '../utils/bossUtils';

export interface SkillContext {
  state: ServerGameState;
  difficulty: RPGDifficulty;
  onEnemyDeath: (enemy: RPGEnemy, attacker?: ServerHero) => void;
}

/**
 * 스킬 타겟 최대 사거리 (hero 위치로부터)
 * Q: 기본 공격 → hero.config.range 사용 (별도 검증 불필요, 내부에서 체크)
 * W/E: 방향 기반 스킬은 검증 불필요, 타겟 위치 기반 스킬만 검증
 * 저격수 E는 무제한 사거리 (보스 전용) → 예외
 */
const MAX_SKILL_TARGET_DISTANCE = 1000; // px (화면 대각선 ~800px + 여유)

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

  // 스킬 타겟 사거리 검증 (W/E 스킬 중 targetX/targetY를 영역 중심으로 사용하는 경우)
  // Q스킬은 내부에서 attackRange 체크, 방향 기반 스킬은 dirX/dirY만 사용하므로 영향 없음
  if (skillSlot !== 'Q') {
    const advClass = hero.advancedClass as string | undefined;
    // 저격수 E는 무제한 사거리 (보스 전용 스킬) → 예외
    const isUnlimitedRange = skillSlot === 'E' && advClass === 'sniper';
    if (!isUnlimitedRange) {
      const dx = targetX - hero.x;
      const dy = targetY - hero.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > MAX_SKILL_TARGET_DISTANCE * MAX_SKILL_TARGET_DISTANCE) {
        return;
      }
    }
  }

  // 스킬 쿨다운 체크 (캐시된 직접 참조 사용)
  const skill = skillSlot === 'Q' ? hero._skillQ : skillSlot === 'W' ? hero._skillW : hero._skillE;

  // 쿨다운 허용 오차: ~3프레임 (서버 틱 순서 + 클라이언트-서버 타이밍 차이 보정)
  const COOLDOWN_TOLERANCE = 0.05;
  if (skill.currentCooldown > COOLDOWN_TOLERANCE) {
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
      // 즉발 W스킬: dashState/castingUntil 없으면 모션 동안 기본공격 잠금
      if (!hero.dashState && !(hero.castingUntil && gameTime < hero.castingUntil)) {
        hero.attackLockUntil = gameTime + 0.67; // W모션 재생시간 (4프레임 / 6fps)
      }
      break;
    case 'E':
      executeESkill(ctx, hero, aliveEnemies, targetX, targetY, finalDamage, gameTime);
      // 즉발 E스킬: dashState/castingUntil 없으면 모션 동안 기본공격 잠금
      if (!hero.dashState && !(hero.castingUntil && gameTime < hero.castingUntil)) {
        hero.attackLockUntil = gameTime + 0.8; // E모션 재생시간 (4프레임 / 5fps)
      }
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

  // 다크나이트 기본공격: 프레임2 종료 시점에 데미지 (attackSpeed * 0.39 딜레이)
  // ATTACK_FRAME_WEIGHTS [0.10, 0.55, 0.65, 1.0], animTime = attackSpeed * 0.6
  // → 프레임2 끝 = 0.65 * animTime = attackSpeed * 0.39
  if (advancedClass === 'darkKnight') {
    const attackSpeed = hero.config?.attackSpeed || 1.0;
    const delay = Math.max(0.15, attackSpeed * 0.39);
    ctx.state.pendingSkills.push({
      type: 'darkKnight_q' as any,
      position: { x: hero.x, y: hero.y },
      direction: { x: dirX, y: dirY },
      triggerTime: gameTime + delay,
      damage,
      radius: attackRange,
      casterId: hero.id,
    });
    // 이펙트는 pendingSkill 핸들러에서 데미지와 동시에 생성 (싱크 일치)
    // 쿨다운 시작
    hero.skillCooldowns.Q = attackSpeed;
    hero._skillQ.currentCooldown = attackSpeed;
    return;
  }

  // 아크메이지 기본공격: 3번 프레임(index 2) 시작 시점에 데미지
  // 기본 가중치 [0.15, 0.30, 0.70, 1.0], animTime = attackSpeed * 0.6
  // → 프레임2 시작 = 0.30 * animTime = attackSpeed * 0.18
  if ((advancedClass as string) === 'archmage') {
    const attackSpeed = hero.config?.attackSpeed || 1.5;
    const delay = Math.max(0.15, attackSpeed * 0.18);
    ctx.state.pendingSkills.push({
      type: 'archmage_q' as any,
      position: { x: hero.x, y: hero.y },
      direction: { x: dirX, y: dirY },
      triggerTime: gameTime + delay,
      damage,
      radius: attackRange,
      casterId: hero.id,
    });
    hero.skillCooldowns.Q = attackSpeed;
    hero._skillQ.currentCooldown = attackSpeed;
    return;
  }

  // 힐러 기본공격: 3번 프레임(index 2) 직후에 데미지
  // 기본 가중치 [0.15, 0.30, 0.70, 1.0], animTime = attackSpeed * 0.6
  // → 프레임2 끝 = 0.70 * animTime = attackSpeed * 0.42
  if ((advancedClass as string) === 'healer') {
    const attackSpeed = hero.config?.attackSpeed || 1.5;
    const delay = Math.max(0.15, attackSpeed * 0.42);
    ctx.state.pendingSkills.push({
      type: 'healer_q' as any,
      position: { x: hero.x, y: hero.y },
      direction: { x: dirX, y: dirY },
      triggerTime: gameTime + delay,
      damage,
      radius: attackRange,
      casterId: hero.id,
    });
    hero.skillCooldowns.Q = attackSpeed;
    hero._skillQ.currentCooldown = attackSpeed;
    return;
  }

  // 저격수 크리티컬 확률 체크 (50%)
  const critChance = advancedClass === 'sniper'
    ? (ADVANCED_CLASS_CONFIGS.sniper.specialEffects.critChance || 0)
    : 0;
  const isCriticalHit = critChance > 0 && Math.random() < critChance;

  // 저격수 패시브 전환: 다중타겟 → 공격력 증가
  if (advancedClass === 'sniper' && hero.passiveGrowth?.currentValue > 0) {
    const sniperAttackBonus = hero.passiveGrowth.currentValue;
    damage = Math.floor(damage * (1 + sniperAttackBonus));
  }
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

  // 궁수 멀티타겟 확률 체크 (저격수 전직 시 패시브 전환 → 멀티타겟 비활성)
  const isPassiveUnlocked = (hero.characterLevel || 1) >= PASSIVE_UNLOCK_LEVEL;
  const isSniperClass = advancedClass === 'sniper';
  const multiTargetChance = heroClass === 'archer' && isPassiveUnlocked && !isSniperClass
    ? (hero.passiveGrowth?.currentValue || 0)
    : 0;
  const useMultiTarget = multiTargetChance > 0 && Math.random() < multiTargetChance;
  // 궁수: 3타겟, 레인저: 5타겟
  const maxMultiTargets = advancedClass === 'ranger'
    ? (ADVANCED_CLASS_CONFIGS.ranger.specialEffects.multiTarget || 5)
    : 3;

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
      if (isBossType(enemy.type) && heroClass === 'mage') {
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
    const targetCount = useMultiTarget ? maxMultiTargets : 1;
    const targets = archerTargets.slice(0, targetCount);
    for (const t of targets) {
      let actualDamage = damage;
      if (isBossType(t.enemy.type)) {
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

  // 기지 데미지 처리 (적을 타격하지 않았을 때만 - 기지는 대체 타겟)
  if (hitEnemies.length === 0) {
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

    // 다크나이트 피해흡혈은 darkKnight_q pendingSkill에서 처리

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

  // 팔라딘 기본 공격 힐 (자신 최대 HP의 일정% 회복)
  if (advancedClass === 'paladin' && totalDamageDealt > 0) {
    const healConfig = ADVANCED_CLASS_CONFIGS.paladin.specialEffects.basicAttackHeal;
    if (healConfig) {
      const healRange = healConfig.range || 200;
      const healPercent = healConfig.healPercent || 0.02;
      const healAmount = Math.floor(hero.maxHp * healPercent);
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
        heroClass: hero.heroClass, advancedClass: hero.advancedClass as any,
        position: { x: hero.x, y: hero.y },
        direction: { x: dirX, y: dirY },
        radius: dashDistance,
        damage: skillDamage,
        duration: 0.4,
        startTime: gameTime,
      });

      hero.skillCooldowns.W = hero._skillW.cooldown;
      break;
    }

    case 'archer': {
      // 모션 Frame 3(발사) 타이밍에 맞춰 지연 실행 (6fps, frame index 2 = 0.33초)
      const pierceDistance = 300;
      ctx.state.pendingSkills.push({
        type: 'archer_w' as any,
        position: { x: hero.x, y: hero.y },
        direction: { x: dirX, y: dirY },
        triggerTime: gameTime + 0.33,
        radius: pierceDistance,
        damage: skillDamage,
        duration: 0.4,
        casterId: hero.id,
      });
      hero.skillCooldowns.W = hero._skillW.cooldown;
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
        heroClass: hero.heroClass, advancedClass: hero.advancedClass as any,
        position: { x: hero.x, y: hero.y },
        direction: { x: dirX, y: dirY },
        radius: dashDistance,
        damage: hpBasedDamage,
        duration: 0.4,
        startTime: gameTime,
      });

      hero.skillCooldowns.W = hero._skillW.cooldown;
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
        heroClass: hero.heroClass, advancedClass: hero.advancedClass as any,
        position: { x: targetX, y: targetY },
        direction: { x: dirX, y: dirY },
        radius,
        damage: skillDamage,
        duration: 0.7,
        startTime: gameTime,
      });
      hero.skillCooldowns.W = hero._skillW.cooldown;
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
      const buffDuration = 10;
      hero.buffs = hero.buffs || [];
      hero.buffs.push({
        type: 'berserker',
        duration: buffDuration,
        startTime: gameTime,
        attackBonus: 0.5,
        speedBonus: 0.3,
        lifesteal: 0.5,
      });

      ctx.state.activeSkillEffects.push({
        type: 'warrior_e' as any,
        heroClass: hero.heroClass, advancedClass: hero.advancedClass as any,
        position: { x: hero.x, y: hero.y },
        duration: 1.0,
        startTime: gameTime,
        heroId: hero.id,
      });

      // 버프 종료 후 쿨다운 시작: 지속시간 + 실제 쿨다운
      hero.skillCooldowns.E = buffDuration + hero._skillE.cooldown;
      break;
    }

    case 'archer': {
      // 모션 종료 후 화살비 발동 (5fps × 4프레임 = 0.8초 후)
      const radius = 150;
      const skillDamage = Math.floor(damage * 2.5);
      ctx.state.pendingSkills.push({
        type: 'archer_e' as any,
        position: { x: targetX, y: targetY },
        triggerTime: gameTime + 0.6, // Frame 3(일제 발사) 종료 시점 (3프레임 / 5fps)
        damage: skillDamage,
        radius,
        casterId: hero.id,
      });
      hero.skillCooldowns.E = hero._skillE.cooldown;
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
        heroClass: hero.heroClass, advancedClass: hero.advancedClass as any,
        position: { x: hero.x, y: hero.y },
        duration: 1.0,
        startTime: gameTime,
        heroId: hero.id,
      });

      hero.skillCooldowns.E = hero._skillE.cooldown;
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
        heroClass: hero.heroClass, advancedClass: hero.advancedClass as any,
        position: { x: targetX, y: targetY },
        radius,
        damage: 0,
        duration: 3.0,
        startTime: gameTime,
      });
      hero.skillCooldowns.E = hero._skillE.cooldown;
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
        heroClass: hero.heroClass, advancedClass: hero.advancedClass as any,
        position: { x: hero.x, y: hero.y },
        direction: { x: dirX, y: dirY },
        damage: skillDamage,
        duration: 0.4,
        startTime: gameTime,
      });

      hero.skillCooldowns.W = hero._skillW.cooldown;
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
        heroClass: hero.heroClass, advancedClass: hero.advancedClass as any,
        position: { x: hero.x, y: hero.y },
        direction: { x: dirX, y: dirY },
        radius: dashDistance,
        damage: hpBasedDamage,
        duration: 0.4,
        startTime: gameTime,
      });

      hero.skillCooldowns.W = hero._skillW.cooldown;
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

      // 전방에 화살 발사 (전방 60도 범위 내 모든 적)
      const arrowRange = hero.config?.range || 200;
      for (const enemy of enemies) {
        if (enemy.hp <= 0) continue;
        const enemyDist = distance(hero.x, hero.y, enemy.x, enemy.y);
        if (enemyDist > arrowRange) continue;
        const enemyDx = enemy.x - hero.x;
        const enemyDy = enemy.y - hero.y;
        const enemyDirDist = Math.sqrt(enemyDx * enemyDx + enemyDy * enemyDy);
        if (enemyDirDist === 0) continue;
        const dot = (dirX * enemyDx + dirY * enemyDy) / enemyDirDist;
        if (dot > 0.3) {
          applyDamageToEnemy(ctx, enemy.id, skillDamage, hero);
        }
      }

      // 전방 기지에 데미지
      for (const base of state.enemyBases) {
        if (base.destroyed) continue;
        const baseDist = distance(hero.x, hero.y, base.x, base.y);
        if (baseDist > arrowRange) continue;
        const baseDx = base.x - hero.x;
        const baseDy = base.y - hero.y;
        const baseDirDist = Math.sqrt(baseDx * baseDx + baseDy * baseDy);
        if (baseDirDist === 0) continue;
        const dot = (dirX * baseDx + dirY * baseDy) / baseDirDist;
        if (dot > 0.3) {
          damageBase(state, base.id, skillDamage, ctx.difficulty, hero.id);
        }
      }

      // 이동속도 버프
      hero.buffs = hero.buffs || [];
      hero.buffs.push({ type: 'swiftness', duration: speedBuffDuration, startTime: gameTime, moveSpeedBonus: 0.3 });

      state.activeSkillEffects.push({
        type: 'backflip_shot' as any,
        heroClass: hero.heroClass, advancedClass: hero.advancedClass as any,
        position: { x: hero.x, y: hero.y },
        direction: { x: dirX, y: dirY },
        damage: skillDamage,
        duration: 0.4,
        startTime: gameTime,
        heroId: hero.id,
      });

      hero.skillCooldowns.W = hero._skillW.cooldown;
      return true;
    }

    case 'ranger': {
      // 다중 화살: 모션 Frame 3(발사) 타이밍에 맞춰 지연 실행 (0.33초)
      const pierceDistance = 300;
      const skillDamage = Math.floor(damage * 1.0);

      ctx.state.pendingSkills.push({
        type: 'ranger_w' as any,
        position: { x: hero.x, y: hero.y },
        direction: { x: dirX, y: dirY },
        triggerTime: gameTime + 0.33,
        radius: pierceDistance,
        damage: skillDamage,
        duration: 0.4,
        casterId: hero.id,
      });

      hero.skillCooldowns.W = hero._skillW.cooldown;
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

      // 주변 아군 힐 (아군 최대 HP 기준)
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
        heroClass: hero.heroClass, advancedClass: hero.advancedClass as any,
        position: { x: hero.x, y: hero.y },
        direction: { x: dirX, y: dirY },
        radius: dashDistance,
        damage: hpBasedDamage,
        duration: 0.4,
        startTime: gameTime,
      });

      hero.skillCooldowns.W = hero._skillW.cooldown;
      return true;
    }

    case 'darkKnight': {
      // 강타: 1초 시전 후 전방 150px 범위에 350% 데미지, HP 20% 소모
      const hpCost = Math.floor(hero.maxHp * 0.20);

      // HP가 비용보다 적으면 사용 불가 (true 반환으로 기본 스킬 폴백 방지)
      if (hero.hp <= hpCost) return true;

      // HP 차감
      hero.hp -= hpCost;

      // 1초 시전 (이동 불가)
      hero.castingUntil = gameTime + 1.0;

      const skillDamage = Math.floor(damage * 3.5);
      const radius = 150;

      // pendingSkill 등록: 프레임3(0.6초)에서 데미지 발동
      state.pendingSkills.push({
        type: 'heavy_strike' as any,
        position: { x: hero.x, y: hero.y },
        direction: { x: dirX, y: dirY },
        triggerTime: gameTime + 0.6,
        damage: skillDamage,
        radius,
        casterId: hero.id,
        tickCount: 1,
      });

      // 시전 이펙트 (heroId로 영웅 추적)
      state.activeSkillEffects.push({
        type: 'heavy_strike' as any,
        heroClass: hero.heroClass, advancedClass: hero.advancedClass as any,
        position: { x: hero.x, y: hero.y },
        direction: { x: dirX, y: dirY },
        damage: skillDamage,
        duration: 1.0,
        startTime: gameTime,
        heroId: hero.id,
      });

      hero.skillCooldowns.W = hero._skillW.cooldown;
      return true;
    }

    case 'archmage': {
      // 인페르노: 대형 화염구 + 3초간 화상 DoT
      // 3번 프레임(index 2) 시작 시점에 폭발 데미지
      // W 모션: fps 6, 4프레임, totalAnimTime = 0.667s
      // → 프레임2 시작 = 2/4 * 0.667 = 0.333s
      const infernoDelay = 0.333;
      const radius = 120;
      const skillDamage = Math.floor(damage * 2.5);
      const burnDamage = 0.2;  // 초당 20% 데미지
      const burnDuration = 3;  // 3초간 화상
      const burnTickDamage = Math.floor(damage * burnDamage);

      // pendingSkill로 딜레이 후 폭발 데미지 + 이펙트 + 화상 DoT 등록
      state.pendingSkills.push({
        type: 'archmage_w_inferno' as any,
        position: { x: targetX, y: targetY },
        triggerTime: gameTime + infernoDelay,
        damage: skillDamage,
        radius,
        casterId: hero.id,
        burnTickDamage,
        burnDuration,
      });

      hero.skillCooldowns.W = hero._skillW.cooldown;
      return true;
    }

    case 'healer': {
      // 치유의 빛: 적에게 데미지 + 아군 HP 회복
      // 3번 프레임(index 2) 시작 시점에 발동
      // W 모션: fps 6, 4프레임, totalAnimTime = 0.667s
      // → 프레임2 시작 = 2/4 * 0.667 = 0.333s
      const healerWDelay = 0.333;

      state.pendingSkills.push({
        type: 'healer_w' as any,
        position: { x: targetX, y: targetY },
        triggerTime: gameTime + healerWDelay,
        damage,
        radius: 150,
        casterId: hero.id,
        healPercent: 0.15,
      });

      hero.skillCooldowns.W = hero._skillW.cooldown;
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
      // 광란: 10초간 공격력/공속 80% 증가 + 받는 피해 50% 증가
      const buffDuration = 10;
      hero.buffs = hero.buffs || [];
      hero.buffs.push({
        type: 'berserker',
        duration: buffDuration,
        startTime: gameTime,
        attackBonus: 0.8,
        speedBonus: 0.8,
        damageTaken: 0.5,
      });

      state.activeSkillEffects.push({
        type: 'rage' as any,  // 클라이언트 렌더러와 일치
        heroClass: hero.heroClass, advancedClass: hero.advancedClass as any,
        position: { x: hero.x, y: hero.y },
        duration: 1.0,
        startTime: gameTime,
        heroId: hero.id,
      });

      // 버프 종료 후 쿨다운 시작: 지속시간 + 실제 쿨다운
      hero.skillCooldowns.E = buffDuration + hero._skillE.cooldown;
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
        heroClass: hero.heroClass, advancedClass: hero.advancedClass as any,
        position: { x: hero.x, y: hero.y },
        radius: 500,
        duration: 1.0,
        startTime: gameTime,
        heroId: hero.id,
      });

      hero.skillCooldowns.E = hero._skillE.cooldown;
      return true;
    }

    case 'sniper': {
      // 저격: 3초 조준 후 타겟에게 1000% 데미지 (무제한 사거리)
      const chargeTime = 3.0;
      const skillDamage = Math.floor(damage * 10.0);

      // 타겟팅: 마우스 위치 기준 가장 가까운 보스 (보스만 타겟 가능, 무제한 사거리)
      let targetEnemy: RPGEnemy | null = null;
      let closestBossDist = Infinity;

      for (const enemy of enemies) {
        if (enemy.hp <= 0) continue;
        if (!isBossType(enemy.type)) continue;  // 보스만 타겟 가능
        const dist = distance(targetX, targetY, enemy.x, enemy.y);
        if (dist < closestBossDist) {
          closestBossDist = dist;
          targetEnemy = enemy;
        }
      }

      if (!targetEnemy) return false;

      // 3초 시전 (이동/공격 불가)
      hero.castingUntil = gameTime + chargeTime;

      // pendingSkill 등록: 3초 후 데미지 발동
      state.pendingSkills.push({
        type: 'snipe' as any,
        position: { x: hero.x, y: hero.y },
        triggerTime: gameTime + chargeTime,
        damage: skillDamage,
        radius: 0,
        casterId: hero.id,
        targetId: targetEnemy.id,
      });

      // 시전 이펙트 (조준선 표시, heroId로 영웅 추적, targetId로 타겟 추적)
      state.activeSkillEffects.push({
        type: 'snipe' as any,
        heroClass: hero.heroClass, advancedClass: hero.advancedClass as any,
        position: { x: hero.x, y: hero.y },
        targetPosition: { x: targetEnemy.x, y: targetEnemy.y },
        damage: skillDamage,
        duration: chargeTime,
        startTime: gameTime,
        heroId: hero.id,
        targetId: targetEnemy.id,
      });

      hero.skillCooldowns.E = hero._skillE.cooldown;
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
        heroClass: hero.heroClass, advancedClass: hero.advancedClass as any,
        position: { x: hero.x, y: hero.y },
        duration: 1.0,
        startTime: gameTime,
        heroId: hero.id,
      });

      hero.skillCooldowns.E = hero._skillE.cooldown;
      return true;
    }

    case 'paladin': {
      // 신성한 빛: 3번째 프레임(0.4초)에서 발동 → pendingSkill
      const healAmount = Math.floor(hero.maxHp * 0.2);
      const triggerDelay = 0.4; // 프레임3 시작 시점

      state.pendingSkills.push({
        type: 'paladin_e' as any,
        position: { x: hero.x, y: hero.y },
        triggerTime: gameTime + triggerDelay,
        radius: 500,
        damage: 0,
        casterId: hero.id,
        healPercent: 0, // 커스텀 처리 (자신 HP 기반)
      });

      // 시전 모션 유지 (0.8초)
      hero.castingUntil = gameTime + 0.8;
      hero.skillCooldowns.E = hero._skillE.cooldown;
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
        // 활성화 조건 체크 (true 반환으로 기본 스킬 폴백 방지)
        const isStunned = hero.buffs?.some(b => b.type === 'stun' && b.duration > 0);
        if (isStunned) return true;
        if (hero.hp <= hero.maxHp * 0.1) return true;

        // 재사용 딜레이 체크 (lastToggleOff + 2초)
        if (hero.darkBladeLastToggleOff && (gameTime - hero.darkBladeLastToggleOff) < 2.0) return true;

        // 활성화
        hero.darkBladeActive = true;
        hero.darkBladeTickTimer = 0;
        hero.skillCooldowns.E = 0;  // 토글이므로 즉시 재사용 가능
        hero.castingUntil = gameTime + 0.8;  // ON 모션 재생 (0.8초)

        // 지속 이펙트 (무한 지속, heroId로 캐릭터 따라다님)
        state.activeSkillEffects.push({
          type: 'dark_blade' as any,
          heroClass: hero.heroClass, advancedClass: hero.advancedClass as any,
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
        heroClass: hero.heroClass, advancedClass: hero.advancedClass as any,
        position: { x: targetX, y: targetY },
        radius: areaRadius,
        damage: meteorDamage,
        duration: duration,
        startTime: gameTime,
      });

      hero.skillCooldowns.E = hero._skillE.cooldown;
      return true;
    }

    case 'healer': {
      // 생명의 샘: 10초간 시전 범위 내 아군 초당 최대 HP의 10% 회복
      // 3번 프레임(index 2) 시작 시점에 발동
      // E 모션: fps 5, 4프레임, totalAnimTime = 0.8s
      // → 프레임2 시작 = 2/4 * 0.8 = 0.4s
      const healerEDelay = 0.4;

      state.pendingSkills.push({
        type: 'healer_e' as any,
        position: { x: hero.x, y: hero.y },
        triggerTime: gameTime + healerEDelay,
        damage: 0,
        radius: 500,
        casterId: hero.id,
        healPercent: 0.10,
        duration: 10,
      });

      hero.skillCooldowns.E = hero._skillE.cooldown;
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

  if (isBossType(enemy.type) && attacker && enemy.damagedBy) {
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

      // 힐러 W/E: 전용 핸들러 (healPercent 범용 처리보다 먼저 체크)
      if (skill.type === 'healer_w' || skill.type === 'healer_e') {
        // healer_w, healer_e는 아래 else if 체인에서 처리
      }
      // 힐러 생명의 샘 틱 등: 범위 내 아군 힐 (healPercent 범용 처리)
      else if (skill.healPercent && skill.healPercent > 0) {
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
      }

      if (skill.type === 'healer_w') {
        // 힐러 W: 치유의 빛 — 적 데미지 + 아군 힐 (프레임 싱크)
        const caster = skill.casterId ? state.heroes.get(skill.casterId) : undefined;
        if (caster && !caster.isDead) {
          const healRadius = skill.radius || 150;
          const healPercent = skill.healPercent || 0.15;

          for (const enemy of state.enemies) {
            if (enemy.hp <= 0) continue;
            const enemyDist = distance(skill.position.x, skill.position.y, enemy.x, enemy.y);
            if (enemyDist <= healRadius) {
              applyDamageToEnemy(ctx, enemy.id, skill.damage, caster);
            }
          }

          for (const base of state.enemyBases) {
            if (base.destroyed) continue;
            const baseDist = distance(skill.position.x, skill.position.y, base.x, base.y);
            if (baseDist <= healRadius + 50) {
              damageBase(state, base.id, skill.damage, ctx.difficulty, caster.id);
            }
          }

          for (const [, otherHero] of state.heroes) {
            if (otherHero.isDead) continue;
            const dist = distance(skill.position.x, skill.position.y, otherHero.x, otherHero.y);
            if (dist <= healRadius) {
              const healAmount = Math.floor(otherHero.maxHp * healPercent);
              otherHero.hp = Math.min(otherHero.maxHp, otherHero.hp + healAmount);
              if (healAmount > 0) {
                state.damageNumbers.push({
                  id: generateId(),
                  x: otherHero.x, y: otherHero.y - 40,
                  amount: healAmount, type: 'heal', createdAt: state.currentTickTimestamp,
                });
              }
            }
          }

          state.activeSkillEffects.push({
            type: 'healing_light' as any,
            heroClass: caster.heroClass, advancedClass: caster.advancedClass as any,
            position: { x: skill.position.x, y: skill.position.y },
            radius: healRadius,
            duration: 0.5,
            startTime: state.gameTime,
          });
        }
      } else if (skill.type === 'healer_e') {
        // 힐러 E: 생명의 샘 — 첫 틱 힐 + 지속 틱 등록 + 이펙트 (프레임 싱크)
        const caster = skill.casterId ? state.heroes.get(skill.casterId) : undefined;
        if (caster && !caster.isDead) {
          const springRadius = skill.radius || 500;
          const healPerTick = skill.healPercent || 0.10;
          const springDuration = skill.duration || 10;

          // 첫 틱 즉시 적용
          for (const [, otherHero] of state.heroes) {
            if (otherHero.isDead) continue;
            const dist = distance(caster.x, caster.y, otherHero.x, otherHero.y);
            if (dist > springRadius) continue;
            const healAmount = Math.floor(otherHero.maxHp * healPerTick);
            otherHero.hp = Math.min(otherHero.maxHp, otherHero.hp + healAmount);
            if (healAmount > 0) {
              state.damageNumbers.push({
                id: generateId(),
                x: otherHero.x, y: otherHero.y - 40,
                amount: healAmount, type: 'heal', createdAt: state.currentTickTimestamp,
              });
            }
          }

          // 나머지 틱 등록
          state.pendingSkills.push({
            type: 'spring_of_life' as any,
            position: { x: caster.x, y: caster.y },
            triggerTime: state.gameTime + 1,
            damage: 0,
            radius: springRadius,
            casterId: caster.id,
            healPercent: healPerTick,
            duration: springDuration,
            tickCount: springDuration - 1,
          });

          // 이펙트
          state.activeSkillEffects.push({
            type: 'spring_of_life' as any,
            heroClass: caster.heroClass, advancedClass: caster.advancedClass as any,
            position: { x: caster.x, y: caster.y },
            radius: springRadius,
            duration: springDuration,
            startTime: state.gameTime,
            heroId: caster.id,
          });
        }
      } else if (skill.type === 'heavy_strike') {
        // 강타: 캐스터 전방 직선 범위 데미지 (길이 150px, 폭 ±40px)
        const caster = skill.casterId ? state.heroes.get(skill.casterId) : undefined;
        const hitX = caster ? caster.x : skill.position.x;
        const hitY = caster ? caster.y : skill.position.y;
        const dir = skill.direction || { x: 1, y: 0 };
        const dirLen = Math.sqrt(dir.x * dir.x + dir.y * dir.y) || 1;
        const nx = dir.x / dirLen; // 정규화된 방향 벡터
        const ny = dir.y / dirLen;
        const lineLength = skill.radius; // 120px
        const lineHalfWidth = 40; // 폭 ±40px

        // 직선 범위 내 적에게 데미지
        for (const enemy of state.enemies) {
          if (enemy.hp <= 0) continue;
          const dx = enemy.x - hitX;
          const dy = enemy.y - hitY;
          // 방향 벡터에 대한 투영 (전방 거리)
          const forward = dx * nx + dy * ny;
          if (forward < 0 || forward > lineLength) continue;
          // 방향 벡터에 대한 수직 거리 (좌우 폭)
          const lateral = Math.abs(dx * (-ny) + dy * nx);
          if (lateral <= lineHalfWidth) {
            applyDamageToEnemy(ctx, enemy.id, skill.damage, caster);
          }
        }

        // 직선 범위 내 기지에 데미지
        for (const base of state.enemyBases) {
          if (base.destroyed) continue;
          const dx = base.x - hitX;
          const dy = base.y - hitY;
          const forward = dx * nx + dy * ny;
          if (forward < -50 || forward > lineLength + 50) continue;
          const lateral = Math.abs(dx * (-ny) + dy * nx);
          if (lateral <= lineHalfWidth + 50) {
            damageBase(state, base.id, skill.damage, ctx.difficulty, skill.casterId);
          }
        }

        // 충격파 이펙트 (전방 방향 정보 포함)
        state.activeSkillEffects.push({
          type: 'heavy_strike_impact' as any,
          heroClass: caster?.heroClass, advancedClass: caster?.advancedClass as any,
          position: { x: hitX, y: hitY },
          direction: { x: dir.x, y: dir.y },
          radius: skill.radius,
          damage: skill.damage,
          duration: 0.5,
          startTime: state.gameTime,
        });
      } else if (skill.type === 'archer_w') {
        // 관통 화살: 시전자 위치에서 방향으로 300px 직선 관통
        const caster = skill.casterId ? state.heroes.get(skill.casterId) : undefined;
        const shootX = caster ? caster.x : skill.position.x;
        const shootY = caster ? caster.y : skill.position.y;
        const dir = skill.direction || { x: 1, y: 0 };
        const pierceDistance = skill.radius || 300;
        const endX = shootX + dir.x * pierceDistance;
        const endY = shootY + dir.y * pierceDistance;

        for (const enemy of state.enemies) {
          if (enemy.hp <= 0) continue;
          const enemyDist = pointToLineDistance(enemy.x, enemy.y, shootX, shootY, endX, endY);
          if (enemyDist <= 30) {
            applyDamageToEnemy(ctx, enemy.id, skill.damage, caster);
          }
        }

        for (const base of state.enemyBases) {
          if (base.destroyed) continue;
          const baseDist = pointToLineDistance(base.x, base.y, shootX, shootY, endX, endY);
          if (baseDist <= 60) {
            damageBase(state, base.id, skill.damage, ctx.difficulty, skill.casterId);
          }
        }

        state.activeSkillEffects.push({
          type: 'archer_w' as any,
          heroClass: caster?.heroClass, advancedClass: caster?.advancedClass as any,
          position: { x: shootX, y: shootY },
          direction: { x: dir.x, y: dir.y },
          radius: pierceDistance,
          damage: skill.damage,
          duration: 0.4,
          startTime: state.gameTime,
          heroId: skill.casterId,
        });
      } else if (skill.type === 'ranger_w') {
        // 다중 화살: 부채꼴 방향으로 5발의 관통 화살 발사
        const caster = skill.casterId ? state.heroes.get(skill.casterId) : undefined;
        const shootX = caster ? caster.x : skill.position.x;
        const shootY = caster ? caster.y : skill.position.y;
        const dir = skill.direction || { x: 1, y: 0 };
        const pierceDistance = skill.radius || 300;
        const arrowCount = 5;
        const spreadAngle = Math.PI / 4; // 45도 부채꼴
        const hitBases = new Set<string>();

        for (let i = 0; i < arrowCount; i++) {
          const angleOffset = (i - (arrowCount - 1) / 2) * (spreadAngle / (arrowCount - 1));
          const arrowDirX = dir.x * Math.cos(angleOffset) - dir.y * Math.sin(angleOffset);
          const arrowDirY = dir.x * Math.sin(angleOffset) + dir.y * Math.cos(angleOffset);

          const endX = shootX + arrowDirX * pierceDistance;
          const endY = shootY + arrowDirY * pierceDistance;

          for (const enemy of state.enemies) {
            if (enemy.hp <= 0) continue;
            const enemyDist = pointToLineDistance(enemy.x, enemy.y, shootX, shootY, endX, endY);
            if (enemyDist <= 30) {
              applyDamageToEnemy(ctx, enemy.id, skill.damage, caster);
            }
          }

          for (const base of state.enemyBases) {
            if (base.destroyed || hitBases.has(base.id)) continue;
            const baseDist = pointToLineDistance(base.x, base.y, shootX, shootY, endX, endY);
            if (baseDist <= 60) {
              damageBase(state, base.id, skill.damage, ctx.difficulty, skill.casterId);
              hitBases.add(base.id);
            }
          }
        }

        state.activeSkillEffects.push({
          type: 'multi_arrow' as any,
          heroClass: caster?.heroClass, advancedClass: caster?.advancedClass as any,
          position: { x: shootX, y: shootY },
          direction: { x: dir.x, y: dir.y },
          radius: pierceDistance,
          damage: skill.damage,
          duration: 0.4,
          startTime: state.gameTime,
          heroId: skill.casterId,
        });
      } else if (skill.type === 'darkKnight_q') {
        // 다크나이트 기본공격: 근접 AoE + 피해흡혈 + 이펙트 동시 생성
        const caster = skill.casterId ? state.heroes.get(skill.casterId) : undefined;
        if (caster && !caster.isDead) {
          const atkRange = skill.radius || 80;
          const atkRangeSq = atkRange * atkRange;
          const dir = skill.direction || { x: 1, y: 0 };
          let totalDmg = 0;
          const hitTargets: { x: number; y: number; damage: number }[] = [];

          for (const enemy of state.enemies) {
            if (enemy.hp <= 0) continue;
            const dSq = distanceSquared(caster.x, caster.y, enemy.x, enemy.y);
            if (dSq > atkRangeSq || dSq === 0) continue;
            const eDist = Math.sqrt(dSq);
            const dot = ((enemy.x - caster.x) / eDist) * dir.x + ((enemy.y - caster.y) / eDist) * dir.y;
            if (dot < -0.3) continue;
            applyDamageToEnemy(ctx, enemy.id, skill.damage, caster);
            hitTargets.push({ x: enemy.x, y: enemy.y, damage: skill.damage });
            totalDmg += skill.damage;
          }

          // 적 미타격 시 기지 공격
          if (totalDmg === 0) {
            const baseRangeSq = (atkRange + 50) * (atkRange + 50);
            for (const base of state.enemyBases) {
              if (base.destroyed) continue;
              const bSq = distanceSquared(caster.x, caster.y, base.x, base.y);
              if (bSq > baseRangeSq || bSq === 0) continue;
              const bDist = Math.sqrt(bSq);
              const dot = ((base.x - caster.x) / bDist) * dir.x + ((base.y - caster.y) / bDist) * dir.y;
              if (dot < -0.5) continue;
              damageBase(state, base.id, skill.damage, ctx.difficulty, caster.id);
              totalDmg += skill.damage;
            }
          }

          // 베기 이펙트 (데미지와 동일 틱에 생성 → 싱크 일치)
          state.activeSkillEffects.push({
            type: 'warrior_q' as any,
            position: { x: caster.x, y: caster.y },
            direction: { x: dir.x, y: dir.y },
            radius: atkRange,
            damage: skill.damage,
            duration: 0.4,
            startTime: state.gameTime,
            heroClass: caster.heroClass,
            advancedClass: 'darkKnight' as any,
            hitTargets: hitTargets.length > 0 ? hitTargets : undefined,
          });

          // 타격 사운드 이펙트 (데미지와 동일 틱 → 사운드 싱크 일치)
          const targetPos = hitTargets.length > 0
            ? hitTargets[0]
            : { x: caster.x + dir.x * atkRange, y: caster.y + dir.y * atkRange };
          state.basicAttackEffects.push({
            id: `hero_attack_${state.currentTickTimestamp}_${caster.id}`,
            type: 'melee',
            x: targetPos.x,
            y: targetPos.y,
            timestamp: state.currentTickTimestamp,
            advancedClass: 'darkKnight',
          });

          // 다크나이트 피해흡혈 (20%)
          if (totalDmg > 0) {
            const lifestealRate = ADVANCED_CLASS_CONFIGS.darkKnight.specialEffects.lifesteal || 0.2;
            const berserkerBuff = caster.buffs?.find(b => b.type === 'berserker' && b.duration > 0);
            let totalLifesteal = lifestealRate;
            if (berserkerBuff?.lifesteal) {
              totalLifesteal = (1 + totalLifesteal) * (1 + berserkerBuff.lifesteal) - 1;
            }
            const healAmt = Math.floor(totalDmg * totalLifesteal);
            if (healAmt > 0) {
              caster.hp = Math.min(caster.maxHp, caster.hp + healAmt);
              state.damageNumbers.push({
                id: generateId(),
                x: caster.x, y: caster.y - 40,
                amount: healAmt, type: 'heal', createdAt: state.currentTickTimestamp,
              });
            }
          }
        }
      } else if (skill.type === 'archmage_q') {
        // 아크메이지 기본공격: 마법 AoE (프레임 싱크)
        const caster = skill.casterId ? state.heroes.get(skill.casterId) : undefined;
        if (caster && !caster.isDead) {
          const atkRange = skill.radius || 160;
          const atkRangeSq = atkRange * atkRange;
          const dir = skill.direction || { x: -1, y: 0 };

          // 마법사 보스 데미지 보너스
          let bossDamageMultiplier = 1.0;
          const passiveBossDamageBonus = caster.passiveGrowth?.currentValue || 0;
          bossDamageMultiplier = 1 + passiveBossDamageBonus;
          bossDamageMultiplier *= 1 + (ADVANCED_CLASS_CONFIGS.archmage.specialEffects.bossBonus || 0);

          let hitAny = false;
          for (const enemy of state.enemies) {
            if (enemy.hp <= 0) continue;
            const dSq = distanceSquared(caster.x, caster.y, enemy.x, enemy.y);
            if (dSq > atkRangeSq || dSq === 0) continue;
            const eDist = Math.sqrt(dSq);
            const dot = ((enemy.x - caster.x) / eDist) * dir.x + ((enemy.y - caster.y) / eDist) * dir.y;
            if (dot < 0.0) continue;
            let actualDamage = skill.damage;
            if (isBossType(enemy.type)) {
              actualDamage = Math.floor(skill.damage * bossDamageMultiplier);
            }
            applyDamageToEnemy(ctx, enemy.id, actualDamage, caster);
            hitAny = true;
          }

          // 적 미타격 시 기지 공격
          if (!hitAny) {
            const baseRangeSq = (atkRange + 50) * (atkRange + 50);
            for (const base of state.enemyBases) {
              if (base.destroyed) continue;
              const bSq = distanceSquared(caster.x, caster.y, base.x, base.y);
              if (bSq > baseRangeSq) continue;
              damageBase(state, base.id, skill.damage, ctx.difficulty, caster.id);
            }
          }

          // 이펙트 (데미지와 동시) - basicAttackEffect (사운드/파티클)
          state.basicAttackEffects.push({
            id: `hero_attack_${state.currentTickTimestamp}_${caster.id}`,
            type: 'ranged',
            x: caster.x + dir.x * atkRange * 0.5,
            y: caster.y + dir.y * atkRange * 0.5,
            timestamp: state.currentTickTimestamp,
            advancedClass: 'archmage',
          });

          // mage_q activeSkillEffect (마법 화살 렌더링)
          state.activeSkillEffects.push({
            type: 'mage_q' as any,
            position: { x: caster.x, y: caster.y },
            direction: { x: dir.x, y: dir.y },
            radius: atkRange,
            damage: skill.damage,
            duration: 0.4,
            startTime: state.gameTime,
            heroClass: caster.heroClass,
            advancedClass: 'archmage' as any,
          });
        }
      } else if (skill.type === 'archmage_w_inferno') {
        // 아크메이지 인페르노: 폭발 데미지 + 화상 DoT (프레임 싱크)
        const caster = skill.casterId ? state.heroes.get(skill.casterId) : undefined;
        if (caster && !caster.isDead) {
          const infernoRadius = skill.radius || 120;

          // 폭발 데미지
          for (const enemy of state.enemies) {
            if (enemy.hp <= 0) continue;
            const dist = distance(skill.position.x, skill.position.y, enemy.x, enemy.y);
            if (dist <= infernoRadius) {
              applyDamageToEnemy(ctx, enemy.id, skill.damage, caster);
            }
          }

          // 기지 데미지
          for (const base of state.enemyBases) {
            if (base.destroyed) continue;
            const baseDist = distance(skill.position.x, skill.position.y, base.x, base.y);
            if (baseDist <= infernoRadius + 50) {
              damageBase(state, base.id, skill.damage, ctx.difficulty, caster.id);
            }
          }

          // 화상 DoT 등록
          if (skill.burnTickDamage && skill.burnDuration) {
            state.pendingSkills.push({
              type: 'inferno_burn' as any,
              position: { x: skill.position.x, y: skill.position.y },
              triggerTime: state.gameTime + 1,
              damage: skill.burnTickDamage,
              radius: infernoRadius,
              casterId: caster.id,
              tickCount: skill.burnDuration,
            });
          }

          // 폭발 이펙트 (데미지와 동시)
          state.activeSkillEffects.push({
            type: 'inferno' as any,
            heroClass: caster.heroClass, advancedClass: caster.advancedClass as any,
            position: { x: skill.position.x, y: skill.position.y },
            radius: infernoRadius,
            damage: skill.damage,
            duration: 0.5 + (skill.burnDuration || 3),
            startTime: state.gameTime,
          });
        }
      } else if (skill.type === 'healer_q') {
        // 힐러 기본공격: 마법 AoE (프레임 싱크 — 3번 프레임 직후)
        const caster = skill.casterId ? state.heroes.get(skill.casterId) : undefined;
        if (caster && !caster.isDead) {
          const atkRange = skill.radius || 160;
          const atkRangeSq = atkRange * atkRange;
          const dir = skill.direction || { x: -1, y: 0 };

          // 마법사 보스 데미지 보너스 (힐러는 archmage 전직 보너스 없음)
          let bossDamageMultiplier = 1.0;
          const passiveBossDamageBonus = caster.passiveGrowth?.currentValue || 0;
          bossDamageMultiplier = 1 + passiveBossDamageBonus;

          let hitAny = false;
          for (const enemy of state.enemies) {
            if (enemy.hp <= 0) continue;
            const dSq = distanceSquared(caster.x, caster.y, enemy.x, enemy.y);
            if (dSq > atkRangeSq || dSq === 0) continue;
            const eDist = Math.sqrt(dSq);
            const dot = ((enemy.x - caster.x) / eDist) * dir.x + ((enemy.y - caster.y) / eDist) * dir.y;
            if (dot < 0.0) continue;
            let actualDamage = skill.damage;
            if (isBossType(enemy.type)) {
              actualDamage = Math.floor(skill.damage * bossDamageMultiplier);
            }
            applyDamageToEnemy(ctx, enemy.id, actualDamage, caster);
            hitAny = true;
          }

          if (!hitAny) {
            const baseRangeSq = (atkRange + 50) * (atkRange + 50);
            for (const base of state.enemyBases) {
              if (base.destroyed) continue;
              const bSq = distanceSquared(caster.x, caster.y, base.x, base.y);
              if (bSq > baseRangeSq) continue;
              damageBase(state, base.id, skill.damage, ctx.difficulty, caster.id);
            }
          }

          // basicAttackEffect (사운드/파티클)
          state.basicAttackEffects.push({
            id: `hero_attack_${state.currentTickTimestamp}_${caster.id}`,
            type: 'ranged',
            x: caster.x + dir.x * atkRange * 0.5,
            y: caster.y + dir.y * atkRange * 0.5,
            timestamp: state.currentTickTimestamp,
            advancedClass: 'healer',
          });

          // mage_q activeSkillEffect (마법 화살 렌더링)
          state.activeSkillEffects.push({
            type: 'mage_q' as any,
            position: { x: caster.x, y: caster.y },
            direction: { x: dir.x, y: dir.y },
            radius: atkRange,
            damage: skill.damage,
            duration: 0.4,
            startTime: state.gameTime,
            heroClass: caster.heroClass,
            advancedClass: 'healer' as any,
          });
        }
      } else if (skill.type === 'paladin_e') {
        // 팔라딘 E: 자신 최대 HP의 20%를 아군 전체에 회복 + 3초 무적
        const caster = skill.casterId ? state.heroes.get(skill.casterId) : undefined;
        if (caster && !caster.isDead) {
          const paladinHealAmount = Math.floor(caster.maxHp * 0.2);
          const invincibleDuration = 3.0;

          for (const [, otherHero] of state.heroes) {
            if (otherHero.isDead) continue;
            otherHero.hp = Math.min(otherHero.maxHp, otherHero.hp + paladinHealAmount);
            if (paladinHealAmount > 0) {
              state.damageNumbers.push({
                id: generateId(),
                x: otherHero.x, y: otherHero.y - 40,
                amount: paladinHealAmount, type: 'heal', createdAt: ctx.state.currentTickTimestamp,
              });
            }
            otherHero.buffs = otherHero.buffs || [];
            otherHero.buffs.push({ type: 'invincible', duration: invincibleDuration, startTime: state.gameTime });
          }

          state.activeSkillEffects.push({
            type: 'divine_light' as any,
            heroClass: caster.heroClass, advancedClass: caster.advancedClass as any,
            position: { x: caster.x, y: caster.y },
            radius: 500,
            duration: 1.0,
            startTime: state.gameTime,
            heroId: caster.id,
          });
        }
      } else if (skill.type === 'snipe') {
        // 저격: 시전자 → 타겟 보스 경로에 있는 가장 가까운 적 타격
        const caster = skill.casterId ? state.heroes.get(skill.casterId) : undefined;
        const casterX = caster ? caster.x : skill.position.x;
        const casterY = caster ? caster.y : skill.position.y;

        if (skill.targetId) {
          const targetEnemy = state.enemies.find(e => e.id === skill.targetId && e.hp > 0);
          if (targetEnemy) {
            // 경로 상 가장 먼저 만나는 적 찾기
            const hitWidth = 30; // 탄환 경로 폭 (반경)
            let closestInPath: typeof targetEnemy | null = null;
            let closestDistSq = Infinity;

            for (const enemy of state.enemies) {
              if (enemy.hp <= 0) continue;
              const enemyHitRadius = isBossType(enemy.type) ? 44 : 22;
              const lineDist = pointToLineDistance(enemy.x, enemy.y, casterX, casterY, targetEnemy.x, targetEnemy.y);
              if (lineDist <= hitWidth + enemyHitRadius) {
                const dSq = distanceSquared(casterX, casterY, enemy.x, enemy.y);
                if (dSq < closestDistSq) {
                  closestDistSq = dSq;
                  closestInPath = enemy;
                }
              }
            }

            const hitTarget = closestInPath || targetEnemy;
            applyDamageToEnemy(ctx, hitTarget.id, skill.damage, caster);
          }
        }
      } else {
        // 범위 내 적에게 데미지 (damage > 0인 경우만 — 힐 전용 스킬 제외)
        if (skill.damage > 0) {
          for (const enemy of state.enemies) {
            if (enemy.hp <= 0) continue;
            const dist = distance(skill.position.x, skill.position.y, enemy.x, enemy.y);
            if (dist <= skill.radius) {
              const caster = skill.casterId ? state.heroes.get(skill.casterId) : undefined;
              applyDamageToEnemy(ctx, enemy.id, skill.damage, caster);
            }
          }
        }

        // 범위 내 기지에 데미지
        if (skill.damage > 0) {
          for (const base of state.enemyBases) {
            if (base.destroyed) continue;
            const baseDist = distance(skill.position.x, skill.position.y, base.x, base.y);
            if (baseDist <= skill.radius + 50) {
              damageBase(state, base.id, skill.damage, ctx.difficulty, skill.casterId);
            }
          }
        }

        // 실행 이펙트 추가 (dark_blade, spring_of_life는 메인 이펙트가 유지되므로 제외)
        if (skill.type !== 'dark_blade' && skill.type !== 'spring_of_life') {
          const effectCaster = skill.casterId ? state.heroes.get(skill.casterId) : undefined;
          // 특수 이펙트 타입/duration 변환
          const effectType = skill.type === 'mage_e' ? 'mage_meteor' : skill.type;
          const effectDuration = skill.type === 'mage_e' ? 1.5
            : skill.type === 'archer_e' ? 1.0
            : 0.5;
          state.activeSkillEffects.push({
            type: effectType as any,
            heroClass: effectCaster?.heroClass, advancedClass: effectCaster?.advancedClass as any,
            position: skill.position,
            radius: skill.radius,
            damage: skill.damage,
            duration: effectDuration,
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
        // 원래 시전 중심점 (direction에 저장, 없으면 현재 position이 중심)
        const centerX = skill.direction ? skill.direction.x : skill.position.x;
        const centerY = skill.direction ? skill.direction.y : skill.position.y;
        // 원형 범위 내 랜덤 위치
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.sqrt(Math.random()) * areaRadius;
        const randomX = centerX + Math.cos(angle) * dist;
        const randomY = centerY + Math.sin(angle) * dist;
        // 고정 interval: 총 duration / 총 운석 수 (meteorCount 감소에 무관)
        // duration=5, 총 10발 → 0.5초 간격
        const totalMeteors = 10;  // 총 운석 수 고정
        const interval = skill.duration / totalMeteors;

        skillsToAdd.push({
          ...skill,
          position: { x: randomX, y: randomY },
          direction: { x: centerX, y: centerY },  // 원래 중심점 보존
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
