/* ─────────────────────────────────────────────────────────────
   NPS 응답 수집 (Phase 3 P3.2)
   엔드포인트:
   - GET    /nps
   - POST   /nps
   - DELETE /nps/{id}
   - GET    /nps/stats
   ──────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const OFFLINE_KEY = 'itdasy_nps_offline_v1';
  let _items = [];
  let _stats = null;
  let _isOffline = false;

  function _uuid() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'n_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
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

  function _computeStatsLocal(items) {
    const total = items.length;
    if (total === 0) return { total: 0, promoters: 0, passives: 0, detractors: 0, score: 0, avg_rating: 0 };
    const promoters = items.filter(i => i.rating >= 9).length;
    const detractors = items.filter(i => i.rating <= 6).length;
    const passives = total - promoters - detractors;
    const score = Math.round(((promoters - detractors) * 100 / total) * 10) / 10;
    const avg = Math.round((items.reduce((s, i) => s + (i.rating || 0), 0) / total) * 100) / 100;
    return { total, promoters, passives, detractors, score, avg_rating: avg };
  }

  async function list() {
    try {
      const d = await _api('GET', '/nps');
      _isOffline = false;
      _items = d.items || [];
      try { _stats = await _api('GET', '/nps/stats'); } catch (_) { _stats = _computeStatsLocal(_items); }
      return _items;
    } catch (e) {
      if (e.message === 'endpoint-missing' || e.message === 'no-token') {
        _isOffline = true;
        _items = _loadOffline();
        _stats = _computeStatsLocal(_items);
        return _items;
      }
      throw e;
    }
  }

  async function create(payload) {
    const rating = parseInt(payload.rating, 10);
    if (!Number.isFinite(rating) || rating < 0 || rating > 10) throw new Error('rating-out-of-range');
    const data = {
      rating,
      comment: payload.comment ? String(payload.comment).slice(0, 500) : null,
      customer_id: payload.customer_id || null,
      customer_name: payload.customer_name || null,
      source: payload.source || 'manual',
    };
    if (_isOffline) {
      const record = { id: _uuid(), shop_id: localStorage.getItem('shop_id') || 'offline', ...data, responded_at: new Date().toISOString(), created_at: new Date().toISOString() };
      const all = _loadOffline();
      all.unshift(record);
      _saveOffline(all);
      _items.unshift(record);
      _stats = _computeStatsLocal(_items);
      return record;
    }
    const created = await _api('POST', '/nps', data);
    _items.unshift(created);
    try { _stats = await _api('GET', '/nps/stats'); } catch (_) {}
    return created;
  }

  async function remove(id) {
    if (_isOffline) {
      const all = _loadOffline().filter(i => i.id !== id);
      _saveOffline(all);
      _items = _items.filter(i => i.id !== id);
      _stats = _computeStatsLocal(_items);
      return { ok: true };
    }
    await _api('DELETE', '/nps/' + id);
    _items = _items.filter(i => i.id !== id);
    try { _stats = await _api('GET', '/nps/stats'); } catch (_) {}
    return { ok: true };
  }

  // ── UI ──────────────────────────────────────────────────
  function _ensureSheet() {
    let sheet = document.getElementById('npsSheet');
    if (sheet) return sheet;
    sheet = document.createElement('div');
    sheet.id = 'npsSheet';
    sheet.style.cssText = 'position:fixed;inset:0;z-index:9998;display:none;background:rgba(0,0,0,0.4);';
    sheet.innerHTML = `
      <div style="position:absolute;inset:auto 0 0 0;background:var(--bg,#fff);border-radius:20px 20px 0 0;max-height:90vh;display:flex;flex-direction:column;padding:16px;padding-bottom:max(16px,env(safe-area-inset-bottom));">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <strong style="font-size:18px;">고객 만족도 (NPS)</strong>
          <span id="npsOfflineBadge" style="display:none;font-size:10px;padding:2px 6px;border-radius:4px;background:#f2c94c;color:#333;">오프라인</span>
          <button onclick="closeNps()" style="margin-left:auto;background:none;border:none;font-size:20px;cursor:pointer;" aria-label="닫기">✕</button>
        </div>
        <div id="npsStats"></div>
        <div id="npsList" style="flex:1;overflow-y:auto;min-height:120px;"></div>
        <button id="npsAddBtn" style="margin-top:10px;padding:12px;border:none;border-radius:10px;background:var(--accent,#F18091);color:#fff;font-weight:700;font-size:15px;cursor:pointer;">+ 응답 입력</button>
      </div>
    `;
    document.body.appendChild(sheet);
    sheet.addEventListener('click', (e) => { if (e.target === sheet) closeNps(); });
    sheet.querySelector('#npsAddBtn').addEventListener('click', _openAddForm);
    return sheet;
  }

  function _renderStats(s) {
    if (!s || s.total === 0) {
      return '<div style="padding:14px;background:#fafafa;border-radius:10px;margin-bottom:10px;text-align:center;color:#aaa;font-size:13px;">아직 응답 없음</div>';
    }
    const scoreColor = s.score >= 50 ? '#388e3c' : s.score >= 0 ? '#f57c00' : '#dc3545';
    return `
      <div style="padding:14px;background:linear-gradient(135deg,rgba(241,128,145,0.08),rgba(241,128,145,0.02));border-radius:12px;margin-bottom:10px;">
        <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:8px;">
          <strong style="font-size:28px;color:${scoreColor};">${s.score}</strong>
          <span style="font-size:11px;color:#888;">NPS 점수 (100 만점 · ${s.total}명)</span>
        </div>
        <div style="display:flex;gap:6px;font-size:11px;">
          <span style="flex:1;padding:6px 8px;background:rgba(76,175,80,0.1);color:#388e3c;border-radius:6px;text-align:center;">😍 추천 ${s.promoters}</span>
          <span style="flex:1;padding:6px 8px;background:rgba(255,193,7,0.1);color:#f57c00;border-radius:6px;text-align:center;">😐 중립 ${s.passives}</span>
          <span style="flex:1;padding:6px 8px;background:rgba(220,53,69,0.1);color:#dc3545;border-radius:6px;text-align:center;">😞 비추 ${s.detractors}</span>
        </div>
        <div style="font-size:11px;color:#666;margin-top:6px;">평균 평점 ${s.avg_rating}/10</div>
      </div>
    `;
  }

  function _renderRow(r) {
    const face = r.rating >= 9 ? '😍' : r.rating >= 7 ? '😐' : '😞';
    const color = r.rating >= 9 ? '#388e3c' : r.rating >= 7 ? '#f57c00' : '#dc3545';
    const t = new Date(r.responded_at || r.created_at);
    const date = `${t.getMonth() + 1}/${t.getDate()}`;
    return `
      <div style="padding:10px 6px;border-bottom:1px solid #eee;display:flex;gap:10px;align-items:flex-start;">
        <span style="font-size:22px;">${face}</span>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:baseline;gap:6px;">
            <strong style="color:${color};font-size:16px;">${r.rating}</strong>
            ${r.customer_name ? `<span style="font-size:12px;color:#666;">· ${_esc(r.customer_name)}</span>` : ''}
            <span style="margin-left:auto;font-size:11px;color:#999;">${date}</span>
          </div>
          ${r.comment ? `<div style="font-size:12px;color:#666;margin-top:2px;line-height:1.4;">${_esc(r.comment)}</div>` : ''}
        </div>
        <button data-del="${r.id}" style="background:none;border:none;color:#c00;font-size:14px;cursor:pointer;padding:4px;">🗑</button>
      </div>
    `;
  }

  function _rerender() {
    const sheet = document.getElementById('npsSheet');
    if (!sheet) return;
    sheet.querySelector('#npsStats').innerHTML = _renderStats(_stats);
    sheet.querySelector('#npsOfflineBadge').style.display = _isOffline ? 'inline-block' : 'none';
    const listEl = sheet.querySelector('#npsList');
    if (!_items.length) {
      listEl.innerHTML = '<div style="padding:30px;text-align:center;color:#aaa;font-size:13px;">아직 응답이 없어요</div>';
      return;
    }
    listEl.innerHTML = _items.map(_renderRow).join('');
    listEl.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', () => _deleteEntry(btn.dataset.del)));
  }

  function _openAddForm() {
    const sheet = document.getElementById('npsSheet');
    if (!sheet) return;
    const listEl = sheet.querySelector('#npsList');
    listEl.innerHTML = `
      <div style="padding:4px;">
        <button onclick="window._npsBack()" style="background:none;border:none;font-size:13px;color:#888;margin-bottom:10px;cursor:pointer;">← 목록</button>
        <label style="display:block;font-size:12px;color:#666;margin-bottom:4px;">추천 점수 (0~10) *</label>
        <input id="nfRating" type="range" min="0" max="10" value="8" style="width:100%;margin-bottom:4px;" />
        <div id="nfRatingLabel" style="text-align:center;font-size:32px;font-weight:800;color:var(--accent,#F18091);margin-bottom:10px;">8</div>
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:10px;">
          <input id="nfCustomerName" readonly style="flex:1;padding:10px;border:1px solid #ddd;border-radius:8px;background:#fafafa;" placeholder="고객 (선택)" />
          <button type="button" id="nfCustomerPick" style="padding:10px 14px;border:1px solid #ddd;border-radius:8px;background:#fff;cursor:pointer;font-size:12px;">👤 선택</button>
        </div>
        <label style="display:block;font-size:12px;color:#666;margin-bottom:4px;">코멘트 (선택)</label>
        <textarea id="nfComment" rows="3" maxlength="500" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;margin-bottom:10px;font-family:inherit;resize:vertical;"></textarea>
        <button type="button" id="nfSave" style="width:100%;padding:12px;border:none;border-radius:8px;background:var(--accent,#F18091);color:#fff;font-weight:700;cursor:pointer;font-size:15px;">저장</button>
      </div>
    `;
    const ratingEl = document.getElementById('nfRating');
    const labelEl = document.getElementById('nfRatingLabel');
    ratingEl.addEventListener('input', () => { labelEl.textContent = ratingEl.value; });
    let customer_id = null;
    listEl.querySelector('#nfCustomerPick').addEventListener('click', async () => {
      if (!window.Customer || !window.Customer.pick) { if (window.showToast) window.showToast('고객 모듈 로드 중…'); return; }
      const picked = await window.Customer.pick();
      if (picked === null) return;
      customer_id = picked.id;
      listEl.querySelector('#nfCustomerName').value = picked.name || '';
    });
    listEl.querySelector('#nfSave').addEventListener('click', async () => {
      try {
        await create({
          rating: parseInt(ratingEl.value, 10),
          comment: document.getElementById('nfComment').value.trim() || null,
          customer_id,
          customer_name: listEl.querySelector('#nfCustomerName').value.trim() || null,
        });
        if (window.hapticLight) window.hapticLight();
        if (window.showToast) window.showToast('저장 완료');
        _rerender();
      } catch (e) {
        if (window.showToast) window.showToast('저장 실패');
      }
    });
  }

  window._npsBack = _rerender;

  async function _deleteEntry(id) {
    if (!confirm('이 응답을 삭제할까요?')) return;
    try {
      await remove(id);
      if (window.hapticLight) window.hapticLight();
      _rerender();
    } catch (e) {
      if (window.showToast) window.showToast('삭제 실패');
    }
  }

  window.openNps = async function () {
    const sheet = _ensureSheet();
    sheet.style.display = 'block';
    document.body.style.overflow = 'hidden';
    const listEl = sheet.querySelector('#npsList');
    listEl.innerHTML = '<div style="padding:30px;text-align:center;color:#aaa;">불러오는 중…</div>';
    try {
      await list();
      _rerender();
    } catch (e) {
      listEl.innerHTML = '<div style="padding:30px;text-align:center;color:#c00;">불러오기 실패</div>';
    }
  };

  window.closeNps = function () {
    const sheet = document.getElementById('npsSheet');
    if (sheet) sheet.style.display = 'none';
    document.body.style.overflow = '';
  };

  window.Nps = {
    list, create, remove,
    get _items() { return _items; },
    get _stats() { return _stats; },
    get isOffline() { return _isOffline; },
  };
})();
