/* 사진 편집기 — 부위 기반 추천 카드 UI
   PE-AI-1A: 온디바이스 마스크 기반 "기본 추천" (Vision 호출 0).
   PE-AI-1B: "AI 정밀 추천" 버튼 → 동의 → 백엔드 /photo-editor/ai/analyze(Vision) 결과를
             presentRegions 와 교차검증해 카드 갱신.
   공통 규칙:
   - 적용은 기존 슬라이더와 동일 경로: state.beauty[key]=v → DOM 동기화 → scheduleRedraw → pushHistory.
   - Vision 결과 도착만으로 state.beauty 변경 0. [적용] 클릭 시에만 반영.
   - 자동 게시/저장/발송/예약/매출 트리거 0. Vision 직접 호출 0(백엔드 경유). */
(function () {
  'use strict';
  if (window.PhotoEditorRecoCards) return;

  // reco region key → Vision detected_regions 어휘
  var VOCAB = { skin: 'skin', eye: 'eyes', brow: 'brows', lash: 'lashes', sclera: 'eyes', lip: 'lips', nail: 'nails', hair: 'hair', hand: 'hands' };

  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]);
    });
  }

  function _getState() {
    try {
      var PE = window.PhotoEditor;
      return (PE && PE._internal && PE._internal.getState) ? PE._internal.getState() : null;
    } catch (_e) { return null; }
  }

  function _toast(msg) { if (window.showToast) window.showToast(msg); }

  // ── AI-1A: 온디바이스 마스크 기반 (Vision 없음) ──
  function _buildAI1A(state) {
    var RR = window.PhotoEditorRecoRegion, MAP = window.PhotoEditorRecoMap;
    var img = state && state.originalImg;
    if (!RR || !MAP || !img) return { cards: [], pending: false, vision: false };
    var region = RR.build(img);
    if (!region) return { cards: [], pending: false, vision: false };
    var cards = [], pending = false;
    Object.keys(MAP.RECO).forEach(function (rk) {
      var r = region[rk];
      if (!r) return;
      if (r.state === 'pending') { pending = true; return; }
      if (!r.present) return;
      var weak = r.state === 'weak';
      var items = MAP.RECO[rk].map(function (def) {
        var v = weak ? Math.round(def.base * 0.6) : def.base;
        if (def.cap != null) v = Math.min(v, def.cap);
        return { key: def.key, label: (MAP.SLIDER_LABEL[def.key] || def.key), value: v };
      }).filter(function (it) { return it.value > 0; });
      if (!items.length) return;
      cards.push({
        regionKey: rk, label: (MAP.REGION_LABEL[rk] || rk), items: items,
        badgeText: weak ? '약하게 적용' : '정밀 적용', badgeTone: weak ? 'weak' : 'strong',
      });
    });
    return { cards: cards, pending: pending, vision: false };
  }

  // ── 프론트 2차 검증: 값 범위/상한 (서버 1차에 더해) ──
  function _validVal(key, val) {
    var v = Math.round(Number(val) || 0);
    if (key === 'hairColor') v = Math.max(-50, Math.min(50, v));
    else v = Math.max(0, Math.min(100, v));
    if (key === 'handSkin') v = Math.min(v, 10);       // 상한 10
    if (key === 'hairVolume') v = Math.min(v, 12);     // 상한 12 (형태변형 금지)
    if (key === 'closeUpDetail') v = Math.min(v, 15);
    return v;
  }

  // Vision 추천을 reco region 별로 묶음 + 27키(RECO) 화이트리스트 통과만.
  //   RECO 에 없는 key(예: closeUpDetail)는 폐기 → FE 미노출(보수).
  function _visionItemsByRegion(MAP, vision) {
    var idx = {};
    Object.keys(MAP.RECO).forEach(function (rk) {
      MAP.RECO[rk].forEach(function (def) { idx[def.key] = rk; });
    });
    var out = {};
    (vision.recommended_adjustments || []).forEach(function (a) {
      if (!a || typeof a !== 'object') return;
      var rk = idx[a.key];
      if (!rk) return;                       // 화이트리스트 밖 폐기
      var v = _validVal(a.key, a.value);
      if (a.key === 'hairColor') { if (v === 0) return; } else if (v <= 0) return;
      (out[rk] = out[rk] || {})[a.key] = v;
    });
    return out;
  }

  // ── AI-1B: Vision × presentRegions 교차검증 ──
  function _buildMerged(state) {
    var RR = window.PhotoEditorRecoRegion, MAP = window.PhotoEditorRecoMap;
    var img = state && state.originalImg;
    if (!RR || !MAP || !img) return { cards: [], pending: false, vision: false };
    var vision = state.__visionReco;
    if (!vision) return _buildAI1A(state);
    var region = RR.build(img);
    if (!region) return { cards: [], pending: false, vision: true };
    var vItems = _visionItemsByRegion(MAP, vision);
    var rconf = vision.region_confidence || {};
    var cards = [];
    Object.keys(MAP.RECO).forEach(function (rk) {
      var r = region[rk] || { state: 'absent', present: false };
      var maskPresent = (r.state === 'strong' || r.state === 'weak');
      var vconf = Number(rconf[VOCAB[rk]] || 0);
      var vHigh = vconf >= 0.7, vMid = vconf >= 0.4 && vconf < 0.7;
      var vKeys = vItems[rk] || {};
      var hasV = Object.keys(vKeys).length > 0;
      var badgeText, tone, useVision;
      if (maskPresent && (vHigh || vMid)) { badgeText = '정밀 추천'; tone = 'strong'; useVision = true; }
      else if (maskPresent) { badgeText = '기본 추천'; tone = 'fallback'; useVision = false; }   // 마스크 우선
      else if (!maskPresent && vHigh && hasV) { badgeText = '검증 필요'; tone = 'weak'; useVision = true; }
      else return;                                                                                // 둘 다 약함 → 제외
      var items;
      if (useVision && hasV) {
        items = Object.keys(vKeys).map(function (k) { return { key: k, label: (MAP.SLIDER_LABEL[k] || k), value: vKeys[k] }; });
      } else {
        var weak = r.state === 'weak';
        items = MAP.RECO[rk].map(function (def) {
          var v = weak ? Math.round(def.base * 0.6) : def.base;
          if (def.cap != null) v = Math.min(v, def.cap);
          return { key: def.key, label: (MAP.SLIDER_LABEL[def.key] || def.key), value: v };
        }).filter(function (it) { return it.value > 0; });
      }
      items = items.filter(function (it) { return it.value > 0 || it.key === 'hairColor'; });
      if (!items.length) return;
      cards.push({ regionKey: rk, label: (MAP.REGION_LABEL[rk] || rk), items: items, badgeText: badgeText, badgeTone: tone });
    });
    return { cards: cards, pending: false, vision: true };
  }

  function _cardHtml(card) {
    var chips = card.items.map(function (it) {
      return '<span class="pe-reco-chip">' + _esc(it.label) + ' <b>' + it.value + '</b></span>';
    }).join('');
    return '<div class="pe-reco-card" data-pe-reco-region="' + _esc(card.regionKey) + '">' +
      '<div class="pe-reco-head"><strong>' + _esc(card.label) + '</strong>' +
      '<span class="pe-mask-badge ' + _esc(card.badgeTone) + '">' + _esc(card.badgeText) + '</span></div>' +
      '<div class="pe-reco-chips">' + chips + '</div>' +
      '<button type="button" class="pe-btn-primary pe-reco-apply" data-pe-reco-apply="' + _esc(card.regionKey) + '">적용</button>' +
      '</div>';
  }

  // 카드 1장 적용 = 묶음 슬라이더를 기존 경로로 set (redraw·history 각 1회).
  function _apply(regionKey, state, helpers, panel) {
    var built = _buildMerged(state);
    var card = null;
    for (var i = 0; i < built.cards.length; i++) { if (built.cards[i].regionKey === regionKey) { card = built.cards[i]; break; } }
    if (!card) return;
    card.items.forEach(function (it) {
      state.beauty[it.key] = it.value;
      var inp = panel.querySelector('[data-pe-slider="' + it.key + '"]');
      if (inp) inp.value = it.value;
      var out = panel.querySelector('[data-pe-slider-val="' + it.key + '"]');
      if (out) out.textContent = String(it.value);
    });
    if (helpers && typeof helpers.scheduleRedraw === 'function') helpers.scheduleRedraw();
    if (helpers && typeof helpers.pushHistory === 'function') helpers.pushHistory();
    if (helpers && typeof helpers.toast === 'function') helpers.toast(card.label + ' 추천 적용');
  }

  function _renderInto(panel, state, helpers) {
    var sec = panel && panel.querySelector('[data-pe-reco]');
    if (!sec) return { cards: [], pending: false };
    var grid = sec.querySelector('[data-pe-reco-grid]');
    var img = state && state.originalImg;
    if (!img) { if (grid) grid.innerHTML = ''; sec.hidden = true; return { cards: [], pending: false }; }
    sec.hidden = false;   // 사진 있으면 섹션 노출(정밀 추천 버튼 접근용)
    var built = _buildMerged(state);
    if (grid) {
      grid.innerHTML = built.cards.length ? built.cards.map(_cardHtml).join('') : '';
      grid.querySelectorAll('[data-pe-reco-apply]').forEach(function (btn) {
        btn.addEventListener('click', function () { _apply(btn.getAttribute('data-pe-reco-apply'), state, helpers, panel); });
      });
    }
    return built;
  }

  function html() {
    return '<section class="pe-reco" data-pe-reco hidden>' +
      '<div class="pe-field-label">부위 기반 추천</div>' +
      '<div class="pe-hint">현재 사진에서 잡힌 부위를 바탕으로 추천했어요. 적용하면 아래 슬라이더가 같이 움직여요.</div>' +
      '<div class="pe-panel-row" style="margin:8px 0;display:flex;gap:6px;flex-wrap:wrap;">' +
        '<button type="button" class="pe-chip-btn" data-pe-reco-refresh>추천 새로고침</button>' +
        '<button type="button" class="pe-reco-precise-btn" data-pe-reco-precise>AI 정밀 추천</button>' +
      '</div>' +
      '<div class="pe-reco-loading" data-pe-reco-loading hidden>AI가 사진을 분석 중…</div>' +
      '<div class="pe-reco-grid" data-pe-reco-grid></div>' +
    '</section>';
  }

  function _setLoading(panel, on) {
    var el = panel && panel.querySelector('[data-pe-reco-loading]');
    if (el) el.hidden = !on;
    var btn = panel && panel.querySelector('[data-pe-reco-precise]');
    if (btn) btn.disabled = !!on;
  }

  function _normalizeVision(raw) {
    raw = raw || {};
    return {
      photo_type: raw.photo_type || 'general',
      detected_regions: Array.isArray(raw.detected_regions) ? raw.detected_regions : [],
      region_confidence: (raw.region_confidence && typeof raw.region_confidence === 'object') ? raw.region_confidence : {},
      recommended_adjustments: Array.isArray(raw.recommended_adjustments) ? raw.recommended_adjustments : [],
      cached: !!raw.cached,
    };
  }

  // 백엔드 Vision 호출 → 성공 시 카드 갱신. 실패/거부 → AI-1A 유지.
  function _runVision(panel, state, helpers) {
    var VC = window.PhotoEditorVisionClient;
    if (!VC) { _toast('정밀 추천 모듈을 불러오지 못했어요'); return; }
    _setLoading(panel, true);
    VC.analyze(state).then(function (r) {
      _setLoading(panel, false);
      if (r && r.ok) {
        state.__visionReco = _normalizeVision(r.data);   // 표시 데이터만 — state.beauty 불변
        _renderInto(panel, state, helpers);
        _toast(r.data && r.data.cached ? '이전 분석 결과를 불러왔어요' : 'AI 정밀 추천을 반영했어요');
      } else {
        _handleVisionError(r || {}, panel, state, helpers);
      }
    }).catch(function () {
      _setLoading(panel, false);
      _handleVisionError({ code: 'network' }, panel, state, helpers);
    });
  }

  function _handleVisionError(r, panel, state, helpers) {
    // 어떤 실패든 AI-1A 카드 유지(state.__visionReco 안 건드림). 정직 문구.
    if (r.code === 'consent_required') { _startConsent(panel, state, helpers); return; }
    var msg = ({
      pro_required: 'AI 정밀 추천은 Pro 기능이에요. 기본 추천은 그대로 쓸 수 있어요.',
      quota: '오늘 정밀 추천 한도를 다 썼어요. 기본 추천으로 보여드려요.',
      timeout: '정밀 분석이 지연돼 기본 추천으로 보여드려요.',
      vision_failed: '정밀 분석에 실패해 기본 추천으로 보여드려요.',
      auth: '로그인이 필요해요.',
      no_image: '먼저 사진을 열어주세요.',
      network: '네트워크 문제로 기본 추천으로 보여드려요.',
    })[r.code] || '정밀 분석을 못 했어요. 기본 추천으로 보여드려요.';
    _toast(msg);
  }

  function _startConsent(panel, state, helpers) {
    var RC = window.PhotoEditorRecoConsent;
    if (!RC || typeof RC.showModal !== 'function') { _toast('동의 모듈을 불러오지 못했어요'); return; }
    RC.showModal(function () { _runVision(panel, state, helpers); },
      function () { _toast('기본 추천으로 보여드릴게요'); });   // 거부 → AI-1A 유지
  }

  function _onPrecise(panel, state, helpers) {
    if (!(state && state.originalImg)) { _toast('먼저 사진을 열어주세요.'); return; }
    var RC = window.PhotoEditorRecoConsent;
    // UI 캐시 동의 있으면 바로 호출(서버가 최종 권위 — 403 consent_required 면 모달 재노출).
    if (RC && typeof RC.uiCached === 'function' && RC.uiCached()) _runVision(panel, state, helpers);
    else _startConsent(panel, state, helpers);
  }

  function bind(panel, state, helpers) {
    var sec = panel && panel.querySelector('[data-pe-reco]');
    if (!sec) return;
    var refreshBtn = sec.querySelector('[data-pe-reco-refresh]');
    if (refreshBtn) refreshBtn.addEventListener('click', function () { _renderInto(panel, state, helpers); });
    var preciseBtn = sec.querySelector('[data-pe-reco-precise]');
    if (preciseBtn) preciseBtn.addEventListener('click', function () { _onPrecise(panel, state, helpers); });

    var built = _renderInto(panel, state, helpers);
    if (built && built.pending) {
      var tries = 0;
      var tick = function () {
        if (++tries > 2) return;
        if (!document.body.contains(sec)) return;
        var b2 = _renderInto(panel, state, helpers);
        if (b2 && b2.pending) setTimeout(tick, 900);
      };
      setTimeout(tick, 700);
    }
  }

  // (테스트/외부) AI-1A 산출 — 기존 reco-region-qa 호환.
  function compute(state) { return _buildAI1A(state || _getState()); }
  // (테스트) Vision 병합 산출 — state.__visionReco 기반.
  function computeMerged(state) { return _buildMerged(state || _getState()); }
  function setVisionResult(state, raw) { (state || _getState()).__visionReco = _normalizeVision(raw); }
  function clearVision(state) { var s = state || _getState(); if (s) s.__visionReco = null; }

  window.PhotoEditorRecoCards = {
    html: html, bind: bind, compute: compute,
    computeMerged: computeMerged, setVisionResult: setVisionResult, clearVision: clearVision,
    _normalizeVision: _normalizeVision,
  };
})();
