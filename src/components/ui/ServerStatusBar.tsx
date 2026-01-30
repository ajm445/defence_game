import React, { useEffect } from 'react';
import { useServerStatus, useFriendStore } from '../../stores/useFriendStore';
import { wsClient } from '../../services/WebSocketClient';

export const ServerStatusBar: React.FC = () => {
  const serverStatus = useServerStatus();

  // 주기적으로 서버 상태 갱신
  useEffect(() => {
    // 초기 로드
    if (wsClient.isConnected()) {
      wsClient.send({ type: 'GET_SERVER_STATUS' });
    }

    // 10초마다 갱신
    const interval = setInterval(() => {
      if (wsClient.isConnected()) {
        wsClient.send({ type: 'GET_SERVER_STATUS' });
      }
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  if (!serverStatus) {
    return (
      <div className="flex items-center gap-4 px-4 py-2 bg-gray-800/50 rounded-lg text-gray-500 text-sm">
        <span>서버 상태 불러오는 중...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-sm">
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
