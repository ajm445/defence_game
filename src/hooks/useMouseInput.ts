import { useRef, useCallback, useEffect, RefObject } from 'react';
import { useGameStore } from '../stores/useGameStore';
import { useUIStore } from '../stores/useUIStore';
import { useMultiplayerStore } from '../stores/useMultiplayerStore';
import { distance } from '../utils/math';
import { CONFIG } from '../constants/config';
import { wsClient } from '../services/WebSocketClient';
import { soundManager } from '../services/SoundManager';

const ZOOM_SPEED = 0.1;

export const useMouseInput = (canvasRef: RefObject<HTMLCanvasElement | null>) => {
  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  // 터치 멀티포인터 추적
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lastPinchDistRef = useRef(0);

  const camera = useGameStore((state) => state.camera);
  const moveCamera = useGameStore((state) => state.moveCamera);
  const zoomAt = useGameStore((state) => state.zoomAt);
  const units = useGameStore((state) => state.units);
  const selectUnit = useGameStore((state) => state.selectUnit);
  const resourceNodes = useGameStore((state) => state.resourceNodes);
  const playerBase = useGameStore((state) => state.playerBase);
  const addResource = useGameStore((state) => state.addResource);
  const updateResourceNode = useGameStore((state) => state.updateResourceNode);
  const buildWall = useGameStore((state) => state.buildWall);
  const showNotification = useUIStore((state) => state.showNotification);
  const setPlacementMode = useUIStore((state) => state.setPlacementMode);

  const handleLeftClick = useCallback(
    (e: React.PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const state = useGameStore.getState();
      const uiState = useUIStore.getState();
      const mpState = useMultiplayerStore.getState();
      const rect = canvas.getBoundingClientRect();
      const zoom = state.camera.zoom;
      const clickX = (e.clientX - rect.left) / zoom + state.camera.x;
      const clickY = (e.clientY - rect.top) / zoom + state.camera.y;

      // 벽 배치 모드
      if (uiState.placementMode === 'wall') {
        if (state.gameMode === 'multiplayer') {
          const mySide = mpState.mySide;
          const isMyTerritory = mySide === 'left'
            ? clickX < CONFIG.MAP_WIDTH / 2
            : clickX > CONFIG.MAP_WIDTH / 2;

          if (isMyTerritory) {
            wsClient.buildWall(clickX, clickY);
            soundManager.play('build_wall');
            showNotification('벽 건설 요청!');
          } else {
            showNotification('내 진영에만 건설할 수 있습니다!');
          }
        } else {
          if (clickX < CONFIG.MAP_WIDTH / 2) {
            const success = buildWall(clickX, clickY);
            if (success) {
              soundManager.play('build_wall');
              showNotification('벽 건설 완료!');
            } else {
              showNotification('자원이 부족합니다!');
            }
          } else {
            showNotification('플레이어 진영에만 건설할 수 있습니다!');
          }
        }
        setPlacementMode('none');
        return;
      }

      // 유닛 선택 확인 (싱글플레이어 전용)
      if (state.gameMode !== 'multiplayer') {
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
      }
    },
    [canvasRef, selectUnit, addResource, updateResourceNode, buildWall, showNotification, setPlacementMode]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // 포인터 추적
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (e.pointerType === 'touch') {
        // 터치: 두 손가락 핀치 줌 시작
        if (pointersRef.current.size === 2) {
          const pts = Array.from(pointersRef.current.values());
          lastPinchDistRef.current = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
          isDraggingRef.current = false; // 핀치 중 팬 비활성화
        } else if (pointersRef.current.size === 1) {
          // 한 손가락: 드래그=카메라 팬 시작
          isDraggingRef.current = true;
          lastMouseRef.current = { x: e.clientX, y: e.clientY };
        }
      } else if (e.button === 2) {
        // 우클릭: 드래그 시작
        isDraggingRef.current = true;
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
      } else if (e.button === 0) {
        // 좌클릭: 선택/명령
        handleLeftClick(e);
      }
    },
    [camera, units, resourceNodes, playerBase, handleLeftClick]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      // 포인터 위치 업데이트
      if (pointersRef.current.has(e.pointerId)) {
        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }

      // 두 손가락 핀치 줌
      if (e.pointerType === 'touch' && pointersRef.current.size === 2) {
        const pts = Array.from(pointersRef.current.values());
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        if (lastPinchDistRef.current > 0) {
          const rect = canvasRef.current?.getBoundingClientRect();
          if (rect) {
            const centerX = (pts[0].x + pts[1].x) / 2 - rect.left;
            const centerY = (pts[0].y + pts[1].y) / 2 - rect.top;
            const state = useGameStore.getState();
            const scale = dist / lastPinchDistRef.current;
            const newZoom = state.camera.zoom * scale;
            zoomAt(newZoom, centerX, centerY);
          }
        }
        lastPinchDistRef.current = dist;
        return;
      }

      if (isDraggingRef.current) {
        const dx = e.clientX - lastMouseRef.current.x;
        const dy = e.clientY - lastMouseRef.current.y;
        moveCamera(-dx, -dy);
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
      }
    },
    [moveCamera, canvasRef, zoomAt]
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    // 터치: 한 손가락 짧은 탭 = 선택/배치 (드래그하지 않았을 때)
    if (e.pointerType === 'touch' && pointersRef.current.size === 1) {
      const start = pointersRef.current.get(e.pointerId);
      if (start) {
        const dist = Math.hypot(e.clientX - start.x, e.clientY - start.y);
        if (dist < 10) {
          // 짧은 탭 → 좌클릭으로 처리
          handleLeftClick(e);
        }
      }
    }

    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) {
      lastPinchDistRef.current = 0;
    }
    if (pointersRef.current.size === 0) {
      isDraggingRef.current = false;
    }
  }, [handleLeftClick]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // 휠 이벤트는 passive: false로 네이티브 이벤트 리스너 사용 (preventDefault 허용)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const state = useGameStore.getState();
      const currentZoom = state.camera.zoom;

      // 스크롤 방향에 따라 줌 인/아웃
      const delta = e.deltaY > 0 ? -ZOOM_SPEED : ZOOM_SPEED;
      const newZoom = currentZoom + delta;

      zoomAt(newZoom, mouseX, mouseY);
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [canvasRef, zoomAt]);

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleContextMenu,
  };
};
