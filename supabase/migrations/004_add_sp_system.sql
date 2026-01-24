-- SP 시스템 컬럼 추가

-- class_progress 테이블에 SP 및 스탯 업그레이드 컬럼 추가
ALTER TABLE class_progress
ADD COLUMN IF NOT EXISTS sp INTEGER DEFAULT 0;

ALTER TABLE class_progress
ADD COLUMN IF NOT EXISTS stat_upgrades JSONB DEFAULT '{"attack": 0, "speed": 0, "hp": 0, "attackSpeed": 0, "range": 0, "hpRegen": 0}'::jsonb;

-- 기존 데이터에 대해 기본값 설정
UPDATE class_progress
SET sp = 0
WHERE sp IS NULL;

UPDATE class_progress
SET stat_upgrades = '{"attack": 0, "speed": 0, "hp": 0, "attackSpeed": 0, "range": 0, "hpRegen": 0}'::jsonb
WHERE stat_upgrades IS NULL;
