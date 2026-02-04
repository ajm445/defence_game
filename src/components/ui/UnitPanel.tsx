import React, { useMemo } from 'react';
import { useGameStore, useResources } from '../../stores/useGameStore';
import { useMultiplayerStore } from '../../stores/useMultiplayerStore';
import { useUIStore } from '../../stores/useUIStore';
import { UnitButton } from './UnitButton';
import { UnitType, Unit } from '../../types';
import { wsClient } from '../../services/WebSocketClient';
import { soundManager } from '../../services/SoundManager';

// 공격 유닛과 지원 유닛 분리
const COMBAT_UNITS: UnitType[] = ['melee', 'ranged', 'knight', 'mage'];
const SUPPORT_UNITS: UnitType[] = ['woodcutter', 'miner', 'gatherer', 'goldminer', 'healer'];

export const UnitPanel: React.FC = () => {
  const gameMode = useGameStore((state) => state.gameMode);
  const spawnUnit = useGameStore((state) => state.spawnUnit);
  const singlePlayerResources = useResources();
  const spawnCooldowns = useGameStore((state) => state.spawnCooldowns);
  const playerUnits = useGameStore((state) => state.units);
  const gameState = useMultiplayerStore((state) => state.gameState);
  const mySide = useMultiplayerStore((state) => state.mySide);
  const showNotification = useUIStore((state) => state.showNotification);

  // 멀티플레이어 모드에서는 서버 상태의 자원 사용
  const resources = gameMode === 'multiplayer' && gameState && mySide
    ? (mySide === 'left' ? gameState.leftPlayer.resources : gameState.rightPlayer.resources)
    : singlePlayerResources;

  // 멀티플레이어 모드에서는 서버 상태의 쿨타임 사용, 싱글에서는 로컬 쿨타임
  const cooldowns = gameMode === 'multiplayer' && gameState && mySide
    ? (mySide === 'left' ? gameState.leftPlayer.spawnCooldowns : gameState.rightPlayer.spawnCooldowns) || {}
    : spawnCooldowns;

  // 유닛 타입별 카운트 계산
  const unitCounts = useMemo(() => {
    const counts: Partial<Record<UnitType, number>> = {};

    if (gameMode === 'multiplayer' && gameState && mySide) {
      // 멀티플레이어: 서버 상태에서 내 유닛만 카운트
      gameState.units
        .filter((u) => u.side === mySide)
        .forEach((u) => {
          counts[u.type as UnitType] = (counts[u.type as UnitType] || 0) + 1;
        });
    } else {
      // 싱글플레이어: 로컬 플레이어 유닛 카운트
      playerUnits.forEach((u: Unit) => {
        counts[u.type] = (counts[u.type] || 0) + 1;
      });
    }

    return counts;
  }, [gameMode, gameState, mySide, playerUnits]);

  const handleSpawn = (type: UnitType) => {
    const config: Record<UnitType, string> = { melee: '검병', ranged: '궁수', knight: '기사', woodcutter: '나무꾼', miner: '광부', gatherer: '채집꾼', goldminer: '금광부', healer: '힐러', mage: '마법사', boss: '보스' };

    soundManager.play('ui_click');

    if (gameMode === 'multiplayer') {
      // 멀티플레이어: 서버로 유닛 소환 요청 전송
      // 효과음은 서버에서 UNIT_SPAWNED 이벤트가 오면 재생됨 (useMultiplayerStore에서 처리)
      wsClient.spawnUnit(type);
      showNotification(`${config[type]} 소환 요청!`);
    } else {
      // 싱글플레이어: 로컬에서 처리
      const success = spawnUnit(type, 'player');
      if (success) {
        soundManager.play('unit_spawn');
        showNotification(`${config[type]} 고용!`);
      } else {
        showNotification('자원이 부족합니다!');
      }
    }
  };

  return (
    <div className="flex gap-4 flex-1">
      {/* 공격 유닛 */}
      <div className="flex flex-col gap-1">
        <div className="text-[9px] text-red-400/70 uppercase tracking-wider px-1">공격 유닛</div>
        <div className="flex gap-1.5">
          {COMBAT_UNITS.map((type) => (
            <UnitButton
              key={type}
              type={type}
              resources={resources}
              onSpawn={() => handleSpawn(type)}
              cooldown={cooldowns[type] || 0}
              count={unitCounts[type] || 0}
              tutorialId={`unit-${type}`}
            />
          ))}
        </div>
      </div>

      {/* 구분선 */}
      <div className="w-px bg-dark-500/50 self-stretch" />

      {/* 지원 유닛 */}
      <div className="flex flex-col gap-1">
        <div className="text-[9px] text-neon-cyan/70 uppercase tracking-wider px-1">지원 유닛</div>
        <div className="flex gap-1.5">
          {SUPPORT_UNITS.map((type) => (
            <UnitButton
              key={type}
              type={type}
              resources={resources}
              onSpawn={() => handleSpawn(type)}
              cooldown={cooldowns[type] || 0}
              count={unitCounts[type] || 0}
              tutorialId={`unit-${type}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
