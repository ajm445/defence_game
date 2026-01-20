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
  canvasHeight: number
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

  ctx.save();

  // 버프 이펙트 (광전사)
  if (hasBerserker) {
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 30;

    // 붉은 오라
    const berserkerGradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, 50);
    berserkerGradient.addColorStop(0, '#ff000060');
    berserkerGradient.addColorStop(0.5, '#ff000030');
    berserkerGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = berserkerGradient;
    ctx.beginPath();
    ctx.arc(screenX, screenY, 50, 0, Math.PI * 2);
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
      // 돌진 이펙트 - 잔상
      ctx.globalAlpha = 1 - progress;
      ctx.strokeStyle = effect.type === 'knight_charge' ? '#3b82f6' : '#ffd700';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 5]);
      if (effect.direction) {
        ctx.beginPath();
        ctx.moveTo(screenX, screenY);
        ctx.lineTo(
          screenX + effect.direction.x * (effect.radius || 200) * progress,
          screenY + effect.direction.y * (effect.radius || 200) * progress
        );
        ctx.stroke();
      }
      ctx.setLineDash([]);
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
      // 광전사 버프 이펙트 - 붉은 오라 폭발
      ctx.globalAlpha = 1 - progress;
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(screenX, screenY, 50 * progress, 0, Math.PI * 2);
      ctx.stroke();

      // 내부 불꽃
      ctx.globalAlpha = (1 - progress) * 0.5;
      const berserkerGradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, 40 * progress);
      berserkerGradient.addColorStop(0, '#ff660080');
      berserkerGradient.addColorStop(1, '#ff000040');
      ctx.fillStyle = berserkerGradient;
      ctx.beginPath();
      ctx.arc(screenX, screenY, 40 * progress, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'archer_pierce':
      // 관통 화살 이펙트 - 직선 궤적
      ctx.globalAlpha = 1 - progress;
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 4;
      if (effect.direction) {
        ctx.beginPath();
        ctx.moveTo(screenX, screenY);
        ctx.lineTo(
          screenX + effect.direction.x * (effect.radius || 300),
          screenY + effect.direction.y * (effect.radius || 300)
        );
        ctx.stroke();

        // 화살촉 모양
        const arrowLength = (effect.radius || 300) * (1 - progress);
        const arrowX = screenX + effect.direction.x * arrowLength;
        const arrowY = screenY + effect.direction.y * arrowLength;
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(arrowX, arrowY, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      break;

    case 'archer_rain':
      // 화살 비 이펙트 - 원형 범위 + 화살 표시
      ctx.globalAlpha = 1 - progress;

      // 범위 표시
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(screenX, screenY, effect.radius || 150, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // 화살 표시
      ctx.fillStyle = '#22c55e';
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const dist = ((effect.radius || 150) * 0.7) * Math.random();
        const ax = screenX + Math.cos(angle) * dist;
        const ay = screenY + Math.sin(angle) * dist - 30 * (1 - progress);

        ctx.globalAlpha = (1 - progress) * Math.random();
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax, ay + 15);
        ctx.stroke();
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
 * 영웅 공격 범위 표시
 */
export function drawHeroAttackRange(
  ctx: CanvasRenderingContext2D,
  hero: HeroUnit,
  camera: Camera
) {
  const screenX = hero.x - camera.x;
  const screenY = hero.y - camera.y;
  const range = hero.config.range || 80;

  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.arc(screenX, screenY, range, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}
