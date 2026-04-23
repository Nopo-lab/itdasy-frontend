/* ─────────────────────────────────────────────────────────────
   AI 인사이트 대시보드 (Phase 4 · 2026-04-20)

   한 화면에서 3가지 선제 제안을 통합:
   - GET /retention/at-risk   이탈 임박 고객 리스트
   - GET /revenue/forecast    이번 주 예상 매출 + 추천 액션
   - GET /coupons/suggest     슬로우 데이 쿠폰 제안

   오프라인·미배포 시 안내 카드만 렌더.
   ──────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  }

  async function _apiGet(path) {
    if (!window.API || !window.authHeader) throw new Error('no-auth');
    const auth = window.authHeader();
    if (!auth?.Authorization) throw new Error('no-token');
    const res = await fetch(window.API + path, { headers: auth });
    if (res.status === 404 || res.status === 501) throw new Error('endpoint-missing');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  }

  function _formatKRW(n) {
    return (+n || 0).toLocaleString('ko-KR') + '원';
  }

  function _relativeDays(days) {
    if (days >= 60) return Math.round(days / 30) + '개월';
    if (days >= 14) return Math.round(days / 7) + '주';
    return Math.round(days) + '일';
  }

  // ── UI ──────────────────────────────────────────────────
  function _ensureSheet() {
    let sheet = document.getElementById('insightsSheet');
    if (sheet) return sheet;
    sheet = document.createElement('div');
    sheet.id = 'insightsSheet';
    sheet.style.cssText = 'position:fixed;inset:0;z-index:9998;display:none;background:rgba(0,0,0,0.4);';
    sheet.innerHTML = `
      <div style="position:absolute;inset:auto 0 0 0;background:var(--bg,#fff);border-radius:20px 20px 0 0;max-height:92vh;display:flex;flex-direction:column;padding:16px;padding-bottom:max(16px,env(safe-area-inset-bottom));">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <span style="font-size:22px;">✨</span>
          <strong style="font-size:18px;">AI 인사이트</strong>
          <button onclick="closeInsights()" style="margin-left:auto;background:none;border:none;font-size:20px;cursor:pointer;" aria-label="닫기">✕</button>
        </div>
        <div id="insightsBody" style="flex:1;overflow-y:auto;"></div>
      </div>
    `;
    document.body.appendChild(sheet);
    sheet.addEventListener('click', (e) => { if (e.target === sheet) closeInsights(); });
    return sheet;
  }

  function _renderLoading() {
    const body = document.getElementById('insightsBody');
    body.innerHTML = '<div style="padding:40px;text-align:center;color:#aaa;">AI 분석 중…</div>';
  }

  function _retentionCard(data) {
    const items = (data?.items || []).slice(0, 5);
    const s = data?.summary || { total: 0, at_risk: 0, lost: 0 };
    if (!items.length) {
      return `
        <div style="padding:16px;background:#fafafa;border-radius:12px;margin-bottom:12px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <span style="font-size:18px;">💝</span>
            <strong style="font-size:14px;">이탈 임박 고객</strong>
          </div>
          <div style="font-size:12px;color:#888;">걱정할 고객 없음 · 고객 데이터가 쌓이면 자동으로 감지해요.</div>
        </div>`;
    }
    return `
      <div style="padding:14px;background:linear-gradient(135deg,rgba(220,53,69,0.06),rgba(220,53,69,0.01));border-radius:12px;margin-bottom:12px;">
        <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:10px;">
          <span style="font-size:18px;">💝</span>
          <strong style="font-size:14px;">이탈 임박 고객</strong>
          <span style="margin-left:auto;font-size:11px;color:#dc3545;font-weight:700;">⚠ ${s.at_risk + s.lost}명</span>
        </div>
        ${items.map(c => `
          <div style="padding:8px 4px;border-top:1px solid rgba(0,0,0,0.05);">
            <div style="display:flex;align-items:center;gap:6px;">
              <strong style="font-size:13px;">${_esc(c.name)}</strong>
              ${c.phone ? `<span style="font-size:11px;color:#888;">${_esc(c.phone)}</span>` : ''}
              <span style="margin-left:auto;font-size:10px;padding:1px 6px;border-radius:3px;font-weight:700;background:${c.status === 'lost' ? 'rgba(220,53,69,0.15)' : 'rgba(255,193,7,0.2)'};color:${c.status === 'lost' ? '#dc3545' : '#f57c00'};">
                ${c.status === 'lost' ? '이탈' : '임박'}
              </span>
            </div>
            <div style="font-size:11px;color:#666;margin-top:2px;">
              마지막 방문 ${_relativeDays(c.days_since_last)} 전 · 평균 주기 ${Math.round(c.avg_interval_days)}일 · 방문 ${c.visit_count}회
            </div>
            <div style="margin-top:6px;text-align:right;">
              <button data-draft-cid="${c.customer_id}" data-draft-name="${_esc(c.name)}" data-draft-phone="${_esc(c.phone || '')}"
                      style="padding:5px 10px;font-size:11px;font-weight:700;border:1px solid #F18091;background:#fff;color:#D95F70;border-radius:100px;cursor:pointer;">
                💬 카톡 초안 만들기
              </button>
            </div>
          </div>
        `).join('')}
        ${data.items.length > 5 ? `<div style="margin-top:8px;font-size:11px;color:#888;text-align:center;">외 ${data.items.length - 5}명</div>` : ''}
      </div>
    `;
  }

  function _forecastCard(data) {
    if (!data?.has_data) {
      return `
        <div style="padding:16px;background:#fafafa;border-radius:12px;margin-bottom:12px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <span style="font-size:18px;">📈</span>
            <strong style="font-size:14px;">이번 주 매출 예상</strong>
          </div>
          <div style="font-size:12px;color:#888;">${_esc(data?.action || '데이터가 더 필요해요')}</div>
        </div>`;
    }
    const up = data.delta_pct >= 0;
    const deltaColor = data.delta_pct >= 5 ? '#388e3c' : data.delta_pct <= -5 ? '#dc3545' : '#666';
    const arrow = data.delta_pct > 5 ? '↗' : data.delta_pct < -5 ? '↘' : '→';
    return `
      <div style="padding:14px;background:linear-gradient(135deg,rgba(241,128,145,0.08),rgba(241,128,145,0.02));border-radius:12px;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <span style="font-size:18px;">📈</span>
          <strong style="font-size:14px;">이번 주 매출 예상</strong>
        </div>
        <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:6px;">
          <strong style="font-size:24px;color:var(--accent,#F18091);">${_formatKRW(data.predicted_week)}</strong>
          <span style="font-size:12px;color:${deltaColor};font-weight:700;">${arrow} ${up ? '+' : ''}${data.delta_pct}%</span>
          <span style="font-size:11px;color:#888;margin-left:auto;">지난주 ${_formatKRW(data.current_week)}</span>
        </div>
        <div style="font-size:12px;color:#555;line-height:1.5;padding:8px 10px;background:#fff;border-radius:8px;margin-top:8px;">
          💡 ${_esc(data.action)}
        </div>
      </div>
    `;
  }

  function _couponCard(data) {
    if (!data?.has_suggestion) {
      return `
        <div style="padding:16px;background:#fafafa;border-radius:12px;margin-bottom:12px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <span style="font-size:18px;">🎟</span>
            <strong style="font-size:14px;">쿠폰 제안</strong>
          </div>
          <div style="font-size:12px;color:#888;">${_esc(data?.reason || '데이터가 더 쌓이면 제안이 나와요')}</div>
        </div>`;
    }
    return `
      <div style="padding:14px;background:linear-gradient(135deg,rgba(76,175,80,0.08),rgba(76,175,80,0.02));border-radius:12px;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <span style="font-size:18px;">🎟</span>
          <strong style="font-size:14px;">쿠폰 제안</strong>
          <span style="margin-left:auto;font-size:11px;color:#388e3c;font-weight:700;">${data.discount_pct}% 할인</span>
        </div>
        <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:6px;">
          <strong style="font-size:20px;color:#388e3c;">${_esc(data.slow_day.label)}요일</strong>
          <span style="font-size:11px;color:#888;">↔ ${_esc(data.peak_day.label)}요일 대비 -${data.gap_pct}%</span>
        </div>
        <div style="font-size:12px;color:#555;line-height:1.5;padding:8px 10px;background:#fff;border-radius:8px;">
          💡 ${_esc(data.message)}
        </div>
      </div>
    `;
  }

  async function _loadAndRender() {
    const body = document.getElementById('insightsBody');
    _renderLoading();
    const [retentionP, forecastP, couponP] = [
      _apiGet('/retention/at-risk').catch(() => null),
      _apiGet('/revenue/forecast').catch(() => null),
      _apiGet('/coupons/suggest').catch(() => null),
    ];
    const [ret, fc, cp] = await Promise.all([retentionP, forecastP, couponP]);

    if (!ret && !fc && !cp) {
      body.innerHTML = `
        <div style="padding:30px 16px;text-align:center;color:#aaa;font-size:13px;line-height:1.6;">
          <div style="font-size:36px;margin-bottom:10px;">🌱</div>
          아직 분석할 데이터가 부족해요. 고객·매출·예약을 기록하면<br>며칠 뒤부터 AI가 선제 제안을 보여줘요.
        </div>
      `;
      return;
    }

    body.innerHTML = `
      ${_retentionCard(ret)}
      ${_forecastCard(fc)}
      ${_couponCard(cp)}
      <div style="font-size:11px;color:#aaa;text-align:center;padding:10px;">
        AI 인사이트는 최근 8주 데이터를 바탕으로 매 요청마다 새로 계산돼요.
      </div>
    `;
  }

  window.openInsights = async function () {
    _ensureSheet();
    document.getElementById('insightsSheet').style.display = 'block';
    document.body.style.overflow = 'hidden';
    await _loadAndRender();
  };

  window.closeInsights = function () {
    const sheet = document.getElementById('insightsSheet');
    if (sheet) sheet.style.display = 'none';
    document.body.style.overflow = '';
  };

  // Phase 8 C4 — AI 카톡 초안 버튼 → POST /retention/{id}/message-draft → navigator.share
  let _draftBound = false;
  function _bindDraftButtons() {
    if (_draftBound) return;
    _draftBound = true;
    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-draft-cid]');
      if (!btn) return;
      const cid = btn.getAttribute('data-draft-cid');
      const name = btn.getAttribute('data-draft-name');
      if (!cid) return;
      const original = btn.innerHTML;
      btn.innerHTML = '🤖 AI 작성 중…';
      btn.disabled = true;
      try {
        const res = await fetch(window.API + '/retention/' + cid + '/message-draft', {
          method: 'POST',
          headers: { ...window.authHeader(), 'Content-Type': 'application/json' },
          body: '{}',
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const d = await res.json();
        const msg = d.message || '';
        try { if (navigator.clipboard) await navigator.clipboard.writeText(msg); } catch (_e) { /* ignore */ }
        if (navigator.share) {
          try { await navigator.share({ text: msg, title: name + '님께' }); }
          catch (_e) { /* 사용자 취소 */ }
        }
        if (window.showToast) window.showToast('초안을 복사했어요. 카톡에 붙여넣으세요 📋');
      } catch (err) {
        if (window.showToast) window.showToast('초안 생성 실패: ' + (err.message || ''));
      } finally {
        btn.innerHTML = original;
        btn.disabled = false;
      }
    });
  }
  _bindDraftButtons();
})();
