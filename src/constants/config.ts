import { UnitConfig, UnitType } from '../types/unit';
import { ResourceNodeConfig, ResourceNodeType } from '../types/resource';

export const CONFIG = {
  MAP_WIDTH: 3000,
  MAP_HEIGHT: 2000,
  GAME_TIME: 20 * 60, // 20분
  GOLD_PER_SECOND: 4,
  AI_GOLD_PER_SECOND: 3,
  AI_ACTION_INTERVAL: 6, // AI 행동 주기 (초)
  BASE_HP: 1000,

  UNITS: {
    melee: {
      name: '검병',
      cost: { gold: 50 },
      hp: 100,
      attack: 15,
      speed: 2,
      range: 30,
      type: 'combat',
    },
    ranged: {
      name: '궁수',
      cost: { gold: 80, wood: 10 },
      hp: 50,
      attack: 25,
      speed: 1.5,
      range: 150,
      type: 'combat',
    },
    knight: {
      name: '기사',
      cost: { gold: 120, wood: 20, stone: 30 },
      hp: 200,
      attack: 25,
      speed: 1.5,
      range: 35,
      type: 'combat',
    },
    woodcutter: {
      name: '나무꾼',
      cost: { gold: 30 },
      hp: 60,
      attack: 5,
      range: 25,
      gatherRate: 1,
      speed: 1.2,
      type: 'support',
      resource: 'wood',
    },
    miner: {
      name: '광부',
      cost: { gold: 40, wood: 5 },
      hp: 70,
      attack: 6,
      range: 25,
      gatherRate: 0.8,
      speed: 1,
      type: 'support',
      resource: 'stone',
    },
    gatherer: {
      name: '채집꾼',
      cost: { gold: 35 },
      hp: 50,
      attack: 3,
      range: 20,
      gatherRate: 1.2,
      speed: 1.5,
      type: 'support',
      resource: 'herb',
    },
    goldminer: {
      name: '금광부',
      cost: { gold: 100, wood: 20 },
      hp: 70,
      attack: 4,
      range: 25,
      gatherRate: 1.5,
      speed: 1.0,
      type: 'support',
      resource: 'gold',
    },
  } as Record<UnitType, UnitConfig>,

  RESOURCE_NODES: {
    tree: { resource: 'wood', amount: 100, respawn: 60 },
    rock: { resource: 'stone', amount: 80, respawn: 90 },
    herb: { resource: 'herb', amount: 50, respawn: 45 },
    crystal: { resource: 'crystal', amount: 30, respawn: 180 },
    goldmine: { resource: 'gold', amount: 80, respawn: 60 },
  } as Record<ResourceNodeType, ResourceNodeConfig>,

  // UI 관련 상수
  UI_PANEL_HEIGHT: 120,
  MINIMAP_WIDTH: 200,
  MINIMAP_HEIGHT: 150,

  // 게임 밸런스
  DIRECT_GATHER_RANGE: 500, // 본진에서 직접 채집 가능 거리
  DIRECT_GATHER_AMOUNT: 5,  // 클릭당 채집량

  // 건설 비용
  WALL_COST: { wood: 20, stone: 10 },
  WALL_HP: 200,
  BASE_UPGRADE_COST: { gold: 100, stone: 50 },
  BASE_UPGRADE_HP: 200,
} as const;

export type Config = typeof CONFIG;
