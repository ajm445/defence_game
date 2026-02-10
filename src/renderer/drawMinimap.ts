import { GameState, Camera } from '../types';
import type { NetworkGameState, PlayerSide } from '@shared/types/game';
import { CONFIG } from '../constants/config';

const NODE_COLORS: Record<string, string> = {
  tree: '#22c55e',
  rock: '#6b7280',
  herb: '#86efac',
  crystal: '#a855f7',
  goldmine: '#fbbf24',
};

export function drawMinimap(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  minimapWidth: number,
  minimapHeight: number,
  viewportWidth: number,
  viewportHeight: number
) {
  const scaleX = minimapWidth / CONFIG.MAP_WIDTH;
  const scaleY = minimapHeight / CONFIG.MAP_HEIGHT;

  // 배경
  const gradient = ctx.createLinearGradient(0, 0, 0, minimapHeight);
  gradient.addColorStop(0, '#12121a');
  gradient.addColorStop(1, '#0a0a0f');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, minimapWidth, minimapHeight);

  // 그리드
  ctx.strokeStyle = 'rgba(0, 245, 255, 0.1)';
  ctx.lineWidth = 0.5;
  const gridSpacing = 20;
  for (let x = 0; x < minimapWidth; x += gridSpacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, minimapHeight);
    ctx.stroke();
  }
  for (let y = 0; y < minimapHeight; y += gridSpacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(minimapWidth, y);
    ctx.stroke();
  }

  // 자원 노드
  for (const node of state.resourceNodes) {
    if (node.amount > 0) {
      const color = NODE_COLORS[node.type] || '#666';
      const alpha = 0.3 + (node.amount / node.maxAmount) * 0.7;
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      ctx.fillRect(node.x * scaleX - 1, node.y * scaleY - 1, 3, 3);
      ctx.globalAlpha = 1;
    }
  }

  // 지뢰
  ctx.fillStyle = '#ff6400';
  for (const mine of state.mines) {
    ctx.fillRect(mine.x * scaleX - 2, mine.y * scaleY - 2, 4, 4);
  }

  // 플레이어 본진
  ctx.fillStyle = '#00f5ff';
  ctx.shadowColor = '#00f5ff';
  ctx.shadowBlur = 5;
  ctx.beginPath();
  ctx.arc(
    state.playerBase.x * scaleX,
    state.playerBase.y * scaleY,
    5,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // 적 본진
  ctx.fillStyle = '#ef4444';
  ctx.shadowColor = '#ef4444';
  ctx.beginPath();
  ctx.arc(
    state.enemyBase.x * scaleX,
    state.enemyBase.y * scaleY,
    5,
    0,
    Math.PI * 2
  );
  ctx.fill();

  ctx.shadowBlur = 0;

  // 플레이어 유닛
  ctx.fillStyle = '#00f5ff';
  for (const unit of state.units) {
    ctx.fillRect(unit.x * scaleX - 1, unit.y * scaleY - 1, 2, 2);
  }

  // 적 유닛
  ctx.fillStyle = '#ef4444';
  for (const unit of state.enemyUnits) {
    ctx.fillRect(unit.x * scaleX - 1, unit.y * scaleY - 1, 2, 2);
  }

  // 카메라 영역
  ctx.strokeStyle = '#00f5ff';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(
    state.camera.x * scaleX,
    state.camera.y * scaleY,
    viewportWidth * scaleX,
    viewportHeight * scaleY
  );
}

// 멀티플레이어용 미니맵 그리기
export function drawMinimapMultiplayer(
  ctx: CanvasRenderingContext2D,
  gameState: NetworkGameState,
  mySide: PlayerSide,
  camera: Camera,
  minimapWidth: number,
  minimapHeight: number,
  viewportWidth: number,
  viewportHeight: number
) {
  const scaleX = minimapWidth / CONFIG.MAP_WIDTH;
  const scaleY = minimapHeight / CONFIG.MAP_HEIGHT;

  // 배경
  const gradient = ctx.createLinearGradient(0, 0, 0, minimapHeight);
  gradient.addColorStop(0, '#12121a');
  gradient.addColorStop(1, '#0a0a0f');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, minimapWidth, minimapHeight);

  // 그리드
  ctx.strokeStyle = 'rgba(0, 245, 255, 0.1)';
  ctx.lineWidth = 0.5;
  const gridSpacing = 20;
  for (let x = 0; x < minimapWidth; x += gridSpacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, minimapHeight);
    ctx.stroke();
  }
  for (let y = 0; y < minimapHeight; y += gridSpacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(minimapWidth, y);
    ctx.stroke();
  }

  // 자원 노드
  for (const node of gameState.resourceNodes) {
    if (node.amount > 0) {
      const color = NODE_COLORS[node.type] || '#666';
      const alpha = 0.3 + (node.amount / node.maxAmount) * 0.7;
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      ctx.fillRect(node.x * scaleX - 1, node.y * scaleY - 1, 3, 3);
      ctx.globalAlpha = 1;
    }
  }

  // 지뢰 (내 것만 보임, 서버에서 필터링됨)
  ctx.fillStyle = '#ff6400';
  for (const mine of gameState.mines) {
    ctx.fillRect(mine.x * scaleX - 2, mine.y * scaleY - 2, 4, 4);
  }

  // 본진
  const myBaseX = mySide === 'left' ? 200 : CONFIG.MAP_WIDTH - 200;
  const enemyBaseX = mySide === 'left' ? CONFIG.MAP_WIDTH - 200 : 200;
  const baseY = CONFIG.MAP_HEIGHT / 2;

  // 내 본진
  ctx.fillStyle = '#00f5ff';
  ctx.shadowColor = '#00f5ff';
  ctx.shadowBlur = 5;
  ctx.beginPath();
  ctx.arc(myBaseX * scaleX, baseY * scaleY, 5, 0, Math.PI * 2);
  ctx.fill();

  // 적 본진
  ctx.fillStyle = '#ef4444';
  ctx.shadowColor = '#ef4444';
  ctx.beginPath();
  ctx.arc(enemyBaseX * scaleX, baseY * scaleY, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;

  // 유닛
  for (const unit of gameState.units) {
    ctx.fillStyle = unit.side === mySide ? '#00f5ff' : '#ef4444';
    ctx.fillRect(unit.x * scaleX - 1, unit.y * scaleY - 1, 2, 2);
  }

  // 카메라 영역
  ctx.strokeStyle = '#00f5ff';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(
    camera.x * scaleX,
    camera.y * scaleY,
    viewportWidth * scaleX,
    viewportHeight * scaleY
  );
}
