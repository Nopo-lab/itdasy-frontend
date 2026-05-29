/* 가격표 자동 채움 (T-006 · 2026-05-29)
   샵의 실제 서비스(ServiceTemplate 캐시)를 "이름 / 가격원" 행으로 변환.
   서비스가 없으면 null 반환 → 호출측(template-overlay)이 업종 기본 메뉴로 폴백.
   캐시 소스: window._serviceTemplatesCache (app-service-templates.loadServiceTemplates)
            또는 localStorage['itdasy_service_templates_cache']. */
(function () {
  'use strict';

  function _fmt(n) {
    try { return Number(n).toLocaleString('ko-KR'); } catch (_e) { return String(n); }
  }

  function _shopServices() {
    let arr = window._serviceTemplatesCache;
    if (!Array.isArray(arr) || !arr.length) {
      try { arr = JSON.parse(localStorage.getItem('itdasy_service_templates_cache') || '[]'); }
      catch (_e) { arr = []; }
    }
    return Array.isArray(arr) ? arr : [];
  }

  // 샵의 실제 서비스 → 가격표 행(최대 6). price 0/없으면 가격 생략. 서비스 없으면 null.
  function shopMenu() {
    const svc = _shopServices().filter(s => s && s.name);
    if (!svc.length) return null;
    const rows = svc.slice(0, 6).map(s => {
      const p = Number(s.price);
      return (p > 0) ? `${s.name} / ${_fmt(p)}원` : String(s.name);
    });
    return rows.length ? rows : null;
  }

  function hasShopServices() { return !!shopMenu(); }

  window.ItdasyPriceMenu = { shopMenu, hasShopServices };
})();
