import React from 'react';
import { useFullscreen } from '../../hooks/useFullscreen';

export const FullscreenButton: React.FC = () => {
  const { isFullscreen, toggleFullscreen, isSupported } = useFullscreen();

  if (!isSupported) return null;

  return (
    <button
      onClick={toggleFullscreen}
      className="w-10 h-10 rounded-lg bg-dark-700/80 border border-dark-500 hover:border-neon-cyan/50 flex items-center justify-center transition-all duration-200 cursor-pointer"
      title={isFullscreen ? '전체화면 해제' : '전체화면'}
    >
      <span className="text-lg">
        {isFullscreen ? '🔲' : '⛶'}
      </span>
    </button>
  );
};
