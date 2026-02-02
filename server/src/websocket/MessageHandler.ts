import type { ClientMessage } from '../../../shared/types/network';
import { players, sendMessage, onlineUserIds, registerUserOnline, registerUserOffline, setOnlineStatusCallback, getPlayerByUserId, getLoggedInUserCount } from '../state/players';
import { createRoom, joinRoom, leaveRoom } from '../room/RoomManager';
import { verifyAdminToken } from '../middleware/adminAuth';
import { getSupabaseAdmin } from '../services/supabaseAdmin';
import {
  createCoopRoom,
  joinCoopRoom,
  joinCoopRoomById,
  joinCoopRoomByInvite,
  leaveCoopRoom,
  setCoopReady,
  changeCoopClass,
  kickCoopPlayer,
  updateCoopRoomSettings,
  startCoopGame,
  handleCoopPlayerDisconnect,
  getAllWaitingCoopRooms,
  getCoopRoomByPlayerId,
  sendLobbyChatMessage,
} from '../room/CoopRoomManager';
import { sendToPlayer } from '../state/players';
import { GameRoom } from '../game/GameRoom';
import { RPGCoopGameRoom } from '../game/RPGCoopGameRoom';
import { friendManager } from '../friend/FriendManager';
import { friendRequestHandler } from '../friend/FriendRequestHandler';
import { gameInviteManager } from '../friend/GameInviteManager';

// 게임 방 저장소
const gameRooms = new Map<string, GameRoom>();
const coopGameRooms = new Map<string, RPGCoopGameRoom>();

// 관리자 구독자 저장소
const adminSubscribers = new Set<string>();

// 관리자에게 이벤트 브로드캐스트
export function broadcastToAdmins(message: { type: string; [key: string]: unknown }): void {
  for (const adminId of adminSubscribers) {
    const player = players.get(adminId);
    if (player && player.ws.readyState === 1) {
      sendMessage(player.ws, message as any);
    }
  }
}

// 서버 상태 반환
export function getServerStatus() {
  return {
    currentOnline: players.size,           // WebSocket 연결 수
    loggedInUsers: getLoggedInUserCount(), // 로그인된 사용자 수
    activeGames: gameRooms.size + coopGameRooms.size,
    serverUptime: process.uptime(),
    memoryUsage: process.memoryUsage().heapUsed,
  };
}

// 친구 온라인 상태 알림 콜백 등록 (async로 처리하여 친구 알림 완료를 보장)
setOnlineStatusCallback(async (userId, isOnline, currentRoom) => {
  // 친구에게 상태 변경 알림
  await friendManager.notifyFriendsStatusChange(userId, isOnline, currentRoom);

  // 모든 온라인 플레이어에게 실시간 알림
  if (isOnline) {
    await friendManager.broadcastPlayerJoined(userId);
  } else {
    await friendManager.broadcastPlayerLeft(userId);
  }
});

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
      handleCreateCoopRoom(playerId, message.playerName, message.heroClass, message.characterLevel, message.statUpgrades, (message as any).isPrivate, (message as any).difficulty, (message as any).advancedClass, (message as any).tier);
      break;

    case 'JOIN_COOP_ROOM':
      handleJoinCoopRoom(playerId, message.roomCode, message.playerName, message.heroClass, message.characterLevel, message.statUpgrades, message.advancedClass, message.tier);
      break;

    case 'JOIN_COOP_ROOM_BY_ID':
      handleJoinCoopRoomById(playerId, (message as any).roomId, message.playerName, message.heroClass, message.characterLevel, message.statUpgrades, (message as any).advancedClass, (message as any).tier);
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
      handleChangeCoopClass(playerId, message.heroClass, message.characterLevel, message.statUpgrades, message.advancedClass, message.tier);
      break;

    case 'START_COOP_GAME':
      handleStartCoopGame(playerId);
      break;

    case 'KICK_COOP_PLAYER':
      handleKickCoopPlayer(playerId, message.playerId);
      break;

    case 'UPDATE_COOP_ROOM_SETTINGS':
      handleUpdateCoopRoomSettings(playerId, message.isPrivate, message.difficulty);
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

    // 관리자 WebSocket 메시지
    case 'ADMIN_SUBSCRIBE':
      handleAdminSubscribe(playerId, (message as any).token);
      break;

    case 'ADMIN_UNSUBSCRIBE':
      handleAdminUnsubscribe(playerId);
      break;

    case 'ADMIN_REQUEST_STATUS':
      handleAdminRequestStatus(playerId);
      break;

    // 친구 시스템 메시지
    case 'GET_FRIENDS_LIST':
      handleGetFriendsList(playerId);
      break;

    case 'GET_ONLINE_PLAYERS':
      handleGetOnlinePlayers(playerId);
      break;

    case 'SEND_FRIEND_REQUEST':
      handleSendFriendRequest(playerId, (message as any).targetUserId);
      break;

    case 'RESPOND_FRIEND_REQUEST':
      handleRespondFriendRequest(playerId, (message as any).requestId, (message as any).accept);
      break;

    case 'CANCEL_FRIEND_REQUEST':
      handleCancelFriendRequest(playerId, (message as any).requestId);
      break;

    case 'REMOVE_FRIEND':
      handleRemoveFriend(playerId, (message as any).friendId);
      break;

    case 'SEND_GAME_INVITE':
      handleSendGameInvite(playerId, (message as any).friendId, (message as any).roomId);
      break;

    case 'RESPOND_GAME_INVITE':
      handleRespondGameInvite(playerId, (message as any).inviteId, (message as any).accept);
      break;

    case 'GET_SERVER_STATUS':
      handleGetServerStatus(playerId);
      break;

    // 로비 채팅
    case 'LOBBY_CHAT_SEND':
      handleLobbyChatSend(playerId, (message as any).content);
      break;

    default:
      console.warn(`알 수 없는 메시지 타입: ${(message as any).type}`);
  }
}

// ============================================
// 사용자 인증 핸들러
// ============================================

async function handleUserLogin(playerId: string, userId: string, nickname: string, isGuest: boolean, level?: number): Promise<void> {
  const accountType = isGuest ? '게스트' : '일반';
  const levelInfo = level ? ` (Lv.${level})` : '';
  console.log(`[Auth] 로그인: ${nickname}${levelInfo} [${accountType}] (userId: ${userId}, playerId: ${playerId})`);

  const player = players.get(playerId);
  if (!player) return;

  // 중복 연결 처리: 같은 userId로 이미 연결된 플레이어가 있으면 새 로그인 거부
  if (!isGuest && userId) {
    const existingPlayer = getPlayerByUserId(userId);

    if (existingPlayer && existingPlayer.id !== playerId) {
      // 기존 연결이 실제로 활성 상태인지 확인
      if (existingPlayer.ws.readyState === 1) { // WebSocket.OPEN = 1
        console.log(`[Auth] 중복 로그인 거부: ${nickname} (기존 세션: ${existingPlayer.id})`);

        // 새 연결에 중복 로그인 알림 전송 후 종료
        sendMessage(player.ws, {
          type: 'DUPLICATE_LOGIN',
          message: '이미 다른 곳에서 로그인되어 있습니다. 기존 세션을 먼저 종료해주세요.',
        });

        // 클라이언트가 메시지를 처리할 시간을 주고 연결 종료
        setTimeout(() => {
          player.ws.close();
        }, 500);  // 500ms로 증가 (느린 연결 대응)
        return;
      } else {
        // 기존 연결이 비활성 상태면 정리 후 새 로그인 허용
        console.log(`[Auth] 비활성 기존 세션 정리: ${existingPlayer.id}`);

        // 기존 플레이어가 방에 있으면 먼저 방에서 제거 (오프라인 알림 전에 처리)
        if (existingPlayer.roomId) {
          const existingRoomId = existingPlayer.roomId;

          // 게임 방에서 제거
          const coopRoom = coopGameRooms.get(existingRoomId);
          if (coopRoom) {
            coopRoom.handlePlayerDisconnect(existingPlayer.id);
          }

          // 대기 방에서 제거
          leaveCoopRoom(existingPlayer.id);

          existingPlayer.roomId = null;
          existingPlayer.isInGame = false;
        }

        // 온라인 상태 해제 (친구에게 오프라인 알림) - 방 정리 후 호출
        if (existingPlayer.userId) {
          registerUserOffline(existingPlayer.userId);
        }

        // 기존 플레이어 정리
        existingPlayer.userId = null;
        players.delete(existingPlayer.id);
      }
    }
  }

  // 게스트가 아닌 경우 밴 상태 확인
  if (!isGuest) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        const { data: profile } = await supabase
          .from('player_profiles')
          .select('is_banned, banned_until')
          .eq('id', userId)
          .single();

        if (profile?.is_banned) {
          // 기간제 밴인 경우 만료 여부 확인
          if (profile.banned_until) {
            const bannedUntil = new Date(profile.banned_until);
            if (bannedUntil > new Date()) {
              // 아직 밴 기간 중 - 연결 끊기
              const formattedDate = bannedUntil.toLocaleString('ko-KR');
              sendMessage(player.ws, {
                type: 'BANNED',
                message: `계정이 정지되었습니다. 정지 해제일: ${formattedDate}`,
                bannedUntil: profile.banned_until,
              });
              console.log(`[Auth] 밴된 유저 접속 차단: ${nickname} (해제일: ${formattedDate})`);
              setTimeout(() => player.ws.close(), 100);
              return;
            } else {
              // 밴 기간 만료 - 자동 해제
              await supabase
                .from('player_profiles')
                .update({ is_banned: false, banned_until: null })
                .eq('id', userId);
              await supabase
                .from('player_bans')
                .update({ is_active: false })
                .eq('player_id', userId)
                .eq('is_active', true);
              console.log(`[Auth] 밴 기간 만료, 자동 해제: ${nickname}`);
            }
          } else {
            // 영구 밴 - 연결 끊기
            sendMessage(player.ws, {
              type: 'BANNED',
              message: '계정이 영구 정지되었습니다.',
              bannedUntil: null,
            });
            console.log(`[Auth] 영구 밴된 유저 접속 차단: ${nickname}`);
            setTimeout(() => player.ws.close(), 100);
            return;
          }
        }
      } catch (err) {
        console.error('[Auth] 밴 상태 확인 오류:', err);
      }
    }
  }

  // 플레이어 정보 업데이트
  player.name = nickname;
  player.userId = isGuest ? null : userId;

  // 온라인 사용자 목록에 추가 (게스트가 아닌 경우)
  if (!isGuest && userId) {
    registerUserOnline(userId);
  }

  // 관리자에게 로그인 이벤트 브로드캐스트
  broadcastToAdmins({
    type: 'ADMIN_PLAYER_ACTIVITY',
    activity: {
      type: 'connect',
      playerId,
      playerName: nickname,
      timestamp: new Date().toISOString(),
    },
  });
}

function handleUserLogout(playerId: string, userId: string, nickname: string): void {
  // 온라인 사용자 목록에서 제거 및 친구에게 알림
  if (userId) {
    registerUserOffline(userId);
  }

  const player = players.get(playerId);
  if (player) {
    player.userId = null;
  }
  console.log(`[Auth] 로그아웃: ${nickname} (userId: ${userId}, playerId: ${playerId})`);

  // 관리자에게 로그아웃 이벤트 브로드캐스트
  broadcastToAdmins({
    type: 'ADMIN_PLAYER_ACTIVITY',
    activity: {
      type: 'logout',
      playerId,
      playerName: nickname,
      timestamp: new Date().toISOString(),
    },
  });
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

// 난이도 이름 매핑
const DIFFICULTY_NAMES: Record<string, string> = {
  easy: '쉬움',
  normal: '중간',
  hard: '어려움',
  extreme: '극한',
};

function handleCreateCoopRoom(playerId: string, playerName: string, heroClass: any, characterLevel?: number, statUpgrades?: any, isPrivate?: boolean, difficulty?: string, advancedClass?: string, tier?: 1 | 2): void {
  const player = players.get(playerId);
  if (!player) return;

  const name = playerName || `Player_${playerId.slice(0, 4)}`;
  const roomType = isPrivate ? '비밀방' : '공개방';
  const difficultyName = DIFFICULTY_NAMES[difficulty ?? 'easy'] || '쉬움';
  console.log(`[Coop] ${name}(${playerId}) 방 생성 요청 (Lv.${characterLevel ?? 1}, 전직: ${advancedClass ?? '없음'}, ${roomType}, 난이도: ${difficultyName})`);
  createCoopRoom(playerId, name, heroClass, characterLevel ?? 1, statUpgrades, isPrivate ?? false, difficulty ?? 'easy', advancedClass, tier);
}

function handleJoinCoopRoom(playerId: string, roomCode: string, playerName: string, heroClass: any, characterLevel?: number, statUpgrades?: any, advancedClass?: string, tier?: 1 | 2): void {
  const player = players.get(playerId);
  if (!player) return;

  const name = playerName || `Player_${playerId.slice(0, 4)}`;
  console.log(`[Coop] ${name}(${playerId}) 방 참가 요청: ${roomCode} (Lv.${characterLevel ?? 1}, 전직: ${advancedClass ?? '없음'})`);
  joinCoopRoom(roomCode, playerId, name, heroClass, characterLevel ?? 1, statUpgrades, advancedClass, tier);
}

function handleJoinCoopRoomById(playerId: string, roomId: string, playerName: string, heroClass: any, characterLevel?: number, statUpgrades?: any, advancedClass?: string, tier?: 1 | 2): void {
  const player = players.get(playerId);
  if (!player) return;

  const name = playerName || `Player_${playerId.slice(0, 4)}`;
  console.log(`[Coop] ${name}(${playerId}) 방 참가 요청(ID): ${roomId} (Lv.${characterLevel ?? 1}, 전직: ${advancedClass ?? '없음'})`);
  joinCoopRoomById(roomId, playerId, name, heroClass, characterLevel ?? 1, statUpgrades, advancedClass, tier);
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
      // 로비 상태면 호스트 위임 처리 (대기방처럼 동작)
      if (gameRoom.isInLobby()) {
        console.log(`[Coop] 로비 상태에서 플레이어 퇴장: ${roomId}`);
        gameRoom.transferHostAndLeave(playerId);
        if (player) player.roomId = null;
        return;
      }

      // 게임 중/종료 상태에서 호스트가 나가면 방 파기
      if (gameRoom.isHost(playerId)) {
        console.log(`[Coop] 호스트가 게임 중 나가기 - 방 파기: ${roomId}`);
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

function handleChangeCoopClass(playerId: string, heroClass: any, characterLevel?: number, statUpgrades?: any, advancedClass?: string, tier?: 1 | 2): void {
  console.log(`[Coop] ${playerId} 직업 변경: ${heroClass} (Lv.${characterLevel ?? 1}, 전직: ${advancedClass ?? '없음'}, 강화: ${tier ?? 1}차)`);

  // 먼저 대기 중인 방에서 찾기
  changeCoopClass(playerId, heroClass, characterLevel ?? 1, statUpgrades, advancedClass, tier);

  // 게임 방에서도 찾기 (게임 종료 후 로비 복귀 시)
  const player = players.get(playerId);
  if (player && player.roomId) {
    const room = coopGameRooms.get(player.roomId);
    if (room) {
      room.changePlayerClass(playerId, heroClass, characterLevel ?? 1, statUpgrades, advancedClass, tier);
    }
  }
}

function handleStartCoopGame(playerId: string): void {
  console.log(`[Coop] ${playerId} 게임 시작 요청`);

  const player = players.get(playerId);
  const playerName = player?.name || `Player_${playerId.slice(0, 4)}`;

  // 대기 중인 방에 있는지 확인
  const waitingRoom = getCoopRoomByPlayerId(playerId);

  if (waitingRoom) {
    // 대기 중인 방에서 첫 게임 시작
    console.log(`[Coop] 대기 방에서 게임 시작: ${waitingRoom.code}`);
    startCoopGame(playerId);

    // 관리자에게 게임 시작 이벤트 브로드캐스트
    broadcastToAdmins({
      type: 'ADMIN_PLAYER_ACTIVITY',
      activity: {
        type: 'game_start',
        playerId,
        playerName,
        timestamp: new Date().toISOString(),
      },
    });
    broadcastToAdmins({
      type: 'ADMIN_SERVER_STATUS',
      status: getServerStatus(),
    });
  } else {
    // 게임 방에서 재시작 (게임 종료 후 로비 복귀 시)
    if (player && player.roomId) {
      const room = coopGameRooms.get(player.roomId);
      if (room) {
        console.log(`[Coop] 게임 방에서 재시작: ${room.roomCode}`);
        room.restartGame(playerId);

        // 관리자에게 게임 시작 이벤트 브로드캐스트
        broadcastToAdmins({
          type: 'ADMIN_PLAYER_ACTIVITY',
          activity: {
            type: 'game_start',
            playerId,
            playerName,
            timestamp: new Date().toISOString(),
          },
        });
        broadcastToAdmins({
          type: 'ADMIN_SERVER_STATUS',
          status: getServerStatus(),
        });
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

function handleUpdateCoopRoomSettings(hostPlayerId: string, isPrivate?: boolean, difficulty?: string): void {
  updateCoopRoomSettings(hostPlayerId, isPrivate, difficulty);
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

    // 관리자에게 게임 종료 이벤트 브로드캐스트
    const playerName = player?.name || `Player_${playerId.slice(0, 4)}`;
    broadcastToAdmins({
      type: 'ADMIN_PLAYER_ACTIVITY',
      activity: {
        type: 'game_end',
        playerId,
        playerName,
        timestamp: new Date().toISOString(),
      },
    });
    broadcastToAdmins({
      type: 'ADMIN_SERVER_STATUS',
      status: getServerStatus(),
    });
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

// ============================================
// 관리자 WebSocket 핸들러
// ============================================

function handleAdminSubscribe(playerId: string, token: string): void {
  const player = players.get(playerId);
  if (!player) return;

  // 토큰 검증
  const payload = verifyAdminToken(token);
  if (!payload) {
    sendMessage(player.ws, {
      type: 'ADMIN_ERROR',
      error: 'Invalid or expired token',
    });
    return;
  }

  adminSubscribers.add(playerId);
  console.log(`[Admin] Subscribed: ${payload.username} (${playerId})`);

  sendMessage(player.ws, {
    type: 'ADMIN_SUBSCRIBED',
    adminId: payload.adminId,
  });

  // 현재 서버 상태 전송
  sendMessage(player.ws, {
    type: 'ADMIN_SERVER_STATUS',
    status: getServerStatus(),
  });
}

function handleAdminUnsubscribe(playerId: string): void {
  adminSubscribers.delete(playerId);
  console.log(`[Admin] Unsubscribed: ${playerId}`);
}

function handleAdminRequestStatus(playerId: string): void {
  const player = players.get(playerId);
  if (!player || !adminSubscribers.has(playerId)) return;

  sendMessage(player.ws, {
    type: 'ADMIN_SERVER_STATUS',
    status: getServerStatus(),
  });
}

// 플레이어 연결 해제 시 관리자 구독 해제
export function handleAdminDisconnect(playerId: string): void {
  adminSubscribers.delete(playerId);
}

// ============================================
// 친구 시스템 핸들러
// ============================================

async function handleGetFriendsList(playerId: string): Promise<void> {
  const player = players.get(playerId);
  if (!player || !player.userId) {
    sendToPlayer(playerId, { type: 'FRIEND_ERROR', message: '로그인이 필요합니다.' });
    return;
  }

  const friends = await friendManager.getFriendsList(player.userId);
  const pendingRequests = await friendRequestHandler.getPendingRequests(player.userId);
  const sentRequests = await friendRequestHandler.getSentRequests(player.userId);

  sendToPlayer(playerId, { type: 'FRIENDS_LIST', friends });
  sendToPlayer(playerId, { type: 'PENDING_FRIEND_REQUESTS', requests: pendingRequests });
  sendToPlayer(playerId, { type: 'SENT_FRIEND_REQUESTS', requests: sentRequests });
}

async function handleGetOnlinePlayers(playerId: string): Promise<void> {
  const player = players.get(playerId);
  if (!player || !player.userId) {
    sendToPlayer(playerId, { type: 'FRIEND_ERROR', message: '로그인이 필요합니다.' });
    return;
  }

  const onlinePlayers = await friendManager.getOnlinePlayers(player.userId);
  sendToPlayer(playerId, { type: 'ONLINE_PLAYERS_LIST', players: onlinePlayers });
}

async function handleSendFriendRequest(playerId: string, targetUserId: string): Promise<void> {
  const player = players.get(playerId);
  if (!player || !player.userId) {
    sendToPlayer(playerId, { type: 'FRIEND_ERROR', message: '로그인이 필요합니다.' });
    return;
  }

  const result = await friendRequestHandler.sendFriendRequest(player.userId, targetUserId);
  if (!result.success) {
    sendToPlayer(playerId, { type: 'FRIEND_ERROR', message: result.message });
  }
  // 성공 시 요청 받은 사람에게 자동으로 알림이 전송됨 (FriendRequestHandler에서 처리)
}

async function handleRespondFriendRequest(playerId: string, requestId: string, accept: boolean): Promise<void> {
  const player = players.get(playerId);
  if (!player || !player.userId) {
    sendToPlayer(playerId, { type: 'FRIEND_ERROR', message: '로그인이 필요합니다.' });
    return;
  }

  const result = await friendRequestHandler.respondFriendRequest(requestId, accept, player.userId);
  if (!result.success) {
    sendToPlayer(playerId, { type: 'FRIEND_ERROR', message: result.message });
  } else if (accept) {
    // 수락 시 양쪽 모두에게 친구 목록 갱신
    const friends = await friendManager.getFriendsList(player.userId);
    sendToPlayer(playerId, { type: 'FRIENDS_LIST', friends });
  }
}

async function handleCancelFriendRequest(playerId: string, requestId: string): Promise<void> {
  const player = players.get(playerId);
  if (!player || !player.userId) {
    sendToPlayer(playerId, { type: 'FRIEND_ERROR', message: '로그인이 필요합니다.' });
    return;
  }

  const result = await friendRequestHandler.cancelFriendRequest(requestId, player.userId);
  if (!result.success) {
    sendToPlayer(playerId, { type: 'FRIEND_ERROR', message: result.message });
  }
}

async function handleRemoveFriend(playerId: string, friendId: string): Promise<void> {
  const player = players.get(playerId);
  if (!player || !player.userId) {
    sendToPlayer(playerId, { type: 'FRIEND_ERROR', message: '로그인이 필요합니다.' });
    return;
  }

  const success = await friendManager.removeFriend(player.userId, friendId);
  if (!success) {
    sendToPlayer(playerId, { type: 'FRIEND_ERROR', message: '친구 삭제에 실패했습니다.' });
  } else {
    sendToPlayer(playerId, { type: 'FRIEND_REMOVED', friendId });
  }
}

async function handleSendGameInvite(playerId: string, friendId: string, roomId: string): Promise<void> {
  const player = players.get(playerId);
  if (!player || !player.userId) {
    sendToPlayer(playerId, { type: 'FRIEND_ERROR', message: '로그인이 필요합니다.' });
    return;
  }

  if (!player.roomId) {
    sendToPlayer(playerId, { type: 'FRIEND_ERROR', message: '방에 입장한 상태에서만 초대할 수 있습니다.' });
    return;
  }

  // 방 정보 조회
  const waitingRoom = getCoopRoomByPlayerId(playerId);
  const gameRoom = coopGameRooms.get(player.roomId);

  let roomCode = '';
  let isPrivate = false;

  if (waitingRoom) {
    roomCode = waitingRoom.code;
    isPrivate = waitingRoom.isPrivate;
  } else if (gameRoom) {
    roomCode = gameRoom.roomCode;
    isPrivate = gameRoom.isPrivate;
  } else {
    sendToPlayer(playerId, { type: 'FRIEND_ERROR', message: '방 정보를 찾을 수 없습니다.' });
    return;
  }

  const result = await gameInviteManager.sendInvite(
    player.userId,
    friendId,
    player.roomId,
    roomCode,
    isPrivate
  );

  if (!result.success) {
    sendToPlayer(playerId, { type: 'FRIEND_ERROR', message: result.message });
  }
}

async function handleRespondGameInvite(playerId: string, inviteId: string, accept: boolean): Promise<void> {
  const player = players.get(playerId);
  if (!player || !player.userId) {
    sendToPlayer(playerId, { type: 'FRIEND_ERROR', message: '로그인이 필요합니다.' });
    return;
  }

  const result = await gameInviteManager.respondInvite(inviteId, accept, player.userId);

  if (!result.success) {
    sendToPlayer(playerId, { type: 'FRIEND_ERROR', message: result.message });
    return;
  }

  if (accept && result.roomId && result.roomCode) {
    // 초대 수락 시 방 정보 전송 - 클라이언트에서 입장 처리
    sendToPlayer(playerId, {
      type: 'GAME_INVITE_ACCEPTED',
      roomId: result.roomId,
      roomCode: result.roomCode,
    });
  }
}

function handleGetServerStatus(playerId: string): void {
  const waitingRooms = getAllWaitingCoopRooms();
  const status = {
    onlinePlayers: players.size,
    activeGames: coopGameRooms.size,
    waitingRooms: waitingRooms.filter(r => !r.isInGame).length,
  };
  sendToPlayer(playerId, { type: 'SERVER_STATUS', status });
}

// ============================================
// 로비 채팅 핸들러
// ============================================

function handleLobbyChatSend(playerId: string, content: string): void {
  sendLobbyChatMessage(playerId, content);
}
