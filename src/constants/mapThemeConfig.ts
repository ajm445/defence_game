import { MapTheme } from '../types/rpg';

// ============================================
// 맵 테마 설정 인터페이스
// ============================================

export interface MapThemeConfig {
  id: MapTheme;
  name: string;
  nameEn: string;
  description: string;

  // 배경 그라데이션 (rpgRenderer.ts)
  background: {
    top: string;
    mid: string;
    bottom: string;
  };

  // 격자 색상 (drawGrid.ts)
  grid: {
    mainColor: string;
    subColor: string;
  };

  // 영역 색조 (drawMapDecorations.ts → drawZoneTints)
  zoneTints: {
    nexus: { inner: string; mid: string };
    base: { inner: string; mid: string };
  };

  // 미니맵 (drawRPGMinimap.ts)
  minimap: {
    background: string;
    borderColor: string;
    nexusTint: string;
    baseTint: string;
  };

  // 장식 색상 팔레트
  decorations: {
    grass: {
      rBase: number; gBase: number; bBase: number;
      rRange: number; gRange: number; bRange: number;
    };
    rock: {
      grayBase: number; grayRange: number;
    };
    puddle: {
      inner: [number, number, number];  // RGB
      mid: [number, number, number];
      outer: [number, number, number];
      highlight: [number, number, number];
    };
    torch: {
      glowColor: string;
      glowMidColor: string;
      poleColor: string;
      flameColor: string;
      flameCoreColor: string;
    };
  };

  // 경계 요소 색상
  boundary: {
    treeRatio: number; // 나무 비율 (0~1), 나머지는 바위
    trunk: { rBase: number; gBase: number; bBase: number; range: number };
    leaf: {
      colors: Array<{ r: number; g: number; b: number; alpha: number }>;
    };
    rock: { grayBase: number; grayRange: number };
  };

  // 안개/파티클 색상
  ambient: {
    fogColor: string;
    nexusLightColor: string;
    baseEmberColor: string;
  };
}

// ============================================
// 숲 테마 (현재 기본 맵)
// ============================================

const FOREST_THEME: MapThemeConfig = {
  id: 'forest',
  name: '숲',
  nameEn: 'Forest',
  description: '울창한 어둠의 숲',

  background: {
    top: '#1a2e1a',
    mid: '#162016',
    bottom: '#0f1a0f',
  },

  grid: {
    mainColor: 'rgba(0, 245, 255, 0)',
    subColor: 'rgba(0, 245, 255, 0)',
  },

  zoneTints: {
    nexus: { inner: 'rgba(0, 180, 200, 0.06)', mid: 'rgba(0, 150, 180, 0.03)' },
    base: { inner: 'rgba(120, 30, 30, 0.08)', mid: 'rgba(80, 20, 20, 0.04)' },
  },

  minimap: {
    background: 'rgba(12, 18, 12, 0.92)',
    borderColor: 'rgba(100, 130, 80, 0.6)',
    nexusTint: 'rgba(0, 180, 200, 0.15)',
    baseTint: 'rgba(120, 30, 30, 0.2)',
  },

  decorations: {
    grass: { rBase: 30, gBase: 80, bBase: 20, rRange: 20, gRange: 60, bRange: 15 },
    rock: { grayBase: 40, grayRange: 30 },
    puddle: {
      inner: [30, 80, 120],
      mid: [20, 60, 100],
      outer: [15, 45, 70],
      highlight: [100, 180, 220],
    },
    torch: {
      glowColor: 'rgba(255, 160, 50,',
      glowMidColor: 'rgba(255, 100, 20,',
      poleColor: '#5a4030',
      flameColor: 'rgba(255, 200, 50, 0.8)',
      flameCoreColor: 'rgba(255, 255, 200, 0.9)',
    },
  },

  boundary: {
    treeRatio: 0.7,
    trunk: { rBase: 50, gBase: 30, bBase: 15, range: 20 },
    leaf: {
      colors: [
        { r: 20, g: 80, b: 15, alpha: 0.75 },
        { r: 15, g: 65, b: 12, alpha: 0.7 },
        { r: 25, g: 85, b: 20, alpha: 0.65 },
      ],
    },
    rock: { grayBase: 35, grayRange: 25 },
  },

  ambient: {
    fogColor: 'rgba(200, 220, 230,',
    nexusLightColor: 'rgba(0, 200, 255,',
    baseEmberColor: 'rgba(150, 30, 50,',
  },
};

// ============================================
// 얼음 테마
// ============================================

const ICE_THEME: MapThemeConfig = {
  id: 'ice',
  name: '빙원',
  nameEn: 'Frozen Wasteland',
  description: '눈보라가 몰아치는 얼어붙은 황무지',

  background: {
    top: '#1a1e2e',
    mid: '#141828',
    bottom: '#0f1220',
  },

  grid: {
    mainColor: 'rgba(150, 200, 255, 0)',
    subColor: 'rgba(150, 200, 255, 0)',
  },

  zoneTints: {
    nexus: { inner: 'rgba(255, 180, 80, 0.06)', mid: 'rgba(255, 150, 50, 0.03)' },
    base: { inner: 'rgba(30, 60, 150, 0.08)', mid: 'rgba(20, 40, 120, 0.04)' },
  },

  minimap: {
    background: 'rgba(12, 14, 22, 0.92)',
    borderColor: 'rgba(100, 150, 200, 0.6)',
    nexusTint: 'rgba(255, 180, 80, 0.15)',
    baseTint: 'rgba(30, 60, 150, 0.2)',
  },

  decorations: {
    grass: { rBase: 160, gBase: 180, bBase: 200, rRange: 30, gRange: 30, bRange: 30 },
    rock: { grayBase: 55, grayRange: 25 },
    puddle: {
      inner: [80, 140, 180],
      mid: [60, 120, 170],
      outer: [40, 90, 150],
      highlight: [180, 220, 255],
    },
    torch: {
      glowColor: 'rgba(100, 180, 255,',
      glowMidColor: 'rgba(60, 140, 220,',
      poleColor: '#4a5a6a',
      flameColor: 'rgba(120, 200, 255, 0.8)',
      flameCoreColor: 'rgba(220, 240, 255, 0.9)',
    },
  },

  boundary: {
    treeRatio: 0.6,
    trunk: { rBase: 40, gBase: 35, bBase: 30, range: 15 },
    leaf: {
      colors: [
        { r: 30, g: 70, b: 50, alpha: 0.75 },
        { r: 60, g: 100, b: 80, alpha: 0.7 },
        { r: 180, g: 210, b: 230, alpha: 0.5 },
      ],
    },
    rock: { grayBase: 50, grayRange: 30 },
  },

  ambient: {
    fogColor: 'rgba(180, 200, 230,',
    nexusLightColor: 'rgba(255, 180, 80,',
    baseEmberColor: 'rgba(80, 130, 200,',
  },
};

// ============================================
// 화산 테마
// ============================================

const VOLCANO_THEME: MapThemeConfig = {
  id: 'volcano',
  name: '화산',
  nameEn: 'Volcanic Crater',
  description: '용암이 흐르는 활화산 분화구',

  background: {
    top: '#2a1a10',
    mid: '#201008',
    bottom: '#1a0f08',
  },

  grid: {
    mainColor: 'rgba(255, 100, 30, 0)',
    subColor: 'rgba(255, 100, 30, 0)',
  },

  zoneTints: {
    nexus: { inner: 'rgba(50, 150, 200, 0.06)', mid: 'rgba(30, 120, 180, 0.03)' },
    base: { inner: 'rgba(200, 80, 20, 0.08)', mid: 'rgba(150, 50, 10, 0.04)' },
  },

  minimap: {
    background: 'rgba(20, 12, 8, 0.92)',
    borderColor: 'rgba(180, 100, 50, 0.6)',
    nexusTint: 'rgba(50, 150, 200, 0.15)',
    baseTint: 'rgba(200, 80, 20, 0.2)',
  },

  decorations: {
    grass: { rBase: 80, gBase: 50, bBase: 30, rRange: 30, gRange: 20, bRange: 10 },
    rock: { grayBase: 35, grayRange: 20 },
    puddle: {
      inner: [200, 80, 20],
      mid: [180, 60, 10],
      outer: [140, 40, 5],
      highlight: [255, 180, 50],
    },
    torch: {
      glowColor: 'rgba(255, 120, 30,',
      glowMidColor: 'rgba(255, 80, 10,',
      poleColor: '#3a2a20',
      flameColor: 'rgba(255, 150, 30, 0.8)',
      flameCoreColor: 'rgba(255, 230, 150, 0.9)',
    },
  },

  boundary: {
    treeRatio: 0.15,
    trunk: { rBase: 50, gBase: 25, bBase: 15, range: 15 },
    leaf: {
      colors: [
        { r: 60, g: 35, b: 20, alpha: 0.75 },
        { r: 50, g: 30, b: 15, alpha: 0.7 },
        { r: 70, g: 40, b: 25, alpha: 0.65 },
      ],
    },
    rock: { grayBase: 30, grayRange: 20 },
  },

  ambient: {
    fogColor: 'rgba(180, 100, 50,',
    nexusLightColor: 'rgba(50, 180, 220,',
    baseEmberColor: 'rgba(255, 100, 20,',
  },
};

// ============================================
// 어둠 테마
// ============================================

const SHADOW_THEME: MapThemeConfig = {
  id: 'shadow',
  name: '어둠',
  nameEn: 'Shadow Realm',
  description: '보라빛 안개가 낀 이계의 차원',

  background: {
    top: '#1a102a',
    mid: '#140c22',
    bottom: '#0d0818',
  },

  grid: {
    mainColor: 'rgba(180, 100, 255, 0)',
    subColor: 'rgba(180, 100, 255, 0)',
  },

  zoneTints: {
    nexus: { inner: 'rgba(220, 180, 50, 0.06)', mid: 'rgba(200, 160, 30, 0.03)' },
    base: { inner: 'rgba(100, 20, 150, 0.08)', mid: 'rgba(70, 10, 120, 0.04)' },
  },

  minimap: {
    background: 'rgba(14, 10, 20, 0.92)',
    borderColor: 'rgba(140, 80, 200, 0.6)',
    nexusTint: 'rgba(220, 180, 50, 0.15)',
    baseTint: 'rgba(100, 20, 150, 0.2)',
  },

  decorations: {
    grass: { rBase: 60, gBase: 30, bBase: 80, rRange: 25, gRange: 15, bRange: 30 },
    rock: { grayBase: 30, grayRange: 25 },
    puddle: {
      inner: [80, 30, 140],
      mid: [60, 20, 120],
      outer: [40, 10, 90],
      highlight: [160, 100, 220],
    },
    torch: {
      glowColor: 'rgba(160, 80, 255,',
      glowMidColor: 'rgba(120, 50, 200,',
      poleColor: '#3a2a4a',
      flameColor: 'rgba(180, 120, 255, 0.8)',
      flameCoreColor: 'rgba(230, 200, 255, 0.9)',
    },
  },

  boundary: {
    treeRatio: 0.3,
    trunk: { rBase: 35, gBase: 20, bBase: 45, range: 15 },
    leaf: {
      colors: [
        { r: 40, g: 20, b: 60, alpha: 0.75 },
        { r: 50, g: 25, b: 80, alpha: 0.7 },
        { r: 60, g: 30, b: 100, alpha: 0.65 },
      ],
    },
    rock: { grayBase: 25, grayRange: 20 },
  },

  ambient: {
    fogColor: 'rgba(120, 80, 180,',
    nexusLightColor: 'rgba(220, 180, 50,',
    baseEmberColor: 'rgba(130, 50, 180,',
  },
};

// ============================================
// 내보내기
// ============================================

export const MAP_THEME_CONFIGS: Record<MapTheme, MapThemeConfig> = {
  forest: FOREST_THEME,
  ice: ICE_THEME,
  volcano: VOLCANO_THEME,
  shadow: SHADOW_THEME,
};

export const MAP_THEME_LIST: MapThemeConfig[] = [
  FOREST_THEME,
  ICE_THEME,
  VOLCANO_THEME,
  SHADOW_THEME,
];
