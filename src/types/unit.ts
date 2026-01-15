import { Resources } from './resource';

export type UnitType = 'melee' | 'ranged' | 'woodcutter' | 'miner' | 'gatherer' | 'goldminer';
export type UnitRole = 'combat' | 'support';
export type UnitState = 'idle' | 'moving' | 'attacking' | 'gathering';
export type Team = 'player' | 'enemy';

export interface UnitConfig {
  name: string;
  cost: Partial<Resources>;
  hp: number;
  attack?: number;
  speed: number;
  range?: number;
  type: UnitRole;
  gatherRate?: number;
  resource?: string;
}

export interface Unit {
  id: string;
  type: UnitType;
  config: UnitConfig;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  state: UnitState;
  attackCooldown: number;
  team: Team;
}
