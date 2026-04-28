/* ─────────────────────────────────────────────────────────────
   고객 통합 대시보드 (Phase 4+ · 2026-04-20)

   GET /customers/{id}/dashboard 에서
     customer / segment / stats / retention / recent_revenues / recent_bookings / recent_nps
   받아 하나의 예쁜 대시보드로 렌더.

   openCustomerDashboard(id) 로 진입 — 기존 app-customer.js 의 행 클릭이 이걸 호출.
   ──────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  // 단골 ⭐ 미세 펄스 애니메이션 (1회 주입)
  if (typeof document !== 'undefined' && !document.getElementById('cm-membership-style')) {
    const st = document.createElement('style');
    st.id = 'cm-membership-style';
    st.textContent = `
      @keyframes cmStarPulse { 0%{transform:scale(1);} 50%{transform:scale(1.18);} 100%{transform:scale(1);} }
      .cm-toggle--pulse { animation: cmStarPulse 0.45s ease-out 1; }
      .cm-star-on svg { animation: cmStarPulse 0.5s ease-out 1; }
    `;
    document.head.appendChild(st);
  }

  // Lucide SVG inline (이모지 금지 — CLAUDE.md UX 철학)
  const _svg12 = (id) => `<svg width="12" height="12" style="vertical-align:-2px;" aria-hidden="true"><use href="#${id}"/></svg>`;
  const SEGMENT_STYLE = {
    vip:     { label: 'VIP', icon: _svg12('ic-star'), bg: 'linear-gradient(135deg,#FFD700,#FFA500)', color: '#fff' },
    regular: { label: '단골', icon: _svg12('ic-star'), bg: 'linear-gradient(135deg,#F18091,#FF6B9D)', color: '#fff' },
    new:     { label: '신규', icon: _svg12('ic-sparkles'), bg: 'linear-gradient(135deg,#4ECDC4,#44A08D)', color: '#fff' },
    absent:  { label: '휴면', icon: _svg12('ic-moon'), bg: 'linear-gradient(135deg,#95A5A6,#7F8C8D)', color: '#fff' },
  };

  const RETENTION_BADGE = {
    ok:      null,
    at_risk: { label: '이탈 임박', color: '#f57c00', bg: 'rgba(255,193,7,0.15)' },
    lost:    { label: '이탈', color: '#dc3545', bg: 'rgba(220,53,69,0.12)' },
  };

  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  }

  function _formatKRW(n) {
    return (+n || 0).toLocaleString('ko-KR') + '원';
  }

  function _dateShort(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')}`;
  }

  function _relativeDays(iso) {
    if (!iso) return '';
    const diff = (Date.now() - new Date(iso).getTime()) / 86400000;
    if (diff < 1) return '오늘';
    if (diff < 7) return `${Math.round(diff)}일 전`;
    if (diff < 30) return `${Math.round(diff / 7)}주 전`;
    if (diff < 365) return `${Math.round(diff / 30)}개월 전`;
    return `${Math.round(diff / 365)}년 전`;
  }

  function _initial(name) {
    return (name || '?').trim().charAt(0);
  }

  async function _apiGet(path) {
    if (!window.API || !window.authHeader) throw new Error('no-auth');
    const res = await fetch(window.API + path, { headers: window.authHeader() });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  }

  async function _apiPatch(path, body) {
    if (!window.API || !window.authHeader) throw new Error('no-auth');
    const res = await fetch(window.API + path, {
      method: 'PATCH',
      headers: { ...window.authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.status === 204 ? null : await res.json();
  }

  // ── UI ──────────────────────────────────────────────────
  function _ensureSheet() {
    let sheet = document.getElementById('customerDashSheet');
    if (sheet) return sheet;
    sheet = document.createElement('div');
    sheet.id = 'customerDashSheet';
    sheet.style.cssText = 'position:fixed;inset:0;z-index:9999;display:none;background:rgba(0,0,0,0.5);';
    sheet.innerHTML = `
      <div style="position:absolute;inset:auto 0 0 0;background:var(--bg,#fff);border-radius:20px 20px 0 0;max-height:95vh;display:flex;flex-direction:column;overflow:hidden;">
        <div id="cdHero" style="padding:20px 18px 24px;color:#fff;position:relative;"></div>
        <div id="cdBody" style="flex:1;overflow-y:auto;padding:16px 18px;padding-bottom:max(20px,env(safe-area-inset-bottom));"></div>
      </div>
    `;
    document.body.appendChild(sheet);
    sheet.addEventListener('click', (e) => { if (e.target === sheet) closeCustomerDashboard(); });
    return sheet;
  }

  function _renderHero(d) {
    const c = d.customer;
    const seg = SEGMENT_STYLE[d.segment] || SEGMENT_STYLE.regular;
    const retention = RETENTION_BADGE[d.retention?.status];
    return `
      <div style="background:${seg.bg};margin:-20px -18px 0;padding:20px 18px 28px;position:relative;">
        <button onclick="closeCustomerDashboard()" style="position:absolute;top:14px;right:14px;background:rgba(255,255,255,0.25);border:none;width:32px;height:32px;border-radius:50%;color:#fff;font-size:18px;cursor:pointer;backdrop-filter:blur(4px);">✕</button>
        <div style="display:flex;align-items:center;gap:14px;">
          <div style="width:62px;height:62px;border-radius:50%;background:rgba(255,255,255,0.25);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;color:#fff;backdrop-filter:blur(4px);">
            ${_esc(_initial(c.name))}
          </div>
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap;">
              <strong style="font-size:20px;color:#fff;">${_esc(c.name)}</strong>
              <span style="font-size:11px;padding:2px 8px;background:rgba(255,255,255,0.25);border-radius:4px;color:#fff;font-weight:700;">${seg.icon} ${seg.label}</span>
              ${retention ? `<span style="font-size:10px;padding:2px 8px;background:${retention.bg};color:${retention.color};border-radius:4px;font-weight:700;">⚠ ${retention.label}</span>` : ''}
            </div>
            ${c.phone ? `<div style="font-size:12px;color:rgba(255,255,255,0.9);">${_esc(c.phone)}</div>` : ''}
            ${(c.tags || []).length ? `<div style="margin-top:6px;display:flex;gap:4px;flex-wrap:wrap;">
              ${c.tags.slice(0, 4).map(t => `<span style="font-size:10px;padding:2px 6px;background:rgba(255,255,255,0.22);color:#fff;border-radius:4px;">#${_esc(t)}</span>`).join('')}
            </div>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  function _renderStats(d) {
    const s = d.stats;
    // E4 — 매너 점수 + 노쇼 횟수 (80 미만 = 빨간 색)
    const manner = (d.customer && d.customer.manner_score != null) ? +d.customer.manner_score : 100;
    const nsCount = (d.customer && d.customer.no_show_count) ? +d.customer.no_show_count : 0;
    const mannerColor = manner < 60 ? '#d95f5f' : (manner < 80 ? '#e89000' : '#222');
    const cards = [
      { icon: '💰', label: '누적 매출', value: _formatKRW(s.total_revenue), sub: `평균 ${_formatKRW(s.avg_ticket)}` },
      { icon: '🎯', label: '방문 횟수', value: `${s.visit_count}회`, sub: s.last_visit_at ? `최근 ${_relativeDays(s.last_visit_at)}` : '기록 없음' },
      { icon: '⭐', label: '후기 평균', value: s.nps_avg != null ? `${s.nps_avg}/10` : '—', sub: s.nps_latest != null ? `최근 ${s.nps_latest}` : '응답 없음' },
      { icon: '📅', label: '다가올 예약', value: `${s.upcoming_bookings}건`, sub: s.first_visit_at ? `첫 방문 ${_dateShort(s.first_visit_at)}` : '신규' },
      { icon: '🤝', label: '매너 점수', value: `${manner}점`, sub: nsCount > 0 ? `노쇼 ${nsCount}회` : '노쇼 없음', valueColor: mannerColor },
    ];
    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
        ${cards.map(c => `
          <div style="padding:14px;background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:14px;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
            <div style="font-size:10px;color:#888;margin-bottom:6px;">${c.icon} ${_esc(c.label)}</div>
            <div style="font-size:18px;font-weight:800;color:${c.valueColor || '#222'};line-height:1.2;">${_esc(c.value)}</div>
            <div style="font-size:10px;color:#aaa;margin-top:3px;">${_esc(c.sub)}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function _renderActions(id) {
    return `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:16px;">
        <button data-act="booking" style="padding:10px 6px;border:1px solid #eee;border-radius:10px;background:#fff;cursor:pointer;font-size:11px;font-weight:700;color:#555;">📅<br>예약</button>
        <button data-act="revenue" style="padding:10px 6px;border:1px solid #eee;border-radius:10px;background:#fff;cursor:pointer;font-size:11px;font-weight:700;color:#555;">💰<br>매출</button>
        <button data-act="nps" style="padding:10px 6px;border:1px solid #eee;border-radius:10px;background:#fff;cursor:pointer;font-size:11px;font-weight:700;color:#555;">⭐<br>후기</button>
      </div>
    `;
  }

  function _renderRegularMembership(d) {
    const c = d.customer || {};
    const isRegular = !!c.is_regular;
    const memOn = !!c.membership_active;
    const bal = +c.membership_balance || 0;
    const lowBal = memOn && bal > 0 && bal < 30000;
    const exp = c.membership_expires_at;
    const expDisplay = exp ? _dateShort(exp) : '미설정';
    const expInputVal = exp ? String(exp).slice(0, 10) : '';
    const balColor = lowBal ? '#F97316' : '#A78BFA';
    return `
      <div style="margin-bottom:14px;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
          <strong style="font-size:13px;">
            <svg width="13" height="13" aria-hidden="true" style="vertical-align:-2px;"><use href="#ic-star"/></svg>
            단골 · 멤버십
          </strong>
        </div>
        <div style="background:#fff;border-radius:14px;border:1px solid rgba(0,0,0,0.05);overflow:hidden;">
          <label style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid rgba(0,0,0,0.05);cursor:pointer;">
            <span style="font-size:13px;font-weight:700;flex:1;display:inline-flex;align-items:center;gap:6px;">
              <span class="${isRegular ? 'cm-star-on' : ''}" style="color:#F18091;display:inline-flex;align-items:center;">
                <svg width="14" height="14" aria-hidden="true"><use href="#ic-star"/></svg>
              </span>
              단골 등록
            </span>
            <span class="cm-toggle ${isRegular ? 'cm-toggle--on' : ''}" data-cm-toggle="is_regular"
                  role="switch" aria-checked="${isRegular}" tabindex="0"
                  style="position:relative;width:44px;height:24px;background:${isRegular ? '#F18091' : '#D1D5DB'};border-radius:999px;transition:background 0.2s;cursor:pointer;flex-shrink:0;">
              <span style="position:absolute;top:2px;left:${isRegular ? '22px' : '2px'};width:20px;height:20px;background:#fff;border-radius:50%;transition:left 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.2);"></span>
            </span>
          </label>
          <label style="display:flex;align-items:center;gap:10px;padding:12px 14px;${memOn ? 'border-bottom:1px solid rgba(0,0,0,0.05);' : ''}cursor:pointer;">
            <span style="font-size:13px;font-weight:700;flex:1;display:inline-flex;align-items:center;gap:6px;">
              <span style="color:#A78BFA;display:inline-flex;align-items:center;">
                <svg width="14" height="14" aria-hidden="true"><use href="#ic-sparkles"/></svg>
              </span>
              멤버십 가입
            </span>
            <span class="cm-toggle ${memOn ? 'cm-toggle--on' : ''}" data-cm-toggle="membership_active"
                  role="switch" aria-checked="${memOn}" tabindex="0"
                  style="position:relative;width:44px;height:24px;background:${memOn ? '#A78BFA' : '#D1D5DB'};border-radius:999px;transition:background 0.2s;cursor:pointer;flex-shrink:0;">
              <span style="position:absolute;top:2px;left:${memOn ? '22px' : '2px'};width:20px;height:20px;background:#fff;border-radius:50%;transition:left 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.2);"></span>
            </span>
          </label>
          ${memOn ? `
            <div style="padding:12px 14px;background:#FAFAFA;">
              <div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:8px;">
                <span style="font-size:11px;color:#888;">잔액</span>
                <strong style="font-size:18px;font-weight:800;color:${balColor};">${_formatKRW(bal)}</strong>
              </div>
              ${lowBal ? `<div style="font-size:10px;color:#F97316;margin-bottom:8px;">⚠ 잔액이 3만원 이하예요. 충전 안내해 주세요.</div>` : ''}
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px;">
                <button data-cm-charge="50000" style="padding:8px 4px;border:1px solid #E5E7EB;border-radius:10px;background:#fff;cursor:pointer;font-size:11px;font-weight:700;color:#A78BFA;">+5만원</button>
                <button data-cm-charge="100000" style="padding:8px 4px;border:1px solid #E5E7EB;border-radius:10px;background:#fff;cursor:pointer;font-size:11px;font-weight:700;color:#A78BFA;">+10만원</button>
                <button data-cm-charge="custom" style="padding:8px 4px;border:1px solid #E5E7EB;border-radius:10px;background:#fff;cursor:pointer;font-size:11px;font-weight:700;color:#555;">직접 입력</button>
              </div>
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-size:11px;color:#888;flex:1;">만료: <strong style="color:#555;font-weight:700;">${_esc(expDisplay)}</strong></span>
                <input type="date" data-cm-expires value="${_esc(expInputVal)}" style="padding:6px 8px;border:1px solid #E5E7EB;border-radius:8px;font-size:11px;background:#fff;" />
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  function _renderRevenues(rows) {
    if (!rows || !rows.length) return _emptySection('💰 시술 이력', '아직 기록된 매출이 없어요');
    const total = rows.reduce((s, r) => s + (r.amount || 0), 0);
    const marginTotal = rows.reduce((s, r) => s + (r.net_margin || 0), 0);
    return `
      <div style="margin-bottom:14px;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
          <strong style="font-size:13px;">💰 시술 이력</strong>
          <span style="font-size:10px;color:#888;">최근 ${rows.length}건 · 합 ${_formatKRW(total)}${marginTotal ? ' · 실 ' + _formatKRW(marginTotal) : ''}</span>
        </div>
        <div style="background:#fff;border-radius:12px;border:1px solid rgba(0,0,0,0.05);overflow:hidden;">
          ${rows.map((r, i) => `
            <div style="padding:10px 12px;${i > 0 ? 'border-top:1px solid rgba(0,0,0,0.05);' : ''}display:flex;align-items:center;gap:10px;">
              ${r.image_url
                ? `<img src="${_esc(r.image_url)}" loading="lazy" style="width:48px;height:48px;border-radius:8px;object-fit:cover;background:#f2f2f2;flex-shrink:0;" alt="">`
                : `<div style="width:48px;height:48px;border-radius:8px;background:linear-gradient(135deg,#fff0f5,#ffe4ec);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">💇</div>`}
              <div style="flex:1;min-width:0;">
                <div style="font-size:13px;font-weight:700;">${_formatKRW(r.amount)} <span style="font-size:10px;font-weight:400;color:#888;margin-left:4px;">${_esc(r.service_name || '시술')}</span></div>
                <div style="font-size:10px;color:#aaa;margin-top:2px;">${_dateShort(r.recorded_at)} · ${_esc(({card:'카드',cash:'현금',transfer:'계좌이체',bank_transfer:'계좌이체',etc:'기타'}[r.method])||r.method||'카드')}${r.net_margin ? ` · <span style="color:#2B8C7E;">실 ${_formatKRW(r.net_margin)}</span>` : ''}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function _renderBookings(rows) {
    if (!rows || !rows.length) return _emptySection('📅 예약 이력', '아직 예약이 없어요');
    return `
      <div style="margin-bottom:14px;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
          <strong style="font-size:13px;">📅 예약 이력</strong>
          <span style="font-size:10px;color:#888;">최근 ${rows.length}건</span>
        </div>
        <div style="background:#fff;border-radius:12px;border:1px solid rgba(0,0,0,0.05);overflow:hidden;">
          ${rows.map((b, i) => {
            const status = b.status === 'cancelled' ? '❌' : b.status === 'completed' ? '✓' : '•';
            return `
              <div style="padding:10px 12px;${i > 0 ? 'border-top:1px solid rgba(0,0,0,0.05);' : ''}">
                <div style="font-size:12px;font-weight:700;">${status} ${_dateShort(b.starts_at)} <span style="color:#888;font-weight:400;">${_esc(b.service_name || '시술')}</span></div>
                ${b.memo ? `<div style="font-size:10px;color:#888;margin-top:2px;">${_esc(b.memo).slice(0, 50)}</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  function _renderNps(rows) {
    if (!rows || !rows.length) return '';
    return `
      <div style="margin-bottom:14px;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
          <strong style="font-size:13px;">⭐ 고객 후기</strong>
          <span style="font-size:10px;color:#888;">${rows.length}건</span>
        </div>
        <div style="background:#fff;border-radius:12px;border:1px solid rgba(0,0,0,0.05);overflow:hidden;">
          ${rows.map((n, i) => {
            const face = n.rating >= 9 ? '😍' : n.rating >= 7 ? '😐' : '😞';
            const color = n.rating >= 9 ? '#388e3c' : n.rating >= 7 ? '#f57c00' : '#dc3545';
            return `
              <div style="padding:10px 12px;${i > 0 ? 'border-top:1px solid rgba(0,0,0,0.05);' : ''}display:flex;gap:10px;align-items:flex-start;">
                <span style="font-size:18px;">${face}</span>
                <div style="flex:1;min-width:0;">
                  <div style="display:flex;align-items:baseline;gap:6px;">
                    <strong style="color:${color};font-size:14px;">${n.rating}</strong>
                    <span style="font-size:10px;color:#aaa;margin-left:auto;">${_dateShort(n.responded_at)}</span>
                  </div>
                  ${n.comment ? `<div style="font-size:11px;color:#666;margin-top:2px;">${_esc(n.comment)}</div>` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  function _renderMemo(d) {
    if (!d.customer.memo) return '';
    return `
      <div style="margin-bottom:14px;padding:12px;background:#FFF9E6;border-radius:12px;border-left:3px solid #FFD54F;">
        <div style="font-size:11px;color:#888;margin-bottom:4px;">📝 원장님 메모</div>
        <div style="font-size:13px;color:#555;line-height:1.5;white-space:pre-wrap;">${_esc(d.customer.memo)}</div>
      </div>
    `;
  }

  function _renderEditBar(id) {
    return `
      <button data-act="edit" style="width:100%;padding:11px;border:1px solid rgba(0,0,0,0.08);border-radius:10px;background:#fff;color:#555;font-size:12px;font-weight:700;cursor:pointer;">✏️  정보 편집</button>
    `;
  }

  function _emptySection(title, msg) {
    return `
      <div style="margin-bottom:14px;">
        <div style="font-size:13px;font-weight:700;margin-bottom:8px;">${title}</div>
        <div style="padding:16px;background:#fafafa;border-radius:12px;text-align:center;font-size:12px;color:#aaa;">${msg}</div>
      </div>
    `;
  }

  async function _patchAndReload(id, patch) {
    try {
      await _apiPatch('/customers/' + id, patch);
      // SWR 캐시 무효화 — 목록 화면이 다시 신선한 데이터 가져오도록
      try { localStorage.removeItem('pv_cache::customers'); } catch (_e) { void _e; }
      try { sessionStorage.removeItem('pv_cache::customers'); } catch (_e) { void _e; }
      try { sessionStorage.removeItem('pv_cache::customer'); } catch (_e) { void _e; }
      window.dispatchEvent(new CustomEvent('itdasy:data-changed', { detail: { kind: 'update_customer', id } }));
      if (window.hapticLight) window.hapticLight();
      // 대시보드 다시 그리기 (data-changed 리스너가 자동 재로드)
      // 직접 호출도 보장
      await window.openCustomerDashboard(id);
    } catch (e) {
      console.warn('[customer-membership] patch 실패:', e);
      if (window.showToast) window.showToast('저장 실패 — 다시 시도해 주세요');
    }
  }

  function _bindMembership(d) {
    const sheet = document.getElementById('customerDashSheet');
    if (!sheet) return;
    const id = d.customer.id;

    // 단골/멤버십 토글
    sheet.querySelectorAll('[data-cm-toggle]').forEach(el => {
      const key = el.dataset.cmToggle;
      const handler = async () => {
        const cur = el.getAttribute('aria-checked') === 'true';
        const next = !cur;
        const patch = { [key]: next };
        // 단골 ON 시 ⭐ 미세 애니메이션
        if (key === 'is_regular' && next) {
          el.classList.add('cm-toggle--pulse');
        }
        await _patchAndReload(id, patch);
      };
      el.addEventListener('click', handler);
      el.addEventListener('keydown', (ev) => {
        if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); handler(); }
      });
    });

    // 충전 버튼
    sheet.querySelectorAll('[data-cm-charge]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const raw = btn.dataset.cmCharge;
        let delta = 0;
        if (raw === 'custom') {
          const v = window.prompt('충전 금액(원)', '50000');
          if (v == null) return;
          delta = parseInt(String(v).replace(/[^\d]/g, ''), 10) || 0;
          if (delta <= 0) { if (window.showToast) window.showToast('금액을 다시 확인해 주세요'); return; }
        } else {
          delta = parseInt(raw, 10) || 0;
        }
        const curBal = +d.customer.membership_balance || 0;
        await _patchAndReload(id, { membership_balance: curBal + delta });
      });
    });

    // 만료일 변경
    const expInput = sheet.querySelector('[data-cm-expires]');
    if (expInput) {
      expInput.addEventListener('change', async () => {
        const v = expInput.value; // YYYY-MM-DD
        if (!v) {
          await _patchAndReload(id, { membership_expires_at: null });
          return;
        }
        // ISO datetime — 23:59:59 으로 그날 끝까지
        const iso = new Date(v + 'T23:59:59').toISOString();
        await _patchAndReload(id, { membership_expires_at: iso });
      });
    }
  }

  function _bindActions(id, name) {
    const sheet = document.getElementById('customerDashSheet');
    if (!sheet) return;
    sheet.querySelectorAll('[data-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        const act = btn.dataset.act;
        if (act === 'edit') {
          closeCustomerDashboard();
          if (typeof window.editCustomer === 'function') {
            window.editCustomer(id);
          } else if (typeof window.openCustomers === 'function') {
            window.openCustomers();
          }
        } else if (act === 'booking') {
          closeCustomerDashboard();
          if (typeof window.openBooking === 'function') window.openBooking();
        } else if (act === 'revenue') {
          closeCustomerDashboard();
          if (typeof window.openRevenue === 'function') window.openRevenue();
        } else if (act === 'nps') {
          closeCustomerDashboard();
          if (typeof window.openNps === 'function') window.openNps();
        }
      });
    });
  }

  // 현재 열려 있는 고객 id 기억 (data-changed 이벤트 시 재로드용)
  let _currentCustomerId = null;

  window.openCustomerDashboard = async function (id) {
    if (!id) return;
    _currentCustomerId = id;
    _ensureSheet();
    const sheet = document.getElementById('customerDashSheet');
    sheet.style.display = 'block';
    document.body.style.overflow = 'hidden';
    const hero = sheet.querySelector('#cdHero');
    const body = sheet.querySelector('#cdBody');
    hero.innerHTML = '<div style="padding:20px;color:#888;">불러오는 중…</div>';
    body.innerHTML = '';
    try {
      const d = await _apiGet('/customers/' + id + '/dashboard');
      hero.innerHTML = '';
      hero.insertAdjacentHTML('beforeend', _renderHero(d));
      body.innerHTML = `
        ${_renderStats(d)}
        ${_renderActions(d.customer.id)}
        ${_renderMemo(d)}
        ${_renderRegularMembership(d)}
        ${_renderRevenues(d.recent_revenues)}
        ${_renderBookings(d.recent_bookings)}
        ${_renderNps(d.recent_nps)}
        ${_renderEditBar(d.customer.id)}
      `;
      _bindActions(d.customer.id, d.customer.name);
      _bindMembership(d);
    } catch (e) {
      console.warn('[customer-dashboard] 실패:', e);
      hero.innerHTML = '';
      body.innerHTML = `
        <div style="padding:40px 20px;text-align:center;color:#c00;">
          <div style="font-size:36px;margin-bottom:10px;">😢</div>
          <div style="font-size:13px;">대시보드를 불러오지 못했어요</div>
          <button onclick="closeCustomerDashboard()" style="margin-top:14px;padding:10px 20px;border:1px solid #ddd;border-radius:8px;background:#fff;cursor:pointer;">닫기</button>
        </div>
      `;
    }
  };

  window.closeCustomerDashboard = function () {
    const sheet = document.getElementById('customerDashSheet');
    if (sheet) sheet.style.display = 'none';
    document.body.style.overflow = '';
    _currentCustomerId = null;
  };

  // Wave D3 (2026-04-24) — 챗봇·외부 데이터 변경 감지 → 고객 상세 대시보드 재로드
  // customer_id 지정 없어도 전체 영향 가능 (매출/예약/NPS 는 고객 dashboard 의 stats 에 영향)
  if (typeof window !== 'undefined' && !window._customerDashboardDataListenerInit) {
    window._customerDashboardDataListenerInit = true;
    window.addEventListener('itdasy:data-changed', async (e) => {
      if (!_currentCustomerId) return;
      const k = (e && e.detail && e.detail.kind) || '';
      if (!k) return;
      const affects = ['update_customer', 'create_revenue', 'update_revenue', 'create_booking',
                       'update_booking', 'cancel_booking', 'reschedule_booking', 'create_nps'];
      if (!affects.includes(k)) return;
      const sheet = document.getElementById('customerDashSheet');
      if (!sheet || sheet.style.display === 'none') return;
      try {
        // 현재 열린 dashboard 다시 로드
        await window.openCustomerDashboard(_currentCustomerId);
      } catch (_err) { void _err; }
    });
  }
})();
