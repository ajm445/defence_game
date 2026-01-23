import { RPGGameState } from '../types/rpg';
import { RPG_CONFIG, LANE_CONFIG, NEXUS_CONFIG, ENEMY_BASE_CONFIG } from '../constants/rpgConfig';
import { drawGrid } from './drawGrid';
import { drawHero, drawRPGEnemy, drawSkillEffect, drawHeroAttackRange, drawSkillRange } from './drawHero';
import { effectManager } from '../effects';
import { drawRPGMinimap, getMinimapConfig } from './drawRPGMinimap';
import { useRPGStore } from '../stores/useRPGStore';
import { useAuthStore } from '../stores/useAuthStore';
import { drawNexus, drawAllEnemyBases } from './drawNexusEntities';

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
  const camera = {
    x: state.camera.x - scaledWidth / 2,
    y: state.camera.y - scaledHeight / 2,
    zoom: state.camera.zoom,
  };

  // 배경 그리드
  drawGrid(ctx, camera, scaledWidth, scaledHeight);

  // 레인 (적 이동 경로) 렌더링
  drawLanes(ctx, camera, scaledWidth, scaledHeight);

  // 맵 경계 표시
  drawMapBoundary(ctx, camera, scaledWidth, scaledHeight);

  // 넥서스 디펜스 엔티티 렌더링 (다른 엔티티와 동일한 카메라 사용)
  if (state.nexus) {
    drawNexus(ctx, state.nexus, camera, scaledWidth, scaledHeight);
  }

  if (state.enemyBases && state.enemyBases.length > 0) {
    drawAllEnemyBases(ctx, state.enemyBases, camera, scaledWidth, scaledHeight);
  }

  // 스킬 이펙트 렌더링
  for (const effect of state.activeSkillEffects) {
    drawSkillEffect(ctx, effect, camera, state.gameTime);
  }

  // 적 유닛 렌더링
  const heroPos = state.hero ? { x: state.hero.x, y: state.hero.y } : undefined;
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
      if (otherHero.hp > 0) {
        // 플레이어 ID에서 hero_ 접두사 제거하여 플레이어 이름 찾기
        const playerId = otherHero.id.replace('hero_', '');
        const player = multiplayerPlayers.find(p => p.id === playerId);
        const otherNickname = player?.name || '플레이어';
        drawHero(ctx, otherHero, camera, scaledWidth, scaledHeight, state.gameTime, true, otherNickname);
      }
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
    drawHero(ctx, state.hero, camera, scaledWidth, scaledHeight, state.gameTime, false, myNickname);
  }

  // 파티클 이펙트 렌더링
  effectManager.render(ctx, camera.x, camera.y, scaledWidth, scaledHeight);

  // 줌 변환 복원
  ctx.restore();

  // 미니맵 렌더링
  const minimapConfig = getMinimapConfig(canvasWidth, canvasHeight);
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
 * 레인 (적 이동 경로) 렌더링
 */
function drawLanes(
  ctx: CanvasRenderingContext2D,
  camera: { x: number; y: number },
  _canvasWidth: number,
  canvasHeight: number
) {
  ctx.save();

  const laneY = LANE_CONFIG.centerY;
  const laneHalfWidth = LANE_CONFIG.width / 2;
  const nexusX = NEXUS_CONFIG.position.x;
  const leftBaseX = ENEMY_BASE_CONFIG.left.x;
  const rightBaseX = ENEMY_BASE_CONFIG.right.x;

  // 화면에 보이는지 확인
  const screenTop = camera.y;
  const screenBottom = camera.y + canvasHeight;

  // 레인이 화면에 보이지 않으면 그리지 않음
  if (laneY + laneHalfWidth < screenTop || laneY - laneHalfWidth > screenBottom) {
    ctx.restore();
    return;
  }

  // 왼쪽 레인 (왼쪽 기지 → 넥서스)
  drawLanePath(ctx, camera, leftBaseX, nexusX, laneY, laneHalfWidth);

  // 오른쪽 레인 (오른쪽 기지 → 넥서스)
  drawLanePath(ctx, camera, nexusX, rightBaseX, laneY, laneHalfWidth);

  ctx.restore();
}

/**
 * 레인 경로 그리기
 */
function drawLanePath(
  ctx: CanvasRenderingContext2D,
  camera: { x: number; y: number },
  startX: number,
  endX: number,
  centerY: number,
  halfWidth: number
) {
  const screenStartX = startX - camera.x;
  const screenEndX = endX - camera.x;
  const screenY = centerY - camera.y;

  // 레인 배경 (길)
  ctx.fillStyle = LANE_CONFIG.color;
  ctx.fillRect(
    screenStartX,
    screenY - halfWidth,
    screenEndX - screenStartX,
    halfWidth * 2
  );

  // 레인 테두리 (상단)
  ctx.fillStyle = LANE_CONFIG.borderColor;
  ctx.fillRect(
    screenStartX,
    screenY - halfWidth,
    screenEndX - screenStartX,
    4
  );

  // 레인 테두리 (하단)
  ctx.fillRect(
    screenStartX,
    screenY + halfWidth - 4,
    screenEndX - screenStartX,
    4
  );

  // 중앙 점선 (가이드라인)
  ctx.strokeStyle = 'rgba(80, 70, 60, 0.3)';
  ctx.lineWidth = 2;
  ctx.setLineDash([20, 20]);
  ctx.beginPath();
  ctx.moveTo(screenStartX, screenY);
  ctx.lineTo(screenEndX, screenY);
  ctx.stroke();
  ctx.setLineDash([]);
}
