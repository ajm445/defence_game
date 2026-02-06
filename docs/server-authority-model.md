# RPG 멀티플레이 서버 권위 모델

## 개요

RPG 멀티플레이 모드는 **서버 권위 모델(Server Authority Model)**을 사용합니다.
서버가 게임 로직을 실행하고, 모든 클라이언트는 동등하게 입력을 전송하고 상태를 수신합니다.

### 기존 호스트 기반 모델과의 비교

| 구분 | 호스트 기반 (레거시) | 서버 권위 |
|------|---------------------|----------|
| 게임 로직 실행 | 호스트 클라이언트 | 서버 |
| 상태 브로드캐스트 | 호스트 → 서버 → 클라이언트 | 서버 → 모든 클라이언트 |
| 클라이언트 역할 | 호스트/비호스트 구분 | 모두 동등 |
| 치트 방지 | 호스트 신뢰 필요 | 서버가 권위적 |
| 호스트 이탈 시 | 호스트 전환 필요 | 영향 없음 |

---

## 아키텍처

### 데이터 흐름

```
┌─────────────┐     입력 전송      ┌─────────────┐     입력 전송      ┌─────────────┐
│ 클라이언트A │ ─────────────────→ │    서버     │ ←───────────────── │ 클라이언트B │
└─────────────┘                    └─────────────┘                    └─────────────┘
       ↑                                  │                                  ↑
       │                           게임 로직 실행                            │
       │                           (60fps 틱)                               │
       │                                  │                                  │
       │                           상태 브로드캐스트                         │
       │                           (50ms / 20Hz)                            │
       │                                  │                                  │
       └──────────────────────────────────┴──────────────────────────────────┘
                                    상태 수신
```

### 핵심 컴포넌트

#### 1. RPGServerGameEngine (서버)

서버에서 게임 로직을 실행하는 핵심 엔진입니다.

**위치:** `server/src/game/RPGServerGameEngine.ts`

```typescript
class RPGServerGameEngine {
  // 설정
  private readonly TICK_RATE = 60;        // 60fps 게임 루프
  private readonly BROADCAST_INTERVAL = 50; // 50ms 상태 브로드캐스트

  // 주요 메서드
  public start(): void;                   // 게임 루프 시작
  public stop(): void;                    // 게임 루프 중지
  public pause(): void;                   // 일시정지
  public resume(): void;                  // 재개
  public handlePlayerInput(playerId, input): void;  // 입력 처리
}
```

**처리하는 게임 로직:**
- 영웅 이동, 대시, 부활, 버프 관리
- 적 AI 및 어그로 시스템
- Q/W/E 스킬 실행 (기본 직업 + 전직 스킬)
- 보스 스킬 패턴
- 적 스폰 시스템
- 골드 및 업그레이드
- 넥서스 레이저
- 승리/패배 조건

**모듈 구조:**
```
server/src/game/
├── RPGServerGameEngine.ts    # 메인 게임 엔진
├── rpgServerHeroSystem.ts    # 영웅 생성, 이동, 버프, 쿨다운
├── rpgServerSkillSystem.ts   # Q/W/E 스킬 실행 (전직 스킬 포함)
├── rpgServerEnemySystem.ts   # 적 AI, 스폰, 데미지 처리
├── rpgServerBossSystem.ts    # 보스 스킬 패턴, 영웅 데미지
├── rpgServerGameSystems.ts   # 넥서스, 골드, 업그레이드, 직렬화
├── rpgServerConfig.ts        # 설정값 (스탯, 스킬, 난이도)
├── rpgServerTypes.ts         # 서버 전용 타입 정의
└── rpgServerUtils.ts         # 유틸리티 함수
```

#### 2. RPGCoopGameRoom (서버)

게임 방을 관리하고 엔진을 연동합니다.

**위치:** `server/src/game/RPGCoopGameRoom.ts`

```typescript
class RPGCoopGameRoom {
  private gameEngine: RPGServerGameEngine | null = null;

  // 게임 시작 시 엔진 생성
  private startGame(): void {
    this.gameEngine = new RPGServerGameEngine(
      this.id,
      this.playerInfos,
      this.difficulty,
      (state) => this.broadcastGameState(state),
      (result) => this.handleGameOverFromEngine(result)
    );
    this.gameEngine.start();
  }

  // 플레이어 입력을 엔진에 전달
  public handlePlayerInput(playerId, input): void {
    this.gameEngine?.handlePlayerInput(playerId, input);
  }
}
```

#### 3. useNetworkSync (클라이언트)

클라이언트 네트워크 동기화를 처리합니다.

**위치:** `src/hooks/useNetworkSync.ts`

```typescript
// 입력 전송 (모든 클라이언트)
export function sendMoveDirection(direction) {
  wsClient.send({ type: 'PLAYER_INPUT', input: { moveDirection: direction, ... } });
}

export function sendSkillUse(skillSlot, targetX, targetY) {
  wsClient.send({ type: 'PLAYER_INPUT', input: { skillUsed: { skillSlot, targetX, targetY }, ... } });
}

// 상태 수신 (모든 클라이언트)
case 'COOP_GAME_STATE':
  handleGameStateFromServer(message.state);
  break;
```

#### 4. useRPGGameLoop (클라이언트)

클라이언트 게임 루프입니다. 멀티플레이어에서는 렌더링과 로컬 예측만 담당합니다.

**위치:** `src/hooks/useRPGGameLoop.ts`

```typescript
if (isMultiplayer) {
  // 서버 권위 모델: 게임 로직은 서버에서 처리

  // 1. 이펙트/사운드 업데이트
  effectManager.update(deltaTime);

  // 2. 로컬 이동 예측 (즉각적인 반응)
  if (hero.moveDirection) {
    // 클라이언트에서 즉시 이동 (서버 보정은 별도 처리)
  }

  // 3. 다른 플레이어 보간
  updateOtherHeroesInterpolation();

  return; // 게임 로직 스킵
}

// 싱글플레이어: 전체 게임 로직 실행
```

---

## 스킬 시스템

### 스킬 슬롯 구조

스킬은 `key` 필드로 슬롯을 구분합니다 (Q/W/E 접미사가 아님).

```typescript
// 스킬 정의
interface Skill {
  type: string;      // 'warrior_q', 'multi_arrow', 'berserker_rage' 등
  key: 'Q' | 'W' | 'E';  // 스킬 슬롯
  cooldown: number;
  currentCooldown: number;
}

// 스킬 찾기 (key 필드 사용)
const qSkill = hero.skills?.find(s => s.key === 'Q');
const wSkill = hero.skills?.find(s => s.key === 'W');
```

### 전직 스킬 지원

전직 클래스는 고유한 W/E 스킬을 가집니다.

| 전직 | W 스킬 | E 스킬 |
|------|--------|--------|
| berserker | blood_rush (피의 돌진) | berserker_rage (광란) |
| guardian | guardian_rush (수호의 돌진) | guardian_wall (보호막) |
| sniper | backflip_shot (후방 도약) | headshot (저격) |
| ranger | multi_arrow (다중 화살) | arrow_rain (화살 폭풍) |
| paladin | holy_charge (신성한 돌진) | holy_judgment (신성한 빛) |
| darkKnight | shadow_slash (암흑 베기) | dark_blade (어둠의 칼날) |
| archmage | inferno (인페르노) | meteor_shower (메테오 샤워) |
| healer | healing_light (치유의 빛) | spring_of_life (생명의 샘) |

---

## 버프 시스템

### 버프 타입

```typescript
type BuffType = 'berserker' | 'ironwall' | 'invincible' | 'swiftness' | 'stun';

interface Buff {
  type: BuffType;
  duration: number;
  startTime: number;
  attackBonus?: number;      // 공격력 증가율
  speedBonus?: number;       // 공격속도 증가율
  moveSpeedBonus?: number;   // 이동속도 증가율
  damageReduction?: number;  // 받는 피해 감소율
  damageTaken?: number;      // 받는 피해 증가율 (디버프)
  lifesteal?: number;        // 피해흡혈율
}
```

### 버프 효과 적용 위치

| 버프 속성 | 적용 위치 |
|-----------|-----------|
| attackBonus | rpgServerSkillSystem.ts (데미지 계산) |
| speedBonus | rpgServerHeroSystem.ts (Q 스킬 쿨다운) |
| moveSpeedBonus | rpgServerHeroSystem.ts (이동 속도) |
| damageReduction | rpgServerBossSystem.ts, rpgServerEnemySystem.ts |
| damageTaken | rpgServerBossSystem.ts, rpgServerEnemySystem.ts |
| lifesteal | rpgServerSkillSystem.ts (피해 후 회복) |

---

## 메시지 프로토콜

### 클라이언트 → 서버

```typescript
// 플레이어 입력 (모든 클라이언트가 전송)
type ClientMessage = {
  type: 'PLAYER_INPUT';
  input: {
    playerId: string;
    moveDirection?: { x: number; y: number } | null;
    position?: { x: number; y: number };
    skillUsed?: { skillSlot: 'Q' | 'W' | 'E'; targetX: number; targetY: number };
    upgradeRequested?: 'attack' | 'speed' | 'hp' | 'attackSpeed' | 'goldRate' | 'range';
    timestamp: number;
  };
};
```

### 서버 → 클라이언트

```typescript
// 게임 시작 (isHost 없음)
type ServerMessage =
  | {
      type: 'COOP_GAME_START';
      playerIndex: number;
      players: CoopPlayerInfo[];
      difficulty: string;
    }
  // 게임 상태 (서버가 직접 브로드캐스트)
  | {
      type: 'COOP_GAME_STATE';
      state: SerializedGameState;
    };
```

---

## 클라이언트 예측 및 보정

### 로컬 예측 (Client-Side Prediction)

즉각적인 반응을 위해 클라이언트에서 이동을 예측합니다.

```typescript
// 클라이언트에서 즉시 이동
if (hero.moveDirection && !isDashing && !isCasting && !isStunned) {
  let newX = hero.x + hero.moveDirection.x * hero.speed * deltaTime;
  let newY = hero.y + hero.moveDirection.y * hero.speed * deltaTime;
  updateHeroState({ x: newX, y: newY });
}
```

### 서버 보정 (Server Reconciliation)

서버 상태와 차이가 크면 부드럽게 보정합니다.

```typescript
// applySerializedState에서 처리
const dist = distance(localPos, serverPos);
if (dist > SNAP_THRESHOLD) {
  // 즉시 스냅
  hero.x = serverPos.x;
  hero.y = serverPos.y;
} else if (dist > POSITION_THRESHOLD) {
  // 부드러운 보간
  hero.x = lerp(hero.x, serverPos.x, 0.3);
  hero.y = lerp(hero.y, serverPos.y, 0.3);
}
```

### 다른 플레이어 보간

다른 플레이어의 움직임은 보간하여 부드럽게 표시합니다.

```typescript
// 50ms마다 상태를 받으므로 그 사이를 보간
function updateOtherHeroesInterpolation() {
  for (const hero of otherHeroes) {
    hero.x = lerp(hero.x, hero.targetX, interpolationFactor);
    hero.y = lerp(hero.y, hero.targetY, interpolationFactor);
  }
}
```

---

## 설정값

**위치:** `shared/types/hostBasedNetwork.ts`

```typescript
export const HOST_BASED_CONFIG = {
  // 상태 동기화 간격
  STATE_SYNC_INTERVAL: 50,  // 50ms (20Hz)

  // 입력 처리 간격
  INPUT_PROCESS_INTERVAL: 16,  // ~60Hz

  // 보간 설정
  INTERPOLATION: {
    ENABLED: true,
    DELAY: 100,              // 100ms 딜레이
    POSITION_THRESHOLD: 50,  // 위치 차이 임계값
    SNAP_THRESHOLD: 200,     // 스냅 임계값
  },

  // 로컬 예측 설정
  LOCAL_PREDICTION: {
    ENABLED: true,
    MAX_PREDICTION_TIME: 200,  // 최대 예측 시간 (ms)
  },

  // 플레이어 수
  MAX_PLAYERS: 4,
  MIN_PLAYERS: 1,
};
```

---

## 파일 구조

```
server/
├── src/
│   ├── game/
│   │   ├── RPGServerGameEngine.ts   # 서버 게임 엔진 (메인 루프)
│   │   ├── RPGCoopGameRoom.ts       # 게임 방 관리
│   │   ├── rpgServerHeroSystem.ts   # 영웅 시스템
│   │   ├── rpgServerSkillSystem.ts  # 스킬 시스템 (전직 포함)
│   │   ├── rpgServerEnemySystem.ts  # 적 AI 시스템
│   │   ├── rpgServerBossSystem.ts   # 보스 시스템
│   │   ├── rpgServerGameSystems.ts  # 게임 시스템 (넥서스, 골드, 직렬화)
│   │   ├── rpgServerConfig.ts       # 설정값
│   │   ├── rpgServerTypes.ts        # 서버 타입 정의
│   │   └── rpgServerUtils.ts        # 유틸리티
│   ├── room/
│   │   └── CoopRoomManager.ts       # 협동 방 관리자
│   └── websocket/
│       ├── WebSocketServer.ts       # WebSocket 서버
│       └── MessageHandler.ts        # 메시지 핸들러

shared/
└── types/
    ├── hostBasedNetwork.ts          # 네트워크 타입
    └── rpgNetwork.ts                # RPG 네트워크 타입

src/
├── hooks/
│   ├── useNetworkSync.ts            # 네트워크 동기화
│   └── useRPGGameLoop.ts            # 게임 루프 (싱글/멀티 분기)
├── stores/
│   └── useRPGStore.ts               # RPG 상태 관리
└── types/
    └── rpg.ts                       # RPG 타입 정의 (Buff 등)
```

---

## 장점

1. **치트 방지**: 서버가 모든 게임 로직을 실행하므로 클라이언트 조작 불가
2. **호스트 이탈 대응**: 호스트가 없으므로 누구나 나가도 게임 계속 진행
3. **공정성**: 모든 클라이언트가 동등한 조건
4. **일관성**: 서버 상태가 권위적이므로 동기화 문제 감소

## 고려사항

1. **서버 부하**: 게임 로직이 서버에서 실행되므로 서버 리소스 사용 증가
2. **지연시간**: 클라이언트 예측 및 보간으로 보완 필요
3. **스케일링**: 동시 게임 수 증가 시 서버 확장 필요
4. **포트 관리**: 서버 종료 시 게임 엔진의 setInterval을 정리해야 포트가 해제됨

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|-----------|
| 2024-01 | 서버 권위 모델 초기 구현 |
| 2024-02 | 전직 스킬 시스템 추가 (8개 전직 W/E 스킬) |
| 2024-02 | 버프 시스템 확장 (damageTaken, moveSpeedBonus) |
| 2024-02 | 스킬 슬롯 key 필드 도입 (type 접미사 대신) |
| 2024-02 | 서버 모듈 분리 (hero, skill, enemy, boss, game systems) |
| 2025-02 | 레거시 호스트 기반 코드 제거 (HostBasedClientMessage, HostBasedServerMessage 등) |
