import React, { useState, useEffect } from 'react';
import { getMyFeedback, submitFeedback, getFeedbackSummary } from '../../services/feedbackService';
import { soundManager } from '../../services/SoundManager';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
  playerId: string;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose, onSubmitted, playerId }) => {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasExisting, setHasExisting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ averageRating: number; totalCount: number } | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setSubmitSuccess(false);
    setError(null);
    setIsLoading(true);

    // 내 피드백 + 전체 요약 동시 로드
    Promise.all([
      getMyFeedback(playerId),
      getFeedbackSummary(),
    ]).then(([feedback, summaryData]) => {
      if (feedback) {
        setRating(feedback.rating);
        setComment(feedback.comment);
        setHasExisting(true);
      } else {
        setRating(0);
        setComment('');
        setHasExisting(false);
      }
      setSummary(summaryData);
      setIsLoading(false);
    });
  }, [isOpen, playerId]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('별점을 선택해주세요.');
      return;
    }

    soundManager.play('ui_click');
    setIsSubmitting(true);
    setError(null);

    const success = await submitFeedback(playerId, rating, comment);

    if (success) {
      setSubmitSuccess(true);
      setHasExisting(true);
      onSubmitted?.();
      // 요약 데이터 갱신
      const newSummary = await getFeedbackSummary();
      if (newSummary) setSummary(newSummary);
    } else {
      setError('피드백 저장에 실패했습니다. 다시 시도해주세요.');
    }

    setIsSubmitting(false);
  };

  const displayRating = hoverRating || rating;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="relative w-[95vw] max-w-[460px] bg-gray-900/95 border border-gray-700 rounded-2xl overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h1 className="text-xl font-bold text-white">게임 피드백</h1>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* 콘텐츠 */}
        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-gray-400">불러오는 중...</div>
            </div>
          ) : submitSuccess ? (
            /* 제출 성공 화면 */
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="text-4xl">✅</div>
              <p className="text-green-400 font-bold text-lg">
                피드백이 {hasExisting ? '수정' : '등록'}되었습니다!
              </p>
              <p className="text-gray-400 text-sm">소중한 의견 감사합니다.</p>
              <button
                onClick={onClose}
                className="mt-2 px-8 py-3 bg-neon-cyan/20 hover:bg-neon-cyan/30 text-neon-cyan border border-neon-cyan/50 hover:border-neon-cyan rounded-lg transition-all cursor-pointer"
              >
                닫기
              </button>
            </div>
          ) : (
            <>
              {/* 전체 통계 */}
              {summary != null && summary.totalCount > 0 && (
                <div className="mb-5 px-4 py-3 bg-gray-800/50 rounded-lg border border-gray-700/50 text-center">
                  <span className="text-yellow-400 text-lg">★ {summary.averageRating}</span>
                  <span className="text-gray-400 text-sm ml-2">(총 {summary.totalCount}명 참여)</span>
                </div>
              )}

              {/* 별점 선택 */}
              <div className="mb-5">
                <label className="block text-gray-300 mb-3 text-sm">별점을 선택해주세요</label>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => { setRating(star); setError(null); }}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="text-4xl transition-transform hover:scale-110 cursor-pointer"
                    >
                      {star <= displayRating ? (
                        <span className="text-yellow-400">★</span>
                      ) : (
                        <span className="text-gray-600">☆</span>
                      )}
                    </button>
                  ))}
                </div>
                {rating > 0 && (
                  <div className="text-center mt-2 text-sm text-gray-400">
                    {rating === 1 && '별로예요'}
                    {rating === 2 && '그저 그래요'}
                    {rating === 3 && '보통이에요'}
                    {rating === 4 && '재미있어요'}
                    {rating === 5 && '최고예요!'}
                  </div>
                )}
              </div>

              {/* 의견 입력 */}
              <div className="mb-5">
                <label className="block text-gray-300 mb-2 text-sm">
                  의견 <span className="text-gray-500">(선택사항, 최대 500자)</span>
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value.slice(0, 500))}
                  placeholder="게임에 대한 의견을 자유롭게 작성해주세요..."
                  rows={4}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm resize-none focus:border-neon-cyan focus:outline-none placeholder-gray-500"
                />
                <div className="text-right text-xs text-gray-500 mt-1">
                  {comment.length}/500
                </div>
              </div>

              {/* 에러 메시지 */}
              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-red-400 text-sm text-center">{error}</p>
                </div>
              )}

              {/* 버튼 */}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors cursor-pointer"
                >
                  취소
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || rating === 0}
                  className={`flex-1 py-3 rounded-lg transition-all cursor-pointer ${
                    rating === 0
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-neon-cyan/20 hover:bg-neon-cyan/30 text-neon-cyan border border-neon-cyan/50 hover:border-neon-cyan'
                  }`}
                >
                  {isSubmitting ? '저장 중...' : hasExisting ? '수정' : '제출'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
