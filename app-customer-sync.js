/* ─────────────────────────────────────────────────────────────
   예약 생성 → 고객 자동 등록 (T-410)
   캘린더가 booking:created 이벤트 디스패치하면 신규 이름 자동 POST
   ──────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const API  = () => window.API  || '';
  const AUTH = () => window.authHeader ? window.authHeader() : {};

  // [보안감사 M-6 2026-07-26] 예전엔 존재하지 않는 sessionStorage 'ch_cache' 를 읽어(어디서도 set 안 함)
  //   FE 이름 dedup 이 항상 무력화 → 매번 POST(백엔드 409 에만 의존)였다. 실제 캐시(CustomerCache)를 본다.
  function _localCustomerByName(name) {
    try {
      const items = (window.CustomerCache && window.CustomerCache.get && window.CustomerCache.get()) || [];
      const t = String(name || '').trim();
      return items.find(c => String(c.name || '').trim() === t) || null;
    } catch (_) { return null; }
  }

  // [PERF P1-3] debounce — 대량 예약 입력 시 중복 API 호출 방지
  let _syncTimer = null;
  const _pendingNames = new Set();

  window.addEventListener('booking:created', (e) => {
    const { customer_name, customer_id } = e.detail || {};
    if (customer_id)                              return;
    if (!customer_name || !customer_name.trim())  return;
    if (_localCustomerByName(customer_name))      return;

    _pendingNames.add(customer_name.trim());
    clearTimeout(_syncTimer);
    _syncTimer = setTimeout(async () => {
      const names = [..._pendingNames];
      _pendingNames.clear();
      // [2026-07-22] 순차 await → 병렬. 이름이 서로 다른(Set) 독립 생성이라 경합 없음.
      //   기존엔 이름 N개면 왕복 N번을 줄줄이 기다려 동기화가 눈에 띄게 느렸다.
      //   하나 실패해도 나머지는 진행(allSettled).
      // [2026-07-25 예약QA INT-F7] ?force=true 제거 — 예전엔 백엔드 중복검사를 우회해서, 세션 캐시에
      //   없던 기존 고객(같은 이름)을 새로 만들어 중복 레코드가 생겼다(캐시 미로딩/refresh 레이스 시).
      //   force 없이 보내면 백엔드가 이름 중복이면 409 로 막는다(신규만 201). 실제 생성(res.ok) 수로만 안내.
      const _res = await Promise.allSettled(names.map(name =>
        fetch(`${API()}/customers`, {
          method: 'POST',
          headers: { ...AUTH(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, tags: [] }),
        }).then(r => r.ok).catch((_e) => { console.warn('[customer-sync] auto-create fail', _e); return false; })
      ));
      const _created = _res.filter(r => r.status === 'fulfilled' && r.value).length;
      if (names.length > 0) {
        sessionStorage.removeItem('ch_cache');
        if (window.CustomerHub?.refresh) window.CustomerHub.refresh();
        if (_created > 0 && window.showToast) window.showToast(`신규 고객 ${_created}명 자동 등록됨`);
      }
    }, 500);
  });
})();
