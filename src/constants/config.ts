import { UnitConfig, UnitType } from '../types/unit';
import { ResourceNodeConfig, ResourceNodeType } from '../types/resource';
import { AIDifficulty, AIDifficultyConfig } from '../types/game';

export const CONFIG = {
  MAP_WIDTH: 4000,
  MAP_HEIGHT: 2400,
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
      spawnCooldown: 1.5,
    },
    ranged: {
      name: '궁수',
      cost: { gold: 80, wood: 10 },
      hp: 50,
      attack: 25,
      speed: 1.6,
      range: 150,
      type: 'combat',
      spawnCooldown: 3,
    },
    knight: {
      name: '기사',
      cost: { gold: 120, wood: 20, stone: 30 },
      hp: 250,
      attack: 10,
      speed: 1.3,
      range: 35,
      type: 'combat',
      spawnCooldown: 5,
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
      spawnCooldown: 1,
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
      spawnCooldown: 1,
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
      spawnCooldown: 1,
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
      spawnCooldown: 2,
    },
    healer: {
      name: '힐러',
      cost: { gold: 70, herb: 15 },
      hp: 60,
      attack: 3,
      speed: 1.4,
      range: 25,
      type: 'support',
      healRate: 10,
      healRange: 100,
      spawnCooldown: 5,
    },
    mage: {
      name: '마법사',
      cost: { gold: 150, crystal: 10 },
      hp: 40,
      attack: 50,
      speed: 1.2,
      range: 180,
      type: 'combat',
      aoeRadius: 50,
      spawnCooldown: 5,
    },
  } as Record<UnitType, UnitConfig>,

  RESOURCE_NODES: {
    tree: { resource: 'wood', amount: 100, respawn: 40 },
    rock: { resource: 'stone', amount: 80, respawn: 90 },
    herb: { resource: 'herb', amount: 50, respawn: 30 },
    crystal: { resource: 'crystal', amount: 30, respawn: 180 },
    goldmine: { resource: 'gold', amount: 80, respawn: 40 },
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
  WALL_DURATION: 30, // 벽 지속 시간 (초)
  BASE_UPGRADE: {
    BASE_COST: { gold: 100, stone: 50 }, // 기본 비용 (레벨 1)
    COST_MULTIPLIER: 1.5, // 레벨당 비용 증가 배율
    HP_BONUS: 200, // 업그레이드당 HP 증가량
    GOLD_BONUS: 1, // 업그레이드당 골드 수입 증가량
    MAX_LEVEL: 5, // 최대 업그레이드 레벨
  },

  // 약초 판매
  HERB_SELL_COST: 10,   // 필요 약초 수
  HERB_SELL_GOLD: 30,   // 획득 골드
} as const;

// AI 난이도별 설정
export const AI_DIFFICULTY_CONFIG: Record<AIDifficulty, AIDifficultyConfig> = {
  easy: {
    name: '쉬움',
    description: '초보자에게 추천합니다. 느린 AI로 여유롭게 플레이할 수 있습니다.',
    goldPerSecond: 4,
    actionInterval: 5,
    actionChance: 0.6,
    minSupportUnits: 3,
    goldminerChance: 0.2,
    knightChance: 0.25,
    archerChance: 0.3,
    gathererChance: 0.2,
    minerChance: 0.2,
    healerChance: 0.15,
    mageChance: 0.1,
    initialGold: 100,
    enemyBaseHp: 1000,
  },
  normal: {
    name: '중간',
    description: '균형 잡힌 난이도입니다. AI가 적극적으로 유닛을 생산하고 기지 체력이 증가합니다.',
    goldPerSecond: 4,
    actionInterval: 3,
    actionChance: 0.8,
    minSupportUnits: 4,
    goldminerChance: 0.4,
    knightChance: 0.45,
    archerChance: 0.5,
    gathererChance: 0.35,
    minerChance: 0.35,
    healerChance: 0.25,
    mageChance: 0.2,
    initialGold: 120,
    enemyBaseHp: 1200,
  },
  hard: {
    name: '어려움',
    description: '숙련자를 위한 도전입니다. AI가 빠르고 공격적이며 기지 체력이 크게 증가합니다.',
    goldPerSecond: 4,
    actionInterval: 2.5,
    actionChance: 0.85,
    minSupportUnits: 5,
    goldminerChance: 0.5,
    knightChance: 0.55,
    archerChance: 0.6,
    gathererChance: 0.45,
    minerChance: 0.45,
    healerChance: 0.35,
    mageChance: 0.3,
    initialGold: 120,
    enemyBaseHp: 1500,
  },
};

export type Config = typeof CONFIG;

// 업그레이드 레벨에 따른 비용 계산
export function getUpgradeCost(level: number): { gold: number; stone: number } {
  const base = CONFIG.BASE_UPGRADE.BASE_COST;
  const multiplier = Math.pow(CONFIG.BASE_UPGRADE.COST_MULTIPLIER, level);
  return {
    gold: Math.floor(base.gold * multiplier),
    stone: Math.floor(base.stone * multiplier),
  };
}
