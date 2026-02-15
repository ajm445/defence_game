-- 유저 피드백/별점 테이블
CREATE TABLE IF NOT EXISTS user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(player_id)  -- 계정당 1회
);

CREATE INDEX idx_user_feedback_player ON user_feedback(player_id);
CREATE INDEX idx_user_feedback_rating ON user_feedback(rating);

ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view feedback" ON user_feedback FOR SELECT USING (true);
CREATE POLICY "Server can insert feedback" ON user_feedback FOR INSERT WITH CHECK (true);
CREATE POLICY "Server can update feedback" ON user_feedback FOR UPDATE USING (true);

CREATE TRIGGER update_user_feedback_updated_at
  BEFORE UPDATE ON user_feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
