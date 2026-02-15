import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../services/adminApi';
import type { FeedbackItem, FeedbackStats, Pagination } from '../types/admin';

const RATING_LABELS: Record<number, string> = {
  1: '별로예요',
  2: '그저 그래요',
  3: '보통이에요',
  4: '재미있어요',
  5: '최고예요',
};

const RATING_COLORS: Record<number, string> = {
  1: 'bg-red-500',
  2: 'bg-orange-500',
  3: 'bg-yellow-500',
  4: 'bg-lime-500',
  5: 'bg-green-500',
};

export function FeedbackPage() {
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [statsData, listData] = await Promise.all([
        adminApi.getFeedbackStats(),
        adminApi.getFeedbackList({
          page: currentPage,
          limit: 20,
          rating: ratingFilter ?? undefined,
          sortOrder,
        }),
      ]);

      setStats(statsData);
      setFeedbackList(listData.feedback);
      setPagination(listData.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터 로드 실패');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, ratingFilter, sortOrder]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (id: string) => {
    if (!confirm('이 피드백을 삭제하시겠습니까?')) return;

    setDeletingId(id);
    try {
      await adminApi.deleteFeedback(id);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제 실패');
    } finally {
      setDeletingId(null);
    }
  };

  const handleFilterChange = (rating: number | null) => {
    setRatingFilter(rating);
    setCurrentPage(1);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={i < rating ? 'text-yellow-400' : 'text-slate-600'}>
        ★
      </span>
    ));
  };

  if (isLoading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-slate-400">
          <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>피드백 로딩 중...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm truncate">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 flex-shrink-0 cursor-pointer">✕</button>
        </div>
      )}

      {/* 통계 카드 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 총 참여자 */}
          <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700/50">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-slate-400">총 참여자</p>
                <p className="text-2xl font-bold text-white">{stats.totalCount}</p>
              </div>
            </div>
          </div>

          {/* 평균 별점 */}
          <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700/50">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                <span className="text-yellow-400 text-lg">★</span>
              </div>
              <div>
                <p className="text-xs text-slate-400">평균 별점</p>
                <p className="text-2xl font-bold text-white">{stats.averageRating} <span className="text-sm text-slate-400">/ 5</span></p>
              </div>
            </div>
          </div>

          {/* 별점 분포 */}
          <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700/50">
            <p className="text-xs text-slate-400 mb-3">별점 분포</p>
            <div className="space-y-1.5">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = stats.distribution[star] || 0;
                const percentage = stats.totalCount > 0 ? (count / stats.totalCount) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400 w-3">{star}</span>
                    <span className="text-yellow-400">★</span>
                    <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${RATING_COLORS[star]}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-slate-400 w-6 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 필터 및 정렬 */}
      <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-slate-400">별점 필터:</span>
          <button
            onClick={() => handleFilterChange(null)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors cursor-pointer ${
              ratingFilter === null
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                : 'bg-slate-700/50 text-slate-400 border border-transparent hover:border-slate-600'
            }`}
          >
            전체
          </button>
          {[5, 4, 3, 2, 1].map((star) => (
            <button
              key={star}
              onClick={() => handleFilterChange(star)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors cursor-pointer ${
                ratingFilter === star
                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                  : 'bg-slate-700/50 text-slate-400 border border-transparent hover:border-slate-600'
              }`}
            >
              {'★'.repeat(star)}{'☆'.repeat(5 - star)}
            </button>
          ))}

          <div className="ml-auto">
            <button
              onClick={() => { setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc'); setCurrentPage(1); }}
              className="px-3 py-1.5 rounded-lg text-sm bg-slate-700/50 text-slate-400 hover:border-slate-600 border border-transparent transition-colors cursor-pointer"
            >
              {sortOrder === 'desc' ? '최신순 ↓' : '오래된순 ↑'}
            </button>
          </div>
        </div>
      </div>

      {/* 피드백 목록 */}
      <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden">
        {feedbackList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <svg className="w-12 h-12 mb-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <p className="text-sm">피드백이 없습니다</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {feedbackList.map((item) => (
              <div key={item.id} className="p-5 hover:bg-slate-700/20 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  {/* 왼쪽: 유저 정보 + 별점 + 의견 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      {/* 아바타 */}
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">
                          {item.playerNickname.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white truncate">{item.playerNickname}</span>
                          <span className="text-xs text-slate-500">Lv.{item.playerLevel}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{renderStars(item.rating)}</span>
                          <span className="text-xs text-slate-500">{RATING_LABELS[item.rating]}</span>
                        </div>
                      </div>
                    </div>

                    {/* 의견 */}
                    {item.comment && (
                      <p className="text-sm text-slate-300 mt-2 ml-11 whitespace-pre-wrap break-words">
                        {item.comment}
                      </p>
                    )}
                  </div>

                  {/* 오른쪽: 날짜 + 삭제 */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span className="text-xs text-slate-500">{formatDate(item.createdAt)}</span>
                    {item.updatedAt !== item.createdAt && (
                      <span className="text-xs text-slate-600">(수정됨)</span>
                    )}
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      className="text-xs text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                    >
                      {deletingId === item.id ? '삭제 중...' : '삭제'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 페이지네이션 */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-slate-700/50">
            <p className="text-sm text-slate-400">
              총 {pagination.total}개 중 {(pagination.page - 1) * pagination.limit + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg text-sm bg-slate-700/50 text-slate-400 hover:bg-slate-600/50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                이전
              </button>
              <span className="text-sm text-slate-400">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(Math.min(pagination.totalPages, currentPage + 1))}
                disabled={currentPage === pagination.totalPages}
                className="px-3 py-1.5 rounded-lg text-sm bg-slate-700/50 text-slate-400 hover:bg-slate-600/50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                다음
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
