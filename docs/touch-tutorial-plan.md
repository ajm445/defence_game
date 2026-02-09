# RPG 터치 디바이스 튜토리얼 구현 계획

> **상태**: 구현 예정
> **버전**: V1.23.1+

---

## 1. 배경

기존 RPG 튜토리얼(8단계)은 데스크톱 전용으로 WASD, Shift, R, C 키 기반이다.
터치 디바이스(태블릿/모바일)에서는:

- 이동: `VirtualJoystick` (WASD 대체)
- 스킬: `TouchSkillButtons`의 탭/드래그 (Shift/R 대체)
- 업그레이드: `TouchUpgradeToggle` (하단 패널 대체)
- 호버 툴팁 불가 → 스킬 설명을 튜토리얼 텍스트에 직접 포함해야 함

**핵심 원칙**: 데스크톱 튜토리얼은 일절 변경하지 않는다.

---

## 2. 현재 튜토리얼 구조

### 파일 구성

| 파일 | 역할 |
|------|------|
| `src/stores/useRPGTutorialStore.ts` | 튜토리얼 상태 관리 (8단계 정의, 조건 충족 추적) |
| `src/components/screens/RPGTutorialScreen.tsx` | 튜토리얼 게임 화면 (조건 감지 구독, UI 렌더링) |
| `src/components/ui/RPGTutorialOverlay.tsx` | 안내 패널 (단계별 제목/설명, 진행/건너뛰기 버튼) |
| `src/renderer/rpgRenderer.ts` | 이동 목표 마커 렌더링 (`drawTutorialTargetMarker`) |

### 8단계 흐름

| # | id | 제목 | 조건 | 비고 |
|---|-----|------|------|------|
| 1 | welcome | 환영합니다! | none (수동) | 게임 목표 소개 |
| 2 | movement | WASD로 이동 | hero_moved | 3개 지점 순차 이동 |
| 3 | combat | 자동 공격 | enemy_killed | C키로 사거리 확인 |
| 4 | skill_shift | 일반 스킬 (Shift) | skill_w_used | 마우스 방향 발동, 호버 툴팁 안내 |
| 5 | skill_ultimate | 궁극기 (R) | skill_e_used | 마우스 방향 발동 |
| 6 | upgrade | 업그레이드 구매 | upgrade_purchased | 하단 패널에서 구매 |
| 7 | base | 적 기지 파괴 | base_destroyed | 키보드 언급 없음 |
| 8 | boss | 보스 처치 | boss_killed | 키보드 언급 없음 |

### 조건 감지 방식

모든 조건은 Zustand store 상태를 구독하여 감지:
- `hero_moved`: hero.x/y 위치와 목표 지점 거리 비교
- `skill_w_used` / `skill_e_used`: 스킬 쿨다운이 0→양수로 변화 감지
- `upgrade_purchased`: upgradeLevels 합계 증가 감지
- `enemy_killed` / `base_destroyed` / `boss_killed`: stats 변화 감지

**입력 방식과 무관** → 터치 컨트롤이 동일한 store 액션을 호출하므로 감지 로직 수정 불필요.

---

## 3. 수정 파일 (3개)

### 3-1. `src/stores/useRPGTutorialStore.ts`

#### A. 인터페이스 확장

```typescript
export interface RPGTutorialStep {
  id: string;
  title: string;
  description: string;
  touchTitle?: string;        // 터치 디바이스용 제목
  touchDescription?: string;  // 터치 디바이스용 설명
  conditionType: RPGTutorialConditionType;
  highlight?: string;
}
```

#### B. 단계별 터치 텍스트

| # | id | touchTitle | touchDescription |
|---|-----|-----------|-----------------|
| 1 | welcome | 환영합니다! | (동일하되 "클릭" → "터치") |
| 2 | movement | **조이스틱으로 이동** | 왼쪽 하단 터치 → 조이스틱 표시 → 드래그로 이동, 손 떼면 정지 |
| 3 | combat | 자동 공격 | C키 설명 제거, "조이스틱으로 적에게 접근" |
| 4 | skill_shift | **일반 스킬** | 오른쪽 하단 [스킬] 버튼, **탭=자동 타겟, 드래그=방향 지정**, 궁수 관통화살 설명 포함 (쿨타임 8초) |
| 5 | skill_ultimate | **궁극기** | [궁극기] 버튼, 탭/드래그, 궁수 화살비 설명 포함 (쿨타임 30초) |
| 6 | upgrade | 업그레이드 구매 | "오른쪽 하단 [⬆️] 버튼 터치 → 업그레이드 패널 열기" |
| 7 | base | *(생략 - fallback)* | |
| 8 | boss | *(생략 - fallback)* | |

7, 8단계는 키보드 언급이 없으므로 `touchTitle`/`touchDescription` 미설정 → 기존 텍스트 fallback.

### 3-2. `src/components/ui/RPGTutorialOverlay.tsx`

```typescript
import { useUIStore } from '../../stores/useUIStore';

// 컴포넌트 내부:
const isTouchDevice = useUIStore((s) => s.isTouchDevice);
const displayTitle = (isTouchDevice && currentStep.touchTitle) || currentStep.title;
const displayDescription = (isTouchDevice && currentStep.touchDescription) || currentStep.description;

// 렌더링:
// {currentStep.title} → {displayTitle}
// {currentStep.description} → {displayDescription}
```

### 3-3. `src/components/screens/RPGTutorialScreen.tsx`

```typescript
import { RPGTouchControls } from '../touch/RPGTouchControls';

// UIStore에서 추가:
const isTouchDevice = useUIStore((s) => s.isTouchDevice);

// 하단 데스크톱 UI: {!isTouchDevice && (...기존 스킬바+업그레이드...)}
// 터치 컨트롤: {isTouchDevice && !gameOver && <RPGTouchControls requestSkill={requestSkill} onUseSkill={handleUseSkill} />}
// 키보드 안내: {!isTouchDevice && (...기존 텍스트...)}
```

---

## 4. 조건 감지 호환성 (변경 불필요)

| 조건 | 데스크톱 입력 | 터치 입력 | 감지 대상 |
|------|-------------|----------|----------|
| hero_moved | WASD → setMoveDirection | 조이스틱 → setMoveDirection | hero.x/y 위치 |
| skill_w_used | Shift → requestSkill | W버튼 → requestSkill | W스킬 쿨다운 변화 |
| skill_e_used | R → requestSkill | E버튼 → requestSkill | E스킬 쿨다운 변화 |
| upgrade_purchased | 패널 클릭 → upgradeHeroStat | 토글 버튼 → upgradeHeroStat | upgradeLevels 합계 |
| enemy_killed | (자동공격) | (자동공격) | stats.totalKills |
| base_destroyed | (자동공격) | (자동공격) | enemyBases 상태 |
| boss_killed | (자동공격) | (자동공격) | stats.bossesKilled |

모두 동일한 store 액션을 호출하고, 감지는 store 상태 구독이므로 수정 불필요.

---

## 5. 검증 계획

1. `npm run build` 성공 확인
2. **데스크톱 검증**: 기존 튜토리얼 텍스트/동작이 전혀 변경되지 않음
3. **터치 디바이스 검증** (DevTools 터치 에뮬레이션):
   - 조이스틱/스킬버튼/업그레이드 토글이 정상 표시
   - 터치 전용 텍스트가 각 단계에서 표시
   - 8단계 전부 조건 충족 → 자동 진행 가능
   - 데스크톱 하단 UI(스킬바/업그레이드 패널/키보드 안내)가 숨겨짐
