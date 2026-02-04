import { v4 as uuidv4 } from 'uuid';
import { players, sendToPlayer } from '../state/players';
import { addCoopRoom } from '../websocket/MessageHandler';
import { RPGCoopGameRoom } from '../game/RPGCoopGameRoom';
import { gameInviteManager } from '../friend/GameInviteManager';
import type { HeroClass } from '../../../src/types/rpg';
import type { CoopPlayerInfo, WaitingCoopRoomInfo, LobbyChatMessage, LOBBY_CHAT_CONFIG } from '../../../shared/types/rpgNetwork';
import type { CharacterStatUpgrades } from '../../../src/types/auth';

// 로비 채팅 설정 (shared에서 가져온 값과 동일하게 유지)
const CHAT_CONFIG = {
  MAX_MESSAGE_LENGTH: 200,
  MAX_HISTORY_SIZE: 50,
  MIN_MESSAGE_INTERVAL: 500,
};

// 방 자동 파기 설정
const ROOM_AUTO_DESTROY_CONFIG = {
  TIMEOUT_MS: 10 * 60 * 1000,  // 10분
  WARNING_MS: 9 * 60 * 1000,   // 9분 (파기 1분 전 경고)
  CHECK_INTERVAL_MS: 60 * 1000,  // 1분마다 체크
};

// 대기 중인 협동 방 정보
interface WaitingCoopRoom {
  id: string;
  code: string;
  hostPlayerId: string;
  players: Map<string, CoopPlayerInfo>;  // playerId -> CoopPlayerInfo
  createdAt: number;
  state: 'waiting' | 'countdown' | 'started';
  isPrivate: boolean;  // 비밀방 여부
  difficulty: string;  // 난이도 ('easy' | 'normal' | 'hard' | 'extreme')
  // 로비 채팅
  chatHistory: LobbyChatMessage[];
  lastMessageTime: Map<string, number>;  // playerId -> 마지막 메시지 시간
  // 타임아웃 경고 전송 여부
  timeoutWarningNotified?: boolean;
}

// 대기 중인 협동 방 저장소
const waitingCoopRooms = new Map<string, WaitingCoopRoom>();  // roomId -> WaitingCoopRoom
const coopRoomCodeMap = new Map<string, string>();            // code -> roomId

// 방 목록 변경 시 모든 대기 중인 클라이언트에게 브로드캐스트
function broadcastRoomListUpdate(): void {
  const rooms = getAllWaitingCoopRooms();
  const message = { type: 'COOP_ROOM_LIST_UPDATED' as const, rooms };

  // 방에 참가하지 않은 모든 온라인 플레이어에게 전송
  players.forEach((player) => {
    if (player && player.ws.readyState === 1 && !player.roomId) {  // WebSocket.OPEN = 1
      sendToPlayer(player.id, message);
    }
  });
}

// 협동 설정 (호스트 기반 통합 시스템 - 1인도 시작 가능)
const MAX_PLAYERS = 4;
const MIN_PLAYERS = 1;

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
  heroClass: HeroClass,
  characterLevel: number = 1,
  statUpgrades?: CharacterStatUpgrades,
  isPrivate: boolean = false,
  difficulty: string = 'easy',
  advancedClass?: string,
  tier?: 1 | 2
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
    characterLevel,
    statUpgrades,
    advancedClass,
    tier,
  };

  const room: WaitingCoopRoom = {
    id: roomId,
    code,
    hostPlayerId,
    players: new Map([[hostPlayerId, hostInfo]]),
    createdAt: Date.now(),
    state: 'waiting',
    isPrivate,
    difficulty,
    chatHistory: [],
    lastMessageTime: new Map(),
  };

  waitingCoopRooms.set(roomId, room);
  coopRoomCodeMap.set(code, roomId);
  player.roomId = roomId;
  player.name = playerName;

  const roomType = isPrivate ? '비밀방' : '공개방';
  console.log(`[Coop] 방 생성 완료: ${code} (Host: ${playerName}, Class: ${heroClass}, ${roomType})`);

  // 방 생성 완료 알림
  sendToPlayer(hostPlayerId, {
    type: 'COOP_ROOM_CREATED',
    roomCode: code,
    roomId,
    isPrivate: room.isPrivate,
    difficulty: room.difficulty,
  });

  // 다른 대기 중인 클라이언트들에게 방 목록 업데이트 알림
  broadcastRoomListUpdate();

  return room;
}

// 협동 방 참가
export function joinCoopRoom(
  roomCode: string,
  playerId: string,
  playerName: string,
  heroClass: HeroClass,
  characterLevel: number = 1,
  statUpgrades?: CharacterStatUpgrades,
  advancedClass?: string,
  tier?: 1 | 2
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
    characterLevel,
    statUpgrades,
    advancedClass,
    tier,
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
    roomCode: room.code,
    players: playersArray,
    yourIndex: playerIndex,
    isPrivate: room.isPrivate,
    difficulty: room.difficulty,
  });

  // 채팅 히스토리 전송
  if (room.chatHistory.length > 0) {
    sendToPlayer(playerId, {
      type: 'LOBBY_CHAT_HISTORY',
      messages: room.chatHistory,
    });
  }

  // 다른 대기 중인 클라이언트들에게 방 목록 업데이트 알림 (인원 수 변경)
  broadcastRoomListUpdate();

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
    player.isInGame = false;
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
  player.isInGame = false;

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
            roomCode: room.code,
            players: Array.from(room.players.values()),
            yourIndex: Array.from(room.players.keys()).indexOf(id),
            isPrivate: room.isPrivate,
            difficulty: room.difficulty,
          });
        });
      }
    } else {
      // 방에 아무도 없으면 방 삭제
      gameInviteManager.cancelRoomInvites(room.id);
      coopRoomCodeMap.delete(room.code);
      waitingCoopRooms.delete(room.id);
    }
  } else {
    // 일반 플레이어가 나감
    room.players.forEach((p, id) => {
      sendToPlayer(id, { type: 'COOP_PLAYER_LEFT', playerId });
    });

    // 방에 아무도 없으면 방 삭제 (비정상적인 경우 대비)
    if (room.players.size === 0) {
      console.log(`[Coop] 빈 방 삭제: ${room.code}`);
      gameInviteManager.cancelRoomInvites(room.id);
      coopRoomCodeMap.delete(room.code);
      waitingCoopRooms.delete(room.id);
    }
  }

  // 다른 대기 중인 클라이언트들에게 방 목록 업데이트 알림 (인원 수 변경 또는 방 삭제)
  broadcastRoomListUpdate();
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
export function changeCoopClass(playerId: string, heroClass: HeroClass, characterLevel: number = 1, statUpgrades?: CharacterStatUpgrades, advancedClass?: string, tier?: 1 | 2): void {
  const player = players.get(playerId);
  if (!player || !player.roomId) return;

  const room = waitingCoopRooms.get(player.roomId);
  if (!room || room.state !== 'waiting') return;

  const playerInfo = room.players.get(playerId);
  if (!playerInfo) return;

  playerInfo.heroClass = heroClass;
  playerInfo.characterLevel = characterLevel;  // 캐릭터 레벨도 업데이트
  playerInfo.statUpgrades = statUpgrades;  // SP 스탯 업그레이드도 업데이트
  playerInfo.advancedClass = advancedClass;  // 전직 클래스 업데이트
  playerInfo.tier = tier;  // 강화 단계 업데이트
  // 직업 변경 시 준비 상태 해제
  playerInfo.isReady = false;

  // 모든 플레이어에게 직업 변경 알림
  room.players.forEach((p, id) => {
    sendToPlayer(id, {
      type: 'COOP_PLAYER_CLASS_CHANGED',
      playerId,
      heroClass,
      characterLevel,
      advancedClass,
      tier,
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
    targetPlayer.isInGame = false;
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

  // 다른 대기 중인 클라이언트들에게 방 목록 업데이트 알림 (인원 수 변경)
  broadcastRoomListUpdate();
}

// 방 설정 변경 (호스트 전용)
export function updateCoopRoomSettings(hostPlayerId: string, isPrivate?: boolean, difficulty?: string): void {
  const player = players.get(hostPlayerId);
  if (!player || !player.roomId) return;

  const room = waitingCoopRooms.get(player.roomId);
  if (!room || room.state !== 'waiting') return;

  // 호스트인지 확인
  if (room.hostPlayerId !== hostPlayerId) {
    sendToPlayer(hostPlayerId, { type: 'COOP_ROOM_ERROR', message: '호스트만 방 설정을 변경할 수 있습니다.' });
    return;
  }

  // 설정 변경
  if (isPrivate !== undefined) {
    room.isPrivate = isPrivate;
  }
  if (difficulty !== undefined) {
    room.difficulty = difficulty;
  }

  const hostInfo = room.players.get(hostPlayerId);
  const roomType = room.isPrivate ? '비밀방' : '공개방';
  const DIFFICULTY_NAMES: Record<string, string> = {
    easy: '쉬움',
    normal: '중간',
    hard: '어려움',
    extreme: '극한',
  };
  const difficultyName = DIFFICULTY_NAMES[room.difficulty] || '쉬움';

  console.log(`[Coop] 방 설정 변경: ${room.code} (Host: ${hostInfo?.name}, ${roomType}, 난이도: ${difficultyName})`);

  // 모든 플레이어에게 설정 변경 알림
  room.players.forEach((p, id) => {
    sendToPlayer(id, {
      type: 'COOP_ROOM_SETTINGS_CHANGED',
      isPrivate: room.isPrivate,
      difficulty: room.difficulty,
    });
  });

  // 다른 대기 중인 클라이언트들에게 방 목록 업데이트 알림 (비밀방/공개방 변경, 난이도 변경)
  broadcastRoomListUpdate();
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

  // 모든 플레이어가 준비됐는지 확인 (호스트 제외, 혼자일 때는 스킵)
  if (room.players.size > 1) {
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
  }

  room.state = 'countdown';

  // GameRoom 생성
  const playerIds = Array.from(room.players.keys());
  const playerInfos = Array.from(room.players.values());

  const gameRoom = new RPGCoopGameRoom(room.id, room.code, playerIds, playerInfos, room.isPrivate, room.difficulty);

  // MessageHandler에 게임 방 등록
  addCoopRoom(gameRoom);

  console.log(`[Coop] 게임 시작: ${room.code} (${room.players.size}명)`);

  // 대기 방 상태를 'started'로 변경 (방은 유지)
  room.state = 'started';

  // 다른 대기 중인 클라이언트들에게 방 목록 업데이트 알림 (게임 시작으로 isInGame 상태 변경)
  broadcastRoomListUpdate();

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

// 모든 방 목록 조회 (게임 중인 방도 포함)
export function getAllWaitingCoopRooms(): WaitingCoopRoomInfo[] {
  return Array.from(waitingCoopRooms.values())
    .map(room => {
      const host = room.players.get(room.hostPlayerId);
      return {
        roomId: room.id,
        roomCode: room.code,
        hostName: host?.name || '알 수 없음',
        hostHeroClass: host?.heroClass || 'archer',
        hostClassLevel: host?.characterLevel || 1,
        hostAdvancedClass: host?.advancedClass,  // 호스트 전직 직업
        hostTier: host?.tier,  // 호스트 전직 단계
        playerCount: room.players.size,
        maxPlayers: MAX_PLAYERS,
        createdAt: room.createdAt,
        isPrivate: room.isPrivate,
        isInGame: room.state === 'started',  // 게임 중인 방 표시
        difficulty: room.difficulty,  // 난이도
      };
    });
}

// 대기 방 상태 업데이트 (게임 종료 후 로비 복귀 시 사용)
export function setWaitingRoomState(roomId: string, state: 'waiting' | 'started'): void {
  const room = waitingCoopRooms.get(roomId);
  if (room) {
    room.state = state;
    console.log(`[Coop] 대기 방 상태 변경: ${room.code} → ${state}`);
    // 다른 대기 중인 클라이언트들에게 방 목록 업데이트 알림
    broadcastRoomListUpdate();
  }
}

// 대기 방 삭제 (방 파기 시 사용)
export function deleteWaitingRoom(roomId: string): void {
  const room = waitingCoopRooms.get(roomId);
  if (room) {
    console.log(`[Coop] 대기 방 삭제: ${room.code}`);
    coopRoomCodeMap.delete(room.code);
    waitingCoopRooms.delete(roomId);
    // 다른 대기 중인 클라이언트들에게 방 목록 업데이트 알림
    broadcastRoomListUpdate();
  }
}

// 대기 방 플레이어 동기화 (게임에서 플레이어가 나갔을 때)
export function syncWaitingRoomPlayers(roomId: string, playerIds: string[], playerInfos: any[]): void {
  const room = waitingCoopRooms.get(roomId);
  if (room) {
    // 현재 플레이어 목록 비우기
    room.players.clear();
    // 새 플레이어 목록으로 업데이트
    playerInfos.forEach((info: any) => {
      room.players.set(info.id, info);
    });
    // 호스트 업데이트
    const newHost = playerInfos.find((p: any) => p.isHost);
    if (newHost) {
      room.hostPlayerId = newHost.id;
    }
    console.log(`[Coop] 대기 방 플레이어 동기화: ${room.code} (${room.players.size}명)`);
    // 다른 대기 중인 클라이언트들에게 방 목록 업데이트 알림
    broadcastRoomListUpdate();
  }
}

// roomId로 협동 방 참가
export function joinCoopRoomById(
  roomId: string,
  playerId: string,
  playerName: string,
  heroClass: HeroClass,
  characterLevel: number = 1,
  statUpgrades?: CharacterStatUpgrades,
  advancedClass?: string,
  tier?: 1 | 2
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

  const room = waitingCoopRooms.get(roomId);
  if (!room) {
    sendToPlayer(playerId, { type: 'COOP_ROOM_ERROR', message: '존재하지 않는 방입니다.' });
    return false;
  }

  // 비밀방인 경우 직접 참가 불가 (초대 코드로만 참가 가능)
  if (room.isPrivate) {
    sendToPlayer(playerId, { type: 'COOP_ROOM_ERROR', message: '비밀방입니다. 초대 코드를 입력해주세요.' });
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
    characterLevel,
    statUpgrades,
    advancedClass,
    tier,
  };

  room.players.set(playerId, playerInfo);
  player.roomId = roomId;
  player.name = playerName;

  const playersArray = Array.from(room.players.values());
  const playerIndex = playersArray.findIndex(p => p.id === playerId);

  console.log(`[Coop] 방 참가(ID): ${room.code} (Player: ${playerName}, Class: ${heroClass})`);

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
    roomCode: room.code,
    players: playersArray,
    yourIndex: playerIndex,
    isPrivate: room.isPrivate,
    difficulty: room.difficulty,
  });

  // 채팅 히스토리 전송
  if (room.chatHistory.length > 0) {
    sendToPlayer(playerId, {
      type: 'LOBBY_CHAT_HISTORY',
      messages: room.chatHistory,
    });
  }

  // 다른 대기 중인 클라이언트들에게 방 목록 업데이트 알림 (인원 수 변경)
  broadcastRoomListUpdate();

  return true;
}

// 친구 초대로 비밀방 참가 (코드 없이 직접 입장)
export function joinCoopRoomByInvite(
  roomId: string,
  playerId: string,
  playerName: string,
  heroClass: HeroClass,
  characterLevel: number = 1,
  statUpgrades?: CharacterStatUpgrades,
  advancedClass?: string,
  tier?: 1 | 2
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

  const room = waitingCoopRooms.get(roomId);
  if (!room) {
    sendToPlayer(playerId, { type: 'COOP_ROOM_ERROR', message: '존재하지 않는 방입니다.' });
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

  // 참가 처리 (비밀방 체크 생략 - 초대로 입장)
  const playerInfo: CoopPlayerInfo = {
    id: playerId,
    name: playerName,
    heroClass,
    isHost: false,
    isReady: false,
    connected: true,
    characterLevel,
    statUpgrades,
    advancedClass,
    tier,
  };

  room.players.set(playerId, playerInfo);
  player.roomId = roomId;
  player.name = playerName;

  const playersArray = Array.from(room.players.values());
  const playerIndex = playersArray.findIndex(p => p.id === playerId);

  console.log(`[Coop] 방 참가(초대): ${room.code} (Player: ${playerName}, Class: ${heroClass})`);

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
    roomCode: room.code,
    players: playersArray,
    yourIndex: playerIndex,
    isPrivate: room.isPrivate,
    difficulty: room.difficulty,
  });

  // 채팅 히스토리 전송
  if (room.chatHistory.length > 0) {
    sendToPlayer(playerId, {
      type: 'LOBBY_CHAT_HISTORY',
      messages: room.chatHistory,
    });
  }

  // 다른 대기 중인 클라이언트들에게 방 목록 업데이트 알림 (인원 수 변경)
  broadcastRoomListUpdate();

  return true;
}

// 로비 채팅 메시지 전송
export function sendLobbyChatMessage(playerId: string, content: string): void {
  const player = players.get(playerId);
  if (!player || !player.roomId) {
    sendToPlayer(playerId, { type: 'LOBBY_CHAT_ERROR', message: '방에 참가하지 않았습니다.' });
    return;
  }

  const room = waitingCoopRooms.get(player.roomId);
  if (!room) {
    sendToPlayer(playerId, { type: 'LOBBY_CHAT_ERROR', message: '방을 찾을 수 없습니다.' });
    return;
  }

  // 게임 시작 후에는 채팅 불가
  if (room.state === 'started') {
    sendToPlayer(playerId, { type: 'LOBBY_CHAT_ERROR', message: '게임이 이미 시작되었습니다.' });
    return;
  }

  // 빈 메시지 체크
  const trimmedContent = content.trim();
  if (trimmedContent.length === 0) {
    sendToPlayer(playerId, { type: 'LOBBY_CHAT_ERROR', message: '메시지를 입력하세요.' });
    return;
  }

  // 메시지 길이 체크
  if (trimmedContent.length > CHAT_CONFIG.MAX_MESSAGE_LENGTH) {
    sendToPlayer(playerId, { type: 'LOBBY_CHAT_ERROR', message: `메시지가 너무 깁니다. (최대 ${CHAT_CONFIG.MAX_MESSAGE_LENGTH}자)` });
    return;
  }

  // 스팸 방지 - 최소 전송 간격 체크
  const now = Date.now();
  const lastTime = room.lastMessageTime.get(playerId) || 0;
  if (now - lastTime < CHAT_CONFIG.MIN_MESSAGE_INTERVAL) {
    sendToPlayer(playerId, { type: 'LOBBY_CHAT_ERROR', message: '너무 빠르게 메시지를 보내고 있습니다.' });
    return;
  }
  room.lastMessageTime.set(playerId, now);

  // 플레이어 정보 가져오기
  const playerInfo = room.players.get(playerId);
  if (!playerInfo) {
    sendToPlayer(playerId, { type: 'LOBBY_CHAT_ERROR', message: '플레이어 정보를 찾을 수 없습니다.' });
    return;
  }

  // 메시지 생성
  const message: LobbyChatMessage = {
    id: uuidv4(),
    playerId,
    playerName: playerInfo.name,
    content: trimmedContent,
    timestamp: now,
  };

  // 히스토리에 추가 (최대 크기 유지)
  room.chatHistory.push(message);
  if (room.chatHistory.length > CHAT_CONFIG.MAX_HISTORY_SIZE) {
    room.chatHistory.shift();
  }

  // 방의 모든 플레이어에게 브로드캐스트
  room.players.forEach((p, id) => {
    sendToPlayer(id, {
      type: 'LOBBY_CHAT_MESSAGE',
      message,
    });
  });

  console.log(`[Coop Chat] ${room.code} - ${playerInfo.name}: ${trimmedContent.substring(0, 30)}${trimmedContent.length > 30 ? '...' : ''}`);
}

// ============================================
// 방 자동 파기 시스템
// ============================================

// 오래된 대기 방 정리 (게임 시작 전 10분 초과 시 자동 파기)
function cleanupStaleRooms(): void {
  const now = Date.now();
  const staleRooms: string[] = [];
  const warningRooms: string[] = [];

  waitingCoopRooms.forEach((room, roomId) => {
    // 게임이 시작되지 않은 방만 체크 (waiting 또는 countdown 상태)
    if (room.state !== 'started') {
      const roomAge = now - room.createdAt;
      if (roomAge > ROOM_AUTO_DESTROY_CONFIG.TIMEOUT_MS) {
        staleRooms.push(roomId);
      } else if (roomAge > ROOM_AUTO_DESTROY_CONFIG.WARNING_MS && !room.timeoutWarningNotified) {
        // 9분 경과, 아직 경고 안 보낸 방
        warningRooms.push(roomId);
      }
    }
  });

  // 1분 전 경고 전송
  warningRooms.forEach((roomId) => {
    const room = waitingCoopRooms.get(roomId);
    if (room) {
      console.log(`[Coop] 방 타임아웃 경고 (1분 남음): ${room.code}`);
      room.timeoutWarningNotified = true;

      // 방에 있는 모든 플레이어에게 경고
      room.players.forEach((playerInfo, playerId) => {
        sendToPlayer(playerId, {
          type: 'COOP_ROOM_TIMEOUT_WARNING',
          message: '1분 후 게임을 시작하지 않으면 방이 자동으로 파기됩니다.',
          remainingSeconds: 60,
        });
      });
    }
  });

  // 오래된 방 파기
  staleRooms.forEach((roomId) => {
    const room = waitingCoopRooms.get(roomId);
    if (room) {
      console.log(`[Coop] 방 자동 파기 (10분 타임아웃): ${room.code}`);

      // 방에 있는 모든 플레이어에게 알림 및 방에서 내보내기
      room.players.forEach((playerInfo, playerId) => {
        const player = players.get(playerId);
        if (player) {
          player.roomId = null;
          player.isInGame = false;
        }
        // COOP_ROOM_DESTROYED: 플레이어를 로비로 돌려보내는 메시지
        sendToPlayer(playerId, {
          type: 'COOP_ROOM_DESTROYED',
          reason: 'timeout',
          message: '방이 10분간 게임을 시작하지 않아 자동으로 파기되었습니다.',
        });
      });

      // 방 초대 취소 및 삭제
      gameInviteManager.cancelRoomInvites(roomId);
      coopRoomCodeMap.delete(room.code);
      waitingCoopRooms.delete(roomId);
    }
  });

  // 방이 삭제되었으면 목록 업데이트
  if (staleRooms.length > 0) {
    broadcastRoomListUpdate();
  }
}

// 방 자동 파기 타이머 시작
let roomCleanupInterval: ReturnType<typeof setInterval> | null = null;

export function startRoomCleanupTimer(): void {
  if (roomCleanupInterval) {
    clearInterval(roomCleanupInterval);
  }
  roomCleanupInterval = setInterval(cleanupStaleRooms, ROOM_AUTO_DESTROY_CONFIG.CHECK_INTERVAL_MS);
  console.log('[Coop] 방 자동 파기 타이머 시작 (10분 타임아웃, 1분 간격 체크)');
}

export function stopRoomCleanupTimer(): void {
  if (roomCleanupInterval) {
    clearInterval(roomCleanupInterval);
    roomCleanupInterval = null;
    console.log('[Coop] 방 자동 파기 타이머 중지');
  }
}

// 서버 시작 시 자동으로 타이머 시작
startRoomCleanupTimer();
