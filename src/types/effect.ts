export type EffectType =
  | 'attack_melee'
  | 'attack_ranged'
  | 'attack_mage'
  | 'gather_wood'
  | 'gather_stone'
  | 'gather_herb'
  | 'gather_gold'
  | 'heal'
  // RPG 모드 전용 이펙트
  | 'level_up'
  | 'stun'
  | 'meteor'
  | 'arrow_rain'
  | 'fireball'
  | 'nexus_laser'
  // 보스 스킬 이펙트
  | 'boss_smash'
  | 'boss_shockwave'
  | 'boss_summon';

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
