-- 극한 난이도 랭킹 테이블
CREATE TABLE IF NOT EXISTS extreme_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_count INTEGER NOT NULL CHECK (player_count BETWEEN 1 AND 4),
  clear_time REAL NOT NULL,
  players JSONB NOT NULL,
  cleared_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- players JSONB 예시:
-- [{ "playerId": "uuid", "nickname": "닉네임", "heroClass": "archer", "advancedClass": "sniper", "characterLevel": 40 }]

-- 인덱스 생성
CREATE INDEX idx_extreme_rankings_player_count ON extreme_rankings(player_count);
CREATE INDEX idx_extreme_rankings_clear_time ON extreme_rankings(player_count, clear_time ASC);

-- RLS 활성화
ALTER TABLE extreme_rankings ENABLE ROW LEVEL SECURITY;

-- 누구나 조회 가능
CREATE POLICY "Anyone can view extreme rankings" ON extreme_rankings FOR SELECT USING (true);

-- 서버에서 삽입 가능 (service role 사용)
CREATE POLICY "Server can insert extreme rankings" ON extreme_rankings FOR INSERT WITH CHECK (true);
