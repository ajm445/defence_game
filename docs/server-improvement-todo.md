# 서버/네트워크 개선 TODO

> 작성일: 2026-03-13
> 상태: 계획 수립 완료
> 관련 파일 기준: server/src/

---

## Tier 1: 즉시 필요 (보안 취약점)

### 1.1 글로벌 메시지 속도 제한
- [x] WebSocket 연결당 초당 메시지 수 제한 (120msg/sec)
- [x] 초과 시 경고 → 3회 초과 시 연결 종료
- [ ] IP 기반 연결 수 제한 추가 검토

| 항목 | 내용 |
|------|------|
| 영향도 | CRITICAL - 모든 DoS 공격의 진입점 |
| 난이도 | 낮음 |
| 부작용 | 없음 |
| 파일 | `server/src/websocket/WebSocketServer.ts` (메시지 핸들러) |

**현황:**
- 64KB `maxPayload`만 존재, 연결당 메시지 횟수 제한 없음
- 40개+ 핸들러가 속도 제한 없이 노출
- 악의적 클라이언트가 무한 메시지 전송으로 서버 과부하 가능

**구현 방향:**
- `WebSocketServer.ts` 메시지 핸들러에 슬라이딩 윈도우 카운터 추가
- 연결별 `messageCount` + `windowStart` 추적
- 제한 초과 시 로그 + 연결 종료

---

### 1.2 스킬 타겟 사거리 검증
- [x] `executeSkill()` 진입부에 hero↔target 거리 체크 (1000px 제한)
- [x] 저격수 E (무제한 사거리 보스 전용) 예외 처리
- [x] 범위 초과 시 스킬 실행 거부

| 항목 | 내용 |
|------|------|
| 영향도 | CRITICAL - 맵 어디서든 데미지 가능 |
| 난이도 | 낮음 |
| 부작용 | 없음 (정상 플레이는 항상 사거리 내) |
| 파일 | `server/src/game/rpgServerSkillSystem.ts` |

**현황:**
- 마법사 W(노바), 궁수 E 등이 `targetX/targetY`를 거리 검증 없이 사용
- 클라이언트가 hero 위치 (0,0)에서 target (3000,2000)으로 스킬 시전 가능
- Q스킬(기본 공격)은 `attackRange` 체크 존재하지만 W/E는 없음

**구현 방향:**
```typescript
// executeSkill() 진입부
const distToTarget = distance(hero.x, hero.y, targetX, targetY);
const maxSkillRange = getSkillMaxRange(hero, skillSlot); // 스킬별 최대 사거리
if (distToTarget > maxSkillRange) return; // 거부
```

---

### 1.3 DB 접근 핸들러 속도 제한
- [x] `rateLimiter.ts`에 DB 관련 카테고리 추가 (dbQuery, socialAction, chat, login, modeChange, roomList, adminAuth)
- [x] 대상: `SEND_DM`, `GET_FRIENDS_LIST`, `SEND_FRIEND_REQUEST`, `GET_DM_HISTORY`, `USER_LOGIN` 등
- [x] 브로드캐스트 핸들러 제한: `LOBBY_CHAT_SEND`, `CHANGE_GAME_MODE`

| 항목 | 내용 |
|------|------|
| 영향도 | HIGH - DB 커넥션 풀 고갈 → 전체 서비스 다운 |
| 난이도 | 낮음 |
| 부작용 | 없음 (정상 사용 빈도 훨씬 낮음) |
| 파일 | `server/src/middleware/rateLimiter.ts`, `server/src/websocket/MessageHandler.ts` |

**현황:**
- `SEND_DM` 등 async DB 작업이 속도 제한 없이 노출
- 1000개 동시 전송 → DB 커넥션 풀 고갈 가능
- `LOBBY_CHAT_SEND`는 모든 로비 플레이어에게 브로드캐스트 (증폭 효과)

**구현 방향:**
```typescript
// rateLimiter.ts 추가
dbQuery: new RateLimiter(200),      // 200ms (초당 5회)
socialAction: new RateLimiter(1000), // 1초 (친구 요청 등)
login: new RateLimiter(5000),        // 5초
chat: new RateLimiter(500),          // 500ms
```

---

## Tier 2: 빠른 시일 내 (게임 무결성)

### 2.1 이동 속도 검증 (Speed Hack 방지)
- [x] `processInput()`에서 서버 위치 대비 클라이언트 위치 거리 검증
- [x] 최대 허용 속도 계산 (`getHeroMaxSpeed()` - config.speed + swiftness 버프)
- [x] 돌진(dash), 시전(casting), 스턴 상태 예외 처리
- [x] 마진: 속도×3배 + 80px 고정 (네트워크 지터/패킷 누적 대응)
- [x] 보스 넉백 후 1초간 속도 검증 완화 (`_lastKnockbackTime` 기반)

| 항목 | 내용 |
|------|------|
| 영향도 | HIGH - 순간이동으로 게임 밸런스 파괴 |
| 난이도 | 중간 |
| 부작용 | **주의** - 네트워크 지연 시 정상 이동 거부 위험 |
| 파일 | `server/src/game/RPGServerGameEngine.ts` (processInput, L375-403) |

**현황:**
- 위치 차이 ≥200px이면 클라이언트 위치로 하드 스냅 (텔레포트 허용)
- 프레임당 이동 속도 체크 없음 (정상 ~6px, 현재 허용 200px = 33배)
- 방향 벡터는 검증하지만 위치 점프는 검증 안 함

**구현 방향:**
```typescript
// processInput()에 추가
if (!hero.dashState && !hero.castingUntil) {
  const maxSpeed = calculateMaxSpeed(hero); // 속도 + 버프 + 업그레이드
  const maxDist = maxSpeed * elapsedTime * 60 * 2.0; // 2배 마진
  const dist = distance(hero._lastValidX, hero._lastValidY, input.position.x, input.position.y);
  if (dist > maxDist + 50) { // 50px 추가 마진 (네트워크 지터)
    // 서버 위치 유지, 클라이언트 위치 무시
    return;
  }
}
hero._lastValidX = hero.x;
hero._lastValidY = hero.y;
```

**주의사항:**
- 돌진 스킬 (전사 W, 기사 W) 사용 시 정상적으로 큰 이동 발생 → 예외 필수
- 넉백, 스턴 해제 후 위치 보정 시 큰 차이 발생 가능
- 네트워크 지터로 패킷 누적 시 큰 위치 차이 → 마진 충분히 확보

---

### 2.2 WebSocket Ping/Pong 추가
- [x] 서버에서 30초 간격 ping 전송
- [x] pong 미응답 시 연결 종료 (`ws.terminate()`)
- [x] 서버 종료 시 pingInterval 정리
- [ ] 연결 끊김 시 게임 내 처리 (일시 정지 / AI 전환) - 별도 기능

| 항목 | 내용 |
|------|------|
| 영향도 | HIGH - 좀비 연결 감지 불가, 리소스 누수 |
| 난이도 | 낮음 |
| 부작용 | 없음 |
| 파일 | `server/src/websocket/WebSocketServer.ts` |

**현황:**
- ping/pong 설정 없음
- 클라이언트 브라우저 강제 종료 시 서버가 감지 못할 수 있음
- 게임 중 좀비 플레이어 발생 → 팀원 불이익

**구현 방향:**
```typescript
// WebSocketServer.ts
const PING_INTERVAL = 30000; // 30초
const PONG_TIMEOUT = 10000;  // 10초 내 응답 없으면 종료

setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) { ws.terminate(); return; }
    ws.isAlive = false;
    ws.ping();
  });
}, PING_INTERVAL);

ws.on('pong', () => { ws.isAlive = true; });
```

---

### 2.3 플레이어 조회 O(n) → O(1)
- [x] `playersByUserId: Map<string, Player>` 인덱스 추가
- [x] 로그인 시 `indexPlayerByUserId()`, 로그아웃/연결해제 시 `removePlayerUserIdIndex()` 호출
- [x] `getPlayerByUserId()` → `Map.get()` 변경 (O(1))

| 항목 | 내용 |
|------|------|
| 영향도 | MEDIUM - 동시접속 1000+에서 성능 병목 |
| 난이도 | 낮음 |
| 부작용 | 없음 (추가 메모리 미미) |
| 파일 | `server/src/state/players.ts` |

**현황:**
- `getPlayerByUserId()`가 `players.values()` 전체 순회 (O(n))
- 로그인, 친구 조회, 모드 변경 알림 등 빈번하게 호출
- 동시접속 1000명일 때 매번 1000회 순회

---

## Tier 3: 중기 개선 (성능/품질)

### 3.1 브로드캐스트 좌표 정수화
- [x] 영웅/적 좌표를 `Math.round()` 적용 후 직렬화
- [x] 쿨다운 값 0.1초 단위로 양자화
- [x] HP 정수화, gameTime 0.1초 양자화
- [ ] JSON 페이로드 크기 측정 비교

| 항목 | 내용 |
|------|------|
| 영향도 | MEDIUM - 약 8~10% 대역폭 절감 |
| 난이도 | 낮음 |
| 부작용 | 없음 (시각적 차이 없음, 서브픽셀 정밀도 불필요) |
| 파일 | `server/src/game/rpgServerGameSystems.ts` (serializeGameState) |

**현황:**
- 좌표: `123.456789` → JSON에서 불필요한 소수점 (문자열 크기 증가)
- 쿨다운: `2.3456789` → 0.1초 단위면 충분
- 4인 게임 기준: 21.3KB × 30Hz = 639KB/s/플레이어

---

### 3.2 타입 안전성 강화
- [x] `as any` 캐스트 제거 (useNetworkSync.ts: mapTheme→MapTheme, advancedClass→AdvancedHeroClass, heroClass→HeroClass 5곳)
- [x] playerId 스푸핑 확인: 서버는 연결 기반 playerId만 사용 (input.playerId 미참조, 이미 안전)
- [x] `PlayerInput` skillUsed.targetX/Y에 NaN/Infinity 검증 추가 (`isValidRPGCoordinate`)
- [x] `PlayerInput` timestamp NaN/Infinity 검증 추가
- [ ] shared/types 인터페이스에 런타임 검증 함수 추가 검토

| 항목 | 내용 |
|------|------|
| 영향도 | MEDIUM - 런타임 에러 방지, playerId 스푸핑 차단 |
| 난이도 | 중간 |
| 부작용 | 없음 |
| 파일 | `shared/types/hostBasedNetwork.ts`, `src/hooks/useNetworkSync.ts`, `server/src/websocket/MessageHandler.ts` |

**현황:**
- 클라이언트가 `playerId`를 직접 전송 → 다른 플레이어 ID로 조작 가능
- `as any` 캐스트로 타입 안전성 우회 5곳
- NaN/Infinity 값이 서버까지 전파 가능

---

### 3.3 방 목록 브로드캐스트 최적화
- [x] 방 변경 이벤트 디바운싱 (100ms 내 변경 누적 후 1회 전송)
- [x] 서버 종료 시 디바운스 타이머 정리 (`stopRoomCleanupTimer`)
- [ ] 델타 업데이트 검토 (추가/삭제된 방만 전송)
- [ ] 로비 플레이어 수 기반 전송 빈도 조절

| 항목 | 내용 |
|------|------|
| 영향도 | LOW-MEDIUM |
| 난이도 | 중간 |
| 부작용 | 없음 |
| 파일 | `server/src/rooms/CoopRoomManager.ts` (broadcastRoomListUpdate) |

---

## Tier 4: 장기 개선 (확장성)

### 4.1 델타 업데이트 시스템
- [x] 변경 감지 dirty flags (nexus HP, base HP, gold, upgrades, stats)
- [x] 변경된 섹션만 직렬화하여 전송 (`serializeDeltaGameState`)
- [x] 10프레임마다 풀 스냅샷 (`FULL_SNAPSHOT_INTERVAL = 10`, ~300ms)
- [x] 클라이언트 델타 적용 (`?? prev` 패턴으로 이전 값 유지)

| 항목 | 내용 |
|------|------|
| 영향도 | MEDIUM - 추가 18% 대역폭 절감 (정수화와 합산 -26%) |
| 난이도 | **높음** - 직렬화/역직렬화 리팩터링, 패킷 유실 복구 |
| 부작용 | **주의** - 패킷 유실 시 상태 불일치 위험 |
| 파일 | `server/src/game/rpgServerGameSystems.ts`, `src/stores/useRPGStore.ts` |

**현재 대역폭:**
- 4인 게임: 21.3KB × 30Hz = 2.52 Mbps (서버 업링크)
- 정수화 적용 시: ~19KB → 2.28 Mbps
- 델타까지 적용 시: ~14KB → 1.68 Mbps (-34%)

---

### 4.2 이펙트 스트림 분리
- [x] 시각 이펙트 (damageNumbers, basicAttackEffects, nexusLaserEffects, bossSkillExecutedEffects)를 15Hz로 분리
- [x] 게임 상태 (위치, HP, 게임플레이 이펙트)는 30Hz 유지
- [x] 빈 이펙트 전송 생략 최적화
- [x] 클라이언트 `applyEffectState` 분리 처리

| 항목 | 내용 |
|------|------|
| 영향도 | LOW-MEDIUM - 추가 8% 대역폭 절감 |
| 난이도 | 중간 |
| 부작용 | 이펙트 표시 약간 지연 (체감 어려움) |

---

### 4.3 입력 시퀀스 ACK 프로토콜
- [x] 클라이언트 입력에 시퀀스 번호 부여 (`seq` 필드, 자동 증가)
- [x] 서버에서 처리 완료된 시퀀스 번호 추적 (`lastProcessedSeq` Map)
- [x] 게임 상태 브로드캐스트에 `inputAcks` 포함
- [x] 클라이언트에서 ACK 수신 및 추적 (`_lastAckedSeq`)
- [ ] 클라이언트 미확인 입력 재전송 로직 (향후 확장)

| 항목 | 내용 |
|------|------|
| 영향도 | MEDIUM - 입력 누락 방지, 정확한 클라이언트 예측 |
| 난이도 | **높음** |
| 부작용 | 네트워크 오버헤드 소폭 증가 |

---

## 진행 상태 요약

| Tier | 항목 | 상태 | 비고 |
|------|------|------|------|
| 1 | 글로벌 메시지 속도 제한 | ✅ 완료 | 120msg/sec, 경고 3회 시 연결 종료 |
| 1 | 스킬 타겟 사거리 검증 | ✅ 완료 | 1000px 제한, 저격수 E 예외 |
| 1 | DB 핸들러 속도 제한 | ✅ 완료 | 7개 카테고리 추가 |
| 2 | 이동 속도 검증 | ✅ 완료 | maxSpeed×3 + 80px 마진, dash/cast/stun 예외 |
| 2 | WebSocket Ping/Pong | ✅ 완료 | 30초 ping, 미응답 시 terminate |
| 2 | 플레이어 조회 O(1) | ✅ 완료 | playersByUserId Map 인덱스 |
| 3 | 좌표 정수화 | ✅ 완료 | 좌표/HP Math.round, 쿨다운/gameTime 0.1초 양자화 |
| 3 | 타입 안전성 강화 | ✅ 완료 | as any 5곳 제거, skillUsed/timestamp NaN 검증 |
| 3 | 방 목록 최적화 | ✅ 완료 | 100ms 디바운싱 |
| 4 | 델타 업데이트 | ✅ 완료 | dirty flags + 10프레임 풀 스냅샷 |
| 4 | 이펙트 스트림 분리 | ✅ 완료 | 15Hz 분리, 빈 이펙트 스킵 |
| 4 | 입력 시퀀스 ACK | ✅ 완료 | seq 부여 + 서버 ACK 응답 |
