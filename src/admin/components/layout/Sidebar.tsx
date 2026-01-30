import { NavLink } from 'react-router-dom';
import { useAdminAuthStore } from '../../stores/useAdminAuthStore';

const navItems = [
  {
    path: '/admin/dashboard',
    label: '대시보드',
    description: '통계 및 현황',
    icon: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
      </svg>
    ),
  },
  {
    path: '/admin/players',
    label: '플레이어',
    description: '계정 관리',
    icon: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    path: '/admin/monitoring',
    label: '모니터링',
    description: '실시간 현황',
    icon: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const admin = useAdminAuthStore((state) => state.admin);

  return (
    <aside className="hidden lg:flex w-64 bg-slate-800/50 backdrop-blur-sm min-h-screen flex-col border-r border-slate-700/50 flex-shrink-0">
      {/* 로고 영역 */}
      <div className="p-5 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25 flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-white truncate">Defence Game</h1>
            <p className="text-xs text-slate-400">Admin Console</p>
          </div>
        </div>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 p-5 overflow-y-auto">
        {/* 메뉴 섹션 */}
        <div className="mb-8">
          <div className="flex items-center gap-2 px-3 mb-3">
            <div className="flex-1 h-px bg-gradient-to-r from-slate-600/50 to-transparent"></div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">메뉴</span>
            <div className="flex-1 h-px bg-gradient-to-l from-slate-600/50 to-transparent"></div>
          </div>
          <ul className="space-y-1.5">
            {navItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-500/20 to-blue-600/10 text-blue-400 border border-blue-500/30'
                        : 'text-slate-400 hover:bg-slate-700/50 hover:text-white border border-transparent'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className={`p-2 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-blue-500/20'
                          : 'bg-slate-700/50 group-hover:bg-slate-600/50'
                      }`}>
                        {item.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.label}</p>
                        <p className={`text-xs truncate ${isActive ? 'text-blue-400/70' : 'text-slate-500'}`}>
                          {item.description}
                        </p>
                      </div>
                      {isActive && (
                        <div className="w-1.5 h-8 rounded-full bg-blue-500"></div>
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>

        {/* 빠른 정보 */}
        <div className="mt-auto">
          <div className="flex items-center gap-2 px-3 mb-3">
            <div className="flex-1 h-px bg-gradient-to-r from-slate-600/50 to-transparent"></div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">정보</span>
            <div className="flex-1 h-px bg-gradient-to-l from-slate-600/50 to-transparent"></div>
          </div>
          <div className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/30">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
              </svg>
              서버 상태
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
              <span className="text-sm font-medium text-green-400">정상 운영 중</span>
            </div>
          </div>
        </div>
      </nav>

      {/* 사용자 정보 */}
      <div className="p-5 border-t border-slate-700/50">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-slate-700/50 to-slate-700/30 border border-slate-600/30">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0 shadow-lg">
            <span className="text-white text-sm font-bold">
              {admin?.nickname?.charAt(0).toUpperCase() || 'A'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {admin?.nickname || '관리자'}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {admin?.role === 'super_admin' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-400 text-[10px] font-semibold">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  최고 관리자
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-400 text-[10px] font-semibold">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  관리자
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

// 모바일용 네비게이션 바
export function MobileNav() {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-700/50 z-50 safe-area-pb">
      <div className="flex items-center justify-around py-2 px-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
                isActive
                  ? 'text-blue-400 bg-blue-500/10'
                  : 'text-slate-400 active:bg-slate-700/50'
              }`
            }
          >
            {item.icon}
            <span className="text-[10px] font-semibold">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
