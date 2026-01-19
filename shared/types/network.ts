// 클라이언트-서버 간 통신 메시지 타입

import type {
  UnitType,
  NetworkGameState,
  NetworkUnit,
  NetworkWall,
  Resources,
  PlayerSide
} from './game';

// ============================================
// 클라이언트 → 서버 메시지
// ============================================

export type ClientMessage =
  // 방 관련 메시지
  | { type: 'CREATE_ROOM'; playerName: string }
  | { type: 'JOIN_ROOM'; roomCode: string; playerName: string }
  | { type: 'LEAVE_ROOM' }
  // 게임 액션 메시지
  | { type: 'GAME_READY' }
  | { type: 'SPAWN_UNIT'; unitType: UnitType }
  | { type: 'BUILD_WALL'; x: number; y: number }
  | { type: 'UPGRADE_BASE' }
  | { type: 'SELL_HERB' }
  | { type: 'COLLECT_RESOURCE'; nodeId: string };

// ============================================
// 서버 → 클라이언트 메시지
// ============================================

export type ServerMessage =
  | { type: 'CONNECTED'; playerId: string }
  // 방 관련 메시지
  | { type: 'ROOM_CREATED'; roomCode: string; roomId: string }
  | { type: 'ROOM_JOINED'; roomId: string; opponent: string; side: PlayerSide }
  | { type: 'PLAYER_JOINED'; opponent: string }
  | { type: 'PLAYER_LEFT' }
  | { type: 'ROOM_ERROR'; message: string }
  // 게임 진행 메시지
  | { type: 'GAME_COUNTDOWN'; seconds: number }
  | { type: 'GAME_START'; state: NetworkGameState }
  | { type: 'GAME_STATE'; state: NetworkGameState }
  | { type: 'GAME_EVENT'; event: GameEvent }
  | { type: 'GAME_OVER'; result: GameResult; reason: string }
  | { type: 'OPPONENT_DISCONNECTED' }
  | { type: 'ERROR'; message: string };

// ============================================
// 게임 이벤트 (델타 업데이트)
// ============================================

export type GameEvent =
  | { event: 'UNIT_SPAWNED'; unit: NetworkUnit }
  | { event: 'UNIT_DIED'; unitId: string }
  | { event: 'UNIT_MOVED'; unitId: string; x: number; y: number }
  | { event: 'UNIT_ATTACKED'; attackerId: string; targetId: string; damage: number }
  | { event: 'UNIT_HEALED'; healerId: string; targetId: string; x: number; y: number }
  | { event: 'RESOURCE_GATHERED'; unitId: string; unitType: string; x: number; y: number }
  | { event: 'UNIT_STATE_CHANGED'; unitId: string; state: string }
  | { event: 'BASE_DAMAGED'; side: PlayerSide; damage: number; hp: number }
  | { event: 'WALL_BUILT'; wall: NetworkWall }
  | { event: 'WALL_DAMAGED'; wallId: string; damage: number; hp: number }
  | { event: 'WALL_DESTROYED'; wallId: string }
  | { event: 'RESOURCE_UPDATED'; side: PlayerSide; resources: Resources }
  | { event: 'NODE_DEPLETED'; nodeId: string }
  | { event: 'NODE_REGENERATED'; nodeId: string; amount: number }
  | { event: 'BASE_UPGRADED'; side: PlayerSide; newMaxHp: number; upgradeLevel: number; goldPerSecond: number };

export type GameResult = 'win' | 'lose' | 'draw';

// ============================================
// 연결 상태
// ============================================

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'in_room_waiting'  // 방에서 상대 대기 중
  | 'in_room_ready'    // 2명 모두 있음
  | 'matched'
  | 'in_game';

// ============================================
// 매칭 정보
// ============================================

export interface MatchInfo {
  roomId: string;
  opponentName: string;
  side: PlayerSide;
}

// ============================================
// 방 정보
// ============================================

export interface RoomInfo {
  roomId: string;
  roomCode: string;
  isHost: boolean;
  opponentName?: string;
  side: PlayerSide;
}
