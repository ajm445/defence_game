# 모바일/태블릿 반응형 UI 가이드

> **버전**: V1.23.1
> **상태**: 완료

---

## 목차

1. [설계 철학](#1-설계-철학)
2. [디바이스 감지 시스템](#2-디바이스-감지-시스템)
3. [Viewport 스케일링 전략](#3-viewport-스케일링-전략)
4. [전역 상태 관리 (useUIStore)](#4-전역-상태-관리-uiuistore)
5. [터치 입력 시스템](#5-터치-입력-시스템)
6. [가상 조이스틱 (VirtualJoystick)](#6-가상-조이스틱-virtualjoystick)
7. [터치 스킬 버튼 (TouchSkillButtons)](#7-터치-스킬-버튼-touchskillbuttons)
8. [터치 업그레이드 패널 (TouchUpgradeToggle)](#8-터치-업그레이드-패널-touchupgradetoggle)
9. [화면 방향 관리](#9-화면-방향-관리)
10. [캔버스 및 카메라 변경](#10-캔버스-및-카메라-변경)
11. [UI 컴포넌트별 반응형 대응](#11-ui-컴포넌트별-반응형-대응)
12. [CSS 및 글로벌 스타일](#12-css-및-글로벌-스타일)
13. [파일 목록 및 변경 요약](#13-파일-목록-및-변경-요약)
14. [개발 가이드라인](#14-개발-가이드라인)

---

## 1. 설계 철학

### 핵심 원칙: Viewport 메타 스케일링

모바일/태블릿 대응에 "미디어 쿼리로 레이아웃 분기"하는 일반적인 방식 대신, **viewport 메타를 `width=1280`으로 고정**하여 브라우저가 데스크톱 UI를 자동 축소하는 방식을 채택했다.

```
데스크톱 UI 그대로 → 모바일에서 축소 렌더링 → 터치 컨트롤만 오버레이 추가
```

**장점**:
- 데스크톱 레이아웃을 모든 화면에서 동일하게 유지
- 새 화면 추가 시 데스크톱 레이아웃만 작성하면 됨
- 미디어 쿼리/조건부 분기 최소화
- 일관된 시각적 경험

**주의사항**:
- `isMobile`을 레이아웃 크기/간격 조정에 사용하지 말 것
- 기능적 차이(터치 조작, 키보드 안내 등)에만 `isTouchDevice` 사용
- 모달/폼 등 특정 요소는 `vw` 단위로 최대 너비 보정 필요

---

## 2. 디바이스 감지 시스템

### 파일: `src/hooks/useDeviceDetect.ts`

앱 최상위(`App.tsx`)에서 한 번 호출되며, 디바이스 타입/방향/터치 여부를 감지한다.

### 디바이스 분류 기준

| 디바이스 | 조건 | uiScale |
|----------|------|---------|
| **Phone** | 터치 지원 + `screen` 짧은 변 ≤ 500px | `0.65` |
| **Tablet** | 터치 지원 + `screen` 짧은 변 ≤ 900px | `0.85` |
| **Desktop** | 터치 미지원 또는 짧은 변 > 900px | `1.0` |

```typescript
function getDeviceType(): DeviceType {
  const isTouchDevice = detectTouchDevice();
  if (!isTouchDevice) return 'desktop';

  const shorterDimension = Math.min(screen.width, screen.height);
  if (shorterDimension <= 500) return 'phone';
  if (shorterDimension <= 900) return 'tablet';
  return 'desktop';
}
```

### 터치 감지

```typescript
function detectTouchDevice(): boolean {
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0
  );
}
```

### 방향 감지

```typescript
function getIsPortrait(): boolean {
  if (screen.orientation) {
    return screen.orientation.type.startsWith('portrait');
  }
  return window.matchMedia('(orientation: portrait)').matches;
}
```

### 이벤트 리스너

`resize`, `orientationchange`, `matchMedia('orientation: portrait')` 세 가지 이벤트를 모두 감시하여 디바이스 정보를 실시간 갱신한다.

### CSS 변수 연동

```typescript
document.documentElement.style.setProperty('--ui-scale', String(uiScale));
```

`--ui-scale` CSS 변수를 통해 스타일시트에서도 스케일 값을 활용할 수 있다.

---

## 3. Viewport 스케일링 전략

### 파일: `src/hooks/useDeviceDetect.ts` → `updateViewportMeta()`

| 디바이스 | viewport meta |
|----------|---------------|
| Phone/Tablet | `width=1280, user-scalable=no, viewport-fit=cover` |
| Desktop | `width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover` |

#### 원리

1. Phone/Tablet에서 viewport를 `width=1280`으로 설정
2. 브라우저가 1280px 레이아웃을 물리 화면에 맞게 자동 축소
3. 데스크톱 UI가 비례적으로 줄어들어 모바일에서도 동일한 레이아웃 유지

#### `screen.width` vs `window.innerWidth`

- `screen.width/height`: 물리적 CSS 픽셀 크기로, viewport 메타 변경에 영향받지 않음 → **디바이스 분류에 사용**
- `window.innerWidth`: viewport 메타에 따라 변경됨 → 레이아웃 계산에 사용

### 파일: `index.html`

```html
<!-- 변경 전 -->
<meta name="viewport" content="width=device-width, initial-scale=1.0" />

<!-- 변경 후 -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
```

`user-scalable=no`로 사용자 확대/축소 방지, `viewport-fit=cover`로 노치/Safe Area 대응.

---

## 4. 전역 상태 관리 (useUIStore)

### 파일: `src/stores/useUIStore.ts`

추가된 상태 및 액션:

```typescript
// 상태
isMobile: boolean;           // 폰 여부
isTablet: boolean;           // 태블릿 여부
isTouchDevice: boolean;      // 터치 입력 지원 여부
isPortrait: boolean;         // 세로 방향 여부
uiScale: number;             // UI 스케일 (0.65 / 0.85 / 1.0)
isFullscreen: boolean;       // 전체화면 여부
mobileControlMode: 'skills' | 'upgrades';  // 모바일 하단 컨트롤 모드

// 액션
setDeviceInfo(info): void;   // 디바이스 정보 일괄 업데이트
setFullscreen(bool): void;   // 전체화면 상태 설정
setMobileControlMode(mode): void;  // 모바일 컨트롤 모드 전환
```

### 사용 패턴

```typescript
// 기능적 분기 (권장)
const isTouchDevice = useUIStore((s) => s.isTouchDevice);
if (isTouchDevice) { /* 터치 조작 표시 */ }

// UI 스케일 (터치 컴포넌트 내부)
const uiScale = useUIStore((s) => s.uiScale);
const btnSize = Math.round(56 * uiScale);

// 컴팩트 UI (폰 전용)
const isMobile = useUIStore((s) => s.isMobile);
if (isMobile) { /* 축소된 정보 패널 */ }
```

---

## 5. 터치 입력 시스템

### Mouse → Pointer 이벤트 마이그레이션

모든 캔버스 입력이 `onMouse*` 이벤트에서 `onPointer*` 이벤트로 교체되었다. Pointer 이벤트는 마우스와 터치를 모두 처리할 수 있어, 단일 코드로 양쪽을 지원한다.

#### 변경된 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/hooks/useMouseInput.ts` | RTS 캔버스 입력: `handleMouseDown/Move/Up` → `handlePointerDown/Move/Up` |
| `src/hooks/useRPGInput.ts` | RPG 캔버스 입력: 동일 변환 |
| `src/components/canvas/GameCanvas.tsx` | RTS 캔버스: `onMouse*` → `onPointer*`, `touchAction: 'none'` 추가 |
| `src/components/canvas/RPGCanvas.tsx` | RPG 캔버스: 동일 변환 |

#### 터치 전용 동작 (pointerType === 'touch')

**RTS 모드** (`useMouseInput.ts`):
- **한 손가락 드래그**: 카메라 팬 (마우스 우클릭 드래그와 동일)
- **한 손가락 짧은 탭** (이동 < 10px): 좌클릭으로 처리 (유닛 선택/벽 배치)
- **두 손가락 핀치**: 줌 인/아웃 (`zoomAt` 함수, 핀치 중심점 기준)

**RPG 모드** (`useRPGInput.ts`):
- **한 손가락 드래그**: 사망 시에만 카메라 팬 활성화 (생존 시에는 조이스틱 사용)
- **두 손가락 핀치**: 줌 인/아웃 (`setZoom`, `CAMERA.MIN_ZOOM` ~ `MAX_ZOOM` 범위)

#### 멀티 포인터 추적 구조

```typescript
const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
const lastPinchDistRef = useRef(0);
```

- `pointersRef`: 활성 포인터를 `pointerId → 좌표`로 추적
- `lastPinchDistRef`: 이전 핀치 거리 저장 (줌 스케일 계산용)

### 가장자리 스크롤 비활성화

**파일**: `src/hooks/useEdgeScroll.ts`

터치 디바이스에서는 화면 가장자리 스크롤이 불필요하므로 비활성화:

```typescript
if (running && currentScreen === 'game' && edgeScrollEnabled && !isTouchDevice) {
  // 가장자리 스크롤 실행
}
```

---

## 6. 가상 조이스틱 (VirtualJoystick)

### 파일: `src/components/touch/VirtualJoystick.tsx`

터치 디바이스 전용 이동 입력. RPG 모드에서 WASD 키보드 이동을 대체한다.

### 구조

```
VirtualJoystick
├── 터치 영역 (absolute, 화면 왼쪽 40%, 하단 50%)
├── 조이스틱 베이스 (fixed, 플로팅 - 터치 위치에 나타남)
│   ├── 외부 원 (반경 50px × uiScale)
│   └── 노브 (반경 20px × uiScale)
```

### 동작 흐름

1. **초기 상태**: 기본 위치(화면 왼쪽 15%, 높이 75%)에 반투명(opacity 0.6) 고스트 조이스틱 표시 (힌트)
2. **pointerDown**: 터치 위치에 조이스틱 베이스 이동 + 완전 불투명(opacity 1.0)
3. **pointerMove**: 노브를 드래그 방향으로 이동 (최대 50px × uiScale), 정규화된 방향 벡터 계산
4. **pointerUp**: 기본 위치로 복귀 + 반투명(opacity 0.6), 이동 정지 전송

### 사망 시 카메라 이동 (V1.23.1)

영웅 사망 시 조이스틱으로 카메라를 자유 이동(관전 모드)할 수 있다:

```typescript
if (isHeroDead) {
  // followHero 해제하여 게임 루프의 카메라 추적 방지
  if (camera.followHero) {
    useRPGStore.setState((s) => ({
      camera: { ...s.camera, followHero: false },
    }));
  }
  const camSpeed = 8;
  state.setCamera(camera.x + normX * camSpeed, camera.y + normY * camSpeed);
  return;
}
```

부활 시 `useRPGGameLoop`에서 사망→생존 전환을 감지하여 카메라를 영웅 위치에 즉시 스냅하고 `followHero: true`로 복원한다.

### 성능 최적화

- **DOM 직접 조작**: 노브 이동 시 `knobRef.current.style.transform`을 직접 변경 (React 리렌더링 회피)
- **방향 변경 임계값**: 방향 벡터 변화가 0.05 미만이면 상태 업데이트 건너뜀
- **데드존**: 10% 이내 이동은 무시

### 네트워크 연동

```typescript
// 이동 방향 전송
state.setMoveDirection({ x: normX, y: normY });
if (state.multiplayer.isMultiplayer) {
  sendMoveDirection({ x: normX, y: normY });
}
```

싱글/멀티플레이어 모두 지원. 멀티플레이어에서는 `sendMoveDirection`으로 서버에 방향 벡터 전송.

### 시전 중 이동 차단

```typescript
if (state.hero?.castingUntil && state.gameTime < state.hero.castingUntil) {
  return; // 시전 중 이동 무시
}
```

---

## 7. 터치 스킬 버튼 (TouchSkillButtons)

### 파일: `src/components/touch/TouchSkillButtons.tsx`

W(스킬)/E(궁극기) 스킬을 터치로 사용할 수 있는 버튼. RPG 모드에서 Shift/R 키보드 입력을 대체한다.

### 디바이스별 크기 (V1.23.1)

| 속성 | 폰 | 태블릿 |
|------|:---:|:------:|
| 버튼 크기 | 95px | 80px |
| 버튼 간격 | 30px | 20px |
| 레이아웃 | 가로 (flex-row) | 가로 (flex-row) |
| 아이콘 | text-3xl | text-3xl |
| 쿨다운 텍스트 | text-lg | text-lg |

스킬 아이콘 맵(`SKILL_ICON_MAP`)은 모듈 레벨 상수로 분리되어 있다.

> **주의**: React Hooks 규칙 준수를 위해 `if (!hero || hero.hp <= 0) return null` 조건은 반드시 모든 `useCallback` 훅 **뒤에** 위치해야 한다.

### 타겟팅 메커니즘

스킬 방향 지정에 두 가지 방식을 지원:

1. **탭 (짧은 터치)**: 가장 가까운 적 방향으로 자동 타겟
   ```typescript
   // 가장 가까운 적 탐색
   for (const enemy of enemies) {
     if (enemy.hp <= 0) continue;
     const d = Math.hypot(enemy.x - hero.x, enemy.y - hero.y);
     if (d < nearestDist) {
       nearest = enemy;
       nearestDist = d;
     }
   }
   ```

2. **드래그 (15px 이상 이동)**: 드래그 방향으로 타겟 설정
   ```typescript
   const dx = e.clientX - startRef.current.x;
   const dy = e.clientY - startRef.current.y;
   targetX = hero.x + (dx / dist) * 200;
   targetY = hero.y + (dy / dist) * 200;
   ```

### 스킬 아이콘 맵

각 스킬 타입에 대응하는 이모지 아이콘이 매핑되어 있다:

```typescript
const map: Record<string, string> = {
  warrior_w: '💨', warrior_e: '🔥',
  archer_w: '➡️', archer_e: '🌧️',
  knight_w: '🛡️', knight_e: '🏰',
  mage_w: '🔥', mage_e: '☄️',
  // ... 전직 스킬 포함
};
```

### 쿨다운 표시

- 하단에서 올라오는 어두운 오버레이 (`height: cooldownPercent%`)
- 중앙에 남은 초 표시 (`Math.ceil(cooldown)`)
- 다크나이트 E스킬 토글 활성 시 `ON` 배지 + 보라색 글로우

### 다크나이트 W스킬 로컬 예측

멀티플레이어에서 다크나이트 W스킬(암흑 찌르기) 사용 시 클라이언트 측 즉시 예측을 수행:

```typescript
if (state.hero?.advancedClass === 'darkKnight') {
  // HP 소모, 시전 상태, 방향 전환을 로컬에서 즉시 적용
  useRPGStore.setState((s) => ({
    hero: {
      ...s.hero,
      hp: s.hero.hp - hpCost,
      castingUntil: s.gameTime + 1.0,
      facingRight: dirX >= 0,
      // ...
    }
  }));
}
```

---

## 8. 터치 업그레이드 패널 (TouchUpgradeToggle)

### 파일: `src/components/touch/TouchUpgradeToggle.tsx`

모바일에서 골드 업그레이드 시스템에 접근하기 위한 상시 표시 그리드 패널. (V1.23.1에서 토글 방식 → 상시 표시로 변경)

### 구조

```
TouchUpgradeToggle (3열 그리드, 항상 표시)
├── ⚔️ 공격
├── 👟 속도
├── ❤️ HP
├── ⚡ 공속
├── 💰 골드
└── 🎯 거리 (원거리 클래스만)
```

### 디바이스별 크기 (V1.23.1)

| 속성 | 폰 | 태블릿 |
|------|:---:|:------:|
| 버튼 크기 | 62px | 52px |
| 그리드 간격 | 10px | 6px |
| 그리드 열 수 | 3열 | 3열 |

### 업그레이드 버튼 정보

각 버튼에 표시되는 정보:
- 스킬 아이콘 + 라벨
- 현재 레벨 뱃지 (좌상단, 원형, 18px)
- 비용 표시 (하단, 구매 가능 시 노란색 / 불가 시 빨간색)
- MAX 오버레이 (최대 레벨 도달 시)

### 제한 사항

- 공격속도 최소값(0.3s) 도달 시 추가 업그레이드 불가
- 사거리(range)는 원거리 클래스(궁수/마법사)만 표시

---

## 9. 화면 방향 관리

> **V1.23.1**: 전체화면 버튼(`FullscreenButton.tsx`)은 제거됨. `useFullscreen.ts` 훅은 유지되나 UI에서 사용하지 않음.

### 화면 방향 프롬프트 (`src/components/ui/OrientationPrompt.tsx`)

터치 디바이스에서 세로 모드 감지 시 전체 화면을 덮는 회전 안내 표시:

```typescript
if (!isTouchDevice || !isPortrait) return null;

// z-index 9999로 모든 UI 위에 표시
// 📱 이모지 + "가로로 회전해주세요" 메시지
// 회전 애니메이션 (rotatePhone keyframe)
```

---

## 10. 캔버스 및 카메라 변경

### useCanvas 변경 (`src/hooks/useCanvas.ts`)

RPG 모드에서 모바일 터치 컨트롤이 캔버스 위에 오버레이되므로, 하단 UI 패널 높이를 0으로 설정하여 캔버스를 전체 화면으로 확장:

```typescript
export const useCanvas = (fixedWidth?, fixedHeight?, fullscreen?: boolean) => {
  // fullscreen이면 패널 높이 0 → 캔버스 전체 화면
  const height = fixedHeight ?? window.innerHeight - (fullscreen ? 0 : CONFIG.UI_PANEL_HEIGHT);
};
```

RPGCanvas에서의 호출:

```typescript
const { canvasRef, dimensions, getContext } = useCanvas(undefined, undefined, true);
```

### 반응형 설정 (`src/constants/config.ts`)

`uiScale`에 따라 UI 패널/미니맵 크기 조정:

```typescript
export function getResponsiveConfig(uiScale: number) {
  return {
    UI_PANEL_HEIGHT: Math.round(120 * uiScale),
    MINIMAP_WIDTH: Math.round(200 * uiScale),
    MINIMAP_HEIGHT: Math.round(150 * uiScale),
  };
}
```

### RTS 미니맵 스케일링 (`src/components/canvas/Minimap.tsx`)

`uiScale`에 따라 미니맵 크기가 동적으로 조정되며, 터치 기기에서는 이중축소 방지:

```typescript
const responsiveConfig = getResponsiveConfig(isTouchDevice ? Math.max(uiScale, 1.0) : uiScale);
```

### RPG 미니맵 위치 (`src/renderer/drawRPGMinimap.ts`) (V1.23.1)

`getMinimapConfig(canvasWidth, canvasHeight, deviceInfo)` 시그니처로 디바이스별 Y 위치 분기:

| 디바이스 | 미니맵 Y 위치 |
|----------|:------------:|
| 데스크톱 | 캔버스 하단 (canvasHeight - 140) |
| 폰 | canvasHeight × 0.4 |
| 태블릿 | canvasHeight × 0.3 |

---

## 11. UI 컴포넌트별 반응형 대응

### RPG 게임 화면 (RPGModeScreen.tsx)

터치 디바이스에서는 `RPGTouchControls` 컨테이너(`src/components/touch/RPGTouchControls.tsx`)가 렌더링된다.

| 요소 | 데스크톱 | 터치 (폰) | 터치 (태블릿) |
|------|---------|----------|-------------|
| 하단 스킬바 + 업그레이드 | 일체형 패널 | 숨김 | 숨김 |
| 가상 조이스틱 | 숨김 | 좌하단 (opacity 0.6) | 좌하단 (opacity 0.6) |
| 터치 스킬 버튼 (W/E) | 숨김 | right 20%, bottom 12% | right 18%, bottom 10% |
| 업그레이드 그리드 | 숨김 | right 12px, bottom 14% | right 12px, bottom 10% |
| 조작법 안내 텍스트 | 표시 | 숨김 | 숨김 |

#### 터치 컨트롤 레이아웃 (V1.23.1)

```
[좌하단]                     [우측 중앙하단]    [우하단]
                              [W] [E]          [업그레이드]
  (고스트 조이스틱)            (가로 배치)       [3열 그리드]
```

- 스킬 버튼(W/E)은 가로 배치(flex-row), 항상 표시
- 업그레이드 그리드(3열)는 독립 컨테이너로 우하단에 항상 표시
- 미니맵은 캔버스 우측 중간(폰 40%, 태블릿 30%)에 위치하여 겹침 방지

### RPG 영웅 패널 (RPGHeroPanel.tsx)

| 요소 | 데스크톱 | 폰 |
|------|---------|-----|
| 패널 최소 너비 | 280px | 180px |
| 패딩 | p-4 | p-2 |
| 아바타 크기 | 56px | 40px |
| 이모지 크기 | text-3xl | text-xl |
| 스탯 그리드 | 4열 (공격/공속/속도/거리) | 2열 (공격/공속만) |
| 버프 아이콘 크기 | 36px | 28px |
| HP 바 높이 | h-3 | h-2 |

### RPG 팀 패널 (RPGTeamPanel - 아군 HP)

| 요소 | 데스크톱 | 폰 |
|------|---------|-----|
| 레이아웃 | 세로 리스트 (이름 + HP바) | 원형 HP 인디케이터 (가로 나열) |
| 크기 | min-w-200px | 40px 원형 |
| HP 표시 | 가로 HP 바 | SVG 원형 프로그레스 |

### RPG 웨이브 정보 (RPGWaveInfo.tsx)

- 폰: 패딩 `p-2`, 최소 너비 140px
- 데스크톱: 패딩 `p-4`, 최소 너비 200px

### RPG 타이머 (RPGGameTimer.tsx)

- 폰: 작은 패딩 (`px-3 py-1`), 작은 텍스트 (`text-base`), 좁은 최소 너비 (`3rem`)
- 데스크톱: 기본 (`px-5 py-2`, `text-xl`, `4rem`)

### RTS 게임 화면 (GameScreen.tsx) (V1.23.1)

| 요소 | 데스크톱 | 폰 | 태블릿 |
|------|---------|-----|--------|
| 하단 패널 높이 | 기본 | +24px | +12px |
| 하단 패널 패딩 | 없음 | 24px | 12px |
| 일시정지 버튼 | top 1rem | top 10.5rem | top 10.5rem |
| 미니맵 bottom | 20px | 28px | 24px |
| 이중축소 방지 | - | `Math.max(uiScale, 1.0)` | `Math.max(uiScale, 1.0)` |

> 전체화면 버튼은 V1.23.1에서 제거됨.

### RTS 리소스바 (ResourceBar.tsx)

- 폰: 축소된 아이콘 (14px), 라벨 숨김 (숫자만 표시), 좁은 간격
- 데스크톱: 전체 아이콘 (20px) + 라벨 + 숫자

### 친구 사이드바 (FriendSidebar.tsx)

- 폰: 완전히 숨김 (`if (isMobile) return null`)
- 데스크톱/태블릿: 정상 표시

### 모달 공통 패턴

모든 모달에 `vw` 기반 너비 + `max-width` 제한 패턴 적용:

```
변경 전: min-w-[400px]
변경 후: w-[90vw] sm:w-auto sm:min-w-[400px] max-w-[450px]
```

적용된 모달:
- `CharacterUpgradeModal` (92vw, max 500px)
- `ClassEncyclopediaModal` (95vw, max 900px)
- `RankingModal` (95vw, max 700px)
- `LevelUpNotification` (90vw, max 400px)
- `SecondEnhancementNotification` (90vw, max 450px)
- `RPGTutorialOverlay` (90vw, max 360px)
- `HelpModal` (특수 효과 그리드: 1열 → 3열 반응형)
- `PauseScreen` (80vw, max 350px)
- `RPGTutorialScreen` 일시정지/완료 모달 (90vw, max 400/450px)
- `LobbyScreen` (90vw, max auto)

### RPG 협동 로비 (RPGCoopLobbyScreen.tsx) - 모바일 전용 레이아웃

iPhone 12 Pro(844×390) 등 모바일 가로 모드에서 콘텐츠가 CSS 뷰포트 높이(~700px)를 크게 초과하여 잘림이 발생하는 문제를 해결하기 위해 `isMobile` 분기 레이아웃을 적용했다. 태블릿은 기존 스케일링(`contentScaleRef`)으로 충분하므로 데스크톱과 동일한 레이아웃을 유지한다.

#### 외부 래퍼 (모바일)

| 요소 | 데스크톱/태블릿 | 모바일 |
|------|----------------|--------|
| 제목 | `<h1>` + 10px 스페이서 + `<p>` + 30px 스페이서 | 제목과 부제를 분리, 스페이서 축소 (10px) |
| 콘텐츠 박스 | `px-10 py-10`, `min-h-[480px]` | `px-10 py-5`, `min-h` 제거 |
| 뒤로 가기 | `mt-8`, 30px 스페이서 | `mt-2`, 15px 스페이서, 작은 텍스트 |

#### renderLobby (모바일)

공유 요소를 변수로 추출 후 `isMobile` 분기:

```
[초대코드 + 방설정]          ← 기존과 동일 (가로 배치)
[플레이어 목록 | 채팅]       ← flex-row, 각 flex-1 min-w-0
[직업변경 버튼 | 게임시작]    ← flex-row, 같은 줄
[경고/에러/안내]              ← 기존과 동일
```

- 내부 컨테이너: `gap-3`, `padding: 15px` (카드 테두리와 간격 확보)
- 플레이어 목록 + 채팅을 가로 배치하여 세로 공간 ~220px 절약
- 직업 변경 버튼 + 액션 버튼을 같은 줄에 배치

#### 기타 하위 화면 (모바일)

- `renderCountdown`: `padding: 15px`
- `renderRoomSelect`: `padding: 15px`
- `renderJoinInput`: `padding: 15px`

#### 예상 높이 (모바일)

제목(~56px) + 콘텐츠 박스(~430px) + 뒤로 가기(~30px) ≈ **~520px** → 700px 내 여유있게 수용. 기존 스케일링 코드(`contentScaleRef`)는 유지하되 모바일에서는 자동으로 미적용.

### 메뉴/선택 화면 공통 변경

- **카드 컨테이너**: `flex` → `flex flex-wrap justify-center px-4` (좁은 화면에서 줄바꿈)
- **버튼**: `px-8 py-3` → `px-6 sm:px-8 py-2 sm:py-3 text-sm sm:text-base`
- **스크롤**: `max-h-[90vh] overflow-y-auto` 추가 (긴 콘텐츠 스크롤 가능)
- **고정 크기 제거**: 불필요한 `div style={{ height: 'Xpx' }}` 스페이서 제거 또는 축소

적용 화면:
- `DifficultySelectScreen`
- `GameTypeSelectScreen`
- `ModeSelectScreen`
- `RPGClassSelectScreen`
- `RPGCoopLobbyScreen`
- `LoginScreen`
- `MainMenu`
- `ProfileScreen`

---

## 12. CSS 및 글로벌 스타일

### 파일: `src/index.css`

추가된 스타일:

```css
/* 모바일 텍스트 선택 방지 */
body {
  -webkit-user-select: none;
  user-select: none;
}

/* 캔버스 터치 최적화 */
canvas {
  -webkit-tap-highlight-color: transparent;
  touch-action: none;
  user-select: none;
}

/* Safe Area (노치/다이나믹 아일랜드 대응) */
.safe-area-bottom {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
.safe-area-left {
  padding-left: env(safe-area-inset-left, 0px);
}
.safe-area-right {
  padding-right: env(safe-area-inset-right, 0px);
}

/* 회전 안내 애니메이션 */
@keyframes rotatePhone {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-90deg); }
  50%, 75% { transform: rotate(-90deg); }
}
.animate-rotate-phone {
  animation: rotatePhone 2.5s ease-in-out infinite;
}
```

### 캔버스 touchAction

모든 캔버스 요소에 `style={{ touchAction: 'none' }}` 적용하여 브라우저 기본 터치 동작(스크롤, 확대 등) 방지.

---

## 13. 파일 목록 및 변경 요약

### 신규 파일

| 파일 | 용도 |
|------|------|
| `src/hooks/useDeviceDetect.ts` | 디바이스 타입/방향 감지, viewport 메타 동적 변경 |
| `src/hooks/useFullscreen.ts` | Fullscreen API 래퍼 (진입/해제/상태) |
| ~~`src/components/ui/FullscreenButton.tsx`~~ | ~~전체화면 토글 버튼~~ (V1.23.1에서 삭제) |
| `src/components/ui/OrientationPrompt.tsx` | 세로 모드 회전 안내 오버레이 |
| `src/components/touch/VirtualJoystick.tsx` | 가상 조이스틱 (이동 입력, 고스트 힌트 포함) |
| `src/components/touch/TouchSkillButtons.tsx` | 터치 스킬 버튼 (W/E 스킬) |
| `src/components/touch/RPGTouchControls.tsx` | RPG 터치 컨트롤 컨테이너 (조이스틱+스킬+업그레이드 통합) |
| `src/components/touch/TouchUpgradeToggle.tsx` | 터치 업그레이드 토글 패널 |

### 수정 파일

| 파일 | 변경 유형 |
|------|-----------|
| `index.html` | viewport 메타 강화 |
| `src/index.css` | 터치 최적화 CSS, Safe Area, 애니메이션 |
| `src/App.tsx` | `useDeviceDetect()` 호출, `OrientationPrompt` 렌더링 |
| `src/stores/useUIStore.ts` | 모바일 상태 필드 + 액션 추가 |
| `src/constants/config.ts` | `getResponsiveConfig()` 추가 |
| `src/hooks/useCanvas.ts` | `fullscreen` 파라미터 추가, 반응형 패널 높이 |
| `src/hooks/useMouseInput.ts` | Mouse → Pointer, 핀치 줌, 터치 탭 |
| `src/hooks/useRPGInput.ts` | Mouse → Pointer, 핀치 줌, 터치 카메라 팬 |
| `src/hooks/useEdgeScroll.ts` | 터치 디바이스 가장자리 스크롤 비활성화 |
| `src/components/canvas/GameCanvas.tsx` | Pointer 이벤트, touchAction |
| `src/components/canvas/RPGCanvas.tsx` | Pointer 이벤트, fullscreen 캔버스 |
| `src/components/canvas/Minimap.tsx` | 반응형 미니맵 크기, 디바이스별 위치 |
| `src/components/screens/RPGModeScreen.tsx` | 터치 컨트롤 통합, 데스크톱/터치 분기 |
| `src/components/screens/GameScreen.tsx` | 반응형 하단 UI, 디바이스별 패딩/버튼 위치 |
| `src/renderer/drawRPGMinimap.ts` | RPG 미니맵 디바이스별 위치 (V1.23.1) |
| `src/renderer/rpgRenderer.ts` | useUIStore 디바이스 정보 전달 (V1.23.1) |
| `src/components/ui/RPGHeroPanel.tsx` | 폰 컴팩트 레이아웃, 원형 팀 HP |
| `src/components/ui/RPGGameTimer.tsx` | 폰 축소 |
| `src/components/ui/RPGWaveInfo.tsx` | 폰 축소 |
| `src/components/ui/ResourceBar.tsx` | 폰 축소 (라벨 숨김) |
| `src/components/ui/FriendSidebar.tsx` | 폰에서 숨김 |
| `src/components/ui/HelpModal.tsx` | 반응형 그리드 |
| 모달 8종 | vw 기반 너비 + max-width 제한 |
| 메뉴 화면 8종 | flex-wrap, 반응형 크기, 스페이서 정리 |

---

## 14. 개발 가이드라인

### 새 화면 추가 시

1. **데스크톱 레이아웃만 작성** - viewport 스케일링이 모바일 축소를 처리
2. `isMobile`로 레이아웃 크기를 분기하지 말 것
3. 모달은 `w-[90vw] sm:w-auto sm:min-w-[Xpx] max-w-[Ypx]` 패턴 사용
4. 카드 컨테이너는 `flex-wrap justify-center px-4` 추가

### 터치 기능 분기 시

```typescript
// 올바른 사용 (기능적 차이)
const isTouchDevice = useUIStore((s) => s.isTouchDevice);
if (isTouchDevice) {
  // 가상 조이스틱 표시
  // 키보드 안내 숨김
}

// 잘못된 사용 (레이아웃 차이)
const isMobile = useUIStore((s) => s.isMobile);
<div className={isMobile ? 'p-2' : 'p-4'}>  // ❌ viewport 스케일링으로 충분
```

### 예외: isMobile 허용 케이스

- **정보 밀도 축소**: 좁은 화면에서 덜 중요한 정보 숨기기 (예: RPGHeroPanel의 속도/사거리 스탯)
- **완전 숨김**: 화면이 너무 좁아 기능적으로 사용 불가한 경우 (예: FriendSidebar)
- **컴팩트 대체 표현**: 동일 정보를 다른 형태로 (예: RPGTeamPanel의 원형 HP)
- **레이아웃 재배치**: 세로 나열이 뷰포트를 초과하는 경우 가로 배치로 전환 (예: RPGCoopLobbyScreen의 플레이어+채팅 가로 배치)

### 새 터치 컴포넌트 추가 시

1. `src/components/touch/` 디렉토리에 배치
2. `isTablet`/`isMobile`로 디바이스별 크기 분기 (고정 px 값 사용, `uiScale` 곱하지 않음)
3. `pointerDown/Move/Up` 이벤트 사용 (touch 이벤트 직접 사용 금지)
4. `touchAction: 'none'` 스타일 적용
5. `setPointerCapture`로 포인터 캡처 설정
6. 멀티플레이어 네트워크 전송 고려
7. React Hooks 규칙: 조건부 early return은 반드시 모든 hooks 뒤에 위치

### 성능 고려사항

- 터치 입력 빈도가 높으므로 DOM 직접 조작 선호 (setState 최소화)
- 방향 변경 임계값/데드존으로 불필요한 업데이트 방지
- `useCallback` + `useRef`로 이벤트 핸들러 안정화
