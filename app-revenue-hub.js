/* ─────────────────────────────────────────────────────────────
   app-revenue-hub.js — [죽은코드 정리 2026-07-27]
   옛 매출 관리 화면(#revenue-hub-overlay: 입력바·쌓기 배치저장·엑셀 임포트·리포트·인라인 CRUD)은
   v195/v196 에서 v6 대시보드(openRevenue, app-revenue.js)로 일원화됐다. 그 뒤로 어떤 경로로도
   hub 오버레이가 생성되지 않아 렌더/fetch/state/resize ~500줄이 실행 불가능한 죽은 코드였다.
   공개 진입점(openRevenueHub/openRevenueInput/closeRevenueHub/RevenueHub)은 드로어·대시보드·
   complete-flow 가 참조하므로, 실동작에 위임하는 얇은 별칭만 남긴다.
   ──────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  function _openRevenue() {
    if (typeof window.openRevenue === 'function') return window.openRevenue();
    if (typeof window.showToast === 'function') window.showToast('매출 화면을 불러오지 못했어요');
  }

  // 옛 list-only 진입 → v6 대시보드로 일원화.
  window.openRevenueHub   = _openRevenue;
  window.openRevenueInput = _openRevenue;

  window.closeRevenueHub  = function () {
    // 옛 오버레이는 더 이상 생성되지 않으므로 정리할 DOM 은 없다. sheet 등록만 해제(뒤로가기 정합성).
    try { if (typeof window._markSheetClosed === 'function') window._markSheetClosed('revenuehub'); } catch (_e) { void _e; }
  };

  // complete-flow 등이 완료 후 매출 갱신용으로 호출. v6 화면은 itdasy:data-changed 를 구독(app-revenue.js)
  //   하므로 이벤트만 쏴서 새로고침을 위임한다(옛 자체 fetch/render 제거).
  window.RevenueHub = {
    refresh: () => {
      try { window.dispatchEvent(new CustomEvent('itdasy:data-changed', { detail: { kind: 'revenue' } })); }
      catch (_e) { void _e; }
    },
    focusInput: () => {},
  };
})();
