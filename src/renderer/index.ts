import { GameState } from '../types';
import { drawGrid } from './drawGrid';
import { drawResourceNode } from './drawResourceNode';
import { drawBase } from './drawBase';
import { drawUnit } from './drawUnit';
import { drawWall } from './drawWall';

export function render(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  canvasWidth: number,
  canvasHeight: number
) {
  // 캔버스 클리어 - 다크 그라데이션 배경
  const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
  gradient.addColorStop(0, '#1a2e1a');
  gradient.addColorStop(0.5, '#162016');
  gradient.addColorStop(1, '#0f1a0f');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // 배경 그리드
  drawGrid(ctx, state.camera, canvasWidth, canvasHeight);

  // 자원 노드 그리기
  for (const node of state.resourceNodes) {
    drawResourceNode(ctx, node, state.camera, canvasWidth, canvasHeight);
  }

  // 벽 그리기
  for (const wall of state.walls) {
    drawWall(ctx, wall, state.camera, canvasWidth, canvasHeight);
  }

  // 본진 그리기
  drawBase(
    ctx,
    state.playerBase,
    state.camera,
    '#00f5ff', // 시안
    '아군 본진',
    canvasWidth,
    canvasHeight
  );
  drawBase(
    ctx,
    state.enemyBase,
    state.camera,
    '#ef4444', // 레드
    '적 본진',
    canvasWidth,
    canvasHeight
  );

  // 유닛 그리기
  for (const unit of state.units) {
    drawUnit(
      ctx,
      unit,
      state.camera,
      '#00f5ff',
      unit === state.selectedUnit,
      canvasWidth,
      canvasHeight
    );
  }
  for (const unit of state.enemyUnits) {
    drawUnit(
      ctx,
      unit,
      state.camera,
      '#ef4444',
      false,
      canvasWidth,
      canvasHeight
    );
  }
}

export { drawMinimap } from './drawMinimap';
