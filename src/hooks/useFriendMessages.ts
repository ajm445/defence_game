import { useEffect } from 'react';
import { wsClient } from '../services/WebSocketClient';
import { useFriendStore } from '../stores/useFriendStore';
import type { FriendServerMessage } from '@shared/types/friendNetwork';

/**
 * 친구 시스템 WebSocket 메시지 처리 훅
 * 로비 화면에서 사용하여 친구 관련 메시지를 처리합니다.
 */
export function useFriendMessages() {
  const {
    setFriends,
    setOnlinePlayers,
    setPendingRequests,
    setSentRequests,
    setServerStatus,
    updateFriendStatus,
    addFriend,
    removeFriend,
    addPendingRequest,
    removePendingRequest,
    removeSentRequest,
    addGameInvite,
    removeGameInvite,
    setError,
  } = useFriendStore();

  useEffect(() => {
    const handleMessage = (message: any) => {
      // 친구 시스템 메시지 처리
      switch (message.type as FriendServerMessage['type']) {
        // 친구 목록
        case 'FRIENDS_LIST':
          setFriends(message.friends);
          break;

        case 'ONLINE_PLAYERS_LIST':
          setOnlinePlayers(message.players);
          break;

        // 친구 요청
        case 'FRIEND_REQUEST_RECEIVED':
          addPendingRequest(message.request);
          break;

        case 'FRIEND_REQUEST_RESPONDED':
          // 내가 보낸 요청에 대한 응답
          removeSentRequest(message.requestId);
          if (message.accepted && message.friendInfo) {
            addFriend(message.friendInfo);
          }
          break;

        case 'FRIEND_REQUEST_CANCELLED':
          // 상대방이 요청을 취소함
          removePendingRequest(message.requestId);
          break;

        case 'PENDING_FRIEND_REQUESTS':
          setPendingRequests(message.requests);
          break;

        case 'SENT_FRIEND_REQUESTS':
          setSentRequests(message.requests);
          break;

        // 친구 상태 변경
        case 'FRIEND_STATUS_CHANGED':
          updateFriendStatus(message.friendId, message.isOnline, message.currentRoom);
          break;

        case 'FRIEND_REMOVED':
          removeFriend(message.friendId);
          break;

        case 'FRIEND_ADDED':
          addFriend(message.friend);
          break;

        // 게임 초대
        case 'GAME_INVITE_RECEIVED':
          addGameInvite(message.invite);
          break;

        case 'GAME_INVITE_ACCEPTED':
          // 내 초대가 수락됨 (알림 표시 등)
          console.log(`[Friend] 게임 초대 수락됨: ${message.roomCode}`);
          break;

        case 'GAME_INVITE_DECLINED':
          // 내 초대가 거절됨
          console.log(`[Friend] 게임 초대 거절됨: ${message.inviteId}`);
          break;

        case 'GAME_INVITE_EXPIRED':
          removeGameInvite(message.inviteId);
          break;

        // 서버 상태
        case 'SERVER_STATUS':
          setServerStatus(message.status);
          break;

        // 에러
        case 'FRIEND_ERROR':
          setError(message.message);
          // 3초 후 에러 메시지 클리어
          setTimeout(() => setError(null), 3000);
          break;
      }
    };

    const unsubscribe = wsClient.addMessageHandler(handleMessage);
    return () => unsubscribe();
  }, [
    setFriends,
    setOnlinePlayers,
    setPendingRequests,
    setSentRequests,
    setServerStatus,
    updateFriendStatus,
    addFriend,
    removeFriend,
    addPendingRequest,
    removePendingRequest,
    removeSentRequest,
    addGameInvite,
    removeGameInvite,
    setError,
  ]);
}
