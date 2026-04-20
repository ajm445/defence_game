# Cloudflare 봇/어뷰즈 차단 설정 가이드

해외발 봇 트래픽으로 인한 Railway 비용 증가를 막기 위해, **Cloudflare 무료 플랜**을 게임 서버 앞에 배치하여 봇/크롤러/데이터센터 IP를 엣지에서 차단합니다. 정상 사용자(국내·해외 모두)는 통과합니다.

---

## 0. 개요

### 왜 Cloudflare 엣지 차단인가?
- 봇 트래픽이 Railway에 도달하면 **곧바로 과금**이 발생합니다.
- Cloudflare는 트래픽이 **Railway에 닿기 전**에 엣지에서 검사·차단하므로 비용 절감 효과가 큽니다.
- 무료 플랜으로도 다음이 가능합니다:
  - Bot Fight Mode (자동 봇 차단)
  - WAF Custom Rules **5개**
  - Rate Limiting **1개**
  - Browser Integrity Check, Managed Challenge 등

### 다층 방어 구조
```
[봇/사용자]
   ↓
[Cloudflare 엣지]   ← Bot Fight Mode + WAF + Rate Limit + 정적 자산 캐싱 (1차)
   ↓                  (프론트 자산은 여기서 대부분 응답)
   ↓
[Railway 백엔드]    ← Host 화이트리스트 미들웨어 (Cloudflare 우회 차단)
[Railway 프론트]    ← 정적 호스팅 (Cloudflare 캐시로 트래픽 최소화)
   ↓
[Express/WebSocket] ← 기존 IP rate limiter (3차 백업)
```

프론트와 백엔드 **모두 Cloudflare 뒤에 두어** Railway로 직접 들어오는 트래픽을 최소화합니다. 본 가이드를 완료하면 Cloudflare가 정적 자산을 캐싱하여 프론트 트래픽 비용도 거의 0에 가까워집니다.

---

## 1. 사전 준비

| 항목 | 확인 |
|------|------|
| 도메인 | 보유 중 (예: `yourdomain.com`) |
| Railway 서버(백엔드) 도메인 | `<server-project>.up.railway.app` 형식 |
| Railway 클라이언트(프론트) 도메인 | `<client-project>.up.railway.app` 형식 |
| Railway 환경변수 권한 | 양쪽 서비스 모두 환경변수 수정 가능 |

---

## 2. 1단계: 도메인을 Cloudflare에 연결

1. https://cloudflare.com 가입 후 로그인
2. 우측 상단 **Add a Site** → 도메인 입력 → **Free 플랜** 선택
3. Cloudflare가 기존 DNS 레코드를 자동 감지합니다. **Continue**
4. Cloudflare가 안내하는 **네임서버 2개**(예: `xxx.ns.cloudflare.com`)를 복사
5. 도메인 등록 기관(가비아/후이즈/Namecheap 등) 관리 콘솔에서 **네임서버를 위 2개로 변경**
6. 변경 후 Cloudflare 대시보드 → **Check nameservers** 클릭
7. 활성화 알림 메일 수신까지 수 분 ~ 수 시간 대기

> 확인 방법: 터미널에서 `nslookup -type=ns yourdomain.com` 실행 시 Cloudflare 네임서버가 표시되면 완료.

---

## 3. 2단계: DNS 레코드 설정

Cloudflare 대시보드 → 도메인 선택 → **DNS → Records**

### 3-1. 백엔드 서브도메인 추가
**Add record** 클릭:

| 항목 | 값 |
|------|-----|
| Type | `CNAME` |
| Name | `api` (→ `api.yourdomain.com`이 됨) |
| Target | `<server-project>.up.railway.app` |
| Proxy status | **Proxied (주황 구름 ON)** ⚠️ 필수 |
| TTL | Auto |

### 3-2. 프론트엔드 서브도메인 추가
한 번 더 **Add record** 클릭:

| 항목 | 값 |
|------|-----|
| Type | `CNAME` |
| Name | `game` (→ `game.yourdomain.com`이 됨, 원하는 이름 사용 가능) |
| Target | `<client-project>.up.railway.app` |
| Proxy status | **Proxied (주황 구름 ON)** ⚠️ 필수 |
| TTL | Auto |

> **주의**: Proxy status가 회색 구름이면 Cloudflare를 우회합니다. 반드시 주황 구름이어야 보호가 적용됩니다.

### 3-3. Railway에서 커스텀 도메인 등록
Railway가 새 도메인의 요청을 받아들이도록 등록해야 합니다.

**백엔드 서비스**:
- Railway 서버 프로젝트 → **Settings → Networking → Custom Domain**
- `api.yourdomain.com` 입력 → Add

**프론트엔드 서비스**:
- Railway 클라이언트 프로젝트 → **Settings → Networking → Custom Domain**
- `game.yourdomain.com` 입력 → Add

> Railway가 도메인 검증을 위해 별도 CNAME 값을 요구할 수 있습니다. 그 경우 Cloudflare DNS 레코드의 Target을 Railway가 안내한 값으로 교체하세요.

### 3-4. SSL/TLS 모드
좌측 메뉴 **SSL/TLS → Overview**:
- 모드를 **Full (strict)** 로 변경
  - Flexible은 Cloudflare↔Railway 구간이 HTTP라 보안 취약

### 3-5. WebSocket 활성화 확인
좌측 메뉴 **Network**:
- **WebSockets**: 기본 ON 확인 (꺼져 있으면 켜기)

### 3-6. Always Use HTTPS
좌측 메뉴 **SSL/TLS → Edge Certificates**:
- **Always Use HTTPS**: ON

---

## 4. 3단계: 클라이언트 환경변수 변경

### 4-1. Railway 클라이언트 환경변수
Railway 대시보드 → **클라이언트(프론트) 서비스** → **Variables**:

| 변수 | 변경 전 | 변경 후 |
|------|---------|---------|
| `VITE_WS_URL` | `wss://<server-project>.up.railway.app` | `wss://api.yourdomain.com` |
| `VITE_API_URL` | `https://<server-project>.up.railway.app` | `https://api.yourdomain.com` |

> ⚠️ **둘 다 반드시 변경**해야 합니다. `VITE_WS_URL`은 WebSocket 연결, `VITE_API_URL`은 REST API(로그인/랭킹/유지보수 등) 호출에 사용됩니다. 한쪽만 변경하면 CORS 에러로 일부 기능이 동작하지 않습니다.

`VITE_*` 변수는 **빌드 타임에 번들에 박히므로** 저장 후 반드시 재배포가 트리거되는지 확인. (Railway는 환경변수 변경 시 자동 재배포). 만약 자동 재배포가 안 되면 **Deployments → 최신 배포 → Redeploy** 수동 실행.

### 4-2. 로컬 개발용 `.env`
필요 시 로컬 `.env` 도 같이 업데이트하거나, 로컬은 기존 값 유지.

---

## 5. 4단계: Railway 환경변수 추가

Railway 대시보드 → 서버 프로젝트 → **Variables**:

| 변수 | 값 |
|------|-----|
| `ALLOWED_HOSTS` | `api.yourdomain.com` |
| `CORS_ORIGIN` | `https://game.yourdomain.com` (다중 시 콤마 구분) |

저장하면 자동으로 재배포됩니다.

> **`ALLOWED_HOSTS`** 는 코드에 이미 추가된 미들웨어가 사용합니다. 미설정 시 미들웨어가 비활성(통과)되므로 **반드시 설정**하세요. 설정 후에는 `<railway>.up.railway.app` 직접 호출이 403으로 차단됩니다.

---

## 6. 5단계: Cloudflare 보안 기본값

좌측 메뉴 **Security → Settings**:

| 설정 | 값 |
|------|-----|
| Security Level | **Medium** |
| Challenge Passage | **30 minutes** |
| Browser Integrity Check | **ON** |

좌측 메뉴 **Security → Bots**:

| 설정 | 값 |
|------|-----|
| Bot Fight Mode | **ON** |

> Bot Fight Mode는 알려진 데이터센터 IP, 봇 시그니처, AS 기반 봇 트래픽을 자동 차단합니다 (무료).

### 6-1. (선택) Web Analytics / Browser Insights 비활성화

Cloudflare가 자동 삽입하는 `beacon.min.js`가 광고 차단 확장(uBlock 등)에 의해 막혀 콘솔에 `ERR_BLOCKED_BY_CLIENT` 에러가 표시될 수 있습니다. 앱 동작에는 무영향이지만, 콘솔이 깨끗해야 한다면 비활성화하세요.

- **신규 UI**: 좌측 **Analytics & Logs → Web Analytics** → 사이트 카드 우측 톱니바퀴 → **Disable**
- **구 UI**: 좌측 **Speed → Optimization → Content Optimization → Browser Insights** → **OFF**

비활성화 후 클라이언트 재배포 불필요. Cloudflare가 응답에 자동 삽입하던 스크립트만 멈춥니다.

---

## 7. 6단계: WAF Custom Rules (무료 5개 한도)

좌측 메뉴 **Security → WAF → Custom rules → Create rule**.

각 룰을 **Edit expression** 모드(Expression Editor)에서 작성하세요.

### 룰 1. 데이터센터 ASN 차단
- **Rule name**: `Block datacenter ASNs`
- **Expression**:
  ```
  (ip.geoip.asnum in {16509 14618 8075 15169 14061 20473 24940 16276 13335 396982})
  ```
  - 16509 AWS / 14618 AWS / 8075 Microsoft / 15169 Google / 14061 DigitalOcean / 20473 Vultr / 24940 Hetzner / 16276 OVH / 13335 Cloudflare WARP / 396982 Google Cloud
- **Action**: **Block**

### 룰 2. 의심스러운 User-Agent
- **Rule name**: `Challenge bot user agents`
- **Expression**:
  ```
  (http.user_agent contains "bot" or
   http.user_agent contains "crawler" or
   http.user_agent contains "spider" or
   http.user_agent contains "curl" or
   http.user_agent contains "python-requests" or
   http.user_agent contains "wget" or
   http.user_agent contains "scrapy") and
  not cf.client.bot
  ```
- **Action**: **Managed Challenge**
  - `cf.client.bot` 은 Googlebot 등 검증된 좋은 봇 — 화이트리스트

### 룰 3. 인증 엔드포인트 보호
- **Rule name**: `Challenge auth endpoints`
- **Expression**:
  ```
  (http.request.uri.path contains "/api/auth/")
  ```
- **Action**: **Managed Challenge**
  - 정상 사용자는 1회 통과 후 Challenge Passage(30분) 동안 무통과

### 룰 4. 빈 User-Agent
- **Rule name**: `Block empty user agents`
- **Expression**:
  ```
  (http.user_agent eq "")
  ```
- **Action**: **Block**

### 룰 5. (예비)
이상 트래픽 패턴을 1주일 모니터링 후 추가. 예시:
- 특정 Referer 차단
- 특정 경로의 비정상 접근 차단

---

## 8. 7단계: Rate Limiting (무료 1개)

좌측 메뉴 **Security → WAF → Rate limiting rules → Create rule**.

- **Rule name**: `Limit auth signup/guest`
- **If incoming requests match**:
  ```
  (http.request.uri.path eq "/api/auth/guest" or
   http.request.uri.path eq "/api/auth/signup")
  ```
- **When rate exceeds**: `5` requests per `10 minutes`
- **Then take action**: **Block** for `1 hour`
- **With the same characteristics**: IP

> 게스트 로그인은 12시간 토큰을 즉시 발급하므로 봇이 가장 노리는 엔드포인트입니다. 정상 사용자는 10분에 5회 이상 회원가입/게스트 로그인을 하지 않습니다.

---

## 9. 8단계: 동작 확인

### 9-1. DNS 전파 확인
```bash
nslookup api.yourdomain.com
# 응답이 104.x.x.x 또는 172.x.x.x (Cloudflare 대역)면 성공
```

### 9-2. 헬스체크 통과
브라우저에서:
```
https://api.yourdomain.com/health
```
→ `{"status":"ok","players":N}` 응답이면 성공.

### 9-3. 게임 정상 연결
`https://game.yourdomain.com` 접속 → 게임 진입 → WebSocket 연결 정상.
브라우저 개발자 도구 Network 탭에서 `wss://api.yourdomain.com` 으로 연결됨을 확인.

### 9-4. Railway 백엔드 직접 접근 차단 확인
```bash
curl -i https://<server-project>.up.railway.app/api/auth/guest
# HTTP/1.1 403 Forbidden
# {"error":"Forbidden"}
```
→ 코드에 추가된 Host 화이트리스트 미들웨어가 동작함.

> 프론트엔드(`<client-project>.up.railway.app`)는 정적 자산이라 Host 화이트리스트가 적용되지 않습니다. 봇이 직접 URL을 알아내 호출하는 트래픽은 막을 수 없으나, 정적 자산만 반환하므로 비용 영향이 작습니다. 완전 차단을 원하면 Railway에서 기본 도메인 노출을 비활성화하는 옵션 검토.

### 9-5. Cloudflare 봇 차단 확인
```bash
curl -i -A "python-requests/2.0" https://api.yourdomain.com/api/auth/guest
# HTTP/1.1 403 Forbidden 또는 Cloudflare Challenge HTML
```

### 9-6. 정상 브라우저 접속
직접 접속 시 Managed Challenge가 1회 표시될 수 있으나 통과 후 30분간 무통과.

---

## 10. 9단계: 모니터링

### 10-1. Cloudflare Security Events
좌측 메뉴 **Security → Events**:
- 실시간 차단 로그 확인
- 어떤 룰이 가장 많이 발동되는지 확인 → 룰 5 추가에 활용

### 10-2. 트래픽 분석
좌측 메뉴 **Analytics → Traffic**:
- 캐시된 트래픽 vs 오리진 트래픽 비율
- 국가별 요청 분포

### 10-3. Railway 사용량 비교
Railway 대시보드 **Usage**:
- 적용 전 1주 vs 적용 후 1주 비용 비교
- 일반적으로 봇 트래픽이 주 원인이면 50~90% 절감 효과 기대

---

## 11. 롤백 방법

문제 발생 시 즉시 원상복구:

1. Cloudflare DNS → `api` 레코드의 **Proxy status를 회색 구름(DNS only)** 으로 토글
   → Cloudflare를 우회하지만 도메인 연결은 유지
2. 또는 Railway 클라이언트의 `VITE_WS_URL` / `VITE_API_URL` 을 기존 Railway 도메인으로 되돌리고 재배포
3. WAF 룰 개별 비활성화는 즉시 반영됨

> 추가된 Host 미들웨어를 비활성화하려면 Railway 환경변수 `ALLOWED_HOSTS` 를 삭제하면 됩니다 (코드 변경 없이 통과 모드).

---

## 12. (선택) 추가 강화: Cloudflare Turnstile

게스트 로그인이 봇 표적이 계속된다면, **Cloudflare Turnstile**(reCAPTCHA 대안, 무료) 도입을 검토하세요.

- 클라이언트 게스트 로그인 화면에 위젯 추가
- 서버 `authRouter.ts` 게스트 라우트 시작부에서 토큰 검증
- 코드 변경이 필요하므로 별도 작업으로 진행

---

## 13. 자주 발생하는 문제

| 증상 | 원인 / 해결 |
|------|-------------|
| WebSocket 연결 실패 | Cloudflare Network → WebSockets ON 확인 |
| HTTPS 인증서 오류 | SSL/TLS 모드를 Full (strict)로 설정, Cloudflare가 자동 발급한 Edge Cert 활성 확인 |
| CORS 에러 (`No Access-Control-Allow-Origin`) | 클라이언트의 `VITE_API_URL` 또는 `VITE_WS_URL` 이 Railway에 등록되지 않은 도메인을 가리키고 있음. 두 변수 모두 `api.yourdomain.com` 으로 변경 후 재배포. 서버 `CORS_ORIGIN` 에 클라이언트 도메인 포함 확인 |
| 정상 사용자가 차단됨 | WAF 룰의 Action을 Block → Managed Challenge로 완화 |
| Health check 실패 | `/health` 경로는 미들웨어에서 화이트리스트 처리됨, Railway 헬스체크는 내부 네트워크라 통과 |
| `req.ip`가 Cloudflare IP로 표시 | `app.set('trust proxy', true)` 적용됨, `CF-Connecting-IP` 헤더 확인 |
| `ERR_BLOCKED_BY_CLIENT` 콘솔 에러 | Cloudflare Web Analytics beacon이 광고 차단기에 막힘. 6-1 단계로 비활성화 |
| Railway 직접 도메인 호출이 차단 안 됨 | `ALLOWED_HOSTS` 환경변수 설정 확인. 미설정 시 미들웨어가 통과 모드로 동작 |
| 루트 도메인(`makmu.kr`)이 안 열림 | Railway 프론트 서비스에 루트 도메인을 Custom Domain으로 등록했는지 확인. CNAME만으로는 부족 |
