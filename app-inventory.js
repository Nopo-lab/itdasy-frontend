/* ─────────────────────────────────────────────────────────────
   소모품 재고 (Phase 3 P3.5) — 네일팁·젤·접착제 등

   엔드포인트 (shared/schemas.json 참조):
   - GET    /inventory                      소모품 목록
   - POST   /inventory                      신규 소모품 등록
   - PATCH  /inventory/{id}                 수량·임계치 수정
   - DELETE /inventory/{id}                 삭제
   - POST   /inventory/{id}/adjust          입고/출고 (delta ±)

   특징:
   - 임계치 하한 도달 시 🔴 배지 + 상단 알림
   - 백엔드 미배포 시 localStorage 오프라인 폴백
   - openInventory() 로 외부 진입
   ──────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const OFFLINE_KEY = 'itdasy_inventory_offline_v1';
  let _items = [];
  let _isOffline = false;

  function _uuid() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'i_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
  }
  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
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

  async function list() {
    try {
      const d = await _api('GET', '/inventory');
      _isOffline = false;
      _items = d.items || [];
      return _items;
    } catch (e) {
      if (e.message === 'endpoint-missing' || e.message === 'no-token') {
        _isOffline = true;
        _items = _loadOffline();
        return _items;
      }
      throw e;
    }
  }

  async function create(payload) {
    if (!payload || !payload.name) throw new Error('name-required');
    const data = {
      name: String(payload.name).trim().slice(0, 50),
      unit: payload.unit ? String(payload.unit).slice(0, 10) : '개',
      quantity: Math.max(0, parseInt(payload.quantity, 10) || 0),
      threshold: Math.max(0, parseInt(payload.threshold, 10) || 5),
      category: payload.category || 'etc',
    };
    if (_isOffline) {
      const record = {
        id: _uuid(),
        shop_id: localStorage.getItem('shop_id') || 'offline',
        ...data,
        created_at: new Date().toISOString(),
      };
      const all = _loadOffline();
      all.unshift(record);
      _saveOffline(all);
      _items.unshift(record);
      return record;
    }
    const created = await _api('POST', '/inventory', data);
    _items.unshift(created);
    return created;
  }

  async function adjust(id, delta) {
    const n = parseInt(delta, 10);
    if (!Number.isFinite(n) || n === 0) return null;
    if (_isOffline) {
      const all = _loadOffline();
      const i = all.findIndex(x => x.id === id);
      if (i < 0) throw new Error('not-found');
      all[i].quantity = Math.max(0, (all[i].quantity || 0) + n);
      _saveOffline(all);
      const j = _items.findIndex(x => x.id === id);
      if (j >= 0) _items[j] = all[i];
      return all[i];
    }
    const updated = await _api('POST', '/inventory/' + id + '/adjust', { delta: n });
    const j = _items.findIndex(x => x.id === id);
    if (j >= 0) _items[j] = updated;
    return updated;
  }

  async function remove(id) {
    if (_isOffline) {
      const all = _loadOffline().filter(x => x.id !== id);
      _saveOffline(all);
      _items = _items.filter(x => x.id !== id);
      return { ok: true };
    }
    await _api('DELETE', '/inventory/' + id);
    _items = _items.filter(x => x.id !== id);
    return { ok: true };
  }

  function _lowStockCount() {
    return _items.filter(x => (x.quantity || 0) <= (x.threshold || 0)).length;
  }

  // ── UI ──────────────────────────────────────────────────
  function _ensureSheet() {
    let sheet = document.getElementById('inventorySheet');
    if (sheet) return sheet;
    sheet = document.createElement('div');
    sheet.id = 'inventorySheet';
    sheet.style.cssText = 'position:fixed;inset:0;z-index:9998;display:none;background:rgba(0,0,0,0.4);';
    sheet.innerHTML = `
      <div style="position:absolute;inset:auto 0 0 0;background:var(--bg,#fff);border-radius:20px 20px 0 0;max-height:90vh;display:flex;flex-direction:column;padding:16px;padding-bottom:max(16px,env(safe-area-inset-bottom));">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <strong style="font-size:18px;">재고</strong>
          <span id="invLowBadge" style="display:none;font-size:11px;padding:2px 8px;border-radius:4px;background:#dc3545;color:#fff;font-weight:700;"></span>
          <span id="invOfflineBadge" style="display:none;font-size:10px;padding:2px 6px;border-radius:4px;background:#f2c94c;color:#333;">오프라인</span>
          <button onclick="closeInventory()" style="margin-left:auto;background:none;border:none;font-size:20px;cursor:pointer;" aria-label="닫기">✕</button>
        </div>
        <div id="inventoryList" style="flex:1;overflow-y:auto;min-height:140px;"></div>
        <button id="inventoryAddBtn" style="margin-top:10px;padding:12px;border:none;border-radius:10px;background:var(--accent,#F18091);color:#fff;font-weight:700;font-size:15px;cursor:pointer;">+ 소모품 추가</button>
      </div>
    `;
    document.body.appendChild(sheet);
    sheet.addEventListener('click', (e) => { if (e.target === sheet) closeInventory(); });
    sheet.querySelector('#inventoryAddBtn').addEventListener('click', () => _openAddForm());
    return sheet;
  }

  function _rerender() {
    const sheet = document.getElementById('inventorySheet');
    if (!sheet) return;
    const low = _lowStockCount();
    const lowBadge = sheet.querySelector('#invLowBadge');
    if (low > 0) {
      lowBadge.style.display = 'inline-block';
      lowBadge.textContent = '⚠ 부족 ' + low;
    } else {
      lowBadge.style.display = 'none';
    }
    sheet.querySelector('#invOfflineBadge').style.display = _isOffline ? 'inline-block' : 'none';

    const listEl = sheet.querySelector('#inventoryList');
    if (!_items.length) {
      listEl.innerHTML = '<div style="padding:40px;text-align:center;color:#aaa;font-size:13px;">아직 소모품이 없어요. 아래 버튼으로 추가해 주세요.</div>';
      return;
    }
    // 부족한 것 위로 정렬
    const sorted = [..._items].sort((a, b) => {
      const aLow = (a.quantity || 0) <= (a.threshold || 0);
      const bLow = (b.quantity || 0) <= (b.threshold || 0);
      if (aLow !== bLow) return aLow ? -1 : 1;
      return (a.name || '').localeCompare(b.name || '');
    });
    listEl.innerHTML = sorted.map(x => {
      const isLow = (x.quantity || 0) <= (x.threshold || 0);
      return `
        <div data-inv-id="${x.id}" style="padding:12px 8px;border-bottom:1px solid #eee;${isLow ? 'background:rgba(220,53,69,0.04);' : ''}">
          <div style="display:flex;align-items:center;gap:8px;">
            <strong style="font-size:14px;">${_esc(x.name)}</strong>
            ${isLow ? '<span style="font-size:9px;padding:1px 5px;background:#dc3545;color:#fff;border-radius:3px;font-weight:700;">부족</span>' : ''}
            <span style="font-size:12px;color:#666;margin-left:auto;">임계 ${x.threshold}${_esc(x.unit||'개')}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:8px;">
            <button data-inv-delta="-1" data-inv-target="${x.id}" style="width:36px;height:36px;border:1px solid #ddd;border-radius:8px;background:#fff;cursor:pointer;font-size:18px;">−</button>
            <strong style="flex:1;text-align:center;font-size:20px;color:${isLow ? '#dc3545' : 'var(--accent,#F18091)'};">${x.quantity || 0}<span style="font-size:12px;color:#888;margin-left:4px;">${_esc(x.unit||'개')}</span></strong>
            <button data-inv-delta="1" data-inv-target="${x.id}" style="width:36px;height:36px;border:1px solid #ddd;border-radius:8px;background:#fff;cursor:pointer;font-size:18px;">+</button>
            <button data-inv-edit="${x.id}" style="padding:8px 12px;border:1px solid #eee;border-radius:8px;background:#fff;cursor:pointer;font-size:11px;">⚙</button>
          </div>
        </div>
      `;
    }).join('');
    listEl.querySelectorAll('[data-inv-delta]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const d = parseInt(btn.dataset.invDelta, 10);
        try {
          await adjust(btn.dataset.invTarget, d);
          if (window.hapticLight) window.hapticLight();
          _rerender();
        } catch (e) {
          if (window.showToast) window.showToast('조정 실패');
        }
      });
    });
    listEl.querySelectorAll('[data-inv-edit]').forEach(btn => {
      btn.addEventListener('click', () => _openAddForm(btn.dataset.invEdit));
    });
  }

  function _openAddForm(id) {
    const existing = id ? _items.find(x => x.id === id) : null;
    const sheet = document.getElementById('inventorySheet');
    if (!sheet) return;
    const listEl = sheet.querySelector('#inventoryList');
    listEl.innerHTML = `
      <div style="padding:4px;">
        <button onclick="window._inventoryBack()" style="background:none;border:none;font-size:13px;color:#888;margin-bottom:10px;cursor:pointer;">← 목록</button>
        <label style="display:block;font-size:12px;color:#666;margin-bottom:4px;">이름 *</label>
        <input id="ifName" value="${_esc(existing?.name||'')}" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;margin-bottom:10px;" placeholder="네일팁 / 젤 / 접착제" maxlength="50" />
        <div style="display:flex;gap:8px;margin-bottom:10px;">
          <div style="flex:1;">
            <label style="display:block;font-size:12px;color:#666;margin-bottom:4px;">현재 수량</label>
            <input id="ifQty" type="number" inputmode="numeric" value="${existing?.quantity ?? 0}" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;" />
          </div>
          <div style="width:80px;">
            <label style="display:block;font-size:12px;color:#666;margin-bottom:4px;">단위</label>
            <input id="ifUnit" value="${_esc(existing?.unit||'개')}" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;" maxlength="10" />
          </div>
        </div>
        <label style="display:block;font-size:12px;color:#666;margin-bottom:4px;">부족 알림 임계치</label>
        <input id="ifThreshold" type="number" inputmode="numeric" value="${existing?.threshold ?? 5}" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;margin-bottom:10px;" />
        <div style="display:flex;gap:8px;">
          <button type="button" id="ifSave" style="flex:1;padding:12px;border:none;border-radius:8px;background:var(--accent,#F18091);color:#fff;font-weight:700;cursor:pointer;font-size:15px;">${existing ? '수정' : '추가'}</button>
          ${existing ? '<button type="button" id="ifDelete" style="padding:12px 16px;border:1px solid #eee;border-radius:8px;background:#fff;color:#c00;cursor:pointer;">삭제</button>' : ''}
        </div>
      </div>
    `;
    listEl.querySelector('#ifSave').addEventListener('click', async () => {
      const payload = {
        name: document.getElementById('ifName').value.trim(),
        quantity: parseInt(document.getElementById('ifQty').value, 10) || 0,
        unit: document.getElementById('ifUnit').value.trim() || '개',
        threshold: parseInt(document.getElementById('ifThreshold').value, 10) || 5,
      };
      if (!payload.name) { if (window.showToast) window.showToast('이름을 입력해 주세요'); return; }
      try {
        if (existing) {
          // PATCH 구현 간소화 — 삭제+재생성 대신 adjust로 수량 맞춤 후 threshold만 교체 (offline 한정)
          if (_isOffline) {
            const all = _loadOffline();
            const idx = all.findIndex(x => x.id === existing.id);
            if (idx >= 0) {
              all[idx] = { ...all[idx], name: payload.name, unit: payload.unit, quantity: payload.quantity, threshold: payload.threshold };
              _saveOffline(all);
              _items = all;
            }
          } else {
            await _api('PATCH', '/inventory/' + existing.id, payload);
            await list();
          }
        } else {
          await create(payload);
        }
        if (window.hapticLight) window.hapticLight();
        if (window.showToast) window.showToast(existing ? '수정 완료' : '추가 완료');
        _rerender();
      } catch (e) {
        console.warn('[inventory] save 실패:', e);
        if (window.showToast) window.showToast('저장 실패');
      }
    });
    if (existing) {
      listEl.querySelector('#ifDelete').addEventListener('click', async () => {
        if (!confirm('이 소모품을 삭제할까요?')) return;
        try {
          await remove(existing.id);
          if (window.hapticLight) window.hapticLight();
          _rerender();
        } catch (e) {
          if (window.showToast) window.showToast('삭제 실패');
        }
      });
    }
  }

  window._inventoryBack = _rerender;

  window.openInventory = async function () {
    const sheet = _ensureSheet();
    sheet.style.display = 'block';
    document.body.style.overflow = 'hidden';
    const listEl = sheet.querySelector('#inventoryList');
    listEl.innerHTML = '<div style="padding:30px;text-align:center;color:#aaa;">불러오는 중…</div>';
    try {
      await list();
      _rerender();
    } catch (e) {
      listEl.innerHTML = '<div style="padding:30px;text-align:center;color:#c00;">불러오기 실패</div>';
    }
  };

  window.closeInventory = function () {
    const sheet = document.getElementById('inventorySheet');
    if (sheet) sheet.style.display = 'none';
    document.body.style.overflow = '';
  };

  window.Inventory = {
    list, create, adjust, remove,
    get _items() { return _items; },
    get isOffline() { return _isOffline; },
    get lowStockCount() { return _lowStockCount(); },
  };
})();
