# Changelog

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
