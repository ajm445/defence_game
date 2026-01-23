import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { RPGGameState, HeroUnit, RPGEnemy, Skill, SkillEffect, RPGGameResult, HeroClass, PendingSkill, Buff, VisibilityState, Nexus, EnemyBase, UpgradeLevels, RPGGamePhase } from '../types/rpg';
import { UnitType } from '../types/unit';
import { RPG_CONFIG, CLASS_CONFIGS, CLASS_SKILLS, NEXUS_CONFIG, ENEMY_BASE_CONFIG, GOLD_CONFIG, UPGRADE_CONFIG } from '../constants/rpgConfig';
import { createInitialPassiveState, getPassiveFromCharacterLevel } from '../game/rpg/passiveSystem';
import { createInitialUpgradeLevels, getUpgradeCost, canUpgrade, getGoldReward, calculateAllUpgradeBonuses, UpgradeType } from '../game/rpg/goldSystem';
import { CharacterStatUpgrades, createDefaultStatUpgrades, getStatBonus } from '../types/auth';

interface RPGState extends RPGGameState {
  // 활성 스킬 효과
  activeSkillEffects: SkillEffect[];

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
}

interface RPGActions {
  // 게임 초기화
  initGame: (characterLevel?: number, statUpgrades?: CharacterStatUpgrades) => void;
  resetGame: () => void;

  // 직업 선택
  selectClass: (heroClass: HeroClass) => void;

  // 영웅 관련
  createHero: (heroClass: HeroClass, characterLevel?: number, statUpgrades?: CharacterStatUpgrades) => void;
  moveHero: (x: number, y: number) => void;
  setMoveDirection: (direction: { x: number; y: number } | undefined) => void;
  setAttackTarget: (targetId: string | undefined) => void;
  damageHero: (amount: number) => void;
  healHero: (amount: number) => void;
  updateHeroPosition: (x: number, y: number) => void;
  updateHeroState: (heroUpdate: Partial<HeroUnit>) => void;

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

  // 적 관리
  addEnemy: (enemy: RPGEnemy) => void;
  removeEnemy: (enemyId: string) => void;
  damageEnemy: (enemyId: string, amount: number) => boolean; // returns true if killed
  updateEnemies: (enemies: RPGEnemy[]) => void;

  // 넥서스/기지
  damageNexus: (amount: number) => void;
  damageBase: (baseId: 'left' | 'right', amount: number) => boolean; // returns true if destroyed
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
  addGoldEarned: (amount: number) => void;
  incrementBasesDestroyed: () => void;
  incrementBossesKilled: () => void;

  // 공격 사거리 표시
  setShowAttackRange: (show: boolean) => void;

  // 호버된 스킬 사거리 설정
  setHoveredSkillRange: (range: RPGState['hoveredSkillRange']) => void;
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
});

// 적 기지 초기 상태 생성
const createInitialEnemyBases = (): EnemyBase[] => [
  {
    id: 'left',
    x: ENEMY_BASE_CONFIG.left.x,
    y: ENEMY_BASE_CONFIG.left.y,
    hp: ENEMY_BASE_CONFIG.left.hp,
    maxHp: ENEMY_BASE_CONFIG.left.hp,
    destroyed: false,
  },
  {
    id: 'right',
    x: ENEMY_BASE_CONFIG.right.x,
    y: ENEMY_BASE_CONFIG.right.y,
    hp: ENEMY_BASE_CONFIG.right.hp,
    maxHp: ENEMY_BASE_CONFIG.right.hp,
    destroyed: false,
  },
];

const initialState: RPGState = {
  running: false,
  paused: false,
  gameOver: false,
  victory: false,

  hero: null,
  selectedClass: null,

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
  pendingSkills: [],
  result: null,
  mousePosition: { x: NEXUS_CONFIG.position.x, y: NEXUS_CONFIG.position.y },
  showAttackRange: false,
  hoveredSkillRange: null,
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

// 영웅 생성 (직업별)
function createHeroUnit(
  heroClass: HeroClass,
  characterLevel: number = 1,
  statUpgrades?: CharacterStatUpgrades
): HeroUnit {
  const classConfig = CLASS_CONFIGS[heroClass];

  // 캐릭터 레벨이 5 이상이면 패시브 활성화
  const passiveState = getPassiveFromCharacterLevel(heroClass, characterLevel) || createInitialPassiveState();

  // SP 스탯 업그레이드 적용
  const upgrades = statUpgrades || createDefaultStatUpgrades();
  const attackBonus = getStatBonus('attack', upgrades.attack);
  const speedBonus = getStatBonus('speed', upgrades.speed);
  const hpBonus = getStatBonus('hp', upgrades.hp);
  const rangeBonus = getStatBonus('range', upgrades.range);
  // hpRegen은 게임 루프에서 적용됨

  // 최종 스탯 계산
  const finalHp = classConfig.hp + hpBonus;
  const finalAttack = classConfig.attack + attackBonus;
  const finalSpeed = classConfig.speed + speedBonus;
  const finalRange = classConfig.range + rangeBonus;

  return {
    id: 'hero',
    type: 'hero',
    heroClass,
    characterLevel,
    config: {
      name: classConfig.name,
      cost: {},
      hp: finalHp,
      attack: finalAttack,
      attackSpeed: classConfig.attackSpeed,
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

    skills: createClassSkills(heroClass),
    baseAttack: finalAttack,
    baseSpeed: finalSpeed,
    baseAttackSpeed: classConfig.attackSpeed,
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

    initGame: (characterLevel: number = 1, statUpgrades?: CharacterStatUpgrades) => {
      const state = get();
      // 선택된 직업이 없으면 기본값 warrior 사용
      const heroClass = state.selectedClass || 'warrior';
      const hero = createHeroUnit(heroClass, characterLevel, statUpgrades);
      set({
        ...initialState,
        running: true,
        selectedClass: heroClass,
        hero,
        // 넥서스 디펜스 초기화
        nexus: createInitialNexus(),
        enemyBases: createInitialEnemyBases(),
        gamePhase: 'playing',
        gold: GOLD_CONFIG.STARTING_GOLD,
        upgradeLevels: createInitialUpgradeLevels(),
        fiveMinuteRewardClaimed: false,
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
    },

    resetGame: () => set((state) => ({
      ...initialState,
      // 선택된 직업은 유지 (다시 시작할 때 사용)
      selectedClass: state.selectedClass,
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
    })),

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

        return {
          hero: { ...state.hero, hp: newHp },
          gameOver: isDead,
          victory: false,
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
      set((state) => {
        // 추가 골드 = 레벨 * perLevel (레벨당 +2)
        const bonusGold = calculateAllUpgradeBonuses(state.upgradeLevels).goldRateBonus;
        const actualAmount = amount + bonusGold;
        return {
          gold: state.gold + actualAmount,
          stats: {
            ...state.stats,
            totalGoldEarned: state.stats.totalGoldEarned + actualAmount,
          },
        };
      });
    },

    // 영웅 스탯 업그레이드
    upgradeHeroStat: (stat: UpgradeType) => {
      const state = get();
      const currentLevel = state.upgradeLevels[stat];
      const characterLevel = state.hero?.characterLevel || 1;

      // 업그레이드 가능 여부 확인
      if (!canUpgrade(state.gold, currentLevel, characterLevel)) {
        return false;
      }

      const cost = getUpgradeCost(currentLevel);

      set((prevState) => {
        const newUpgradeLevels = {
          ...prevState.upgradeLevels,
          [stat]: prevState.upgradeLevels[stat] + 1,
        };

        // HP 업그레이드 시 영웅 최대 HP도 증가
        let heroUpdate = {};
        if (stat === 'hp' && prevState.hero) {
          const hpBonus = UPGRADE_CONFIG.hp.perLevel;
          heroUpdate = {
            hero: {
              ...prevState.hero,
              maxHp: prevState.hero.maxHp + hpBonus,
              hp: Math.min(prevState.hero.hp + hpBonus, prevState.hero.maxHp + hpBonus),
            },
          };
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
        const updatedSkills = state.hero.skills.map((skill) => ({
          ...skill,
          currentCooldown: Math.max(0, skill.currentCooldown - deltaTime),
        }));
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

    damageEnemy: (enemyId, amount) => {
      let killed = false;
      let goldReward = 0;
      let isBoss = false;
      const gameTime = get().gameTime;
      const AGGRO_DURATION = 5; // 어그로 지속 시간 (초)

      set((state) => {
        const enemies = state.enemies.map((enemy) => {
          if (enemy.id === enemyId) {
            const newHp = enemy.hp - amount;
            if (newHp <= 0) {
              killed = true;
              goldReward = enemy.goldReward || 0;
              isBoss = enemy.type === 'boss';
              return { ...enemy, hp: 0 };
            }
            // 피해를 입으면 어그로 설정
            return {
              ...enemy,
              hp: newHp,
              aggroOnHero: true,
              aggroExpireTime: gameTime + AGGRO_DURATION,
            };
          }
          return enemy;
        });
        return { enemies };
      });

      // 처치 시 골드 획득 및 통계 업데이트
      if (killed && goldReward > 0) {
        get().addGold(goldReward);
        get().incrementKills();
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
    damageBase: (baseId: 'left' | 'right', amount: number) => {
      let destroyed = false;

      set((state) => {
        const updatedBases = state.enemyBases.map((base) => {
          if (base.id === baseId && !base.destroyed) {
            const newHp = Math.max(0, base.hp - amount);
            if (newHp <= 0) {
              destroyed = true;
              return { ...base, hp: 0, destroyed: true };
            }
            return { ...base, hp: newHp };
          }
          return base;
        });

        // 기지 파괴 시 통계 업데이트
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

      return destroyed;
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
      const state = get();
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
      set((state) => ({
        gameTime: state.gameTime + deltaTime,
        stats: {
          ...state.stats,
          timePlayed: state.stats.timePlayed + deltaTime,
        },
      }));
    },

    incrementKills: () => {
      set((state) => ({
        stats: { ...state.stats, totalKills: state.stats.totalKills + 1 },
      }));
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
        // 기존 같은 타입의 버프 제거 후 추가
        const filteredBuffs = state.hero.buffs.filter(b => b.type !== buff.type);
        return {
          hero: {
            ...state.hero,
            buffs: [...filteredBuffs, buff],
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
        if (!state.hero) return state;
        const updatedBuffs = state.hero.buffs
          .map(buff => ({
            ...buff,
            duration: buff.duration - deltaTime,
          }))
          .filter(buff => buff.duration > 0);
        return {
          hero: {
            ...state.hero,
            buffs: updatedBuffs,
          },
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
  }))
);

// 선택자 훅
export const useHero = () => useRPGStore((state) => state.hero);
export const useRPGCamera = () => useRPGStore((state) => state.camera);
export const useRPGEnemies = () => useRPGStore((state) => state.enemies);
export const useRPGGameOver = () => useRPGStore((state) => state.gameOver);
export const useRPGResult = () => useRPGStore((state) => state.result);
export const useRPGStats = () => useRPGStore((state) => state.stats);
export const useActiveSkillEffects = () => useRPGStore((state) => state.activeSkillEffects);
export const useSelectedClass = () => useRPGStore((state) => state.selectedClass);
export const useVisibility = () => useRPGStore((state) => state.visibility);
export const usePendingSkills = () => useRPGStore((state) => state.pendingSkills);
export const useShowAttackRange = () => useRPGStore((state) => state.showAttackRange);
export const useHoveredSkillRange = () => useRPGStore((state) => state.hoveredSkillRange);

// 넥서스 디펜스 훅
export const useGold = () => useRPGStore((state) => state.gold);
export const useUpgradeLevels = () => useRPGStore((state) => state.upgradeLevels);
export const useNexus = () => useRPGStore((state) => state.nexus);
export const useEnemyBases = () => useRPGStore((state) => state.enemyBases);
export const useRPGGamePhase = () => useRPGStore((state) => state.gamePhase);
export const useGameTime = () => useRPGStore((state) => state.gameTime);
export const useFiveMinuteRewardClaimed = () => useRPGStore((state) => state.fiveMinuteRewardClaimed);
