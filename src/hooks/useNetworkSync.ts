import { useCallback, useEffect, useRef } from 'react';
import { useRPGStore } from '../stores/useRPGStore';
import { useUIStore } from '../stores/useUIStore';
import { useGameStore } from '../stores/useGameStore';
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
import type { SerializedGameState, PlayerInput } from '../../shared/types/hostBasedNetwork';
import type { CoopServerMessage, CoopPlayerInfo } from '../../shared/types/rpgNetwork';
import type { HeroUnit, SkillType, Buff } from '../types/rpg';

// 버프 공유 범위 설정
const BERSERKER_SHARE_RANGE = 300; // 광전사 버프 공유 범위
const IRONWALL_SHARE_RANGE = Infinity; // 철벽 방어는 전체 아군에게 적용

const STATE_SYNC_INTERVAL = 50; // 50ms (20Hz)

/**
 * 서버 권위 모델 네트워크 동기화 훅
 * - 서버가 게임 로직 실행 및 상태 브로드캐스트
 * - 모든 클라이언트는 입력 전송 및 상태 수신만 담당
 */
export function useNetworkSync() {
  // 클라이언트: 서버 메시지 핸들러 설정
  useEffect(() => {
    console.log('[NetworkSync] 메시지 핸들러 등록');

    const handleMessage = (message: any) => {
      const state = useRPGStore.getState();

      switch (message.type) {
        // ============================================
        // 서버 권위 모델 메시지 핸들러
        // ============================================

        // 서버 권위 모델 게임 시작 (isHost 없음 - 모든 클라이언트 동등)
        case 'COOP_GAME_START':
          handleGameStartServerAuth(message);
          break;

        // 서버로부터 게임 상태 수신 (모든 클라이언트)
        case 'COOP_GAME_STATE':
          // 디버그: 첫 몇 개 메시지만 로깅
          if (Math.random() < 0.01) {
            console.log('[NetworkSync] COOP_GAME_STATE 수신, gameTime:', message.state?.gameTime);
          }
          handleGameStateFromServer(message.state);
          break;

        // 호스트 변경
        case 'COOP_HOST_CHANGED':
          handleHostChanged(message.newHostPlayerId, message.newHostName);
          break;

        // 새 호스트 권한 부여
        case 'COOP_YOU_ARE_NOW_HOST':
          handleBecomeHost();
          break;

        // 플레이어 연결 해제
        case 'COOP_PLAYER_DISCONNECTED':
          handlePlayerDisconnected(message.playerId, message.playerName);
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
          handleRoomDestroyed(message.message || message.reason);
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

        // 재접속 정보 (재접속 후 상태 복구)
        case 'COOP_RECONNECT_INFO':
          handleReconnectInfo(message);
          break;
      }
    };

    const unsubscribe = wsClient.addMessageHandler(handleMessage);
    return () => {
      console.log('[NetworkSync] 메시지 핸들러 해제');
      unsubscribe();
    };
  }, []);

}


// ============================================
// 서버 권위 모델 메시지 핸들러 함수들
// ============================================

/**
 * 서버 권위 모델 게임 시작 처리
 * 게임 로직은 서버가 처리하지만, 방장(isHost)은 UI 목적으로 유지
 */
function handleGameStartServerAuth(message: any) {
  const { playerIndex, players, difficulty } = message;

  // 방장 정보 확인 (UI 목적: 일시정지, 재시작, 설정 변경 등)
  const hostPlayer = players.find((p: CoopPlayerInfo) => p.isHost);
  const hostPlayerId = hostPlayer?.id || null;
  const isHost = wsClient.playerId === hostPlayerId;

  console.log(`[NetworkSync] 서버 권위 모델 게임 시작:`);
  console.log(`  - playerIndex: ${playerIndex}`);
  console.log(`  - difficulty: ${difficulty}`);
  console.log(`  - wsClient.playerId: ${wsClient.playerId}`);
  console.log(`  - players:`, players.map((p: CoopPlayerInfo) => ({ id: p.id, isHost: p.isHost })));
  console.log(`  - isHost: ${isHost}`);

  useRPGStore.getState().setMultiplayerState({
    isMultiplayer: true,
    isHost,  // 방장 여부 (UI 목적)
    hostPlayerId,  // 방장 ID (UI 목적)
    myPlayerId: wsClient.playerId,
    players,
    connectionState: 'in_game',
    countdown: null,
  });

  // 난이도 설정 (서버에서 전달된 값 사용)
  if (difficulty) {
    useRPGStore.getState().setDifficulty(difficulty);
  }

  // 게임 초기화 (서버가 게임 로직 실행, 클라이언트는 상태 수신만)
  soundManager.init(); // AudioContext 초기화 (fallback)
  useRPGStore.getState().initMultiplayerGame(players, isHost, difficulty);

  // myHeroId 확인
  const finalState = useRPGStore.getState();
  console.log(`[NetworkSync] 초기화 완료:`);
  console.log(`  - myPlayerId: ${finalState.multiplayer.myPlayerId}`);
  console.log(`  - myHeroId: ${finalState.multiplayer.myHeroId}`);
  console.log(`  - hero: ${finalState.hero?.id}`);

  // 게임 화면으로 전환 (직접 호출하여 확실하게 전환)
  useUIStore.getState().resetGameUI();
  useGameStore.getState().setGameMode('rpg');
  useUIStore.getState().setScreen('game');

  console.log(`[NetworkSync] 서버 권위 모델 게임 화면 전환 완료`);
}

/**
 * 서버로부터 게임 상태 수신 (모든 클라이언트)
 */
function handleGameStateFromServer(serializedState: SerializedGameState) {
  const state = useRPGStore.getState();
  const myHeroId = state.multiplayer.myHeroId;

  // 게임 상태 적용 (myHeroId가 null이어도 applySerializedState에서 처리)
  state.applySerializedState(serializedState, myHeroId);
}

function handleHostChanged(newHostPlayerId: string, newHostName?: string) {
  console.log(`[NetworkSync] 호스트 변경: ${newHostPlayerId}`);

  const state = useRPGStore.getState();
  const isNowHost = wsClient.playerId === newHostPlayerId;

  state.setMultiplayerState({
    hostPlayerId: newHostPlayerId,
    isHost: isNowHost,
  });

  // 인게임 알림: 새 방장 안내
  if (isNowHost) {
    useUIStore.getState().showNotification('방장 권한을 위임받았습니다.');
  } else if (newHostName) {
    useUIStore.getState().showNotification(`${newHostName}님이 새 방장이 되었습니다.`);
  }
}

function handleBecomeHost() {
  console.log('[NetworkSync] 호스트 권한 부여됨');

  useRPGStore.getState().setMultiplayerState({
    isHost: true,
  });

  // 새 호스트로서 게임 루프 시작
  // (게임 루프는 이미 실행 중이므로 isHost 플래그만 변경하면 됨)
  useUIStore.getState().showNotification('방장 권한을 위임받았습니다.');
}

function handlePlayerDisconnected(playerId: string, playerName?: string) {
  console.log(`[NetworkSync] 플레이어 연결 해제: ${playerId}`);

  const heroId = `hero_${playerId}`;
  useRPGStore.getState().removeOtherHero(heroId);

  // players 목록에서도 제거
  const state = useRPGStore.getState();
  const leavingPlayer = state.multiplayer.players.find(p => p.id === playerId);
  const displayName = playerName || leavingPlayer?.name || `Player`;
  const updatedPlayers = state.multiplayer.players.filter(p => p.id !== playerId);
  state.setMultiplayerState({ players: updatedPlayers });

  // 인게임 알림
  useUIStore.getState().showNotification(`${displayName}님의 연결이 끊어졌습니다.`);
}

function handlePlayerReconnected(playerId: string) {
  console.log(`[NetworkSync] 플레이어 재접속: ${playerId}`);

  // 재접속한 플레이어의 상태 복구는 호스트가 다음 상태 브로드캐스트에서 처리
}

/**
 * 재접속 정보 처리 (재접속 후 상태 복구)
 */
function handleReconnectInfo(message: { hostPlayerId: string; isHost: boolean; gameState: string }) {
  console.log(`[NetworkSync] 재접속 정보 수신:`, message);

  const state = useRPGStore.getState();

  // 멀티플레이어 상태 업데이트
  state.setMultiplayerState({
    hostPlayerId: message.hostPlayerId,
    isHost: message.isHost,
    connectionState: message.gameState === 'playing' ? 'in_game' : 'connected',
  });

  // 호스트가 아닌 경우, 호스트로부터 상태를 받을 때까지 대기
  // 호스트는 주기적으로 상태를 브로드캐스트하므로 곧 동기화됨
  if (!message.isHost && message.gameState === 'playing') {
    console.log('[NetworkSync] 호스트로부터 게임 상태 동기화 대기 중...');
  }
}

function handleGameOver(result: any) {
  console.log('[NetworkSync] 게임 종료:', result);

  // 호스트에서 받은 stats 적용 (최종 보스 처치 수 등)
  if (result?.stats) {
    useRPGStore.setState({ stats: result.stats });
  }

  useRPGStore.getState().setGameOver(result?.victory || false);

  // 게임 종료 사운드 재생
  if (result?.victory) {
    soundManager.play('victory');
  } else {
    soundManager.play('defeat');
  }

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

function handleRoomDestroyed(message: string) {
  console.log('[NetworkSync] 방 파기됨:', message);

  // 알림 표시
  useUIStore.getState().showNotification(message || '방이 파기되었습니다.');

  // 로비 채팅 정리
  useRPGStore.getState().clearLobbyChatMessages();

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

  // 사망한 영웅은 스킬 사용 불가
  if (hero.hp <= 0) {
    console.log(`[NetworkSync] 사망한 영웅은 스킬 사용 불가: ${heroId}`);
    return;
  }

  // 시전 중이면 스킬 사용 불가 (스나이퍼 E 스킬 등)
  if (hero.castingUntil && state.gameTime < hero.castingUntil) {
    console.log(`[NetworkSync] 시전 중인 영웅은 스킬 사용 불가: ${heroId}`);
    return;
  }

  // 돌진 중이면 스킬 사용 불가
  if (hero.dashState) {
    console.log(`[NetworkSync] 돌진 중인 영웅은 스킬 사용 불가: ${heroId}`);
    return;
  }

  // 스턴 상태면 스킬 사용 불가
  const isStunned = hero.buffs?.some(b => b.type === 'stun' && b.duration > 0);
  if (isStunned) {
    console.log(`[NetworkSync] 스턴된 영웅은 스킬 사용 불가: ${heroId}`);
    return;
  }

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

  // 스킬 실행 (enemyBases 전달, E 스킬은 casterId도 전달, W/E 스킬은 allies 전달)
  let result;

  // 모든 아군 영웅 목록 (내 영웅 + 다른 영웅들)
  const allAllies: HeroUnit[] = [];
  if (state.hero) allAllies.push(state.hero);
  state.otherHeroes.forEach((h) => allAllies.push(h));

  // 인게임 공격력 업그레이드 레벨 (해당 플레이어의 업그레이드 레벨 사용)
  const playerUpgrades = state.getOtherPlayerUpgrades(heroId);
  const attackUpgradeLevel = playerUpgrades.attack;

  if (skillSlot === 'E') {
    // E 스킬: casterId, attackUpgradeLevel, allies 전달 (가디언/팔라딘 궁극기 아군 버프/힐 적용)
    result = (executeSkill as typeof executeESkill)(hero, state.enemies, targetX, targetY, state.gameTime, state.enemyBases, heroId, attackUpgradeLevel, allAllies);
  } else if (skillSlot === 'W') {
    result = (executeSkill as typeof executeWSkill)(hero, state.enemies, targetX, targetY, state.gameTime, state.enemyBases, attackUpgradeLevel, allAllies);
  } else {
    // Q 스킬: allies 전달 (팔라딘 기본 공격 시 주변 아군 힐)
    result = (executeSkill as typeof executeQSkill)(hero, state.enemies, targetX, targetY, state.gameTime, state.enemyBases, attackUpgradeLevel, allAllies);
  }

  // 영웅 상태 업데이트 (스킬 쿨다운 포함)
  const updatedHero = result.hero;

  // 스킬 쿨다운 처리:
  // 1. result.hero.skills에는 가디언/팔라딘 W 스킬 쿨다운 감소가 적용되어 있음
  // 2. 현재 사용한 스킬의 쿨다운을 리셋
  const updatedSkills = updatedHero.skills.map(s =>
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
    castingUntil: updatedHero.castingUntil,  // 시전 상태 (스나이퍼 E 스킬 등)
    facingAngle: Math.atan2(targetY - hero.y, targetX - hero.x),
  });

  // 이펙트 추가 (heroId 포함)
  if (result.effect) {
    const effectWithHeroId = { ...result.effect, heroId };
    useRPGStore.setState((s) => ({
      activeSkillEffects: [...s.activeSkillEffects, effectWithHeroId],
    }));
  }

  // Q 스킬(기본 공격)인 경우 basicAttackEffect 추가 (클라이언트 영웅 공격 이펙트 동기화)
  if (skillSlot === 'Q') {
    const isRanged = hero.heroClass === 'archer' || hero.heroClass === 'mage';
    useRPGStore.getState().addBasicAttackEffect({
      id: `other_hero_attack_${Date.now()}_${heroId}`,
      type: isRanged ? 'ranged' : 'melee',
      x: targetX,
      y: targetY,
      timestamp: Date.now(),
    });
  }

  // 적 데미지 적용 - heroId를 전달하여 해당 플레이어에게 골드 지급
  for (const damage of result.enemyDamages) {
    const enemy = state.enemies.find((e) => e.id === damage.enemyId);
    const killed = state.damageEnemy(damage.enemyId, damage.damage, heroId);

    // 플로팅 데미지 숫자 표시
    if (enemy) {
      // 크리티컬 여부는 스킬 시스템에서 결정된 isCritical 플래그 사용
      useRPGStore.getState().addDamageNumber(enemy.x, enemy.y, damage.damage, damage.isCritical ? 'critical' : 'damage');
    }

    if (killed) {
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

  // 버프 공유 (광전사, 기사 철벽 방어)
  // 아군에게 버프 공유 처리 (버프는 위에서 이미 시전자에게 적용됨)
  // 가디언 수호의 돌진 (damageReduction = 0.2)은 allyBuffs로 별도 처리하므로 제외
  const isKnightIronwallBuff = result.buff?.type === 'ironwall' && (result.buff.damageReduction || 0) >= 0.5;
  if (result.buff && (result.buff.type === 'berserker' || isKnightIronwallBuff)) {
    // result.hero는 스킬 실행 후의 영웅 상태 (정확한 위치 정보 포함)
    shareBuffToAllies(result.buff, result.hero, heroId);
  }

  // 아군 힐 적용 (전직 스킬: 성기사, 힐러)
  if (result.allyHeals && result.allyHeals.length > 0) {
    for (const heal of result.allyHeals) {
      // 내 영웅인 경우
      if (state.hero && state.hero.id === heal.heroId) {
        // 사망한 영웅에게는 힐 적용 안 함
        if (state.hero.hp <= 0) continue;
        const newHp = Math.min(state.hero.maxHp, state.hero.hp + heal.heal);
        useRPGStore.setState({ hero: { ...state.hero, hp: newHp } });
        effectManager.createEffect('heal', state.hero.x, state.hero.y);
        // 힐 플로팅 숫자 표시
        useRPGStore.getState().addDamageNumber(state.hero.x, state.hero.y, heal.heal, 'heal');
      } else {
        // 다른 영웅인 경우
        const targetHero = state.otherHeroes.get(heal.heroId);
        if (targetHero) {
          // 사망한 영웅에게는 힐 적용 안 함
          if (targetHero.hp <= 0) continue;
          const newHp = Math.min(targetHero.maxHp, targetHero.hp + heal.heal);
          state.updateOtherHero(heal.heroId, { hp: newHp });
          effectManager.createEffect('heal', targetHero.x, targetHero.y);
          // 힐 플로팅 숫자 표시
          useRPGStore.getState().addDamageNumber(targetHero.x, targetHero.y, heal.heal, 'heal');
        }
      }
    }
  }

  // 아군 버프 적용 (전직 스킬: 가디언, 팔라딘)
  if (result.allyBuffs && result.allyBuffs.length > 0) {
    for (const allyBuff of result.allyBuffs) {
      // 내 영웅인 경우
      if (state.hero && state.hero.id === allyBuff.heroId) {
        // 사망한 영웅에게는 버프 적용 안 함
        if (state.hero.hp <= 0) continue;
        const existingBuffs = state.hero.buffs.filter(b => b.type !== allyBuff.buff.type);
        useRPGStore.setState({ hero: { ...state.hero, buffs: [...existingBuffs, allyBuff.buff] } });
      } else {
        // 다른 영웅인 경우
        const targetHero = state.otherHeroes.get(allyBuff.heroId);
        if (targetHero) {
          // 사망한 영웅에게는 버프 적용 안 함
          if (targetHero.hp <= 0) continue;
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
 * 아군에게 버프 공유 (광전사, 기사 철벽 방어)
 * - 광전사(berserker): 일정 범위 내 아군에게 버프 공유
 * - 철벽 방어(ironwall): 모든 아군에게 버프 공유 (기사만, 가디언 제외)
 */
function shareBuffToAllies(buff: Buff, caster: HeroUnit, casterId: string) {
  // 가디언 수호의 돌진 (damageReduction = 0.2)은 allyBuffs로 별도 처리하므로 제외
  const isGuardianShield = buff.type === 'ironwall' && (buff.damageReduction || 0) < 0.5;
  if (isGuardianShield) {
    // 가디언 보호막은 skillSystem에서 allyBuffs로 처리
    return;
  }

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

  // 기사 철벽 방어 (damageReduction >= 0.5)만 HP 20% 회복 효과 적용
  // 가디언 수호의 돌진 (damageReduction = 0.2)은 보호막만, HP 회복 없음
  const isKnightIronwall = buff.type === 'ironwall' && (buff.damageReduction || 0) >= 0.5;
  const healPercent = 0.2; // 20% HP 회복

  // 호스트 영웅에게 버프 공유 (시전자가 다른 플레이어인 경우)
  // 최신 상태에서 호스트 영웅 정보 조회 (stale data 방지)
  const freshHostHero = useRPGStore.getState().hero;
  if (freshHostHero && freshHostHero.id !== casterId) {
    // 사망한 영웅은 스킵 (사망 상태에서 HP 회복으로 부활하는 버그 방지)
    if (freshHostHero.hp <= 0) return;

    const distToHost = distance(caster.x, caster.y, freshHostHero.x, freshHostHero.y);
    if (distToHost <= shareRange) {
      // 같은 타입의 버프가 이미 있으면 제거 후 새로 추가
      const filteredBuffs = (freshHostHero.buffs || []).filter(b => b.type !== buff.type);
      // 공유 버프에 시전자 ID 추가 (범위 체크용)
      const sharedBuff: Buff = { ...buff, casterId };
      const updateData: Partial<HeroUnit> = {
        buffs: [...filteredBuffs, sharedBuff],
      };

      // 기사 철벽 방어: HP 20% 회복 (가디언 보호막은 회복 없음)
      if (isKnightIronwall) {
        const healAmount = Math.floor(freshHostHero.maxHp * healPercent);
        updateData.hp = Math.min(freshHostHero.maxHp, freshHostHero.hp + healAmount);
      }

      useRPGStore.getState().updateHeroState(updateData);
      console.log(`[NetworkSync] 호스트에게 ${buff.type} 버프 공유${isKnightIronwall ? ' + HP 회복' : ''}`);
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

      // 기사 철벽 방어: HP 20% 회복 (가디언 보호막은 회복 없음)
      if (isKnightIronwall) {
        const healAmount = Math.floor(currentOtherHero.maxHp * healPercent);
        updateData.hp = Math.min(currentOtherHero.maxHp, currentOtherHero.hp + healAmount);
      }

      useRPGStore.getState().updateOtherHero(otherHeroId, updateData);
      console.log(`[NetworkSync] ${otherHeroId}에게 ${buff.type} 버프 공유${isKnightIronwall ? ' + HP 회복' : ''}`);
    }
  });
}

/**
 * @deprecated 서버 권위 모델에서는 서버가 버프 공유 처리
 * 호스트 영웅이 사용한 버프를 다른 플레이어에게 공유
 * (useRPGGameLoop에서 호출 - 레거시)
 */
export function shareHostBuffToAllies(buff: Buff, hostHero: HeroUnit) {
  // 서버 권위 모델에서는 서버가 버프 공유 처리
  // 멀티플레이어가 아니면 스킵
  const multiplayer = useRPGStore.getState().multiplayer;
  if (!multiplayer.isMultiplayer || !multiplayer.isHost) return;

  // 가디언 수호의 돌진 (damageReduction = 0.2)은 allyBuffs로 별도 처리하므로 제외
  const isGuardianShield = buff.type === 'ironwall' && (buff.damageReduction || 0) < 0.5;
  if (isGuardianShield) {
    // 가디언 보호막은 skillSystem에서 allyBuffs로 처리
    return;
  }

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

  // 기사 철벽 방어 (damageReduction >= 0.5)만 HP 20% 회복 효과 적용
  // 가디언 수호의 돌진 (damageReduction = 0.2)은 보호막만, HP 회복 없음
  const isKnightIronwall = buff.type === 'ironwall' && (buff.damageReduction || 0) >= 0.5;
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

      // 기사 철벽 방어: HP 20% 회복 (가디언 보호막은 회복 없음)
      if (isKnightIronwall) {
        const healAmount = Math.floor(currentOtherHero.maxHp * healPercent);
        updateData.hp = Math.min(currentOtherHero.maxHp, currentOtherHero.hp + healAmount);
      }

      useRPGStore.getState().updateOtherHero(otherHeroId, updateData);
      console.log(`[NetworkSync] 호스트 버프 ${buff.type}를 ${otherHeroId}에게 공유${isKnightIronwall ? ' + HP 회복' : ''}`);
    }
  });
}

// ============================================
// 클라이언트 입력 전송 함수들
// ============================================

/**
 * 이동 방향 전송 (클라이언트 → 서버)
 * 서버 권위 모델: 모든 클라이언트가 서버로 입력 전송
 */
export function sendMoveDirection(direction: { x: number; y: number } | null) {
  const state = useRPGStore.getState();
  if (!state.multiplayer.isMultiplayer) return;

  // 서버 권위 모델: 모든 클라이언트가 서버로 전송
  const hero = state.hero;
  const input: PlayerInput = {
    playerId: state.multiplayer.myPlayerId || '',
    moveDirection: direction,
    // 클라이언트 실제 위치 전송 (보스 스킬 데미지 계산용)
    position: hero ? { x: hero.x, y: hero.y } : undefined,
    timestamp: Date.now(),
  };

  // 새 서버 권위 모델 메시지 타입 사용
  wsClient.send({ type: 'PLAYER_INPUT', input });
}

/**
 * 스킬 사용 전송 (클라이언트 → 서버)
 * 서버 권위 모델: 모든 클라이언트가 서버로 입력 전송
 */
export function sendSkillUse(skillSlot: 'Q' | 'W' | 'E', targetX: number, targetY: number) {
  const state = useRPGStore.getState();
  if (!state.multiplayer.isMultiplayer) return;

  // 서버 권위 모델: 모든 클라이언트가 서버로 전송
  const hero = state.hero;
  const input: PlayerInput = {
    playerId: state.multiplayer.myPlayerId || '',
    // moveDirection 생략 = 기존 이동 방향 유지
    // 클라이언트 실제 위치 전송 (보스 스킬 데미지 계산용)
    position: hero ? { x: hero.x, y: hero.y } : undefined,
    skillUsed: { skillSlot, targetX, targetY },
    timestamp: Date.now(),
  };

  // 새 서버 권위 모델 메시지 타입 사용
  wsClient.send({ type: 'PLAYER_INPUT', input });
}

/**
 * 업그레이드 요청 전송 (클라이언트 → 서버)
 * 서버 권위 모델: 모든 클라이언트가 서버로 입력 전송
 * 위치 정보를 함께 전송하여 업그레이드 후 위치가 되돌아가는 버그 방지
 */
export function sendUpgradeRequest(upgradeType: 'attack' | 'speed' | 'hp' | 'goldRate' | 'attackSpeed' | 'range') {
  const state = useRPGStore.getState();
  if (!state.multiplayer.isMultiplayer) return;

  // 서버 권위 모델: 모든 클라이언트가 서버로 전송
  const hero = state.hero;
  const input: PlayerInput = {
    playerId: state.multiplayer.myPlayerId || '',
    // moveDirection 생략 = 기존 이동 방향 유지
    // 업그레이드 시에도 현재 위치 전송 (위치 되돌아감 버그 방지)
    position: hero ? { x: hero.x, y: hero.y } : undefined,
    upgradeRequested: upgradeType,
    timestamp: Date.now(),
  };

  // 새 서버 권위 모델 메시지 타입 사용
  wsClient.send({ type: 'PLAYER_INPUT', input });
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

/**
 * 친구 초대로 방 참가 (비밀방 코드 없이 입장)
 */
export function joinRoomByInvite(
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

  // 초대를 통한 입장이므로 일반 코드 입장과 동일하게 처리
  // (서버에서 초대 유효성은 이미 검증됨)
  wsClient.joinCoopRoom(roomCode, playerName, heroClass, characterLevel, statUpgrades, advancedClass as any, tier);
}
