# 서버 아키텍처

> 멀티플레이어 서버 동작 방식 문서

---

## 목차

1. [개요](#개요)
2. [통신 기술](#통신-기술)
3. [파일 구조](#파일-구조)
4. [RTS 모드 멀티플레이어](#rts-모드-멀티플레이어)
5. [RPG 모드 멀티플레이어](#rpg-모드-멀티플레이어)
6. [두 모드 비교](#두-모드-비교)
7. [메시지 흐름 다이어그램](#메시지-흐름-다이어그램)
8. [서버 실행](#서버-실행)

---

## 개요

이 프로젝트는 **RTS 모드**와 **RPG 모드** 두 가지 게임 모드를 지원하며, 각각 다른 멀티플레이어 아키텍처를 사용합니다.

| 모드 | 아키텍처 | 플레이어 수 | 게임 로직 위치 | 게임 방식 |
|------|----------|-------------|----------------|-----------|
| RTS | 전용 서버 방식 | 2명 (1v1) | 서버 | 대전 |
| RPG | 호스트 기반 릴레이 | 1~4명 | 호스트 클라이언트 | 협동 |

---

## 통신 기술

### WebSocket

두 모드 모두 동일한 WebSocket 인프라를 공유합니다.

| 항목 | 값 |
|------|-----|
| 라이브러리 | Node.js `ws` 패키지 |
| 프로토콜 | RFC 6455 WebSocket |
| 데이터 형식 | JSON 직렬화 |
| 서버 주소 | 환경변수 `VITE_WS_URL` (기본값: `ws://localhost:8080`) |
| 재연결 시도 | 최대 5회 (지수 백오프) |

### 클라이언트 연결

```typescript
// WebSocketClient.ts
this.serverUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080';
this.ws = new WebSocket(this.serverUrl);

// 메시지 송수신
this.ws.send(JSON.stringify(message));
const message: ServerMessage = JSON.parse(event.data);
```

---

## 파일 구조

### RTS 모드 파일

```
클라이언트:
├── src/stores/useMultiplayerStore.ts    # RTS 멀티플레이어 상태 관리
├── src/hooks/useMultiplayerGameState.ts # 게임 상태 변환/동기화
└── src/services/WebSocketClient.ts      # WebSocket 통신

서버:
├── server/src/game/GameRoom.ts          # 게임 방 로직 (핵심 게임 엔진)
├── server/src/room/RoomManager.ts       # 방 생성/관리
├── server/src/websocket/WebSocketServer.ts
└── server/src/websocket/MessageHandler.ts

타입:
├── shared/types/network.ts              # RTS 네트워크 메시지 타입
└── shared/types/game.ts                 # RTS 게임 상태 타입
```

### RPG 모드 파일

```
클라이언트:
├── src/hooks/useNetworkSync.ts          # RPG 네트워크 동기화 (핵심)
├── src/stores/useRPGStore.ts            # RPG 게임 상태
└── src/services/WebSocketClient.ts      # WebSocket 통신

서버:
├── server/src/game/RPGCoopGameRoom.ts   # 게임 방 (메시지 릴레이만)
├── server/src/room/CoopRoomManager.ts   # 협동 방 관리
├── server/src/websocket/WebSocketServer.ts
└── server/src/websocket/MessageHandler.ts

타입:
├── shared/types/rpgNetwork.ts           # RPG 협동 네트워크 타입
└── shared/types/hostBasedNetwork.ts     # 호스트 기반 네트워크 설정
```

---

## RTS 모드 멀티플레이어

### 아키텍처: 전용 서버 방식 (Authoritative Server)

```
클라이언트 1 (좌측)                    클라이언트 2 (우측)
       │                                     │
       │         WebSocket 연결               │
       ▼                                     ▼
       └────────────┬────────────────────────┘
                    │
                    ▼
           ┌───────────────────┐
           │   전용 서버        │
           │   (GameRoom.ts)   │
           │                   │
           │  - 게임 로직 실행  │
           │  - 상태 계산       │
           │  - 입력 검증       │
           │  - 결과 브로드캐스트│
           └───────────────────┘
```

### 특징

| 항목 | 설명 |
|------|------|
| 게임 로직 | 서버가 전담 실행 |
| 입력 처리 | 클라이언트 액션 → 서버 검증 → 적용 |
| 상태 동기화 | 서버 → 양쪽 클라이언트 |
| 공정성 | 완벽 (서버가 모든 검증) |
| 치팅 방지 | 우수 |

### GameRoom.ts 주요 기능

```typescript
export class GameRoom {
  public id: string;
  private playerIds: [string, string];
  private gameState: NetworkGameState;

  // 게임 루프
  private gameLoop(): void {
    setInterval(() => {
      this.updateUnits();      // 유닛 AI 및 이동
      this.handleCombat();     // 전투 처리
      this.updateResources();  // 자원 업데이트
      this.broadcastState();   // 상태 브로드캐스트
    }, 16.67);  // 60 FPS
  }
}
```

### 동기화 방식

| 방식 | 주기 | 설명 |
|------|------|------|
| 상태 브로드캐스트 | 50ms (20Hz) | 전체 게임 상태 전송 |
| 이벤트 업데이트 | 즉시 | 유닛 생성/공격/사망 등 |

### 메시지 타입

#### 클라이언트 → 서버

| 타입 | 설명 |
|------|------|
| `CREATE_ROOM` | 방 생성 |
| `JOIN_ROOM` | 방 입장 |
| `LEAVE_ROOM` | 방 퇴장 |
| `GAME_READY` | 게임 준비 완료 |
| `SPAWN_UNIT` | 유닛 소환 |
| `BUILD_WALL` | 벽 건설 |
| `UPGRADE_BASE` | 기지 업그레이드 |
| `SELL_HERB` | 약초 판매 |
| `COLLECT_RESOURCE` | 자원 수집 |

#### 서버 → 클라이언트

| 타입 | 설명 |
|------|------|
| `CONNECTED` | 연결 완료 (playerId 할당) |
| `ROOM_CREATED` | 방 생성 완료 |
| `ROOM_JOINED` | 방 입장 완료 |
| `PLAYER_JOINED` | 상대 플레이어 입장 |
| `GAME_COUNTDOWN` | 게임 시작 카운트다운 |
| `GAME_START` | 게임 시작 (초기 상태) |
| `GAME_STATE` | 주기적 상태 업데이트 |
| `GAME_EVENT` | 이벤트 기반 업데이트 |
| `GAME_OVER` | 게임 종료 |
| `OPPONENT_DISCONNECTED` | 상대 연결 해제 |

#### 게임 이벤트

```typescript
type GameEvent =
  | 'UNIT_SPAWNED' | 'UNIT_DIED' | 'UNIT_MOVED' | 'UNIT_ATTACKED'
  | 'UNIT_HEALED' | 'UNIT_STATE_CHANGED'
  | 'BASE_DAMAGED' | 'BASE_UPGRADED'
  | 'WALL_BUILT' | 'WALL_DAMAGED' | 'WALL_DESTROYED'
  | 'RESOURCE_GATHERED' | 'RESOURCE_UPDATED'
  | 'NODE_DEPLETED' | 'NODE_REGENERATED'
```

### 게임 상태 구조

```typescript
interface NetworkGameState {
  time: number;                    // 경과 시간
  maxTime: number;                 // 게임 총 시간 (600초)
  leftPlayer: {
    id: string;
    name: string;
    resources: Resources;
    baseHp: number;
    maxBaseHp: number;
    upgradeLevel: number;
    goldPerSecond: number;
    spawnCooldowns: Record<string, number>;
  };
  rightPlayer: { ... };            // 동일 구조
  units: NetworkUnit[];            // 모든 유닛
  walls: NetworkWall[];            // 모든 벽
  resourceNodes: NetworkResourceNode[];  // 자원 노드
}
```

---

## RPG 모드 멀티플레이어

### 아키텍처: 호스트 기반 릴레이 방식 (Host-Authority)

```
호스트 (Player 1)                    클라이언트들 (Player 2, 3, 4)
┌─────────────────┐                  ┌─────────────────┐
│ 게임 로직 실행   │                  │ 상태 수신만      │
│ 상태 브로드캐스트 │                  │ 입력만 전송      │
│ 원격 입력 처리   │                  │                 │
└────────┬────────┘                  └────────┬────────┘
         │                                    │
         │      WebSocket 연결                 │
         ▼                                    ▼
         └──────────────┬─────────────────────┘
                        │
                        ▼
               ┌─────────────────┐
               │  서버 (릴레이)   │
               │                 │
               │ - 메시지 전달만  │
               │ - 게임 로직 없음 │
               └─────────────────┘
```

### 특징

| 항목 | 설명 |
|------|------|
| 게임 로직 | 호스트 클라이언트가 실행 |
| 서버 역할 | 메시지 릴레이만 담당 |
| 입력 처리 | 클라이언트 입력 → 서버 → 호스트 → 처리 |
| 서버 부하 | 낮음 |
| 지연시간 | 낮음 (호스트 중심) |
| 호스트 변경 | 자동 지원 |

### 호스트 기반 설정

```typescript
// hostBasedNetwork.ts
export const HOST_BASED_CONFIG = {
  STATE_SYNC_INTERVAL: 50,      // 20Hz (50ms마다 상태 동기화)
  INPUT_PROCESS_INTERVAL: 16,   // ~60Hz (입력 처리)

  INTERPOLATION: {
    ENABLED: true,
    DELAY: 100,                 // 100ms 보간 딜레이
    POSITION_THRESHOLD: 50,     // 50px 이상 차이 시 보정
    SNAP_THRESHOLD: 200,        // 200px 이상 시 즉시 스냅
  }
};
```

### RPGCoopGameRoom.ts 역할

서버는 게임 로직을 실행하지 않고 메시지만 전달합니다.

```typescript
export class RPGCoopGameRoom {
  public id: string;
  private playerIds: string[];
  private hostPlayerId: string;

  // 호스트의 게임 상태를 다른 클라이언트에 전달
  public handleGameStateBroadcast(playerId: string, state: SerializedGameState): void {
    if (playerId !== this.hostPlayerId) return;  // 호스트만 허용

    this.playerIds.forEach(pid => {
      if (pid !== this.hostPlayerId) {
        sendToPlayer(pid, {
          type: 'COOP_GAME_STATE_FROM_HOST',
          state,
        });
      }
    });
  }

  // 클라이언트 입력을 호스트에 전달
  public handlePlayerInput(playerId: string, input: PlayerInput): void {
    if (playerId !== this.hostPlayerId) {
      sendToPlayer(this.hostPlayerId, {
        type: 'COOP_PLAYER_INPUT',
        input: { ...input, playerId },
      });
    }
  }
}
```

### 동기화 방식

| 방향 | 내용 | 주기 |
|------|------|------|
| 호스트 → 서버 → 클라이언트 | 전체 게임 상태 | 50ms (20Hz) |
| 클라이언트 → 서버 → 호스트 | 플레이어 입력 | 즉시 |

### 호스트의 게임 루프

```
[게임 루프 (60fps)]
       ↓
[자신의 입력 처리]
       ↓
[원격 입력 큐에서 다른 플레이어 입력 처리]
       ↓
[게임 상태 시뮬레이션]
       ↓
[50ms마다 상태 브로드캐스트]
       → HOST_GAME_STATE_BROADCAST
         → 서버를 통해 클라이언트들에게 전송
```

### 메시지 타입

#### 클라이언트 → 서버

| 타입 | 설명 |
|------|------|
| `CREATE_COOP_ROOM` | 협동 방 생성 |
| `JOIN_COOP_ROOM` | 협동 방 입장 |
| `LEAVE_COOP_ROOM` | 협동 방 퇴장 |
| `COOP_READY` / `COOP_UNREADY` | 준비 상태 토글 |
| `CHANGE_COOP_CLASS` | 영웅 클래스 변경 |
| `START_COOP_GAME` | 게임 시작 (호스트만) |
| `KICK_COOP_PLAYER` | 플레이어 추방 (호스트만) |
| `HOST_GAME_STATE_BROADCAST` | 게임 상태 브로드캐스트 (호스트만) |
| `HOST_GAME_EVENT_BROADCAST` | 게임 이벤트 브로드캐스트 (호스트만) |
| `HOST_PLAYER_INPUT` | 플레이어 입력 (클라이언트만) |
| `HOST_GAME_OVER` | 게임 종료 (호스트만) |

#### 서버 → 클라이언트

| 타입 | 설명 |
|------|------|
| `COOP_ROOM_CREATED` | 방 생성 완료 |
| `COOP_ROOM_JOINED` | 방 입장 완료 |
| `COOP_PLAYER_JOINED` | 다른 플레이어 입장 |
| `COOP_PLAYER_LEFT` | 플레이어 퇴장 |
| `COOP_PLAYER_READY` | 플레이어 준비 상태 변경 |
| `COOP_GAME_COUNTDOWN` | 게임 시작 카운트다운 |
| `COOP_GAME_START_HOST_BASED` | 게임 시작 (역할 할당) |
| `COOP_GAME_STATE_FROM_HOST` | 호스트로부터 게임 상태 |
| `COOP_PLAYER_INPUT` | 다른 플레이어 입력 (호스트만 수신) |
| `COOP_GAME_OVER` | 게임 종료 |
| `COOP_HOST_CHANGED` | 호스트 변경 알림 |
| `COOP_YOU_ARE_NOW_HOST` | 새 호스트 권한 부여 |

### 플레이어 입력 구조

```typescript
interface PlayerInput {
  playerId: string;
  moveDirection: { x: number; y: number } | null;
  skillUsed?: {
    skillSlot: 'Q' | 'W' | 'E';
    targetX: number;
    targetY: number;
  };
  upgradeRequested?: 'attack' | 'speed' | 'hp' | ...;
  timestamp: number;
}
```

### 게임 상태 구조

```typescript
interface SerializedGameState {
  gameTime: number;
  gamePhase: 'playing' | 'boss_phase' | 'victory' | 'defeat';
  heroes: SerializedHero[];        // 모든 플레이어의 영웅 (각자 gold, upgradeLevels 포함)
  enemies: SerializedEnemy[];      // 모든 적
  nexus: Nexus;                    // 넥서스 (방어 대상)
  enemyBases: EnemyBase[];         // 적 기지들
  activeSkillEffects: SkillEffect[];
  basicAttackEffects: BasicAttackEffect[];
  pendingSkills: PendingSkill[];
  running: boolean;
  paused: boolean;
  gameOver: boolean;
  victory: boolean;
  stats: GameStats;
}
```

### 호스트 변경 처리

호스트가 연결 해제되면 자동으로 다음 플레이어가 호스트가 됩니다.

```
호스트 연결 끊김
       ↓
서버: RPGCoopGameRoom.handlePlayerDisconnect()
       ↓
새 호스트 선택 (첫 번째 남은 플레이어)
       ↓
모든 플레이어에게 알림:
  → COOP_HOST_CHANGED { newHostPlayerId }

새 호스트에게:
  → COOP_YOU_ARE_NOW_HOST
```

---

## 두 모드 비교

| 항목 | RTS 모드 | RPG 모드 |
|------|----------|----------|
| **플레이어 수** | 2명 (1v1) | 1~4명 (협동) |
| **게임 방식** | 대전 | 협동 |
| **네트워크 방식** | 전용 서버 | 호스트 기반 |
| **게임 로직 위치** | 서버 | 호스트 클라이언트 |
| **서버 역할** | 게임 엔진 + 메시지 전송 | 메시지 릴레이만 |
| **동기화 주기** | 50ms (20Hz) | 50ms (20Hz) |
| **자원 관리** | 플레이어별 개별 | 플레이어별 개별 |
| **부정행위 방지** | 우수 (서버 검증) | 중간 (호스트 의존) |
| **지연시간** | 높음 (왕복 필수) | 낮음 (호스트 중심) |
| **서버 부하** | 높음 | 낮음 |
| **호스트 변경** | N/A | 자동 지원 |
| **재접속** | 미지원 | 지원 |

### 아키텍처 선택 이유

| 모드 | 선택 이유 |
|------|-----------|
| RTS (전용 서버) | 경쟁 게임에서 공정성과 치팅 방지가 중요 |
| RPG (호스트 기반) | 협동 게임에서 서버 부하 감소 및 싱글/멀티 통합 용이 |

---

## 메시지 흐름 다이어그램

### RTS 모드 게임 플로우

```
클라이언트 1          서버               클라이언트 2
    │                 │                     │
    │──CREATE_ROOM───→│                     │
    │←─ROOM_CREATED───│                     │
    │                 │                     │
    │                 │←────JOIN_ROOM───────│
    │                 │───ROOM_JOINED──────→│
    │←─PLAYER_JOINED──│                     │
    │                 │                     │
    │──GAME_READY────→│←────GAME_READY──────│
    │                 │                     │
    │←─GAME_COUNTDOWN─│──GAME_COUNTDOWN────→│
    │                 │                     │
    │                 │  [서버 게임 로직 시작]│
    │                 │                     │
    │←──GAME_START────│────GAME_START──────→│
    │                 │                     │
    │──SPAWN_UNIT────→│                     │
    │                 │  [서버에서 검증/생성] │
    │←──GAME_EVENT────│────GAME_EVENT──────→│
    │  (UNIT_SPAWNED) │   (UNIT_SPAWNED)    │
    │                 │                     │
    │    [50ms마다 GAME_STATE 브로드캐스트]   │
    │←──GAME_STATE────│────GAME_STATE──────→│
    │                 │                     │
    │←──GAME_OVER─────│────GAME_OVER───────→│
```

### RPG 모드 게임 플로우

```
호스트              서버              클라이언트
  │                 │                    │
  │─CREATE_COOP_ROOM→│                    │
  │←COOP_ROOM_CREATED│                    │
  │                 │                    │
  │                 │←─JOIN_COOP_ROOM────│
  │                 │──COOP_ROOM_JOINED─→│
  │←COOP_PLAYER_JOINED                   │
  │                 │                    │
  │──COOP_READY────→│                    │
  │                 │←────COOP_READY─────│
  │                 │                    │
  │─START_COOP_GAME→│                    │
  │←COOP_GAME_START─│─COOP_GAME_START───→│
  │  _HOST_BASED    │  _HOST_BASED       │
  │  (isHost: true) │  (isHost: false)   │
  │                 │                    │
  │ [호스트 게임 로직 실행]                │
  │                 │                    │
  │─HOST_GAME_STATE─→│                    │
  │  _BROADCAST     │─COOP_GAME_STATE───→│
  │  (50ms 간격)    │  _FROM_HOST        │
  │                 │                    │
  │                 │←─HOST_PLAYER_INPUT─│
  │←COOP_PLAYER_INPUT│  (영웅 이동/스킬)  │
  │                 │                    │
  │ [호스트가 원격 입력 처리]              │
  │                 │                    │
  │─HOST_GAME_STATE─→│─COOP_GAME_STATE───→│
  │  _BROADCAST     │  _FROM_HOST        │
  │                 │                    │
  │─HOST_GAME_OVER──→│──COOP_GAME_OVER───→│
```

---

## 서버 실행

### 개발 환경

```bash
cd server
npm install
npm run dev
```

### 프로덕션 환경

```bash
cd server
npm run build
npm start
```

### 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `PORT` | 8080 | WebSocket 서버 포트 |
| `NODE_ENV` | development | 실행 환경 |

### 클라이언트 설정

```env
# .env (개발)
VITE_WS_URL=ws://localhost:8080

# .env (프로덕션)
VITE_WS_URL=wss://your-server.com
```
