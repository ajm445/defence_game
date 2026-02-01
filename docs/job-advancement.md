# 캐릭터 전직 시스템

## 개요

캐릭터는 일정 조건을 만족하면 상위 직업으로 전직할 수 있습니다. 각 기본 직업은 2개의 전직 경로 중 하나를 선택할 수 있으며, 전직 후 새로운 스킬과 특수 효과를 얻습니다.

## 전직 조건

| 단계 | 요구 레벨 | 설명 |
|------|----------|------|
| 1차 전직 | 15 | 기본 직업에서 전직 직업으로 변경 |
| 2차 강화 | 40 | 전직 직업의 외형 변경 + 스탯 증가 |

## 전직 방법

1. **프로필 UI 접근**: 게임 내 프로필을 클릭하여 캐릭터 업그레이드 UI를 엽니다.
2. **전직 버튼 활성화**: 캐릭터가 레벨 15에 도달하면 전직 버튼이 새로 나타납니다.
3. **전직 선택**: 전직 버튼을 누르면 2가지 전직 경로 중 하나를 선택할 수 있습니다.
4. **전직 완료**: 선택 후 캐릭터의 외형, 스탯, 스킬이 전직 직업에 맞게 변경됩니다.

> **참고**: 전직 후 스탯은 기본 직업보다 향상된 수치로 적용됩니다.

## 전직 시 변경 사항

### 유지되는 것
- **SP 업그레이드**: 전직 전에 SP로 업그레이드한 스탯(HP, 공격력, 공격속도 등)은 그대로 유지됩니다.
- **클래스 레벨**: 현재 클래스 레벨이 유지됩니다.
- **경험치**: 현재 경험치가 유지됩니다.

### 변경되는 것 (1차 전직)
- **외형**: 전직 직업의 새로운 외형으로 변경됩니다.
- **기본 스탯**: 전직 직업의 새로운 기본 스탯이 적용됩니다. (모든 스탯이 전직 전보다 향상)
- **W 스킬 (Shift)**: 전직 직업의 새로운 W 스킬로 변경됩니다.
- **E 스킬 (R)**: 전직 직업의 새로운 E 스킬로 변경됩니다.
- **특수 효과**: 전직 직업의 고유 특수 효과가 부여됩니다.

### 변경되는 것 (2차 강화, Lv.40)
- **외형**: 2차 강화 외형으로 변경됩니다.
- **스탯 증가**: 전직 기본 스탯의 120%가 됩니다.
- **스킬 유지**: 1차 전직 시 획득한 스킬이 그대로 유지됩니다.

## 스탯 계산 시스템

### 핵심 원칙
1. **전직 시 모든 스탯 향상**: 어떤 전직을 하더라도 모든 스탯이 전직 전보다 높아야 합니다.
2. **직업별 특화**: 향상된 스탯 내에서 직업 컨셉에 맞게 밸런스가 조정됩니다.
3. **2차 강화는 20% 추가**: 전직 기본 스탯 × 1.2

### 스탯 계산 공식

**1차 전직 시:**
```
전직 후 스탯 = 전직 직업 기본 스탯 (전직 전보다 모두 높음)
최종 스탯 = 전직 후 스탯 + SP 업그레이드 보너스
```

**2차 강화 시 (레벨 40):**
```
2차 강화 스탯 = 전직 기본 스탯 × 1.2
최종 스탯 = 2차 강화 스탯 + SP 업그레이드 보너스
```

### 계산 예시

**전사 → 버서커 전직:**
```
전사 기본 HP: 100
버서커 기본 HP: 130 (전직으로 향상)
2차 강화 HP: 130 × 1.2 = 156

SP 업그레이드 +20 포함 시:
- 1차 전직 최종 HP: 130 + 20 = 150
- 2차 강화 최종 HP: 156 + 20 = 176
```

**전사 → 가디언 전직:**
```
전사 기본 HP: 100
가디언 기본 HP: 160 (HP 특화로 더 높음)
2차 강화 HP: 160 × 1.2 = 192

SP 업그레이드 +20 포함 시:
- 1차 전직 최종 HP: 160 + 20 = 180
- 2차 강화 최종 HP: 192 + 20 = 212
```

## 기본 직업 ID

| 한글명 | 영문 ID |
|--------|---------|
| 전사 | `warrior` |
| 궁수 | `archer` |
| 기사 | `knight` |
| 마법사 | `mage` |

## 전직 경로

### 전사 (Warrior)

| 전직 | 이름 | 컨셉 |
|------|------|------|
| 버서커 | Berserker | 공격력과 공격속도 특화 광전사 |
| 가디언 | Guardian | 높은 방어력과 체력의 수호자 |

### 궁수 (Archer)

| 전직 | 이름 | 컨셉 |
|------|------|------|
| 저격수 | Sniper | 높은 단일 공격력과 사거리 |
| 레인저 | Ranger | 빠른 공격속도와 다중 타겟 |

### 기사 (Knight)

| 전직 | 이름 | 컨셉 |
|------|------|------|
| 팔라딘 | Paladin | 신성한 힘으로 아군을 치유 |
| 다크나이트 | Dark Knight | 어둠의 힘으로 적을 베는 암흑기사 |

### 마법사 (Mage)

| 전직 | 이름 | 컨셉 |
|------|------|------|
| 대마법사 | Archmage | 강력한 범위 마법 |
| 힐러 | Healer | 아군을 치유 |

## 전직 직업 상세

### 버서커 (Berserker) 🔥

**기본 스탯 (전사 대비):**
| 스탯 | 전사 | 버서커 (1차) | 버서커 (2차) | 특징 |
|------|------|-------------|-------------|------|
| HP | 100 | 110 (+10%) | 132 | 공격 특화로 HP 소폭 증가 |
| 공격력 | 100 | 150 (+50%) | 180 | 최고 공격력 |
| 공격속도 | 100 | 130 (+30%) | 156 | 빠른 공격 |
| 속도 | 100 | 110 (+10%) | 132 | |
| 사거리 | 100 | 100 (±0%) | 120 | |

**특수 효과:**
- 피해흡혈 1.5배

**W 스킬 - 피의 돌진 (Blood Rush):** `blood_rush`
- 쿨다운: 6초
- 효과: 전방 돌진 + 경로상 적에게 데미지 + 피해량의 50% 체력 회복

**E 스킬 - 광란 (Rage):** `rage`
- 쿨다운: 45초
- 효과: 10초간 공격력/공속 100% 증가, 받는 피해 50% 증가

---

### 가디언 (Guardian) 🛡️

**기본 스탯 (전사 대비):**
| 스탯 | 전사 | 가디언 (1차) | 가디언 (2차) | 특징 |
|------|------|-------------|-------------|------|
| HP | 100 | 160 (+60%) | 192 | 최고 HP |
| 공격력 | 100 | 110 (+10%) | 132 | 방어 특화로 공격 소폭 증가 |
| 공격속도 | 100 | 105 (+5%) | 126 | 느린 편 |
| 속도 | 100 | 105 (+5%) | 126 | |
| 사거리 | 100 | 100 (±0%) | 120 | |

**특수 효과:**
- 받는 피해 30% 감소

**W 스킬 - 수호의 돌진 (Guardian Rush):** `guardian_rush`
- 쿨다운: 8초
- 효과: 전방 돌진 + 경로상 적에게 최대 HP 10% 데미지 + 2초 기절 + 3초간 자신에게 보호막 (최대 HP 20%)

**E 스킬 - 보호막 (Shield):** `shield`
- 쿨다운: 40초
- 효과: 아군 전체에게 5초간 받는 피해 50% 감소

---

### 저격수 (Sniper) 🎯

**기본 스탯 (궁수 대비):**
| 스탯 | 궁수 | 저격수 (1차) | 저격수 (2차) | 특징 |
|------|------|-------------|-------------|------|
| HP | 100 | 110 (+10%) | 132 | |
| 공격력 | 100 | 160 (+60%) | 192 | 최고 단일 공격력 |
| 공격속도 | 100 | 105 (+5%) | 126 | 느린 대신 강력 |
| 속도 | 100 | 110 (+10%) | 132 | |
| 사거리 | 100 | 150 (+50%) | 180 | 최장 사거리 |

**특수 효과:**
- 크리티컬 확률 50%

**W 스킬 - 후방 도약 (Backflip Shot):** `backflip_shot`
- 쿨다운: 5초
- 효과: 뒤로 점프하며 전방에 200% 데미지 화살 발사 + 3초간 이동속도 30% 증가

**E 스킬 - 저격 (Snipe):** `snipe`
- 쿨다운: 30초
- 효과: 3초 조준 후 1000% 데미지 단일 타격

---

### 레인저 (Ranger) 🏹

**기본 스탯 (궁수 대비):**
| 스탯 | 궁수 | 레인저 (1차) | 레인저 (2차) | 특징 |
|------|------|-------------|-------------|------|
| HP | 100 | 120 (+20%) | 144 | 밸런스형 |
| 공격력 | 100 | 120 (+20%) | 144 | 밸런스형 |
| 공격속도 | 100 | 140 (+40%) | 168 | 최고 공격속도 |
| 속도 | 100 | 115 (+15%) | 138 | |
| 사거리 | 100 | 110 (+10%) | 132 | |

**특수 효과:**
- 다중 타겟 5명

**W 스킬 - 다중 화살 (Multi Arrow):** `multi_arrow`
- 쿨다운: 5초
- 효과: 부채꼴 방향으로 5발의 관통 화살 발사, 각 화살 100% 데미지

**E 스킬 - 화살 폭풍 (Arrow Storm):** `arrow_storm`
- 쿨다운: 35초
- 효과: 5초간 공격 속도 3배

---

### 팔라딘 (Paladin) ⚜️

**기본 스탯 (기사 대비):**
| 스탯 | 기사 | 팔라딘 (1차) | 팔라딘 (2차) | 특징 |
|------|------|-------------|-------------|------|
| HP | 100 | 140 (+40%) | 168 | 높은 생존력 |
| 공격력 | 100 | 115 (+15%) | 138 | 서포터 성향 |
| 공격속도 | 100 | 110 (+10%) | 132 | |
| 속도 | 100 | 110 (+10%) | 132 | |
| 사거리 | 100 | 105 (+5%) | 126 | |

**특수 효과:**
- 아군 힐 가능

**W 스킬 - 신성한 돌진 (Holy Charge):** `holy_charge`
- 쿨다운: 8초
- 효과: 전방 돌진 + 경로상 적에게 최대 HP 10% 데미지 + 기절 + 주변 아군 HP 10% 회복

**E 스킬 - 신성한 빛 (Divine Light):** `divine_light`
- 쿨다운: 60초
- 효과: 아군 전체 HP 30% 회복 + 3초 무적

---

### 다크나이트 (Dark Knight) ⚔️

**기본 스탯 (기사 대비):**
| 스탯 | 기사 | 다크나이트 (1차) | 다크나이트 (2차) | 특징 |
|------|------|-----------------|-----------------|------|
| HP | 100 | 125 (+25%) | 150 | 밸런스형 |
| 공격력 | 100 | 140 (+40%) | 168 | 공격 특화 |
| 공격속도 | 100 | 115 (+15%) | 138 | |
| 속도 | 100 | 110 (+10%) | 132 | |
| 사거리 | 100 | 105 (+5%) | 126 | |

**특수 효과:**
- 피해흡혈 30% 부여

**W 스킬 - 암흑 베기 (Shadow Slash):** `shadow_slash`
- 쿨다운: 8초
- 효과: 전방 돌진 + 경로상 적에게 150% 데미지 + 피해량의 30% 체력 회복

**E 스킬 - 어둠의 칼날 (Dark Blade):** `dark_blade`
- 쿨다운: 40초
- 효과: 5초간 주변 적에게 초당 공격력 50% 데미지

---

### 대마법사 (Archmage) 🌟

**기본 스탯 (마법사 대비):**
| 스탯 | 마법사 | 대마법사 (1차) | 대마법사 (2차) | 특징 |
|------|--------|---------------|---------------|------|
| HP | 100 | 110 (+10%) | 132 | 공격 특화로 HP 소폭 증가 |
| 공격력 | 100 | 170 (+70%) | 204 | 최고 마법 공격력 |
| 공격속도 | 100 | 110 (+10%) | 132 | |
| 속도 | 100 | 105 (+5%) | 126 | |
| 사거리 | 100 | 150 (+50%) | 180 | 장거리 마법 |

**특수 효과:**
- 보스에게 50% 추가 데미지

**W 스킬 - 폭발 화염구 (Inferno):** `inferno`
- 쿨다운: 7초
- 효과: 대형 화염구 발사, 250% 데미지 + 범위 50% 증가 + 3초간 화상 (초당 20% 데미지)

**E 스킬 - 메테오 샤워 (Meteor Shower):** `meteor_shower`
- 쿨다운: 50초
- 효과: 5초간 랜덤 위치에 운석 10개 낙하 (각 300% 데미지)

---

### 힐러 (Healer) 💚

**기본 스탯 (마법사 대비):**
| 스탯 | 마법사 | 힐러 (1차) | 힐러 (2차) | 특징 |
|------|--------|-----------|-----------|------|
| HP | 100 | 140 (+40%) | 168 | 높은 생존력 |
| 공격력 | 100 | 105 (+5%) | 126 | 서포터 성향으로 공격 소폭 증가 |
| 공격속도 | 100 | 115 (+15%) | 138 | |
| 속도 | 100 | 110 (+10%) | 132 | |
| 사거리 | 100 | 120 (+20%) | 144 | 넓은 힐 범위 |

**특수 효과:**
- 아군 힐 가능

**W 스킬 - 치유의 빛 (Healing Light):** `healing_light`
- 쿨다운: 7초
- 효과: 전방 범위에 치유의 빛 발사, 적에게 100% 데미지 + 범위 내 아군 HP 15% 회복

**E 스킬 - 생명의 샘 (Spring of Life):** `spring_of_life`
- 쿨다운: 45초
- 효과: 15초간 아군 전체 초당 최대 HP의 5% 회복

## 스킬 변경 요약

### W 스킬 (Shift) 비교

| 기본 직업 | 기본 W 스킬 | 전직 | 전직 W 스킬 | 스킬 ID |
|-----------|-------------|------|-------------|---------|
| 전사 | 돌진 | 버서커 | 피의 돌진 (돌진 + 피해흡혈 50%) | `blood_rush` |
| 전사 | 돌진 | 가디언 | 수호의 돌진 (돌진 + 기절 + 보호막) | `guardian_rush` |
| 궁수 | 관통 화살 | 저격수 | 후방 도약 (뒤로 점프 + 200% 화살) | `backflip_shot` |
| 궁수 | 관통 화살 | 레인저 | 다중 화살 (부채꼴 5발 관통) | `multi_arrow` |
| 기사 | 방패 돌진 | 팔라딘 | 신성한 돌진 (돌진 + 기절 + 아군 힐) | `holy_charge` |
| 기사 | 방패 돌진 | 다크나이트 | 암흑 베기 (돌진 + 150% 데미지 + 피해흡혈) | `shadow_slash` |
| 마법사 | 화염구 | 대마법사 | 폭발 화염구 (250% + 범위 증가 + 화상) | `inferno` |
| 마법사 | 화염구 | 힐러 | 치유의 빛 (적 데미지 + 아군 힐) | `healing_light` |

### E 스킬 (R) 비교

| 기본 직업 | 기본 E 스킬 | 전직 | 전직 E 스킬 | 스킬 ID |
|-----------|-------------|------|-------------|---------|
| 전사 | 광전사 | 버서커 | 광란 (공/공속 100%↑, 받뎀 50%↑) | `rage` |
| 전사 | 광전사 | 가디언 | 보호막 (아군 전체 받뎀 50%↓) | `shield` |
| 궁수 | 화살 비 | 저격수 | 저격 (3초 조준, 1000% 데미지) | `snipe` |
| 궁수 | 화살 비 | 레인저 | 화살 폭풍 (5초간 공속 3배) | `arrow_storm` |
| 기사 | 철벽 방어 | 팔라딘 | 신성한 빛 (아군 HP 30% + 3초 무적) | `divine_light` |
| 기사 | 철벽 방어 | 다크나이트 | 어둠의 칼날 (5초간 주변 초당 50% 데미지) | `dark_blade` |
| 마법사 | 운석 낙하 | 대마법사 | 메테오 샤워 (5초간 운석 10개) | `meteor_shower` |
| 마법사 | 운석 낙하 | 힐러 | 생명의 샘 (15초간 아군 초당 5% 힐) | `spring_of_life` |

---

## 전직 선택 가이드

### 딜러 지향
- **버서커**: 최고의 단일 DPS, 리스크 있는 플레이
- **저격수**: 안전 거리에서 고데미지
- **대마법사**: 범위 딜 + 보스 특화

### 서포터 지향
- **가디언**: 파티 보호
- **팔라딘**: 힐 + 무적
- **힐러**: 지속 힐

### 밸런스형
- **레인저**: 다중 타겟으로 안정적 딜
- **다크나이트**: 생존력 있는 딜러

## 전직 직업 ID

| 한글명 | 영문 ID |
|--------|---------|
| 버서커 | `berserker` |
| 가디언 | `guardian` |
| 저격수 | `sniper` |
| 레인저 | `ranger` |
| 팔라딘 | `paladin` |
| 다크나이트 | `dark_knight` |
| 대마법사 | `archmage` |
| 힐러 | `healer` |

## 캐릭터 이미지

전직 캐릭터는 레벨에 따라 다른 이미지를 사용합니다.

| 전직 직업 | 1차 이미지 (Lv.15~) | 2차 이미지 (Lv.50~) |
|-----------|---------------------|---------------------|
| 버서커 | `berserker.png` | `berserker2.png` |
| 가디언 | `guardian.png` | `guardian2.png` |
| 저격수 | `sniper.png` | `sniper2.png` |
| 레인저 | `ranger.png` | `ranger2.png` |
| 팔라딘 | `paladin.png` | `paladin2.png` |
| 다크나이트 | `dark_knight.png` | `dark_knight2.png` |
| 대마법사 | `archmage.png` | `archmage2.png` |
| 힐러 | `healer.png` | `healer2.png` |

이미지 경로: `public/img/units/RPG/`

## 관련 파일

- `src/constants/rpgConfig.ts` - 전직 설정 (`ADVANCED_CLASS_CONFIGS`, `ADVANCED_CLASS_SKILLS`)
- `src/types/rpg.ts` - 타입 정의 (`AdvancedHeroClass`)
- `public/img/units/RPG/` - 전직 캐릭터 이미지

## 구현 상태

> ⚠️ **참고**: 전직 시스템은 현재 기획 및 설정값이 정의된 상태입니다.
> - [x] 전직 직업 설계 완료
> - [x] 스킬 설계 완료
> - [x] 캐릭터 이미지 추가 완료
> - [ ] 전직 UI 구현
> - [ ] 전직 로직 구현
> - [ ] 2차 강화 (Lv.50) 구현

---

## 구현 계획

### 1. 전직 UI 구현 계획

#### 1.1 프로필 UI 수정
- 기존 캐릭터 업그레이드 UI에 전직 버튼 추가
- 레벨 15 미만: 전직 버튼 비활성화 (잠금 표시)
- 레벨 15 이상 & 미전직: 전직 버튼 활성화
- 전직 완료: 전직 버튼 숨김 또는 "전직 완료" 표시

#### 1.2 전직 선택 모달
```
┌─────────────────────────────────────────────┐
│           [기본직업] 전직 선택              │
├─────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐        │
│  │   [이미지]   │    │   [이미지]   │        │
│  │   버서커    │    │   가디언    │        │
│  │ 공격 특화   │    │ 방어 특화   │        │
│  │             │    │             │        │
│  │ HP: -20%   │    │ HP: +30%   │        │
│  │ 공격: +40% │    │ 공격: -10% │        │
│  │ 공속: +20% │    │ 받뎀: -30% │        │
│  │             │    │             │        │
│  │  [선택]    │    │  [선택]    │        │
│  └─────────────┘    └─────────────┘        │
│                                             │
│              [취소]                         │
└─────────────────────────────────────────────┘
```

#### 1.3 전직 확인 모달
```
┌─────────────────────────────────────────────┐
│         [버서커]로 전직하시겠습니까?         │
├─────────────────────────────────────────────┤
│  • 스탯이 전직 직업에 맞게 변경됩니다       │
│  • SP 업그레이드는 유지됩니다               │
│  • 전직 후 되돌릴 수 없습니다               │
│                                             │
│         [확인]        [취소]                │
└─────────────────────────────────────────────┘
```

#### 1.4 UI 컴포넌트 구조
```
src/components/RPG/
├── JobAdvancementButton.tsx      # 전직 버튼 컴포넌트
├── JobAdvancementModal.tsx       # 전직 선택 모달
├── JobAdvancementConfirm.tsx     # 전직 확인 모달
└── JobAdvancementCard.tsx        # 전직 직업 카드 (스탯/스킬 미리보기)
```

---

### 2. 전직 로직 구현 계획

#### 2.1 타입 수정 (`src/types/rpg.ts`)
```typescript
// 전직 직업 타입
export type AdvancedHeroClass =
  | 'berserker' | 'guardian'      // 전사 계열
  | 'sniper' | 'ranger'           // 궁수 계열
  | 'paladin' | 'dark_knight'     // 기사 계열
  | 'archmage' | 'healer';        // 마법사 계열

// Hero 인터페이스 수정
export interface Hero {
  // ... 기존 필드
  advancedClass: AdvancedHeroClass | null;  // 전직 직업 (null = 미전직)
  tier: 1 | 2;                               // 1 = 1차 전직, 2 = 2차 강화
}
```

#### 2.2 설정 추가 (`src/constants/rpgConfig.ts`)
```typescript
// 전직 가능 경로
export const ADVANCEMENT_PATHS: Record<HeroClass, AdvancedHeroClass[]> = {
  warrior: ['berserker', 'guardian'],
  archer: ['sniper', 'ranger'],
  knight: ['paladin', 'dark_knight'],
  mage: ['archmage', 'healer'],
};

// 전직 조건
export const ADVANCEMENT_REQUIREMENTS = {
  firstAdvancement: 15,   // 1차 전직 레벨
  secondEnhancement: 50,  // 2차 강화 레벨
};
```

#### 2.3 스토어 함수 추가 (`src/stores/useRPGStore.ts`)
```typescript
// 전직 가능 여부 확인
canAdvance: (heroId: string) => boolean;

// 전직 실행
advanceJob: (heroId: string, advancedClass: AdvancedHeroClass) => void;

// 전직 시 스탯 재계산
recalculateStats: (hero: Hero) => Hero;
```

#### 2.4 전직 로직 흐름
```
1. canAdvance() 호출
   └─ 레벨 >= 15 확인
   └─ advancedClass === null 확인
   └─ true/false 반환

2. advanceJob() 호출
   └─ 기본 스탯 저장 (SP 업그레이드 분리)
   └─ advancedClass 설정
   └─ tier = 1 설정
   └─ 스탯 배율 적용 (ADVANCED_CLASS_CONFIGS)
   └─ SP 업그레이드 재적용
   └─ 스킬 변경 (ADVANCED_CLASS_SKILLS)
   └─ 이미지 변경
   └─ 멀티플레이 동기화 (필요시)
```

#### 2.5 스탯 계산 공식
```
1차 전직 시:
최종 스탯 = 전직 직업 기본 스탯 + SP 업그레이드 보너스
(전직 직업 기본 스탯은 모두 기본 직업보다 높음)

예시 (전사 → 버서커 전직):
- 전사 기본 HP: 100
- 버서커 기본 HP: 110 (전사보다 10% 향상)
- SP 업그레이드 +20
- 최종 HP = 110 + 20 = 130
```

#### 2.6 멀티플레이 동기화
```typescript
// 전직 정보 동기화 메시지
interface AdvancementSyncMessage {
  type: 'advancement';
  heroId: string;
  advancedClass: AdvancedHeroClass;
  tier: 1 | 2;
}
```

---

### 3. 2차 강화 구현 계획

#### 3.1 2차 강화 조건
- 레벨 50 이상
- 1차 전직 완료 상태 (advancedClass !== null, tier === 1)

#### 3.2 2차 강화 효과
| 항목 | 변경 내용 |
|------|----------|
| 외형 | 2차 이미지로 변경 (`berserker2.png` 등) |
| 스탯 | 추가 스탯 보너스 적용 |
| 스킬 | 1차 전직 스킬 유지 (변경 없음) |

#### 3.3 2차 강화 스탯 보너스
```typescript
export const SECOND_ENHANCEMENT_BONUS = {
  statMultiplier: 1.2,  // 모든 스탯 20% 증가
};

// 적용 대상 스탯
// - HP: 100 → 120
// - 공격력: 100 → 120
// - 공격속도: 기존 값 × 1.2 (더 빨라짐)
// - 이동속도: 100 → 120
// - 사거리: 100 → 120
```

#### 3.4 2차 강화 스탯 계산 공식
```
2차 강화 후 스탯 = 전직 기본 스탯 × 1.2
최종 스탯 = 2차 강화 스탯 + SP 업그레이드 보너스

예시 (버서커 2차 강화):
- 버서커 기본 HP: 110
- 2차 강화 후 HP: 110 × 1.2 = 132
- SP 업그레이드 +20 포함 시: 132 + 20 = 152
```

#### 3.4 2차 강화 방식
- **자동 강화**: 레벨 50 도달 시 자동으로 2차 강화 적용
- 강화 완료 알림 표시 필수

#### 3.5 구현 함수
```typescript
// 2차 강화 가능 여부 확인
canEnhance: (heroId: string) => boolean;

// 2차 강화 실행
enhanceJob: (heroId: string) => void;
```

#### 3.6 2차 강화 로직 흐름 (자동)
```
레벨업 시 자동 체크:
1. 레벨 >= 50 확인
2. advancedClass !== null 확인 (1차 전직 완료)
3. tier === 1 확인 (아직 2차 강화 안됨)
4. 조건 충족 시 자동으로 enhanceJob() 호출

enhanceJob() 실행:
   └─ tier = 2 설정
   └─ 스탯 보너스 적용 (모든 스탯 × 1.2)
   └─ 이미지 변경 (2차 이미지)
   └─ 멀티플레이 동기화
   └─ 알림 표시 ("2차 강화 완료!")
```

---

### 4. 구현 우선순위

| 순서 | 항목 | 의존성 |
|------|------|--------|
| 1 | 타입 및 설정 추가 | 없음 |
| 2 | 전직 로직 구현 | 1번 완료 |
| 3 | 전직 UI 구현 | 2번 완료 |
| 4 | 2차 강화 로직 구현 | 2번 완료 |
| 5 | 2차 강화 UI 구현 | 4번 완료 |
| 6 | 멀티플레이 동기화 | 2, 4번 완료 |
| 7 | 테스트 및 밸런싱 | 전체 완료 |

---

### 5. 테스트 체크리스트

#### 싱글플레이
- [x] 레벨 15 미만에서 전직 버튼 비활성화 확인
- [x] 레벨 15에서 전직 버튼 활성화 확인
- [x] 전직 선택 UI 정상 표시
- [x] 전직 후 스탯 배율 정상 적용
- [x] 전직 후 SP 업그레이드 유지 확인
- [x] 전직 후 스킬 변경 확인
- [x] 전직 후 이미지 변경 확인
- [x] 레벨 50 도달 시 자동 2차 강화 확인
- [x] 2차 강화 시 알림 표시 확인
- [x] 2차 강화 후 스탯 20% 증가 확인
- [x] 2차 강화 후 이미지 변경 확인

#### 멀티플레이
- [x] 호스트 전직 시 클라이언트에 동기화
- [x] 클라이언트 전직 시 호스트에 동기화
- [x] 전직 후 다른 플레이어에게 외형 변경 표시
- [x] 2차 강화 동기화 확인

---

### 6. 스킬 구현 상세 계획

#### 6.1 스킬 공통 구조
```typescript
interface SkillDefinition {
  id: string;                    // 스킬 ID
  name: string;                  // 스킬 이름
  cooldown: number;              // 쿨다운 (초)
  type: 'active' | 'buff';       // 스킬 타입
  targeting: 'direction' | 'self' | 'area';  // 타겟팅 방식
  range: number;                 // 사거리/범위
  damage?: number;               // 데미지 배율 (%)
  duration?: number;             // 지속 시간 (초)
  effects?: SkillEffect[];       // 특수 효과
}

interface SkillEffect {
  type: 'stun' | 'heal' | 'buff' | 'debuff' | 'dot' | 'shield';
  value: number;
  duration?: number;
}
```

#### 6.2 버서커 스킬

**W - 피의 돌진 (blood_rush)**
| 항목 | 값 |
|------|-----|
| 타입 | 방향 지정 돌진 |
| 쿨다운 | 6초 |
| 사거리 | 300px (돌진 거리) |
| 데미지 | 100% (경로상 적) |
| 특수효과 | 피해량의 50% 체력 회복 |
| 애니메이션 | 빠른 전방 이동 + 붉은 잔상 |
| 히트박스 | 돌진 경로 (폭 50px) |

**E - 광란 (rage)**
| 항목 | 값 |
|------|-----|
| 타입 | 자기 버프 |
| 쿨다운 | 45초 |
| 지속시간 | 10초 |
| 효과 | 공격력 +100%, 공격속도 +100%, 받는 피해 +50% |
| 애니메이션 | 붉은 오라 + 캐릭터 붉게 변함 |
| 이펙트 | 버프 지속 중 붉은 파티클 |

#### 6.3 가디언 스킬

**W - 수호의 돌진 (guardian_rush)**
| 항목 | 값 |
|------|-----|
| 타입 | 방향 지정 돌진 |
| 쿨다운 | 8초 |
| 사거리 | 250px (돌진 거리) |
| 데미지 | 최대 HP의 10% |
| 특수효과 | 2초 기절 + 3초간 보호막 (최대 HP 20%) |
| 애니메이션 | 방패를 앞세운 돌진 + 금색 잔상 |
| 히트박스 | 돌진 경로 (폭 60px) |

**E - 보호막 (shield)**
| 항목 | 값 |
|------|-----|
| 타입 | 아군 전체 버프 |
| 쿨다운 | 40초 |
| 지속시간 | 5초 |
| 효과 | 아군 전체 받는 피해 50% 감소 |
| 애니메이션 | 금색 보호막 돔 확산 |
| 이펙트 | 아군에게 금색 보호막 표시 |

#### 6.4 저격수 스킬

**W - 후방 도약 (backflip_shot)**
| 항목 | 값 |
|------|-----|
| 타입 | 후방 이동 + 전방 공격 |
| 쿨다운 | 5초 |
| 도약거리 | 150px (후방) |
| 데미지 | 200% (전방 화살) |
| 특수효과 | 3초간 이동속도 +30% |
| 애니메이션 | 백플립 + 화살 발사 |
| 히트박스 | 직선 (폭 20px, 길이 500px) |

**E - 저격 (snipe)**
| 항목 | 값 |
|------|-----|
| 타입 | 채널링 + 단일 타격 |
| 쿨다운 | 30초 |
| 조준시간 | 3초 (이동 불가) |
| 데미지 | 1000% |
| 사거리 | 화면 전체 |
| 애니메이션 | 조준선 표시 → 강력한 화살 발사 |
| 이펙트 | 조준 중 레이저 조준선 + 발사 시 섬광 |

#### 6.5 레인저 스킬

**W - 다중 화살 (multi_arrow)**
| 항목 | 값 |
|------|-----|
| 타입 | 부채꼴 발사 |
| 쿨다운 | 5초 |
| 화살 수 | 5발 |
| 데미지 | 각 100% |
| 특수효과 | 관통 |
| 각도 | 60도 (부채꼴) |
| 애니메이션 | 동시에 5발 발사 |
| 히트박스 | 각 화살 직선 (폭 15px) |

**E - 화살 폭풍 (arrow_storm)**
| 항목 | 값 |
|------|-----|
| 타입 | 자기 버프 |
| 쿨다운 | 35초 |
| 지속시간 | 5초 |
| 효과 | 공격속도 3배 |
| 애니메이션 | 녹색 바람 오라 |
| 이펙트 | 빠른 화살 연사 |

#### 6.6 팔라딘 스킬

**W - 신성한 돌진 (holy_charge)**
| 항목 | 값 |
|------|-----|
| 타입 | 방향 지정 돌진 |
| 쿨다운 | 8초 |
| 사거리 | 250px (돌진 거리) |
| 데미지 | 최대 HP의 10% |
| 특수효과 | 기절 + 주변 아군 HP 10% 회복 |
| 회복범위 | 돌진 종료 지점 반경 150px |
| 애니메이션 | 금빛 돌진 + 치유 파동 |
| 히트박스 | 돌진 경로 (폭 60px) |

**E - 신성한 빛 (divine_light)**
| 항목 | 값 |
|------|-----|
| 타입 | 아군 전체 버프 |
| 쿨다운 | 60초 |
| 효과 | 아군 전체 HP 30% 회복 + 3초 무적 |
| 애니메이션 | 하늘에서 빛 기둥 하강 |
| 이펙트 | 아군에게 금색 무적 쉴드 표시 |

#### 6.7 다크나이트 스킬

**W - 암흑 베기 (shadow_slash)**
| 항목 | 값 |
|------|-----|
| 타입 | 방향 지정 돌진 |
| 쿨다운 | 8초 |
| 사거리 | 250px (돌진 거리) |
| 데미지 | 150% |
| 특수효과 | 피해량의 30% 체력 회복 |
| 애니메이션 | 보라색 잔상 + 검은 베기 |
| 히트박스 | 돌진 경로 (폭 50px) |

**E - 어둠의 칼날 (dark_blade)**
| 항목 | 값 |
|------|-----|
| 타입 | 지속 범위 데미지 |
| 쿨다운 | 40초 |
| 지속시간 | 5초 |
| 데미지 | 초당 공격력의 50% |
| 범위 | 반경 200px |
| 애니메이션 | 검은 오라 회전 |
| 이펙트 | 주변에 보라색 칼날 회전 |

#### 6.8 대마법사 스킬

**W - 폭발 화염구 (inferno)**
| 항목 | 값 |
|------|-----|
| 타입 | 방향 지정 투사체 |
| 쿨다운 | 7초 |
| 데미지 | 250% |
| 범위 | 기본 화염구 대비 50% 증가 |
| 특수효과 | 3초간 화상 (초당 20% 데미지) |
| 애니메이션 | 대형 불꽃 구체 |
| 이펙트 | 폭발 시 화염 + 화상 대상 붉은 표시 |

**E - 메테오 샤워 (meteor_shower)**
| 항목 | 값 |
|------|-----|
| 타입 | 랜덤 범위 공격 |
| 쿨다운 | 50초 |
| 지속시간 | 5초 |
| 운석 수 | 10개 |
| 데미지 | 각 300% |
| 범위 | 화면 전체 (랜덤 위치) |
| 운석 반경 | 각 100px |
| 애니메이션 | 하늘에서 운석 낙하 |
| 이펙트 | 낙하 예고 원 표시 → 폭발 |

#### 6.9 힐러 스킬

**W - 치유의 빛 (healing_light)**
| 항목 | 값 |
|------|-----|
| 타입 | 방향 지정 범위 |
| 쿨다운 | 7초 |
| 데미지 | 100% (적) |
| 회복량 | 아군 HP 15% |
| 범위 | 전방 부채꼴 (90도, 200px) |
| 애니메이션 | 녹색 빛 파동 |
| 이펙트 | 범위 내 아군 녹색 치유 표시 |

**E - 생명의 샘 (spring_of_life)**
| 항목 | 값 |
|------|-----|
| 타입 | 아군 전체 지속 회복 |
| 쿨다운 | 45초 |
| 지속시간 | 15초 |
| 회복량 | 초당 최대 HP의 5% |
| 애니메이션 | 녹색 오라 확산 |
| 이펙트 | 아군에게 녹색 회복 파티클 |

#### 6.10 스킬 구현 우선순위
1. 돌진형 스킬 (blood_rush, guardian_rush, holy_charge, shadow_slash)
2. 버프형 스킬 (rage, shield, arrow_storm, spring_of_life)
3. 투사체형 스킬 (backflip_shot, multi_arrow, inferno, healing_light)
4. 특수 스킬 (snipe, dark_blade, meteor_shower, divine_light)

---

### 7. 이펙트 및 애니메이션 계획

#### 7.1 전직 연출
```
전직 선택 확인 후:
1. 화면 페이드 아웃 (0.5초)
2. 캐릭터 중앙에 빛 기둥 (1초)
3. 캐릭터 이미지 변경
4. 새로운 외형으로 빛 폭발 (0.5초)
5. 화면 페이드 인 (0.5초)
6. "전직 완료!" 텍스트 표시
```

#### 7.2 2차 강화 연출
```
2차 강화 완료 시:
1. 캐릭터 주변 오라 발생 (1초)
2. 캐릭터 이미지 변경 (2차 이미지)
3. 강화 이펙트 폭발 (0.5초)
4. "2차 강화 완료!" 텍스트 표시
```

#### 7.3 스킬 이펙트 색상 테마
| 직업 | 주 색상 | 보조 색상 |
|------|---------|-----------|
| 버서커 | 붉은색 | 주황색 |
| 가디언 | 금색 | 은색 |
| 저격수 | 청록색 | 흰색 |
| 레인저 | 녹색 | 갈색 |
| 팔라딘 | 금색 | 흰색 |
| 다크나이트 | 보라색 | 검정색 |
| 대마법사 | 주황색 | 붉은색 |
| 힐러 | 연녹색 | 흰색 |

#### 7.4 이펙트 구현 방식
```typescript
// Canvas 기반 파티클 시스템
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

// 스킬 이펙트 매니저
class SkillEffectManager {
  particles: Particle[] = [];

  createEffect(type: string, x: number, y: number): void;
  update(deltaTime: number): void;
  render(ctx: CanvasRenderingContext2D): void;
}
```

#### 7.5 모션 프레임 시퀀스

**돌진형 스킬 (blood_rush, guardian_rush, holy_charge, shadow_slash)**
```
프레임 0 (0ms)     : 스킬 시전 시작, 캐릭터 준비 자세
프레임 1 (50ms)    : 돌진 시작, 잔상 이펙트 생성 시작
프레임 2-10 (100-500ms) : 돌진 중, 매 프레임 잔상 생성
프레임 11 (550ms)  : 돌진 종료, 종료 이펙트 발생
프레임 12 (600ms)  : 캐릭터 원래 자세 복귀

타이밍:
├─ 0ms: 시전 시작
├─ 50ms: 이동 시작 + 잔상 시작
├─ 500ms: 이동 완료
├─ 550ms: 히트 판정 + 종료 이펙트
└─ 600ms: 스킬 종료
```

**버프형 스킬 (rage, shield, arrow_storm, spring_of_life)**
```
프레임 0 (0ms)     : 스킬 시전, 버프 시작 이펙트
프레임 1 (200ms)   : 오라 확산 애니메이션
프레임 2 (400ms)   : 오라 최대 크기
프레임 3 (500ms)   : 오라 안정화, 지속 이펙트 시작
... (지속 시간 동안 오라 유지)
프레임 N (종료 500ms 전) : 오라 페이드 아웃 시작
프레임 N+1 (종료)  : 버프 종료, 이펙트 제거

타이밍 (예: 10초 버프):
├─ 0ms: 버프 시작
├─ 500ms: 오라 안정화
├─ 9500ms: 페이드 아웃 시작
└─ 10000ms: 버프 종료
```

**투사체형 스킬 (backflip_shot, multi_arrow, inferno, healing_light)**
```
프레임 0 (0ms)     : 시전 동작 시작
프레임 1 (100ms)   : 투사체 생성
프레임 2 (150ms)   : 투사체 발사, 발사 이펙트
프레임 3-N        : 투사체 이동 (속도에 따라)
프레임 N+1        : 투사체 적중/소멸, 적중 이펙트

타이밍:
├─ 0ms: 시전 시작
├─ 100ms: 투사체 생성
├─ 150ms: 발사 이펙트
├─ 150ms~: 투사체 이동 (속도: 800px/s)
└─ 적중 시: 폭발/적중 이펙트 (300ms)
```

**채널링 스킬 (snipe)**
```
프레임 0 (0ms)     : 조준 시작, 캐릭터 정지
프레임 1 (100ms)   : 조준선 등장 (페이드 인)
프레임 2-N (100ms-3000ms) : 조준선 유지, 조준 이펙트
프레임 N+1 (3000ms): 발사, 강력한 섬광
프레임 N+2 (3100ms): 탄환 즉시 적중, 적중 이펙트
프레임 N+3 (3300ms): 캐릭터 정상 복귀

타이밍:
├─ 0ms: 조준 시작 (이동 불가)
├─ 100ms: 조준선 표시
├─ 3000ms: 발사 + 섬광
├─ 3100ms: 적중 판정
└─ 3300ms: 스킬 종료
```

**범위 지속 스킬 (dark_blade, meteor_shower)**
```
dark_blade:
├─ 0ms: 암흑 오라 발생
├─ 200ms: 칼날 회전 시작
├─ 200ms-5000ms: 매 500ms마다 데미지 판정
└─ 5000ms: 오라 소멸 (300ms 페이드 아웃)

meteor_shower:
├─ 0ms: 하늘 어두워짐
├─ 500ms: 첫 번째 운석 낙하 시작
├─ 500ms-5000ms: 500ms 간격으로 운석 10개 낙하
│   └─ 각 운석: 낙하 예고 원(500ms) → 낙하(300ms) → 폭발(200ms)
└─ 5500ms: 하늘 원래대로
```

#### 7.6 이펙트 타이밍 다이어그램

**돌진 스킬 타이밍**
```
시간(ms)  0    100   200   300   400   500   600
          |-----|-----|-----|-----|-----|-----|
시전      ████
이동           ████████████████████████
잔상           ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
히트판정                              ████
종료이펙트                            ████████
```

**버프 스킬 타이밍 (10초 기준)**
```
시간(s)   0    1    2    3    4    5    6    7    8    9    10
          |----|----|----|----|----|----|----|----|----|----|
시작이펙트████
오라확산  ████████
오라유지       ████████████████████████████████████████
페이드아웃                                          ████████
버프효과  ████████████████████████████████████████████████████
```

**투사체 스킬 타이밍**
```
시간(ms)  0    100   200   300   400   500   600   700
          |-----|-----|-----|-----|-----|-----|-----|
시전동작  ████████
투사체생성     ████
발사이펙트     ████
투사체이동          ████████████████████████████████→
적중이펙트                              (적중 시) ████████
```

#### 7.7 스프라이트/이미지 에셋 목록

**공통 에셋**
```
public/img/effects/
├── common/
│   ├── hit_spark.png          # 기본 타격 스파크 (64x64, 8프레임)
│   ├── heal_particle.png      # 치유 파티클 (32x32, 4프레임)
│   ├── buff_glow.png          # 버프 글로우 (128x128)
│   ├── shield_bubble.png      # 보호막 버블 (96x96)
│   └── stun_star.png          # 기절 별 (32x32, 4프레임)
```

**직업별 에셋**
```
public/img/effects/
├── berserker/
│   ├── blood_trail.png        # 피의 돌진 잔상 (64x64, 6프레임)
│   ├── rage_aura.png          # 광란 오라 (128x128, 4프레임)
│   └── rage_particle.png      # 광란 파티클 (16x16)
│
├── guardian/
│   ├── gold_trail.png         # 수호의 돌진 잔상 (64x64, 6프레임)
│   ├── shield_dome.png        # 보호막 돔 (256x256, 8프레임)
│   └── shield_aura.png        # 개인 보호막 (96x96)
│
├── sniper/
│   ├── aim_line.png           # 조준선 (16x512)
│   ├── snipe_flash.png        # 저격 섬광 (128x128, 4프레임)
│   ├── backflip_arrow.png     # 후방 도약 화살 (48x16)
│   └── speed_trail.png        # 이동속도 잔상 (32x32)
│
├── ranger/
│   ├── multi_arrow.png        # 다중 화살 (32x8)
│   ├── wind_aura.png          # 화살 폭풍 오라 (128x128, 4프레임)
│   └── arrow_trail.png        # 화살 궤적 (64x8)
│
├── paladin/
│   ├── holy_trail.png         # 신성한 돌진 잔상 (64x64, 6프레임)
│   ├── heal_wave.png          # 치유 파동 (192x192, 6프레임)
│   ├── divine_pillar.png      # 빛 기둥 (64x256, 8프레임)
│   └── invincible_shield.png  # 무적 실드 (96x96, 4프레임)
│
├── dark_knight/
│   ├── shadow_trail.png       # 암흑 베기 잔상 (64x64, 6프레임)
│   ├── dark_aura.png          # 어둠의 칼날 오라 (256x256, 8프레임)
│   ├── dark_blade.png         # 회전 칼날 (48x48, 8프레임)
│   └── lifesteal_particle.png # 흡혈 파티클 (16x16)
│
├── archmage/
│   ├── inferno_ball.png       # 폭발 화염구 (96x96, 6프레임)
│   ├── fire_explosion.png     # 화염 폭발 (128x128, 8프레임)
│   ├── burn_effect.png        # 화상 이펙트 (32x32, 4프레임)
│   ├── meteor.png             # 운석 (64x64)
│   ├── meteor_shadow.png      # 운석 그림자/예고 (96x96)
│   └── meteor_explosion.png   # 운석 폭발 (128x128, 8프레임)
│
└── healer/
    ├── heal_light.png         # 치유의 빛 (192x192, 6프레임)
    ├── heal_aura.png          # 생명의 샘 오라 (256x256, 4프레임)
    └── regen_particle.png     # 재생 파티클 (16x16)
```

**에셋 스펙**
| 에셋 유형 | 권장 크기 | 프레임 수 | 포맷 |
|-----------|-----------|-----------|------|
| 캐릭터 잔상 | 64x64 | 6 | PNG (투명) |
| 오라/버프 | 128x128 | 4-8 | PNG (투명) |
| 파티클 | 16x16~32x32 | 1-4 | PNG (투명) |
| 투사체 | 32x16~96x96 | 1-6 | PNG (투명) |
| 폭발/이펙트 | 128x128 | 6-8 | PNG (투명) |
| 범위 표시 | 다양 | 1 | PNG (반투명) |

#### 7.8 Canvas 렌더링 레이어 구조

```typescript
// 렌더링 레이어 순서 (아래 → 위)
enum RenderLayer {
  BACKGROUND = 0,        // 배경
  GROUND_EFFECTS = 1,    // 바닥 이펙트 (그림자, 범위 표시)
  ENTITIES = 2,          // 캐릭터, 적, 투사체
  ENTITY_EFFECTS = 3,    // 캐릭터에 붙는 이펙트 (오라, 버프)
  PROJECTILES = 4,       // 투사체
  TOP_EFFECTS = 5,       // 상단 이펙트 (폭발, 번개)
  UI_EFFECTS = 6,        // UI 이펙트 (데미지 숫자, 텍스트)
}

// 레이어별 렌더링 예시
interface SkillRenderConfig {
  skillId: string;
  layers: {
    layer: RenderLayer;
    effectType: string;
    zOffset?: number;  // 같은 레이어 내 순서
  }[];
}

// 예: 암흑 베기 (shadow_slash)
const shadowSlashRender: SkillRenderConfig = {
  skillId: 'shadow_slash',
  layers: [
    { layer: RenderLayer.GROUND_EFFECTS, effectType: 'shadow_trail_ground' },
    { layer: RenderLayer.ENTITY_EFFECTS, effectType: 'shadow_trail_air', zOffset: 1 },
    { layer: RenderLayer.TOP_EFFECTS, effectType: 'slash_effect' },
  ]
};
```

**레이어별 이펙트 분류**
| 레이어 | 이펙트 종류 | 예시 |
|--------|-------------|------|
| GROUND_EFFECTS | 바닥 표시, 그림자 | 운석 낙하 예고, 범위 스킬 영역 |
| ENTITY_EFFECTS | 캐릭터 부착 | 오라, 버프 표시, 보호막 |
| PROJECTILES | 투사체 | 화살, 화염구, 치유의 빛 |
| TOP_EFFECTS | 상단 이펙트 | 폭발, 번개, 빛 기둥 |
| UI_EFFECTS | UI 요소 | 데미지 숫자, 힐 숫자, 상태 텍스트 |

#### 7.9 이펙트 페이드 효과

**페이드 인/아웃 설정**
```typescript
interface FadeConfig {
  fadeIn: number;    // 페이드 인 시간 (ms)
  fadeOut: number;   // 페이드 아웃 시간 (ms)
  holdTime?: number; // 유지 시간 (ms), 선택적
}

// 스킬별 페이드 설정
const skillFadeConfigs: Record<string, FadeConfig> = {
  // 돌진 잔상: 빠르게 나타나고 서서히 사라짐
  'dash_trail': { fadeIn: 0, fadeOut: 300 },

  // 버프 오라: 서서히 나타나고 서서히 사라짐
  'buff_aura': { fadeIn: 200, fadeOut: 500 },

  // 폭발: 즉시 나타나고 빠르게 사라짐
  'explosion': { fadeIn: 0, fadeOut: 200 },

  // 보호막: 서서히 나타나고 유지 후 서서히 사라짐
  'shield': { fadeIn: 300, fadeOut: 300, holdTime: 5000 },

  // 조준선: 서서히 나타나고 즉시 사라짐
  'aim_line': { fadeIn: 100, fadeOut: 0 },
};
```

**페이드 적용 함수**
```typescript
function applyFade(
  ctx: CanvasRenderingContext2D,
  config: FadeConfig,
  elapsedTime: number,
  totalDuration: number
): number {
  // 페이드 인 구간
  if (elapsedTime < config.fadeIn) {
    return elapsedTime / config.fadeIn;
  }

  // 페이드 아웃 구간
  const fadeOutStart = totalDuration - config.fadeOut;
  if (elapsedTime > fadeOutStart) {
    return 1 - (elapsedTime - fadeOutStart) / config.fadeOut;
  }

  // 유지 구간
  return 1;
}
```

#### 7.10 스킬별 상세 이펙트 명세

**버서커 - 피의 돌진 (blood_rush)**
```
[시작 이펙트]
- 타입: 파티클 버스트
- 색상: #FF3333 (붉은색)
- 파티클 수: 20개
- 지속: 200ms

[이동 중 잔상]
- 타입: 스프라이트 트레일
- 스프라이트: blood_trail.png
- 간격: 30px마다 1개
- 페이드: 300ms
- 블렌드: additive

[히트 이펙트]
- 타입: 스프라이트 애니메이션
- 스프라이트: hit_spark.png (붉은색 틴트)
- 크기: 64x64
- 재생시간: 200ms

[흡혈 이펙트]
- 타입: 파티클 → 캐릭터 수렴
- 색상: #FF0000
- 파티클 수: 10개
- 이동시간: 300ms
```

**가디언 - 보호막 (shield)**
```
[시전 이펙트]
- 타입: 원형 확산
- 스프라이트: shield_dome.png
- 시작 크기: 0%
- 최종 크기: 100%
- 확산 시간: 400ms

[개인 보호막]
- 타입: 캐릭터 부착 스프라이트
- 스프라이트: shield_aura.png
- 크기: 캐릭터 크기 × 1.5
- 애니메이션: 천천히 회전 (360도/3초)
- 색상: 금색 (#FFD700), 50% 투명

[보호막 피격 시]
- 타입: 파티클 튀김
- 색상: #FFD700
- 파티클 수: 5개
- 방향: 피격 반대 방향
```

**저격수 - 저격 (snipe)**
```
[조준선]
- 타입: 라인 렌더링
- 색상: #00FFFF → #FF0000 (시간에 따라 변화)
- 두께: 2px
- 점멸: 200ms 간격
- 길이: 캐릭터 → 화면 끝

[조준 완료 표시]
- 타입: 타겟 마커
- 스프라이트: target_marker.png
- 크기: 48x48
- 애니메이션: 수축 (100% → 50% → 100%, 500ms)

[발사 섬광]
- 타입: 화면 플래시
- 색상: #FFFFFF
- 불투명도: 0 → 80% → 0
- 지속: 100ms

[탄환 궤적]
- 타입: 즉시 라인
- 색상: #00FFFF
- 두께: 4px → 1px (페이드)
- 지속: 200ms
```

**대마법사 - 메테오 샤워 (meteor_shower)**
```
[하늘 어두워짐]
- 타입: 화면 오버레이
- 색상: #000000
- 불투명도: 0 → 30%
- 지속: 전체 스킬 시간

[운석 낙하 예고]
- 타입: 바닥 원형 표시
- 스프라이트: meteor_shadow.png
- 크기: 0% → 100% (500ms)
- 색상: #FF6600, 50% 투명

[운석 낙하]
- 타입: 스프라이트 이동
- 스프라이트: meteor.png
- 시작: 화면 상단 + 100px
- 종료: 예고 위치
- 이동시간: 300ms
- 회전: 720도 (2바퀴)

[운석 폭발]
- 타입: 스프라이트 애니메이션
- 스프라이트: meteor_explosion.png
- 크기: 128x128
- 프레임: 8
- 재생시간: 400ms

[화면 흔들림]
- 타입: 카메라 셰이크
- 강도: 5px
- 지속: 200ms (각 운석마다)
```

---

### 8. 알림 시스템 계획

#### 8.1 전직 관련 알림

| 상황 | 알림 메시지 | 표시 방식 |
|------|-------------|-----------|
| 레벨 15 도달 | "전직이 가능합니다!" | 화면 상단 배너 + 프로필 아이콘 표시 |
| 전직 완료 | "[버서커]로 전직 완료!" | 화면 중앙 대형 텍스트 |
| 레벨 50 도달 (자동 강화) | "2차 강화 완료!" | 화면 중앙 대형 텍스트 + 강화 연출 |

#### 8.2 알림 UI 컴포넌트
```
src/components/RPG/
├── NotificationBanner.tsx    # 상단 알림 배너
├── NotificationPopup.tsx     # 중앙 팝업 알림
└── ProfileBadge.tsx          # 프로필 알림 뱃지
```

#### 8.3 알림 표시 흐름
```
1. 레벨업 체크
   └─ 레벨 15 도달 && 미전직 → 전직 가능 알림
   └─ 레벨 50 도달 && tier === 1 → 자동 2차 강화 실행 + 완료 알림

2. 전직 가능 알림 (레벨 15)
   └─ NotificationBanner 표시 (3초간)
   └─ ProfileBadge에 빨간 점 표시 (클릭 전까지 유지)

3. 2차 강화 알림 (레벨 50, 자동)
   └─ 강화 연출 재생
   └─ NotificationPopup 표시 ("2차 강화 완료!")
   └─ 효과음 재생

4. 프로필 클릭 시 (전직 가능 상태)
   └─ 전직 버튼 하이라이트
   └─ ProfileBadge 숨김
```

---

### 9. 사운드 계획

#### 9.1 사운드 목록

| 카테고리 | 사운드 | 파일명 | 설명 |
|----------|--------|--------|------|
| 전직 | 전직 시작 | `advancement_start.mp3` | 전직 연출 시작 시 |
| 전직 | 전직 완료 | `advancement_complete.mp3` | 전직 완료 시 팡파레 |
| 2차 강화 | 강화 완료 | `enhancement_complete.mp3` | 2차 강화 완료 시 |
| 스킬 | 돌진 | `skill_dash.mp3` | 돌진형 스킬 공통 |
| 스킬 | 버프 | `skill_buff.mp3` | 버프형 스킬 공통 |
| 스킬 | 화염 | `skill_fire.mp3` | 화염 스킬 |
| 스킬 | 신성 | `skill_holy.mp3` | 신성 스킬 |
| 스킬 | 암흑 | `skill_dark.mp3` | 암흑 스킬 |
| 스킬 | 치유 | `skill_heal.mp3` | 치유 스킬 |
| 스킬 | 화살 | `skill_arrow.mp3` | 화살 스킬 |
| UI | 버튼 클릭 | `ui_click.mp3` | 전직 버튼 클릭 |
| UI | 알림 | `ui_notification.mp3` | 알림 표시 시 |

#### 9.2 사운드 매니저
```typescript
class SoundManager {
  private sounds: Map<string, HTMLAudioElement> = new Map();

  preload(soundList: string[]): Promise<void>;
  play(soundId: string, volume?: number): void;
  stop(soundId: string): void;
  setMasterVolume(volume: number): void;
}
```

#### 9.3 사운드 경로
```
public/sounds/
├── advancement/
│   ├── advancement_start.mp3
│   └── advancement_complete.mp3
├── skills/
│   ├── skill_dash.mp3
│   ├── skill_buff.mp3
│   └── ...
└── ui/
    ├── ui_click.mp3
    └── ui_notification.mp3
```

---

### 10. 서버 연동 계획

#### 10.1 캐릭터 정보 구조 (기존 + 추가)
```typescript
// 방 입장 시 전송되는 캐릭터 정보
interface CharacterInfo {
  // 기존 필드
  id: string;
  name: string;
  class: HeroClass;           // 기본 직업 (warrior, archer, knight, mage)
  level: number;
  spUpgrades: SPUpgrades;     // SP 강화 상태

  // 추가 필드 (전직 관련)
  advancedClass: AdvancedHeroClass | null;  // 전직 직업 (null = 미전직)
  tier: 1 | 2;                               // 1 = 1차 전직, 2 = 2차 강화
}

interface SPUpgrades {
  hp: number;
  attack: number;
  attackSpeed: number;
  speed: number;
  range: number;
}
```

#### 10.2 서버 로그 형식
```
// 방 입장 시 로그 (기존)
[Room:abc123] Player joined: user1
  - Class: warrior
  - Level: 25
  - SP: HP+5, ATK+3, ASPD+2

// 방 입장 시 로그 (전직 정보 추가)
[Room:abc123] Player joined: user1
  - Class: warrior → berserker (Tier 2)
  - Level: 55
  - SP: HP+5, ATK+3, ASPD+2
  - Advanced: Yes (berserker, 2차 강화)

// 미전직 플레이어
[Room:abc123] Player joined: user2
  - Class: mage
  - Level: 10
  - SP: HP+2, ATK+1
  - Advanced: No
```

#### 10.3 서버 메시지 타입
```typescript
// 클라이언트 → 서버: 방 입장 시
interface JoinRoomMessage {
  type: 'join_room';
  roomId: string;
  character: CharacterInfo;
}

// 서버 → 클라이언트: 다른 플레이어 정보
interface PlayerInfoMessage {
  type: 'player_info';
  playerId: string;
  character: CharacterInfo;
}

// 클라이언트 → 서버: 전직 완료 알림
interface AdvancementMessage {
  type: 'advancement';
  advancedClass: AdvancedHeroClass;
  tier: 1 | 2;
}

// 서버 → 클라이언트: 다른 플레이어 전직 알림
interface PlayerAdvancedMessage {
  type: 'player_advanced';
  playerId: string;
  advancedClass: AdvancedHeroClass;
  tier: 1 | 2;
}
```

#### 10.4 인게임 반영 흐름
```
1. 방 입장 시
   └─ 클라이언트: CharacterInfo 전송 (전직 정보 포함)
   └─ 서버: 로그 출력 + 다른 플레이어들에게 브로드캐스트
   └─ 다른 클라이언트: 해당 플레이어의 전직 외형/스탯 반영

2. 게임 중 전직 시
   └─ 클라이언트: AdvancementMessage 전송
   └─ 서버: 로그 출력 + 다른 플레이어들에게 브로드캐스트
   └─ 다른 클라이언트: 해당 플레이어의 외형 즉시 변경

3. 게임 중 2차 강화 시 (레벨 50 자동)
   └─ 클라이언트: AdvancementMessage 전송 (tier: 2)
   └─ 서버: 로그 출력 + 다른 플레이어들에게 브로드캐스트
   └─ 다른 클라이언트: 해당 플레이어의 2차 외형으로 변경
```

#### 10.5 서버 파일 수정 목록
```
server/
├── src/
│   ├── types/
│   │   └── messages.ts      # 메시지 타입 추가
│   ├── handlers/
│   │   └── roomHandler.ts   # 방 입장 로그 수정
│   └── utils/
│       └── logger.ts        # 로그 포맷 수정
```

#### 10.6 서버 로그 테스트 체크리스트
- [ ] 미전직 플레이어 입장 시 로그 정상 출력
- [ ] 1차 전직 플레이어 입장 시 전직 직업 표시
- [ ] 2차 강화 플레이어 입장 시 Tier 2 표시
- [ ] 게임 중 전직 시 실시간 로그 출력
- [ ] 게임 중 2차 강화 시 실시간 로그 출력
- [ ] 다른 플레이어에게 전직 정보 정상 전달

---

### 10-2. 호스트/클라이언트 동기화 계획

#### 10-2.1 멀티플레이 아키텍처
```
┌─────────────────────────────────────────────────────────┐
│                       서버                              │
│  - 방 관리, 플레이어 연결 관리                          │
│  - 메시지 릴레이 (브로드캐스트)                         │
└─────────────────────────────────────────────────────────┘
        ↑                                    ↑
        │                                    │
┌───────┴───────┐                  ┌─────────┴───────┐
│    호스트     │                  │    클라이언트    │
│  - 게임 로직  │  ←── 동기화 ──→  │  - 상태 수신    │
│  - 상태 관리  │                  │  - 입력 전송    │
└───────────────┘                  └─────────────────┘
```

#### 10-2.2 전직 동기화 시나리오

**시나리오 A: 호스트가 전직하는 경우**
```
1. 호스트: 전직 UI에서 직업 선택
2. 호스트: advanceJob() 실행
   └─ 로컬 상태 업데이트 (advancedClass, tier, 스탯, 스킬)
   └─ 외형 변경
3. 호스트 → 서버: AdvancementMessage 전송
4. 서버 → 클라이언트들: PlayerAdvancedMessage 브로드캐스트
5. 클라이언트: 호스트 캐릭터 외형/스탯 업데이트
```

**시나리오 B: 클라이언트가 전직하는 경우**
```
1. 클라이언트: 전직 UI에서 직업 선택
2. 클라이언트 → 서버: AdvancementRequestMessage 전송
3. 서버 → 호스트: AdvancementRequestMessage 전달
4. 호스트: 해당 클라이언트의 advanceJob() 실행
   └─ 게임 상태에서 해당 플레이어 정보 업데이트
5. 호스트 → 서버: PlayerAdvancedMessage 전송
6. 서버 → 모든 클라이언트: PlayerAdvancedMessage 브로드캐스트
7. 클라이언트들: 해당 플레이어 외형/스탯 업데이트
```

**시나리오 C: 호스트가 레벨 50 도달 (자동 2차 강화)**
```
1. 호스트: 레벨업 → 레벨 50 도달 감지
2. 호스트: 자동으로 enhanceJob() 실행
   └─ 로컬 상태 업데이트 (tier = 2, 스탯 20% 증가)
   └─ 2차 외형 변경
   └─ 알림 표시
3. 호스트 → 서버: AdvancementMessage (tier: 2) 전송
4. 서버 → 클라이언트들: PlayerAdvancedMessage 브로드캐스트
5. 클라이언트: 호스트 캐릭터 2차 외형으로 업데이트
```

**시나리오 D: 클라이언트가 레벨 50 도달 (자동 2차 강화)**
```
1. 호스트: 클라이언트 캐릭터 레벨업 처리 → 레벨 50 도달 감지
2. 호스트: 해당 클라이언트의 enhanceJob() 실행
   └─ 게임 상태에서 해당 플레이어 정보 업데이트
3. 호스트 → 서버: PlayerAdvancedMessage (tier: 2) 전송
4. 서버 → 모든 클라이언트: PlayerAdvancedMessage 브로드캐스트
5. 해당 클라이언트: 2차 강화 알림 표시 + 외형 변경
6. 다른 클라이언트들: 해당 플레이어 2차 외형으로 업데이트
```

#### 10-2.3 동기화 메시지 타입
```typescript
// 전직 요청 (클라이언트 → 호스트)
interface AdvancementRequestMessage {
  type: 'advancement_request';
  playerId: string;
  advancedClass: AdvancedHeroClass;
}

// 전직 완료 알림 (호스트 → 모두)
interface PlayerAdvancedMessage {
  type: 'player_advanced';
  playerId: string;
  advancedClass: AdvancedHeroClass;
  tier: 1 | 2;
  newStats: HeroStats;  // 변경된 스탯 정보
}

// 게임 상태 동기화 (호스트 → 클라이언트)
interface GameStateSyncMessage {
  type: 'game_state_sync';
  heroes: {
    [playerId: string]: {
      // 기존 필드
      class: HeroClass;
      level: number;
      hp: number;
      // 전직 관련 추가 필드
      advancedClass: AdvancedHeroClass | null;
      tier: 1 | 2;
      // 기본 스탯 (V1.17.18+, 업그레이드 계산용)
      baseAttack: number;
      baseSpeed: number;
      baseAttackSpeed: number;
    };
  };
}
```

#### 10-2.4 상태 관리 규칙
| 항목 | 호스트 | 클라이언트 |
|------|--------|------------|
| 전직 실행 | 직접 실행 | 호스트에게 요청 |
| 2차 강화 (자동) | 직접 실행 | 호스트가 대신 실행 |
| 스탯 계산 | 직접 계산 | 호스트로부터 수신 |
| 외형 변경 | 직접 변경 | 동기화 메시지 수신 후 변경 |
| 스킬 사용 | 직접 처리 | 호스트가 처리 |

#### 10-2.5 구현 코드 구조
```typescript
// useRPGStore.ts
advanceJob: (heroId: string, advancedClass: AdvancedHeroClass) => {
  const state = get();
  const isHost = state.isHost;
  const isMyHero = heroId === state.myHeroId;

  if (isHost) {
    // 호스트: 직접 전직 처리
    performAdvancement(heroId, advancedClass);
    broadcastAdvancement(heroId, advancedClass);
  } else if (isMyHero) {
    // 클라이언트 본인: 호스트에게 요청
    sendAdvancementRequest(advancedClass);
  }
  // 클라이언트가 다른 플레이어 전직은 불가 (호스트만 처리)
};

// 호스트가 클라이언트 전직 요청 처리
handleAdvancementRequest: (playerId: string, advancedClass: AdvancedHeroClass) => {
  if (!get().isHost) return;

  performAdvancement(playerId, advancedClass);
  broadcastAdvancement(playerId, advancedClass);
};

// 전직 브로드캐스트 수신 처리
handlePlayerAdvanced: (playerId: string, advancedClass: AdvancedHeroClass, tier: number) => {
  // 해당 플레이어의 외형/스탯 업데이트
  updateHeroAppearance(playerId, advancedClass, tier);

  // 본인이면 알림 표시
  if (playerId === get().myHeroId) {
    showAdvancementNotification(advancedClass, tier);
  }
};
```

#### 10-2.6 호스트/클라이언트 테스트 체크리스트

**호스트 테스트**
- [ ] 호스트 전직 시 본인 외형/스탯 변경
- [ ] 호스트 전직 시 클라이언트에 동기화
- [ ] 호스트 레벨 50 시 자동 2차 강화
- [ ] 호스트 2차 강화 시 클라이언트에 동기화
- [ ] 클라이언트 전직 요청 수신 및 처리
- [ ] 클라이언트 레벨 50 도달 시 자동 2차 강화 처리

**클라이언트 테스트**
- [ ] 클라이언트 전직 요청 전송
- [ ] 전직 완료 메시지 수신 후 외형 변경
- [ ] 전직 완료 알림 표시
- [ ] 레벨 50 시 호스트로부터 2차 강화 수신
- [ ] 2차 강화 알림 표시
- [ ] 다른 플레이어 전직/강화 시 외형 업데이트

**동기화 테스트**
- [ ] 방 입장 시 기존 전직 상태 로드
- [ ] 게임 중 전직 실시간 동기화
- [ ] 연결 끊김 후 재접속 시 전직 상태 유지
- [ ] 호스트 변경 시 전직 상태 유지

---

### 11. 최종 구현 우선순위

| 순서 | 항목 | 필요도 | 의존성 |
|------|------|--------|--------|
| 1 | 타입 및 설정 추가 | 필수 | 없음 |
| 2 | 전직 로직 구현 | 필수 | 1 |
| 3 | 전직 UI 구현 | 필수 | 2 |
| 4 | 스킬 로직 구현 | 필수 | 2 |
| 5 | 2차 강화 로직 구현 | 필수 | 2 |
| 6 | 2차 강화 UI 구현 | 필수 | 5 |
| 7 | 서버 연동 (로그/동기화) | 필수 | 2, 5 |
| 8 | 멀티플레이 동기화 | 필수 | 7 |
| 9 | 스킬 이펙트/애니메이션 | 중간 | 4 |
| 10 | 전직/강화 연출 | 중간 | 3, 6 |
| 11 | 알림 시스템 | 중간 | 3, 6 |
| 12 | 사운드 추가 | 낮음 | 9, 10, 11 |
| 13 | 테스트 및 밸런싱 | 필수 | 전체 |

---

### 12. 에러 처리 계획

#### 12.1 에러 유형 분류

| 에러 유형 | 설명 | 심각도 |
|-----------|------|--------|
| 조건 미충족 | 레벨 부족, 이미 전직됨 | 낮음 |
| 네트워크 오류 | 전직 요청/응답 실패 | 중간 |
| 상태 불일치 | 호스트-클라이언트 데이터 불일치 | 높음 |
| 데이터 손상 | 저장된 전직 정보 손상 | 높음 |

#### 12.2 에러별 처리 방법

**조건 미충족 에러**
```typescript
enum AdvancementError {
  LEVEL_TOO_LOW = 'LEVEL_TOO_LOW',           // 레벨 부족
  ALREADY_ADVANCED = 'ALREADY_ADVANCED',     // 이미 전직됨
  INVALID_CLASS = 'INVALID_CLASS',           // 잘못된 전직 직업 선택
  ALREADY_ENHANCED = 'ALREADY_ENHANCED',     // 이미 2차 강화됨
  NOT_ADVANCED_YET = 'NOT_ADVANCED_YET',     // 1차 전직 안됨 (2차 강화 시도 시)
}

function validateAdvancement(hero: Hero, targetClass: AdvancedHeroClass): AdvancementError | null {
  if (hero.level < 15) return AdvancementError.LEVEL_TOO_LOW;
  if (hero.advancedClass !== null) return AdvancementError.ALREADY_ADVANCED;
  if (!isValidAdvancementPath(hero.class, targetClass)) return AdvancementError.INVALID_CLASS;
  return null;
}

// 에러 메시지 표시
const errorMessages: Record<AdvancementError, string> = {
  LEVEL_TOO_LOW: '레벨 15 이상이어야 전직할 수 있습니다.',
  ALREADY_ADVANCED: '이미 전직을 완료했습니다.',
  INVALID_CLASS: '해당 직업으로 전직할 수 없습니다.',
  ALREADY_ENHANCED: '이미 2차 강화를 완료했습니다.',
  NOT_ADVANCED_YET: '1차 전직을 먼저 완료해야 합니다.',
};
```

**네트워크 오류 처리**
```typescript
// 전직 요청 with 재시도
async function requestAdvancement(advancedClass: AdvancedHeroClass): Promise<boolean> {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000; // 1초

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await sendAdvancementRequest(advancedClass);
      return true;
    } catch (error) {
      console.error(`전직 요청 실패 (시도 ${attempt}/${MAX_RETRIES}):`, error);

      if (attempt < MAX_RETRIES) {
        await delay(RETRY_DELAY * attempt); // 점진적 대기
      }
    }
  }

  // 최종 실패
  showErrorNotification('네트워크 오류로 전직에 실패했습니다. 다시 시도해주세요.');
  return false;
}

// 타임아웃 처리
const ADVANCEMENT_TIMEOUT = 10000; // 10초

async function advanceWithTimeout(advancedClass: AdvancedHeroClass): Promise<boolean> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('TIMEOUT')), ADVANCEMENT_TIMEOUT);
  });

  try {
    await Promise.race([
      requestAdvancement(advancedClass),
      timeoutPromise
    ]);
    return true;
  } catch (error) {
    if (error.message === 'TIMEOUT') {
      showErrorNotification('서버 응답 시간이 초과되었습니다.');
    }
    return false;
  }
}
```

**상태 불일치 복구**
```typescript
// 상태 검증 및 복구
function validateAndSyncState(localHero: Hero, serverHero: HeroServerData): Hero {
  const inconsistencies: string[] = [];

  // 전직 상태 불일치 검사
  if (localHero.advancedClass !== serverHero.advancedClass) {
    inconsistencies.push('advancedClass');
  }
  if (localHero.tier !== serverHero.tier) {
    inconsistencies.push('tier');
  }

  if (inconsistencies.length > 0) {
    console.warn('상태 불일치 감지:', inconsistencies);

    // 서버 데이터를 신뢰하여 로컬 상태 복구
    return {
      ...localHero,
      advancedClass: serverHero.advancedClass,
      tier: serverHero.tier,
      // 스탯 재계산
      ...recalculateStats(serverHero),
    };
  }

  return localHero;
}

// 주기적 상태 동기화 (멀티플레이)
function startPeriodicSync(intervalMs: number = 30000) {
  setInterval(async () => {
    const serverState = await fetchServerState();
    const localHero = getLocalHero();

    const syncedHero = validateAndSyncState(localHero, serverState.hero);
    if (syncedHero !== localHero) {
      updateLocalHero(syncedHero);
      showNotification('서버와 상태를 동기화했습니다.');
    }
  }, intervalMs);
}
```

**데이터 손상 복구**
```typescript
// 저장 데이터 유효성 검사
function validateSavedData(data: SavedHeroData): boolean {
  // 필수 필드 존재 확인
  if (!data.class || !data.level) return false;

  // 전직 데이터 정합성 확인
  if (data.advancedClass !== null) {
    // 전직했으면 tier는 1 또는 2여야 함
    if (data.tier !== 1 && data.tier !== 2) return false;

    // 전직 경로 유효성 확인
    if (!isValidAdvancementPath(data.class, data.advancedClass)) return false;

    // 2차 강화 조건 확인
    if (data.tier === 2 && data.level < 50) return false;
  } else {
    // 미전직이면 tier는 의미 없음 (기본값 유지)
    if (data.tier === 2) return false;
  }

  return true;
}

// 손상된 데이터 복구
function repairCorruptedData(data: SavedHeroData): SavedHeroData {
  const repaired = { ...data };

  // 기본값으로 복구
  if (!repaired.advancedClass) {
    repaired.advancedClass = null;
    repaired.tier = 1;
  }

  // 레벨에 맞지 않는 tier 수정
  if (repaired.tier === 2 && repaired.level < 50) {
    repaired.tier = 1;
  }

  // 잘못된 전직 경로 초기화
  if (repaired.advancedClass && !isValidAdvancementPath(repaired.class, repaired.advancedClass)) {
    console.error('잘못된 전직 경로 감지, 초기화합니다.');
    repaired.advancedClass = null;
    repaired.tier = 1;
  }

  return repaired;
}
```

#### 12.3 사용자 피드백

| 상황 | 피드백 방식 | 메시지 예시 |
|------|-------------|-------------|
| 조건 미충족 | 토스트 알림 (3초) | "레벨 15 이상이어야 전직할 수 있습니다." |
| 네트워크 오류 | 토스트 알림 + 재시도 버튼 | "네트워크 오류가 발생했습니다. [재시도]" |
| 전직 성공 | 화면 중앙 알림 + 연출 | "버서커로 전직 완료!" |
| 상태 복구 | 작은 알림 | "서버와 동기화되었습니다." |

---

### 13. 엣지 케이스 처리

#### 13.1 전직 중 연결 끊김

**시나리오**: 플레이어가 전직 버튼을 누른 후 서버 응답 전에 연결이 끊김

```typescript
// 전직 진행 상태 추적
interface AdvancementState {
  inProgress: boolean;
  pendingClass: AdvancedHeroClass | null;
  requestTime: number | null;
}

// 재접속 시 미완료 전직 처리
async function handleReconnect() {
  const pendingAdvancement = localStorage.getItem('pendingAdvancement');

  if (pendingAdvancement) {
    const { advancedClass, requestTime } = JSON.parse(pendingAdvancement);

    // 요청 후 1분 이내면 서버 상태 확인
    if (Date.now() - requestTime < 60000) {
      const serverHero = await fetchServerHeroState();

      if (serverHero.advancedClass === advancedClass) {
        // 서버에 이미 반영됨 - 로컬 상태 업데이트
        applyAdvancement(advancedClass);
        showNotification('전직이 완료되었습니다!');
      } else {
        // 서버에 반영 안됨 - 재시도 제안
        showConfirmDialog('전직이 완료되지 않았습니다. 다시 시도하시겠습니까?',
          () => retryAdvancement(advancedClass)
        );
      }
    }

    localStorage.removeItem('pendingAdvancement');
  }
}

// 전직 요청 전 로컬 저장
function saveAdvancementIntent(advancedClass: AdvancedHeroClass) {
  localStorage.setItem('pendingAdvancement', JSON.stringify({
    advancedClass,
    requestTime: Date.now()
  }));
}

// 전직 완료 후 로컬 저장 삭제
function clearAdvancementIntent() {
  localStorage.removeItem('pendingAdvancement');
}
```

#### 13.2 동시 전직 요청 (Race Condition)

**시나리오**: 멀티플레이에서 같은 플레이어에 대해 동시에 전직 요청 발생

```typescript
// 호스트에서 뮤텍스 처리
class AdvancementMutex {
  private locks: Set<string> = new Set();

  async acquire(heroId: string): Promise<boolean> {
    if (this.locks.has(heroId)) {
      return false; // 이미 처리 중
    }
    this.locks.add(heroId);
    return true;
  }

  release(heroId: string) {
    this.locks.delete(heroId);
  }
}

const advancementMutex = new AdvancementMutex();

async function handleAdvancementRequest(heroId: string, advancedClass: AdvancedHeroClass) {
  // 락 획득 시도
  if (!await advancementMutex.acquire(heroId)) {
    console.warn(`전직 요청 무시됨 (처리 중): ${heroId}`);
    return { success: false, error: 'ALREADY_PROCESSING' };
  }

  try {
    // 전직 처리
    const result = performAdvancement(heroId, advancedClass);
    return result;
  } finally {
    // 락 해제
    advancementMutex.release(heroId);
  }
}
```

#### 13.3 호스트 변경 중 전직

**시나리오**: 전직 처리 중에 호스트가 나가서 다른 플레이어가 호스트가 됨

```typescript
// 호스트 변경 시 진행 중인 전직 처리
function handleHostMigration(newHostId: string) {
  if (newHostId === myPlayerId) {
    // 내가 새 호스트가 됨
    console.log('호스트 권한 획득');

    // 모든 플레이어 상태 검증
    for (const player of getAllPlayers()) {
      const validated = validatePlayerState(player);
      if (!validated) {
        // 상태 불일치 시 브로드캐스트하여 동기화
        broadcastPlayerState(player.id, getCanonicalState(player));
      }
    }
  }
}

// 진행 중인 전직 요청 복구
function recoverPendingAdvancements() {
  const pendingRequests = getPendingAdvancementRequests();

  for (const request of pendingRequests) {
    // 아직 완료되지 않은 요청 재처리
    if (!isAdvancementCompleted(request.heroId)) {
      console.log(`미완료 전직 요청 재처리: ${request.heroId}`);
      handleAdvancementRequest(request.heroId, request.advancedClass);
    }
  }
}
```

#### 13.4 레벨업과 전직 동시 발생

**시나리오**: 레벨 14→15 레벨업과 동시에 전직 버튼 클릭

```typescript
// 레벨업 처리 순서 보장
async function handleLevelUp(heroId: string, newLevel: number) {
  // 1. 레벨 업데이트
  updateHeroLevel(heroId, newLevel);

  // 2. 레벨 기반 이벤트 체크 (순차 처리)
  await processLevelEvents(heroId, newLevel);
}

async function processLevelEvents(heroId: string, level: number) {
  // 2차 강화 체크 (레벨 50)
  if (level >= 50) {
    const hero = getHero(heroId);
    if (hero.advancedClass && hero.tier === 1) {
      await performEnhancement(heroId);
    }
  }

  // 전직 가능 알림 (레벨 15)
  if (level === 15) {
    const hero = getHero(heroId);
    if (!hero.advancedClass) {
      showAdvancementAvailableNotification(heroId);
    }
  }
}
```

#### 13.5 전직 UI 열린 상태에서 조건 변경

**시나리오**: 전직 선택 UI가 열린 상태에서 다른 플레이어가 같은 캐릭터 조작

```typescript
// UI 열릴 때 상태 스냅샷 저장
function openAdvancementModal(heroId: string) {
  const hero = getHero(heroId);
  const snapshot = {
    level: hero.level,
    advancedClass: hero.advancedClass,
    timestamp: Date.now()
  };

  setModalState({ heroId, snapshot, isOpen: true });
}

// 전직 확인 시 상태 재검증
function confirmAdvancement(advancedClass: AdvancedHeroClass) {
  const { heroId, snapshot } = getModalState();
  const currentHero = getHero(heroId);

  // 상태 변경 감지
  if (currentHero.level !== snapshot.level ||
      currentHero.advancedClass !== snapshot.advancedClass) {
    showWarning('캐릭터 상태가 변경되었습니다. 다시 확인해주세요.');
    closeModal();
    return;
  }

  // 최종 검증 후 전직 실행
  const error = validateAdvancement(currentHero, advancedClass);
  if (error) {
    showError(errorMessages[error]);
    return;
  }

  performAdvancement(heroId, advancedClass);
  closeModal();
}
```

#### 13.6 엣지 케이스 테스트 체크리스트

- [ ] 전직 버튼 클릭 직후 연결 끊김 → 재접속 시 상태 확인
- [ ] 전직 UI 열린 상태에서 5분 방치 → UI 갱신 또는 경고
- [ ] 두 클라이언트에서 동시에 같은 캐릭터 전직 시도
- [ ] 호스트가 전직 처리 중 게임 나감
- [ ] 레벨 14.99에서 경험치 획득으로 15 도달과 동시에 전직 클릭
- [ ] 레벨 49에서 대량 경험치로 50 도달 시 자동 2차 강화
- [ ] 전직 연출 중 게임 일시정지
- [ ] 저장 데이터 손상 상태에서 게임 로드

---

### 14. 성능 최적화 계획

#### 14.1 이펙트 성능 최적화

**파티클 수 제한**
```typescript
const PARTICLE_LIMITS = {
  maxTotalParticles: 500,        // 전체 최대 파티클 수
  maxParticlesPerEffect: 100,    // 이펙트당 최대 파티클 수
  maxParticlesPerFrame: 20,      // 프레임당 최대 생성 수
};

class ParticleManager {
  private particles: Particle[] = [];

  addParticle(particle: Particle): boolean {
    // 전체 제한 체크
    if (this.particles.length >= PARTICLE_LIMITS.maxTotalParticles) {
      // 가장 오래된 파티클 제거
      this.particles.shift();
    }

    this.particles.push(particle);
    return true;
  }

  // 프레임당 생성 제한
  private frameParticleCount = 0;

  createParticles(count: number, factory: () => Particle): number {
    const available = PARTICLE_LIMITS.maxParticlesPerFrame - this.frameParticleCount;
    const toCreate = Math.min(count, available);

    for (let i = 0; i < toCreate; i++) {
      this.addParticle(factory());
    }

    this.frameParticleCount += toCreate;
    return toCreate;
  }

  resetFrameCount() {
    this.frameParticleCount = 0;
  }
}
```

**오브젝트 풀링**
```typescript
class ObjectPool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private reset: (obj: T) => void;

  constructor(factory: () => T, reset: (obj: T) => void, initialSize: number = 50) {
    this.factory = factory;
    this.reset = reset;

    // 미리 생성
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(factory());
    }
  }

  acquire(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.factory();
  }

  release(obj: T) {
    this.reset(obj);
    this.pool.push(obj);
  }
}

// 파티클 풀
const particlePool = new ObjectPool<Particle>(
  () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, color: '', size: 0 }),
  (p) => { p.life = 0; p.maxLife = 0; }
);

// 이펙트 풀
const effectPool = new ObjectPool<SkillEffect>(
  () => new SkillEffect(),
  (e) => e.reset()
);
```

**LOD (Level of Detail) 시스템**
```typescript
enum QualityLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

const qualitySettings: Record<QualityLevel, QualityConfig> = {
  low: {
    particleMultiplier: 0.3,      // 파티클 30%만
    effectFrameSkip: 2,           // 2프레임마다 업데이트
    disableShadows: true,
    disableGlow: true,
    maxVisibleEffects: 10,
  },
  medium: {
    particleMultiplier: 0.6,
    effectFrameSkip: 1,
    disableShadows: false,
    disableGlow: true,
    maxVisibleEffects: 20,
  },
  high: {
    particleMultiplier: 1.0,
    effectFrameSkip: 0,
    disableShadows: false,
    disableGlow: false,
    maxVisibleEffects: 50,
  },
};

// 자동 품질 조정
class AdaptiveQuality {
  private fpsHistory: number[] = [];
  private currentQuality: QualityLevel = QualityLevel.HIGH;

  update(fps: number) {
    this.fpsHistory.push(fps);
    if (this.fpsHistory.length > 60) {
      this.fpsHistory.shift();
    }

    const avgFps = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;

    // 자동 품질 조정
    if (avgFps < 30 && this.currentQuality !== QualityLevel.LOW) {
      this.downgrade();
    } else if (avgFps > 55 && this.currentQuality !== QualityLevel.HIGH) {
      this.upgrade();
    }
  }

  private downgrade() {
    if (this.currentQuality === QualityLevel.HIGH) {
      this.currentQuality = QualityLevel.MEDIUM;
    } else if (this.currentQuality === QualityLevel.MEDIUM) {
      this.currentQuality = QualityLevel.LOW;
    }
    console.log(`품질 하향: ${this.currentQuality}`);
  }

  private upgrade() {
    if (this.currentQuality === QualityLevel.LOW) {
      this.currentQuality = QualityLevel.MEDIUM;
    } else if (this.currentQuality === QualityLevel.MEDIUM) {
      this.currentQuality = QualityLevel.HIGH;
    }
    console.log(`품질 상향: ${this.currentQuality}`);
  }
}
```

#### 14.2 렌더링 최적화

**Canvas 레이어 분리**
```typescript
// 별도 캔버스로 레이어 분리
class LayeredRenderer {
  private layers: Map<RenderLayer, HTMLCanvasElement> = new Map();
  private contexts: Map<RenderLayer, CanvasRenderingContext2D> = new Map();

  constructor(width: number, height: number) {
    // 각 레이어별 캔버스 생성
    for (const layer of Object.values(RenderLayer)) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      this.layers.set(layer, canvas);
      this.contexts.set(layer, canvas.getContext('2d')!);
    }
  }

  // 정적 레이어는 변경 시에만 다시 그림
  private staticLayersDirty: Set<RenderLayer> = new Set();

  markDirty(layer: RenderLayer) {
    this.staticLayersDirty.add(layer);
  }

  render(mainCtx: CanvasRenderingContext2D) {
    // 정적 레이어: 변경 시에만 다시 그림
    if (this.staticLayersDirty.has(RenderLayer.BACKGROUND)) {
      this.renderBackground();
      this.staticLayersDirty.delete(RenderLayer.BACKGROUND);
    }

    // 동적 레이어: 매 프레임 다시 그림
    this.renderDynamicLayers();

    // 모든 레이어 합성
    for (const layer of this.getSortedLayers()) {
      mainCtx.drawImage(this.layers.get(layer)!, 0, 0);
    }
  }
}
```

**화면 밖 이펙트 컬링**
```typescript
function isOnScreen(x: number, y: number, margin: number = 50): boolean {
  const viewport = getViewport();
  return (
    x >= viewport.left - margin &&
    x <= viewport.right + margin &&
    y >= viewport.top - margin &&
    y <= viewport.bottom + margin
  );
}

function updateEffects(effects: SkillEffect[]) {
  for (const effect of effects) {
    // 화면 밖 이펙트는 업데이트만 하고 렌더링 스킵
    effect.update();

    if (isOnScreen(effect.x, effect.y)) {
      effect.render();
    }
  }
}
```

**배칭 (Batching)**
```typescript
// 같은 스프라이트는 한 번에 그리기
class SpriteBatcher {
  private batches: Map<string, DrawCall[]> = new Map();

  addSprite(spriteId: string, x: number, y: number, options: DrawOptions) {
    if (!this.batches.has(spriteId)) {
      this.batches.set(spriteId, []);
    }
    this.batches.get(spriteId)!.push({ x, y, options });
  }

  flush(ctx: CanvasRenderingContext2D) {
    for (const [spriteId, calls] of this.batches) {
      const sprite = getSprite(spriteId);

      // 같은 스프라이트 연속 그리기 (컨텍스트 스위칭 최소화)
      for (const call of calls) {
        ctx.drawImage(sprite, call.x, call.y);
      }
    }

    this.batches.clear();
  }
}
```

#### 14.3 메모리 최적화

**이미지 에셋 관리**
```typescript
class AssetManager {
  private cache: Map<string, HTMLImageElement> = new Map();
  private refCount: Map<string, number> = new Map();

  async load(path: string): Promise<HTMLImageElement> {
    if (this.cache.has(path)) {
      this.refCount.set(path, (this.refCount.get(path) || 0) + 1);
      return this.cache.get(path)!;
    }

    const img = await loadImage(path);
    this.cache.set(path, img);
    this.refCount.set(path, 1);
    return img;
  }

  release(path: string) {
    const count = (this.refCount.get(path) || 1) - 1;

    if (count <= 0) {
      // 참조 없으면 메모리에서 제거
      this.cache.delete(path);
      this.refCount.delete(path);
    } else {
      this.refCount.set(path, count);
    }
  }

  // 미사용 에셋 정리
  cleanup() {
    for (const [path, count] of this.refCount) {
      if (count <= 0) {
        this.cache.delete(path);
        this.refCount.delete(path);
      }
    }
  }
}
```

**이펙트 자동 정리**
```typescript
class EffectManager {
  private effects: SkillEffect[] = [];
  private maxEffects = 100;

  add(effect: SkillEffect) {
    // 최대 개수 초과 시 오래된 것 제거
    while (this.effects.length >= this.maxEffects) {
      const oldest = this.effects.shift();
      oldest?.dispose();
    }

    this.effects.push(effect);
  }

  update(deltaTime: number) {
    // 완료된 이펙트 제거
    this.effects = this.effects.filter(effect => {
      effect.update(deltaTime);

      if (effect.isComplete()) {
        effect.dispose();
        return false;
      }
      return true;
    });
  }
}
```

#### 14.4 네트워크 최적화

**전직 동기화 데이터 압축**
```typescript
// 최소 데이터만 전송
interface AdvancementSyncMinimal {
  h: string;   // heroId (축약)
  a: number;   // advancedClass (enum 숫자)
  t: number;   // tier
}

// 풀 데이터는 요청 시에만
interface AdvancementSyncFull {
  heroId: string;
  advancedClass: AdvancedHeroClass;
  tier: number;
  stats: HeroStats;
  skills: SkillSet;
}

function compressAdvancementData(data: AdvancementSyncFull): AdvancementSyncMinimal {
  return {
    h: data.heroId,
    a: ADVANCED_CLASS_TO_NUMBER[data.advancedClass],
    t: data.tier,
  };
}
```

**동기화 빈도 조절**
```typescript
// 이펙트 동기화는 중요 이벤트만
const SYNC_PRIORITIES = {
  advancement: 'immediate',      // 전직: 즉시
  enhancement: 'immediate',      // 강화: 즉시
  skillUse: 'high',              // 스킬 사용: 높음 (100ms 내)
  effectUpdate: 'low',           // 이펙트 업데이트: 낮음 (500ms 내)
  particleSync: 'skip',          // 파티클: 동기화 안함 (각자 계산)
};
```

#### 14.5 성능 모니터링

```typescript
class PerformanceMonitor {
  private metrics = {
    fps: 0,
    particleCount: 0,
    effectCount: 0,
    drawCalls: 0,
    memoryUsage: 0,
  };

  update() {
    this.metrics.fps = this.calculateFPS();
    this.metrics.particleCount = particleManager.getCount();
    this.metrics.effectCount = effectManager.getCount();
    this.metrics.drawCalls = renderer.getDrawCallCount();

    if (performance.memory) {
      this.metrics.memoryUsage = performance.memory.usedJSHeapSize;
    }
  }

  getReport(): string {
    return `FPS: ${this.metrics.fps} | Particles: ${this.metrics.particleCount} | Effects: ${this.metrics.effectCount}`;
  }

  // 성능 경고
  checkWarnings() {
    if (this.metrics.fps < 30) {
      console.warn('낮은 FPS 감지:', this.metrics.fps);
    }
    if (this.metrics.particleCount > 400) {
      console.warn('과다 파티클:', this.metrics.particleCount);
    }
  }
}

// 디버그 모드에서 표시
if (DEBUG_MODE) {
  setInterval(() => {
    performanceMonitor.update();
    debugOverlay.setText(performanceMonitor.getReport());
  }, 1000);
}
```

#### 14.6 성능 목표

| 항목 | 목표 | 최소 |
|------|------|------|
| FPS | 60 | 30 |
| 파티클 수 | < 300 | < 500 |
| 이펙트 수 | < 30 | < 50 |
| 메모리 | < 200MB | < 300MB |
| 네트워크 지연 | < 100ms | < 200ms |

#### 14.7 성능 테스트 체크리스트

- [ ] 8개 스킬 동시 사용 시 FPS 30 이상 유지
- [ ] 4인 멀티플레이에서 모두 전직 스킬 사용 시 안정적
- [ ] 메테오 샤워 (10개 운석) 사용 중 프레임 드랍 < 20%
- [ ] 저사양 기기에서 LOW 품질로 플레이 가능
- [ ] 30분 연속 플레이 후 메모리 누수 없음
- [ ] 네트워크 지연 200ms 환경에서 전직 동기화 정상

---

## 15. 변경 이력

### V1.17.18
- **기본 스탯 직렬화 추가** (`baseAttack`, `baseSpeed`, `baseAttackSpeed`)
  - 다른 플레이어 영웅의 업그레이드가 복리로 적용되던 문제 수정
  - `GameStateSyncMessage` 인터페이스에 기본 스탯 필드 추가
- **문서 업데이트**: 동기화 메시지 타입에 기본 스탯 필드 명세 추가

### V1.17.12
- **2차 강화 레벨 하향** (레벨 50 → 40)
- **캐릭터 정보 UI 개선** (전직 특수 효과 표시)
- **전직별 기본 공격 이펙트 색상 차별화**

### V1.17.11
- **멀티플레이어 전직 캐릭터 부활 동기화 수정**
  - `advancedClass`, `tier`, `config` 스탯 동기화 추가
