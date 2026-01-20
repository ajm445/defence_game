import { create } from 'zustand';
import type {
  ServerMessage,
  ConnectionState,
  MatchInfo,
  RoomInfo,
  GameEvent,
} from '@shared/types/network';
import type {
  NetworkGameState,
  PlayerSide,
  Resources,
} from '@shared/types/game';
import { wsClient } from '../services/WebSocketClient';
import { effectManager } from '../effects';
import { EffectType } from '../types/effect';
import { CONFIG } from '../constants/config';
import { soundManager } from '../services/SoundManager';

interface MultiplayerState {
  // 연결 상태
  connectionState: ConnectionState;
  playerId: string | null;
  playerName: string;

  // 방 상태
  roomInfo: RoomInfo | null;
  matchInfo: MatchInfo | null;

  // 게임 상태
  countdown: number;
  gameState: NetworkGameState | null;
  mySide: PlayerSide | null;

  // 결과
  gameResult: {
    result: 'win' | 'lose' | 'draw';
    reason: string;
  } | null;

  // 에러
  error: string | null;

  // 액션
  connect: (playerName: string) => Promise<void>;
  disconnect: () => void;
  createRoom: () => void;
  joinRoom: (roomCode: string) => void;
  leaveRoom: () => void;
  setPlayerName: (name: string) => void;
  reset: () => void;
}

const initialState = {
  connectionState: 'disconnected' as ConnectionState,
  playerId: null,
  playerName: '',
  roomInfo: null,
  matchInfo: null,
  countdown: 0,
  gameState: null,
  mySide: null,
  gameResult: null,
  error: null,
};

export const useMultiplayerStore = create<MultiplayerState>((set, get) => {
  // 메시지 핸들러
  const handleMessage = (message: ServerMessage) => {
    switch (message.type) {
      case 'CONNECTED':
        set({
          connectionState: 'connected',
          playerId: message.playerId,
        });
        break;

      case 'ROOM_CREATED':
        set({
          connectionState: 'in_room_waiting',
          roomInfo: {
            roomId: message.roomId,
            roomCode: message.roomCode,
            isHost: true,
            side: 'left',
          },
        });
        break;

      case 'ROOM_JOINED':
        set((state) => ({
          connectionState: 'matched',
          roomInfo: state.roomInfo
            ? {
                ...state.roomInfo,
                opponentName: message.opponent,
              }
            : {
                roomId: message.roomId,
                roomCode: '',
                isHost: false,
                opponentName: message.opponent,
                side: message.side,
              },
          matchInfo: {
            roomId: message.roomId,
            opponentName: message.opponent,
            side: message.side,
          },
          mySide: message.side,
        }));
        break;

      case 'PLAYER_JOINED':
        set((state) => ({
          connectionState: 'in_room_ready',
          roomInfo: state.roomInfo
            ? { ...state.roomInfo, opponentName: message.opponent }
            : null,
        }));
        break;

      case 'PLAYER_LEFT':
        set((state) => ({
          connectionState: 'in_room_waiting',
          roomInfo: state.roomInfo
            ? { ...state.roomInfo, opponentName: undefined }
            : null,
          matchInfo: null,
        }));
        break;

      case 'ROOM_ERROR':
        set({ error: message.message });
        break;

      case 'GAME_COUNTDOWN':
        set({ countdown: message.seconds });
        break;

      case 'GAME_START':
        set({
          connectionState: 'in_game',
          gameState: message.state,
          countdown: 0,
        });
        break;

      case 'GAME_STATE':
        set({ gameState: message.state });
        break;

      case 'GAME_EVENT':
        handleGameEvent(message.event, set, get);
        break;

      case 'GAME_OVER':
        soundManager.play(message.result === 'win' ? 'victory' : 'defeat');
        set({
          gameResult: {
            result: message.result,
            reason: message.reason,
          },
        });
        break;

      case 'OPPONENT_DISCONNECTED':
        soundManager.play('victory');
        set({
          gameResult: {
            result: 'win',
            reason: '상대방 연결 끊김',
          },
        });
        break;

      case 'ERROR':
        set({ error: message.message });
        break;
    }
  };

  return {
    ...initialState,

    connect: async (playerName: string) => {
      set({ playerName, connectionState: 'connecting', error: null });

      try {
        await wsClient.connect(playerName);
        wsClient.addMessageHandler(handleMessage);
      } catch (error) {
        set({
          connectionState: 'disconnected',
          error: '서버 연결에 실패했습니다.',
        });
        throw error;
      }
    },

    disconnect: () => {
      wsClient.disconnect();
      set(initialState);
    },

    createRoom: () => {
      const { playerName } = get();
      wsClient.createRoom(playerName || 'Player');
    },

    joinRoom: (roomCode: string) => {
      const { playerName } = get();
      wsClient.joinRoom(roomCode, playerName || 'Player');
    },

    leaveRoom: () => {
      wsClient.leaveRoom();
      set({
        connectionState: 'connected',
        roomInfo: null,
        matchInfo: null,
      });
    },

    setPlayerName: (name: string) => {
      set({ playerName: name });
    },

    reset: () => {
      set({
        roomInfo: null,
        matchInfo: null,
        countdown: 0,
        gameState: null,
        mySide: null,
        gameResult: null,
        error: null,
        connectionState: wsClient.isConnected() ? 'connected' : 'disconnected',
      });
    },
  };
});

// 유닛 타입에 따른 공격 이펙트 결정
function getAttackEffectType(unitType: string): EffectType {
  switch (unitType) {
    case 'ranged':
      return 'attack_ranged';
    case 'mage':
      return 'attack_mage';
    default:
      return 'attack_melee';
  }
}

// 유닛 타입에 따른 채집 이펙트 결정
function getGatherEffectType(unitType: string): EffectType {
  switch (unitType) {
    case 'woodcutter':
      return 'gather_wood';
    case 'miner':
      return 'gather_stone';
    case 'gatherer':
      return 'gather_herb';
    case 'goldminer':
      return 'gather_gold';
    default:
      return 'gather_wood';
  }
}

// 게임 이벤트 처리 헬퍼
function handleGameEvent(
  event: GameEvent,
  set: (state: Partial<MultiplayerState>) => void,
  get: () => MultiplayerState
) {
  const { gameState, mySide } = get();
  if (!gameState) return;

  switch (event.event) {
    case 'UNIT_SPAWNED':
      // 내 유닛이 생성될 때만 사운드 재생
      if (event.unit.side === mySide) {
        soundManager.play('unit_spawn');
      }
      set({
        gameState: {
          ...gameState,
          units: [...gameState.units, event.unit],
        },
      });
      break;

    case 'UNIT_DIED': {
      // 내 유닛이 죽을 때만 사운드 재생
      const deadUnit = gameState.units.find((u) => u.id === event.unitId);
      if (deadUnit && deadUnit.side === mySide) {
        soundManager.play('unit_death');
      }
      set({
        gameState: {
          ...gameState,
          units: gameState.units.filter((u) => u.id !== event.unitId),
        },
      });
      break;
    }

    case 'UNIT_MOVED':
      set({
        gameState: {
          ...gameState,
          units: gameState.units.map((u) =>
            u.id === event.unitId ? { ...u, x: event.x, y: event.y } : u
          ),
        },
      });
      break;

    case 'UNIT_ATTACKED': {
      // 공격 이펙트 생성
      const attacker = gameState.units.find((u) => u.id === event.attackerId);
      const target = gameState.units.find((u) => u.id === event.targetId);

      if (attacker && target) {
        const effectType = getAttackEffectType(attacker.type);
        effectManager.createEffect(effectType, target.x, target.y, target.x, target.y);
        // 내 유닛이 공격할 때만 사운드 재생
        if (attacker.side === mySide) {
          if (effectType === 'attack_melee') {
            soundManager.play('attack_melee');
          } else if (effectType === 'attack_ranged') {
            soundManager.play('attack_ranged');
          } else if (effectType === 'attack_mage') {
            soundManager.play('attack_mage');
          }
        }
      }

      // HP 업데이트
      set({
        gameState: {
          ...gameState,
          units: gameState.units.map((u) =>
            u.id === event.targetId
              ? { ...u, hp: Math.max(0, u.hp - event.damage) }
              : u
          ),
        },
      });
      break;
    }

    case 'UNIT_HEALED': {
      // 힐 이펙트 생성
      effectManager.createEffect('heal', event.x, event.y);
      // 내 힐러가 힐할 때만 사운드 재생
      const healer = gameState.units.find((u) => u.id === event.healerId);
      if (healer && healer.side === mySide) {
        soundManager.play('heal');
      }
      break;
    }

    case 'RESOURCE_GATHERED': {
      // 채집 이펙트 생성
      const effectType = getGatherEffectType(event.unitType);
      const created = effectManager.createGatherEffect(effectType, event.x, event.y, event.unitId);
      // 내 유닛이 채집할 때만 사운드 재생
      const gatherer = gameState.units.find((u) => u.id === event.unitId);
      if (created && gatherer && gatherer.side === mySide) {
        soundManager.play('resource_collect');
      }
      break;
    }

    case 'BASE_DAMAGED': {
      // 본진 공격 이펙트 생성
      const baseX = event.side === 'left' ? 200 : CONFIG.MAP_WIDTH - 200;
      const baseY = CONFIG.MAP_HEIGHT / 2;
      effectManager.createEffect('attack_melee', baseX, baseY);

      if (event.side === 'left') {
        set({
          gameState: {
            ...gameState,
            leftPlayer: { ...gameState.leftPlayer, baseHp: event.hp },
          },
        });
      } else {
        set({
          gameState: {
            ...gameState,
            rightPlayer: { ...gameState.rightPlayer, baseHp: event.hp },
          },
        });
      }
      break;
    }

    case 'WALL_BUILT':
      // 내 벽을 지을 때만 사운드 재생
      if (event.wall.side === mySide) {
        soundManager.play('build_wall');
      }
      set({
        gameState: {
          ...gameState,
          walls: [...gameState.walls, event.wall],
        },
      });
      break;

    case 'WALL_DAMAGED': {
      // 벽 피격 이펙트
      const wall = gameState.walls.find((w) => w.id === event.wallId);
      if (wall) {
        effectManager.createEffect('attack_melee', wall.x, wall.y);
      }

      set({
        gameState: {
          ...gameState,
          walls: gameState.walls.map((w) =>
            w.id === event.wallId ? { ...w, hp: event.hp } : w
          ),
        },
      });
      break;
    }

    case 'WALL_DESTROYED':
      set({
        gameState: {
          ...gameState,
          walls: gameState.walls.filter((w) => w.id !== event.wallId),
        },
      });
      break;

    case 'RESOURCE_UPDATED':
      if (event.side === 'left') {
        set({
          gameState: {
            ...gameState,
            leftPlayer: { ...gameState.leftPlayer, resources: event.resources },
          },
        });
      } else {
        set({
          gameState: {
            ...gameState,
            rightPlayer: { ...gameState.rightPlayer, resources: event.resources },
          },
        });
      }
      break;

    case 'NODE_DEPLETED':
      set({
        gameState: {
          ...gameState,
          resourceNodes: gameState.resourceNodes.map((n) =>
            n.id === event.nodeId ? { ...n, amount: 0 } : n
          ),
        },
      });
      break;

    case 'NODE_REGENERATED':
      set({
        gameState: {
          ...gameState,
          resourceNodes: gameState.resourceNodes.map((n) =>
            n.id === event.nodeId ? { ...n, amount: event.amount } : n
          ),
        },
      });
      break;
  }
}

// 편의 훅들
export const useMyResources = (): Resources | null => {
  return useMultiplayerStore((state) => {
    if (!state.gameState || !state.mySide) return null;
    return state.mySide === 'left'
      ? state.gameState.leftPlayer.resources
      : state.gameState.rightPlayer.resources;
  });
};

export const useOpponentResources = (): Resources | null => {
  return useMultiplayerStore((state) => {
    if (!state.gameState || !state.mySide) return null;
    return state.mySide === 'left'
      ? state.gameState.rightPlayer.resources
      : state.gameState.leftPlayer.resources;
  });
};

export const useMyBaseHp = (): { hp: number; maxHp: number } | null => {
  return useMultiplayerStore((state) => {
    if (!state.gameState || !state.mySide) return null;
    const player =
      state.mySide === 'left'
        ? state.gameState.leftPlayer
        : state.gameState.rightPlayer;
    return { hp: player.baseHp, maxHp: player.maxBaseHp };
  });
};

export const useOpponentBaseHp = (): { hp: number; maxHp: number } | null => {
  return useMultiplayerStore((state) => {
    if (!state.gameState || !state.mySide) return null;
    const player =
      state.mySide === 'left'
        ? state.gameState.rightPlayer
        : state.gameState.leftPlayer;
    return { hp: player.baseHp, maxHp: player.maxBaseHp };
  });
};
