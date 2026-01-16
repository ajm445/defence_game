import { create } from 'zustand';
import type {
  ServerMessage,
  ConnectionState,
  MatchInfo,
  GameEvent,
} from '@shared/types/network';
import type {
  NetworkGameState,
  PlayerSide,
  Resources,
} from '@shared/types/game';
import { wsClient } from '../services/WebSocketClient';

interface MultiplayerState {
  // 연결 상태
  connectionState: ConnectionState;
  playerId: string | null;
  playerName: string;

  // 매칭 상태
  queuePosition: number;
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
  joinQueue: () => void;
  leaveQueue: () => void;
  setPlayerName: (name: string) => void;
  reset: () => void;
}

const initialState = {
  connectionState: 'disconnected' as ConnectionState,
  playerId: null,
  playerName: '',
  queuePosition: 0,
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

      case 'QUEUE_JOINED':
        set({
          connectionState: 'in_queue',
          queuePosition: message.position,
        });
        break;

      case 'QUEUE_UPDATE':
        set({ queuePosition: message.position });
        break;

      case 'MATCH_FOUND':
        set({
          connectionState: 'matched',
          matchInfo: {
            roomId: message.roomId,
            opponentName: message.opponent,
            side: message.side,
          },
          mySide: message.side,
        });
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
        set({
          gameResult: {
            result: message.result,
            reason: message.reason,
          },
        });
        break;

      case 'OPPONENT_DISCONNECTED':
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

    joinQueue: () => {
      const { playerName } = get();
      wsClient.joinQueue(playerName || 'Player');
    },

    leaveQueue: () => {
      wsClient.leaveQueue();
      set({
        connectionState: 'connected',
        queuePosition: 0,
      });
    },

    setPlayerName: (name: string) => {
      set({ playerName: name });
    },

    reset: () => {
      set({
        queuePosition: 0,
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

// 게임 이벤트 처리 헬퍼
function handleGameEvent(
  event: GameEvent,
  set: (state: Partial<MultiplayerState>) => void,
  get: () => MultiplayerState
) {
  const { gameState } = get();
  if (!gameState) return;

  switch (event.event) {
    case 'UNIT_SPAWNED':
      set({
        gameState: {
          ...gameState,
          units: [...gameState.units, event.unit],
        },
      });
      break;

    case 'UNIT_DIED':
      set({
        gameState: {
          ...gameState,
          units: gameState.units.filter((u) => u.id !== event.unitId),
        },
      });
      break;

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

    case 'BASE_DAMAGED':
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

    case 'WALL_BUILT':
      set({
        gameState: {
          ...gameState,
          walls: [...gameState.walls, event.wall],
        },
      });
      break;

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
