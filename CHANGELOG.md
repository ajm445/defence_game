# Changelog

## [1.19.0] - 2026-02-01

### Features
- **RPG 튜토리얼 모드 추가**: 처음 플레이하는 유저를 위한 단계별 튜토리얼
  - RPG 로비 화면에 "튜토리얼" 버튼 추가
  - 8단계 튜토리얼 진행:
    1. 환영 - 게임 목표 및 규칙 설명
    2. 이동 - WASD 조작법 (3개 지점 순회)
    3. 자동 공격 - 사거리 내 자동 공격 설명
    4. 일반 스킬 (Shift) - 마우스 방향 스킬 사용
    5. 궁극기 (R) - 강력한 궁극기 사용
    6. 업그레이드 - 골드 획득 및 강화 시스템
    7. 적 기지 파괴 - 기지 공격으로 보스 소환
    8. 보스 처치 - 보스 격파로 튜토리얼 완료
  - 튜토리얼 전용 맵 (작은 크기, 적 기지 1개)
  - 튜토리얼 전용 설정 (약한 적, 느린 스폰, 약한 보스)
  - 이동 튜토리얼 시 화면에 목표 지점 마커 표시
  - 튜토리얼 완료 시 레벨/캐릭터 해금 시스템 안내

- **튜토리얼 전용 일시정지 메뉴**: ESC 키로 일시정지
  - 계속하기, 다시하기, 설정, 나가기 4개 버튼
  - 인라인 소리 설정 (음량 조절, 음소거)

### Bug Fixes
- **부활 시 카메라 추적**: 사망 후 부활 시 카메라가 자동으로 영웅을 따라가도록 수정
  - 기존: 부활 후 Space 키로 수동 고정 필요
  - 수정: `followHero: true` 자동 설정
- **튜토리얼 승리 사운드 중복**: 보스 처치 시 승리 사운드가 두 번 재생되던 버그 수정
- **중복 로그인 방지 강화**: 중복 로그인 시 클라이언트 측 강제 로그아웃 처리
  - 기존: WebSocket 연결만 거부되고 Supabase 세션은 유지
  - 수정: `DUPLICATE_LOGIN` 수신 시 즉시 Supabase 로그아웃 및 로그인 화면 리다이렉트
  - 어느 화면에서든 중복 로그인 감지 시 정상 처리

### New Files
- `src/components/screens/RPGTutorialScreen.tsx` - 튜토리얼 게임 화면
- `src/components/ui/RPGTutorialOverlay.tsx` - 튜토리얼 UI 오버레이
- `src/stores/useRPGTutorialStore.ts` - 튜토리얼 상태 관리

### Technical Changes
- `src/types/game.ts`: `GameScreen` 타입에 `'rpgTutorial'` 추가
- `src/App.tsx`: 튜토리얼 화면 라우팅 추가
- `src/components/screens/RPGCoopLobbyScreen.tsx`: 튜토리얼 버튼 추가, DUPLICATE_LOGIN 핸들러 정리
- `src/constants/rpgConfig.ts`: 튜토리얼 맵/스폰/보스 설정 추가
- `src/stores/useRPGStore.ts`: `initTutorialGame()`, `isTutorial` 상태 추가
- `src/hooks/useRPGGameLoop.ts`: 튜토리얼 스폰 로직 분기 처리
- `src/hooks/useRPGInput.ts`: 튜토리얼 모드 ESC 키 처리
- `src/game/rpg/nexusSpawnSystem.ts`: 튜토리얼 스폰 함수 추가
- `src/game/rpg/bossSystem.ts`: 튜토리얼 보스 생성 함수 추가
- `src/renderer/rpgRenderer.ts`: 튜토리얼 목표 마커 렌더링 추가
- `src/services/WebSocketClient.ts`: DUPLICATE_LOGIN 수신 시 강제 로그아웃 및 리다이렉트 처리
- `server/src/websocket/MessageHandler.ts`: 중복 로그인 디버그 로그 정리

---

## [1.18.3] - 2026-02-01

### Bug Fixes
- **온라인 상태 알림 버그 수정**: 연결 종료 시 친구들에게 오프라인 알림이 전달되지 않던 버그 수정
  - `onlineUserIds.delete()` 직접 호출 → `registerUserOffline()` 함수 호출로 변경
  - 콜백을 통해 친구들에게 상태 변경 알림 정상 전달
- **중복 로그인 정책 변경**: 기존 연결 종료 방식 → 새 로그인 거부 방식으로 변경
  - 이미 활성 세션이 있으면 새 로그인 시도 거부
  - 기존 세션이 비활성 상태(연결 끊김)인 경우에만 새 로그인 허용
- **중복 로그인 시 방 처리 추가**: 비활성 세션 정리 시 해당 플레이어의 방 참여 상태도 정리
  - 게임 방(`coopGameRooms`)에서 플레이어 제거
  - 대기 방(`waitingCoopRooms`)에서 플레이어 제거

### Technical Changes
- `server/src/websocket/WebSocketServer.ts`: `registerUserOffline()` import 및 사용
- `server/src/websocket/MessageHandler.ts`: 중복 로그인 처리 로직 개선
  - 기존 연결의 `ws.readyState` 확인하여 활성/비활성 상태 판단
  - 비활성 상태 시 방 정리 로직 추가

---

## [1.18.2] - 2026-01-31

### Bug Fixes
- **중복 로그인 방지**: 다른 기기에서 로그인 시 기존 연결 종료 및 자동 재연결 차단
  - `DUPLICATE_LOGIN` 메시지 타입 추가
  - 수동 연결 시 플래그 리셋하여 로그아웃 후 재접속 허용
- **싱글플레이 사망 버그 수정**: 캐릭터 사망 시 게임이 종료되던 버그 수정
  - 게임 종료 조건을 넥서스 파괴로 한정
  - 캐릭터 사망 후 부활 대기 시스템 정상 작동
- **호스트 사망 알림 중복 방지**: 멀티플레이에서 호스트 사망 알림이 여러 번 표시되던 버그 수정
- **클라이언트 사망 알림 누락 수정**: 멀티플레이 클라이언트에서 사망 알림이 표시되지 않던 버그 수정
- **친구 초대 시 로비 튕김 수정**: 방 초대 수락 메시지를 호스트가 받으면 로비로 튕기던 버그 수정
  - 이미 방에 있는 경우 `GAME_INVITE_ACCEPTED` 처리 무시

### Improvements
- **SP 공격속도 업그레이드 적용**: Q스킬 쿨다운 감소에 SP 공격속도 보너스가 실제로 적용되도록 수정
- **방 목록 실시간 업데이트**: Push 방식으로 방 생성/참가/퇴장 시 즉시 업데이트
  - `COOP_ROOM_LIST_UPDATED` 메시지 타입 추가
  - 폴링 주기 3초 → 10초로 변경 (백업용)
- **온라인 플레이어 목록 개선**: 본인 표시 추가 및 목록 최상단 정렬
  - `isMe` 필드 추가
  - 본인에게는 친구 요청/초대 버튼 숨김
- **친구 상태 표시 개선**: 게임 진행 중일 때만 `currentRoom` 표시
  - `isInGame` 필드로 방 입장 vs 실제 게임 중 구분
- **친구 요청 응답 UX 개선**: 응답 후 목록에서 즉시 제거

### Technical Changes
- `WebSocketClient.ts`: `isDuplicateLogin` 플래그 및 처리 로직 추가
- `useRPGGameLoop.ts`: 클라이언트 사망 알림 로직 추가 (`wasClientDeadRef`)
- `useRPGStore.ts`: `updateSkillCooldowns`에 SP 공격속도 배율 적용
- `shared/types/network.ts`: `DUPLICATE_LOGIN` 서버 메시지 타입 추가
- `shared/types/rpgNetwork.ts`: `COOP_ROOM_LIST_UPDATED` 메시지 타입 추가
- `shared/types/friendNetwork.ts`: `OnlinePlayerInfo`에 `isMe` 필드 추가
- `server/src/state/players.ts`: `Player` 인터페이스에 `isInGame` 필드 추가
- `server/src/room/CoopRoomManager.ts`: 방 목록 변경 시 브로드캐스트 함수 추가
- `server/src/game/RPGCoopGameRoom.ts`: 게임 상태 변경 시 친구 알림 연동
- `server/src/friend/FriendManager.ts`: `isInGame` 기반 상태 표시 로직
- `server/src/friend/FriendRequestHandler.ts`: 양측에 친구 추가 알림 전송

---

## [1.18.1] - 2026-01-30

### Bug Fixes
- 멀티플레이어 버그 수정
- 친구 사이드바 UI 추가

---

## [1.18.0] - 2026-01-29

### Features
- 친구 시스템 구현

---

## [1.17.20] - 2026-01-28

### Bug Fixes
- 멀티플레이어 클라이언트 데미지 숫자 중복 버그 수정
