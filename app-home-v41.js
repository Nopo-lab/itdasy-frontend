/* Home v4.1 톤다운 렌더러 — 헤더/캐러셀/오늘의 예약/운영 3카드.
   SWR: 캐시 즉시 → 백그라운드 fetch. 데이터: /assistant/brief + loadSlotsFromDB().
   외부 hidden anchor (#home-today-brief 등) 손대지 않음.
   window.HomeV41 = { render(containerId), refresh() } */
(function () {
  'use strict';

  const SWR_KEY = 'hv41_cache::brief';
  const SWR_TTL = 60 * 1000;

  function _readSWR() {
    try {
      const raw = localStorage.getItem(SWR_KEY) || sessionStorage.getItem(SWR_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      return { d: obj.d, fresh: Date.now() - obj.t < SWR_TTL };
    } catch (_e) { return null; }
  }
  function _writeSWR(data) {
    try {
      const payload = JSON.stringify({ t: Date.now(), d: data });
      try { localStorage.setItem(SWR_KEY, payload); }
      catch (_e1) { try { sessionStorage.setItem(SWR_KEY, payload); } catch (_e2) { void _e2; } }
    } catch (_e) { /* silent */ }
  }

  // ─────────── fetch ───────────
  function _authHeaders() {
    try {
      const headers = window.authHeader ? window.authHeader() : {};
      return headers && headers.Authorization ? headers : null;
    } catch (_e) { return null; }
  }
  async function _fetchBrief() {
    const headers = _authHeaders();
    if (!window.API || !headers) {
      // [2026-05-20] 디버그 — brief 가 null 로 새는 원인 추적용
      if (!headers) console.warn('[brief] 인증 헤더 없음 - 로그인 상태 확인');
      return null;
    }
    try {
      const res = await apiFetch('/assistant/brief', { headers });
      if (!res.ok) {
        console.warn('[brief] API 응답 실패:', res.status);
        return null;
      }
      const data = await res.json();
      _writeSWR(data);
      return data;
    } catch (_e) {
      console.warn('[brief] fetch 예외:', _e);
      return null;
    }
  }
  async function _fetchSlots() {
    if (typeof window.loadSlotsFromDB !== 'function') return [];
    try { return await window.loadSlotsFromDB(); }
    catch (_e) { return []; }
  }
  // DM 자동응답 승인 대기 큐 — 사장 확인 필요한 답장 N건
  async function _fetchDMQueueCount() {
    const headers = _authHeaders();
    if (!window.API || !headers) return 0;
    try {
      const res = await apiFetch('/dm-confirm-queue', { headers });
      if (!res.ok) return 0;
      const data = await res.json();
      return Array.isArray(data) ? data.length : (Array.isArray(data.items) ? data.items.length : 0);
    } catch (_e) { return 0; }
  }

  // [F1] _fetchProjectedTotal 제거 — 홈 상단 매출 표시 삭제됨

  // [v6] 카운트업 (easeOutCubic 0.8s) — 히어로 / stat 값
  function _countUp(el, target, ms) {
    if (!el || !Number.isFinite(target) || target <= 0) return;
    if (el.dataset.hvCountDone === '1') return;
    el.dataset.hvCountDone = '1';
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / ms, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * ease).toLocaleString('ko-KR') + '원';
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  function _runCountUps(container) {
    const targets = container.querySelectorAll('[data-hv-count]');
    targets.forEach(el => {
      const t = parseInt(el.dataset.hvCount, 10);
      _countUp(el, t, 800);
    });
  }

  // ─────────── 캐러셀 점 인디케이터 ───────────
  function _setupCarousel(container) {
    const car = container.querySelector('[data-hv-carousel]');
    const dots = container.querySelectorAll('[data-hv-dots] .hv-dot');
    const counter = container.querySelector('[data-hv-counter]');
    if (!car || !dots.length) return;
    let raf = 0;
    car.addEventListener('scroll', () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const cards = car.querySelectorAll('.hv-card');
        if (!cards.length) return;
        const cw = cards[0].getBoundingClientRect().width + 10;
        const idx = Math.min(dots.length - 1, Math.max(0, Math.round(car.scrollLeft / cw)));
        dots.forEach((d, i) => d.classList.toggle('is-on', i === idx));
        if (counter) counter.textContent = (idx + 1) + ' / ' + cards.length;
      });
    }, { passive: true });
    dots.forEach((d, i) => {
      d.addEventListener('click', () => {
        const cards = car.querySelectorAll('.hv-card');
        if (!cards[i]) return;
        car.scrollTo({ left: cards[i].offsetLeft - car.offsetLeft, behavior: 'smooth' });
      });
    });
    // 2026-05-01 ── 좌우 화살표 버튼 핸들러
    const wrap = car.parentElement;
    if (wrap && wrap.classList.contains('hv-carousel-wrap')) {
      const goByCard = (dir) => {
        const cards = car.querySelectorAll('.hv-card');
        if (!cards.length) return;
        const cw = cards[0].getBoundingClientRect().width + 10;
        const idx = Math.round(car.scrollLeft / cw);
        const next = Math.max(0, Math.min(cards.length - 1, idx + dir));
        car.scrollTo({ left: cards[next].offsetLeft - car.offsetLeft, behavior: 'smooth' });
      };
      wrap.querySelector('[data-hv-nav="prev"]')?.addEventListener('click', () => goByCard(-1));
      wrap.querySelector('[data-hv-nav="next"]')?.addEventListener('click', () => goByCard(1));
    }
  }

  // ─────────── 이벤트 바인딩 ───────────
  function _handleSlotClick(booking) {
    if (typeof window.showTab === 'function') {
      const btn = document.querySelector('.tab-bar__btn[data-tab="calendar"]');
      try { window.showTab('calendar', btn); } catch (_e) { /* ignore */ }
    }
    const ymd = (booking && booking.starts_at) ? booking.starts_at.split('T')[0] : '';
    if (ymd && typeof window.openBooking === 'function') {
      try { window.openBooking(ymd); } catch (_e) { /* ignore */ }
    }
    // TODO[v1.5]: 예약 상세 sheet 자동 오픈 — 현재 미구현
  }

  function _bindEvents(container, brief) {
    const bookings = window.HomeV41Render.todayBookings(brief);
    container.querySelectorAll('[data-hv-slot]').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.hvSlot, 10);
        const b = bookings[idx];
        if (b) _handleSlotClick(b);
      });
    });
    container.querySelectorAll('[data-hv-act]').forEach(el => {
      // 슬롯 안의 act는 슬롯 핸들러가 처리하므로 중복 방지
      if (el.hasAttribute('data-hv-slot')) return;
      el.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        window.HomeV41Actions.run(el.dataset.hvAct || '');
      });
    });
    _bindItbiCardInput(container);
    // AI 캐러셀 paging (3-per-page)
    _bindAiCarousel(container);
  }

  // [2026-05-28] 메인홈 잇비 카드 입력 — 카메라/음성/보내기 → 시트 진입
  function _bindItbiCardInput(container) {
    const input = container.querySelector('[data-itbi-input]');
    const fileInput = container.querySelector('[data-itbi-file]');
    const openSheet = (opts) => {
      const open = (window.AssistantSheet && window.AssistantSheet.open) || window.openAssistant;
      if (typeof open === 'function') open(opts || {});
    };
    if (window.HomeV41ItbiPrompts && typeof window.HomeV41ItbiPrompts.bind === 'function') {
      window.HomeV41ItbiPrompts.bind(container, { fileInput, openSheet });
    }
    container.querySelectorAll('[data-itbi-act]').forEach(btn => {
      btn.addEventListener('click', (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        const act = btn.dataset.itbiAct;
        if (act === 'photo') {
          fileInput?.click();
        } else if (act === 'voice') {
          if (!navigator.mediaDevices?.getUserMedia) {
            if (window.showToast) window.showToast('이 브라우저는 음성 입력을 지원하지 않아요');
            return;
          }
          navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => { stream.getTracks().forEach(t => t.stop()); openSheet({ startVoice: true }); })
            .catch(() => { if (window.showToast) window.showToast('마이크 권한이 필요해요'); });
        } else if (act === 'send') {
          const text = (input?.value || '').trim();
          openSheet(text ? { sendImmediate: text } : {});
          if (input) input.value = '';
        }
      });
    });
    if (input) {
      input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' && !ev.shiftKey) {
          ev.preventDefault();
          const text = input.value.trim();
          openSheet(text ? { sendImmediate: text } : {});
          input.value = '';
        }
      });
      // 카드 자체 클릭 라우팅이 input 포커스 막지 않도록
      input.addEventListener('click', (ev) => ev.stopPropagation());
    }
    _bindItbiFileInput(fileInput, openSheet);
  }

  function _bindItbiFileInput(fileInput, openSheet) {
    if (!fileInput) return;
    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      const sendImmediate = fileInput.dataset.itbiPrompt || '';
      if (file) openSheet(sendImmediate ? { attachPhoto: file, sendImmediate } : { attachPhoto: file });
      fileInput.dataset.itbiPrompt = '';
      fileInput.value = '';
    });
  }

  function _bindAiCarousel(container) {
    const track = container.querySelector('#hv5AiTrack');
    if (!track) return;
    const cards = Array.from(track.children);
    if (cards.length === 0) return;
    // 안전장치 — ok=0 먼저, ok=1 뒤로 재정렬 (renderer 가 이미 정렬했지만 보장)
    cards.sort((a, b) => (+a.dataset.ok || 0) - (+b.dataset.ok || 0));
    cards.forEach(c => track.appendChild(c));

    // [2026-05-25] 모바일은 카드 1장씩 snap, PC 는 3장씩 그룹 페이징.
    //   기존: perPage=3 고정 → 모바일 swipe 한번에 3장 넘어가 카드 못 봄.
    const isMobile = window.matchMedia('(max-width: 540px)').matches;
    const perPage = isMobile ? 1 : 3;
    const pages = Math.max(1, Math.ceil(cards.length / perPage));
    let page = 0;
    const prevBtn = container.querySelector('#hv5AiPrev');
    const nextBtn = container.querySelector('#hv5AiNext');
    const dotsWrap = container.querySelector('#hv5AiDots');

    function goTo(p) {
      page = Math.max(0, Math.min(pages - 1, p));
      const cardW = cards[0].getBoundingClientRect().width + 10;
      track.scrollTo({ left: page * perPage * cardW, behavior: 'smooth' });
      dotsWrap?.querySelectorAll('.hv5-ai-dot-nav').forEach((d, i) => {
        d.classList.toggle('on', i === page);
      });
      if (prevBtn) prevBtn.disabled = page === 0;
      if (nextBtn) nextBtn.disabled = page >= pages - 1;
    }
    prevBtn?.addEventListener('click', (e) => { e.stopPropagation(); goTo(page - 1); });
    nextBtn?.addEventListener('click', (e) => { e.stopPropagation(); goTo(page + 1); });
    dotsWrap?.querySelectorAll('.hv5-ai-dot-nav').forEach(d => {
      d.addEventListener('click', (e) => {
        e.stopPropagation();
        goTo(parseInt(d.dataset.hvAiPage, 10) || 0);
      });
    });
    // 모바일은 CSS scroll-snap 이 처리. JS 강제 페이지 이동은 PC 만.
    if (!isMobile) {
      let startX = 0;
      track.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
      track.addEventListener('touchend', (e) => {
        const diff = startX - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 40) {
          if (diff > 0) goTo(page + 1);
          else goTo(page - 1);
        }
      }, { passive: true });
    }
  }

  // ─────────── 메인 렌더 ───────────
  let _lastContainerId = null;
  let _inFlight = false;

  function _hydrateHome(container, brief, dmQueueCount) {
    container.innerHTML = window.HomeV41Render.compose(brief, dmQueueCount);
    _setupCarousel(container);
    _bindEvents(container, brief);
    window.HomeV41Render.syncAvatar(container);
    _scheduleAvatarRetry(container);
    _runCountUps(container);
    // [2026-06-07] 고객 메시지 카드 줄 채우기 (DOM 재생성됐으니 매 렌더마다 갱신)
    try { window.HomeCustomerMsgs && window.HomeCustomerMsgs.refresh(); } catch (_e) { void _e; }
  }

  function _showConnectionError(container) {
    container.innerHTML = `
      <div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
        <div style="font-size:40px;margin-bottom:12px">📡</div>
        <div style="font-size:16px;font-weight:600;margin-bottom:8px">연결이 불안정해요</div>
        <div style="font-size:14px">인터넷 연결을 확인하고 다시 시도해주세요</div>
        <button data-home-reload style="margin-top:16px;padding:10px 24px;background:var(--brand);color:#fff;border:none;border-radius:10px;font-size:14px;cursor:pointer">다시 시도</button>
      </div>`;
    container.querySelector('[data-home-reload]')?.addEventListener('click', () => location.reload());
  }

  async function _doRender(containerId) {
    const container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!container) return;
    _lastContainerId = container.id || _lastContainerId;

    // SWR: 캐시 즉시 (DM 큐 카운트는 캐시에 없으니 0 으로 시작)
    const swr = _readSWR();
    if (swr && swr.d) {
      try {
        _hydrateHome(container, swr.d, swr.d._dmQueueCount || 0);
        _watchHeaderAvatar();
        if (swr.fresh) return;
      } catch (_e) { /* fall through */ }
    }

    if (_inFlight) return;
    _inFlight = true;
    try {
      const [brief, slots, dmQueueCount] = await Promise.all([
        _fetchBrief().catch(() => null),
        _fetchSlots().catch(() => []),
        _fetchDMQueueCount().catch(() => 0),
      ]);
      const merged = brief || (swr && swr.d) || {};
      // [A12] 모든 API 실패 시 에러 안내
      if (!brief && !(swr && swr.d) && (!slots || !slots.length)) {
        _showConnectionError(container);
        return;
      }
      merged._dmQueueCount = dmQueueCount;
      try { _writeSWR(merged); } catch (_e) { void _e; }
      _hydrateHome(container, merged, dmQueueCount);
      requestAnimationFrame(() => { window.scrollTo(0, 0); });
    } finally {
      _inFlight = false;
    }
  }

  // 인스타 fetch 가 v4.1 마운트보다 늦게 끝날 수 있어 한 번만 추가 sync.
  let _avatarRetryTimer = 0;
  function _scheduleAvatarRetry(container) {
    if (_avatarRetryTimer) clearTimeout(_avatarRetryTimer);
    _avatarRetryTimer = setTimeout(() => {
      _avatarRetryTimer = 0;
      const root = document.getElementById('homeV41Root');
      if (root && root.contains(container)) window.HomeV41Render.syncAvatar(container);
      else if (root) window.HomeV41Render.syncAvatar(root);
    }, 5000);
  }

  // 2026-05-01 ── 인스타 연동 후 #headerAvatar 변경 감지: MutationObserver.
  // updateHeaderProfile (app-core.js) 이 itdasy:data-changed 발사 안 해서
  // OAuth 끝나도 v4.1 헤더 아바타 갱신 안 되던 버그 픽스.
  let _avatarObserver = null;
  function _watchHeaderAvatar() {
    if (_avatarObserver) return;
    const target = document.getElementById('headerAvatar');
    if (!target) return;
    _avatarObserver = new MutationObserver(() => {
      const root = document.getElementById('homeV41Root');
      if (root) window.HomeV41Render.syncAvatar(root);
    });
    _avatarObserver.observe(target, {
      childList: true,        // <img> 추가/제거
      subtree: true,
      attributes: true,
      attributeFilter: ['src'],
    });
  }

  // ─────────── 공개 API ───────────
  window.HomeV41 = {
    async render(containerId) { return _doRender(containerId || 'homeV41Root'); },
    async refresh() {
      if (_lastContainerId) return _doRender(_lastContainerId);
    },
  };

  // ─────────── 자동 부트스트랩 ───────────
  function _autoMount() {
    const el = document.getElementById('homeV41Root');
    if (el) _doRender(el);
    // [v206 2026-05-19] 모닝 브리핑 마운트 제거 — AI비서 실시간 분석과 중복.
    //   homeMorningMount div 자체는 호환성 위해 남겨둠 (display:none).
    //   TodayMorning 모듈은 유지 (다른 진입점에서 사용 가능).
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _autoMount, { once: true });
  } else {
    _autoMount();
  }

  // 데이터 변경 이벤트 — 홈 탭 활성 시 재렌더 + 아바타 즉시 동기화
  if (!window._homeV41DataListenerInit) {
    window._homeV41DataListenerInit = true;
    let _retryTimers = [];
    const _clearSWR = () => {
      try { localStorage.removeItem(SWR_KEY); } catch (_e) { void _e; }
      try { sessionStorage.removeItem(SWR_KEY); } catch (_e) { void _e; }
    };
    window.addEventListener('itdasy:data-changed', (ev) => {
      const kind = (ev && ev.detail && ev.detail.kind) || '';
      const isBookingish = /booking|revenue|completion|customer/.test(kind);
      // [v201] 안전망 — booking/revenue/completion 관련이면 brief SWR 캐시 즉시 삭제.
      //   booking-api 측 무효화가 있긴 하지만 racy 케이스 방어.
      if (isBookingish) _clearSWR();
      const root = document.getElementById('homeV41Root');
      if (!root) return;
      // 홈 탭 비활성이어도 아바타는 최신화 (다음 진입 시 깜빡임 방지)
      window.HomeV41Render.syncAvatar(root);
      // [2026-06-10 QA] 탭 활성 조건 제거 — 예약관리에서 예약 추가/취소 후 홈에 와도
      //   옛 DOM 이 그대로 남아 "반영이 한참 걸리는" 문제 픽스. 데이터 변경 이벤트는
      //   드물어서 백그라운드 재렌더 비용 무시 가능.
      _doRender(root);
      // [2026-06-14 QA] 예약 추가/완료 직후 /assistant/brief 가 옛 값을 반환(서버 반영
      //   지연)해 즉시 재fetch 가 stale 를 받던 문제. 수동 새로고침은 수 초 뒤라 정상이었음.
      //   → 지연 재fetch 안전망: 캐시 비우고 한두 번 더 갱신해 백엔드 지연을 따라잡음.
      if (isBookingish) {
        _retryTimers.forEach(clearTimeout); _retryTimers = [];
        [1500, 4000].forEach((ms) => {
          _retryTimers.push(setTimeout(() => {
            _clearSWR();
            const r = document.getElementById('homeV41Root');
            if (r) _doRender(r);
          }, ms));
        });
      }
    });
  }

  // [v201] 서비스 프리셋 사전 로드 — todayExpected 폴백 가격이 작동하려면 캐시 필요.
  //   loadServiceTemplates 완료 후 홈이 mount 됐으면 한번 더 렌더.
  if (typeof window.loadServiceTemplates === 'function' && !window._homeV41SvcWarmed) {
    window._homeV41SvcWarmed = true;
    window.loadServiceTemplates().then(() => {
      const root = document.getElementById('homeV41Root');
      if (root) _doRender(root);
    }).catch(() => { /* silent */ });
  }
})();
