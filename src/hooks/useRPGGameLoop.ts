import { useRef, useCallback, useEffect } from 'react';
import { useRPGStore } from '../stores/useRPGStore';
import { useUIStore } from '../stores/useUIStore';
import { RPG_CONFIG, CLASS_SKILLS, CLASS_CONFIGS, PASSIVE_UNLOCK_LEVEL, MILESTONE_CONFIG, UPGRADE_CONFIG, GOLD_CONFIG, ADVANCED_CLASS_CONFIGS, ADVANCED_W_SKILLS } from '../constants/rpgConfig';
import { getStatBonus } from '../types/auth';
import { updateHeroUnit, findNearestEnemy, findNearestEnemyBase } from '../game/rpg/heroUnit';
import {
  updateSkillCooldowns,
  executeQSkill,
  executeWSkill,
  executeESkill,
  canUseSkill,
} from '../game/rpg/skillSystem';
import {
  updateAllEnemiesAINexus,
  updateAllEnemiesAINexusMultiplayer,
  calculateDamageAfterReduction,
  applyStunToEnemy,
} from '../game/rpg/enemyAI';
import { effectManager } from '../effects';
import { soundManager } from '../services/SoundManager';
import { SkillType, PendingSkill, SkillEffect, HeroUnit, Buff } from '../types/rpg';
import { distance } from '../utils/math';
import { createEnemyFromBase, getSpawnConfig, shouldSpawnEnemy, shouldSpawnTutorialEnemy, createTutorialEnemy } from '../game/rpg/nexusSpawnSystem';
import { createBosses, areAllBossesDead, hasBosses, updateBossSkills, applyStunToHero } from '../game/rpg/bossSystem';
import { processNexusLaser, isNexusAlive } from '../game/rpg/nexusLaserSystem';
import { rollMultiTarget } from '../game/rpg/passiveSystem';
import { sendMoveDirection, sendSkillUse, shareHostBuffToAllies } from './useNetworkSync';
import { wsClient } from '../services/WebSocketClient';
import { useRPGTutorialStore } from '../stores/useRPGTutorialStore';

export function useRPGGameLoop() {
  const lastTimeRef = useRef<number>(0);
  const animationIdRef = useRef<number>(0);
  const pendingSkillRef = useRef<SkillType | null>(null);
  const bossesSpawnedRef = useRef<boolean>(false);
  const lastBroadcastTimeRef = useRef<number>(0);
  const wasRunningRef = useRef<boolean>(false);
  // 이펙트 ID와 처리 시간을 함께 저장하여 메모리 누수 방지
  const processedEffectIdsRef = useRef<Map<string, number>>(new Map());
  // 힐러 오로라 누적 힐량 추적 (heroId -> accumulatedHeal)
  const accumulatedAuraHealRef = useRef<Map<string, number>>(new Map());
  // 클라이언트: 이전 프레임 사망 상태 추적 (사망 알림 중복 방지)
  const wasClientDeadRef = useRef<boolean>(false);

  const running = useRPGStore((state) => state.running);
  const paused = useRPGStore((state) => state.paused);
  const gameOver = useRPGStore((state) => state.gameOver);

  // 서버 권위 모델: 클라이언트는 게임 로직을 실행하지 않음
  // useNetworkSync의 broadcastGameState, processRemoteInputs는 deprecated

  const tick = useCallback((timestamp: number) => {
    const state = useRPGStore.getState();

    if (!state.running || state.paused || state.gameOver) {
      animationIdRef.current = requestAnimationFrame(tick);
      return;
    }

    // deltaTime 클램핑: 0.05초(50ms) 최대 = 20fps 최소 프레임
    // 0.1초는 너무 높아서 프레임 드랍 시 움직임이 끊겨 보임
    const deltaTime = Math.min((timestamp - lastTimeRef.current) / 1000, 0.05);
    lastTimeRef.current = timestamp;

    // ============================================
    // 서버 권위 모델: 모든 멀티플레이어 클라이언트는 게임 로직 스킵
    // 서버가 게임 로직 실행, 클라이언트는 상태를 받아서 렌더링만
    // ============================================
    const { isMultiplayer, isHost } = state.multiplayer;

    if (isMultiplayer) {
      // 서버 권위 모델: 모든 클라이언트가 동일하게 동작 (isHost 무시)
      // 클라이언트: 이펙트 업데이트 + 로컬 영웅 이동 예측
      effectManager.update(deltaTime);

      // 동기화된 기본 공격 이펙트 처리 (클라이언트) - 적의 영웅 공격 포함
      const clientBasicAttackEffects = useRPGStore.getState().basicAttackEffects;
      const clientNow = Date.now();
      for (const effect of clientBasicAttackEffects) {
        if (!processedEffectIdsRef.current.has(effect.id)) {
          processedEffectIdsRef.current.set(effect.id, clientNow);
          // 보스 기본 공격은 별도 이펙트 사용
          const effectType = effect.type === 'boss'
            ? 'boss_basic_attack'
            : effect.type === 'ranged'
              ? 'attack_ranged'
              : 'attack_melee';
          effectManager.createEffect(effectType, effect.x, effect.y);
          // 사운드도 함께 재생
          const soundType = effect.type === 'ranged' ? 'attack_ranged' : 'attack_melee';
          soundManager.play(soundType);
        }
      }

      // 동기화된 넥서스 레이저 이펙트 처리 (클라이언트)
      // 참고: 레이저 빔 렌더링은 rpgRenderer.ts의 drawNexusLaserBeams에서 처리
      // 여기서는 사운드만 재생 (한 번만)
      const clientLaserEffects = useRPGStore.getState().nexusLaserEffects;
      for (const effect of clientLaserEffects) {
        if (!processedEffectIdsRef.current.has(effect.id)) {
          processedEffectIdsRef.current.set(effect.id, clientNow);
          soundManager.play('laser_attack');
        }
      }

      // 동기화된 보스 스킬 실행 이펙트 처리 (클라이언트)
      // 호스트가 스킬 실행 시 추가한 이펙트를 클라이언트에서 재생
      const clientBossSkillExecutedEffects = useRPGStore.getState().bossSkillExecutedEffects;
      for (const effect of clientBossSkillExecutedEffects) {
        if (!processedEffectIdsRef.current.has(effect.id)) {
          processedEffectIdsRef.current.set(effect.id, clientNow);

          // 스킬 타입별 이펙트 및 사운드
          switch (effect.skillType) {
            case 'smash':
              effectManager.createEffect('boss_smash', effect.x, effect.y);
              soundManager.play('attack_melee');
              break;
            case 'shockwave':
              effectManager.createEffect('boss_shockwave', effect.x, effect.y);
              soundManager.play('warning');
              break;
            case 'summon':
              effectManager.createEffect('boss_summon', effect.x, effect.y);
              soundManager.play('boss_spawn');
              break;
            case 'knockback':
              effectManager.createEffect('boss_knockback', effect.x, effect.y);
              soundManager.play('warning');
              break;
            case 'charge':
              effectManager.createEffect('boss_charge', effect.x, effect.y);
              soundManager.play('warning');
              break;
            case 'heal':
              effectManager.createEffect('boss_heal', effect.x, effect.y);
              soundManager.play('hero_revive');
              // 클라이언트에서도 보스 회복 알림 표시 (회복량 포함)
              if (effect.healPercent) {
                useUIStore.getState().showNotification(`⚠️ 보스가 회복합니다! (+${effect.healPercent}%)`);
              } else {
                useUIStore.getState().showNotification(`⚠️ 보스가 회복합니다!`);
              }
              break;
          }
        }
      }

      // 오래된 이펙트 ID 정리 (1초 이후)
      // Map에 저장된 처리 시간을 사용하여 정확히 정리
      for (const [effectId, processedTime] of processedEffectIdsRef.current) {
        if (clientNow - processedTime > 1000) {
          processedEffectIdsRef.current.delete(effectId);
        }
      }

      const clientHero = useRPGStore.getState().hero;
      const isClientDead = clientHero && clientHero.hp <= 0;

      // 클라이언트: 방금 사망한 경우 알림 (호스트로부터 HP 동기화 받은 후)
      if (isClientDead && !wasClientDeadRef.current) {
        soundManager.play('hero_death');
        useUIStore.getState().showNotification(`사망! ${RPG_CONFIG.REVIVE.BASE_TIME}초 후 부활합니다.`);
      }
      wasClientDeadRef.current = !!isClientDead;

      // 사망 체크: HP가 0 이하면 카메라 추적만 (관전 모드)
      if (isClientDead) {
        // 카메라는 계속 따라가도록 (관전 모드)
        if (useRPGStore.getState().camera.followHero) {
          useRPGStore.getState().setCamera(clientHero.x, clientHero.y);
        }
        animationIdRef.current = requestAnimationFrame(tick);
        return;
      }

      // ==========================================
      // 클라이언트: 스킬 실행 (로컬 이동 예측 전에 수행)
      // - 스킬 이펙트 위치가 현재 영웅 위치로 정확하게 설정됨
      // ==========================================
      const clientCurrentGameTime = useRPGStore.getState().gameTime;

      // 클라이언트: 보류된 W/E 스킬 로컬 실행 (이펙트만)
      // 데미지는 호스트에서 처리하고 동기화됨
      // 중요: 로컬 이동 예측 전에 실행하여 정확한 위치에서 이펙트 생성
      if (pendingSkillRef.current) {
        const skillType = pendingSkillRef.current;
        pendingSkillRef.current = null;
        handleClientSkillExecution(skillType, clientCurrentGameTime);
      }

      // ==========================================
      // 클라이언트: 클라이언트 예측 + 서버 보정 아키텍처
      // - 이동은 클라이언트에서 즉시 예측 (빠른 반응)
      // - 호스트 위치와 차이나면 applySerializedState에서 부드럽게 보정
      // - 돌진 중에는 예측 중지 (호스트 100% 사용)
      // ==========================================

      // 클라이언트 로컬 이동 예측 (즉각적인 반응)
      // clientHero는 이미 위에서 선언됨 (사망 체크용)
      // 스킬 실행 후 최신 상태 가져오기
      const clientHeroForMove = useRPGStore.getState().hero;
      if (clientHeroForMove) {
        const isDashing = clientHeroForMove.dashState !== undefined;
        const isCasting = clientHeroForMove.castingUntil && useRPGStore.getState().gameTime < clientHeroForMove.castingUntil;
        const isStunned = clientHeroForMove.buffs?.some(b => b.type === 'stun' && b.duration > 0);

        // 돌진/시전/스턴 중에는 로컬 예측 중지 (호스트 위치만 사용)
        if (!isDashing && !isCasting && !isStunned && clientHeroForMove.moveDirection) {
          const moveDir = clientHeroForMove.moveDirection;
          const moveSpeed = clientHeroForMove.config?.speed || 200;

          // 로컬 위치 예측 (deltaTime * 60으로 프레임 독립적 이동)
          let newX = clientHeroForMove.x + moveDir.x * moveSpeed * deltaTime * 60;
          let newY = clientHeroForMove.y + moveDir.y * moveSpeed * deltaTime * 60;

          // 맵 경계 제한
          newX = Math.max(30, Math.min(RPG_CONFIG.MAP_WIDTH - 30, newX));
          newY = Math.max(30, Math.min(RPG_CONFIG.MAP_HEIGHT - 30, newY));

          // 로컬 위치 업데이트 (즉각 반응)
          useRPGStore.getState().updateHeroState({
            x: newX,
            y: newY,
            state: 'moving',
            facingRight: moveDir.x >= 0,
          });
        }
      }

      // 카메라 추적
      const heroForCamera = useRPGStore.getState().hero;
      if (heroForCamera && useRPGStore.getState().camera.followHero) {
        useRPGStore.getState().setCamera(heroForCamera.x, heroForCamera.y);
      }

      // 클라이언트도 스킬 쿨다운 로컬 업데이트 (즉각적인 UI 피드백)
      useRPGStore.getState().updateSkillCooldowns(deltaTime);

      // 다른 플레이어 영웅 위치 보간 업데이트 (부드러운 움직임)
      useRPGStore.getState().updateOtherHeroesInterpolation();
      // 적 위치 보간 업데이트 (부드러운 적 움직임)
      useRPGStore.getState().updateEnemiesInterpolation();

      // 클라이언트: 보류 스킬(운석 등) 이펙트/사운드 처리 (데미지는 호스트가 처리)
      const clientPendingSkills = useRPGStore.getState().pendingSkills;
      const pendingSkillGameTime = useRPGStore.getState().gameTime;
      for (const skill of clientPendingSkills) {
        // 스킬 발동 시점에 이펙트/사운드 재생 (한 번만)
        const pendingEffectId = `pending_${skill.type}_${skill.triggerTime}`;
        if (pendingSkillGameTime >= skill.triggerTime && !processedEffectIdsRef.current.has(pendingEffectId)) {
          processedEffectIdsRef.current.set(pendingEffectId, clientNow);

          // 스킬 타입별 이펙트/사운드 처리
          switch (skill.type) {
            case 'mage_e':
              // 운석 폭발 이펙트
              {
                const explosionEffect: SkillEffect = {
                  type: 'mage_meteor' as SkillType,
                  position: { x: skill.position.x, y: skill.position.y },
                  radius: skill.radius,
                  damage: skill.damage,
                  duration: 0.5,
                  startTime: clientCurrentGameTime,
                  heroId: skill.casterId,  // 멀티플레이 이펙트 병합용
                };
                useRPGStore.getState().addSkillEffect(explosionEffect);
                soundManager.play('attack_melee');
              }
              break;
            case 'meteor_shower':
              // 대마법사 메테오 샤워 이펙트
              {
                const meteorEffect: SkillEffect = {
                  type: 'meteor_shower' as SkillType,
                  position: { x: skill.position.x, y: skill.position.y },
                  radius: skill.radius,
                  damage: skill.damage,
                  duration: 2.0,  // 운석 낙하 이펙트 시간
                  startTime: clientCurrentGameTime,
                  heroId: skill.casterId,  // 멀티플레이 이펙트 병합용
                };
                useRPGStore.getState().addSkillEffect(meteorEffect);
                soundManager.play('attack_melee');
              }
              break;
            case 'inferno_burn':
              // 대마법사 인페르노 화상 틱 이펙트
              {
                const burnEffect: SkillEffect = {
                  type: 'inferno_burn' as SkillType,
                  position: { x: skill.position.x, y: skill.position.y },
                  radius: skill.radius,
                  damage: skill.damage,
                  duration: 1.0,
                  startTime: clientCurrentGameTime,
                  heroId: skill.casterId,  // 멀티플레이 이펙트 병합용
                };
                useRPGStore.getState().addSkillEffect(burnEffect);
                soundManager.play('attack_melee');
              }
              break;
            case 'dark_blade':
              // 다크나이트 어둠의 칼날 틱 이펙트
              {
                const darkBladeEffect: SkillEffect = {
                  type: 'dark_blade' as SkillType,
                  position: { x: skill.position.x, y: skill.position.y },
                  radius: skill.radius,
                  damage: skill.damage,
                  duration: 1.0,
                  startTime: clientCurrentGameTime,
                  heroId: skill.casterId,  // 멀티플레이 이펙트 병합용
                };
                useRPGStore.getState().addSkillEffect(darkBladeEffect);
                soundManager.play('attack_melee');
              }
              break;
            case 'spring_of_life':
              // 힐러 생명의 샘 틱 이펙트
              {
                const springEffect: SkillEffect = {
                  type: 'spring_of_life' as SkillType,
                  position: { x: skill.position.x, y: skill.position.y },
                  radius: skill.radius,
                  duration: 1.0,
                  startTime: clientCurrentGameTime,
                  heroId: skill.casterId,  // 멀티플레이 이펙트 병합용
                };
                useRPGStore.getState().addSkillEffect(springEffect);
                soundManager.play('hero_revive');
              }
              break;
            case 'snipe':
              // 저격수 저격 이펙트
              {
                const snipeEffect: SkillEffect = {
                  type: 'snipe' as SkillType,
                  position: { x: skill.position.x, y: skill.position.y },
                  damage: skill.damage,
                  duration: 0.5,
                  startTime: clientCurrentGameTime,
                  heroId: skill.casterId,  // 멀티플레이 이펙트 병합용
                };
                useRPGStore.getState().addSkillEffect(snipeEffect);
                soundManager.play('attack_ranged');
              }
              break;
            default:
              // 기본 이펙트
              effectManager.createEffect('attack_melee', skill.position.x, skill.position.y);
              soundManager.play('attack_melee');
              break;
          }
        }
      }

      // 클라이언트: 자동 공격은 호스트에서만 처리
      // 클라이언트는 호스트로부터 공격 이펙트/사운드만 동기화받음 (위의 basicAttackEffects 처리)

      // 클라이언트: 스킬 이펙트 만료 체크 (로컬 이펙트 정리)
      const clientActiveEffects = useRPGStore.getState().activeSkillEffects;
      const clientGameTimeForEffects = useRPGStore.getState().gameTime;
      const clientExpiredEffects: number[] = [];

      clientActiveEffects.forEach((effect, index) => {
        if (clientGameTimeForEffects - effect.startTime >= effect.duration) {
          clientExpiredEffects.push(index);
        }
      });

      // 만료된 이펙트 제거 (역순으로)
      for (let i = clientExpiredEffects.length - 1; i >= 0; i--) {
        useRPGStore.getState().removeSkillEffect(clientExpiredEffects[i]);
      }

      animationIdRef.current = requestAnimationFrame(tick);
      return;
    }

    // ============================================
    // 싱글플레이어: 클라이언트가 게임 로직 실행
    // ============================================

    // 게임 시간 업데이트
    useRPGStore.getState().updateGameTime(deltaTime);

    // 영웅 없으면 스킵
    if (!state.hero) {
      animationIdRef.current = requestAnimationFrame(tick);
      return;
    }

    // 부활 체크 (사망 후 일정 시간 경과 시 부활)
    const hostDeathTime = state.hero.deathTime;
    const isHostDead = state.hero.hp <= 0 && hostDeathTime !== undefined;
    if (isHostDead && hostDeathTime !== undefined) {
      const timeSinceDeath = state.gameTime - hostDeathTime;
      const reviveTime = RPG_CONFIG.REVIVE.BASE_TIME;

      if (timeSinceDeath >= reviveTime) {
        useRPGStore.getState().reviveHero();
        soundManager.play('hero_revive');
        const showNotification = useUIStore.getState().showNotification;
        showNotification('부활했습니다! (2초간 무적)');
      }

      // 싱글/멀티 모두: 사망해도 게임 로직 계속 실행 (적 AI, 넥서스 데미지 등)
      // 영웅 관련 로직(스킬, 자동공격)만 스킵됨
    }

    // 버프 업데이트 (스킬 쿨다운보다 먼저 처리하여 만료된 버프가 쿨다운 계산에 영향 안 줌)
    useRPGStore.getState().updateBuffs(deltaTime);

    // 스킬 쿨다운 업데이트 (호스트가 살아있을 때만)
    if (!isHostDead) {
      useRPGStore.getState().updateSkillCooldowns(deltaTime);
    }

    // 자동 공격: 적이 사거리 내에 있고 Q 스킬이 준비되면 자동 발동 (호스트가 살아있을 때만)
    // 단, 돌진 중이거나 시전 중이거나 스턴 상태일 때는 공격 불가
    const heroForAutoAttack = useRPGStore.getState().hero;
    const autoAttackGameTime = useRPGStore.getState().gameTime;
    const isHeroCasting = heroForAutoAttack?.castingUntil && autoAttackGameTime < heroForAutoAttack.castingUntil;
    const isHeroStunned = heroForAutoAttack?.buffs?.some(b => b.type === 'stun' && b.duration > 0);
    if (!isHostDead && heroForAutoAttack && !heroForAutoAttack.dashState && !isHeroCasting && !isHeroStunned) {
      const heroClass = heroForAutoAttack.heroClass;
      const qSkillType = CLASS_SKILLS[heroClass].q.type;
      const qSkill = heroForAutoAttack.skills.find(s => s.type === qSkillType);

      if (qSkill && qSkill.currentCooldown <= 0) {
        // 공격 사거리 내 가장 가까운 적 찾기
        const attackRange = heroForAutoAttack.config.range || 80;
        const nearestEnemy = findNearestEnemy(heroForAutoAttack, state.enemies);

        let attackedTarget = false;

        if (nearestEnemy) {
          const dist = distance(heroForAutoAttack.x, heroForAutoAttack.y, nearestEnemy.x, nearestEnemy.y);
          if (dist <= attackRange) {
            // 적 방향으로 마우스 위치 설정 후 Q 스킬 실행
            useRPGStore.getState().setMousePosition(nearestEnemy.x, nearestEnemy.y);
            useRPGStore.getState().useSkill(qSkillType);
            pendingSkillRef.current = qSkillType;
            attackedTarget = true;

            // 사운드 재생
            if (heroClass === 'archer' || heroClass === 'mage') {
              soundManager.play('attack_ranged');
            } else {
              soundManager.play('attack_melee');
            }

            // 멀티플레이어: 기본 공격 이펙트 동기화 (클라이언트에서도 사운드 재생)
            const mpState = useRPGStore.getState().multiplayer;
            if (mpState.isMultiplayer && mpState.isHost) {
              useRPGStore.getState().addBasicAttackEffect({
                id: `hero_attack_${Date.now()}_${heroForAutoAttack.id}`,
                type: heroClass === 'archer' || heroClass === 'mage' ? 'ranged' : 'melee',
                x: nearestEnemy.x,
                y: nearestEnemy.y,
                timestamp: Date.now(),
              });
            }
          }
        }

        // 적이 사거리 내에 없으면 적 기지 공격 시도
        if (!attackedTarget) {
          const enemyBases = useRPGStore.getState().enemyBases;
          const nearestBase = findNearestEnemyBase(heroForAutoAttack, enemyBases);

          if (nearestBase) {
            const baseDist = distance(heroForAutoAttack.x, heroForAutoAttack.y, nearestBase.x, nearestBase.y);
            // 기지는 크기가 크므로 사거리 + 기지 반경으로 계산 (기지 반경 약 50)
            const baseAttackRange = attackRange + 50;
            if (baseDist <= baseAttackRange) {
              // 기지 방향으로 마우스 위치 설정
              useRPGStore.getState().setMousePosition(nearestBase.x, nearestBase.y);

              // 기지에 직접 데미지 적용 (스킬 쿨다운 시작)
              useRPGStore.getState().useSkill(qSkillType);

              // 영웅 공격력 계산 (업그레이드 보너스 포함)
              const baseAttack = heroForAutoAttack.baseAttack;
              const upgradeLevels = useRPGStore.getState().upgradeLevels;
              const attackBonus = upgradeLevels.attack * UPGRADE_CONFIG.attack.perLevel; // 업그레이드당 공격력
              let totalAttack = baseAttack + attackBonus;

              // 마법사 보스 데미지 보너스는 기지에 적용되지 않음 (보스에게만 적용)

              // 광전사 버프 공격력 보너스 적용 - duration > 0인 경우만 유효
              const hostBerserkerBuff = heroForAutoAttack.buffs?.find(b => b.type === 'berserker' && b.duration > 0);
              if (hostBerserkerBuff?.attackBonus) {
                totalAttack = Math.floor(totalAttack * (1 + hostBerserkerBuff.attackBonus));
              }

              // 기지에 데미지 적용 (attackerId 전달로 골드 배분용 공격자 추적)
              const myHeroId = state.multiplayer.myHeroId || state.hero?.id;
              const { destroyed, goldReceived } = useRPGStore.getState().damageBase(nearestBase.id, totalAttack, myHeroId);

              // 기지 데미지 숫자 표시
              useRPGStore.getState().addDamageNumber(nearestBase.x, nearestBase.y, totalAttack, 'damage');

              // 이펙트 및 사운드
              effectManager.createEffect('attack_melee', nearestBase.x, nearestBase.y);
              if (heroClass === 'archer' || heroClass === 'mage') {
                soundManager.play('attack_ranged');
              } else {
                soundManager.play('attack_melee');
              }

              // 멀티플레이어: 기본 공격 이펙트 동기화 (클라이언트에서도 사운드 재생)
              const baseMpState = useRPGStore.getState().multiplayer;
              if (baseMpState.isMultiplayer && baseMpState.isHost) {
                useRPGStore.getState().addBasicAttackEffect({
                  id: `hero_attack_base_${Date.now()}_${heroForAutoAttack.id}`,
                  type: heroClass === 'archer' || heroClass === 'mage' ? 'ranged' : 'melee',
                  x: nearestBase.x,
                  y: nearestBase.y,
                  timestamp: Date.now(),
                });
              }

              // 기지 파괴 시 알림
              if (destroyed) {
                const showNotification = useUIStore.getState().showNotification;
                if (goldReceived > 0) {
                  showNotification(`적 기지 파괴! (+${goldReceived} 골드)`);
                } else {
                  showNotification(`적 기지 파괴!`);
                }
                soundManager.play('victory');
              }
            }
          }
        }
      }
    }

    // 보류된 스킬 처리
    if (pendingSkillRef.current) {
      const skillType = pendingSkillRef.current;
      pendingSkillRef.current = null;
      handleSkillExecution(skillType, state.gameTime);
    }

    // 영웅 업데이트 - 스킬 실행 후 최신 상태에서 영웅 가져오기
    const currentHeroForUpdate = useRPGStore.getState().hero;
    if (!currentHeroForUpdate) {
      animationIdRef.current = requestAnimationFrame(tick);
      return;
    }
    const heroResult = updateHeroUnit(currentHeroForUpdate, deltaTime, state.enemies, state.gameTime);
    const updatedHero = heroResult.hero;

    // 영웅 상태 업데이트 (위치, 돌진 상태, 시전 상태, 이동 상태 등)
    // 참고: 영웅 공격 데미지 처리는 handleSkillExecution → executeQSkill → processSkillResult에서 수행됨
    // updateHeroUnit은 이동과 상태 업데이트만 담당 (데미지 처리 없음)
    useRPGStore.getState().updateHeroState({
      x: updatedHero.x,
      y: updatedHero.y,
      state: updatedHero.state,
      dashState: updatedHero.dashState,
      targetPosition: updatedHero.targetPosition,
      castingUntil: updatedHero.castingUntil,
    });

    // 카메라 영웅 추적
    if (state.camera.followHero) {
      useRPGStore.getState().setCamera(updatedHero.x, updatedHero.y);
    }

    // HP 재생 처리 (기사: 패시브, 전사/기사: SP hpRegen 업그레이드)
    // 사망 상태(hp <= 0)에서는 HP 재생 적용 안함
    const heroForRegen = useRPGStore.getState().hero;
    if (heroForRegen && heroForRegen.hp > 0 && heroForRegen.hp < heroForRegen.maxHp) {
      const heroClass = heroForRegen.heroClass;
      let totalRegen = 0;

      // 기사 패시브 HP 재생 (캐릭터 레벨 5 이상 시 활성화)
      if (heroClass === 'knight') {
        const classConfig = CLASS_CONFIGS[heroClass];
        const baseRegen = heroForRegen.characterLevel >= PASSIVE_UNLOCK_LEVEL ? (classConfig.passive.hpRegen || 0) : 0;
        const growthRegen = heroForRegen.passiveGrowth?.currentValue || 0;
        totalRegen += baseRegen + growthRegen;
      }

      // SP hpRegen 업그레이드 보너스 (전사, 기사만)
      if ((heroClass === 'warrior' || heroClass === 'knight') && heroForRegen.statUpgrades) {
        const hpRegenBonus = getStatBonus('hpRegen', heroForRegen.statUpgrades.hpRegen);
        totalRegen += hpRegenBonus;
      }

      if (totalRegen > 0) {
        const regenAmount = totalRegen * deltaTime;
        const newHp = Math.min(heroForRegen.maxHp, heroForRegen.hp + regenAmount);
        useRPGStore.getState().updateHeroState({ hp: newHp });
      }
    }

    // 다른 플레이어 HP 재생 처리 (기사 패시브 + SP hpRegen)
    const otherHeroesForRegen = useRPGStore.getState().otherHeroes;
    otherHeroesForRegen.forEach((otherHero, otherHeroId) => {
      if (otherHero.hp <= 0 || otherHero.hp >= otherHero.maxHp) return;

      const otherHeroClass = otherHero.heroClass;
      let otherTotalRegen = 0;

      // 기사 패시브 HP 재생
      if (otherHeroClass === 'knight') {
        const classConfig = CLASS_CONFIGS[otherHeroClass];
        const baseRegen = otherHero.characterLevel >= PASSIVE_UNLOCK_LEVEL ? (classConfig.passive.hpRegen || 0) : 0;
        const growthRegen = otherHero.passiveGrowth?.currentValue || 0;
        otherTotalRegen += baseRegen + growthRegen;
      }

      // SP hpRegen 업그레이드 보너스 (전사, 기사만)
      if ((otherHeroClass === 'warrior' || otherHeroClass === 'knight') && otherHero.statUpgrades) {
        const hpRegenBonus = getStatBonus('hpRegen', otherHero.statUpgrades.hpRegen);
        otherTotalRegen += hpRegenBonus;
      }

      if (otherTotalRegen > 0) {
        const regenAmount = otherTotalRegen * deltaTime;
        const newHp = Math.min(otherHero.maxHp, otherHero.hp + regenAmount);
        useRPGStore.getState().updateOtherHero(otherHeroId, { hp: newHp });
      }
    });

    // ============================================
    // 힐러 오로라 힐 처리 (주변 아군 초당 회복, 본인 포함)
    // ============================================
    const allHeroesForAura: HeroUnit[] = [];
    const auraHeroState = useRPGStore.getState().hero;
    const auraOtherHeroes = useRPGStore.getState().otherHeroes;

    // 모든 살아있는 영웅 수집
    if (auraHeroState && auraHeroState.hp > 0) {
      allHeroesForAura.push(auraHeroState);
    }
    auraOtherHeroes.forEach((h) => {
      if (h.hp > 0) allHeroesForAura.push(h);
    });

    // 힐러 오로라 처리 (모든 힐러 영웅에 대해)
    for (const healer of allHeroesForAura) {
      // 힐러 전직인지 확인
      if (healer.advancedClass !== 'healer') continue;

      // 힐러가 살아있어야 함
      if (healer.hp <= 0) continue;

      // 힐러 오로라 설정 가져오기
      const healerConfig = ADVANCED_CLASS_CONFIGS.healer;
      const healAura = healerConfig.specialEffects.healAura;
      if (!healAura) continue;

      const auraRadius = healAura.radius;
      const healPerSecond = healAura.healPerSecond;

      // 범위 내 아군에게 힐 적용 (본인 포함)
      for (const ally of allHeroesForAura) {
        // 살아있고, 체력이 풀피가 아닌 경우만
        if (ally.hp <= 0 || ally.hp >= ally.maxHp) continue;

        // 거리 계산
        const dist = distance(healer.x, healer.y, ally.x, ally.y);
        if (dist > auraRadius) continue;

        // 힐량 계산 (최대 HP의 4% * deltaTime)
        const healAmount = ally.maxHp * healPerSecond * deltaTime;
        const actualHeal = Math.min(ally.maxHp - ally.hp, healAmount);
        const newHp = ally.hp + actualHeal;

        // 힐 적용
        if (auraHeroState && ally.id === auraHeroState.id) {
          useRPGStore.getState().updateHeroState({ hp: newHp });
        } else {
          useRPGStore.getState().updateOtherHero(ally.id, { hp: newHp });
        }

        // 누적 힐량 추적 및 주기적으로 힐 숫자 표시
        if (actualHeal > 0) {
          const prevAccum = accumulatedAuraHealRef.current.get(ally.id) || 0;
          const newAccum = prevAccum + actualHeal;
          const HEAL_NUMBER_THRESHOLD = 10; // 10 이상 누적되면 표시
          if (newAccum >= HEAL_NUMBER_THRESHOLD) {
            useRPGStore.getState().addDamageNumber(ally.x, ally.y - 30, Math.round(newAccum), 'heal');
            accumulatedAuraHealRef.current.set(ally.id, 0);
          } else {
            accumulatedAuraHealRef.current.set(ally.id, newAccum);
          }
        }
      }
    }

    // 시야 업데이트
    useRPGStore.getState().updateVisibility();

    // 적 AI 업데이트 (넥서스 타겟팅 버전)
    const currentHeroState = useRPGStore.getState().hero;
    const currentEnemies = useRPGStore.getState().enemies;
    const currentNexus = useRPGStore.getState().nexus;
    const currentOtherHeroes = useRPGStore.getState().otherHeroes;

    if (currentHeroState) {
      // 멀티플레이어 모드: 살아있는 영웅만 수집
      const allHeroes: HeroUnit[] = [];
      // 호스트 영웅도 살아있을 때만 추가
      if (currentHeroState.hp > 0) {
        allHeroes.push(currentHeroState);
      }
      if (isMultiplayer && currentOtherHeroes.size > 0) {
        currentOtherHeroes.forEach(hero => {
          if (hero.hp > 0) {
            allHeroes.push(hero);
          }
        });
      }

      let updatedEnemies: typeof currentEnemies;
      let totalNexusDamage = 0;

      if (isMultiplayer) {
        // 멀티플레이어: 모든 영웅을 고려한 AI (살아있는 영웅이 없어도 넥서스 공격 처리)
        const result = updateAllEnemiesAINexusMultiplayer(
          currentEnemies,
          allHeroes,
          currentNexus,
          deltaTime,
          state.gameTime
        );

        updatedEnemies = result.updatedEnemies;
        totalNexusDamage = result.totalNexusDamage;

        // 각 영웅에게 데미지 적용
        result.heroDamages.forEach((rawDamage, heroId) => {
          if (rawDamage <= 0) return;

          const targetHero = heroId === currentHeroState.id
            ? currentHeroState
            : currentOtherHeroes.get(heroId);

          if (!targetHero) return;
          if (targetHero.hp <= 0) return;  // 사망한 영웅에게 데미지 적용 안 함

          const finalDamage = calculateDamageAfterReduction(rawDamage, targetHero);

          // 공격자 정보 확인 (보스 공격 이펙트용)
          const attackerInfo = result.heroAttackers.get(heroId);
          const isBossAttack = attackerInfo?.attackerType === 'boss';
          const effectType = isBossAttack ? 'boss_basic_attack' : 'attack_melee';
          const attackEffectType = isBossAttack ? 'boss' : 'melee';

          if (heroId === currentHeroState.id) {
            // 호스트 영웅 데미지
            const wasHostDead = currentHeroState.hp <= 0;
            useRPGStore.getState().damageHero(finalDamage);
            const heroAfterHostDamage = useRPGStore.getState().hero;
            const isHostDead = heroAfterHostDamage && heroAfterHostDamage.hp <= 0;

            // 방금 사망한 경우 알림 (부활 시스템)
            if (isHostDead && !wasHostDead) {
              soundManager.play('hero_death');
              const showNotification = useUIStore.getState().showNotification;
              showNotification(`사망! ${RPG_CONFIG.REVIVE.BASE_TIME}초 후 부활합니다.`);
            }

            effectManager.createEffect(effectType, currentHeroState.x, currentHeroState.y);
            // 피격 데미지 숫자 표시 (적 공격 - 빨간색)
            useRPGStore.getState().addDamageNumber(currentHeroState.x, currentHeroState.y, finalDamage, 'enemy_damage');
            // 피격 이펙트 동기화 (클라이언트에서도 표시)
            useRPGStore.getState().addBasicAttackEffect({
              id: `enemy_attack_${Date.now()}_${heroId}`,
              type: attackEffectType,
              x: currentHeroState.x,
              y: currentHeroState.y,
              timestamp: Date.now(),
              attackerId: attackerInfo?.attackerId,
            });
          } else {
            // 다른 플레이어 영웅 데미지
            const otherHero = currentOtherHeroes.get(heroId);
            if (otherHero) {
              const newHp = Math.max(0, otherHero.hp - finalDamage);
              const wasDead = otherHero.hp <= 0;
              const isDead = newHp <= 0;

              // 사망 시 deathTime 설정 (부활 시스템용)
              if (isDead && !wasDead && !otherHero.deathTime) {
                useRPGStore.getState().updateOtherHero(heroId, {
                  hp: newHp,
                  deathTime: state.gameTime,
                  moveDirection: undefined,  // 이동 중지
                });
                soundManager.play('hero_death');
              } else {
                useRPGStore.getState().updateOtherHero(heroId, { hp: newHp });
              }
              effectManager.createEffect(effectType, otherHero.x, otherHero.y);
              // 피격 데미지 숫자 표시 (적 공격 - 빨간색)
              useRPGStore.getState().addDamageNumber(otherHero.x, otherHero.y, finalDamage, 'enemy_damage');
              // 피격 이펙트 동기화 (클라이언트에서도 표시)
              useRPGStore.getState().addBasicAttackEffect({
                id: `enemy_attack_${Date.now()}_${heroId}`,
                type: attackEffectType,
                x: otherHero.x,
                y: otherHero.y,
                timestamp: Date.now(),
                attackerId: attackerInfo?.attackerId,
              });
            }
          }
          soundManager.play('attack_melee');
        });

        // 게임 종료 조건: 넥서스 파괴 시에만 (플레이어 사망은 부활로 처리)
      } else {
        // 싱글플레이어: 기존 로직
        const result = updateAllEnemiesAINexus(
          currentEnemies,
          currentHeroState,
          currentNexus,
          deltaTime,
          state.gameTime
        );

        updatedEnemies = result.updatedEnemies;
        totalNexusDamage = result.totalNexusDamage;

        // 영웅 데미지 적용 (데미지 감소 버프 적용)
        if (result.totalHeroDamage > 0) {
          const finalDamage = calculateDamageAfterReduction(result.totalHeroDamage, currentHeroState);
          useRPGStore.getState().damageHero(finalDamage);

          // 보스 공격 여부에 따른 이펙트 타입 결정
          const isBossAttack = result.attackerInfo?.attackerType === 'boss';
          const effectType = isBossAttack ? 'boss_basic_attack' : 'attack_melee';
          effectManager.createEffect(effectType, updatedHero.x, updatedHero.y);
          soundManager.play('attack_melee');
          // 피격 데미지 숫자 표시 (적 공격 - 빨간색)
          useRPGStore.getState().addDamageNumber(updatedHero.x, updatedHero.y, finalDamage, 'enemy_damage');

          // 사망 체크 (부활 시스템으로 처리됨 - gameOver 설정하지 않음)
          const heroAfterDamage = useRPGStore.getState().hero;
          if (heroAfterDamage && heroAfterDamage.hp <= 0 && heroAfterDamage.deathTime) {
            soundManager.play('hero_death');
            const showNotification = useUIStore.getState().showNotification;
            showNotification(`사망! ${RPG_CONFIG.REVIVE.BASE_TIME}초 후 부활합니다.`);
          }
        }
      }

      // 넥서스 데미지 적용
      if (totalNexusDamage > 0) {
        useRPGStore.getState().damageNexus(totalNexusDamage);

        // 넥서스 파괴 체크
        const nexusAfterDamage = useRPGStore.getState().nexus;
        if (!nexusAfterDamage || nexusAfterDamage.hp <= 0) {
          useRPGStore.getState().setGameOver(false);
          soundManager.play('defeat');
          // 멀티플레이어: 클라이언트들에게 게임 종료 알림 (stats 포함)
          const mpState = useRPGStore.getState().multiplayer;
          if (mpState.isMultiplayer && mpState.isHost) {
            const finalStats = useRPGStore.getState().stats;
            wsClient.hostBroadcastGameOver({ victory: false, stats: finalStats });
          }
          return;
        }
      }

      // ============================================
      // 넥서스 레이저 공격 처리
      // ============================================
      const latestNexus = useRPGStore.getState().nexus;
      if (isNexusAlive(latestNexus)) {
        const laserResult = processNexusLaser(latestNexus!, updatedEnemies, deltaTime);

        // 넥서스 쿨다운 업데이트
        if (laserResult.updatedNexus.laserCooldown !== latestNexus!.laserCooldown) {
          useRPGStore.setState({ nexus: laserResult.updatedNexus });
        }

        // 레이저 이펙트 추가 (네트워크 동기화 + 사운드)
        // 참고: 레이저 빔 렌더링은 rpgRenderer.ts의 drawNexusLaserBeams에서 처리
        for (const effect of laserResult.laserEffects) {
          useRPGStore.getState().addNexusLaserEffect(effect);
          soundManager.play('laser_attack');
        }

        // 레이저 데미지 적용
        for (const { enemyId, damage } of laserResult.damagedEnemies) {
          const targetEnemy = updatedEnemies.find(e => e.id === enemyId);
          if (targetEnemy) {
            targetEnemy.hp -= damage;
            // 넥서스 레이저는 데미지 숫자 표시하지 않음 (시각적으로 너무 복잡해짐)
            if (targetEnemy.hp <= 0) {
              // 넥서스가 처치한 경우 - 호스트에게 골드 (또는 아무도 안 받음)
              // 여기서는 간단히 아무도 골드를 받지 않도록 처리
              useRPGStore.getState().incrementKills();
            }
          }
        }
      }

      // 오래된 넥서스 레이저 이펙트 정리
      useRPGStore.getState().cleanNexusLaserEffects();

      // 적 상태 업데이트
      useRPGStore.getState().updateEnemies(updatedEnemies.filter((e) => e.hp > 0));

      // ============================================
      // 보스 돌진 이동 처리 (자연스러운 이동)
      // ============================================
      const dashingBosses = useRPGStore.getState().enemies.filter(e => e.type === 'boss' && e.dashState);
      if (dashingBosses.length > 0) {
        const dashUpdatedEnemies = useRPGStore.getState().enemies.map(enemy => {
          if (enemy.type !== 'boss' || !enemy.dashState) return enemy;

          const dash = enemy.dashState;
          const newProgress = dash.progress + deltaTime / dash.duration;

          if (newProgress >= 1) {
            // 돌진 완료 - 목표 위치에 도착
            return {
              ...enemy,
              x: dash.targetX,
              y: dash.targetY,
              dashState: undefined,
            };
          } else {
            // 돌진 중 - 위치 보간
            const newX = dash.startX + (dash.targetX - dash.startX) * newProgress;
            const newY = dash.startY + (dash.targetY - dash.startY) * newProgress;
            return {
              ...enemy,
              x: newX,
              y: newY,
              dashState: { ...dash, progress: newProgress },
            };
          }
        });
        useRPGStore.getState().updateEnemies(dashUpdatedEnemies);
      }

      // ============================================
      // 보스 스킬 처리 (난이도별)
      // ============================================
      const latestEnemies = useRPGStore.getState().enemies;
      const bossEnemies = latestEnemies.filter(e => e.type === 'boss' && e.hp > 0);

      for (const boss of bossEnemies) {
        // 모든 살아있는 영웅 수집
        const allLivingHeroes: HeroUnit[] = [];
        const latestHero = useRPGStore.getState().hero;
        if (latestHero && latestHero.hp > 0) {
          allLivingHeroes.push(latestHero);
        }
        const latestOtherHeroes = useRPGStore.getState().otherHeroes;
        latestOtherHeroes.forEach(h => {
          if (h.hp > 0) allLivingHeroes.push(h);
        });

        // 보스 스킬 업데이트
        const bossSkillResult = updateBossSkills(boss, allLivingHeroes, state.gameTime, deltaTime);

        // 보스 상태 업데이트
        const updatedEnemyList = useRPGStore.getState().enemies.map(e =>
          e.id === boss.id ? bossSkillResult.updatedBoss : e
        );
        useRPGStore.getState().updateEnemies(updatedEnemyList);

        // 스킬 경고 추가
        for (const warning of bossSkillResult.newWarnings) {
          useRPGStore.getState().addBossSkillWarning(warning);
        }

        // 스킬 데미지 적용
        bossSkillResult.heroDamages.forEach((damage, heroId) => {
          // 최신 상태에서 영웅 정보 가져오기 (여러 보스가 같은 프레임에서 데미지 처리 시 stale 참조 방지)
          const currentState = useRPGStore.getState();
          const currentHero = currentState.hero;
          const currentOtherHeroes = currentState.otherHeroes;

          const targetHero = heroId === currentHero?.id
            ? currentHero
            : currentOtherHeroes.get(heroId);

          if (!targetHero) return;
          if (targetHero.hp <= 0) return;  // 사망한 영웅에게 데미지 적용 안 함

          const finalDamage = calculateDamageAfterReduction(damage, targetHero);

          if (heroId === currentHero?.id) {
            useRPGStore.getState().damageHero(finalDamage);
            effectManager.createEffect('boss_smash', targetHero.x, targetHero.y);
            // 피격 데미지 숫자 표시 (보스 공격 - 빨간색)
            useRPGStore.getState().addDamageNumber(targetHero.x, targetHero.y, finalDamage, 'enemy_damage');
            // 보스 스킬 피격 이펙트 동기화 (클라이언트에서도 표시)
            useRPGStore.getState().addBasicAttackEffect({
              id: `boss_skill_hit_${Date.now()}_${heroId}`,
              type: 'melee',
              x: targetHero.x,
              y: targetHero.y,
              timestamp: Date.now(),
            });
          } else {
            const otherHero = currentOtherHeroes.get(heroId);
            if (otherHero) {
              // 최신 HP를 사용하여 새 HP 계산 (stale 상태 방지)
              const newHp = Math.max(0, otherHero.hp - finalDamage);
              const wasDead = otherHero.hp <= 0;
              const isDead = newHp <= 0;

              // 사망 시 deathTime 설정 (부활 시스템용)
              if (isDead && !wasDead && !otherHero.deathTime) {
                useRPGStore.getState().updateOtherHero(heroId, {
                  hp: newHp,
                  deathTime: state.gameTime,
                  moveDirection: undefined,  // 이동 중지
                });
                soundManager.play('hero_death');
              } else {
                useRPGStore.getState().updateOtherHero(heroId, { hp: newHp });
              }
              effectManager.createEffect('boss_smash', otherHero.x, otherHero.y);
              // 피격 데미지 숫자 표시 (보스 공격 - 빨간색)
              useRPGStore.getState().addDamageNumber(otherHero.x, otherHero.y, finalDamage, 'enemy_damage');
              // 보스 스킬 피격 이펙트 동기화 (클라이언트에서도 표시)
              useRPGStore.getState().addBasicAttackEffect({
                id: `boss_skill_hit_${Date.now()}_${heroId}`,
                type: 'melee',
                x: otherHero.x,
                y: otherHero.y,
                timestamp: Date.now(),
              });
            }
          }
          soundManager.play('attack_melee');
        });

        // 스턴 적용
        bossSkillResult.stunnedHeroes.forEach((stunDuration, heroId) => {
          // 최신 상태에서 영웅 정보 가져오기 (stale 참조 방지)
          const stunState = useRPGStore.getState();
          const stunHero = stunState.hero;
          const stunOtherHeroes = stunState.otherHeroes;

          const targetHero = heroId === stunHero?.id
            ? stunHero
            : stunOtherHeroes.get(heroId);

          if (!targetHero) return;
          if (targetHero.hp <= 0) return;  // 사망한 영웅에게 스턴 적용 안 함

          // 무적 상태 영웅에게 스턴 적용 안 함 (부활 무적, 돌진 무적 등)
          const isInvincible = targetHero.buffs?.some(b => b.type === 'invincible' && b.duration > 0);
          if (isInvincible) return;

          // 돌진 중인 영웅에게 스턴 적용 안 함 (unstoppable 상태)
          if (targetHero.dashState) return;

          if (heroId === stunHero?.id) {
            const stunnedHero = applyStunToHero(targetHero, stunDuration, state.gameTime);
            useRPGStore.getState().updateHeroState(stunnedHero);
          } else {
            const stunnedHero = applyStunToHero(targetHero, stunDuration, state.gameTime);
            useRPGStore.getState().updateOtherHero(heroId, stunnedHero);
          }
          effectManager.createEffect('stun', targetHero.x, targetHero.y);
        });

        // 소환된 적 추가
        for (const summonedEnemy of bossSkillResult.summonedEnemies) {
          useRPGStore.getState().addEnemy(summonedEnemy);
          effectManager.createEffect('boss_summon', summonedEnemy.x, summonedEnemy.y);
        }

        // 밀어내기(knockback) 처리 - 영웅 위치 변경
        bossSkillResult.knockbackHeroes.forEach((newPos, heroId) => {
          // 최신 상태에서 영웅 정보 가져오기 (stale 참조 방지)
          const kbState = useRPGStore.getState();
          const kbHero = kbState.hero;
          const kbOtherHeroes = kbState.otherHeroes;

          const targetHero = heroId === kbHero?.id
            ? kbHero
            : kbOtherHeroes.get(heroId);

          // 사망한 영웅에게 넉백 적용 안 함
          if (!targetHero || targetHero.hp <= 0) return;

          // 무적 상태 영웅에게 넉백 적용 안 함 (부활 무적, 돌진 무적 등)
          const isInvincible = targetHero.buffs?.some(b => b.type === 'invincible' && b.duration > 0);
          if (isInvincible) return;

          // 돌진 중인 영웅에게 넉백 적용 안 함 (unstoppable 상태)
          if (targetHero.dashState) return;

          if (heroId === kbHero?.id) {
            useRPGStore.getState().updateHeroState({ x: newPos.x, y: newPos.y });
            effectManager.createEffect('boss_knockback', newPos.x, newPos.y);
          } else {
            useRPGStore.getState().updateOtherHero(heroId, { x: newPos.x, y: newPos.y });
            effectManager.createEffect('boss_knockback', newPos.x, newPos.y);
          }
        });

        // 돌진(charge) 처리 - 보스 dashState 설정 (자연스러운 이동)
        if (bossSkillResult.bossDashState) {
          const bossEnemyList = useRPGStore.getState().enemies.map(e =>
            e.id === boss.id
              ? { ...e, dashState: bossSkillResult.bossDashState }
              : e
          );
          useRPGStore.getState().updateEnemies(bossEnemyList);
        }

        // 회복(heal) 처리 - 보스 HP 회복
        if (bossSkillResult.bossHeal && bossSkillResult.bossHeal > 0) {
          const healAmount = bossSkillResult.bossHeal;
          const bossHealList = useRPGStore.getState().enemies.map(e =>
            e.id === boss.id
              ? { ...e, hp: Math.min(e.maxHp, e.hp + healAmount) }
              : e
          );
          useRPGStore.getState().updateEnemies(bossHealList);
          effectManager.createEffect('boss_heal', boss.x, boss.y);
        }

        // 스킬 실행 시 이펙트 및 사운드
        if (bossSkillResult.skillExecuted) {
          const skillType = bossSkillResult.skillExecuted;
          const healPercent = skillType === 'heal' ? Math.round((bossSkillResult.bossHeal || 0) / boss.maxHp * 100) : undefined;

          // 멀티플레이어: 클라이언트 동기화용 이펙트 추가
          if (isMultiplayer && isHost) {
            useRPGStore.getState().addBossSkillExecutedEffect({
              id: `boss_skill_${skillType}_${Date.now()}_${boss.id}`,
              skillType,
              x: boss.x,
              y: boss.y,
              timestamp: Date.now(),
              healPercent,
            });
          }

          // 호스트/싱글플레이: 로컬 이펙트 즉시 재생
          if (skillType === 'smash') {
            effectManager.createEffect('boss_smash', boss.x, boss.y);
            soundManager.play('attack_melee');
          } else if (skillType === 'shockwave') {
            effectManager.createEffect('boss_shockwave', boss.x, boss.y);
            soundManager.play('warning');
          } else if (skillType === 'summon') {
            effectManager.createEffect('boss_summon', boss.x, boss.y);
            soundManager.play('boss_spawn');
          } else if (skillType === 'knockback') {
            effectManager.createEffect('boss_knockback', boss.x, boss.y);
            soundManager.play('warning');
          } else if (skillType === 'charge') {
            effectManager.createEffect('boss_charge', boss.x, boss.y);
            soundManager.play('warning');
          } else if (skillType === 'heal') {
            effectManager.createEffect('boss_heal', boss.x, boss.y);
            soundManager.play('hero_revive');
            // 보스 회복 알림 표시
            useUIStore.getState().showNotification(`⚠️ 보스가 회복합니다! (+${healPercent}%)`);
          }
        }
      }

      // 보스 스킬 경고 업데이트 (만료된 것 제거)
      useRPGStore.getState().updateBossSkillWarnings(state.gameTime);
    }

    // 보류 스킬 처리 (운석 낙하 등)
    const pendingSkills = useRPGStore.getState().pendingSkills;
    const currentGameTime = useRPGStore.getState().gameTime;
    const triggeredSkills: number[] = [];

    pendingSkills.forEach((skill, index) => {
      if (currentGameTime >= skill.triggerTime) {
        triggeredSkills.push(index);

        const enemies = useRPGStore.getState().enemies;

        // 단일 타겟 스킬 처리 (스나이퍼 저격 등)
        if (skill.targetId) {
          const targetEnemy = enemies.find(e => e.id === skill.targetId);
          if (targetEnemy && targetEnemy.hp > 0) {
            const killed = useRPGStore.getState().damageEnemy(targetEnemy.id, skill.damage, skill.casterId);
            // 저격은 항상 크리티컬로 표시 (1000% 데미지)
            useRPGStore.getState().addDamageNumber(targetEnemy.x, targetEnemy.y, skill.damage, 'critical');
            if (killed) {
              useRPGStore.getState().removeEnemy(targetEnemy.id);
            }
            // 저격 이펙트
            if (skill.type === 'snipe') {
              const snipeEffect: SkillEffect = {
                type: 'snipe' as SkillType,
                position: { x: targetEnemy.x, y: targetEnemy.y },
                damage: skill.damage,
                duration: 0.5,
                startTime: currentGameTime,
                heroId: skill.casterId,  // 멀티플레이 이펙트 병합용
              };
              useRPGStore.getState().addSkillEffect(snipeEffect);
              soundManager.play('attack_ranged');
            } else {
              effectManager.createEffect('attack_melee', targetEnemy.x, targetEnemy.y);
              soundManager.play('attack_melee');
            }
          }
        } else {
          // 범위 내 적에게 데미지 (운석, 메테오 샤워 등)
          for (const enemy of enemies) {
            if (enemy.hp <= 0) continue;
            const dist = distance(skill.position.x, skill.position.y, enemy.x, enemy.y);
            if (dist <= skill.radius) {
              // 마법사: 보스에게만 데미지 보너스 적용
              const actualDamage = (enemy.type === 'boss' && skill.bossDamageMultiplier)
                ? Math.floor(skill.damage * skill.bossDamageMultiplier)
                : skill.damage;
              const killed = useRPGStore.getState().damageEnemy(enemy.id, actualDamage, skill.casterId);
              // 스킬 데미지 숫자 표시 (범위 스킬은 일반 데미지로)
              useRPGStore.getState().addDamageNumber(enemy.x, enemy.y, actualDamage, 'damage');
              if (killed) {
                // 골드 획득은 damageEnemy 내에서 자동 처리됨
                useRPGStore.getState().removeEnemy(enemy.id);
              }
            }
          }

          // 범위 내 적 기지에도 데미지 (데미지가 있는 스킬만)
          if (skill.damage > 0) {
            const enemyBases = useRPGStore.getState().enemyBases;
            for (const base of enemyBases) {
              if (base.destroyed) continue;
              const baseDist = distance(skill.position.x, skill.position.y, base.x, base.y);
              if (baseDist <= skill.radius + 50) {  // 기지는 크기가 크므로 추가 반경
                useRPGStore.getState().damageBase(base.id, skill.damage, skill.casterId);
                // 기지 데미지 숫자 표시
                useRPGStore.getState().addDamageNumber(base.x, base.y, skill.damage, 'damage');
              }
            }
          }

          // 힐러 생명의 샘: 범위 내 아군 힐 (healPercent가 있는 경우)
          if (skill.healPercent && skill.healPercent > 0) {
            const healState = useRPGStore.getState();
            const allHeroes: HeroUnit[] = [];
            if (healState.hero && healState.hero.hp > 0) allHeroes.push(healState.hero);
            healState.otherHeroes.forEach((h) => {
              if (h && h.hp > 0) allHeroes.push(h);
            });

            for (const ally of allHeroes) {
              const allyDist = distance(skill.position.x, skill.position.y, ally.x, ally.y);
              if (allyDist <= skill.radius) {
                const healAmount = Math.floor(ally.maxHp * skill.healPercent);
                if (healState.hero && healState.hero.id === ally.id) {
                  const newHp = Math.min(healState.hero.maxHp, healState.hero.hp + healAmount);
                  useRPGStore.setState({ hero: { ...healState.hero, hp: newHp } });
                } else {
                  healState.updateOtherHero(ally.id, { hp: Math.min(ally.maxHp, ally.hp + healAmount) });
                }
                effectManager.createEffect('heal', ally.x, ally.y);
                // 힐 플로팅 숫자 표시
                useRPGStore.getState().addDamageNumber(ally.x, ally.y, healAmount, 'heal');
              }
            }
          }

          // 스킬 타입별 이펙트/사운드 처리
          if (skill.type === 'mage_e') {
            // 운석 폭발 이펙트
            const explosionEffect: SkillEffect = {
              type: 'mage_meteor' as SkillType,
              position: { x: skill.position.x, y: skill.position.y },
              radius: skill.radius,
              damage: skill.damage,
              duration: 0.5,
              startTime: currentGameTime,
              heroId: skill.casterId,  // 멀티플레이 이펙트 병합용
            };
            useRPGStore.getState().addSkillEffect(explosionEffect);
            soundManager.play('attack_melee');
          } else if (skill.type === 'meteor_shower') {
            // 대마법사 메테오 샤워 이펙트 (운석들이 순차적으로 낙하)
            const meteorEffect: SkillEffect = {
              type: 'meteor_shower' as SkillType,
              position: { x: skill.position.x, y: skill.position.y },
              radius: skill.radius,
              damage: skill.damage,
              duration: 2.0,  // 운석 낙하 이펙트 시간 늘림
              startTime: currentGameTime,
              heroId: skill.casterId,  // 멀티플레이 이펙트 병합용
            };
            useRPGStore.getState().addSkillEffect(meteorEffect);
            soundManager.play('attack_melee');
          } else if (skill.type === 'spring_of_life') {
            // 힐러 생명의 샘 틱 이펙트 (동기화용)
            const springEffect: SkillEffect = {
              type: 'spring_of_life' as SkillType,
              position: { x: skill.position.x, y: skill.position.y },
              radius: skill.radius,
              duration: 1.0,
              startTime: currentGameTime,
              heroId: skill.casterId,  // 멀티플레이 이펙트 병합용
            };
            useRPGStore.getState().addSkillEffect(springEffect);
            soundManager.play('hero_revive');
          } else if (skill.type === 'dark_blade') {
            // 다크나이트 어둠의 칼날 틱 이펙트 (동기화용)
            const darkBladeEffect: SkillEffect = {
              type: 'dark_blade' as SkillType,
              position: { x: skill.position.x, y: skill.position.y },
              radius: skill.radius,
              damage: skill.damage,
              duration: 1.0,
              startTime: currentGameTime,
              heroId: skill.casterId,  // 멀티플레이 이펙트 병합용
            };
            useRPGStore.getState().addSkillEffect(darkBladeEffect);
            soundManager.play('attack_melee');
          } else if (skill.type === 'inferno_burn') {
            // 대마법사 인페르노 화상 틱 이펙트
            const burnEffect: SkillEffect = {
              type: 'inferno_burn' as SkillType,
              position: { x: skill.position.x, y: skill.position.y },
              radius: skill.radius,
              damage: skill.damage,
              duration: 1.0,
              startTime: currentGameTime,
              heroId: skill.casterId,  // 멀티플레이 이펙트 병합용
            };
            useRPGStore.getState().addSkillEffect(burnEffect);
            soundManager.play('attack_melee');
          } else {
            // 기본 폭발 이펙트
            effectManager.createEffect('attack_melee', skill.position.x, skill.position.y);
            soundManager.play('attack_melee');
          }
        }
      }
    });

    // 발동된 보류 스킬 제거 및 틱/연속 스킬 재등록 (역순)
    const skillsToAdd: PendingSkill[] = [];
    for (let i = triggeredSkills.length - 1; i >= 0; i--) {
      const skill = pendingSkills[triggeredSkills[i]];

      // 틱 스킬 재등록 (다크나이트 어둠의 칼날, 힐러 생명의 샘, 대마법사 화상)
      // 데미지/힐은 위의 범위 스킬 처리에서 이미 적용됨
      if (skill.tickCount && skill.tickCount > 1) {
        // 화상 지역은 고정 위치에서 틱 데미지
        if (skill.type === 'inferno_burn') {
          skillsToAdd.push({
            ...skill,
            // 위치 고정 (영웅을 따라가지 않음)
            triggerTime: currentGameTime + 1,  // 1초 후 다음 틱
            tickCount: skill.tickCount - 1,
          });
        } else {
          // 다른 틱 스킬은 영웅을 따라다님
          const state = useRPGStore.getState();

          // 캐스터 영웅 찾기 (스킬이 영웅을 따라다니도록)
          let casterHero: HeroUnit | null | undefined = null;
          if (skill.casterId === state.hero?.id) {
            casterHero = state.hero;
          } else {
            casterHero = state.otherHeroes.get(skill.casterId || '');
          }

          // 캐스터가 살아있으면 다음 틱 재등록
          if (casterHero && casterHero.hp > 0) {
            skillsToAdd.push({
              ...skill,
              position: { x: casterHero.x, y: casterHero.y },  // 영웅 현재 위치로 업데이트
              triggerTime: currentGameTime + 1,  // 1초 후 다음 틱
              tickCount: skill.tickCount - 1,
            });
          }
        }
      }
      // 메테오 샤워: 랜덤 위치에 연속 운석
      else if (skill.meteorCount && skill.meteorCount > 0 && skill.duration) {
        const areaRadius = 300;  // 메테오 낙하 범위
        const randomX = skill.position.x + (Math.random() - 0.5) * areaRadius * 2;
        const randomY = skill.position.y + (Math.random() - 0.5) * areaRadius * 2;
        const interval = skill.duration / (skill.meteorCount + 1);  // 균등 간격

        skillsToAdd.push({
          ...skill,
          position: { x: randomX, y: randomY },
          triggerTime: currentGameTime + interval,
          meteorCount: skill.meteorCount - 1,
        });

        // 운석 낙하 이펙트
        const meteorEffect: SkillEffect = {
          type: 'meteor_shower' as SkillType,
          position: { x: skill.position.x, y: skill.position.y },
          radius: skill.radius,
          damage: skill.damage,
          duration: 0.5,
          startTime: currentGameTime,
          heroId: skill.casterId,  // 멀티플레이 이펙트 병합용
        };
        useRPGStore.getState().addSkillEffect(meteorEffect);
      }

      useRPGStore.getState().removePendingSkill(triggeredSkills[i]);
    }

    // 연속 스킬 재등록
    for (const newSkill of skillsToAdd) {
      useRPGStore.getState().addPendingSkill(newSkill);
    }

    // 넥서스 디펜스: 연속 스폰 처리
    const latestState = useRPGStore.getState();
    const showNotification = useUIStore.getState().showNotification;
    const difficulty = latestState.selectedDifficulty;
    // 멀티플레이어 인원 수 (싱글=1, 멀티=실제 인원 수)
    const playerCount = latestState.multiplayer.isMultiplayer
      ? latestState.otherHeroes.size + 1  // 내 영웅 + 다른 플레이어들 (Map.size 사용)
      : 1;

    // 게임 단계에 따른 처리
    const isTutorial = latestState.isTutorial;
    if (latestState.gamePhase === 'playing') {
      // 적 기지에서 동시 스폰 (양쪽에서 여러 마리)
      const enemyBases = latestState.enemyBases;

      // 튜토리얼 모드: "자동 공격" 단계(인덱스 2) 이상일 때만 스폰
      const tutorialStepIndex = isTutorial ? useRPGTutorialStore.getState().currentStepIndex : 0;
      const canSpawnInTutorial = !isTutorial || tutorialStepIndex >= 2;

      // 튜토리얼 모드와 일반 모드 분기
      const spawnResult = isTutorial
        ? shouldSpawnTutorialEnemy(latestState.gameTime, latestState.lastSpawnTime, enemyBases, latestState.enemies.length)
        : shouldSpawnEnemy(latestState.gameTime, latestState.lastSpawnTime, enemyBases, difficulty, playerCount);

      if (canSpawnInTutorial && spawnResult.shouldSpawn && spawnResult.spawns.length > 0) {
        // 각 기지에서 스폰
        for (const spawn of spawnResult.spawns) {
          const base = enemyBases.find(b => b.id === spawn.baseId);
          if (base && !base.destroyed) {
            // 해당 기지에서 count만큼 적 생성
            for (let i = 0; i < spawn.count; i++) {
              // 튜토리얼 모드는 약한 적, 일반 모드는 난이도에 맞는 적
              const enemy = isTutorial
                ? createTutorialEnemy(base, latestState.gameTime)
                : createEnemyFromBase(base, latestState.gameTime, difficulty, playerCount);
              if (enemy) {
                useRPGStore.getState().addEnemy(enemy);
              }
            }
          }
        }
        useRPGStore.getState().setLastSpawnTime(latestState.gameTime);
      }

      // 5분 마일스톤 보상 체크
      if (latestState.gameTime >= 300 && !latestState.fiveMinuteRewardClaimed) {
        useRPGStore.getState().setFiveMinuteRewardClaimed();
        showNotification(`🎉 5분 생존! 보너스 경험치 ${MILESTONE_CONFIG.FIVE_MINUTE_BONUS_EXP}!`);
        soundManager.play('victory');
      }

      // 두 기지 모두 파괴되면 보스 단계로 + 즉시 보스 스폰
      const allBasesDestroyed = enemyBases.every(b => b.destroyed);
      if (allBasesDestroyed) {
        useRPGStore.getState().setGamePhase('boss_phase');

        // 즉시 보스 스폰 (기존에는 다음 프레임에서 스폰하여 지연 발생)
        if (!bossesSpawnedRef.current) {
          showNotification(isTutorial ? '📖 보스 등장!' : '🔥 모든 기지 파괴! 보스 출현!');
          soundManager.play('warning');
          soundManager.play('boss_spawn');

          // 플레이어 수 계산 (자신 + 다른 플레이어)
          const bossPlayerCount = 1 + latestState.otherHeroes.size;

          // 보스 스폰 (튜토리얼은 약한 보스 1마리만)
          const bosses = createBosses(latestState.enemyBases, bossPlayerCount, difficulty, isTutorial);
          for (const boss of bosses) {
            useRPGStore.getState().addEnemy(boss);
          }
          bossesSpawnedRef.current = true;
        }
      }
    } else if (latestState.gamePhase === 'boss_phase') {
      // 보스 단계: 승리 조건 체크
      if (bossesSpawnedRef.current) {
        // 보스 단계: 모든 보스 처치 시 승리 (보스 스폰 후 프레임부터 체크)
        // 최신 상태에서 적 목록 가져오기 (latestState는 이미 오래됨)
        const currentEnemies = useRPGStore.getState().enemies;
        if (areAllBossesDead(currentEnemies)) {
          useRPGStore.getState().setGameOver(true);
          showNotification('🏆 승리! 모든 보스를 처치했습니다!');
          soundManager.play('victory');
          // 멀티플레이어: 클라이언트들에게 게임 종료 알림 (stats 포함)
          const mpState = useRPGStore.getState().multiplayer;
          if (mpState.isMultiplayer && mpState.isHost) {
            const finalStats = useRPGStore.getState().stats;
            wsClient.hostBroadcastGameOver({ victory: true, stats: finalStats });
          }
        }
      }
    }

    // 이펙트 업데이트
    effectManager.update(deltaTime);

    // 동기화된 기본 공격 이펙트 처리 (호스트 및 싱글플레이어)
    const hostBasicAttackEffects = useRPGStore.getState().basicAttackEffects;
    const hostNow = Date.now();
    for (const effect of hostBasicAttackEffects) {
      if (!processedEffectIdsRef.current.has(effect.id)) {
        processedEffectIdsRef.current.set(effect.id, hostNow);
        // 보스 기본 공격은 별도 이펙트 사용
        const effectType = effect.type === 'boss'
          ? 'boss_basic_attack'
          : effect.type === 'ranged'
            ? 'attack_ranged'
            : 'attack_melee';
        effectManager.createEffect(effectType, effect.x, effect.y);
      }
    }
    // 오래된 기본 공격 이펙트 정리
    useRPGStore.getState().cleanBasicAttackEffects();

    // 오래된 보스 스킬 실행 이펙트 정리 (싱글플레이어만 이 코드 실행)
    useRPGStore.getState().cleanBossSkillExecutedEffects();

    // 호스트 측 오래된 이펙트 ID 정리 (메모리 누수 방지)
    for (const [effectId, processedTime] of processedEffectIdsRef.current) {
      if (hostNow - processedTime > 1000) {
        processedEffectIdsRef.current.delete(effectId);
      }
    }

    // 타겟 추적 이펙트 위치 업데이트 (저격 등 - 적이 이동해도 이펙트가 따라감)
    useRPGStore.getState().updateSkillEffectTargetPositions();

    // 스킬 이펙트 업데이트
    const activeEffects = useRPGStore.getState().activeSkillEffects;
    const currentTime = useRPGStore.getState().gameTime;
    const expiredEffects: number[] = [];

    activeEffects.forEach((effect, index) => {
      if (currentTime - effect.startTime >= effect.duration) {
        expiredEffects.push(index);
      }
    });

    // 만료된 이펙트 제거 (역순으로)
    for (let i = expiredEffects.length - 1; i >= 0; i--) {
      useRPGStore.getState().removeSkillEffect(expiredEffects[i]);
    }

    // 서버 권위 모델: 클라이언트는 상태 브로드캐스트하지 않음 (서버가 처리)
    // 이 코드는 싱글플레이어에서만 실행됨 (멀티플레이어는 위에서 early return)

    animationIdRef.current = requestAnimationFrame(tick);
  }, []);

  // 스킬 결과 처리 공통 함수
  const processSkillResult = useCallback(
    (result: ReturnType<typeof executeQSkill>, state: ReturnType<typeof useRPGStore.getState>, killerHeroId?: string) => {
      // 상태 업데이트
      if (result.effect) {
        // heroId 추가 (멀티플레이 이펙트 병합용)
        const effectWithHeroId = { ...result.effect, heroId: result.hero.id };
        useRPGStore.setState((s) => ({
          hero: result.hero,
          activeSkillEffects: [...s.activeSkillEffects, effectWithHeroId],
        }));
      } else {
        useRPGStore.setState({ hero: result.hero });
      }

      // 적 데미지 적용
      for (const damage of result.enemyDamages) {
        const enemy = state.enemies.find((e) => e.id === damage.enemyId);
        const killed = useRPGStore.getState().damageEnemy(damage.enemyId, damage.damage, killerHeroId);

        // 플로팅 데미지 숫자 표시
        if (enemy) {
          // 크리티컬 여부는 스킬 시스템에서 결정된 isCritical 플래그 사용
          useRPGStore.getState().addDamageNumber(
            enemy.x,
            enemy.y,
            damage.damage,
            damage.isCritical ? 'critical' : 'damage'
          );
        }

        if (killed) {
          if (enemy) {
            // 골드 획득은 damageEnemy 내에서 자동 처리됨
            useRPGStore.getState().removeEnemy(enemy.id);
            effectManager.createEffect('attack_melee', enemy.x, enemy.y);
          }
        }
      }

      // 기지 데미지 적용
      if (result.baseDamages && result.baseDamages.length > 0) {
        for (const baseDamage of result.baseDamages) {
          // 기지 위치 찾기
          const base = state.enemyBases.find(b => b.id === baseDamage.baseId);
          const { destroyed, goldReceived } = useRPGStore.getState().damageBase(baseDamage.baseId, baseDamage.damage, killerHeroId);

          // 기지 데미지 숫자 표시
          if (base) {
            useRPGStore.getState().addDamageNumber(base.x, base.y, baseDamage.damage, 'damage');
          }

          if (destroyed) {
            const showNotification = useUIStore.getState().showNotification;
            if (goldReceived > 0) {
              showNotification(`적 기지 파괴! (+${goldReceived} 골드)`);
            } else {
              showNotification(`적 기지 파괴!`);
            }
            soundManager.play('victory');
          }
        }
      }

      // 버프 적용
      if (result.buff) {
        useRPGStore.getState().addBuff(result.buff);

        // 싱글플레이어: 멀티플레이어 시 호환성을 위해 유지 (실제로는 즉시 반환됨)
        // 서버 권위 모델에서는 서버가 버프 공유를 처리하므로 이 코드는 싱글플레이에서만 의미 있음
        const currentHero = useRPGStore.getState().hero;
        if (currentHero) {
          shareHostBuffToAllies(result.buff, currentHero);
        }
      }

      // 보류 스킬 (운석 낙하 등)
      if (result.pendingSkill) {
        useRPGStore.getState().addPendingSkill(result.pendingSkill);
      }

      // 기절 적용
      if (result.stunTargets && result.stunTargets.length > 0) {
        const stunDuration = result.stunDuration || 1.0; // 기본값 1초
        const enemies = useRPGStore.getState().enemies;
        const updatedEnemies = enemies.map(enemy => {
          if (result.stunTargets!.includes(enemy.id)) {
            return applyStunToEnemy(enemy, stunDuration, state.gameTime);
          }
          return enemy;
        });
        useRPGStore.getState().updateEnemies(updatedEnemies);

        // 기절 적용 알림
        const showNotification = useUIStore.getState().showNotification;
        showNotification(`${result.stunTargets.length}명 기절! (${stunDuration}초)`);
      }

      // 아군 힐 적용 (팔라딘, 힐러 W 스킬)
      if (result.allyHeals && result.allyHeals.length > 0) {
        const currentState = useRPGStore.getState();
        for (const heal of result.allyHeals) {
          // 내 영웅인 경우
          if (currentState.hero && currentState.hero.id === heal.heroId) {
            // 사망한 영웅에게는 힐 적용 안 함
            if (currentState.hero.hp <= 0) continue;
            const newHp = Math.min(currentState.hero.maxHp, currentState.hero.hp + heal.heal);
            useRPGStore.setState({ hero: { ...currentState.hero, hp: newHp } });
            effectManager.createEffect('heal', currentState.hero.x, currentState.hero.y);
            // 힐 플로팅 숫자 표시
            useRPGStore.getState().addDamageNumber(currentState.hero.x, currentState.hero.y, heal.heal, 'heal');
          } else {
            // 다른 영웅인 경우
            const targetHero = currentState.otherHeroes.get(heal.heroId);
            if (targetHero) {
              // 사망한 영웅에게는 힐 적용 안 함
              if (targetHero.hp <= 0) continue;
              const newHp = Math.min(targetHero.maxHp, targetHero.hp + heal.heal);
              currentState.updateOtherHero(heal.heroId, { hp: newHp });
              effectManager.createEffect('heal', targetHero.x, targetHero.y);
              // 힐 플로팅 숫자 표시
              useRPGStore.getState().addDamageNumber(targetHero.x, targetHero.y, heal.heal, 'heal');
            }
          }
        }
      }

      // 아군 버프 적용 (가디언, 팔라딘 E 스킬)
      if (result.allyBuffs && result.allyBuffs.length > 0) {
        const currentState = useRPGStore.getState();
        for (const allyBuff of result.allyBuffs) {
          // 내 영웅인 경우
          if (currentState.hero && currentState.hero.id === allyBuff.heroId) {
            // 사망한 영웅에게는 버프 적용 안 함
            if (currentState.hero.hp <= 0) continue;
            const existingBuffs = currentState.hero.buffs.filter(b => b.type !== allyBuff.buff.type);
            useRPGStore.setState({ hero: { ...currentState.hero, buffs: [...existingBuffs, allyBuff.buff] } });
          } else {
            // 다른 영웅인 경우
            const targetHero = currentState.otherHeroes.get(allyBuff.heroId);
            if (targetHero) {
              // 사망한 영웅에게는 버프 적용 안 함
              if (targetHero.hp <= 0) continue;
              const existingBuffs = targetHero.buffs.filter(b => b.type !== allyBuff.buff.type);
              currentState.updateOtherHero(allyBuff.heroId, { buffs: [...existingBuffs, allyBuff.buff] });
            }
          }
        }
      }
    },
    []
  );

  // 클라이언트 스킬 실행 처리 (이펙트와 돌진 상태만 로컬 처리, 데미지는 호스트에서 동기화)
  const handleClientSkillExecution = useCallback(
    (skillType: SkillType, gameTime: number) => {
      const state = useRPGStore.getState();
      if (!state.hero) return;
      if (state.hero.hp <= 0) return;

      // 방어적 체크: 시전 중이면 스킬 실행 불가 (타이밍 문제 방지)
      if (state.hero.castingUntil && gameTime < state.hero.castingUntil) return;

      // 방어적 체크: 돌진 중이면 스킬 실행 불가
      if (state.hero.dashState) return;

      // 방어적 체크: 스턴 상태면 스킬 실행 불가
      const isStunned = state.hero.buffs?.some(b => b.type === 'stun' && b.duration > 0);
      if (isStunned) return;

      const heroClass = state.hero.heroClass;
      const targetX = state.mousePosition.x;
      const targetY = state.mousePosition.y;

      // 방향 계산
      const dx = targetX - state.hero.x;
      const dy = targetY - state.hero.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const dirX = dist > 0 ? dx / dist : (state.hero.facingRight ? 1 : -1);
      const dirY = dist > 0 ? dy / dist : 0;

      const classSkills = CLASS_SKILLS[heroClass];
      const heroWSkillType = state.hero.skills.find(s => s.key === 'W')?.type;
      const heroESkillType = state.hero.skills.find(s => s.key === 'E')?.type;

      // W 스킬 - 돌진 관련 이펙트와 상태
      if (skillType === classSkills.w.type || skillType === heroWSkillType) {
        // 돌진 스킬인 경우 로컬에서 돌진 상태 설정 (호스트 동기화와 병행)
        const advancedClass = state.hero.advancedClass;
        const isDashSkill =
          heroClass === 'warrior' ||
          heroClass === 'knight' ||
          advancedClass === 'berserker' ||
          advancedClass === 'guardian' ||
          advancedClass === 'paladin' ||
          advancedClass === 'darkKnight';

        const isBackflip = advancedClass === 'sniper';  // 후방 도약

        if (isDashSkill || isBackflip) {
          // 클라이언트: 돌진 상태는 호스트에서 동기화받음 (로컬 설정 제거)
          // 방향만 로컬에서 업데이트 (즉각적인 시각 피드백)
          useRPGStore.getState().updateHeroState({
            facingRight: dirX >= 0,
            facingAngle: Math.atan2(dirY, dirX),
          });

          // 돌진 사운드 재생
          soundManager.play('attack_melee');
        } else {
          // 돌진이 아닌 W 스킬 사운드 (궁수, 마법사 등)
          if (heroClass === 'archer' || heroClass === 'mage') {
            soundManager.play('attack_ranged');
          } else {
            soundManager.play('attack_melee');
          }
        }

        // 이펙트 추가 (렌더링용)
        const attackRange = state.hero.config.range || 80;
        const myHeroId = state.multiplayer.myHeroId || state.hero?.id;
        const effect: SkillEffect = {
          type: skillType,
          position: { x: state.hero.x, y: state.hero.y },
          direction: { x: dirX, y: dirY },
          radius: isDashSkill ? 150 : attackRange,
          duration: 0.5,
          startTime: gameTime,
          heroClass,
          advancedClass,
          heroId: myHeroId,  // 멀티플레이 이펙트 병합용
        };
        useRPGStore.setState((s) => ({
          activeSkillEffects: [...s.activeSkillEffects, effect],
        }));
        return;
      }

      // E 스킬 - 버프 및 특수 이펙트
      if (skillType === classSkills.e.type || skillType === heroESkillType) {
        const advancedClass = state.hero.advancedClass;

        // 스나이퍼 E 스킬: 시전 상태 설정 (3초간 이동/공격 불가)
        // 호스트와 동일하게 castingUntil 설정하여 위치 동기화 유지
        if (advancedClass === 'sniper' && skillType === 'snipe') {
          const chargeTime = 3.0;  // 저격 시전 시간
          useRPGStore.getState().updateHeroState({
            castingUntil: gameTime + chargeTime,
          });
        }

        // E 스킬 사운드 재생
        if (heroClass === 'archer' || heroClass === 'mage' ||
            advancedClass === 'archmage' || advancedClass === 'sniper') {
          soundManager.play('attack_ranged');
        } else {
          soundManager.play('attack_melee');
        }

        // 버프 스킬 이펙트
        const myHeroIdForE = state.multiplayer.myHeroId || state.hero?.id;
        const effect: SkillEffect = {
          type: skillType,
          position: { x: state.hero.x, y: state.hero.y },
          direction: { x: dirX, y: dirY },
          radius: 150,  // 기본 범위
          duration: 1.0,
          startTime: gameTime,
          heroClass,
          advancedClass,
          heroId: myHeroIdForE,  // 멀티플레이 이펙트 병합용
        };

        // 범위 스킬인 경우 타겟 위치에 이펙트
        if (heroClass === 'archer' || heroClass === 'mage' ||
            advancedClass === 'archmage') {
          effect.position = { x: targetX, y: targetY };
        }

        useRPGStore.setState((s) => ({
          activeSkillEffects: [...s.activeSkillEffects, effect],
        }));

        // 특수 알림
        if (!advancedClass) {
          if (heroClass === 'knight') {
            useUIStore.getState().showNotification('철벽 방어 발동!');
          } else if (heroClass === 'warrior') {
            useUIStore.getState().showNotification('광전사 모드 발동!');
          } else if (heroClass === 'mage') {
            useUIStore.getState().showNotification('운석 낙하 시전 중...');
          }
        }
        return;
      }
    },
    []
  );

  // 스킬 실행 처리
  const handleSkillExecution = useCallback(
    (skillType: SkillType, gameTime: number) => {
      const state = useRPGStore.getState();
      if (!state.hero) return;
      if (state.hero.hp <= 0) return;  // 사망한 영웅은 스킬 사용 불가

      // 방어적 체크: 시전 중이면 스킬 실행 불가 (타이밍 문제 방지)
      if (state.hero.castingUntil && gameTime < state.hero.castingUntil) return;

      // 방어적 체크: 돌진 중이면 스킬 실행 불가
      if (state.hero.dashState) return;

      // 방어적 체크: 스턴 상태면 스킬 실행 불가
      const isStunned = state.hero.buffs?.some(b => b.type === 'stun' && b.duration > 0);
      if (isStunned) return;

      const heroClass = state.hero.heroClass;
      // 마우스 위치를 스킬 타겟으로 사용 (바라보는 방향으로 공격)
      const targetX = state.mousePosition.x;
      const targetY = state.mousePosition.y;

      // 직업별 스킬 처리
      const classSkills = CLASS_SKILLS[heroClass];
      const myHeroId = state.multiplayer.myHeroId || state.hero?.id;

      // 인게임 공격력 업그레이드 레벨
      const attackUpgradeLevel = state.upgradeLevels.attack;

      // 영웅의 실제 스킬 타입 가져오기 (전직 캐릭터의 경우 전직 스킬 타입)
      const heroQSkillType = state.hero.skills.find(s => s.key === 'Q')?.type;
      const heroWSkillType = state.hero.skills.find(s => s.key === 'W')?.type;
      const heroESkillType = state.hero.skills.find(s => s.key === 'E')?.type;

      // 아군 목록 (내 영웅 + 다른 플레이어 영웅)
      const allies: HeroUnit[] = [];
      if (state.hero) allies.push(state.hero);
      state.otherHeroes.forEach((h) => allies.push(h));

      // Q 스킬 (기본 스킬 또는 영웅의 Q 스킬)
      if (skillType === classSkills.q.type || skillType === heroQSkillType) {
        const result = executeQSkill(state.hero, state.enemies, targetX, targetY, gameTime, state.enemyBases, attackUpgradeLevel, allies);
        processSkillResult(result, state, myHeroId);
        return;
      }

      // W 스킬 (기본 스킬 또는 영웅의 W 스킬 - 전직 스킬 포함)
      if (skillType === classSkills.w.type || skillType === heroWSkillType) {
        const result = executeWSkill(state.hero, state.enemies, targetX, targetY, gameTime, state.enemyBases, attackUpgradeLevel, allies);
        processSkillResult(result, state, myHeroId);

        // 기사 방패 돌진 알림 (전직하지 않은 경우에만)
        if (heroClass === 'knight' && !state.hero.advancedClass) {
          const showNotification = useUIStore.getState().showNotification;
          showNotification('방패 돌진!');
        }
        return;
      }

      // E 스킬 (기본 스킬 또는 영웅의 E 스킬 - 전직 스킬 포함)
      if (skillType === classSkills.e.type || skillType === heroESkillType) {
        // 아군 목록 (내 영웅 + 다른 플레이어 영웅)
        const eAllies: HeroUnit[] = [];
        if (state.hero) eAllies.push(state.hero);
        state.otherHeroes.forEach((h) => eAllies.push(h));

        const result = executeESkill(state.hero, state.enemies, targetX, targetY, gameTime, state.enemyBases, myHeroId, attackUpgradeLevel, eAllies);
        processSkillResult(result, state, myHeroId);

        // 특수 알림 (전직하지 않은 경우에만)
        if (!state.hero.advancedClass) {
          if (heroClass === 'knight') {
            const showNotification = useUIStore.getState().showNotification;
            showNotification('철벽 방어 발동!');
          } else if (heroClass === 'warrior') {
            const showNotification = useUIStore.getState().showNotification;
            showNotification('광전사 모드 발동!');
          } else if (heroClass === 'mage') {
            const showNotification = useUIStore.getState().showNotification;
            showNotification('운석 낙하 시전 중...');
          }
        }
        return;
      }
    },
    [processSkillResult]
  );

  // 스킬 사용 요청 (외부에서 호출)
  const requestSkill = useCallback((skillType: SkillType) => {
    const state = useRPGStore.getState();
    if (!state.hero) return false;
    if (state.hero.hp <= 0) return false;  // 사망한 영웅은 스킬 사용 불가

    // 시전 중이면 스킬 사용 불가 (스나이퍼 E 스킬 등)
    if (state.hero.castingUntil && state.gameTime < state.hero.castingUntil) {
      return false;
    }

    // 돌진 중이면 스킬 사용 불가
    if (state.hero.dashState) {
      return false;
    }

    // 스턴 상태면 스킬 사용 불가
    const isStunned = state.hero.buffs?.some(b => b.type === 'stun' && b.duration > 0);
    if (isStunned) {
      return false;
    }

    const skill = state.hero.skills.find((s) => s.type === skillType);
    if (!skill || skill.currentCooldown > 0) {
      return false;
    }

    // 스나이퍼 E 스킬: 타겟이 없으면 스킬 사용 불가
    if (skillType === 'snipe' && state.hero.advancedClass === 'sniper') {
      const mouseX = state.mousePosition.x;
      const mouseY = state.mousePosition.y;
      const targetAngle = Math.atan2(mouseY - state.hero.y, mouseX - state.hero.x);

      // 마우스 방향 30도 내에 적이 있는지 체크
      let hasTarget = false;
      for (const enemy of state.enemies) {
        if (enemy.hp <= 0) continue;
        const enemyAngle = Math.atan2(enemy.y - state.hero.y, enemy.x - state.hero.x);
        const angleDiff = Math.abs(enemyAngle - targetAngle);
        const normalizedDiff = Math.min(angleDiff, 2 * Math.PI - angleDiff);
        if (normalizedDiff < Math.PI / 6) {
          hasTarget = true;
          break;
        }
      }

      if (!hasTarget) {
        return false;  // 타겟 없음 - 쿨다운 시작 안 함
      }
    }

    // 스킬 쿨다운 시작
    useRPGStore.getState().useSkill(skillType);

    // 다음 프레임에서 실행
    pendingSkillRef.current = skillType;

    return true;
  }, []);

  useEffect(() => {
    if (running && !paused && !gameOver) {
      lastTimeRef.current = performance.now();
      // 게임이 새로 시작될 때만 보스 스폰 플래그 리셋 (running이 false→true로 변경될 때)
      // paused 상태에서는 wasRunningRef를 유지해야 함
      if (!wasRunningRef.current) {
        bossesSpawnedRef.current = false;
      }
      wasRunningRef.current = true;
      animationIdRef.current = requestAnimationFrame(tick);
    } else if (!running) {
      // 게임이 완전히 멈췄을 때만 wasRunningRef 리셋 (paused 상태에서는 유지)
      wasRunningRef.current = false;
    }

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    };
  }, [running, paused, gameOver, tick]);

  return { requestSkill };
}

/**
 * 다른 플레이어 영웅들의 이동 업데이트 (호스트에서 실행)
 */
/**
 * 다른 플레이어 영웅들의 부활 체크 (호스트에서 실행)
 */
function updateOtherHeroesRevive(gameTime: number) {
  const state = useRPGStore.getState();
  const reviveTime = RPG_CONFIG.REVIVE.BASE_TIME;

  state.otherHeroes.forEach((hero, heroId) => {
    // 사망 상태이고 deathTime이 설정된 경우만 체크
    if (hero.hp <= 0 && hero.deathTime) {
      const timeSinceDeath = gameTime - hero.deathTime;

      if (timeSinceDeath >= reviveTime) {
        // 넥서스 근처에서 부활
        const nexus = state.nexus;
        const nexusX = nexus?.x || RPG_CONFIG.MAP_WIDTH / 2;
        const nexusY = nexus?.y || RPG_CONFIG.MAP_HEIGHT / 2;
        const offsetX = (Math.random() - 0.5) * RPG_CONFIG.REVIVE.SPAWN_OFFSET * 2;
        const offsetY = (Math.random() - 0.5) * RPG_CONFIG.REVIVE.SPAWN_OFFSET * 2;

        // 무적 버프 생성
        const invincibleBuff: Buff = {
          type: 'invincible',
          duration: RPG_CONFIG.REVIVE.INVINCIBLE_DURATION,
          startTime: gameTime,
        };

        // 영웅 부활 처리 (모든 버프 초기화 - 스턴 등 CC 버프 포함)
        state.updateOtherHero(heroId, {
          hp: hero.maxHp * RPG_CONFIG.REVIVE.REVIVE_HP_PERCENT,
          x: nexusX + offsetX,
          y: nexusY + offsetY,
          deathTime: undefined,
          moveDirection: undefined,
          state: 'idle',
          buffs: [invincibleBuff],  // 기존 버프 제거, 무적만 추가
          castingUntil: undefined,
          dashState: undefined,
        });

        console.log(`[GameLoop] 플레이어 부활: ${heroId}`);
      }
    }
  });
}

function updateOtherHeroesMovement(deltaTime: number) {
  const state = useRPGStore.getState();
  const gameTime = state.gameTime;

  state.otherHeroes.forEach((hero, heroId) => {
    // 사망 상태면 이동 스킵
    if (hero.hp <= 0) return;

    // 시전 상태 체크 - 시전 중에는 이동 불가 (클라이언트와 동일한 로직)
    const isCasting = hero.castingUntil && gameTime < hero.castingUntil;

    // 스턴 상태 체크 - 스턴 중에는 이동 불가
    const isStunned = hero.buffs?.some(b => b.type === 'stun' && b.duration > 0);

    // 돌진 중인 경우 - 일반 이동보다 우선 (시전 상태와 무관하게 돌진은 진행)
    if (hero.dashState) {
      const dash = hero.dashState;
      const newProgress = dash.progress + deltaTime / dash.duration;

      if (newProgress >= 1) {
        // 돌진 완료
        state.updateOtherHero(heroId, {
          x: dash.targetX,
          y: dash.targetY,
          dashState: undefined,
          state: 'idle',
        });
      } else {
        // 돌진 중 - easeOutQuad 이징 적용 (가속 후 감속)
        const easedProgress = 1 - (1 - newProgress) * (1 - newProgress);
        const newX = dash.startX + (dash.targetX - dash.startX) * easedProgress;
        const newY = dash.startY + (dash.targetY - dash.startY) * easedProgress;
        state.updateOtherHero(heroId, {
          x: newX,
          y: newY,
          dashState: { ...dash, progress: newProgress },
          state: 'moving',
        });
      }
      return; // 돌진 중이면 일반 이동 처리 안함
    }

    // 시전 중이거나 스턴 상태면 이동 불가
    if (isCasting || isStunned) return;

    if (!hero.moveDirection) return;

    const { x: dirX, y: dirY } = hero.moveDirection;
    let speed = hero.config.speed || hero.baseSpeed || 200;

    // 이동속도 버프 적용 (swiftness) - duration > 0인 경우만 유효
    const swiftnessBuff = hero.buffs?.find(b => b.type === 'swiftness' && b.duration > 0);
    if (swiftnessBuff?.moveSpeedBonus) {
      speed *= (1 + swiftnessBuff.moveSpeedBonus);
    }

    // 방향 정규화
    const length = Math.sqrt(dirX * dirX + dirY * dirY);
    if (length === 0) return;

    const normalizedX = dirX / length;
    const normalizedY = dirY / length;

    // 새 위치 계산 (speed는 60fps 기준이므로 * 60 필요)
    const moveDistance = speed * deltaTime * 60;
    const newX = hero.x + normalizedX * moveDistance;
    const newY = hero.y + normalizedY * moveDistance;

    // 맵 범위 제한 (30px 마진 - 호스트와 동일)
    const clampedX = Math.max(30, Math.min(RPG_CONFIG.MAP_WIDTH - 30, newX));
    const clampedY = Math.max(30, Math.min(RPG_CONFIG.MAP_HEIGHT - 30, newY));

    // 영웅 위치 업데이트
    state.updateOtherHero(heroId, {
      x: clampedX,
      y: clampedY,
      facingRight: dirX >= 0,
      facingAngle: Math.atan2(dirY, dirX),
    });
  });
}

/**
 * 다른 플레이어 영웅들의 자동 공격 처리 (호스트에서 실행)
 */
function updateOtherHeroesAutoAttack(deltaTime: number, enemies: ReturnType<typeof useRPGStore.getState>['enemies'], _gameTime: number) {
  const state = useRPGStore.getState();

  state.otherHeroes.forEach((hero, heroId) => {
    // 사망한 영웅은 스킵
    if (hero.hp <= 0) return;
    // 돌진 중이면 스킵
    if (hero.dashState) return;
    // 시전 중이면 스킵 (스나이퍼 E 스킬 등)
    const isCasting = hero.castingUntil && _gameTime < hero.castingUntil;
    if (isCasting) return;
    // 스턴 상태면 스킵
    const isStunned = hero.buffs?.some(b => b.type === 'stun' && b.duration > 0);
    if (isStunned) return;

    // 광전사 버프 확인 (공격속도 증가) - duration > 0인 경우만 유효
    const berserkerBuff = hero.buffs?.find(b => b.type === 'berserker' && b.duration > 0);
    const attackSpeedMultiplier = berserkerBuff?.speedBonus ? (1 + berserkerBuff.speedBonus) : 1;

    // 스킬 쿨다운 업데이트 (광전사 버프 공격속도 적용)
    const updatedSkills = hero.skills.map(skill => {
      // Q스킬(기본 공격)에만 공격속도 버프 적용
      const isQSkill = skill.key === 'Q';
      const cooldownReduction = isQSkill
        ? deltaTime * attackSpeedMultiplier
        : deltaTime;
      return {
        ...skill,
        currentCooldown: Math.max(0, skill.currentCooldown - cooldownReduction),
      };
    });

    // 스킬 업데이트 적용
    state.updateOtherHero(heroId, { skills: updatedSkills });

    // Q 스킬 찾기
    const heroClass = hero.heroClass;
    const qSkillType = CLASS_SKILLS[heroClass].q.type;
    const qSkill = updatedSkills.find(s => s.type === qSkillType);

    if (!qSkill || qSkill.currentCooldown > 0) return;

    // 공격 사거리 내 가장 가까운 적 찾기
    const attackRange = hero.config.range || 80;

    let attackedTarget = false;

    // 데미지 계산 (모든 타겟에 공통 적용)
    const baseDamage = hero.baseAttack;
    const playerUpgrades = state.getOtherPlayerUpgrades(heroId);
    const attackBonus = playerUpgrades.attack * UPGRADE_CONFIG.attack.perLevel;
    let totalDamage = baseDamage + attackBonus;

    // 마법사: 보스 데미지 배율 계산 (보스에게만 적용)
    let bossDamageMultiplier = 1.0;
    if (heroClass === 'mage') {
      const classConfig = CLASS_CONFIGS[heroClass];
      const baseBossDamageBonus = hero.characterLevel >= PASSIVE_UNLOCK_LEVEL ? (classConfig.passive.bossDamageBonus || 0) : 0;
      const growthBossDamageBonus = hero.passiveGrowth?.currentValue || 0;
      bossDamageMultiplier = 1 + baseBossDamageBonus + growthBossDamageBonus;
    }

    // 광전사 버프 공격력 보너스 적용
    if (berserkerBuff?.attackBonus) {
      totalDamage = Math.floor(totalDamage * (1 + berserkerBuff.attackBonus));
    }

    // 궁수 다중타겟 처리
    if (heroClass === 'archer') {
      // 다중타겟 패시브 확률 판정
      const classConfig = CLASS_CONFIGS[heroClass];
      const baseMultiTargetCount = classConfig.passive.multiTarget || 3;
      const isPassiveUnlocked = hero.characterLevel >= PASSIVE_UNLOCK_LEVEL;
      const useMultiTarget = isPassiveUnlocked && rollMultiTarget(hero.passiveGrowth?.currentValue || 0);
      const multiTargetCount = useMultiTarget ? baseMultiTargetCount : 1;

      // 범위 내 적들을 거리순으로 정렬
      const enemiesInRange: { enemy: typeof enemies[0]; dist: number }[] = [];
      for (const enemy of enemies) {
        if (enemy.hp <= 0) continue;
        const dist = distance(hero.x, hero.y, enemy.x, enemy.y);
        if (dist <= attackRange) {
          enemiesInRange.push({ enemy, dist });
        }
      }
      enemiesInRange.sort((a, b) => a.dist - b.dist);

      // 다중타겟 공격 실행
      const targets = enemiesInRange.slice(0, multiTargetCount);
      if (targets.length > 0) {
        const hitTargets: { x: number; y: number; damage: number }[] = [];
        let totalHealAmount = 0;

        for (const { enemy } of targets) {
          // 마법사: 보스에게만 데미지 보너스 적용
          const actualDamage = enemy.type === 'boss' ? Math.floor(totalDamage * bossDamageMultiplier) : totalDamage;
          const killed = state.damageEnemy(enemy.id, actualDamage, heroId);
          if (killed) {
            state.removeEnemy(enemy.id);
          }
          hitTargets.push({ x: enemy.x, y: enemy.y, damage: actualDamage });

          // 데미지 숫자 표시
          useRPGStore.getState().addDamageNumber(enemy.x, enemy.y, actualDamage, 'damage');

          // 광전사 버프 피해흡혈 (궁수도 버프 받으면 적용)
          if (berserkerBuff?.lifesteal) {
            totalHealAmount += Math.floor(actualDamage * berserkerBuff.lifesteal);
          }
        }

        // 피해흡혈 적용
        if (totalHealAmount > 0) {
          const currentHero = state.otherHeroes.get(heroId);
          if (currentHero) {
            const newHp = Math.min(currentHero.maxHp, currentHero.hp + totalHealAmount);
            state.updateOtherHero(heroId, { hp: newHp });
          }
        }

        // 첫 번째 타겟 방향으로 이펙트
        const firstTarget = targets[0].enemy;
        const dirX = firstTarget.x - hero.x;
        const dirY = firstTarget.y - hero.y;
        const dirDist = Math.sqrt(dirX * dirX + dirY * dirY);
        const normalizedDirX = dirDist > 0 ? dirX / dirDist : 1;
        const normalizedDirY = dirDist > 0 ? dirY / dirDist : 0;

        state.addSkillEffect({
          type: qSkillType,
          position: { x: hero.x, y: hero.y },
          direction: { x: normalizedDirX, y: normalizedDirY },
          damage: totalDamage,
          duration: 0.4,
          startTime: _gameTime,
          hitTargets,
          heroClass: heroClass,
          advancedClass: hero.advancedClass,  // 전직 색상 적용
          heroId: heroId,  // 멀티플레이 이펙트 병합용
        });

        // Q 스킬 쿨다운 리셋 (hero.config.attackSpeed 사용 - 인게임 업그레이드 반영)
        const attackSpeed = hero.config?.attackSpeed ?? hero.baseAttackSpeed ?? 1.0;
        const skillsWithCooldown = updatedSkills.map(s =>
          s.type === qSkillType ? { ...s, currentCooldown: attackSpeed } : s
        );
        state.updateOtherHero(heroId, {
          skills: skillsWithCooldown,
          facingAngle: Math.atan2(firstTarget.y - hero.y, firstTarget.x - hero.x),
        });

        soundManager.play('attack_ranged');

        // 멀티플레이어: 기본 공격 이펙트 동기화 (클라이언트에서도 사운드 재생)
        useRPGStore.getState().addBasicAttackEffect({
          id: `other_hero_attack_archer_${Date.now()}_${heroId}`,
          type: 'ranged',
          x: firstTarget.x,
          y: firstTarget.y,
          timestamp: Date.now(),
        });

        attackedTarget = true;
      }
    } else {
      // 다른 클래스: 전사/기사/마법사 범위 공격
      const isAoE = heroClass === 'warrior' || heroClass === 'knight' || heroClass === 'mage';

      // 가장 가까운 적을 기준으로 공격 방향 결정
      const nearestEnemy = findNearestEnemyForHero(hero, enemies);

      // 적이 사거리 내에 있는지 확인
      const hasEnemyInRange = nearestEnemy && distance(hero.x, hero.y, nearestEnemy.x, nearestEnemy.y) <= attackRange;

      if (hasEnemyInRange && nearestEnemy) {
        // 공격 방향 계산 (가장 가까운 적 방향)
        const dirX = nearestEnemy.x - hero.x;
        const dirY = nearestEnemy.y - hero.y;
        const dirDist = Math.sqrt(dirX * dirX + dirY * dirY);
        const normalizedDirX = dirDist > 0 ? dirX / dirDist : 1;
        const normalizedDirY = dirDist > 0 ? dirY / dirDist : 0;

        const hitTargets: { x: number; y: number; damage: number }[] = [];
        let totalHealAmount = 0;
        let hitCount = 0;

        // 근거리(전사, 기사)는 약 110도, 원거리(마법사)는 90도
        const isMelee = heroClass === 'warrior' || heroClass === 'knight';
        const attackAngleThreshold = isMelee ? -0.3 : 0.0;
        const baseAttackRange = attackRange + 50;  // 기지는 크기가 크므로 추가 사거리

        if (isAoE) {
          // 범위 공격: 사거리 내 + 전방 각도 내 모든 적 공격
          for (const enemy of enemies) {
            if (enemy.hp <= 0) continue;

            const distToEnemy = distance(hero.x, hero.y, enemy.x, enemy.y);
            if (distToEnemy > attackRange) continue;

            // 바라보는 방향 체크 (내적 사용)
            const enemyDx = enemy.x - hero.x;
            const enemyDy = enemy.y - hero.y;
            const enemyDist = Math.sqrt(enemyDx * enemyDx + enemyDy * enemyDy);
            if (enemyDist === 0) continue;

            const enemyDirX = enemyDx / enemyDist;
            const enemyDirY = enemyDy / enemyDist;
            const dot = normalizedDirX * enemyDirX + normalizedDirY * enemyDirY;

            // 바라보는 방향 범위 밖이면 스킵
            if (dot < attackAngleThreshold) continue;

            // 마법사: 보스에게만 데미지 보너스 적용
            const actualDamage = enemy.type === 'boss' ? Math.floor(totalDamage * bossDamageMultiplier) : totalDamage;
            const killed = state.damageEnemy(enemy.id, actualDamage, heroId);
            if (killed) {
              state.removeEnemy(enemy.id);
            }
            hitTargets.push({ x: enemy.x, y: enemy.y, damage: actualDamage });

            // 데미지 숫자 표시
            useRPGStore.getState().addDamageNumber(enemy.x, enemy.y, actualDamage, 'damage');

            hitCount++;
          }

          // AoE 공격: 범위 내 기지도 함께 공격
          for (const base of state.enemyBases) {
            if (base.destroyed) continue;

            const distToBase = distance(hero.x, hero.y, base.x, base.y);
            if (distToBase > baseAttackRange) continue;

            // 바라보는 방향 체크 (기지는 더 관대하게)
            const baseDx = base.x - hero.x;
            const baseDy = base.y - hero.y;
            const baseDist = Math.sqrt(baseDx * baseDx + baseDy * baseDy);
            if (baseDist === 0) continue;

            const baseDirX = baseDx / baseDist;
            const baseDirY = baseDy / baseDist;
            const dot = normalizedDirX * baseDirX + normalizedDirY * baseDirY;

            // 바라보는 방향 범위 밖이면 스킵 (기지는 더 관대: -0.5)
            if (dot < -0.5) continue;

            // 기지 데미지 적용 (heroId 전달로 골드 배분용 공격자 추적)
            const { destroyed, goldReceived } = state.damageBase(base.id, totalDamage, heroId);
            hitTargets.push({ x: base.x, y: base.y, damage: totalDamage });

            // 기지 데미지 숫자 표시
            useRPGStore.getState().addDamageNumber(base.x, base.y, totalDamage, 'damage');

            if (destroyed) {
              const showNotification = useUIStore.getState().showNotification;
              if (goldReceived > 0) {
                showNotification(`적 기지 파괴! (+${goldReceived} 골드)`);
              } else {
                showNotification(`적 기지 파괴!`);
              }
              soundManager.play('victory');
            }
          }
        } else {
          // 단일 타겟 공격
          const killed = state.damageEnemy(nearestEnemy.id, totalDamage, heroId);
          if (killed) {
            state.removeEnemy(nearestEnemy.id);
          }
          hitTargets.push({ x: nearestEnemy.x, y: nearestEnemy.y, damage: totalDamage });

          // 데미지 숫자 표시
          useRPGStore.getState().addDamageNumber(nearestEnemy.x, nearestEnemy.y, totalDamage, 'damage');

          hitCount = 1;
        }

        // 적중한 적이 있으면 처리
        if (hitCount > 0) {
          // 피해흡혈 적용: 전사 패시브 (전사만) + 광전사 버프 (모든 클래스)
          {
            // 전사 패시브 피해흡혈 (전사만)
            let passiveTotal = 0;
            if (heroClass === 'warrior') {
              const classConfig = CLASS_CONFIGS[heroClass];
              const baseLifesteal = hero.characterLevel >= PASSIVE_UNLOCK_LEVEL ? (classConfig.passive.lifesteal || 0) : 0;
              const growthLifesteal = hero.passiveGrowth?.currentValue || 0;
              passiveTotal = baseLifesteal + growthLifesteal;

              // 버서커 전직 시 피해흡혈 배율 적용
              if (hero.advancedClass === 'berserker') {
                const multiplier = ADVANCED_CLASS_CONFIGS.berserker.specialEffects.lifestealMultiplier || 1;
                passiveTotal *= multiplier;
              }
            }

            // 광전사 버프 피해흡혈 (모든 클래스에 적용)
            const buffLifesteal = berserkerBuff?.lifesteal || 0;

            // 곱연산: (1 + 패시브) * (1 + 버프) - 1
            const totalLifesteal = passiveTotal > 0 || buffLifesteal > 0
              ? (1 + passiveTotal) * (1 + buffLifesteal) - 1
              : 0;

            if (totalLifesteal > 0) {
              // 모든 적중에 대해 피해흡혈 적용
              const totalDamageDealt = totalDamage * hitCount;
              const healAmount = Math.floor(totalDamageDealt * totalLifesteal);
              if (healAmount > 0) {
                totalHealAmount = healAmount;
              }
            }
          }

          // 피해흡혈 적용
          if (totalHealAmount > 0) {
            const currentHero = state.otherHeroes.get(heroId);
            if (currentHero) {
              const newHp = Math.min(currentHero.maxHp, currentHero.hp + totalHealAmount);
              state.updateOtherHero(heroId, { hp: newHp });
            }
          }

          // 스킬 이펙트 추가
          state.addSkillEffect({
            type: qSkillType,
            position: { x: hero.x, y: hero.y },
            direction: { x: normalizedDirX, y: normalizedDirY },
            radius: isAoE ? attackRange : undefined,
            damage: totalDamage,
            duration: 0.4,
            startTime: _gameTime,
            hitTargets,
            heroClass: heroClass,
            advancedClass: hero.advancedClass,  // 전직 색상 적용
            heroId: heroId,  // 멀티플레이 이펙트 병합용
          });

          // Q 스킬 쿨다운 리셋 (hero.config.attackSpeed 사용 - 인게임 업그레이드 반영)
          const attackSpeedForCooldown = hero.config?.attackSpeed ?? hero.baseAttackSpeed ?? 1.0;
          let skillsWithCooldown = updatedSkills.map(s =>
            s.type === qSkillType ? { ...s, currentCooldown: attackSpeedForCooldown } : s
          );

          // 기사 Q 스킬 적중 시 W 스킬 쿨다운 1초 감소 (적중 수만큼)
          if (heroClass === 'knight') {
            const cooldownReduction = 1.0 * hitCount;
            const wSkillType = CLASS_SKILLS.knight.w.type;
            skillsWithCooldown = skillsWithCooldown.map(s => {
              if (s.type === wSkillType && s.currentCooldown > 0) {
                return { ...s, currentCooldown: Math.max(0, s.currentCooldown - cooldownReduction) };
              }
              return s;
            });
          }

          // 가디언/팔라딘 Q 스킬 적중 시 W 스킬 쿨다운 1초 감소 (적중 수만큼)
          if (hero.advancedClass === 'guardian' || hero.advancedClass === 'paladin') {
            const cooldownReduction = 1.0 * hitCount;
            const wSkillType = ADVANCED_W_SKILLS[hero.advancedClass].type;
            skillsWithCooldown = skillsWithCooldown.map(s => {
              if (s.type === wSkillType && s.currentCooldown > 0) {
                return { ...s, currentCooldown: Math.max(0, s.currentCooldown - cooldownReduction) };
              }
              return s;
            });
          }

          state.updateOtherHero(heroId, {
            skills: skillsWithCooldown,
            facingAngle: Math.atan2(nearestEnemy.y - hero.y, nearestEnemy.x - hero.x),
          });

          // 사운드 재생 (archer는 위에서 이미 처리됨)
          if (heroClass === 'mage') {
            soundManager.play('attack_ranged');
          } else {
            soundManager.play('attack_melee');
          }

          // 멀티플레이어: 기본 공격 이펙트 동기화 (클라이언트에서도 사운드 재생)
          useRPGStore.getState().addBasicAttackEffect({
            id: `other_hero_attack_${Date.now()}_${heroId}`,
            type: heroClass === 'mage' ? 'ranged' : 'melee',
            x: nearestEnemy.x,
            y: nearestEnemy.y,
            timestamp: Date.now(),
          });

          attackedTarget = true;
        }
      }
    }

    // 적이 사거리 내에 없으면 적 기지 공격 시도
    if (!attackedTarget) {
      const enemyBases = state.enemyBases;
      const nearestBase = findNearestBaseForHero(hero, enemyBases);

      if (nearestBase) {
        const baseDist = distance(hero.x, hero.y, nearestBase.x, nearestBase.y);
        const baseAttackRange = attackRange + 50;
        if (baseDist <= baseAttackRange) {
          // 기지 공격 - 해당 플레이어의 업그레이드 레벨 사용
          const baseDamage = hero.baseAttack;
          const playerUpgrades = state.getOtherPlayerUpgrades(heroId);
          const attackBonus = playerUpgrades.attack * UPGRADE_CONFIG.attack.perLevel;
          let baseTotalDamage = baseDamage + attackBonus;

          // 마법사 보스 데미지 보너스는 기지에 적용되지 않음 (보스에게만 적용)

          // 광전사 버프 공격력 보너스 적용
          if (berserkerBuff?.attackBonus) {
            baseTotalDamage = Math.floor(baseTotalDamage * (1 + berserkerBuff.attackBonus));
          }

          // 기지 데미지 적용 (heroId 전달로 골드 배분용 공격자 추적)
          const { destroyed, goldReceived } = state.damageBase(nearestBase.id, baseTotalDamage, heroId);

          // 기지 데미지 숫자 표시
          useRPGStore.getState().addDamageNumber(nearestBase.x, nearestBase.y, baseTotalDamage, 'damage');

          // 공격 방향 계산
          const baseDirX = nearestBase.x - hero.x;
          const baseDirY = nearestBase.y - hero.y;
          const baseDirDist = Math.sqrt(baseDirX * baseDirX + baseDirY * baseDirY);
          const normalizedBaseDirX = baseDirDist > 0 ? baseDirX / baseDirDist : 1;
          const normalizedBaseDirY = baseDirDist > 0 ? baseDirY / baseDirDist : 0;

          // Q 스킬 쿨다운 리셋 (hero.config.attackSpeed 사용 - 인게임 업그레이드 반영)
          const baseAttackSpeed = hero.config?.attackSpeed ?? hero.baseAttackSpeed ?? 1.0;
          const skillsWithCooldown = updatedSkills.map(s =>
            s.type === qSkillType ? { ...s, currentCooldown: baseAttackSpeed } : s
          );
          state.updateOtherHero(heroId, {
            skills: skillsWithCooldown,
            facingAngle: Math.atan2(nearestBase.y - hero.y, nearestBase.x - hero.x),
          });

          // 호스트와 동일한 SkillEffect 형식으로 이펙트 추가 (네트워크 동기화)
          const isAoE = heroClass === 'warrior' || heroClass === 'knight' || heroClass === 'mage';
          state.addSkillEffect({
            type: qSkillType,
            position: { x: hero.x, y: hero.y },
            direction: { x: normalizedBaseDirX, y: normalizedBaseDirY },
            radius: isAoE ? attackRange : undefined,
            damage: baseTotalDamage,
            duration: 0.4,
            startTime: _gameTime,
            hitTargets: [{ x: nearestBase.x, y: nearestBase.y, damage: baseTotalDamage }],
            heroClass: heroClass,
            advancedClass: hero.advancedClass,  // 전직 색상 적용
            heroId: heroId,  // 멀티플레이 이펙트 병합용
          });

          if (heroClass === 'archer' || heroClass === 'mage') {
            soundManager.play('attack_ranged');
          } else {
            soundManager.play('attack_melee');
          }

          // 멀티플레이어: 기본 공격 이펙트 동기화 (클라이언트에서도 사운드 재생)
          useRPGStore.getState().addBasicAttackEffect({
            id: `other_hero_attack_base_${Date.now()}_${heroId}`,
            type: heroClass === 'archer' || heroClass === 'mage' ? 'ranged' : 'melee',
            x: nearestBase.x,
            y: nearestBase.y,
            timestamp: Date.now(),
          });

          if (destroyed) {
            const showNotification = useUIStore.getState().showNotification;
            if (goldReceived > 0) {
              showNotification(`적 기지 파괴! (+${goldReceived} 골드)`);
            } else {
              showNotification(`적 기지 파괴!`);
            }
            soundManager.play('victory');
          }
        }
      }
    }
  });
}

/**
 * 특정 영웅 기준 가장 가까운 적 찾기
 */
function findNearestEnemyForHero(hero: HeroUnit, enemies: ReturnType<typeof useRPGStore.getState>['enemies']) {
  let nearest: typeof enemies[0] | null = null;
  let minDist = Infinity;

  for (const enemy of enemies) {
    if (enemy.hp <= 0) continue;
    const dist = distance(hero.x, hero.y, enemy.x, enemy.y);
    if (dist < minDist) {
      minDist = dist;
      nearest = enemy;
    }
  }

  return nearest;
}

/**
 * 특정 영웅 기준 가장 가까운 적 기지 찾기
 */
function findNearestBaseForHero(hero: HeroUnit, bases: ReturnType<typeof useRPGStore.getState>['enemyBases']) {
  let nearest: typeof bases[0] | null = null;
  let minDist = Infinity;

  for (const base of bases) {
    if (base.destroyed) continue;
    const dist = distance(hero.x, hero.y, base.x, base.y);
    if (dist < minDist) {
      minDist = dist;
      nearest = base;
    }
  }

  return nearest;
}
