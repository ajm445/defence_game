-- Friends System Tables

-- 1. friends 테이블: 친구 관계 (양방향)
CREATE TABLE IF NOT EXISTS friends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- 2. friend_requests 테이블: 친구 요청
CREATE TABLE IF NOT EXISTS friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  responded_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(from_user_id, to_user_id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_friends_user_id ON friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON friends(friend_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_to_user ON friend_requests(to_user_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_requests_from_user ON friend_requests(from_user_id);

-- RLS (Row Level Security) 정책

-- friends 테이블 RLS
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 친구 목록만 조회 가능
CREATE POLICY friends_select_policy ON friends
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- 사용자는 자신이 포함된 친구 관계만 삭제 가능
CREATE POLICY friends_delete_policy ON friends
  FOR DELETE USING (auth.uid() = user_id);

-- 서비스 역할로만 삽입/업데이트 가능 (서버에서 처리)
CREATE POLICY friends_insert_policy ON friends
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- friend_requests 테이블 RLS
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신이 보낸/받은 요청만 조회 가능
CREATE POLICY friend_requests_select_policy ON friend_requests
  FOR SELECT USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- 사용자는 자신이 요청을 보낼 수 있음
CREATE POLICY friend_requests_insert_policy ON friend_requests
  FOR INSERT WITH CHECK (auth.uid() = from_user_id);

-- 받은 사용자만 요청 상태 업데이트 가능
CREATE POLICY friend_requests_update_policy ON friend_requests
  FOR UPDATE USING (auth.uid() = to_user_id);

-- 보낸 사용자는 요청 취소 가능 (삭제)
CREATE POLICY friend_requests_delete_policy ON friend_requests
  FOR DELETE USING (auth.uid() = from_user_id);
