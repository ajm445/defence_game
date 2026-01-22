import React, { useEffect, useCallback } from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { useAuthStore, useAuthProfile, useAuthIsGuest } from '../../stores/useAuthStore';
import {
  useProfileStore,
  useClassProgress,
  useProfileStats,
  useProfileIsLoading,
} from '../../stores/useProfileStore';
import { CLASS_CONFIGS } from '../../constants/rpgConfig';
import { CHARACTER_UNLOCK_LEVELS, getRequiredPlayerExp, getRequiredClassExp } from '../../types/auth';
import { HeroClass } from '../../types/rpg';
import { soundManager } from '../../services/SoundManager';

const ClassProgressCard: React.FC<{
  heroClass: HeroClass;
  level: number;
  exp: number;
  playerLevel: number;
  isGuest: boolean;
}> = ({ heroClass, level, exp, playerLevel, isGuest }) => {
  const config = CLASS_CONFIGS[heroClass];
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

  return (
    <div
      className={`
        relative p-4 rounded-lg border transition-all
        ${isUnlocked
          ? 'bg-gray-800/50 border-gray-600'
          : 'bg-gray-900/50 border-gray-700 opacity-60'}
      `}
    >
      {/* 잠금 오버레이 */}
      {!isUnlocked && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg">
          <div className="text-center">
            <span className="text-2xl">🔒</span>
            <p className="text-gray-400 text-xs mt-1">
              {isGuest ? '회원 전용' : `Lv.${unlockLevel} 필요`}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-3">
        <span className="text-3xl">{config.emoji}</span>
        <div>
          <h3 className="text-white font-bold">{config.name}</h3>
          <p className="text-gray-400 text-xs">{config.nameEn}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-yellow-400 font-bold">Lv.{level}</p>
        </div>
      </div>

      {isUnlocked && (
        <div>
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
        </div>
      )}
    </div>
  );
};

export const ProfileScreen: React.FC = () => {
  const setScreen = useUIStore((state) => state.setScreen);
  const goBack = useUIStore((state) => state.goBack);
  const signOut = useAuthStore((state) => state.signOut);
  const profile = useAuthProfile();
  const isGuest = useAuthIsGuest();
  const classProgress = useClassProgress();
  const stats = useProfileStats();
  const isLoading = useProfileIsLoading();
  const loadProfileData = useProfileStore((state) => state.loadProfileData);
  const getPlayerExpProgress = useProfileStore((state) => state.getPlayerExpProgress);

  useEffect(() => {
    if (profile && !isGuest) {
      loadProfileData();
    }
  }, [profile, isGuest, loadProfileData]);

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

  const heroClasses: HeroClass[] = ['archer', 'warrior', 'knight', 'mage'];

  const getClassProgress = (heroClass: HeroClass) => {
    const progress = classProgress.find((p) => p.className === heroClass);
    return {
      level: progress?.classLevel ?? 1,
      exp: progress?.classExp ?? 0,
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

      {/* 메인 컨텐츠 */}
      <div className="relative z-10 flex flex-col items-center animate-fade-in w-full max-w-4xl px-4">
        {/* 타이틀 */}
        <h1 className="font-game text-3xl md:text-4xl text-yellow-400 mb-8">
          프로필
        </h1>

        <div style={{ height: '30px' }} />

        {/* 프로필 카드 */}
        <div className="w-full bg-gray-800/50 rounded-xl border border-gray-700 p-6 mb-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center text-3xl">
              {isGuest ? '👤' : '⭐'}
            </div>
            <div className="flex-1">
              <h2 className="text-2xl text-white font-bold">{profile.nickname}</h2>
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
            >
              로그아웃
            </button>
          </div>

          {/* 경험치 바 */}
          <div className="mb-2">
            <div className="flex justify-between text-sm text-gray-400 mb-1">
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

          <div style={{ height: '30px' }} />
          
          {/* 게스트 안내 */}
          {isGuest && (
            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="text-yellow-300 text-sm text-center">
                ⚠️ 게스트 모드에서는 진행 상황이 저장되지 않습니다.
                <br />
                계정을 만들어 진행 상황을 저장하세요!
              </p>
            </div>
          )}
        </div>

        <div style={{ height: '30px' }} />

        {/* 통계 섹션 */}
        {!isGuest && stats && (
          <div className="w-full bg-gray-800/50 rounded-xl border border-gray-700 p-6 mb-6">
            <h3 className="text-lg text-white font-bold mb-4">📊 통계</h3>
            {isLoading ? (
              <div className="text-center text-gray-400 py-4">로딩 중...</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl text-white font-bold">{stats.totalGames}</p>
                  <p className="text-gray-400 text-sm">총 게임</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl text-red-400 font-bold">{stats.totalKills}</p>
                  <p className="text-gray-400 text-sm">처치</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl text-purple-400 font-bold">{stats.highestWave}</p>
                  <p className="text-gray-400 text-sm">최고 웨이브</p>
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
                      <p className="text-2xl">{CLASS_CONFIGS[stats.favoriteClass].emoji}</p>
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

        <div style={{ height: '30px' }} />

        {/* 클래스 진행 상황 */}
        <div className="w-full bg-gray-800/50 rounded-xl border border-gray-700 p-6 mb-6">
          <h3 className="text-lg text-white font-bold mb-4">🎮 클래스 진행</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {heroClasses.map((heroClass) => {
              const { level, exp } = getClassProgress(heroClass);
              return (
                <ClassProgressCard
                  key={heroClass}
                  heroClass={heroClass}
                  level={level}
                  exp={exp}
                  playerLevel={profile.playerLevel}
                  isGuest={isGuest}
                />
              );
            })}
          </div>
        </div>

        <div style={{ height: '30px' }} />

        {/* 해금 안내 */}
        <div className="w-full bg-gray-800/30 rounded-lg p-4 mb-6">
          <h4 className="text-gray-400 text-sm mb-2">🔓 캐릭터 해금 조건</h4>
          <div className="flex flex-wrap gap-4 text-xs">
            {heroClasses.map((heroClass) => (
              <div key={heroClass} className="flex items-center gap-1">
                <span>{CLASS_CONFIGS[heroClass].emoji}</span>
                <span className="text-gray-300">{CLASS_CONFIGS[heroClass].name}</span>
                <span className="text-gray-500">
                  {CHARACTER_UNLOCK_LEVELS[heroClass] === 1
                    ? '(기본)'
                    : `Lv.${CHARACTER_UNLOCK_LEVELS[heroClass]}`}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ height: '30px' }} />
        
        {/* 뒤로 가기 */}
        <button
          onClick={handleBack}
          className="px-8 py-3 rounded-lg border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white transition-all cursor-pointer"
          style={{ paddingLeft: '10px', paddingRight: '10px', paddingTop: '5px', paddingBottom: '5px' }}
        >
          뒤로 가기
        </button>
      </div>

      {/* 코너 장식 */}
      <div className="absolute top-4 left-4 w-16 h-16 border-l-2 border-t-2 border-yellow-500/30" />
      <div className="absolute top-4 right-4 w-16 h-16 border-r-2 border-t-2 border-yellow-500/30" />
      <div className="absolute bottom-4 left-4 w-16 h-16 border-l-2 border-b-2 border-yellow-500/30" />
      <div className="absolute bottom-4 right-4 w-16 h-16 border-r-2 border-b-2 border-yellow-500/30" />
    </div>
  );
};
