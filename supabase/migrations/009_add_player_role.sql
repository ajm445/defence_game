-- 플레이어 역할 추가 (VIP 시스템)

-- player_profiles 테이블에 role 컬럼 추가
-- 기본값: 'player', VIP의 경우: 'vip'
ALTER TABLE player_profiles
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'player' CHECK (role IN ('player', 'vip'));

-- 인덱스 생성 (역할별 플레이어 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_player_profiles_role ON player_profiles(role);

-- 코멘트 추가
COMMENT ON COLUMN player_profiles.role IS '플레이어 역할: player(일반), vip(VIP - 경험치 2배)';
