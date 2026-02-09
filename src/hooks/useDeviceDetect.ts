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

function updateViewportMeta(deviceType: DeviceType) {
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;

  if (deviceType === 'phone' || deviceType === 'tablet') {
    meta.setAttribute('content',
      'width=1280, user-scalable=no, viewport-fit=cover');
  } else {
    meta.setAttribute('content',
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
  }
}

export function useDeviceDetect() {
  useEffect(() => {
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
    };

    update();

    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);

    const mql = window.matchMedia('(orientation: portrait)');
    mql.addEventListener('change', update);

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      mql.removeEventListener('change', update);
    };
  }, []);
}
