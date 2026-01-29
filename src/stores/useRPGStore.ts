import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { RPGGameState, HeroUnit, RPGEnemy, Skill, SkillEffect, RPGGameResult, HeroClass, PendingSkill, Buff, VisibilityState, Nexus, EnemyBase, EnemyBaseId, UpgradeLevels, RPGGamePhase, BasicAttackEffect, RPGDifficulty, NexusLaserEffect, BossSkillWarning, AdvancedHeroClass, SkillType, DamageNumber, DamageNumberType } from '../types/rpg';
import { UnitType } from '../types/unit';
import { RPG_CONFIG, CLASS_CONFIGS, CLASS_SKILLS, NEXUS_CONFIG, ENEMY_BASE_CONFIG, GOLD_CONFIG, UPGRADE_CONFIG, ENEMY_AI_CONFIGS, DIFFICULTY_CONFIGS, ADVANCED_CLASS_CONFIGS, ADVANCED_W_SKILLS, ADVANCED_E_SKILLS, JOB_ADVANCEMENT_REQUIREMENTS, SECOND_ENHANCEMENT_MULTIPLIER, ADVANCEMENT_OPTIONS } from '../constants/rpgConfig';
import { createInitialPassiveState, getPassiveFromCharacterLevel } from '../game/rpg/passiveSystem';
import { createInitialUpgradeLevels, getUpgradeCost, canUpgrade, getGoldReward, calculateAllUpgradeBonuses, UpgradeType } from '../game/rpg/goldSystem';
import { CharacterStatUpgrades, createDefaultStatUpgrades, getStatBonus } from '../types/auth';
import type { MultiplayerState, PlayerInput, SerializedGameState, SerializedHero, SerializedEnemy } from '../../shared/types/hostBasedNetwork';
import type { CoopPlayerInfo } from '../../shared/types/rpgNetwork';
import { wsClient } from '../services/WebSocketClient';
import { soundManager } from '../services/SoundManager';
import { distance } from '../utils/math';

// 버프 공유 범위 상수 (useNetworkSync.ts와 동일)
const BERSERKER_SHARE_RANGE = 300;
const IRONWALL_SHARE_RANGE = Infinity;

interface RPGState extends RPGGameState {
  // 선택된 난이도
  selectedDifficulty: RPGDifficulty;

  // 마지막 피격 시간 (화면 효과용)
  lastDamageTime: number;

  // 활성 스킬 효과
  activeSkillEffects: SkillEffect[];

  // 기본 공격 이펙트 (네트워크 동기화용)
  basicAttackEffects: BasicAttackEffect[];

  // 넥서스 레이저 효과 (네트워크 동기화용)
  nexusLaserEffects: NexusLaserEffect[];

  // 플로팅 데미지 숫자
  damageNumbers: DamageNumber[];

  // 결과
  result: RPGGameResult | null;

  // 마우스 위치 (월드 좌표, 스킬 타겟용)
  mousePosition: { x: number; y: number };

  // 공격 사거리 표시 여부
  showAttackRange: boolean;

  // 호버된 스킬 사거리 정보
  hoveredSkillRange: {
    type: 'circle' | 'line' | 'aoe' | null;  // 원형 범위, 직선, 또는 무제한 AoE
    range: number;                            // 사거리/거리
    radius?: number;                          // AoE 반경 (범위 스킬용)
  } | null;

  // ============================================
  // 멀티플레이 상태 (호스트 기반 통합 시스템)
  // ============================================
  multiplayer: MultiplayerState;

  // 다른 플레이어 영웅들 (멀티플레이 시)
  otherHeroes: Map<string, HeroUnit>;
  // 다른 플레이어별 골드 및 업그레이드 (멀티플레이 시 각자 별개)
  otherPlayersGold: Map<string, number>;
  otherPlayersUpgrades: Map<string, UpgradeLevels>;
  otherPlayersGoldAccumulator: Map<string, number>; // 다른 플레이어 패시브 골드 누적기

  // 개인 처치 수 (멀티플레이어 - 내 처치 수)
  personalKills: number;
  // 다른 플레이어별 처치 수 (멀티플레이어)
  otherPlayersKills: Map<string, number>;
  // 다른 플레이어 영웅 보간 데이터 (클라이언트용)
  otherHeroesInterpolation: Map<string, HeroInterpolation>;
}

// 영웅 보간 데이터 타입 (클라이언트 움직임 개선)
interface HeroInterpolation {
  prevX: number;
  prevY: number;
  targetX: number;
  targetY: number;
  velocityX: number;        // 이동 속도 X
  velocityY: number;        // 이동 속도 Y
  moveDirectionX: number;   // 이동 방향 X (-1, 0, 1)
  moveDirectionY: number;   // 이동 방향 Y (-1, 0, 1)
  moveSpeed: number;        // 영웅 이동 속도 (stats.speed)
  lastUpdateTime: number;
}

interface RPGActions {
  // 게임 초기화
  initGame: (characterLevel?: number, statUpgrades?: CharacterStatUpgrades, difficulty?: RPGDifficulty, advancedClass?: string, tier?: 1 | 2) => void;
  resetGame: () => void;

  // 난이도 선택
  setDifficulty: (difficulty: RPGDifficulty) => void;

  // 직업 선택
  selectClass: (heroClass: HeroClass) => void;

  // 영웅 관련
  createHero: (heroClass: HeroClass, characterLevel?: number, statUpgrades?: CharacterStatUpgrades) => void;
  moveHero: (x: number, y: number) => void;
  setMoveDirection: (direction: { x: number; y: number } | undefined) => void;
  setAttackTarget: (targetId: string | undefined) => void;
  damageHero: (amount: number) => void;
  healHero: (amount: number) => void;
  reviveHero: () => void;
  updateHeroPosition: (x: number, y: number) => void;
  updateHeroState: (heroUpdate: Partial<HeroUnit>) => void;

  // 전직 관련
  canAdvanceJob: () => boolean;
  advanceJob: (advancedClass: AdvancedHeroClass) => boolean;
  checkAndApplySecondEnhancement: () => boolean;

  // 마우스 위치 (스킬 타겟용)
  setMousePosition: (x: number, y: number) => void;

  // 버프 관련
  addBuff: (buff: Buff) => void;
  removeBuff: (buffType: string) => void;
  updateBuffs: (deltaTime: number) => void;

  // 보류 스킬 관련
  addPendingSkill: (skill: PendingSkill) => void;
  removePendingSkill: (index: number) => void;

  // 시야 관련
  updateVisibility: () => void;

  // 골드 시스템
  addGold: (amount: number) => void;
  upgradeHeroStat: (stat: UpgradeType) => boolean;

  // 스킬
  useSkill: (skillType: string) => boolean;
  updateSkillCooldowns: (deltaTime: number) => void;
  addSkillEffect: (effect: SkillEffect) => void;
  removeSkillEffect: (index: number) => void;
  updateSkillEffectTargetPositions: () => void;  // 타겟 추적 이펙트 위치 업데이트

  // 기본 공격 이펙트 (네트워크 동기화용)
  addBasicAttackEffect: (effect: BasicAttackEffect) => void;
  cleanBasicAttackEffects: () => void;

  // 넥서스 레이저 이펙트 (네트워크 동기화용)
  addNexusLaserEffect: (effect: NexusLaserEffect) => void;
  cleanNexusLaserEffects: () => void;

  // 보스 스킬 경고 (시각화용)
  addBossSkillWarning: (warning: BossSkillWarning) => void;
  updateBossSkillWarnings: (gameTime: number) => void;

  // 플로팅 데미지 숫자
  addDamageNumber: (x: number, y: number, amount: number, type: DamageNumberType) => void;
  removeDamageNumber: (id: string) => void;
  cleanDamageNumbers: () => void;

  // 적 관리
  addEnemy: (enemy: RPGEnemy) => void;
  removeEnemy: (enemyId: string) => void;
  damageEnemy: (enemyId: string, amount: number, killerHeroId?: string) => boolean; // returns true if killed, killerHeroId for multiplayer gold
  updateEnemies: (enemies: RPGEnemy[]) => void;

  // 넥서스/기지
  damageNexus: (amount: number) => void;
  damageBase: (baseId: EnemyBaseId, amount: number, attackerId?: string) => { destroyed: boolean; goldReceived: number }; // returns destroyed status and gold received by caller
  spawnBosses: () => void;
  setGamePhase: (phase: RPGGamePhase) => void;

  // 스폰
  setSpawnTimer: (time: number) => void;
  setLastSpawnTime: (time: number) => void;

  // 카메라
  setCamera: (x: number, y: number) => void;
  setZoom: (zoom: number) => void;
  toggleFollowHero: () => void;
  centerOnHero: () => void;

  // 게임 상태
  setRunning: (running: boolean) => void;
  setPaused: (paused: boolean) => void;
  setGameOver: (victory: boolean) => void;
  updateGameTime: (deltaTime: number) => void;
  setFiveMinuteRewardClaimed: () => void;

  // 통계
  incrementKills: () => void;
  incrementPersonalKills: () => void;
  incrementOtherPlayerKills: (heroId: string) => void;
  addGoldEarned: (amount: number) => void;
  incrementBasesDestroyed: () => void;
  incrementBossesKilled: () => void;

  // 공격 사거리 표시
  setShowAttackRange: (show: boolean) => void;

  // 호버된 스킬 사거리 설정
  setHoveredSkillRange: (range: RPGState['hoveredSkillRange']) => void;

  // ============================================
  // 멀티플레이 액션 (호스트 기반 통합 시스템)
  // ============================================

  // 멀티플레이 상태 설정
  setMultiplayerState: (state: Partial<MultiplayerState>) => void;
  resetMultiplayerState: () => void;

  // 멀티플레이 게임 초기화 (호스트용)
  initMultiplayerGame: (players: CoopPlayerInfo[], _isHost: boolean, difficulty?: RPGDifficulty) => void;

  // 다른 플레이어 영웅 관리
  addOtherHero: (hero: HeroUnit) => void;
  updateOtherHero: (heroId: string, update: Partial<HeroUnit>) => void;
  removeOtherHero: (heroId: string) => void;
  clearOtherHeroes: () => void;

  // 다른 플레이어 골드/업그레이드 관리 (멀티플레이)
  addGoldToOtherPlayer: (heroId: string, amount: number) => void;
  getOtherPlayerGold: (heroId: string) => number;
  upgradeOtherHeroStat: (heroId: string, stat: UpgradeType) => boolean;
  getOtherPlayerUpgrades: (heroId: string) => UpgradeLevels;

  // 원격 입력 큐 관리 (호스트용)
  addRemoteInput: (input: PlayerInput) => void;
  popRemoteInput: () => PlayerInput | undefined;
  clearRemoteInputs: () => void;

  // 게임 상태 직렬화/역직렬화
  serializeGameState: () => SerializedGameState;
  applySerializedState: (state: SerializedGameState, myHeroId: string | null) => void;

  // 다른 플레이어 영웅 보간 업데이트 (클라이언트용)
  updateOtherHeroesInterpolation: () => void;
}

interface RPGStore extends RPGState, RPGActions {}

const initialVisibility: VisibilityState = {
  exploredCells: new Set<string>(),
  visibleRadius: RPG_CONFIG.VISIBILITY.RADIUS,
};

// 넥서스 초기 상태 생성
const createInitialNexus = (): Nexus => ({
  x: NEXUS_CONFIG.position.x,
  y: NEXUS_CONFIG.position.y,
  hp: NEXUS_CONFIG.hp,
  maxHp: NEXUS_CONFIG.hp,
  laserCooldown: 0,
});

// 적 기지 초기 상태 생성 (플레이어 수에 따라 기지 수 결정)
// - 싱글플레이 / 2인: 좌, 우 (2개)
// - 3인: 좌, 우, 상 (3개)
// - 4인: 좌, 우, 상, 하 (4개)
const createInitialEnemyBases = (playerCount: number = 1, difficulty: RPGDifficulty = 'easy'): EnemyBase[] => {
  const difficultyConfig = DIFFICULTY_CONFIGS[difficulty];
  const hpMultiplier = difficultyConfig.enemyBaseHpMultiplier;

  const bases: EnemyBase[] = [
    {
      id: 'left',
      x: ENEMY_BASE_CONFIG.left.x,
      y: ENEMY_BASE_CONFIG.left.y,
      hp: Math.floor(ENEMY_BASE_CONFIG.left.hp * hpMultiplier),
      maxHp: Math.floor(ENEMY_BASE_CONFIG.left.hp * hpMultiplier),
      destroyed: false,
      attackers: new Set<string>(),
    },
    {
      id: 'right',
      x: ENEMY_BASE_CONFIG.right.x,
      y: ENEMY_BASE_CONFIG.right.y,
      hp: Math.floor(ENEMY_BASE_CONFIG.right.hp * hpMultiplier),
      maxHp: Math.floor(ENEMY_BASE_CONFIG.right.hp * hpMultiplier),
      destroyed: false,
      attackers: new Set<string>(),
    },
  ];

  // 3인 이상: 상단 기지 추가
  if (playerCount >= 3) {
    bases.push({
      id: 'top',
      x: ENEMY_BASE_CONFIG.top.x,
      y: ENEMY_BASE_CONFIG.top.y,
      hp: Math.floor(ENEMY_BASE_CONFIG.top.hp * hpMultiplier),
      maxHp: Math.floor(ENEMY_BASE_CONFIG.top.hp * hpMultiplier),
      destroyed: false,
      attackers: new Set<string>(),
    });
  }

  // 4인 이상: 하단 기지 추가
  if (playerCount >= 4) {
    bases.push({
      id: 'bottom',
      x: ENEMY_BASE_CONFIG.bottom.x,
      y: ENEMY_BASE_CONFIG.bottom.y,
      hp: Math.floor(ENEMY_BASE_CONFIG.bottom.hp * hpMultiplier),
      maxHp: Math.floor(ENEMY_BASE_CONFIG.bottom.hp * hpMultiplier),
      destroyed: false,
      attackers: new Set<string>(),
    });
  }

  return bases;
};

const initialState: RPGState = {
  running: false,
  paused: false,
  gameOver: false,
  victory: false,

  hero: null,
  selectedClass: null,
  selectedDifficulty: 'easy',
  lastDamageTime: 0,

  // 골드 시스템
  gold: GOLD_CONFIG.STARTING_GOLD,
  upgradeLevels: createInitialUpgradeLevels(),

  // 넥서스 디펜스
  nexus: null,
  enemyBases: [],
  gamePhase: 'playing',
  fiveMinuteRewardClaimed: false,

  // 적 관리
  enemies: [],

  // 스폰 관리
  lastSpawnTime: 0,
  spawnTimer: 0,

  gameTime: 0,
  goldAccumulator: 0, // 패시브 골드 수급용 시간 누적기

  camera: {
    x: NEXUS_CONFIG.position.x,
    y: NEXUS_CONFIG.position.y,
    zoom: RPG_CONFIG.CAMERA.DEFAULT_ZOOM,
    followHero: true,
  },

  visibility: initialVisibility,

  stats: {
    totalKills: 0,
    totalGoldEarned: 0,
    basesDestroyed: 0,
    bossesKilled: 0,
    timePlayed: 0,
  },

  activeSkillEffects: [],
  basicAttackEffects: [],
  nexusLaserEffects: [],
  damageNumbers: [],
  pendingSkills: [],
  bossSkillWarnings: [],
  result: null,
  mousePosition: { x: NEXUS_CONFIG.position.x, y: NEXUS_CONFIG.position.y },
  showAttackRange: false,
  hoveredSkillRange: null,

  // 멀티플레이 초기 상태
  multiplayer: {
    isMultiplayer: false,
    isHost: false,
    roomCode: null,
    roomId: null,
    hostPlayerId: null,
    myPlayerId: null,
    myHeroId: null,
    players: [],
    remoteInputQueue: [],
    connectionState: 'disconnected',
    countdown: null,
  },
  otherHeroes: new Map(),
  otherPlayersGold: new Map(),
  otherPlayersUpgrades: new Map(),
  otherPlayersGoldAccumulator: new Map(),
  personalKills: 0,
  otherPlayersKills: new Map(),
  otherHeroesInterpolation: new Map(),
};

// 직업별 스킬 생성
function createClassSkills(heroClass: HeroClass): Skill[] {
  const classSkills = CLASS_SKILLS[heroClass];
  return [
    {
      type: classSkills.q.type,
      name: classSkills.q.name,
      key: classSkills.q.key,
      cooldown: classSkills.q.cooldown,
      currentCooldown: 0,
      level: 1,
    },
    {
      type: classSkills.w.type,
      name: classSkills.w.name,
      key: classSkills.w.key,
      cooldown: classSkills.w.cooldown,
      currentCooldown: 0,
      level: 1,
    },
    {
      type: classSkills.e.type,
      name: classSkills.e.name,
      key: classSkills.e.key,
      cooldown: classSkills.e.cooldown,
      currentCooldown: 0,
      level: 1,
    },
  ];
}

// 전직 스킬 생성 (Q는 기본 직업 스킬 유지, W와 E는 전직 스킬로 변경)
function createAdvancedClassSkills(heroClass: HeroClass, advancedClass: AdvancedHeroClass): Skill[] {
  const baseSkills = CLASS_SKILLS[heroClass];
  const advancedW = ADVANCED_W_SKILLS[advancedClass];
  const advancedE = ADVANCED_E_SKILLS[advancedClass];

  return [
    // Q 스킬 - 기본 직업 스킬 유지
    {
      type: baseSkills.q.type,
      name: baseSkills.q.name,
      key: baseSkills.q.key,
      cooldown: baseSkills.q.cooldown,
      currentCooldown: 0,
      level: 1,
    },
    // W 스킬 - 전직 스킬로 변경
    {
      type: advancedW.type as SkillType,
      name: advancedW.name,
      key: advancedW.key,
      cooldown: advancedW.cooldown,
      currentCooldown: 0,
      level: 1,
    },
    // E 스킬 - 전직 스킬로 변경
    {
      type: advancedE.type as SkillType,
      name: advancedE.name,
      key: advancedE.key,
      cooldown: advancedE.cooldown,
      currentCooldown: 0,
      level: 1,
    },
  ];
}

// 영웅 생성 (직업별)
function createHeroUnit(
  heroClass: HeroClass,
  characterLevel: number = 1,
  statUpgrades?: CharacterStatUpgrades,
  advancedClass?: string,
  tier?: 1 | 2
): HeroUnit {
  // 전직 캐릭터인 경우 전직 스탯 사용
  let baseStats: { hp: number; attack: number; attackSpeed: number; speed: number; range: number };
  let configName: string;

  if (advancedClass && ADVANCED_CLASS_CONFIGS[advancedClass as AdvancedHeroClass]) {
    const advConfig = ADVANCED_CLASS_CONFIGS[advancedClass as AdvancedHeroClass];
    const baseStat = advConfig.stats;

    // 2차 강화인 경우 1.2배
    const multiplier = tier === 2 ? SECOND_ENHANCEMENT_MULTIPLIER : 1;
    baseStats = {
      hp: Math.floor(baseStat.hp * multiplier),
      attack: Math.floor(baseStat.attack * multiplier),
      attackSpeed: baseStat.attackSpeed / multiplier, // 더 빠르게
      speed: baseStat.speed * multiplier,
      range: Math.floor(baseStat.range * multiplier),
    };
    configName = advConfig.name;
  } else {
    const classConfig = CLASS_CONFIGS[heroClass];
    baseStats = {
      hp: classConfig.hp,
      attack: classConfig.attack,
      attackSpeed: classConfig.attackSpeed,
      speed: classConfig.speed,
      range: classConfig.range,
    };
    configName = classConfig.name;
  }

  // 캐릭터 레벨이 5 이상이면 패시브 활성화
  const passiveState = getPassiveFromCharacterLevel(heroClass, characterLevel) || createInitialPassiveState();

  // SP 스탯 업그레이드 적용
  const upgrades = statUpgrades || createDefaultStatUpgrades();
  const attackBonus = getStatBonus('attack', upgrades.attack);
  const speedBonus = getStatBonus('speed', upgrades.speed);
  const hpBonus = getStatBonus('hp', upgrades.hp);
  const attackSpeedBonus = getStatBonus('attackSpeed', upgrades.attackSpeed);
  const rangeBonus = getStatBonus('range', upgrades.range);
  // hpRegen은 게임 루프에서 적용됨

  // 최종 스탯 계산
  const finalHp = baseStats.hp + hpBonus;
  const finalAttack = baseStats.attack + attackBonus;
  const finalSpeed = baseStats.speed + speedBonus;
  // 공격속도는 감소할수록 좋음 (빠른 공격), 최소 0.3초 보장
  const finalAttackSpeed = Math.max(0.3, baseStats.attackSpeed - attackSpeedBonus);
  const finalRange = baseStats.range + rangeBonus;

  // 전직 스킬 또는 기본 스킬
  const skills = advancedClass
    ? createAdvancedClassSkills(heroClass, advancedClass as AdvancedHeroClass)
    : createClassSkills(heroClass);

  return {
    id: 'hero',
    type: 'hero',
    heroClass,
    characterLevel,
    advancedClass: advancedClass as AdvancedHeroClass | undefined,
    tier,
    config: {
      name: configName,
      cost: {},
      hp: finalHp,
      attack: finalAttack,
      attackSpeed: finalAttackSpeed,
      speed: finalSpeed,
      range: finalRange,
      type: 'combat',
    },
    x: NEXUS_CONFIG.position.x,  // 넥서스 근처에서 시작
    y: NEXUS_CONFIG.position.y + 100,
    hp: finalHp,
    maxHp: finalHp,
    state: 'idle',
    attackCooldown: 0,
    team: 'player',

    skills,
    baseAttack: finalAttack,
    baseSpeed: finalSpeed,
    baseAttackSpeed: finalAttackSpeed,
    buffs: [],
    facingRight: true,   // 기본적으로 오른쪽을 바라봄 (이미지 반전용)
    facingAngle: 0,      // 기본적으로 오른쪽 방향 (0 라디안)
    passiveGrowth: passiveState,
    // SP 업그레이드 저장 (hpRegen 적용용)
    statUpgrades: upgrades,
  };
}

export const useRPGStore = create<RPGStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    initGame: (characterLevel: number = 1, statUpgrades?: CharacterStatUpgrades, difficulty?: RPGDifficulty, advancedClass?: string, tier?: 1 | 2) => {
      const state = get();
      // 선택된 직업이 없으면 기본값 warrior 사용
      const heroClass = state.selectedClass || 'warrior';
      // 난이도가 전달되지 않으면 스토어의 선택된 난이도 사용
      const gameDifficulty = difficulty || state.selectedDifficulty;
      const hero = createHeroUnit(heroClass, characterLevel, statUpgrades, advancedClass, tier);
      set({
        ...initialState,
        running: true,
        selectedClass: heroClass,
        selectedDifficulty: gameDifficulty,
        hero,
        // 넥서스 디펜스 초기화
        nexus: createInitialNexus(),
        enemyBases: createInitialEnemyBases(1, gameDifficulty),
        gamePhase: 'playing',
        gold: GOLD_CONFIG.STARTING_GOLD,
        upgradeLevels: createInitialUpgradeLevels(),
        fiveMinuteRewardClaimed: false,
        // 이전 게임 데이터 명시적 초기화
        enemies: [],
        activeSkillEffects: [],
        basicAttackEffects: [],
        nexusLaserEffects: [],
        damageNumbers: [],
        pendingSkills: [],
        gameOver: false,
        victory: false,
        paused: false,
        gameTime: 0,
        goldAccumulator: 0,
        lastSpawnTime: 0,
        spawnTimer: 0,
        // 멀티플레이 상태 초기화
        multiplayer: {
          isMultiplayer: false,
          isHost: false,
          roomCode: null,
          roomId: null,
          hostPlayerId: null,
          myPlayerId: null,
          myHeroId: null,
          players: [],
          remoteInputQueue: [],
          connectionState: 'disconnected',
          countdown: null,
        },
        otherHeroes: new Map(),
        otherPlayersGold: new Map(),
        otherPlayersUpgrades: new Map(),
        otherPlayersGoldAccumulator: new Map(),
        personalKills: 0,
        otherPlayersKills: new Map(),
        otherHeroesInterpolation: new Map(),
        visibility: {
          exploredCells: new Set<string>(),
          visibleRadius: RPG_CONFIG.VISIBILITY.RADIUS,
        },
        camera: {
          x: hero.x,
          y: hero.y,
          zoom: RPG_CONFIG.CAMERA.DEFAULT_ZOOM,
          followHero: true,
        },
      });
      // BGM 재생
      soundManager.playBGM('rpg_battle');
    },

    resetGame: () => {
      // BGM 중지
      soundManager.stopBGM();
      const state = get();
      set({
        ...initialState,
        // 선택된 직업과 난이도는 유지 (다시 시작할 때 사용)
        selectedClass: state.selectedClass,
        selectedDifficulty: state.selectedDifficulty,
        nexus: null,
        enemyBases: [],
        gamePhase: 'playing',
        gold: GOLD_CONFIG.STARTING_GOLD,
        upgradeLevels: createInitialUpgradeLevels(),
        fiveMinuteRewardClaimed: false,
        visibility: {
          exploredCells: new Set<string>(),
          visibleRadius: RPG_CONFIG.VISIBILITY.RADIUS,
        },
      });
    },

    setDifficulty: (difficulty: RPGDifficulty) => {
      set({ selectedDifficulty: difficulty });
    },

    selectClass: (heroClass: HeroClass) => {
      set({ selectedClass: heroClass });
    },

    createHero: (heroClass: HeroClass, characterLevel: number = 1, statUpgrades?: CharacterStatUpgrades) => {
      const hero = createHeroUnit(heroClass, characterLevel, statUpgrades);
      set({ hero, selectedClass: heroClass });
    },

    moveHero: (x, y) => {
      set((state) => {
        if (!state.hero) return state;
        // 이동 방향 계산
        const dx = x - state.hero.x;
        const dy = y - state.hero.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // 이동 방향에 따라 facingRight 및 facingAngle 업데이트
        const facingRight = x > state.hero.x;
        const facingAngle = dist > 0 ? Math.atan2(dy, dx) : state.hero.facingAngle;

        return {
          hero: {
            ...state.hero,
            targetPosition: { x, y },
            state: 'moving',
            attackTarget: undefined, // 이동 시 공격 타겟 해제
            facingRight: x !== state.hero.x ? facingRight : state.hero.facingRight, // x가 같으면 기존 방향 유지
            facingAngle: dist > 0 ? facingAngle : state.hero.facingAngle, // 거리가 0이면 기존 방향 유지
          },
        };
      });
    },

    setMoveDirection: (direction) => {
      set((state) => {
        if (!state.hero) return state;

        // 방향이 있을 때 바라보는 방향 업데이트
        let facingRight = state.hero.facingRight;
        let facingAngle = state.hero.facingAngle;

        if (direction && (direction.x !== 0 || direction.y !== 0)) {
          facingRight = direction.x >= 0;
          facingAngle = Math.atan2(direction.y, direction.x);
        }

        return {
          hero: {
            ...state.hero,
            moveDirection: direction,
            targetPosition: undefined, // WASD 이동 시 목표 위치 해제
            state: direction ? 'moving' : 'idle',
            facingRight,
            facingAngle,
          },
        };
      });
    },

    setAttackTarget: (targetId) => {
      set((state) => {
        if (!state.hero) return state;
        return {
          hero: {
            ...state.hero,
            attackTarget: targetId,
            targetPosition: undefined, // 공격 시 이동 타겟 해제
            state: targetId ? 'attacking' : 'idle',
          },
        };
      });
    },

    damageHero: (amount) => {
      set((state) => {
        if (!state.hero) return state;
        const newHp = Math.max(0, state.hero.hp - amount);
        const isDead = newHp <= 0;

        // 사망 시 deathTime 설정 (부활 시스템용) - gameOver는 설정하지 않음
        if (isDead && !state.hero.deathTime) {
          return {
            lastDamageTime: state.gameTime,
            hero: {
              ...state.hero,
              hp: newHp,
              deathTime: state.gameTime,
              castingUntil: undefined,  // 시전 상태 초기화
              dashState: undefined,     // 돌진 상태 초기화
            },
          };
        }

        return {
          lastDamageTime: state.gameTime,
          hero: { ...state.hero, hp: newHp },
        };
      });
    },

    healHero: (amount) => {
      set((state) => {
        if (!state.hero) return state;
        const newHp = Math.min(state.hero.maxHp, state.hero.hp + amount);
        return {
          hero: { ...state.hero, hp: newHp },
        };
      });
    },

    reviveHero: () => {
      set((state) => {
        if (!state.hero) return state;

        // 넥서스 근처에서 부활
        const nexusX = state.nexus?.x || RPG_CONFIG.MAP_WIDTH / 2;
        const nexusY = state.nexus?.y || RPG_CONFIG.MAP_HEIGHT / 2;
        const offsetX = (Math.random() - 0.5) * RPG_CONFIG.REVIVE.SPAWN_OFFSET * 2;
        const offsetY = (Math.random() - 0.5) * RPG_CONFIG.REVIVE.SPAWN_OFFSET * 2;

        const reviveX = nexusX + offsetX;
        const reviveY = nexusY + offsetY;

        // 풀 HP로 부활 + 무적 버프 추가
        const invincibleBuff: Buff = {
          type: 'invincible',
          duration: RPG_CONFIG.REVIVE.INVINCIBLE_DURATION,
          startTime: state.gameTime,
        };

        return {
          hero: {
            ...state.hero,
            hp: state.hero.maxHp * RPG_CONFIG.REVIVE.REVIVE_HP_PERCENT,
            x: reviveX,
            y: reviveY,
            deathTime: undefined,
            moveDirection: undefined,
            state: 'idle',
            buffs: [...(state.hero.buffs || []), invincibleBuff],
            castingUntil: undefined,  // 시전 상태 초기화
            dashState: undefined,     // 돌진 상태 초기화
          },
          // 부활 시 카메라를 영웅 위치로 자동 고정
          camera: {
            ...state.camera,
            x: reviveX,
            y: reviveY,
          },
        };
      });
    },

    updateHeroPosition: (x, y) => {
      set((state) => {
        if (!state.hero) return state;
        return {
          hero: { ...state.hero, x, y },
        };
      });
    },

    // 영웅 전체 상태 업데이트 (이동, 돌진 등)
    updateHeroState: (heroUpdate: Partial<HeroUnit>) => {
      set((state) => {
        if (!state.hero) return state;
        return {
          hero: { ...state.hero, ...heroUpdate },
        };
      });
    },

    // ============================================
    // 전직 관련 액션
    // ============================================

    // 전직 가능 여부 확인
    canAdvanceJob: () => {
      const state = get();
      if (!state.hero) return false;
      // 이미 전직했으면 불가
      if (state.hero.advancedClass) return false;
      // 레벨 조건 확인
      return state.hero.characterLevel >= JOB_ADVANCEMENT_REQUIREMENTS.minClassLevel;
    },

    // 전직 실행
    advanceJob: (advancedClass: AdvancedHeroClass) => {
      const state = get();
      if (!state.hero) return false;
      if (!get().canAdvanceJob()) return false;

      // 전직 직업이 기본 직업에서 전직 가능한지 확인
      const validOptions = ADVANCEMENT_OPTIONS[state.hero.heroClass];
      if (!validOptions.includes(advancedClass)) return false;

      // 전직 스탯 가져오기
      const advancedConfig = ADVANCED_CLASS_CONFIGS[advancedClass];
      const advancedStats = advancedConfig.stats;

      // SP 업그레이드 보너스 다시 적용
      const upgrades = state.hero.statUpgrades || { attack: 0, speed: 0, hp: 0, attackSpeed: 0, range: 0, hpRegen: 0 };
      const attackBonus = getStatBonus('attack', upgrades.attack);
      const speedBonus = getStatBonus('speed', upgrades.speed);
      const hpBonus = getStatBonus('hp', upgrades.hp);
      const attackSpeedBonus = getStatBonus('attackSpeed', upgrades.attackSpeed);
      const rangeBonus = getStatBonus('range', upgrades.range);

      // 최종 스탯 계산 (전직 기본 스탯 + SP 보너스)
      const finalHp = advancedStats.hp + hpBonus;
      const finalAttack = advancedStats.attack + attackBonus;
      const finalSpeed = advancedStats.speed + speedBonus;
      const finalAttackSpeed = Math.max(0.3, advancedStats.attackSpeed - attackSpeedBonus);
      const finalRange = advancedStats.range + rangeBonus;

      // 전직 스킬 생성
      const advancedSkills = createAdvancedClassSkills(state.hero.heroClass, advancedClass);

      // 현재 HP 비율 유지
      const hpRatio = state.hero.hp / state.hero.maxHp;

      set({
        hero: {
          ...state.hero,
          advancedClass,
          tier: 1,
          // 스탯 업데이트
          maxHp: finalHp,
          hp: Math.floor(finalHp * hpRatio), // 현재 HP 비율 유지
          baseAttack: finalAttack,
          baseSpeed: finalSpeed,
          baseAttackSpeed: finalAttackSpeed,
          config: {
            ...state.hero.config,
            hp: finalHp,
            attack: finalAttack,
            attackSpeed: finalAttackSpeed,
            speed: finalSpeed,
            range: finalRange,
          },
          // 스킬 변경
          skills: advancedSkills,
        },
      });

      console.log(`[전직] ${state.hero.heroClass} → ${advancedClass} 전직 완료`);
      return true;
    },

    // 2차 강화 확인 및 적용 (레벨 50 도달 시 자동 호출)
    checkAndApplySecondEnhancement: () => {
      const state = get();
      if (!state.hero) return false;
      // 전직하지 않았으면 불가
      if (!state.hero.advancedClass) return false;
      // 이미 2차 강화 완료
      if (state.hero.tier === 2) return false;
      // 레벨 조건 확인
      if (state.hero.characterLevel < JOB_ADVANCEMENT_REQUIREMENTS.secondEnhancementLevel) return false;

      // 전직 기본 스탯의 120%로 강화
      const advancedConfig = ADVANCED_CLASS_CONFIGS[state.hero.advancedClass];
      const baseStats = advancedConfig.stats;

      // 2차 강화 스탯 (기본 스탯 × 1.2)
      const enhancedHp = Math.floor(baseStats.hp * SECOND_ENHANCEMENT_MULTIPLIER);
      const enhancedAttack = Math.floor(baseStats.attack * SECOND_ENHANCEMENT_MULTIPLIER);
      const enhancedSpeed = baseStats.speed * SECOND_ENHANCEMENT_MULTIPLIER;
      const enhancedAttackSpeed = baseStats.attackSpeed / SECOND_ENHANCEMENT_MULTIPLIER; // 더 빨라짐
      const enhancedRange = Math.floor(baseStats.range * SECOND_ENHANCEMENT_MULTIPLIER);

      // SP 업그레이드 보너스 다시 적용
      const upgrades = state.hero.statUpgrades || { attack: 0, speed: 0, hp: 0, attackSpeed: 0, range: 0, hpRegen: 0 };
      const attackBonus = getStatBonus('attack', upgrades.attack);
      const speedBonus = getStatBonus('speed', upgrades.speed);
      const hpBonus = getStatBonus('hp', upgrades.hp);
      const attackSpeedBonus = getStatBonus('attackSpeed', upgrades.attackSpeed);
      const rangeBonus = getStatBonus('range', upgrades.range);

      // 최종 스탯 계산
      const finalHp = enhancedHp + hpBonus;
      const finalAttack = enhancedAttack + attackBonus;
      const finalSpeed = enhancedSpeed + speedBonus;
      const finalAttackSpeed = Math.max(0.3, enhancedAttackSpeed - attackSpeedBonus);
      const finalRange = enhancedRange + rangeBonus;

      // 현재 HP 비율 유지
      const hpRatio = state.hero.hp / state.hero.maxHp;

      set({
        hero: {
          ...state.hero,
          tier: 2,
          // 스탯 업데이트
          maxHp: finalHp,
          hp: Math.floor(finalHp * hpRatio),
          baseAttack: finalAttack,
          baseSpeed: finalSpeed,
          baseAttackSpeed: finalAttackSpeed,
          config: {
            ...state.hero.config,
            hp: finalHp,
            attack: finalAttack,
            attackSpeed: finalAttackSpeed,
            speed: finalSpeed,
            range: finalRange,
          },
        },
      });

      console.log(`[2차 강화] ${state.hero.advancedClass} 2차 강화 완료!`);
      return true;
    },

    setMousePosition: (x, y) => {
      set((state) => {
        if (!state.hero) return { mousePosition: { x, y } };
        // 마우스 위치에 따라 facingRight 업데이트
        const facingRight = x > state.hero.x;
        return {
          mousePosition: { x, y },
          hero: {
            ...state.hero,
            facingRight: x !== state.hero.x ? facingRight : state.hero.facingRight,
          },
        };
      });
    },

    // 골드 추가 (추가 골드 보너스 적용)
    addGold: (amount) => {
      set((state) => ({
        gold: state.gold + amount,
        stats: {
          ...state.stats,
          totalGoldEarned: state.stats.totalGoldEarned + amount,
        },
      }));
    },

    // 영웅 스탯 업그레이드
    upgradeHeroStat: (stat: UpgradeType) => {
      const state = get();
      const { isMultiplayer, isHost } = state.multiplayer;
      const heroClass = state.hero?.heroClass;

      // 멀티플레이어 클라이언트(호스트가 아닌 플레이어): 네트워크로 업그레이드 요청
      if (isMultiplayer && !isHost) {
        const currentLevel = state.upgradeLevels[stat];
        const characterLevel = state.hero?.characterLevel || 1;

        // 로컬에서 업그레이드 가능 여부만 확인 (실제 처리는 호스트에서)
        if (!canUpgrade(state.gold, currentLevel, characterLevel, stat, heroClass)) {
          return false;
        }

        // 호스트에게 업그레이드 요청 전송 (위치 포함하여 위치 되돌아감 버그 방지)
        const hero = state.hero;
        const input: PlayerInput = {
          playerId: state.multiplayer.myPlayerId || '',
          moveDirection: null,
          position: hero ? { x: hero.x, y: hero.y } : undefined,
          upgradeRequested: stat,
          timestamp: Date.now(),
        };
        wsClient.hostSendPlayerInput(input);
        return true;  // 요청 전송 성공 (실제 결과는 호스트에서 처리)
      }

      // 싱글플레이 또는 호스트: 로컬에서 바로 처리
      const currentLevel = state.upgradeLevels[stat];
      const characterLevel = state.hero?.characterLevel || 1;

      // 업그레이드 가능 여부 확인
      if (!canUpgrade(state.gold, currentLevel, characterLevel, stat, heroClass)) {
        return false;
      }

      const cost = getUpgradeCost(currentLevel);

      set((prevState) => {
        const newUpgradeLevels = {
          ...prevState.upgradeLevels,
          [stat]: prevState.upgradeLevels[stat] + 1,
        };

        // 영웅 스탯 업데이트
        let heroUpdate = {};
        if (prevState.hero) {
          let updatedHero = { ...prevState.hero };

          // HP 업그레이드 시 영웅 최대 HP도 증가
          if (stat === 'hp') {
            const hpBonus = UPGRADE_CONFIG.hp.perLevel;
            updatedHero = {
              ...updatedHero,
              maxHp: updatedHero.maxHp + hpBonus,
              hp: Math.min(updatedHero.hp + hpBonus, updatedHero.maxHp + hpBonus),
            };
          }

          // 공격속도 업그레이드 시 영웅 공격속도 감소 (더 빠른 공격)
          if (stat === 'attackSpeed') {
            const attackSpeedBonus = UPGRADE_CONFIG.attackSpeed.perLevel;
            const currentAttackSpeed = updatedHero.config.attackSpeed || updatedHero.baseAttackSpeed || 1;
            updatedHero = {
              ...updatedHero,
              config: {
                ...updatedHero.config,
                attackSpeed: Math.max(0.3, currentAttackSpeed - attackSpeedBonus),
              },
            };
          }

          // 사거리 업그레이드 시 영웅 사거리 증가 (궁수/마법사만)
          if (stat === 'range' && (prevState.hero.heroClass === 'archer' || prevState.hero.heroClass === 'mage')) {
            const rangeBonus = UPGRADE_CONFIG.range.perLevel;
            updatedHero = {
              ...updatedHero,
              config: {
                ...updatedHero.config,
                range: (updatedHero.config.range || 0) + rangeBonus,
              },
            };
          }

          heroUpdate = { hero: updatedHero };
        }

        return {
          gold: prevState.gold - cost,
          upgradeLevels: newUpgradeLevels,
          ...heroUpdate,
        };
      });

      return true;
    },

    useSkill: (skillType) => {
      const state = get();
      if (!state.hero) return false;

      const skill = state.hero.skills.find((s) => s.type === skillType);
      if (!skill || skill.currentCooldown > 0) {
        return false;
      }

      // 쿨다운 시작
      set((state) => {
        if (!state.hero) return state;
        const updatedSkills = state.hero.skills.map((s) => {
          if (s.type === skillType) {
            return { ...s, currentCooldown: s.cooldown };
          }
          return s;
        });
        return {
          hero: { ...state.hero, skills: updatedSkills },
        };
      });

      return true;
    },

    updateSkillCooldowns: (deltaTime) => {
      set((state) => {
        if (!state.hero) return state;

        // 광전사 버프 확인 (공격속도 증가)
        const berserkerBuff = state.hero.buffs?.find(b => b.type === 'berserker');
        const attackSpeedMultiplier = berserkerBuff?.speedBonus ? (1 + berserkerBuff.speedBonus) : 1;

        const updatedSkills = state.hero.skills.map((skill) => {
          // Q스킬(기본 공격)에만 공격속도 버프 적용
          const isQSkill = skill.type.endsWith('_q');
          const cooldownReduction = isQSkill
            ? deltaTime * attackSpeedMultiplier
            : deltaTime;
          return {
            ...skill,
            currentCooldown: Math.max(0, skill.currentCooldown - cooldownReduction),
          };
        });
        return {
          hero: { ...state.hero, skills: updatedSkills },
        };
      });
    },

    addSkillEffect: (effect) => {
      set((state) => ({
        activeSkillEffects: [...state.activeSkillEffects, effect],
      }));
    },

    removeSkillEffect: (index) => {
      set((state) => ({
        activeSkillEffects: state.activeSkillEffects.filter((_, i) => i !== index),
      }));
    },

    // 타겟 ID가 있는 스킬 이펙트의 targetPosition을 적의 실시간 위치로 업데이트 (저격 등)
    updateSkillEffectTargetPositions: () => {
      set((state) => {
        const enemies = state.enemies;
        let hasUpdates = false;

        const updatedEffects = state.activeSkillEffects.map(effect => {
          // targetId가 있는 이펙트만 업데이트 (저격 스킬 등)
          if (effect.targetId) {
            const targetEnemy = enemies.find(e => e.id === effect.targetId);
            if (targetEnemy && targetEnemy.hp > 0) {
              // 적의 현재 위치로 targetPosition 업데이트
              if (effect.targetPosition?.x !== targetEnemy.x ||
                  effect.targetPosition?.y !== targetEnemy.y) {
                hasUpdates = true;
                return {
                  ...effect,
                  targetPosition: { x: targetEnemy.x, y: targetEnemy.y },
                };
              }
            }
          }
          return effect;
        });

        // 변경이 있을 때만 상태 업데이트
        return hasUpdates ? { activeSkillEffects: updatedEffects } : {};
      });
    },

    // 기본 공격 이펙트 추가 (네트워크 동기화용)
    addBasicAttackEffect: (effect) => {
      set((state) => ({
        basicAttackEffects: [...state.basicAttackEffects, effect],
      }));
    },

    // 오래된 기본 공격 이펙트 정리 (300ms 이후)
    cleanBasicAttackEffects: () => {
      const now = Date.now();
      set((state) => ({
        basicAttackEffects: state.basicAttackEffects.filter(e => now - e.timestamp < 300),
      }));
    },

    // 넥서스 레이저 이펙트 추가
    addNexusLaserEffect: (effect: NexusLaserEffect) => {
      set((state) => ({
        nexusLaserEffects: [...state.nexusLaserEffects, effect],
      }));
    },

    // 오래된 넥서스 레이저 이펙트 정리 (500ms 이후)
    cleanNexusLaserEffects: () => {
      const now = Date.now();
      set((state) => ({
        nexusLaserEffects: state.nexusLaserEffects.filter(e => now - e.timestamp < 500),
      }));
    },

    // 보스 스킬 경고 추가
    addBossSkillWarning: (warning: BossSkillWarning) => {
      set((state) => ({
        bossSkillWarnings: [...state.bossSkillWarnings, warning],
      }));
    },

    // 보스 스킬 경고 업데이트 (만료된 경고 제거)
    updateBossSkillWarnings: (gameTime: number) => {
      set((state) => ({
        bossSkillWarnings: state.bossSkillWarnings.filter(w => gameTime < w.startTime + w.duration),
      }));
    },

    // 플로팅 데미지 숫자 추가
    addDamageNumber: (x: number, y: number, amount: number, type: DamageNumberType) => {
      const id = `dmg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      // 약간의 랜덤 오프셋 추가 (겹치지 않도록)
      const offsetX = (Math.random() - 0.5) * 30;
      const offsetY = (Math.random() - 0.5) * 20;
      const damageNumber: DamageNumber = {
        id,
        x: x + offsetX,
        y: y + offsetY,
        amount,
        type,
        createdAt: Date.now(),
      };
      set((state) => ({
        damageNumbers: [...state.damageNumbers, damageNumber],
      }));
    },

    // 플로팅 데미지 숫자 제거
    removeDamageNumber: (id: string) => {
      set((state) => ({
        damageNumbers: state.damageNumbers.filter(d => d.id !== id),
      }));
    },

    // 오래된 데미지 숫자 정리 (1초 후 제거)
    cleanDamageNumbers: () => {
      const now = Date.now();
      set((state) => ({
        damageNumbers: state.damageNumbers.filter(d => now - d.createdAt < 1000),
      }));
    },

    // 스폰 타이머 설정
    setSpawnTimer: (time: number) => {
      set({ spawnTimer: time });
    },

    addEnemy: (enemy) => {
      set((state) => ({
        enemies: [...state.enemies, enemy],
      }));
    },

    removeEnemy: (enemyId) => {
      set((state) => ({
        enemies: state.enemies.filter((e) => e.id !== enemyId),
      }));
    },

    damageEnemy: (enemyId, amount, killerHeroId?) => {
      let killed = false;
      let goldReward = 0;
      let isBoss = false;
      let enemyDamagedBy: string[] = [];
      const gameTime = get().gameTime;
      const AGGRO_DURATION = 5; // 어그로 지속 시간 (초)

      set((state) => {
        const enemies = state.enemies.map((enemy) => {
          if (enemy.id === enemyId) {
            const newHp = enemy.hp - amount;

            // 모든 적에 대해 데미지 관여자 추적 (공동 처치용)
            let updatedDamagedBy = enemy.damagedBy || [];
            if (killerHeroId && !updatedDamagedBy.includes(killerHeroId)) {
              updatedDamagedBy = [...updatedDamagedBy, killerHeroId];
            }

            if (newHp <= 0) {
              killed = true;
              goldReward = enemy.goldReward || 0;
              isBoss = enemy.type === 'boss';
              enemyDamagedBy = updatedDamagedBy;
              return { ...enemy, hp: 0, damagedBy: updatedDamagedBy };
            }
            // 피해를 입으면 어그로 설정 (킬러 영웅 ID도 저장)
            return {
              ...enemy,
              hp: newHp,
              aggroOnHero: true,
              aggroExpireTime: gameTime + AGGRO_DURATION,
              targetHeroId: killerHeroId,
              damagedBy: updatedDamagedBy,
            };
          }
          return enemy;
        });
        return { enemies };
      });

      // 처치 시 골드 획득 및 통계 업데이트
      if (killed && goldReward > 0) {
        const state = get();
        const myHeroId = state.multiplayer.myHeroId;
        const isMultiplayer = state.multiplayer.isMultiplayer;
        const isHost = state.multiplayer.isHost;

        // 골드 분배 로직
        if (isBoss && isMultiplayer && enemyDamagedBy.length > 0) {
          // 보스 처치: 골드를 관여한 플레이어에게만 균등 분배
          const contributorCount = enemyDamagedBy.length;
          const goldPerContributor = Math.floor(goldReward / contributorCount);

          for (const heroId of enemyDamagedBy) {
            if (heroId === myHeroId) {
              get().addGold(goldPerContributor);
            } else {
              state.addGoldToOtherPlayer(heroId, goldPerContributor);
            }
          }
        } else if (killerHeroId && isMultiplayer && killerHeroId !== myHeroId) {
          // 다른 플레이어가 일반 적 처치
          state.addGoldToOtherPlayer(killerHeroId, goldReward);
        } else {
          // 호스트가 처치하거나 싱글플레이어
          get().addGold(goldReward);
        }

        // 처치 수 분배 (호스트에서만 처리 - 멀티플레이어 시)
        if (isMultiplayer && isHost) {
          // 공동 처치: 모든 관여자에게 처치 수 증가
          if (enemyDamagedBy.length > 1) {
            // 여러 명이 공동 처치한 경우: 관여한 모든 플레이어에게 +1
            for (const heroId of enemyDamagedBy) {
              if (heroId === myHeroId) {
                get().incrementPersonalKills();
              } else {
                get().incrementOtherPlayerKills(heroId);
              }
            }
          } else if (enemyDamagedBy.length === 1) {
            // 단독 처치: 해당 플레이어에게만 +1
            const soloKiller = enemyDamagedBy[0];
            if (soloKiller === myHeroId) {
              get().incrementPersonalKills();
            } else {
              get().incrementOtherPlayerKills(soloKiller);
            }
          } else if (killerHeroId) {
            // damagedBy가 비어있지만 killerHeroId가 있는 경우
            if (killerHeroId === myHeroId) {
              get().incrementPersonalKills();
            } else {
              get().incrementOtherPlayerKills(killerHeroId);
            }
          }
        } else if (!isMultiplayer) {
          // 싱글플레이어: 기존처럼 totalKills 증가
          get().incrementKills();
        }

        // 전체 통계용 incrementKills는 멀티플레이어에서도 호출 (총 킬 수 추적)
        if (isMultiplayer) {
          get().incrementKills();
        }

        if (isBoss) {
          get().incrementBossesKilled();
        }
      }

      return killed;
    },

    updateEnemies: (enemies) => {
      set({ enemies });
    },

    setLastSpawnTime: (time) => {
      set({ lastSpawnTime: time });
    },

    // 넥서스 피해
    damageNexus: (amount: number) => {
      set((state) => {
        if (!state.nexus) return state;
        const newHp = Math.max(0, state.nexus.hp - amount);

        // 넥서스 파괴 시 게임 오버
        if (newHp <= 0) {
          return {
            nexus: { ...state.nexus, hp: 0 },
            gamePhase: 'defeat',
            gameOver: true,
            victory: false,
          };
        }

        return {
          nexus: { ...state.nexus, hp: newHp },
        };
      });
    },

    // 적 기지 피해
    damageBase: (baseId: EnemyBaseId, amount: number, attackerId?: string) => {
      let destroyed = false;
      let baseAttackers: string[] = [];
      let goldReceived = 0;

      set((state) => {
        const updatedBases = state.enemyBases.map((base) => {
          if (base.id === baseId && !base.destroyed) {
            // 공격자 추적 (멀티플레이 골드 배분용)
            const newAttackers = new Set(base.attackers);
            if (attackerId) {
              newAttackers.add(attackerId);
            }

            const newHp = Math.max(0, base.hp - amount);
            if (newHp <= 0) {
              destroyed = true;
              baseAttackers = Array.from(newAttackers);
              return { ...base, hp: 0, destroyed: true, attackers: newAttackers };
            }
            return { ...base, hp: newHp, attackers: newAttackers };
          }
          return base;
        });

        // 기지 파괴 시 통계 업데이트 (골드는 아래에서 별도 처리)
        const statsUpdate = destroyed ? {
          stats: {
            ...state.stats,
            basesDestroyed: state.stats.basesDestroyed + 1,
          },
        } : {};

        // 두 기지 모두 파괴되었는지 확인
        const allBasesDestroyed = updatedBases.every((b) => b.destroyed);
        const phaseUpdate = allBasesDestroyed ? { gamePhase: 'boss_phase' as RPGGamePhase } : {};

        return {
          enemyBases: updatedBases,
          ...statsUpdate,
          ...phaseUpdate,
        };
      });

      // 기지 파괴 시 골드 분배 (damageEnemy와 동일한 패턴)
      if (destroyed) {
        const state = get();
        const myHeroId = state.multiplayer.myHeroId;
        const isMultiplayer = state.multiplayer.isMultiplayer;
        const baseReward = GOLD_CONFIG.BASE_DESTROY_REWARDS[state.selectedDifficulty];

        if (isMultiplayer && baseAttackers.length > 0) {
          // 멀티플레이: 공격에 참여한 모든 플레이어에게 균등 분배
          const goldPerAttacker = Math.floor(baseReward / baseAttackers.length);

          for (const heroId of baseAttackers) {
            if (heroId === myHeroId) {
              get().addGold(goldPerAttacker);
              goldReceived = goldPerAttacker; // 호출자가 받은 골드
            } else {
              state.addGoldToOtherPlayer(heroId, goldPerAttacker);
            }
          }

          // 호출자가 공격자 목록에 없었던 경우 (다른 플레이어가 마무리한 경우)
          if (attackerId && !baseAttackers.includes(attackerId)) {
            goldReceived = 0;
          }
        } else {
          // 싱글플레이 또는 공격자가 없는 경우: 호스트에게 전체 골드 지급
          get().addGold(baseReward);
          goldReceived = baseReward;
        }
      }

      return { destroyed, goldReceived };
    },

    // 보스 스폰
    spawnBosses: () => {
      // 실제 보스 스폰 로직은 bossSystem.ts에서 처리
      // 여기서는 게임 단계만 변경
      set({ gamePhase: 'boss_phase' });
    },

    // 게임 단계 설정
    setGamePhase: (phase: RPGGamePhase) => {
      set({ gamePhase: phase });
      // 보스 페이즈에서 BGM 변경
      if (phase === 'boss_phase') {
        soundManager.playBGM('rpg_boss');
      }
    },

    setCamera: (x, y) => {
      set((state) => ({
        camera: { ...state.camera, x, y },
      }));
    },

    setZoom: (zoom) => {
      const clampedZoom = Math.max(
        RPG_CONFIG.CAMERA.MIN_ZOOM,
        Math.min(RPG_CONFIG.CAMERA.MAX_ZOOM, zoom)
      );
      set((state) => ({
        camera: { ...state.camera, zoom: clampedZoom },
      }));
    },

    toggleFollowHero: () => {
      set((state) => ({
        camera: { ...state.camera, followHero: !state.camera.followHero },
      }));
    },

    centerOnHero: () => {
      const state = get();
      if (state.hero) {
        set((state) => ({
          camera: { ...state.camera, x: state.hero!.x, y: state.hero!.y },
        }));
      }
    },

    setRunning: (running) => set({ running }),

    setPaused: (paused) => set({ paused }),

    setGameOver: (victory) => {
      // BGM 중지
      soundManager.stopBGM();
      const state = get();
      const totalBases = state.enemyBases.length;
      set({
        gameOver: true,
        victory,
        running: false,
        gamePhase: victory ? 'victory' : 'defeat',
        result: {
          victory,
          totalKills: state.stats.totalKills,
          totalGoldEarned: state.stats.totalGoldEarned,
          basesDestroyed: state.stats.basesDestroyed,
          bossesKilled: state.stats.bossesKilled,
          totalBases,
          totalBosses: totalBases, // 보스 수 = 기지 수
          timePlayed: state.stats.timePlayed,
          heroClass: state.hero?.heroClass || 'warrior',
          finalUpgradeLevels: state.upgradeLevels,
        },
      });
    },

    setFiveMinuteRewardClaimed: () => {
      set({ fiveMinuteRewardClaimed: true });
    },

    updateGameTime: (deltaTime) => {
      const state = get();

      // 호스트 자신의 초당 골드 수급량 계산
      const myGoldPerSecond = GOLD_CONFIG.PASSIVE_GOLD_PER_SECOND +
        calculateAllUpgradeBonuses(state.upgradeLevels).goldRateBonus;

      // 이번 프레임에 얻은 소수점 골드를 누적
      const myGoldGained = myGoldPerSecond * deltaTime;
      const newAccumulator = state.goldAccumulator + myGoldGained;

      // 1 이상이면 정수 부분만 골드로 추가, 나머지는 계속 누적
      const goldToAdd = Math.floor(newAccumulator);
      const remainder = newAccumulator - goldToAdd;

      // 멀티플레이어: 다른 플레이어에게도 패시브 골드 지급 (호스트가 처리)
      const newOtherAccumulators = new Map(state.otherPlayersGoldAccumulator);
      if (state.multiplayer.isMultiplayer && state.multiplayer.isHost) {
        state.otherPlayersGold.forEach((_, heroId) => {
          const otherUpgrades = state.otherPlayersUpgrades.get(heroId);
          const otherGoldPerSecond = GOLD_CONFIG.PASSIVE_GOLD_PER_SECOND +
            (otherUpgrades ? calculateAllUpgradeBonuses(otherUpgrades).goldRateBonus : 0);

          // 다른 플레이어의 골드 누적
          const otherCurrentAccumulator = state.otherPlayersGoldAccumulator.get(heroId) || 0;
          const otherNewAccumulator = otherCurrentAccumulator + (otherGoldPerSecond * deltaTime);
          const otherGoldToAdd = Math.floor(otherNewAccumulator);
          const otherRemainder = otherNewAccumulator - otherGoldToAdd;

          newOtherAccumulators.set(heroId, otherRemainder);

          if (otherGoldToAdd > 0) {
            get().addGoldToOtherPlayer(heroId, otherGoldToAdd);
          }
        });
      }

      set({
        gameTime: state.gameTime + deltaTime,
        goldAccumulator: remainder,
        gold: state.gold + goldToAdd,
        otherPlayersGoldAccumulator: newOtherAccumulators,
        stats: {
          ...state.stats,
          timePlayed: state.stats.timePlayed + deltaTime,
          totalGoldEarned: state.stats.totalGoldEarned + goldToAdd,
        },
      });
    },

    incrementKills: () => {
      set((state) => ({
        stats: { ...state.stats, totalKills: state.stats.totalKills + 1 },
      }));
    },

    incrementPersonalKills: () => {
      set((state) => ({
        personalKills: state.personalKills + 1,
      }));
    },

    incrementOtherPlayerKills: (heroId: string) => {
      set((state) => {
        const newKills = new Map(state.otherPlayersKills);
        newKills.set(heroId, (newKills.get(heroId) || 0) + 1);
        return { otherPlayersKills: newKills };
      });
    },

    addGoldEarned: (amount) => {
      set((state) => ({
        stats: { ...state.stats, totalGoldEarned: state.stats.totalGoldEarned + amount },
      }));
    },

    incrementBasesDestroyed: () => {
      set((state) => ({
        stats: { ...state.stats, basesDestroyed: state.stats.basesDestroyed + 1 },
      }));
    },

    incrementBossesKilled: () => {
      set((state) => ({
        stats: { ...state.stats, bossesKilled: state.stats.bossesKilled + 1 },
      }));
    },

    // 공격 사거리 표시
    setShowAttackRange: (show: boolean) => {
      set({ showAttackRange: show });
    },

    // 호버된 스킬 사거리 설정
    setHoveredSkillRange: (range) => {
      set({ hoveredSkillRange: range });
    },

    // 버프 관련
    addBuff: (buff: Buff) => {
      set((state) => {
        if (!state.hero) return state;

        // 같은 타입의 기존 버프 찾기
        const existingBuff = state.hero.buffs.find(b => b.type === buff.type);

        // 같은 타입 버프가 있으면 더 긴 지속시간 선택
        let finalBuff = buff;
        if (existingBuff) {
          const existingRemaining = existingBuff.duration;
          if (existingRemaining > buff.duration) {
            // 기존 버프의 지속시간이 더 길면, 새 버프의 효과 + 기존 지속시간 유지
            finalBuff = {
              ...buff,
              duration: existingRemaining,
            };
          }
        }

        const filteredBuffs = state.hero.buffs.filter(b => b.type !== buff.type);
        return {
          hero: {
            ...state.hero,
            buffs: [...filteredBuffs, finalBuff],
          },
        };
      });
    },

    removeBuff: (buffType: string) => {
      set((state) => {
        if (!state.hero) return state;
        return {
          hero: {
            ...state.hero,
            buffs: state.hero.buffs.filter(b => b.type !== buffType),
          },
        };
      });
    },

    updateBuffs: (deltaTime: number) => {
      set((state) => {
        // ============================================
        // 오라(Aura) 버프 시스템
        // - 시전자의 버프가 활성화된 동안 범위 내 아군에게 지속적으로 버프 적용
        // - 범위를 벗어나면 버프 해제, 다시 들어오면 재적용
        // - 지속시간은 시전자의 남은 시간 기준
        // ============================================

        // 버프 공유 범위 결정
        const getShareRange = (buffType: string): number => {
          if (buffType === 'berserker') return BERSERKER_SHARE_RANGE;
          if (buffType === 'ironwall') return IRONWALL_SHARE_RANGE;
          return 0; // 공유 대상 아님
        };

        // 모든 영웅 정보 수집 (ID -> {hero, x, y})
        const allHeroes = new Map<string, { hero: HeroUnit; x: number; y: number }>();
        if (state.hero) {
          allHeroes.set(state.hero.id, { hero: state.hero, x: state.hero.x, y: state.hero.y });
        }
        state.otherHeroes.forEach((hero, heroId) => {
          allHeroes.set(heroId, { hero, x: hero.x, y: hero.y });
        });

        // 1단계: 본인 시전 버프(casterId 없음)의 지속시간 감소
        // 공유받은 버프(casterId 있음)는 제거 (2단계에서 오라로 재적용)
        // 새로 추가된 버프(현재 프레임)는 지속시간 감소 건너뛰기
        const processOwnBuffs = (buffs: Buff[]): Buff[] => {
          return buffs
            .filter(buff => !buff.casterId) // 본인 시전 버프만
            .map(buff => {
              // 방금 추가된 버프인지 확인 (startTime이 현재 gameTime과 같거나 매우 가까움)
              const isNewBuff = state.gameTime - buff.startTime < deltaTime;
              if (isNewBuff) {
                // 새 버프는 지속시간 감소 없이 유지
                return buff;
              }
              return { ...buff, duration: buff.duration - deltaTime };
            })
            .filter(buff => buff.duration > 0);
        };

        // 2단계: 시전자의 활성 오라 버프 수집
        // { casterId, buffType, buff, casterX, casterY }
        const activeAuras: Array<{
          casterId: string;
          buffType: string;
          buff: Buff;
          casterX: number;
          casterY: number;
          shareRange: number;
        }> = [];

        allHeroes.forEach(({ hero, x, y }, heroId) => {
          // 본인이 시전한 버프 중 오라 타입 찾기
          const ownBuffs = hero.buffs.filter(b => !b.casterId);
          for (const buff of ownBuffs) {
            const shareRange = getShareRange(buff.type);
            if (shareRange > 0) {
              // 새로 추가된 버프인지 확인
              const isNewBuff = state.gameTime - buff.startTime < deltaTime;
              // 지속시간 감소 적용 (새 버프는 건너뛰기)
              const newDuration = isNewBuff ? buff.duration : buff.duration - deltaTime;
              if (newDuration > 0) {
                activeAuras.push({
                  casterId: heroId,
                  buffType: buff.type,
                  buff: { ...buff, duration: newDuration },
                  casterX: x,
                  casterY: y,
                  shareRange,
                });
              }
            }
          }
        });

        // 3단계: 각 영웅에게 오라 버프 적용
        const applyAuraBuffs = (heroId: string, heroX: number, heroY: number, ownBuffs: Buff[]): Buff[] => {
          const resultBuffs = [...ownBuffs];

          for (const aura of activeAuras) {
            // 시전자 자신은 스킵 (이미 본인 버프로 처리됨)
            if (aura.casterId === heroId) continue;

            // 거리 체크
            const dist = distance(heroX, heroY, aura.casterX, aura.casterY);
            if (dist <= aura.shareRange) {
              // 범위 내: 버프 적용 또는 갱신
              const existingIdx = resultBuffs.findIndex(b => b.type === aura.buffType && b.casterId === aura.casterId);
              const sharedBuff: Buff = {
                ...aura.buff,
                casterId: aura.casterId, // 시전자 ID 표시
              };

              if (existingIdx >= 0) {
                // 이미 있으면 갱신 (시전자의 남은 시간으로)
                resultBuffs[existingIdx] = sharedBuff;
              } else {
                // 없으면 새로 추가
                resultBuffs.push(sharedBuff);
              }
            }
            // 범위 밖: 공유받은 버프는 이미 processOwnBuffs에서 제거됨
          }

          return resultBuffs;
        };

        // 내 영웅 버프 업데이트
        let updatedHero = state.hero;
        if (state.hero) {
          const ownBuffs = processOwnBuffs(state.hero.buffs);
          const finalBuffs = applyAuraBuffs(state.hero.id, state.hero.x, state.hero.y, ownBuffs);
          updatedHero = { ...state.hero, buffs: finalBuffs };
        }

        // 다른 영웅들 버프 업데이트
        const updatedOtherHeroes = new Map(state.otherHeroes);
        state.otherHeroes.forEach((otherHero, heroId) => {
          const ownBuffs = processOwnBuffs(otherHero.buffs);
          const finalBuffs = applyAuraBuffs(heroId, otherHero.x, otherHero.y, ownBuffs);
          updatedOtherHeroes.set(heroId, { ...otherHero, buffs: finalBuffs });
        });

        return {
          hero: updatedHero,
          otherHeroes: updatedOtherHeroes,
        };
      });
    },

    // 보류 스킬 관련
    addPendingSkill: (skill: PendingSkill) => {
      set((state) => ({
        pendingSkills: [...state.pendingSkills, skill],
      }));
    },

    removePendingSkill: (index: number) => {
      set((state) => ({
        pendingSkills: state.pendingSkills.filter((_, i) => i !== index),
      }));
    },

    // 시야 관련
    updateVisibility: () => {
      set((state) => {
        if (!state.hero) return state;
        const cellSize = RPG_CONFIG.VISIBILITY.CELL_SIZE;
        const radius = state.visibility.visibleRadius;
        const heroX = state.hero.x;
        const heroY = state.hero.y;

        // 현재 시야 범위 내의 셀들을 탐사 목록에 추가
        const newExplored = new Set(state.visibility.exploredCells);
        const cellRadius = Math.ceil(radius / cellSize);

        for (let dx = -cellRadius; dx <= cellRadius; dx++) {
          for (let dy = -cellRadius; dy <= cellRadius; dy++) {
            const cellX = Math.floor(heroX / cellSize) + dx;
            const cellY = Math.floor(heroY / cellSize) + dy;
            const dist = Math.sqrt(dx * dx + dy * dy) * cellSize;
            if (dist <= radius) {
              newExplored.add(`${cellX},${cellY}`);
            }
          }
        }

        return {
          visibility: {
            ...state.visibility,
            exploredCells: newExplored,
          },
        };
      });
    },

    // ============================================
    // 멀티플레이 액션 구현
    // ============================================

    setMultiplayerState: (newState: Partial<MultiplayerState>) => {
      set((state) => ({
        multiplayer: { ...state.multiplayer, ...newState },
      }));
    },

    resetMultiplayerState: () => {
      set({
        multiplayer: {
          isMultiplayer: false,
          isHost: false,
          roomCode: null,
          roomId: null,
          hostPlayerId: null,
          myPlayerId: null,
          myHeroId: null,
          players: [],
          remoteInputQueue: [],
          connectionState: 'disconnected',
          countdown: null,
        },
        otherHeroes: new Map(),
        otherPlayersGold: new Map(),
        otherPlayersUpgrades: new Map(),
        otherPlayersGoldAccumulator: new Map(),
      });
    },

    initMultiplayerGame: (players: CoopPlayerInfo[], _isHost: boolean, difficulty?: RPGDifficulty) => {
      const state = get();
      // 난이도가 전달되지 않으면 스토어의 선택된 난이도 사용
      const gameDifficulty = difficulty || state.selectedDifficulty;

      // 각 플레이어에 대한 영웅 생성
      const otherHeroes = new Map<string, HeroUnit>();
      const otherPlayersGold = new Map<string, number>();
      const otherPlayersUpgrades = new Map<string, UpgradeLevels>();
      const otherPlayersGoldAccumulator = new Map<string, number>();
      const otherPlayersKills = new Map<string, number>();
      const spawnPositions = getMultiplayerSpawnPositions(players.length);

      players.forEach((player, index) => {
        const heroId = `hero_${player.id}`;

        if (player.id === state.multiplayer.myPlayerId) {
          // 내 영웅은 기존 hero에 설정 (전직 정보 포함)
          const hero = createHeroUnit(
            player.heroClass,
            player.characterLevel || 1,
            player.statUpgrades,
            player.advancedClass,
            player.tier
          );
          hero.x = spawnPositions[index].x;
          hero.y = spawnPositions[index].y;
          hero.id = heroId;

          set({
            hero,
            multiplayer: {
              ...state.multiplayer,
              myHeroId: hero.id,
            },
          });
        } else {
          // 다른 플레이어 영웅 (전직 정보 포함)
          const hero = createHeroUnit(
            player.heroClass,
            player.characterLevel || 1,
            player.statUpgrades,
            player.advancedClass,
            player.tier
          );
          hero.x = spawnPositions[index].x;
          hero.y = spawnPositions[index].y;
          hero.id = heroId;
          otherHeroes.set(hero.id, hero);

          // 각 플레이어별 골드, 업그레이드, 처치 수 초기화
          otherPlayersGold.set(heroId, GOLD_CONFIG.STARTING_GOLD);
          otherPlayersUpgrades.set(heroId, createInitialUpgradeLevels());
          otherPlayersGoldAccumulator.set(heroId, 0);
          otherPlayersKills.set(heroId, 0);
        }
      });

      set({
        otherHeroes,
        otherPlayersGold,
        otherPlayersUpgrades,
        otherPlayersGoldAccumulator,
        otherPlayersKills,
        otherHeroesInterpolation: new Map(),
        personalKills: 0,
        running: true,
        nexus: createInitialNexus(),
        enemyBases: createInitialEnemyBases(players.length, gameDifficulty), // 플레이어 수와 난이도에 따른 기지 생성
        gamePhase: 'playing',
        gold: GOLD_CONFIG.STARTING_GOLD,
        goldAccumulator: 0,
        upgradeLevels: createInitialUpgradeLevels(),
        selectedDifficulty: gameDifficulty,
      });
      // BGM 재생
      soundManager.playBGM('rpg_battle');
    },

    addOtherHero: (hero: HeroUnit) => {
      set((state) => {
        const newOtherHeroes = new Map(state.otherHeroes);
        newOtherHeroes.set(hero.id, hero);
        return { otherHeroes: newOtherHeroes };
      });
    },

    updateOtherHero: (heroId: string, update: Partial<HeroUnit>) => {
      set((state) => {
        const hero = state.otherHeroes.get(heroId);
        if (!hero) return state;
        const newOtherHeroes = new Map(state.otherHeroes);
        newOtherHeroes.set(heroId, { ...hero, ...update });
        return { otherHeroes: newOtherHeroes };
      });
    },

    removeOtherHero: (heroId: string) => {
      set((state) => {
        const newOtherHeroes = new Map(state.otherHeroes);
        newOtherHeroes.delete(heroId);
        return { otherHeroes: newOtherHeroes };
      });
    },

    clearOtherHeroes: () => {
      set({ otherHeroes: new Map() });
    },

    // 다른 플레이어 골드 추가
    addGoldToOtherPlayer: (heroId: string, amount: number) => {
      set((state) => {
        const currentGold = state.otherPlayersGold.get(heroId) || 0;
        const newOtherPlayersGold = new Map(state.otherPlayersGold);
        newOtherPlayersGold.set(heroId, currentGold + amount);
        return { otherPlayersGold: newOtherPlayersGold };
      });
    },

    // 다른 플레이어 골드 조회
    getOtherPlayerGold: (heroId: string) => {
      return get().otherPlayersGold.get(heroId) || 0;
    },

    // 다른 플레이어 업그레이드
    upgradeOtherHeroStat: (heroId: string, stat: UpgradeType) => {
      const state = get();
      const playerGold = state.otherPlayersGold.get(heroId) || 0;
      const playerUpgrades = state.otherPlayersUpgrades.get(heroId) || createInitialUpgradeLevels();
      const currentLevel = playerUpgrades[stat];
      const otherHero = state.otherHeroes.get(heroId);
      const characterLevel = otherHero?.characterLevel || 1;
      const heroClass = otherHero?.heroClass;

      // 업그레이드 가능 여부 확인
      if (!canUpgrade(playerGold, currentLevel, characterLevel, stat, heroClass)) {
        return false;
      }

      const cost = getUpgradeCost(currentLevel);

      // 골드 차감 및 업그레이드 적용
      const newOtherPlayersGold = new Map(state.otherPlayersGold);
      newOtherPlayersGold.set(heroId, playerGold - cost);

      const newUpgrades = { ...playerUpgrades, [stat]: currentLevel + 1 };
      const newOtherPlayersUpgrades = new Map(state.otherPlayersUpgrades);
      newOtherPlayersUpgrades.set(heroId, newUpgrades);

      // 영웅 스탯 업데이트
      if (otherHero) {
        let updatedHero = { ...otherHero };

        // HP 업그레이드 시 최대 HP 증가
        if (stat === 'hp') {
          const hpBonus = UPGRADE_CONFIG.hp.perLevel;
          updatedHero = {
            ...updatedHero,
            maxHp: updatedHero.maxHp + hpBonus,
            hp: Math.min(updatedHero.hp + hpBonus, updatedHero.maxHp + hpBonus),
          };
        }

        // 공격속도 업그레이드 시 공격속도 감소 (더 빠른 공격)
        if (stat === 'attackSpeed') {
          const attackSpeedBonus = UPGRADE_CONFIG.attackSpeed.perLevel;
          const currentAttackSpeed = updatedHero.config.attackSpeed || updatedHero.baseAttackSpeed || 1;
          updatedHero = {
            ...updatedHero,
            config: {
              ...updatedHero.config,
              attackSpeed: Math.max(0.3, currentAttackSpeed - attackSpeedBonus),
            },
          };
        }

        // 사거리 업그레이드 시 사거리 증가 (궁수/마법사만)
        if (stat === 'range' && (heroClass === 'archer' || heroClass === 'mage')) {
          const rangeBonus = UPGRADE_CONFIG.range.perLevel;
          updatedHero = {
            ...updatedHero,
            config: {
              ...updatedHero.config,
              range: (updatedHero.config.range || 0) + rangeBonus,
            },
          };
        }

        const newOtherHeroes = new Map(state.otherHeroes);
        newOtherHeroes.set(heroId, updatedHero);

        set({
          otherPlayersGold: newOtherPlayersGold,
          otherPlayersUpgrades: newOtherPlayersUpgrades,
          otherHeroes: newOtherHeroes,
        });
      } else {
        set({
          otherPlayersGold: newOtherPlayersGold,
          otherPlayersUpgrades: newOtherPlayersUpgrades,
        });
      }

      return true;
    },

    // 다른 플레이어 업그레이드 레벨 조회
    getOtherPlayerUpgrades: (heroId: string) => {
      return get().otherPlayersUpgrades.get(heroId) || createInitialUpgradeLevels();
    },

    addRemoteInput: (input: PlayerInput) => {
      set((state) => ({
        multiplayer: {
          ...state.multiplayer,
          remoteInputQueue: [...state.multiplayer.remoteInputQueue, input],
        },
      }));
    },

    popRemoteInput: () => {
      const state = get();
      if (state.multiplayer.remoteInputQueue.length === 0) return undefined;
      const [input, ...rest] = state.multiplayer.remoteInputQueue;
      set({
        multiplayer: {
          ...state.multiplayer,
          remoteInputQueue: rest,
        },
      });
      return input;
    },

    clearRemoteInputs: () => {
      set((state) => ({
        multiplayer: {
          ...state.multiplayer,
          remoteInputQueue: [],
        },
      }));
    },

    serializeGameState: (): SerializedGameState => {
      const state = get();

      // 모든 영웅 직렬화 (내 영웅 + 다른 영웅들)
      const heroes: SerializedHero[] = [];

      if (state.hero) {
        // 호스트 영웅: 호스트의 골드, 업그레이드, 처치 수 사용
        heroes.push(serializeHeroToNetwork(state.hero, state.gold, state.upgradeLevels, state.personalKills));
      }

      state.otherHeroes.forEach((hero) => {
        // 다른 플레이어: 해당 플레이어의 골드, 업그레이드, 처치 수 사용
        const playerGold = state.otherPlayersGold.get(hero.id) || 0;
        const playerUpgrades = state.otherPlayersUpgrades.get(hero.id) || createInitialUpgradeLevels();
        const playerKills = state.otherPlayersKills.get(hero.id) || 0;
        heroes.push(serializeHeroToNetwork(hero, playerGold, playerUpgrades, playerKills));
      });

      // 적 직렬화
      const enemies: SerializedEnemy[] = state.enemies.map((enemy) => ({
        id: enemy.id,
        type: enemy.type,
        x: enemy.x,
        y: enemy.y,
        hp: enemy.hp,
        maxHp: enemy.maxHp,
        goldReward: enemy.goldReward || 0,
        targetHeroId: enemy.targetHeroId,
        aggroOnHero: enemy.aggroOnHero || false,
        aggroExpireTime: enemy.aggroExpireTime,
        fromBase: enemy.fromBase,
        buffs: enemy.buffs || [],
        isStunned: enemy.isStunned || false,
        stunEndTime: enemy.stunEndTime,
        dashState: enemy.dashState,  // 보스 돌진 상태 동기화
      }));

      // enemyBases 직렬화: Set을 Array로 변환
      const serializedEnemyBases = state.enemyBases.map(base => ({
        ...base,
        attackers: Array.from(base.attackers),
      }));

      return {
        gameTime: state.gameTime,
        gamePhase: state.gamePhase,
        heroes,
        enemies,
        nexus: state.nexus || createInitialNexus(),
        enemyBases: serializedEnemyBases as unknown as EnemyBase[],
        gold: state.gold,
        upgradeLevels: state.upgradeLevels,
        activeSkillEffects: state.activeSkillEffects,
        basicAttackEffects: state.basicAttackEffects,
        nexusLaserEffects: state.nexusLaserEffects,
        pendingSkills: state.pendingSkills,
        bossSkillWarnings: state.bossSkillWarnings,
        damageNumbers: state.damageNumbers,
        running: state.running,
        paused: state.paused,
        gameOver: state.gameOver,
        victory: state.victory,
        lastSpawnTime: state.lastSpawnTime,
        stats: state.stats,
      };
    },

    applySerializedState: (serializedState: SerializedGameState, myHeroId: string | null) => {
      const currentState = get();
      const newOtherHeroes = new Map<string, HeroUnit>();
      const newOtherPlayersGold = new Map<string, number>();
      const newOtherPlayersUpgrades = new Map<string, UpgradeLevels>();
      const newOtherPlayersKills = new Map<string, number>();
      const newOtherHeroesInterpolation = new Map<string, HeroInterpolation>();
      let myHero: HeroUnit | null = null;
      let myGold = 0;
      let myUpgrades = createInitialUpgradeLevels();
      let myKills = 0;
      let newLastDamageTime = currentState.lastDamageTime;  // 클라이언트 피격 시간 업데이트용
      let newCamera = currentState.camera;  // 클라이언트 부활 시 카메라 위치 업데이트용
      const now = performance.now();

      // 영웅 상태 적용
      serializedState.heroes.forEach((serializedHero) => {
        const hero = deserializeHeroFromNetwork(serializedHero);
        if (serializedHero.id === myHeroId) {
          // 내 영웅: 로컬 상태 우선 유지, HP/스킬 쿨다운만 서버에서 동기화
          if (currentState.hero) {
            const localHero = currentState.hero;

            // 위치 오차 계산 및 보정
            const posErrorX = Math.abs(hero.x - localHero.x);
            const posErrorY = Math.abs(hero.y - localHero.y);
            const maxPosError = 50;
            const criticalPosError = 150;  // 큰 오차는 즉시 보정

            let syncX = localHero.x;
            let syncY = localHero.y;

            // 이동 중인지 확인 (이동 중이면 로컬 위치 우선)
            const isMoving = localHero.moveDirection !== undefined &&
              (localHero.moveDirection.x !== 0 || localHero.moveDirection.y !== 0);

            if (posErrorX > criticalPosError || posErrorY > criticalPosError) {
              // 큰 오차 (150px 이상): 즉시 서버 위치로 동기화
              syncX = hero.x;
              syncY = hero.y;
            } else if (!isMoving && (posErrorX > maxPosError || posErrorY > maxPosError)) {
              // 중간 오차 (50-150px) + 이동 중 아님: 빠른 lerp 보정
              syncX = localHero.x * 0.7 + hero.x * 0.3;
              syncY = localHero.y * 0.7 + hero.y * 0.3;
            }
            // 이동 중이고 오차가 50px 미만이면 로컬 위치 유지 (부드러운 움직임)

            // 돌진 중일 때는 서버 위치/상태를 우선 적용 (돌진은 호스트에서 처리)
            const isDashing = hero.dashState !== undefined;
            const dashSyncX = isDashing ? hero.x : syncX;
            const dashSyncY = isDashing ? hero.y : syncY;

            // 클라이언트 피격 감지: HP가 감소했을 때 lastDamageTime 업데이트 (피격 화면 효과용)
            if (hero.hp < localHero.hp) {
              newLastDamageTime = serializedState.gameTime;
            }

            // 클라이언트 부활 감지: HP가 0 이하에서 양수가 되면 카메라를 영웅 위치로 이동
            const wasDeadBeforeSync = localHero.hp <= 0;
            const isAliveAfterSync = hero.hp > 0;
            if (wasDeadBeforeSync && isAliveAfterSync) {
              // 부활했으므로 카메라를 영웅 위치로 이동
              newCamera = { ...currentState.camera, x: hero.x, y: hero.y };
            }

            myHero = {
              ...localHero,
              // 서버에서만 동기화해야 하는 상태 (데미지, 힐, 스킬 쿨다운, 사망 시간, 업그레이드된 스탯)
              hp: hero.hp,
              maxHp: hero.maxHp,
              skills: hero.skills,
              buffs: hero.buffs,
              deathTime: hero.deathTime,  // 사망 시간 동기화 (부활 타이머용)
              dashState: hero.dashState,  // 돌진 상태 동기화 (스킬 이동용)
              // 전직 정보 동기화 (부활 시 전직 상태 유지)
              advancedClass: hero.advancedClass,
              tier: hero.tier,
              // 업그레이드로 변경될 수 있는 config 스탯 동기화 (공격속도, 사거리)
              config: {
                ...localHero.config,
                name: hero.config.name,  // 전직 후 이름 동기화
                hp: hero.maxHp,
                attack: hero.config.attack,
                attackSpeed: hero.config.attackSpeed,
                range: hero.config.range,
                speed: hero.config.speed,
              },
              baseAttack: hero.baseAttack,
              baseSpeed: hero.baseSpeed,
              baseAttackSpeed: hero.baseAttackSpeed,
              // 위치 보정 적용 (돌진 중이면 서버 위치 우선)
              x: dashSyncX,
              y: dashSyncY,
              // 돌진 중이면 상태도 동기화
              state: isDashing ? hero.state : localHero.state,
              // 나머지는 모두 로컬 유지 (이동, 상태 등)
            };
          } else {
            // 첫 생성 시에만 서버 위치 사용
            myHero = hero;
          }
          // 내 골드, 업그레이드, 처치 수 추출
          myGold = serializedHero.gold;
          myUpgrades = serializedHero.upgradeLevels;
          myKills = serializedHero.kills || 0;
        } else {
          // 다른 플레이어 영웅: 보간 처리
          const existingInterpolation = currentState.otherHeroesInterpolation.get(hero.id);
          const existingHero = currentState.otherHeroes.get(hero.id);

          // 이동 방향 및 속도 추출
          const moveDir = hero.moveDirection || { x: 0, y: 0 };
          const heroMoveSpeed = hero.config?.speed || 200;

          // 보간 데이터 업데이트
          if (existingHero && existingInterpolation) {
            // 기존 보간 데이터가 있으면, 현재 보간된 위치를 prevX/Y로 설정
            const timeSinceUpdate = now - existingInterpolation.lastUpdateTime;
            const interpolationDuration = 80; // 80ms (네트워크 지터 흡수)
            const t = Math.min(1, timeSinceUpdate / interpolationDuration);

            // ease-out cubic 적용
            const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
            const easedT = easeOutCubic(t);

            // 현재 보간 위치 계산 (이징 적용)
            const currentX = existingInterpolation.prevX + (existingInterpolation.targetX - existingInterpolation.prevX) * easedT;
            const currentY = existingInterpolation.prevY + (existingInterpolation.targetY - existingInterpolation.prevY) * easedT;

            // 속도 계산 (위치 변화 기반)
            const deltaTime = timeSinceUpdate / 1000;
            const velocityX = deltaTime > 0 ? (hero.x - existingInterpolation.targetX) / (50 / 1000) : 0;
            const velocityY = deltaTime > 0 ? (hero.y - existingInterpolation.targetY) / (50 / 1000) : 0;

            newOtherHeroesInterpolation.set(hero.id, {
              prevX: currentX,
              prevY: currentY,
              targetX: hero.x,
              targetY: hero.y,
              velocityX,
              velocityY,
              moveDirectionX: moveDir.x,
              moveDirectionY: moveDir.y,
              moveSpeed: heroMoveSpeed,
              lastUpdateTime: now,
            });

            // 보간된 위치로 영웅 업데이트 (현재 위치 사용)
            newOtherHeroes.set(hero.id, {
              ...hero,
              x: currentX,
              y: currentY,
            });
          } else {
            // 첫 수신 시 즉시 위치 설정
            newOtherHeroesInterpolation.set(hero.id, {
              prevX: hero.x,
              prevY: hero.y,
              targetX: hero.x,
              targetY: hero.y,
              velocityX: 0,
              velocityY: 0,
              moveDirectionX: moveDir.x,
              moveDirectionY: moveDir.y,
              moveSpeed: heroMoveSpeed,
              lastUpdateTime: now,
            });
            newOtherHeroes.set(hero.id, hero);
          }

          // 다른 플레이어의 골드, 업그레이드, 처치 수 저장
          newOtherPlayersGold.set(hero.id, serializedHero.gold);
          newOtherPlayersUpgrades.set(hero.id, serializedHero.upgradeLevels);
          newOtherPlayersKills.set(hero.id, serializedHero.kills || 0);
        }
      });

      // 적 상태 적용
      const enemies: RPGEnemy[] = serializedState.enemies.map((se) => {
        const aiConfig = ENEMY_AI_CONFIGS[se.type] || ENEMY_AI_CONFIGS.melee;
        return {
          id: se.id,
          type: se.type,
          x: se.x,
          y: se.y,
          hp: se.hp,
          maxHp: se.maxHp,
          goldReward: se.goldReward,
          targetHeroId: se.targetHeroId,
          aggroOnHero: se.aggroOnHero,
          aggroExpireTime: se.aggroExpireTime,
          fromBase: se.fromBase,
          buffs: se.buffs,
          isStunned: se.isStunned,
          stunEndTime: se.stunEndTime,
          dashState: se.dashState,  // 보스 돌진 상태 동기화
          team: 'enemy' as const,
          // RPGEnemy 필수 속성 추가
          targetHero: se.aggroOnHero,
          aiConfig,
          config: {
            name: se.type,
            cost: {},
            hp: se.maxHp,
            attack: aiConfig.attackDamage,
            attackSpeed: aiConfig.attackSpeed,
            speed: aiConfig.moveSpeed,
            range: aiConfig.attackRange,
            type: 'combat' as const,
          },
          state: 'idle' as const,
          attackCooldown: 0,
        };
      });

      // myHero가 null이면 (서버에서 내 영웅을 보내지 않은 경우) 기존 로컬 영웅 유지
      const heroToSet = myHero !== null ? myHero : currentState.hero;

      set({
        gameTime: serializedState.gameTime,
        gamePhase: serializedState.gamePhase,
        hero: heroToSet,
        otherHeroes: newOtherHeroes,
        otherPlayersGold: newOtherPlayersGold,
        otherPlayersUpgrades: newOtherPlayersUpgrades,
        otherPlayersKills: newOtherPlayersKills,
        otherHeroesInterpolation: newOtherHeroesInterpolation,
        personalKills: myKills,
        enemies,
        nexus: serializedState.nexus,
        // enemyBases 역직렬화: Array를 Set으로 변환
        enemyBases: serializedState.enemyBases.map(base => ({
          ...base,
          attackers: new Set(Array.isArray((base as unknown as { attackers: string[] }).attackers) ? (base as unknown as { attackers: string[] }).attackers : []),
        })),
        gold: myGold,  // 내 골드 적용
        upgradeLevels: myUpgrades,  // 내 업그레이드 적용
        activeSkillEffects: serializedState.activeSkillEffects,
        basicAttackEffects: serializedState.basicAttackEffects || [],
        nexusLaserEffects: serializedState.nexusLaserEffects || [],
        pendingSkills: serializedState.pendingSkills,
        bossSkillWarnings: serializedState.bossSkillWarnings || [],
        damageNumbers: serializedState.damageNumbers || [],
        lastDamageTime: newLastDamageTime,  // 클라이언트 피격 화면 효과용
        camera: newCamera,  // 클라이언트 부활 시 카메라 자동 고정
        running: serializedState.running,
        paused: serializedState.paused,
        gameOver: serializedState.gameOver,
        victory: serializedState.victory,
        lastSpawnTime: serializedState.lastSpawnTime,
        stats: serializedState.stats,
      });
    },

    updateOtherHeroesInterpolation: () => {
      const state = get();
      if (state.otherHeroesInterpolation.size === 0 || state.otherHeroes.size === 0) return;

      const now = performance.now();
      const updatedHeroes = new Map<string, HeroUnit>();
      const updatedInterpolation = new Map<string, HeroInterpolation>();
      const interpolationDuration = 80; // 80ms (네트워크 지터 흡수)

      // ease-out cubic 함수
      const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);

      state.otherHeroes.forEach((hero, heroId) => {
        const interp = state.otherHeroesInterpolation.get(heroId);
        if (interp) {
          const timeSinceUpdate = now - interp.lastUpdateTime;
          const t = Math.min(1, timeSinceUpdate / interpolationDuration);
          const easedT = easeOutCubic(t);

          let x: number;
          let y: number;

          // 클라이언트 측 이동 시뮬레이션
          const isMoving = interp.moveDirectionX !== 0 || interp.moveDirectionY !== 0;

          if (t >= 1 && isMoving) {
            // 보간 완료 후 이동 중이면 예측 이동
            const extraTime = (timeSinceUpdate - interpolationDuration) / 1000;
            const predictedMoveX = interp.moveDirectionX * interp.moveSpeed * extraTime;
            const predictedMoveY = interp.moveDirectionY * interp.moveSpeed * extraTime;

            x = interp.targetX + predictedMoveX;
            y = interp.targetY + predictedMoveY;

            // 맵 경계 제한
            x = Math.max(0, Math.min(RPG_CONFIG.MAP_WIDTH, x));
            y = Math.max(0, Math.min(RPG_CONFIG.MAP_HEIGHT, y));
          } else {
            // 보간 중: 이징 함수 적용
            x = interp.prevX + (interp.targetX - interp.prevX) * easedT;
            y = interp.prevY + (interp.targetY - interp.prevY) * easedT;
          }

          updatedHeroes.set(heroId, {
            ...hero,
            x,
            y,
          });

          // 보간 데이터 유지 (서버 업데이트 시까지)
          updatedInterpolation.set(heroId, interp);
        } else {
          updatedHeroes.set(heroId, hero);
        }
      });

      set({ otherHeroes: updatedHeroes });
    },
  }))
);

// 멀티플레이어 스폰 위치 계산
function getMultiplayerSpawnPositions(count: number): { x: number; y: number }[] {
  const centerX = NEXUS_CONFIG.position.x;
  const centerY = NEXUS_CONFIG.position.y + 100;
  const offset = 80;

  switch (count) {
    case 1:
      return [{ x: centerX, y: centerY }];
    case 2:
      return [
        { x: centerX - offset, y: centerY },
        { x: centerX + offset, y: centerY },
      ];
    case 3:
      return [
        { x: centerX, y: centerY - offset },
        { x: centerX - offset, y: centerY + offset * 0.5 },
        { x: centerX + offset, y: centerY + offset * 0.5 },
      ];
    case 4:
      return [
        { x: centerX - offset, y: centerY - offset },
        { x: centerX + offset, y: centerY - offset },
        { x: centerX - offset, y: centerY + offset },
        { x: centerX + offset, y: centerY + offset },
      ];
    default:
      return [{ x: centerX, y: centerY }];
  }
}

// 영웅 직렬화 헬퍼
function serializeHeroToNetwork(hero: HeroUnit, gold: number, upgradeLevels: UpgradeLevels, kills: number): SerializedHero {
  return {
    id: hero.id,
    playerId: (hero as any).playerId || hero.id,
    heroClass: hero.heroClass,
    x: hero.x,
    y: hero.y,
    hp: hero.hp,
    maxHp: hero.maxHp,
    attack: hero.config.attack || 0,
    attackSpeed: hero.config.attackSpeed || 1,
    speed: hero.config.speed,
    range: hero.config.range || 0,
    gold,
    upgradeLevels,
    isDead: hero.hp <= 0,
    reviveTimer: (hero as any).reviveTimer || 0,
    deathTime: hero.deathTime,  // 사망 시간 동기화
    facingRight: hero.facingRight,
    facingAngle: hero.facingAngle,
    buffs: hero.buffs,
    passiveGrowth: hero.passiveGrowth,
    skillCooldowns: {
      Q: hero.skills[0]?.currentCooldown || 0,
      W: hero.skills[1]?.currentCooldown || 0,
      E: hero.skills[2]?.currentCooldown || 0,
    },
    moveDirection: hero.moveDirection || null,
    characterLevel: hero.characterLevel,
    dashState: hero.dashState,
    statUpgrades: hero.statUpgrades,
    kills,
    advancedClass: hero.advancedClass,
    tier: hero.tier,
    castingUntil: hero.castingUntil,
  };
}

// 영웅 역직렬화 헬퍼
function deserializeHeroFromNetwork(serialized: SerializedHero): HeroUnit {
  const classConfig = CLASS_CONFIGS[serialized.heroClass];
  const classSkills = CLASS_SKILLS[serialized.heroClass];

  // 전직한 경우 전직 스킬 사용, 아니면 기본 스킬 사용
  const advancedClass = serialized.advancedClass as AdvancedHeroClass | undefined;
  let skills: Skill[];

  if (advancedClass) {
    // 전직 스킬 생성 후 쿨다운 적용
    const advancedSkills = createAdvancedClassSkills(serialized.heroClass, advancedClass);
    skills = advancedSkills.map((skill, index) => ({
      ...skill,
      currentCooldown: index === 0 ? serialized.skillCooldowns.Q :
                       index === 1 ? serialized.skillCooldowns.W :
                       serialized.skillCooldowns.E,
    }));
  } else {
    skills = [
      { ...classSkills.q, currentCooldown: serialized.skillCooldowns.Q, level: 1 },
      { ...classSkills.w, currentCooldown: serialized.skillCooldowns.W, level: 1 },
      { ...classSkills.e, currentCooldown: serialized.skillCooldowns.E, level: 1 },
    ];
  }

  // 전직한 경우 전직 config 이름 사용
  const configName = advancedClass && ADVANCED_CLASS_CONFIGS[advancedClass]
    ? ADVANCED_CLASS_CONFIGS[advancedClass].name
    : classConfig.name;

  return {
    id: serialized.id,
    type: 'hero',
    heroClass: serialized.heroClass,
    characterLevel: serialized.characterLevel,
    advancedClass,
    tier: serialized.tier,
    config: {
      name: configName,
      cost: {},
      hp: serialized.maxHp,
      attack: serialized.attack,
      attackSpeed: serialized.attackSpeed,
      speed: serialized.speed,
      range: serialized.range,
      type: 'combat',
    },
    x: serialized.x,
    y: serialized.y,
    hp: serialized.hp,
    maxHp: serialized.maxHp,
    state: serialized.moveDirection ? 'moving' : 'idle',
    attackCooldown: 0,
    team: 'player',
    skills,
    baseAttack: serialized.attack,
    baseSpeed: serialized.speed,
    baseAttackSpeed: serialized.attackSpeed,
    buffs: serialized.buffs,
    facingRight: serialized.facingRight,
    facingAngle: serialized.facingAngle,
    passiveGrowth: serialized.passiveGrowth,
    moveDirection: serialized.moveDirection || undefined,
    dashState: serialized.dashState,
    statUpgrades: serialized.statUpgrades,
    deathTime: serialized.deathTime,  // 사망 시간 동기화
    castingUntil: serialized.castingUntil,  // 시전 상태 동기화
  };
}

// 선택자 훅
export const useHero = () => useRPGStore((state) => state.hero);
export const useRPGCamera = () => useRPGStore((state) => state.camera);
export const useRPGEnemies = () => useRPGStore((state) => state.enemies);
export const useRPGGameOver = () => useRPGStore((state) => state.gameOver);
export const useRPGResult = () => useRPGStore((state) => state.result);
export const useRPGStats = () => useRPGStore((state) => state.stats);
export const useActiveSkillEffects = () => useRPGStore((state) => state.activeSkillEffects);
export const useSelectedClass = () => useRPGStore((state) => state.selectedClass);
export const useSelectedDifficulty = () => useRPGStore((state) => state.selectedDifficulty);
export const useVisibility = () => useRPGStore((state) => state.visibility);
export const usePendingSkills = () => useRPGStore((state) => state.pendingSkills);
export const useShowAttackRange = () => useRPGStore((state) => state.showAttackRange);
export const useHoveredSkillRange = () => useRPGStore((state) => state.hoveredSkillRange);
export const useDamageNumbers = () => useRPGStore((state) => state.damageNumbers);

// 넥서스 디펜스 훅
export const useGold = () => useRPGStore((state) => state.gold);
export const useUpgradeLevels = () => useRPGStore((state) => state.upgradeLevels);
export const useNexus = () => useRPGStore((state) => state.nexus);
export const useEnemyBases = () => useRPGStore((state) => state.enemyBases);
export const useRPGGamePhase = () => useRPGStore((state) => state.gamePhase);
export const useGameTime = () => useRPGStore((state) => state.gameTime);
export const useFiveMinuteRewardClaimed = () => useRPGStore((state) => state.fiveMinuteRewardClaimed);
export const useLastDamageTime = () => useRPGStore((state) => state.lastDamageTime);

// 멀티플레이 훅
export const useMultiplayer = () => useRPGStore((state) => state.multiplayer);
export const useIsMultiplayer = () => useRPGStore((state) => state.multiplayer.isMultiplayer);
export const useIsHost = () => useRPGStore((state) => state.multiplayer.isHost);
export const useOtherHeroes = () => useRPGStore((state) => state.otherHeroes);
export const usePersonalKills = () => useRPGStore((state) => state.personalKills);
export const useOtherPlayersKills = () => useRPGStore((state) => state.otherPlayersKills);
export const useAllHeroes = () => useRPGStore((state) => {
  const heroes: HeroUnit[] = [];
  if (state.hero) heroes.push(state.hero);
  state.otherHeroes.forEach((hero) => heroes.push(hero));
  return heroes;
});
