import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { GameState, Base, Camera, Wall, Resources, ResourceNode, Unit, UnitType, Team, AIDifficulty } from '../types';
import { CONFIG, AI_DIFFICULTY_CONFIG } from '../constants/config';
import { generateId, clamp } from '../utils/math';

interface GameActions {
  // 게임 제어
  initGame: (difficulty?: AIDifficulty) => void;
  startGame: () => void;
  stopGame: () => void;

  // 시간 및 자원
  updateTime: (deltaTime: number) => void;
  addGold: (amount: number, team: Team) => void;
  addResource: (type: keyof Resources, amount: number, team: Team) => void;
  canAfford: (cost: Partial<Resources>, team: Team) => boolean;
  spendResources: (cost: Partial<Resources>, team: Team) => boolean;

  // 유닛 관리
  spawnUnit: (type: UnitType, team: Team) => boolean;
  updateUnits: (playerUnits: Unit[], enemyUnits: Unit[]) => void;
  selectUnit: (unit: Unit | null) => void;

  // 카메라
  moveCamera: (dx: number, dy: number) => void;
  setCameraPosition: (x: number, y: number) => void;

  // 기지
  damageBase: (team: Team, damage: number) => void;
  upgradePlayerBase: () => boolean;

  // 벽
  buildWall: (x: number, y: number) => boolean;
  canBuildWall: () => boolean;
  damageWall: (wallId: string, damage: number) => void;

  // 자원 노드
  updateResourceNode: (nodeId: string, amount: number) => void;

  // 약초 판매
  sellHerb: () => boolean;
  canSellHerb: () => boolean;

  // 게임 종료
  checkGameEnd: () => 'victory' | 'defeat' | null;
}

interface GameStore extends GameState, GameActions {}

const initialResources: Resources = {
  gold: 100,
  wood: 0,
  stone: 0,
  herb: 0,
  crystal: 0,
};

function generateResourceNodes(): ResourceNode[] {
  const nodes: ResourceNode[] = [];

  // 나무 (플레이어 쪽)
  for (let i = 0; i < 8; i++) {
    nodes.push({
      id: generateId(),
      type: 'tree',
      x: 300 + Math.random() * 400,
      y: 200 + Math.random() * (CONFIG.MAP_HEIGHT - 400),
      amount: CONFIG.RESOURCE_NODES.tree.amount,
      maxAmount: CONFIG.RESOURCE_NODES.tree.amount,
    });
  }

  // 나무 (적 쪽)
  for (let i = 0; i < 8; i++) {
    nodes.push({
      id: generateId(),
      type: 'tree',
      x: CONFIG.MAP_WIDTH - 700 + Math.random() * 400,
      y: 200 + Math.random() * (CONFIG.MAP_HEIGHT - 400),
      amount: CONFIG.RESOURCE_NODES.tree.amount,
      maxAmount: CONFIG.RESOURCE_NODES.tree.amount,
    });
  }

  // 돌 (중앙 지역)
  for (let i = 0; i < 10; i++) {
    nodes.push({
      id: generateId(),
      type: 'rock',
      x: 800 + Math.random() * (CONFIG.MAP_WIDTH - 1600),
      y: 200 + Math.random() * (CONFIG.MAP_HEIGHT - 400),
      amount: CONFIG.RESOURCE_NODES.rock.amount,
      maxAmount: CONFIG.RESOURCE_NODES.rock.amount,
    });
  }

  // 약초 (전체적으로 분포)
  for (let i = 0; i < 15; i++) {
    nodes.push({
      id: generateId(),
      type: 'herb',
      x: 400 + Math.random() * (CONFIG.MAP_WIDTH - 800),
      y: 200 + Math.random() * (CONFIG.MAP_HEIGHT - 400),
      amount: CONFIG.RESOURCE_NODES.herb.amount,
      maxAmount: CONFIG.RESOURCE_NODES.herb.amount,
    });
  }

  // 수정 (희귀, 중앙에 몇 개)
  for (let i = 0; i < 3; i++) {
    nodes.push({
      id: generateId(),
      type: 'crystal',
      x: CONFIG.MAP_WIDTH / 2 - 200 + Math.random() * 400,
      y: CONFIG.MAP_HEIGHT / 2 - 200 + Math.random() * 400,
      amount: CONFIG.RESOURCE_NODES.crystal.amount,
      maxAmount: CONFIG.RESOURCE_NODES.crystal.amount,
    });
  }

  // 광산 (플레이어 쪽 4개)
  for (let i = 0; i < 4; i++) {
    nodes.push({
      id: generateId(),
      type: 'goldmine',
      x: 400 + Math.random() * 400,
      y: 200 + Math.random() * (CONFIG.MAP_HEIGHT - 400),
      amount: CONFIG.RESOURCE_NODES.goldmine.amount,
      maxAmount: CONFIG.RESOURCE_NODES.goldmine.amount,
    });
  }

  // 광산 (적 쪽 4개)
  for (let i = 0; i < 4; i++) {
    nodes.push({
      id: generateId(),
      type: 'goldmine',
      x: CONFIG.MAP_WIDTH - 800 + Math.random() * 400,
      y: 200 + Math.random() * (CONFIG.MAP_HEIGHT - 400),
      amount: CONFIG.RESOURCE_NODES.goldmine.amount,
      maxAmount: CONFIG.RESOURCE_NODES.goldmine.amount,
    });
  }

  return nodes;
}

const createInitialState = (): GameState => ({
  running: false,
  time: CONFIG.GAME_TIME,
  camera: { x: 0, y: CONFIG.MAP_HEIGHT / 2 - 400 },
  resources: { ...initialResources },
  playerBase: {
    x: 200,
    y: CONFIG.MAP_HEIGHT / 2,
    hp: CONFIG.BASE_HP,
    maxHp: CONFIG.BASE_HP,
  },
  enemyBase: {
    x: CONFIG.MAP_WIDTH - 200,
    y: CONFIG.MAP_HEIGHT / 2,
    hp: CONFIG.BASE_HP,
    maxHp: CONFIG.BASE_HP,
  },
  units: [],
  enemyUnits: [],
  resourceNodes: generateResourceNodes(),
  walls: [],
  selectedUnit: null,
  aiResources: { ...initialResources },
});

export const useGameStore = create<GameStore>()(
  subscribeWithSelector((set, get) => ({
    ...createInitialState(),

    initGame: (difficulty: AIDifficulty = 'easy') => {
      const state = createInitialState();
      const difficultyConfig = AI_DIFFICULTY_CONFIG[difficulty];
      state.aiResources.gold = difficultyConfig.initialGold;
      state.enemyBase.hp = difficultyConfig.enemyBaseHp;
      state.enemyBase.maxHp = difficultyConfig.enemyBaseHp;
      set(state);
    },

    startGame: () => set({ running: true }),

    stopGame: () => set({ running: false }),

    updateTime: (deltaTime) =>
      set((state) => ({
        time: Math.max(0, state.time - deltaTime),
      })),

    addGold: (amount, team) =>
      set((state) => {
        if (team === 'player') {
          return {
            resources: { ...state.resources, gold: state.resources.gold + amount },
          };
        } else {
          return {
            aiResources: { ...state.aiResources, gold: state.aiResources.gold + amount },
          };
        }
      }),

    addResource: (type, amount, team) =>
      set((state) => {
        if (team === 'player') {
          return {
            resources: { ...state.resources, [type]: state.resources[type] + amount },
          };
        } else {
          return {
            aiResources: { ...state.aiResources, [type]: state.aiResources[type] + amount },
          };
        }
      }),

    canAfford: (cost, team) => {
      const resources = team === 'player' ? get().resources : get().aiResources;
      for (const [resource, amount] of Object.entries(cost)) {
        if ((resources[resource as keyof Resources] || 0) < (amount || 0)) {
          return false;
        }
      }
      return true;
    },

    spendResources: (cost, team) => {
      const state = get();
      const resources = team === 'player' ? state.resources : state.aiResources;

      // 비용 확인
      for (const [resource, amount] of Object.entries(cost)) {
        if ((resources[resource as keyof Resources] || 0) < (amount || 0)) {
          return false;
        }
      }

      // 비용 차감
      const newResources = { ...resources };
      for (const [resource, amount] of Object.entries(cost)) {
        newResources[resource as keyof Resources] -= amount || 0;
      }

      if (team === 'player') {
        set({ resources: newResources });
      } else {
        set({ aiResources: newResources });
      }

      return true;
    },

    spawnUnit: (type, team) => {
      const state = get();
      const unitConfig = CONFIG.UNITS[type];
      const resources = team === 'player' ? state.resources : state.aiResources;
      const base = team === 'player' ? state.playerBase : state.enemyBase;

      // 비용 확인
      for (const [resource, amount] of Object.entries(unitConfig.cost)) {
        if ((resources[resource as keyof Resources] || 0) < (amount || 0)) {
          return false;
        }
      }

      // 비용 차감
      if (!get().spendResources(unitConfig.cost, team)) {
        return false;
      }

      const unit: Unit = {
        id: generateId(),
        type,
        config: unitConfig,
        x: base.x + (team === 'player' ? 50 : -50),
        y: base.y + (Math.random() - 0.5) * 100,
        hp: unitConfig.hp,
        maxHp: unitConfig.hp,
        state: 'idle',
        attackCooldown: 0,
        team,
      };

      if (team === 'player') {
        set((state) => ({ units: [...state.units, unit] }));
      } else {
        set((state) => ({ enemyUnits: [...state.enemyUnits, unit] }));
      }

      return true;
    },

    updateUnits: (playerUnits, enemyUnits) =>
      set({
        units: playerUnits,
        enemyUnits: enemyUnits,
      }),

    selectUnit: (unit) => set({ selectedUnit: unit }),

    moveCamera: (dx, dy) =>
      set((state) => ({
        camera: {
          x: clamp(state.camera.x + dx, 0, CONFIG.MAP_WIDTH - window.innerWidth),
          y: clamp(
            state.camera.y + dy,
            0,
            CONFIG.MAP_HEIGHT - (window.innerHeight - CONFIG.UI_PANEL_HEIGHT)
          ),
        },
      })),

    setCameraPosition: (x, y) =>
      set({
        camera: {
          x: clamp(x, 0, CONFIG.MAP_WIDTH - window.innerWidth),
          y: clamp(y, 0, CONFIG.MAP_HEIGHT - (window.innerHeight - CONFIG.UI_PANEL_HEIGHT)),
        },
      }),

    damageBase: (team, damage) =>
      set((state) => {
        if (team === 'player') {
          return {
            playerBase: {
              ...state.playerBase,
              hp: Math.max(0, state.playerBase.hp - damage),
            },
          };
        } else {
          return {
            enemyBase: {
              ...state.enemyBase,
              hp: Math.max(0, state.enemyBase.hp - damage),
            },
          };
        }
      }),

    upgradePlayerBase: () => {
      const state = get();
      const cost = CONFIG.BASE_UPGRADE_COST;

      if (
        state.resources.gold >= cost.gold &&
        state.resources.stone >= cost.stone
      ) {
        set({
          resources: {
            ...state.resources,
            gold: state.resources.gold - cost.gold,
            stone: state.resources.stone - cost.stone,
          },
          playerBase: {
            ...state.playerBase,
            hp: state.playerBase.hp + CONFIG.BASE_UPGRADE_HP,
            maxHp: state.playerBase.maxHp + CONFIG.BASE_UPGRADE_HP,
          },
        });
        return true;
      }
      return false;
    },

    buildWall: (x: number, y: number) => {
      const state = get();
      const cost = CONFIG.WALL_COST;

      if (state.resources.wood >= cost.wood && state.resources.stone >= cost.stone) {
        const wall: Wall = {
          id: generateId(),
          x,
          y,
          hp: CONFIG.WALL_HP,
          maxHp: CONFIG.WALL_HP,
        };

        set({
          resources: {
            ...state.resources,
            wood: state.resources.wood - cost.wood,
            stone: state.resources.stone - cost.stone,
          },
          walls: [...state.walls, wall],
        });
        return true;
      }
      return false;
    },

    canBuildWall: () => {
      const state = get();
      const cost = CONFIG.WALL_COST;
      return state.resources.wood >= cost.wood && state.resources.stone >= cost.stone;
    },

    damageWall: (wallId: string, damage: number) =>
      set((state) => ({
        walls: state.walls
          .map((wall) =>
            wall.id === wallId ? { ...wall, hp: wall.hp - damage } : wall
          )
          .filter((wall) => wall.hp > 0),
      })),

    updateResourceNode: (nodeId, amount) =>
      set((state) => ({
        resourceNodes: state.resourceNodes.map((node) =>
          node.id === nodeId ? { ...node, amount: Math.max(0, amount) } : node
        ),
      })),

    sellHerb: () => {
      const state = get();
      const herbCost = CONFIG.HERB_SELL_COST;
      const goldGain = CONFIG.HERB_SELL_GOLD;

      if (state.resources.herb >= herbCost) {
        set({
          resources: {
            ...state.resources,
            herb: state.resources.herb - herbCost,
            gold: state.resources.gold + goldGain,
          },
        });
        return true;
      }
      return false;
    },

    canSellHerb: () => {
      const state = get();
      return state.resources.herb >= CONFIG.HERB_SELL_COST;
    },

    checkGameEnd: () => {
      const state = get();

      if (state.playerBase.hp <= 0) {
        return 'defeat';
      }
      if (state.enemyBase.hp <= 0) {
        return 'victory';
      }
      if (state.time <= 0) {
        return state.playerBase.hp > state.enemyBase.hp ? 'victory' : 'defeat';
      }
      return null;
    },
  }))
);

// Selectors for performance optimization
export const useResources = () => useGameStore((state) => state.resources);
export const usePlayerBase = () => useGameStore((state) => state.playerBase);
export const useEnemyBase = () => useGameStore((state) => state.enemyBase);
export const useGameTime = () => useGameStore((state) => state.time);
export const useSelectedUnit = () => useGameStore((state) => state.selectedUnit);
export const useIsRunning = () => useGameStore((state) => state.running);
export const useCamera = () => useGameStore((state) => state.camera);
