import { useRef, useCallback, useEffect } from 'react';
import { useGameStore } from '../stores/useGameStore';
import { useUIStore } from '../stores/useUIStore';
import { CONFIG, AI_DIFFICULTY_CONFIG } from '../constants/config';
import { updateCombatUnit } from '../game/units/combatUnit';
import { updateSupportUnit } from '../game/units/supportUnit';
import { makeAIDecision } from '../game/ai/aiController';
import { Unit } from '../types';

export const useGameLoop = () => {
  const lastTimeRef = useRef<number>(0);
  const animationIdRef = useRef<number>(0);
  const aiTimerRef = useRef<number>(0);

  const running = useGameStore((state) => state.running);
  const gameMode = useGameStore((state) => state.gameMode);
  const difficulty = useUIStore((state) => state.selectedDifficulty);
  const updateTime = useGameStore((state) => state.updateTime);
  const addGold = useGameStore((state) => state.addGold);
  const addResource = useGameStore((state) => state.addResource);
  const updateUnits = useGameStore((state) => state.updateUnits);
  const updateResourceNode = useGameStore((state) => state.updateResourceNode);
  const damageBase = useGameStore((state) => state.damageBase);
  const damageWall = useGameStore((state) => state.damageWall);
  const spawnUnit = useGameStore((state) => state.spawnUnit);
  const aiSellHerb = useGameStore((state) => state.aiSellHerb);
  const checkGameEnd = useGameStore((state) => state.checkGameEnd);
  const stopGame = useGameStore((state) => state.stopGame);
  const setScreen = useUIStore((state) => state.setScreen);

  const tick = useCallback(
    (timestamp: number) => {
      const state = useGameStore.getState();
      if (!state.running) return;

      // 멀티플레이어 모드에서는 로컬 게임 루프를 실행하지 않음
      // 서버에서 게임 상태를 받아서 렌더링만 함
      if (state.gameMode === 'multiplayer') {
        animationIdRef.current = requestAnimationFrame(tick);
        return;
      }

      const deltaTime = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = timestamp;

      // 시간 업데이트
      updateTime(deltaTime);

      // 골드 자동 획득 (AI는 난이도별 골드 수입)
      const difficultyConfig = AI_DIFFICULTY_CONFIG[difficulty];
      addGold(CONFIG.GOLD_PER_SECOND * deltaTime, 'player');
      addGold(difficultyConfig.goldPerSecond * deltaTime, 'enemy');

      // 유닛 업데이트
      const updatedPlayerUnits: Unit[] = [];
      const updatedEnemyUnits: Unit[] = [];

      // 데미지 기록 (나중에 적용) - damage와 attackerId 포함
      const damageToEnemyUnits: Map<string, { damage: number; attackerId: string }> = new Map();
      const damageToPlayerUnits: Map<string, { damage: number; attackerId: string }> = new Map();

      // 자원 채집량 누적 (여러 유닛이 같은 노드에서 채집할 때)
      const nodeGatheredAmounts: Map<string, number> = new Map();

      // 복사본 생성 (상호 참조 문제 방지)
      const playerUnitsCopy = [...state.units];
      const enemyUnitsCopy = [...state.enemyUnits];

      // 플레이어 유닛 업데이트
      for (const unit of playerUnitsCopy) {
        if (unit.hp <= 0) continue;

        if (unit.config.type === 'combat') {
          const result = updateCombatUnit(
            unit,
            deltaTime,
            state.enemyBase,
            enemyUnitsCopy
          );
          updatedPlayerUnits.push(result.unit);

          if (result.baseDamage) {
            damageBase(result.baseDamage.team, result.baseDamage.damage);
          }
          if (result.unitDamage) {
            const prev = damageToEnemyUnits.get(result.unitDamage.targetId);
            const newDamage = (prev?.damage || 0) + result.unitDamage.damage;
            damageToEnemyUnits.set(result.unitDamage.targetId, {
              damage: newDamage,
              attackerId: result.unitDamage.attackerId
            });
          }
        } else {
          const result = updateSupportUnit(unit, deltaTime, state.resourceNodes, enemyUnitsCopy);
          updatedPlayerUnits.push(result.unit);

          if (result.resourceGathered) {
            addResource(result.resourceGathered.type, result.resourceGathered.amount, 'player');
            // 채집량 누적
            const prevAmount = nodeGatheredAmounts.get(result.resourceGathered.nodeId) || 0;
            nodeGatheredAmounts.set(result.resourceGathered.nodeId, prevAmount + result.resourceGathered.amount);
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

        if (unit.config.type === 'combat') {
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
          }
          if (result.unitDamage) {
            const prev = damageToPlayerUnits.get(result.unitDamage.targetId);
            const newDamage = (prev?.damage || 0) + result.unitDamage.damage;
            damageToPlayerUnits.set(result.unitDamage.targetId, {
              damage: newDamage,
              attackerId: result.unitDamage.attackerId
            });
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

      // 데미지 적용 (damage와 attackerId 함께)
      for (const unit of updatedPlayerUnits) {
        const damageInfo = damageToPlayerUnits.get(unit.id);
        if (damageInfo) {
          unit.hp -= damageInfo.damage;
          unit.attackerId = damageInfo.attackerId;
        }
      }
      for (const unit of updatedEnemyUnits) {
        const damageInfo = damageToEnemyUnits.get(unit.id);
        if (damageInfo) {
          unit.hp -= damageInfo.damage;
          unit.attackerId = damageInfo.attackerId;
        }
      }

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

      // AI 업데이트 (난이도별 행동 주기)
      aiTimerRef.current += deltaTime;
      if (aiTimerRef.current >= difficultyConfig.actionInterval) {
        aiTimerRef.current = 0;
        const currentState = useGameStore.getState();
        const decision = makeAIDecision(
          currentState.aiResources,
          currentState.enemyUnits,
          difficultyConfig
        );

        // AI 약초 판매
        if (decision.sellHerb) {
          aiSellHerb();
        }

        if (decision.spawnUnit) {
          spawnUnit(decision.spawnUnit, 'enemy');
        }
      }

      // 게임 종료 확인
      const gameEnd = checkGameEnd();
      if (gameEnd) {
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
      damageBase,
      damageWall,
      spawnUnit,
      aiSellHerb,
      checkGameEnd,
      stopGame,
      setScreen,
    ]
  );

  useEffect(() => {
    if (running) {
      lastTimeRef.current = performance.now();
      aiTimerRef.current = 0;
      animationIdRef.current = requestAnimationFrame(tick);
    }

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    };
  }, [running, tick]);
};
