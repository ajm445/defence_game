/**
 * RPG 서버 영웅 시스템
 * - 영웅 초기화, 스폰 위치, 스킬 생성
 * - 영웅 이동, 상태 업데이트
 * - 버프, 쿨다운, 부활 처리
 */

import type { HeroClass, RPGEnemy } from '../../../src/types/rpg';
import type { CoopPlayerInfo } from '../../../shared/types/rpgNetwork';
import type { ServerHero, ServerEnemyBase, ServerGameState } from './rpgServerTypes';
import {
  NEXUS_CONFIG,
  RPG_CONFIG,
  GOLD_CONFIG,
  CLASS_CONFIGS,
  UPGRADE_CONFIG,
  COOP_CONFIG,
  SECOND_ENHANCEMENT_MULTIPLIER,
  ADVANCED_CLASS_CONFIGS,
  getStatBonus,
  getPassiveFromCharacterLevel,
  type AdvancedHeroClass,
} from './rpgServerConfig';
import { distance, distanceSquared, clamp, generateId } from './rpgServerUtils';

/**
 * 영웅 스폰 위치 계산
 */
export function getHeroSpawnPositions(playerCount: number): { x: number; y: number }[] {
  const centerX = NEXUS_CONFIG.position.x;
  const centerY = NEXUS_CONFIG.position.y;
  const offset = 100;

  switch (playerCount) {
    case 1:
      return [{ x: centerX, y: centerY + offset }];
    case 2:
      return [
        { x: centerX - offset, y: centerY + offset },
        { x: centerX + offset, y: centerY + offset },
      ];
    case 3:
      return [
        { x: centerX, y: centerY + offset },
        { x: centerX - offset, y: centerY + offset * 1.5 },
        { x: centerX + offset, y: centerY + offset * 1.5 },
      ];
    case 4:
      return [
        { x: centerX - offset, y: centerY + offset },
        { x: centerX + offset, y: centerY + offset },
        { x: centerX - offset, y: centerY + offset * 1.5 },
        { x: centerX + offset, y: centerY + offset * 1.5 },
      ];
    default:
      return [{ x: centerX, y: centerY + offset }];
  }
}

/**
 * 영웅 스킬 생성
 */
export function createHeroSkills(heroClass: HeroClass, advancedClass?: AdvancedHeroClass): any[] {
  const baseSkillConfigs: Record<HeroClass, { qType: string; qCd: number; wType: string; wCd: number; eType: string; eCd: number }> = {
    warrior: { qType: 'warrior_q', qCd: 1.0, wType: 'warrior_w', wCd: 8.0, eType: 'warrior_e', eCd: 30.0 },
    archer: { qType: 'archer_q', qCd: 0.8, wType: 'archer_w', wCd: 6.0, eType: 'archer_e', eCd: 25.0 },
    knight: { qType: 'knight_q', qCd: 1.2, wType: 'knight_w', wCd: 10.0, eType: 'knight_e', eCd: 35.0 },
    mage: { qType: 'mage_q', qCd: 1.5, wType: 'mage_w', wCd: 5.0, eType: 'mage_e', eCd: 40.0 },
  };

  const advancedSkillConfigs: Record<AdvancedHeroClass, { wType: string; wCd: number; eType: string; eCd: number }> = {
    berserker: { wType: 'blood_rush', wCd: 6.0, eType: 'berserker_rage', eCd: 45.0 },
    guardian: { wType: 'guardian_rush', wCd: 8.0, eType: 'guardian_wall', eCd: 40.0 },
    sniper: { wType: 'backflip_shot', wCd: 5.0, eType: 'headshot', eCd: 30.0 },
    ranger: { wType: 'multi_arrow', wCd: 5.0, eType: 'arrow_storm', eCd: 35.0 },
    paladin: { wType: 'holy_charge', wCd: 8.0, eType: 'holy_judgment', eCd: 60.0 },
    darkKnight: { wType: 'heavy_strike', wCd: 4.0, eType: 'dark_blade', eCd: 0 },
    archmage: { wType: 'inferno', wCd: 7.0, eType: 'meteor_shower', eCd: 50.0 },
    healer: { wType: 'healing_light', wCd: 7.0, eType: 'spring_of_life', eCd: 45.0 },
  };

  const baseConfig = baseSkillConfigs[heroClass];

  if (advancedClass && advancedSkillConfigs[advancedClass]) {
    const advConfig = advancedSkillConfigs[advancedClass];
    return [
      { type: baseConfig.qType, key: 'Q' as const, cooldown: baseConfig.qCd, currentCooldown: 0 },
      { type: advConfig.wType, key: 'W' as const, cooldown: advConfig.wCd, currentCooldown: 0 },
      { type: advConfig.eType, key: 'E' as const, cooldown: advConfig.eCd, currentCooldown: 0 },
    ];
  }

  return [
    { type: baseConfig.qType, key: 'Q' as const, cooldown: baseConfig.qCd, currentCooldown: 0 },
    { type: baseConfig.wType, key: 'W' as const, cooldown: baseConfig.wCd, currentCooldown: 0 },
    { type: baseConfig.eType, key: 'E' as const, cooldown: baseConfig.eCd, currentCooldown: 0 },
  ];
}

/**
 * 영웅 생성
 */
export function createHero(playerInfo: CoopPlayerInfo, spawnPos: { x: number; y: number }): ServerHero {
  const heroClass = playerInfo.heroClass || 'warrior';
  const advancedClass = playerInfo.advancedClass as AdvancedHeroClass | undefined;
  const tier = playerInfo.tier;

  let baseStats: { hp: number; attack: number; attackSpeed: number; speed: number; range: number };
  let configName: string;

  if (advancedClass && ADVANCED_CLASS_CONFIGS[advancedClass]) {
    const advConfig = ADVANCED_CLASS_CONFIGS[advancedClass];
    const baseStat = advConfig.stats;
    const multiplier = tier === 2 ? SECOND_ENHANCEMENT_MULTIPLIER : 1;
    baseStats = {
      hp: Math.floor(baseStat.hp * multiplier),
      attack: Math.floor(baseStat.attack * multiplier),
      attackSpeed: baseStat.attackSpeed / multiplier,
      speed: baseStat.speed * multiplier,
      range: Math.floor(baseStat.range * multiplier),
    };
    configName = advConfig.name;
  } else {
    const classConfig = CLASS_CONFIGS[heroClass];
    baseStats = {
      hp: classConfig.hp,
      attack: classConfig.attack,
      attackSpeed: classConfig.attackSpeed,
      speed: classConfig.speed,
      range: classConfig.range,
    };
    configName = heroClass;
  }

  const upgrades = playerInfo.statUpgrades || { attack: 0, speed: 0, hp: 0, attackSpeed: 0, range: 0, hpRegen: 0 };
  const attackBonus = getStatBonus('attack', upgrades.attack, tier);
  const speedBonus = getStatBonus('speed', upgrades.speed, tier);
  const hpBonus = getStatBonus('hp', upgrades.hp, tier);
  const attackSpeedBonus = getStatBonus('attackSpeed', upgrades.attackSpeed, tier);
  const rangeBonus = getStatBonus('range', upgrades.range, tier);

  const finalHp = baseStats.hp + hpBonus;
  const finalAttack = baseStats.attack + attackBonus;
  const finalSpeed = baseStats.speed + speedBonus;
  const finalAttackSpeed = Math.max(0.3, baseStats.attackSpeed - attackSpeedBonus);
  const finalRange = baseStats.range + rangeBonus;

  const heroId = `hero_${playerInfo.id}`;
  const skills = createHeroSkills(heroClass, advancedClass);
  // 스킬 직접 참조 캐시 (매 틱 find 호출 제거)
  const skillQ = skills.find(s => s.key === 'Q')!;
  const skillW = skills.find(s => s.key === 'W')!;
  const skillE = skills.find(s => s.key === 'E')!;

  return {
    id: heroId,
    playerId: playerInfo.id,
    heroClass,
    x: spawnPos.x,
    y: spawnPos.y,
    hp: finalHp,
    maxHp: finalHp,
    baseAttack: finalAttack,
    baseSpeed: finalSpeed,
    baseAttackSpeed: finalAttackSpeed,
    attack: finalAttack,
    speed: finalSpeed,
    attackSpeed: finalAttackSpeed,
    range: finalRange,
    gold: GOLD_CONFIG.STARTING_GOLD,
    upgradeLevels: { attack: 0, speed: 0, hp: 0, attackSpeed: 0, goldRate: 0, range: 0 },
    isDead: false,
    reviveTimer: 0,
    facingRight: true,
    facingAngle: 0,
    buffs: [],
    passiveGrowth: getPassiveFromCharacterLevel(heroClass, playerInfo.characterLevel || 1),
    skillCooldowns: { Q: 0, W: 0, E: 0 },
    moveDirection: null,
    state: 'idle',
    characterLevel: playerInfo.characterLevel || 1,
    skills,
    _skillQ: skillQ,
    _skillW: skillW,
    _skillE: skillE,
    config: {
      name: configName,
      cost: {},
      hp: finalHp,
      attack: finalAttack,
      attackSpeed: finalAttackSpeed,
      speed: finalSpeed,
      range: finalRange,
      type: 'combat',
    },
    attackCooldown: 0,
    team: 'player',
    statUpgrades: upgrades,
    kills: 0,
    advancedClass: playerInfo.advancedClass,
    tier: playerInfo.tier,
    goldAccumulator: 0,
  };
}

/**
 * 사망한 영웅 업데이트 (부활 타이머)
 */
export function updateDeadHero(hero: ServerHero, deltaTime: number): void {
  hero.reviveTimer -= deltaTime;

  if (hero.reviveTimer <= 0) {
    hero.isDead = false;
    hero.hp = Math.floor(hero.maxHp * COOP_CONFIG.REVIVE.REVIVE_HP_PERCENT);
    hero.reviveTimer = 0;
    hero.deathTime = undefined;

    const offset = COOP_CONFIG.REVIVE.SPAWN_OFFSET;
    hero.x = NEXUS_CONFIG.position.x + (Math.random() - 0.5) * offset;
    hero.y = NEXUS_CONFIG.position.y + offset + Math.random() * offset;

    console.log(`[ServerEngine] 영웅 부활: ${hero.id}`);
  }
}

/**
 * 스킬 쿨다운 업데이트
 * - 광전사 버프 활성화 시 Q스킬 쿨다운이 더 빠르게 감소
 * - 참고: SP 공격속도 업그레이드는 영웅 생성 시 hero.config.attackSpeed에 이미 반영됨
 *   (Q스킬 쿨다운 시간 자체가 짧아져 있으므로 여기서 추가 적용하면 중복됨)
 */
export function updateSkillCooldowns(hero: ServerHero, deltaTime: number): void {
  // 광전사 버프 확인 (공격속도 증가)
  const berserkerBuff = hero.buffs?.find(b => b.type === 'berserker' && b.duration > 0);
  const buffMultiplier = berserkerBuff?.speedBonus ? (1 + berserkerBuff.speedBonus) : 1;

  if (hero.skills) {
    for (const skill of hero.skills) {
      if (skill.currentCooldown > 0) {
        const isQSkill = skill.key === 'Q';
        let cooldownReduction = deltaTime;
        if (isQSkill) {
          // 광전사 버프만 적용 (SP 공격속도는 이미 쿨다운 시간에 반영됨)
          cooldownReduction = deltaTime * buffMultiplier;
        }
        skill.currentCooldown = Math.max(0, skill.currentCooldown - cooldownReduction);
      }
    }
  }

  if (hero.skillCooldowns) {
    // Q 스킬에만 광전사 버프 적용 (SP 공격속도는 이미 쿨다운 시간에 반영됨)
    hero.skillCooldowns.Q = Math.max(0, hero.skillCooldowns.Q - deltaTime * buffMultiplier);
    hero.skillCooldowns.W = Math.max(0, hero.skillCooldowns.W - deltaTime);
    hero.skillCooldowns.E = Math.max(0, hero.skillCooldowns.E - deltaTime);
  }
}

/**
 * 버프 업데이트 (인플레이스 - 매 틱 배열/객체 재할당 제거)
 */
export function updateBuffs(hero: ServerHero, deltaTime: number): void {
  if (!hero.buffs) {
    hero.buffs = [];
    return;
  }

  for (let i = hero.buffs.length - 1; i >= 0; i--) {
    hero.buffs[i].duration -= deltaTime;
    if (hero.buffs[i].duration <= 0) {
      hero.buffs.splice(i, 1);
    }
  }
}

/**
 * 영웅 데미지 계산
 */
export function calculateHeroDamage(hero: ServerHero): number {
  const baseDamage = hero.config?.attack || hero.baseAttack || 50;
  const attackUpgrade = hero.upgradeLevels?.attack || 0;
  const upgradeBonus = attackUpgrade * UPGRADE_CONFIG.attack.perLevel;
  let totalDamage = baseDamage + upgradeBonus;

  const berserkerBuff = hero.buffs?.find(b => b.type === 'berserker' && b.duration > 0);
  if (berserkerBuff?.attackBonus) {
    totalDamage = Math.floor(totalDamage * (1 + berserkerBuff.attackBonus));
  }

  return totalDamage;
}

/**
 * 가장 가까운 적 찾기
 */
export function findNearestEnemy(enemies: RPGEnemy[], x: number, y: number, range: number): RPGEnemy | null {
  let nearest: RPGEnemy | null = null;
  let minDistSq = Infinity;
  const rangeSq = range * range;

  for (const enemy of enemies) {
    if (enemy.hp <= 0) continue;
    const distSq = distanceSquared(x, y, enemy.x, enemy.y);
    if (distSq <= rangeSq && distSq < minDistSq) {
      minDistSq = distSq;
      nearest = enemy;
    }
  }

  return nearest;
}

/**
 * 가장 가까운 적 기지 찾기
 */
export function findNearestEnemyBase(bases: ServerEnemyBase[], x: number, y: number, range: number): ServerEnemyBase | null {
  let nearest: ServerEnemyBase | null = null;
  let minDistSq = Infinity;
  const rangeSq = range * range;

  for (const base of bases) {
    if (base.destroyed || base.hp <= 0) continue;
    const distSq = distanceSquared(x, y, base.x, base.y);
    if (distSq <= rangeSq && distSq < minDistSq) {
      minDistSq = distSq;
      nearest = base;
    }
  }

  return nearest;
}

/**
 * 힐러 오라 적용
 */
export function applyHealerAura(hero: ServerHero, heroes: Map<string, ServerHero>, deltaTime: number): void {
  const advancedClass = hero.advancedClass as AdvancedHeroClass | undefined;
  if (advancedClass !== 'healer') return;

  const healAura = ADVANCED_CLASS_CONFIGS.healer.specialEffects.healAura;
  if (!healAura) return;

  const healRadius = healAura.radius || 150;
  const healRadiusSq = healRadius * healRadius;
  const healPerSecond = healAura.healPerSecond || 0.04;

  for (const [, otherHero] of heroes) {
    if (otherHero.isDead) continue;
    if (otherHero.hp >= otherHero.maxHp) continue; // 풀피면 스킵
    const distSq = distanceSquared(hero.x, hero.y, otherHero.x, otherHero.y);
    if (distSq <= healRadiusSq) {
      // 소수점 힐량 허용 (Math.floor 제거 - 기사 패시브와 동일)
      const healAmount = otherHero.maxHp * healPerSecond * deltaTime;
      otherHero.hp = Math.min(otherHero.maxHp, otherHero.hp + healAmount);
    }
  }
}

/**
 * 기사 패시브 HP 회복
 */
export function applyKnightPassiveRegen(hero: ServerHero, deltaTime: number): void {
  if (hero.heroClass === 'knight' && hero.passiveGrowth?.currentValue > 0) {
    // 다크나이트 어둠의 칼날 활성 시 HP 리젠 비활성화
    if (hero.darkBladeActive) return;
    const regenAmount = hero.passiveGrowth.currentValue * deltaTime;
    hero.hp = Math.min(hero.maxHp, hero.hp + regenAmount);
  }
}

/**
 * 영웅 이동 처리
 */
export function processHeroMovement(hero: ServerHero, deltaTime: number, gameTime: number): void {
  const isCasting = hero.castingUntil && gameTime < hero.castingUntil;
  const isStunned = hero.buffs?.some(b => b.type === 'stun' && b.duration > 0);

  // 돌진 상태 처리
  if (hero.dashState) {
    const dash = hero.dashState;
    const newProgress = dash.progress + deltaTime / dash.duration;

    if (newProgress >= 1) {
      hero.x = dash.targetX;
      hero.y = dash.targetY;
      hero.dashState = undefined;
      hero.state = 'idle';
    } else {
      const easedProgress = 1 - (1 - newProgress) * (1 - newProgress);
      hero.x = dash.startX + (dash.targetX - dash.startX) * easedProgress;
      hero.y = dash.startY + (dash.targetY - dash.startY) * easedProgress;
      hero.dashState = { ...dash, progress: newProgress };
      hero.state = 'moving';
    }
    return;
  }

  // 이동 처리
  if (!isCasting && !isStunned && hero.moveDirection && (hero.moveDirection.x !== 0 || hero.moveDirection.y !== 0)) {
    const dir = hero.moveDirection;
    let speed = hero.config?.speed || hero.baseSpeed || 200;

    // 이동속도 버프 적용 (swiftness)
    const swiftnessBuff = hero.buffs?.find(b => b.type === 'swiftness' && b.duration > 0);
    if (swiftnessBuff?.moveSpeedBonus) {
      speed *= (1 + swiftnessBuff.moveSpeedBonus);
    }

    const moveDistance = speed * deltaTime * 60;

    const dirLength = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
    if (dirLength === 0) return; // 0 나누기 방지

    const normalizedX = dir.x / dirLength;
    const normalizedY = dir.y / dirLength;

    hero.x += normalizedX * moveDistance;
    hero.y += normalizedY * moveDistance;
    hero.state = 'moving';

    hero.facingRight = normalizedX >= 0;
    hero.facingAngle = Math.atan2(normalizedY, normalizedX);
  } else {
    hero.state = 'idle';
  }

  // 맵 경계 처리
  hero.x = clamp(hero.x, 30, RPG_CONFIG.MAP_WIDTH - 30);
  hero.y = clamp(hero.y, 30, RPG_CONFIG.MAP_HEIGHT - 30);
}

/**
 * 영웅이 자동 공격 가능한지 확인
 */
export function canHeroAutoAttack(hero: ServerHero, gameTime: number): boolean {
  if (hero.isDead) return false;
  if (hero.dashState) return false;

  const isCasting = hero.castingUntil && gameTime < hero.castingUntil;
  const isStunned = hero.buffs?.some(b => b.type === 'stun' && b.duration > 0);
  if (isCasting || isStunned) return false;

  return hero._skillQ.currentCooldown <= 0;
}
