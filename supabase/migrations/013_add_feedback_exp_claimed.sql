-- 피드백 EXP 보상 수령 여부 추적 (관리자가 피드백 삭제해도 중복 보상 방지)
ALTER TABLE player_profiles
ADD COLUMN IF NOT EXISTS feedback_exp_claimed BOOLEAN DEFAULT FALSE;
