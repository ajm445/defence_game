import React, { useEffect, useCallback, useRef, useState } from 'react';
import { useRPGGameLoop } from '../../hooks/useRPGGameLoop';
import { useRPGKeyboard } from '../../hooks/useRPGInput';
import { RPGCanvas } from '../canvas/RPGCanvas';
import { RPGHeroPanel } from '../ui/RPGHeroPanel';
import { RPGSkillBar } from '../ui/RPGSkillBar';
import { RPGGameTimer } from '../ui/RPGGameTimer';
import { RPGUpgradePanel } from '../ui/RPGUpgradePanel';
import { RPGScreenEffects } from '../ui/RPGScreenEffects';
import { RPGDamageNumbers } from '../ui/RPGDamageNumbers';
import { Notification } from '../ui/Notification';
import { RPGTutorialOverlay } from '../ui/RPGTutorialOverlay';
import { useRPGStore, useRPGGameOver, useRPGResult } from '../../stores/useRPGStore';
import { useUIStore } from '../../stores/useUIStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useRPGTutorialStore, useTutorialActive, useTutorialCompleted, useTutorialTargetPosition } from '../../stores/useRPGTutorialStore';
import { SkillType } from '../../types/rpg';
import { soundManager } from '../../services/SoundManager';

export const RPGTutorialScreen: React.FC = () => {
  // 게임 루프 시작
  const { requestSkill } = useRPGGameLoop();
  useRPGKeyboard(requestSkill);

  const gameOver = useRPGGameOver();
  const result = useRPGResult();
  const paused = useRPGStore((state) => state.paused);
  const setPaused = useRPGStore((state) => state.setPaused);
  const resetGame = useRPGStore((state) => state.resetGame);
  const initTutorialGame = useRPGStore((state) => state.initTutorialGame);
  const setScreen = useUIStore((state) => state.setScreen);
  const soundVolume = useUIStore((state) => state.soundVolume);
  const soundMuted = useUIStore((state) => state.soundMuted);
  const setSoundVolume = useUIStore((state) => state.setSoundVolume);
  const setSoundMuted = useUIStore((state) => state.setSoundMuted);
  const isMobile = useUIStore((s) => s.isMobile);
  const isTablet = useUIStore((s) => s.isTablet);
  const saveSoundSettings = useAuthStore((state) => state.saveSoundSettings);

  const isActive = useTutorialActive();
  const isCompleted = useTutorialCompleted();

  const [showSettings, setShowSettings] = useState(false);
  const startTutorial = useRPGTutorialStore((state) => state.startTutorial);
  const endTutorial = useRPGTutorialStore((state) => state.endTutorial);
  const resetTutorial = useRPGTutorialStore((state) => state.reset);
  const setConditionMet = useRPGTutorialStore((state) => state.setConditionMet);

  const initRef = useRef(false);

  // 게임 초기화
  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      resetTutorial();
      initTutorialGame();
      startTutorial();
    }

    return () => {
      // 언마운트 시 정리
      initRef.current = false;
    };
  }, [initTutorialGame, startTutorial, resetTutorial]);

  // 튜토리얼 조건 체크를 위한 이벤트 구독
  useEffect(() => {
    // 이동 감지 (여러 목표 위치 순회)
    const unsubMove = useRPGStore.subscribe(
      (state) => state.hero,
      (hero) => {
        if (!hero) return;

        // 목표 위치가 있으면 도달 여부 체크
        const targetPos = useRPGTutorialStore.getState().targetPosition;
        if (targetPos) {
          const dx = hero.x - targetPos.x;
          const dy = hero.y - targetPos.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance <= targetPos.radius) {
            // 다음 목표로 진행, 모두 완료되면 조건 충족
            const allCompleted = useRPGTutorialStore.getState().advanceMovementTarget();
            if (allCompleted) {
              setConditionMet('hero_moved');
            }
          }
        }
      }
    );

    // 적 처치 감지 (자동공격으로 적 처치)
    const unsubKills = useRPGStore.subscribe(
      (state) => state.stats?.totalKills,
      (kills, prevKills) => {
        if (kills !== undefined && kills > (prevKills || 0)) {
          setConditionMet('enemy_killed');
        }
      }
    );

    // 스킬 사용 감지 (W 스킬 - Shift) - 쿨다운 변화로 감지
    const unsubSkillW = useRPGStore.subscribe(
      (state) => state.hero?.skills?.find(s => s.key === 'W')?.currentCooldown,
      (cooldown, prevCooldown) => {
        // 쿨다운이 증가하면 스킬 사용됨 (0에서 양수로)
        if (cooldown !== undefined && prevCooldown !== undefined && cooldown > prevCooldown) {
          setConditionMet('skill_w_used');
        }
      }
    );

    // 스킬 사용 감지 (E 스킬 - R 궁극기) - 쿨다운 변화로 감지
    const unsubSkillE = useRPGStore.subscribe(
      (state) => state.hero?.skills?.find(s => s.key === 'E')?.currentCooldown,
      (cooldown, prevCooldown) => {
        // 쿨다운이 증가하면 스킬 사용됨 (0에서 양수로)
        if (cooldown !== undefined && prevCooldown !== undefined && cooldown > prevCooldown) {
          setConditionMet('skill_e_used');
        }
      }
    );

    // 업그레이드 구매 감지
    const unsubUpgrade = useRPGStore.subscribe(
      (state) => state.upgradeLevels,
      (levels, prevLevels) => {
        if (levels && prevLevels) {
          const totalCurrent = Object.values(levels).reduce((a, b) => a + b, 0);
          const totalPrev = Object.values(prevLevels).reduce((a, b) => a + b, 0);
          if (totalCurrent > totalPrev) {
            setConditionMet('upgrade_purchased');
          }
        }
      }
    );

    // 적 기지 파괴 감지
    const unsubBase = useRPGStore.subscribe(
      (state) => state.enemyBases,
      (bases, prevBases) => {
        if (bases && prevBases) {
          const destroyedCount = bases.filter(b => b.destroyed).length;
          const prevDestroyedCount = prevBases.filter(b => b.destroyed).length;
          if (destroyedCount > prevDestroyedCount) {
            setConditionMet('base_destroyed');
          }
        }
      }
    );

    // 보스 처치 감지 (승리 조건)
    const unsubBoss = useRPGStore.subscribe(
      (state) => state.stats?.bossesKilled,
      (killed, prevKilled) => {
        if (killed && killed > (prevKilled || 0)) {
          setConditionMet('boss_killed');
        }
      }
    );

    return () => {
      unsubMove();
      unsubKills();
      unsubSkillW();
      unsubSkillE();
      unsubUpgrade();
      unsubBase();
      unsubBoss();
    };
  }, [setConditionMet]);

  // 스킬 사용 핸들러
  const handleUseSkill = useCallback(
    (skillType: SkillType) => {
      const success = requestSkill(skillType);
      if (success) {
        switch (skillType) {
          case 'archer_shot':
          case 'archer_pierce':
          case 'archer_rain':
            soundManager.play('attack_ranged');
            break;
          default:
            soundManager.play('attack_melee');
        }
      }
    },
    [requestSkill]
  );

  // 튜토리얼 건너뛰기
  const handleSkipTutorial = useCallback(() => {
    resetGame();
    endTutorial();
    resetTutorial();
    setScreen('rpgCoopLobby');
  }, [resetGame, endTutorial, resetTutorial, setScreen]);

  // 튜토리얼 완료 (사운드는 게임 루프에서 이미 재생됨)
  const handleCompleteTutorial = useCallback(() => {
    // 보스 처치 시 useRPGGameLoop에서 이미 victory 사운드 재생
  }, []);

  // 로비로 돌아가기
  const handleBackToMenu = useCallback(() => {
    resetGame();
    endTutorial();
    resetTutorial();
    setScreen('rpgCoopLobby');
  }, [resetGame, endTutorial, resetTutorial, setScreen]);

  // 다시 시작
  const handleRetry = useCallback(() => {
    resetGame();
    resetTutorial();
    initTutorialGame();
    startTutorial();
  }, [resetGame, resetTutorial, initTutorialGame, startTutorial]);

  // 일시정지 메뉴: 계속하기
  const handleResume = useCallback(() => {
    soundManager.play('ui_click');
    setPaused(false);
  }, [setPaused]);

  // 일시정지 메뉴: 다시하기
  const handlePauseRetry = useCallback(() => {
    soundManager.play('ui_click');
    setPaused(false);
    resetGame();
    resetTutorial();
    initTutorialGame();
    startTutorial();
  }, [setPaused, resetGame, resetTutorial, initTutorialGame, startTutorial]);

  // 일시정지 메뉴: 설정 토글
  const handleToggleSettings = useCallback(() => {
    soundManager.play('ui_click');
    if (!showSettings) {
      // 설정 열 때 soundManager 동기화
      soundManager.setVolume(soundVolume);
      soundManager.setBGMVolume(soundVolume);
      soundManager.setMuted(soundMuted);
    }
    setShowSettings(!showSettings);
  }, [showSettings, soundVolume, soundMuted]);

  // 볼륨 변경
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setSoundVolume(newVolume);
    soundManager.setVolume(newVolume);
    soundManager.setBGMVolume(newVolume);
    saveSoundSettings(newVolume, soundMuted);
  }, [setSoundVolume, saveSoundSettings, soundMuted]);

  // 음소거 토글
  const handleToggleMute = useCallback(() => {
    const newMuted = !soundMuted;
    setSoundMuted(newMuted);
    soundManager.setMuted(newMuted);
    saveSoundSettings(soundVolume, newMuted);
    if (!newMuted) {
      soundManager.play('ui_click');
    }
  }, [soundMuted, setSoundMuted, saveSoundSettings, soundVolume]);

  // 일시정지 메뉴: 나가기
  const handleExit = useCallback(() => {
    soundManager.play('ui_click');
    setPaused(false);
    resetGame();
    endTutorial();
    resetTutorial();
    setScreen('rpgCoopLobby');
  }, [setPaused, resetGame, endTutorial, resetTutorial, setScreen]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-dark-900">
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
        {/* 왼쪽: 영웅 정보 */}
        <div className="pointer-events-auto">
          <RPGHeroPanel />
        </div>

        {/* 오른쪽: 빈 공간 (튜토리얼에서는 웨이브 정보 생략) */}
        <div />
      </div>

      {/* 튜토리얼 오버레이 */}
      {isActive && (
        <RPGTutorialOverlay
          onSkip={handleSkipTutorial}
          onComplete={handleCompleteTutorial}
        />
      )}

      {/* 알림 */}
      <Notification />

      {/* 하단 UI - 스킬바 + 업그레이드 패널 */}
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
        <div>자동공격 | WASD: 이동 | Shift: 스킬 | R: 궁극기 | C: 사거리 | ESC: 일시정지</div>
      </div>

      {/* 튜토리얼 일시정지 메뉴 */}
      {paused && !gameOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-50">
          <div className="bg-dark-800/95 backdrop-blur-sm rounded-2xl p-8 border border-neon-cyan/50 min-w-[320px]">
            {/* 헤더 */}
            <div className="text-center mb-6">
              <div className="text-3xl font-bold text-neon-cyan mb-2">일시정지</div>
              <div className="text-gray-400 text-sm">튜토리얼</div>
            </div>

            {/* 버튼들 */}
            <div className="flex flex-col gap-3">
              <button
                onClick={handleResume}
                className="w-full px-6 py-3 bg-neon-cyan/20 hover:bg-neon-cyan/30 text-neon-cyan rounded-lg font-bold transition-colors cursor-pointer border border-neon-cyan/50"
              >
                계속하기
              </button>
              <button
                onClick={handlePauseRetry}
                className="w-full px-6 py-3 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg font-bold transition-colors cursor-pointer border border-yellow-500/50"
              >
                다시하기
              </button>
              <button
                onClick={handleToggleSettings}
                className="w-full px-6 py-3 bg-dark-700 hover:bg-dark-600 text-white rounded-lg font-bold transition-colors cursor-pointer border border-dark-500"
              >
                {showSettings ? '설정 닫기' : '설정'}
              </button>
              <button
                onClick={handleExit}
                className="w-full px-6 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg font-bold transition-colors cursor-pointer border border-red-500/50"
              >
                나가기
              </button>
            </div>

            {/* 설정 패널 (인라인) */}
            {showSettings && (
              <div className="mt-6 pt-6 border-t border-dark-600">
                <h3 className="text-white font-bold text-lg mb-4 text-center">소리 설정</h3>
                <div className="space-y-4">
                  {/* 음량 조절 */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-300">음량</span>
                      <span className="text-neon-cyan">{Math.round(soundVolume * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={soundVolume}
                      onChange={handleVolumeChange}
                      className="w-full h-2 bg-dark-600 rounded-lg appearance-none cursor-pointer accent-neon-cyan"
                    />
                  </div>
                  {/* 음소거 */}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">음소거</span>
                    <button
                      onClick={handleToggleMute}
                      className={`px-4 py-2 rounded-lg font-bold transition-colors cursor-pointer ${
                        soundMuted
                          ? 'bg-red-500/30 text-red-400 border border-red-500/50'
                          : 'bg-green-500/30 text-green-400 border border-green-500/50'
                      }`}
                    >
                      {soundMuted ? '🔇 OFF' : '🔊 ON'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 튜토리얼 완료 모달 */}
      {(isCompleted || (gameOver && result)) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-50">
          <div className="bg-dark-800/95 backdrop-blur-sm rounded-2xl p-8 border border-green-500/50 min-w-[400px]">
            {/* 결과 헤더 */}
            <div className="text-center mb-6">
              <div className={`text-4xl font-bold mb-2 ${result?.victory || isCompleted ? 'text-green-400' : 'text-red-400'}`}>
                {result?.victory || isCompleted ? '🎉 튜토리얼 완료!' : '💀 게임 오버'}
              </div>
              <div className="text-gray-400">
                {result?.victory || isCompleted
                  ? '기본적인 조작법을 익혔습니다!'
                  : '다시 도전해보세요!'
                }
              </div>
            </div>

            {/* 안내 메시지 */}
            <div className="mb-6 space-y-3">
              <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <p className="text-green-300 text-sm">
                  <span className="font-bold text-green-400">📈 레벨 시스템</span><br/>
                  게임을 플레이하면 경험치를 획득하여 레벨이 올라갑니다.<br/>
                  레벨이 오르면 능력치가 강화되어 더 높은 난이도에 도전할 수 있습니다!
                </p>
              </div>
              <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                <p className="text-purple-300 text-sm">
                  <span className="font-bold text-purple-400">🔓 캐릭터 해금</span><br/>
                  레벨을 올리면 새로운 캐릭터를 해금할 수 있습니다.<br/>
                  각 캐릭터는 고유한 스킬과 플레이 스타일을 가지고 있습니다!
                </p>
              </div>
              <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                <p className="text-cyan-300 text-sm text-center">
                  이제 실제 게임에서 다양한 직업과 난이도로 플레이해보세요!
                </p>
              </div>
            </div>

            {/* 버튼 */}
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
                로비로
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 하단 코너 장식 */}
      {!isMobile && !isTablet && (<>
        <div className="absolute bottom-0 left-0 w-24 h-24 border-l border-b border-green-500/20 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-24 h-24 border-r border-b border-green-500/20 pointer-events-none" />
      </>)}
    </div>
  );
};
