import { v4 as uuidv4 } from 'uuid';
import { players, sendToPlayer } from '../state/players';
import { removeRoom } from '../websocket/MessageHandler';
import type {
  NetworkGameState,
  NetworkUnit,
  NetworkMine,
  NetworkResourceNode,
  Resources,
  PlayerState,
  UnitType,
  PlayerSide,
  GAME_CONFIG,
} from '../../../shared/types/game';
import type { GameEvent, GameResult } from '../../../shared/types/network';

// 서버측 게임 설정 (클라이언트와 동일하게 유지)
const CONFIG = {
  MAP_WIDTH: 4000,
  MAP_HEIGHT: 2400,
  GAME_DURATION: 600, // 10분
  GOLD_PER_SECOND: 4,
  BASE_HP: 1000,
  LEFT_BASE_X: 200,
  RIGHT_BASE_X: 4000 - 200, // MAP_WIDTH - 200
  BASE_Y: 2400 / 2, // MAP_HEIGHT / 2

  UNITS: {
    melee: {
      name: '검병',
      cost: { gold: 50 },
      hp: 100,
      attack: 15,
      attackSpeed: 1,
      speed: 1.5,
      range: 30,
      type: 'combat',
      spawnCooldown: 1.5,
    },
    ranged: {
      name: '궁수',
      cost: { gold: 80, wood: 10 },
      hp: 50,
      attack: 25,
      attackSpeed: 2,
      speed: 1.6,
      range: 150,
      type: 'combat',
      spawnCooldown: 3,
    },
    knight: {
      name: '기사',
      cost: { gold: 120, wood: 20, stone: 30 },
      hp: 300,
      attack: 10,
      attackSpeed: 1,
      speed: 1.3,
      range: 35,
      type: 'combat',
      spawnCooldown: 5,
    },
    woodcutter: {
      name: '나무꾼',
      cost: { gold: 30 },
      hp: 60,
      attack: 5,
      range: 25,
      gatherRate: 1,
      speed: 1.5,
      type: 'support',
      resource: 'wood',
      spawnCooldown: 1,
    },
    miner: {
      name: '광부',
      cost: { gold: 40, wood: 5 },
      hp: 70,
      attack: 6,
      range: 25,
      gatherRate: 1.5,
      speed: 1.5,
      type: 'support',
      resource: 'stone',
      spawnCooldown: 1,
    },
    gatherer: {
      name: '채집꾼',
      cost: { gold: 50 },
      hp: 50,
      attack: 3,
      range: 20,
      gatherRate: 1.5,
      speed: 1.5,
      type: 'support',
      resource: 'herb',
      spawnCooldown: 1,
    },
    goldminer: {
      name: '금광부',
      cost: { gold: 100, wood: 20 },
      hp: 70,
      attack: 4,
      range: 25,
      gatherRate: 1.5,
      speed: 1.5,
      type: 'support',
      resource: 'gold',
      spawnCooldown: 2,
    },
    healer: {
      name: '힐러',
      cost: { gold: 70, herb: 15 },
      hp: 60,
      attack: 3,
      attackSpeed: 1,
      speed: 1.6,
      range: 25,
      type: 'support',
      healRate: 5,
      healRange: 130,
      spawnCooldown: 5,
    },
    mage: {
      name: '마법사',
      cost: { gold: 150, wood: 50, crystal: 10 },
      hp: 40,
      attack: 50,
      attackSpeed: 2.5,
      speed: 1.6,
      range: 200,
      type: 'combat',
      aoeRadius: 50,
      spawnCooldown: 5,
    },
  } as Record<string, any>,

  MINE_COST: { wood: 30, stone: 15 },
  MINE_DAMAGE: 80,
  MINE_AOE_RADIUS: 80,
  MINE_TRIGGER_RADIUS: 50,
  MINE_MAX_PER_PLAYER: 5,
  BASE_UPGRADE: {
    BASE_COST: { gold: 100, wood: 50, stone: 50 }, // 기본 비용 (레벨 1 이상)
    COST_MULTIPLIER: 1.5, // 레벨당 비용 증가 배율
    HP_BONUS: 200, // 업그레이드당 HP 증가량
    GOLD_BONUS: 1, // 업그레이드당 골드 수입 증가량
    MAX_LEVEL: 5, // 최대 업그레이드 레벨
  },
  HERB_SELL_COST: 30,
  HERB_SELL_GOLD: 70,

  // 자원 재생성 시간 (초)
  RESOURCE_RESPAWN: {
    tree: 40,
    rock: 60,
    herb: 30,
    crystal: 180,
    goldmine: 40,
  } as Record<string, number>,
};

// 업그레이드 레벨에 따른 비용 계산
// 레벨 0→1: 골드만 필요 (150)
// 레벨 1→2 이상: 골드 + 나무 + 돌 필요
function getUpgradeCost(level: number): { gold: number; wood?: number; stone?: number } {
  if (level === 0) {
    // 첫 번째 업그레이드: 골드만 150
    return { gold: 150 };
  }

  // 두 번째 업그레이드부터: 복합 자원 필요
  const base = CONFIG.BASE_UPGRADE.BASE_COST;
  const multiplier = Math.pow(CONFIG.BASE_UPGRADE.COST_MULTIPLIER, level - 1);
  return {
    gold: Math.floor(base.gold * multiplier),
    wood: Math.floor(base.wood * multiplier),
    stone: Math.floor(base.stone * multiplier),
  };
}

interface ServerUnit extends NetworkUnit {
  attack: number;
  attackSpeed: number; // 공격속도 (초)
  speed: number;
  range: number;
  attackCooldown: number;
  targetId?: string;
  attackerId?: string; // 이 유닛을 공격한 적의 ID (반격용)
  gatherRate?: number;
  resourceType?: string;
  unitType: string;
  healRate?: number; // 힐러: 초당 회복량
  healRange?: number; // 힐러: 회복 사거리
  aoeRadius?: number; // 마법사: 범위 공격 반경
  lastEffectTime?: number; // 마지막 이펙트 이벤트 전송 시간 (쿨타임용)
}

interface ServerMine extends NetworkMine {}

export class GameRoom {
  public id: string;
  private leftPlayerId: string;
  private rightPlayerId: string;
  private leftReady: boolean = false;
  private rightReady: boolean = false;

  private gameState: 'waiting' | 'countdown' | 'playing' | 'ended' = 'waiting';
  private gameTime: number = 0;
  private gameLoopInterval: NodeJS.Timeout | null = null;
  private countdownTimer: NodeJS.Timeout | null = null;

  private leftResources: Resources = { gold: 100, wood: 0, stone: 0, herb: 0, crystal: 0 };
  private rightResources: Resources = { gold: 100, wood: 0, stone: 0, herb: 0, crystal: 0 };

  private leftBaseHp: number = CONFIG.BASE_HP;
  private rightBaseHp: number = CONFIG.BASE_HP;
  private leftMaxBaseHp: number = CONFIG.BASE_HP;
  private rightMaxBaseHp: number = CONFIG.BASE_HP;
  private leftUpgradeLevel: number = 0;
  private rightUpgradeLevel: number = 0;
  private leftGoldPerSecond: number = CONFIG.GOLD_PER_SECOND;
  private rightGoldPerSecond: number = CONFIG.GOLD_PER_SECOND;

  private leftSpawnCooldowns: Partial<Record<UnitType, number>> = {};
  private rightSpawnCooldowns: Partial<Record<UnitType, number>> = {};

  private units: ServerUnit[] = [];
  private mines: ServerMine[] = [];
  private resourceNodes: NetworkResourceNode[] = [];

  private lastGoldTick: number = 0;
  private lastFullSync: number = 0;

  constructor(id: string, leftPlayerId: string, rightPlayerId: string) {
    this.id = id;
    this.leftPlayerId = leftPlayerId;
    this.rightPlayerId = rightPlayerId;

    this.initializeResourceNodes();
  }

  private initializeResourceNodes(): void {
    // 나무 노드 (각 진영 10개씩, 총 20개)
    const treePositions = [
      // 왼쪽 (플레이어 측) - 10개
      { x: 400, y: 250 }, { x: 450, y: 500 }, { x: 400, y: 750 },
      { x: 450, y: 1000 }, { x: 400, y: 1250 }, { x: 450, y: 1500 },
      { x: 400, y: 1750 }, { x: 450, y: 2000 }, { x: 650, y: 400 }, { x: 650, y: 2000 },
      // 오른쪽 (적 측) - 10개
      { x: 3600, y: 250 }, { x: 3550, y: 500 }, { x: 3600, y: 750 },
      { x: 3550, y: 1000 }, { x: 3600, y: 1250 }, { x: 3550, y: 1500 },
      { x: 3600, y: 1750 }, { x: 3550, y: 2000 }, { x: 3350, y: 400 }, { x: 3350, y: 2000 },
    ];

    treePositions.forEach((pos, i) => {
      this.resourceNodes.push({
        id: `tree_${i}`,
        type: 'tree',
        x: pos.x,
        y: pos.y,
        amount: 100,
        maxAmount: 100,
      });
    });

    // 바위 노드 (맵 중앙 14개)
    const rockPositions = [
      { x: 1500, y: 400 }, { x: 1700, y: 600 }, { x: 1900, y: 400 },
      { x: 2100, y: 600 }, { x: 2300, y: 400 }, { x: 2500, y: 600 },
      { x: 2000, y: 1000 }, { x: 2000, y: 1400 },
      { x: 1500, y: 1800 }, { x: 1700, y: 2000 }, { x: 1900, y: 1800 },
      { x: 2100, y: 2000 }, { x: 2300, y: 1800 }, { x: 2500, y: 2000 },
    ];

    rockPositions.forEach((pos, i) => {
      this.resourceNodes.push({
        id: `rock_${i}`,
        type: 'rock',
        x: pos.x,
        y: pos.y,
        amount: 80,
        maxAmount: 80,
      });
    });

    // 약초 노드 (20개)
    const herbPositions = [
      // 왼쪽 - 7개
      { x: 550, y: 200 }, { x: 750, y: 450 }, { x: 550, y: 700 },
      { x: 750, y: 950 }, { x: 550, y: 1200 }, { x: 750, y: 1700 }, { x: 550, y: 2150 },
      // 중앙 - 6개
      { x: 1300, y: 300 }, { x: 1600, y: 1200 }, { x: 2000, y: 800 },
      { x: 2400, y: 1200 }, { x: 2700, y: 300 }, { x: 2000, y: 1600 },
      // 오른쪽 - 7개
      { x: 3450, y: 200 }, { x: 3250, y: 450 }, { x: 3450, y: 700 },
      { x: 3250, y: 950 }, { x: 3450, y: 1200 }, { x: 3250, y: 1700 }, { x: 3450, y: 2150 },
    ];

    herbPositions.forEach((pos, i) => {
      this.resourceNodes.push({
        id: `herb_${i}`,
        type: 'herb',
        x: pos.x,
        y: pos.y,
        amount: 50,
        maxAmount: 50,
      });
    });

    // 수정 노드 (맵 중앙 3개 - 유지)
    const crystalPositions = [
      { x: 2000, y: 1000 }, { x: 1900, y: 1200 }, { x: 2100, y: 1200 },
    ];

    crystalPositions.forEach((pos, i) => {
      this.resourceNodes.push({
        id: `crystal_${i}`,
        type: 'crystal',
        x: pos.x,
        y: pos.y,
        amount: 30,
        maxAmount: 30,
      });
    });

    // 광산 노드 (각 진영 5개씩, 총 10개)
    const goldminePositions = [
      // 왼쪽 - 5개
      { x: 350, y: 400 }, { x: 350, y: 750 }, { x: 350, y: 1100 },
      { x: 350, y: 1500 }, { x: 350, y: 1900 },
      // 오른쪽 - 5개
      { x: 3650, y: 400 }, { x: 3650, y: 750 }, { x: 3650, y: 1100 },
      { x: 3650, y: 1500 }, { x: 3650, y: 1900 },
    ];

    goldminePositions.forEach((pos, i) => {
      this.resourceNodes.push({
        id: `goldmine_${i}`,
        type: 'goldmine',
        x: pos.x,
        y: pos.y,
        amount: 80,
        maxAmount: 80,
      });
    });
  }

  public startCountdown(): void {
    this.gameState = 'countdown';
    let countdown = 3;

    this.countdownTimer = setInterval(() => {
      this.broadcast({ type: 'GAME_COUNTDOWN', seconds: countdown });

      if (countdown <= 0) {
        if (this.countdownTimer) {
          clearInterval(this.countdownTimer);
          this.countdownTimer = null;
        }
        this.startGame();
      }
      countdown--;
    }, 1000);
  }

  public setPlayerReady(playerId: string): void {
    if (playerId === this.leftPlayerId) {
      this.leftReady = true;
    } else if (playerId === this.rightPlayerId) {
      this.rightReady = true;
    }
  }

  private startGame(): void {
    this.gameState = 'playing';
    this.gameTime = 0;
    this.lastGoldTick = 0;

    console.log(`게임 시작: Room ${this.id}`);

    // 초기 상태 전송
    const initialState = this.getNetworkGameState();
    this.broadcast({ type: 'GAME_START', state: initialState });

    // 게임 루프 시작 (60fps)
    this.gameLoopInterval = setInterval(() => {
      this.update(1 / 60);
    }, 1000 / 60);
  }

  private update(deltaTime: number): void {
    if (this.gameState !== 'playing') return;

    this.gameTime += deltaTime;

    // 소환 쿨타임 감소
    this.updateSpawnCooldowns(deltaTime);

    // 골드 자동 획득 (1초마다, 업그레이드 레벨에 따라)
    if (Math.floor(this.gameTime) > this.lastGoldTick) {
      this.lastGoldTick = Math.floor(this.gameTime);
      this.leftResources.gold += this.leftGoldPerSecond;
      this.rightResources.gold += this.rightGoldPerSecond;
    }

    // 유닛 업데이트
    this.updateUnits(deltaTime);

    // 지뢰 트리거 체크
    this.checkMineTriggering();

    // 자원 노드 재생성 확인
    this.respawnResourceNodes();

    // 승리 조건 체크
    this.checkWinCondition();

    // 50ms마다 전체 상태 동기화 (더 부드러운 통신)
    if (this.gameTime - this.lastFullSync >= 0.05) {
      this.lastFullSync = this.gameTime;
      this.broadcastState();
    }
  }

  private updateSpawnCooldowns(deltaTime: number): void {
    // 왼쪽 플레이어 쿨타임 감소
    for (const type of Object.keys(this.leftSpawnCooldowns) as UnitType[]) {
      const remaining = (this.leftSpawnCooldowns[type] || 0) - deltaTime;
      if (remaining > 0) {
        this.leftSpawnCooldowns[type] = remaining;
      } else {
        delete this.leftSpawnCooldowns[type];
      }
    }

    // 오른쪽 플레이어 쿨타임 감소
    for (const type of Object.keys(this.rightSpawnCooldowns) as UnitType[]) {
      const remaining = (this.rightSpawnCooldowns[type] || 0) - deltaTime;
      if (remaining > 0) {
        this.rightSpawnCooldowns[type] = remaining;
      } else {
        delete this.rightSpawnCooldowns[type];
      }
    }
  }

  private updateUnits(deltaTime: number): void {
    const unitsToRemove: string[] = [];

    // 회복량 저장 (힐러 처리용)
    const healAmounts: Map<string, number> = new Map();

    for (const unit of this.units) {
      // 쿨다운 감소
      if (unit.attackCooldown > 0) {
        unit.attackCooldown -= deltaTime;
      }

      const config = CONFIG.UNITS[unit.unitType];

      // 유닛 타입별 처리
      if (unit.unitType === 'healer') {
        // 힐러 유닛
        this.updateHealerUnit(unit, deltaTime, healAmounts);
      } else if (unit.unitType === 'mage') {
        // 마법사 유닛 (AOE)
        this.updateMageUnit(unit, deltaTime);
      } else if (config?.type === 'support') {
        // 일반 지원 유닛: 자원 채집 또는 이동
        this.updateSupportUnit(unit, deltaTime);
      } else {
        // 전투 유닛: 적 찾아 공격 또는 기지로 이동
        this.updateCombatUnit(unit, deltaTime);
      }

      // 사망 체크
      if (unit.hp <= 0) {
        unitsToRemove.push(unit.id);
      }
    }

    // 회복량 적용
    for (const [unitId, amount] of healAmounts) {
      const targetUnit = this.units.find(u => u.id === unitId);
      if (targetUnit && targetUnit.hp > 0) {
        targetUnit.hp = Math.min(targetUnit.maxHp, targetUnit.hp + amount);
      }
    }

    // 죽은 유닛 제거
    for (const unitId of unitsToRemove) {
      this.units = this.units.filter(u => u.id !== unitId);
      this.broadcastEvent({ event: 'UNIT_DIED', unitId });
    }
  }

  private updateSupportUnit(unit: ServerUnit, deltaTime: number): void {
    const config = CONFIG.UNITS[unit.unitType];
    if (!config || !config.resource) return;

    // 자원 노드 찾기
    const targetNode = this.findNearestResourceNode(unit, config.resource);

    if (targetNode) {
      const distance = this.getDistance(unit.x, unit.y, targetNode.x, targetNode.y);

      if (distance <= 50) {
        // 자원 채집
        unit.state = 'gathering';
        if (targetNode.amount > 0 && config.gatherRate) {
          const gathered = Math.min(config.gatherRate * deltaTime, targetNode.amount);
          const wasNotDepleted = targetNode.amount > 0;
          targetNode.amount -= gathered;

          // 자원이 고갈되면 시간 기록
          if (wasNotDepleted && targetNode.amount <= 0) {
            targetNode.depletedAt = this.gameTime;
          }

          const resources = unit.side === 'left' ? this.leftResources : this.rightResources;

          // 채집꾼이 크리스탈 노드를 채집하면 크리스탈 획득
          const resourceKey = (config.resource === 'herb' && targetNode.type === 'crystal')
            ? 'crystal'
            : config.resource as keyof Resources;
          resources[resourceKey] += gathered;

          // 약초 채집 시 0.1% 확률로 크리스탈 추가 획득
          if (config.resource === 'herb' && targetNode.type === 'herb' && Math.random() < 0.001) {
            resources.crystal += 1;
          }

          // 채집 이펙트 이벤트 (0.3초 쿨타임)
          const effectCooldown = 0.3;
          if (!unit.lastEffectTime || this.gameTime - unit.lastEffectTime >= effectCooldown) {
            unit.lastEffectTime = this.gameTime;
            this.broadcastEvent({
              event: 'RESOURCE_GATHERED',
              unitId: unit.id,
              unitType: unit.unitType,
              x: unit.x,
              y: unit.y,
            });
          }
        }
      } else {
        // 노드로 이동
        unit.state = 'moving';
        this.moveTowards(unit, targetNode.x, targetNode.y, deltaTime);
      }
    }
  }

  private updateCombatUnit(unit: ServerUnit, deltaTime: number): void {
    // 적 기지 위치
    const enemyBaseX = unit.side === 'left' ? CONFIG.RIGHT_BASE_X : CONFIG.LEFT_BASE_X;
    const distToBase = this.getDistance(unit.x, unit.y, enemyBaseX, CONFIG.BASE_Y);

    const enemies = this.units.filter(u => u.side !== unit.side && u.hp > 0);

    // 0. 반격 대상 확인 (공격받은 경우, 사거리 내에 있을 때만 반격)
    let attacker: ServerUnit | null = null;
    if (unit.attackerId) {
      attacker = enemies.find(e => e.id === unit.attackerId) || null;
    }

    if (attacker) {
      const attackerDist = this.getDistance(unit.x, unit.y, attacker.x, attacker.y);
      if (attackerDist <= unit.range) {
        // 사거리 내: 반격
        if (unit.attackCooldown <= 0) {
          attacker.hp -= unit.attack;
          attacker.attackerId = unit.id;
          unit.attackCooldown = unit.attackSpeed;
          unit.state = 'attacking';
          this.broadcastEvent({
            event: 'UNIT_ATTACKED',
            attackerId: unit.id,
            targetId: attacker.id,
            damage: unit.attack,
          });
        }
        return;
      }
    }

    // 1. 가장 가까운 적 유닛 찾기
    let nearestEnemy: ServerUnit | null = null;
    let minEnemyDist = Infinity;
    for (const enemy of enemies) {
      const dist = this.getDistance(unit.x, unit.y, enemy.x, enemy.y);
      if (dist < minEnemyDist) {
        minEnemyDist = dist;
        nearestEnemy = enemy;
      }
    }

    // 우선순위: 적 유닛 > 기지
    if (nearestEnemy && minEnemyDist <= distToBase) {
      if (minEnemyDist <= unit.range) {
        if (unit.attackCooldown <= 0) {
          nearestEnemy.hp -= unit.attack;
          nearestEnemy.attackerId = unit.id;
          unit.attackCooldown = unit.attackSpeed;
          unit.state = 'attacking';
          this.broadcastEvent({
            event: 'UNIT_ATTACKED',
            attackerId: unit.id,
            targetId: nearestEnemy.id,
            damage: unit.attack,
          });
        }
      } else {
        unit.state = 'moving';
        this.moveTowards(unit, nearestEnemy.x, nearestEnemy.y, deltaTime);
      }
      return;
    }

    // 기지로 이동/공격
    if (distToBase > unit.range) {
      unit.state = 'moving';
      this.moveTowards(unit, enemyBaseX, CONFIG.BASE_Y, deltaTime);
    } else {
      if (unit.attackCooldown <= 0) {
        if (unit.side === 'left') {
          this.rightBaseHp -= unit.attack;
          this.broadcastEvent({
            event: 'BASE_DAMAGED',
            side: 'right',
            damage: unit.attack,
            hp: this.rightBaseHp,
          });
        } else {
          this.leftBaseHp -= unit.attack;
          this.broadcastEvent({
            event: 'BASE_DAMAGED',
            side: 'left',
            damage: unit.attack,
            hp: this.leftBaseHp,
          });
        }
        unit.attackCooldown = unit.attackSpeed;
        unit.state = 'attacking';
      }
    }
  }

  private updateHealerUnit(unit: ServerUnit, deltaTime: number, healAmounts: Map<string, number>): void {
    const config = CONFIG.UNITS.healer;
    const healRate = config.healRate || 10;
    const healRange = config.healRange || 100;
    const attack = config.attack || 3;
    const attackSpeed = config.attackSpeed || 1;
    const range = config.range || 25;

    // 전투 유닛 타입 목록
    const COMBAT_UNIT_TYPES = ['melee', 'ranged', 'knight', 'mage'];

    // 아군 본진 위치
    const allyBaseX = unit.side === 'left' ? CONFIG.LEFT_BASE_X : CONFIG.RIGHT_BASE_X;

    // 아군/적군 유닛 목록
    const allies = this.units.filter(u => u.side === unit.side && u.hp > 0 && u.id !== unit.id);
    const enemies = this.units.filter(u => u.side !== unit.side && u.hp > 0);

    // 아군 전투 유닛 목록
    const allyCombatUnits = allies.filter(a => COMBAT_UNIT_TYPES.includes(a.unitType));

    // 적 전투 유닛 목록
    const enemyCombatUnits = enemies.filter(e => COMBAT_UNIT_TYPES.includes(e.unitType));

    // 우선순위: 전투유닛 회복 > 아군 전투유닛 따라가기 > 적 공격 > 반격 > 본진 대기
    // (지원 유닛이 피해를 입어도 전투 유닛만 회복하고 따라다님)

    // 피해를 입은 아군 전투 유닛 찾기 (HP 비율이 가장 낮은 전투 유닛)
    let lowestHpCombatUnit: ServerUnit | null = null;
    let lowestHpRatio = 1;

    for (const combatUnit of allyCombatUnits) {
      if (combatUnit.hp >= combatUnit.maxHp) continue; // 풀피 유닛 제외
      const hpRatio = combatUnit.hp / combatUnit.maxHp;
      if (hpRatio < lowestHpRatio) {
        lowestHpRatio = hpRatio;
        lowestHpCombatUnit = combatUnit;
      }
    }

    // 1순위: 피해를 입은 전투 유닛이 있으면 회복 우선
    if (lowestHpCombatUnit) {
      const distToAlly = this.getDistance(unit.x, unit.y, lowestHpCombatUnit.x, lowestHpCombatUnit.y);

      if (distToAlly > healRange) {
        // 전투 유닛에게 이동
        unit.state = 'moving';
        this.moveTowards(unit, lowestHpCombatUnit.x, lowestHpCombatUnit.y, deltaTime);
      } else {
        // 광역 회복: 힐러 범위 내의 모든 피해 입은 전투 유닛 회복
        unit.state = 'healing';
        const healAmount = healRate * deltaTime;

        // 힐 이펙트 이벤트 (0.5초 쿨타임)
        const effectCooldown = 0.5;
        const shouldSendEffect = !unit.lastEffectTime || this.gameTime - unit.lastEffectTime >= effectCooldown;

        for (const combatUnit of allyCombatUnits) {
          if (combatUnit.hp >= combatUnit.maxHp) continue; // 풀피 유닛 제외
          const distToTarget = this.getDistance(unit.x, unit.y, combatUnit.x, combatUnit.y);
          if (distToTarget <= healRange) {
            const currentHeal = healAmounts.get(combatUnit.id) || 0;
            healAmounts.set(combatUnit.id, currentHeal + healAmount);

            // 힐 이펙트 이벤트 전송
            if (shouldSendEffect) {
              this.broadcastEvent({
                event: 'UNIT_HEALED',
                healerId: unit.id,
                targetId: combatUnit.id,
                x: combatUnit.x,
                y: combatUnit.y,
              });
            }
          }
        }

        if (shouldSendEffect) {
          unit.lastEffectTime = this.gameTime;
        }
      }
      return;
    }

    // 2순위: 아군 전투 유닛이 있으면 가장 가까운 전투 유닛 따라가기 (피해 입은 전투유닛 없어도)
    if (allyCombatUnits.length > 0) {
      let nearestCombatUnit: ServerUnit | null = null;
      let nearestDist = Infinity;

      for (const combatUnit of allyCombatUnits) {
        const dist = this.getDistance(unit.x, unit.y, combatUnit.x, combatUnit.y);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestCombatUnit = combatUnit;
        }
      }

      if (nearestCombatUnit) {
        // 전투 유닛 근처에 있으면 대기, 멀면 따라가기
        const followDistance = healRange * 0.8;

        if (nearestDist > followDistance) {
          unit.state = 'moving';
          this.moveTowards(unit, nearestCombatUnit.x, nearestCombatUnit.y, deltaTime);
        } else {
          unit.state = 'idle';
        }
      }
      return;
    }

    // 3순위: 아군 전투 유닛이 없고 적 전투 유닛이 있으면 공격
    if (enemyCombatUnits.length > 0) {
      let nearestEnemy: ServerUnit | null = null;
      let nearestDist = Infinity;

      for (const enemy of enemyCombatUnits) {
        const dist = this.getDistance(unit.x, unit.y, enemy.x, enemy.y);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestEnemy = enemy;
        }
      }

      if (nearestEnemy) {
        if (nearestDist > range) {
          // 적에게 이동
          unit.state = 'moving';
          this.moveTowards(unit, nearestEnemy.x, nearestEnemy.y, deltaTime);
        } else {
          // 공격
          if (unit.attackCooldown <= 0) {
            nearestEnemy.hp -= attack;
            nearestEnemy.attackerId = unit.id;
            unit.attackCooldown = attackSpeed;
            unit.state = 'attacking';
            this.broadcastEvent({
              event: 'UNIT_ATTACKED',
              attackerId: unit.id,
              targetId: nearestEnemy.id,
              damage: attack,
            });
          }
        }
      }
      return;
    }

    // 4순위: 반격 (attackerId가 있고 사거리 내일 때만)
    if (unit.attackerId) {
      const attacker = this.units.find(u => u.id === unit.attackerId && u.hp > 0);

      if (attacker) {
        const distToAttacker = this.getDistance(unit.x, unit.y, attacker.x, attacker.y);

        if (distToAttacker <= range) {
          // 사거리 내: 반격
          if (unit.attackCooldown <= 0) {
            attacker.hp -= attack;
            attacker.attackerId = unit.id;
            unit.attackCooldown = attackSpeed;
            unit.state = 'attacking';
            this.broadcastEvent({
              event: 'UNIT_ATTACKED',
              attackerId: unit.id,
              targetId: attacker.id,
              damage: attack,
            });
          }
          return;
        }
        // 사거리 밖이면 반격하지 않고 아래 로직으로 진행 (본진 대기)
      } else {
        // 공격자가 죽었으면 attackerId 초기화
        unit.attackerId = undefined;
      }
    }

    // 5순위: 본진 근처로 대기
    const distToBase = this.getDistance(unit.x, unit.y, allyBaseX, CONFIG.BASE_Y);

    if (distToBase > 150) {
      // 본진으로 이동
      unit.state = 'moving';
      this.moveTowards(unit, allyBaseX, CONFIG.BASE_Y, deltaTime);
    } else {
      unit.state = 'idle';
    }
  }

  private updateMageUnit(unit: ServerUnit, deltaTime: number): void {
    const config = CONFIG.UNITS.mage;
    const range = config.range || 180;
    const attack = config.attack || 35;
    const aoeRadius = config.aoeRadius || 50;
    const attackSpeed = config.attackSpeed || 2.5;

    const enemyBaseX = unit.side === 'left' ? CONFIG.RIGHT_BASE_X : CONFIG.LEFT_BASE_X;
    const distToBase = this.getDistance(unit.x, unit.y, enemyBaseX, CONFIG.BASE_Y);

    const enemies = this.units.filter(u => u.side !== unit.side && u.hp > 0);

    // 반격 대상 확인
    if (unit.attackerId) {
      const attacker = enemies.find(e => e.id === unit.attackerId && e.hp > 0);
      if (attacker) {
        const attackerDist = this.getDistance(unit.x, unit.y, attacker.x, attacker.y);
        if (attackerDist <= range) {
          if (unit.attackCooldown <= 0) {
            this.performMageAoeAttack(unit, attacker, enemies, attack, aoeRadius);
            unit.attackCooldown = attackSpeed;
            unit.state = 'attacking';
          }
          return;
        }
      } else {
        unit.attackerId = undefined;
      }
    }

    // 가장 가까운 적 유닛 찾기
    let nearestEnemy: ServerUnit | null = null;
    let minEnemyDist = Infinity;
    for (const enemy of enemies) {
      const dist = this.getDistance(unit.x, unit.y, enemy.x, enemy.y);
      if (dist < minEnemyDist) {
        minEnemyDist = dist;
        nearestEnemy = enemy;
      }
    }

    // 우선순위: 적 유닛 > 기지
    if (nearestEnemy && minEnemyDist <= distToBase) {
      if (minEnemyDist <= range) {
        if (unit.attackCooldown <= 0) {
          this.performMageAoeAttack(unit, nearestEnemy, enemies, attack, aoeRadius);
          unit.attackCooldown = attackSpeed;
          unit.state = 'attacking';
        }
      } else {
        unit.state = 'moving';
        this.moveTowards(unit, nearestEnemy.x, nearestEnemy.y, deltaTime);
      }
      return;
    }

    // 기지로 이동/공격
    if (distToBase > range) {
      unit.state = 'moving';
      this.moveTowards(unit, enemyBaseX, CONFIG.BASE_Y, deltaTime);
    } else {
      if (unit.attackCooldown <= 0) {
        if (unit.side === 'left') {
          this.rightBaseHp -= attack;
          this.broadcastEvent({
            event: 'BASE_DAMAGED',
            side: 'right',
            damage: attack,
            hp: this.rightBaseHp,
          });
        } else {
          this.leftBaseHp -= attack;
          this.broadcastEvent({
            event: 'BASE_DAMAGED',
            side: 'left',
            damage: attack,
            hp: this.leftBaseHp,
          });
        }
        unit.attackCooldown = attackSpeed;
        unit.state = 'attacking';
      }
    }
  }

  // 마법사 AOE 공격 수행
  private performMageAoeAttack(
    unit: ServerUnit,
    target: ServerUnit,
    enemies: ServerUnit[],
    attack: number,
    aoeRadius: number
  ): void {
    for (const enemy of enemies) {
      const distFromTarget = this.getDistance(target.x, target.y, enemy.x, enemy.y);
      if (distFromTarget <= aoeRadius) {
        // 중심에서 가장자리로 갈수록 데미지 감소 (100% → 50%)
        const damageMultiplier = 1 - (distFromTarget / aoeRadius) * 0.5;
        const damage = Math.floor(attack * damageMultiplier);
        enemy.hp -= damage;
        enemy.attackerId = unit.id;
        this.broadcastEvent({
          event: 'UNIT_ATTACKED',
          attackerId: unit.id,
          targetId: enemy.id,
          damage,
        });
      }
    }
  }

  private findNearestEnemy(unit: ServerUnit): ServerUnit | null {
    const enemies = this.units.filter(u => u.side !== unit.side);
    if (enemies.length === 0) return null;

    let nearest: ServerUnit | null = null;
    let minDistance = Infinity;

    for (const enemy of enemies) {
      const distance = this.getDistance(unit.x, unit.y, enemy.x, enemy.y);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = enemy;
      }
    }

    return nearest;
  }

  private checkMineTriggering(): void {
    const minesToDetonate: ServerMine[] = [];

    for (const mine of this.mines) {
      // 반대편 유닛이 감지 반경 내 진입했는지 확인
      for (const unit of this.units) {
        if (unit.side === mine.side || unit.hp <= 0) continue;
        const dist = this.getDistance(unit.x, unit.y, mine.x, mine.y);
        if (dist <= CONFIG.MINE_TRIGGER_RADIUS) {
          minesToDetonate.push(mine);
          break;
        }
      }
    }

    for (const mine of minesToDetonate) {
      this.detonateMine(mine);
    }
  }

  private detonateMine(mine: ServerMine): void {
    // AoE 피해 적용 (거리 감쇠: 중심 100% → 가장자리 50%)
    for (const unit of this.units) {
      if (unit.side === mine.side || unit.hp <= 0) continue;
      const dist = this.getDistance(unit.x, unit.y, mine.x, mine.y);
      if (dist <= CONFIG.MINE_AOE_RADIUS) {
        const damageMultiplier = 1 - (dist / CONFIG.MINE_AOE_RADIUS) * 0.5;
        const damage = Math.floor(CONFIG.MINE_DAMAGE * damageMultiplier);
        unit.hp -= damage;
        this.broadcastEvent({
          event: 'UNIT_ATTACKED',
          attackerId: mine.id,
          targetId: unit.id,
          damage,
        });
      }
    }

    // 지뢰 제거
    this.mines = this.mines.filter(m => m.id !== mine.id);

    // 폭발 이벤트 양쪽 브로드캐스트
    this.broadcastEvent({ event: 'MINE_EXPLODED', mineId: mine.id, x: mine.x, y: mine.y });
  }

  private respawnResourceNodes(): void {
    for (const node of this.resourceNodes) {
      // 고갈되지 않았거나 depletedAt이 없으면 스킵
      if (node.amount > 0 || !node.depletedAt) continue;

      // 재생성 시간 확인
      const respawnTime = CONFIG.RESOURCE_RESPAWN[node.type] || 60;
      const timeSinceDepleted = this.gameTime - node.depletedAt;

      if (timeSinceDepleted >= respawnTime) {
        // 자원 재생성
        node.amount = node.maxAmount;
        node.depletedAt = undefined;
      }
    }
  }

  private findNearestResourceNode(unit: ServerUnit, resourceType: string): NetworkResourceNode | null {
    // resourceType에 맞는 노드 타입 매핑
    const nodeTypeMap: Record<string, string> = {
      wood: 'tree',
      stone: 'rock',
      herb: 'herb',
      crystal: 'crystal',
      gold: 'goldmine',
    };

    const targetType = nodeTypeMap[resourceType];
    if (!targetType) return null;

    // 채집꾼(herb)은 크리스탈 노드도 채집 가능
    const validNodes = this.resourceNodes.filter(
      n => (n.type === targetType || (resourceType === 'herb' && n.type === 'crystal')) && n.amount > 0
    );

    if (validNodes.length === 0) return null;

    let nearest: NetworkResourceNode | null = null;
    let minDistance = Infinity;

    for (const node of validNodes) {
      const distance = this.getDistance(unit.x, unit.y, node.x, node.y);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = node;
      }
    }

    return nearest;
  }

  private moveTowards(unit: ServerUnit, targetX: number, targetY: number, deltaTime: number): void {
    const dx = targetX - unit.x;
    const dy = targetY - unit.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 0) {
      const moveSpeed = unit.speed * 60 * deltaTime;
      const moveX = (dx / distance) * moveSpeed;
      const moveY = (dy / distance) * moveSpeed;

      unit.x += moveX;
      unit.y += moveY;

      // 맵 경계 체크
      unit.x = Math.max(0, Math.min(CONFIG.MAP_WIDTH, unit.x));
      unit.y = Math.max(0, Math.min(CONFIG.MAP_HEIGHT, unit.y));
    }
  }

  private getDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  }

  private checkWinCondition(): void {
    // 기지 파괴 체크
    if (this.leftBaseHp <= 0) {
      this.endGame('right', '왼쪽 기지 파괴');
      return;
    }

    if (this.rightBaseHp <= 0) {
      this.endGame('left', '오른쪽 기지 파괴');
      return;
    }

    // 시간 종료 체크
    if (this.gameTime >= CONFIG.GAME_DURATION) {
      if (this.leftBaseHp > this.rightBaseHp) {
        this.endGame('left', '시간 종료 - HP 우위');
      } else if (this.rightBaseHp > this.leftBaseHp) {
        this.endGame('right', '시간 종료 - HP 우위');
      } else {
        this.endGame('draw', '시간 종료 - 동점');
      }
    }
  }

  private endGame(winner: 'left' | 'right' | 'draw', reason: string): void {
    this.gameState = 'ended';

    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
    }

    console.log(`게임 종료: Room ${this.id}, 승자: ${winner}, 이유: ${reason}`);

    // 결과 전송
    let leftResult: GameResult;
    let rightResult: GameResult;

    if (winner === 'draw') {
      leftResult = 'draw';
      rightResult = 'draw';
    } else if (winner === 'left') {
      leftResult = 'win';
      rightResult = 'lose';
    } else {
      leftResult = 'lose';
      rightResult = 'win';
    }

    sendToPlayer(this.leftPlayerId, {
      type: 'GAME_OVER',
      result: leftResult,
      reason,
    });

    sendToPlayer(this.rightPlayerId, {
      type: 'GAME_OVER',
      result: rightResult,
      reason,
    });

    // 플레이어 방 정보 초기화
    const leftPlayer = players.get(this.leftPlayerId);
    const rightPlayer = players.get(this.rightPlayerId);
    if (leftPlayer) leftPlayer.roomId = null;
    if (rightPlayer) rightPlayer.roomId = null;

    // 방 제거
    removeRoom(this.id);
  }

  // 플레이어 액션 핸들러
  public handleSpawnUnit(playerId: string, unitType: UnitType): void {
    const side = this.getPlayerSide(playerId);
    if (!side) return;

    const config = CONFIG.UNITS[unitType];
    if (!config) return;

    const resources = side === 'left' ? this.leftResources : this.rightResources;
    const cooldowns = side === 'left' ? this.leftSpawnCooldowns : this.rightSpawnCooldowns;

    // 쿨타임 체크
    const currentCooldown = cooldowns[unitType] || 0;
    if (currentCooldown > 0) {
      return;
    }

    // 비용 체크
    const cost = config.cost as Partial<Resources>;
    if (!this.canAfford(resources, cost)) {
      return;
    }

    // 비용 차감
    this.deductCost(resources, cost);

    // 쿨타임 설정
    const spawnCooldown = config.spawnCooldown || 1;
    cooldowns[unitType] = spawnCooldown;

    // 유닛 생성
    const spawnX = side === 'left' ? CONFIG.LEFT_BASE_X + 50 : CONFIG.RIGHT_BASE_X - 50;
    const spawnY = CONFIG.BASE_Y + (Math.random() - 0.5) * 200;

    const unit: ServerUnit = {
      id: uuidv4(),
      type: unitType,
      unitType,
      x: spawnX,
      y: spawnY,
      hp: config.hp,
      maxHp: config.hp,
      state: 'idle',
      side,
      attack: config.attack || 0,
      attackSpeed: config.attackSpeed || 1,
      speed: config.speed,
      range: config.range || 30,
      attackCooldown: 0,
      gatherRate: config.gatherRate,
      resourceType: config.resource,
      healRate: config.healRate,
      healRange: config.healRange,
      aoeRadius: config.aoeRadius,
    };

    this.units.push(unit);

    this.broadcastEvent({
      event: 'UNIT_SPAWNED',
      unit: this.toNetworkUnit(unit),
    });

    this.broadcastEvent({
      event: 'RESOURCE_UPDATED',
      side,
      resources,
    });
  }

  public handlePlaceMine(playerId: string, x: number, y: number): void {
    const side = this.getPlayerSide(playerId);
    if (!side) return;

    const resources = side === 'left' ? this.leftResources : this.rightResources;

    // 최대 개수 확인
    const playerMines = this.mines.filter(m => m.side === side);
    if (playerMines.length >= CONFIG.MINE_MAX_PER_PLAYER) {
      return;
    }

    if (!this.canAfford(resources, CONFIG.MINE_COST)) {
      return;
    }

    // 진영 확인
    const isValidPosition = side === 'left'
      ? x < CONFIG.MAP_WIDTH / 2
      : x > CONFIG.MAP_WIDTH / 2;
    if (!isValidPosition) return;

    this.deductCost(resources, CONFIG.MINE_COST);

    const mine: ServerMine = {
      id: uuidv4(),
      x,
      y,
      side,
    };

    this.mines.push(mine);

    // 소유자에게만 MINE_PLACED 이벤트 전송
    sendToPlayer(playerId, { type: 'GAME_EVENT', event: { event: 'MINE_PLACED', mine } });
    this.broadcastEvent({ event: 'RESOURCE_UPDATED', side, resources });
  }

  public handleUpgradeBase(playerId: string): void {
    const side = this.getPlayerSide(playerId);
    if (!side) return;

    const resources = side === 'left' ? this.leftResources : this.rightResources;
    const currentLevel = side === 'left' ? this.leftUpgradeLevel : this.rightUpgradeLevel;

    // 최대 레벨 체크
    if (currentLevel >= CONFIG.BASE_UPGRADE.MAX_LEVEL) {
      return;
    }

    const cost = getUpgradeCost(currentLevel);

    if (!this.canAfford(resources, cost)) {
      return;
    }

    this.deductCost(resources, cost);

    const newLevel = currentLevel + 1;
    const newGoldPerSecond = CONFIG.GOLD_PER_SECOND + (newLevel * CONFIG.BASE_UPGRADE.GOLD_BONUS);

    if (side === 'left') {
      this.leftMaxBaseHp += CONFIG.BASE_UPGRADE.HP_BONUS;
      this.leftBaseHp += CONFIG.BASE_UPGRADE.HP_BONUS;
      this.leftUpgradeLevel = newLevel;
      this.leftGoldPerSecond = newGoldPerSecond;
    } else {
      this.rightMaxBaseHp += CONFIG.BASE_UPGRADE.HP_BONUS;
      this.rightBaseHp += CONFIG.BASE_UPGRADE.HP_BONUS;
      this.rightUpgradeLevel = newLevel;
      this.rightGoldPerSecond = newGoldPerSecond;
    }

    this.broadcastEvent({
      event: 'BASE_UPGRADED',
      side,
      newMaxHp: side === 'left' ? this.leftMaxBaseHp : this.rightMaxBaseHp,
      upgradeLevel: newLevel,
      goldPerSecond: newGoldPerSecond,
    });
    this.broadcastEvent({ event: 'RESOURCE_UPDATED', side, resources });
  }

  public handleSellHerb(playerId: string): void {
    const side = this.getPlayerSide(playerId);
    if (!side) return;

    const resources = side === 'left' ? this.leftResources : this.rightResources;

    if (resources.herb < CONFIG.HERB_SELL_COST) {
      return;
    }

    resources.herb -= CONFIG.HERB_SELL_COST;
    resources.gold += CONFIG.HERB_SELL_GOLD;

    this.broadcastEvent({ event: 'RESOURCE_UPDATED', side, resources });
  }

  public handleCollectResource(playerId: string, nodeId: string): void {
    // 직접 자원 채집 처리 (필요 시 구현)
  }

  public surrender(playerId: string): void {
    if (this.gameState !== 'playing') return;

    const side = this.getPlayerSide(playerId);
    if (!side) return;

    const winningSide = side === 'left' ? 'right' : 'left';
    this.endGame(winningSide, '항복');
  }

  public handlePlayerDisconnect(playerId: string): void {
    if (this.gameState !== 'playing') {
      // 게임 시작 전이면 방 제거
      if (this.countdownTimer) {
        clearInterval(this.countdownTimer);
      }
      removeRoom(this.id);
      return;
    }

    // 게임 중이면 상대방 승리
    const side = this.getPlayerSide(playerId);
    if (side) {
      const winningSide = side === 'left' ? 'right' : 'left';
      const winnerPlayerId = side === 'left' ? this.rightPlayerId : this.leftPlayerId;

      sendToPlayer(winnerPlayerId, {
        type: 'OPPONENT_DISCONNECTED',
      });

      this.endGame(winningSide, '상대방 연결 끊김');
    }
  }

  private getPlayerSide(playerId: string): PlayerSide | null {
    if (playerId === this.leftPlayerId) return 'left';
    if (playerId === this.rightPlayerId) return 'right';
    return null;
  }

  private canAfford(resources: Resources, cost: Partial<Resources>): boolean {
    for (const [key, value] of Object.entries(cost)) {
      if ((resources[key as keyof Resources] || 0) < (value || 0)) {
        return false;
      }
    }
    return true;
  }

  private deductCost(resources: Resources, cost: Partial<Resources>): void {
    for (const [key, value] of Object.entries(cost)) {
      resources[key as keyof Resources] -= value || 0;
    }
  }

  private toNetworkUnit(unit: ServerUnit): NetworkUnit {
    return {
      id: unit.id,
      type: unit.type,
      x: unit.x,
      y: unit.y,
      hp: unit.hp,
      maxHp: unit.maxHp,
      state: unit.state,
      side: unit.side,
    };
  }

  private getNetworkGameState(): NetworkGameState {
    const leftPlayer = players.get(this.leftPlayerId);
    const rightPlayer = players.get(this.rightPlayerId);

    return {
      time: this.gameTime,
      maxTime: CONFIG.GAME_DURATION,
      leftPlayer: {
        id: this.leftPlayerId,
        name: leftPlayer?.name || 'Player 1',
        resources: { ...this.leftResources },
        baseHp: this.leftBaseHp,
        maxBaseHp: this.leftMaxBaseHp,
        upgradeLevel: this.leftUpgradeLevel,
        goldPerSecond: this.leftGoldPerSecond,
        spawnCooldowns: { ...this.leftSpawnCooldowns },
      },
      rightPlayer: {
        id: this.rightPlayerId,
        name: rightPlayer?.name || 'Player 2',
        resources: { ...this.rightResources },
        baseHp: this.rightBaseHp,
        maxBaseHp: this.rightMaxBaseHp,
        upgradeLevel: this.rightUpgradeLevel,
        goldPerSecond: this.rightGoldPerSecond,
        spawnCooldowns: { ...this.rightSpawnCooldowns },
      },
      units: this.units.map(u => this.toNetworkUnit(u)),
      mines: [], // 플레이어별 필터링됨
      resourceNodes: [...this.resourceNodes],
    };
  }

  private broadcast(message: any): void {
    sendToPlayer(this.leftPlayerId, message);
    sendToPlayer(this.rightPlayerId, message);
  }

  private broadcastEvent(event: GameEvent): void {
    this.broadcast({ type: 'GAME_EVENT', event });
  }

  private broadcastState(): void {
    const base = this.getNetworkGameState();

    // 지뢰는 소유자에게만 보임
    const leftState = { ...base, mines: this.mines.filter(m => m.side === 'left') };
    sendToPlayer(this.leftPlayerId, { type: 'GAME_STATE', state: leftState });

    const rightState = { ...base, mines: this.mines.filter(m => m.side === 'right') };
    sendToPlayer(this.rightPlayerId, { type: 'GAME_STATE', state: rightState });
  }
}
