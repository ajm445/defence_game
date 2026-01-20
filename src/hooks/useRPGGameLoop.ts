import { useRef, useCallback, useEffect } from 'react';
import { useRPGStore } from '../stores/useRPGStore';
import { useUIStore } from '../stores/useUIStore';
import { RPG_CONFIG, CLASS_SKILLS } from '../constants/rpgConfig';
import { updateHeroUnit, canLevelUp } from '../game/rpg/heroUnit';
import {
  createWaveEnemies,
  createRPGEnemy,
  isWaveCleared,
  getWaveBreakDuration,
} from '../game/rpg/waveSystem';
import { addExperience, getSkillUnlockedAtLevel } from '../game/rpg/expSystem';
import {
  executeDash,
  executeSpin,
  executeHeal,
  updateSkillCooldowns,
  executeQSkill,
  executeWSkill,
  executeESkill,
} from '../game/rpg/skillSystem';
import {
  updateAllEnemiesAI,
  calculateDamageAfterReduction,
  applyStunToEnemy,
} from '../game/rpg/enemyAI';
import { effectManager } from '../effects';
import { soundManager } from '../services/SoundManager';
import { SkillType, PendingSkill } from '../types/rpg';
import { distance } from '../utils/math';

export function useRPGGameLoop() {
  const lastTimeRef = useRef<number>(0);
  const animationIdRef = useRef<number>(0);
  const waveBreakTimerRef = useRef<number>(0);
  const pendingSkillRef = useRef<SkillType | null>(null);

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

    // 보류된 스킬 처리
    if (pendingSkillRef.current) {
      const skillType = pendingSkillRef.current;
      pendingSkillRef.current = null;
      handleSkillExecution(skillType, state.gameTime);
    }

    // 영웅 업데이트
    const heroResult = updateHeroUnit(state.hero, deltaTime, state.enemies);
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
          // 경험치 획득
          useRPGStore.getState().addExp(enemy.expReward);
          useRPGStore.getState().addExpGained(enemy.expReward);
          useRPGStore.getState().incrementKills();

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

    // 영웅 위치 업데이트
    useRPGStore.getState().updateHeroPosition(updatedHero.x, updatedHero.y);

    // 카메라 영웅 추적
    if (state.camera.followHero) {
      useRPGStore.getState().setCamera(updatedHero.x, updatedHero.y);
    }

    // 레벨업 체크
    const currentHero = useRPGStore.getState().hero;
    if (currentHero && canLevelUp(currentHero)) {
      useRPGStore.getState().levelUp();
      const newHero = useRPGStore.getState().hero;
      if (newHero) {
        // 레벨업 알림
        const showNotification = useUIStore.getState().showNotification;
        showNotification(`레벨 ${newHero.level} 달성!`);

        // 스킬 해금 체크
        const unlockedSkill = getSkillUnlockedAtLevel(newHero.level);
        if (unlockedSkill) {
          showNotification(`새 스킬 해금: ${unlockedSkill}!`);
        }

        soundManager.play('heal'); // 레벨업 사운드
      }
    }

    // 버프 업데이트
    useRPGStore.getState().updateBuffs(deltaTime);

    // 시야 업데이트
    useRPGStore.getState().updateVisibility();

    // 적 AI 업데이트
    const currentHeroState = useRPGStore.getState().hero;
    if (currentHeroState) {
      const { updatedEnemies, totalHeroDamage: rawDamage } = updateAllEnemiesAI(
        state.enemies,
        currentHeroState,
        deltaTime,
        state.gameTime
      );

      // 영웅 데미지 적용 (데미지 감소 버프 적용)
      if (rawDamage > 0) {
        const finalDamage = calculateDamageAfterReduction(rawDamage, currentHeroState);
        useRPGStore.getState().damageHero(finalDamage);
        effectManager.createEffect('attack_melee', updatedHero.x, updatedHero.y);
        soundManager.play('attack_melee');

        // 게임 오버 체크
        const heroAfterDamage = useRPGStore.getState().hero;
        if (!heroAfterDamage || heroAfterDamage.hp <= 0) {
          useRPGStore.getState().setGameOver(false);
          useUIStore.getState().setScreen('gameover');
          soundManager.play('defeat');
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
            useRPGStore.getState().damageEnemy(enemy.id, skill.damage);
          }
        }

        // 폭발 이펙트
        effectManager.createEffect('attack_melee', skill.position.x, skill.position.y);
        soundManager.play('attack_melee');
      }
    });

    // 발동된 보류 스킬 제거 (역순)
    for (let i = triggeredSkills.length - 1; i >= 0; i--) {
      useRPGStore.getState().removePendingSkill(triggeredSkills[i]);
    }

    // 스폰 큐 처리
    const currentState = useRPGStore.getState();
    if (currentState.waveInProgress && currentState.spawnQueue.length > 0) {
      const timeSinceWaveStart = currentState.gameTime - currentState.waveStartTime;

      // 스폰 가능한 적 확인
      const readyToSpawn = currentState.spawnQueue.filter(
        (spawn) => spawn.delay <= timeSinceWaveStart
      );

      for (const spawn of readyToSpawn) {
        const enemy = createRPGEnemy(spawn.type, currentState.currentWave);
        useRPGStore.getState().addEnemy(enemy);
      }

      // 스폰된 적 제거
      if (readyToSpawn.length > 0) {
        const remainingQueue = currentState.spawnQueue.filter(
          (spawn) => spawn.delay > timeSinceWaveStart
        );
        // 직접 상태 업데이트
        useRPGStore.setState({ spawnQueue: remainingQueue });
      }
    }

    // 웨이브 클리어 체크
    const latestState = useRPGStore.getState();
    if (
      latestState.waveInProgress &&
      isWaveCleared(latestState.enemies, latestState.spawnQueue.length === 0)
    ) {
      useRPGStore.getState().endWave();
      soundManager.play('victory');

      // 웨이브 클리어 알림
      const showNotification = useUIStore.getState().showNotification;
      showNotification(`웨이브 ${latestState.currentWave} 클리어!`);

      // 휴식 시간 설정
      waveBreakTimerRef.current = getWaveBreakDuration(latestState.currentWave);
    }

    // 웨이브 휴식 타이머
    if (!latestState.waveInProgress && waveBreakTimerRef.current > 0) {
      waveBreakTimerRef.current -= deltaTime;

      if (waveBreakTimerRef.current <= 0) {
        // 다음 웨이브 시작
        const nextWave = latestState.currentWave + 1;
        useRPGStore.getState().startWave(nextWave);

        // 웨이브 스폰 큐 설정
        const waveEnemies = createWaveEnemies(nextWave);
        for (const enemy of waveEnemies) {
          useRPGStore.getState().addToSpawnQueue(enemy.type, enemy.delay);
        }

        // 웨이브 시작 알림
        const showNotification = useUIStore.getState().showNotification;
        if (nextWave % 10 === 0) {
          showNotification(`⚠️ 보스 웨이브 ${nextWave} 시작!`);
          soundManager.play('boss_spawn');
        } else {
          showNotification(`웨이브 ${nextWave} 시작!`);
          soundManager.play('warning');
        }
      }
    }

    // 첫 웨이브 시작 (게임 시작 직후)
    if (latestState.currentWave === 0 && !latestState.waveInProgress) {
      useRPGStore.getState().startWave(1);
      const waveEnemies = createWaveEnemies(1);
      for (const enemy of waveEnemies) {
        useRPGStore.getState().addToSpawnQueue(enemy.type, enemy.delay);
      }

      const showNotification = useUIStore.getState().showNotification;
      showNotification('웨이브 1 시작!');
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
            useRPGStore.getState().addExp(enemy.expReward);
            useRPGStore.getState().addExpGained(enemy.expReward);
            useRPGStore.getState().incrementKills();
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
      if (result.stunTargets) {
        const enemies = useRPGStore.getState().enemies;
        const updatedEnemies = enemies.map(enemy => {
          if (result.stunTargets!.includes(enemy.id)) {
            return applyStunToEnemy(enemy, 1.0, state.gameTime);
          }
          return enemy;
        });
        useRPGStore.getState().updateEnemies(updatedEnemies);
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
      const targetX = state.hero.targetPosition?.x || state.hero.x + 100;
      const targetY = state.hero.targetPosition?.y || state.hero.y;

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
                useRPGStore.getState().addExp(enemy.expReward);
                useRPGStore.getState().addExpGained(enemy.expReward);
                useRPGStore.getState().incrementKills();
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
                useRPGStore.getState().addExp(enemy.expReward);
                useRPGStore.getState().addExpGained(enemy.expReward);
                useRPGStore.getState().incrementKills();
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
    if (!skill || !skill.unlocked || skill.currentCooldown > 0) {
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
      waveBreakTimerRef.current = 0;
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
