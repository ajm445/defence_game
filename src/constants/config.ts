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
      attackSpeed: 1,
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
      attackSpeed: 2,
      speed: 1.6,
      range: 150,
      type: 'combat',
      spawnCooldown: 3,
    },
    knight: {
      name: '기사',
      cost: { gold: 120, wood: 20, stone: 30 },
      hp: 300,
      attack: 10,
      attackSpeed: 1,
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
      gatherRate: 1.5,
      speed: 1.5,
      type: 'support',
      resource: 'stone',
      spawnCooldown: 1,
    },
    gatherer: {
      name: '채집꾼',
      cost: { gold: 50 },
      hp: 50,
      attack: 3,
      range: 20,
      gatherRate: 1.5,
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
      attackSpeed: 1,
      speed: 1.6,
      range: 25,
      type: 'support',
      healRate: 5,
      healRange: 130,
      spawnCooldown: 5,
    },
    mage: {
      name: '마법사',
      cost: { gold: 150, wood: 50, crystal: 10 },
      hp: 40,
      attack: 50,
      attackSpeed: 2.5,
      speed: 1.6,
      range: 200,
      type: 'combat',
      aoeRadius: 50,
      spawnCooldown: 5,
    },
    boss: {
      name: '보스',
      cost: { gold: 0 }, // 무료 소환 (페이즈 2에서 자동 생성)
      hp: 2000,
      attack: 100,
      attackSpeed: 3,
      speed: 0.5, // 느린 이동 속도
      range: 50,
      type: 'combat',
      aoeRadius: 80, // 넓은 범위 공격
      spawnCooldown: 0,
    },
  } as Record<UnitType, UnitConfig>,

  RESOURCE_NODES: {
    tree: { resource: 'wood', amount: 100, respawn: 40 },
    rock: { resource: 'stone', amount: 80, respawn: 60 },
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
  WALL_COST: { wood: 40, stone: 20 },
  WALL_HP: 150,
  WALL_DURATION: 30, // 벽 지속 시간 (초)
  BASE_UPGRADE: {
    BASE_COST: { gold: 100, wood: 50, stone: 50 }, // 기본 비용 (레벨 1)
    COST_MULTIPLIER: 1.5, // 레벨당 비용 증가 배율
    HP_BONUS: 200, // 업그레이드당 HP 증가량
    GOLD_BONUS: 1, // 업그레이드당 골드 수입 증가량
    MAX_LEVEL: 5, // 최대 업그레이드 레벨
  },

  // 약초 판매
  HERB_SELL_COST: 30,   // 필요 약초 수
  HERB_SELL_GOLD: 70,   // 획득 골드
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
    // 쉬움: 다중 소환 없음, 대량 발생 없음
    maxUnitsPerAction: 1,
    massSpawnEnabled: false,
    massSpawnStartTime: 0,
    massSpawnInterval: 0,
    massSpawnUnits: [],
  },
  normal: {
    name: '중간',
    description: '2분에 대량 발생! AI가 적극적으로 유닛을 생산합니다.',
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
    enemyBaseHp: 1200,
    // 중간: 다중 소환 없음, 2분에 1회 대량 발생 (검병+궁수+기사+힐러)
    maxUnitsPerAction: 1,
    massSpawnEnabled: true,
    massSpawnStartTime: 120,
    massSpawnInterval: 0, // 1회만
    massSpawnUnits: ['melee', 'ranged', 'knight', 'healer'],
  },
  hard: {
    name: '어려움',
    description: '1분 30초마다 대량 발생! AI가 다중 소환하며 매우 공격적입니다.',
    goldPerSecond: 5,
    actionInterval: 2,
    actionChance: 0.95,
    minSupportUnits: 5,
    goldminerChance: 0.6,
    knightChance: 0.65,
    archerChance: 0.7,
    gathererChance: 0.5,
    minerChance: 0.5,
    healerChance: 0.45,
    mageChance: 0.4,
    initialGold: 150,
    enemyBaseHp: 1500,
    // 어려움: 다중 소환 가능, 1분 30초마다 대량 발생 (풀 조합)
    maxUnitsPerAction: 3,
    massSpawnEnabled: true,
    massSpawnStartTime: 90,
    massSpawnInterval: 90, // 1분 30초마다 반복
    massSpawnUnits: ['melee', 'ranged', 'knight', 'mage', 'healer'],
  },
  nightmare: {
    name: '극악',
    description: '본진 파괴 시 보스 출현! 보스를 처치하기 전에 본진이 파괴되면 패배합니다.',
    goldPerSecond: 6,
    actionInterval: 1.5,
    actionChance: 0.98,
    minSupportUnits: 6,
    goldminerChance: 0.7,
    knightChance: 0.75,
    archerChance: 0.8,
    gathererChance: 0.6,
    minerChance: 0.6,
    healerChance: 0.55,
    mageChance: 0.5,
    initialGold: 200,
    enemyBaseHp: 2000,
    // 극악: 다중 소환 가능, 1분마다 대량 발생 (풀 조합)
    maxUnitsPerAction: 4,
    massSpawnEnabled: true,
    massSpawnStartTime: 60,
    massSpawnInterval: 60, // 1분마다 반복
    massSpawnUnits: ['melee', 'ranged', 'knight', 'mage', 'healer'],
  },
  bosstest: {
    name: '보스 테스트',
    description: '[테스트용] 보스가 즉시 출현합니다. 보스 스탯 테스트용입니다.',
    goldPerSecond: 10,
    actionInterval: 10,
    actionChance: 0.1,
    minSupportUnits: 0,
    goldminerChance: 0,
    knightChance: 0,
    archerChance: 0,
    gathererChance: 0,
    minerChance: 0,
    healerChance: 0,
    mageChance: 0,
    initialGold: 1000,
    enemyBaseHp: 1, // 1로 설정하여 즉시 페이즈 2 전환
    // 테스트: AI 행동 거의 없음
    maxUnitsPerAction: 0,
    massSpawnEnabled: false,
    massSpawnStartTime: 0,
    massSpawnInterval: 0,
    massSpawnUnits: [],
  },
};

export type Config = typeof CONFIG;

// 업그레이드 레벨에 따른 비용 계산
// 레벨 0→1: 골드만 필요 (150)
// 레벨 1→2 이상: 골드 + 나무 + 돌 필요
export function getUpgradeCost(level: number): { gold: number; wood?: number; stone?: number } {
  if (level === 0) {
    // 첫 번째 업그레이드: 골드만 150
    return { gold: 150 };
  }

  // 두 번째 업그레이드부터: 복합 자원 필요
  const base = CONFIG.BASE_UPGRADE.BASE_COST;
  const multiplier = Math.pow(CONFIG.BASE_UPGRADE.COST_MULTIPLIER, level - 1);
  return {
    gold: Math.floor(base.gold * multiplier),
    wood: Math.floor(base.wood * multiplier),
    stone: Math.floor(base.stone * multiplier),
  };
}
