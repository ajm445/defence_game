import { useRef, useCallback, useEffect } from 'react';
import { useRPGStore } from '../stores/useRPGStore';
import { useUIStore } from '../stores/useUIStore';
import { RPG_CONFIG, CLASS_SKILLS, CLASS_CONFIGS, PASSIVE_UNLOCK_LEVEL, MILESTONE_CONFIG, UPGRADE_CONFIG, GOLD_CONFIG } from '../constants/rpgConfig';
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
import { createEnemyFromBase, getSpawnConfig, shouldSpawnEnemy } from '../game/rpg/nexusSpawnSystem';
import { createBosses, areAllBossesDead, hasBosses, updateBossSkills, applyStunToHero } from '../game/rpg/bossSystem';
import { processNexusLaser, isNexusAlive } from '../game/rpg/nexusLaserSystem';
import { rollMultiTarget } from '../game/rpg/passiveSystem';
import { useNetworkSync, shareHostBuffToAllies } from './useNetworkSync';
import { wsClient } from '../services/WebSocketClient';

export function useRPGGameLoop() {
  const lastTimeRef = useRef<number>(0);
  const animationIdRef = useRef<number>(0);
  const pendingSkillRef = useRef<SkillType | null>(null);
  const bossesSpawnedRef = useRef<boolean>(false);
  const lastBroadcastTimeRef = useRef<number>(0);
  const wasRunningRef = useRef<boolean>(false);
  const processedEffectIdsRef = useRef<Set<string>>(new Set());

  const running = useRPGStore((state) => state.running);
  const paused = useRPGStore((state) => state.paused);
  const gameOver = useRPGStore((state) => state.gameOver);

  // 네트워크 동기화 훅 (멀티플레이용)
  const { broadcastGameState, processRemoteInputs } = useNetworkSync();

  const tick = useCallback((timestamp: number) => {
    const state = useRPGStore.getState();

    if (!state.running || state.paused || state.gameOver) {
      animationIdRef.current = requestAnimationFrame(tick);
      return;
    }

    const deltaTime = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1);
    lastTimeRef.current = timestamp;

    // ============================================
    // 멀티플레이어: 클라이언트는 게임 로직 스킵
    // 호스트만 게임 로직 실행, 클라이언트는 상태를 받아서 렌더링만
    // ============================================
    const { isMultiplayer, isHost } = state.multiplayer;

    if (isMultiplayer && !isHost) {
      // 클라이언트: 이펙트 업데이트 + 로컬 영웅 이동 예측
      effectManager.update(deltaTime);

      // 동기화된 기본 공격 이펙트 처리 (클라이언트)
      const clientBasicAttackEffects = useRPGStore.getState().basicAttackEffects;
      for (const effect of clientBasicAttackEffects) {
        if (!processedEffectIdsRef.current.has(effect.id)) {
          processedEffectIdsRef.current.add(effect.id);
          const effectType = effect.type === 'ranged' ? 'attack_ranged' : 'attack_melee';
          effectManager.createEffect(effectType, effect.x, effect.y);
        }
      }

      // 동기화된 넥서스 레이저 이펙트 처리 (클라이언트)
      const clientNexus = useRPGStore.getState().nexus;
      const clientLaserEffects = useRPGStore.getState().nexusLaserEffects;
      for (const effect of clientLaserEffects) {
        if (!processedEffectIdsRef.current.has(effect.id)) {
          processedEffectIdsRef.current.add(effect.id);
          if (clientNexus) {
            effectManager.createEffect('nexus_laser', clientNexus.x, clientNexus.y, effect.targetX, effect.targetY);
            soundManager.play('laser_attack');
          }
        }
      }

      // 동기화된 보스 스킬 경고 이펙트 처리 (클라이언트)
      // 보스 스킬 경고가 끝나갈 때(95% 이상) 이펙트와 사운드 재생
      const clientBossSkillWarnings = useRPGStore.getState().bossSkillWarnings;
      const clientGameTime = useRPGStore.getState().gameTime;
      for (const warning of clientBossSkillWarnings) {
        const elapsed = clientGameTime - warning.startTime;
        const progress = elapsed / warning.duration;

        // 경고가 거의 끝날 때 (95% 이상) 이펙트 재생 (한 번만)
        const effectId = `boss_skill_${warning.skillType}_${warning.startTime}`;
        if (progress >= 0.95 && !processedEffectIdsRef.current.has(effectId)) {
          processedEffectIdsRef.current.add(effectId);

          // 스킬 타입별 이펙트 및 사운드
          switch (warning.skillType) {
            case 'smash':
              effectManager.createEffect('boss_smash', warning.x, warning.y);
              soundManager.play('attack_melee');
              break;
            case 'shockwave':
              effectManager.createEffect('boss_shockwave', warning.x, warning.y);
              soundManager.play('warning');
              break;
            case 'summon':
              effectManager.createEffect('boss_summon', warning.x, warning.y);
              soundManager.play('boss_spawn');
              break;
            case 'knockback':
              effectManager.createEffect('boss_knockback', warning.x, warning.y);
              soundManager.play('warning');
              break;
            case 'charge':
              effectManager.createEffect('boss_charge', warning.x, warning.y);
              soundManager.play('warning');
              break;
            case 'heal':
              effectManager.createEffect('boss_heal', warning.x, warning.y);
              soundManager.play('hero_revive');
              break;
          }
        }
      }

      // 오래된 이펙트 ID 정리 (300ms 이후)
      const now = Date.now();
      for (const effectId of processedEffectIdsRef.current) {
        const timestamp = parseInt(effectId.split('_')[2]) || 0;
        if (now - timestamp > 1000) {
          processedEffectIdsRef.current.delete(effectId);
        }
      }

      const clientHero = useRPGStore.getState().hero;

      // 사망 체크: HP가 0 이하면 이동 불가 및 사망 상태 처리
      if (clientHero && clientHero.hp <= 0) {
        // 이동 방향 초기화 (사망 시 이동 중지)
        if (clientHero.moveDirection) {
          useRPGStore.getState().setMoveDirection(undefined);
        }
        // 카메라는 계속 따라가도록 (관전 모드)
        if (useRPGStore.getState().camera.followHero) {
          useRPGStore.getState().setCamera(clientHero.x, clientHero.y);
        }
        animationIdRef.current = requestAnimationFrame(tick);
        return;
      }

      // 클라이언트도 자신의 영웅 이동을 로컬에서 처리 (부드러운 움직임)
      // 단, 돌진 중이거나 시전 중일 때는 이동 불가
      const isClientDashing = clientHero?.dashState && clientHero.dashState.progress < 1;
      const isClientCasting = clientHero?.castingUntil && clientGameTime < clientHero.castingUntil;

      if (clientHero && clientHero.moveDirection && !isClientDashing && !isClientCasting) {
        const dir = clientHero.moveDirection;
        if (dir.x !== 0 || dir.y !== 0) {
          const speed = clientHero.config.speed || clientHero.baseSpeed || 200;
          const moveDistance = speed * deltaTime * 60;

          // 방향 정규화
          const dirLength = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
          const normalizedX = dir.x / dirLength;
          const normalizedY = dir.y / dirLength;

          const newX = clientHero.x + normalizedX * moveDistance;
          const newY = clientHero.y + normalizedY * moveDistance;

          // 맵 범위 제한 (30px 마진)
          const clampedX = Math.max(30, Math.min(RPG_CONFIG.MAP_WIDTH - 30, newX));
          const clampedY = Math.max(30, Math.min(RPG_CONFIG.MAP_HEIGHT - 30, newY));

          useRPGStore.getState().updateHeroPosition(clampedX, clampedY);
        }
      }

      // 카메라가 내 영웅을 따라가도록 설정
      const updatedHero = useRPGStore.getState().hero;
      if (useRPGStore.getState().camera.followHero && updatedHero) {
        useRPGStore.getState().setCamera(updatedHero.x, updatedHero.y);
      }

      // 클라이언트도 버프 지속시간 업데이트 (모든 영웅)
      useRPGStore.getState().updateBuffs(deltaTime);

      // 클라이언트도 스킬 쿨다운 로컬 업데이트 (즉각적인 UI 피드백)
      useRPGStore.getState().updateSkillCooldowns(deltaTime);

      // 클라이언트도 HP 재생 로컬 처리 (기사 패시브, SP hpRegen)
      const clientHeroForRegen = useRPGStore.getState().hero;
      if (clientHeroForRegen && clientHeroForRegen.hp > 0 && clientHeroForRegen.hp < clientHeroForRegen.maxHp) {
        const clientHeroClass = clientHeroForRegen.heroClass;
        let clientTotalRegen = 0;

        // 기사 패시브 HP 재생 (캐릭터 레벨 5 이상 시 활성화)
        if (clientHeroClass === 'knight') {
          const classConfig = CLASS_CONFIGS[clientHeroClass];
          const baseRegen = clientHeroForRegen.characterLevel >= PASSIVE_UNLOCK_LEVEL ? (classConfig.passive.hpRegen || 0) : 0;
          const growthRegen = clientHeroForRegen.passiveGrowth?.currentValue || 0;
          clientTotalRegen += baseRegen + growthRegen;
        }

        // SP hpRegen 업그레이드 보너스 (전사, 기사만)
        if ((clientHeroClass === 'warrior' || clientHeroClass === 'knight') && clientHeroForRegen.statUpgrades) {
          const hpRegenBonus = getStatBonus('hpRegen', clientHeroForRegen.statUpgrades.hpRegen);
          clientTotalRegen += hpRegenBonus;
        }

        if (clientTotalRegen > 0) {
          const regenAmount = clientTotalRegen * deltaTime;
          const newHp = Math.min(clientHeroForRegen.maxHp, clientHeroForRegen.hp + regenAmount);
          useRPGStore.getState().updateHeroState({ hp: newHp });
        }
      }

      // 다른 플레이어 영웅 위치 보간 업데이트 (부드러운 움직임)
      useRPGStore.getState().updateOtherHeroesInterpolation();

      // 클라이언트: 보류 스킬(운석 등) 이펙트/사운드 처리 (데미지는 호스트가 처리)
      const clientPendingSkills = useRPGStore.getState().pendingSkills;
      const clientCurrentGameTime = useRPGStore.getState().gameTime;
      for (const skill of clientPendingSkills) {
        // 스킬 발동 시점에 이펙트/사운드 재생 (한 번만)
        const pendingEffectId = `pending_${skill.type}_${skill.triggerTime}`;
        if (clientCurrentGameTime >= skill.triggerTime && !processedEffectIdsRef.current.has(pendingEffectId)) {
          processedEffectIdsRef.current.add(pendingEffectId);

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
                  duration: 0.5,
                  startTime: clientCurrentGameTime,
                };
                useRPGStore.getState().addSkillEffect(meteorEffect);
                soundManager.play('attack_melee');
              }
              break;
            case 'dark_blade':
              // 다크나이트 어둠의 칼날 틱 이펙트
              effectManager.createEffect('attack_melee', skill.position.x, skill.position.y);
              soundManager.play('attack_melee');
              break;
            case 'spring_of_life':
              // 힐러 생명의 샘 틱 이펙트
              effectManager.createEffect('heal', skill.position.x, skill.position.y);
              soundManager.play('hero_revive');
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

      animationIdRef.current = requestAnimationFrame(tick);
      return;
    }

    // 멀티플레이어 호스트: 원격 입력 처리
    if (isMultiplayer && isHost) {
      processRemoteInputs();

      // 다른 플레이어 영웅 부활 체크
      updateOtherHeroesRevive(state.gameTime);

      // 다른 플레이어 영웅 이동 업데이트
      updateOtherHeroesMovement(deltaTime);

      // 다른 플레이어 영웅 자동 공격 처리
      updateOtherHeroesAutoAttack(deltaTime, state.enemies, state.gameTime);
    }

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

    // 스킬 쿨다운 업데이트 (호스트가 살아있을 때만)
    if (!isHostDead) {
      useRPGStore.getState().updateSkillCooldowns(deltaTime);
    }

    // 자동 공격: 적이 사거리 내에 있고 Q 스킬이 준비되면 자동 발동 (호스트가 살아있을 때만)
    // 단, 돌진 중이거나 시전 중일 때는 공격 불가
    const heroForAutoAttack = useRPGStore.getState().hero;
    const autoAttackGameTime = useRPGStore.getState().gameTime;
    const isHeroCasting = heroForAutoAttack?.castingUntil && autoAttackGameTime < heroForAutoAttack.castingUntil;
    if (!isHostDead && heroForAutoAttack && !heroForAutoAttack.dashState && !isHeroCasting) {
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

              // 광전사 버프 공격력 보너스 적용
              const hostBerserkerBuff = heroForAutoAttack.buffs?.find(b => b.type === 'berserker');
              if (hostBerserkerBuff?.attackBonus) {
                totalAttack = Math.floor(totalAttack * (1 + hostBerserkerBuff.attackBonus));
              }

              // 기지에 데미지 적용 (attackerId 전달로 골드 배분용 공격자 추적)
              const myHeroId = state.multiplayer.myHeroId || state.hero?.id;
              const { destroyed, goldReceived } = useRPGStore.getState().damageBase(nearestBase.id, totalAttack, myHeroId);

              // 이펙트 및 사운드
              effectManager.createEffect('attack_melee', nearestBase.x, nearestBase.y);
              if (heroClass === 'archer' || heroClass === 'mage') {
                soundManager.play('attack_ranged');
              } else {
                soundManager.play('attack_melee');
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

    // 영웅 공격 데미지 처리
    if (heroResult.enemyDamage) {
      const myHeroId = state.multiplayer.myHeroId || state.hero?.id;
      const killed = useRPGStore.getState().damageEnemy(
        heroResult.enemyDamage.targetId,
        heroResult.enemyDamage.damage,
        myHeroId
      );

      if (killed) {
        const enemy = state.enemies.find((e) => e.id === heroResult.enemyDamage!.targetId);
        if (enemy) {
          // 골드 획득은 damageEnemy 내에서 자동 처리됨
          // 적 제거
          useRPGStore.getState().removeEnemy(enemy.id);

          // 킬 이펙트
          effectManager.createEffect('attack_melee', enemy.x, enemy.y);
          soundManager.play('attack_melee');
        }
      } else {
        // 공격 이펙트
        const target = state.enemies.find((e) => e.id === heroResult.enemyDamage!.targetId);
        if (target) {
          effectManager.createEffect('attack_melee', target.x, target.y);
          soundManager.play('attack_melee');
        }
      }
    }

    // 영웅 상태 업데이트 (위치, 돌진 상태, 시전 상태, 이동 상태 등)
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

    // 버프 업데이트
    useRPGStore.getState().updateBuffs(deltaTime);

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

      if (isMultiplayer && allHeroes.length > 1) {
        // 멀티플레이어: 모든 영웅을 고려한 AI
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

          if (heroId === currentHeroState.id) {
            // 호스트 영웅 데미지
            useRPGStore.getState().damageHero(finalDamage);
            effectManager.createEffect('attack_melee', currentHeroState.x, currentHeroState.y);
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
              effectManager.createEffect('attack_melee', otherHero.x, otherHero.y);
            }
          }
          soundManager.play('attack_melee');
        });

        // 게임 오버 체크 (모든 플레이어 사망 시)
        const heroAfterDamage = useRPGStore.getState().hero;
        const otherHeroesAfterDamage = useRPGStore.getState().otherHeroes;

        // 호스트 생존 여부
        const hostAlive = heroAfterDamage && heroAfterDamage.hp > 0;

        // 다른 플레이어들 생존 여부
        let anyOtherAlive = false;
        otherHeroesAfterDamage.forEach((otherHero) => {
          if (otherHero.hp > 0) {
            anyOtherAlive = true;
          }
        });

        // 모든 플레이어가 사망했을 때만 게임 오버
        if (!hostAlive && !anyOtherAlive) {
          useRPGStore.getState().setGameOver(false);
          soundManager.play('defeat');
          // 멀티플레이어: 클라이언트들에게 게임 종료 알림
          const mpState = useRPGStore.getState().multiplayer;
          if (mpState.isMultiplayer && mpState.isHost) {
            wsClient.hostBroadcastGameOver({ victory: false });
          }
          return;
        }
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
          effectManager.createEffect('attack_melee', updatedHero.x, updatedHero.y);
          soundManager.play('attack_melee');

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
          // 멀티플레이어: 클라이언트들에게 게임 종료 알림
          const mpState = useRPGStore.getState().multiplayer;
          if (mpState.isMultiplayer && mpState.isHost) {
            wsClient.hostBroadcastGameOver({ victory: false });
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

        // 레이저 이펙트 추가 (시각 효과 + 네트워크 동기화)
        for (const effect of laserResult.laserEffects) {
          useRPGStore.getState().addNexusLaserEffect(effect);
          // 시각 이펙트 생성 (넥서스에서 타겟으로)
          effectManager.createEffect('nexus_laser', latestNexus!.x, latestNexus!.y, effect.targetX, effect.targetY);
          soundManager.play('laser_attack');
        }

        // 레이저 데미지 적용
        for (const { enemyId, damage } of laserResult.damagedEnemies) {
          const targetEnemy = updatedEnemies.find(e => e.id === enemyId);
          if (targetEnemy) {
            targetEnemy.hp -= damage;
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
          const targetHero = heroId === latestHero?.id
            ? latestHero
            : latestOtherHeroes.get(heroId);

          if (!targetHero) return;
          if (targetHero.hp <= 0) return;  // 사망한 영웅에게 데미지 적용 안 함

          const finalDamage = calculateDamageAfterReduction(damage, targetHero);

          if (heroId === latestHero?.id) {
            useRPGStore.getState().damageHero(finalDamage);
            effectManager.createEffect('boss_smash', targetHero.x, targetHero.y);
          } else {
            const otherHero = latestOtherHeroes.get(heroId);
            if (otherHero) {
              const newHp = Math.max(0, otherHero.hp - finalDamage);
              useRPGStore.getState().updateOtherHero(heroId, { hp: newHp });
              effectManager.createEffect('boss_smash', otherHero.x, otherHero.y);
            }
          }
          soundManager.play('attack_melee');
        });

        // 스턴 적용
        bossSkillResult.stunnedHeroes.forEach((stunDuration, heroId) => {
          const targetHero = heroId === latestHero?.id
            ? latestHero
            : latestOtherHeroes.get(heroId);

          if (!targetHero) return;
          if (targetHero.hp <= 0) return;  // 사망한 영웅에게 스턴 적용 안 함

          if (heroId === latestHero?.id) {
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
          // 사망한 영웅에게 넉백 적용 안 함
          const targetHero = heroId === latestHero?.id
            ? latestHero
            : latestOtherHeroes.get(heroId);
          if (!targetHero || targetHero.hp <= 0) return;

          if (heroId === latestHero?.id) {
            useRPGStore.getState().updateHeroState({ x: newPos.x, y: newPos.y });
            effectManager.createEffect('boss_knockback', newPos.x, newPos.y);
          } else {
            useRPGStore.getState().updateOtherHero(heroId, { x: newPos.x, y: newPos.y });
            effectManager.createEffect('boss_knockback', newPos.x, newPos.y);
          }
        });

        // 돌진(charge) 처리 - 보스 위치 변경
        if (bossSkillResult.bossNewPosition) {
          const bossEnemyList = useRPGStore.getState().enemies.map(e =>
            e.id === boss.id
              ? { ...e, x: bossSkillResult.bossNewPosition!.x, y: bossSkillResult.bossNewPosition!.y }
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
        if (bossSkillResult.skillExecuted === 'smash') {
          effectManager.createEffect('boss_smash', boss.x, boss.y);
          soundManager.play('attack_melee');
        } else if (bossSkillResult.skillExecuted === 'shockwave') {
          effectManager.createEffect('boss_shockwave', boss.x, boss.y);
          soundManager.play('warning');
        } else if (bossSkillResult.skillExecuted === 'summon') {
          effectManager.createEffect('boss_summon', boss.x, boss.y);
          soundManager.play('boss_spawn');
        } else if (bossSkillResult.skillExecuted === 'knockback') {
          effectManager.createEffect('boss_knockback', boss.x, boss.y);
          soundManager.play('warning');
        } else if (bossSkillResult.skillExecuted === 'charge') {
          effectManager.createEffect('boss_charge', boss.x, boss.y);
          soundManager.play('warning');
        } else if (bossSkillResult.skillExecuted === 'heal') {
          effectManager.createEffect('boss_heal', boss.x, boss.y);
          soundManager.play('hero_revive');
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
            };
            useRPGStore.getState().addSkillEffect(explosionEffect);
            soundManager.play('attack_melee');
          } else if (skill.type === 'meteor_shower') {
            // 대마법사 메테오 샤워 이펙트
            const meteorEffect: SkillEffect = {
              type: 'meteor_shower' as SkillType,
              position: { x: skill.position.x, y: skill.position.y },
              radius: skill.radius,
              damage: skill.damage,
              duration: 0.5,
              startTime: currentGameTime,
            };
            useRPGStore.getState().addSkillEffect(meteorEffect);
            soundManager.play('attack_melee');
          } else if (skill.type === 'spring_of_life') {
            // 힐러 생명의 샘 - 힐 이펙트는 위에서 이미 처리됨
            soundManager.play('hero_revive');
          } else if (skill.type === 'dark_blade') {
            // 다크나이트 어둠의 칼날 틱 이펙트
            effectManager.createEffect('attack_melee', skill.position.x, skill.position.y);
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

      // 틱 스킬 재등록 (다크나이트 어둠의 칼날, 힐러 생명의 샘)
      // 데미지/힐은 위의 범위 스킬 처리에서 이미 적용됨
      if (skill.tickCount && skill.tickCount > 1) {
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
      ? Object.keys(latestState.otherHeroes).length + 1  // 내 영웅 + 다른 플레이어들
      : 1;

    // 게임 단계에 따른 처리
    if (latestState.gamePhase === 'playing') {
      // 적 기지에서 동시 스폰 (양쪽에서 여러 마리)
      const enemyBases = latestState.enemyBases;
      const spawnResult = shouldSpawnEnemy(latestState.gameTime, latestState.lastSpawnTime, enemyBases, difficulty, playerCount);

      if (spawnResult.shouldSpawn && spawnResult.spawns.length > 0) {
        // 각 기지에서 스폰
        for (const spawn of spawnResult.spawns) {
          const base = enemyBases.find(b => b.id === spawn.baseId);
          if (base && !base.destroyed) {
            // 해당 기지에서 count만큼 적 생성
            for (let i = 0; i < spawn.count; i++) {
              const enemy = createEnemyFromBase(base, latestState.gameTime, difficulty, playerCount);
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

      // 두 기지 모두 파괴되면 보스 단계로 (보스 스폰은 boss_phase에서 처리)
      const allBasesDestroyed = enemyBases.every(b => b.destroyed);
      if (allBasesDestroyed) {
        useRPGStore.getState().setGamePhase('boss_phase');
      }
    } else if (latestState.gamePhase === 'boss_phase') {
      // 보스 단계 진입 시 보스 스폰 (아직 스폰 안됐으면)
      if (!bossesSpawnedRef.current) {
        showNotification('🔥 모든 기지 파괴! 보스 출현!');
        soundManager.play('warning');
        soundManager.play('boss_spawn');

        // 플레이어 수 계산 (자신 + 다른 플레이어)
        const playerCount = 1 + latestState.otherHeroes.size;

        // 보스 2마리 스폰 (난이도 전달)
        const bosses = createBosses(latestState.enemyBases, playerCount, difficulty);
        for (const boss of bosses) {
          useRPGStore.getState().addEnemy(boss);
        }
        bossesSpawnedRef.current = true;
        // 보스 스폰 직후에는 승리 체크 스킵 (다음 프레임에서 체크)
      } else {
        // 보스 단계: 모든 보스 처치 시 승리 (보스 스폰 후 프레임부터 체크)
        // 최신 상태에서 적 목록 가져오기 (latestState는 이미 오래됨)
        const currentEnemies = useRPGStore.getState().enemies;
        if (areAllBossesDead(currentEnemies)) {
          useRPGStore.getState().setGameOver(true);
          showNotification('🏆 승리! 모든 보스를 처치했습니다!');
          soundManager.play('victory');
          // 멀티플레이어: 클라이언트들에게 게임 종료 알림
          const mpState = useRPGStore.getState().multiplayer;
          if (mpState.isMultiplayer && mpState.isHost) {
            wsClient.hostBroadcastGameOver({ victory: true });
          }
        }
      }
    }

    // 이펙트 업데이트
    effectManager.update(deltaTime);

    // 동기화된 기본 공격 이펙트 처리 (호스트 및 싱글플레이어)
    const hostBasicAttackEffects = useRPGStore.getState().basicAttackEffects;
    for (const effect of hostBasicAttackEffects) {
      if (!processedEffectIdsRef.current.has(effect.id)) {
        processedEffectIdsRef.current.add(effect.id);
        const effectType = effect.type === 'ranged' ? 'attack_ranged' : 'attack_melee';
        effectManager.createEffect(effectType, effect.x, effect.y);
      }
    }
    // 오래된 기본 공격 이펙트 정리
    useRPGStore.getState().cleanBasicAttackEffects();

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

    // ============================================
    // 멀티플레이어: 호스트 상태 브로드캐스트
    // ============================================
    const finalState = useRPGStore.getState();
    if (finalState.multiplayer.isMultiplayer && finalState.multiplayer.isHost) {
      broadcastGameState();
    }

    animationIdRef.current = requestAnimationFrame(tick);
  }, [broadcastGameState, processRemoteInputs]);

  // 스킬 결과 처리 공통 함수
  const processSkillResult = useCallback(
    (result: ReturnType<typeof executeQSkill>, state: ReturnType<typeof useRPGStore.getState>, killerHeroId?: string) => {
      // 상태 업데이트
      if (result.effect) {
        useRPGStore.setState((s) => ({
          hero: result.hero,
          activeSkillEffects: [...s.activeSkillEffects, result.effect!],
        }));
      } else {
        useRPGStore.setState({ hero: result.hero });
      }

      // 적 데미지 적용
      for (const damage of result.enemyDamages) {
        const killed = useRPGStore.getState().damageEnemy(damage.enemyId, damage.damage, killerHeroId);
        if (killed) {
          const enemy = state.enemies.find((e) => e.id === damage.enemyId);
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
          const { destroyed, goldReceived } = useRPGStore.getState().damageBase(baseDamage.baseId, baseDamage.damage, killerHeroId);
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

        // 멀티플레이어: 아군에게 버프 공유 (광전사, 철벽 방어)
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
          } else {
            // 다른 영웅인 경우
            const targetHero = currentState.otherHeroes.get(heal.heroId);
            if (targetHero) {
              // 사망한 영웅에게는 힐 적용 안 함
              if (targetHero.hp <= 0) continue;
              const newHp = Math.min(targetHero.maxHp, targetHero.hp + heal.heal);
              currentState.updateOtherHero(heal.heroId, { hp: newHp });
              effectManager.createEffect('heal', targetHero.x, targetHero.y);
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

  // 스킬 실행 처리
  const handleSkillExecution = useCallback(
    (skillType: SkillType, gameTime: number) => {
      const state = useRPGStore.getState();
      if (!state.hero) return;
      if (state.hero.hp <= 0) return;  // 사망한 영웅은 스킬 사용 불가

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

      // Q 스킬 (기본 스킬 또는 영웅의 Q 스킬)
      if (skillType === classSkills.q.type || skillType === heroQSkillType) {
        const result = executeQSkill(state.hero, state.enemies, targetX, targetY, gameTime, state.enemyBases, attackUpgradeLevel);
        processSkillResult(result, state, myHeroId);
        return;
      }

      // W 스킬 (기본 스킬 또는 영웅의 W 스킬 - 전직 스킬 포함)
      if (skillType === classSkills.w.type || skillType === heroWSkillType) {
        // 아군 목록 (내 영웅 + 다른 플레이어 영웅)
        const allies: HeroUnit[] = [];
        if (state.hero) allies.push(state.hero);
        state.otherHeroes.forEach((h) => allies.push(h));

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

        // 영웅 부활 처리
        state.updateOtherHero(heroId, {
          hp: hero.maxHp * RPG_CONFIG.REVIVE.REVIVE_HP_PERCENT,
          x: nexusX + offsetX,
          y: nexusY + offsetY,
          deathTime: undefined,
          moveDirection: undefined,
          state: 'idle',
          buffs: [...(hero.buffs || []), invincibleBuff],
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

  state.otherHeroes.forEach((hero, heroId) => {
    // 사망 상태면 이동 스킵
    if (hero.hp <= 0) return;

    // 돌진 중인 경우 - 일반 이동보다 우선
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

    if (!hero.moveDirection) return;

    const { x: dirX, y: dirY } = hero.moveDirection;
    const speed = hero.config.speed || hero.baseSpeed || 200;

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

    // 광전사 버프 확인 (공격속도 증가)
    const berserkerBuff = hero.buffs?.find(b => b.type === 'berserker');
    const attackSpeedMultiplier = berserkerBuff?.speedBonus ? (1 + berserkerBuff.speedBonus) : 1;

    // 스킬 쿨다운 업데이트 (광전사 버프 공격속도 적용)
    const updatedSkills = hero.skills.map(skill => {
      // Q스킬(기본 공격)에만 공격속도 버프 적용
      const isQSkill = skill.type.endsWith('_q');
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
        });

        // Q 스킬 쿨다운 리셋
        const skillsWithCooldown = updatedSkills.map(s =>
          s.type === qSkillType ? { ...s, currentCooldown: s.cooldown } : s
        );
        state.updateOtherHero(heroId, {
          skills: skillsWithCooldown,
          facingAngle: Math.atan2(firstTarget.y - hero.y, firstTarget.x - hero.x),
        });

        soundManager.play('attack_ranged');
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
          });

          // Q 스킬 쿨다운 리셋
          let skillsWithCooldown = updatedSkills.map(s =>
            s.type === qSkillType ? { ...s, currentCooldown: s.cooldown } : s
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

          state.updateOtherHero(heroId, {
            skills: skillsWithCooldown,
            facingAngle: Math.atan2(nearestEnemy.y - hero.y, nearestEnemy.x - hero.x),
          });

          // 사운드 재생
          if (heroClass === 'mage') {
            soundManager.play('attack_ranged');
          } else {
            soundManager.play('attack_melee');
          }

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

          // 공격 방향 계산
          const baseDirX = nearestBase.x - hero.x;
          const baseDirY = nearestBase.y - hero.y;
          const baseDirDist = Math.sqrt(baseDirX * baseDirX + baseDirY * baseDirY);
          const normalizedBaseDirX = baseDirDist > 0 ? baseDirX / baseDirDist : 1;
          const normalizedBaseDirY = baseDirDist > 0 ? baseDirY / baseDirDist : 0;

          // Q 스킬 쿨다운 리셋
          const skillsWithCooldown = updatedSkills.map(s =>
            s.type === qSkillType ? { ...s, currentCooldown: s.cooldown } : s
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
          });

          if (heroClass === 'archer' || heroClass === 'mage') {
            soundManager.play('attack_ranged');
          } else {
            soundManager.play('attack_melee');
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
