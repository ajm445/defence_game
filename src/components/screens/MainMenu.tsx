import React, { useEffect, useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { useAuthStore, useAuthProfile, useAuthStatus, useAuthIsGuest } from '../../stores/useAuthStore';
import { soundManager } from '../../services/SoundManager';
import { FeedbackModal } from '../ui/FeedbackModal';
import { getMyFeedback } from '../../services/feedbackService';

export const MainMenu: React.FC = () => {
  const setScreen = useUIStore((state) => state.setScreen);
  const authStatus = useAuthStatus();
  const profile = useAuthProfile();
  const isGuest = useAuthIsGuest();
  const signOut = useAuthStore((state) => state.signOut);
  const saveSoundSettings = useAuthStore((state) => state.saveSoundSettings);
  const changePassword = useAuthStore((state) => state.changePassword);
  const deleteAccount = useAuthStore((state) => state.deleteAccount);
  const soundVolume = useUIStore((state) => state.soundVolume);
  const soundMuted = useUIStore((state) => state.soundMuted);
  const setSoundVolume = useUIStore((state) => state.setSoundVolume);
  const setSoundMuted = useUIStore((state) => state.setSoundMuted);
  const isMobile = useUIStore((s) => s.isMobile);
  const isTablet = useUIStore((s) => s.isTablet);

  const [showSettings, setShowSettings] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [hasFeedback, setHasFeedback] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'sound' | 'profile' | 'danger'>('sound');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);

  const isAuthenticated = authStatus === 'authenticated' && profile;

  // 앱 시작 시 사운드 설정 동기화
  useEffect(() => {
    soundManager.setVolume(soundVolume);
    soundManager.setBGMVolume(soundVolume); // BGM도 마스터 볼륨과 동기화
    soundManager.setMuted(soundMuted);
  }, [soundVolume, soundMuted]);

  // 메인 메뉴 BGM 재생
  useEffect(() => {
    soundManager.init();
    soundManager.playBGM('rpg_main');
  }, []);

  // 피드백 작성 여부 확인 (로그인 + 비게스트만)
  useEffect(() => {
    if (isAuthenticated && !isGuest && profile) {
      getMyFeedback(profile.id).then((feedback) => {
        setHasFeedback(feedback !== null);
      });
    }
  }, [isAuthenticated, isGuest, profile]);

  // 설정 모달 ESC 키로 닫기
  useEffect(() => {
    if (!showSettings) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowSettings(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSettings]);

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

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setSoundVolume(newVolume);
    soundManager.setVolume(newVolume);
    soundManager.setBGMVolume(newVolume); // BGM도 동기화
    // 설정 저장 (로그인 사용자: DB, 게스트: localStorage)
    saveSoundSettings(newVolume, soundMuted);
  };

  const handleToggleMute = () => {
    const newMuted = !soundMuted;
    setSoundMuted(newMuted);
    soundManager.setMuted(newMuted);
    // 설정 저장 (로그인 사용자: DB, 게스트: localStorage)
    saveSoundSettings(soundVolume, newMuted);
    if (!newMuted) {
      soundManager.play('ui_click');
    }
  };

  const handleSaveSettings = async () => {
    soundManager.play('ui_click');
    await saveSoundSettings(soundVolume, soundMuted);
    setShowSettings(false);
  };

  const handleOpenSettings = () => {
    soundManager.init();
    soundManager.play('ui_click');
    setSettingsTab('sound');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setSettingsError(null);
    setSettingsSuccess(null);
    setShowDeleteConfirm(false);
    setShowSettings(true);
  };

  const handleCloseSettings = () => {
    setShowSettings(false);
    setSettingsError(null);
    setSettingsSuccess(null);
    setShowDeleteConfirm(false);
  };

  const handleChangePassword = async () => {
    if (!currentPassword) {
      setSettingsError('현재 비밀번호를 입력해주세요.');
      return;
    }
    if (!newPassword) {
      setSettingsError('새 비밀번호를 입력해주세요.');
      return;
    }
    if (newPassword.length < 6) {
      setSettingsError('새 비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setSettingsError('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    if (currentPassword === newPassword) {
      setSettingsError('현재 비밀번호와 다른 비밀번호를 입력해주세요.');
      return;
    }

    soundManager.play('ui_click');
    const result = await changePassword(currentPassword, newPassword);
    if (result.success) {
      setSettingsSuccess('비밀번호가 변경되었습니다.');
      setSettingsError(null);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setSettingsError(result.error || '비밀번호 변경에 실패했습니다.');
    }
  };

  const handleDeleteAccount = async () => {
    soundManager.play('ui_click');
    const result = await deleteAccount();
    if (result.success) {
      setShowSettings(false);
      setScreen('menu');
    } else {
      setSettingsError(result.error || '회원 탈퇴에 실패했습니다.');
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden" style={{ background: `linear-gradient(to bottom, rgba(10,15,30,0.45), rgba(10,15,30,0.65)), url('/img/units/background.png') center/cover no-repeat` }}>
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
        <div className="text-gray-400 text-xs tracking-widest">
          버튼을 눌러 시작하세요
        </div>
        <div className="text-gray-600 text-[10px] mt-1">
          © 2026 제작자. All Rights Reserved.
        </div>
      </div>

      {/* 우측 상단 버튼 그룹 */}
      {isAuthenticated && (
        <div className="absolute top-6 right-6 z-20 flex gap-3">
          {/* 피드백 버튼 - 비게스트 + 미작성 + 레벨5 이상만 */}
          {!isGuest && !hasFeedback && profile.playerLevel >= 5 && (
            <button
              onClick={() => { soundManager.play('ui_click'); setShowFeedback(true); }}
              className="w-12 h-12 rounded-full bg-dark-700/80 border border-gray-600 hover:border-neon-cyan hover:bg-dark-600/80 transition-all duration-300 flex items-center justify-center cursor-pointer group"
              title="게임 피드백"
            >
              <span className="text-2xl group-hover:scale-110 transition-transform duration-300">📝</span>
            </button>
          )}
          {/* 설정 버튼 */}
          <button
            onClick={handleOpenSettings}
            className="w-12 h-12 rounded-full bg-dark-700/80 border border-gray-600 hover:border-yellow-500 hover:bg-dark-600/80 transition-all duration-300 flex items-center justify-center cursor-pointer group"
          >
            <span className="text-2xl group-hover:rotate-90 transition-transform duration-300">⚙️</span>
          </button>
        </div>
      )}

      {/* 피드백 모달 */}
      {isAuthenticated && !isGuest && profile && (
        <FeedbackModal
          isOpen={showFeedback}
          onClose={() => setShowFeedback(false)}
          onSubmitted={(expRewarded) => {
            setHasFeedback(true);
            if (expRewarded > 0) {
              const currentProfile = useAuthStore.getState().profile;
              if (currentProfile) {
                let newExp = currentProfile.playerExp + expRewarded;
                let newLevel = currentProfile.playerLevel;
                while (newExp >= newLevel * 100) {
                  newExp -= newLevel * 100;
                  newLevel++;
                }
                useAuthStore.getState().updateLocalProfile({ playerExp: newExp, playerLevel: newLevel });
              }
            }
          }}
          playerId={profile.id}
        />
      )}

      {/* 설정 패널 */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 flex items-center justify-center">
          <div className="bg-dark-800/95 rounded-xl p-6 border border-gray-600 min-w-[380px] max-w-[420px] animate-fade-in">
            <h3 className="text-white font-bold text-xl mb-4 text-center">⚙️ 설정</h3>

            {/* 탭 버튼 - 일반 회원만 표시 */}
            {!isGuest && (
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => { setSettingsTab('sound'); setSettingsError(null); setSettingsSuccess(null); }}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm transition-all cursor-pointer ${
                    settingsTab === 'sound'
                      ? 'bg-neon-cyan/20 border border-neon-cyan text-neon-cyan'
                      : 'bg-dark-600 border border-gray-600 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  🔊 소리
                </button>
                <button
                  onClick={() => { setSettingsTab('profile'); setSettingsError(null); setSettingsSuccess(null); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm transition-all cursor-pointer ${
                    settingsTab === 'profile'
                      ? 'bg-yellow-500/20 border border-yellow-500 text-yellow-400'
                      : 'bg-dark-600 border border-gray-600 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  🔒 보안
                </button>
                <button
                  onClick={() => { setSettingsTab('danger'); setSettingsError(null); setSettingsSuccess(null); setShowDeleteConfirm(false); }}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm transition-all cursor-pointer ${
                    settingsTab === 'danger'
                      ? 'bg-red-500/20 border border-red-500 text-red-400'
                      : 'bg-dark-600 border border-gray-600 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  ⚠️ 계정
                </button>
              </div>
            )}

            {/* 에러/성공 메시지 */}
            {settingsError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm text-center">{settingsError}</p>
              </div>
            )}
            {settingsSuccess && (
              <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <p className="text-green-400 text-sm text-center">{settingsSuccess}</p>
              </div>
            )}

            {/* 소리 설정 탭 - 게스트는 항상 이 탭만 표시 */}
            {(settingsTab === 'sound' || isGuest) && (
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
                    {soundMuted ? '🔇 꺼짐' : '🔊 켜짐'}
                  </button>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    onClick={handleCloseSettings}
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
              </div>
            )}

            {/* 보안 설정 탭 (비밀번호 변경) - 일반 회원만 */}
            {settingsTab === 'profile' && !isGuest && (
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-300 mb-2">현재 비밀번호</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="현재 비밀번호 입력..."
                    className="w-full px-4 py-3 bg-dark-600 border border-gray-600 rounded-lg text-white focus:border-yellow-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-2">새 비밀번호</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="새 비밀번호 입력 (6자 이상)..."
                    className="w-full px-4 py-3 bg-dark-600 border border-gray-600 rounded-lg text-white focus:border-yellow-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-2">새 비밀번호 확인</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="새 비밀번호 다시 입력..."
                    className="w-full px-4 py-3 bg-dark-600 border border-gray-600 rounded-lg text-white focus:border-yellow-500 focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    onClick={handleCloseSettings}
                    className="flex-1 py-3 bg-dark-600 hover:bg-dark-500 text-gray-300 rounded-lg transition-colors cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleChangePassword}
                    className="flex-1 py-3 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border border-yellow-500/50 hover:border-yellow-500 rounded-lg transition-all cursor-pointer"
                  >
                    변경
                  </button>
                </div>
              </div>
            )}

            {/* 계정 설정 탭 (위험) - 일반 회원만 */}
            {settingsTab === 'danger' && !isGuest && (
              <div className="space-y-6">
                {!showDeleteConfirm ? (
                  <>
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <h4 className="text-red-400 font-bold mb-2">⚠️ 회원 탈퇴</h4>
                      <p className="text-gray-400 text-sm">
                        계정을 삭제하면 모든 게임 데이터(레벨, 통계, 진행 상황)가 영구적으로 삭제됩니다.
                      </p>
                    </div>

                    <div className="pt-4 flex gap-3">
                      <button
                        onClick={handleCloseSettings}
                        className="flex-1 py-3 bg-dark-600 hover:bg-dark-500 text-gray-300 rounded-lg transition-colors cursor-pointer"
                      >
                        닫기
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="flex-1 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 hover:border-red-500 rounded-lg transition-all cursor-pointer"
                      >
                        회원 탈퇴
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-4 bg-red-500/20 border border-red-500 rounded-lg">
                      <h4 className="text-red-400 font-bold mb-2 text-center">정말 탈퇴하시겠습니까?</h4>
                      <p className="text-gray-300 text-sm text-center">
                        이 작업은 되돌릴 수 없습니다.
                      </p>
                    </div>

                    <div className="pt-4 flex gap-3">
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 py-3 bg-dark-600 hover:bg-dark-500 text-gray-300 rounded-lg transition-colors cursor-pointer"
                      >
                        취소
                      </button>
                      <button
                        onClick={handleDeleteAccount}
                        className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all cursor-pointer"
                      >
                        확인, 탈퇴합니다
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 코너 장식 */}
      {!isMobile && !isTablet && (<>
        <div className="absolute top-4 left-4 w-16 h-16 border-l-2 border-t-2 border-neon-cyan/30" />
        <div className="absolute top-4 right-4 w-16 h-16 border-r-2 border-t-2 border-neon-cyan/30" />
        <div className="absolute bottom-4 left-4 w-16 h-16 border-l-2 border-b-2 border-neon-cyan/30" />
        <div className="absolute bottom-4 right-4 w-16 h-16 border-r-2 border-b-2 border-neon-cyan/30" />
      </>)}
    </div>
  );
};
