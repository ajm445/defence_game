// 호스트 기반 싱글/멀티플레이 통합 네트워크 타입 정의

import type { HeroClass, SkillType, Buff, PassiveGrowthState, SkillEffect, PendingSkill, Nexus, EnemyBase, EnemyBaseId, UpgradeLevels, RPGGamePhase, BasicAttackEffect, NexusLaserEffect, BossSkillWarning } from '../../src/types/rpg';
import type { UnitType } from '../../src/types/unit';
import type { CharacterStatUpgrades } from '../../src/types/auth';
import type { CoopPlayerInfo } from './rpgNetwork';

// ============================================
// 플레이어 입력 (클라이언트 → 호스트)
// ============================================

export interface PlayerInput {
  playerId: string;
  moveDirection: { x: number; y: number } | null;
  // 클라이언트 실제 위치 (보스 스킬 데미지 계산 시 사용)
  position?: { x: number; y: number };
  skillUsed?: {
    skillSlot: 'Q' | 'W' | 'E';
    targetX: number;
    targetY: number;
  };
  upgradeRequested?: 'attack' | 'speed' | 'hp' | 'attackSpeed' | 'goldRate' | 'range';
  timestamp: number;
}

// ============================================
// 직렬화된 영웅 상태
// ============================================

export interface SerializedHero {
  id: string;
  playerId: string;
  heroClass: HeroClass;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  attack: number;
  attackSpeed: number;
  speed: number;
  range: number;
  gold: number;
  upgradeLevels: UpgradeLevels;
  isDead: boolean;
  reviveTimer: number;
  deathTime?: number;  // 사망 시간 (부활 타이머용)
  facingRight: boolean;
  facingAngle: number;
  buffs: Buff[];
  passiveGrowth: PassiveGrowthState;
  skillCooldowns: {
    Q: number;
    W: number;
    E: number;
  };
  moveDirection: { x: number; y: number } | null;
  // 캐릭터 레벨 (업그레이드 최대 레벨 결정)
  characterLevel: number;
  // 대시 상태 (선택)
  dashState?: {
    startX: number;
    startY: number;
    targetX: number;
    targetY: number;
    progress: number;
    duration: number;
    dirX: number;
    dirY: number;
  };
  // SP 스탯 업그레이드 (hpRegen 등 적용용)
  statUpgrades?: CharacterStatUpgrades;
  // 개인 처치 수 (멀티플레이어용)
  kills: number;
  // 전직 정보
  advancedClass?: string;
  tier?: 1 | 2;
}

// ============================================
// 직렬화된 적 상태
// ============================================

export interface SerializedEnemy {
  id: string;
  type: UnitType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  goldReward: number;
  targetHeroId?: string;
  aggroOnHero: boolean;
  aggroExpireTime?: number;
  fromBase?: EnemyBaseId;
  buffs: Buff[];
  isStunned: boolean;
  stunEndTime?: number;
}

// ============================================
// 직렬화된 게임 상태 (호스트 → 클라이언트)
// ============================================

export interface SerializedGameState {
  gameTime: number;
  gamePhase: RPGGamePhase;
  heroes: SerializedHero[];
  enemies: SerializedEnemy[];
  nexus: Nexus;
  enemyBases: EnemyBase[];
  gold: number;
  upgradeLevels: UpgradeLevels;
  activeSkillEffects: SkillEffect[];
  basicAttackEffects: BasicAttackEffect[];
  nexusLaserEffects: NexusLaserEffect[];
  pendingSkills: PendingSkill[];
  // 보스 스킬 경고
  bossSkillWarnings: BossSkillWarning[];
  // 게임 상태
  running: boolean;
  paused: boolean;
  gameOver: boolean;
  victory: boolean;
  // 스폰 관련
  lastSpawnTime: number;
  // 통계
  stats: {
    totalKills: number;
    totalGoldEarned: number;
    basesDestroyed: number;
    bossesKilled: number;
    timePlayed: number;
  };
}

// ============================================
// 호스트 기반 클라이언트 → 서버 메시지
// ============================================

export type HostBasedClientMessage =
  // 기존 방 관련 메시지는 rpgNetwork.ts에서 유지
  // 게임 상태 브로드캐스트 (호스트만)
  | { type: 'HOST_GAME_STATE_BROADCAST'; state: SerializedGameState }
  // 게임 이벤트 브로드캐스트 (호스트만)
  | { type: 'HOST_GAME_EVENT_BROADCAST'; event: any }
  // 플레이어 입력 (클라이언트 → 서버 → 호스트)
  | { type: 'HOST_PLAYER_INPUT'; input: PlayerInput }
  // 게임 종료 (호스트만)
  | { type: 'HOST_GAME_OVER'; result: any };

// ============================================
// 호스트 기반 서버 → 클라이언트 메시지
// ============================================

export type HostBasedServerMessage =
  // 호스트 기반 게임 시작
  | {
      type: 'COOP_GAME_START_HOST_BASED';
      isHost: boolean;
      playerIndex: number;
      players: CoopPlayerInfo[];
      hostPlayerId: string;
    }
  // 호스트로부터 게임 상태 수신
  | { type: 'COOP_GAME_STATE_FROM_HOST'; state: SerializedGameState }
  // 플레이어 입력 수신 (호스트만 수신)
  | { type: 'COOP_PLAYER_INPUT'; input: PlayerInput }
  // 호스트 변경
  | { type: 'COOP_HOST_CHANGED'; newHostPlayerId: string }
  // 새 호스트 권한 부여
  | { type: 'COOP_YOU_ARE_NOW_HOST' }
  // 재접속 정보
  | {
      type: 'COOP_RECONNECT_INFO';
      hostPlayerId: string;
      isHost: boolean;
      gameState: 'waiting' | 'countdown' | 'playing' | 'ended';
    };

// ============================================
// 멀티플레이 설정
// ============================================

export const HOST_BASED_CONFIG = {
  // 상태 동기화 간격 (ms)
  STATE_SYNC_INTERVAL: 50,  // 20Hz (50ms마다)

  // 입력 처리 간격 (ms)
  INPUT_PROCESS_INTERVAL: 16,  // ~60Hz

  // 보간 설정
  INTERPOLATION: {
    ENABLED: true,
    DELAY: 100,  // 100ms 딜레이로 부드러운 보간
    POSITION_THRESHOLD: 50,  // 위치 차이가 이보다 크면 즉시 보정
    SNAP_THRESHOLD: 200,  // 위치 차이가 이보다 크면 스냅
  },

  // 로컬 예측 설정
  LOCAL_PREDICTION: {
    ENABLED: true,
    MAX_PREDICTION_TIME: 200,  // 최대 예측 시간 (ms)
  },

  // 최대 플레이어 수
  MAX_PLAYERS: 4,
  MIN_PLAYERS: 1,
} as const;

// ============================================
// 멀티플레이 상태 (클라이언트용)
// ============================================

export interface MultiplayerState {
  isMultiplayer: boolean;
  isHost: boolean;
  roomCode: string | null;
  roomId: string | null;
  hostPlayerId: string | null;
  myPlayerId: string | null;
  myHeroId: string | null;
  // 다른 플레이어 정보
  players: CoopPlayerInfo[];
  // 원격 입력 큐 (호스트용)
  remoteInputQueue: PlayerInput[];
  // 연결 상태
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'in_lobby' | 'countdown' | 'in_game' | 'post_game';
  // 카운트다운
  countdown: number | null;
  // 방 설정 (로비 복귀 시 유지)
  roomIsPrivate?: boolean;
  roomDifficulty?: string;
}

// 초기 멀티플레이 상태
export const initialMultiplayerState: MultiplayerState = {
  isMultiplayer: false,
  isHost: false,
  roomCode: null,
  roomId: null,
  hostPlayerId: null,
  myPlayerId: null,
  myHeroId: null,
  players: [],
  remoteInputQueue: [],
  connectionState: 'disconnected',
  countdown: null,
  roomIsPrivate: false,
  roomDifficulty: 'easy',
};

// ============================================
// 유틸리티 타입
// ============================================

// 영웅 상태 직렬화 함수 타입
export type SerializeHero = (hero: any) => SerializedHero;

// 게임 상태 직렬화 함수 타입
export type SerializeGameState = () => SerializedGameState;

// 게임 상태 역직렬화 함수 타입
export type DeserializeGameState = (state: SerializedGameState) => void;
