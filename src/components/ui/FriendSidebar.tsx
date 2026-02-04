import React, { useEffect, useCallback, useState } from 'react';
import {
  useFriendStore,
  useFriends,
  useOnlinePlayers,
  usePendingRequests,
  useSentRequests,
  usePendingRequestCount,
} from '../../stores/useFriendStore';
import { wsClient } from '../../services/WebSocketClient';
import { soundManager } from '../../services/SoundManager';
import { useFriendMessages } from '../../hooks/useFriendMessages';
import type { FriendInfo, OnlinePlayerInfo, FriendRequestInfo } from '@shared/types/friendNetwork';

interface FriendSidebarProps {
  currentRoomId?: string;
}

type TabType = 'online' | 'friends' | 'requests';

const TAB_TITLES: Record<TabType, string> = {
  online: '온라인',
  friends: '친구',
  requests: '요청',
};

export const FriendSidebar: React.FC<FriendSidebarProps> = ({ currentRoomId }) => {
  const [activeTab, setActiveTab] = useState<TabType>('online');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const friends = useFriends();
  const onlinePlayers = useOnlinePlayers();
  const pendingRequests = usePendingRequests();
  const sentRequests = useSentRequests();
  const pendingCount = usePendingRequestCount();

  // 친구 시스템 실시간 메시지 처리 (FRIEND_STATUS_CHANGED 등)
  useFriendMessages();

  // 컴포넌트 마운트 시 데이터 로드 및 주기적 갱신
  useEffect(() => {
    const requestFriendsData = () => {
      if (wsClient.isConnected()) {
        wsClient.send({ type: 'GET_FRIENDS_LIST' });
        wsClient.send({ type: 'GET_ONLINE_PLAYERS' });
        return true;
      }
      return false;
    };

    // 즉시 시도
    if (!requestFriendsData()) {
      // 연결이 안 되어 있으면 연결될 때까지 재시도
      const retryInterval = setInterval(() => {
        if (requestFriendsData()) {
          clearInterval(retryInterval);
        }
      }, 500);

      // 10초 후 재시도 중단
      const timeout = setTimeout(() => {
        clearInterval(retryInterval);
      }, 10000);

      return () => {
        clearInterval(retryInterval);
        clearTimeout(timeout);
      };
    }

    // 5초마다 주기적으로 갱신 (온라인 상태 동기화 안전망)
    const refreshInterval = setInterval(() => {
      requestFriendsData();
    }, 5000);

    return () => {
      clearInterval(refreshInterval);
    };
  }, []);

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
    if (currentRoomId) {
      wsClient.send({ type: 'SEND_GAME_INVITE', friendId, roomId: currentRoomId });
    }
  }, [currentRoomId]);

  // 탭 변경
  const handleTabChange = useCallback((tab: TabType) => {
    soundManager.play('ui_click');
    setActiveTab(tab);
  }, []);

  // 사이드바 접기/펼치기
  const toggleCollapse = useCallback(() => {
    soundManager.play('ui_click');
    setIsCollapsed((prev) => !prev);
  }, []);

  // 필터링된 친구 목록
  const filteredFriends = friends.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 필터링된 온라인 플레이어 목록
  const filteredOnlinePlayers = onlinePlayers.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 접혀있을 때의 UI
  if (isCollapsed) {
    return (
      <div className="relative h-full flex flex-col items-center py-4 px-2 bg-gray-900/80 border-l border-gray-700">
        {/* 왼쪽 중앙 펼치기 버튼 */}
        <button
          onClick={toggleCollapse}
          className="absolute -left-6 top-1/2 -translate-y-1/2 z-10 w-6 h-14 bg-gray-800 border border-gray-600 border-r-0 rounded-l-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-colors cursor-pointer"
          title="친구 패널 열기"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex flex-col items-center gap-3 mt-4">
          <div className="relative">
            <span className="text-lg">👥</span>
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </div>
          <div className="writing-mode-vertical text-gray-400 text-xs">
            {TAB_TITLES[activeTab]}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-64 h-full bg-gray-900/80 border-l border-gray-700 flex flex-col">
      {/* 왼쪽 중앙 접기 버튼 */}
      <button
        onClick={toggleCollapse}
        className="absolute -left-6 top-1/2 -translate-y-1/2 z-10 w-6 h-14 bg-gray-800 border border-gray-600 border-r-0 rounded-l-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-colors cursor-pointer"
        title="친구 패널 접기"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* 헤더 */}
      <div className="px-3 py-3 border-b border-gray-700">
        <h3 className="text-white font-bold text-sm flex items-center gap-2">
          <span>👥</span>
          <span>{TAB_TITLES[activeTab]}</span>
          {pendingCount > 0 && (
            <span className="w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {pendingCount}
            </span>
          )}
        </h3>
      </div>

      {/* 탭 */}
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => handleTabChange('online')}
          className={`flex-1 py-2 text-xs transition-colors cursor-pointer ${
            activeTab === 'online'
              ? 'text-green-400 border-b-2 border-green-400 bg-green-500/10'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
          }`}
        >
          온라인 ({onlinePlayers.length})
        </button>
        <button
          onClick={() => handleTabChange('friends')}
          className={`flex-1 py-2 text-xs transition-colors cursor-pointer ${
            activeTab === 'friends'
              ? 'text-neon-cyan border-b-2 border-neon-cyan bg-neon-cyan/10'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
          }`}
        >
          친구 ({friends.length})
        </button>
        <button
          onClick={() => handleTabChange('requests')}
          className={`flex-1 py-2 text-xs transition-colors cursor-pointer relative ${
            activeTab === 'requests'
              ? 'text-yellow-400 border-b-2 border-yellow-400 bg-yellow-500/10'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
          }`}
        >
          요청
          {pendingCount > 0 && (
            <span className="absolute top-1 right-2 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* 검색 (요청 탭 제외) */}
      {activeTab !== 'requests' && (
        <div className="px-3 py-2 border-b border-gray-700/50">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="검색..."
            className="w-full px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-white text-xs focus:outline-none focus:border-neon-cyan"
          />
        </div>
      )}

      {/* 컨텐츠 */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
        {activeTab === 'online' && (
          <OnlineList
            players={filteredOnlinePlayers}
            onSendRequest={handleSendFriendRequest}
            onInvite={currentRoomId ? handleInviteToGame : undefined}
            currentRoomId={currentRoomId}
          />
        )}
        {activeTab === 'friends' && (
          <FriendsList
            friends={filteredFriends}
            onRemove={handleRemoveFriend}
            onInvite={currentRoomId ? handleInviteToGame : undefined}
            currentRoomId={currentRoomId}
          />
        )}
        {activeTab === 'requests' && (
          <RequestsList
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

// 온라인 플레이어 목록
const OnlineList: React.FC<{
  players: OnlinePlayerInfo[];
  onSendRequest: (targetUserId: string) => void;
  onInvite?: (friendId: string) => void;
  currentRoomId?: string;
}> = ({ players, onSendRequest, onInvite, currentRoomId }) => {
  if (players.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-500">
        <span className="text-2xl mb-2">🌐</span>
        <p className="text-xs">온라인 플레이어가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-700/30">
      {players.map((player) => (
        <div
          key={player.id}
          className={`flex items-center justify-between px-3 py-2 transition-colors ${
            player.isMe ? 'bg-neon-cyan/10' : 'hover:bg-gray-800/50'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="relative flex-shrink-0">
              <span className="text-base">👤</span>
              <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ${
                player.isMe ? 'bg-neon-cyan' : 'bg-green-400'
              }`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-xs font-medium truncate ${player.isMe ? 'text-neon-cyan' : 'text-white'}`}>
                {player.name}
                {player.isMe && (
                  <span className="ml-1 text-neon-cyan/70">(나)</span>
                )}
                {player.isFriend && !player.isMe && (
                  <span className="ml-1 text-neon-cyan">★</span>
                )}
              </p>
              <p className="text-gray-500 text-xs">
                Lv.{player.playerLevel}
                {player.currentRoom ? (
                  <span className="ml-1 text-yellow-400">게임중</span>
                ) : player.gameMode && (
                  <span className={`ml-1 ${player.gameMode === 'rts' ? 'text-neon-cyan' : 'text-neon-purple'}`}>
                    {player.gameMode === 'rts' ? 'RTS' : 'RPG'}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            {/* 본인 또는 같은 방에 있는 사람에게는 초대 버튼 표시 안 함 */}
            {!player.isMe && onInvite && player.isFriend && player.currentRoom !== currentRoomId && (
              <button
                onClick={() => onInvite(player.id)}
                className="p-1 text-green-400 hover:bg-green-500/20 rounded transition-colors cursor-pointer"
                title="게임 초대"
              >
                📩
              </button>
            )}
            {!player.isMe && !player.isFriend && (
              <button
                onClick={() => onSendRequest(player.id)}
                className="px-1.5 py-0.5 text-xs text-neon-cyan border border-neon-cyan/50 rounded hover:bg-neon-cyan/20 transition-colors cursor-pointer"
              >
                +친구
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// 친구 목록
const FriendsList: React.FC<{
  friends: FriendInfo[];
  onRemove: (friendId: string) => void;
  onInvite?: (friendId: string) => void;
  currentRoomId?: string;
}> = ({ friends, onRemove, onInvite, currentRoomId }) => {
  // 온라인 친구를 먼저 정렬
  const sortedFriends = [...friends].sort((a, b) => {
    if (a.isOnline && !b.isOnline) return -1;
    if (!a.isOnline && b.isOnline) return 1;
    return 0;
  });

  if (friends.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-500">
        <span className="text-2xl mb-2">👥</span>
        <p className="text-xs">친구가 없습니다</p>
        <p className="text-xs mt-1 text-gray-600">온라인 탭에서 추가하세요</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-700/30">
      {sortedFriends.map((friend) => (
        <div
          key={friend.id}
          className="flex items-center justify-between px-3 py-2 hover:bg-gray-800/50 transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="relative flex-shrink-0">
              <span className="text-base">👤</span>
              <div
                className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ${
                  friend.isOnline ? 'bg-green-400' : 'bg-gray-500'
                }`}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white text-xs font-medium truncate">{friend.name}</p>
              <p className="text-gray-500 text-xs">
                Lv.{friend.playerLevel}
                {friend.isOnline && friend.currentRoom && (
                  <span className="ml-1 text-yellow-400">게임중</span>
                )}
                {!friend.isOnline && (
                  <span className="ml-1 text-gray-600">오프라인</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            {/* 같은 방에 있는 사람에게는 초대 버튼 표시 안 함 */}
            {onInvite && friend.isOnline && friend.currentRoom !== currentRoomId && (
              <button
                onClick={() => onInvite(friend.id)}
                className="p-1 text-green-400 hover:bg-green-500/20 rounded transition-colors cursor-pointer"
                title="게임 초대"
              >
                📩
              </button>
            )}
            <button
              onClick={() => onRemove(friend.id)}
              className="p-1 text-red-400/60 hover:text-red-400 hover:bg-red-500/20 rounded transition-colors cursor-pointer"
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

// 요청 목록
const RequestsList: React.FC<{
  pendingRequests: FriendRequestInfo[];
  sentRequests: FriendRequestInfo[];
  onRespond: (requestId: string, accept: boolean) => void;
  onCancel: (requestId: string) => void;
}> = ({ pendingRequests, sentRequests, onRespond, onCancel }) => {
  if (pendingRequests.length === 0 && sentRequests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-500">
        <span className="text-2xl mb-2">📬</span>
        <p className="text-xs">친구 요청이 없습니다</p>
      </div>
    );
  }

  return (
    <div>
      {/* 받은 요청 */}
      {pendingRequests.length > 0 && (
        <div>
          <div className="px-3 py-1.5 bg-gray-800/50 text-gray-400 text-xs font-medium">
            받은 요청 ({pendingRequests.length})
          </div>
          <div className="divide-y divide-gray-700/30">
            {pendingRequests.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-base">👤</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-xs font-medium truncate">
                      {request.fromUserName}
                    </p>
                    <p className="text-gray-500 text-xs">
                      Lv.{request.fromUserLevel}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => onRespond(request.id, true)}
                    className="px-1.5 py-0.5 text-xs text-green-400 border border-green-400/50 rounded hover:bg-green-500/20 transition-colors cursor-pointer"
                  >
                    수락
                  </button>
                  <button
                    onClick={() => onRespond(request.id, false)}
                    className="px-1.5 py-0.5 text-xs text-red-400 border border-red-400/50 rounded hover:bg-red-500/20 transition-colors cursor-pointer"
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
          <div className="px-3 py-1.5 bg-gray-800/50 text-gray-400 text-xs font-medium">
            보낸 요청 ({sentRequests.length})
          </div>
          <div className="divide-y divide-gray-700/30">
            {sentRequests.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-base">👤</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-xs font-medium truncate">
                      {request.toUserName}
                    </p>
                    <p className="text-gray-500 text-xs">대기 중</p>
                  </div>
                </div>
                <button
                  onClick={() => onCancel(request.id)}
                  className="px-1.5 py-0.5 text-xs text-gray-400 border border-gray-500/50 rounded hover:bg-gray-500/20 transition-colors cursor-pointer"
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
