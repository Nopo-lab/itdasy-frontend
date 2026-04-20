/* ─────────────────────────────────────────────────────────────
   예약 캘린더 (Phase 2 P2.2) — 1인샵 내 달력

   엔드포인트 (shared/schemas.json 참조):
   - GET    /bookings?from=ISO&to=ISO
   - POST   /bookings
   - PATCH  /bookings/{id}
   - DELETE /bookings/{id}

   특징:
   - 주간 뷰 (7일 · 30분 단위 슬롯 18:00~22:00 기본)
   - 중복 시간 감지 경고
   - Customer.pick() 재사용
   - 백엔드 미배포 시 localStorage 오프라인 폴백
   - openBooking(date?) 로 외부 진입
   ──────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const OFFLINE_KEY = 'itdasy_bookings_offline_v1';
  const SHOP_HOURS_KEY = 'itdasy_shop_hours_v1';
  const DEFAULT_HOURS = { start: 10, end: 22, slotMin: 30 };

  let _items = [];
  let _isOffline = false;
  let _anchorDate = _startOfWeek(new Date());

  function _uuid() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'b_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
  }
  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  }

  function _startOfWeek(d) {
    const x = new Date(d);
    const day = x.getDay();
    const monOffset = (day + 6) % 7;
    x.setDate(x.getDate() - monOffset);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function _shopHours() {
    try {
      const raw = localStorage.getItem(SHOP_HOURS_KEY);
      if (raw) return { ...DEFAULT_HOURS, ...JSON.parse(raw) };
    } catch (_) {}
    return { ...DEFAULT_HOURS };
  }

  function _loadOffline() {
    try { return JSON.parse(localStorage.getItem(OFFLINE_KEY) || '[]'); }
    catch (_) { return []; }
  }
  function _saveOffline(list) {
    try { localStorage.setItem(OFFLINE_KEY, JSON.stringify(list)); } catch (_) {}
  }

  async function _api(method, path, body) {
    if (!window.API || !window.authHeader) throw new Error('no-auth');
    const auth = window.authHeader();
    if (!auth?.Authorization) throw new Error('no-token');
    const opts = { method, headers: { ...auth, 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(window.API + path, opts);
    if (res.status === 404 || res.status === 501) throw new Error('endpoint-missing');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.status === 204 ? null : await res.json();
  }

  // ── CRUD ────────────────────────────────────────────────
  async function list(fromISO, toISO) {
    const qs = new URLSearchParams();
    if (fromISO) qs.set('from', fromISO);
    if (toISO) qs.set('to', toISO);
    try {
      const d = await _api('GET', '/bookings?' + qs.toString());
      _isOffline = false;
      _items = d.items || [];
      return _items;
    } catch (e) {
      if (e.message === 'endpoint-missing' || e.message === 'no-token') {
        _isOffline = true;
        const all = _loadOffline();
        _items = all.filter(b => {
          const t = new Date(b.starts_at).getTime();
          if (fromISO && t < new Date(fromISO).getTime()) return false;
          if (toISO && t > new Date(toISO).getTime()) return false;
          return !b.deleted_at;
        });
        return _items;
      }
      throw e;
    }
  }

  function _hasConflict(startsAt, endsAt, excludeId) {
    const s = new Date(startsAt).getTime();
    const e = new Date(endsAt).getTime();
    return _items.some(b => {
      if (excludeId && b.id === excludeId) return false;
      const bs = new Date(b.starts_at).getTime();
      const be = new Date(b.ends_at).getTime();
      return !(e <= bs || s >= be);
    });
  }

  async function create(payload) {
    if (!payload || !payload.starts_at || !payload.ends_at) throw new Error('time-required');
    const data = {
      starts_at: payload.starts_at,
      ends_at: payload.ends_at,
      customer_id: payload.customer_id || null,
      customer_name: payload.customer_name || null,
      service_name: payload.service_name ? String(payload.service_name).slice(0, 50) : null,
      memo: payload.memo ? String(payload.memo).slice(0, 200) : null,
      status: 'confirmed',
    };
    if (_isOffline) {
      const record = {
        id: _uuid(),
        shop_id: localStorage.getItem('shop_id') || 'offline',
        ...data,
        created_at: new Date().toISOString(),
        deleted_at: null,
      };
      const all = _loadOffline();
      all.push(record);
      _saveOffline(all);
      _items.push(record);
      return record;
    }
    const created = await _api('POST', '/bookings', data);
    _items.push(created);
    return created;
  }

  async function update(id, patch) {
    if (_isOffline) {
      const all = _loadOffline();
      const i = all.findIndex(b => b.id === id);
      if (i < 0) throw new Error('not-found');
      all[i] = { ...all[i], ...patch };
      _saveOffline(all);
      const j = _items.findIndex(b => b.id === id);
      if (j >= 0) _items[j] = all[i];
      return all[i];
    }
    const updated = await _api('PATCH', '/bookings/' + id, patch);
    const j = _items.findIndex(b => b.id === id);
    if (j >= 0) _items[j] = updated;
    return updated;
  }

  async function remove(id) {
    if (_isOffline) {
      const all = _loadOffline().filter(b => b.id !== id);
      _saveOffline(all);
      _items = _items.filter(b => b.id !== id);
      return { ok: true };
    }
    await _api('DELETE', '/bookings/' + id);
    _items = _items.filter(b => b.id !== id);
    return { ok: true };
  }

  // ── UI ──────────────────────────────────────────────────
  function _ensureSheet() {
    let sheet = document.getElementById('bookingSheet');
    if (sheet) return sheet;
    sheet = document.createElement('div');
    sheet.id = 'bookingSheet';
    sheet.style.cssText = 'position:fixed;inset:0;z-index:9998;display:none;background:rgba(0,0,0,0.4);';
    sheet.innerHTML = `
      <div style="position:absolute;inset:auto 0 0 0;background:var(--bg,#fff);border-radius:20px 20px 0 0;max-height:92vh;display:flex;flex-direction:column;padding:16px;padding-bottom:max(16px,env(safe-area-inset-bottom));">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <strong style="font-size:18px;">예약</strong>
          <span id="bookingOfflineBadge" style="display:none;font-size:10px;padding:2px 6px;border-radius:4px;background:#f2c94c;color:#333;">오프라인</span>
          <button onclick="closeBooking()" style="margin-left:auto;background:none;border:none;font-size:20px;cursor:pointer;" aria-label="닫기">✕</button>
        </div>
        <div id="bookingNav" style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"></div>
        <div id="bookingGrid" style="flex:1;overflow:auto;"></div>
        <button id="bookingAddBtn" style="margin-top:10px;padding:12px;border:none;border-radius:10px;background:var(--accent,#F18091);color:#fff;font-weight:700;font-size:15px;cursor:pointer;">+ 예약 추가</button>
      </div>
    `;
    document.body.appendChild(sheet);
    sheet.addEventListener('click', (e) => { if (e.target === sheet) closeBooking(); });
    sheet.querySelector('#bookingAddBtn').addEventListener('click', () => _openAddForm());
    return sheet;
  }

  function _rerender() {
    const sheet = document.getElementById('bookingSheet');
    if (!sheet) return;

    const nav = sheet.querySelector('#bookingNav');
    const rangeEnd = new Date(_anchorDate.getTime() + 6 * 24 * 3600 * 1000);
    nav.innerHTML = `
      <button data-nav="prev" style="padding:6px 12px;border:1px solid #ddd;border-radius:8px;background:#fff;cursor:pointer;">◀</button>
      <div style="flex:1;text-align:center;font-size:14px;font-weight:700;">
        ${_anchorDate.getMonth() + 1}/${_anchorDate.getDate()} – ${rangeEnd.getMonth() + 1}/${rangeEnd.getDate()}
      </div>
      <button data-nav="today" style="padding:6px 10px;border:1px solid #ddd;border-radius:8px;background:#fff;cursor:pointer;font-size:11px;">오늘</button>
      <button data-nav="next" style="padding:6px 12px;border:1px solid #ddd;border-radius:8px;background:#fff;cursor:pointer;">▶</button>
    `;
    nav.querySelector('[data-nav="prev"]').addEventListener('click', () => _shiftWeek(-1));
    nav.querySelector('[data-nav="next"]').addEventListener('click', () => _shiftWeek(1));
    nav.querySelector('[data-nav="today"]').addEventListener('click', () => { _anchorDate = _startOfWeek(new Date()); _loadAndRender(); });

    sheet.querySelector('#bookingOfflineBadge').style.display = _isOffline ? 'inline-block' : 'none';

    const grid = sheet.querySelector('#bookingGrid');
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(_anchorDate); d.setDate(d.getDate() + i); return d;
    });
    const dayLabels = ['월', '화', '수', '목', '금', '토', '일'];
    const todayKey = _dayKey(new Date());

    grid.innerHTML = days.map((d, i) => {
      const key = _dayKey(d);
      const isToday = key === todayKey;
      const dayBookings = _items
        .filter(b => _dayKey(new Date(b.starts_at)) === key)
        .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
      return `
        <div style="border-bottom:1px solid #eee;padding:10px 4px;${isToday ? 'background:rgba(241,128,145,0.04);' : ''}">
          <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:6px;">
            <strong style="font-size:13px;color:${isToday ? 'var(--accent,#F18091)' : '#333'};">${dayLabels[i]} ${d.getDate()}</strong>
            <span style="font-size:11px;color:#999;">${dayBookings.length}건</span>
          </div>
          ${dayBookings.length ? dayBookings.map(b => _renderBookingRow(b)).join('') : '<div style="font-size:12px;color:#bbb;padding:4px 4px;">예약 없음</div>'}
        </div>
      `;
    }).join('');

    grid.querySelectorAll('[data-booking-id]').forEach(row => {
      row.addEventListener('click', () => _openAddForm(row.dataset.bookingId));
    });
  }

  function _renderBookingRow(b) {
    const s = new Date(b.starts_at);
    const e = new Date(b.ends_at);
    const hhmm = (d) => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    return `
      <div data-booking-id="${b.id}" style="padding:8px;margin-bottom:4px;background:#fff;border:1px solid #eee;border-radius:8px;cursor:pointer;">
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-size:12px;color:var(--accent,#F18091);font-weight:700;">${hhmm(s)}–${hhmm(e)}</span>
          ${b.customer_name ? `<span style="font-size:13px;font-weight:700;">${_esc(b.customer_name)}</span>` : '<span style="font-size:12px;color:#999;">이름 없음</span>'}
          ${b.service_name ? `<span style="font-size:11px;color:#666;">· ${_esc(b.service_name)}</span>` : ''}
        </div>
        ${b.memo ? `<div style="font-size:11px;color:#888;margin-top:2px;">${_esc(b.memo).slice(0,50)}</div>` : ''}
      </div>
    `;
  }

  function _dayKey(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function _shiftWeek(n) {
    _anchorDate = new Date(_anchorDate.getTime() + n * 7 * 24 * 3600 * 1000);
    _loadAndRender();
  }

  function _openAddForm(bookingId) {
    const existing = bookingId ? _items.find(b => b.id === bookingId) : null;
    const sheet = document.getElementById('bookingSheet');
    if (!sheet) return;
    const grid = sheet.querySelector('#bookingGrid');
    const hours = _shopHours();
    const slots = [];
    for (let h = hours.start; h < hours.end; h++) {
      for (let m = 0; m < 60; m += hours.slotMin) {
        slots.push(String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'));
      }
    }

    const defDate = existing ? new Date(existing.starts_at) : new Date();
    const dateStr = defDate.getFullYear() + '-' + String(defDate.getMonth() + 1).padStart(2, '0') + '-' + String(defDate.getDate()).padStart(2, '0');
    const defStart = existing ? String(new Date(existing.starts_at).getHours()).padStart(2, '0') + ':' + String(new Date(existing.starts_at).getMinutes()).padStart(2, '0') : slots[0];
    const defEnd = existing ? String(new Date(existing.ends_at).getHours()).padStart(2, '0') + ':' + String(new Date(existing.ends_at).getMinutes()).padStart(2, '0') : slots[2];

    grid.innerHTML = `
      <div style="padding:4px;">
        <button onclick="window._bookingBack()" style="background:none;border:none;font-size:13px;color:#888;margin-bottom:10px;cursor:pointer;">← 주간 뷰</button>
        <label style="display:block;font-size:12px;color:#666;margin-bottom:4px;">날짜 *</label>
        <input id="bfDate" type="date" value="${dateStr}" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;margin-bottom:10px;" />
        <div style="display:flex;gap:8px;margin-bottom:10px;">
          <div style="flex:1;">
            <label style="display:block;font-size:12px;color:#666;margin-bottom:4px;">시작 *</label>
            <select id="bfStart" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;">
              ${slots.map(t => `<option value="${t}" ${t === defStart ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </div>
          <div style="flex:1;">
            <label style="display:block;font-size:12px;color:#666;margin-bottom:4px;">종료 *</label>
            <select id="bfEnd" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;">
              ${slots.map(t => `<option value="${t}" ${t === defEnd ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:10px;">
          <input id="bfCustomerName" readonly style="flex:1;padding:10px;border:1px solid #ddd;border-radius:8px;background:#fafafa;" placeholder="고객 (선택)" value="${_esc(existing?.customer_name||'')}" />
          <button type="button" id="bfCustomerPick" style="padding:10px 14px;border:1px solid #ddd;border-radius:8px;background:#fff;cursor:pointer;font-size:12px;">👤 선택</button>
        </div>
        <label style="display:block;font-size:12px;color:#666;margin-bottom:4px;">서비스</label>
        <input id="bfService" value="${_esc(existing?.service_name||'')}" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;margin-bottom:10px;" placeholder="속눈썹 풀세트" maxlength="50" />
        <label style="display:block;font-size:12px;color:#666;margin-bottom:4px;">메모</label>
        <textarea id="bfMemo" rows="2" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;margin-bottom:10px;font-family:inherit;resize:vertical;" maxlength="200">${_esc(existing?.memo||'')}</textarea>
        <div id="bfConflict" style="display:none;font-size:12px;color:#c00;margin-bottom:8px;padding:8px;background:rgba(220,0,0,0.06);border-radius:6px;">⚠️ 이 시간에 이미 예약이 있어요</div>
        <div style="display:flex;gap:8px;">
          <button type="button" id="bfSave" style="flex:1;padding:12px;border:none;border-radius:8px;background:var(--accent,#F18091);color:#fff;font-weight:700;cursor:pointer;font-size:15px;">${existing ? '수정' : '저장'}</button>
          ${existing ? `<button type="button" id="bfDelete" style="padding:12px 16px;border:1px solid #eee;border-radius:8px;background:#fff;color:#c00;cursor:pointer;">삭제</button>` : ''}
        </div>
      </div>
    `;

    let customer_id = existing?.customer_id || null;
    grid.querySelector('#bfCustomerPick').addEventListener('click', async () => {
      if (!window.Customer || !window.Customer.pick) {
        if (window.showToast) window.showToast('고객 모듈 로드 중…');
        return;
      }
      const picked = await window.Customer.pick({ selectedId: customer_id });
      if (picked === null) return;
      customer_id = picked.id;
      grid.querySelector('#bfCustomerName').value = picked.name || '';
    });

    const checkConflict = () => {
      const d = grid.querySelector('#bfDate').value;
      const s = grid.querySelector('#bfStart').value;
      const e = grid.querySelector('#bfEnd').value;
      if (!d || !s || !e) return;
      const starts = new Date(d + 'T' + s + ':00').toISOString();
      const ends = new Date(d + 'T' + e + ':00').toISOString();
      const conflict = _hasConflict(starts, ends, existing?.id);
      grid.querySelector('#bfConflict').style.display = conflict ? 'block' : 'none';
    };
    ['bfDate', 'bfStart', 'bfEnd'].forEach(id => grid.querySelector('#' + id).addEventListener('change', checkConflict));
    checkConflict();

    grid.querySelector('#bfSave').addEventListener('click', async () => {
      const d = grid.querySelector('#bfDate').value;
      const s = grid.querySelector('#bfStart').value;
      const e = grid.querySelector('#bfEnd').value;
      if (!d || !s || !e) { if (window.showToast) window.showToast('날짜·시간을 입력해 주세요'); return; }
      if (s >= e) { if (window.showToast) window.showToast('종료 시간이 시작보다 늦어야 해요'); return; }
      const payload = {
        starts_at: new Date(d + 'T' + s + ':00').toISOString(),
        ends_at: new Date(d + 'T' + e + ':00').toISOString(),
        customer_id,
        customer_name: grid.querySelector('#bfCustomerName').value.trim() || null,
        service_name: grid.querySelector('#bfService').value.trim() || null,
        memo: grid.querySelector('#bfMemo').value.trim() || null,
      };
      try {
        if (existing) await update(existing.id, payload);
        else await create(payload);
        if (window.hapticLight) window.hapticLight();
        if (window.showToast) window.showToast(existing ? '수정 완료' : '예약 추가 완료');
        await _loadAndRender();
      } catch (err) {
        console.warn('[booking] save 실패:', err);
        if (window.showToast) window.showToast('저장 실패');
      }
    });

    if (existing) {
      grid.querySelector('#bfDelete').addEventListener('click', async () => {
        if (!confirm('이 예약을 삭제할까요?')) return;
        try {
          await remove(existing.id);
          if (window.hapticLight) window.hapticLight();
          if (window.showToast) window.showToast('삭제 완료');
          await _loadAndRender();
        } catch (err) {
          if (window.showToast) window.showToast('삭제 실패');
        }
      });
    }
  }

  window._bookingBack = _rerender;

  async function _loadAndRender() {
    const from = _anchorDate.toISOString();
    const to = new Date(_anchorDate.getTime() + 7 * 24 * 3600 * 1000 - 1).toISOString();
    try {
      await list(from, to);
      _rerender();
    } catch (e) {
      console.warn('[booking] load 실패:', e);
      const grid = document.querySelector('#bookingGrid');
      if (grid) grid.innerHTML = '<div style="padding:30px;text-align:center;color:#c00;">불러오기 실패</div>';
    }
  }

  window.openBooking = async function (date) {
    const sheet = _ensureSheet();
    sheet.style.display = 'block';
    document.body.style.overflow = 'hidden';
    if (date) _anchorDate = _startOfWeek(new Date(date));
    await _loadAndRender();
  };

  window.closeBooking = function () {
    const sheet = document.getElementById('bookingSheet');
    if (sheet) sheet.style.display = 'none';
    document.body.style.overflow = '';
  };

  window.Booking = {
    list, create, update, remove,
    get _items() { return _items; },
    get isOffline() { return _isOffline; },
  };
})();
