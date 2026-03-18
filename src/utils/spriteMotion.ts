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

// 캐릭터별 모션 config 오버라이드
// 서버 타이밍 기준:
//   돌진형 W: dashDuration=0.25s (resolveMotion이 dashState로 감지)
//   즉발형 W: attackLockUntil=0.67s
//   즉발형 E: attackLockUntil=0.8s
//   시전형(castingUntil): resolveMotion이 상태 기반 감지 → 오버라이드 불필요
// 캐릭터별 공격 프레임 가중치 오버라이드 (기본: 15/15/40/30 → 3번째 프레임에서 타격)
// 값은 누적 비율: [프레임0 끝, 프레임1 끝, 프레임2 끝, 프레임3 끝]
const ATTACK_FRAME_WEIGHTS: Record<string, number[]> = {
  // 다크나이트: 프레임2까지 길게(검 휘두름) → 2~3 사이 타격 → 프레임3 빠르게 → 프레임4 끝 포즈
  darkKnight: [0.10, 0.55, 0.65, 1.0],
};

const MOTION_CONFIG_OVERRIDE: Record<string, Partial<typeof MOTION_CONFIG[MotionType]> & { frameTimes?: number[] }> = {
  // === 돌진형 W (dashDuration=0.25s) → fps12 빠르게 재생 ===
  'warrior_w': { fps: 12, holdTime: 0.4 },
  'knight_w': { fps: 12, holdTime: 0.4 },
  'berserker_w': { fps: 12, holdTime: 0.4 },
  'guardian_w': { fps: 12, holdTime: 0.4 },
  // 팔라딘 W: 프레임1 발동 → 프레임2 돌진 유지(~0.25s) → 프레임3,4 돌진 후 빠르게
  'paladin_w': { holdTime: 0.4, frameTimes: [0.05, 0.25, 0.32, 0.4] },

  // === 즉발형 W (서버 잠금 0.67s) → holdTime 맞춤 ===
  'archer_w': { holdTime: 0.67 },
  'mage_w': { holdTime: 0.67 },
  'sniper_w': { holdTime: 0.67 },
  'ranger_w': { holdTime: 0.67 },
  'archmage_w': { holdTime: 0.67 },
  'healer_w': { holdTime: 0.67 },

  // === 즉발형 E (서버 잠금 0.8s) → holdTime 맞춤 ===
  'warrior_e': { holdTime: 0.8 },
  'berserker_e': { holdTime: 0.8 },
  'guardian_e': { holdTime: 0.8 },
  'knight_e': { holdTime: 0.8 },
  'archer_e': { holdTime: 0.8 },
  'mage_e': { holdTime: 0.8 },
  'ranger_e': { holdTime: 0.8 },
  // 팔라딘 E: 프레임1,2 준비(~0.4s) → 프레임3 신성한 폭발(0.4s) → 프레임4 마무리
  'paladin_e': { holdTime: 0.8, frameTimes: [0.15, 0.4, 0.6, 0.8] },
  'archmage_e': { holdTime: 0.8 },
  'healer_e': { holdTime: 0.8 },
  // sniper_e: 3초 시전 → frameTimes로 프레임별 시간 직접 지정
  // 프레임0,1: 조준 (0~2.2s), 프레임2: 발사 (2.2~3.0s), 프레임3: 빠른 후속동작 (3.0~3.3s)
  'sniper_e': { holdTime: 3.5, frameTimes: [1.0, 2.2, 3.0, 3.3] },
  // 다크나이트 W: 1초 시전, 프레임3에서 찌르기 공격 발동
  'darkKnight_w': { holdTime: 1.0, frameTimes: [0.2, 0.6, 0.85, 1.0] },
  // 다크나이트 E: ON 토글 시 0.8초 시전 모션 재생 (castingUntil)
  'darkKnight_e': { holdTime: 0.8 },
};

// 스프라이트가 오른쪽을 바라보는 경우 → flip 반전 필요
// 새 스프라이트는 모두 왼쪽 방향으로 생성 (정적 이미지와 동일) → 반전 불필요
// 기존 오른쪽 방향 스프라이트가 있으면 여기에 추가
const SPRITE_FACES_RIGHT = new Set<string>([
  // 오른쪽 방향 스프라이트 → 게임 내 왼쪽 기준이므로 반전 필요
  'warrior_w', 'warrior_e',
  'archer_walk', 'archer_w', 'archer_e',
  'knight_w', 'knight_e',
  'berserker_walk', 'berserker_w',
  'darkKnight_attack',
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
  tier: 1 | 2 | undefined,
  motion: MotionType
): string {
  const folder = getMotionFolderPath(heroClass, advancedClass);
  const fileName = getMotionFileName(heroClass, advancedClass);
  const key = advancedClass || heroClass;
  const tierSuffix = (tier === 2 && advancedClass) ? '2' : '';

  let suffix: string;
  if (motion === 'walk') suffix = '_walk';
  else if (motion === 'attack') suffix = '_attack';
  else if (motion === 'w') suffix = W_SUFFIX[key] || '_w';
  else suffix = E_SUFFIX[key] || '_e';

  return `${folder}/${fileName}${tierSuffix}${suffix}.png`;
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
  img.src = getSpritePath(heroClass, advancedClass, tier, motion);
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
  if (cQ > anim.prevQ + 0.15) return 'attack';
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
  // darkBladeActive: ON 시 castingUntil로 E 모션 재생, 이후 일반 모션 복귀
  if (heroState === 'moving') return 'walk';
  return null;
}

function getFrameIndex(motion: MotionType, startTime: number, gameTime: number, heroKey?: string, attackSpeed?: number): number {
  const base = MOTION_CONFIG[motion];
  const override = heroKey ? MOTION_CONFIG_OVERRIDE[`${heroKey}_${motion}`] : undefined;
  const config = override ? { ...base, ...override } : base;
  const elapsed = gameTime - startTime;
  if (elapsed < 0) return -1;

  // attack 모션: attackSpeed 기반 동적 타이밍
  // 가중 프레임 분배: 3번째 프레임(idx 2)에서 타격 싱크
  // 프레임 0,1: 빠른 준비동작 (각 15%), 프레임 2: 타격 (40%), 프레임 3: 후속동작 (30%)
  if (motion === 'attack' && attackSpeed && attackSpeed > 0) {
    const animTime = Math.max(0.25, attackSpeed * 0.6);  // 최소 0.25s
    const holdTime = Math.max(0.35, attackSpeed);         // 최소 0.35s
    if (elapsed >= holdTime) return -1;
    if (elapsed >= animTime) return FRAMES_PER_SHEET - 1;
    const t = elapsed / animTime;
    const weights = (heroKey && ATTACK_FRAME_WEIGHTS[heroKey]) || null;
    if (weights) {
      for (let i = 0; i < weights.length; i++) {
        if (t < weights[i]) return i;
      }
      return FRAMES_PER_SHEET - 1;
    }
    if (t < 0.15) return 0;
    if (t < 0.30) return 1;
    if (t < 0.70) return 2;
    return 3;
  }

  // frameTimes 오버라이드: 프레임별 시간 경계 직접 지정 (저격수 E 등)
  if (config.frameTimes) {
    const ft = config.frameTimes;
    if (elapsed >= config.holdTime) return -1;
    for (let i = 0; i < ft.length; i++) {
      if (elapsed < ft[i]) return i;
    }
    return FRAMES_PER_SHEET - 1;
  }

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
  attackFlip?: boolean,  // 공격 대상 방향 flip (이동 방향과 다를 수 있음)
  attackSpeed?: number,  // 기본공격 쿨다운(초) — attack 모션 타이밍에 사용
  castingFlip?: boolean  // 캐스팅 중 타겟 방향 flip (저격수 E 등)
): boolean {
  const cQ = skillCooldowns?.Q ?? 0;
  const cW = skillCooldowns?.W ?? 0;
  const cE = skillCooldowns?.E ?? 0;
  const heroKey = (advancedClass || heroClass) as string;

  let anim = heroAnimStates.get(heroId);
  const stateMotion = resolveMotion(heroState, dashState, castingUntil, gameTime, darkBladeActive);

  // 1. 쿨다운 점프 감지
  let skillUsed = detectSkillUsed(anim, cQ, cW, cE);

  // 다크나이트 E (어둠의 칼날): 토글 스킬 전용 처리
  // - 쿨다운 점프로 모션 감지하지 않음 (ON/OFF 모두 쿨다운 변동 발생)
  // - ON 시: castingUntil(0.8s)이 resolveMotion에서 'e' 상태 모션으로 처리
  // - OFF 시: castingUntil 없음 → 모션 없음
  if (skillUsed === 'e' && advancedClass === 'darkKnight') {
    skillUsed = null;
    // prevE만 갱신하여 다음 틱에 재감지 방지
    if (anim) anim.prevE = cE;
  }

  if (skillUsed !== null) {
    // 원샷 모션 시작 시 flip 방향 고정
    // attack: 공격 대상 방향, e 캐스팅: 타겟 방향, 그 외: 이동 방향
    let skillFlipBase = flipHorizontal;
    if (skillUsed === 'attack' && attackFlip != null) skillFlipBase = attackFlip;
    else if (skillUsed === 'e' && castingFlip != null) skillFlipBase = castingFlip;
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
    const fi = getFrameIndex(anim.motion, anim.startTime, gameTime, heroKey, attackSpeed);
    if (fi >= 0) {
      const sheet = loadSheet(heroClass, advancedClass, tier, anim.motion);
      if (sheet) {
        updateSrcRect(sheet, fi);
        // 원샷 모션: 시작 시 고정된 flip 사용 (공격 중 이동 방향 변경 방지)
        let flip = anim.lockedFlip != null ? anim.lockedFlip : resolveFlip(heroClass, advancedClass, anim.motion, flipHorizontal);
        // 캐스팅 중 타겟 방향으로 갱신 (이펙트 데이터 도착 지연 대응)
        if (anim.motion === 'e' && castingFlip != null) {
          flip = resolveFlip(heroClass, advancedClass, 'e', castingFlip);
          anim.lockedFlip = flip;
        }
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

    const fi = getFrameIndex(stateMotion, anim.startTime, gameTime, heroKey, attackSpeed);
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
