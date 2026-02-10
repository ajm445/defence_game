/**
 * 서버 입력 검증 유틸리티
 * 좌표, 방향 벡터, enum 값의 유효성을 검사
 */

// RPG 맵: 3000x2000 (rpgServerConfig.ts MAP_WIDTH/MAP_HEIGHT)
const RPG_MAX_X = 3000;
const RPG_MAX_Y = 2000;

// RTS 맵: 4000x2400 (GameRoom.ts CONFIG)
const RTS_MAX_X = 4000;
const RTS_MAX_Y = 2400;

const VALID_SKILL_SLOTS = new Set(['Q', 'W', 'E']);
const VALID_UPGRADE_TYPES = new Set(['attack', 'speed', 'hp', 'attackSpeed', 'goldRate', 'range']);

export function isValidRPGCoordinate(x: unknown, y: unknown): boolean {
  return (
    typeof x === 'number' && typeof y === 'number' &&
    Number.isFinite(x) && Number.isFinite(y) &&
    x >= 0 && x <= RPG_MAX_X &&
    y >= 0 && y <= RPG_MAX_Y
  );
}

export function isValidRTSCoordinate(x: unknown, y: unknown): boolean {
  return (
    typeof x === 'number' && typeof y === 'number' &&
    Number.isFinite(x) && Number.isFinite(y) &&
    x >= 0 && x <= RTS_MAX_X &&
    y >= 0 && y <= RTS_MAX_Y
  );
}

/**
 * 방향 벡터 검증: null 허용 (정지), 벡터 길이 <= 1.5 (정규화 오차 고려)
 */
export function isValidDirection(dir: unknown): boolean {
  if (dir === null) return true;
  if (typeof dir !== 'object' || dir === undefined) return false;
  const d = dir as { x: unknown; y: unknown };
  if (typeof d.x !== 'number' || typeof d.y !== 'number') return false;
  if (!Number.isFinite(d.x) || !Number.isFinite(d.y)) return false;
  const lengthSq = d.x * d.x + d.y * d.y;
  return lengthSq <= 1.5 * 1.5; // 2.25
}

export function isValidSkillSlot(s: unknown): boolean {
  return typeof s === 'string' && VALID_SKILL_SLOTS.has(s);
}

export function isValidUpgradeType(t: unknown): boolean {
  return typeof t === 'string' && VALID_UPGRADE_TYPES.has(t);
}
