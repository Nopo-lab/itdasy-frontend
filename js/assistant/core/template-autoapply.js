/* 잇비 템플릿 자동 적용 — I3a 후기 카드 + I3b 전후(BA) 카드 (2026-06-08)

   목표: "후기 카드 만들어줘" / "전후 카드 만들어줘" 류 요청을 받으면 실제 사진편집기 상태에
        v3 템플릿(review / before_after)을 적용하고 slotValues 를 채워(문구 편집 시트까지 열어)
        사용자가 문구 편집/저장/인스타 미리보기로 이어가게 한다. (I2b/I2c 가격표 흐름 미러)

   원칙(엄수):
   - 오프스크린 renderHook 합성 안 함. 실제 편집기 캔버스가 단일 진실원.
   - PhotoEditorTemplatesV2.apply() 시그니처 변경 안 함 → apply 후 state.tplV2 patch.
   - premium-templates / ba-compose / edit-sheet / S4 / onSave / IndexedDB 미수정(호출만).
   - dataURL 은 편집기 state/imageSlots 범위에서만. 채팅 history 에 큰 dataURL 미저장.
   - 자동 저장/업로드/게시 0. 실패해도 throw 0(null 반환).
*/
(function () {
  'use strict';
  if (window.ItdasyTemplateAutoApply) return;

  var REVIEW_TPL_ID = 'v3-review-card';
  var BA_TPL_DEFAULT = 'v3-ba-clean-rose';

  var MSG_SIG = /(문자|dm|디엠|메시지|카톡|발송|보내)/i;
  var REVIEW_TRIGGER = /(후기|리뷰|review)/i;
  var BA_TRIGGER = /(전후|비포\s*애프터|before\s*&?\s*after|b\s*&\s*a|시술\s*전후)/i;
  var CREATE = /(카드|만들|제작|뽑|생성|해\s*줘|해줘|넣어|게시물)/;

  function detectReviewCard(text) {
    var t = String(text || '').trim();
    if (!t || MSG_SIG.test(t)) return false;
    return REVIEW_TRIGGER.test(t) && (CREATE.test(t) || /비교/.test(t));
  }
  function detectBeforeAfterCard(text) {
    var t = String(text || '').trim();
    if (!t || MSG_SIG.test(t)) return false;
    if (BA_TRIGGER.test(t) && (CREATE.test(t) || /비교/.test(t))) return true;
    if (/비교/.test(t) && /(사진|시술)/.test(t) && CREATE.test(t)) return true;
    return false;
  }

  // 텍스트에서 시술명 추정(규칙 기반). 없으면 ''.
  function _serviceName(t) {
    t = String(t || '');
    if (/(네일|손톱|젤네일|패디|발톱)/.test(t)) return '네일';
    if (/(헤어|머리|모발|펌|염색|컬러|붙임머리)/.test(t)) return '헤어';
    if (/(속눈썹|래쉬|연장)/.test(t)) return '속눈썹';
    if (/(피부|잡티|모공|결|톤|관리|에스테틱)/.test(t)) return '피부관리';
    if (/(눈썹|반영구)/.test(t)) return '눈썹';
    if (/(메이크업|화장|글램)/.test(t)) return '메이크업';
    if (/(왁싱|제모)/.test(t)) return '왁싱';
    return '';
  }

  function _today() {
    try {
      var d = new Date();
      var p = function (n) { return (n < 10 ? '0' : '') + n; };
      return d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate());
    } catch (_e) { return ''; }
  }

  // 사용자가 따옴표로 후기를 직접 준 경우만 추출(자연어 고도화는 I3d). 없으면 ''.
  function _extractReview(t) {
    var m = String(t || '').match(/["“'`']([^"”'`']{4,120})["”'`']/);
    return (m && m[1]) ? m[1].trim() : '';
  }

  // 사진이 없을 때만 쓰는 단색 베이스(편집기 캔버스가 보이게 — review 렌더가 bg 를 덮음).
  //   오프스크린 "합성"이 아니라 빈 베이스 1장일 뿐. history 미저장.
  function _solidBase() {
    try {
      var c = document.createElement('canvas');
      c.width = 1080; c.height = 1350;
      var g = c.getContext('2d');
      g.fillStyle = '#FBEFEF'; g.fillRect(0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.85);
    } catch (_e) { return ''; }
  }

  // [P0-B/P0-C] 잇비 자동적용 결과를 "저장" 시 마무리 갤러리 + 작업실 슬롯 둘 다에 baked 이미지로 남긴다.
  //   실제 저장은 window.saveAssistantTemplateResult 어댑터(gallery + slot)에 위임. DB 함수/스키마 미수정.
  //   rid = 열림당 1회 → gallery dedupeKey / slot id 동일 키로 묶여 재저장은 갱신, 새 요청만 새 항목.
  function _templateOnSave(meta) {
    var m = meta || {};
    var rid;
    try { rid = Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36); }
    catch (_e) { rid = 'r' + Date.now(); }
    return function (dataUrl) {
      try {
        if (!dataUrl) return;
        // [P2-2a] 저장 직전 state(tplV2)에서 재편집용 메타 캡처.
        // [2026-07-22] 옛 편집기 _internal.getState() → headless 활성 state.
        var _meta = null;
        try {
          if (typeof window.buildAssistantTemplateMeta === 'function') _meta = window.buildAssistantTemplateMeta(_activeState, m.purpose || '');
        } catch (_me) { _meta = null; }
        // [2026-06-11 B7] 저장 결과 확인 후 토스트 — 실패했는데 "저장했어요" 금지
        if (typeof window.saveAssistantTemplateResult === 'function') {
          Promise.resolve(window.saveAssistantTemplateResult(dataUrl, { purpose: m.purpose || '', label: m.label || '잇비 카드', rid: rid, templateMeta: _meta }))
            .then(function (saved) {
              var ok = saved && (saved.slot || saved.gallery);
              if (window.showToast) window.showToast(ok ? '작업실에 저장했어요. "저장한 카드 보여줘"라고 하면 바로 열어드려요' : '저장에 실패했어요 — 다시 시도해 주세요');
            })
            .catch(function () { if (window.showToast) window.showToast('저장에 실패했어요 — 다시 시도해 주세요'); });
        } else if (typeof window.saveToGallery === 'function') {   // 어댑터 미로드 폴백(갤러리만)
          window.saveToGallery({ id: 'asst_' + rid, label: m.label || '잇비 카드', photos: [{ id: 'p_' + rid, dataUrl: dataUrl, mode: 'after' }], caption: '', hashtags: '', source: 'assistant_template', dedupeKey: 'asst_tpl:' + (m.purpose || '') + ':' + rid });
          try { if (window.showToast) window.showToast('작업실에 저장했어요.'); } catch (_t) { void _t; }
        }
      } catch (e) { try { console.warn('[autoapply] save failed', e && e.message); } catch (_l) { void _l; } }
    };
  }

  // ── 카드 합성(headless) ────────────────────────────────
  // [2026-07-22] 옛 PhotoEditor 캔버스 없이 PremiumTemplates.renderHook 로 직접 합성.
  //   renderHook 은 갤러리 프리뷰가 쓰는 것과 같은 렌더러라 '적용 결과와 동일한 그림'이 나온다.
  var CARD_W = 1080, CARD_H = 1350;
  var _lastSecondImg = null;   // 직전 전후 카드의 before 이미지(새 before 없을 때 보존)
  var _activeState = null;     // 현재 편집 중인 headless 템플릿 state(저장 메타 캡처용)

  function _loadImg(url, cb) {
    if (!url) { cb(null); return; }
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () { cb(img); };
    img.onerror = function () { cb(null); };
    img.src = url;
  }

  function _composeCard(state, cb) {
    var PT = window.PhotoEditorPremiumTemplates;
    var slot = state && state.tplV2 && state.tplV2.imageSlots && state.tplV2.imageSlots.main_photo;
    var src = (slot && slot.src) || '';
    var cv = document.createElement('canvas');
    cv.width = CARD_W; cv.height = CARD_H;
    var ctx = cv.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, CARD_W, CARD_H);

    // renderHook 은 '현재 사진 + 템플릿' 계약 — 캔버스에 사진을 먼저 그린 뒤 템플릿을 덧씌운다.
    //   (옛 흐름에선 PE 캔버스가 사진을 들고 있었다. 안 그리면 전후 카드 AFTER 칸이 빈 채로 나옴)
    var _cover = function (img) {
      if (!img || !img.width || !img.height) return;
      var s = Math.max(CARD_W / img.width, CARD_H / img.height);
      var w = img.width * s, h = img.height * s;
      try { ctx.drawImage(img, (CARD_W - w) / 2, (CARD_H - h) / 2, w, h); } catch (_e) { void _e; }
    };

    var finish = function () {
      try { PT.renderHook(ctx, CARD_W, CARD_H, state); } catch (_e) { void _e; }
      var url = '';
      try { url = cv.toDataURL('image/jpeg', 0.92); } catch (_e) { url = ''; }
      cb(url || src);
    };

    // 전후 카드용 before 사진(secondImg)은 합성 '전에' 반드시 들어가 있어야 한다.
    //   (옛 흐름은 합성 후 주입이라 headless 로 옮기면 before 가 빠진 채 그려짐)
    var needBefore = !state.secondImg && state._beforeUrl;
    _loadImg(src, function (mainImg) {
      if (mainImg) {
        try { if (PT && PT.primeImage) PT.primeImage(src, mainImg); } catch (_e) { void _e; }
        _cover(mainImg);          // ← 베이스 사진(=after) 먼저
        state.img = mainImg;      // 일부 렌더러가 state.img 를 베이스로 참조
      }
      if (!needBefore) { finish(); return; }
      _loadImg(state._beforeUrl, function (bImg) {
        if (bImg) { state.secondImg = bImg; _lastSecondImg = bImg; }   // ba-compose 의 _beforeCanvas 가 읽음
        finish();
      });
    });
  }

  // 합성본을 작업실에 저장(onSave) + 현재 작업실 편집기로 이어가기
  function _composeAndHandOff(state, onSave) {
    return new Promise(function (resolve) {
      _composeCard(state, function (url) {
        try { if (typeof onSave === 'function') onSave(url); } catch (_e) { void _e; }
        try {
          if (url && window.WorkspaceFlow && typeof window.WorkspaceFlow.command === 'function') {
            window.WorkspaceFlow.command({ type: 'storyedit', photoUrls: [url] });
          }
        } catch (_e) { void _e; }
        resolve(url);
      });
    });
  }

  // ── 공용: headless 상태 구성 → 카드 합성/미리보기 → 문구 편집 시트 ──
  // [2026-07-22] 옛 PhotoEditor(PE.open + TV.apply + _internal.getState) 경로 폐지.
  //   결과 카드 UX(채팅 카드 + 문구 편집 시트)는 그대로 두고 엔진만 교체했다.
  function _runAutoApply(tplId, afterUrl, buildSlots, patchState, editTemplateData, onSave, beforeUrl) {
    var PT = window.PhotoEditorPremiumTemplates;
    if (!PT || typeof PT.renderHook !== 'function') return null;

    var state = {
      tplV2: {
        id: tplId,
        slotValues: {},
        imageSlots: { main_photo: { src: afterUrl } },
      },
      _beforeUrl: beforeUrl || '',   // 전후 카드 before 사진(합성 전 secondImg 로 주입)
      // 시트가 '작업실에 저장' 라벨/동작을 켜는 조건(_isEmbedded)
      onSave: (typeof onSave === 'function') ? onSave : null,
    };
    state.tplV2.slotValues = buildSlots({});
    if (typeof patchState === 'function') { try { patchState(state); } catch (_e) { void _e; } }
    _activeState = state;   // 저장 시 재편집 메타 캡처용

    // ⚠️ 작업실 편집기를 여기서 같이 열면 안 된다 — 편집기가 오버레이를 정리하면서
    //    문구 편집 시트 DOM 을 날려버려 시트가 '열린 상태'로 유령이 된다(실측).
    //    그래서 시트 먼저 → 저장/적용 시점에 합성본을 편집기로 넘긴다.

    // 문구 편집 시트 — 옛 편집기 헬퍼 대신 headless 스텁. 저장 시 재합성 후 넘긴다.
    var helpers = {
      scheduleRedraw: function () {},
      renderPanel: function () {},
      pushHistory: function () {},
      applyStatePatch: function () {},
      save: function () { return _composeAndHandOff(state, onSave); },
    };
    try {
      var ES = window.PhotoEditorTemplateEditSheet;
      if (ES && typeof ES.open === 'function') {
        ES.open({ templateId: tplId, templateData: editTemplateData || null, state: state, helpers: helpers, onChange: function () {} });
      }
    } catch (_e) { void _e; }

    return state;
  }

  // ── I3a 후기 카드 ──────────────────────────────────────
  function buildReviewSlotValues(base, ctx, text) {
    var next = Object.assign({}, base || {});
    var cust = ctx && ctx.currentCustomer;
    next.headline = '고객님의 진심 후기';
    next.subtitle = '시술 후 남겨주신 소중한 후기';
    next.review_text = _extractReview(text)
      || '믿고 맡겼는데 결과가 너무 마음에 들어요. 디테일까지 꼼꼼하게 봐주셔서 다음에도 꼭 다시 올게요!';
    next.customer_label = (cust && cust.name) ? (cust.name + '님') : '고객님';
    next.cta = '예약 문의 주세요';
    next.service_name = _serviceName(text) || next.service_name || '';
    next.date = _today() || next.date || '';
    return next;
  }

  function handleReviewCard(text, ctx) {
    var SI = window.ItdasySourceImage;
    var src = (SI && typeof SI.resolve === 'function') ? SI.resolve() : null;
    var photoUrl = (src && src.dataUrl) ? src.dataUrl : '';
    var hadPhoto = !!photoUrl;
    if (!photoUrl) photoUrl = _solidBase();
    if (!photoUrl) return null;

    var state = _runAutoApply(
      REVIEW_TPL_ID, photoUrl,
      function (base) { return buildReviewSlotValues(base, ctx, text); },
      function (st) { if (hadPhoto && st.tplV2.imageSlots && st.tplV2.imageSlots.main_photo) st.tplV2.imageSlots.main_photo.src = photoUrl; },
      _reviewTplData(),
      _templateOnSave({ purpose: 'review', label: '후기 카드' })   // [P0-B]
    );
    if (!state) return null;

    var sv = state.tplV2.slotValues || {};
    return {
      templateId: REVIEW_TPL_ID,
      templateLabel: '후기 인용 카드',
      reviewExcerpt: String(sv.review_text || '').slice(0, 40),
      customerLabel: sv.customer_label || '고객님',
      hadPhoto: hadPhoto,
    };
  }

  // ── I3b 전후(BA) 카드 ──────────────────────────────────
  function _pickBaTemplate(text) {
    var t = String(text || '');
    if (/(네일|손톱|젤네일|패디|발톱)/.test(t)) return 'v3-ba-sns-pink';
    if (/(블루|클린|병원|피부과|차분|진정)/.test(t)) return 'v3-ba-clean-blue';
    return BA_TPL_DEFAULT;   // skin/피부/관리/에스테틱/기본
  }
  function _baLabel(tplId) {
    return ({
      'v3-ba-clean-rose': '시술 전후 · 클린 로즈',
      'v3-ba-clean-blue': '시술 전후 · 클린 블루',
      'v3-ba-sns-pink': '시술 전후 · 파스텔 핑크',
      'bp-ba-nail-polaroid': '시술 전후 · 네일 폴라로이드',
    })[tplId] || '시술 전후 카드';
  }

  function buildBASlotValues(base, ctx, text) {
    var next = Object.assign({}, base || {});
    var svc = _serviceName(text);
    next.headline = svc ? (svc + ' 전후 변화') : '시술 전후 변화';
    next.subtitle = '한눈에 보는 또렷한 차이';
    next.before_label = 'BEFORE';
    next.after_label = 'AFTER';
    next.before_caption = '';   // 기본 샘플 캡션 제거(사용자 편집)
    next.after_caption = '';
    next.cta = '예약 문의 주세요';
    return next;
  }

  // [2026-07-22] _loadBeforeIntoState 제거 — 옛 편집기 state 에 before 를 사후 주입하던 헬퍼.
  //   headless 합성에서는 _composeCard 가 렌더 '전에' state.secondImg 를 채운다(_beforeUrl).

  // before/after 사진 해석 — opts.photos(≥2:전/후, 1:후) → SI.resolve → 없으면 needsPhoto.
  //   handleBeforeAfterCard 와 applySample 이 공유(중복 제거).
  function _resolveBaPhotos(opts) {
    opts = opts || {};
    var SI = window.ItdasySourceImage;
    var photos = (opts.photos && opts.photos.length) ? opts.photos.filter(Boolean) : [];

    var afterUrl = '', beforeUrl = '';
    if (photos.length >= 2) { beforeUrl = photos[0]; afterUrl = photos[1]; }   // 첫=전, 둘=후
    else if (photos.length === 1) { afterUrl = photos[0]; }
    else {
      var src = (SI && typeof SI.resolve === 'function') ? SI.resolve() : null;
      if (src && src.dataUrl) afterUrl = src.dataUrl;
    }
    if (!afterUrl) return { needsPhoto: true };

    // 기존 secondImg(before) — 새 before 가 없을 때 직전 것 보존.
    // [2026-07-22] 옛 편집기 state 를 훔쳐보던 방식 → 직전 합성에서 캐시한 이미지 사용.
    var prevSecond = _lastSecondImg || null;

    return { afterUrl: afterUrl, beforeUrl: beforeUrl, prevSecond: prevSecond, needsPhoto: false };
  }

  // cat:'ba' 템플릿 데이터(edit-sheet before/after 슬롯). 없으면 null.
  function _baTplData(tplId) {
    try {
      var MD = window.PhotoEditorTemplateMarketData;
      return (MD && typeof MD.lookupById === 'function') ? MD.lookupById(tplId) : null;
    } catch (_e) { return null; }
  }
  // v3-review-card 템플릿 데이터. 없으면 null.
  function _reviewTplData() {
    try { return (window.PhotoEditorTemplatesV2.TEMPLATES || []).find(function (t) { return t && t.id === REVIEW_TPL_ID; }) || null; } catch (_e) { return null; }
  }
  // 임의 id 의 템플릿 데이터(market-data lookupById 우선 → V2 폴백). bp-* 포함.
  function _tplDataById(id) {
    try {
      var MD = window.PhotoEditorTemplateMarketData;
      var v = (MD && typeof MD.lookupById === 'function' && MD.lookupById(id)) || null;
      if (v) return v;
      return (window.PhotoEditorTemplatesV2.TEMPLATES || []).find(function (t) { return t && t.id === id; }) || null;
    } catch (_e) { return null; }
  }
  // [P0-A] 등록 여부 확인(미등록 bp 로 apply 하면 렌더 실패 → fallback 유지용).
  function _tplExists(id) { return !!_tplDataById(id); }
  // [P0-A] 업종이 맞고 등록된 beautyPack 만 기본으로 승격. 불확실하면 v3 fallback.
  function _bpUpgrade(purpose, industry, fallbackId) {
    var bp = (purpose === 'review' && industry === 'lash') ? 'bp-review-lash-blue'
      : (purpose === 'before_after' && industry === 'nail') ? 'bp-ba-nail-polaroid'
        : '';
    return (bp && _tplExists(bp)) ? bp : fallbackId;
  }

  // [기본] 우선순위: ①문장 명시(미지원·향후 훅) → ②purpose별 사용자 지정 기본 → ③matcher+bp 승격 → ④시스템 fallback.
  //   기본 id 가 미등록이거나 purpose 불일치면 무시하고 기존 _bpUpgrade 흐름. 보관함/최근은 반영 안 함(자동적용 예측가능성).
  function _resolveTemplateId(purpose, industry, fallbackId) {
    try {
      var LIB = window.PhotoEditorTemplateLibrary;
      var def = (LIB && typeof LIB.getDefault === 'function') ? LIB.getDefault(purpose) : '';
      if (def) {
        var data = _tplDataById(def);
        if (data && data.purpose === purpose) return def;   // 존재 + purpose 일치만
      }
    } catch (_e) { void 0; }
    return _bpUpgrade(purpose, industry, fallbackId);
  }

  function handleBeforeAfterCard(text, ctx, opts) {
    var ph = _resolveBaPhotos(opts);
    if (ph.needsPhoto) return { needsPhoto: true };

    var tplId = _pickBaTemplate(text);
    var state = _runAutoApply(
      tplId, ph.afterUrl,
      function (base) { return buildBASlotValues(base, ctx, text); },
      function (st) { if (!ph.beforeUrl && ph.prevSecond) st.secondImg = ph.prevSecond; },   // after_photo.src ''=현재 캔버스(=open 한 after)
      _baTplData(tplId),
      _templateOnSave({ purpose: 'before_after', label: _baLabel(tplId) }),   // [P0-B]
      ph.beforeUrl   // [2026-07-22] 합성 전에 secondImg 로 주입(옛 _loadBeforeIntoState 대체)
    );
    if (!state) return null;

    var sv = state.tplV2.slotValues || {};
    return {
      templateId: tplId,
      templateLabel: _baLabel(tplId),
      headline: sv.headline || '시술 전후',
      hasBefore: !!ph.beforeUrl || !!ph.prevSecond,
      hasAfter: true,
    };
  }

  // ── M2: 매처 샘플 자동 적용 ─────────────────────────────
  //   review / before_after 만 처리. price 는 app-assistant 의 기존 가격표 흐름이 소유 → null 반환.
  //   payload.slotValues 는 matcher.toAutoApplyPayload 가 이미 (샘플+override) 병합 + sanitize 한 값.
  //   기존 _runAutoApply / _resolveBaPhotos / _loadBeforeIntoState 를 그대로 재사용(새 파이프라인 0).
  function _applySampleReview(payload, slots) {
    var SI = window.ItdasySourceImage;
    var src = (SI && typeof SI.resolve === 'function') ? SI.resolve() : null;
    var photoUrl = (src && src.dataUrl) ? src.dataUrl : '';
    var hadPhoto = !!photoUrl;
    if (!photoUrl) photoUrl = _solidBase();
    if (!photoUrl) return null;
    var tpl = _resolveTemplateId('review', payload.industry, payload.templateId || REVIEW_TPL_ID);   // [기본] 사용자 지정 우선
    var state = _runAutoApply(
      tpl, photoUrl,
      function (base) { return Object.assign({}, base, slots); },   // 샘플 slotValues 를 템플릿 base 위에 덮음
      function (st) { if (hadPhoto && st.tplV2.imageSlots && st.tplV2.imageSlots.main_photo) st.tplV2.imageSlots.main_photo.src = photoUrl; },
      _tplDataById(tpl),
      _templateOnSave({ purpose: 'review', label: '후기 카드' })   // [P0-B]
    );
    if (!state) return null;
    var sv = state.tplV2.slotValues || {};
    return {
      templateId: tpl,
      templateLabel: '후기 인용 카드',
      reviewExcerpt: String(sv.review_text || '').slice(0, 40),
      customerLabel: sv.customer_label || '고객님',
      hadPhoto: hadPhoto,
    };
  }

  function _applySampleBA(payload, slots, opts) {
    var ph = _resolveBaPhotos(opts);
    if (ph.needsPhoto) return { needsPhoto: true };
    var tpl = _resolveTemplateId('before_after', payload.industry, payload.templateId || BA_TPL_DEFAULT);   // [기본] 사용자 지정 우선
    var state = _runAutoApply(
      tpl, ph.afterUrl,
      function (base) { return Object.assign({}, base, slots); },
      function (st) { if (!ph.beforeUrl && ph.prevSecond) st.secondImg = ph.prevSecond; },
      _baTplData(tpl),
      _templateOnSave({ purpose: 'before_after', label: _baLabel(tpl) }),   // [P0-B]
      ph.beforeUrl   // [2026-07-22] 합성 전에 secondImg 로 주입
    );
    if (!state) return null;
    var sv = state.tplV2.slotValues || {};
    return {
      templateId: tpl,
      templateLabel: _baLabel(tpl),
      headline: sv.headline || '시술 전후',
      hasBefore: !!ph.beforeUrl || !!ph.prevSecond,
      hasAfter: true,
    };
  }

  function applySample(payload, ctx, opts) {
    opts = opts || {};
    if (!payload || !payload.autoApplyEligible) return null;   // event(templateId null) 제외
    var slots = payload.slotValues || {};
    if (payload.purpose === 'review') return _applySampleReview(payload, slots);
    if (payload.purpose === 'before_after') return _applySampleBA(payload, slots, opts);
    return null;   // price / 기타 → app-assistant 가 처리
  }

  window.ItdasyTemplateAutoApply = {
    detectReviewCard: detectReviewCard,
    detectBeforeAfterCard: detectBeforeAfterCard,
    buildReviewSlotValues: buildReviewSlotValues,
    buildBASlotValues: buildBASlotValues,
    handleReviewCard: handleReviewCard,
    handleBeforeAfterCard: handleBeforeAfterCard,
    applySample: applySample,
    // [2026-07-22] headless 합성 헬퍼 공개 — assistant-template-restore(재편집)가 같은 파이프라인 재사용.
    composeCard: _composeCard,
    composeAndHandOff: _composeAndHandOff,
    setActiveState: function (st) { _activeState = st || null; },
    getActiveState: function () { return _activeState; },
    tplData: _tplDataById,
  };
})();
