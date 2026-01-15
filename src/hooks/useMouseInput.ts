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
  const showNotification = useUIStore((state) => state.showNotification);

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
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left + state.camera.x;
      const clickY = e.clientY - rect.top + state.camera.y;

      // 유닛 선택 확인
      let clicked = false;
      for (const unit of state.units) {
        if (distance(clickX, clickY, unit.x, unit.y) < 20) {
          selectUnit(unit);
          clicked = true;
          break;
        }
      }

      // 자원 직접 채집 (선택된 유닛 없을 때)
      if (!clicked) {
        for (const node of state.resourceNodes) {
          if (distance(clickX, clickY, node.x, node.y) < 30 && node.amount > 0) {
            // 플레이어 본진 근처에서만 직접 채집 가능
            if (
              distance(
                clickX,
                clickY,
                state.playerBase.x,
                state.playerBase.y
              ) < CONFIG.DIRECT_GATHER_RANGE
            ) {
              const gatherAmount = Math.min(CONFIG.DIRECT_GATHER_AMOUNT, node.amount);

              let resourceType: 'wood' | 'stone' | 'herb' | 'crystal';
              if (node.type === 'tree') {
                resourceType = 'wood';
              } else if (node.type === 'rock') {
                resourceType = 'stone';
              } else if (node.type === 'herb') {
                resourceType = 'herb';
              } else {
                resourceType = 'crystal';
              }

              addResource(resourceType, gatherAmount, 'player');
              updateResourceNode(node.id, node.amount - gatherAmount);
              showNotification(`${resourceType} +${gatherAmount}`);
            } else {
              showNotification('너무 멀어서 채집할 수 없습니다!');
            }
            clicked = true;
            break;
          }
        }
      }

      if (!clicked) {
        selectUnit(null);
      }
    },
    [canvasRef, selectUnit, addResource, updateResourceNode, showNotification]
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
