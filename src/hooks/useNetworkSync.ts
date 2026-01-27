import { useCallback, useEffect, useRef } from 'react';
import { useRPGStore } from '../stores/useRPGStore';
import { useUIStore } from '../stores/useUIStore';
import { wsClient } from '../services/WebSocketClient';
import { CLASS_SKILLS, GOLD_CONFIG } from '../constants/rpgConfig';
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

    // 이동 방향 및 위치 업데이트
    if (input.moveDirection !== undefined) {
      const updateData: Record<string, any> = {
        moveDirection: input.moveDirection || undefined,
        state: input.moveDirection ? 'moving' : 'idle',
      };

      // 클라이언트가 보낸 실제 위치가 있으면 업데이트 (보스 스킬 데미지 정확도 향상)
      if (input.position) {
        updateData.x = input.position.x;
        updateData.y = input.position.y;
      }

      state.updateOtherHero(heroId, updateData);
    }

    // 스킬 사용
    if (input.skillUsed) {
      // 스킬 사용 시에도 위치 업데이트
      if (input.position) {
        state.updateOtherHero(heroId, {
          x: input.position.x,
          y: input.position.y,
        });
      }

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
          handleReturnToLobby(message);
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

        // 게임 일시정지 (호스트가 일시정지)
        case 'COOP_GAME_PAUSED':
          handleHostPaused();
          break;

        // 게임 재개 (호스트가 재개)
        case 'COOP_GAME_RESUMED':
          handleHostResumed();
          break;

        // 게임 중단 (호스트가 게임 중단)
        case 'COOP_GAME_STOPPED':
          handleGameStopped();
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
  const { isHost, playerIndex, players, hostPlayerId, difficulty } = message;

  console.log(`[NetworkSync] 호스트 기반 게임 시작: 호스트=${isHost}, 인덱스=${playerIndex}, 난이도=${difficulty}`);

  useRPGStore.getState().setMultiplayerState({
    isMultiplayer: true,
    isHost,
    hostPlayerId,
    myPlayerId: wsClient.playerId,
    players,
    connectionState: 'in_game',
    countdown: null,
  });

  // 난이도 설정 (서버에서 전달된 값 사용)
  if (difficulty) {
    useRPGStore.getState().setDifficulty(difficulty);
  }

  // 호스트는 게임 초기화 및 상태 관리
  // 클라이언트는 호스트로부터 상태를 받아서 적용
  soundManager.init(); // AudioContext 초기화 (fallback)
  useRPGStore.getState().initMultiplayerGame(players, isHost, difficulty);
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

function handleReturnToLobby(message?: any) {
  console.log('[NetworkSync] 로비 복귀', message);

  // 게임 상태 리셋
  useRPGStore.getState().resetGame();

  // 멀티플레이어 상태 업데이트 (플레이어 정보 유지)
  if (message && message.players) {
    // 현재 플레이어가 호스트인지 확인
    const isHost = wsClient.playerId === message.hostPlayerId;

    useRPGStore.getState().setMultiplayerState({
      connectionState: 'in_lobby',
      roomCode: message.roomCode,
      roomId: message.roomId,
      players: message.players,
      hostPlayerId: message.hostPlayerId,
      isHost,  // 호스트 여부 설정
      roomIsPrivate: message.isPrivate ?? false,
      roomDifficulty: message.difficulty ?? 'easy',
    });

    // 난이도도 복원
    if (message.difficulty) {
      useRPGStore.getState().setDifficulty(message.difficulty);
    }
  } else {
    useRPGStore.getState().setMultiplayerState({ connectionState: 'in_lobby' });
  }

  useUIStore.getState().setScreen('rpgCoopLobby');
}

function handleRestartCountdown() {
  console.log('[NetworkSync] 게임 재시작 카운트다운 시작');

  useRPGStore.getState().setMultiplayerState({
    connectionState: 'countdown',
    countdown: 3,  // 초기 카운트다운 값 설정
  });
}

function handleGameRestart() {
  console.log('[NetworkSync] 게임 재시작');

  // 게임 상태 완전 리셋 후 새 게임 시작
  const state = useRPGStore.getState();
  const { players, isHost, hostPlayerId, myPlayerId, myHeroId, roomCode, roomId } = state.multiplayer;

  // 게임 리셋
  state.resetGame();

  // 멀티플레이어 상태 유지하면서 게임 재시작
  state.setMultiplayerState({
    isMultiplayer: true,  // 멀티플레이어 상태 유지
    connectionState: 'in_game',
    players,
    isHost,
    hostPlayerId,
    myPlayerId,
    myHeroId,
    roomCode,
    roomId,
  });

  // 게임 초기화 (모든 플레이어가 동일한 players 정보로 초기화)
  // 호스트의 상태 동기화가 이후 일관성을 유지
  soundManager.init(); // AudioContext 초기화 (fallback)
  useRPGStore.getState().initMultiplayerGame(players, isHost);

  // 게임 화면으로
  useUIStore.getState().setScreen('game');
}

function handleRoomDestroyed(reason: string) {
  console.log('[NetworkSync] 방 파기됨:', reason);

  // 알림 표시
  useUIStore.getState().showNotification(reason || '방이 파기되었습니다.');

  // 멀티플레이어 상태 초기화
  useRPGStore.getState().resetMultiplayerState();

  // 게임 리셋
  useRPGStore.getState().resetGame();

  // 대기방 로비 화면으로
  useUIStore.getState().setScreen('rpgCoopLobby');
}

/**
 * 호스트가 게임 일시정지 (클라이언트가 수신)
 */
function handleHostPaused() {
  console.log('[NetworkSync] 호스트가 게임 일시정지');

  // RPG 상태 일시정지
  useRPGStore.getState().setPaused(true);

  // 일시정지 화면으로
  useUIStore.getState().setScreen('paused');
}

/**
 * 호스트가 게임 재개 (클라이언트가 수신)
 */
function handleHostResumed() {
  console.log('[NetworkSync] 호스트가 게임 재개');

  // RPG 상태 재개
  useRPGStore.getState().setPaused(false);

  // 게임 화면으로
  useUIStore.getState().setScreen('game');
}

/**
 * 호스트가 게임 중단 (모든 플레이어가 수신)
 */
function handleGameStopped() {
  console.log('[NetworkSync] 호스트가 게임 중단');

  // 일시정지 해제
  useRPGStore.getState().setPaused(false);

  // 게임 오버로 처리 (패배로 기록)
  useRPGStore.getState().setGameOver(false);

  // 게임 화면으로 (게임 오버 모달 표시)
  useUIStore.getState().setScreen('game');
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

  // 스킬 슬롯에 해당하는 스킬 인덱스
  const skillIndex = skillSlot === 'Q' ? 0 : skillSlot === 'W' ? 1 : 2;

  // 영웅의 실제 스킬에서 타입 가져오기 (전직 스킬 포함)
  const skill = hero.skills[skillIndex];
  if (!skill) {
    console.log(`[NetworkSync] 스킬을 찾을 수 없음: ${heroId}, ${skillSlot}`);
    return;
  }

  const skillType = skill.type;
  let executeSkill: typeof executeQSkill | typeof executeWSkill | typeof executeESkill;

  switch (skillSlot) {
    case 'Q':
      executeSkill = executeQSkill;
      break;
    case 'W':
      executeSkill = executeWSkill;
      break;
    case 'E':
      executeSkill = executeESkill;
      break;
    default:
      return;
  }

  // 스킬 쿨다운 확인
  if (skill.currentCooldown > 0) {
    console.log(`[NetworkSync] 스킬 쿨다운 중: ${heroId}, ${skillSlot}`);
    return;
  }

  // 스킬 실행 (enemyBases 전달, E 스킬은 casterId도 전달, W 스킬은 allies 전달)
  let result;

  // 모든 아군 영웅 목록 (내 영웅 + 다른 영웅들)
  const allAllies: HeroUnit[] = [];
  if (state.hero) allAllies.push(state.hero);
  state.otherHeroes.forEach((h) => allAllies.push(h));

  if (skillSlot === 'E') {
    result = (executeSkill as typeof executeESkill)(hero, state.enemies, targetX, targetY, state.gameTime, state.enemyBases, heroId);
  } else if (skillSlot === 'W') {
    result = (executeSkill as typeof executeWSkill)(hero, state.enemies, targetX, targetY, state.gameTime, state.enemyBases, 0, allAllies);
  } else {
    result = executeSkill(hero, state.enemies, targetX, targetY, state.gameTime, state.enemyBases);
  }

  // 영웅 상태 업데이트 (스킬 쿨다운 포함)
  const updatedHero = result.hero;

  // 스킬 쿨다운 리셋 (스킬 함수에서 skills를 업데이트하지 않으므로 여기서 처리)
  const updatedSkills = hero.skills.map(s =>
    s.type === skillType ? { ...s, currentCooldown: s.cooldown } : s
  );

  // 버프 적용 (result.buff가 있으면 영웅 버프에 추가)
  let updatedBuffs = updatedHero.buffs || [];
  if (result.buff) {
    // 같은 타입의 버프가 있으면 교체, 없으면 추가
    updatedBuffs = updatedBuffs.filter(b => b.type !== result.buff!.type);
    updatedBuffs = [...updatedBuffs, result.buff];
  }

  state.updateOtherHero(heroId, {
    x: updatedHero.x,
    y: updatedHero.y,
    hp: updatedHero.hp,
    skills: updatedSkills,  // 쿨다운 리셋된 스킬
    buffs: updatedBuffs,    // 새 버프 포함
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

  // 기지 데미지 적용 - heroId를 전달하여 골드 배분용 공격자 추적
  if (result.baseDamages && result.baseDamages.length > 0) {
    for (const baseDamage of result.baseDamages) {
      const { destroyed, goldReceived } = state.damageBase(baseDamage.baseId, baseDamage.damage, heroId);
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

  // 버프 공유 (광전사, 철벽 방어)
  // 아군에게 버프 공유 처리 (버프는 위에서 이미 시전자에게 적용됨)
  if (result.buff && (result.buff.type === 'berserker' || result.buff.type === 'ironwall')) {
    // result.hero는 스킬 실행 후의 영웅 상태 (정확한 위치 정보 포함)
    shareBuffToAllies(result.buff, result.hero, heroId);
  }

  // 아군 힐 적용 (전직 스킬: 성기사, 힐러)
  if (result.allyHeals && result.allyHeals.length > 0) {
    for (const heal of result.allyHeals) {
      // 내 영웅인 경우
      if (state.hero && state.hero.id === heal.heroId) {
        const newHp = Math.min(state.hero.maxHp, state.hero.hp + heal.heal);
        useRPGStore.setState({ hero: { ...state.hero, hp: newHp } });
        effectManager.createEffect('heal', state.hero.x, state.hero.y);
      } else {
        // 다른 영웅인 경우
        const targetHero = state.otherHeroes.get(heal.heroId);
        if (targetHero) {
          const newHp = Math.min(targetHero.maxHp, targetHero.hp + heal.heal);
          state.updateOtherHero(heal.heroId, { hp: newHp });
          effectManager.createEffect('heal', targetHero.x, targetHero.y);
        }
      }
    }
  }

  // 아군 버프 적용 (전직 스킬: 성기사, 힐러)
  if (result.allyBuffs && result.allyBuffs.length > 0) {
    for (const allyBuff of result.allyBuffs) {
      // 내 영웅인 경우
      if (state.hero && state.hero.id === allyBuff.heroId) {
        const existingBuffs = state.hero.buffs.filter(b => b.type !== allyBuff.buff.type);
        useRPGStore.setState({ hero: { ...state.hero, buffs: [...existingBuffs, allyBuff.buff] } });
      } else {
        // 다른 영웅인 경우
        const targetHero = state.otherHeroes.get(allyBuff.heroId);
        if (targetHero) {
          const existingBuffs = targetHero.buffs.filter(b => b.type !== allyBuff.buff.type);
          state.updateOtherHero(allyBuff.heroId, { buffs: [...existingBuffs, allyBuff.buff] });
        }
      }
    }
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
  if (hero.heroClass === 'archer' || hero.heroClass === 'mage') {
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
    const hero = state.hero;
    const input: PlayerInput = {
      playerId: state.multiplayer.myPlayerId || '',
      moveDirection: direction,
      // 클라이언트 실제 위치 전송 (보스 스킬 데미지 계산용)
      position: hero ? { x: hero.x, y: hero.y } : undefined,
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
    const hero = state.hero;
    const input: PlayerInput = {
      playerId: state.multiplayer.myPlayerId || '',
      moveDirection: null,
      // 클라이언트 실제 위치 전송 (보스 스킬 데미지 계산용)
      position: hero ? { x: hero.x, y: hero.y } : undefined,
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
export function createMultiplayerRoom(
  playerName: string,
  heroClass: any,
  characterLevel?: number,
  statUpgrades?: any,
  isPrivate?: boolean,
  difficulty?: string,
  advancedClass?: string,
  tier?: 1 | 2
) {
  useRPGStore.getState().setMultiplayerState({
    isMultiplayer: true,
    connectionState: 'connecting',
  });

  wsClient.createCoopRoom(playerName, heroClass, characterLevel, statUpgrades, isPrivate ?? false, difficulty ?? 'easy', advancedClass as any, tier);
}

/**
 * 멀티플레이 방 참가
 */
export function joinMultiplayerRoom(
  roomCode: string,
  playerName: string,
  heroClass: any,
  characterLevel?: number,
  statUpgrades?: any,
  advancedClass?: string,
  tier?: 1 | 2
) {
  useRPGStore.getState().setMultiplayerState({
    isMultiplayer: true,
    connectionState: 'connecting',
  });

  wsClient.joinCoopRoom(roomCode, playerName, heroClass, characterLevel, statUpgrades, advancedClass as any, tier);
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
