import React, { useEffect, useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { useAuthStore, useAuthProfile, useAuthStatus } from '../../stores/useAuthStore';
import { soundManager } from '../../services/SoundManager';

export const MainMenu: React.FC = () => {
  const setScreen = useUIStore((state) => state.setScreen);
  const authStatus = useAuthStatus();
  const profile = useAuthProfile();
  const signOut = useAuthStore((state) => state.signOut);
  const saveSoundSettings = useAuthStore((state) => state.saveSoundSettings);
  const soundVolume = useUIStore((state) => state.soundVolume);
  const soundMuted = useUIStore((state) => state.soundMuted);
  const setSoundVolume = useUIStore((state) => state.setSoundVolume);
  const setSoundMuted = useUIStore((state) => state.setSoundMuted);

  const [showSettings, setShowSettings] = useState(false);

  // 앱 시작 시 사운드 설정 동기화
  useEffect(() => {
    soundManager.setVolume(soundVolume);
    soundManager.setMuted(soundMuted);
  }, [soundVolume, soundMuted]);

  const handleStartGame = () => {
    soundManager.init();
    soundManager.play('ui_click');
    setScreen('gameTypeSelect');
  };

  const handleLogin = () => {
    soundManager.init();
    soundManager.play('ui_click');
    setScreen('login');
  };

  const handleProfile = () => {
    soundManager.init();
    soundManager.play('ui_click');
    setScreen('profile');
  };

  const handleLogout = async () => {
    soundManager.init();
    soundManager.play('ui_click');
    await signOut();
  };

  const handleToggleSettings = () => {
    soundManager.init();
    soundManager.play('ui_click');
    setShowSettings(!showSettings);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setSoundVolume(newVolume);
    soundManager.setVolume(newVolume);
  };

  const handleToggleMute = () => {
    const newMuted = !soundMuted;
    setSoundMuted(newMuted);
    soundManager.setMuted(newMuted);
    if (!newMuted) {
      soundManager.play('ui_click');
    }
  };

  const handleSaveSettings = async () => {
    soundManager.play('ui_click');
    await saveSoundSettings(soundVolume, soundMuted);
    setShowSettings(false);
  };

  const isAuthenticated = authStatus === 'authenticated' && profile;

  return (
    <div className="fixed inset-0 bg-menu-gradient grid-overlay flex flex-col items-center justify-center overflow-hidden">
      {/* 배경 효과 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* 움직이는 원형 글로우 */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-neon-cyan/5 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-neon-purple/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-neon-blue/3 rounded-full blur-3xl" />
      </div>

      {/* 메인 컨텐츠 */}
      <div className="relative z-10 flex flex-col items-center animate-fade-in">
        {/* 서브 타이틀 */}
        <div className="text-neon-cyan/70 text-sm tracking-[0.5em] uppercase font-game">
          Defense Strategy
        </div>

        {/* 간격 */}
        <div style={{ height: '30px' }} />

        {/* 메인 타이틀 */}
        <div className="relative mb-2">
          <h1 className="font-game text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-white via-neon-cyan to-neon-blue animate-float">
            막아라! 무너트려라!
          </h1>
          {/* 타이틀 글로우 효과 */}
          <div className="absolute inset-0 font-game text-4xl md:text-5xl font-bold text-neon-cyan/20 blur-2xl pointer-events-none flex items-center justify-center">
            막아라! 무너트려라!
          </div>
        </div>

        <div style={{ height: '10px' }} />

        {/* 구분선 */}
        <div className="w-64 h-px bg-gradient-to-r from-transparent via-neon-cyan/50 to-transparent my-8" />

        <div style={{ height: '30px' }} />

        {/* 버튼 그룹 */}
        <div className="flex flex-col gap-4 mt-4">
          {/* 게임 시작 버튼 */}
          <button
            onClick={handleStartGame}
            className="group relative py-4 rounded-lg overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
            style={{ paddingLeft: '25px', paddingRight: '25px', paddingTop: '10px', paddingBottom: '10px' }}
          >
            {/* 버튼 배경 */}
            <div className="absolute inset-0 bg-gradient-to-r from-neon-cyan/20 to-neon-blue/20 group-hover:from-neon-cyan/30 group-hover:to-neon-blue/30 transition-all duration-300 pointer-events-none" />
            <div className="absolute inset-0 border border-neon-cyan/50 rounded-lg group-hover:border-neon-cyan group-hover:shadow-neon-cyan transition-all duration-300 pointer-events-none" />

            {/* 스캔라인 효과 */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 group-hover:animate-[scanline_2s_linear_infinite] pointer-events-none" />

            {/* 버튼 텍스트 */}
            <span className="relative font-game text-xl tracking-wider text-neon-cyan group-hover:text-white transition-colors duration-300">
              게임 시작
            </span>
          </button>

          {/* 로그인 상태에 따른 버튼 */}
          {isAuthenticated ? (
            <>
              {/* 프로필 버튼 */}
              <button
                onClick={handleProfile}
                className="group relative py-4 rounded-lg overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
                style={{ paddingLeft: '25px', paddingRight: '25px', paddingTop: '10px', paddingBottom: '10px' }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 group-hover:from-yellow-500/30 group-hover:to-orange-500/30 transition-all duration-300 pointer-events-none" />
                <div className="absolute inset-0 border border-yellow-500/50 rounded-lg group-hover:border-yellow-400 group-hover:shadow-[0_0_10px_rgba(234,179,8,0.3)] transition-all duration-300 pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 group-hover:animate-[scanline_2s_linear_infinite] pointer-events-none" />
                <div className="relative flex items-center justify-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center text-xs">
                    {profile.isGuest ? '👤' : '⭐'}
                  </div>
                  <span className="font-game text-xl tracking-wider text-yellow-400 group-hover:text-white transition-colors duration-300">
                    {profile.nickname}
                  </span>
                  <span className="text-yellow-500/70 text-sm">Lv.{profile.playerLevel}</span>
                  {profile.isGuest && (
                    <span className="px-2 py-0.5 bg-gray-700/50 rounded text-xs text-gray-400">
                      게스트
                    </span>
                  )}
                </div>
              </button>

              {/* 로그아웃 버튼 */}
              <button
                onClick={handleLogout}
                className="group relative px-12 py-3 rounded-lg overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
                style={{ paddingLeft: '25px', paddingRight: '25px', paddingTop: '10px', paddingBottom: '10px' }}
              >
                <div className="absolute inset-0 bg-dark-700/50 group-hover:bg-red-900/30 transition-all duration-300 pointer-events-none" />
                <div className="absolute inset-0 border border-dark-400 rounded-lg group-hover:border-red-500/50 transition-all duration-300 pointer-events-none" />
                <span className="relative font-korean text-lg text-gray-400 group-hover:text-red-400 transition-colors duration-300">
                  로그아웃
                </span>
              </button>
            </>
          ) : (
            <>
              {/* 로그인 버튼 */}
              <button
                onClick={handleLogin}
                className="group relative py-4 rounded-lg overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
                style={{ paddingLeft: '25px', paddingRight: '25px', paddingTop: '10px', paddingBottom: '10px' }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-purple-600/20 group-hover:from-purple-500/30 group-hover:to-purple-600/30 transition-all duration-300 pointer-events-none" />
                <div className="absolute inset-0 border border-purple-500/50 rounded-lg group-hover:border-purple-400 group-hover:shadow-[0_0_10px_rgba(168,85,247,0.3)] transition-all duration-300 pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 group-hover:animate-[scanline_2s_linear_infinite] pointer-events-none" />
                <span className="relative font-game text-xl tracking-wider text-purple-400 group-hover:text-white transition-colors duration-300">
                  로그인
                </span>
              </button>

              {/* 회원가입 버튼 */}
              <button
                onClick={handleLogin}
                className="group relative px-12 py-3 rounded-lg overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
                style={{ paddingLeft: '25px', paddingRight: '25px', paddingTop: '10px', paddingBottom: '10px' }}
              >
                <div className="absolute inset-0 bg-dark-700/50 group-hover:bg-dark-600/50 transition-all duration-300 pointer-events-none" />
                <div className="absolute inset-0 border border-dark-400 rounded-lg group-hover:border-gray-500 transition-all duration-300 pointer-events-none" />
                <span className="relative font-korean text-lg text-gray-400 group-hover:text-white transition-colors duration-300">
                  회원가입
                </span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 하단 정보 - 메인 컨테이너 기준으로 배치 */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none z-10">
        <div className="text-gray-400 text-xs tracking-widest uppercase">
          Press a button to start
        </div>
        <div className="flex items-center gap-4 text-gray-500 text-xs">
          <span>WASD - Move Camera</span>
          <span className="w-1 h-1 rounded-full bg-gray-500" />
          <span>SPACE - Home Base</span>
          <span className="w-1 h-1 rounded-full bg-gray-500" />
          <span>ESC - Menu</span>
        </div>
      </div>

      {/* 설정 버튼 (우측 상단) */}
      <button
        onClick={handleToggleSettings}
        className="absolute top-6 right-6 z-20 w-12 h-12 rounded-full bg-dark-700/80 border border-gray-600 hover:border-yellow-500 hover:bg-dark-600/80 transition-all duration-300 flex items-center justify-center cursor-pointer group"
      >
        <span className="text-2xl group-hover:rotate-90 transition-transform duration-300">⚙️</span>
      </button>

      {/* 설정 패널 */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 flex items-center justify-center">
          <div className="bg-dark-800/95 rounded-xl p-6 border border-gray-600 min-w-[320px] animate-fade-in">
            <h3 className="text-white font-bold text-xl mb-6 text-center">⚙️ 설정</h3>

            {/* 음량 조절 */}
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

              {/* 음소거 토글 */}
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
                  {soundMuted ? '🔇 꺼짐' : '🔊 켜짐'}
                </button>
              </div>
            </div>

            {/* 버튼들 */}
            <div className="mt-8 flex gap-3">
              <button
                onClick={() => setShowSettings(false)}
                className="flex-1 py-3 bg-dark-600 hover:bg-dark-500 text-gray-300 rounded-lg transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={handleSaveSettings}
                className="flex-1 py-3 bg-neon-cyan/20 hover:bg-neon-cyan/30 text-neon-cyan border border-neon-cyan/50 hover:border-neon-cyan rounded-lg transition-all cursor-pointer"
              >
                저장
              </button>
            </div>

            {/* 로그인 안내 (비로그인 시) */}
            {!isAuthenticated && (
              <p className="mt-4 text-xs text-gray-500 text-center">
                로그인하면 설정이 계정에 저장됩니다.
              </p>
            )}
          </div>
        </div>
      )}

      {/* 코너 장식 */}
      <div className="absolute top-4 left-4 w-16 h-16 border-l-2 border-t-2 border-neon-cyan/30" />
      <div className="absolute top-4 right-4 w-16 h-16 border-r-2 border-t-2 border-neon-cyan/30" />
      <div className="absolute bottom-4 left-4 w-16 h-16 border-l-2 border-b-2 border-neon-cyan/30" />
      <div className="absolute bottom-4 right-4 w-16 h-16 border-r-2 border-b-2 border-neon-cyan/30" />
    </div>
  );
};
