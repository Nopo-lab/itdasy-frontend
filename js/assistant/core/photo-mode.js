/* [모드 P1] 잇비 사진편집 모드 — 2026-06-12
   디자인 확정안: mockups/05-itbi-photo-mode-chat.html (단계·문구·칩 그대로)
   패턴: photo-flow.js / photo-chain.js 와 동일 — 모듈은 "메시지 객체"만 반환,
         채팅 push 는 app-assistant 훅이 수행. 칩은 related[] (라벨=명령 → handleText 라우팅).
   재사용(복제 금지): window.PhotoEditorTemplateGallery.previewURL, window.ChatAutoEdit.processPhoto,
     window.PhotoEditorTemplateMarketData.lookupById, window.Booking, window.CustomerCache,
     window.TreatmentLink, window.saveAssistantTemplateResult, POST /persona/generate.
   외부: window.ItdasyPhotoMode = { isActive, handlePhotos, handleText, exit, stepLabel, START_RE } */
(function () {
  'use strict';
  if (window.ItdasyPhotoMode) return;

  var LAST_KEY = 'itdasy_photo_mode_last';
  var START_RE = /(사진|이미지).*(편집|만들|꾸미|시켜)/;

  // 전역 상태 1개 — TTL 없음, exit() 까지 유지.
  var S = _fresh();
  function _fresh() {
    return { active: false, workflow: 'basic', step: null, photos: [],
      customer: null, choices: {}, lastTemplateId: null, result: null, caption: '' };
  }

  // ── 단계 라벨 (모드 배지/재안내용) ──
  var STEP_LABEL = {
    intake: '접수', await_photo: '사진 받기', template: '템플릿 고르기',
    ba_role: '사진 확인', ba_second: '전 사진 받기', fix: '사진 손질',
    done: '완성 확인', saved: '완료',
  };
  function stepLabel() { return S.active ? (STEP_LABEL[S.step] || '진행 중') : ''; }

  // ── 작은 헬퍼 ──
  function _shopType() { try { return localStorage.getItem('shop_type') || ''; } catch (_e) { return ''; } }
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
  async function _caption() {
    try {
      var headers = window.authHeader ? Object.assign({}, window.authHeader()) : {};
      headers['Content-Type'] = 'application/json';
      var ctxName = S.customer ? (S.customer.name + ' 손님. ') : '';
      var body = { category: _category(), photo_context: (_shopType() + ' 시술. ' + ctxName + '오늘 작업 완성본.').slice(0, 500), length_tier: 'medium', tone_override: 'normal' };
      var res = await fetch((window.API || '') + '/persona/generate', { method: 'POST', headers: headers, body: JSON.stringify(body) });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) return '';
      var cap = (data.caption || '').trim();
      var tags = Array.isArray(data.hashtags) ? data.hashtags.map(function (t) { return '#' + String(t).replace(/^#+/, ''); }).join(' ') : '';
      return tags ? (cap + '\n\n' + tags) : cap;
    } catch (_e) { return ''; }
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
    var ids = expanded
      ? ['ba-cream', 'feed-showcase', 'feed-review', 'ba-hair-cream', 'price-hair', 'event-discount']
      : ['ba-cream', 'feed-showcase', 'feed-review'];
    // 1번 카드를 지난번 템플릿으로 교체
    var last = null; try { last = localStorage.getItem(LAST_KEY); } catch (_e) { last = null; }
    if (last && ids.indexOf(last) === -1) ids[0] = last;
    var cards = [];
    var opts = [];
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      var t = _lookup(id);
      var label = t.label || id;
      var slots = /^ba/.test(id) ? { before_photo: { src: S.photos[0] && S.photos[0].url }, after_photo: { src: (S.photos[1] || S.photos[0] || {}).url } } : { main_photo: { src: S.photos[0] && S.photos[0].url } };
      var url = await _preview(id, slots, 320);
      // cmd = 사람이 읽을 라벨(말풍선에 그대로 보임). handleText 가 라벨→id 매핑으로 해석.
      cards.push({ cmd: label, label: label, previewUrl: url, badge: (last && id === last) ? '지난번에 쓴 템플릿' : '' });
      opts.push({ id: id, label: label });
    }
    S.choices.tplOptions = opts;
    return { text: '뭘 만들까요? **보내주신 사진을 끼워서** 미리 보여드릴게요.',
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
    // 후 사진(= 보정 대상): BA면 role=after, 아니면 photos[0]
    var target = S.photos.find(function (p) { return p.role === 'after'; }) || S.photos[0];
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
    var afterUrl = (S.result && S.result.afterUrl) || (S.photos[0] && S.photos[0].url);
    var beforeP = S.photos.find(function (p) { return p.role === 'before'; });
    var slots = /^ba/.test(tplId)
      ? { before_photo: { src: (beforeP || S.photos[0] || {}).url }, after_photo: { src: afterUrl } }
      : { main_photo: { src: afterUrl } };
    var composed = await _preview(tplId, slots, 720);
    if (!S.caption || regenCaption) S.caption = await _caption();
    S.result = Object.assign(S.result || {}, { composedUrl: composed, tplId: tplId });
    var capLine = S.caption ? ('"' + S.caption.split('\n')[0] + '"') : '문구를 준비하고 있어요.';
    return { text: '완성본이에요. 문구는 **사장님 말투로** 미리 써뒀어요 — 고칠 부분만 알려주세요.',
      photo_result: { dataUrl: composed, ratio: '4:5' },
      photo_caption: capLine,
      related: ['이대로 저장', '문구 다시 써줘', '템플릿 바꾸기'] };
  }

  // 저장 + 고객 자동 연결
  async function _msgSaved() {
    var dataUrl = (S.result && S.result.composedUrl) || (S.result && S.result.afterUrl) || (S.photos[0] && S.photos[0].url);
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
    S.step = 'saved';
    var slot = S.customer ? (S.customer.name + ' 손님 슬롯') : '작업실 슬롯';
    return { text: '✓ 작업실에 저장했어요 — ' + slot + linked + '\n\n다음은 뭐 할까요?',
      related: ['작업실에서 보기', '다른 사진 편집', '끝낼래요'] };
  }

  // ════════════════════════ 공개 API ════════════════════════

  function isActive() { return !!S.active; }

  function exit() { S = _fresh(); }

  // 사진 수신 → 접수(또는 BA 두 번째 사진 완성)
  async function handlePhotos(photoUrls, question, _ctx) {
    photoUrls = (photoUrls || []).filter(Boolean);
    if (!photoUrls.length) return null;
    // BA 두 번째 사진 대기 중
    if (S.active && S.step === 'ba_second') {
      S.photos.push({ url: photoUrls[0], role: null });
      _assignBaRoles(true);
      return _msgFix();
    }
    // 신규 접수
    S.active = true;
    S.workflow = 'basic';
    S.photos = photoUrls.map(function (u) { return { url: u, role: null }; });
    S.customer = await _matchCustomer();
    var m = _msgIntake();
    if (m._next === 'template') { delete m._next; return await _msgTemplate(false); }
    return m;
  }

  // 텍스트(또는 칩 라벨) 수신
  async function handleText(q, _ctx) {
    q = (q || '').trim();
    // 비활성 + 시작 발화 → 모드 진입(사진 요청)
    if (!S.active) {
      if (!START_RE.test(q)) return null;
      S.active = true; S.step = 'await_photo';
      return { text: '좋아요, 사진편집 모드예요. 편집할 **사진을 보내주세요** — 손님 사진이면 예약과 자동으로 연결해드릴게요.' };
    }
    // 전역 명령
    if (/^(그만|취소|종료|끝낼래요|끝낼래|나가기)$/.test(q)) { exit(); return { text: '사진편집 모드를 종료했어요. 필요하면 다시 불러주세요 🙂' }; }
    if (/^처음부터/.test(q)) { if (S.photos.length) { S.step = null; S.result = null; S.caption = ''; return await _msgTemplate(false); } S.step = 'await_photo'; return { text: '처음부터 할게요. 편집할 사진을 다시 보내주세요.' }; }

    switch (S.step) {
      case 'intake':
        if (/^맞아요$/.test(q)) return await _msgTemplate(false);
        if (/다른 손님/.test(q)) { S.customer = await _pickCustomer(); return await _msgTemplate(false); }
        if (/연결 안/.test(q)) { S.customer = null; return await _msgTemplate(false); }
        return null;

      case 'template': {
        if (/보정만/.test(q)) { S.workflow = 'basic'; S.lastTemplateId = null; return await _msgFix(); }
        if (/전체 템플릿/.test(q)) return await _msgTemplate(true);
        var opt = (S.choices.tplOptions || []).find(function (o) { return o.label === q; });
        if (opt) {
          S.lastTemplateId = opt.id;
          S.workflow = /^ba/.test(opt.id) ? 'ba' : 'template';
          if (S.workflow === 'ba') return _msgBaRole();
          return await _msgFix();
        }
        return null;
      }

      case 'ba_role':
        if (/^네/.test(q)) { _assignBaRoles(false); return await _msgFix(); }
        if (/반대/.test(q)) { _assignBaRoles(true); return await _msgFix(); }
        return null;

      case 'fix':
        if (/이대로|좋아요/.test(q)) return await (S.workflow === 'basic' && !S.lastTemplateId ? _msgDoneBasic() : _msgDone(false));
        if (/자연스럽/.test(q)) return await _msgFix('natural');
        if (/화사/.test(q)) return await _msgFix('strong');
        if (/원본/.test(q)) { if (S.result) S.result.afterUrl = (S.photos[0] && S.photos[0].url); return await _msgFix(null); }
        if (/직접/.test(q)) return await _toWorkshop();
        return null;

      case 'done':
        if (/저장/.test(q)) return await _msgSaved();
        if (/문구/.test(q)) return await _msgDone(true);
        if (/템플릿 바꾸/.test(q)) return await _msgTemplate(false);
        return null;

      case 'saved':
        if (/작업실/.test(q)) { _openWorkshop(); var t = { text: '작업실을 열었어요. 방금 만든 카드가 슬롯에 들어있어요.' }; exit(); return t; }
        if (/다른 사진/.test(q)) { var keepCust = S.customer; S = _fresh(); S.active = true; S.customer = keepCust; S.step = 'await_photo'; return { text: '좋아요, 다음 사진을 보내주세요.' }; }
        return null;

      default:
        return null;
    }
  }

  // ── 보조 동작 ──
  function _assignBaRoles(swap) {
    if (S.photos.length < 2) return;
    S.photos[0].role = swap ? 'after' : 'before';
    S.photos[1].role = swap ? 'before' : 'after';
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
    var url = (S.result && S.result.afterUrl) || (S.photos[0] && S.photos[0].url);
    S.result = Object.assign(S.result || {}, { composedUrl: url });
    var capLine = S.caption ? ('"' + S.caption.split('\n')[0] + '"') : '문구를 준비했어요.';
    return { text: '보정 완성본이에요. 문구도 **사장님 말투로** 써뒀어요.',
      photo_result: { dataUrl: url, ratio: '4:5' }, photo_caption: capLine,
      related: ['이대로 저장', '문구 다시 써줘'] };
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
    try { if (typeof window.showTab === 'function') window.showTab('workshop', document.querySelector('.tab-bar__fab[data-tab="workshop"]') || null); } catch (_e) { void 0; }
    try { if (typeof window.initWorkshopTab === 'function') window.initWorkshopTab(); } catch (_e) { void 0; }
  }

  window.ItdasyPhotoMode = { isActive: isActive, handlePhotos: handlePhotos, handleText: handleText, exit: exit, stepLabel: stepLabel, START_RE: START_RE };
})();
