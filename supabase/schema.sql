-- Supabase SQL Editor 에서 한 번 실행하세요.
-- 아이디(user_id)별로 체크리스트 저장

CREATE TABLE IF NOT EXISTS checklist_states (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    text NOT NULL,
  section    text NOT NULL,
  item_key   text NOT NULL,
  is_done    boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, section, item_key)
);

CREATE INDEX IF NOT EXISTS idx_checklist_user ON checklist_states (user_id);

ALTER TABLE checklist_states ENABLE ROW LEVEL SECURITY;

-- anon(웹)에서 읽기/쓰기 허용 (앱에서 user_id 로 필터링)
-- 보안: 아이디를 추측하기 어렵게 길게 쓰세요 (예: myohan-x7k2p9m3)
CREATE POLICY "anon_select_checklist"
  ON checklist_states FOR SELECT TO anon
  USING (true);

CREATE POLICY "anon_insert_checklist"
  ON checklist_states FOR INSERT TO anon
  WITH CHECK (char_length(user_id) >= 4);

CREATE POLICY "anon_update_checklist"
  ON checklist_states FOR UPDATE TO anon
  USING (true)
  WITH CHECK (char_length(user_id) >= 4);

CREATE POLICY "anon_delete_checklist"
  ON checklist_states FOR DELETE TO anon
  USING (true);
