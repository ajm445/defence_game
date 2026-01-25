import type { ClientMessage } from '../../../shared/types/network';
import { players } from '../state/players';
import { createRoom, joinRoom, leaveRoom } from '../room/RoomManager';
import {
  createCoopRoom,
  joinCoopRoom,
  joinCoopRoomById,
  leaveCoopRoom,
  setCoopReady,
  changeCoopClass,
  kickCoopPlayer,
  startCoopGame,
  handleCoopPlayerDisconnect,
  getAllWaitingCoopRooms,
  getCoopRoomByPlayerId,
} from '../room/CoopRoomManager';
import { sendToPlayer } from '../state/players';
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

    // 사용자 인증 메시지
    case 'USER_LOGIN':
      handleUserLogin(playerId, (message as any).userId, (message as any).nickname, (message as any).isGuest, (message as any).level);
      break;

    case 'USER_LOGOUT':
      handleUserLogout(playerId, (message as any).userId, (message as any).nickname);
      break;

    // 협동 모드 메시지
    case 'CREATE_COOP_ROOM':
      handleCreateCoopRoom(playerId, message.playerName, message.heroClass, message.characterLevel, message.statUpgrades, (message as any).isPrivate);
      break;

    case 'JOIN_COOP_ROOM':
      handleJoinCoopRoom(playerId, message.roomCode, message.playerName, message.heroClass, message.characterLevel, message.statUpgrades);
      break;

    case 'JOIN_COOP_ROOM_BY_ID':
      handleJoinCoopRoomById(playerId, (message as any).roomId, message.playerName, message.heroClass, message.characterLevel, message.statUpgrades);
      break;

    case 'GET_COOP_ROOM_LIST':
      handleGetCoopRoomList(playerId);
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
      handleChangeCoopClass(playerId, message.heroClass, message.characterLevel, message.statUpgrades);
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

    case 'COOP_UPGRADE_HERO_STAT':
      handleCoopUpgradeHeroStat(playerId, (message as any).upgradeType);
      break;

    // 호스트 기반 메시지
    case 'HOST_GAME_STATE_BROADCAST':
      handleHostGameStateBroadcast(playerId, (message as any).state);
      break;

    case 'HOST_GAME_EVENT_BROADCAST':
      handleHostGameEventBroadcast(playerId, (message as any).event);
      break;

    case 'HOST_PLAYER_INPUT':
      handleHostPlayerInput(playerId, (message as any).input);
      break;

    case 'HOST_GAME_OVER':
      handleHostGameOver(playerId, (message as any).result);
      break;

    case 'RETURN_TO_LOBBY':
      handleReturnToLobby(playerId);
      break;

    case 'RESTART_COOP_GAME':
      handleRestartCoopGame(playerId);
      break;

    case 'DESTROY_COOP_ROOM':
      handleDestroyCoopRoom(playerId);
      break;

    case 'PAUSE_COOP_GAME':
      handlePauseCoopGame(playerId);
      break;

    case 'RESUME_COOP_GAME':
      handleResumeCoopGame(playerId);
      break;

    case 'STOP_COOP_GAME':
      handleStopCoopGame(playerId);
      break;

    default:
      console.warn(`알 수 없는 메시지 타입: ${(message as any).type}`);
  }
}

// ============================================
// 사용자 인증 핸들러
// ============================================

function handleUserLogin(playerId: string, userId: string, nickname: string, isGuest: boolean, level?: number): void {
  const accountType = isGuest ? '게스트' : '일반';
  const levelInfo = level ? ` (Lv.${level})` : '';
  console.log(`[Auth] 로그인: ${nickname}${levelInfo} [${accountType}] (userId: ${userId}, playerId: ${playerId})`);
}

function handleUserLogout(playerId: string, userId: string, nickname: string): void {
  console.log(`[Auth] 로그아웃: ${nickname} (userId: ${userId}, playerId: ${playerId})`);
}

// ============================================
// 방 핸들러
// ============================================

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

function handleCreateCoopRoom(playerId: string, playerName: string, heroClass: any, characterLevel?: number, statUpgrades?: any, isPrivate?: boolean): void {
  const player = players.get(playerId);
  if (!player) return;

  const name = playerName || `Player_${playerId.slice(0, 4)}`;
  console.log(`[Coop] ${name}(${playerId}) 방 생성 요청 (Lv.${characterLevel ?? 1}, Private: ${isPrivate ?? false})`);
  createCoopRoom(playerId, name, heroClass, characterLevel ?? 1, statUpgrades, isPrivate ?? false);
}

function handleJoinCoopRoom(playerId: string, roomCode: string, playerName: string, heroClass: any, characterLevel?: number, statUpgrades?: any): void {
  const player = players.get(playerId);
  if (!player) return;

  const name = playerName || `Player_${playerId.slice(0, 4)}`;
  console.log(`[Coop] ${name}(${playerId}) 방 참가 요청: ${roomCode} (Lv.${characterLevel ?? 1}, SP: ${JSON.stringify(statUpgrades ?? {})})`);
  joinCoopRoom(roomCode, playerId, name, heroClass, characterLevel ?? 1, statUpgrades);
}

function handleJoinCoopRoomById(playerId: string, roomId: string, playerName: string, heroClass: any, characterLevel?: number, statUpgrades?: any): void {
  const player = players.get(playerId);
  if (!player) return;

  const name = playerName || `Player_${playerId.slice(0, 4)}`;
  console.log(`[Coop] ${name}(${playerId}) 방 참가 요청(ID): ${roomId} (Lv.${characterLevel ?? 1}, SP: ${JSON.stringify(statUpgrades ?? {})})`);
  joinCoopRoomById(roomId, playerId, name, heroClass, characterLevel ?? 1, statUpgrades);
}

function handleGetCoopRoomList(playerId: string): void {
  const rooms = getAllWaitingCoopRooms();
  sendToPlayer(playerId, {
    type: 'COOP_ROOM_LIST',
    rooms,
  });
}

function handleLeaveCoopRoom(playerId: string): void {
  console.log(`[Coop] ${playerId} 방 나가기`);

  const player = players.get(playerId);
  const roomId = player?.roomId;

  // 먼저 게임 방에서 찾기 (게임 중 또는 게임 종료 후)
  if (roomId) {
    const gameRoom = coopGameRooms.get(roomId);
    if (gameRoom) {
      // 호스트가 나가면 방 파기
      if (gameRoom.isHost(playerId)) {
        console.log(`[Coop] 호스트가 방 나가기 - 방 파기: ${roomId}`);
        gameRoom.destroyRoom(playerId);
      } else {
        // 일반 플레이어는 퇴장 처리
        console.log(`[Coop] 게임 방에서 플레이어 제거: ${roomId}`);
        gameRoom.handlePlayerDisconnect(playerId);
        if (player) player.roomId = null;
      }
      return;
    }
  }

  // 대기 중인 방에서 찾기
  leaveCoopRoom(playerId);
}

function handleCoopReady(playerId: string, isReady: boolean): void {
  console.log(`[Coop] ${playerId} 준비 상태: ${isReady}`);

  // 먼저 대기 중인 방에서 찾기
  setCoopReady(playerId, isReady);

  // 게임 방에서도 찾기 (게임 종료 후 로비 복귀 시)
  const player = players.get(playerId);
  if (player && player.roomId) {
    const room = coopGameRooms.get(player.roomId);
    if (room) {
      room.setPlayerReady(playerId, isReady);
    }
  }
}

function handleChangeCoopClass(playerId: string, heroClass: any, characterLevel?: number, statUpgrades?: any): void {
  console.log(`[Coop] ${playerId} 직업 변경: ${heroClass} (Lv.${characterLevel ?? 1}, SP: ${JSON.stringify(statUpgrades ?? {})})`);

  // 먼저 대기 중인 방에서 찾기
  changeCoopClass(playerId, heroClass, characterLevel ?? 1, statUpgrades);

  // 게임 방에서도 찾기 (게임 종료 후 로비 복귀 시)
  const player = players.get(playerId);
  if (player && player.roomId) {
    const room = coopGameRooms.get(player.roomId);
    if (room) {
      room.changePlayerClass(playerId, heroClass, characterLevel ?? 1, statUpgrades);
    }
  }
}

function handleStartCoopGame(playerId: string): void {
  console.log(`[Coop] ${playerId} 게임 시작 요청`);

  // 대기 중인 방에 있는지 확인
  const waitingRoom = getCoopRoomByPlayerId(playerId);

  if (waitingRoom) {
    // 대기 중인 방에서 첫 게임 시작
    console.log(`[Coop] 대기 방에서 게임 시작: ${waitingRoom.code}`);
    startCoopGame(playerId);
  } else {
    // 게임 방에서 재시작 (게임 종료 후 로비 복귀 시)
    const player = players.get(playerId);
    if (player && player.roomId) {
      const room = coopGameRooms.get(player.roomId);
      if (room) {
        console.log(`[Coop] 게임 방에서 재시작: ${room.roomCode}`);
        room.restartGame(playerId);
      } else {
        console.log(`[Coop] 게임 시작 실패: 방을 찾을 수 없음 (roomId=${player.roomId})`);
      }
    } else {
      console.log(`[Coop] 게임 시작 실패: 플레이어 정보 없음`);
    }
  }
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

function handleCoopUpgradeHeroStat(playerId: string, upgradeType: 'attack' | 'speed' | 'hp' | 'goldRate'): void {
  const player = players.get(playerId);
  if (!player || !player.roomId) return;

  const room = coopGameRooms.get(player.roomId);
  if (room) {
    const success = room.handleUpgrade(playerId, upgradeType);
    if (success) {
      console.log(`[Coop] ${playerId} 업그레이드 성공: ${upgradeType}`);
    }
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

// ============================================
// 호스트 기반 메시지 핸들러
// ============================================

function handleHostGameStateBroadcast(playerId: string, state: any): void {
  const player = players.get(playerId);
  if (!player || !player.roomId) return;

  const room = coopGameRooms.get(player.roomId);
  if (room) {
    room.handleGameStateBroadcast(playerId, state);
  }
}

function handleHostGameEventBroadcast(playerId: string, event: any): void {
  const player = players.get(playerId);
  if (!player || !player.roomId) return;

  const room = coopGameRooms.get(player.roomId);
  if (room) {
    room.handleGameEventBroadcast(playerId, event);
  }
}

function handleHostPlayerInput(playerId: string, input: any): void {
  const player = players.get(playerId);
  if (!player || !player.roomId) return;

  const room = coopGameRooms.get(player.roomId);
  if (room) {
    room.handlePlayerInput(playerId, input);
  }
}

function handleHostGameOver(playerId: string, result: any): void {
  const player = players.get(playerId);
  if (!player || !player.roomId) return;

  const room = coopGameRooms.get(player.roomId);
  if (room) {
    room.handleGameOver(playerId, result);
  }
}

function handleReturnToLobby(playerId: string): void {
  console.log(`[Coop] ${playerId} 로비 복귀 요청`);
  const player = players.get(playerId);
  if (!player || !player.roomId) {
    console.log(`[Coop] 로비 복귀 실패: 플레이어 정보 없음`);
    return;
  }

  console.log(`[Coop] 플레이어 roomId: ${player.roomId}`);
  const room = coopGameRooms.get(player.roomId);
  if (room) {
    room.returnToLobby(playerId);
  } else {
    console.log(`[Coop] 로비 복귀 실패: 방을 찾을 수 없음 (roomId=${player.roomId})`);
  }
}

function handleRestartCoopGame(playerId: string): void {
  const player = players.get(playerId);
  if (!player || !player.roomId) return;

  const room = coopGameRooms.get(player.roomId);
  if (room) {
    room.restartGame(playerId);
  }
}

function handleDestroyCoopRoom(playerId: string): void {
  const player = players.get(playerId);
  if (!player || !player.roomId) return;

  const room = coopGameRooms.get(player.roomId);
  if (room) {
    room.destroyRoom(playerId);
  }
}

function handlePauseCoopGame(playerId: string): void {
  const player = players.get(playerId);
  if (!player || !player.roomId) return;

  const room = coopGameRooms.get(player.roomId);
  if (room) {
    room.pauseGame(playerId);
  }
}

function handleResumeCoopGame(playerId: string): void {
  const player = players.get(playerId);
  if (!player || !player.roomId) return;

  const room = coopGameRooms.get(player.roomId);
  if (room) {
    room.resumeGame(playerId);
  }
}

function handleStopCoopGame(playerId: string): void {
  const player = players.get(playerId);
  if (!player || !player.roomId) return;

  const room = coopGameRooms.get(player.roomId);
  if (room) {
    room.stopGame(playerId);
  }
}
