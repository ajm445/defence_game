import React from 'react';
import { useUIStore } from '../../stores/useUIStore';

export const MassSpawnAlert: React.FC = () => {
  const massSpawnAlert = useUIStore((state) => state.massSpawnAlert);

  if (!massSpawnAlert) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
      <div className="animate-pulse">
        <div className="bg-red-900/90 border-4 border-red-500 rounded-xl px-12 py-8 shadow-2xl">
          <div className="text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-4xl font-bold text-red-400 mb-2 animate-bounce">
              대량 발생!
            </h2>
            <p className="text-xl text-red-200">
              적 진영에서 대규모 병력이 출현!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
