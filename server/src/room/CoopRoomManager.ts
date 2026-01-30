import { v4 as uuidv4 } from 'uuid';
import { players, sendToPlayer } from '../state/players';
import { addCoopRoom } from '../websocket/MessageHandler';
import { RPGCoopGameRoom } from '../game/RPGCoopGameRoom';
import type { HeroClass } from '../../../src/types/rpg';
import type { CoopPlayerInfo, COOP_CONFIG, WaitingCoopRoomInfo } from '../../../shared/types/rpgNetwork';
import type { CharacterStatUpgrades } from '../../../src/types/auth';

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
}

// 대기 중인 협동 방 저장소
const waitingCoopRooms = new Map<string, WaitingCoopRoom>();  // roomId -> WaitingCoopRoom
const coopRoomCodeMap = new Map<string, string>();            // code -> roomId

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
  }
}

// 대기 방 삭제 (방 파기 시 사용)
export function deleteWaitingRoom(roomId: string): void {
  const room = waitingCoopRooms.get(roomId);
  if (room) {
    console.log(`[Coop] 대기 방 삭제: ${room.code}`);
    coopRoomCodeMap.delete(room.code);
    waitingCoopRooms.delete(roomId);
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

  return true;
}
