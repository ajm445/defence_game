import React, { useRef, useCallback, useEffect } from 'react';
import { useRPGStore } from '../../stores/useRPGStore';
import { useUIStore } from '../../stores/useUIStore';
import { sendMoveDirection } from '../../hooks/useNetworkSync';

const BASE_RADIUS = 60;
const KNOB_RADIUS = 25;
const MAX_DRAG = 60;

export const VirtualJoystick: React.FC = () => {
  const uiScale = useUIStore((s) => s.uiScale);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const centerRef = useRef({ x: 0, y: 0 });
  const knobRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLDivElement>(null);
  const lastDirRef = useRef<{ x: number; y: number } | null>(null);
  const defaultPosRef = useRef({ x: 0, y: 0 });

  const scaledBase = Math.round(BASE_RADIUS * uiScale);
  const scaledKnob = Math.round(KNOB_RADIUS * uiScale);
  const scaledMaxDrag = Math.round(MAX_DRAG * uiScale);

  // 기본 위치에 고스트 조이스틱 표시 (처음 보는 유저를 위한 힌트)
  useEffect(() => {
    const cssZoom = parseFloat(document.documentElement.style.zoom) || 1;
    const x = (window.innerWidth / cssZoom) * 0.15;
    const y = (window.innerHeight / cssZoom) * 0.82;
    defaultPosRef.current = { x, y };
    if (baseRef.current) {
      baseRef.current.style.left = `${x - scaledBase}px`;
      baseRef.current.style.top = `${y - scaledBase}px`;
    }
  }, [scaledBase]);

  const updateDirection = useCallback((clientX: number, clientY: number) => {
    // CSS zoom 보정: centerRef는 줌 보정된 좌표이므로 clientX/Y도 보정
    const cssZoom = parseFloat(document.documentElement.style.zoom) || 1;
    const dx = clientX / cssZoom - centerRef.current.x;
    const dy = clientY / cssZoom - centerRef.current.y;
    const dist = Math.hypot(dx, dy);

    // 노브 위치 업데이트 (DOM 직접 조작 - 성능 최적화)
    const clampedDist = Math.min(dist, scaledMaxDrag);
    const angle = Math.atan2(dy, dx);
    const knobX = Math.cos(angle) * clampedDist;
    const knobY = Math.sin(angle) * clampedDist;

    if (knobRef.current) {
      knobRef.current.style.transform = `translate(${knobX}px, ${knobY}px)`;
    }

    const state = useRPGStore.getState();
    const isHeroDead = state.hero && state.hero.hp <= 0;

    // 데드존 (10% 이내면 무시)
    if (dist < scaledMaxDrag * 0.1) {
      if (lastDirRef.current !== null) {
        lastDirRef.current = null;
        if (!isHeroDead) {
          state.setMoveDirection(undefined);
          sendMoveDirection(null);
        }
      }
      return;
    }

    // 정규화된 방향 벡터
    const normX = dx / dist;
    const normY = dy / dist;

    // 방향 변경 시에만 상태 업데이트 (성능)
    const prev = lastDirRef.current;
    if (!prev || Math.abs(prev.x - normX) > 0.05 || Math.abs(prev.y - normY) > 0.05) {
      lastDirRef.current = { x: normX, y: normY };

      // 사망 시 카메라 이동 (관전 모드)
      if (isHeroDead) {
        const camera = state.camera;
        // followHero 해제하여 게임 루프의 카메라 추적 방지
        if (camera.followHero) {
          useRPGStore.setState((s) => ({
            camera: { ...s.camera, followHero: false },
          }));
        }
        const camSpeed = 8;
        state.setCamera(camera.x + normX * camSpeed, camera.y + normY * camSpeed);
        return;
      }

      // 시전 중에는 이동 무시
      if (state.hero?.castingUntil && state.gameTime < state.hero.castingUntil) {
        return;
      }

      state.setMoveDirection({ x: normX, y: normY });
      sendMoveDirection({ x: normX, y: normY });
    }
  }, [scaledMaxDrag]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (activeRef.current) return;

    // CSS zoom 보정: clientX/Y는 디바이스 픽셀, CSS left/top은 줌된 좌표계
    const cssZoom = parseFloat(document.documentElement.style.zoom) || 1;
    const cx = e.clientX / cssZoom;
    const cy = e.clientY / cssZoom;

    activeRef.current = true;
    pointerIdRef.current = e.pointerId;
    centerRef.current = { x: cx, y: cy };

    // 조이스틱을 터치 위치에 표시 (플로팅 방식)
    if (baseRef.current) {
      baseRef.current.style.left = `${cx - scaledBase}px`;
      baseRef.current.style.top = `${cy - scaledBase}px`;
      baseRef.current.style.opacity = '1';
    }
    if (knobRef.current) {
      knobRef.current.style.transform = 'translate(0px, 0px)';
    }

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [scaledBase]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!activeRef.current || e.pointerId !== pointerIdRef.current) return;
    updateDirection(e.clientX, e.clientY);
  }, [updateDirection]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (e.pointerId !== pointerIdRef.current) return;

    activeRef.current = false;
    pointerIdRef.current = null;
    lastDirRef.current = null;

    // 조이스틱을 기본 위치로 복귀 (고스트 표시)
    if (baseRef.current) {
      const dp = defaultPosRef.current;
      baseRef.current.style.left = `${dp.x - scaledBase}px`;
      baseRef.current.style.top = `${dp.y - scaledBase}px`;
      baseRef.current.style.opacity = '0.6';
    }
    if (knobRef.current) {
      knobRef.current.style.transform = 'translate(0px, 0px)';
    }

    // 이동 정지
    const state = useRPGStore.getState();
    state.setMoveDirection(undefined);
    sendMoveDirection(null);
  }, [scaledBase]);

  // 언마운트 시 이동 정지
  useEffect(() => {
    return () => {
      const state = useRPGStore.getState();
      state.setMoveDirection(undefined);
      sendMoveDirection(null);
    };
  }, []);

  return (
    <>
      {/* 터치 영역 - 화면 왼쪽 40%, 하단 50% */}
      <div
        ref={containerRef}
        className="absolute left-0 bottom-0 z-40"
        style={{
          width: '40%',
          height: '50%',
          touchAction: 'none',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />

      {/* 조이스틱 베이스 (플로팅 - 터치 위치에 나타남) */}
      <div
        ref={baseRef}
        className="fixed z-40 pointer-events-none"
        style={{
          width: scaledBase * 2,
          height: scaledBase * 2,
          opacity: 0.6,
          transition: 'opacity 0.15s',
        }}
      >
        {/* 외부 원 */}
        <div
          className="absolute inset-0 rounded-full border-2 border-white/60 bg-black/40"
          style={{ backdropFilter: 'blur(4px)' }}
        />

        {/* 노브 */}
        <div
          ref={knobRef}
          className="absolute rounded-full bg-white/80 border-2 border-white/90"
          style={{
            width: scaledKnob * 2,
            height: scaledKnob * 2,
            left: scaledBase - scaledKnob,
            top: scaledBase - scaledKnob,
            transition: 'none',
          }}
        />
      </div>
    </>
  );
};
