import { RPGGameState, BossSkillWarning, BossSkillType, BossVoidZone } from '../types/rpg';
import { RPG_CONFIG, NEXUS_CONFIG, ENEMY_BASE_CONFIG, BOSS_SKILL_CONFIGS } from '../constants/rpgConfig';
import { drawGrid } from './drawGrid';
import { drawHero, drawRPGEnemy, drawSkillEffect, drawHeroAttackRange, drawSkillRange } from './drawHero';
import { effectManager } from '../effects';
import { drawRPGMinimap, getMinimapConfig } from './drawRPGMinimap';
import { useRPGStore } from '../stores/useRPGStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useUIStore } from '../stores/useUIStore';
import { drawNexus, drawAllEnemyBases, drawNexusLaserBeams } from './drawNexusEntities';
import { useRPGTutorialStore, TutorialTargetPosition } from '../stores/useRPGTutorialStore';

// 영웅 중심 이펙트 타입 (영웅 현재 위치를 따라가야 하는 이펙트)
// 대시 이펙트(warrior_w, knight_w, blood_rush 등)와 타겟 위치 이펙트(mage_w, inferno 등)는 제외
const HERO_CENTERED_EFFECT_TYPES = new Set([
  // 지속 추적 이펙트
  'spring_of_life', 'dark_blade', 'heavy_strike',
  // W스킬 - 영웅 위치에서 발사되는 투사체
  'archer_w', 'backflip_shot', 'multi_arrow',
  // E스킬 - 영웅 중심 버프/버스트 이펙트
  'warrior_e', 'knight_e', 'rage', 'shield', 'arrow_storm', 'divine_light',
]);

/**
 * RPG 모드 렌더링
 */
export function renderRPG(
  ctx: CanvasRenderingContext2D,
  state: RPGGameState,
  canvasWidth: number,
  canvasHeight: number
) {
  const zoom = state.camera.zoom;

  // 캔버스 클리어 - 싱글플레이와 동일한 다크 그린 그라데이션 배경
  const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
  gradient.addColorStop(0, '#1a2e1a');
  gradient.addColorStop(0.5, '#162016');
  gradient.addColorStop(1, '#0f1a0f');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // 줌 변환 적용
  ctx.save();
  ctx.scale(zoom, zoom);

  const scaledWidth = canvasWidth / zoom;
  const scaledHeight = canvasHeight / zoom;

  // 카메라 적용
  // 게임 루프에서 lerp로 부드럽게 업데이트된 카메라 위치 사용
  // 서브픽셀 렌더링으로 인한 떨림 방지를 위해 카메라 위치를 정수로 반올림
  const cameraX = Math.round(state.camera.x);
  const cameraY = Math.round(state.camera.y);
  const camera = {
    x: cameraX - scaledWidth / 2,
    y: cameraY - scaledHeight / 2,
    zoom: state.camera.zoom,
  };

  // 배경 그리드
  drawGrid(ctx, camera, scaledWidth, scaledHeight);

  // 맵 경계 표시
  drawMapBoundary(ctx, camera, scaledWidth, scaledHeight);

  // 넥서스 디펜스 엔티티 렌더링 (다른 엔티티와 동일한 카메라 사용)
  if (state.nexus) {
    drawNexus(ctx, state.nexus, camera, scaledWidth, scaledHeight);

    // 넥서스 레이저 빔 렌더링
    const nexusLaserEffects = useRPGStore.getState().nexusLaserEffects;
    if (nexusLaserEffects.length > 0) {
      drawNexusLaserBeams(ctx, state.nexus, nexusLaserEffects, camera);
    }
  }

  if (state.enemyBases && state.enemyBases.length > 0) {
    drawAllEnemyBases(ctx, state.enemyBases, camera, scaledWidth, scaledHeight, state.gameTime);
  }

  // 튜토리얼 목표 위치 마커 렌더링
  const tutorialState = useRPGTutorialStore.getState();
  if (tutorialState.isActive && tutorialState.targetPosition) {
    drawTutorialTargetMarker(ctx, tutorialState.targetPosition, camera, state.gameTime);
  }

  // Boss2 Void Zone 지속 장판 렌더링
  const rpgStore = useRPGStore.getState();
  if (rpgStore.bossActiveZones && rpgStore.bossActiveZones.length > 0) {
    for (const zone of rpgStore.bossActiveZones) {
      drawVoidZone(ctx, zone, camera, state.gameTime);
    }
  }

  // 보스 스킬 경고 표시 렌더링
  if (state.bossSkillWarnings && state.bossSkillWarnings.length > 0) {
    for (const warning of state.bossSkillWarnings) {
      drawBossSkillWarning(ctx, warning, camera, state.gameTime);
    }
  }

  // 스킬 이펙트 렌더링
  const otherHeroesForEffects = useRPGStore.getState().otherHeroes;
  for (const effect of state.activeSkillEffects) {
    // heroId가 있는 영웅 중심 이펙트는 해당 영웅의 현재 위치를 따라감
    if (effect.heroId && HERO_CENTERED_EFFECT_TYPES.has(effect.type)) {
      // 내 영웅인지 확인
      if (state.hero && effect.heroId === state.hero.id) {
        const updatedEffect = { ...effect, position: { x: state.hero.x, y: state.hero.y } };
        drawSkillEffect(ctx, updatedEffect, camera, state.gameTime);
        continue;
      }
      // 다른 플레이어 영웅인지 확인
      const otherHero = otherHeroesForEffects?.get(effect.heroId);
      if (otherHero) {
        const updatedEffect = { ...effect, position: { x: otherHero.x, y: otherHero.y } };
        drawSkillEffect(ctx, updatedEffect, camera, state.gameTime);
        continue;
      }
    }
    // targetId가 있는 이펙트는 타겟 적의 현재 위치를 따라감 (저격 등)
    if (effect.targetId) {
      const targetEnemy = state.enemies.find(e => e.id === effect.targetId);
      if (targetEnemy && targetEnemy.hp > 0) {
        const updatedEffect = { ...effect, targetPosition: { x: targetEnemy.x, y: targetEnemy.y } };
        drawSkillEffect(ctx, updatedEffect, camera, state.gameTime);
        continue;
      }
    }
    drawSkillEffect(ctx, effect, camera, state.gameTime);
  }

  // 적 유닛 렌더링
  // 영웅이 살아있을 때만 영웅 위치를 전달 (죽었으면 넥서스 방향을 바라봄)
  const heroPos = (state.hero && state.hero.hp > 0) ? { x: state.hero.x, y: state.hero.y } : undefined;
  for (const enemy of state.enemies) {
    if (enemy.hp > 0) {
      const isTarget = state.hero?.attackTarget === enemy.id;
      drawRPGEnemy(ctx, enemy, camera, scaledWidth, scaledHeight, isTarget, heroPos);
    }
  }

  // 다른 플레이어 영웅 렌더링 (멀티플레이어 모드)
  const otherHeroes = useRPGStore.getState().otherHeroes;
  const multiplayerPlayers = useRPGStore.getState().multiplayer.players;
  if (otherHeroes && otherHeroes.size > 0) {
    otherHeroes.forEach((otherHero) => {
      // 사망한 영웅도 렌더링 (사망 애니메이션 표시)
      // 플레이어 ID에서 hero_ 접두사 제거하여 플레이어 이름 찾기
      const playerId = otherHero.id.replace('hero_', '');
      const player = multiplayerPlayers.find(p => p.id === playerId);
      const otherNickname = player?.name || '플레이어';
      // 다른 플레이어는 lastDamageTime 0 전달 (깜빡임 효과 없음)
      drawHero(ctx, otherHero, camera, scaledWidth, scaledHeight, state.gameTime, true, otherNickname, 0);
    });
  }

  // 영웅 렌더링 (내 영웅)
  if (state.hero) {
    // 공격 범위 표시 (V 키 누른 상태)
    const showAttackRange = useRPGStore.getState().showAttackRange;
    if (showAttackRange) {
      drawHeroAttackRange(ctx, state.hero, camera);
    }

    // 스킬 사거리 표시 (스킬 아이콘 호버 시)
    const hoveredSkillRange = useRPGStore.getState().hoveredSkillRange;
    if (hoveredSkillRange && hoveredSkillRange.type) {
      const mousePosition = useRPGStore.getState().mousePosition;
      drawSkillRange(ctx, state.hero, camera, hoveredSkillRange, mousePosition);
    }

    // 내 닉네임 가져오기
    const myNickname = useAuthStore.getState().profile?.nickname || '나';
    // 마지막 피격 시간 전달 (피격 시 빨간색 깜빡임 효과용)
    const lastDamageTime = useRPGStore.getState().lastDamageTime;
    drawHero(ctx, state.hero, camera, scaledWidth, scaledHeight, state.gameTime, false, myNickname, lastDamageTime);
  }

  // 파티클 이펙트 렌더링
  effectManager.render(ctx, camera.x, camera.y, scaledWidth, scaledHeight);

  // 줌 변환 복원
  ctx.restore();

  // 미니맵 렌더링
  const uiState = useUIStore.getState();
  const minimapConfig = getMinimapConfig(canvasWidth, canvasHeight, {
    isTouchDevice: uiState.isTouchDevice,
    isTablet: uiState.isTablet,
  });
  drawRPGMinimap(ctx, state, minimapConfig);

  // 게임 오버 오버레이
  if (state.gameOver) {
    drawGameOverOverlay(ctx, canvasWidth, canvasHeight, state.victory);
  }

  // 일시정지 오버레이
  if (state.paused) {
    drawPausedOverlay(ctx, canvasWidth, canvasHeight);
  }
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
 * 게임 오버 오버레이
 */
function drawGameOverOverlay(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  victory: boolean
) {
  ctx.save();

  // 반투명 배경
  ctx.fillStyle = victory ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // 텍스트
  ctx.font = 'bold 64px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 텍스트 그림자
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillText(victory ? '승리!' : '게임 오버', canvasWidth / 2 + 3, canvasHeight / 2 + 3);

  // 텍스트
  ctx.fillStyle = victory ? '#10b981' : '#ef4444';
  ctx.fillText(victory ? '승리!' : '게임 오버', canvasWidth / 2, canvasHeight / 2);

  ctx.restore();
}

/**
 * 일시정지 오버레이
 */
function drawPausedOverlay(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number
) {
  ctx.save();

  // 반투명 배경
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // 일시정지 아이콘
  ctx.fillStyle = '#ffffff';
  const iconSize = 60;
  const barWidth = 15;
  const gap = 15;

  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;

  // 왼쪽 바
  ctx.fillRect(
    centerX - gap / 2 - barWidth,
    centerY - iconSize / 2,
    barWidth,
    iconSize
  );

  // 오른쪽 바
  ctx.fillRect(
    centerX + gap / 2,
    centerY - iconSize / 2,
    barWidth,
    iconSize
  );

  // 텍스트
  ctx.font = '24px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('일시정지', centerX, centerY + 60);

  ctx.restore();
}

/**
 * 보스 스킬 경고 표시 렌더링
 */
function drawBossSkillWarning(
  ctx: CanvasRenderingContext2D,
  warning: BossSkillWarning,
  camera: { x: number; y: number },
  gameTime: number
) {
  const screenX = warning.x - camera.x;
  const screenY = warning.y - camera.y;

  // 진행도 계산 (0 ~ 1)
  const elapsed = gameTime - warning.startTime;
  const progress = Math.min(1, elapsed / warning.duration);

  // 깜빡임 효과
  const blink = Math.sin(elapsed * 10) * 0.2 + 0.8;
  const baseAlpha = 0.3 + progress * 0.3;
  const alpha = baseAlpha * blink;

  ctx.save();

  switch (warning.skillType) {
    case 'smash': {
      // 강타: 부채꼴 범위
      const config = BOSS_SKILL_CONFIGS.smash;
      const angle = warning.angle ?? 0;
      const halfAngle = (config.angle ?? Math.PI / 3) / 2;

      ctx.beginPath();
      ctx.moveTo(screenX, screenY);
      ctx.arc(screenX, screenY, warning.radius * (0.5 + progress * 0.5), angle - halfAngle, angle + halfAngle);
      ctx.closePath();

      // 그라데이션 채우기
      const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, warning.radius);
      gradient.addColorStop(0, `rgba(255, 100, 0, ${alpha * 0.8})`);
      gradient.addColorStop(1, `rgba(255, 50, 0, ${alpha * 0.4})`);
      ctx.fillStyle = gradient;
      ctx.fill();

      // 테두리
      ctx.strokeStyle = `rgba(255, 200, 0, ${alpha})`;
      ctx.lineWidth = 3;
      ctx.stroke();
      break;
    }

    case 'shockwave': {
      // 충격파: 원형 범위 (퍼져나가는 애니메이션) - 즉사 스킬
      ctx.beginPath();
      ctx.arc(screenX, screenY, warning.radius * progress, 0, Math.PI * 2);

      // 그라데이션 채우기 (빨간 톤으로 위험 강조)
      const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, warning.radius);
      gradient.addColorStop(0, `rgba(255, 0, 0, ${alpha * 0.4})`);
      gradient.addColorStop(0.5, `rgba(200, 0, 50, ${alpha * 0.5})`);
      gradient.addColorStop(1, `rgba(150, 0, 255, ${alpha * 0.2})`);
      ctx.fillStyle = gradient;
      ctx.fill();

      // 바깥쪽 링 (빨간색)
      ctx.strokeStyle = `rgba(255, 80, 80, ${alpha})`;
      ctx.lineWidth = 4;
      ctx.stroke();

      // 안쪽 링 (진행 표시)
      ctx.beginPath();
      ctx.arc(screenX, screenY, warning.radius * 0.3, 0, Math.PI * 2 * progress);
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
      ctx.lineWidth = 2;
      ctx.stroke();

      // 경고 텍스트 (보스 위치에 표시)
      const textBlink = Math.sin(elapsed * 12) > 0 ? 1 : 0.5;
      ctx.globalAlpha = textBlink;
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 4;
      ctx.strokeText('⚠ 즉사 충격파 ⚠', screenX, screenY - warning.radius - 25);
      ctx.fillStyle = '#ff3333';
      ctx.fillText('⚠ 즉사 충격파 ⚠', screenX, screenY - warning.radius - 25);

      // 범위 밖으로 이탈 안내
      ctx.font = 'bold 14px sans-serif';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.strokeText('범위 밖으로 이동하세요!', screenX, screenY - warning.radius - 5);
      ctx.fillStyle = '#ffcc00';
      ctx.fillText('범위 밖으로 이동하세요!', screenX, screenY - warning.radius - 5);
      break;
    }

    case 'summon': {
      // 소환: 원형 마법진
      const innerRadius = warning.radius * 0.5;
      const outerRadius = warning.radius;

      // 외부 원
      ctx.beginPath();
      ctx.arc(screenX, screenY, outerRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(100, 0, 150, ${alpha})`;
      ctx.lineWidth = 3;
      ctx.stroke();

      // 내부 원 (회전 애니메이션)
      ctx.beginPath();
      const rotation = elapsed * 2;
      ctx.arc(screenX, screenY, innerRadius, rotation, rotation + Math.PI * 1.5);
      ctx.strokeStyle = `rgba(150, 50, 200, ${alpha})`;
      ctx.lineWidth = 2;
      ctx.stroke();

      // 마법진 십자 패턴
      ctx.strokeStyle = `rgba(180, 100, 255, ${alpha * 0.6})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const lineAngle = rotation + (Math.PI / 2) * i;
        ctx.beginPath();
        ctx.moveTo(screenX + Math.cos(lineAngle) * innerRadius, screenY + Math.sin(lineAngle) * innerRadius);
        ctx.lineTo(screenX + Math.cos(lineAngle) * outerRadius, screenY + Math.sin(lineAngle) * outerRadius);
        ctx.stroke();
      }

      // 중앙 채우기
      ctx.beginPath();
      ctx.arc(screenX, screenY, innerRadius * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(100, 0, 150, ${alpha * 0.5})`;
      ctx.fill();
      break;
    }

    case 'knockback': {
      // 밀어내기: 노란색 원형 충격파
      ctx.beginPath();
      ctx.arc(screenX, screenY, warning.radius * (0.5 + progress * 0.5), 0, Math.PI * 2);

      // 그라데이션 채우기
      const kbGradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, warning.radius);
      kbGradient.addColorStop(0, `rgba(255, 255, 0, ${alpha * 0.3})`);
      kbGradient.addColorStop(0.7, `rgba(255, 200, 0, ${alpha * 0.5})`);
      kbGradient.addColorStop(1, `rgba(255, 150, 0, ${alpha * 0.2})`);
      ctx.fillStyle = kbGradient;
      ctx.fill();

      // 바깥쪽 링
      ctx.strokeStyle = `rgba(255, 255, 100, ${alpha})`;
      ctx.lineWidth = 4;
      ctx.stroke();

      // 방사형 화살표 (밀려나는 방향 표시)
      ctx.strokeStyle = `rgba(255, 255, 200, ${alpha * 0.8})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const arrowAngle = (Math.PI / 4) * i;
        const innerDist = warning.radius * 0.3;
        const outerDist = warning.radius * (0.5 + progress * 0.5);
        ctx.beginPath();
        ctx.moveTo(screenX + Math.cos(arrowAngle) * innerDist, screenY + Math.sin(arrowAngle) * innerDist);
        ctx.lineTo(screenX + Math.cos(arrowAngle) * outerDist, screenY + Math.sin(arrowAngle) * outerDist);
        ctx.stroke();
      }
      break;
    }

    case 'charge': {
      // 돌진: 파란색 직선 경로
      if (warning.targetX !== undefined && warning.targetY !== undefined) {
        const targetScreenX = warning.targetX - camera.x;
        const targetScreenY = warning.targetY - camera.y;

        // 경로 계산
        const dx = targetScreenX - screenX;
        const dy = targetScreenY - screenY;
        const pathLength = Math.sqrt(dx * dx + dy * dy);
        const dirX = dx / pathLength;
        const dirY = dy / pathLength;

        // 경로 폭 (양쪽으로 25px씩)
        const halfWidth = warning.radius;

        // 직선 경로 (사각형)
        ctx.beginPath();
        const perpX = -dirY * halfWidth;
        const perpY = dirX * halfWidth;

        ctx.moveTo(screenX + perpX, screenY + perpY);
        ctx.lineTo(targetScreenX + perpX, targetScreenY + perpY);
        ctx.lineTo(targetScreenX - perpX, targetScreenY - perpY);
        ctx.lineTo(screenX - perpX, screenY - perpY);
        ctx.closePath();

        // 그라데이션 채우기
        const chargeGradient = ctx.createLinearGradient(screenX, screenY, targetScreenX, targetScreenY);
        chargeGradient.addColorStop(0, `rgba(0, 100, 255, ${alpha * 0.6})`);
        chargeGradient.addColorStop(0.5, `rgba(0, 150, 255, ${alpha * 0.4})`);
        chargeGradient.addColorStop(1, `rgba(0, 200, 255, ${alpha * 0.2})`);
        ctx.fillStyle = chargeGradient;
        ctx.fill();

        // 테두리
        ctx.strokeStyle = `rgba(100, 200, 255, ${alpha})`;
        ctx.lineWidth = 3;
        ctx.stroke();

        // 진행 표시 (현재 위치에서 목표까지의 화살표)
        ctx.beginPath();
        ctx.moveTo(screenX, screenY);
        ctx.lineTo(targetScreenX, targetScreenY);
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 5]);
        ctx.stroke();
        ctx.setLineDash([]);

        // 목표 지점 표시
        ctx.beginPath();
        ctx.arc(targetScreenX, targetScreenY, 10, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 150, 255, ${alpha})`;
        ctx.fill();
      }
      break;
    }

    case 'heal': {
      // 회복: 녹색 원형 힐링 이펙트
      // heal 스킬은 radius가 0이므로 기본값 80 사용
      const healRadius = warning.radius > 0 ? warning.radius : 80;

      ctx.beginPath();
      ctx.arc(screenX, screenY, healRadius * (0.7 + progress * 0.3), 0, Math.PI * 2);

      // 그라데이션 채우기
      const healGradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, healRadius);
      healGradient.addColorStop(0, `rgba(0, 255, 100, ${alpha * 0.5})`);
      healGradient.addColorStop(0.5, `rgba(50, 255, 50, ${alpha * 0.3})`);
      healGradient.addColorStop(1, `rgba(100, 255, 100, ${alpha * 0.1})`);
      ctx.fillStyle = healGradient;
      ctx.fill();

      // 바깥쪽 링
      ctx.strokeStyle = `rgba(100, 255, 100, ${alpha})`;
      ctx.lineWidth = 3;
      ctx.stroke();

      // 십자가 패턴 (힐 표시)
      ctx.strokeStyle = `rgba(200, 255, 200, ${alpha})`;
      ctx.lineWidth = 4;
      const crossSize = healRadius * 0.4;

      // 가로 선
      ctx.beginPath();
      ctx.moveTo(screenX - crossSize, screenY);
      ctx.lineTo(screenX + crossSize, screenY);
      ctx.stroke();

      // 세로 선
      ctx.beginPath();
      ctx.moveTo(screenX, screenY - crossSize);
      ctx.lineTo(screenX, screenY + crossSize);
      ctx.stroke();

      // 상승하는 + 파티클 효과 (진행도에 따라)
      ctx.fillStyle = `rgba(200, 255, 200, ${alpha * 0.7})`;
      for (let i = 0; i < 4; i++) {
        const particleY = screenY - (progress * 50) - (i * 20);
        const particleX = screenX + Math.sin(elapsed * 3 + i) * 15;
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('+', particleX, particleY);
      }
      break;
    }

    // ============================================
    // Boss2 (암흑 마법사) 스킬 경고
    // ============================================
    case 'dark_orb': {
      // 암흑 구체: 보라색 원형 AoE
      ctx.beginPath();
      ctx.arc(screenX, screenY, warning.radius * (0.5 + progress * 0.5), 0, Math.PI * 2);
      const orbGradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, warning.radius);
      orbGradient.addColorStop(0, `rgba(153, 0, 255, ${alpha * 0.6})`);
      orbGradient.addColorStop(1, `rgba(80, 0, 150, ${alpha * 0.2})`);
      ctx.fillStyle = orbGradient;
      ctx.fill();
      ctx.strokeStyle = `rgba(200, 100, 255, ${alpha})`;
      ctx.lineWidth = 3;
      ctx.stroke();
      break;
    }

    case 'shadow_summon': {
      // 그림자 소환: 보라색 마법진
      ctx.beginPath();
      ctx.arc(screenX, screenY, warning.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(153, 0, 255, ${alpha})`;
      ctx.lineWidth = 3;
      ctx.stroke();

      const ssRotation = elapsed * 2;
      ctx.beginPath();
      ctx.arc(screenX, screenY, warning.radius * 0.5, ssRotation, ssRotation + Math.PI * 1.5);
      ctx.strokeStyle = `rgba(200, 50, 255, ${alpha})`;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(screenX, screenY, warning.radius * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(153, 0, 255, ${alpha * 0.5})`;
      ctx.fill();
      break;
    }

    case 'void_zone': {
      // 공허의 영역: 보라색 소용돌이 장판 경고
      ctx.beginPath();
      ctx.arc(screenX, screenY, warning.radius * (0.5 + progress * 0.5), 0, Math.PI * 2);
      const vzGradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, warning.radius);
      vzGradient.addColorStop(0, `rgba(50, 0, 100, ${alpha * 0.6})`);
      vzGradient.addColorStop(0.5, `rgba(100, 0, 200, ${alpha * 0.4})`);
      vzGradient.addColorStop(1, `rgba(153, 0, 255, ${alpha * 0.2})`);
      ctx.fillStyle = vzGradient;
      ctx.fill();
      ctx.strokeStyle = `rgba(200, 100, 255, ${alpha})`;
      ctx.lineWidth = 3;
      ctx.stroke();
      break;
    }

    case 'dark_meteor': {
      // 암흑 유성: 보라색 원형 낙하 경고
      ctx.beginPath();
      ctx.arc(screenX, screenY, warning.radius * progress, 0, Math.PI * 2);
      const dmGradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, warning.radius);
      dmGradient.addColorStop(0, `rgba(153, 0, 255, ${alpha * 0.5})`);
      dmGradient.addColorStop(0.5, `rgba(100, 0, 200, ${alpha * 0.4})`);
      dmGradient.addColorStop(1, `rgba(50, 0, 100, ${alpha * 0.2})`);
      ctx.fillStyle = dmGradient;
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 100, 255, ${alpha})`;
      ctx.lineWidth = 4;
      ctx.stroke();

      // 경고 텍스트
      const dmBlink = Math.sin(elapsed * 12) > 0 ? 1 : 0.5;
      ctx.globalAlpha = dmBlink;
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.strokeText('⚠ 유성 낙하 ⚠', screenX, screenY - warning.radius - 15);
      ctx.fillStyle = '#cc66ff';
      ctx.fillText('⚠ 유성 낙하 ⚠', screenX, screenY - warning.radius - 15);
      break;
    }

    case 'soul_drain': {
      // 영혼 흡수: 보라색 원형 흡수 이펙트
      ctx.beginPath();
      ctx.arc(screenX, screenY, warning.radius * (0.6 + progress * 0.4), 0, Math.PI * 2);
      const sdGradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, warning.radius);
      sdGradient.addColorStop(0, `rgba(100, 0, 200, ${alpha * 0.5})`);
      sdGradient.addColorStop(1, `rgba(50, 0, 100, ${alpha * 0.2})`);
      ctx.fillStyle = sdGradient;
      ctx.fill();
      ctx.strokeStyle = `rgba(180, 50, 255, ${alpha})`;
      ctx.lineWidth = 3;
      ctx.stroke();

      // 수렴하는 선
      ctx.strokeStyle = `rgba(200, 100, 255, ${alpha * 0.7})`;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 8; i++) {
        const lineAngle = (Math.PI / 4) * i + elapsed * 1.5;
        const outerDist = warning.radius * (1 - progress * 0.3);
        ctx.beginPath();
        ctx.moveTo(screenX + Math.cos(lineAngle) * outerDist, screenY + Math.sin(lineAngle) * outerDist);
        ctx.lineTo(screenX + Math.cos(lineAngle) * 10, screenY + Math.sin(lineAngle) * 10);
        ctx.stroke();
      }
      break;
    }

    case 'teleport': {
      // 텔레포트: 경고 없음 (빈 케이스)
      break;
    }
  }

  // 스킬 이름 표시
  const config = BOSS_SKILL_CONFIGS[warning.skillType];
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
  ctx.fillText(config.name, screenX, screenY - warning.radius - 15);

  ctx.restore();
}

/**
 * Void Zone (공허의 영역) 지속 장판 렌더링
 */
function drawVoidZone(
  ctx: CanvasRenderingContext2D,
  zone: BossVoidZone,
  camera: { x: number; y: number },
  gameTime: number
) {
  const screenX = zone.x - camera.x;
  const screenY = zone.y - camera.y;

  const elapsed = gameTime - zone.startTime;
  const pulse = Math.sin(elapsed * 3) * 0.15 + 0.85;

  ctx.save();

  // 소용돌이 배경
  const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, zone.radius);
  gradient.addColorStop(0, `rgba(80, 0, 150, ${0.4 * pulse})`);
  gradient.addColorStop(0.5, `rgba(50, 0, 100, ${0.3 * pulse})`);
  gradient.addColorStop(1, `rgba(30, 0, 60, ${0.1 * pulse})`);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(screenX, screenY, zone.radius, 0, Math.PI * 2);
  ctx.fill();

  // 회전하는 테두리
  ctx.strokeStyle = `rgba(180, 50, 255, ${0.6 * pulse})`;
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 8]);
  ctx.lineDashOffset = -elapsed * 30;
  ctx.beginPath();
  ctx.arc(screenX, screenY, zone.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // 소용돌이 선
  ctx.strokeStyle = `rgba(153, 0, 255, ${0.3 * pulse})`;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    const spiralAngle = elapsed * 2 + (Math.PI * 2 / 3) * i;
    ctx.beginPath();
    for (let t = 0; t < 1; t += 0.05) {
      const r = zone.radius * t;
      const a = spiralAngle + t * Math.PI * 2;
      const px = screenX + Math.cos(a) * r;
      const py = screenY + Math.sin(a) * r;
      if (t === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * 튜토리얼 목표 위치 마커 렌더링
 */
export function drawTutorialTargetMarker(
  ctx: CanvasRenderingContext2D,
  target: TutorialTargetPosition,
  camera: { x: number; y: number },
  gameTime: number
) {
  const screenX = target.x - camera.x;
  const screenY = target.y - camera.y;

  // 애니메이션 효과
  const pulse = Math.sin(gameTime * 3) * 0.2 + 0.8;
  const bounce = Math.sin(gameTime * 2) * 5;

  ctx.save();

  // 외곽 원 (파동 효과)
  const waveRadius = target.radius + 20 + Math.sin(gameTime * 4) * 10;
  ctx.beginPath();
  ctx.arc(screenX, screenY, waveRadius, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(0, 255, 100, ${0.3 * pulse})`;
  ctx.lineWidth = 2;
  ctx.stroke();

  // 메인 원
  ctx.beginPath();
  ctx.arc(screenX, screenY, target.radius, 0, Math.PI * 2);
  const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, target.radius);
  gradient.addColorStop(0, `rgba(0, 255, 100, ${0.4 * pulse})`);
  gradient.addColorStop(0.7, `rgba(0, 200, 80, ${0.2 * pulse})`);
  gradient.addColorStop(1, `rgba(0, 150, 50, ${0.1 * pulse})`);
  ctx.fillStyle = gradient;
  ctx.fill();

  // 테두리
  ctx.strokeStyle = `rgba(0, 255, 100, ${0.8 * pulse})`;
  ctx.lineWidth = 3;
  ctx.stroke();

  // 중앙 점
  ctx.beginPath();
  ctx.arc(screenX, screenY, 8, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
  ctx.fill();

  // 화살표 (위에서 아래로 pointing)
  ctx.beginPath();
  ctx.moveTo(screenX, screenY - target.radius - 30 + bounce);
  ctx.lineTo(screenX - 10, screenY - target.radius - 45 + bounce);
  ctx.lineTo(screenX + 10, screenY - target.radius - 45 + bounce);
  ctx.closePath();
  ctx.fillStyle = `rgba(0, 255, 100, ${pulse})`;
  ctx.fill();

  // 라벨
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = `rgba(255, 255, 255, 1)`;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.lineWidth = 3;
  ctx.strokeText(target.label, screenX, screenY - target.radius - 50 + bounce);
  ctx.fillText(target.label, screenX, screenY - target.radius - 50 + bounce);

  ctx.restore();
}

