import { Nexus, EnemyBase, NexusLaserEffect } from '../types/rpg';
import { NEXUS_CONFIG, ENEMY_BASE_CONFIG } from '../constants/rpgConfig';

/**
 * 넥서스 그리기
 * 참고: ctx.scale(zoom, zoom)이 이미 적용된 상태에서 호출됨
 * camera는 이미 스케일 조정됨 (state.camera.x - scaledWidth/2)
 */
export function drawNexus(
  ctx: CanvasRenderingContext2D,
  nexus: Nexus,
  camera: { x: number; y: number; zoom: number },
  _canvasWidth: number,
  _canvasHeight: number
): void {
  // 다른 엔티티와 동일한 좌표 변환 (ctx.scale이 이미 적용됨)
  const screenX = nexus.x - camera.x;
  const screenY = nexus.y - camera.y;
  const radius = NEXUS_CONFIG.radius;  // zoom은 ctx.scale로 이미 적용됨

  // HP 비율
  const hpPercent = nexus.hp / nexus.maxHp;

  // 넥서스 외곽 (파란 글로우)
  const glowGradient = ctx.createRadialGradient(
    screenX, screenY, radius * 0.5,
    screenX, screenY, radius * 1.5
  );
  glowGradient.addColorStop(0, 'rgba(0, 200, 255, 0.5)');
  glowGradient.addColorStop(0.5, 'rgba(0, 150, 255, 0.2)');
  glowGradient.addColorStop(1, 'rgba(0, 100, 255, 0)');

  ctx.beginPath();
  ctx.arc(screenX, screenY, radius * 1.5, 0, Math.PI * 2);
  ctx.fillStyle = glowGradient;
  ctx.fill();

  // 넥서스 본체 (육각형)
  ctx.save();
  ctx.translate(screenX, screenY);

  // 본체 배경
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3 - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();

  // 그라디언트 채우기
  const bodyGradient = ctx.createLinearGradient(0, -radius, 0, radius);
  bodyGradient.addColorStop(0, '#00d4ff');
  bodyGradient.addColorStop(0.5, '#0088cc');
  bodyGradient.addColorStop(1, '#005588');

  ctx.fillStyle = bodyGradient;
  ctx.fill();

  // 테두리
  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth = 3;
  ctx.stroke();

  // 중앙 코어
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = hpPercent > 0.5 ? '#00ffff' : hpPercent > 0.25 ? '#ffff00' : '#ff4444';
  ctx.fill();

  ctx.restore();

  // HP 바
  const hpBarWidth = radius * 2;
  const hpBarHeight = 8;
  const hpBarX = screenX - hpBarWidth / 2;
  const hpBarY = screenY + radius + 15;

  // HP 바 배경
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(hpBarX, hpBarY, hpBarWidth, hpBarHeight);

  // HP 바 내용
  const hpColor = hpPercent > 0.5 ? '#00ff00' : hpPercent > 0.25 ? '#ffff00' : '#ff4444';
  ctx.fillStyle = hpColor;
  ctx.fillRect(hpBarX, hpBarY, hpBarWidth * hpPercent, hpBarHeight);

  // HP 바 테두리
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.strokeRect(hpBarX, hpBarY, hpBarWidth, hpBarHeight);

  // HP 텍스트
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.floor(nexus.hp)} / ${nexus.maxHp}`, screenX, hpBarY + hpBarHeight + 12);

  // 라벨
  ctx.fillStyle = '#00ffff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('NEXUS', screenX, screenY - radius - 10);
}

/**
 * 적 기지 그리기
 * 참고: ctx.scale(zoom, zoom)이 이미 적용된 상태에서 호출됨
 */
export function drawEnemyBase(
  ctx: CanvasRenderingContext2D,
  base: EnemyBase,
  camera: { x: number; y: number; zoom: number },
  _canvasWidth: number,
  _canvasHeight: number,
  gameTime: number = 0
): void {
  // 다른 엔티티와 동일한 좌표 변환
  const screenX = base.x - camera.x;
  const screenY = base.y - camera.y;
  const config = ENEMY_BASE_CONFIG[base.id];
  const radius = config.radius;  // zoom은 ctx.scale로 이미 적용됨

  // HP 비율
  const hpPercent = base.hp / base.maxHp;

  if (base.destroyed) {
    // 파괴된 기지 - 잔해
    ctx.save();
    ctx.translate(screenX, screenY);
    ctx.globalAlpha = 0.5;

    // 잔해 조각들
    ctx.fillStyle = '#333333';
    for (let i = 0; i < 5; i++) {
      const angle = (i * Math.PI * 2) / 5 + Math.random() * 0.3;
      const dist = radius * 0.5 + Math.random() * radius * 0.3;
      const size = radius * 0.2 + Math.random() * radius * 0.1;
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * dist, Math.sin(angle) * dist, size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.restore();

    // 파괴됨 표시
    ctx.fillStyle = '#888888';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DESTROYED', screenX, screenY + radius + 20);
    return;
  }

  // === 미니 마왕성 ===
  const flagWave = Math.sin(gameTime * 3) * 0.12; // 깃발 펄럭임

  ctx.save();
  ctx.translate(screenX, screenY);

  // === A. 외곽 글로우 ===
  const glowGradient = ctx.createRadialGradient(0, 0, radius * 0.3, 0, 0, radius * 1.4);
  glowGradient.addColorStop(0, 'rgba(120, 40, 60, 0.3)');
  glowGradient.addColorStop(1, 'rgba(80, 20, 40, 0)');
  ctx.beginPath();
  ctx.arc(0, 0, radius * 1.4, 0, Math.PI * 2);
  ctx.fillStyle = glowGradient;
  ctx.fill();

  // === B. 성벽 본체 ===
  const wallW = radius * 1.5;
  const wallH = radius * 1.3;
  const wallR = radius * 0.08; // 약간만 둥글게

  // 성벽 그라디언트 (어두운 석재 톤)
  const wallGrad = ctx.createLinearGradient(0, -wallH / 2, 0, wallH / 2);
  wallGrad.addColorStop(0, '#4a3848');
  wallGrad.addColorStop(0.5, '#3d2d3d');
  wallGrad.addColorStop(1, '#322632');

  // 약간 둥근 사각형
  ctx.beginPath();
  ctx.moveTo(-wallW / 2 + wallR, -wallH / 2);
  ctx.lineTo(wallW / 2 - wallR, -wallH / 2);
  ctx.quadraticCurveTo(wallW / 2, -wallH / 2, wallW / 2, -wallH / 2 + wallR);
  ctx.lineTo(wallW / 2, wallH / 2);
  ctx.lineTo(-wallW / 2, wallH / 2);
  ctx.lineTo(-wallW / 2, -wallH / 2 + wallR);
  ctx.quadraticCurveTo(-wallW / 2, -wallH / 2, -wallW / 2 + wallR, -wallH / 2);
  ctx.closePath();
  ctx.fillStyle = wallGrad;
  ctx.fill();

  // 성벽 테두리
  ctx.strokeStyle = '#6a4a5a';
  ctx.lineWidth = 3;
  ctx.stroke();

  // 성벽 상단 흉벽 (각진 톱니)
  const battlementCount = 5;
  const bWidth = wallW / (battlementCount * 2 + 1);
  const bHeight = radius * 0.16;
  for (let i = 0; i < battlementCount; i++) {
    const bx = -wallW / 2 + bWidth * (i * 2 + 1);
    const by = -wallH / 2 - bHeight;
    ctx.fillStyle = '#4a3848';
    ctx.fillRect(bx, by, bWidth, bHeight);
    ctx.strokeStyle = '#6a4a5a';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, by, bWidth, bHeight);
  }

  // === C. 좌우 탑 ===
  const towerPositions = [
    { x: -wallW / 2 - radius * 0.02, y: 0 },
    { x: wallW / 2 + radius * 0.02, y: 0 },
  ];
  const tRadius = radius * 0.25;

  for (const tp of towerPositions) {
    // 탑 몸체 (사각형 기둥)
    ctx.fillStyle = '#4a3848';
    ctx.fillRect(tp.x - tRadius, -wallH / 2 - bHeight, tRadius * 2, wallH + bHeight);
    ctx.strokeStyle = '#6a4a5a';
    ctx.lineWidth = 2;
    ctx.strokeRect(tp.x - tRadius, -wallH / 2 - bHeight, tRadius * 2, wallH + bHeight);

    // 탑 지붕 (삼각형)
    const roofH = tRadius * 1.4;
    const roofTop = -wallH / 2 - bHeight - roofH;
    ctx.beginPath();
    ctx.moveTo(tp.x, roofTop);
    ctx.lineTo(tp.x - tRadius * 1.1, -wallH / 2 - bHeight);
    ctx.lineTo(tp.x + tRadius * 1.1, -wallH / 2 - bHeight);
    ctx.closePath();

    const roofGrad = ctx.createLinearGradient(tp.x, roofTop, tp.x, -wallH / 2 - bHeight);
    roofGrad.addColorStop(0, '#8b3040');
    roofGrad.addColorStop(1, '#6b2030');
    ctx.fillStyle = roofGrad;
    ctx.fill();
    ctx.strokeStyle = '#9b4050';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 탑 창문 (빛나는 작은 사각)
    const winSize = tRadius * 0.35;
    ctx.fillStyle = '#1a0a10';
    ctx.fillRect(tp.x - winSize, tp.y - winSize, winSize * 2, winSize * 2);
    const windowGlow = ctx.createRadialGradient(tp.x, tp.y, 0, tp.x, tp.y, winSize);
    windowGlow.addColorStop(0, 'rgba(255, 160, 60, 0.7)');
    windowGlow.addColorStop(1, 'rgba(200, 100, 30, 0.1)');
    ctx.fillStyle = windowGlow;
    ctx.fillRect(tp.x - winSize, tp.y - winSize, winSize * 2, winSize * 2);
  }

  // === D. 중앙 문 (아치형) ===
  const doorW = radius * 0.3;
  const doorH = radius * 0.45;
  const doorY = wallH / 2 - doorH;

  ctx.beginPath();
  ctx.moveTo(-doorW, wallH / 2);
  ctx.lineTo(-doorW, doorY);
  ctx.arc(0, doorY, doorW, Math.PI, 0, false);
  ctx.lineTo(doorW, wallH / 2);
  ctx.closePath();
  ctx.fillStyle = '#1a0a10';
  ctx.fill();
  ctx.strokeStyle = '#7a5533';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 문 안쪽 빛
  const doorGlow = ctx.createRadialGradient(0, doorY + doorH * 0.4, 0, 0, doorY + doorH * 0.4, doorW * 0.6);
  doorGlow.addColorStop(0, 'rgba(255, 140, 40, 0.4)');
  doorGlow.addColorStop(1, 'rgba(200, 80, 20, 0)');
  ctx.beginPath();
  ctx.moveTo(-doorW + 2, wallH / 2);
  ctx.lineTo(-doorW + 2, doorY);
  ctx.arc(0, doorY, doorW - 2, Math.PI, 0, false);
  ctx.lineTo(doorW - 2, wallH / 2);
  ctx.closePath();
  ctx.fillStyle = doorGlow;
  ctx.fill();

  // === E. 깃발 ===
  const flagX = 0;
  const flagBaseY = -wallH / 2 - bHeight;
  const flagPoleH = radius * 0.55;

  // 깃대
  ctx.beginPath();
  ctx.moveTo(flagX, flagBaseY);
  ctx.lineTo(flagX, flagBaseY - flagPoleH);
  ctx.strokeStyle = '#8a6a44';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 깃발 (펄럭이는 삼각형)
  ctx.save();
  ctx.translate(flagX, flagBaseY - flagPoleH);
  ctx.rotate(flagWave);

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(radius * 0.3, radius * 0.08);
  ctx.lineTo(0, radius * 0.18);
  ctx.closePath();
  ctx.fillStyle = '#aa2233';
  ctx.fill();
  ctx.strokeStyle = '#cc3344';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  // === F. 중앙 문양 (맥동하는 코어) ===
  const pulseAlpha = 0.5 + Math.sin(gameTime * 2) * 0.25;
  const coreY = -wallH * 0.15;
  const coreRadius = radius * 0.15;

  // 코어 글로우
  const coreGlow = ctx.createRadialGradient(0, coreY, 0, 0, coreY, coreRadius * 2.5);
  coreGlow.addColorStop(0, `rgba(200, 60, 80, ${pulseAlpha * 0.5})`);
  coreGlow.addColorStop(1, 'rgba(150, 40, 60, 0)');
  ctx.beginPath();
  ctx.arc(0, coreY, coreRadius * 2.5, 0, Math.PI * 2);
  ctx.fillStyle = coreGlow;
  ctx.fill();

  // 코어 본체 (다이아몬드)
  ctx.save();
  ctx.translate(0, coreY);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = hpPercent > 0.5 ? '#cc3344' : hpPercent > 0.25 ? '#cc7733' : '#993322';
  ctx.fillRect(-coreRadius, -coreRadius, coreRadius * 2, coreRadius * 2);
  ctx.strokeStyle = '#dd6666';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-coreRadius, -coreRadius, coreRadius * 2, coreRadius * 2);
  ctx.restore();

  // 코어 하이라이트
  ctx.beginPath();
  ctx.arc(-coreRadius * 0.2, coreY - coreRadius * 0.2, coreRadius * 0.25, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 255, 255, ${pulseAlpha * 0.5})`;
  ctx.fill();

  ctx.restore();

  // === G. HP 바 & 라벨 ===
  const hpBarWidth = radius * 2;
  const hpBarHeight = 6;
  const hpBarX = screenX - hpBarWidth / 2;
  const hpBarY = screenY + radius + 10;

  // HP 바 배경
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(hpBarX, hpBarY, hpBarWidth, hpBarHeight);

  // HP 바 내용
  const hpColor = hpPercent > 0.5 ? '#cc3344' : hpPercent > 0.25 ? '#cc7733' : '#cc5522';
  ctx.fillStyle = hpColor;
  ctx.fillRect(hpBarX, hpBarY, hpBarWidth * hpPercent, hpBarHeight);

  // HP 바 테두리
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.strokeRect(hpBarX, hpBarY, hpBarWidth, hpBarHeight);

  // HP 텍스트
  ctx.fillStyle = '#ffffff';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.floor(base.hp)} / ${base.maxHp}`, screenX, hpBarY + hpBarHeight + 10);

}

/**
 * 모든 적 기지 그리기
 */
export function drawAllEnemyBases(
  ctx: CanvasRenderingContext2D,
  bases: EnemyBase[],
  camera: { x: number; y: number; zoom: number },
  canvasWidth: number,
  canvasHeight: number,
  gameTime: number = 0
): void {
  for (const base of bases) {
    drawEnemyBase(ctx, base, camera, canvasWidth, canvasHeight, gameTime);
  }
}

/**
 * 넥서스 레이저 빔 그리기
 * 참고: ctx.scale(zoom, zoom)이 이미 적용된 상태에서 호출됨
 */
export function drawNexusLaserBeams(
  ctx: CanvasRenderingContext2D,
  nexus: Nexus,
  laserEffects: NexusLaserEffect[],
  camera: { x: number; y: number; zoom: number }
): void {
  const now = Date.now();
  const nexusScreenX = nexus.x - camera.x;
  const nexusScreenY = nexus.y - camera.y;

  for (const effect of laserEffects) {
    const age = now - effect.timestamp;
    // 500ms 이후에는 렌더링 안 함
    // 음수 age는 허용 (시계 동기화 문제 또는 방금 생성된 이펙트)
    if (age > 500) continue;

    const targetScreenX = effect.targetX - camera.x;
    const targetScreenY = effect.targetY - camera.y;

    // 알파값 계산 (페이드 아웃)
    // age가 음수면 1.0, 0~500ms면 페이드 아웃
    const alpha = Math.max(0, 1 - Math.max(0, age) / 500);

    // 레이저 빔 메인 라인
    ctx.save();
    ctx.globalAlpha = alpha;

    // 글로우 효과 (넓은 라인)
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(nexusScreenX, nexusScreenY);
    ctx.lineTo(targetScreenX, targetScreenY);
    ctx.stroke();

    // 메인 빔 (중간 라인)
    ctx.strokeStyle = 'rgba(0, 200, 255, 0.6)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(nexusScreenX, nexusScreenY);
    ctx.lineTo(targetScreenX, targetScreenY);
    ctx.stroke();

    // 코어 빔 (얇은 라인)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(nexusScreenX, nexusScreenY);
    ctx.lineTo(targetScreenX, targetScreenY);
    ctx.stroke();

    // 타격 지점 스파크 효과
    const sparkSize = 10 + Math.random() * 5;
    ctx.beginPath();
    ctx.arc(targetScreenX, targetScreenY, sparkSize * alpha, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
    ctx.fill();

    // 타격 지점 외곽 글로우
    ctx.beginPath();
    ctx.arc(targetScreenX, targetScreenY, sparkSize * 1.5 * alpha, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0, 255, 255, ${alpha * 0.4})`;
    ctx.fill();

    ctx.restore();
  }
}
