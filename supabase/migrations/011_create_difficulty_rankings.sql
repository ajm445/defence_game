-- 난이도별 랭킹 통합 테이블
CREATE TABLE IF NOT EXISTS difficulty_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('extreme', 'hell', 'apocalypse')),
  player_count INTEGER NOT NULL CHECK (player_count BETWEEN 1 AND 4),
  clear_time REAL NOT NULL,
  players JSONB NOT NULL,
  cleared_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 복합 인덱스: 난이도 + 플레이어 수 + 클리어 시간 정렬
CREATE INDEX idx_difficulty_rankings_lookup ON difficulty_rankings(difficulty, player_count, clear_time ASC);

-- RLS 활성화
ALTER TABLE difficulty_rankings ENABLE ROW LEVEL SECURITY;

-- 누구나 조회 가능
CREATE POLICY "Anyone can view difficulty rankings" ON difficulty_rankings FOR SELECT USING (true);

-- 서버에서 삽입 가능 (service role 사용)
CREATE POLICY "Server can insert difficulty rankings" ON difficulty_rankings FOR INSERT WITH CHECK (true);

-- 기존 extreme_rankings 데이터를 difficulty_rankings로 마이그레이션
INSERT INTO difficulty_rankings (id, difficulty, player_count, clear_time, players, cleared_at)
SELECT id, 'extreme', player_count, clear_time, players, cleared_at
FROM extreme_rankings;
