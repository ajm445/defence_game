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
  _canvasHeight: number
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

  // 활성 기지 - 어두운 빨간색
  const glowGradient = ctx.createRadialGradient(
    screenX, screenY, radius * 0.3,
    screenX, screenY, radius * 1.3
  );
  glowGradient.addColorStop(0, 'rgba(255, 50, 50, 0.4)');
  glowGradient.addColorStop(0.5, 'rgba(200, 50, 50, 0.2)');
  glowGradient.addColorStop(1, 'rgba(150, 50, 50, 0)');

  ctx.beginPath();
  ctx.arc(screenX, screenY, radius * 1.3, 0, Math.PI * 2);
  ctx.fillStyle = glowGradient;
  ctx.fill();

  // 기지 본체 (사각형)
  ctx.save();
  ctx.translate(screenX, screenY);

  // 본체
  ctx.fillStyle = '#442222';
  ctx.fillRect(-radius, -radius, radius * 2, radius * 2);

  // 테두리
  ctx.strokeStyle = '#ff4444';
  ctx.lineWidth = 3;
  ctx.strokeRect(-radius, -radius, radius * 2, radius * 2);

  // 중앙 문양 (X 표시)
  ctx.strokeStyle = '#ff6666';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-radius * 0.5, -radius * 0.5);
  ctx.lineTo(radius * 0.5, radius * 0.5);
  ctx.moveTo(radius * 0.5, -radius * 0.5);
  ctx.lineTo(-radius * 0.5, radius * 0.5);
  ctx.stroke();

  ctx.restore();

  // HP 바
  const hpBarWidth = radius * 2;
  const hpBarHeight = 6;
  const hpBarX = screenX - hpBarWidth / 2;
  const hpBarY = screenY + radius + 10;

  // HP 바 배경
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(hpBarX, hpBarY, hpBarWidth, hpBarHeight);

  // HP 바 내용
  const hpColor = hpPercent > 0.5 ? '#ff4444' : hpPercent > 0.25 ? '#ff8844' : '#ffaa44';
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

  // 라벨
  ctx.fillStyle = '#ff6666';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  const baseLabels: Record<string, string> = {
    left: 'LEFT BASE',
    right: 'RIGHT BASE',
    top: 'TOP BASE',
    bottom: 'BOTTOM BASE',
  };
  ctx.fillText(baseLabels[base.id] || 'BASE', screenX, screenY - radius - 8);
}

/**
 * 모든 적 기지 그리기
 */
export function drawAllEnemyBases(
  ctx: CanvasRenderingContext2D,
  bases: EnemyBase[],
  camera: { x: number; y: number; zoom: number },
  canvasWidth: number,
  canvasHeight: number
): void {
  for (const base of bases) {
    drawEnemyBase(ctx, base, camera, canvasWidth, canvasHeight);
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
