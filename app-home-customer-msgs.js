/* 홈 "고객 메시지" 카드 줄 (2026-06-07) — 카카오 '실시간 채팅' 참고.
   디자인: ../mockup-home-dm-cards.html · 토큰: css/tokens.css

   - 데이터: 기존 GET /instagram/dm-reply/conversations (DM 화면과 동일 엔드포인트, 추가 비용 0).
   - 갱신: 홈 렌더 직후 refresh() + 홈 탭 활성 동안 10초 폴링 (DM list 폴링과 동일 주기).
   - 안읽음: 클라이언트 read 추적(localStorage). 첫 도입 시 현재 대화 전부 기준선(read) 처리 →
            이후 새로 들어온 메시지만 '안읽음'. 카드 탭 하면 read 처리(점만 off, 제거 X).
   - 카드 탭 → window.openDMAutoreplySettings() (검토 대기 인박스: AI 초안 수정·전송) + 해당 손님으로 스크롤.
   - 카드 제거: 답장 전송 성공(itdasy:dm-replied) 또는 X(dismiss) 때만. 새 메시지 오면 재등장.
   - 전체 보기 → window.openDMConfirmQueue() (실시간 DM 카드 리스트).
   - 프사 없으면 사람 실루엣 아이콘.

   window.HomeCustomerMsgs = { refresh() }
*/
(function () {
  'use strict';

  const READ_KEY = 'itdasy:cmsg:read';        // { [sender_igsid]: lastReadISO } — 안읽음 점만 제어
  const DISMISS_KEY = 'itdasy:cmsg:dismissed'; // { [sender_igsid]: dismissedAtISO } — 카드 제거(답장/X)
  const MAX_CARDS = 12;
  const POLL_MS = 10000;
  const MIN_FETCH_GAP = 8000;            // 홈 다중 렌더 시 캐시 재사용 (API 과호출 방지)

  // 프사 없을 때 기본 아바타 — 사람 실루엣 (이니셜 X). color 는 .hv5-cmsg-av 의 brand-strong 사용.
  const _AVATAR_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2.2c-4.5 0-8 2.6-8 5.9V21h16v-.9c0-3.3-3.5-5.9-8-5.9Z"/></svg>';

  let _cache = null;     // 마지막 conversations 배열
  let _lastFetch = 0;
  let _inFlight = false;
  let _pollTimer = null;
  let _delegated = false;

  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // ── read(안읽음) 추적 ──────────────────────────────────────
  function _readMap() {
    try { return JSON.parse(localStorage.getItem(READ_KEY) || '{}') || {}; }
    catch (_e) { return {}; }
  }
  function _writeMap(m) {
    try { localStorage.setItem(READ_KEY, JSON.stringify(m)); } catch (_e) { void _e; }
  }
  // 첫 도입(키 없음) — 현재 대화 전부 기준선 처리. 이후 새 메시지만 안읽음으로 뜸.
  function _ensureBaseline(convos) {
    if (localStorage.getItem(READ_KEY) !== null) return _readMap();
    const m = {};
    (convos || []).forEach(c => {
      if (c && c.sender_igsid && c.last_seen) m[c.sender_igsid] = c.last_seen;
    });
    _writeMap(m);
    return m;
  }
  function _isUnread(c, map) {
    if (!c || !c.last_seen) return false;
    const r = map[c.sender_igsid];
    if (!r) return true;
    const a = new Date(c.last_seen).getTime();
    const b = new Date(r).getTime();
    return Number.isFinite(a) && Number.isFinite(b) ? a > b : false;
  }
  function _markRead(sender) {
    const map = _readMap();
    const c = (_cache || []).find(x => x && x.sender_igsid === sender);
    map[sender] = (c && c.last_seen) || new Date().toISOString();
    _writeMap(map);
  }

  // ── dismiss(카드 제거) 추적 — 답장 전송/X 누름. '읽음'으로는 제거 X. ─────
  //   dismissedAt 시점 이후 손님이 새 메시지를 보내면(last_seen 갱신) 카드 재등장.
  function _dismissMap() {
    try { return JSON.parse(localStorage.getItem(DISMISS_KEY) || '{}') || {}; }
    catch (_e) { return {}; }
  }
  function _writeDismiss(m) {
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify(m)); } catch (_e) { void _e; }
  }
  function _isDismissed(c, dmap) {
    if (!c || !c.last_seen) return false;
    const d = dmap[c.sender_igsid];
    if (!d) return false;
    const a = new Date(c.last_seen).getTime();
    const b = new Date(d).getTime();
    return Number.isFinite(a) && Number.isFinite(b) ? a <= b : false;
  }
  function _dismiss(sender) {
    if (!sender) return;
    const m = _dismissMap();
    const c = (_cache || []).find(x => x && x.sender_igsid === sender);
    m[sender] = (c && c.last_seen) || new Date().toISOString();
    _writeDismiss(m);
  }

  // ── 표시 헬퍼 ──────────────────────────────────────────────
  function _displayName(c) {
    const nick = (c.nickname || '').trim();
    if (nick) return nick;
    const tail = c.sender_tail || (c.sender_igsid || '').slice(-4);
    return '손님 …' + tail;
  }
  const _INTENT_LABEL = {
    pricing: '가격 문의', booking: '예약 문의', hours: '영업시간',
    location: '위치 문의', review: '후기', complaint: '문의',
  };
  function _intentLabel(i) { return _INTENT_LABEL[i] || ''; }

  function _relTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const t = d.getTime();
    if (!Number.isFinite(t)) return '';
    const now = new Date();
    const diff = (now.getTime() - t) / 1000;
    if (diff < 60) return '방금';
    if (diff < 3600) return Math.floor(diff / 60) + '분 전';
    if (d.toDateString() === now.toDateString()) return Math.floor(diff / 3600) + '시간 전';
    const yest = new Date(now); yest.setDate(yest.getDate() - 1);
    if (d.toDateString() === yest.toDateString()) return '어제';
    if (diff < 7 * 86400) return d.toLocaleDateString('ko-KR', { weekday: 'short' });
    return d.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
  }

  // ── 카드 HTML ──────────────────────────────────────────────
  function _cardHtml(c, map) {
    const name = _displayName(c);
    const unread = _isUnread(c, map);
    const pic = (c.profile_pic || '').trim();
    const avCls = 'hv5-cmsg-av' + (unread ? ' is-unread' : '');
    // 실루엣을 항상 깔고, 프사 있으면 <img> 로 덮음. onerror(깨짐) 시 img 제거 → 실루엣 폴백.
    const avImg = pic
      ? `<img class="hv5-cmsg-avimg" src="${_esc(pic)}" referrerpolicy="no-referrer" alt="" onerror="this.remove()">`
      : '';
    const last = (c.last_text || '').trim() || '메시지 없음';
    const intent = _intentLabel(c.last_intent);
    const sid = _esc(c.sender_igsid);
    return `<button type="button" class="hv5-cmsg-card" data-cmsg-sender="${sid}">
      <span class="hv5-cmsg-x" data-cmsg-dismiss="${sid}" role="button" tabindex="0" aria-label="${_esc(name)} 카드 지우기">✕</span>
      <div class="hv5-cmsg-ctop">
        <div class="${avCls}">${_AVATAR_SVG}${avImg}</div>
        <div class="hv5-cmsg-id">
          <div class="hv5-cmsg-nm">${_esc(name)}</div>
          <div class="hv5-cmsg-tm">${_esc(_relTime(c.last_seen))}</div>
        </div>
      </div>
      <div class="hv5-cmsg-msg${unread ? ' un' : ''}">${_esc(last)}</div>
      <span class="hv5-cmsg-badge"${intent ? '' : ' style="visibility:hidden" aria-hidden="true"'}>${_esc(intent || ' ')}</span>
    </button>`;
  }

  // ── 렌더 (캐시 → DOM) ──────────────────────────────────────
  function _renderFromCache() {
    const sec = document.getElementById('hv5Cmsg');
    const row = document.getElementById('hv5CmsgRow');
    if (!sec || !row) return;
    const all = _cache || [];
    const dmap = _dismissMap();
    // 친구·가족 등 톤 분석 제외 채팅방 숨김 + 답장/X 로 dismiss 된 카드 숨김(새 메시지 오면 재등장).
    const convos = all
      .filter(c => c && c.sender_igsid && !c.excluded_from_analysis && !_isDismissed(c, dmap))
      .slice()
      .sort((a, b) => new Date(b.last_seen || 0) - new Date(a.last_seen || 0));
    if (!convos.length) { sec.hidden = true; return; }

    const map = _ensureBaseline(all);
    const unread = convos.filter(c => _isUnread(c, map)).length;
    const cards = convos.slice(0, MAX_CARDS);

    sec.hidden = false;
    row.innerHTML = cards.map(c => _cardHtml(c, map)).join('');
    const cnt = document.getElementById('hv5CmsgCount');
    if (cnt) cnt.textContent = unread > 0 ? `· ${unread}건 새 메시지` : '';
  }

  // ── fetch ──────────────────────────────────────────────────
  async function _fetchConvos() {
    const headers = window.authHeader ? window.authHeader() : {};
    if (!headers || !headers.Authorization) return;
    const res = await apiFetch('/instagram/dm-reply/conversations', { headers });
    if (!res.ok) return;
    const d = await res.json().catch(() => ({}));
    _cache = Array.isArray(d.conversations) ? d.conversations : [];
    _lastFetch = Date.now();
  }

  async function refresh() {
    _renderFromCache();                 // 캐시로 즉시 페인트 (DOM 재생성 직후)
    if (_inFlight) return;
    if (_cache && (Date.now() - _lastFetch) < MIN_FETCH_GAP) return;
    _inFlight = true;
    try { await _fetchConvos(); _renderFromCache(); }
    catch (_e) { /* 캐시 유지 */ }
    finally { _inFlight = false; }
  }

  // ── 이벤트 위임 (카드 탭 / 전체 보기) ──────────────────────
  function _bindDelegation() {
    if (_delegated) return;
    _delegated = true;
    document.body.addEventListener('click', (e) => {
      const more = e.target.closest('#hv5CmsgMore');
      if (more) {
        e.preventDefault();
        // [2026-06-08] '전체 보기' → 실시간 DM 카드 리스트 (옛 채팅방 목록 은퇴)
        if (typeof window.openDMConfirmQueue === 'function') window.openDMConfirmQueue();
        else if (typeof window.openDMConversations === 'function') window.openDMConversations();
        return;
      }
      // X(지우기) — 카드 탭보다 먼저 가로채서 dismiss (답장 안 하고 목록에서 제거)
      const x = e.target.closest('[data-cmsg-dismiss]');
      if (x && document.getElementById('hv5Cmsg')) {
        e.preventDefault();
        e.stopPropagation();
        _dismiss(x.dataset.cmsgDismiss);
        _renderFromCache();
        try { window.hapticLight && window.hapticLight(); } catch (_e2) { void _e2; }
        return;
      }
      const card = e.target.closest('[data-cmsg-sender]');
      if (card && document.getElementById('hv5Cmsg')) {
        e.preventDefault();
        const sender = card.dataset.cmsgSender;
        if (!sender) return;
        _markRead(sender);              // 안읽음 점만 off (제거는 답장/X 때만)
        _renderFromCache();
        try { window.hapticLight && window.hapticLight(); } catch (_e2) { void _e2; }
        _openReply(sender);
      }
    });
  }

  // 카드 탭 → '실시간 DM' 카드 리스트에서 그 손님 카드로 포커스 (옛 풀 대화창 은퇴).
  function _openReply(sender) {
    if (typeof window.openDMCardForSender === 'function') {
      window.openDMCardForSender(sender);
    } else if (typeof window.openDMConfirmQueue === 'function') {
      window.openDMConfirmQueue();
    } else if (typeof window.openDMConversations === 'function') {
      window.openDMConversations();
    }
  }

  // ── 폴링 (홈 탭 활성 + 섹션 존재 시에만) ──────────────────
  function _homeActive() {
    const tab = document.getElementById('tab-home');
    return !!(tab && tab.classList.contains('active'));
  }
  function _startPoll() {
    if (_pollTimer) return;
    _pollTimer = setInterval(() => {
      if (document.hidden) return;
      if (!document.getElementById('hv5Cmsg') || !_homeActive()) return;
      refresh();
    }, POLL_MS);
  }

  function _ensureStyles() {
    if (document.getElementById('hv5CmsgStyles')) return;
    const s = document.createElement('style');
    s.id = 'hv5CmsgStyles';
    s.textContent = `
      .hv5-cmsg{margin-top:16px}
      .hv5-cmsg[hidden]{display:none}
      .hv5-cmsg-head{display:flex;align-items:center;gap:8px;margin-bottom:10px;padding:0 2px}
      .hv5-cmsg-title{font-size:15px;font-weight:700;color:var(--text)}
      .hv5-cmsg-count{font-size:11px;font-weight:700;color:var(--brand-strong);background:var(--brand-bg);padding:3px 9px;border-radius:999px}
      .hv5-cmsg-more{margin-left:auto;font-size:12px;color:var(--text-subtle);font-weight:600;background:none;border:none;cursor:pointer;padding:4px 2px}
      .hv5-cmsg-row{display:flex;gap:11px;overflow-x:auto;padding:2px 2px 6px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
      .hv5-cmsg-row::-webkit-scrollbar{display:none}
      .hv5-cmsg-card{position:relative;flex:0 0 168px;text-align:left;background:var(--surface);border:.5px solid var(--border);border-radius:16px;padding:13px;box-shadow:var(--shadow-sm);cursor:pointer;font-family:inherit;display:block}
      .hv5-cmsg-card:active{transform:scale(.98)}
      .hv5-cmsg-x{position:absolute;top:6px;right:6px;width:22px;height:22px;display:flex;align-items:center;justify-content:center;border-radius:50%;color:var(--text-subtle);font-size:11px;line-height:1;background:transparent;z-index:1}
      .hv5-cmsg-x:hover,.hv5-cmsg-x:active{background:var(--surface-2);color:var(--text-muted)}
      .hv5-cmsg-av svg{width:20px;height:20px}
      .hv5-cmsg-avimg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:50%}
      .hv5-cmsg-ctop{display:flex;align-items:center;gap:9px;margin-bottom:10px}
      .hv5-cmsg-av{width:38px;height:38px;border-radius:50%;flex-shrink:0;position:relative;background:var(--brand-bg) center/cover no-repeat;display:flex;align-items:center;justify-content:center;color:var(--brand-strong);font-weight:700;font-size:14px}
      .hv5-cmsg-av.is-unread::after{content:"";position:absolute;top:-1px;right:-1px;width:10px;height:10px;border-radius:50%;background:var(--brand);border:2px solid var(--surface)}
      .hv5-cmsg-id{min-width:0;flex:1}
      .hv5-cmsg-nm{font-size:13.5px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .hv5-cmsg-tm{font-size:10px;color:var(--text-subtle);margin-top:1px}
      .hv5-cmsg-msg{font-size:12px;color:var(--text-muted);line-height:1.45;height:35px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
      .hv5-cmsg-msg.un{color:var(--text);font-weight:500}
      .hv5-cmsg-badge{display:inline-block;margin-top:9px;font-size:10px;font-weight:700;color:var(--brand-strong);background:var(--brand-bg);padding:2px 8px;border-radius:6px}
    `;
    document.head.appendChild(s);
  }

  function _init() {
    _ensureStyles();
    _bindDelegation();
    _startPoll();
    // 새 DM 실시간: 데이터 변경 이벤트에도 가볍게 반응
    window.addEventListener('itdasy:data-changed', () => {
      if (document.getElementById('hv5Cmsg')) refresh();
    });
    // 답장 전송 성공(검토 대기 인박스) → 해당 손님 카드 자동 제거.
    //   이벤트는 sender 끝 4자(tail) 만 줄 수 있어 endsWith 로 매칭.
    window.addEventListener('itdasy:dm-replied', (ev) => {
      const d = (ev && ev.detail) || {};
      const sid = d.sender_igsid || '';
      const tail = d.tail || '';
      (_cache || []).forEach(c => {
        if (!c || !c.sender_igsid) return;
        if ((sid && c.sender_igsid === sid) || (tail && c.sender_igsid.endsWith(tail))) {
          _dismiss(c.sender_igsid);
        }
      });
      _renderFromCache();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init, { once: true });
  } else {
    _init();
  }

  window.HomeCustomerMsgs = { refresh };
})();
