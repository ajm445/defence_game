/**
 * 넥서스 레이저 방어 시스템
 * - 범위 내 모든 적에게 약한 데미지를 동시에 공격
 * - 업그레이드 없음, 난이도/인원수에 영향 받지 않음
 * - 호스트에서만 로직 실행, 클라이언트는 이펙트만 동기화
 */

import { NEXUS_CONFIG } from '../../constants/rpgConfig';
import type { Nexus, RPGEnemy, NexusLaserEffect } from '../../types/rpg';
import { v4 as uuidv4 } from 'uuid';

export interface NexusLaserResult {
  updatedNexus: Nexus;
  laserEffects: NexusLaserEffect[];
  damagedEnemies: { enemyId: string; damage: number }[];
}

/**
 * 넥서스와 적 사이의 거리 계산
 */
function distanceToNexus(nexus: Nexus, enemy: RPGEnemy): number {
  const dx = enemy.x - nexus.x;
  const dy = enemy.y - nexus.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 넥서스 레이저 공격 처리
 * @param nexus 현재 넥서스 상태
 * @param enemies 현재 적 목록
 * @param deltaTime 경과 시간 (초)
 * @returns 업데이트된 넥서스, 레이저 이펙트, 데미지받은 적 목록
 */
export function processNexusLaser(
  nexus: Nexus,
  enemies: RPGEnemy[],
  deltaTime: number
): NexusLaserResult {
  const laserConfig = NEXUS_CONFIG.laser;
  const laserEffects: NexusLaserEffect[] = [];
  const damagedEnemies: { enemyId: string; damage: number }[] = [];

  // 쿨다운 감소
  let newCooldown = Math.max(0, nexus.laserCooldown - deltaTime);

  // 쿨다운이 끝나면 공격
  if (newCooldown <= 0) {
    // 범위 내 모든 적 찾기
    const enemiesInRange = enemies.filter(
      (enemy) => enemy.hp > 0 && distanceToNexus(nexus, enemy) <= laserConfig.range
    );

    // 범위 내 적이 있으면 공격
    if (enemiesInRange.length > 0) {
      const now = Date.now();

      // 모든 적에게 동시에 데미지 및 이펙트 생성
      for (const enemy of enemiesInRange) {
        damagedEnemies.push({
          enemyId: enemy.id,
          damage: laserConfig.damage,
        });

        // 레이저 이펙트 생성
        laserEffects.push({
          id: uuidv4(),
          targetX: enemy.x,
          targetY: enemy.y,
          timestamp: now,
        });
      }

      // 쿨다운 리셋
      newCooldown = laserConfig.attackSpeed;
    }
  }

  return {
    updatedNexus: {
      ...nexus,
      laserCooldown: newCooldown,
    },
    laserEffects,
    damagedEnemies,
  };
}

/**
 * 넥서스 레이저가 활성 상태인지 확인
 */
export function isNexusAlive(nexus: Nexus | null): boolean {
  return nexus !== null && nexus.hp > 0;
}
