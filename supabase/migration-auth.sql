-- 이미 예전 schema.sql (체크리스트만 있던 버전)을 실행한 경우에만 실행하세요.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS user_accounts (
  user_id    text PRIMARY KEY,
  pin_hash   text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_sessions (
  token      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    text NOT NULL REFERENCES user_accounts(user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days')
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions (user_id);

ALTER TABLE user_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_checklist" ON checklist_states;
DROP POLICY IF EXISTS "anon_insert_checklist" ON checklist_states;
DROP POLICY IF EXISTS "anon_update_checklist" ON checklist_states;
DROP POLICY IF EXISTS "anon_delete_checklist" ON checklist_states;

DROP POLICY IF EXISTS "block_anon_checklist" ON checklist_states;
DROP POLICY IF EXISTS "block_anon_accounts" ON user_accounts;
DROP POLICY IF EXISTS "block_anon_sessions" ON user_sessions;

CREATE POLICY "block_anon_checklist" ON checklist_states FOR ALL TO anon USING (false);
CREATE POLICY "block_anon_accounts" ON user_accounts FOR ALL TO anon USING (false);
CREATE POLICY "block_anon_sessions" ON user_sessions FOR ALL TO anon USING (false);

-- 이어서 supabase/schema.sql 전체를 다시 실행하세요 (함수·RLS 갱신, CREATE OR REPLACE 사용).
