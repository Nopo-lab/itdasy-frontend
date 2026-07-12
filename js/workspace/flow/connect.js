/* workspace/flow/connect.js — 고객 연결 화면 클러스터 분리 (T-104 P4, 2026-07-10)
   최근 고객 목록/검색/선택/등록 + 이름으로 연결(챗). context 주입: D()=현재 d, CUR()=현재 화면.
   setScreen 은 ctx, esc/toast/barClass 는 WSFlowUtil. window.WSFlowConnect.create(ctx) → 함수 묶음. */
(function () {
  'use strict';
  function create(ctx) {
    var WSU = window.WSFlowUtil || {}, esc = WSU.esc, toast = WSU.toast, barClass = WSU.barClass;
    var setScreen = ctx.setScreen;
    function D() { return ctx.d(); }
    function CUR() { return ctx.cur(); }

    function renderConnect() {
      var recent = D().recent || [];
      var listHtml;
      if (recent.length) {
        listHtml = recent.map(function (c) {
          var sel = String(D().customerId) === String(c.id);
          var bc = barClass(c.vc || 0);
          var vcLabel = c.vc ? c.vc + '회' : '첫 방문';
          return '<div class="cust-card' + (sel ? ' selected' : '') + '" data-fl-cust="' + esc(c.n) + '" data-fl-custid="' + esc(c.id) + '">' +
            '<span class="cust-bar ' + bc + '"></span>' +
            '<div class="cust-info"><h3>' + esc(c.n) + '<span class="cust-badge ' + bc + '">' + esc(vcLabel) + '</span></h3>' + (c.p ? '<p>' + esc(c.p) + '</p>' : '') + '</div>' +
            '<span class="cust-pick"><i class="ph-bold ' + (sel ? 'ph-check' : 'ph-plus') + '"></i></span></div>';
        }).join('');
      } else {
        listHtml = '<div class="cust-empty">' + (D().recentLoaded ? '최근 연결한 고객이 아직 없어요.<br>아래에서 고객을 선택/등록해 주세요.' : '불러오는 중…') + '</div>';
      }
      var linkedName = D().customerName || '';
      var linkedVc = D().customerVc || 0;
      var linkedBc = barClass(linkedVc);
      return '' +
        '<div class="screen-head"><h2>고객을 선택하거나<br>새로 연결해 주세요</h2><p>연결하면 작업실에 자동 저장되고, 시술 기록이 함께 남아요.</p></div>' +
        '<div class="cust-search"><i class="ph-duotone ph-magnifying-glass"></i><input data-fl-custsearch placeholder="이름, 전화번호 검색"></div>' +
        '<div class="cust-row"><b>최근 고객</b><a data-fl="pickcust">더보기 ›</a></div>' +
        '<div data-fl-custlist>' + listHtml + '</div>' +
        '<div class="linked-card"><div class="linked-title"><i class="ph-duotone ph-user-circle"></i> 연결된 고객</div>' +
          '<div class="linked-main">' +
            '<span class="cust-bar ' + (linkedName ? linkedBc : 'b1') + '"></span>' +
            '<div><b>' + esc(linkedName || '고객 미선택') + '</b>' + (linkedName ? '<span class="cust-badge ' + linkedBc + '">' + (linkedVc ? linkedVc + '회' : '첫 방문') + '</span>' : '') + '<span>오늘 촬영한 사진과 게시글을 이 고객 기록에 저장해요.</span></div>' +
          '</div>' +
          '<div class="linked-actions"><button class="lk-btn pink" data-fl="pickcust">+ 새 고객 등록</button><button class="lk-btn" data-fl="skipcust">연결 없이 진행</button></div></div>';
    }
    function loadRecent() {
      if (D().recentLoaded || D()._recentLoading) return;
      if (!(window.WorkspaceAdapter && window.WorkspaceAdapter.recentCustomers)) { D().recentLoaded = true; return; }
      D()._recentLoading = true;
      window.WorkspaceAdapter.recentCustomers(5).then(function (list) {
        D().recent = list || []; D().recentLoaded = true; D()._recentLoading = false;
        if (CUR() === 'connect') setScreen('connect');
      });
    }
    function pickCustomer() {
      if (!window.WorkspaceAdapter) { toast('고객 모듈을 불러오지 못했어요'); return; }
      window.WorkspaceAdapter.pickCustomer(D().customerId).then(function (r) {
        if (r.ok) {
          D().customerId = r.id; D().customerName = r.name; D().customerVc = r.vc || 0;
          setScreen('connect'); toast(r.name + ' 고객과 연결했어요.');
        } else if (r.toast) toast(r.toast);
      });
    }
    // [refactor S4] 고객 연결 화면 전용 클릭 핸들러 — flow.js 익명 리스너에서 이관(무동작변경).
    //   처리하면 true 반환. 이 버튼들은 connect 화면(renderConnect)에서만 렌더되므로 스텝 전용이 안전.
    //   save/buildSlot 은 flow.js 소유 → ctx 로 주입.
    function handleClick(t, a) {
      if (a === 'pickcust') { pickCustomer(); return true; }
      if (a === 'skipcust') { D().customerId = null; D().customerName = ''; D().customerVc = 0; ctx.save(); return true; }   // [v583·C] 연결 없이 진행=저장 후 완료
      var cust = t.closest('[data-fl-cust]');
      if (cust) {
        D().customerId = cust.getAttribute('data-fl-custid'); D().customerName = cust.getAttribute('data-fl-cust');
        // vc 찾기 — recent 캐시에서
        var found = (D().recent || []).filter(function (c) { return String(c.id) === String(D().customerId); })[0];
        D().customerVc = found ? (found.vc || 0) : 0;
        try { if (window.WorkspaceAdapter && window.WorkspaceAdapter.saveItem) window.WorkspaceAdapter.saveItem(ctx.buildSlot()); } catch (_ce) { void _ce; }
        toast(D().customerName + ' 고객과 연결했어요');
        setScreen('preview'); return true;   // [보스] 고객 연결하면 인스타 업로드(미리보기)로 돌아오게
      }
      return false;
    }
    function _connectByName(name) {
      name = String(name || '').trim();
      if (!name) { setScreen('connect'); return { ok: true, matched: false }; }
      D().custQuery = name;
      var hit = null;
      try {
        if (window.Customer && typeof window.Customer.search === 'function') {
          var m = window.Customer.search(name) || [];
          if (m[0]) hit = { id: m[0].id, n: m[0].name, vc: m[0].visit_count || m[0].vc || 0 };
        }
      } catch (_e) { hit = null; }
      if (!hit) hit = (D().recent || []).filter(function (c) { return c && c.n && (c.n === name || c.n.indexOf(name) >= 0 || name.indexOf(c.n) >= 0); })[0] || null;
      if (hit) { D().customerId = hit.id; D().customerName = hit.n; D().customerVc = hit.vc || 0; setScreen('connect'); toast(hit.n + ' 고객과 연결했어요'); return { ok: true, matched: true }; }
      setScreen('connect'); toast('"' + name + '" 고객을 못 찾았어요 — 목록에서 골라주세요'); return { ok: true, matched: false };
    }

    return { renderConnect: renderConnect, loadRecent: loadRecent, pickCustomer: pickCustomer, _connectByName: _connectByName, handleClick: handleClick };
  }
  window.WSFlowConnect = { create: create };
})();
