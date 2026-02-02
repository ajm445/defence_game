# 친구 시스템

> 친구 목록, 온라인 상태, 게임 초대, 비밀방 초대 기능을 제공하는 소셜 시스템

---

## 목차

1. [개요](#개요)
2. [기능 목록](#기능-목록)
3. [데이터베이스 스키마](#데이터베이스-스키마)
4. [WebSocket 메시지](#websocket-메시지)
5. [백엔드 구조](#백엔드-구조)
6. [프론트엔드 구조](#프론트엔드-구조)
7. [주요 흐름](#주요-흐름)
8. [파일 구조](#파일-구조)
9. [설정 및 환경](#설정-및-환경)

---

## 개요

친구 시스템은 플레이어 간 소셜 상호작용을 지원합니다:

| 기능 | 설명 |
|------|------|
| 친구 목록 | 친구 목록 표시, 온라인/오프라인 상태 확인 |
| 온라인 플레이어 | 현재 서버에 접속한 플레이어 목록 |
| 게임 모드 표시 | 온라인 플레이어가 이용 중인 모드 표시 (RTS/RPG) |
| 친구 요청 | 친구 추가 요청 보내기/받기/수락/거절 |
| 게임 초대 | 친구에게 방 초대 보내기 |
| 비밀방 초대 | 친구는 코드 없이 초대 수락으로 비밀방 입장 |
| 서버 상태 | 현재 접속자 수, 활성 게임 수, 대기방 수 표시 |

---

## 기능 목록

### 친구 관리

| 기능 | 설명 |
|------|------|
| 친구 목록 조회 | 온라인 상태 포함한 친구 목록 |
| 친구 요청 보내기 | 온라인 플레이어에게 친구 요청 |
| 친구 요청 수락/거절 | 받은 요청에 대한 응답 |
| 친구 요청 취소 | 보낸 요청 취소 |
| 친구 삭제 | 친구 관계 해제 |

### 게임 초대

| 기능 | 설명 |
|------|------|
| 초대 보내기 | 대기방에서 친구에게 초대 |
| 초대 수락 | 초대 수락 시 자동으로 방 참가 |
| 초대 거절 | 초대 거절 |
| 초대 만료 | 5분 후 자동 만료 |
| 비밀방 입장 | 초대를 통해 코드 없이 비밀방 입장 |

### 서버 상태

| 항목 | 설명 |
|------|------|
| 온라인 플레이어 | 현재 접속 중인 플레이어 수 |
| 활성 게임 | 진행 중인 게임 수 |
| 대기방 | 참가 가능한 대기방 수 |

### 게임 모드 표시

온라인 플레이어 목록에서 각 플레이어가 이용 중인 게임 모드가 표시됩니다.

| 상태 | 표시 | 색상 |
|------|------|------|
| RTS 모드 | `RTS` | 청록색 (neon-cyan) |
| RPG 모드 | `RPG` | 보라색 (neon-purple) |
| 게임 중 | `게임중` | 노란색 |
| 모드 미선택 | 미표시 | - |

**우선순위**: 게임 중 > 게임 모드 > 미표시

---

## 데이터베이스 스키마

### friends 테이블

친구 관계를 저장합니다 (양방향 레코드).

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | 기본키 |
| user_id | UUID | 사용자 ID (FK → player_profiles) |
| friend_id | UUID | 친구 ID (FK → player_profiles) |
| created_at | TIMESTAMP | 친구 추가 시간 |

**제약조건:**
- `UNIQUE(user_id, friend_id)` - 중복 친구 관계 방지
- 친구 추가 시 양방향 레코드 생성 (A→B, B→A)

### friend_requests 테이블

친구 요청을 저장합니다.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | 기본키 |
| from_user_id | UUID | 요청 보낸 사용자 (FK) |
| to_user_id | UUID | 요청 받은 사용자 (FK) |
| status | VARCHAR(20) | 'pending', 'accepted', 'rejected' |
| created_at | TIMESTAMP | 요청 생성 시간 |
| responded_at | TIMESTAMP | 응답 시간 |

**제약조건:**
- `UNIQUE(from_user_id, to_user_id)` - 중복 요청 방지

### 인덱스

```sql
CREATE INDEX idx_friends_user_id ON friends(user_id);
CREATE INDEX idx_friends_friend_id ON friends(friend_id);
CREATE INDEX idx_friend_requests_to_user ON friend_requests(to_user_id, status);
CREATE INDEX idx_friend_requests_from_user ON friend_requests(from_user_id);
```

### RLS 정책

| 테이블 | 정책 | 설명 |
|--------|------|------|
| friends | SELECT | 자신의 친구 관계만 조회 |
| friends | DELETE | 자신이 포함된 관계만 삭제 |
| friends | INSERT | 자신이 user_id인 경우만 삽입 |
| friend_requests | SELECT | 자신이 보낸/받은 요청만 조회 |
| friend_requests | INSERT | 자신이 보낸 요청만 삽입 |
| friend_requests | UPDATE | 받은 요청만 상태 업데이트 |
| friend_requests | DELETE | 보낸 요청만 삭제 (취소) |

### 마이그레이션 적용

```bash
# Supabase 대시보드에서 SQL 실행
# 또는 supabase CLI 사용
supabase db push
```

마이그레이션 파일: `supabase/migrations/008_create_friends_tables.sql`

---

## WebSocket 메시지

### 클라이언트 → 서버

| 메시지 타입 | 필드 | 설명 |
|------------|------|------|
| `GET_FRIENDS_LIST` | - | 친구 목록 요청 |
| `GET_ONLINE_PLAYERS` | - | 온라인 플레이어 목록 요청 |
| `SEND_FRIEND_REQUEST` | `targetUserId` | 친구 요청 보내기 |
| `RESPOND_FRIEND_REQUEST` | `requestId`, `accept` | 요청 수락/거절 |
| `CANCEL_FRIEND_REQUEST` | `requestId` | 요청 취소 |
| `REMOVE_FRIEND` | `friendId` | 친구 삭제 |
| `SEND_GAME_INVITE` | `friendId`, `roomId` | 게임 초대 |
| `RESPOND_GAME_INVITE` | `inviteId`, `accept` | 초대 응답 |
| `GET_SERVER_STATUS` | - | 서버 상태 요청 |
| `CHANGE_GAME_MODE` | `gameMode` | 게임 모드 변경 알림 (`'rts'`, `'rpg'`, `null`) |

### 서버 → 클라이언트

| 메시지 타입 | 필드 | 설명 |
|------------|------|------|
| `FRIENDS_LIST` | `friends[]` | 친구 목록 |
| `ONLINE_PLAYERS_LIST` | `players[]` | 온라인 플레이어 목록 |
| `PENDING_FRIEND_REQUESTS` | `requests[]` | 받은 요청 목록 |
| `SENT_FRIEND_REQUESTS` | `requests[]` | 보낸 요청 목록 |
| `FRIEND_REQUEST_RECEIVED` | `request` | 새 친구 요청 알림 |
| `FRIEND_REQUEST_RESPONDED` | `requestId`, `accepted`, `friendInfo?` | 요청 응답 알림 |
| `FRIEND_REQUEST_CANCELLED` | `requestId` | 요청 취소 알림 |
| `FRIEND_ADDED` | `friend` | 친구 추가됨 |
| `FRIEND_REMOVED` | `friendId` | 친구 삭제됨 |
| `FRIEND_STATUS_CHANGED` | `friendId`, `isOnline`, `currentRoom?` | 친구 상태 변경 (친구 탭) |
| `ONLINE_PLAYER_JOINED` | `player` | 플레이어 접속 (온라인 탭 실시간) |
| `ONLINE_PLAYER_LEFT` | `playerId` | 플레이어 접속 해제 (온라인 탭 실시간) |
| `PLAYER_MODE_CHANGED` | `playerId`, `gameMode` | 플레이어 게임 모드 변경 |
| `GAME_INVITE_RECEIVED` | `invite` | 게임 초대 수신 |
| `GAME_INVITE_ACCEPTED` | `roomId`, `roomCode` | 초대 수락됨 (자동 입장용) |
| `GAME_INVITE_DECLINED` | `inviteId` | 초대 거절됨 |
| `GAME_INVITE_EXPIRED` | `inviteId` | 초대 만료됨 |
| `SERVER_STATUS` | `status` | 서버 상태 정보 |
| `FRIEND_ERROR` | `message` | 에러 메시지 |

---

## 백엔드 구조

### FriendManager

친구 관계를 관리하는 싱글톤 클래스입니다.

```typescript
class FriendManager {
  // 친구 목록 조회 (온라인 상태 포함)
  async getFriendsList(userId: string): Promise<FriendInfo[]>

  // 온라인 플레이어 목록 (친구 여부 표시)
  async getOnlinePlayers(userId: string): Promise<OnlinePlayerInfo[]>

  // 친구 여부 확인
  async areFriends(userId1: string, userId2: string): Promise<boolean>

  // 친구 관계 추가 (양방향)
  async addFriendship(userId1: string, userId2: string): Promise<void>

  // 친구 삭제 (양방향 삭제, 하나라도 실패 시 전체 실패)
  async removeFriend(userId: string, friendId: string): Promise<boolean>

  // 친구들에게 상태 변경 알림 (친구 탭용)
  async notifyFriendsStatusChange(userId: string, isOnline: boolean, currentRoom?: string): Promise<void>

  // 모든 온라인 플레이어에게 접속 알림 (온라인 탭 실시간 업데이트)
  async broadcastPlayerJoined(userId: string): Promise<void>

  // 모든 온라인 플레이어에게 접속 해제 알림 (온라인 탭 실시간 업데이트)
  async broadcastPlayerLeft(userId: string): Promise<void>
}
```

### FriendRequestHandler

친구 요청을 처리하는 싱글톤 클래스입니다.

```typescript
class FriendRequestHandler {
  // 친구 요청 보내기
  async sendFriendRequest(fromUserId: string, toUserId: string): Promise<Result>

  // 요청 응답 (수락/거절)
  async respondFriendRequest(requestId: string, accept: boolean, userId: string): Promise<Result>

  // 요청 취소
  async cancelFriendRequest(requestId: string, userId: string): Promise<boolean>

  // 대기 중인 요청 조회
  async getPendingRequests(userId: string): Promise<FriendRequestInfo[]>

  // 보낸 요청 조회
  async getSentRequests(userId: string): Promise<FriendRequestInfo[]>
}
```

### GameInviteManager

게임 초대를 관리하는 싱글톤 클래스입니다 (메모리 내 저장).

```typescript
class GameInviteManager {
  // 초대 보내기 (5분 TTL)
  async sendInvite(fromUserId: string, toUserId: string, roomId: string): Promise<Result>

  // 초대 응답
  async respondInvite(inviteId: string, accept: boolean, userId: string): Promise<Result>

  // 초대 유효성 확인
  isValidInvite(inviteId: string): boolean

  // 만료된 초대 정리 (1분마다 자동 실행)
  cleanExpiredInvites(): void

  // 사용자의 모든 초대 취소
  cancelUserInvites(userId: string): void

  // 방의 모든 초대 취소
  cancelRoomInvites(roomId: string): void
}
```

**초대 TTL:** 5분 (300,000ms)

**자동 정리:**
- 플레이어 연결 종료 시 해당 플레이어가 보낸 모든 초대 자동 취소
- 방 파기 시 해당 방의 모든 초대 자동 취소
- 1분마다 만료된 초대 자동 정리
- 서버 종료 시 정리 타이머 cleanup

---

## 프론트엔드 구조

### useFriendStore (Zustand)

친구 시스템 상태를 관리합니다.

```typescript
interface FriendState {
  // 상태
  friends: FriendInfo[];
  onlinePlayers: OnlinePlayerInfo[];
  pendingRequests: FriendRequestInfo[];
  sentRequests: FriendRequestInfo[];
  receivedInvites: GameInviteInfo[];
  serverStatus: ServerStatusInfo | null;
  error: string | null;
  isFriendPanelOpen: boolean;

  // 액션
  setFriends(friends: FriendInfo[]): void;
  addFriend(friend: FriendInfo): void;
  removeFriend(friendId: string): void;
  updateFriendStatus(friendId: string, isOnline: boolean, currentRoom?: string): void;

  // 온라인 플레이어 실시간 업데이트
  addOnlinePlayer(player: OnlinePlayerInfo): void;
  removeOnlinePlayer(playerId: string): void;
  updateOnlinePlayerMode(playerId: string, gameMode: 'rts' | 'rpg' | null): void;
  // ... 기타 액션
}
```

### 컴포넌트

| 컴포넌트 | 설명 |
|----------|------|
| `FriendPanel` | 친구 패널 (친구/온라인/요청 탭) |
| `FriendRequestNotification` | 친구 요청 알림 토스트 |
| `GameInviteNotification` | 게임 초대 알림 토스트 |
| `ServerStatusBar` | 서버 상태 표시 바 |

### FriendPanel 탭

| 탭 | 내용 |
|----|------|
| 친구 | 친구 목록, 온라인 상태, 게임 초대 버튼 |
| 온라인 | 서버 접속자 목록, 친구 추가 버튼 |
| 요청 | 받은 요청 (수락/거절), 보낸 요청 (취소) |

### useFriendMessages 훅

WebSocket 메시지를 처리하여 스토어를 업데이트합니다.

```typescript
function useFriendMessages() {
  useEffect(() => {
    const handleMessage = (message: any) => {
      switch (message.type) {
        case 'FRIENDS_LIST':
          setFriends(message.friends);
          break;
        case 'FRIEND_REQUEST_RECEIVED':
          addPendingRequest(message.request);
          break;
        // 온라인 플레이어 실시간 업데이트
        case 'ONLINE_PLAYER_JOINED':
          addOnlinePlayer(message.player);
          break;
        case 'ONLINE_PLAYER_LEFT':
          removeOnlinePlayer(message.playerId);
          break;
        case 'PLAYER_MODE_CHANGED':
          updateOnlinePlayerMode(message.playerId, message.gameMode);
          break;
        // ... 기타 메시지 처리
      }
    };

    const unsubscribe = wsClient.addMessageHandler(handleMessage);
    return () => unsubscribe();
  }, []);
}
```

---

## 주요 흐름

### 친구 요청 흐름

```
1. A가 B에게 친구 요청
   A → Server: SEND_FRIEND_REQUEST { targetUserId: B }
   Server: friend_requests 테이블에 저장
   Server → B: FRIEND_REQUEST_RECEIVED { request }
   Server → A: SENT_FRIEND_REQUESTS 업데이트

2. B가 요청 수락
   B → Server: RESPOND_FRIEND_REQUEST { requestId, accept: true }
   Server: friend_requests 상태 업데이트
   Server: friends 테이블에 양방향 레코드 생성
   Server → A: FRIEND_REQUEST_RESPONDED { accepted: true, friendInfo }
   Server → A, B: FRIENDS_LIST 업데이트
```

### 게임 초대 흐름

```
1. A가 B에게 게임 초대 (A는 대기방에 있음)
   A → Server: SEND_GAME_INVITE { friendId: B, roomId }
   Server: 친구 관계 확인
   Server: 메모리에 초대 저장 (5분 TTL)
   Server → B: GAME_INVITE_RECEIVED { invite }

2. B가 초대 수락
   B → Server: RESPOND_GAME_INVITE { inviteId, accept: true }
   Server: 초대 유효성 확인
   Server → A: GAME_INVITE_ACCEPTED (알림용)
   Server → B: GAME_INVITE_ACCEPTED { roomId, roomCode }
   B 클라이언트: 자동으로 방 참가 (joinRoomByInvite)
```

### 비밀방 초대 입장

```
1. A가 비밀방 생성
2. A가 친구 B에게 초대
3. B가 초대 수락
4. B는 roomCode 없이 자동으로 비밀방 입장
   - 서버에서 초대 유효성 검증 완료
   - joinCoopRoom 호출 시 정상 입장
```

### 온라인 상태 변경 알림

온라인 상태 변경은 두 가지 채널로 실시간 알림됩니다:

1. **친구 탭**: `FRIEND_STATUS_CHANGED` - 친구에게만 전송
2. **온라인 탭**: `ONLINE_PLAYER_JOINED/LEFT` - 모든 온라인 플레이어에게 전송

```
1. 사용자 A 로그인
   Server: registerUserOnline(A)
   Server: 콜백 실행
     → A의 친구들에게 FRIEND_STATUS_CHANGED { isOnline: true }
     → 모든 온라인 플레이어에게 ONLINE_PLAYER_JOINED { player: A정보 }

2. 사용자 A 로그아웃/연결 해제
   Server: registerUserOffline(A)
   Server: 콜백 실행
     → A의 친구들에게 FRIEND_STATUS_CHANGED { isOnline: false }
     → 모든 온라인 플레이어에게 ONLINE_PLAYER_LEFT { playerId: A }

3. 사용자 A 방 입장/퇴장
   Server: notifyUserRoomChange(A, roomCode)
   Server: A의 친구들에게 FRIEND_STATUS_CHANGED { currentRoom }
```

**안전망**: 클라이언트는 5초마다 폴링하여 누락된 상태를 복구합니다.

### 게임 모드 변경 알림

플레이어가 게임 모드를 선택하면 서버에 알림이 전송됩니다.

```
1. 사용자 A가 RTS 모드 선택
   A → Server: CHANGE_GAME_MODE { gameMode: 'rts' }
   Server: 플레이어 상태 업데이트
   Server: 로그 출력 "[Mode] 모드 변경: A → RTS 모드"
   Server → 모든 온라인 플레이어: PLAYER_MODE_CHANGED { playerId: A, gameMode: 'rts' }

2. 사용자 A가 RPG 모드 선택
   A → Server: CHANGE_GAME_MODE { gameMode: 'rpg' }
   Server: 플레이어 상태 업데이트
   Server: 로그 출력 "[Mode] 모드 변경: A → RPG 모드"
   Server → 모든 온라인 플레이어: PLAYER_MODE_CHANGED { playerId: A, gameMode: 'rpg' }

3. 사용자 A가 메인 메뉴로 복귀
   A → Server: CHANGE_GAME_MODE { gameMode: null }
   Server: 플레이어 상태 업데이트
   Server: 로그 출력 "[Mode] 모드 변경: A → 메인 모드"
   Server → 모든 온라인 플레이어: PLAYER_MODE_CHANGED { playerId: A, gameMode: null }
```

**서버 로그 형식**: `[Mode] 모드 변경: {닉네임} → {모드} 모드`

---

## 파일 구조

### 공유 타입 (`shared/types/`)

```
shared/types/
└── friendNetwork.ts    # 친구 시스템 타입 정의
    ├── GameMode              # 게임 모드 타입 ('rts' | 'rpg' | null)
    ├── FriendInfo
    ├── OnlinePlayerInfo      # gameMode 필드 포함
    ├── FriendRequestInfo
    ├── GameInviteInfo
    ├── ServerStatusInfo
    ├── FriendClientMessage
    └── FriendServerMessage
```

### 백엔드 (`server/src/`)

```
server/src/
├── friend/
│   ├── FriendManager.ts         # 친구 관계 관리
│   ├── FriendRequestHandler.ts  # 친구 요청 처리
│   └── GameInviteManager.ts     # 게임 초대 관리
├── websocket/
│   └── MessageHandler.ts        # 메시지 핸들러 (친구 메시지 추가)
├── room/
│   └── CoopRoomManager.ts       # 초대 입장 함수 추가
└── state/
    └── players.ts               # 온라인 상태 콜백, 게임 모드 관리
```

### 프론트엔드 (`src/`)

```
src/
├── stores/
│   └── useFriendStore.ts        # 친구 상태 관리
├── hooks/
│   ├── useFriendMessages.ts     # WebSocket 메시지 처리
│   └── useNetworkSync.ts        # joinRoomByInvite 함수 추가
└── components/
    ├── ui/
    │   ├── FriendPanel.tsx              # 친구 패널
    │   ├── FriendRequestNotification.tsx # 친구 요청 알림
    │   ├── GameInviteNotification.tsx   # 게임 초대 알림
    │   └── ServerStatusBar.tsx          # 서버 상태 바
    └── screens/
        └── RPGCoopLobbyScreen.tsx       # 친구 UI 통합
```

### 데이터베이스 마이그레이션

```
supabase/migrations/
└── 008_create_friends_tables.sql  # 친구 테이블 생성
```

---

## 설정 및 환경

### 게임 초대 설정

| 설정 | 값 | 설명 |
|------|-----|------|
| 초대 TTL | 5분 | 초대 만료 시간 |
| 만료 정리 주기 | 1분 | 만료된 초대 자동 정리 |
| 알림 자동 숨김 | 30초 | 초대 알림 최대 표시 시간 |

### 서버 상태 갱신

| 설정 | 값 | 설명 |
|------|-----|------|
| 클라이언트 폴링 | 10초 | ServerStatusBar 갱신 주기 |
| 온라인 목록 폴링 | 5초 | FriendSidebar 안전망 (실시간 메시지 누락 복구용) |

### 에러 메시지

| 에러 | 메시지 |
|------|--------|
| 자기 자신에게 요청 | "자기 자신에게 친구 요청을 보낼 수 없습니다." |
| 이미 친구 | "이미 친구입니다." |
| 중복 요청 | "이미 친구 요청을 보냈거나 받았습니다." |
| 친구가 아님 | "친구에게만 초대를 보낼 수 있습니다." |
| 방 없음 | "방이 존재하지 않습니다." |
| 초대 만료 | "초대가 만료되었습니다." |

---

## UI 사용법

### 친구 패널 열기

1. 로비 화면 우측 상단의 친구 아이콘 클릭
2. 패널이 열리면 친구/온라인/요청 탭 전환

### 친구 추가하기

1. "온라인" 탭 클릭
2. 원하는 플레이어 옆 "+" 버튼 클릭
3. 상대방이 수락하면 친구 목록에 추가

### 친구 요청 응답하기

1. "요청" 탭 클릭
2. 받은 요청에서 "수락" 또는 "거절" 클릭

### 게임 초대하기

1. 대기방에 입장
2. 친구 패널에서 "친구" 탭 클릭
3. 온라인 친구 옆 게임패드 아이콘 클릭

### 게임 초대 수락하기

1. 초대 알림이 화면 상단에 표시됨
2. "참가" 버튼 클릭
3. 자동으로 해당 방에 입장
