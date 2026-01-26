import { Position } from './game';
import { Unit, UnitType } from './unit';
import { CharacterStatUpgrades } from './auth';

// 영웅 직업 타입
export type HeroClass = 'warrior' | 'archer' | 'knight' | 'mage';

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
  | 'mage_bolt' | 'mage_fireball' | 'mage_meteor';

// 스킬 슬롯 타입
export type SkillSlot = 'Q' | 'W' | 'E';

// 버프/디버프 타입
export type BuffType =
  | 'berserker'      // 광전사 (공격력, 공속 증가)
  | 'ironwall'       // 철벽 방어 (데미지 감소)
  | 'invincible'     // 무적 (돌진 중)
  | 'stun';          // 기절

// 버프 상태
export interface Buff {
  type: BuffType;
  duration: number;      // 남은 지속시간 (초)
  startTime: number;     // 시작 시간
  attackBonus?: number;  // 공격력 증가율
  speedBonus?: number;   // 공속 증가율
  damageReduction?: number; // 데미지 감소율
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
}

// 기본 공격 이펙트 (네트워크 동기화용)
export interface BasicAttackEffect {
  id: string;           // 고유 ID (중복 생성 방지)
  x: number;
  y: number;
  type: 'melee' | 'ranged';
  timestamp: number;    // 생성 시간
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
