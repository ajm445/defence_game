import { RPGGameState, VisibilityState } from '../types/rpg';
import { RPG_CONFIG } from '../constants/rpgConfig';

interface MinimapConfig {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * RPG 미니맵 렌더링 (안개 시야 포함)
 */
export function drawRPGMinimap(
  ctx: CanvasRenderingContext2D,
  state: RPGGameState,
  config: MinimapConfig
) {
  const { x, y, width, height } = config;
  const mapWidth = RPG_CONFIG.MAP_WIDTH;
  const mapHeight = RPG_CONFIG.MAP_HEIGHT;

  // 미니맵 축적 비율
  const scaleX = width / mapWidth;
  const scaleY = height / mapHeight;

  ctx.save();

  // 미니맵 배경
  ctx.fillStyle = 'rgba(10, 10, 20, 0.9)';
  ctx.fillRect(x, y, width, height);

  // 미니맵 테두리
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);

  // 탐사 영역 렌더링 (흐린 표시)
  if (state.visibility && state.hero) {
    drawExploredAreas(ctx, state.visibility, x, y, width, height, scaleX, scaleY);
  }

  // 시야 범위 렌더링 (밝은 영역)
  if (state.hero) {
    drawVisibleArea(ctx, state, x, y, scaleX, scaleY);
  }

  // 적 표시 (시야 내 적만)
  if (state.hero) {
    const visRadius = state.visibility?.visibleRadius || RPG_CONFIG.VISIBILITY.RADIUS;

    for (const enemy of state.enemies) {
      if (enemy.hp <= 0) continue;

      // 시야 내에 있는지 확인
      const dist = Math.sqrt(
        Math.pow(enemy.x - state.hero.x, 2) + Math.pow(enemy.y - state.hero.y, 2)
      );

      if (dist <= visRadius) {
        const enemyX = x + enemy.x * scaleX;
        const enemyY = y + enemy.y * scaleY;

        ctx.fillStyle = enemy.type === 'boss' ? '#ff0000' : '#ff6666';
        ctx.beginPath();
        ctx.arc(enemyX, enemyY, enemy.type === 'boss' ? 4 : 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // 영웅 표시
  if (state.hero) {
    const heroX = x + state.hero.x * scaleX;
    const heroY = y + state.hero.y * scaleY;

    // 시야 범위 표시
    const visRadius = (state.visibility?.visibleRadius || RPG_CONFIG.VISIBILITY.RADIUS) * scaleX;
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(heroX, heroY, visRadius, 0, Math.PI * 2);
    ctx.stroke();

    // 영웅 위치
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(heroX, heroY, 4, 0, Math.PI * 2);
    ctx.fill();

    // 영웅 방향 표시 (이동 중일 때)
    if (state.hero.targetPosition) {
      const targetX = x + state.hero.targetPosition.x * scaleX;
      const targetY = y + state.hero.targetPosition.y * scaleY;

      ctx.strokeStyle = '#ffd70080';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(heroX, heroY);
      ctx.lineTo(targetX, targetY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // 카메라 뷰포트 표시
  const camWidth = 800 * scaleX / state.camera.zoom;
  const camHeight = 600 * scaleY / state.camera.zoom;
  const camX = x + (state.camera.x - 400 / state.camera.zoom) * scaleX;
  const camY = y + (state.camera.y - 300 / state.camera.zoom) * scaleY;

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(camX, camY, camWidth, camHeight);

  ctx.restore();
}

/**
 * 탐사 영역 렌더링
 */
function drawExploredAreas(
  ctx: CanvasRenderingContext2D,
  visibility: VisibilityState,
  x: number,
  y: number,
  width: number,
  height: number,
  scaleX: number,
  scaleY: number
) {
  const cellSize = RPG_CONFIG.VISIBILITY.CELL_SIZE;

  // 먼저 전체를 어둡게
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(x, y, width, height);

  // 탐사된 영역을 반투명으로 표시
  ctx.fillStyle = 'rgba(30, 30, 50, 0.8)';

  visibility.exploredCells.forEach((cellKey) => {
    const [cellX, cellY] = cellKey.split(',').map(Number);
    const px = x + cellX * cellSize * scaleX;
    const py = y + cellY * cellSize * scaleY;
    const pw = cellSize * scaleX;
    const ph = cellSize * scaleY;

    ctx.fillRect(px, py, pw, ph);
  });
}

/**
 * 현재 시야 범위 렌더링 (밝은 영역)
 */
function drawVisibleArea(
  ctx: CanvasRenderingContext2D,
  state: RPGGameState,
  x: number,
  y: number,
  scaleX: number,
  scaleY: number
) {
  if (!state.hero || !state.visibility) return;

  const heroX = x + state.hero.x * scaleX;
  const heroY = y + state.hero.y * scaleY;
  const radius = state.visibility.visibleRadius * scaleX;

  // 시야 영역을 밝게 표시
  const gradient = ctx.createRadialGradient(heroX, heroY, 0, heroX, heroY, radius);
  gradient.addColorStop(0, 'rgba(50, 50, 80, 0.9)');
  gradient.addColorStop(0.7, 'rgba(40, 40, 70, 0.9)');
  gradient.addColorStop(1, 'rgba(30, 30, 50, 0.8)');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(heroX, heroY, radius, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * 미니맵 컴포넌트 설정 가져오기
 */
export function getMinimapConfig(canvasWidth: number, canvasHeight: number): MinimapConfig {
  const minimapSize = 180;
  const margin = 20;

  return {
    x: canvasWidth - minimapSize - margin,
    y: canvasHeight - minimapSize - margin,
    width: minimapSize,
    height: minimapSize,
  };
}
