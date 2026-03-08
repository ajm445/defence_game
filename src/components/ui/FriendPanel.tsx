import React, { useEffect, useCallback, useState } from 'react';
import {
  useFriendStore,
  useFriends,
  useOnlinePlayers,
  usePendingRequests,
  useSentRequests,
  useFriendActiveTab,
  useIsFriendPanelOpen,
  usePendingRequestCount,
} from '../../stores/useFriendStore';
import { wsClient } from '../../services/WebSocketClient';
import { soundManager } from '../../services/SoundManager';
import { useFriendMessages } from '../../hooks/useFriendMessages';
import type { FriendInfo, OnlinePlayerInfo, FriendRequestInfo } from '@shared/types/friendNetwork';

interface FriendPanelProps {
  onInviteToRoom?: (friendId: string) => void;
  currentRoomId?: string;
}

export const FriendPanel: React.FC<FriendPanelProps> = ({ onInviteToRoom, currentRoomId }) => {
  const isOpen = useIsFriendPanelOpen();
  const setIsOpen = useFriendStore((state) => state.setFriendPanelOpen);
  const activeTab = useFriendActiveTab();
  const setActiveTab = useFriendStore((state) => state.setActiveTab);

  const friends = useFriends();
  const onlinePlayers = useOnlinePlayers();
  const pendingRequests = usePendingRequests();
  const sentRequests = useSentRequests();
  const pendingCount = usePendingRequestCount();

  const [searchQuery, setSearchQuery] = useState('');

  // 친구 시스템 실시간 메시지 처리 (FRIEND_STATUS_CHANGED 등)
  useFriendMessages();

  // 패널 열릴 때 데이터 로드
  useEffect(() => {
    if (isOpen) {
      wsClient.send({ type: 'GET_FRIENDS_LIST' });
      wsClient.send({ type: 'GET_ONLINE_PLAYERS' });
    }
  }, [isOpen]);

  // 친구 요청 보내기
  const handleSendFriendRequest = useCallback((targetUserId: string) => {
    soundManager.play('ui_click');
    wsClient.send({ type: 'SEND_FRIEND_REQUEST', targetUserId });
  }, []);

  // 친구 요청 응답
  const handleRespondRequest = useCallback((requestId: string, accept: boolean) => {
    soundManager.play('ui_click');
    wsClient.send({ type: 'RESPOND_FRIEND_REQUEST', requestId, accept });
    // 응답 후 pendingRequests에서 해당 요청 즉시 제거
    useFriendStore.getState().removePendingRequest(requestId);
  }, []);

  // 친구 요청 취소
  const handleCancelRequest = useCallback((requestId: string) => {
    soundManager.play('ui_click');
    wsClient.send({ type: 'CANCEL_FRIEND_REQUEST', requestId });
  }, []);

  // 친구 삭제
  const handleRemoveFriend = useCallback((friendId: string) => {
    soundManager.play('ui_click');
    if (confirm('정말 친구를 삭제하시겠습니까?')) {
      // 낙관적 업데이트: UI 즉시 반영
      useFriendStore.getState().removeFriend(friendId);
      wsClient.send({ type: 'REMOVE_FRIEND', friendId });
    }
  }, []);

  // 게임 초대
  const handleInviteToGame = useCallback((friendId: string) => {
    soundManager.play('ui_click');
    if (onInviteToRoom && currentRoomId) {
      wsClient.send({ type: 'SEND_GAME_INVITE', friendId, roomId: currentRoomId });
    }
  }, [onInviteToRoom, currentRoomId]);

  // 패널 토글
  const togglePanel = useCallback(() => {
    soundManager.play('ui_click');
    setIsOpen(!isOpen);
  }, [isOpen, setIsOpen]);

  // 필터링된 친구 목록
  const filteredFriends = friends.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 필터링된 온라인 플레이어 목록
  const filteredOnlinePlayers = onlinePlayers.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) {
    return (
      <button
        onClick={togglePanel}
        className="relative flex items-center gap-2 px-3 py-2 bg-gray-800/80 border border-gray-600 rounded-lg hover:border-neon-cyan transition-all cursor-pointer"
      >
        <span className="text-lg">👥</span>
        <span className="text-gray-300 text-sm">친구</span>
        {pendingCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {pendingCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed right-4 bg-gray-900/95 border border-gray-600 rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden" style={{ top: 'clamp(3rem, 8vh, 5rem)', width: 'clamp(16rem, 25vw, 20rem)', maxHeight: 'calc(100vh - clamp(4rem, 10vh, 6.5rem))' }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <h3 className="text-white font-bold">친구</h3>
        <button
          onClick={togglePanel}
          className="text-gray-400 hover:text-white transition-colors cursor-pointer"
        >
          ✕
        </button>
      </div>

      {/* 탭 */}
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => {
            soundManager.play('ui_click');
            setActiveTab('friends');
          }}
          className={`flex-1 py-2 text-sm transition-colors cursor-pointer ${
            activeTab === 'friends'
              ? 'text-neon-cyan border-b-2 border-neon-cyan'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          친구 ({friends.length})
        </button>
        <button
          onClick={() => {
            soundManager.play('ui_click');
            setActiveTab('online');
          }}
          className={`flex-1 py-2 text-sm transition-colors cursor-pointer ${
            activeTab === 'online'
              ? 'text-neon-cyan border-b-2 border-neon-cyan'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          온라인 ({onlinePlayers.length})
        </button>
        <button
          onClick={() => {
            soundManager.play('ui_click');
            setActiveTab('requests');
          }}
          className={`flex-1 py-2 text-sm transition-colors cursor-pointer relative ${
            activeTab === 'requests'
              ? 'text-neon-cyan border-b-2 border-neon-cyan'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          요청
          {pendingCount > 0 && (
            <span className="absolute top-1 right-4 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* 검색 (친구/온라인 탭에서만) */}
      {activeTab !== 'requests' && (
        <div className="px-3 py-2 border-b border-gray-700">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="검색..."
            className="w-full px-3 py-1.5 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-neon-cyan"
          />
        </div>
      )}

      {/* 컨텐츠 */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'friends' && (
          <FriendList
            friends={filteredFriends}
            onRemove={handleRemoveFriend}
            onInvite={currentRoomId ? handleInviteToGame : undefined}
            currentRoomId={currentRoomId}
          />
        )}
        {activeTab === 'online' && (
          <OnlinePlayerList
            players={filteredOnlinePlayers}
            onSendRequest={handleSendFriendRequest}
          />
        )}
        {activeTab === 'requests' && (
          <RequestList
            pendingRequests={pendingRequests}
            sentRequests={sentRequests}
            onRespond={handleRespondRequest}
            onCancel={handleCancelRequest}
          />
        )}
      </div>
    </div>
  );
};

// 친구 목록 컴포넌트
const FriendList: React.FC<{
  friends: FriendInfo[];
  onRemove: (friendId: string) => void;
  onInvite?: (friendId: string) => void;
  currentRoomId?: string;
}> = ({ friends, onRemove, onInvite, currentRoomId }) => {
  if (friends.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-500">
        <span className="text-3xl mb-2">👥</span>
        <p className="text-sm">친구가 없습니다</p>
        <p className="text-xs mt-1">온라인 탭에서 친구를 추가하세요</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-700/50">
      {friends.map((friend) => (
        <div
          key={friend.id}
          className="flex items-center justify-between px-4 py-3 hover:bg-gray-800/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className={`w-2 h-2 rounded-full absolute -bottom-0.5 -right-0.5 ${
                  friend.isOnline ? 'bg-green-400' : 'bg-gray-500'
                }`}
              />
              <span className="text-xl">👤</span>
            </div>
            <div>
              <p className="text-white text-sm font-medium">{friend.name}</p>
              <p className="text-gray-500 text-xs">
                Lv.{friend.playerLevel}
                {friend.isOnline && friend.currentRoom && (
                  <span className="ml-2 text-yellow-400">게임 중</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            {/* 같은 방에 있는 사람에게는 초대 버튼 표시 안 함 */}
            {onInvite && friend.isOnline && friend.currentRoom !== currentRoomId && (
              <button
                onClick={() => onInvite(friend.id)}
                className="p-1.5 text-green-400 hover:bg-green-500/20 rounded transition-colors cursor-pointer"
                title="게임 초대"
              >
                📩
              </button>
            )}
            <button
              onClick={() => onRemove(friend.id)}
              className="p-1.5 text-red-400 hover:bg-red-500/20 rounded transition-colors cursor-pointer"
              title="친구 삭제"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

// 온라인 플레이어 목록 컴포넌트
const OnlinePlayerList: React.FC<{
  players: OnlinePlayerInfo[];
  onSendRequest: (targetUserId: string) => void;
}> = ({ players, onSendRequest }) => {
  if (players.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-500">
        <span className="text-3xl mb-2">🌐</span>
        <p className="text-sm">온라인 플레이어가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-700/50">
      {players.map((player) => (
        <div
          key={player.id}
          className={`flex items-center justify-between px-4 py-3 transition-colors ${
            player.isMe ? 'bg-neon-cyan/10' : 'hover:bg-gray-800/50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="text-xl">👤</span>
              <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ${
                player.isMe ? 'bg-neon-cyan' : 'bg-green-400'
              }`} />
            </div>
            <div>
              <p className={`text-sm font-medium ${player.isMe ? 'text-neon-cyan' : 'text-white'}`}>
                {player.name}
                {player.isMe && (
                  <span className="ml-2 text-neon-cyan/70 text-xs">(나)</span>
                )}
                {player.isFriend && !player.isMe && (
                  <span className="ml-2 text-neon-cyan text-xs">친구</span>
                )}
              </p>
              <p className="text-gray-500 text-xs">
                Lv.{player.playerLevel}
                {player.currentRoom && (
                  <span className="ml-2 text-yellow-400">게임 중</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            {/* 온라인 탭에서는 초대 불가 - 친구 탭에서만 초대 가능 */}
            {!player.isMe && !player.isFriend && (
              <button
                onClick={() => onSendRequest(player.id)}
                className="px-2 py-1 text-xs text-neon-cyan border border-neon-cyan/50 rounded hover:bg-neon-cyan/20 transition-colors cursor-pointer"
              >
                친구 추가
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// 요청 목록 컴포넌트
const RequestList: React.FC<{
  pendingRequests: FriendRequestInfo[];
  sentRequests: FriendRequestInfo[];
  onRespond: (requestId: string, accept: boolean) => void;
  onCancel: (requestId: string) => void;
}> = ({ pendingRequests, sentRequests, onRespond, onCancel }) => {
  if (pendingRequests.length === 0 && sentRequests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-500">
        <span className="text-3xl mb-2">📬</span>
        <p className="text-sm">친구 요청이 없습니다</p>
      </div>
    );
  }

  return (
    <div>
      {/* 받은 요청 */}
      {pendingRequests.length > 0 && (
        <div>
          <div className="px-4 py-2 bg-gray-800/50 text-gray-400 text-xs font-medium">
            받은 요청 ({pendingRequests.length})
          </div>
          <div className="divide-y divide-gray-700/50">
            {pendingRequests.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">👤</span>
                  <div>
                    <p className="text-white text-sm font-medium">
                      {request.fromUserName}
                    </p>
                    <p className="text-gray-500 text-xs">
                      Lv.{request.fromUserLevel}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => onRespond(request.id, true)}
                    className="px-2 py-1 text-xs text-green-400 border border-green-400/50 rounded hover:bg-green-500/20 transition-colors cursor-pointer"
                  >
                    수락
                  </button>
                  <button
                    onClick={() => onRespond(request.id, false)}
                    className="px-2 py-1 text-xs text-red-400 border border-red-400/50 rounded hover:bg-red-500/20 transition-colors cursor-pointer"
                  >
                    거절
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 보낸 요청 */}
      {sentRequests.length > 0 && (
        <div>
          <div className="px-4 py-2 bg-gray-800/50 text-gray-400 text-xs font-medium">
            보낸 요청 ({sentRequests.length})
          </div>
          <div className="divide-y divide-gray-700/50">
            {sentRequests.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">👤</span>
                  <div>
                    <p className="text-white text-sm font-medium">
                      {request.toUserName}
                    </p>
                    <p className="text-gray-500 text-xs">대기 중</p>
                  </div>
                </div>
                <button
                  onClick={() => onCancel(request.id)}
                  className="px-2 py-1 text-xs text-gray-400 border border-gray-500/50 rounded hover:bg-gray-500/20 transition-colors cursor-pointer"
                >
                  취소
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
