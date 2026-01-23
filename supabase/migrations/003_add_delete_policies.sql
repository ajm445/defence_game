-- DELETE RLS 정책 추가

-- player_profiles DELETE 정책: 자신의 프로필만 삭제 가능
CREATE POLICY "Users can delete their own profile"
  ON player_profiles FOR DELETE
  USING (auth.uid() = id);

-- class_progress DELETE 정책: 자신의 클래스 진행 상황만 삭제 가능
CREATE POLICY "Users can delete their own class progress"
  ON class_progress FOR DELETE
  USING (auth.uid() = player_id);

-- game_history DELETE 정책: 자신의 게임 기록만 삭제 가능
CREATE POLICY "Users can delete their own game history"
  ON game_history FOR DELETE
  USING (auth.uid() = player_id);
