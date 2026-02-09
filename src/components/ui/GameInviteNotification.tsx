import React, { useCallback, useEffect, useState } from 'react';
import { useReceivedInvites, useFriendStore } from '../../stores/useFriendStore';
import { useRPGStore } from '../../stores/useRPGStore';
import { useUIStore } from '../../stores/useUIStore';
import { wsClient } from '../../services/WebSocketClient';
import { soundManager } from '../../services/SoundManager';
import type { GameInviteInfo } from '@shared/types/friendNetwork';

interface GameInviteNotificationProps {
  onJoinRoom?: (roomCode: string) => void;
}

export const GameInviteNotification: React.FC<GameInviteNotificationProps> = ({ onJoinRoom: _onJoinRoom }) => {
  const receivedInvites = useReceivedInvites();
  const removeGameInvite = useFriendStore((state) => state.removeGameInvite);
  const [visibleInvite, setVisibleInvite] = useState<GameInviteInfo | null>(null);
  const [lastNotifiedId, setLastNotifiedId] = useState<string | null>(null);

  // 새 초대가 들어오면 알림 표시
  useEffect(() => {
    if (receivedInvites.length > 0) {
      const latestInvite = receivedInvites[0];
      if (latestInvite.id !== lastNotifiedId) {
        setVisibleInvite(latestInvite);
        setLastNotifiedId(latestInvite.id);
        soundManager.play('notification' as any);
      }
    }
  }, [receivedInvites, lastNotifiedId]);

  // 자동 숨김 (초대 만료 시간 기반)
  useEffect(() => {
    if (visibleInvite) {
      const expiresAt = new Date(visibleInvite.expiresAt).getTime();
      const now = Date.now();
      const timeUntilExpiry = Math.max(0, expiresAt - now);

      const timer = setTimeout(() => {
        setVisibleInvite(null);
        removeGameInvite(visibleInvite.id);
      }, Math.min(timeUntilExpiry, 30000)); // 최대 30초 후 자동 숨김

      return () => clearTimeout(timer);
    }
  }, [visibleInvite, removeGameInvite]);

  const handleRespond = useCallback((accept: boolean) => {
    if (!visibleInvite) return;
    soundManager.play('ui_click');

    // 수락 시 현재 방 상태 확인
    if (accept) {
      const multiplayer = useRPGStore.getState().multiplayer;

      // 초대한 방과 같은 방에 있으면 (호스트가 자신의 방 초대를 받은 경우)
      if (multiplayer.roomCode === visibleInvite.roomCode) {
        useUIStore.getState().showNotification('이미 해당 방에 있습니다.');
        removeGameInvite(visibleInvite.id);
        setVisibleInvite(null);
        return;
      }

      // 다른 방에 있으면 경고
      if (multiplayer.roomCode) {
        useUIStore.getState().showNotification('현재 방을 나간 후 다시 초대를 수락해주세요.');
        removeGameInvite(visibleInvite.id);
        setVisibleInvite(null);
        return;
      }
    }

    wsClient.send({
      type: 'RESPOND_GAME_INVITE',
      inviteId: visibleInvite.id,
      accept,
    });
    removeGameInvite(visibleInvite.id);
    setVisibleInvite(null);

    // 수락 시 방 입장은 서버에서 GAME_INVITE_ACCEPTED 메시지로 처리
  }, [visibleInvite, removeGameInvite]);

  const handleDismiss = useCallback(() => {
    soundManager.play('ui_click');
    if (visibleInvite) {
      removeGameInvite(visibleInvite.id);
    }
    setVisibleInvite(null);
  }, [visibleInvite, removeGameInvite]);

  if (!visibleInvite) return null;

  // 남은 시간 계산
  const expiresAt = new Date(visibleInvite.expiresAt).getTime();
  const now = Date.now();
  const remainingSeconds = Math.max(0, Math.floor((expiresAt - now) / 1000));
  const remainingMinutes = Math.floor(remainingSeconds / 60);
  const remainingSecondsInMinute = remainingSeconds % 60;

  return (
    <div className="fixed z-50 animate-slide-down" style={{ top: 'clamp(0.5rem, 2vh, 1rem)', right: 'clamp(4rem, 18vw, 17.5rem)' }}>
      <div className="flex items-center bg-gray-900/95 border border-green-500/50 rounded-xl shadow-2xl backdrop-blur-sm" style={{ gap: 'clamp(0.5rem, 1.5vw, 1rem)', padding: 'clamp(0.5rem, 1.5vw, 1rem) clamp(0.75rem, 2vw, 1.5rem)' }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎮</span>
          <div>
            <p className="text-green-400 text-sm font-medium">게임 초대</p>
            <p className="text-white">
              <span className="font-bold">{visibleInvite.fromUserName}</span>
              <span className="text-gray-400 text-sm ml-2">
                님이 초대했습니다
              </span>
            </p>
            {visibleInvite.isPrivate && (
              <p className="text-yellow-400 text-xs mt-1">
                🔒 비밀방 (초대로만 입장 가능)
              </p>
            )}
            <p className="text-gray-500 text-xs mt-1">
              남은 시간: {remainingMinutes}:{remainingSecondsInMinute.toString().padStart(2, '0')}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleRespond(true)}
            className="px-3 py-1.5 text-sm text-green-400 border border-green-400 rounded-lg hover:bg-green-500/20 transition-colors cursor-pointer"
          >
            참가
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
