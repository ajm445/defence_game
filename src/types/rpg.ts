import { Position } from './game';
import { Unit, UnitType } from './unit';
import { CharacterStatUpgrades } from './auth';

// 난이도 타입
export type RPGDifficulty = 'easy' | 'normal' | 'hard' | 'extreme';

// 난이도 설정 인터페이스
export interface DifficultyConfig {
  id: RPGDifficulty;
  name: string;
  nameEn: string;
  description: string;
  enemyHpMultiplier: number;       // 적 HP 배율
  enemyAttackMultiplier: number;   // 적 공격력 배율
  spawnIntervalMultiplier: number; // 스폰 간격 배율 (낮을수록 빠름)
  spawnCountMultiplier: number;    // 스폰 수 배율 (높을수록 많이 스폰)
  goldRewardMultiplier: number;    // 골드 보상 배율
  expRewardMultiplier: number;     // 경험치 보상 배율
  bossHpMultiplier: number;        // 보스 HP 배율
  bossAttackMultiplier: number;    // 보스 공격력 배율
  enemyBaseHpMultiplier: number;   // 적 기지 HP 배율
}

// 영웅 직업 타입
export type HeroClass = 'warrior' | 'archer' | 'knight' | 'mage';

// 전직 직업 타입
export type AdvancedHeroClass =
  // 전사 계열
  | 'berserker' | 'guardian'
  // 궁수 계열
  | 'sniper' | 'ranger'
  // 기사 계열
  | 'paladin' | 'darkKnight'
  // 마법사 계열
  | 'archmage' | 'healer';

// 보스 스킬 타입
export type BossSkillType = 'smash' | 'summon' | 'shockwave' | 'knockback' | 'charge' | 'heal';

// 보스 스킬 인터페이스
export interface BossSkill {
  type: BossSkillType;
  cooldown: number;          // 기본 쿨다운 (초)
  currentCooldown: number;   // 현재 남은 쿨다운
  damage?: number;           // 데미지 (배율)
  radius?: number;           // 범위
  angle?: number;            // 각도 (강타용)
  castTime?: number;         // 시전 시간
  stunDuration?: number;     // 기절 지속시간
  summonCount?: number;      // 소환 수
  hpThreshold?: number;      // HP 조건 (0~1, 이하일 때 사용)
  hpThresholdActivated?: boolean; // HP 조건 첫 충족 여부 (쿨다운 리셋용)
  knockbackDistance?: number; // 밀어내기 거리 (px)
  oneTimeUse?: boolean;       // 한 번만 사용 가능 여부
  used?: boolean;             // 사용 완료 여부 (oneTimeUse용)
  chargeDistance?: number;    // 돌진 거리 (px)
  healPercent?: number;       // 회복량 (최대 HP 대비 %)
}

// 보스 스킬 시전 상태
export interface BossSkillCast {
  skillType: BossSkillType;
  startTime: number;         // 시전 시작 시간
  castTime: number;          // 총 시전 시간
  targetX?: number;          // 목표 위치 X
  targetY?: number;          // 목표 위치 Y
  targetAngle?: number;      // 목표 방향 (강타용)
}

// 직업별 스킬 타입
export type SkillType =
  // 기존 호환성
  | 'dash' | 'spin' | 'heal'
  // 전사
  | 'warrior_q' | 'warrior_w' | 'warrior_e'
  | 'warrior_strike' | 'warrior_charge' | 'warrior_berserker'
  // 궁수
  | 'archer_q' | 'archer_w' | 'archer_e'
  | 'archer_shot' | 'archer_pierce' | 'archer_rain'
  // 기사
  | 'knight_q' | 'knight_w' | 'knight_e'
  | 'knight_bash' | 'knight_charge' | 'knight_ironwall'
  // 마법사
  | 'mage_q' | 'mage_w' | 'mage_e'
  | 'mage_bolt' | 'mage_fireball' | 'mage_meteor'
  // 전직 W 스킬
  | 'blood_rush'      // 버서커 - 피의 돌진
  | 'guardian_rush'   // 가디언 - 수호의 돌진
  | 'backflip_shot'   // 저격수 - 후방 도약
  | 'multi_arrow'     // 레인저 - 다중 화살
  | 'holy_charge'     // 팔라딘 - 신성한 돌진
  | 'shadow_slash'    // 다크나이트 - 암흑 베기
  | 'inferno'         // 대마법사 - 폭발 화염구
  | 'inferno_burn'    // 대마법사 - 폭발 화염구 화상 효과
  | 'healing_light'   // 힐러 - 치유의 빛
  // 전직 E 스킬
  | 'rage'            // 버서커 - 광란
  | 'shield'          // 가디언 - 보호막
  | 'snipe'           // 저격수 - 저격
  | 'arrow_storm'     // 레인저 - 화살 폭풍
  | 'divine_light'    // 팔라딘 - 신성한 빛
  | 'dark_blade'      // 다크나이트 - 어둠의 칼날
  | 'meteor_shower'   // 대마법사 - 메테오 샤워
  | 'spring_of_life'; // 힐러 - 생명의 샘

// 스킬 슬롯 타입
export type SkillSlot = 'Q' | 'W' | 'E';

// 버프/디버프 타입
export type BuffType =
  | 'berserker'      // 광전사 (공격력, 공속 증가)
  | 'ironwall'       // 철벽 방어 (데미지 감소)
  | 'invincible'     // 무적 (돌진 중)
  | 'swiftness'      // 신속 (이동속도 증가)
  | 'stun';          // 기절

// 버프 상태
export interface Buff {
  type: BuffType;
  duration: number;      // 남은 지속시간 (초)
  startTime: number;     // 시작 시간
  attackBonus?: number;  // 공격력 증가율
  speedBonus?: number;   // 공속 증가율
  moveSpeedBonus?: number; // 이동속도 증가율
  damageReduction?: number; // 데미지 감소율
  damageTaken?: number;  // 받는 피해 증가율 (0.5 = 50% 증가)
  lifesteal?: number;    // 피해흡혈율 (0.5 = 50%)
  casterId?: string;     // 시전자 영웅 ID (공유 버프의 경우 범위 체크용)
}

// 패시브 능력 설정
export interface PassiveAbility {
  lifesteal?: number;       // 피해흡혈 비율 (0.1 = 10%)
  multiTarget?: number;     // 기본 공격 대상 수
  hpRegen?: number;         // 초당 HP 재생
  bossDamageBonus?: number; // 보스에게 주는 데미지 증가 비율 (0.2 = 20%)
}

// 패시브 성장 상태
export interface PassiveGrowthState {
  level: number;           // 패시브 레벨 (0부터 시작, 웨이브10 클리어 시 1)
  currentValue: number;    // 현재 패시브 값
  overflowBonus: number;   // 초과 보너스 (최대치 도달 후 추가 스탯 보너스)
}

// Nexus (중앙 수호물)
export interface Nexus {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  laserCooldown: number;  // 레이저 공격 쿨다운 (초)
}

// 넥서스 레이저 효과 (시각화용)
export interface NexusLaserEffect {
  id: string;
  targetX: number;
  targetY: number;
  timestamp: number;
}

// Enemy Base (적 기지)
export type EnemyBaseId = 'left' | 'right' | 'top' | 'bottom';

export interface EnemyBase {
  id: EnemyBaseId;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  destroyed: boolean;
  attackers: Set<string>;  // 기지를 공격한 영웅 ID 목록 (멀티플레이 골드 배분용)
}

// Upgrade Levels (업그레이드 레벨)
export interface UpgradeLevels {
  attack: number;
  speed: number;
  hp: number;
  attackSpeed: number;
  goldRate: number;
  range: number;  // 궁수/마법사 전용
}

// RPG 게임 진행 단계
export type RPGGamePhase = 'playing' | 'boss_phase' | 'victory' | 'defeat';

// 직업 설정
export interface ClassConfig {
  name: string;
  nameEn: string;
  emoji: string;
  description: string;
  hp: number;
  attack: number;
  attackSpeed: number;  // 공격 쿨다운 (초)
  speed: number;        // 이동 속도
  range: number;        // 공격 사거리
  passive: PassiveAbility; // 패시브 능력
}

// 스킬 상태
export interface Skill {
  type: SkillType;
  name: string;
  key: string;           // Q, W, E
  cooldown: number;      // 쿨다운 (초)
  currentCooldown: number; // 현재 남은 쿨다운
  level: number;         // 스킬 레벨 (1부터 시작)
}

// 돌진 상태 정보
export interface DashState {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  progress: number;      // 0 ~ 1
  duration: number;      // 돌진 지속 시간 (초)
  dirX: number;
  dirY: number;
}

// 영웅 유닛 (기존 Unit 확장)
export interface HeroUnit extends Omit<Unit, 'type'> {
  type: 'hero';
  heroClass: HeroClass;      // 영웅 직업
  advancedClass?: AdvancedHeroClass; // 전직 직업 (전직 후에만 존재)
  tier?: 1 | 2;              // 전직 단계 (1: 1차 전직, 2: 2차 강화)
  characterLevel: number;    // 계정 캐릭터 레벨 (프로필에서 가져옴)
  statUpgrades?: CharacterStatUpgrades; // SP로 업그레이드한 스탯
  skills: Skill[];           // 보유 스킬
  targetPosition?: Position; // 이동 목표 위치 (구 방식 - 사용 안함)
  moveDirection?: Position;  // WASD 이동 방향 (신 방식)
  attackTarget?: string;     // 공격 대상 ID
  baseAttack: number;        // 기본 공격력
  baseSpeed: number;         // 기본 이동속도
  baseAttackSpeed: number;   // 기본 공격속도
  buffs: Buff[];             // 활성 버프 목록
  facingRight: boolean;      // 오른쪽을 바라보는지 여부 (이미지 반전용)
  facingAngle: number;       // 실제 바라보는 방향 각도 (라디안, 스킬 방향용)
  dashState?: DashState;     // 돌진 중일 때의 상태 정보
  passiveGrowth: PassiveGrowthState; // 패시브 성장 상태
  deathTime?: number;        // 사망 시간 (부활 타이머용)
  castingUntil?: number;     // 시전 종료 시간 (게임 시간 기준, 시전 중 이동/공격 불가)
}

// 웨이브 설정
export interface WaveConfig {
  waveNumber: number;
  enemies: { type: UnitType; count: number }[];
  spawnInterval: number;  // 적 스폰 간격 (초)
  bossWave: boolean;      // 보스 웨이브 여부
}

// 적 AI 설정
export interface EnemyAIConfig {
  detectionRange: number;  // 탐지 범위
  attackRange: number;     // 공격 사거리
  moveSpeed: number;       // 이동속도
  attackDamage: number;    // 공격력
  attackSpeed: number;     // 공격 속도 (초)
}

// 적 유닛 (RPG 모드용)
export interface RPGEnemy extends Unit {
  goldReward: number;      // 처치 시 골드
  targetHero: boolean;     // 영웅을 타겟으로 하는지
  aiConfig: EnemyAIConfig; // AI 설정
  buffs: Buff[];           // 활성 버프/디버프 목록
  fromBase?: EnemyBaseId; // 스폰된 기지 (넥서스 디펜스용)
  aggroOnHero: boolean;    // 영웅에게 어그로가 끌렸는지 (공격당하면 true)
  aggroExpireTime?: number; // 어그로 만료 시간 (게임 시간 기준)
  // 멀티플레이어 동기화용
  targetHeroId?: string;   // 타겟 영웅 ID
  isStunned?: boolean;     // 스턴 상태
  stunEndTime?: number;    // 스턴 종료 시간
  // 보스 골드 분배용 - 데미지를 준 플레이어 ID 목록
  damagedBy?: string[];
  // 보스 스킬 시스템
  bossSkills?: BossSkill[];       // 보스가 사용 가능한 스킬 목록
  currentCast?: BossSkillCast;    // 현재 시전 중인 스킬
  // 보스 돌진 이동용
  dashState?: DashState;          // 돌진 상태 (자연스러운 이동용)
}

// 시야 시스템 설정
export interface VisibilityState {
  exploredCells: Set<string>;  // 탐사한 셀 (key: "x,y")
  visibleRadius: number;       // 현재 시야 반경
}

// RPG 게임 상태
export interface RPGGameState {
  running: boolean;
  paused: boolean;
  gameOver: boolean;
  victory: boolean;       // 승리 여부

  // 영웅
  hero: HeroUnit | null;
  selectedClass: HeroClass | null;  // 선택된 직업
  otherHeroes?: Map<string, HeroUnit>;  // 다른 플레이어 영웅들 (멀티플레이)

  // 골드 시스템
  gold: number;
  upgradeLevels: UpgradeLevels;

  // 넥서스 디펜스
  nexus: Nexus | null;
  enemyBases: EnemyBase[];
  gamePhase: RPGGamePhase;
  fiveMinuteRewardClaimed: boolean;

  // 적 관리
  enemies: RPGEnemy[];

  // 스폰 관리
  lastSpawnTime: number;
  spawnTimer: number;  // 다음 스폰까지 남은 시간

  // 타이머
  gameTime: number;       // 총 플레이 시간
  goldAccumulator: number; // 패시브 골드 수급용 누적기

  // 카메라
  camera: {
    x: number;
    y: number;
    zoom: number;
    followHero: boolean;  // 영웅 자동 추적
  };

  // 시야 시스템
  visibility: VisibilityState;

  // 통계
  stats: {
    totalKills: number;
    totalGoldEarned: number;
    basesDestroyed: number;
    bossesKilled: number;
    timePlayed: number;
  };

  // 스킬 효과
  activeSkillEffects: SkillEffect[];

  // 보류 중인 스킬 (운석 낙하 등)
  pendingSkills: PendingSkill[];

  // 보스 스킬 시각적 경고 (클라이언트 렌더링용)
  bossSkillWarnings: BossSkillWarning[];
}

// 보스 스킬 경고 (바닥 표시용)
export interface BossSkillWarning {
  id: string;
  skillType: BossSkillType;
  x: number;
  y: number;
  radius: number;
  angle?: number;          // 강타용 (부채꼴 방향)
  startTime: number;
  duration: number;        // 경고 표시 시간 (시전 시간과 동일)
  // 돌진용 (직선 경로 표시)
  targetX?: number;        // 돌진 끝점 X
  targetY?: number;        // 돌진 끝점 Y
}

// 보류 중인 스킬 (지연 발동)
export interface PendingSkill {
  type: SkillType;
  position: Position;
  triggerTime: number;   // 발동 시간
  damage: number;
  radius: number;
  casterId?: string;     // 스킬 시전자 ID (보스 골드 분배용)
  bossDamageMultiplier?: number; // 보스 데미지 배율 (마법사 패시브)
  // 전직 스킬용 추가 필드
  targetId?: string;     // 저격 타겟 ID
  duration?: number;     // 지속시간 (틱 스킬용)
  tickCount?: number;    // 남은 틱 수
  healPercent?: number;  // 힐 비율 (힐러 E 스킬용)
  meteorCount?: number;  // 남은 운석 수 (대마법사 E 스킬용)
}

// 레벨업 보너스 (계정 레벨 보너스)
export interface LevelUpBonus {
  hp: number;
  attack: number;
  speed: number;
}

// 골드 보상 테이블 (적 유닛별)
export type GoldTable = Partial<Record<UnitType, number>>;

// 피격 대상 정보 (공격 이펙트용)
export interface HitTarget {
  x: number;
  y: number;
  damage: number;
}

// 스킬 효과
export interface SkillEffect {
  type: SkillType;
  position: Position;
  targetPosition?: Position; // 목표 위치 (돌진용)
  direction?: Position;   // 방향 (돌진용)
  radius?: number;        // 범위
  damage?: number;        // 데미지
  heal?: number;          // 힐량
  duration: number;       // 지속시간 (초)
  startTime: number;      // 시작 시간
  hitTargets?: HitTarget[]; // 피격 대상 위치들 (공격 이펙트용)
  heroClass?: HeroClass;   // 발동한 영웅 직업 (이펙트 스타일 결정용)
  advancedClass?: AdvancedHeroClass; // 전직 직업 (이펙트 색상 차별화용)
  targetId?: string;      // 타겟 적 ID (실시간 위치 추적용, 저격 등)
  heroId?: string;        // 발동한 영웅 ID (멀티플레이 이펙트 병합용)
}

// 기본 공격 이펙트 (네트워크 동기화용)
export interface BasicAttackEffect {
  id: string;           // 고유 ID (중복 생성 방지)
  x: number;
  y: number;
  type: 'melee' | 'ranged' | 'boss';  // 'boss' 추가 - 보스 기본 공격
  timestamp: number;    // 생성 시간
  attackerId?: string;  // 공격자 ID (보스 식별용)
}

// 보스 스킬 실행 이펙트 (네트워크 동기화용)
export interface BossSkillExecutedEffect {
  id: string;           // 고유 ID (중복 생성 방지)
  skillType: BossSkillType;
  x: number;
  y: number;
  timestamp: number;    // 생성 시간
  healPercent?: number; // 힐 스킬의 경우 회복량 (UI 알림용)
}

// 플로팅 데미지 숫자 타입
export type DamageNumberType = 'damage' | 'critical' | 'heal' | 'enemy_damage';

// 플로팅 데미지 숫자 인터페이스
export interface DamageNumber {
  id: string;
  x: number;
  y: number;
  amount: number;
  type: DamageNumberType;
  createdAt: number;
}

// 경험치 테이블 (적 유닛별) - 레거시, 계정 경험치용
export type ExpTable = Partial<Record<UnitType, number>>;

// RPG 게임 결과
export interface RPGGameResult {
  victory: boolean;
  totalKills: number;
  totalGoldEarned: number;
  basesDestroyed: number;
  bossesKilled: number;
  totalBases: number;      // 총 기지 수 (플레이어 수에 따라 2~4)
  totalBosses: number;     // 총 보스 수 (기지 수와 동일)
  timePlayed: number;
  heroClass: HeroClass;
  finalUpgradeLevels: UpgradeLevels;
}
