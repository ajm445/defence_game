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

  if (deviceType === 'phone' || deviceType === 'tablet') {
    const viewportWidth = getTargetViewportWidth();

    if (isFullscreenActive()) {
      const isPortrait = getIsPortrait();
      const physW = isPortrait
        ? Math.min(screen.width, screen.height)
        : Math.max(screen.width, screen.height);

      if (deviceType === 'tablet') {
        // 태블릿(iPad): body 전체화면 + viewport meta initial-scale (CSS zoom 사용 안함)
        // Safari iPad에서 html 전체화면 시 viewport meta 리셋 + CSS zoom은 overflow:hidden과 충돌
        clearCssZoom();
        const scale = Math.round((physW / viewportWidth) * 1000) / 1000;
        meta.setAttribute('content',
          `width=${viewportWidth}, initial-scale=${scale}, minimum-scale=${scale}, maximum-scale=${scale}, user-scalable=no, viewport-fit=cover`);
      } else {
        // 핸드폰: html 전체화면 + CSS zoom (V1.23.7 방식, 모바일 브라우저가 viewport meta 무시)
        meta.setAttribute('content',
          'width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover');
        const zoom = physW / viewportWidth;
        document.documentElement.style.zoom = String(zoom);
        const inversePercent = 100 / zoom;
        document.documentElement.style.width = `${inversePercent}vw`;
        document.documentElement.style.height = `${inversePercent}vh`;
      }
    } else {
      // 일반 모드: viewport meta + initial-scale 고정
      // initial-scale 없으면 일부 브라우저에서 스케일을 잘못 계산하거나 불안정하게 처리
      clearCssZoom();
      if (deviceType === 'tablet') {
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
    }
  } else {
    clearCssZoom();
    meta.setAttribute('content',
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
  }
}

// --- 태블릿 인게임 전체화면 억제 ---
// 태블릿에서 인게임(캔버스) 화면일 때 전체화면을 비활성화하기 위한 플래그
let _tabletGameActive = false;

export function setTabletGameActive(active: boolean) {
  _tabletGameActive = active;
}

export function isTabletGameActive(): boolean {
  return _tabletGameActive;
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

export async function tryEnterFullscreen() {
  if (!isFullscreenSupported() || isFullscreenActive()) return;
  // 태블릿(iPad): body를 전체화면 대상 (html 전체화면 시 Safari가 viewport meta 리셋)
  // 핸드폰/기타: html을 전체화면 대상 (더 안정적)
  const deviceType = getDeviceType();
  const el = deviceType === 'tablet' ? document.body : document.documentElement;
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

export async function tryExitFullscreen() {
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
          // 가로로 전환 → 전체화면 진입 (태블릿 인게임 시 억제)
          if (!_tabletGameActive) {
            tryEnterFullscreen();
          }
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
        // 전체화면 전환 직전의 뷰포트 높이 기록
        const prevHeight = window.innerHeight;

        // 뷰포트 크기가 실제로 변경될 때까지 폴링 (최대 1초)
        // 고정 타임아웃(150ms/500ms)만 사용하면 전체화면 애니메이션이 느린 기기에서
        // window.innerHeight가 아직 갱신되지 않아 캔버스가 스테일 크기로 남을 수 있음
        let retryCount = 0;
        const maxRetries = 10;
        const retryInterval = 100;

        const ensureResize = () => {
          updateViewportMeta(deviceType);
          window.dispatchEvent(new Event('resize'));

          retryCount++;
          // 뷰포트 높이가 변경되었거나 최대 재시도 횟수 도달 시 중단
          if (window.innerHeight !== prevHeight || retryCount >= maxRetries) {
            return;
          }
          setTimeout(ensureResize, retryInterval);
        };

        // 첫 시도: 150ms 후 (대부분의 브라우저에서 충분)
        setTimeout(ensureResize, 150);
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
