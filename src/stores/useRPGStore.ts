import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { RPGGameState, HeroUnit, RPGEnemy, Skill, SkillEffect, RPGGameResult, HeroClass, PendingSkill, Buff, VisibilityState } from '../types/rpg';
import { UnitType } from '../types/unit';
import { RPG_CONFIG, calculateExpToNextLevel, CLASS_CONFIGS, CLASS_SKILLS } from '../constants/rpgConfig';

interface RPGState extends RPGGameState {
  // 활성 스킬 효과
  activeSkillEffects: SkillEffect[];

  // 결과
  result: RPGGameResult | null;

  // 마우스 위치 (월드 좌표, 스킬 타겟용)
  mousePosition: { x: number; y: number };

  // 공격 사거리 표시 여부
  showAttackRange: boolean;
}

interface RPGActions {
  // 게임 초기화
  initGame: () => void;
  resetGame: () => void;

  // 직업 선택
  selectClass: (heroClass: HeroClass) => void;

  // 영웅 관련
  createHero: (heroClass: HeroClass) => void;
  moveHero: (x: number, y: number) => void;
  setAttackTarget: (targetId: string | undefined) => void;
  damageHero: (amount: number) => void;
  healHero: (amount: number) => void;
  updateHeroPosition: (x: number, y: number) => void;

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

  // 경험치/레벨
  addExp: (amount: number) => void;
  levelUp: () => void;

  // 스킬
  useSkill: (skillType: string) => boolean;
  updateSkillCooldowns: (deltaTime: number) => void;
  addSkillEffect: (effect: SkillEffect) => void;
  removeSkillEffect: (index: number) => void;
  upgradeSkill: (skillType: string) => void;

  // 웨이브
  startWave: (waveNumber: number) => void;
  endWave: () => void;
  addEnemy: (enemy: RPGEnemy) => void;
  removeEnemy: (enemyId: string) => void;
  damageEnemy: (enemyId: string, amount: number) => boolean; // returns true if killed
  updateEnemies: (enemies: RPGEnemy[]) => void;

  // 스폰
  addToSpawnQueue: (type: UnitType, delay: number) => void;
  clearSpawnQueue: () => void;
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

  // 통계
  incrementKills: () => void;
  addExpGained: (amount: number) => void;

  // 공격 사거리 표시
  setShowAttackRange: (show: boolean) => void;
}

interface RPGStore extends RPGState, RPGActions {}

const initialVisibility: VisibilityState = {
  exploredCells: new Set<string>(),
  visibleRadius: RPG_CONFIG.VISIBILITY.RADIUS,
};

const initialState: RPGState = {
  running: false,
  paused: false,
  gameOver: false,
  victory: false,

  hero: null,
  selectedClass: null,

  currentWave: 0,
  waveInProgress: false,
  enemiesRemaining: 0,
  enemies: [],

  spawnQueue: [],
  lastSpawnTime: 0,

  gameTime: 0,
  waveStartTime: 0,

  camera: {
    x: RPG_CONFIG.MAP_CENTER_X,
    y: RPG_CONFIG.MAP_CENTER_Y,
    zoom: RPG_CONFIG.CAMERA.DEFAULT_ZOOM,
    followHero: true,
  },

  visibility: initialVisibility,

  stats: {
    totalKills: 0,
    totalExpGained: 0,
    highestWave: 0,
    timePlayed: 0,
  },

  activeSkillEffects: [],
  pendingSkills: [],
  result: null,
  mousePosition: { x: RPG_CONFIG.MAP_CENTER_X, y: RPG_CONFIG.MAP_CENTER_Y },
  showAttackRange: false,
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
      unlocked: true,  // Q는 항상 해금
      unlockedAtLevel: 1,
    },
    {
      type: classSkills.w.type,
      name: classSkills.w.name,
      key: classSkills.w.key,
      cooldown: classSkills.w.cooldown,
      currentCooldown: 0,
      level: 1,
      unlocked: true,  // W도 시작시 해금
      unlockedAtLevel: 1,
    },
    {
      type: classSkills.e.type,
      name: classSkills.e.name,
      key: classSkills.e.key,
      cooldown: classSkills.e.cooldown,
      currentCooldown: 0,
      level: 1,
      unlocked: true,  // E도 시작시 해금
      unlockedAtLevel: 1,
    },
  ];
}

// 영웅 생성 (직업별)
function createHeroUnit(heroClass: HeroClass): HeroUnit {
  const classConfig = CLASS_CONFIGS[heroClass];

  return {
    id: 'hero',
    type: 'hero',
    heroClass,
    config: {
      name: classConfig.name,
      cost: {},
      hp: classConfig.hp,
      attack: classConfig.attack,
      attackSpeed: classConfig.attackSpeed,
      speed: classConfig.speed,
      range: classConfig.range,
      type: 'combat',
    },
    x: RPG_CONFIG.MAP_CENTER_X,
    y: RPG_CONFIG.MAP_CENTER_Y,
    hp: classConfig.hp,
    maxHp: classConfig.hp,
    state: 'idle',
    attackCooldown: 0,
    team: 'player',

    level: 1,
    exp: 0,
    expToNextLevel: calculateExpToNextLevel(1),
    skills: createClassSkills(heroClass),
    baseAttack: classConfig.attack,
    baseSpeed: classConfig.speed,
    baseAttackSpeed: classConfig.attackSpeed,
    skillPoints: 0,
    buffs: [],
    facingRight: true,  // 기본적으로 오른쪽을 바라봄
  };
}

export const useRPGStore = create<RPGStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    initGame: () => {
      const state = get();
      // 선택된 직업이 없으면 기본값 warrior 사용
      const heroClass = state.selectedClass || 'warrior';
      const hero = createHeroUnit(heroClass);
      set({
        ...initialState,
        running: true,
        selectedClass: heroClass,
        hero,
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
      visibility: {
        exploredCells: new Set<string>(),
        visibleRadius: RPG_CONFIG.VISIBILITY.RADIUS,
      },
    })),

    selectClass: (heroClass: HeroClass) => {
      set({ selectedClass: heroClass });
    },

    createHero: (heroClass: HeroClass) => {
      const hero = createHeroUnit(heroClass);
      set({ hero, selectedClass: heroClass });
    },

    moveHero: (x, y) => {
      set((state) => {
        if (!state.hero) return state;
        // 이동 방향에 따라 facingRight 업데이트
        const facingRight = x > state.hero.x;
        return {
          hero: {
            ...state.hero,
            targetPosition: { x, y },
            state: 'moving',
            attackTarget: undefined, // 이동 시 공격 타겟 해제
            facingRight: x !== state.hero.x ? facingRight : state.hero.facingRight, // x가 같으면 기존 방향 유지
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

    addExp: (amount) => {
      set((state) => {
        if (!state.hero) return state;
        const newExp = state.hero.exp + amount;
        return {
          hero: { ...state.hero, exp: newExp },
        };
      });
    },

    levelUp: () => {
      set((state) => {
        if (!state.hero) return state;

        const hero = state.hero;
        const newLevel = hero.level + 1;
        const bonus = RPG_CONFIG.LEVEL_UP_BONUS;

        // 스탯 증가
        const newMaxHp = hero.maxHp + bonus.hp;
        const newAttack = hero.baseAttack + bonus.attack;
        const newSpeed = hero.baseSpeed + bonus.speed;

        // 스킬 해금 체크
        const updatedSkills = hero.skills.map((skill) => {
          if (!skill.unlocked && skill.unlockedAtLevel <= newLevel) {
            return { ...skill, unlocked: true };
          }
          return skill;
        });

        return {
          hero: {
            ...hero,
            level: newLevel,
            exp: hero.exp - hero.expToNextLevel,
            expToNextLevel: calculateExpToNextLevel(newLevel),
            maxHp: newMaxHp,
            hp: newMaxHp, // 레벨업 시 풀 HP 회복
            baseAttack: newAttack,
            baseSpeed: newSpeed,
            config: {
              ...hero.config,
              hp: newMaxHp,
              attack: newAttack,
              speed: newSpeed,
            },
            skills: updatedSkills,
            skillPoints: hero.skillPoints + 1,
          },
        };
      });
    },

    useSkill: (skillType) => {
      const state = get();
      if (!state.hero) return false;

      const skill = state.hero.skills.find((s) => s.type === skillType);
      if (!skill || !skill.unlocked || skill.currentCooldown > 0) {
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

    upgradeSkill: (skillType) => {
      set((state) => {
        if (!state.hero || state.hero.skillPoints <= 0) return state;

        const skill = state.hero.skills.find((s) => s.type === skillType);
        if (!skill || !skill.unlocked) return state;

        const upgrade = RPG_CONFIG.SKILL_UPGRADE[skillType as keyof typeof RPG_CONFIG.SKILL_UPGRADE];
        if (!upgrade) return state;

        const updatedSkills = state.hero.skills.map((s) => {
          if (s.type === skillType) {
            return {
              ...s,
              level: s.level + 1,
              cooldown: Math.max(1, s.cooldown - upgrade.cooldownReduction),
            };
          }
          return s;
        });

        return {
          hero: {
            ...state.hero,
            skills: updatedSkills,
            skillPoints: state.hero.skillPoints - 1,
          },
        };
      });
    },

    startWave: (waveNumber) => {
      set((state) => ({
        currentWave: waveNumber,
        waveInProgress: true,
        waveStartTime: state.gameTime,
        stats: {
          ...state.stats,
          highestWave: Math.max(state.stats.highestWave, waveNumber),
        },
      }));
    },

    endWave: () => {
      set({
        waveInProgress: false,
        spawnQueue: [],
      });
    },

    addEnemy: (enemy) => {
      set((state) => ({
        enemies: [...state.enemies, enemy],
        enemiesRemaining: state.enemiesRemaining + 1,
      }));
    },

    removeEnemy: (enemyId) => {
      set((state) => ({
        enemies: state.enemies.filter((e) => e.id !== enemyId),
        enemiesRemaining: Math.max(0, state.enemiesRemaining - 1),
      }));
    },

    damageEnemy: (enemyId, amount) => {
      let killed = false;
      set((state) => {
        const enemies = state.enemies.map((enemy) => {
          if (enemy.id === enemyId) {
            const newHp = enemy.hp - amount;
            if (newHp <= 0) {
              killed = true;
              return { ...enemy, hp: 0 };
            }
            return { ...enemy, hp: newHp };
          }
          return enemy;
        });
        return { enemies };
      });
      return killed;
    },

    updateEnemies: (enemies) => {
      set({ enemies });
    },

    addToSpawnQueue: (type, delay) => {
      set((state) => ({
        spawnQueue: [...state.spawnQueue, { type, delay }],
      }));
    },

    clearSpawnQueue: () => {
      set({ spawnQueue: [] });
    },

    setLastSpawnTime: (time) => {
      set({ lastSpawnTime: time });
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
        result: {
          victory,
          waveReached: state.stats.highestWave,
          totalKills: state.stats.totalKills,
          totalExp: state.stats.totalExpGained,
          timePlayed: state.stats.timePlayed,
          heroLevel: state.hero?.level || 1,
          heroClass: state.hero?.heroClass || 'warrior',
        },
      });
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

    addExpGained: (amount) => {
      set((state) => ({
        stats: { ...state.stats, totalExpGained: state.stats.totalExpGained + amount },
      }));
    },

    // 공격 사거리 표시
    setShowAttackRange: (show: boolean) => {
      set({ showAttackRange: show });
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
export const useCurrentWave = () => useRPGStore((state) => state.currentWave);
export const useWaveInProgress = () => useRPGStore((state) => state.waveInProgress);
export const useRPGEnemies = () => useRPGStore((state) => state.enemies);
export const useRPGGameOver = () => useRPGStore((state) => state.gameOver);
export const useRPGResult = () => useRPGStore((state) => state.result);
export const useRPGStats = () => useRPGStore((state) => state.stats);
export const useActiveSkillEffects = () => useRPGStore((state) => state.activeSkillEffects);
export const useSelectedClass = () => useRPGStore((state) => state.selectedClass);
export const useVisibility = () => useRPGStore((state) => state.visibility);
export const usePendingSkills = () => useRPGStore((state) => state.pendingSkills);
export const useShowAttackRange = () => useRPGStore((state) => state.showAttackRange);
