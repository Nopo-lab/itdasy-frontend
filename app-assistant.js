/* ─────────────────────────────────────────────────────────────
   AI 비서 챗봇 (2026-04-21)

   원장님 자연어 질문 → POST /assistant/ask → 답변.
   대화 UI + 추천 질문 3개.
   ──────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const SUGGESTIONS = [
    '이번 주 매출 어때?',
    '김서연 2시 예약 추가',
    '오늘 속눈썹 5만원 카드 기록',
    '이탈 임박 고객 알려줘',
    '제일 잘 팔리는 시술 뭐야?',
  ];

  let _history = [];  // [{role, text}]
  // v1.1 Multi-turn — localStorage 에 session_id 유지 (앱 재시작해도 대화 기억)
  let _sessionId = null;
  try { _sessionId = parseInt(localStorage.getItem('assistant_session_id') || '', 10) || null; }
  catch (_e) { _sessionId = null; }

  // Wave B5 — 고객 이름 캐시 (keystroke 마다 localStorage 접근 방지)
  let _customerCache = null;
  let _customerCacheAt = 0;
  const _CUSTOMER_CACHE_TTL = 60 * 1000;  // 60초
  function _getCustomers() {
    const now = Date.now();
    if (_customerCache && (now - _customerCacheAt) < _CUSTOMER_CACHE_TTL) return _customerCache;
    try {
      const raw = (window.safeStorage ? window.safeStorage.get('pv_cache::customers') : null)
        || (() => { try { return JSON.parse(localStorage.getItem('pv_cache::customers') || 'null'); } catch (_) { return null; } })();
      const items = raw && Array.isArray(raw.d) ? raw.d
                   : Array.isArray(raw) ? raw
                   : (raw && Array.isArray(raw.items) ? raw.items : []);
      _customerCache = items.filter(c => c && c.name).map(c => ({ id: c.id, name: String(c.name), phone: c.phone || '' }));
    } catch (_e) { _customerCache = []; }
    _customerCacheAt = now;
    return _customerCache;
  }

  // Wave B4 — 휴리스틱 추출 (한글 이름, 전화, 금액, 시간)
  function _heuristicExtract(q) {
    const out = { name: '', phone: '', amount: '', time: '', raw: q };
    try {
      const mName = q.match(/[가-힣]{2,4}/);
      if (mName) out.name = mName[0];
      const mPhone = q.match(/0\d{1,2}[-\.\s]?\d{3,4}[-\.\s]?\d{4}/);
      if (mPhone) out.phone = mPhone[0].replace(/[\.\s]/g, '-');
      const mAmount = q.match(/(\d{1,3}(?:,\d{3})+|\d{4,})\s*(?:원|만원|천원)?/);
      const mUnit = q.match(/(\d+)\s*(만원|천원)/);
      if (mUnit) {
        const n = parseInt(mUnit[1], 10);
        out.amount = String(mUnit[2] === '만원' ? n * 10000 : n * 1000);
      } else if (mAmount) {
        out.amount = mAmount[1].replace(/,/g, '');
      }
      const mTime = q.match(/오늘|내일|모레|\d+월\s*\d+일|\d+시/);
      if (mTime) out.time = mTime[0];
    } catch (_e) { void _e; }
    return out;
  }

  // Wave B4 — 시간 힌트를 ISO 로 변환 (예약용, best-effort)
  function _timeToISO(hint) {
    if (!hint) return null;
    try {
      const base = new Date();
      base.setSeconds(0, 0);
      let day = new Date(base);
      if (/내일/.test(hint)) day.setDate(day.getDate() + 1);
      else if (/모레/.test(hint)) day.setDate(day.getDate() + 2);
      const m = hint.match(/(\d+)월\s*(\d+)일/);
      if (m) { day.setMonth(parseInt(m[1], 10) - 1); day.setDate(parseInt(m[2], 10)); }
      const mH = hint.match(/(\d+)시/);
      if (mH) day.setHours(parseInt(mH[1], 10), 0, 0, 0);
      else day.setHours(10, 0, 0, 0);
      return day.toISOString();
    } catch (_e) { return null; }
  }

  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  }

  function _ensureSheet() {
    let sheet = document.getElementById('assistantSheet');
    if (sheet) return sheet;
    sheet = document.createElement('div');
    sheet.id = 'assistantSheet';
    sheet.style.cssText = 'position:fixed;inset:0;z-index:9999;display:none;background:rgba(0,0,0,0.5);';
    sheet.innerHTML = `
      <div style="position:absolute;inset:auto 0 0 0;background:var(--bg,#fff);border-radius:20px 20px 0 0;height:88vh;display:flex;flex-direction:column;padding:16px;padding-bottom:max(12px,env(safe-area-inset-bottom));">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <span style="font-size:22px;">🤖</span>
          <strong style="font-size:17px;">AI 비서</strong>
          <span style="font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(139,92,246,0.15);color:#7C3AED;font-weight:700;">베타</span>
          <button onclick="closeAssistant()" style="margin-left:auto;background:rgba(0,0,0,0.05);border:none;width:32px;height:32px;border-radius:50%;font-size:16px;cursor:pointer;">✕</button>
        </div>
        <div id="asstBody" style="flex:1;overflow-y:auto;padding:4px;"></div>
        <div id="asstSuggest" style="display:flex;gap:6px;overflow-x:auto;margin-top:8px;padding:4px 0;"></div>
        <div id="asstTypeahead" style="display:none;gap:6px;overflow-x:auto;margin-top:6px;padding:2px 0;"></div>
        <div style="display:flex;gap:8px;margin-top:8px;align-items:center;">
          <button id="asstPhoto" aria-label="사진 업로드" title="사진 업로드" style="flex-shrink:0;width:44px;height:44px;border:1px solid hsl(340,78%,85%);border-radius:14px;background:hsl(340,100%,98%);color:hsl(350,60%,40%);cursor:pointer;font-size:20px;padding:0;transition:background 0.15s;">📸</button>
          <input id="asstInput" placeholder="샵 관련해서 물어보세요…" maxlength="300" style="flex:1;padding:12px;border:1px solid #ddd;border-radius:14px;font-size:14px;min-width:0;" />
          <button id="asstSend" style="flex-shrink:0;padding:12px 18px;border:none;border-radius:14px;background:linear-gradient(135deg,#F18091,#D95F70);color:#fff;cursor:pointer;font-weight:800;">보내기</button>
        </div>
        <input id="asstCamera" type="file" accept="image/*" capture="environment" style="display:none;" />
        <input id="asstGallery" type="file" accept="image/*" style="display:none;" />
      </div>
    `;
    document.body.appendChild(sheet);
    sheet.addEventListener('click', (e) => { if (e.target === sheet) closeAssistant(); });
    sheet.querySelector('#asstSend').addEventListener('click', _send);
    // 📸 사진 업로드 버튼 → 하단 action sheet
    sheet.querySelector('#asstPhoto').addEventListener('click', _openPhotoSheet);
    // 숨겨진 file input 선택 시 업로드 실행
    sheet.querySelector('#asstCamera').addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';  // 같은 파일 재선택 허용
      if (f) _uploadPhoto(f);
    });
    sheet.querySelector('#asstGallery').addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (f) _uploadPhoto(f);
    });
    sheet.querySelector('#asstInput').addEventListener('keydown', (e) => {
      // 한글 IME 조합 중 Enter 무시 (마지막 글자 중복/누락 방지)
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _send(); }
    });
    // Wave B5 — 입력 디바운스 typeahead
    let _typeTimer = null;
    sheet.querySelector('#asstInput').addEventListener('input', (e) => {
      if (_typeTimer) clearTimeout(_typeTimer);
      const v = (e.target.value || '').trim();
      _typeTimer = setTimeout(() => _renderTypeahead(v), 200);
    });
    _renderSuggest();
    return sheet;
  }

  // Wave B5 — 의도 예측 chips 렌더
  function _renderTypeahead(text) {
    const box = document.getElementById('asstTypeahead');
    if (!box) return;
    if (!text || text.length > 20) { box.style.display = 'none'; box.innerHTML = ''; return; }
    const firstToken = text.split(/\s+/)[0];
    if (!firstToken || firstToken.length < 2) { box.style.display = 'none'; box.innerHTML = ''; return; }
    const customers = _getCustomers();
    const match = customers.find(c => c.name.startsWith(firstToken) || c.name === firstToken);
    if (!match) { box.style.display = 'none'; box.innerHTML = ''; return; }
    const chips = [
      `${match.name} 5만원 기록`,
      `${match.name} 내일 2시 예약`,
      `${match.name} 정보 보기`,
    ];
    box.innerHTML = chips.map(c => `
      <button data-typeahead="${_esc(c)}" style="padding:6px 11px;border:1px solid hsl(340,78%,85%);border-radius:14px;background:hsl(340,100%,98%);cursor:pointer;font-size:11px;color:hsl(350,60%,40%);white-space:nowrap;font-weight:700;">✨ ${_esc(c)}</button>
    `).join('');
    box.style.display = 'flex';
  }

  function _renderHistory() {
    const body = document.getElementById('asstBody');
    if (!body) return;
    if (!_history.length) {
      body.innerHTML = `
        <div style="padding:30px 20px;text-align:center;">
          <div style="font-size:40px;margin-bottom:10px;">🤖</div>
          <div style="font-size:14px;color:#555;line-height:1.6;">안녕하세요 원장님 👋<br>궁금한 건 물어보고, 할 일은 맡겨주세요.<br><span style="font-size:11px;color:#888;">예: "김서연 2시 예약 추가" · "매출 5만원 카드"</span></div>
        </div>
      `;
      return;
    }
    body.innerHTML = _history.map((m, idx) => {
      if (m.role === 'user') {
        const thumbHtml = m.thumb ? `<img src="${_esc(m.thumb)}" alt="업로드 사진" style="max-width:160px;max-height:160px;border-radius:12px;margin-bottom:6px;display:block;object-fit:cover;" />` : '';
        return `<div style="display:flex;justify-content:flex-end;margin-bottom:8px;">
          <div style="max-width:80%;padding:10px 14px;background:linear-gradient(135deg,#F18091,#D95F70);color:#fff;border-radius:16px 16px 4px 16px;font-size:13px;line-height:1.5;">${thumbHtml}${_esc(m.text)}</div>
        </div>`;
      }
      if (m.role === 'assistant') {
        const actionHtml = m.action ? _renderActionBubble(m.action, idx, m.action_status) : '';
        const fallbackHtml = m.fallback ? _renderFallbackCard(m.fallback, idx, m.fallback_status) : '';
        const relatedHtml = (m.related && m.related.length) ? `
          <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:5px;">
            ${m.related.map(q => `<button data-suggest="${_esc(q)}" style="padding:5px 10px;border:1px solid #E2D6F7;border-radius:100px;background:#F7F2FD;cursor:pointer;font-size:11px;color:#6B21A8;white-space:nowrap;font-weight:700;transition:all 0.12s;">💬 ${_esc(q)}</button>`).join('')}
          </div>` : '';
        return `<div style="display:flex;gap:8px;margin-bottom:8px;align-items:flex-start;">
          <div style="width:28px;height:28px;border-radius:50%;background:rgba(139,92,246,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px;">🤖</div>
          <div style="max-width:85%;min-width:0;">
            <div style="padding:10px 14px;background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:16px 16px 16px 4px;font-size:13px;line-height:1.6;color:#222;white-space:pre-wrap;">${_esc(m.text)}</div>
            <div style="margin-top:3px;padding-left:4px;">
              <button data-report-ai="chat_answer" data-snippet="${_esc(m.text).replace(/"/g,'&quot;')}" data-source="/assistant/chat" aria-label="AI 답변 신고"
                style="background:transparent;border:none;cursor:pointer;font-size:10px;color:#bbb;padding:2px 4px;">🚩 신고</button>
            </div>
            ${actionHtml}
            ${fallbackHtml}
            ${relatedHtml}
          </div>
        </div>`;
      }
      // loading
      return `<div style="display:flex;gap:8px;margin-bottom:8px;align-items:flex-start;">
        <div style="width:28px;height:28px;border-radius:50%;background:rgba(139,92,246,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px;">🤖</div>
        <div style="padding:10px 14px;background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:16px;">
          <span style="display:inline-block;animation:asstDots 1.4s infinite;font-size:20px;color:#bbb;">···</span>
        </div>
      </div>
      <style>@keyframes asstDots { 0%,20% { opacity:0.2; } 50% { opacity:1; } 100% { opacity:0.2; } }</style>`;
    }).join('');
    body.scrollTop = body.scrollHeight;
    _bindActionButtons();
  }

  function _renderActionBubble(action, historyIdx, status) {
    if (!action || !action.kind) return '';
    const kindBadge = {
      create_booking:  { icon: '📅', label: '예약 추가', color: '#F18091' },
      create_revenue:  { icon: '💰', label: '매출 기록', color: '#388e3c' },
      create_customer: { icon: '👤', label: '고객 등록', color: '#4ECDC4' },
      create_nps:      { icon: '⭐', label: 'NPS 기록', color: '#FFD700' },
      update_booking:  { icon: '✏️', label: '예약 수정', color: '#A78BFA' },
      cancel_booking:  { icon: '🗑', label: '예약 취소', color: '#DC3545' },
      reschedule_booking: { icon: '🔄', label: '예약 시간 변경', color: '#0288D1' },
      update_customer: { icon: '✏️', label: '고객 정보 수정', color: '#4ECDC4' },
      upsert_inventory: { icon: '📦', label: '재고 추가', color: '#2B8C7E' },
      generate_bulk_message: { icon: '📋', label: '단체 메시지 초안', color: '#FF8A5C' },
    }[action.kind] || { icon: '✓', label: action.kind, color: '#666' };

    if (status === 'done') {
      return `<div style="margin-top:6px;padding:10px 12px;background:linear-gradient(135deg,rgba(76,175,80,0.12),rgba(76,175,80,0.02));border-radius:12px;border-left:3px solid #388e3c;">
        <div style="font-size:11px;font-weight:700;color:#388e3c;">✓ 완료</div>
      </div>`;
    }
    if (status === 'failed') {
      return `<div style="margin-top:6px;padding:10px 12px;background:rgba(220,53,69,0.08);border-radius:12px;border-left:3px solid #dc3545;">
        <div style="font-size:11px;font-weight:700;color:#dc3545;">실패 — 다시 말씀해 주세요</div>
      </div>`;
    }
    // pending
    return `<div style="margin-top:6px;padding:12px;background:#fff;border:1px solid ${kindBadge.color};border-radius:12px;">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
        <span style="font-size:14px;">${kindBadge.icon}</span>
        <span style="font-size:11px;font-weight:700;color:${kindBadge.color};">${kindBadge.label}</span>
      </div>
      <div style="font-size:13px;color:#222;font-weight:600;margin-bottom:10px;line-height:1.5;">${_esc(action.confirmation_text || '')}</div>
      <div style="display:flex;gap:6px;">
        <button data-action-run="${historyIdx}" style="flex:2;padding:9px;border:none;border-radius:8px;background:${kindBadge.color};color:#fff;font-weight:800;cursor:pointer;font-size:12px;">추가하기 ✓</button>
        <button data-action-cancel="${historyIdx}" style="flex:1;padding:9px;border:1px solid #eee;border-radius:8px;background:#fff;color:#888;cursor:pointer;font-size:12px;">취소</button>
      </div>
    </div>`;
  }

  // Wave B4 — 휴리스틱 프리뷰 카드 (answer/actions 둘 다 비었을 때)
  function _renderFallbackCard(extract, historyIdx, status) {
    if (!extract) return '';
    if (status === 'done') {
      return `<div style="margin-top:6px;padding:10px 12px;background:linear-gradient(135deg,hsl(145,45%,94%),hsl(145,45%,98%));border-radius:14px;border-left:3px solid hsl(145,50%,40%);">
        <div style="font-size:11px;font-weight:700;color:hsl(145,50%,35%);">✓ 저장했어요</div>
      </div>`;
    }
    if (status === 'failed') {
      return `<div style="margin-top:6px;padding:10px 12px;background:hsl(0,70%,96%);border-radius:14px;border-left:3px solid hsl(0,70%,55%);">
        <div style="font-size:11px;font-weight:700;color:hsl(0,70%,45%);">실패 — 다시 시도해 주세요</div>
      </div>`;
    }
    const row = (label, field, val, placeholder) => `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <span style="width:52px;font-size:11px;color:hsl(220,10%,50%);font-weight:700;">${label}</span>
        <input data-fallback-field="${field}" data-fallback-idx="${historyIdx}" value="${_esc(val || '')}" placeholder="${_esc(placeholder)}"
          style="flex:1;padding:7px 10px;border:1px solid hsl(220,15%,88%);border-radius:10px;font-size:12px;background:#fff;" />
      </div>`;
    return `<div style="margin-top:6px;padding:12px;background:#fff;border:1px solid hsl(270,40%,88%);border-radius:14px;">
      <div style="font-size:12px;font-weight:800;color:hsl(270,50%,45%);margin-bottom:8px;">💡 대충 이렇게 맞아요?</div>
      ${row('이름', 'name', extract.name, '김서연')}
      ${row('전화', 'phone', extract.phone, '010-0000-0000')}
      ${row('금액', 'amount', extract.amount, '50000')}
      ${row('시간', 'time', extract.time, '내일 2시')}
      <div style="display:flex;gap:6px;margin-top:10px;">
        <button data-fallback-intent="customer" data-fallback-idx="${historyIdx}" style="flex:1;padding:9px;border:none;border-radius:10px;background:hsl(175,55%,50%);color:#fff;font-weight:800;cursor:pointer;font-size:11px;">👤 고객 추가</button>
        <button data-fallback-intent="revenue" data-fallback-idx="${historyIdx}" style="flex:1;padding:9px;border:none;border-radius:10px;background:hsl(145,50%,40%);color:#fff;font-weight:800;cursor:pointer;font-size:11px;">💰 매출 기록</button>
        <button data-fallback-intent="booking" data-fallback-idx="${historyIdx}" style="flex:1;padding:9px;border:none;border-radius:10px;background:hsl(350,75%,60%);color:#fff;font-weight:800;cursor:pointer;font-size:11px;">📅 예약 추가</button>
      </div>
    </div>`;
  }

  // Wave B4 — 프리뷰 카드에서 골라 즉시 POST (현재 입력값 읽기)
  async function _submitFallback(idx, intent) {
    const msg = _history[idx];
    if (!msg || !msg.fallback) return;
    // 사용자가 수정한 값 읽기
    const body = document.getElementById('asstBody');
    const read = (f) => {
      const el = body ? body.querySelector(`[data-fallback-field="${f}"][data-fallback-idx="${idx}"]`) : null;
      return el ? el.value.trim() : (msg.fallback[f] || '');
    };
    const data = { name: read('name'), phone: read('phone'), amount: read('amount'), time: read('time') };
    msg.fallback_status = 'running';
    _renderHistory();
    try {
      let endpoint, payload, kindKey;
      if (intent === 'customer') {
        if (!data.name) throw new Error('이름이 필요해요');
        endpoint = '/customers';
        payload = { name: data.name, phone: data.phone || null, memo: null, tags: [], birthday: null };
        kindKey = 'create_customer';
      } else if (intent === 'revenue') {
        if (!data.amount || !(+data.amount > 0)) throw new Error('금액이 필요해요');
        endpoint = '/revenue';
        payload = {
          amount: Math.round(+data.amount),
          method: 'card',
          service_name: null,
          customer_name: data.name || null,
          memo: null,
          recorded_at: new Date().toISOString(),
        };
        kindKey = 'create_revenue';
      } else if (intent === 'booking') {
        if (!data.time) throw new Error('시간이 필요해요');
        const startISO = _timeToISO(data.time);
        if (!startISO) throw new Error('시간을 못 읽었어요');
        const endISO = new Date(new Date(startISO).getTime() + 60 * 60 * 1000).toISOString();
        endpoint = '/bookings';
        payload = {
          starts_at: startISO,
          ends_at: endISO,
          customer_id: null,
          customer_name: data.name || null,
          service_name: null,
          memo: null,
          status: 'confirmed',
        };
        kindKey = 'create_booking';
      } else {
        throw new Error('알 수 없는 요청');
      }
      const fetcher = window.safeFetch || fetch;
      const res = await fetcher(window.API + endpoint, {
        method: 'POST',
        headers: { ...window.authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'HTTP ' + res.status);
      }
      msg.fallback_status = 'done';
      _renderHistory();
      // SWR 캐시 무효화 + data-changed 이벤트 (기존 _runAction 과 동일한 동작)
      try {
        ['customer', 'customers', 'revenue', 'booking', 'bookings'].forEach(k => {
          try { sessionStorage.removeItem('pv_cache::' + k); } catch (_e) { void _e; }
          try { localStorage.removeItem('pv_cache::' + k); } catch (_e) { void _e; }
        });
        window.dispatchEvent(new CustomEvent('itdasy:data-changed', { detail: { kind: kindKey } }));
      } catch (_e) { void _e; }
      _history.push({ role: 'assistant', text: '✓ 저장했어요' });
      _renderHistory();
      if (window.hapticSuccess) window.hapticSuccess();
      if (window.Dashboard?.refresh) window.Dashboard.refresh(true);
    } catch (e) {
      msg.fallback_status = 'failed';
      _renderHistory();
      _history.push({ role: 'assistant', text: '실패: ' + (window._humanError ? window._humanError(e) : e.message) });
      _renderHistory();
    }
  }

  // 단일 document-level 위임 (한 번만 등록)
  let _delegationBound = false;
  let _sendInFlight = false;
  function _bindActionButtons() {
    if (_delegationBound) return;
    _delegationBound = true;
    document.addEventListener('click', (e) => {
      const run = e.target.closest('[data-action-run]');
      if (run && document.getElementById('asstBody')?.contains(run)) {
        _runAction(parseInt(run.dataset.actionRun, 10));
        return;
      }
      const cancel = e.target.closest('[data-action-cancel]');
      if (cancel && document.getElementById('asstBody')?.contains(cancel)) {
        const idx = parseInt(cancel.dataset.actionCancel, 10);
        if (_history[idx]) { _history[idx].action_status = 'cancelled'; _history[idx].action = null; }
        _renderHistory();
        return;
      }
      const sug = e.target.closest('[data-suggest]');
      const sheet = document.getElementById('assistantSheet');
      if (sug && sheet && sheet.contains(sug)) {
        if (_sendInFlight) return;  // 중복 방지
        const q = sug.getAttribute('data-suggest');
        const input = document.getElementById('asstInput');
        if (input) { input.value = q; _send(); }
        return;
      }
      // Wave B5 — typeahead chip: 입력창에 채우기만 (자동 전송 X)
      const ta = e.target.closest('[data-typeahead]');
      if (ta && sheet && sheet.contains(ta)) {
        const q = ta.getAttribute('data-typeahead');
        const input = document.getElementById('asstInput');
        if (input) {
          input.value = q;
          input.focus();
          const box = document.getElementById('asstTypeahead');
          if (box) { box.style.display = 'none'; box.innerHTML = ''; }
        }
        return;
      }
      // Wave B4 — fallback 프리뷰 카드 액션
      const fb = e.target.closest('[data-fallback-intent]');
      if (fb && document.getElementById('asstBody')?.contains(fb)) {
        _submitFallback(parseInt(fb.dataset.fallbackIdx, 10), fb.dataset.fallbackIntent);
        return;
      }
    }, false);
  }

  async function _runAction(idx) {
    const msg = _history[idx];
    if (!msg || !msg.action) return;
    msg.action_status = 'running';
    _renderHistory();
    try {
      const res = await fetch(window.API + '/assistant/execute', {
        method: 'POST',
        headers: { ...window.authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: msg.action.kind, payload: msg.action.payload || {} }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'HTTP ' + res.status);
      }
      const d = await res.json();
      msg.action_status = 'done';
      _renderHistory();

      // 프론트 SWR + PowerView 캐시 전부 무효화 (단수·복수 · session·local 모두)
      const _invalidateKinds = {
        create_customer: ['customer', 'customers'],
        create_booking: ['booking', 'bookings', 'customer', 'customers'],
        create_revenue: ['revenue', 'customer', 'customers'],
        create_nps: ['nps', 'customer', 'customers'],
        update_customer: ['customer', 'customers'],
        update_booking: ['booking', 'bookings'],
        cancel_booking: ['booking', 'bookings'],
        reschedule_booking: ['booking', 'bookings'],
        upsert_inventory: ['inventory'],
      }[d.kind] || [];
      _invalidateKinds.forEach(k => {
        // 단수(powerview) + 복수(SWR) 키 모두 제거
        try { sessionStorage.removeItem('pv_cache::' + k); } catch (_e) { void _e; }
        try { localStorage.removeItem('pv_cache::' + k); } catch (_e) { void _e; }
        // bookings 는 날짜 범위별 키 scan 삭제
        if (k === 'bookings' || k === 'booking') {
          try {
            for (let i = sessionStorage.length - 1; i >= 0; i--) {
              const key = sessionStorage.key(i);
              if (key && key.startsWith('pv_cache::booking')) sessionStorage.removeItem(key);
            }
            for (let i = localStorage.length - 1; i >= 0; i--) {
              const key = localStorage.key(i);
              if (key && key.startsWith('pv_cache::booking')) localStorage.removeItem(key);
            }
          } catch (_e) { void _e; }
        }
        // customer 는 id 별 dashboard 캐시도 scan 삭제 (pv_cache::customer:{id}:dashboard)
        if (k === 'customer' || k === 'customers') {
          try {
            for (let i = sessionStorage.length - 1; i >= 0; i--) {
              const key = sessionStorage.key(i);
              if (key && key.startsWith('pv_cache::customer')) sessionStorage.removeItem(key);
            }
            for (let i = localStorage.length - 1; i >= 0; i--) {
              const key = localStorage.key(i);
              if (key && key.startsWith('pv_cache::customer')) localStorage.removeItem(key);
            }
          } catch (_e) { void _e; }
        }
      });
      // 오픈된 시트가 있으면 데이터 새로고침 신호 전파
      try { window.dispatchEvent(new CustomEvent('itdasy:data-changed', { detail: { kind: d.kind } })); } catch (_e) { void _e; }

      // Phase 6.3 — bulk_message 는 클립보드 복사 처리
      if (d.kind === 'generate_bulk_message' && d.message_draft) {
        try {
          if (navigator.clipboard) await navigator.clipboard.writeText(d.message_draft);
          _history.push({ role: 'assistant', text: '📋 초안을 클립보드에 복사했어요. 카톡·문자에 붙여넣으세요.\n\n---\n' + d.message_draft });
        } catch (e) {
          _history.push({ role: 'assistant', text: '초안 작성됨:\n\n' + d.message_draft });
        }
      } else {
        _history.push({ role: 'assistant', text: d.message || '✓ 완료했어요' });
      }
      _renderHistory();
      if (window.hapticSuccess) window.hapticSuccess();
      if (window.Dashboard?.refresh) window.Dashboard.refresh(true);
    } catch (e) {
      msg.action_status = 'failed';
      _renderHistory();
      _history.push({ role: 'assistant', text: '실패: ' + (window._humanError ? window._humanError(e) : e.message) });
      _renderHistory();
    }
  }

  function _renderSuggest() {
    const el = document.getElementById('asstSuggest');
    if (!el) return;
    // data-suggest 만 두고 클릭은 document 위임 (중복 방지)
    el.innerHTML = SUGGESTIONS.map(s => `
      <button data-suggest="${_esc(s)}" style="padding:8px 12px;border:1px solid #ddd;border-radius:100px;background:#fff;cursor:pointer;font-size:11px;color:#555;white-space:nowrap;">${_esc(s)}</button>
    `).join('');
  }

  // ── 📸 사진 업로드 (챗봇 입력바 좌측 버튼) ─────────────────
  function _openPhotoSheet() {
    // 이미 떠 있으면 닫고 끝
    const existing = document.getElementById('asstPhotoSheet');
    if (existing) { existing.remove(); return; }
    const box = document.createElement('div');
    box.id = 'asstPhotoSheet';
    box.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.45);display:flex;align-items:flex-end;justify-content:center;';
    box.innerHTML = `
      <div style="width:100%;max-width:460px;background:#fff;border-radius:20px 20px 0 0;padding:12px 12px max(12px,env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:8px;">
        <button data-photo-choice="camera" style="padding:16px;border:none;border-radius:14px;background:hsl(340,100%,98%);color:hsl(350,60%,40%);font-size:15px;font-weight:700;cursor:pointer;text-align:center;">📷 사진 찍기</button>
        <button data-photo-choice="gallery" style="padding:16px;border:none;border-radius:14px;background:hsl(340,100%,98%);color:hsl(350,60%,40%);font-size:15px;font-weight:700;cursor:pointer;text-align:center;">🖼️ 갤러리에서</button>
        <button data-photo-choice="cancel" style="padding:14px;border:none;border-radius:14px;background:#f2f2f2;color:#666;font-size:14px;font-weight:700;cursor:pointer;margin-top:4px;">취소</button>
      </div>
    `;
    const close = () => { try { box.remove(); } catch (_e) { void _e; } };
    box.addEventListener('click', (e) => {
      if (e.target === box) { close(); return; }
      const btn = e.target.closest('[data-photo-choice]');
      if (!btn) return;
      const c = btn.dataset.photoChoice;
      close();
      if (c === 'camera') document.getElementById('asstCamera')?.click();
      else if (c === 'gallery') document.getElementById('asstGallery')?.click();
    });
    document.body.appendChild(box);
  }

  async function _uploadPhoto(file) {
    if (_sendInFlight) return;
    _sendInFlight = true;
    const input = document.getElementById('asstInput');
    const question = (input && input.value.trim()) || '';
    if (input) input.value = '';

    // 썸네일 data URL (플레이스홀더 버블용)
    let thumbUrl = '';
    try {
      thumbUrl = await new Promise((resolve) => {
        try {
          const r = new FileReader();
          r.onload = () => resolve(r.result || '');
          r.onerror = () => resolve('');
          r.readAsDataURL(file);
        } catch (_e) { resolve(''); }
      });
    } catch (_e) { void _e; }

    // 플레이스홀더 메시지 (썸네일 + 업로드중 표시)
    const placeholderText = question ? question : '사진 업로드 중…';
    _history.push({ role: 'user', text: placeholderText, thumb: thumbUrl });
    _history.push({ role: 'loading', text: '' });
    _renderHistory();

    try {
      // 압축 (helper 없으면 원본)
      let blob = file;
      try {
        if (typeof window.compressImageForUpload === 'function') {
          blob = await window.compressImageForUpload(file, 1024, 0.85);
        }
      } catch (_e) { blob = file; }

      const fd = new FormData();
      fd.append('image', blob, blob.name || 'photo.jpg');
      if (question) fd.append('question', question);
      if (_sessionId) fd.append('session_id', String(_sessionId));

      // multipart 라서 Content-Type 헤더는 브라우저가 자동 세팅 (boundary)
      const auth = (window.authHeader && window.authHeader()) || {};
      const res = await fetch(window.API + '/assistant/ask/image', {
        method: 'POST',
        headers: auth.Authorization ? { Authorization: auth.Authorization } : {},
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'HTTP ' + res.status);
      }
      const d = await res.json();
      _history = _history.filter(m => m.role !== 'loading');

      if (d.session_id) {
        _sessionId = d.session_id;
        try { localStorage.setItem('assistant_session_id', String(_sessionId)); } catch (_e) { void _e; }
      }

      const actionsList = (Array.isArray(d.actions) && d.actions.length)
        ? d.actions
        : (d.action && d.action.kind ? [d.action] : []);
      const msg = { role: 'assistant', text: d.answer || '사진을 확인했어요.' };
      if (Array.isArray(d.related_questions) && d.related_questions.length) {
        msg.related = d.related_questions.slice(0, 3);
      }
      if (actionsList.length === 1) {
        msg.action = actionsList[0];
        msg.action_status = 'pending';
        _history.push(msg);
      } else if (actionsList.length > 1) {
        _history.push(msg);
        actionsList.forEach((act, idx) => {
          _history.push({
            role: 'assistant',
            text: act.confirmation_text || `${idx + 1}/${actionsList.length} ${act.kind}`,
            action: act,
            action_status: 'pending',
            action_batch_idx: idx,
            action_batch_total: actionsList.length,
          });
        });
      } else {
        _history.push(msg);
      }
      _renderHistory();
      if (window.hapticLight) window.hapticLight();
    } catch (e) {
      _history = _history.filter(m => m.role !== 'loading');
      const human = window._humanError ? window._humanError(e) : (e && e.message) || '알 수 없는 오류';
      _history.push({ role: 'assistant', text: '사진을 못 읽었어요: ' + human });
      _renderHistory();
    } finally {
      _sendInFlight = false;
    }
  }

  async function _send() {
    if (_sendInFlight) return;  // 중복 송신 방지
    const input = document.getElementById('asstInput');
    const q = input.value.trim();
    if (!q) return;
    _sendInFlight = true;
    input.value = '';
    // Wave B5 — 전송 시 typeahead chips 숨김
    try {
      const tb = document.getElementById('asstTypeahead');
      if (tb) { tb.style.display = 'none'; tb.innerHTML = ''; }
    } catch (_e) { void _e; }
    _history.push({ role: 'user', text: q });
    _history.push({ role: 'loading', text: '' });
    _renderHistory();

    try {
      const res = await fetch(window.API + '/assistant/ask', {
        method: 'POST',
        headers: { ...window.authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, session_id: _sessionId || undefined }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const d = await res.json();
      _history = _history.filter(m => m.role !== 'loading');

      // v1.1 — session_id 저장 (서버가 최초 생성 or 기존 사용)
      if (d.session_id) {
        _sessionId = d.session_id;
        try { localStorage.setItem('assistant_session_id', String(_sessionId)); } catch (_e) { void _e; }
      }

      // 복수 액션 지원 — actions[] 우선, 없으면 단일 action 을 배열로
      const actionsList = (Array.isArray(d.actions) && d.actions.length)
        ? d.actions
        : (d.action && d.action.kind ? [d.action] : []);

      // Wave B4 — answer + actions 모두 빈값이면 휴리스틱 프리뷰 카드
      const answerText = (d.answer || '').trim();
      if (!answerText && actionsList.length === 0) {
        const extract = _heuristicExtract(q);
        _history.push({
          role: 'assistant',
          text: '정확히 못 알아들었어요. 아래처럼 정리해봤는데 맞나요?',
          fallback: extract,
        });
        _renderHistory();
        if (window.hapticLight) window.hapticLight();
        return;
      }

      const msg = { role: 'assistant', text: d.answer || '답을 만들지 못했어요.' };
      if (Array.isArray(d.related_questions) && d.related_questions.length) {
        msg.related = d.related_questions.slice(0, 3);
      }

      if (actionsList.length === 1) {
        // 단일 액션: 답변 메시지에 '추가하기 ✓' 버튼 직접 붙임 (기존 UX)
        msg.action = actionsList[0];
        msg.action_status = 'pending';
        _history.push(msg);
      } else if (actionsList.length > 1) {
        // 복수 액션: 답변 + 각 액션을 별도 버블로
        _history.push(msg);
        actionsList.forEach((act, idx) => {
          _history.push({
            role: 'assistant',
            text: act.confirmation_text || `${idx + 1}/${actionsList.length} ${act.kind}`,
            action: act,
            action_status: 'pending',
            action_batch_idx: idx,
            action_batch_total: actionsList.length,
          });
        });
      } else {
        _history.push(msg);
      }
      _renderHistory();
      if (window.hapticLight) window.hapticLight();
    } catch (e) {
      _history = _history.filter(m => m.role !== 'loading');
      _history.push({ role: 'assistant', text: '잠시 연결이 불안정해요. 다시 시도해 주세요. (' + (window._humanError ? window._humanError(e) : e.message) + ')' });
      _renderHistory();
    } finally {
      _sendInFlight = false;
    }
  }

  window.openAssistant = function () {
    _ensureSheet();
    document.getElementById('assistantSheet').style.display = 'block';
    document.body.style.overflow = 'hidden';
    _renderHistory();
    setTimeout(() => document.getElementById('asstInput')?.focus(), 100);
  };
  window.closeAssistant = function () {
    const sheet = document.getElementById('assistantSheet');
    if (sheet) sheet.style.display = 'none';
    document.body.style.overflow = '';
  };
})();
