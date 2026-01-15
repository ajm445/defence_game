import { Resources, ResourceNode } from './resource';
import { Unit } from './unit';

export interface Position {
  x: number;
  y: number;
}

export interface Camera extends Position {}

export interface Base extends Position {
  hp: number;
  maxHp: number;
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

export type GameScreen = 'menu' | 'game' | 'gameover';

export interface GameResult {
  victory: boolean;
}
