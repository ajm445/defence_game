import type {
  AdminLoginResponse,
  AdminVerifyResponse,
  PlayersListResponse,
  PlayerDetail,
  OverviewStats,
  ClassPopularityData,
  GameModeData,
  UserGrowthData,
  DailyGamesData,
  BansListResponse,
} from '../types/admin';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

class AdminApiService {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Auth APIs
  async login(username: string, password: string): Promise<AdminLoginResponse> {
    return this.request<AdminLoginResponse>('/api/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  async logout(): Promise<void> {
    await this.request('/api/admin/auth/logout', { method: 'POST' });
  }

  async verifyToken(): Promise<AdminVerifyResponse> {
    return this.request<AdminVerifyResponse>('/api/admin/auth/verify');
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.request('/api/admin/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  // Players APIs
  async getPlayers(params: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    isBanned?: boolean;
  } = {}): Promise<PlayersListResponse> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.search) searchParams.set('search', params.search);
    if (params.sortBy) searchParams.set('sortBy', params.sortBy);
    if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);
    if (params.isBanned !== undefined) searchParams.set('isBanned', params.isBanned.toString());

    return this.request<PlayersListResponse>(`/api/admin/players?${searchParams}`);
  }

  async getPlayer(id: string): Promise<PlayerDetail> {
    return this.request<PlayerDetail>(`/api/admin/players/${id}`);
  }

  async updatePlayer(id: string, data: {
    nickname?: string;
    playerLevel?: number;
    playerExp?: number;
    role?: string;
  }): Promise<void> {
    await this.request(`/api/admin/players/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deletePlayer(id: string): Promise<void> {
    await this.request(`/api/admin/players/${id}`, { method: 'DELETE' });
  }

  async updateClassProgress(playerId: string, className: string, data: {
    classLevel?: number;
    classExp?: number;
    sp?: number;
    statUpgrades?: Record<string, number>;
  }): Promise<void> {
    await this.request(`/api/admin/players/${playerId}/class/${className}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Ban APIs
  async banPlayer(id: string, reason: string, expiresAt?: string): Promise<void> {
    await this.request(`/api/admin/players/${id}/ban`, {
      method: 'POST',
      body: JSON.stringify({ reason, expiresAt }),
    });
  }

  async unbanPlayer(id: string): Promise<void> {
    await this.request(`/api/admin/players/${id}/ban`, { method: 'DELETE' });
  }

  async getBans(params: {
    page?: number;
    limit?: number;
    isActive?: boolean;
  } = {}): Promise<BansListResponse> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.isActive !== undefined) searchParams.set('isActive', params.isActive.toString());

    return this.request<BansListResponse>(`/api/admin/bans?${searchParams}`);
  }

  // Stats APIs
  async getOverviewStats(): Promise<OverviewStats> {
    return this.request<OverviewStats>('/api/admin/stats/overview');
  }

  async getClassPopularity(): Promise<{ classData: ClassPopularityData[]; totalGames: number }> {
    return this.request('/api/admin/stats/class-popularity');
  }

  async getGameModes(): Promise<{ modeData: GameModeData[] }> {
    return this.request('/api/admin/stats/game-modes');
  }

  async getUserGrowth(): Promise<{ growthData: UserGrowthData[] }> {
    return this.request('/api/admin/stats/user-growth');
  }

  async getDailyGames(): Promise<{ gamesData: DailyGamesData[] }> {
    return this.request('/api/admin/stats/games-daily');
  }
}

export const adminApi = new AdminApiService();
