import { create } from 'zustand';
import { useShallow } from 'zustand/shallow';
import type { ServerMessage } from '@shared/types/network';
import type {
  CoopPlayerInfo,
  CoopRoomInfo,
  CoopConnectionState,
  RPGCoopGameState,
  RPGCoopGameEvent,
  RPGCoopGameResult,
  NetworkCoopHero,
  NetworkCoopEnemy,
} from '@shared/types/rpgNetwork';
import type { HeroClass, SkillEffect } from '../types/rpg';
import { wsClient } from '../services/WebSocketClient';
import { effectManager } from '../effects';
import { soundManager } from '../services/SoundManager';

interface RPGCoopState {
  // 연결 상태
  connectionState: CoopConnectionState;
  playerId: string | null;
  playerName: string;

  // 방 상태
  roomInfo: CoopRoomInfo | null;
  players: CoopPlayerInfo[];
  myIndex: number;
  selectedClass: HeroClass;

  // 게임 상태
  countdown: number;
  gameState: RPGCoopGameState | null;
  myHeroId: string | null;

  // 로컬 클라이언트 예측 상태
  localHeroPosition: { x: number; y: number } | null;
  localMoveDirection: { x: number; y: number } | null;  // 클라이언트측 이동 방향
  lastSentDirection: { x: number; y: number } | null;   // 마지막으로 서버에 전송한 방향

  // 결과
  gameResult: RPGCoopGameResult | null;

  // UI 상태
  hoveredSkill: 'Q' | 'W' | 'E' | null;
  mousePosition: { x: number; y: number };

  // 에러
  error: string | null;

  // 액션
  setHoveredSkill: (skill: 'Q' | 'W' | 'E' | null) => void;
  setMousePosition: (x: number, y: number) => void;
  connect: (playerName: string) => Promise<void>;
  disconnect: () => void;
  createRoom: () => void;
  joinRoom: (roomCode: string) => void;
  leaveRoom: () => void;
  setPlayerName: (name: string) => void;
  setSelectedClass: (heroClass: HeroClass) => void;
  setReady: (isReady: boolean) => void;
  startGame: () => void;
  kickPlayer: (playerId: string) => void;
  setMoveDirection: (direction: { x: number; y: number } | null) => void;
  useSkill: (skillSlot: 'Q' | 'W' | 'E', targetX: number, targetY: number) => void;
  reset: () => void;

  // 상태 조회
  getMyHero: () => NetworkCoopHero | null;
  getAliveHeroes: () => NetworkCoopHero[];
  isHost: () => boolean;
  canStartGame: () => boolean;
}

const initialState = {
  connectionState: 'disconnected' as CoopConnectionState,
  playerId: null,
  playerName: '',
  roomInfo: null,
  players: [],
  myIndex: -1,
  selectedClass: 'warrior' as HeroClass,
  countdown: 0,
  gameState: null,
  myHeroId: null,
  localHeroPosition: null,
  localMoveDirection: null,
  lastSentDirection: null,
  gameResult: null,
  hoveredSkill: null as 'Q' | 'W' | 'E' | null,
  mousePosition: { x: 0, y: 0 },
  error: null,
};

export const useRPGCoopStore = create<RPGCoopState>((set, get) => {
  // 메시지 핸들러
  const handleMessage = (message: ServerMessage) => {
    switch (message.type) {
      case 'CONNECTED':
        set({
          connectionState: 'connected',
          playerId: message.playerId,
        });
        break;

      // 협동 방 관련
      case 'COOP_ROOM_CREATED':
        set((state) => ({
          connectionState: 'in_coop_lobby',
          roomInfo: {
            roomId: message.roomId,
            roomCode: message.roomCode,
            isHost: true,
            players: [{
              id: state.playerId || '',
              name: state.playerName,
              heroClass: state.selectedClass,
              isHost: true,
              isReady: false,
              connected: true,
            }],
            myIndex: 0,
          },
          players: [{
            id: state.playerId || '',
            name: state.playerName,
            heroClass: state.selectedClass,
            isHost: true,
            isReady: false,
            connected: true,
          }],
          myIndex: 0,
        }));
        break;

      case 'COOP_ROOM_JOINED':
        set({
          connectionState: 'in_coop_lobby',
          roomInfo: {
            roomId: message.roomId,
            roomCode: '',
            isHost: message.players[message.yourIndex]?.isHost || false,
            players: message.players,
            myIndex: message.yourIndex,
          },
          players: message.players,
          myIndex: message.yourIndex,
        });
        break;

      case 'COOP_PLAYER_JOINED':
        set((state) => ({
          players: [...state.players, message.player],
          roomInfo: state.roomInfo ? {
            ...state.roomInfo,
            players: [...state.roomInfo.players, message.player],
          } : null,
        }));
        soundManager.play('unit_spawn');
        break;

      case 'COOP_PLAYER_LEFT':
        set((state) => {
          const newPlayers = state.players.filter(p => p.id !== message.playerId);
          const newIndex = newPlayers.findIndex(p => p.id === state.playerId);
          return {
            players: newPlayers,
            myIndex: newIndex,
            roomInfo: state.roomInfo ? {
              ...state.roomInfo,
              players: newPlayers,
              myIndex: newIndex,
            } : null,
          };
        });
        break;

      case 'COOP_PLAYER_READY':
        set((state) => ({
          players: state.players.map(p =>
            p.id === message.playerId ? { ...p, isReady: message.isReady } : p
          ),
        }));
        break;

      case 'COOP_PLAYER_CLASS_CHANGED':
        set((state) => ({
          players: state.players.map(p =>
            p.id === message.playerId ? { ...p, heroClass: message.heroClass } : p
          ),
        }));
        break;

      case 'COOP_PLAYER_KICKED':
        if (message.playerId === get().playerId) {
          set({
            connectionState: 'connected',
            roomInfo: null,
            players: [],
            myIndex: -1,
            error: message.reason,
          });
        } else {
          set((state) => ({
            players: state.players.filter(p => p.id !== message.playerId),
          }));
        }
        break;

      case 'COOP_ROOM_ERROR':
        set({ error: message.message });
        break;

      // 게임 시작
      case 'COOP_GAME_COUNTDOWN':
        set({ countdown: message.seconds, connectionState: 'coop_countdown' });
        break;

      case 'COOP_GAME_START':
        set({
          connectionState: 'coop_in_game',
          gameState: message.state,
          myHeroId: message.yourHeroId,
          countdown: 0,
          localHeroPosition: null,
          localMoveDirection: null,
          lastSentDirection: null,
        });
        soundManager.play('wave_start');
        break;

      // 게임 진행
      case 'COOP_GAME_STATE':
        handleGameState(message.state, set, get);
        break;

      case 'COOP_GAME_EVENT':
        handleGameEvent(message.event, set, get);
        break;

      case 'COOP_WAVE_START':
        // 보스 웨이브(10의 배수)에만 경고음 재생
        if (message.waveNumber % 10 === 0) {
          soundManager.play('warning');
          soundManager.play('boss_spawn');
        } else {
          soundManager.play('wave_start');
        }
        break;

      case 'COOP_WAVE_CLEAR':
        soundManager.play('wave_clear');
        break;

      case 'COOP_GAME_OVER':
        soundManager.play(message.result.victory ? 'victory' : 'defeat');
        set({ gameResult: message.result });
        break;

      case 'COOP_PLAYER_DISCONNECTED':
        set((state) => ({
          players: state.players.map(p =>
            p.id === message.playerId ? { ...p, connected: false } : p
          ),
        }));
        break;

      case 'COOP_PLAYER_RECONNECTED':
        set((state) => ({
          players: state.players.map(p =>
            p.id === message.playerId ? { ...p, connected: true } : p
          ),
        }));
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
      const { playerName, selectedClass } = get();
      wsClient.createCoopRoom(playerName || 'Player', selectedClass);
    },

    joinRoom: (roomCode: string) => {
      const { playerName, selectedClass } = get();
      wsClient.joinCoopRoom(roomCode, playerName || 'Player', selectedClass);
    },

    leaveRoom: () => {
      wsClient.leaveCoopRoom();
      set({
        connectionState: 'connected',
        roomInfo: null,
        players: [],
        myIndex: -1,
      });
    },

    setPlayerName: (name: string) => {
      set({ playerName: name });
    },

    setSelectedClass: (heroClass: HeroClass) => {
      const { connectionState } = get();
      set({ selectedClass: heroClass });

      // 로비에 있으면 서버에도 알림
      if (connectionState === 'in_coop_lobby') {
        wsClient.changeCoopClass(heroClass);
      }
    },

    setReady: (isReady: boolean) => {
      if (isReady) {
        wsClient.coopReady();
      } else {
        wsClient.coopUnready();
      }
    },

    startGame: () => {
      wsClient.startCoopGame();
    },

    kickPlayer: (playerId: string) => {
      wsClient.kickCoopPlayer(playerId);
    },

    setMoveDirection: (direction: { x: number; y: number } | null) => {
      const { gameState, myHeroId, lastSentDirection } = get();
      if (!gameState || !myHeroId) return;

      const myHero = gameState.heroes.find(h => h.id === myHeroId);
      if (!myHero || myHero.isDead) return;

      // 방향이 변경되었는지 확인 (불필요한 전송 방지)
      const directionChanged =
        (direction === null && lastSentDirection !== null) ||
        (direction !== null && lastSentDirection === null) ||
        (direction !== null && lastSentDirection !== null &&
          (Math.abs(direction.x - lastSentDirection.x) > 0.01 ||
           Math.abs(direction.y - lastSentDirection.y) > 0.01));

      if (directionChanged) {
        // 로컬 상태 업데이트
        set({
          localMoveDirection: direction,
          lastSentDirection: direction,
        });

        // 서버에 방향 전송
        wsClient.coopHeroMove(direction);
      }
    },

    useSkill: (skillSlot: 'Q' | 'W' | 'E', targetX: number, targetY: number) => {
      const { gameState, myHeroId } = get();
      if (!gameState || !myHeroId) return;

      const myHero = gameState.heroes.find(h => h.id === myHeroId);
      if (!myHero || myHero.isDead) return;

      // 쿨다운 체크
      if (myHero.skillCooldowns[skillSlot] > 0) return;

      // 스킬 타입 매핑
      const skillTypeMap: Record<HeroClass, Record<string, string>> = {
        warrior: { Q: 'warrior_q', W: 'warrior_w', E: 'warrior_e' },
        archer: { Q: 'archer_q', W: 'archer_w', E: 'archer_e' },
        knight: { Q: 'knight_q', W: 'knight_w', E: 'knight_e' },
        mage: { Q: 'mage_q', W: 'mage_w', E: 'mage_e' },
      };

      const skillType = skillTypeMap[myHero.heroClass][skillSlot] as any;
      wsClient.coopUseSkill(skillType, targetX, targetY);
    },

    reset: () => {
      set({
        roomInfo: null,
        players: [],
        myIndex: -1,
        countdown: 0,
        gameState: null,
        myHeroId: null,
        localHeroPosition: null,
        localMoveDirection: null,
        lastSentDirection: null,
        gameResult: null,
        hoveredSkill: null,
        error: null,
        connectionState: wsClient.isConnected() ? 'connected' : 'disconnected',
      });
    },

    setHoveredSkill: (skill) => {
      set({ hoveredSkill: skill });
    },

    setMousePosition: (x, y) => {
      set({ mousePosition: { x, y } });
    },

    getMyHero: () => {
      const { gameState, myHeroId } = get();
      if (!gameState || !myHeroId) return null;
      return gameState.heroes.find(h => h.id === myHeroId) || null;
    },

    getAliveHeroes: () => {
      const { gameState } = get();
      if (!gameState) return [];
      return gameState.heroes.filter(h => !h.isDead);
    },

    isHost: () => {
      const { roomInfo, players, myIndex } = get();
      if (!roomInfo || myIndex < 0) return false;
      return players[myIndex]?.isHost || false;
    },

    canStartGame: () => {
      const { players } = get();
      if (players.length < 2) return false;
      // 호스트 제외 모든 플레이어가 준비됐는지 확인
      return players.every(p => p.isHost || p.isReady);
    },
  };
});

// 게임 상태 업데이트 처리
function handleGameState(
  state: RPGCoopGameState,
  set: (state: Partial<RPGCoopState> | ((state: RPGCoopState) => Partial<RPGCoopState>)) => void,
  _get: () => RPGCoopState
) {
  // 서버 상태 업데이트 (위치 보정은 게임 루프에서 처리)
  set({ gameState: state });
}

// 게임 이벤트 처리
function handleGameEvent(
  event: RPGCoopGameEvent,
  _set: (state: Partial<RPGCoopState> | ((state: RPGCoopState) => Partial<RPGCoopState>)) => void,
  get: () => RPGCoopState
) {
  const { gameState, myHeroId } = get();
  if (!gameState) return;

  switch (event.event) {
    case 'HERO_DAMAGED': {
      // 피격 이펙트
      const hero = gameState.heroes.find(h => h.id === event.heroId);
      if (hero) {
        effectManager.createEffect('attack_melee', hero.x, hero.y);
        if (event.heroId === myHeroId) {
          soundManager.play('hero_hit');
        }
      }
      break;
    }

    case 'HERO_HEALED': {
      const hero = gameState.heroes.find(h => h.id === event.heroId);
      if (hero) {
        effectManager.createEffect('heal', hero.x, hero.y);
        soundManager.play('heal');
      }
      break;
    }

    case 'HERO_DIED': {
      if (event.heroId === myHeroId) {
        soundManager.play('hero_death');
        // 로컬 이동 상태 초기화
        useRPGCoopStore.setState({
          localHeroPosition: null,
          localMoveDirection: null,
          lastSentDirection: null,
        });
      }
      break;
    }

    case 'HERO_REVIVED': {
      if (event.heroId === myHeroId) {
        soundManager.play('hero_revive');
        // 부활 위치로 로컬 상태 초기화
        useRPGCoopStore.setState({
          localHeroPosition: { x: event.x, y: event.y },
          localMoveDirection: null,
          lastSentDirection: null,
        });
      }
      effectManager.createEffect('heal', event.x, event.y);
      break;
    }

    case 'HERO_LEVEL_UP': {
      const hero = gameState.heroes.find(h => h.id === event.heroId);
      if (hero) {
        effectManager.createEffect('level_up', hero.x, hero.y);
        if (event.heroId === myHeroId) {
          soundManager.play('level_up');
        }
      }
      break;
    }

    case 'SKILL_USED': {
      // 스킬 사운드
      const hero = gameState.heroes.find(h => h.id === event.heroId);
      if (hero && event.heroId === myHeroId) {
        soundManager.play('skill_use');
      }
      break;
    }

    case 'ENEMY_DAMAGED': {
      const enemy = gameState.enemies.find(e => e.id === event.enemyId);
      if (enemy) {
        effectManager.createEffect('attack_melee', enemy.x, enemy.y);
      }
      break;
    }

    case 'ENEMY_DIED': {
      soundManager.play('enemy_death');
      break;
    }

    case 'ENEMY_STUNNED': {
      const enemy = gameState.enemies.find(e => e.id === event.enemyId);
      if (enemy) {
        effectManager.createEffect('stun', enemy.x, enemy.y);
      }
      break;
    }

    case 'SKILL_EFFECT_STARTED': {
      // 스킬 이펙트 생성
      const skillEffect = event.effect;
      if (skillEffect.position) {
        // 스킬 타입에 따른 이펙트 생성
        if (skillEffect.type.includes('meteor')) {
          effectManager.createEffect('meteor', skillEffect.position.x, skillEffect.position.y);
        } else if (skillEffect.type.includes('rain')) {
          effectManager.createEffect('arrow_rain', skillEffect.position.x, skillEffect.position.y);
        } else if (skillEffect.type.includes('fireball')) {
          effectManager.createEffect('fireball', skillEffect.position.x, skillEffect.position.y);
        }
      }
      break;
    }
  }
}

// 빈 배열 상수 (참조 안정성)
const EMPTY_HEROES: NetworkCoopHero[] = [];
const EMPTY_ENEMIES: NetworkCoopEnemy[] = [];
const EMPTY_PLAYERS: CoopPlayerInfo[] = [];

// 편의 훅들
export const useMyCoopHero = (): NetworkCoopHero | null => {
  const myHeroId = useRPGCoopStore((state) => state.myHeroId);
  const heroes = useRPGCoopStore((state) => state.gameState?.heroes);

  if (!heroes || !myHeroId) return null;
  return heroes.find(h => h.id === myHeroId) || null;
};

export const useCoopHeroes = (): NetworkCoopHero[] => {
  return useRPGCoopStore((state) => state.gameState?.heroes ?? EMPTY_HEROES);
};

export const useCoopEnemies = (): NetworkCoopEnemy[] => {
  return useRPGCoopStore((state) => state.gameState?.enemies ?? EMPTY_ENEMIES);
};

export const useCoopWaveInfo = () => {
  return useRPGCoopStore(
    useShallow((state) => ({
      currentWave: state.gameState?.currentWave ?? 0,
      waveInProgress: state.gameState?.waveInProgress ?? false,
      enemiesRemaining: state.gameState?.enemiesRemaining ?? 0,
    }))
  );
};

export const useCoopGameTime = () => {
  return useRPGCoopStore((state) => state.gameState?.gameTime ?? 0);
};

export const useCoopPlayers = () => {
  return useRPGCoopStore((state) => state.players ?? EMPTY_PLAYERS);
};

export const useCoopRoomCode = () => {
  return useRPGCoopStore((state) => state.roomInfo?.roomCode ?? '');
};
