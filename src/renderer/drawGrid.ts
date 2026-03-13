import { Camera } from '../types';

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number,
  gridColors?: { mainColor: string; subColor: string }
) {
  const mainColor = gridColors?.mainColor ?? 'rgba(0, 245, 255, 0)';
  const subColor = gridColors?.subColor ?? 'rgba(0, 245, 255, 0)';

  const gridSize = 100;
  const startX = -camera.x % gridSize;
  const startY = -camera.y % gridSize;

  // 메인 그리드
  ctx.strokeStyle = mainColor;
  ctx.lineWidth = 1;

  for (let x = startX; x < canvasWidth; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvasHeight);
    ctx.stroke();
  }

  for (let y = startY; y < canvasHeight; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvasWidth, y);
    ctx.stroke();
  }

  // 서브 그리드 (더 작은 간격)
  const subGridSize = 25;
  const subStartX = -camera.x % subGridSize;
  const subStartY = -camera.y % subGridSize;

  ctx.strokeStyle = subColor;

  for (let x = subStartX; x < canvasWidth; x += subGridSize) {
    if ((x - subStartX) % gridSize !== 0) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasHeight);
      ctx.stroke();
    }
  }

  for (let y = subStartY; y < canvasHeight; y += subGridSize) {
    if ((y - subStartY) % gridSize !== 0) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasWidth, y);
      ctx.stroke();
    }
  }
}
