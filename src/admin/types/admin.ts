// Admin Types

export type AdminRole = 'admin' | 'super_admin';

export interface AdminUser {
  id: string;
  username: string;
  nickname: string;
  role: AdminRole;
}

export interface AdminLoginResponse {
  token: string;
  admin: AdminUser;
}

export interface AdminVerifyResponse {
  valid: boolean;
  admin?: AdminUser;
}

// Player Types
export interface ClassProgress {
  className: string;
  classLevel: number;
  classExp: number;
  advancedClass: string | null;
  tier: number;
  sp?: number;
  statUpgrades?: Record<string, number>;
}

export interface PlayerListItem {
  id: string;
  nickname: string;
  playerLevel: number;
  playerExp: number;
  isGuest: boolean;
  isBanned: boolean;
  bannedUntil: string | null;
  isOnline: boolean;
  createdAt: string;
  updatedAt: string;
  classProgress: ClassProgress[];
  totalGames: number;
}

export interface GameRecord {
  id: string;
  mode: 'single' | 'coop';
  classUsed: string;
  waveReached: number;
  kills: number;
  playTime: number;
  victory: boolean;
  expEarned: number;
  playedAt: string;
}

export interface PlayerStats {
  totalGames: number;
  totalWins: number;
  totalKills: number;
  totalPlayTime: number;
  maxWaveReached: number;
  singleGames: number;
  coopGames: number;
}

export interface BanRecord {
  id: string;
  reason: string;
  bannedAt: string;
  expiresAt: string | null;
  unbannedAt: string | null;
  isActive: boolean;
  bannedBy: string | null;
  unbannedBy: string | null;
}

export interface PlayerDetail {
  player: {
    id: string;
    nickname: string;
    playerLevel: number;
    playerExp: number;
    isGuest: boolean;
    isBanned: boolean;
    bannedUntil: string | null;
    soundVolume: number;
    soundMuted: boolean;
    createdAt: string;
    updatedAt: string;
  };
  classProgress: ClassProgress[];
  recentGames: GameRecord[];
  stats: PlayerStats;
  banHistory: BanRecord[];
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PlayersListResponse {
  players: PlayerListItem[];
  pagination: Pagination;
}

// Stats Types
export interface OverviewStats {
  totalPlayers: number;
  bannedPlayers: number;
  guestPlayers: number;
  newPlayersToday: number;
  newPlayersWeek: number;
  totalGames: number;
  gamesToday: number;
  currentOnline: number;
}

export interface ClassPopularityData {
  className: string;
  count: number;
  percentage: string;
  winRate: string;
}

export interface GameModeData {
  mode: string;
  count: number;
  wins: number;
  winRate: string;
  avgWaveReached: string;
  avgKills: string;
  avgPlayTime: string;
}

export interface UserGrowthData {
  date: string;
  newUsers: number;
  totalUsers: number;
}

export interface DailyGamesData {
  date: string;
  single: number;
  coop: number;
  total: number;
}

// Ban Types
export interface BanListItem {
  id: string;
  player: {
    id: string;
    nickname: string;
  } | null;
  reason: string;
  bannedAt: string;
  expiresAt: string | null;
  unbannedAt: string | null;
  isActive: boolean;
  bannedBy: string | null;
  unbannedBy: string | null;
}

export interface BansListResponse {
  bans: BanListItem[];
  pagination: Pagination;
}

// Monitoring Types
export interface ServerStatus {
  currentOnline: number;
  activeGames: number;
  serverUptime: number;
  memoryUsage: number;
}

export interface PlayerActivity {
  type: 'connect' | 'disconnect' | 'game_start' | 'game_end';
  playerId: string;
  playerName?: string;
  timestamp: string;
  details?: Record<string, unknown>;
}
