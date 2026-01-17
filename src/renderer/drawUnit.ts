import { Unit, Camera } from '../types';
import type { NetworkUnit } from '@shared/types/game';

const EMOJI_MAP: Record<string, string> = {
  melee: '⚔️',
  ranged: '🏹',
  knight: '🛡️',
  woodcutter: '🪓',
  miner: '⛏️',
  gatherer: '🧺',
  goldminer: '💰',
};

export function drawUnit(
  ctx: CanvasRenderingContext2D,
  unit: Unit,
  camera: Camera,
  teamColor: string,
  isSelected: boolean,
  canvasWidth: number,
  canvasHeight: number
) {
  const screenX = unit.x - camera.x;
  const screenY = unit.y - camera.y;

  // 화면 밖이면 스킵
  if (
    screenX < -30 ||
    screenX > canvasWidth + 30 ||
    screenY < -30 ||
    screenY > canvasHeight + 30
  ) {
    return;
  }

  ctx.save();

  // 선택된 유닛 글로우
  if (isSelected) {
    ctx.shadowColor = '#00f5ff';
    ctx.shadowBlur = 15;
  }

  // 유닛 베이스 (외부 원)
  const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, 20);
  gradient.addColorStop(0, teamColor + '40');
  gradient.addColorStop(1, 'transparent');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(screenX, screenY, 20, 0, Math.PI * 2);
  ctx.fill();

  // 메인 원
  ctx.fillStyle = '#1a1a25';
  ctx.strokeStyle = isSelected ? '#00f5ff' : teamColor;
  ctx.lineWidth = isSelected ? 3 : 2;

  ctx.beginPath();
  ctx.arc(screenX, screenY, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();

  // 유닛 아이콘
  ctx.font = '14px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const emoji = EMOJI_MAP[unit.type] || '❓';
  ctx.fillText(emoji, screenX, screenY);

  // 체력바 배경
  const hpBarWidth = 24;
  const hpBarHeight = 4;
  const hpPercent = unit.hp / unit.maxHp;

  ctx.fillStyle = '#1a1a25';
  ctx.beginPath();
  ctx.roundRect(screenX - hpBarWidth/2, screenY - 24, hpBarWidth, hpBarHeight, 2);
  ctx.fill();

  // 체력바
  ctx.fillStyle = hpPercent > 0.5 ? '#10b981' : '#ef4444';
  ctx.beginPath();
  ctx.roundRect(screenX - hpBarWidth/2 + 1, screenY - 23, (hpBarWidth - 2) * hpPercent, hpBarHeight - 2, 1);
  ctx.fill();

  // 상태 인디케이터
  if (unit.state === 'attacking') {
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(screenX + 12, screenY - 12, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (unit.state === 'gathering') {
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(screenX + 12, screenY - 12, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

// 네트워크 유닛 그리기 (멀티플레이어용)
export function drawNetworkUnit(
  ctx: CanvasRenderingContext2D,
  unit: NetworkUnit,
  camera: Camera,
  teamColor: string,
  isSelected: boolean,
  canvasWidth: number,
  canvasHeight: number
) {
  const screenX = unit.x - camera.x;
  const screenY = unit.y - camera.y;

  // 화면 밖이면 스킵
  if (
    screenX < -30 ||
    screenX > canvasWidth + 30 ||
    screenY < -30 ||
    screenY > canvasHeight + 30
  ) {
    return;
  }

  ctx.save();

  // 선택된 유닛 글로우
  if (isSelected) {
    ctx.shadowColor = '#00f5ff';
    ctx.shadowBlur = 15;
  }

  // 유닛 베이스 (외부 원)
  const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, 20);
  gradient.addColorStop(0, teamColor + '40');
  gradient.addColorStop(1, 'transparent');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(screenX, screenY, 20, 0, Math.PI * 2);
  ctx.fill();

  // 메인 원
  ctx.fillStyle = '#1a1a25';
  ctx.strokeStyle = isSelected ? '#00f5ff' : teamColor;
  ctx.lineWidth = isSelected ? 3 : 2;

  ctx.beginPath();
  ctx.arc(screenX, screenY, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();

  // 유닛 아이콘
  ctx.font = '14px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const emoji = EMOJI_MAP[unit.type] || '❓';
  ctx.fillText(emoji, screenX, screenY);

  // 체력바 배경
  const hpBarWidth = 24;
  const hpBarHeight = 4;
  const hpPercent = unit.hp / unit.maxHp;

  ctx.fillStyle = '#1a1a25';
  ctx.beginPath();
  ctx.roundRect(screenX - hpBarWidth/2, screenY - 24, hpBarWidth, hpBarHeight, 2);
  ctx.fill();

  // 체력바
  ctx.fillStyle = hpPercent > 0.5 ? '#10b981' : '#ef4444';
  ctx.beginPath();
  ctx.roundRect(screenX - hpBarWidth/2 + 1, screenY - 23, (hpBarWidth - 2) * hpPercent, hpBarHeight - 2, 1);
  ctx.fill();

  // 상태 인디케이터
  if (unit.state === 'attacking') {
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(screenX + 12, screenY - 12, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (unit.state === 'gathering') {
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(screenX + 12, screenY - 12, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}
