import { useRef, useCallback, useEffect } from 'react';
import { useRPGStore } from '../stores/useRPGStore';
import { useUIStore } from '../stores/useUIStore';
import { RPG_CONFIG, CLASS_SKILLS, CLASS_CONFIGS, PASSIVE_UNLOCK_LEVEL, MILESTONE_CONFIG } from '../constants/rpgConfig';
import { updateHeroUnit, findNearestEnemy, findNearestEnemyBase } from '../game/rpg/heroUnit';
import {
  executeDash,
  executeSpin,
  executeHeal,
  updateSkillCooldowns,
  executeQSkill,
  executeWSkill,
  executeESkill,
  canUseSkill,
} from '../game/rpg/skillSystem';
import {
  updateAllEnemiesAINexus,
  calculateDamageAfterReduction,
  applyStunToEnemy,
} from '../game/rpg/enemyAI';
import { effectManager } from '../effects';
import { soundManager } from '../services/SoundManager';
import { SkillType, PendingSkill, SkillEffect } from '../types/rpg';
import { distance } from '../utils/math';
import { createEnemyFromBase, getSpawnConfig, shouldSpawnEnemy } from '../game/rpg/nexusSpawnSystem';
import { createBosses, areAllBossesDead, hasBosses } from '../game/rpg/bossSystem';

export function useRPGGameLoop() {
  const lastTimeRef = useRef<number>(0);
  const animationIdRef = useRef<number>(0);
  const pendingSkillRef = useRef<SkillType | null>(null);
  const bossesSpawnedRef = useRef<boolean>(false);

  const running = useRPGStore((state) => state.running);
  const paused = useRPGStore((state) => state.paused);
  const gameOver = useRPGStore((state) => state.gameOver);

  const tick = useCallback((timestamp: number) => {
    const state = useRPGStore.getState();

    if (!state.running || state.paused || state.gameOver) {
      animationIdRef.current = requestAnimationFrame(tick);
      return;
    }

    const deltaTime = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1);
    lastTimeRef.current = timestamp;

    // 게임 시간 업데이트
    useRPGStore.getState().updateGameTime(deltaTime);

    // 영웅 없으면 스킵
    if (!state.hero) {
      animationIdRef.current = requestAnimationFrame(tick);
      return;
    }

    // 스킬 쿨다운 업데이트
    useRPGStore.getState().updateSkillCooldowns(deltaTime);

    // 자동 공격: 적이 사거리 내에 있고 Q 스킬이 준비되면 자동 발동
    const heroForAutoAttack = useRPGStore.getState().hero;
    if (heroForAutoAttack && !heroForAutoAttack.dashState) {
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
              const attackBonus = upgradeLevels.attack * 5; // 업그레이드당 5 공격력
              const totalAttack = baseAttack + attackBonus;

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
      const killed = useRPGStore.getState().damageEnemy(
        heroResult.enemyDamage.targetId,
        heroResult.enemyDamage.damage
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

    // 패시브 HP 재생 (기사: 캐릭터 레벨 5 이상 시 패시브 활성화)
    const heroForRegen = useRPGStore.getState().hero;
    if (heroForRegen && heroForRegen.heroClass === 'knight' && heroForRegen.hp < heroForRegen.maxHp) {
      const classConfig = CLASS_CONFIGS[heroForRegen.heroClass];
      const baseRegen = heroForRegen.characterLevel >= PASSIVE_UNLOCK_LEVEL ? (classConfig.passive.hpRegen || 0) : 0;
      const growthRegen = heroForRegen.passiveGrowth.currentValue;
      const totalRegen = baseRegen + growthRegen;

      if (totalRegen > 0) {
        const regenAmount = totalRegen * deltaTime;
        const newHp = Math.min(heroForRegen.maxHp, heroForRegen.hp + regenAmount);
        useRPGStore.getState().updateHeroState({ hp: newHp });
      }
    }

    // 버프 업데이트
    useRPGStore.getState().updateBuffs(deltaTime);

    // 시야 업데이트
    useRPGStore.getState().updateVisibility();

    // 적 AI 업데이트 (넥서스 타겟팅 버전)
    const currentHeroState = useRPGStore.getState().hero;
    const currentEnemies = useRPGStore.getState().enemies;
    const currentNexus = useRPGStore.getState().nexus;

    if (currentHeroState) {
      const { updatedEnemies, totalHeroDamage: rawDamage, totalNexusDamage } = updateAllEnemiesAINexus(
        currentEnemies,
        currentHeroState,
        currentNexus,
        deltaTime,
        state.gameTime
      );

      // 영웅 데미지 적용 (데미지 감소 버프 적용)
      if (rawDamage > 0) {
        const finalDamage = calculateDamageAfterReduction(rawDamage, currentHeroState);
        useRPGStore.getState().damageHero(finalDamage);
        effectManager.createEffect('attack_melee', updatedHero.x, updatedHero.y);
        soundManager.play('attack_melee');

        // 게임 오버 체크 (플레이어 사망)
        const heroAfterDamage = useRPGStore.getState().hero;
        if (!heroAfterDamage || heroAfterDamage.hp <= 0) {
          useRPGStore.getState().setGameOver(false);
          soundManager.play('defeat');
          return;
        }
      }

      // 넥서스 데미지 적용
      if (totalNexusDamage > 0) {
        useRPGStore.getState().damageNexus(totalNexusDamage);

        // 넥서스 파괴 체크
        const nexusAfterDamage = useRPGStore.getState().nexus;
        if (!nexusAfterDamage || nexusAfterDamage.hp <= 0) {
          soundManager.play('defeat');
          const showNotification = useUIStore.getState().showNotification;
          showNotification('넥서스가 파괴되었습니다!');
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
            const killed = useRPGStore.getState().damageEnemy(enemy.id, skill.damage);
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
      // 적 기지에서 연속 스폰
      const enemyBases = latestState.enemyBases;
      const spawnResult = shouldSpawnEnemy(latestState.gameTime, latestState.lastSpawnTime, enemyBases);

      if (spawnResult.shouldSpawn && spawnResult.baseId) {
        const base = enemyBases.find(b => b.id === spawnResult.baseId);
        if (base) {
          const enemy = createEnemyFromBase(base, latestState.gameTime);
          if (enemy) {
            useRPGStore.getState().addEnemy(enemy);
            useRPGStore.getState().setLastSpawnTime(latestState.gameTime);
          }
        }
      }

      // 5분 마일스톤 보상 체크
      if (latestState.gameTime >= 300 && !latestState.fiveMinuteRewardClaimed) {
        useRPGStore.getState().setFiveMinuteRewardClaimed();
        showNotification(`🎉 5분 생존! 보너스 경험치 ${MILESTONE_CONFIG.FIVE_MINUTE_BONUS_EXP}!`);
        soundManager.play('victory');
      }

      // 두 기지 모두 파괴되면 보스 단계로
      const allBasesDestroyed = enemyBases.every(b => b.destroyed);
      if (allBasesDestroyed && !bossesSpawnedRef.current) {
        useRPGStore.getState().setGamePhase('boss_phase');
        showNotification('🔥 모든 기지 파괴! 보스 출현!');
        soundManager.play('warning');
        soundManager.play('boss_spawn');

        // 보스 2마리 스폰
        const bosses = createBosses(enemyBases, latestState.gameTime);
        for (const boss of bosses) {
          useRPGStore.getState().addEnemy(boss);
        }
        bossesSpawnedRef.current = true;
      }
    } else if (latestState.gamePhase === 'boss_phase') {
      // 보스 단계: 모든 보스 처치 시 승리
      if (bossesSpawnedRef.current && areAllBossesDead(latestState.enemies)) {
        useRPGStore.getState().setGameOver(true);
        showNotification('🏆 승리! 모든 보스를 처치했습니다!');
        soundManager.play('victory');
      }
    }

    // 이펙트 업데이트
    effectManager.update(deltaTime);

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

    animationIdRef.current = requestAnimationFrame(tick);
  }, []);

  // 스킬 결과 처리 공통 함수
  const processSkillResult = useCallback(
    (result: ReturnType<typeof executeQSkill>, state: ReturnType<typeof useRPGStore.getState>) => {
      // 상태 업데이트
      if (result.effect) {
        useRPGStore.setState((s) => ({
          hero: result.hero,
          activeSkillEffects: [...s.activeSkillEffects, result.effect!],
        }));
      } else {
        useRPGStore.setState({ hero: result.hero });
      }

      // 데미지 적용
      for (const damage of result.enemyDamages) {
        const killed = useRPGStore.getState().damageEnemy(damage.enemyId, damage.damage);
        if (killed) {
          const enemy = state.enemies.find((e) => e.id === damage.enemyId);
          if (enemy) {
            // 골드 획득은 damageEnemy 내에서 자동 처리됨
            useRPGStore.getState().removeEnemy(enemy.id);
            effectManager.createEffect('attack_melee', enemy.x, enemy.y);
          }
        }
      }

      // 버프 적용
      if (result.buff) {
        useRPGStore.getState().addBuff(result.buff);
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

      // 기존 스킬 처리 (하위 호환)
      switch (skillType) {
        case 'dash': {
          const result = executeDash(state.hero, state.enemies, targetX, targetY, gameTime);
          useRPGStore.setState((s) => ({
            hero: result.hero,
            activeSkillEffects: [...s.activeSkillEffects, result.effect],
          }));
          for (const damage of result.enemyDamages) {
            const killed = useRPGStore.getState().damageEnemy(damage.enemyId, damage.damage);
            if (killed) {
              const enemy = state.enemies.find((e) => e.id === damage.enemyId);
              if (enemy) {
                // 골드 획득은 damageEnemy 내에서 자동 처리됨
                useRPGStore.getState().removeEnemy(enemy.id);
              }
            }
          }
          return;
        }
        case 'spin': {
          const result = executeSpin(state.hero, state.enemies, gameTime);
          useRPGStore.setState((s) => ({
            hero: result.hero,
            activeSkillEffects: [...s.activeSkillEffects, result.effect],
          }));
          for (const damage of result.enemyDamages) {
            const killed = useRPGStore.getState().damageEnemy(damage.enemyId, damage.damage);
            if (killed) {
              const enemy = state.enemies.find((e) => e.id === damage.enemyId);
              if (enemy) {
                // 골드 획득은 damageEnemy 내에서 자동 처리됨
                useRPGStore.getState().removeEnemy(enemy.id);
              }
            }
          }
          return;
        }
        case 'heal': {
          const result = executeHeal(state.hero, gameTime);
          useRPGStore.setState((s) => ({
            hero: result.hero,
            activeSkillEffects: [...s.activeSkillEffects, result.effect],
          }));
          const showNotification = useUIStore.getState().showNotification;
          showNotification(`HP ${result.healAmount} 회복!`);
          return;
        }
      }

      // 새로운 직업별 스킬 처리
      const classSkills = CLASS_SKILLS[heroClass];

      // Q 스킬
      if (skillType === classSkills.q.type) {
        const result = executeQSkill(state.hero, state.enemies, targetX, targetY, gameTime);
        processSkillResult(result, state);
        return;
      }

      // W 스킬
      if (skillType === classSkills.w.type) {
        const result = executeWSkill(state.hero, state.enemies, targetX, targetY, gameTime);
        processSkillResult(result, state);

        // 기사 방패 돌진 알림
        if (heroClass === 'knight') {
          const showNotification = useUIStore.getState().showNotification;
          showNotification('방패 돌진!');
        }
        return;
      }

      // E 스킬
      if (skillType === classSkills.e.type) {
        const result = executeESkill(state.hero, state.enemies, targetX, targetY, gameTime);
        processSkillResult(result, state);

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
      bossesSpawnedRef.current = false;  // 게임 시작 시 보스 스폰 플래그 리셋
      animationIdRef.current = requestAnimationFrame(tick);
    }

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    };
  }, [running, paused, gameOver, tick]);

  return { requestSkill };
}
