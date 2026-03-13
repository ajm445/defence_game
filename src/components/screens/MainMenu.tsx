import React, { useEffect, useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { useAuthStore, useAuthProfile, useAuthStatus, useAuthIsGuest } from '../../stores/useAuthStore';
import { soundManager } from '../../services/SoundManager';
import { FeedbackModal } from '../ui/FeedbackModal';
import { getMyFeedback } from '../../services/feedbackService';
import { Emoji } from '../common/Emoji';
import { SoundSettingsButton } from '../ui/SoundSettingsButton';

export const MainMenu: React.FC = () => {
  const setScreen = useUIStore((state) => state.setScreen);
  const authStatus = useAuthStatus();
  const profile = useAuthProfile();
  const isGuest = useAuthIsGuest();
  const signOut = useAuthStore((state) => state.signOut);
  const soundVolume = useUIStore((state) => state.soundVolume);
  const soundMuted = useUIStore((state) => state.soundMuted);
  const isMobile = useUIStore((s) => s.isMobile);
  const isTablet = useUIStore((s) => s.isTablet);

  const [showFeedback, setShowFeedback] = useState(false);
  const [hasFeedback, setHasFeedback] = useState(false);

  const isAuthenticated = authStatus === 'authenticated' && profile;

  // 앱 시작 시 사운드 설정 동기화
  useEffect(() => {
    soundManager.setVolume(soundVolume);
    soundManager.setBGMVolume(soundVolume); // BGM도 마스터 볼륨과 동기화
    soundManager.setMuted(soundMuted);
  }, [soundVolume, soundMuted]);

  // 메인 메뉴 BGM 재생 (이전 화면의 cleanup보다 늦게 실행되도록 딜레이)
  useEffect(() => {
    soundManager.init();
    const timer = setTimeout(() => {
      soundManager.playBGM('rpg_main');
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // 피드백 작성 여부 확인 (로그인 + 비게스트만)
  useEffect(() => {
    if (isAuthenticated && !isGuest && profile) {
      getMyFeedback(profile.id).then((feedback) => {
        setHasFeedback(feedback !== null);
      });
    }
  }, [isAuthenticated, isGuest, profile]);

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
              {/* 프로필 버튼 - 게스트는 비활성화 */}
              <button
                onClick={isGuest ? undefined : handleProfile}
                disabled={isGuest}
                className={`group relative py-4 rounded-lg overflow-hidden transition-all duration-300 ${
                  isGuest
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:scale-105 active:scale-95 cursor-pointer'
                }`}
                style={{ paddingLeft: '25px', paddingRight: '25px', paddingTop: '10px', paddingBottom: '10px' }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 group-hover:from-yellow-500/30 group-hover:to-orange-500/30 transition-all duration-300 pointer-events-none" />
                <div className="absolute inset-0 border border-yellow-500/50 rounded-lg group-hover:border-yellow-400 group-hover:shadow-[0_0_10px_rgba(234,179,8,0.3)] transition-all duration-300 pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 group-hover:animate-[scanline_2s_linear_infinite] pointer-events-none" />
                <div className="relative flex items-center justify-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center text-xs">
                    {profile.isGuest ? <Emoji emoji="👤" size={16} /> : <Emoji emoji="⭐" size={16} />}
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
      <div className="absolute top-6 right-6 z-20 flex gap-3">
        {/* 피드백 버튼 - 비게스트 + 미작성 + 레벨5 이상만 */}
        {isAuthenticated && !isGuest && !hasFeedback && profile.playerLevel >= 5 && (
          <button
            onClick={() => { soundManager.play('ui_click'); setShowFeedback(true); }}
            className="w-12 h-12 rounded-full bg-dark-700/80 border border-gray-600 hover:border-neon-cyan hover:bg-dark-600/80 transition-all duration-300 flex items-center justify-center cursor-pointer group"
            title="게임 피드백"
          >
            <span className="group-hover:scale-110 transition-transform duration-300"><Emoji emoji="📝" size={24} /></span>
          </button>
        )}
        {/* 소리 설정 버튼 */}
        <SoundSettingsButton />
      </div>

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
