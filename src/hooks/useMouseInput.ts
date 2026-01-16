import { useRef, useCallback, RefObject } from 'react';
import { useGameStore } from '../stores/useGameStore';
import { useUIStore } from '../stores/useUIStore';
import { distance } from '../utils/math';
import { CONFIG } from '../constants/config';

export const useMouseInput = (canvasRef: RefObject<HTMLCanvasElement | null>) => {
  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  const camera = useGameStore((state) => state.camera);
  const moveCamera = useGameStore((state) => state.moveCamera);
  const units = useGameStore((state) => state.units);
  const selectUnit = useGameStore((state) => state.selectUnit);
  const resourceNodes = useGameStore((state) => state.resourceNodes);
  const playerBase = useGameStore((state) => state.playerBase);
  const addResource = useGameStore((state) => state.addResource);
  const updateResourceNode = useGameStore((state) => state.updateResourceNode);
  const buildWall = useGameStore((state) => state.buildWall);
  const showNotification = useUIStore((state) => state.showNotification);
  const setPlacementMode = useUIStore((state) => state.setPlacementMode);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 2) {
        // 우클릭: 드래그 시작
        isDraggingRef.current = true;
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
      } else if (e.button === 0) {
        // 좌클릭: 선택/명령
        handleLeftClick(e);
      }
    },
    [camera, units, resourceNodes, playerBase]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDraggingRef.current) {
        const dx = e.clientX - lastMouseRef.current.x;
        const dy = e.clientY - lastMouseRef.current.y;
        moveCamera(-dx, -dy);
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
      }
    },
    [moveCamera]
  );

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  const handleLeftClick = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const state = useGameStore.getState();
      const uiState = useUIStore.getState();
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left + state.camera.x;
      const clickY = e.clientY - rect.top + state.camera.y;

      // 벽 배치 모드
      if (uiState.placementMode === 'wall') {
        // 플레이어 진영 내에서만 건설 가능 (맵 왼쪽 절반)
        if (clickX < CONFIG.MAP_WIDTH / 2) {
          const success = buildWall(clickX, clickY);
          if (success) {
            showNotification('벽 건설 완료!');
          } else {
            showNotification('자원이 부족합니다!');
          }
        } else {
          showNotification('플레이어 진영에만 건설할 수 있습니다!');
        }
        setPlacementMode('none');
        return;
      }

      // 유닛 선택 확인
      let clicked = false;
      for (const unit of state.units) {
        if (distance(clickX, clickY, unit.x, unit.y) < 20) {
          selectUnit(unit);
          clicked = true;
          break;
        }
      }

      if (!clicked) {
        selectUnit(null);
      }
    },
    [canvasRef, selectUnit, addResource, updateResourceNode, buildWall, showNotification, setPlacementMode]
  );

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleContextMenu,
  };
};
