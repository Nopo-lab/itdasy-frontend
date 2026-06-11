/* 잇비 "저장한 카드 보여줘" 인텐트 — 클라이언트 가로채기 (2026-06-12)

   문제(QA #6): "저장된 카드 보여줘" 가 백엔드로 가서 작업실만 열고,
     저장한 카드 목록/최근 저장 카드를 안 보여줌.
   해결: 채팅 전송 전에 가로채서
     1) 작업실 탭 진입(저장 카드 그리드 = 목록 노출)
     2) IndexedDB(loadSlotsFromDB)에서 저장 카드 조회 → 개수/최근 항목 채팅 안내
     3) 최근 저장 포인터(localStorage: itdasy_last_asst_save)도 함께 안내
   persistence 는 기존 IndexedDB(작업실 슬롯)·갤러리 그대로 → 새로고침 후에도 조회됨.

   외부: window.ItbiSavedCardsIntent = { classify, handle } */
(function () {
  'use strict';
  if (window.ItbiSavedCardsIntent) return;

  // "보여/불러/열/다시" 류 조회 동사
  var SHOW_RE = /(보여|보고\s*싶|불러|열어|열어줘|다시\s*보|확인|꺼내|찾아)/;
  // "저장/아까/방금/최근" 류 단서 + 대상(카드/템플릿/작업물/가격표/만든 거/결과)
  var SAVED_CUE = /(저장한|저장된|저장\s*한|저장|아까|방금|이전에|지난번|최근)/;
  // [병합QA 2026-06-12] 맨 "거"("아까 저장한 거 보여줘") 추가 — SAVED_CUE+SHOW_RE 게이트 안이라 오매칭 위험 낮음.
  var TARGET_RE = /(카드|템플릿|작업물|작업\s*물|가격표|만든\s*거|만든거|결과물|결과|디자인|이미지|사진\s*결과|거(?=\s|보|줘|를|$))/;

  // 분류: 조회 의도가 명확할 때만 true (생성 "만들어줘"는 제외 — 이건 _send 앞단 생성경로가 먼저 잡음).
  function classify(q) {
    var t = String(q || '').trim();
    if (!t) return null;
    if (/(만들|생성|작성|올려|새로|새|추가해)/.test(t) && !SAVED_CUE.test(t)) return null;  // 순수 생성 의도 제외
    if (/(저장한\s*카드|저장된\s*카드|저장한\s*템플릿|저장된\s*템플릿|저장한\s*작업물|최근\s*작업물)/.test(t)) return { matched: true };
    if (SAVED_CUE.test(t) && TARGET_RE.test(t) && SHOW_RE.test(t)) return { matched: true };
    return null;
  }

  function _openWorkshop() {
    try {
      if (typeof window.showTab === 'function') {
        window.showTab('workshop', document.querySelector('.tab-bar__btn[data-tab="workshop"]'));
        return true;
      }
    } catch (_e) { void _e; }
    try { if (typeof window.initWorkshopTab === 'function') { window.initWorkshopTab(); return true; } } catch (_e2) { void _e2; }
    return false;
  }

  async function _savedSlots() {
    try {
      if (typeof window.loadSlotsFromDB !== 'function') return [];
      var all = (await window.loadSlotsFromDB()) || [];
      return all;
    } catch (_e) { return []; }
  }

  function _lastSavePointer() {
    try {
      if (window._lastAssistantSave) return window._lastAssistantSave;
      var raw = localStorage.getItem('itdasy_last_asst_save');
      return raw ? JSON.parse(raw) : null;
    } catch (_e) { return null; }
  }

  // 반환: { reply, navigated } — app-assistant 가 채팅 말풍선으로 렌더 + 작업실 진입.
  async function handle(q) {
    if (!classify(q)) return null;
    var slots = await _savedSlots();
    var nav = _openWorkshop();
    var last = _lastSavePointer();

    if (!slots.length) {
      // DB 비었지만 최근 저장 포인터가 있으면 안내(드문 경우), 아니면 안내만.
      if (last && last.label) {
        return { reply: '작업실을 열었어요. 최근에 "' + last.label + '"를 저장했는데 목록에서 안 보이면 새로고침해 주세요.', navigated: nav };
      }
      return { reply: '아직 저장한 카드가 없어요. 가격표·후기·전후 카드를 만들고 "저장"하면 여기 작업실에 모여요.', navigated: nav };
    }

    var recent = slots[0];   // loadSlotsFromDB 는 최신순 정렬
    var recentLabel = (recent && recent.label) || (last && last.label) || '저장한 카드';
    var n = slots.length;
    return {
      reply: '작업실에 저장한 카드 ' + n + '개를 띄웠어요. 가장 최근 건 "' + recentLabel + '" 예요. 카드를 누르면 다시 편집할 수 있어요.',
      navigated: nav,
    };
  }

  window.ItbiSavedCardsIntent = { classify: classify, handle: handle };
})();
