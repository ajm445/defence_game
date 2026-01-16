import type { ClientMessage } from '../../../shared/types/network';
import { players, sendToPlayer } from './WebSocketServer';
import { addToQueue, removeFromQueue } from '../matchmaking/MatchMaker';
import { GameRoom } from '../game/GameRoom';

// 게임 방 저장소
const gameRooms = new Map<string, GameRoom>();

export function getRoom(roomId: string): GameRoom | undefined {
  return gameRooms.get(roomId);
}

export function addRoom(room: GameRoom): void {
  gameRooms.set(room.id, room);
}

export function removeRoom(roomId: string): void {
  gameRooms.delete(roomId);
}

export function handleMessage(playerId: string, message: ClientMessage): void {
  const player = players.get(playerId);
  if (!player) {
    console.error(`플레이어를 찾을 수 없음: ${playerId}`);
    return;
  }

  switch (message.type) {
    case 'JOIN_QUEUE':
      handleJoinQueue(playerId, message.playerName);
      break;

    case 'LEAVE_QUEUE':
      handleLeaveQueue(playerId);
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

    default:
      console.warn(`알 수 없는 메시지 타입: ${(message as any).type}`);
  }
}

function handleJoinQueue(playerId: string, playerName: string): void {
  const player = players.get(playerId);
  if (!player) return;

  player.name = playerName || `Player_${playerId.slice(0, 4)}`;

  console.log(`${player.name}(${playerId}) 매칭 대기열 참가`);
  addToQueue(playerId);
}

function handleLeaveQueue(playerId: string): void {
  console.log(`${playerId} 매칭 대기열 이탈`);
  removeFromQueue(playerId);
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
