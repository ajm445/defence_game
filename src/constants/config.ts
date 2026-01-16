import { UnitConfig, UnitType } from '../types/unit';
import { ResourceNodeConfig, ResourceNodeType } from '../types/resource';
import { AIDifficulty, AIDifficultyConfig } from '../types/game';

export const CONFIG = {
  MAP_WIDTH: 3000,
  MAP_HEIGHT: 2000,
  GAME_TIME: 10 * 60, // 10분
  GOLD_PER_SECOND: 4,
  AI_GOLD_PER_SECOND: 3,
  AI_ACTION_INTERVAL: 5, // AI 행동 주기 (초)
  BASE_HP: 1000,

  UNITS: {
    melee: {
      name: '검병',
      cost: { gold: 50 },
      hp: 100,
      attack: 15,
      speed: 1.5,
      range: 30,
      type: 'combat',
    },
    ranged: {
      name: '궁수',
      cost: { gold: 80, wood: 10 },
      hp: 50,
      attack: 25,
      speed: 1.6,
      range: 150,
      type: 'combat',
    },
    knight: {
      name: '기사',
      cost: { gold: 120, wood: 20, stone: 30 },
      hp: 250,
      attack: 30,
      speed: 1.3,
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
      speed: 1.5,
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
      speed: 1.5,
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
      speed: 1.5,
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

  // 약초 판매
  HERB_SELL_COST: 10,   // 필요 약초 수
  HERB_SELL_GOLD: 30,   // 획득 골드
} as const;

// AI 난이도별 설정
export const AI_DIFFICULTY_CONFIG: Record<AIDifficulty, AIDifficultyConfig> = {
  easy: {
    name: '쉬움',
    description: '초보자에게 추천합니다. 느린 AI와 적은 자원으로 여유롭게 플레이할 수 있습니다.',
    goldPerSecond: 3,
    actionInterval: 5,
    actionChance: 0.6,
    minSupportUnits: 3,
    goldminerChance: 0.2,
    knightChance: 0.25,
    archerChance: 0.3,
    initialGold: 100,
  },
  normal: {
    name: '중간',
    description: '균형 잡힌 난이도입니다. AI가 적극적으로 유닛을 생산합니다.',
    goldPerSecond: 4,
    actionInterval: 4,
    actionChance: 0.7,
    minSupportUnits: 4,
    goldminerChance: 0.3,
    knightChance: 0.35,
    archerChance: 0.4,
    initialGold: 100,
  },
  hard: {
    name: '어려움',
    description: '숙련자를 위한 도전입니다. AI가 빠르고 공격적으로 플레이합니다.',
    goldPerSecond: 5,
    actionInterval: 3,
    actionChance: 0.85,
    minSupportUnits: 5,
    goldminerChance: 0.4,
    knightChance: 0.45,
    archerChance: 0.5,
    initialGold: 150,
  },
};

export type Config = typeof CONFIG;
