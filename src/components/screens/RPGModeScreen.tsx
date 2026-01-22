import React, { useEffect, useCallback } from 'react';
import { useRPGGameLoop } from '../../hooks/useRPGGameLoop';
import { useRPGKeyboard } from '../../hooks/useRPGInput';
import { RPGCanvas } from '../canvas/RPGCanvas';
import { RPGHeroPanel } from '../ui/RPGHeroPanel';
import { RPGSkillBar } from '../ui/RPGSkillBar';
import { RPGWaveInfo } from '../ui/RPGWaveInfo';
import { RPGGameTimer } from '../ui/RPGGameTimer';
import { Notification } from '../ui/Notification';
import { useRPGStore, useRPGGameOver, useRPGResult } from '../../stores/useRPGStore';
import { useUIStore } from '../../stores/useUIStore';
import { SkillType } from '../../types/rpg';
import { soundManager } from '../../services/SoundManager';

export const RPGModeScreen: React.FC = () => {
  // 게임 루프 시작
  const { requestSkill } = useRPGGameLoop();
  useRPGKeyboard(requestSkill);

  const gameOver = useRPGGameOver();
  const result = useRPGResult();
  const resetGame = useRPGStore((state) => state.resetGame);
  const setScreen = useUIStore((state) => state.setScreen);

  // 게임 초기화 (이미 실행 중이면 초기화하지 않음)
  useEffect(() => {
    const state = useRPGStore.getState();
    // 이미 영웅이 있고 게임이 실행 중이면 (일시정지에서 돌아온 경우) 초기화하지 않음
    if (!state.hero) {
      useRPGStore.getState().initGame();
    }

    // 언마운트 시 정리하지 않음 - 메인 메뉴로 돌아갈 때만 PauseScreen에서 resetGame 호출
  }, []);

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

  // 게임 오버 시 결과 화면으로 이동
  const handleBackToMenu = useCallback(() => {
    resetGame();
    setScreen('modeSelect');
  }, [resetGame, setScreen]);

  const handleRetry = useCallback(() => {
    resetGame();
    useRPGStore.getState().initGame();
  }, [resetGame]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-dark-900">
      {/* 메인 캔버스 */}
      <RPGCanvas />

      {/* 상단 중앙 타이머 */}
      <RPGGameTimer mode="single" />

      {/* 상단 UI */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
        {/* 왼쪽: 영웅 정보 */}
        <div className="pointer-events-auto">
          <RPGHeroPanel />
        </div>

        {/* 오른쪽: 웨이브 정보 */}
        <div className="pointer-events-auto">
          <RPGWaveInfo />
        </div>
      </div>

      {/* 알림 */}
      <Notification />

      {/* 하단 UI - 스킬바 */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-auto">
        <RPGSkillBar onUseSkill={handleUseSkill} />
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
                웨이브 {result.waveReached}까지 도달
              </div>
            </div>

            {/* 통계 */}
            <div className="space-y-3 mb-6">
              <div className="flex justify-between bg-dark-700/50 rounded-lg p-3">
                <span className="text-gray-400">최종 레벨</span>
                <span className="text-yellow-400 font-bold">Lv.{result.heroLevel}</span>
              </div>
              <div className="flex justify-between bg-dark-700/50 rounded-lg p-3">
                <span className="text-gray-400">총 처치</span>
                <span className="text-red-400 font-bold">{result.totalKills}</span>
              </div>
              <div className="flex justify-between bg-dark-700/50 rounded-lg p-3">
                <span className="text-gray-400">획득 경험치</span>
                <span className="text-blue-400 font-bold">{result.totalExp}</span>
              </div>
              <div className="flex justify-between bg-dark-700/50 rounded-lg p-3">
                <span className="text-gray-400">플레이 시간</span>
                <span className="text-white font-bold">
                  {Math.floor(result.timePlayed / 60)}:{String(Math.floor(result.timePlayed % 60)).padStart(2, '0')}
                </span>
              </div>
            </div>

            {/* 버튼 */}
            <div className="flex gap-3">
              <button
                onClick={handleRetry}
                className="flex-1 px-6 py-3 bg-neon-cyan/20 hover:bg-neon-cyan/30 text-neon-cyan rounded-lg font-bold transition-colors"
              >
                다시 시작
              </button>
              <button
                onClick={handleBackToMenu}
                className="flex-1 px-6 py-3 bg-dark-700 hover:bg-dark-600 text-white rounded-lg font-bold transition-colors"
              >
                메뉴로
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 하단 코너 장식 */}
      <div className="absolute bottom-0 left-0 w-24 h-24 border-l border-b border-yellow-500/20 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-24 h-24 border-r border-b border-yellow-500/20 pointer-events-none" />
    </div>
  );
};
