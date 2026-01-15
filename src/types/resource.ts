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
}

export interface ResourceNodeConfig {
  resource: ResourceType;
  amount: number;
  respawn: number;
}
