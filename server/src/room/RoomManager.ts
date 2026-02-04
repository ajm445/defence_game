import { v4 as uuidv4 } from 'uuid';
import { players, sendToPlayer } from '../state/players';
import { addRoom } from '../websocket/MessageHandler';
import { GameRoom } from '../game/GameRoom';

// 대기 중인 방 정보
interface WaitingRoom {
  id: string;
  code: string;
  hostPlayerId: string;
  hostName: string;
  guestPlayerId: string | null;
  guestName: string | null;
  createdAt: number;
  state: 'waiting' | 'ready' | 'started';
}

// 대기 중인 방 저장소
const waitingRooms = new Map<string, WaitingRoom>();  // roomId -> WaitingRoom
const roomCodeMap = new Map<string, string>();        // code -> roomId

// 6자리 초대 코드 생성 (혼동되는 문자 제외: 0, O, I, L, 1)
const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateRoomCode(): string {
  let code: string;
  do {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += CHARSET[Math.floor(Math.random() * CHARSET.length)];
    }
  } while (roomCodeMap.has(code)); // 중복 방지
  return code;
}

// 방 생성
export function createRoom(hostPlayerId: string, playerName: string): WaitingRoom | null {
  const player = players.get(hostPlayerId);
  if (!player) {
    sendToPlayer(hostPlayerId, { type: 'ROOM_ERROR', message: '플레이어를 찾을 수 없습니다.' });
    return null;
  }

  // 이미 방에 있는지 확인
  if (player.roomId) {
    sendToPlayer(hostPlayerId, { type: 'ROOM_ERROR', message: '이미 방에 참가 중입니다.' });
    return null;
  }

  const roomId = uuidv4();
  const code = generateRoomCode();

  const room: WaitingRoom = {
    id: roomId,
    code,
    hostPlayerId,
    hostName: playerName,
    guestPlayerId: null,
    guestName: null,
    createdAt: Date.now(),
    state: 'waiting',
  };

  waitingRooms.set(roomId, room);
  roomCodeMap.set(code, roomId);
  player.roomId = roomId;
  player.name = playerName;

  console.log(`방 생성: ${code} (Host: ${playerName})`);

  // 방 생성 완료 알림
  sendToPlayer(hostPlayerId, {
    type: 'ROOM_CREATED',
    roomCode: code,
    roomId,
  });

  return room;
}

// 방 참가
export function joinRoom(roomCode: string, guestPlayerId: string, playerName: string): boolean {
  const player = players.get(guestPlayerId);
  if (!player) {
    sendToPlayer(guestPlayerId, { type: 'ROOM_ERROR', message: '플레이어를 찾을 수 없습니다.' });
    return false;
  }

  // 이미 방에 있는지 확인
  if (player.roomId) {
    sendToPlayer(guestPlayerId, { type: 'ROOM_ERROR', message: '이미 방에 참가 중입니다.' });
    return false;
  }

  // 코드로 방 찾기
  const roomId = roomCodeMap.get(roomCode.toUpperCase());
  if (!roomId) {
    sendToPlayer(guestPlayerId, { type: 'ROOM_ERROR', message: '존재하지 않는 초대 코드입니다.' });
    return false;
  }

  const room = waitingRooms.get(roomId);
  if (!room) {
    sendToPlayer(guestPlayerId, { type: 'ROOM_ERROR', message: '방을 찾을 수 없습니다.' });
    return false;
  }

  // 방이 이미 가득 찼는지 확인
  if (room.guestPlayerId) {
    sendToPlayer(guestPlayerId, { type: 'ROOM_ERROR', message: '방이 가득 찼습니다.' });
    return false;
  }

  // 방이 이미 시작됐는지 확인
  if (room.state === 'started') {
    sendToPlayer(guestPlayerId, { type: 'ROOM_ERROR', message: '이미 시작된 방입니다.' });
    return false;
  }

  // 참가 처리
  room.guestPlayerId = guestPlayerId;
  room.guestName = playerName;
  room.state = 'ready';
  player.roomId = roomId;
  player.name = playerName;

  console.log(`방 참가: ${roomCode} (Guest: ${playerName})`);

  // 방장에게 상대방 참가 알림
  sendToPlayer(room.hostPlayerId, {
    type: 'PLAYER_JOINED',
    opponent: playerName,
  });

  // 참가자에게 방 참가 완료 알림
  sendToPlayer(guestPlayerId, {
    type: 'ROOM_JOINED',
    roomId,
    opponent: room.hostName,
    side: 'right',
  });

  // 방장에게도 ROOM_JOINED 전송 (side 정보 포함)
  sendToPlayer(room.hostPlayerId, {
    type: 'ROOM_JOINED',
    roomId,
    opponent: playerName,
    side: 'left',
  });

  // 게임 시작
  startGame(room);

  return true;
}

// 방 나가기
export function leaveRoom(playerId: string): void {
  const player = players.get(playerId);
  if (!player || !player.roomId) {
    return;
  }

  const room = waitingRooms.get(player.roomId);
  if (!room) {
    // PvP 대기 방이 아닌 경우 roomId를 클리어하지 않음 (Coop 방일 수 있음)
    return;
  }

  // 게임이 이미 시작됐으면 WaitingRoom에서는 처리하지 않음
  if (room.state === 'started') {
    return;
  }

  console.log(`방 나가기: ${room.code} (Player: ${player.name})`);

  if (room.hostPlayerId === playerId) {
    // 방장이 나감 -> 방 삭제
    if (room.guestPlayerId) {
      // 참가자에게 알림
      const guest = players.get(room.guestPlayerId);
      if (guest) {
        guest.roomId = null;
        sendToPlayer(room.guestPlayerId, { type: 'PLAYER_LEFT' });
      }
    }
    // 방 삭제
    roomCodeMap.delete(room.code);
    waitingRooms.delete(room.id);
  } else if (room.guestPlayerId === playerId) {
    // 참가자가 나감
    room.guestPlayerId = null;
    room.guestName = null;
    room.state = 'waiting';
    // 방장에게 알림
    sendToPlayer(room.hostPlayerId, { type: 'PLAYER_LEFT' });
  }

  player.roomId = null;
}

// 게임 시작
function startGame(waitingRoom: WaitingRoom): void {
  if (!waitingRoom.guestPlayerId) {
    return;
  }

  waitingRoom.state = 'started';

  // GameRoom 생성 (방장 = left, 참가자 = right)
  const gameRoom = new GameRoom(
    waitingRoom.id,
    waitingRoom.hostPlayerId,
    waitingRoom.guestPlayerId
  );

  // MessageHandler에 게임 방 등록
  addRoom(gameRoom);

  console.log(`게임 시작: ${waitingRoom.hostName} vs ${waitingRoom.guestName}`);

  // 대기 방에서 삭제 (GameRoom으로 이관)
  roomCodeMap.delete(waitingRoom.code);
  waitingRooms.delete(waitingRoom.id);

  // 카운트다운 시작
  gameRoom.startCountdown();
}

// 플레이어 연결 해제 시 호출
export function handlePlayerDisconnect(playerId: string): void {
  leaveRoom(playerId);
}

// 코드로 방 찾기
export function getRoomByCode(code: string): WaitingRoom | null {
  const roomId = roomCodeMap.get(code.toUpperCase());
  if (!roomId) return null;
  return waitingRooms.get(roomId) || null;
}

// 플레이어 ID로 방 찾기
export function getRoomByPlayerId(playerId: string): WaitingRoom | null {
  for (const room of waitingRooms.values()) {
    if (room.hostPlayerId === playerId || room.guestPlayerId === playerId) {
      return room;
    }
  }
  return null;
}
