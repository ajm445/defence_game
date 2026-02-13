import React, { useEffect, useCallback, useState, useRef } from 'react';
import { useRPGGameLoop } from '../../hooks/useRPGGameLoop';
import { useRPGKeyboard } from '../../hooks/useRPGInput';
import { RPGCanvas } from '../canvas/RPGCanvas';
import { RPGHeroPanel, RPGTeamPanel } from '../ui/RPGHeroPanel';
import { RPGSkillBar } from '../ui/RPGSkillBar';
import { RPGWaveInfo } from '../ui/RPGWaveInfo';
import { RPGGameTimer } from '../ui/RPGGameTimer';
import { RPGUpgradePanel } from '../ui/RPGUpgradePanel';
import { RPGScreenEffects } from '../ui/RPGScreenEffects';
import { RPGDamageNumbers } from '../ui/RPGDamageNumbers';
import { Notification } from '../ui/Notification';
import { PauseButton } from '../ui/PauseButton';
import { RPGTouchControls } from '../touch/RPGTouchControls';
import { LevelUpNotification } from '../ui/LevelUpNotification';
import { SecondEnhancementNotification } from '../ui/SecondEnhancementNotification';
import { AdvancedHeroClass } from '../../types/rpg';
import { useRPGStore, useRPGGameOver, useRPGResult, useSelectedClass, usePersonalKills, useSelectedDifficulty } from '../../stores/useRPGStore';
import { useUIStore } from '../../stores/useUIStore';
import { useAuthStore, useAuthProfile, useAuthIsGuest } from '../../stores/useAuthStore';
import { useProfileStore, useClassProgress } from '../../stores/useProfileStore';
import { SkillType } from '../../types/rpg';
import { LevelUpResult, calculatePlayerExp, calculateClassExp, VIP_EXP_MULTIPLIER } from '../../types/auth';
import { CLASS_CONFIGS } from '../../constants/rpgConfig';
import { soundManager } from '../../services/SoundManager';
import { wsClient } from '../../services/WebSocketClient';
import { saveExtremeRanking, RankingPlayer } from '../../services/rankingService';
import { tryExitFullscreen, tryEnterFullscreen, setTabletGameActive } from '../../hooks/useDeviceDetect';

export const RPGModeScreen: React.FC = () => {
  // 게임 루프 시작
  const { requestSkill } = useRPGGameLoop();
  useRPGKeyboard(requestSkill);

  const gameOver = useRPGGameOver();
  const result = useRPGResult();
  const resetGame = useRPGStore((state) => state.resetGame);
  const setScreen = useUIStore((state) => state.setScreen);
  const isMobile = useUIStore((s) => s.isMobile);
  const isTablet = useUIStore((s) => s.isTablet);
  const isTouchDevice = useUIStore((s) => s.isTouchDevice);
  const profile = useAuthProfile();
  const isGuest = useAuthIsGuest();
  const clearLastGameResult = useProfileStore((state) => state.clearLastGameResult);
  const selectedClass = useSelectedClass();
  const classProgressList = useClassProgress();
  const multiplayer = useRPGStore((state) => state.multiplayer);
  const isHost = multiplayer.isHost;
  const personalKills = usePersonalKills();
  const selectedDifficulty = useSelectedDifficulty();

  // 레벨업 알림 상태
  const [levelUpResult, setLevelUpResult] = useState<LevelUpResult | null>(null);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const expSavedRef = useRef(false);

  // 2차 강화 알림 상태
  const [showSecondEnhancement, setShowSecondEnhancement] = useState(false);
  const [enhancedClass, setEnhancedClass] = useState<AdvancedHeroClass | null>(null);

  // 태블릿 인게임: 전체화면 해제 (캔버스 레이아웃 호환성)
  // RPG는 결과 화면이 이 컴포넌트 내 오버레이이므로, 사용자가 나갈 때까지 전체화면 비활성화 유지
  useEffect(() => {
    if (!isTablet) return;
    setTabletGameActive(true);
    tryExitFullscreen();
    return () => {
      setTabletGameActive(false);
      tryEnterFullscreen();
    };
  }, [isTablet]);

  // 게임 초기화: 멀티플레이어 모드에서는 initMultiplayerGame이 useNetworkSync에서 호출됨
  // 이 컴포넌트는 이미 초기화된 상태에서 마운트됨
  // 언마운트 시 정리하지 않음 - 메인 메뉴로 돌아갈 때만 PauseScreen에서 resetGame 호출

  // 게임 오버 시 경험치 저장
  useEffect(() => {
    // profile 객체 참조 변경으로 인한 중복 실행 방지
    // getState()로 현재 프로필을 가져와서 확인
    const currentProfile = useAuthStore.getState().profile;

    // 게스트가 아니고 아직 저장하지 않은 경우에만 경험치 저장
    if (gameOver && result && currentProfile && !currentProfile.isGuest && !expSavedRef.current) {
      expSavedRef.current = true;

      const rpgState = useRPGStore.getState();
      const killsForExp = rpgState.personalKills;

      // 극한 난이도 승리 시 랭킹 저장 (호스트만)
      if (result.victory && rpgState.selectedDifficulty === 'extreme' && rpgState.multiplayer.isHost) {
        const rankingPlayers: RankingPlayer[] = rpgState.multiplayer.players.map(p => {
          const playerClassProgress = useProfileStore.getState().classProgress.find(cp => cp.className === p.heroClass);
          const advClass = p.advancedClass as AdvancedHeroClass | undefined;
          return {
            playerId: p.id,
            nickname: p.name,
            heroClass: p.heroClass,
            advancedClass: advClass,
            characterLevel: p.characterLevel || playerClassProgress?.classLevel || 1,
          } as RankingPlayer;
        });

        const playerCount = rankingPlayers.length;
        saveExtremeRanking(playerCount, result.timePlayed, rankingPlayers);
      }

      // 경험치 저장 (난이도 배율 적용)
      useProfileStore.getState().handleGameEnd({
        mode: 'coop',
        classUsed: result.heroClass,
        basesDestroyed: result.basesDestroyed,
        bossesKilled: result.bossesKilled,
        kills: killsForExp,
        playTime: result.timePlayed,
        victory: result.victory,
        difficulty: rpgState.selectedDifficulty,
      }).then((levelResult) => {
        if (levelResult && (levelResult.playerLeveledUp || levelResult.classLeveledUp)) {
          setLevelUpResult(levelResult);
          setShowLevelUp(true);
          soundManager.play('level_up');

          // 2차 강화 체크: 레벨 40 도달 + 1차 전직 완료 + 아직 2차 강화 안함
          if (levelResult.classLeveledUp && levelResult.newClassLevel && levelResult.newClassLevel >= 40 && levelResult.className) {
            const classProgress = useProfileStore.getState().classProgress.find(p => p.className === levelResult.className);
            if (classProgress && classProgress.advancedClass && classProgress.tier !== 2) {
              // 2차 강화 서버 저장 및 알림
              useProfileStore.getState().applySecondEnhancementAction(levelResult.className).then((success) => {
                if (success) {
                  setEnhancedClass(classProgress.advancedClass as AdvancedHeroClass);
                  // 레벨업 알림이 닫힌 후 2차 강화 알림을 표시하기 위해 약간의 딜레이
                }
              });
            }
          }
        }
      });
    }
  }, [gameOver, result, classProgressList]);  // classProgressList 의존성 추가

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
    // 2차 강화 알림이 대기 중이면 표시
    if (enhancedClass) {
      setShowSecondEnhancement(true);
    }
  }, [enhancedClass]);

  // 2차 강화 알림 닫기
  const handleCloseSecondEnhancement = useCallback(() => {
    setShowSecondEnhancement(false);
    setEnhancedClass(null);
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden bg-dark-900">
      {/* 메인 캔버스 */}
      <RPGCanvas />

      {/* 피격/위험 화면 효과 */}
      <RPGScreenEffects />

      {/* 플로팅 데미지 숫자 */}
      <RPGDamageNumbers />

      {/* 상단 중앙 타이머 */}
      <RPGGameTimer />

      {/* 상단 UI */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
        {/* 왼쪽: 영웅 정보 + 아군 정보 */}
        <div className="pointer-events-auto">
          <RPGHeroPanel />
          <RPGTeamPanel />
        </div>

        {/* 오른쪽: 웨이브 정보 + 일시정지 버튼 (터치 기기만) */}
        <div className="pointer-events-auto flex items-start gap-2">
          <RPGWaveInfo />
          {isTouchDevice && (
            <PauseButton onClick={() => {
              if (!gameOver) {
                const state = useRPGStore.getState();
                if (state.isTutorial) {
                  useRPGStore.getState().setPaused(!state.paused);
                } else {
                  useUIStore.getState().setScreen('paused');
                  useRPGStore.getState().setPaused(true);
                }
              }
            }} />
          )}
        </div>
      </div>

      {/* 알림 */}
      <Notification />

      {/* 하단 UI - 스킬바 + 업그레이드 패널 (데스크톱만) */}
      {!isTouchDevice && (
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
      )}

      {/* 조작법 안내 (데스크톱만) */}
      {!isTouchDevice && (
        <div className="absolute bottom-4 left-4 text-xs text-gray-500 pointer-events-none">
          <div>WASD: 이동 | 자동 공격 | Shift: 스킬 | R: 궁극기 | C: 사거리 | Space: 카메라</div>
        </div>
      )}

      {/* 터치 컨트롤 (터치 디바이스만) */}
      {isTouchDevice && !gameOver && (
        <RPGTouchControls requestSkill={requestSkill} onUseSkill={handleUseSkill} />
      )}

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
                <span className="text-gray-400">개인 처치</span>
                <span className="text-red-400 font-bold">{personalKills}</span>
              </div>
              <div className="flex justify-between bg-dark-700/50 rounded-lg p-3">
                <span className="text-gray-400">팀 처치</span>
                <span className="text-orange-400 font-bold">{result.totalKills}</span>
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
            {!isGuest && (() => {
              const isVip = profile?.role === 'vip';
              // 기본 경험치 (VIP 보너스 미적용)
              const basePlayerExp = calculatePlayerExp(
                result.basesDestroyed,
                result.bossesKilled,
                personalKills,
                result.timePlayed,
                result.victory,
                'coop',
                selectedDifficulty,
                false  // VIP 보너스 미적용
              );
              const baseClassExp = calculateClassExp(
                result.basesDestroyed,
                result.bossesKilled,
                personalKills,
                selectedDifficulty,
                result.victory,
                false  // VIP 보너스 미적용
              );
              // 최종 경험치 (VIP 보너스 적용) - 로컬 계산만 사용하여 두 번 렌더링 방지
              const finalPlayerExp = isVip ? Math.floor(basePlayerExp * VIP_EXP_MULTIPLIER) : basePlayerExp;
              const finalClassExp = isVip ? Math.floor(baseClassExp * VIP_EXP_MULTIPLIER) : baseClassExp;
              // VIP 보너스 경험치
              const vipBonusPlayerExp = isVip ? finalPlayerExp - basePlayerExp : 0;
              const vipBonusClassExp = isVip ? finalClassExp - baseClassExp : 0;

              return (
                <div className={`mb-6 p-4 rounded-lg ${isVip ? 'bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/30' : 'bg-purple-500/10 border border-purple-500/30'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className={`font-bold text-sm ${isVip ? 'text-amber-400' : 'text-purple-400'}`}>계정 경험치 획득</h4>
                    {isVip && (
                      <span className="px-2 py-0.5 bg-gradient-to-r from-amber-500 to-yellow-500 rounded text-xs text-white font-bold shadow-lg shadow-amber-500/30">
                        VIP ×2
                      </span>
                    )}
                  </div>
                  {isVip && (
                    <p className="text-amber-300/80 text-xs mb-3">👑 VIP 보너스 경험치 2배 적용!</p>
                  )}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">플레이어 EXP</span>
                      <div className="flex items-center gap-2">
                        {isVip && (
                          <span className="text-gray-500 text-xs line-through">{basePlayerExp}</span>
                        )}
                        <span className="text-yellow-400 font-bold">
                          +{finalPlayerExp}
                        </span>
                        {isVip && vipBonusPlayerExp > 0 && (
                          <span className="text-amber-400 text-xs">(+{vipBonusPlayerExp})</span>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">클래스 EXP ({CLASS_CONFIGS[result.heroClass]?.name || result.heroClass})</span>
                      <div className="flex items-center gap-2">
                        {isVip && (
                          <span className="text-gray-500 text-xs line-through">{baseClassExp}</span>
                        )}
                        <span className="text-cyan-400 font-bold">
                          +{finalClassExp}
                        </span>
                        {isVip && vipBonusClassExp > 0 && (
                          <span className="text-amber-400 text-xs">(+{vipBonusClassExp})</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

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
                    방장의 결정을 기다리는 중...
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

      {/* 2차 강화 알림 */}
      {showSecondEnhancement && enhancedClass && (
        <SecondEnhancementNotification
          advancedClass={enhancedClass}
          onClose={handleCloseSecondEnhancement}
        />
      )}

      {/* 게임 재시작 카운트다운 오버레이 */}
      {multiplayer.connectionState === 'countdown' && (
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
      {!isMobile && !isTablet && (<>
        <div className="absolute bottom-0 left-0 w-24 h-24 border-l border-b border-yellow-500/20 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-24 h-24 border-r border-b border-yellow-500/20 pointer-events-none" />
      </>)}
    </div>
  );
};
