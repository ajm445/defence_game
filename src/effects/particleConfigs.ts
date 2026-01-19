import { EffectType, ParticleShape } from '../types/effect';

export interface ParticleConfig {
  count: number;
  colors: string[];
  sizeMin: number;
  sizeMax: number;
  speedMin: number;
  speedMax: number;
  lifeMin: number;
  lifeMax: number;
  gravity: number;
  shape: ParticleShape;
  spread: number; // 방사 각도 (라디안)
  direction?: number; // 기본 방향 (라디안)
  emoji?: string; // 이모지 모양일 때 사용할 이모지
}

export const PARTICLE_CONFIGS: Record<EffectType, ParticleConfig> = {
  // 근접 공격 - 빨간색 파티클 방사
  attack_melee: {
    count: 8,
    colors: ['#ff4444', '#ff6666', '#ff2222', '#cc0000'],
    sizeMin: 2,
    sizeMax: 5,
    speedMin: 80,
    speedMax: 150,
    lifeMin: 0.2,
    lifeMax: 0.4,
    gravity: 100,
    shape: 'circle',
    spread: Math.PI * 2,
  },

  // 원거리 공격 - 노란색 투사체
  attack_ranged: {
    count: 5,
    colors: ['#ffff00', '#ffdd00', '#ffaa00'],
    sizeMin: 3,
    sizeMax: 6,
    speedMin: 50,
    speedMax: 100,
    lifeMin: 0.3,
    lifeMax: 0.5,
    gravity: 0,
    shape: 'circle',
    spread: Math.PI / 4,
  },

  // 마법 공격 - 보라색 별 파티클
  attack_mage: {
    count: 15,
    colors: ['#9933ff', '#cc66ff', '#ff66ff', '#6633cc'],
    sizeMin: 3,
    sizeMax: 7,
    speedMin: 30,
    speedMax: 80,
    lifeMin: 0.5,
    lifeMax: 0.8,
    gravity: -30, // 위로 떠오름
    shape: 'star',
    spread: Math.PI * 2,
  },

  // 나무 채집 - 갈색 나무 조각
  gather_wood: {
    count: 6,
    colors: ['#8B4513', '#A0522D', '#D2691E', '#CD853F'],
    sizeMin: 3,
    sizeMax: 6,
    speedMin: 60,
    speedMax: 120,
    lifeMin: 0.3,
    lifeMax: 0.6,
    gravity: 200,
    shape: 'square',
    spread: Math.PI / 2,
    direction: -Math.PI / 2, // 위쪽으로
  },

  // 돌 채집 - 회색 돌 파편
  gather_stone: {
    count: 6,
    colors: ['#808080', '#a0a0a0', '#c0c0c0', '#606060'],
    sizeMin: 2,
    sizeMax: 5,
    speedMin: 70,
    speedMax: 130,
    lifeMin: 0.25,
    lifeMax: 0.5,
    gravity: 250,
    shape: 'square',
    spread: Math.PI / 2,
    direction: -Math.PI / 2,
  },

  // 약초 채집 - 초록색 입자 떠오름
  gather_herb: {
    count: 8,
    colors: ['#00ff00', '#33ff33', '#66ff66', '#00cc00'],
    sizeMin: 2,
    sizeMax: 4,
    speedMin: 20,
    speedMax: 50,
    lifeMin: 0.5,
    lifeMax: 0.8,
    gravity: -50, // 위로 떠오름
    shape: 'circle',
    spread: Math.PI / 3,
    direction: -Math.PI / 2,
  },

  // 금 채집 - 금빛 별 파티클
  gather_gold: {
    count: 10,
    colors: ['#ffd700', '#ffcc00', '#ffaa00', '#fff700'],
    sizeMin: 3,
    sizeMax: 6,
    speedMin: 30,
    speedMax: 70,
    lifeMin: 0.4,
    lifeMax: 0.7,
    gravity: -40,
    shape: 'star',
    spread: Math.PI * 2,
  },

  // 힐 - 초록색 십자가 상승 (투명하게 표시)
  heal: {
    count: 6,
    colors: ['rgba(0, 255, 0, 0.4)', 'rgba(51, 255, 51, 0.4)', 'rgba(102, 255, 102, 0.4)', 'rgba(0, 204, 0, 0.4)'],
    sizeMin: 8,
    sizeMax: 12,
    speedMin: 25,
    speedMax: 45,
    lifeMin: 0.6,
    lifeMax: 0.9,
    gravity: -40,
    shape: 'cross',
    spread: Math.PI / 2,
    direction: -Math.PI / 2,
  },
};
