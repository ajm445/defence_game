import { RPG_CONFIG, NEXUS_CONFIG, ENEMY_BASE_CONFIG } from '../constants/rpgConfig';

// ============================================
// 장식 요소 타입
// ============================================

interface Decoration {
  x: number;
  y: number;
  type: 'grass' | 'rock' | 'puddle' | 'torch';
  size: number;
  variant: number; // 0~1 랜덤 변형
  rotation: number;
}

interface BoundaryTree {
  x: number;
  y: number;
  size: number;
  variant: number;
  type: 'tree' | 'rock';
}

// ============================================
// 시드 기반 의사 난수 생성기
// ============================================

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// ============================================
// 장식 데이터 캐시 (게임 시작 시 1회 생성)
// ============================================

let _decorations: Decoration[] | null = null;
let _boundaryElements: BoundaryTree[] | null = null;

const MAP_W = RPG_CONFIG.MAP_WIDTH;
const MAP_H = RPG_CONFIG.MAP_HEIGHT;

// 기지 위치 (장식 충돌 방지)
const BASE_POSITIONS = [
  { x: ENEMY_BASE_CONFIG.left.x, y: ENEMY_BASE_CONFIG.left.y },
  { x: ENEMY_BASE_CONFIG.right.x, y: ENEMY_BASE_CONFIG.right.y },
  { x: ENEMY_BASE_CONFIG.top.x, y: ENEMY_BASE_CONFIG.top.y },
  { x: ENEMY_BASE_CONFIG.bottom.x, y: ENEMY_BASE_CONFIG.bottom.y },
  { x: NEXUS_CONFIG.position.x, y: NEXUS_CONFIG.position.y },
];

function isNearEntity(x: number, y: number, clearance: number): boolean {
  for (const pos of BASE_POSITIONS) {
    const dx = x - pos.x;
    const dy = y - pos.y;
    if (dx * dx + dy * dy < clearance * clearance) return true;
  }
  return false;
}

function generateDecorations(): Decoration[] {
  const rng = seededRandom(42);
  const decorations: Decoration[] = [];
  const margin = 120; // 맵 가장자리 여백

  // 풀 패치 (150개)
  for (let i = 0; i < 150; i++) {
    const x = margin + rng() * (MAP_W - margin * 2);
    const y = margin + rng() * (MAP_H - margin * 2);
    if (isNearEntity(x, y, 150)) continue;
    decorations.push({
      x, y,
      type: 'grass',
      size: 8 + rng() * 20,
      variant: rng(),
      rotation: rng() * Math.PI * 2,
    });
  }

  // 바위 (40개)
  for (let i = 0; i < 40; i++) {
    const x = margin + rng() * (MAP_W - margin * 2);
    const y = margin + rng() * (MAP_H - margin * 2);
    if (isNearEntity(x, y, 180)) continue;
    decorations.push({
      x, y,
      type: 'rock',
      size: 12 + rng() * 18,
      variant: rng(),
      rotation: rng() * Math.PI * 2,
    });
  }

  // 물웅덩이 (12개)
  for (let i = 0; i < 12; i++) {
    const x = 200 + rng() * (MAP_W - 400);
    const y = 200 + rng() * (MAP_H - 400);
    if (isNearEntity(x, y, 200)) continue;
    decorations.push({
      x, y,
      type: 'puddle',
      size: 20 + rng() * 25,
      variant: rng(),
      rotation: rng() * Math.PI * 2,
    });
  }

  // 횃불 (각 기지 주변 3개씩 = 12개 + 넥서스 주변 4개)
  const torchBases = [
    { x: ENEMY_BASE_CONFIG.left.x, y: ENEMY_BASE_CONFIG.left.y },
    { x: ENEMY_BASE_CONFIG.right.x, y: ENEMY_BASE_CONFIG.right.y },
    { x: ENEMY_BASE_CONFIG.top.x, y: ENEMY_BASE_CONFIG.top.y },
    { x: ENEMY_BASE_CONFIG.bottom.x, y: ENEMY_BASE_CONFIG.bottom.y },
  ];

  for (const base of torchBases) {
    for (let i = 0; i < 3; i++) {
      const angle = (Math.PI * 2 / 3) * i + rng() * 0.5;
      const dist = 100 + rng() * 40;
      decorations.push({
        x: base.x + Math.cos(angle) * dist,
        y: base.y + Math.sin(angle) * dist,
        type: 'torch',
        size: 6,
        variant: rng(),
        rotation: 0,
      });
    }
  }

  // 넥서스 주변 횃불 4개
  for (let i = 0; i < 4; i++) {
    const angle = (Math.PI / 2) * i + Math.PI / 4;
    const dist = 130;
    decorations.push({
      x: NEXUS_CONFIG.position.x + Math.cos(angle) * dist,
      y: NEXUS_CONFIG.position.y + Math.sin(angle) * dist,
      type: 'torch',
      size: 6,
      variant: rng(),
      rotation: 0,
    });
  }

  return decorations;
}

function generateBoundaryElements(): BoundaryTree[] {
  const rng = seededRandom(123);
  const elements: BoundaryTree[] = [];
  const spacing = 35;

  // 상단 경계
  for (let x = -20; x <= MAP_W + 20; x += spacing) {
    const yOffset = rng() * 30;
    elements.push({
      x: x + rng() * 15 - 7,
      y: -10 + yOffset,
      size: 20 + rng() * 15,
      variant: rng(),
      type: rng() > 0.3 ? 'tree' : 'rock',
    });
    // 두 번째 줄 (더 울창하게)
    if (rng() > 0.3) {
      elements.push({
        x: x + rng() * 20 - 10,
        y: -30 + rng() * 15,
        size: 15 + rng() * 15,
        variant: rng(),
        type: rng() > 0.4 ? 'tree' : 'rock',
      });
    }
  }

  // 하단 경계
  for (let x = -20; x <= MAP_W + 20; x += spacing) {
    const yOffset = rng() * 30;
    elements.push({
      x: x + rng() * 15 - 7,
      y: MAP_H + 10 - yOffset,
      size: 20 + rng() * 15,
      variant: rng(),
      type: rng() > 0.3 ? 'tree' : 'rock',
    });
    if (rng() > 0.3) {
      elements.push({
        x: x + rng() * 20 - 10,
        y: MAP_H + 30 - rng() * 15,
        size: 15 + rng() * 15,
        variant: rng(),
        type: rng() > 0.4 ? 'tree' : 'rock',
      });
    }
  }

  // 좌측 경계
  for (let y = -20; y <= MAP_H + 20; y += spacing) {
    const xOffset = rng() * 30;
    elements.push({
      x: -10 + xOffset,
      y: y + rng() * 15 - 7,
      size: 20 + rng() * 15,
      variant: rng(),
      type: rng() > 0.3 ? 'tree' : 'rock',
    });
    if (rng() > 0.3) {
      elements.push({
        x: -30 + rng() * 15,
        y: y + rng() * 20 - 10,
        size: 15 + rng() * 15,
        variant: rng(),
        type: rng() > 0.4 ? 'tree' : 'rock',
      });
    }
  }

  // 우측 경계
  for (let y = -20; y <= MAP_H + 20; y += spacing) {
    const xOffset = rng() * 30;
    elements.push({
      x: MAP_W + 10 - xOffset,
      y: y + rng() * 15 - 7,
      size: 20 + rng() * 15,
      variant: rng(),
      type: rng() > 0.3 ? 'tree' : 'rock',
    });
    if (rng() > 0.3) {
      elements.push({
        x: MAP_W + 30 - rng() * 15,
        y: y + rng() * 20 - 10,
        size: 15 + rng() * 15,
        variant: rng(),
        type: rng() > 0.4 ? 'tree' : 'rock',
      });
    }
  }

  return elements;
}

// ============================================
// 영역별 색조 렌더링
// ============================================

export function drawZoneTints(
  ctx: CanvasRenderingContext2D,
  camera: { x: number; y: number },
  canvasWidth: number,
  canvasHeight: number
) {
  ctx.save();

  // 넥서스 주변: 안전한 시안/초록 톤
  const nx = NEXUS_CONFIG.position.x - camera.x;
  const ny = NEXUS_CONFIG.position.y - camera.y;
  const nexusGrad = ctx.createRadialGradient(nx, ny, 0, nx, ny, 350);
  nexusGrad.addColorStop(0, 'rgba(0, 180, 200, 0.06)');
  nexusGrad.addColorStop(0.6, 'rgba(0, 150, 180, 0.03)');
  nexusGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = nexusGrad;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // 적 기지 주변: 위험한 적갈색 톤
  const bases = [
    ENEMY_BASE_CONFIG.left,
    ENEMY_BASE_CONFIG.right,
    ENEMY_BASE_CONFIG.top,
    ENEMY_BASE_CONFIG.bottom,
  ];

  for (const base of bases) {
    const bx = base.x - camera.x;
    const by = base.y - camera.y;

    // 화면 밖이면 스킵
    if (bx < -300 || bx > canvasWidth + 300 || by < -300 || by > canvasHeight + 300) continue;

    const baseGrad = ctx.createRadialGradient(bx, by, 0, bx, by, 280);
    baseGrad.addColorStop(0, 'rgba(120, 30, 30, 0.08)');
    baseGrad.addColorStop(0.5, 'rgba(80, 20, 20, 0.04)');
    baseGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  ctx.restore();
}

// ============================================
// 장식 요소 렌더링
// ============================================

function drawGrass(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  size: number, variant: number
) {
  ctx.save();
  ctx.translate(x, y);

  // 여러 풀잎 클러스터
  const bladeCount = 3 + Math.floor(variant * 4);
  for (let i = 0; i < bladeCount; i++) {
    const angle = (Math.PI * 2 / bladeCount) * i + variant * 0.5;
    const dist = size * 0.3 * (0.5 + variant * 0.5);
    const bx = Math.cos(angle) * dist;
    const by = Math.sin(angle) * dist;
    const h = size * (0.6 + variant * 0.4);

    ctx.beginPath();
    ctx.moveTo(bx - 2, by);
    ctx.quadraticCurveTo(bx + variant * 3, by - h * 0.7, bx + 1, by - h);
    ctx.quadraticCurveTo(bx - variant * 2, by - h * 0.5, bx + 2, by);

    const green = 80 + Math.floor(variant * 60);
    ctx.fillStyle = `rgba(${30 + Math.floor(variant * 20)}, ${green}, ${20 + Math.floor(variant * 15)}, 0.5)`;
    ctx.fill();
  }

  ctx.restore();
}

function drawRock(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  size: number, variant: number, rotation: number
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);

  // 불규칙 다각형 바위
  const points = 5 + Math.floor(variant * 3);
  ctx.beginPath();
  for (let i = 0; i < points; i++) {
    const angle = (Math.PI * 2 / points) * i;
    const r = size * (0.6 + (Math.sin(i * 3.7 + variant * 10) * 0.5 + 0.5) * 0.4);
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r * 0.7; // 약간 납작하게
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();

  const gray = 40 + Math.floor(variant * 30);
  ctx.fillStyle = `rgba(${gray}, ${gray - 5}, ${gray - 10}, 0.6)`;
  ctx.fill();

  // 하이라이트
  ctx.beginPath();
  ctx.ellipse(size * -0.15, size * -0.15, size * 0.25, size * 0.15, rotation, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${gray + 25}, ${gray + 20}, ${gray + 15}, 0.3)`;
  ctx.fill();

  ctx.restore();
}

function drawPuddle(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  size: number, variant: number, gameTime: number
) {
  ctx.save();

  // 물 반짝임 애니메이션
  const shimmer = Math.sin(gameTime * 1.5 + variant * 10) * 0.03 + 0.12;

  // 타원형 물웅덩이
  ctx.beginPath();
  ctx.ellipse(x, y, size, size * 0.65, variant * Math.PI, 0, Math.PI * 2);

  const grad = ctx.createRadialGradient(x, y, 0, x, y, size);
  grad.addColorStop(0, `rgba(30, 80, 120, ${shimmer + 0.05})`);
  grad.addColorStop(0.7, `rgba(20, 60, 100, ${shimmer})`);
  grad.addColorStop(1, `rgba(15, 45, 70, ${shimmer * 0.5})`);
  ctx.fillStyle = grad;
  ctx.fill();

  // 반짝이는 하이라이트
  const hlX = x + Math.sin(gameTime * 0.8 + variant * 5) * size * 0.2;
  const hlY = y + Math.cos(gameTime * 0.6 + variant * 3) * size * 0.1;
  ctx.beginPath();
  ctx.ellipse(hlX, hlY, size * 0.15, size * 0.08, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(100, 180, 220, ${shimmer * 1.5})`;
  ctx.fill();

  ctx.restore();
}

function drawTorch(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  variant: number, gameTime: number
) {
  ctx.save();

  // 빛 글로우 (넓은 범위)
  const flicker = Math.sin(gameTime * 6 + variant * 20) * 0.03 +
                  Math.sin(gameTime * 9 + variant * 15) * 0.02 + 0.12;

  const glowGrad = ctx.createRadialGradient(x, y, 0, x, y, 50);
  glowGrad.addColorStop(0, `rgba(255, 160, 50, ${flicker})`);
  glowGrad.addColorStop(0.5, `rgba(255, 100, 20, ${flicker * 0.4})`);
  glowGrad.addColorStop(1, 'rgba(255, 80, 0, 0)');
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(x, y, 50, 0, Math.PI * 2);
  ctx.fill();

  // 기둥
  ctx.fillStyle = '#5a4030';
  ctx.fillRect(x - 2, y - 4, 4, 10);

  // 불꽃
  const flameH = 8 + Math.sin(gameTime * 8 + variant * 10) * 2;
  const flameW = 4 + Math.sin(gameTime * 10 + variant * 7) * 1;

  ctx.beginPath();
  ctx.moveTo(x - flameW, y - 4);
  ctx.quadraticCurveTo(x, y - 4 - flameH, x + flameW, y - 4);
  ctx.fillStyle = `rgba(255, 200, 50, 0.8)`;
  ctx.fill();

  // 불꽃 코어
  ctx.beginPath();
  ctx.moveTo(x - flameW * 0.5, y - 5);
  ctx.quadraticCurveTo(x, y - 5 - flameH * 0.6, x + flameW * 0.5, y - 5);
  ctx.fillStyle = 'rgba(255, 255, 200, 0.9)';
  ctx.fill();

  ctx.restore();
}

// ============================================
// 경계 요소 렌더링
// ============================================

function drawBoundaryTree(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  size: number, variant: number
) {
  ctx.save();

  // 나무 줄기
  const trunkW = size * 0.15;
  const trunkH = size * 0.4;
  ctx.fillStyle = `rgba(${50 + Math.floor(variant * 20)}, ${30 + Math.floor(variant * 15)}, ${15 + Math.floor(variant * 10)}, 0.8)`;
  ctx.fillRect(x - trunkW / 2, y - trunkH, trunkW, trunkH);

  // 나뭇잎 (원형 클러스터)
  const leafColors = [
    `rgba(20, ${60 + Math.floor(variant * 40)}, 15, 0.75)`,
    `rgba(15, ${50 + Math.floor(variant * 35)}, 12, 0.7)`,
    `rgba(25, ${70 + Math.floor(variant * 30)}, 20, 0.65)`,
  ];

  const clusterPositions = [
    { cx: 0, cy: -size * 0.5, r: size * 0.45 },
    { cx: -size * 0.25, cy: -size * 0.35, r: size * 0.35 },
    { cx: size * 0.25, cy: -size * 0.35, r: size * 0.35 },
  ];

  for (let i = 0; i < clusterPositions.length; i++) {
    const c = clusterPositions[i];
    ctx.beginPath();
    ctx.arc(x + c.cx, y - trunkH + c.cy, c.r, 0, Math.PI * 2);
    ctx.fillStyle = leafColors[i % leafColors.length];
    ctx.fill();
  }

  ctx.restore();
}

function drawBoundaryRock(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  size: number, variant: number
) {
  ctx.save();

  const points = 6;
  ctx.beginPath();
  for (let i = 0; i < points; i++) {
    const angle = (Math.PI * 2 / points) * i;
    const r = size * (0.7 + Math.sin(i * 2.3 + variant * 8) * 0.3);
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r * 0.6;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();

  const g = 35 + Math.floor(variant * 25);
  ctx.fillStyle = `rgba(${g}, ${g - 3}, ${g - 8}, 0.8)`;
  ctx.fill();

  ctx.restore();
}

// ============================================
// 안개 / 파티클 효과
// ============================================

interface AmbientParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  type: 'fog' | 'nexus_light' | 'base_ember';
  color: string;
}

let _ambientParticles: AmbientParticle[] | null = null;

function generateAmbientParticles(): AmbientParticle[] {
  const rng = seededRandom(777);
  const particles: AmbientParticle[] = [];

  // 맵 가장자리 안개 (20개)
  for (let i = 0; i < 20; i++) {
    const side = Math.floor(rng() * 4);
    let x: number, y: number;
    switch (side) {
      case 0: x = rng() * MAP_W; y = rng() * 100; break;
      case 1: x = rng() * MAP_W; y = MAP_H - rng() * 100; break;
      case 2: x = rng() * 100; y = rng() * MAP_H; break;
      default: x = MAP_W - rng() * 100; y = rng() * MAP_H; break;
    }
    particles.push({
      x, y,
      vx: (rng() - 0.5) * 0.3,
      vy: (rng() - 0.5) * 0.3,
      size: 60 + rng() * 80,
      alpha: 0.03 + rng() * 0.04,
      type: 'fog',
      color: 'rgba(200, 220, 230,',
    });
  }

  // 넥서스 주변 빛 파티클 (15개)
  for (let i = 0; i < 15; i++) {
    const angle = rng() * Math.PI * 2;
    const dist = 50 + rng() * 150;
    particles.push({
      x: NEXUS_CONFIG.position.x + Math.cos(angle) * dist,
      y: NEXUS_CONFIG.position.y + Math.sin(angle) * dist,
      vx: (rng() - 0.5) * 0.2,
      vy: -0.1 - rng() * 0.2,
      size: 2 + rng() * 4,
      alpha: 0.3 + rng() * 0.4,
      type: 'nexus_light',
      color: 'rgba(0, 200, 255,',
    });
  }

  // 기지 주변 어둠 파티클 (각 기지 5개씩 = 20개)
  const bases = [
    ENEMY_BASE_CONFIG.left, ENEMY_BASE_CONFIG.right,
    ENEMY_BASE_CONFIG.top, ENEMY_BASE_CONFIG.bottom,
  ];
  for (const base of bases) {
    for (let i = 0; i < 5; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = 30 + rng() * 80;
      particles.push({
        x: base.x + Math.cos(angle) * dist,
        y: base.y + Math.sin(angle) * dist,
        vx: (rng() - 0.5) * 0.15,
        vy: -0.15 - rng() * 0.15,
        size: 10 + rng() * 20,
        alpha: 0.05 + rng() * 0.06,
        type: 'base_ember',
        color: 'rgba(150, 30, 50,',
      });
    }
  }

  return particles;
}

export function drawAmbientEffects(
  ctx: CanvasRenderingContext2D,
  camera: { x: number; y: number },
  canvasWidth: number,
  canvasHeight: number,
  gameTime: number
) {
  if (!_ambientParticles) {
    _ambientParticles = generateAmbientParticles();
  }

  ctx.save();

  for (const p of _ambientParticles) {
    // 시간 기반 위치 오프셋 (느린 이동)
    const offsetX = Math.sin(gameTime * p.vx * 2 + p.x * 0.01) * 30;
    const offsetY = Math.cos(gameTime * p.vy * 2 + p.y * 0.01) * 30 + (p.type === 'nexus_light' ? Math.sin(gameTime * 2 + p.x) * 15 : 0);

    const sx = p.x + offsetX - camera.x;
    const sy = p.y + offsetY - camera.y;

    // 화면 밖이면 스킵
    if (sx < -p.size || sx > canvasWidth + p.size || sy < -p.size || sy > canvasHeight + p.size) continue;

    if (p.type === 'nexus_light') {
      // 작은 빛 점
      const pulse = Math.sin(gameTime * 3 + p.x + p.y) * 0.2 + 0.8;
      ctx.beginPath();
      ctx.arc(sx, sy, p.size * pulse, 0, Math.PI * 2);
      ctx.fillStyle = `${p.color} ${p.alpha * pulse})`;
      ctx.fill();
    } else if (p.type === 'base_ember') {
      // 떠오르는 연기/불꽃
      const rise = Math.sin(gameTime * 1.5 + p.y * 0.02) * 0.3 + 0.7;
      ctx.beginPath();
      ctx.arc(sx, sy, p.size * rise, 0, Math.PI * 2);
      ctx.fillStyle = `${p.color} ${p.alpha * rise})`;
      ctx.fill();
    } else {
      // 안개
      const fade = Math.sin(gameTime * 0.5 + p.x * 0.005) * 0.3 + 0.7;
      const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, p.size);
      grad.addColorStop(0, `${p.color} ${p.alpha * fade})`);
      grad.addColorStop(1, `${p.color} 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

// ============================================
// 메인 렌더링 함수
// ============================================

/**
 * 지형 장식 렌더링 (그리드 위, 엔티티 아래)
 */
export function drawMapDecorations(
  ctx: CanvasRenderingContext2D,
  camera: { x: number; y: number },
  canvasWidth: number,
  canvasHeight: number,
  gameTime: number
) {
  if (!_decorations) {
    _decorations = generateDecorations();
  }

  // 뷰포트 컬링 여유
  const pad = 60;

  for (const d of _decorations) {
    const sx = d.x - camera.x;
    const sy = d.y - camera.y;

    // 화면 밖 스킵
    if (sx < -pad || sx > canvasWidth + pad || sy < -pad || sy > canvasHeight + pad) continue;

    switch (d.type) {
      case 'grass':
        drawGrass(ctx, sx, sy, d.size, d.variant);
        break;
      case 'rock':
        drawRock(ctx, sx, sy, d.size, d.variant, d.rotation);
        break;
      case 'puddle':
        drawPuddle(ctx, sx, sy, d.size, d.variant, gameTime);
        break;
      case 'torch':
        drawTorch(ctx, sx, sy, d.variant, gameTime);
        break;
    }
  }
}

/**
 * 맵 경계 자연 요소 렌더링
 */
export function drawNaturalBoundary(
  ctx: CanvasRenderingContext2D,
  camera: { x: number; y: number },
  canvasWidth: number,
  canvasHeight: number
) {
  if (!_boundaryElements) {
    _boundaryElements = generateBoundaryElements();
  }

  const pad = 50;

  for (const el of _boundaryElements) {
    const sx = el.x - camera.x;
    const sy = el.y - camera.y;

    if (sx < -pad || sx > canvasWidth + pad || sy < -pad || sy > canvasHeight + pad) continue;

    if (el.type === 'tree') {
      drawBoundaryTree(ctx, sx, sy, el.size, el.variant);
    } else {
      drawBoundaryRock(ctx, sx, sy, el.size, el.variant);
    }
  }
}

/**
 * 맵 경계 외부 어둠 (자연 경계와 함께 사용)
 */
export function drawBoundaryDarkness(
  ctx: CanvasRenderingContext2D,
  camera: { x: number; y: number },
  canvasWidth: number,
  canvasHeight: number
) {
  ctx.save();

  // 맵 안쪽에서 시작하는 넓은 그라데이션 (250px 맵 안쪽 → 경계 → 경계 밖)
  const innerFade = 250; // 맵 안쪽 그라데이션 시작점
  const outerFade = 80;  // 경계 밖 그라데이션 끝점

  // 맵 경계 스크린 좌표
  const leftEdge = -camera.x;
  const rightEdge = MAP_W - camera.x;
  const topEdge = -camera.y;
  const bottomEdge = MAP_H - camera.y;

  // 왼쪽: 맵 안쪽부터 점진적으로 어두워짐 → 경계 밖 완전 검정
  {
    const fadeStart = leftEdge + innerFade;  // 맵 안쪽 250px 지점
    const fadeEnd = leftEdge - outerFade;    // 경계 밖 80px 지점
    if (fadeStart > 0 && fadeEnd < canvasWidth) {
      const grad = ctx.createLinearGradient(
        Math.max(fadeStart, 0), 0,
        Math.min(fadeEnd, canvasWidth), 0
      );
      grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      grad.addColorStop(0.7, 'rgba(0, 0, 0, 0.6)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 1)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, Math.max(fadeStart, 0), canvasHeight);
    }
    // 그라데이션 끝 이후 완전 검정
    if (fadeEnd > 0) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, fadeEnd, canvasHeight);
    }
  }

  // 오른쪽
  {
    const fadeStart = rightEdge - innerFade;
    const fadeEnd = rightEdge + outerFade;
    if (fadeStart < canvasWidth && fadeEnd > 0) {
      const grad = ctx.createLinearGradient(
        Math.max(fadeStart, 0), 0,
        Math.min(fadeEnd, canvasWidth), 0
      );
      grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      grad.addColorStop(0.3, 'rgba(0, 0, 0, 0.6)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 1)');
      ctx.fillStyle = grad;
      ctx.fillRect(Math.max(fadeStart, 0), 0, canvasWidth - Math.max(fadeStart, 0), canvasHeight);
    }
    if (fadeEnd < canvasWidth) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(fadeEnd, 0, canvasWidth - fadeEnd, canvasHeight);
    }
  }

  // 위쪽
  {
    const fadeStart = topEdge + innerFade;
    const fadeEnd = topEdge - outerFade;
    if (fadeStart > 0 && fadeEnd < canvasHeight) {
      const grad = ctx.createLinearGradient(
        0, Math.max(fadeStart, 0),
        0, Math.min(fadeEnd, canvasHeight)
      );
      grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      grad.addColorStop(0.7, 'rgba(0, 0, 0, 0.6)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 1)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvasWidth, Math.max(fadeStart, 0));
    }
    if (fadeEnd > 0) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvasWidth, fadeEnd);
    }
  }

  // 아래쪽
  {
    const fadeStart = bottomEdge - innerFade;
    const fadeEnd = bottomEdge + outerFade;
    if (fadeStart < canvasHeight && fadeEnd > 0) {
      const grad = ctx.createLinearGradient(
        0, Math.max(fadeStart, 0),
        0, Math.min(fadeEnd, canvasHeight)
      );
      grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      grad.addColorStop(0.3, 'rgba(0, 0, 0, 0.6)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 1)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, Math.max(fadeStart, 0), canvasWidth, canvasHeight - Math.max(fadeStart, 0));
    }
    if (fadeEnd < canvasHeight) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, fadeEnd, canvasWidth, canvasHeight - fadeEnd);
    }
  }

  ctx.restore();
}

/**
 * 캐시 초기화 (게임 재시작 시 호출)
 */
export function resetMapDecorations() {
  _decorations = null;
  _boundaryElements = null;
  _ambientParticles = null;
}
