/* [2026-05-04] 사이드바 통합 핸들러
   - 사이드바 .ms-side__item 클릭 시 현재 열린 hub 자동 종료 → 새 hub 열기
   - 클릭한 항목에 .is-active 표시 (홈/내샵관리 패턴 동일)
   - 의도: 4개 관리화면 전환을 홈↔내샵관리 처럼 매끄럽게 */
(function () {
  'use strict';

  function _closeAllHubs() {
    // [2026-05-04] SheetAnim.close 의 220ms setTimeout 이 재오픈 직후 display:none 으로
    // 덮어쓰는 race condition 회피 — 직접 display 조작.
    ['aiHubSheet', 'settingsHubSheet', 'planPopup', 'supportChatModal'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.style.display = 'none';
        el.style.opacity = '';
        el.style.transition = '';
      }
      const card = el?.querySelector('#aihCard, #shCard');
      if (card) {
        card.style.transition = '';
        card.style.transform = '';
        card.style.opacity = '';
      }
    });
    // 운영 hub 들 — overlay 요소 제거 (#genericSheet 도 .hub-overlay 라 같이 제거됨)
    document.querySelectorAll('.hub-overlay, .hub-backdrop').forEach(el => el.remove());
    try { window.closeSheet?.(); } catch (_e) { void _e; }
    // navSheet 직접 닫기 — closeNavSheet 의 280ms setTimeout race condition 회피
    const ns = document.getElementById('navSheet');
    if (ns) {
      ns.style.display = 'none';
      const nsInner = document.getElementById('navSheetInner');
      if (nsInner) {
        nsInner.style.transform = '';
        nsInner.style.transition = '';
      }
    }
    const rs = document.getElementById('revenueSheet');
    if (rs) rs.style.display = 'none';
    document.body.classList.remove('rv-mode');
    document.body.style.overflow = '';
    const co = document.getElementById('cal-overlay');
    if (co) co.remove();
    // [v215] 고객 v4 시트들도 함께 닫기 (사이드바 이동 시 잔존 방지)
    try { window.closeCustomers?.(); } catch (_e) { void _e; }
    try { window.closeCustomerDashboard?.(); } catch (_e) { void _e; }
    const cs = document.getElementById('customerSheet');
    if (cs) cs.style.display = 'none';
    const cds = document.getElementById('customerDashSheet');
    if (cds) cds.style.display = 'none';
    // popstate 관리용 sheet-closed 신호
    ['customers', 'inventory', 'revenue', 'booking', 'revenuehub', 'aihub', 'settingshub', 'nav'].forEach(k => {
      try { window._markSheetClosed?.(k); } catch (_e) { void _e; }
    });
  }
  window._closeAllHubs = _closeAllHubs;

  function _markActive(btn) {
    document.querySelectorAll('.ms-side__item').forEach(b => b.classList.remove('is-active'));
    if (btn) btn.classList.add('is-active');
  }

  // capture: true → inline onclick 이전에 실행되어 기존 hub 먼저 종료
  document.addEventListener('click', function (ev) {
    const btn = ev.target && ev.target.closest && ev.target.closest('.ms-side__item, .ms-side__fab');
    if (!btn) return;
    // 홈/내샵관리는 showTab 이 자체 처리하므로 close 만 호출 (열린 hub 닫고 탭 노출).
    // 만들기(.ms-side__fab) 도 다른 hub 자동 종료 → 새 navSheet 깔끔히 표시.
    _closeAllHubs();
    if (btn.classList.contains('ms-side__item')) _markActive(btn);
  }, true);

  // [2026-06-11 QA] 시트(허브)를 X/뒤로가기로 닫으면 화면은 홈인데 사이드바 활성 표시가
  //   직전 메뉴(설정·연동 등)에 남던 버그 — 시트가 모두 닫힌 시점에 실제 보이는 탭으로 복원.
  function _resyncActive() {
    const openIds = ['revenueSheet', 'customerSheet', 'customerDashSheet', 'cal-overlay',
      'settingsHubSheet', 'aiHubSheet', 'inventorySheet', 'dmConvSheet', 'navSheet', 'assistantSheet'];
    const anyOpen = openIds.some((id) => {
      const el = document.getElementById(id);
      return el && el.style.display !== 'none' && el.offsetParent !== null;
    });
    if (anyOpen) return; // 아직 다른 시트가 떠 있으면 유지
    const tabKey = document.getElementById('tab-dashboard')?.classList.contains('active') ? 'dashboard' : 'home';
    _markActive(document.querySelector(`.ms-side__item[data-side-tab="${tabKey}"]`));
  }
  const _origMarkClosed = window._markSheetClosed;
  window._markSheetClosed = function (name) {
    try { if (typeof _origMarkClosed === 'function') _origMarkClosed(name); } catch (_e) { void _e; }
    setTimeout(_resyncActive, 60);
  };
})();
