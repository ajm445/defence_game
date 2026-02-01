import { useEffect, useState } from 'react';
import { adminWebSocket } from '../services/AdminWebSocket';
import { useMonitoringStore } from '../stores/useMonitoringStore';
import { useAdminAuthStore } from '../stores/useAdminAuthStore';
import { adminApi } from '../services/adminApi';

export function MonitoringPage() {
  const token = useAdminAuthStore((state) => state.token);
  const {
    serverStatus,
    activities,
    isConnected,
    error,
    setServerStatus,
    addActivity,
    setConnected,
    setError,
    clearActivities,
  } = useMonitoringStore();

  const [overview, setOverview] = useState<{
    currentOnline: number;
    totalGames: number;
    gamesToday: number;
  } | null>(null);

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const stats = await adminApi.getOverviewStats();
        setOverview({
          currentOnline: stats.currentOnline,
          totalGames: stats.totalGames,
          gamesToday: stats.gamesToday,
        });
      } catch (err) {
        console.error('Failed to fetch overview:', err);
      }
    };

    fetchOverview();
    const interval = setInterval(fetchOverview, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (token) {
      adminWebSocket.setToken(token);
      adminWebSocket.connect({
        onPlayerActivity: addActivity,
        onServerStatus: setServerStatus,
        onConnect: () => setConnected(true),
        onDisconnect: () => setConnected(false),
        onError: setError,
      });
    }
    return () => {
      adminWebSocket.disconnect();
    };
  }, [token, addActivity, setServerStatus, setConnected, setError]);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getActivityIcon = (type: string) => {
    const baseClass = "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0";
    switch (type) {
      case 'connect':
        return (
          <div className={`${baseClass} bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30`}>
            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
        );
      case 'disconnect':
        return (
          <div className={`${baseClass} bg-gradient-to-br from-red-500/20 to-red-600/20 border border-red-500/30`}>
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
            </svg>
          </div>
        );
      case 'logout':
        return (
          <div className={`${baseClass} bg-gradient-to-br from-orange-500/20 to-orange-600/20 border border-orange-500/30`}>
            <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </div>
        );
      case 'game_start':
        return (
          <div className={`${baseClass} bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30`}>
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
      case 'game_end':
        return (
          <div className={`${baseClass} bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30`}>
            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
      default:
        return (
          <div className={`${baseClass} bg-gradient-to-br from-slate-500/20 to-slate-600/20 border border-slate-500/30`}>
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
    }
  };

  const getActivityText = (activity: { type: string; playerName?: string }) => {
    const name = activity.playerName || '알 수 없음';
    switch (activity.type) {
      case 'connect':
        return { name, action: '서버에 접속했습니다', color: 'text-green-400' };
      case 'disconnect':
        return { name, action: '연결이 끊겼습니다', color: 'text-red-400' };
      case 'logout':
        return { name, action: '로그아웃했습니다', color: 'text-orange-400' };
      case 'game_start':
        return { name, action: '게임을 시작했습니다', color: 'text-blue-400' };
      case 'game_end':
        return { name, action: '게임을 종료했습니다', color: 'text-purple-400' };
      default:
        return { name, action: activity.type, color: 'text-slate-400' };
    }
  };

  const loggedInUsers = serverStatus?.loggedInUsers ?? overview?.currentOnline ?? 0;
  const wsConnections = serverStatus?.currentOnline ?? overview?.currentOnline ?? 0;
  const activeGames = serverStatus?.activeGames ?? 0;
  const gamesToday = overview?.gamesToday ?? 0;

  return (
    <div className="space-y-8">
      {/* 연결 상태 헤더 */}
      <div className={`rounded-xl border p-5 transition-all ${
        isConnected
          ? 'bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/30'
          : 'bg-gradient-to-r from-red-500/10 to-orange-500/10 border-red-500/30'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${isConnected ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
              {isConnected ? (
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
                </svg>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  isConnected
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></span>
                  {isConnected ? '실시간 연결됨' : '연결 끊김'}
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-1">
                {isConnected ? '서버와 WebSocket 연결이 활성화되어 있습니다' : '서버 연결을 확인해주세요'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activities.length > 0 && (
              <button
                onClick={clearActivities}
                className="px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-all text-sm flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                로그 지우기
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 에러 메시지 - 연결이 안 됐을 때만 표시 */}
      {error && !isConnected && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-5 py-4 rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-red-500/20 flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* 실시간 통계 카드 */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-blue-500/20">
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">실시간 현황</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm text-slate-400 font-medium">로그인 사용자</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-bold text-white">{loggedInUsers}</span>
                <span className="text-sm text-slate-500">명</span>
              </div>
            </div>
            {loggedInUsers > 0 && (
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                <span className="text-xs text-green-400">Live</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/30">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm text-slate-400 font-medium">진행 중인 게임</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-bold text-white">{activeGames}</span>
                <span className="text-sm text-slate-500">개</span>
              </div>
            </div>
            {activeGames > 0 && (
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                <span className="text-xs text-blue-400">Playing</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30">
              <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm text-slate-400 font-medium">오늘 플레이</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-bold text-white">{gamesToday}</span>
                <span className="text-sm text-slate-500">게임</span>
              </div>
            </div>
          </div>
        </div>
        </div>
      </section>

      {/* 서버 상태 */}
      {serverStatus && (
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-yellow-500/20">
              <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">서버 상태</h3>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="p-6">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">가동 시간</span>
                </div>
                <p className="text-xl font-bold text-white">{formatUptime(serverStatus.serverUptime)}</p>
              </div>
              <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                  <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">메모리 사용</span>
                </div>
                <p className="text-xl font-bold text-white">{(serverStatus.memoryUsage / 1024 / 1024).toFixed(0)} <span className="text-sm text-slate-400">MB</span></p>
              </div>
              <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">로그인 사용자</span>
                </div>
                <p className="text-xl font-bold text-white">{serverStatus.loggedInUsers ?? 0} <span className="text-sm text-slate-400">명</span></p>
              </div>
              <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                  </svg>
                  <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">WS 연결</span>
                </div>
                <p className="text-xl font-bold text-white">{serverStatus.currentOnline} <span className="text-sm text-slate-400">개</span></p>
              </div>
              <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">활성 게임</span>
                </div>
                <p className="text-xl font-bold text-white">{serverStatus.activeGames} <span className="text-sm text-slate-400">개</span></p>
              </div>
            </div>
          </div>
          </div>
        </section>
      )}

      {/* 실시간 활동 피드 */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/20">
              <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">실시간 활동</h3>
          </div>
          {activities.length > 0 && (
            <span className="px-3 py-1.5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-semibold">
              {activities.length}개 이벤트
            </span>
          )}
        </div>
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="p-6">
          {activities.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-slate-700/50 to-slate-800/50 border border-slate-600/30 flex items-center justify-center">
                <svg className="w-10 h-10 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <p className="text-slate-300 text-lg font-semibold mb-2">아직 활동이 없습니다</p>
              <p className="text-slate-500 text-sm">플레이어가 접속하거나 게임을 시작하면 여기에 표시됩니다</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {activities.map((activity, index) => {
                const { name, action, color } = getActivityText(activity);
                return (
                  <div
                    key={`${activity.timestamp}-${index}`}
                    className="flex items-center gap-4 p-4 bg-slate-900/50 hover:bg-slate-900/70 rounded-xl transition-colors border border-slate-700/30"
                  >
                    {getActivityIcon(activity.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="text-white font-semibold">{name}</span>
                        <span className="text-slate-400"> {action}</span>
                      </p>
                    </div>
                    <span className="text-xs text-slate-500 font-medium bg-slate-800/50 px-2.5 py-1 rounded-lg flex-shrink-0">
                      {formatTime(activity.timestamp)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </div>
      </section>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}일 ${hours}시간`;
  if (hours > 0) return `${hours}시간 ${minutes}분`;
  return `${minutes}분`;
}
