/* [모드 P1] 잇비 사진편집 모드 — 2026-06-12
   디자인 확정안: mockups/05-itbi-photo-mode-chat.html (단계·문구·칩 그대로)
   패턴: 모듈은 "메시지 객체"만 반환,
         채팅 push 는 app-assistant 훅이 수행. 칩은 related[] (라벨=명령 → handleText 라우팅).
   재사용(복제 금지): window.PhotoEditorTemplateGallery.previewURL, window.ChatAutoEdit.processPhoto,
     window.PhotoEditorTemplateMarketData.lookupById, window.Booking, window.CustomerCache,
     window.TreatmentLink, window.saveAssistantTemplateResult, POST /persona/generate.
   외부: window.ItdasyPhotoMode = { isActive, handlePhotos, handleText, exit, stepLabel, START_RE } */
(function () {
  'use strict';
  if (window.ItdasyPhotoMode) return;

  var LAST_KEY = 'itdasy_photo_mode_last';
  var Support = window.ItdasyPhotoModeSupport || null;
  var START_RE = (Support && Support.START_RE) || /(사진|이미지).*(편집|만들|꾸미|시켜|보정|홍보|예쁘)/;

  // 전역 상태 1개 — TTL 없음, exit() 까지 유지.
  var S = _fresh();
  function _fresh() {
    return { active: false, workflow: 'basic', step: null, photos: [], photoIdx: 0,
      customer: null, choices: {}, lastTemplateId: null, result: null, caption: '',
      captionHint: '', lastTemplateExpanded: false, past: [],
      // [§2] 캡션 재생성 context — "더 길게/짧게/인스타 말투로/해시태그 더"가 갱신, _caption 이 payload 로 사용.
      captionLen: 'medium', captionTone: 'normal', captionMoreTags: false, captionMinLines: 0 };
  }
  // [이슈6] 현재 처리 중인 사진(2장 순차 처리 시 photoIdx 가 0→1 로 진행). 안전 폴백 photos[0].
  function _curPhoto() { return S.photos[S.photoIdx] || S.photos[0] || null; }

  // ── 단계 라벨 (모드 배지/재안내용) ──
  var STEP_LABEL = {
    intake: '접수', await_photo: '사진 받기', template: '템플릿 고르기',
    ba_role: '사진 확인', ba_second: '전 사진 받기', fix: '사진 손질',
    caption_input: '시술명 입력', svc_ask: '시술 내역 입력', done: '완성 확인', saved: '완료',
  };
  function stepLabel() { return S.active ? (STEP_LABEL[S.step] || '진행 중') : ''; }

  // ── 작은 헬퍼 ──
  function _log() { try { var a = ['[PM]'].concat(Array.prototype.slice.call(arguments)); (console.debug || console.log).apply(console, a); } catch (_e) { void 0; } }
  function _shopType() { try { return localStorage.getItem('shop_type') || ''; } catch (_e) { return ''; } }
  function shouldStart(q, opts) {
    return Support && typeof Support.shouldStart === 'function' ? Support.shouldStart(q, opts) : START_RE.test(String(q || ''));
  }
  function _looksCaptionRequest(q) {
    if (Support && Support.CAPTION_RE) return Support.CAPTION_RE.test(String(q || ''));
    return /(캡션|홍보\s*글|홍보글|해시\s*태그|문구|인스타\s*(글|피드\s*글))/i.test(String(q || ''));
  }
  // [qa-F] 명시적 인스타 미리보기 요청만 true. "인스타스럽게/말투/느낌"(톤 수정)은 false → 미리보기 안 뜸.
  function _looksPreview(q) {
    if (Support && typeof Support.looksPreviewRequest === 'function') return Support.looksPreviewRequest(q);
    return /(미리\s*보기|피드에서|업로드\s*화면)/.test(String(q || '')) && !/인스타\s*(말투|스럽|식|느낌)/.test(String(q || ''));
  }
  function _snapshot() {
    try {
      var copy = Object.assign({}, S, { past: [] });
      return JSON.parse(JSON.stringify(copy));
    } catch (_e) { return null; }
  }
  function _remember() {
    var snap = _snapshot();
    if (!snap) return;
    S.past = S.past || [];
    S.past.push(snap);
    if (S.past.length > 8) S.past.shift();
  }
  function _restore(snap, past) {
    S = Object.assign(_fresh(), snap || {});
    S.past = past || [];
  }
  function _loadImg(url) {
    return new Promise(function (res) {
      try { var i = new Image(); i.onload = function () { res(i); }; i.onerror = function () { res(null); }; i.src = url; }
      catch (_e) { res(null); }
    });
  }
  function _lookup(id) {
    try { return window.PhotoEditorTemplateMarketData.lookupById(id) || { id: id, cat: 'feed', accent: 'soft', label: id }; }
    catch (_e) { return { id: id, cat: 'feed', accent: 'soft', label: id }; }
  }
  // [이슈2] purpose 별 사용자 지정 기본 템플릿 id 조회(없으면 ''). 라이브러리 미로딩/예외도 '' 폴백.
  function _libDefault(purpose) {
    try { var L = window.PhotoEditorTemplateLibrary; return (L && typeof L.getDefault === 'function') ? (L.getDefault(purpose) || '') : ''; }
    catch (_e) { return ''; }
  }
  // 설정된 기본 템플릿 중 1순위(전후→후기→가격) id. 1번 카드로 올려 "기본 템플릿" 배지 표시.
  function _defaultFirstId() { return _libDefault('before_after') || _libDefault('review') || _libDefault('price') || ''; }
  function _catRatio(catId) {
    try { var c = (window.PhotoEditorTemplateMarketData.CATS || []).find(function (x) { return x.id === catId; }); return (c && c.ratio) || '4:5'; }
    catch (_e) { return '4:5'; }
  }
  // 템플릿+사진(슬롯 주입) 합성 미리보기 dataURL. 실패 시 원본 url 폴백.
  async function _preview(tplId, slots, px) {
    try {
      // previewURL/lookupById/BACompose/Premium 은 photo 그룹(on-demand). 보장 로드(idempotent).
      try { if (window.AppLoader && typeof window.AppLoader.ensure === 'function') await window.AppLoader.ensure('photo'); } catch (_le) { void 0; }
      if (!window.PhotoEditorTemplateGallery || typeof window.PhotoEditorTemplateGallery.previewURL !== 'function') return (S.photos[0] && S.photos[0].url) || '';
      var t = _lookup(tplId);
      slots = slots || {};
      var isBA = /^ba/.test(tplId);
      // 메인(=BA after / 일반 main) 이미지 = originalImg
      var mainSrc = (slots.after_photo && slots.after_photo.src) || (slots.main_photo && slots.main_photo.src) || (S.photos[0] && S.photos[0].url);
      var mainImg = mainSrc ? await _loadImg(mainSrc) : null;
      var fake = { originalImg: mainImg, serviceName: '', shopName: '', tplV2: { id: tplId, imageSlots: slots } };
      // 슬롯 이미지 preload + prime — 단발 동기 렌더가 캐시 미스로 폴백되지 않게(실제 편집기와 동일).
      //   BA 'before' 슬롯은 BACompose 가 state.secondImg 로 그리므로 secondImg 로도 넘김.
      var srcs = [];
      Object.keys(slots).forEach(function (k) { if (slots[k] && slots[k].src) srcs.push(slots[k].src); });
      await Promise.all(srcs.map(async function (src) {
        var im = await _loadImg(src);
        if (!im) return;
        try { if (window.PhotoEditorBACompose && window.PhotoEditorBACompose.primeImage) window.PhotoEditorBACompose.primeImage(src, im); } catch (_p1) { void 0; }
        try { if (window.PhotoEditorPremiumTemplates && window.PhotoEditorPremiumTemplates.primeImage) window.PhotoEditorPremiumTemplates.primeImage(src, im); } catch (_p2) { void 0; }
        if (isBA && slots.before_photo && src === slots.before_photo.src) fake.secondImg = im;
      }));
      var url = window.PhotoEditorTemplateGallery.previewURL(t, fake, px || 320);
      return url || mainSrc || '';
    } catch (_e) { return (S.photos[0] && S.photos[0].url) || ''; }
  }

  // ── 오늘 예약/고객 대조 ──
  async function _matchCustomer() {
    try {
      if (!window.Booking || typeof window.Booking.list !== 'function') return null;
      var s = new Date(); s.setHours(0, 0, 0, 0);
      var e = new Date(); e.setHours(23, 59, 59, 999);
      var list = await window.Booking.list(s.toISOString(), e.toISOString());
      list = Array.isArray(list) ? list : (list && list.items) || [];
      // 진행 임박(상태 무관) 첫 손님 1명 — 정확 매칭은 P2.
      var b = list.find(function (x) { return x && (x.customer_id != null) && x.customer_name; });
      if (b) return { id: b.customer_id, name: b.customer_name, time: (b.starts_at || '').slice(11, 16) };
      return null;
    } catch (_e) { return null; }
  }

  // ── 헤드리스 보정 ──
  async function _autoEdit(srcUrl, intensity) {
    try {
      if (!window.ChatAutoEdit || typeof window.ChatAutoEdit.processPhoto !== 'function') return { dataUrl: srcUrl, preset_label: '' };
      var r = await window.ChatAutoEdit.processPhoto({ src: srcUrl, preset: 'shop', ratio: _catRatio(S.lastTemplateId ? _lookup(S.lastTemplateId).cat : 'feed'), intensity: intensity || 'standard' });
      return r || { dataUrl: srcUrl };
    } catch (_e) { return { dataUrl: srcUrl, preset_label: '' }; }
  }

  // ── 페르소나 문구 ──
  function _category() {
    var m = { '붙임머리': 'extension', '네일아트': 'nail', '네일': 'nail' };
    return m[_shopType()] || 'extension';
  }
  // [§2] 인스타 말투 분석(itdasy_latest_analysis) 요약을 캡션 프롬프트(photo_context)에 녹인다.
  function _instaAnalysisHint() {
    try {
      var a = JSON.parse(localStorage.getItem('itdasy_latest_analysis') || '{}') || {};
      var bits = [];
      if (a.tone_summary || a.tone) bits.push('말투 ' + (a.tone_summary || a.tone));
      if (a.style_summary) bits.push('스타일 ' + a.style_summary);
      if (a.avg_caption_length) bits.push('평소 캡션 약 ' + a.avg_caption_length + '자');
      return bits.length ? (' 우리 인스타 말투(' + bits.join(', ') + ')에 맞춰서.') : '';
    } catch (_e) { return ''; }
  }
  // [qa-F §5] 길이 지시문 — long 이면 풍부하게(최소 줄수 명시), short 면 간결하게.
  function _lenInstruction() {
    if (S.captionLen === 'long') {
      var min = S.captionMinLines && S.captionMinLines >= 2 ? S.captionMinLines : 5;
      return ' 캡션을 길고 풍부하게 — 시술 포인트·전후 변화·고객 공감·예약 유도(CTA)·해시태그를 담아 최소 ' + min + '줄 이상 줄바꿈하여 작성해주세요.';
    }
    if (S.captionLen === 'short') return ' 캡션을 핵심만 담아 짧고 간결하게 작성해주세요.';
    return '';
  }
  // [qa-F §5] "더 길게/5줄 이상"인데 결과가 직전보다 짧으면 이전 캡션 유지(짧아지지 않게).
  function _keepLonger(fresh, prev) {
    if (S.captionLen !== 'long' || !prev || !fresh) return fresh;
    var fl = String(fresh).replace(/\s+/g, '').length, pl = String(prev).replace(/\s+/g, '').length;
    return fl < pl ? prev : fresh;
  }
  async function _caption(hint, opts) {
    opts = opts || {};
    try {
      var headers = window.authHeader ? Object.assign({}, window.authHeader()) : {};
      headers['Content-Type'] = 'application/json';
      var ctxName = S.customer ? (S.customer.name + ' 손님. ') : '';
      var treatment = hint || S.captionHint || '';
      var analysis = _instaAnalysisHint();
      var more = S.captionMoreTags ? ' 해시태그를 평소보다 더 다양하게 많이 넣어주세요.' : '';
      var vary = opts.regen ? ' 이전과 다른 새로운 버전으로 작성해주세요.' : '';
      var lenInstr = _lenInstruction();   // [qa-F §5] 길이/최소 줄수 지시
      var ctxStr = (_shopType() + ' 시술. ' + ctxName + treatment + analysis + lenInstr + more + vary + ' 오늘 작업 완성본.').slice(0, 500);
      var body = { category: _category(), photo_context: ctxStr, length_tier: (S.captionLen || 'medium'), tone_override: (S.captionTone || 'normal') };
      var res = await fetch((window.API || '') + '/persona/generate', { method: 'POST', headers: headers, body: JSON.stringify(body) });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) return _captionFallback();
      var cap = (data.caption || '').trim();
      var tags = Array.isArray(data.hashtags) ? data.hashtags.map(function (t) { return '#' + String(t).replace(/^#+/, ''); }).join(' ') : '';
      return tags ? (cap + '\n\n' + tags) : (cap || _captionFallback());
    } catch (_e) { return _captionFallback(); }
  }

  function _captionFallback() {
    var recipe = Support && typeof Support.recipeFromText === 'function'
      ? Support.recipeFromText(S.captionHint || _shopType()) : 'natural';
    return Support && typeof Support.buildCaptionDraft === 'function'
      ? Support.buildCaptionDraft(recipe)
      : '시술 결과가 잘 보이도록 자연스럽게 정리한 사진이에요. 편하게 문의 주세요.';
  }

  // ════════════════════════ 단계별 메시지 빌더 ════════════════════════

  function _msgIntake() {
    S.step = 'intake';
    var n = S.photos.length;
    var c = S.customer;
    var hint = c && c.time ? ('<br><span style="font-size:11px;color:var(--text-subtle)">오늘 ' + c.time + ' 예약 손님이라 먼저 여쭤봐요</span>') : '';
    return { text: '사진 ' + n + '장 받았어요! ' + (c ? c.name + ' 손님 사진 맞아요?' : '이 사진 편집해 드릴게요.') + hint,
      related: c ? ['맞아요', '다른 손님이에요', '손님 연결 안 할래요'] : null,
      _next: c ? null : 'template' };
  }

  // 템플릿 고르기 — pm_tpls 카드(사용자 사진 끼운 previewURL) + 칩
  async function _msgTemplate(expanded) {
    S.step = 'template';
    S.lastTemplateExpanded = !!expanded;
    var ids = expanded
      ? ['ba-cream', 'feed-showcase', 'feed-review', 'ba-hair-cream', 'price-hair', 'event-discount']
      : ['ba-cream', 'feed-showcase', 'feed-review'];
    // [이슈2] 1번 카드 = 사용자 지정 기본 템플릿(우선) > 지난번 템플릿.
    var defId = _defaultFirstId();
    var last = null; try { last = localStorage.getItem(LAST_KEY); } catch (_e) { last = null; }
    var firstId = defId || (last && ids.indexOf(last) === -1 ? last : '');
    if (firstId) ids = [firstId].concat(ids.filter(function (x) { return x !== firstId; }));
    // [이슈6] 비-BA 미리보기는 현재 차례 사진(_curPhoto). BA 는 전/후 쌍(photos[0]/[1]).
    var cur = _curPhoto();
    var cards = [], opts = [];
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      var label = _lookup(id).label || id;
      var slots = /^ba/.test(id)
        ? { before_photo: { src: S.photos[0] && S.photos[0].url }, after_photo: { src: (S.photos[1] || S.photos[0] || {}).url } }
        : { main_photo: { src: cur && cur.url } };
      var url = await _preview(id, slots, 320);
      var badge = (defId && id === defId) ? '기본 템플릿' : (last && id === last) ? '지난번에 쓴 템플릿' : '';
      cards.push({ cmd: label, label: label, previewUrl: url, badge: badge });
      opts.push({ id: id, label: label });
    }
    S.choices.tplOptions = opts;
    var head = S.photos.length > 1 ? ('**사진 ' + (S.photoIdx + 1) + '/' + S.photos.length + '** · ') : '';
    return { text: head + '뭘 만들까요? **보내주신 사진을 끼워서** 미리 보여드릴게요.',
      pm_tpls: cards, related: ['템플릿 없이 보정만', '전체 템플릿 보기'] };
  }

  function _msgBaRole() {
    if (S.photos.length < 2) { S.step = 'ba_second'; return { text: '전후 카드엔 사진 2장이 필요해요. **시술 전** 사진 1장 더 보내주세요.' }; }
    S.step = 'ba_role';
    return { text: '전후 카드엔 **전 / 후** 구분이 필요해요. 사진 1이 **시술 전** 맞아요?',
      related: ['네 맞아요', '반대예요 (바꿔줘)'] };
  }

  // 사진 손질 — 보정본 생성 후 photo_result 카드
  async function _msgFix(intensity) {
    S.step = 'fix';
    // 후 사진(= 보정 대상): BA면 role=after, 아니면 현재 차례 사진(_curPhoto). [이슈6]
    var target = S.photos.find(function (p) { return p.role === 'after'; }) || _curPhoto();
    var r = await _autoEdit(target.url, intensity);
    S.result = { afterUrl: r.dataUrl, presetLabel: r.preset_label || '' };
    target.editedUrl = r.dataUrl;
    return { text: "보정본을 먼저 만들어뒀어요 — 머릿결 윤기·컬러를 살렸어요. 마음에 드세요?",
      photo_result: { dataUrl: r.dataUrl, ratio: '4:5', preset_label: r.preset_label || '', originalSrc: target.url },
      photo_caption: '탭하면 크게 비교해볼 수 있어요',
      related: ['좋아요, 이대로', '더 자연스럽게', '더 화사하게', '원본으로', '직접 만질래요'] };
  }

  // 완성 미리보기 — 템플릿+보정사진+문구 합성
  async function _msgDone(regenCaption) {
    S.step = 'done';
    var tplId = S.lastTemplateId || 'feed-showcase';
    var cur = _curPhoto();
    var afterUrl = (S.result && S.result.afterUrl) || (cur && cur.url);
    var beforeP = S.photos.find(function (p) { return p.role === 'before'; });
    var slots = /^ba/.test(tplId)
      ? { before_photo: { src: (beforeP || S.photos[0] || {}).url }, after_photo: { src: afterUrl } }
      : { main_photo: { src: afterUrl } };
    var composed = await _preview(tplId, slots, 720);
    if (!S.caption || regenCaption) { var _f = await _caption(null, { regen: !!regenCaption }); S.caption = regenCaption ? _keepLonger(_f, S.caption) : _f; }
    S.result = Object.assign(S.result || {}, { composedUrl: composed, tplId: tplId });
    var capLine = S.caption ? ('"' + S.caption.split('\n')[0] + '"') : '문구를 준비하고 있어요.';
    return { text: '완성본이에요. 문구는 **사장님 말투로** 미리 써뒀어요 — 고칠 부분만 알려주세요.',
      photo_result: { dataUrl: composed, ratio: '4:5' },
      photo_caption: capLine,
      related: ['이대로 저장', '인스타 미리보기', '문구 다시 써줘', '템플릿 바꾸기'] };
  }

  function _msgCaptionPrompt() {
    S.step = 'caption_input';
    return { text: '사진 받았어요! 어떤 시술인가요? 예: "레이어드 컷" · "붙임머리 S컬" 처럼 시술명을 알려주시면 인스타 문구를 바로 써드릴게요.',
      related: ['지난번처럼', '손님 연결 안 할래요', '끝낼래요'] };
  }

  // [이슈5] 손질 완료 후, 캡션 자동 생성 전에 시술 내역을 먼저 묻는다(건너뛰기 허용).
  function _msgServiceAsk() {
    S.step = 'svc_ask';
    return { text: '거의 다 됐어요! 캡션에 넣을 **시술 내역**을 알려주세요. 예: "레이어드 컷" · "붙임머리 S컬". 사진에 맞춰 문구를 써드려요.',
      related: ['그냥 알아서 써줘'] };
  }
  async function _doneForWorkflow() {
    return await (S.workflow === 'basic' && !S.lastTemplateId ? _msgDoneBasic() : _msgDone(false));
  }

  async function _msgCaptionDone(hint, regenCaption) {
    S.step = 'done';
    S.workflow = 'caption';
    if (hint && !/지난번처럼/.test(hint)) S.captionHint = hint;
    if (!S.caption || regenCaption) { var _f = await _caption(S.captionHint, { regen: !!regenCaption }); S.caption = regenCaption ? _keepLonger(_f, S.caption) : _f; }
    var url = (S.photos[0] && (S.photos[0].editedUrl || S.photos[0].url)) || '';
    S.result = Object.assign(S.result || {}, { composedUrl: url });
    var capLine = S.caption ? ('"' + S.caption.split('\n')[0] + '"') : '문구를 준비했어요.';
    var recipe = Support && typeof Support.recipeFromText === 'function' ? Support.recipeFromText(S.captionHint || _shopType()) : 'natural';
    var recos = Support && typeof Support.buildTemplateRecos === 'function' ? Support.buildTemplateRecos(S.captionHint || '사진 홍보용', {}) : [];
    var actions = Support && typeof Support.buildActions === 'function'
      ? Support.buildActions({ currentCustomer: S.customer }, recipe, S.caption, recos, url) : [];
    return { text: '캡션을 만들었어요. 사진과 함께 인스타에 올릴 문구로 바로 쓸 수 있어요.',
      photo_result: { dataUrl: url, ratio: '4:5' }, photo_caption: capLine,
      hub_actions: actions, related: ['이대로 저장', '문구 다시 써줘', '템플릿 고르기'] };
  }

  // 저장 + 고객 자동 연결
  async function _msgSaved() {
    var cur = _curPhoto();
    var dataUrl = (S.result && S.result.composedUrl) || (S.result && S.result.afterUrl) || (cur && cur.url);
    var label = S.customer ? (S.customer.name + ' 손님') : '잇비 사진편집';
    try { localStorage.setItem(LAST_KEY, S.result && S.result.tplId ? S.result.tplId : (S.lastTemplateId || '')); } catch (_e) { void 0; }
    try {
      if (typeof window.saveAssistantTemplateResult === 'function')
        await window.saveAssistantTemplateResult(dataUrl, { purpose: S.workflow, label: label, source: 'itbi_guided' });
    } catch (_e) { void 0; }
    var linked = '';
    if (S.customer && window.TreatmentLink && typeof window.TreatmentLink.attachPhotoToCustomer === 'function') {
      try {
        // 접수에서 이미 확인받음 → 재확인 없이 customer 직접 전달.
        await window.TreatmentLink.attachPhotoToCustomer({ customer: { id: S.customer.id, name: S.customer.name }, dataUrl: dataUrl, source: 'itbi_guided' });
        linked = ' · 고객기록 자동 연결';
      } catch (_e) { linked = ''; }
    }
    // [이슈6] 비-BA 다중 사진: 다음 차례가 남으면 카드 저장 후 다음 사진 템플릿부터 이어간다.
    if (!/^ba/.test(S.lastTemplateId || '') && (S.photoIdx + 1) < S.photos.length) {
      S.photoIdx += 1; S.result = null; S.caption = ''; S.captionHint = '';
      var next = await _msgTemplate(false);
      next.text = '✓ ' + S.photoIdx + '번째 사진 저장 완료! 이제 ' + next.text;
      return next;
    }
    S.step = 'saved';
    var slot = S.customer ? (S.customer.name + ' 손님 슬롯') : '작업실 슬롯';
    return { text: '✓ 작업실에 저장했어요 — ' + slot + linked + '\n\n다음은 뭐 할까요?',
      related: ['작업실에서 보기', '인스타 미리보기', '다른 사진 편집', '끝낼래요'] };
  }

  async function _msgCurrent() {
    switch (S.step) {
      case 'intake': return _msgIntake();
      case 'await_photo': return { text: '편집할 사진을 보내주세요 — 손님 사진이면 예약과 자동으로 연결해드릴게요.' };
      case 'template': return await _msgTemplate(S.lastTemplateExpanded);
      case 'ba_role': return _msgBaRole();
      case 'ba_second': return _msgBaRole();
      case 'fix': return await _msgFix();
      case 'caption_input': return _msgCaptionPrompt();
      case 'svc_ask': return _msgServiceAsk();
      case 'done': return S.workflow === 'caption' ? await _msgCaptionDone(S.captionHint, false) : await _msgDone(false);
      case 'saved': return { text: '작업실에 저장한 상태예요. 다음 작업을 골라주세요.', related: ['작업실에서 보기', '다른 사진 편집', '끝낼래요'] };
      default: return { text: '사진편집 모드예요. 편집할 사진을 보내주세요.' };
    }
  }

  async function back() {
    var past = S.past || [];
    if (!S.active || !past.length) return { text: '이전 단계가 없어요. 처음부터 하거나 계속 진행할 수 있어요.', related: ['처음부터', '끝낼래요'] };
    var prev = past.pop();
    _restore(prev, past);
    return await _msgCurrent();
  }

  // ════════════════════════ 공개 API ════════════════════════

  function isActive() { return !!S.active; }

  function exit() { S = _fresh(); }

  // 사진 수신 → 접수(또는 BA 두 번째 사진 완성)
  async function handlePhotos(photoUrls, question, _ctx) {
    photoUrls = (photoUrls || []).filter(Boolean);
    _log('handlePhotos', { n: photoUrls.length, active: S.active, step: S.step });
    if (!photoUrls.length) return null;
    // BA 두 번째 사진 대기 중 → 전 사진으로 채워 손질로.
    if (S.active && S.step === 'ba_second') {
      S.photos.push({ url: photoUrls[0], role: null });
      _assignBaRoles(true);
      _log('ba_second→fix', { photos: S.photos.length });
      return await _msgFix();
    }
    // [C] 진행 중(접수/await_photo 외) 추가 업로드 → 사진 누적만, 단계 유지(중복 카드 push 방지).
    if (S.active && S.step && S.step !== 'await_photo') {
      photoUrls.forEach(function (u) { S.photos.push({ url: u, role: null }); });
      _log('accumulate', { step: S.step, photos: S.photos.length });
      return { text: '사진을 더 받았어요 (총 ' + S.photos.length + '장). 위에서 이어서 골라주세요 🙂' };
    }
    // 신규 접수
    S.active = true;
    S.workflow = _looksCaptionRequest(question) ? 'caption' : 'basic';
    S.photos = photoUrls.map(function (u) { return { url: u, role: null }; });
    S.customer = await _matchCustomer();
    _log('intake', { customer: S.customer && S.customer.name });
    if (S.workflow === 'caption' && !S.customer) return _msgCaptionPrompt();
    var m = _msgIntake();
    if (m._next === 'template') { delete m._next; return await _msgTemplate(false); }
    return m;
  }

  // 텍스트(또는 칩 라벨) 수신
  async function handleText(q, _ctx) {
    q = (q || '').trim();
    _log('handleText', { q: q, active: S.active, step: S.step });
    if (!S.active) return _startFromText(q);
    var globalMsg = await _handleGlobalText(q);
    if (globalMsg) return globalMsg;
    _remember();
    return await _handleStepText(q);
  }

  function _startFromText(q) {
    if (!shouldStart(q, { hasPhoto: false })) return null;
    S.active = true; S.step = 'await_photo';
    return { text: '좋아요, 사진편집 모드예요. 편집할 **사진을 보내주세요** — 손님 사진이면 예약과 자동으로 연결해드릴게요.' };
  }

  async function _handleGlobalText(q) {
    if (/^(그만|취소|종료|끝낼래요|끝낼래|나가기)$/.test(q)) {
      exit();
      return { text: '사진편집 모드를 종료했어요. 필요하면 다시 불러주세요 🙂' };
    }
    if (/^(←\s*)?이전|뒤로|한\s*단계/.test(q)) return await back();
    if (/^처음부터/.test(q)) {
      S = _fresh(); S.active = true; S.step = 'await_photo';
      return { text: '처음부터 할게요. 편집할 사진을 다시 보내주세요.' };
    }
    // [§6/§3] 사진 2장을 이미 받은 상태에서 "전후 카드/템플릿 만들어줘"(+ 순서 지정) 명시 →
    //   사진 재요청·후사진 단독 보정(_msgFix)으로 빠지지 않고 전/후 역할 배정 후 전후 카드를 바로 합성한다.
    if (S.active && S.photos.length >= 2
        && /(전후|비포\s*애프터|before\s*after)/i.test(q)
        && /(만들|해줘|제작|뽑|꾸며|카드|템플릿)/.test(q)) {
      S.lastTemplateId = _libDefault('before_after') || 'ba-cream';
      S.workflow = 'ba';
      _assignBaRoles(_baOrderSwap(q));   // 첫=전/둘=후 기본, "첫 번째 후/두 번째 전"이면 swap
      return await _composeBaCard();
    }
    return null;
  }

  // [§6] 전/후 순서 역지정 판별. "첫 번째 후" 또는 "두 번째 전" → swap(true). 기본(첫=전,둘=후) → false.
  function _baOrderSwap(text) {
    var t = String(text || '').replace(/\s+/g, '');
    var m1 = /(첫번째|첫장|첫|처음|1번째|1장)(사진)?[는은이가을를로=]*(전|후)/.exec(t);
    if (m1 && m1[3] === '후') return true;
    var m2 = /(두번째|둘째|둘|2번째|2장)(사진)?[는은이가을를로=]*(전|후)/.exec(t);
    if (m2 && m2[3] === '전') return true;
    return false;
  }

  async function _handleStepText(q) {
    switch (S.step) {
      case 'intake':
        if (/^맞아요$/.test(q)) return S.workflow === 'caption' ? _msgCaptionPrompt() : await _msgTemplate(false);
        if (/다른 손님/.test(q)) { S.customer = await _pickCustomer(); return S.workflow === 'caption' ? _msgCaptionPrompt() : await _msgTemplate(false); }
        if (/연결 안/.test(q)) { S.customer = null; return S.workflow === 'caption' ? _msgCaptionPrompt() : await _msgTemplate(false); }
        return null;

      case 'template': {
        if (/보정만/.test(q)) { S.workflow = 'basic'; S.lastTemplateId = null; return await _msgFix(); }
        if (/전체 템플릿/.test(q)) return await _msgTemplate(true);
        var opts = S.choices.tplOptions || [];
        var opt = opts.find(function (o) { return o.label === q; });
        // 부분(prefix) 매칭 폴백 — 사용자가 라벨 일부만 입력/축약("시술 전후" → "시술 전후 (크림)")해도
        //   레거시 경로로 새지 않게 photo-mode 안에서 BA/템플릿으로 정확히 흡수.
        if (!opt && q.length >= 2) opt = opts.find(function (o) { return o.label.indexOf(q) === 0 || q.indexOf(o.label) === 0; });
        if (opt) {
          S.lastTemplateId = opt.id;
          S.workflow = /^ba/.test(opt.id) ? 'ba' : 'template';
          if (S.workflow === 'ba') return _msgBaRole();
          return await _msgFix();
        }
        return null;
      }

      case 'ba_role':
        // [§6] 카드 탭으로 들어온 전후도 후사진 단독 보정(_msgFix)이 아니라 전후 카드를 바로 합성.
        if (/^네/.test(q)) { _assignBaRoles(false); return await _composeBaCard(); }
        if (/반대/.test(q)) { _assignBaRoles(true); return await _composeBaCard(); }
        return null;

      case 'fix':
        if (/이대로|좋아요/.test(q)) return _msgServiceAsk();   // [이슈5] 캡션 전 시술 내역 게이트
        if (/자연스럽/.test(q)) return await _msgFix('natural');
        if (/화사/.test(q)) return await _msgFix('strong');
        if (/원본/.test(q)) { if (S.result) { var _cp = _curPhoto(); S.result.afterUrl = (_cp && _cp.url); } return await _msgFix(null); }
        if (/직접/.test(q)) return await _toWorkshop();
        return null;

      case 'svc_ask': {  // [이슈5] 시술 내역 입력 또는 "그냥 알아서 써줘" 건너뛰기
        // [qa-F] 미리보기 요청은 시술내역으로 오인하지 않는다 — 캡션 먼저 만들도록 재안내.
        if (_looksPreview(q)) return { text: '먼저 시술 내용을 알려주시면, 캡션을 만든 뒤에 미리보기를 보여드릴게요.', related: ['그냥 알아서 써줘'] };
        // [qa-F] 시술내역 대신 톤/길이만 말한 경우("인스타스럽게"·"더 길게") — 설정만 반영하고 시술내역을 다시 묻는다.
        //   (시술명이 섞인 "레이어드컷 인스타스럽게"는 시술내역으로 처리.)
        var adj0 = _captionAdjust(q);
        if (adj0 && _isPureAdjust(q) && !/알아서|그냥/.test(q)) {
          if (adj0.len) S.captionLen = adj0.len;
          if (adj0.tone) S.captionTone = adj0.tone;
          if (adj0.moreTags) S.captionMoreTags = true;
          if (adj0.minLines) S.captionMinLines = adj0.minLines;
          return { text: '말투는 그렇게 맞춰둘게요! 그런데 캡션에 넣을 **시술 내역**을 먼저 알려주세요. 예: "레이어드컷, 얼굴형 보완".', related: ['그냥 알아서 써줘'] };
        }
        if (!/알아서|그냥/.test(q)) S.captionHint = q;
        return await _doneForWorkflow();
      }

      case 'caption_input':
        if (/연결 안/.test(q)) { S.customer = null; return _msgCaptionPrompt(); }
        return await _msgCaptionDone(q, true);

      case 'done':
        return await _handleDoneText(q);

      case 'saved':
        return _handleSavedText(q);

      default:
        return null;
    }
  }

  // 'done' 단계 분기(파일 함수 50줄 규칙 준수 위해 분리).
  async function _handleDoneText(q) {
    // [qa-F §6] 문구 톤/길이/해시태그 수정을 미리보기보다 먼저 — "인스타스럽게/말투로"가 미리보기를 열던 버그 차단.
    //   직전 시술내역+말투 context 유지하고 재생성. ("더 길게/짧게/5줄 이상/해시태그 더/캡션 다시")
    var adj = _captionAdjust(q);
    if (adj || /문구/.test(q)) {
      if (adj) {
        if (adj.len) S.captionLen = adj.len;
        if (adj.tone) S.captionTone = adj.tone;
        if (adj.moreTags) S.captionMoreTags = true;
        if (adj.minLines) S.captionMinLines = adj.minLines;
      }
      return S.workflow === 'caption' ? await _msgCaptionDone(S.captionHint || '지난번처럼', true) : await _msgDone(true);
    }
    // [qa-F §6/이슈4] 명시적 미리보기 단어("인스타 미리보기/피드에서 보기")일 때만 미리보기.
    if (_looksPreview(q)) return _openInstaPreview();
    if (/저장/.test(q)) return await _msgSaved();
    if (/템플릿 바꾸|템플릿 고르/.test(q)) return await _msgTemplate(false);
    return null;
  }

  // 'saved' 단계 분기(파일 함수 50줄 규칙 준수 위해 분리).
  function _handleSavedText(q) {
    if (_looksPreview(q)) return _openInstaPreview();   // [qa-F/이슈4] 명시적 미리보기만
    // [§4] 작업실로 이동 — 채팅 메시지 push/재렌더를 하지 않는다. (재렌더 시 닫히는 트랜지션 중 직전 캡션 카드가 1초 깜빡이던 버그)
    if (/작업실/.test(q)) { _openWorkshop(); exit(); return { pm_navigated: true }; }
    if (/다른 사진/.test(q)) { var keepCust = S.customer; S = _fresh(); S.active = true; S.customer = keepCust; S.step = 'await_photo'; return { text: '좋아요, 다음 사진을 보내주세요.' }; }
    return null;
  }

  // [§2] 캡션 재생성 조절 의도 파싱 — 길이/말투/해시태그/재생성. 없으면 null.
  function _captionAdjust(q) {
    q = String(q || '');
    var out = null;
    function set(k, v) { out = out || {}; out[k] = v; }
    if (/(더\s*길게|길게|분량.*(늘|많|크)|자세히|상세히|풍부하게|넉넉)/.test(q)) set('len', 'long');
    // [qa-F §5] "5줄 이상/여러 줄/N문단" → 길게 + 최소 줄수 보장.
    var ml = q.match(/(\d+)\s*(줄|문단)\s*(이상|넘게|이상으로|정도)?/);
    if (ml || /(여러\s*줄|다섯\s*줄|문단으로|여러\s*문단)/.test(q)) {
      set('len', 'long');
      var n = ml ? parseInt(ml[1], 10) : 5;
      if (/문단/.test(q) && ml) n = Math.max(n * 2, 5);   // N문단 ≈ 줄수로 환산
      if (n >= 2 && n <= 30) set('minLines', n);
    }
    if (/(더\s*짧게|짧게|간결|핵심만|줄여|간단)/.test(q)) set('len', 'short');
    if (/(인스타\s*(말투|스럽|식|느낌)|더\s*인스타|화려|이모지\s*(더|많)|꾸며서|발랄|트렌디)/.test(q)) set('tone', 'ornate');
    // [qa-F §5] "고급스럽게/세련/우아/프리미엄"도 정제된 톤(plain)으로, "자연스럽게/과하지 않게"는 재생성으로 수렴.
    if (/(담백|깔끔한\s*말투|차분|이모지\s*(빼|줄|없)|점잖|격식|고급|세련|우아|프리미엄|품격)/.test(q)) set('tone', 'plain');
    if (/(자연스럽게|내추럴|과하지\s*않게|담담)/.test(q)) set('regen', true);
    if (/(해시\s*태그|해시태그).*(더|추가|많|넣)/.test(q)) set('moreTags', true);
    if (/(캡션\s*(다시|새로)|다시\s*(써|만들|생성|해)|다른\s*(버전|느낌|걸로)|새\s*버전|새로\s*써)/.test(q)) set('regen', true);
    return out;
  }

  // [qa-F] 톤/길이/해시태그 조정어만 있고 실제 시술명이 없는지(시술내역 게이트에서 오인 방지).
  //   조정 관련 단어/조사/공통어를 모두 지우고 남은 한글이 2자 미만이면 '순수 조정'으로 본다.
  var _ADJUST_WORDS_RE = /(더|좀|조금|훨씬|길게|짧게|간결|핵심만|줄여|간단|인스타|말투|스럽게|스럽|식|느낌|화려|이모지|많이|많게|빼고|빼|줄이고|없이|꾸며서|발랄|트렌디|담백|깔끔|차분|점잖|격식|고급|세련|우아|프리미엄|품격|자연|내추럴|과하지|않게|해시\s*태그|해시태그|추가|넣어|넣게|다시|새로|새|버전|풍부하게|넉넉|자세히|상세히|분량|늘려|크게|여러\s*줄|다섯\s*줄|문단으로|문단|줄|이상|넘게|정도|으로|로|하게|해줘|써줘|만들어|만들|줘|요|해|주세요)/g;
  function _isPureAdjust(q) {
    var stripped = String(q || '').replace(_ADJUST_WORDS_RE, '').replace(/[0-9\s.,!?·~"'`]/g, '');
    return stripped.length < 2;
  }

  // ── 보조 동작 ──
  function _assignBaRoles(swap) {
    if (S.photos.length < 2) return;
    S.photos[0].role = swap ? 'after' : 'before';
    S.photos[1].role = swap ? 'before' : 'after';
  }
  // [§6/§3] 전후 카드 바로 합성 — 두 사진 모두 사용. 후사진 단독 보정(_msgFix) 건너뜀.
  async function _composeBaCard() {
    // [§2 qa-E] 보정은 유지하되 단일 보정 화면으로 빠지지 않게 — 후사진을 전후 카드 파이프라인 '안에서' 자연 보정 후 합성.
    var afterP = S.photos.find(function (p) { return p.role === 'after'; }) || S.photos[1] || S.photos[0];
    var afterUrl = (afterP && afterP.url) || '';
    try {
      if (afterUrl) {
        var r = await _autoEdit(afterUrl, 'standard');   // 후사진 홍보용 자연 보정(피부/밝기/선명도/색감)
        if (r && r.dataUrl) { afterUrl = r.dataUrl; if (afterP) afterP.editedUrl = r.dataUrl; }
      }
    } catch (_e) { void _e; }
    S.result = Object.assign(S.result || {}, { afterUrl: afterUrl, presetLabel: '자연 보정 적용', baEnhanced: true });
    // [qa-F §4] 전후 카드 미리보기는 만들되, 시술내역 없이 캡션을 자동 생성하지 않는다.
    //   카드 합성 → 시술내역 게이트(svc_ask). 내역을 받으면 _doneForWorkflow→_msgDone 이 그 내용으로 캡션 생성.
    var tplId = S.lastTemplateId || 'ba-cream';
    var beforeP = S.photos.find(function (p) { return p.role === 'before'; }) || S.photos[0];
    var slots = { before_photo: { src: (beforeP || {}).url }, after_photo: { src: afterUrl } };
    var composed = await _preview(tplId, slots, 720);
    S.result = Object.assign(S.result, { composedUrl: composed, tplId: tplId });
    S.workflow = 'ba';
    S.step = 'svc_ask';
    return { text: '전후 카드를 만들었어요! **시술 내용**을 알려주시면 전후 변화에 맞는 캡션까지 써드릴게요.\n예: "레이어드컷, 무거운 머리 정리, 얼굴형 보완"',
      photo_result: { dataUrl: composed, ratio: '4:5' },
      photo_caption: '시술 내역을 알려주시면 캡션을 써드려요',
      related: ['그냥 알아서 써줘'] };
  }
  async function _pickCustomer() {
    try { if (window.Customer && typeof window.Customer.pick === 'function') { var c = await window.Customer.pick({}); return c && c.id != null ? { id: c.id, name: c.name || '고객' } : null; } }
    catch (_e) { /* ignore */ }
    return null;
  }
  // 템플릿 없이 보정만 → 손질본 자체를 완성으로
  async function _msgDoneBasic() {
    S.step = 'done';
    if (!S.caption) S.caption = await _caption();
    var cur = _curPhoto();
    var url = (S.result && S.result.afterUrl) || (cur && cur.url);
    S.result = Object.assign(S.result || {}, { composedUrl: url });
    var capLine = S.caption ? ('"' + S.caption.split('\n')[0] + '"') : '문구를 준비했어요.';
    return { text: '보정 완성본이에요. 문구도 **사장님 말투로** 써뒀어요.',
      photo_result: { dataUrl: url, ratio: '4:5' }, photo_caption: capLine,
      related: ['이대로 저장', '인스타 미리보기', '문구 다시 써줘'] };
  }
  // 직접 만질래요 → 작업실 슬롯 생성(편집기 자동 오픈 금지)
  async function _toWorkshop() {
    var url = (S.result && S.result.afterUrl) || (S.photos[0] && S.photos[0].url);
    try {
      if (typeof window.saveAssistantTemplateResult === 'function')
        await window.saveAssistantTemplateResult(url, { purpose: 'itbi_guided_edit', label: (S.customer ? S.customer.name + ' 손님' : '편집중'), source: 'itbi_guided' });
    } catch (_e) { void 0; }
    S.step = 'saved';
    return { text: '작업실에 슬롯을 만들어뒀어요. 작업실에서 열어 직접 더 손보실 수 있어요.',
      related: ['작업실에서 보기', '끝낼래요'] };
  }
  function _openWorkshop() {
    // [이슈3] 잇비 채팅 시트(z-index 10500)가 작업실을 가리지 않도록 먼저 닫는다.
    try { if (typeof window.closeAssistant === 'function') window.closeAssistant(); } catch (_e) { void 0; }
    try { if (typeof window.showTab === 'function') window.showTab('workshop', document.querySelector('.tab-bar__fab[data-tab="workshop"]') || null); } catch (_e) { void 0; }
    try { if (typeof window.initWorkshopTab === 'function') window.initWorkshopTab(); } catch (_e) { void 0; }
  }
  // [이슈4] 합성 완성본 + 캡션으로 인스타 미리보기 팝업 열기. 업로드는 팝업 내 "올리기"→최종 확인(nativeConfirm)
  //   →publish-file 의 3단계가 openInstagramPreview 에 내장돼 있어 그대로 재사용(무확인 즉시 업로드 없음).
  //   open_instagram 액션 핸들러는 라이브 캔버스(#peCanvas)를 우선 캡처해 합성본을 덮을 수 있으므로 직접 호출.
  function _openInstaPreview() {
    var cur = _curPhoto();
    var url = (S.result && (S.result.composedUrl || S.result.afterUrl)) || (cur && cur.url) || '';
    if (!url) return { text: '먼저 완성본을 만든 뒤 인스타 미리보기를 열 수 있어요.' };
    try {
      if (typeof window.openInstagramPreview === 'function')
        window.openInstagramPreview({ src: url, caption: S.caption || '', ratio: '4:5', enableUpload: true });
    } catch (_e) { void 0; }
    return { text: '인스타 미리보기를 열었어요. **"인스타에 올리기"** 를 누르면 마지막 확인 후 올라가요.' };
  }

  window.ItdasyPhotoMode = {
    isActive: isActive,
    shouldStart: shouldStart,
    handlePhotos: handlePhotos,
    handleText: handleText,
    back: back,
    exit: exit,
    stepLabel: stepLabel,
    START_RE: START_RE,
  };
})();
