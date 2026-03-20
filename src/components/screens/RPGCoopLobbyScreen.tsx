import React, { useEffect, useState, useCallback, useRef, useLayoutEffect } from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { useRPGStore, useMultiplayer } from '../../stores/useRPGStore';
import { useGameStore } from '../../stores/useGameStore';
import { useAuthProfile, useAuthIsGuest, useAuthStore } from '../../stores/useAuthStore';
import { soundManager } from '../../services/SoundManager';
import { CLASS_CONFIGS, DIFFICULTY_CONFIGS, ADVANCED_CLASS_CONFIGS, SECOND_ENHANCEMENT_MULTIPLIER } from '../../constants/rpgConfig';
import { MAP_THEME_LIST } from '../../constants/mapThemeConfig';
import { AdvancedHeroClass } from '../../types/rpg';
import type { MapTheme } from '../../types/rpg';
import { CHARACTER_UNLOCK_LEVELS, isCharacterUnlocked, createDefaultStatUpgrades, getStatBonus } from '../../types/auth';
import type { HeroClass, RPGDifficulty } from '../../types/rpg';
import type { WaitingCoopRoomInfo } from '@shared/types/rpgNetwork';
import { wsClient } from '../../services/WebSocketClient';
import {
  createMultiplayerRoom,
  joinMultiplayerRoom,
  leaveMultiplayerRoom,
  startMultiplayerGame,
  joinRoomByInvite,
} from '../../hooks/useNetworkSync';
import { ProfileButton } from '../ui/ProfileButton';
import { FriendSidebar } from '../ui/FriendSidebar';
import { GameInviteNotification } from '../ui/GameInviteNotification';
import { ServerStatusBar } from '../ui/ServerStatusBar';
import { ClassEncyclopediaModal } from '../ui/ClassEncyclopediaModal';
import { RankingModal } from '../ui/RankingModal';
import { LobbyChat } from '../ui/LobbyChat';
import { Emoji } from '../common/Emoji';
import { getHeroImagePath } from '../../utils/heroImages';

// localStorage에서 마지막 선택 직업 읽기 (계정별 분리)
function getLastSelectedClass(): HeroClass {
  const profile = useAuthStore.getState().profile;
  if (!profile || profile.isGuest) return 'archer';
  const saved = localStorage.getItem(`rpg_last_class_${profile.id}`) as HeroClass | null;
  const valid: HeroClass[] = ['archer', 'warrior', 'knight', 'mage'];
  return saved && valid.includes(saved) ? saved : 'archer';
}

// 난이도 색상 설정
const difficultyColors: Record<RPGDifficulty, { bg: string; border: string; text: string; hoverBg: string }> = {
  easy: { bg: 'bg-green-500/20', border: 'border-green-500', text: 'text-green-400', hoverBg: 'hover:bg-green-500/30' },
  normal: { bg: 'bg-yellow-500/20', border: 'border-yellow-500', text: 'text-yellow-400', hoverBg: 'hover:bg-yellow-500/30' },
  hard: { bg: 'bg-orange-500/20', border: 'border-orange-500', text: 'text-orange-400', hoverBg: 'hover:bg-orange-500/30' },
  extreme: { bg: 'bg-red-500/20', border: 'border-red-500', text: 'text-red-400', hoverBg: 'hover:bg-red-500/30' },
  hell: { bg: 'bg-purple-500/20', border: 'border-purple-500', text: 'text-purple-400', hoverBg: 'hover:bg-purple-500/30' },
  apocalypse: { bg: 'bg-rose-500/20', border: 'border-rose-500', text: 'text-rose-400', hoverBg: 'hover:bg-rose-500/30' },
};

const CLASS_LIST: HeroClass[] = ['archer', 'warrior', 'knight', 'mage'];

export const RPGCoopLobbyScreen: React.FC = () => {
  const setScreen = useUIStore((state) => state.setScreen);
  const resetGameUI = useUIStore((state) => state.resetGameUI);
  const isMobile = useUIStore((state) => state.isMobile);
  const setGameMode = useGameStore((state) => state.setGameMode);
  const selectedClass = useRPGStore((state) => state.selectedClass);
  const selectClass = useRPGStore((state) => state.selectClass);
  const multiplayer = useMultiplayer();

  // 프로필 및 직업 해금 확인용
  const profile = useAuthProfile();
  const isGuest = useAuthIsGuest();
  const playerLevel = profile?.playerLevel ?? 1;
  const classProgress = useAuthStore((state) => state.classProgress);

  // 현재 선택된 직업의 전직 정보 (프로필에서 변경 시 즉시 반영되도록 별도 구독)
  const currentClassAdvancedClass = useAuthStore((state) =>
    state.classProgress.find(p => p.className === selectedClass)?.advancedClass
  );
  const currentClassTier = useAuthStore((state) =>
    state.classProgress.find(p => p.className === selectedClass)?.tier
  );

  const [inputRoomCode, setInputRoomCode] = useState('');
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomList, setRoomList] = useState<WaitingCoopRoomInfo[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [selectedRoomType, setSelectedRoomType] = useState<'public' | 'private' | null>(null);
  const [selectedModalDifficulty, setSelectedModalDifficulty] = useState<RPGDifficulty | null>(null);
  const [selectedModalMapTheme, setSelectedModalMapTheme] = useState<MapTheme>('forest');
  const [privateRoomToJoin, setPrivateRoomToJoin] = useState<WaitingCoopRoomInfo | null>(null);
  const [privateRoomCode, setPrivateRoomCode] = useState('');
  // 방 목록 페이지네이션
  const [roomListPage, setRoomListPage] = useState(0);
  const ROOMS_PER_PAGE = 5;
  // 도감 모달 상태
  const [showEncyclopedia, setShowEncyclopedia] = useState(false);
  // 랭킹 모달 상태
  const [showRanking, setShowRanking] = useState(false);
  // 현재 방 설정 (로비에서 표시/변경용)
  const [roomIsPrivate, setRoomIsPrivate] = useState(false);
  const [roomDifficulty, setRoomDifficulty] = useState<RPGDifficulty>(() => useRPGStore.getState().selectedDifficulty || 'easy');
  const [roomMapTheme, setRoomMapTheme] = useState<MapTheme>('forest');
  // 방 타임아웃 경고
  const [timeoutWarning, setTimeoutWarning] = useState<string | null>(null);

  // 채팅 차단 목록
  const [blockedPlayers, setBlockedPlayers] = useState<Map<string, string>>(() => {
    try {
      const raw = localStorage.getItem('defence_game_blocked_players');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return new Map(parsed);
      }
    } catch { /* ignore */ }
    return new Map();
  });

  const saveBlockedPlayers = useCallback((next: Map<string, string>) => {
    try {
      localStorage.setItem('defence_game_blocked_players', JSON.stringify(Array.from(next.entries())));
    } catch { /* ignore */ }
  }, []);

  const handleBlockPlayer = useCallback((playerId: string, playerName: string) => {
    setBlockedPlayers((prev) => {
      const next = new Map(prev);
      next.set(playerId, playerName);
      saveBlockedPlayers(next);
      return next;
    });
  }, [saveBlockedPlayers]);

  const handleUnblockPlayer = useCallback((playerId: string) => {
    setBlockedPlayers((prev) => {
      const next = new Map(prev);
      next.delete(playerId);
      saveBlockedPlayers(next);
      return next;
    });
  }, [saveBlockedPlayers]);

  // 인라인 모달 ESC 키로 닫기
  // RPG 메인 BGM 재생 (클래스 선택에서 이미 재생 중이면 무시됨)
  useEffect(() => {
    soundManager.init();
    soundManager.playBGM('rpg_main');
  }, []);

  useEffect(() => {
    const anyModalOpen = showCreateRoomModal || !!privateRoomToJoin || showJoinInput;
    if (!anyModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showCreateRoomModal) {
          setShowCreateRoomModal(false);
          setSelectedRoomType(null);
          setSelectedModalDifficulty(null);
          setSelectedModalMapTheme('forest');
        } else if (privateRoomToJoin) {
          setPrivateRoomToJoin(null);
          setPrivateRoomCode('');
          setError(null);
        } else if (showJoinInput) {
          setShowJoinInput(false);
          setError(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCreateRoomModal, privateRoomToJoin, showJoinInput]);

  // 게임 시작 시 게임 화면으로 전환
  useEffect(() => {
    if (multiplayer.connectionState === 'in_game') {
      resetGameUI();
      setGameMode('rpg');
      setScreen('game');
    }
  }, [multiplayer.connectionState, setScreen, resetGameUI, setGameMode]);

  // 로비 복귀 시 스토어에서 방 설정 동기화
  useEffect(() => {
    if (multiplayer.connectionState === 'in_lobby') {
      // 스토어에 저장된 방 설정이 있으면 로컬 상태에 반영
      if (multiplayer.roomIsPrivate !== undefined) {
        setRoomIsPrivate(multiplayer.roomIsPrivate);
      }
      if (multiplayer.roomDifficulty) {
        setRoomDifficulty(multiplayer.roomDifficulty as RPGDifficulty);
      }
      if (multiplayer.roomMapTheme) {
        setRoomMapTheme(multiplayer.roomMapTheme as MapTheme);
      }
    }
  }, [multiplayer.connectionState, multiplayer.roomIsPrivate, multiplayer.roomDifficulty, multiplayer.roomMapTheme]);

  // 에러 자동 클리어
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // 이전 값 저장용 ref (불필요한 서버 요청 방지)
  const prevClassRef = useRef<HeroClass | null>(null);
  const prevStatUpgradesRef = useRef<string>('');
  const prevAdvancedClassRef = useRef<string | undefined>(undefined);
  const prevTierRef = useRef<number | undefined>(undefined);

  // 콘텐츠가 뷰포트 높이를 초과하면 비례 축소
  const contentScaleRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = contentScaleRef.current;
    if (!el) return;
    const updateScale = () => {
      el.style.transform = '';
      const contentHeight = el.scrollHeight;
      const viewportHeight = window.innerHeight;
      if (contentHeight > viewportHeight) {
        const scale = (viewportHeight / contentHeight) * 0.95;
        el.style.transform = `scale(${Math.min(1, scale)})`;
        el.style.transformOrigin = 'center center';
      }
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [multiplayer.connectionState, multiplayer.players.length]);

  // 방에 있는 상태에서 classProgress(SP 업그레이드) 또는 직업 변경 또는 전직 시 서버에 업데이트 전송
  useEffect(() => {
    if (multiplayer.connectionState !== 'in_lobby') return;
    if (!selectedClass) return;

    const progress = classProgress.find(p => p.className === selectedClass);
    const characterLevel = progress?.classLevel || 1;
    const statUpgrades = progress?.statUpgrades || createDefaultStatUpgrades();
    const advancedClass = progress?.advancedClass;
    const tier = progress?.tier;

    // 변경 여부 확인 (직업, statUpgrades, 전직 정보 변경 시 전송)
    const statUpgradesStr = JSON.stringify(statUpgrades);
    const isClassChanged = prevClassRef.current !== selectedClass;
    const isStatUpgradesChanged = prevStatUpgradesRef.current !== statUpgradesStr;
    const isAdvancedClassChanged = prevAdvancedClassRef.current !== advancedClass;
    const isTierChanged = prevTierRef.current !== tier;

    if (!isClassChanged && !isStatUpgradesChanged && !isAdvancedClassChanged && !isTierChanged) {
      return; // 변경 없으면 스킵
    }

    // 이전 값 업데이트
    prevClassRef.current = selectedClass;
    prevStatUpgradesRef.current = statUpgradesStr;
    prevAdvancedClassRef.current = advancedClass;
    prevTierRef.current = tier;

    // 로컬 플레이어 정보 업데이트
    const currentPlayers = useRPGStore.getState().multiplayer.players;
    const updatedPlayers = currentPlayers.map(p =>
      p.id === wsClient.playerId
        ? { ...p, heroClass: selectedClass, characterLevel, statUpgrades, advancedClass, tier }
        : p
    );
    useRPGStore.getState().setMultiplayerState({ players: updatedPlayers });

    // 서버에 최신 정보 전송 (전직 정보 포함)
    wsClient.changeCoopClass(selectedClass, characterLevel, statUpgrades, advancedClass as any, tier);
  }, [classProgress, multiplayer.connectionState, selectedClass, currentClassAdvancedClass, currentClassTier]);

  // 방 목록 변경 시 페이지 유효성 체크
  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(roomList.length / ROOMS_PER_PAGE) - 1);
    if (roomListPage > maxPage) {
      setRoomListPage(maxPage);
    }
  }, [roomList.length, roomListPage]);

  // 방 목록 자동 갱신 (로비에 있지 않을 때만)
  useEffect(() => {
    if (multiplayer.connectionState === 'in_lobby' || multiplayer.connectionState === 'countdown') {
      return; // 이미 방에 있으면 목록 조회 안 함
    }

    // 초기 연결 및 방 목록 조회
    const fetchRoomList = async () => {
      try {
        if (!wsClient.isConnected()) {
          await wsClient.connect();
        }
        setIsLoadingRooms(true);
        wsClient.getCoopRoomList();
      } catch (e) {
        console.error('방 목록 조회 실패:', e);
        setIsLoadingRooms(false);
      }
    };

    fetchRoomList();

    // 10초마다 방 목록 갱신 (백업용 - 실시간 Push 업데이트가 기본)
    const interval = setInterval(() => {
      if (wsClient.isConnected()) {
        wsClient.getCoopRoomList();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [multiplayer.connectionState]);

  // WebSocket 메시지 핸들러 설정
  useEffect(() => {
    const handleMessage = (message: any) => {
      switch (message.type) {
        case 'COOP_ROOM_CREATED':
          // 현재 선택된 직업의 레벨과 전직 정보 가져오기
          const createdClassProgress = useAuthStore.getState().classProgress;
          const createdProgress = createdClassProgress.find(p => p.className === (selectedClass || getLastSelectedClass()));
          const createdCharacterLevel = createdProgress?.classLevel || 1;
          const createdAdvancedClass = createdProgress?.advancedClass;
          const createdTier = createdProgress?.tier;
          // 서버에서 받은 방 설정 (또는 기본값)
          const createdRoomIsPrivate = message.isPrivate ?? false;
          const createdRoomDifficulty = message.difficulty || 'easy';
          const createdRoomMapTheme = message.mapTheme || 'forest';

          useRPGStore.getState().setMultiplayerState({
            roomCode: message.roomCode,
            roomId: message.roomId,
            isHost: true,
            connectionState: 'in_lobby',
            roomIsPrivate: createdRoomIsPrivate,
            roomDifficulty: createdRoomDifficulty,
            roomMapTheme: createdRoomMapTheme,
            players: [{
              id: wsClient.playerId || '',
              name: profile?.nickname || '플레이어',
              heroClass: selectedClass || getLastSelectedClass(),
              characterLevel: createdCharacterLevel,
              advancedClass: createdAdvancedClass,  // 전직 직업
              tier: createdTier,  // 전직 단계
              isHost: true,
              isReady: false,  // 호스트는 준비 상태가 필요 없음 (게임 시작 권한 보유)
              connected: true,
            }],
          });
          // 로컬 상태도 동기화
          setRoomIsPrivate(createdRoomIsPrivate);
          setRoomDifficulty(createdRoomDifficulty as RPGDifficulty);
          setRoomMapTheme(createdRoomMapTheme as MapTheme);
          useRPGStore.getState().setDifficulty(createdRoomDifficulty as RPGDifficulty);
          setTimeoutWarning(null);  // 이전 방 경고 초기화
          break;

        case 'COOP_ROOM_JOINED':
          // 호스트 위임 시 자신이 새 호스트인지 확인
          const myPlayerId = wsClient.playerId;
          const amIHost = message.players?.some((p: any) => p.id === myPlayerId && p.isHost) || false;
          const joinedRoomIsPrivate = message.isPrivate ?? false;
          const joinedRoomDifficulty = message.difficulty || 'easy';
          const joinedRoomMapTheme = message.mapTheme || 'forest';
          useRPGStore.getState().setMultiplayerState({
            roomCode: message.roomCode,
            roomId: message.roomId,
            isHost: amIHost,
            connectionState: 'in_lobby',
            roomIsPrivate: joinedRoomIsPrivate,
            roomDifficulty: joinedRoomDifficulty,
            roomMapTheme: joinedRoomMapTheme,
            players: message.players || [],
          });
          // 로컬 상태도 동기화
          setRoomIsPrivate(joinedRoomIsPrivate);
          setRoomDifficulty(joinedRoomDifficulty as RPGDifficulty);
          setRoomMapTheme(joinedRoomMapTheme as MapTheme);
          useRPGStore.getState().setDifficulty(joinedRoomDifficulty as RPGDifficulty);
          setTimeoutWarning(null);  // 이전 방 경고 초기화
          break;

        case 'COOP_PLAYER_JOINED':
          const currentPlayers = useRPGStore.getState().multiplayer.players;
          const newPlayer = message.player;
          if (!currentPlayers.find(p => p.id === newPlayer.id)) {
            useRPGStore.getState().setMultiplayerState({
              players: [...currentPlayers, newPlayer],
            });
          }
          break;

        case 'COOP_PLAYER_LEFT':
        case 'COOP_PLAYER_DISCONNECTED':
          // 플레이어가 나가거나 연결이 끊어진 경우 목록에서 제거
          const updatedPlayers = useRPGStore.getState().multiplayer.players.filter(
            p => p.id !== message.playerId
          );
          useRPGStore.getState().setMultiplayerState({ players: updatedPlayers });
          break;

        case 'COOP_PLAYER_READY':
          const playersWithReady = useRPGStore.getState().multiplayer.players.map(p =>
            p.id === message.playerId ? { ...p, isReady: message.isReady } : p
          );
          useRPGStore.getState().setMultiplayerState({ players: playersWithReady });
          break;

        case 'COOP_PLAYER_CLASS_CHANGED':
          const playersWithClassChange = useRPGStore.getState().multiplayer.players.map(p =>
            p.id === message.playerId
              ? {
                  ...p,
                  heroClass: message.heroClass,
                  characterLevel: message.characterLevel || p.characterLevel || 1,
                  advancedClass: message.advancedClass,  // 전직 직업 동기화
                  tier: message.tier,                     // 전직 단계 동기화
                }
              : p
          );
          useRPGStore.getState().setMultiplayerState({ players: playersWithClassChange });
          break;

        case 'COOP_ROOM_ERROR':
          setError(message.message);
          break;

        // 방 타임아웃 경고 (1분 전)
        case 'COOP_ROOM_TIMEOUT_WARNING':
          setTimeoutWarning(message.message);
          break;

        // 방 파기 (타임아웃 등): 플레이어를 방 목록으로 돌려보냄
        case 'COOP_ROOM_DESTROYED':
          setError(message.message);
          setTimeoutWarning(null);
          useRPGStore.getState().clearLobbyChatMessages();
          useRPGStore.getState().resetMultiplayerState();
          setShowJoinInput(false);
          setInputRoomCode('');
          break;

        case 'COOP_ROOM_SETTINGS_CHANGED':
          setRoomIsPrivate(message.isPrivate);
          setRoomDifficulty(message.difficulty as RPGDifficulty);
          if (message.mapTheme) {
            setRoomMapTheme(message.mapTheme as MapTheme);
          }
          // 스토어에도 저장 (프로필 복귀 시 동기화용)
          useRPGStore.getState().setMultiplayerState({
            roomIsPrivate: message.isPrivate,
            roomDifficulty: message.difficulty,
            roomMapTheme: message.mapTheme || 'forest',
          });
          useRPGStore.getState().setDifficulty(message.difficulty as RPGDifficulty);
          break;

        case 'COOP_ROOM_LIST':
          setRoomList(message.rooms || []);
          setIsLoadingRooms(false);
          break;

        // 방 목록 실시간 업데이트 (Push 방식)
        case 'COOP_ROOM_LIST_UPDATED':
          // 로비에서 대기 중일 때만 방 목록 업데이트
          if (multiplayer.connectionState !== 'in_lobby' && multiplayer.connectionState !== 'countdown') {
            setRoomList(message.rooms || []);
          }
          break;

        case 'COOP_GAME_COUNTDOWN':
          setTimeoutWarning(null);  // 게임 시작하면 타임아웃 경고 제거
          useRPGStore.getState().setMultiplayerState({
            connectionState: 'countdown',
            countdown: message.seconds,
          });
          break;

        // COOP_GAME_START는 useNetworkSync에서 처리 (중복 방지)

        // 재시작 카운트다운 (로비 복귀 후 재시작 시)
        case 'COOP_RESTART_COUNTDOWN':
          console.log('[Lobby] 게임 재시작 카운트다운');
          useRPGStore.getState().setMultiplayerState({
            connectionState: 'countdown',
            countdown: 3,  // 초기 카운트다운 값 설정
          });
          break;

        // 재시작 카운트다운 숫자 (재시작 시)
        case 'COOP_COUNTDOWN':
          useRPGStore.getState().setMultiplayerState({
            countdown: message.countdown,
          });
          break;

        // 게임 재시작 (로비 복귀 후 재시작 시)
        case 'COOP_GAME_RESTART': {
          console.log('[Lobby] 게임 재시작');
          const state = useRPGStore.getState();
          const { players, isHost, hostPlayerId, roomCode, roomId } = state.multiplayer;

          // 게임 리셋
          state.resetGame();

          // 멀티플레이어 상태 설정
          state.setMultiplayerState({
            isMultiplayer: true,
            connectionState: 'in_game',
            players,
            isHost,
            hostPlayerId,
            myPlayerId: wsClient.playerId,
            roomCode,
            roomId,
          });

          // 게임 초기화 - AudioContext 초기화 (fallback)
          soundManager.init();
          state.initMultiplayerGame(players, isHost);
          break;
        }

        case 'COOP_GAME_START_HOST_BASED':
          // 멀티플레이어 상태 설정 (전체 초기화)
          useRPGStore.getState().setMultiplayerState({
            isMultiplayer: true,
            isHost: message.isHost,
            hostPlayerId: message.hostPlayerId,
            myPlayerId: wsClient.playerId,
            players: message.players,
            connectionState: 'in_game',
            countdown: null,
          });
          // 난이도 설정 (서버에서 전달된 값 사용)
          if (message.difficulty) {
            useRPGStore.getState().setDifficulty(message.difficulty as RPGDifficulty);
          }
          // 게임 초기화 (영웅, 넥서스, 적 기지 등 생성) - 난이도 명시적 전달
          soundManager.init(); // AudioContext 초기화 (fallback)
          useRPGStore.getState().initMultiplayerGame(message.players, message.isHost, message.difficulty as RPGDifficulty);
          break;

        // GAME_INVITE_ACCEPTED는 useFriendMessages에서 전역으로 처리됨

        // 중복 로그인 처리 - WebSocketClient에서 처리하므로 여기서는 상태만 정리
        case 'DUPLICATE_LOGIN':
          useRPGStore.getState().setMultiplayerState({
            connectionState: 'disconnected',
            isMultiplayer: false,
            roomCode: null,
            roomId: null,
            players: [],
          });
          // 로그아웃 및 리다이렉트는 WebSocketClient.ts에서 처리됨
          break;

        // 계정 정지 처리
        case 'BANNED':
          setError(message.message || '계정이 정지되었습니다.');
          useRPGStore.getState().setMultiplayerState({
            connectionState: 'disconnected',
            isMultiplayer: false,
            roomCode: null,
            roomId: null,
            players: [],
          });
          break;

        // 로비 채팅
        case 'LOBBY_CHAT_MESSAGE':
          useRPGStore.getState().addLobbyChatMessage(message.message);
          break;

        case 'LOBBY_CHAT_HISTORY':
          useRPGStore.getState().setLobbyChatHistory(message.messages);
          break;

        case 'LOBBY_CHAT_ERROR':
          useRPGStore.getState().setLobbyChatError(message.message);
          break;
      }
    };

    const unsubscribe = wsClient.addMessageHandler(handleMessage);
    return () => unsubscribe();
  }, [profile, selectedClass]);

  const handleJoinRoom = useCallback(async () => {
    if (inputRoomCode.trim().length !== 6) {
      setError('6자리 초대 코드를 입력하세요.');
      return;
    }

    soundManager.play('ui_click');
    setIsConnecting(true);

    try {
      await wsClient.connect();

      const playerName = profile?.nickname || '플레이어';
      // 기본 직업으로 입장 (방 입장 후 변경 가능)
      const defaultClass: HeroClass = getLastSelectedClass();

      // classProgress에서 해당 캐릭터의 레벨과 statUpgrades 가져오기
      const classProgress = useAuthStore.getState().classProgress;
      const progress = classProgress.find(p => p.className === defaultClass);
      const characterLevel = progress?.classLevel || 1;
      const statUpgrades = progress?.statUpgrades || createDefaultStatUpgrades();

      selectClass(defaultClass);
      joinMultiplayerRoom(inputRoomCode.trim().toUpperCase(), playerName, defaultClass, characterLevel, statUpgrades);
    } catch (e) {
      setError('서버 연결 실패');
    }
    setIsConnecting(false);
  }, [inputRoomCode, profile, selectClass]);

  // 방 카드 클릭하여 참가
  const handleJoinRoomById = useCallback(async (roomId: string) => {
    soundManager.play('ui_click');
    setIsConnecting(true);

    try {
      await wsClient.connect();

      const playerName = profile?.nickname || '플레이어';
      // 기본 직업으로 입장 (방 입장 후 변경 가능)
      const defaultClass: HeroClass = getLastSelectedClass();

      // classProgress에서 해당 캐릭터의 레벨과 statUpgrades 가져오기
      const classProgress = useAuthStore.getState().classProgress;
      const progress = classProgress.find(p => p.className === defaultClass);
      const characterLevel = progress?.classLevel || 1;
      const statUpgrades = progress?.statUpgrades || createDefaultStatUpgrades();
      const advancedClass = progress?.advancedClass;
      const tier = progress?.tier;

      selectClass(defaultClass);
      wsClient.joinCoopRoomById(roomId, playerName, defaultClass, characterLevel, statUpgrades, advancedClass as any, tier);
    } catch (e) {
      setError('서버 연결 실패');
    }
    setIsConnecting(false);
  }, [profile, selectClass]);

  const handleBack = useCallback(() => {
    soundManager.play('ui_click');
    if (multiplayer.connectionState === 'in_lobby' || multiplayer.connectionState === 'countdown') {
      // 로비에서 뒤로가기는 방을 나가고 방 목록으로 이동
      leaveMultiplayerRoom();
      useRPGStore.getState().clearLobbyChatMessages();
      useRPGStore.getState().resetMultiplayerState();
      setShowJoinInput(false);
      setInputRoomCode('');
      return;
    }
    // 방 목록에서 뒤로가기는 게임 타입 선택 화면으로 이동
    useRPGStore.getState().resetMultiplayerState();
    setShowJoinInput(false);
    setInputRoomCode('');
    setScreen('gameTypeSelect');
  }, [multiplayer.connectionState, setScreen]);

  const handleLeaveRoom = useCallback(() => {
    soundManager.play('ui_click');
    leaveMultiplayerRoom();
    useRPGStore.getState().clearLobbyChatMessages();
    setShowJoinInput(false);
    setInputRoomCode('');
  }, []);

  const handleClassSelect = useCallback((heroClass: HeroClass) => {
    // 준비 상태면 직업 변경 불가
    const myPlayer = multiplayer.players.find(p => p.id === wsClient.playerId);
    if (myPlayer?.isReady) {
      setError('준비 상태에서는 직업을 변경할 수 없습니다.');
      return;
    }
    if (!isCharacterUnlocked(heroClass, playerLevel, isGuest)) {
      setError('해금되지 않은 직업입니다.');
      return;
    }
    soundManager.play('ui_click');
    const currentProfile = useAuthStore.getState().profile;
    if (currentProfile && !currentProfile.isGuest) {
      localStorage.setItem(`rpg_last_class_${currentProfile.id}`, heroClass);
    }
    selectClass(heroClass);
    // 서버 전송은 useEffect에서 selectedClass 변경 감지 시 처리
  }, [playerLevel, isGuest, selectClass, multiplayer.players]);

  const handleStartGame = useCallback(() => {
    soundManager.init();
    soundManager.play('ui_click');
    startMultiplayerGame();
  }, []);

  const handleToggleReady = useCallback(() => {
    soundManager.init(); // 클라이언트용 AudioContext 초기화
    soundManager.play('ui_click');
    // 현재 내 준비 상태 토글
    const myPlayer = multiplayer.players.find(p => p.id === wsClient.playerId);
    const newReadyState = !myPlayer?.isReady;
    // 서버의 기존 메시지 타입 사용
    wsClient.send({ type: newReadyState ? 'COOP_READY' : 'COOP_UNREADY' });
  }, [multiplayer.players]);

  const copyRoomCode = useCallback(async () => {
    if (multiplayer.roomCode) {
      try {
        await navigator.clipboard.writeText(multiplayer.roomCode);
        soundManager.play('ui_click');
      } catch (e) {
        console.error('클립보드 복사 실패:', e);
      }
    }
  }, [multiplayer.roomCode]);

  // 방 생성 (공개/비밀 + 난이도)
  const handleCreateRoom = useCallback(async () => {
    if (selectedRoomType === null || selectedModalDifficulty === null) return;

    // 값을 먼저 저장 (상태 리셋 전에)
    const roomType = selectedRoomType;
    const difficulty = selectedModalDifficulty;
    const mapTheme = selectedModalMapTheme;

    soundManager.play('ui_click');
    setShowCreateRoomModal(false);
    setSelectedRoomType(null);
    setSelectedModalDifficulty(null);
    setSelectedModalMapTheme('forest');
    setIsConnecting(true);

    // 난이도를 스토어에 저장
    useRPGStore.getState().setDifficulty(difficulty);

    // 로컬 상태에도 저장 (로비 UI용)
    setRoomIsPrivate(roomType === 'private');
    setRoomDifficulty(difficulty);
    setRoomMapTheme(mapTheme);

    try {
      await wsClient.connect();
      const playerName = profile?.nickname || '플레이어';
      // 기본 직업으로 방 생성 (방 입장 후 변경 가능)
      const defaultClass: HeroClass = getLastSelectedClass();

      const classProgress = useAuthStore.getState().classProgress;
      const progress = classProgress.find(p => p.className === defaultClass);
      const characterLevel = progress?.classLevel || 1;
      const statUpgrades = progress?.statUpgrades || createDefaultStatUpgrades();
      const advancedClass = progress?.advancedClass;
      const tier = progress?.tier;

      selectClass(defaultClass);
      createMultiplayerRoom(playerName, defaultClass, characterLevel, statUpgrades, roomType === 'private', difficulty, advancedClass, tier, mapTheme);
    } catch (e) {
      setError('서버 연결 실패');
    }
    setIsConnecting(false);
  }, [profile, selectClass, selectedRoomType, selectedModalDifficulty, selectedModalMapTheme]);

  // 비밀방 코드 확인 후 참가
  const handleJoinPrivateRoom = useCallback(async () => {
    if (!privateRoomToJoin || privateRoomCode.length !== 6) return;

    const roomCode = privateRoomCode.toUpperCase();
    soundManager.play('ui_click');
    setPrivateRoomToJoin(null);
    setPrivateRoomCode('');
    setIsConnecting(true);

    try {
      await wsClient.connect();

      const playerName = profile?.nickname || '플레이어';
      const defaultClass: HeroClass = getLastSelectedClass();

      const classProgress = useAuthStore.getState().classProgress;
      const progress = classProgress.find(p => p.className === defaultClass);
      const characterLevel = progress?.classLevel || 1;
      const statUpgrades = progress?.statUpgrades || createDefaultStatUpgrades();
      const advancedClass = progress?.advancedClass;
      const tier = progress?.tier;

      selectClass(defaultClass);
      // 비밀방은 코드로 참가 (서버에서 코드 검증)
      wsClient.joinCoopRoom(roomCode, playerName, defaultClass, characterLevel, statUpgrades, advancedClass as any, tier);
    } catch (e) {
      setError('서버 연결 실패');
    }
    setIsConnecting(false);
  }, [privateRoomToJoin, privateRoomCode, profile, selectClass]);

  // 방 카드 클릭 처리
  const handleRoomCardClick = useCallback((room: WaitingCoopRoomInfo) => {
    if (room.isPrivate) {
      // 비밀방이면 코드 입력 모달 표시
      setPrivateRoomToJoin(room);
      setPrivateRoomCode('');
      setError(null);
    } else {
      // 공개방이면 바로 참가
      handleJoinRoomById(room.roomId);
    }
  }, [handleJoinRoomById]);

  // 방 참가 입력 화면
  const renderJoinInput = () => (
    <div className="flex flex-col items-center gap-6" style={isMobile ? { padding: '15px' } : undefined}>
      <p className="text-gray-400 mb-2">초대 코드를 입력하세요</p>

      <input
        type="text"
        value={inputRoomCode}
        onChange={(e) => setInputRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
        placeholder="6자리 코드"
        maxLength={6}
        className="w-48 px-4 py-4 bg-gray-800/50 border border-neon-purple rounded-lg text-white text-center text-2xl tracking-[0.3em] font-mono focus:border-neon-purple focus:outline-none uppercase"
        onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
        autoFocus
      />

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex gap-4">
        <button
          onClick={() => {
            setShowJoinInput(false);
            setInputRoomCode('');
            setError(null);
          }}
          className="px-6 py-3 rounded-lg border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white transition-all cursor-pointer"
        >
          취소
        </button>
        <button
          onClick={handleJoinRoom}
          disabled={inputRoomCode.length !== 6 || isConnecting}
          className="px-6 py-3 rounded-lg bg-neon-purple/20 border border-neon-purple text-neon-purple hover:bg-neon-purple/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
        >
          {isConnecting ? '연결 중...' : '참가'}
        </button>
      </div>
    </div>
  );

  // 로비 화면 (방 생성 후)
  const renderLobby = () => {
    const isHostPlayer = multiplayer.isHost;
    const players = multiplayer.players;

    // --- 공유 요소 ---

    // 초대 코드 + 방 설정 (기존과 동일)
    const inviteSection = multiplayer.roomCode && (
      <div className={`flex items-start gap-6 ${isMobile ? 'mb-2' : 'mb-4'}`}>
        {/* 초대 코드 */}
        <div>
          <p className="text-neon-cyan text-sm mb-1 text-center">초대 코드</p>
          <div
            className="px-6 py-2 bg-gray-800/50 border-2 border-neon-cyan rounded-lg cursor-pointer hover:bg-gray-800/70 transition-all"
            onClick={copyRoomCode}
            title="클릭하여 복사"
          >
            <p className="text-2xl font-bold tracking-[0.3em] text-white font-mono">
              {multiplayer.roomCode}
            </p>
          </div>
          <p className="text-gray-500 text-xs text-center mt-1">(클릭하여 복사)</p>
        </div>

        {/* 방 설정 */}
        <div>
          <p className="text-gray-400 text-sm mb-1 text-center">방 설정</p>
          <div className="flex flex-col gap-2">
            {/* 방 유형 */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (isHostPlayer && !roomIsPrivate) return;
                  if (!isHostPlayer) return;
                  soundManager.play('ui_click');
                  wsClient.send({ type: 'UPDATE_COOP_ROOM_SETTINGS', isPrivate: false });
                }}
                disabled={!isHostPlayer}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                  !roomIsPrivate
                    ? 'border-green-400 bg-green-500/20 text-green-400'
                    : isHostPlayer
                      ? 'border-gray-600 text-gray-500 hover:border-green-500/50 hover:text-green-400/70 cursor-pointer'
                      : 'border-gray-700 text-gray-600 cursor-not-allowed'
                }`}
              >
                <Emoji emoji="🌐" size={14} className="mr-1" /> 공개
              </button>
              <button
                onClick={() => {
                  if (isHostPlayer && roomIsPrivate) return;
                  if (!isHostPlayer) return;
                  soundManager.play('ui_click');
                  wsClient.send({ type: 'UPDATE_COOP_ROOM_SETTINGS', isPrivate: true });
                }}
                disabled={!isHostPlayer}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                  roomIsPrivate
                    ? 'border-yellow-400 bg-yellow-500/20 text-yellow-400'
                    : isHostPlayer
                      ? 'border-gray-600 text-gray-500 hover:border-yellow-500/50 hover:text-yellow-400/70 cursor-pointer'
                      : 'border-gray-700 text-gray-600 cursor-not-allowed'
                }`}
              >
                <Emoji emoji="🔒" size={14} className="mr-1" /> 비밀
              </button>
            </div>
            {/* 난이도 */}
            <div className="flex gap-1">
              {(Object.keys(DIFFICULTY_CONFIGS) as RPGDifficulty[]).map((diff) => {
                const config = DIFFICULTY_CONFIGS[diff];
                const colors = difficultyColors[diff];
                const isSelected = roomDifficulty === diff;
                return (
                  <button
                    key={diff}
                    onClick={() => {
                      if (isHostPlayer && isSelected) return;
                      if (!isHostPlayer) return;
                      soundManager.play('ui_click');
                      wsClient.send({ type: 'UPDATE_COOP_ROOM_SETTINGS', difficulty: diff });
                    }}
                    disabled={!isHostPlayer}
                    className={`px-2 py-1 text-xs rounded-lg border transition-all ${
                      isSelected
                        ? `${colors.border} ${colors.bg} ${colors.text}`
                        : isHostPlayer
                          ? `border-gray-600 text-gray-500 hover:${colors.border} cursor-pointer`
                          : 'border-gray-700 text-gray-600 cursor-not-allowed'
                    }`}
                    title={config.description}
                  >
                    {config.name}
                    <span className="ml-1 opacity-60">Lv.{config.recommendedLevel}+</span>
                  </button>
                );
              })}
            </div>
            {/* 맵 테마 */}
            <div className="flex gap-1">
              {MAP_THEME_LIST.map((theme) => {
                const isSelected = roomMapTheme === theme.id;
                const themeColors: Record<MapTheme, { border: string; bg: string; text: string }> = {
                  forest: { border: 'border-green-500', bg: 'bg-green-500/20', text: 'text-green-400' },
                  ice: { border: 'border-cyan-500', bg: 'bg-cyan-500/20', text: 'text-cyan-400' },
                  volcano: { border: 'border-orange-500', bg: 'bg-orange-500/20', text: 'text-orange-400' },
                  shadow: { border: 'border-purple-500', bg: 'bg-purple-500/20', text: 'text-purple-400' },
                };
                const tc = themeColors[theme.id];
                return (
                  <button
                    key={theme.id}
                    onClick={() => {
                      if (isHostPlayer && isSelected) return;
                      if (!isHostPlayer) return;
                      soundManager.play('ui_click');
                      wsClient.send({ type: 'UPDATE_COOP_ROOM_SETTINGS', mapTheme: theme.id } as any);
                    }}
                    disabled={!isHostPlayer}
                    className={`px-2 py-1 text-xs rounded-lg border transition-all ${
                      isSelected
                        ? `${tc.border} ${tc.bg} ${tc.text}`
                        : isHostPlayer
                          ? `border-gray-600 text-gray-500 hover:${tc.border} cursor-pointer`
                          : 'border-gray-700 text-gray-600 cursor-not-allowed'
                    }`}
                    title={theme.description}
                  >
                    {theme.name}
                  </button>
                );
              })}
            </div>
          </div>
          {!isHostPlayer && (
            <p className="text-gray-600 text-xs text-center mt-1">방장만 변경 가능</p>
          )}
        </div>
      </div>
    );

    // 플레이어 카드 렌더링
    const renderPlayerCard = (player: typeof players[0]) => {
      const baseConfig = CLASS_CONFIGS[player.heroClass];
      const advConfig = player.advancedClass
        ? ADVANCED_CLASS_CONFIGS[player.advancedClass as AdvancedHeroClass]
        : null;
      const displayName = advConfig ? advConfig.name : baseConfig.name;
      const displayEmoji = advConfig ? advConfig.emoji : baseConfig.emoji;
      const isMe = player.id === wsClient.playerId;
      return (
        <div
          key={player.id}
          className={`flex items-center justify-between py-2 rounded-lg border ${
            isMe
              ? 'border-neon-cyan bg-neon-cyan/10'
              : 'border-gray-700 bg-gray-800/50'
          }`}
          style={{ paddingLeft: 5, paddingRight: 5 }}
        >
          <div className="flex items-center gap-3">
            <Emoji emoji={displayEmoji} size={20} />
            <div>
              <p className={`font-bold ${isMe ? 'text-neon-cyan' : 'text-white'}`}>
                {player.name}
                {player.isHost && <span className="ml-2 text-yellow-500 text-xs">(방장)</span>}
              </p>
              <p className="text-gray-500 text-xs">
                {displayName}
                {player.tier === 2 && <span className="ml-1 text-orange-400">★★</span>}
                <span className="ml-2 text-yellow-400"> Lv.{player.characterLevel || 1}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {player.isReady && !player.isHost && (
              <span className="text-green-400 text-sm">준비 완료</span>
            )}
            {!player.connected && (
              <span className="text-red-400 text-sm">연결 끊김</span>
            )}
            {!isMe && (
              blockedPlayers.has(player.id) ? (
                <button
                  onClick={() => handleUnblockPlayer(player.id)}
                  className="text-gray-500 hover:text-gray-300 text-xs cursor-pointer"
                >
                  차단 해제
                </button>
              ) : (
                <button
                  onClick={() => handleBlockPlayer(player.id, player.name)}
                  className="text-gray-600 hover:text-red-400 text-xs cursor-pointer"
                >
                  채팅 차단
                </button>
              )
            )}
          </div>
        </div>
      );
    };

    // 빈 슬롯 렌더링
    const renderEmptySlot = (i: number) => (
      <div
        key={`empty-${i}`}
        className="flex items-center justify-center px-4 py-2 rounded-lg border border-gray-700/50 border-dashed text-gray-600"
      >
        대기중...
      </div>
    );

    // 직업 변경 버튼
    const classChangeBtn = (() => {
      const isMyReady = multiplayer.players.find(p => p.id === wsClient.playerId)?.isReady;
      const myProgress = classProgress.find(p => p.className === (selectedClass || getLastSelectedClass()));
      const baseConfig = CLASS_CONFIGS[selectedClass || getLastSelectedClass()];
      const advConfig = myProgress?.advancedClass
        ? ADVANCED_CLASS_CONFIGS[myProgress.advancedClass as AdvancedHeroClass]
        : null;
      const displayName = advConfig ? advConfig.name : baseConfig.name;
      const displayEmoji = advConfig ? advConfig.emoji : baseConfig.emoji;
      return (
        <button
          onClick={() => !isMyReady && setShowClassModal(true)}
          disabled={isMyReady}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
            isMyReady
              ? 'border-gray-600 bg-gray-800/50 cursor-not-allowed opacity-50'
              : 'border-neon-cyan/50 bg-neon-cyan/10 hover:bg-neon-cyan/20 cursor-pointer'
          }`}
        >
          <Emoji emoji={displayEmoji} size={20} />
          <span className={isMyReady ? 'text-gray-400' : 'text-neon-cyan'}>
            {displayName}
            {myProgress?.tier === 2 && <span className="ml-1 text-orange-400">★★</span>}
          </span>
          <span className="text-gray-400 text-sm ml-2">변경</span>
          {isMyReady && (
            <span className="text-xs text-yellow-400 ml-1">(준비 취소 후 변경)</span>
          )}
        </button>
      );
    })();

    // 액션 버튼 (게임 시작 / 준비)
    const actionBtn = isHostPlayer ? (
      <button
        onClick={handleStartGame}
        className="px-6 py-2 rounded-lg bg-green-500/20 border border-green-500 text-green-400 hover:bg-green-500/30 transition-all cursor-pointer"
      >
        게임 시작 {players.length === 1 && '(혼자 플레이)'}
      </button>
    ) : (
      <button
        onClick={handleToggleReady}
        className={`px-6 py-2 rounded-lg transition-all cursor-pointer ${
          multiplayer.players.find(p => p.id === wsClient.playerId)?.isReady
            ? 'bg-green-500/20 border border-green-500 text-green-400 hover:bg-green-500/30'
            : 'bg-yellow-500/20 border border-yellow-500 text-yellow-400 hover:bg-yellow-500/30'
        }`}
      >
        {multiplayer.players.find(p => p.id === wsClient.playerId)?.isReady ? '준비 취소' : '준비'}
      </button>
    );

    // 경고/에러/안내 섹션
    const warningsSection = (
      <>
        {timeoutWarning && (
          <div className="w-full p-3 rounded-lg bg-yellow-500/20 border border-yellow-500 animate-pulse">
            <p className="text-yellow-400 text-sm text-center font-medium">
              <Emoji emoji="⚠️" size={16} className="mr-1" /> {timeoutWarning}
            </p>
          </div>
        )}
        {error && <p className="text-red-400 text-sm">{error}</p>}
        {players.length < 4 && (
          <p className="text-gray-500 text-xs">
            오른쪽 상단의 친구 패널에서 친구를 초대할 수 있습니다
          </p>
        )}
      </>
    );

    // --- 레이아웃 분기 ---

    if (isMobile) {
      // 모바일: 플레이어+채팅 가로 배치, 버튼 한 줄
      return (
        <div className="flex flex-col items-center gap-3 w-full" style={{ padding: '15px' }}>
          {inviteSection}

          {/* 플레이어 목록 + 채팅 가로 배치 */}
          <div className="flex gap-3 w-full">
            {/* 플레이어 목록 */}
            <div className="flex-1 min-w-0 bg-gray-800/30 rounded-lg p-3">
              <p className="text-gray-400 text-sm mb-2">플레이어 ({players.length}/4)</p>
              <div className="space-y-1.5">
                {players.map(renderPlayerCard)}
                {Array.from({ length: 4 - players.length }).map((_, i) => renderEmptySlot(i))}
              </div>
            </div>

            {/* 채팅 */}
            <div className="flex-1 min-w-0">
              <LobbyChat blockedPlayers={blockedPlayers} onUnblock={handleUnblockPlayer} />
            </div>
          </div>

          {/* 직업 변경 + 액션 버튼 한 줄 */}
          <div className="flex items-center gap-3">
            {classChangeBtn}
            {actionBtn}
          </div>

          {warningsSection}
        </div>
      );
    }

    // 데스크톱/태블릿: 기존 세로 나열 레이아웃
    return (
      <div className="flex flex-col items-center gap-4">
        <div style={{ height: '5px' }} />
        {inviteSection}

        {/* 플레이어 목록 */}
        <div className="w-[20rem] bg-gray-800/30 rounded-lg p-4">
          <p className="text-gray-400 text-sm mb-3">플레이어 ({players.length}/4)</p>
          <div className="space-y-2">
            {players.map(renderPlayerCard)}
            {Array.from({ length: 4 - players.length }).map((_, i) => renderEmptySlot(i))}
          </div>
        </div>

        {/* 로비 채팅 */}
        <div className="w-[20rem]">
          <LobbyChat blockedPlayers={blockedPlayers} onUnblock={handleUnblockPlayer} />
        </div>

        {classChangeBtn}

        {warningsSection}

        {/* 액션 버튼 */}
        <div className="flex gap-4 mt-4">
          {actionBtn}
        </div>
        <div style={{ height: '10px' }} />
      </div>
    );
  };

  // 카운트다운 화면
  const renderCountdown = () => (
    <div className="flex flex-col items-center gap-4" style={isMobile ? { padding: '15px' } : undefined}>
      <p className="text-green-400 text-xl">게임 시작!</p>

      <div className="flex flex-wrap justify-center gap-4">
        {multiplayer.players.map((player) => {
          const baseConfig = CLASS_CONFIGS[player.heroClass];
          const advConfig = player.advancedClass
            ? ADVANCED_CLASS_CONFIGS[player.advancedClass as AdvancedHeroClass]
            : null;
          const displayName = advConfig ? advConfig.name : baseConfig.name;
          const displayEmoji = advConfig ? advConfig.emoji : baseConfig.emoji;
          return (
            <div key={player.id} className="text-center px-4">
              <Emoji emoji={displayEmoji} size={24} />
              <p className="text-white font-bold">{player.name}</p>
              <p className="text-gray-500 text-xs">
                {displayName}
                {player.tier === 2 && <span className="ml-1 text-orange-400">★★</span>}
              </p>
            </div>
          );
        })}
      </div>

      {multiplayer.countdown != null && multiplayer.countdown > 0 && (
        <div className="mt-4 text-center">
          <p className="text-gray-400">게임 시작까지</p>
          <p className="text-6xl font-bold text-neon-cyan animate-pulse">{multiplayer.countdown}</p>
        </div>
      )}
    </div>
  );

  // 방 선택 화면 (방 생성 또는 참가)
  const renderRoomSelect = () => {
    if (showJoinInput) {
      return renderJoinInput();
    }

    return (
      <div className="flex flex-col items-center gap-6 w-full max-w-[820px]" style={isMobile ? { padding: '15px' } : undefined}>
        {error && <p className="text-red-400 text-sm mb-2">{error}</p>}

        {/* 대기방 목록 헤더 */}
        <div className="w-full flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-white">대기방 목록</h2>
            {isLoadingRooms && (
              <span className="text-xs text-gray-500 animate-pulse">갱신 중...</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                soundManager.play('ui_click');
                setShowRanking(true);
              }}
              className="px-3 py-1 text-sm text-red-400 border border-red-500/50 rounded-lg hover:bg-red-500/10 transition-all cursor-pointer flex items-center gap-1"
              style={{ paddingLeft: '10px', paddingRight: '10px', paddingTop: '5px', paddingBottom: '5px' }}
            >
              <span>🏆</span> 랭킹
            </button>
            <button
              onClick={() => {
                soundManager.play('ui_click');
                setShowEncyclopedia(true);
              }}
              className="px-3 py-1 text-sm text-yellow-400 border border-yellow-500/50 rounded-lg hover:bg-yellow-500/10 transition-all cursor-pointer flex items-center gap-1"
              style={{ paddingLeft: '10px', paddingRight: '10px', paddingTop: '5px', paddingBottom: '5px' }}
            >
              <Emoji emoji="📚" size={16} /> 직업 도감
            </button>
            <button
              onClick={() => {
                soundManager.play('ui_click');
                setScreen('rpgTutorial');
              }}
              className="px-3 py-1 text-sm text-green-400 border border-green-500/50 rounded-lg hover:bg-green-500/10 transition-all cursor-pointer flex items-center gap-1"
              style={{ paddingLeft: '10px', paddingRight: '10px', paddingTop: '5px', paddingBottom: '5px' }}
            >
              <Emoji emoji="📖" size={16} /> 튜토리얼
            </button>
            <button
              onClick={() => setShowJoinInput(true)}
              className="px-3 py-1 text-sm text-neon-purple border border-neon-purple/50 rounded-lg hover:bg-neon-purple/10 transition-all cursor-pointer"
              style={{ paddingLeft: '10px', paddingRight: '10px', paddingTop: '5px', paddingBottom: '5px' }}
            >
              코드로 참가
            </button>
          </div>
        </div>

        {/* 대기방 그리드 */}
        <div className="w-full grid grid-cols-3 gap-5">
          {/* 방 생성 카드 */}
          <button
            onClick={() => {
              soundManager.play('ui_click');
              setShowCreateRoomModal(true);
            }}
            disabled={isConnecting}
            className="group flex flex-col items-center justify-center p-6 h-[150px] border-2 border-dashed border-gray-600 rounded-xl hover:border-neon-cyan hover:bg-neon-cyan/5 transition-all cursor-pointer disabled:opacity-50"
          >
            <span className="text-4xl text-gray-500 group-hover:text-neon-cyan mb-2 transition-colors">+</span>
            <span className="text-gray-400 group-hover:text-neon-cyan text-sm font-bold transition-colors">
              {isConnecting ? '연결 중...' : '새 방 생성'}
            </span>
          </button>

          {/* 대기 중인 방 카드들 (현재 페이지) */}
          {roomList
            .slice(roomListPage * ROOMS_PER_PAGE, (roomListPage + 1) * ROOMS_PER_PAGE)
            .map((room) => {
            const baseConfig = CLASS_CONFIGS[room.hostHeroClass];
            const advConfig = room.hostAdvancedClass
              ? ADVANCED_CLASS_CONFIGS[room.hostAdvancedClass as AdvancedHeroClass]
              : null;
            const displayName = advConfig ? advConfig.name : baseConfig.name;
            const displayEmoji = advConfig ? advConfig.emoji : baseConfig.emoji;
            const isFull = room.playerCount >= room.maxPlayers;
            const isInGame = room.isInGame;
            const canJoin = !isFull && !isInGame;
            const roomDifficulty = (room.difficulty || 'easy') as RPGDifficulty;
            const diffConfig = DIFFICULTY_CONFIGS[roomDifficulty];
            const diffColors = difficultyColors[roomDifficulty];
            return (
              <button
                key={room.roomId}
                onClick={() => canJoin && handleRoomCardClick(room)}
                disabled={!canJoin || isConnecting}
                className={`group relative flex flex-col px-7 py-5 h-[150px] border-2 rounded-xl transition-all text-left ${
                  isInGame
                    ? 'border-red-700 bg-red-900/20 cursor-not-allowed opacity-70'
                    : isFull
                      ? 'border-gray-700 bg-gray-800/30 cursor-not-allowed opacity-60'
                      : room.isPrivate
                        ? 'border-yellow-500/70 hover:border-yellow-400 hover:bg-yellow-500/10 cursor-pointer'
                        : 'border-neon-purple/70 hover:border-neon-purple hover:bg-neon-purple/10 cursor-pointer'
                }`}
              >
                {/* 게임 중 표시 */}
                {isInGame && (
                  <div className="absolute top-3 right-3 px-2 py-0.5 bg-red-600 text-white text-xs font-bold rounded">
                    게임 중
                  </div>
                )}
                {/* 비밀방 아이콘 */}
                {room.isPrivate && !isInGame && (
                  <div className="absolute top-3 right-1 text-yellow-400" title="비밀방">
                    <Emoji emoji="🔒" size={20} />
                  </div>
                )}

                {/* 호스트 정보 */}
                <div className="flex items-center gap-3 mb-3">
                  <Emoji emoji={displayEmoji} size={30} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-lg truncate">
                      {room.hostName}
                      <span className="ml-2 text-m text-yellow-400 font-normal"> Lv.{room.hostClassLevel}</span>
                    </p>
                    <p className="text-gray-500 text-sm">
                      {displayName}
                      {room.hostTier === 2 && <span className="ml-1 text-orange-400">★★</span>}
                    </p>
                  </div>
                </div>

                {/* 인원수 및 난이도 */}
                <div className="mt-auto flex items-center justify-between"
                style={{ paddingLeft: '5px', paddingRight: '5px' }}>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      {Array.from({ length: room.maxPlayers }).map((_, i) => (
                        <div
                          key={i}
                          className={`w-3 h-3 rounded-full ${
                            i < room.playerCount
                              ? 'bg-green-400'
                              : 'bg-gray-600'
                          }`}
                        />
                      ))}
                    </div>
                    <span className={`text-sm font-bold ${isFull ? 'text-red-400' : 'text-gray-300'}`}>
                      {room.playerCount}/{room.maxPlayers}
                    </span>
                  </div>
                  {/* 난이도 표시 */}
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${diffColors.bg} ${diffColors.text} border ${diffColors.border}`}>
                    {diffConfig.name}
                  </span>
                </div>
              </button>
            );
          })}

          {/* 빈 슬롯들 (현재 페이지 기준, 최소 5개 슬롯 보장) */}
          {(() => {
            const currentPageRooms = roomList.slice(roomListPage * ROOMS_PER_PAGE, (roomListPage + 1) * ROOMS_PER_PAGE);
            const emptySlots = Math.max(0, ROOMS_PER_PAGE - currentPageRooms.length);
            return Array.from({ length: emptySlots }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="flex flex-col items-center justify-center p-6 h-[150px] border border-gray-700/30 border-dashed rounded-xl"
              >
                <span className="text-gray-600 text-sm">
                  {i === 0 && roomList.length === 0 && !isLoadingRooms ? '대기 중인 방 없음' : ''}
                </span>
              </div>
            ));
          })()}
        </div>

        {/* 페이지네이션 (방이 5개 초과일 때만 표시) */}
        {roomList.length > ROOMS_PER_PAGE && (
          <div className="flex items-center justify-center gap-4 mt-4">
            <button
              onClick={() => {
                soundManager.play('ui_click');
                setRoomListPage(prev => Math.max(0, prev - 1));
              }}
              disabled={roomListPage === 0}
              className="px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white font-bold hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              ◀ 이전
            </button>
            <span className="text-gray-400 text-sm font-bold">
              {roomListPage + 1} / {Math.ceil(roomList.length / ROOMS_PER_PAGE)}
            </span>
            <button
              onClick={() => {
                soundManager.play('ui_click');
                setRoomListPage(prev => Math.min(Math.ceil(roomList.length / ROOMS_PER_PAGE) - 1, prev + 1));
              }}
              disabled={roomListPage >= Math.ceil(roomList.length / ROOMS_PER_PAGE) - 1}
              className="px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white font-bold hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              다음 ▶
            </button>
          </div>
        )}

        {/* 안내 텍스트 */}
        <p className="text-gray-500 text-xs text-center">
          방을 클릭하여 참가하거나, 새 방을 생성하세요
        </p>
      </div>
    );
  };

  const renderContent = () => {
    switch (multiplayer.connectionState) {
      case 'in_lobby':
        return renderLobby();
      case 'countdown':
        return renderCountdown();
      default:
        return renderRoomSelect();
    }
  };

  return (
    <div className="fixed inset-0 bg-menu-gradient grid-overlay flex overflow-hidden">
      {/* 배경 효과 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/5 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-neon-cyan/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
      </div>

      {/* 왼쪽 상단 프로필 버튼 */}
      <div className="absolute top-8 left-8 z-20">
        <ProfileButton />
      </div>

      {/* 게임 초대 알림 */}
      <GameInviteNotification />

      {/* 메인 컨텐츠 영역 */}
      <div className="flex-1 flex flex-col items-center justify-center overflow-hidden">
        {/* 메인 컨텐츠 */}
        <div ref={contentScaleRef} className="relative z-10 flex flex-col items-center animate-fade-in">
          {isMobile ? (
            <>
              {/* 모바일: 제목+부제목 한 줄, 여백 축소 */}
              <div className="flex items-baseline gap-3 mb-5">
                <h1 className="font-game text-3xl text-green-400">RPG 게임</h1>
              </div>

              <div style={{ height: '10px' }} />

              <div className="flex items-baseline gap-3 mb-5">
                <span className="text-gray-400 text-sm">1~4명이 함께 보스를 물리치세요</span>
              </div>

              <div style={{ height: '10px' }} />

              {/* 콘텐츠 박스: 패딩 축소, min-h 제거 */}
              <div className="bg-gray-900/50 border border-gray-700 rounded-xl px-10 py-5 min-w-[900px] flex flex-col items-center justify-center">
                {renderContent()}
              </div>

              <div style={{ height: '15px' }} />

              {/* 뒤로 가기: 간격 축소 */}
              <button
                onClick={handleBack}
                className="mt-2 px-6 py-1.5 rounded-lg border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white transition-all cursor-pointer text-sm"
                style={{ paddingLeft: '7px', paddingRight: '7px', paddingTop: '3px', paddingBottom: '3px' }}
              >
                뒤로 가기
              </button>
            </>
          ) : (
            <>
              {/* 데스크톱/태블릿: 기존 레이아웃 */}
              <h1 className="font-game text-3xl md:text-4xl text-green-400 mb-4">
                RPG 게임
              </h1>

              <div style={{ height: '10px' }} />

              <p className="text-gray-400 mb-4">1~4명이 함께 보스를 물리치세요 (혼자 시작 가능)</p>

              <div style={{ height: '30px' }} />

              {/* 연결 상태에 따른 UI */}
              <div className="bg-gray-900/50 border border-gray-700 rounded-xl px-10 py-10 min-w-[900px] min-h-[480px] flex flex-col items-center justify-center">
                {renderContent()}
              </div>

              <div style={{ height: '30px' }} />

              {/* 뒤로 가기 */}
              <button
                onClick={handleBack}
                className="mt-8 px-8 py-3 rounded-lg border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white transition-all cursor-pointer"
                style={{ paddingLeft: '10px', paddingRight: '10px', paddingTop: '5px', paddingBottom: '5px' }}
              >
                뒤로 가기
              </button>
            </>
          )}
        </div>
      </div>

      {/* 오른쪽 친구 사이드바 */}
      <div className="relative z-20 h-full">
        <FriendSidebar
          currentRoomId={multiplayer.connectionState === 'in_lobby' ? multiplayer.roomId ?? undefined : undefined}
        />
      </div>

      {/* 코너 장식 */}
      <div className="absolute top-4 left-4 w-16 h-16 border-l-2 border-t-2 border-green-500/30" />
      <div className="absolute bottom-4 left-4 w-16 h-16 border-l-2 border-b-2 border-green-500/30" />

      {/* 직업 선택 모달 */}
      {showClassModal && (
        <div
          className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setShowClassModal(false)}
        >
          <div
            className="animate-fade-in flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 타이틀 */}
            <h1 className="font-game text-3xl md:text-4xl text-yellow-400 mb-4">
              직업 선택
            </h1>

            <div style={{ height: '10px' }} />

            <p className="text-gray-400 mb-8">플레이할 영웅의 직업을 선택하세요</p>

            <div style={{ height: '50px' }} />

            {/* 직업 카드들 */}
            <div className="flex gap-6">
              {CLASS_LIST.map((heroClass) => {
                const baseConfig = CLASS_CONFIGS[heroClass];
                const progress = classProgress.find(p => p.className === heroClass);
                const advClass = progress?.advancedClass as AdvancedHeroClass | undefined;
                const tier = progress?.tier;
                const advConfig = advClass ? ADVANCED_CLASS_CONFIGS[advClass] : null;

                // 전직 시 전직 스탯, 아니면 기본 스탯
                const displayName = advConfig ? advConfig.name : baseConfig.name;
                const displayDesc = advConfig ? advConfig.description : baseConfig.description;
                const upgrades = progress?.statUpgrades || createDefaultStatUpgrades();
                // createHeroUnit과 동일한 계산 (Math.floor 사용)
                const baseStats = advConfig ? {
                  hp: tier === 2 ? Math.floor(advConfig.stats.hp * SECOND_ENHANCEMENT_MULTIPLIER) : advConfig.stats.hp,
                  attack: tier === 2 ? Math.floor(advConfig.stats.attack * SECOND_ENHANCEMENT_MULTIPLIER) : advConfig.stats.attack,
                  attackSpeed: tier === 2 ? advConfig.stats.attackSpeed / SECOND_ENHANCEMENT_MULTIPLIER : advConfig.stats.attackSpeed,
                  speed: tier === 2 ? Math.floor(advConfig.stats.speed * SECOND_ENHANCEMENT_MULTIPLIER) : advConfig.stats.speed,
                  range: tier === 2 ? Math.floor(advConfig.stats.range * SECOND_ENHANCEMENT_MULTIPLIER) : advConfig.stats.range,
                } : {
                  hp: baseConfig.hp,
                  attack: baseConfig.attack,
                  attackSpeed: baseConfig.attackSpeed,
                  speed: baseConfig.speed,
                  range: baseConfig.range,
                };
                const displayStats = {
                  hp: baseStats.hp + getStatBonus('hp', upgrades.hp, tier),
                  attack: baseStats.attack + getStatBonus('attack', upgrades.attack, tier),
                  attackSpeed: Math.max(0.3, baseStats.attackSpeed - getStatBonus('attackSpeed', upgrades.attackSpeed, tier)),
                  speed: baseStats.speed + getStatBonus('speed', upgrades.speed, tier),
                  range: baseStats.range + getStatBonus('range', upgrades.range, tier),
                };

                const isSelected = selectedClass === heroClass;
                const isLocked = !isCharacterUnlocked(heroClass, playerLevel, isGuest);
                const unlockLevel = CHARACTER_UNLOCK_LEVELS[heroClass];

                const classColors: Record<HeroClass, { gradient: string; border: string; glow: string }> = {
                  warrior: {
                    gradient: 'from-red-500/20 to-orange-500/20',
                    border: 'border-red-500',
                    glow: 'shadow-[0_0_20px_rgba(239,68,68,0.3)]',
                  },
                  archer: {
                    gradient: 'from-green-500/20 to-emerald-500/20',
                    border: 'border-green-500',
                    glow: 'shadow-[0_0_20px_rgba(34,197,94,0.3)]',
                  },
                  knight: {
                    gradient: 'from-blue-500/20 to-cyan-500/20',
                    border: 'border-blue-500',
                    glow: 'shadow-[0_0_20px_rgba(59,130,246,0.3)]',
                  },
                  mage: {
                    gradient: 'from-purple-500/20 to-pink-500/20',
                    border: 'border-purple-500',
                    glow: 'shadow-[0_0_20px_rgba(168,85,247,0.3)]',
                  },
                };

                const colors = classColors[heroClass];

                return (
                  <button
                    key={heroClass}
                    onClick={() => {
                      if (!isLocked) {
                        handleClassSelect(heroClass);
                        setShowClassModal(false);
                      }
                    }}
                    disabled={isLocked}
                    className={`
                      group relative w-52 h-80 rounded-xl overflow-hidden
                      transition-all duration-300
                      ${isLocked
                        ? 'cursor-not-allowed opacity-70'
                        : 'hover:scale-105 active:scale-95 cursor-pointer'}
                      ${isSelected && !isLocked ? `${colors.glow} scale-105` : ''}
                    `}
                  >
                    {/* 배경 그라데이션 */}
                    <div className={`absolute inset-0 bg-gradient-to-b ${colors.gradient} ${!isLocked ? 'group-hover:opacity-150' : ''} transition-all duration-300`} />

                    {/* 테두리 */}
                    <div className={`
                      absolute inset-0 border-2 rounded-xl transition-all duration-300
                      ${isLocked ? 'border-gray-700' : isSelected ? colors.border : 'border-gray-600'}
                      ${isSelected && !isLocked ? colors.glow : ''}
                    `} />

                    {/* 잠금 오버레이 */}
                    {isLocked && (
                      <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center z-10 rounded-xl">
                        <span className="mb-2"><Emoji emoji="🔒" size={36} /></span>
                        <p className="text-gray-300 text-sm font-bold">
                          {isGuest ? '회원 전용' : `Lv.${unlockLevel} 필요`}
                        </p>
                        {isGuest && (
                          <p className="text-gray-400 text-xs mt-1">회원가입 후 이용 가능</p>
                        )}
                      </div>
                    )}

                    {/* 선택 표시 */}
                    {isSelected && !isLocked && (
                      <div className="absolute top-3 right-3 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center z-20">
                        <span className="text-white text-lg">✓</span>
                      </div>
                    )}

                    {/* 전직 단계 표시 */}
                    {advConfig && !isLocked && (
                      <div className="absolute top-3 left-3 z-20 text-yellow-400 text-sm drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                        {tier === 2 ? '★★' : '★'}
                      </div>
                    )}

                    {/* 컨텐츠 */}
                    <div className={`relative h-full flex flex-col items-center justify-center p-6 ${isLocked ? 'opacity-50' : ''}`}
                    style={{ paddingLeft: '5px', paddingRight: '5px' }}>
                      {/* 캐릭터 이미지 */}
                      <div className={`mb-4 transform ${!isLocked ? 'group-hover:scale-110' : ''} transition-transform`}>
                        <img
                          src={getHeroImagePath(heroClass, advClass, tier)}
                          alt={displayName}
                          className="w-20 h-20 object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
                          draggable={false}
                        />
                      </div>

                      <div style={{ height: '30px' }} />

                      {/* 직업명 */}
                      <h2 className="font-game text-2xl text-white mb-4">{displayName}</h2>

                      <div style={{ height: '10px' }} />

                      {/* 설명 */}
                      <p className="text-gray-300 text-xs text-center mb-4 px-2">
                        {displayDesc}
                      </p>

                      <div style={{ height: '10px' }} />

                      {/* 스탯 미리보기 */}
                      <div className="w-full space-y-1 text-xs">
                        <div className="flex justify-between px-2">
                          <span className="text-gray-400">HP</span>
                          <span className="text-white font-bold">{displayStats.hp}</span>
                        </div>
                        <div className="flex justify-between px-2">
                          <span className="text-gray-400">공격력</span>
                          <span className="text-red-400 font-bold">{displayStats.attack}</span>
                        </div>
                        <div className="flex justify-between px-2">
                          <span className="text-gray-400">공속</span>
                          <span className="text-yellow-400 font-bold">{displayStats.attackSpeed.toFixed(2)}초</span>
                        </div>
                        <div className="flex justify-between px-2">
                          <span className="text-gray-400">이동속도</span>
                          <span className="text-blue-400 font-bold">{displayStats.speed.toFixed(1)}</span>
                        </div>
                        <div className="flex justify-between px-2">
                          <span className="text-gray-400">사거리</span>
                          <span className="text-green-400 font-bold">{displayStats.range}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={{ height: '50px' }} />

            {/* 안내 텍스트 */}
            <p className="text-gray-500 text-sm mt-8">카드를 클릭하여 직업을 선택하세요 (배경 클릭 시 닫기)</p>
          </div>
        </div>
      )}

      {/* 방 생성 모달 */}
      {showCreateRoomModal && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => {
            setShowCreateRoomModal(false);
            setSelectedRoomType(null);
            setSelectedModalDifficulty(null);
          }}
        >
          <div
            className="animate-fade-in flex flex-col items-center bg-gray-900/90 border border-gray-700 rounded-2xl p-8"
            style={{ paddingLeft: '30px', paddingRight: '30px', paddingTop: '20px', paddingBottom: '25px' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 타이틀 */}
            <h2 className="font-game text-2xl text-yellow-400 mb-6">
              방 생성
            </h2>

            <div style={{ height: '3px' }} />

            {/* 방 유형 선택 */}
            <div className="mb-6">
              <p className="text-gray-400 text-sm mb-3 text-center">방 유형</p>

              <div style={{ height: '10px' }} />
              
              <div className="flex gap-4">
                {/* 공개방 */}
                <button
                  onClick={() => {
                    soundManager.play('ui_click');
                    setSelectedRoomType('public');
                  }}
                  className={`group flex flex-col items-center justify-center w-36 h-28 border-2 rounded-xl transition-all cursor-pointer ${
                    selectedRoomType === 'public'
                      ? 'border-green-400 bg-green-500/20'
                      : 'border-gray-600 hover:border-green-500/70 hover:bg-green-500/10'
                  }`}
                >
                  <span className="mb-2"><Emoji emoji="🌐" size={30} /></span>
                  <span className={`font-bold ${selectedRoomType === 'public' ? 'text-green-400' : 'text-gray-400'}`}>공개방</span>
                  <span className="text-gray-500 text-xs mt-1">누구나 참가</span>
                </button>

                {/* 비밀방 */}
                <button
                  onClick={() => {
                    soundManager.play('ui_click');
                    setSelectedRoomType('private');
                  }}
                  className={`group flex flex-col items-center justify-center w-36 h-28 border-2 rounded-xl transition-all cursor-pointer ${
                    selectedRoomType === 'private'
                      ? 'border-neon-purple bg-neon-purple/20'
                      : 'border-gray-600 hover:border-neon-purple/70 hover:bg-neon-purple/10'
                  }`}
                >
                  <span className="mb-2"><Emoji emoji="🔒" size={30} /></span>
                  <span className={`font-bold ${selectedRoomType === 'private' ? 'text-neon-purple' : 'text-gray-400'}`}>비밀방</span>
                  <span className="text-gray-500 text-xs mt-1">코드로 참가</span>
                </button>
              </div>
            </div>
            
            <div style={{ height: '10px' }} />

            {/* 난이도 선택 */}
            <div className="mb-6">
              <p className="text-gray-400 text-sm mb-3 text-center">난이도</p>

              <div style={{ height: '10px' }} />

              <div className="flex gap-3">
                {(Object.keys(DIFFICULTY_CONFIGS) as RPGDifficulty[]).map((diff) => {
                  const config = DIFFICULTY_CONFIGS[diff];
                  const colors = difficultyColors[diff];
                  const isSelected = selectedModalDifficulty === diff;
                  return (
                    <button
                      key={diff}
                      onClick={() => {
                        soundManager.play('ui_click');
                        setSelectedModalDifficulty(diff);
                      }}
                      className={`flex flex-col items-center justify-center w-20 h-20 border-2 rounded-xl transition-all cursor-pointer ${
                        isSelected
                          ? `${colors.border} ${colors.bg}`
                          : `border-gray-600 hover:${colors.border} ${colors.hoverBg}`
                      }`}
                    >
                      <span className={`font-bold text-sm ${isSelected ? colors.text : 'text-gray-400'}`}>
                        {config.name}
                      </span>
                      <span className={`text-xs mt-0.5 ${isSelected ? colors.text : 'text-gray-500'}`} style={{ opacity: 0.7 }}>
                        Lv.{config.recommendedLevel}+
                      </span>
                    </button>
                  );
                })}
              </div>
              <div style={{ height: '10px' }} />
            </div>

            {/* 맵 테마 선택 */}
            <div className="mb-6">
              <p className="text-gray-400 text-sm mb-3 text-center">맵 테마</p>

              <div style={{ height: '10px' }} />

              <div className="flex gap-3">
                {MAP_THEME_LIST.map((theme) => {
                  const isSelected = selectedModalMapTheme === theme.id;
                  const themeModalColors: Record<MapTheme, { border: string; bg: string; text: string; hoverBorder: string; hoverBg: string }> = {
                    forest: { border: 'border-green-500', bg: 'bg-green-500/20', text: 'text-green-400', hoverBorder: 'hover:border-green-500', hoverBg: 'hover:bg-green-500/10' },
                    ice: { border: 'border-cyan-500', bg: 'bg-cyan-500/20', text: 'text-cyan-400', hoverBorder: 'hover:border-cyan-500', hoverBg: 'hover:bg-cyan-500/10' },
                    volcano: { border: 'border-orange-500', bg: 'bg-orange-500/20', text: 'text-orange-400', hoverBorder: 'hover:border-orange-500', hoverBg: 'hover:bg-orange-500/10' },
                    shadow: { border: 'border-purple-500', bg: 'bg-purple-500/20', text: 'text-purple-400', hoverBorder: 'hover:border-purple-500', hoverBg: 'hover:bg-purple-500/10' },
                  };
                  const tc = themeModalColors[theme.id];
                  const themeEmojis: Record<MapTheme, string> = {
                    forest: '🌲',
                    ice: '❄️',
                    volcano: '🌋',
                    shadow: '🌑',
                  };
                  return (
                    <button
                      key={theme.id}
                      onClick={() => {
                        soundManager.play('ui_click');
                        setSelectedModalMapTheme(theme.id);
                      }}
                      className={`flex flex-col items-center justify-center w-20 h-20 border-2 rounded-xl transition-all cursor-pointer ${
                        isSelected
                          ? `${tc.border} ${tc.bg}`
                          : `border-gray-600 ${tc.hoverBorder} ${tc.hoverBg}`
                      }`}
                    >
                      <span className="mb-1"><Emoji emoji={themeEmojis[theme.id]} size={24} /></span>
                      <span className={`font-bold text-sm ${isSelected ? tc.text : 'text-gray-400'}`}>
                        {theme.name}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div style={{ height: '10px' }} />
            </div>

            {/* 버튼들 */}
            <div className="flex gap-4 mt-4">
              <button
                onClick={() => {
                  setShowCreateRoomModal(false);
                  setSelectedRoomType(null);
                  setSelectedModalDifficulty(null);
                  setSelectedModalMapTheme('forest');
                }}
                className="px-6 py-2 rounded-lg border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white transition-all cursor-pointer"
                style={{ paddingLeft: '10px', paddingRight: '10px', paddingTop: '5px', paddingBottom: '5px' }}
              >
                취소
              </button>
              <button
                onClick={handleCreateRoom}
                disabled={selectedRoomType === null || selectedModalDifficulty === null || isConnecting}
                className={`px-6 py-2 rounded-lg font-bold transition-all cursor-pointer ${
                  selectedRoomType !== null && selectedModalDifficulty !== null && !isConnecting
                    ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white hover:from-yellow-400 hover:to-orange-400'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
                style={{ paddingLeft: '10px', paddingRight: '10px', paddingTop: '5px', paddingBottom: '5px' }}
              >
                {isConnecting ? '생성 중...' : '생성하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 비밀방 코드 입력 모달 */}
      {privateRoomToJoin && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => {
            setPrivateRoomToJoin(null);
            setPrivateRoomCode('');
            setError(null);
          }}
        >
          <div
            className="animate-fade-in flex flex-col items-center bg-gray-900/90 border border-yellow-500/50 rounded-2xl p-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 타이틀 */}
            <div className="flex items-center gap-3 mb-4">
              <Emoji emoji="🔒" size={30} />
              <h2 className="font-game text-2xl text-yellow-400">비밀방</h2>
            </div>

            {/* 방 정보 */}
            <div className="flex items-center gap-3 mb-6 px-4 py-3 bg-gray-800/50 rounded-lg">
              <Emoji emoji={CLASS_CONFIGS[privateRoomToJoin.hostHeroClass].emoji} size={24} />
              <div>
                <p className="text-white font-bold">{privateRoomToJoin.hostName}</p>
                <p className="text-gray-500 text-sm">{privateRoomToJoin.playerCount}/{privateRoomToJoin.maxPlayers}명</p>
              </div>
            </div>

            <p className="text-gray-400 mb-4">초대 코드를 입력하세요</p>

            {/* 코드 입력 */}
            <input
              type="text"
              value={privateRoomCode}
              onChange={(e) => setPrivateRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="6자리 코드"
              maxLength={6}
              className="w-48 px-4 py-4 bg-gray-800/50 border border-yellow-500/50 rounded-lg text-white text-center text-2xl tracking-[0.3em] font-mono focus:border-yellow-400 focus:outline-none uppercase"
              onKeyDown={(e) => e.key === 'Enter' && handleJoinPrivateRoom()}
              autoFocus
            />

            {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

            {/* 버튼들 */}
            <div className="flex gap-4 mt-6">
              <button
                onClick={() => {
                  setPrivateRoomToJoin(null);
                  setPrivateRoomCode('');
                  setError(null);
                }}
                className="px-6 py-2 text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={handleJoinPrivateRoom}
                disabled={privateRoomCode.length !== 6 || isConnecting}
                className="px-6 py-2 rounded-lg bg-yellow-500/20 border border-yellow-500 text-yellow-400 hover:bg-yellow-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                {isConnecting ? '연결 중...' : '참가'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 직업 도감 모달 */}
      <ClassEncyclopediaModal
        isOpen={showEncyclopedia}
        onClose={() => setShowEncyclopedia(false)}
        playerLevel={playerLevel}
      />

      {/* 랭킹 모달 */}
      <RankingModal
        isOpen={showRanking}
        onClose={() => setShowRanking(false)}
      />
    </div>
  );
};
