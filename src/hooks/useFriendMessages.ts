import { useEffect } from 'react';
import { wsClient } from '../services/WebSocketClient';
import { useFriendStore } from '../stores/useFriendStore';
import { useUIStore } from '../stores/useUIStore';
import { useRPGStore } from '../stores/useRPGStore';
import { useAuthStore } from '../stores/useAuthStore';
import { joinRoomByInvite } from './useNetworkSync';
import { createDefaultStatUpgrades } from '../types/auth';
import type { FriendServerMessage } from '@shared/types/friendNetwork';
import type { HeroClass } from '../types/rpg';

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
    addOnlinePlayer,
    removeOnlinePlayer,
    updateOnlinePlayerMode,
    setError,
    addDMMessage,
    mergeDMHistory,
    clearDMConversation,
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
          updateFriendStatus(message.friendId, message.isOnline, message.currentRoom, message.gameMode);
          // 오프라인 시 DM 대화 정리
          if (!message.isOnline) {
            clearDMConversation(message.friendId);
          }
          break;

        case 'FRIEND_REMOVED':
          removeFriend(message.friendId);
          break;

        case 'FRIEND_ADDED':
          addFriend(message.friend);
          break;

        // 온라인 플레이어 실시간 업데이트
        case 'ONLINE_PLAYER_JOINED':
          addOnlinePlayer(message.player);
          break;

        case 'ONLINE_PLAYER_LEFT':
          removeOnlinePlayer(message.playerId);
          break;

        case 'PLAYER_MODE_CHANGED':
          updateOnlinePlayerMode(message.playerId, message.gameMode);
          break;

        // 게임 초대
        case 'GAME_INVITE_RECEIVED':
          addGameInvite(message.invite);
          break;

        case 'GAME_INVITE_ACCEPTED': {
          // 게임 초대 수락 후 자동 방 참가
          // 이 메시지는 초대를 수락한 본인에게만 처리해야 함
          // (호스트에게도 전송되지만 호스트는 이미 방에 있으므로 무시)
          const multiplayer = useRPGStore.getState().multiplayer;

          // 이미 같은 방에 있으면 무시 (호스트가 받은 경우)
          if (multiplayer.roomCode === message.roomCode) {
            console.log('[Friend] 이미 해당 방에 있음 - 초대 수락 알림 무시 (호스트)');
            break;
          }

          // 다른 방에 있으면 알림 표시하고 무시
          if (multiplayer.roomCode) {
            console.log('[Friend] 다른 방에 이미 참가 중 - 현재 방을 먼저 나가야 합니다');
            useUIStore.getState().showNotification('현재 방을 나간 후 다시 초대를 수락해주세요.');
            break;
          }

          // 연결 중이면 무시 (중복 핸들러 방지)
          if (multiplayer.connectionState === 'connecting') {
            console.log('[Friend] 이미 연결 중 - 초대 수락 알림 무시');
            break;
          }

          console.log('[Friend] 게임 초대 수락 - 방 참가:', message.roomCode);

          // RPG 로비 화면으로 이동
          const currentScreen = useUIStore.getState().currentScreen;
          if (currentScreen !== 'rpgCoopLobby') {
            useUIStore.getState().setScreen('rpgCoopLobby');
          }

          // 플레이어 정보 가져오기
          const classProgress = useAuthStore.getState().classProgress;
          const profile = useAuthStore.getState().profile;
          const defaultClass: HeroClass = 'archer';
          const progress = classProgress.find(p => p.className === defaultClass);
          const characterLevel = progress?.classLevel || 1;
          const statUpgrades = progress?.statUpgrades || createDefaultStatUpgrades();
          const advancedClass = progress?.advancedClass;
          const tier = progress?.tier;
          const playerName = profile?.nickname || '플레이어';

          // 직업 선택 및 방 참가
          useRPGStore.getState().selectClass(defaultClass);
          joinRoomByInvite(
            message.roomCode,
            playerName,
            defaultClass,
            characterLevel,
            statUpgrades,
            advancedClass,
            tier
          );
          break;
        }

        case 'GAME_INVITE_DECLINED':
          // 내 초대가 거절됨
          console.log(`[Friend] 게임 초대 거절됨: ${message.inviteId}`);
          break;

        case 'GAME_INVITE_EXPIRED':
          removeGameInvite(message.inviteId);
          break;

        // DM (개인 메시지)
        case 'DM_RECEIVED':
          addDMMessage(message.message.fromUserId, message.message);
          break;

        case 'DM_SENT':
          addDMMessage(message.message.toUserId, message.message);
          break;

        case 'DM_HISTORY':
          mergeDMHistory(message.conversations);
          break;

        case 'DM_ERROR':
          setError(message.message);
          setTimeout(() => setError(null), 3000);
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
    addOnlinePlayer,
    removeOnlinePlayer,
    updateOnlinePlayerMode,
    setError,
    addDMMessage,
    mergeDMHistory,
    clearDMConversation,
  ]);
}
