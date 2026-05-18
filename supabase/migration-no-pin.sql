-- PIN 제거 + 아이디만 사용 (기존 DB에 한 번 실행)
-- schema.sql 전체 실행해도 됩니다.

ALTER TABLE user_accounts DROP COLUMN IF EXISTS pin_hash;

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

GRANT EXECUTE ON FUNCTION register_user(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION login_user(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
