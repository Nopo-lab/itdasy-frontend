/* ─────────────────────────────────────────────────────────────
   네이버 플레이스 리뷰 수동 저장 (Phase 3 P3.1)
   엔드포인트:
   - GET    /naver-reviews
   - POST   /naver-reviews
   - PATCH  /naver-reviews/{id}
   - DELETE /naver-reviews/{id}

   네이버 자동 크롤링은 ToS 이슈. 사용자가 복붙으로 수동 입력.
   ──────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const OFFLINE_KEY = 'itdasy_naver_reviews_offline_v1';
  let _items = [];
  let _isOffline = false;

  function _uuid() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'nr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
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
      const d = await _api('GET', '/naver-reviews');
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
    const data = {
      review_url: payload.review_url || null,
      author_name: payload.author_name || null,
      rating: payload.rating != null ? parseInt(payload.rating, 10) : null,
      content: payload.content || null,
      visited_at: payload.visited_at || null,
      sticker_image_url: payload.sticker_image_url || null,
    };
    if (_isOffline) {
      const record = { id: _uuid(), shop_id: localStorage.getItem('shop_id') || 'offline', ...data, content: data.content || '', created_at: new Date().toISOString() };
      const all = _loadOffline();
      all.unshift(record);
      _saveOffline(all);
      _items.unshift(record);
      return record;
    }
    const created = await _api('POST', '/naver-reviews', data);
    _items.unshift(created);
    return created;
  }

  async function update(id, patch) {
    if (_isOffline) {
      const all = _loadOffline();
      const i = all.findIndex(x => x.id === id);
      if (i < 0) throw new Error('not-found');
      all[i] = { ...all[i], ...patch };
      _saveOffline(all);
      const j = _items.findIndex(x => x.id === id);
      if (j >= 0) _items[j] = all[i];
      return all[i];
    }
    const updated = await _api('PATCH', '/naver-reviews/' + id, patch);
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
    await _api('DELETE', '/naver-reviews/' + id);
    _items = _items.filter(x => x.id !== id);
    return { ok: true };
  }

  function _starLine(rating) {
    if (!rating) return '';
    const full = Math.max(0, Math.min(5, parseInt(rating, 10)));
    return '★'.repeat(full) + '☆'.repeat(5 - full);
  }

  // ── UI ──────────────────────────────────────────────────
  function _ensureSheet() {
    let sheet = document.getElementById('naverReviewSheet');
    if (sheet) return sheet;
    sheet = document.createElement('div');
    sheet.id = 'naverReviewSheet';
    sheet.style.cssText = 'position:fixed;inset:0;z-index:9998;display:none;background:rgba(0,0,0,0.4);';
    sheet.innerHTML = `
      <div style="position:absolute;inset:auto 0 0 0;background:var(--bg,#fff);border-radius:20px 20px 0 0;max-height:90vh;display:flex;flex-direction:column;padding:16px;padding-bottom:max(16px,env(safe-area-inset-bottom));">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <strong style="font-size:18px;">네이버 리뷰</strong>
          <span id="naverOfflineBadge" style="display:none;font-size:10px;padding:2px 6px;border-radius:4px;background:#f2c94c;color:#333;">오프라인</span>
          <button onclick="closeNaverReviews()" style="margin-left:auto;background:none;border:none;font-size:20px;cursor:pointer;" aria-label="닫기">✕</button>
        </div>
        <div style="font-size:11px;color:#888;margin-bottom:10px;line-height:1.5;">네이버 플레이스에서 받은 리뷰를 직접 복사해서 저장하세요. 자동 크롤링은 약관상 제한됩니다.</div>
        <div id="naverList" style="flex:1;overflow-y:auto;min-height:120px;"></div>
        <button id="naverAddBtn" style="margin-top:10px;padding:12px;border:none;border-radius:10px;background:var(--accent,#F18091);color:#fff;font-weight:700;font-size:15px;cursor:pointer;">+ 리뷰 추가</button>
      </div>
    `;
    document.body.appendChild(sheet);
    sheet.addEventListener('click', (e) => { if (e.target === sheet) closeNaverReviews(); });
    sheet.querySelector('#naverAddBtn').addEventListener('click', () => _openAddForm());
    return sheet;
  }

  function _rerender() {
    const sheet = document.getElementById('naverReviewSheet');
    if (!sheet) return;
    sheet.querySelector('#naverOfflineBadge').style.display = _isOffline ? 'inline-block' : 'none';
    const listEl = sheet.querySelector('#naverList');
    if (!_items.length) {
      listEl.innerHTML = '<div style="padding:30px;text-align:center;color:#aaa;font-size:13px;">아직 저장된 리뷰가 없어요</div>';
      return;
    }
    listEl.innerHTML = _items.map(r => `
      <div data-id="${r.id}" style="padding:12px 8px;border-bottom:1px solid #eee;cursor:pointer;">
        <div style="display:flex;align-items:baseline;gap:6px;">
          <span style="color:#FFB800;letter-spacing:-1px;">${_starLine(r.rating)}</span>
          <strong style="font-size:13px;">${_esc(r.author_name||'익명')}</strong>
          ${r.visited_at ? `<span style="font-size:10px;color:#888;">${_esc(r.visited_at)}</span>` : ''}
          <span style="margin-left:auto;font-size:10px;color:#bbb;">${new Date(r.created_at).toLocaleDateString('ko-KR')}</span>
        </div>
        ${r.content ? `<div style="font-size:12px;color:#555;margin-top:4px;line-height:1.5;max-height:4em;overflow:hidden;">${_esc(r.content).slice(0, 200)}${r.content.length > 200 ? '…' : ''}</div>` : ''}
      </div>
    `).join('');
    listEl.querySelectorAll('[data-id]').forEach(row => row.addEventListener('click', () => _openAddForm(row.dataset.id)));
  }

  function _openAddForm(id) {
    const existing = id ? _items.find(r => r.id === id) : null;
    const sheet = document.getElementById('naverReviewSheet');
    if (!sheet) return;
    const listEl = sheet.querySelector('#naverList');
    listEl.innerHTML = `
      <div style="padding:4px;">
        <button onclick="window._naverBack()" style="background:none;border:none;font-size:13px;color:#888;margin-bottom:10px;cursor:pointer;">← 목록</button>
        <label style="display:block;font-size:12px;color:#666;margin-bottom:4px;">네이버 리뷰 URL (선택)</label>
        <input id="nrUrl" value="${_esc(existing?.review_url||'')}" placeholder="https://pcmap.place.naver.com/..." style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;margin-bottom:10px;font-size:12px;" maxlength="500" />
        <div style="display:flex;gap:8px;margin-bottom:10px;">
          <div style="flex:1;">
            <label style="display:block;font-size:12px;color:#666;margin-bottom:4px;">작성자</label>
            <input id="nrAuthor" value="${_esc(existing?.author_name||'')}" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;" maxlength="50" />
          </div>
          <div style="width:100px;">
            <label style="display:block;font-size:12px;color:#666;margin-bottom:4px;">평점</label>
            <select id="nrRating" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;">
              <option value="">없음</option>
              ${[5,4,3,2,1].map(n => `<option value="${n}" ${existing?.rating === n ? 'selected' : ''}>${'★'.repeat(n)}</option>`).join('')}
            </select>
          </div>
        </div>
        <label style="display:block;font-size:12px;color:#666;margin-bottom:4px;">방문일 (YYYY-MM-DD)</label>
        <input id="nrVisited" type="date" value="${_esc(existing?.visited_at||'')}" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;margin-bottom:10px;" />
        <label style="display:block;font-size:12px;color:#666;margin-bottom:4px;">리뷰 내용 *</label>
        <textarea id="nrContent" rows="4" maxlength="2000" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;margin-bottom:10px;font-family:inherit;resize:vertical;" placeholder="네이버에서 복사한 리뷰 본문">${_esc(existing?.content||'')}</textarea>
        <div style="display:flex;gap:8px;">
          <button type="button" id="nrSave" style="flex:1;padding:12px;border:none;border-radius:8px;background:var(--accent,#F18091);color:#fff;font-weight:700;cursor:pointer;font-size:15px;">${existing ? '수정' : '저장'}</button>
          ${existing ? '<button type="button" id="nrDelete" style="padding:12px 16px;border:1px solid #eee;border-radius:8px;background:#fff;color:#c00;cursor:pointer;">삭제</button>' : ''}
        </div>
      </div>
    `;
    listEl.querySelector('#nrSave').addEventListener('click', async () => {
      const payload = {
        review_url: document.getElementById('nrUrl').value.trim() || null,
        author_name: document.getElementById('nrAuthor').value.trim() || null,
        rating: document.getElementById('nrRating').value || null,
        visited_at: document.getElementById('nrVisited').value || null,
        content: document.getElementById('nrContent').value.trim() || null,
      };
      if (!payload.content) { if (window.showToast) window.showToast('내용을 입력해 주세요'); return; }
      try {
        if (existing) await update(existing.id, payload);
        else await create(payload);
        if (window.hapticLight) window.hapticLight();
        if (window.showToast) window.showToast(existing ? '수정 완료' : '저장 완료');
        _rerender();
      } catch (e) {
        if (window.showToast) window.showToast('저장 실패');
      }
    });
    if (existing) {
      listEl.querySelector('#nrDelete').addEventListener('click', async () => {
        if (!confirm('이 리뷰를 삭제할까요?')) return;
        try { await remove(existing.id); if (window.hapticLight) window.hapticLight(); _rerender(); }
        catch (e) { if (window.showToast) window.showToast('삭제 실패'); }
      });
    }
  }

  window._naverBack = _rerender;

  window.openNaverReviews = async function () {
    const sheet = _ensureSheet();
    sheet.style.display = 'block';
    document.body.style.overflow = 'hidden';
    const listEl = sheet.querySelector('#naverList');
    listEl.innerHTML = '<div style="padding:30px;text-align:center;color:#aaa;">불러오는 중…</div>';
    try {
      await list();
      _rerender();
    } catch (e) {
      listEl.innerHTML = '<div style="padding:30px;text-align:center;color:#c00;">불러오기 실패</div>';
    }
  };

  window.closeNaverReviews = function () {
    const sheet = document.getElementById('naverReviewSheet');
    if (sheet) sheet.style.display = 'none';
    document.body.style.overflow = '';
  };

  window.NaverReview = {
    list, create, update, remove,
    get _items() { return _items; },
    get isOffline() { return _isOffline; },
  };
})();
