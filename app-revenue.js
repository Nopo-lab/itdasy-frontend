/* ─────────────────────────────────────────────────────────────
   매출 관리 (Phase 2 P0-3) — 간이 입력 + 3탭 대시보드

   엔드포인트 (shared/schemas.json 참조):
   - GET    /revenue?period=today|week|month
   - POST   /revenue
   - DELETE /revenue/{id}

   특징:
   - 백엔드 미배포 시 localStorage 오프라인 폴백
   - 경량 SVG 바차트 (일/주/월 각 7~31칸)
   - Customer.pick() 재사용으로 고객 선택
   - openRevenue() 로 외부 진입
   ──────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const OFFLINE_KEY = 'itdasy_revenue_offline_v1';
  const PERIODS = ['today', 'week', 'month'];
  const PERIOD_LABEL = { today: '오늘', week: '이번주', month: '이번달' };
  let _currentPeriod = 'today';
  let _items = [];
  // [렉 박멸 2026-04-26] 리스트 windowing 사이즈 (50개씩 더 보기)
  let _revWindow = 50;
  let _isOffline = false;

  function _now() { return new Date().toISOString(); }
  function _uuid() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
  }
  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  }

  // ── 기간 계산 ────────────────────────────────────────────
  function _periodRange(period, baseDate) {
    const now = baseDate ? new Date(baseDate) : new Date();
    const start = new Date(now);
    const end = new Date(now);
    if (period === 'today') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (period === 'week') {
      const day = start.getDay();
      const mondayOffset = (day + 6) % 7;
      start.setDate(start.getDate() - mondayOffset);
      start.setHours(0, 0, 0, 0);
      end.setTime(start.getTime() + 7 * 24 * 3600 * 1000 - 1);
    } else { // month
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
    }
    return { start, end };
  }

  // ── 오프라인 스토어 ─────────────────────────────────────
  function _loadOffline() {
    try { return JSON.parse(localStorage.getItem(OFFLINE_KEY) || '[]'); }
    catch (_) { return []; }
  }
  function _saveOffline(list) {
    try { localStorage.setItem(OFFLINE_KEY, JSON.stringify(list)); } catch (_) { void _; }
  }

  // ── 네트워크 공통 ───────────────────────────────────────
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

  // [2026-04-26 0초딜레이] SWR 캐시 — 기간별 키 분리
  const _SWR_TTL = 60 * 1000;
  function _swrKey(p) { return 'pv_cache::revenue::' + p; }
  function _readSWRPeriod(p) {
    try {
      const raw = localStorage.getItem(_swrKey(p)) || sessionStorage.getItem(_swrKey(p));
      if (!raw) return null;
      const obj = JSON.parse(raw);
      return { items: obj.d, age: Date.now() - obj.t, fresh: Date.now() - obj.t < _SWR_TTL };
    } catch (_) { return null; }
  }
  function _writeSWRPeriod(p, items) {
    try {
      const payload = JSON.stringify({ t: Date.now(), d: items });
      try { localStorage.setItem(_swrKey(p), payload); }
      catch (_) { try { sessionStorage.setItem(_swrKey(p), payload); } catch (_e) { void _e; } }
    } catch (_) { /* silent */ }
  }
  function _clearSWRRevenue() {
    try {
      const ks = ['today', 'week', 'month'].map(_swrKey);
      ks.forEach(k => { try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch (_e) { void _e; } });
      // 레거시 키도 청소
      try { localStorage.removeItem('pv_cache::revenue'); sessionStorage.removeItem('pv_cache::revenue'); } catch (_e) { void _e; }
    } catch (_) { /* silent */ }
  }

  async function _fetchPeriod(p) {
    const d = await _api('GET', '/revenue?period=' + p);
    _isOffline = false;
    _items = d.items || [];
    _writeSWRPeriod(p, _items);
    return _items;
  }

  async function list(period) {
    const p = PERIODS.includes(period) ? period : 'today';
    // 1) SWR 캐시 즉시 사용 (0ms)
    const swr = _readSWRPeriod(p);
    if (swr) {
      _items = swr.items;
      // 오래됐으면 백그라운드 갱신
      if (!swr.fresh) {
        _fetchPeriod(p).then(fresh => {
          if (JSON.stringify(_items) !== JSON.stringify(fresh)) {
            _items = fresh;
            try { _rerender && _rerender(); } catch (_e) { void _e; }
          }
        }).catch(() => {});
      }
      return _items;
    }
    // 2) 캐시 없음 — 첫 진입 fetch
    try {
      return await _fetchPeriod(p);
    } catch (e) {
      if (e.message === 'endpoint-missing' || e.message === 'no-token') {
        _isOffline = true;
        const { start, end } = _periodRange(p);
        const all = _loadOffline();
        _items = all.filter(r => {
          const t = new Date(r.recorded_at || r.created_at).getTime();
          return t >= start.getTime() && t <= end.getTime();
        });
        return _items;
      }
      throw e;
    }
  }

  async function create(payload) {
    if (!payload || !(+payload.amount > 0)) throw new Error('amount-required');
    const data = {
      amount: Math.round(+payload.amount),
      method: payload.method || 'card',
      service_name: payload.service_name ? String(payload.service_name).slice(0, 50) : null,
      customer_id: payload.customer_id || null,
      customer_name: payload.customer_name || null,
      memo: payload.memo ? String(payload.memo).slice(0, 200) : null,
      recorded_at: payload.recorded_at || _now(),
    };
    if (_isOffline) {
      const record = {
        id: _uuid(),
        shop_id: localStorage.getItem('shop_id') || 'offline',
        ...data,
        created_at: _now(),
      };
      const all = _loadOffline();
      all.unshift(record);
      _saveOffline(all);
      // [2026-04-26 A9] 오프라인도 알리기
      try { window.dispatchEvent(new CustomEvent('itdasy:data-changed', { detail: { kind: 'create_revenue', optimistic: false } })); } catch (_e) { void _e; }
      return record;
    }
    // [2026-04-26 A9 픽스] 옵티미스틱 UI — 로컬 _items 에 즉시 추가 + 즉시 이벤트 발사
    const optimisticRecord = {
      id: '__opt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      shop_id: localStorage.getItem('shop_id') || '',
      ...data,
      created_at: _now(),
      _optimistic: true,
    };
    _items.unshift(optimisticRecord);
    try { window.dispatchEvent(new CustomEvent('itdasy:data-changed', { detail: { kind: 'create_revenue', optimistic: true } })); } catch (_e) { void _e; }
    try {
      const created = await _api('POST', '/revenue', data);
      // 옵티미스틱 항목을 실 데이터로 교체
      const idx = _items.findIndex(r => r.id === optimisticRecord.id);
      if (idx >= 0) _items[idx] = created;
      else _items.unshift(created);
      // [2026-04-26 0초딜레이] SWR 캐시 invalidate (다음 진입 시 fresh)
      _clearSWRRevenue();
      try { window.dispatchEvent(new CustomEvent('itdasy:data-changed', { detail: { kind: 'create_revenue', optimistic: false } })); } catch (_e) { void _e; }
      return created;
    } catch (err) {
      _items = _items.filter(r => r.id !== optimisticRecord.id);
      try { window.dispatchEvent(new CustomEvent('itdasy:data-changed', { detail: { kind: 'create_revenue', optimistic: false, rollback: true } })); } catch (_e) { void _e; }
      if (window.showToast) window.showToast('매출 저장 실패 — 다시 시도해주세요');
      throw err;
    }
  }

  async function remove(id) {
    if (_isOffline) {
      const all = _loadOffline().filter(r => r.id !== id);
      _saveOffline(all);
      // [2026-04-26 A9] mutation 이벤트 누락 보충
      try { window.dispatchEvent(new CustomEvent('itdasy:data-changed', { detail: { kind: 'delete_revenue', optimistic: false } })); } catch (_e) { void _e; }
      return { ok: true };
    }
    await _api('DELETE', '/revenue/' + id);
    _items = _items.filter(r => r.id !== id);
    _clearSWRRevenue();
    // [2026-04-26 A9] mutation 이벤트 누락 보충
    try { window.dispatchEvent(new CustomEvent('itdasy:data-changed', { detail: { kind: 'delete_revenue', optimistic: false } })); } catch (_e) { void _e; }
    return { ok: true };
  }

  // ── 집계 ────────────────────────────────────────────────
  function _aggregate(items, period) {
    const now = new Date();
    if (period === 'today') {
      const buckets = Array.from({ length: 24 }, (_, h) => ({ label: String(h).padStart(2, '0'), v: 0 }));
      items.forEach(r => {
        const h = new Date(r.recorded_at || r.created_at).getHours();
        if (h >= 0 && h < 24) buckets[h].v += r.amount || 0;
      });
      return buckets;
    }
    if (period === 'week') {
      const { start } = _periodRange('week');
      const buckets = ['월', '화', '수', '목', '금', '토', '일'].map(l => ({ label: l, v: 0 }));
      items.forEach(r => {
        const d = new Date(r.recorded_at || r.created_at);
        const idx = Math.floor((d.getTime() - start.getTime()) / (24 * 3600 * 1000));
        if (idx >= 0 && idx < 7) buckets[idx].v += r.amount || 0;
      });
      return buckets;
    }
    // month
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const buckets = Array.from({ length: daysInMonth }, (_, i) => ({ label: String(i + 1), v: 0 }));
    items.forEach(r => {
      const d = new Date(r.recorded_at || r.created_at).getDate();
      if (d >= 1 && d <= daysInMonth) buckets[d - 1].v += r.amount || 0;
    });
    return buckets;
  }

  function _renderChart(buckets) {
    const max = Math.max(1, ...buckets.map(b => b.v));
    const W = 320, H = 120, padL = 8, padR = 8, padB = 18;
    const innerW = W - padL - padR;
    const barW = innerW / buckets.length;
    const bars = buckets.map((b, i) => {
      const bh = b.v > 0 ? Math.max(1, ((H - padB) - 4) * (b.v / max)) : 0;
      const x = padL + i * barW + 1;
      const y = H - padB - bh;
      return `<rect x="${x}" y="${y}" width="${Math.max(1, barW - 2)}" height="${bh}" rx="2" fill="${b.v > 0 ? 'var(--accent,#F18091)' : 'rgba(0,0,0,0.06)'}"/>`;
    }).join('');
    const everyN = buckets.length <= 7 ? 1 : (buckets.length <= 24 ? 4 : 5);
    const labels = buckets.map((b, i) =>
      (i % everyN === 0) ?
        `<text x="${padL + i * barW + barW / 2}" y="${H - 4}" font-size="9" fill="#999" text-anchor="middle">${b.label}</text>`
        : ''
    ).join('');
    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:120px;" preserveAspectRatio="none">${bars}${labels}</svg>`;
  }

  function _formatKRW(n) {
    return (+n || 0).toLocaleString('ko-KR') + '원';
  }

  // ── 인센티브 계산 (1인샵 본인 순수익) ────────────────────
  const INCENTIVE_KEY = 'itdasy_incentive_settings_v1';
  function _incentiveSettings() {
    try {
      const raw = localStorage.getItem(INCENTIVE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) { void _; }
    return { material_pct: 15, fixed_monthly: 0 }; // 재료비 15%, 월고정비 0
  }
  function _saveIncentive(s) {
    try { localStorage.setItem(INCENTIVE_KEY, JSON.stringify(s)); } catch (_) { void _; }
  }
  function _calcIncentive(totalKRW) {
    const s = _incentiveSettings();
    const material = Math.round(totalKRW * (s.material_pct / 100));
    const net = totalKRW - material - (s.fixed_monthly || 0);
    return { gross: totalKRW, material, fixed: s.fixed_monthly || 0, net, settings: s };
  }
  function _renderIncentiveCard(totalKRW) {
    const c = _calcIncentive(totalKRW);
    return `
      <div style="margin-top:14px;padding:12px;background:linear-gradient(135deg,rgba(76,175,80,0.08),rgba(76,175,80,0.02));border-radius:12px;">
        <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:6px;">
          <strong style="font-size:13px;">이번달 순수익</strong>
          <button id="incentiveSettingsBtn" style="margin-left:auto;background:none;border:none;font-size:11px;color:#888;cursor:pointer;">⚙ 설정</button>
        </div>
        <div style="font-size:24px;font-weight:800;color:#388e3c;">${_formatKRW(c.net)}</div>
        <div style="display:flex;gap:12px;margin-top:8px;font-size:11px;color:#666;">
          <span>매출 ${_formatKRW(c.gross)}</span>
          <span>− 재료비 ${_formatKRW(c.material)} (${c.settings.material_pct}%)</span>
          ${c.fixed > 0 ? `<span>− 고정비 ${_formatKRW(c.fixed)}</span>` : ''}
        </div>
      </div>
    `;
  }
  function _openIncentiveSettings() {
    const s = _incentiveSettings();
    const pct = prompt('재료비율 (%) — 매출 중 재료비로 차감할 비율', String(s.material_pct));
    if (pct === null) return;
    const fixed = prompt('월 고정비 (원) — 월세·통신·보험 등', String(s.fixed_monthly));
    if (fixed === null) return;
    const np = Math.max(0, Math.min(100, parseFloat(pct) || 0));
    const nf = Math.max(0, parseInt(fixed, 10) || 0);
    _saveIncentive({ material_pct: np, fixed_monthly: nf });
    if (window.showToast) window.showToast('설정 저장됨');
    _rerender();
  }

  // ── UI ──────────────────────────────────────────────────
  function _ensureSheet() {
    let sheet = document.getElementById('revenueSheet');
    if (sheet) return sheet;
    sheet = document.createElement('div');
    sheet.id = 'revenueSheet';
    sheet.style.cssText = 'position:fixed;inset:0;z-index:9998;display:none;background:rgba(0,0,0,0.4);';
    sheet.innerHTML = `
      <div style="position:absolute;inset:auto 0 0 0;background:var(--bg,#fff);border-radius:20px 20px 0 0;max-height:90vh;display:flex;flex-direction:column;padding:16px;padding-bottom:max(16px,env(safe-area-inset-bottom));">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <strong style="font-size:18px;">매출</strong>
          <span id="revenueOfflineBadge" style="display:none;font-size:10px;padding:2px 6px;border-radius:4px;background:#f2c94c;color:#333;">오프라인</span>
          <button onclick="closeRevenue()" style="margin-left:auto;background:none;border:none;font-size:20px;cursor:pointer;" aria-label="닫기">✕</button>
        </div>
        <div id="revenueTabs" style="display:flex;gap:4px;margin-bottom:10px;"></div>
        <div id="revenueSummary" style="padding:12px;background:linear-gradient(135deg,rgba(241,128,145,0.08),rgba(241,128,145,0.02));border-radius:12px;margin-bottom:10px;"></div>
        <div id="revenueChart" style="margin-bottom:10px;"></div>
        <div id="revenueList" style="flex:1;overflow-y:auto;min-height:100px;"></div>
        <button id="revenueAddBtn" style="margin-top:10px;padding:12px;border:none;border-radius:10px;background:var(--accent,#F18091);color:#fff;font-weight:700;font-size:15px;cursor:pointer;">+ 매출 입력</button>
      </div>
    `;
    document.body.appendChild(sheet);
    sheet.addEventListener('click', (e) => { if (e.target === sheet) closeRevenue(); });
    sheet.querySelector('#revenueAddBtn').addEventListener('click', _openAddForm);
    return sheet;
  }

  function _rerender() {
    const sheet = document.getElementById('revenueSheet');
    if (!sheet) return;
    const tabs = sheet.querySelector('#revenueTabs');
    tabs.innerHTML = PERIODS.map(p => `
      <button data-period="${p}" style="flex:1;padding:10px;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700;background:${p === _currentPeriod ? 'var(--accent,#F18091)' : 'rgba(0,0,0,0.04)'};color:${p === _currentPeriod ? '#fff' : '#666'};">${PERIOD_LABEL[p]}</button>
    `).join('');
    tabs.querySelectorAll('[data-period]').forEach(btn => {
      btn.addEventListener('click', async () => {
        _currentPeriod = btn.dataset.period;
        _revWindow = 50; // 기간 바뀌면 window 리셋
        await _loadAndRender();
      });
    });

    const total = _items.reduce((s, r) => s + (r.amount || 0), 0);
    const count = _items.length;
    sheet.querySelector('#revenueSummary').innerHTML = `
      <div style="display:flex;align-items:baseline;gap:8px;">
        <strong style="font-size:22px;color:var(--accent,#F18091);">${_formatKRW(total)}</strong>
        <span style="font-size:12px;color:#888;">${PERIOD_LABEL[_currentPeriod]} · ${count}건</span>
      </div>
    `;

    sheet.querySelector('#revenueChart').innerHTML = _renderChart(_aggregate(_items, _currentPeriod)) +
      (_currentPeriod === 'month' ? _renderIncentiveCard(total) : '') +
      `<div id="revMembershipShare" style="margin-top:8px;"></div>` +
      `<div id="revStaffStats" style="margin-top:8px;"></div>`;
    // [2026-04-29] 결제 방식별 도넛 차트 + 회원권 매출 share
    (async () => {
      try {
        const r = await _api('GET', '/memberships/revenue-breakdown?period=' + _currentPeriod);
        if (!r || !r.total) return;
        const box = sheet.querySelector('#revMembershipShare');
        if (!box) return;
        const labels = { card: '카드', cash: '현금', transfer: '계좌', membership: '회원권', etc: '기타' };
        const colors = { card: '#F18091', cash: '#10B981', transfer: '#0288D1', membership: '#A78BFA', etc: '#9CA3AF' };
        const methods = Object.entries(r.by_method || {})
          .map(([k, v]) => ({ k, label: labels[k] || k, total: v.total || 0, count: v.count || 0, color: colors[k] || '#9CA3AF' }))
          .filter(x => x.total > 0)
          .sort((a, b) => b.total - a.total);
        if (!methods.length) return;
        // CSS conic-gradient 도넛
        const total = r.total || 1;
        let acc = 0;
        const slices = methods.map(m => {
          const pct = m.total / total;
          const start = acc;
          acc += pct;
          return `${m.color} ${(start * 100).toFixed(2)}% ${(acc * 100).toFixed(2)}%`;
        }).join(', ');
        box.innerHTML = `
          <div style="padding:14px;background:#fff;border:1px solid #e5e5e5;border-radius:10px;display:flex;align-items:center;gap:14px;">
            <div style="width:80px;height:80px;border-radius:50%;background:conic-gradient(${slices});flex-shrink:0;position:relative;">
              <div style="position:absolute;inset:18px;background:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#666;text-align:center;line-height:1.2;">${total >= 1000000 ? Math.floor(total/10000) + '만' : Math.floor(total/1000) + '천'}</div>
            </div>
            <div style="flex:1;display:flex;flex-direction:column;gap:5px;">
              ${methods.map(m => `
                <div style="display:flex;align-items:center;gap:6px;font-size:11px;">
                  <span style="width:10px;height:10px;border-radius:2px;background:${m.color};"></span>
                  <span style="color:#333;font-weight:600;flex:1;">${m.label}</span>
                  <span style="color:#666;">${m.total.toLocaleString()}원</span>
                  <span style="color:#999;font-size:10px;">${Math.round(m.total*100/total)}%</span>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      } catch (_e) { void _e; }
    })();
    // [2026-04-29] 직원별 매출 — Pro/Premium 직원 등록된 경우만 표시
    (async () => {
      try {
        if (!window.StaffUI || typeof window.StaffUI.list !== 'function') return;
        const staffData = await window.StaffUI.list();
        const items = (staffData && staffData.items) || [];
        if (!items.length) return;
        // 모든 직원 stats 동시 fetch
        const stats = await Promise.all(items.map(async (s) => {
          try {
            const r = await _api('GET', `/staff/${s.id}/stats?period=${_currentPeriod}`);
            return { staff: s, ...r };
          } catch (_) { return { staff: s, total_amount: 0, completed_count: 0, avg_amount: 0 }; }
        }));
        const sorted = stats.filter(x => x.total_amount > 0)
          .sort((a, b) => (b.total_amount || 0) - (a.total_amount || 0));
        if (!sorted.length) return;
        const max = sorted[0].total_amount || 1;
        const box = sheet.querySelector('#revStaffStats');
        if (!box) return;
        box.innerHTML = `
          <div style="padding:12px;background:#fff;border:1px solid #e5e5e5;border-radius:10px;">
            <div style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:#555;margin-bottom:10px;">
              <svg width="14" height="14"><use href="#ic-users"/></svg>직원별 매출
            </div>
            ${sorted.map(s => {
              const pct = Math.round((s.total_amount || 0) * 100 / max);
              const color = (s.staff.color || '#A78BFA').replace(/[<>"]/g, '');
              return `
                <div style="margin-bottom:8px;">
                  <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
                    <span style="font-weight:600;color:#333;">${(s.staff.name || '').replace(/[<>&"]/g,'')}${s.staff.role ? ' · '+(s.staff.role).replace(/[<>&"]/g,'') : ''}</span>
                    <span style="color:#666;">${(s.total_amount).toLocaleString()}원 · ${s.completed_count}건</span>
                  </div>
                  <div style="height:6px;background:#f3f4f6;border-radius:6px;overflow:hidden;">
                    <div style="height:100%;width:${pct}%;background:${color};border-radius:6px;"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      } catch (_e) { void _e; }
    })();
    sheet.querySelector('#revenueOfflineBadge').style.display = _isOffline ? 'inline-block' : 'none';
    const incBtn = sheet.querySelector('#incentiveSettingsBtn');
    if (incBtn) incBtn.addEventListener('click', _openIncentiveSettings);

    const listEl = sheet.querySelector('#revenueList');
    if (!_items.length) {
      listEl.innerHTML = '<div style="padding:30px;text-align:center;color:#aaa;font-size:13px;">아직 기록이 없어요</div>';
      return;
    }
    const sorted = [..._items].sort((a, b) =>
      new Date(b.recorded_at || b.created_at) - new Date(a.recorded_at || a.created_at)
    );
    // [렉 박멸 2026-04-26] windowing — 매출 1000건 한 번에 → 첫 50건 + 더 보기
    if (_revWindow == null) _revWindow = 50;
    const revVisible = sorted.slice(0, _revWindow);
    const revHasMore = sorted.length > _revWindow;
    listEl.innerHTML = revVisible.map(r => {
      const t = new Date(r.recorded_at || r.created_at);
      const hhmm = String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
      const dd = String(t.getMonth() + 1) + '/' + String(t.getDate());
      return `
        <div style="display:flex;align-items:center;gap:8px;padding:10px 4px;border-bottom:1px solid #eee;">
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:baseline;gap:6px;">
              <strong style="font-size:15px;">${_formatKRW(r.amount)}</strong>
              ${r.service_name ? `<span style="font-size:12px;color:#666;">${_esc(r.service_name)}</span>` : ''}
            </div>
            <div style="font-size:11px;color:#999;margin-top:2px;">
              ${_currentPeriod === 'today' ? hhmm : dd + ' ' + hhmm}
              ${r.customer_name ? ` · 👤 ${_esc(r.customer_name)}` : ''}
              · ${_methodLabel(r.method)}
            </div>
            ${r.memo ? `<div style="font-size:11px;color:#888;margin-top:2px;">${_esc(r.memo).slice(0,40)}</div>` : ''}
          </div>
          <button data-del="${r.id}" style="background:none;border:none;color:#c00;font-size:16px;cursor:pointer;padding:4px;">🗑</button>
        </div>
      `;
    }).join('')
      + (revHasMore
          ? `<button id="revenueLoadMore" type="button" style="width:100%;margin-top:8px;padding:11px;border:1px dashed hsl(220,15%,80%);border-radius:12px;background:#fafafa;color:#555;font-size:13px;font-weight:600;cursor:pointer;">+ ${sorted.length - _revWindow}건 더 보기</button>`
          : '');
    const revMore = listEl.querySelector('#revenueLoadMore');
    if (revMore) {
      revMore.addEventListener('click', () => { _revWindow += 50; _rerender && _rerender(); }, { once: true });
    }
    listEl.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', () => _deleteEntry(btn.dataset.del));
    });
  }

  function _methodLabel(m) {
    return { card: '카드', cash: '현금', transfer: '계좌이체', etc: '기타' }[m] || '카드';
  }

  function _openAddForm() {
    const sheet = document.getElementById('revenueSheet');
    if (!sheet) return;
    const listEl = sheet.querySelector('#revenueList');
    listEl.innerHTML = `
      <div data-form-id="revenue-add" style="padding:4px;">
        <button onclick="window._revenueBack()" style="background:none;border:none;font-size:13px;color:#888;margin-bottom:10px;cursor:pointer;">← 목록</button>
        <label style="display:block;font-size:12px;color:#666;margin-bottom:4px;">금액 (원) *</label>
        <input id="rfAmount" name="rfAmount" type="number" inputmode="numeric" style="width:100%;padding:12px;border:1px solid #ddd;border-radius:8px;margin-bottom:10px;font-size:16px;" placeholder="50000" />
        <div style="display:flex;gap:6px;margin-bottom:10px;">
          ${['card','cash','transfer','etc'].map(m => `
            <button type="button" data-rf-method="${m}" style="flex:1;padding:10px;border:1px solid #ddd;border-radius:8px;background:#fff;cursor:pointer;font-size:12px;">${_methodLabel(m)}</button>
          `).join('')}
        </div>
        <label style="display:block;font-size:12px;color:#666;margin-bottom:4px;">서비스</label>
        <input id="rfService" name="rfService" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;margin-bottom:10px;" placeholder="속눈썹 풀세트" maxlength="50" />
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:10px;">
          <input id="rfCustomerName" readonly style="flex:1;padding:10px;border:1px solid #ddd;border-radius:8px;background:#fafafa;" placeholder="고객 (선택)" />
          <button type="button" id="rfCustomerPick" style="padding:10px 14px;border:1px solid #ddd;border-radius:8px;background:#fff;cursor:pointer;font-size:12px;">👤 선택</button>
        </div>
        <!-- [2026-04-29 W5] 회원권 결제 토글 — 고객 선택 시에만 표시 -->
        <label id="rfMembershipToggle" style="display:none;align-items:center;gap:8px;padding:10px;background:#F3E8FF;border:1px solid #A78BFA;border-radius:8px;margin-bottom:10px;cursor:pointer;font-size:13px;">
          <input type="checkbox" id="rfUseMembership" style="width:18px;height:18px;cursor:pointer;">
          <span>💳 회원권으로 결제 (잔액 자동 차감)</span>
          <span id="rfMembershipBalance" style="margin-left:auto;font-size:11px;color:#6B21A8;font-weight:700;"></span>
        </label>
        <label style="display:block;font-size:12px;color:#666;margin-bottom:4px;">메모</label>
        <textarea id="rfMemo" name="rfMemo" rows="2" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;margin-bottom:10px;font-family:inherit;resize:vertical;" maxlength="200"></textarea>
        <button type="button" id="rfSave" data-mutation style="width:100%;padding:12px;border:none;border-radius:8px;background:var(--accent,#F18091);color:#fff;font-weight:700;cursor:pointer;font-size:15px;">저장</button>
      </div>
    `;
    let method = 'card';
    let customer_id = null;
    const setMethod = (m) => {
      method = m;
      listEl.querySelectorAll('[data-rf-method]').forEach(b => {
        const on = b.dataset.rfMethod === m;
        b.style.background = on ? 'var(--accent,#F18091)' : '#fff';
        b.style.color = on ? '#fff' : '#333';
        b.style.borderColor = on ? 'var(--accent,#F18091)' : '#ddd';
      });
    };
    setMethod('card');
    listEl.querySelectorAll('[data-rf-method]').forEach(b => b.addEventListener('click', () => setMethod(b.dataset.rfMethod)));

    listEl.querySelector('#rfCustomerPick').addEventListener('click', async () => {
      if (!window.Customer || !window.Customer.pick) {
        if (window.showToast) window.showToast('고객 모듈 로드 중…');
        return;
      }
      const picked = await window.Customer.pick();
      if (picked === null) return;
      customer_id = picked.id;
      listEl.querySelector('#rfCustomerName').value = picked.name || '';
      // [2026-04-29 W5] 회원권 토글 — 활성 회원권 + 잔액 있을 때만
      const memToggle = listEl.querySelector('#rfMembershipToggle');
      const memBal = listEl.querySelector('#rfMembershipBalance');
      const memCheck = listEl.querySelector('#rfUseMembership');
      if (memCheck) memCheck.checked = false;
      if (picked.membership_active && (picked.membership_balance || 0) > 0) {
        memToggle.style.display = 'flex';
        memBal.textContent = `잔액 ${(picked.membership_balance || 0).toLocaleString()}원`;
      } else {
        memToggle.style.display = 'none';
        memBal.textContent = '';
      }
    });

    listEl.querySelector('#rfSave').addEventListener('click', async () => {
      const amount = parseInt(document.getElementById('rfAmount').value, 10);
      if (!amount || amount <= 0) {
        if (window.showToast) window.showToast('금액을 입력해 주세요');
        return;
      }
      const useMem = !!listEl.querySelector('#rfUseMembership')?.checked;
      try {
        await create({
          amount,
          method: useMem ? 'membership' : method,
          service_name: document.getElementById('rfService').value.trim() || null,
          customer_id,
          customer_name: listEl.querySelector('#rfCustomerName').value.trim() || null,
          memo: document.getElementById('rfMemo').value.trim() || null,
          use_membership: useMem,
        });
        if (window.hapticLight) window.hapticLight();
        if (window.showToast) window.showToast(useMem ? '회원권 차감 완료' : '매출 기록 완료');
        if (typeof window._formRecoveryClear === 'function') window._formRecoveryClear('revenue-add');
        await _loadAndRender();
      } catch (e) {
        console.warn('[revenue] create 실패:', e);
        if (window.showToast) window.showToast('저장 실패: ' + (e?.message || ''), { error: true });
      }
    });
  }

  window._revenueBack = _rerender;

  async function _deleteEntry(id) {
    { const _ok = window._confirm2 ? window._confirm2('이 매출 기록을 삭제할까요?') : confirm('이 매출 기록을 삭제할까요?'); if (!_ok) return; }
    try {
      await remove(id);
      if (window.hapticLight) window.hapticLight();
      await _loadAndRender();
    } catch (e) {
      if (window.showToast) window.showToast('삭제 실패');
    }
  }

  async function _loadAndRender() {
    const sheet = document.getElementById('revenueSheet');
    if (!sheet) return;
    const listEl = sheet.querySelector('#revenueList');
    // [2026-04-26 0초딜레이] SWR 캐시 있으면 skeleton 없이 즉시 렌더
    const swr = _readSWRPeriod(_currentPeriod);
    if (swr) {
      _items = swr.items;
      _rerender();
      // 오래된 캐시면 백그라운드 갱신 (list 안에서 자동 처리)
      if (!swr.fresh) {
        list(_currentPeriod).then(() => _rerender()).catch(() => {});
      }
      return;
    }
    listEl.innerHTML = (typeof window._renderSkeleton === 'function')
      ? window._renderSkeleton(5)
      : '<div style="padding:30px;text-align:center;color:#aaa;">불러오는 중…</div>';
    try {
      await list(_currentPeriod);
      _rerender();
    } catch (e) {
      console.warn('[revenue] load 실패:', e);
      listEl.innerHTML = '<div style="padding:30px;text-align:center;color:#c00;">불러오기 실패</div>';
    }
  }

  window.openRevenue = async function () {
    const sheet = _ensureSheet();
    sheet.style.display = 'block';
    document.body.style.overflow = 'hidden';
    await _loadAndRender();
    // [2026-04-26 A5] popstate 등록
    try {
      if (typeof window._registerSheet === 'function') window._registerSheet('revenue', window.closeRevenue);
      if (typeof window._markSheetOpen === 'function') window._markSheetOpen('revenue');
    } catch (_e) { void _e; }
  };

  window.closeRevenue = function () {
    const sheet = document.getElementById('revenueSheet');
    if (sheet) sheet.style.display = 'none';
    document.body.style.overflow = '';
    try { if (typeof window._markSheetClosed === 'function') window._markSheetClosed('revenue'); } catch (_e) { void _e; }
  };

  window.Revenue = {
    list, create, remove,
    get _items() { return _items; },
    get isOffline() { return _isOffline; },
  };

  // 챗봇·외부 데이터 변경 감지 → 시트가 열려 있으면 즉시 재로드
  if (typeof window !== 'undefined' && !window._revenueDataListenerInit) {
    window._revenueDataListenerInit = true;
    window.addEventListener('itdasy:data-changed', async (e) => {
      const k = (e && e.detail && e.detail.kind) || '';
      if (!k) return;
      // Wave D3 (2026-04-24) — 매출/지출 변동 모두 여기서 재로드 (매출 탭에 지출 섹션도 함께 노출)
      if (k === 'create_revenue' || k === 'update_revenue' || k === 'delete_revenue' || k === 'create_expense' ||
          k.indexOf('revenue') !== -1 || k.indexOf('expense') !== -1) {
        // [2026-04-26 0초딜레이] 크로스도메인 mutation → SWR 캐시 무효화
        _clearSWRRevenue();
        const sheet = document.getElementById('revenueSheet');
        if (sheet && sheet.style.display !== 'none' && typeof _loadAndRender === 'function') {
          try { await _loadAndRender(); } catch (_err) { void _err; }
        }
      }
    });
  }
})();
