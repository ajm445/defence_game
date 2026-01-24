-- 테스트 계정 데이터 설정

-- 1. 플레이어 레벨 10으로 설정
UPDATE player_profiles
SET player_level = 10, player_exp = 0
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'test@defence.game'
);

-- 2. 궁수 클래스 레벨 10으로 설정 (SP도 10 지급)
INSERT INTO class_progress (player_id, class_name, class_level, class_exp, sp, stat_upgrades)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'test@defence.game'),
  'archer',
  10,
  0,
  10,
  '{"attack": 0, "speed": 0, "hp": 0, "attackSpeed": 0, "range": 0, "hpRegen": 0}'::jsonb
)
ON CONFLICT (player_id, class_name)
DO UPDATE SET
  class_level = 10,
  class_exp = 0,
  sp = 10,
  stat_upgrades = '{"attack": 0, "speed": 0, "hp": 0, "attackSpeed": 0, "range": 0, "hpRegen": 0}'::jsonb;
