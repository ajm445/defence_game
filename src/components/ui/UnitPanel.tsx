import React from 'react';
import { useGameStore, useResources } from '../../stores/useGameStore';
import { useMultiplayerStore } from '../../stores/useMultiplayerStore';
import { useUIStore } from '../../stores/useUIStore';
import { UnitButton } from './UnitButton';
import { UnitType } from '../../types';
import { wsClient } from '../../services/WebSocketClient';

const UNIT_TYPES: UnitType[] = ['melee', 'ranged', 'knight', 'woodcutter', 'miner', 'gatherer', 'goldminer'];

export const UnitPanel: React.FC = () => {
  const gameMode = useGameStore((state) => state.gameMode);
  const spawnUnit = useGameStore((state) => state.spawnUnit);
  const singlePlayerResources = useResources();
  const gameState = useMultiplayerStore((state) => state.gameState);
  const mySide = useMultiplayerStore((state) => state.mySide);
  const showNotification = useUIStore((state) => state.showNotification);

  // 멀티플레이어 모드에서는 서버 상태의 자원 사용
  const resources = gameMode === 'multiplayer' && gameState && mySide
    ? (mySide === 'left' ? gameState.leftPlayer.resources : gameState.rightPlayer.resources)
    : singlePlayerResources;

  const handleSpawn = (type: UnitType) => {
    const config: Record<UnitType, string> = { melee: '검병', ranged: '궁수', knight: '기사', woodcutter: '나무꾼', miner: '광부', gatherer: '채집꾼', goldminer: '금광부' };

    if (gameMode === 'multiplayer') {
      // 멀티플레이어: 서버로 유닛 소환 요청 전송
      wsClient.spawnUnit(type);
      showNotification(`${config[type]} 소환 요청!`);
    } else {
      // 싱글플레이어: 로컬에서 처리
      const success = spawnUnit(type, 'player');
      if (success) {
        showNotification(`${config[type]} 고용!`);
      } else {
        showNotification('자원이 부족합니다!');
      }
    }
  };

  return (
    <div className="flex gap-2 flex-1">
      {UNIT_TYPES.map((type) => (
        <UnitButton
          key={type}
          type={type}
          resources={resources}
          onSpawn={() => handleSpawn(type)}
        />
      ))}
    </div>
  );
};
