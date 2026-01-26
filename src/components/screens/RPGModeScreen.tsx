import React, { useEffect, useCallback, useState, useRef } from 'react';
import { useRPGGameLoop } from '../../hooks/useRPGGameLoop';
import { useRPGKeyboard } from '../../hooks/useRPGInput';
import { RPGCanvas } from '../canvas/RPGCanvas';
import { RPGHeroPanel, RPGTeamPanel } from '../ui/RPGHeroPanel';
import { RPGSkillBar } from '../ui/RPGSkillBar';
import { RPGWaveInfo } from '../ui/RPGWaveInfo';
import { RPGGameTimer } from '../ui/RPGGameTimer';
import { RPGUpgradePanel } from '../ui/RPGUpgradePanel';
import { Notification } from '../ui/Notification';
import { LevelUpNotification } from '../ui/LevelUpNotification';
import { useRPGStore, useRPGGameOver, useRPGResult, useSelectedClass } from '../../stores/useRPGStore';
import { useUIStore } from '../../stores/useUIStore';
import { useAuthStore, useAuthProfile, useAuthIsGuest } from '../../stores/useAuthStore';
import { useProfileStore, useLastGameResult, useClassProgress } from '../../stores/useProfileStore';
import { SkillType } from '../../types/rpg';
import { LevelUpResult, calculatePlayerExp, calculateClassExp, createDefaultStatUpgrades } from '../../types/auth';
import { CLASS_CONFIGS } from '../../constants/rpgConfig';
import { soundManager } from '../../services/SoundManager';
import { wsClient } from '../../services/WebSocketClient';

export const RPGModeScreen: React.FC = () => {
  // 게임 루프 시작
  const { requestSkill } = useRPGGameLoop();
  useRPGKeyboard(requestSkill);

  const gameOver = useRPGGameOver();
  const result = useRPGResult();
  const resetGame = useRPGStore((state) => state.resetGame);
  const setScreen = useUIStore((state) => state.setScreen);
  const profile = useAuthProfile();
  const isGuest = useAuthIsGuest();
  // handleGameEnd는 useEffect에서 직접 getState()로 호출하여 의존성 문제 방지
  const lastGameResult = useLastGameResult();
  const clearLastGameResult = useProfileStore((state) => state.clearLastGameResult);
  const selectedClass = useSelectedClass();
  const classProgressList = useClassProgress();
  const multiplayer = useRPGStore((state) => state.multiplayer);
  const isMultiplayer = multiplayer.isMultiplayer;
  const isHost = multiplayer.isHost;

  // 레벨업 알림 상태
  const [levelUpResult, setLevelUpResult] = useState<LevelUpResult | null>(null);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const expSavedRef = useRef(false);

  // 게임 초기화 (이미 실행 중이면 초기화하지 않음)
  useEffect(() => {
    const state = useRPGStore.getState();
    // 멀티플레이어 모드면 initMultiplayerGame이 이미 호출됨 - 초기화 스킵
    // 이미 영웅이 있고 게임이 실행 중이면 (일시정지에서 돌아온 경우) 초기화하지 않음
    if (!state.hero && !state.multiplayer.isMultiplayer) {
      // 싱글플레이어 모드: 선택된 클래스의 캐릭터 레벨과 SP 스탯 업그레이드 가져오기
      const heroClass = state.selectedClass || 'warrior';
      const classProgress = classProgressList.find(p => p.className === heroClass);
      const characterLevel = classProgress?.classLevel ?? 1;
      const statUpgrades = classProgress?.statUpgrades ?? createDefaultStatUpgrades();

      useRPGStore.getState().initGame(characterLevel, statUpgrades);
      // 게임 시작 시에만 레퍼런스 초기화 (새 게임일 때만)
      expSavedRef.current = false;
    }
    // classProgressList 변경 시 expSavedRef를 초기화하지 않음 (중복 경험치 저장 방지)

    // 언마운트 시 정리하지 않음 - 메인 메뉴로 돌아갈 때만 PauseScreen에서 resetGame 호출
  }, [classProgressList]);

  // 게임 오버 시 경험치 저장
  useEffect(() => {
    // profile 객체 참조 변경으로 인한 중복 실행 방지
    // getState()로 현재 프로필을 가져와서 확인
    const currentProfile = useAuthStore.getState().profile;

    // 게스트가 아니고 아직 저장하지 않은 경우에만 경험치 저장
    if (gameOver && result && currentProfile && !currentProfile.isGuest && !expSavedRef.current) {
      expSavedRef.current = true;

      // 경험치 저장
      useProfileStore.getState().handleGameEnd({
        mode: 'single',
        classUsed: result.heroClass,
        basesDestroyed: result.basesDestroyed,
        bossesKilled: result.bossesKilled,
        kills: result.totalKills,
        playTime: result.timePlayed,
        victory: result.victory,
      }).then((levelResult) => {
        if (levelResult && (levelResult.playerLeveledUp || levelResult.classLeveledUp)) {
          setLevelUpResult(levelResult);
          setShowLevelUp(true);
          soundManager.play('level_up');
        }
      });
    }
  }, [gameOver, result]);  // profile을 의존성에서 제거 - getState()로 직접 가져옴

  // 스킬 사용 핸들러
  const handleUseSkill = useCallback(
    (skillType: SkillType) => {
      const success = requestSkill(skillType);
      if (success) {
        switch (skillType) {
          // 구버전 스킬
          case 'dash':
          case 'spin':
            soundManager.play('attack_melee');
            break;
          case 'heal':
            soundManager.play('heal');
            break;
          // 신규 클래스별 스킬 - 근접 공격
          case 'warrior_strike':
          case 'warrior_charge':
          case 'knight_bash':
          case 'knight_charge':
            soundManager.play('attack_melee');
            break;
          // 원거리 공격
          case 'archer_shot':
          case 'archer_pierce':
          case 'archer_rain':
          case 'mage_bolt':
          case 'mage_fireball':
          case 'mage_meteor':
            soundManager.play('attack_ranged');
            break;
          // 버프 스킬
          case 'warrior_berserker':
          case 'knight_ironwall':
            soundManager.play('heal');
            break;
        }
      }
    },
    [requestSkill]
  );

  // 게임 오버 시 대기방 로비로 이동
  const handleBackToMenu = useCallback(() => {
    resetGame();
    clearLastGameResult();
    setLevelUpResult(null);
    setShowLevelUp(false);
    setScreen('rpgCoopLobby');
  }, [resetGame, clearLastGameResult, setScreen]);

  const handleRetry = useCallback(() => {
    resetGame();
    clearLastGameResult();
    setLevelUpResult(null);
    setShowLevelUp(false);
    expSavedRef.current = false;

    // 선택된 클래스의 캐릭터 레벨과 SP 스탯 업그레이드 가져오기
    const state = useRPGStore.getState();
    const heroClass = state.selectedClass || 'warrior';
    const classProgress = classProgressList.find(p => p.className === heroClass);
    const characterLevel = classProgress?.classLevel ?? 1;
    const statUpgrades = classProgress?.statUpgrades ?? createDefaultStatUpgrades();

    useRPGStore.getState().initGame(characterLevel, statUpgrades);
  }, [resetGame, clearLastGameResult, classProgressList]);

  // 멀티플레이어: 로비로 돌아가기 (호스트만)
  const handleReturnToLobby = useCallback(() => {
    wsClient.returnToLobby();
  }, []);

  // 멀티플레이어: 게임 재시작 (호스트만)
  const handleRestartGame = useCallback(() => {
    wsClient.restartCoopGame();
  }, []);

  // 멀티플레이어: 방 파기 후 대기방으로 이동 (호스트만)
  const handleDestroyRoom = useCallback(() => {
    wsClient.destroyCoopRoom();
    useRPGStore.getState().resetMultiplayerState();
    resetGame();
    clearLastGameResult();
    setLevelUpResult(null);
    setShowLevelUp(false);
    setScreen('rpgCoopLobby');
  }, [resetGame, clearLastGameResult, setScreen]);

  // 멀티플레이어: 방 나가기 (클라이언트)
  const handleLeaveRoom = useCallback(() => {
    wsClient.leaveCoopRoom();
    useRPGStore.getState().resetMultiplayerState();
    resetGame();
    clearLastGameResult();
    setLevelUpResult(null);
    setShowLevelUp(false);
    setScreen('rpgCoopLobby');
  }, [resetGame, clearLastGameResult, setScreen]);

  // 레벨업 알림 닫기
  const handleCloseLevelUp = useCallback(() => {
    setShowLevelUp(false);
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-dark-900">
      {/* 메인 캔버스 */}
      <RPGCanvas />

      {/* 상단 중앙 타이머 */}
      <RPGGameTimer />

      {/* 상단 UI */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
        {/* 왼쪽: 영웅 정보 + 아군 정보 */}
        <div className="pointer-events-auto">
          <RPGHeroPanel />
          <RPGTeamPanel />
        </div>

        {/* 오른쪽: 웨이브 정보 */}
        <div className="pointer-events-auto">
          <RPGWaveInfo />
        </div>
      </div>

      {/* 알림 */}
      <Notification />

      {/* 하단 UI - 스킬바 + 업그레이드 패널 (한 줄로 통합) */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-auto">
        <div className="flex gap-3 bg-dark-800/90 backdrop-blur-sm rounded-xl p-3 border border-dark-600/50">
          {/* 스킬바 */}
          <RPGSkillBar onUseSkill={handleUseSkill} />

          {/* 구분선 */}
          {!gameOver && <div className="w-px bg-dark-500/50 my-1" />}

          {/* 업그레이드 패널 */}
          {!gameOver && <RPGUpgradePanel />}
        </div>
      </div>

      {/* 조작법 안내 */}
      <div className="absolute bottom-4 left-4 text-xs text-gray-500 pointer-events-none">
        <div>WASD: 이동 | 자동 공격 | Shift: 스킬 | R: 궁극기 | C: 사거리 | Space: 카메라</div>
      </div>

      {/* 게임 오버 모달 */}
      {gameOver && result && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-50">
          <div className="bg-dark-800/95 backdrop-blur-sm rounded-2xl p-8 border border-dark-600/50 min-w-[400px]">
            {/* 결과 헤더 */}
            <div className="text-center mb-6">
              <div className={`text-4xl font-bold mb-2 ${result.victory ? 'text-green-400' : 'text-red-400'}`}>
                {result.victory ? '🏆 승리!' : '💀 게임 오버'}
              </div>
              <div className="text-gray-400">
                {result.victory
                  ? '모든 보스를 처치했습니다!'
                  : result.basesDestroyed > 0
                    ? `${result.basesDestroyed}개 기지 파괴`
                    : '넥서스가 파괴되었습니다'
                }
              </div>
            </div>

            {/* 통계 */}
            <div className="space-y-3 mb-6">
              <div className="flex justify-between bg-dark-700/50 rounded-lg p-3">
                <span className="text-gray-400">기지 파괴</span>
                <span className="text-red-400 font-bold">{result.basesDestroyed}/{result.totalBases}</span>
              </div>
              <div className="flex justify-between bg-dark-700/50 rounded-lg p-3">
                <span className="text-gray-400">보스 처치</span>
                <span className="text-purple-400 font-bold">{result.bossesKilled}/{result.totalBosses}</span>
              </div>
              <div className="flex justify-between bg-dark-700/50 rounded-lg p-3">
                <span className="text-gray-400">총 처치</span>
                <span className="text-red-400 font-bold">{result.totalKills}</span>
              </div>
              <div className="flex justify-between bg-dark-700/50 rounded-lg p-3">
                <span className="text-gray-400">획득 골드</span>
                <span className="text-yellow-400 font-bold">{result.totalGoldEarned}</span>
              </div>
              <div className="flex justify-between bg-dark-700/50 rounded-lg p-3">
                <span className="text-gray-400">플레이 시간</span>
                <span className="text-white font-bold">
                  {Math.floor(result.timePlayed / 60)}:{String(Math.floor(result.timePlayed % 60)).padStart(2, '0')}
                </span>
              </div>
            </div>

            {/* 계정 경험치 (비게스트만 표시 - 즉시 계산하여 표시) */}
            {!isGuest && (
              <div className="mb-6 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                <h4 className="text-purple-400 font-bold text-sm mb-2">계정 경험치 획득</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">플레이어 EXP</span>
                    <span className="text-yellow-400 font-bold">
                      +{lastGameResult?.playerExpGained ?? calculatePlayerExp(
                        result.basesDestroyed,
                        result.bossesKilled,
                        result.totalKills,
                        result.timePlayed,
                        result.victory,
                        'single'
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">클래스 EXP ({CLASS_CONFIGS[result.heroClass]?.name || result.heroClass})</span>
                    <span className="text-cyan-400 font-bold">
                      +{lastGameResult?.classExpGained ?? calculateClassExp(
                        result.basesDestroyed,
                        result.bossesKilled,
                        result.totalKills
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div style={{ height: '10px' }} />

            {/* 게스트 안내 */}
            {isGuest && (
              <div className="mb-6 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-yellow-300 text-xs text-center">
                  게스트 모드에서는 진행 상황이 저장되지 않습니다.
                </p>
              </div>
            )}

            <div style={{ height: '10px' }} />

            {/* 버튼 */}
            {isMultiplayer ? (
              // 멀티플레이어 버튼
              <div className="flex flex-col gap-3">
                {isHost ? (
                  // 호스트 버튼
                  <>
                    <button
                      onClick={handleRestartGame}
                      className="w-full px-6 py-3 bg-neon-cyan/20 hover:bg-neon-cyan/30 text-neon-cyan rounded-lg font-bold transition-colors cursor-pointer"
                    >
                      게임 재시작
                    </button>
                    <button
                      onClick={handleReturnToLobby}
                      className="w-full px-6 py-3 bg-dark-700 hover:bg-dark-600 text-white rounded-lg font-bold transition-colors cursor-pointer"
                    >
                      로비로 돌아가기
                    </button>
                    <button
                      onClick={handleDestroyRoom}
                      className="w-full px-6 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg font-bold transition-colors cursor-pointer"
                    >
                      나가기
                    </button>
                  </>
                ) : (
                  // 클라이언트 버튼
                  <>
                    <div className="text-center text-gray-400 py-2">
                      호스트의 결정을 기다리는 중...
                    </div>
                    <button
                      onClick={handleLeaveRoom}
                      className="w-full px-6 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg font-bold transition-colors cursor-pointer"
                    >
                      방 나가기
                    </button>
                  </>
                )}
              </div>
            ) : (
              // 싱글플레이어 버튼
              <div className="flex gap-3">
                <button
                  onClick={handleRetry}
                  className="flex-1 px-6 py-3 bg-neon-cyan/20 hover:bg-neon-cyan/30 text-neon-cyan rounded-lg font-bold transition-colors cursor-pointer"
                >
                  다시 시작
                </button>
                <button
                  onClick={handleBackToMenu}
                  className="flex-1 px-6 py-3 bg-dark-700 hover:bg-dark-600 text-white rounded-lg font-bold transition-colors cursor-pointer"
                >
                  메뉴로
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 레벨업 알림 */}
      {showLevelUp && levelUpResult && (
        <LevelUpNotification
          result={levelUpResult}
          onClose={handleCloseLevelUp}
        />
      )}

      {/* 게임 재시작 카운트다운 오버레이 (멀티플레이어) */}
      {isMultiplayer && multiplayer.connectionState === 'countdown' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-[60]">
          <div className="text-center">
            <p className="text-2xl text-gray-300 mb-4">게임 재시작</p>
            <p className="text-8xl font-bold text-neon-cyan animate-pulse">
              {multiplayer.countdown || 3}
            </p>
          </div>
        </div>
      )}

      {/* 하단 코너 장식 */}
      <div className="absolute bottom-0 left-0 w-24 h-24 border-l border-b border-yellow-500/20 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-24 h-24 border-r border-b border-yellow-500/20 pointer-events-none" />
    </div>
  );
};
