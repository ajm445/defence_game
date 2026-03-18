# Changelog

## [1.26.3] - 2026-03-18

### 궁수 계열 패시브 시스템 리워크
- **궁수 다중타겟**: 최대 타겟 2명 → 3명으로 상향
- **저격수 패시브 전환**: 전직 시 다중타겟 패시브가 공격력 증가 패시브로 전환 (동일 성장률 기반 데미지 보너스)
- **레인저 패시브 강화**: 다중타겟 확률 유지 + 최대 타겟 3명 → 5명으로 확장
- 서버/클라이언트 동기화 완료, 도감 및 업그레이드 UI에 전직별 패시브 변화 안내 추가

### 팔라딘 힐 시스템 변경
- **기본공격 힐 기준 변경**: 아군 최대 HP의 5% → 자신 최대 HP의 2% 회복으로 변경
- **궁극기(신성한 빛) 기준 변경**: 아군 각자 HP 30% 회복 → 자신 최대 HP의 20%를 전체 아군에 고정 회복
- W스킬(신성한 돌진) 아군 힐은 기존 유지 (아군 최대 HP의 10%)
- 서버/클라이언트 동기화 완료, 스킬 설명 및 도감 UI 수정

### 적 기지 균열 이펙트
- **HP 비례 균열 시각 효과**: 적 기지 성벽에 HP 감소에 따라 균열이 점진적으로 추가
  - 80~100%: 깨끗한 성벽
  - 60~80%: 균열 1개 (좌하단 대각선)
  - 40~60%: 균열 2개 (+우상단 갈라짐)
  - 20~40%: 균열 3개 (+중앙 세로 균열, 더 굵은 선)
  - 0~20%: 균열 4개 (+우하단 추가) + 성벽 파편 떨어지는 효과
- HP가 낮을수록 균열 선이 더 진해지고, 각 균열에서 갈라지는 가지 디테일 추가

### 직업 도감 패시브 설명 강화
- **전직별 기본 패시브 변화 안내 추가**: 버서커(피해흡혈 ×1.3 곱연산), 저격수(다중타겟→공격력 전환), 레인저(최대 대상 3→5명), 대마법사(보스 특공 곱연산)
- **팔라딘 힐 설명 수정**: "HP 5% 회복" → "자신 최대 HP의 2% 회복" (오해 소지 제거)
- 캐릭터 업그레이드 모달에 전직별 패시브 설명/포맷 반영

### 보스 기본공격 스프라이트 방향 수정
- **`boss_attack`을 `SPRITE_FACES_RIGHT`에서 제거**: 왼쪽 방향 스프라이트로 교체에 따른 반전 로직 제거

### 레인저 기본공격 스프라이트 프롬프트 수정
- **다중 사격 → 단일 화살 속사**: 레인저 기본공격 프롬프트를 궁수와 동일한 단일 화살 모션으로 변경 (다중타겟은 패시브 확률 효과)

### 저격수 신속 버프 시각 이펙트 추가
- **시안색 공전 파티클**: W스킬 사용 후 3초간 캐릭터 주위에 6개 시안색 파티클이 공전
  - 각 파티클에 글로우 후광, 크기/밝기/궤도가 각각 다른 주기로 맥동
  - 캐릭터 중심 은은한 시안 방사형 글로우
- 기존 berserker(불꽃)/ironwall(파란 방어막)/invincible(금색 보호막)과 동일한 버프 렌더링 패턴

### 수정 파일
- `server/src/game/rpgServerSkillSystem.ts`: 궁수 멀티타겟 3/5타겟, 저격수 패시브 전환, 팔라딘 기본공격/궁극기 힐 변경
- `server/src/game/rpgServerConfig.ts`: 팔라딘 basicAttackHeal 0.05→0.02
- `src/game/rpg/skillSystem.ts`: 클라이언트 멀티타겟/저격수 패시브/팔라딘 힐 동기화
- `src/game/rpg/passiveSystem.ts`: 전직별 패시브 설명/포맷 함수 확장
- `src/constants/rpgConfig.ts`: 팔라딘 healPercent 0.05→0.02, E스킬 0.3→0.2, 스킬 설명 수정
- `src/components/ui/ClassEncyclopediaModal.tsx`: 전직별 패시브 변화 안내, 팔라딘 힐 설명 수정
- `src/components/ui/CharacterUpgradeModal.tsx`: advancedClass 전달하여 전직별 패시브 표시
- `src/renderer/drawHero.ts`: 신속(swiftness) 버프 시안 공전 파티클 이펙트 추가
- `src/renderer/drawNexusEntities.ts`: 적 기지 HP 비례 균열 이펙트 추가
- `src/utils/spriteMotion.ts`: boss_attack SPRITE_FACES_RIGHT 제거
- `docs/sprite-motion-prompts.md`: 레인저 기본공격 단일 화살 프롬프트로 변경

## [1.26.2] - 2026-03-17

### 기본공격 프레임 싱크 시스템
- **3번째 프레임 타격 싱크**: 기사/가디언/버서커 기본공격이 프레임 3(타격 모션)에서 데미지 발동되도록 가중 프레임 분배 적용
  - 프레임 0,1: 빠른 준비동작 (각 15%), 프레임 2: 타격 (40%), 프레임 3: 후속동작 (30%)
  - `attackSpeed` 기반 동적 타이밍 — 공격속도 업그레이드에 자동 대응
- **공격 감지 임계값 완화**: Q 쿨다운 점프 감지 0.3초 → 0.15초 (빠른 공격속도에서도 모션 감지)

### 저격수 궁극기(E) 개선
- **frameTimes 시스템 도입**: 프레임별 시간 경계 직접 지정 (균등 fps 대신)
  - 프레임 0,1: 조준 (0~2.2초), 프레임 2: 발사 (2.2~3.0초), 프레임 3: 빠른 후속동작 (3.0~3.3초)
- **캐스팅 방향(castingFlip) 수정**: 저격수 E 시전 시 타겟 방향으로 캐릭터 회전
  - 게임 상태/이펙트 상태 이중 브로드캐스트 타이밍 디싱크 해결
  - E 모션 재생 중 `castingFlip` 도착 시 실시간 방향 갱신 (`lockedFlip` 오버라이드)
- **저격수 스프라이트 리네임**: `sniper_w` → `sniper_w_backflip`, `sniper_e` → `sniper_e_snipe` (tier1/tier2)

### 가디언 차별화
- **공격 사거리 축소**: 80px → 60px (메이스 근접 무기 반영, 서버/클라이언트 동시 적용)
- **메이스 전용 공격 이펙트**: `attack_mace` 파티클 신규 — 파란/회색 사각형 파티클, 높은 중력(무거운 타격감)
- **BasicAttackEffect에 advancedClass 추가**: 서버에서 전직 정보 전달 → 클라이언트에서 직업별 이펙트 분기

### 전직 모션 스프라이트 확장
- **버서커 모션**: tier1/tier2 E(rage), W(blood_rush) 스프라이트 추가 + 파일 리네임
- **가디언 모션**: tier1/tier2 attack, walk, W(guardian_rush), E(shield) 스프라이트 추가
- **저격수 모션**: tier1/tier2 W(backflip), E(snipe) 스프라이트 추가
- **레인저 모션**: 스프라이트 추가
- **SPRITE_FACES_RIGHT 확장**: `berserker_walk`, `berserker_w` 추가

### 모션 타이밍 오버라이드 전면 확장
- **돌진형 W**: warrior/knight/berserker/guardian/paladin — fps 12, holdTime 0.4초
- **즉발형 W**: archer/mage/sniper/ranger/archmage/healer — holdTime 0.67초
- **즉발형 E**: 전 전직 (sniper 제외) — holdTime 0.8초
- **시전형 E**: sniper_e — frameTimes [1.0, 2.2, 3.0, 3.3], holdTime 3.5초

### 버서커 Tier2 시안 불꽃 이펙트
- **광전사 버프 색상 분기**: tier2는 시안(#00ccff) 불꽃, tier1은 기존 붉은 불꽃
- **적용 범위**: 베이스 글로우, 화염 그래디언트, 코어, 불꽃 입자, RAGE 텍스트, 영웅 글로우 전체

### 히어로 이미지 비율 보정
- **높이 기준 비율 유지**: `drawHeroImage`에서 원본 비율 보존 (모션 스프라이트와 동일 방식)

### 공격 방향 폴백 개선
- **basicAttackEffects 기반 attackFlip**: `attackTarget` 없을 때 최근 공격 이펙트 위치로 공격 방향 결정

### 보스 넉백 이펙트 수정
- **보스 위치 이펙트 생략**: knockback 이펙트를 보스 위치가 아닌 영웅 착지 위치에서 개별 생성

### 스프라이트 프롬프트 정리
- **LEFT 방향 강제**: 모든 스프라이트 생성 프롬프트에 왼쪽 방향 규칙 통일
- **가디언 무기 수정**: 플레일 → 메이스로 프롬프트 일괄 수정
- **프리픽스 간결화**: 프롬프트 파일명/설명 체계 정리 + 참조 이미지 안내 추가

### 수정 파일
- `src/utils/spriteMotion.ts`: frameTimes, 가중 프레임 분배, castingFlip, MOTION_CONFIG_OVERRIDE 전면 확장
- `src/renderer/drawHero.ts`: castingFlip 계산, basicAttackEffects attackFlip 폴백, 버서커 tier2 색상
- `src/hooks/useRPGGameLoop.ts`: 가디언 attack_mace 이펙트 분기, knockback 이펙트 수정
- `src/effects/particleConfigs.ts`: attack_mace 파티클 설정 추가
- `src/types/effect.ts`: attack_mace 타입 추가
- `src/types/rpg.ts`: BasicAttackEffect에 advancedClass 필드 추가
- `src/constants/rpgConfig.ts`: 가디언 range 80→60
- `src/utils/heroImages.ts`: 높이 기준 비율 유지
- `server/src/game/RPGServerGameEngine.ts`: basicAttackEffects에 advancedClass 추가
- `server/src/game/rpgServerConfig.ts`: 가디언 range 80→60
- `docs/sprite-motion-prompts.md`: LEFT 방향 강제, 가디언 메이스, 프리픽스 정리

## [1.26.1] - 2026-03-16

### 이동 로직 버그 수정
- **시전 종료 후 정지 신호 전송**: 스킬 시전 중 키를 놓으면 시전 후 서버에 정지 신호(null) 전송 (이전: 누락되어 영웅이 계속 이동)
- **정지 신호 레이트 리미트 제외**: `moveDirection: null`은 서버 레이트 리미터를 우회하여 정지 신호 유실 방지
- **서버 이동 타임아웃**: 500ms간 새 이동 입력 없으면 자동 정지 (정지 신호 네트워크 유실 대비)
- **검증 필드명 수정**: `input.direction` → `input.moveDirection` (잘못된 필드명으로 검증 미작동)

### 스프라이트 모션 시스템 강화
- **기사/마법사 모션 스프라이트 완성**: 기사 4종(walk, attack, w_shield_charge, e_iron_defense) + 마법사 4종(walk, attack, w_fireball, e_meteor) 추가
- **적 유닛 모션 적용**: 기본 적 유닛(melee, ranged, knight, mage)에 영웅 스프라이트 공유하여 이동/공격 모션 적용
- **적 상태 직렬화**: `SerializedEnemy`에 `state`, `attackCooldown` 필드 추가 → 서버에서 적 이동/공격 상태 전달
- **기본 4직업 프리로드**: 게임 시작 시 warrior/archer/knight/mage 스프라이트 일괄 프리로드 (적 유닛용)
- **시트 로딩 안정성**: 스프라이트 시트 미로드 시 애니메이션 상태 보존 (이전: 삭제 → 스킬 감지 영구 손실)

### 모션-스킬 싱크 시스템
- **즉발 스킬 공격 잠금 (`attackLockUntil`)**: 즉발 W/E 스킬 사용 시 모션 재생 동안 기본공격 차단 (이동은 허용)
  - W스킬: 0.67초 잠금 (6fps × 4프레임)
  - E스킬: 0.8초 잠금 (5fps × 4프레임)
  - 대상: 궁수W, 마법사W, 레인저W, 대마법사W, 힐러W + 전사E, 궁수E, 기사E, 마법사E 등 15개 즉발 스킬
- **W/E 모션 중 Q 감지 차단**: 스킬 모션 재생 중 기본공격 쿨다운 점프를 무시하여 모션 덮어씌움 방지
- **공격 방향 flip 고정**: 공격 모션 시작 시 `attackTarget` 방향으로 flip 고정 (이동 방향과 분리)
- **궁수 W 스킬 지연 실행**: 모션 Frame 3(발사, 0.33초) 타이밍에 pendingSkill로 데미지+이펙트 동시 발동
- **궁수 E 스킬 지연 실행**: 모션 Frame 3 종료(0.6초) 타이밍에 pendingSkill로 화살비 이펙트 발동

### 캐릭터별 모션 타이밍 조정
- **기사 W (방패 돌진)**: fps 6→12, holdTime 0.8→0.4초 (돌진 0.25초에 맞춰 빠르게 재생)
- **전사 E (광전사)**: holdTime 1.0→1.2초 (버프 발동 모션 충분히 표시)
- **마법사 E (운석 소환)**: 프롬프트 수정 — 실제 운석 없이 소환 의식만 표현

### 마법사 운석 이펙트 수정
- **폭발 이펙트 타입 수정**: pendingSkill 트리거 시 `mage_e`(경고) → `mage_meteor`(폭발) 변환
- **폭발 duration 증가**: 0.5초 → 1.5초 (충격파, 파편, 크레이터가 충분히 표시)

### 스프라이트 방향 설정 업데이트
- **궁수 E**: `SPRITE_NO_FLIP` → `SPRITE_FACES_RIGHT`로 이동 (오른쪽 방향 스프라이트 반전 필요)
- **기사 W/E**: `SPRITE_FACES_RIGHT`에 추가 (오른쪽 방향 스프라이트)

### 수정 파일
- `src/utils/spriteMotion.ts`: 캐릭터별 오버라이드, 시트 로딩 안정성, W/E 중 Q 차단, lockedFlip, attackFlip
- `src/renderer/drawHero.ts`: 적 모션 스프라이트 적용, attackTarget 기반 공격 방향 flip
- `src/renderer/rpgRenderer.ts`: drawRPGEnemy에 gameTime 전달
- `src/hooks/useRPGGameLoop.ts`: 시전 종료 후 정지 신호 전송
- `src/stores/useRPGStore.ts`: 적 state/attackCooldown 역직렬화, 기본 4직업 프리로드
- `server/src/game/rpgServerTypes.ts`: `attackLockUntil`, `_lastMoveInputTime` 필드 추가
- `server/src/game/rpgServerHeroSystem.ts`: canHeroAutoAttack에 attackLockUntil/이동 타임아웃 체크
- `server/src/game/rpgServerSkillSystem.ts`: 즉발 스킬 attackLockUntil, 궁수 W/E pendingSkill, 마법사 운석 이펙트 수정
- `server/src/game/RPGServerGameEngine.ts`: 이동 입력 시각 기록, processHeroMovement에 tickTimestamp 전달
- `server/src/game/rpgServerGameSystems.ts`: 적 state/attackCooldown 직렬화
- `server/src/websocket/MessageHandler.ts`: 정지 신호 레이트 리미트 제외, moveDirection 검증 필드명 수정
- `shared/types/hostBasedNetwork.ts`: SerializedEnemy에 state/attackCooldown 추가
- `docs/sprite-motion-prompts.md`: 마법사/대마법사 E스킬 프롬프트 — 운석 없이 소환 의식만

### 보스 모션 스프라이트
- **보스 1 (기마 해골 기사)**: walk(말 걷기 사이클) + attack(시안 검 강타) 2종
- **보스 2 (어둠의 마법사)**: walk(날개 호버링) + attack(암흑 구체 발사) 2종
- **보스 모션 적용**: `drawRPGEnemy`에서 보스도 모션 스프라이트 사용 (기존 보스 제외 조건 제거)
- **보스 프리로드**: 게임 시작 시 `boss`, `boss2` 스프라이트 일괄 프리로드
- **보스 방향 설정**: `boss_attack`을 `SPRITE_FACES_RIGHT`에 추가 (오른쪽 방향 반전)

### 스프라이트 렌더링 비율 보정
- **높이 기준 비율 유지**: `drawFrame`에서 프레임 원본 비율 보존 — 높이를 렌더 높이에 고정, 가로 비례 확장
- 스프라이트 프레임 비율이 렌더 영역과 달라도 캐릭터 크기 일정 유지 (공격 시 축소 현상 해결)

### 적 유닛 시선 방향 수정
- **타겟팅 시에만 영웅 방향**: `aggroOnHero && targetHeroId`일 때만 영웅을 바라봄
- **비타겟팅 시 넥서스 방향**: 이동 목표(넥서스) 방향을 바라보며 이동

### 로그아웃 시 방 상태 초기화
- **멀티플레이어 상태 리셋**: 로그아웃 시 `resetMultiplayerState()` 호출 (이전 방으로 복귀하는 버그 수정)

### 추가 수정 파일
- `src/utils/spriteMotion.ts`: boss_attack FACES_RIGHT, drawFrame 높이 기준 비율 유지
- `src/renderer/drawHero.ts`: 보스 모션 적용, 적 시선 방향 타겟팅 분기
- `src/stores/useRPGStore.ts`: 보스 프리로드 추가
- `src/stores/useAuthStore.ts`: 로그아웃 시 resetMultiplayerState 호출
- `docs/sprite-motion-prompts.md`: 보스 1/2 스프라이트 프롬프트 추가

## [1.26.0] - 2026-03-16

### 캐릭터 스프라이트 모션 시스템
- **스프라이트 애니메이션 엔진**: 2×2 그리드 스프라이트 시트 기반 프레임 애니메이션 시스템 신규 구현 (`spriteMotion.ts`)
- **모션 타입**: Walk(이동 루프), Attack(기본공격), W Skill(돌진 등), E Skill(궁극기) 4종
- **모션 감지**: 쿨다운 점프 감지 방식으로 RPG 서버 권위 모델에서 공격/스킬 사용 시점 자동 포착
- **스프라이트 방향 시스템**: 3단계 flip 모드 (`normal`/`invert`/`none`) — 왼쪽 방향 기본, 오른쪽 스프라이트 반전, 방향 무관 모션 고정
- **정적 이미지 폴백**: 스프라이트 미존재 캐릭터는 자동으로 기존 정적 이미지 사용
- **게임 시작 시 프리로드**: 싱글/멀티 모두 게임 시작 시 해당 영웅의 모션 스프라이트 미리 로드
- **게임 리셋 시 정리**: `resetAllAnimStates()` 호출로 애니메이션 상태 초기화

### 스킬 이펙트 색상 수정
- **서버 이펙트에 heroClass/advancedClass 추가**: 기존 Q스킬만 포함하던 `heroClass`를 W/E 스킬 이펙트 27개에 일괄 추가
- **직업별 이펙트 색상 정상 적용**: 궁수 스킬이 전사 색상(주황)으로 표시되던 문제 해결

### 스킬바 쿨다운 UI 수정
- **쿨다운 쉐도우 시작 타이밍 수정**: 스킬 사용 직후 100%부터 시작 (기존: 서버 지연으로 60~70%부터 시작)
- **쿨다운 오버레이 전환**: `transition-all` → `height 0.1s linear`으로 서버 업데이트 간격에 맞춘 부드러운 전환

### 렌더링 안정성
- **drawSkillEffect 음수 반지름 방어**: `elapsed < 0` 또는 `duration <= 0` 시 즉시 return (렌더 루프 중단 방지)

### 스프라이트 에셋 및 도구
- **전사 모션 스프라이트 4종**: walk, attack(왼쪽 통일), w_charge, e_rage
- **궁수 모션 스프라이트 4종**: walk, attack(왼쪽 통일), w_pierce, e_arrow_rain(방향 고정)
- **기사 모션 스프라이트 1종**: walk (2×2 시트)
- **프레임 반전 스크립트**: `scripts/flip-frames.cjs` — 2×2 시트에서 지정 프레임만 좌우 반전
- **프레임 합성 스크립트**: `scripts/combine-sprites.cjs` — 4개 개별 이미지를 2×2 시트로 합성
- **스프라이트 생성 가이드**: 왼쪽 방향 통일, 구분선 강조, 애니메이션 연속성 규칙 추가

### 수정 파일
- `src/utils/spriteMotion.ts` (신규): 스프라이트 모션 시스템 (3단계 flip, NO_FLIP 모드)
- `src/renderer/drawHero.ts`: 모션 스프라이트 → 정적 이미지 → 이모지 폴백 체인
- `src/hooks/useNetworkSync.ts`: 멀티플레이 게임 시작 시 모션 프리로드
- `src/stores/useRPGStore.ts`: 싱글플레이 프리로드 + 게임 리셋 시 애니메이션 정리
- `src/components/ui/RPGSkillBar.tsx`: 쿨다운 쉐도우 타이밍 + 전환 수정
- `server/src/game/rpgServerSkillSystem.ts`: 스킬 이펙트 27개에 heroClass/advancedClass 추가
- `scripts/flip-frames.cjs` (신규): 2×2 시트 프레임 반전 유틸
- `scripts/combine-sprites.cjs` (신규): 개별 프레임 → 2×2 시트 합성 유틸
- `docs/sprite-motion-prompts.md`: 왼쪽 방향 통일, 구분선/경계 규칙, 애니메이션 연속성 프롬프트

## [1.25.3] - 2026-03-15

### 네트워크 최적화: 델타 직렬화 + 이펙트 스트림 분리
- **델타 게임 상태 전송**: 풀 스냅샷(10프레임마다) + 델타 업데이트(변경된 필드만 전송) 시스템 도입, 네트워크 대역폭 절감
- **시각 이펙트 15Hz 분리 스트림**: 데미지 숫자, 기본공격 이펙트, 넥서스 레이저, 보스 스킬 이펙트를 코어 게임 상태(30Hz)와 분리하여 15Hz로 전송
- **입력 시퀀스 ACK 프로토콜**: 클라이언트 입력에 seq 번호 추가, 서버가 처리한 시퀀스를 ACK로 반환
- **숫자 양자화**: 좌표/HP 정수화(`Math.round`), 쿨다운 0.1초 단위, gameTime 0.1초 단위 양자화로 JSON 크기 절감
- **dirty flags 기반 변경 감지**: nexus HP, 적 기지 HP, 골드, 업그레이드, 통계 각각 독립 변경 추적

### 서버 보안 강화
- **글로벌 메시지 속도 제한**: 연결당 초당 120 메시지 제한, 3회 경고 초과 시 연결 종료
- **이동 속도 검증 (속도핵 방지)**: 서버에서 영웅 이동 속도 대비 비합리적 위치 변경 감지 및 차단 (버프/넉백 고려)
- **스킬 타겟 사거리 검증**: W/E 스킬의 타겟 좌표가 영웅 위치 기준 1000px 초과 시 무시 (저격수 E 예외)
- **스킬 좌표 유효성 검증**: `targetX`/`targetY` 좌표 유효성 체크 추가
- **입력 필드 검증 강화**: `timestamp`, `seq` 필드의 타입 및 범위 검증
- **DB/소셜/채팅 레이트 리미터 추가**: 로그인(5초), 친구 목록(200ms), DM(500ms), 로비 채팅(500ms), 관리자 인증(3초) 등 12종 추가

### 서버 인프라 개선
- **Ping/Pong 좀비 연결 감지**: 30초 간격 ping 전송, pong 미응답 시 연결 자동 종료
- **userId 인덱스 O(1) 조회**: `getPlayerByUserId` 전체 순회(O(n)) → `Map` 인덱스(O(1)) 전환
- **방 목록 브로드캐스트 디바운싱**: 100ms 디바운싱으로 방 생성/삭제 시 중복 브로드캐스트 방지
- **넉백 직후 속도 검증 완화**: 보스 넉백으로 큰 거리 이동 시 1초간 속도 검증 면제
- **연결 해제 시 정리 강화**: `lastProcessedSeq`, `inputQueues`, `connectionThrottles`, `aliveConnections` 정리

### 클라이언트 개선
- **델타 상태 적용**: undefined 필드는 이전 값 유지 (`?? prev.xxx` 패턴)
- **이펙트 스트림 수신 처리**: `COOP_GAME_EFFECTS` 메시지 핸들러 + `applyEffectState` 스토어 액션 추가
- **타입 안전성 향상**: `useNetworkSync`의 `any` 타입 → `HeroClass`, `AdvancedHeroClass`, `CharacterStatUpgrades`, `MapTheme` 등 구체적 타입으로 교체

### 수정 파일 (15개)
- `server/src/game/RPGServerGameEngine.ts`: 델타 직렬화, 이펙트 분리 브로드캐스트, dirty flags, 입력 ACK, 속도 검증
- `server/src/game/rpgServerGameSystems.ts`: `serializeDeltaGameState`, `serializeEffectState`, 숫자 양자화
- `server/src/game/RPGCoopGameRoom.ts`: 이펙트 브로드캐스트 콜백
- `server/src/game/rpgServerSkillSystem.ts`: 스킬 타겟 사거리 검증
- `server/src/game/rpgServerBossSystem.ts`: 넉백 시간 기록 (`_lastKnockbackTime`)
- `server/src/game/rpgServerTypes.ts`: `_lastKnockbackTime` 필드 추가
- `server/src/websocket/WebSocketServer.ts`: 글로벌 메시지 스로틀, Ping/Pong, 연결 정리
- `server/src/websocket/MessageHandler.ts`: 12종 레이트 리미터 적용, userId 인덱스 등록/해제, 입력 검증 강화
- `server/src/middleware/rateLimiter.ts`: 12종 레이트 리미터 추가
- `server/src/state/players.ts`: userId → Player 인덱스 (`indexPlayerByUserId`, `removePlayerUserIdIndex`)
- `server/src/room/CoopRoomManager.ts`: 방 목록 브로드캐스트 100ms 디바운싱
- `shared/types/hostBasedNetwork.ts`: `SerializedEffectState` 타입, 델타 optional 필드, `seq`/`frameId`/`inputAcks`
- `shared/types/rpgNetwork.ts`: `COOP_GAME_EFFECTS` 메시지 타입
- `src/hooks/useNetworkSync.ts`: 이펙트 핸들러, 입력 ACK, 타입 안전성 개선
- `src/stores/useRPGStore.ts`: `applyEffectState` 액션, 델타 상태 적용

## [1.25.2] - 2026-03-13

### 소리 설정 시스템 개편
- **로그인 전 소리 설정 가능**: localStorage 기반으로 비로그인/게스트도 소리 설정 가능
- **설정 영속성 개선**: 로그아웃 후에도 소리 설정 유지, 로그인 시 DB 값으로 동기화
- **재사용 가능한 `SoundSettingsButton` 컴포넌트**: 모든 화면에서 동일한 소리 설정 UI 제공
- **소리 설정 버튼 배치**: 로그인, 메인 메뉴, 게임 타입 선택, 클래스 선택 화면에 추가. FriendSidebar가 있는 화면은 사이드바 내부에 배치 (접기/펼치기 연동)
- **인게임 SoundControl 설정 저장**: 인게임에서 변경한 소리 설정도 DB/localStorage에 반영

### 메인 메뉴 / 프로필 화면 재구성
- **메인 메뉴 설정 간소화**: 기존 설정 모달(소리+비밀번호+탈퇴) → 소리 설정 버튼만 유지
- **프로필 화면 계정 관리**: 비밀번호 변경, 회원 탈퇴 기능을 메인 메뉴에서 접근한 프로필 화면으로 이동 (접이식 섹션)
- **게스트 프로필 버튼 비활성화**: 메인 메뉴에서 게스트 상태 시 프로필 버튼 비활성화
- **프로필 화면 수직 중앙 정렬**: `justify-center` + `transformOrigin: center center`
- **화면별 프로필 분기**: 메인 메뉴 → 기본 정보 + 계정 관리, 게임 모드 → 통계 + 클래스 진행

### RPG 인게임 비주얼 개선
- **타원형 그림자**: 영웅/적 캐릭터의 원형 베이스를 타원형 접지 그림자로 교체 (ctx.scale 활용)
- **캐릭터 레벨 배지 제거**: 인게임 캐릭터 위 레벨 표시 삭제 (좌측 상단 UI와 중복)
- **피격 효과 개선**: `source-atop` 기반 원형 오버레이 → 방사형 그라디언트 글로우로 변경
- **체력바 간격 축소**: 영웅/적 체력바와 캐릭터 간 세로 간격 줄임
- **격자선 숨김**: 모든 맵 테마의 격자 색상 알파를 0으로 변경 (코드 유지)
- **적 기지 파괴 표시 숨김**: 모든 기지 파괴 시(보스 출현) DESTROYED 텍스트 및 잔해 렌더링 숨김

### 저격수 궁극기(E 스킬) 리워크
- **보스 전용 타겟**: 저격수 궁극기는 보스만 타겟 가능 (일반 유닛 불가, 보스 없으면 비활성화)
- **경로 피격 시스템**: 시전자→보스 탄환 경로(폭 30px)에 다른 적이 있으면 가장 가까운 적이 대신 피격
- **비활성화 시각 피드백**: 스킬 아이콘 이미지에 grayscale + 어둡게 처리 + 반투명 오버레이

### 스킬바 아이콘 시스템 개선
- **다크나이트 토글 스킬 쿨다운 수정**: `cooldown=0` 토글 스킬에서 0 나누기 → `reuseCooldown(2초)` 기준으로 퍼센트 계산
- **토글 활성 상태 시각화**: ON 상태 시 아이콘에 보라빛 틴트 오버레이
- **비활성화 아이콘 처리**: 스킬 이미지가 배경 스타일을 가리던 문제 해결

### 직업 선택 시스템 개선
- **코옵 로비 직업 선택**: 이모지 아이콘 → 실제 캐릭터 유닛 이미지로 교체
- **전직 반영**: 유저의 전직/강화 정보에 따라 직업 카드에 전직 이미지, 이름, 설명, 스탯 자동 반영
- **실제 스탯 표시**: SP 업그레이드 보너스가 반영된 실제 게임 적용 수치 표시
- **전직 단계 뱃지**: 1차 전직(★), 2차 강화(★★) 노란색 별 표시
- **영어 직업명 제거**: 직업 선택 모달에서 영어 이름 제거

### 직업 도감 개선
- **캐릭터 이미지 적용**: 직업 상세 헤더의 이모지 → 실제 캐릭터 유닛 이미지로 교체
- **영어 직업명 제거**: 전직 사이드바 목록, 전직 경로에서 영어 이름 제거
- **전직 목록 UI 개선**: 계열별 구분선 + 여백 추가, 글씨 크기 확대, 가독성 향상
- **전직 버튼 카드 스타일**: 기본 직업 탭과 동일한 둥근 박스(border-2 + rounded-lg) 디자인 적용, 선택 시 계열 테마 색상 반영
- **전직 경로 표시 제한**: 기본 직업 탭에서 전직 경로 섹션 숨김 (전직 탭에서만 표시)

### DM 시스템 버그 수정
- **내 메시지 읽지 않음 배지 버그**: 내가 보낸 DM이 unread 카운트에 포함되던 문제 수정 (`isSentByMe` 플래그)
- **친구 탭 메시지 알림**: 온라인/요청 탭에서도 읽지 않은 DM이 있으면 친구 탭에 neon-cyan 글로우 + ping 도트 표시

### BGM 수정
- **RTS 튜토리얼 후 BGM 미재생**: React useEffect cleanup 순서 문제 → 50ms 딜레이로 해결

### 수정 파일 (20개)
- `src/components/ui/SoundSettingsButton.tsx` (신규): 재사용 가능한 소리 설정 버튼+모달
- `src/components/screens/MainMenu.tsx`: 설정 모달 제거, 소리 버튼, 게스트 프로필 비활성화, BGM 딜레이
- `src/components/screens/ProfileScreen.tsx`: 계정 관리 섹션, 수직 중앙 정렬, 화면별 분기
- `src/components/screens/LoginScreen.tsx`: 소리 설정 버튼 추가
- `src/components/screens/GameTypeSelectScreen.tsx`: 소리 설정 버튼 추가
- `src/components/screens/RPGClassSelectScreen.tsx`: 소리 설정 버튼 추가
- `src/components/screens/RPGCoopLobbyScreen.tsx`: 직업 선택 모달 전직 반영 + 실제 스탯 표시 + 영어명 제거
- `src/components/ui/FriendSidebar.tsx`: 소리 설정 버튼 배치, DM 알림 글로우
- `src/components/ui/SoundControl.tsx`: 인게임 소리 변경 시 설정 저장
- `src/components/ui/RPGSkillBar.tsx`: 저격수 보스 전용 타겟, 다크나이트 쿨다운, 비활성화 시각화
- `src/components/ui/ClassEncyclopediaModal.tsx`: 직업 도감 캐릭터 이미지, 영어명 제거, 사이드바 UI 개선
- `src/components/ui/ClassAdvancementPath.tsx`: 전직 경로 영어명 제거
- `src/stores/useAuthStore.ts`: 소리 설정 로직 개편 (localStorage + DB 이중 저장)
- `src/stores/useFriendStore.ts`: DM unread 버그 수정 (`isSentByMe`)
- `src/hooks/useFriendMessages.ts`: DM_SENT 시 `isSentByMe` 전달
- `src/renderer/drawHero.ts`: 타원형 그림자, 레벨 배지 제거, 피격 효과, 체력바 간격
- `src/renderer/drawGrid.ts`: 기본 격자 알파 0
- `src/constants/mapThemeConfig.ts`: 4개 테마 격자 알파 0
- `src/renderer/drawNexusEntities.ts`: 보스 출현 시 DESTROYED 숨김
- `server/src/game/rpgServerSkillSystem.ts`: 저격 보스 전용 타겟 + 경로 피격 시스템

## [1.25.1] - 2026-03-13

### 크로스 플랫폼 이모지 통일 (Twemoji)
- **전체 컴포넌트 이모지 → `<Emoji>` 컴포넌트 교체**: 36개 파일에서 직접 사용하던 유니코드 이모지를 Twemoji SVG 기반 `<Emoji>` 컴포넌트로 일괄 교체
- **크로스 플랫폼 일관성**: Windows, Mac, Linux, iOS, Android 등 OS별로 다르게 보이던 이모지가 모든 환경에서 동일한 Twitter(Twemoji) 스타일로 렌더링
- **적용 범위**: 화면(로그인, 메인 메뉴, 게임 선택, 모드 선택, 클래스 선택, 코옵 로비, 게임 오버, 프로필, 튜토리얼), UI 컴포넌트(영웅 패널, 스킬바, 웨이브 정보, 타이머, 레벨업, 전직 알림, 직업 도감, 캐릭터 업그레이드, 랭킹, 피드백, 친구 패널/사이드바, 초대 알림, 서버 상태바, 사운드 컨트롤, 일시정지 버튼, 프로필 버튼, 대량 스폰 알림, 점검 알림, 화면 회전 안내, 에러 바운더리), 터치 UI(스킬 버튼)

### 수정 파일 (36개)
- `src/components/screens/`: LoginScreen, MainMenu, GameTypeSelectScreen, ModeSelectScreen, RPGClassSelectScreen, RPGCoopLobbyScreen, GameOverScreen, ProfileScreen, RPGTutorialScreen
- `src/components/ui/`: RPGHeroPanel, RPGWaveInfo, RPGTutorialOverlay, RPGGameTimer, ClassCard, ClassSkillDisplay, ClassAdvancementPath, ClassEncyclopediaModal, CharacterUpgradeModal, RankingModal, FeedbackModal, LevelUpNotification, SecondEnhancementNotification, FriendPanel, FriendSidebar, FriendRequestNotification, GameInviteNotification, ServerStatusBar, ProfileButton, PauseButton, SoundControl, MassSpawnAlert, MaintenanceToast, OrientationPrompt, TutorialOverlay
- `src/components/touch/`: TouchSkillButtons
- `src/components/`: ErrorBoundary

## [1.25.0] - 2026-03-12

### MP3 BGM 시스템 추가
- **Web Audio API 기반 심리스 루프**: MP3 디코딩 후 `AudioBufferSourceNode`로 재생, 끊김 없는 루프
- **자동 무음 트리밍**: MP3 인코더 패딩 자동 제거 (`trimSilence`)
- **BGM 캐싱**: `AudioBuffer` 캐시로 재로드 없이 즉시 전환
- **HTMLAudioElement 폴백**: `decodeAudioData` 실패 시 자동 대체
- **개별 기본 볼륨 (`baseVolume`)**: MP3별 자체 볼륨 설정, 마스터 볼륨과 곱연산
- **BGM 타입 추가**: `rpg_main` (메인/로비), `rpg_battle` (인게임) MP3 매핑
- **재생 안정성**: `bgmPlaying` 플래그로 async 로드 중 중복 호출 시에도 정확한 상태 추적

### BGM 적용 화면
- **로그인 화면**: 첫 사용자 인터랙션(클릭/키입력/터치) 시 메인 BGM 자동 시작
- **메인 메뉴**: 진입 시 메인 BGM 재생
- **RPG 클래스 선택 / 코옵 로비**: 메인 BGM 유지 (동일 BGM이면 재시작 안 함)
- **인게임**: 기존 `rpg_battle` 호출이 자동으로 MP3 인게임 BGM 재생

### 배경 이미지 적용
- **메인 메뉴 / 로그인 / 게임 선택 화면**: `background.png` 배경 이미지 + 어두운 그라데이션 오버레이 (45~65% 불투명도)
- 기존 `bg-menu-gradient` CSS 배경 → 이미지 기반으로 교체

### 로그인 화면 UX 개선
- **안내 문구 개선**: "로그인하여 진행 상황을 저장하세요" → "계정을 만들어 진행 상황을 저장하거나, 게스트로 바로 시작하세요"
- **탭 버튼 설명 추가**: 로그인("기존 계정"), 회원가입("새 계정 생성"), 바로 시작("가입 없이 체험")
- **게스트 탭 리브랜딩**: "게스트" → "바로 시작" (🎮 아이콘, 초록색 강조)
- **게스트 안내 톤 변경**: 경고(노란색) → 긍정(초록색) "바로 체험할 수 있습니다!" + 제한사항은 작은 글씨로

### UI 텍스트 정리
- **영어 텍스트 한글화**: "Press a button to start" → "버튼을 눌러 시작하세요"
- **방 생성 모달 영어 제거**: 난이도 영문명(Easy, Normal 등), 맵 테마 영문명(Forest 등) 삭제

### 수정 파일
- `src/services/SoundManager.ts`: MP3 BGM 시스템, 심리스 루프, 볼륨 제어
- `src/components/screens/LoginScreen.tsx`: BGM 시작, 배경 이미지, UX 개선
- `src/components/screens/MainMenu.tsx`: BGM, 배경 이미지, 텍스트 한글화
- `src/components/screens/GameTypeSelectScreen.tsx`: 배경 이미지
- `src/components/screens/RPGClassSelectScreen.tsx`: 메인 BGM 재생
- `src/components/screens/RPGCoopLobbyScreen.tsx`: 메인 BGM 재생, 모달 영어 제거

## [1.24.8] - 2026-03-11

### 관리자 페이지 보안 강화

#### 인증 미들웨어 라우터 레벨 적용
- **`adminRouter.ts`에 `requireAdmin` 미들웨어 일괄 적용**: 기존 per-route 방식 → 라우터 레벨로 변경
- `/auth` (login, verify)만 공개, 나머지 5개 라우터(players, bans, stats, feedback, maintenance)는 라우터 마운트 시점에 인증 필수
- 각 하위 라우터에서 중복 `requireAdmin` 제거, `requireSuperAdmin`만 유지
- 새 route 추가 시 인증 누락 방지 (안전한 기본값)

#### 관리자 경로 비공개화
- **`VITE_ADMIN_PATH` 환경변수**: 관리자 페이지 URL 경로를 환경변수로 설정 (기본값: `admin`)
- 프로덕션에서 추측 불가능한 경로로 변경하면 `/admin` 접속 시 관리자 페이지 노출 안 됨
- 모든 하드코딩된 `/admin/` 경로를 `ADMIN_BASE` 상수로 교체 (14개 파일)

#### 수정 파일
- `server/src/api/admin/adminRouter.ts`: requireAdmin 라우터 레벨 적용
- `server/src/api/admin/adminPlayersRouter.ts`: 중복 requireAdmin 제거
- `server/src/api/admin/adminBanRouter.ts`: 중복 requireAdmin 제거
- `server/src/api/admin/adminStatsRouter.ts`: 중복 requireAdmin 제거
- `server/src/api/admin/adminFeedbackRouter.ts`: 중복 requireAdmin 제거
- `server/src/api/admin/adminMaintenanceRouter.ts`: 중복 requireAdmin 제거
- `src/main.tsx`: 동적 admin 경로 적용
- `src/admin/components/layout/AdminLayout.tsx`: 동적 경로
- `src/admin/components/layout/Header.tsx`: 동적 경로
- `src/admin/components/layout/Sidebar.tsx`: 동적 경로
- `src/admin/pages/AdminLoginPage.tsx`: 동적 경로
- `src/admin/pages/PlayerDetailPage.tsx`: 동적 경로
- `src/admin/pages/PlayersPage.tsx`: 동적 경로
- `.env.example`: VITE_ADMIN_PATH 예시 추가

#### 새 파일
- `src/admin/config.ts`: ADMIN_BASE 상수 (환경변수에서 경로 읽기)

## [1.24.7] - 2026-03-10

### 에셋 폴더 구조 정리
- **`public/img/units/RPG/` 하위 폴더 분리**: 기존 플랫 구조 → `heroes/`, `map/`, `skill_icon/`으로 분류
- **`heroes/`**: 전직 캐릭터 이미지 17개 (기존 위치에서 이동)
- **`map/`**: 숲 맵 장식 에셋 5개 (신규)
- **`skill_icon/`**: 스킬 아이콘 이미지 24개 (신규)
- **경로 참조 업데이트**: `heroImages.ts`, `unitImages.ts`, `drawMapDecorations.ts` 경로 수정

### 숲 맵 이미지 에셋 적용
- **맵 장식 이미지 로딩 시스템**: `loadForestImages()`로 숲 테마 진입 시 비동기 로드 (1회), 실패 시 기존 캔버스 프리미티브 폴백
- **풀 (`gress.png`)**: 150개 풀 장식에 이미지 적용 (variant별 투명도 변화)
- **작은 돌 (`stone.png`)**: 40개 바위 장식에 이미지 적용
- **큰 바위 (`rock.png`)**: 경계 바위에 이미지 적용
- **나무 (`tree.png`)**: 경계 나무에 이미지 적용
- **웅덩이 (`pool.png`)**: 12개 웅덩이에 이미지 적용 + 반짝임 하이라이트 애니메이션 오버레이
- 다른 테마(ice/volcano/shadow)는 기존 캔버스 렌더링 유지

### 스킬 아이콘 이미지 시스템
- **`src/constants/skillIconConfig.ts`** (신규): 스킬 타입 → 아이콘 이미지 경로 매핑 (공유 모듈)
- **기본 직업 8개 스킬 아이콘**: 전사(돌진/광전사), 궁수(관통 화살/화살 비), 기사(방패 돌진/철벽 방어), 마법사(화염구/운석 낙하)
- **전직 16개 스킬 아이콘**: 버서커, 가디언, 저격수, 레인저, 팔라딘, 다크나이트, 대마법사, 힐러 W/E 스킬
- **스킬바 (`RPGSkillBar.tsx`)**: 이미지가 있으면 버튼 전체에 아이콘 이미지 표시, 없으면 이모지 폴백
- **쿨다운 표현 개선**: 위→아래로 어두운 영역이 줄어드는 방식 (이미지 위에 `bg-black/70` 오버레이)
- **키 표시 위치 변경**: 버튼 내부 → 버튼 아래 별도 텍스트로 이동

### 직업 도감 스킬 아이콘 표시
- **`ClassSkillDisplay.tsx`**: 스킬 카드에 48×48 아이콘 이미지 표시
- 아이콘 + 스킬명 + 키 뱃지를 가로 배치로 리디자인

### 수정 파일
- `src/renderer/drawMapDecorations.ts`: 숲 테마 이미지 로딩 + 5개 장식 함수에 이미지 분기 추가
- `src/components/ui/RPGSkillBar.tsx`: 스킬 아이콘 이미지 렌더링 + 쿨다운/키 표시 개선
- `src/components/ui/ClassSkillDisplay.tsx`: 도감 스킬 카드에 아이콘 이미지 추가
- `src/utils/heroImages.ts`: 캐릭터 이미지 경로 `heroes/` 하위로 변경
- `src/utils/unitImages.ts`: boss2 이미지 경로 `heroes/` 하위로 변경

### 새 파일
- `src/constants/skillIconConfig.ts`: 스킬 아이콘 이미지 경로 매핑
- `public/img/units/RPG/map/`: gress.png, stone.png, rock.png, tree.png, pool.png
- `public/img/units/RPG/skill_icon/`: 24개 스킬 아이콘 이미지

## [1.24.6] - 2026-03-09

### 맵 테마 시스템 (RPG 모드)
- **4종 맵 테마 추가**: 숲(Forest), 얼음(Ice), 화산(Volcano), 그림자(Shadow)
- **테마별 비주얼**: 배경 그라데이션, 격자 색상, 영역 색조, 미니맵 색상, 장식물 팔레트, 경계 요소, 환경 파티클이 테마에 따라 변경
- **`MapThemeConfig` 설정 기반 구조**: 모든 시각 요소가 config 객체로 관리되어 새 테마 추가 시 config만 작성하면 됨

### 맵 장식 및 경계 개선
- **자연 장식 시스템**: 풀(150개), 바위(40개), 웅덩이(12개), 횃불(16개) 등 시드 랜덤 배치
- **자연 경계**: 맵 가장자리에 나무/바위 배치로 맵 경계 시각화
- **그라데이션 경계 어둠**: 맵 외부를 250px 내측 페이드 → 80px 외측 페이드 → 완전 검정으로 자연스럽게 처리
- **영역 색조**: 넥서스/적 기지 주변 테마별 색조 표시
- **환경 파티클**: 떠다니는 파티클 애니메이션 (테마별 색상)
- **테마 변경 시 캐시 자동 재생성**: `_cachedTheme` 추적으로 테마 전환 시 장식 데이터 재생성

### 맵 테마 네트워크 동기화 (멀티플레이)
- **방 생성 시 테마 선택**: 방 생성 모달에 맵 테마 선택 UI 추가 (이모지 아이콘 + 테마 색상)
- **로비 내 테마 변경**: 방장이 로비에서 맵 테마 실시간 변경 가능
- **서버-클라이언트 동기화**: `CREATE_COOP_ROOM`, `UPDATE_COOP_ROOM_SETTINGS`, `COOP_GAME_START`, `COOP_RETURN_TO_LOBBY` 등 모든 네트워크 메시지에 `mapTheme` 포함
- **방 목록 테마 표시**: `WaitingCoopRoomInfo`에 `mapTheme` 필드 추가

### 렌더러 리팩터링
- **`drawMapDecorations.ts`**: 장식/경계/어둠/영역/파티클 5개 함수 모두 `MapThemeConfig` 매개변수 수용
- **`rpgRenderer.ts`**: 배경 그라데이션을 테마 config에서 읽도록 변경
- **`drawGrid.ts`**: 격자 색상 매개변수 추가 (테마별 색상 지원)
- **`drawRPGMinimap.ts`**: 미니맵 배경/테두리/넥서스/기지 색상 테마 적용

### 새 파일
- `src/constants/mapThemeConfig.ts`: 4종 맵 테마 설정 (MapThemeConfig 인터페이스 + 테마별 config 객체)

### 수정 파일
- `src/types/rpg.ts`: `MapTheme` 타입 + `RPGGameState.mapTheme` 필드 추가
- `src/renderer/drawMapDecorations.ts`: 테마 기반 장식/경계/어둠/영역/파티클 렌더링
- `src/renderer/rpgRenderer.ts`: 테마 기반 배경 + 렌더 함수 호출 변경
- `src/renderer/drawGrid.ts`: 격자 색상 매개변수 지원
- `src/renderer/drawRPGMinimap.ts`: 테마 기반 미니맵 색상
- `src/stores/useRPGStore.ts`: `mapTheme` 상태 + 직렬화 포함
- `src/services/WebSocketClient.ts`: `createCoopRoom()` mapTheme 매개변수 추가
- `src/hooks/useNetworkSync.ts`: 게임 시작/로비 복귀 시 mapTheme 동기화 + `createMultiplayerRoom` mapTheme 전달
- `src/components/screens/RPGCoopLobbyScreen.tsx`: 맵 테마 선택 UI (생성 모달 + 로비 설정)
- `shared/types/rpgNetwork.ts`: 네트워크 메시지에 mapTheme 필드 추가
- `shared/types/hostBasedNetwork.ts`: `MultiplayerState.roomMapTheme` 필드 추가
- `server/src/websocket/MessageHandler.ts`: mapTheme 핸들링 추가
- `server/src/room/CoopRoomManager.ts`: 방 생성/설정 변경/게임 시작 시 mapTheme 전달
- `server/src/game/RPGCoopGameRoom.ts`: mapTheme 저장 + COOP_GAME_START/COOP_RETURN_TO_LOBBY에 포함

## [1.24.5] - 2026-02-16

### 멀티플레이 게임 종료 후 준비 시스템
- **비호스트 준비 버튼**: 게임 종료 후 비호스트 플레이어에게 "준비" 토글 버튼 표시
- **10초 준비 카운트다운**: 게임 종료 후 10초 내 준비하지 않으면 자동 퇴장 (서버 타이머 + 클라이언트 카운트다운)
- **호스트 준비 현황 표시**: 호스트에게 "팀원 준비 (N/M)" + 미준비 퇴장 카운트다운 표시
- **준비 취소 시 타이머 재시작**: 준비 취소하면 서버/클라이언트 모두 10초 카운트다운 재시작
- **방장 시작 타이머 (30초)**: 모든 플레이어 준비 완료 후 30초 내 미시작 시 방 자동 파기 + 방장에게 경고 알림
- **인원 수 스케일링 자동 조정**: 준비 완료된 플레이어 수 기준으로 난이도 재계산
- **경험치 자동 저장**: 게임 오버/클리어 시 모든 플레이어(호스트/비호스트) 경험치 자동 저장
- **자발적 퇴장 시 보상 없음**: "방 나가기"로 직접 나간 경우 경험치 미저장

### 방장 나가기 → 호스트 위임 (방 유지)
- **게임 중/종료 상태에서 방장 퇴장 시 방 파기 → 호스트 위임으로 변경**: 남은 플레이어에게 방장 권한 자동 이전
- **호스트 위임 시 타이머 재설정**: 방장 변경 시 `hostStartTimer` 정리 + 비호스트 준비 상태 재확인 → 필요 시 새 방장에게 경고 + 30초 타이머 재시작

### 초대 시스템 정리
- **온라인 탭 초대 버튼 제거**: FriendSidebar/FriendPanel 온라인 탭에서 초대 버튼 삭제 (친구 탭에서만 초대 가능)
- **같은 방 친구 초대 비활성화**: `friend.currentRoom !== currentRoomId` 조건으로 같은 방 친구에게는 초대 버튼 미표시 (기존 동작 유지)

### RTS 1v1 항복 기능
- **항복 버튼**: RTS 멀티플레이어 인게임에 🏳️ 항복 버튼 추가 (확인 모달 포함)
- **서버 항복 처리**: `GameRoom.surrender()` 메서드 + `SURRENDER` 메시지 타입 추가
- **게임 오버 화면**: 1v1 종료 후 "나가기" 클릭 시 모드 선택 화면으로 이동

### 게임 나가기 확인 모달
- **PauseScreen 확인 모달**: 게임 나가기/중단 버튼 클릭 시 확인 모달 표시 ("진행 상황이 저장되지 않습니다" 안내)
- **RPG 호스트 게임 중단**: "모든 플레이어의 게임이 종료됩니다" 경고 표시

### 서버 연결 끊김 알림
- **연결 끊김 배너**: 최대 재연결 시도 초과 시 화면 하단에 "서버와의 연결이 끊어졌습니다" + 새로고침 버튼 표시
- **재연결 시 자동 해제**: WebSocket 재연결 성공 시 배너 자동 숨김
- **`useUIStore.connectionLost`**: 연결 상태 관리 상태 추가

### UI/UX 개선
- **ESC 키 모달 닫기**: RPGCoopLobby 인라인 모달, MainMenu 설정 모달에 ESC 키 닫기 지원
- **모든 모달 ESC 닫기**: CharacterUpgrade, ClassEncyclopedia, DMChatWindow, Feedback, Help, Ranking 모달에 ESC 키 닫기 추가
- **닉네임 길이 제한 변경**: 2~20자 → 2~10자 (클라이언트 + 서버 검증)
- **비밀번호 안내 추가**: 회원가입 화면에 "비밀번호를 잊으면 복구할 수 없습니다" 안내 표시
- **피드백 버튼 레벨 제한**: 레벨 5 이상만 메인 메뉴/게임 결과에서 피드백 버튼 표시
- **피드백 EXP 보상**: 피드백 작성 시 +50 EXP 보상 (1회) + 로컬 프로필 즉시 반영
- **관리자 모니터링**: 서버 상태 카드에 "정상 운영" / "점검 중" 뱃지 표시

### 서버 보안 강화
- **인증 API Rate Limiting**: IP 기반 분당 20회 제한 (429 Too Many Requests)
- **닉네임 비속어 필터**: 서버 측 `filterProfanity` 검증 추가
- **닉네임 서버 검증 통합**: 길이/형식/비속어 검증을 재사용 가능한 `validateNickname()` 함수로 통합

### 새 파일
- `supabase/migrations/013_add_feedback_exp_claimed.sql`

### 수정 파일
- `server/src/game/RPGCoopGameRoom.ts`: 준비 시스템 (10초 kick + 30초 호스트 타이머 + 호스트 위임 시 타이머 재설정)
- `server/src/websocket/MessageHandler.ts`: 호스트 나가기 → 위임, 항복 핸들러, 점검 상태 포함
- `server/src/game/GameRoom.ts`: `surrender()` 메서드 추가
- `server/src/api/authRouter.ts`: Rate limiter + 닉네임 검증 + 비속어 필터
- `server/src/api/feedbackRouter.ts`: EXP 보상 + feedback_exp_claimed 중복 방지
- `shared/types/network.ts`: `SURRENDER` 메시지 타입, `maintenanceActive` 필드
- `src/hooks/useNetworkSync.ts`: `COOP_PLAYER_READY`/`COOP_ROOM_ERROR` 핸들러, 게임 종료 시 isReady 리셋
- `src/components/screens/RPGModeScreen.tsx`: 준비 시스템 UI (카운트다운, 준비/취소, 호스트 현황, 피드백)
- `src/components/screens/PauseScreen.tsx`: 나가기 확인 모달
- `src/components/screens/GameScreen.tsx`: 항복 버튼 + 확인 모달
- `src/components/screens/GameOverScreen.tsx`: 1v1 종료 후 모드 선택 이동
- `src/components/screens/RPGCoopLobbyScreen.tsx`: ESC 키 모달 닫기
- `src/components/screens/LoginScreen.tsx`: 닉네임 10자 제한, 비밀번호 안내
- `src/components/screens/MainMenu.tsx`: 피드백 레벨 제한, EXP 보상 반영, ESC 설정 닫기
- `src/components/ui/FriendSidebar.tsx`: 온라인 탭 초대 버튼 제거
- `src/components/ui/FriendPanel.tsx`: 온라인 탭 초대 버튼 제거
- `src/components/ui/CharacterUpgradeModal.tsx`: ESC 닫기
- `src/components/ui/ClassEncyclopediaModal.tsx`: ESC 닫기
- `src/components/ui/DMChatWindow.tsx`: ESC 닫기
- `src/components/ui/FeedbackModal.tsx`: ESC 닫기 + EXP 보상 콜백
- `src/components/ui/HelpModal.tsx`: ESC 닫기
- `src/components/ui/RankingModal.tsx`: ESC 닫기
- `src/services/WebSocketClient.ts`: `surrender()` 메서드, 연결 끊김 상태 관리
- `src/services/feedbackService.ts`: EXP 보상 반환 타입 변경
- `src/stores/useUIStore.ts`: `connectionLost` 상태 추가
- `src/admin/pages/MonitoringPage.tsx`: 점검 상태 뱃지
- `src/admin/types/admin.ts`: `maintenanceActive` 필드
- `src/App.tsx`: 서버 연결 끊김 배너

## [1.24.4] - 2026-02-15

### 유저 피드백/별점 시스템
- **별점(1~5) + 의견 수집**: 로그인한 비게스트 유저가 게임 피드백 작성 가능 (계정당 1회, 이후 수정 가능)
- **피드백 모달 UI**: 별 클릭 호버 효과, 의견 textarea(500자), 전체 통계(평균 별점/참여자 수) 표시
- **피드백 작성 후 버튼 숨김**: 이미 작성한 유저에게는 메인 메뉴 피드백 버튼 미표시
- **관리자 피드백 페이지**: 통계 카드(총 개수/평균/분포), 별점 필터, 정렬, 페이지네이션, 삭제 기능
- **DB**: `user_feedback` 테이블 (player_id UNIQUE, RLS 정책, updated_at 트리거)

### 서버 점검 시스템
- **관리자 점검 관리 페이지**: 카운트다운 시간 설정(0~120분, 5/10/15/30분 빠른 선택), 점검 메시지 커스텀, 실시간 남은 시간 표시
- **점검 알림 브로드캐스트**: 활성화 시 모든 접속자에게 즉시 알림, 이후 1분마다 남은 시간 알림 반복
- **인게임 알림**: 5초간 자동 사라지는 알림 + "게임 중 데이터는 저장되지 않습니다" 안내
- **로비/메뉴 알림**: X 버튼으로 닫을 수 있는 토스트 (게임에서 나왔을 때도 표시)
- **카운트다운 완료 시 자동 로그아웃**: 모든 접속 계정 강제 로그아웃 + BGM 정지 + 로그인 화면 이동
- **점검 중 로그인 차단**: 로그인 화면에서 점검 상태 확인, "점검 중입니다" 안내 표시
- **관리자 점검 해제**: 해제 후 정상 로그인 가능

### 친구 시스템 개선
- **게임 모드 + "게임중" 동시 표시**: 온라인/친구 목록에서 RPG/RTS 모드와 "게임중" 상태를 함께 표시
- **DM 메시지 유실 방지**: 인게임 중 받은 메시지를 서버에 보관, 로비 복귀 시 `GET_DM_HISTORY`로 재전송
- **FriendInfo에 gameMode 필드 추가**: 서버 상태 변경/친구 목록/친구 수락 시 gameMode 포함

### 기타
- **메인 메뉴 Copyright 추가**: `© 2026 제작자. All rights reserved.`

### 새 파일
- `supabase/migrations/012_create_user_feedback.sql`
- `server/src/api/feedbackRouter.ts`
- `server/src/api/admin/adminFeedbackRouter.ts`
- `server/src/api/admin/adminMaintenanceRouter.ts`
- `server/src/state/maintenance.ts`
- `src/services/feedbackService.ts`
- `src/components/ui/FeedbackModal.tsx`
- `src/components/ui/MaintenanceToast.tsx`
- `src/admin/pages/FeedbackPage.tsx`
- `src/admin/pages/MaintenancePage.tsx`

### 수정 파일
- `server/src/api/admin/adminRouter.ts`: 피드백/점검 라우터 등록
- `server/src/websocket/WebSocketServer.ts`: 피드백 라우터, 공개 점검 상태 API, 점검 정리
- `server/src/websocket/MessageHandler.ts`: gameMode 전달, GET_DM_HISTORY 핸들러
- `server/src/friend/FriendManager.ts`: gameMode 포함 상태 알림/친구 목록
- `server/src/friend/FriendRequestHandler.ts`: 친구 수락 시 gameMode 포함
- `server/src/friend/DirectMessageManager.ts`: getConversationsForUser 메서드
- `shared/types/friendNetwork.ts`: FriendInfo gameMode, DM_HISTORY 타입
- `src/stores/useUIStore.ts`: maintenanceNotice, maintenanceAlert 상태
- `src/stores/useFriendStore.ts`: gameMode 처리, mergeDMHistory 액션
- `src/hooks/useNetworkSync.ts`: MAINTENANCE_NOTICE 핸들러, useAuthStore import
- `src/hooks/useFriendMessages.ts`: gameMode 전달, DM_HISTORY 처리
- `src/components/screens/MainMenu.tsx`: 피드백 버튼/모달, copyright
- `src/components/screens/LoginScreen.tsx`: 점검 상태 확인 및 차단 UI
- `src/components/ui/FriendSidebar.tsx`: 모드+게임중 표시, DM 히스토리 요청
- `src/admin/AdminApp.tsx`: 피드백/점검 라우트
- `src/admin/components/layout/Sidebar.tsx`: 피드백/점검 네비게이션
- `src/admin/types/admin.ts`: FeedbackItem/Stats, MaintenanceStatus 타입
- `src/admin/services/adminApi.ts`: 피드백/점검 API 메서드
- `src/App.tsx`: MaintenanceToast/Alert 렌더링

---

## [1.24.3] - 2026-02-15

### 친구 간 개인 메시지(DM) 기능
- **실시간 1:1 채팅**: 온라인 친구와 개인 메시지 송수신
- **채팅 UI**: FriendSidebar 내 DM 채팅창, 메시지 입력/전송
- **서버 DirectMessageManager**: 메모리 기반 대화 저장, 스팸 방지(500ms), 비속어 필터, 최대 50개/대화
- **읽지 않은 메시지 배지**: 친구별 unread count 표시
- **오프라인 시 대화 정리**: 친구 오프라인 시 DM 대화 자동 정리

---

## [1.24.2] - 2026-02-14

### Boss2 암흑 유성(dark_meteor) 낙하 이펙트 추가
- **보라색 운석 낙하 시각 이펙트**: 경고 원만 표시되던 dark_meteor에 하늘에서 떨어지는 유성 이펙트 추가
  - 5개 보라색 운석이 250px 높이에서 시간차(0.5초 간격) 낙하
  - 낙하 70% → 폭발 30% 타이밍, `meteor_shower` 패턴 기반
  - 보라색/어둠 테마 색상 (글로우 `#9900ff`, 코어 `#7700dd`, 폭발 `#cc66ff`)
- **서버: 개별 위치 이펙트 push**: 보스 위치 1개 → `meteorPositions` 각 영웅 위치에 개별 이펙트
- **클라이언트: `dark_meteor_fall` SkillEffect 생성**: `boss_smash` 파티클 → SkillEffect 기반 렌더링
- **SkillType 확장**: `'dark_meteor_fall'` 타입 추가

### 멀티플레이 연결 해제 처리 개선
- **팀원 이탈 인게임 알림**: 연결 해제 시 `{이름}님의 연결이 끊어졌습니다.` 알림 표시
- **방장 위임 알림**: 새 방장에게 `방장 권한을 위임받았습니다.`, 나머지에게 `{이름}님이 새 방장이 되었습니다.` 표시
- **서버 영웅 제거**: 연결 해제된 플레이어의 영웅을 서버 게임 엔진에서 즉시 제거 (`removeHero`)
  - 기존: 클라이언트에서만 제거 → 서버 브로드캐스트로 캐릭터가 다시 나타나는 버그
  - 수정: 서버 `state.heroes`에서 삭제 → 다음 브로드캐스트부터 미포함

### 수정 파일
- `src/types/rpg.ts`: SkillType에 `dark_meteor_fall` 추가
- `server/src/game/rpgServerBossSystem.ts`: dark_meteor 실행 시 개별 위치 이펙트 push
- `src/hooks/useRPGGameLoop.ts`: 클라이언트/호스트 dark_meteor_fall SkillEffect 생성
- `src/renderer/drawHero.ts`: dark_meteor_fall 렌더링 케이스 추가
- `server/src/game/RPGServerGameEngine.ts`: `removeHero()` 메서드 추가
- `server/src/game/RPGCoopGameRoom.ts`: 연결 해제 시 게임 엔진 영웅 제거 + 이름 포함 메시지
- `src/hooks/useNetworkSync.ts`: 연결 해제/방장 변경 인게임 알림 추가

---

## [1.24.1] - 2026-02-14

### 난이도별 랭킹 시스템 확장
- **극한/지옥/종말 3개 난이도 독립 랭킹**: 기존 극한 전용에서 3개 난이도로 확장
  - 상단 난이도 탭: 극한(빨강), 지옥(주황), 종말(보라)
  - 하단 인원수 탭: 1/2/3/4인 (선택 난이도 색상 연동)
  - 각 난이도/인원수 조합별 상위 10위 표시
- **`difficulty_rankings` 통합 테이블**: `difficulty` 컬럼 추가, 복합 인덱스
  - 기존 `extreme_rankings` 데이터 자동 마이그레이션
  - 기존 `/extreme` API 하위호환 유지
- **서버 API 추가**: `GET /:difficulty/:playerCount`, `POST /` (difficulty 포함)
- **클라이언트**: `getDifficultyRankings()`, `saveDifficultyRanking()` 함수 추가
- **랭킹 저장 트리거 확장**: 극한/지옥/종말 승리 시 모두 자동 저장

### Technical Changes
- `supabase/migrations/011_create_difficulty_rankings.sql`: 통합 테이블 + 데이터 마이그레이션
- `server/src/api/rankingsRouter.ts`: `GET /:difficulty/:playerCount`, `POST /` 라우트 추가
- `src/services/rankingService.ts`: `RankingDifficulty`, `DifficultyRanking` 타입 + API 함수
- `src/components/ui/RankingModal.tsx`: 난이도 탭 UI, 동적 색상/제목
- `src/components/screens/RPGModeScreen.tsx`: `saveDifficultyRanking()` 호출로 교체

---

## [1.24.0] - 2026-02-14

### Boss2: 암흑 마법사 추가 (지옥/종말 난이도)
- **새로운 보스 Boss2 (암흑 마법사)**: 지옥/종말 난이도에서 기존 보스와 함께 등장하는 원거리 마법사 보스
  - 기지 2개 파괴 시 각 기지 위치에서 Boss1 + Boss2가 함께 스폰 (총 4마리)
  - HP: 2800/3200/4400/6000 (1/2/3/4인), 공격력: 120/130/155/190, 공격 사거리: 250px
  - 보라색(#9900ff) 글로우/테마로 Boss1(빨강)과 시각적 구분

### Boss2 고유 스킬 6개
- **암흑 구체 (Dark Orb)**: 6초 쿨, 대상 방향 원거리 AoE 폭발 (250% 데미지, 120px)
- **그림자 소환 (Shadow Summon)**: 18초 쿨, HP ≤70% 시 마법사 졸개 3마리 소환
- **공허의 영역 (Void Zone)**: 15초 쿨, 5초 지속 데미지 장판 (초당 50% 데미지, 180px)
- **암흑 유성 (Dark Meteor)**: 20초 쿨, HP ≤50% 시 각 영웅 위치에 유성 낙하 (300% 데미지)
- **영혼 흡수 (Soul Drain)**: 12초 쿨, HP ≤60% 시 AoE 드레인 + 적중 영웅당 자힐 5%
- **순간이동 (Teleport)**: 10초 쿨, HP ≤80% 시 가장 먼 영웅 근처로 텔레포트

### 지옥/종말 난이도 밸런스 하향
- Boss2 추가(보스 2→4마리)로 과도해진 체감 난이도 하향 조정
- **지옥**: 극한 대비 +10~15% 수준으로 조정 (적HP 6.0→4.5, 적ATK 4.0→3.3 등)
- **종말**: 기존 지옥 수준으로 조정 (적HP 9.0→6.0, 적ATK 5.2→4.0 등)
- 골드/경험치 보상도 비례 하향 (과도한 보상 방지)
- 기지 파괴 골드: 지옥 450→350, 종말 650→500

### 렌더링 및 UI
- Boss2 보라색 글로우, 배경, 체력바 텍스트, 공격 모션, 기절 이펙트
- 미니맵 보라색(#9900ff) 4px 점 표시
- 6개 스킬 경고 시각화 (보라색 테마)
- 공허의 영역 지속 장판 렌더링 (보라색 소용돌이)
- 게임 오버 모달 보스 수 지옥/종말 4마리로 정확히 표시
- `isBossType()` 유틸리티로 Boss1/Boss2 통합 처리

### Technical Changes
- `src/types/unit.ts`, `shared/types/game.ts`: `UnitType`에 `'boss2'` 추가
- `src/types/rpg.ts`: `BossSkillType`에 6개 추가, `BossVoidZone` 인터페이스, `RPGGameState`에 `bossActiveZones` 추가
- `src/utils/bossUtils.ts`: `isBossType()` 유틸리티 신규
- `src/constants/rpgConfig.ts`, `server/src/game/rpgServerConfig.ts`: Boss2 스킬/AI/능력치 설정 미러링
- `server/src/game/rpgServerBossSystem.ts`: 6개 신규 스킬 실행 로직, `updateVoidZones()` DoT 처리
- `server/src/game/rpgServerEnemySystem.ts`: `createBoss2()` 스폰 함수
- `server/src/game/RPGServerGameEngine.ts`: 지옥/종말 보스 페이즈에서 Boss2 추가 스폰
- `shared/types/hostBasedNetwork.ts`: `SerializedGameState`에 `bossActiveZones` 추가
- `src/renderer/drawHero.ts`: Boss2 렌더링 + `isBoss` → `isAnyBoss` 통합
- `src/renderer/rpgRenderer.ts`: 6개 스킬 경고 + `drawVoidZone()` 렌더링
- `src/hooks/useRPGGameLoop.ts`: Boss2 이펙트/사운드 핸들러 (멀티플레이어 동기화 포함)
- `src/stores/useRPGStore.ts`: `bossActiveZones` 상태 + 직렬화, 보스 수 계산 수정
- 서버/클라이언트 ~33곳 `type === 'boss'` → `isBossType()` 교체

---

## [1.23.11] - 2026-02-14

### 마법사 계열 SP 업그레이드: 스킬 쿨타임 감소
- **마법사 계열 공격속도 → 스킬 쿨타임 감소 교체**: 마법사/대마법사/힐러의 SP 업그레이드에서 "공격속도" 옵션을 "스킬 쿨타임 감소"로 변경
  - 레벨당 1% 감소, 최대 30레벨 = 30% 감소
  - W/E 스킬 쿨다운에 직접 적용 (Q스킬 자동공격은 영향 없음)
  - 전사/기사/궁수 계열은 기존 공격속도 업그레이드 유지
- **스킬 툴팁 감소된 쿨타임 표시**: 스킬 쿨타임 감소가 적용된 실제 쿨다운 시간 표시
- **서버 스킬 쿨다운 하드코딩 제거**: `rpgServerSkillSystem.ts`의 22+ 위치에서 하드코딩된 쿨다운 값을 `hero._skillW/E.cooldown` 참조로 변경

### 밸런스 조정
- **버서커 패시브 피해흡혈 배율 너프**: 1.5배 → 1.3배
- **버서커 궁극기(광란) 너프**: 공격력/공격속도 증가 100% → 80% (지속시간 10초 유지)

### Bug Fixes
- **SP 초기화 버그 수정**: `skillCooldown` 필드가 SP 계산에 누락되어 리셋 시 SP가 정상 반환되지 않던 문제 수정
- **다시하기 시 경험치 중복 저장 방지**: `expSavedRef` 리셋 로직 추가

### Technical Changes
- `src/types/auth.ts`: `CharacterStatUpgrades`에 `skillCooldown` 필드 추가, 마법사 업그레이드 스탯 목록 변경
- `src/types/rpg.ts`, `server/src/game/rpgServerTypes.ts`: `skillCooldownReduction` 필드 추가
- `server/src/game/rpgServerHeroSystem.ts`: 영웅 생성 시 스킬 쿨다운 감소 계산 및 적용
- `server/src/game/rpgServerSkillSystem.ts`: 모든 스킬 쿨다운 설정을 `hero._skillW/E.cooldown` 참조로 통일
- `server/src/game/rpgServerConfig.ts`: `STAT_UPGRADE_CONFIG`에 `skillCooldown` 추가, 버서커 흡혈 배율 변경
- `src/stores/useRPGStore.ts`: 클라이언트 영웅 생성/역직렬화 시 스킬 쿨다운 감소 적용
- `src/components/ui/CharacterUpgradeModal.tsx`: 마법사 계열 스킬 쿨감 UI 표시
- `src/constants/rpgConfig.ts`: 버서커 흡혈 배율 변경
- `server/src/api/profileRouter.ts`: DB 기본값에 `skillCooldown` 추가

---

## [1.22.11] - 2026-02-09 (WIP - 진행중)

### UI/UX
- **전체 UI 반응형 디자인 적용**: 다양한 해상도에서 요소들이 비율에 맞게 조절되도록 개선
  - CSS `clamp()` 함수로 최소/최대 크기 제한하면서 뷰포트 비율 기반 크기 조절
  - CSS `min()` 함수로 배경 효과 크기 제한
  - 뷰포트 기반 단위(vw, vh) 사용하여 화면 크기에 따른 동적 조절

### 적용된 스크린 컴포넌트
- `LoginScreen.tsx`: 타이틀, 입력 필드, 버튼, 배경 효과, 코너 장식
- `MainMenu.tsx`: 버튼, 배경 효과, 코너 장식
- `GameOverScreen.tsx`: 아이콘, 타이틀, 버튼, 배경 효과
- `LobbyScreen.tsx`: 컨테이너, 타이틀, 컨텐츠 박스
- `GameTypeSelectScreen.tsx`: 모드 카드, 타이틀, 설명 텍스트
- `ModeSelectScreen.tsx`: 모드 버튼, 타이틀, 코너 장식
- `DifficultySelectScreen.tsx`: 난이도 버튼, 정보 패널, 코너 장식
- `PauseScreen.tsx`: 배경 효과, 메인 컨텐츠
- `CountdownScreen.tsx`: 카운트다운 숫자, 안내 텍스트
- `ProfileScreen.tsx`: 상단 섹션, 코너 장식
- `RPGClassSelectScreen.tsx`: 타이틀, 카드 레이아웃, 코너 장식
- `RPGCoopLobbyScreen.tsx`: 타이틀, 컨테이너, 직업 선택 모달, 방 생성 모달, 비밀방 모달, 코너 장식
- `RPGTutorialScreen.tsx`: 코너 장식
- `RPGModeScreen.tsx`: 스페이서, 코너 장식
- `GameScreen.tsx`: 코너 장식

### 반응형 패턴
- 배경 효과: `style={{ width: 'min(24rem, 50vw)', height: 'min(24rem, 50vw)' }}`
- 글꼴 크기: `style={{ fontSize: 'clamp(min, vw-based, max)' }}`
- 여백/간격: `style={{ margin/padding: 'clamp(min, vh-based, max)' }}`
- 코너 장식: `style={{ width: 'clamp(2rem, 4vw, 4rem)', height: 'clamp(2rem, 4vw, 4rem)' }}`
- 컨테이너: `style={{ width: 'min(95vw, 고정값)' }}`

### Bug Fixes
- `TouchSkillButtons.tsx`: 미사용 변수 경고 수정 (`slot` → `_slot`, `onUseSkill` → `_onUseSkill`)

---

## [1.22.9] - 2026-02-08

### Server-Client Sync
- **서버-클라이언트 스킬 로직 전면 동기화**: 8개 항목 불일치 수정 (클라이언트 기준)
  - 저격수 W (후방 도약): 단일 타겟 → 전방 60도 범위 적 전체 + 기지 데미지 추가
  - 저격수 E (저격): 즉시 발동 → 3초 시전(castingUntil + pendingSkill) + 마우스 위치 기반 타겟팅 + 보스 우선
  - 레인저 W (다중 화살): 산탄 각도 30° → 45°
  - 힐러 W (치유의 빛): 힐 범위 200px → 150px
  - 버서커 E (광란): lifesteal 제거, damageTaken 0.5 유지
  - 팔라딘 Q (기본공격 힐): 공격력 기반 → 아군 최대HP × 5% 회복
  - 스폰 설정: 가중치 형식 통일 (확률 → 카운트), 스폰 간격 감소율 0.3 → 0.2

### Client Fixes
- **버서커 광란 버프에 받는 피해 증가 추가**: `damageTaken: 0.5` (50% 추가 피해)
  - 클라이언트 `calculateDamageAfterReduction`에 damageTaken 버프 체크 추가
- **팔라딘 기본공격 힐 변경**: 공격력 비례 → 아군 최대HP × 5% 회복
- **저격수 E 타겟팅 변경**: 30도 각도 필터 → 마우스 위치 기반 + 보스 우선
- **데미지 숫자 중복 표시 수정**: `isMultiplayerClient` → `isMultiplayer`로 변경
  - 멀티플레이에서 호스트 포함 모든 클라이언트가 서버 상태에 의존하도록 통일

### UI/UX
- **스킬 호버 범위 표시 개선**
  - 버프 스킬 (버서커/가디언/레인저/팔라딘/저격수 E): 범위 표시 제거
  - 다크나이트/힐러 E: 마우스 위치 AoE → 캐릭터 중심 원형 범위
  - 대마법사 E (메테오 샤워): 마우스 위치 AoE 유지
  - 다크나이트 W (암흑 찌르기): 범위 미표시 → 전방 직선 150px 표시
- **AoE 스킬 범위 미리보기 위치 변경**: 마우스 위치 → 캐릭터 전방 100px
  - 스킬 버튼 호버 시 마우스는 UI 위에 있으므로, 실제 스킬 발동 위치 표시로 변경

### Technical Changes
- `server/src/game/rpgServerSkillSystem.ts`: 저격수 W/E, 레인저 W, 힐러 W, 버서커 E, 팔라딘 Q, 저격수 E pendingSkill 처리
- `server/src/game/rpgServerConfig.ts`: 스폰 가중치/감소율 동기화
- `src/game/rpg/skillSystem.ts`: 버서커 E damageTaken, 팔라딘 Q 힐, 저격수 E 타겟팅
- `src/game/rpg/enemyAI.ts`: damageTaken 버프 데미지 증가 적용
- `src/components/ui/RPGDamageNumbers.tsx`: 멀티플레이 데미지 숫자 중복 수정
- `src/components/ui/RPGSkillBar.tsx`: 스킬 호버 범위 표시 로직 개선
- `src/renderer/drawHero.ts`: AoE 범위 미리보기 캐릭터 전방 100px로 변경

## [1.22.6] - 2026-02-08

### Tutorial
- **RTS 튜토리얼 흐름 전면 개편**: 지원 유닛 우선 → 공격 유닛 후반 순서로 재배치 (25스텝 → 21스텝)
  - Phase 1 (1~3): 기본 설명 (welcome, camera, resources_intro)
  - Phase 2 (4~12): 채집꾼 → 약초 30개 대기 → 약초 판매 → 나무꾼 → 광부 → 금광부 → 힐러
  - Phase 3 (13~15): 기지 강화 → 벽 건설 → 적 출격 예고 (신규)
  - Phase 4 (16~20): 검병 → 궁수 → 기사 → 마법사 → 전투 전략 팁 (신규)
  - Phase 5 (21): 최종 전투
- **약초 판매 = 초반 핵심 골드 전략 강조**: 약초 30개 수집 후 판매하는 흐름
- **채집꾼 크리스탈 확률 획득 설명 추가**
- **공격 유닛 고용 시점부터 적 소환 시작**: 그 전에는 적이 나오지 않음
- **튜토리얼 초기 자원 하향**: gold 500→300, wood 50→20, stone 30→10, herb 30→0

### Experience System
- **RTS AI 모드 난이도별 클리어 경험치 도입**
  - 쉬움: 100 EXP, 중간: 250 EXP, 어려움: 700 EXP, 극악: 1600 EXP
  - 보스테스트: 경험치 없음
  - VIP: 2배 보너스 유지
- **RTS 멀티플레이어 경험치 제거**: 악용 방지를 위해 멀티플레이어 모드 경험치 0
- **패배 시 경험치 제거**: 클리어(승리) 시에만 경험치 획득

## [1.22.5] - 2026-02-07

### Visual
- **적 기지 비주얼 전면 개선**: 단순 빨간 사각형 → 미니 마왕성 스타일 성채
  - 어두운 석재 톤 성벽 (둥근 상단 모서리 + 각진 톱니 흉벽)
  - 좌우 사각 탑 (적갈색 삼각 지붕 + 빛나는 창문)
  - 아치형 정문 (내부에서 빛이 새어나오는 효과)
  - 깃발 (바람에 펄럭이는 애니메이션)
  - 중앙 맥동 코어 (HP에 따라 색상 변화)
  - 은은한 외곽 글로우
- **적 기지 라벨 제거**: LEFT BASE, RIGHT BASE 등 텍스트 라벨 삭제

## [1.22.4] - 2026-02-07

### Dark Knight Balance
- **W스킬 이름 변경**: 강타 → 암흑 찌르기(Dark Pierce)
- **W스킬(암흑 찌르기) 공격 범위 변경**: 부채꼴(±45도) → 전방 직선 150px×80px
  - 서버: 벡터 투영(forward/lateral) 기반 직선 범위 판정
  - 클라이언트: 찌르기 차징 모션 + 에너지 창 관통 이펙트로 전면 개선
- **W스킬 HP 소모 증가**: 11% → 20%
- **E스킬(어둠의 칼날) 밸런스 조정**
  - 초당 HP 소모: 3% → 5%
  - 초당 데미지 배율: 100% → 120%

### Enemy AI
- **적 타겟 우선순위 개선**: 어그로 타겟보다 감지 범위 내 높은 우선순위(기사>전사>기타) 영웅 우선 공격
  - 원거리 캐릭터가 어그로를 끌어도 근거리 기사/전사가 감지 범위 내에 있으면 우선 타겟팅

### Bug Fixes
- **다크나이트 W스킬 뒤로 밀림 수정**: 로컬 예측 코드의 변수 참조 오류(`hero` → `state.hero`) 수정
  - `castingUntil` 로컬 설정 실패로 클라이언트가 서버 응답까지 이동 지속 → 서버 위치와 차이 발생
- **다크나이트 W스킬 HP 소모 시 피격 이펙트 방지**: 자체 HP 소모를 적 피격으로 인식하던 버그 수정
- **시전 중 이동 입력 차단**: `updateMoveDirection()`에 시전 상태 체크 추가
- **시전 종료 후 이동 키 홀드 시 이동 재개**: OS 키 반복 중단 문제 해결
  - 게임 루프에서 시전 종료 감지 시 `calculateMoveDirection()`으로 눌려있는 키 확인 후 이동 재개

### Boss Skills
- **보스 스킬 넥서스 데미지 추가**: 강타(smash), 돌진(charge) 스킬이 넥서스에도 데미지 적용
- **충격파(shockwave) 즉사 데미지**: 범위 내 캐릭터 즉사 (넥서스에는 데미지 없음)
  - 경고 표시: 빨간색 범위 + "⚠ 즉사 충격파 ⚠" 텍스트 + "범위 밖으로 이동하세요!" 안내
- **밀치기(knockback) 데미지 제거**: 넉백만 적용 (데미지 0)

### UI
- **레벨업 알림 전직 클래스 표시**: 전직 후 레벨업 시 전직 직업 이름/이모지 표시 (예: 기사 → 다크나이트)
  - `LevelUpResult`에 `advancedClassName` 필드 추가
  - `LevelUpNotification`에서 `ADVANCED_CLASS_CONFIGS` 우선 참조

## [1.22.3] - 2026-02-07

### Dark Knight Skill Rework
- **W스킬 리워크: 암흑 베기(Shadow Slash) → 강타(Heavy Strike)**
  - 돌진 → 시전형 범위 공격으로 변경
  - 1초 시전 (이동 불가), HP 8% 소모, 공격력 ×3.5 데미지, 120px 범위, 4초 쿨다운
  - pendingSkill 기반 지연 데미지 (캐스터 위치 추적)
- **E스킬 리워크: 어둠의 칼날 고정 5초 → 토글 온/오프**
  - 초당 HP 3% 소모, 초당 공격력 ×1.0 데미지 (150px 범위)
  - HP ≤10% 또는 기절(stun) 시 자동 해제
  - 재사용 딜레이 2초 (쿨다운 대신)
  - 사망 시 자동 비활성화
- **패시브 30% 피해흡혈 유지** (E스킬 틱 데미지에도 적용)

### UI Changes
- 스킬바 토글 활성 표시: 보라색 글로우 + "ON" 뱃지 (animate-pulse)
- 토글 활성 중 E스킬 버튼 클릭 가능 (비활성화 해제)

### Visual Effects
- `heavy_strike`: 보라색 차징 파티클 수렴 이펙트 (heroId 추적)
- `heavy_strike_impact`: 충격파 확산 + 바닥 균열 이펙트
- `dark_blade`: 토글 기반 무한 지속 (duration 9999), elapsed 기반 회전 타이밍 수정

### Technical Changes
- `shared/types/hostBasedNetwork.ts`: SerializedHero에 `darkBladeActive` 추가
- `server/src/game/rpgServerTypes.ts`: ServerHero에 `darkBladeActive`, `darkBladeLastToggleOff`, `darkBladeTickTimer` 추가
- `server/src/game/rpgServerHeroSystem.ts`: darkKnight 스킬 설정 변경 (`heavy_strike`/4s, `dark_blade`/0)
- `server/src/game/rpgServerSkillSystem.ts`: W 강타 구현, E 토글 구현, updatePendingSkills에 heavy_strike 추가
- `server/src/game/RPGServerGameEngine.ts`: updateHeroes에 다크블레이드 틱 처리 (HP 소모, 데미지, 흡혈, 자동 해제, 사망)
- `server/src/game/rpgServerGameSystems.ts`: 직렬화에 `darkBladeActive` 추가
- `src/constants/rpgConfig.ts`: W/E 설정 변경, `AdvancedSkillConfig` 타입 확장
- `src/game/rpg/skillSystem.ts`: 클라이언트 W/E 스킬 로직
- `src/hooks/useRPGGameLoop.ts`: heavy_strike 이펙트 처리
- `src/stores/useRPGStore.ts`: `darkBladeActive` 역직렬화
- `src/types/rpg.ts`: `heavy_strike`, `heavy_strike_impact` SkillType 추가, HeroUnit에 `darkBladeActive`
- `src/renderer/drawHero.ts`: heavy_strike/heavy_strike_impact 렌더링, dark_blade 타이밍 버그 수정
- `src/renderer/rpgRenderer.ts`: heavy_strike heroId 추적
- `src/components/ui/RPGSkillBar.tsx`: 토글 UI + heavy_strike 아이콘

### Documentation
- `docs/job-advancement.md`: 다크나이트 스킬 정보 전면 갱신 (암흑 베기 → 강타, 토글 E스킬)
- `docs/rpg-mode.md`: 다크나이트 컨셉 및 스킬 설명 업데이트
- `docs/server-authority-model.md`: 스킬 테이블 업데이트

## [1.22.2] - 2026-02-07

### Performance Optimization
- **서버 JSON.stringify 1회 통합**: 같은 게임 상태를 플레이어 수만큼 JSON.stringify하던 것을 1회만 실행
  - `sendPreStringifiedMessage()` 함수 추가로 사전 직렬화된 메시지 전송
  - 4인 플레이 기준 초당 60회 중복 stringify 제거
- **스킬 쿨다운 캐시 (`_skillQ/W/E`)**: `hero.skills.find()` 배열 탐색을 직접 참조로 대체
  - 영웅 생성 시 `_skillQ`, `_skillW`, `_skillE` 캐시 생성
  - 초당 240회 이상의 배열 탐색 완전 제거
- **이펙트 정리 인플레이스 처리**: 7개 `.filter()` 배열 생성을 역순 `for` + `splice`로 대체
  - 초당 420개 배열 할당 제거
- **버프 업데이트 인플레이스 처리**: `.map(spread).filter()` → 역순 `for` + duration 직접 수정 + `splice`
  - 영웅/적 버프 모두 적용, 초당 480개 배열+객체 할당 제거
- **승리 조건 체크 배열 제거**: `Array.from().filter()` → 직접 `for` 순회 + 카운터 변수
- **`Date.now()` 틱당 1회 캐시**: 틱당 20-25회 호출되던 `Date.now()`를 `state.currentTickTimestamp`로 1회 캐시
- **`distanceSquared()` 도입**: 범위 비교에서 `Math.sqrt` 제거 (초당 6,000-12,000회)
  - 적용 대상: findNearestEnemy, findNearestEnemyBase, applyHealerAura, updateNexusLaser, 적 AI 탐지, Q스킬 범위 체크
- **입력 큐 최적화**: `queue.shift()` O(n) → 인덱스 순회 + `queue.length = 0` 일괄 정리
- **적 직렬화 단일 패스**: `.filter().map()` 이중 순회 → 단일 `for` 루프

### Technical Changes
- `server/src/state/players.ts`: `sendPreStringifiedMessage()` 함수 추가
- `server/src/game/RPGCoopGameRoom.ts`: `broadcastGameState`에서 1회 stringify + `sendPreStringifiedMessage` 사용
- `server/src/game/rpgServerTypes.ts`: ServerHero에 `_skillQ/W/E` 캐시, ServerGameState에 `currentTickTimestamp` 필드 추가
- `server/src/game/rpgServerHeroSystem.ts`: createHero 스킬 캐시, updateBuffs 인플레이스, findNearest/applyHealerAura에 distanceSquared
- `server/src/game/rpgServerGameSystems.ts`: serializeGameState 스킬 캐시, 적 직렬화 단일 패스, cleanupEffects 인플레이스, checkWinCondition 카운터
- `server/src/game/RPGServerGameEngine.ts`: `currentTickTimestamp` 캐시, 입력 큐 인덱스 순회, 자동공격에 `_skillQ` 캐시
- `server/src/game/rpgServerUtils.ts`: `distanceSquared()` 함수 추가
- `server/src/game/rpgServerSkillSystem.ts`: 스킬 캐시 참조, Q스킬 범위 체크에 distanceSquared, Date.now→currentTickTimestamp
- `server/src/game/rpgServerEnemySystem.ts`: 적 AI 탐지에 distanceSquared, 버프 인플레이스 처리
- `server/src/game/rpgServerBossSystem.ts`: Date.now→currentTickTimestamp

### Notes
- 클라이언트 수정 없음 (SerializedGameState 인터페이스 유지)
- 게임 동작 변경 없음, 서버 전용 최적화
- 목표: CPU 50-70% 감소, GC 압력 60-80% 감소

---

## [1.20.20] - 2026-02-05

### Bug Fixes
- **RPG 멀티플레이 클라이언트 예측 + 서버 보정 아키텍처 구현**:
  - 클라이언트 로컬 이동 예측으로 즉각적인 반응 제공
  - 이동 중: 로컬 위치 100% 신뢰 (200px 초과 시만 스냅)
  - 정지 시: 호스트 위치로 부드럽게 수렴 (10px 미만: 무시, 10-100px: 30% 블렌드, 100px 초과: 스냅)
  - 돌진/시전/스턴 중에는 호스트 위치 100% 사용
  - 돌진 스킬 이펙트 2번 보이는 버그 수정 (로컬 dashState 설정 제거)
- **RPG 멀티플레이 클라이언트 사운드 누락 수정**:
  - E 스킬 사용 시 사운드 재생 추가
  - W 스킬 (돌진 아닌 경우) 사운드 재생 추가
  - 적 기지 파괴 시 사운드 및 알림 추가
  - 게임 종료 시 승리/패배 사운드 재생 추가
- **RPG 멀티플레이 클라이언트 보스 처치 수 버그 수정**:
  - 게임 종료 메시지에 최종 stats 포함하여 전송
  - 클라이언트가 정확한 보스 처치 수 표시

### Technical Changes
- `src/stores/useRPGStore.ts`:
  - `applySerializedState`: 이동 중/정지 시 분리된 보정 로직 구현
  - 기지 파괴 감지 로직 추가 (이전 상태와 비교하여 사운드/알림 트리거)
- `src/hooks/useRPGGameLoop.ts`:
  - 클라이언트 블록에 로컬 이동 예측 추가 (즉각 반응)
  - 돌진/시전/스턴 중에는 예측 중지
  - `handleClientSkillExecution`: 로컬 dashState 설정 제거, E/W 스킬 사운드 추가
  - `hostBroadcastGameOver`에 stats 포함
- `src/hooks/useNetworkSync.ts`:
  - `handleGameOver`: 호스트 stats 적용, 게임 종료 사운드 재생

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
