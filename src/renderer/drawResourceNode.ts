import { ResourceNode, Camera } from '../types';
import { drawEmoji } from '../utils/canvasEmoji';

const EMOJI_MAP: Record<string, string> = {
  tree: '🌲',
  rock: '🪨',
  herb: '🌿',
  crystal: '💎',
  goldmine: '🏔️',
};

const GLOW_COLORS: Record<string, string> = {
  tree: '#22c55e',
  rock: '#6b7280',
  herb: '#86efac',
  crystal: '#a855f7',
  goldmine: '#fbbf24',
};

export function drawResourceNode(
  ctx: CanvasRenderingContext2D,
  node: ResourceNode,
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number
) {
  const screenX = node.x - camera.x;
  const screenY = node.y - camera.y;

  // 화면 밖이면 스킵
  if (
    screenX < -50 ||
    screenX > canvasWidth + 50 ||
    screenY < -50 ||
    screenY > canvasHeight + 50
  ) {
    return;
  }

  const alpha = node.amount / node.maxAmount;
  const glowColor = GLOW_COLORS[node.type] || '#666';

  // 자원이 있을 때만 글로우
  if (node.amount > 0) {
    ctx.save();
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 10 * alpha;
  }

  // 이모지 렌더링 (Twemoji 사용)
  const emoji = EMOJI_MAP[node.type] || '❓';
  ctx.globalAlpha = 0.3 + alpha * 0.7;
  drawEmoji(ctx, emoji, screenX, screenY, 32);
  ctx.globalAlpha = 1;

  if (node.amount > 0) {
    ctx.restore();
  }

  // 자원량 표시
  if (node.amount > 0) {
    // 배경
    ctx.fillStyle = 'rgba(10, 10, 15, 0.8)';
    ctx.beginPath();
    ctx.roundRect(screenX - 15, screenY + 18, 30, 14, 3);
    ctx.fill();

    // 텍스트
    ctx.font = 'bold 10px "Noto Sans KR", sans-serif';
    ctx.fillStyle = glowColor;
    ctx.fillText(Math.floor(node.amount).toString(), screenX, screenY + 25);
  }
}
