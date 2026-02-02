import React, { useEffect, useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { useMultiplayerStore } from '../../stores/useMultiplayerStore';
import { useGameStore } from '../../stores/useGameStore';
import { useAuthProfile } from '../../stores/useAuthStore';
import { soundManager } from '../../services/SoundManager';
import { ProfileButton } from '../ui/ProfileButton';
import { FriendSidebar } from '../ui/FriendSidebar';

export const LobbyScreen: React.FC = () => {
  const setScreen = useUIStore((state) => state.setScreen);
  const resetGameUI = useUIStore((state) => state.resetGameUI);
  const {
    connectionState,
    roomInfo,
    matchInfo,
    countdown,
    error,
    playerName,
    connect,
    disconnect,
    createRoom,
    joinRoom,
    leaveRoom,
    setPlayerName,
    reset,
  } = useMultiplayerStore();

  const initGame = useGameStore((state) => state.initGame);
  const startGame = useGameStore((state) => state.startGame);
  const setCameraPosition = useGameStore((state) => state.setCameraPosition);
  const mySide = useMultiplayerStore((state) => state.mySide);
  const profile = useAuthProfile();
  // 로그인한 사용자의 닉네임을 기본값으로 사용
  const [inputName, setInputName] = useState(profile?.nickname || playerName || '');
  const [isConnecting, setIsConnecting] = useState(false);
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [roomCode, setRoomCode] = useState('');

  // 매칭 성공 후 게임 시작
  useEffect(() => {
    if (connectionState === 'in_game') {
      resetGameUI(); // UI 상태 초기화
      initGame('multiplayer');
      startGame(); // 게임 루프 시작 (이펙트 업데이트를 위해 필요)

      // 진영에 따라 카메라 초기 위치 설정
      // 왼쪽 진영: 왼쪽에서 시작 (x=0)
      // 오른쪽 진영: 오른쪽에서 시작 (x=맵 너비 - 화면 너비)
      if (mySide === 'right') {
        // 오른쪽 진영: 맵 오른쪽에서 시작
        setCameraPosition(3000 - window.innerWidth, 1000 - window.innerHeight / 2);
      } else {
        // 왼쪽 진영: 기본 위치 (왼쪽에서 시작)
        setCameraPosition(0, 1000 - window.innerHeight / 2);
      }

      setScreen('game');
    }
  }, [connectionState, initGame, startGame, setScreen, mySide, setCameraPosition, resetGameUI]);

  // 로그인 프로필이 있으면 닉네임 설정
  useEffect(() => {
    if (profile?.nickname && !inputName) {
      setInputName(profile.nickname);
    }
  }, [profile]);

  // 에러 발생 시 3초 후 자동 클리어
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        useMultiplayerStore.setState({ error: null });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleConnect = async () => {
    if (!inputName.trim()) {
      return;
    }

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
    if (roomCode.trim().length !== 6) {
      useMultiplayerStore.setState({ error: '6자리 초대 코드를 입력하세요.' });
      return;
    }
    setPlayerName(inputName.trim());
    joinRoom(roomCode.trim().toUpperCase());
  };

  const handleBack = () => {
    soundManager.play('ui_click');
    if (connectionState === 'in_room_waiting' || connectionState === 'in_room_ready') {
      leaveRoom();
    } else if (connectionState !== 'disconnected') {
      disconnect();
    }
    reset();
    setShowJoinInput(false);
    setRoomCode('');
    setScreen('modeSelect');
  };

  const handleLeaveRoom = () => {
    soundManager.play('ui_click');
    leaveRoom();
    setShowJoinInput(false);
    setRoomCode('');
  };

  const copyRoomCode = async () => {
    soundManager.play('ui_click');
    if (roomInfo?.roomCode) {
      try {
        await navigator.clipboard.writeText(roomInfo.roomCode);
        // 복사 성공 피드백 (간단히 alert 대신 상태로 처리 가능)
      } catch (e) {
        console.error('클립보드 복사 실패:', e);
      }
    }
  };

  const renderContent = () => {
    // 연결 안됨 - 이름 입력 및 연결
    if (connectionState === 'disconnected' || connectionState === 'connecting') {
      return (
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

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button
            onClick={handleConnect}
            disabled={!inputName.trim() || isConnecting}
            className="px-8 py-3 rounded-lg bg-neon-cyan/20 border border-neon-cyan text-neon-cyan hover:bg-neon-cyan/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            style={{ paddingLeft: '10px', paddingRight: '10px', paddingTop: '5px', paddingBottom: '5px' }}
          >
            {isConnecting ? '연결 중...' : '서버 연결'}
          </button>
        </div>
      );
    }

    // 연결됨 - 방 생성 / 방 참가 선택
    if (connectionState === 'connected') {
      if (showJoinInput) {
        // 방 참가 - 코드 입력
        return (
          <div className="flex flex-col items-center gap-6">
            <p className="text-gray-400 mb-2">초대 코드를 입력하세요</p>

            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="6자리 코드"
              maxLength={6}
              className="w-48 px-4 py-4 bg-gray-800/50 border border-neon-purple rounded-lg text-white text-center text-2xl tracking-[0.3em] font-mono focus:border-neon-purple focus:outline-none uppercase"
              onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
              autoFocus
            />

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            <div className="flex gap-4">
              <button
                onClick={() => {
                  soundManager.play('ui_click');
                  setShowJoinInput(false);
                  setRoomCode('');
                  useMultiplayerStore.setState({ error: null });
                }}
                className="px-6 py-3 rounded-lg border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white transition-all cursor-pointer"
                style={{ paddingLeft: '10px', paddingRight: '10px', paddingTop: '5px', paddingBottom: '5px' }}
              >
                취소
              </button>
              <button
                onClick={handleJoinRoom}
                disabled={roomCode.length !== 6}
                className="px-6 py-3 rounded-lg bg-neon-purple/20 border border-neon-purple text-neon-purple hover:bg-neon-purple/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                style={{ paddingLeft: '10px', paddingRight: '10px', paddingTop: '5px', paddingBottom: '5px' }}
              >
                참가
              </button>
            </div>
          </div>
        );
      }

      // 방 생성 / 참가 선택
      return (
        <div className="flex flex-col items-center gap-6">
          <p className="text-green-400 mb-2">서버 연결됨</p>
          <p className="text-gray-400 mb-4">
            플레이어: <span className="text-white font-bold">{inputName}</span>
          </p>

          {error && (
            <p className="text-red-400 text-sm mb-2">{error}</p>
          )}

          <div className="flex gap-4">
            <button
              onClick={handleCreateRoom}
              className="px-8 py-4 rounded-lg bg-neon-cyan/20 border border-neon-cyan text-neon-cyan hover:bg-neon-cyan/30 transition-all text-lg cursor-pointer"
              style={{ paddingLeft: '10px', paddingRight: '10px', paddingTop: '5px', paddingBottom: '5px' }}
            >
              방 생성
            </button>

            <button
              onClick={() => {
                soundManager.play('ui_click');
                setShowJoinInput(true);
              }}
              className="px-8 py-4 rounded-lg bg-neon-purple/20 border border-neon-purple text-neon-purple hover:bg-neon-purple/30 transition-all text-lg cursor-pointer"
              style={{ paddingLeft: '10px', paddingRight: '10px', paddingTop: '5px', paddingBottom: '5px' }}
            >
              방 참가
            </button>
          </div>
        </div>
      );
    }

    // 방에서 대기 중 (방장)
    if (connectionState === 'in_room_waiting') {
      return (
        <div className="flex flex-col items-center gap-6">
          <p className="text-neon-cyan text-lg">초대 코드</p>

          <div
            className="px-8 py-4 bg-gray-800/50 border-2 border-neon-cyan rounded-lg cursor-pointer hover:bg-gray-800/70 transition-all"
            onClick={copyRoomCode}
            title="클릭하여 복사"
          >
            <p className="text-4xl font-bold tracking-[0.4em] text-white font-mono">
              {roomInfo?.roomCode}
            </p>
          </div>

          <p className="text-gray-400 text-sm">이 코드를 상대방에게 공유하세요</p>
          <p className="text-gray-500 text-xs">(클릭하면 복사됩니다)</p>

          <div className="flex items-center gap-2 mt-4">
            <div className="w-4 h-4 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400">상대방을 기다리는 중...</p>
          </div>

          <button
            onClick={handleLeaveRoom}
            className="mt-4 px-6 py-2 rounded-lg border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white transition-all cursor-pointer"
            style={{ paddingLeft: '10px', paddingRight: '10px', paddingTop: '3px', paddingBottom: '3px' }}
          >
            나가기
          </button>
        </div>
      );
    }

    // 방에 2명 있음 (카운트다운 전)
    if (connectionState === 'in_room_ready') {
      return (
        <div className="flex flex-col items-center gap-6">
          <p className="text-green-400 text-xl">상대방 참가!</p>

          <div className="flex items-center gap-8">
            <div className="text-center">
              <p className="text-gray-400 text-sm">나</p>
              <p className="text-neon-cyan text-lg font-bold">{inputName}</p>
              <p className="text-gray-500 text-xs">(왼쪽)</p>
            </div>

            <div className="text-4xl text-neon-purple">VS</div>

            <div className="text-center">
              <p className="text-gray-400 text-sm">상대</p>
              <p className="text-red-400 text-lg font-bold">{roomInfo?.opponentName}</p>
              <p className="text-gray-500 text-xs">(오른쪽)</p>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400">게임 시작 준비 중...</p>
          </div>
        </div>
      );
    }

    // 매칭됨 - 카운트다운
    if (connectionState === 'matched') {
      return (
        <div className="flex flex-col items-center gap-6">
          <p className="text-green-400 text-xl">게임 시작!</p>

          <div className="flex items-center gap-8">
            <div className="text-center">
              <p className="text-gray-400 text-sm">나</p>
              <p className="text-neon-cyan text-lg font-bold">{inputName}</p>
            </div>

            <div className="text-4xl text-neon-purple">VS</div>

            <div className="text-center">
              <p className="text-gray-400 text-sm">상대</p>
              <p className="text-red-400 text-lg font-bold">{matchInfo?.opponentName}</p>
            </div>
          </div>

          {countdown > 0 && (
            <div className="mt-4">
              <p className="text-gray-400">게임 시작까지</p>
              <p className="text-6xl font-bold text-neon-cyan animate-pulse">{countdown}</p>
            </div>
          )}

          <p className="text-gray-500 text-sm mt-4">
            진영: {matchInfo?.side === 'left' ? '왼쪽 (파랑)' : '오른쪽 (빨강)'}
          </p>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="fixed inset-0 bg-menu-gradient grid-overlay flex overflow-hidden">
      {/* 배경 효과 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-neon-purple/5 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-neon-cyan/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
      </div>

      {/* 왼쪽 상단 프로필 버튼 */}
      <div className="absolute top-8 left-8 z-20">
        <ProfileButton />
      </div>

      {/* 메인 컨텐츠 영역 */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="relative z-10 flex flex-col items-center animate-fade-in">
          {/* 타이틀 */}
          <h1 className="font-game text-3xl md:text-4xl text-neon-purple mb-12">
            1vs1 대전
          </h1>

          <div style={{ height: '30px' }} />

          {/* 연결 상태에 따른 UI */}
          <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-8 min-w-[400px] min-h-[300px] flex flex-col items-center justify-center">
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
      </div>

      {/* 오른쪽 친구 사이드바 */}
      <div className="relative z-20 h-full">
        <FriendSidebar />
      </div>

      {/* 코너 장식 */}
      <div className="absolute top-4 left-4 w-16 h-16 border-l-2 border-t-2 border-neon-purple/30" />
      <div className="absolute bottom-4 left-4 w-16 h-16 border-l-2 border-b-2 border-neon-purple/30" />
    </div>
  );
};
