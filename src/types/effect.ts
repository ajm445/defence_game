export type EffectType =
  | 'attack_melee'
  | 'attack_ranged'
  | 'attack_mage'
  | 'gather_wood'
  | 'gather_stone'
  | 'gather_herb'
  | 'gather_gold'
  | 'heal';

export type ParticleShape = 'circle' | 'square' | 'star' | 'emoji' | 'cross';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity?: number;
  shape: ParticleShape;
  alpha?: number;
  emoji?: string;
}

export interface Effect {
  id: string;
  type: EffectType;
  x: number;
  y: number;
  particles: Particle[];
  startTime: number;
  duration: number;
  radius?: number; // AOE 이펙트용
  targetX?: number; // 원거리 투사체용
  targetY?: number;
}
