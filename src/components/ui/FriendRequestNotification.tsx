import React, { useCallback, useEffect, useState } from 'react';
import { usePendingRequests, useFriendStore } from '../../stores/useFriendStore';
import { wsClient } from '../../services/WebSocketClient';
import { soundManager } from '../../services/SoundManager';
import type { FriendRequestInfo } from '@shared/types/friendNetwork';

const removePendingRequest = useFriendStore.getState().removePendingRequest;

export const FriendRequestNotification: React.FC = () => {
  const pendingRequests = usePendingRequests();
  const [visibleRequest, setVisibleRequest] = useState<FriendRequestInfo | null>(null);
  const [lastNotifiedId, setLastNotifiedId] = useState<string | null>(null);

  // 새 요청이 들어오면 알림 표시
  useEffect(() => {
    if (pendingRequests.length > 0) {
      const latestRequest = pendingRequests[0];
      if (latestRequest.id !== lastNotifiedId) {
        setVisibleRequest(latestRequest);
        setLastNotifiedId(latestRequest.id);
        soundManager.play('notification' as any);
      }
    }
  }, [pendingRequests, lastNotifiedId]);

  // 자동 숨김
  useEffect(() => {
    if (visibleRequest) {
      const timer = setTimeout(() => {
        setVisibleRequest(null);
      }, 10000); // 10초 후 자동 숨김
      return () => clearTimeout(timer);
    }
  }, [visibleRequest]);

  const handleRespond = useCallback((accept: boolean) => {
    if (!visibleRequest) return;
    soundManager.play('ui_click');
    wsClient.send({
      type: 'RESPOND_FRIEND_REQUEST',
      requestId: visibleRequest.id,
      accept,
    });
    // 응답 후 pendingRequests에서 해당 요청 제거
    removePendingRequest(visibleRequest.id);
    setVisibleRequest(null);
  }, [visibleRequest]);

  const handleDismiss = useCallback(() => {
    soundManager.play('ui_click');
    setVisibleRequest(null);
  }, []);

  if (!visibleRequest) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-slide-down">
      <div className="flex items-center gap-4 px-6 py-4 bg-gray-900/95 border border-neon-cyan/50 rounded-xl shadow-2xl backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span className="text-2xl">👤</span>
          <div>
            <p className="text-neon-cyan text-sm font-medium">친구 요청</p>
            <p className="text-white">
              <span className="font-bold">{visibleRequest.fromUserName}</span>
              <span className="text-gray-400 text-sm ml-2">
                Lv.{visibleRequest.fromUserLevel}
              </span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleRespond(true)}
            className="px-3 py-1.5 text-sm text-green-400 border border-green-400 rounded-lg hover:bg-green-500/20 transition-colors cursor-pointer"
          >
            수락
          </button>
          <button
            onClick={() => handleRespond(false)}
            className="px-3 py-1.5 text-sm text-red-400 border border-red-400 rounded-lg hover:bg-red-500/20 transition-colors cursor-pointer"
          >
            거절
          </button>
          <button
            onClick={handleDismiss}
            className="px-2 py-1.5 text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};
