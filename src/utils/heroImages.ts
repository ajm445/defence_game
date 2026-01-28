import { HeroClass, AdvancedHeroClass } from '../types/rpg';

// 전직 직업 ID를 이미지 파일명으로 매핑 (camelCase → snake_case)
const ADVANCED_CLASS_IMAGE_NAMES: Record<AdvancedHeroClass, string> = {
  berserker: 'berserker',
  guardian: 'guardian',
  sniper: 'sniper',
  ranger: 'ranger',
  paladin: 'paladin',
  darkKnight: 'dark_knight',
  archmage: 'archmage',
  healer: 'healer',
};

// 기본 직업 이미지 경로 (기존 유닛 이미지 사용)
const BASE_CLASS_IMAGE_PATHS: Record<HeroClass, string> = {
  warrior: '/img/units/melee.png',
  archer: '/img/units/ranged.png',
  knight: '/img/units/knight.png',
  mage: '/img/units/mage.png',
};

// 이미지 캐시
const heroImageCache: Map<string, HTMLImageElement> = new Map();
const loadingPromises: Map<string, Promise<HTMLImageElement>> = new Map();
const failedImages: Set<string> = new Set();

/**
 * 영웅 이미지 경로 생성
 * @param heroClass - 기본 직업
 * @param advancedClass - 전직 직업 (없으면 기본 직업 이미지)
 * @param tier - 전직 단계 (1 or 2)
 */
export function getHeroImagePath(
  heroClass: HeroClass,
  advancedClass?: AdvancedHeroClass,
  tier?: 1 | 2
): string {
  // 전직하지 않은 경우 기본 직업 이미지
  if (!advancedClass) {
    return BASE_CLASS_IMAGE_PATHS[heroClass];
  }

  // 전직한 경우 전직 이미지
  const imageName = ADVANCED_CLASS_IMAGE_NAMES[advancedClass];
  const suffix = tier === 2 ? '2' : '';
  return `/img/units/RPG/${imageName}${suffix}.png`;
}

/**
 * 영웅 이미지 캐시 키 생성
 */
function getCacheKey(
  heroClass: HeroClass,
  advancedClass?: AdvancedHeroClass,
  tier?: 1 | 2
): string {
  if (advancedClass) {
    return `${advancedClass}_${tier || 1}`;
  }
  return heroClass;
}

/**
 * 영웅 이미지 미리 로드
 */
export function preloadHeroImage(
  heroClass: HeroClass,
  advancedClass?: AdvancedHeroClass,
  tier?: 1 | 2
): Promise<HTMLImageElement> {
  const cacheKey = getCacheKey(heroClass, advancedClass, tier);

  // 이미 캐시에 있으면 반환
  const cached = heroImageCache.get(cacheKey);
  if (cached) {
    return Promise.resolve(cached);
  }

  // 이미 로딩 중이면 해당 Promise 반환
  const loading = loadingPromises.get(cacheKey);
  if (loading) {
    return loading;
  }

  // 이미 실패한 이미지면 reject
  if (failedImages.has(cacheKey)) {
    return Promise.reject(new Error(`Hero image already failed: ${cacheKey}`));
  }

  const path = getHeroImagePath(heroClass, advancedClass, tier);

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      heroImageCache.set(cacheKey, img);
      loadingPromises.delete(cacheKey);
      resolve(img);
    };
    img.onerror = () => {
      loadingPromises.delete(cacheKey);
      failedImages.add(cacheKey);
      reject(new Error(`Failed to load hero image: ${path}`));
    };
    img.src = path;
  });

  loadingPromises.set(cacheKey, promise);
  return promise;
}

/**
 * 모든 전직 캐릭터 이미지 미리 로드
 */
export function preloadAllAdvancedHeroImages(): Promise<void> {
  const promises: Promise<HTMLImageElement>[] = [];

  // 모든 전직 직업의 1차, 2차 이미지 로드
  const advancedClasses = Object.keys(ADVANCED_CLASS_IMAGE_NAMES) as AdvancedHeroClass[];
  for (const advClass of advancedClasses) {
    // 기본 클래스 추출 (스토어에서 가져와야 하지만 여기서는 임의 지정)
    const baseClass = getBaseClass(advClass);
    promises.push(preloadHeroImage(baseClass, advClass, 1));
    promises.push(preloadHeroImage(baseClass, advClass, 2));
  }

  return Promise.allSettled(promises).then(() => {});
}

/**
 * 전직 직업의 기본 직업 가져오기
 */
function getBaseClass(advancedClass: AdvancedHeroClass): HeroClass {
  const mapping: Record<AdvancedHeroClass, HeroClass> = {
    berserker: 'warrior',
    guardian: 'warrior',
    sniper: 'archer',
    ranger: 'archer',
    paladin: 'knight',
    darkKnight: 'knight',
    archmage: 'mage',
    healer: 'mage',
  };
  return mapping[advancedClass];
}

/**
 * 캐시된 영웅 이미지 가져오기 (없으면 null)
 */
export function getHeroImage(
  heroClass: HeroClass,
  advancedClass?: AdvancedHeroClass,
  tier?: 1 | 2
): HTMLImageElement | null {
  const cacheKey = getCacheKey(heroClass, advancedClass, tier);
  return heroImageCache.get(cacheKey) || null;
}

/**
 * Canvas에 영웅 이미지 그리기
 * @param flipHorizontal - true이면 이미지를 좌우 반전
 * @returns 이미지 그리기 성공 여부
 */
export function drawHeroImage(
  ctx: CanvasRenderingContext2D,
  heroClass: HeroClass,
  advancedClass: AdvancedHeroClass | undefined,
  tier: 1 | 2 | undefined,
  x: number,
  y: number,
  width: number,
  height: number,
  flipHorizontal: boolean = false
): boolean {
  const cacheKey = getCacheKey(heroClass, advancedClass, tier);
  const img = heroImageCache.get(cacheKey);

  if (img) {
    if (flipHorizontal) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(-1, 1);
      ctx.drawImage(img, -width / 2, -height / 2, width, height);
      ctx.restore();
    } else {
      ctx.drawImage(img, x - width / 2, y - height / 2, width, height);
    }
    return true;
  }

  // 이미지가 없으면 로드 시작 (실패한 이미지가 아닌 경우에만)
  if (!failedImages.has(cacheKey)) {
    preloadHeroImage(heroClass, advancedClass, tier).catch(() => {});
  }

  return false;
}

/**
 * 영웅 이미지가 로드되었는지 확인
 */
export function isHeroImageLoaded(
  heroClass: HeroClass,
  advancedClass?: AdvancedHeroClass,
  tier?: 1 | 2
): boolean {
  const cacheKey = getCacheKey(heroClass, advancedClass, tier);
  return heroImageCache.has(cacheKey);
}
