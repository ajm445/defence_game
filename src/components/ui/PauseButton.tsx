import React from 'react';

interface PauseButtonProps {
  onClick: () => void;
}

export const PauseButton: React.FC<PauseButtonProps> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="w-10 h-10 rounded-lg bg-dark-700/80 border border-dark-500 hover:border-yellow-500/50 flex items-center justify-center transition-all duration-200 cursor-pointer"
      title="일시정지"
    >
      <span className="text-lg">⏸️</span>
    </button>
  );
};
