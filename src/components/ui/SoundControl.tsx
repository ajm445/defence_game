import React, { useState, useEffect } from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { soundManager } from '../../services/SoundManager';

export const SoundControl: React.FC = () => {
  const soundMuted = useUIStore((state) => state.soundMuted);
  const soundVolume = useUIStore((state) => state.soundVolume);
  const setSoundVolume = useUIStore((state) => state.setSoundVolume);
  const toggleSoundMuted = useUIStore((state) => state.toggleSoundMuted);

  const [showSlider, setShowSlider] = useState(false);

  // SoundManager와 상태 동기화
  useEffect(() => {
    soundManager.setVolume(soundVolume);
  }, [soundVolume]);

  useEffect(() => {
    soundManager.setMuted(soundMuted);
  }, [soundMuted]);

  const handleToggleMute = () => {
    toggleSoundMuted();
    soundManager.play('ui_click');
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setSoundVolume(newVolume);
  };

  const handleMouseEnter = () => {
    setShowSlider(true);
  };

  const handleMouseLeave = () => {
    setShowSlider(false);
  };

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* 음소거 토글 버튼 */}
      <button
        onClick={handleToggleMute}
        className={`w-8 h-8 rounded flex items-center justify-center text-sm transition-all duration-200 z-10 ${
          soundMuted
            ? 'bg-dark-700/80 border border-dark-500 opacity-50'
            : 'bg-neon-cyan/20 border border-neon-cyan/50'
        }`}
        title={`사운드: ${soundMuted ? 'OFF' : 'ON'} (M)`}
      >
        {soundMuted ? '🔇' : soundVolume > 0.5 ? '🔊' : soundVolume > 0 ? '🔉' : '🔈'}
      </button>

      {/* 볼륨 슬라이더 */}
      {showSlider && !soundMuted && (
        <div
          className="absolute left-0 -bottom-12 w-32 p-2 rounded-lg glass-dark border border-dark-500/50 z-20"
        >
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={soundVolume}
            onChange={handleVolumeChange}
            className="w-full h-2 bg-dark-600 rounded-lg appearance-none cursor-pointer
                       [&::-webkit-slider-thumb]:appearance-none
                       [&::-webkit-slider-thumb]:w-4
                       [&::-webkit-slider-thumb]:h-4
                       [&::-webkit-slider-thumb]:rounded-full
                       [&::-webkit-slider-thumb]:bg-neon-cyan
                       [&::-webkit-slider-thumb]:cursor-pointer
                       [&::-moz-range-thumb]:w-4
                       [&::-moz-range-thumb]:h-4
                       [&::-moz-range-thumb]:rounded-full
                       [&::-moz-range-thumb]:bg-neon-cyan
                       [&::-moz-range-thumb]:cursor-pointer
                       [&::-moz-range-thumb]:border-0"
          />
          <div className="text-[10px] text-center text-gray-400 mt-1">
            {Math.round(soundVolume * 100)}%
          </div>
        </div>
      )}
    </div>
  );
};
