import React, { useEffect, useRef, useCallback } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { useRPGCoopStore, useCoopHeroes, useCoopEnemies } from '../../stores/useRPGCoopStore';
import { getCameraPosition, getHeroRenderPosition } from '../../hooks/useRPGCoopGameLoop';
import { useRPGCoopInput } from '../../hooks/useRPGCoopInput';
import { effectManager } from '../../effects';
import { RPG_CONFIG, CLASS_CONFIGS } from '../../constants/rpgConfig';
import { drawGrid } from '../../renderer/drawGrid';
import { drawEmoji } from '../../utils/canvasEmoji';
import { drawUnitImage } from '../../utils/unitImages';
import { drawRPGMinimap, getMinimapConfig } from '../../renderer/drawRPGMinimap';
import { drawSkillEffect as drawSkillEffectSP } from '../../renderer/drawHero';
import { NEXUS_CONFIG, ENEMY_BASE_CONFIG } from '../../constants/rpgConfig';
import type { NetworkCoopHero, NetworkCoopEnemy, RPGCoopGameState } from '@shared/types/rpgNetwork';
import type { Nexus, EnemyBase } from '../../types/rpg';
import type { HeroClass, Buff } from '../../types/rpg';
import type { UnitType } from '../../types/unit';

// 직업별 이미지 매핑 및 색상 설정
const CLASS_VISUALS: Record<HeroClass, { unitType: UnitType; emoji: string; color: string; glowColor: string }> = {
  warrior: { unitType: 'melee', emoji: '⚔️', color: '#ff6b35', glowColor: '#ff6b35' },
  archer: { unitType: 'ranged', emoji: '🏹', color: '#22c55e', glowColor: '#22c55e' },
  knight: { unitType: 'knight', emoji: '🛡️', color: '#3b82f6', glowColor: '#3b82f6' },
  mage: { unitType: 'mage', emoji: '🔮', color: '#a855f7', glowColor: '#a855f7' },
};

export const RPGCoopCanvas: React.FC = () => {
  const { canvasRef, dimensions, getContext } = useCanvas();
  const cameraRef = useRef({ x: 1000, y: 1000, zoom: 1 });
  const animationRef = useRef<number>(0);
  const showAttackRangeRef = useRef(false);

  const heroes = useCoopHeroes();
  const enemies = useCoopEnemies();
  const gameState = useRPGCoopStore((state) => state.gameState);
  const myHeroId = useRPGCoopStore((state) => state.myHeroId);

  // 카메라 위치 설정 함수
  const setCameraPosition = useCallback((x: number, y: number) => {
    cameraRef.current.x = x;
    cameraRef.current.y = y;
  }, []);

  // 입력 훅 사용 (우클릭 이동, 휠 드래그, Space 센터링, C 사거리)
  const { mousePosition, showAttackRange } = useRPGCoopInput({
    canvasRef,
    cameraRef,
    setCameraPosition,
  });

  // 스토어에서 hoveredSkill 가져오기 (스킬바 호버 시 설정됨)
  const hoveredSkill = useRPGCoopStore((state) => state.hoveredSkill);
  const storeMousePosition = useRPGCoopStore((state) => state.mousePosition);

  // hoveredSkill 상태를 ref에 동기화 (렌더링용)
  const hoveredSkillRef = useRef<'Q' | 'W' | 'E' | null>(null);
  hoveredSkillRef.current = hoveredSkill;

  // showAttackRange 상태를 ref에 동기화 (렌더링용)
  useEffect(() => {
    showAttackRangeRef.current = showAttackRange;
  }, [showAttackRange]);

  useEffect(() => {
    const ctx = getContext();
    if (!ctx) return;

    const animate = () => {
      // 카메라 위치 업데이트 (입력 훅에서 변경되지 않은 경우에만)
      const cameraPos = getCameraPosition();
      // 부드러운 카메라 추적 (Space 등으로 수동 설정 시 바로 적용)
      const dx = cameraPos.x - cameraRef.current.x;
      const dy = cameraPos.y - cameraRef.current.y;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        cameraRef.current.x += dx * 0.1;
        cameraRef.current.y += dy * 0.1;
      }

      // 렌더링 (showAttackRange, hoveredSkill 포함)
      // hoveredSkill이 있으면 스토어의 마우스 위치 사용 (스킬바 호버 시)
      const mousePos = hoveredSkillRef.current
        ? useRPGCoopStore.getState().mousePosition
        : mousePosition.current;

      renderCoopGame(
        ctx,
        dimensions.width,
        dimensions.height,
        cameraRef.current,
        showAttackRangeRef.current,
        hoveredSkillRef.current,
        mousePos
      );

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [dimensions, getContext]);

  return (
    <canvas
      ref={canvasRef}
      className="block bg-dark-900 cursor-crosshair"
    />
  );
};

// 협동 모드 렌더링 함수
function renderCoopGame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  camera: { x: number; y: number; zoom: number },
  showAttackRange: boolean = false,
  hoveredSkill: 'Q' | 'W' | 'E' | null = null,
  mouseWorldPos?: { x: number; y: number }
) {
  const state = useRPGCoopStore.getState();
  const { gameState, myHeroId } = state;

  if (!gameState) {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);
    return;
  }

  const zoom = camera.zoom;

  // 싱글플레이와 동일한 다크 그린 그라데이션 배경
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#1a2e1a');
  gradient.addColorStop(0.5, '#162016');
  gradient.addColorStop(1, '#0f1a0f');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // 줌 변환 적용
  ctx.save();
  ctx.scale(zoom, zoom);

  const scaledWidth = width / zoom;
  const scaledHeight = height / zoom;

  // 카메라 적용
  const cameraOffset = {
    x: camera.x - scaledWidth / 2,
    y: camera.y - scaledHeight / 2,
    zoom: camera.zoom,
  };

  // 배경 그리드
  drawGrid(ctx, cameraOffset, scaledWidth, scaledHeight);

  // 맵 경계 표시
  drawMapBoundary(ctx, cameraOffset, scaledWidth, scaledHeight);

  // 넥서스 디펜스 엔티티 렌더링
  if (gameState.nexus) {
    drawCoopNexus(ctx, gameState.nexus, cameraOffset, scaledWidth, scaledHeight);
  }

  if (gameState.enemyBases && gameState.enemyBases.length > 0) {
    drawCoopEnemyBases(ctx, gameState.enemyBases, cameraOffset, scaledWidth, scaledHeight);
  }

  // 스킬 이펙트 렌더링 (싱글플레이와 동일한 함수 사용)
  gameState.activeSkillEffects?.forEach(effect => {
    drawSkillEffectSP(ctx, effect as any, cameraOffset, gameState.gameTime);
  });

  // 보류 중인 스킬 범위 표시 (운석 등)
  gameState.pendingSkills?.forEach(skill => {
    drawPendingSkill(ctx, skill, cameraOffset, gameState.gameTime);
  });

  // 적 유닛 렌더링
  const myHero = gameState.heroes.find(h => h.id === myHeroId);
  const heroPos = myHero ? { x: myHero.x, y: myHero.y } : undefined;

  for (const enemy of gameState.enemies) {
    if (enemy.hp > 0) {
      drawCoopEnemy(ctx, enemy, cameraOffset, scaledWidth, scaledHeight, heroPos);
    }
  }

  // 영웅 렌더링
  for (const hero of gameState.heroes) {
    const renderPos = getHeroRenderPosition(hero.id, hero.x, hero.y);
    const isMyHero = hero.id === myHeroId;
    drawCoopHero(ctx, hero, renderPos, cameraOffset, scaledWidth, scaledHeight, gameState.gameTime, isMyHero);
  }

  // 기본 공격 사거리 표시 (C 키)
  if (showAttackRange && myHero && !myHero.isDead) {
    drawHeroAttackRange(ctx, myHero, cameraOffset);
  }

  // 스킬 사거리 표시 (호버 시)
  if (hoveredSkill && myHero && !myHero.isDead && mouseWorldPos) {
    drawSkillRange(ctx, myHero, cameraOffset, hoveredSkill, mouseWorldPos);
  }

  // 파티클 이펙트 렌더링
  effectManager.render(ctx, cameraOffset.x, cameraOffset.y, scaledWidth, scaledHeight);

  // 줌 변환 복원
  ctx.restore();

  // 미니맵 렌더링
  const minimapConfig = getMinimapConfig(width, height);
  drawCoopMinimap(ctx, gameState, minimapConfig, myHeroId);
}

/**
 * 영웅 기본 공격 사거리 표시 (싱글플레이와 동일)
 */
function drawHeroAttackRange(
  ctx: CanvasRenderingContext2D,
  hero: NetworkCoopHero,
  camera: { x: number; y: number }
) {
  const screenX = hero.x - camera.x;
  const screenY = hero.y - camera.y;
  // 직업별 기본 공격 사거리
  const classConfig = CLASS_CONFIGS[hero.heroClass];
  const attackRange = classConfig?.range || 80;

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

  ctx.setLineDash([]);
  ctx.restore();
}

/**
 * 스킬 사거리 표시 (스킬 아이콘 호버 시)
 * 싱글플레이와 동일한 렌더링 방식
 */
function drawSkillRange(
  ctx: CanvasRenderingContext2D,
  hero: NetworkCoopHero,
  camera: { x: number; y: number },
  skillSlot: 'Q' | 'W' | 'E',
  mousePosition: { x: number; y: number }
) {
  const screenX = hero.x - camera.x;
  const screenY = hero.y - camera.y;
  const mouseScreenX = mousePosition.x - camera.x;
  const mouseScreenY = mousePosition.y - camera.y;

  // 직업별 스킬 설정 가져오기
  const skillConfig = getSkillRangeConfig(hero.heroClass, skillSlot);
  if (!skillConfig || !skillConfig.type) return;

  ctx.save();

  if (skillConfig.type === 'aoe') {
    // AoE 전용 (무제한 사거리 스킬 - 마우스 위치에 범위만 표시)
    if (skillConfig.radius) {
      // AoE 범위 외곽
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#ff6600';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(mouseScreenX, mouseScreenY, skillConfig.radius, 0, Math.PI * 2);
      ctx.stroke();

      // AoE 범위 내부 채우기
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = '#ff6600';
      ctx.beginPath();
      ctx.arc(mouseScreenX, mouseScreenY, skillConfig.radius, 0, Math.PI * 2);
      ctx.fill();

      // 중심 표시
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#ff6600';
      ctx.beginPath();
      ctx.arc(mouseScreenX, mouseScreenY, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (skillConfig.type === 'circle') {
    // 원형 사거리 (기본 공격, 범위 스킬)
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.arc(screenX, screenY, skillConfig.range, 0, Math.PI * 2);
    ctx.stroke();

    // 내부 채우기
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = '#00ffff';
    ctx.beginPath();
    ctx.arc(screenX, screenY, skillConfig.range, 0, Math.PI * 2);
    ctx.fill();

    // AoE 반경 표시 (마우스 위치에)
    if (skillConfig.radius) {
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = '#ff6600';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.arc(mouseScreenX, mouseScreenY, skillConfig.radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = 0.1;
      ctx.fillStyle = '#ff6600';
      ctx.beginPath();
      ctx.arc(mouseScreenX, mouseScreenY, skillConfig.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (skillConfig.type === 'line') {
    // 직선 사거리 (돌진, 관통)
    // 마우스 방향으로 표시
    const dx = mousePosition.x - hero.x;
    const dy = mousePosition.y - hero.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const dirX = dist > 0 ? dx / dist : 1;
    const dirY = dist > 0 ? dy / dist : 0;
    const endX = screenX + dirX * skillConfig.range;
    const endY = screenY + dirY * skillConfig.range;

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

    // 내부 경로
    ctx.globalAlpha = 0.15;
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 36;
    ctx.beginPath();
    ctx.moveTo(screenX, screenY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    // 방향 화살표
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#00ffff';
    const arrowSize = 15;
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - arrowSize * dirX + arrowSize * 0.5 * dirY, endY - arrowSize * dirY - arrowSize * 0.5 * dirX);
    ctx.lineTo(endX - arrowSize * dirX - arrowSize * 0.5 * dirY, endY - arrowSize * dirY + arrowSize * 0.5 * dirX);
    ctx.closePath();
    ctx.fill();
  } else if (skillConfig.type === 'self') {
    // 셀프 버프 스킬 (자신에게 효과)
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = '#22cc22';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.arc(screenX, screenY, 40, 0, Math.PI * 2);
    ctx.stroke();

    // 내부 채우기
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#22cc22';
    ctx.beginPath();
    ctx.arc(screenX, screenY, 40, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.setLineDash([]);
  ctx.restore();
}

/**
 * 직업별 스킬 사거리 설정
 */
function getSkillRangeConfig(
  heroClass: HeroClass,
  slot: 'Q' | 'W' | 'E'
): { type: 'circle' | 'line' | 'aoe' | 'self' | null; range: number; radius?: number } {
  const classConfig = CLASS_CONFIGS[heroClass];
  const baseRange = classConfig?.range || 80;

  const skillRanges: Record<HeroClass, Record<'Q' | 'W' | 'E', { type: 'circle' | 'line' | 'aoe' | 'self' | null; range: number; radius?: number }>> = {
    warrior: {
      Q: { type: 'circle', range: baseRange },
      W: { type: 'line', range: 200 },
      E: { type: 'self', range: 0 },
    },
    archer: {
      Q: { type: 'circle', range: CLASS_CONFIGS.archer?.range || 250 },
      W: { type: 'line', range: 300 },
      E: { type: 'aoe', range: 0, radius: 150 },
    },
    knight: {
      Q: { type: 'circle', range: baseRange },
      W: { type: 'line', range: 150 },
      E: { type: 'self', range: 0 },
    },
    mage: {
      Q: { type: 'circle', range: CLASS_CONFIGS.mage?.range || 200 },
      W: { type: 'aoe', range: 0, radius: 80 },
      E: { type: 'aoe', range: 0, radius: 150 },
    },
  };

  return skillRanges[heroClass]?.[slot] || { type: null, range: 0 };
}

/**
 * 맵 경계 표시
 */
function drawMapBoundary(
  ctx: CanvasRenderingContext2D,
  camera: { x: number; y: number },
  canvasWidth: number,
  canvasHeight: number
) {
  ctx.save();

  // 맵 영역 외부 어둡게
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';

  // 왼쪽
  if (camera.x < 0) {
    ctx.fillRect(0, 0, -camera.x, canvasHeight);
  }

  // 오른쪽
  const rightEdge = RPG_CONFIG.MAP_WIDTH - camera.x;
  if (rightEdge < canvasWidth) {
    ctx.fillRect(rightEdge, 0, canvasWidth - rightEdge, canvasHeight);
  }

  // 위쪽
  if (camera.y < 0) {
    ctx.fillRect(0, 0, canvasWidth, -camera.y);
  }

  // 아래쪽
  const bottomEdge = RPG_CONFIG.MAP_HEIGHT - camera.y;
  if (bottomEdge < canvasHeight) {
    ctx.fillRect(0, bottomEdge, canvasWidth, canvasHeight - bottomEdge);
  }

  // 맵 경계선
  ctx.strokeStyle = '#ffd70050';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 10]);
  ctx.strokeRect(
    -camera.x,
    -camera.y,
    RPG_CONFIG.MAP_WIDTH,
    RPG_CONFIG.MAP_HEIGHT
  );
  ctx.setLineDash([]);

  ctx.restore();
}

/**
 * 협동 모드 영웅 렌더링 (싱글플레이와 동일한 스타일)
 */
function drawCoopHero(
  ctx: CanvasRenderingContext2D,
  hero: NetworkCoopHero,
  renderPos: { x: number; y: number },
  camera: { x: number; y: number },
  canvasWidth: number,
  canvasHeight: number,
  gameTime: number,
  isMyHero: boolean
) {
  const screenX = renderPos.x - camera.x;
  const screenY = renderPos.y - camera.y;

  // 화면 밖이면 스킵
  if (
    screenX < -50 ||
    screenX > canvasWidth + 50 ||
    screenY < -50 ||
    screenY > canvasHeight + 50
  ) {
    return;
  }

  // 사망 시 반투명
  if (hero.isDead) {
    ctx.globalAlpha = 0.3;
  }

  const classVisual = CLASS_VISUALS[hero.heroClass] || CLASS_VISUALS.warrior;

  // 버프 상태 확인
  const hasBerserker = hero.buffs?.some((b: Buff) => b.type === 'berserker' && b.duration > 0);
  const hasIronwall = hero.buffs?.some((b: Buff) => b.type === 'ironwall' && b.duration > 0);
  const hasInvincible = hero.buffs?.some((b: Buff) => b.type === 'invincible' && b.duration > 0);

  ctx.save();

  // 버프 이펙트 (광전사) - 불타오르는 불꽃 효과 (싱글플레이와 동일)
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

    // 상승하는 불꽃들 (16개)
    const flameCount = 16;
    for (let i = 0; i < flameCount; i++) {
      const seed = i * 1.37;
      const flameTime = (time * (0.8 + (i % 3) * 0.2) + seed) % 1.5;
      const flameProgress = flameTime / 1.5;

      const baseAngle = (i / flameCount) * Math.PI * 2;
      const baseRadius = 28 + Math.sin(seed * 5) * 8;

      const startX = screenX + Math.cos(baseAngle) * baseRadius;
      const startY = screenY + Math.sin(baseAngle) * (baseRadius * 0.3);

      const swayAmount = Math.sin(time * 3 + seed * 2) * 8 * (1 - flameProgress);
      const riseHeight = 60 * flameProgress;

      const flameX = startX + swayAmount;
      const flameY = startY - riseHeight;

      const baseSize = 12 * (1 - flameProgress * 0.7);
      const flameWidth = baseSize * (0.6 + Math.sin(time * 5 + seed) * 0.2);
      const flameHeight = baseSize * (1.5 + Math.sin(time * 4 + seed * 2) * 0.3);

      const colorProgress = flameProgress;
      const alpha = (1 - flameProgress) * 0.85;

      if (alpha > 0.05) {
        ctx.globalAlpha = alpha;

        const outerGradient = ctx.createRadialGradient(
          flameX, flameY + flameHeight * 0.3, 0,
          flameX, flameY - flameHeight * 0.2, flameHeight
        );
        outerGradient.addColorStop(0, `rgba(255, ${180 - colorProgress * 100}, 0, 0.9)`);
        outerGradient.addColorStop(0.4, `rgba(255, ${100 - colorProgress * 50}, 0, 0.6)`);
        outerGradient.addColorStop(1, 'transparent');

        ctx.fillStyle = outerGradient;
        ctx.beginPath();
        ctx.ellipse(flameX, flameY, flameWidth, flameHeight, 0, 0, Math.PI * 2);
        ctx.fill();

        if (flameProgress < 0.6) {
          const coreAlpha = (1 - flameProgress / 0.6) * 0.7;
          ctx.globalAlpha = coreAlpha;
          const coreGradient = ctx.createRadialGradient(
            flameX, flameY + flameHeight * 0.2, 0,
            flameX, flameY, flameHeight * 0.5
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

    // 작은 불똥 파티클 (10개)
    for (let i = 0; i < 10; i++) {
      const sparkSeed = i * 2.71;
      const sparkTime = (time * 2 + sparkSeed) % 1.2;
      const sparkProgress = sparkTime / 1.2;

      const sparkAngle = (sparkSeed * 3) % (Math.PI * 2);
      const sparkRadius = 20 + (sparkSeed % 15);

      const sparkStartX = screenX + Math.cos(sparkAngle) * sparkRadius;
      const sparkStartY = screenY;

      const sparkX = sparkStartX + Math.sin(sparkSeed) * 15 * sparkProgress;
      const sparkY = sparkStartY - 70 * sparkProgress + 20 * sparkProgress * sparkProgress;

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
    ctx.shadowBlur = 0;
  }

  // 버프 이펙트 (무적) - 황금빛 잔상 (싱글플레이와 동일)
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

  // 버프 이펙트 (철벽)
  if (hasIronwall) {
    ctx.strokeStyle = '#4a90d980';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(screenX, screenY, 35, 0, Math.PI * 2);
    ctx.stroke();

    const ironwallGradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, 35);
    ironwallGradient.addColorStop(0, '#4a90d930');
    ironwallGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = ironwallGradient;
    ctx.beginPath();
    ctx.arc(screenX, screenY, 35, 0, Math.PI * 2);
    ctx.fill();
  }

  // 내 영웅 하이라이트
  if (isMyHero && !hero.isDead) {
    ctx.strokeStyle = '#00ffff50';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(screenX, screenY, 45, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 영웅 글로우 효과 (직업별 색상)
  const glowColor = hasBerserker ? '#ff0000' : (hasIronwall ? '#4a90d9' : classVisual.glowColor);
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 20;

  // 외부 오라 (직업별 색상)
  const auraGradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, 40);
  auraGradient.addColorStop(0, classVisual.color + '60');
  auraGradient.addColorStop(0.5, classVisual.color + '20');
  auraGradient.addColorStop(1, 'transparent');
  ctx.fillStyle = auraGradient;
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

  // 영웅 아이콘
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

  // 체력바
  const hpBarWidth = 50;
  const hpBarHeight = 6;
  const hpPercent = hero.hp / hero.maxHp;

  ctx.fillStyle = '#1a1a25';
  ctx.beginPath();
  ctx.roundRect(screenX - hpBarWidth / 2, screenY - 45, hpBarWidth, hpBarHeight, 3);
  ctx.fill();

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

  // 경험치바
  const expBarWidth = 50;
  const expBarHeight = 3;
  const expPercent = hero.exp / hero.expToNextLevel;

  ctx.fillStyle = '#1a1a25';
  ctx.beginPath();
  ctx.roundRect(screenX - expBarWidth / 2, screenY - 37, expBarWidth, expBarHeight, 2);
  ctx.fill();

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

  ctx.globalAlpha = 1;
}

/**
 * 협동 모드 적 렌더링 (싱글플레이와 동일한 스타일)
 */
function drawCoopEnemy(
  ctx: CanvasRenderingContext2D,
  enemy: NetworkCoopEnemy,
  camera: { x: number; y: number },
  canvasWidth: number,
  canvasHeight: number,
  heroPosition?: { x: number; y: number }
) {
  const screenX = enemy.x - camera.x;
  const screenY = enemy.y - camera.y;

  // 화면 밖이면 스킵
  if (
    screenX < -50 ||
    screenX > canvasWidth + 50 ||
    screenY < -50 ||
    screenY > canvasHeight + 50
  ) {
    return;
  }

  ctx.save();

  const isBoss = enemy.type === 'boss';
  const baseRadius = isBoss ? 44 : 22;
  const mainRadius = isBoss ? 34 : 17;

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
  ctx.strokeStyle = isBoss ? '#ff0000' : '#ef4444';
  ctx.lineWidth = isBoss ? 4 : 2;

  ctx.beginPath();
  ctx.arc(screenX, screenY, mainRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();

  // 유닛 아이콘
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

  const hpColor = isBoss ? '#ff3333' : '#ef4444';
  ctx.fillStyle = hpColor;
  ctx.beginPath();
  ctx.roundRect(
    screenX - hpBarWidth / 2 + 1,
    screenY + hpBarY + 1,
    (hpBarWidth - 2) * hpPercent,
    hpBarHeight - 2,
    1
  );
  ctx.fill();

  // 스턴 이펙트 (싱글플레이와 동일)
  const isStunned = enemy.buffs?.some((b: Buff) => b.type === 'stun' && b.duration > 0);
  if (isStunned) {
    ctx.save();

    const time = Date.now() / 1000;
    const starCount = isBoss ? 5 : 3;
    const orbitRadius = isBoss ? 50 : 25;

    for (let i = 0; i < starCount; i++) {
      const angle = (time * 3) + (i * (Math.PI * 2 / starCount));
      const starX = screenX + Math.cos(angle) * orbitRadius;
      const starY = screenY - 20 + Math.sin(angle) * (orbitRadius * 0.4);

      ctx.fillStyle = '#ffd700';
      ctx.font = isBoss ? '16px Arial' : '12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⭐', starX, starY);
    }

    // 기절 텍스트
    ctx.font = 'bold 10px Arial';
    ctx.fillStyle = '#ffd700';
    ctx.textAlign = 'center';
    ctx.fillText('STUN', screenX, screenY - (isBoss ? 75 : 50));

    ctx.restore();
  }
}

/**
 * 스킬 이펙트 렌더링
 */
function drawSkillEffect(
  ctx: CanvasRenderingContext2D,
  effect: { type: string; position: { x: number; y: number }; radius?: number; duration: number },
  camera: { x: number; y: number },
  gameTime: number
) {
  if (!effect.position) return;

  const screenX = effect.position.x - camera.x;
  const screenY = effect.position.y - camera.y;
  const radius = effect.radius || 50;

  // 타입별 색상
  const effectColors: Record<string, { fill: string; stroke: string }> = {
    meteor: { fill: 'rgba(255, 100, 0, 0.3)', stroke: 'rgba(255, 100, 0, 0.8)' },
    arrow_rain: { fill: 'rgba(100, 200, 255, 0.3)', stroke: 'rgba(100, 200, 255, 0.8)' },
    fireball: { fill: 'rgba(255, 150, 0, 0.3)', stroke: 'rgba(255, 150, 0, 0.8)' },
    default: { fill: 'rgba(255, 255, 0, 0.2)', stroke: 'rgba(255, 255, 0, 0.6)' },
  };

  const colors = effectColors[effect.type] || effectColors.default;

  // 펄스 효과
  const pulse = 1 + Math.sin(gameTime * 10) * 0.1;

  ctx.beginPath();
  ctx.arc(screenX, screenY, radius * pulse, 0, Math.PI * 2);
  ctx.fillStyle = colors.fill;
  ctx.fill();
  ctx.strokeStyle = colors.stroke;
  ctx.lineWidth = 3;
  ctx.stroke();
}

/**
 * 보류 중인 스킬 범위 표시 (운석 등)
 */
function drawPendingSkill(
  ctx: CanvasRenderingContext2D,
  skill: { position: { x: number; y: number }; radius: number; triggerTime: number },
  camera: { x: number; y: number },
  gameTime: number
) {
  const timeLeft = skill.triggerTime - gameTime;
  if (timeLeft <= 0) return;

  const screenX = skill.position.x - camera.x;
  const screenY = skill.position.y - camera.y;

  // 경고 원
  ctx.beginPath();
  ctx.arc(screenX, screenY, skill.radius, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 50, 50, ${0.2 + 0.15 * Math.sin(gameTime * 8)})`;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 50, 50, 0.9)';
  ctx.setLineDash([8, 8]);
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.setLineDash([]);

  // 카운트다운
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 4;
  ctx.fillText(Math.ceil(timeLeft).toString(), screenX, screenY);
  ctx.shadowBlur = 0;
}

/**
 * 협동 모드 넥서스 렌더링
 */
function drawCoopNexus(
  ctx: CanvasRenderingContext2D,
  nexus: Nexus,
  camera: { x: number; y: number },
  canvasWidth: number,
  canvasHeight: number
): void {
  const screenX = nexus.x - camera.x;
  const screenY = nexus.y - camera.y;
  const radius = NEXUS_CONFIG.radius;

  // 화면 밖이면 스킵
  if (
    screenX < -radius * 2 ||
    screenX > canvasWidth + radius * 2 ||
    screenY < -radius * 2 ||
    screenY > canvasHeight + radius * 2
  ) {
    return;
  }

  // HP 비율
  const hpPercent = nexus.hp / nexus.maxHp;

  ctx.save();

  // 넥서스 외곽 (파란 글로우)
  const glowGradient = ctx.createRadialGradient(
    screenX, screenY, radius * 0.5,
    screenX, screenY, radius * 1.5
  );
  glowGradient.addColorStop(0, 'rgba(0, 200, 255, 0.5)');
  glowGradient.addColorStop(0.5, 'rgba(0, 150, 255, 0.2)');
  glowGradient.addColorStop(1, 'rgba(0, 100, 255, 0)');

  ctx.beginPath();
  ctx.arc(screenX, screenY, radius * 1.5, 0, Math.PI * 2);
  ctx.fillStyle = glowGradient;
  ctx.fill();

  // 넥서스 본체 (육각형)
  ctx.save();
  ctx.translate(screenX, screenY);

  // 본체 배경
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3 - Math.PI / 2;
    const px = Math.cos(angle) * radius;
    const py = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();

  // 그라디언트 채우기
  const bodyGradient = ctx.createLinearGradient(0, -radius, 0, radius);
  bodyGradient.addColorStop(0, '#00d4ff');
  bodyGradient.addColorStop(0.5, '#0088cc');
  bodyGradient.addColorStop(1, '#005588');

  ctx.fillStyle = bodyGradient;
  ctx.fill();

  // 테두리
  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth = 3;
  ctx.stroke();

  // 중앙 코어
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = hpPercent > 0.5 ? '#00ffff' : hpPercent > 0.25 ? '#ffff00' : '#ff4444';
  ctx.fill();

  ctx.restore();

  // HP 바
  const hpBarWidth = radius * 2;
  const hpBarHeight = 8;
  const hpBarX = screenX - hpBarWidth / 2;
  const hpBarY = screenY + radius + 15;

  // HP 바 배경
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(hpBarX, hpBarY, hpBarWidth, hpBarHeight);

  // HP 바 내용
  const hpColor = hpPercent > 0.5 ? '#00ff00' : hpPercent > 0.25 ? '#ffff00' : '#ff4444';
  ctx.fillStyle = hpColor;
  ctx.fillRect(hpBarX, hpBarY, hpBarWidth * hpPercent, hpBarHeight);

  // HP 바 테두리
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.strokeRect(hpBarX, hpBarY, hpBarWidth, hpBarHeight);

  // HP 텍스트
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.floor(nexus.hp)} / ${nexus.maxHp}`, screenX, hpBarY + hpBarHeight + 12);

  // 라벨
  ctx.fillStyle = '#00ffff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('NEXUS', screenX, screenY - radius - 10);

  ctx.restore();
}

/**
 * 협동 모드 적 기지 렌더링
 */
function drawCoopEnemyBase(
  ctx: CanvasRenderingContext2D,
  base: EnemyBase,
  camera: { x: number; y: number },
  canvasWidth: number,
  canvasHeight: number
): void {
  const screenX = base.x - camera.x;
  const screenY = base.y - camera.y;
  const config = ENEMY_BASE_CONFIG[base.id];
  const radius = config.radius;

  // 화면 밖이면 스킵
  if (
    screenX < -radius * 2 ||
    screenX > canvasWidth + radius * 2 ||
    screenY < -radius * 2 ||
    screenY > canvasHeight + radius * 2
  ) {
    return;
  }

  // HP 비율
  const hpPercent = base.hp / base.maxHp;

  ctx.save();

  if (base.destroyed) {
    // 파괴된 기지 - 잔해
    ctx.translate(screenX, screenY);
    ctx.globalAlpha = 0.5;

    // 잔해 조각들
    ctx.fillStyle = '#333333';
    for (let i = 0; i < 5; i++) {
      const angle = (i * Math.PI * 2) / 5;
      const dist = radius * 0.5 + (i % 3) * radius * 0.1;
      const size = radius * 0.2 + (i % 2) * radius * 0.05;
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * dist, Math.sin(angle) * dist, size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // 파괴됨 표시
    ctx.fillStyle = '#888888';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DESTROYED', screenX, screenY + radius + 20);

    ctx.restore();
    return;
  }

  // 활성 기지 - 어두운 빨간색
  const glowGradient = ctx.createRadialGradient(
    screenX, screenY, radius * 0.3,
    screenX, screenY, radius * 1.3
  );
  glowGradient.addColorStop(0, 'rgba(255, 50, 50, 0.4)');
  glowGradient.addColorStop(0.5, 'rgba(200, 50, 50, 0.2)');
  glowGradient.addColorStop(1, 'rgba(150, 50, 50, 0)');

  ctx.beginPath();
  ctx.arc(screenX, screenY, radius * 1.3, 0, Math.PI * 2);
  ctx.fillStyle = glowGradient;
  ctx.fill();

  // 기지 본체 (사각형)
  ctx.save();
  ctx.translate(screenX, screenY);

  // 본체
  ctx.fillStyle = '#442222';
  ctx.fillRect(-radius, -radius, radius * 2, radius * 2);

  // 테두리
  ctx.strokeStyle = '#ff4444';
  ctx.lineWidth = 3;
  ctx.strokeRect(-radius, -radius, radius * 2, radius * 2);

  // 중앙 문양 (X 표시)
  ctx.strokeStyle = '#ff6666';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-radius * 0.5, -radius * 0.5);
  ctx.lineTo(radius * 0.5, radius * 0.5);
  ctx.moveTo(radius * 0.5, -radius * 0.5);
  ctx.lineTo(-radius * 0.5, radius * 0.5);
  ctx.stroke();

  ctx.restore();

  // HP 바
  const hpBarWidth = radius * 2;
  const hpBarHeight = 6;
  const hpBarX = screenX - hpBarWidth / 2;
  const hpBarY = screenY + radius + 10;

  // HP 바 배경
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(hpBarX, hpBarY, hpBarWidth, hpBarHeight);

  // HP 바 내용
  const hpColor = hpPercent > 0.5 ? '#ff4444' : hpPercent > 0.25 ? '#ff8844' : '#ffaa44';
  ctx.fillStyle = hpColor;
  ctx.fillRect(hpBarX, hpBarY, hpBarWidth * hpPercent, hpBarHeight);

  // HP 바 테두리
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.strokeRect(hpBarX, hpBarY, hpBarWidth, hpBarHeight);

  // HP 텍스트
  ctx.fillStyle = '#ffffff';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.floor(base.hp)} / ${base.maxHp}`, screenX, hpBarY + hpBarHeight + 10);

  // 라벨
  ctx.fillStyle = '#ff6666';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(base.id === 'left' ? 'LEFT BASE' : 'RIGHT BASE', screenX, screenY - radius - 8);

  ctx.restore();
}

/**
 * 모든 적 기지 렌더링
 */
function drawCoopEnemyBases(
  ctx: CanvasRenderingContext2D,
  bases: EnemyBase[],
  camera: { x: number; y: number },
  canvasWidth: number,
  canvasHeight: number
): void {
  for (const base of bases) {
    drawCoopEnemyBase(ctx, base, camera, canvasWidth, canvasHeight);
  }
}

/**
 * 협동 모드 미니맵 렌더링
 */
function drawCoopMinimap(
  ctx: CanvasRenderingContext2D,
  gameState: NonNullable<ReturnType<typeof useRPGCoopStore.getState>['gameState']>,
  config: { x: number; y: number; width: number; height: number },
  myHeroId: string | null
) {
  const { x, y, width, height } = config;
  const mapWidth = RPG_CONFIG.MAP_WIDTH;
  const mapHeight = RPG_CONFIG.MAP_HEIGHT;

  // 미니맵 배경
  ctx.fillStyle = 'rgba(10, 10, 20, 0.9)';
  ctx.fillRect(x, y, width, height);

  // 미니맵 테두리
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);

  const scaleX = width / mapWidth;
  const scaleY = height / mapHeight;

  // 넥서스 표시 (파란색)
  if (gameState.nexus) {
    const nexusX = x + gameState.nexus.x * scaleX;
    const nexusY = y + gameState.nexus.y * scaleY;

    // 넥서스 글로우
    ctx.fillStyle = 'rgba(0, 200, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(nexusX, nexusY, 8, 0, Math.PI * 2);
    ctx.fill();

    // 넥서스 코어
    ctx.fillStyle = '#00d4ff';
    ctx.beginPath();
    ctx.arc(nexusX, nexusY, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // 적 기지 표시 (빨강/회색)
  if (gameState.enemyBases) {
    for (const base of gameState.enemyBases) {
      const baseX = x + base.x * scaleX;
      const baseY = y + base.y * scaleY;

      if (base.destroyed) {
        // 파괴된 기지 - 회색
        ctx.fillStyle = '#666666';
      } else {
        // 활성 기지 - 빨강
        ctx.fillStyle = '#ff4444';
      }

      ctx.beginPath();
      ctx.arc(baseX, baseY, 4, 0, Math.PI * 2);
      ctx.fill();

      // 기지 테두리
      ctx.strokeStyle = base.destroyed ? '#888888' : '#ff6666';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(baseX, baseY, 4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // 적 위치 표시
  for (const enemy of gameState.enemies) {
    if (enemy.hp <= 0) continue;

    const enemyX = x + enemy.x * scaleX;
    const enemyY = y + enemy.y * scaleY;
    const isBoss = enemy.type === 'boss';

    ctx.fillStyle = isBoss ? '#ff0000' : '#ff6666';
    ctx.beginPath();
    ctx.arc(enemyX, enemyY, isBoss ? 4 : 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // 영웅 위치 표시
  for (const hero of gameState.heroes) {
    if (hero.isDead) continue;

    const heroX = x + hero.x * scaleX;
    const heroY = y + hero.y * scaleY;
    const isMyHero = hero.id === myHeroId;

    // 영웅 점
    ctx.fillStyle = isMyHero ? '#ffd700' : '#00ff00';
    ctx.beginPath();
    ctx.arc(heroX, heroY, isMyHero ? 4 : 3, 0, Math.PI * 2);
    ctx.fill();

    // 내 영웅은 테두리 추가
    if (isMyHero) {
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(heroX, heroY, 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}
