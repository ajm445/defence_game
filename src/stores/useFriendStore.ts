import { create } from 'zustand';
import type {
  FriendInfo,
  OnlinePlayerInfo,
  FriendRequestInfo,
  GameInviteInfo,
  ServerStatusInfo,
  DirectMessage,
} from '@shared/types/friendNetwork';

interface FriendState {
  // 친구 목록
  friends: FriendInfo[];
  // 온라인 플레이어 목록
  onlinePlayers: OnlinePlayerInfo[];
  // 받은 친구 요청
  pendingRequests: FriendRequestInfo[];
  // 보낸 친구 요청
  sentRequests: FriendRequestInfo[];
  // 받은 게임 초대
  receivedInvites: GameInviteInfo[];
  // 서버 상태
  serverStatus: ServerStatusInfo | null;
  // DM 상태
  dmConversations: Map<string, DirectMessage[]>;
  activeDMFriendId: string | null;
  dmUnreadCounts: Map<string, number>;
  // UI 상태
  isFriendPanelOpen: boolean;
  activeTab: 'friends' | 'online' | 'requests';
  // 로딩 상태
  isLoading: boolean;
  // 에러 메시지
  error: string | null;

  // 액션
  setFriends: (friends: FriendInfo[]) => void;
  setOnlinePlayers: (players: OnlinePlayerInfo[]) => void;
  setPendingRequests: (requests: FriendRequestInfo[]) => void;
  setSentRequests: (requests: FriendRequestInfo[]) => void;
  setReceivedInvites: (invites: GameInviteInfo[]) => void;
  setServerStatus: (status: ServerStatusInfo) => void;
  setFriendPanelOpen: (isOpen: boolean) => void;
  setActiveTab: (tab: 'friends' | 'online' | 'requests') => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;

  // 친구 상태 업데이트
  updateFriendStatus: (friendId: string, isOnline: boolean, currentRoom?: string, gameMode?: 'rts' | 'rpg' | null) => void;
  // 친구 추가
  addFriend: (friend: FriendInfo) => void;
  // 친구 삭제
  removeFriend: (friendId: string) => void;
  // 친구 요청 추가
  addPendingRequest: (request: FriendRequestInfo) => void;
  // 친구 요청 제거
  removePendingRequest: (requestId: string) => void;
  // 보낸 요청 제거
  removeSentRequest: (requestId: string) => void;
  // 게임 초대 추가
  addGameInvite: (invite: GameInviteInfo) => void;
  // 게임 초대 제거
  removeGameInvite: (inviteId: string) => void;

  // 온라인 플레이어 실시간 업데이트
  addOnlinePlayer: (player: OnlinePlayerInfo) => void;
  removeOnlinePlayer: (playerId: string) => void;
  updateOnlinePlayerMode: (playerId: string, gameMode: 'rts' | 'rpg' | null) => void;

  // DM 액션
  addDMMessage: (friendUserId: string, message: DirectMessage) => void;
  mergeDMHistory: (conversations: { friendUserId: string; messages: DirectMessage[] }[]) => void;
  openDMChat: (friendId: string) => void;
  closeDMChat: () => void;
  clearDMConversation: (friendId: string) => void;

  // 초기화
  reset: () => void;
}

const initialState = {
  friends: [],
  onlinePlayers: [],
  pendingRequests: [],
  sentRequests: [],
  receivedInvites: [],
  serverStatus: null,
  dmConversations: new Map<string, DirectMessage[]>(),
  activeDMFriendId: null as string | null,
  dmUnreadCounts: new Map<string, number>(),
  isFriendPanelOpen: false,
  activeTab: 'friends' as const,
  isLoading: false,
  error: null,
};

export const useFriendStore = create<FriendState>((set) => ({
  ...initialState,

  setFriends: (friends) => set({ friends }),
  setOnlinePlayers: (players) => set({ onlinePlayers: players }),
  setPendingRequests: (requests) => set({ pendingRequests: requests }),
  setSentRequests: (requests) => set({ sentRequests: requests }),
  setReceivedInvites: (invites) => set({ receivedInvites: invites }),
  setServerStatus: (status) => set({ serverStatus: status }),
  setFriendPanelOpen: (isOpen) => set({ isFriendPanelOpen: isOpen }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  updateFriendStatus: (friendId, isOnline, currentRoom, gameMode) =>
    set((state) => ({
      friends: state.friends.map((f) =>
        f.id === friendId ? { ...f, isOnline, currentRoom, gameMode: gameMode ?? undefined } : f
      ),
    })),

  addFriend: (friend) =>
    set((state) => {
      // 중복 방지: 이미 같은 ID의 친구가 있으면 추가하지 않음
      if (state.friends.some((f) => f.id === friend.id)) {
        return state;
      }
      return {
        friends: [friend, ...state.friends].sort((a, b) => {
          if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
          return b.playerLevel - a.playerLevel;
        }),
      };
    }),

  removeFriend: (friendId) =>
    set((state) => {
      const newConversations = new Map(state.dmConversations);
      newConversations.delete(friendId);
      const newUnread = new Map(state.dmUnreadCounts);
      newUnread.delete(friendId);
      return {
        friends: state.friends.filter((f) => f.id !== friendId),
        dmConversations: newConversations,
        dmUnreadCounts: newUnread,
        activeDMFriendId: state.activeDMFriendId === friendId ? null : state.activeDMFriendId,
      };
    }),

  addPendingRequest: (request) =>
    set((state) => {
      // 중복 방지: 이미 같은 ID의 요청이 있으면 추가하지 않음
      if (state.pendingRequests.some((r) => r.id === request.id)) {
        return state;
      }
      return { pendingRequests: [request, ...state.pendingRequests] };
    }),

  removePendingRequest: (requestId) =>
    set((state) => ({
      pendingRequests: state.pendingRequests.filter((r) => r.id !== requestId),
    })),

  removeSentRequest: (requestId) =>
    set((state) => ({
      sentRequests: state.sentRequests.filter((r) => r.id !== requestId),
    })),

  addGameInvite: (invite) =>
    set((state) => ({
      receivedInvites: [invite, ...state.receivedInvites],
    })),

  removeGameInvite: (inviteId) =>
    set((state) => ({
      receivedInvites: state.receivedInvites.filter((i) => i.id !== inviteId),
    })),

  addOnlinePlayer: (player) =>
    set((state) => {
      // 이미 존재하면 추가하지 않음
      if (state.onlinePlayers.some((p) => p.id === player.id)) {
        return state;
      }
      const newPlayers = [...state.onlinePlayers, player];
      // 본인 먼저, 친구 다음, 레벨 순 정렬
      newPlayers.sort((a, b) => {
        if (a.isMe && !b.isMe) return -1;
        if (!a.isMe && b.isMe) return 1;
        if (a.isFriend !== b.isFriend) return a.isFriend ? -1 : 1;
        return b.playerLevel - a.playerLevel;
      });
      return { onlinePlayers: newPlayers };
    }),

  removeOnlinePlayer: (playerId) =>
    set((state) => ({
      onlinePlayers: state.onlinePlayers.filter((p) => p.id !== playerId),
    })),

  updateOnlinePlayerMode: (playerId, gameMode) =>
    set((state) => ({
      onlinePlayers: state.onlinePlayers.map((p) =>
        p.id === playerId ? { ...p, gameMode } : p
      ),
    })),

  addDMMessage: (friendUserId, message) =>
    set((state) => {
      const existing = state.dmConversations.get(friendUserId) || [];
      // 중복 방지: 같은 ID 메시지가 이미 있으면 무시
      if (existing.some((m) => m.id === message.id)) {
        return state;
      }
      const newConversations = new Map(state.dmConversations);
      newConversations.set(friendUserId, [...existing, message]);

      // 창이 열려 있지 않으면 unread 증가
      const newUnread = new Map(state.dmUnreadCounts);
      if (state.activeDMFriendId !== friendUserId) {
        newUnread.set(friendUserId, (newUnread.get(friendUserId) || 0) + 1);
      }
      return { dmConversations: newConversations, dmUnreadCounts: newUnread };
    }),

  mergeDMHistory: (conversations) =>
    set((state) => {
      const newConversations = new Map(state.dmConversations);
      const newUnread = new Map(state.dmUnreadCounts);

      for (const conv of conversations) {
        const existing = newConversations.get(conv.friendUserId) || [];
        const existingIds = new Set(existing.map(m => m.id));
        // 중복 제거 후 병합
        const newMessages = conv.messages.filter(m => !existingIds.has(m.id));
        if (newMessages.length > 0) {
          const merged = [...existing, ...newMessages].sort((a, b) => a.timestamp - b.timestamp);
          newConversations.set(conv.friendUserId, merged);
          // 새 메시지만큼 unread 증가 (활성 창이 아닌 경우)
          if (state.activeDMFriendId !== conv.friendUserId) {
            newUnread.set(conv.friendUserId, (newUnread.get(conv.friendUserId) || 0) + newMessages.length);
          }
        }
      }

      return { dmConversations: newConversations, dmUnreadCounts: newUnread };
    }),

  openDMChat: (friendId) =>
    set((state) => {
      const newUnread = new Map(state.dmUnreadCounts);
      newUnread.delete(friendId);
      return { activeDMFriendId: friendId, dmUnreadCounts: newUnread };
    }),

  closeDMChat: () => set({ activeDMFriendId: null }),

  clearDMConversation: (friendId) =>
    set((state) => {
      const newConversations = new Map(state.dmConversations);
      newConversations.delete(friendId);
      const newUnread = new Map(state.dmUnreadCounts);
      newUnread.delete(friendId);
      return {
        dmConversations: newConversations,
        dmUnreadCounts: newUnread,
        activeDMFriendId: state.activeDMFriendId === friendId ? null : state.activeDMFriendId,
      };
    }),

  reset: () => set(initialState),
}));

// 편의 훅들
export const useFriends = () => useFriendStore((state) => state.friends);
export const useOnlinePlayers = () => useFriendStore((state) => state.onlinePlayers);
export const usePendingRequests = () => useFriendStore((state) => state.pendingRequests);
export const useSentRequests = () => useFriendStore((state) => state.sentRequests);
export const useReceivedInvites = () => useFriendStore((state) => state.receivedInvites);
export const useServerStatus = () => useFriendStore((state) => state.serverStatus);
export const useIsFriendPanelOpen = () => useFriendStore((state) => state.isFriendPanelOpen);
export const useFriendActiveTab = () => useFriendStore((state) => state.activeTab);

// 친구 요청 개수 (배지용)
export const usePendingRequestCount = () => useFriendStore((state) => state.pendingRequests.length);
export const useGameInviteCount = () => useFriendStore((state) => state.receivedInvites.length);

// DM 관련
export const useActiveDMFriendId = () => useFriendStore((state) => state.activeDMFriendId);
export const useDMUnreadCounts = () => useFriendStore((state) => state.dmUnreadCounts);
export const useDMTotalUnread = () => useFriendStore((state) => {
  let total = 0;
  for (const count of state.dmUnreadCounts.values()) {
    total += count;
  }
  return total;
});
