-- Admin System Tables

-- 1. admin_accounts 테이블: 관리자 계정
CREATE TABLE IF NOT EXISTS admin_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  nickname VARCHAR(50) NOT NULL,
  role VARCHAR(20) DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. player_bans 테이블: 밴 기록
CREATE TABLE IF NOT EXISTS player_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  banned_by UUID REFERENCES admin_accounts(id),
  reason TEXT NOT NULL,
  banned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,  -- NULL = 영구밴
  unbanned_at TIMESTAMP WITH TIME ZONE,
  unbanned_by UUID REFERENCES admin_accounts(id),
  is_active BOOLEAN DEFAULT true
);

-- 3. admin_activity_logs 테이블: 활동 로그
CREATE TABLE IF NOT EXISTS admin_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admin_accounts(id),
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id UUID,
  details JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. player_profiles 테이블에 밴 관련 컬럼 추가
ALTER TABLE player_profiles
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS banned_until TIMESTAMP WITH TIME ZONE;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_admin_accounts_username ON admin_accounts(username);
CREATE INDEX IF NOT EXISTS idx_player_bans_player_id ON player_bans(player_id);
CREATE INDEX IF NOT EXISTS idx_player_bans_is_active ON player_bans(is_active);
CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_admin_id ON admin_activity_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_created_at ON admin_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_player_profiles_nickname ON player_profiles(nickname);
CREATE INDEX IF NOT EXISTS idx_player_profiles_is_banned ON player_profiles(is_banned);

-- updated_at 트리거 for admin_accounts
CREATE TRIGGER update_admin_accounts_updated_at
  BEFORE UPDATE ON admin_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 기본 super_admin 계정 생성 (비밀번호: admin123 - bcrypt hash)
-- 실제 운영 환경에서는 반드시 비밀번호 변경 필요
INSERT INTO admin_accounts (username, password_hash, nickname, role)
VALUES ('admin', '$2b$10$/geePS41PEcewkXT4M7HbOY3KCYpe66xsp.rHoKvnHDiJhpG2LfIe', 'Super Admin', 'super_admin')
ON CONFLICT (username) DO NOTHING;
