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
import { FullscreenButton } from '../ui/FullscreenButton';
import { PauseButton } from '../ui/PauseButton';
import { CONFIG, getResponsiveConfig } from '../../constants/config';
import { useGameStore } from '../../stores/useGameStore';
import { useMultiplayerStore } from '../../stores/useMultiplayerStore';
import { useUIStore } from '../../stores/useUIStore';
import { soundManager } from '../../services/SoundManager';
import { wsClient } from '../../services/WebSocketClient';

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

  // RTS BGM 재생
  useEffect(() => {
    // 튜토리얼이 아닌 경우에만 BGM 재생
    if (gameMode !== 'tutorial') {
      soundManager.playBGM('rts_battle');
    }

    // 컴포넌트 언마운트 시 BGM 정지
    return () => {
      soundManager.stopBGM();
    };
  }, [gameMode]);

  // RTS AI 대전 시 게임 중 상태 알림 (싱글플레이어)
  useEffect(() => {
    if (gameMode === 'ai' && wsClient.isConnected()) {
      // 게임 시작 시 서버에 알림
      wsClient.send({ type: 'SET_IN_GAME', isInGame: true });

      // 게임 종료 시 서버에 알림
      return () => {
        if (wsClient.isConnected()) {
          wsClient.send({ type: 'SET_IN_GAME', isInGame: false });
        }
      };
    }
  }, [gameMode]);

  const uiScale = useUIStore((s) => s.uiScale);
  const isMobile = useUIStore((s) => s.isMobile);
  const responsiveConfig = getResponsiveConfig(uiScale);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-dark-900">
      {/* 메인 캔버스 */}
      <GameCanvas />

      {/* 상단 UI */}
      <ResourceBar />
      <GameTimer />
      <HPStatusPanel />

      {/* 일시정지 + 풀스크린 버튼 */}
      <div className="absolute top-4 right-4 z-20 pointer-events-auto flex gap-2">
        {(gameMode === 'ai' || gameMode === 'tutorial') && (
          <PauseButton onClick={() => { stopGame(); setScreen('paused'); }} />
        )}
        <FullscreenButton />
      </div>

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
          right: responsiveConfig.MINIMAP_WIDTH + 50,
          height: responsiveConfig.UI_PANEL_HEIGHT,
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
      {!isMobile && (
        <>
          <div className="absolute bottom-0 left-0 border-l border-b border-neon-cyan/20 pointer-events-none" style={{ width: 'clamp(3rem, 6vw, 6rem)', height: 'clamp(3rem, 6vw, 6rem)' }} />
          <div className="absolute bottom-0 border-r border-b border-neon-cyan/20 pointer-events-none" style={{ right: 'clamp(200px, 20vw, 260px)', width: 'clamp(3rem, 6vw, 6rem)', height: 'clamp(3rem, 6vw, 6rem)' }} />
        </>
      )}
    </div>
  );
};
