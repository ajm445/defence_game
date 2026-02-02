import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePlayersStore } from '../stores/usePlayersStore';
import { useAdminAuthStore } from '../stores/useAdminAuthStore';

const CLASS_NAMES: Record<string, string> = {
  archer: '궁수',
  warrior: '전사',
  knight: '기사',
  mage: '마법사',
};

const ADVANCED_CLASS_NAMES: Record<string, string> = {
  sniper: '저격수',
  ranger: '레인저',
  berserker: '버서커',
  guardian: '가디언',
  paladin: '팔라딘',
  darkKnight: '다크나이트',
  archmage: '아크메이지',
  healer: '힐러',
};

export function PlayerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const admin = useAdminAuthStore((state) => state.admin);
  const isSuperAdmin = admin?.role === 'super_admin';

  const {
    selectedPlayer,
    isLoading,
    error,
    fetchPlayer,
    updatePlayer,
    updateClassProgress,
    deletePlayer,
    banPlayer,
    unbanPlayer,
    clearSelectedPlayer,
    clearError,
  } = usePlayersStore();

  const [showBanModal, setShowBanModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showClassEditModal, setShowClassEditModal] = useState<string | null>(null);
  const [visibleGamesCount, setVisibleGamesCount] = useState(10);

  useEffect(() => {
    if (id) {
      fetchPlayer(id);
    }
    return () => clearSelectedPlayer();
  }, [id, fetchPlayer, clearSelectedPlayer]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('ko-KR');
  };

  const formatPlayTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    }
    return `${minutes}분`;
  };

  if (isLoading && !selectedPlayer) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-slate-400">
          <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>플레이어 정보 불러오는 중...</span>
        </div>
      </div>
    );
  }

  if (!selectedPlayer) {
    return (
      <div className="text-center py-16">
        <svg className="w-16 h-16 mx-auto mb-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-slate-400 mb-4">플레이어를 찾을 수 없습니다</p>
        <button
          onClick={() => navigate('/admin/players')}
          className="text-blue-400 hover:text-blue-300 font-medium"
        >
          플레이어 목록으로 돌아가기
        </button>
      </div>
    );
  }

  const { player, classProgress, recentGames, stats, banHistory } = selectedPlayer;

  return (
    <div className="space-y-8">
      {/* 뒤로가기 버튼 */}
      <button
        onClick={() => navigate('/admin/players')}
        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors px-4 py-2 -ml-4 rounded-xl hover:bg-slate-800/50"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <span className="font-medium">플레이어 목록</span>
      </button>

      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-5 py-4 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
          <button onClick={clearError} className="text-red-400 hover:text-red-300 p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* 플레이어 헤더 */}
      <section>
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">프로필</h3>
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-xl shadow-blue-500/25">
                <span className="text-4xl text-white font-bold">
                  {player.nickname.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <h1 className="text-3xl font-bold text-white">{player.nickname}</h1>
                  {player.role === 'vip' && (
                    <span className="px-3 py-1 bg-gradient-to-r from-amber-500 to-yellow-500 rounded-lg text-sm text-white font-bold shadow-lg shadow-amber-500/30">
                      VIP
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="px-4 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-sm font-semibold">
                    Lv.{player.playerLevel}
                  </span>
                  {player.isGuest && (
                    <span className="px-4 py-1.5 rounded-lg bg-slate-600/50 text-slate-300 text-sm">
                      게스트
                    </span>
                  )}
                  {player.isBanned ? (
                    <span className="px-4 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-sm font-medium flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                      정지됨
                    </span>
                  ) : (
                    <span className="px-4 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-sm font-medium flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      활성
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {isSuperAdmin && (
                <button
                  onClick={() => setShowEditModal(true)}
                  className="px-5 py-2.5 bg-slate-700/50 hover:bg-slate-700 text-white rounded-xl transition-colors flex items-center gap-2 font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  수정
                </button>
              )}
              {player.isBanned ? (
                <button
                  onClick={() => unbanPlayer(player.id)}
                  className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors flex items-center gap-2 font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  정지 해제
                </button>
              ) : (
                <button
                  onClick={() => setShowBanModal(true)}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors flex items-center gap-2 font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                  정지
                </button>
              )}
              {isSuperAdmin && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-5 py-2.5 bg-red-900/50 hover:bg-red-900 text-red-300 rounded-xl transition-colors flex items-center gap-2 font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  삭제
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mt-8 pt-8 border-t border-slate-700/50">
            <div className="bg-slate-700/20 rounded-xl p-4">
              <p className="text-sm text-slate-500 mb-2">경험치</p>
              <p className="text-xl font-bold text-white">{player.playerExp.toLocaleString()}</p>
            </div>
            <div className="bg-slate-700/20 rounded-xl p-4">
              <p className="text-sm text-slate-500 mb-2">가입일</p>
              <p className="text-lg font-semibold text-white">{formatDate(player.createdAt)}</p>
            </div>
            <div className="bg-slate-700/20 rounded-xl p-4">
              <p className="text-sm text-slate-500 mb-2">최근 활동</p>
              <p className="text-lg font-semibold text-white">{formatDate(player.updatedAt)}</p>
            </div>
            <div className="bg-slate-700/20 rounded-xl p-4">
              <p className="text-sm text-slate-500 mb-2">플레이어 ID</p>
              <p className="text-sm font-mono text-slate-400 truncate">{player.id}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 통계 */}
        <section>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">통계</h3>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6">
            <h4 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              게임 통계
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-700/30 rounded-xl p-5 text-center">
                <p className="text-sm text-slate-500 mb-2">총 게임</p>
                <p className="text-3xl font-bold text-white">{stats.totalGames}</p>
              </div>
              <div className="bg-slate-700/30 rounded-xl p-5 text-center">
                <p className="text-sm text-slate-500 mb-2">승률</p>
                <p className="text-3xl font-bold text-white">
                  {stats.totalGames > 0 ? ((stats.totalWins / stats.totalGames) * 100).toFixed(1) : 0}%
                </p>
              </div>
              <div className="bg-slate-700/30 rounded-xl p-5 text-center">
                <p className="text-sm text-slate-500 mb-2">총 처치</p>
                <p className="text-3xl font-bold text-white">{stats.totalKills.toLocaleString()}</p>
              </div>
              <div className="bg-slate-700/30 rounded-xl p-5 text-center">
                <p className="text-sm text-slate-500 mb-2">플레이 시간</p>
                <p className="text-2xl font-bold text-white">{formatPlayTime(stats.totalPlayTime)}</p>
              </div>
              <div className="bg-slate-700/30 rounded-xl p-5 text-center">
                <p className="text-sm text-slate-500 mb-2">모드별</p>
                <p className="text-lg text-white font-medium">싱글 {stats.singleGames} / 협동 {stats.coopGames}</p>
              </div>
            </div>
          </div>
        </section>

        {/* 클래스 진행도 */}
        <section>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">클래스</h3>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6">
            <h4 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              클래스 진행도
            </h4>
            {classProgress.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <p>클래스 진행도가 없습니다</p>
              </div>
            ) : (
              <div className="space-y-4">
                {classProgress.map((cp) => (
                  <div key={cp.className} className="bg-slate-700/30 rounded-xl p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-white text-lg">{CLASS_NAMES[cp.className] || cp.className}</p>
                        {cp.advancedClass && (
                          <p className="text-sm text-blue-400 mt-1">
                            {ADVANCED_CLASS_NAMES[cp.advancedClass] || cp.advancedClass}
                            {cp.tier > 1 && ` (${cp.tier}차 강화)`}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                          <span>EXP: {cp.classExp.toLocaleString()}</span>
                          {cp.sp !== undefined && (
                            <span className="text-yellow-400 font-medium">SP: {cp.sp}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-xl font-bold text-white">Lv.{cp.classLevel}</p>
                        </div>
                        {isSuperAdmin && (
                          <button
                            onClick={() => setShowClassEditModal(cp.className)}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-600/50 rounded-lg transition-colors"
                            title="수정"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* 최근 게임 기록 */}
      <section>
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">기록</h3>
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-lg font-semibold text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              최근 게임 기록
            </h4>
            {recentGames.length > 0 && (
              <span className="text-sm text-slate-400">
                {Math.min(visibleGamesCount, recentGames.length)} / {recentGames.length}개
              </span>
            )}
          </div>
          {recentGames.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p>게임 기록이 없습니다</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto rounded-xl border border-slate-700/30">
                <table className="w-full">
                  <thead className="sticky top-0 bg-slate-900/95 backdrop-blur-sm z-10">
                    <tr className="border-b border-slate-700/50">
                      <th className="px-5 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">일시</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">모드</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">클래스</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">처치</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">결과</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {recentGames.slice(0, visibleGamesCount).map((game) => (
                      <tr key={game.id} className="hover:bg-slate-700/20 transition-colors">
                        <td className="px-5 py-4 text-sm text-slate-300">{formatDate(game.playedAt)}</td>
                        <td className="px-5 py-4 text-sm text-slate-300">{game.mode === 'coop' ? '협동' : '싱글'}</td>
                        <td className="px-5 py-4 text-sm text-slate-300 font-medium">{CLASS_NAMES[game.classUsed] || game.classUsed}</td>
                        <td className="px-5 py-4 text-sm text-slate-300 font-medium">{game.kills}</td>
                        <td className="px-5 py-4">
                          {game.victory ? (
                            <span className="px-3 py-1.5 bg-green-500/20 text-green-400 text-xs rounded-lg font-semibold">승리</span>
                          ) : (
                            <span className="px-3 py-1.5 bg-red-500/20 text-red-400 text-xs rounded-lg font-semibold">패배</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {recentGames.length > visibleGamesCount && (
                <div className="mt-4 text-center">
                  <button
                    onClick={() => setVisibleGamesCount(prev => prev + 10)}
                    className="px-6 py-2.5 bg-slate-700/50 hover:bg-slate-700 text-white text-sm font-medium rounded-xl transition-colors inline-flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    더보기 ({recentGames.length - visibleGamesCount}개 남음)
                  </button>
                </div>
              )}
              {visibleGamesCount > 10 && (
                <div className="mt-2 text-center">
                  <button
                    onClick={() => setVisibleGamesCount(10)}
                    className="px-4 py-2 text-slate-400 hover:text-white text-sm transition-colors"
                  >
                    접기
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* 정지 기록 */}
      {banHistory.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">정지 이력</h3>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6">
            <h4 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              정지 기록
            </h4>
            <div className="space-y-4">
              {banHistory.map((ban) => (
                <div
                  key={ban.id}
                  className={`rounded-xl p-5 ${
                    ban.isActive
                      ? 'bg-red-500/10 border border-red-500/30'
                      : 'bg-slate-700/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-semibold text-white text-lg">{ban.reason}</p>
                      <p className="text-sm text-slate-400 mt-2">
                        정지일: {formatDate(ban.bannedAt)}
                        {ban.bannedBy && ` (${ban.bannedBy})`}
                      </p>
                      {ban.expiresAt && (
                        <p className="text-sm text-slate-400 mt-1">
                          만료일: {formatDate(ban.expiresAt)}
                        </p>
                      )}
                      {!ban.expiresAt && ban.isActive && (
                        <p className="text-sm text-red-400 font-medium mt-1">영구 정지</p>
                      )}
                      {ban.unbannedAt && (
                        <p className="text-sm text-green-400 mt-2">
                          해제일: {formatDate(ban.unbannedAt)}
                          {ban.unbannedBy && ` (${ban.unbannedBy})`}
                        </p>
                      )}
                    </div>
                    <span
                      className={`px-3 py-1.5 text-xs rounded-lg font-semibold ${
                        ban.isActive
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-slate-600/50 text-slate-400'
                      }`}
                    >
                      {ban.isActive ? '활성' : '해제됨'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 정지 모달 */}
      {showBanModal && (
        <BanModal
          onClose={() => setShowBanModal(false)}
          onBan={async (reason, expiresAt) => {
            const success = await banPlayer(player.id, reason, expiresAt);
            if (success) setShowBanModal(false);
          }}
        />
      )}

      {/* 수정 모달 */}
      {showEditModal && (
        <EditModal
          player={player}
          onClose={() => setShowEditModal(false)}
          onSave={async (data) => {
            const success = await updatePlayer(player.id, data);
            if (success) setShowEditModal(false);
          }}
        />
      )}

      {/* 삭제 확인 모달 */}
      {showDeleteConfirm && (
        <ConfirmModal
          title="플레이어 삭제"
          message={`"${player.nickname}" 플레이어를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
          confirmText="삭제"
          confirmClass="bg-red-600 hover:bg-red-700"
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={async () => {
            const success = await deletePlayer(player.id);
            if (success) navigate('/admin/players');
          }}
        />
      )}

      {/* 클래스 수정 모달 */}
      {showClassEditModal && (
        <ClassEditModal
          playerId={player.id}
          classProgress={classProgress.find(cp => cp.className === showClassEditModal)!}
          className={showClassEditModal}
          classDisplayName={CLASS_NAMES[showClassEditModal] || showClassEditModal}
          onClose={() => setShowClassEditModal(null)}
          onSave={async (data) => {
            const success = await updateClassProgress(player.id, showClassEditModal, data);
            if (success) setShowClassEditModal(null);
          }}
        />
      )}
    </div>
  );
}

// 정지 모달
function BanModal({ onClose, onBan }: { onClose: () => void; onBan: (reason: string, expiresAt?: string) => Promise<void> }) {
  const [reason, setReason] = useState('');
  const [isPermanent, setIsPermanent] = useState(true);
  const [expiresAt, setExpiresAt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;

    setIsSubmitting(true);
    await onBan(reason.trim(), isPermanent ? undefined : expiresAt || undefined);
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-xl">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          플레이어 정지
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-2">정지 사유</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
              rows={3}
              placeholder="정지 사유를 입력하세요"
              required
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isPermanent}
                onChange={(e) => setIsPermanent(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-red-500 focus:ring-red-500"
              />
              영구 정지
            </label>
          </div>
          {!isPermanent && (
            <div>
              <label className="block text-sm text-slate-300 mb-2">만료일</label>
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-500 mt-1">현재 시간 이후로만 설정 가능합니다</p>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !reason.trim()}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-600 text-white rounded-xl transition-colors"
            >
              {isSubmitting ? '처리 중...' : '정지하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 수정 모달
function EditModal({ player, onClose, onSave }: {
  player: { nickname: string; playerLevel: number; playerExp: number; role?: string };
  onClose: () => void;
  onSave: (data: { nickname?: string; playerLevel?: number; playerExp?: number; role?: string }) => Promise<void>;
}) {
  const [nickname, setNickname] = useState(player.nickname);
  const [playerLevel, setPlayerLevel] = useState(player.playerLevel);
  const [playerExp, setPlayerExp] = useState(player.playerExp);
  const [isVip, setIsVip] = useState(player.role === 'vip');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const data: { nickname?: string; playerLevel?: number; playerExp?: number; role?: string } = {};
    if (nickname !== player.nickname) data.nickname = nickname;
    if (playerLevel !== player.playerLevel) data.playerLevel = playerLevel;
    if (playerExp !== player.playerExp) data.playerExp = playerExp;

    // VIP 역할 변경
    const newRole = isVip ? 'vip' : 'player';
    const currentRole = player.role || 'player';
    if (newRole !== currentRole) data.role = newRole;

    await onSave(data);
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-xl">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          플레이어 정보 수정
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-2">닉네임</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-2">레벨</label>
            <input
              type="number"
              value={playerLevel}
              onChange={(e) => setPlayerLevel(parseInt(e.target.value) || 1)}
              min={1}
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-2">경험치</label>
            <input
              type="number"
              value={playerExp}
              onChange={(e) => setPlayerExp(parseInt(e.target.value) || 0)}
              min={0}
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {/* VIP 역할 토글 */}
          <div className="pt-2">
            <label className="flex items-center justify-between p-4 bg-slate-900/50 border border-slate-600 rounded-xl cursor-pointer hover:bg-slate-700/50 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-2xl">👑</span>
                <div>
                  <p className="text-white font-medium">VIP 역할</p>
                  <p className="text-xs text-slate-400">경험치 2배 보너스</p>
                </div>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={isVip}
                  onChange={(e) => setIsVip(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-600 rounded-full peer peer-checked:bg-amber-500 transition-colors"></div>
                <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
              </div>
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded-xl transition-colors"
            >
              {isSubmitting ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 확인 모달
function ConfirmModal({ title, message, confirmText, confirmClass, onClose, onConfirm }: {
  title: string;
  message: string;
  confirmText: string;
  confirmClass: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = async () => {
    setIsConfirming(true);
    await onConfirm();
    setIsConfirming(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-xl">
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <p className="text-slate-300 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleConfirm}
            disabled={isConfirming}
            className={`px-4 py-2 text-white rounded-xl transition-colors ${confirmClass} disabled:bg-slate-600`}
          >
            {isConfirming ? '처리 중...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// 클래스 수정 모달
function ClassEditModal({ classProgress, className: _className, classDisplayName, onClose, onSave }: {
  playerId: string;
  classProgress: { classLevel: number; classExp: number; sp?: number };
  className: string;
  classDisplayName: string;
  onClose: () => void;
  onSave: (data: { classLevel?: number; classExp?: number; sp?: number }) => Promise<void>;
}) {
  const [classLevel, setClassLevel] = useState(classProgress.classLevel);
  const [classExp, setClassExp] = useState(classProgress.classExp);
  const [sp, setSp] = useState(classProgress.sp || 0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const data: { classLevel?: number; classExp?: number; sp?: number } = {};
    if (classLevel !== classProgress.classLevel) data.classLevel = classLevel;
    if (classExp !== classProgress.classExp) data.classExp = classExp;
    if (sp !== (classProgress.sp || 0)) data.sp = sp;

    if (Object.keys(data).length > 0) {
      await onSave(data);
    } else {
      onClose();
    }
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-xl">
        <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
          <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          {classDisplayName} 클래스 수정
        </h3>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm text-slate-300 mb-2 font-medium">클래스 레벨</label>
            <input
              type="number"
              value={classLevel}
              onChange={(e) => setClassLevel(Math.max(1, parseInt(e.target.value) || 1))}
              min={1}
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <p className="text-xs text-slate-500 mt-1.5">최소 1 이상</p>
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-2 font-medium">클래스 경험치</label>
            <input
              type="number"
              value={classExp}
              onChange={(e) => setClassExp(Math.max(0, parseInt(e.target.value) || 0))}
              min={0}
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-2 font-medium flex items-center gap-2">
              SP (스킬 포인트)
              <span className="text-xs text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded">스탯 투자용</span>
            </label>
            <input
              type="number"
              value={sp}
              onChange={(e) => setSp(Math.max(0, parseInt(e.target.value) || 0))}
              min={0}
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            />
            <p className="text-xs text-slate-500 mt-1.5">현재 사용 가능한 스킬 포인트</p>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700/50">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-slate-300 hover:text-white transition-colors font-medium"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 text-white rounded-xl transition-colors font-medium"
            >
              {isSubmitting ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
