import React, { useMemo } from 'react';
import { useHero, useGameTime, useLastDamageTime } from '../../stores/useRPGStore';

/**
 * RPG 화면 효과 컴포넌트
 * - HP 낮을수록 화면 가장자리 비네팅 효과 (빨간색)
 * - HP 30% 이하 시 위험 경고 펄스 효과
 */
export const RPGScreenEffects: React.FC = () => {
  const hero = useHero();
  const gameTime = useGameTime();
  const lastDamageTime = useLastDamageTime();

  // HP 비율 계산
  const hpRatio = useMemo(() => {
    if (!hero || hero.hp <= 0) return 0;
    return hero.hp / hero.maxHp;
  }, [hero?.hp, hero?.maxHp]);

  // 비네팅 강도 계산 (HP 100%: 0, HP 50%: 0.3, HP 30%: 0.6, HP 0%: 1)
  const vignetteIntensity = useMemo(() => {
    if (hpRatio >= 1) return 0;
    if (hpRatio >= 0.5) {
      // HP 50~100%: 0 ~ 0.3
      return (1 - hpRatio) * 0.6;
    }
    if (hpRatio >= 0.3) {
      // HP 30~50%: 0.3 ~ 0.5
      return 0.3 + ((0.5 - hpRatio) / 0.2) * 0.2;
    }
    // HP 0~30%: 0.5 ~ 0.8
    return 0.5 + ((0.3 - hpRatio) / 0.3) * 0.3;
  }, [hpRatio]);

  // 위험 경고 (HP 30% 이하)
  const isDanger = hpRatio > 0 && hpRatio <= 0.3;

  // 펄스 애니메이션 (심장박동처럼)
  const pulseIntensity = useMemo(() => {
    if (!isDanger) return 0;
    // 심장박동 패턴: 빠르게 두 번 뛰고 잠시 쉬는 패턴
    const beatCycle = (gameTime * 1.5) % 1; // 0.67초 주기

    // 첫 번째 박동 (0 ~ 0.15)
    if (beatCycle < 0.15) {
      const t = beatCycle / 0.15;
      return Math.sin(t * Math.PI) * 0.4;
    }
    // 첫 번째 박동 후 잠시 대기 (0.15 ~ 0.25)
    if (beatCycle < 0.25) {
      return 0;
    }
    // 두 번째 박동 (0.25 ~ 0.4)
    if (beatCycle < 0.4) {
      const t = (beatCycle - 0.25) / 0.15;
      return Math.sin(t * Math.PI) * 0.3;
    }
    // 휴식기 (0.4 ~ 1)
    return 0;
  }, [isDanger, gameTime]);

  // 피격 플래시 효과 (0.15초간 빨간 플래시)
  const damageFlashIntensity = useMemo(() => {
    const FLASH_DURATION = 0.15;
    const timeSinceDamage = gameTime - lastDamageTime;
    if (lastDamageTime <= 0 || timeSinceDamage >= FLASH_DURATION) return 0;
    // 빠르게 감소하는 플래시
    return (1 - timeSinceDamage / FLASH_DURATION) * 0.25;
  }, [gameTime, lastDamageTime]);

  // 아무 효과도 없으면 렌더링하지 않음
  if (vignetteIntensity === 0 && pulseIntensity === 0 && damageFlashIntensity === 0) {
    return null;
  }

  // 비네팅 + 펄스 강도 합산 (피격 플래시 중일 때는 비네팅 효과 약화)
  const vignetteReduction = damageFlashIntensity > 0 ? 0.5 : 1;
  const totalVignetteIntensity = Math.min(0.9, (vignetteIntensity + pulseIntensity) * vignetteReduction);

  return (
    <>
      {/* 비네팅 효과 (화면 가장자리 빨간색) */}
      {totalVignetteIntensity > 0 && (
        <div
          className="absolute inset-0 pointer-events-none z-40"
          style={{
            background: `radial-gradient(
              ellipse at center,
              transparent 40%,
              rgba(180, 0, 0, ${totalVignetteIntensity * 0.3}) 70%,
              rgba(120, 0, 0, ${totalVignetteIntensity * 0.6}) 85%,
              rgba(80, 0, 0, ${totalVignetteIntensity * 0.8}) 100%
            )`,
          }}
        />
      )}

      {/* 피격 플래시 효과 (테두리만 깜빡임 - 비네팅 스타일) */}
      {damageFlashIntensity > 0 && (
        <div
          className="absolute inset-0 pointer-events-none z-41"
          style={{
            background: `radial-gradient(
              ellipse at center,
              transparent 50%,
              rgba(255, 0, 0, ${damageFlashIntensity * 0.4}) 70%,
              rgba(255, 0, 0, ${damageFlashIntensity * 0.8}) 85%,
              rgba(255, 0, 0, ${damageFlashIntensity}) 100%
            )`,
          }}
        />
      )}

      {/* 위험 경고 테두리 펄스 (피격 플래시 중에는 표시 안함) */}
      {isDanger && pulseIntensity > 0 && damageFlashIntensity === 0 && (
        <div
          className="absolute inset-0 pointer-events-none z-40"
          style={{
            boxShadow: `inset 0 0 ${60 + pulseIntensity * 40}px ${20 + pulseIntensity * 20}px rgba(255, 0, 0, ${pulseIntensity * 0.5})`,
          }}
        />
      )}
    </>
  );
};
