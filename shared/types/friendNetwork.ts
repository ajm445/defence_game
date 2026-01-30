// 친구 시스템 네트워크 타입 정의

// ============================================
// 친구 정보
// ============================================

export interface FriendInfo {
  id: string;           // player_profiles.id
  name: string;         // 닉네임
  isOnline: boolean;    // 온라인 상태
  playerLevel: number;  // 플레이어 레벨
  currentRoom?: string; // 현재 접속 중인 방 ID (게임 중이면)
  lastSeen?: string;    // 마지막 접속 시간 (ISO 문자열)
}

// ============================================
// 온라인 플레이어 정보
// ============================================

export interface OnlinePlayerInfo {
  id: string;           // player_profiles.id
  name: string;         // 닉네임
  playerLevel: number;  // 플레이어 레벨
  isFriend: boolean;    // 친구 여부
  currentRoom?: string; // 현재 접속 중인 방 ID
}

// ============================================
// 친구 요청 정보
// ============================================

export interface FriendRequestInfo {
  id: string;           // friend_requests.id
  fromUserId: string;   // 보낸 사람 ID
  fromUserName: string; // 보낸 사람 닉네임
  fromUserLevel: number;// 보낸 사람 레벨
  toUserId: string;     // 받는 사람 ID
  toUserName: string;   // 받는 사람 닉네임
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;    // 요청 시간 (ISO 문자열)
}

// ============================================
// 게임 초대 정보
// ============================================

export interface GameInviteInfo {
  id: string;           // 초대 ID (서버 생성)
  fromUserId: string;   // 초대한 사람 ID
  fromUserName: string; // 초대한 사람 닉네임
  roomId: string;       // 방 ID
  roomCode: string;     // 방 코드
  isPrivate: boolean;   // 비밀방 여부
  createdAt: string;    // 초대 시간 (ISO 문자열)
  expiresAt: string;    // 만료 시간 (ISO 문자열)
}

// ============================================
// 서버 상태 정보
// ============================================

export interface ServerStatusInfo {
  onlinePlayers: number;  // 현재 접속자 수
  activeGames: number;    // 활성 게임 수
  waitingRooms: number;   // 대기 중인 방 수
}

// ============================================
// 클라이언트 → 서버 메시지
// ============================================

export type FriendClientMessage =
  // 친구 목록
  | { type: 'GET_FRIENDS_LIST' }
  | { type: 'GET_ONLINE_PLAYERS' }
  // 친구 요청
  | { type: 'SEND_FRIEND_REQUEST'; targetUserId: string }
  | { type: 'RESPOND_FRIEND_REQUEST'; requestId: string; accept: boolean }
  | { type: 'CANCEL_FRIEND_REQUEST'; requestId: string }
  // 친구 관리
  | { type: 'REMOVE_FRIEND'; friendId: string }
  // 게임 초대
  | { type: 'SEND_GAME_INVITE'; friendId: string; roomId: string }
  | { type: 'RESPOND_GAME_INVITE'; inviteId: string; accept: boolean }
  // 서버 상태
  | { type: 'GET_SERVER_STATUS' };

// ============================================
// 서버 → 클라이언트 메시지
// ============================================

export type FriendServerMessage =
  // 친구 목록
  | { type: 'FRIENDS_LIST'; friends: FriendInfo[] }
  | { type: 'ONLINE_PLAYERS_LIST'; players: OnlinePlayerInfo[] }
  // 친구 요청
  | { type: 'FRIEND_REQUEST_RECEIVED'; request: FriendRequestInfo }
  | { type: 'FRIEND_REQUEST_RESPONDED'; requestId: string; accepted: boolean; friendInfo?: FriendInfo }
  | { type: 'FRIEND_REQUEST_CANCELLED'; requestId: string }
  | { type: 'PENDING_FRIEND_REQUESTS'; requests: FriendRequestInfo[] }
  | { type: 'SENT_FRIEND_REQUESTS'; requests: FriendRequestInfo[] }
  // 친구 상태 변경
  | { type: 'FRIEND_STATUS_CHANGED'; friendId: string; isOnline: boolean; currentRoom?: string }
  | { type: 'FRIEND_REMOVED'; friendId: string }
  | { type: 'FRIEND_ADDED'; friend: FriendInfo }
  // 게임 초대
  | { type: 'GAME_INVITE_RECEIVED'; invite: GameInviteInfo }
  | { type: 'GAME_INVITE_ACCEPTED'; roomId: string; roomCode: string }
  | { type: 'GAME_INVITE_DECLINED'; inviteId: string }
  | { type: 'GAME_INVITE_EXPIRED'; inviteId: string }
  // 서버 상태
  | { type: 'SERVER_STATUS'; status: ServerStatusInfo }
  // 에러
  | { type: 'FRIEND_ERROR'; message: string };
