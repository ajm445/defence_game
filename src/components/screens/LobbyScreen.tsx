import React, { useEffect, useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { useMultiplayerStore } from '../../stores/useMultiplayerStore';
import { useGameStore } from '../../stores/useGameStore';

export const LobbyScreen: React.FC = () => {
  const setScreen = useUIStore((state) => state.setScreen);
  const {
    connectionState,
    queuePosition,
    matchInfo,
    countdown,
    error,
    playerName,
    connect,
    disconnect,
    joinQueue,
    leaveQueue,
    setPlayerName,
    reset,
  } = useMultiplayerStore();

  const initGame = useGameStore((state) => state.initGame);
  const [inputName, setInputName] = useState(playerName || '');
  const [isConnecting, setIsConnecting] = useState(false);

  // 매칭 성공 후 게임 시작
  useEffect(() => {
    if (connectionState === 'in_game') {
      initGame('multiplayer');
      setScreen('game');
    }
  }, [connectionState, initGame, setScreen]);

  const handleConnect = async () => {
    if (!inputName.trim()) {
      return;
    }

    setIsConnecting(true);
    try {
      await connect(inputName.trim());
    } catch (e) {
      // 에러는 스토어에서 처리됨
    }
    setIsConnecting(false);
  };

  const handleJoinQueue = () => {
    setPlayerName(inputName.trim());
    joinQueue();
  };

  const handleBack = () => {
    if (connectionState === 'in_queue') {
      leaveQueue();
    } else if (connectionState !== 'disconnected') {
      disconnect();
    }
    reset();
    setScreen('modeSelect');
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
            className="px-8 py-3 rounded-lg bg-neon-cyan/20 border border-neon-cyan text-neon-cyan hover:bg-neon-cyan/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isConnecting ? '연결 중...' : '서버 연결'}
          </button>
        </div>
      );
    }

    // 연결됨 - 대기열 참가 버튼
    if (connectionState === 'connected') {
      return (
        <div className="flex flex-col items-center gap-6">
          <p className="text-green-400 mb-4">✓ 서버 연결됨</p>
          <p className="text-gray-400">
            플레이어: <span className="text-white font-bold">{inputName}</span>
          </p>

          <button
            onClick={handleJoinQueue}
            className="px-8 py-4 rounded-lg bg-neon-purple/20 border border-neon-purple text-neon-purple hover:bg-neon-purple/30 transition-all text-lg"
          >
            대전 찾기
          </button>
        </div>
      );
    }

    // 대기열에 있음
    if (connectionState === 'in_queue') {
      return (
        <div className="flex flex-col items-center gap-6">
          <div className="w-16 h-16 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin" />

          <p className="text-neon-cyan text-xl">상대를 찾는 중...</p>
          <p className="text-gray-400">
            대기열 위치: <span className="text-white font-bold">{queuePosition}</span>
          </p>

          <button
            onClick={leaveQueue}
            className="mt-4 px-6 py-2 rounded-lg border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white transition-all"
          >
            취소
          </button>
        </div>
      );
    }

    // 매칭됨 - 카운트다운
    if (connectionState === 'matched') {
      return (
        <div className="flex flex-col items-center gap-6">
          <p className="text-green-400 text-xl">매칭 성공!</p>

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
    <div className="fixed inset-0 bg-menu-gradient grid-overlay flex flex-col items-center justify-center overflow-hidden">
      {/* 배경 효과 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-neon-purple/5 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-neon-cyan/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
      </div>

      {/* 메인 컨텐츠 */}
      <div className="relative z-10 flex flex-col items-center animate-fade-in">
        {/* 타이틀 */}
        <h1 className="font-game text-3xl md:text-4xl text-neon-purple mb-12">
          1vs1 대전
        </h1>

        {/* 연결 상태에 따른 UI */}
        <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-8 min-w-[400px] min-h-[300px] flex flex-col items-center justify-center">
          {renderContent()}
        </div>

        {/* 뒤로 가기 */}
        <button
          onClick={handleBack}
          className="mt-8 px-8 py-3 rounded-lg border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white transition-all cursor-pointer"
        >
          뒤로 가기
        </button>
      </div>

      {/* 코너 장식 */}
      <div className="absolute top-4 left-4 w-16 h-16 border-l-2 border-t-2 border-neon-purple/30" />
      <div className="absolute top-4 right-4 w-16 h-16 border-r-2 border-t-2 border-neon-purple/30" />
      <div className="absolute bottom-4 left-4 w-16 h-16 border-l-2 border-b-2 border-neon-purple/30" />
      <div className="absolute bottom-4 right-4 w-16 h-16 border-r-2 border-b-2 border-neon-purple/30" />
    </div>
  );
};
