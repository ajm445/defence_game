import { RPGGameState } from '../types/rpg';
import { RPG_CONFIG } from '../constants/rpgConfig';
import { drawGrid } from './drawGrid';
import { drawHero, drawRPGEnemy, drawSkillEffect, drawHeroAttackRange } from './drawHero';
import { effectManager } from '../effects';
import { drawRPGMinimap, getMinimapConfig } from './drawRPGMinimap';

/**
 * RPG 모드 렌더링
 */
export function renderRPG(
  ctx: CanvasRenderingContext2D,
  state: RPGGameState,
  canvasWidth: number,
  canvasHeight: number
) {
  const zoom = state.camera.zoom;

  // 캔버스 클리어 - 다크 그라데이션 배경
  const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
  gradient.addColorStop(0, '#1a1a2e');
  gradient.addColorStop(0.5, '#16213e');
  gradient.addColorStop(1, '#0f0f23');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // 줌 변환 적용
  ctx.save();
  ctx.scale(zoom, zoom);

  const scaledWidth = canvasWidth / zoom;
  const scaledHeight = canvasHeight / zoom;

  // 카메라 적용
  const camera = {
    x: state.camera.x - scaledWidth / 2,
    y: state.camera.y - scaledHeight / 2,
    zoom: state.camera.zoom,
  };

  // 배경 그리드
  drawGrid(ctx, camera, scaledWidth, scaledHeight);

  // 맵 경계 표시
  drawMapBoundary(ctx, camera, scaledWidth, scaledHeight);

  // 스킬 이펙트 렌더링
  for (const effect of state.activeSkillEffects) {
    drawSkillEffect(ctx, effect, camera, state.gameTime);
  }

  // 적 유닛 렌더링
  for (const enemy of state.enemies) {
    if (enemy.hp > 0) {
      const isTarget = state.hero?.attackTarget === enemy.id;
      drawRPGEnemy(ctx, enemy, camera, scaledWidth, scaledHeight, isTarget);
    }
  }

  // 영웅 렌더링
  if (state.hero) {
    // 공격 범위 표시 (옵션)
    // drawHeroAttackRange(ctx, state.hero, camera);

    drawHero(ctx, state.hero, camera, scaledWidth, scaledHeight);
  }

  // 파티클 이펙트 렌더링
  effectManager.render(ctx, camera.x, camera.y, scaledWidth, scaledHeight);

  // 줌 변환 복원
  ctx.restore();

  // 미니맵 렌더링
  const minimapConfig = getMinimapConfig(canvasWidth, canvasHeight);
  drawRPGMinimap(ctx, state, minimapConfig);

  // 게임 오버 오버레이
  if (state.gameOver) {
    drawGameOverOverlay(ctx, canvasWidth, canvasHeight, state.victory);
  }

  // 일시정지 오버레이
  if (state.paused) {
    drawPausedOverlay(ctx, canvasWidth, canvasHeight);
  }
}

/**
 * 맵 경계 표시
 */
function drawMapBoundary(
  ctx: CanvasRenderingContext2D,
  camera: { x: number; y: number },
  canvasWidth: number,
  canvasHeight: number
) {
  ctx.save();

  // 맵 영역 외부 어둡게
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';

  // 왼쪽
  if (camera.x < 0) {
    ctx.fillRect(0, 0, -camera.x, canvasHeight);
  }

  // 오른쪽
  const rightEdge = RPG_CONFIG.MAP_WIDTH - camera.x;
  if (rightEdge < canvasWidth) {
    ctx.fillRect(rightEdge, 0, canvasWidth - rightEdge, canvasHeight);
  }

  // 위쪽
  if (camera.y < 0) {
    ctx.fillRect(0, 0, canvasWidth, -camera.y);
  }

  // 아래쪽
  const bottomEdge = RPG_CONFIG.MAP_HEIGHT - camera.y;
  if (bottomEdge < canvasHeight) {
    ctx.fillRect(0, bottomEdge, canvasWidth, canvasHeight - bottomEdge);
  }

  // 맵 경계선
  ctx.strokeStyle = '#ffd70050';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 10]);
  ctx.strokeRect(
    -camera.x,
    -camera.y,
    RPG_CONFIG.MAP_WIDTH,
    RPG_CONFIG.MAP_HEIGHT
  );
  ctx.setLineDash([]);

  ctx.restore();
}

/**
 * 게임 오버 오버레이
 */
function drawGameOverOverlay(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  victory: boolean
) {
  ctx.save();

  // 반투명 배경
  ctx.fillStyle = victory ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // 텍스트
  ctx.font = 'bold 64px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 텍스트 그림자
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillText(victory ? '승리!' : '게임 오버', canvasWidth / 2 + 3, canvasHeight / 2 + 3);

  // 텍스트
  ctx.fillStyle = victory ? '#10b981' : '#ef4444';
  ctx.fillText(victory ? '승리!' : '게임 오버', canvasWidth / 2, canvasHeight / 2);

  ctx.restore();
}

/**
 * 일시정지 오버레이
 */
function drawPausedOverlay(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number
) {
  ctx.save();

  // 반투명 배경
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // 일시정지 아이콘
  ctx.fillStyle = '#ffffff';
  const iconSize = 60;
  const barWidth = 15;
  const gap = 15;

  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;

  // 왼쪽 바
  ctx.fillRect(
    centerX - gap / 2 - barWidth,
    centerY - iconSize / 2,
    barWidth,
    iconSize
  );

  // 오른쪽 바
  ctx.fillRect(
    centerX + gap / 2,
    centerY - iconSize / 2,
    barWidth,
    iconSize
  );

  // 텍스트
  ctx.font = '24px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('일시정지', centerX, centerY + 60);

  ctx.restore();
}
