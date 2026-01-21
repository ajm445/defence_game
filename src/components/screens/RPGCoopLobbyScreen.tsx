import React, { useEffect, useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { useRPGCoopStore, useCoopPlayers, useCoopRoomCode } from '../../stores/useRPGCoopStore';
import { soundManager } from '../../services/SoundManager';
import { CLASS_CONFIGS } from '../../constants/rpgConfig';
import type { HeroClass } from '../../types/rpg';

const CLASS_LIST: HeroClass[] = ['warrior', 'archer', 'knight', 'mage'];

export const RPGCoopLobbyScreen: React.FC = () => {
  const setScreen = useUIStore((state) => state.setScreen);
  const {
    connectionState,
    roomInfo,
    countdown,
    error,
    playerName,
    selectedClass,
    myIndex,
    connect,
    disconnect,
    createRoom,
    joinRoom,
    leaveRoom,
    setPlayerName,
    setSelectedClass,
    setReady,
    startGame,
    kickPlayer,
    reset,
    isHost,
    canStartGame,
  } = useRPGCoopStore();

  const players = useCoopPlayers();
  const roomCode = useCoopRoomCode();

  const [inputName, setInputName] = useState(playerName || '');
  const [isConnecting, setIsConnecting] = useState(false);
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [inputRoomCode, setInputRoomCode] = useState('');

  // 게임 시작 시 게임 화면으로 전환
  useEffect(() => {
    if (connectionState === 'coop_in_game') {
      setScreen('rpgCoopGame');
    }
  }, [connectionState, setScreen]);

  // 에러 자동 클리어
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        useRPGCoopStore.setState({ error: null });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleConnect = async () => {
    if (!inputName.trim()) return;

    soundManager.play('ui_click');
    setIsConnecting(true);
    try {
      await connect(inputName.trim());
    } catch (e) {
      // 에러는 스토어에서 처리됨
    }
    setIsConnecting(false);
  };

  const handleCreateRoom = () => {
    soundManager.play('ui_click');
    setPlayerName(inputName.trim());
    createRoom();
  };

  const handleJoinRoom = () => {
    soundManager.play('ui_click');
    if (inputRoomCode.trim().length !== 6) {
      useRPGCoopStore.setState({ error: '6자리 초대 코드를 입력하세요.' });
      return;
    }
    setPlayerName(inputName.trim());
    joinRoom(inputRoomCode.trim().toUpperCase());
  };

  const handleBack = () => {
    soundManager.play('ui_click');
    if (connectionState === 'in_coop_lobby' || connectionState === 'coop_countdown') {
      leaveRoom();
    } else if (connectionState !== 'disconnected') {
      disconnect();
    }
    reset();
    setShowJoinInput(false);
    setInputRoomCode('');
    setScreen('rpgPlayTypeSelect');
  };

  const handleLeaveRoom = () => {
    soundManager.play('ui_click');
    leaveRoom();
    setShowJoinInput(false);
    setInputRoomCode('');
  };

  const handleClassSelect = (heroClass: HeroClass) => {
    soundManager.play('ui_click');
    setSelectedClass(heroClass);
  };

  const handleToggleReady = () => {
    soundManager.play('ui_click');
    const myPlayer = players[myIndex];
    if (myPlayer) {
      setReady(!myPlayer.isReady);
    }
  };

  const handleStartGame = () => {
    soundManager.play('ui_click');
    startGame();
  };

  const handleKickPlayer = (playerId: string) => {
    soundManager.play('ui_click');
    kickPlayer(playerId);
  };

  const copyRoomCode = async () => {
    if (roomCode) {
      try {
        await navigator.clipboard.writeText(roomCode);
        soundManager.play('ui_click');
      } catch (e) {
        console.error('클립보드 복사 실패:', e);
      }
    }
  };

  const renderConnectionScreen = () => (
    <div className="flex flex-col items-center gap-6">
      <p className="text-gray-400 mb-4">플레이어 이름을 입력하세요</p>

      <input
        type="text"
        value={inputName}
        onChange={(e) => setInputName(e.target.value)}
        placeholder="이름 입력..."
        maxLength={20}
        className="w-64 px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white text-center focus:border-neon-cyan focus:outline-none"
        onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
      />

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        onClick={handleConnect}
        disabled={!inputName.trim() || isConnecting}
        className="px-8 py-3 rounded-lg bg-neon-cyan/20 border border-neon-cyan text-neon-cyan hover:bg-neon-cyan/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
      >
        {isConnecting ? '연결 중...' : '서버 연결'}
      </button>
    </div>
  );

  const renderRoomSelectScreen = () => {
    if (showJoinInput) {
      return (
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

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-4">
            <button
              onClick={() => {
                setShowJoinInput(false);
                setInputRoomCode('');
                useRPGCoopStore.setState({ error: null });
              }}
              className="px-6 py-3 rounded-lg border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white transition-all cursor-pointer"
            >
              취소
            </button>
            <button
              onClick={handleJoinRoom}
              disabled={inputRoomCode.length !== 6}
              className="px-6 py-3 rounded-lg bg-neon-purple/20 border border-neon-purple text-neon-purple hover:bg-neon-purple/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              참가
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center gap-6">
        <p className="text-green-400 mb-2">서버 연결됨</p>
        <p className="text-gray-400 mb-4">
          플레이어: <span className="text-white font-bold">{inputName}</span>
        </p>

        {/* 직업 선택 */}
        <div className="flex flex-col items-center gap-2 mb-4">
          <p className="text-gray-400 text-sm">직업 선택</p>
          <div className="flex gap-2">
            {CLASS_LIST.map((heroClass) => {
              const config = CLASS_CONFIGS[heroClass];
              const isSelected = selectedClass === heroClass;
              return (
                <button
                  key={heroClass}
                  onClick={() => handleClassSelect(heroClass)}
                  className={`px-4 py-2 rounded-lg border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-neon-cyan/30 border-neon-cyan text-neon-cyan'
                      : 'border-gray-600 text-gray-400 hover:border-gray-400'
                  }`}
                >
                  <span className="text-lg">{config.emoji}</span>
                  <span className="ml-1 text-sm">{config.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {error && <p className="text-red-400 text-sm mb-2">{error}</p>}

        <div className="flex gap-4">
          <button
            onClick={handleCreateRoom}
            className="px-8 py-4 rounded-lg bg-neon-cyan/20 border border-neon-cyan text-neon-cyan hover:bg-neon-cyan/30 transition-all text-lg cursor-pointer"
          >
            방 생성
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

  const renderLobbyScreen = () => {
    const myPlayer = players[myIndex];
    const isHostPlayer = isHost();

    return (
      <div className="flex flex-col items-center gap-4">
        {/* 초대 코드 */}
        {roomCode && (
          <div className="mb-4">
            <p className="text-neon-cyan text-sm mb-1 text-center">초대 코드</p>
            <div
              className="px-6 py-2 bg-gray-800/50 border-2 border-neon-cyan rounded-lg cursor-pointer hover:bg-gray-800/70 transition-all"
              onClick={copyRoomCode}
              title="클릭하여 복사"
            >
              <p className="text-2xl font-bold tracking-[0.3em] text-white font-mono">
                {roomCode}
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
              return (
                <div
                  key={player.id}
                  className={`flex items-center justify-between px-4 py-2 rounded-lg border ${
                    player.id === myPlayer?.id
                      ? 'border-neon-cyan bg-neon-cyan/10'
                      : 'border-gray-700 bg-gray-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{config.emoji}</span>
                    <div>
                      <p className={`font-bold ${player.id === myPlayer?.id ? 'text-neon-cyan' : 'text-white'}`}>
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
                    {isHostPlayer && !player.isHost && player.id !== myPlayer?.id && (
                      <button
                        onClick={() => handleKickPlayer(player.id)}
                        className="px-2 py-1 text-xs rounded border border-red-500/50 text-red-400 hover:bg-red-500/20 transition-all cursor-pointer"
                      >
                        추방
                      </button>
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
              return (
                <button
                  key={heroClass}
                  onClick={() => handleClassSelect(heroClass)}
                  className={`px-3 py-1 rounded-lg border transition-all cursor-pointer text-sm ${
                    isSelected
                      ? 'bg-neon-cyan/30 border-neon-cyan text-neon-cyan'
                      : 'border-gray-600 text-gray-400 hover:border-gray-400'
                  }`}
                >
                  <span>{config.emoji}</span>
                  <span className="ml-1">{config.name}</span>
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
              disabled={!canStartGame()}
              className="px-6 py-2 rounded-lg bg-green-500/20 border border-green-500 text-green-400 hover:bg-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              게임 시작
            </button>
          ) : (
            <button
              onClick={handleToggleReady}
              className={`px-6 py-2 rounded-lg transition-all cursor-pointer ${
                myPlayer?.isReady
                  ? 'bg-yellow-500/20 border border-yellow-500 text-yellow-400 hover:bg-yellow-500/30'
                  : 'bg-green-500/20 border border-green-500 text-green-400 hover:bg-green-500/30'
              }`}
            >
              {myPlayer?.isReady ? '준비 취소' : '준비'}
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderCountdownScreen = () => (
    <div className="flex flex-col items-center gap-6">
      <p className="text-green-400 text-xl">게임 시작!</p>

      <div className="flex flex-wrap justify-center gap-4">
        {players.map((player) => {
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

      {countdown > 0 && (
        <div className="mt-4 text-center">
          <p className="text-gray-400">게임 시작까지</p>
          <p className="text-6xl font-bold text-neon-cyan animate-pulse">{countdown}</p>
        </div>
      )}
    </div>
  );

  const renderContent = () => {
    if (connectionState === 'disconnected' || connectionState === 'connecting') {
      return renderConnectionScreen();
    }

    if (connectionState === 'connected') {
      return renderRoomSelectScreen();
    }

    if (connectionState === 'in_coop_lobby' || connectionState === 'coop_ready') {
      return renderLobbyScreen();
    }

    if (connectionState === 'coop_countdown') {
      return renderCountdownScreen();
    }

    return null;
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
        <h1 className="font-game text-3xl md:text-4xl text-green-400 mb-8">
          협동 모드
        </h1>
        <p className="text-gray-400 mb-8">2~4명이 함께 웨이브를 클리어하세요</p>

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
