/**
 * RPG 서버 보스 시스템
 * - 보스 스킬 업데이트 및 실행
 * - 보스 스킬 패턴
 */

import type { RPGEnemy, BossSkillType, BossVoidZone, EnemyBaseId, RPGDifficulty } from '../../../src/types/rpg';
import type { ServerHero, ServerGameState } from './rpgServerTypes';
import {
  RPG_CONFIG,
  COOP_CONFIG,
  BOSS_SKILL_CONFIGS,
  ADVANCED_CLASS_CONFIGS,
  type AdvancedHeroClass,
} from './rpgServerConfig';
import { distance, clamp, generateId, pointToLineDistance, isInConeRange } from './rpgServerUtils';
import { createEnemy } from './rpgServerEnemySystem';
import { isBossType } from '../utils/bossUtils';

export interface BossContext {
  difficulty: RPGDifficulty;
  createEnemy: (type: string, fromBase: EnemyBaseId, spawnX: number, spawnY: number, scaling: number) => RPGEnemy;
}

/**
 * 보스 스킬 업데이트
 */
export function updateBossSkills(
  state: ServerGameState,
  deltaTime: number,
  ctx: BossContext
): void {
  const { enemies, gameTime } = state;
  const bosses = enemies.filter(e => isBossType(e.type) && e.hp > 0);
  const aliveHeroes = Array.from(state.heroes.values()).filter(h => !h.isDead);

  for (const boss of bosses) {
    if (!boss.bossSkills) continue;

    // 기절/돌진 중이면 스킬 사용 불가
    const isStunned = boss.buffs?.some(b => b.type === 'stun' && b.duration > 0);
    if (isStunned || boss.dashState) continue;

    // 현재 시전 중인 스킬 처리
    if (boss.currentCast) {
      // 모든 영웅이 죽으면 시전 취소 → 넥서스로 이동 가능하게
      if (aliveHeroes.length === 0) {
        boss.currentCast = undefined;
        boss.state = 'idle';
        continue;
      }
      const castProgress = gameTime - boss.currentCast.startTime;
      if (castProgress >= boss.currentCast.castTime) {
        executeBossSkill(state, boss, boss.currentCast, aliveHeroes, ctx);
        boss.currentCast = undefined;
      }
      continue;
    }

    // 살아있는 영웅이 없으면 새 스킬 시전 안 함
    if (aliveHeroes.length === 0) continue;

    // 스킬 쿨다운 감소
    const hpRatio = boss.hp / boss.maxHp;
    for (const skill of boss.bossSkills) {
      skill.currentCooldown = Math.max(0, skill.currentCooldown - deltaTime);

      // HP 조건 충족 시 쿨다운 리셋
      if (skill.hpThreshold !== undefined && !skill.hpThresholdActivated && hpRatio <= skill.hpThreshold) {
        skill.currentCooldown = 0;
        skill.hpThresholdActivated = true;
      }
    }

    // 사용 가능한 스킬 선택
    const availableSkill = boss.bossSkills.find(s => {
      if (s.currentCooldown > 0) return false;
      if (s.hpThreshold !== undefined && hpRatio > s.hpThreshold) return false;
      if (s.oneTimeUse && s.used) return false;
      return true;
    });

    if (availableSkill) {
      // 가장 가까운 영웅 찾기
      let nearestHero = aliveHeroes[0];
      let minDist = Infinity;
      for (const hero of aliveHeroes) {
        const dist = distance(boss.x, boss.y, hero.x, hero.y);
        if (dist < minDist) {
          minDist = dist;
          nearestHero = hero;
        }
      }

      const targetAngle = Math.atan2(nearestHero.y - boss.y, nearestHero.x - boss.x);

      boss.currentCast = {
        skillType: availableSkill.type as any,
        startTime: gameTime,
        castTime: availableSkill.castTime || 1,
        targetX: nearestHero.x,
        targetY: nearestHero.y,
        targetAngle,
      };
      boss.state = 'casting';

      // 스킬 쿨다운 리셋
      availableSkill.currentCooldown = availableSkill.cooldown;
      if (availableSkill.oneTimeUse) {
        availableSkill.used = true;
      }

      // 경고 표시
      const config = BOSS_SKILL_CONFIGS[availableSkill.type];

      if (availableSkill.type === 'dark_meteor') {
        // 각 영웅 위치에 개별 경고 생성
        const meteorPositions: {x: number, y: number}[] = [];
        for (const hero of aliveHeroes) {
          meteorPositions.push({ x: hero.x, y: hero.y });
          state.bossSkillWarnings.push({
            id: `warning_${boss.id}_dark_meteor_${hero.id}_${gameTime}`,
            skillType: 'dark_meteor' as any,
            x: hero.x,
            y: hero.y,
            radius: config.radius,
            startTime: gameTime,
            duration: config.castTime,
          });
        }
        boss.currentCast!.meteorPositions = meteorPositions;
      } else if (availableSkill.type === 'teleport') {
        // 텔레포트: 경고 없음
      } else {
        const warning: any = {
          id: `warning_${boss.id}_${availableSkill.type}_${gameTime}`,
          skillType: availableSkill.type as any,
          x: availableSkill.type === 'dark_orb' ? nearestHero.x : boss.x,
          y: availableSkill.type === 'dark_orb' ? nearestHero.y : boss.y,
          radius: config.radius,
          angle: targetAngle,
          startTime: gameTime,
          duration: config.castTime,
        };
        // 돌진 스킬: 경로 끝점 추가
        if (availableSkill.type === 'charge' && config.chargeDistance) {
          warning.targetX = clamp(boss.x + Math.cos(targetAngle) * config.chargeDistance, 50, RPG_CONFIG.MAP_WIDTH - 50);
          warning.targetY = clamp(boss.y + Math.sin(targetAngle) * config.chargeDistance, 50, RPG_CONFIG.MAP_HEIGHT - 50);
        }
        state.bossSkillWarnings.push(warning);
      }
    }
  }
}

/**
 * 보스 스킬 실행
 */
function executeBossSkill(
  state: ServerGameState,
  boss: RPGEnemy,
  cast: any,
  heroes: ServerHero[],
  ctx: BossContext
): void {
  const config = BOSS_SKILL_CONFIGS[cast.skillType];
  const baseDamage = boss.aiConfig.attackDamage;
  const nexus = state.nexus;

  switch (cast.skillType) {
    case 'smash': {
      const damage = Math.floor(baseDamage * config.damage);
      const targetAngle = cast.targetAngle || 0;

      for (const hero of heroes) {
        if (isInConeRange(boss.x, boss.y, hero.x, hero.y, config.radius, config.angle!, targetAngle)) {
          applyDamageToHero(state, hero, damage);
          if (config.stunDuration) {
            applyStunToHero(hero, config.stunDuration, state.gameTime);
          }
        }
      }
      // 넥서스 데미지
      if (isInConeRange(boss.x, boss.y, nexus.x, nexus.y, config.radius, config.angle!, targetAngle)) {
        applyDamageToNexus(state, damage);
      }
      break;
    }

    case 'shockwave': {
      // 즉사 데미지 (캐릭터에게만, 넥서스에는 데미지 없음)
      for (const hero of heroes) {
        const dist = distance(boss.x, boss.y, hero.x, hero.y);
        if (dist <= config.radius) {
          applyDamageToHero(state, hero, hero.maxHp);
        }
      }
      break;
    }

    case 'knockback': {
      // 데미지 없음, 넉백만 (넥서스에도 데미지 없음)
      const knockbackDist = config.knockbackDistance || 300;

      for (const hero of heroes) {
        const dist = distance(boss.x, boss.y, hero.x, hero.y);
        if (dist <= config.radius) {
          const angle = Math.atan2(hero.y - boss.y, hero.x - boss.x);
          hero.x = clamp(hero.x + Math.cos(angle) * knockbackDist, 30, RPG_CONFIG.MAP_WIDTH - 30);
          hero.y = clamp(hero.y + Math.sin(angle) * knockbackDist, 30, RPG_CONFIG.MAP_HEIGHT - 30);
        }
      }
      break;
    }

    case 'charge': {
      const damage = Math.floor(baseDamage * config.damage);
      const chargeDist = config.chargeDistance || 300;
      const chargeAngle = cast.targetAngle || 0;

      const newBossX = clamp(boss.x + Math.cos(chargeAngle) * chargeDist, 50, RPG_CONFIG.MAP_WIDTH - 50);
      const newBossY = clamp(boss.y + Math.sin(chargeAngle) * chargeDist, 50, RPG_CONFIG.MAP_HEIGHT - 50);

      boss.dashState = {
        startX: boss.x,
        startY: boss.y,
        targetX: newBossX,
        targetY: newBossY,
        progress: 0,
        duration: 0.3,
        dirX: Math.cos(chargeAngle),
        dirY: Math.sin(chargeAngle),
      };

      for (const hero of heroes) {
        const distToPath = pointToLineDistance(hero.x, hero.y, boss.x, boss.y, newBossX, newBossY);
        if (distToPath <= config.radius) {
          applyDamageToHero(state, hero, damage);
        }
      }
      // 넥서스 데미지 (돌진 경로에 넥서스가 있는 경우)
      if (pointToLineDistance(nexus.x, nexus.y, boss.x, boss.y, newBossX, newBossY) <= config.radius + 50) {
        applyDamageToNexus(state, damage);
      }
      break;
    }

    case 'summon': {
      const summonCount = config.summonCount || 3;
      for (let i = 0; i < summonCount; i++) {
        const angle = (Math.PI * 2 / summonCount) * i + Math.random() * 0.5;
        const spawnX = boss.x + Math.cos(angle) * 100;
        const spawnY = boss.y + Math.sin(angle) * 100;
        const enemy = ctx.createEnemy('knight', boss.fromBase!, spawnX, spawnY, 1);
        enemy.hp = Math.floor(enemy.hp * 0.7);
        enemy.maxHp = enemy.hp;
        enemy.goldReward = 15;
        enemy.aggroOnHero = true;
        state.enemies.push(enemy);
      }
      break;
    }

    case 'heal': {
      const healAmount = Math.floor(boss.maxHp * (config.healPercent || 0.15));
      boss.hp = Math.min(boss.maxHp, boss.hp + healAmount);
      break;
    }

    // ============================================
    // Boss2 (암흑 마법사) 스킬
    // ============================================
    case 'dark_orb': {
      // 타겟 위치 AoE 폭발
      const damage = Math.floor(baseDamage * config.damage);
      const targetX = cast.targetX || boss.x;
      const targetY = cast.targetY || boss.y;
      for (const hero of heroes) {
        const dist = distance(targetX, targetY, hero.x, hero.y);
        if (dist <= config.radius) {
          applyDamageToHero(state, hero, damage);
        }
      }
      // 넥서스 데미지
      if (distance(targetX, targetY, nexus.x, nexus.y) <= config.radius) {
        applyDamageToNexus(state, damage);
      }
      break;
    }

    case 'shadow_summon': {
      // 마법사 졸개 3마리 소환 (HP 60%)
      const summonCount = config.summonCount || 3;
      for (let i = 0; i < summonCount; i++) {
        const angle = (Math.PI * 2 / summonCount) * i + Math.random() * 0.5;
        const spawnX = boss.x + Math.cos(angle) * 100;
        const spawnY = boss.y + Math.sin(angle) * 100;
        const enemy = ctx.createEnemy('mage', boss.fromBase!, spawnX, spawnY, 1);
        enemy.hp = Math.floor(enemy.hp * 0.6);
        enemy.maxHp = enemy.hp;
        enemy.goldReward = 20;
        enemy.aggroOnHero = true;
        state.enemies.push(enemy);
      }
      break;
    }

    case 'void_zone': {
      // bossActiveZones에 장판 추가
      const zoneDamage = Math.floor(baseDamage * config.damage);
      const zone: BossVoidZone = {
        id: `void_zone_${boss.id}_${state.gameTime}`,
        x: cast.targetX || boss.x,
        y: cast.targetY || boss.y,
        radius: config.radius,
        damage: zoneDamage,
        duration: config.zoneDuration || 5,
        startTime: state.gameTime,
        bossId: boss.id,
      };
      state.bossActiveZones.push(zone);
      break;
    }

    case 'dark_meteor': {
      // 각 영웅 위치에 데미지 (meteorPositions 기반)
      const damage = Math.floor(baseDamage * config.damage);
      const positions = cast.meteorPositions || [];
      for (const pos of positions) {
        for (const hero of heroes) {
          const dist = distance(pos.x, pos.y, hero.x, hero.y);
          if (dist <= config.radius) {
            applyDamageToHero(state, hero, damage);
          }
        }
        // 넥서스 데미지
        if (distance(pos.x, pos.y, nexus.x, nexus.y) <= config.radius) {
          applyDamageToNexus(state, damage);
        }
      }
      break;
    }

    case 'soul_drain': {
      // 범위 데미지 + 적중수×5% 자힐
      const damage = Math.floor(baseDamage * config.damage);
      let hitCount = 0;
      for (const hero of heroes) {
        const dist = distance(boss.x, boss.y, hero.x, hero.y);
        if (dist <= config.radius) {
          applyDamageToHero(state, hero, damage);
          hitCount++;
        }
      }
      // 적중 영웅당 자힐
      const healPercent = config.drainHealPercent || 0.05;
      const healAmount = Math.floor(boss.maxHp * healPercent * hitCount);
      if (healAmount > 0) {
        boss.hp = Math.min(boss.maxHp, boss.hp + healAmount);
      }
      break;
    }

    case 'teleport': {
      // 가장 먼 영웅 근처로 텔레포트
      let farthestHero = heroes[0];
      let maxDist = 0;
      for (const hero of heroes) {
        const dist = distance(boss.x, boss.y, hero.x, hero.y);
        if (dist > maxDist) {
          maxDist = dist;
          farthestHero = hero;
        }
      }
      // 영웅 근처 (100~150px) 랜덤 위치로 이동
      const teleportAngle = Math.random() * Math.PI * 2;
      const teleportDist = 100 + Math.random() * 50;
      boss.x = clamp(farthestHero.x + Math.cos(teleportAngle) * teleportDist, 50, RPG_CONFIG.MAP_WIDTH - 50);
      boss.y = clamp(farthestHero.y + Math.sin(teleportAngle) * teleportDist, 50, RPG_CONFIG.MAP_HEIGHT - 50);
      break;
    }
  }

  // 스킬 실행 이펙트 추가
  const now = state.currentTickTimestamp;
  state.bossSkillExecutedEffects.push({
    id: `boss_skill_${cast.skillType}_${now}_${boss.id}`,
    skillType: cast.skillType,
    x: boss.x,
    y: boss.y,
    timestamp: now,
  });

  boss.state = 'idle';
}

/**
 * 보스 스킬로 영웅에게 데미지 적용
 */
export function applyDamageToHero(state: ServerGameState, hero: ServerHero, damage: number): void {
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

  if (damage > 0) {
    hero.hp -= damage;

    // 적/보스 공격은 빨간색 데미지 넘버
    state.damageNumbers.push({
      id: generateId(),
      x: hero.x,
      y: hero.y - 30,
      amount: damage,
      type: 'enemy_damage',
      createdAt: state.currentTickTimestamp,
    });

    if (hero.hp <= 0) {
      hero.hp = 0;
      hero.isDead = true;
      hero.darkBladeActive = false;
      hero.buffs = [];
      hero.deathTime = state.gameTime;

      hero.reviveTimer = COOP_CONFIG.REVIVE.BASE_TIME;

      // 다크블레이드 이펙트 제거
      for (let i = state.activeSkillEffects.length - 1; i >= 0; i--) {
        const eff = state.activeSkillEffects[i];
        if (eff.type === 'dark_blade' && eff.heroId === hero.id) {
          state.activeSkillEffects.splice(i, 1);
        }
      }
    }
  }
}

/**
 * 영웅에게 스턴 적용
 */
export function applyStunToHero(hero: ServerHero, duration: number, gameTime: number): void {
  hero.buffs = hero.buffs || [];
  hero.buffs = hero.buffs.filter(b => b.type !== 'stun');
  hero.buffs.push({ type: 'stun', duration, startTime: gameTime });
}

/**
 * 보스 스킬로 넥서스에 데미지 적용
 */
function applyDamageToNexus(state: ServerGameState, damage: number): void {
  if (state.nexus.hp <= 0) return;
  state.nexus.hp -= damage;

  state.damageNumbers.push({
    id: generateId(),
    x: state.nexus.x,
    y: state.nexus.y - 30,
    amount: damage,
    type: 'enemy_damage',
    createdAt: state.currentTickTimestamp,
  });
}

/**
 * Void Zone (공허의 영역) 지속 데미지 업데이트
 */
export function updateVoidZones(state: ServerGameState, deltaTime: number): void {
  const zones = state.bossActiveZones;
  if (zones.length === 0) return;

  const aliveHeroes = Array.from(state.heroes.values()).filter(h => !h.isDead);
  const nexus = state.nexus;

  for (let i = zones.length - 1; i >= 0; i--) {
    const zone = zones[i];
    zone.duration -= deltaTime;

    if (zone.duration <= 0) {
      zones.splice(i, 1);
      continue;
    }

    // 초당 데미지 적용 (deltaTime 비례)
    const tickDamage = Math.floor(zone.damage * deltaTime);
    if (tickDamage <= 0) continue;

    for (const hero of aliveHeroes) {
      const dist = distance(zone.x, zone.y, hero.x, hero.y);
      if (dist <= zone.radius) {
        applyDamageToHero(state, hero, tickDamage);
      }
    }

    // 넥서스 데미지
    if (distance(zone.x, zone.y, nexus.x, nexus.y) <= zone.radius) {
      applyDamageToNexus(state, tickDamage);
    }
  }
}
