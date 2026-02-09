import { useEffect, useCallback } from 'react';
import { useUIStore } from '../stores/useUIStore';

function getIsFullscreen(): boolean {
  return !!(
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement
  );
}

function getIsSupported(): boolean {
  // iPhone은 Fullscreen API 미지원
  const isIPhone = /iPhone/.test(navigator.userAgent) && !(window as any).MSStream;
  if (isIPhone) return false;

  return !!(
    document.documentElement.requestFullscreen ||
    (document.documentElement as any).webkitRequestFullscreen
  );
}

async function enterFullscreen() {
  const el = document.documentElement;
  try {
    if (el.requestFullscreen) {
      await el.requestFullscreen();
    } else if ((el as any).webkitRequestFullscreen) {
      await (el as any).webkitRequestFullscreen();
    }

    // Android Chrome: 가로 고정 시도
    try {
      await (screen.orientation as any).lock('landscape');
    } catch {
      // orientation lock 미지원 시 무시
    }
  } catch {
    // fullscreen 진입 실패 시 무시
  }
}

async function exitFullscreen() {
  try {
    if (document.exitFullscreen) {
      await document.exitFullscreen();
    } else if ((document as any).webkitExitFullscreen) {
      await (document as any).webkitExitFullscreen();
    }
  } catch {
    // fullscreen 해제 실패 시 무시
  }
}

export function useFullscreen() {
  const isFullscreen = useUIStore((s) => s.isFullscreen);

  useEffect(() => {
    const onChange = () => {
      useUIStore.getState().setFullscreen(getIsFullscreen());
    };

    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);

    // 초기 상태
    onChange();

    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (getIsFullscreen()) {
      await exitFullscreen();
    } else {
      await enterFullscreen();
    }
  }, []);

  return {
    isFullscreen,
    toggleFullscreen,
    isSupported: getIsSupported(),
  };
}
