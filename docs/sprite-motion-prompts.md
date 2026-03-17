# 캐릭터 모션 스프라이트 생성 가이드

## 현재 상태 분석

### 캐릭터 아트 스타일
- **치비/SD(슈퍼디폼)** - 2~3등신 비율
- **해골 얼굴** - 모든 캐릭터가 흰 해골 얼굴 + 큰 검은 눈
- **두꺼운 검은 외곽선** (카툰 렌더링)
- **투명 배경 PNG**, 개별 이미지 (스프라이트 시트 아님)
- **정면~3/4 앵글** 포즈
- **게임 내 렌더 크기**: 전직 40×50px / 기본 30×40px
- **원본 이미지 크기**: 약 500×600px (194KB~337KB)

### 현재 한계
- 모든 캐릭터에 **단일 정적 이미지만 존재**
- 공격/이동/스킬 시 이미지 변화 없음 → 기하학적 이펙트로만 표현
- `facingRight`으로 좌우 반전만 적용

---

## 모션별 권장 프레임 수

렌더 크기 40×50px 기준. **2×2 그리드 레이아웃** (500×600px × 4프레임 → 약 1000×1200px 시트).

| 모션 | 프레임 수 | 용도 |
|------|----------|------|
| **Walk (이동)** | 4 | 걷기 사이클 루프 |
| **Basic Attack (기본공격)** | 4 | 예비→스윙→타격→복귀 |
| **W Skill** | 4 | 스킬별 고유 모션 |
| **E Skill** | 4 | 스킬별 고유 모션 |

**캐릭터당 총 16프레임, 4개 스프라이트 시트**

---

## 전체 필요 스프라이트 시트 목록

| # | 캐릭터 | 모션 수 | 프레임 합계 |
|---|--------|---------|------------|
| **기본 직업** | | | |
| 1 | Warrior (전사) | 4 | 16 |
| 2 | Archer (궁수) | 4 | 16 |
| 3 | Knight (기사) | 4 | 16 |
| 4 | Mage (마법사) | 4 | 16 |
| **전직** | | | |
| 5 | Berserker (버서커) | 4 | 16 |
| 6 | Guardian (가디언) | 4 | 16 |
| 7 | Sniper (저격수) | 4 | 16 |
| 8 | Ranger (레인저) | 4 | 16 |
| 9 | Paladin (팔라딘) | 4 | 16 |
| 10 | DarkKnight (다크나이트) | 4 | 16 |
| 11 | Archmage (대마법사) | 4 | 16 |
| 12 | Healer (힐러) | 4 | 16 |

**Tier 1 총합**: 192프레임 (48개 스프라이트 시트)
**Tier 2 추가 시**: +128프레임 (32개 스프라이트 시트)
**최종 합계**: ~320프레임, ~80개 스프라이트 시트

---

## 캐릭터별 외형 설명

### 기본 직업

#### Warrior (전사)
- 회색 철제 투구(리벳 장식), 해골 얼굴, 쇄갑+갈색 튜닉
- 짧은 철제 검, 갈색 나무 방패(철제 림), 갈색 부츠
- 색상 테마: #ff6b35 (주황빨강)

#### Archer (궁수)
- 회색 철제 투구(리벳), 해골 얼굴, 짙은 녹색 튜닉
- 갈색 가죽 장갑, 나무 활+화살, 갈색 부츠
- 색상 테마: #22c55e (초록)

#### Knight (기사)
- 회색 철제 투구(리벳), 해골 얼굴(큰 눈, 겁먹은 표정)
- 큰 원형 나무 방패(철제 림+원형 보스)로 몸을 가림, 녹색 튜닉, 갈색 부츠
- 색상 테마: #3b82f6 (파랑)

#### Mage (마법사)
- 진한 남색 마법사 모자(별+달 무늬), 해골 얼굴+회색 수염+콧수염
- 남색 로브(별+달 무늬), 나무 지팡이(보라색 에너지 구체), 검은 부츠
- 색상 테마: #a855f7 (보라)

### 전직

#### Berserker (버서커) - Warrior 전직
- **Tier 1**: 검은 갑옷+금 장식 풀 헬멧(붉은 깃털), 한쪽 눈만 보임, 큰 양손검, 금 사자 방패, 체인메일, 진녹색 튜닉
- **Tier 2**: 드래곤 장식 헬멧(붉은 깃털), 빨간 눈, 청록 크리스탈 양손검, 드래곤 방패, 빨간 망토
- 색상: #ff3300 (짙은 빨강)

#### Guardian (가디언) - Warrior 전직
- **Tier 1**: 검은+금 풀 헬멧(붉은 깃털), 메이스(쇠사슬 없는 모닝스타, 짧은 손잡이+가시 달린 금속 구체), 금+나무 대형 방패(사자), 붉은 망토
- **Tier 2**: 은+금+파란보석 헬멧(파란 깃털+날개+용), 메이스(파란보석, 쇠사슬 없음), 은+금+파란보석 대형 방패, 파란 에너지
- 색상: #00aaff (파랑)

#### Sniper (저격수) - Archer 전직
- **Tier 1**: 금 장식 헬멧(날개+해골 마크), 녹색 튜닉+다크 갑옷, 스코프 크로스보우/라이플형 석궁
- **Tier 2**: 시안 룬 다크 헬멧(날개), 검은+시안 갑옷, 시안 에너지 석궁, 연기 효과
- 색상: #9933ff (보라)

#### Ranger (레인저) - Archer 전직
- **Tier 1**: 금 장식 헬멧(날개+해골 마크), 녹색 튜닉+다크 갑옷, 나무 활+화살통
- **Tier 2**: 다크 헬멧(검은 날개), 빨간 눈, 붉은 망토, 금장식 시안 활, 시안 에너지 화살
- 색상: #ff9922 (앰버)

#### Paladin (팔라딘) - Knight 전직
- **Tier 1**: 은+금 라운드 헬멧(바이저), 큰 검은 눈(겁먹은), 은색 갑옷, 사자문양 라운드 방패
- **Tier 2**: 은+금 윙 헬멧(십자가+날개), 시안 빛나는 눈, 은+금 갑옷+빨간 망토, 드래곤+룬 방패
- 색상: #ffcc00 (금색)

#### DarkKnight (다크나이트) - Knight 전직
- **Tier 1**: 검은+금+빨간 룬 헬멧, 빨간 눈 해골, 검은 갑옷+빨간 룬, 다크 사자 방패(빨간 눈), 보라 에너지 검, 발밑 어둠 안개
- **Tier 2**: 뿔 달린 헬멧, 빨간 눈, 더 짙은 갑옷+룬, 보라+번개 에너지 검, 더 짙은 어둠 안개
- 색상: #9900cc (진보라)

#### Archmage (대마법사) - Mage 전직
- **Tier 1**: 보라+금 마법사 모자(달+별), 보라 빛나는 눈+수염, 보라+금 로브, 보라 소용돌이 지팡이+왼손 에너지 구체
- **Tier 2**: 더 화려한 금 장식+보라 보석, 양손 에너지 구체, 전체적으로 더 빛남
- 색상: #ff4400 (주황빨강)

#### Healer (힐러) - Mage 전직
- **Tier 1**: 흰+파란+금 후드(십자가), 따뜻한 갈색 눈 해골, 흰+파란+금 로브(십자가), 노란 보석 삼지창 지팡이, 금 반짝임+룬
- **Tier 2**: 흰+파란+금 후드+거대한 금 후광(헤일로), 금 빛나는 눈, 더 화려한 로브, 금 룬 문자
- 색상: #00ff88 (민트)

---

## 캐릭터별 스킬 분석

### Warrior (전사)
| 스킬 | 이름 | 설명 | 모션 특징 |
|------|------|------|----------|
| Q (기본공격) | 강타 | 80px 근접 AoE (120도), 공격력×1.0 | 검 휘두르기 아크 |
| W | 돌진 (Charge) | 200px 돌진, 공격력×1.5, 2초 무적 | 전방 대시+검 찌르기 |
| E | 광전사 (Rage) | 10초 버프: 공격+50%, 공속+30% | 파워업 자세 |

### Archer (궁수)
| 스킬 | 이름 | 설명 | 모션 특징 |
|------|------|------|----------|
| Q | 속사 | 180px 원거리, 공격력×1.0 | 활 시위 당기기→발사 |
| W | 관통 화살 | 300px 직선 관통, 공격력×1.8 | 에너지 화살 발사 |
| E | 화살 비 | 150px 원형, 공격력×2.5 | 하늘로 화살 발사 |

### Knight (기사)
| 스킬 | 이름 | 설명 | 모션 특징 |
|------|------|------|----------|
| Q | 방패 타격 | 80px 근접 AoE, Q 적중 시 W 쿨감 1초 | 방패 밀어붙이기 |
| W | 방패 돌진 | 150px 돌진, 최대HP×10%, 2초 스턴 | 방패로 돌진 |
| E | 철벽 방어 | 팀 전체 HP 20% 회복 + 5초 피해 70% 감소 | 방패 높이 들기 |

### Mage (마법사)
| 스킬 | 이름 | 설명 | 모션 특징 |
|------|------|------|----------|
| Q | 마법 화살 | 210px 원거리, 공격력×1.0 | 지팡이에서 발사 |
| W | 화염구 | 80px 원형 폭발, 공격력×2.0 | 화염구 생성+투척 |
| E | 운석 낙하 | 150px 원형, 공격력×4.0, 3초 후 폭발 | 하늘에 마법진 |

### Berserker (버서커)
| 스킬 | 이름 | 설명 | 모션 특징 |
|------|------|------|----------|
| Q | 대검 강타 | 80px AoE, 기본 전사와 동일 메커니즘 | 양손검 대 스윙 |
| W | 피의 돌진 | 200px 돌진, 공격력×1.5, 피해의 50% 회복 | 피빛 에너지 돌진 |
| E | 광란 | 10초: 공격/공속 +80%, 받는 피해 +50% | 분노 폭발 변신 |

### Guardian (가디언)
| 스킬 | 이름 | 설명 | 모션 특징 |
|------|------|------|----------|
| Q | 메이스 강타 | 80px AoE, Q 적중 시 W 쿨감 1초 | 메이스 내려치기 |
| W | 수호의 돌진 | 150px 돌진, 최대HP×10%, 2초 스턴+아군 피해감소 | 방패 돌진+보호막 |
| E | 보호막 | 아군 전체 5초 50% 피해감소 | 에너지 돔 생성 |
| 패시브 | - | 받는 피해 30% 감소 | - |

### Sniper (저격수)
| 스킬 | 이름 | 설명 | 모션 특징 |
|------|------|------|----------|
| Q | 정밀 사격 | 180px, 50% 크리티컬(2배) | 스코프 조준+발사 |
| W | 후방 도약 | 뒤로 150px 점프+전방 사격, 3초 이속+30% | 백플립+사격 |
| E | 저격 | 보스 전용, 3초 시전, 공격력×10, 무제한 사거리 | 엎드려/무릎 조준→거대 빔 |

### Ranger (레인저)
| 스킬 | 이름 | 설명 | 모션 특징 |
|------|------|------|----------|
| Q | 다중 사격 | 180px, 5개 적 동시 타격 | 3개 화살 동시 발사 |
| W | 다중 화살 | 45도 부채꼴 5발, 각 100%, 300px 관통 | 5발 팬 샷 |
| E | 화살 폭풍 | 6초 공속 2배 버프 | 속사 모드 변신 |

### Paladin (팔라딘)
| 스킬 | 이름 | 설명 | 모션 특징 |
|------|------|------|----------|
| Q | 신성 타격 | 80px AoE, 적중 시 200px 아군 5% 힐, W 쿨감 1초 | 방패 타격+치유 빛 |
| W | 신성한 돌진 | 150px 돌진, 1.5초 스턴, 아군 10% 힐 | 금빛 돌진+치유 |
| E | 신성한 빛 | 아군 전체 HP 30% 회복 + 3초 무적 | 기도+신성 폭발 |

### DarkKnight (다크나이트)
| 스킬 | 이름 | 설명 | 모션 특징 |
|------|------|------|----------|
| Q | 흡혈 공격 | 80px 근접, 피해의 20% 흡혈 | 검 공격+생명력 흡수 |
| W | 암흑 찌르기 | 1초 시전, HP 20% 소모, 공격력×3.5, 150×80px | 자해→에너지 창 찌르기 |
| E (ON) | 어둠의 칼날 활성화 | 토글, 초당 HP 5% 소모, 150px 내 초당 120% 데미지 | 어둠 오라 발동 |
| E (OFF) | 어둠의 칼날 해제 | 2초 재사용 딜레이, HP≤10%/스턴 시 자동 해제 | 어둠 에너지 소멸 |
| 패시브 | - | 기본공격 20% 피해흡혈 | - |

### Archmage (대마법사)
| 스킬 | 이름 | 설명 | 모션 특징 |
|------|------|------|----------|
| Q | 강화 마법 화살 | 210px, 보스 데미지 ×1.5 (패시브와 곱연산) | 양손 에너지 합체 발사 |
| W | 폭발 화염구 | 120px 폭발 (50% 확대), 250%, 3초 화상 DoT | 거대 화염구 생성+투척 |
| E | 메테오 샤워 | 300px 범위, 5초간 운석 10개, 각 300% | 마법진+포탈+운석 소환 |
| 패시브 | - | 보스 데미지 ×1.5 | - |

### Healer (힐러)
| 스킬 | 이름 | 설명 | 모션 특징 |
|------|------|------|----------|
| Q | 신성 마법 | 252px 원거리, 기본 마법사와 동일 | 지팡이 에너지 발사 |
| W | 치유의 빛 | 150px 범위, 적 100% 데미지 + 아군 15% 힐 | 빛 빔 발사 |
| E | 생명의 샘 | 500px 범위, 10초간 초당 10% 힐, 힐러 추적 | 치유 분수 소환 |
| 패시브 | - | 150px 아군 초당 4% 힐 오라 | - |

---

## 제미나이 프롬프트

### 공통 스타일 프리픽스 (모든 프롬프트 앞에 반드시 포함)

```
2x2 grid sprite sheet (4 frames), WHITE background, THIN BLACK divider
lines at center (horizontal + vertical). Art style: chibi skeleton,
thick black outlines. Each frame ~500x600px.

Layout: top-left=Frame 1, top-right=Frame 2, bottom-left=Frame 3,
bottom-right=Frame 4.

ALL characters MUST face LEFT in every frame. Frame 4 must be a
variation of Frame 1 — same LEFT facing, same weapon hand, same
body side visible.

The attached reference image shows the character's design. Match it
exactly — same equipment, colors, proportions. Generate different POSES,
not copies of the reference.

Rules:
- Every element stays 100% inside its own quadrant. Nothing crosses
  the divider lines.
- Same character size in all 4 frames.
- Smooth animation sequence: Frame 1 → 2 → 3 → 4.
```

> **후처리**: 생성된 이미지에서 배경 제거(remove.bg 등) 후, `node scripts/combine-sprites.js` 로 개별 프레임을 2×2 시트로 합성하거나 그대로 사용. 구분선이 있으므로 이미지 편집 도구에서 4등분으로 잘라 개별 프레임으로 분리 가능.

---

### 1. WARRIOR (전사)

#### 1-1. Walk (4프레임)
```
Generate a 4-frame walk cycle sprite sheet for this chibi skeleton warrior.

Character: [Warrior 외형]

Frame 1: Right foot forward, left foot back - mid-stride. Body slightly tilted forward. Sword at side.
Frame 2: Feet passing center (contact pose). Body upright. Both feet near ground.
Frame 3: Left foot forward, right foot back - opposite stride. Slight body bob upward.
Frame 4: Feet passing center again. Body at neutral height.

Bouncy, cute walk matching chibi proportions. Small steps with body bob.
Shield in front, sword at side.
```

#### 1-2. Basic Attack - 강타 (4프레임)
```
Generate a 4-frame melee attack sprite sheet for this chibi skeleton warrior.

Character: [Warrior 외형]

Frame 1 (Anticipation): Leans back, sword raised behind head. Shield close to body.
Frame 2 (Swing): Lunges forward, sword sweeping in wide horizontal arc. Strong forward lean.
Frame 3 (Impact): Sword fully extended forward-downward at end of slash arc. Maximum extension. Motion blur near sword tip.
Frame 4 (Recovery): Returns to neutral, sword coming back to rest.

Powerful but cute. Wide AoE slash (120-degree arc). 80px range melee.
```

#### 1-3. W Skill - 돌진 Charge (4프레임)
```
Generate a 4-frame charge/dash attack sprite sheet for this chibi skeleton warrior.

Character: [Warrior 외형]

Frame 1 (Prepare): Crouches low, body angled forward ~30 degrees. Shield raised in front, sword tucked behind.
Frame 2 (Launch): Body shoots forward. Extreme forward lean (~60 degrees). Shield leading, sword trailing. One foot off ground.
Frame 3 (Rushing): Full dash mid-flight. Body almost horizontal. Shield as battering ram. Both feet off ground. Motion blur.
Frame 4 (Landing): Skidding to stop. Sword swings forward for finishing slash. Body returning upright.

200px forward dash attack. Convey speed and power.
```

#### 1-4. E Skill - 광전사 Berserker Rage (4프레임)
```
Generate a 4-frame power-up buff activation sprite sheet for this chibi skeleton warrior.

Character: [Warrior 외형]

Frame 1 (Channel): Plants feet wide, sword pointed down into ground. Head tilted up. Arms tensed.
Frame 2 (Power surge): Body glows orange-red (#ff6b35). Fists clenched, sword raised. Flame particles around body. Eyes glow orange.
Frame 3 (Eruption): Maximum energy burst - flames emanating from character. Sword raised high. Intense orange-red aura. Aggressive stance.
Frame 4 (Empowered): Battle-ready aggressive stance with flame effects on hands/sword. Eyes glowing. Wider stance, sword forward.

Berserker rage buff (attack +50%, speed +30%). Wild and powerful.
```

---

### 2. ARCHER (궁수)

#### 2-1. Walk (4프레임)
```
Generate a 4-frame walk cycle sprite sheet for this chibi skeleton archer.

Character: [Archer 외형]

Frame 1: Right foot forward, left back. Bow held diagonally across body. Slight forward lean.
Frame 2: Feet passing center. Body at peak height.
Frame 3: Left foot forward, right back.
Frame 4: Feet passing center. Body at lowest point.

Light, quick footsteps - fastest class. Bouncy chibi walk.
```

#### 2-2. Basic Attack - 속사 (4프레임)
```
Generate a 4-frame bow shot sprite sheet for this chibi skeleton archer.

Character: [Archer 외형]

Frame 1 (Nock): Pulling arrow from behind, placing on bowstring. Bow arm extended.
Frame 2 (Draw): Full draw - bowstring pulled back near skull face. Bow bends visibly.
Frame 3 (Release): Arrow released - fingers opening, bowstring snapping. Arrow visible leaving bow. Slight forward lunge.
Frame 4 (Recovery): Follow-through. Bow arm extended, draw hand relaxing. Bowstring vibrating.

Clean, snappy ranged attack. Arrow visible in frames 1-3. 180px range.
```

#### 2-3. W Skill - 관통 화살 Pierce Arrow (4프레임)
```
Generate a 4-frame piercing shot sprite sheet for this chibi skeleton archer.

Character: [Archer 외형]

Frame 1 (Charge): Feet planted wide, drawing special glowing green (#22c55e) arrow. Energy at arrowhead.
Frame 2 (Full Draw): Maximum drawback with glowing arrow. Green energy radiates. Eyes flash green.
Frame 3 (Fire): Explosive release - glowing arrow launches with green energy trail. Strong recoil.
Frame 4 (Follow-through): Recovers from shot. Green wisps dissipating.

Pierces all enemies in 300px line. Much more powerful than basic attack. Green (#22c55e) energy.
```

#### 2-4. E Skill - 화살 비 Arrow Storm (4프레임)
```
Generate a 4-frame rain of arrows ultimate sprite sheet for this chibi skeleton archer.

Character: [Archer 외형]

Frame 1 (Aim Up): Bow angled sharply upward (~70 degrees). Glowing arrow pointing at sky.
Frame 2 (Channel): Multiple arrows materialize - 3-4 ghostly green arrows floating, all pointing up. Green aura intensifies.
Frame 3 (Mass Launch): All arrows fire upward simultaneously. Massive green burst.
Frame 4 (Complete): Returns to stance. Green particles fading upward. Confident pose.

Summons arrow rain on 150px radius target area. Dramatic ultimate.
```

---

### 3. KNIGHT (기사)

#### 3-1. Walk (4프레임)
```
Generate a 4-frame walk cycle sprite sheet for this chibi skeleton knight.

Character: [Knight 외형]

Frame 1: Right foot forward. Shield held in front while waddling.
Frame 2: Body bobs up. Shield bounces.
Frame 3: Left foot forward. Shield tilts with movement.
Frame 4: Body bobs down. Heavy landing.

Slow, heavy walk - slowest class. Big shield bounces/sways each step.
```

#### 3-2. Basic Attack - 방패 타격 (4프레임)
```
Generate a 4-frame shield bash sprite sheet for this chibi skeleton knight.

Character: [Knight 외형]

Frame 1 (Wind-up): Pulls shield back, small mace visible behind it. Body crouches.
Frame 2 (Thrust): Shoves massive shield forward. Full body extends behind push.
Frame 3 (Impact): Shield at max extension. Impact stars/shockwave at edge.
Frame 4 (Recovery): Shield pulling back to defensive position. Returns to hiding.

Attacks WITH the shield. Heavy and impactful. 80px range, W cooldown reduction on hit.
```

#### 3-3. W Skill - 방패 돌진 Shield Charge (4프레임)
```
Generate a 4-frame shield charge sprite sheet for this chibi skeleton knight.

Character: [Knight 외형]

Frame 1 (Brace): Crouches behind shield. Blue (#3b82f6) energy on shield edge.
Frame 2 (Charge): Lunges forward shield-first. Blue energy trail. Cape billowing.
Frame 3 (Ramming): Full speed. Shield glowing blue. Body nearly horizontal behind shield.
Frame 4 (Slam): Impact pose. Blue shockwave. Stun stars at impact.

150px dash + 2-second stun. Blue (#3b82f6) energy.
```

#### 3-4. E Skill - 철벽 방어 Iron Defense (4프레임)
```
Generate a 4-frame ultimate defense sprite sheet for this chibi skeleton knight.

Character: [Knight 외형]

Frame 1 (Plant): Slams shield on ground. Blue energy ripple from impact.
Frame 2 (Channel): Blue energy erupts upward from shield. Kneeling behind shield.
Frame 3 (Full Power): Massive blue dome fully expanded. Stands tall (not hiding for once!). Shield raised proudly. Blue particles radiating outward.
Frame 4 (Sustain): Blue shield barrier sustained. Confident defensive stance. Blue energy pulsing.

Team HP 20% heal + 70% damage reduction for 5 seconds. Protective, noble.
```

---

### 4. MAGE (마법사)

#### 4-1. Walk (4프레임)
```
Generate a 4-frame walk cycle sprite sheet for this chibi skeleton mage.

Character: [Mage 외형]

Frame 1: Right foot forward under robe. Staff as walking stick, slightly ahead. Robe sways.
Frame 2: Feet center. Body rises. Robe billows. Hat tips.
Frame 3: Left foot forward. Staff plants. Robe sways opposite.
Frame 4: Feet center. Body lowers. Robe settles.

Wizard shuffling walk. Robe and hat sway with movement.
```

#### 4-2. Basic Attack - 마법 화살 (4프레임)
```
Generate a 4-frame magic missile sprite sheet for this chibi skeleton mage.

Character: [Mage 외형]

Frame 1 (Gather): Raises staff, purple orb brightens. Free hand extends with fingers spread. Purple energy gathers.
Frame 2 (Channel): Purple energy concentrates into missile shape at staff tip. Leans into cast. Eyes glow faintly purple.
Frame 3 (Fire): Purple missile launches from staff. Energy burst at tip. Slight recoil.
Frame 4 (Recovery): Staff lowering. Purple energy dissipating. Return to rest.

Elegant magical ranged attack. Purple (#a855f7). 210px range - longest in game.
```

#### 4-3. W Skill - 화염구 Fireball (4프레임)
```
Generate a 4-frame fireball spell sprite sheet for this chibi skeleton mage.

Character: [Mage 외형]

Frame 1 (Conjure): Staff raised. Fire ball forming between staff and free hand. Orange-red flames.
Frame 2 (Grow): Fireball grows larger. Character strains. Hat/beard blown by heat. Orange-red (#ff6b35) swirling.
Frame 3 (Launch): Hurls massive fireball forward. Both arms thrust. Trail of flames. Robes pushed back.
Frame 4 (Aftermath): Smoke wisps from staff/hand. Robes settling. Ember particles lingering.

Powerful AoE - 80px explosion. Orange-red fire contrasting usual purple.
```

#### 4-4. E Skill - 운석 낙하 Meteor Shower (4프레임)
```
Generate a 4-frame meteor summoning cast sprite sheet for this chibi skeleton mage.

Character: [Mage 외형]

NOTE: This sprite shows ONLY the casting/summoning ritual. Actual meteors are rendered separately by the game engine — do NOT draw any meteors or falling rocks in any frame.

Frame 1 (Ritual Begin): Plants staff firmly on ground with both hands. Feet apart in wide stance. Small purple and orange magic circle appears at feet. Eyes begin glowing faintly purple.
Frame 2 (Channel): Raises both hands away from staff. Staff stands upright on its own, floating slightly. Purple and orange energy spirals upward from magic circle at feet. Rune symbols orbit around body. Hat and beard float upward from intense energy.
Frame 3 (Portal Open): Arms fully thrust skyward, palms open. Massive glowing magic circle/portal forming above head (purple rim + orange core). Energy streams flow from both hands into the portal above. Staff floats beside, orb blazing. Peak channeling intensity.
Frame 4 (Sustain): Holds channeling pose with one arm raised toward portal above, other arm extended forward. Portal above fully active and glowing. Energy streams connect hands to portal. Determined, powerful stance. Staff floating at side.

Summoning ritual only — no meteors visible. 3-second cast, 400% damage, 150px radius. Purple (#a855f7) + orange-red energy. Epic, powerful casting sequence.
```

---

### 5. BERSERKER (버서커) - Warrior 전직

#### 5-1. Walk (4프레임)
```
Generate a 4-frame walk cycle sprite sheet for this chibi skeleton berserker.

Character: [Berserker 외형]

Frame 1-4: Heavy, aggressive marching. Greatsword on shoulder while walking.
Red plume bounces. Heavier footfalls than base warrior.
```

#### 5-2. Basic Attack - 대검 강타 (4프레임)
```
Generate a 4-frame greatsword slash sprite sheet for this chibi skeleton berserker.

Character: [Berserker 외형]

Frame 1 (Wind-up): Lifts greatsword high overhead with both hands. Body twists back. Shield strapped to arm.
Frame 2 (Downswing): Massive downward-diagonal slash. Red (#ff3300) slash trail following blade.
Frame 3 (Impact): Greatsword at full extension, 120-degree arc complete. Ground crack. Red energy burst.
Frame 4 (Recovery): Pulling greatsword back to shoulder. Red energy fading.

Heavier, slower, more devastating than base warrior. Red (#ff3300) energy.
```

#### 5-3. W Skill - 피의 돌진 Blood Rush (4프레임)
```
Generate a 4-frame blood rush dash sprite sheet for this chibi skeleton berserker.

Character: [Berserker 외형]

Frame 1 (Crouch): Deep crouch, greatsword held low. Dark red (#ff3300) blood energy swirling on blade. Eye glows red.
Frame 2 (Launch): Explosive forward dash. Greatsword leading like lance. Blood-red trail. Body nearly horizontal.
Frame 3 (Rushing): Full speed with blood energy coating body. Red afterimages trailing behind.
Frame 4 (Slash-through): Finishing slash as momentum ends. Blood energy explodes outward. Red particles scatter.

200px dash with lifesteal (50% healed). Blood/dark red. More aggressive than warrior's charge.
```

#### 5-4. E Skill - 광란 Rage (4프레임)
```
Generate a 4-frame rage activation sprite sheet for this chibi skeleton berserker.

Character: [Berserker 외형]

Frame 1 (Roar): Head tilted back roaring. Greatsword planted in ground. Red energy cracks on armor.
Frame 2 (Power Surge): Red-orange flames erupt from body. Armor glows red. Eye blazes crimson.
Frame 3 (Full Rage): Engulfed in crimson fire. Greatsword wreathed in flames. Berserk aura at max. Character appears larger.
Frame 4 (Battle Ready): Enraged combat stance. Continuous flames. Greatsword aggressive in both hands. Red eye burning.

+80% attack/speed, +50% damage taken. Terrifyingly powerful but reckless. Crimson fire.
```

---

### 6. GUARDIAN (가디언) - Warrior 전직

#### 6-1. Walk (4프레임)
```
Generate a 4-frame walk cycle sprite sheet for this chibi skeleton guardian. Character faces LEFT in all frames.

Character: [Guardian 외형]

Frame 1: Right foot forward, heavy step. Shield forward, mace at side. Cape starts to sway.
Frame 2: Feet passing center. Body at peak height. Mace sways slightly forward.
Frame 3: Left foot forward, ground-shaking step. Shield steady, mace sways back.
Frame 4: Facing LEFT like Frame 1 — same pose, same weapon/shield hand. Feet passing center, body at lowest point.

Very heavy, deliberate march. Shield always forward.
```

#### 6-2. Basic Attack - 메이스 강타 (4프레임)
```
Generate a 4-frame mace smash sprite sheet for this chibi skeleton guardian. Character faces LEFT in all frames.

Character: [Guardian 외형]
Weapon detail: The mace is a RIGID weapon — a short handle with a spiked metal ball
fixed directly on top. There is NO chain, NO rope, NO flexible connection.
It is swung like a hammer, not like a flail.

Frame 1 (Raise): Lifts mace above shoulder with right hand, winding up for a downward strike. Shield held forward in left hand. Body leans back slightly, loading weight.
Frame 2 (Swing Down): Brings mace down in a powerful overhead arc. Body lunges forward. Shield stays braced. Mace head at mid-swing, moving downward.
Frame 3 (Impact): Mace slams into the ground at full extension. Blue (#00aaff) impact sparks burst from the spiked ball. Small ground cracks beneath. Maximum forward lean.
Frame 4 (Recovery): Facing LEFT like Frame 1 — same weapon/shield hands. Mace back at shoulder, shield forward. Relaxed guard stance.

Heavy, deliberate crushing strike — like a hammer blow, not a spinning flail.
Each hit reduces W cooldown by 1 second. Blue (#00aaff) impact color.
```

#### 6-3. W Skill - 수호의 돌진 Guardian Rush (4프레임)
```
Generate a 4-frame guardian shield charge sprite sheet for this chibi skeleton guardian. Character faces LEFT in all frames.

Character: [Guardian 외형]

Frame 1 (Brace): Hunkers behind shield. Blue (#00aaff) energy barrier on shield surface.
Frame 2 (Charge): Rushes forward shield-first. Blue shockwave ahead. Cape billowing.
Frame 3 (Ram): Shield slam with blue energy explosion. Protective blue dome forming.
Frame 4 (Protect): Facing LEFT like Frame 1. Protective stance with shield raised. Blue dome covers allies.

150px dash + 2-second stun + ally damage reduction. Blue (#00aaff).
```

#### 6-4. E Skill - 보호막 Shield (4프레임)
```
Generate a 4-frame team shield ultimate sprite sheet for this chibi skeleton guardian. Character faces LEFT in all frames.

Character: [Guardian 외형]

Frame 1 (Plant): Slams shield into ground edge-first. Blue ripple from impact.
Frame 2 (Channel): Blue energy erupts from shield upward. Kneeling in concentration.
Frame 3 (Dome): Massive blue energy dome fully forms. Stands tall in center. Shield levitates.
Frame 4 (Sustain): Facing LEFT like Frame 1. Dome established. Vigilant stance. Blue particles floating inside.

Team 50% damage reduction for 5 seconds. Impenetrable fortress.
```

---

### 7. SNIPER (저격수) - Archer 전직

#### 7-1. Walk (4프레임)
```
Generate a 4-frame walk cycle sprite sheet for this chibi skeleton sniper. Character faces LEFT in all frames.

Character: [Sniper 외형]

Frame 1: Right foot forward, crossbow-rifle at hip. Alert posture.
Frame 2: Feet passing center. Head scanning. Body at peak height.
Frame 3: Left foot forward. Crossbow steady. Precise footwork.
Frame 4: Facing LEFT like Frame 1 — same pose, same weapon hand. Feet passing center.

Careful, tactical walking. Military-style movement.
```

#### 7-2. Basic Attack - 정밀 사격 (4프레임)
```
Generate a 4-frame precision shot sprite sheet for this chibi skeleton sniper. Character faces LEFT in all frames.

Character: [Sniper 외형]

Frame 1 (Aim): Raises crossbow-rifle, looking through scope. One eye closes. Body steadies.
Frame 2 (Lock): Perfect aim. Scope glints. Purple (#9933ff) targeting reticle at muzzle. Perfectly still.
Frame 3 (Fire): Fires - purple energy muzzle flash. Slight recoil. Purple tracer from barrel.
Frame 4 (Cycle): Facing LEFT like Frame 1 — same weapon hand. Chambering next round. Ready for next shot.

50% critical hit chance (2x damage). Purple (#9933ff). Tactical/precise.
```

#### 7-3. W Skill - 후방 도약 Backflip Shot (4프레임)
```
Generate a 4-frame backflip evasion shot sprite sheet for this chibi skeleton sniper. Character faces LEFT in all frames.

Character: [Sniper 외형]

Frame 1 (Trigger): Pushes off ground backward. Crossbow aimed at target while body begins flipping.
Frame 2 (Mid-flip): Upside-down in mid-backflip. Firing crossbow while inverted - purple bolt launching forward.
Frame 3 (Descent): Completing flip, rotating right-side-up. Purple speed aura appears on legs.
Frame 4 (Land): Facing LEFT like Frame 1. Smooth landing in kneeling pose. Purple swiftness aura on legs. Crossbow ready, same hand.

Jump backward 150px while shooting + speed buff. Agile, tactical. Purple (#9933ff).
```

#### 7-4. E Skill - 저격 Snipe (4프레임)
```
Generate a 4-frame ultimate snipe sprite sheet for this chibi skeleton sniper. Character faces LEFT in all frames.

Character: [Sniper 외형]

Frame 1 (Set up): Drops to one knee. Crossbow-rifle deployed on support. Scope extended. Aiming at distant target.
Frame 2 (Aim): Looking through scope intently. Purple (#9933ff) laser sight beam extending infinitely forward. Energy charging. Eye glows purple.
Frame 3 (Charge): Weapon fully charged with intense purple energy. Barrel glows. Runes around weapon. Maximum concentration.
Frame 4 (Fire): Facing LEFT like Frame 1. MASSIVE purple energy beam launches from same side. Extreme recoil. Huge muzzle flash. Ground cracks.

Boss-only, 1000% damage, 3-second channel, infinite range. Most powerful single-target attack. Devastating purple beam.
```

---

### 8. RANGER (레인저) - Archer 전직

#### 8-1. Walk (4프레임)
```
Generate a 4-frame walk cycle sprite sheet for this chibi skeleton ranger. Character faces LEFT in all frames.

Character: [Ranger 외형]

Frame 1: Right foot forward, bow in hand. Light, quick step.
Frame 2: Feet passing center. Body bounces up. Other hand near quiver.
Frame 3: Left foot forward. Nimble stride. Bow sways slightly.
Frame 4: Facing LEFT like Frame 1 — same pose, same bow hand. Feet passing center.

Swift, light-footed walk. Nimble, ranger-style movement.
```

#### 8-2. Basic Attack - 다중 사격 (4프레임)
```
Generate a 4-frame multi-target bow attack sprite sheet for this chibi skeleton ranger. Character faces LEFT in all frames.

Character: [Ranger 외형]

Frame 1 (Nock multiple): Rapidly draws 3 arrows simultaneously from quiver, places on bowstring. Quick, practiced.
Frame 2 (Multi-draw): Pulls back all 3 arrows. Bow bends wide. Amber (#ff9922) energy on arrowheads. Spread angle visible.
Frame 3 (Release spread): All arrows fire in fan pattern. Amber energy trails in different directions. Bowstring snaps.
Frame 4 (Recovery): Facing LEFT like Frame 1 — same bow hand. Reaching for next arrows. Amber wisps fading.

Hits up to 5 targets simultaneously. Fast multi-shot. Amber (#ff9922).
```

#### 8-3. W Skill - 다중 화살 Multi Arrow (4프레임)
```
Generate a 4-frame fan barrage sprite sheet for this chibi skeleton ranger. Character faces LEFT in all frames.

Character: [Ranger 외형]

Frame 1 (Load): Draws 5 glowing amber arrows. Arranges in fan formation on bowstring.
Frame 2 (Full Draw): Bow at max tension with 5 glowing arrows in 45-degree fan. Amber (#ff9922) energy at peak.
Frame 3 (Volley): All 5 fire in cone/fan pattern. 5 amber energy trails spreading. Massive energy release.
Frame 4 (Follow-through): Facing LEFT like Frame 1 — same bow hand. Bow extended, amber trails fading.

5 arrows in 45-degree fan, each 100% damage, 300px piercing. Amber (#ff9922).
```

#### 8-4. E Skill - 화살 폭풍 Arrow Storm (4프레임)
```
Generate a 4-frame rapid-fire buff sprite sheet for this chibi skeleton ranger. Character faces LEFT in all frames.

Character: [Ranger 외형]

Frame 1 (Focus): Focused stance, feet wide. Amber energy spiraling around body. Bow humming. Eyes glow amber.
Frame 2 (Activate): Amber energy explodes outward. Speed-enhanced state. Afterimage effect. Arrows in quiver glow.
Frame 3 (Rapid State): Dynamic action pose. Multiple ghostly afterimages showing rapid movement. Amber aura blazing.
Frame 4 (Sustained): Facing LEFT like Frame 1. Rapid-fire state continues. Amber wind swirling. Energy arrows auto-replenishing.

6 seconds of double attack speed. Amber (#ff9922). Speed and volume of fire.
```

---

### 9. PALADIN (팔라딘) - Knight 전직

#### 9-1. Walk (4프레임)
```
Generate a 4-frame walk cycle sprite sheet for this chibi skeleton paladin. Character faces LEFT in all frames.

Character: [Paladin 외형]

Frame 1: Right foot forward, shield glowing gold. Dignified step.
Frame 2: Feet passing center. Holy sparkles trail behind. Body at peak.
Frame 3: Left foot forward. Golden glow pulses. Heavy but graceful.
Frame 4: Facing LEFT like Frame 1 — same pose, same shield hand. Feet passing center.

Slow, dignified march. Shield forward with golden glow.
```

#### 9-2. Basic Attack - 신성 방패 타격 (4프레임)
```
Generate a 4-frame holy shield bash sprite sheet for this chibi skeleton paladin. Character faces LEFT in all frames.

Character: [Paladin 외형]

Frame 1 (Prayer): Quick golden (#ffcc00) blessing on shield. Pulls shield back.
Frame 2 (Holy Strike): Shield thrusts forward with golden energy. Lion emblem emanates holy light.
Frame 3 (Impact): Shield at max extension. Golden healing pulse radiates outward toward allies. Holy cross/star at impact.
Frame 4 (Recovery): Facing LEFT like Frame 1 — same shield hand. Shield returns to guard. Golden healing particles linger.

Each attack heals nearby allies 5% max HP. Gold (#ffcc00) holy energy.
```

#### 9-3. W Skill - 신성한 돌진 Holy Charge (4프레임)
```
Generate a 4-frame holy charge sprite sheet for this chibi skeleton paladin. Character faces LEFT in all frames.

Character: [Paladin 외형]

Frame 1 (Bless): Golden cross above paladin. Shield radiates holy light. Crouching.
Frame 2 (Rush): Charges forward shield-first in golden holy fire. Golden trail. 150px dash.
Frame 3 (Heal Burst): Golden healing burst radiates. Crosses and light particles healing allies.
Frame 4 (Stand): Facing LEFT like Frame 1. Protective stance with shield forward. Golden energy lingering.

150px dash + 1.5-second stun + ally 10% heal. Gold (#ffcc00) holy.
```

#### 9-4. E Skill - 신성한 빛 Divine Light (4프레임)
```
Generate a 4-frame divine ultimate sprite sheet for this chibi skeleton paladin. Character faces LEFT in all frames.

Character: [Paladin 외형]

Frame 1 (Kneel): Kneels, plants shield. Hands clasped in prayer. Golden light from above.
Frame 2 (Ascend): Holy energy descends in golden light pillar. Angelic wing silhouettes behind. Eyes glow gold.
Frame 3 (Radiate): Maximum power. Massive golden explosion. Holy crosses, halos, feathers. Character floats off ground. Healing 30% to ALL allies.
Frame 4 (Invincible): Facing LEFT like Frame 1. Golden invincibility dome surrounds team. Divine protection radiates.

Team 30% heal + 3-second invincibility. Most powerful defensive ultimate. Divine, awe-inspiring. Gold (#ffcc00).
```

---

### 10. DARK KNIGHT (다크나이트) - Knight 전직

#### 10-1. Walk (4프레임)
```
Generate a 4-frame walk cycle sprite sheet for this chibi skeleton dark knight. Character faces LEFT in all frames.

Character: [DarkKnight 외형]

Frame 1: Right foot forward, dark mist trails from feet. Purple sword flickers. Red eyes glow.
Frame 2: Feet passing center. Mist intensifies. Ominous presence.
Frame 3: Left foot forward. Dark energy pulses. Heavy, menacing step.
Frame 4: Facing LEFT like Frame 1 — same pose, same sword hand. Feet passing center. Mist settles.

Menacing stride. Dark mist, purple sword energy, red eyes.
```

#### 10-2. Basic Attack - 흡혈 공격 (4프레임)
```
Generate a 4-frame life-stealing sword strike sprite sheet for this chibi skeleton dark knight. Character faces LEFT in all frames.

Character: [DarkKnight 외형]

Frame 1 (Draw): Purple energy sword raised behind. Dark mist concentrates on blade. Red eyes blaze.
Frame 2 (Strike): Quick forward slash. Purple energy trail. Dark mist follows swing.
Frame 3 (Drain): Red life energy flows FROM enemy BACK to dark knight. Red/purple life-steal particles traveling to character.
Frame 4 (Absorb): Facing LEFT like Frame 1 — same sword hand. Brief red glow as life absorbs. Return to stance.

20% lifesteal on basic attacks. Dark purple sword + red lifesteal particles.
```

#### 10-3. W Skill - 암흑 찌르기 Dark Pierce (4프레임)
```
Generate a 4-frame dark piercing thrust sprite sheet for this chibi skeleton dark knight. Character faces LEFT in all frames.

Character: [DarkKnight 외형]

Frame 1 (Sacrifice): Stabs own armor - sacrificing 20% HP. Red blood/energy splatters. Pain expression. Dark energy concentrates on sword.
Frame 2 (Channel): Sword transforms into massive dark purple lance of energy. Holds it back, channeling. Dark mist spirals. Purple runes on ground. 1-second cast.
Frame 3 (Thrust): Devastating forward thrust - dark energy lance extends 150px forward, 80px wide. Massive purple-black explosion. Ground shatters. 350% damage.
Frame 4 (Aftermath): Facing LEFT like Frame 1. Energy lance dissipating. Sword returns to normal. Exhausted but same stance direction.

1-sec cast, 20% HP cost, 350% damage, 150x80px area. Sacrificial, devastating. Dark purple (#9900cc).
```

#### 10-4. E Skill (ON) - 어둠의 칼날 활성화 Dark Blade (4프레임)
```
Generate a 4-frame dark blade toggle activation sprite sheet for this chibi skeleton dark knight. Character faces LEFT in all frames.

Character: [DarkKnight 외형]

Frame 1 (Initiate): Raises sword skyward. Dark mist surges upward. Red eyes intensify to blazing crimson.
Frame 2 (Transform): Sword engulfed in dark purple flame. Surrounded by dark energy vortex (150px radius). HP starts draining (red particles leaving body).
Frame 3 (Active): Full Dark Blade mode - purple-black destruction aura in 150px radius. Sword is blazing dark energy blade. Continuous damage to nearby enemies. Dark flames and tendrils.
Frame 4 (Sustained): Facing LEFT like Frame 1. Dark aura pulsing steadily. Aggressive wide stance. HP draining (red particles). Purple waves outward.

Toggle: HP drain 5%/sec, 120% attack/sec to enemies in 150px. Auto-off at HP≤10%. Dark purple (#9900cc) + crimson.
```

---

### 11. ARCHMAGE (대마법사) - Mage 전직

#### 11-1. Walk (4프레임)
```
Generate a 4-frame walk cycle sprite sheet for this chibi skeleton archmage. Character faces LEFT in all frames.

Character: [Archmage 외형]

Frame 1: Right foot forward. Both orbs float alongside. Robe sways. Dignified step.
Frame 2: Feet passing center. Purple energy trails. Hat sways. Body at peak.
Frame 3: Left foot forward. Orbs pulse. Mystical presence radiates.
Frame 4: Facing LEFT like Frame 1 — same pose, same staff hand. Feet passing center.

Dignified wizardly walk. Purple energy trails. Mystical presence.
```

#### 11-2. Basic Attack - 강화 마법 화살 (4프레임)
```
Generate a 4-frame empowered magic missile sprite sheet for this chibi skeleton archmage. Character faces LEFT in all frames.

Character: [Archmage 외형]

Frame 1 (Gather): Both hands raised, staff orb and hand orb brighten. Purple energy spirals between them.
Frame 2 (Merge): Energy from both orbs merges into single large missile. Runes appear. Eyes blaze purple.
Frame 3 (Launch): Dual-handed release - massive purple missile fires. Much larger than base mage's. Double energy trail. Hat and beard blown back.
Frame 4 (Recovery): Facing LEFT like Frame 1 — same staff hand. Energy returns to both orbs. Magical afterglow.

1.5x boss damage bonus. More powerful than base mage. Purple (#a855f7).
```

#### 11-3. W Skill - 폭발 화염구 Inferno (4프레임)
```
Generate a 4-frame inferno spell sprite sheet for this chibi skeleton archmage. Character faces LEFT in all frames.

Character: [Archmage 외형]

Frame 1 (Conjure): Both hands create TWO fireballs spiraling around each other. Red-orange + purple swirling.
Frame 2 (Merge & Grow): Twin fireballs merge into massive inferno sphere. Nearly character-sized. Intense heat. Hat/beard blown.
Frame 3 (Launch): Hurls massive inferno - both hands thrust. Enormous fire+purple trail. 120px radius (50% larger than base). Burn particles scatter.
Frame 4 (Aftermath): Facing LEFT like Frame 1. Smoke and embers rising. Purple flames on hands. Charred ground.

250% damage + 50% larger + 3-second burn DoT. Orange-red + purple.
```

#### 11-4. E Skill - 메테오 샤워 Meteor Shower (4프레임)
```
Generate a 4-frame meteor shower summoning sprite sheet for this chibi skeleton archmage. Character faces LEFT in all frames.

Character: [Archmage 외형]

NOTE: This sprite shows ONLY the summoning ritual. Actual meteors are rendered separately by the game engine — do NOT draw any meteors or falling rocks in any frame.

Frame 1 (Grand Ritual): Both arms raised in grand ritual pose. Staff floating freely, orb blazing. Multiple layered magic circles at feet (purple inner + orange outer). Both hand orbs ignite. Eyes blaze purple. Most powerful casting stance.
Frame 2 (Open Portal): Arms thrust upward channeling into massive dark portal forming above. Purple lightning crackles from portal edges. Purple + orange energy streams from both hands and staff into portal. Maximum channeling effort. Hat and beard blown upward. Robe billowing.
Frame 3 (Full Channel): Portal above fully open and active — swirling dark vortex with purple-orange rim. Character channels with both arms raised, body slightly floating off ground from sheer magical force. Energy pillars connect hands to portal. Staff orbits around character.
Frame 4 (Sustain): Facing LEFT like Frame 1. Sustained channeling — arms maintaining portal above. Character floating. Both orbs blazing. Controlled power.

Summoning ritual only — no meteors visible. 10 meteors over 5 seconds, each 300%, 300px area. Most devastating AoE ultimate. Purple (#a855f7) + orange fire.
```

---

### 12. HEALER (힐러) - Mage 전직

#### 12-1. Walk (4프레임)
```
Generate a 4-frame walk cycle sprite sheet for this chibi skeleton healer. Character faces LEFT in all frames.

Character: [Healer 외형]

Frame 1: Right foot forward, staff used as walking aid. Golden sparkles begin.
Frame 2: Feet passing center. Healing aura glows. Robes flow gently.
Frame 3: Left foot forward. Golden sparkles trail behind. Serene step.
Frame 4: Facing LEFT like Frame 1 — same pose, same staff hand. Feet passing center.

Gentle, graceful walk. Serene, calming movement.
```

#### 12-2. Basic Attack - 신성 마법 (4프레임)
```
Generate a 4-frame holy magic missile sprite sheet for this chibi skeleton healer. Character faces LEFT in all frames.

Character: [Healer 외형]

Frame 1 (Gather): Raises staff, golden-green energy at gem. Free hand extends with holy light.
Frame 2 (Channel): Golden-green missile forms. Mix of offensive (gold) and healing (green) energy.
Frame 3 (Fire): Launches golden-green bolt at enemies. Holy light burst at launch.
Frame 4 (Recovery): Facing LEFT like Frame 1 — same staff hand. Staff lowers. Green healing particles linger.

Mint-green (#00ff88) + gold theme. Same power as base mage. 252px range.
```

#### 12-3. W Skill - 치유의 빛 Healing Light (4프레임)
```
Generate a 4-frame healing light spell sprite sheet for this chibi skeleton healer. Character faces LEFT in all frames.

Character: [Healer 외형]

Frame 1 (Pray): Holds staff close, hands clasped in prayer. Golden-green energy gathering. Eyes close.
Frame 2 (Channel): Staff raised, releasing beam of pure green (#00ff88) healing light. Holy symbols in beam. Wide 150px beam.
Frame 3 (Dual Effect): Healing light hits area - enemies take damage (golden lightning in beam), ally silhouettes glow green (healing 15% HP).
Frame 4 (Fade): Facing LEFT like Frame 1. Beam fading. Green healing particles linger. Golden sparkles settling.

Damages enemies AND heals allies in same 150px area. Green healing + gold damage.
```

#### 12-4. E Skill - 생명의 샘 Spring of Life (4프레임)
```
Generate a 4-frame ultimate healing fountain sprite sheet for this chibi skeleton healer. Character faces LEFT in all frames.

Character: [Healer 외형]

Frame 1 (Plant): Plants staff into ground. Kneels in prayer. Green energy erupts from ground. Holy runes circle healer.
Frame 2 (Spring): Beautiful fountain of green healing energy erupts. Liquid-like green flowing up and cascading down. 500px green aura spreads.
Frame 3 (Full Bloom): Spring of Life at full power. Lush green fountain. Flower/vine/life imagery. Healing waves pulsing outward. Character floating.
Frame 4 (Sustain): Facing LEFT like Frame 1. Sustained healing fountain. Green pulses outward. Prayer pose maintaining spring.

10 seconds of 10% HP/sec to all allies in 500px. Follows healer. Strongest sustained healing. Miracle of life. Green (#00ff88) + gold.
```

---

---

### 13. BOSS 1 — 죽음의 기사 (기마 해골 기사)

> **참조 이미지**: `public/img/units/boss.png`
> **렌더 크기**: 60×80px (일반 유닛의 2.5배)
> **원본 프레임 크기**: 약 700×900px (일반보다 큼 — 말 포함 공간 필요)

#### 보스 1 외형 설명
- **기수**: 해골 얼굴(큰 빨간 눈), 뿔 달린 금 장식 투구(꼭대기 박쥐 장식), 금 트림 짙은 회색 풀 아머, 짙은 갈색 망토
- **무기**: 거대한 시안/청록색 발광 양손검 (검에서 시안 에너지 불꽃)
- **말**: 검은 장갑마(해골 다리, 빨간 눈), 금 트림 짙은 회색 마갑, 찢어진 짙은 적갈색 마의, 발밑 붉은 에너지 흔적
- **색상 테마**: 짙은 회색 + 금 트림 + 시안 검 + 빨간 눈 + 적갈색 망토/마의

#### 13-1. Walk (4프레임)
```
Generate a 4-frame WALK CYCLE animation sprite sheet for this character.

CRITICAL: Each of the 4 frames must show a DIFFERENT POSE — this is an animation, NOT 4 copies of the same image. The character's legs, body position, and accessories must CHANGE between frames to create the illusion of movement when played in sequence.

This is a mounted skeleton knight riding a skeleton horse. Draw the rider and horse as one combined character. Each frame is approximately 700x900px (larger than normal characters due to the horse body).

The key element that CHANGES between frames is the HORSE'S LEG POSITIONS — this is a horse trot cycle:

Frame 1 (LEFT STRIDE): Horse's LEFT front leg is extended FORWARD, RIGHT front leg is BACK. Right rear leg is forward, left rear leg is back. The rider's body tilts slightly FORWARD. The cape trails BEHIND. Sword rests on the rider's right shoulder. Small red energy wisps at the horse's hooves.

Frame 2 (PASSING - LEGS TOGETHER): All four horse legs are close together, passing through CENTER position. The horse's body is at its HIGHEST point (bouncing up). The rider bobs UP slightly. The cape floats UPWARD. Horse's head is slightly DOWN.

Frame 3 (RIGHT STRIDE): Horse's RIGHT front leg is extended FORWARD, LEFT front leg is BACK. Left rear leg is forward, right rear leg is back. This is the MIRROR of Frame 1. The rider's body tilts slightly BACKWARD. The cape swings to the OPPOSITE side. Sword still on shoulder.

Frame 4 (PASSING - LEGS TOGETHER): All four legs passing through CENTER again. Horse's body is at its LOWEST point. The rider bobs DOWN. Cape settles. Horse's head is slightly UP. Red energy at hooves flickers.

The horse trot must be clearly visible — each frame's leg positions must be DISTINCTLY DIFFERENT. Slow, heavy, menacing stride. The rider stays seated throughout but bobs up and down with the horse's gait.
```

#### 13-2. Basic Attack — 강타 (4프레임)
```
Generate a 4-frame SWORD ATTACK animation sprite sheet for this character.

CRITICAL: Each of the 4 frames must show a COMPLETELY DIFFERENT POSE — the sword position changes dramatically between frames to show a full swing arc. This is NOT 4 copies — it is a sequential attack animation.

This is a mounted skeleton knight on a skeleton horse, performing a massive overhead sword swing. Each frame is approximately 700x900px.

Frame 1 (WIND-UP): The rider grips the giant cyan glowing sword with BOTH HANDS and raises it HIGH ABOVE his head, pointing straight UP. His body leans BACKWARD to load the swing. The horse rears back slightly — front hooves lifted 30 degrees off the ground. Cape flies upward. Cyan energy crackles on the blade.

Frame 2 (MID-SWING): The sword is now at a 45-degree angle, swinging DOWN and FORWARD in a diagonal arc. A large cyan SLASH TRAIL follows the blade path. The rider's body is now leaning FORWARD into the strike. The horse lunges forward — all four hooves on the ground, body pushed forward. Cape streams horizontally behind.

Frame 3 (IMPACT): The sword has completed its arc and is now pointing DOWN and to the LEFT at the ground level. Maximum extension — rider's arms fully stretched downward. EXPLOSION of cyan energy at the sword tip. The horse's front hooves STAMP the ground. Dust/debris particles fly outward. The impact creates visible cracks on the ground beneath. This is the moment of maximum damage.

Frame 4 (RECOVERY): The rider pulls the sword back, returning it to rest on his RIGHT SHOULDER. His body returns to upright sitting position. The horse settles to neutral standing. Cyan energy wisps dissipate. Cape falls back down. Dust settles.

The sword's position must be DRAMATICALLY DIFFERENT in each frame: UP (frame 1) → DIAGONAL (frame 2) → DOWN (frame 3) → SHOULDER (frame 4). This is the most important visual change between frames.
```

---

### 14. BOSS 2 — 어둠의 마법사 (날개 달린 해골 마법사)

> **참조 이미지**: `public/img/units/RPG/heroes/boss2.png`
> **렌더 크기**: 60×80px (일반 유닛의 2.5배)
> **원본 프레임 크기**: 약 700×900px (일반보다 큼 — 날개 포함 공간 필요)

#### 보스 2 외형 설명
- **몸체**: 해골 얼굴(큰 빨간 눈), 뿔 달린 짙은 회색+보라 투구(꼭대기 박쥐 장식), 검은+짙은 보라+금 트림 로브(보라 룬 문양), 보라 보석 장식
- **날개**: 거대한 검은 박쥐 날개 (양쪽으로 펼침, 체구보다 넓음)
- **무기**: 나무 지팡이 (꼭대기에 보라색 발광 오브/에너지 구체)
- **발밑**: 짙은 보라/남색 안개/연기가 항상 피어오름
- **색상 테마**: 검은색 + 짙은 보라 + 금 트림 + 보라 발광 + 빨간 눈

#### 14-1. Walk (4프레임)
```
Generate a 4-frame HOVERING/FLYING animation sprite sheet for this character.

CRITICAL: Each of the 4 frames must show a DIFFERENT POSE — the wing positions and body height must CHANGE between frames. This is NOT 4 copies of the same image. The wings flap up and down to create a flying/hovering animation.

This is a skeleton dark wizard with large bat wings. The character FLOATS in the air — feet never touch the ground. Purple mist is always present below the feet. Each frame is approximately 700x900px (larger than normal due to wide wingspan).

The key element that CHANGES between frames is the WING ANGLE and BODY HEIGHT:

Frame 1 (WINGS UP - RISING): Both bat wings are raised HIGH — the wing tips point UPWARD above the character's head, forming a V-shape. The body is at MID height. Staff held in left hand at the side. Robes hang straight down. Purple mist below is thin and dispersed.

Frame 2 (WINGS PEAK - HIGHEST): Wings are at their MAXIMUM height — fully extended upward and slightly outward. The body has risen to its HIGHEST hover position. Robes billow upward slightly from the updraft. Purple mist below is blown away. Staff orb glows brighter. This is the peak of the wing flap.

Frame 3 (WINGS DOWN - FALLING): Both wings sweep DOWN — the wing tips point DOWNWARD below the character's waist, forming an inverted V-shape. The body DROPS to a LOWER hover position. Robes flow downward. Purple mist below is dense and swirling (pushed by wing downstroke). Staff held lower.

Frame 4 (WINGS LOW - LOWEST): Wings are at their LOWEST position — nearly folded against the body sides. The body is at its LOWEST hover height. Robes settle. Purple mist is thick beneath the feet. Staff orb dims slightly. Wings begin to curve back upward for the next cycle.

The wing angle must be DRAMATICALLY DIFFERENT in each frame: HIGH-V (frame 1) → PEAK (frame 2) → LOW-V (frame 3) → FOLDED (frame 4). The body also bobs: mid → high → mid → low. This creates a natural hovering/flying loop.
```

#### 14-2. Basic Attack — 암흑 마법 (4프레임)
```
Generate a 4-frame MAGIC ATTACK animation sprite sheet for this character.

CRITICAL: Each of the 4 frames must show a COMPLETELY DIFFERENT POSE — the character's arm positions, magical energy, and wing positions change dramatically. This is a sequential attack animation, NOT 4 copies.

This is a skeleton dark wizard with large bat wings casting a dark magic spell. Each frame is approximately 700x900px.

Frame 1 (GATHER): Wings are spread WIDE (fully extended to both sides). The character raises the staff in the RIGHT hand high above head — the orb on top glows intensely purple. The LEFT hand extends FORWARD with palm open, fingers spread, pointing at the target. Small purple sparks begin gathering between the staff orb and the left hand. Body leans slightly forward.

Frame 2 (CHANNEL): Wings pull slightly INWARD. The staff is now held horizontally across the chest. Both hands point FORWARD — a large swirling PURPLE ORB of dark energy forms directly in front of the character's hands, about the size of the character's head. Purple runes and symbols circle around the orb. The character's eyes glow BRIGHT RED. Purple lightning crackles from the orb.

Frame 3 (LAUNCH): Wings SNAP BACKWARD (blown back by the force). Both arms THRUST FORWARD — the purple energy orb FIRES outward to the left. A massive purple ENERGY BURST explodes from the launch point — trails of purple energy stream forward. The character's robes and cape are blown BACKWARD by the recoil force. The staff orb is dim (energy spent). The body leans far forward from the thrust.

Frame 4 (RECOVERY): Wings slowly return to NEUTRAL resting position. Arms lower back to sides. The staff returns to the LEFT hand at rest. Faint purple wisps fade away where the orb was launched. Robes settle. Body returns to upright hovering pose. Staff orb begins to recharge with faint glow.

The magical energy must be CLEARLY VISIBLE in frames 2-3 and completely absent in frames 1 and 4. The wing positions also change: WIDE → INWARD → SNAPPED BACK → NEUTRAL.
```

---

## 보스 스프라이트 생성 시 주의사항

1. **프레임 크기**: 보스는 일반 캐릭터(500×600px)보다 크게 — **700×900px/프레임** 권장 (2×2 시트 = 1400×1800px)
2. **보스 1 (기마)**: 말+기수가 하나의 유닛. 말 몸체, 다리, 기수, 검, 망토 모두 포함
3. **보스 2 (날개)**: 큰 박쥐 날개가 몸 양옆으로 크게 펼쳐짐. 날개 전체가 프레임 안에 들어가야 함
4. **구분선 엄수**: 보스가 크기 때문에 구분선 넘김 위험이 높음 — 마진 충분히 확보
5. **공통 스타일 프리픽스의 프레임 크기를 700×900px로 수정**하여 사용:
   ```
   Each frame should be the same size (approximately 700x900px per frame),
   arranged in a 2x2 grid (top-left = frame 1, top-right = frame 2,
   bottom-left = frame 3, bottom-right = frame 4).
   ```
6. **보스 글로우**: Boss 1 = 빨간 글로우, Boss 2 = 보라 글로우 — 발밑/배경에 은은하게 표현
7. **"다른 포즈" 강조**: 프롬프트에 반드시 "Each frame must show a DIFFERENT POSE" / "NOT 4 copies" 명시. AI가 참조 이미지를 복사하는 것을 방지
8. **핵심 변화 요소 지정**: 각 프레임에서 뭐가 변하는지 구체적으로 명시 (말 다리 위치, 날개 각도, 검 위치 등)

## 프롬프트 사용 팁

1. **새 캐릭터** - 해당 캐릭터의 정적 이미지(`public/img/units/` 또는 `RPG/heroes/`)를 참조로 첨부
2. **기존 스프라이트 수정 (전사/궁수)** - 기존 2×2 스프라이트 시트를 참조로 첨부 + "기존 스프라이트 수정 프롬프트" 사용
3. **Tier 2** - "Based on this Tier 2 version of the character" 명시 + tier2 이미지 첨부
4. **일관성** - 한 캐릭터의 모든 모션을 연속 생성하면 스타일 일관성 향상
5. **크기 통일** - "Each frame approximately 500x600px" 필수
6. **2×2 그리드** - 모든 시트는 2×2 배열 (좌상→우상→좌하→우하 = 프레임 1→2→3→4)
7. **프레임 경계** - 무기/이펙트가 프레임 경계를 넘지 않도록 반드시 확인
8. **캐릭터 크기** - 4프레임 모두 캐릭터 크기가 동일해야 함 (웅크린 포즈도 동일 스케일)

## 에셋 파일 위치

| 경로 | 설명 |
|------|------|
| `public/img/units/melee.png` | 전사 기본 |
| `public/img/units/ranged.png` | 궁수 기본 |
| `public/img/units/knight.png` | 기사 기본 |
| `public/img/units/mage.png` | 마법사 기본 |
| `public/img/units/RPG/heroes/{name}.png` | 전직 Tier 1 |
| `public/img/units/RPG/heroes/{name}2.png` | 전직 Tier 2 |
| `public/img/units/boss.png` | 보스 1 (기마 해골 기사) |
| `public/img/units/RPG/heroes/boss2.png` | 보스 2 (날개 달린 해골 마법사) |
| `public/img/units/RPG/skill_icon/` | 스킬 아이콘 |
