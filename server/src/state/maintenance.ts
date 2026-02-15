import { players, sendMessage } from './players';

export interface MaintenanceState {
  isActive: boolean;
  message: string;
  scheduledAt: number | null;  // timestamp when maintenance was scheduled
  shutdownAt: number | null;   // timestamp when server will shut down
}

let maintenanceState: MaintenanceState = {
  isActive: false,
  message: '',
  scheduledAt: null,
  shutdownAt: null,
};

let countdownInterval: ReturnType<typeof setInterval> | null = null;

export function getMaintenanceState(): MaintenanceState {
  return { ...maintenanceState };
}

export function isMaintenanceActive(): boolean {
  return maintenanceState.isActive;
}

/**
 * 점검 모드 활성화 (카운트다운 알림 + 점검 상태 설정)
 * @param minutes 서버 종료까지 남은 시간(분). 0이면 즉시 점검 모드만 활성화
 * @param message 점검 안내 메시지
 */
export function activateMaintenance(minutes: number, message: string): void {
  const now = Date.now();

  maintenanceState = {
    isActive: true,
    message,
    scheduledAt: now,
    shutdownAt: minutes > 0 ? now + minutes * 60 * 1000 : null,
  };

  // 기존 카운트다운 정리
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }

  // 즉시 모든 플레이어에게 점검 알림 전송
  broadcastMaintenanceNotice();

  // 카운트다운이 있으면 1분마다 알림
  if (minutes > 0) {
    countdownInterval = setInterval(() => {
      const remaining = maintenanceState.shutdownAt
        ? Math.max(0, maintenanceState.shutdownAt - Date.now())
        : 0;
      const remainingMinutes = Math.ceil(remaining / 60000);

      if (remainingMinutes <= 0) {
        // 시간 종료 - 최종 알림 후 카운트다운 정리
        broadcastMaintenanceNotice();
        if (countdownInterval) {
          clearInterval(countdownInterval);
          countdownInterval = null;
        }
        return;
      }

      broadcastMaintenanceNotice();
    }, 60000); // 1분마다
  }
}

/**
 * 점검 모드 해제
 */
export function deactivateMaintenance(): void {
  maintenanceState = {
    isActive: false,
    message: '',
    scheduledAt: null,
    shutdownAt: null,
  };

  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

/**
 * 모든 접속 중인 플레이어에게 점검 알림 전송
 */
function broadcastMaintenanceNotice(): void {
  const remaining = maintenanceState.shutdownAt
    ? Math.max(0, maintenanceState.shutdownAt - Date.now())
    : null;
  const remainingMinutes = remaining !== null ? Math.ceil(remaining / 60000) : null;

  const noticeMessage = JSON.stringify({
    type: 'MAINTENANCE_NOTICE',
    message: maintenanceState.message,
    remainingMinutes,
    isActive: maintenanceState.isActive,
  });

  for (const player of players.values()) {
    if (player.ws.readyState === 1) {
      player.ws.send(noticeMessage);
    }
  }
}

/**
 * 서버 종료 시 정리
 */
export function cleanupMaintenance(): void {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}
