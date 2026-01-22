-- 사운드 설정 컬럼 추가

-- player_profiles 테이블에 사운드 설정 컬럼 추가
ALTER TABLE player_profiles
ADD COLUMN IF NOT EXISTS sound_volume REAL DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS sound_muted BOOLEAN DEFAULT FALSE;

-- 기존 데이터에 기본값 설정
UPDATE player_profiles
SET sound_volume = 0.5, sound_muted = FALSE
WHERE sound_volume IS NULL OR sound_muted IS NULL;
