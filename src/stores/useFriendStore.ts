import { create } from 'zustand';
import type {
  FriendInfo,
  OnlinePlayerInfo,
  FriendRequestInfo,
  GameInviteInfo,
  ServerStatusInfo,
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
  updateFriendStatus: (friendId: string, isOnline: boolean, currentRoom?: string) => void;
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

  updateFriendStatus: (friendId, isOnline, currentRoom) =>
    set((state) => ({
      friends: state.friends.map((f) =>
        f.id === friendId ? { ...f, isOnline, currentRoom } : f
      ),
    })),

  addFriend: (friend) =>
    set((state) => ({
      friends: [friend, ...state.friends].sort((a, b) => {
        if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
        return b.playerLevel - a.playerLevel;
      }),
    })),

  removeFriend: (friendId) =>
    set((state) => ({
      friends: state.friends.filter((f) => f.id !== friendId),
    })),

  addPendingRequest: (request) =>
    set((state) => ({
      pendingRequests: [request, ...state.pendingRequests],
    })),

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
