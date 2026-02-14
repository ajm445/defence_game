import { Resources } from './resource';

export type UnitType = 'melee' | 'ranged' | 'knight' | 'woodcutter' | 'miner' | 'gatherer' | 'goldminer' | 'healer' | 'mage' | 'boss' | 'boss2';
export type UnitRole = 'combat' | 'support';
export type UnitState = 'idle' | 'moving' | 'attacking' | 'gathering' | 'healing' | 'casting';
export type Team = 'player' | 'enemy';

export interface UnitConfig {
  name: string;
  cost: Partial<Resources>;
  hp: number;
  attack?: number;
  attackSpeed?: number;   // 공격속도 (초, 낮을수록 빠름)
  speed: number;
  range?: number;
  type: UnitRole;
  gatherRate?: number;
  resource?: string;
  healRate?: number;      // 힐러: 초당 회복량
  healRange?: number;     // 힐러: 회복 사거리
  aoeRadius?: number;     // 마법사: 범위 공격 반경
  spawnCooldown?: number; // 소환 쿨타임 (초)
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
  attackerId?: string; // 마지막으로 공격한 유닛 ID (반격용)
}
