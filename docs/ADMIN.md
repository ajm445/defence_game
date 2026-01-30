# 관리자 페이지

> 플레이어 관리, 게임 통계, 실시간 모니터링 기능을 갖춘 관리자 페이지

---

## 목차

1. [개요](#개요)
2. [접근 방법](#접근-방법)
3. [인증 시스템](#인증-시스템)
4. [플레이어 관리](#플레이어-관리)
5. [통계 대시보드](#통계-대시보드)
6. [실시간 모니터링](#실시간-모니터링)
7. [데이터베이스 스키마](#데이터베이스-스키마)
8. [API 엔드포인트](#api-엔드포인트)
9. [파일 구조](#파일-구조)

---

## 개요

관리자 페이지는 게임 운영에 필요한 기능을 제공합니다:

| 기능 | 설명 |
|------|------|
| 플레이어 관리 | 목록 조회, 상세 정보, 수정, 밴 처리 |
| 통계 대시보드 | 사용자 증가 추이, 클래스 인기도, 게임 모드별 통계 |
| 실시간 모니터링 | 접속자 수, 활성 게임 수, 플레이어 활동 로그 |

---

## 접근 방법

### URL 구조

```
/admin         → 대시보드 (로그인 필요)
/admin/login   → 로그인 페이지
/admin/players → 플레이어 목록
/admin/players/:id → 플레이어 상세
/admin/monitoring → 실시간 모니터링
```

### 라우팅 분리

기존 게임과 관리자 페이지는 완전히 분리되어 있습니다:

```typescript
// main.tsx
<Routes>
  {/* 관리자 페이지 */}
  <Route path="/admin/*" element={<AdminApp />} />

  {/* 기존 게임 */}
  <Route path="/*" element={<App />} />
</Routes>
```

---

## 인증 시스템

### JWT 토큰 기반 인증

| 항목 | 값 |
|------|-----|
| 토큰 유효기간 | 24시간 |
| 저장 위치 | localStorage (`admin_token`) |
| 헤더 | `Authorization: Bearer <token>` |

### 권한 레벨

| 권한 | 조회 | 밴/밴해제 | 수정/삭제 |
|------|------|----------|----------|
| `admin` | O | X | X |
| `super_admin` | O | O | O |

### 미들웨어

```typescript
// requireAdmin: 관리자 권한 확인
router.get('/players', requireAdmin, async (req, res) => { ... });

// requireSuperAdmin: 슈퍼 관리자 권한 추가 확인
router.patch('/players/:id', requireAdmin, requireSuperAdmin, async (req, res) => { ... });
```

---

## 플레이어 관리

### 플레이어 목록

| 기능 | 설명 |
|------|------|
| 검색 | 닉네임으로 검색 |
| 필터 | 밴 상태 필터 (전체/밴됨/정상) |
| 정렬 | 가입일, 닉네임, 레벨, 최근 활동 |
| 페이지네이션 | 페이지당 20명 |
| 온라인 상태 | 실시간 접속 여부 표시 |

### 온라인 상태 추적

WebSocket 연결 상태를 기반으로 온라인 사용자를 추적합니다:

```typescript
// server/src/state/players.ts
export const onlineUserIds = new Set<string>();

// 로그인 시 추가
onlineUserIds.add(userId);

// 연결 해제 시 제거
onlineUserIds.delete(userId);
```

### 플레이어 상세 정보

| 섹션 | 내용 |
|------|------|
| 기본 정보 | ID, 닉네임, 레벨, 경험치, 가입일 |
| 클래스 진행 | 각 클래스별 레벨, 경험치, SP, 스탯 업그레이드 |
| 게임 통계 | 총 게임 수, 승률, 최대 웨이브, 총 플레이 시간 |
| 최근 게임 | 최근 20개 게임 기록 |
| 밴 기록 | 밴/해제 이력 |

### 플레이어 수정 (Super Admin 전용)

수정 가능한 항목:

| 항목 | API 엔드포인트 |
|------|---------------|
| 닉네임 | `PATCH /api/admin/players/:id` |
| 플레이어 레벨 | `PATCH /api/admin/players/:id` |
| 플레이어 경험치 | `PATCH /api/admin/players/:id` |
| 클래스 레벨 | `PATCH /api/admin/players/:id/class/:className` |
| 클래스 경험치 | `PATCH /api/admin/players/:id/class/:className` |
| SP | `PATCH /api/admin/players/:id/class/:className` |
| 스탯 업그레이드 | `PATCH /api/admin/players/:id/class/:className` |

### 밴 시스템 (Super Admin 전용)

#### 밴 처리

```typescript
POST /api/admin/bans/:id/ban
{
  "reason": "부적절한 행동",
  "expiresAt": "2024-12-31T23:59:59Z"  // null = 영구밴
}
```

#### 밴 해제

```typescript
DELETE /api/admin/bans/:id/ban
```

#### 밴 확인 시점

1. **HTTP 로그인** (`/api/auth/login`)
   - 밴 상태 확인
   - 만료된 밴은 자동 해제

2. **WebSocket 로그인** (`USER_LOGIN` 메시지)
   - 밴된 사용자는 `BANNED` 메시지 수신 후 연결 종료
   - 자동 재연결 차단

```typescript
// 밴된 사용자에게 전송되는 메시지
{
  type: 'BANNED',
  message: '계정이 정지되었습니다. 만료: 2024-12-31',
  bannedUntil: '2024-12-31T23:59:59Z'
}
```

---

## 통계 대시보드

### 개요 통계

| 항목 | 설명 |
|------|------|
| 총 플레이어 | 전체 가입자 수 |
| 밴된 플레이어 | 현재 밴 상태인 플레이어 수 |
| 게스트 플레이어 | 게스트 계정 수 |
| 오늘 신규 | 오늘 가입한 플레이어 수 |
| 이번 주 신규 | 최근 7일 가입한 플레이어 수 |
| 총 게임 수 | 전체 게임 플레이 횟수 |
| 오늘 게임 수 | 오늘 플레이된 게임 수 |
| 현재 접속자 | 실시간 접속자 수 |

### 차트

| 차트 | 데이터 |
|------|--------|
| 사용자 증가 추이 | 최근 30일 일별 신규 가입자 |
| 클래스 인기도 | 클래스별 선택 비율 및 승률 |
| 게임 모드 통계 | 싱글/협동 모드별 게임 수, 승률, 평균 웨이브 |
| 일별 게임 수 | 최근 30일 일별 게임 플레이 수 |

---

## 실시간 모니터링

### 서버 상태

WebSocket을 통해 10초마다 자동 업데이트:

| 항목 | 설명 |
|------|------|
| 현재 접속자 | 실시간 접속 중인 플레이어 수 |
| 활성 게임 | 진행 중인 게임 수 |
| 서버 업타임 | 서버 가동 시간 |
| 메모리 사용량 | 현재 메모리 사용률 |

### 플레이어 활동 로그

실시간으로 수신되는 이벤트:

| 이벤트 | 설명 |
|--------|------|
| `connect` | 플레이어 접속 |
| `disconnect` | 플레이어 접속 종료 |
| `game_start` | 게임 시작 |
| `game_end` | 게임 종료 |

### 관리자 WebSocket 구독

```typescript
// 관리자 구독 메시지
{ type: 'ADMIN_SUBSCRIBE' }

// 서버 상태 수신
{ type: 'ADMIN_SERVER_STATUS', status: { ... } }

// 플레이어 활동 수신
{ type: 'ADMIN_PLAYER_ACTIVITY', activity: { ... } }
```

---

## 데이터베이스 스키마

### admin_accounts (관리자 계정)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | 기본키 |
| username | VARCHAR(50) | 로그인 ID (유니크) |
| password_hash | VARCHAR(255) | bcrypt 해시 |
| nickname | VARCHAR(50) | 표시 이름 |
| role | VARCHAR(20) | 'admin' 또는 'super_admin' |
| is_active | BOOLEAN | 활성화 상태 |
| last_login_at | TIMESTAMP | 마지막 로그인 시간 |
| created_at | TIMESTAMP | 생성일 |
| updated_at | TIMESTAMP | 수정일 |

### player_bans (밴 기록)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | 기본키 |
| player_id | UUID | 플레이어 ID (FK) |
| banned_by | UUID | 밴 처리한 관리자 ID (FK) |
| reason | TEXT | 밴 사유 |
| banned_at | TIMESTAMP | 밴 시작 시간 |
| expires_at | TIMESTAMP | 만료 시간 (NULL = 영구밴) |
| unbanned_at | TIMESTAMP | 해제 시간 |
| unbanned_by | UUID | 해제한 관리자 ID (FK) |
| is_active | BOOLEAN | 현재 활성 밴 여부 |

### admin_activity_logs (활동 로그)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | 기본키 |
| admin_id | UUID | 관리자 ID (FK) |
| action | VARCHAR(100) | 수행한 작업 |
| target_type | VARCHAR(50) | 대상 유형 (player, class_progress 등) |
| target_id | UUID | 대상 ID |
| details | JSONB | 상세 정보 |
| ip_address | VARCHAR(45) | IP 주소 |
| created_at | TIMESTAMP | 시간 |

### player_profiles 확장 컬럼

| 컬럼 | 타입 | 설명 |
|------|------|------|
| is_banned | BOOLEAN | 밴 상태 |
| banned_until | TIMESTAMP | 밴 만료 시간 |

---

## API 엔드포인트

### 인증 API

| Method | Endpoint | 설명 | 권한 |
|--------|----------|------|------|
| POST | `/api/admin/auth/login` | 로그인 | - |
| POST | `/api/admin/auth/logout` | 로그아웃 | admin |
| GET | `/api/admin/auth/verify` | 토큰 검증 | admin |

### 플레이어 API

| Method | Endpoint | 설명 | 권한 |
|--------|----------|------|------|
| GET | `/api/admin/players` | 목록 조회 | admin |
| GET | `/api/admin/players/:id` | 상세 조회 | admin |
| PATCH | `/api/admin/players/:id` | 정보 수정 | super_admin |
| PATCH | `/api/admin/players/:id/class/:className` | 클래스 수정 | super_admin |
| DELETE | `/api/admin/players/:id` | 삭제 | super_admin |

### 밴 API

| Method | Endpoint | 설명 | 권한 |
|--------|----------|------|------|
| GET | `/api/admin/bans` | 밴 목록 | admin |
| POST | `/api/admin/bans/:id/ban` | 밴 처리 | super_admin |
| DELETE | `/api/admin/bans/:id/ban` | 밴 해제 | super_admin |

### 통계 API

| Method | Endpoint | 설명 | 권한 |
|--------|----------|------|------|
| GET | `/api/admin/stats/overview` | 개요 통계 | admin |
| GET | `/api/admin/stats/class-popularity` | 클래스 인기도 | admin |
| GET | `/api/admin/stats/game-modes` | 모드별 통계 | admin |
| GET | `/api/admin/stats/user-growth` | 사용자 증가 추이 | admin |
| GET | `/api/admin/stats/daily-games` | 일별 게임 수 | admin |

### 모니터링 API

| Method | Endpoint | 설명 | 권한 |
|--------|----------|------|------|
| GET | `/api/admin/monitoring/status` | 서버 상태 | admin |

---

## 파일 구조

### 프론트엔드 (`src/admin/`)

```
src/admin/
├── AdminApp.tsx              # 관리자 앱 진입점
├── pages/
│   ├── AdminLoginPage.tsx    # 로그인
│   ├── DashboardPage.tsx     # 대시보드
│   ├── PlayersPage.tsx       # 플레이어 목록
│   ├── PlayerDetailPage.tsx  # 플레이어 상세
│   └── MonitoringPage.tsx    # 실시간 모니터링
├── components/
│   └── layout/
│       ├── AdminLayout.tsx   # 공통 레이아웃
│       ├── Sidebar.tsx       # 사이드바
│       └── Header.tsx        # 헤더
├── stores/
│   ├── useAdminAuthStore.ts  # 인증 상태
│   ├── usePlayersStore.ts    # 플레이어 데이터
│   ├── useDashboardStore.ts  # 통계 데이터
│   └── useMonitoringStore.ts # 실시간 데이터
├── services/
│   ├── adminApi.ts           # API 호출
│   └── AdminWebSocket.ts     # WebSocket 클라이언트
└── types/
    └── admin.ts              # 타입 정의
```

### 백엔드 (`server/src/api/admin/`)

```
server/src/api/admin/
├── adminRouter.ts          # 라우터 진입점
├── adminAuthRouter.ts      # 인증 API
├── adminPlayersRouter.ts   # 플레이어 관리
├── adminStatsRouter.ts     # 통계 API
└── adminBanRouter.ts       # 밴 관리

server/src/middleware/
└── adminAuth.ts            # JWT 인증 미들웨어

server/src/state/
└── players.ts              # 온라인 사용자 추적
```

### 데이터베이스 마이그레이션

```
supabase/migrations/
└── 007_create_admin_tables.sql  # 관리자 테이블 생성
```

---

## 환경 변수

### 서버 (.env)

```env
# JWT 시크릿 (필수)
ADMIN_JWT_SECRET=your-secret-key

# Supabase 연결 (필수)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJ...
```

### 클라이언트 (.env)

```env
# API 서버 주소
VITE_API_URL=http://localhost:8080

# WebSocket 서버 주소
VITE_WS_URL=ws://localhost:8080
```

---

## 초기 관리자 계정 생성

SQL을 통해 초기 관리자 계정을 생성합니다:

```sql
-- bcrypt로 해싱된 비밀번호 사용
INSERT INTO admin_accounts (username, password_hash, nickname, role)
VALUES ('admin', '$2b$10$...', '관리자', 'super_admin');
```

또는 bcrypt CLI 도구 사용:

```bash
# 비밀번호 해싱
npx bcrypt-cli hash "your-password" 10
```
