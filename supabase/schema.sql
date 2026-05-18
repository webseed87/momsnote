-- 맘스노트: 아이디만 사용 (중복 가입 불가) / 체크리스트 동기화
-- Supabase SQL Editor 에서 전체 실행

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── 체크리스트 ────────────────────────────────────
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

-- ── 아이디 계정 (1인 1아이디) ─────────────────────
CREATE TABLE IF NOT EXISTS user_accounts (
  user_id    text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- PIN 컬럼 있던 경우 제거
ALTER TABLE user_accounts DROP COLUMN IF EXISTS pin_hash;

-- ── 로그인 세션 (다른 기기에서 같은 아이디) ───────
CREATE TABLE IF NOT EXISTS user_sessions (
  token      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    text NOT NULL REFERENCES user_accounts(user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days')
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions (user_id);

ALTER TABLE checklist_states ENABLE ROW LEVEL SECURITY;
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

CREATE OR REPLACE FUNCTION _create_session(p_user_id text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token uuid;
BEGIN
  INSERT INTO user_sessions (user_id, expires_at)
  VALUES (p_user_id, now() + interval '90 days')
  RETURNING token INTO v_token;
  RETURN v_token;
END;
$$;

-- 회원가입: 아이디 중복 불가
CREATE OR REPLACE FUNCTION register_user(p_user_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token uuid;
BEGIN
  p_user_id := trim(p_user_id);
  IF length(p_user_id) < 4 THEN
    RETURN json_build_object('ok', false, 'error', 'too_short');
  END IF;
  IF EXISTS (SELECT 1 FROM user_accounts WHERE user_id = p_user_id) THEN
    RETURN json_build_object('ok', false, 'error', 'user_exists');
  END IF;
  INSERT INTO user_accounts (user_id) VALUES (p_user_id);
  v_token := _create_session(p_user_id);
  RETURN json_build_object('ok', true, 'token', v_token, 'user_id', p_user_id);
EXCEPTION WHEN unique_violation THEN
  RETURN json_build_object('ok', false, 'error', 'user_exists');
END;
$$;

-- 불러오기: 등록된 아이디만
CREATE OR REPLACE FUNCTION login_user(p_user_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token uuid;
BEGIN
  p_user_id := trim(p_user_id);
  IF length(p_user_id) < 4 THEN
    RETURN json_build_object('ok', false, 'error', 'too_short');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM user_accounts WHERE user_id = p_user_id) THEN
    RETURN json_build_object('ok', false, 'error', 'not_found');
  END IF;
  v_token := _create_session(p_user_id);
  RETURN json_build_object('ok', true, 'token', v_token, 'user_id', p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION get_checklist_by_token(p_token uuid)
RETURNS TABLE(section text, item_key text, is_done boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id text;
BEGIN
  SELECT s.user_id INTO v_user_id
  FROM user_sessions s
  WHERE s.token = p_token AND s.expires_at > now();
  IF NOT FOUND THEN RETURN; END IF;
  RETURN QUERY
  SELECT c.section, c.item_key, c.is_done
  FROM checklist_states c
  WHERE c.user_id = v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION upsert_checklist_by_token(
  p_is_done boolean,
  p_item_key text,
  p_section text,
  p_token uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id text;
BEGIN
  SELECT s.user_id INTO v_user_id
  FROM user_sessions s
  WHERE s.token = p_token AND s.expires_at > now();
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_session');
  END IF;
  INSERT INTO checklist_states (user_id, section, item_key, is_done, updated_at)
  VALUES (v_user_id, p_section, p_item_key, p_is_done, now())
  ON CONFLICT (user_id, section, item_key)
  DO UPDATE SET is_done = EXCLUDED.is_done, updated_at = now();
  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION register_user(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION login_user(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_checklist_by_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION upsert_checklist_by_token(boolean, text, text, uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
