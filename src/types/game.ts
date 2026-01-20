import { Resources, ResourceNode } from './resource';
import { Unit, UnitType } from './unit';

export interface Position {
  x: number;
  y: number;
}

export interface Camera extends Position {
  zoom: number;
}

export interface Base extends Position {
  hp: number;
  maxHp: number;
  upgradeLevel?: number; // 업그레이드 레벨 (0부터 시작, 멀티플레이어 호환을 위해 선택적)
}

export interface Wall extends Position {
  id: string;
  hp: number;
  maxHp: number;
  createdAt: number; // 생성 시간 (게임 시간 기준)
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
  spawnCooldowns: Partial<Record<UnitType, number>>; // 유닛별 소환 쿨타임 (남은 시간)
  phase: GamePhase; // 현재 게임 페이즈 (극악 난이도용)
  bossSpawned: boolean; // 보스 소환 여부
}

export type GameScreen = 'menu' | 'modeSelect' | 'difficultySelect' | 'lobby' | 'countdown' | 'game' | 'gameover' | 'paused' | 'rpgClassSelect';

export type GameMode = 'ai' | 'multiplayer' | 'tutorial' | 'rpg';

export type AIDifficulty = 'easy' | 'normal' | 'hard' | 'nightmare' | 'bosstest';

export type GamePhase = 1 | 2; // 1: 일반, 2: 보스 페이즈

export interface AIDifficultyConfig {
  name: string;
  description: string;
  goldPerSecond: number;
  actionInterval: number;
  actionChance: number;
  minSupportUnits: number;
  goldminerChance: number;
  knightChance: number;
  archerChance: number;
  gathererChance: number;
  minerChance: number;
  healerChance: number;
  mageChance: number;
  initialGold: number;
  enemyBaseHp: number;
  // 다중 유닛 소환 설정 (어려움 난이도)
  maxUnitsPerAction: number; // 한 번에 소환 가능한 최대 유닛 수
  // 대량 발생 이벤트 설정
  massSpawnEnabled: boolean;
  massSpawnStartTime: number; // 첫 대량 발생 시간 (초, 게임 시작 후)
  massSpawnInterval: number; // 대량 발생 주기 (초, 0이면 1회만)
  massSpawnUnits: UnitType[]; // 대량 발생 시 소환할 유닛 목록
}

export interface GameResult {
  victory: boolean;
}
