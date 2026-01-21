import { useRef, useCallback, RefObject, useEffect } from 'react';
import { useRPGStore } from '../stores/useRPGStore';
import { useUIStore } from '../stores/useUIStore';
import { findEnemyAtPosition } from '../game/rpg/heroUnit';
import { RPG_CONFIG } from '../constants/rpgConfig';
import { soundManager } from '../services/SoundManager';
import { SkillType } from '../types/rpg';

const ZOOM_SPEED = 0.1;

interface UseRPGInputReturn {
  handleMouseDown: (e: React.MouseEvent) => void;
  handleMouseMove: (e: React.MouseEvent) => void;
  handleMouseUp: (e: React.MouseEvent) => void;
  handleContextMenu: (e: React.MouseEvent) => void;
  handleWheel: (e: React.WheelEvent) => void;
}

export function useRPGInput(canvasRef: RefObject<HTMLCanvasElement | null>): UseRPGInputReturn {
  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  // 카메라 드래그 관련 (중버튼)
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const state = useRPGStore.getState();
      const canvas = canvasRef.current;
      if (!canvas || !state.hero) return;

      const rect = canvas.getBoundingClientRect();
      const zoom = state.camera.zoom;

      // 화면 좌표를 월드 좌표로 변환
      // state.camera.x/y는 화면 중앙의 월드 좌표
      const screenX = (e.clientX - rect.left) / zoom;
      const screenY = (e.clientY - rect.top) / zoom;
      const scaledWidth = rect.width / zoom;
      const scaledHeight = rect.height / zoom;

      // 화면 좌상단의 월드 좌표 + 화면에서의 위치 = 클릭 위치의 월드 좌표
      const clickX = state.camera.x - scaledWidth / 2 + screenX;
      const clickY = state.camera.y - scaledHeight / 2 + screenY;

      if (e.button === 0) {
        // 좌클릭: 아무 동작 없음 (Q키로 공격)
      } else if (e.button === 1) {
        // 중버튼: 카메라 드래그 시작
        isDraggingRef.current = true;
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
        // 카메라 추적 해제
        if (state.camera.followHero) {
          useRPGStore.getState().toggleFollowHero();
        }
      } else if (e.button === 2) {
        // 우클릭: 이동
        // 맵 경계 내로 제한
        const targetX = Math.max(30, Math.min(RPG_CONFIG.MAP_WIDTH - 30, clickX));
        const targetY = Math.max(30, Math.min(RPG_CONFIG.MAP_HEIGHT - 30, clickY));
        useRPGStore.getState().moveHero(targetX, targetY);
      }
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

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();

      const canvas = canvasRef.current;
      if (!canvas) return;

      const state = useRPGStore.getState();
      const currentZoom = state.camera.zoom;

      // 스크롤 방향에 따라 줌 인/아웃
      const delta = e.deltaY > 0 ? -ZOOM_SPEED : ZOOM_SPEED;
      const newZoom = Math.max(
        RPG_CONFIG.CAMERA.MIN_ZOOM,
        Math.min(RPG_CONFIG.CAMERA.MAX_ZOOM, currentZoom + delta)
      );

      useRPGStore.getState().setZoom(newZoom);
    },
    [canvasRef]
  );

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleContextMenu,
    handleWheel,
  };
}

/**
 * RPG 키보드 입력 처리 훅
 */
export function useRPGKeyboard(requestSkill?: (skillType: SkillType) => boolean) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = useRPGStore.getState();

      // V 키는 게임 상태와 관계없이 처리 (사거리 표시)
      if (e.key.toLowerCase() === 'v') {
        useRPGStore.getState().setShowAttackRange(true);
        return;
      }

      if (!state.running || state.paused || state.gameOver) return;
      if (!state.hero) return;

      const heroClass = state.hero.heroClass;
      const skills = state.hero.skills;

      switch (e.key.toLowerCase()) {
        case 'q':
          // Q 스킬 (일반공격)
          {
            const qSkill = skills.find(s => s.key === 'Q');
            if (qSkill && qSkill.unlocked && qSkill.currentCooldown <= 0) {
              if (requestSkill?.(qSkill.type)) {
                soundManager.play('attack_melee');
              }
            }
          }
          break;

        case 'w':
          // W 스킬
          {
            const wSkill = skills.find(s => s.key === 'W');
            if (wSkill && wSkill.unlocked && wSkill.currentCooldown <= 0) {
              if (requestSkill?.(wSkill.type)) {
                soundManager.play('attack_melee');
              }
            }
          }
          break;

        case 'e':
          // E 스킬 (궁극기)
          {
            const eSkill = skills.find(s => s.key === 'E');
            if (eSkill && eSkill.unlocked && eSkill.currentCooldown <= 0) {
              if (requestSkill?.(eSkill.type)) {
                if (heroClass === 'knight') {
                  soundManager.play('heal');
                } else {
                  soundManager.play('attack_melee');
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
            useUIStore.getState().setScreen('paused');
            useRPGStore.getState().setPaused(true);
          }
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // V 키를 떼면 사거리 표시 비활성화
      if (e.key.toLowerCase() === 'v') {
        useRPGStore.getState().setShowAttackRange(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [requestSkill]);
}
