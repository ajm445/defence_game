-- 전직 시스템을 위한 class_progress 테이블 컬럼 추가

-- advanced_class: 전직 직업 (버서커, 가디언, 스나이퍼, 레인저, 성기사, 다크나이트, 아크메이지, 힐러)
-- tier: 전직 단계 (1: 1차 전직, 2: 2차 강화)

ALTER TABLE class_progress
ADD COLUMN IF NOT EXISTS advanced_class TEXT DEFAULT NULL;

ALTER TABLE class_progress
ADD COLUMN IF NOT EXISTS tier INTEGER DEFAULT NULL CHECK (tier IS NULL OR tier IN (1, 2));

-- 유효한 advanced_class 값 체크 (NULL 또는 특정 값만 허용)
-- 주의: CHECK 제약 조건 추가 시 기존 데이터가 있으면 실패할 수 있음
ALTER TABLE class_progress
ADD CONSTRAINT valid_advanced_class CHECK (
  advanced_class IS NULL OR
  advanced_class IN (
    'berserker',   -- 전사 → 버서커
    'guardian',    -- 전사 → 가디언
    'sniper',      -- 궁수 → 스나이퍼
    'ranger',      -- 궁수 → 레인저
    'paladin',     -- 기사 → 성기사
    'darkKnight',  -- 기사 → 다크나이트
    'archmage',    -- 마법사 → 아크메이지
    'healer'       -- 마법사 → 힐러
  )
);

-- advanced_class와 tier는 함께 존재하거나 함께 NULL이어야 함
ALTER TABLE class_progress
ADD CONSTRAINT tier_requires_advanced_class CHECK (
  (advanced_class IS NULL AND tier IS NULL) OR
  (advanced_class IS NOT NULL AND tier IS NOT NULL)
);

-- 코멘트 추가
COMMENT ON COLUMN class_progress.advanced_class IS '전직 직업 (1차 전직 시 설정)';
COMMENT ON COLUMN class_progress.tier IS '전직 단계 (1: 1차 전직, 2: 2차 강화)';
