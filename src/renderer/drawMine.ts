import { Mine, Camera } from '../types';
import type { NetworkMine } from '@shared/types/game';
import { CONFIG } from '../constants/config';

export function drawMine(
  ctx: CanvasRenderingContext2D,
  mine: Mine,
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number
) {
  const screenX = mine.x - camera.x;
  const screenY = mine.y - camera.y;

  // 화면 밖이면 스킵
  if (
    screenX < -30 ||
    screenX > canvasWidth + 30 ||
    screenY < -30 ||
    screenY > canvasHeight + 30
  ) {
    return;
  }

  // 펄스 애니메이션
  const pulse = 0.8 + Math.sin(Date.now() / 500) * 0.2;

  // 주황 글로우
  ctx.save();
  ctx.shadowColor = '#ff9600';
  ctx.shadowBlur = 8 * pulse;

  // 지뢰 본체
  ctx.fillStyle = 'rgba(60, 40, 20, 0.9)';
  ctx.strokeStyle = '#ff9600';
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.arc(screenX, screenY, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();

  // 지뢰 아이콘
  ctx.font = '16px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('💣', screenX, screenY);

  // 감지 범위 점선 원 (소유자 전용)
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 150, 0, 0.25)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(screenX, screenY, CONFIG.MINE_TRIGGER_RADIUS, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// 네트워크 지뢰 그리기 (멀티플레이어용, 자기 지뢰만 보임)
export function drawNetworkMine(
  ctx: CanvasRenderingContext2D,
  mine: NetworkMine,
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number
) {
  const screenX = mine.x - camera.x;
  const screenY = mine.y - camera.y;

  if (
    screenX < -30 ||
    screenX > canvasWidth + 30 ||
    screenY < -30 ||
    screenY > canvasHeight + 30
  ) {
    return;
  }

  const pulse = 0.8 + Math.sin(Date.now() / 500) * 0.2;

  ctx.save();
  ctx.shadowColor = '#00f5ff';
  ctx.shadowBlur = 8 * pulse;

  ctx.fillStyle = 'rgba(20, 40, 60, 0.9)';
  ctx.strokeStyle = '#00f5ff';
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.arc(screenX, screenY, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();

  ctx.font = '16px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('💣', screenX, screenY);

  // 감지 범위 점선 원
  ctx.save();
  ctx.strokeStyle = 'rgba(0, 245, 255, 0.25)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(screenX, screenY, CONFIG.MINE_TRIGGER_RADIUS, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
