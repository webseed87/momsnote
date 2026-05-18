/**
 * 아이디(user_id)별 체크리스트 Supabase 동기화
 */
const ChecklistSync = (function () {
  const STORAGE_KEY = 'momsnote_user_id';
  let userId = null;
  let saveTimer = null;

  function getClient() {
    return window.supabaseClient || null;
  }

  function getUserId() {
    return userId || localStorage.getItem(STORAGE_KEY) || '';
  }

  function setUserId(id) {
    const trimmed = (id || '').trim();
    if (trimmed.length < 4) {
      alert('아이디는 4글자 이상으로 입력해 주세요.');
      return false;
    }
    userId = trimmed;
    localStorage.setItem(STORAGE_KEY, trimmed);
    updateUserIdUI();
    return true;
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
    const uid = getUserId();
    if (!client || !uid) return;

    const { data, error } = await client
      .from('checklist_states')
      .select('section, item_key, is_done')
      .eq('user_id', uid);

    if (error) {
      console.error('체크리스트 불러오기 실패:', error.message);
      return;
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
  }

  async function saveOne(el, isDone) {
    const client = getClient();
    const uid = getUserId();
    if (!client || !uid) return;

    const { section, itemKey } = getCheckMeta(el);
    if (!itemKey) return;

    const { error } = await client.from('checklist_states').upsert(
      {
        user_id: uid,
        section,
        item_key: itemKey,
        is_done: !!isDone,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,section,item_key' }
    );

    if (error) console.error('저장 실패:', error.message);
  }

  function scheduleSave(el, isDone) {
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

  function updateUserIdUI() {
    const label = document.getElementById('user-id-label');
    const input = document.getElementById('user-id-input');
    const uid = getUserId();
    if (label) label.textContent = uid ? `아이디: ${uid}` : '아이디 미설정';
    if (input && uid) input.value = uid;
  }

  function initUserIdUI() {
    const bar = document.getElementById('user-id-bar');
    const input = document.getElementById('user-id-input');
    const saveBtn = document.getElementById('user-id-save');
    const loadBtn = document.getElementById('user-id-load');

    if (!bar) return;

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) userId = saved;
    updateUserIdUI();

    saveBtn?.addEventListener('click', async () => {
      if (!setUserId(input?.value)) return;
      bindCheckboxes();
      await loadAll();
      alert('아이디가 저장되었어요. 체크 내용을 불러왔습니다.');
    });

    loadBtn?.addEventListener('click', async () => {
      if (!getUserId() && input?.value) setUserId(input.value);
      if (!getUserId()) {
        alert('아이디를 먼저 입력해 주세요.');
        return;
      }
      await loadAll();
      alert('체크리스트를 불러왔어요.');
    });

    if (!saved) bar.classList.add('user-id-bar--prompt');
  }

  async function init() {
    initUserIdUI();
    bindCheckboxes();
    if (getUserId() && getClient()) await loadAll();
  }

  return { init, loadAll, setUserId, getUserId };
})();

document.addEventListener('DOMContentLoaded', () => {
  if (window.supabaseClient) ChecklistSync.init();
  else console.warn('Supabase 연결 후 체크리스트 동기화가 활성화됩니다.');
});
