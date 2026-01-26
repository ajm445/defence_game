import { useRef, useCallback, useEffect } from 'react';
import { useRPGStore } from '../stores/useRPGStore';
import { useUIStore } from '../stores/useUIStore';
import { RPG_CONFIG, CLASS_SKILLS, CLASS_CONFIGS, PASSIVE_UNLOCK_LEVEL, MILESTONE_CONFIG, UPGRADE_CONFIG } from '../constants/rpgConfig';
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
import { createBosses, areAllBossesDead, hasBosses } from '../game/rpg/bossSystem';
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
      if (clientHero && clientHero.moveDirection) {
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
    const heroForAutoAttack = useRPGStore.getState().hero;
    if (!isHostDead && heroForAutoAttack && !heroForAutoAttack.dashState) {
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

              // 기지에 데미지 적용
              const destroyed = useRPGStore.getState().damageBase(nearestBase.id, totalAttack);

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
                showNotification(`적 기지 파괴!`);
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
    const heroResult = updateHeroUnit(currentHeroForUpdate, deltaTime, state.enemies);
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

    // 영웅 상태 업데이트 (위치, 돌진 상태, 이동 상태 등)
    useRPGStore.getState().updateHeroState({
      x: updatedHero.x,
      y: updatedHero.y,
      state: updatedHero.state,
      dashState: updatedHero.dashState,
      targetPosition: updatedHero.targetPosition,
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

      // 적 상태 업데이트
      useRPGStore.getState().updateEnemies(updatedEnemies.filter((e) => e.hp > 0));
    }

    // 보류 스킬 처리 (운석 낙하 등)
    const pendingSkills = useRPGStore.getState().pendingSkills;
    const currentGameTime = useRPGStore.getState().gameTime;
    const triggeredSkills: number[] = [];

    pendingSkills.forEach((skill, index) => {
      if (currentGameTime >= skill.triggerTime) {
        triggeredSkills.push(index);

        // 범위 내 적에게 데미지
        const enemies = useRPGStore.getState().enemies;
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

        // 운석 폭발 이펙트 추가 (스킬 타입이 mage_e인 경우)
        if (skill.type === 'mage_e') {
          const explosionEffect: SkillEffect = {
            type: 'mage_meteor' as SkillType,
            position: { x: skill.position.x, y: skill.position.y },
            radius: skill.radius,
            damage: skill.damage,
            duration: 0.5, // 폭발 애니메이션 시간
            startTime: currentGameTime,
          };
          useRPGStore.getState().addSkillEffect(explosionEffect);
        } else {
          // 기본 폭발 이펙트
          effectManager.createEffect('attack_melee', skill.position.x, skill.position.y);
        }
        soundManager.play('attack_melee');
      }
    });

    // 발동된 보류 스킬 제거 (역순)
    for (let i = triggeredSkills.length - 1; i >= 0; i--) {
      useRPGStore.getState().removePendingSkill(triggeredSkills[i]);
    }

    // 넥서스 디펜스: 연속 스폰 처리
    const latestState = useRPGStore.getState();
    const showNotification = useUIStore.getState().showNotification;

    // 게임 단계에 따른 처리
    if (latestState.gamePhase === 'playing') {
      // 적 기지에서 동시 스폰 (양쪽에서 여러 마리)
      const enemyBases = latestState.enemyBases;
      const spawnResult = shouldSpawnEnemy(latestState.gameTime, latestState.lastSpawnTime, enemyBases);

      if (spawnResult.shouldSpawn && spawnResult.spawns.length > 0) {
        // 각 기지에서 스폰
        for (const spawn of spawnResult.spawns) {
          const base = enemyBases.find(b => b.id === spawn.baseId);
          if (base && !base.destroyed) {
            // 해당 기지에서 count만큼 적 생성
            for (let i = 0; i < spawn.count; i++) {
              const enemy = createEnemyFromBase(base, latestState.gameTime);
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

        // 보스 2마리 스폰
        const bosses = createBosses(latestState.enemyBases, playerCount);
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
          const destroyed = useRPGStore.getState().damageBase(baseDamage.baseId, baseDamage.damage);
          if (destroyed) {
            const showNotification = useUIStore.getState().showNotification;
            showNotification(`적 기지 파괴!`);
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
    },
    []
  );

  // 스킬 실행 처리
  const handleSkillExecution = useCallback(
    (skillType: SkillType, gameTime: number) => {
      const state = useRPGStore.getState();
      if (!state.hero) return;

      const heroClass = state.hero.heroClass;
      // 마우스 위치를 스킬 타겟으로 사용 (바라보는 방향으로 공격)
      const targetX = state.mousePosition.x;
      const targetY = state.mousePosition.y;

      // 직업별 스킬 처리
      const classSkills = CLASS_SKILLS[heroClass];
      const myHeroId = state.multiplayer.myHeroId || state.hero?.id;

      // Q 스킬
      if (skillType === classSkills.q.type) {
        const result = executeQSkill(state.hero, state.enemies, targetX, targetY, gameTime, state.enemyBases);
        processSkillResult(result, state, myHeroId);
        return;
      }

      // W 스킬
      if (skillType === classSkills.w.type) {
        const result = executeWSkill(state.hero, state.enemies, targetX, targetY, gameTime, state.enemyBases);
        processSkillResult(result, state, myHeroId);

        // 기사 방패 돌진 알림
        if (heroClass === 'knight') {
          const showNotification = useUIStore.getState().showNotification;
          showNotification('방패 돌진!');
        }
        return;
      }

      // E 스킬
      if (skillType === classSkills.e.type) {
        const result = executeESkill(state.hero, state.enemies, targetX, targetY, gameTime, state.enemyBases, myHeroId);
        processSkillResult(result, state, myHeroId);

        // 특수 알림
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
        return;
      }
    },
    [processSkillResult]
  );

  // 스킬 사용 요청 (외부에서 호출)
  const requestSkill = useCallback((skillType: SkillType) => {
    const state = useRPGStore.getState();
    if (!state.hero) return false;

    const skill = state.hero.skills.find((s) => s.type === skillType);
    if (!skill || skill.currentCooldown > 0) {
      return false;
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
      if (!wasRunningRef.current) {
        bossesSpawnedRef.current = false;
      }
      wasRunningRef.current = true;
      animationIdRef.current = requestAnimationFrame(tick);
    } else {
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

            // 기지 데미지 적용
            const destroyed = state.damageBase(base.id, totalDamage);
            hitTargets.push({ x: base.x, y: base.y, damage: totalDamage });

            if (destroyed) {
              const showNotification = useUIStore.getState().showNotification;
              showNotification(`적 기지 파괴!`);
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

          const destroyed = state.damageBase(nearestBase.id, baseTotalDamage);

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
            showNotification(`적 기지 파괴!`);
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
