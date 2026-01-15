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

  // HP 바 (피해를 입었을 때만 표시)
  if (wall.hp < wall.maxHp) {
    const hpBarWidth = 30;
    const hpBarHeight = 4;
    const hpPercent = wall.hp / wall.maxHp;

    // 배경
    ctx.fillStyle = '#1a1a25';
    ctx.fillRect(screenX - hpBarWidth / 2, screenY + 22, hpBarWidth, hpBarHeight);

    // HP 바
    const hpColor = hpPercent > 0.5 ? '#22c55e' : hpPercent > 0.25 ? '#eab308' : '#ef4444';
    ctx.fillStyle = hpColor;
    ctx.fillRect(screenX - hpBarWidth / 2, screenY + 22, hpBarWidth * hpPercent, hpBarHeight);

    // 테두리
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 1;
    ctx.strokeRect(screenX - hpBarWidth / 2, screenY + 22, hpBarWidth, hpBarHeight);
  }
}
