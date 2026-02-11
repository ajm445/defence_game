import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useUIStore } from '../../stores/useUIStore';

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
  const isPortrait = useUIStore((s) => s.isPortrait);
  const isFullscreen = useUIStore((s) => s.isFullscreen);
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  const wasPortraitRef = useRef(true);

  // Portrait → Landscape 전환 시 자동 전체화면 실패하면 프롬프트 표시
  useEffect(() => {
    if (!isTouchDevice) return;

    if (wasPortraitRef.current && !isPortrait) {
      // 가로 전환 감지 → 잠시 후 전체화면 여부 확인
      const timer = setTimeout(() => {
        if (!useUIStore.getState().isFullscreen && isFullscreenSupported()) {
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

  const handleEnterFullscreen = useCallback(async () => {
    const el = document.documentElement;
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
  }, []);

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
