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

function clearCssZoom() {
  const rootEl = document.getElementById('root');
  if (rootEl) {
    rootEl.style.zoom = '';
    rootEl.style.width = '';
    rootEl.style.height = '';
  }
  document.documentElement.style.zoom = '';
  document.documentElement.style.width = '';
  document.documentElement.style.height = '';
}

function updateViewportMeta(deviceType: DeviceType) {
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;

  // CSS zoom은 사용하지 않음: Safari에서 overflow:hidden + zoom 조합 시 하단 클리핑 발생
  // viewport meta 스케일링만 사용 (vh/vw 단위를 올바르게 스케일링)
  clearCssZoom();

  if (deviceType === 'phone' || deviceType === 'tablet') {
    const viewportWidth = getTargetViewportWidth();

    if (isFullscreenActive()) {
      // 전체화면: initial-scale 명시하여 Safari가 viewport 리셋해도 스케일 유지
      const isPortrait = getIsPortrait();
      const physW = isPortrait
        ? Math.min(screen.width, screen.height)
        : Math.max(screen.width, screen.height);
      const scale = Math.round((physW / viewportWidth) * 1000) / 1000;
      meta.setAttribute('content',
        `width=${viewportWidth}, initial-scale=${scale}, minimum-scale=${scale}, maximum-scale=${scale}, user-scalable=no, viewport-fit=cover`);
    } else {
      meta.setAttribute('content',
        `width=${viewportWidth}, user-scalable=no, viewport-fit=cover`);
    }
  } else {
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
  // body를 전체화면 대상으로 사용: html을 대상으로 하면 Safari가 viewport meta를 리셋
  const el = document.body;
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

    // fullscreenchange 이벤트로 상태 추적 + viewport meta 재적용
    const onFullscreenChange = () => {
      useUIStore.getState().setFullscreen(isFullscreenActive());
      const deviceType = getDeviceType();
      // 전체화면 전환 시 viewport meta 재적용 (브라우저가 리셋할 수 있음)
      updateViewportMeta(deviceType);
      if (deviceType === 'phone' || deviceType === 'tablet') {
        // 브라우저 전환 완료 후 재적용 + 캔버스 리사이즈 트리거
        setTimeout(() => {
          updateViewportMeta(deviceType);
          window.dispatchEvent(new Event('resize'));
        }, 150);
        // 추가 재적용 (일부 브라우저에서 전체화면 전환이 느릴 수 있음)
        setTimeout(() => {
          updateViewportMeta(deviceType);
          window.dispatchEvent(new Event('resize'));
        }, 500);
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
