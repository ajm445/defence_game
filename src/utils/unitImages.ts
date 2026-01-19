import { UnitType } from '../types';

// 유닛 이미지 경로 매핑
const UNIT_IMAGE_PATHS: Record<UnitType, string> = {
  melee: '/img/units/melee.png',
  ranged: '/img/units/ranged.png',
  knight: '/img/units/knight.png',
  mage: '/img/units/mage.png',
  woodcutter: '/img/units/woodcutter.png',
  miner: '/img/units/miner.png',
  gatherer: '/img/units/gatherer.png',
  goldminer: '/img/units/goldminer.png',
  healer: '/img/units/healer.png',
};

// 이미지 캐시
const imageCache: Map<UnitType, HTMLImageElement> = new Map();
const loadingPromises: Map<UnitType, Promise<HTMLImageElement>> = new Map();

// 이미지 로드 실패 여부 추적
const failedImages: Set<UnitType> = new Set();

/**
 * 유닛 이미지를 미리 로드
 */
export function preloadUnitImage(unitType: UnitType): Promise<HTMLImageElement> {
  // 이미 캐시에 있으면 반환
  const cached = imageCache.get(unitType);
  if (cached) {
    return Promise.resolve(cached);
  }

  // 이미 로딩 중이면 해당 Promise 반환
  const loading = loadingPromises.get(unitType);
  if (loading) {
    return loading;
  }

  // 이미 실패한 이미지면 reject
  if (failedImages.has(unitType)) {
    return Promise.reject(new Error(`Image already failed: ${unitType}`));
  }

  const path = UNIT_IMAGE_PATHS[unitType];
  if (!path) {
    return Promise.reject(new Error(`Unknown unit type: ${unitType}`));
  }

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(unitType, img);
      loadingPromises.delete(unitType);
      resolve(img);
    };
    img.onerror = () => {
      loadingPromises.delete(unitType);
      failedImages.add(unitType);
      reject(new Error(`Failed to load image: ${path}`));
    };
    img.src = path;
  });

  loadingPromises.set(unitType, promise);
  return promise;
}

/**
 * 모든 유닛 이미지를 미리 로드
 */
export function preloadAllUnitImages(): Promise<void> {
  const unitTypes = Object.keys(UNIT_IMAGE_PATHS) as UnitType[];
  return Promise.allSettled(unitTypes.map(preloadUnitImage)).then(() => {});
}

/**
 * 캐시된 유닛 이미지 가져오기 (없으면 null)
 */
export function getUnitImage(unitType: UnitType): HTMLImageElement | null {
  return imageCache.get(unitType) || null;
}

/**
 * 유닛 이미지가 로드되었는지 확인
 */
export function isUnitImageLoaded(unitType: UnitType): boolean {
  return imageCache.has(unitType);
}

/**
 * 유닛 이미지 URL 가져오기
 */
export function getUnitImageUrl(unitType: UnitType): string {
  return UNIT_IMAGE_PATHS[unitType] || '';
}

/**
 * Canvas에 유닛 이미지 그리기
 * @param flipHorizontal - true이면 이미지를 좌우 반전 (플레이어 유닛용)
 * @param height - 높이 (지정하지 않으면 width와 동일)
 */
export function drawUnitImage(
  ctx: CanvasRenderingContext2D,
  unitType: UnitType,
  x: number,
  y: number,
  width: number,
  flipHorizontal: boolean = false,
  height?: number
): boolean {
  const img = imageCache.get(unitType);
  const h = height ?? width;

  if (img) {
    if (flipHorizontal) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(-1, 1);
      ctx.drawImage(img, -width / 2, -h / 2, width, h);
      ctx.restore();
    } else {
      ctx.drawImage(img, x - width / 2, y - h / 2, width, h);
    }
    return true;
  }

  // 이미지가 없으면 로드 시작 (실패한 이미지가 아닌 경우에만)
  if (!failedImages.has(unitType)) {
    preloadUnitImage(unitType).catch(() => {});
  }

  return false;
}
