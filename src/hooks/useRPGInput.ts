import { useRef, useCallback, RefObject, useEffect } from 'react';
import { useRPGStore } from '../stores/useRPGStore';
import { useUIStore } from '../stores/useUIStore';
import { RPG_CONFIG } from '../constants/rpgConfig';
import { soundManager } from '../services/SoundManager';
import { SkillType } from '../types/rpg';
import { sendMoveDirection, sendSkillUse } from './useNetworkSync';

const ZOOM_SPEED = 0.1;

// WASD 키 상태 추적
const keyState = {
  w: false,
  a: false,
  s: false,
  d: false,
};

interface UseRPGInputReturn {
  handleMouseDown: (e: React.MouseEvent) => void;
  handleMouseMove: (e: React.MouseEvent) => void;
  handleMouseUp: (e: React.MouseEvent) => void;
  handleContextMenu: (e: React.MouseEvent) => void;
}

export function useRPGInput(canvasRef: RefObject<HTMLCanvasElement | null>): UseRPGInputReturn {
  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  // 마우스 클릭 처리 (카메라 드래그만)
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const state = useRPGStore.getState();
      const canvas = canvasRef.current;
      if (!canvas || !state.hero) return;

      if (e.button === 1) {
        // 중버튼: 카메라 드래그 시작
        isDraggingRef.current = true;
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
        // 카메라 추적 해제
        if (state.camera.followHero) {
          useRPGStore.getState().toggleFollowHero();
        }
      }
      // 우클릭 이동 제거됨 - WASD로 이동
    },
    [canvasRef]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const state = useRPGStore.getState();
      const rect = canvas.getBoundingClientRect();
      const zoom = state.camera.zoom;

      // 화면 좌표를 월드 좌표로 변환
      const screenX = (e.clientX - rect.left) / zoom;
      const screenY = (e.clientY - rect.top) / zoom;
      const scaledWidth = rect.width / zoom;
      const scaledHeight = rect.height / zoom;

      const worldX = state.camera.x - scaledWidth / 2 + screenX;
      const worldY = state.camera.y - scaledHeight / 2 + screenY;

      // 마우스 위치 저장 (스킬 타겟 및 방향 결정용)
      useRPGStore.getState().setMousePosition(worldX, worldY);

      if (isDraggingRef.current) {
        // 카메라 드래그
        const dx = e.clientX - lastMouseRef.current.x;
        const dy = e.clientY - lastMouseRef.current.y;
        useRPGStore.getState().setCamera(
          state.camera.x - dx / state.camera.zoom,
          state.camera.y - dy / state.camera.zoom
        );
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
      }
    },
    [canvasRef]
  );

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (e.button === 1) {
      isDraggingRef.current = false;
    }
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // 휠 이벤트는 passive: false로 네이티브 이벤트 리스너 사용 (preventDefault 허용)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const state = useRPGStore.getState();
      const currentZoom = state.camera.zoom;

      // 스크롤 방향에 따라 줌 인/아웃
      const delta = e.deltaY > 0 ? -ZOOM_SPEED : ZOOM_SPEED;
      const newZoom = Math.max(
        RPG_CONFIG.CAMERA.MIN_ZOOM,
        Math.min(RPG_CONFIG.CAMERA.MAX_ZOOM, currentZoom + delta)
      );

      useRPGStore.getState().setZoom(newZoom);
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [canvasRef]);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleContextMenu,
  };
}

// WASD 키 상태로부터 이동 방향 계산
function calculateMoveDirection(): { x: number; y: number } | undefined {
  let x = 0;
  let y = 0;

  if (keyState.w) y -= 1;
  if (keyState.s) y += 1;
  if (keyState.a) x -= 1;
  if (keyState.d) x += 1;

  if (x === 0 && y === 0) {
    return undefined;
  }

  return { x, y };
}

// 이동 방향 업데이트 및 네트워크 전송
function updateMoveDirection() {
  const direction = calculateMoveDirection();
  useRPGStore.getState().setMoveDirection(direction);

  // 서버 권위 모델: 모든 클라이언트가 서버로 입력 전송 (호스트 포함)
  const { isMultiplayer } = useRPGStore.getState().multiplayer;
  if (isMultiplayer) {
    sendMoveDirection(direction || null);
  }
}

/**
 * RPG 키보드 입력 처리 훅
 * - WASD: 이동
 * - Shift: W 스킬
 * - R: E 궁극기
 * - C: 사거리 표시
 * - Space: 카메라 센터링
 * - ESC: 일시정지
 */
export function useRPGKeyboard(requestSkill?: (skillType: SkillType) => boolean) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = useRPGStore.getState();
      const key = e.key.toLowerCase();

      // C 키는 게임 상태와 관계없이 처리 (사거리 표시)
      if (key === 'c') {
        useRPGStore.getState().setShowAttackRange(true);
        return;
      }

      // WASD 처리
      if (state.running && !state.paused && !state.gameOver && state.hero) {
        if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
          keyState[key as 'w' | 'a' | 's' | 'd'] = true;

          // 생존 상태: 캐릭터 이동
          if (state.hero.hp > 0) {
            updateMoveDirection();
          } else {
            // 사망 상태: 카메라 이동 (관전 모드)
            const cameraSpeed = 15;
            let dx = 0, dy = 0;
            if (keyState.w) dy -= cameraSpeed;
            if (keyState.s) dy += cameraSpeed;
            if (keyState.a) dx -= cameraSpeed;
            if (keyState.d) dx += cameraSpeed;

            if (dx !== 0 || dy !== 0) {
              const camera = state.camera;
              useRPGStore.getState().setCamera(camera.x + dx, camera.y + dy);
              // 카메라 추적 해제
              if (camera.followHero) {
                useRPGStore.getState().toggleFollowHero();
              }
            }
          }
          return;
        }
      }

      if (!state.running || state.paused || state.gameOver) return;
      if (!state.hero || state.hero.hp <= 0) return;

      const heroClass = state.hero.heroClass;
      const skills = state.hero.skills;

      switch (key) {
        case 'shift':
          // Shift: W 스킬
          e.preventDefault();
          {
            const wSkill = skills.find(s => s.key === 'W');
            if (wSkill && wSkill.currentCooldown <= 0) {
              const { isMultiplayer } = state.multiplayer;
              if (isMultiplayer) {
                // 서버 권위 모델: 서버로 스킬 요청 전송 (모든 클라이언트)
                sendSkillUse('W', state.mousePosition.x, state.mousePosition.y);
                soundManager.play('attack_melee');
              } else if (requestSkill?.(wSkill.type)) {
                // 싱글플레이: 로컬에서 스킬 실행
                soundManager.play('attack_melee');
              }
            }
          }
          break;

        case 'r':
          // R: E 스킬 (궁극기)
          {
            const eSkill = skills.find(s => s.key === 'E');
            if (eSkill && eSkill.currentCooldown <= 0) {
              const { isMultiplayer } = state.multiplayer;
              if (isMultiplayer) {
                // 서버 권위 모델: 서버로 스킬 요청 전송 (모든 클라이언트)
                sendSkillUse('E', state.mousePosition.x, state.mousePosition.y);
                if (heroClass === 'knight' || heroClass === 'warrior') {
                  soundManager.play('heal');
                } else {
                  soundManager.play('attack_ranged');
                }
              } else if (requestSkill?.(eSkill.type)) {
                // 싱글플레이: 로컬에서 스킬 실행
                if (heroClass === 'knight' || heroClass === 'warrior') {
                  soundManager.play('heal');
                } else {
                  soundManager.play('attack_ranged');
                }
              }
            }
          }
          break;

        case ' ':
          // 스페이스: 영웅 위치로 카메라 이동
          e.preventDefault();
          useRPGStore.getState().centerOnHero();
          if (!state.camera.followHero) {
            useRPGStore.getState().toggleFollowHero();
          }
          break;

        case 'escape':
          // ESC: 일시정지
          if (!state.gameOver) {
            if (state.isTutorial) {
              // 튜토리얼: 화면 전환 없이 일시정지만
              useRPGStore.getState().setPaused(!state.paused);
            } else {
              // 일반 모드: 일시정지 화면으로 전환
              useUIStore.getState().setScreen('paused');
              useRPGStore.getState().setPaused(true);
            }
          }
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      // C 키를 떼면 사거리 표시 비활성화
      if (key === 'c') {
        useRPGStore.getState().setShowAttackRange(false);
        return;
      }

      // WASD 키 해제
      if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
        keyState[key as 'w' | 'a' | 's' | 'd'] = false;
        updateMoveDirection();
      }
    };

    // 창 포커스를 잃을 때 키 상태 초기화 (keyup 이벤트 누락 방지)
    const handleBlur = () => {
      const wasMoving = keyState.w || keyState.a || keyState.s || keyState.d;
      keyState.w = false;
      keyState.a = false;
      keyState.s = false;
      keyState.d = false;
      if (wasMoving) {
        updateMoveDirection();
      }
    };

    // 문서 가시성 변경 시 키 상태 초기화 (탭 전환 등)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleBlur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // 클린업 시 키 상태 초기화
      keyState.w = false;
      keyState.a = false;
      keyState.s = false;
      keyState.d = false;
    };
  }, [requestSkill]);
}
