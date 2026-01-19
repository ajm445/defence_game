import { useRef, useCallback, useEffect } from 'react';
import { useMultiplayerStore } from '../stores/useMultiplayerStore';
import type { NetworkGameState, NetworkUnit, NetworkWall, Resources } from '@shared/types/game';

// 보간 설정
const INTERPOLATION_DELAY = 50; // ms - 서버 업데이트 간격에 맞춤
const GOLD_PER_SECOND = 4;

interface InterpolatedUnit extends NetworkUnit {
  prevX: number;
  prevY: number;
  targetX: number;
  targetY: number;
  lastUpdateTime: number;
}

interface InterpolatedState {
  units: Map<string, InterpolatedUnit>;
  walls: Map<string, NetworkWall>;
  leftResources: Resources & { lastGoldUpdate: number; predictedGold: number };
  rightResources: Resources & { lastGoldUpdate: number; predictedGold: number };
  leftBaseHp: number;
  rightBaseHp: number;
  leftMaxBaseHp: number;
  rightMaxBaseHp: number;
  leftUpgradeLevel: number;
  rightUpgradeLevel: number;
  leftGoldPerSecond: number;
  rightGoldPerSecond: number;
  time: number;
  maxTime: number;
  serverTime: number;
  lastServerUpdate: number;
}

// 전역 상태 (requestAnimationFrame에서 사용)
let interpolatedState: InterpolatedState | null = null;
let lastFrameTime = 0;

// 선형 보간 함수
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(1, Math.max(0, t));
}

// 부드러운 보간 (easeOutQuad)
function smoothLerp(a: number, b: number, t: number): number {
  const clampedT = Math.min(1, Math.max(0, t));
  const easedT = 1 - (1 - clampedT) * (1 - clampedT);
  return a + (b - a) * easedT;
}

export function initInterpolatedState(serverState: NetworkGameState): void {
  const now = performance.now();

  const units = new Map<string, InterpolatedUnit>();
  for (const unit of serverState.units) {
    units.set(unit.id, {
      ...unit,
      prevX: unit.x,
      prevY: unit.y,
      targetX: unit.x,
      targetY: unit.y,
      lastUpdateTime: now,
    });
  }

  const walls = new Map<string, NetworkWall>();
  for (const wall of serverState.walls) {
    walls.set(wall.id, { ...wall });
  }

  interpolatedState = {
    units,
    walls,
    leftResources: {
      ...serverState.leftPlayer.resources,
      lastGoldUpdate: now,
      predictedGold: serverState.leftPlayer.resources.gold,
    },
    rightResources: {
      ...serverState.rightPlayer.resources,
      lastGoldUpdate: now,
      predictedGold: serverState.rightPlayer.resources.gold,
    },
    leftBaseHp: serverState.leftPlayer.baseHp,
    rightBaseHp: serverState.rightPlayer.baseHp,
    leftMaxBaseHp: serverState.leftPlayer.maxBaseHp,
    rightMaxBaseHp: serverState.rightPlayer.maxBaseHp,
    leftUpgradeLevel: serverState.leftPlayer.upgradeLevel,
    rightUpgradeLevel: serverState.rightPlayer.upgradeLevel,
    leftGoldPerSecond: serverState.leftPlayer.goldPerSecond,
    rightGoldPerSecond: serverState.rightPlayer.goldPerSecond,
    time: serverState.time,
    maxTime: serverState.maxTime,
    serverTime: serverState.time,
    lastServerUpdate: now,
  };

  lastFrameTime = now;
}

export function updateFromServer(serverState: NetworkGameState): void {
  if (!interpolatedState) {
    initInterpolatedState(serverState);
    return;
  }

  const now = performance.now();
  const state = interpolatedState;

  // 유닛 업데이트
  const serverUnitIds = new Set(serverState.units.map(u => u.id));

  // 새 유닛 추가 및 기존 유닛 업데이트
  for (const serverUnit of serverState.units) {
    const existing = state.units.get(serverUnit.id);

    if (existing) {
      // 기존 유닛: 이전 위치를 현재 보간된 위치로, 타겟을 서버 위치로
      existing.prevX = existing.x;
      existing.prevY = existing.y;
      existing.targetX = serverUnit.x;
      existing.targetY = serverUnit.y;
      existing.hp = serverUnit.hp;
      existing.maxHp = serverUnit.maxHp;
      existing.state = serverUnit.state;
      existing.lastUpdateTime = now;
    } else {
      // 새 유닛
      state.units.set(serverUnit.id, {
        ...serverUnit,
        prevX: serverUnit.x,
        prevY: serverUnit.y,
        targetX: serverUnit.x,
        targetY: serverUnit.y,
        lastUpdateTime: now,
      });
    }
  }

  // 삭제된 유닛 제거
  for (const unitId of state.units.keys()) {
    if (!serverUnitIds.has(unitId)) {
      state.units.delete(unitId);
    }
  }

  // 벽 업데이트
  const serverWallIds = new Set(serverState.walls.map(w => w.id));

  for (const serverWall of serverState.walls) {
    state.walls.set(serverWall.id, { ...serverWall });
  }

  for (const wallId of state.walls.keys()) {
    if (!serverWallIds.has(wallId)) {
      state.walls.delete(wallId);
    }
  }

  // 자원 업데이트 (서버 값으로 보정)
  const leftGold = serverState.leftPlayer.resources.gold;
  const rightGold = serverState.rightPlayer.resources.gold;

  // 서버 값이 예측값보다 크면 서버 값 사용 (자원 채집 등)
  // 서버 값이 예측값보다 작으면 서버 값 사용 (자원 소비)
  state.leftResources = {
    ...serverState.leftPlayer.resources,
    lastGoldUpdate: now,
    predictedGold: leftGold,
  };

  state.rightResources = {
    ...serverState.rightPlayer.resources,
    lastGoldUpdate: now,
    predictedGold: rightGold,
  };

  // 기지 HP 업데이트
  state.leftBaseHp = serverState.leftPlayer.baseHp;
  state.rightBaseHp = serverState.rightPlayer.baseHp;
  state.leftMaxBaseHp = serverState.leftPlayer.maxBaseHp;
  state.rightMaxBaseHp = serverState.rightPlayer.maxBaseHp;

  // 업그레이드 레벨 및 골드 수입 업데이트
  state.leftUpgradeLevel = serverState.leftPlayer.upgradeLevel;
  state.rightUpgradeLevel = serverState.rightPlayer.upgradeLevel;
  state.leftGoldPerSecond = serverState.leftPlayer.goldPerSecond;
  state.rightGoldPerSecond = serverState.rightPlayer.goldPerSecond;

  // 시간 업데이트
  state.serverTime = serverState.time;
  state.maxTime = serverState.maxTime;
  state.lastServerUpdate = now;
}

export function interpolateFrame(): NetworkGameState | null {
  if (!interpolatedState) return null;

  const now = performance.now();
  const deltaTime = (now - lastFrameTime) / 1000;
  lastFrameTime = now;

  const state = interpolatedState;

  // 시간 보간 (클라이언트 측 시간 진행)
  const timeSinceUpdate = (now - state.lastServerUpdate) / 1000;
  state.time = state.serverTime + timeSinceUpdate;

  // 유닛 위치 보간
  const interpolatedUnits: NetworkUnit[] = [];

  for (const unit of state.units.values()) {
    const timeSinceUnitUpdate = now - unit.lastUpdateTime;
    const t = timeSinceUnitUpdate / INTERPOLATION_DELAY;

    // 부드러운 보간
    unit.x = smoothLerp(unit.prevX, unit.targetX, t);
    unit.y = smoothLerp(unit.prevY, unit.targetY, t);

    interpolatedUnits.push({
      id: unit.id,
      type: unit.type,
      x: unit.x,
      y: unit.y,
      hp: unit.hp,
      maxHp: unit.maxHp,
      state: unit.state,
      side: unit.side,
    });
  }

  // 골드 부드러운 증가 (1초에 4골드, 프레임 단위로 분배)
  const goldIncrement = GOLD_PER_SECOND * deltaTime;
  state.leftResources.predictedGold += goldIncrement;
  state.rightResources.predictedGold += goldIncrement;

  // 반환할 상태 구성
  return {
    time: state.time,
    maxTime: state.maxTime,
    leftPlayer: {
      id: '',
      name: '',
      resources: {
        gold: Math.floor(state.leftResources.predictedGold),
        wood: state.leftResources.wood,
        stone: state.leftResources.stone,
        herb: state.leftResources.herb,
        crystal: state.leftResources.crystal,
      },
      baseHp: state.leftBaseHp,
      maxBaseHp: state.leftMaxBaseHp,
      upgradeLevel: state.leftUpgradeLevel,
      goldPerSecond: state.leftGoldPerSecond,
    },
    rightPlayer: {
      id: '',
      name: '',
      resources: {
        gold: Math.floor(state.rightResources.predictedGold),
        wood: state.rightResources.wood,
        stone: state.rightResources.stone,
        herb: state.rightResources.herb,
        crystal: state.rightResources.crystal,
      },
      baseHp: state.rightBaseHp,
      maxBaseHp: state.rightMaxBaseHp,
      upgradeLevel: state.rightUpgradeLevel,
      goldPerSecond: state.rightGoldPerSecond,
    },
    units: interpolatedUnits,
    walls: Array.from(state.walls.values()),
    resourceNodes: [], // 자원 노드는 메인 상태에서 가져옴
  };
}

export function resetInterpolatedState(): void {
  interpolatedState = null;
  lastFrameTime = 0;
}

// React 훅: 멀티플레이어 상태 보간
export function useInterpolatedGameState() {
  const serverState = useMultiplayerStore((state) => state.gameState);
  const mySide = useMultiplayerStore((state) => state.mySide);
  const prevServerStateRef = useRef<NetworkGameState | null>(null);

  // 서버 상태 업데이트 감지
  useEffect(() => {
    if (serverState && serverState !== prevServerStateRef.current) {
      updateFromServer(serverState);
      prevServerStateRef.current = serverState;
    }
  }, [serverState]);

  // 리셋 (게임 종료 시)
  useEffect(() => {
    return () => {
      resetInterpolatedState();
    };
  }, []);

  const getInterpolatedState = useCallback((): NetworkGameState | null => {
    const interpolated = interpolateFrame();
    if (!interpolated || !serverState) return serverState;

    // 자원 노드는 서버 상태에서 가져옴
    return {
      ...interpolated,
      resourceNodes: serverState.resourceNodes,
      leftPlayer: {
        ...interpolated.leftPlayer,
        id: serverState.leftPlayer.id,
        name: serverState.leftPlayer.name,
      },
      rightPlayer: {
        ...interpolated.rightPlayer,
        id: serverState.rightPlayer.id,
        name: serverState.rightPlayer.name,
      },
    };
  }, [serverState]);

  return {
    getInterpolatedState,
    mySide,
    serverState,
  };
}
