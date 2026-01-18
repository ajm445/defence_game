// 클라이언트와 서버 간 공유되는 게임 타입

export type ResourceType = 'gold' | 'wood' | 'stone' | 'herb' | 'crystal';

export interface Resources {
  gold: number;
  wood: number;
  stone: number;
  herb: number;
  crystal: number;
}

export type ResourceNodeType = 'tree' | 'rock' | 'herb' | 'crystal' | 'goldmine';

export type UnitType = 'melee' | 'ranged' | 'knight' | 'woodcutter' | 'miner' | 'gatherer' | 'goldminer' | 'healer' | 'mage';
export type UnitRole = 'combat' | 'support';
export type UnitState = 'idle' | 'moving' | 'attacking' | 'gathering' | 'healing';
export type PlayerSide = 'left' | 'right';

export interface Position {
  x: number;
  y: number;
}

// 네트워크 전송용 유닛 (가벼운 버전)
export interface NetworkUnit {
  id: string;
  type: UnitType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  state: UnitState;
  side: PlayerSide;
}

// 네트워크 전송용 벽
export interface NetworkWall {
  id: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  side: PlayerSide;
}

// 네트워크 전송용 자원 노드
export interface NetworkResourceNode {
  id: string;
  type: ResourceNodeType;
  x: number;
  y: number;
  amount: number;
  maxAmount: number;
  depletedAt?: number; // 고갈된 시간 (게임 시간 기준)
}

// 플레이어 상태
export interface PlayerState {
  id: string;
  name: string;
  resources: Resources;
  baseHp: number;
  maxBaseHp: number;
}

// 네트워크 게임 상태 (전체 동기화용)
export interface NetworkGameState {
  time: number;
  maxTime: number;
  leftPlayer: PlayerState;
  rightPlayer: PlayerState;
  units: NetworkUnit[];
  walls: NetworkWall[];
  resourceNodes: NetworkResourceNode[];
}

// 게임 설정
export const GAME_CONFIG = {
  MAP_WIDTH: 3000,
  MAP_HEIGHT: 2000,
  GAME_DURATION: 600, // 10분
  GOLD_PER_SECOND: 4,
  BASE_HP: 1000,
  LEFT_BASE_X: 200,
  RIGHT_BASE_X: 2800,
  BASE_Y: 1000,
} as const;
