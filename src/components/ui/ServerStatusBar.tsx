import React, { useEffect, useState } from 'react';
import { useServerStatus } from '../../stores/useFriendStore';
import { wsClient } from '../../services/WebSocketClient';

export const ServerStatusBar: React.FC = () => {
  const serverStatus = useServerStatus();
  const [isConnected, setIsConnected] = useState(wsClient.isConnected());
  const [isConnecting, setIsConnecting] = useState(false);

  // WebSocket 연결 상태 체크 및 자동 연결
  useEffect(() => {
    const checkAndConnect = async () => {
      if (wsClient.isConnected()) {
        setIsConnected(true);
        wsClient.send({ type: 'GET_SERVER_STATUS' });
      } else {
        // 연결되어 있지 않으면 백그라운드에서 연결 시도
        setIsConnecting(true);
        try {
          await wsClient.connect();
          setIsConnected(true);
          wsClient.send({ type: 'GET_SERVER_STATUS' });
        } catch (e) {
          console.warn('ServerStatusBar: 서버 연결 실패');
          setIsConnected(false);
        }
        setIsConnecting(false);
      }
    };

    checkAndConnect();

    // 10초마다 상태 갱신
    const interval = setInterval(() => {
      if (wsClient.isConnected()) {
        setIsConnected(true);
        wsClient.send({ type: 'GET_SERVER_STATUS' });
      } else {
        setIsConnected(false);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // 연결 중
  if (isConnecting) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-800/50 rounded-lg text-gray-500 text-sm">
        <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
        <span>서버 연결 중...</span>
      </div>
    );
  }

  // 연결 실패
  if (!isConnected || !serverStatus) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-800/50 rounded-lg text-gray-500 text-sm">
        <div className="w-2 h-2 bg-gray-500 rounded-full" />
        <span>오프라인</span>
      </div>
    );
  }

  return (
    <div className="flex items-center bg-gray-800/50 border border-gray-700 rounded-lg text-sm" style={{ gap: 'clamp(0.5rem, 1.5vw, 1rem)', padding: 'clamp(0.375rem, 0.8vw, 0.5rem) clamp(0.5rem, 1.5vw, 1rem)' }}>
      {/* 온라인 플레이어 */}
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
        <span className="text-gray-400">온라인</span>
        <span className="text-white font-bold">{serverStatus.onlinePlayers}</span>
      </div>

      <div className="w-px h-4 bg-gray-600" />

      {/* 활성 게임 */}
      <div className="flex items-center gap-2">
        <span className="text-yellow-400">🎮</span>
        <span className="text-gray-400">게임 중</span>
        <span className="text-white font-bold">{serverStatus.activeGames}</span>
      </div>

      <div className="w-px h-4 bg-gray-600" />

      {/* 대기방 */}
      <div className="flex items-center gap-2">
        <span className="text-blue-400">🚪</span>
        <span className="text-gray-400">대기방</span>
        <span className="text-white font-bold">{serverStatus.waitingRooms}</span>
      </div>
    </div>
  );
};
