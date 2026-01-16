import { v4 as uuidv4 } from 'uuid';
import { players, sendToPlayer } from '../state/players';
import { addRoom } from '../websocket/MessageHandler';
import { GameRoom } from '../game/GameRoom';

// 매칭 대기열
const matchQueue: string[] = [];

export function addToQueue(playerId: string): void {
  // 이미 큐에 있으면 무시
  if (matchQueue.includes(playerId)) {
    return;
  }

  matchQueue.push(playerId);

  // 대기열 위치 알림
  sendToPlayer(playerId, {
    type: 'QUEUE_JOINED',
    position: matchQueue.length,
  });

  console.log(`매칭 대기열: ${matchQueue.length}명`);

  // 대기열 위치 업데이트 (모든 대기자에게)
  updateQueuePositions();

  // 2명 이상이면 매칭 시도
  tryMatch();
}

export function removeFromQueue(playerId: string): void {
  const index = matchQueue.indexOf(playerId);
  if (index !== -1) {
    matchQueue.splice(index, 1);
    console.log(`매칭 대기열에서 제거: ${playerId}, 남은 인원: ${matchQueue.length}명`);

    // 대기열 위치 업데이트
    updateQueuePositions();
  }
}

function updateQueuePositions(): void {
  matchQueue.forEach((playerId, index) => {
    sendToPlayer(playerId, {
      type: 'QUEUE_UPDATE',
      position: index + 1,
    });
  });
}

function tryMatch(): void {
  // 2명 이상일 때 매칭
  while (matchQueue.length >= 2) {
    const player1Id = matchQueue.shift()!;
    const player2Id = matchQueue.shift()!;

    const player1 = players.get(player1Id);
    const player2 = players.get(player2Id);

    if (!player1 || !player2) {
      // 플레이어가 없으면 남은 플레이어를 다시 큐에 넣음
      if (player1) matchQueue.unshift(player1Id);
      if (player2) matchQueue.unshift(player2Id);
      continue;
    }

    // 게임 방 생성
    const roomId = uuidv4();
    const room = new GameRoom(roomId, player1Id, player2Id);

    // 방 등록
    addRoom(room);

    // 플레이어 방 ID 설정
    player1.roomId = roomId;
    player2.roomId = roomId;

    console.log(`매칭 성공: ${player1.name} vs ${player2.name} (Room: ${roomId})`);

    // 매칭 성공 알림
    sendToPlayer(player1Id, {
      type: 'MATCH_FOUND',
      roomId,
      opponent: player2.name,
      side: 'left',
    });

    sendToPlayer(player2Id, {
      type: 'MATCH_FOUND',
      roomId,
      opponent: player1.name,
      side: 'right',
    });

    // 카운트다운 시작
    room.startCountdown();
  }
}

export function getQueueLength(): number {
  return matchQueue.length;
}
