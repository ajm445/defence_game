import { HeroUnit, RPGEnemy, SkillEffect, HeroClass, AdvancedHeroClass } from '../types/rpg';
import { Camera, UnitType } from '../types';
import { drawEmoji } from '../utils/canvasEmoji';
import { drawUnitImage } from '../utils/unitImages';
import { drawHeroImage } from '../utils/heroImages';
import { drawMotionSprite } from '../utils/spriteMotion';
import { RPG_CONFIG, ADVANCED_CLASS_CONFIGS } from '../constants/rpgConfig';
import { useRPGStore } from '../stores/useRPGStore';

// 직업별 이미지 매핑 및 색상 설정
const CLASS_VISUALS: Record<HeroClass, { unitType: UnitType; emoji: string; color: string; glowColor: string }> = {
  warrior: { unitType: 'melee', emoji: '⚔️', color: '#ff6b35', glowColor: '#ff6b35' },
  archer: { unitType: 'ranged', emoji: '🏹', color: '#22c55e', glowColor: '#22c55e' },
  knight: { unitType: 'knight', emoji: '🛡️', color: '#3b82f6', glowColor: '#3b82f6' },
  mage: { unitType: 'mage', emoji: '🔮', color: '#a855f7', glowColor: '#a855f7' },
};

// 전직 직업별 기본 공격 이펙트 색상 설정
interface AdvancedClassColors {
  primary: string;      // 주 색상
  secondary: string;    // 보조 색상
  glow: string;         // 글로우 색상
  impact: string;       // 피격 이펙트 색상
}

const ADVANCED_CLASS_ATTACK_COLORS: Record<AdvancedHeroClass, AdvancedClassColors> = {
  // 전사 계열
  berserker: {
    primary: '#ff3300',     // 붉은색 (광폭)
    secondary: '#ff6600',   // 주황색
    glow: '#ff4400',
    impact: '#ff5500',
  },
  guardian: {
    primary: '#00aaff',     // 파란색 (수호)
    secondary: '#66ccff',   // 하늘색
    glow: '#0088ff',
    impact: '#44bbff',
  },
  // 궁수 계열 (화살 색상)
  sniper: {
    primary: '#9933ff',     // 보라색 (정밀)
    secondary: '#cc66ff',   // 자주색
    glow: '#aa44ff',
    impact: '#bb55ff',
  },
  ranger: {
    primary: '#ff9922',     // 앰버 (추적자 테마)
    secondary: '#ffcc55',   // 골든
    glow: '#ffaa33',
    impact: '#ffbb44',
  },
  // 기사 계열
  paladin: {
    primary: '#ffcc00',     // 금색 (신성)
    secondary: '#ffee66',   // 노란색
    glow: '#ffdd33',
    impact: '#ffdd44',
  },
  darkKnight: {
    primary: '#9900cc',     // 보라색 (암흑)
    secondary: '#330066',   // 검은 보라색
    glow: '#6600aa',
    impact: '#7711bb',
  },
  // 마법사 계열
  archmage: {
    primary: '#ff4400',     // 빨간색 (불꽃)
    secondary: '#ff8800',   // 주황색
    glow: '#ff5500',
    impact: '#ff6600',
  },
  healer: {
    primary: '#00ff88',     // 초록색 (치유)
    secondary: '#66ffbb',   // 민트색
    glow: '#33ffaa',
    impact: '#44ffaa',
  },
};

// 전직 직업에 따른 색상 가져오기 (전직이 없으면 기본 직업 색상 사용)
function getAttackColors(heroClass?: HeroClass, advancedClass?: AdvancedHeroClass): AdvancedClassColors {
  if (advancedClass && ADVANCED_CLASS_ATTACK_COLORS[advancedClass]) {
    return ADVANCED_CLASS_ATTACK_COLORS[advancedClass];
  }
  // 기본 직업 색상 반환
  const defaultColors: Record<HeroClass, AdvancedClassColors> = {
    warrior: { primary: '#ff6b35', secondary: '#ffaa00', glow: '#ff6b35', impact: '#ff8855' },
    archer: { primary: '#22c55e', secondary: '#4ade80', glow: '#22c55e', impact: '#33dd6e' },
    knight: { primary: '#3b82f6', secondary: '#60a5fa', glow: '#3b82f6', impact: '#5599ff' },
    mage: { primary: '#a855f7', secondary: '#c084fc', glow: '#a855f7', impact: '#bb66ff' },
  };
  return defaultColors[heroClass || 'warrior'];
}

/**
 * 영웅 유닛 렌더링
 * @param isOtherPlayer - 다른 플레이어의 영웅인지 (멀티플레이어용)
 * @param lastDamageTime - 마지막 피격 시간 (빨간색 깜빡임 효과용)
 */
export function drawHero(
  ctx: CanvasRenderingContext2D,
  hero: HeroUnit,
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number,
  gameTime: number = 0,
  isOtherPlayer: boolean = false,
  nickname?: string,
  lastDamageTime: number = 0
) {
  const screenX = hero.x - camera.x;
  const screenY = hero.y - camera.y;

  // 화면 밖이면 스킵
  if (
    screenX < -50 ||
    screenX > canvasWidth + 50 ||
    screenY < -50 ||
    screenY > canvasHeight + 50
  ) {
    return;
  }

  // 사망 상태 체크 및 렌더링
  if (hero.hp <= 0 && hero.deathTime !== undefined) {
    const timeSinceDeath = gameTime - hero.deathTime;
    const reviveTime = RPG_CONFIG.REVIVE.BASE_TIME;
    const remainingTime = Math.max(0, reviveTime - timeSinceDeath);

    ctx.save();

    // 사망 위치에 반투명 유령 효과
    ctx.globalAlpha = 0.4;

    // 회색톤 유령
    ctx.fillStyle = 'rgba(100, 100, 100, 0.6)';
    ctx.beginPath();
    ctx.arc(screenX, screenY, 20, 0, Math.PI * 2);
    ctx.fill();

    // 십자가 아이콘
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(screenX, screenY - 10);
    ctx.lineTo(screenX, screenY + 10);
    ctx.moveTo(screenX - 8, screenY);
    ctx.lineTo(screenX + 8, screenY);
    ctx.stroke();

    ctx.globalAlpha = 1;

    // 부활 타이머 표시
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(screenX - 30, screenY - 55, 60, 24, 5);
    ctx.fill();

    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`💀 ${remainingTime.toFixed(1)}s`, screenX, screenY - 43);

    // 닉네임 표시 (사망 상태에서도)
    if (nickname) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      const textWidth = ctx.measureText(nickname).width;
      ctx.beginPath();
      ctx.roundRect(screenX - textWidth / 2 - 4, screenY - 75, textWidth + 8, 14, 3);
      ctx.fill();

      ctx.fillStyle = '#9ca3af';
      ctx.font = 'bold 11px Arial';
      ctx.fillText(nickname, screenX, screenY - 68);
    }

    ctx.restore();
    return; // 사망 상태에서는 일반 렌더링 스킵
  }

  // 직업별 비주얼 가져오기
  const classVisual = CLASS_VISUALS[hero.heroClass] || CLASS_VISUALS.warrior;

  // 버프 상태 확인
  const hasBerserker = hero.buffs?.some(b => b.type === 'berserker' && b.duration > 0);
  const hasIronwall = hero.buffs?.some(b => b.type === 'ironwall' && b.duration > 0);
  const hasInvincible = hero.buffs?.some(b => b.type === 'invincible' && b.duration > 0);
  const hasSwiftness = hero.buffs?.some(b => b.type === 'swiftness' && b.duration > 0);

  // 피격 시 빨간색 깜빡임 효과 (0.2초간)
  const DAMAGE_BLINK_DURATION = 0.2;
  const timeSinceDamage = gameTime - lastDamageTime;
  const isDamageBlinking = lastDamageTime > 0 && timeSinceDamage < DAMAGE_BLINK_DURATION && !isOtherPlayer;

  ctx.save();

  // 버프 이펙트 (레인저 화살 폭풍) - 발 아래에서 감싸 올라가는 금색 회오리
  const isRangerStorm = hasBerserker && hero.advancedClass === 'ranger';
  if (isRangerStorm) {
    const time = gameTime * 2.5;
    const baseY = screenY + 20; // 발 위치 (캐릭터 하단)

    // 발밑 주황 글로우
    ctx.globalAlpha = 0.25 + Math.sin(time * 1.5) * 0.08;
    const groundGlow = ctx.createRadialGradient(screenX, baseY, 0, screenX, baseY, 35);
    groundGlow.addColorStop(0, 'rgba(255, 170, 50, 0.4)');
    groundGlow.addColorStop(0.5, 'rgba(255, 120, 0, 0.15)');
    groundGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = groundGlow;
    ctx.beginPath();
    ctx.ellipse(screenX, baseY, 35, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // 감싸 올라가는 나선형 회오리 2줄기 (발~몸통까지)
    const totalHeight = 30; // 발밑에서 몸통까지만
    for (let v = 0; v < 2; v++) {
      const vortexOffset = v * Math.PI;
      const segments = 16;

      // 회오리 라인 (두꺼운 외곽)
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#ff9922';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let s = 0; s <= segments; s++) {
        const t = s / segments;
        const angle = vortexOffset + time * 2.5 + t * Math.PI * 2.5;
        const radius = 22 * (1 - t * 0.3); // 위로 갈수록 좁아짐
        const px = screenX + Math.cos(angle) * radius;
        const py = baseY - t * totalHeight;
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // 회오리 라인 (밝은 내부)
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = '#ffcc44';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let s = 0; s <= segments; s++) {
        const t = s / segments;
        const angle = vortexOffset + time * 2.5 + t * Math.PI * 2.5;
        const radius = 20 * (1 - t * 0.3);
        const px = screenX + Math.cos(angle) * radius;
        const py = baseY - t * totalHeight;
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // 회오리를 따라 올라가는 불꽃 파티클 (발~몸통)
    for (let i = 0; i < 8; i++) {
      const seed = i * 1.47;
      const particleTime = (time * 1.8 + seed) % 2.0;
      const progress = particleTime / 2.0;
      const angle = seed * 2.5 + time * 2.5 + progress * Math.PI * 2.5;
      const radius = 20 * (1 - progress * 0.3);
      const px = screenX + Math.cos(angle) * radius;
      const py = baseY - progress * totalHeight;
      const alpha = (1 - progress) * 0.8;
      const size = 2.5 * (1 - progress * 0.3);

      if (alpha > 0.1) {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = i % 3 === 0 ? '#ffdd55' : (i % 3 === 1 ? '#ffaa22' : '#ff8800');
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();

        // 파티클 글로우
        ctx.globalAlpha = alpha * 0.3;
        ctx.beginPath();
        ctx.arc(px, py, size * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  // 버프 이펙트 (광전사) - 불타오르는 불꽃 효과
  // tier2: 시안 불꽃, tier1: 붉은 불꽃
  if (hasBerserker && !isRangerStorm) {
    const time = gameTime * 3; // 애니메이션 속도
    const isBerserkerT2 = hero.tier === 2;

    // 베이스 글로우 (열기)
    ctx.shadowColor = isBerserkerT2 ? '#00aaff' : '#ff4400';
    ctx.shadowBlur = 25;

    const heatGradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, 45);
    heatGradient.addColorStop(0, isBerserkerT2 ? 'rgba(0, 180, 255, 0.35)' : 'rgba(255, 80, 0, 0.35)');
    heatGradient.addColorStop(0.6, isBerserkerT2 ? 'rgba(0, 120, 200, 0.15)' : 'rgba(255, 40, 0, 0.15)');
    heatGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = heatGradient;
    ctx.beginPath();
    ctx.arc(screenX, screenY, 45, 0, Math.PI * 2);
    ctx.fill();

    // 상승하는 불꽃들 (더 많고 자연스럽게)
    const flameCount = 16;
    for (let i = 0; i < flameCount; i++) {
      // 각 불꽃마다 다른 속도와 시작점
      const seed = i * 1.37;
      const flameTime = (time * (0.8 + (i % 3) * 0.2) + seed) % 1.5;
      const flameProgress = flameTime / 1.5;

      // 캐릭터 주변 원형 배치에서 시작
      const baseAngle = (i / flameCount) * Math.PI * 2;
      const baseRadius = 28 + Math.sin(seed * 5) * 8;

      // 시작 위치
      const startX = screenX + Math.cos(baseAngle) * baseRadius;
      const startY = screenY + Math.sin(baseAngle) * (baseRadius * 0.3); // 약간 납작하게

      // 불꽃이 위로 올라가면서 약간 흔들림
      const swayAmount = Math.sin(time * 3 + seed * 2) * 8 * (1 - flameProgress);
      const riseHeight = 60 * flameProgress;

      const flameX = startX + swayAmount;
      const flameY = startY - riseHeight;

      // 불꽃 크기 (아래에서 크고 위에서 작아짐)
      const baseSize = 12 * (1 - flameProgress * 0.7);
      const flameWidth = baseSize * (0.6 + Math.sin(time * 5 + seed) * 0.2);
      const flameHeight = baseSize * (1.5 + Math.sin(time * 4 + seed * 2) * 0.3);

      // 불꽃 색상 (아래: 노랑, 위: 빨강/주황)
      const colorProgress = flameProgress;
      const alpha = (1 - flameProgress) * 0.85;

      if (alpha > 0.05) {
        ctx.globalAlpha = alpha;

        // 외곽 불꽃 (빨강/주황)
        const outerGradient = ctx.createRadialGradient(
          flameX, flameY + flameHeight * 0.3,
          0,
          flameX, flameY - flameHeight * 0.2,
          flameHeight
        );
        outerGradient.addColorStop(0, isBerserkerT2
          ? `rgba(0, ${220 - colorProgress * 80}, 255, 0.9)`
          : `rgba(255, ${180 - colorProgress * 100}, 0, 0.9)`);
        outerGradient.addColorStop(0.4, isBerserkerT2
          ? `rgba(0, ${160 - colorProgress * 60}, 220, 0.6)`
          : `rgba(255, ${100 - colorProgress * 50}, 0, 0.6)`);
        outerGradient.addColorStop(1, 'transparent');

        ctx.fillStyle = outerGradient;
        ctx.beginPath();
        // 불꽃 모양 (위가 뾰족한 타원)
        ctx.ellipse(flameX, flameY, flameWidth, flameHeight, 0, 0, Math.PI * 2);
        ctx.fill();

        // 내부 밝은 코어 (노랑)
        if (flameProgress < 0.6) {
          const coreAlpha = (1 - flameProgress / 0.6) * 0.7;
          ctx.globalAlpha = coreAlpha;
          const coreGradient = ctx.createRadialGradient(
            flameX, flameY + flameHeight * 0.2,
            0,
            flameX, flameY,
            flameHeight * 0.5
          );
          coreGradient.addColorStop(0, isBerserkerT2 ? 'rgba(200, 255, 255, 0.9)' : 'rgba(255, 255, 200, 0.9)');
          coreGradient.addColorStop(0.5, isBerserkerT2 ? 'rgba(50, 200, 255, 0.5)' : 'rgba(255, 200, 50, 0.5)');
          coreGradient.addColorStop(1, 'transparent');

          ctx.fillStyle = coreGradient;
          ctx.beginPath();
          ctx.ellipse(flameX, flameY + flameHeight * 0.15, flameWidth * 0.5, flameHeight * 0.6, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // 작은 불똥 파티클 (위로 튀어오르는)
    for (let i = 0; i < 10; i++) {
      const sparkSeed = i * 2.71;
      const sparkTime = (time * 2 + sparkSeed) % 1.2;
      const sparkProgress = sparkTime / 1.2;

      const sparkAngle = (sparkSeed * 3) % (Math.PI * 2);
      const sparkRadius = 20 + (sparkSeed % 15);

      const sparkStartX = screenX + Math.cos(sparkAngle) * sparkRadius;
      const sparkStartY = screenY;

      // 불똥이 위로 튀어오르면서 옆으로도 약간 이동
      const sparkX = sparkStartX + Math.sin(sparkSeed) * 15 * sparkProgress;
      const sparkY = sparkStartY - 70 * sparkProgress + 20 * sparkProgress * sparkProgress; // 포물선

      const sparkAlpha = (1 - sparkProgress) * 0.9;
      const sparkSize = 3 * (1 - sparkProgress * 0.5);

      if (sparkAlpha > 0.1) {
        ctx.globalAlpha = sparkAlpha;
        ctx.fillStyle = isBerserkerT2
          ? (i % 3 === 0 ? '#80ffff' : (i % 3 === 1 ? '#00ccff' : '#0088dd'))
          : (i % 3 === 0 ? '#ffff80' : (i % 3 === 1 ? '#ffaa00' : '#ff6600'));
        ctx.beginPath();
        ctx.arc(sparkX, sparkY, sparkSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1;
  }

  // 돌진 후 무적 이펙트 - 황금빛 잔상
  if (hasInvincible) {
    const time = gameTime * 8;
    const invincibleAlpha = 0.3 + Math.sin(time) * 0.15;

    // 황금색 보호막
    ctx.strokeStyle = `rgba(255, 215, 0, ${invincibleAlpha + 0.3})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.arc(screenX, screenY, 35 + Math.sin(time * 2) * 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 내부 글로우
    const invincibleGradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, 40);
    invincibleGradient.addColorStop(0, `rgba(255, 215, 0, ${invincibleAlpha})`);
    invincibleGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = invincibleGradient;
    ctx.beginPath();
    ctx.arc(screenX, screenY, 40, 0, Math.PI * 2);
    ctx.fill();
  }

  // 버프 이펙트 (철벽 방어)
  if (hasIronwall) {
    ctx.shadowColor = '#4a90d9';
    ctx.shadowBlur = 25;

    // 파란 방어막
    ctx.strokeStyle = '#4a90d980';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(screenX, screenY, 35, 0, Math.PI * 2);
    ctx.stroke();

    // 내부 글로우
    const ironwallGradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, 35);
    ironwallGradient.addColorStop(0, '#4a90d930');
    ironwallGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = ironwallGradient;
    ctx.beginPath();
    ctx.arc(screenX, screenY, 35, 0, Math.PI * 2);
    ctx.fill();
  }

  // 버프 이펙트 (신속 - 저격수 W)
  if (hasSwiftness) {
    const time = gameTime * 4;
    const particleCount = 6;

    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2 + time;
      const orbitRadius = 22 + Math.sin(time * 2 + i) * 5;
      const px = screenX + Math.cos(angle) * orbitRadius;
      const py = screenY + Math.sin(angle) * orbitRadius;
      const particleSize = 2.5 + Math.sin(time * 3 + i * 1.5) * 1;
      const alpha = 0.5 + Math.sin(time * 2.5 + i) * 0.25;

      // 파란색 파티클
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#44ccff';
      ctx.beginPath();
      ctx.arc(px, py, particleSize, 0, Math.PI * 2);
      ctx.fill();

      // 파티클 글로우
      ctx.globalAlpha = alpha * 0.4;
      ctx.fillStyle = '#88ddff';
      ctx.beginPath();
      ctx.arc(px, py, particleSize * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // 캐릭터 주변 은은한 시안 글로우
    ctx.globalAlpha = 0.15 + Math.sin(time * 1.5) * 0.05;
    const swiftnessGlow = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, 30);
    swiftnessGlow.addColorStop(0, '#44ccff');
    swiftnessGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = swiftnessGlow;
    ctx.beginPath();
    ctx.arc(screenX, screenY, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // 힐러 오로라 이펙트 (힐러 전직 전용)
  if (hero.advancedClass === 'healer') {
    const healerConfig = ADVANCED_CLASS_CONFIGS.healer;
    const healAura = healerConfig.specialEffects.healAura;
    if (healAura) {
      const auraRadius = healAura.radius;
      const time = gameTime * 2;

      // 오로라 베이스 - 녹색 그라데이션 원
      ctx.globalAlpha = 0.25;
      const auraGradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, auraRadius);
      auraGradient.addColorStop(0, 'rgba(34, 197, 94, 0.4)');
      auraGradient.addColorStop(0.5, 'rgba(74, 222, 128, 0.2)');
      auraGradient.addColorStop(0.8, 'rgba(134, 239, 172, 0.1)');
      auraGradient.addColorStop(1, 'transparent');
      ctx.fillStyle = auraGradient;
      ctx.beginPath();
      ctx.arc(screenX, screenY, auraRadius, 0, Math.PI * 2);
      ctx.fill();

      // 펄스 효과 - 확장되는 원형 파동 (3개)
      for (let i = 0; i < 3; i++) {
        const pulsePhase = (time + i * 0.33) % 1;
        const pulseRadius = auraRadius * (0.3 + pulsePhase * 0.7);
        const pulseAlpha = (1 - pulsePhase) * 0.35;

        ctx.globalAlpha = pulseAlpha;
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(screenX, screenY, pulseRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 외곽 테두리 (점선)
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(screenX, screenY, auraRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // 떠다니는 힐 파티클 (+)
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#86efac';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + time * 0.5;
        const dist = auraRadius * 0.6 + Math.sin(time * 2 + i) * 15;
        const particleX = screenX + Math.cos(angle) * dist;
        const particleY = screenY + Math.sin(angle) * dist + Math.sin(time * 3 + i * 0.5) * 10;
        ctx.fillText('+', particleX, particleY);
      }

      ctx.globalAlpha = 1;
    }
  }

  // 다른 플레이어 표시 (팀원 구분용 외곽 링)
  if (isOtherPlayer) {
    // 시안색 팀원 표시 링
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 3]);
    ctx.beginPath();
    ctx.arc(screenX, screenY, 42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  // 영웅 글로우 효과 (직업별 색상, 다른 플레이어는 시안색 글로우 추가)
  const baseGlowColor = hasBerserker ? (hero.tier === 2 ? '#00ccff' : '#ff0000') : (hasIronwall ? '#4a90d9' : classVisual.glowColor);
  const glowColor = isOtherPlayer ? '#00d4ff' : baseGlowColor;
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = isOtherPlayer ? 25 : 20;

  // 타원형 그림자 (캐릭터 발 아래 접지감 표현)
  const shadowColor = isOtherPlayer ? '#00d4ff' : classVisual.color;
  ctx.save();
  ctx.translate(screenX, screenY + 18);
  ctx.scale(1, 0.45);
  const shadowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 28);
  shadowGradient.addColorStop(0, shadowColor + '50');
  shadowGradient.addColorStop(0.6, shadowColor + '20');
  shadowGradient.addColorStop(1, 'transparent');
  ctx.fillStyle = shadowGradient;
  ctx.beginPath();
  ctx.arc(0, 0, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();

  // 영웅 아이콘 (모션 스프라이트 → 정적 이미지 → 이모지 폴백)
  // 원본 이미지가 왼쪽을 바라보므로, 오른쪽을 바라볼 때 flip
  const flipHero = hero.facingRight;
  let imageDrawn = false;

  // 렌더 크기 결정
  const renderW = hero.advancedClass ? 40 : 30;
  const renderH = hero.advancedClass ? 50 : 40;

  // 1. 모션 스프라이트 시도
  try {
    // 스킬 쿨다운 추출 (공격/스킬 모션 감지용)
    let skillCooldowns: { Q: number; W: number; E: number } | undefined;
    if (Array.isArray(hero.skills) && hero.skills.length >= 3) {
      skillCooldowns = {
        Q: hero.skills[0]?.currentCooldown ?? 0,
        W: hero.skills[1]?.currentCooldown ?? 0,
        E: hero.skills[2]?.currentCooldown ?? 0,
      };
    }

    // 공격 대상 방향 flip (기본공격 모션 중 적 방향을 바라보도록)
    let attackFlip: boolean | undefined;
    if (hero.attackTarget) {
      const { enemies } = useRPGStore.getState();
      const target = enemies.find(e => e.id === hero.attackTarget);
      if (target) {
        attackFlip = target.x > hero.x;
      }
    }
    // attackTarget이 없으면 (자동 공격) basicAttackEffects에서 대상 위치 추출
    if (attackFlip == null) {
      const heroId = hero.id || '';
      const { basicAttackEffects } = useRPGStore.getState();
      // 자기 영웅의 최근 공격 이펙트 찾기 (id에 heroId 포함)
      for (let i = basicAttackEffects.length - 1; i >= 0; i--) {
        const eff = basicAttackEffects[i];
        if (eff.id.endsWith(heroId)) {
          attackFlip = eff.x > hero.x;
          break;
        }
      }
    }

    // 캐스팅 중 타겟 방향 flip (저격수 E 등 - snipe 이펙트의 타겟 위치 사용)
    let castingFlip: boolean | undefined;
    if (hero.castingUntil && gameTime < hero.castingUntil) {
      const heroId = hero.id || '';
      const { activeSkillEffects } = useRPGStore.getState();
      for (let i = activeSkillEffects.length - 1; i >= 0; i--) {
        const eff = activeSkillEffects[i];
        if (eff.heroId === heroId && eff.targetPosition) {
          castingFlip = eff.targetPosition.x > hero.x;
          break;
        }
      }
    }

    imageDrawn = drawMotionSprite(
      ctx,
      hero.id || `hero_${hero.heroClass}`,
      hero.heroClass,
      hero.advancedClass as AdvancedHeroClass | undefined,
      hero.tier,
      hero.state,
      hero.dashState,
      hero.castingUntil,
      hero.darkBladeActive,
      skillCooldowns,
      gameTime,
      screenX,
      screenY,
      renderW,
      renderH,
      flipHero,
      attackFlip,
      hero.config?.attackSpeed,
      castingFlip
    );
  } catch {
    imageDrawn = false;
  }

  // 2. 모션 스프라이트 없으면 정적 이미지 폴백
  if (!imageDrawn) {
    if (hero.advancedClass) {
      imageDrawn = drawHeroImage(
        ctx,
        hero.heroClass,
        hero.advancedClass as AdvancedHeroClass,
        hero.tier,
        screenX,
        screenY,
        renderW,
        renderH,
        flipHero
      );

      if (!imageDrawn) {
        imageDrawn = drawUnitImage(ctx, classVisual.unitType, screenX, screenY, 30, flipHero, 40);
      }
    } else {
      imageDrawn = drawUnitImage(ctx, classVisual.unitType, screenX, screenY, 30, flipHero, 40);
    }
  }

  // 3. 이모지 폴백
  if (!imageDrawn) {
    const emoji = hero.advancedClass
      ? ADVANCED_CLASS_CONFIGS[hero.advancedClass as AdvancedHeroClass]?.emoji || classVisual.emoji
      : classVisual.emoji;
    drawEmoji(ctx, emoji, screenX, screenY, 28);
  }

  // 피격 시 빨간색 깜빡임 효과 (글로우 + 투명도 변화)
  if (isDamageBlinking) {
    ctx.save();
    const blinkPhase = Math.floor(timeSinceDamage / 0.05) % 2;
    if (blinkPhase === 0) {
      // 빨간색 글로우
      ctx.shadowColor = '#ff3333';
      ctx.shadowBlur = 25;
      const dmgGradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, 35);
      dmgGradient.addColorStop(0, 'rgba(255, 50, 50, 0.4)');
      dmgGradient.addColorStop(0.6, 'rgba(255, 50, 50, 0.15)');
      dmgGradient.addColorStop(1, 'transparent');
      ctx.fillStyle = dmgGradient;
      ctx.beginPath();
      ctx.arc(screenX, screenY, 35, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 닉네임 표시
  if (nickname) {
    ctx.fillStyle = isOtherPlayer ? '#60a5fa' : '#fbbf24';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 텍스트 배경 (가독성 향상)
    const textWidth = ctx.measureText(nickname).width;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.roundRect(screenX - textWidth / 2 - 4, screenY - 46, textWidth + 8, 14, 3);
    ctx.fill();

    ctx.fillStyle = isOtherPlayer ? '#60a5fa' : '#fbbf24';
    ctx.fillText(nickname, screenX, screenY - 39);
  }

  // 체력바 배경
  const hpBarWidth = 50;
  const hpBarHeight = 6;
  const hpPercent = hero.hp / hero.maxHp;

  ctx.fillStyle = '#1a1a25';
  ctx.beginPath();
  ctx.roundRect(screenX - hpBarWidth / 2, screenY - 30, hpBarWidth, hpBarHeight, 3);
  ctx.fill();

  // 체력바
  const hpColor = hpPercent > 0.5 ? '#10b981' : hpPercent > 0.25 ? '#f59e0b' : '#ef4444';
  ctx.fillStyle = hpColor;
  ctx.beginPath();
  ctx.roundRect(
    screenX - hpBarWidth / 2 + 1,
    screenY - 29,
    (hpBarWidth - 2) * hpPercent,
    hpBarHeight - 2,
    2
  );
  ctx.fill();

  // 이동 중일 때 이동 대상 표시
  if (hero.targetPosition) {
    const targetX = hero.targetPosition.x - camera.x;
    const targetY = hero.targetPosition.y - camera.y;

    // 대상 마커
    ctx.strokeStyle = '#ffd70080';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(screenX, screenY);
    ctx.lineTo(targetX, targetY);
    ctx.stroke();
    ctx.setLineDash([]);

    // 대상 점
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(targetX, targetY, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // 상태 인디케이터
  if (hero.state === 'attacking') {
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(screenX + 25, screenY + 5, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (hero.state === 'moving') {
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(screenX + 25, screenY + 5, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // 다른 플레이어 팀원 표시 (이름 또는 "ALLY" 표시)
  if (isOtherPlayer) {
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 배경 박스
    const labelText = 'ALLY';
    const textWidth = ctx.measureText(labelText).width;
    const labelX = screenX;
    const labelY = screenY + 45;

    ctx.fillStyle = 'rgba(0, 212, 255, 0.8)';
    ctx.beginPath();
    ctx.roundRect(labelX - textWidth / 2 - 4, labelY - 7, textWidth + 8, 14, 3);
    ctx.fill();

    // 텍스트
    ctx.fillStyle = '#ffffff';
    ctx.fillText(labelText, labelX, labelY);
  }
}

/**
 * RPG 적 유닛 렌더링
 */
// 적 유닛 타입 → 영웅 클래스 매핑 (모션 스프라이트 공유)
const ENEMY_TO_HERO_CLASS: Record<string, HeroClass> = {
  melee: 'warrior',
  ranged: 'archer',
  knight: 'knight',
  mage: 'mage',
};

export function drawRPGEnemy(
  ctx: CanvasRenderingContext2D,
  enemy: RPGEnemy,
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number,
  isTarget: boolean = false,
  heroPosition?: { x: number; y: number },
  gameTime?: number
) {
  const screenX = enemy.x - camera.x;
  const screenY = enemy.y - camera.y;

  // 화면 밖이면 스킵
  if (
    screenX < -30 ||
    screenX > canvasWidth + 30 ||
    screenY < -30 ||
    screenY > canvasHeight + 30
  ) {
    return;
  }

  ctx.save();

  // 보스 유닛은 더 크게 렌더링
  const isBoss = enemy.type === 'boss';
  const isBoss2 = enemy.type === 'boss2';
  const isAnyBoss = isBoss || isBoss2;
  const unitScale = isAnyBoss ? 2.5 : 1;
  const baseRadius = isAnyBoss ? 44 : 22;
  const mainRadius = isAnyBoss ? 34 : 17;

  // 타겟 글로우
  if (isTarget) {
    ctx.shadowColor = '#ff6600';
    ctx.shadowBlur = 20;
  }

  // 보스 글로우
  if (isBoss) {
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 30;
  } else if (isBoss2) {
    ctx.shadowColor = '#9900ff';
    ctx.shadowBlur = 30;
  }

  // 타원형 그림자 (유닛 발 아래 접지감 표현)
  const bossColor = isBoss2 ? '#9900ff' : '#ff0000';
  const enemyShadowColor = isAnyBoss ? bossColor : '#ef4444';
  const shadowRadiusX = isAnyBoss ? 36 : 18;
  const shadowOffsetY = isAnyBoss ? 28 : 14;
  ctx.save();
  ctx.translate(screenX, screenY + shadowOffsetY);
  ctx.scale(1, 0.45);
  const shadowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, shadowRadiusX);
  shadowGradient.addColorStop(0, enemyShadowColor + '45');
  shadowGradient.addColorStop(0.6, enemyShadowColor + '18');
  shadowGradient.addColorStop(1, 'transparent');
  ctx.fillStyle = shadowGradient;
  ctx.beginPath();
  ctx.arc(0, 0, shadowRadiusX, 0, Math.PI * 2);
  ctx.fill();
  // 타겟 표시 링 (타겟팅된 적만)
  if (isTarget) {
    ctx.strokeStyle = '#ff6600';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, shadowRadiusX + 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  ctx.restore();

  // 유닛 아이콘 (이미지 우선, 없으면 이모지 폴백)
  const EMOJI_MAP: Record<string, string> = {
    melee: '⚔️',
    ranged: '🏹',
    knight: '🛡️',
    mage: '🔮',
    boss: '👹',
    boss2: '🧙',
  };
  const iconSize = isAnyBoss ? 60 : 30;
  const iconHeight = isAnyBoss ? 80 : 40;
  const emojiSize = isAnyBoss ? 40 : 20;

  // 적 시선 방향: 타겟팅 중이면 영웅 방향, 아니면 이동 방향(넥서스 방향)
  let flipEnemy = false;
  if (enemy.aggroOnHero && enemy.targetHeroId && heroPosition) {
    // 영웅을 타겟팅 중 → 영웅 방향
    flipEnemy = heroPosition.x > enemy.x;
  } else {
    // 넥서스로 이동 중 → 넥서스 방향
    const nexus = useRPGStore.getState().nexus;
    if (nexus) {
      flipEnemy = nexus.x > enemy.x;
    }
  }

  // 모션 스프라이트 시도 (기본 적 유닛 + 보스)
  let enemyImageDrawn = false;
  const heroClass = ENEMY_TO_HERO_CLASS[enemy.type];
  const motionClass = heroClass || (isAnyBoss ? enemy.type as any : undefined);
  if (motionClass && gameTime != null) {
    // 적 상태: attacking → idle (공격은 쿨다운 점프로 감지)
    const enemyState = enemy.state === 'attacking' ? 'idle' : enemy.state;
    enemyImageDrawn = drawMotionSprite(
      ctx,
      enemy.id,
      motionClass,
      undefined, // advancedClass 없음
      undefined, // tier 없음
      enemyState,
      undefined, // dashState
      undefined, // castingUntil
      undefined, // darkBladeActive
      { Q: enemy.attackCooldown, W: 0, E: 0 },
      gameTime,
      screenX,
      screenY,
      iconSize,
      iconHeight,
      flipEnemy
    );
  }

  if (!enemyImageDrawn) {
    enemyImageDrawn = drawUnitImage(ctx, enemy.type as UnitType, screenX, screenY, iconSize, flipEnemy, iconHeight);
  }
  if (!enemyImageDrawn) {
    const emoji = EMOJI_MAP[enemy.type] || '👾';
    drawEmoji(ctx, emoji, screenX, screenY, emojiSize);
  }

  // 체력바
  const hpBarWidth = isAnyBoss ? 80 : 26;
  const hpBarHeight = isAnyBoss ? 8 : 4;
  const hpBarY = isAnyBoss ? -60 : -25;
  const hpPercent = enemy.hp / enemy.maxHp;

  ctx.fillStyle = '#1a1a25';
  ctx.beginPath();
  ctx.roundRect(screenX - hpBarWidth / 2, screenY + hpBarY, hpBarWidth, hpBarHeight, 2);
  ctx.fill();

  ctx.fillStyle = hpPercent > 0.5 ? '#ef4444' : '#7f1d1d';
  ctx.beginPath();
  ctx.roundRect(
    screenX - hpBarWidth / 2 + 1,
    screenY + hpBarY + 1,
    (hpBarWidth - 2) * hpPercent,
    hpBarHeight - 2,
    1
  );
  ctx.fill();

  // 보스 체력 텍스트
  if (isAnyBoss) {
    ctx.font = 'bold 12px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.floor(enemy.hp)} / ${enemy.maxHp}`, screenX, screenY + hpBarY - 5);
  }

  // 보스 공격 모션 (attacking 상태)
  if (isAnyBoss && enemy.state === 'attacking') {
    ctx.save();

    // 공격 방향 계산 (영웅 방향)
    const attackAngle = heroPosition
      ? Math.atan2(heroPosition.y - enemy.y, heroPosition.x - enemy.x)
      : 0;

    // 공격 스윙 호 (때리는 모션) - 0.3초 주기
    const swingProgress = (Date.now() % 300) / 300;
    const arcRadius = 70;
    const arcStart = attackAngle - Math.PI / 3;
    const arcEnd = attackAngle + Math.PI / 3;

    // 스윙 궤적 (어두운 빨간색)
    ctx.strokeStyle = `rgba(255, 50, 0, ${0.8 - swingProgress * 0.6})`;
    ctx.lineWidth = 8 - swingProgress * 6;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.arc(screenX, screenY, arcRadius * (0.5 + swingProgress * 0.5),
            arcStart + swingProgress * 0.3,
            arcEnd - swingProgress * 0.3);
    ctx.stroke();

    // 내부 밝은 스윙 궤적
    ctx.strokeStyle = `rgba(255, 100, 50, ${0.6 - swingProgress * 0.4})`;
    ctx.lineWidth = 4 - swingProgress * 3;
    ctx.beginPath();
    ctx.arc(screenX, screenY, arcRadius * (0.4 + swingProgress * 0.4),
            arcStart + swingProgress * 0.4,
            arcEnd - swingProgress * 0.4);
    ctx.stroke();

    // 공격 범위 표시 (반투명 부채꼴)
    ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
    ctx.beginPath();
    ctx.moveTo(screenX, screenY);
    ctx.arc(screenX, screenY, 80, arcStart, arcEnd);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  // 기절 상태 표시
  const isStunned = enemy.buffs?.some(b => b.type === 'stun' && b.duration > 0);
  if (isStunned) {
    ctx.save();

    // 회전하는 별들 (기절 이펙트)
    const time = Date.now() / 1000;
    const starCount = isAnyBoss ? 5 : 3;
    const orbitRadius = isAnyBoss ? 50 : 25;

    for (let i = 0; i < starCount; i++) {
      const angle = (time * 3) + (i * (Math.PI * 2 / starCount));
      const starX = screenX + Math.cos(angle) * orbitRadius;
      const starY = screenY - 20 + Math.sin(angle) * (orbitRadius * 0.4);

      // 별 그리기
      ctx.fillStyle = '#ffd700';
      ctx.font = isAnyBoss ? '16px Arial' : '12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⭐', starX, starY);
    }

    // 기절 텍스트
    ctx.font = 'bold 10px Arial';
    ctx.fillStyle = '#ffd700';
    ctx.textAlign = 'center';
    ctx.fillText('STUN', screenX, screenY - (isAnyBoss ? 75 : 50));

    ctx.restore();
  }
}

/**
 * 스킬 이펙트 렌더링
 */
export function drawSkillEffect(
  ctx: CanvasRenderingContext2D,
  effect: SkillEffect,
  camera: Camera,
  gameTime: number
) {
  const screenX = effect.position.x - camera.x;
  const screenY = effect.position.y - camera.y;
  const elapsed = gameTime - effect.startTime;
  if (elapsed < 0 || effect.duration <= 0) return; // 시간 역전 또는 무효 duration 방어
  const progress = Math.min(1, elapsed / effect.duration);

  ctx.save();

  // 전직 직업에 따른 색상 가져오기
  const colors = getAttackColors(effect.heroClass, effect.advancedClass);

  switch (effect.type) {
    // Q 스킬 (기본 공격) 이펙트들
    case 'warrior_q':
      // 전사 근접 공격 - 베기 이펙트 (항상 표시)
      {
        const attackRange = effect.radius || 80;

        // 베기 호 그리기 (항상 표시)
        if (effect.direction) {
          const slashAngle = Math.atan2(effect.direction.y, effect.direction.x);
          const slashProgress = progress;

          // 베기 궤적 (호 형태) - 전직별 색상 적용
          ctx.globalAlpha = (1 - progress) * 0.8;
          ctx.strokeStyle = colors.primary;
          ctx.lineWidth = 8 - slashProgress * 6;
          ctx.lineCap = 'round';

          // 베기 호 (시작각도에서 끝각도까지)
          const arcStart = slashAngle - Math.PI / 3 + slashProgress * Math.PI / 6;
          const arcEnd = slashAngle + Math.PI / 3 - slashProgress * Math.PI / 6;
          const arcRadius = attackRange * 0.7;

          ctx.beginPath();
          ctx.arc(screenX, screenY, arcRadius, arcStart, arcEnd);
          ctx.stroke();

          // 내부 밝은 베기 궤적 - 전직별 보조 색상 적용
          ctx.globalAlpha = (1 - progress) * 0.5;
          ctx.strokeStyle = colors.secondary;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(screenX, screenY, arcRadius - 5, arcStart + 0.1, arcEnd - 0.1);
          ctx.stroke();
        }

        // 각 피격 대상에 히트 이펙트 (적중 시에만)
        if (effect.hitTargets) {
          for (const target of effect.hitTargets) {
            const targetScreenX = target.x - camera.x;
            const targetScreenY = target.y - camera.y;

            // 피격 스파크 - 전직별 색상 적용
            ctx.globalAlpha = (1 - progress) * 0.9;
            for (let i = 0; i < 6; i++) {
              const sparkAngle = (i / 6) * Math.PI * 2 + progress * Math.PI;
              const sparkDist = 15 + progress * 25;
              const sparkX = targetScreenX + Math.cos(sparkAngle) * sparkDist;
              const sparkY = targetScreenY + Math.sin(sparkAngle) * sparkDist;

              ctx.strokeStyle = i % 2 === 0 ? colors.primary : colors.secondary;
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(targetScreenX, targetScreenY);
              ctx.lineTo(sparkX, sparkY);
              ctx.stroke();
            }

            // 피격 충격 원 - 전직별 색상 적용
            ctx.globalAlpha = (1 - progress) * 0.6;
            ctx.strokeStyle = colors.impact;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(targetScreenX, targetScreenY, 20 * progress, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }
      break;

    case 'archer_q':
      // 궁수 원거리 공격 - 화살 발사 이펙트 (항상 표시)
      {
        const arrowSpeed = 2.5;
        const arrowProgress = Math.min(1, progress * arrowSpeed);
        const hasTargets = effect.hitTargets && effect.hitTargets.length > 0;

        // 타겟이 있으면 타겟들에게, 없으면 마우스 방향으로 화살 발사
        if (hasTargets) {
          for (let i = 0; i < effect.hitTargets!.length; i++) {
            const target = effect.hitTargets![i];
            const targetScreenX = target.x - camera.x;
            const targetScreenY = target.y - camera.y;
            const angle = Math.atan2(target.y - effect.position.y, target.x - effect.position.x);
            const currentX = screenX + (targetScreenX - screenX) * arrowProgress;
            const currentY = screenY + (targetScreenY - screenY) * arrowProgress;

            if (arrowProgress < 1) {
              drawArrow(ctx, currentX, currentY, angle, screenX, screenY, colors);
            } else {
              // 피격 이펙트
              const impactProgress = (arrowProgress - 1) * 3;
              if (impactProgress < 1) {
                drawArrowImpact(ctx, targetScreenX, targetScreenY, impactProgress, colors);
              }
            }
          }
        } else if (effect.direction) {
          // 타겟이 없어도 방향으로 화살 발사 (공중으로 날아감)
          const maxRange = 150; // 궁수 사거리
          const angle = Math.atan2(effect.direction.y, effect.direction.x);
          const targetX = screenX + effect.direction.x * maxRange * arrowProgress;
          const targetY = screenY + effect.direction.y * maxRange * arrowProgress;

          if (arrowProgress < 1) {
            drawArrow(ctx, targetX, targetY, angle, screenX, screenY, colors);
          }
        }
      }
      break;

    case 'knight_q':
      // 기사 근접 공격 - 방패 타격 이펙트 (항상 표시)
      {
        const attackRange = effect.radius || 60;

        // 방패 타격 호 (항상 표시) - 전직별 색상 적용
        if (effect.direction) {
          const bashAngle = Math.atan2(effect.direction.y, effect.direction.x);

          ctx.globalAlpha = (1 - progress) * 0.7;
          ctx.strokeStyle = colors.primary;
          ctx.lineWidth = 10 - progress * 8;
          ctx.lineCap = 'round';

          const arcRadius = attackRange * 0.6;
          ctx.beginPath();
          ctx.arc(screenX, screenY, arcRadius, bashAngle - Math.PI / 4, bashAngle + Math.PI / 4);
          ctx.stroke();

          // 방패 충격 라인 - 전직별 보조 색상 적용
          ctx.globalAlpha = (1 - progress) * 0.5;
          ctx.strokeStyle = colors.secondary;
          ctx.lineWidth = 4;
          for (let i = 0; i < 3; i++) {
            const lineAngle = bashAngle + (i - 1) * 0.3;
            const startDist = 20;
            const endDist = attackRange * (0.5 + progress * 0.5);
            ctx.beginPath();
            ctx.moveTo(screenX + Math.cos(lineAngle) * startDist, screenY + Math.sin(lineAngle) * startDist);
            ctx.lineTo(screenX + Math.cos(lineAngle) * endDist, screenY + Math.sin(lineAngle) * endDist);
            ctx.stroke();
          }
        }

        // 각 피격 대상에 히트 이펙트 (적중 시에만) - 전직별 색상 적용
        if (effect.hitTargets) {
          for (const target of effect.hitTargets) {
            const targetScreenX = target.x - camera.x;
            const targetScreenY = target.y - camera.y;

            // 방패 충격 마크
            ctx.globalAlpha = (1 - progress) * 0.8;
            ctx.fillStyle = colors.primary;
            ctx.beginPath();
            ctx.arc(targetScreenX, targetScreenY, 12 * (1 - progress * 0.5), 0, Math.PI * 2);
            ctx.fill();

            // 충격파
            ctx.globalAlpha = (1 - progress) * 0.5;
            ctx.strokeStyle = colors.impact;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(targetScreenX, targetScreenY, 20 + progress * 25, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }
      break;

    case 'mage_q':
      // 마법사 원거리 공격 - 마법 화살 이펙트 (항상 표시)
      {
        const boltSpeed = 3;
        const boltProgress = Math.min(1, progress * boltSpeed);
        const hasTargets = effect.hitTargets && effect.hitTargets.length > 0;

        if (hasTargets) {
          // 타겟이 있으면 타겟에게 발사
          for (const target of effect.hitTargets!) {
            const targetScreenX = target.x - camera.x;
            const targetScreenY = target.y - camera.y;

            const dx = target.x - effect.position.x;
            const dy = target.y - effect.position.y;
            const angle = Math.atan2(dy, dx);

            const currentX = screenX + (targetScreenX - screenX) * boltProgress;
            const currentY = screenY + (targetScreenY - screenY) * boltProgress;

            if (boltProgress < 1) {
              drawMagicBolt(ctx, currentX, currentY, angle, screenX, screenY, colors);
            } else {
              // 피격 폭발
              const impactProgress = (boltProgress - 1) * 2;
              if (impactProgress < 1) {
                drawMagicImpact(ctx, targetScreenX, targetScreenY, impactProgress, colors);
              }
            }
          }
        } else if (effect.direction) {
          // 타겟이 없어도 방향으로 마법 발사 (공중으로 날아감)
          const maxRange = 120; // 마법사 사거리
          const angle = Math.atan2(effect.direction.y, effect.direction.x);
          const targetX = screenX + effect.direction.x * maxRange * boltProgress;
          const targetY = screenY + effect.direction.y * maxRange * boltProgress;

          if (boltProgress < 1) {
            drawMagicBolt(ctx, targetX, targetY, angle, screenX, screenY, colors);
          }
        }
      }
      break;

    case 'warrior_strike':
      // 전사 강타 (warrior_q와 동일)
      // 위의 warrior_q 코드와 동일하게 처리
      break;

    case 'dash':
    case 'warrior_charge':
    case 'warrior_w':
    case 'knight_charge':
    case 'knight_w':
      // 돌진 이펙트 - 직업별 차별화된 모션
      if (effect.direction) {
        const distance = effect.radius || 200;
        const isWarrior = effect.type === 'warrior_charge' || effect.type === 'warrior_w';
        const isKnight = effect.type === 'knight_charge' || effect.type === 'knight_w';
        const mainColor = isKnight ? '#3b82f6' : (isWarrior ? '#ff6b35' : '#ffd700');
        const glowColor = isKnight ? '#60a5fa' : (isWarrior ? '#ff8c00' : '#ffed4a');

        // 돌진 경로 (메인 트레일)
        const trailLength = distance * Math.min(progress * 1.2, 1);
        const endX = screenX + effect.direction.x * trailLength;
        const endY = screenY + effect.direction.y * trailLength;

        // 속도선 효과 (여러 개의 라인)
        ctx.globalAlpha = (1 - progress) * 0.6;
        for (let i = 0; i < 5; i++) {
          const offset = (i - 2) * 8;
          const perpX = -effect.direction.y * offset;
          const perpY = effect.direction.x * offset;

          ctx.strokeStyle = mainColor;
          ctx.lineWidth = 3 - Math.abs(i - 2);
          ctx.beginPath();
          ctx.moveTo(screenX + perpX, screenY + perpY);
          ctx.lineTo(endX + perpX * 0.3, endY + perpY * 0.3);
          ctx.stroke();
        }

        // 메인 트레일 (그라데이션)
        const trailGradient = ctx.createLinearGradient(screenX, screenY, endX, endY);
        trailGradient.addColorStop(0, 'transparent');
        trailGradient.addColorStop(0.3, mainColor + '80');
        trailGradient.addColorStop(1, glowColor);

        ctx.globalAlpha = (1 - progress) * 0.8;
        ctx.strokeStyle = trailGradient;
        ctx.lineWidth = 20;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(screenX, screenY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // 내부 밝은 트레일
        ctx.globalAlpha = (1 - progress) * 0.5;
        ctx.strokeStyle = '#ffffff80';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(screenX, screenY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // 잔상 이펙트 (여러 개의 원)
        const afterimageCount = 5;
        for (let i = 0; i < afterimageCount; i++) {
          const t = (i + 1) / afterimageCount * progress;
          const ax = screenX + effect.direction.x * distance * t;
          const ay = screenY + effect.direction.y * distance * t;
          const afterimageAlpha = (1 - progress) * (1 - i / afterimageCount) * 0.4;

          ctx.globalAlpha = afterimageAlpha;
          ctx.fillStyle = mainColor;
          ctx.beginPath();
          ctx.arc(ax, ay, 15 - i * 2, 0, Math.PI * 2);
          ctx.fill();
        }

        // 충격 파티클
        if (progress > 0.3) {
          const particleProgress = (progress - 0.3) / 0.7;
          for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const particleRadius = 30 * particleProgress;
            const px = endX + Math.cos(angle) * particleRadius;
            const py = endY + Math.sin(angle) * particleRadius;

            ctx.globalAlpha = (1 - particleProgress) * 0.6;
            ctx.fillStyle = glowColor;
            ctx.beginPath();
            ctx.arc(px, py, 4 * (1 - particleProgress), 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // 도착 지점 충격파
        if (progress > 0.8) {
          const impactProgress = (progress - 0.8) / 0.2;
          ctx.globalAlpha = (1 - impactProgress) * 0.5;
          ctx.strokeStyle = glowColor;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(endX, endY, 40 * impactProgress, 0, Math.PI * 2);
          ctx.stroke();
        }

        // 기사 전용: 방패 이펙트
        if (isKnight && progress < 0.9) {
          const shieldProgress = Math.min(progress * 1.5, 1);
          const shieldX = screenX + effect.direction.x * distance * shieldProgress;
          const shieldY = screenY + effect.direction.y * distance * shieldProgress;
          const angle = Math.atan2(effect.direction.y, effect.direction.x);

          ctx.save();
          ctx.translate(shieldX, shieldY);
          ctx.rotate(angle);

          // 방패 글로우
          ctx.globalAlpha = (1 - progress) * 0.6;
          const shieldGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, 35);
          shieldGlow.addColorStop(0, '#60a5fa80');
          shieldGlow.addColorStop(0.5, '#3b82f640');
          shieldGlow.addColorStop(1, 'transparent');
          ctx.fillStyle = shieldGlow;
          ctx.beginPath();
          ctx.arc(0, 0, 35, 0, Math.PI * 2);
          ctx.fill();

          // 방패 모양 (육각형 기반)
          ctx.globalAlpha = (1 - progress) * 0.8;
          ctx.fillStyle = '#3b82f6';
          ctx.strokeStyle = '#93c5fd';
          ctx.lineWidth = 2;
          ctx.beginPath();
          // 방패 형태: 앞이 뾰족한 육각형
          ctx.moveTo(18, 0);   // 앞쪽 뾰족
          ctx.lineTo(8, -14);
          ctx.lineTo(-10, -14);
          ctx.lineTo(-14, 0);
          ctx.lineTo(-10, 14);
          ctx.lineTo(8, 14);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // 방패 내부 문양 (십자가)
          ctx.globalAlpha = (1 - progress) * 0.9;
          ctx.strokeStyle = '#dbeafe';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-8, 0);
          ctx.lineTo(8, 0);
          ctx.moveTo(0, -8);
          ctx.lineTo(0, 8);
          ctx.stroke();

          // 방패 앞 충격파
          ctx.globalAlpha = (1 - progress) * 0.4;
          ctx.strokeStyle = '#93c5fd';
          ctx.lineWidth = 2;
          for (let i = 0; i < 3; i++) {
            const waveOffset = 10 + i * 8 + progress * 20;
            ctx.beginPath();
            ctx.arc(waveOffset, 0, 12 - i * 3, -Math.PI / 2, Math.PI / 2);
            ctx.stroke();
          }

          ctx.restore();

          // 기절 이펙트 표시 (도착점 근처)
          if (progress > 0.6) {
            const stunProgress = (progress - 0.6) / 0.4;
            ctx.globalAlpha = (1 - stunProgress) * 0.7;
            ctx.fillStyle = '#fbbf24';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            // 별 모양으로 기절 표시
            for (let i = 0; i < 3; i++) {
              const starAngle = (i / 3) * Math.PI * 2 + stunProgress * Math.PI * 2;
              const starDist = 25 + stunProgress * 15;
              const starX = endX + Math.cos(starAngle) * starDist;
              const starY = endY + Math.sin(starAngle) * starDist - 10;
              ctx.fillText('★', starX, starY);
            }
          }
        }
      }
      break;

    case 'spin':
      // 회전 베기 이펙트 - 원형 파동
      ctx.globalAlpha = 1 - progress;
      ctx.strokeStyle = '#ff6b6b';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(screenX, screenY, (effect.radius || 100) * progress, 0, Math.PI * 2);
      ctx.stroke();

      // 내부 파동
      ctx.globalAlpha = (1 - progress) * 0.5;
      ctx.fillStyle = '#ff6b6b40';
      ctx.beginPath();
      ctx.arc(screenX, screenY, (effect.radius || 100) * progress * 0.8, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'heal':
    case 'knight_e':
    case 'knight_ironwall':
      // 힐/방어 이펙트 - 상승하는 파티클
      ctx.globalAlpha = 1 - progress;
      const healColor = (effect.type === 'knight_ironwall' || effect.type === 'knight_e') ? '#4a90d9' : '#10b981';
      ctx.fillStyle = healColor;

      // 여러 개의 작은 원
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + progress * Math.PI;
        const radius = 20 + progress * 30;
        const px = screenX + Math.cos(angle) * radius;
        const py = screenY + Math.sin(angle) * radius - progress * 50;

        ctx.beginPath();
        ctx.arc(px, py, 5 * (1 - progress), 0, Math.PI * 2);
        ctx.fill();
      }

      // 중앙 글로우
      ctx.globalAlpha = (1 - progress) * 0.3;
      const healGradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, 40);
      healGradient.addColorStop(0, healColor);
      healGradient.addColorStop(1, 'transparent');
      ctx.fillStyle = healGradient;
      ctx.beginPath();
      ctx.arc(screenX, screenY, 40, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'warrior_e':
    case 'warrior_berserker':
      // 광전사 버프 이펙트 - 폭발적인 불꽃 활성화
      {
        // 외곽 충격파 (여러 겹)
        for (let wave = 0; wave < 3; wave++) {
          const waveDelay = wave * 0.15;
          const waveProgress = Math.max(0, Math.min(1, (progress - waveDelay) / (1 - waveDelay)));
          if (waveProgress > 0) {
            ctx.globalAlpha = (1 - waveProgress) * 0.6;
            ctx.strokeStyle = wave === 0 ? '#ff0000' : (wave === 1 ? '#ff4400' : '#ff8800');
            ctx.lineWidth = 5 - wave;
            ctx.beginPath();
            ctx.arc(screenX, screenY, (50 + wave * 15) * waveProgress, 0, Math.PI * 2);
            ctx.stroke();
          }
        }

        // 중앙 폭발 (불꽃 코어)
        const coreProgress = Math.min(1, progress * 2);
        ctx.globalAlpha = (1 - progress) * 0.7;
        const berserkerGradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, 60 * coreProgress);
        berserkerGradient.addColorStop(0, '#ffffff');
        berserkerGradient.addColorStop(0.2, '#ffcc00');
        berserkerGradient.addColorStop(0.5, '#ff6600');
        berserkerGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = berserkerGradient;
        ctx.beginPath();
        ctx.arc(screenX, screenY, 60 * coreProgress, 0, Math.PI * 2);
        ctx.fill();

        // 폭발하는 불꽃 파티클
        for (let i = 0; i < 16; i++) {
          const angle = (i / 16) * Math.PI * 2;
          const particleSpeed = 80 + (i % 3) * 30;
          const px = screenX + Math.cos(angle) * particleSpeed * progress;
          const py = screenY + Math.sin(angle) * particleSpeed * progress - 20 * progress;
          const particleSize = 8 * (1 - progress);

          ctx.globalAlpha = (1 - progress) * 0.8;
          // 불꽃 색상 변화
          const colors = ['#ff0000', '#ff4400', '#ff8800', '#ffcc00'];
          ctx.fillStyle = colors[i % colors.length];
          ctx.beginPath();
          ctx.arc(px, py, particleSize, 0, Math.PI * 2);
          ctx.fill();
        }

        // 상승하는 불꽃 기둥
        for (let i = 0; i < 8; i++) {
          const flameX = screenX + (i - 3.5) * 12;
          const flameProgress = Math.max(0, progress - i * 0.03);
          const flameY = screenY - flameProgress * 80;
          const flameAlpha = (1 - progress) * (1 - Math.abs(i - 3.5) / 4);

          ctx.globalAlpha = flameAlpha * 0.7;
          const flameGradient = ctx.createLinearGradient(flameX, screenY, flameX, flameY);
          flameGradient.addColorStop(0, '#ff6600');
          flameGradient.addColorStop(0.5, '#ff3300');
          flameGradient.addColorStop(1, 'transparent');
          ctx.fillStyle = flameGradient;
          ctx.beginPath();
          ctx.ellipse(flameX, (screenY + flameY) / 2, 6, Math.abs(flameY - screenY) / 2, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        // 지면 균열 효과
        ctx.globalAlpha = (1 - progress) * 0.5;
        ctx.strokeStyle = '#ff4400';
        ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          const crackAngle = (i / 6) * Math.PI * 2;
          const crackLength = 40 * progress;
          ctx.beginPath();
          ctx.moveTo(screenX, screenY);
          ctx.lineTo(
            screenX + Math.cos(crackAngle) * crackLength,
            screenY + Math.sin(crackAngle) * crackLength
          );
          ctx.stroke();
        }
      }
      break;

    case 'archer_w':
    case 'archer_pierce':
      // 관통 화살 이펙트 - 화살이 날아가며 관통
      if (effect.direction) {
        const maxDistance = effect.radius || 300;
        const arrowSpeed = 2.5; // 화살 속도 배율
        const arrowProgress = Math.min(1, progress * arrowSpeed);
        const currentDistance = maxDistance * arrowProgress;

        // 화살이 아직 날아가는 중일 때만 표시
        if (arrowProgress < 1) {
          const arrowX = screenX + effect.direction.x * currentDistance;
          const arrowY = screenY + effect.direction.y * currentDistance;
          const angle = Math.atan2(effect.direction.y, effect.direction.x);

          // 잔상 트레일 (여러 개)
          const trailCount = 8;
          for (let i = trailCount; i >= 1; i--) {
            const trailProgress = Math.max(0, arrowProgress - i * 0.03);
            const trailDist = maxDistance * trailProgress;
            const trailX = screenX + effect.direction.x * trailDist;
            const trailY = screenY + effect.direction.y * trailDist;
            const trailAlpha = (1 - i / trailCount) * 0.5;

            ctx.globalAlpha = trailAlpha;
            ctx.strokeStyle = colors.primary;
            ctx.lineWidth = 3 - i * 0.3;
            ctx.beginPath();
            ctx.moveTo(trailX - effect.direction.x * 20, trailY - effect.direction.y * 20);
            ctx.lineTo(trailX, trailY);
            ctx.stroke();
          }

          // 에너지 파동 (화살 주변)
          ctx.globalAlpha = 0.3;
          ctx.strokeStyle = colors.secondary;
          ctx.lineWidth = 2;
          for (let i = 0; i < 3; i++) {
            const waveOffset = (progress * 10 + i * 2) % 3;
            const waveX = arrowX - effect.direction.x * (10 + waveOffset * 8);
            const waveY = arrowY - effect.direction.y * (10 + waveOffset * 8);
            ctx.globalAlpha = 0.3 * (1 - waveOffset / 3);
            ctx.beginPath();
            ctx.arc(waveX, waveY, 5 + waveOffset * 3, 0, Math.PI * 2);
            ctx.stroke();
          }

          // 메인 화살 그리기
          ctx.globalAlpha = 1;
          ctx.save();
          ctx.translate(arrowX, arrowY);
          ctx.rotate(angle);

          // 화살대 (나무색)
          ctx.strokeStyle = '#8B4513';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(-35, 0);
          ctx.lineTo(5, 0);
          ctx.stroke();

          // 화살촉 (금속색 + 에너지)
          ctx.fillStyle = colors.primary;
          ctx.beginPath();
          ctx.moveTo(15, 0);
          ctx.lineTo(0, -5);
          ctx.lineTo(3, 0);
          ctx.lineTo(0, 5);
          ctx.closePath();
          ctx.fill();

          // 화살촉 광택
          ctx.fillStyle = colors.secondary;
          ctx.beginPath();
          ctx.moveTo(12, 0);
          ctx.lineTo(3, -3);
          ctx.lineTo(5, 0);
          ctx.closePath();
          ctx.fill();

          // 깃털 (뒤쪽)
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(-35, 0);
          ctx.lineTo(-28, -6);
          ctx.lineTo(-25, 0);
          ctx.closePath();
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(-35, 0);
          ctx.lineTo(-28, 6);
          ctx.lineTo(-25, 0);
          ctx.closePath();
          ctx.fill();

          // 에너지 글로우
          ctx.shadowColor = colors.glow;
          ctx.shadowBlur = 15;
          ctx.strokeStyle = colors.primary;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-30, 0);
          ctx.lineTo(15, 0);
          ctx.stroke();

          ctx.restore();
        }

        // 관통 경로 잔여 이펙트 (화살이 지나간 자리)
        if (arrowProgress > 0.2) {
          ctx.globalAlpha = Math.max(0, 0.3 * (1 - progress));
          ctx.strokeStyle = colors.primary + '40';
          ctx.lineWidth = 8;
          ctx.setLineDash([15, 10]);
          ctx.beginPath();
          ctx.moveTo(screenX, screenY);
          ctx.lineTo(
            screenX + effect.direction.x * currentDistance,
            screenY + effect.direction.y * currentDistance
          );
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      break;

    case 'archer_e':
    case 'archer_rain':
      // 화살 비 이펙트 - 하늘에서 화살이 내리꽂히는 효과
      {
        const radius = effect.radius || 150;
        const arrowCount = 20;

        // 범위 표시 (바닥 원)
        ctx.globalAlpha = 0.4 * (1 - progress * 0.5);
        ctx.strokeStyle = colors.primary;
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.beginPath();
        ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // 범위 내부 채우기
        ctx.globalAlpha = 0.1 * (1 - progress * 0.5);
        ctx.fillStyle = colors.primary;
        ctx.beginPath();
        ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
        ctx.fill();

        // 각 화살 그리기
        for (let i = 0; i < arrowCount; i++) {
          // 각 화살마다 다른 시작 시간과 위치
          const seed = i * 1.618; // 황금비로 분포
          const arrowDelay = (i % 5) * 0.15; // 5그룹으로 나눠서 시차 발사
          const arrowProgress = Math.max(0, Math.min(1, (progress - arrowDelay) / (0.6 - arrowDelay * 0.5)));

          if (arrowProgress <= 0 || arrowProgress > 1) continue;

          // 화살 착지 위치 (범위 내 랜덤)
          const landAngle = seed * 2.4; // 각도
          const landDist = (0.2 + (seed * 0.618) % 0.8) * radius; // 거리
          const landX = screenX + Math.cos(landAngle) * landDist;
          const landY = screenY + Math.sin(landAngle) * landDist;

          // 화살 시작 위치 (위에서 비스듬히)
          const fallHeight = 150;
          const fallOffsetX = -30 + (seed % 1) * 20; // 약간의 x 오프셋

          // 현재 화살 위치 (easeInQuad - 가속 낙하)
          const easedProgress = arrowProgress * arrowProgress;
          const arrowX = landX + fallOffsetX * (1 - easedProgress);
          const arrowY = landY - fallHeight * (1 - easedProgress);

          // 화살이 땅에 닿기 전
          if (arrowProgress < 0.95) {
            ctx.globalAlpha = 0.9;

            // 낙하 각도 (비스듬히)
            const fallAngle = Math.PI / 2 + 0.3; // 약간 기울어진 각도

            ctx.save();
            ctx.translate(arrowX, arrowY);
            ctx.rotate(fallAngle);

            // 화살대
            ctx.strokeStyle = '#654321';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-20, 0);
            ctx.lineTo(8, 0);
            ctx.stroke();

            // 화살촉
            ctx.fillStyle = colors.primary;
            ctx.beginPath();
            ctx.moveTo(12, 0);
            ctx.lineTo(4, -3);
            ctx.lineTo(4, 3);
            ctx.closePath();
            ctx.fill();

            // 깃털
            ctx.fillStyle = '#eeeeee';
            ctx.beginPath();
            ctx.moveTo(-20, 0);
            ctx.lineTo(-15, -4);
            ctx.lineTo(-13, 0);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(-20, 0);
            ctx.lineTo(-15, 4);
            ctx.lineTo(-13, 0);
            ctx.closePath();
            ctx.fill();

            ctx.restore();

            // 낙하 잔상
            ctx.globalAlpha = 0.3;
            ctx.strokeStyle = colors.primary;
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(arrowX, arrowY);
            ctx.lineTo(arrowX - fallOffsetX * 0.5, arrowY - 40);
            ctx.stroke();
            ctx.setLineDash([]);
          }
          // 화살이 땅에 박힌 후 - 충격 이펙트
          else {
            const impactProgress = (arrowProgress - 0.95) / 0.05;

            // 박힌 화살 표시
            ctx.globalAlpha = 1 - progress * 0.3;
            ctx.save();
            ctx.translate(landX, landY);
            ctx.rotate(Math.PI / 2 + 0.2 + (seed % 0.4 - 0.2)); // 약간 랜덤 각도

            // 화살대 (땅에 박힌 부분)
            ctx.strokeStyle = '#654321';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-15, 0);
            ctx.lineTo(5, 0);
            ctx.stroke();

            // 깃털
            ctx.fillStyle = '#dddddd';
            ctx.beginPath();
            ctx.moveTo(-15, 0);
            ctx.lineTo(-10, -3);
            ctx.lineTo(-8, 0);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(-15, 0);
            ctx.lineTo(-10, 3);
            ctx.lineTo(-8, 0);
            ctx.closePath();
            ctx.fill();

            ctx.restore();

            // 충격파 (착지 시)
            if (impactProgress < 1) {
              ctx.globalAlpha = 0.5 * (1 - impactProgress);
              ctx.strokeStyle = colors.primary;
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(landX, landY, 15 * impactProgress, 0, Math.PI * 2);
              ctx.stroke();

              // 먼지 파티클
              ctx.fillStyle = '#8B7355';
              for (let j = 0; j < 4; j++) {
                const dustAngle = (j / 4) * Math.PI * 2 + seed;
                const dustDist = 10 * impactProgress;
                const dustX = landX + Math.cos(dustAngle) * dustDist;
                const dustY = landY + Math.sin(dustAngle) * dustDist - 5 * impactProgress;
                ctx.globalAlpha = 0.4 * (1 - impactProgress);
                ctx.beginPath();
                ctx.arc(dustX, dustY, 2, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          }
        }

        // 상단 경고 이펙트 (스킬 초반에)
        if (progress < 0.3) {
          const warningAlpha = (1 - progress / 0.3) * 0.4;
          ctx.globalAlpha = warningAlpha;
          ctx.strokeStyle = '#ff6600';
          ctx.lineWidth = 3;
          ctx.setLineDash([10, 5]);
          ctx.beginPath();
          ctx.arc(screenX, screenY, radius + 5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      break;

    case 'mage_w':
    case 'mage_fireball':
      // 화염구 이펙트 - 발사 후 폭발
      {
        const radius = effect.radius || 80;
        const time = elapsed * 10; // 애니메이션 속도

        // 단계 1: 화염구 발사 (0-30%)
        if (progress < 0.3) {
          const fireballProgress = progress / 0.3;

          // 영웅 위치에서 목표 지점으로 이동하는 화염구
          const heroX = effect.direction ? screenX - effect.direction.x * radius : screenX;
          const heroY = effect.direction ? screenY - effect.direction.y * radius : screenY;
          const currentX = heroX + (screenX - heroX) * fireballProgress;
          const currentY = heroY + (screenY - heroY) * fireballProgress;

          // 화염구 본체
          ctx.globalAlpha = 0.9;
          const fireballGradient = ctx.createRadialGradient(currentX, currentY, 0, currentX, currentY, 20);
          fireballGradient.addColorStop(0, '#ffffff');
          fireballGradient.addColorStop(0.3, '#ffff00');
          fireballGradient.addColorStop(0.6, '#ff6600');
          fireballGradient.addColorStop(1, '#ff000080');
          ctx.fillStyle = fireballGradient;
          ctx.beginPath();
          ctx.arc(currentX, currentY, 20, 0, Math.PI * 2);
          ctx.fill();

          // 화염 꼬리
          ctx.globalAlpha = 0.6;
          for (let i = 0; i < 5; i++) {
            const tailProgress = i / 5;
            const tailX = currentX - (effect.direction?.x || 0) * 15 * (i + 1);
            const tailY = currentY - (effect.direction?.y || 0) * 15 * (i + 1);
            const tailSize = 15 - i * 2;

            ctx.fillStyle = `rgba(255, ${100 + i * 30}, 0, ${0.5 - tailProgress * 0.4})`;
            ctx.beginPath();
            ctx.arc(tailX, tailY, tailSize, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        // 단계 2: 폭발 (30-100%)
        else {
          const explosionProgress = (progress - 0.3) / 0.7;
          const explosionRadius = radius * (0.3 + explosionProgress * 0.7);

          // 외부 충격파
          ctx.globalAlpha = (1 - explosionProgress) * 0.8;
          ctx.strokeStyle = '#ff8800';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(screenX, screenY, explosionRadius * 1.2, 0, Math.PI * 2);
          ctx.stroke();

          // 메인 폭발
          const fireGradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, explosionRadius);
          fireGradient.addColorStop(0, '#ffffff');
          fireGradient.addColorStop(0.2, '#ffff00');
          fireGradient.addColorStop(0.5, '#ff660080');
          fireGradient.addColorStop(1, 'transparent');
          ctx.fillStyle = fireGradient;
          ctx.beginPath();
          ctx.arc(screenX, screenY, explosionRadius, 0, Math.PI * 2);
          ctx.fill();

          // 불꽃 파티클
          ctx.globalAlpha = (1 - explosionProgress) * 0.7;
          for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2 + time * 0.5;
            const dist = explosionRadius * 0.7 * explosionProgress;
            const px = screenX + Math.cos(angle) * dist;
            const py = screenY + Math.sin(angle) * dist;

            ctx.fillStyle = i % 2 === 0 ? '#ff6600' : '#ffaa00';
            ctx.beginPath();
            ctx.arc(px, py, 6 * (1 - explosionProgress), 0, Math.PI * 2);
            ctx.fill();
          }

          // 연기/재 효과
          ctx.globalAlpha = (1 - explosionProgress) * 0.3;
          for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const dist = explosionRadius * 0.5 + explosionProgress * 30;
            const px = screenX + Math.cos(angle) * dist;
            const py = screenY + Math.sin(angle) * dist - explosionProgress * 20;

            ctx.fillStyle = '#444444';
            ctx.beginPath();
            ctx.arc(px, py, 8 + explosionProgress * 5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      break;

    case 'mage_e':
      // 운석 낙하 경고 이펙트 (3초 대기)
      {
        const radius = effect.radius || 150;
        const totalDuration = effect.duration || 3.0;
        const time = elapsed;
        const warningProgress = progress;

          // 경고 원 (펄싱)
          const pulse = Math.sin(time * 8) * 0.3 + 0.7;
          ctx.globalAlpha = 0.3 + pulse * 0.2;
          ctx.strokeStyle = '#ff0000';
          ctx.lineWidth = 3;
          ctx.setLineDash([10, 5]);
          ctx.beginPath();
          ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          // 범위 표시 (내부)
          ctx.globalAlpha = 0.1 + pulse * 0.1;
          const warningGradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, radius);
          warningGradient.addColorStop(0, '#ff440040');
          warningGradient.addColorStop(0.7, '#ff000030');
          warningGradient.addColorStop(1, '#ff000010');
          ctx.fillStyle = warningGradient;
          ctx.beginPath();
          ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
          ctx.fill();

          // 십자 마크
          ctx.globalAlpha = 0.5 + pulse * 0.3;
          ctx.strokeStyle = '#ff4400';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(screenX - 20, screenY);
          ctx.lineTo(screenX + 20, screenY);
          ctx.moveTo(screenX, screenY - 20);
          ctx.lineTo(screenX, screenY + 20);
          ctx.stroke();

          // 남은 시간 표시
          const remainingTime = Math.max(0, totalDuration - elapsed);
          ctx.globalAlpha = 0.9;
          ctx.font = 'bold 24px Arial';
          ctx.fillStyle = '#ff4400';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(remainingTime.toFixed(1), screenX, screenY - radius - 20);

          // 하늘에서 운석 낙하 표시 (점점 커짐)
          const meteorSize = 10 + warningProgress * 30;
          const meteorY = screenY - 200 + warningProgress * 150;

          ctx.globalAlpha = 0.3 + warningProgress * 0.5;
          const meteorTrailGradient = ctx.createRadialGradient(screenX, meteorY, 0, screenX, meteorY, meteorSize);
          meteorTrailGradient.addColorStop(0, '#ffffff');
          meteorTrailGradient.addColorStop(0.3, '#ff8800');
          meteorTrailGradient.addColorStop(0.7, '#ff440080');
          meteorTrailGradient.addColorStop(1, 'transparent');
          ctx.fillStyle = meteorTrailGradient;
          ctx.beginPath();
          ctx.arc(screenX, meteorY, meteorSize, 0, Math.PI * 2);
          ctx.fill();

          // 운석 꼬리
          ctx.globalAlpha = 0.2 + warningProgress * 0.3;
          ctx.strokeStyle = '#ff6600';
          ctx.lineWidth = meteorSize * 0.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(screenX, meteorY);
          ctx.lineTo(screenX, meteorY - 100 * (1 - warningProgress));
          ctx.stroke();

          // 수렴하는 경고선들
          for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const startDist = radius * (1.5 - warningProgress * 0.5);
            const endDist = radius;

            ctx.globalAlpha = 0.2 + warningProgress * 0.3;
            ctx.strokeStyle = '#ff2200';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(screenX + Math.cos(angle) * startDist, screenY + Math.sin(angle) * startDist);
            ctx.lineTo(screenX + Math.cos(angle) * endDist, screenY + Math.sin(angle) * endDist);
            ctx.stroke();
          }
      }
      break;

    case 'mage_meteor':
      // 운석 폭발 이펙트 (mage_e 경고 후 발동)
      {
        const radius = effect.radius || 150;
        const explosionProgress = progress;

        // 대폭발 - 흰색 플래시
        if (explosionProgress < 0.3) {
          ctx.globalAlpha = 1 - explosionProgress / 0.3;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(screenX, screenY, radius * 1.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // 메인 충격파
        ctx.globalAlpha = (1 - explosionProgress) * 0.9;
        ctx.strokeStyle = '#ff4400';
        ctx.lineWidth = 8 - explosionProgress * 6;
        ctx.beginPath();
        ctx.arc(screenX, screenY, radius * (0.5 + explosionProgress * 0.8), 0, Math.PI * 2);
        ctx.stroke();

        // 두번째 충격파
        ctx.globalAlpha = (1 - explosionProgress) * 0.6;
        ctx.strokeStyle = '#ff8800';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(screenX, screenY, radius * (0.3 + explosionProgress * 1.2), 0, Math.PI * 2);
        ctx.stroke();

        // 폭발 중심
        const explosionGradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, radius * (1 - explosionProgress * 0.5));
        explosionGradient.addColorStop(0, '#ffffff');
        explosionGradient.addColorStop(0.2, '#ffff00');
        explosionGradient.addColorStop(0.4, '#ff8800');
        explosionGradient.addColorStop(0.7, '#ff440060');
        explosionGradient.addColorStop(1, 'transparent');
        ctx.globalAlpha = 1 - explosionProgress;
        ctx.fillStyle = explosionGradient;
        ctx.beginPath();
        ctx.arc(screenX, screenY, radius * (1 - explosionProgress * 0.5), 0, Math.PI * 2);
        ctx.fill();

        // 불꽃 파편
        for (let i = 0; i < 24; i++) {
          const angle = (i / 24) * Math.PI * 2;
          const dist = radius * explosionProgress * 1.2;
          const px = screenX + Math.cos(angle) * dist;
          const py = screenY + Math.sin(angle) * dist;
          const size = 8 * (1 - explosionProgress);

          ctx.globalAlpha = (1 - explosionProgress) * 0.8;
          ctx.fillStyle = i % 3 === 0 ? '#ffff00' : (i % 3 === 1 ? '#ff8800' : '#ff4400');
          ctx.beginPath();
          ctx.arc(px, py, size, 0, Math.PI * 2);
          ctx.fill();
        }

        // 바닥 크레이터 효과
        ctx.globalAlpha = (1 - explosionProgress) * 0.4;
        ctx.fillStyle = '#222222';
        ctx.beginPath();
        ctx.ellipse(screenX, screenY + 10, radius * 0.8, radius * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      break;

    // ============================================
    // 전직 W 스킬 이펙트
    // ============================================

    case 'blood_rush':
      // 버서커 - 피의 돌진 (빨간색 돌진 + 피흡수)
      if (effect.direction) {
        const distance = effect.radius || 200;
        const trailLength = distance * Math.min(progress * 1.2, 1);
        const endX = screenX + effect.direction.x * trailLength;
        const endY = screenY + effect.direction.y * trailLength;

        // 피의 트레일
        ctx.globalAlpha = (1 - progress) * 0.8;
        const bloodGradient = ctx.createLinearGradient(screenX, screenY, endX, endY);
        bloodGradient.addColorStop(0, 'transparent');
        bloodGradient.addColorStop(0.3, '#8b000080');
        bloodGradient.addColorStop(1, '#ff0000');
        ctx.strokeStyle = bloodGradient;
        ctx.lineWidth = 25;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(screenX, screenY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // 피 파티클
        for (let i = 0; i < 8; i++) {
          const t = (i / 8 + progress * 0.5) % 1;
          const px = screenX + effect.direction.x * distance * t;
          const py = screenY + effect.direction.y * distance * t;
          const offset = Math.sin(i * 2 + progress * 10) * 15;
          ctx.globalAlpha = (1 - progress) * 0.7;
          ctx.fillStyle = '#ff0000';
          ctx.beginPath();
          ctx.arc(px + offset, py + offset * 0.5, 4, 0, Math.PI * 2);
          ctx.fill();
        }

        // 흡혈 이펙트 (힐이 있을 때)
        if (effect.heal && effect.heal > 0) {
          ctx.globalAlpha = (1 - progress) * 0.6;
          ctx.strokeStyle = '#00ff00';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(screenX, screenY, 30 + progress * 20, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      break;

    case 'guardian_rush':
      // 가디언 - 수호의 돌진 (파란색 + 보호막)
      if (effect.direction) {
        const distance = effect.radius || 150;
        const trailLength = distance * Math.min(progress * 1.2, 1);
        const endX = screenX + effect.direction.x * trailLength;
        const endY = screenY + effect.direction.y * trailLength;

        // 방패 트레일
        ctx.globalAlpha = (1 - progress) * 0.8;
        const shieldGradient = ctx.createLinearGradient(screenX, screenY, endX, endY);
        shieldGradient.addColorStop(0, 'transparent');
        shieldGradient.addColorStop(0.3, '#3b82f680');
        shieldGradient.addColorStop(1, '#60a5fa');
        ctx.strokeStyle = shieldGradient;
        ctx.lineWidth = 30;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(screenX, screenY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // 보호막 파동
        ctx.globalAlpha = (1 - progress) * 0.5;
        ctx.strokeStyle = '#93c5fd';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(endX, endY, 40 * progress, 0, Math.PI * 2);
        ctx.stroke();

        // 스턴 스타 이펙트
        ctx.globalAlpha = (1 - progress) * 0.8;
        ctx.fillStyle = '#ffd700';
        for (let i = 0; i < 5; i++) {
          const angle = (i / 5) * Math.PI * 2 + progress * 3;
          const dist = 25 + progress * 15;
          ctx.beginPath();
          ctx.arc(endX + Math.cos(angle) * dist, endY + Math.sin(angle) * dist, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;

    case 'backflip_shot':
      // 저격수 - 후방 도약 (뒤로 점프 + 전방 화살)
      if (effect.direction) {
        const range = effect.radius || 200;

        // 전방 화살 이펙트
        ctx.globalAlpha = (1 - progress) * 0.9;
        const arrowGradient = ctx.createLinearGradient(
          screenX, screenY,
          screenX + effect.direction.x * range,
          screenY + effect.direction.y * range
        );
        arrowGradient.addColorStop(0, colors.primary);
        arrowGradient.addColorStop(1, colors.primary + '40');
        ctx.strokeStyle = arrowGradient;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(screenX, screenY);
        ctx.lineTo(screenX + effect.direction.x * range * progress, screenY + effect.direction.y * range * progress);
        ctx.stroke();

        // 화살 머리
        const arrowX = screenX + effect.direction.x * range * Math.min(progress * 1.5, 1);
        const arrowY = screenY + effect.direction.y * range * Math.min(progress * 1.5, 1);
        const angle = Math.atan2(effect.direction.y, effect.direction.x);
        ctx.save();
        ctx.translate(arrowX, arrowY);
        ctx.rotate(angle);
        ctx.fillStyle = colors.primary;
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(-5, -5);
        ctx.lineTo(-5, 5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // 속도 버프 이펙트
        ctx.globalAlpha = (1 - progress) * 0.4;
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(screenX, screenY, 20 + i * 10 + progress * 30, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      break;

    case 'multi_arrow':
      // 레인저 - 다중 화살 (부채꼴 5발)
      if (effect.direction) {
        const arrowCount = 5;
        const spreadAngle = Math.PI / 4; // 45도
        const pierceDistance = effect.radius || 300;
        const baseAngle = Math.atan2(effect.direction.y, effect.direction.x);

        for (let i = 0; i < arrowCount; i++) {
          const angleOffset = spreadAngle * ((i / (arrowCount - 1)) - 0.5);
          const arrowAngle = baseAngle + angleOffset;
          const arrowDirX = Math.cos(arrowAngle);
          const arrowDirY = Math.sin(arrowAngle);

          const arrowProgress = Math.min(progress * 2, 1);
          const endX = screenX + arrowDirX * pierceDistance * arrowProgress;
          const endY = screenY + arrowDirY * pierceDistance * arrowProgress;

          // 화살 궤적
          ctx.globalAlpha = (1 - progress) * 0.8;
          const arrowGradient = ctx.createLinearGradient(screenX, screenY, endX, endY);
          arrowGradient.addColorStop(0, colors.primary);
          arrowGradient.addColorStop(1, colors.primary + '40');
          ctx.strokeStyle = arrowGradient;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(screenX, screenY);
          ctx.lineTo(endX, endY);
          ctx.stroke();

          // 화살 머리
          ctx.save();
          ctx.translate(endX, endY);
          ctx.rotate(arrowAngle);
          ctx.fillStyle = colors.primary;
          ctx.beginPath();
          ctx.moveTo(8, 0);
          ctx.lineTo(-4, -4);
          ctx.lineTo(-4, 4);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }

        // 발사 이펙트 (중앙)
        ctx.globalAlpha = (1 - progress) * 0.6;
        ctx.strokeStyle = colors.secondary;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(screenX, screenY, 15 + progress * 10, baseAngle - spreadAngle / 2, baseAngle + spreadAngle / 2);
        ctx.stroke();
      }
      break;

    case 'holy_charge':
      // 팔라딘 - 신성한 돌진 (황금색 + 힐)
      if (effect.direction) {
        const distance = effect.radius || 150;
        const trailLength = distance * Math.min(progress * 1.2, 1);
        const endX = screenX + effect.direction.x * trailLength;
        const endY = screenY + effect.direction.y * trailLength;

        // 신성한 트레일
        ctx.globalAlpha = (1 - progress) * 0.8;
        const holyGradient = ctx.createLinearGradient(screenX, screenY, endX, endY);
        holyGradient.addColorStop(0, 'transparent');
        holyGradient.addColorStop(0.3, '#ffd70080');
        holyGradient.addColorStop(1, '#ffffff');
        ctx.strokeStyle = holyGradient;
        ctx.lineWidth = 25;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(screenX, screenY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // 십자가 이펙트
        ctx.globalAlpha = (1 - progress) * 0.7;
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 4;
        const crossSize = 20;
        ctx.beginPath();
        ctx.moveTo(endX - crossSize, endY);
        ctx.lineTo(endX + crossSize, endY);
        ctx.moveTo(endX, endY - crossSize);
        ctx.lineTo(endX, endY + crossSize);
        ctx.stroke();

        // 힐 파동
        ctx.globalAlpha = (1 - progress) * 0.4;
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(screenX, screenY, 50 + progress * 100, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;

    case 'shadow_slash':
      // 다크나이트 - 암흑 베기 (보라색/검은색)
      if (effect.direction) {
        const distance = effect.radius || 200;
        const trailLength = distance * Math.min(progress * 1.2, 1);
        const endX = screenX + effect.direction.x * trailLength;
        const endY = screenY + effect.direction.y * trailLength;

        // 암흑 트레일
        ctx.globalAlpha = (1 - progress) * 0.9;
        const darkGradient = ctx.createLinearGradient(screenX, screenY, endX, endY);
        darkGradient.addColorStop(0, 'transparent');
        darkGradient.addColorStop(0.3, '#4c1d9580');
        darkGradient.addColorStop(1, '#7c3aed');
        ctx.strokeStyle = darkGradient;
        ctx.lineWidth = 25;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(screenX, screenY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // 어둠 파티클
        for (let i = 0; i < 6; i++) {
          const t = (i / 6 + progress * 0.5) % 1;
          const px = screenX + effect.direction.x * distance * t;
          const py = screenY + effect.direction.y * distance * t;
          const offset = Math.sin(i * 3 + progress * 8) * 20;
          ctx.globalAlpha = (1 - progress) * 0.6;
          ctx.fillStyle = '#7c3aed';
          ctx.beginPath();
          ctx.arc(px + offset, py + offset * 0.5, 5, 0, Math.PI * 2);
          ctx.fill();
        }

        // 흡혈 이펙트
        if (effect.heal && effect.heal > 0) {
          ctx.globalAlpha = (1 - progress) * 0.5;
          ctx.strokeStyle = '#a855f7';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(screenX, screenY, 25 + progress * 15, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      break;

    case 'inferno':
      // 대마법사 - 폭발 화염구 (화염 범위)
      {
        const radius = effect.radius || 120;
        const explosionProgress = Math.min(progress * 1.5, 1);

        // 화염 폭발 범위
        const fireGradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, radius * explosionProgress);
        fireGradient.addColorStop(0, '#ffffff');
        fireGradient.addColorStop(0.2, '#ffff00');
        fireGradient.addColorStop(0.5, '#ff8800');
        fireGradient.addColorStop(0.8, '#ff440060');
        fireGradient.addColorStop(1, 'transparent');
        ctx.globalAlpha = (1 - progress) * 0.9;
        ctx.fillStyle = fireGradient;
        ctx.beginPath();
        ctx.arc(screenX, screenY, radius * explosionProgress, 0, Math.PI * 2);
        ctx.fill();

        // 화염 링
        ctx.globalAlpha = (1 - progress) * 0.8;
        ctx.strokeStyle = '#ff4400';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(screenX, screenY, radius * explosionProgress * 0.8, 0, Math.PI * 2);
        ctx.stroke();

        // 불꽃 파티클
        for (let i = 0; i < 12; i++) {
          const angle = (i / 12) * Math.PI * 2 + progress * 2;
          const dist = radius * explosionProgress * 0.9;
          ctx.globalAlpha = (1 - progress) * 0.7;
          ctx.fillStyle = i % 2 === 0 ? '#ff8800' : '#ffff00';
          ctx.beginPath();
          ctx.arc(screenX + Math.cos(angle) * dist, screenY + Math.sin(angle) * dist, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;

    case 'healing_light':
      // 힐러 - 치유의 빛 (녹색 힐 범위)
      {
        const radius = effect.radius || 150;

        // 힐 범위
        const healGradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, radius);
        healGradient.addColorStop(0, '#00ff0060');
        healGradient.addColorStop(0.5, '#22c55e40');
        healGradient.addColorStop(1, 'transparent');
        ctx.globalAlpha = (1 - progress) * 0.7;
        ctx.fillStyle = healGradient;
        ctx.beginPath();
        ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
        ctx.fill();

        // 힐 링
        ctx.globalAlpha = (1 - progress) * 0.8;
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(screenX, screenY, radius * (0.5 + progress * 0.5), 0, Math.PI * 2);
        ctx.stroke();

        // 힐 파티클 (올라가는 효과)
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const dist = radius * 0.6;
          const yOffset = -progress * 30;
          ctx.globalAlpha = (1 - progress) * 0.8;
          ctx.fillStyle = '#86efac';
          ctx.font = '16px Arial';
          ctx.fillText('+', screenX + Math.cos(angle) * dist, screenY + Math.sin(angle) * dist + yOffset);
        }
      }
      break;

    // ============================================
    // 전직 E 스킬 이펙트
    // ============================================

    case 'rage':
      // 버서커 - 광란 (분노 버프)
      // tier2: 시안 불꽃, tier1: 붉은 불꽃
      {
        const radius = 60;
        let isTier2 = false;
        if (effect.heroId) {
          const rageState = useRPGStore.getState();
          const rageHero = rageState.hero?.id === effect.heroId ? rageState.hero : rageState.otherHeroes.get(effect.heroId);
          if (rageHero?.tier === 2) isTier2 = true;
        }
        const oraInner = isTier2 ? '#00ccff80' : '#ff000080';
        const oraMid = isTier2 ? '#0088cc60' : '#ff440060';
        const flameColor = isTier2 ? '#00ddff' : '#ff4400';
        const textColor = isTier2 ? '#00ccff' : '#ff0000';

        // 분노 오라
        ctx.globalAlpha = (1 - progress * 0.5) * 0.6;
        const rageGradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, radius);
        rageGradient.addColorStop(0, oraInner);
        rageGradient.addColorStop(0.5, oraMid);
        rageGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = rageGradient;
        ctx.beginPath();
        ctx.arc(screenX, screenY, radius + progress * 20, 0, Math.PI * 2);
        ctx.fill();

        // 분노 불꽃
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2 + progress * 5;
          const dist = 30 + Math.sin(progress * 10 + i) * 10;
          ctx.globalAlpha = (1 - progress) * 0.8;
          ctx.fillStyle = flameColor;
          ctx.beginPath();
          ctx.arc(screenX + Math.cos(angle) * dist, screenY + Math.sin(angle) * dist, 5, 0, Math.PI * 2);
          ctx.fill();
        }

        // 분노 텍스트
        ctx.globalAlpha = (1 - progress) * 0.9;
        ctx.fillStyle = textColor;
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('RAGE!', screenX, screenY - 50 - progress * 20);
      }
      break;

    case 'shield':
      // 가디언 - 보호막 (팀 보호막)
      {
        const radius = effect.radius || 500;

        // 보호막 돔
        ctx.globalAlpha = (1 - progress) * 0.4;
        const shieldGradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, radius);
        shieldGradient.addColorStop(0, 'transparent');
        shieldGradient.addColorStop(0.7, '#3b82f620');
        shieldGradient.addColorStop(1, '#3b82f660');
        ctx.fillStyle = shieldGradient;
        ctx.beginPath();
        ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
        ctx.fill();

        // 보호막 링
        ctx.globalAlpha = (1 - progress) * 0.7;
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
        ctx.stroke();

        // 방패 아이콘
        ctx.globalAlpha = (1 - progress) * 0.9;
        ctx.fillStyle = '#3b82f6';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('SHIELD', screenX, screenY - 60 - progress * 20);
      }
      break;

    case 'snipe':
      // 저격수 - 저격 (조준선 + 집중 모션)
      {
        // targetPosition 또는 direction으로 타겟 위치 계산
        let targetX = screenX;
        let targetY = screenY;

        if (effect.targetPosition) {
          targetX = effect.targetPosition.x - camera.x;
          targetY = effect.targetPosition.y - camera.y;
        } else if (effect.direction) {
          const range = 1000;
          targetX = screenX + effect.direction.x * range;
          targetY = screenY + effect.direction.y * range;
        }

        // 조준 단계 (progress < 0.9: 집중 중)
        if (progress < 0.9) {
          // 집중 중 조준선 (점선, 깜빡임)
          const blinkAlpha = 0.5 + Math.sin(gameTime * 10) * 0.3;
          ctx.globalAlpha = blinkAlpha;
          ctx.strokeStyle = '#ff0000';
          ctx.lineWidth = 2;
          ctx.setLineDash([15, 8]);
          ctx.beginPath();
          ctx.moveTo(screenX, screenY);
          ctx.lineTo(targetX, targetY);
          ctx.stroke();
          ctx.setLineDash([]);

          // 집중 원 (영웅 주위)
          ctx.globalAlpha = 0.6;
          ctx.strokeStyle = '#ff6600';
          ctx.lineWidth = 3;
          const chargeRadius = 40 + progress * 20;
          ctx.beginPath();
          ctx.arc(screenX, screenY, chargeRadius, 0, Math.PI * 2 * progress / 0.9);
          ctx.stroke();

          // 타겟 조준경
          ctx.globalAlpha = 0.7 + Math.sin(gameTime * 8) * 0.2;
          ctx.strokeStyle = '#ff0000';
          ctx.lineWidth = 2;
          const crosshairSize = 25 + Math.sin(gameTime * 5) * 5;
          ctx.beginPath();
          ctx.arc(targetX, targetY, crosshairSize, 0, Math.PI * 2);
          ctx.moveTo(targetX - crosshairSize - 15, targetY);
          ctx.lineTo(targetX + crosshairSize + 15, targetY);
          ctx.moveTo(targetX, targetY - crosshairSize - 15);
          ctx.lineTo(targetX, targetY + crosshairSize + 15);
          ctx.stroke();

          // 집중 텍스트
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = '#ff4400';
          ctx.font = 'bold 14px Arial';
          ctx.textAlign = 'center';
          const chargePercent = Math.floor((progress / 0.9) * 100);
          ctx.fillText(`CHARGING... ${chargePercent}%`, screenX, screenY - 60);
        } else {
          // 발사 단계 (progress >= 0.9)
          const fireProgress = (progress - 0.9) / 0.1;

          // 강력한 저격 탄환
          ctx.globalAlpha = (1 - fireProgress) * 0.9;
          const bulletGradient = ctx.createLinearGradient(screenX, screenY, targetX, targetY);
          bulletGradient.addColorStop(0, '#ffff00');
          bulletGradient.addColorStop(0.5, '#ff8800');
          bulletGradient.addColorStop(1, '#ff0000');
          ctx.strokeStyle = bulletGradient;
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.moveTo(screenX, screenY);
          ctx.lineTo(targetX, targetY);
          ctx.stroke();

          // 충격 이펙트
          ctx.globalAlpha = (1 - fireProgress) * 0.8;
          ctx.strokeStyle = '#ffff00';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(targetX, targetY, 30 * fireProgress, 0, Math.PI * 2);
          ctx.stroke();

          // 폭발 파티클
          for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const dist = 40 * fireProgress;
            ctx.fillStyle = i % 2 === 0 ? '#ffff00' : '#ff8800';
            ctx.beginPath();
            ctx.arc(targetX + Math.cos(angle) * dist, targetY + Math.sin(angle) * dist, 4, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      break;

    case 'arrow_storm':
      // 레인저 - 화살 폭풍 (버프 이펙트)
      {
        const radius = 50;

        // 바람 오라
        ctx.globalAlpha = (1 - progress * 0.5) * 0.5;
        ctx.strokeStyle = colors.primary;
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(screenX, screenY, radius + i * 15 + progress * 20, 0, Math.PI * 2);
          ctx.stroke();
        }

        // 화살 파티클
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2 + progress * 8;
          const dist = 40;
          ctx.save();
          ctx.translate(screenX + Math.cos(angle) * dist, screenY + Math.sin(angle) * dist);
          ctx.rotate(angle + Math.PI / 2);
          ctx.globalAlpha = (1 - progress) * 0.8;
          ctx.fillStyle = colors.primary;
          ctx.beginPath();
          ctx.moveTo(0, -8);
          ctx.lineTo(-3, 5);
          ctx.lineTo(3, 5);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }

        // 속도 UP 텍스트
        ctx.globalAlpha = (1 - progress) * 0.9;
        ctx.fillStyle = colors.primary;
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('SPEED UP!', screenX, screenY - 50 - progress * 20);
      }
      break;

    case 'divine_light':
      // 팔라딘 - 신성한 빛 (황금빛 힐 + 무적)
      {
        const radius = effect.radius || 500;

        // 신성한 빛
        ctx.globalAlpha = (1 - progress) * 0.5;
        const divineGradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, radius);
        divineGradient.addColorStop(0, '#ffffff80');
        divineGradient.addColorStop(0.3, '#ffd70060');
        divineGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = divineGradient;
        ctx.beginPath();
        ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
        ctx.fill();

        // 황금 링
        ctx.globalAlpha = (1 - progress) * 0.8;
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(screenX, screenY, radius * (0.5 + progress * 0.5), 0, Math.PI * 2);
        ctx.stroke();

        // 십자가 광선
        ctx.globalAlpha = (1 - progress) * 0.6;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(screenX - radius, screenY);
        ctx.lineTo(screenX + radius, screenY);
        ctx.moveTo(screenX, screenY - radius);
        ctx.lineTo(screenX, screenY + radius);
        ctx.stroke();
      }
      break;

    case 'dark_blade':
      // 다크나이트 - 어둠의 칼날 (암흑검 3자루가 캐릭터 주위를 회전, 토글)
      {
        const radius = effect.radius || 150;
        const t = elapsed;
        // 토글 이펙트는 duration이 9999이므로 페이드아웃 없이 유지, 시작 시 페이드인만
        const fadeInTime = 0.3;  // 0.3초 페이드인
        const fade = elapsed < fadeInTime ? elapsed / fadeInTime : 1;
        const swordCount = 3;
        const spinSpeed = 2.5;
        const orbitR = radius * 0.55;

        // 바닥 어둠 영역
        ctx.globalAlpha = fade * 0.15;
        const groundGrad = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, radius);
        groundGrad.addColorStop(0, '#0d001a');
        groundGrad.addColorStop(0.7, '#1a003060');
        groundGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = groundGrad;
        ctx.beginPath();
        ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
        ctx.fill();

        // 암흑검 3자루
        for (let i = 0; i < swordCount; i++) {
          const angle = (i / swordCount) * Math.PI * 2 + t * spinSpeed;
          const sx = screenX + Math.cos(angle) * orbitR;
          const sy = screenY + Math.sin(angle) * orbitR;
          // 검이 궤도 접선 방향으로 향함 (회전 진행 방향)
          const swordAngle = angle + Math.PI * 0.5;

          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(swordAngle);

          // 글로우
          ctx.shadowColor = '#7c3aed';
          ctx.shadowBlur = 14;

          // === 검신 (blade) ===
          const bladeL = 32;  // 검신 길이
          const bladeW = 5;   // 검신 최대 폭의 절반
          ctx.globalAlpha = fade * 0.95;
          // 검신 몸체 (검은색)
          ctx.fillStyle = '#0f0a18';
          ctx.beginPath();
          ctx.moveTo(0, -bladeW * 0.5);             // 가드 위쪽에서 시작
          ctx.lineTo(bladeL * 0.7, -bladeW);         // 넓어지다가
          ctx.lineTo(bladeL, 0);                      // 끝 뾰족
          ctx.lineTo(bladeL * 0.7, bladeW);           // 아래쪽
          ctx.lineTo(0, bladeW * 0.5);                // 가드 아래쪽
          ctx.closePath();
          ctx.fill();
          // 검신 보라 엣지 (양날)
          ctx.strokeStyle = '#a855f7';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(0, -bladeW * 0.5);
          ctx.lineTo(bladeL * 0.7, -bladeW);
          ctx.lineTo(bladeL, 0);
          ctx.lineTo(bladeL * 0.7, bladeW);
          ctx.lineTo(0, bladeW * 0.5);
          ctx.stroke();
          // 검신 중앙 홈 (fuller)
          ctx.globalAlpha = fade * 0.6;
          ctx.strokeStyle = '#7c3aed';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(4, 0);
          ctx.lineTo(bladeL * 0.6, 0);
          ctx.stroke();

          // === 가드 (crossguard) ===
          ctx.globalAlpha = fade * 0.95;
          ctx.fillStyle = '#6d28d9';
          ctx.fillRect(-2, -bladeW - 3, 4, (bladeW + 3) * 2);
          // 가드 밝은 테두리
          ctx.strokeStyle = '#a78bfa';
          ctx.lineWidth = 1;
          ctx.strokeRect(-2, -bladeW - 3, 4, (bladeW + 3) * 2);

          // === 손잡이 (grip) ===
          const gripL = 14;
          ctx.fillStyle = '#1e1030';
          ctx.fillRect(-gripL - 2, -2.5, gripL, 5);
          // 손잡이 감김 줄
          ctx.strokeStyle = '#581c87';
          ctx.lineWidth = 1;
          for (let g = 0; g < 3; g++) {
            const gx = -gripL + 2 + g * 4;
            ctx.beginPath();
            ctx.moveTo(gx, -2.5);
            ctx.lineTo(gx + 2, 2.5);
            ctx.stroke();
          }

          // === 폼멜 (pommel) ===
          ctx.fillStyle = '#7c3aed';
          ctx.beginPath();
          ctx.arc(-gripL - 3, 0, 3, 0, Math.PI * 2);
          ctx.fill();

          ctx.shadowBlur = 0;
          ctx.restore();
        }
      }
      break;

    case 'heavy_strike':
      // 다크나이트 - 암흑 찌르기 시전 (어둠 에너지를 칼에 모아 전방으로 찌르기 준비)
      {
        const p = progress; // 0→1
        const fade = p < 0.05 ? p / 0.05 : 1;  // 빠른 페이드인 (50ms)
        const dir = effect.direction || { x: 1, y: 0 };
        const dirAngle = Math.atan2(dir.y, dir.x);

        // 1) 캐릭터 주변 어둠 오라 (즉시 표시, 점점 응축)
        const auraRadius = 35 - p * 10;  // 점점 좁아짐 (에너지 응축)
        ctx.globalAlpha = fade * (0.3 + p * 0.3);
        const auraGrad = ctx.createRadialGradient(screenX, screenY, 3, screenX, screenY, auraRadius);
        auraGrad.addColorStop(0, '#4c1d95');
        auraGrad.addColorStop(0.5, 'rgba(124, 58, 237, 0.4)');
        auraGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = auraGrad;
        ctx.beginPath();
        ctx.arc(screenX, screenY, auraRadius, 0, Math.PI * 2);
        ctx.fill();

        // 2) 뒤로 당기는 칼 모션 (0~50%: 뒤로 당김, 50~100%: 앞으로 찌르기 준비)
        const pullBack = p < 0.5 ? p / 0.5 : 1;
        const thrustReady = p > 0.5 ? (p - 0.5) / 0.5 : 0;
        // 뒤로 당겨졌다가 점점 앞으로 이동
        const bladeOffset = -25 * pullBack + 40 * thrustReady;
        const bladeCX = screenX + Math.cos(dirAngle) * bladeOffset;
        const bladeCY = screenY + Math.sin(dirAngle) * bladeOffset;
        const bladeLen = 28 + thrustReady * 12;

        // 칼날 외곽 글로우 (넓은 보라 빛)
        ctx.globalAlpha = fade * (0.4 + p * 0.4);
        ctx.shadowColor = '#7c3aed';
        ctx.shadowBlur = 15;
        ctx.strokeStyle = '#7c3aed';
        ctx.lineWidth = 12 + p * 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(bladeCX - Math.cos(dirAngle) * bladeLen * 0.4, bladeCY - Math.sin(dirAngle) * bladeLen * 0.4);
        ctx.lineTo(bladeCX + Math.cos(dirAngle) * bladeLen * 0.6, bladeCY + Math.sin(dirAngle) * bladeLen * 0.6);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // 칼날 본체 (밝은 코어)
        ctx.globalAlpha = fade * (0.7 + p * 0.3);
        ctx.strokeStyle = '#c4b5fd';
        ctx.lineWidth = 5 + thrustReady * 3;
        ctx.beginPath();
        ctx.moveTo(bladeCX - Math.cos(dirAngle) * bladeLen * 0.4, bladeCY - Math.sin(dirAngle) * bladeLen * 0.4);
        ctx.lineTo(bladeCX + Math.cos(dirAngle) * bladeLen * 0.6, bladeCY + Math.sin(dirAngle) * bladeLen * 0.6);
        ctx.stroke();

        // 칼 끝 빛점
        const tipBX = bladeCX + Math.cos(dirAngle) * bladeLen * 0.6;
        const tipBY = bladeCY + Math.sin(dirAngle) * bladeLen * 0.6;
        ctx.globalAlpha = fade * (0.6 + thrustReady * 0.4);
        ctx.fillStyle = '#e9d5ff';
        ctx.beginPath();
        ctx.arc(tipBX, tipBY, 3 + thrustReady * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineCap = 'butt';

        // 3) 에너지 수렴 라인 (바깥에서 칼 쪽으로 수렴)
        for (let i = 0; i < 6; i++) {
          const angle = dirAngle + (i / 6 - 0.5) * Math.PI * 0.8 + Math.PI;
          const dist = 55 * (1 - p * 0.7) + Math.sin(i * 2.1 + p * 12) * 8;
          const ox = screenX + Math.cos(angle) * dist;
          const oy = screenY + Math.sin(angle) * dist;
          ctx.globalAlpha = fade * (0.3 + p * 0.5);
          ctx.strokeStyle = '#a855f7';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(ox, oy);
          ctx.lineTo(bladeCX, bladeCY);
          ctx.stroke();
        }

        // 4) 전방 직선 경고 (60% 이후)
        if (p > 0.6) {
          const warnP = (p - 0.6) / 0.4;
          const blink = Math.sin(p * 25) * 0.3 + 0.7;
          ctx.globalAlpha = fade * warnP * 0.5 * blink;
          ctx.strokeStyle = '#a855f7';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.moveTo(screenX + Math.cos(dirAngle) * 20, screenY + Math.sin(dirAngle) * 20);
          ctx.lineTo(screenX + Math.cos(dirAngle) * 120, screenY + Math.sin(dirAngle) * 120);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // 5) 바닥 어둠 원 (시전 범위 표시)
        ctx.globalAlpha = fade * 0.15;
        ctx.fillStyle = '#1a0030';
        ctx.beginPath();
        ctx.ellipse(screenX, screenY + 5, 30, 12, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      break;

    case 'heavy_strike_impact':
      // 다크나이트 - 암흑 찌르기 충격 (어둠 에너지 창이 직선으로 관통)
      {
        const impLen = effect.radius || 120;
        const impFade = progress < 0.05 ? progress / 0.05 : progress > 0.5 ? (1 - progress) / 0.5 : 1;
        const impDir = effect.direction || { x: 1, y: 0 };
        const impAngle = Math.atan2(impDir.y, impDir.x);
        const impPerpAngle = impAngle + Math.PI / 2;
        const w = progress; // 0→1

        // 1) 에너지 창 - 전방으로 빠르게 뻗어나감
        const spearTip = impLen * (0.3 + w * 0.7);
        const spearTailLen = Math.min(spearTip, 60) * (1 - w * 0.3);
        const spearTail = Math.max(0, spearTip - spearTailLen);
        const tipX = screenX + Math.cos(impAngle) * spearTip;
        const tipY = screenY + Math.sin(impAngle) * spearTip;
        const tailX = screenX + Math.cos(impAngle) * spearTail;
        const tailY = screenY + Math.sin(impAngle) * spearTail;

        // 뒤쪽 넓고 앞쪽 좁은 창 형태
        const tailWidth = (12 + (1 - w) * 8) * impFade;
        const tipWidth = 2;

        // 에너지 창 글로우 (넓은 보라빛)
        ctx.globalAlpha = impFade * 0.35;
        ctx.beginPath();
        ctx.moveTo(tipX + Math.cos(impPerpAngle) * tipWidth, tipY + Math.sin(impPerpAngle) * tipWidth);
        ctx.lineTo(tailX + Math.cos(impPerpAngle) * tailWidth, tailY + Math.sin(impPerpAngle) * tailWidth);
        ctx.lineTo(tailX - Math.cos(impPerpAngle) * tailWidth, tailY - Math.sin(impPerpAngle) * tailWidth);
        ctx.lineTo(tipX - Math.cos(impPerpAngle) * tipWidth, tipY - Math.sin(impPerpAngle) * tipWidth);
        ctx.closePath();
        ctx.fillStyle = '#7c3aed';
        ctx.fill();

        // 에너지 창 본체 (밝은 핵)
        const coreHalfW = tailWidth * 0.4;
        ctx.globalAlpha = impFade * 0.9;
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tailX + Math.cos(impPerpAngle) * coreHalfW, tailY + Math.sin(impPerpAngle) * coreHalfW);
        ctx.lineTo(tailX - Math.cos(impPerpAngle) * coreHalfW, tailY - Math.sin(impPerpAngle) * coreHalfW);
        ctx.closePath();
        const spearGrad = ctx.createLinearGradient(tailX, tailY, tipX, tipY);
        spearGrad.addColorStop(0, '#a855f7');
        spearGrad.addColorStop(0.6, '#e9d5ff');
        spearGrad.addColorStop(1, '#fff');
        ctx.fillStyle = spearGrad;
        ctx.fill();

        // 끝부분 빛
        ctx.globalAlpha = impFade * 0.8;
        const tipGlow = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, 8);
        tipGlow.addColorStop(0, '#fff');
        tipGlow.addColorStop(0.5, 'rgba(196, 181, 253, 0.5)');
        tipGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = tipGlow;
        ctx.beginPath();
        ctx.arc(tipX, tipY, 8, 0, Math.PI * 2);
        ctx.fill();

        // 2) 관통 궤적 (중심선)
        ctx.globalAlpha = impFade * 0.4;
        const trailGrd = ctx.createLinearGradient(screenX, screenY, tipX, tipY);
        trailGrd.addColorStop(0, 'rgba(76, 29, 149, 0.1)');
        trailGrd.addColorStop(0.5, 'rgba(124, 58, 237, 0.4)');
        trailGrd.addColorStop(1, 'transparent');
        ctx.strokeStyle = trailGrd;
        ctx.lineWidth = 3 * (1 - w * 0.5);
        ctx.beginPath();
        ctx.moveTo(screenX, screenY);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();

        // 3) 관통 파편 (찌른 경로를 따라 좌우로 튀는 파편)
        ctx.globalAlpha = impFade * 0.6;
        for (let i = 0; i < 8; i++) {
          const t = (i + 0.5) / 8;
          const pDist = spearTip * t;
          const spread = (8 + w * 15) * ((i % 2) * 2 - 1) * Math.sin(i * 2.5 + w * 8);
          const px = screenX + Math.cos(impAngle) * pDist + Math.cos(impPerpAngle) * spread;
          const py = screenY + Math.sin(impAngle) * pDist + Math.sin(impPerpAngle) * spread;
          const pSize = (2 - w * 1.2) * (1 - t * 0.4);
          ctx.fillStyle = i % 3 === 0 ? '#e9d5ff' : i % 3 === 1 ? '#a855f7' : '#7c3aed';
          ctx.beginPath();
          ctx.arc(px, py, Math.max(pSize, 0.5), 0, Math.PI * 2);
          ctx.fill();
        }

        // 4) 시작점 섬광
        if (w < 0.2) {
          const flashP = w / 0.2;
          ctx.globalAlpha = (1 - flashP) * 0.5;
          const flashGrad = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, 20 * flashP);
          flashGrad.addColorStop(0, '#fff');
          flashGrad.addColorStop(0.5, '#c4b5fd');
          flashGrad.addColorStop(1, 'transparent');
          ctx.fillStyle = flashGrad;
          ctx.beginPath();
          ctx.arc(screenX, screenY, 20 * flashP, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;

    case 'meteor_shower':
      // 대마법사 - 메테오 샤워 (위에서 떨어지는 거대 운석들)
      {
        const radius = effect.radius || 100;
        const meteorCount = 8;
        const fallHeight = 300; // 떨어지는 높이

        // 배경 어둡게 (경고 효과)
        ctx.globalAlpha = (1 - progress) * 0.3;
        ctx.fillStyle = '#ff440040';
        ctx.beginPath();
        ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
        ctx.fill();

        // 경고 원 (충돌 범위)
        ctx.globalAlpha = (1 - progress) * 0.5;
        ctx.strokeStyle = '#ff4400';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 5]);
        ctx.beginPath();
        ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // 운석들 낙하
        for (let i = 0; i < meteorCount; i++) {
          // 각 운석은 시간차로 떨어짐
          const meteorDelay = i / meteorCount * 0.6;
          const meteorProgress = Math.max(0, Math.min(1, (progress - meteorDelay) / 0.4));

          if (meteorProgress <= 0) continue;

          // 고정된 위치 계산 (랜덤 제거)
          const angle = (i / meteorCount) * Math.PI * 2 + 0.3;
          const dist = radius * (0.3 + (i % 3) * 0.25);
          const targetX = screenX + Math.cos(angle) * dist;
          const targetY = screenY + Math.sin(angle) * dist;

          // 운석이 위에서 떨어짐
          const fallProgress = Math.min(meteorProgress, 0.7) / 0.7;
          const meteorY = targetY - fallHeight * (1 - fallProgress);
          const meteorSize = 12 + (i % 3) * 4;

          if (meteorProgress < 0.7) {
            // 운석 본체 (타원형, 빠르게 낙하)
            ctx.save();
            ctx.translate(targetX, meteorY);
            ctx.rotate(Math.PI * 0.25); // 대각선 방향

            // 운석 글로우
            ctx.globalAlpha = (1 - progress) * 0.6;
            const meteorGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, meteorSize * 2);
            meteorGlow.addColorStop(0, '#ff8800');
            meteorGlow.addColorStop(0.5, '#ff440080');
            meteorGlow.addColorStop(1, 'transparent');
            ctx.fillStyle = meteorGlow;
            ctx.beginPath();
            ctx.arc(0, 0, meteorSize * 2, 0, Math.PI * 2);
            ctx.fill();

            // 운석 코어
            ctx.globalAlpha = (1 - progress) * 0.95;
            ctx.fillStyle = '#ff6600';
            ctx.beginPath();
            ctx.ellipse(0, 0, meteorSize * 0.6, meteorSize, 0, 0, Math.PI * 2);
            ctx.fill();

            // 운석 밝은 중심
            ctx.fillStyle = '#ffcc00';
            ctx.beginPath();
            ctx.ellipse(0, -meteorSize * 0.3, meteorSize * 0.3, meteorSize * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();

            // 운석 꼬리 (위로 길게)
            const tailLength = 60 + fallProgress * 40;
            const tailGradient = ctx.createLinearGradient(targetX, meteorY, targetX, meteorY - tailLength);
            tailGradient.addColorStop(0, '#ff880090');
            tailGradient.addColorStop(0.3, '#ff440060');
            tailGradient.addColorStop(1, 'transparent');
            ctx.globalAlpha = (1 - progress) * 0.8;
            ctx.strokeStyle = tailGradient;
            ctx.lineWidth = meteorSize * 0.8;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(targetX, meteorY);
            ctx.lineTo(targetX, meteorY - tailLength);
            ctx.stroke();

          } else {
            // 충돌 폭발
            const impactProgress = (meteorProgress - 0.7) / 0.3;
            const explosionSize = meteorSize * 3 * impactProgress;

            // 폭발 글로우
            ctx.globalAlpha = (1 - impactProgress) * 0.9;
            const explosionGradient = ctx.createRadialGradient(targetX, targetY, 0, targetX, targetY, explosionSize);
            explosionGradient.addColorStop(0, '#ffffff');
            explosionGradient.addColorStop(0.2, '#ffff00');
            explosionGradient.addColorStop(0.5, '#ff8800');
            explosionGradient.addColorStop(1, 'transparent');
            ctx.fillStyle = explosionGradient;
            ctx.beginPath();
            ctx.arc(targetX, targetY, explosionSize, 0, Math.PI * 2);
            ctx.fill();

            // 충격파 링
            ctx.globalAlpha = (1 - impactProgress) * 0.7;
            ctx.strokeStyle = '#ff4400';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(targetX, targetY, explosionSize * 1.2, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }
      break;

    case 'dark_meteor_fall':
      // 보스2 - 암흑 유성 낙하 (보라색/어둠 테마)
      {
        const radius = effect.radius || 100;
        const meteorCount = 5;
        const fallHeight = 250;

        // 배경 경고 (보라색)
        ctx.globalAlpha = (1 - progress) * 0.3;
        ctx.fillStyle = '#9900ff40';
        ctx.beginPath();
        ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
        ctx.fill();

        // 경고 원 (충돌 범위)
        ctx.globalAlpha = (1 - progress) * 0.5;
        ctx.strokeStyle = '#cc66ff';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 5]);
        ctx.beginPath();
        ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // 암흑 운석 낙하
        for (let i = 0; i < meteorCount; i++) {
          const meteorDelay = i / meteorCount * 0.5;
          const meteorProgress = Math.max(0, Math.min(1, (progress - meteorDelay) / 0.5));

          if (meteorProgress <= 0) continue;

          // 고정된 위치 계산
          const angle = (i / meteorCount) * Math.PI * 2 + 0.5;
          const dist = radius * (0.3 + (i % 3) * 0.25);
          const targetX = screenX + Math.cos(angle) * dist;
          const targetY = screenY + Math.sin(angle) * dist;

          // 운석 낙하
          const fallProgress = Math.min(meteorProgress, 0.7) / 0.7;
          const meteorY = targetY - fallHeight * (1 - fallProgress);
          const meteorSize = 12 + (i % 3) * 4;

          if (meteorProgress < 0.7) {
            // 운석 본체
            ctx.save();
            ctx.translate(targetX, meteorY);
            ctx.rotate(Math.PI * 0.25);

            // 운석 글로우 (보라색)
            ctx.globalAlpha = (1 - progress) * 0.6;
            const meteorGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, meteorSize * 2);
            meteorGlow.addColorStop(0, '#9900ff');
            meteorGlow.addColorStop(0.5, '#6600cc80');
            meteorGlow.addColorStop(1, 'transparent');
            ctx.fillStyle = meteorGlow;
            ctx.beginPath();
            ctx.arc(0, 0, meteorSize * 2, 0, Math.PI * 2);
            ctx.fill();

            // 운석 코어 (짙은 보라)
            ctx.globalAlpha = (1 - progress) * 0.95;
            ctx.fillStyle = '#7700dd';
            ctx.beginPath();
            ctx.ellipse(0, 0, meteorSize * 0.6, meteorSize, 0, 0, Math.PI * 2);
            ctx.fill();

            // 운석 밝은 중심 (라벤더)
            ctx.fillStyle = '#cc88ff';
            ctx.beginPath();
            ctx.ellipse(0, -meteorSize * 0.3, meteorSize * 0.3, meteorSize * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();

            // 운석 꼬리 (보라색)
            const tailLength = 60 + fallProgress * 40;
            const tailGradient = ctx.createLinearGradient(targetX, meteorY, targetX, meteorY - tailLength);
            tailGradient.addColorStop(0, '#9900ff90');
            tailGradient.addColorStop(0.3, '#6600cc60');
            tailGradient.addColorStop(1, 'transparent');
            ctx.globalAlpha = (1 - progress) * 0.8;
            ctx.strokeStyle = tailGradient;
            ctx.lineWidth = meteorSize * 0.8;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(targetX, meteorY);
            ctx.lineTo(targetX, meteorY - tailLength);
            ctx.stroke();

          } else {
            // 충돌 폭발 (보라색)
            const impactProgress = (meteorProgress - 0.7) / 0.3;
            const explosionSize = meteorSize * 3 * impactProgress;

            ctx.globalAlpha = (1 - impactProgress) * 0.9;
            const explosionGradient = ctx.createRadialGradient(targetX, targetY, 0, targetX, targetY, explosionSize);
            explosionGradient.addColorStop(0, '#ffffff');
            explosionGradient.addColorStop(0.2, '#cc66ff');
            explosionGradient.addColorStop(0.5, '#9900ff');
            explosionGradient.addColorStop(1, 'transparent');
            ctx.fillStyle = explosionGradient;
            ctx.beginPath();
            ctx.arc(targetX, targetY, explosionSize, 0, Math.PI * 2);
            ctx.fill();

            // 충격파 링
            ctx.globalAlpha = (1 - impactProgress) * 0.7;
            ctx.strokeStyle = '#cc00ff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(targetX, targetY, explosionSize * 1.2, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }
      break;

    case 'inferno_burn':
      // 대마법사 W 스킬 - 화상 지속 효과 (바닥에 불타는 영역)
      {
        const radius = effect.radius || 120;
        const flickerSpeed = 8;

        // 불타는 바닥 범위
        ctx.globalAlpha = (1 - progress * 0.3) * 0.6;
        const burnGradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, radius);
        burnGradient.addColorStop(0, '#ff6600');
        burnGradient.addColorStop(0.3, '#ff4400aa');
        burnGradient.addColorStop(0.6, '#ff220066');
        burnGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = burnGradient;
        ctx.beginPath();
        ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
        ctx.fill();

        // 불꽃 파티클 (여러 개가 올라가는 효과)
        const flameCount = 16;
        for (let i = 0; i < flameCount; i++) {
          const angle = (i / flameCount) * Math.PI * 2;
          const distOffset = Math.sin(gameTime * flickerSpeed + i * 0.5) * 20;
          const dist = radius * 0.6 + distOffset;
          const flameX = screenX + Math.cos(angle) * dist;
          const flameY = screenY + Math.sin(angle) * dist;

          // 불꽃 올라가는 효과
          const flameRise = (gameTime * 2 + i * 0.3) % 1;
          const flameHeight = 30 * flameRise;
          const flameAlpha = (1 - flameRise) * 0.8 * (1 - progress * 0.5);

          // 불꽃 그리기
          ctx.globalAlpha = flameAlpha;
          const flameGradient = ctx.createLinearGradient(flameX, flameY, flameX, flameY - flameHeight - 20);
          flameGradient.addColorStop(0, '#ff8800');
          flameGradient.addColorStop(0.5, '#ff4400');
          flameGradient.addColorStop(1, 'transparent');
          ctx.fillStyle = flameGradient;

          // 불꽃 모양 (삼각형 느낌)
          ctx.beginPath();
          ctx.moveTo(flameX - 6, flameY);
          ctx.quadraticCurveTo(flameX - 3, flameY - flameHeight * 0.5, flameX, flameY - flameHeight - 15);
          ctx.quadraticCurveTo(flameX + 3, flameY - flameHeight * 0.5, flameX + 6, flameY);
          ctx.closePath();
          ctx.fill();
        }

        // 중앙 화염 코어
        ctx.globalAlpha = (1 - progress * 0.4) * 0.5;
        const coreSize = 40 + Math.sin(gameTime * flickerSpeed) * 10;
        const coreGradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, coreSize);
        coreGradient.addColorStop(0, '#ffcc00');
        coreGradient.addColorStop(0.5, '#ff880080');
        coreGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = coreGradient;
        ctx.beginPath();
        ctx.arc(screenX, screenY, coreSize, 0, Math.PI * 2);
        ctx.fill();

        // 바깥쪽 깜빡이는 링
        ctx.globalAlpha = (1 - progress * 0.5) * (0.4 + Math.sin(gameTime * flickerSpeed * 2) * 0.2);
        ctx.strokeStyle = '#ff4400';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      break;

    case 'spring_of_life':
      // 힐러 - 생명의 샘 (지속 힐)
      {
        const radius = effect.radius || 500;

        // 생명의 샘 범위
        ctx.globalAlpha = (1 - progress * 0.3) * 0.4;
        const lifeGradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, radius);
        lifeGradient.addColorStop(0, '#00ff0040');
        lifeGradient.addColorStop(0.5, '#22c55e30');
        lifeGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = lifeGradient;
        ctx.beginPath();
        ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
        ctx.fill();

        // 힐 파동
        const waveCount = 3;
        for (let i = 0; i < waveCount; i++) {
          const waveProgress = (progress + i / waveCount) % 1;
          ctx.globalAlpha = (1 - waveProgress) * 0.6;
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(screenX, screenY, radius * waveProgress, 0, Math.PI * 2);
          ctx.stroke();
        }

        // 힐 파티클
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2 + progress * 2;
          const dist = radius * 0.5;
          const yOffset = -Math.sin(progress * 3 + i) * 20;
          ctx.globalAlpha = (1 - progress * 0.5) * 0.8;
          ctx.fillStyle = '#86efac';
          ctx.font = '14px Arial';
          ctx.fillText('+', screenX + Math.cos(angle) * dist, screenY + Math.sin(angle) * dist + yOffset);
        }
      }
      break;
  }

  ctx.restore();
}

/**
 * 영웅 기본 공격 사거리 표시
 * 직업별 기본 사거리 (config.range)를 표시
 */
export function drawHeroAttackRange(
  ctx: CanvasRenderingContext2D,
  hero: HeroUnit,
  camera: Camera
) {
  const screenX = hero.x - camera.x;
  const screenY = hero.y - camera.y;
  // 직업별 기본 공격 사거리
  const attackRange = hero.config.range || 80;

  ctx.save();

  // 외곽 원 (공격 가능 범위)
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 4]);
  ctx.beginPath();
  ctx.arc(screenX, screenY, attackRange, 0, Math.PI * 2);
  ctx.stroke();

  // 내부 채우기 (반투명)
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = '#ffd700';
  ctx.beginPath();
  ctx.arc(screenX, screenY, attackRange, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * 스킬 사거리 표시 (호버 시)
 */
export function drawSkillRange(
  ctx: CanvasRenderingContext2D,
  hero: HeroUnit,
  camera: Camera,
  skillRange: {
    type: 'circle' | 'line' | 'aoe' | null;
    range: number;
    radius?: number;
  },
  _mousePosition: { x: number; y: number }
) {
  const screenX = hero.x - camera.x;
  const screenY = hero.y - camera.y;

  ctx.save();

  if (skillRange.type === 'aoe') {
    // AoE 전용 - 캐릭터가 바라보는 방향 앞 100px에 범위 표시
    if (skillRange.radius) {
      const angle = hero.facingAngle;
      const aoeX = screenX + Math.cos(angle) * 100;
      const aoeY = screenY + Math.sin(angle) * 100;

      // AoE 범위 외곽
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#ff6600';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(aoeX, aoeY, skillRange.radius, 0, Math.PI * 2);
      ctx.stroke();

      // AoE 범위 내부 채우기
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = '#ff6600';
      ctx.beginPath();
      ctx.arc(aoeX, aoeY, skillRange.radius, 0, Math.PI * 2);
      ctx.fill();

      // 중심 표시
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#ff6600';
      ctx.beginPath();
      ctx.arc(aoeX, aoeY, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (skillRange.type === 'circle') {
    // 원형 사거리 (기본 공격, 범위 스킬)
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.arc(screenX, screenY, skillRange.range, 0, Math.PI * 2);
    ctx.stroke();

    // 내부 채우기
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = '#00ffff';
    ctx.beginPath();
    ctx.arc(screenX, screenY, skillRange.range, 0, Math.PI * 2);
    ctx.fill();

    // AoE 반경 표시 (캐릭터 전방 100px)
    if (skillRange.radius) {
      const angle = hero.facingAngle;
      const aoeX = screenX + Math.cos(angle) * 100;
      const aoeY = screenY + Math.sin(angle) * 100;

      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = '#ff6600';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.arc(aoeX, aoeY, skillRange.radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = 0.1;
      ctx.fillStyle = '#ff6600';
      ctx.beginPath();
      ctx.arc(aoeX, aoeY, skillRange.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (skillRange.type === 'line') {
    // 직선 사거리 (돌진, 관통)
    // 캐릭터의 이동 방향(facingAngle)으로 표시
    const angle = hero.facingAngle;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    const endX = screenX + dirX * skillRange.range;
    const endY = screenY + dirY * skillRange.range;

    // 돌진 경로 표시
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 40;
    ctx.lineCap = 'round';
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(screenX, screenY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    // 경로 내부 (반투명)
    ctx.globalAlpha = 0.15;
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 36;
    ctx.beginPath();
    ctx.moveTo(screenX, screenY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    // 화살표 표시
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#00ffff';
    const arrowSize = 15;
    ctx.save();
    ctx.translate(endX, endY);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(arrowSize, 0);
    ctx.lineTo(-5, -arrowSize);
    ctx.lineTo(-5, arrowSize);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

/**
 * 궁수 화살 그리기 헬퍼
 * @param colors - 전직 직업별 색상 (옵션)
 */
function drawArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  startX: number,
  startY: number,
  colors?: AdvancedClassColors
) {
  // 기본 색상 (전직이 없을 때)
  const arrowColor = colors?.primary || '#22c55e';
  const trailColor = colors?.secondary || '#4ade80';

  // 화살 본체
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // 화살대 (나무색)
  ctx.strokeStyle = '#8B4513';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-25, 0);
  ctx.lineTo(5, 0);
  ctx.stroke();

  // 화살촉 (전직별 색상)
  ctx.fillStyle = arrowColor;
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(2, -4);
  ctx.lineTo(4, 0);
  ctx.lineTo(2, 4);
  ctx.closePath();
  ctx.fill();

  // 깃털 (뒤쪽) - 전직별 보조 색상
  ctx.fillStyle = trailColor;
  ctx.beginPath();
  ctx.moveTo(-25, 0);
  ctx.lineTo(-18, -5);
  ctx.lineTo(-16, 0);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-25, 0);
  ctx.lineTo(-18, 5);
  ctx.lineTo(-16, 0);
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  // 잔상 - 전직별 색상
  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = arrowColor;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.setLineDash([]);
}

/**
 * 궁수 화살 피격 이펙트 헬퍼
 * @param colors - 전직 직업별 색상 (옵션)
 */
function drawArrowImpact(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  progress: number,
  colors?: AdvancedClassColors
) {
  // 기본 색상 (전직이 없을 때)
  const impactColor = colors?.impact || '#22c55e';
  const sparkColor = colors?.secondary || '#4ade80';

  // 피격 충격파
  ctx.globalAlpha = (1 - progress) * 0.7;
  ctx.strokeStyle = impactColor;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, 15 + progress * 20, 0, Math.PI * 2);
  ctx.stroke();

  // 피격 스파크
  ctx.globalAlpha = (1 - progress) * 0.8;
  for (let i = 0; i < 4; i++) {
    const sparkAngle = (i / 4) * Math.PI * 2 + progress * Math.PI;
    const sparkDist = 10 + progress * 15;
    const sparkX = x + Math.cos(sparkAngle) * sparkDist;
    const sparkY = y + Math.sin(sparkAngle) * sparkDist;

    ctx.fillStyle = i % 2 === 0 ? impactColor : sparkColor;
    ctx.beginPath();
    ctx.arc(sparkX, sparkY, 3 * (1 - progress), 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * 마법사 마법 볼트 그리기 헬퍼
 * @param colors - 전직 직업별 색상 (옵션)
 */
function drawMagicBolt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  startX: number,
  startY: number,
  colors?: AdvancedClassColors
) {
  // 기본 색상 (전직이 없을 때)
  const boltColor = colors?.primary || '#a855f7';
  const tailColor = colors?.secondary || '#c084fc';

  // 마법 볼트 본체
  ctx.globalAlpha = 0.9;
  const boltGradient = ctx.createRadialGradient(x, y, 0, x, y, 15);
  boltGradient.addColorStop(0, '#ffffff');
  boltGradient.addColorStop(0.4, boltColor);
  boltGradient.addColorStop(1, boltColor + '80');
  ctx.fillStyle = boltGradient;
  ctx.beginPath();
  ctx.arc(x, y, 12, 0, Math.PI * 2);
  ctx.fill();

  // 마법 꼬리 - 전직별 색상
  ctx.globalAlpha = 0.6;
  for (let i = 1; i <= 5; i++) {
    const tailX = x - Math.cos(angle) * i * 8;
    const tailY = y - Math.sin(angle) * i * 8;
    const tailSize = 10 - i * 1.5;

    ctx.globalAlpha = 0.5 - i * 0.08;
    ctx.fillStyle = tailColor;
    ctx.beginPath();
    ctx.arc(tailX, tailY, tailSize, 0, Math.PI * 2);
    ctx.fill();
  }

  // 잔상 - 전직별 색상
  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = boltColor;
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 4]);
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.setLineDash([]);
}

/**
 * 마법사 마법 피격 이펙트 헬퍼
 * @param colors - 전직 직업별 색상 (옵션)
 */
function drawMagicImpact(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  progress: number,
  colors?: AdvancedClassColors
) {
  // 기본 색상 (전직이 없을 때)
  const impactColor = colors?.impact || '#a855f7';
  const sparkColor = colors?.secondary || '#c084fc';

  // 마법 폭발
  ctx.globalAlpha = (1 - progress) * 0.8;
  const explodeGradient = ctx.createRadialGradient(
    x, y, 0,
    x, y, 25 * (0.5 + progress)
  );
  explodeGradient.addColorStop(0, '#ffffff');
  explodeGradient.addColorStop(0.3, impactColor);
  explodeGradient.addColorStop(1, 'transparent');
  ctx.fillStyle = explodeGradient;
  ctx.beginPath();
  ctx.arc(x, y, 25 * (0.5 + progress), 0, Math.PI * 2);
  ctx.fill();

  // 마법 파편 - 전직별 색상
  ctx.globalAlpha = (1 - progress) * 0.7;
  for (let i = 0; i < 6; i++) {
    const sparkAngle = (i / 6) * Math.PI * 2 + progress * Math.PI;
    const sparkDist = 15 + progress * 20;
    const sparkX = x + Math.cos(sparkAngle) * sparkDist;
    const sparkY = y + Math.sin(sparkAngle) * sparkDist;

    ctx.fillStyle = i % 2 === 0 ? impactColor : sparkColor;
    ctx.beginPath();
    ctx.arc(sparkX, sparkY, 4 * (1 - progress), 0, Math.PI * 2);
    ctx.fill();
  }
}
