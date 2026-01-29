import React, { useEffect, memo } from 'react';
import { useRPGStore } from '../../stores/useRPGStore';
import { DamageNumber } from '../../types/rpg';

/**
 * 개별 데미지 숫자 컴포넌트
 * - 위로 떠오르며 페이드아웃
 * - 타입별 색상: damage(흰색), critical(금색), heal(초록색), enemy_damage(빨간색)
 */
const DamageNumberItem: React.FC<{
  item: DamageNumber;
  camera: { x: number; y: number; zoom: number };
  screenWidth: number;
  screenHeight: number;
}> = memo(({ item, camera, screenWidth, screenHeight }) => {
  const removeDamageNumber = useRPGStore((state) => state.removeDamageNumber);

  // 1초 후 자동 제거
  useEffect(() => {
    const timer = setTimeout(() => {
      removeDamageNumber(item.id);
    }, 1000);
    return () => clearTimeout(timer);
  }, [item.id, removeDamageNumber]);

  // 월드 좌표를 화면 좌표로 변환
  const screenX = (item.x - camera.x) * camera.zoom + screenWidth / 2;
  const screenY = (item.y - camera.y) * camera.zoom + screenHeight / 2;

  // 화면 밖이면 렌더링하지 않음
  if (screenX < -100 || screenX > screenWidth + 100 || screenY < -100 || screenY > screenHeight + 100) {
    return null;
  }

  // 타입별 스타일 설정
  const getStyle = (): { color: string; fontSize: string; textShadow: string } => {
    switch (item.type) {
      case 'critical':
        return {
          color: '#FFD700', // 금색/노란색
          fontSize: '1.75rem',
          textShadow: '0 0 8px #FF8C00, 0 0 16px #FF4500, 2px 2px 4px rgba(0,0,0,0.8)',
        };
      case 'heal':
        return {
          color: '#32CD32', // 라임 그린
          fontSize: '1.25rem',
          textShadow: '0 0 6px #228B22, 2px 2px 4px rgba(0,0,0,0.8)',
        };
      case 'enemy_damage':
        return {
          color: '#FF4444', // 빨간색
          fontSize: '1.25rem',
          textShadow: '0 0 6px #CC0000, 2px 2px 4px rgba(0,0,0,0.8)',
        };
      case 'damage':
      default:
        return {
          color: '#FFFFFF', // 흰색
          fontSize: '1.125rem',
          textShadow: '1px 1px 3px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.5)',
        };
    }
  };

  const style = getStyle();
  const prefix = item.type === 'heal' ? '+' : '';

  return (
    <div
      className="absolute pointer-events-none font-bold animate-damage-float select-none"
      style={{
        left: screenX,
        top: screenY,
        color: style.color,
        fontSize: style.fontSize,
        textShadow: style.textShadow,
        transform: 'translate(-50%, -50%)',
        zIndex: 100,
        fontFamily: '"Press Start 2P", monospace, sans-serif',
        letterSpacing: item.type === 'critical' ? '2px' : '0',
      }}
    >
      {prefix}{Math.round(item.amount)}
      {item.type === 'critical' && <span className="text-orange-400">!</span>}
    </div>
  );
});

DamageNumberItem.displayName = 'DamageNumberItem';

/**
 * 플로팅 데미지 숫자 컨테이너 컴포넌트
 * - 화면에 표시되는 모든 데미지 숫자 관리
 */
export const RPGDamageNumbers: React.FC = () => {
  const damageNumbers = useRPGStore((state) => state.damageNumbers);
  const camera = useRPGStore((state) => state.camera);
  const cleanDamageNumbers = useRPGStore((state) => state.cleanDamageNumbers);

  // 주기적으로 오래된 데미지 숫자 정리
  useEffect(() => {
    const interval = setInterval(() => {
      cleanDamageNumbers();
    }, 500);
    return () => clearInterval(interval);
  }, [cleanDamageNumbers]);

  // 화면 크기 가져오기
  const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;

  if (damageNumbers.length === 0) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {damageNumbers.map((item) => (
        <DamageNumberItem
          key={item.id}
          item={item}
          camera={camera}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
        />
      ))}
    </div>
  );
};
