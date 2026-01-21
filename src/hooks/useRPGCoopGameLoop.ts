import { useRef, useCallback, useEffect } from 'react';
import { useRPGCoopStore } from '../stores/useRPGCoopStore';
import { effectManager } from '../effects';
import { soundManager } from '../services/SoundManager';
import { CLASS_CONFIGS } from '../constants/rpgConfig';

/**
 * 협동 모드 클라이언트 게임 루프
 * - 서버에서 게임 로직 처리, 클라이언트는 렌더링 + 입력 처리
 * - 클라이언트 예측으로 로컬 영웅 이동 부드럽게 처리
 * - 자동 공격: 사거리 내 적 감지 시 Q 스킬 요청
 */
export function useRPGCoopGameLoop() {
  const lastTimeRef = useRef<number>(0);
  const animationIdRef = useRef<number>(0);
  const lastAutoAttackRef = useRef<number>(0);

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

    // 자동 공격 처리
    processAutoAttack(state, timestamp, lastAutoAttackRef);

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

// 서버 보정 상수
const SERVER_CORRECTION_RATE = 0.15;  // 서버 위치로 보정하는 비율 (프레임당)
const SNAP_THRESHOLD = 150;           // 즉시 스냅하는 거리 임계값

/**
 * 로컬 영웅 위치 보간 (클라이언트 예측 + 서버 보정)
 *
 * 1. 로컬 목표가 있으면 그 방향으로 이동 (클라이언트 예측)
 * 2. 서버 위치와의 차이를 부드럽게 보정 (lerp)
 * 3. 큰 차이(150px+)는 즉시 스냅
 */
function updateLocalHeroPosition(
  state: ReturnType<typeof useRPGCoopStore.getState>,
  deltaTime: number
) {
  const { gameState, myHeroId, localHeroPosition, localTargetPosition } = state;
  if (!gameState || !myHeroId) return;

  const myHero = gameState.heroes.find(h => h.id === myHeroId);
  if (!myHero || myHero.isDead) return;

  // 로컬 위치가 없으면 서버 위치로 초기화
  if (!localHeroPosition) {
    useRPGCoopStore.setState({
      localHeroPosition: { x: myHero.x, y: myHero.y },
    });
    return;
  }

  let newX = localHeroPosition.x;
  let newY = localHeroPosition.y;

  // 1. 로컬 목표가 있으면 그 방향으로 이동
  if (localTargetPosition) {
    const dx = localTargetPosition.x - newX;
    const dy = localTargetPosition.y - newY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 5) {
      // 서버와 동일한 이동 공식: speed * deltaTime * 60
      const speed = myHero.speed || 3;
      const moveDistance = speed * deltaTime * 60;
      const moveX = (dx / dist) * moveDistance;
      const moveY = (dy / dist) * moveDistance;

      newX += moveX;
      newY += moveY;

      // 목표 지점을 지나쳤는지 체크
      const newDist = Math.sqrt((localTargetPosition.x - newX) ** 2 + (localTargetPosition.y - newY) ** 2);
      if (newDist >= dist) {
        // 목표 도달
        newX = localTargetPosition.x;
        newY = localTargetPosition.y;
        useRPGCoopStore.setState({
          localHeroPosition: { x: newX, y: newY },
          localTargetPosition: null,
        });
        return;
      }
    } else {
      // 목표에 거의 도달
      newX = localTargetPosition.x;
      newY = localTargetPosition.y;
      useRPGCoopStore.setState({
        localHeroPosition: { x: newX, y: newY },
        localTargetPosition: null,
      });
      return;
    }
  }

  // 2. 서버 위치와의 차이 계산
  const serverDx = myHero.x - newX;
  const serverDy = myHero.y - newY;
  const serverDist = Math.sqrt(serverDx * serverDx + serverDy * serverDy);

  if (serverDist > SNAP_THRESHOLD) {
    // 큰 차이: 서버 위치로 즉시 스냅
    useRPGCoopStore.setState({
      localHeroPosition: { x: myHero.x, y: myHero.y },
      localTargetPosition: null,
    });
    return;
  }

  // 3. 부드러운 서버 보정 (이동 중이 아닐 때만)
  if (!localTargetPosition && serverDist > 3) {
    // 서버 위치로 점진적 보정 (lerp)
    newX += serverDx * SERVER_CORRECTION_RATE;
    newY += serverDy * SERVER_CORRECTION_RATE;
  }

  useRPGCoopStore.setState({
    localHeroPosition: { x: newX, y: newY },
  });
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

/**
 * 자동 공격 처리
 * - 사거리 내 적이 있고 Q 스킬이 준비되면 자동 공격
 */
function processAutoAttack(
  state: ReturnType<typeof useRPGCoopStore.getState>,
  timestamp: number,
  lastAutoAttackRef: React.MutableRefObject<number>
) {
  const { gameState, myHeroId } = state;
  if (!gameState || !myHeroId) return;

  const myHero = gameState.heroes.find(h => h.id === myHeroId);
  if (!myHero || myHero.isDead) return;

  // Q 스킬 쿨다운 체크
  if (myHero.skillCooldowns.Q > 0) return;

  // 스로틀링 (최소 100ms 간격)
  if (timestamp - lastAutoAttackRef.current < 100) return;

  // 공격 사거리 계산
  const classConfig = CLASS_CONFIGS[myHero.heroClass];
  const attackRange = classConfig?.range || 80;

  // 가장 가까운 적 찾기
  let nearestEnemy = null;
  let nearestDist = Infinity;

  for (const enemy of gameState.enemies) {
    if (enemy.hp <= 0) continue;

    const dx = enemy.x - myHero.x;
    const dy = enemy.y - myHero.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < nearestDist) {
      nearestDist = dist;
      nearestEnemy = enemy;
    }
  }

  // 사거리 내 적이 있으면 Q 스킬 사용
  if (nearestEnemy && nearestDist <= attackRange) {
    lastAutoAttackRef.current = timestamp;

    // 마우스 위치를 적 위치로 설정
    useRPGCoopStore.getState().setMousePosition(nearestEnemy.x, nearestEnemy.y);

    // Q 스킬 요청
    useRPGCoopStore.getState().useSkill('Q', nearestEnemy.x, nearestEnemy.y);

    // 사운드 재생
    if (myHero.heroClass === 'archer' || myHero.heroClass === 'mage') {
      soundManager.play('attack_ranged');
    } else {
      soundManager.play('attack_melee');
    }
  }
}
