import { HeroUnit, RPGEnemy, Skill, SkillEffect, SkillType, Buff, PendingSkill, HeroClass, HitTarget, EnemyBase, EnemyBaseId, AdvancedHeroClass } from '../../types/rpg';
import { RPG_CONFIG, CLASS_SKILLS, CLASS_CONFIGS, PASSIVE_UNLOCK_LEVEL, UPGRADE_CONFIG, ADVANCED_W_SKILLS, ADVANCED_E_SKILLS, ADVANCED_CLASS_CONFIGS } from '../../constants/rpgConfig';
import { distance } from '../../utils/math';
import { rollMultiTarget } from './passiveSystem';

// 스킬 슬롯에서 스킬 타입 가져오기
export function getSkillTypeForSlot(heroClass: HeroClass, slot: 'Q' | 'W' | 'E'): SkillType {
  const classSkills = CLASS_SKILLS[heroClass];
  return classSkills[slot.toLowerCase() as 'q' | 'w' | 'e'].type;
}

// 스킬 설정 가져오기
export function getSkillConfig(heroClass: HeroClass, slot: 'Q' | 'W' | 'E') {
  const classSkills = CLASS_SKILLS[heroClass];
  return classSkills[slot.toLowerCase() as 'q' | 'w' | 'e'];
}

/**
 * 스킬 사용 가능 여부 확인
 */
export function canUseSkill(hero: HeroUnit, skillType: SkillType): boolean {
  const skill = hero.skills.find((s) => s.type === skillType);
  if (!skill) return false;
  return skill.currentCooldown <= 0;
}

/**
 * 스킬 쿨다운 시작
 */
export function startSkillCooldown(hero: HeroUnit, skillType: SkillType): HeroUnit {
  const updatedSkills = hero.skills.map((skill) => {
    if (skill.type === skillType) {
      return { ...skill, currentCooldown: skill.cooldown };
    }
    return skill;
  });
  return { ...hero, skills: updatedSkills };
}

/**
 * 스킬 쿨다운 업데이트
 * - 광전사 버프 활성화 시 Q스킬 쿨다운이 더 빠르게 감소
 * - 참고: SP 공격속도 업그레이드는 영웅 생성 시 hero.config.attackSpeed에 이미 반영됨
 *   (Q스킬 쿨다운 시간 자체가 짧아져 있으므로 여기서 추가 적용하면 중복됨)
 */
export function updateSkillCooldowns(hero: HeroUnit, deltaTime: number): HeroUnit {
  // 광전사 버프 확인 (공격속도 증가) - duration > 0인 경우만 유효
  const berserkerBuff = hero.buffs.find(b => b.type === 'berserker' && b.duration > 0);
  const buffMultiplier = berserkerBuff?.speedBonus ? (1 + berserkerBuff.speedBonus) : 1;

  const updatedSkills = hero.skills.map((skill) => {
    // Q스킬(기본 공격)에만 광전사 버프 적용
    const isQSkill = skill.key === 'Q';
    let cooldownReduction = deltaTime;

    if (isQSkill) {
      // 광전사 버프만 적용 (SP 공격속도는 이미 쿨다운 시간에 반영됨)
      cooldownReduction = deltaTime * buffMultiplier;
    }

    return {
      ...skill,
      currentCooldown: Math.max(0, skill.currentCooldown - cooldownReduction),
    };
  });
  return { ...hero, skills: updatedSkills };
}


/**
 * 스킬 정보 텍스트 생성
 */
export function getSkillDescription(skill: Skill): string {
  // 직업별 스킬
  for (const [, skills] of Object.entries(CLASS_SKILLS)) {
    for (const [, skillConfig] of Object.entries(skills)) {
      if (skillConfig.type === skill.type) {
        return skillConfig.description;
      }
    }
  }

  // 전직 W 스킬
  for (const [, skillConfig] of Object.entries(ADVANCED_W_SKILLS)) {
    if (skillConfig.type === skill.type) {
      return skillConfig.description;
    }
  }

  // 전직 E 스킬
  for (const [, skillConfig] of Object.entries(ADVANCED_E_SKILLS)) {
    if (skillConfig.type === skill.type) {
      return skillConfig.description;
    }
  }

  return '';
}

// ============================================
// 직업별 스킬 실행 함수들
// ============================================

export interface ClassSkillResult {
  hero: HeroUnit;
  effect?: SkillEffect;
  enemyDamages: { enemyId: string; damage: number; isCritical?: boolean }[];
  baseDamages: { baseId: EnemyBaseId; damage: number; isCritical?: boolean }[];  // 기지 데미지
  buff?: Buff;
  pendingSkill?: PendingSkill;
  stunTargets?: string[];
  stunDuration?: number; // 기절 지속시간 (초)
  allyHeals?: { heroId: string; heal: number }[];  // 아군 힐 (전직 스킬용)
  allyBuffs?: { heroId: string; buff: Buff }[];    // 아군 버프 (전직 스킬용)
}

/**
 * 직업별 Q 스킬 실행 (일반공격)
 * - 전사, 기사: 근접 범위 공격 (다수 타격)
 * - 마법사: 원거리 범위 공격 (다수 타격)
 * - 궁수: 다중 타겟 공격 (패시브 확률 기반)
 */
export function executeQSkill(
  hero: HeroUnit,
  enemies: RPGEnemy[],
  targetX: number,
  targetY: number,
  gameTime: number,
  enemyBases: EnemyBase[] = [],  // 적 기지 (선택적)
  attackUpgradeLevel: number = 0,  // 인게임 공격력 업그레이드 레벨
  allies: HeroUnit[] = []  // 아군 히어로들 (팔라딘 기본 공격 힐용)
): ClassSkillResult {
  const heroClass = hero.heroClass;
  const skillConfig = CLASS_SKILLS[heroClass].q;
  const classConfig = CLASS_CONFIGS[heroClass];
  const baseDamage = hero.config.attack || hero.baseAttack;
  // 인게임 골드 업그레이드 보너스 적용
  const attackBonus = attackUpgradeLevel * UPGRADE_CONFIG.attack.perLevel;
  let damage = Math.floor((baseDamage + attackBonus) * (skillConfig.damageMultiplier || 1.0));

  // 마법사: 보스 데미지 보너스 배율 계산 (보스에게만 적용)
  // 1. 패시브 성장 (레벨 5: 25% 시작, 레벨당 +1%, 최대 +100%)
  // 2. 대마법사 전직 보너스: x1.5 (곱연산)
  let bossDamageMultiplier = 1.0;
  if (heroClass === 'mage') {
    const passiveBossDamageBonus = hero.passiveGrowth?.currentValue || 0;
    bossDamageMultiplier = 1 + passiveBossDamageBonus;
    // 대마법사 전직 보너스 (곱연산)
    if (hero.advancedClass === 'archmage') {
      bossDamageMultiplier *= 1 + (ADVANCED_CLASS_CONFIGS.archmage.specialEffects.bossBonus || 0);
    }
  }

  // 버프 적용된 공격력 계산 - duration > 0인 경우만 유효
  let finalDamage = damage;
  const berserkerBuff = hero.buffs.find(b => b.type === 'berserker' && b.duration > 0);
  if (berserkerBuff) {
    finalDamage = Math.floor(finalDamage * (1 + (berserkerBuff.attackBonus || 0)));
  }

  // 저격수 크리티컬 확률 체크 (기본 공격에 적용)
  const critChance = hero.advancedClass === 'sniper'
    ? (ADVANCED_CLASS_CONFIGS.sniper.specialEffects.critChance || 0)
    : 0;
  const isCriticalHit = critChance > 0 && Math.random() < critChance;
  const criticalMultiplier = 2.0; // 크리티컬 데미지 2배
  if (isCriticalHit) {
    finalDamage = Math.floor(finalDamage * criticalMultiplier);
  }

  const enemyDamages: { enemyId: string; damage: number; isCritical?: boolean }[] = [];
  const baseDamages: { baseId: EnemyBaseId; damage: number; isCritical?: boolean }[] = [];
  const hitTargets: HitTarget[] = []; // 피격 대상 위치 수집
  // 직업별 기본 공격 사거리 사용
  const attackRange = hero.config.range || CLASS_CONFIGS[heroClass].range;
  const baseAttackRange = attackRange + 50;  // 기지는 크기가 크므로 추가 사거리

  // 공격 방향 계산 (영웅 → 마우스 방향)
  const dx = targetX - hero.x;
  const dy = targetY - hero.y;
  const dirDist = Math.sqrt(dx * dx + dy * dy);
  const dirX = dirDist > 0 ? dx / dirDist : (hero.facingRight ? 1 : -1);
  const dirY = dirDist > 0 ? dy / dirDist : 0;

  // 범위 공격 직업 여부 (전사, 기사: 근접 범위 / 마법사: 원거리 범위)
  const isAoE = heroClass === 'warrior' || heroClass === 'knight' || heroClass === 'mage';
  // 근거리 직업 여부
  const isMelee = heroClass === 'warrior' || heroClass === 'knight';
  // 전방 공격 각도 (내적 기준: 0.0 = 90도, -0.5 = 120도)
  const attackAngleThreshold = isMelee ? -0.3 : 0.0; // 근거리는 약 110도, 원거리는 90도

  // 궁수: 기본 패시브 다중타겟 (레벨 5 이상) + 패시브 성장 확률 판정
  const baseMultiTargetCount = classConfig.passive.multiTarget || 1;
  // 레벨 5 이상이고 패시브 성장 확률 판정 성공 시 다중타겟
  const isPassiveUnlocked = hero.characterLevel >= PASSIVE_UNLOCK_LEVEL;
  const useGrowthMultiTarget = heroClass === 'archer' && isPassiveUnlocked && rollMultiTarget(hero.passiveGrowth?.currentValue || 0);
  const multiTargetCount = useGrowthMultiTarget ? baseMultiTargetCount : 1;

  // 궁수용 통합 타겟 풀 (적 + 기지)
  type ArcherTarget =
    | { type: 'enemy'; enemy: RPGEnemy; dist: number; x: number; y: number }
    | { type: 'base'; base: EnemyBase; dist: number; x: number; y: number };
  const archerTargets: ArcherTarget[] = [];

  for (const enemy of enemies) {
    if (enemy.hp <= 0) continue;

    const distToHero = distance(hero.x, hero.y, enemy.x, enemy.y);
    if (distToHero > attackRange) continue;

    // 바라보는 방향 체크 (내적 사용)
    const enemyDx = enemy.x - hero.x;
    const enemyDy = enemy.y - hero.y;
    const enemyDist = Math.sqrt(enemyDx * enemyDx + enemyDy * enemyDy);
    if (enemyDist === 0) continue;

    const enemyDirX = enemyDx / enemyDist;
    const enemyDirY = enemyDy / enemyDist;
    const dot = dirX * enemyDirX + dirY * enemyDirY;

    // 바라보는 방향 범위 밖이면 스킵
    if (dot < attackAngleThreshold) continue;

    if (isAoE) {
      // 범위 공격 (전사, 기사, 마법사): 범위 내 모든 적에게 데미지
      // 마법사: 보스에게만 데미지 보너스 적용
      const actualDamage = enemy.type === 'boss' ? Math.floor(finalDamage * bossDamageMultiplier) : finalDamage;
      enemyDamages.push({ enemyId: enemy.id, damage: actualDamage, isCritical: isCriticalHit });
      hitTargets.push({ x: enemy.x, y: enemy.y, damage: actualDamage });
    } else {
      // 궁수: 통합 타겟 풀에 추가
      archerTargets.push({ type: 'enemy', enemy, dist: distToHero, x: enemy.x, y: enemy.y });
    }
  }

  // 궁수: 기지도 통합 타겟 풀에 추가
  if (!isAoE) {
    for (const base of enemyBases) {
      if (base.destroyed) continue;

      const distToBase = distance(hero.x, hero.y, base.x, base.y);
      if (distToBase > baseAttackRange) continue;

      // 바라보는 방향 체크
      const baseDx = base.x - hero.x;
      const baseDy = base.y - hero.y;
      const baseDist = Math.sqrt(baseDx * baseDx + baseDy * baseDy);
      if (baseDist === 0) continue;

      const baseDirX = baseDx / baseDist;
      const baseDirY = baseDy / baseDist;
      const dot = dirX * baseDirX + dirY * baseDirY;

      // 바라보는 방향 범위 밖이면 스킵 (기지는 더 관대하게)
      if (dot < -0.5) continue;

      archerTargets.push({ type: 'base', base, dist: distToBase, x: base.x, y: base.y });
    }
  }

  // 궁수: 가까운 순서로 정렬 후 multiTargetCount개 타겟 공격 (적 + 기지 통합)
  if (!isAoE && archerTargets.length > 0) {
    archerTargets.sort((a, b) => a.dist - b.dist);
    const targets = archerTargets.slice(0, multiTargetCount);
    for (const t of targets) {
      if (t.type === 'enemy') {
        const actualDamage = t.enemy.type === 'boss' ? Math.floor(finalDamage * bossDamageMultiplier) : finalDamage;
        enemyDamages.push({ enemyId: t.enemy.id, damage: actualDamage, isCritical: isCriticalHit });
        hitTargets.push({ x: t.x, y: t.y, damage: actualDamage });
      } else {
        baseDamages.push({ baseId: t.base.id, damage: finalDamage, isCritical: isCriticalHit });
        hitTargets.push({ x: t.x, y: t.y, damage: finalDamage });
      }
    }
  }

  // 범위 공격 직업 (전사, 기사, 마법사): 기지도 별도로 공격
  if (isAoE) {
    for (const base of enemyBases) {
      if (base.destroyed) continue;

      const distToBase = distance(hero.x, hero.y, base.x, base.y);
      if (distToBase > baseAttackRange) continue;

      // 바라보는 방향 체크
      const baseDx = base.x - hero.x;
      const baseDy = base.y - hero.y;
      const baseDist = Math.sqrt(baseDx * baseDx + baseDy * baseDy);
      if (baseDist === 0) continue;

      const baseDirX = baseDx / baseDist;
      const baseDirY = baseDy / baseDist;
      const dot = dirX * baseDirX + dirY * baseDirY;

      // 바라보는 방향 범위 밖이면 스킵 (기지는 더 관대하게)
      if (dot < -0.5) continue;

      baseDamages.push({ baseId: base.id, damage: finalDamage, isCritical: isCriticalHit });
      hitTargets.push({ x: base.x, y: base.y, damage: finalDamage });
    }
  }

  // 이펙트는 타겟 방향으로 표시
  const effectX = hero.x + dirX * attackRange;
  const effectY = hero.y + dirY * attackRange;

  const effect: SkillEffect = {
    type: skillConfig.type,
    position: { x: hero.x, y: hero.y }, // 영웅 위치에서 시작
    direction: { x: dirX, y: dirY },
    radius: isAoE ? attackRange : undefined,
    damage: finalDamage,
    duration: 0.4, // 이펙트 지속시간 증가
    startTime: gameTime,
    hitTargets, // 피격 대상 위치들
    heroClass, // 직업 정보 (렌더링용)
    advancedClass: hero.advancedClass, // 전직 직업 정보 (이펙트 색상 차별화용)
  };

  let updatedHero = startSkillCooldown(hero, skillConfig.type);

  // 피해흡혈 적용: 전사 패시브 (전사만) + 광전사 버프 (모든 클래스)
  if (enemyDamages.length > 0) {
    const totalDamage = enemyDamages.reduce((sum, ed) => sum + ed.damage, 0);

    // 전사 패시브 피해흡혈 (전사만)
    let passiveTotal = 0;
    if (heroClass === 'warrior') {
      const baseLifesteal = hero.characterLevel >= PASSIVE_UNLOCK_LEVEL ? (classConfig.passive.lifesteal || 0) : 0;
      const growthLifesteal = hero.passiveGrowth?.currentValue || 0;
      passiveTotal = baseLifesteal + growthLifesteal;

      // 버서커 전직 시 피해흡혈 배율 적용
      if (hero.advancedClass === 'berserker') {
        const multiplier = ADVANCED_CLASS_CONFIGS.berserker.specialEffects.lifestealMultiplier || 1;
        passiveTotal *= multiplier;
      }
    }

    // 광전사 버프 피해흡혈 (모든 클래스에 적용)
    const buffLifesteal = berserkerBuff?.lifesteal || 0;

    // 곱연산: (1 + 패시브) * (1 + 버프) - 1
    const totalLifesteal = passiveTotal > 0 || buffLifesteal > 0
      ? (1 + passiveTotal) * (1 + buffLifesteal) - 1
      : 0;

    if (totalLifesteal > 0) {
      const healAmount = Math.floor(totalDamage * totalLifesteal);
      if (healAmount > 0) {
        updatedHero = {
          ...updatedHero,
          hp: Math.min(updatedHero.maxHp, updatedHero.hp + healAmount),
        };
      }
    }
  }

  // 기사/가디언/팔라딘: Q 스킬 적중 시 W 스킬 쿨타임 1초 감소 (적중당)
  // - 기본 기사 (knight without advancedClass)
  // - 팔라딘 (knight + paladin)
  // - 가디언 (warrior + guardian)
  // 참고: 다크나이트(darkKnight)는 이 기능이 없음
  const hasWCooldownReduction =
    hero.advancedClass === 'guardian' ||
    hero.advancedClass === 'paladin' ||
    (heroClass === 'knight' && !hero.advancedClass);

  if (hasWCooldownReduction && enemyDamages.length > 0) {
    const cooldownReduction = 1.0 * enemyDamages.length; // 적중한 적 수만큼 1초씩 감소
    // 전직이 있으면 전직 W스킬, 없으면 기본 클래스 W스킬
    const wSkillType = hero.advancedClass
      ? ADVANCED_W_SKILLS[hero.advancedClass].type
      : CLASS_SKILLS.knight.w.type;
    const updatedSkills = updatedHero.skills.map((skill) => {
      if (skill.type === wSkillType && skill.currentCooldown > 0) {
        return {
          ...skill,
          currentCooldown: Math.max(0, skill.currentCooldown - cooldownReduction),
        };
      }
      return skill;
    });
    updatedHero = { ...updatedHero, skills: updatedSkills };
  }

  // 팔라딘: 기본 공격 시 주변 아군 힐 (본인 제외, 아군 최대 HP 5% 회복)
  const allyHeals: { heroId: string; heal: number }[] = [];
  if (hero.advancedClass === 'paladin' && enemyDamages.length > 0) {
    const advancedConfig = ADVANCED_CLASS_CONFIGS.paladin;
    const basicAttackHeal = advancedConfig.specialEffects.basicAttackHeal;
    if (basicAttackHeal) {
      const healRange = basicAttackHeal.range;
      const healPercent = basicAttackHeal.healPercent;

      for (const ally of allies) {
        if (ally.id === hero.id) continue;
        if (ally.hp <= 0) continue;

        const allyDist = distance(hero.x, hero.y, ally.x, ally.y);
        if (allyDist <= healRange) {
          const healAmount = Math.floor(ally.maxHp * healPercent);
          if (healAmount > 0) {
            allyHeals.push({ heroId: ally.id, heal: healAmount });
          }
        }
      }
    }
  }

  return { hero: updatedHero, effect, enemyDamages, baseDamages, allyHeals: allyHeals.length > 0 ? allyHeals : undefined };
}

/**
 * 직업별 W 스킬 실행
 */
export function executeWSkill(
  hero: HeroUnit,
  enemies: RPGEnemy[],
  targetX: number,
  targetY: number,
  gameTime: number,
  enemyBases: EnemyBase[] = [],  // 적 기지 (선택적)
  attackUpgradeLevel: number = 0,  // 인게임 공격력 업그레이드 레벨
  allies: HeroUnit[] = []  // 아군 히어로들 (힐/버프용)
): ClassSkillResult {
  // 전직 캐릭터인 경우 전직 스킬 실행
  if (hero.advancedClass) {
    return executeAdvancedWSkill(hero, enemies, targetX, targetY, gameTime, enemyBases, attackUpgradeLevel, allies);
  }

  const heroClass = hero.heroClass;
  const skillConfig = CLASS_SKILLS[heroClass].w;
  const classConfig = CLASS_CONFIGS[heroClass];
  const baseDamage = hero.config.attack || hero.baseAttack;
  // 인게임 골드 업그레이드 보너스 적용
  const attackBonus = attackUpgradeLevel * UPGRADE_CONFIG.attack.perLevel;
  let damage = Math.floor((baseDamage + attackBonus) * ((skillConfig as any).damageMultiplier || 1.0));

  // 마법사: 보스 데미지 보너스 배율 계산 (보스에게만 적용)
  // 1. 패시브 성장 (레벨 5: 25% 시작, 레벨당 +1%, 최대 +100%)
  // 2. 대마법사 전직 보너스: x1.5 (곱연산)
  let bossDamageMultiplier = 1.0;
  if (heroClass === 'mage') {
    const passiveBossDamageBonus = hero.passiveGrowth?.currentValue || 0;
    bossDamageMultiplier = 1 + passiveBossDamageBonus;
    // 대마법사 전직 보너스 (곱연산)
    if (hero.advancedClass === 'archmage') {
      bossDamageMultiplier *= 1 + (ADVANCED_CLASS_CONFIGS.archmage.specialEffects.bossBonus || 0);
    }
  }

  const enemyDamages: { enemyId: string; damage: number }[] = [];
  const baseDamages: { baseId: EnemyBaseId; damage: number }[] = [];
  const stunTargets: string[] = [];
  let effect: SkillEffect | undefined;
  let updatedHero = hero;
  let returnStunDuration: number | undefined;

  let buff: Buff | undefined;

  switch (heroClass) {
    case 'warrior':
      // 돌진 - 전방으로 돌진하며 경로상 적에게 150% 데미지 (돌진 중 무적)
      {
        const dashDistance = (skillConfig as any).distance || 200;
        const invincibleDuration = (skillConfig as any).invincibleDuration || 2.0;
        const dashDuration = 0.25; // 돌진 애니메이션 지속 시간
        const dx = targetX - hero.x;
        const dy = targetY - hero.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const dirX = dist > 0 ? dx / dist : 1;
        const dirY = dist > 0 ? dy / dist : 0;

        const newX = Math.max(30, Math.min(RPG_CONFIG.MAP_WIDTH - 30, hero.x + dirX * dashDistance));
        const newY = Math.max(30, Math.min(RPG_CONFIG.MAP_HEIGHT - 30, hero.y + dirY * dashDistance));

        // 돌진 경로상 적에게 데미지 (즉시 적용)
        for (const enemy of enemies) {
          if (enemy.hp <= 0) continue;
          const enemyDist = pointToLineDistance(enemy.x, enemy.y, hero.x, hero.y, newX, newY);
          if (enemyDist <= 50) {
            enemyDamages.push({ enemyId: enemy.id, damage });
          }
        }

        // 돌진 경로상 기지에 데미지
        for (const base of enemyBases) {
          if (base.destroyed) continue;
          const baseDist = pointToLineDistance(base.x, base.y, hero.x, hero.y, newX, newY);
          if (baseDist <= 80) {  // 기지는 크기가 크므로 더 넓은 범위
            baseDamages.push({ baseId: base.id, damage });
          }
        }

        effect = {
          type: skillConfig.type,
          position: { x: hero.x, y: hero.y },
          direction: { x: dirX, y: dirY },
          radius: dashDistance,
          damage,
          duration: dashDuration + 0.1,
          startTime: gameTime,
        };

        // 돌진 후 무적 버프 추가
        buff = {
          type: 'invincible',
          duration: invincibleDuration,
          startTime: gameTime,
        };

        // 돌진 상태 설정 (애니메이션용) - 위치는 즉시 변경하지 않음
        updatedHero = {
          ...hero,
          targetPosition: undefined,
          state: 'moving',
          facingRight: dirX >= 0,
          facingAngle: Math.atan2(dirY, dirX),
          dashState: {
            startX: hero.x,
            startY: hero.y,
            targetX: newX,
            targetY: newY,
            progress: 0,
            duration: dashDuration,
            dirX,
            dirY,
          },
        };
      }
      break;

    case 'archer':
      // 관통 화살 - 일직선 관통 공격
      {
        const pierceDistance = (skillConfig as any).pierceDistance || 300;
        const dx = targetX - hero.x;
        const dy = targetY - hero.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const dirX = dist > 0 ? dx / dist : 1;
        const dirY = dist > 0 ? dy / dist : 0;

        const endX = hero.x + dirX * pierceDistance;
        const endY = hero.y + dirY * pierceDistance;

        for (const enemy of enemies) {
          if (enemy.hp <= 0) continue;
          const enemyDist = pointToLineDistance(enemy.x, enemy.y, hero.x, hero.y, endX, endY);
          if (enemyDist <= 30) {
            enemyDamages.push({ enemyId: enemy.id, damage });
          }
        }

        // 관통 화살 경로상 기지에 데미지
        for (const base of enemyBases) {
          if (base.destroyed) continue;
          const baseDist = pointToLineDistance(base.x, base.y, hero.x, hero.y, endX, endY);
          if (baseDist <= 60) {
            baseDamages.push({ baseId: base.id, damage });
          }
        }

        effect = {
          type: skillConfig.type,
          position: { x: hero.x, y: hero.y },
          direction: { x: dirX, y: dirY },
          radius: pierceDistance,
          damage,
          duration: 0.4,
          startTime: gameTime,
        };
      }
      break;

    case 'knight':
      // 방패 돌진 - 전방 돌진하며 경로상 적에게 최대 HP 10% 데미지 + 2초 기절
      {
        const dashDistance = (skillConfig as any).distance || 150;
        const stunDuration = 2.0; // 기절 지속 시간 (초)
        const hpDamagePercent = (skillConfig as any).hpDamagePercent || 0.1; // 최대 HP의 10%
        const hpBasedDamage = Math.floor(hero.maxHp * hpDamagePercent);
        const dashDuration = 0.25; // 돌진 애니메이션 지속 시간
        const dx = targetX - hero.x;
        const dy = targetY - hero.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const dirX = dist > 0 ? dx / dist : 1;
        const dirY = dist > 0 ? dy / dist : 0;

        const newX = Math.max(30, Math.min(RPG_CONFIG.MAP_WIDTH - 30, hero.x + dirX * dashDistance));
        const newY = Math.max(30, Math.min(RPG_CONFIG.MAP_HEIGHT - 30, hero.y + dirY * dashDistance));

        // 돌진 경로상 적에게 HP 기반 데미지 + 기절 적용
        for (const enemy of enemies) {
          if (enemy.hp <= 0) continue;
          const enemyDist = pointToLineDistance(enemy.x, enemy.y, hero.x, hero.y, newX, newY);
          if (enemyDist <= 50) {
            // HP 기반 데미지 적용
            enemyDamages.push({ enemyId: enemy.id, damage: hpBasedDamage });
            // 기절 적용
            stunTargets.push(enemy.id);
          }
        }

        // 돌진 경로상 기지에 HP 기반 데미지
        for (const base of enemyBases) {
          if (base.destroyed) continue;
          const baseDist = pointToLineDistance(base.x, base.y, hero.x, hero.y, newX, newY);
          if (baseDist <= 80) {
            baseDamages.push({ baseId: base.id, damage: hpBasedDamage });
          }
        }

        // 기절 지속시간 설정
        returnStunDuration = stunDuration;

        effect = {
          type: skillConfig.type,
          position: { x: hero.x, y: hero.y },
          targetPosition: { x: newX, y: newY },
          direction: { x: dirX, y: dirY },
          radius: dashDistance,
          duration: dashDuration + 0.5, // 이펙트 지속시간
          startTime: gameTime,
        };

        // 돌진 상태 설정 (애니메이션용) - 위치는 즉시 변경하지 않음
        updatedHero = {
          ...hero,
          targetPosition: undefined,
          state: 'moving',
          facingRight: dirX >= 0,
          facingAngle: Math.atan2(dirY, dirX),
          dashState: {
            startX: hero.x,
            startY: hero.y,
            targetX: newX,
            targetY: newY,
            progress: 0,
            duration: dashDuration,
            dirX,
            dirY,
          },
        };
      }
      break;

    case 'mage':
      // 화염구 - 범위 공격
      {
        const radius = (skillConfig as any).radius || 80;

        // 방향 계산 (영웅 → 타겟)
        const dx = targetX - hero.x;
        const dy = targetY - hero.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const dirX = dist > 0 ? dx / dist : 1;
        const dirY = dist > 0 ? dy / dist : 0;

        for (const enemy of enemies) {
          if (enemy.hp <= 0) continue;
          const enemyDist = distance(targetX, targetY, enemy.x, enemy.y);
          if (enemyDist <= radius) {
            // 보스에게만 데미지 보너스 적용
            const actualDamage = enemy.type === 'boss' ? Math.floor(damage * bossDamageMultiplier) : damage;
            enemyDamages.push({ enemyId: enemy.id, damage: actualDamage });
          }
        }

        // 화염구 범위 내 기지에 데미지
        for (const base of enemyBases) {
          if (base.destroyed) continue;
          const baseDist = distance(targetX, targetY, base.x, base.y);
          if (baseDist <= radius + 50) {  // 기지는 크기가 크므로 추가 반경
            baseDamages.push({ baseId: base.id, damage });
          }
        }

        effect = {
          type: skillConfig.type,
          position: { x: targetX, y: targetY },
          direction: { x: dirX, y: dirY },
          radius,
          damage,
          duration: 0.7, // 화염구 발사 + 폭발 시간
          startTime: gameTime,
        };
      }
      break;
  }

  updatedHero = startSkillCooldown(updatedHero, skillConfig.type);

  return { hero: updatedHero, effect, enemyDamages, baseDamages, stunTargets, stunDuration: returnStunDuration, buff };
}

/**
 * 직업별 E 스킬 실행 (궁극기)
 */
export function executeESkill(
  hero: HeroUnit,
  enemies: RPGEnemy[],
  targetX: number,
  targetY: number,
  gameTime: number,
  enemyBases: EnemyBase[] = [],  // 적 기지 (선택적)
  casterId?: string,  // 스킬 시전자 ID (보스 골드 분배용)
  attackUpgradeLevel: number = 0,  // 인게임 공격력 업그레이드 레벨
  allies: HeroUnit[] = []  // 아군 히어로들 (힐/버프용)
): ClassSkillResult {
  // 전직 캐릭터인 경우 전직 스킬 실행
  if (hero.advancedClass) {
    return executeAdvancedESkill(hero, enemies, targetX, targetY, gameTime, enemyBases, casterId, attackUpgradeLevel, allies);
  }

  const heroClass = hero.heroClass;
  const skillConfig = CLASS_SKILLS[heroClass].e;
  const classConfig = CLASS_CONFIGS[heroClass];
  const baseDamage = hero.config.attack || hero.baseAttack;
  // 인게임 골드 업그레이드 보너스 적용
  const attackBonus = attackUpgradeLevel * UPGRADE_CONFIG.attack.perLevel;
  let damage = Math.floor((baseDamage + attackBonus) * ((skillConfig as any).damageMultiplier || 1.0));

  // 마법사: 보스 데미지 보너스 배율 계산 (보스에게만 적용)
  // 1. 패시브 성장 (레벨 5: 25% 시작, 레벨당 +1%, 최대 +100%)
  // 2. 대마법사 전직 보너스: x1.5 (곱연산)
  let bossDamageMultiplier = 1.0;
  if (heroClass === 'mage') {
    const passiveBossDamageBonus = hero.passiveGrowth?.currentValue || 0;
    bossDamageMultiplier = 1 + passiveBossDamageBonus;
    // 대마법사 전직 보너스 (곱연산)
    if (hero.advancedClass === 'archmage') {
      bossDamageMultiplier *= 1 + (ADVANCED_CLASS_CONFIGS.archmage.specialEffects.bossBonus || 0);
    }
  }

  const enemyDamages: { enemyId: string; damage: number }[] = [];
  const baseDamages: { baseId: EnemyBaseId; damage: number }[] = [];
  const allyHeals: { heroId: string; heal: number }[] = [];
  const allyBuffs: { heroId: string; buff: Buff }[] = [];
  let effect: SkillEffect | undefined;
  let buff: Buff | undefined;
  let pendingSkill: PendingSkill | undefined;
  let updatedHero = hero;

  switch (heroClass) {
    case 'warrior':
      // 광전사 - 공격력/공속 증가 + 피해흡혈 버프
      {
        const duration = (skillConfig as any).duration || 10;
        const attackBonus = (skillConfig as any).attackBonus || 0.5;
        const speedBonus = (skillConfig as any).speedBonus || 0.3;
        const lifesteal = 0.5; // 피해량의 50% 흡혈

        buff = {
          type: 'berserker',
          duration,
          startTime: gameTime,
          attackBonus,
          speedBonus,
          lifesteal,
        };

        effect = {
          type: skillConfig.type,
          position: { x: hero.x, y: hero.y },
          duration: 1.0,
          startTime: gameTime,
        };
      }
      break;

    case 'archer':
      // 화살 비 - 범위 내 모든 적에게 데미지
      {
        const radius = (skillConfig as any).radius || 150;

        for (const enemy of enemies) {
          if (enemy.hp <= 0) continue;
          const dist = distance(targetX, targetY, enemy.x, enemy.y);
          if (dist <= radius) {
            enemyDamages.push({ enemyId: enemy.id, damage });
          }
        }

        // 화살 비 범위 내 기지에 데미지
        for (const base of enemyBases) {
          if (base.destroyed) continue;
          const baseDist = distance(targetX, targetY, base.x, base.y);
          if (baseDist <= radius + 50) {  // 기지는 크기가 크므로 추가 반경
            baseDamages.push({ baseId: base.id, damage });
          }
        }

        effect = {
          type: skillConfig.type,
          position: { x: targetX, y: targetY },
          radius,
          damage,
          duration: 1.0,
          startTime: gameTime,
        };
      }
      break;

    case 'knight':
      // 철벽 방어 - 아군 전체 데미지 감소 + HP 회복
      {
        const duration = (skillConfig as any).duration || 5;
        const damageReduction = (skillConfig as any).damageReduction || 0.7;
        const healPercent = (skillConfig as any).healPercent || 0.2;

        // 자신에게 버프 적용
        buff = {
          type: 'ironwall',
          duration,
          startTime: gameTime,
          damageReduction,
        };

        // 자신 HP 회복
        const selfHealAmount = Math.floor(hero.maxHp * healPercent);
        updatedHero = { ...hero, hp: Math.min(hero.maxHp, hero.hp + selfHealAmount) };

        // 아군 전체에게 버프 및 힐 적용
        for (const ally of allies) {
          if (ally.id === hero.id) continue;  // 자신 제외 (위에서 처리)
          if (ally.hp <= 0) continue;
          const allyHealAmount = Math.floor(ally.maxHp * healPercent);
          allyHeals.push({ heroId: ally.id, heal: allyHealAmount });
          allyBuffs.push({
            heroId: ally.id,
            buff: { type: 'ironwall', duration, startTime: gameTime, damageReduction },
          });
        }

        effect = {
          type: skillConfig.type,
          position: { x: hero.x, y: hero.y },
          heal: selfHealAmount,
          duration: 1.0,
          startTime: gameTime,
        };
      }
      break;

    case 'mage':
      // 운석 낙하 - 3초 후 대범위 공격
      {
        const radius = (skillConfig as any).radius || 150;
        const delay = (skillConfig as any).delay || 3.0;

        pendingSkill = {
          type: skillConfig.type,
          position: { x: targetX, y: targetY },
          triggerTime: gameTime + delay,
          damage,
          radius,
          casterId: casterId || hero.id,
          bossDamageMultiplier, // 보스 데미지 배율 저장
        };

        // 경고 이펙트
        effect = {
          type: 'mage_e' as SkillType,
          position: { x: targetX, y: targetY },
          radius,
          damage: 0, // 경고용
          duration: delay,
          startTime: gameTime,
        };
      }
      break;
  }

  updatedHero = startSkillCooldown(updatedHero, skillConfig.type);

  return {
    hero: updatedHero,
    effect,
    enemyDamages,
    baseDamages,
    buff,
    pendingSkill,
    allyHeals: allyHeals.length > 0 ? allyHeals : undefined,
    allyBuffs: allyBuffs.length > 0 ? allyBuffs : undefined,
  };
}

/**
 * 점과 선분 사이의 거리 계산
 */
function pointToLineDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx: number, yy: number;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = px - xx;
  const dy = py - yy;

  return Math.sqrt(dx * dx + dy * dy);
}

// ============================================
// 전직 스킬 실행 함수들
// ============================================

/**
 * 전직 W 스킬 실행
 */
function executeAdvancedWSkill(
  hero: HeroUnit,
  enemies: RPGEnemy[],
  targetX: number,
  targetY: number,
  gameTime: number,
  enemyBases: EnemyBase[],
  attackUpgradeLevel: number,
  allies: HeroUnit[]
): ClassSkillResult {
  const advancedClass = hero.advancedClass as AdvancedHeroClass;
  const skillConfig = ADVANCED_W_SKILLS[advancedClass];
  const baseDamage = hero.config.attack || hero.baseAttack;
  const attackBonus = attackUpgradeLevel * UPGRADE_CONFIG.attack.perLevel;
  const damage = Math.floor((baseDamage + attackBonus) * (skillConfig.damageMultiplier || 1.0));

  const enemyDamages: { enemyId: string; damage: number }[] = [];
  const baseDamages: { baseId: EnemyBaseId; damage: number }[] = [];
  const stunTargets: string[] = [];
  const allyHeals: { heroId: string; heal: number }[] = [];
  const allyBuffs: { heroId: string; buff: Buff }[] = [];
  let effect: SkillEffect | undefined;
  let buff: Buff | undefined;
  let pendingSkill: PendingSkill | undefined;
  let updatedHero = hero;
  let returnStunDuration: number | undefined;

  // 방향 계산
  const dx = targetX - hero.x;
  const dy = targetY - hero.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const dirX = dist > 0 ? dx / dist : (hero.facingRight ? 1 : -1);
  const dirY = dist > 0 ? dy / dist : 0;

  switch (advancedClass) {
    case 'berserker':
      // 피의 돌진 - 전방 돌진 + 피해량의 50% 체력 회복
      {
        const dashDistance = skillConfig.distance || 200;
        const dashDuration = 0.25;
        const lifestealPercent = skillConfig.lifestealPercent || 0.5;

        const newX = Math.max(30, Math.min(RPG_CONFIG.MAP_WIDTH - 30, hero.x + dirX * dashDistance));
        const newY = Math.max(30, Math.min(RPG_CONFIG.MAP_HEIGHT - 30, hero.y + dirY * dashDistance));

        // 돌진 경로상 적에게 데미지
        let totalDamageDealt = 0;
        for (const enemy of enemies) {
          if (enemy.hp <= 0) continue;
          const enemyDist = pointToLineDistance(enemy.x, enemy.y, hero.x, hero.y, newX, newY);
          if (enemyDist <= 50) {
            enemyDamages.push({ enemyId: enemy.id, damage });
            totalDamageDealt += damage;
          }
        }

        // 돌진 경로상 기지에 데미지
        for (const base of enemyBases) {
          if (base.destroyed) continue;
          const baseDist = pointToLineDistance(base.x, base.y, hero.x, hero.y, newX, newY);
          if (baseDist <= 80) {
            baseDamages.push({ baseId: base.id, damage });
          }
        }

        // 피해흡혈 적용
        const healAmount = Math.floor(totalDamageDealt * lifestealPercent);
        if (healAmount > 0) {
          updatedHero = {
            ...hero,
            hp: Math.min(hero.maxHp, hero.hp + healAmount),
          };
        }

        effect = {
          type: skillConfig.type,
          position: { x: hero.x, y: hero.y },
          direction: { x: dirX, y: dirY },
          radius: dashDistance,
          damage,
          duration: dashDuration + 0.1,
          startTime: gameTime,
          heal: healAmount,
        };

        // 돌진 상태 설정
        updatedHero = {
          ...updatedHero,
          targetPosition: undefined,
          state: 'moving',
          facingRight: dirX >= 0,
          facingAngle: Math.atan2(dirY, dirX),
          dashState: {
            startX: hero.x,
            startY: hero.y,
            targetX: newX,
            targetY: newY,
            progress: 0,
            duration: dashDuration,
            dirX,
            dirY,
          },
        };
      }
      break;

    case 'guardian':
      // 수호의 돌진 - 전방 돌진 + 기절 + 보호막 (자신 + 주변 아군)
      {
        const dashDistance = skillConfig.distance || 150;
        const dashDuration = 0.25;
        const stunDuration = skillConfig.stunDuration || 2.0;
        const shieldPercent = skillConfig.shieldPercent || 0.2;
        const shieldDuration = skillConfig.duration || 3;
        const hpBasedDamage = Math.floor(hero.maxHp * (skillConfig.damageMultiplier || 0.1));
        const shieldShareRange = 200; // 보호막 공유 범위

        const newX = Math.max(30, Math.min(RPG_CONFIG.MAP_WIDTH - 30, hero.x + dirX * dashDistance));
        const newY = Math.max(30, Math.min(RPG_CONFIG.MAP_HEIGHT - 30, hero.y + dirY * dashDistance));

        // 돌진 경로상 적에게 HP 기반 데미지 + 기절
        for (const enemy of enemies) {
          if (enemy.hp <= 0) continue;
          const enemyDist = pointToLineDistance(enemy.x, enemy.y, hero.x, hero.y, newX, newY);
          if (enemyDist <= 50) {
            enemyDamages.push({ enemyId: enemy.id, damage: hpBasedDamage });
            stunTargets.push(enemy.id);
          }
        }

        // 돌진 경로상 기지에 데미지
        for (const base of enemyBases) {
          if (base.destroyed) continue;
          const baseDist = pointToLineDistance(base.x, base.y, hero.x, hero.y, newX, newY);
          if (baseDist <= 80) {
            baseDamages.push({ baseId: base.id, damage: hpBasedDamage });
          }
        }

        returnStunDuration = stunDuration;

        // 보호막 버프 (최대 HP 20% 데미지 흡수)
        buff = {
          type: 'ironwall',
          duration: shieldDuration,
          startTime: gameTime,
          damageReduction: shieldPercent,  // 실제로는 shield amount로 처리 필요
        };

        // 주변 아군에게 보호막 공유
        for (const ally of allies) {
          if (ally.id === hero.id) continue;
          if (ally.hp <= 0) continue;
          const allyDist = distance(hero.x, hero.y, ally.x, ally.y);
          if (allyDist <= shieldShareRange) {
            allyBuffs.push({
              heroId: ally.id,
              buff: {
                type: 'ironwall',
                duration: shieldDuration,
                startTime: gameTime,
                damageReduction: shieldPercent,
              },
            });
          }
        }

        effect = {
          type: skillConfig.type,
          position: { x: hero.x, y: hero.y },
          targetPosition: { x: newX, y: newY },
          direction: { x: dirX, y: dirY },
          radius: dashDistance,
          duration: dashDuration + 0.5,
          startTime: gameTime,
        };

        // 돌진 상태 설정
        updatedHero = {
          ...hero,
          targetPosition: undefined,
          state: 'moving',
          facingRight: dirX >= 0,
          facingAngle: Math.atan2(dirY, dirX),
          dashState: {
            startX: hero.x,
            startY: hero.y,
            targetX: newX,
            targetY: newY,
            progress: 0,
            duration: dashDuration,
            dirX,
            dirY,
          },
        };
      }
      break;

    case 'sniper':
      // 후방 도약 - 뒤로 점프하며 전방에 200% 데미지 화살 발사
      {
        const jumpDistance = skillConfig.distance || 150;
        const speedBonus = skillConfig.speedBonus || 0.3;
        const speedDuration = skillConfig.duration || 3;
        const jumpDuration = 0.2;

        // 뒤로 점프 (타겟 반대 방향)
        const backX = Math.max(30, Math.min(RPG_CONFIG.MAP_WIDTH - 30, hero.x - dirX * jumpDistance));
        const backY = Math.max(30, Math.min(RPG_CONFIG.MAP_HEIGHT - 30, hero.y - dirY * jumpDistance));

        // 점프하면서 전방 적에게 200% 데미지 화살
        const arrowRange = hero.config.range || 200;
        for (const enemy of enemies) {
          if (enemy.hp <= 0) continue;
          const enemyDist = distance(hero.x, hero.y, enemy.x, enemy.y);
          if (enemyDist > arrowRange) continue;

          // 바라보는 방향 체크
          const enemyDx = enemy.x - hero.x;
          const enemyDy = enemy.y - hero.y;
          const enemyDirDist = Math.sqrt(enemyDx * enemyDx + enemyDy * enemyDy);
          if (enemyDirDist === 0) continue;
          const dot = (dirX * enemyDx + dirY * enemyDy) / enemyDirDist;
          if (dot > 0.3) {  // 전방 60도 내
            enemyDamages.push({ enemyId: enemy.id, damage });
          }
        }

        // 전방 기지에 데미지
        for (const base of enemyBases) {
          if (base.destroyed) continue;
          const baseDist = distance(hero.x, hero.y, base.x, base.y);
          if (baseDist > arrowRange) continue;

          // 바라보는 방향 체크
          const baseDx = base.x - hero.x;
          const baseDy = base.y - hero.y;
          const baseDirDist = Math.sqrt(baseDx * baseDx + baseDy * baseDy);
          if (baseDirDist === 0) continue;
          const dot = (dirX * baseDx + dirY * baseDy) / baseDirDist;
          if (dot > 0.3) {  // 전방 60도 내
            baseDamages.push({ baseId: base.id, damage });
          }
        }

        // 이동속도 버프
        buff = {
          type: 'swiftness',
          duration: speedDuration,
          startTime: gameTime,
          moveSpeedBonus: speedBonus,
        };

        effect = {
          type: skillConfig.type,
          position: { x: hero.x, y: hero.y },
          direction: { x: dirX, y: dirY },
          radius: arrowRange,
          damage,
          duration: 0.5,
          startTime: gameTime,
        };

        // 후방 점프 상태 설정
        updatedHero = {
          ...hero,
          targetPosition: undefined,
          state: 'moving',
          facingRight: dirX >= 0,
          facingAngle: Math.atan2(dirY, dirX),
          dashState: {
            startX: hero.x,
            startY: hero.y,
            targetX: backX,
            targetY: backY,
            progress: 0,
            duration: jumpDuration,
            dirX: -dirX,
            dirY: -dirY,
          },
        };
      }
      break;

    case 'ranger':
      // 다중 화살 - 부채꼴 방향으로 5발의 관통 화살 발사
      {
        const arrowCount = skillConfig.arrowCount || 5;
        const pierceDistance = 300;
        const spreadAngle = Math.PI / 4;  // 45도 부채꼴

        for (let i = 0; i < arrowCount; i++) {
          // 부채꼴 각도 계산
          const angleOffset = spreadAngle * ((i / (arrowCount - 1)) - 0.5);
          const baseAngle = Math.atan2(dirY, dirX);
          const arrowAngle = baseAngle + angleOffset;
          const arrowDirX = Math.cos(arrowAngle);
          const arrowDirY = Math.sin(arrowAngle);

          const endX = hero.x + arrowDirX * pierceDistance;
          const endY = hero.y + arrowDirY * pierceDistance;

          // 각 화살 경로의 적에게 데미지
          for (const enemy of enemies) {
            if (enemy.hp <= 0) continue;
            const enemyDist = pointToLineDistance(enemy.x, enemy.y, hero.x, hero.y, endX, endY);
            if (enemyDist <= 30) {
              // 이미 맞은 적은 제외 (관통이지만 같은 스킬에서 중복 제외)
              if (!enemyDamages.find(ed => ed.enemyId === enemy.id)) {
                enemyDamages.push({ enemyId: enemy.id, damage });
              }
            }
          }

          // 기지에 데미지
          for (const base of enemyBases) {
            if (base.destroyed) continue;
            const baseDist = pointToLineDistance(base.x, base.y, hero.x, hero.y, endX, endY);
            if (baseDist <= 60) {
              if (!baseDamages.find(bd => bd.baseId === base.id)) {
                baseDamages.push({ baseId: base.id, damage });
              }
            }
          }
        }

        effect = {
          type: skillConfig.type,
          position: { x: hero.x, y: hero.y },
          direction: { x: dirX, y: dirY },
          radius: pierceDistance,
          damage,
          duration: 0.5,
          startTime: gameTime,
        };
      }
      break;

    case 'paladin':
      // 신성한 돌진 - 전방 돌진 + 기절 + 아군 힐
      {
        const dashDistance = skillConfig.distance || 150;
        const dashDuration = 0.25;
        const stunDuration = skillConfig.stunDuration || 1.5;
        const healPercent = skillConfig.healPercent || 0.1;
        const healRadius = skillConfig.radius || 200;
        const hpBasedDamage = Math.floor(hero.maxHp * (skillConfig.damageMultiplier || 0.1));

        const newX = Math.max(30, Math.min(RPG_CONFIG.MAP_WIDTH - 30, hero.x + dirX * dashDistance));
        const newY = Math.max(30, Math.min(RPG_CONFIG.MAP_HEIGHT - 30, hero.y + dirY * dashDistance));

        // 돌진 경로상 적에게 데미지 + 기절
        for (const enemy of enemies) {
          if (enemy.hp <= 0) continue;
          const enemyDist = pointToLineDistance(enemy.x, enemy.y, hero.x, hero.y, newX, newY);
          if (enemyDist <= 50) {
            enemyDamages.push({ enemyId: enemy.id, damage: hpBasedDamage });
            stunTargets.push(enemy.id);
          }
        }

        // 돌진 경로상 기지에 데미지
        for (const base of enemyBases) {
          if (base.destroyed) continue;
          const baseDist = pointToLineDistance(base.x, base.y, hero.x, hero.y, newX, newY);
          if (baseDist <= 80) {
            baseDamages.push({ baseId: base.id, damage: hpBasedDamage });
          }
        }

        returnStunDuration = stunDuration;

        // 아군 힐 (도착지점 주변)
        for (const ally of allies) {
          if (ally.id === hero.id) continue;  // 자기 자신 제외
          if (ally.hp <= 0) continue;  // 사망한 아군 제외
          const allyDist = distance(newX, newY, ally.x, ally.y);
          if (allyDist <= healRadius) {
            const healAmount = Math.floor(ally.maxHp * healPercent);
            allyHeals.push({ heroId: ally.id, heal: healAmount });
          }
        }

        effect = {
          type: skillConfig.type,
          position: { x: hero.x, y: hero.y },
          targetPosition: { x: newX, y: newY },
          direction: { x: dirX, y: dirY },
          radius: dashDistance,
          duration: dashDuration + 0.5,
          startTime: gameTime,
        };

        // 돌진 상태 설정
        updatedHero = {
          ...hero,
          targetPosition: undefined,
          state: 'moving',
          facingRight: dirX >= 0,
          facingAngle: Math.atan2(dirY, dirX),
          dashState: {
            startX: hero.x,
            startY: hero.y,
            targetX: newX,
            targetY: newY,
            progress: 0,
            duration: dashDuration,
            dirX,
            dirY,
          },
        };
      }
      break;

    case 'darkKnight':
      // 강타 - 1초 시전 후 전방 150px 범위에 350% 데미지, HP 20% 소모
      {
        const hpCostRatio = skillConfig.hpCostRatio || 0.20;
        const hpCost = Math.floor(hero.maxHp * hpCostRatio);

        // HP가 비용보다 적으면 사용 불가
        if (hero.hp <= hpCost) {
          return { hero, enemyDamages: [], baseDamages: [] };
        }

        // HP 차감 (클라이언트 예측)
        updatedHero = {
          ...hero,
          hp: hero.hp - hpCost,
          castingUntil: gameTime + 1.0,
        };

        // 시전 이펙트 (heroId로 영웅 추적)
        effect = {
          type: skillConfig.type,
          position: { x: hero.x, y: hero.y },
          direction: { x: dirX, y: dirY },
          damage,
          duration: 1.0,
          startTime: gameTime,
          heroId: hero.id,
        };

        // 데미지는 서버가 pendingSkill로 처리하므로 클라이언트에서 즉시 적용하지 않음
      }
      break;

    case 'archmage':
      // 폭발 화염구 - 250% 데미지 + 범위 증가 + 3초간 화상 지속 데미지
      {
        const radius = skillConfig.radius || 120;
        const burnDamage = skillConfig.burnDamage || 0.2;
        const burnDuration = skillConfig.burnDuration || 3;  // 설정값 사용 (기본 3초)

        // 즉발 데미지
        for (const enemy of enemies) {
          if (enemy.hp <= 0) continue;
          const enemyDist = distance(targetX, targetY, enemy.x, enemy.y);
          if (enemyDist <= radius) {
            enemyDamages.push({ enemyId: enemy.id, damage });
          }
        }

        // 기지에 즉발 데미지
        for (const base of enemyBases) {
          if (base.destroyed) continue;
          const baseDist = distance(targetX, targetY, base.x, base.y);
          if (baseDist <= radius + 50) {
            baseDamages.push({ baseId: base.id, damage });
          }
        }

        // 화상 지역 지속 데미지 (3초간 초당 20% 데미지)
        const burnTickDamage = Math.floor((baseDamage + attackBonus) * burnDamage);
        pendingSkill = {
          type: 'inferno_burn' as SkillType,  // 화상 지역 틱 데미지용 타입
          position: { x: targetX, y: targetY },
          triggerTime: gameTime + 1,  // 1초 후 첫 틱
          damage: burnTickDamage,
          radius,
          casterId: hero.id,
          tickCount: burnDuration,  // 설정값 틱 수
        };

        effect = {
          type: skillConfig.type,
          position: { x: targetX, y: targetY },
          direction: { x: dirX, y: dirY },
          radius,
          damage,
          duration: 0.5 + burnDuration,  // 폭발 + 화상 지속
          startTime: gameTime,
        };
      }
      break;

    case 'healer':
      // 치유의 빛 - 적에게 데미지 + 아군 힐
      {
        const radius = skillConfig.radius || 150;
        const healPercent = skillConfig.healPercent || 0.15;

        // 전방 범위 내 적에게 데미지
        for (const enemy of enemies) {
          if (enemy.hp <= 0) continue;
          const enemyDist = distance(targetX, targetY, enemy.x, enemy.y);
          if (enemyDist <= radius) {
            enemyDamages.push({ enemyId: enemy.id, damage });
          }
        }

        // 기지에 데미지
        for (const base of enemyBases) {
          if (base.destroyed) continue;
          const baseDist = distance(targetX, targetY, base.x, base.y);
          if (baseDist <= radius + 50) {
            baseDamages.push({ baseId: base.id, damage });
          }
        }

        // 자신 포함 범위 내 아군 힐
        const selfHeal = Math.floor(hero.maxHp * healPercent);
        updatedHero = {
          ...hero,
          hp: Math.min(hero.maxHp, hero.hp + selfHeal),
        };

        for (const ally of allies) {
          if (ally.id === hero.id) continue;
          if (ally.hp <= 0) continue;  // 사망한 아군 제외
          const allyDist = distance(targetX, targetY, ally.x, ally.y);
          if (allyDist <= radius) {
            const healAmount = Math.floor(ally.maxHp * healPercent);
            allyHeals.push({ heroId: ally.id, heal: healAmount });
          }
        }

        effect = {
          type: skillConfig.type,
          position: { x: targetX, y: targetY },
          direction: { x: dirX, y: dirY },
          radius,
          damage,
          heal: selfHeal,
          duration: 0.7,
          startTime: gameTime,
        };
      }
      break;
  }

  updatedHero = startSkillCooldown(updatedHero, skillConfig.type);

  return {
    hero: updatedHero,
    effect,
    enemyDamages,
    baseDamages,
    stunTargets: stunTargets.length > 0 ? stunTargets : undefined,
    stunDuration: returnStunDuration,
    buff,
    allyHeals: allyHeals.length > 0 ? allyHeals : undefined,
    allyBuffs: allyBuffs.length > 0 ? allyBuffs : undefined,
    pendingSkill,
  };
}

/**
 * 전직 E 스킬 실행 (궁극기)
 */
function executeAdvancedESkill(
  hero: HeroUnit,
  enemies: RPGEnemy[],
  targetX: number,
  targetY: number,
  gameTime: number,
  _enemyBases: EnemyBase[],  // 기지 데미지는 pendingSkill 처리 시 useRPGGameLoop에서 적용
  casterId: string | undefined,
  attackUpgradeLevel: number,
  allies: HeroUnit[]
): ClassSkillResult {
  const advancedClass = hero.advancedClass as AdvancedHeroClass;
  const skillConfig = ADVANCED_E_SKILLS[advancedClass];
  const baseDamage = hero.config.attack || hero.baseAttack;
  const attackBonus = attackUpgradeLevel * UPGRADE_CONFIG.attack.perLevel;
  const damage = Math.floor((baseDamage + attackBonus) * (skillConfig.damageMultiplier || 1.0));

  const enemyDamages: { enemyId: string; damage: number }[] = [];
  const baseDamages: { baseId: EnemyBaseId; damage: number }[] = [];
  const allyHeals: { heroId: string; heal: number }[] = [];
  const allyBuffs: { heroId: string; buff: Buff }[] = [];
  let effect: SkillEffect | undefined;
  let buff: Buff | undefined;
  let pendingSkill: PendingSkill | undefined;
  let updatedHero = hero;

  switch (advancedClass) {
    case 'berserker':
      // 광란 - 10초간 공격력/공속 100% 증가, 받는 피해 50% 증가
      {
        const duration = skillConfig.duration || 10;
        const attackBonusVal = skillConfig.attackBonus || 1.0;
        const speedBonusVal = skillConfig.speedBonus || 1.0;

        buff = {
          type: 'berserker',
          duration,
          startTime: gameTime,
          attackBonus: attackBonusVal,
          speedBonus: speedBonusVal,
          damageTaken: 0.5,
        };

        effect = {
          type: skillConfig.type,
          position: { x: hero.x, y: hero.y },
          duration: 1.0,
          startTime: gameTime,
        };
      }
      break;

    case 'guardian':
      // 보호막 - 아군 전체에게 5초간 피해 50% 감소 (사거리 제한 없음)
      {
        const duration = skillConfig.duration || 5;
        const damageReduction = skillConfig.damageReduction || 0.5;

        // 자신에게 버프
        buff = {
          type: 'ironwall',
          duration,
          startTime: gameTime,
          damageReduction,
        };

        // 아군 전체에게 버프 (사거리 제한 없음)
        for (const ally of allies) {
          if (ally.id === hero.id) continue;
          if (ally.hp <= 0) continue;  // 사망한 아군 제외
          allyBuffs.push({
            heroId: ally.id,
            buff: {
              type: 'ironwall',
              duration,
              startTime: gameTime,
              damageReduction,
            },
          });
        }

        effect = {
          type: skillConfig.type,
          position: { x: hero.x, y: hero.y },
          radius: skillConfig.radius || 300,
          duration: 1.0,
          startTime: gameTime,
        };
      }
      break;

    case 'sniper':
      // 저격 - 3초 조준 후 1000% 데미지 단일 타격
      {
        const chargeTime = skillConfig.chargeTime || 3;
        const snipeDamage = Math.floor((baseDamage + attackBonus) * (skillConfig.damageMultiplier || 10.0));

        // 타겟팅: 마우스 위치 기준 가장 가까운 적, 보스 우선 (무제한 사거리)
        let targetEnemy: RPGEnemy | null = null;
        let closestBoss: RPGEnemy | null = null;
        let closestNormal: RPGEnemy | null = null;
        let closestBossDist = Infinity;
        let closestNormalDist = Infinity;

        for (const enemy of enemies) {
          if (enemy.hp <= 0) continue;
          const dist = distance(targetX, targetY, enemy.x, enemy.y);
          if (enemy.type === 'boss') {
            if (dist < closestBossDist) {
              closestBossDist = dist;
              closestBoss = enemy;
            }
          } else {
            if (dist < closestNormalDist) {
              closestNormalDist = dist;
              closestNormal = enemy;
            }
          }
        }

        // 보스 우선, 없으면 일반 적
        targetEnemy = closestBoss || closestNormal;

        // 타겟이 없으면 스킬 사용 취소 (쿨다운 시작 안 함)
        if (!targetEnemy) {
          return {
            hero,
            enemyDamages: [],
            baseDamages: [],
          };
        }

        // 지연 스킬로 처리
        pendingSkill = {
          type: skillConfig.type,
          position: { x: targetEnemy.x, y: targetEnemy.y },
          triggerTime: gameTime + chargeTime,
          damage: snipeDamage,
          radius: 0,  // 단일 타겟
          casterId: casterId || hero.id,
          targetId: targetEnemy.id,
        };

        effect = {
          type: 'snipe' as SkillType,
          position: { x: hero.x, y: hero.y },
          targetPosition: { x: targetEnemy.x, y: targetEnemy.y },
          duration: chargeTime,
          startTime: gameTime,
          targetId: targetEnemy.id,  // 타겟 적 ID (실시간 추적용)
        };

        // 시전 상태 설정 (3초간 이동/공격 불가)
        updatedHero = {
          ...hero,
          castingUntil: gameTime + chargeTime,
        };
      }
      break;

    case 'ranger':
      // 화살 폭풍 - 6초간 공격 속도 2배
      {
        const duration = skillConfig.duration || 5;
        const speedBonusVal = skillConfig.speedBonus || 2.0;

        buff = {
          type: 'berserker',
          duration,
          startTime: gameTime,
          speedBonus: speedBonusVal,
          attackBonus: 0,
        };

        effect = {
          type: skillConfig.type,
          position: { x: hero.x, y: hero.y },
          duration: 1.0,
          startTime: gameTime,
        };
      }
      break;

    case 'paladin':
      // 신성한 빛 - 아군 전체 HP 30% 회복 + 3초 무적 (사거리 제한 없음)
      {
        const healPercent = skillConfig.healPercent || 0.3;
        const invincibleDuration = skillConfig.invincibleDuration || 3;

        // 자신 힐 + 무적
        const selfHeal = Math.floor(hero.maxHp * healPercent);
        updatedHero = {
          ...hero,
          hp: Math.min(hero.maxHp, hero.hp + selfHeal),
        };

        buff = {
          type: 'invincible',
          duration: invincibleDuration,
          startTime: gameTime,
        };

        // 아군 전체 힐 + 무적 (사거리 제한 없음)
        for (const ally of allies) {
          if (ally.id === hero.id) continue;
          if (ally.hp <= 0) continue;  // 사망한 아군 제외
          const healAmount = Math.floor(ally.maxHp * healPercent);
          allyHeals.push({ heroId: ally.id, heal: healAmount });
          allyBuffs.push({
            heroId: ally.id,
            buff: {
              type: 'invincible',
              duration: invincibleDuration,
              startTime: gameTime,
            },
          });
        }

        effect = {
          type: skillConfig.type,
          position: { x: hero.x, y: hero.y },
          radius: skillConfig.radius || 300,
          heal: selfHeal,
          duration: 1.0,
          startTime: gameTime,
        };
      }
      break;

    case 'darkKnight':
      // 어둠의 칼날 (토글) - 서버에 E스킬 입력 전송, 서버가 토글 판단
      // 클라이언트에서는 이펙트만 표시 (로컬 예측)
      {
        const radius = skillConfig.radius || 150;

        // 토글 상태에 따라 이펙트 생성/제거는 서버 동기화에서 처리
        // 여기서는 서버에 입력만 전송하면 됨 (executeAdvancedESkill 호출 시)
        effect = {
          type: skillConfig.type,
          position: { x: hero.x, y: hero.y },
          radius,
          duration: 0.1,  // 짧은 이펙트 (서버에서 실제 토글 처리)
          startTime: gameTime,
          heroId: casterId || hero.id,
        };
      }
      break;

    case 'archmage':
      // 메테오 샤워 - 5초간 랜덤 위치에 운석 10개 낙하
      {
        const duration = skillConfig.duration || 5;
        const meteorCount = skillConfig.meteorCount || 10;
        const meteorDamage = Math.floor((baseDamage + attackBonus) * (skillConfig.damageMultiplier || 3.0));
        const meteorRadius = skillConfig.radius || 100;

        // 첫 번째 운석을 pendingSkill로 등록 (나머지는 게임 루프에서 처리)
        pendingSkill = {
          type: skillConfig.type,
          position: { x: targetX, y: targetY },
          triggerTime: gameTime + duration / meteorCount,  // 균등 간격
          damage: meteorDamage,
          radius: meteorRadius,
          casterId: casterId || hero.id,
          meteorCount: meteorCount - 1,  // 남은 운석 수
          duration,
        };

        effect = {
          type: 'meteor_shower' as SkillType,
          position: { x: targetX, y: targetY },
          radius: 300,  // 전체 범위 표시
          duration: duration,
          startTime: gameTime,
        };
      }
      break;

    case 'healer':
      // 생명의 샘 - 10초간 아군 전체 초당 10% 힐
      {
        const duration = skillConfig.duration || 10;
        const healPerTick = skillConfig.healPercent || 0.10;
        const radius = skillConfig.radius || 500;

        // 지속 힐은 pendingSkill로 처리
        pendingSkill = {
          type: skillConfig.type,
          position: { x: hero.x, y: hero.y },
          triggerTime: gameTime + 1,  // 1초마다 틱
          damage: 0,  // 데미지 없음
          radius,
          casterId: casterId || hero.id,
          healPercent: healPerTick,
          duration,
          tickCount: duration,
        };

        effect = {
          type: skillConfig.type,
          position: { x: hero.x, y: hero.y },
          radius,
          duration: duration,  // 10초간 이펙트 유지
          startTime: gameTime,
          heroId: casterId || hero.id,  // 힐러를 따라다니도록 heroId 추가
        };
      }
      break;
  }

  updatedHero = startSkillCooldown(updatedHero, skillConfig.type);

  return {
    hero: updatedHero,
    effect,
    enemyDamages,
    baseDamages,
    buff,
    pendingSkill,
    allyHeals: allyHeals.length > 0 ? allyHeals : undefined,
    allyBuffs: allyBuffs.length > 0 ? allyBuffs : undefined,
  };
}
