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
8. [서버 성능 최적화](#서버-성능-최적화-v1222)
9. [서버 실행](#서버-실행)

---

## 개요

이 프로젝트는 **RTS 모드**와 **RPG 모드** 두 가지 게임 모드를 지원하며, 모두 **서버 권위 모델**을 사용합니다.

| 모드 | 아키텍처 | 플레이어 수 | 게임 로직 위치 | 게임 방식 |
|------|----------|-------------|----------------|-----------|
| RTS | 전용 서버 방식 | 2명 (1v1) | 서버 | 대전 |
| RPG | 서버 권위 모델 | 1~4명 | 서버 | 협동 |

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
├── server/src/game/RPGCoopGameRoom.ts      # 게임 방 관리 + 상태 브로드캐스트
├── server/src/game/RPGServerGameEngine.ts  # 서버 게임 엔진 (60fps 게임 루프)
├── server/src/game/rpgServerGameSystems.ts # 넥서스 레이저, 골드, 업그레이드, 승패 조건
├── server/src/game/rpgServerHeroSystem.ts  # 영웅 생성, 버프, 스킬 설정
├── server/src/game/rpgServerSkillSystem.ts # 스킬 실행 (Q/W/E)
├── server/src/game/rpgServerEnemySystem.ts # 적 AI, 스폰, 이동
├── server/src/game/rpgServerBossSystem.ts  # 보스 AI, 스킬 패턴
├── server/src/game/rpgServerConfig.ts      # 서버 게임 설정값
├── server/src/game/rpgServerUtils.ts       # 유틸리티 (distance, distanceSquared)
├── server/src/game/rpgServerTypes.ts       # 서버 전용 타입 정의
├── server/src/room/CoopRoomManager.ts      # 협동 방 관리
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
| 상태 브로드캐스트 | 33ms (~30Hz) | 전체 게임 상태 전송 |
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

### 아키텍처: 서버 권위 모델 (Server Authority)

```
┌─────────────┐     입력 전송      ┌─────────────┐     입력 전송      ┌─────────────┐
│ 클라이언트A │ ─────────────────→ │    서버     │ ←───────────────── │ 클라이언트B │
│  (방장)     │                    │             │                    │             │
└─────────────┘                    └─────────────┘                    └─────────────┘
       ↑                                  │                                  ↑
       │                           게임 로직 실행                            │
       │                           (60fps 틱)                               │
       │                                  │                                  │
       │                           상태 브로드캐스트                         │
       │                           (33ms / ~30Hz)                           │
       │                                  │                                  │
       └──────────────────────────────────┴──────────────────────────────────┘
                                    상태 수신
```

**방장(Host)**: UI 권한만 보유 (일시정지, 재시작, 설정 변경). 게임 로직은 서버가 실행.

### 특징

| 항목 | 설명 |
|------|------|
| 게임 로직 | 서버가 실행 (RPGServerGameEngine) |
| 서버 역할 | 게임 로직 실행 + 상태 브로드캐스트 |
| 입력 처리 | 모든 클라이언트 → 서버 → 서버가 처리 |
| 치트 방지 | 우수 (서버가 권위적) |
| 호스트 이탈 | 게임 계속 진행 (새 방장은 UI 권한만) |
| 방장 역할 | UI 제어만 (일시정지, 재시작, 설정) |

### 네트워크 설정

```typescript
// hostBasedNetwork.ts
export const HOST_BASED_CONFIG = {
  STATE_SYNC_INTERVAL: 33,      // ~30Hz (33ms마다 상태 동기화)
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

서버가 게임 로직을 실행하고 모든 클라이언트에 상태를 브로드캐스트합니다.

```typescript
export class RPGCoopGameRoom {
  public id: string;
  private playerIds: string[];
  private hostPlayerId: string;  // UI 권한만 (일시정지, 재시작 등)
  private gameEngine: RPGServerGameEngine | null = null;

  // 게임 시작 시 서버 게임 엔진 생성
  private startGame(): void {
    this.gameEngine = new RPGServerGameEngine(
      this.id,
      this.playerInfos,
      this.difficulty,
      (state) => this.broadcastGameState(state),  // 모든 클라이언트에 상태 브로드캐스트
      (result) => this.handleGameOverFromEngine(result)
    );
    this.gameEngine.start();
  }

  // 모든 클라이언트의 입력을 게임 엔진에 전달
  public handlePlayerInput(playerId: string, input: PlayerInput): void {
    this.gameEngine?.handlePlayerInput(playerId, input);
  }

  // 게임 상태를 모든 클라이언트에 브로드캐스트 (1회 stringify 최적화)
  private broadcastGameState(state: SerializedGameState): void {
    const jsonString = JSON.stringify({ type: 'COOP_GAME_STATE', state });
    for (const playerId of this.playerIds) {
      const player = players.get(playerId);
      if (player) sendPreStringifiedMessage(player.ws, jsonString);
    }
  }
}
```

### 방 상태 관리

RPG 협동 모드는 두 개의 방 저장소를 사용합니다:

| 저장소 | 용도 | 상태 |
|--------|------|------|
| `waitingCoopRooms` | 로비 목록 표시, 방 입장 관리 | `waiting`, `started` |
| `coopGameRooms` | 게임 진행 중 메시지 릴레이 | 게임 방 인스턴스 |

#### 방 생명주기

```
[방 생성]
  → waitingCoopRooms에 추가 (state: 'waiting')
  → 로비 목록에 표시됨
       ↓
[게임 시작]
  → waitingCoopRooms 상태 변경 (state: 'started')
  → coopGameRooms에 RPGCoopGameRoom 인스턴스 생성
  → 로비에서 "게임 중" 표시, 입장 불가
       ↓
[로비 복귀]
  → waitingCoopRooms 상태 변경 (state: 'waiting')
  → 플레이어 목록 동기화
  → 로비에서 다시 입장 가능
       ↓
[방 파기]
  → waitingCoopRooms에서 삭제
  → coopGameRooms에서 삭제
```

#### 플레이어 퇴장 처리

```typescript
// 플레이어 퇴장 시 (로비 vs 게임 중 분기)
function handleLeaveCoopRoom(playerId: string): void {
  const gameRoom = coopGameRooms.get(roomId);

  if (gameRoom) {
    // 로비 상태에서 호스트가 나갈 경우: 호스트 위임
    if (gameRoom.isInLobby() && gameRoom.isHost(playerId)) {
      gameRoom.transferHostAndLeave(playerId);
      return;
    }

    // 게임 중 호스트가 나갈 경우: 방 파기
    if (gameRoom.isHost(playerId)) {
      gameRoom.destroyRoom(playerId);
      return;
    }

    // 일반 플레이어 퇴장
    gameRoom.handlePlayerDisconnect(playerId);
  }

  // 대기 방 플레이어 목록 동기화
  syncWaitingRoomPlayers(roomId, playerIds, playerInfos);
}
```

#### 호스트 위임 시스템 (로비)

호스트가 대기방에서 나갈 경우 방을 파기하지 않고 다음 플레이어에게 호스트 권한을 위임합니다.

```typescript
// RPGCoopGameRoom.ts
public transferHostAndLeave(playerId: string): void {
  // 1. 나가는 플레이어 제거
  this.playerIds = this.playerIds.filter(id => id !== playerId);
  this.playerInfos.delete(playerId);

  // 2. 남은 플레이어가 있으면 첫 번째 플레이어를 새 호스트로 지정
  if (this.playerIds.length > 0) {
    const newHostId = this.playerIds[0];
    this.hostPlayerId = newHostId;

    // 3. 모든 플레이어에게 업데이트된 방 정보 전송
    this.broadcastRoomUpdate();

    // 4. 대기방 목록에도 새 호스트 정보 반영
    this.syncWaitingRoomData();
  }
}
```

### 동기화 방식

| 방향 | 내용 | 주기 |
|------|------|------|
| 서버 → 모든 클라이언트 | 전체 게임 상태 | 33ms (~30Hz) |
| 모든 클라이언트 → 서버 | 플레이어 입력 | 즉시 |

### 서버의 게임 루프

```
[게임 루프 (60fps)] - RPGServerGameEngine
       ↓
[모든 플레이어 입력 처리]
       ↓
[게임 상태 시뮬레이션]
  - 영웅 이동/스킬
  - 적 AI/스폰
  - 보스 패턴
  - 넥서스 레이저
       ↓
[33ms마다 상태 브로드캐스트]
       → COOP_GAME_STATE
         → 모든 클라이언트에게 전송
```

### 메시지 타입

#### 클라이언트 → 서버

| 타입 | 설명 |
|------|------|
| `GET_COOP_ROOM_LIST` | 방 목록 조회 |
| `CREATE_COOP_ROOM` | 협동 방 생성 |
| `JOIN_COOP_ROOM` | 협동 방 입장 |
| `LEAVE_COOP_ROOM` | 협동 방 퇴장 |
| `COOP_READY` / `COOP_UNREADY` | 준비 상태 토글 |
| `CHANGE_COOP_CLASS` | 영웅 클래스 변경 |
| `START_COOP_GAME` | 게임 시작 (방장만) |
| `KICK_COOP_PLAYER` | 플레이어 추방 (방장만) |
| `PLAYER_INPUT` | 플레이어 입력 (모든 클라이언트) |
| `PAUSE_COOP_GAME` | 일시정지 (방장만) |
| `RESUME_COOP_GAME` | 재개 (방장만) |
| `RETURN_TO_LOBBY` | 로비 복귀 (방장만) |
| `RESTART_COOP_GAME` | 재시작 (방장만) |

#### 서버 → 클라이언트

| 타입 | 설명 |
|------|------|
| `COOP_ROOM_LIST` | 방 목록 응답 (isInGame 포함) |
| `COOP_ROOM_CREATED` | 방 생성 완료 |
| `COOP_ROOM_JOINED` | 방 입장 완료 |
| `COOP_PLAYER_JOINED` | 다른 플레이어 입장 |
| `COOP_PLAYER_LEFT` | 플레이어 퇴장 |
| `COOP_PLAYER_READY` | 플레이어 준비 상태 변경 |
| `COOP_GAME_COUNTDOWN` | 게임 시작 카운트다운 |
| `COOP_GAME_START` | 게임 시작 (모든 플레이어 동등) |
| `COOP_GAME_STATE` | 게임 상태 (서버가 브로드캐스트) |
| `COOP_GAME_OVER` | 게임 종료 |
| `COOP_HOST_CHANGED` | 방장 변경 알림 (UI 권한) |
| `COOP_YOU_ARE_NOW_HOST` | 새 방장 권한 부여 |
| `COOP_RECONNECT_INFO` | 재접속 정보 |
| `COOP_PLAYER_RECONNECTED` | 플레이어 재접속 알림 |
| `COOP_GAME_PAUSED` | 일시정지됨 |
| `COOP_GAME_RESUMED` | 재개됨 |

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

### 방 목록 정보 구조

```typescript
interface WaitingCoopRoomInfo {
  roomId: string;
  roomCode: string;
  hostName: string;
  hostHeroClass: HeroClass;
  hostClassLevel: number;
  playerCount: number;
  maxPlayers: number;
  createdAt: number;
  isPrivate: boolean;
  isInGame?: boolean;  // 게임 진행 중인 방 (입장 불가)
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
  enemyBases: EnemyBase[];         // 적 기지들 (플레이어 수에 따라 2~4개)
  activeSkillEffects: SkillEffect[];
  basicAttackEffects: BasicAttackEffect[];
  pendingSkills: PendingSkill[];
  running: boolean;
  paused: boolean;
  gameOver: boolean;
  victory: boolean;
  stats: GameStats;
}

// 적 기지 (플레이어 수에 따라 활성화)
type EnemyBaseId = 'left' | 'right' | 'top' | 'bottom';

interface EnemyBase {
  id: EnemyBaseId;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  destroyed: boolean;
}

// 플레이어 수별 기지 구성:
// - 1~2명: left, right (2개)
// - 3명: left, right, top (3개)
// - 4명: left, right, top, bottom (4개)
```

### 방장 변경 처리

방장이 나가면 자동으로 다음 플레이어가 방장이 됩니다.
**중요**: 서버가 게임 로직을 실행하므로 방장 변경은 UI 권한만 이전됩니다.

```
방장 연결 끊김
       ↓
서버: RPGCoopGameRoom.handlePlayerDisconnect()
       ↓
새 방장 선택 (첫 번째 남은 플레이어)
       ↓
게임은 서버가 계속 실행 (중단 없음)
       ↓
모든 플레이어에게 알림:
  → COOP_HOST_CHANGED { newHostPlayerId }

새 방장에게:
  → COOP_YOU_ARE_NOW_HOST { gameState }
  (일시정지, 재시작 등 UI 권한 부여)
```

### 플레이어 재접속 흐름

```
플레이어 재접속
       ↓
서버: RPGCoopGameRoom.handlePlayerReconnect()
       ↓
모든 플레이어에게 알림:
  → COOP_PLAYER_RECONNECTED { playerId }

재접속한 플레이어에게:
  → COOP_RECONNECT_INFO { hostPlayerId, isHost, gameState }
       ↓
클라이언트: 서버로부터 다음 상태 브로드캐스트 대기 (33ms 이내)
```

---

## 두 모드 비교

| 항목 | RTS 모드 | RPG 모드 |
|------|----------|----------|
| **플레이어 수** | 2명 (1v1) | 1~4명 (협동) |
| **게임 방식** | 대전 | 협동 |
| **네트워크 방식** | 전용 서버 | 서버 권위 모델 |
| **게임 로직 위치** | 서버 | 서버 |
| **서버 역할** | 게임 엔진 + 상태 브로드캐스트 | 게임 엔진 + 상태 브로드캐스트 |
| **동기화 주기** | 50ms (20Hz) | 33ms (~30Hz) |
| **자원 관리** | 플레이어별 개별 | 플레이어별 개별 |
| **부정행위 방지** | 우수 (서버 검증) | 우수 (서버 검증) |
| **지연시간** | 중간 (클라이언트 예측) | 중간 (클라이언트 예측) |
| **서버 부하** | 중간 | 중간 |
| **방장 이탈** | N/A | 게임 계속 진행 (UI 권한만 이전) |
| **재접속** | 미지원 | 지원 |

### 아키텍처 선택 이유

| 모드 | 선택 이유 |
|------|-----------|
| RTS (전용 서버) | 경쟁 게임에서 공정성과 치팅 방지가 중요 |
| RPG (서버 권위) | 치트 방지, 일관된 게임 상태, 방장 이탈 시에도 게임 진행 |

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
    │    [50ms마다 GAME_STATE 브로드캐스트]   │  (RTS: 50ms)
    │←──GAME_STATE────│────GAME_STATE──────→│
    │                 │                     │
    │←──GAME_OVER─────│────GAME_OVER───────→│
```

### RPG 모드 게임 플로우

```
방장(클라이언트)      서버                클라이언트
  │                   │                      │
  │─CREATE_COOP_ROOM─→│                      │
  │←COOP_ROOM_CREATED─│                      │
  │                   │                      │
  │                   │←──JOIN_COOP_ROOM─────│
  │                   │───COOP_ROOM_JOINED──→│
  │←COOP_PLAYER_JOINED│                      │
  │                   │                      │
  │───COOP_READY─────→│                      │
  │                   │←─────COOP_READY──────│
  │                   │                      │
  │─START_COOP_GAME──→│                      │
  │                   │                      │
  │                   │  [서버 게임 엔진 시작] │
  │                   │  RPGServerGameEngine │
  │                   │                      │
  │←─COOP_GAME_START──│───COOP_GAME_START───→│
  │  (isHost: true)   │   (isHost: false)    │
  │  (UI 권한만)      │                      │
  │                   │                      │
  │                   │  [서버 게임 루프 60fps]│
  │                   │                      │
  │───PLAYER_INPUT───→│←────PLAYER_INPUT─────│
  │  (이동/스킬)      │     (이동/스킬)       │
  │                   │                      │
  │                   │  [서버가 입력 처리]   │
  │                   │                      │
  │←──COOP_GAME_STATE─│───COOP_GAME_STATE───→│
  │   (33ms 간격)     │    (33ms 간격)       │
  │                   │                      │
  │←──COOP_GAME_OVER──│───COOP_GAME_OVER────→│
```

---

## 서버 성능 최적화 (V1.22.2)

RPG 모드 서버는 60fps 게임루프 + ~30Hz 브로드캐스트를 실행하므로 GC 압력과 CPU 부하 최적화가 중요합니다.

### 브로드캐스트 최적화

| 기법 | 설명 |
|------|------|
| JSON.stringify 1회 통합 | 같은 상태를 플레이어 수만큼 stringify하지 않고, 1회만 stringify 후 `sendPreStringifiedMessage()` 사용 |
| 스킬 캐시 (`_skillQ/W/E`) | `hero.skills.find()` 대신 hero 생성 시 직접 참조 캐시 |
| 적 직렬화 단일 패스 | `.filter().map()` → 단일 `for` 루프 (중간 배열 제거) |

### 배열 할당 제거

| 기법 | 대상 | 효과 |
|------|------|------|
| 인플레이스 splice | `cleanupEffects()` 7개 `.filter()` | 초당 420개 배열 제거 |
| 인플레이스 splice | `updateBuffs()` `.map(spread).filter()` | 초당 480개 배열+객체 제거 |
| 카운터 변수 | `checkWinCondition()` `Array.from().filter()` | 매 틱 2-3개 배열 제거 |

### 연산 최적화

| 기법 | 설명 |
|------|------|
| `currentTickTimestamp` | `Date.now()` 틱당 1회 캐시 → `state.currentTickTimestamp` |
| `distanceSquared()` | 범위 비교에서 `Math.sqrt` 제거 (초당 6,000-12,000회) |
| 입력 큐 인덱스 순회 | `queue.shift()` O(n) → 인덱스 순회 + `queue.length = 0` |

### 주의사항

- `distanceSquared` 사용 시 비교 값도 제곱: `dist <= range` → `distSq <= range * range`
- 인플레이스 splice는 역순으로 진행 (인덱스 꼬임 방지)
- `_skillQ/W/E`는 `hero.skills` 배열의 같은 객체를 참조 (어느 쪽 수정이든 동기화)
- 클라이언트 수정 없음 (`SerializedGameState` 인터페이스 유지)

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
