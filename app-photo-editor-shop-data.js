/* 사진 편집기 — 샵 정보 자동 삽입 */
(function () {
  'use strict';
  if (window.PhotoEditorShopData) return;

  const KEYS = {
    shopName: 'itdasy_shop_name',
    brandKit: 'itdasy_brand_kit',
  };

  function _readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; }
    catch (e) { console.warn('[photo-editor-shop-data] 저장된 샵정보 읽기 실패:', e.message); return {}; }
  }

  function _read(key) {
    try { return localStorage.getItem(key) || ''; }
    catch (e) { console.warn('[photo-editor-shop-data] 저장소 접근 실패:', e.message); return ''; }
  }

  function get() {
    const bk = _readJson(KEYS.brandKit);
    const shopName = bk.shop_name || bk.shopName || _read(KEYS.shopName) || '';
    return {
      shopName,
      logo: bk.logo_url || bk.logo || null,
      instagram: bk.instagram_handle || bk.instagram || '',
      phone: bk.phone || '',
      address: bk.address || '',
      bookingUrl: bk.booking_url || bk.bookingUrl || '',
      primaryColor: bk.primary_color || bk.primary || '#D58A95',
      accentColor: bk.accent_color || bk.accent || '#C69B63',
    };
  }

  function fillTemplate(tplState, overrides) {
    const data = Object.assign({}, get(), overrides || {});
    const out = Object.assign({}, tplState || {});
    out.shopName = out.shopName || data.shopName;
    out.logo = out.logo || data.logo;
    out.instagram = out.instagram || data.instagram;
    out.phone = out.phone || data.phone;
    out.bookingUrl = out.bookingUrl || data.bookingUrl;
    out.bg = out.bg || data.primaryColor;
    return out;
  }

  function textBlock(state) {
    const data = get();
    const name = data.shopName || (state && state.shopName) || '우리 샵';
    const bits = [name];
    if (data.instagram) bits.push('@' + data.instagram.replace(/^@/, ''));
    if (data.bookingUrl) bits.push('예약 ' + data.bookingUrl);
    return bits.join('\n');
  }

  window.PhotoEditorShopData = { get, fillTemplate, textBlock };
})();
