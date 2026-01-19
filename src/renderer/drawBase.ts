import { Base, Camera } from '../types';
import { drawEmoji } from '../utils/canvasEmoji';

export function drawBase(
  ctx: CanvasRenderingContext2D,
  base: Base,
  camera: Camera,
  color: string,
  label: string,
  canvasWidth: number,
  canvasHeight: number
) {
  const screenX = base.x - camera.x;
  const screenY = base.y - camera.y;

  // 화면 밖이면 스킵
  if (
    screenX < -100 ||
    screenX > canvasWidth + 100 ||
    screenY < -100 ||
    screenY > canvasHeight + 100
  ) {
    return;
  }

  // 외부 글로우
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 30;

  // 본진 베이스 (외부 원)
  const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, 70);
  gradient.addColorStop(0, color + '40');
  gradient.addColorStop(0.7, color + '20');
  gradient.addColorStop(1, 'transparent');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(screenX, screenY, 70, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // 메인 원
  ctx.fillStyle = '#1a1a25';
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.arc(screenX, screenY, 55, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 내부 원
  ctx.strokeStyle = color + '60';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(screenX, screenY, 40, 0, Math.PI * 2);
  ctx.stroke();

  // 체력바 배경
  const hpBarWidth = 80;
  const hpBarHeight = 8;
  const hpPercent = base.hp / base.maxHp;

  ctx.fillStyle = '#1a1a25';
  ctx.strokeStyle = '#3d3d52';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(screenX - hpBarWidth/2, screenY - 85, hpBarWidth, hpBarHeight, 4);
  ctx.fill();
  ctx.stroke();

  // 체력바
  let hpColor: string;
  if (hpPercent > 0.5) {
    hpColor = '#10b981';
  } else if (hpPercent > 0.2) {
    hpColor = '#f97316';
  } else {
    hpColor = '#ef4444';
  }

  ctx.fillStyle = hpColor;
  ctx.beginPath();
  ctx.roundRect(screenX - hpBarWidth/2 + 1, screenY - 84, (hpBarWidth - 2) * hpPercent, hpBarHeight - 2, 3);
  ctx.fill();

  // 라벨
  ctx.font = 'bold 12px "Noto Sans KR", sans-serif';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(label, screenX, screenY - 95);

  // 본진 아이콘 (Twemoji 사용)
  drawEmoji(ctx, '🏰', screenX, screenY + 5, 40);
}
