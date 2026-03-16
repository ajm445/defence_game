/**
 * 스프라이트 모션 시스템
 * 2×2 그리드 스프라이트 시트 전용
 */

import type { HeroClass, AdvancedHeroClass } from '../types/rpg';

// 모션 타입 (null = 정적 이미지 사용)
export type MotionType = 'walk' | 'attack' | 'w' | 'e';

// 이미지 캐시
const imgCache = new Map<string, HTMLImageElement>();
const loadingSet = new Set<string>();
const failedSet = new Set<string>();

// 애니메이션 설정
const MOTION_CONFIG: Record<MotionType, { fps: number; loop: boolean; holdTime: number }> = {
  walk: { fps: 6, loop: true, holdTime: 0 },
  attack: { fps: 10, loop: false, holdTime: 0.5 },
  w: { fps: 6, loop: false, holdTime: 0.8 },
  e: { fps: 5, loop: false, holdTime: 1.0 },
};

// 캐릭터별 모션 config 오버라이드 (버프형 E스킬 등 holdTime 조정)
const MOTION_CONFIG_OVERRIDE: Record<string, Partial<typeof MOTION_CONFIG[MotionType]>> = {
  'warrior_e': { holdTime: 1.2 },
  // 기사 W: 돌진 0.25초에 맞춰 빠르게 재생 (기본 6fps → 12fps)
  'knight_w': { fps: 12, holdTime: 0.4 },
};

// 스프라이트가 오른쪽을 바라보는 경우 → flip 반전 필요
// 새 스프라이트는 모두 왼쪽 방향으로 생성 (정적 이미지와 동일) → 반전 불필요
// 기존 오른쪽 방향 스프라이트가 있으면 여기에 추가
const SPRITE_FACES_RIGHT = new Set<string>([
  // 오른쪽 방향 스프라이트 → 게임 내 왼쪽 기준이므로 반전 필요
  'warrior_w', 'warrior_e',
  'archer_walk', 'archer_w', 'archer_e',
  'knight_w', 'knight_e',
  'boss_attack',
]);

// 방향 무시 (항상 반전 없이 원본 방향 고정) — 하늘 발사 등 방향 무관 모션
const SPRITE_NO_FLIP = new Set<string>([
]);

function getFlipMode(
  heroClass: HeroClass,
  advancedClass: AdvancedHeroClass | undefined,
  motion: MotionType
): 'normal' | 'invert' | 'none' {
  const key = advancedClass || heroClass;
  // 방향 무시 (반전 안 함)
  if (SPRITE_NO_FLIP.has(`${key}_${motion}`)) return 'none';
  // 오른쪽 방향 스프라이트 → 반전 필요
  if (SPRITE_FACES_RIGHT.has(`${key}_${motion}`)) return 'invert';
  if (SPRITE_FACES_RIGHT.has(key)) return 'invert';
  return 'normal';
}

function resolveFlip(
  heroClass: HeroClass,
  advancedClass: AdvancedHeroClass | undefined,
  motion: MotionType,
  flipHorizontal: boolean
): boolean {
  const mode = getFlipMode(heroClass, advancedClass, motion);
  if (mode === 'none') return false;     // 반전 안 함 (원본 방향 고정)
  if (mode === 'invert') return !flipHorizontal;  // 오른쪽 스프라이트 → 반전
  return flipHorizontal;                 // 왼쪽 스프라이트 → 정상
}

const FRAMES_PER_SHEET = 4;

// 재사용 소스 rect
const _srcRect = { sx: 0, sy: 0, sw: 0, sh: 0 };

// ============================================
// 파일 경로 생성
// ============================================

function getMotionFileName(heroClass: HeroClass, advancedClass?: AdvancedHeroClass): string {
  if (advancedClass) {
    return advancedClass === 'darkKnight' ? 'dark_knight' : advancedClass;
  }
  return heroClass;
}

function getMotionFolderPath(heroClass: HeroClass, advancedClass?: AdvancedHeroClass): string {
  if (advancedClass) {
    const folderName = advancedClass === 'darkKnight' ? 'dark_knight' : advancedClass;
    return `/img/units/RPG/motion/${folderName}`;
  }
  return `/img/units/RPG/motion/${heroClass}`;
}

const W_SUFFIX: Record<string, string> = {
  warrior: '_w_charge', archer: '_w_pierce', knight: '_w_shield_charge', mage: '_w_fireball',
  berserker: '_w_blood_rush', guardian: '_w_guardian_rush', sniper: '_w_backflip',
  ranger: '_w_multi_arrow', paladin: '_w_holy_charge', darkKnight: '_w_dark_pierce',
  archmage: '_w_inferno', healer: '_w_healing_light',
};

const E_SUFFIX: Record<string, string> = {
  warrior: '_e_rage', archer: '_e_arrow_rain', knight: '_e_iron_defense', mage: '_e_meteor',
  berserker: '_e_rage', guardian: '_e_shield', sniper: '_e_snipe',
  ranger: '_e_arrow_storm', paladin: '_e_divine_light', darkKnight: '_e_dark_blade',
  archmage: '_e_meteor', healer: '_e_spring',
};

function getSpritePath(
  heroClass: HeroClass,
  advancedClass: AdvancedHeroClass | undefined,
  motion: MotionType
): string {
  const folder = getMotionFolderPath(heroClass, advancedClass);
  const fileName = getMotionFileName(heroClass, advancedClass);
  const key = advancedClass || heroClass;

  let suffix: string;
  if (motion === 'walk') suffix = '_walk';
  else if (motion === 'attack') suffix = '_attack';
  else if (motion === 'w') suffix = W_SUFFIX[key] || '_w';
  else suffix = E_SUFFIX[key] || '_e';

  return `${folder}/${fileName}${suffix}.png`;
}

// ============================================
// 스프라이트 로드/캐시
// ============================================

function getCacheKey(
  heroClass: HeroClass,
  advancedClass: AdvancedHeroClass | undefined,
  tier: 1 | 2 | undefined,
  motion: MotionType
): string {
  const base = advancedClass ? `${advancedClass}_${tier || 1}` : heroClass;
  return `motion_${base}_${motion}`;
}

function loadSheet(
  heroClass: HeroClass,
  advancedClass: AdvancedHeroClass | undefined,
  tier: 1 | 2 | undefined,
  motion: MotionType
): HTMLImageElement | null {
  const key = getCacheKey(heroClass, advancedClass, tier, motion);
  const cached = imgCache.get(key);
  if (cached) return cached;
  if (failedSet.has(key) || loadingSet.has(key)) return null;

  loadingSet.add(key);
  const img = new Image();
  img.onload = () => { imgCache.set(key, img); loadingSet.delete(key); };
  img.onerror = () => { failedSet.add(key); loadingSet.delete(key); };
  img.src = getSpritePath(heroClass, advancedClass, motion);
  return null;
}

export function preloadMotionSprites(
  heroClass: HeroClass,
  advancedClass?: AdvancedHeroClass,
  tier?: 1 | 2
): void {
  loadSheet(heroClass, advancedClass, tier, 'walk');
  loadSheet(heroClass, advancedClass, tier, 'attack');
  loadSheet(heroClass, advancedClass, tier, 'w');
  loadSheet(heroClass, advancedClass, tier, 'e');
}

// ============================================
// 애니메이션 상태 추적
// ============================================

interface AnimState {
  motion: MotionType;
  startTime: number;
  prevQ: number;
  prevW: number;
  prevE: number;
  // 원샷 모션 시작 시 flip 방향 고정 (공격 중 이동 방향으로 덮어씌워지는 것 방지)
  lockedFlip?: boolean;
}

const heroAnimStates = new Map<string, AnimState>();

function detectSkillUsed(
  anim: AnimState | undefined,
  cQ: number, cW: number, cE: number
): MotionType | null {
  if (!anim) return null;
  if (cE > anim.prevE + 0.5) return 'e';
  if (cW > anim.prevW + 0.5) return 'w';
  // W/E 모션 재생 중에는 Q(공격) 감지 차단 (스킬 모션이 공격에 의해 덮어씌워지는 것 방지)
  if (anim.motion === 'w' || anim.motion === 'e') return null;
  if (cQ > anim.prevQ + 0.3) return 'attack';
  return null;
}

function resolveMotion(
  heroState: string,
  dashState: unknown,
  castingUntil: number | undefined,
  gameTime: number,
  darkBladeActive?: boolean,
): MotionType | null {
  if (dashState) return 'w';
  if (castingUntil && gameTime < castingUntil) return 'e';
  if (darkBladeActive) return 'e';
  if (heroState === 'moving') return 'walk';
  return null;
}

function getFrameIndex(motion: MotionType, startTime: number, gameTime: number, heroKey?: string): number {
  const base = MOTION_CONFIG[motion];
  const override = heroKey ? MOTION_CONFIG_OVERRIDE[`${heroKey}_${motion}`] : undefined;
  const config = override ? { ...base, ...override } : base;
  const elapsed = gameTime - startTime;
  if (elapsed < 0) return -1;
  const totalAnimTime = FRAMES_PER_SHEET / config.fps;

  if (config.loop) {
    const t = elapsed % totalAnimTime;
    return Math.floor((t / totalAnimTime) * FRAMES_PER_SHEET) % FRAMES_PER_SHEET;
  } else {
    if (elapsed >= config.holdTime) return -1;
    if (elapsed >= totalAnimTime) return FRAMES_PER_SHEET - 1;
    return Math.floor((elapsed / totalAnimTime) * FRAMES_PER_SHEET);
  }
}

function updateSrcRect(img: HTMLImageElement, frameIndex: number): void {
  const sw = img.naturalWidth >> 1;
  const sh = img.naturalHeight >> 1;
  _srcRect.sx = (frameIndex % 2) * sw;
  _srcRect.sy = (frameIndex >> 1) * sh;
  _srcRect.sw = sw;
  _srcRect.sh = sh;
}

// ============================================
// 메인 렌더링 함수
// ============================================

export function drawMotionSprite(
  ctx: CanvasRenderingContext2D,
  heroId: string,
  heroClass: HeroClass,
  advancedClass: AdvancedHeroClass | undefined,
  tier: 1 | 2 | undefined,
  heroState: string,
  dashState: unknown,
  castingUntil: number | undefined,
  darkBladeActive: boolean | undefined,
  skillCooldowns: { Q: number; W: number; E: number } | undefined,
  gameTime: number,
  x: number,
  y: number,
  width: number,
  height: number,
  flipHorizontal: boolean,
  attackFlip?: boolean  // 공격 대상 방향 flip (이동 방향과 다를 수 있음)
): boolean {
  const cQ = skillCooldowns?.Q ?? 0;
  const cW = skillCooldowns?.W ?? 0;
  const cE = skillCooldowns?.E ?? 0;
  const heroKey = (advancedClass || heroClass) as string;

  let anim = heroAnimStates.get(heroId);
  const stateMotion = resolveMotion(heroState, dashState, castingUntil, gameTime, darkBladeActive);

  // 1. 쿨다운 점프 감지
  const skillUsed = detectSkillUsed(anim, cQ, cW, cE);
  if (skillUsed !== null) {
    // 원샷 모션 시작 시 flip 방향 고정 (공격 대상 방향 사용, 이동 방향과 분리)
    const skillFlipBase = (skillUsed === 'attack' && attackFlip != null) ? attackFlip : flipHorizontal;
    const currentFlip = resolveFlip(heroClass, advancedClass, skillUsed, skillFlipBase);
    anim = { motion: skillUsed, startTime: gameTime, prevQ: cQ, prevW: cW, prevE: cE, lockedFlip: currentFlip };
    heroAnimStates.set(heroId, anim);
  } else if (!anim) {
    anim = { motion: 'walk', startTime: gameTime, prevQ: cQ, prevW: cW, prevE: cE };
    heroAnimStates.set(heroId, anim);
  } else {
    anim.prevQ = cQ; anim.prevW = cW; anim.prevE = cE;
  }

  // 2. 원샷 모션 재생 (walk보다 우선)
  if (anim && !MOTION_CONFIG[anim.motion].loop) {
    const fi = getFrameIndex(anim.motion, anim.startTime, gameTime, heroKey);
    if (fi >= 0) {
      const sheet = loadSheet(heroClass, advancedClass, tier, anim.motion);
      if (sheet) {
        updateSrcRect(sheet, fi);
        // 원샷 모션: 시작 시 고정된 flip 사용 (공격 중 이동 방향 변경 방지)
        const flip = anim.lockedFlip != null ? anim.lockedFlip : resolveFlip(heroClass, advancedClass, anim.motion, flipHorizontal);
        drawFrame(ctx, sheet, x, y, width, height, flip);
        return true;
      }
      // 시트 로딩 중: 애니메이션 상태 유지 (삭제하면 스킬 감지 영구 손실)
      return false;
    }
    // 애니메이션 만료 (holdTime 초과)
    heroAnimStates.delete(heroId);
    anim = undefined;
  }

  // 3. 상태 기반 모션 (walk/w/e)
  if (stateMotion !== null) {
    if (!anim || anim.motion !== stateMotion) {
      anim = { motion: stateMotion, startTime: gameTime, prevQ: cQ, prevW: cW, prevE: cE };
      heroAnimStates.set(heroId, anim);
    }

    const sheet = loadSheet(heroClass, advancedClass, tier, stateMotion);
    if (!sheet) return false;

    const fi = getFrameIndex(stateMotion, anim.startTime, gameTime, heroKey);
    if (fi < 0) return false;

    updateSrcRect(sheet, fi);
    const flip = resolveFlip(heroClass, advancedClass, stateMotion, flipHorizontal);
    drawFrame(ctx, sheet, x, y, width, height, flip);
    return true;
  }

  return false;
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number, y: number, width: number, height: number,
  flipHorizontal: boolean
): void {
  const { sx, sy, sw, sh } = _srcRect;

  // 높이 기준 비율 유지 (캐릭터 키가 일정하게 유지, 가로는 비례 확장)
  const srcRatio = sw / sh;
  const drawH = height;
  const drawW = drawH * srcRatio;

  if (flipHorizontal) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(-1, 1);
    ctx.drawImage(img, sx, sy, sw, sh, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  } else {
    ctx.drawImage(img, sx, sy, sw, sh, x - drawW / 2, y - drawH / 2, drawW, drawH);
  }
}

// ============================================
// 정리
// ============================================

export function cleanupHeroAnimState(heroId: string): void {
  heroAnimStates.delete(heroId);
}

export function resetAllAnimStates(): void {
  heroAnimStates.clear();
}

export function hasMotionSprites(
  heroClass: HeroClass,
  advancedClass?: AdvancedHeroClass,
  tier?: 1 | 2
): boolean {
  return imgCache.has(getCacheKey(heroClass, advancedClass, tier, 'walk'));
}
