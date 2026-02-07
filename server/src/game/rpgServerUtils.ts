/**
 * 서버 게임 유틸리티 함수
 */

// 고유 ID 생성
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// 두 점 사이 거리 계산
export function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

// 두 점 사이 거리의 제곱 (범위 비교용 - Math.sqrt 제거)
export function distanceSquared(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
}

// 값 범위 제한
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// 점과 선분 사이 거리 계산
export function pointToLineDistance(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number
): number {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx: number;
  let yy: number;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = px - xx;
  const dy = py - yy;

  return Math.sqrt(dx * dx + dy * dy);
}

// 원뿔 범위 체크
export function isInConeRange(
  sourceX: number, sourceY: number,
  targetX: number, targetY: number,
  radius: number,
  coneAngle: number,
  facingAngle: number
): boolean {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > radius) return false;

  const angleToTarget = Math.atan2(dy, dx);
  let angleDiff = angleToTarget - facingAngle;

  while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
  while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

  return Math.abs(angleDiff) <= coneAngle / 2;
}
