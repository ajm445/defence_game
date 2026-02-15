import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { useAuthStore, useAuthError, useAuthIsLoading } from '../../stores/useAuthStore';
import { soundManager } from '../../services/SoundManager';
import { checkNicknameAvailability, checkUsernameAvailability } from '../../services/authService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

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
  const isMobile = useUIStore((s) => s.isMobile);
  const isTablet = useUIStore((s) => s.isTablet);
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

  // 점검 상태
  const [maintenanceMessage, setMaintenanceMessage] = useState<string | null>(null);

  // 닉네임 중복 확인 상태
  const [nicknameChecked, setNicknameChecked] = useState(false);
  const [nicknameAvailable, setNicknameAvailable] = useState(false);
  const [nicknameChecking, setNicknameChecking] = useState(false);

  // 아이디 중복 확인 상태
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const usernameCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 닉네임 변경 시 확인 상태 초기화
  const handleNicknameChange = useCallback((value: string) => {
    setNickname(value);
    setNicknameChecked(false);
    setNicknameAvailable(false);
  }, []);

  // 아이디 변경 시 디바운스 중복 확인
  const handleUsernameChange = useCallback((value: string) => {
    setUsername(value);
    setUsernameStatus('idle');

    if (usernameCheckTimer.current) {
      clearTimeout(usernameCheckTimer.current);
    }

    if (value.length < 4 || !/^[a-zA-Z0-9_]+$/.test(value)) {
      return;
    }

    setUsernameStatus('checking');
    usernameCheckTimer.current = setTimeout(async () => {
      const result = await checkUsernameAvailability(value);
      // 현재 입력값이 변경되지 않았을 때만 적용
      setUsername((current) => {
        if (current === value) {
          setUsernameStatus(result.available ? 'available' : 'taken');
        }
        return current;
      });
    }, 500);
  }, []);

  // 닉네임 중복 확인 핸들러
  const handleCheckNickname = useCallback(async () => {
    if (!nickname.trim() || nickname.trim().length < 2) {
      setError('닉네임은 2자 이상이어야 합니다.');
      return;
    }

    soundManager.play('ui_click');
    setNicknameChecking(true);
    const result = await checkNicknameAvailability(nickname.trim());
    setNicknameChecking(false);

    if (result.available) {
      setNicknameChecked(true);
      setNicknameAvailable(true);
      setSuccessMessage(null);
    } else {
      setNicknameChecked(true);
      setNicknameAvailable(false);
      setError('이미 사용 중인 닉네임입니다.');
    }
  }, [nickname, setError]);

  // 점검 상태 확인
  useEffect(() => {
    fetch(`${API_URL}/api/maintenance/status`)
      .then(res => res.json())
      .then(data => {
        if (data.isActive) {
          setMaintenanceMessage(data.message || '서버 점검 중입니다.');
        }
      })
      .catch(() => {
        // 서버 접속 불가 시 무시
      });
  }, []);

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (usernameCheckTimer.current) {
        clearTimeout(usernameCheckTimer.current);
      }
    };
  }, []);

  const apiEnabled = isApiConfigured();

  const handleModeChange = useCallback((newMode: AuthMode) => {
    soundManager.init();
    soundManager.play('ui_click');
    setMode(newMode);
    clearError();
    setSuccessMessage(null);
    setNicknameChecked(false);
    setNicknameAvailable(false);
    setUsernameStatus('idle');
  }, [clearError]);

  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.init();
    soundManager.play('ui_click');
    clearError();

    if (maintenanceMessage) {
      setError('서버 점검 중에는 로그인할 수 없습니다.');
      return;
    }

    if (!username || !password) {
      setError('아이디와 비밀번호를 입력해주세요.');
      return;
    }

    const email = usernameToEmail(username);
    const success = await signIn(email, password);
    if (success) {
      setScreen('menu');
    }
  }, [username, password, signIn, setScreen, setError, clearError, maintenanceMessage]);

  const handleSignUp = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.init();
    soundManager.play('ui_click');
    clearError();

    if (maintenanceMessage) {
      setError('서버 점검 중에는 회원가입할 수 없습니다.');
      return;
    }

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

    if (nickname.length < 2 || nickname.length > 10) {
      setError('닉네임은 2~10자 사이여야 합니다.');
      return;
    }

    if (!nicknameChecked || !nicknameAvailable) {
      setError('닉네임 중복 확인을 해주세요.');
      return;
    }

    if (usernameStatus === 'taken') {
      setError('사용중인 아이디입니다. 다른 아이디를 입력해주세요.');
      return;
    }

    if (usernameStatus !== 'available') {
      setError('아이디 중복 확인이 완료되지 않았습니다.');
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
  }, [username, password, confirmPassword, nickname, signUp, setScreen, setError, clearError, maintenanceMessage]);

  const handleGuestLogin = useCallback(async () => {
    soundManager.init();
    soundManager.play('ui_click');
    clearError();

    if (maintenanceMessage) {
      setError('서버 점검 중에는 접속할 수 없습니다.');
      return;
    }

    const guestNickname = nickname || `모험가${Math.floor(Math.random() * 10000)}`;

    const success = await signInGuest(guestNickname);
    if (success) {
      setScreen('menu');
    }
  }, [nickname, signInGuest, setScreen, clearError, setError, maintenanceMessage]);

  const handleBack = useCallback(() => {
    soundManager.init();
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
        <h1 className="font-game text-3xl md:text-4xl text-yellow-400 mb-3 text-center">
          막아라! 무너트려라!
        </h1>

        <div style={{ height: '20px' }} />

        <p className="text-gray-400 text-sm mb-10">로그인하여 진행 상황을 저장하세요</p>

        <div style={{ height: '20px' }} />

        {/* 점검 중 안내 */}
        {maintenanceMessage && (
          <div className="w-full mb-8 p-6 bg-yellow-500/15 border-2 border-yellow-500/50 rounded-lg text-center">
            <div style={{ height: '5px' }} />
            <div className="text-3xl mb-3">🔧</div>
            <h2 className="text-yellow-300 font-bold text-lg mb-2">점검 중입니다</h2>
            <p className="text-yellow-200/80 text-sm">{maintenanceMessage}</p>
            <p className="text-gray-400 text-xs mt-3">잠시 후 다시 시도해주세요.</p>
            <div style={{ height: '5px' }} />
          </div>
        )}

        <div style={{ height: '20px' }} />

        {/* 탭 버튼 */}
        {apiEnabled && (
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
        {apiEnabled && mode === 'login' && (
          <form onSubmit={handleLogin} className="w-full space-y-5">
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">아이디</label>
              <div style={{ height: '3px' }} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-4 bg-gray-800/60 border border-gray-600 rounded-md text-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
                placeholder="아이디 입력"
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
        {apiEnabled && mode === 'signup' && (
          <form onSubmit={handleSignUp} className="w-full space-y-5">
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">닉네임</label>
              <div style={{ height: '3px' }} />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => handleNicknameChange(e.target.value)}
                  className="flex-1 px-4 py-4 bg-gray-800/60 border border-gray-600 rounded-md text-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
                  placeholder="게임에서 표시될 이름 (2~10자)"
                  maxLength={10}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={handleCheckNickname}
                  disabled={isLoading || nicknameChecking || nickname.trim().length < 2}
                  className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                    nicknameChecked && nicknameAvailable
                      ? 'bg-green-600/30 border border-green-500 text-green-400'
                      : 'bg-purple-600/30 border border-purple-500 text-purple-300 hover:bg-purple-600/50'
                  }`}
                >
                  {nicknameChecking ? '확인중...' : nicknameChecked && nicknameAvailable ? '확인완료' : '중복확인'}
                </button>
              </div>
              {nicknameChecked && (
                <p className={`text-xs mt-2 ${nicknameAvailable ? 'text-green-400' : 'text-red-400'}`}>
                  {nicknameAvailable ? '사용 가능한 닉네임입니다.' : '이미 사용 중인 닉네임입니다.'}
                </p>
              )}
            </div>

            <div style={{ height: '10px' }} />

            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">아이디</label>
              <div style={{ height: '3px' }} />
              <input
                type="text"
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                className="w-full px-4 py-4 bg-gray-800/60 border border-gray-600 rounded-md text-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
                placeholder="4~20자, 영문/숫자/밑줄"
                maxLength={20}
                disabled={isLoading}
              />
              {username.length >= 4 && /^[a-zA-Z0-9_]+$/.test(username) && (
                <p className={`text-xs mt-2 ${
                  usernameStatus === 'available' ? 'text-green-400' :
                  usernameStatus === 'taken' ? 'text-red-400' :
                  'text-gray-400'
                }`}>
                  {usernameStatus === 'checking' && '확인 중...'}
                  {usernameStatus === 'available' && '사용 가능한 아이디입니다.'}
                  {usernameStatus === 'taken' && '사용중인 아이디입니다.'}
                </p>
              )}
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

            <p className="text-yellow-400/80 text-xs mt-2">
              비밀번호를 잊으면 복구할 수 없습니다. 안전한 곳에 기록해 주세요.
            </p>

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
        {(mode === 'guest' || !apiEnabled) && (
          <div className="w-full space-y-5">
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-md p-5">
              <p className="text-yellow-300 text-sm text-center leading-relaxed">
                ⚠️ 게스트 모드에서는 진행 상황이 저장되지 않으며,<br />
                RPG 모드에서 <span className="font-bold">궁수만</span> 사용할 수 있습니다.
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
                maxLength={10}
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
      {!isMobile && !isTablet && (<>
        <div className="absolute top-4 left-4 w-16 h-16 border-l-2 border-t-2 border-purple-500/30" />
        <div className="absolute top-4 right-4 w-16 h-16 border-r-2 border-t-2 border-purple-500/30" />
        <div className="absolute bottom-4 left-4 w-16 h-16 border-l-2 border-b-2 border-purple-500/30" />
        <div className="absolute bottom-4 right-4 w-16 h-16 border-r-2 border-b-2 border-purple-500/30" />
      </>)}
    </div>
  );
};
