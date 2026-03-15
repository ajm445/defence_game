/**
 * 플레이어별 Rate Limiter
 * 악의적 패킷 스팸을 방지하면서 정상 플레이에는 영향 없도록 설계
 */
export class RateLimiter {
  private lastActionTime = new Map<string, number>();

  constructor(private minInterval: number) {}

  /**
   * rate limit 체크 후 통과 시 타임스탬프 업데이트
   * @returns true면 통과, false면 제한됨
   */
  checkAndUpdate(playerId: string): boolean {
    const now = Date.now();
    const last = this.lastActionTime.get(playerId);
    if (last !== undefined && now - last < this.minInterval) {
      return false;
    }
    this.lastActionTime.set(playerId, now);
    return true;
  }

  remove(playerId: string): void {
    this.lastActionTime.delete(playerId);
  }
}

export const rateLimiters = {
  move: new RateLimiter(15),          // COOP_HERO_MOVE (33ms 브로드캐스트 절반)
  playerInput: new RateLimiter(15),   // PLAYER_INPUT
  skill: new RateLimiter(100),        // COOP_USE_SKILL (쿨다운 있으므로 느슨)
  upgrade: new RateLimiter(200),      // 업그레이드 연타 방지
  roomCreate: new RateLimiter(3000),  // 방 생성 스팸 방지
  roomJoin: new RateLimiter(1000),    // 방 참가 스팸 방지
  // DB/소셜/채팅 속도 제한
  login: new RateLimiter(5000),           // 로그인 (5초 간격)
  friendsList: new RateLimiter(200),      // 친구 목록 조회 (초당 5회)
  onlinePlayers: new RateLimiter(200),    // 온라인 플레이어 조회 (초당 5회)
  dmHistory: new RateLimiter(200),        // DM 히스토리 조회 (초당 5회)
  serverStatus: new RateLimiter(200),     // 서버 상태 조회 (초당 5회)
  socialAction: new RateLimiter(1000),    // 친구 요청/삭제 등 (1초 간격)
  dm: new RateLimiter(500),               // DM 전송 (500ms 간격)
  lobbyChat: new RateLimiter(500),        // 로비 채팅 (500ms 간격)
  modeChange: new RateLimiter(1000),      // 모드 변경 (1초 간격)
  roomList: new RateLimiter(500),         // 방 목록 조회 (500ms 간격)
  adminAuth: new RateLimiter(3000),       // 관리자 인증 (3초 간격)
};

export function cleanupPlayerRateLimits(playerId: string): void {
  Object.values(rateLimiters).forEach(rl => rl.remove(playerId));
}
