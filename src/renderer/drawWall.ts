import { Wall, Camera } from '../types';

export function drawWall(
  ctx: CanvasRenderingContext2D,
  wall: Wall,
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number
) {
  const screenX = wall.x - camera.x;
  const screenY = wall.y - camera.y;

  // 화면 밖이면 스킵
  if (
    screenX < -30 ||
    screenX > canvasWidth + 30 ||
    screenY < -30 ||
    screenY > canvasHeight + 30
  ) {
    return;
  }

  // 글로우
  ctx.save();
  ctx.shadowColor = '#a855f7';
  ctx.shadowBlur = 10;

  // 벽 본체
  const gradient = ctx.createLinearGradient(screenX - 18, screenY - 18, screenX + 18, screenY + 18);
  gradient.addColorStop(0, '#3d3d52');
  gradient.addColorStop(0.5, '#2d2d3d');
  gradient.addColorStop(1, '#1a1a25');

  ctx.fillStyle = gradient;
  ctx.strokeStyle = '#a855f7';
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.roundRect(screenX - 18, screenY - 18, 36, 36, 4);
  ctx.fill();
  ctx.stroke();

  ctx.restore();

  // 벽 아이콘
  ctx.font = '20px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🧱', screenX, screenY);
}
