import React, { useEffect, useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

/**
 * 닫을 수 있는 점검 토스트 (로비/메뉴 등 인게임 외 화면)
 */
export const MaintenanceToast: React.FC = () => {
  const notice = useUIStore((s) => s.maintenanceNotice);
  const setMaintenanceNotice = useUIStore((s) => s.setMaintenanceNotice);
  const currentScreen = useUIStore((s) => s.currentScreen);

  const isInGame = currentScreen === 'game' || currentScreen === 'countdown' || currentScreen === 'paused';

  if (!notice || isInGame) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] animate-fade-in">
      <div className="flex items-center gap-3 px-5 py-3 bg-yellow-500/20 border border-yellow-500/60 rounded-lg backdrop-blur-md shadow-lg max-w-lg">
        <span className="text-yellow-400 text-lg flex-shrink-0">🔧</span>
        <p className="text-yellow-200 text-sm font-medium">{notice}</p>
        <button
          onClick={() => setMaintenanceNotice(null)}
          className="text-yellow-400/70 hover:text-yellow-300 flex-shrink-0 ml-2 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

/**
 * 자동으로 사라지는 점검 알림 (인게임 전용, 5초)
 */
export const MaintenanceAlert: React.FC = () => {
  const alert = useUIStore((s) => s.maintenanceAlert);
  const alertKey = useUIStore((s) => s.maintenanceAlertKey);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (alert) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [alert, alertKey]);

  if (!visible || !alert) return null;

  return (
    <div className="fixed top-20 inset-x-0 flex justify-center z-[9999] pointer-events-none">
      <div className="glass-dark rounded-xl px-6 py-3 border border-yellow-500/50 shadow-lg animate-[fadeInOut_5s_ease-in-out]">
        <div className="flex items-center gap-3">
          <span className="text-yellow-400">🔧</span>
          <span className="text-yellow-300 font-medium text-sm">{alert}</span>
        </div>
      </div>
    </div>
  );
};
