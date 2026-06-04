/* 사진 편집기 — PE-AI-1A 부위 기반 추천 카드 UI
   "현재 사진에서 잡힌 부위를 바탕으로 추천" 카드만 그린다. (과장 금지)
   적용은 기존 슬라이더와 100% 동일 경로: state.beauty[key]=v → DOM 동기화 → scheduleRedraw → pushHistory.
   - 자동 적용 0: 카드 렌더만으로 state.beauty 를 바꾸지 않는다.
   - 자동 게시/저장/발송/예약/매출 트리거 호출 0.
   - Vision/API/백엔드 호출 0. */
(function () {
  'use strict';
  if (window.PhotoEditorRecoCards) return;

  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function _getState() {
    try {
      const PE = window.PhotoEditor;
      return (PE && PE._internal && PE._internal.getState) ? PE._internal.getState() : null;
    } catch (_e) { return null; }
  }

  // presentRegions + 추천값표 → 카드 목록 산출. (순수 계산, state 변경 없음)
  function _build(state) {
    const RR = window.PhotoEditorRecoRegion;
    const MAP = window.PhotoEditorRecoMap;
    const img = state && state.originalImg;
    if (!RR || !MAP || !img) return { cards: [], pending: false };
    const region = RR.build(img);
    if (!region) return { cards: [], pending: false };

    const cards = [];
    let pending = false;
    Object.keys(MAP.RECO).forEach(rk => {
      const r = region[rk];
      if (!r) return;
      if (r.state === 'pending') { pending = true; return; }  // 미준비 → 숨김(재평가)
      if (!r.present) return;                                  // 없는 부위 → 추천 0
      const weak = r.state === 'weak';
      const items = MAP.RECO[rk].map(def => {
        let v = weak ? Math.round(def.base * 0.6) : def.base;
        if (def.cap != null) v = Math.min(v, def.cap);
        return { key: def.key, label: (MAP.SLIDER_LABEL[def.key] || def.key), value: v };
      }).filter(it => it.value > 0);
      if (!items.length) return;
      cards.push({ regionKey: rk, label: (MAP.REGION_LABEL[rk] || rk), state: weak ? 'weak' : 'strong', items });
    });
    return { cards, pending };
  }

  function _cardHtml(card) {
    const chips = card.items.map(it =>
      `<span class="pe-reco-chip">${_esc(it.label)} <b>${it.value}</b></span>`).join('');
    const tone = card.state === 'strong' ? 'strong' : 'weak';
    const badge = card.state === 'strong' ? '정밀 적용' : '약하게 적용';
    return `<div class="pe-reco-card" data-pe-reco-region="${_esc(card.regionKey)}">
      <div class="pe-reco-head"><strong>${_esc(card.label)}</strong><span class="pe-mask-badge ${tone}">${badge}</span></div>
      <div class="pe-reco-chips">${chips}</div>
      <button type="button" class="pe-btn-primary pe-reco-apply" data-pe-reco-apply="${_esc(card.regionKey)}">적용</button>
    </div>`;
  }

  // 카드 1장 적용 = 묶음 슬라이더를 기존 경로로 set (redraw·history 각 1회).
  function _apply(regionKey, state, helpers, panel) {
    const built = _build(state);
    const card = built.cards.find(c => c.regionKey === regionKey);
    if (!card) return;
    card.items.forEach(it => {
      state.beauty[it.key] = it.value;
      const inp = panel.querySelector(`[data-pe-slider="${it.key}"]`);
      if (inp) inp.value = it.value;
      const out = panel.querySelector(`[data-pe-slider-val="${it.key}"]`);
      if (out) out.textContent = String(it.value);
    });
    if (helpers && typeof helpers.scheduleRedraw === 'function') helpers.scheduleRedraw();
    if (helpers && typeof helpers.pushHistory === 'function') helpers.pushHistory();
    if (helpers && typeof helpers.toast === 'function') helpers.toast(card.label + ' 추천 적용');
  }

  // 이 섹션만 다시 그린다(패널 전체 리렌더 X → 스크롤·포커스 흔들림 없음).
  function _renderInto(panel, state, helpers) {
    const sec = panel && panel.querySelector('[data-pe-reco]');
    if (!sec) return { cards: [], pending: false };
    const grid = sec.querySelector('[data-pe-reco-grid]');
    const built = _build(state);
    if (!built.cards.length) {
      if (grid) grid.innerHTML = '';
      sec.hidden = true;
      return built;
    }
    sec.hidden = false;
    if (grid) {
      grid.innerHTML = built.cards.map(_cardHtml).join('');
      grid.querySelectorAll('[data-pe-reco-apply]').forEach(btn => {
        btn.addEventListener('click', () => _apply(btn.getAttribute('data-pe-reco-apply'), state, helpers, panel));
      });
    }
    return built;
  }

  // 패널 HTML 에 들어가는 셸 (내용은 bind 에서 채움 → 단일 렌더 경로).
  function html(/* state */) {
    return `<section class="pe-reco" data-pe-reco hidden>
      <div class="pe-field-label">부위 기반 추천</div>
      <div class="pe-hint">현재 사진에서 잡힌 부위를 바탕으로 추천했어요. 적용하면 아래 슬라이더가 같이 움직여요.</div>
      <div class="pe-panel-row" style="margin:8px 0;"><button type="button" class="pe-chip-btn" data-pe-reco-refresh>추천 새로고침</button></div>
      <div class="pe-reco-grid" data-pe-reco-grid></div>
    </section>`;
  }

  function bind(panel, state, helpers) {
    const sec = panel && panel.querySelector('[data-pe-reco]');
    if (!sec) return;
    const refreshBtn = sec.querySelector('[data-pe-reco-refresh]');
    if (refreshBtn) refreshBtn.addEventListener('click', () => _renderInto(panel, state, helpers));

    const built = _renderInto(panel, state, helpers);
    // 미준비 마스크가 있으면 짧게 최대 2회 재평가(이 섹션만 갱신 → 깜빡임/점프 없음).
    if (built && built.pending) {
      let tries = 0;
      const tick = () => {
        if (++tries > 2) return;
        if (!document.body.contains(sec)) return;   // 패널 떠남 → 중단
        const b2 = _renderInto(panel, state, helpers);
        if (b2 && b2.pending) setTimeout(tick, 900);
      };
      setTimeout(tick, 700);
    }
  }

  // (테스트용) 카드 산출 노출 — state 미전달 시 현재 편집기 state 사용.
  function compute(state) { return _build(state || _getState()); }

  window.PhotoEditorRecoCards = { html, bind, compute };
})();
