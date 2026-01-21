import { useRef, useCallback, useEffect } from 'react';
import { useRPGCoopStore } from '../stores/useRPGCoopStore';
import { effectManager } from '../effects';

/**
 * 협동 모드 클라이언트 게임 루프
 * - 서버에서 게임 로직 처리, 클라이언트는 렌더링 + 입력 처리
 * - 클라이언트 예측으로 로컬 영웅 이동 부드럽게 처리
 */
export function useRPGCoopGameLoop() {
  const lastTimeRef = useRef<number>(0);
  const animationIdRef = useRef<number>(0);

  const connectionState = useRPGCoopStore((state) => state.connectionState);
  const gameState = useRPGCoopStore((state) => state.gameState);

  const tick = useCallback((timestamp: number) => {
    const state = useRPGCoopStore.getState();

    // 게임 진행 중이 아니면 루프 유지만
    if (state.connectionState !== 'coop_in_game' || !state.gameState) {
      animationIdRef.current = requestAnimationFrame(tick);
      return;
    }

    const deltaTime = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1);
    lastTimeRef.current = timestamp;

    // 이펙트 매니저 업데이트
    effectManager.update(deltaTime);

    // 로컬 영웅 위치 보간 (클라이언트 예측)
    updateLocalHeroPosition(state, deltaTime);

    animationIdRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (connectionState === 'coop_in_game' && gameState) {
      lastTimeRef.current = performance.now();
      animationIdRef.current = requestAnimationFrame(tick);
    }

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    };
  }, [connectionState, gameState, tick]);

  return {
    isRunning: connectionState === 'coop_in_game' && gameState !== null,
  };
}

/**
 * 로컬 영웅 위치 보간
 * - 서버 위치와 로컬 예측 위치 사이를 부드럽게 보간
 */
function updateLocalHeroPosition(
  state: ReturnType<typeof useRPGCoopStore.getState>,
  _deltaTime: number
) {
  const { gameState, myHeroId, localHeroPosition } = state;
  if (!gameState || !myHeroId) return;

  const myHero = gameState.heroes.find(h => h.id === myHeroId);
  if (!myHero || myHero.isDead) return;

  // 로컬 예측 위치가 있고 목표 위치가 있으면 보간
  if (localHeroPosition && myHero.targetX !== undefined && myHero.targetY !== undefined) {
    const targetX = myHero.targetX;
    const targetY = myHero.targetY;

    const dx = targetX - localHeroPosition.x;
    const dy = targetY - localHeroPosition.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 5) {
      // 이동 중: 부드럽게 이동
      const speed = myHero.speed || 3;
      const moveX = (dx / dist) * speed;
      const moveY = (dy / dist) * speed;

      const newX = localHeroPosition.x + moveX;
      const newY = localHeroPosition.y + moveY;

      // 목표 지점을 지나쳤는지 체크
      const newDist = Math.sqrt((targetX - newX) ** 2 + (targetY - newY) ** 2);
      if (newDist < dist) {
        useRPGCoopStore.setState({
          localHeroPosition: { x: newX, y: newY },
        });
      } else {
        // 목표 도달
        useRPGCoopStore.setState({
          localHeroPosition: { x: targetX, y: targetY },
        });
      }
    }
  }
}

/**
 * 협동 모드에서 영웅의 실제 렌더링 위치 계산
 * - 내 영웅: 로컬 예측 위치 우선
 * - 다른 영웅: 서버 위치 사용
 */
export function getHeroRenderPosition(
  heroId: string,
  serverX: number,
  serverY: number
): { x: number; y: number } {
  const state = useRPGCoopStore.getState();

  // 내 영웅인 경우 로컬 예측 위치 사용
  if (heroId === state.myHeroId && state.localHeroPosition) {
    return state.localHeroPosition;
  }

  // 다른 영웅은 서버 위치 사용
  return { x: serverX, y: serverY };
}

/**
 * 카메라 위치 계산 (내 영웅 중심)
 */
export function getCameraPosition(): { x: number; y: number } {
  const state = useRPGCoopStore.getState();
  const { gameState, myHeroId, localHeroPosition } = state;

  if (!gameState || !myHeroId) {
    return { x: 1000, y: 1000 };  // 맵 중앙
  }

  const myHero = gameState.heroes.find(h => h.id === myHeroId);
  if (!myHero) {
    return { x: 1000, y: 1000 };
  }

  // 로컬 예측 위치가 있으면 사용
  if (localHeroPosition) {
    return localHeroPosition;
  }

  return { x: myHero.x, y: myHero.y };
}
