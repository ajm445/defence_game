import React, { useState, useCallback } from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { useAuthStore, useAuthError, useAuthIsLoading } from '../../stores/useAuthStore';
import { soundManager } from '../../services/SoundManager';
import { isSupabaseConfigured } from '../../services/supabase';

type AuthMode = 'login' | 'signup' | 'guest';

export const LoginScreen: React.FC = () => {
  const setScreen = useUIStore((state) => state.setScreen);
  const signIn = useAuthStore((state) => state.signIn);
  const signUp = useAuthStore((state) => state.signUp);
  const signInGuest = useAuthStore((state) => state.signInGuest);
  const setError = useAuthStore((state) => state.setError);
  const clearError = useAuthStore((state) => state.clearError);
  const error = useAuthError();
  const isLoading = useAuthIsLoading();

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const supabaseEnabled = isSupabaseConfigured();

  const handleModeChange = useCallback((newMode: AuthMode) => {
    soundManager.play('ui_click');
    setMode(newMode);
    clearError();
    setSuccessMessage(null);
  }, [clearError]);

  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.play('ui_click');
    clearError();

    if (!email || !password) {
      setError('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    const success = await signIn(email, password);
    if (success) {
      setScreen('menu');
    }
  }, [email, password, signIn, setScreen, setError, clearError]);

  const handleSignUp = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.play('ui_click');
    clearError();

    if (!email || !password || !nickname) {
      setError('모든 필드를 입력해주세요.');
      return;
    }

    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (password.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }

    if (nickname.length < 2 || nickname.length > 20) {
      setError('닉네임은 2~20자 사이여야 합니다.');
      return;
    }

    const result = await signUp(email, password, nickname);
    if (result.success) {
      if (result.needsEmailConfirmation) {
        setSuccessMessage('이메일로 인증 링크가 전송되었습니다. 이메일을 확인해주세요.');
        setMode('login');
      } else {
        setScreen('menu');
      }
    }
  }, [email, password, confirmPassword, nickname, signUp, setScreen, setError, clearError]);

  const handleGuestLogin = useCallback(async () => {
    soundManager.play('ui_click');
    clearError();

    const guestNickname = nickname || `모험가${Math.floor(Math.random() * 10000)}`;

    const success = await signInGuest(guestNickname);
    if (success) {
      setScreen('menu');
    }
  }, [nickname, signInGuest, setScreen, clearError]);

  const handleBack = useCallback(() => {
    soundManager.play('ui_click');
    setScreen('menu');
  }, [setScreen]);

  return (
    <div className="fixed inset-0 bg-menu-gradient grid-overlay flex flex-col items-center justify-center overflow-hidden">
      {/* 배경 효과 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
      </div>

      {/* 메인 컨텐츠 */}
      <div className="relative z-10 flex flex-col items-center animate-fade-in w-full max-w-md px-6">
        {/* 타이틀 */}
        <h1 className="font-game text-3xl md:text-4xl text-yellow-400 mb-3">
          RPG 모드
        </h1>

        <div style={{ height: '20px' }} />

        <p className="text-gray-400 text-sm mb-10">로그인하여 진행 상황을 저장하세요</p>

        <div style={{ height: '20px' }} />

        {/* 탭 버튼 */}
        {supabaseEnabled && (
          <div className="flex gap-4 mb-8 w-full">
            <button
              onClick={() => handleModeChange('login')}
              className={`flex-1 flex flex-col items-center gap-2 py-4 px-4 rounded-lg border-2 transition-all duration-300 cursor-pointer ${
                mode === 'login'
                  ? 'bg-purple-600/20 border-purple-500 text-white'
                  : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'
              }`}
            >
              <span className="text-2xl">🔑</span>
              <span className="font-bold text-sm">로그인</span>
            </button>
            <button
              onClick={() => handleModeChange('signup')}
              className={`flex-1 flex flex-col items-center gap-2 py-4 px-4 rounded-lg border-2 transition-all duration-300 cursor-pointer ${
                mode === 'signup'
                  ? 'bg-purple-600/20 border-purple-500 text-white'
                  : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'
              }`}
            >
              <span className="text-2xl">✨</span>
              <span className="font-bold text-sm">회원가입</span>
            </button>
            <button
              onClick={() => handleModeChange('guest')}
              className={`flex-1 flex flex-col items-center gap-2 py-4 px-4 rounded-lg border-2 transition-all duration-300 cursor-pointer ${
                mode === 'guest'
                  ? 'bg-gray-600/20 border-gray-500 text-white'
                  : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'
              }`}
            >
              <span className="text-2xl">👤</span>
              <span className="font-bold text-sm">게스트</span>
            </button>
          </div>
        )}

        {/* 성공 메시지 */}
        {successMessage && (
          <div className="w-full mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-md text-green-300 text-sm text-center">
            {successMessage}
          </div>
        )}

        <div style={{ height: '10px' }} />
        
        {/* 에러 메시지 */}
        {error && (
          <div className="w-full mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-md text-red-300 text-sm text-center">
            {error}
          </div>
        )}

        <div style={{ height: '20px' }} />

        {/* 로그인 폼 */}
        {supabaseEnabled && mode === 'login' && (
          <form onSubmit={handleLogin} className="w-full space-y-5">
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">이메일</label>
              <div style={{ height: '3px' }} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-4 bg-gray-800/60 border border-gray-600 rounded-md text-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
                placeholder="email@example.com"
                disabled={isLoading}
              />
            </div>

            <div style={{ height: '10px' }} />

            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">비밀번호</label>
              <div style={{ height: '3px' }} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-4 bg-gray-800/60 border border-gray-600 rounded-md text-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
                placeholder="••••••••"
                disabled={isLoading}
              />
            </div>

            <div style={{ height: '20px' }} />

            <div className="flex justify-center mt-4">
              <button
                type="submit"
                disabled={isLoading}
                className="px-16 py-3 rounded-md bg-purple-600 text-white font-medium hover:bg-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                style={{ paddingLeft: '10px', paddingRight: '10px', paddingTop: '5px', paddingBottom: '5px' }}
              >
                {isLoading ? '로그인 중...' : '로그인'}
              </button>
            </div>
          </form>
        )}

        {/* 회원가입 폼 */}
        {supabaseEnabled && mode === 'signup' && (
          <form onSubmit={handleSignUp} className="w-full space-y-5">
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">닉네임</label>
              <div style={{ height: '3px' }} />
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full px-4 py-4 bg-gray-800/60 border border-gray-600 rounded-md text-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
                placeholder="2~20자"
                maxLength={20}
                disabled={isLoading}
              />
            </div>

            <div style={{ height: '10px' }} />

            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">이메일</label>
              <div style={{ height: '3px' }} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-4 bg-gray-800/60 border border-gray-600 rounded-md text-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
                placeholder="email@example.com"
                disabled={isLoading}
              />
            </div>

            <div style={{ height: '10px' }} />

            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">비밀번호</label>
              <div style={{ height: '3px' }} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-4 bg-gray-800/60 border border-gray-600 rounded-md text-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
                placeholder="최소 6자 이상"
                disabled={isLoading}
              />
            </div>

            <div style={{ height: '10px' }} />

            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">비밀번호 확인</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-4 bg-gray-800/60 border border-gray-600 rounded-md text-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
                placeholder="비밀번호 재입력"
                disabled={isLoading}
              />
            </div>

            <div style={{ height: '20px' }} />

            <div className="flex justify-center mt-4">
              <button
                type="submit"
                disabled={isLoading}
                className="px-16 py-3 rounded-md bg-purple-600 text-white font-medium hover:bg-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                style={{ paddingLeft: '10px', paddingRight: '10px', paddingTop: '5px', paddingBottom: '5px' }}
            >
                {isLoading ? '회원가입 중...' : '회원가입'}
              </button>
            </div>
          </form>
        )}

        {/* 게스트 로그인 */}
        {(mode === 'guest' || !supabaseEnabled) && (
          <div className="w-full space-y-5">
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-md p-5">
              <p className="text-yellow-300 text-sm text-center leading-relaxed">
                ⚠️ 게스트 모드에서는 진행 상황이 저장되지 않으며,<br />
                <span className="font-bold">궁수만</span> 사용할 수 있습니다.
              </p>
            </div>

            <div style={{ height: '10px' }} />

            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">닉네임 (선택)</label>
              <div style={{ height: '3px' }} />
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full px-4 py-4 bg-gray-800/60 border border-gray-600 rounded-md text-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
                placeholder="입력하지 않으면 랜덤 생성"
                maxLength={20}
                disabled={isLoading}
              />
            </div>

            <div style={{ height: '20px' }} />

            <div className="flex justify-center mt-4">
              <button
                onClick={handleGuestLogin}
                disabled={isLoading}
                className="px-12 py-3 rounded-md bg-gray-600 text-white font-medium hover:bg-gray-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                style={{ paddingLeft: '10px', paddingRight: '10px', paddingTop: '5px', paddingBottom: '5px' }}
              >
                {isLoading ? '로그인 중...' : '게스트로 시작'}
              </button>
            </div>
          </div>
        )}

        <div style={{ height: '10px' }} />

        {/* 뒤로 가기 */}
        <button
          onClick={handleBack}
          className="mt-10 px-10 py-3 rounded-md border border-gray-600 text-gray-400 font-medium hover:border-gray-400 hover:text-white hover:bg-gray-800/30 transition-all cursor-pointer"
          style={{ paddingLeft: '10px', paddingRight: '10px', paddingTop: '5px', paddingBottom: '5px' }}
        >
          뒤로 가기
        </button>
      </div>

      {/* 코너 장식 */}
      <div className="absolute top-4 left-4 w-16 h-16 border-l-2 border-t-2 border-purple-500/30" />
      <div className="absolute top-4 right-4 w-16 h-16 border-r-2 border-t-2 border-purple-500/30" />
      <div className="absolute bottom-4 left-4 w-16 h-16 border-l-2 border-b-2 border-purple-500/30" />
      <div className="absolute bottom-4 right-4 w-16 h-16 border-r-2 border-b-2 border-purple-500/30" />
    </div>
  );
};
