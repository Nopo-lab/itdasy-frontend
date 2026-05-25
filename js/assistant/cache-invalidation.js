/* AI 잇비 — 액션 실행 후 화면 캐시 정리 */
(function () {
  'use strict';

  const DEFAULT_KIND_KEYS = {
    create_customer: ['customer', 'customers', 'today'],
    update_customer: ['customer', 'customers', 'today'],
    create_booking: ['booking', 'bookings', 'bookings_all', 'customer', 'customers', 'today'],
    update_booking: ['booking', 'bookings', 'bookings_all', 'customer', 'customers', 'today'],
    cancel_booking: ['booking', 'bookings', 'bookings_all', 'customer', 'customers', 'today'],
    reschedule_booking: ['booking', 'bookings', 'bookings_all', 'customer', 'customers', 'today'],
    create_revenue: ['revenue', 'revenues', 'customer', 'customers', 'today', 'dashboard'],
    update_revenue: ['revenue', 'revenues', 'customer', 'customers', 'today', 'dashboard'],
    create_expense: ['expense', 'expenses', 'revenue', 'revenues', 'today', 'dashboard'],
    create_nps: ['nps', 'customer', 'customers'],
    generate_bulk_message: [],
    upsert_inventory: ['inventory', 'inventories', 'today'],
    charge_membership: ['customer', 'customers', 'membership', 'today', 'dashboard'],
    use_membership: ['customer', 'customers', 'membership', 'today', 'dashboard'],
    mark_booking_no_show: ['booking', 'bookings', 'bookings_all', 'customer', 'customers', 'today'],
    mark_booking_completed: ['booking', 'bookings', 'bookings_all', 'customer', 'customers', 'today'],
    refund_revenue: ['revenue', 'revenues', 'customer', 'customers', 'today', 'dashboard'],
    update_service_price: ['service', 'services', 'today'],
  };

  const PREFIX_BY_KEY = {
    booking: 'booking',
    bookings: 'booking',
    bookings_all: 'booking',
    customer: 'customer',
    customers: 'customer',
    expense: 'expense',
    expenses: 'expense',
    inventory: 'inventor',
    inventories: 'inventor',
    nps: 'nps',
    revenue: 'revenue',
    revenues: 'revenue',
    membership: 'membership',
    memberships: 'membership',
    service: 'service',
    services: 'service',
  };

  function _removeExact(storage, key) {
    try { storage.removeItem('pv_cache::' + key); } catch (_e) { void _e; }
  }

  function _removePrefix(storage, prefix) {
    try {
      for (let i = storage.length - 1; i >= 0; i -= 1) {
        const key = storage.key(i);
        if (key && key.startsWith('pv_cache::' + prefix)) storage.removeItem(key);
      }
    } catch (_e) { void _e; }
  }

  function _clearKey(key) {
    _removeExact(sessionStorage, key);
    _removeExact(localStorage, key);
    const prefix = PREFIX_BY_KEY[key];
    if (!prefix) return;
    _removePrefix(sessionStorage, prefix);
    _removePrefix(localStorage, prefix);
  }

  function keysForKind(kind, externalKinds) {
    const external = externalKinds && externalKinds[kind];
    return external || DEFAULT_KIND_KEYS[kind] || [];
  }

  function invalidate(kind, opts) {
    const keys = keysForKind(kind, opts && opts.externalInvalidateKinds);
    keys.forEach(_clearKey);
  }

  window.ItdasyAssistantCacheInvalidation = { invalidate, keysForKind };
})();
