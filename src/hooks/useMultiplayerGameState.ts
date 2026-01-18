import { useGameStore } from '../stores/useGameStore';
import { useMultiplayerStore } from '../stores/useMultiplayerStore';
import type { GameState, Camera, Base, Resources, ResourceNode, Wall, Unit } from '../types';
import type { NetworkGameState, NetworkUnit, NetworkWall, NetworkResourceNode, PlayerSide } from '@shared/types/game';
import { CONFIG } from '../constants/config';

// 멀티플레이어 상태를 싱글플레이어 GameState 형식으로 변환하는 훅
export interface MultiplayerGameState {
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
  mySide: PlayerSide;
}

// NetworkUnit을 Unit으로 변환
function convertNetworkUnit(nu: NetworkUnit, mySide: PlayerSide): Unit {
  const isMyUnit = nu.side === mySide;
  return {
    id: nu.id,
    type: nu.type,
    config: CONFIG.UNITS[nu.type],
    x: nu.x,
    y: nu.y,
    hp: nu.hp,
    maxHp: nu.maxHp,
    state: nu.state,
    attackCooldown: 0,
    team: isMyUnit ? 'player' : 'enemy',
  };
}

// NetworkWall을 Wall로 변환
function convertNetworkWall(nw: NetworkWall): Wall {
  return {
    id: nw.id,
    x: nw.x,
    y: nw.y,
    hp: nw.hp,
    maxHp: nw.maxHp,
    createdAt: (nw as NetworkWall & { createdAt?: number }).createdAt ?? 0,
  };
}

// NetworkResourceNode를 ResourceNode로 변환
function convertNetworkResourceNode(nrn: NetworkResourceNode): ResourceNode {
  return {
    id: nrn.id,
    type: nrn.type,
    x: nrn.x,
    y: nrn.y,
    amount: nrn.amount,
    maxAmount: nrn.maxAmount,
  };
}

// 멀티플레이어 게임 상태를 가져오는 훅
export function useMultiplayerGameState(): MultiplayerGameState | null {
  const gameState = useMultiplayerStore((state) => state.gameState);
  const mySide = useMultiplayerStore((state) => state.mySide);
  const connectionState = useMultiplayerStore((state) => state.connectionState);
  const camera = useGameStore((state) => state.camera);
  const selectedUnit = useGameStore((state) => state.selectedUnit);

  if (!gameState || !mySide || connectionState !== 'in_game') {
    return null;
  }

  // 내 진영에 따라 플레이어/적 결정
  const myPlayer = mySide === 'left' ? gameState.leftPlayer : gameState.rightPlayer;
  const enemyPlayer = mySide === 'left' ? gameState.rightPlayer : gameState.leftPlayer;

  // 기지 위치 (서버와 동일)
  const playerBase: Base = {
    x: mySide === 'left' ? 200 : CONFIG.MAP_WIDTH - 200,
    y: CONFIG.MAP_HEIGHT / 2,
    hp: myPlayer.baseHp,
    maxHp: myPlayer.maxBaseHp,
  };

  const enemyBase: Base = {
    x: mySide === 'left' ? CONFIG.MAP_WIDTH - 200 : 200,
    y: CONFIG.MAP_HEIGHT / 2,
    hp: enemyPlayer.baseHp,
    maxHp: enemyPlayer.maxBaseHp,
  };

  // 유닛 분류
  const myUnits = gameState.units.filter((u) => u.side === mySide);
  const enemyUnitsRaw = gameState.units.filter((u) => u.side !== mySide);

  return {
    running: true,
    time: gameState.maxTime - gameState.time, // 남은 시간으로 변환
    camera,
    resources: myPlayer.resources,
    playerBase,
    enemyBase,
    units: myUnits.map((u) => convertNetworkUnit(u, mySide)),
    enemyUnits: enemyUnitsRaw.map((u) => convertNetworkUnit(u, mySide)),
    resourceNodes: gameState.resourceNodes.map(convertNetworkResourceNode),
    walls: gameState.walls.map(convertNetworkWall),
    selectedUnit,
    mySide,
  };
}

// 게임 모드에 따라 적절한 상태를 반환하는 통합 훅
export function useGameStateByMode(): { state: GameState | MultiplayerGameState; isMultiplayer: boolean } {
  const gameMode = useGameStore((state) => state.gameMode);
  const singlePlayerState = useGameStore.getState();
  const multiplayerState = useMultiplayerGameState();

  if (gameMode === 'multiplayer' && multiplayerState) {
    return { state: multiplayerState, isMultiplayer: true };
  }

  return { state: singlePlayerState, isMultiplayer: false };
}

// 멀티플레이어용 자원 가져오기
export function useMultiplayerResources(): Resources | null {
  const gameState = useMultiplayerStore((state) => state.gameState);
  const mySide = useMultiplayerStore((state) => state.mySide);

  if (!gameState || !mySide) return null;

  return mySide === 'left'
    ? gameState.leftPlayer.resources
    : gameState.rightPlayer.resources;
}

// 통합 자원 훅
export function useResourcesByMode(): Resources {
  const gameMode = useGameStore((state) => state.gameMode);
  const singlePlayerResources = useGameStore((state) => state.resources);
  const multiplayerResources = useMultiplayerResources();

  if (gameMode === 'multiplayer' && multiplayerResources) {
    return multiplayerResources;
  }

  return singlePlayerResources;
}

// 통합 기지 HP 훅
export function useBaseHpByMode(): { player: Base; enemy: Base } {
  const gameMode = useGameStore((state) => state.gameMode);
  const playerBase = useGameStore((state) => state.playerBase);
  const enemyBase = useGameStore((state) => state.enemyBase);
  const multiplayerState = useMultiplayerGameState();

  if (gameMode === 'multiplayer' && multiplayerState) {
    return {
      player: multiplayerState.playerBase,
      enemy: multiplayerState.enemyBase,
    };
  }

  return { player: playerBase, enemy: enemyBase };
}

// 통합 게임 시간 훅
export function useGameTimeByMode(): number {
  const gameMode = useGameStore((state) => state.gameMode);
  const singlePlayerTime = useGameStore((state) => state.time);
  const gameState = useMultiplayerStore((state) => state.gameState);

  if (gameMode === 'multiplayer' && gameState) {
    return gameState.maxTime - gameState.time; // 남은 시간
  }

  return singlePlayerTime;
}

// 내 진영 가져오기
export function useMySide(): PlayerSide | null {
  return useMultiplayerStore((state) => state.mySide);
}
