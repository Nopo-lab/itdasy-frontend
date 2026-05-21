/* AI 잇비 — 액션 종류/메타 공통 모듈
   app-assistant.js 본문이 더 커지지 않도록 독립성이 높은 설정을 분리. */
(function () {
  'use strict';

  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch]));
  }

  function _suggestions() {
    return [
      '오늘 예약 알려줘',
      '캡션 만들어줘',
      '재고 부족한 거?',
      '이번 달 매출',
    ];
  }

  function _categories() {
    return [
      { value: 'nail', label: '네일' },
      { value: 'lash', label: '속눈썹' },
      { value: 'hair', label: '헤어' },
      { value: 'skin', label: '피부' },
      { value: 'food', label: '식품/생수' },
      { value: 'office', label: '사무용품' },
      { value: 'rent', label: '임대료' },
      { value: 'utility', label: '공과금' },
      { value: 'etc', label: '기타' },
    ];
  }

  function _categoryOptionsHtml(categories, selected) {
    const sel = String(selected == null ? '' : selected).toLowerCase();
    const known = categories.some(c => c.value === sel);
    const opts = categories.map(c =>
      `<option value="${_esc(c.value)}"${c.value === sel ? ' selected' : ''}>${_esc(c.label)}</option>`
    ).join('');
    const custom = (!known && sel) ? `<option value="${_esc(sel)}" selected>${_esc(sel)}</option>` : '';
    return custom + opts;
  }

  function _baseCategory() {
    return {
      create_customer:       { icon: 'ic-user',            label: '고객 추가', color: '#4ECDC4' },
      update_customer:       { icon: 'ic-edit-3',          label: '고객 수정', color: '#4ECDC4' },
      create_revenue:        { icon: 'ic-dollar-sign',     label: '매출 기록', color: '#388e3c' },
      create_booking:        { icon: 'ic-calendar',        label: '예약 추가', color: 'var(--brand)' },
      update_booking:        { icon: 'ic-edit-3',          label: '예약 수정', color: '#A78BFA' },
      cancel_booking:        { icon: 'ic-x',               label: '예약 취소', color: 'var(--danger)' },
      reschedule_booking:    { icon: 'ic-refresh-cw',      label: '예약 변경', color: '#0288D1' },
      create_expense:        { icon: 'ic-credit-card',     label: '지출 기록', color: '#E07A5F' },
      upsert_inventory:      { icon: 'ic-package',         label: '재고 입고', color: '#2B8C7E' },
      create_nps:            { icon: 'ic-star',            label: '후기', color: '#FFD700' },
      generate_bulk_message: { icon: 'ic-message-square',  label: '메시지', color: '#FF8A5C' },
      charge_membership:     { icon: 'ic-credit-card',     label: '회원권 충전', color: '#7C3AED' },
      use_membership:        { icon: 'ic-credit-card',     label: '회원권 사용', color: '#6D28D9' },
      mark_booking_no_show:  { icon: 'ic-x-octagon',       label: '노쇼 처리', color: 'var(--danger)' },
      mark_booking_completed:{ icon: 'ic-check-circle',    label: '시술 완료', color: '#15803D' },
      refund_revenue:        { icon: 'ic-corner-up-left',  label: '환불 처리', color: '#F97316' },
      update_service_price:  { icon: 'ic-dollar-sign',     label: '가격 변경', color: '#0EA5E9' },
    };
  }

  function _riskyActionKinds() {
    return new Set([
      'cancel_booking',
      'cancel_booking_bulk',
      'refund_revenue',
      'use_membership',
      'charge_membership',
      'mark_booking_no_show',
      'send_message',
      'reply_dm',
      'delete_customer',
      'publish_instagram',
      'update_service_price',
    ]);
  }

  function _installApi() {
    const SUGGESTIONS = _suggestions();
    const CATEGORIES = _categories();
    const CATEGORY = _baseCategory();
    const externalInvalidateKinds = {};
    const localKindHandlers = {};
    const api = window.ItdasyAssistant = window.ItdasyAssistant || {};
    const catMeta = kind => CATEGORY[kind] || { icon: 'ic-check', label: kind || '작업', color: '#666' };
    Object.assign(api, {
      SUGGESTIONS,
      CATEGORIES,
      CATEGORY,
      RISKY_ACTION_KINDS: _riskyActionKinds(),
      externalInvalidateKinds,
      localKindHandlers,
      categoryOptionsHtml: selected => _categoryOptionsHtml(CATEGORIES, selected),
      catMeta,
    });
    api.registerKindMeta = function (metaMap) {
      if (metaMap && typeof metaMap === 'object') Object.assign(CATEGORY, metaMap);
    };
    api.registerInvalidateKinds = function (kindMap) {
      if (kindMap && typeof kindMap === 'object') Object.assign(externalInvalidateKinds, kindMap);
    };
    api.registerLocalHandler = function (kind, handler) {
      if (typeof kind === 'string' && typeof handler === 'function') localKindHandlers[kind] = handler;
    };
  }

  _installApi();
})();
