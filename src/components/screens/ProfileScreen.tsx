import React, { useEffect, useCallback, useState, useRef, useLayoutEffect } from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { useAuthStore, useAuthProfile, useAuthIsGuest } from '../../stores/useAuthStore';
import {
  useProfileStore,
  useClassProgress,
  useProfileStats,
  useProfileIsLoading,
} from '../../stores/useProfileStore';
import { CLASS_CONFIGS, ADVANCED_CLASS_CONFIGS } from '../../constants/rpgConfig';
import { AdvancedHeroClass } from '../../types/rpg';
import {
  CHARACTER_UNLOCK_LEVELS,
  getRequiredClassExp,
  ClassProgress,
  createDefaultStatUpgrades,
} from '../../types/auth';
import { HeroClass } from '../../types/rpg';
import { soundManager } from '../../services/SoundManager';
import { CharacterUpgradeModal } from '../ui/CharacterUpgradeModal';
import { Emoji } from '../common/Emoji';

const ClassProgressCard: React.FC<{
  heroClass: HeroClass;
  level: number;
  exp: number;
  sp: number;
  playerLevel: number;
  isGuest: boolean;
  advancedClass?: string;
  tier?: number;
  onClick: () => void;
}> = ({ heroClass, level, exp, sp, playerLevel, isGuest, advancedClass, tier, onClick }) => {
  const baseConfig = CLASS_CONFIGS[heroClass];
  const advConfig = advancedClass ? ADVANCED_CLASS_CONFIGS[advancedClass as AdvancedHeroClass] : null;

  // 표시할 설정 (전직 시 전직 캐릭터 정보 사용)
  const displayName = advConfig ? advConfig.name : baseConfig.name;
  const displayNameEn = advConfig ? advConfig.nameEn : baseConfig.nameEn;
  const displayEmoji = advConfig ? advConfig.emoji : baseConfig.emoji;

  const unlockLevel = CHARACTER_UNLOCK_LEVELS[heroClass];
  const isUnlocked = isGuest ? heroClass === 'archer' : playerLevel >= unlockLevel;

  const required = getRequiredClassExp(level);
  const percentage = Math.min((exp / required) * 100, 100);

  const classColors: Record<HeroClass, string> = {
    warrior: 'from-red-500 to-orange-500',
    archer: 'from-green-500 to-emerald-500',
    knight: 'from-blue-500 to-cyan-500',
    mage: 'from-purple-500 to-pink-500',
  };

  const handleClick = useCallback(() => {
    soundManager.play('ui_click');
    onClick();
  }, [onClick]);

  return (
    <div
      onClick={handleClick}
      className={`
        relative p-4 rounded-lg border transition-all cursor-pointer min-h-[120px]
        ${isUnlocked
          ? 'bg-gray-800/50 border-gray-600 hover:border-gray-400 hover:bg-gray-700/50'
          : 'bg-gray-900/50 border-gray-700 opacity-60 hover:opacity-80'}
      `}
    >
      {/* 잠금 오버레이 */}
      {!isUnlocked && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg pointer-events-none z-10">
          <div className="text-center">
            <Emoji emoji="🔒" size={24} />
            <p className="text-gray-400 text-xs mt-1">
              {isGuest ? '회원 전용' : `Lv.${unlockLevel} 필요`}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-3">
        <Emoji emoji={displayEmoji} size={30} />
        <div>
          <h3 className="text-white font-bold">
            {displayName}
            {tier === 2 && <span className="ml-1 text-orange-400 text-sm">★★</span>}
          </h3>
          <p className="text-gray-400 text-xs">{displayNameEn}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-yellow-400 font-bold">Lv.{level}</p>
          {sp > 0 && (
            <p className="text-cyan-400 text-xs font-bold">SP: {sp}</p>
          )}
        </div>
      </div>

      {/* 경험치 바 - 항상 표시 (잠긴 경우 흐리게) */}
      <div className={!isUnlocked ? 'opacity-30' : ''}>
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>경험치</span>
          <span>{exp} / {required}</span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${classColors[heroClass]} transition-all duration-300`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        {isUnlocked && (
          <p className="text-gray-500 text-xs mt-2 text-center">클릭하여 업그레이드</p>
        )}
      </div>
    </div>
  );
};

export const ProfileScreen: React.FC = () => {
  const setScreen = useUIStore((state) => state.setScreen);
  const goBack = useUIStore((state) => state.goBack);
  const previousScreen = useUIStore((state) => state.previousScreen);
  const isMobile = useUIStore((s) => s.isMobile);
  const isTablet = useUIStore((s) => s.isTablet);
  const signOut = useAuthStore((state) => state.signOut);
  const changePassword = useAuthStore((state) => state.changePassword);
  const deleteAccount = useAuthStore((state) => state.deleteAccount);
  const profile = useAuthProfile();
  const isGuest = useAuthIsGuest();
  const classProgress = useClassProgress();
  const stats = useProfileStats();
  const isLoading = useProfileIsLoading();
  const loadProfileData = useProfileStore((state) => state.loadProfileData);
  const getPlayerExpProgress = useProfileStore((state) => state.getPlayerExpProgress);

  // RTS 모드에서 접근했는지 확인
  const rtsScreens = ['modeSelect', 'difficultySelect', 'lobby'];
  const isFromRTS = previousScreen && rtsScreens.includes(previousScreen);

  // 메인 메뉴에서 접근했는지 확인 (계정 관리 표시용)
  const isFromMenu = previousScreen === 'menu';

  // 업그레이드 모달 상태
  const [selectedClass, setSelectedClass] = useState<HeroClass | null>(null);

  // 계정 관리 상태 (비밀번호 변경, 회원 탈퇴)
  const [showAccountSection, setShowAccountSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountSuccess, setAccountSuccess] = useState<string | null>(null);

  // 콘텐츠가 뷰포트 높이를 초과하면 비례 축소
  const contentRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const updateScale = () => {
      el.style.transform = '';
      const contentHeight = el.scrollHeight;
      const viewportHeight = window.innerHeight;

      if (contentHeight > viewportHeight) {
        const scale = (viewportHeight / contentHeight) * 0.95;
        el.style.transform = `scale(${Math.min(1, scale)})`;
        el.style.transformOrigin = 'center center';
      }
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [classProgress, stats, isLoading, isGuest, isFromRTS, showAccountSection, showDeleteConfirm]);

  useEffect(() => {
    if (profile && !isGuest && !isFromRTS && !isFromMenu) {
      loadProfileData();
    }
  }, [profile, isGuest, loadProfileData, isFromRTS, isFromMenu]);

  const expProgress = getPlayerExpProgress();

  const handleBack = useCallback(() => {
    soundManager.init();
    soundManager.play('ui_click');
    goBack();
  }, [goBack]);

  const handleSignOut = useCallback(async () => {
    soundManager.init();
    soundManager.play('ui_click');
    await signOut();
    setScreen('menu');
  }, [signOut, setScreen]);

  const handleChangePassword = useCallback(async () => {
    if (!currentPassword) {
      setAccountError('현재 비밀번호를 입력해주세요.');
      return;
    }
    if (!newPassword) {
      setAccountError('새 비밀번호를 입력해주세요.');
      return;
    }
    if (newPassword.length < 6) {
      setAccountError('새 비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setAccountError('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    if (currentPassword === newPassword) {
      setAccountError('현재 비밀번호와 다른 비밀번호를 입력해주세요.');
      return;
    }

    soundManager.play('ui_click');
    const result = await changePassword(currentPassword, newPassword);
    if (result.success) {
      setAccountSuccess('비밀번호가 변경되었습니다.');
      setAccountError(null);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setAccountError(result.error || '비밀번호 변경에 실패했습니다.');
    }
  }, [currentPassword, newPassword, confirmPassword, changePassword]);

  const handleDeleteAccount = useCallback(async () => {
    soundManager.play('ui_click');
    const result = await deleteAccount();
    if (result.success) {
      setScreen('menu');
    } else {
      setAccountError(result.error || '회원 탈퇴에 실패했습니다.');
    }
  }, [deleteAccount, setScreen]);

  const handleToggleAccountSection = useCallback(() => {
    soundManager.play('ui_click');
    setShowAccountSection((prev) => !prev);
    setAccountError(null);
    setAccountSuccess(null);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowDeleteConfirm(false);
  }, []);

  const handleOpenModal = useCallback((heroClass: HeroClass) => {
    setSelectedClass(heroClass);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedClass(null);
  }, []);

  const heroClasses: HeroClass[] = ['archer', 'warrior', 'knight', 'mage'];

  const getClassProgressData = (heroClass: HeroClass): ClassProgress => {
    const progress = classProgress.find((p) => p.className === heroClass);
    return {
      playerId: profile?.id ?? '',
      className: heroClass,
      classLevel: progress?.classLevel ?? 1,
      classExp: progress?.classExp ?? 0,
      sp: progress?.sp ?? 0,
      statUpgrades: progress?.statUpgrades ?? createDefaultStatUpgrades(),
      advancedClass: progress?.advancedClass,
      tier: progress?.tier,
    };
  };

  const formatPlayTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    }
    return `${minutes}분`;
  };

  if (!profile) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-menu-gradient grid-overlay flex flex-col items-center justify-center overflow-hidden">
      {/* 배경 효과 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-yellow-500/5 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
      </div>

      {/* 메인 컨텐츠 (뷰포트 초과 시 비례 축소) */}
      <div ref={contentRef} className="relative z-10 flex flex-col items-center animate-fade-in w-full max-w-4xl px-4 py-8">
        {/* 타이틀 */}
        <h1 className={`font-game text-3xl md:text-4xl mb-6 ${isFromRTS ? 'text-neon-cyan' : 'text-yellow-400'}`}>
          {isFromRTS ? '프로필' : '프로필'}
        </h1>

        {isFromRTS && (
          <p className="text-gray-400 text-sm mb-4">
            플레이어 레벨은 RTS와 RPG 모드에서 공유됩니다
          </p>
        )}

        <div style={{ height: '15px' }} />

        {/* 프로필 카드 */}
        <div className="w-full bg-gray-800/50 rounded-xl border border-gray-700 p-6 mb-6"
        style={{ paddingTop: '5px', paddingBottom: '7px', paddingLeft: '5px', paddingRight: '5px' }}>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center text-3xl">
              {isGuest ? <Emoji emoji="👤" size={32} /> : <Emoji emoji="⭐" size={32} />}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl text-white font-bold">{profile.nickname}</h2>
                {profile.role === 'vip' && (
                  <span className="px-2 py-0.5 bg-gradient-to-r from-amber-500 to-yellow-500 rounded text-xs text-white font-bold shadow-lg shadow-amber-500/30">
                    VIP
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-yellow-400 font-bold">Lv.{profile.playerLevel}</span>
                {isGuest && (
                  <span className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-400">
                    게스트
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 rounded-lg border border-red-500/50 text-red-400 hover:bg-red-500/10 transition-all cursor-pointer text-sm"
              style={{ paddingLeft: '5px', paddingRight: '5px' }}
            >
              로그아웃
            </button>
          </div>

          {/* 경험치 바 */}
          <div className="mb-2">
            <div className="flex justify-between text-sm text-gray-400 mb-1"
            style={{ paddingLeft: '5px', paddingRight: '5px' }}>
              <span>플레이어 경험치</span>
              <span>{expProgress.current} / {expProgress.required}</span>
            </div>
            <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 transition-all duration-300"
                style={{ width: `${expProgress.percentage}%` }}
              />
            </div>
          </div>

          <div style={{ height: '20px' }} />

          {/* 게스트 안내 */}
          {isGuest && (
            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg"
            style={{ paddingLeft: '5px', paddingRight: '5px' }}>
              <p className="text-yellow-300 text-sm text-center">
                <Emoji emoji="⚠️" size={14} /> 게스트 모드에서는 진행 상황이 저장되지 않습니다.
                <br />
                계정을 만들어 진행 상황을 저장하세요!
              </p>
            </div>
          )}
        </div>

        {/* RPG 모드에서만 통계 및 클래스 진행 표시 (메인 메뉴에서는 제외) */}
        {!isFromRTS && !isFromMenu && (
          <>
            <div style={{ height: '15px' }} />

            {/* 통계 섹션 */}
            {!isGuest && stats && (
              <div className="w-full bg-gray-800/50 rounded-xl border border-gray-700 p-6 mb-6">
                <h3 className="text-lg text-white font-bold mb-4"><Emoji emoji="📊" size={18} className="mr-1" /> 통계</h3>
                {isLoading ? (
                  <div className="text-center text-gray-400 py-4">로딩 중...</div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
                    <div className="text-center">
                      <p className="text-2xl text-white font-bold">{stats.totalGames}</p>
                      <p className="text-gray-400 text-sm">총 게임</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl text-red-400 font-bold">{stats.totalKills}</p>
                      <p className="text-gray-400 text-sm">처치</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl text-cyan-400 font-bold">
                        {formatPlayTime(stats.totalPlayTime)}
                      </p>
                      <p className="text-gray-400 text-sm">플레이 시간</p>
                    </div>
                    <div className="text-center">
                      {stats.favoriteClass ? (
                        <>
                          <p className="text-2xl"><Emoji emoji={CLASS_CONFIGS[stats.favoriteClass].emoji} size={24} /></p>
                          <p className="text-gray-400 text-sm">선호 직업</p>
                        </>
                      ) : (
                        <>
                          <p className="text-2xl text-gray-600">-</p>
                          <p className="text-gray-400 text-sm">선호 직업</p>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ height: '15px' }} />

            {/* 클래스 진행 상황 */}
            <div className="w-full bg-gray-800/50 rounded-xl border border-gray-700 p-6 mb-6"
            style={{ paddingTop: '5px', paddingBottom: '8px', paddingLeft: '5px', paddingRight: '5px' }}>
              <h3 className="text-lg text-white font-bold mb-4"><Emoji emoji="🎮" size={18} className="mr-1" /> 클래스 진행</h3>
              <div style={{ height: '5px' }} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4"
              style={{ paddingLeft: '5px', paddingRight: '5px' }}>
                {heroClasses.map((heroClass) => {
                  const progressData = getClassProgressData(heroClass);
                  return (
                    <ClassProgressCard
                      key={heroClass}
                      heroClass={heroClass}
                      level={progressData.classLevel}
                      exp={progressData.classExp}
                      sp={progressData.sp}
                      playerLevel={profile.playerLevel}
                      isGuest={isGuest}
                      advancedClass={progressData.advancedClass}
                      tier={progressData.tier}
                      onClick={() => handleOpenModal(heroClass)}
                    />
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* 계정 관리 섹션 - 메인 메뉴에서 접근 + 비게스트만 */}
        {isFromMenu && !isGuest && (
          <>
            <div style={{ height: '15px' }} />

            <div className="w-full">
              <button
                onClick={handleToggleAccountSection}
                className="w-full flex items-center justify-between bg-gray-800/50 rounded-xl border border-gray-700 hover:border-gray-500 p-4 transition-all cursor-pointer"
              >
                <span className="text-gray-300 font-bold"><Emoji emoji="🔧" size={16} className="mr-2" />계정 관리</span>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${showAccountSection ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showAccountSection && (
                <div className="mt-2 bg-gray-800/50 rounded-xl border border-gray-700 p-6 space-y-6">
                  {/* 에러/성공 메시지 */}
                  {accountError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <p className="text-red-400 text-sm text-center">{accountError}</p>
                    </div>
                  )}
                  {accountSuccess && (
                    <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                      <p className="text-green-400 text-sm text-center">{accountSuccess}</p>
                    </div>
                  )}

                  {/* 비밀번호 변경 */}
                  <div>
                    <h4 className="text-white font-bold mb-4"><Emoji emoji="🔒" size={16} className="mr-1" /> 비밀번호 변경</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-gray-400 text-sm mb-1">현재 비밀번호</label>
                        <input
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="현재 비밀번호 입력..."
                          className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:border-yellow-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-400 text-sm mb-1">새 비밀번호</label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="새 비밀번호 입력 (6자 이상)..."
                          className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:border-yellow-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-400 text-sm mb-1">새 비밀번호 확인</label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="새 비밀번호 다시 입력..."
                          className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:border-yellow-500 focus:outline-none"
                        />
                      </div>
                      <button
                        onClick={handleChangePassword}
                        className="w-full py-3 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border border-yellow-500/50 hover:border-yellow-500 rounded-lg transition-all cursor-pointer"
                      >
                        비밀번호 변경
                      </button>
                    </div>
                  </div>

                  {/* 구분선 */}
                  <div className="h-px bg-gray-700" />

                  {/* 회원 탈퇴 */}
                  <div>
                    {!showDeleteConfirm ? (
                      <>
                        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                          <h4 className="text-red-400 font-bold mb-2"><Emoji emoji="⚠️" size={16} className="mr-1" /> 회원 탈퇴</h4>
                          <p className="text-gray-400 text-sm">
                            계정을 삭제하면 모든 게임 데이터(레벨, 통계, 진행 상황)가 영구적으로 삭제됩니다.
                          </p>
                        </div>
                        <button
                          onClick={() => setShowDeleteConfirm(true)}
                          className="mt-3 w-full py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 hover:border-red-500 rounded-lg transition-all cursor-pointer"
                        >
                          회원 탈퇴
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="p-4 bg-red-500/20 border border-red-500 rounded-lg">
                          <h4 className="text-red-400 font-bold mb-2 text-center">정말 탈퇴하시겠습니까?</h4>
                          <p className="text-gray-300 text-sm text-center">
                            이 작업은 되돌릴 수 없습니다.
                          </p>
                        </div>
                        <div className="mt-3 flex gap-3">
                          <button
                            onClick={() => setShowDeleteConfirm(false)}
                            className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors cursor-pointer"
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
                </div>
              )}
            </div>
          </>
        )}

        <div style={{ height: '15px' }} />

        {/* 뒤로 가기 */}
        <button
          onClick={handleBack}
          className="px-6 py-2 rounded-lg border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white transition-all cursor-pointer mb-8"
          style={{ paddingLeft: '10px', paddingRight: '10px', paddingTop: '5px', paddingBottom: '5px' }}
        >
          뒤로 가기
        </button>
      </div>

      {/* 코너 장식 */}
      {!isMobile && !isTablet && (<>
        <div className={`absolute top-4 left-4 w-16 h-16 border-l-2 border-t-2 ${isFromRTS ? 'border-neon-cyan/30' : 'border-yellow-500/30'}`} />
        <div className={`absolute top-4 right-4 w-16 h-16 border-r-2 border-t-2 ${isFromRTS ? 'border-neon-cyan/30' : 'border-yellow-500/30'}`} />
        <div className={`absolute bottom-4 left-4 w-16 h-16 border-l-2 border-b-2 ${isFromRTS ? 'border-neon-cyan/30' : 'border-yellow-500/30'}`} />
        <div className={`absolute bottom-4 right-4 w-16 h-16 border-r-2 border-b-2 ${isFromRTS ? 'border-neon-cyan/30' : 'border-yellow-500/30'}`} />
      </>)}

      {/* 캐릭터 업그레이드 모달 (RPG 모드에서만) */}
      {!isFromRTS && selectedClass && (
        <CharacterUpgradeModal
          heroClass={selectedClass}
          progress={getClassProgressData(selectedClass)}
          isUnlocked={
            isGuest
              ? selectedClass === 'archer'
              : profile.playerLevel >= CHARACTER_UNLOCK_LEVELS[selectedClass]
          }
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
};
