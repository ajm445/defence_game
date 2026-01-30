# 클라이언트 캐릭터 움직임 개선

> 버전: V1.17.20
> 최종 수정: 2025-01-30

## 개요

멀티플레이어 환경에서 다른 플레이어 캐릭터의 움직임이 끊어지거나 기계적으로 보이는 문제를 해결하기 위한 보간(interpolation) 시스템 개선 문서입니다.

---

## 현재 상태 분석

### 1. 호스트-클라이언트 통신 구조

**호스트 (Host)**
- 모든 게임 로직을 처리 (충돌, 데미지, 이동 등)
- 50ms (20Hz) 간격으로 전체 게임 상태를 직렬화하여 클라이언트에 전송
- `serializeGameState()` 함수로 상태 직렬화

**클라이언트 (Client)**
- 호스트로부터 받은 상태를 역직렬화하여 적용
- 자신의 입력(이동, 스킬)만 호스트에 전송
- 다른 플레이어 캐릭터는 보간(interpolation)으로 표시

### 2. 기존 보간 구현 (개선 전)

```typescript
// 보간 기본 설정
const interpolationDuration = 50; // 50ms

// 선형 보간 적용
const t = Math.min(1, timeSinceUpdate / interpolationDuration);
const x = interp.prevX + (interp.targetX - interp.prevX) * t;
const y = interp.prevY + (interp.targetY - interp.prevY) * t;
```

**문제점:**
- 선형 보간(linear lerp)으로 인해 움직임이 기계적이고 끊어지는 느낌
- 50ms 보간 시간이 네트워크 전송 간격과 동일하여 버퍼 부족
- 이동 방향 정보를 활용하지 않아 예측 불가

### 3. 기존 위치 보정 로직

```typescript
// 오차 임계값
const maxPosError = 50;      // 중간 오차
const criticalPosError = 150; // 심각한 오차

// 보정 방식
if (posErrorX > criticalPosError) {
  syncX = hero.x; // 즉시 동기화
} else if (posErrorX > maxPosError && !isMoving) {
  syncX = localHero.x * 0.7 + hero.x * 0.3; // 빠른 lerp
} else if (posErrorX > maxPosError && isMoving) {
  syncX = localHero.x * 0.9 + hero.x * 0.1; // 느린 lerp
}
```

---

## 개선 방안

### 방안 1: 이징 함수 적용 (Easing Functions) ✅ 구현됨

**기존:** 선형 보간 `t`
**개선:** Ease-out Cubic 적용

```typescript
// Ease-out cubic: 시작이 빠르고 끝이 부드러움
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

const easedT = easeOutCubic(t);
const x = interp.prevX + (interp.targetX - interp.prevX) * easedT;
```

**장점:**
- 구현이 간단함
- 움직임이 자연스럽게 감속
- 기존 코드 변경 최소화

**예상 효과:** 중간 정도의 개선

---

### 방안 2: 보간 시간 증가 ✅ 구현됨

**기존:** 50ms (네트워크 전송과 동일)
**개선:** 80ms (전송 간격의 1.6배)

```typescript
const interpolationDuration = 80; // 80ms로 증가
```

**장점:**
- 네트워크 지터(jitter) 흡수 가능
- 더 부드러운 움직임
- 간단한 수정

**단점:**
- 반응성 약간 저하 (80ms 지연)

---

### 방안 3: 속도 기반 예측 (Velocity Prediction) ✅ 구현됨

현재 전송되는 `moveDirection` 정보를 활용한 예측:

```typescript
interface HeroInterpolation {
  prevX: number;
  prevY: number;
  targetX: number;
  targetY: number;
  velocityX: number;        // 추가
  velocityY: number;        // 추가
  moveDirectionX: number;   // 추가
  moveDirectionY: number;   // 추가
  moveSpeed: number;        // 추가
  lastUpdateTime: number;
}

// 속도 계산 (위치 변화 기반)
const velocityX = (hero.x - existingInterpolation.targetX) / (50 / 1000);
const velocityY = (hero.y - existingInterpolation.targetY) / (50 / 1000);
```

**장점:**
- 이동 방향으로 자연스러운 예측
- 네트워크 지연 보상 가능

**단점:**
- 방향 전환 시 약간의 오버슈팅 가능
- 구현 복잡도 증가

---

### 방안 4: 클라이언트 측 이동 시뮬레이션 ✅ 구현됨

클라이언트에서 다른 플레이어의 이동을 로컬로 시뮬레이션:

```typescript
// 클라이언트 측 이동 시뮬레이션
const isMoving = interp.moveDirectionX !== 0 || interp.moveDirectionY !== 0;

if (t >= 1 && isMoving) {
  // 보간 완료 후 이동 중이면 예측 이동
  const extraTime = (timeSinceUpdate - interpolationDuration) / 1000;
  const predictedMoveX = interp.moveDirectionX * interp.moveSpeed * extraTime;
  const predictedMoveY = interp.moveDirectionY * interp.moveSpeed * extraTime;

  x = interp.targetX + predictedMoveX;
  y = interp.targetY + predictedMoveY;

  // 맵 경계 제한
  x = Math.max(0, Math.min(RPG_CONFIG.MAP_WIDTH, x));
  y = Math.max(0, Math.min(RPG_CONFIG.MAP_HEIGHT, y));
} else {
  // 보간 중: 이징 함수 적용
  x = interp.prevX + (interp.targetX - interp.prevX) * easedT;
  y = interp.prevY + (interp.targetY - interp.prevY) * easedT;
}
```

**장점:**
- 가장 부드러운 움직임 가능
- 네트워크 지연과 관계없이 60fps 이동
- 로컬 플레이어와 동일한 움직임 품질

**단점:**
- 구현 복잡도 가장 높음
- 서버 권한 모델 유지를 위한 보정 로직 필요

---

## 구현 결과

### 변경된 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/stores/useRPGStore.ts` | `HeroInterpolation` 타입 정의, 보간 로직 개선, 이펙트 동기화 |
| `src/hooks/useRPGGameLoop.ts` | 클라이언트 보간 업데이트 호출, 이펙트 처리 |
| `src/types/rpg.ts` | `BossSkillExecutedEffect` 타입 추가 |
| `shared/types/hostBasedNetwork.ts` | 네트워크 상태에 이펙트 배열 추가 |

### HeroInterpolation 타입 (신규)

```typescript
interface HeroInterpolation {
  prevX: number;
  prevY: number;
  targetX: number;
  targetY: number;
  velocityX: number;        // 이동 속도 X
  velocityY: number;        // 이동 속도 Y
  moveDirectionX: number;   // 이동 방향 X (-1, 0, 1)
  moveDirectionY: number;   // 이동 방향 Y (-1, 0, 1)
  moveSpeed: number;        // 영웅 이동 속도 (config.speed)
  lastUpdateTime: number;
}
```

### 핵심 로직 위치

- **applySerializedState()**: 서버 상태 수신 시 보간 데이터 업데이트
- **updateOtherHeroesInterpolation()**: 매 프레임 보간 및 예측 이동 처리

---

---

## 이펙트 동기화 (V1.17.12)

### 문제점

기존 보스 스킬 이펙트 동기화 방식의 문제:

1. 클라이언트가 `bossSkillWarnings`의 진행도 95%를 감지하여 이펙트 재생
2. 호스트에서 스킬 실행 후 경고가 즉시 제거됨
3. 클라이언트가 상태를 받을 때 이미 경고가 없어 이펙트 누락

### 해결 방안

`BasicAttackEffect`와 동일한 패턴으로 별도의 동기화 배열 추가:

```typescript
// 보스 스킬 실행 이펙트 인터페이스
interface BossSkillExecutedEffect {
  id: string;           // 고유 ID (중복 방지)
  skillType: BossSkillType;
  x: number;
  y: number;
  timestamp: number;
  healPercent?: number; // 힐 스킬의 경우
}
```

### 동기화 흐름

```
호스트:
1. 스킬 실행 시 addBossSkillExecutedEffect() 호출
2. 이펙트 정보가 bossSkillExecutedEffects 배열에 추가
3. serializeGameState()로 상태 직렬화 시 포함
4. cleanBossSkillExecutedEffects()로 500ms 후 정리

클라이언트:
1. applySerializedState()로 이펙트 배열 수신
2. 새로운 이펙트 ID 감지 시 이펙트/사운드 재생
3. processedEffectIdsRef로 중복 재생 방지
```

---

## 테스트 체크리스트

- [x] 싱글플레이어에서 기존 동작 유지
- [x] 멀티플레이어 호스트에서 다른 플레이어 움직임 부드러움
- [x] 멀티플레이어 클라이언트에서 모든 캐릭터 움직임 부드러움
- [x] 클라이언트에서 보스 스킬 이펙트/사운드 정상 재생
- [ ] 네트워크 지연 상황에서의 동작 (추가 테스트 필요)
- [ ] 급격한 방향 전환 시 자연스러운 보정 (추가 테스트 필요)

---

## 향후 개선 사항

### 1. 적응형 보간 시간
네트워크 상태에 따라 보간 시간을 동적으로 조절:
```typescript
// 핑이 높으면 보간 시간 증가
const adaptiveInterpolation = baseInterpolation + (ping * 0.5);
```

### 2. 스냅샷 버퍼링
여러 상태를 버퍼에 저장하여 더 안정적인 보간:
```typescript
const snapshotBuffer: GameState[] = [];
const BUFFER_SIZE = 3; // 3개 스냅샷 유지
```

### 3. 서버 측 이동 예측
서버에서도 클라이언트 이동을 예측하여 더 정확한 충돌 판정:
```typescript
// 서버에서 클라이언트 위치 예측
const predictedPos = lastKnownPos + velocity * timeSinceLastUpdate;
```

---

## 데미지 숫자 중복 버그 수정 (V1.17.20)

### 문제점

멀티플레이어 클라이언트(비호스트)에서 데미지 숫자가 중복으로 나타나는 버그:

```
1. 호스트가 데미지 숫자 생성 (ID: dmg_123)
2. 호스트가 50ms 간격으로 상태 브로드캐스트
3. 클라이언트가 데미지 숫자 수신 및 렌더링
4. 클라이언트의 로컬 타이머 (1초) 만료 → 데미지 숫자 로컬 제거
5. 호스트가 아직 정리하지 않은 상태에서 다음 브로드캐스트
6. 클라이언트가 동일한 데미지 숫자 다시 수신 → 중복 렌더링!
```

**근본 원인:** 호스트와 클라이언트의 정리 타이밍 불일치

### 해결 방안

멀티플레이어 클라이언트에서는 로컬 타이머로 데미지 숫자를 제거하지 않고, 호스트의 상태 동기화에만 의존:

```typescript
// RPGDamageNumbers.tsx

// 멀티플레이어 클라이언트 여부 확인
const isMultiplayerClient = multiplayer.isMultiplayer && !multiplayer.isHost;

// DamageNumberItem 컴포넌트
useEffect(() => {
  if (isMultiplayerClient) return; // 클라이언트는 로컬에서 제거하지 않음

  const timer = setTimeout(() => {
    removeDamageNumber(item.id);
  }, 1000);
  return () => clearTimeout(timer);
}, [item.id, removeDamageNumber, isMultiplayerClient]);

// 컨테이너 컴포넌트의 정리 인터벌도 동일하게 처리
useEffect(() => {
  if (isMultiplayerClient) return; // 클라이언트는 로컬 정리하지 않음

  const interval = setInterval(() => {
    cleanDamageNumbers();
  }, 500);
  return () => clearInterval(interval);
}, [cleanDamageNumbers, isMultiplayerClient]);
```

### 동작 방식

| 모드 | 데미지 숫자 생성 | 데미지 숫자 제거 |
|------|-----------------|-----------------|
| 싱글플레이어 | 로컬 게임 루프 | 로컬 타이머 (1초) + 정리 인터벌 (500ms) |
| 멀티플레이어 호스트 | 호스트 게임 루프 | 로컬 타이머 (1초) + 정리 인터벌 (500ms) |
| 멀티플레이어 클라이언트 | 호스트 상태 동기화 | 호스트 상태 동기화 (로컬 제거 없음) |

### 변경된 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/components/ui/RPGDamageNumbers.tsx` | 멀티플레이어 클라이언트 여부 확인 및 조건부 로컬 제거 |

---

## 참고 자료

- [Valve - Source Multiplayer Networking](https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking)
- [Gabriel Gambetta - Fast-Paced Multiplayer](https://www.gabrielgambetta.com/client-server-game-architecture.html)
- [Glenn Fiedler - Networked Physics](https://gafferongames.com/post/networked_physics_in_virtual_reality/)
