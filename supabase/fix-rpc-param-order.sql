-- register_user 오류 수정용: SQL Editor 에서 실행 후 회원가입 다시 시도

CREATE OR REPLACE FUNCTION register_user(p_pin text, p_user_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token uuid;
BEGIN
  p_user_id := trim(p_user_id);
  IF length(p_user_id) < 4 OR length(p_pin) < 4 THEN
    RETURN json_build_object('ok', false, 'error', 'too_short');
  END IF;
  IF EXISTS (SELECT 1 FROM user_accounts WHERE user_id = p_user_id) THEN
    RETURN json_build_object('ok', false, 'error', 'user_exists');
  END IF;
  INSERT INTO user_accounts (user_id, pin_hash)
  VALUES (p_user_id, crypt(p_pin, gen_salt('bf')));
  v_token := _create_session(p_user_id);
  RETURN json_build_object('ok', true, 'token', v_token, 'user_id', p_user_id);
EXCEPTION WHEN unique_violation THEN
  RETURN json_build_object('ok', false, 'error', 'user_exists');
END;
$$;

CREATE OR REPLACE FUNCTION login_user(p_pin text, p_user_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
  v_token uuid;
BEGIN
  p_user_id := trim(p_user_id);
  SELECT pin_hash INTO v_hash FROM user_accounts WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_hash IS DISTINCT FROM crypt(p_pin, v_hash) THEN
    RETURN json_build_object('ok', false, 'error', 'wrong_pin');
  END IF;
  v_token := _create_session(p_user_id);
  RETURN json_build_object('ok', true, 'token', v_token, 'user_id', p_user_id);
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

NOTIFY pgrst, 'reload schema';
