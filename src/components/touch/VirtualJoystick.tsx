import React, { useRef, useCallback, useEffect } from 'react';
import { useRPGStore } from '../../stores/useRPGStore';
import { useUIStore } from '../../stores/useUIStore';
import { sendMoveDirection } from '../../hooks/useNetworkSync';

const BASE_RADIUS = 50;
const KNOB_RADIUS = 20;
const MAX_DRAG = 50;

export const VirtualJoystick: React.FC = () => {
  const uiScale = useUIStore((s) => s.uiScale);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const centerRef = useRef({ x: 0, y: 0 });
  const knobRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLDivElement>(null);
  const lastDirRef = useRef<{ x: number; y: number } | null>(null);

  const scaledBase = Math.round(BASE_RADIUS * uiScale);
  const scaledKnob = Math.round(KNOB_RADIUS * uiScale);
  const scaledMaxDrag = Math.round(MAX_DRAG * uiScale);

  const updateDirection = useCallback((clientX: number, clientY: number) => {
    const dx = clientX - centerRef.current.x;
    const dy = clientY - centerRef.current.y;
    const dist = Math.hypot(dx, dy);

    // 노브 위치 업데이트 (DOM 직접 조작 - 성능 최적화)
    const clampedDist = Math.min(dist, scaledMaxDrag);
    const angle = Math.atan2(dy, dx);
    const knobX = Math.cos(angle) * clampedDist;
    const knobY = Math.sin(angle) * clampedDist;

    if (knobRef.current) {
      knobRef.current.style.transform = `translate(${knobX}px, ${knobY}px)`;
    }

    // 데드존 (10% 이내면 무시)
    if (dist < scaledMaxDrag * 0.1) {
      if (lastDirRef.current !== null) {
        lastDirRef.current = null;
        const state = useRPGStore.getState();
        state.setMoveDirection(undefined);
        if (state.multiplayer.isMultiplayer) {
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
      const state = useRPGStore.getState();

      // 시전 중에는 이동 무시
      if (state.hero?.castingUntil && state.gameTime < state.hero.castingUntil) {
        return;
      }

      state.setMoveDirection({ x: normX, y: normY });
      if (state.multiplayer.isMultiplayer) {
        sendMoveDirection({ x: normX, y: normY });
      }
    }
  }, [scaledMaxDrag]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (activeRef.current) return;

    activeRef.current = true;
    pointerIdRef.current = e.pointerId;
    centerRef.current = { x: e.clientX, y: e.clientY };

    // 조이스틱을 터치 위치에 표시 (플로팅 방식)
    if (baseRef.current) {
      baseRef.current.style.left = `${e.clientX - scaledBase}px`;
      baseRef.current.style.top = `${e.clientY - scaledBase}px`;
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

    // 조이스틱 숨기기
    if (baseRef.current) {
      baseRef.current.style.opacity = '0';
    }
    if (knobRef.current) {
      knobRef.current.style.transform = 'translate(0px, 0px)';
    }

    // 이동 정지
    const state = useRPGStore.getState();
    state.setMoveDirection(undefined);
    if (state.multiplayer.isMultiplayer) {
      sendMoveDirection(null);
    }
  }, []);

  // 언마운트 시 이동 정지
  useEffect(() => {
    return () => {
      const state = useRPGStore.getState();
      state.setMoveDirection(undefined);
      if (state.multiplayer.isMultiplayer) {
        sendMoveDirection(null);
      }
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
          opacity: 0,
          transition: 'opacity 0.1s',
        }}
      >
        {/* 외부 원 */}
        <div
          className="absolute inset-0 rounded-full border-2 border-white/30 bg-black/20"
          style={{ backdropFilter: 'blur(4px)' }}
        />

        {/* 노브 */}
        <div
          ref={knobRef}
          className="absolute rounded-full bg-white/50 border-2 border-white/70"
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
