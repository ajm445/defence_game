import React, { useState, useEffect, useCallback } from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { soundManager } from '../../services/SoundManager';
import { Emoji } from '../common/Emoji';

/**
 * 소리 설정 버튼 + 모달 컴포넌트
 * 로그인 여부와 관계없이 어느 화면에서든 사용 가능
 */
export const SoundSettingsButton: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const soundVolume = useUIStore((s) => s.soundVolume);
  const soundMuted = useUIStore((s) => s.soundMuted);
  const setSoundVolume = useUIStore((s) => s.setSoundVolume);
  const setSoundMuted = useUIStore((s) => s.setSoundMuted);
  const saveSoundSettings = useAuthStore((s) => s.saveSoundSettings);

  const handleOpen = useCallback(() => {
    soundManager.init();
    soundManager.play('ui_click');
    setShowModal(true);
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setSoundVolume(newVolume);
    soundManager.setVolume(newVolume);
    soundManager.setBGMVolume(newVolume);
    saveSoundSettings(newVolume, soundMuted);
  }, [setSoundVolume, soundMuted, saveSoundSettings]);

  const handleToggleMute = useCallback(() => {
    const newMuted = !soundMuted;
    setSoundMuted(newMuted);
    soundManager.setMuted(newMuted);
    saveSoundSettings(soundVolume, newMuted);
    if (!newMuted) {
      soundManager.play('ui_click');
    }
  }, [soundMuted, setSoundMuted, soundVolume, saveSoundSettings]);

  // ESC 키로 모달 닫기
  useEffect(() => {
    if (!showModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowModal(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showModal]);

  return (
    <>
      {/* 설정 버튼 */}
      <button
        onClick={handleOpen}
        className="w-12 h-12 rounded-full bg-dark-700/80 border border-gray-600 hover:border-yellow-500 hover:bg-dark-600/80 transition-all duration-300 flex items-center justify-center cursor-pointer group"
        title="소리 설정"
      >
        <span className="group-hover:rotate-90 transition-transform duration-300">
          <Emoji emoji="⚙️" size={24} />
        </span>
      </button>

      {/* 소리 설정 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-dark-800/95 rounded-xl p-6 border border-gray-600 min-w-[380px] max-w-[420px] animate-fade-in">
            <h3 className="text-white font-bold text-xl mb-6 text-center">
              <Emoji emoji="🔊" size={20} className="inline-flex" /> 소리 설정
            </h3>

            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-gray-300">음량</span>
                  <span className="text-neon-cyan font-bold">{Math.round(soundVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={soundVolume}
                  onChange={handleVolumeChange}
                  className="w-full h-2 bg-dark-600 rounded-lg appearance-none cursor-pointer accent-neon-cyan"
                />
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-300">음소거</span>
                <button
                  onClick={handleToggleMute}
                  className={`px-4 py-2 rounded-lg border transition-all cursor-pointer ${
                    soundMuted
                      ? 'bg-red-500/20 border-red-500 text-red-400'
                      : 'bg-green-500/20 border-green-500 text-green-400'
                  }`}
                >
                  {soundMuted
                    ? <><Emoji emoji="🔇" size={16} className="inline-flex" /> 꺼짐</>
                    : <><Emoji emoji="🔊" size={16} className="inline-flex" /> 켜짐</>
                  }
                </button>
              </div>

              <div className="pt-4">
                <button
                  onClick={() => setShowModal(false)}
                  className="w-full py-3 bg-neon-cyan/20 hover:bg-neon-cyan/30 text-neon-cyan border border-neon-cyan/50 hover:border-neon-cyan rounded-lg transition-all cursor-pointer"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
