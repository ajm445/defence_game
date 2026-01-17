import { GameState, Camera } from '../types';
import type { NetworkGameState, PlayerSide } from '@shared/types/game';
import { drawGrid } from './drawGrid';
import { drawResourceNode } from './drawResourceNode';
import { drawBase } from './drawBase';
import { drawUnit, drawNetworkUnit } from './drawUnit';
import { drawWall, drawNetworkWall } from './drawWall';

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

// 멀티플레이어용 렌더 함수
export function renderMultiplayer(
  ctx: CanvasRenderingContext2D,
  gameState: NetworkGameState,
  mySide: PlayerSide,
  camera: Camera,
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
  drawGrid(ctx, camera, canvasWidth, canvasHeight);

  // 자원 노드 그리기
  for (const node of gameState.resourceNodes) {
    drawResourceNode(ctx, node, camera, canvasWidth, canvasHeight);
  }

  // 벽 그리기
  for (const wall of gameState.walls) {
    // 내 벽은 시안, 적 벽은 빨강
    const color = wall.side === mySide ? '#00f5ff' : '#ef4444';
    drawNetworkWall(ctx, wall, camera, color, canvasWidth, canvasHeight);
  }

  // 본진 그리기 - 내 진영 기준으로 색상 결정
  const myBaseX = mySide === 'left' ? 200 : 2800;
  const enemyBaseX = mySide === 'left' ? 2800 : 200;
  const myPlayer = mySide === 'left' ? gameState.leftPlayer : gameState.rightPlayer;
  const enemyPlayer = mySide === 'left' ? gameState.rightPlayer : gameState.leftPlayer;

  drawBase(
    ctx,
    { x: myBaseX, y: 1000, hp: myPlayer.baseHp, maxHp: myPlayer.maxBaseHp },
    camera,
    '#00f5ff', // 시안 (내 기지)
    '아군 본진',
    canvasWidth,
    canvasHeight
  );
  drawBase(
    ctx,
    { x: enemyBaseX, y: 1000, hp: enemyPlayer.baseHp, maxHp: enemyPlayer.maxBaseHp },
    camera,
    '#ef4444', // 레드 (적 기지)
    '적 본진',
    canvasWidth,
    canvasHeight
  );

  // 유닛 그리기
  for (const unit of gameState.units) {
    // 내 유닛은 시안, 적 유닛은 빨강
    const color = unit.side === mySide ? '#00f5ff' : '#ef4444';
    drawNetworkUnit(ctx, unit, camera, color, false, canvasWidth, canvasHeight);
  }
}

export { drawMinimap, drawMinimapMultiplayer } from './drawMinimap';
