import React, { useEffect, useState, useCallback } from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { useRPGStore, useMultiplayer } from '../../stores/useRPGStore';
import { useGameStore } from '../../stores/useGameStore';
import { useAuthProfile, useAuthIsGuest, useAuthStore } from '../../stores/useAuthStore';
import { soundManager } from '../../services/SoundManager';
import { CLASS_CONFIGS } from '../../constants/rpgConfig';
import { CHARACTER_UNLOCK_LEVELS, isCharacterUnlocked, createDefaultStatUpgrades } from '../../types/auth';
import type { HeroClass } from '../../types/rpg';
import { wsClient } from '../../services/WebSocketClient';
import {
  createMultiplayerRoom,
  joinMultiplayerRoom,
  leaveMultiplayerRoom,
  startMultiplayerGame,
} from '../../hooks/useNetworkSync';

const CLASS_LIST: HeroClass[] = ['archer', 'warrior', 'knight', 'mage'];

export const RPGCoopLobbyScreen: React.FC = () => {
  const setScreen = useUIStore((state) => state.setScreen);
  const resetGameUI = useUIStore((state) => state.resetGameUI);
  const setGameMode = useGameStore((state) => state.setGameMode);
  const selectedClass = useRPGStore((state) => state.selectedClass);
  const selectClass = useRPGStore((state) => state.selectClass);
  const multiplayer = useMultiplayer();

  // 프로필 및 직업 해금 확인용
  const profile = useAuthProfile();
  const isGuest = useAuthIsGuest();
  const playerLevel = profile?.playerLevel ?? 1;

  const [inputRoomCode, setInputRoomCode] = useState('');
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 게임 시작 시 게임 화면으로 전환
  useEffect(() => {
    if (multiplayer.connectionState === 'in_game') {
      resetGameUI();
      setGameMode('rpg');
      setScreen('game');
    }
  }, [multiplayer.connectionState, setScreen, resetGameUI, setGameMode]);

  // 에러 자동 클리어
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // WebSocket 메시지 핸들러 설정
  useEffect(() => {
    const handleMessage = (message: any) => {
      switch (message.type) {
        case 'COOP_ROOM_CREATED':
          useRPGStore.getState().setMultiplayerState({
            roomCode: message.roomCode,
            isHost: true,
            connectionState: 'in_lobby',
            players: [{
              id: wsClient.playerId || '',
              name: profile?.nickname || '플레이어',
              heroClass: selectedClass || 'archer',
              characterLevel: 1,
              isHost: true,
              isReady: true,
              connected: true,
            }],
          });
          break;

        case 'COOP_ROOM_JOINED':
          useRPGStore.getState().setMultiplayerState({
            roomCode: message.roomCode,
            isHost: false,
            connectionState: 'in_lobby',
            players: message.players || [],
          });
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

        case 'COOP_ROOM_ERROR':
          setError(message.message);
          break;

        case 'COOP_GAME_COUNTDOWN':
          useRPGStore.getState().setMultiplayerState({
            connectionState: 'countdown',
            countdown: message.seconds,
          });
          break;

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
          // 게임 초기화 (영웅, 넥서스, 적 기지 등 생성)
          useRPGStore.getState().initMultiplayerGame(message.players, message.isHost);
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
      const heroClass = selectedClass || 'archer';

      // classProgress에서 해당 캐릭터의 레벨과 statUpgrades 가져오기
      const classProgress = useAuthStore.getState().classProgress;
      const progress = classProgress.find(p => p.className === heroClass);
      const characterLevel = progress?.classLevel || 1;
      const statUpgrades = progress?.statUpgrades || createDefaultStatUpgrades();

      joinMultiplayerRoom(inputRoomCode.trim().toUpperCase(), playerName, heroClass, characterLevel, statUpgrades);
    } catch (e) {
      setError('서버 연결 실패');
    }
    setIsConnecting(false);
  }, [inputRoomCode, profile, selectedClass]);

  const handleBack = useCallback(() => {
    soundManager.play('ui_click');
    if (multiplayer.connectionState === 'in_lobby' || multiplayer.connectionState === 'countdown') {
      leaveMultiplayerRoom();
    }
    useRPGStore.getState().resetMultiplayerState();
    setShowJoinInput(false);
    setInputRoomCode('');
    setScreen('rpgPlayTypeSelect');
  }, [multiplayer.connectionState, setScreen]);

  const handleLeaveRoom = useCallback(() => {
    soundManager.play('ui_click');
    leaveMultiplayerRoom();
    setShowJoinInput(false);
    setInputRoomCode('');
  }, []);

  const handleClassSelect = useCallback((heroClass: HeroClass) => {
    if (!isCharacterUnlocked(heroClass, playerLevel, isGuest)) {
      setError('해금되지 않은 직업입니다.');
      return;
    }
    soundManager.play('ui_click');
    selectClass(heroClass);

    // 서버에 직업 변경 알림
    if (multiplayer.connectionState === 'in_lobby') {
      wsClient.send({ type: 'CHANGE_COOP_CLASS', heroClass });
    }
  }, [playerLevel, isGuest, selectClass, multiplayer.connectionState]);

  const handleStartGame = useCallback(() => {
    soundManager.play('ui_click');
    startMultiplayerGame();
  }, []);

  const handleToggleReady = useCallback(() => {
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

  // 방 참가 입력 화면
  const renderJoinInput = () => (
    <div className="flex flex-col items-center gap-6">
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

      {/* 직업 선택 */}
      <div className="flex flex-col items-center gap-2">
        <p className="text-gray-400 text-sm">직업 선택</p>
        <div className="flex gap-2">
          {CLASS_LIST.map((heroClass) => {
            const config = CLASS_CONFIGS[heroClass];
            const isSelected = selectedClass === heroClass;
            const isLocked = !isCharacterUnlocked(heroClass, playerLevel, isGuest);
            const requiredLevel = CHARACTER_UNLOCK_LEVELS[heroClass];
            return (
              <button
                key={heroClass}
                onClick={() => handleClassSelect(heroClass)}
                disabled={isLocked}
                className={`relative px-3 py-1 rounded-lg border transition-all text-sm ${
                  isLocked
                    ? 'border-gray-700 text-gray-600 cursor-not-allowed opacity-50'
                    : isSelected
                      ? 'bg-neon-cyan/30 border-neon-cyan text-neon-cyan cursor-pointer'
                      : 'border-gray-600 text-gray-400 hover:border-gray-400 cursor-pointer'
                }`}
                title={isLocked ? `레벨 ${requiredLevel} 필요` : config.name}
              >
                <span>{config.emoji}</span>
                <span className="ml-1">{config.name}</span>
                {isLocked && (
                  <span className="absolute -top-1 -right-1 text-[10px] bg-gray-700 px-0.5 rounded">
                    🔒
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

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

    return (
      <div className="flex flex-col items-center gap-4">
        {/* 초대 코드 */}
        {multiplayer.roomCode && (
          <div className="mb-4">
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
        )}

        {/* 플레이어 목록 */}
        <div className="w-full max-w-md bg-gray-800/30 rounded-lg p-4">
          <p className="text-gray-400 text-sm mb-3">플레이어 ({players.length}/4)</p>
          <div className="space-y-2">
            {players.map((player) => {
              const config = CLASS_CONFIGS[player.heroClass];
              const isMe = player.id === wsClient.playerId;
              return (
                <div
                  key={player.id}
                  className={`flex items-center justify-between px-4 py-2 rounded-lg border ${
                    isMe
                      ? 'border-neon-cyan bg-neon-cyan/10'
                      : 'border-gray-700 bg-gray-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{config.emoji}</span>
                    <div>
                      <p className={`font-bold ${isMe ? 'text-neon-cyan' : 'text-white'}`}>
                        {player.name}
                        {player.isHost && <span className="ml-2 text-yellow-500 text-xs">(호스트)</span>}
                      </p>
                      <p className="text-gray-500 text-xs">{config.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {player.isReady && !player.isHost && (
                      <span className="text-green-400 text-sm">준비 완료</span>
                    )}
                    {!player.connected && (
                      <span className="text-red-400 text-sm">연결 끊김</span>
                    )}
                  </div>
                </div>
              );
            })}
            {/* 빈 슬롯 */}
            {Array.from({ length: 4 - players.length }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="flex items-center justify-center px-4 py-2 rounded-lg border border-gray-700/50 border-dashed text-gray-600"
              >
                대기중...
              </div>
            ))}
          </div>
        </div>

        {/* 직업 변경 */}
        <div className="flex flex-col items-center gap-2">
          <p className="text-gray-400 text-sm">직업 변경</p>
          <div className="flex gap-2">
            {CLASS_LIST.map((heroClass) => {
              const config = CLASS_CONFIGS[heroClass];
              const isSelected = selectedClass === heroClass;
              const isLocked = !isCharacterUnlocked(heroClass, playerLevel, isGuest);
              const requiredLevel = CHARACTER_UNLOCK_LEVELS[heroClass];
              return (
                <button
                  key={heroClass}
                  onClick={() => handleClassSelect(heroClass)}
                  disabled={isLocked}
                  className={`relative px-3 py-1 rounded-lg border transition-all text-sm ${
                    isLocked
                      ? 'border-gray-700 text-gray-600 cursor-not-allowed opacity-50'
                      : isSelected
                        ? 'bg-neon-cyan/30 border-neon-cyan text-neon-cyan cursor-pointer'
                        : 'border-gray-600 text-gray-400 hover:border-gray-400 cursor-pointer'
                  }`}
                  title={isLocked ? `레벨 ${requiredLevel} 필요` : config.name}
                >
                  <span>{config.emoji}</span>
                  <span className="ml-1">{config.name}</span>
                  {isLocked && (
                    <span className="absolute -top-1 -right-1 text-[10px] bg-gray-700 px-0.5 rounded">
                      🔒
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {/* 액션 버튼 */}
        <div className="flex gap-4 mt-4">
          <button
            onClick={handleLeaveRoom}
            className="px-6 py-2 rounded-lg border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white transition-all cursor-pointer"
          >
            나가기
          </button>

          {isHostPlayer ? (
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
          )}
        </div>
      </div>
    );
  };

  // 카운트다운 화면
  const renderCountdown = () => (
    <div className="flex flex-col items-center gap-6">
      <p className="text-green-400 text-xl">게임 시작!</p>

      <div className="flex flex-wrap justify-center gap-4">
        {multiplayer.players.map((player) => {
          const config = CLASS_CONFIGS[player.heroClass];
          return (
            <div key={player.id} className="text-center px-4">
              <span className="text-2xl">{config.emoji}</span>
              <p className="text-white font-bold">{player.name}</p>
              <p className="text-gray-500 text-xs">{config.name}</p>
            </div>
          );
        })}
      </div>

      {multiplayer.countdown && multiplayer.countdown > 0 && (
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
      <div className="flex flex-col items-center gap-6">
        <p className="text-gray-400 mb-4">방을 생성하거나 참가하세요</p>

        {/* 직업 선택 */}
        <div className="flex flex-col items-center gap-2 mb-4">
          <p className="text-gray-400 text-sm">직업 선택</p>
          <div className="flex gap-2">
            {CLASS_LIST.map((heroClass) => {
              const config = CLASS_CONFIGS[heroClass];
              const isSelected = selectedClass === heroClass;
              const isLocked = !isCharacterUnlocked(heroClass, playerLevel, isGuest);
              const requiredLevel = CHARACTER_UNLOCK_LEVELS[heroClass];
              return (
                <button
                  key={heroClass}
                  onClick={() => handleClassSelect(heroClass)}
                  disabled={isLocked}
                  className={`relative px-4 py-2 rounded-lg border transition-all ${
                    isLocked
                      ? 'border-gray-700 text-gray-600 cursor-not-allowed opacity-50'
                      : isSelected
                        ? 'bg-neon-cyan/30 border-neon-cyan text-neon-cyan cursor-pointer'
                        : 'border-gray-600 text-gray-400 hover:border-gray-400 cursor-pointer'
                  }`}
                  title={isLocked ? `레벨 ${requiredLevel} 필요` : config.name}
                >
                  <span className="text-lg">{config.emoji}</span>
                  <span className="ml-1 text-sm">{config.name}</span>
                  {isLocked && (
                    <span className="absolute -top-1 -right-1 text-xs bg-gray-700 px-1 rounded">
                      🔒{requiredLevel}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {error && <p className="text-red-400 text-sm mb-2">{error}</p>}

        <div className="flex gap-4">
          <button
            onClick={async () => {
              soundManager.play('ui_click');
              setIsConnecting(true);
              try {
                await wsClient.connect();
                const playerName = profile?.nickname || '플레이어';
                const heroClass = selectedClass || 'archer';

                // classProgress에서 해당 캐릭터의 레벨과 statUpgrades 가져오기
                const classProgress = useAuthStore.getState().classProgress;
                const progress = classProgress.find(p => p.className === heroClass);
                const characterLevel = progress?.classLevel || 1;
                const statUpgrades = progress?.statUpgrades || createDefaultStatUpgrades();

                createMultiplayerRoom(playerName, heroClass, characterLevel, statUpgrades);
              } catch (e) {
                setError('서버 연결 실패');
              }
              setIsConnecting(false);
            }}
            disabled={isConnecting}
            className="px-8 py-4 rounded-lg bg-neon-cyan/20 border border-neon-cyan text-neon-cyan hover:bg-neon-cyan/30 disabled:opacity-50 transition-all text-lg cursor-pointer"
          >
            {isConnecting ? '연결 중...' : '방 생성'}
          </button>

          <button
            onClick={() => setShowJoinInput(true)}
            className="px-8 py-4 rounded-lg bg-neon-purple/20 border border-neon-purple text-neon-purple hover:bg-neon-purple/30 transition-all text-lg cursor-pointer"
          >
            방 참가
          </button>
        </div>
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
    <div className="fixed inset-0 bg-menu-gradient grid-overlay flex flex-col items-center justify-center overflow-hidden">
      {/* 배경 효과 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/5 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-neon-cyan/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
      </div>

      {/* 메인 컨텐츠 */}
      <div className="relative z-10 flex flex-col items-center animate-fade-in">
        {/* 타이틀 */}
        <h1 className="font-game text-3xl md:text-4xl text-green-400 mb-4">
          멀티플레이
        </h1>
        <p className="text-gray-400 mb-8">1~4명이 함께 웨이브를 클리어하세요 (혼자 시작 가능)</p>

        <div style={{ height: '30px' }} />

        {/* 연결 상태에 따른 UI */}
        <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-8 min-w-[500px] min-h-[400px] flex flex-col items-center justify-center">
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
      </div>

      {/* 코너 장식 */}
      <div className="absolute top-4 left-4 w-16 h-16 border-l-2 border-t-2 border-green-500/30" />
      <div className="absolute top-4 right-4 w-16 h-16 border-r-2 border-t-2 border-green-500/30" />
      <div className="absolute bottom-4 left-4 w-16 h-16 border-l-2 border-b-2 border-green-500/30" />
      <div className="absolute bottom-4 right-4 w-16 h-16 border-r-2 border-b-2 border-green-500/30" />
    </div>
  );
};
