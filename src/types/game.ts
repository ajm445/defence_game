import { Resources, ResourceNode } from './resource';
import { Unit } from './unit';

export interface Position {
  x: number;
  y: number;
}

export interface Camera extends Position {
  zoom: number;
}

export interface Base extends Position {
  hp: number;
  maxHp: number;
  upgradeLevel?: number; // 업그레이드 레벨 (0부터 시작, 멀티플레이어 호환을 위해 선택적)
}

export interface Wall extends Position {
  id: string;
  hp: number;
  maxHp: number;
}

export interface GameState {
  running: boolean;
  time: number;
  camera: Camera;
  resources: Resources;
  playerBase: Base;
  enemyBase: Base;
  units: Unit[];
  enemyUnits: Unit[];
  resourceNodes: ResourceNode[];
  walls: Wall[];
  selectedUnit: Unit | null;
  aiResources: Resources;
}

export type GameScreen = 'menu' | 'modeSelect' | 'difficultySelect' | 'lobby' | 'game' | 'gameover';

export type GameMode = 'ai' | 'multiplayer';

export type AIDifficulty = 'easy' | 'normal' | 'hard';

export interface AIDifficultyConfig {
  name: string;
  description: string;
  goldPerSecond: number;
  actionInterval: number;
  actionChance: number;
  minSupportUnits: number;
  goldminerChance: number;
  knightChance: number;
  archerChance: number;
  gathererChance: number;
  minerChance: number;
  healerChance: number;
  mageChance: number;
  initialGold: number;
  enemyBaseHp: number;
}

export interface GameResult {
  victory: boolean;
}
