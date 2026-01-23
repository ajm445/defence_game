import React, { useCallback, useEffect, useRef } from 'react';
import { useRPGCoopGameLoop } from '../../hooks/useRPGCoopGameLoop';
import { RPGCoopCanvas } from '../canvas/RPGCoopCanvas';
import { RPGCoopHeroPanel } from '../ui/RPGCoopHeroPanel';
import { RPGCoopReviveTimer } from '../ui/RPGCoopReviveTimer';
import { RPGSkillBar } from '../ui/RPGSkillBar';
import { RPGGameTimer } from '../ui/RPGGameTimer';
import { Notification } from '../ui/Notification';
import {
  useRPGCoopStore,
  useMyCoopHero,
  useCoopNexus,
  useCoopEnemyBases,
  useCoopGamePhase,
  useMyCoopGold,
  useMyCoopUpgradeLevels,
  useCoopEnemies,
} from '../../stores/useRPGCoopStore';
import { useUIStore } from '../../stores/useUIStore';
import { useAuthStore, useAuthIsGuest } from '../../stores/useAuthStore';
import { useProfileStore } from '../../stores/useProfileStore';
import { soundManager } from '../../services/SoundManager';
import { CLASS_CONFIGS, CLASS_SKILLS } from '../../constants/rpgConfig';
import { calculatePlayerExp, calculateClassExp } from '../../types/auth';
import type { HeroClass, SkillType, RPGGamePhase } from '../../types/rpg';
import { getUpgradeCost, type UpgradeType } from '../../game/rpg/goldSystem';

export const RPGCoopGameScreen: React.FC = () => {
  // 게임 루프 시작
  useRPGCoopGameLoop();

  const gameResult = useRPGCoopStore((state) => state.gameResult);
  const reset = useRPGCoopStore((state) => state.reset);
  const leaveRoom = useRPGCoopStore((state) => state.leaveRoom);
  const useSkill = useRPGCoopStore((state) => state.useSkill);
  const setScreen = useUIStore((state) => state.setScreen);
  const isGuest = useAuthIsGuest();
  // handleCoopGameEnd는 useEffect에서 직접 getState()로 호출하여 의존성 문제 방지

  const myHero = useMyCoopHero();

  // 경험치 저장 중복 방지를 위한 ref
  const expSavedRef = useRef(false);

  // 게임 종료 시 경험치 저장
  useEffect(() => {
    // myHero 객체 참조 변경으로 인한 중복 실행 방지
    // 조건 체크를 위한 값만 사용
    const currentIsGuest = useAuthStore.getState().profile?.isGuest ?? true;

    if (gameResult && myHero && !currentIsGuest && !expSavedRef.current) {
      expSavedRef.current = true;

      // 내 캐릭터의 킬 수 찾기
      const myResult = gameResult.playerResults.find(
        (p) => p.heroClass === myHero.heroClass
      );
      const myKills = myResult?.kills || 0;

      // 경험치 저장 (협동 모드 - 넥서스 디펜스 공식 사용)
      useProfileStore.getState().handleCoopGameEnd({
        classUsed: myHero.heroClass as HeroClass,
        basesDestroyed: gameResult.basesDestroyed,
        bossesKilled: gameResult.bossesKilled,
        kills: myKills,
        playTime: gameResult.totalGameTime,
        victory: gameResult.victory,
      });
    }

    // 게임이 리셋되면 ref도 초기화
    if (!gameResult) {
      expSavedRef.current = false;
    }
  }, [gameResult, myHero]);  // isGuest를 의존성에서 제거 - getState()로 직접 가져옴

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

      // 스킬별 사운드 (싱글플레이와 동일)
      switch (skillType) {
        // 근접 공격 스킬
        case 'warrior_q':
        case 'warrior_w':
        case 'knight_q':
        case 'knight_w':
          soundManager.play('attack_melee');
          break;
        // 원거리 공격 스킬
        case 'archer_q':
        case 'archer_w':
        case 'archer_e':
        case 'mage_q':
        case 'mage_w':
        case 'mage_e':
          soundManager.play('attack_ranged');
          break;
        // 버프 스킬
        case 'warrior_e':
        case 'knight_e':
          soundManager.play('heal');
          break;
        default:
          soundManager.play('skill_use');
      }
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

      {/* 상단 중앙 타이머 */}
      <RPGGameTimer mode="coop" />

      {/* 상단 UI */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
        {/* 왼쪽: 모든 영웅 정보 */}
        <div className="pointer-events-auto">
          <RPGCoopHeroPanel />
        </div>

        {/* 오른쪽: 넥서스 디펜스 상태 정보 */}
        <div className="pointer-events-auto">
          <CoopNexusDefenseInfo />
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

      {/* 우측 하단 업그레이드 패널 - 게임 진행 중에만 표시 */}
      {!gameResult && (
        <div className="absolute bottom-8 right-4 pointer-events-auto">
          <CoopUpgradePanel />
        </div>
      )}

      {/* 조작법 안내 */}
      <div className="absolute bottom-4 left-4 text-xs text-gray-500 pointer-events-none">
        <div>WASD: 이동 | 자동 공격 | Shift: 스킬 | R: 궁극기 | C: 사거리 | Space: 카메라</div>
      </div>

      {/* 게임 오버 모달 */}
      {gameResult && (
        <GameOverModal
          result={gameResult}
          isGuest={isGuest}
          myHeroClass={myHero?.heroClass}
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

// 협동 모드 넥서스 디펜스 정보 (싱글플레이 RPGWaveInfo 스타일)
const CoopNexusDefenseInfo: React.FC = () => {
  const nexus = useCoopNexus();
  const enemyBases = useCoopEnemyBases();
  const gamePhase = useCoopGamePhase();
  const enemies = useCoopEnemies();

  const aliveEnemies = enemies.filter((e) => e.hp > 0).length;
  const bossEnemies = enemies.filter((e) => e.hp > 0 && e.type === 'boss').length;
  const destroyedBases = enemyBases.filter((b) => b.destroyed).length;
  const isBossPhase = gamePhase === 'boss_phase';

  // 넥서스 HP 비율
  const nexusHpPercent = nexus ? nexus.hp / nexus.maxHp : 1;

  return (
    <div className={`
      bg-dark-800/90 backdrop-blur-sm rounded-xl p-4 border min-w-[200px]
      ${isBossPhase ? 'border-red-500/50' : 'border-dark-600/50'}
    `}>
      {/* 게임 상태 */}
      <div className="flex items-center justify-between mb-2">
        <div className={`
          text-xl font-bold
          ${isBossPhase ? 'text-red-400' : 'text-white'}
        `}>
          {isBossPhase ? (
            <>
              <span className="mr-2">BOSS</span>
              보스 페이즈
            </>
          ) : (
            <>전투 중</>
          )}
        </div>
        {isBossPhase && (
          <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded uppercase">
            보스
          </span>
        )}
      </div>

      {/* 넥서스 상태 */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-cyan-400">N</span>
          <span className="text-sm text-gray-400">넥서스</span>
        </div>
        <div className="h-3 bg-dark-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              nexusHpPercent > 0.5 ? 'bg-cyan-500' :
              nexusHpPercent > 0.25 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${nexusHpPercent * 100}%` }}
          />
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {nexus ? `${Math.floor(nexus.hp)} / ${nexus.maxHp}` : 'N/A'}
        </div>
      </div>

      {/* 적 기지 상태 */}
      <div className="space-y-2 mb-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">적 기지</span>
          <span className="text-red-400 font-bold">{destroyedBases}/2 파괴</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {enemyBases.map((base) => (
            <div
              key={base.id}
              className={`text-xs px-2 py-1 rounded ${
                base.destroyed
                  ? 'bg-gray-600/50 text-gray-400 line-through'
                  : 'bg-red-500/20 text-red-400'
              }`}
            >
              {base.id === 'left' ? '좌측' : '우측'} 기지
              {!base.destroyed && (
                <span className="ml-1 text-gray-500">
                  ({Math.floor((base.hp / base.maxHp) * 100)}%)
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 적 정보 */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">적 유닛</span>
          <span className="text-red-400 font-bold">{aliveEnemies}</span>
        </div>
        {isBossPhase && bossEnemies > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">보스</span>
            <span className="text-purple-400 font-bold">{bossEnemies}/2</span>
          </div>
        )}
      </div>

      {/* 목표 안내 */}
      <div className="mt-3 pt-3 border-t border-dark-600/50">
        <div className="text-xs text-gray-400">
          {isBossPhase
            ? '보스를 모두 처치하세요!'
            : destroyedBases < 2
              ? '적 기지를 파괴하세요!'
              : '보스 등장 준비 중...'}
        </div>
      </div>
    </div>
  );
};

// 협동 모드 업그레이드 패널
const UPGRADE_INFO: Record<UpgradeType, { key: string; icon: string; color: string; name: string }> = {
  attack: { key: '1', icon: 'ATK', color: 'text-red-400', name: '공격력' },
  speed: { key: '2', icon: 'SPD', color: 'text-blue-400', name: '이동속도' },
  hp: { key: '3', icon: 'HP', color: 'text-green-400', name: '체력' },
  goldRate: { key: '4', icon: 'GOLD', color: 'text-yellow-400', name: '골드 획득' },
};

interface CoopUpgradeButtonProps {
  type: UpgradeType;
  currentLevel: number;
  maxLevel: number;
  gold: number;
  onUpgrade: () => void;
}

const CoopUpgradeButton: React.FC<CoopUpgradeButtonProps> = ({
  type,
  currentLevel,
  maxLevel,
  gold,
  onUpgrade,
}) => {
  const info = UPGRADE_INFO[type];
  const cost = getUpgradeCost(currentLevel);
  const canAfford = gold >= cost;
  const isMaxed = currentLevel >= maxLevel;
  const isDisabled = isMaxed || !canAfford;

  return (
    <button
      onClick={onUpgrade}
      disabled={isDisabled}
      className={`
        flex items-center gap-1 px-2 py-1 rounded border transition-all duration-150 text-xs
        ${isDisabled
          ? 'bg-dark-700/50 border-dark-600 opacity-50 cursor-not-allowed'
          : 'bg-dark-700/80 border-dark-500 hover:border-neon-cyan hover:bg-dark-600/80 cursor-pointer'
        }
      `}
    >
      {/* 아이콘 + 키 */}
      <span className={`text-sm ${info.color}`}>{info.icon}</span>
      <span className="text-gray-500">[{info.key}]</span>

      {/* 레벨 */}
      <span className={currentLevel > 0 ? 'text-neon-cyan font-bold' : 'text-gray-400'}>
        {currentLevel}
      </span>
      <span className="text-gray-600">/</span>
      <span className="text-gray-400">{maxLevel}</span>

      {/* 비용 */}
      {!isMaxed ? (
        <span className={`ml-1 ${canAfford ? 'text-yellow-400' : 'text-red-400/70'}`}>
          G{cost}
        </span>
      ) : (
        <span className="ml-1 text-yellow-400 font-bold">MAX</span>
      )}
    </button>
  );
};

const CoopUpgradePanel: React.FC = () => {
  const gold = useMyCoopGold();
  const upgradeLevels = useMyCoopUpgradeLevels();
  const myHero = useMyCoopHero();
  const upgradeHeroStat = useRPGCoopStore((state) => state.upgradeHeroStat);

  const characterLevel = myHero?.passiveGrowth?.level || 1;

  const handleUpgrade = useCallback((type: UpgradeType) => {
    upgradeHeroStat(type);
  }, [upgradeHeroStat]);

  // 키보드 단축키 처리
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 입력 필드에 포커스된 경우 무시
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case '1':
          handleUpgrade('attack');
          break;
        case '2':
          handleUpgrade('speed');
          break;
        case '3':
          handleUpgrade('hp');
          break;
        case '4':
          handleUpgrade('goldRate');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUpgrade]);

  return (
    <div className="bg-dark-800/90 backdrop-blur-sm rounded-lg p-2 border border-dark-600/50">
      {/* 골드 표시 */}
      <div className="flex items-center justify-center gap-2 mb-2 pb-2 border-b border-dark-600/50">
        <span className="text-lg">G</span>
        <span className="text-lg font-bold text-yellow-400">{gold}</span>
      </div>

      {/* 업그레이드 타이틀 */}
      <div className="text-xs text-gray-500 mb-1 text-center">업그레이드 [1-4]</div>

      {/* 업그레이드 버튼들 - 2x2 그리드 */}
      <div className="grid grid-cols-2 gap-1">
        {(['attack', 'speed', 'hp', 'goldRate'] as UpgradeType[]).map((type) => (
          <CoopUpgradeButton
            key={type}
            type={type}
            currentLevel={upgradeLevels[type]}
            maxLevel={characterLevel}
            gold={gold}
            onUpgrade={() => handleUpgrade(type)}
          />
        ))}
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

// 스킬 키 표시 변환 (W -> Shift, E -> R)
const getDisplayKey = (slot: string): string => {
  if (slot === 'W') return 'Shift';
  if (slot === 'E') return 'R';
  return slot;
};

// 스킬 타입 라벨 (W -> 스킬, E -> 궁극기)
const getSkillLabel = (slot: string): string => {
  if (slot === 'W') return '스킬';
  if (slot === 'E') return '궁극기';
  return slot;
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

  // Q 스킬 제외 (자동 공격), W와 E만 표시
  const displaySlots = ['W', 'E'] as const;

  return (
    <div className="flex gap-3 bg-dark-800/90 backdrop-blur-sm rounded-xl p-3 border border-dark-600/50">
      {displaySlots.map((slot) => {
        const cooldown = skillCooldowns[slot];
        const maxCooldown = SKILL_COOLDOWNS[heroClass]?.[slot] || 10;
        const isOnCooldown = cooldown > 0;
        const cooldownPercent = isOnCooldown ? (cooldown / maxCooldown) * 100 : 0;
        const skillType = skills[slot];
        const skillIcon = getSkillIcon(heroClass, slot);
        const skillColor = getSkillColor(heroClass, slot);
        const skillName = SKILL_NAMES[heroClass]?.[slot] || slot;
        const displayKey = getDisplayKey(slot);

        return (
          <div key={slot} className="flex flex-col items-center gap-1">
            <div className="text-[10px] text-gray-400 font-medium">
              {getSkillLabel(slot)}
            </div>
            <div className="relative group">
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
                  <span className="text-[10px] text-white/70 font-bold">{displayKey}</span>
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
                <div className="bg-dark-800/95 border border-dark-500 rounded-lg px-3 py-2 whitespace-nowrap text-center min-w-[140px]">
                  <div className="font-bold text-white">{skillName}</div>
                  <div className="text-xs text-gray-400 mt-1 max-w-[180px] whitespace-normal">
                    {CLASS_SKILLS[heroClass]?.[slot.toLowerCase() as 'q' | 'w' | 'e']?.description || ''}
                  </div>
                  <div className="text-xs text-neon-cyan mt-1">
                    쿨타임: {maxCooldown}초
                  </div>
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
  isGuest: boolean;
  myHeroClass?: string;
  onBackToLobby: () => void;
  onBackToMenu: () => void;
}

const GameOverModal: React.FC<GameOverModalProps> = ({ result, isGuest, myHeroClass, onBackToLobby, onBackToMenu }) => {
  if (!result) return null;

  // 내 캐릭터의 킬 수 (내 직업과 같은 플레이어 찾기)
  const myResult = myHeroClass
    ? result.playerResults.find(p => p.heroClass === myHeroClass)
    : result.playerResults[0];
  const myKills = myResult?.kills || 0;

  // 총 킬 수 계산
  const totalKills = result.playerResults.reduce((sum, p) => sum + p.kills, 0);

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-50">
      <div className="bg-dark-800/95 backdrop-blur-sm rounded-2xl p-8 border border-dark-600/50 min-w-[500px] max-h-[80vh] overflow-y-auto">
        {/* 결과 헤더 */}
        <div className="text-center mb-6">
          <div className={`text-4xl font-bold mb-2 ${result.victory ? 'text-green-400' : 'text-red-400'}`}>
            {result.victory ? '승리!' : '게임 오버'}
          </div>
          <div className="text-gray-400">
            {result.victory
              ? '모든 보스를 처치했습니다!'
              : result.basesDestroyed > 0
                ? `${result.basesDestroyed}개 기지 파괴`
                : '넥서스가 파괴되었습니다'
            }
          </div>
          <div className="text-gray-500 text-sm">
            플레이 시간: {Math.floor(result.totalGameTime / 60)}:{String(Math.floor(result.totalGameTime % 60)).padStart(2, '0')}
          </div>
        </div>

        {/* 통계 */}
        <div className="space-y-3 mb-6">
          <div className="flex justify-between bg-dark-700/50 rounded-lg p-3">
            <span className="text-gray-400">기지 파괴</span>
            <span className="text-red-400 font-bold">{result.basesDestroyed}/2</span>
          </div>
          <div className="flex justify-between bg-dark-700/50 rounded-lg p-3">
            <span className="text-gray-400">보스 처치</span>
            <span className="text-purple-400 font-bold">{result.bossesKilled}/2</span>
          </div>
          <div className="flex justify-between bg-dark-700/50 rounded-lg p-3">
            <span className="text-gray-400">총 처치 (팀)</span>
            <span className="text-red-400 font-bold">{totalKills}</span>
          </div>
          <div className="flex justify-between bg-dark-700/50 rounded-lg p-3">
            <span className="text-gray-400">획득 골드 (팀)</span>
            <span className="text-yellow-400 font-bold">{result.totalGoldEarned}</span>
          </div>
        </div>

        {/* 계정 경험치 (비게스트만 표시 - 싱글플레이와 동일한 공식 사용) */}
        {!isGuest && myHeroClass && (
          <div className="mb-6 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
            <h4 className="text-purple-400 font-bold text-sm mb-2">계정 경험치 획득</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">플레이어 EXP</span>
                <span className="text-yellow-400 font-bold">
                  +{calculatePlayerExp(
                    result.basesDestroyed,
                    result.bossesKilled,
                    myKills,
                    result.totalGameTime,
                    result.victory,
                    'coop'
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">클래스 EXP ({CLASS_CONFIGS[myHeroClass as keyof typeof CLASS_CONFIGS]?.name || myHeroClass})</span>
                <span className="text-cyan-400 font-bold">
                  +{calculateClassExp(result.basesDestroyed, result.bossesKilled, myKills)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 게스트 안내 */}
        {isGuest && (
          <div className="mb-6 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <p className="text-yellow-300 text-xs text-center">
              게스트 모드에서는 진행 상황이 저장되지 않습니다.
            </p>
          </div>
        )}

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
                    <p className="text-gray-500 text-xs">{config.name}</p>
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
