// RPG 협동 모드 네트워크 타입 정의

import type { HeroClass, SkillType, Buff, PassiveGrowthState, SkillEffect, PendingSkill, Nexus, EnemyBase, EnemyBaseId, UpgradeLevels, RPGGamePhase } from '../../src/types/rpg';
import type { UnitType } from '../../src/types/unit';
import type { Position } from '../../src/types/game';
import type { CharacterStatUpgrades } from '../../src/types/auth';
import type { SerializedGameState, PlayerInput, HostBasedClientMessage, HostBasedServerMessage } from './hostBasedNetwork';
import type { FriendClientMessage, FriendServerMessage } from './friendNetwork';

// Re-export friend network types for convenience
export * from './friendNetwork';

// ============================================
// 협동 모드 설정
// ============================================

export const COOP_CONFIG = {
  MAX_PLAYERS: 4,
  MIN_PLAYERS: 1,  // 호스트 기반 통합 시스템 - 1인도 시작 가능
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
  characterLevel?: number;  // 캐릭터(클래스) 레벨 - 업그레이드 최대 레벨 결정
  statUpgrades?: CharacterStatUpgrades;  // SP 스탯 업그레이드 - 초기 스탯 보너스 적용
  advancedClass?: string;   // 전직 직업 (버서커, 가디언 등)
  tier?: 1 | 2;             // 전직 단계 (1: 1차 전직, 2: 2차 강화)
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
  gold: number;
  upgradeLevels: UpgradeLevels;
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
  // 인게임 레벨/경험치 (UI 표시용)
  level: number;
  exp: number;
  expToNextLevel: number;
  // 전직 정보
  advancedClass?: string;  // 전직 직업
  tier?: 1 | 2;            // 전직 단계
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
  goldReward: number;
  targetHeroId?: string;  // 현재 타겟 영웅 ID
  aggroOnHero: boolean;   // 영웅에게 어그로가 끌렸는지
  fromBase?: EnemyBaseId;  // 스폰된 기지
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
  gamePhase: RPGGamePhase;  // 'playing' | 'boss_phase' | 'victory' | 'defeat'

  // 웨이브 (레거시 호환용)
  currentWave: number;
  waveInProgress: boolean;
  enemiesRemaining: number;

  // 넥서스 디펜스 시스템
  nexus: Nexus | null;
  enemyBases: EnemyBase[];
  gold: number;  // 공유 골드 (팀 전체)

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
  basesDestroyed: number;
  bossesKilled: number;
  totalGameTime: number;
  totalGoldEarned: number;
  playerResults: {
    playerId: string;
    playerName: string;
    heroClass: HeroClass;
    kills: number;
    deaths: number;
    damageDealt: number;
    damageTaken: number;
    goldEarned: number;
  }[];
}

// ============================================
// 클라이언트 → 서버 메시지
// ============================================

export type CoopClientMessage =
  // 사용자 인증
  | { type: 'USER_LOGIN'; userId: string; nickname: string; isGuest: boolean; level?: number }
  | { type: 'USER_LOGOUT'; userId: string; nickname: string }
  // 방 관련
  | { type: 'CREATE_COOP_ROOM'; playerName: string; heroClass: HeroClass; characterLevel?: number; statUpgrades?: CharacterStatUpgrades; isPrivate?: boolean; advancedClass?: string; tier?: 1 | 2 }
  | { type: 'JOIN_COOP_ROOM'; roomCode: string; playerName: string; heroClass: HeroClass; characterLevel?: number; statUpgrades?: CharacterStatUpgrades; advancedClass?: string; tier?: 1 | 2 }
  | { type: 'JOIN_COOP_ROOM_BY_ID'; roomId: string; playerName: string; heroClass: HeroClass; characterLevel?: number; statUpgrades?: CharacterStatUpgrades; advancedClass?: string; tier?: 1 | 2 }
  | { type: 'GET_COOP_ROOM_LIST' }
  | { type: 'LEAVE_COOP_ROOM' }
  | { type: 'COOP_READY' }
  | { type: 'COOP_UNREADY' }
  | { type: 'CHANGE_COOP_CLASS'; heroClass: HeroClass; characterLevel?: number; statUpgrades?: CharacterStatUpgrades; advancedClass?: string; tier?: 1 | 2 }
  | { type: 'UPDATE_COOP_ROOM_SETTINGS'; isPrivate?: boolean; difficulty?: string }  // 호스트 전용 - 방 설정 변경
  | { type: 'START_COOP_GAME' }  // 호스트 전용
  | { type: 'KICK_COOP_PLAYER'; playerId: string }  // 호스트 전용
  // 게임 액션 (레거시)
  | { type: 'COOP_HERO_MOVE'; direction: { x: number; y: number } | null }  // null = 이동 중지
  | { type: 'COOP_USE_SKILL'; skillType: SkillType; targetX: number; targetY: number }
  // 넥서스 디펜스 액션
  | { type: 'COOP_UPGRADE_HERO_STAT'; upgradeType: 'attack' | 'speed' | 'hp' | 'goldRate' }
  // 호스트 기반 메시지
  | { type: 'HOST_GAME_STATE_BROADCAST'; state: SerializedGameState }
  | { type: 'HOST_GAME_EVENT_BROADCAST'; event: any }
  | { type: 'HOST_PLAYER_INPUT'; input: PlayerInput }
  | { type: 'HOST_GAME_OVER'; result: any }
  // 게임 종료 후 로비 관련
  | { type: 'RETURN_TO_LOBBY' }
  | { type: 'RESTART_COOP_GAME' }
  | { type: 'DESTROY_COOP_ROOM' }
  // 일시정지 (호스트 전용)
  | { type: 'PAUSE_COOP_GAME' }
  | { type: 'RESUME_COOP_GAME' }
  // 게임 중단 (호스트 전용)
  | { type: 'STOP_COOP_GAME' }
  // 친구 시스템 메시지
  | FriendClientMessage;

// ============================================
// 서버 → 클라이언트 메시지
// ============================================

export type CoopServerMessage =
  // 방 관련
  | { type: 'COOP_ROOM_CREATED'; roomCode: string; roomId: string; isPrivate?: boolean; difficulty?: string }
  | { type: 'COOP_ROOM_JOINED'; roomId: string; roomCode: string; players: CoopPlayerInfo[]; yourIndex: number; isPrivate?: boolean; difficulty?: string }
  | { type: 'COOP_ROOM_LIST'; rooms: WaitingCoopRoomInfo[] }
  | { type: 'COOP_PLAYER_JOINED'; player: CoopPlayerInfo }
  | { type: 'COOP_PLAYER_LEFT'; playerId: string }
  | { type: 'COOP_PLAYER_READY'; playerId: string; isReady: boolean }
  | { type: 'COOP_PLAYER_CLASS_CHANGED'; playerId: string; heroClass: HeroClass; characterLevel?: number; advancedClass?: string; tier?: 1 | 2 }
  | { type: 'COOP_PLAYER_KICKED'; playerId: string; reason: string }
  | { type: 'COOP_ROOM_SETTINGS_CHANGED'; isPrivate: boolean; difficulty: string }  // 방 설정 변경 알림
  | { type: 'COOP_ROOM_ERROR'; message: string }
  // 게임 시작 (레거시)
  | { type: 'COOP_GAME_COUNTDOWN'; seconds: number }
  | { type: 'COOP_GAME_START'; state: RPGCoopGameState; yourHeroId: string }
  // 게임 진행 (레거시)
  | { type: 'COOP_GAME_STATE'; state: RPGCoopGameState }
  | { type: 'COOP_GAME_EVENT'; event: RPGCoopGameEvent }
  | { type: 'COOP_WAVE_START'; waveNumber: number; enemyCount: number }
  | { type: 'COOP_WAVE_CLEAR'; waveNumber: number; nextWaveIn: number }
  | { type: 'COOP_GAME_OVER'; result: RPGCoopGameResult }
  // 연결 상태
  | { type: 'COOP_PLAYER_DISCONNECTED'; playerId: string }
  | { type: 'COOP_PLAYER_RECONNECTED'; playerId: string }
  // 호스트 기반 메시지
  | { type: 'COOP_GAME_START_HOST_BASED'; isHost: boolean; playerIndex: number; players: CoopPlayerInfo[]; hostPlayerId: string; difficulty?: string }
  | { type: 'COOP_GAME_STATE_FROM_HOST'; state: SerializedGameState }
  | { type: 'COOP_PLAYER_INPUT'; input: PlayerInput }
  | { type: 'COOP_HOST_CHANGED'; newHostPlayerId: string }
  | { type: 'COOP_YOU_ARE_NOW_HOST' }
  | { type: 'COOP_RECONNECT_INFO'; hostPlayerId: string; isHost: boolean; gameState: 'waiting' | 'countdown' | 'playing' | 'ended' }
  // 일시정지
  | { type: 'COOP_GAME_PAUSED' }
  | { type: 'COOP_GAME_RESUMED' }
  // 게임 중단 (호스트가 중단)
  | { type: 'COOP_GAME_STOPPED' }
  // 친구 시스템 메시지
  | FriendServerMessage;

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

// ============================================
// 대기방 정보 (목록 조회용)
// ============================================

export interface WaitingCoopRoomInfo {
  roomId: string;
  roomCode: string;
  hostName: string;
  hostHeroClass: HeroClass;
  hostClassLevel: number;  // 호스트가 선택한 직업의 레벨
  hostAdvancedClass?: string;  // 호스트의 전직 직업
  hostTier?: 1 | 2;  // 호스트의 전직 단계
  playerCount: number;
  maxPlayers: number;
  createdAt: number;
  isPrivate: boolean;
  isInGame?: boolean;  // 게임 진행 중인 방
  difficulty?: string;  // 난이도 ('easy' | 'normal' | 'hard' | 'extreme')
}
