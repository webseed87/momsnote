// Supabase 클라이언트 초기화
(function () {
  if (!window.supabase) {
    console.error('Supabase JS 라이브러리가 로드되지 않았습니다.');
    return;
  }
  if (!window.SUPABASE_URL || !window.SUPABASE_KEY) {
    console.warn('Supabase 설정이 없습니다. js/supabase-config.js 파일을 확인하세요.');
    return;
  }

  window.supabaseClient = window.supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_KEY
  );
})();
