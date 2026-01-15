import { useRef, useCallback, useEffect } from 'react';
import { useGameStore } from '../stores/useGameStore';
import { useUIStore } from '../stores/useUIStore';
import { CONFIG } from '../constants/config';
import { updateCombatUnit } from '../game/units/combatUnit';
import { updateSupportUnit } from '../game/units/supportUnit';
import { makeAIDecision } from '../game/ai/aiController';
import { Unit } from '../types';

export const useGameLoop = () => {
  const lastTimeRef = useRef<number>(0);
  const animationIdRef = useRef<number>(0);
  const aiTimerRef = useRef<number>(0);

  const running = useGameStore((state) => state.running);
  const updateTime = useGameStore((state) => state.updateTime);
  const addGold = useGameStore((state) => state.addGold);
  const addResource = useGameStore((state) => state.addResource);
  const updateUnits = useGameStore((state) => state.updateUnits);
  const updateResourceNode = useGameStore((state) => state.updateResourceNode);
  const damageBase = useGameStore((state) => state.damageBase);
  const spawnUnit = useGameStore((state) => state.spawnUnit);
  const checkGameEnd = useGameStore((state) => state.checkGameEnd);
  const stopGame = useGameStore((state) => state.stopGame);
  const setScreen = useUIStore((state) => state.setScreen);

  const tick = useCallback(
    (timestamp: number) => {
      const state = useGameStore.getState();
      if (!state.running) return;

      const deltaTime = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = timestamp;

      // 시간 업데이트
      updateTime(deltaTime);

      // 골드 자동 획득
      addGold(CONFIG.GOLD_PER_SECOND * deltaTime, 'player');
      addGold(CONFIG.GOLD_PER_SECOND * deltaTime, 'enemy');

      // 유닛 업데이트
      const updatedPlayerUnits: Unit[] = [];
      const updatedEnemyUnits: Unit[] = [];

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
        } else {
          const result = updateSupportUnit(unit, deltaTime, state.resourceNodes);
          updatedPlayerUnits.push(result.unit);

          if (result.resourceGathered) {
            addResource(result.resourceGathered.type, result.resourceGathered.amount, 'player');
            const node = state.resourceNodes.find(
              (n) => n.id === result.resourceGathered!.nodeId
            );
            if (node) {
              updateResourceNode(node.id, node.amount - result.resourceGathered.amount);
            }
          }
          if (result.crystalFound) {
            addResource('crystal', 1, 'player');
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
            playerUnitsCopy
          );
          updatedEnemyUnits.push(result.unit);

          if (result.baseDamage) {
            damageBase(result.baseDamage.team, result.baseDamage.damage);
          }
        } else {
          const result = updateSupportUnit(unit, deltaTime, state.resourceNodes);
          updatedEnemyUnits.push(result.unit);

          if (result.resourceGathered) {
            addResource(result.resourceGathered.type, result.resourceGathered.amount, 'enemy');
            const node = state.resourceNodes.find(
              (n) => n.id === result.resourceGathered!.nodeId
            );
            if (node) {
              updateResourceNode(node.id, node.amount - result.resourceGathered.amount);
            }
          }
        }
      }

      // 죽은 유닛 제거
      const alivePlayerUnits = updatedPlayerUnits.filter((u) => u.hp > 0);
      const aliveEnemyUnits = updatedEnemyUnits.filter((u) => u.hp > 0);

      updateUnits(alivePlayerUnits, aliveEnemyUnits);

      // AI 업데이트 (5초마다)
      aiTimerRef.current += deltaTime;
      if (aiTimerRef.current >= 5) {
        aiTimerRef.current = 0;
        const currentState = useGameStore.getState();
        const decision = makeAIDecision(
          currentState.aiResources,
          currentState.enemyUnits
        );

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
      spawnUnit,
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
