import React from 'react';
import { useUIStore } from '../../stores/useUIStore';

export const OrientationPrompt: React.FC = () => {
  const isTouchDevice = useUIStore((s) => s.isTouchDevice);
  const isPortrait = useUIStore((s) => s.isPortrait);

  if (!isTouchDevice || !isPortrait) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-dark-900 flex flex-col items-center justify-center gap-6">
      <div className="text-6xl animate-rotate-phone">📱</div>
      <div className="text-white text-xl font-bold text-center px-8">
        가로로 회전해주세요
      </div>
      <div className="text-gray-400 text-sm text-center px-8">
        이 게임은 가로 모드에서 플레이할 수 있습니다
      </div>
    </div>
  );
};
