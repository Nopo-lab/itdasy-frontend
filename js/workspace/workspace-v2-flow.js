/* Workspace V2 플로우 — 프로토타입 2~6 화면(업로드→편집/템플릿→캡션→인스타 미리보기→고객 연결).
   보이는 화면 = 프로토타입 디자인(css/workspace-v2-flow.css), 내부 동작 = 기존 함수 위임.
   진입: WorkspaceFlow.open({ slot?, startScreen?, cat?, files? }).
   기존 함수 재사용(있을 때만): PhotoEditor.open / Customer.pick / saveSlotToDB / saveToGallery /
        loadSlotsFromDB / initWorkshopTab / _fileToDataUrl / _uid / showToast / apiFetch / authHeader. */
(function () {
  'use strict';

  var SCREENS = ['upload', 'edit', 'caption', 'preview', 'connect'];
  var TITLE = { upload:'사진 업로드', edit:'편집 및 템플릿', caption:'캡션 생성', preview:'인스타 미리보기', connect:'고객 연결' };
  var CTA = { upload:{l:'다음',to:'edit'}, edit:{l:'저장하고 캡션 생성',to:'caption'}, preview:{l:'고객 연결로 이동',to:'connect'}, connect:{l:'작업실에 저장',to:'__save'} };
  var TONES = ['감성적','전문적','친근한'];
  var HASHES = ['#레이어드컷','#뷰티샵콘텐츠','#전후사진','#여신머리','#헤어스타그램','#오늘의헤어'];

  var d = null;       // draft state
  var el = null;      // flow root
  var cur = 'upload';

  function uid() { return (typeof window._uid === 'function') ? window._uid() : 'wf_' + Math.random().toString(36).slice(2); }
  function toast(m) { if (window.showToast) window.showToast(m); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]; }); }
  function fileToDataUrl(f) {
    if (typeof window._fileToDataUrl === 'function') return window._fileToDataUrl(f);
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsDataURL(f); });
  }
  function curPhoto() { var p = d.photos.filter(function (x) { return x.role !== 'exclude'; }); return (p[1] || p[0] || d.photos[0]); }
  function photoUrl(p) { return p ? (p.editedDataUrl || p.dataUrl) : ''; }

  /* ── 화면 마크업 ── */
  function shell() {
    return '' +
      '<div class="wsv2flow__bar">' +
        '<button type="button" class="wsv2flow__back" data-fl="back" aria-label="뒤로"><i class="ph-duotone ph-caret-left"></i></button>' +
        '<div class="wsv2flow__title" data-fl-title>사진 업로드</div>' +
        '<span class="wsv2flow__step" data-fl-step></span>' +
      '</div>' +
      '<div class="wsv2flow__progress">' + '<i class="seg"></i><i class="seg"></i><i class="seg"></i><i class="seg"></i><i class="seg"></i>' + '</div>' +
      '<div class="wsv2flow__screens">' +
        '<section class="wsv2flow__s" data-fs="upload"></section>' +
        '<section class="wsv2flow__s" data-fs="edit"></section>' +
        '<section class="wsv2flow__s" data-fs="caption"></section>' +
        '<section class="wsv2flow__s" data-fs="preview"></section>' +
        '<section class="wsv2flow__s" data-fs="connect"></section>' +
      '</div>' +
      '<footer class="wsv2flow__actionbar"><button class="wsv2flow__cta" data-fl="cta">다음</button></footer>' +
      '<input type="file" accept="image/*" multiple data-fl-file hidden>';
  }

  function renderUpload() {
    var tiles = d.photos.map(function (p, i) {
      var tag = '홍보컷', cls = '';
      if (d.baMode && p.role === 'before') { tag = '전 Before'; cls = 'before'; }
      else if (d.baMode && p.role === 'after') { tag = '후 After'; cls = 'after'; }
      return '<div class="photo-tile selected" style="background-image:url(' + esc(p.dataUrl) + ')" data-fl-tile="' + i + '">' +
        '<button class="thumb-x" data-fl-del="' + i + '" aria-label="삭제"><i class="ph-bold ph-x"></i></button>' +
        '<span class="thumb-tag ' + cls + '">' + tag + '</span></div>';
    }).join('');
    return '' +
      '<div class="up-drop" data-fl-pick>' +
        '<span class="up-cloud"><i class="ph-duotone ph-cloud-arrow-up"></i></span>' +
        '<b>사진을 눌러 업로드</b><span class="up-note">JPG · PNG · 여러 장 선택 가능</span>' +
      '</div>' +
      '<div class="up-toggle-row">' +
        '<div class="up-toggle-copy"><b>전/후 사진으로 만들기</b><span>사진 순서대로 전·후를 자동 표시해요.</span></div>' +
        '<button class="ui-toggle' + (d.baMode ? ' on' : '') + '" data-fl="batoggle" role="switch" aria-checked="' + d.baMode + '"></button>' +
      '</div>' +
      '<div class="up-section">선택한 사진 <b>' + d.photos.length + '</b>장</div>' +
      '<div class="upload-grid">' + tiles +
        '<div class="grid-add" data-fl-pick><i class="ph-bold ph-plus"></i><span>추가</span></div>' +
      '</div>';
  }

  function renderEdit() {
    var url = photoUrl(curPhoto());
    var tabs = [['기본','ph-sliders-horizontal',1],['피부','ph-user',0],['머릿결','ph-wind',0],['배경','ph-image',0],['고급','ph-faders',0]];
    var tools = [['밝기','ph-sun',1],['선명도','ph-lightning',0],['색감','ph-palette',0],['윤기','ph-drop',0],['대비','ph-circle-half',0],['채도','ph-sparkle',0]];
    var chips = ['전체','전후','시술 자랑','고객 후기','이벤트'];
    return '' +
      '<div class="ed-photo" data-fl-edphoto style="background-image:url(' + esc(url) + ');filter:' + filterCss(d.filter) + '"></div>' +
      '<div class="ed-panel">' +
        '<div class="ed-tabs">' + tabs.map(function (t) { return '<div class="ed-tab' + (t[2] ? ' on' : '') + '" data-fl-edtab><i class="ph-duotone ' + t[1] + '"></i>' + t[0] + '</div>'; }).join('') + '</div>' +
        '<div class="ed-tools">' + tools.map(function (t) { return '<div class="ed-tool' + (t[2] ? ' on' : '') + '" data-fl-edtool><span class="ed-circle"><i class="ph-duotone ' + t[1] + '"></i></span>' + t[0] + '</div>'; }).join('') + '</div>' +
        '<div class="ed-slider"><span>보정 강도</span><input type="range" min="0" max="100" value="' + d.filter + '" data-fl-range><span class="ed-val" data-fl-rangeval>+' + d.filter + '</span></div>' +
      '</div>' +
      '<button type="button" class="ed-precise" data-fl="precise"><i class="ph-duotone ph-magic-wand"></i>정밀 편집 (누끼·보정·로고)</button>' +
      '<div class="tpl-head">템플릿 선택</div>' +
      '<div class="tpl-chips">' + chips.map(function (c, i) { return '<span class="tpl-chip' + ((d.tplCat ? d.tplCat === c : i === 0) ? ' on' : '') + '" data-fl-tplchip>' + esc(c) + '</span>'; }).join('') + '</div>' +
      '<div class="tpl-grid2">' + ['Clean Beige','Lash Anew','Glow White','Event Soft','Salon Warm','Before After'].map(function (n, i) {
        return '<div class="tpl-item' + (d.template === n ? ' on' : (d.template == null && i === 0 ? ' on' : '')) + '" data-fl-tpl="' + esc(n) + '"' + (photoUrl(curPhoto()) ? ' style="background-image:url(' + esc(photoUrl(curPhoto())) + ')"' : '') + '><span>' + esc(n) + '</span></div>';
      }).join('') + '</div>';
  }

  function renderCaption() {
    var url = photoUrl(curPhoto());
    var hashHtml = HASHES.map(function (h) { return '<button class="hash-chip' + (d.hashtags.indexOf(h) >= 0 ? ' on' : '') + '" data-fl-hash="' + esc(h) + '">' + esc(h) + '</button>'; }).join('');
    var toneHtml = TONES.map(function (t) { return '<button class="chip' + (d.tone === t ? ' active' : '') + '" data-fl-tone="' + esc(t) + '">' + esc(t) + '</button>'; }).join('');
    return '' +
      '<div class="seg"><button class="seg-btn on" data-fl-seg="rec">추천 캡션</button><button class="seg-btn" data-fl-seg="write">직접 작성</button></div>' +
      '<input class="service-input" data-fl-service value="' + esc(d.service) + '" placeholder="시술 내역 (예: 레이어드컷, 자연스러운 볼륨)">' +
      '<div class="cap-card">' +
        '<div class="cap-photo" style="background-image:url(' + esc(url) + ')"><span class="cap-pill"><i class="ph-duotone ph-tag"></i><span data-fl-capsvc>' + esc((d.service || '시술').split(',')[0]) + '</span></span></div>' +
        '<div class="cap-text"><p data-fl-capbody>' + esc(d.caption || '') + '</p>' +
          '<div class="cap-hash" data-fl-caphash>' + esc(d.hashtags.join(' ')) + '</div>' +
          '<span class="cap-count"><span data-fl-capcount>' + (d.caption || '').length + '</span>/200</span></div>' +
      '</div>' +
      '<div class="cust-row"><b>해시태그 제안</b></div>' +
      '<div class="hash-chips">' + hashHtml + '</div>' +
      '<div class="cust-row"><b>말투</b></div>' +
      '<div class="cap-tone">' + toneHtml + '</div>' +
      '<div class="cap-actions"><button class="cap-redo" data-fl="regen">문구 다시</button><button class="cap-preview" data-fl="topreview">미리보기</button></div>';
  }

  function renderPreview() {
    var url = photoUrl(curPhoto());
    return '' +
      '<div class="ig-notice"><span class="ig-info">i</span>업로드 전, 실제 피드에서 보이는 모습을 확인해보세요. (실제 업로드 아님)</div>' +
      '<div class="ig-card2">' +
        '<div class="ig-head2"><span class="ig-logo">Salon<br>Dearly</span><span class="ig-name2">Salon Dearly</span><span class="ig-loc">우리샵</span></div>' +
        '<div class="ig-photo" style="background-image:url(' + esc(url) + ')"></div>' +
        '<div class="ig-act"><div class="ig-ic"><i class="ph-duotone ph-heart"></i><i class="ph-duotone ph-chat-circle"></i><i class="ph-duotone ph-paper-plane-tilt"></i></div><div class="ig-save"><i class="ph-duotone ph-bookmark-simple"></i></div></div>' +
        '<div class="ig-copy2"><b>our_salon</b> <span data-fl-igcap>' + esc(d.caption || '') + '</span><br><span class="ig-hash">' + esc(d.hashtags.join(' ')) + '</span><div class="ig-ago">방금 전 · 업로드 아님</div></div>' +
      '</div>';
  }

  function renderConnect() {
    var linked = d.customerName
      ? '<div class="linked-main"><span class="cust-avatar"></span><div><b>' + esc(d.customerName) + '</b> 고객과 연결됨<span>오늘 사진·캡션을 이 고객 기록에 저장해요.</span></div></div>'
      : '<div class="linked-main"><span class="cust-avatar"></span><div><b>아직 미연결</b><span>고객을 연결하면 시술 기록이 함께 남아요.</span></div></div>';
    return '' +
      '<div class="screen-head"><h2>고객을 연결해 주세요</h2><p>연결하면 작업실에 저장되고, 시술 기록이 함께 남아요.</p></div>' +
      '<div class="cust-search"><i class="ph-duotone ph-magnifying-glass"></i><input data-fl-custsearch placeholder="이름, 전화번호 검색 후 선택"></div>' +
      '<div class="cust-row"><b>고객</b><a data-fl="pickcust">고객 선택 ›</a></div>' +
      '<div class="linked-card"><div class="linked-title"><i class="ph-duotone ph-heart"></i> 연결된 고객</div>' + linked +
        '<div class="linked-actions"><button class="lk-btn pink" data-fl="pickcust">+ 고객 선택/등록</button><button class="lk-btn" data-fl="skipcust">연결 없이 진행</button></div></div>';
  }

  var RENDER = { upload:renderUpload, edit:renderEdit, caption:renderCaption, preview:renderPreview, connect:renderConnect };

  function filterCss(v) { var b = 1 + (v - 50) / 250, c = 1 + (v - 50) / 220, s = 1 + (v - 50) / 260; return 'brightness(' + b + ') contrast(' + c + ') saturate(' + s + ')'; }

  /* ── 라우팅 ── */
  function setScreen(name) {
    cur = name;
    var to = SCREENS.indexOf(name);
    el.querySelectorAll('.wsv2flow__s').forEach(function (s) {
      var i = SCREENS.indexOf(s.dataset.fs);
      var on = s.dataset.fs === name;
      if (on) s.innerHTML = RENDER[name]();
      s.classList.toggle('active', on);
      s.classList.toggle('prev', !on && i < to);
    });
    el.querySelector('[data-fl-title]').textContent = TITLE[name];
    el.querySelector('[data-fl-step]').textContent = (to + 1) + ' / 5';
    el.querySelectorAll('.wsv2flow__progress .seg').forEach(function (sg, i) { sg.classList.toggle('done', i <= to); });
    var bar = el.querySelector('.wsv2flow__actionbar'), cta = el.querySelector('[data-fl="cta"]');
    if (CTA[name]) { bar.classList.remove('hidden'); cta.textContent = CTA[name].l; } else bar.classList.add('hidden');
    var act = el.querySelector('.wsv2flow__s.active'); if (act) act.scrollTop = 0;
  }

  function genCaption() {
    var svc = (d.service || '').split(',')[0].trim() || '레이어드컷';
    var pool = {
      '전문적': svc + ' 시술로 움직임과 볼륨감을 살렸어요. 얼굴형과 결을 함께 보며 손질이 쉬운 실루엣으로 정리했습니다.',
      '감성적': svc + ', 오늘 분위기를 바꾸는 작은 차이 ✨ 가볍지만 선명한 라인으로 더 부드러운 인상을 완성했어요.',
      '친근한': svc + ' 하고 나면 손질이 훨씬 쉬워져요 😊 아침에 드라이 오래 안 해도 자연스럽게 볼륨이 살아나요.'
    };
    d.caption = pool[d.tone] || pool['전문적'];
    if (!d.hashtags.length) d.hashtags = HASHES.slice(0, 3);
  }

  /* ── 이벤트 ── */
  function bind() {
    el.addEventListener('click', function (e) {
      var t = e.target;
      var act = t.closest('[data-fl]'); var a = act && act.getAttribute('data-fl');
      if (a === 'back') { return back(); }
      if (a === 'cta') { return onCta(); }
      if (a === 'batoggle') { d.baMode = !d.baMode; reassignRoles(); setScreen('upload'); return; }
      if (a === 'precise') { return openPrecise(); }
      if (a === 'regen') { d.tone = TONES[(TONES.indexOf(d.tone) + 1) % 3]; genCaption(); setScreen('caption'); toast('기존 사진 맥락으로 캡션을 다시 생성했어요.'); return; }
      if (a === 'topreview') { syncCaptionFromDom(); setScreen('preview'); return; }
      if (a === 'pickcust') { return pickCustomer(); }
      if (a === 'skipcust') { d.customerId = null; d.customerName = ''; return save(); }

      if (t.closest('[data-fl-pick]')) { el.querySelector('[data-fl-file]').click(); return; }
      var del = t.closest('[data-fl-del]'); if (del) { e.stopPropagation(); d.photos.splice(+del.getAttribute('data-fl-del'), 1); reassignRoles(); setScreen('upload'); return; }
      var edtab = t.closest('[data-fl-edtab]'); if (edtab) { el.querySelectorAll('[data-fl-edtab]').forEach(function (x) { x.classList.remove('on'); }); edtab.classList.add('on'); return; }
      var edtool = t.closest('[data-fl-edtool]'); if (edtool) { el.querySelectorAll('[data-fl-edtool]').forEach(function (x) { x.classList.remove('on'); }); edtool.classList.add('on'); toast(edtool.textContent.trim() + ' 조정'); return; }
      var tplchip = t.closest('[data-fl-tplchip]'); if (tplchip) { el.querySelectorAll('[data-fl-tplchip]').forEach(function (x) { x.classList.remove('on'); }); tplchip.classList.add('on'); d.tplCat = tplchip.textContent.trim(); return; }
      var tpl = t.closest('[data-fl-tpl]'); if (tpl) { d.template = tpl.getAttribute('data-fl-tpl'); el.querySelectorAll('[data-fl-tpl]').forEach(function (x) { x.classList.remove('on'); }); tpl.classList.add('on'); toast("'" + d.template + "' 템플릿 적용"); return; }
      var hash = t.closest('[data-fl-hash]'); if (hash) { var h = hash.getAttribute('data-fl-hash'); var k = d.hashtags.indexOf(h); if (k >= 0) d.hashtags.splice(k, 1); else d.hashtags.push(h); hash.classList.toggle('on'); var ch = el.querySelector('[data-fl-caphash]'); if (ch) ch.textContent = d.hashtags.join(' '); return; }
      var tone = t.closest('[data-fl-tone]'); if (tone) { d.tone = tone.getAttribute('data-fl-tone'); genCaption(); setScreen('caption'); return; }
      var seg = t.closest('[data-fl-seg]'); if (seg) { el.querySelectorAll('[data-fl-seg]').forEach(function (x) { x.classList.remove('on'); }); seg.classList.add('on'); var body = el.querySelector('[data-fl-capbody]'); if (body) { var w = seg.getAttribute('data-fl-seg') === 'write'; body.contentEditable = w ? 'true' : 'false'; if (w) body.focus(); } return; }
    });
    el.querySelector('[data-fl-file]').addEventListener('change', function (e) {
      var files = Array.from(e.target.files || []); e.target.value = '';
      if (!files.length) return;
      Promise.all(files.slice(0, 10).map(fileToDataUrl)).then(function (urls) {
        urls.forEach(function (u) { d.photos.push({ id: uid(), dataUrl: u, role: 'hero' }); });
        reassignRoles(); setScreen('upload'); toast(urls.length + '장 추가됨');
      });
    });
    el.addEventListener('input', function (e) {
      if (e.target.matches('[data-fl-range]')) { d.filter = +e.target.value; var p = el.querySelector('[data-fl-edphoto]'); if (p) p.style.filter = filterCss(d.filter); var v = el.querySelector('[data-fl-rangeval]'); if (v) v.textContent = '+' + d.filter; }
      if (e.target.matches('[data-fl-service]')) { d.service = e.target.value; }
      if (e.target.matches('[data-fl-custsearch]')) { d.custQuery = e.target.value; }
    });
  }

  function reassignRoles() {
    d.photos.forEach(function (p, i) {
      if (d.baMode && i === 0) p.role = 'before';
      else if (d.baMode && i === 1) p.role = 'after';
      else p.role = 'hero';
    });
  }
  function syncCaptionFromDom() { var b = el.querySelector('[data-fl-capbody]'); if (b) d.caption = b.textContent; var ig = el.querySelector('[data-fl-igcap]'); if (ig) ig.textContent = d.caption; }

  function back() {
    var i = SCREENS.indexOf(cur);
    if (i > 0) setScreen(SCREENS[i - 1]); else close();
  }
  function onCta() {
    var c = CTA[cur]; if (!c) return;
    if (cur === 'upload' && !d.photos.length) { toast('사진을 먼저 추가해 주세요.'); return; }
    if (cur === 'edit' && !d.caption) genCaption();
    if (c.to === '__save') return save();
    if (cur === 'caption') syncCaptionFromDom();
    setScreen(c.to);
  }

  function openPrecise() {
    var p = curPhoto();
    if (p && window.PhotoEditor && typeof window.PhotoEditor.open === 'function') {
      window.PhotoEditor.open({ src: photoUrl(p) });
    } else { toast('정밀 편집기를 불러오지 못했어요'); }
  }

  function pickCustomer() {
    if (window.Customer && typeof window.Customer.pick === 'function') {
      Promise.resolve(window.Customer.pick({ selectedId: d.customerId })).then(function (picked) {
        if (!picked) return;
        d.customerId = picked.id; d.customerName = picked.name; setScreen('connect');
        toast(picked.name + ' 고객과 연결했어요.');
      });
    } else { toast('고객 모듈이 아직 로드되지 않았어요'); }
  }

  function save() {
    var slot = d.slot || { id: uid(), order: 0, createdAt: Date.now() };
    slot.label = d.customerName || slot.label || (d.service ? d.service.split(',')[0].trim() : '새 콘텐츠');
    slot.photos = d.photos.map(function (p) { return { id: p.id, dataUrl: p.dataUrl, editedDataUrl: p.editedDataUrl || null, role: p.role }; });
    slot.caption = d.caption || '';
    slot.hashtags = d.hashtags.join(' ');
    slot.customer_id = d.customerId || null;
    slot.customer_name = d.customerName || '';
    slot.status = 'done';
    var done = function () {
      toast(d.customerName ? (d.customerName + ' 고객 기록에 저장했어요.') : '작업실에 저장했어요.');
      close();
      if (window.WorkspaceV2 && window.WorkspaceV2.refresh) window.WorkspaceV2.refresh();
    };
    if (typeof window.saveSlotToDB === 'function') {
      Promise.resolve(window.saveSlotToDB(slot)).then(function () {
        if (typeof window.saveToGallery === 'function') { try { window.saveToGallery(slot); } catch (_e) { /* 갤러리 보조 저장 실패 무시 */ } }
        done();
      }).catch(function (e) { console.warn('[wsflow] 저장 실패', e); toast('저장에 실패했어요'); });
    } else { done(); }
  }

  /* ── open/close ── */
  function ensureEl() {
    el = document.getElementById('wsv2Flow');
    if (el) return;
    el = document.createElement('div');
    el.id = 'wsv2Flow'; el.className = 'wsv2flow';
    el.innerHTML = shell();
    document.body.appendChild(el);
    bind();
  }

  function open(opts) {
    opts = opts || {};
    ensureEl();
    var slot = opts.slot || null;
    d = {
      slot: slot,
      photos: slot && slot.photos ? slot.photos.map(function (p) { return { id: p.id || uid(), dataUrl: p.dataUrl, editedDataUrl: p.editedDataUrl, role: p.role || 'hero' }; }) : [],
      baMode: true, filter: 60, template: null, tplCat: opts.cat || null,
      service: slot && slot.service ? slot.service : '', caption: slot ? (slot.caption || '') : '', hashtags: slot && slot.hashtags ? String(slot.hashtags).split(/\s+/).filter(Boolean) : [],
      tone: '전문적', customerId: slot ? (slot.customer_id || null) : null, customerName: slot ? (slot.customer_name || '') : '', custQuery: ''
    };
    if (d.photos.length) reassignRoles();
    if (!d.caption && (opts.startScreen === 'caption' || opts.startScreen === 'preview')) genCaption();
    el.classList.add('is-open');
    setScreen(opts.startScreen && SCREENS.indexOf(opts.startScreen) >= 0 ? opts.startScreen : 'upload');
  }
  function close() { if (el) el.classList.remove('is-open'); }

  window.WorkspaceFlow = { open: open, close: close };
})();
