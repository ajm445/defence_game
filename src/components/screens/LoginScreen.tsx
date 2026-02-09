import React, { useState, useCallback } from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { useAuthStore, useAuthError, useAuthIsLoading } from '../../stores/useAuthStore';
import { soundManager } from '../../services/SoundManager';

type AuthMode = 'login' | 'signup' | 'guest';

// API 설정 확인 (VITE_API_URL이 설정되어 있으면 인증 기능 사용 가능)
const isApiConfigured = (): boolean => {
  return Boolean(import.meta.env.VITE_API_URL) || true; // 기본값이 localhost:8080이므로 항상 true
};

// 아이디를 내부 이메일 형식으로 변환
const usernameToEmail = (username: string): string => {
  return `${username.toLowerCase()}@defence.game`;
};

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
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const apiEnabled = isApiConfigured();

  const handleModeChange = useCallback((newMode: AuthMode) => {
    soundManager.init();
    soundManager.play('ui_click');
    setMode(newMode);
    clearError();
    setSuccessMessage(null);
  }, [clearError]);

  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.init();
    soundManager.play('ui_click');
    clearError();

    if (!username || !password) {
      setError('아이디와 비밀번호를 입력해주세요.');
      return;
    }

    const email = usernameToEmail(username);
    const success = await signIn(email, password);
    if (success) {
      setScreen('menu');
    }
  }, [username, password, signIn, setScreen, setError, clearError]);

  const handleSignUp = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.init();
    soundManager.play('ui_click');
    clearError();

    if (!username || !password || !nickname) {
      setError('모든 필드를 입력해주세요.');
      return;
    }

    // 아이디 유효성 검사
    if (username.length < 4 || username.length > 20) {
      setError('아이디는 4~20자 사이여야 합니다.');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError('아이디는 영문, 숫자, 밑줄(_)만 사용할 수 있습니다.');
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

    const email = usernameToEmail(username);
    const result = await signUp(email, password, nickname);
    if (result.success) {
      if (result.needsEmailConfirmation) {
        // 이메일 인증이 필요한 경우에도 바로 로그인 가능하도록 안내
        setSuccessMessage('회원가입이 완료되었습니다. 로그인해주세요.');
        setMode('login');
      } else {
        setScreen('menu');
      }
    }
  }, [username, password, confirmPassword, nickname, signUp, setScreen, setError, clearError]);

  const handleGuestLogin = useCallback(async () => {
    soundManager.init();
    soundManager.play('ui_click');
    clearError();

    const guestNickname = nickname || `모험가${Math.floor(Math.random() * 10000)}`;

    const success = await signInGuest(guestNickname);
    if (success) {
      setScreen('menu');
    }
  }, [nickname, signInGuest, setScreen, clearError]);

  const handleBack = useCallback(() => {
    soundManager.init();
    soundManager.play('ui_click');
    setScreen('menu');
  }, [setScreen]);

  return (
    <div className="fixed inset-0 bg-menu-gradient grid-overlay flex flex-col items-center justify-center overflow-hidden">
      {/* 배경 효과 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[min(24rem,50vw)] h-[min(24rem,50vw)] bg-purple-500/5 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-[min(24rem,50vw)] h-[min(24rem,50vw)] bg-cyan-500/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
      </div>

      {/* 메인 컨텐츠 */}
      <div className="relative z-10 flex flex-col items-center animate-fade-in w-[min(90vw,28rem)] px-[3vw]">
        {/* 타이틀 */}
        <h1 className="font-game text-yellow-400 mb-[0.5vh] text-center" style={{ fontSize: 'clamp(1.25rem, 4vw, 2.25rem)' }}>
          막아라! 무너트려라!
        </h1>

        <div style={{ height: '2vh' }} />

        <p className="text-gray-400 mb-[2vh] text-center" style={{ fontSize: 'clamp(0.75rem, 2vw, 0.875rem)' }}>로그인하여 진행 상황을 저장하세요</p>

        <div style={{ height: '2vh' }} />

        {/* 탭 버튼 */}
        {apiEnabled && (
          <div className="flex gap-[2vw] mb-[2vh] w-full">
            <button
              onClick={() => handleModeChange('login')}
              className={`flex-1 flex flex-col items-center rounded-lg border-2 transition-all duration-300 cursor-pointer ${
                mode === 'login'
                  ? 'bg-purple-600/20 border-purple-500 text-white'
                  : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'
              }`}
              style={{ gap: 'clamp(0.25rem, 1vw, 0.5rem)', padding: 'clamp(0.5rem, 2vw, 1rem)' }}
            >
              <span style={{ fontSize: 'clamp(1rem, 3vw, 1.5rem)' }}>🔑</span>
              <span className="font-bold" style={{ fontSize: 'clamp(0.625rem, 1.5vw, 0.875rem)' }}>로그인</span>
            </button>
            <button
              onClick={() => handleModeChange('signup')}
              className={`flex-1 flex flex-col items-center rounded-lg border-2 transition-all duration-300 cursor-pointer ${
                mode === 'signup'
                  ? 'bg-purple-600/20 border-purple-500 text-white'
                  : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'
              }`}
              style={{ gap: 'clamp(0.25rem, 1vw, 0.5rem)', padding: 'clamp(0.5rem, 2vw, 1rem)' }}
            >
              <span style={{ fontSize: 'clamp(1rem, 3vw, 1.5rem)' }}>✨</span>
              <span className="font-bold" style={{ fontSize: 'clamp(0.625rem, 1.5vw, 0.875rem)' }}>회원가입</span>
            </button>
            <button
              onClick={() => handleModeChange('guest')}
              className={`flex-1 flex flex-col items-center rounded-lg border-2 transition-all duration-300 cursor-pointer ${
                mode === 'guest'
                  ? 'bg-gray-600/20 border-gray-500 text-white'
                  : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'
              }`}
              style={{ gap: 'clamp(0.25rem, 1vw, 0.5rem)', padding: 'clamp(0.5rem, 2vw, 1rem)' }}
            >
              <span style={{ fontSize: 'clamp(1rem, 3vw, 1.5rem)' }}>👤</span>
              <span className="font-bold" style={{ fontSize: 'clamp(0.625rem, 1.5vw, 0.875rem)' }}>게스트</span>
            </button>
          </div>
        )}

        {/* 성공 메시지 */}
        {successMessage && (
          <div className="w-full mb-[1.5vh] bg-green-500/20 border border-green-500/50 rounded-md text-green-300 text-center" style={{ padding: 'clamp(0.5rem, 2vw, 1rem)', fontSize: 'clamp(0.7rem, 1.8vw, 0.875rem)' }}>
            {successMessage}
          </div>
        )}

        <div style={{ height: '1vh' }} />

        {/* 에러 메시지 */}
        {error && (
          <div className="w-full mb-[1.5vh] bg-red-500/20 border border-red-500/50 rounded-md text-red-300 text-center" style={{ padding: 'clamp(0.5rem, 2vw, 1rem)', fontSize: 'clamp(0.7rem, 1.8vw, 0.875rem)' }}>
            {error}
          </div>
        )}

        <div style={{ height: '2vh' }} />

        {/* 로그인 폼 */}
        {apiEnabled && mode === 'login' && (
          <form onSubmit={handleLogin} className="w-full" style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(0.75rem, 2vh, 1.25rem)' }}>
            <div>
              <label className="block text-gray-300 font-medium" style={{ fontSize: 'clamp(0.7rem, 1.8vw, 0.875rem)', marginBottom: 'clamp(0.25rem, 0.5vh, 0.5rem)' }}>아이디</label>
              <div style={{ height: '0.5vh' }} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-gray-800/60 border border-gray-600 rounded-md text-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
                style={{ padding: 'clamp(0.5rem, 1.5vw, 1rem)', fontSize: 'clamp(0.75rem, 2vw, 1rem)' }}
                placeholder="아이디 입력"
                disabled={isLoading}
              />
            </div>

            <div style={{ height: '1vh' }} />

            <div>
              <label className="block text-gray-300 font-medium" style={{ fontSize: 'clamp(0.7rem, 1.8vw, 0.875rem)', marginBottom: 'clamp(0.25rem, 0.5vh, 0.5rem)' }}>비밀번호</label>
              <div style={{ height: '0.5vh' }} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-800/60 border border-gray-600 rounded-md text-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
                style={{ padding: 'clamp(0.5rem, 1.5vw, 1rem)', fontSize: 'clamp(0.75rem, 2vw, 1rem)' }}
                placeholder="••••••••"
                disabled={isLoading}
              />
            </div>

            <div style={{ height: '2vh' }} />

            <div className="flex justify-center">
              <button
                type="submit"
                disabled={isLoading}
                className="rounded-md bg-purple-600 text-white font-medium hover:bg-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                style={{ padding: 'clamp(0.4rem, 1.2vw, 0.75rem) clamp(1.5rem, 5vw, 4rem)', fontSize: 'clamp(0.75rem, 2vw, 1rem)' }}
              >
                {isLoading ? '로그인 중...' : '로그인'}
              </button>
            </div>
          </form>
        )}

        {/* 회원가입 폼 */}
        {apiEnabled && mode === 'signup' && (
          <form onSubmit={handleSignUp} className="w-full" style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(0.5rem, 1.5vh, 1rem)' }}>
            <div>
              <label className="block text-gray-300 font-medium" style={{ fontSize: 'clamp(0.7rem, 1.8vw, 0.875rem)', marginBottom: 'clamp(0.25rem, 0.5vh, 0.5rem)' }}>아이디</label>
              <div style={{ height: '0.5vh' }} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-gray-800/60 border border-gray-600 rounded-md text-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
                style={{ padding: 'clamp(0.4rem, 1.2vw, 0.75rem)', fontSize: 'clamp(0.7rem, 1.8vw, 0.875rem)' }}
                placeholder="4~20자, 영문/숫자/밑줄"
                maxLength={20}
                disabled={isLoading}
              />
            </div>

            <div style={{ height: '0.75vh' }} />

            <div>
              <label className="block text-gray-300 font-medium" style={{ fontSize: 'clamp(0.7rem, 1.8vw, 0.875rem)', marginBottom: 'clamp(0.25rem, 0.5vh, 0.5rem)' }}>닉네임</label>
              <div style={{ height: '0.5vh' }} />
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full bg-gray-800/60 border border-gray-600 rounded-md text-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
                style={{ padding: 'clamp(0.4rem, 1.2vw, 0.75rem)', fontSize: 'clamp(0.7rem, 1.8vw, 0.875rem)' }}
                placeholder="게임에서 표시될 이름 (2~20자)"
                maxLength={20}
                disabled={isLoading}
              />
            </div>

            <div style={{ height: '0.75vh' }} />

            <div>
              <label className="block text-gray-300 font-medium" style={{ fontSize: 'clamp(0.7rem, 1.8vw, 0.875rem)', marginBottom: 'clamp(0.25rem, 0.5vh, 0.5rem)' }}>비밀번호</label>
              <div style={{ height: '0.5vh' }} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-800/60 border border-gray-600 rounded-md text-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
                style={{ padding: 'clamp(0.4rem, 1.2vw, 0.75rem)', fontSize: 'clamp(0.7rem, 1.8vw, 0.875rem)' }}
                placeholder="최소 6자 이상"
                disabled={isLoading}
              />
            </div>

            <div style={{ height: '0.75vh' }} />

            <div>
              <label className="block text-gray-300 font-medium" style={{ fontSize: 'clamp(0.7rem, 1.8vw, 0.875rem)', marginBottom: 'clamp(0.25rem, 0.5vh, 0.5rem)' }}>비밀번호 확인</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-gray-800/60 border border-gray-600 rounded-md text-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
                style={{ padding: 'clamp(0.4rem, 1.2vw, 0.75rem)', fontSize: 'clamp(0.7rem, 1.8vw, 0.875rem)' }}
                placeholder="비밀번호 재입력"
                disabled={isLoading}
              />
            </div>

            <div style={{ height: '2vh' }} />

            <div className="flex justify-center">
              <button
                type="submit"
                disabled={isLoading}
                className="rounded-md bg-purple-600 text-white font-medium hover:bg-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                style={{ padding: 'clamp(0.4rem, 1.2vw, 0.75rem) clamp(1.5rem, 5vw, 4rem)', fontSize: 'clamp(0.75rem, 2vw, 1rem)' }}
              >
                {isLoading ? '회원가입 중...' : '회원가입'}
              </button>
            </div>
          </form>
        )}

        {/* 게스트 로그인 */}
        {(mode === 'guest' || !apiEnabled) && (
          <div className="w-full" style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(0.75rem, 2vh, 1.25rem)' }}>
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-md" style={{ padding: 'clamp(0.75rem, 2vw, 1.25rem)' }}>
              <p className="text-yellow-300 text-center leading-relaxed" style={{ fontSize: 'clamp(0.7rem, 1.8vw, 0.875rem)' }}>
                ⚠️ 게스트 모드에서는 진행 상황이 저장되지 않으며,<br />
                RPG 모드에서 <span className="font-bold">궁수만</span> 사용할 수 있습니다.
              </p>
            </div>

            <div style={{ height: '1vh' }} />

            <div>
              <label className="block text-gray-300 font-medium" style={{ fontSize: 'clamp(0.7rem, 1.8vw, 0.875rem)', marginBottom: 'clamp(0.25rem, 0.5vh, 0.5rem)' }}>닉네임 (선택)</label>
              <div style={{ height: '0.5vh' }} />
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full bg-gray-800/60 border border-gray-600 rounded-md text-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
                style={{ padding: 'clamp(0.5rem, 1.5vw, 1rem)', fontSize: 'clamp(0.75rem, 2vw, 1rem)' }}
                placeholder="입력하지 않으면 랜덤 생성"
                maxLength={20}
                disabled={isLoading}
              />
            </div>

            <div style={{ height: '2vh' }} />

            <div className="flex justify-center">
              <button
                onClick={handleGuestLogin}
                disabled={isLoading}
                className="rounded-md bg-gray-600 text-white font-medium hover:bg-gray-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                style={{ padding: 'clamp(0.4rem, 1.2vw, 0.75rem) clamp(1.5rem, 5vw, 3rem)', fontSize: 'clamp(0.75rem, 2vw, 1rem)' }}
              >
                {isLoading ? '로그인 중...' : '게스트로 시작'}
              </button>
            </div>
          </div>
        )}

        <div style={{ height: '1vh' }} />

        {/* 뒤로 가기 */}
        <button
          onClick={handleBack}
          className="rounded-md border border-gray-600 text-gray-400 font-medium hover:border-gray-400 hover:text-white hover:bg-gray-800/30 transition-all cursor-pointer"
          style={{ marginTop: 'clamp(1rem, 3vh, 2.5rem)', padding: 'clamp(0.3rem, 1vw, 0.5rem) clamp(0.75rem, 2.5vw, 1.5rem)', fontSize: 'clamp(0.7rem, 1.8vw, 0.875rem)' }}
        >
          뒤로 가기
        </button>
      </div>

      {/* 코너 장식 */}
      <div className="absolute border-l-2 border-t-2 border-purple-500/30" style={{ top: 'clamp(0.5rem, 1vw, 1rem)', left: 'clamp(0.5rem, 1vw, 1rem)', width: 'clamp(2rem, 4vw, 4rem)', height: 'clamp(2rem, 4vw, 4rem)' }} />
      <div className="absolute border-r-2 border-t-2 border-purple-500/30" style={{ top: 'clamp(0.5rem, 1vw, 1rem)', right: 'clamp(0.5rem, 1vw, 1rem)', width: 'clamp(2rem, 4vw, 4rem)', height: 'clamp(2rem, 4vw, 4rem)' }} />
      <div className="absolute border-l-2 border-b-2 border-purple-500/30" style={{ bottom: 'clamp(0.5rem, 1vw, 1rem)', left: 'clamp(0.5rem, 1vw, 1rem)', width: 'clamp(2rem, 4vw, 4rem)', height: 'clamp(2rem, 4vw, 4rem)' }} />
      <div className="absolute border-r-2 border-b-2 border-purple-500/30" style={{ bottom: 'clamp(0.5rem, 1vw, 1rem)', right: 'clamp(0.5rem, 1vw, 1rem)', width: 'clamp(2rem, 4vw, 4rem)', height: 'clamp(2rem, 4vw, 4rem)' }} />
    </div>
  );
};
