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

  // ===== RPG 모드 전용 이펙트 =====

  // 레벨업 - 금색 별 상승
  level_up: {
    count: 15,
    colors: ['#ffd700', '#ffec00', '#fff700', '#ffaa00'],
    sizeMin: 4,
    sizeMax: 8,
    speedMin: 40,
    speedMax: 100,
    lifeMin: 0.6,
    lifeMax: 1.0,
    gravity: -60,
    shape: 'star',
    spread: Math.PI * 2,
  },

  // 스턴 - 노란 별 회전
  stun: {
    count: 5,
    colors: ['#ffff00', '#ffdd00', '#ffffff'],
    sizeMin: 6,
    sizeMax: 10,
    speedMin: 20,
    speedMax: 40,
    lifeMin: 0.8,
    lifeMax: 1.2,
    gravity: 0,
    shape: 'star',
    spread: Math.PI * 2,
  },

  // 메테오 - 빨강/주황 폭발
  meteor: {
    count: 25,
    colors: ['#ff4400', '#ff6600', '#ff0000', '#ff8800', '#ffaa00'],
    sizeMin: 5,
    sizeMax: 12,
    speedMin: 100,
    speedMax: 200,
    lifeMin: 0.4,
    lifeMax: 0.8,
    gravity: 150,
    shape: 'circle',
    spread: Math.PI * 2,
  },

  // 화살 비 - 파란색 화살 파티클
  arrow_rain: {
    count: 20,
    colors: ['#00aaff', '#0088ff', '#00ccff', '#66ddff'],
    sizeMin: 3,
    sizeMax: 6,
    speedMin: 150,
    speedMax: 250,
    lifeMin: 0.3,
    lifeMax: 0.5,
    gravity: 300,
    shape: 'circle',
    spread: Math.PI / 6,
    direction: Math.PI / 2, // 아래로
  },

  // 파이어볼 - 주황/빨강 폭발
  fireball: {
    count: 18,
    colors: ['#ff4400', '#ff6600', '#ff8800', '#ffaa00', '#ff0000'],
    sizeMin: 4,
    sizeMax: 10,
    speedMin: 80,
    speedMax: 160,
    lifeMin: 0.3,
    lifeMax: 0.6,
    gravity: 50,
    shape: 'circle',
    spread: Math.PI * 2,
  },

  // 넥서스 레이저 - 청록색 빔 파티클
  nexus_laser: {
    count: 12,
    colors: ['#00ffff', '#00ccff', '#00aaff', '#66ffff', '#ffffff'],
    sizeMin: 2,
    sizeMax: 5,
    speedMin: 300,
    speedMax: 500,
    lifeMin: 0.15,
    lifeMax: 0.3,
    gravity: 0,
    shape: 'circle',
    spread: Math.PI / 8, // 좁은 확산 (레이저처럼)
  },

  // ===== 보스 스킬 이펙트 =====

  // 보스 강타 - 붉은색/주황색 충격 파티클
  boss_smash: {
    count: 20,
    colors: ['#ff3300', '#ff6600', '#ff9900', '#ff0000', '#cc0000'],
    sizeMin: 5,
    sizeMax: 12,
    speedMin: 100,
    speedMax: 200,
    lifeMin: 0.3,
    lifeMax: 0.6,
    gravity: 150,
    shape: 'circle',
    spread: Math.PI / 2,
    direction: -Math.PI / 2,  // 위로 방사
  },

  // 보스 충격파 - 보라색/분홍색 원형 파동
  boss_shockwave: {
    count: 30,
    colors: ['#9900ff', '#cc33ff', '#ff66ff', '#6600cc', '#ff00ff'],
    sizeMin: 4,
    sizeMax: 10,
    speedMin: 150,
    speedMax: 300,
    lifeMin: 0.4,
    lifeMax: 0.7,
    gravity: 0,
    shape: 'circle',
    spread: Math.PI * 2,  // 전방위
  },

  // 보스 소환 - 어두운 보라색 연기
  boss_summon: {
    count: 15,
    colors: ['#330066', '#660099', '#9900cc', '#440088', '#220044'],
    sizeMin: 6,
    sizeMax: 15,
    speedMin: 20,
    speedMax: 50,
    lifeMin: 0.6,
    lifeMax: 1.0,
    gravity: -30,  // 위로 서서히 상승
    shape: 'circle',
    spread: Math.PI * 2,
  },

  // 보스 밀어내기 - 노란색/주황색 충격파
  boss_knockback: {
    count: 25,
    colors: ['#ffff00', '#ffcc00', '#ff9900', '#ffaa00', '#ffffff'],
    sizeMin: 5,
    sizeMax: 12,
    speedMin: 200,
    speedMax: 400,
    lifeMin: 0.3,
    lifeMax: 0.5,
    gravity: 0,
    shape: 'circle',
    spread: Math.PI * 2,  // 전방위
  },

  // 보스 돌진 - 파란색/청록색 돌진 궤적
  boss_charge: {
    count: 20,
    colors: ['#0066ff', '#0099ff', '#00ccff', '#0044cc', '#ffffff'],
    sizeMin: 4,
    sizeMax: 10,
    speedMin: 150,
    speedMax: 300,
    lifeMin: 0.2,
    lifeMax: 0.4,
    gravity: 0,
    shape: 'circle',
    spread: Math.PI / 4,
  },

  // 보스 회복 - 녹색 힐링 파티클
  boss_heal: {
    count: 20,
    colors: ['#00ff00', '#33ff33', '#66ff66', '#00cc00', '#99ff99'],
    sizeMin: 5,
    sizeMax: 10,
    speedMin: 30,
    speedMax: 60,
    lifeMin: 0.8,
    lifeMax: 1.2,
    gravity: -40,  // 위로 상승
    shape: 'cross',
    spread: Math.PI * 2,
  },

  // 지뢰 폭발 - 주황/빨강/노랑 폭발 파티클
  mine_explosion: {
    count: 30,
    colors: ['#ff6600', '#ff4400', '#ff9900', '#ffcc00', '#ff0000'],
    sizeMin: 4,
    sizeMax: 12,
    speedMin: 100,
    speedMax: 250,
    lifeMin: 0.3,
    lifeMax: 0.6,
    gravity: 100,
    shape: 'circle',
    spread: Math.PI * 2,
  },

  // 보스 기본 공격 - 어두운 빨간색/검은색 충격파
  boss_basic_attack: {
    count: 15,
    colors: ['#8b0000', '#4a0000', '#ff3300', '#2d0000', '#cc0000'],
    sizeMin: 6,
    sizeMax: 14,
    speedMin: 120,
    speedMax: 220,
    lifeMin: 0.25,
    lifeMax: 0.45,
    gravity: 50,
    shape: 'circle',
    spread: Math.PI / 2,  // 부채꼴 형태로 퍼짐
  },
};
