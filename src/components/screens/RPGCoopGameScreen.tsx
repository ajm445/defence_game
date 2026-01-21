import React, { useCallback, useEffect } from 'react';
import { useRPGCoopGameLoop } from '../../hooks/useRPGCoopGameLoop';
import { RPGCoopCanvas } from '../canvas/RPGCoopCanvas';
import { RPGCoopHeroPanel } from '../ui/RPGCoopHeroPanel';
import { RPGCoopReviveTimer } from '../ui/RPGCoopReviveTimer';
import { RPGSkillBar } from '../ui/RPGSkillBar';
import { RPGWaveInfo } from '../ui/RPGWaveInfo';
import { Notification } from '../ui/Notification';
import { useRPGCoopStore, useMyCoopHero, useCoopWaveInfo } from '../../stores/useRPGCoopStore';
import { useUIStore } from '../../stores/useUIStore';
import { soundManager } from '../../services/SoundManager';
import { CLASS_CONFIGS } from '../../constants/rpgConfig';
import type { SkillType } from '../../types/rpg';

export const RPGCoopGameScreen: React.FC = () => {
  // 게임 루프 시작
  useRPGCoopGameLoop();

  const gameResult = useRPGCoopStore((state) => state.gameResult);
  const reset = useRPGCoopStore((state) => state.reset);
  const leaveRoom = useRPGCoopStore((state) => state.leaveRoom);
  const useSkill = useRPGCoopStore((state) => state.useSkill);
  const setScreen = useUIStore((state) => state.setScreen);

  const myHero = useMyCoopHero();
  const waveInfo = useCoopWaveInfo();

  // 스킬 사용 핸들러
  const handleUseSkill = useCallback(
    (skillType: SkillType) => {
      if (!myHero || myHero.isDead) return;

      // 스킬 슬롯 매핑
      let slot: 'Q' | 'W' | 'E' | null = null;
      if (skillType.includes('_q') || skillType.endsWith('_strike') || skillType.endsWith('_shot') ||
          skillType.endsWith('_bash') || skillType.endsWith('_bolt')) {
        slot = 'Q';
      } else if (skillType.includes('_w') || skillType.endsWith('_charge') || skillType.endsWith('_pierce') ||
                 skillType.endsWith('_fireball')) {
        slot = 'W';
      } else if (skillType.includes('_e') || skillType.endsWith('_berserker') || skillType.endsWith('_rain') ||
                 skillType.endsWith('_ironwall') || skillType.endsWith('_meteor')) {
        slot = 'E';
      }

      if (!slot) return;

      // 쿨다운 체크
      if (myHero.skillCooldowns[slot] > 0) return;

      // 마우스 위치 (캔버스 중앙 기준 - 나중에 실제 마우스 위치로 교체)
      const targetX = myHero.x;
      const targetY = myHero.y;

      useSkill(slot, targetX, targetY);
      soundManager.play('skill_use');
    },
    [myHero, useSkill]
  );

  // 메뉴로 돌아가기
  const handleBackToMenu = useCallback(() => {
    leaveRoom();
    reset();
    setScreen('modeSelect');
  }, [leaveRoom, reset, setScreen]);

  // 다시 로비로
  const handleBackToLobby = useCallback(() => {
    reset();
    setScreen('rpgCoopLobby');
  }, [reset, setScreen]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-dark-900">
      {/* 메인 캔버스 */}
      <RPGCoopCanvas />

      {/* 상단 UI */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
        {/* 왼쪽: 모든 영웅 정보 */}
        <div className="pointer-events-auto">
          <RPGCoopHeroPanel />
        </div>

        {/* 오른쪽: 웨이브 정보 */}
        <div className="pointer-events-auto">
          <CoopWaveInfo />
        </div>
      </div>

      {/* 부활 타이머 (사망 시) */}
      {myHero?.isDead && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <RPGCoopReviveTimer reviveTimer={myHero.reviveTimer} />
        </div>
      )}

      {/* 알림 */}
      <Notification />

      {/* 하단 UI - 스킬바 */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-auto">
        <CoopSkillBar onUseSkill={handleUseSkill} />
      </div>

      {/* 조작법 안내 */}
      <div className="absolute bottom-4 left-4 text-xs text-gray-500 pointer-events-none">
        <div>우클릭: 이동 | Q: 기본 공격 | W: 스킬 | E: 궁극기 | C: 사거리 | Space: 카메라</div>
      </div>

      {/* 게임 오버 모달 */}
      {gameResult && (
        <GameOverModal
          result={gameResult}
          onBackToLobby={handleBackToLobby}
          onBackToMenu={handleBackToMenu}
        />
      )}

      {/* 하단 코너 장식 */}
      <div className="absolute bottom-0 left-0 w-24 h-24 border-l border-b border-green-500/20 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-24 h-24 border-r border-b border-green-500/20 pointer-events-none" />
    </div>
  );
};

// 협동 모드 웨이브 정보
const CoopWaveInfo: React.FC = () => {
  const waveInfo = useCoopWaveInfo();
  const gameTime = useRPGCoopStore((state) => state.gameState?.gameTime || 0);

  const minutes = Math.floor(gameTime / 60);
  const seconds = Math.floor(gameTime % 60);

  return (
    <div className="bg-dark-800/90 backdrop-blur-sm rounded-lg p-3 border border-dark-600/50 min-w-[150px]">
      <div className="text-center">
        <div className="text-green-400 font-bold text-xl mb-1">
          웨이브 {waveInfo.currentWave}
        </div>
        <div className="text-gray-400 text-sm">
          남은 적: {waveInfo.enemiesRemaining}
        </div>
        <div className="text-gray-500 text-xs mt-1">
          {minutes}:{String(seconds).padStart(2, '0')}
        </div>
      </div>
    </div>
  );
};

// 직업별 스킬 아이콘
const getSkillIcon = (heroClass: string, slot: string): string => {
  const iconMap: Record<string, Record<string, string>> = {
    warrior: { Q: '⚔️', W: '💨', E: '🔥' },
    archer: { Q: '🏹', W: '➡️', E: '🌧️' },
    knight: { Q: '💪', W: '🛡️', E: '🏰' },
    mage: { Q: '✨', W: '🔥', E: '☄️' },
  };
  return iconMap[heroClass]?.[slot] || '⭐';
};

// 직업별 스킬 색상
const getSkillColor = (heroClass: string, slot: string): string => {
  const colorMap: Record<string, Record<string, string>> = {
    warrior: {
      Q: 'from-red-500/30 to-orange-500/30',
      W: 'from-yellow-500/30 to-orange-500/30',
      E: 'from-red-600/30 to-red-400/30',
    },
    archer: {
      Q: 'from-green-500/30 to-emerald-500/30',
      W: 'from-teal-500/30 to-green-500/30',
      E: 'from-cyan-500/30 to-blue-500/30',
    },
    knight: {
      Q: 'from-blue-500/30 to-cyan-500/30',
      W: 'from-indigo-500/30 to-blue-500/30',
      E: 'from-yellow-500/30 to-amber-500/30',
    },
    mage: {
      Q: 'from-purple-500/30 to-pink-500/30',
      W: 'from-orange-500/30 to-red-500/30',
      E: 'from-violet-500/30 to-purple-500/30',
    },
  };
  return colorMap[heroClass]?.[slot] || 'from-gray-500/30 to-gray-400/30';
};

// 직업별 스킬 쿨다운 (기본값)
const SKILL_COOLDOWNS: Record<string, Record<string, number>> = {
  warrior: { Q: 0.8, W: 6, E: 30 },
  archer: { Q: 1.0, W: 8, E: 25 },
  knight: { Q: 1.2, W: 10, E: 35 },
  mage: { Q: 1.5, W: 5, E: 20 },
};

// 직업별 스킬 이름
const SKILL_NAMES: Record<string, Record<string, string>> = {
  warrior: { Q: '강타', W: '돌진', E: '광전사' },
  archer: { Q: '정조준', W: '관통 사격', E: '화살 비' },
  knight: { Q: '방패 가격', W: '방패 돌진', E: '철벽' },
  mage: { Q: '마력탄', W: '화염구', E: '메테오' },
};

// 협동 모드 스킬바
const CoopSkillBar: React.FC<{ onUseSkill: (skillType: SkillType) => void }> = ({ onUseSkill }) => {
  const myHero = useMyCoopHero();
  const setHoveredSkill = useRPGCoopStore((state) => state.setHoveredSkill);

  // 스킬 호버 핸들러
  const handleSkillHoverStart = useCallback((slot: 'Q' | 'W' | 'E') => {
    setHoveredSkill(slot);
  }, [setHoveredSkill]);

  const handleSkillHoverEnd = useCallback(() => {
    setHoveredSkill(null);
  }, [setHoveredSkill]);

  if (!myHero) return null;

  const heroClass = myHero.heroClass;
  const skillCooldowns = myHero.skillCooldowns;

  // 직업별 스킬 타입 매핑
  const skillTypeMap: Record<string, Record<string, SkillType>> = {
    warrior: { Q: 'warrior_q', W: 'warrior_w', E: 'warrior_e' },
    archer: { Q: 'archer_q', W: 'archer_w', E: 'archer_e' },
    knight: { Q: 'knight_q', W: 'knight_w', E: 'knight_e' },
    mage: { Q: 'mage_q', W: 'mage_w', E: 'mage_e' },
  };

  const skills = skillTypeMap[heroClass] || skillTypeMap.warrior;

  return (
    <div className="flex gap-2 bg-dark-800/90 backdrop-blur-sm rounded-xl p-3 border border-dark-600/50">
      <div className="text-xs text-gray-400 uppercase tracking-wider self-center mr-2">
        스킬
      </div>
      {(['Q', 'W', 'E'] as const).map((slot) => {
        const cooldown = skillCooldowns[slot];
        const maxCooldown = SKILL_COOLDOWNS[heroClass]?.[slot] || 10;
        const isOnCooldown = cooldown > 0;
        const cooldownPercent = isOnCooldown ? (cooldown / maxCooldown) * 100 : 0;
        const skillType = skills[slot];
        const skillIcon = getSkillIcon(heroClass, slot);
        const skillColor = getSkillColor(heroClass, slot);
        const skillName = SKILL_NAMES[heroClass]?.[slot] || slot;

        return (
          <div key={slot} className="relative group">
            <button
              onClick={() => onUseSkill(skillType)}
              onMouseEnter={() => handleSkillHoverStart(slot)}
              onMouseLeave={handleSkillHoverEnd}
              disabled={isOnCooldown || myHero.isDead}
              className={`
                relative w-14 h-14 rounded-lg border-2 overflow-hidden
                transition-all duration-200
                ${isOnCooldown || myHero.isDead
                  ? 'bg-dark-700/80 border-dark-500 cursor-not-allowed'
                  : `bg-gradient-to-br ${skillColor} border-neon-cyan/50 hover:border-neon-cyan hover:scale-105 cursor-pointer`
                }
              `}
            >
              {/* 쿨다운 오버레이 */}
              {isOnCooldown && (
                <div
                  className="absolute bottom-0 left-0 right-0 bg-dark-900/80 transition-all"
                  style={{ height: `${cooldownPercent}%` }}
                />
              )}

              {/* 스킬 아이콘 */}
              <div className="relative z-10 flex flex-col items-center justify-center h-full">
                <span className="text-2xl">{skillIcon}</span>
                <span className="text-[10px] text-white/70 font-bold">{slot}</span>
              </div>

              {/* 쿨다운 텍스트 */}
              {isOnCooldown && (
                <div className="absolute inset-0 flex items-center justify-center z-20">
                  <span className="text-lg font-bold text-white drop-shadow-lg">
                    {Math.ceil(cooldown)}
                  </span>
                </div>
              )}
            </button>

            {/* 툴팁 */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              <div className="bg-dark-800/95 border border-dark-500 rounded-lg px-3 py-2 whitespace-nowrap text-center min-w-[100px]">
                <div className="font-bold text-white">{skillName}</div>
                <div className="text-xs text-neon-cyan mt-1">
                  쿨타임: {maxCooldown}초
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// 게임 오버 모달
interface GameOverModalProps {
  result: ReturnType<typeof useRPGCoopStore.getState>['gameResult'];
  onBackToLobby: () => void;
  onBackToMenu: () => void;
}

const GameOverModal: React.FC<GameOverModalProps> = ({ result, onBackToLobby, onBackToMenu }) => {
  if (!result) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-50">
      <div className="bg-dark-800/95 backdrop-blur-sm rounded-2xl p-8 border border-dark-600/50 min-w-[500px] max-h-[80vh] overflow-y-auto">
        {/* 결과 헤더 */}
        <div className="text-center mb-6">
          <div className={`text-4xl font-bold mb-2 ${result.victory ? 'text-green-400' : 'text-red-400'}`}>
            {result.victory ? '승리!' : '게임 오버'}
          </div>
          <div className="text-gray-400">
            웨이브 {result.waveReached}까지 도달
          </div>
          <div className="text-gray-500 text-sm">
            플레이 시간: {Math.floor(result.totalGameTime / 60)}:{String(Math.floor(result.totalGameTime % 60)).padStart(2, '0')}
          </div>
        </div>

        {/* 플레이어별 결과 */}
        <div className="space-y-2 mb-6">
          <p className="text-gray-400 text-sm mb-2">플레이어 결과</p>
          {result.playerResults.map((player) => {
            const config = CLASS_CONFIGS[player.heroClass];
            return (
              <div
                key={player.playerId}
                className="flex items-center justify-between bg-dark-700/50 rounded-lg p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{config.emoji}</span>
                  <div>
                    <p className="text-white font-bold">{player.playerName}</p>
                    <p className="text-gray-500 text-xs">Lv.{player.level} {config.name}</p>
                  </div>
                </div>
                <div className="text-right text-sm">
                  <p className="text-red-400">{player.kills} 킬</p>
                  <p className="text-gray-500">{player.deaths} 데스</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* 버튼 */}
        <div className="flex gap-3">
          <button
            onClick={onBackToLobby}
            className="flex-1 px-6 py-3 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg font-bold transition-colors cursor-pointer"
          >
            로비로
          </button>
          <button
            onClick={onBackToMenu}
            className="flex-1 px-6 py-3 bg-dark-700 hover:bg-dark-600 text-white rounded-lg font-bold transition-colors cursor-pointer"
          >
            메뉴로
          </button>
        </div>
      </div>
    </div>
  );
};
