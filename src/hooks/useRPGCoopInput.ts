import { useEffect, useCallback, useRef, useState } from 'react';
import { useRPGCoopStore } from '../stores/useRPGCoopStore';
import { RPG_CONFIG } from '../constants/rpgConfig';
import { soundManager } from '../services/SoundManager';

const ZOOM_SPEED = 0.1;

// WASD 키 상태 추적
const keyState = {
  w: false,
  a: false,
  s: false,
  d: false,
};

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

// WASD 키 상태로부터 이동 방향 계산
function calculateMoveDirection(): { x: number; y: number } | null {
  let x = 0;
  let y = 0;

  if (keyState.w) y -= 1;
  if (keyState.s) y += 1;
  if (keyState.a) x -= 1;
  if (keyState.d) x += 1;

  if (x === 0 && y === 0) {
    return null;
  }

  // 정규화
  const length = Math.sqrt(x * x + y * y);
  return { x: x / length, y: y / length };
}

/**
 * 협동 모드 입력 처리 훅
 * - WASD: 이동
 * - 휠 버튼 드래그: 카메라 이동
 * - Space: 카메라 센터링
 * - C 키: 사거리 표시
 * - Shift: W 스킬, R: E 궁극기
 */
export function useRPGCoopInput({ canvasRef, cameraRef, setCameraPosition }: UseRPGCoopInputOptions): CoopInputState {
  const mousePositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isHoveringRef = useRef(false);
  const isDraggingCameraRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  const [showAttackRange, setShowAttackRange] = useState(false);
  const [hoveredSkill, setHoveredSkill] = useState<'Q' | 'W' | 'E' | null>(null);

  const connectionState = useRPGCoopStore((state) => state.connectionState);
  const setMoveDirection = useRPGCoopStore((state) => state.setMoveDirection);
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

    if (e.button === 1) {
      // 중버튼: 카메라 드래그 시작
      e.preventDefault();
      isDraggingCameraRef.current = true;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
    }
    // 우클릭 이동 제거됨 - WASD로 이동
  }, [connectionState]);

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
  }, [screenToWorld, cameraRef, setCameraPosition]);

  // 마우스 업 핸들러
  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (e.button === 1) {
      isDraggingCameraRef.current = false;
    }
  }, []);

  // 마우스 나감 핸들러
  const handleMouseLeave = useCallback(() => {
    isHoveringRef.current = false;
    isDraggingCameraRef.current = false;
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

  // 이동 방향 업데이트 및 서버 전송
  const updateMoveDirection = useCallback(() => {
    const direction = calculateMoveDirection();
    setMoveDirection(direction);
  }, [setMoveDirection]);

  // 이동 중지 (방향 null 전송)
  const stopMoving = useCallback(() => {
    setMoveDirection(null);
  }, [setMoveDirection]);

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
    const camera = cameraRef.current;

    // WASD 이동 / 카메라 이동 (사망 시)
    if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
      if (hero && !hero.isDead) {
        // 살아있으면 영웅 이동
        keyState[key as 'w' | 'a' | 's' | 'd'] = true;
        updateMoveDirection();
      } else if (camera && setCameraPosition) {
        // 사망 시 카메라 이동 (관전 모드)
        const CAMERA_SPEED = 15;
        let dx = 0, dy = 0;
        if (key === 'w') dy = -CAMERA_SPEED;
        if (key === 's') dy = CAMERA_SPEED;
        if (key === 'a') dx = -CAMERA_SPEED;
        if (key === 'd') dx = CAMERA_SPEED;

        const newX = Math.max(0, Math.min(RPG_CONFIG.MAP_WIDTH, camera.x + dx));
        const newY = Math.max(0, Math.min(RPG_CONFIG.MAP_HEIGHT, camera.y + dy));
        setCameraPosition(newX, newY);
      }
      return;
    }

    // 살아있을 때만 스킬 사용 가능
    if (!hero || hero.isDead) return;

    // Shift 키: W 스킬
    if (key === 'shift') {
      e.preventDefault();
      const targetPos = mousePositionRef.current;
      if (hero.skillCooldowns.W <= 0) {
        useSkill('W', targetPos.x, targetPos.y);
        // 사운드는 RPGCoopGameScreen에서 처리
      }
      return;
    }

    // R 키: E 궁극기
    if (key === 'r') {
      e.preventDefault();
      const targetPos = mousePositionRef.current;
      if (hero.skillCooldowns.E <= 0) {
        useSkill('E', targetPos.x, targetPos.y);
        // 사운드는 RPGCoopGameScreen에서 처리
      }
      return;
    }
  }, [connectionState, getMyHero, useSkill, setCameraPosition, updateMoveDirection, cameraRef]);

  // 키업 핸들러
  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    const key = e.key.toLowerCase();

    // C 키를 떼면 사거리 표시 비활성화
    if (key === 'c') {
      setShowAttackRange(false);
      return;
    }

    // WASD 키 해제
    if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
      keyState[key as 'w' | 'a' | 's' | 'd'] = false;
      const stillMoving = keyState.w || keyState.a || keyState.s || keyState.d;
      if (stillMoving) {
        // 다른 키가 아직 눌려있으면 방향 업데이트
        updateMoveDirection();
      } else {
        // 모든 키가 떼어졌으면 이동 중지
        stopMoving();
      }
    }
  }, [updateMoveDirection, stopMoving]);

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

      // 클린업 시 키 상태 초기화
      keyState.w = false;
      keyState.a = false;
      keyState.s = false;
      keyState.d = false;
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
