// 피드백 API 서비스

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

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

// 내 피드백 조회
export const getMyFeedback = async (
  playerId: string
): Promise<{ rating: number; comment: string } | null> => {
  try {
    const data = await apiRequest<{
      success: boolean;
      feedback: { rating: number; comment: string } | null;
    }>(`/api/feedback/${playerId}`);

    return data.feedback;
  } catch (err) {
    console.error('Get feedback error:', err);
    return null;
  }
};

// 피드백 제출/수정
export const submitFeedback = async (
  playerId: string,
  rating: number,
  comment: string
): Promise<{ success: boolean; expRewarded: number }> => {
  try {
    const data = await apiRequest<{ success: boolean; expRewarded: number }>('/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ playerId, rating, comment }),
    });

    return { success: data.success, expRewarded: data.expRewarded ?? 0 };
  } catch (err) {
    console.error('Submit feedback error:', err);
    return { success: false, expRewarded: 0 };
  }
};

// 전체 요약 (평균 별점, 총 개수)
export const getFeedbackSummary = async (): Promise<{
  averageRating: number;
  totalCount: number;
} | null> => {
  try {
    const data = await apiRequest<{
      success: boolean;
      summary: { averageRating: number; totalCount: number };
    }>('/api/feedback/summary/stats');

    return data.summary;
  } catch (err) {
    console.error('Get feedback summary error:', err);
    return null;
  }
};
