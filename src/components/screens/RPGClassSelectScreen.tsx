import React, { useCallback, useState, useEffect } from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { useRPGStore } from '../../stores/useRPGStore';
import { useAuthProfile, useAuthIsGuest, useAuthStore } from '../../stores/useAuthStore';
import { useProfileStore } from '../../stores/useProfileStore';
import { CLASS_CONFIGS } from '../../constants/rpgConfig';
import { HeroClass } from '../../types/rpg';
import { CHARACTER_UNLOCK_LEVELS, isCharacterUnlocked, createDefaultStatUpgrades } from '../../types/auth';
import { soundManager } from '../../services/SoundManager';
import { wsClient } from '../../services/WebSocketClient';
import { createMultiplayerRoom, joinMultiplayerRoom } from '../../hooks/useNetworkSync';

interface ClassCardProps {
  heroClass: HeroClass;
  isSelected: boolean;
  isLocked: boolean;
  unlockLevel: number;
  isGuest: boolean;
  onSelect: () => void;
}

const ClassCard: React.FC<ClassCardProps> = ({ heroClass, isSelected, isLocked, unlockLevel, isGuest, onSelect }) => {
  const config = CLASS_CONFIGS[heroClass];

  const classColors: Record<HeroClass, { gradient: string; border: string; glow: string }> = {
    warrior: {
      gradient: 'from-red-500/20 to-orange-500/20',
      border: 'border-red-500',
      glow: 'shadow-[0_0_20px_rgba(239,68,68,0.3)]',
    },
    archer: {
      gradient: 'from-green-500/20 to-emerald-500/20',
      border: 'border-green-500',
      glow: 'shadow-[0_0_20px_rgba(34,197,94,0.3)]',
    },
    knight: {
      gradient: 'from-blue-500/20 to-cyan-500/20',
      border: 'border-blue-500',
      glow: 'shadow-[0_0_20px_rgba(59,130,246,0.3)]',
    },
    mage: {
      gradient: 'from-purple-500/20 to-pink-500/20',
      border: 'border-purple-500',
      glow: 'shadow-[0_0_20px_rgba(168,85,247,0.3)]',
    },
  };

  const colors = classColors[heroClass];

  const handleClick = () => {
    if (!isLocked) {
      onSelect();
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLocked}
      className={`
        group relative w-52 h-80 rounded-xl overflow-hidden
        transition-all duration-300
        ${isLocked
          ? 'cursor-not-allowed opacity-70'
          : 'hover:scale-105 active:scale-95 cursor-pointer'}
        ${isSelected && !isLocked ? `${colors.glow} scale-105` : ''}
      `}
    >
      {/* 배경 그라데이션 */}
      <div className={`absolute inset-0 bg-gradient-to-b ${colors.gradient} ${!isLocked ? 'group-hover:opacity-150' : ''} transition-all duration-300`} />

      {/* 테두리 */}
      <div className={`
        absolute inset-0 border-2 rounded-xl transition-all duration-300
        ${isLocked ? 'border-gray-700' : isSelected ? colors.border : 'border-gray-600'}
        ${isSelected && !isLocked ? colors.glow : ''}
        ${!isLocked ? `group-hover:${colors.border}` : ''}
      `} />

      {/* 잠금 오버레이 */}
      {isLocked && (
        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center z-10 rounded-xl">
          <span className="text-4xl mb-2">🔒</span>
          <p className="text-gray-300 text-sm font-bold">
            {isGuest ? '회원 전용' : `Lv.${unlockLevel} 필요`}
          </p>
          {isGuest && (
            <p className="text-gray-400 text-xs mt-1">회원가입 후 이용 가능</p>
          )}
        </div>
      )}

      {/* 선택 표시 */}
      {isSelected && !isLocked && (
        <div className="absolute top-3 right-3 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center z-20">
          <span className="text-white text-lg">✓</span>
        </div>
      )}
      {/* 컨텐츠 */}
      <div className={`relative h-full flex flex-col items-center justify-center p-6 ${isLocked ? 'opacity-50' : ''}`}
      style={{ paddingLeft: '5px', paddingRight: '5px' }}>
        {/* 이모지 아이콘 */}
        <div className={`text-7xl mb-4 transform ${!isLocked ? 'group-hover:scale-110' : ''} transition-transform`}>
          {config.emoji}
        </div>

        <div style={{ height: '30px' }} />

        {/* 직업명 */}
        <h2 className="font-game text-2xl text-white mb-1">{config.name}</h2>
        <p className="text-gray-400 text-sm mb-4">{config.nameEn}</p>

        <div style={{ height: '10px' }} />

        {/* 설명 */}
        <p className="text-gray-300 text-xs text-center mb-4 px-2">
          {config.description}
        </p>

        <div style={{ height: '10px' }} />

        {/* 스탯 미리보기 */}
        <div className="w-full space-y-1 text-xs">
          <div className="flex justify-between px-2">
            <span className="text-gray-400">HP</span>
            <span className="text-white font-bold">{config.hp}</span>
          </div>
          <div className="flex justify-between px-2">
            <span className="text-gray-400">공격력</span>
            <span className="text-red-400 font-bold">{config.attack}</span>
          </div>
          <div className="flex justify-between px-2">
            <span className="text-gray-400">공속</span>
            <span className="text-yellow-400 font-bold">{config.attackSpeed}초</span>
          </div>
          <div className="flex justify-between px-2">
            <span className="text-gray-400">이동속도</span>
            <span className="text-blue-400 font-bold">{config.speed}</span>
          </div>
          <div className="flex justify-between px-2">
            <span className="text-gray-400">사거리</span>
            <span className="text-green-400 font-bold">{config.range}</span>
          </div>
        </div>
      </div>
    </button>
  );
};

export const RPGClassSelectScreen: React.FC = () => {
  const setScreen = useUIStore((state) => state.setScreen);
  const isMobile = useUIStore((s) => s.isMobile);
  const isTablet = useUIStore((s) => s.isTablet);
  const selectClass = useRPGStore((state) => state.selectClass);
  const selectedClass = useRPGStore((state) => state.selectedClass);
  const profile = useAuthProfile();
  const isGuest = useAuthIsGuest();
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [inputRoomCode, setInputRoomCode] = useState('');
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const playerLevel = profile?.playerLevel ?? 1;

  // 기본 클래스 설정 (궁수)
  useEffect(() => {
    if (!selectedClass) {
      selectClass('archer');
    }
  }, [selectedClass, selectClass]);

  // RPG 메인 BGM 재생
  useEffect(() => {
    soundManager.init();
    soundManager.playBGM('rpg_main');
  }, []);

  const handleSelectClass = useCallback((heroClass: HeroClass) => {
    // 해금 확인
    if (!isCharacterUnlocked(heroClass, playerLevel, isGuest)) {
      return;
    }
    soundManager.init();
    soundManager.play('ui_click');
    selectClass(heroClass);
  }, [selectClass, playerLevel, isGuest]);

  const handleCreateRoom = useCallback(async () => {
    if (!selectedClass) return;
    // 선택된 클래스가 해금되었는지 확인
    if (!isCharacterUnlocked(selectedClass, playerLevel, isGuest)) {
      return;
    }

    soundManager.init();
    soundManager.play('ui_click');
    setIsCreatingRoom(true);

    try {
      // WebSocket 연결
      await wsClient.connect();

      // 플레이어 정보 가져오기
      const playerName = profile?.nickname || '플레이어';

      // classProgress에서 해당 캐릭터의 레벨과 statUpgrades 가져오기
      // useProfileStore 우선, 비어있으면 useAuthStore 사용 (로그인 시 로드됨)
      let classProgress = useProfileStore.getState().classProgress;
      if (classProgress.length === 0) {
        classProgress = useAuthStore.getState().classProgress;
      }
      const progress = classProgress.find(p => p.className === selectedClass);
      const characterLevel = progress?.classLevel || 1;
      const statUpgrades = progress?.statUpgrades || createDefaultStatUpgrades();
      const advancedClass = progress?.advancedClass;
      const tier = progress?.tier;

      // 방 생성 (전직/2차 강화 정보 포함)
      createMultiplayerRoom(playerName, selectedClass, characterLevel, statUpgrades, false, 'easy', advancedClass, tier);

      // 로비로 이동
      setScreen('rpgCoopLobby');
    } catch (error) {
      console.error('방 생성 실패:', error);
      setIsCreatingRoom(false);
    }
  }, [selectedClass, profile, playerLevel, isGuest, setScreen]);

  const handleJoinRoom = useCallback(async () => {
    if (!selectedClass) return;
    if (inputRoomCode.trim().length !== 6) {
      setError('6자리 초대 코드를 입력하세요.');
      return;
    }

    soundManager.init();
    soundManager.play('ui_click');
    setIsJoiningRoom(true);
    setError(null);

    try {
      // WebSocket 연결
      await wsClient.connect();

      // 플레이어 정보 가져오기
      const playerName = profile?.nickname || '플레이어';

      // classProgress에서 해당 캐릭터의 레벨과 statUpgrades 가져오기
      // useProfileStore 우선, 비어있으면 useAuthStore 사용 (로그인 시 로드됨)
      let classProgress = useProfileStore.getState().classProgress;
      if (classProgress.length === 0) {
        classProgress = useAuthStore.getState().classProgress;
      }
      const progress = classProgress.find(p => p.className === selectedClass);
      const characterLevel = progress?.classLevel || 1;
      const statUpgrades = progress?.statUpgrades || createDefaultStatUpgrades();
      const advancedClass = progress?.advancedClass;
      const tier = progress?.tier;

      // 방 참가 (전직/2차 강화 정보 포함)
      joinMultiplayerRoom(inputRoomCode.trim().toUpperCase(), playerName, selectedClass, characterLevel, statUpgrades, advancedClass, tier);

      // 로비로 이동
      setScreen('rpgCoopLobby');
    } catch (err) {
      console.error('방 참가 실패:', err);
      setError('서버 연결 실패');
      setIsJoiningRoom(false);
    }
  }, [selectedClass, inputRoomCode, profile, setScreen]);

  const handleBack = useCallback(() => {
    soundManager.init();
    soundManager.play('ui_click');
    if (showJoinInput) {
      setShowJoinInput(false);
      setInputRoomCode('');
      setError(null);
    } else {
      setScreen('gameTypeSelect');
    }
  }, [setScreen, showJoinInput]);

  const handleProfile = useCallback(() => {
    soundManager.init();
    soundManager.play('ui_click');
    setScreen('profile');
  }, [setScreen]);

  const heroClasses: HeroClass[] = ['archer', 'warrior', 'knight', 'mage'];

  return (
    <div className="fixed inset-0 bg-menu-gradient grid-overlay flex flex-col items-center justify-center overflow-hidden">
      {/* 배경 효과 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-neon-cyan/5 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-neon-purple/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
      </div>

      {/* 메인 컨텐츠 */}
      <div className="relative z-10 flex flex-col items-center animate-fade-in">
        {/* 타이틀 */}
        <h1 className="font-game text-3xl md:text-4xl text-yellow-400 mb-4">
          직업 선택
        </h1>
        <p className="text-gray-400 mb-8">플레이할 영웅의 직업을 선택하세요</p>

        <div style={{ height: '30px' }} />

        {/* 직업 카드들 */}
        <div className="flex gap-6 mb-8">
          {heroClasses.map((heroClass) => {
            const unlockLevel = CHARACTER_UNLOCK_LEVELS[heroClass];
            const isLocked = !isCharacterUnlocked(heroClass, playerLevel, isGuest);
            return (
              <ClassCard
                key={heroClass}
                heroClass={heroClass}
                isSelected={selectedClass === heroClass}
                isLocked={isLocked}
                unlockLevel={unlockLevel}
                isGuest={isGuest}
                onSelect={() => handleSelectClass(heroClass)}
              />
            );
          })}
        </div>
        
        <div style={{ height: '30px' }} />

        {/* 버튼들 */}
        {!showJoinInput ? (
          <div className="flex gap-4">
            <button
              onClick={handleBack}
              className="px-8 py-3 rounded-lg border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white transition-all cursor-pointer"
              style={{ paddingLeft: '10px', paddingRight: '10px', paddingTop: '5px', paddingBottom: '5px' }}
            >
              뒤로 가기
            </button>
            <button
              onClick={handleCreateRoom}
              disabled={!selectedClass || isCreatingRoom}
              className={`
                px-8 py-3 rounded-lg font-bold transition-all cursor-pointer
                ${selectedClass && !isCreatingRoom
                  ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white hover:from-yellow-400 hover:to-orange-400'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }
              `}
              style={{ paddingLeft: '10px', paddingRight: '10px', paddingTop: '5px', paddingBottom: '5px' }}
            >
              {isCreatingRoom ? '방 생성 중...' : '방 생성하기'}
            </button>
            <button
              onClick={() => {
                soundManager.init();
                soundManager.play('ui_click');
                setShowJoinInput(true);
              }}
              disabled={!selectedClass}
              className={`
                px-8 py-3 rounded-lg font-bold transition-all cursor-pointer
                ${selectedClass
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-400 hover:to-blue-400'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }
              `}
              style={{ paddingLeft: '10px', paddingRight: '10px', paddingTop: '5px', paddingBottom: '5px' }}
            >
              방 입장하기
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <p className="text-gray-300 text-sm">6자리 초대 코드를 입력하세요</p>
            <input
              type="text"
              value={inputRoomCode}
              onChange={(e) => setInputRoomCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="XXXXXX"
              className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-600 text-white text-center text-xl tracking-widest font-mono focus:border-cyan-500 focus:outline-none"
              style={{ width: '150px' }}
              maxLength={6}
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-4">
              <button
                onClick={handleBack}
                className="px-8 py-3 rounded-lg border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white transition-all cursor-pointer"
                style={{ paddingLeft: '10px', paddingRight: '10px', paddingTop: '5px', paddingBottom: '5px' }}
              >
                뒤로 가기
              </button>
              <button
                onClick={handleJoinRoom}
                disabled={inputRoomCode.length !== 6 || isJoiningRoom}
                className={`
                  px-8 py-3 rounded-lg font-bold transition-all cursor-pointer
                  ${inputRoomCode.length === 6 && !isJoiningRoom
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-400 hover:to-blue-400'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  }
                `}
                style={{ paddingLeft: '10px', paddingRight: '10px', paddingTop: '5px', paddingBottom: '5px' }}
              >
                {isJoiningRoom ? '입장 중...' : '입장하기'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 우측 상단 프로필 버튼 */}
      <button
        onClick={handleProfile}
        className="absolute top-6 right-6 z-20 flex items-center gap-2 px-4 py-2 bg-gray-800/80 hover:bg-gray-700/80 border border-gray-600 hover:border-yellow-500/50 rounded-lg transition-all cursor-pointer group"
      >
        <span className="text-xl">👤</span>
        <div className="text-left">
          <p className="text-white text-sm font-bold group-hover:text-yellow-400 transition-colors">
            {profile?.nickname || '게스트'}
          </p>
          <p className="text-gray-400 text-xs">
            Lv.{playerLevel}
          </p>
        </div>
      </button>

      {/* 코너 장식 */}
      {!isMobile && !isTablet && (<>
        <div className="absolute top-4 left-4 w-16 h-16 border-l-2 border-t-2 border-yellow-500/30" />
        <div className="absolute top-4 right-4 w-16 h-16 border-r-2 border-t-2 border-yellow-500/30" />
        <div className="absolute bottom-4 left-4 w-16 h-16 border-l-2 border-b-2 border-yellow-500/30" />
        <div className="absolute bottom-4 right-4 w-16 h-16 border-r-2 border-b-2 border-yellow-500/30" />
      </>)}
    </div>
  );
};
