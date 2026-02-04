# Changelog

## [1.20.20] - 2026-02-05

### Bug Fixes
- **RPG 멀티플레이 클라이언트 예측 + 서버 보정 아키텍처 구현**:
  - 클라이언트 로컬 이동 예측으로 즉각적인 반응 제공
  - 호스트 위치와 차이 시 부드러운 보정 (30px 미만: 유지, 30-150px: 블렌드, 150px 초과: 스냅)
  - 돌진/시전/스턴 중에는 호스트 위치 100% 사용
  - 돌진 스킬 이펙트 2번 보이는 버그 수정 (로컬 dashState 설정 제거)
- **RPG 멀티플레이 클라이언트 사운드 누락 수정**:
  - E 스킬 사용 시 사운드 재생 추가
  - W 스킬 (돌진 아닌 경우) 사운드 재생 추가
  - 적 기지 파괴 시 사운드 및 알림 추가

### Technical Changes
- `src/stores/useRPGStore.ts`:
  - `applySerializedState`: 클라이언트 예측 + 서버 보정 로직 구현
  - 위치 차이에 따른 3단계 보정: 무시(< 30px) / 블렌드(30-150px) / 스냅(> 150px)
  - 기지 파괴 감지 로직 추가 (이전 상태와 비교하여 사운드/알림 트리거)
- `src/hooks/useRPGGameLoop.ts`:
  - 클라이언트 블록에 로컬 이동 예측 추가 (즉각 반응)
  - 돌진/시전/스턴 중에는 예측 중지
  - `handleClientSkillExecution`: 로컬 dashState 설정 제거, E/W 스킬 사운드 추가

---

## [1.20.19] - 2026-02-04

### Features
- **RPG 방 타임아웃 경고**: 방 생성 후 9분 경과 시 1분 전 경고 메시지 표시
  - 노란색 배너로 "1분 후 게임을 시작하지 않으면 방이 자동으로 파기됩니다" 안내
  - 게임 시작 또는 방 파기 시 경고 자동 해제

### Technical Changes
- `server/src/room/CoopRoomManager.ts`:
  - `WARNING_MS` 설정 추가 (9분)
  - `timeoutWarningNotified` 플래그로 중복 경고 방지
  - `COOP_ROOM_TIMEOUT_WARNING` 메시지 전송 로직 추가
- `shared/types/rpgNetwork.ts`:
  - `COOP_ROOM_TIMEOUT_WARNING` 메시지 타입 추가
- `src/components/screens/RPGCoopLobbyScreen.tsx`:
  - 타임아웃 경고 상태 및 UI 추가 (pulse 애니메이션)

---

## [1.20.18] - 2026-02-04

### Features
- **RTS 멀티플레이 크리스탈 채집**: 채집꾼이 크리스탈 노드에서 크리스탈을 채집할 수 있도록 추가
  - 약초 채집 시 0.1% 확률로 크리스탈 보너스 획득 (싱글플레이와 동일)

### Bug Fixes
- **싱글/멀티 밸런스 통일**:
  - 채집 거리: 30 → 50으로 통일 (싱글플레이 수정)
  - 돌 노드 재생성 시간: 90초 → 60초로 통일 (멀티플레이 수정)

### Technical Changes
- `server/src/game/GameRoom.ts`:
  - `findNearestResourceNode`: 채집꾼이 크리스탈 노드도 탐색하도록 수정
  - 자원 채집 로직: 크리스탈 노드 채집 시 크리스탈 획득, 약초 채집 시 0.1% 크리스탈 보너스
  - `RESOURCE_RESPAWN.rock`: 90 → 60초
- `src/game/units/supportUnit.ts`:
  - 채집 거리 판정: 30 → 50으로 변경

---

## [1.20.17] - 2026-02-04

### Improvements
- **RTS 튜토리얼 대폭 개선**: 스포트라이트 방식으로 사용자 경험 향상
  - 화면 어둡게 처리 + 하이라이트 효과로 클릭 유도
  - 유닛별 상세 설명 추가 (스펙, 전략 팁)
  - 클릭 유도 화살표 애니메이션
  - 조건 힌트 표시
  - 패널 위치 자동 조정 (하이라이트 요소 기준)

### Technical Changes
- `src/stores/useTutorialStore.ts`:
  - `HighlightTarget` 타입 추가
  - 각 단계에 `conditionHint` 필드 추가
  - 유닛 설명 전략 팁 포함하여 상세화
- `src/components/ui/TutorialOverlay.tsx`:
  - SVG 마스크 기반 스포트라이트 효과 구현
  - `data-tutorial-id` 속성으로 하이라이트 대상 찾기
  - 하이라이트 테두리 및 화살표 애니메이션
  - 동적 패널 위치 계산
- `src/components/ui/UnitButton.tsx`:
  - `tutorialId` prop 추가
- `src/components/ui/UnitPanel.tsx`:
  - 각 유닛 버튼에 `tutorialId` 전달
- `src/components/ui/ActionPanel.tsx`:
  - 액션 버튼에 `tutorialId` 추가
- `src/components/ui/ResourceBar.tsx`:
  - 자원 바에 `data-tutorial-id` 추가

---

## [1.20.16] - 2026-02-04

### Bug Fixes
- **로그아웃 시 연결 즉시 종료**: 로그아웃 시 WebSocket 연결도 함께 종료되어 접속자 수가 즉시 감소
  - 기존: 로그아웃 후에도 브라우저 종료 시까지 연결 유지
  - 변경: 로그아웃 시 `ws.close()` 호출로 즉시 연결 종료

### Technical Changes
- `server/src/websocket/MessageHandler.ts`:
  - `handleUserLogout`: 로그아웃 처리 후 WebSocket 연결 종료 추가
  - `player.userId = null` 설정으로 close 핸들러에서 중복 로그아웃 처리 방지

---

## [1.20.15] - 2026-02-04

### Bug Fixes
- **브라우저 종료 시 처리 개선**: 로그인 후 방에 있는 상태에서 브라우저를 종료해도 정상적으로 처리되도록 개선
  - 방 삭제/호스트 이전이 정상 작동
  - 자동 로그아웃 이벤트가 관리자 로그에 기록됨
  - 대기 방 처리 순서 수정으로 roomId가 null이 되기 전에 처리

### Improvements
- **RPG 방 목록 페이지네이션**: 5개 이상의 방이 있을 때 이전/다음 버튼으로 탐색 가능

### Technical Changes
- `server/src/websocket/WebSocketServer.ts`:
  - `ws.on('close')` 핸들러를 async로 변경
  - `registerUserOffline`에 `await` 추가로 처리 완료 보장
  - 로그인된 사용자의 브라우저 종료 시 로그아웃 이벤트 브로드캐스트
  - `roomId`를 미리 저장하여 방 처리 중 null 참조 방지
- `server/src/websocket/MessageHandler.ts`:
  - `handleCoopDisconnect`: 대기 방 처리를 게임 방 처리보다 먼저 수행
- `server/src/room/RoomManager.ts`:
  - `leaveRoom`: PvP 대기 방이 아닌 경우 roomId를 클리어하지 않도록 수정 (Coop 방 처리 가능하도록)
- `src/components/screens/RPGCoopLobbyScreen.tsx`:
  - 방 목록 페이지네이션 추가 (페이지당 5개)

---

## [1.20.14] - 2026-02-04

### Bug Fixes
- **보스 스킬 중복 시전 버그 수정**: 보스가 돌진 스킬 실행 후 이동 중에 다른 스킬을 시전하던 버그 해결
  - `dashState` 활성화 중에는 새 스킬 선택 방지
  - 기존: 기절/시전 중만 체크 → 변경: 돌진 이동 중도 체크

### Technical Changes
- `src/game/rpg/bossSystem.ts`:
  - `updateBossSkills`: 돌진 중(`dashState.progress < 1`) 스킬 사용 불가 조건 추가

---

## [1.20.13] - 2026-02-04

### Balance Changes
- **힐러 특수 효과 (힐 오로라) 상향**: 주변 150px 내 아군 초당 최대 HP 2% → **4%** 회복
- **힐러 R 스킬 (생명의 샘) 변경**: 15초간 5% → **10초간 10%** 회복 (총 회복량 75% → 100%)

### Bug Fixes
- **멀티플레이 2차 강화 미적용 버그 수정**: 방 생성/참가 시 전직 및 2차 강화 정보가 전달되지 않던 버그 해결
  - `RPGClassSelectScreen.tsx`에서 `advancedClass`, `tier` 파라미터 추가

### Technical Changes
- `src/constants/rpgConfig.ts`:
  - 힐러 `healAura.healPerSecond`: 0.02 → 0.04
  - 힐러 E 스킬 `duration`: 15 → 10, `healPercent`: 0.05 → 0.10
- `src/game/rpg/skillSystem.ts`: 생명의 샘 기본값 업데이트
- `src/hooks/useRPGGameLoop.ts`: 힐 오로라 주석 업데이트
- `src/components/screens/RPGClassSelectScreen.tsx`: 방 생성/참가 시 전직 정보 전달

---

## [1.20.12] - 2026-02-04

### Bug Fixes
- **온라인 상태 즉시 반영 안 되는 버그 수정**: 로그인 시 친구 목록에 온라인 상태가 간헐적으로 반영되지 않던 버그 해결
  - `registerUserOnline` 호출 시 `await` 추가로 브로드캐스트 완료 보장
- **친구 삭제 UI 즉시 반영**: 친구 삭제 시 서버 응답을 기다리지 않고 UI가 즉시 업데이트되도록 개선
  - 낙관적 업데이트(Optimistic Update) 패턴 적용
- **친구 요청 중복 키 오류 수정**: 이전에 친구였다가 삭제 후 다시 요청 시 발생하던 오류 해결
  - `maybeSingle()` 사용으로 기존 요청 확인
  - `accepted`/`rejected` 상태의 기존 요청 삭제 후 새로 생성
- **친구 재추가 후 초대 미수신 버그 수정**: 친구 삭제 후 다시 친구가 된 경우 게임 초대가 전달되지 않던 버그 해결
  - 위 중복 키 오류 수정으로 함께 해결

### Improvements
- **게임 초대 팝업 위치 변경**: 화면 중앙 상단에서 우측 상단으로 이동
  - 게임 플레이 중 시야 방해 최소화
- **같은 방 유저 초대 버튼 비활성화**: 이미 같은 방에 있는 플레이어에게는 초대 버튼이 비활성화
  - 불필요한 초대 요청 방지
- **RTS AI 대전 게임중 상태 표시**: RTS 모드에서 AI 대전 시 친구 목록에 "게임중" 상태 표시
  - `SET_IN_GAME` 메시지 타입 추가
  - 게임 시작/종료 시 서버에 상태 알림

### Technical Changes
- `server/src/websocket/MessageHandler.ts`:
  - `registerUserOnline` 호출에 `await` 추가
  - `handleSetInGame` 핸들러 추가
- `server/src/friend/FriendRequestHandler.ts`:
  - `maybeSingle()` 사용으로 중복 요청 확인 로직 개선
  - 기존 완료된 요청 삭제 후 재생성 로직 추가
- `src/components/ui/FriendSidebar.tsx`:
  - 친구 삭제 낙관적 업데이트 적용
  - `currentRoomId` prop 추가
- `src/components/ui/FriendPanel.tsx`:
  - 같은 방 유저 초대 버튼 비활성화 로직 추가
- `src/components/ui/GameInviteNotification.tsx`:
  - 팝업 위치 `top-4 right-70`으로 변경
- `src/components/screens/GameScreen.tsx`:
  - RTS AI 대전 시 `SET_IN_GAME` 메시지 전송 useEffect 추가
- `shared/types/network.ts`:
  - `SET_IN_GAME` 클라이언트 메시지 타입 추가

---

## [1.20.11] - 2026-02-04

### Bug Fixes
- **클라이언트 이동 지속 버그 수정**: 창 포커스를 잃을 때 키 상태가 유지되어 캐릭터가 멈추지 않던 버그 해결
  - `blur` 이벤트 핸들러 추가: 창 포커스 잃을 때 WASD 키 상태 초기화
  - `visibilitychange` 이벤트 핸들러 추가: 탭 전환 시 키 상태 초기화
  - 이동 중이었다면 `setMoveDirection(undefined)` 호출로 네트워크 동기화
- **클라이언트 슬라이딩 현상 수정**: 이동 멈출 때 캐릭터가 미끄러지는 현상 해결
  - 20px 미만 오차: 로컬 위치 유지 (미세 슬라이딩 방지)
  - 중간 오차(20-200px): 50%씩 빠른 보간으로 수렴

### Improvements
- **클라이언트 로직 단순화**: 호스트 권위적 아키텍처 강화
  - 클라이언트 자동 공격 제거 (호스트에서만 처리)
  - 불필요한 클라이언트 HP 재생/버프 로직 제거
  - 위치 동기화 로직 단순화 (복잡한 lerp 보정 제거)
- **위치 동기화 개선**: 상황별 최적화된 동기화 전략
  - 이동/돌진 중: 로컬 위치 100% 유지 (입력 반응성 우선)
  - 정지 상태: 호스트 위치로 빠르게 수렴
  - 200px 이상 오차: 즉시 호스트 위치로 스냅

### Technical Changes
- `src/hooks/useRPGInput.ts`:
  - `handleBlur`: 창 포커스 잃을 때 키 상태 초기화
  - `handleVisibilityChange`: 문서 가시성 변경 시 키 상태 초기화
- `src/hooks/useRPGGameLoop.ts`:
  - 클라이언트 자동 공격 로직 제거 (205줄 감소)
  - 클라이언트 HP 재생, 버프 업데이트 로직 제거
  - 이동/돌진 예측 로직 유지 (부드러운 움직임)
- `src/hooks/useNetworkSync.ts`:
  - `handleRemoteInput` 단순화: lerp 위치 보정 제거 (70줄 감소)
  - 호스트가 moveDirection으로 직접 위치 계산
- `src/stores/useRPGStore.ts`:
  - `applySerializedState` 단순화: 복잡한 위치 병합 로직 제거 (148줄 감소)
  - 슬라이딩 방지를 위한 20px 임계값 추가
  - `activeSkillEffects` 서버 상태 직접 사용 (필터링 제거)
- `shared/types/hostBasedNetwork.ts`:
  - `SerializedHero`에 `state` 필드 추가 (영웅 상태 동기화)

### Code Statistics
- 총 변경: -210줄 (단순화로 인한 코드 감소)
  - `useRPGGameLoop.ts`: -205줄
  - `useNetworkSync.ts`: -70줄
  - `useRPGStore.ts`: -148줄
  - `useRPGInput.ts`: +23줄
  - `hostBasedNetwork.ts`: +2줄

---

## [1.20.10] - 2026-02-04

### Bug Fixes
- **클라이언트 자동 공격 미작동 버그 수정**: 클라이언트 영웅의 기본 공격(Q 스킬)이 자동으로 실행되지 않던 버그 해결
  - 클라이언트 블록에 자동 공격 로직 추가 (적/기지 감지 및 스킬 요청 전송)
  - 로컬에서 사운드 및 이펙트 즉시 재생 (시각적 피드백)
  - `sendSkillUse('Q', ...)` 호출로 호스트에게 스킬 요청 전송
- **돌진 스킬 후 원위치 복귀 버그 수정 (개선)**: 돌진 완료 직후 서버의 이전 위치로 보정되는 버그 해결
  - 돌진 완료 시 위치를 서버에 즉시 전송 (`sendMoveDirection(null)`)
  - `applySerializedState`에서 "돌진 방금 완료" 상태 감지 추가
  - 서버가 아직 돌진 중이라고 생각할 때 로컬 위치 유지

### Technical Changes
- `src/hooks/useRPGGameLoop.ts`:
  - `sendSkillUse` import 추가
  - 클라이언트 자동 공격 로직 추가 (적/기지 사거리 체크, 스킬 요청, 로컬 이펙트)
  - 돌진 완료 시 `sendMoveDirection(null)` 호출로 위치 즉시 전송
- `src/stores/useRPGStore.ts`:
  - `applySerializedState`: `dashJustCompleted` 상태 감지 추가
  - 돌진 방금 완료 시 로컬 위치 유지 (서버 위치로 보정 안 함)

---

## [1.20.9] - 2026-02-04

### Bug Fixes
- **클라이언트 스킬 이펙트 만료 버그 수정**: 스킬 이펙트가 화면에 계속 남아있는 버그 해결
  - 클라이언트 블록의 early return 전에 이펙트 만료 체크 로직 추가
  - 기존: 클라이언트가 라인 440에서 반환하여 만료 체크에 도달하지 못함
- **이동기 스킬 원위치 복귀 버그 수정**: 돌진 스킬 사용 후 원래 위치로 텔레포트하는 버그 해결
  - 로컬 영웅의 dashState는 서버 상태를 적용하지 않도록 수정
  - 클라이언트 예측 완전 우선 (서버 dashState 무시)
- **클라이언트 기본공격 이펙트 미표시 버그 수정**: 클라이언트 영웅의 기본공격 이펙트가 보이지 않던 버그 해결
  - `executeOtherHeroSkill`에서 Q 스킬 실행 시 `basicAttackEffect` 생성 추가
  - 호스트가 클라이언트 영웅의 기본공격 처리 시 이펙트 동기화
- **메모리 누수 버그 수정**: 플레이어 연결 해제 시 관련 데이터가 정리되지 않던 버그 해결
  - `removeOtherHero`: `otherHeroesInterpolation`, `otherPlayersGold`, `otherPlayersUpgrades` 함께 정리
  - `clearOtherHeroes`: 위와 동일하게 모든 관련 데이터 정리
  - `resetMultiplayerState`: `otherHeroesInterpolation` 초기화 추가

### Technical Changes
- `src/hooks/useRPGGameLoop.ts`:
  - 클라이언트 블록에 이펙트 만료 체크 추가 (라인 423-437, early return 전)
- `src/hooks/useNetworkSync.ts`:
  - `executeOtherHeroSkill`: Q 스킬 실행 시 `addBasicAttackEffect` 호출 추가
- `src/stores/useRPGStore.ts`:
  - `applySerializedState`: dashState 병합 로직 수정 (서버 dashState 무시)
  - `removeOtherHero`: 관련 Map 데이터 함께 삭제 (메모리 누수 방지)
  - `clearOtherHeroes`: 관련 Map 데이터 함께 초기화
  - `resetMultiplayerState`: `otherHeroesInterpolation` 초기화 추가

---

## [1.20.8] - 2026-02-04

### Bug Fixes
- **방 자동 파기 시 플레이어 로비 이동 버그 수정**: 10분 타임아웃으로 방이 파기될 때 플레이어가 로비로 돌아가지 않던 버그 해결
  - 새로운 메시지 타입 `COOP_ROOM_DESTROYED` 추가 (기존 `COOP_ROOM_ERROR`와 분리)
  - 방 파기 시 플레이어 상태 초기화 및 로비 화면으로 자동 이동
  - 로비 채팅 기록 정리

### Technical Changes
- `server/src/room/CoopRoomManager.ts`:
  - 방 자동 파기 시 `COOP_ROOM_DESTROYED` 메시지 전송 (기존: `COOP_ROOM_ERROR`)
- `src/hooks/useNetworkSync.ts`:
  - `handleRoomDestroyed`: 로비 채팅 정리 추가
  - `COOP_ROOM_DESTROYED` 핸들러: `message` 필드 우선 사용
- `src/components/screens/RPGCoopLobbyScreen.tsx`:
  - `COOP_ROOM_DESTROYED` 핸들러 추가 (상태 초기화)

---

## [1.20.7] - 2026-02-04

### Bug Fixes
- **클라이언트 스킬 이펙트 잔상 버그 수정**: 이펙트가 화면에 계속 남아있는 버그 해결
  - 병합 로직 수정: 다른 영웅 이펙트는 서버 것만 사용 (이전: 로컬에 누적)
  - 내 영웅 이펙트만 로컬 유지, 다른 영웅 이펙트는 호스트가 권위
  - 서버에서 만료된 이펙트가 클라이언트에서 자동 제거됨

### Technical Changes
- `src/stores/useRPGStore.ts`:
  - `applySerializedState`: activeSkillEffects 병합 로직 개선
  - 기존: `[...localEffects, ...newServerEffects]` (누적 문제)
  - 개선: `[...myLocalEffects, ...otherEffectsFromServer]` (서버 권위)

---

## [1.20.6] - 2026-02-03

### Bug Fixes
- **클라이언트 스킬 이펙트 위치 버그 수정**: 스킬 이펙트가 사용 시점 위치에 고정되는 버그 해결
  - 모든 스킬 이펙트에 `heroId` 필드 추가 (SkillEffect 인터페이스)
  - 클라이언트에서 자신의 이펙트와 다른 플레이어 이펙트를 분리하여 병합
  - 자신의 이펙트는 로컬 상태 유지, 다른 플레이어 이펙트는 서버에서 수신
- **클라이언트 돌진 스킬 텔레포트 버그 수정**: 돌진 후 원래 위치로 순간이동하는 버그 해결
  - 로컬 dashState 우선 처리 (클라이언트 예측)
  - 서버 dashState가 로컬 dashState를 덮어쓰지 않도록 수정

### Technical Changes
- `src/types/rpg.ts`:
  - `SkillEffect` 인터페이스에 `heroId?: string` 필드 추가
- `src/hooks/useRPGGameLoop.ts`:
  - `processSkillResult`: 이펙트에 heroId 추가
  - 클라이언트 스킬 핸들러 (Q/W/E): 이펙트에 heroId 추가
  - 다른 영웅 공격 이펙트 (3개소): heroId 추가
  - pendingSkill 이펙트 (14개소): casterId를 heroId로 사용
- `src/hooks/useNetworkSync.ts`:
  - 호스트의 클라이언트 스킬 처리 시 이펙트에 heroId 추가
- `src/stores/useRPGStore.ts`:
  - `applySerializedState`: activeSkillEffects 병합 로직 구현
  - 자신의 이펙트는 로컬 유지, 다른 플레이어 이펙트만 서버에서 수신

---

## [1.20.5] - 2026-02-03

### Bug Fixes
- **클라이언트 기본공격 색상 이펙트 미적용 수정**: 다른 영웅의 스킬 이펙트에 `advancedClass` 누락
  - `useRPGGameLoop.ts`의 `addSkillEffect` 호출 3개소에 `advancedClass: hero.advancedClass` 추가
  - 전직 직업별 고유 색상이 클라이언트에서도 정상 표시
- **클라이언트 이동 버벅임 수정**: 이동 중 위치 보정으로 인한 끊김 현상 해결
  - 이동 중일 때 150-250px 오차에서도 lerp 보정 적용하지 않음
  - 250px 이상 오차만 즉시 스냅 (이동 중이든 아니든)

### Improvements
- **클라이언트 위치 전송 빈도 증가**: 200ms → 50ms (서버 브로드캐스트와 동일)
  - 호스트-클라이언트 간 위치 드리프트 감소
  - 더 정확한 위치 동기화

### Technical Changes
- `src/hooks/useRPGGameLoop.ts`:
  - 다른 영웅 스킬 이펙트에 `advancedClass` 추가 (3개소)
  - `POSITION_SEND_INTERVAL`: 200ms → 50ms
- `src/stores/useRPGStore.ts`:
  - 위치 보정 로직 변경: 이동 중 250px 미만 오차 무시

---

## [1.20.4] - 2026-02-03

### Bug Fixes
- **버프 duration 체크 누락 수정**: 만료된 버프(duration ≤ 0)가 여전히 효과를 적용하던 버그 수정
  - `swiftness` 이동속도 버프: 3개소 (heroUnit.ts, useRPGGameLoop.ts x2)
  - `berserker` 공격력/공격속도 버프: 4개소 (skillSystem.ts x2, useRPGGameLoop.ts x2, useRPGStore.ts)
  - `stun` 상태 체크: 1개소 (heroUnit.ts)
  - 총 8개 위치에서 `&& b.duration > 0` 조건 추가
- **다른 플레이어 이동 예측 속도 버그 수정**: 보간 완료 후 예측 이동이 60배 느리게 계산되던 버그
  - `updateOtherHeroesInterpolation`에서 `* 60` 승수 누락 수정
  - 다른 플레이어가 멈추거나 지연되어 보이는 현상 해결
- **맵 경계 일관성 수정**: 다른 플레이어 보간에서 경계 마진이 0px이던 것을 30px로 수정
  - `Math.max(0, ...)` → `Math.max(30, Math.min(MAP_WIDTH - 30, ...))` 로 변경
- **속도 폴백 일관성 수정**: `heroUnit.ts`에서 speed 폴백 누락 수정
  - `config.speed || baseSpeed` → `config.speed || baseSpeed || 200`
- **스턴 상태 이동 제한 수정**: 호스트 영웅이 스턴 중에도 이동할 수 있던 버그
  - `heroUnit.ts`에 스턴 상태 체크 추가 (`isStunned`)
- **스킬 사용 중복 검증 추가**: 시전/돌진/스턴 중 스킬 사용 방지
  - 호스트/클라이언트 양쪽에 방어적 체크 추가
  - `useNetworkSync.ts`에서 다른 영웅 스킬 실행 전 상태 검증

### Improvements
- **클라이언트 돌진 애니메이션 로컬 처리**: 서버 응답 대기 중에도 부드러운 돌진 애니메이션
  - 클라이언트에서 dashState 로컬 업데이트 후 서버 상태와 병합
- **위치 동기화 개선**: 오차 크기에 따른 단계별 보정
  - 80px 미만: 이동 중이면 로컬 위치 유지 (부드러운 움직임)
  - 80-150px: 느린 lerp 보정 (10%)
  - 150-250px: 빠른 lerp 보정 (20%)
  - 250px 이상: 즉시 서버 위치로 스냅
- **부활 시 버프 초기화**: 기존 버프(스턴 포함) 모두 제거 후 무적 버프만 추가
  - 사망 전 CC 상태가 부활 후에도 유지되던 문제 해결
- **스킬 타겟 좌표 보정**: 클라이언트-호스트 위치 차이만큼 스킬 타겟 좌표 조정
  - 이동 중 스킬 사용 시 의도한 위치에 스킬 발동
- **스킬 쿨다운 병합 개선**: 로컬과 서버 중 더 높은 쿨다운 값 사용
  - 스킬 사용 직후 쿨다운이 리셋되어 보이는 현상 방지
- **시전 상태 병합 개선**: 로컬과 서버 중 더 높은 castingUntil 값 사용
- **무적/돌진 중 CC 면역**: 무적 버프나 돌진 중에는 스턴/넉백 적용 안 함
- **다른 영웅 이동 시 신속 버프 적용**: 호스트에서 다른 영웅 이동 계산 시 swiftness 버프 적용
- **클라이언트 주기적 위치 전송**: 200ms마다 호스트에 위치 동기화

### Technical Changes
- `src/game/rpg/heroUnit.ts`: 스턴 체크 추가, 속도 폴백 수정, swiftness duration 체크
- `src/game/rpg/skillSystem.ts`: berserker duration 체크 2개소
- `src/hooks/useRPGGameLoop.ts`:
  - 클라이언트 돌진 로컬 애니메이션 추가
  - swiftness/berserker/stun duration 체크 4개소
  - 스킬 사용 전 상태 검증 추가
  - 무적/돌진 중 CC 면역 처리
  - 다른 영웅 이동 시 swiftness 버프 적용
- `src/hooks/useNetworkSync.ts`:
  - 위치 보정 로직 개선 (오차별 lerp/snap)
  - 스킬 타겟 좌표 보정 추가
  - 다른 영웅 스킬 실행 전 상태 검증
- `src/stores/useRPGStore.ts`:
  - 위치 동기화 임계값 조정 (50→80, 150→250)
  - 돌진 상태 병합 로직 개선
  - 스킬 쿨다운/시전 상태 병합 개선
  - 부활 시 버프 초기화
  - 다른 플레이어 이동 예측 * 60 수정

---

## [1.20.0] - 2026-02-02

### Features
- **RTS 모드 로그인 연동**: RTS 모드도 로그인 필수로 변경
  - RPG 모드와 동일한 계정/게스트 로그인 사용
  - 플레이어 레벨을 RPG 모드와 공유
  - AI 대전에서만 플레이어 경험치 획득 (승리 100 + 시간 보너스, 패배 30 + 시간 보너스)
  - VIP 2배 보너스 적용, 튜토리얼/멀티플레이어는 경험치 없음
  - 1vs1 대전에서 로그인 닉네임 자동 사용
  - 난이도 선택에서 보스테스트 옵션 제거
- **RTS 전투 BGM**: RTS 게임 중 배경 음악 재생
  - 전략적이고 긴장감 있는 마칭 스타일 BGM
  - 튜토리얼 모드에서는 BGM 없음
- **RTS 모드 프로필 및 온라인 표시**: RPG 모드와 동일한 UI 통합
  - 프로필 버튼: RPG 모드와 동일한 위치/크기 (좌측 상단)
  - 온라인 상태 바: 우측 상단에 온라인 플레이어 수, 게임 중, 대기방 표시
  - 자동 WebSocket 연결로 실시간 온라인 상태 표시
- **RTS 전용 프로필 화면**: RTS 모드에서 프로필 클릭 시 간소화된 화면 표시
  - 플레이어 레벨 정보만 표시 (RPG 클래스 진행/통계 숨김)
  - "플레이어 레벨은 RTS와 RPG 모드에서 공유됩니다" 안내 문구

### Improvements
- **RTS 모드 유닛 카운트 표시**: 각 유닛 버튼에 현재 보유 유닛 수 뱃지 표시
  - 싱글플레이: 플레이어 유닛 카운트
  - 멀티플레이: 내 사이드의 유닛만 카운트
  - 뱃지 위치: 버튼 내부 우상단 (인접 버튼과 겹침 방지)
- **RTS 모드 버튼 효과음**: 모든 버튼에 클릭 효과음 적용
  - 난이도 선택, 모드 선택, 로비 화면, 게임 결과 화면 등
- **일시정지 화면 개선**: "메인 메뉴" 버튼을 "로비로 돌아가기"로 변경
  - AI 대전: 난이도 선택 화면으로 이동
  - 튜토리얼: RTS 모드 선택 화면으로 이동
  - RPG: 기존대로 대기방 로비로 이동

### Bug Fixes
- **RTS 멀티플레이어 효과음 중복 버그 수정**: 상대방 유닛 소환 시 효과음이 중복 재생되던 버그
  - 클릭 시 즉시 재생 제거, 서버 UNIT_SPAWNED 이벤트에서만 재생
- **RTS 1vs1 연결 버그 수정**: ServerStatusBar가 먼저 WebSocket 연결 시 CONNECTED 메시지 누락 문제
  - useMultiplayerStore에서 이미 연결된 경우 상태 수동 설정

### Technical Changes
- `src/components/ui/UnitButton.tsx`: `count` prop 추가, 유닛 카운트 뱃지 UI
- `src/components/ui/UnitPanel.tsx`: `unitCounts` 계산 (useMemo), 멀티플레이어 효과음 중복 제거
- `src/components/ui/ServerStatusBar.tsx`: 자동 연결, 연결 상태별 UI (연결 중/오프라인/온라인)
- `src/components/screens/GameTypeSelectScreen.tsx`: RTS 모드 로그인 체크 추가
- `src/components/screens/ModeSelectScreen.tsx`: ProfileButton + ServerStatusBar 추가
- `src/components/screens/DifficultySelectScreen.tsx`: ProfileButton + ServerStatusBar 추가, 보스테스트 옵션 제거
- `src/components/screens/LobbyScreen.tsx`: ProfileButton + ServerStatusBar 추가, 로그인 닉네임 자동 사용
- `src/components/screens/ProfileScreen.tsx`: RTS/RPG 모드별 다른 컨텐츠 표시
- `src/components/screens/PauseScreen.tsx`: "로비로 돌아가기" 버튼으로 변경, 모드별 이동 화면 분기
- `src/components/screens/GameScreen.tsx`: RTS BGM 재생
- `src/components/screens/GameOverScreen.tsx`: RTS 경험치 저장 및 표시 로직, 버튼 효과음
- `src/services/profileService.ts`: `processRTSGameResult()` 함수 추가
- `src/services/SoundManager.ts`: `rts_battle` BGM 타입 및 재생 로직 추가
- `src/stores/useProfileStore.ts`: `handleRTSGameEnd()` 액션 추가
- `src/stores/useMultiplayerStore.ts`: 이미 연결된 WebSocket 상태 처리 추가

### Removed Files
- `src/components/ui/RTSPlayerLevel.tsx` - ProfileButton으로 대체됨

---

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
