import { v4 as uuidv4 } from 'uuid';
import { players, sendToPlayer } from '../state/players';
import { addCoopRoom } from '../websocket/MessageHandler';
import { RPGCoopGameRoom } from '../game/RPGCoopGameRoom';
import type { HeroClass } from '../../../src/types/rpg';
import type { CoopPlayerInfo, COOP_CONFIG } from '../../../shared/types/rpgNetwork';

// 대기 중인 협동 방 정보
interface WaitingCoopRoom {
  id: string;
  code: string;
  hostPlayerId: string;
  players: Map<string, CoopPlayerInfo>;  // playerId -> CoopPlayerInfo
  createdAt: number;
  state: 'waiting' | 'countdown' | 'started';
}

// 대기 중인 협동 방 저장소
const waitingCoopRooms = new Map<string, WaitingCoopRoom>();  // roomId -> WaitingCoopRoom
const coopRoomCodeMap = new Map<string, string>();            // code -> roomId

// 협동 설정
const MAX_PLAYERS = 4;
const MIN_PLAYERS = 2;

// 6자리 초대 코드 생성 (혼동되는 문자 제외)
const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateRoomCode(): string {
  let code: string;
  do {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += CHARSET[Math.floor(Math.random() * CHARSET.length)];
    }
  } while (coopRoomCodeMap.has(code));
  return code;
}

// 협동 방 생성
export function createCoopRoom(
  hostPlayerId: string,
  playerName: string,
  heroClass: HeroClass
): WaitingCoopRoom | null {
  const player = players.get(hostPlayerId);
  if (!player) {
    sendToPlayer(hostPlayerId, { type: 'COOP_ROOM_ERROR', message: '플레이어를 찾을 수 없습니다.' });
    return null;
  }

  // 이미 방에 있는지 확인
  if (player.roomId) {
    sendToPlayer(hostPlayerId, { type: 'COOP_ROOM_ERROR', message: '이미 방에 참가 중입니다.' });
    return null;
  }

  const roomId = uuidv4();
  const code = generateRoomCode();

  const hostInfo: CoopPlayerInfo = {
    id: hostPlayerId,
    name: playerName,
    heroClass,
    isHost: true,
    isReady: false,
    connected: true,
  };

  const room: WaitingCoopRoom = {
    id: roomId,
    code,
    hostPlayerId,
    players: new Map([[hostPlayerId, hostInfo]]),
    createdAt: Date.now(),
    state: 'waiting',
  };

  waitingCoopRooms.set(roomId, room);
  coopRoomCodeMap.set(code, roomId);
  player.roomId = roomId;
  player.name = playerName;

  console.log(`[Coop] 방 생성: ${code} (Host: ${playerName}, Class: ${heroClass})`);

  // 방 생성 완료 알림
  sendToPlayer(hostPlayerId, {
    type: 'COOP_ROOM_CREATED',
    roomCode: code,
    roomId,
  });

  return room;
}

// 협동 방 참가
export function joinCoopRoom(
  roomCode: string,
  playerId: string,
  playerName: string,
  heroClass: HeroClass
): boolean {
  const player = players.get(playerId);
  if (!player) {
    sendToPlayer(playerId, { type: 'COOP_ROOM_ERROR', message: '플레이어를 찾을 수 없습니다.' });
    return false;
  }

  // 이미 방에 있는지 확인
  if (player.roomId) {
    sendToPlayer(playerId, { type: 'COOP_ROOM_ERROR', message: '이미 방에 참가 중입니다.' });
    return false;
  }

  // 코드로 방 찾기
  const roomId = coopRoomCodeMap.get(roomCode.toUpperCase());
  if (!roomId) {
    sendToPlayer(playerId, { type: 'COOP_ROOM_ERROR', message: '존재하지 않는 초대 코드입니다.' });
    return false;
  }

  const room = waitingCoopRooms.get(roomId);
  if (!room) {
    sendToPlayer(playerId, { type: 'COOP_ROOM_ERROR', message: '방을 찾을 수 없습니다.' });
    return false;
  }

  // 방이 이미 가득 찼는지 확인
  if (room.players.size >= MAX_PLAYERS) {
    sendToPlayer(playerId, { type: 'COOP_ROOM_ERROR', message: '방이 가득 찼습니다. (최대 4명)' });
    return false;
  }

  // 방이 이미 시작됐는지 확인
  if (room.state === 'started') {
    sendToPlayer(playerId, { type: 'COOP_ROOM_ERROR', message: '이미 시작된 방입니다.' });
    return false;
  }

  // 참가 처리
  const playerInfo: CoopPlayerInfo = {
    id: playerId,
    name: playerName,
    heroClass,
    isHost: false,
    isReady: false,
    connected: true,
  };

  room.players.set(playerId, playerInfo);
  player.roomId = roomId;
  player.name = playerName;

  const playersArray = Array.from(room.players.values());
  const playerIndex = playersArray.findIndex(p => p.id === playerId);

  console.log(`[Coop] 방 참가: ${roomCode} (Player: ${playerName}, Class: ${heroClass})`);

  // 기존 플레이어들에게 새 플레이어 알림
  room.players.forEach((p, id) => {
    if (id !== playerId) {
      sendToPlayer(id, {
        type: 'COOP_PLAYER_JOINED',
        player: playerInfo,
      });
    }
  });

  // 참가자에게 방 정보 전송
  sendToPlayer(playerId, {
    type: 'COOP_ROOM_JOINED',
    roomId,
    players: playersArray,
    yourIndex: playerIndex,
  });

  return true;
}

// 협동 방 나가기
export function leaveCoopRoom(playerId: string): void {
  const player = players.get(playerId);
  if (!player || !player.roomId) {
    return;
  }

  const room = waitingCoopRooms.get(player.roomId);
  if (!room) {
    player.roomId = null;
    return;
  }

  // 게임이 이미 시작됐으면 WaitingRoom에서는 처리하지 않음
  if (room.state === 'started') {
    return;
  }

  const leavingPlayer = room.players.get(playerId);
  console.log(`[Coop] 방 나가기: ${room.code} (Player: ${leavingPlayer?.name})`);

  room.players.delete(playerId);
  player.roomId = null;

  if (room.hostPlayerId === playerId) {
    // 방장이 나감
    if (room.players.size > 0) {
      // 다음 플레이어를 방장으로 승격
      const newHostId = room.players.keys().next().value as string;
      const newHost = room.players.get(newHostId);
      if (newHost) {
        newHost.isHost = true;
        room.hostPlayerId = newHostId;

        // 모든 플레이어에게 알림
        room.players.forEach((p, id) => {
          sendToPlayer(id, { type: 'COOP_PLAYER_LEFT', playerId });
          // 새 방장 정보 갱신을 위해 전체 플레이어 목록 다시 전송
          sendToPlayer(id, {
            type: 'COOP_ROOM_JOINED',
            roomId: room.id,
            players: Array.from(room.players.values()),
            yourIndex: Array.from(room.players.keys()).indexOf(id),
          });
        });
      }
    } else {
      // 방에 아무도 없으면 방 삭제
      coopRoomCodeMap.delete(room.code);
      waitingCoopRooms.delete(room.id);
    }
  } else {
    // 일반 플레이어가 나감
    room.players.forEach((p, id) => {
      sendToPlayer(id, { type: 'COOP_PLAYER_LEFT', playerId });
    });
  }
}

// 준비 상태 변경
export function setCoopReady(playerId: string, isReady: boolean): void {
  const player = players.get(playerId);
  if (!player || !player.roomId) return;

  const room = waitingCoopRooms.get(player.roomId);
  if (!room || room.state !== 'waiting') return;

  const playerInfo = room.players.get(playerId);
  if (!playerInfo) return;

  playerInfo.isReady = isReady;

  // 모든 플레이어에게 준비 상태 알림
  room.players.forEach((p, id) => {
    sendToPlayer(id, {
      type: 'COOP_PLAYER_READY',
      playerId,
      isReady,
    });
  });
}

// 직업 변경
export function changeCoopClass(playerId: string, heroClass: HeroClass): void {
  const player = players.get(playerId);
  if (!player || !player.roomId) return;

  const room = waitingCoopRooms.get(player.roomId);
  if (!room || room.state !== 'waiting') return;

  const playerInfo = room.players.get(playerId);
  if (!playerInfo) return;

  playerInfo.heroClass = heroClass;
  // 직업 변경 시 준비 상태 해제
  playerInfo.isReady = false;

  // 모든 플레이어에게 직업 변경 알림
  room.players.forEach((p, id) => {
    sendToPlayer(id, {
      type: 'COOP_PLAYER_CLASS_CHANGED',
      playerId,
      heroClass,
    });
    // 준비 상태도 함께 알림
    sendToPlayer(id, {
      type: 'COOP_PLAYER_READY',
      playerId,
      isReady: false,
    });
  });
}

// 플레이어 추방 (호스트 전용)
export function kickCoopPlayer(hostPlayerId: string, targetPlayerId: string): void {
  const player = players.get(hostPlayerId);
  if (!player || !player.roomId) return;

  const room = waitingCoopRooms.get(player.roomId);
  if (!room || room.state !== 'waiting') return;

  // 호스트인지 확인
  if (room.hostPlayerId !== hostPlayerId) {
    sendToPlayer(hostPlayerId, { type: 'COOP_ROOM_ERROR', message: '호스트만 플레이어를 추방할 수 있습니다.' });
    return;
  }

  // 자기 자신은 추방 불가
  if (hostPlayerId === targetPlayerId) {
    sendToPlayer(hostPlayerId, { type: 'COOP_ROOM_ERROR', message: '자기 자신은 추방할 수 없습니다.' });
    return;
  }

  const targetPlayer = players.get(targetPlayerId);
  const targetInfo = room.players.get(targetPlayerId);
  if (!targetInfo) {
    sendToPlayer(hostPlayerId, { type: 'COOP_ROOM_ERROR', message: '해당 플레이어를 찾을 수 없습니다.' });
    return;
  }

  console.log(`[Coop] 플레이어 추방: ${room.code} (${targetInfo.name})`);

  room.players.delete(targetPlayerId);
  if (targetPlayer) {
    targetPlayer.roomId = null;
  }

  // 추방된 플레이어에게 알림
  sendToPlayer(targetPlayerId, {
    type: 'COOP_PLAYER_KICKED',
    playerId: targetPlayerId,
    reason: '호스트에 의해 추방되었습니다.',
  });

  // 나머지 플레이어들에게 알림
  room.players.forEach((p, id) => {
    sendToPlayer(id, { type: 'COOP_PLAYER_LEFT', playerId: targetPlayerId });
  });
}

// 게임 시작 (호스트 전용)
export function startCoopGame(hostPlayerId: string): void {
  const player = players.get(hostPlayerId);
  if (!player || !player.roomId) return;

  const room = waitingCoopRooms.get(player.roomId);
  if (!room) return;

  // 호스트인지 확인
  if (room.hostPlayerId !== hostPlayerId) {
    sendToPlayer(hostPlayerId, { type: 'COOP_ROOM_ERROR', message: '호스트만 게임을 시작할 수 있습니다.' });
    return;
  }

  // 최소 인원 확인
  if (room.players.size < MIN_PLAYERS) {
    sendToPlayer(hostPlayerId, { type: 'COOP_ROOM_ERROR', message: `최소 ${MIN_PLAYERS}명이 필요합니다.` });
    return;
  }

  // 모든 플레이어가 준비됐는지 확인 (호스트 제외)
  let allReady = true;
  room.players.forEach((p, id) => {
    if (id !== hostPlayerId && !p.isReady) {
      allReady = false;
    }
  });

  if (!allReady) {
    sendToPlayer(hostPlayerId, { type: 'COOP_ROOM_ERROR', message: '모든 플레이어가 준비되지 않았습니다.' });
    return;
  }

  room.state = 'countdown';

  // GameRoom 생성
  const playerIds = Array.from(room.players.keys());
  const playerInfos = Array.from(room.players.values());

  const gameRoom = new RPGCoopGameRoom(room.id, playerIds, playerInfos);

  // MessageHandler에 게임 방 등록
  addCoopRoom(gameRoom);

  console.log(`[Coop] 게임 시작: ${room.code} (${room.players.size}명)`);

  // 대기 방에서 삭제 (GameRoom으로 이관)
  room.state = 'started';
  coopRoomCodeMap.delete(room.code);
  waitingCoopRooms.delete(room.id);

  // 카운트다운 시작
  gameRoom.startCountdown();
}

// 플레이어 연결 해제 시 호출
export function handleCoopPlayerDisconnect(playerId: string): void {
  leaveCoopRoom(playerId);
}

// 코드로 방 찾기
export function getCoopRoomByCode(code: string): WaitingCoopRoom | null {
  const roomId = coopRoomCodeMap.get(code.toUpperCase());
  if (!roomId) return null;
  return waitingCoopRooms.get(roomId) || null;
}

// 플레이어 ID로 방 찾기
export function getCoopRoomByPlayerId(playerId: string): WaitingCoopRoom | null {
  for (const room of waitingCoopRooms.values()) {
    if (room.players.has(playerId)) {
      return room;
    }
  }
  return null;
}
