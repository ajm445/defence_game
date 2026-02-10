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
};

export function cleanupPlayerRateLimits(playerId: string): void {
  Object.values(rateLimiters).forEach(rl => rl.remove(playerId));
}
