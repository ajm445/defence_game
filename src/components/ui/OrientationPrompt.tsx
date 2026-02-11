import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { isTabletGameActive } from '../../hooks/useDeviceDetect';

function isFullscreenSupported(): boolean {
  const isIPhone = /iPhone/.test(navigator.userAgent) && !(window as any).MSStream;
  if (isIPhone) return false;
  return !!(
    document.documentElement.requestFullscreen ||
    (document.documentElement as any).webkitRequestFullscreen
  );
}

export const OrientationPrompt: React.FC = () => {
  const isTouchDevice = useUIStore((s) => s.isTouchDevice);
  const isTablet = useUIStore((s) => s.isTablet);
  const isPortrait = useUIStore((s) => s.isPortrait);
  const isFullscreen = useUIStore((s) => s.isFullscreen);
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  const wasPortraitRef = useRef(true);
  const wasFullscreenRef = useRef(false);

  // Portrait → Landscape 전환 시 자동 전체화면 실패하면 프롬프트 표시
  useEffect(() => {
    if (!isTouchDevice) return;

    if (wasPortraitRef.current && !isPortrait) {
      // 가로 전환 감지 → 잠시 후 전체화면 여부 확인 (태블릿 인게임 시 억제)
      const timer = setTimeout(() => {
        if (!useUIStore.getState().isFullscreen && isFullscreenSupported() && !isTabletGameActive()) {
          setShowFullscreenPrompt(true);
        }
      }, 500);
      wasPortraitRef.current = isPortrait;
      return () => clearTimeout(timer);
    }

    if (isPortrait) {
      setShowFullscreenPrompt(false);
    }
    wasPortraitRef.current = isPortrait;
  }, [isPortrait, isTouchDevice]);

  // 전체화면 진입 시 프롬프트 숨김
  useEffect(() => {
    if (isFullscreen) {
      setShowFullscreenPrompt(false);
    }
  }, [isFullscreen]);

  // 전체화면이 해제되면 (키보드, 시스템 제스처 등) 재진입 프롬프트 표시
  useEffect(() => {
    if (!isTouchDevice || !isFullscreenSupported()) {
      wasFullscreenRef.current = isFullscreen;
      return;
    }

    // 전체화면 → 비전체화면 전환 감지 (가로 모드에서만, 태블릿 인게임 시 억제)
    if (wasFullscreenRef.current && !isFullscreen && !isPortrait && !isTabletGameActive()) {
      const activeEl = document.activeElement;
      const isInputActive = activeEl instanceof HTMLElement &&
        (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');

      if (isInputActive) {
        // 키보드가 열려서 전체화면이 해제된 경우: 입력 완료 후 프롬프트 표시
        const handleBlur = () => {
          setTimeout(() => {
            const state = useUIStore.getState();
            if (!state.isFullscreen && !state.isPortrait) {
              setShowFullscreenPrompt(true);
            }
          }, 500);
        };
        activeEl.addEventListener('blur', handleBlur, { once: true });
        wasFullscreenRef.current = isFullscreen;
        return () => activeEl.removeEventListener('blur', handleBlur);
      } else {
        // 기타 이유로 전체화면 해제: 500ms 후 프롬프트 표시
        const timer = setTimeout(() => {
          const state = useUIStore.getState();
          if (!state.isFullscreen && !state.isPortrait) {
            setShowFullscreenPrompt(true);
          }
        }, 500);
        wasFullscreenRef.current = isFullscreen;
        return () => clearTimeout(timer);
      }
    }

    wasFullscreenRef.current = isFullscreen;
  }, [isFullscreen, isTouchDevice, isPortrait]);

  const handleEnterFullscreen = useCallback(async () => {
    // 태블릿(iPad): body를 전체화면 대상 (html 시 Safari가 viewport meta 리셋)
    // 핸드폰/기타: html을 전체화면 대상 (더 안정적)
    const el = isTablet ? document.body : document.documentElement;
    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if ((el as any).webkitRequestFullscreen) {
        await (el as any).webkitRequestFullscreen();
      }
    } catch {
      // 실패 시 프롬프트 닫기
      setShowFullscreenPrompt(false);
    }
  }, [isTablet]);

  // 세로 모드 회전 안내
  if (isTouchDevice && isPortrait) {
    return (
      <div className="fixed inset-0 z-[9999] bg-dark-900 flex flex-col items-center justify-center gap-6">
        <div className="text-6xl animate-rotate-phone">📱</div>
        <div className="text-white text-xl font-bold text-center px-8">
          가로로 회전해주세요
        </div>
        <div className="text-gray-400 text-sm text-center px-8">
          이 게임은 가로 모드에서 플레이할 수 있습니다
        </div>
      </div>
    );
  }

  // 가로 모드 + 전체화면 미진입 시 탭 프롬프트
  if (showFullscreenPrompt) {
    return (
      <div
        className="fixed inset-0 z-[9999] bg-black/80 flex flex-col items-center justify-center gap-4 cursor-pointer"
        onClick={handleEnterFullscreen}
      >
        <div className="text-5xl">🔲</div>
        <div className="text-white text-lg font-bold text-center px-8">
          화면을 터치하여 전체화면으로 전환
        </div>
        <div className="text-gray-400 text-sm text-center px-8">
          세로로 회전하면 전체화면이 해제됩니다
        </div>
      </div>
    );
  }

  return null;
};
