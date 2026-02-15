import { useState, useEffect, useCallback, useRef } from 'react';
import { adminApi } from '../services/adminApi';
import type { MaintenanceStatus } from '../types/admin';

export function MaintenancePage() {
  const [status, setStatus] = useState<MaintenanceStatus | null>(null);
  const [minutes, setMinutes] = useState(10);
  const [message, setMessage] = useState('점검이 있으니 잠시 후 서버가 종료됩니다.');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingDisplay, setRemainingDisplay] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await adminApi.getMaintenanceStatus();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '상태 조회 실패');
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // 남은 시간 실시간 표시
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!status?.isActive || !status.shutdownAt) {
      setRemainingDisplay(null);
      return;
    }

    const updateRemaining = () => {
      if (!status.shutdownAt) return;
      const remaining = Math.max(0, status.shutdownAt - Date.now());
      if (remaining <= 0) {
        setRemainingDisplay(null); // 0이면 숨김 → "점검 중" 텍스트로 대체
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        return;
      }
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setRemainingDisplay(`${mins}분 ${secs}초`);
    };

    updateRemaining();
    timerRef.current = setInterval(updateRemaining, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [status?.isActive, status?.shutdownAt]);

  const handleActivate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await adminApi.activateMaintenance(minutes, message);
      setStatus(result.state);
    } catch (err) {
      setError(err instanceof Error ? err.message : '점검 활성화 실패');
    }
    setIsLoading(false);
  };

  const handleDeactivate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await adminApi.deactivateMaintenance();
      setStatus(result.state);
    } catch (err) {
      setError(err instanceof Error ? err.message : '점검 해제 실패');
    }
    setIsLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-white">서버 점검 관리</h1>
        <p className="text-slate-400 mt-1">서버 점검 모드를 활성화하여 플레이어에게 알림을 보내고, 신규 접속을 차단합니다.</p>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-300 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-3 text-red-400 hover:text-red-300 cursor-pointer">
            닫기
          </button>
        </div>
      )}

      {/* 현재 상태 카드 */}
      <div className={`p-6 rounded-xl border ${
        status?.isActive
          ? 'bg-red-500/10 border-red-500/30'
          : 'bg-green-500/10 border-green-500/30'
      }`}>
        <div className="flex items-center gap-4">
          <div className={`w-4 h-4 rounded-full ${
            status?.isActive ? 'bg-red-500 animate-pulse' : 'bg-green-500'
          }`} />
          <div>
            <h2 className="text-lg font-bold text-white">
              {status?.isActive ? '점검 모드 활성화됨' : '정상 운영 중'}
            </h2>
            {status?.isActive && (
              <div className="mt-2 space-y-1">
                <p className="text-sm text-slate-300">메시지: {status.message}</p>
                {remainingDisplay ? (
                  <p className="text-sm text-yellow-300">
                    서버 종료까지: <span className="font-mono font-bold">{remainingDisplay}</span>
                  </p>
                ) : (
                  <p className="text-sm text-red-400 font-bold">점검 중 (로그인 차단됨)</p>
                )}
                {status.scheduledAt && (
                  <p className="text-xs text-slate-400">
                    시작 시간: {new Date(status.scheduledAt).toLocaleString('ko-KR')}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 점검 해제 버튼 */}
        {status?.isActive && (
          <button
            onClick={handleDeactivate}
            disabled={isLoading}
            className="mt-4 px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? '처리 중...' : '점검 해제'}
          </button>
        )}
      </div>

      {/* 점검 활성화 폼 */}
      {!status?.isActive && (
        <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700/50">
          <h2 className="text-lg font-bold text-white mb-4">점검 모드 활성화</h2>

          <div className="space-y-4">
            {/* 카운트다운 시간 */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                서버 종료까지 시간 (분)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={minutes}
                  onChange={(e) => setMinutes(Math.max(0, Math.min(120, parseInt(e.target.value) || 0)))}
                  min={0}
                  max={120}
                  className="w-32 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                />
                <div className="flex gap-2">
                  {[5, 10, 15, 30].map((m) => (
                    <button
                      key={m}
                      onClick={() => setMinutes(m)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                        minutes === m
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {m}분
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                0으로 설정하면 카운트다운 없이 즉시 점검 모드만 활성화됩니다.
              </p>
            </div>

            {/* 점검 메시지 */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                점검 안내 메시지
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={2}
                maxLength={200}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-blue-500 focus:outline-none resize-none"
                placeholder="플레이어에게 표시될 점검 안내 메시지"
              />
              <p className="text-xs text-slate-500 mt-1">{message.length}/200</p>
            </div>

            {/* 활성화 버튼 */}
            <button
              onClick={handleActivate}
              disabled={isLoading}
              className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? '처리 중...' : `점검 모드 활성화${minutes > 0 ? ` (${minutes}분 카운트다운)` : ''}`}
            </button>
          </div>
        </div>
      )}

      {/* 안내 */}
      <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700/30">
        <h3 className="text-sm font-semibold text-slate-300 mb-2">점검 모드 안내</h3>
        <ul className="space-y-1 text-xs text-slate-400">
          <li>- 점검 모드 활성화 시 접속 중인 모든 플레이어에게 닫을 수 있는 토스트 알림이 전송됩니다.</li>
          <li>- 카운트다운 중에는 1분마다 자동으로 남은 시간 알림이 전송됩니다.</li>
          <li>- 카운트다운이 완료되면 접속 중인 모든 계정이 자동 로그아웃됩니다.</li>
          <li>- 점검 모드에서는 새로운 로그인이 차단됩니다.</li>
          <li>- 배포 완료 후 점검 해제 버튼을 눌러 정상 운영으로 복구하세요.</li>
        </ul>
      </div>
    </div>
  );
}
