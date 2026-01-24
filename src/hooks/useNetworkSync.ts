import { useCallback, useEffect, useRef } from 'react';
import { useRPGStore } from '../stores/useRPGStore';
import { useUIStore } from '../stores/useUIStore';
import { wsClient } from '../services/WebSocketClient';
import { CLASS_SKILLS } from '../constants/rpgConfig';
import {
  executeQSkill,
  executeWSkill,
  executeESkill,
} from '../game/rpg/skillSystem';
import { applyStunToEnemy } from '../game/rpg/enemyAI';
import { effectManager } from '../effects';
import { soundManager } from '../services/SoundManager';
import { distance } from '../utils/math';
import type { SerializedGameState, PlayerInput, HOST_BASED_CONFIG } from '../../shared/types/hostBasedNetwork';
import type { CoopServerMessage, CoopPlayerInfo } from '../../shared/types/rpgNetwork';
import type { HeroUnit, SkillType, Buff } from '../types/rpg';

// 버프 공유 범위 설정
const BERSERKER_SHARE_RANGE = 300; // 광전사 버프 공유 범위
const IRONWALL_SHARE_RANGE = Infinity; // 철벽 방어는 전체 아군에게 적용

const STATE_SYNC_INTERVAL = 50; // 50ms (20Hz)

/**
 * 호스트 기반 네트워크 동기화 훅
 * - 호스트: 게임 상태 브로드캐스트
 * - 클라이언트: 게임 상태 수신 및 적용
 */
export function useNetworkSync() {
  const lastBroadcastTimeRef = useRef<number>(0);
  const isSetupRef = useRef<boolean>(false);

  // 호스트: 게임 상태 브로드캐스트
  const broadcastGameState = useCallback(() => {
    const state = useRPGStore.getState();
    if (!state.multiplayer.isMultiplayer || !state.multiplayer.isHost) return;
    if (!state.running || state.paused) return;

    const now = performance.now();
    if (now - lastBroadcastTimeRef.current < STATE_SYNC_INTERVAL) return;
    lastBroadcastTimeRef.current = now;

    const serializedState = state.serializeGameState();
    wsClient.send({
      type: 'HOST_GAME_STATE_BROADCAST',
      state: serializedState,
    });
  }, []);

  // 호스트: 원격 입력 처리
  const processRemoteInputs = useCallback(() => {
    const state = useRPGStore.getState();
    if (!state.multiplayer.isMultiplayer || !state.multiplayer.isHost) return;

    // 큐에서 모든 입력 처리
    let input = state.popRemoteInput();
    while (input) {
      handleRemoteInput(input);
      input = state.popRemoteInput();
    }
  }, []);

  // 원격 입력 처리 (호스트에서)
  const handleRemoteInput = useCallback((input: PlayerInput) => {
    const state = useRPGStore.getState();
    const heroId = `hero_${input.playerId}`;
    const hero = state.otherHeroes.get(heroId);

    if (!hero) {
      console.warn(`[NetworkSync] 알 수 없는 영웅: ${heroId}`);
      return;
    }

    // 이동 방향 업데이트
    if (input.moveDirection !== undefined) {
      state.updateOtherHero(heroId, {
        moveDirection: input.moveDirection || undefined,
        state: input.moveDirection ? 'moving' : 'idle',
      });
    }

    // 스킬 사용
    if (input.skillUsed) {
      executeOtherHeroSkill(
        heroId,
        hero,
        input.skillUsed.skillSlot,
        input.skillUsed.targetX,
        input.skillUsed.targetY
      );
    }

    // 업그레이드 요청 (각 플레이어별 골드/업그레이드 사용)
    if (input.upgradeRequested) {
      const upgradeType = input.upgradeRequested as 'attack' | 'speed' | 'hp' | 'attackSpeed' | 'goldRate' | 'range';
      const success = state.upgradeOtherHeroStat(heroId, upgradeType);
      if (success) {
        console.log(`[NetworkSync] 업그레이드 완료: ${heroId}, ${upgradeType}`);
      } else {
        console.log(`[NetworkSync] 업그레이드 실패 (골드 부족 또는 최대 레벨): ${heroId}, ${upgradeType}`);
      }
    }
  }, []);

  // 클라이언트: 서버 메시지 핸들러 설정
  useEffect(() => {
    if (isSetupRef.current) return;
    isSetupRef.current = true;

    const handleMessage = (message: any) => {
      const state = useRPGStore.getState();

      switch (message.type) {
        // 호스트 기반 게임 시작
        case 'COOP_GAME_START_HOST_BASED':
          handleGameStartHostBased(message);
          break;

        // 호스트로부터 게임 상태 수신 (클라이언트만)
        case 'COOP_GAME_STATE_FROM_HOST':
          if (!state.multiplayer.isHost) {
            handleGameStateFromHost(message.state);
          }
          break;

        // 플레이어 입력 수신 (호스트만)
        case 'COOP_PLAYER_INPUT':
          if (state.multiplayer.isHost) {
            state.addRemoteInput(message.input);
          }
          break;

        // 호스트 변경
        case 'COOP_HOST_CHANGED':
          handleHostChanged(message.newHostPlayerId);
          break;

        // 새 호스트 권한 부여
        case 'COOP_YOU_ARE_NOW_HOST':
          handleBecomeHost();
          break;

        // 플레이어 연결 해제
        case 'COOP_PLAYER_DISCONNECTED':
          handlePlayerDisconnected(message.playerId);
          break;

        // 플레이어 재접속
        case 'COOP_PLAYER_RECONNECTED':
          handlePlayerReconnected(message.playerId);
          break;

        // 게임 종료
        case 'COOP_GAME_OVER':
          handleGameOver(message.result);
          break;

        // 로비 복귀
        case 'COOP_RETURN_TO_LOBBY':
          handleReturnToLobby();
          break;

        // 게임 재시작 카운트다운
        case 'COOP_RESTART_COUNTDOWN':
          handleRestartCountdown();
          break;

        // 게임 재시작
        case 'COOP_GAME_RESTART':
          handleGameRestart();
          break;

        // 방 파기됨
        case 'COOP_ROOM_DESTROYED':
          handleRoomDestroyed(message.reason);
          break;

        // 카운트다운
        case 'COOP_GAME_COUNTDOWN':
          useRPGStore.getState().setMultiplayerState({ countdown: message.seconds });
          break;

        // 카운트다운 (재시작 시)
        case 'COOP_COUNTDOWN':
          useRPGStore.getState().setMultiplayerState({ countdown: message.countdown });
          break;
      }
    };

    const unsubscribe = wsClient.addMessageHandler(handleMessage);
    return () => {
      unsubscribe();
      isSetupRef.current = false;
    };
  }, []);

  return {
    broadcastGameState,
    processRemoteInputs,
  };
}

// ============================================
// 메시지 핸들러 함수들
// ============================================

function handleGameStartHostBased(message: any) {
  const { isHost, playerIndex, players, hostPlayerId } = message;

  console.log(`[NetworkSync] 호스트 기반 게임 시작: 호스트=${isHost}, 인덱스=${playerIndex}`);

  useRPGStore.getState().setMultiplayerState({
    isMultiplayer: true,
    isHost,
    hostPlayerId,
    myPlayerId: wsClient.playerId,
    players,
    connectionState: 'in_game',
    countdown: null,
  });

  // 호스트는 게임 초기화 및 상태 관리
  // 클라이언트는 호스트로부터 상태를 받아서 적용
  useRPGStore.getState().initMultiplayerGame(players, isHost);
}

function handleGameStateFromHost(serializedState: SerializedGameState) {
  const state = useRPGStore.getState();
  const myHeroId = state.multiplayer.myHeroId;

  // 게임 상태 적용 (내 영웅 ID를 전달하여 구분)
  state.applySerializedState(serializedState, myHeroId);
}

function handleHostChanged(newHostPlayerId: string) {
  console.log(`[NetworkSync] 호스트 변경: ${newHostPlayerId}`);

  const state = useRPGStore.getState();
  const isNowHost = wsClient.playerId === newHostPlayerId;

  state.setMultiplayerState({
    hostPlayerId: newHostPlayerId,
    isHost: isNowHost,
  });
}

function handleBecomeHost() {
  console.log('[NetworkSync] 호스트 권한 부여됨');

  useRPGStore.getState().setMultiplayerState({
    isHost: true,
  });

  // 새 호스트로서 게임 루프 시작
  // (게임 루프는 이미 실행 중이므로 isHost 플래그만 변경하면 됨)
}

function handlePlayerDisconnected(playerId: string) {
  console.log(`[NetworkSync] 플레이어 연결 해제: ${playerId}`);

  const heroId = `hero_${playerId}`;
  useRPGStore.getState().removeOtherHero(heroId);

  // players 목록에서도 제거
  const state = useRPGStore.getState();
  const updatedPlayers = state.multiplayer.players.filter(p => p.id !== playerId);
  state.setMultiplayerState({ players: updatedPlayers });
}

function handlePlayerReconnected(playerId: string) {
  console.log(`[NetworkSync] 플레이어 재접속: ${playerId}`);

  // 재접속한 플레이어의 상태 복구는 호스트가 다음 상태 브로드캐스트에서 처리
}

function handleGameOver(result: any) {
  console.log('[NetworkSync] 게임 종료:', result);

  useRPGStore.getState().setGameOver(result?.victory || false);
  // 멀티플레이어 상태를 post_game으로 변경 (방은 유지)
  useRPGStore.getState().setMultiplayerState({ connectionState: 'post_game' });
}

function handleReturnToLobby() {
  console.log('[NetworkSync] 로비 복귀');

  // 게임 상태 리셋하고 로비로
  useRPGStore.getState().resetGame();
  useRPGStore.getState().setMultiplayerState({ connectionState: 'in_lobby' });
  useUIStore.getState().setScreen('rpgCoopLobby');
}

function handleRestartCountdown() {
  console.log('[NetworkSync] 게임 재시작 카운트다운 시작');

  useRPGStore.getState().setMultiplayerState({ connectionState: 'countdown' });
}

function handleGameRestart() {
  console.log('[NetworkSync] 게임 재시작');

  // 게임 상태 완전 리셋 후 새 게임 시작
  const state = useRPGStore.getState();
  const { players, isHost, hostPlayerId, myPlayerId, myHeroId } = state.multiplayer;

  // 게임 리셋
  state.resetGame();

  // 멀티플레이어 상태 유지하면서 게임 재시작
  state.setMultiplayerState({
    connectionState: 'in_game',
    players,
    isHost,
    hostPlayerId,
    myPlayerId,
    myHeroId,
  });

  // 게임 초기화 (호스트만 - 클라이언트는 호스트로부터 상태 수신)
  if (isHost) {
    state.initMultiplayerGame(players);
  }
  // 클라이언트는 호스트로부터 게임 상태를 받아서 적용함

  // 게임 화면으로
  useUIStore.getState().setScreen('rpgMode');
}

function handleRoomDestroyed(reason: string) {
  console.log('[NetworkSync] 방 파기됨:', reason);

  // 알림 표시
  useUIStore.getState().showNotification(reason || '방이 파기되었습니다.');

  // 멀티플레이어 상태 초기화
  useRPGStore.getState().resetMultiplayerState();

  // 게임 리셋
  useRPGStore.getState().resetGame();

  // 직업 선택 화면으로
  useUIStore.getState().setScreen('rpgClassSelect');
}

/**
 * 다른 플레이어 영웅의 스킬 실행 (호스트에서)
 */
function executeOtherHeroSkill(
  heroId: string,
  hero: HeroUnit,
  skillSlot: 'Q' | 'W' | 'E',
  targetX: number,
  targetY: number
) {
  const state = useRPGStore.getState();
  const heroClass = hero.heroClass;
  const classSkills = CLASS_SKILLS[heroClass];

  // 스킬 타입 결정
  let skillType: SkillType;
  let executeSkill: typeof executeQSkill | typeof executeWSkill | typeof executeESkill;

  switch (skillSlot) {
    case 'Q':
      skillType = classSkills.q.type;
      executeSkill = executeQSkill;
      break;
    case 'W':
      skillType = classSkills.w.type;
      executeSkill = executeWSkill;
      break;
    case 'E':
      skillType = classSkills.e.type;
      executeSkill = executeESkill;
      break;
    default:
      return;
  }

  // 스킬 쿨다운 확인
  const skill = hero.skills.find(s => s.type === skillType);
  if (!skill || skill.currentCooldown > 0) {
    console.log(`[NetworkSync] 스킬 쿨다운 중: ${heroId}, ${skillSlot}`);
    return;
  }

  // 스킬 실행 (enemyBases 전달, E 스킬은 casterId도 전달)
  let result;
  if (skillSlot === 'E') {
    result = (executeSkill as typeof executeESkill)(hero, state.enemies, targetX, targetY, state.gameTime, state.enemyBases, heroId);
  } else {
    result = executeSkill(hero, state.enemies, targetX, targetY, state.gameTime, state.enemyBases);
  }

  // 영웅 상태 업데이트 (스킬 쿨다운 포함)
  const updatedHero = result.hero;
  state.updateOtherHero(heroId, {
    x: updatedHero.x,
    y: updatedHero.y,
    hp: updatedHero.hp,
    skills: updatedHero.skills,
    buffs: updatedHero.buffs,
    dashState: updatedHero.dashState,
    facingAngle: Math.atan2(targetY - hero.y, targetX - hero.x),
  });

  // 이펙트 추가
  if (result.effect) {
    useRPGStore.setState((s) => ({
      activeSkillEffects: [...s.activeSkillEffects, result.effect!],
    }));
  }

  // 적 데미지 적용 - heroId를 전달하여 해당 플레이어에게 골드 지급
  for (const damage of result.enemyDamages) {
    const killed = state.damageEnemy(damage.enemyId, damage.damage, heroId);
    if (killed) {
      const enemy = state.enemies.find((e) => e.id === damage.enemyId);
      if (enemy) {
        state.removeEnemy(enemy.id);
        effectManager.createEffect('attack_melee', enemy.x, enemy.y);
      }
    }
  }

  // 버프 공유 (광전사, 철벽 방어)
  // 버프는 이미 line 305-313에서 result.hero.buffs에 포함되어 적용됨
  // 여기서는 아군에게 버프 공유만 처리
  if (result.buff) {
    // result.hero는 스킬 실행 후의 영웅 상태 (정확한 위치 정보 포함)
    shareBuffToAllies(result.buff, result.hero, heroId);
  }

  // 보류 스킬 (운석 낙하 등)
  if (result.pendingSkill) {
    state.addPendingSkill(result.pendingSkill);
  }

  // 기절 적용
  if (result.stunTargets && result.stunTargets.length > 0) {
    const stunDuration = result.stunDuration || 1.0;
    const enemies = state.enemies;
    const updatedEnemies = enemies.map(enemy => {
      if (result.stunTargets!.includes(enemy.id)) {
        return applyStunToEnemy(enemy, stunDuration, state.gameTime);
      }
      return enemy;
    });
    state.updateEnemies(updatedEnemies);

    const showNotification = useUIStore.getState().showNotification;
    showNotification(`${result.stunTargets.length}명 기절! (${stunDuration}초)`);
  }

  // 사운드 재생
  if (heroClass === 'archer' || heroClass === 'mage') {
    soundManager.play('attack_ranged');
  } else {
    soundManager.play('attack_melee');
  }

  console.log(`[NetworkSync] 스킬 실행 완료: ${heroId}, ${skillSlot}`);
}

/**
 * 아군에게 버프 공유 (광전사, 철벽 방어)
 * - 광전사(berserker): 일정 범위 내 아군에게 버프 공유
 * - 철벽 방어(ironwall): 모든 아군에게 버프 공유
 */
function shareBuffToAllies(buff: Buff, caster: HeroUnit, casterId: string) {
  // 공유 범위 결정
  let shareRange: number;
  if (buff.type === 'berserker') {
    shareRange = BERSERKER_SHARE_RANGE;
  } else if (buff.type === 'ironwall') {
    shareRange = IRONWALL_SHARE_RANGE;
  } else {
    // 공유 대상 버프가 아님
    return;
  }

  // 철벽 방어는 HP 20% 회복 효과도 함께 적용
  const isIronwall = buff.type === 'ironwall';
  const healPercent = 0.2; // 20% HP 회복

  // 호스트 영웅에게 버프 공유 (시전자가 다른 플레이어인 경우)
  // 최신 상태에서 호스트 영웅 정보 조회 (stale data 방지)
  const freshHostHero = useRPGStore.getState().hero;
  if (freshHostHero && freshHostHero.id !== casterId) {
    const distToHost = distance(caster.x, caster.y, freshHostHero.x, freshHostHero.y);
    if (distToHost <= shareRange) {
      // 같은 타입의 버프가 이미 있으면 제거 후 새로 추가
      const filteredBuffs = (freshHostHero.buffs || []).filter(b => b.type !== buff.type);
      // 공유 버프에 시전자 ID 추가 (범위 체크용)
      const sharedBuff: Buff = { ...buff, casterId };
      const updateData: Partial<HeroUnit> = {
        buffs: [...filteredBuffs, sharedBuff],
      };

      // 철벽 방어: HP 20% 회복
      if (isIronwall) {
        const healAmount = Math.floor(freshHostHero.maxHp * healPercent);
        updateData.hp = Math.min(freshHostHero.maxHp, freshHostHero.hp + healAmount);
      }

      useRPGStore.getState().updateHeroState(updateData);
      console.log(`[NetworkSync] 호스트에게 ${buff.type} 버프 공유${isIronwall ? ' + HP 회복' : ''}`);
    }
  }

  // 다른 플레이어 영웅들에게 버프 공유
  // 최신 상태에서 영웅 ID 목록 조회 후 개별적으로 fresh data 사용
  const otherHeroIds = Array.from(useRPGStore.getState().otherHeroes.keys());
  otherHeroIds.forEach((otherHeroId) => {
    // 시전자 자신은 스킵
    if (otherHeroId === casterId) return;

    // 최신 상태에서 영웅 정보 조회
    const currentOtherHero = useRPGStore.getState().otherHeroes.get(otherHeroId);
    if (!currentOtherHero) return;

    // 사망한 영웅은 스킵
    if (currentOtherHero.hp <= 0) return;

    const distToOther = distance(caster.x, caster.y, currentOtherHero.x, currentOtherHero.y);
    if (distToOther <= shareRange) {
      // 같은 시전자의 같은 타입 버프만 제거 후 새로 추가 (다른 시전자 버프는 유지)
      const filteredBuffs = (currentOtherHero.buffs || []).filter(b =>
        !(b.type === buff.type && b.casterId === casterId)
      );
      // 공유 버프에 시전자 ID 추가 (범위 체크용)
      const sharedBuff: Buff = { ...buff, casterId };
      const updateData: Partial<HeroUnit> = {
        buffs: [...filteredBuffs, sharedBuff],
      };

      // 철벽 방어: HP 20% 회복
      if (isIronwall) {
        const healAmount = Math.floor(currentOtherHero.maxHp * healPercent);
        updateData.hp = Math.min(currentOtherHero.maxHp, currentOtherHero.hp + healAmount);
      }

      useRPGStore.getState().updateOtherHero(otherHeroId, updateData);
      console.log(`[NetworkSync] ${otherHeroId}에게 ${buff.type} 버프 공유${isIronwall ? ' + HP 회복' : ''}`);
    }
  });
}

/**
 * 호스트 영웅이 사용한 버프를 다른 플레이어에게 공유
 * (useRPGGameLoop에서 호출)
 */
export function shareHostBuffToAllies(buff: Buff, hostHero: HeroUnit) {
  // 멀티플레이어가 아니면 스킵
  const multiplayer = useRPGStore.getState().multiplayer;
  if (!multiplayer.isMultiplayer || !multiplayer.isHost) return;

  // 공유 범위 결정
  let shareRange: number;
  if (buff.type === 'berserker') {
    shareRange = BERSERKER_SHARE_RANGE;
  } else if (buff.type === 'ironwall') {
    shareRange = IRONWALL_SHARE_RANGE;
  } else {
    // 공유 대상 버프가 아님
    return;
  }

  // 철벽 방어는 HP 20% 회복 효과도 함께 적용
  const isIronwall = buff.type === 'ironwall';
  const healPercent = 0.2; // 20% HP 회복

  // 다른 플레이어 영웅들에게 버프 공유 (매번 최신 상태 조회)
  const otherHeroes = useRPGStore.getState().otherHeroes;
  const heroIds = Array.from(otherHeroes.keys());

  heroIds.forEach((otherHeroId) => {
    // 최신 상태에서 영웅 정보 조회
    const currentOtherHero = useRPGStore.getState().otherHeroes.get(otherHeroId);
    if (!currentOtherHero) return;

    // 사망한 영웅은 스킵
    if (currentOtherHero.hp <= 0) return;

    const distToOther = distance(hostHero.x, hostHero.y, currentOtherHero.x, currentOtherHero.y);
    console.log(`[NetworkSync] 버프 공유 거리 체크: ${otherHeroId}, 거리=${distToOther.toFixed(0)}, 범위=${shareRange}, 공유=${distToOther <= shareRange ? 'O' : 'X'}`);
    if (distToOther <= shareRange) {
      // 같은 시전자의 같은 타입 버프만 제거 후 새로 추가 (다른 시전자 버프는 유지)
      const filteredBuffs = (currentOtherHero.buffs || []).filter(b =>
        !(b.type === buff.type && b.casterId === hostHero.id)
      );
      // 공유 버프에 시전자 ID 추가 (범위 체크용)
      const sharedBuff: Buff = { ...buff, casterId: hostHero.id };
      const updateData: Partial<HeroUnit> = {
        buffs: [...filteredBuffs, sharedBuff],
      };

      // 철벽 방어: HP 20% 회복
      if (isIronwall) {
        const healAmount = Math.floor(currentOtherHero.maxHp * healPercent);
        updateData.hp = Math.min(currentOtherHero.maxHp, currentOtherHero.hp + healAmount);
      }

      useRPGStore.getState().updateOtherHero(otherHeroId, updateData);
      console.log(`[NetworkSync] 호스트 버프 ${buff.type}를 ${otherHeroId}에게 공유${isIronwall ? ' + HP 회복' : ''}`);
    }
  });
}

// ============================================
// 클라이언트 입력 전송 함수들
// ============================================

/**
 * 이동 방향 전송 (클라이언트 → 서버 → 호스트)
 */
export function sendMoveDirection(direction: { x: number; y: number } | null) {
  const state = useRPGStore.getState();
  if (!state.multiplayer.isMultiplayer) return;

  // 호스트가 아닐 때만 서버로 전송
  if (!state.multiplayer.isHost) {
    const input: PlayerInput = {
      playerId: state.multiplayer.myPlayerId || '',
      moveDirection: direction,
      timestamp: Date.now(),
    };
    wsClient.hostSendPlayerInput(input);
  }
}

/**
 * 스킬 사용 전송 (클라이언트 → 서버 → 호스트)
 */
export function sendSkillUse(skillSlot: 'Q' | 'W' | 'E', targetX: number, targetY: number) {
  const state = useRPGStore.getState();
  if (!state.multiplayer.isMultiplayer) return;

  // 호스트가 아닐 때만 서버로 전송
  if (!state.multiplayer.isHost) {
    const input: PlayerInput = {
      playerId: state.multiplayer.myPlayerId || '',
      moveDirection: null,
      skillUsed: { skillSlot, targetX, targetY },
      timestamp: Date.now(),
    };
    wsClient.send({ type: 'HOST_PLAYER_INPUT', input });
  }
}

/**
 * 업그레이드 요청 전송 (클라이언트 → 서버 → 호스트)
 */
export function sendUpgradeRequest(upgradeType: 'attack' | 'speed' | 'hp' | 'goldRate') {
  const state = useRPGStore.getState();
  if (!state.multiplayer.isMultiplayer) return;

  // 호스트가 아닐 때만 서버로 전송
  if (!state.multiplayer.isHost) {
    wsClient.coopUpgradeHeroStat(upgradeType);
  }
}

// ============================================
// 로비 관련 함수들
// ============================================

/**
 * 멀티플레이 방 생성
 */
export function createMultiplayerRoom(playerName: string, heroClass: any, characterLevel?: number, statUpgrades?: any) {
  useRPGStore.getState().setMultiplayerState({
    isMultiplayer: true,
    connectionState: 'connecting',
  });

  wsClient.createCoopRoom(playerName, heroClass, characterLevel, statUpgrades);
}

/**
 * 멀티플레이 방 참가
 */
export function joinMultiplayerRoom(roomCode: string, playerName: string, heroClass: any, characterLevel?: number, statUpgrades?: any) {
  useRPGStore.getState().setMultiplayerState({
    isMultiplayer: true,
    connectionState: 'connecting',
  });

  wsClient.joinCoopRoom(roomCode, playerName, heroClass, characterLevel, statUpgrades);
}

/**
 * 멀티플레이 방 나가기
 */
export function leaveMultiplayerRoom() {
  wsClient.leaveCoopRoom();
  useRPGStore.getState().resetMultiplayerState();
}

/**
 * 게임 시작 (호스트만)
 */
export function startMultiplayerGame() {
  const state = useRPGStore.getState();
  if (!state.multiplayer.isHost) {
    console.warn('[NetworkSync] 호스트만 게임을 시작할 수 있습니다.');
    return;
  }

  wsClient.startCoopGame();
}
