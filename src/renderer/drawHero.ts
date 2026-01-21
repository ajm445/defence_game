import { HeroUnit, RPGEnemy, SkillEffect, HeroClass } from '../types/rpg';
import { Camera, UnitType } from '../types';
import { drawEmoji } from '../utils/canvasEmoji';
import { drawUnitImage } from '../utils/unitImages';

// 직업별 이미지 매핑 및 색상 설정
const CLASS_VISUALS: Record<HeroClass, { unitType: UnitType; emoji: string; color: string; glowColor: string }> = {
  warrior: { unitType: 'melee', emoji: '⚔️', color: '#ff6b35', glowColor: '#ff6b35' },
  archer: { unitType: 'ranged', emoji: '🏹', color: '#22c55e', glowColor: '#22c55e' },
  knight: { unitType: 'knight', emoji: '🛡️', color: '#3b82f6', glowColor: '#3b82f6' },
  mage: { unitType: 'mage', emoji: '🔮', color: '#a855f7', glowColor: '#a855f7' },
};

/**
 * 영웅 유닛 렌더링
 */
export function drawHero(
  ctx: CanvasRenderingContext2D,
  hero: HeroUnit,
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number,
  gameTime: number = 0
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

  // 직업별 비주얼 가져오기
  const classVisual = CLASS_VISUALS[hero.heroClass] || CLASS_VISUALS.warrior;

  // 버프 상태 확인
  const hasBerserker = hero.buffs?.some(b => b.type === 'berserker' && b.duration > 0);
  const hasIronwall = hero.buffs?.some(b => b.type === 'ironwall' && b.duration > 0);
  const hasInvincible = hero.buffs?.some(b => b.type === 'invincible' && b.duration > 0);

  ctx.save();

  // 버프 이펙트 (광전사) - 불타오르는 불꽃 효과
  if (hasBerserker) {
    const time = gameTime * 3; // 애니메이션 속도

    // 베이스 글로우 (열기)
    ctx.shadowColor = '#ff4400';
    ctx.shadowBlur = 25;

    const heatGradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, 45);
    heatGradient.addColorStop(0, 'rgba(255, 80, 0, 0.35)');
    heatGradient.addColorStop(0.6, 'rgba(255, 40, 0, 0.15)');
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
        outerGradient.addColorStop(0, `rgba(255, ${180 - colorProgress * 100}, 0, 0.9)`);
        outerGradient.addColorStop(0.4, `rgba(255, ${100 - colorProgress * 50}, 0, 0.6)`);
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
          coreGradient.addColorStop(0, 'rgba(255, 255, 200, 0.9)');
          coreGradient.addColorStop(0.5, 'rgba(255, 200, 50, 0.5)');
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
        ctx.fillStyle = i % 3 === 0 ? '#ffff80' : (i % 3 === 1 ? '#ffaa00' : '#ff6600');
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

  // 영웅 글로우 효과 (직업별 색상)
  const glowColor = hasBerserker ? '#ff0000' : (hasIronwall ? '#4a90d9' : classVisual.glowColor);
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 20;

  // 외부 오라 (직업별 색상)
  const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, 40);
  gradient.addColorStop(0, classVisual.color + '60');
  gradient.addColorStop(0.5, classVisual.color + '20');
  gradient.addColorStop(1, 'transparent');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(screenX, screenY, 40, 0, Math.PI * 2);
  ctx.fill();

  // 메인 원
  ctx.fillStyle = '#1a1a35';
  ctx.strokeStyle = classVisual.color;
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.arc(screenX, screenY, 25, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();

  // 영웅 아이콘 (직업별 이미지, 없으면 이모지 폴백)
  // 원본 이미지가 왼쪽을 바라보므로, 오른쪽을 바라볼 때 flip
  const flipHero = hero.facingRight;
  const imageDrawn = drawUnitImage(ctx, classVisual.unitType, screenX, screenY, 30, flipHero, 40);
  if (!imageDrawn) {
    drawEmoji(ctx, classVisual.emoji, screenX, screenY, 28);
  }

  // 레벨 배지
  ctx.fillStyle = '#1a1a35';
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(screenX + 25, screenY - 20, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.font = 'bold 12px Arial';
  ctx.fillStyle = '#ffd700';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${hero.level}`, screenX + 25, screenY - 20);

  // 체력바 배경
  const hpBarWidth = 50;
  const hpBarHeight = 6;
  const hpPercent = hero.hp / hero.maxHp;

  ctx.fillStyle = '#1a1a25';
  ctx.beginPath();
  ctx.roundRect(screenX - hpBarWidth / 2, screenY - 45, hpBarWidth, hpBarHeight, 3);
  ctx.fill();

  // 체력바
  const hpColor = hpPercent > 0.5 ? '#10b981' : hpPercent > 0.25 ? '#f59e0b' : '#ef4444';
  ctx.fillStyle = hpColor;
  ctx.beginPath();
  ctx.roundRect(
    screenX - hpBarWidth / 2 + 1,
    screenY - 44,
    (hpBarWidth - 2) * hpPercent,
    hpBarHeight - 2,
    2
  );
  ctx.fill();

  // 경험치바 배경
  const expBarWidth = 50;
  const expBarHeight = 3;
  const expPercent = hero.exp / hero.expToNextLevel;

  ctx.fillStyle = '#1a1a25';
  ctx.beginPath();
  ctx.roundRect(screenX - expBarWidth / 2, screenY - 37, expBarWidth, expBarHeight, 2);
  ctx.fill();

  // 경험치바 (파란색)
  ctx.fillStyle = '#3b82f6';
  ctx.beginPath();
  ctx.roundRect(
    screenX - expBarWidth / 2 + 1,
    screenY - 36,
    (expBarWidth - 2) * Math.min(1, expPercent),
    expBarHeight - 2,
    1
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
}

/**
 * RPG 적 유닛 렌더링
 */
export function drawRPGEnemy(
  ctx: CanvasRenderingContext2D,
  enemy: RPGEnemy,
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number,
  isTarget: boolean = false,
  heroPosition?: { x: number; y: number }
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
  const unitScale = isBoss ? 2.5 : 1;
  const baseRadius = isBoss ? 44 : 22;
  const mainRadius = isBoss ? 34 : 17;

  // 타겟 글로우
  if (isTarget) {
    ctx.shadowColor = '#ff6600';
    ctx.shadowBlur = 20;
  }

  // 보스 글로우
  if (isBoss) {
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 30;
  }

  // 외부 원
  const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, baseRadius);
  gradient.addColorStop(0, (isBoss ? '#ff0000' : '#ef4444') + '40');
  gradient.addColorStop(1, 'transparent');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(screenX, screenY, baseRadius, 0, Math.PI * 2);
  ctx.fill();

  // 메인 원
  ctx.fillStyle = isBoss ? '#2a0a0a' : '#1a1a25';
  ctx.strokeStyle = isTarget ? '#ff6600' : (isBoss ? '#ff0000' : '#ef4444');
  ctx.lineWidth = isTarget ? 3 : (isBoss ? 4 : 2);

  ctx.beginPath();
  ctx.arc(screenX, screenY, mainRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();

  // 유닛 아이콘 (이미지 우선, 없으면 이모지 폴백)
  const EMOJI_MAP: Record<string, string> = {
    melee: '⚔️',
    ranged: '🏹',
    knight: '🛡️',
    mage: '🔮',
    boss: '👹',
  };
  const iconSize = isBoss ? 60 : 30;
  const iconHeight = isBoss ? 80 : 40;
  const emojiSize = isBoss ? 40 : 20;

  // 적이 영웅을 바라보도록 flip (원본 이미지가 왼쪽을 바라봄)
  // 영웅이 오른쪽에 있으면 flip하여 오른쪽을 바라봄
  const flipEnemy = heroPosition ? heroPosition.x > enemy.x : false;
  const enemyImageDrawn = drawUnitImage(ctx, enemy.type as UnitType, screenX, screenY, iconSize, flipEnemy, iconHeight);
  if (!enemyImageDrawn) {
    const emoji = EMOJI_MAP[enemy.type] || '👾';
    drawEmoji(ctx, emoji, screenX, screenY, emojiSize);
  }

  // 체력바
  const hpBarWidth = isBoss ? 80 : 26;
  const hpBarHeight = isBoss ? 8 : 4;
  const hpBarY = isBoss ? -60 : -35;
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
  if (isBoss) {
    ctx.font = 'bold 12px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.floor(enemy.hp)} / ${enemy.maxHp}`, screenX, screenY + hpBarY - 5);
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
  const progress = Math.min(1, elapsed / effect.duration);

  ctx.save();

  switch (effect.type) {
    case 'dash':
    case 'warrior_charge':
    case 'knight_charge':
      // 돌진 이펙트 - 전사용 강화된 모션
      if (effect.direction) {
        const distance = effect.radius || 200;
        const isWarrior = effect.type === 'warrior_charge';
        const isKnight = effect.type === 'knight_charge';
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
    case 'knight_ironwall':
      // 힐/방어 이펙트 - 상승하는 파티클
      ctx.globalAlpha = 1 - progress;
      const healColor = effect.type === 'knight_ironwall' ? '#4a90d9' : '#10b981';
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
            ctx.strokeStyle = '#22c55e';
            ctx.lineWidth = 3 - i * 0.3;
            ctx.beginPath();
            ctx.moveTo(trailX - effect.direction.x * 20, trailY - effect.direction.y * 20);
            ctx.lineTo(trailX, trailY);
            ctx.stroke();
          }

          // 에너지 파동 (화살 주변)
          ctx.globalAlpha = 0.3;
          ctx.strokeStyle = '#4ade80';
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

          // 화살촉 (금속색 + 녹색 에너지)
          ctx.fillStyle = '#22c55e';
          ctx.beginPath();
          ctx.moveTo(15, 0);
          ctx.lineTo(0, -5);
          ctx.lineTo(3, 0);
          ctx.lineTo(0, 5);
          ctx.closePath();
          ctx.fill();

          // 화살촉 광택
          ctx.fillStyle = '#4ade80';
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
          ctx.shadowColor = '#22c55e';
          ctx.shadowBlur = 15;
          ctx.strokeStyle = '#22c55e';
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
          ctx.strokeStyle = '#22c55e40';
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
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.beginPath();
        ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // 범위 내부 채우기
        ctx.globalAlpha = 0.1 * (1 - progress * 0.5);
        ctx.fillStyle = '#22c55e';
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
            ctx.fillStyle = '#22c55e';
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
            ctx.strokeStyle = '#22c55e';
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
              ctx.strokeStyle = '#22c55e';
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

    case 'mage_fireball':
      // 화염구 이펙트 - 폭발하는 원
      ctx.globalAlpha = 1 - progress;

      // 외부 폭발
      const fireGradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, (effect.radius || 100) * progress);
      fireGradient.addColorStop(0, '#ff6600');
      fireGradient.addColorStop(0.5, '#ff330080');
      fireGradient.addColorStop(1, '#ff000020');
      ctx.fillStyle = fireGradient;
      ctx.beginPath();
      ctx.arc(screenX, screenY, (effect.radius || 100) * progress, 0, Math.PI * 2);
      ctx.fill();

      // 외곽선
      ctx.strokeStyle = '#ff6600';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(screenX, screenY, (effect.radius || 100) * progress, 0, Math.PI * 2);
      ctx.stroke();
      break;

    case 'mage_meteor':
      // 운석 이펙트 - 대형 폭발
      ctx.globalAlpha = 1 - progress;

      // 충격파
      ctx.strokeStyle = '#ff4400';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(screenX, screenY, (effect.radius || 200) * progress, 0, Math.PI * 2);
      ctx.stroke();

      // 내부 폭발
      const meteorGradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, (effect.radius || 200) * progress * 0.8);
      meteorGradient.addColorStop(0, '#ffffff');
      meteorGradient.addColorStop(0.2, '#ff8800');
      meteorGradient.addColorStop(0.5, '#ff440080');
      meteorGradient.addColorStop(1, 'transparent');
      ctx.fillStyle = meteorGradient;
      ctx.beginPath();
      ctx.arc(screenX, screenY, (effect.radius || 200) * progress * 0.8, 0, Math.PI * 2);
      ctx.fill();

      // 파편
      ctx.fillStyle = '#ff6600';
      for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * Math.PI * 2;
        const dist = (effect.radius || 200) * progress * 0.9;
        const px = screenX + Math.cos(angle) * dist;
        const py = screenY + Math.sin(angle) * dist;

        ctx.beginPath();
        ctx.arc(px, py, 4 * (1 - progress), 0, Math.PI * 2);
        ctx.fill();
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
  mousePosition: { x: number; y: number }
) {
  const screenX = hero.x - camera.x;
  const screenY = hero.y - camera.y;

  ctx.save();

  if (skillRange.type === 'aoe') {
    // AoE 전용 (무제한 사거리 스킬 - 마우스 위치에 범위만 표시)
    if (skillRange.radius) {
      const mouseScreenX = mousePosition.x - camera.x;
      const mouseScreenY = mousePosition.y - camera.y;

      // AoE 범위 외곽
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#ff6600';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(mouseScreenX, mouseScreenY, skillRange.radius, 0, Math.PI * 2);
      ctx.stroke();

      // AoE 범위 내부 채우기
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = '#ff6600';
      ctx.beginPath();
      ctx.arc(mouseScreenX, mouseScreenY, skillRange.radius, 0, Math.PI * 2);
      ctx.fill();

      // 중심 표시
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#ff6600';
      ctx.beginPath();
      ctx.arc(mouseScreenX, mouseScreenY, 5, 0, Math.PI * 2);
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

    // AoE 반경 표시 (마우스 위치에)
    if (skillRange.radius) {
      const mouseScreenX = mousePosition.x - camera.x;
      const mouseScreenY = mousePosition.y - camera.y;

      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = '#ff6600';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.arc(mouseScreenX, mouseScreenY, skillRange.radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = 0.1;
      ctx.fillStyle = '#ff6600';
      ctx.beginPath();
      ctx.arc(mouseScreenX, mouseScreenY, skillRange.radius, 0, Math.PI * 2);
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
