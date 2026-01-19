import twemoji from 'twemoji';

// 이모지별 이미지 캐시
const emojiImageCache: Map<string, HTMLImageElement> = new Map();
const loadingPromises: Map<string, Promise<HTMLImageElement>> = new Map();

/**
 * 이모지를 Twemoji URL로 변환
 */
function getEmojiUrl(emoji: string): string {
  // twemoji.parse는 HTML을 반환하므로, URL만 추출
  const parsed = twemoji.parse(emoji, {
    folder: 'svg',
    ext: '.svg',
    base: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/',
  });

  // <img src="URL" ...> 에서 URL 추출
  const match = parsed.match(/src="([^"]+)"/);
  return match ? match[1] : '';
}

/**
 * 이모지 이미지를 미리 로드
 */
export function preloadEmoji(emoji: string): Promise<HTMLImageElement> {
  // 이미 캐시에 있으면 반환
  const cached = emojiImageCache.get(emoji);
  if (cached) {
    return Promise.resolve(cached);
  }

  // 이미 로딩 중이면 해당 Promise 반환
  const loading = loadingPromises.get(emoji);
  if (loading) {
    return loading;
  }

  // 새로 로드
  const url = getEmojiUrl(emoji);
  if (!url) {
    return Promise.reject(new Error(`Invalid emoji: ${emoji}`));
  }

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      emojiImageCache.set(emoji, img);
      loadingPromises.delete(emoji);
      resolve(img);
    };
    img.onerror = () => {
      loadingPromises.delete(emoji);
      reject(new Error(`Failed to load emoji: ${emoji}`));
    };
    img.src = url;
  });

  loadingPromises.set(emoji, promise);
  return promise;
}

/**
 * 여러 이모지를 미리 로드
 */
export function preloadEmojis(emojis: string[]): Promise<void> {
  return Promise.all(emojis.map(preloadEmoji)).then(() => {});
}

/**
 * Canvas에 이모지 그리기
 * @param ctx - Canvas 2D context
 * @param emoji - 이모지 문자열
 * @param x - 중심 X 좌표
 * @param y - 중심 Y 좌표
 * @param size - 이모지 크기 (픽셀)
 */
export function drawEmoji(
  ctx: CanvasRenderingContext2D,
  emoji: string,
  x: number,
  y: number,
  size: number
): void {
  const img = emojiImageCache.get(emoji);

  if (img) {
    // 캐시된 이미지 사용
    ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
  } else {
    // 이미지가 아직 로드되지 않음 - 로드 시작하고 폴백으로 텍스트 표시
    preloadEmoji(emoji).catch(() => {});

    // 폴백: 시스템 이모지 (일부 시스템에서는 보이지 않을 수 있음)
    ctx.font = `${size}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, x, y);
  }
}

/**
 * 게임에서 사용하는 모든 이모지 미리 로드
 */
export function preloadGameEmojis(): Promise<void> {
  const gameEmojis = [
    // 유닛
    '⚔️', '🏹', '🛡️', '🪓', '⛏️', '🧺', '💰', '💚', '🔮',
    // 자원 노드
    '🌲', '🪨', '🌿', '💎', '🏔️',
    // 건물
    '🏰', '🧱',
    // 자원 아이콘 (UI용)
    '🪵',
    // 이펙트용
    '➕',
    // 기타
    '❓',
  ];

  return preloadEmojis(gameEmojis);
}
