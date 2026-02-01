# Railway 배포 가이드

Defence Game의 프론트엔드와 백엔드를 Railway에 배포하는 가이드입니다.

---

## 목차

1. [사전 준비](#사전-준비)
2. [Railway 프로젝트 생성](#railway-프로젝트-생성)
3. [백엔드 서버 배포](#백엔드-서버-배포)
4. [프론트엔드 클라이언트 배포](#프론트엔드-클라이언트-배포)
5. [환경 변수 설정](#환경-변수-설정)
6. [배포 확인](#배포-확인)
7. [트러블슈팅](#트러블슈팅)

---

## 사전 준비

### 필요한 정보

| 항목 | 설명 | 예시 |
|------|------|------|
| GitHub 저장소 | 프로젝트가 푸시된 저장소 | `username/defence_game` |
| Supabase URL | Supabase 프로젝트 URL | `https://xxx.supabase.co` |
| Supabase Anon Key | 공개 API 키 | `eyJhbG...` |
| Supabase Service Role Key | 서버용 비밀 키 | `eyJhbG...` |
| JWT Secret | 관리자 인증용 시크릿 (32자 이상) | `your-super-secret-key` |

---

## Railway 프로젝트 생성

1. [railway.app](https://railway.app) 접속
2. GitHub 계정으로 로그인
3. **New Project** 클릭
4. **Deploy from GitHub repo** 선택
5. 저장소 선택: `defence_game`

---

## 백엔드 서버 배포

### 서비스 생성

1. Railway 프로젝트에서 **New** → **GitHub Repo** 선택
2. 동일한 저장소 선택 (서버용으로 추가)
3. 서비스 이름을 `defence-game-server`로 변경

### Settings 설정

| 항목 | 값 |
|------|-----|
| **Root Directory** | `server` |
| **Build Command** | (비워두기 - 자동 감지) |
| **Start Command** | `npm run start` |

### 환경 변수 (Variables)

```env
CORS_ORIGIN=https://defence-game-client-production.up.railway.app
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
JWT_SECRET=your-jwt-secret-minimum-32-characters
```

> **참고**: `PORT`는 Railway가 자동 설정하므로 추가하지 않습니다.

### 도메인 설정

1. **Settings** → **Networking** → **Generate Domain**
2. 생성된 도메인 복사 (예: `defence-game-server-production.up.railway.app`)

---

## 프론트엔드 클라이언트 배포

### 서비스 생성

1. Railway 프로젝트에서 **New** → **GitHub Repo** 선택
2. 동일한 저장소 선택 (클라이언트용으로 추가)
3. 서비스 이름을 `defence-game-client`로 변경

### Settings 설정

| 항목 | 값 |
|------|-----|
| **Root Directory** | (비워두기) |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npx serve dist -s -l $PORT` |

### 환경 변수 (Variables)

```env
VITE_WS_URL=wss://defence-game-server-production.up.railway.app
VITE_API_URL=https://defence-game-server-production.up.railway.app
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

> **중요**: `VITE_WS_URL`은 `wss://` (HTTPS용 WebSocket)로 시작해야 합니다.

### 도메인 설정

1. **Settings** → **Networking** → **Generate Domain**
2. 생성된 도메인이 게임 접속 URL입니다

---

## 환경 변수 설정

### 서버 환경 변수 요약

| 변수명 | 필수 | 설명 |
|--------|------|------|
| `CORS_ORIGIN` | ✅ | 클라이언트 URL (CORS 허용) |
| `SUPABASE_URL` | ✅ | Supabase 프로젝트 URL |
| `SUPABASE_ANON_KEY` | ✅ | Supabase 공개 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase 서버 키 |
| `JWT_SECRET` | ✅ | 관리자 JWT 시크릿 |
| `PORT` | ❌ | Railway 자동 설정 |

### 클라이언트 환경 변수 요약

| 변수명 | 필수 | 설명 |
|--------|------|------|
| `VITE_WS_URL` | ✅ | WebSocket 서버 URL (`wss://...`) |
| `VITE_API_URL` | ✅ | REST API 서버 URL (`https://...`) |
| `VITE_SUPABASE_URL` | ✅ | Supabase 프로젝트 URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase 공개 키 |

---

## 배포 확인

### 1. 서버 헬스체크

브라우저에서 접속:
```
https://defence-game-server-production.up.railway.app/health
```

정상 응답:
```json
{"status":"ok","players":0}
```

### 2. 클라이언트 접속

브라우저에서 클라이언트 URL 접속:
```
https://defence-game-client-production.up.railway.app
```

### 3. WebSocket 연결 확인

1. 게임 접속
2. 브라우저 개발자 도구 (F12) → Console
3. WebSocket 연결 메시지 확인

---

## 트러블슈팅

### 서버 빌드 실패

**증상**: `Build failed` 에러

**해결방법**:
1. **Root Directory**가 `server`로 설정되어 있는지 확인
2. Deployments → 실패한 배포 → View Logs에서 에러 확인

### 클라이언트 빌드 실패

**증상**: 빌드 시 TypeScript 에러

**해결방법**:
1. 로컬에서 `npm run build` 실행하여 에러 확인
2. 에러 수정 후 푸시

### WebSocket 연결 실패

**증상**: 게임 접속 시 서버 연결 안됨

**해결방법**:
1. `VITE_WS_URL`이 `wss://`로 시작하는지 확인
2. 서버 `CORS_ORIGIN`에 클라이언트 URL이 정확히 설정되어 있는지 확인
3. 서버가 정상 실행 중인지 `/health` 엔드포인트 확인

### 환경 변수 변경 후 적용 안됨

**증상**: 환경 변수 변경했는데 반영 안됨

**해결방법**:
- 클라이언트: 환경 변수 변경 후 **재배포** 필요 (VITE 변수는 빌드 시 주입됨)
- 서버: 자동 재시작되지만, 안되면 수동 Redeploy

### 502 Bad Gateway

**증상**: 사이트 접속 시 502 에러

**해결방법**:
1. 서버/클라이언트 로그 확인
2. Start Command가 올바른지 확인
3. `PORT` 환경 변수를 직접 설정하지 않았는지 확인 (Railway 자동 설정)

---

## 배포 체크리스트

### 서버
- [ ] Root Directory: `server`
- [ ] Start Command: `npm run start`
- [ ] 환경 변수 5개 설정
- [ ] 도메인 생성
- [ ] `/health` 엔드포인트 응답 확인

### 클라이언트
- [ ] Root Directory: (비어있음)
- [ ] Build Command: `npm install && npm run build`
- [ ] Start Command: `npx serve dist -s -l $PORT`
- [ ] 환경 변수 4개 설정
- [ ] 도메인 생성
- [ ] 게임 접속 및 로그인 테스트

---

## 유용한 명령어

### Railway CLI (선택사항)

```bash
# 설치
npm install -g @railway/cli

# 로그인
railway login

# 프로젝트 연결
railway link

# 로그 확인
railway logs

# 배포
railway up
```

---

## 참고 링크

- [Railway 공식 문서](https://docs.railway.app/)
- [Railway Node.js 배포 가이드](https://docs.railway.app/guides/nodejs)
- [Vite 정적 사이트 배포](https://vitejs.dev/guide/static-deploy.html)
