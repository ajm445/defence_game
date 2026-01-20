import React, { useEffect } from 'react';
import { useGameLoop } from '../../hooks/useGameLoop';
import { useKeyboardInput } from '../../hooks/useKeyboardInput';
import { useEdgeScroll } from '../../hooks/useEdgeScroll';
import { GameCanvas } from '../canvas/GameCanvas';
import { Minimap } from '../canvas/Minimap';
import { ResourceBar } from '../ui/ResourceBar';
import { GameTimer } from '../ui/GameTimer';
import { HPStatusPanel } from '../ui/HPStatusPanel';
import { UnitPanel } from '../ui/UnitPanel';
import { ActionPanel } from '../ui/ActionPanel';
import { SelectionInfo } from '../ui/SelectionInfo';
import { Notification } from '../ui/Notification';
import { MassSpawnAlert } from '../ui/MassSpawnAlert';
import { TutorialOverlay } from '../ui/TutorialOverlay';
import { CONFIG } from '../../constants/config';
import { useGameStore } from '../../stores/useGameStore';
import { useMultiplayerStore } from '../../stores/useMultiplayerStore';
import { useUIStore } from '../../stores/useUIStore';

export const GameScreen: React.FC = () => {
  // 게임 루프 시작
  useGameLoop();
  useKeyboardInput();
  useEdgeScroll();

  const gameMode = useGameStore((state) => state.gameMode);
  const stopGame = useGameStore((state) => state.stopGame);
  const gameResult = useMultiplayerStore((state) => state.gameResult);
  const setScreen = useUIStore((state) => state.setScreen);

  // 멀티플레이어 게임 종료 처리
  useEffect(() => {
    if (gameMode === 'multiplayer' && gameResult) {
      stopGame();
      setScreen('gameover');
    }
  }, [gameMode, gameResult, stopGame, setScreen]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-dark-900">
      {/* 메인 캔버스 */}
      <GameCanvas />

      {/* 상단 UI */}
      <ResourceBar />
      <GameTimer />
      <HPStatusPanel />

      {/* 선택 정보 */}
      <SelectionInfo />

      {/* 알림 */}
      <Notification />

      {/* 대량 발생 경고 */}
      <MassSpawnAlert />

      {/* 튜토리얼 오버레이 */}
      {gameMode === 'tutorial' && <TutorialOverlay />}

      {/* 하단 UI 패널 */}
      <div
        className="absolute bottom-0 left-0 flex items-start p-3 gap-3
                   glass-dark border-t border-dark-500/50"
        style={{
          right: CONFIG.MINIMAP_WIDTH + 50,
          height: CONFIG.UI_PANEL_HEIGHT,
        }}
      >
        {/* 유닛 섹션 */}
        <UnitPanel />

        {/* 구분선 */}
        <div className="w-px bg-dark-500 self-stretch" />

        {/* 액션 섹션 */}
        <ActionPanel />
      </div>

      {/* 미니맵 */}
      <Minimap />

      {/* 하단 코너 장식 */}
      <div className="absolute bottom-0 left-0 w-24 h-24 border-l border-b border-neon-cyan/20 pointer-events-none" />
      <div className="absolute bottom-0 right-[260px] w-24 h-24 border-r border-b border-neon-cyan/20 pointer-events-none" />
    </div>
  );
};
