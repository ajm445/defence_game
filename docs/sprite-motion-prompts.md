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

렌더 크기 40×50px 기준, 과도한 프레임은 시각적 차이 미미 + 에셋 용량 증가.

| 모션 | 프레임 수 | 용도 |
|------|----------|------|
| **Idle (대기)** | 4 | 호흡/출렁임 루프 |
| **Walk (이동)** | 4 | 걷기 사이클 루프 |
| **Basic Attack (기본공격)** | 4 | 예비→스윙→타격→복귀 |
| **W Skill** | 4 | 스킬별 고유 모션 |
| **E Skill** | 4 | 스킬별 고유 모션 |
| **Hit (피격)** | 2 | 빠른 경직 |
| **Death (사망)** | 3 | 쓰러지는 시퀀스 |
| **Stun (기절)** | 2 | 비틀거리는 루프 |

**캐릭터당 총 27프레임** (다크나이트만 E_off 2프레임 추가 → 29프레임)

---

## 전체 필요 스프라이트 시트 목록

| # | 캐릭터 | 모션 수 | 프레임 합계 |
|---|--------|---------|------------|
| **기본 직업** | | | |
| 1 | Warrior (전사) | 8 | 27 |
| 2 | Archer (궁수) | 8 | 27 |
| 3 | Knight (기사) | 8 | 27 |
| 4 | Mage (마법사) | 8 | 27 |
| **전직** | | | |
| 5 | Berserker (버서커) | 8 | 27 |
| 6 | Guardian (가디언) | 8 | 27 |
| 7 | Sniper (저격수) | 8 | 27 |
| 8 | Ranger (레인저) | 8 | 27 |
| 9 | Paladin (팔라딘) | 8 | 27 |
| 10 | DarkKnight (다크나이트) | 9 | 29 |
| 11 | Archmage (대마법사) | 8 | 27 |
| 12 | Healer (힐러) | 8 | 27 |

**Tier 1 총합**: 326프레임 (98개 스프라이트 시트)
**Tier 2 추가 시**: +218프레임 (64개 스프라이트 시트)
**최종 합계**: ~544프레임, ~162개 스프라이트 시트

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
- **Tier 1**: 검은+금 풀 헬멧(붉은 깃털), 모닝스타(플레일), 금+나무 대형 방패(사자), 붉은 망토
- **Tier 2**: 은+금+파란보석 헬멧(파란 깃털+날개+용), 모닝스타(파란보석), 은+금+파란보석 대형 방패, 파란 에너지
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
| Q | 플레일 강타 | 80px AoE, Q 적중 시 W 쿨감 1초 | 모닝스타 내려치기 |
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
Create a horizontal sprite sheet on a transparent background.
The art style must exactly match the reference image:
chibi/super-deformed (2-3 head proportions), skeleton/skull face
with large black hollow eyes, thick black outlines, cartoon-style
shading, detailed equipment. Each frame should be the same size
(approximately 500x600px per frame), arranged left-to-right in
a single horizontal row. The character faces RIGHT in all frames.
Maintain perfect consistency in character design, colors,
proportions, and equipment details across all frames.
```

---

### 1. WARRIOR (전사)

#### 1-1. Idle (4프레임)
```
Generate a 4-frame idle animation sprite sheet for this chibi skeleton warrior character.

Character: A cute chibi skeleton warrior wearing a gray riveted iron helmet,
chainmail armor with a brown tunic, brown leather belt with buckle, and brown
boots. He holds a short iron sword in his right hand and a small round wooden
shield with metal rim in his left hand. His face is a white skull with large
black hollow eyes and a small frowning mouth.

Frame 1: Standing neutral pose, slight lean.
Frame 2: Very subtle downward body shift (breathing in) - body lowers ~2px, sword arm relaxes slightly.
Frame 3: Return to neutral pose.
Frame 4: Very subtle upward body shift (breathing out) - body raises ~2px, slight helmet tilt.

Gentle, subtle breathing loop. Minimal movement.
```

#### 1-2. Walk (4프레임)
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

#### 1-3. Basic Attack - 강타 (4프레임)
```
Generate a 4-frame melee attack sprite sheet for this chibi skeleton warrior.

Character: [Warrior 외형]

Frame 1 (Anticipation): Leans back, sword raised behind head. Shield close to body.
Frame 2 (Swing): Lunges forward, sword sweeping in wide horizontal arc. Strong forward lean.
Frame 3 (Impact): Sword fully extended forward-downward at end of slash arc. Maximum extension. Motion blur near sword tip.
Frame 4 (Recovery): Returns to neutral, sword coming back to rest.

Powerful but cute. Wide AoE slash (120-degree arc). 80px range melee.
```

#### 1-4. W Skill - 돌진 Charge (4프레임)
```
Generate a 4-frame charge/dash attack sprite sheet for this chibi skeleton warrior.

Character: [Warrior 외형]

Frame 1 (Prepare): Crouches low, body angled forward ~30 degrees. Shield raised in front, sword tucked behind.
Frame 2 (Launch): Body shoots forward. Extreme forward lean (~60 degrees). Shield leading, sword trailing. One foot off ground.
Frame 3 (Rushing): Full dash mid-flight. Body almost horizontal. Shield as battering ram. Both feet off ground. Motion blur.
Frame 4 (Landing): Skidding to stop. Sword swings forward for finishing slash. Body returning upright.

200px forward dash attack. Convey speed and power.
```

#### 1-5. E Skill - 광전사 Berserker Rage (4프레임)
```
Generate a 4-frame power-up buff activation sprite sheet for this chibi skeleton warrior.

Character: [Warrior 외형]

Frame 1 (Channel): Plants feet wide, sword pointed down into ground. Head tilted up. Arms tensed.
Frame 2 (Power surge): Body glows orange-red (#ff6b35). Fists clenched, sword raised. Flame particles around body. Eyes glow orange.
Frame 3 (Eruption): Maximum energy burst - flames emanating from character. Sword raised high. Intense orange-red aura. Aggressive stance.
Frame 4 (Empowered): Battle-ready aggressive stance with flame effects on hands/sword. Eyes glowing. Wider stance, sword forward.

Berserker rage buff (attack +50%, speed +30%). Wild and powerful.
```

#### 1-6. Hit (2프레임)
```
Generate a 2-frame hit reaction sprite sheet for this chibi skeleton warrior.

Character: [Warrior 외형]

Frame 1: Recoils backward from impact. Head snaps back, body leans away. Shield arm flinches up. Impact star near body.
Frame 2: Hunched from pain. Body compressed. Eyes squeezed smaller. Vibration on outline.
```

#### 1-7. Death (3프레임)
```
Generate a 3-frame death animation sprite sheet for this chibi skeleton warrior.

Character: [Warrior 외형]

Frame 1: Stumbles, leaning far backward. Sword dropping. Shield tilting. Eyes wide in shock.
Frame 2: Falling sideways/backward. Nearly horizontal. Equipment separating. Eyes X-shaped.
Frame 3: Collapsed on ground. Sword and shield nearby. Ghost wisps rising. Semi-transparent.
```

#### 1-8. Stun (2프레임)
```
Generate a 2-frame stun/daze loop sprite sheet for this chibi skeleton warrior.

Character: [Warrior 외형]

Frame 1: Swaying left ~15 degrees. Spiral/dizzy eyes. Sword drooping. Yellow stars above head.
Frame 2: Swaying right ~15 degrees. Different spiral angle. Stars shifted.
```

---

### 2. ARCHER (궁수)

#### 2-1. Idle (4프레임)
```
Generate a 4-frame idle sprite sheet for this chibi skeleton archer.

Character: A cute chibi skeleton archer wearing a gray riveted iron helmet,
dark green tunic, brown leather arm guards, and brown boots. He holds a
wooden bow with a nocked arrow. White skull face with large black hollow eyes.

Frame 1: Standing neutral, bow held down at rest, arrow loosely nocked.
Frame 2: Subtle body bob down, bow arm relaxes.
Frame 3: Return to neutral.
Frame 4: Subtle body bob up, slight head tilt.

Gentle breathing idle loop. Bow held but not drawn.
```

#### 2-2. Walk (4프레임)
```
Generate a 4-frame walk cycle sprite sheet for this chibi skeleton archer.

Character: [Archer 외형]

Frame 1: Right foot forward, left back. Bow held diagonally across body. Slight forward lean.
Frame 2: Feet passing center. Body at peak height.
Frame 3: Left foot forward, right back.
Frame 4: Feet passing center. Body at lowest point.

Light, quick footsteps - fastest class. Bouncy chibi walk.
```

#### 2-3. Basic Attack - 속사 (4프레임)
```
Generate a 4-frame bow shot sprite sheet for this chibi skeleton archer.

Character: [Archer 외형]

Frame 1 (Nock): Pulling arrow from behind, placing on bowstring. Bow arm extended.
Frame 2 (Draw): Full draw - bowstring pulled back near skull face. Bow bends visibly.
Frame 3 (Release): Arrow released - fingers opening, bowstring snapping. Arrow visible leaving bow. Slight forward lunge.
Frame 4 (Recovery): Follow-through. Bow arm extended, draw hand relaxing. Bowstring vibrating.

Clean, snappy ranged attack. Arrow visible in frames 1-3. 180px range.
```

#### 2-4. W Skill - 관통 화살 Pierce Arrow (4프레임)
```
Generate a 4-frame piercing shot sprite sheet for this chibi skeleton archer.

Character: [Archer 외형]

Frame 1 (Charge): Feet planted wide, drawing special glowing green (#22c55e) arrow. Energy at arrowhead.
Frame 2 (Full Draw): Maximum drawback with glowing arrow. Green energy radiates. Eyes flash green.
Frame 3 (Fire): Explosive release - glowing arrow launches with green energy trail. Strong recoil.
Frame 4 (Follow-through): Recovers from shot. Green wisps dissipating.

Pierces all enemies in 300px line. Much more powerful than basic attack. Green (#22c55e) energy.
```

#### 2-5. E Skill - 화살 비 Arrow Storm (4프레임)
```
Generate a 4-frame rain of arrows ultimate sprite sheet for this chibi skeleton archer.

Character: [Archer 외형]

Frame 1 (Aim Up): Bow angled sharply upward (~70 degrees). Glowing arrow pointing at sky.
Frame 2 (Channel): Multiple arrows materialize - 3-4 ghostly green arrows floating, all pointing up. Green aura intensifies.
Frame 3 (Mass Launch): All arrows fire upward simultaneously. Massive green burst.
Frame 4 (Complete): Returns to stance. Green particles fading upward. Confident pose.

Summons arrow rain on 150px radius target area. Dramatic ultimate.
```

#### 2-6~2-8. Hit/Death/Stun
> Warrior 공통 모션 템플릿 참조, 캐릭터 설명만 Archer로 교체

---

### 3. KNIGHT (기사)

#### 3-1. Idle (4프레임)
```
Generate a 4-frame idle sprite sheet for this chibi skeleton knight (tank).

Character: A cute chibi skeleton knight with an oversized round wooden shield
covering most of his body. Gray riveted iron helmet, green tunic, brown boots.
VERY large black eyes appearing timid/shy, peeking over the shield top.
Shield has metal rim with center boss. He hides behind the shield.

Frame 1: Peeking over shield, eyes visible.
Frame 2: Sinking lower behind shield, only top of skull/eyes visible. Shy breathing.
Frame 3: Rising back to frame 1 position.
Frame 4: Slight shield tilt, body shifts. Still peeking.

Timid/tank personality - always hiding behind his big shield.
```

#### 3-2. Walk (4프레임)
```
Generate a 4-frame walk cycle sprite sheet for this chibi skeleton knight.

Character: [Knight 외형]

Frame 1: Right foot forward. Shield held in front while waddling.
Frame 2: Body bobs up. Shield bounces.
Frame 3: Left foot forward. Shield tilts with movement.
Frame 4: Body bobs down. Heavy landing.

Slow, heavy walk - slowest class. Big shield bounces/sways each step.
```

#### 3-3. Basic Attack - 방패 타격 (4프레임)
```
Generate a 4-frame shield bash sprite sheet for this chibi skeleton knight.

Character: [Knight 외형]

Frame 1 (Wind-up): Pulls shield back, small mace visible behind it. Body crouches.
Frame 2 (Thrust): Shoves massive shield forward. Full body extends behind push.
Frame 3 (Impact): Shield at max extension. Impact stars/shockwave at edge.
Frame 4 (Recovery): Shield pulling back to defensive position. Returns to hiding.

Attacks WITH the shield. Heavy and impactful. 80px range, W cooldown reduction on hit.
```

#### 3-4. W Skill - 방패 돌진 Shield Charge (4프레임)
```
Generate a 4-frame shield charge sprite sheet for this chibi skeleton knight.

Character: [Knight 외형]

Frame 1 (Brace): Crouches behind shield. Blue (#3b82f6) energy on shield edge.
Frame 2 (Charge): Lunges forward shield-first. Blue energy trail. Cape billowing.
Frame 3 (Ramming): Full speed. Shield glowing blue. Body nearly horizontal behind shield.
Frame 4 (Slam): Impact pose. Blue shockwave. Stun stars at impact.

150px dash + 2-second stun. Blue (#3b82f6) energy.
```

#### 3-5. E Skill - 철벽 방어 Iron Defense (4프레임)
```
Generate a 4-frame ultimate defense sprite sheet for this chibi skeleton knight.

Character: [Knight 외형]

Frame 1 (Plant): Slams shield on ground. Blue energy ripple from impact.
Frame 2 (Channel): Blue energy erupts upward from shield. Kneeling behind shield.
Frame 3 (Full Power): Massive blue dome fully expanded. Stands tall (not hiding for once!). Shield raised proudly. Blue particles radiating outward.
Frame 4 (Sustain): Blue shield barrier sustained. Confident defensive stance. Blue energy pulsing.

Team HP 20% heal + 70% damage reduction for 5 seconds. Protective, noble.
```

#### 3-6~3-8. Hit/Death/Stun
> 공통 모션 템플릿 참조, Knight 외형으로 교체

---

### 4. MAGE (마법사)

#### 4-1. Idle (4프레임)
```
Generate a 4-frame idle sprite sheet for this chibi skeleton mage.

Character: A cute chibi skeleton mage with a large dark navy wizard hat
decorated with white stars and crescent moons. Gray-white beard and mustache
over skull face with large black hollow eyes. Dark navy robe with star/moon
patterns. Wooden staff with glowing purple (#a855f7) energy orb on top.

Frame 1: Standing neutral, staff upright. Purple orb glows steadily.
Frame 2: Subtle body sway, orb pulses brighter. Beard shifts.
Frame 3: Return to neutral, orb dims slightly.
Frame 4: Slight hat wobble, orb pulses again.

Mystical idle with staff orb pulsing rhythmically.
```

#### 4-2. Walk (4프레임)
```
Generate a 4-frame walk cycle sprite sheet for this chibi skeleton mage.

Character: [Mage 외형]

Frame 1: Right foot forward under robe. Staff as walking stick, slightly ahead. Robe sways.
Frame 2: Feet center. Body rises. Robe billows. Hat tips.
Frame 3: Left foot forward. Staff plants. Robe sways opposite.
Frame 4: Feet center. Body lowers. Robe settles.

Wizard shuffling walk. Robe and hat sway with movement.
```

#### 4-3. Basic Attack - 마법 화살 (4프레임)
```
Generate a 4-frame magic missile sprite sheet for this chibi skeleton mage.

Character: [Mage 외형]

Frame 1 (Gather): Raises staff, purple orb brightens. Free hand extends with fingers spread. Purple energy gathers.
Frame 2 (Channel): Purple energy concentrates into missile shape at staff tip. Leans into cast. Eyes glow faintly purple.
Frame 3 (Fire): Purple missile launches from staff. Energy burst at tip. Slight recoil.
Frame 4 (Recovery): Staff lowering. Purple energy dissipating. Return to rest.

Elegant magical ranged attack. Purple (#a855f7). 210px range - longest in game.
```

#### 4-4. W Skill - 화염구 Fireball (4프레임)
```
Generate a 4-frame fireball spell sprite sheet for this chibi skeleton mage.

Character: [Mage 외형]

Frame 1 (Conjure): Staff raised. Fire ball forming between staff and free hand. Orange-red flames.
Frame 2 (Grow): Fireball grows larger. Character strains. Hat/beard blown by heat. Orange-red (#ff6b35) swirling.
Frame 3 (Launch): Hurls massive fireball forward. Both arms thrust. Trail of flames. Robes pushed back.
Frame 4 (Aftermath): Smoke wisps from staff/hand. Robes settling. Ember particles lingering.

Powerful AoE - 80px explosion. Orange-red fire contrasting usual purple.
```

#### 4-5. E Skill - 운석 낙하 Meteor Shower (4프레임)
```
Generate a 4-frame ultimate meteor spell sprite sheet for this chibi skeleton mage.

Character: [Mage 외형]

Frame 1 (Ritual): Plants staff on ground. Both hands raised to sky. Purple and orange magic circles at feet.
Frame 2 (Channel): Intense energy spiraling upward. Staff floating. Runes/symbols visible. Hat and beard floating from energy.
Frame 3 (Summon): Arms thrust skyward. Massive portal/magic circle above. Meteor silhouettes descending.
Frame 4 (Command): One arm pointing forward (directing meteors). Energy streams connecting to sky. Powerful pose.

Most powerful spell - 400% damage, 150px radius. 3-second cast. Devastating, epic.
```

#### 4-6~4-8. Hit/Death/Stun
> 공통 모션 템플릿 참조, Mage 외형으로 교체

---

### 5. BERSERKER (버서커) - Warrior 전직

#### 5-1. Idle (4프레임)
```
Generate a 4-frame idle sprite sheet for this chibi skeleton berserker.

Character: A chibi skeleton berserker in ornate black armor with gold trim,
full enclosed helmet with red feather plume. One eye visible through visor.
Large two-handed steel greatsword on right shoulder. Brown wooden shield
with golden lion emblem on left arm. Chainmail, dark green tunic.

Frame 1: Standing with greatsword on shoulder. Menacing forward lean.
Frame 2: Body shifts, sword adjusts. Subtle breathing.
Frame 3: Return to neutral. Eye narrows.
Frame 4: Weight shifts. Sword re-gripped.

Aggressive, ready-to-fight idle. More menacing than base warrior.
```

#### 5-2. Walk (4프레임)
```
Generate a 4-frame walk cycle sprite sheet for this chibi skeleton berserker.

Character: [Berserker 외형]

Frame 1-4: Heavy, aggressive marching. Greatsword on shoulder while walking.
Red plume bounces. Heavier footfalls than base warrior.
```

#### 5-3. Basic Attack - 대검 강타 (4프레임)
```
Generate a 4-frame greatsword slash sprite sheet for this chibi skeleton berserker.

Character: [Berserker 외형]

Frame 1 (Wind-up): Lifts greatsword high overhead with both hands. Body twists back. Shield strapped to arm.
Frame 2 (Downswing): Massive downward-diagonal slash. Red (#ff3300) slash trail following blade.
Frame 3 (Impact): Greatsword at full extension, 120-degree arc complete. Ground crack. Red energy burst.
Frame 4 (Recovery): Pulling greatsword back to shoulder. Red energy fading.

Heavier, slower, more devastating than base warrior. Red (#ff3300) energy.
```

#### 5-4. W Skill - 피의 돌진 Blood Rush (4프레임)
```
Generate a 4-frame blood rush dash sprite sheet for this chibi skeleton berserker.

Character: [Berserker 외형]

Frame 1 (Crouch): Deep crouch, greatsword held low. Dark red (#ff3300) blood energy swirling on blade. Eye glows red.
Frame 2 (Launch): Explosive forward dash. Greatsword leading like lance. Blood-red trail. Body nearly horizontal.
Frame 3 (Rushing): Full speed with blood energy coating body. Red afterimages trailing behind.
Frame 4 (Slash-through): Finishing slash as momentum ends. Blood energy explodes outward. Red particles scatter.

200px dash with lifesteal (50% healed). Blood/dark red. More aggressive than warrior's charge.
```

#### 5-5. E Skill - 광란 Rage (4프레임)
```
Generate a 4-frame rage activation sprite sheet for this chibi skeleton berserker.

Character: [Berserker 외형]

Frame 1 (Roar): Head tilted back roaring. Greatsword planted in ground. Red energy cracks on armor.
Frame 2 (Power Surge): Red-orange flames erupt from body. Armor glows red. Eye blazes crimson.
Frame 3 (Full Rage): Engulfed in crimson fire. Greatsword wreathed in flames. Berserk aura at max. Character appears larger.
Frame 4 (Battle Ready): Enraged combat stance. Continuous flames. Greatsword aggressive in both hands. Red eye burning.

+80% attack/speed, +50% damage taken. Terrifyingly powerful but reckless. Crimson fire.
```

#### 5-6~5-8. Hit/Death/Stun
> 공통 모션 템플릿 참조, Berserker 외형으로 교체

---

### 6. GUARDIAN (가디언) - Warrior 전직

#### 6-1. Idle (4프레임)
```
Generate a 4-frame idle sprite sheet for this chibi skeleton guardian.

Character: A chibi skeleton guardian in heavy black and gold armor,
full enclosed helmet with red plume, red cape. Spiked flail/morningstar
in right hand. Ornate large shield with golden lion emblem in left.
Very bulky, tanky appearance.

Frame 1: Standing solid. Flail hanging at side. Shield forward. Immovable presence.
Frame 2: Subtle weight shift. Cape sways. Flail chain clinks.
Frame 3: Return to neutral. Blue (#00aaff) energy glimmers on shield.
Frame 4: Slight readjustment. Cape settles.

Rock-solid defensive idle. Immovable guardian feel.
```

#### 6-2. Walk (4프레임)
```
Generate a 4-frame walk cycle sprite sheet for this chibi skeleton guardian.

Character: [Guardian 외형]

Frame 1-4: Very heavy, deliberate march. Shield always forward.
Flail swings gently with each step. Cape flows behind. Ground-shaking steps.
```

#### 6-3. Basic Attack - 플레일 강타 (4프레임)
```
Generate a 4-frame flail smash sprite sheet for this chibi skeleton guardian.

Character: [Guardian 외형]

Frame 1 (Wind-up): Swings flail backward in circular motion overhead. Shield braced. Chain extends.
Frame 2 (Overhead): Flail at top of arc, chain fully extended above head. Loading power.
Frame 3 (Smash): Flail crashes downward. Blue (#00aaff) impact sparks. Ground cracks.
Frame 4 (Recovery): Flail bounces back. Chain going slack. Return to guard stance.

Heavy crushing melee. Each hit reduces W cooldown by 1 second. Blue (#00aaff).
```

#### 6-4. W Skill - 수호의 돌진 Guardian Rush (4프레임)
```
Generate a 4-frame guardian shield charge sprite sheet for this chibi skeleton guardian.

Character: [Guardian 외형]

Frame 1 (Brace): Hunkers behind shield. Blue (#00aaff) energy barrier on shield surface.
Frame 2 (Charge): Rushes forward shield-first. Blue shockwave ahead. Cape billowing.
Frame 3 (Ram): Shield slam with blue energy explosion. Protective blue dome forming.
Frame 4 (Protect): Protective stance. Blue dome expands to cover allies. Shield raised proudly.

150px dash + 2-second stun + ally damage reduction. Blue (#00aaff).
```

#### 6-5. E Skill - 보호막 Shield (4프레임)
```
Generate a 4-frame team shield ultimate sprite sheet for this chibi skeleton guardian.

Character: [Guardian 외형]

Frame 1 (Plant): Slams shield into ground edge-first. Blue ripple from impact.
Frame 2 (Channel): Blue energy erupts from shield upward. Kneeling in concentration.
Frame 3 (Dome): Massive blue energy dome fully forms. Stands tall in center. Shield levitates.
Frame 4 (Sustain): Dome established. Vigilant stance. Blue particles floating inside.

Team 50% damage reduction for 5 seconds. Impenetrable fortress.
```

#### 6-6~6-8. Hit/Death/Stun
> 공통 모션 템플릿 참조, Guardian 외형으로 교체

---

### 7. SNIPER (저격수) - Archer 전직

#### 7-1. Idle (4프레임)
```
Generate a 4-frame idle sprite sheet for this chibi skeleton sniper.

Character: A chibi skeleton sniper with a dark ornate helmet with wing
decorations and skull emblem, dark green tunic with dark armor, brown boots.
Holds a large scoped crossbow/rifle-style weapon with both hands.
White skull face with large black eyes.

Frame 1: Standing with crossbow-rifle held across body. Alert, watchful.
Frame 2: Subtle adjustment of weapon. Eyes scanning.
Frame 3: Return to neutral. Scope glints.
Frame 4: Weight shift. Weapon re-gripped.

Tactical, precise idle. Always scanning for targets.
```

#### 7-2. Walk (4프레임)
```
Generate a 4-frame walk cycle sprite sheet for this chibi skeleton sniper.

Character: [Sniper 외형]

Frame 1-4: Careful, tactical walking. Crossbow-rifle held ready at hip level.
Head on a swivel. Precise footsteps. Military-style movement.
```

#### 7-3. Basic Attack - 정밀 사격 (4프레임)
```
Generate a 4-frame precision shot sprite sheet for this chibi skeleton sniper.

Character: [Sniper 외형]

Frame 1 (Aim): Raises crossbow-rifle, looking through scope. One eye closes. Body steadies.
Frame 2 (Lock): Perfect aim. Scope glints. Purple (#9933ff) targeting reticle at muzzle. Perfectly still.
Frame 3 (Fire): Fires - purple energy muzzle flash. Slight recoil. Purple tracer from barrel.
Frame 4 (Cycle): Chambering next round. Recovering from recoil. Ready for next shot.

50% critical hit chance (2x damage). Purple (#9933ff). Tactical/precise.
```

#### 7-4. W Skill - 후방 도약 Backflip Shot (4프레임)
```
Generate a 4-frame backflip evasion shot sprite sheet for this chibi skeleton sniper.

Character: [Sniper 외형]

Frame 1 (Trigger): Pushes off ground backward. Crossbow aimed at target while body begins flipping.
Frame 2 (Mid-flip): Upside-down in mid-backflip. Firing crossbow while inverted - purple bolt launching forward.
Frame 3 (Descent): Completing flip, rotating right-side-up. Purple speed aura appears on legs.
Frame 4 (Land): Smooth landing 150px behind. Kneeling pose. Purple swiftness aura on legs (speed buff). Crossbow ready.

Jump backward 150px while shooting + speed buff. Agile, tactical. Purple (#9933ff).
```

#### 7-5. E Skill - 저격 Snipe (4프레임)
```
Generate a 4-frame ultimate snipe sprite sheet for this chibi skeleton sniper.

Character: [Sniper 외형]

Frame 1 (Set up): Drops to one knee. Crossbow-rifle deployed on support. Scope extended. Aiming at distant target.
Frame 2 (Aim): Looking through scope intently. Purple (#9933ff) laser sight beam extending infinitely forward. Energy charging. Eye glows purple.
Frame 3 (Charge): Weapon fully charged with intense purple energy. Barrel glows. Runes around weapon. Maximum concentration.
Frame 4 (Fire): MASSIVE shot - enormous purple energy beam launches. Extreme recoil. Huge muzzle flash. Ground cracks beneath.

Boss-only, 1000% damage, 3-second channel, infinite range. Most powerful single-target attack. Devastating purple beam.
```

#### 7-6~7-8. Hit/Death/Stun
> 공통 모션 템플릿 참조, Sniper 외형으로 교체

---

### 8. RANGER (레인저) - Archer 전직

#### 8-1. Idle (4프레임)
```
Generate a 4-frame idle sprite sheet for this chibi skeleton ranger.

Character: A chibi skeleton ranger with ornate dark helmet with wing
decorations and skull emblem, dark green tunic with dark armor, brown boots,
quiver of arrows on back. Wields a wooden longbow.
White skull face with large black eyes.

Frame 1: Standing relaxed but alert. Bow at side. One hand on quiver.
Frame 2: Body shifts. Fingers brush arrow feathers in quiver.
Frame 3: Return to neutral. Eyes scanning.
Frame 4: Weight shift. Bow tapped against leg.

Seasoned hunter idle. Casual readiness.
```

#### 8-2. Walk (4프레임)
```
Generate a 4-frame walk cycle sprite sheet for this chibi skeleton ranger.

Character: [Ranger 외형]

Frame 1-4: Swift, light-footed walk. Bow in one hand, other hand near quiver.
Nimble, ranger-style movement. Quick steps.
```

#### 8-3. Basic Attack - 다중 사격 (4프레임)
```
Generate a 4-frame multi-target bow attack sprite sheet for this chibi skeleton ranger.

Character: [Ranger 외형]

Frame 1 (Nock multiple): Rapidly draws 3 arrows simultaneously from quiver, places on bowstring. Quick, practiced.
Frame 2 (Multi-draw): Pulls back all 3 arrows. Bow bends wide. Amber (#ff9922) energy on arrowheads. Spread angle visible.
Frame 3 (Release spread): All arrows fire in fan pattern. Amber energy trails in different directions. Bowstring snaps.
Frame 4 (Recovery): Hand already reaching for next arrows. Amber wisps fading.

Hits up to 5 targets simultaneously. Fast multi-shot. Amber (#ff9922).
```

#### 8-4. W Skill - 다중 화살 Multi Arrow (4프레임)
```
Generate a 4-frame fan barrage sprite sheet for this chibi skeleton ranger.

Character: [Ranger 외형]

Frame 1 (Load): Draws 5 glowing amber arrows. Arranges in fan formation on bowstring.
Frame 2 (Full Draw): Bow at max tension with 5 glowing arrows in 45-degree fan. Amber (#ff9922) energy at peak.
Frame 3 (Volley): All 5 fire in cone/fan pattern. 5 amber energy trails spreading. Massive energy release.
Frame 4 (Follow-through): Bow hand extended. 5 amber trails visible. Quick recovery.

5 arrows in 45-degree fan, each 100% damage, 300px piercing. Amber (#ff9922).
```

#### 8-5. E Skill - 화살 폭풍 Arrow Storm (4프레임)
```
Generate a 4-frame rapid-fire buff sprite sheet for this chibi skeleton ranger.

Character: [Ranger 외형]

Frame 1 (Focus): Focused stance, feet wide. Amber energy spiraling around body. Bow humming. Eyes glow amber.
Frame 2 (Activate): Amber energy explodes outward. Speed-enhanced state. Afterimage effect. Arrows in quiver glow.
Frame 3 (Rapid State): Dynamic action pose. Multiple ghostly afterimages showing rapid movement. Amber aura blazing.
Frame 4 (Sustained): Continuous rapid-fire state. Double speed arrows. Amber wind swirling. Energy arrows auto-replenishing.

6 seconds of double attack speed. Amber (#ff9922). Speed and volume of fire.
```

#### 8-6~8-8. Hit/Death/Stun
> 공통 모션 템플릿 참조, Ranger 외형으로 교체

---

### 9. PALADIN (팔라딘) - Knight 전직

#### 9-1. Idle (4프레임)
```
Generate a 4-frame idle sprite sheet for this chibi skeleton paladin.

Character: A chibi skeleton paladin in silver-and-gold round helmet with visor,
silver plate armor. Ornate round shield with golden lion emblem. Skull face
with large timid black eyes. Shy but holy. Golden light around shield.

Frame 1: Peeking over ornate shield. Golden sparkles around.
Frame 2: Slight holy glow pulse on shield. Body shifts.
Frame 3: Return to neutral. Golden particles float.
Frame 4: Shield adjusts. Holy aura dims then brightens.

Timid but holy. Golden divine energy around the shield.
```

#### 9-2. Walk (4프레임)
```
Generate a 4-frame walk cycle sprite sheet for this chibi skeleton paladin.

Character: [Paladin 외형]

Frame 1-4: Slow, dignified march. Shield forward with golden glow.
Holy sparkles trail behind. Heavy but graceful steps.
```

#### 9-3. Basic Attack - 신성 방패 타격 (4프레임)
```
Generate a 4-frame holy shield bash sprite sheet for this chibi skeleton paladin.

Character: [Paladin 외형]

Frame 1 (Prayer): Quick golden (#ffcc00) blessing on shield. Pulls shield back.
Frame 2 (Holy Strike): Shield thrusts forward with golden energy. Lion emblem emanates holy light.
Frame 3 (Impact): Shield at max extension. Golden healing pulse radiates outward toward allies. Holy cross/star at impact.
Frame 4 (Recovery): Shield returns. Golden healing particles float toward ally positions.

Each attack heals nearby allies 5% max HP. Gold (#ffcc00) holy energy.
```

#### 9-4. W Skill - 신성한 돌진 Holy Charge (4프레임)
```
Generate a 4-frame holy charge sprite sheet for this chibi skeleton paladin.

Character: [Paladin 외형]

Frame 1 (Bless): Golden cross above paladin. Shield radiates holy light. Crouching.
Frame 2 (Rush): Charges forward shield-first in golden holy fire. Golden trail. 150px dash.
Frame 3 (Heal Burst): Golden healing burst radiates. Crosses and light particles healing allies.
Frame 4 (Stand): Protective stance. Golden energy lingering. Shield glowing.

150px dash + 1.5-second stun + ally 10% heal. Gold (#ffcc00) holy.
```

#### 9-5. E Skill - 신성한 빛 Divine Light (4프레임)
```
Generate a 4-frame divine ultimate sprite sheet for this chibi skeleton paladin.

Character: [Paladin 외형]

Frame 1 (Kneel): Kneels, plants shield. Hands clasped in prayer. Golden light from above.
Frame 2 (Ascend): Holy energy descends in golden light pillar. Angelic wing silhouettes behind. Eyes glow gold.
Frame 3 (Radiate): Maximum power. Massive golden explosion. Holy crosses, halos, feathers. Character floats off ground. Healing 30% to ALL allies.
Frame 4 (Invincible): Golden invincibility barrier. Full team invincible 3 seconds. Golden dome of divine protection.

Team 30% heal + 3-second invincibility. Most powerful defensive ultimate. Divine, awe-inspiring. Gold (#ffcc00).
```

#### 9-6~9-8. Hit/Death/Stun
> 공통 모션 템플릿 참조, Paladin 외형으로 교체

---

### 10. DARK KNIGHT (다크나이트) - Knight 전직

#### 10-1. Idle (4프레임)
```
Generate a 4-frame dark idle sprite sheet for this chibi skeleton dark knight.

Character: A chibi skeleton dark knight in black armor with red glowing runes.
Helmet has gold trim with red runic inscriptions. Skull face with menacing
RED glowing eyes. Dark round shield with red-eyed golden lion. Short sword
wreathed in purple (#9900cc) energy. Dark mist/shadows at feet.

Frame 1: Standing menacingly. Purple sword energy flickers. Dark mist shifts.
Frame 2: Red eyes pulse brighter. Mist rises. Sword crackles.
Frame 3: Shadow tendrils reach outward. Eyes dim. Mist settles.
Frame 4: Armor runes pulse red. Sword energy shifts. Mist swirls opposite.

Dark, ominous. Purple and dark red. Living darkness around character.
```

#### 10-2. Walk (4프레임)
```
Generate a 4-frame walk cycle sprite sheet for this chibi skeleton dark knight.

Character: [DarkKnight 외형]

Frame 1-4: Menacing stride. Dark mist trails from feet with each step.
Purple sword energy flickers. Red eyes glow steadily. Ominous, heavy steps.
```

#### 10-3. Basic Attack - 흡혈 공격 (4프레임)
```
Generate a 4-frame life-stealing sword strike sprite sheet for this chibi skeleton dark knight.

Character: [DarkKnight 외형]

Frame 1 (Draw): Purple energy sword raised behind. Dark mist concentrates on blade. Red eyes blaze.
Frame 2 (Strike): Quick forward slash. Purple energy trail. Dark mist follows swing.
Frame 3 (Drain): Red life energy flows FROM enemy BACK to dark knight. Red/purple life-steal particles traveling to character.
Frame 4 (Absorb): Absorbs stolen life. Brief red glow. Purple sword stabilizes. Return to stance.

20% lifesteal on basic attacks. Dark purple sword + red lifesteal particles.
```

#### 10-4. W Skill - 암흑 찌르기 Dark Pierce (4프레임)
```
Generate a 4-frame dark piercing thrust sprite sheet for this chibi skeleton dark knight.

Character: [DarkKnight 외형]

Frame 1 (Sacrifice): Stabs own armor - sacrificing 20% HP. Red blood/energy splatters. Pain expression. Dark energy concentrates on sword.
Frame 2 (Channel): Sword transforms into massive dark purple lance of energy. Holds it back, channeling. Dark mist spirals. Purple runes on ground. 1-second cast.
Frame 3 (Thrust): Devastating forward thrust - dark energy lance extends 150px forward, 80px wide. Massive purple-black explosion. Ground shatters. 350% damage.
Frame 4 (Aftermath): Energy lance dissipating. Character recovering. Dark energy exhausted. Sword returns to normal.

1-sec cast, 20% HP cost, 350% damage, 150x80px area. Sacrificial, devastating. Dark purple (#9900cc).
```

#### 10-5. E Skill (ON) - 어둠의 칼날 활성화 Dark Blade (4프레임)
```
Generate a 4-frame dark blade toggle activation sprite sheet for this chibi skeleton dark knight.

Character: [DarkKnight 외형]

Frame 1 (Initiate): Raises sword skyward. Dark mist surges upward. Red eyes intensify to blazing crimson.
Frame 2 (Transform): Sword engulfed in dark purple flame. Surrounded by dark energy vortex (150px radius). HP starts draining (red particles leaving body).
Frame 3 (Active): Full Dark Blade mode - purple-black destruction aura in 150px radius. Sword is blazing dark energy blade. Continuous damage to nearby enemies. Dark flames and tendrils.
Frame 4 (Sustained): Sustained toggle state. Dark aura pulsing. Aggressive wide stance. HP slowly draining (red particles). Purple waves pulsing outward. Eyes burning red.

Toggle: HP drain 5%/sec, 120% attack/sec to enemies in 150px. Auto-off at HP≤10%. Dark purple (#9900cc) + crimson.
```

#### 10-6. E Skill (OFF) - 어둠의 칼날 해제 (2프레임)
```
Generate a 2-frame dark blade deactivation sprite sheet for this chibi skeleton dark knight.

Character: [DarkKnight 외형]

Frame 1 (Release): Dark energy rapidly collapsing. Aura shrinking. Flames extinguishing. Sword fading. Exhausted appearance.
Frame 2 (Deactivated): All dark energy gone. Fatigued stance. Sword back to faint purple. Mist reduced to minimal. Heavy breathing, slight slump.

Deactivation of toggle. 2-second cooldown. "Powering down" feel.
```

#### 10-7~10-9. Hit/Death/Stun
> 공통 모션 템플릿 참조, DarkKnight 외형으로 교체

---

### 11. ARCHMAGE (대마법사) - Mage 전직

#### 11-1. Idle (4프레임)
```
Generate a 4-frame idle sprite sheet for this chibi skeleton archmage.

Character: A chibi skeleton archmage with a large purple wizard hat decorated
with golden moons, stars, and golden band. Skull face with GLOWING PURPLE
EYES and gray-white beard/mustache. Purple robe with gold trim. Staff with
swirling purple energy orb in right hand. Left hand holds smaller floating
purple energy orb. Purple energy radiates from him.

Frame 1: Standing mystically. Both orbs glow. Purple energy ambient.
Frame 2: Orbs pulse brighter. Beard sways. Energy particles shift.
Frame 3: Return to neutral. Orbs dim slightly.
Frame 4: Hat wobbles. Orbs pulse in alternating pattern. Energy shifts.

Powerful mystical idle. Dual orbs pulsing. More intense than base mage.
```

#### 11-2. Walk (4프레임)
```
Generate a 4-frame walk cycle sprite sheet for this chibi skeleton archmage.

Character: [Archmage 외형]

Frame 1-4: Dignified wizardly walk. Both orbs float alongside.
Purple energy trails from movement. Robe and hat sway. Mystical presence.
```

#### 11-3. Basic Attack - 강화 마법 화살 (4프레임)
```
Generate a 4-frame empowered magic missile sprite sheet for this chibi skeleton archmage.

Character: [Archmage 외형]

Frame 1 (Gather): Both hands raised, staff orb and hand orb brighten. Purple energy spirals between them.
Frame 2 (Merge): Energy from both orbs merges into single large missile. Runes appear. Eyes blaze purple.
Frame 3 (Launch): Dual-handed release - massive purple missile fires. Much larger than base mage's. Double energy trail. Hat and beard blown back.
Frame 4 (Recovery): Energy returns to both orbs. Magical afterglow. Return to pose.

1.5x boss damage bonus. More powerful than base mage. Purple (#a855f7).
```

#### 11-4. W Skill - 폭발 화염구 Inferno (4프레임)
```
Generate a 4-frame inferno spell sprite sheet for this chibi skeleton archmage.

Character: [Archmage 외형]

Frame 1 (Conjure): Both hands create TWO fireballs spiraling around each other. Red-orange + purple swirling.
Frame 2 (Merge & Grow): Twin fireballs merge into massive inferno sphere. Nearly character-sized. Intense heat. Hat/beard blown.
Frame 3 (Launch): Hurls massive inferno - both hands thrust. Enormous fire+purple trail. 120px radius (50% larger than base). Burn particles scatter.
Frame 4 (Aftermath): Charred ground beneath. Smoke and embers rising. Purple flames on hands. Burn fire particles spread (3-sec burn DoT).

250% damage + 50% larger + 3-second burn DoT. Orange-red + purple.
```

#### 11-5. E Skill - 메테오 샤워 Meteor Shower (4프레임)
```
Generate a 4-frame ultimate meteor shower sprite sheet for this chibi skeleton archmage.

Character: [Archmage 외형]

Frame 1 (Ritual): Both arms raised in grand ritual. Staff floating. Multiple magic circles at feet AND above. Purple + orange spiraling. Most powerful casting.
Frame 2 (Open Portal): Massive dark portal in sky above. 10 glowing meteors behind portal. Purple lightning from edges. Maximum channeling effort.
Frame 3 (Rain): Meteors falling through portal. Multiple flaming rocks in 300px area. Fire trails. Purple and orange explosions. Arms directing devastation.
Frame 4 (Apocalypse): Peak destruction. Multiple simultaneous impacts. Purple energy connecting mage to impacts. Character floating from sheer power.

10 meteors over 5 seconds, each 300%, 100px radius, 300px total area. Most devastating AoE ultimate. Apocalyptic. Purple + orange fire.
```

#### 11-6~11-8. Hit/Death/Stun
> 공통 모션 템플릿 참조, Archmage 외형으로 교체

---

### 12. HEALER (힐러) - Mage 전직

#### 12-1. Idle (4프레임)
```
Generate a 4-frame idle sprite sheet for this chibi skeleton healer/priest.

Character: A chibi skeleton healer in white and blue hooded robe with gold
trim and cross patterns. Blue cross on hood. Skull face with warm brown/golden
eyes. Ornate white-gold-blue vestments. Golden staff with yellow gemstone
(trident-shaped head). Golden sparkles and runic symbols float around.
Holy, serene aura.

Frame 1: Standing serenely. Staff gem glows warmly. Golden sparkles. Peaceful.
Frame 2: Gentle sway. Sparkles shift. Green (#00ff88) healing aura at feet (passive).
Frame 3: Return to center. Faint green pulse radiating outward.
Frame 4: Hood shifts. Sparkles rearrange. Golden light pulses.

Serene, holy healing presence. Passive heal aura visible as subtle green glow at feet.
```

#### 12-2. Walk (4프레임)
```
Generate a 4-frame walk cycle sprite sheet for this chibi skeleton healer.

Character: [Healer 외형]

Frame 1-4: Gentle, graceful walk. Staff used as walking aid.
Golden sparkles trail behind. Healing aura follows.
Serene, calming movement. Robes flow gently.
```

#### 12-3. Basic Attack - 신성 마법 (4프레임)
```
Generate a 4-frame holy magic missile sprite sheet for this chibi skeleton healer.

Character: [Healer 외형]

Frame 1 (Gather): Raises staff, golden-green energy at gem. Free hand extends with holy light.
Frame 2 (Channel): Golden-green missile forms. Mix of offensive (gold) and healing (green) energy.
Frame 3 (Fire): Launches golden-green bolt at enemies. Holy light burst at launch.
Frame 4 (Recovery): Staff lowers. Green healing particles linger (passive aura). Return to serene pose.

Mint-green (#00ff88) + gold theme. Same power as base mage. 252px range.
```

#### 12-4. W Skill - 치유의 빛 Healing Light (4프레임)
```
Generate a 4-frame healing light spell sprite sheet for this chibi skeleton healer.

Character: [Healer 외형]

Frame 1 (Pray): Holds staff close, hands clasped in prayer. Golden-green energy gathering. Eyes close.
Frame 2 (Channel): Staff raised, releasing beam of pure green (#00ff88) healing light. Holy symbols in beam. Wide 150px beam.
Frame 3 (Dual Effect): Healing light hits area - enemies take damage (golden lightning in beam), ally silhouettes glow green (healing 15% HP).
Frame 4 (Fade): Beam fading. Green healing particles linger. Golden sparkles settling.

Damages enemies AND heals allies in same 150px area. Green healing + gold damage.
```

#### 12-5. E Skill - 생명의 샘 Spring of Life (4프레임)
```
Generate a 4-frame ultimate healing fountain sprite sheet for this chibi skeleton healer.

Character: [Healer 외형]

Frame 1 (Plant): Plants staff into ground. Kneels in prayer. Green energy erupts from ground. Holy runes circle healer.
Frame 2 (Spring): Beautiful fountain of green healing energy erupts. Liquid-like green flowing up and cascading down. 500px green aura spreads.
Frame 3 (Full Bloom): Spring of Life at full power. Lush green fountain. Flower/vine/life imagery. Healing waves pulsing outward. Character floating.
Frame 4 (Sustain): Sustained healing fountain. Green pulses every second (10% HP/sec to all in 500px). Prayer pose maintaining spring.

10 seconds of 10% HP/sec to all allies in 500px. Follows healer. Strongest sustained healing. Miracle of life. Green (#00ff88) + gold.
```

#### 12-6~12-8. Hit/Death/Stun
> 공통 모션 템플릿 참조, Healer 외형으로 교체

---

## 공통 모션 템플릿 (Hit/Death/Stun)

모든 캐릭터에 동일한 구조. **[직업명]**과 **[외형 설명]**만 교체.

### Hit (피격) - 2프레임
```
Generate a 2-frame hit reaction sprite sheet for this chibi skeleton [직업명].

Character: [외형 설명]

Frame 1: Recoils backward from impact. Head snaps back, body leans away.
[무기] arm flinches. Small impact star near body.
Frame 2: Hunched from pain. Body compressed. Eyes squeezed smaller.
Vibration on body outline.
```

### Death (사망) - 3프레임
```
Generate a 3-frame death animation sprite sheet for this chibi skeleton [직업명].

Character: [외형 설명]

Frame 1: Stumbles backward. [무기] dropping. Eyes wide in shock.
Frame 2: Falling sideways. Equipment separating. Eyes X-shaped/dark.
Frame 3: Collapsed on ground. Ghost wisps rising. Semi-transparent.
Equipment scattered nearby.
```

### Stun (기절) - 2프레임
```
Generate a 2-frame stun/daze loop sprite sheet for this chibi skeleton [직업명].

Character: [외형 설명]

Frame 1: Swaying left ~15 degrees. Spiral/dizzy eyes. [무기] drooping.
Yellow stars circling above head.
Frame 2: Swaying right ~15 degrees. Different spiral angle.
Stars shifted position.
```

---

## 프롬프트 사용 팁

1. **참조 이미지 첨부 필수** - 해당 캐릭터의 기존 에셋 이미지를 함께 첨부
2. **Tier 2** - "Based on this Tier 2 version of the character" 명시 + tier2 이미지 첨부
3. **일관성** - 한 캐릭터의 모든 모션을 연속 생성하면 스타일 일관성 향상
4. **크기 통일** - "Each frame approximately 500x600px" 필수
5. **공통 모션** - 템플릿에 캐릭터 설명만 교체하여 사용

## 에셋 파일 위치

| 경로 | 설명 |
|------|------|
| `public/img/units/melee.png` | 전사 기본 |
| `public/img/units/ranged.png` | 궁수 기본 |
| `public/img/units/knight.png` | 기사 기본 |
| `public/img/units/mage.png` | 마법사 기본 |
| `public/img/units/RPG/heroes/{name}.png` | 전직 Tier 1 |
| `public/img/units/RPG/heroes/{name}2.png` | 전직 Tier 2 |
| `public/img/units/RPG/skill_icon/` | 스킬 아이콘 |
