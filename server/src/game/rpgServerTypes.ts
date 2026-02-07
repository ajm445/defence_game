/**
 * 서버 게임 타입 정의
 */

import type {
  RPGEnemy,
  UpgradeLevels,
  RPGGamePhase,
  SkillEffect,
  PendingSkill,
  BasicAttackEffect,
  NexusLaserEffect,
  BossSkillWarning,
  BossSkillExecutedEffect,
  DamageNumber,
  Skill,
  EnemyBaseId,
} from '../../../src/types/rpg';
import type { SerializedHero } from '../../../shared/types/hostBasedNetwork';

// 서버 내부용 넥서스 타입
export interface ServerNexus {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  laserCooldown: number;
}

// 서버 내부용 적 기지 타입
export interface ServerEnemyBase {
  id: EnemyBaseId;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  destroyed: boolean;
  attackers: Set<string>;
}

// 서버 내부용 영웅 타입
export interface ServerHero extends Omit<SerializedHero, 'skills'> {
  config: {
    name: string;
    cost: Record<string, number>;
    hp: number;
    attack: number;
    attackSpeed: number;
    speed: number;
    range: number;
    type: string;
  };
  attackCooldown: number;
  team: 'player';
  skills: Skill[];
  // 스킬 직접 참조 캐시 (find 호출 제거용)
  _skillQ: Skill;
  _skillW: Skill;
  _skillE: Skill;
  goldAccumulator: number;
  // 다크나이트 어둠의 칼날 토글 상태
  darkBladeActive?: boolean;
  darkBladeLastToggleOff?: number;
  darkBladeTickTimer?: number;
}

// 서버 게임 상태
export interface ServerGameState {
  gameTime: number;
  gamePhase: RPGGamePhase;
  heroes: Map<string, ServerHero>;
  enemies: RPGEnemy[];
  nexus: ServerNexus;
  enemyBases: ServerEnemyBase[];
  gold: number;
  upgradeLevels: UpgradeLevels;
  activeSkillEffects: SkillEffect[];
  basicAttackEffects: BasicAttackEffect[];
  nexusLaserEffects: NexusLaserEffect[];
  pendingSkills: PendingSkill[];
  bossSkillWarnings: BossSkillWarning[];
  bossSkillExecutedEffects: BossSkillExecutedEffect[];
  damageNumbers: DamageNumber[];
  running: boolean;
  paused: boolean;
  gameOver: boolean;
  victory: boolean;
  lastSpawnTime: number;
  stats: {
    totalKills: number;
    totalGoldEarned: number;
    basesDestroyed: number;
    bossesKilled: number;
    timePlayed: number;
  };
  goldAccumulator: number;
  nexusLaserCooldown: number;
  // Date.now() 틱당 1회 캐시
  currentTickTimestamp: number;
}

// 게임 결과 타입
export interface GameResult {
  victory: boolean;
  stats: {
    totalKills: number;
    totalGoldEarned: number;
    basesDestroyed: number;
    bossesKilled: number;
    timePlayed: number;
  };
}
