import { HeroClass, AdvancedHeroClass } from '../types/rpg';

// API 기본 URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// 랭킹 플레이어 정보
export interface RankingPlayer {
  playerId: string;
  nickname: string;
  heroClass: HeroClass;
  advancedClass?: AdvancedHeroClass;
  characterLevel: number;
}

// 극한 난이도 랭킹
export interface ExtremeRanking {
  id: string;
  player_count: number;
  clear_time: number;
  players: RankingPlayer[];
  cleared_at: string;
}

// API 요청 헬퍼
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || '요청 처리 중 오류가 발생했습니다.');
  }

  return data;
}

// 극한 난이도 랭킹 조회
export const getExtremeRankings = async (playerCount: number): Promise<ExtremeRanking[]> => {
  try {
    const data = await apiRequest<{
      success: boolean;
      rankings: ExtremeRanking[];
    }>(`/api/rankings/extreme/${playerCount}`);

    if (!data.success) {
      return [];
    }

    return data.rankings;
  } catch (err) {
    console.error('Get extreme rankings error:', err);
    return [];
  }
};

// 극한 난이도 랭킹 저장
export const saveExtremeRanking = async (
  playerCount: number,
  clearTime: number,
  players: RankingPlayer[]
): Promise<boolean> => {
  try {
    const data = await apiRequest<{ success: boolean }>('/api/rankings/extreme', {
      method: 'POST',
      body: JSON.stringify({
        playerCount,
        clearTime,
        players,
      }),
    });

    return data.success;
  } catch (err) {
    console.error('Save extreme ranking error:', err);
    return false;
  }
};
