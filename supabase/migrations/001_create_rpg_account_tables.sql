-- RPG 모드 계정 시스템 테이블 생성

-- 1. player_profiles 테이블: 플레이어 기본 프로필
CREATE TABLE IF NOT EXISTS player_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  player_level INTEGER DEFAULT 1,
  player_exp INTEGER DEFAULT 0,
  is_guest BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. class_progress 테이블: 클래스별 진행 상황
CREATE TABLE IF NOT EXISTS class_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES player_profiles(id) ON DELETE CASCADE,
  class_name TEXT NOT NULL CHECK (class_name IN ('archer', 'warrior', 'knight', 'mage')),
  class_level INTEGER DEFAULT 1,
  class_exp INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(player_id, class_name)
);

-- 3. game_history 테이블: 게임 기록
CREATE TABLE IF NOT EXISTS game_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES player_profiles(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('single', 'coop')),
  class_used TEXT NOT NULL CHECK (class_used IN ('archer', 'warrior', 'knight', 'mage')),
  wave_reached INTEGER NOT NULL,
  kills INTEGER NOT NULL,
  play_time REAL NOT NULL,
  victory BOOLEAN NOT NULL,
  exp_earned INTEGER NOT NULL,
  played_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_class_progress_player_id ON class_progress(player_id);
CREATE INDEX IF NOT EXISTS idx_game_history_player_id ON game_history(player_id);
CREATE INDEX IF NOT EXISTS idx_game_history_played_at ON game_history(played_at DESC);

-- RLS (Row Level Security) 정책 설정
ALTER TABLE player_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_history ENABLE ROW LEVEL SECURITY;

-- player_profiles 정책: 자신의 프로필만 읽기/쓰기 가능
CREATE POLICY "Users can view their own profile"
  ON player_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON player_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON player_profiles FOR UPDATE
  USING (auth.uid() = id);

-- class_progress 정책: 자신의 클래스 진행 상황만 읽기/쓰기 가능
CREATE POLICY "Users can view their own class progress"
  ON class_progress FOR SELECT
  USING (auth.uid() = player_id);

CREATE POLICY "Users can insert their own class progress"
  ON class_progress FOR INSERT
  WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Users can update their own class progress"
  ON class_progress FOR UPDATE
  USING (auth.uid() = player_id);

-- game_history 정책: 자신의 게임 기록만 읽기/쓰기 가능
CREATE POLICY "Users can view their own game history"
  ON game_history FOR SELECT
  USING (auth.uid() = player_id);

CREATE POLICY "Users can insert their own game history"
  ON game_history FOR INSERT
  WITH CHECK (auth.uid() = player_id);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_player_profiles_updated_at
  BEFORE UPDATE ON player_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_class_progress_updated_at
  BEFORE UPDATE ON class_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
