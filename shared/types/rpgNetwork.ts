// RPG 협동 모드 네트워크 타입 정의

import type { HeroClass, SkillType, Buff, PassiveGrowthState, SkillEffect, PendingSkill } from '../../src/types/rpg';
import type { UnitType } from '../../src/types/unit';
import type { Position } from '../../src/types/game';

// ============================================
// 협동 모드 설정
// ============================================

export const COOP_CONFIG = {
  MAX_PLAYERS: 4,
  MIN_PLAYERS: 2,
  COUNTDOWN_SECONDS: 3,
  STATE_SYNC_INTERVAL: 50,  // 50ms (20Hz)
  GAME_LOOP_FPS: 60,

  // 부활 시스템
  REVIVE: {
    BASE_TIME: 10,           // 기본 10초
    TIME_PER_WAVE: 2,        // 웨이브당 +2초
    MAX_TIME: 30,            // 최대 30초
    REVIVE_HP_PERCENT: 0.5,  // HP 50%로 부활
    SPAWN_OFFSET: 100,       // 아군 근처 100px 내 랜덤 위치
  },

  // 난이도 스케일링 (플레이어 수에 따른 적 체력 배율)
  DIFFICULTY_SCALING: {
    1: 1.0,
    2: 1.5,
    3: 2.0,
    4: 2.5,
  } as Record<number, number>,

  // 버프 공유
  BUFF_SHARE: {
    KNIGHT_HP_REGEN_RANGE: 150,    // 기사 HP 재생 공유 범위
    KNIGHT_HP_REGEN_RATIO: 0.5,    // 공유 시 50%만 적용
    WARRIOR_BERSERKER_RANGE: 200,  // 전사 광전사 버프 공유 범위
    WARRIOR_BERSERKER_ATK_BONUS: 0.2, // 공유 시 공격력 20% 증가
  },

  // 어그로 시스템
  AGGRO: {
    KNIGHT_BONUS: 2.0,          // 기사에게 어그로 보너스 x2
    LOW_HP_THRESHOLD: 0.3,      // HP 30% 미만 시
    LOW_HP_PRIORITY_BONUS: 1.5, // 낮은 HP 우선순위 보너스
    CURRENT_TARGET_BONUS: 1.2,  // 현재 타겟 유지 보너스
  },

  // 경험치 분배
  EXP_SHARE: {
    DEAD_PLAYER_RATIO: 0.5,  // 죽은 플레이어 경험치 50%
  },
} as const;

// ============================================
// 플레이어 정보
// ============================================

export interface CoopPlayerInfo {
  id: string;
  name: string;
  heroClass: HeroClass;
  isHost: boolean;
  isReady: boolean;
  connected: boolean;
}

// ============================================
// 영웅 네트워크 상태
// ============================================

export interface NetworkCoopHero {
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
  level: number;
  exp: number;
  expToNextLevel: number;
  isDead: boolean;
  reviveTimer: number;  // 부활까지 남은 시간 (초)
  facingRight: boolean;
  facingAngle: number;
  buffs: Buff[];
  passiveGrowth: PassiveGrowthState;
  skillCooldowns: {
    Q: number;
    W: number;
    E: number;
  };
  moveDirection: { x: number; y: number } | null;  // 이동 방향 (정규화됨)
}

// ============================================
// 적 네트워크 상태
// ============================================

export interface NetworkCoopEnemy {
  id: string;
  type: UnitType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  expReward: number;
  targetHeroId?: string;  // 현재 타겟 영웅 ID
  buffs: Buff[];
}

// ============================================
// 게임 상태
// ============================================

export interface RPGCoopGameState {
  // 게임 진행
  running: boolean;
  paused: boolean;
  gameOver: boolean;
  victory: boolean;
  gameTime: number;

  // 웨이브
  currentWave: number;
  waveInProgress: boolean;
  enemiesRemaining: number;

  // 엔티티
  heroes: NetworkCoopHero[];
  enemies: NetworkCoopEnemy[];

  // 플레이어 수 (난이도 스케일링용)
  playerCount: number;

  // 스킬 효과 (렌더링용)
  activeSkillEffects: SkillEffect[];

  // 보류 중인 스킬 (운석 등)
  pendingSkills: PendingSkill[];
}

// ============================================
// 게임 이벤트
// ============================================

export type RPGCoopGameEvent =
  // 영웅 관련
  | { event: 'HERO_MOVED'; heroId: string; x: number; y: number }
  | { event: 'HERO_DAMAGED'; heroId: string; damage: number; hp: number; attackerId: string }
  | { event: 'HERO_HEALED'; heroId: string; heal: number; hp: number }
  | { event: 'HERO_DIED'; heroId: string; reviveTime: number }
  | { event: 'HERO_REVIVED'; heroId: string; x: number; y: number; hp: number }
  | { event: 'HERO_LEVEL_UP'; heroId: string; level: number; stats: { hp: number; attack: number; speed: number } }
  | { event: 'HERO_EXP_GAINED'; heroId: string; exp: number; totalExp: number }
  | { event: 'HERO_BUFF_APPLIED'; heroId: string; buff: Buff }
  | { event: 'HERO_BUFF_REMOVED'; heroId: string; buffType: string }
  // 스킬 관련
  | { event: 'SKILL_USED'; heroId: string; skillType: SkillType; x: number; y: number; direction?: { x: number; y: number } }
  | { event: 'SKILL_EFFECT_STARTED'; effect: SkillEffect }
  | { event: 'SKILL_EFFECT_ENDED'; effectId: string }
  // 적 관련
  | { event: 'ENEMY_SPAWNED'; enemy: NetworkCoopEnemy }
  | { event: 'ENEMY_DAMAGED'; enemyId: string; damage: number; hp: number; attackerId: string }
  | { event: 'ENEMY_DIED'; enemyId: string; expReward: number; killerHeroId: string }
  | { event: 'ENEMY_TARGET_CHANGED'; enemyId: string; targetHeroId: string | null }
  | { event: 'ENEMY_STUNNED'; enemyId: string; duration: number }
  // 버프 공유
  | { event: 'BUFF_SHARED'; sourceHeroId: string; targetHeroIds: string[]; buffType: string; value: number };

// ============================================
// 게임 결과
// ============================================

export interface RPGCoopGameResult {
  victory: boolean;
  waveReached: number;
  totalGameTime: number;
  playerResults: {
    playerId: string;
    playerName: string;
    heroClass: HeroClass;
    level: number;
    kills: number;
    deaths: number;
    damageDealt: number;
    damageTaken: number;
    expGained: number;
  }[];
}

// ============================================
// 클라이언트 → 서버 메시지
// ============================================

export type CoopClientMessage =
  // 방 관련
  | { type: 'CREATE_COOP_ROOM'; playerName: string; heroClass: HeroClass }
  | { type: 'JOIN_COOP_ROOM'; roomCode: string; playerName: string; heroClass: HeroClass }
  | { type: 'LEAVE_COOP_ROOM' }
  | { type: 'COOP_READY' }
  | { type: 'COOP_UNREADY' }
  | { type: 'CHANGE_COOP_CLASS'; heroClass: HeroClass }
  | { type: 'START_COOP_GAME' }  // 호스트 전용
  | { type: 'KICK_COOP_PLAYER'; playerId: string }  // 호스트 전용
  // 게임 액션
  | { type: 'COOP_HERO_MOVE'; direction: { x: number; y: number } | null }  // null = 이동 중지
  | { type: 'COOP_USE_SKILL'; skillType: SkillType; targetX: number; targetY: number };

// ============================================
// 서버 → 클라이언트 메시지
// ============================================

export type CoopServerMessage =
  // 방 관련
  | { type: 'COOP_ROOM_CREATED'; roomCode: string; roomId: string }
  | { type: 'COOP_ROOM_JOINED'; roomId: string; players: CoopPlayerInfo[]; yourIndex: number }
  | { type: 'COOP_PLAYER_JOINED'; player: CoopPlayerInfo }
  | { type: 'COOP_PLAYER_LEFT'; playerId: string }
  | { type: 'COOP_PLAYER_READY'; playerId: string; isReady: boolean }
  | { type: 'COOP_PLAYER_CLASS_CHANGED'; playerId: string; heroClass: HeroClass }
  | { type: 'COOP_PLAYER_KICKED'; playerId: string; reason: string }
  | { type: 'COOP_ROOM_ERROR'; message: string }
  // 게임 시작
  | { type: 'COOP_GAME_COUNTDOWN'; seconds: number }
  | { type: 'COOP_GAME_START'; state: RPGCoopGameState; yourHeroId: string }
  // 게임 진행
  | { type: 'COOP_GAME_STATE'; state: RPGCoopGameState }
  | { type: 'COOP_GAME_EVENT'; event: RPGCoopGameEvent }
  | { type: 'COOP_WAVE_START'; waveNumber: number; enemyCount: number }
  | { type: 'COOP_WAVE_CLEAR'; waveNumber: number; nextWaveIn: number }
  | { type: 'COOP_GAME_OVER'; result: RPGCoopGameResult }
  // 연결 상태
  | { type: 'COOP_PLAYER_DISCONNECTED'; playerId: string }
  | { type: 'COOP_PLAYER_RECONNECTED'; playerId: string };

// ============================================
// 연결 상태
// ============================================

export type CoopConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'in_coop_lobby'      // 협동 방에서 대기 중
  | 'coop_ready'         // 모든 플레이어 준비 완료
  | 'coop_countdown'     // 게임 시작 카운트다운
  | 'coop_in_game';      // 협동 게임 진행 중

// ============================================
// 방 정보
// ============================================

export interface CoopRoomInfo {
  roomId: string;
  roomCode: string;
  isHost: boolean;
  players: CoopPlayerInfo[];
  myIndex: number;
}
