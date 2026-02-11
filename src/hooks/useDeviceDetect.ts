import { useEffect } from 'react';
import { useUIStore } from '../stores/useUIStore';

type DeviceType = 'phone' | 'tablet' | 'desktop';

function detectTouchDevice(): boolean {
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0
  );
}

function getDeviceType(): DeviceType {
  const isTouchDevice = detectTouchDevice();
  if (!isTouchDevice) return 'desktop';

  // screen.width/height는 viewport meta에 영향받지 않는 물리 CSS 픽셀
  const shorterDimension = Math.min(screen.width, screen.height);
  if (shorterDimension <= 500) return 'phone';
  if (shorterDimension <= 900) return 'tablet';
  return 'desktop';
}

function getUIScale(deviceType: DeviceType): number {
  switch (deviceType) {
    case 'phone': return 0.65;
    case 'tablet': return 0.85;
    case 'desktop': return 1.0;
  }
}

function getIsPortrait(): boolean {
  if (screen.orientation) {
    return screen.orientation.type.startsWith('portrait');
  }
  return window.matchMedia('(orientation: portrait)').matches;
}

function getTargetViewportWidth(): number {
  const BASE_WIDTH = 1280;
  const MIN_CSS_HEIGHT = 700;

  const isPortrait = getIsPortrait();
  const physW = isPortrait
    ? Math.min(screen.width, screen.height)
    : Math.max(screen.width, screen.height);
  const physH = isPortrait
    ? Math.max(screen.width, screen.height)
    : Math.min(screen.width, screen.height);

  const minWidthForHeight = Math.ceil(MIN_CSS_HEIGHT * physW / physH);
  return Math.max(BASE_WIDTH, minWidthForHeight);
}

function updateViewportMeta(deviceType: DeviceType) {
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;

  if (deviceType === 'phone' || deviceType === 'tablet') {
    const viewportWidth = getTargetViewportWidth();

    if (isFullscreenActive()) {
      // 전체화면: 모바일 브라우저가 viewport meta를 무시하므로 CSS zoom으로 스케일링
      const isPortrait = getIsPortrait();
      const physW = isPortrait
        ? Math.min(screen.width, screen.height)
        : Math.max(screen.width, screen.height);

      meta.setAttribute('content',
        'width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover');
      document.documentElement.style.zoom = String(physW / viewportWidth);
    } else {
      // 일반 모드: viewport meta로 스케일링
      document.documentElement.style.zoom = '';
      meta.setAttribute('content',
        `width=${viewportWidth}, user-scalable=no, viewport-fit=cover`);
    }
  } else {
    document.documentElement.style.zoom = '';
    meta.setAttribute('content',
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
  }
}

// --- 전체화면 유틸리티 ---

function isFullscreenSupported(): boolean {
  const isIPhone = /iPhone/.test(navigator.userAgent) && !(window as any).MSStream;
  if (isIPhone) return false;

  return !!(
    document.documentElement.requestFullscreen ||
    (document.documentElement as any).webkitRequestFullscreen
  );
}

function isFullscreenActive(): boolean {
  return !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
}

async function tryEnterFullscreen() {
  if (!isFullscreenSupported() || isFullscreenActive()) return;
  const el = document.documentElement;
  try {
    if (el.requestFullscreen) {
      await el.requestFullscreen();
    } else if ((el as any).webkitRequestFullscreen) {
      await (el as any).webkitRequestFullscreen();
    }
  } catch {
    // 전체화면 진입 실패 시 무시 (user gesture 필요할 수 있음)
  }
}

async function tryExitFullscreen() {
  if (!isFullscreenActive()) return;
  try {
    if (document.exitFullscreen) {
      await document.exitFullscreen();
    } else if ((document as any).webkitExitFullscreen) {
      await (document as any).webkitExitFullscreen();
    }
  } catch {
    // 전체화면 해제 실패 시 무시
  }
}

export function useDeviceDetect() {
  useEffect(() => {
    let prevIsPortrait: boolean | null = null;

    const update = () => {
      const deviceType = getDeviceType();
      const isTouchDevice = detectTouchDevice();
      const isPortrait = getIsPortrait();
      const uiScale = getUIScale(deviceType);

      // viewport meta 동적 변경
      updateViewportMeta(deviceType);

      // CSS 변수 반영
      document.documentElement.style.setProperty('--ui-scale', String(uiScale));

      useUIStore.getState().setDeviceInfo({
        isMobile: deviceType === 'phone',
        isTablet: deviceType === 'tablet',
        isTouchDevice,
        isPortrait,
        uiScale,
      });

      // 터치 디바이스에서 방향 변경 시 자동 전체화면
      if (isTouchDevice && prevIsPortrait !== null && prevIsPortrait !== isPortrait) {
        if (!isPortrait) {
          // 가로로 전환 → 전체화면 진입
          tryEnterFullscreen();
        } else {
          // 세로로 전환 → 전체화면 해제
          tryExitFullscreen();
        }
      }
      prevIsPortrait = isPortrait;
    };

    // fullscreenchange 이벤트로 상태 추적 + 스케일링 전환
    const onFullscreenChange = () => {
      useUIStore.getState().setFullscreen(isFullscreenActive());
      const deviceType = getDeviceType();
      // 전체화면 ↔ 일반 모드 전환 시 스케일링 방식 전환
      // (전체화면: CSS zoom, 일반: viewport meta)
      updateViewportMeta(deviceType);
      // 브라우저 전환 완료 후 재적용 (타이밍 보정)
      if (deviceType === 'phone' || deviceType === 'tablet') {
        setTimeout(() => updateViewportMeta(deviceType), 150);
      }
    };

    update();

    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);

    const mql = window.matchMedia('(orientation: portrait)');
    mql.addEventListener('change', update);

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      mql.removeEventListener('change', update);
    };
  }, []);
}
