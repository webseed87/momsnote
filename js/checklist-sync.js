/**
 * 아이디 + PIN 회원가입 / 로그인 후 체크리스트 동기화
 */
const ChecklistSync = (function () {
  const STORAGE_USER = 'momsnote_user_id';
  const STORAGE_TOKEN = 'momsnote_session_token';
  let sessionToken = null;
  let userId = null;
  let saveTimer = null;

  const ERR_MSG = {
    too_short: '아이디와 PIN은 4글자 이상이어야 해요.',
    user_exists: '이미 사용 중인 아이디예요. 다른 아이디를 쓰거나 로그인해 주세요.',
    not_found: '등록되지 않은 아이디예요. 회원가입을 먼저 해 주세요.',
    wrong_pin: 'PIN이 맞지 않아요.',
    invalid_session: '로그인이 만료됐어요. 다시 로그인해 주세요.',
  };

  function getClient() {
    return window.supabaseClient || null;
  }

  function getToken() {
    return sessionToken || localStorage.getItem(STORAGE_TOKEN) || '';
  }

  function getUserId() {
    return userId || localStorage.getItem(STORAGE_USER) || '';
  }

  function setSession(token, uid) {
    sessionToken = token;
    userId = uid;
    localStorage.setItem(STORAGE_TOKEN, token);
    localStorage.setItem(STORAGE_USER, uid);
    updateAuthUI();
  }

  function clearSession() {
    sessionToken = null;
    userId = null;
    localStorage.removeItem(STORAGE_TOKEN);
    localStorage.removeItem(STORAGE_USER);
    updateAuthUI();
  }

  function getCheckMeta(el) {
    const sectionEl = el.closest('.section');
    const section = sectionEl?.id || 'unknown';
    let itemKey = '';

    if (el.classList.contains('item-check')) {
      const row = el.closest('tr');
      itemKey = row?.cells[1]?.textContent?.trim() || '';
    } else if (el.classList.contains('check-icon')) {
      const li = el.closest('li');
      const strong = li?.querySelector('strong');
      itemKey = strong?.textContent?.trim() || li?.querySelector('.check-text')?.textContent?.trim().slice(0, 80) || '';
    }

    return { section, itemKey: itemKey.replace(/\s+/g, ' ') };
  }

  function applyChecked(el, isDone) {
    if (el.classList.contains('item-check')) {
      el.checked = !!isDone;
    } else if (el.classList.contains('check-icon')) {
      el.classList.toggle('done', !!isDone);
      const li = el.closest('li');
      if (li) li.classList.toggle('done-item', !!isDone);
    }
  }

  async function loadAll() {
    const client = getClient();
    const token = getToken();
    if (!client || !token) return false;

    const { data, error } = await client.rpc('get_checklist_by_token', { p_token: token });

    if (error) {
      console.error('불러오기 실패:', error.message);
      return false;
    }

    if (data === null || (Array.isArray(data) && data.length === 0 && !getUserId())) {
      return true;
    }

    const map = new Map();
    (data || []).forEach((row) => {
      map.set(`${row.section}::${row.item_key}`, row.is_done);
    });

    document.querySelectorAll('.item-check, .check-icon').forEach((el) => {
      const { section, itemKey } = getCheckMeta(el);
      if (!itemKey) return;
      const key = `${section}::${itemKey}`;
      if (map.has(key)) applyChecked(el, map.get(key));
    });
    return true;
  }

  async function saveOne(el, isDone) {
    const client = getClient();
    const token = getToken();
    if (!client || !token) return;

    const { section, itemKey } = getCheckMeta(el);
    if (!itemKey) return;

    const { data, error } = await client.rpc('upsert_checklist_by_token', {
      p_token: token,
      p_section: section,
      p_item_key: itemKey,
      p_is_done: !!isDone,
    });

    if (error) {
      console.error('저장 실패:', error.message);
      return;
    }
    if (data && !data.ok && data.error === 'invalid_session') {
      alert(ERR_MSG.invalid_session);
      clearSession();
    }
  }

  function scheduleSave(el, isDone) {
    if (!getToken()) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveOne(el, isDone), 400);
  }

  function bindCheckboxes() {
    document.querySelectorAll('.item-check').forEach((input) => {
      if (input.dataset.syncBound) return;
      input.dataset.syncBound = '1';
      input.addEventListener('change', () => scheduleSave(input, input.checked));
    });

    document.querySelectorAll('.check-icon').forEach((icon) => {
      if (icon.dataset.syncBound) return;
      icon.dataset.syncBound = '1';
      icon.addEventListener('click', () => {
        setTimeout(() => scheduleSave(icon, icon.classList.contains('done')), 0);
      });
    });
  }

  function updateAuthUI() {
    const label = document.getElementById('user-id-label');
    const loggedIn = !!getToken();
    if (label) {
      label.textContent = loggedIn ? `로그인: ${getUserId()}` : '로그인이 필요해요';
    }
    document.getElementById('auth-form')?.classList.toggle('hidden', loggedIn);
    document.getElementById('auth-logged-in')?.classList.toggle('hidden', !loggedIn);
  }

  async function register() {
    const client = getClient();
    const id = document.getElementById('user-id-input')?.value?.trim();
    const pin = document.getElementById('user-pin-input')?.value || '';
    if (!client) return;
    if (!id || pin.length < 4) {
      alert(ERR_MSG.too_short);
      return;
    }

    const { data, error } = await client.rpc('register_user', {
      p_user_id: id,
      p_pin: pin,
    });

    if (error) {
      alert('회원가입 실패: ' + error.message);
      return;
    }
    if (!data?.ok) {
      alert(ERR_MSG[data.error] || '회원가입에 실패했어요.');
      return;
    }

    setSession(data.token, data.user_id);
    bindCheckboxes();
    await loadAll();
    alert('회원가입 완료! 체크 내용이 이 아이디에 저장돼요.');
  }

  async function login() {
    const client = getClient();
    const id = document.getElementById('user-id-input')?.value?.trim();
    const pin = document.getElementById('user-pin-input')?.value || '';
    if (!client) return;
    if (!id || pin.length < 4) {
      alert(ERR_MSG.too_short);
      return;
    }

    const { data, error } = await client.rpc('login_user', {
      p_user_id: id,
      p_pin: pin,
    });

    if (error) {
      alert('로그인 실패: ' + error.message);
      return;
    }
    if (!data?.ok) {
      alert(ERR_MSG[data.error] || '로그인에 실패했어요.');
      return;
    }

    setSession(data.token, data.user_id);
    bindCheckboxes();
    await loadAll();
    alert('로그인했어요. 저장된 체크를 불러왔습니다.');
  }

  function logout() {
    clearSession();
    alert('로그아웃했어요.');
  }

  function initAuthUI() {
    document.getElementById('user-register')?.addEventListener('click', register);
    document.getElementById('user-login')?.addEventListener('click', login);
    document.getElementById('user-logout')?.addEventListener('click', logout);

    const savedToken = localStorage.getItem(STORAGE_TOKEN);
    const savedUser = localStorage.getItem(STORAGE_USER);
    if (savedToken && savedUser) {
      sessionToken = savedToken;
      userId = savedUser;
    }
    updateAuthUI();
  }

  async function init() {
    initAuthUI();
    bindCheckboxes();
    if (getToken() && getClient()) {
      const ok = await loadAll();
      if (!ok && getToken()) {
        /* 세션 만료 시 데이터 없음 — 토큰 유지하고 빈 목록으로 시작 */
      }
    }
  }

  return { init, loadAll, logout, getUserId };
})();

document.addEventListener('DOMContentLoaded', () => {
  if (window.supabaseClient) ChecklistSync.init();
  else console.warn('Supabase 연결 후 체크리스트 동기화가 활성화됩니다.');
});
