# Changelog

## [1.19.4] - 2026-02-02

### Features
- **극한 난이도 랭킹 시스템**: 극한 난이도 클리어 기록을 저장하고 조회하는 랭킹 시스템
  - 1인/2인/3인/4인 플레이어 수별 별도 랭킹
  - 표시 정보: 순위, 클리어 시간, 참여 플레이어 닉네임, 캐릭터 정보(직업, 레벨)
  - 로비 화면에 🏆 랭킹 버튼 추가 (직업 도감 왼쪽)
  - 극한 난이도 승리 시 자동 랭킹 저장 (싱글/멀티 호스트)
  - 상위 20개 기록 표시, 1~3위는 메달 아이콘으로 강조

### Improvements
- **온라인 플레이어 목록 실시간 동기화**: 플레이어 접속/해제 즉시 반영
  - 새 메시지 타입 추가: `ONLINE_PLAYER_JOINED`, `ONLINE_PLAYER_LEFT`
  - 로그인 시 모든 온라인 플레이어에게 즉시 브로드캐스트
  - 로그아웃 시 모든 온라인 플레이어에게 즉시 브로드캐스트
  - 5초 폴링은 안전망으로 유지 (누락 복구용)
- **RTS 모드 유닛 카운트 표시**: 각 유닛 버튼에 현재 보유 유닛 수 뱃지 표시
  - 싱글플레이: 플레이어 유닛 카운트
  - 멀티플레이: 내 사이드의 유닛만 카운트

### Bug Fixes
- **RTS 멀티플레이어 효과음 중복 버그 수정**: 상대방 유닛 소환 시 효과음이 중복 재생되던 버그
  - 클릭 시 즉시 재생 제거, 서버 UNIT_SPAWNED 이벤트에서만 재생

### New Files
- `supabase/migrations/010_create_extreme_rankings.sql` - 랭킹 테이블 스키마
- `server/src/api/rankingsRouter.ts` - 랭킹 API (GET/POST)
- `src/services/rankingService.ts` - 클라이언트 랭킹 서비스
- `src/components/ui/RankingModal.tsx` - 랭킹 모달 UI

### Technical Changes
- `server/src/websocket/WebSocketServer.ts`: rankingsRouter 등록
- `src/components/screens/RPGCoopLobbyScreen.tsx`: 랭킹 버튼 및 모달 연동
- `src/components/screens/RPGModeScreen.tsx`: 극한 난이도 승리 시 랭킹 저장 로직
- `shared/types/friendNetwork.ts`: 온라인 플레이어 실시간 메시지 타입 추가
- `server/src/friend/FriendManager.ts`: `broadcastPlayerJoined()`, `broadcastPlayerLeft()` 메서드 추가
- `server/src/websocket/MessageHandler.ts`: 온라인 상태 콜백에서 브로드캐스트 호출
- `src/stores/useFriendStore.ts`: `addOnlinePlayer()`, `removeOnlinePlayer()` 액션 추가
- `src/hooks/useFriendMessages.ts`: 새 메시지 타입 핸들러 추가
- `src/components/ui/UnitButton.tsx`: `count` prop 추가, 유닛 카운트 뱃지 UI
- `src/components/ui/UnitPanel.tsx`: `unitCounts` 계산 (useMemo), 멀티플레이어 효과음 중복 제거

### Notes
- 게스트 사용자는 랭킹에 저장되지 않음 (계정 보유 사용자만 등록 가능)

---

## [1.19.3] - 2026-02-02

### Features
- **대기방 자동 파기**: 호스트가 비활성 상태일 때 방 자동 정리
- **대기방 채팅**: 로비에서 대기 중인 플레이어들끼리 채팅 기능

### Improvements
- **VIP 경험치 배율 상향**: 1.5배 → 2배로 변경

---

## [1.19.2] - 2026-02-02

### Features
- **VIP 시스템 추가**: VIP 사용자 경험치 보너스 및 UI 표시

---

## [1.19.1] - 2026-02-02

### Bug Fixes
- **싱글플레이 경험치 버그 수정**: 로비를 통한 싱글플레이에서 킬 경험치가 0이던 버그 수정
  - 킬 카운팅이 골드 보상 유무와 관계없이 실행되도록 변경
  - `myHeroId` 비교 시 fallback 추가 (게임 루프와 일관성 유지)
- **친구 삭제 시 한쪽만 삭제되는 버그 수정**: 양방향 삭제 중 하나만 실패해도 전체 실패로 처리
  - 기존: 둘 다 실패할 때만 오류 처리 (`error1 && error2`)
  - 수정: 하나라도 실패하면 오류 처리 (`error1 || error2`)
- **연결 종료 시 게임 초대 정리**: 플레이어 연결 종료 시 보낸 초대도 함께 정리
  - `gameInviteManager.cancelUserInvites()` 호출 추가
- **온라인 상태 알림 안정성 개선**: WebSocket 상태 체크 추가
  - 연결이 닫히는 중인 경우 알림 전송 스킵
- **GameInviteManager 메모리 누수 수정**: 서버 종료 시 타이머 정리
  - `cleanup()` 메소드 추가 및 서버 종료 시 호출
- **플레이어 재접속 상태 동기화**: `COOP_RECONNECT_INFO` 메시지 처리 추가
  - 재접속 시 호스트 정보 및 게임 상태 복원

### Technical Changes
- `src/stores/useRPGStore.ts`: `damageEnemy`, `damageBase` 함수 킬 카운팅 로직 수정
- `server/src/friend/FriendManager.ts`: 친구 삭제 및 온라인 상태 알림 로직 수정
- `server/src/friend/GameInviteManager.ts`: `cleanup()` 메소드 추가, 타이머 타입 수정
- `server/src/websocket/WebSocketServer.ts`: 연결 종료 핸들러에 초대 정리 추가, 서버 종료 시 cleanup 호출
- `src/hooks/useNetworkSync.ts`: `COOP_RECONNECT_INFO` 핸들러 및 `handleReconnectInfo()` 함수 추가
- `shared/types/rpgNetwork.ts`, `shared/types/hostBasedNetwork.ts`: `COOP_YOU_ARE_NOW_HOST` 타입에 `gameState` 필드 추가

---

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
