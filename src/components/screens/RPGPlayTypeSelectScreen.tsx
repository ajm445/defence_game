import React from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { useAuthProfile, useAuthIsGuest } from '../../stores/useAuthStore';
import { soundManager } from '../../services/SoundManager';

export const RPGPlayTypeSelectScreen: React.FC = () => {
  const setScreen = useUIStore((state) => state.setScreen);
  const profile = useAuthProfile();
  const isGuest = useAuthIsGuest();

  const handleSinglePlayer = () => {
    soundManager.play('ui_click');
    setScreen('rpgClassSelect');
  };

  const handleMultiplayer = () => {
    soundManager.play('ui_click');
    setScreen('rpgCoopLobby');
  };

  const handleProfile = () => {
    soundManager.play('ui_click');
    setScreen('profile');
  };

  return (
    <div className="fixed inset-0 bg-menu-gradient grid-overlay flex flex-col items-center justify-center overflow-hidden">
      {/* 배경 효과 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
      </div>

      {/* 프로필 배지 (상단 우측) */}
      {profile && (
        <div className="absolute top-4 right-4 z-20">
          <button
            onClick={handleProfile}
            className="flex items-center gap-3 px-4 py-2 bg-gray-800/80 hover:bg-gray-700/80 border border-gray-600 hover:border-yellow-500/50 rounded-lg transition-all cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center text-sm">
              {isGuest ? '👤' : '⭐'}
            </div>
            <div className="text-left">
              <p className="text-white text-sm font-bold">{profile.nickname}</p>
              <p className="text-yellow-400 text-xs">Lv.{profile.playerLevel}</p>
            </div>
            {isGuest && (
              <span className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-400">
                게스트
              </span>
            )}
          </button>
        </div>
      )}

      {/* 메인 컨텐츠 */}
      <div className="relative z-10 flex flex-col items-center animate-fade-in">
        {/* 타이틀 */}
        <h1 className="font-game text-3xl md:text-4xl text-purple-400 mb-4">
          RPG 모드
        </h1>
        <p className="text-gray-400 mb-8">플레이 유형을 선택하세요</p>

        <div style={{ height: '30px' }} />

        {/* 모드 버튼들 */}
        <div className="flex gap-8">
          {/* 싱글 플레이 */}
          <button
            onClick={handleSinglePlayer}
            className="group relative w-56 h-72 rounded-lg overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-purple-500/20 to-purple-700/20 group-hover:from-purple-500/30 group-hover:to-purple-700/30 transition-all duration-300" />
            <div className="absolute inset-0 border-2 border-purple-500/50 rounded-lg group-hover:border-purple-400 group-hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all duration-300" />

            <div className="relative h-full flex flex-col items-center justify-center p-6">
              <div className="text-6xl mb-4 group-hover:scale-110 transition-transform duration-300">
                🎮
              </div>
              <div style={{ height: '10px' }} />
              <h2 className="font-game text-xl text-white mb-2">싱글 플레이</h2>
              <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-purple-400 to-transparent mb-3" />
              <p className="text-gray-400 text-sm text-center">
                혼자서 웨이브를<br />
                클리어하세요
              </p>
              <div className="mt-4 flex flex-col gap-1 text-xs text-gray-500">
                <span>• 솔로 플레이</span>
                <span>• 무한 웨이브</span>
              </div>
            </div>
          </button>

          {/* 멀티 플레이 */}
          <button
            onClick={handleMultiplayer}
            className="group relative w-56 h-72 rounded-lg overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-orange-500/20 to-red-600/20 group-hover:from-orange-500/30 group-hover:to-red-600/30 transition-all duration-300" />
            <div className="absolute inset-0 border-2 border-orange-500/50 rounded-lg group-hover:border-orange-400 group-hover:shadow-[0_0_20px_rgba(249,115,22,0.3)] transition-all duration-300" />

            <div className="relative h-full flex flex-col items-center justify-center p-6">
              <div className="text-6xl mb-4 group-hover:scale-110 transition-transform duration-300">
                👥
              </div>
              <div style={{ height: '10px' }} />
              <h2 className="font-game text-xl text-white mb-2">협동 플레이</h2>
              <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-orange-400 to-transparent mb-3" />
              <p className="text-gray-400 text-sm text-center">
                친구들과 함께<br />
                웨이브를 클리어하세요
              </p>
              <div className="mt-4 flex flex-col gap-1 text-xs text-gray-500">
                <span>• 2~4인 협동</span>
                <span>• 초대 코드</span>
              </div>
            </div>
          </button>
        </div>

        <div style={{ height: '30px' }} />

        {/* 뒤로 가기 */}
        <button
          onClick={() => {
            soundManager.play('ui_click');
            setScreen('gameTypeSelect');
          }}
          className="mt-12 px-8 py-3 rounded-lg border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white transition-all cursor-pointer"
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
