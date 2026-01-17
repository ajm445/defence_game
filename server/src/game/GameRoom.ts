import { v4 as uuidv4 } from 'uuid';
import { players, sendToPlayer } from '../state/players';
import { removeRoom } from '../websocket/MessageHandler';
import type {
  NetworkGameState,
  NetworkUnit,
  NetworkWall,
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
      speed: 1.5,
      range: 30,
      type: 'combat',
    },
    ranged: {
      name: '궁수',
      cost: { gold: 80, wood: 10 },
      hp: 50,
      attack: 25,
      speed: 1.6,
      range: 150,
      type: 'combat',
    },
    knight: {
      name: '기사',
      cost: { gold: 120, wood: 20, stone: 30 },
      hp: 250,
      attack: 30,
      speed: 1.3,
      range: 35,
      type: 'combat',
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
    },
    miner: {
      name: '광부',
      cost: { gold: 40, wood: 5 },
      hp: 70,
      attack: 6,
      range: 25,
      gatherRate: 0.8,
      speed: 1.5,
      type: 'support',
      resource: 'stone',
    },
    gatherer: {
      name: '채집꾼',
      cost: { gold: 35 },
      hp: 50,
      attack: 3,
      range: 20,
      gatherRate: 1.2,
      speed: 1.5,
      type: 'support',
      resource: 'herb',
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
    },
  } as Record<string, any>,

  WALL_COST: { wood: 20, stone: 10 },
  WALL_HP: 200,
  BASE_UPGRADE_COST: { gold: 100, stone: 50 },
  BASE_UPGRADE_HP: 200,
  HERB_SELL_COST: 10,
  HERB_SELL_GOLD: 30,

  // 자원 재생성 시간 (초)
  RESOURCE_RESPAWN: {
    tree: 40,
    rock: 90,
    herb: 30,
    crystal: 180,
    goldmine: 40,
  } as Record<string, number>,
};

interface ServerUnit extends NetworkUnit {
  attack: number;
  speed: number;
  range: number;
  attackCooldown: number;
  targetId?: string;
  attackerId?: string; // 이 유닛을 공격한 적의 ID (반격용)
  gatherRate?: number;
  resourceType?: string;
  unitType: string;
}

interface ServerWall extends NetworkWall {}

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

  private units: ServerUnit[] = [];
  private walls: ServerWall[] = [];
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
    // 나무 노드 (각 진영 8개씩)
    const treePositions = [
      // 왼쪽 (플레이어 측)
      { x: 400, y: 350 }, { x: 450, y: 700 }, { x: 400, y: 1050 },
      { x: 450, y: 1400 }, { x: 400, y: 1750 }, { x: 450, y: 2050 },
      { x: 650, y: 500 }, { x: 650, y: 1900 },
      // 오른쪽 (적 측)
      { x: 3600, y: 350 }, { x: 3550, y: 700 }, { x: 3600, y: 1050 },
      { x: 3550, y: 1400 }, { x: 3600, y: 1750 }, { x: 3550, y: 2050 },
      { x: 3350, y: 500 }, { x: 3350, y: 1900 },
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

    // 바위 노드 (맵 중앙 10개)
    const rockPositions = [
      { x: 1600, y: 500 }, { x: 1850, y: 750 }, { x: 2150, y: 500 },
      { x: 2400, y: 750 }, { x: 2000, y: 1200 },
      { x: 1600, y: 1700 }, { x: 1850, y: 1950 }, { x: 2150, y: 1700 },
      { x: 2400, y: 1950 }, { x: 2000, y: 1450 },
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

    // 약초 노드 (15개)
    const herbPositions = [
      { x: 550, y: 250 }, { x: 800, y: 600 }, { x: 550, y: 950 },
      { x: 800, y: 1300 }, { x: 550, y: 1650 }, { x: 800, y: 2150 },
      { x: 1400, y: 400 }, { x: 2000, y: 600 }, { x: 2600, y: 400 },
      { x: 3450, y: 250 }, { x: 3200, y: 600 }, { x: 3450, y: 950 },
      { x: 3200, y: 1300 }, { x: 3450, y: 1650 }, { x: 3200, y: 2150 },
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

    // 수정 노드 (맵 중앙 3개)
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

    // 광산 노드 (각 진영 4개씩)
    const goldminePositions = [
      // 왼쪽
      { x: 350, y: 500 }, { x: 350, y: 950 }, { x: 350, y: 1450 }, { x: 350, y: 1900 },
      // 오른쪽
      { x: 3650, y: 500 }, { x: 3650, y: 950 }, { x: 3650, y: 1450 }, { x: 3650, y: 1900 },
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

    // 골드 자동 획득 (1초마다)
    if (Math.floor(this.gameTime) > this.lastGoldTick) {
      this.lastGoldTick = Math.floor(this.gameTime);
      this.leftResources.gold += CONFIG.GOLD_PER_SECOND;
      this.rightResources.gold += CONFIG.GOLD_PER_SECOND;
    }

    // 유닛 업데이트
    this.updateUnits(deltaTime);

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

  private updateUnits(deltaTime: number): void {
    const unitsToRemove: string[] = [];

    for (const unit of this.units) {
      // 쿨다운 감소
      if (unit.attackCooldown > 0) {
        unit.attackCooldown -= deltaTime;
      }

      const config = CONFIG.UNITS[unit.unitType];
      const isSupport = config?.type === 'support';

      if (isSupport) {
        // 지원 유닛: 자원 채집 또는 이동
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
          const resourceKey = config.resource as keyof Resources;
          resources[resourceKey] += gathered;
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

    // 1. 공격받은 적 찾기 (반격 대상)
    let attacker: ServerUnit | null = null;
    if (unit.attackerId) {
      attacker = this.units.find(u => u.id === unit.attackerId && u.hp > 0) || null;
      // 공격자가 죽었으면 attackerId 초기화
      if (!attacker) {
        unit.attackerId = undefined;
      }
    }

    // 2. 가장 가까운 벽 찾기
    const enemyWalls = this.walls.filter(w => w.side !== unit.side && w.hp > 0);
    let targetWall: ServerWall | null = null;
    let minWallDist = Infinity;
    for (const wall of enemyWalls) {
      const dist = this.getDistance(unit.x, unit.y, wall.x, wall.y);
      if (dist < minWallDist) {
        minWallDist = dist;
        targetWall = wall;
      }
    }

    // 3. 가장 가까운 적 유닛 찾기
    const enemies = this.units.filter(u => u.side !== unit.side && u.hp > 0);
    let nearestEnemy: ServerUnit | null = null;
    let minEnemyDist = Infinity;
    for (const enemy of enemies) {
      const dist = this.getDistance(unit.x, unit.y, enemy.x, enemy.y);
      if (dist < minEnemyDist) {
        minEnemyDist = dist;
        nearestEnemy = enemy;
      }
    }

    // 우선순위: 반격 대상 > 벽(경로상) > 범위 내 적 > 본진

    // 1순위: 반격 대상 (공격받은 경우)
    if (attacker) {
      const attackerDist = this.getDistance(unit.x, unit.y, attacker.x, attacker.y);
      if (attackerDist <= unit.range) {
        if (unit.attackCooldown <= 0) {
          attacker.hp -= unit.attack;
          attacker.attackerId = unit.id; // 공격자 기록 (반격 체인)
          unit.attackCooldown = 1;
          unit.state = 'attacking';
          this.broadcastEvent({
            event: 'UNIT_ATTACKED',
            attackerId: unit.id,
            targetId: attacker.id,
            damage: unit.attack,
          });
        }
      } else {
        // 공격자에게 이동
        unit.state = 'moving';
        this.moveTowards(unit, attacker.x, attacker.y, deltaTime);
      }
      return;
    }

    // 2순위: 벽 (본진보다 가까운 경우)
    if (targetWall && minWallDist < distToBase) {
      if (minWallDist <= unit.range) {
        if (unit.attackCooldown <= 0) {
          targetWall.hp -= unit.attack;
          unit.attackCooldown = 1;
          unit.state = 'attacking';

          if (targetWall.hp <= 0) {
            this.walls = this.walls.filter(w => w.id !== targetWall!.id);
            this.broadcastEvent({ event: 'WALL_DESTROYED', wallId: targetWall.id });
          } else {
            this.broadcastEvent({
              event: 'WALL_DAMAGED',
              wallId: targetWall.id,
              damage: unit.attack,
              hp: targetWall.hp,
            });
          }
        }
      } else {
        // 벽으로 이동
        unit.state = 'moving';
        this.moveTowards(unit, targetWall.x, targetWall.y, deltaTime);
      }
      return;
    }

    // 3순위: 범위 내 적 유닛
    if (nearestEnemy && minEnemyDist <= unit.range) {
      if (unit.attackCooldown <= 0) {
        nearestEnemy.hp -= unit.attack;
        nearestEnemy.attackerId = unit.id; // 공격자 기록
        unit.attackCooldown = 1;
        unit.state = 'attacking';
        this.broadcastEvent({
          event: 'UNIT_ATTACKED',
          attackerId: unit.id,
          targetId: nearestEnemy.id,
          damage: unit.attack,
        });
      }
      return;
    }

    // 4순위: 본진으로 이동/공격
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
        unit.attackCooldown = 1;
        unit.state = 'attacking';
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

  private findNearestEnemyWall(unit: ServerUnit): ServerWall | null {
    const enemyWalls = this.walls.filter(w => w.side !== unit.side);
    if (enemyWalls.length === 0) return null;

    let nearest: ServerWall | null = null;
    let minDistance = Infinity;

    for (const wall of enemyWalls) {
      const distance = this.getDistance(unit.x, unit.y, wall.x, wall.y);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = wall;
      }
    }

    return nearest;
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

    const validNodes = this.resourceNodes.filter(
      n => n.type === targetType && n.amount > 0
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

    // 비용 체크
    const cost = config.cost as Partial<Resources>;
    if (!this.canAfford(resources, cost)) {
      return;
    }

    // 비용 차감
    this.deductCost(resources, cost);

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
      speed: config.speed,
      range: config.range || 30,
      attackCooldown: 0,
      gatherRate: config.gatherRate,
      resourceType: config.resource,
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

  public handleBuildWall(playerId: string, x: number, y: number): void {
    const side = this.getPlayerSide(playerId);
    if (!side) return;

    const resources = side === 'left' ? this.leftResources : this.rightResources;

    if (!this.canAfford(resources, CONFIG.WALL_COST)) {
      return;
    }

    this.deductCost(resources, CONFIG.WALL_COST);

    const wall: ServerWall = {
      id: uuidv4(),
      x,
      y,
      hp: CONFIG.WALL_HP,
      maxHp: CONFIG.WALL_HP,
      side,
    };

    this.walls.push(wall);

    this.broadcastEvent({ event: 'WALL_BUILT', wall });
    this.broadcastEvent({ event: 'RESOURCE_UPDATED', side, resources });
  }

  public handleUpgradeBase(playerId: string): void {
    const side = this.getPlayerSide(playerId);
    if (!side) return;

    const resources = side === 'left' ? this.leftResources : this.rightResources;

    if (!this.canAfford(resources, CONFIG.BASE_UPGRADE_COST)) {
      return;
    }

    this.deductCost(resources, CONFIG.BASE_UPGRADE_COST);

    if (side === 'left') {
      this.leftMaxBaseHp += CONFIG.BASE_UPGRADE_HP;
      this.leftBaseHp += CONFIG.BASE_UPGRADE_HP;
    } else {
      this.rightMaxBaseHp += CONFIG.BASE_UPGRADE_HP;
      this.rightBaseHp += CONFIG.BASE_UPGRADE_HP;
    }

    this.broadcastEvent({
      event: 'BASE_UPGRADED',
      side,
      newMaxHp: side === 'left' ? this.leftMaxBaseHp : this.rightMaxBaseHp,
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
      },
      rightPlayer: {
        id: this.rightPlayerId,
        name: rightPlayer?.name || 'Player 2',
        resources: { ...this.rightResources },
        baseHp: this.rightBaseHp,
        maxBaseHp: this.rightMaxBaseHp,
      },
      units: this.units.map(u => this.toNetworkUnit(u)),
      walls: [...this.walls],
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
    this.broadcast({ type: 'GAME_STATE', state: this.getNetworkGameState() });
  }
}
