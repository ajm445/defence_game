import type { ClientMessage } from '../../../shared/types/network';
import { players } from '../state/players';
import { createRoom, joinRoom, leaveRoom } from '../room/RoomManager';
import {
  createCoopRoom,
  joinCoopRoom,
  leaveCoopRoom,
  setCoopReady,
  changeCoopClass,
  kickCoopPlayer,
  startCoopGame,
  handleCoopPlayerDisconnect,
} from '../room/CoopRoomManager';
import { GameRoom } from '../game/GameRoom';
import { RPGCoopGameRoom } from '../game/RPGCoopGameRoom';

// 게임 방 저장소
const gameRooms = new Map<string, GameRoom>();
const coopGameRooms = new Map<string, RPGCoopGameRoom>();

export function getRoom(roomId: string): GameRoom | undefined {
  return gameRooms.get(roomId);
}

export function addRoom(room: GameRoom): void {
  gameRooms.set(room.id, room);
}

export function removeRoom(roomId: string): void {
  gameRooms.delete(roomId);
}

export function getCoopRoom(roomId: string): RPGCoopGameRoom | undefined {
  return coopGameRooms.get(roomId);
}

export function addCoopRoom(room: RPGCoopGameRoom): void {
  coopGameRooms.set(room.id, room);
}

export function removeCoopRoom(roomId: string): void {
  coopGameRooms.delete(roomId);
}

export function handleMessage(playerId: string, message: ClientMessage): void {
  const player = players.get(playerId);
  if (!player) {
    console.error(`플레이어를 찾을 수 없음: ${playerId}`);
    return;
  }

  switch (message.type) {
    case 'CREATE_ROOM':
      handleCreateRoom(playerId, message.playerName);
      break;

    case 'JOIN_ROOM':
      handleJoinRoom(playerId, message.roomCode, message.playerName);
      break;

    case 'LEAVE_ROOM':
      handleLeaveRoom(playerId);
      break;

    case 'GAME_READY':
      handleGameReady(playerId);
      break;

    case 'SPAWN_UNIT':
      handleSpawnUnit(playerId, message.unitType);
      break;

    case 'BUILD_WALL':
      handleBuildWall(playerId, message.x, message.y);
      break;

    case 'UPGRADE_BASE':
      handleUpgradeBase(playerId);
      break;

    case 'SELL_HERB':
      handleSellHerb(playerId);
      break;

    case 'COLLECT_RESOURCE':
      handleCollectResource(playerId, message.nodeId);
      break;

    // 협동 모드 메시지
    case 'CREATE_COOP_ROOM':
      handleCreateCoopRoom(playerId, message.playerName, message.heroClass);
      break;

    case 'JOIN_COOP_ROOM':
      handleJoinCoopRoom(playerId, message.roomCode, message.playerName, message.heroClass);
      break;

    case 'LEAVE_COOP_ROOM':
      handleLeaveCoopRoom(playerId);
      break;

    case 'COOP_READY':
      handleCoopReady(playerId, true);
      break;

    case 'COOP_UNREADY':
      handleCoopReady(playerId, false);
      break;

    case 'CHANGE_COOP_CLASS':
      handleChangeCoopClass(playerId, message.heroClass);
      break;

    case 'START_COOP_GAME':
      handleStartCoopGame(playerId);
      break;

    case 'KICK_COOP_PLAYER':
      handleKickCoopPlayer(playerId, message.playerId);
      break;

    case 'COOP_HERO_MOVE':
      handleCoopHeroMove(playerId, message.direction);
      break;

    case 'COOP_USE_SKILL':
      handleCoopUseSkill(playerId, message.skillType, message.targetX, message.targetY);
      break;

    default:
      console.warn(`알 수 없는 메시지 타입: ${(message as any).type}`);
  }
}

function handleCreateRoom(playerId: string, playerName: string): void {
  const player = players.get(playerId);
  if (!player) return;

  const name = playerName || `Player_${playerId.slice(0, 4)}`;
  console.log(`${name}(${playerId}) 방 생성 요청`);
  createRoom(playerId, name);
}

function handleJoinRoom(playerId: string, roomCode: string, playerName: string): void {
  const player = players.get(playerId);
  if (!player) return;

  const name = playerName || `Player_${playerId.slice(0, 4)}`;
  console.log(`${name}(${playerId}) 방 참가 요청: ${roomCode}`);
  joinRoom(roomCode, playerId, name);
}

function handleLeaveRoom(playerId: string): void {
  console.log(`${playerId} 방 나가기`);
  leaveRoom(playerId);
}

function handleGameReady(playerId: string): void {
  const player = players.get(playerId);
  if (!player || !player.roomId) return;

  const room = gameRooms.get(player.roomId);
  if (room) {
    room.setPlayerReady(playerId);
  }
}

function handleSpawnUnit(playerId: string, unitType: string): void {
  const player = players.get(playerId);
  if (!player || !player.roomId) return;

  const room = gameRooms.get(player.roomId);
  if (room) {
    room.handleSpawnUnit(playerId, unitType as any);
  }
}

function handleBuildWall(playerId: string, x: number, y: number): void {
  const player = players.get(playerId);
  if (!player || !player.roomId) return;

  const room = gameRooms.get(player.roomId);
  if (room) {
    room.handleBuildWall(playerId, x, y);
  }
}

function handleUpgradeBase(playerId: string): void {
  const player = players.get(playerId);
  if (!player || !player.roomId) return;

  const room = gameRooms.get(player.roomId);
  if (room) {
    room.handleUpgradeBase(playerId);
  }
}

function handleSellHerb(playerId: string): void {
  const player = players.get(playerId);
  if (!player || !player.roomId) return;

  const room = gameRooms.get(player.roomId);
  if (room) {
    room.handleSellHerb(playerId);
  }
}

function handleCollectResource(playerId: string, nodeId: string): void {
  const player = players.get(playerId);
  if (!player || !player.roomId) return;

  const room = gameRooms.get(player.roomId);
  if (room) {
    room.handleCollectResource(playerId, nodeId);
  }
}

// ============================================
// 협동 모드 핸들러
// ============================================

function handleCreateCoopRoom(playerId: string, playerName: string, heroClass: any): void {
  const player = players.get(playerId);
  if (!player) return;

  const name = playerName || `Player_${playerId.slice(0, 4)}`;
  console.log(`[Coop] ${name}(${playerId}) 방 생성 요청`);
  createCoopRoom(playerId, name, heroClass);
}

function handleJoinCoopRoom(playerId: string, roomCode: string, playerName: string, heroClass: any): void {
  const player = players.get(playerId);
  if (!player) return;

  const name = playerName || `Player_${playerId.slice(0, 4)}`;
  console.log(`[Coop] ${name}(${playerId}) 방 참가 요청: ${roomCode}`);
  joinCoopRoom(roomCode, playerId, name, heroClass);
}

function handleLeaveCoopRoom(playerId: string): void {
  console.log(`[Coop] ${playerId} 방 나가기`);
  leaveCoopRoom(playerId);
}

function handleCoopReady(playerId: string, isReady: boolean): void {
  console.log(`[Coop] ${playerId} 준비 상태: ${isReady}`);
  setCoopReady(playerId, isReady);
}

function handleChangeCoopClass(playerId: string, heroClass: any): void {
  console.log(`[Coop] ${playerId} 직업 변경: ${heroClass}`);
  changeCoopClass(playerId, heroClass);
}

function handleStartCoopGame(playerId: string): void {
  console.log(`[Coop] ${playerId} 게임 시작 요청`);
  startCoopGame(playerId);
}

function handleKickCoopPlayer(hostPlayerId: string, targetPlayerId: string): void {
  console.log(`[Coop] ${hostPlayerId} -> ${targetPlayerId} 추방 요청`);
  kickCoopPlayer(hostPlayerId, targetPlayerId);
}

function handleCoopHeroMove(playerId: string, direction: { x: number; y: number } | null): void {
  const player = players.get(playerId);
  if (!player || !player.roomId) return;

  const room = coopGameRooms.get(player.roomId);
  if (room) {
    room.handleHeroMoveDirection(playerId, direction);
  }
}

function handleCoopUseSkill(playerId: string, skillType: any, targetX: number, targetY: number): void {
  const player = players.get(playerId);
  if (!player || !player.roomId) return;

  const room = coopGameRooms.get(player.roomId);
  if (room) {
    room.handleUseSkill(playerId, skillType, targetX, targetY);
  }
}

// 플레이어 연결 해제 시 협동 게임 방 처리
export function handleCoopDisconnect(playerId: string): void {
  const player = players.get(playerId);
  if (!player || !player.roomId) return;

  const coopRoom = coopGameRooms.get(player.roomId);
  if (coopRoom) {
    coopRoom.handlePlayerDisconnect(playerId);
  }

  // 대기 방 처리
  handleCoopPlayerDisconnect(playerId);
}
