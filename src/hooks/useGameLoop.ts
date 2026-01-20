import { useRef, useCallback, useEffect } from 'react';
import { useGameStore } from '../stores/useGameStore';
import { useUIStore } from '../stores/useUIStore';
import { CONFIG, AI_DIFFICULTY_CONFIG } from '../constants/config';
import { updateCombatUnit } from '../game/units/combatUnit';
import { updateSupportUnit } from '../game/units/supportUnit';
import { updateHealerUnit } from '../game/units/healerUnit';
import { updateMageUnit } from '../game/units/mageUnit';
import { makeAIDecision } from '../game/ai/aiController';
import { Unit } from '../types';
import { EffectType } from '../types/effect';
import { effectManager } from '../effects';
import { soundManager } from '../services/SoundManager';

export const useGameLoop = () => {
  const lastTimeRef = useRef<number>(0);
  const animationIdRef = useRef<number>(0);
  const aiTimerRef = useRef<number>(0);
  const lastMassSpawnTimeRef = useRef<number>(-1); // 마지막 대량 발생 시간 (-1: 아직 없음)

  const running = useGameStore((state) => state.running);
  const gameMode = useGameStore((state) => state.gameMode);
  const difficulty = useUIStore((state) => state.selectedDifficulty);
  const updateTime = useGameStore((state) => state.updateTime);
  const addGold = useGameStore((state) => state.addGold);
  const addResource = useGameStore((state) => state.addResource);
  const updateUnits = useGameStore((state) => state.updateUnits);
  const updateResourceNode = useGameStore((state) => state.updateResourceNode);
  const respawnResourceNodes = useGameStore((state) => state.respawnResourceNodes);
  const damageBase = useGameStore((state) => state.damageBase);
  const damageWall = useGameStore((state) => state.damageWall);
  const removeExpiredWalls = useGameStore((state) => state.removeExpiredWalls);
  const spawnUnit = useGameStore((state) => state.spawnUnit);
  const aiSellHerb = useGameStore((state) => state.aiSellHerb);
  const updateSpawnCooldowns = useGameStore((state) => state.updateSpawnCooldowns);
  const checkGameEnd = useGameStore((state) => state.checkGameEnd);
  const stopGame = useGameStore((state) => state.stopGame);
  const setScreen = useUIStore((state) => state.setScreen);
  const startPhase2 = useGameStore((state) => state.startPhase2);
  const spawnBoss = useGameStore((state) => state.spawnBoss);

  const tick = useCallback(
    (timestamp: number) => {
      const state = useGameStore.getState();
      if (!state.running) return;

      // 멀티플레이어 모드에서는 서버에서 게임 상태를 받아서 렌더링만 함
      // 단, 이펙트는 클라이언트에서 업데이트해야 함
      if (state.gameMode === 'multiplayer') {
        const deltaTime = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1);
        lastTimeRef.current = timestamp;

        // 이펙트 업데이트 (파티클 애니메이션)
        effectManager.update(deltaTime);

        animationIdRef.current = requestAnimationFrame(tick);
        return;
      }

      const deltaTime = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = timestamp;

      // 시간 업데이트
      updateTime(deltaTime);

      // 소환 쿨타임 업데이트
      updateSpawnCooldowns(deltaTime);

      // 만료된 벽 제거
      removeExpiredWalls();

      // 골드 자동 획득 (플레이어는 업그레이드 레벨에 따라, AI는 난이도별 골드 수입)
      const difficultyConfig = AI_DIFFICULTY_CONFIG[difficulty];
      addGold(state.playerGoldPerSecond * deltaTime, 'player');
      addGold(difficultyConfig.goldPerSecond * deltaTime, 'enemy');

      // 유닛 업데이트
      const updatedPlayerUnits: Unit[] = [];
      const updatedEnemyUnits: Unit[] = [];

      // 데미지 기록 (나중에 적용) - damage와 attackerId 포함
      const damageToEnemyUnits: Map<string, { damage: number; attackerId: string }> = new Map();
      const damageToPlayerUnits: Map<string, { damage: number; attackerId: string }> = new Map();

      // 회복량 기록 (나중에 적용)
      const healToPlayerUnits: Map<string, number> = new Map();
      const healToEnemyUnits: Map<string, number> = new Map();

      // 자원 채집량 누적 (여러 유닛이 같은 노드에서 채집할 때)
      const nodeGatheredAmounts: Map<string, number> = new Map();

      // 이펙트 정보 기록 (나중에 생성)
      const effectsToCreate: { type: EffectType; x: number; y: number; targetX?: number; targetY?: number; unitId?: string; isPlayer?: boolean }[] = [];

      // 복사본 생성 (상호 참조 문제 방지)
      const playerUnitsCopy = [...state.units];
      const enemyUnitsCopy = [...state.enemyUnits];

      // 플레이어 유닛 업데이트
      for (const unit of playerUnitsCopy) {
        if (unit.hp <= 0) continue;

        // 힐러 유닛 처리
        if (unit.type === 'healer') {
          const result = updateHealerUnit(
            unit,
            deltaTime,
            playerUnitsCopy,
            enemyUnitsCopy,
            state.playerBase
          );
          updatedPlayerUnits.push(result.unit);

          if (result.healTargets) {
            for (const heal of result.healTargets) {
              const prevHeal = healToPlayerUnits.get(heal.targetId) || 0;
              healToPlayerUnits.set(heal.targetId, prevHeal + heal.healAmount);
              // 힐 이펙트 위치 기록
              const healTarget = playerUnitsCopy.find(u => u.id === heal.targetId);
              if (healTarget) {
                effectsToCreate.push({ type: 'heal', x: healTarget.x, y: healTarget.y, isPlayer: true });
              }
            }
          }
          if (result.unitDamage) {
            const prev = damageToEnemyUnits.get(result.unitDamage.targetId);
            const newDamage = (prev?.damage || 0) + result.unitDamage.damage;
            damageToEnemyUnits.set(result.unitDamage.targetId, {
              damage: newDamage,
              attackerId: result.unitDamage.attackerId
            });
          }
        }
        // 마법사 유닛 처리
        else if (unit.type === 'mage') {
          const result = updateMageUnit(
            unit,
            deltaTime,
            state.enemyBase,
            enemyUnitsCopy
          );
          updatedPlayerUnits.push(result.unit);

          if (result.baseDamage) {
            damageBase(result.baseDamage.team, result.baseDamage.damage);
            // 마법 공격 이펙트 (본진 공격)
            effectsToCreate.push({ type: 'attack_mage', x: state.enemyBase.x, y: state.enemyBase.y, isPlayer: true });
          }
          if (result.aoeDamage && result.aoeDamage.length > 0) {
            // 첫 번째 타겟 위치에 AOE 마법 이펙트
            const firstTarget = enemyUnitsCopy.find(u => u.id === result.aoeDamage![0].targetId);
            if (firstTarget) {
              effectsToCreate.push({ type: 'attack_mage', x: firstTarget.x, y: firstTarget.y, isPlayer: true });
            }
            for (const dmg of result.aoeDamage) {
              const prev = damageToEnemyUnits.get(dmg.targetId);
              const newDamage = (prev?.damage || 0) + dmg.damage;
              damageToEnemyUnits.set(dmg.targetId, {
                damage: newDamage,
                attackerId: dmg.attackerId
              });
            }
          }
        }
        // 일반 전투 유닛 처리
        else if (unit.config.type === 'combat') {
          const result = updateCombatUnit(
            unit,
            deltaTime,
            state.enemyBase,
            enemyUnitsCopy
          );
          updatedPlayerUnits.push(result.unit);

          if (result.baseDamage) {
            damageBase(result.baseDamage.team, result.baseDamage.damage);
            // 근접/원거리 공격 이펙트 (본진 공격)
            const effectType: EffectType = unit.type === 'ranged' ? 'attack_ranged' : 'attack_melee';
            effectsToCreate.push({ type: effectType, x: state.enemyBase.x, y: state.enemyBase.y, targetX: state.enemyBase.x, targetY: state.enemyBase.y, isPlayer: true });
          }
          if (result.unitDamage) {
            const prev = damageToEnemyUnits.get(result.unitDamage.targetId);
            const newDamage = (prev?.damage || 0) + result.unitDamage.damage;
            damageToEnemyUnits.set(result.unitDamage.targetId, {
              damage: newDamage,
              attackerId: result.unitDamage.attackerId
            });
            // 근접/원거리 공격 이펙트
            const target = enemyUnitsCopy.find(u => u.id === result.unitDamage!.targetId);
            if (target) {
              const effectType: EffectType = unit.type === 'ranged' ? 'attack_ranged' : 'attack_melee';
              effectsToCreate.push({ type: effectType, x: target.x, y: target.y, targetX: target.x, targetY: target.y, isPlayer: true });
            }
          }
        } else {
          const result = updateSupportUnit(unit, deltaTime, state.resourceNodes, enemyUnitsCopy);
          updatedPlayerUnits.push(result.unit);

          if (result.resourceGathered) {
            addResource(result.resourceGathered.type, result.resourceGathered.amount, 'player');
            // 채집량 누적
            const prevAmount = nodeGatheredAmounts.get(result.resourceGathered.nodeId) || 0;
            nodeGatheredAmounts.set(result.resourceGathered.nodeId, prevAmount + result.resourceGathered.amount);
            // 채집 이펙트 (유닛 타입에 따라)
            let gatherEffectType: EffectType;
            switch (unit.type) {
              case 'woodcutter': gatherEffectType = 'gather_wood'; break;
              case 'miner': gatherEffectType = 'gather_stone'; break;
              case 'gatherer': gatherEffectType = 'gather_herb'; break;
              case 'goldminer': gatherEffectType = 'gather_gold'; break;
              default: gatherEffectType = 'gather_wood';
            }
            effectsToCreate.push({ type: gatherEffectType, x: unit.x, y: unit.y, unitId: unit.id, isPlayer: true });
          }
          if (result.crystalFound) {
            addResource('crystal', 1, 'player');
          }
          if (result.unitDamage) {
            const prev = damageToEnemyUnits.get(result.unitDamage.targetId);
            const newDamage = (prev?.damage || 0) + result.unitDamage.damage;
            damageToEnemyUnits.set(result.unitDamage.targetId, {
              damage: newDamage,
              attackerId: result.unitDamage.attackerId
            });
          }
        }
      }

      // 적 유닛 업데이트
      for (const unit of enemyUnitsCopy) {
        if (unit.hp <= 0) continue;

        // 힐러 유닛 처리
        if (unit.type === 'healer') {
          const result = updateHealerUnit(
            unit,
            deltaTime,
            enemyUnitsCopy,
            playerUnitsCopy,
            state.enemyBase
          );
          updatedEnemyUnits.push(result.unit);

          if (result.healTargets) {
            for (const heal of result.healTargets) {
              const prevHeal = healToEnemyUnits.get(heal.targetId) || 0;
              healToEnemyUnits.set(heal.targetId, prevHeal + heal.healAmount);
              // 힐 이펙트 위치 기록
              const healTarget = enemyUnitsCopy.find(u => u.id === heal.targetId);
              if (healTarget) {
                effectsToCreate.push({ type: 'heal', x: healTarget.x, y: healTarget.y });
              }
            }
          }
          if (result.unitDamage) {
            const prev = damageToPlayerUnits.get(result.unitDamage.targetId);
            const newDamage = (prev?.damage || 0) + result.unitDamage.damage;
            damageToPlayerUnits.set(result.unitDamage.targetId, {
              damage: newDamage,
              attackerId: result.unitDamage.attackerId
            });
          }
        }
        // 마법사 유닛 처리
        else if (unit.type === 'mage') {
          const result = updateMageUnit(
            unit,
            deltaTime,
            state.playerBase,
            playerUnitsCopy,
            state.walls
          );
          updatedEnemyUnits.push(result.unit);

          if (result.baseDamage) {
            damageBase(result.baseDamage.team, result.baseDamage.damage);
            // 마법 공격 이펙트 (본진 공격)
            effectsToCreate.push({ type: 'attack_mage', x: state.playerBase.x, y: state.playerBase.y });
          }
          if (result.aoeDamage && result.aoeDamage.length > 0) {
            // 첫 번째 타겟 위치에 AOE 마법 이펙트
            const firstTarget = playerUnitsCopy.find(u => u.id === result.aoeDamage![0].targetId);
            if (firstTarget) {
              effectsToCreate.push({ type: 'attack_mage', x: firstTarget.x, y: firstTarget.y });
            }
            for (const dmg of result.aoeDamage) {
              const prev = damageToPlayerUnits.get(dmg.targetId);
              const newDamage = (prev?.damage || 0) + dmg.damage;
              damageToPlayerUnits.set(dmg.targetId, {
                damage: newDamage,
                attackerId: dmg.attackerId
              });
            }
          }
          if (result.wallDamage) {
            damageWall(result.wallDamage.wallId, result.wallDamage.damage);
          }
        }
        // 보스 유닛 처리 (AOE 공격 + 일반 전투)
        else if (unit.type === 'boss') {
          const result = updateMageUnit(
            unit,
            deltaTime,
            state.playerBase,
            playerUnitsCopy,
            state.walls
          );
          updatedEnemyUnits.push(result.unit);

          if (result.baseDamage) {
            damageBase(result.baseDamage.team, result.baseDamage.damage);
            effectsToCreate.push({ type: 'attack_mage', x: state.playerBase.x, y: state.playerBase.y });
          }
          if (result.aoeDamage && result.aoeDamage.length > 0) {
            const firstTarget = playerUnitsCopy.find(u => u.id === result.aoeDamage![0].targetId);
            if (firstTarget) {
              effectsToCreate.push({ type: 'attack_mage', x: firstTarget.x, y: firstTarget.y });
            }
            for (const dmg of result.aoeDamage) {
              const prev = damageToPlayerUnits.get(dmg.targetId);
              const newDamage = (prev?.damage || 0) + dmg.damage;
              damageToPlayerUnits.set(dmg.targetId, {
                damage: newDamage,
                attackerId: dmg.attackerId
              });
            }
          }
          if (result.wallDamage) {
            damageWall(result.wallDamage.wallId, result.wallDamage.damage);
          }
        }
        // 일반 전투 유닛 처리
        else if (unit.config.type === 'combat') {
          const result = updateCombatUnit(
            unit,
            deltaTime,
            state.playerBase,
            playerUnitsCopy,
            state.walls
          );
          updatedEnemyUnits.push(result.unit);

          if (result.baseDamage) {
            damageBase(result.baseDamage.team, result.baseDamage.damage);
            // 근접/원거리 공격 이펙트 (본진 공격)
            const effectType: EffectType = unit.type === 'ranged' ? 'attack_ranged' : 'attack_melee';
            effectsToCreate.push({ type: effectType, x: state.playerBase.x, y: state.playerBase.y, targetX: state.playerBase.x, targetY: state.playerBase.y });
          }
          if (result.unitDamage) {
            const prev = damageToPlayerUnits.get(result.unitDamage.targetId);
            const newDamage = (prev?.damage || 0) + result.unitDamage.damage;
            damageToPlayerUnits.set(result.unitDamage.targetId, {
              damage: newDamage,
              attackerId: result.unitDamage.attackerId
            });
            // 근접/원거리 공격 이펙트
            const target = playerUnitsCopy.find(u => u.id === result.unitDamage!.targetId);
            if (target) {
              const effectType: EffectType = unit.type === 'ranged' ? 'attack_ranged' : 'attack_melee';
              effectsToCreate.push({ type: effectType, x: target.x, y: target.y, targetX: target.x, targetY: target.y });
            }
          }
          if (result.wallDamage) {
            damageWall(result.wallDamage.wallId, result.wallDamage.damage);
          }
        } else {
          const result = updateSupportUnit(unit, deltaTime, state.resourceNodes, playerUnitsCopy);
          updatedEnemyUnits.push(result.unit);

          if (result.resourceGathered) {
            addResource(result.resourceGathered.type, result.resourceGathered.amount, 'enemy');
            // 채집량 누적
            const prevAmount = nodeGatheredAmounts.get(result.resourceGathered.nodeId) || 0;
            nodeGatheredAmounts.set(result.resourceGathered.nodeId, prevAmount + result.resourceGathered.amount);
            // 채집 이펙트 (유닛 타입에 따라)
            let gatherEffectType: EffectType;
            switch (unit.type) {
              case 'woodcutter': gatherEffectType = 'gather_wood'; break;
              case 'miner': gatherEffectType = 'gather_stone'; break;
              case 'gatherer': gatherEffectType = 'gather_herb'; break;
              case 'goldminer': gatherEffectType = 'gather_gold'; break;
              default: gatherEffectType = 'gather_wood';
            }
            effectsToCreate.push({ type: gatherEffectType, x: unit.x, y: unit.y, unitId: unit.id });
          }
          if (result.unitDamage) {
            const prev = damageToPlayerUnits.get(result.unitDamage.targetId);
            const newDamage = (prev?.damage || 0) + result.unitDamage.damage;
            damageToPlayerUnits.set(result.unitDamage.targetId, {
              damage: newDamage,
              attackerId: result.unitDamage.attackerId
            });
          }
        }
      }

      // 데미지 및 회복 적용 (damage와 attackerId 함께)
      for (const unit of updatedPlayerUnits) {
        const damageInfo = damageToPlayerUnits.get(unit.id);
        if (damageInfo) {
          unit.hp -= damageInfo.damage;
          unit.attackerId = damageInfo.attackerId;
        }
        // 회복량 적용
        const healAmount = healToPlayerUnits.get(unit.id);
        if (healAmount) {
          unit.hp = Math.min(unit.maxHp, unit.hp + healAmount);
        }
      }
      for (const unit of updatedEnemyUnits) {
        const damageInfo = damageToEnemyUnits.get(unit.id);
        if (damageInfo) {
          unit.hp -= damageInfo.damage;
          unit.attackerId = damageInfo.attackerId;
        }
        // 회복량 적용
        const healAmount = healToEnemyUnits.get(unit.id);
        if (healAmount) {
          unit.hp = Math.min(unit.maxHp, unit.hp + healAmount);
        }
      }

      // 이펙트 생성 및 사운드 재생 (플레이어 이펙트만 사운드 재생)
      for (const effect of effectsToCreate) {
        if (effect.unitId) {
          // 채집 이펙트는 쿨타임 적용
          const created = effectManager.createGatherEffect(effect.type, effect.x, effect.y, effect.unitId);
          if (created && effect.isPlayer) {
            soundManager.play('resource_collect');
          }
        } else {
          effectManager.createEffect(effect.type, effect.x, effect.y, effect.targetX, effect.targetY);
          // 이펙트 타입에 따른 사운드 매핑 (플레이어만)
          if (effect.isPlayer) {
            if (effect.type === 'attack_melee') {
              soundManager.play('attack_melee');
            } else if (effect.type === 'attack_ranged') {
              soundManager.play('attack_ranged');
            } else if (effect.type === 'attack_mage') {
              soundManager.play('attack_mage');
            } else if (effect.type === 'heal') {
              soundManager.play('heal');
            }
          }
        }
      }

      // 이펙트 업데이트
      effectManager.update(deltaTime);

      // 죽은 유닛 제거
      const alivePlayerUnits = updatedPlayerUnits.filter((u) => u.hp > 0);
      const aliveEnemyUnits = updatedEnemyUnits.filter((u) => u.hp > 0);

      updateUnits(alivePlayerUnits, aliveEnemyUnits);

      // 자원 노드 업데이트 (누적된 채집량 적용)
      for (const [nodeId, gatheredAmount] of nodeGatheredAmounts) {
        const node = state.resourceNodes.find((n) => n.id === nodeId);
        if (node) {
          updateResourceNode(nodeId, node.amount - gatheredAmount);
        }
      }

      // 자원 노드 재생성 확인
      respawnResourceNodes();

      // 대량 발생 이벤트 체크
      if (difficultyConfig.massSpawnEnabled) {
        const elapsedTime = CONFIG.GAME_TIME - state.time; // 경과 시간 (초)
        const startTime = difficultyConfig.massSpawnStartTime;
        const interval = difficultyConfig.massSpawnInterval;

        // 첫 대량 발생 체크
        if (elapsedTime >= startTime) {
          let shouldSpawn = false;

          if (interval === 0) {
            // 1회성 대량 발생
            if (lastMassSpawnTimeRef.current < startTime) {
              shouldSpawn = true;
              lastMassSpawnTimeRef.current = startTime;
            }
          } else {
            // 반복 대량 발생 (2분마다)
            const expectedSpawnCount = Math.floor((elapsedTime - startTime) / interval) + 1;
            const actualSpawnCount = lastMassSpawnTimeRef.current < startTime
              ? 0
              : Math.floor((lastMassSpawnTimeRef.current - startTime) / interval) + 1;

            if (expectedSpawnCount > actualSpawnCount) {
              shouldSpawn = true;
              lastMassSpawnTimeRef.current = startTime + (expectedSpawnCount - 1) * interval;
            }
          }

          if (shouldSpawn) {
            // 대량 발생 알림 표시
            const showMassSpawnAlert = useUIStore.getState().showMassSpawnAlert;
            const hideMassSpawnAlert = useUIStore.getState().hideMassSpawnAlert;
            showMassSpawnAlert();
            soundManager.play('warning');
            setTimeout(() => hideMassSpawnAlert(), 3000); // 3초 후 알림 숨김

            // 대량 발생 유닛 소환 (자원과 무관하게 강제 소환)
            // 첫 번째 대량 발생에서는 마법사 제외 (어려움 난이도)
            const isFirstSpawn = interval > 0 && elapsedTime < startTime + interval;
            const unitsToSpawn = isFirstSpawn
              ? difficultyConfig.massSpawnUnits.filter(u => u !== 'mage')
              : difficultyConfig.massSpawnUnits;

            for (const unitType of unitsToSpawn) {
              spawnUnit(unitType, 'enemy', true); // forceSpawn = true
            }
          }
        }
      }

      // AI 업데이트 (난이도별 행동 주기) - 튜토리얼 모드에서는 AI 매우 느리게
      const isTutorial = state.gameMode === 'tutorial';
      const aiInterval = isTutorial ? 10 : difficultyConfig.actionInterval; // 튜토리얼: 10초마다

      aiTimerRef.current += deltaTime;
      if (aiTimerRef.current >= aiInterval) {
        aiTimerRef.current = 0;
        const currentState = useGameStore.getState();

        // 튜토리얼 모드에서는 간단한 AI만 실행 (검병만 소환)
        if (isTutorial) {
          if (currentState.aiResources.gold >= 30 && Math.random() < 0.3) {
            spawnUnit('melee', 'enemy');
          }
        } else {
          const decision = makeAIDecision(
            currentState.aiResources,
            currentState.enemyUnits,
            difficultyConfig
          );

          // AI 약초 판매
          if (decision.sellHerb) {
            aiSellHerb();
          }

          // 다중 유닛 소환 지원
          for (const unitType of decision.spawnUnits) {
            spawnUnit(unitType, 'enemy');
          }
        }
      }

      // 극악/보스테스트 난이도: 페이즈 2 전환 체크
      const currentState = useGameStore.getState();
      if ((difficulty === 'nightmare' || difficulty === 'bosstest') && currentState.phase === 1 && currentState.enemyBase.hp <= 0) {
        // 페이즈 2 시작 및 보스 소환
        startPhase2();
        spawnBoss();
        soundManager.play('boss_spawn');

        // 페이즈 2 알림 표시
        const showMassSpawnAlert = useUIStore.getState().showMassSpawnAlert;
        const hideMassSpawnAlert = useUIStore.getState().hideMassSpawnAlert;
        showMassSpawnAlert();
        setTimeout(() => hideMassSpawnAlert(), 3000);
      }

      // 게임 종료 확인
      const gameEnd = checkGameEnd();
      if (gameEnd) {
        soundManager.play(gameEnd === 'victory' ? 'victory' : 'defeat');
        stopGame();
        setScreen('gameover');
        return;
      }

      animationIdRef.current = requestAnimationFrame(tick);
    },
    [
      updateTime,
      addGold,
      addResource,
      updateUnits,
      updateResourceNode,
      respawnResourceNodes,
      damageBase,
      damageWall,
      removeExpiredWalls,
      spawnUnit,
      aiSellHerb,
      checkGameEnd,
      stopGame,
      setScreen,
      startPhase2,
      spawnBoss,
    ]
  );

  useEffect(() => {
    if (running) {
      lastTimeRef.current = performance.now();
      aiTimerRef.current = 0;
      lastMassSpawnTimeRef.current = -1; // 대량 발생 타이머 리셋
      animationIdRef.current = requestAnimationFrame(tick);
    }

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    };
  }, [running, tick]);
};
