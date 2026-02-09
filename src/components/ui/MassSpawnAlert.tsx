import React from 'react';
import { useUIStore } from '../../stores/useUIStore';

export const MassSpawnAlert: React.FC = () => {
  const massSpawnAlert = useUIStore((state) => state.massSpawnAlert);

  if (!massSpawnAlert) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
      <div className="animate-pulse">
        <div
          className="bg-red-900/90 border-4 border-red-500 rounded-xl shadow-2xl"
          style={{ padding: 'clamp(1.5rem, 4vw, 2rem) clamp(2rem, 6vw, 3rem)' }}
        >
          <div className="text-center">
            <div style={{ fontSize: 'clamp(2.5rem, 6vw, 3.75rem)' }} className="mb-4">⚠️</div>
            <h2 className="font-bold text-red-400 mb-2 animate-bounce" style={{ fontSize: 'clamp(1.5rem, 4vw, 2.25rem)' }}>
              대량 발생!
            </h2>
            <p className="text-red-200" style={{ fontSize: 'clamp(0.875rem, 2vw, 1.25rem)' }}>
              적 진영에서 대규모 병력이 출현!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
