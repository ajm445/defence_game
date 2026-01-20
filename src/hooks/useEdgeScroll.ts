import { useEffect, useRef } from 'react';
import { useGameStore } from '../stores/useGameStore';
import { useUIStore } from '../stores/useUIStore';

const EDGE_THRESHOLD = 30; // 가장자리로부터의 거리 (픽셀)
const SCROLL_SPEED = 15; // 스크롤 속도

export const useEdgeScroll = () => {
  const mousePositionRef = useRef({ x: 0, y: 0 });
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    window.addEventListener('mousemove', handleMouseMove);

    const tick = () => {
      const running = useGameStore.getState().running;
      const currentScreen = useUIStore.getState().currentScreen;
      const edgeScrollEnabled = useUIStore.getState().edgeScrollEnabled;

      // 게임이 실행 중이고, 게임 화면이며, 가장자리 스크롤이 활성화되어 있을 때만 스크롤
      if (running && currentScreen === 'game' && edgeScrollEnabled) {
        const { x, y } = mousePositionRef.current;
        const { innerWidth, innerHeight } = window;
        const moveCamera = useGameStore.getState().moveCamera;

        let dx = 0;
        let dy = 0;

        // 좌측 가장자리
        if (x <= EDGE_THRESHOLD) {
          dx = -SCROLL_SPEED;
        }
        // 우측 가장자리
        else if (x >= innerWidth - EDGE_THRESHOLD) {
          dx = SCROLL_SPEED;
        }

        // 상단 가장자리
        if (y <= EDGE_THRESHOLD) {
          dy = -SCROLL_SPEED;
        }
        // 하단 가장자리 (UI 패널 위)
        else if (y >= innerHeight - EDGE_THRESHOLD - 120) { // 120은 UI 패널 높이
          dy = SCROLL_SPEED;
        }

        if (dx !== 0 || dy !== 0) {
          moveCamera(dx, dy);
        }
      }

      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);
};
