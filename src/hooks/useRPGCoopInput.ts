import { useEffect, useCallback, useRef, useState } from 'react';
import { useRPGCoopStore } from '../stores/useRPGCoopStore';
import { RPG_CONFIG } from '../constants/rpgConfig';

const ZOOM_SPEED = 0.1;

interface UseRPGCoopInputOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  cameraRef: React.RefObject<{ x: number; y: number; zoom: number }>;
  setCameraPosition?: (x: number, y: number) => void;
}

export interface CoopInputState {
  mousePosition: React.RefObject<{ x: number; y: number }>;
  isHovering: React.RefObject<boolean>;
  showAttackRange: boolean;
  hoveredSkill: 'Q' | 'W' | 'E' | null;
}

/**
 * 협동 모드 입력 처리 훅
 * - 우클릭: 이동 (싱글플레이와 동일)
 * - 휠 버튼 드래그: 카메라 이동
 * - Space: 카메라 센터링
 * - C 키: 사거리 표시
 * - Q/W/E 키: 스킬 사용
 */
export function useRPGCoopInput({ canvasRef, cameraRef, setCameraPosition }: UseRPGCoopInputOptions): CoopInputState {
  const mousePositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isHoveringRef = useRef(false);
  const isDraggingCameraRef = useRef(false);
  const isRightClickHeldRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  const [showAttackRange, setShowAttackRange] = useState(false);
  const [hoveredSkill, setHoveredSkill] = useState<'Q' | 'W' | 'E' | null>(null);

  const connectionState = useRPGCoopStore((state) => state.connectionState);
  const moveHero = useRPGCoopStore((state) => state.moveHero);
  const useSkill = useRPGCoopStore((state) => state.useSkill);
  const getMyHero = useRPGCoopStore((state) => state.getMyHero);

  // 화면 좌표를 월드 좌표로 변환
  const screenToWorld = useCallback((screenX: number, screenY: number) => {
    const canvas = canvasRef.current;
    const camera = cameraRef.current;
    if (!canvas || !camera) return { x: screenX, y: screenY };

    const rect = canvas.getBoundingClientRect();
    const canvasX = screenX - rect.left;
    const canvasY = screenY - rect.top;

    // 카메라 변환 역적용
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    const worldX = (canvasX - centerX) / camera.zoom + camera.x;
    const worldY = (canvasY - centerY) / camera.zoom + camera.y;

    return { x: worldX, y: worldY };
  }, [canvasRef, cameraRef]);

  // 마우스 클릭 핸들러
  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (connectionState !== 'coop_in_game') return;

    const hero = getMyHero();
    const camera = cameraRef.current;

    if (e.button === 1) {
      // 중버튼: 카메라 드래그 시작
      e.preventDefault();
      isDraggingCameraRef.current = true;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
    } else if (e.button === 2) {
      // 우클릭: 이동 시작 (싱글플레이와 동일)
      if (!hero || hero.isDead) return;

      isRightClickHeldRef.current = true;
      const worldPos = screenToWorld(e.clientX, e.clientY);

      // 맵 경계 체크
      const clampedX = Math.max(30, Math.min(RPG_CONFIG.MAP_WIDTH - 30, worldPos.x));
      const clampedY = Math.max(30, Math.min(RPG_CONFIG.MAP_HEIGHT - 30, worldPos.y));

      moveHero(clampedX, clampedY);
    }
  }, [connectionState, getMyHero, moveHero, screenToWorld, cameraRef]);

  // 마우스 이동 핸들러
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const worldPos = screenToWorld(e.clientX, e.clientY);
    mousePositionRef.current = worldPos;
    isHoveringRef.current = true;

    // 스토어 마우스 위치 업데이트 (스킬 범위 표시용)
    useRPGCoopStore.getState().setMousePosition(worldPos.x, worldPos.y);

    const camera = cameraRef.current;

    // 카메라 드래그 중
    if (isDraggingCameraRef.current && camera && setCameraPosition) {
      const dx = e.clientX - lastMouseRef.current.x;
      const dy = e.clientY - lastMouseRef.current.y;

      setCameraPosition(
        camera.x - dx / camera.zoom,
        camera.y - dy / camera.zoom
      );
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
    }
    // 우클릭 홀드 중: 계속 이동
    else if (isRightClickHeldRef.current) {
      const hero = getMyHero();
      if (hero && !hero.isDead) {
        const clampedX = Math.max(30, Math.min(RPG_CONFIG.MAP_WIDTH - 30, worldPos.x));
        const clampedY = Math.max(30, Math.min(RPG_CONFIG.MAP_HEIGHT - 30, worldPos.y));
        moveHero(clampedX, clampedY);
      }
    }
  }, [screenToWorld, cameraRef, setCameraPosition, getMyHero, moveHero]);

  // 마우스 업 핸들러
  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (e.button === 1) {
      isDraggingCameraRef.current = false;
    } else if (e.button === 2) {
      isRightClickHeldRef.current = false;
    }
  }, []);

  // 마우스 나감 핸들러
  const handleMouseLeave = useCallback(() => {
    isHoveringRef.current = false;
    isDraggingCameraRef.current = false;
    isRightClickHeldRef.current = false;
  }, []);

  // 우클릭 컨텍스트 메뉴 방지
  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
  }, []);

  // 마우스 휠 핸들러 (줌)
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const camera = cameraRef.current;
    if (!camera) return;

    const delta = e.deltaY > 0 ? -ZOOM_SPEED : ZOOM_SPEED;
    const newZoom = Math.max(
      RPG_CONFIG.CAMERA.MIN_ZOOM,
      Math.min(RPG_CONFIG.CAMERA.MAX_ZOOM, camera.zoom + delta)
    );

    camera.zoom = newZoom;
  }, [cameraRef]);

  // 키보드 핸들러
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // 입력 필드에서 입력 중이면 무시
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    const key = e.key.toLowerCase();

    // C 키: 사거리 표시 (게임 상태와 무관하게)
    if (key === 'c') {
      setShowAttackRange(true);
      return;
    }

    // Space 키: 카메라 센터링 (게임 상태와 무관하게)
    if (key === ' ') {
      e.preventDefault();
      const hero = getMyHero();
      if (hero && setCameraPosition) {
        setCameraPosition(hero.x, hero.y);
      }
      return;
    }

    // 게임 중이 아니면 나머지 키 무시
    if (connectionState !== 'coop_in_game') return;

    const hero = getMyHero();
    if (!hero || hero.isDead) return;

    // 스킬 키
    if (key === 'q' || key === 'w' || key === 'e') {
      e.preventDefault();
      const slot = key.toUpperCase() as 'Q' | 'W' | 'E';
      const targetPos = mousePositionRef.current;
      useSkill(slot, targetPos.x, targetPos.y);
    }
  }, [connectionState, getMyHero, useSkill, setCameraPosition]);

  // 키업 핸들러
  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    const key = e.key.toLowerCase();

    // C 키를 떼면 사거리 표시 비활성화
    if (key === 'c') {
      setShowAttackRange(false);
    }
  }, []);

  // 이벤트 리스너 등록
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('contextmenu', handleContextMenu);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      canvas.removeEventListener('contextmenu', handleContextMenu);
      canvas.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [canvasRef, handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave, handleContextMenu, handleWheel, handleKeyDown, handleKeyUp]);

  return {
    mousePosition: mousePositionRef,
    isHovering: isHoveringRef,
    showAttackRange,
    hoveredSkill,
  };
}

/**
 * 스킬 쿨다운 상태 확인
 */
export function useCoopSkillCooldowns() {
  const gameState = useRPGCoopStore((state) => state.gameState);
  const myHeroId = useRPGCoopStore((state) => state.myHeroId);

  if (!gameState || !myHeroId) {
    return { Q: 0, W: 0, E: 0 };
  }

  const myHero = gameState.heroes.find(h => h.id === myHeroId);
  if (!myHero) {
    return { Q: 0, W: 0, E: 0 };
  }

  return myHero.skillCooldowns;
}
