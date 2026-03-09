import { RPG_CONFIG, NEXUS_CONFIG, ENEMY_BASE_CONFIG } from '../constants/rpgConfig';
import { MapThemeConfig } from '../constants/mapThemeConfig';
import { MapTheme } from '../types/rpg';

// ============================================
// 장식 요소 타입
// ============================================

interface Decoration {
  x: number;
  y: number;
  type: 'grass' | 'rock' | 'puddle' | 'torch';
  size: number;
  variant: number;
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
// 장식 데이터 캐시 (테마 변경 시 재생성)
// ============================================

let _decorations: Decoration[] | null = null;
let _boundaryElements: BoundaryTree[] | null = null;
let _cachedTheme: MapTheme | null = null;

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

function ensureCache(theme: MapThemeConfig) {
  if (_cachedTheme === theme.id && _decorations && _boundaryElements) return;
  _cachedTheme = theme.id;
  _decorations = generateDecorations();
  _boundaryElements = generateBoundaryElements(theme);
}

function generateDecorations(): Decoration[] {
  const rng = seededRandom(42);
  const decorations: Decoration[] = [];
  const margin = 120;

  // 풀 패치 (150개)
  for (let i = 0; i < 150; i++) {
    const x = margin + rng() * (MAP_W - margin * 2);
    const y = margin + rng() * (MAP_H - margin * 2);
    if (isNearEntity(x, y, 150)) continue;
    decorations.push({
      x, y, type: 'grass',
      size: 8 + rng() * 20, variant: rng(), rotation: rng() * Math.PI * 2,
    });
  }

  // 바위 (40개)
  for (let i = 0; i < 40; i++) {
    const x = margin + rng() * (MAP_W - margin * 2);
    const y = margin + rng() * (MAP_H - margin * 2);
    if (isNearEntity(x, y, 180)) continue;
    decorations.push({
      x, y, type: 'rock',
      size: 12 + rng() * 18, variant: rng(), rotation: rng() * Math.PI * 2,
    });
  }

  // 물웅덩이 (12개)
  for (let i = 0; i < 12; i++) {
    const x = 200 + rng() * (MAP_W - 400);
    const y = 200 + rng() * (MAP_H - 400);
    if (isNearEntity(x, y, 200)) continue;
    decorations.push({
      x, y, type: 'puddle',
      size: 20 + rng() * 25, variant: rng(), rotation: rng() * Math.PI * 2,
    });
  }

  // 횃불 (각 기지 주변 3개씩 + 넥서스 주변 4개)
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
        type: 'torch', size: 6, variant: rng(), rotation: 0,
      });
    }
  }

  for (let i = 0; i < 4; i++) {
    const angle = (Math.PI / 2) * i + Math.PI / 4;
    const dist = 130;
    decorations.push({
      x: NEXUS_CONFIG.position.x + Math.cos(angle) * dist,
      y: NEXUS_CONFIG.position.y + Math.sin(angle) * dist,
      type: 'torch', size: 6, variant: rng(), rotation: 0,
    });
  }

  return decorations;
}

function generateBoundaryElements(theme: MapThemeConfig): BoundaryTree[] {
  const rng = seededRandom(123);
  const elements: BoundaryTree[] = [];
  const spacing = 35;
  const treeRatio = theme.boundary.treeRatio;

  const addEdge = (getX: (t: number) => number, getY: (t: number) => number, getX2: (t: number) => number, getY2: (t: number) => number, length: number) => {
    for (let t = -20; t <= length + 20; t += spacing) {
      elements.push({
        x: getX(t) + rng() * 15 - 7,
        y: getY(t),
        size: 20 + rng() * 15,
        variant: rng(),
        type: rng() < treeRatio ? 'tree' : 'rock',
      });
      if (rng() > 0.3) {
        elements.push({
          x: getX2(t) + rng() * 20 - 10,
          y: getY2(t),
          size: 15 + rng() * 15,
          variant: rng(),
          type: rng() < (treeRatio + 0.1) ? 'tree' : 'rock',
        });
      }
    }
  };

  // 상단
  addEdge(
    t => t, t => -10 + (rng() * 30),
    t => t, _t => -30 + rng() * 15,
    MAP_W
  );
  // 하단
  addEdge(
    t => t, _t => MAP_H + 10 - rng() * 30,
    t => t, _t => MAP_H + 30 - rng() * 15,
    MAP_W
  );
  // 좌측
  addEdge(
    _t => -10 + rng() * 30, t => t,
    _t => -30 + rng() * 15, t => t,
    MAP_H
  );
  // 우측
  addEdge(
    _t => MAP_W + 10 - rng() * 30, t => t,
    _t => MAP_W + 30 - rng() * 15, t => t,
    MAP_H
  );

  return elements;
}

// ============================================
// 영역별 색조 렌더링
// ============================================

export function drawZoneTints(
  ctx: CanvasRenderingContext2D,
  camera: { x: number; y: number },
  canvasWidth: number,
  canvasHeight: number,
  theme: MapThemeConfig
) {
  ctx.save();

  // 넥서스 주변
  const nx = NEXUS_CONFIG.position.x - camera.x;
  const ny = NEXUS_CONFIG.position.y - camera.y;
  const nexusGrad = ctx.createRadialGradient(nx, ny, 0, nx, ny, 350);
  nexusGrad.addColorStop(0, theme.zoneTints.nexus.inner);
  nexusGrad.addColorStop(0.6, theme.zoneTints.nexus.mid);
  nexusGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = nexusGrad;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // 적 기지 주변
  const bases = [
    ENEMY_BASE_CONFIG.left, ENEMY_BASE_CONFIG.right,
    ENEMY_BASE_CONFIG.top, ENEMY_BASE_CONFIG.bottom,
  ];

  for (const base of bases) {
    const bx = base.x - camera.x;
    const by = base.y - camera.y;
    if (bx < -300 || bx > canvasWidth + 300 || by < -300 || by > canvasHeight + 300) continue;

    const baseGrad = ctx.createRadialGradient(bx, by, 0, bx, by, 280);
    baseGrad.addColorStop(0, theme.zoneTints.base.inner);
    baseGrad.addColorStop(0.5, theme.zoneTints.base.mid);
    baseGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  ctx.restore();
}

// ============================================
// 장식 요소 렌더링 (테마 색상 적용)
// ============================================

function drawGrass(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  size: number, variant: number,
  colors: MapThemeConfig['decorations']['grass']
) {
  ctx.save();
  ctx.translate(x, y);

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

    const r = colors.rBase + Math.floor(variant * colors.rRange);
    const g = colors.gBase + Math.floor(variant * colors.gRange);
    const b = colors.bBase + Math.floor(variant * colors.bRange);
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.5)`;
    ctx.fill();
  }

  ctx.restore();
}

function drawRock(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  size: number, variant: number, rotation: number,
  colors: MapThemeConfig['decorations']['rock']
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);

  const points = 5 + Math.floor(variant * 3);
  ctx.beginPath();
  for (let i = 0; i < points; i++) {
    const angle = (Math.PI * 2 / points) * i;
    const r = size * (0.6 + (Math.sin(i * 3.7 + variant * 10) * 0.5 + 0.5) * 0.4);
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r * 0.7;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();

  const gray = colors.grayBase + Math.floor(variant * colors.grayRange);
  ctx.fillStyle = `rgba(${gray}, ${gray - 5}, ${gray - 10}, 0.6)`;
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(size * -0.15, size * -0.15, size * 0.25, size * 0.15, rotation, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${gray + 25}, ${gray + 20}, ${gray + 15}, 0.3)`;
  ctx.fill();

  ctx.restore();
}

function drawPuddle(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  size: number, variant: number, gameTime: number,
  colors: MapThemeConfig['decorations']['puddle']
) {
  ctx.save();

  const shimmer = Math.sin(gameTime * 1.5 + variant * 10) * 0.03 + 0.12;

  ctx.beginPath();
  ctx.ellipse(x, y, size, size * 0.65, variant * Math.PI, 0, Math.PI * 2);

  const grad = ctx.createRadialGradient(x, y, 0, x, y, size);
  const [ir, ig, ib] = colors.inner;
  const [mr, mg, mb] = colors.mid;
  const [or, og, ob] = colors.outer;
  grad.addColorStop(0, `rgba(${ir}, ${ig}, ${ib}, ${shimmer + 0.05})`);
  grad.addColorStop(0.7, `rgba(${mr}, ${mg}, ${mb}, ${shimmer})`);
  grad.addColorStop(1, `rgba(${or}, ${og}, ${ob}, ${shimmer * 0.5})`);
  ctx.fillStyle = grad;
  ctx.fill();

  const hlX = x + Math.sin(gameTime * 0.8 + variant * 5) * size * 0.2;
  const hlY = y + Math.cos(gameTime * 0.6 + variant * 3) * size * 0.1;
  const [hr, hg, hb] = colors.highlight;
  ctx.beginPath();
  ctx.ellipse(hlX, hlY, size * 0.15, size * 0.08, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${hr}, ${hg}, ${hb}, ${shimmer * 1.5})`;
  ctx.fill();

  ctx.restore();
}

function drawTorch(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  variant: number, gameTime: number,
  colors: MapThemeConfig['decorations']['torch']
) {
  ctx.save();

  const flicker = Math.sin(gameTime * 6 + variant * 20) * 0.03 +
                  Math.sin(gameTime * 9 + variant * 15) * 0.02 + 0.12;

  const glowGrad = ctx.createRadialGradient(x, y, 0, x, y, 50);
  glowGrad.addColorStop(0, `${colors.glowColor} ${flicker})`);
  glowGrad.addColorStop(0.5, `${colors.glowMidColor} ${flicker * 0.4})`);
  glowGrad.addColorStop(1, `${colors.glowColor} 0)`);
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(x, y, 50, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = colors.poleColor;
  ctx.fillRect(x - 2, y - 4, 4, 10);

  const flameH = 8 + Math.sin(gameTime * 8 + variant * 10) * 2;
  const flameW = 4 + Math.sin(gameTime * 10 + variant * 7) * 1;

  ctx.beginPath();
  ctx.moveTo(x - flameW, y - 4);
  ctx.quadraticCurveTo(x, y - 4 - flameH, x + flameW, y - 4);
  ctx.fillStyle = colors.flameColor;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x - flameW * 0.5, y - 5);
  ctx.quadraticCurveTo(x, y - 5 - flameH * 0.6, x + flameW * 0.5, y - 5);
  ctx.fillStyle = colors.flameCoreColor;
  ctx.fill();

  ctx.restore();
}

// ============================================
// 경계 요소 렌더링
// ============================================

function drawBoundaryTree(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  size: number, variant: number,
  theme: MapThemeConfig
) {
  ctx.save();

  const trunkW = size * 0.15;
  const trunkH = size * 0.4;
  const tc = theme.boundary.trunk;
  const r = tc.rBase + Math.floor(variant * tc.range);
  const g = tc.gBase + Math.floor(variant * (tc.range * 0.75));
  const b = tc.bBase + Math.floor(variant * (tc.range * 0.5));
  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.8)`;
  ctx.fillRect(x - trunkW / 2, y - trunkH, trunkW, trunkH);

  const leafCfg = theme.boundary.leaf.colors;
  const clusterPositions = [
    { cx: 0, cy: -size * 0.5, rad: size * 0.45 },
    { cx: -size * 0.25, cy: -size * 0.35, rad: size * 0.35 },
    { cx: size * 0.25, cy: -size * 0.35, rad: size * 0.35 },
  ];

  for (let i = 0; i < clusterPositions.length; i++) {
    const c = clusterPositions[i];
    const lc = leafCfg[i % leafCfg.length];
    const lr = lc.r + Math.floor(variant * 20);
    const lg = lc.g + Math.floor(variant * 15);
    const lb = lc.b + Math.floor(variant * 10);
    ctx.beginPath();
    ctx.arc(x + c.cx, y - trunkH + c.cy, c.rad, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${lr}, ${lg}, ${lb}, ${lc.alpha})`;
    ctx.fill();
  }

  ctx.restore();
}

function drawBoundaryRock(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  size: number, variant: number,
  theme: MapThemeConfig
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

  const gc = theme.boundary.rock;
  const g = gc.grayBase + Math.floor(variant * gc.grayRange);
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
let _ambientTheme: MapTheme | null = null;

function generateAmbientParticles(theme: MapThemeConfig): AmbientParticle[] {
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
      vx: (rng() - 0.5) * 0.3, vy: (rng() - 0.5) * 0.3,
      size: 60 + rng() * 80, alpha: 0.03 + rng() * 0.04,
      type: 'fog', color: theme.ambient.fogColor,
    });
  }

  // 넥서스 주변 빛 파티클 (15개)
  for (let i = 0; i < 15; i++) {
    const angle = rng() * Math.PI * 2;
    const dist = 50 + rng() * 150;
    particles.push({
      x: NEXUS_CONFIG.position.x + Math.cos(angle) * dist,
      y: NEXUS_CONFIG.position.y + Math.sin(angle) * dist,
      vx: (rng() - 0.5) * 0.2, vy: -0.1 - rng() * 0.2,
      size: 2 + rng() * 4, alpha: 0.3 + rng() * 0.4,
      type: 'nexus_light', color: theme.ambient.nexusLightColor,
    });
  }

  // 기지 주변 파티클 (각 기지 5개씩)
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
        vx: (rng() - 0.5) * 0.15, vy: -0.15 - rng() * 0.15,
        size: 10 + rng() * 20, alpha: 0.05 + rng() * 0.06,
        type: 'base_ember', color: theme.ambient.baseEmberColor,
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
  gameTime: number,
  theme: MapThemeConfig
) {
  if (!_ambientParticles || _ambientTheme !== theme.id) {
    _ambientTheme = theme.id;
    _ambientParticles = generateAmbientParticles(theme);
  }

  ctx.save();

  for (const p of _ambientParticles) {
    const offsetX = Math.sin(gameTime * p.vx * 2 + p.x * 0.01) * 30;
    const offsetY = Math.cos(gameTime * p.vy * 2 + p.y * 0.01) * 30 + (p.type === 'nexus_light' ? Math.sin(gameTime * 2 + p.x) * 15 : 0);

    const sx = p.x + offsetX - camera.x;
    const sy = p.y + offsetY - camera.y;

    if (sx < -p.size || sx > canvasWidth + p.size || sy < -p.size || sy > canvasHeight + p.size) continue;

    if (p.type === 'nexus_light') {
      const pulse = Math.sin(gameTime * 3 + p.x + p.y) * 0.2 + 0.8;
      ctx.beginPath();
      ctx.arc(sx, sy, p.size * pulse, 0, Math.PI * 2);
      ctx.fillStyle = `${p.color} ${p.alpha * pulse})`;
      ctx.fill();
    } else if (p.type === 'base_ember') {
      const rise = Math.sin(gameTime * 1.5 + p.y * 0.02) * 0.3 + 0.7;
      ctx.beginPath();
      ctx.arc(sx, sy, p.size * rise, 0, Math.PI * 2);
      ctx.fillStyle = `${p.color} ${p.alpha * rise})`;
      ctx.fill();
    } else {
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

export function drawMapDecorations(
  ctx: CanvasRenderingContext2D,
  camera: { x: number; y: number },
  canvasWidth: number,
  canvasHeight: number,
  gameTime: number,
  theme: MapThemeConfig
) {
  ensureCache(theme);

  const pad = 60;
  const dc = theme.decorations;

  for (const d of _decorations!) {
    const sx = d.x - camera.x;
    const sy = d.y - camera.y;
    if (sx < -pad || sx > canvasWidth + pad || sy < -pad || sy > canvasHeight + pad) continue;

    switch (d.type) {
      case 'grass':
        drawGrass(ctx, sx, sy, d.size, d.variant, dc.grass);
        break;
      case 'rock':
        drawRock(ctx, sx, sy, d.size, d.variant, d.rotation, dc.rock);
        break;
      case 'puddle':
        drawPuddle(ctx, sx, sy, d.size, d.variant, gameTime, dc.puddle);
        break;
      case 'torch':
        drawTorch(ctx, sx, sy, d.variant, gameTime, dc.torch);
        break;
    }
  }
}

export function drawNaturalBoundary(
  ctx: CanvasRenderingContext2D,
  camera: { x: number; y: number },
  canvasWidth: number,
  canvasHeight: number,
  theme: MapThemeConfig
) {
  ensureCache(theme);

  const pad = 50;

  for (const el of _boundaryElements!) {
    const sx = el.x - camera.x;
    const sy = el.y - camera.y;
    if (sx < -pad || sx > canvasWidth + pad || sy < -pad || sy > canvasHeight + pad) continue;

    if (el.type === 'tree') {
      drawBoundaryTree(ctx, sx, sy, el.size, el.variant, theme);
    } else {
      drawBoundaryRock(ctx, sx, sy, el.size, el.variant, theme);
    }
  }
}

export function drawBoundaryDarkness(
  ctx: CanvasRenderingContext2D,
  camera: { x: number; y: number },
  canvasWidth: number,
  canvasHeight: number
) {
  ctx.save();

  const innerFade = 250;
  const outerFade = 80;

  const leftEdge = -camera.x;
  const rightEdge = MAP_W - camera.x;
  const topEdge = -camera.y;
  const bottomEdge = MAP_H - camera.y;

  // 왼쪽
  {
    const fadeStart = leftEdge + innerFade;
    const fadeEnd = leftEdge - outerFade;
    if (fadeStart > 0 && fadeEnd < canvasWidth) {
      const grad = ctx.createLinearGradient(
        Math.max(fadeStart, 0), 0, Math.min(fadeEnd, canvasWidth), 0
      );
      grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      grad.addColorStop(0.7, 'rgba(0, 0, 0, 0.6)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 1)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, Math.max(fadeStart, 0), canvasHeight);
    }
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
        Math.max(fadeStart, 0), 0, Math.min(fadeEnd, canvasWidth), 0
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
        0, Math.max(fadeStart, 0), 0, Math.min(fadeEnd, canvasHeight)
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
        0, Math.max(fadeStart, 0), 0, Math.min(fadeEnd, canvasHeight)
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
  _cachedTheme = null;
  _ambientTheme = null;
}
