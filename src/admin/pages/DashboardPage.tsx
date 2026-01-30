import { useEffect } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useDashboardStore } from '../stores/useDashboardStore';

const CLASS_COLORS: Record<string, string> = {
  archer: '#22c55e',
  warrior: '#ef4444',
  knight: '#3b82f6',
  mage: '#a855f7',
};

const CLASS_NAMES: Record<string, string> = {
  archer: '궁수',
  warrior: '전사',
  knight: '기사',
  mage: '마법사',
};

const MODE_NAMES: Record<string, string> = {
  single: '싱글',
  coop: '협동',
};

export function DashboardPage() {
  const {
    overview,
    classPopularity,
    gameModes,
    userGrowth,
    dailyGames,
    isLoading,
    error,
    fetchAll,
    clearError,
  } = useDashboardStore();

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  if (isLoading && !overview) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-slate-400">
          <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>대시보드 로딩 중...</span>
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
            <span className="truncate">{error}</span>
          </div>
          <button onClick={clearError} className="text-red-400 hover:text-red-300 p-1 flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* 주요 통계 카드 */}
      {overview && (
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">주요 지표</h3>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
          <StatCard
            title="전체 플레이어"
            value={overview.totalPlayers.toLocaleString()}
            subValue={`오늘 +${overview.newPlayersToday}`}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            }
            color="blue"
          />
          <StatCard
            title="현재 접속자"
            value={overview.currentOnline.toLocaleString()}
            subValue="실시간"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" />
              </svg>
            }
            color="green"
            pulse
          />
          <StatCard
            title="총 게임 수"
            value={overview.totalGames.toLocaleString()}
            subValue={`오늘 ${overview.gamesToday}게임`}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            color="purple"
          />
          <StatCard
            title="정지된 플레이어"
            value={overview.bannedPlayers.toLocaleString()}
            subValue={`게스트 ${overview.guestPlayers}명`}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            }
            color="red"
          />
          </div>
        </section>
      )}

      {/* 차트 영역 1 */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-purple-500/20">
            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">트렌드 분석</h3>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* 사용자 증가 추이 */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6">
            <h4 className="text-base font-semibold text-white mb-5 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span className="truncate">사용자 증가 추이 (30일)</span>
            </h4>
            {userGrowth.length > 0 ? (
              <div className="h-52 sm:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={userGrowth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDate}
                      stroke="#64748b"
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                    />
                    <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} width={40} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Line type="monotone" dataKey="totalUsers" name="총 사용자" stroke="#3b82f6" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="newUsers" name="신규 가입" stroke="#22c55e" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-52 sm:h-64 flex items-center justify-center text-slate-500 text-sm">데이터가 없습니다</div>
            )}
          </div>

          {/* 일별 게임 현황 */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6">
            <h4 className="text-base font-semibold text-white mb-5 flex items-center gap-2">
              <svg className="w-4 h-4 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="truncate">일별 게임 현황 (30일)</span>
            </h4>
            {dailyGames.length > 0 ? (
              <div className="h-52 sm:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyGames}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" tickFormatter={formatDate} stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} width={40} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="single" name="싱글" fill="#3b82f6" stackId="a" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="coop" name="협동" fill="#22c55e" stackId="a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-52 sm:h-64 flex items-center justify-center text-slate-500 text-sm">데이터가 없습니다</div>
            )}
          </div>
        </div>
      </section>

      {/* 차트 영역 2 */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-green-500/20">
            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">게임 분석</h3>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* 클래스 인기도 */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6">
            <h4 className="text-base font-semibold text-white mb-5 flex items-center gap-2">
              <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
              </svg>
              클래스 인기도
            </h4>
            {classPopularity.length > 0 ? (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="h-40 w-40 flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={classPopularity} cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="count" nameKey="className">
                        {classPopularity.map((entry) => (
                          <Cell key={entry.className} fill={CLASS_COLORS[entry.className] || '#666'} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }}
                        labelStyle={{ color: '#fff' }}
                        itemStyle={{ color: '#fff' }}
                        formatter={(value) => [value ?? 0, '선택 횟수']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 w-full space-y-2">
                  {classPopularity.map((cp) => (
                    <div key={cp.className} className="flex items-center justify-between p-2 bg-slate-700/20 rounded-lg">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: CLASS_COLORS[cp.className] }} />
                        <span className="text-slate-200 text-sm truncate">{CLASS_NAMES[cp.className] || cp.className}</span>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <span className="text-white font-bold text-sm">{cp.percentage}%</span>
                        <span className="text-slate-500 text-xs ml-1">({cp.count})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-slate-500 text-sm">데이터가 없습니다</div>
            )}
          </div>

          {/* 게임 모드 통계 */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6">
            <h4 className="text-base font-semibold text-white mb-5 flex items-center gap-2">
              <svg className="w-4 h-4 text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
              게임 모드 통계
            </h4>
            {gameModes.length > 0 ? (
              <div className="space-y-3">
                {gameModes.map((mode) => (
                  <div key={mode.mode} className="bg-slate-700/30 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold text-white">{MODE_NAMES[mode.mode] || mode.mode} 모드</span>
                      <span className="text-slate-400 text-xs bg-slate-600/30 px-2 py-1 rounded">{mode.count.toLocaleString()}게임</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center p-2 bg-slate-800/50 rounded-lg">
                        <p className="text-xs text-slate-500 mb-1">승률</p>
                        <p className="text-white font-bold">{mode.winRate}%</p>
                      </div>
                      <div className="text-center p-2 bg-slate-800/50 rounded-lg">
                        <p className="text-xs text-slate-500 mb-1">처치</p>
                        <p className="text-white font-bold">{mode.avgKills}</p>
                      </div>
                      <div className="text-center p-2 bg-slate-800/50 rounded-lg">
                        <p className="text-xs text-slate-500 mb-1">시간</p>
                        <p className="text-white font-bold">{mode.avgPlayTime}분</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-slate-500 text-sm">데이터가 없습니다</div>
            )}
          </div>
        </div>
      </section>

      {/* 클래스별 승률 */}
      {classPopularity.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-orange-500/20">
              <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">클래스 성과</h3>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6">
            <h4 className="text-base font-semibold text-white mb-5 flex items-center gap-2">
              <svg className="w-4 h-4 text-orange-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              클래스별 승률
            </h4>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={classPopularity} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" domain={[0, 100]} stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="className"
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    tickFormatter={(value) => CLASS_NAMES[value] || value}
                    width={50}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }}
                    labelStyle={{ color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                    formatter={(value) => [`${value}%`, '승률']}
                    labelFormatter={(label) => CLASS_NAMES[label] || label}
                  />
                  <Bar dataKey="winRate" name="승률" radius={[0, 4, 4, 0]} cursor="pointer">
                    {classPopularity.map((entry) => (
                      <Cell key={entry.className} fill={CLASS_COLORS[entry.className] || '#666'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({ title, value, subValue, icon, color, pulse }: {
  title: string;
  value: string;
  subValue?: string;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'purple' | 'red';
  pulse?: boolean;
}) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600 shadow-blue-500/25',
    green: 'from-green-500 to-green-600 shadow-green-500/25',
    purple: 'from-purple-500 to-purple-600 shadow-purple-500/25',
    red: 'from-red-500 to-red-600 shadow-red-500/25',
  };

  const bgColorClasses = {
    blue: 'bg-blue-500/10 border-blue-500/20',
    green: 'bg-green-500/10 border-green-500/20',
    purple: 'bg-purple-500/10 border-purple-500/20',
    red: 'bg-red-500/10 border-red-500/20',
  };

  return (
    <div className={`backdrop-blur-sm rounded-xl border p-5 sm:p-6 ${bgColorClasses[color]}`}>
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-xl bg-gradient-to-br ${colorClasses[color]} shadow-lg flex-shrink-0 ${pulse ? 'animate-pulse' : ''}`}>
          <div className="text-white w-6 h-6">{icon}</div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-400 font-medium truncate">{title}</p>
          <p className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-1">{value}</p>
          {subValue && (
            <p className="text-xs text-slate-500 mt-1 truncate">{subValue}</p>
          )}
        </div>
      </div>
    </div>
  );
}
