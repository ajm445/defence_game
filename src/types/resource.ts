export type ResourceType = 'gold' | 'wood' | 'stone' | 'herb' | 'crystal';

export interface Resources {
  gold: number;
  wood: number;
  stone: number;
  herb: number;
  crystal: number;
}

export type ResourceNodeType = 'tree' | 'rock' | 'herb' | 'crystal' | 'goldmine';

export interface ResourceNode {
  id: string;
  type: ResourceNodeType;
  x: number;
  y: number;
  amount: number;
  maxAmount: number;
  depletedAt?: number; // 고갈된 시간 (게임 시간 기준)
}

export interface ResourceNodeConfig {
  resource: ResourceType;
  amount: number;
  respawn: number;
}
