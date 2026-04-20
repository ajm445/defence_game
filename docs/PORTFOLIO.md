# 막아라! 무너트려라! (Defence Game)

> **개인 프로젝트** · 풀스택 실시간 멀티플레이 웹 게임
> React 19 + TypeScript + Node.js + WebSocket + Supabase(PostgreSQL)

---

## 0. 한 줄 소개

RTS와 RPG 두 장르를 결합한 **2~4인 협동 실시간 멀티플레이 웹 게임**을 1인 풀스택으로 기획·개발·배포·운영했습니다.
**서버 권위(Server-Authoritative) 아키텍처**, **적응형 보간(Adaptive Interpolation) 시스템**, **JWT 기반 세션·재접속 시스템**을 직접 설계하여 65일간 423 커밋, 약 73,000줄 규모로 구현했습니다.

> 코드 작성은 Claude Code(Opus 4.6)와의 페어 프로그래밍으로 진행했고,
> 캐릭터·보스 스프라이트, 맵 배경 등 게임 에셋은 **Gemini(이미지 생성)** 으로 제작 후 Sharp + 자체 자동화 스크립트로 후처리했습니다.
> 모든 설계 결정·검증·릴리즈 책임은 본인이 직접 수행했습니다.

---

## 1. 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 프로젝트명 | 막아라! 무너트려라! (Defence Game) |
| 형태 | **개인 프로젝트** (1인 풀스택: 기획·개발·디자인 통합·배포·운영) |
| 장르 | RTS + 실시간 액션 RPG (디펜스 / 협동) |
| 플레이 형태 | 싱글 / 1v1 PvP / 2~4인 협동 멀티플레이 |
| 개발 기간 | 2026-01-15 ~ 2026-03-20 (약 65일) |
| 현재 버전 | v1.26.8 |
| 코드 규모 | TypeScript 214 파일 / 약 **73,000줄** / 423 커밋 |
| 배포 | Railway (서버) + Render (정적 호스팅) |

### 본인 담당 영역 (개인 프로젝트, 100%)
- **기획**: 게임 디자인, 밸런스, 6단계 난이도, 12 클래스 스킬 트리
- **프론트엔드**: React 19 + TypeScript + Vite + Zustand + Canvas 2D 렌더러 (70+ 컴포넌트, 14 커스텀 훅, 9 스토어)
- **백엔드**: Node.js + TypeScript + Express + ws (WebSocket), 60fps 게임 엔진, 11 게임 모듈, 11+ REST 라우터
- **DB / 인증**: Supabase(PostgreSQL) + JWT + bcrypt + RLS 정책
- **에셋**: Gemini로 캐릭터·보스 스프라이트 생성 → Sharp 기반 자동 합성·좌우 반전 스크립트
- **운영**: 7페이지 관리자 대시보드(실시간 모니터링 / 밴 / 점검 모드 / 피드백)
- **배포**: Railway / Render 자동 배포 파이프라인

---

## 2. 기술 스택

### 클라이언트
| 기술 | 사용 이유 |
|------|----------|
| **React 19 + TypeScript 5.9** | 200+ 파일 규모의 타입 안정성, 컴포넌트 단위 UI |
| **Vite 7** | HMR 기반 빠른 개발 사이클 |
| **Zustand 5** | Redux 대비 보일러플레이트 최소, 선택적 구독으로 게임 화면 리렌더 방지 |
| **Canvas 2D API** | DOM 대비 60fps 렌더링 안정적, 파티클·이펙트 자유도 |
| **Tailwind CSS 4** | 유틸리티 퍼스트로 빠른 UI 빌드 |
| **React Router 7 / Recharts 3** | SPA 라우팅, 관리자 대시보드 차트 |

### 서버
| 기술 | 사용 이유 |
|------|----------|
| **Node.js 22 + TypeScript** | 클라이언트와 동일 언어 → `shared/types/`로 패킷 타입 공유 |
| **Express 4** | 인증·랭킹·프로필·관리자 REST API |
| **ws 8** | 네이티브 WebSocket, 게임 패킷 오버헤드 최소 |
| **Supabase (PostgreSQL)** | 인증 + DB + RLS 통합, 1인 개발에 최적 |
| **JWT + bcrypt + Helmet** | 토큰 인증, 비밀번호 해싱, HTTP 보안 헤더 |

### 인프라
- **Railway / Render** — 서버·클라이언트 자동 배포 (`render.yaml`)
- **npm workspaces** — `client + server` 모노레포
- **shared/types/** — 클라이언트-서버 타입 단일 소스

---

## 3. 시스템 아키텍처

```
┌──────────────── Client (React + Vite) ────────────────┐
│  Zustand Stores  ◀─▶  Canvas Renderer  ◀─▶  React UI  │
│                          │                              │
│                   WebSocket Client                      │
└──────────────────────────┼──────────────────────────────┘
                           │  ws://  (입력 ↑ / 상태 ↓)
┌──────────────────────────┼──────────────────────────────┐
│                   WebSocket Server                       │
│                          │                               │
│  RPGServerGameEngine (60fps tick)    Express REST API   │
│  ┌──────────┬──────────┐            ┌────────────────┐  │
│  │ Hero/AI  │ Skill/   │            │ Auth / Profile │  │
│  │ Spawn    │ Boss     │            │ Rankings/Admin │  │
│  └──────────┴──────────┘            └───────┬────────┘  │
│  Friend / DM / Room Manager                 │           │
│                                              ▼           │
│                            ┌──────────────────────────┐  │
│                            │  Supabase (Auth + DB)    │  │
│                            └──────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

- **틱 레이트**: 서버 60fps (16.67ms) 게임 루프
- **브로드캐스트**: 30Hz (33ms)로 직렬화 상태 전송
- **권위**: 모든 게임 로직(이동·스킬·데미지·스폰·승패)을 서버에서만 결정
- **공유 타입**: `shared/types/`로 클라이언트-서버 패킷 일치 강제

---

## 4. 트러블슈팅 (가장 중요한 섹션)

> 채용 가이드라인에서 가장 중요하게 본다고 명시된 항목입니다.
> 개발 과정에서 실제로 막혔던 문제 3건을 어떤 기술과 논리적 사고로 해결했는지 상세히 적습니다.

---

### 트러블슈팅 1 — 멀티플레이 아키텍처 재설계: **호스트 모델 → 서버 권위 모델 전환**

#### 문제 상황
초기 멀티플레이(V1.5 ~ V1.15)는 **호스트 클라이언트가 게임 로직을 실행**하는 *호스트 기반(Host-Authoritative)* 구조였습니다.
서버는 단순 메시지 릴레이 역할만 수행했고, 호스트 클라이언트가 모든 시뮬레이션을 돌렸습니다.

```
[기존 구조]
   Host Client (게임 로직 실행) ──▶ Relay Server ──▶ Other Clients
       ▲                                                  │
       └────── 다른 클라이언트의 입력 ◀──────────────────┘
```

운영하면서 다음 문제가 누적됐습니다.

| 증상 | 원인 |
|------|------|
| **호스트가 죽거나 이탈하면 게임이 멈춤** | 시뮬레이션 주체가 사라짐 → 호스트 위임(handoff) 시스템을 추가했지만 상태 스냅샷 전송 중 race condition 발생 |
| **클라이언트 4명 간 상태 불일치** | 호스트의 상태를 다른 클라이언트가 보간 추정 → 스킬/데미지 판정이 어긋남 |
| **치트 가능성** | 호스트 메모리만 변조하면 모든 클라이언트가 영향을 받음 |
| **호스트의 네트워크가 모두에게 영향** | 호스트 핑이 흔들리면 4명 전원이 끊김 |
| **호스트 기준 기능이 코드 전체에 산재** | `HOST_PLAYER_INPUT`, `HOST_GAME_STATE_BROADCAST` 등 메시지 타입 + 클라이언트 분기가 너무 많아 디버깅 비용 증가 |

특히 `dae939a` (게임 나가기/중단 개선: 호스트 위임 수정), `e3ac6e3` (호스트 사망 시 게임 멈춤), `d6d7941` (HOST_PLAYER_INPUT 전송 형식 수정) 처럼 **호스트 위임 한 가지 이슈로만 7~8회 핫픽스가 누적**되었고, 근본 원인이 아키텍처라는 결론에 도달했습니다.

#### 해결 방향 (논리적 사고)
1. **단일 소스 오브 트루스를 서버로 옮긴다** — 호스트라는 개념 자체를 제거.
2. 모든 클라이언트는 *입력만 보내고 결과만 수신*하는 *thin client*로 강등.
3. 게임 로직은 서버 노드에서 60fps 틱으로 시뮬레이션, 30Hz로 직렬화 브로드캐스트.
4. 점진적 마이그레이션이 아닌 **두 단계 일괄 전환** (롤백 가능성 확보를 위해 단계 분리):
   - **V1.21.0**: 서버에 `RPGServerGameEngine`을 신규 구축, 신규 메시지 타입과 함께 호스트 시스템과 *공존*시킴
   - **V1.22.0**: 회귀 검증 완료 후 레거시 `HostBased*` 메시지 타입·핸들러·클라이언트 분기를 일괄 제거

#### 구현 (V1.21.0 ~ V1.22.0)
서버 측에 게임 엔진을 새로 작성하고, 책임별로 6개 모듈로 분리했습니다.

```
server/src/game/
├── RPGServerGameEngine.ts    # 60fps 메인 게임 루프, 30Hz 브로드캐스트
├── rpgServerHeroSystem.ts    # 영웅 이동/버프/쿨다운
├── rpgServerSkillSystem.ts   # Q/W/E 스킬 (12 클래스 분기)
├── rpgServerEnemySystem.ts   # 적 AI, 스폰, 데미지
├── rpgServerBossSystem.ts    # 보스 스킬 패턴
├── rpgServerGameSystems.ts   # 넥서스/골드/업그레이드/직렬화
└── rpgServerConfig.ts        # 스탯·스킬·난이도 설정값
```

핵심 설계 결정:
- **틱 60Hz / 브로드캐스트 30Hz** — CPU 사용량과 네트워크 트래픽의 균형
- **입력 큐**: 클라이언트 입력은 즉시 처리하지 않고 큐에 쌓아 다음 틱에 적용 → 동시 입력 처리 일관성 확보
- **`shared/types/`로 패킷 타입 단일화** — 클라이언트와 서버가 같은 TypeScript 타입을 import 하므로 컴파일 단계에서 패킷 불일치 차단

레거시 정리(V1.22.0)는 다음 13개 파일에서 484줄 삭제 / 147줄 추가, 호스트 기반 분기 코드를 전부 제거했습니다.
```
HostBasedClientMessage / HostBasedServerMessage 제거
HOST_GAME_STATE_BROADCAST / HOST_GAME_EVENT_BROADCAST / HOST_PLAYER_INPUT / HOST_GAME_OVER 핸들러 제거
RPGCoopGameRoom 레거시 스텁 메서드 제거
useNetworkSync.ts 호스트 분기 151줄 → 0줄
WebSocketClient 레거시 브로드캐스트 메서드 제거
```

#### 결과
| 지표 | 변경 전 (호스트) | 변경 후 (서버 권위) |
|------|----------------|---------------------|
| 호스트 이탈 시 동작 | 게임 정지 / 위임 로직 필요 | **영향 없음** (서버가 권위) |
| 4인 상태 일관성 | 호스트 기준 추정 | **모든 클라이언트 동일 상태** |
| 치트 가능성 | 호스트 메모리 변조 가능 | **서버가 검증 + 입력 레이트 리밋** |
| 핵심 분기 코드 | 호스트/비호스트 분기 다수 | **단일 경로** (모두 동등) |
| 디버깅 | 호스트 위임 race condition 빈발 | 단일 시뮬레이션이라 재현·추적 용이 |

이 전환 이후에야 V1.22.2의 핫패스 최적화(`hero.skills.find()` 캐싱, `JSON.stringify` 1회 통합, `distanceSquared()` 등)를 적용할 수 있는 *공통 핫패스*가 생겼고, 4인 환경에서 60fps 틱이 안정화됐습니다.

#### 배운 점
- **"기능 추가로 아키텍처 결함을 메울 수 없다"** — 호스트 위임을 7번 패치한 시간보다, 아키텍처 전환 1번이 훨씬 효율적이었습니다.
- **점진 전환 vs 일괄 전환** — 두 모델을 한 시점에 공존(V1.21.0)시키고 → 검증 후 일괄 제거(V1.22.0)하는 *2단계 컷오버* 가 가장 안전했습니다.
- **타입 공유는 비용이 아니라 자산** — `shared/types/`가 없었다면 마이그레이션 중 패킷 불일치를 런타임에서 잡았을 것입니다.

> 관련 문서: [`docs/server-authority-model.md`](./server-authority-model.md), [`docs/SERVER_ARCHITECTURE.md`](./SERVER_ARCHITECTURE.md)
> 관련 커밋: `c2d8be0` (V1.21.0 서버 권위 도입), `3daf253` (V1.22.0 레거시 제거)

---

### 트러블슈팅 2 — 플레이어 이동 보간 일치 문제 (Adaptive Interpolation)

#### 문제 상황
서버 권위 모델로 전환한 직후, 30Hz 브로드캐스트만으로는 캐릭터 이동이 **육안으로 끊겨 보이는** 문제가 발생했습니다.

| 증상 | 빈도 |
|------|------|
| 30Hz 업데이트라 캐릭터가 *계단처럼* 끊겨 보임 | 항상 |
| 핑이 흔들릴 때 캐릭터가 *경련*처럼 움직임 | 모바일·와이파이 환경에서 |
| 멈춘 캐릭터가 *제자리에서 슬라이딩* | 정지 시점 직후 |
| 정지했을 때 *뒤로 살짝 밀려나는* 현상 | 클라이언트 이동 정지 vs 서버 이동 정지 시점 어긋남 |
| 스킬 시전 중인 캐릭터가 *순간이동*하듯 보임 | 클라 예측이 시전 위치를 무시할 때 |

처음에는 *고정 보간 상수*(예: 50ms)로 해결을 시도했지만, **네트워크 상태가 일정하지 않으면 어떤 상수도 옳지 않다**는 결론에 도달했습니다.

#### 해결 방향 (논리적 사고)
1. **고정 상수 → 네트워크 실측에 자동 적응** — EMA(Exponential Moving Average)로 실제 서버 업데이트 간격을 추적
2. **상태별 분기** — 이동 중 / 정지 중 / 스킬 시전 중 / 스턴은 각각 다른 보정 전략이 필요
3. **양방향 보정** — 서버→클라이언트 lerp 뿐 아니라 클라이언트→서버 보정도 적용
4. **선형 lerp 대신 이징** — `easeOutCubic`으로 자연스러운 감속

#### 구현 (`src/stores/useRPGStore.ts`의 `applySerializedState`)

**1) EMA 기반 적응형 업데이트 간격 추적**
```ts
// 모듈 변수 (스토어 외부)
let _serverUpdateInterval = 50; // ms, 초기값

// applySerializedState() 안에서 매 업데이트마다
const now = performance.now();
const measured = now - _lastServerUpdateTime;
_serverUpdateInterval = _serverUpdateInterval * 0.7 + measured * 0.3; // EMA
const interpolationDuration = Math.max(20, _serverUpdateInterval * 1.15);
```

**2) 상태별 분기 보정 로직**

| 상태 | 처리 |
|------|------|
| 위치 차이 > 200px | **즉시 스냅** (텔레포트, 사망/부활) |
| 돌진/시전/스턴 중 | 서버 위치 100% (시전 중에도 30px 이내면 로컬 유지로 떨림 방지) |
| 이동 중 | 로컬 예측 + 점진적 보정 `min(0.3, diff/500)` |
| 서버만 이동 중 (로컬 정지) | 로컬 유지 (뒤로 밀림 방지) |
| 정지 + 차이 < 5px | 로컬 유지 (제자리 슬라이딩 방지, 데드존 5px) |
| 정지 + 차이 ≥ 5px | 40% lerp 보정 |

**3) 클라이언트→서버 역방향 보정** (`RPGServerGameEngine.processInput`)
클라이언트는 `sendMoveDirection` 패킷에 자신의 추정 position을 함께 보내고, 서버는 15~200px 차이 시 30% 비율로 클라이언트 위치를 향해 보간합니다. 이로써 *서버가 일방적으로 끌고 가지 않고* 양쪽이 만나는 지점에서 합의됩니다.

**4) 이징 함수 적용**
```ts
const t = easeOutCubic(elapsed / interpolationDuration);
const x = start.x + (target.x - start.x) * t;
```

#### 결과
| 항목 | 결과 |
|------|------|
| 30Hz 브로드캐스트 환경에서 60fps 체감 부드러움 | **확보** |
| 핑 변동 시 경련 현상 | EMA 자동 보정으로 **해소** |
| 정지 시 슬라이딩 / 뒤로 밀림 | 데드존 + 양방향 정지 체크로 **해소** |
| 시전 중 순간이동 | 시전 위치 신뢰 분기로 **해소** |
| 사망/부활 텔레포트 | 200px 이상 차이 즉시 스냅으로 **자연스럽게 처리** |

#### 배운 점
- **"네트워크는 흔들린다"는 것을 상수가 아닌 측정값으로 다뤄야 한다.** EMA는 단순하지만 강력한 도구였습니다.
- **하나의 보간 전략으로 모든 상태를 처리할 수 없다.** "이동/정지/시전/스턴"이라는 상태 머신을 인지하고 각 상태별 분기 로직을 둬야 자연스러워집니다.
- **양방향 합의가 핵심.** 서버 권위라고 해서 클라이언트 위치를 무시하면 입력 반응성이 죽고, 클라이언트를 신뢰하면 치트가 열립니다. *중간에서 만나기*가 정답이었습니다.

> 관련 문서: [`docs/client-interpolation.md`](./client-interpolation.md)
> 관련 코드: `src/stores/useRPGStore.ts` (`applySerializedState`), `server/src/game/RPGServerGameEngine.ts` (`processInput`)

---

### 트러블슈팅 3 — 인증 및 세션 동기화: 브라우저 상태 변화(탭 이동·창 최소화) 시 튕김 문제 해결

#### 문제 상황
초기 인증은 Supabase 클라이언트 SDK 를 사용해 토큰을 자동 관리하는 방식이었습니다. 하지만 실제 플레이 환경(특히 모바일·멀티태스킹 데스크톱)에서 다음과 같은 문제가 누적됐습니다.

| 증상 | 원인 |
|------|------|
| **게임 도중 다른 탭으로 이동했다 돌아오면 소켓이 끊긴 채 메인 화면으로 튕김** | 브라우저가 백그라운드 탭의 WebSocket을 일정 시간 후 종료하는데, 복귀 후 재연결 로직이 없었음 |
| **창 최소화/다른 창 열기 후 복귀 시 로그인 상태가 초기화됨** | Supabase SDK 의 세션 복원이 생명주기 이벤트와 엇박자로 동작 |
| **탭 전환 중 이동 키가 "눌린 상태"로 남아 캐릭터가 자동 이동** | `blur`/`visibilitychange`에서 키 상태 초기화가 없었음 |
| **새 탭에서 동일 계정 로그인이 공유돼 보안 위험** | `localStorage`는 모든 탭이 공유 |
| **REST API 가 인증 없이 사용자 데이터를 변경 가능** | 닉네임/사운드 설정/랭킹 등록 등이 검증 없이 동작 |
| **중복 로그인 방지가 불가능** | 같은 계정으로 여러 곳 동시 접속 시 서버가 인지하지 못함 |

Supabase SDK 의 *자동 저장* 기능만으로는 브라우저 생명주기(`visibilitychange`, `blur`, `pagehide` 등)에 따른 **세션 유지력을 완벽히 제어할 수 없다**는 결론에 도달했고, 세션과 소켓 연결의 제어권을 전부 프로젝트 내부로 가져오기로 결정했습니다.

#### 해결 방향 (논리적 사고)
1. **세션 저장소와 인증 발급 로직을 직접 통제한다** — Supabase SDK 의존을 제거하고 `sessionStorage` + 자체 JWT 로 이관
2. **브라우저 생명주기 이벤트에 명시적으로 반응한다** — `visibilitychange` 감지 후 소켓·인증 상태를 즉시 재동기화
3. **모든 REST 호출에 토큰을 일관되게 주입한다** — 호출 지점마다 헤더를 붙이는 대신 단일 통과 지점을 만든다
4. **점진적 마이그레이션** — 한 번에 갈아엎지 않고 V1.16 → V1.18/V1.19 → V1.26.8 세 단계로 안전하게 전환

#### 구현

**1단계 — `sessionStorage` + 자체 JWT 발급 (V1.16.0 → V1.26.8)**
- 토큰 저장소를 `localStorage` → **`sessionStorage`** 로 변경: 브라우저 종료 시엔 정리되되, *탭 이동/새로고침 시엔 유지* 되는 특성이 정확히 필요한 동작과 맞음
- Supabase SDK 의존 제거, 서버가 `bcrypt`로 비밀번호를 해싱하고 **자체 JWT 를 발급**
- 모든 변경성 REST API에 `requireAuth + requireSameUser` 미들웨어 적용 (토큰의 `userId` ≠ 경로 `userId` 이면 403)
- WebSocket 연결 시에도 JWT 검증 + 행동별 레이트 리밋(이동 15ms / 스킬 100ms / 방 생성 3초)

```ts
// server/src/middleware/jwtAuth.ts
router.patch('/profile/:userId/nickname',
  requireAuth,        // JWT 검증
  requireSameUser,    // 토큰 userId == 경로 userId
  handler
);
```

**2단계 — Visibility API 기반 세션·소켓 상태 복구 (`WebSocketClient.ts`)**

`WebSocketClient` 생성자에 `visibilitychange` 리스너를 등록해, 탭이 포그라운드로 돌아올 때 연결 상태를 점검하고 끊겼다면 즉시 재수립합니다. 로그인 정보는 `currentLogin`에 보관해 두고, 재연결의 `onopen` 훅에서 `USER_LOGIN` 메시지를 자동 재전송해 **서버의 온라인 상태·방 컨텍스트를 단절 없이 복원**합니다.

```ts
// src/services/WebSocketClient.ts
constructor() {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) this.handleTabVisible();
  });
}

private handleTabVisible(): void {
  if (this.isBanned || this.isDuplicateLogin) return;
  if (!this.currentLogin) return;
  if (!this.isConnected()) {
    this.reconnectAttempts = 0;          // 백그라운드 실패 누적 리셋
    this.connect().catch(() => { /* attemptReconnect 가 처리 */ });
  }
}

// onopen 시
this.ws.onopen = () => {
  if (this.currentLogin) {
    const { userId, nickname, isGuest, level, token } = this.currentLogin;
    this.send({ type: 'USER_LOGIN', userId, nickname, isGuest, level, token });
  }
};
```

추가로 발견한 부작용(탭 전환 중 키 상태가 "눌린 채로 남는" 문제)은 `src/hooks/useRPGInput.ts`의 `visibilitychange` + `blur` 핸들러에서 WASD 상태를 초기화하고, 이동 중이었다면 `setMoveDirection(undefined)`로 서버에 정지를 즉시 통보해 캐릭터가 탭 전환 후에도 미끄러지지 않도록 처리했습니다.

동시 연결 중복을 막기 위해 `pendingConnect` 플래그로 재연결 요청이 겹치지 않도록 가드도 추가했습니다.

**3단계 — fetch 래퍼로 토큰 주입 단일화 (`src/services/authService.ts`)**

Axios 의존을 도입하지 않고 경량성을 유지하기 위해, 네이티브 `fetch` 위에 **`apiRequest<T>()` 래퍼 함수**를 만들어 모든 REST 호출을 여기로 통과시켰습니다. 이 함수가 호출 직전 `sessionStorage`에서 JWT 를 꺼내 `Authorization: Bearer` 헤더를 자동으로 붙이기 때문에, 호출 지점마다 토큰 주입을 반복할 필요가 없고 화면 전환 시에도 항상 최신 토큰이 사용됩니다.

```ts
// src/services/authService.ts
const TOKEN_KEY = 'defence_game_token';
export function getAuthToken() { return sessionStorage.getItem(TOKEN_KEY); }

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? '요청 처리 중 오류가 발생했습니다.');
  return data;
}
```

이 함수가 회원가입/로그인/프로필/랭킹/닉네임·비밀번호 변경/탈퇴 등 **모든 인증 REST 호출의 단일 통과 지점**이 됐고, 덕분에 토큰 주입/에러 정규화/Content-Type 설정이 한 곳에서 관리됩니다.

#### 결과
| 항목 | 변경 전 | 변경 후 |
|------|--------|--------|
| 탭 백그라운드 → 복귀 시 소켓 | 끊긴 채 메인으로 튕김 | **자동 재연결 + `USER_LOGIN` 재전송으로 무중단 복구** |
| 창 최소화/복귀 시 로그인 상태 | 초기화 발생 | **sessionStorage + visibilitychange 복구로 유지** |
| 탭 전환 중 키 입력 | 눌린 상태 잔존으로 자동 이동 | **`blur`/`visibilitychange`에서 상태 초기화 + 서버에 정지 통보** |
| 인증 방식 | Supabase SDK 자동 관리 | **자체 JWT + bcrypt + 미들웨어** |
| 변경성 REST API 인증 | 없음 | **`requireAuth + requireSameUser` 일괄 적용** |
| REST 호출 토큰 주입 | 호출 지점마다 반복 | **`apiRequest()` 래퍼 단일 통과 지점** |
| 중복 로그인 | 가능 | **서버가 기존 연결 강제 종료** |
| 비밀번호 보호 | SDK 위임 | **bcrypt 해싱 + Helmet 보안 헤더** |

탭 전환·창 최소화 등 멀티태스킹 환경에서도 로그인·소켓 상태가 단절되지 않게 되면서, 가장 빈번했던 "갑자기 메인으로 튕김" 류의 이탈 사례가 사라졌습니다.

#### 배운 점
- **SDK 의 "자동"은 내 환경의 "자동"과 다르다.** Supabase SDK 의 자동 세션 복원은 일반적인 SPA 에는 충분했지만, 60fps 게임 루프·WebSocket·브라우저 생명주기가 얽힌 환경에서는 *제어권 부족* 그 자체가 문제였습니다. 의존성을 걷어내고 직접 만든 후에야 *원하는 모든 시점에 끼어들 수 있는* 상태가 됐습니다.
- **브라우저 생명주기를 무시하면 안 된다.** `visibilitychange`, `blur`, `pagehide` 는 SPA 개발에서 종종 잊히지만, 실시간 통신 앱에서는 *가장 먼저 고려해야 할* 이벤트였습니다.
- **단일 통과 지점(single choke point)의 힘.** `apiRequest()` 래퍼 하나로 토큰 주입/에러 정규화/헤더 관리를 통일하자, 이후 JWT 로 전환할 때 **변경해야 할 호출 지점이 0개**였습니다. "나중에 바꿀 수도 있겠다" 싶은 코드는 처음부터 래핑해두는 게 싸게 먹힙니다.
- **점진적 마이그레이션이 옳았다.** `sessionStorage` 전환(V1.16) → 중복 로그인 서버 차단(V1.18~V1.19) → 자체 JWT + visibilitychange 복구(V1.26.8) 의 3단계 컷오버로, 각 단계에서 롤백 포인트를 확보한 채 진행할 수 있었습니다.

> 관련 커밋: `935bb58` (V1.16.0 sessionStorage 전환), `13d979e`/`4d61ff4` (중복 로그인 방지), `c9f1d91` (V1.26.8 자체 JWT + 미들웨어)
> 관련 코드: `src/services/WebSocketClient.ts` (`handleTabVisible`, `onopen` 재전송), `src/services/authService.ts` (`apiRequest`), `src/hooks/useRPGInput.ts` (`visibilitychange`/`blur` 핸들러), `server/src/middleware/jwtAuth.ts`

---

## 5. 그 외 주요 기능 요약

| 영역 | 내용 |
|------|------|
| **RPG 모드** | 12 클래스 (4 기본 × 2 전직), Q/W/E 스킬, 6단계 난이도, 10웨이브마다 보스, 넥서스 디펜스 |
| **RTS 모드** | 자원 5종, 유닛 6종, AI 4단계, 1v1 PvP |
| **멀티플레이** | 1~4인 협동, 6자리 코드 방, 인원수 스케일링(1.0x → 2.5x), 어그로 시스템 |
| **소셜** | 친구 추가, 온라인 상태 실시간, **1:1 DM**, 게임 초대 (5분 TTL) |
| **계정** | 회원가입 / 게스트 모드 / 캐릭터 레벨 / SP 스탯 분배 / 난이도별 랭킹 |
| **관리자 대시보드** | 7페이지: 실시간 모니터링 / 플레이어 검색·밴 / 피드백 / 점검 모드 |
| **모바일 대응** | viewport meta `width=1280` 트릭 (CSS 분기 없이 비례 축소) + 가상 조이스틱 |
| **운영 안정성** | 글로벌 Error Boundary, 점검 모드, 자동 만료 밴, Helmet 보안 헤더 |

---

## 6. 코드 품질 & 패턴

| 패턴 | 적용 위치 |
|------|----------|
| Server Authority | 게임 엔진 전체 |
| Singleton | EffectManager / SoundManager / FriendManager |
| Factory | `unitFactory.ts` |
| Strategy | 적 AI / 보스 스킬 행동 분기 |
| Observer | WebSocket 메시지 → Zustand 스토어 갱신 |
| Shared Module | `shared/types/`로 서버-클라이언트 타입 단일화 |
| Middleware Chain | Express + WebSocket 인증/검증 미들웨어 체인 |

---

## 7. 정량적 결과

| 지표 | 수치 |
|------|------|
| 개발 기간 | 65일 |
| 총 커밋 | **423회** (일 평균 ~6.5) |
| 코드 라인 | 약 **73,000줄** |
| TypeScript 파일 | 214 |
| React 컴포넌트 / 커스텀 훅 / Zustand 스토어 | 70+ / 14 / 9 |
| 서버 게임 모듈 / REST 라우터 | 11 / 11+ |
| 게임 모드 / 클래스 / 난이도 / 보스 | 2 / 12 / 6 / 2종 |
| 관리자 페이지 | 7 |

---

## 8. 회고 — 무엇을 배웠는가

1. **아키텍처 결함은 기능 추가로 메울 수 없다.**
   호스트 모델의 위임 버그를 7번 패치하는 것보다, *서버 권위 모델로의 전환 1번* 이 훨씬 효율적이었습니다. *근본 원인을 외면하지 않는 것* 이 1인 개발에서 가장 큰 비용 절감입니다.

2. **네트워크 코드는 측정값으로 다뤄야 한다.**
   적응형 보간을 만들면서, "가정값"이 아닌 "실측값" 위에 로직을 쌓아야 변동 환경을 견딘다는 걸 배웠습니다. 모든 *상수* 는 *측정 → 학습 → 적응* 으로 대체될 수 있는지 의심하게 됐습니다.

3. **인증/세션은 늦출수록 비싸다.**
   초기에 `localStorage` 한 줄이었던 게, 결국 35개 파일을 동시에 수정하는 V1.26.8 패치가 됐습니다. *기반 시스템은 처음부터 단단하게* 라는 교훈을 비싸게 배웠습니다.

4. **AI 페어 프로그래밍의 진짜 가치는 "타이핑 대체"가 아니라 "병목 제거"다.**
   Claude Code가 빠를수록 본인의 시간은 *설계 결정·트레이드오프 판단·인게임 검증* 에 더 쓰이게 됐고, 그게 1인 풀스택을 가능하게 한 핵심이었습니다. AI가 만든 코드를 통째로 수용하지 않고 *의미 단위로 쪼개 검증하고 커밋* 한 것이 안정성의 비결이었습니다.

5. **컨텍스트 관리 = 생산성.**
   `MEMORY.md` 같은 장기 컨텍스트 인프라에 도메인 지식(스킬 쿨다운, 버그 패턴, 보간 튜닝 값)을 누적해두니, 새 세션에서도 같은 실수를 반복하지 않게 됐습니다. *어떤 도구를 쓰느냐* 보다 *어떻게 운영하느냐* 가 결과를 결정했습니다.

---

## 9. 부록 — 사용한 도구와 본인 역할의 분리

| 도구 | 어디에 썼나 | 사람이 한 일 |
|------|------------|-------------|
| **Claude Code (Opus 4.6 1M)** | 코드 작성, 리팩터링, 트러블슈팅 토론, 문서화 | 제품 결정 / 스코프 / 검증 / 커밋 단위 / 릴리즈 책임 |
| **Gemini (이미지 생성)** | 캐릭터·보스·맵 배경 등 게임 에셋 생성 | 프롬프트 표준화, 에셋 검수 |
| **Sharp + 자체 스크립트** | 스프라이트 프레임 합성, 좌우 반전 자동화 | 파이프라인 설계 (`scripts/combine-sprites.cjs`, `flip-frames.cjs`) |
| **Supabase Studio** | DB 스키마, RLS 정책 설계 | 스키마 설계 / 정책 결정 |
| **Railway / Render** | 자동 배포 | 배포 파이프라인 구성 |

> 개인 프로젝트이므로 모든 설계 결정·검증·배포 책임은 본인에게 있으며, AI 도구는 **빠른 손과 토론 상대** 역할로 활용했습니다.
> 자세한 AI 활용 방식·워크플로우 사례는 [`AI_USAGE_CASE.md`](./AI_USAGE_CASE.md) 참고.
