/* 매출 캘린더 (칩 방식) — 2026-06-05
   예약 월 그리드(window.CalendarView.buildMonthGridHTML, .bk-month-m)를 그대로 재사용.
   칸 내용만 매출칩(그 날 합계 "62만")으로 분기. 날짜 탭 → 인라인 매출 상세.
   window.RevenueCalendar = { renderInto(gridEl, detailEl, opts) }
   opts: { items, year, month, isMobile } */
(function () {
  'use strict';

  const TAG_LABEL = {
    card: '카드', cash: '현금', transfer: '계좌',
    bank_transfer: '계좌', membership: '회원권', etc: '기타',
  };
  const METHOD_ORDER = ['card', 'cash', 'transfer', 'membership', 'etc'];
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];

  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }
  function _money(n) { return (+n || 0).toLocaleString('ko-KR'); }
  // 만원 단위 칩 표기 (천 단위 반올림). 0원/내역 없는 날은 호출 안 함.
  function _man(total) {
    const m = Math.round((+total || 0) / 10000);
    return (total > 0 ? Math.max(1, m) : 0) + '만';
  }
  // recorded_at(ISO, tz-aware) → KST 달력 날짜 'YYYY-MM-DD'
  function _kstDay(iso) {
    try { return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }); }
    catch (_e) { return ''; }
  }
  function _normMethod(m) {
    let k = String(m || 'card').toLowerCase();
    if (k === 'bank_transfer') k = 'transfer';
    return TAG_LABEL[k] ? k : 'etc';
  }
  function _groupByDay(items) {
    const map = {};
    (items || []).forEach(r => {
      const day = _kstDay(r.recorded_at || r.created_at);
      if (!day) return;
      (map[day] = map[day] || []).push(r);
    });
    return map;
  }

  function _ensureStyles() {
    if (document.getElementById('rvcalStyles')) return;
    const s = document.createElement('style');
    s.id = 'rvcalStyles';
    s.textContent = `
      .rvcal-grid .bk-month-m__cell--sel{outline:2px solid var(--brand-strong,#BC6675);outline-offset:-2px;border-radius:6px;z-index:1}
      .rvcal-detail{margin-top:14px;background:var(--surface,#fff);border:.5px solid var(--border,rgba(0,0,0,.07));border-radius:16px;padding:16px 18px;box-shadow:var(--shadow-sm,0 2px 8px rgba(0,0,0,.04))}
      .rvcal-detail.is-empty{color:var(--text-subtle,#8B95A1);font-size:12.5px;text-align:center;padding:22px 18px;font-weight:500}
      .rvcal-dh{display:flex;align-items:center;border-left:3px solid var(--brand-strong,#BC6675);padding-left:11px;margin-bottom:6px}
      .rvcal-dh .dt{font-size:14.5px;font-weight:700;color:var(--text,#191F28)}
      .rvcal-dh .da{margin-left:auto;font-size:17px;font-weight:800;letter-spacing:-.03em;color:var(--text,#191F28);font-variant-numeric:tabular-nums}
      .rvcal-dsub{font-size:11.5px;color:var(--text-subtle,#8B95A1);padding-left:14px;margin-bottom:8px;font-weight:500}
      .rvcal-li{display:flex;align-items:center;padding:11px 0;border-top:.5px solid var(--border,rgba(0,0,0,.07))}
      .rvcal-li .nm{flex:1;font-size:13.5px;font-weight:500;color:var(--text,#191F28)}
      .rvcal-li .pm{min-width:36px;text-align:center;font-size:10.5px;color:var(--text-subtle,#8B95A1);background:var(--surface-2,#F7F8FA);padding:3px 9px;border-radius:999px;font-weight:500;margin-right:14px}
      .rvcal-li .am{min-width:76px;text-align:right;font-size:13.5px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--text,#191F28)}
      .rvcal-add{margin-top:12px;width:100%;padding:11px;border:.5px solid var(--brand,#D58A95);border-radius:10px;background:var(--brand-bg,#F7EFF0);color:var(--brand-strong,#BC6675);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}
      .rvcal-add:active{transform:scale(.99)}
    `;
    document.head.appendChild(s);
  }

  function _dayLabel(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})`;
  }

  function _renderDetail(detailEl, dateStr, records) {
    const list = (records || []).slice().sort((a, b) => (b.amount || 0) - (a.amount || 0));
    const total = list.reduce((s, r) => s + (r.amount || 0), 0);
    // 결제수단 카운트
    const counts = {};
    list.forEach(r => { const k = _normMethod(r.method); counts[k] = (counts[k] || 0) + 1; });
    const methodStr = METHOD_ORDER.filter(k => counts[k]).map(k => `${TAG_LABEL[k]} ${counts[k]}`).join(' · ');
    const sub = `${list.length}팀 완료${methodStr ? ' · ' + methodStr : ''}`;
    const rows = list.map(r => {
      const nm = _esc(r.service_name || r.memo || '시술');
      const pm = TAG_LABEL[_normMethod(r.method)];
      return `<div class="rvcal-li"><span class="nm">${nm}</span><span class="pm">${pm}</span><span class="am">${_money(r.amount)}</span></div>`;
    }).join('');
    detailEl.className = 'rvcal-detail';
    detailEl.innerHTML = `
      <div class="rvcal-dh"><span class="dt">${_esc(_dayLabel(dateStr))}</span><span class="da">${_money(total)}원</span></div>
      ${list.length ? `<div class="rvcal-dsub">${_esc(sub)}</div>` : '<div class="rvcal-dsub">이 날은 기록된 매출이 없어요</div>'}
      ${rows}
      <button type="button" class="rvcal-add" data-rvcal-add="${_esc(dateStr)}">+ 이 날 매출 입력</button>`;
  }

  function renderInto(gridEl, detailEl, opts) {
    opts = opts || {};
    if (!gridEl || !window.CalendarView || !window.CalendarView.buildMonthGridHTML) return;
    _ensureStyles();
    const byDay = _groupByDay(opts.items);
    const totals = {};
    Object.keys(byDay).forEach(day => { totals[day] = byDay[day].reduce((s, r) => s + (r.amount || 0), 0); });

    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
    // 이번 달이면 오늘을, 아니면 매출 있는 첫 날을 기본 선택
    let selected = (totals[todayStr] != null || todayStr.startsWith(`${opts.year}-${String(opts.month).padStart(2, '0')}`))
      ? todayStr : (Object.keys(byDay).sort()[0] || '');

    function paint() {
      gridEl.innerHTML = window.CalendarView.buildMonthGridHTML({
        year: opts.year, month: opts.month, selected,
        dayChip: (dateStr) => {
          const t = totals[dateStr];
          return t > 0 ? `<div class="bk-month-m__evt">${_man(t)}</div>` : '';
        },
      });
    }
    paint();
    if (detailEl) {
      if (selected) _renderDetail(detailEl, selected, byDay[selected] || []);
      else { detailEl.className = 'rvcal-detail is-empty'; detailEl.textContent = '날짜를 누르면 그 날 매출이 보여요'; }
    }

    // 칸 탭 → 선택 갱신 + 상세 (그리드 내부 위임, 다른 캘린더와 DOM 분리)
    if (!gridEl._rvcalBound) {
      gridEl._rvcalBound = true;
      gridEl.addEventListener('click', (e) => {
        const cell = e.target.closest('[data-cal-day]');
        if (!cell || !gridEl.contains(cell)) return;
        if (cell.classList.contains('bk-month-m__cell--other')) return;
        const dateStr = cell.getAttribute('data-cal-day');
        if (!dateStr) return;
        selected = dateStr;
        gridEl.querySelectorAll('.bk-month-m__cell--sel').forEach(c => c.classList.remove('bk-month-m__cell--sel'));
        cell.classList.add('bk-month-m__cell--sel');
        if (detailEl) _renderDetail(detailEl, dateStr, byDay[dateStr] || []);
      });
    }
    // "+ 이 날 매출 입력" — 기존 매출 기록 플로우 재사용 (hub 엔 날짜 필드가 없어 날짜 힌트만 stash;
    //   과거 날짜 prefill 은 hub 에 날짜 필드 추가하는 후속 작업 필요. 오늘 탭 시엔 정확히 동작.)
    if (detailEl && !detailEl._rvcalAddBound) {
      detailEl._rvcalAddBound = true;
      detailEl.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-rvcal-add]');
        if (!btn) return;
        try { window._revenueHubPrefillDate = btn.getAttribute('data-rvcal-add') || ''; } catch (_e) { void _e; }
        if (typeof window.openRevenueHub === 'function') window.openRevenueHub();
      });
    }
  }

  window.RevenueCalendar = { renderInto };
})();
