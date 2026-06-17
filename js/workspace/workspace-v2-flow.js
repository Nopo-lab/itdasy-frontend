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
  var HASHES = ['#레이어드컷','#뷰티샵콘텐츠','#전후사진','#여신머리','#헤어스타그램','#오늘의헤어'];
  // 카테고리 컨텍스트 (전후/시술자랑/후기/이벤트). 가격표는 홈에서 openPriceList 로 분리.
  var CAT_CTX = {
    ba:     { purpose: 'before_after', captionMode: 'normal', role: 'auto', tplLabel: '전후' },
    flex:   { purpose: 'feed',         captionMode: 'normal', role: 'hero', tplLabel: '시술 자랑' },
    review: { purpose: 'review',       captionMode: 'review', role: 'hero', tplLabel: '고객 후기' },
    event:  { purpose: 'event',        captionMode: 'normal', role: 'hero', tplLabel: '이벤트' }
  };
  // 카테고리/목적별 추천 크롭 비율
  var CROP_RATIO = { before_after: '4:5', feed: '4:5', review: '4:5', event: '1:1', price: 'free' };
  // tplPurpose → workspaceContext.type (시술자랑 feed → promo)
  var TYPE_MAP = { before_after: 'before_after', feed: 'promo', review: 'review', event: 'event', price: 'price' };
  // [Phase 5-1 P0] V2 편집 인플레이스 컨트롤 — 탭/컨트롤 정의 (PhotoEditor 라우팅 없음, 경량 보정)
  var EDIT_TABS = [
    { k: 'basic', label: '기본', ic: 'ph-sliders-horizontal', controls: [
      { k: 'brightness', l: '밝기', ic: 'ph-sun' }, { k: 'sharpness', l: '선명도', ic: 'ph-lightning' }, { k: 'color', l: '색감', ic: 'ph-palette' },
      { k: 'glow', l: '윤기', ic: 'ph-drop' }, { k: 'contrast', l: '대비', ic: 'ph-circle-half' }, { k: 'saturation', l: '채도', ic: 'ph-sparkle' } ] },
    { k: 'skin', label: '피부', ic: 'ph-user', controls: [
      { k: 'skinTone', l: '피부톤', ic: 'ph-eyedropper' }, { k: 'blemish', l: '잡티', ic: 'ph-drop-half' }, { k: 'smooth', l: '매끈함', ic: 'ph-wave-sine' },
      { k: 'redness', l: '붉은기', ic: 'ph-thermometer-simple' }, { k: 'radiance', l: '광채', ic: 'ph-sun-dim' } ] },
    { k: 'hair', label: '머릿결', ic: 'ph-wind', controls: [
      { k: 'hairGloss', l: '윤기', ic: 'ph-drop' }, { k: 'hairCalm', l: '차분함', ic: 'ph-wave-sine' }, { k: 'hairVolume', l: '볼륨', ic: 'ph-arrows-out-line-vertical' },
      { k: 'hairSharp', l: '선명도', ic: 'ph-lightning' }, { k: 'hairTidy', l: '결 정리', ic: 'ph-broom' } ] },
    { k: 'background', label: '배경', ic: 'ph-image', controls: [] },
    { k: 'advanced', label: '고급', ic: 'ph-faders', controls: [] },
  ];
  function newAdjust() { return { brightness:0, sharpness:0, color:0, glow:0, contrast:0, saturation:0, skinTone:0, blemish:0, smooth:0, redness:0, radiance:0, hairGloss:0, hairCalm:0, hairVolume:0, hairSharp:0, hairTidy:0 }; }
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
        '<b>사진을 드래그하거나 여기를 눌러 업로드</b><span class="up-note">JPG · PNG 최대 20MB · 여러 장 선택 가능</span>' +
      '</div>' +
      '<div class="up-toggle-row">' +
        '<div class="up-toggle-copy"><b>전/후 사진으로 만들기</b><span>사진 순서대로 전·후를 자동으로 표시해요.</span></div>' +
        '<button class="ui-toggle' + (d.baMode ? ' on' : '') + '" data-fl="batoggle" role="switch" aria-checked="' + d.baMode + '"></button>' +
      '</div>' +
      '<div class="up-section">선택한 사진 <b>' + d.photos.length + '</b> / 10</div>' +
      '<div class="upload-grid">' + tiles +
        '<div class="grid-add" data-fl-pick><i class="ph-bold ph-plus"></i><span>추가</span></div>' +
      '</div>';
  }

  function renderEdit() {
    var url = photoUrl(curPhoto());
    var tab = d.editTab || 'basic';
    var tabObj = EDIT_TABS.filter(function (t) { return t.k === tab; })[0] || EDIT_TABS[0];
    var preview = d.originalPreview ? 'none' : filterCss(d.adjust);
    var tabsHtml = EDIT_TABS.map(function (t) {
      return '<div class="ed-tab' + (t.k === tab ? ' on' : '') + '" data-fl-edtab="' + t.k + '"><i class="ph-duotone ' + t.ic + '"></i>' + t.label + '</div>';
    }).join('');

    var panel = '';
    if (tabObj.controls.length) {
      var ctrls = tabObj.controls;
      var active = d.control && ctrls.some(function (c) { return c.k === d.control; }) ? d.control : ctrls[0].k;
      var actObj = ctrls.filter(function (c) { return c.k === active; })[0];
      var val = (d.adjust && d.adjust[active]) || 0;
      panel =
        '<div class="ed-tools">' + ctrls.map(function (c) {
          return '<div class="ed-tool' + (c.k === active ? ' on' : '') + '" data-fl-edtool="' + c.k + '"><span class="ed-circle"><i class="ph-duotone ' + c.ic + '"></i></span>' + c.l + '</div>';
        }).join('') + '</div>' +
        '<div class="ed-slider"><span>' + esc(actObj.l) + '</span><input type="range" min="-100" max="100" value="' + val + '" data-fl-range="' + active + '"><span class="ed-val" data-fl-rangeval>' + (val > 0 ? '+' : '') + val + '</span></div>';
    } else if (tab === 'background') {
      var bgcur = d.bgAction || '';
      panel =
        '<div class="ed-bg">' +
          '<button type="button" class="ed-bg__btn' + (bgcur === 'removeBg' ? ' on' : '') + '" data-fl-bg="removeBg"><i class="ph-duotone ph-scissors"></i>누끼 / 배경 제거</button>' +
          '<button type="button" class="ed-bg__btn' + (bgcur === 'blur' ? ' on' : '') + '" data-fl-bg="blur"><i class="ph-duotone ph-drop-half"></i>배경 흐림</button>' +
          '<div class="ed-bg__colors">' + ['#ffffff', '#fbeaef', '#eaf3fc', '#f3efe7', '#1f1b18'].map(function (c) {
            return '<button type="button" class="ed-bg__color' + (d.bgColor === c ? ' on' : '') + '" data-fl-bgcolor="' + c + '" style="background:' + c + '"></button>';
          }).join('') + '</div>' +
          '<div class="ed-bg__status" data-fl-bgstatus>' + (d.bgBusy ? '배경 처리 중…' : (d.bgAction ? '적용됨' : '배경 옵션을 선택하세요')) + '</div>' +
        '</div>';
    } else { // advanced
      panel =
        '<div class="ed-adv">' +
          '<button type="button" class="ed-adv__btn" data-fl="crop"><i class="ph-duotone ph-crop"></i>비율 자르기 (1:1·4:5·9:16·자유)</button>' +
          '<button type="button" class="ed-adv__btn" data-fl-eb="비교"><i class="ph-duotone ph-columns"></i>원본/보정 비교</button>' +
          '<button type="button" class="ed-adv__btn" data-fl="roles"><i class="ph-duotone ph-images"></i>역할 확인 (' + esc(_roleSummary()) + ')</button>' +
          '<button type="button" class="ed-adv__btn" data-fl-eb="초기화"><i class="ph-duotone ph-arrows-clockwise"></i>전체 초기화</button>' +
        '</div>';
    }

    var chips = ['전체', '전후', '시술 자랑', '고객 후기', '이벤트'];
    return '' +
      '<div class="ed-photo" data-fl-edphoto style="background-image:url(' + esc(url) + ');filter:' + preview + '"></div>' +
      '<div class="ed-panel">' +
        '<div class="ed-tabs">' + tabsHtml + '</div>' +
        panel +
      '</div>' +
      '<div class="ed-bottom">' +
        '<div class="eb' + (d.undo && d.undo.length ? '' : ' disabled') + '" data-fl-eb="되돌리기"><i class="ph-duotone ph-arrow-counter-clockwise"></i>되돌리기</div>' +
        '<div class="eb' + (d.redo && d.redo.length ? '' : ' disabled') + '" data-fl-eb="다시실행"><i class="ph-duotone ph-arrow-clockwise"></i>다시실행</div>' +
        '<div class="eb' + (d.originalPreview ? ' active' : '') + '" data-fl-eb="비교"><span class="activebox"><i class="ph-duotone ph-columns"></i></span>비교</div>' +
        '<div class="eb" data-fl-eb="원본보기"><i class="ph-duotone ph-eye"></i>원본보기</div>' +
        '<div class="eb" data-fl-eb="초기화"><i class="ph-duotone ph-arrows-clockwise"></i>초기화</div>' +
      '</div>' +
      '<div class="tpl-head">템플릿 선택</div>' +
      '<div class="tpl-chips">' + chips.map(function (c, i) { return '<span class="tpl-chip' + ((d.tplCat ? d.tplCat === c : i === 0) ? ' on' : '') + '" data-fl-tplchip>' + esc(c) + '</span>'; }).join('') + '</div>' +
      '<div class="tpl-grid2">' + ['Clean Beige', 'Lash Anew', 'Glow White', 'Event Soft', 'Salon Warm', 'Before After'].map(function (n, i) {
        return '<div class="tpl-item' + (d.template === n ? ' on' : (d.template == null && i === 0 ? ' on' : '')) + '" data-fl-tpl="' + esc(n) + '"' + (photoUrl(curPhoto()) ? ' style="background-image:url(' + esc(photoUrl(curPhoto())) + ')"' : '') + '></div>';
      }).join('') + '</div>' +
      (d.template ? '<div class="tpl-picked">선택: ' + esc(d.template) + '</div>' : '');
  }

  function _roleSummary() {
    var r = {};
    (d.photos || []).forEach(function (p) { r[p.role || 'hero'] = (r[p.role || 'hero'] || 0) + 1; });
    return Object.keys(r).map(function (k) { return ({ before: '전', after: '후', hero: '홍보컷', exclude: '제외' }[k] || k) + ' ' + r[k]; }).join(' · ') || '없음';
  }

  function renderCaption() {
    var url = photoUrl(curPhoto());
    var hashHtml = (d.hashtags.length ? d.hashtags : HASHES).map(function (h) { return '<button class="hash-chip' + (d.hashtags.indexOf(h) >= 0 ? ' on' : '') + '" data-fl-hash="' + esc(h) + '">' + esc(h) + '</button>'; }).join('');
    var vars = [{ k: 'long', l: '더 길게' }, { k: 'review', l: '후기체' }, { k: 'instagram', l: '인스타스럽게' }];
    var varHtml = vars.map(function (v) { return '<button class="chip" data-fl-var="' + v.k + '">' + esc(v.l) + '</button>'; }).join('');
    var body = d.capLoading ? 'AI 가 캡션을 쓰는 중…' : (d.caption || '아직 캡션이 없어요. 시술 내역을 입력하고 “AI 캡션 생성”을 눌러주세요.');
    var hasCap = !!d.caption;
    return '' +
      '<div class="seg"><button class="seg-btn on" data-fl-seg="rec">추천 캡션</button><button class="seg-btn" data-fl-seg="write">직접 작성</button></div>' +
      '<input class="service-input" data-fl-service value="' + esc(d.service) + '" placeholder="시술 내역 (예: 레이어드컷, 자연스러운 볼륨)">' +
      '<div class="cap-card">' +
        '<div class="cap-photo" style="background-image:url(' + esc(url) + ')"><span class="cap-pill"><i class="ph-duotone ph-tag"></i><span data-fl-capsvc>' + esc((d.service || '시술').split(',')[0]) + '</span></span></div>' +
        '<div class="cap-text"><p data-fl-capbody' + (hasCap && !d.capLoading ? '' : ' style="color:#9a8d86"') + '>' + esc(body) + '</p>' +
          '<div class="cap-hash" data-fl-caphash>' + esc(d.hashtags.join(' ')) + '</div>' +
          '<span class="cap-count"><span data-fl-capcount>' + (d.caption || '').length + '</span>/200</span></div>' +
      '</div>' +
      (hasCap
        ? '<div class="cust-row"><b>해시태그 제안</b><a data-fl="morehash">새로고침 ›</a></div>' +
          '<div class="hash-chips">' + hashHtml + '</div>' +
          '<div class="cust-row"><b>다시 쓰기</b></div>' +
          '<div class="cap-tone">' + varHtml + '</div>' +
          '<div class="cap-actions"><button class="cap-redo" data-fl="regen">문구 다시</button><button class="cap-preview" data-fl="topreview">미리보기</button></div>'
        : '<button class="cap-preview" style="width:100%" data-fl="gen">' + (d.capLoading ? '생성 중…' : 'AI 캡션 생성') + '</button>');
  }

  function renderPreview() {
    var url = photoUrl(curPhoto());
    return '' +
      '<div class="ig-notice"><span class="ig-info">i</span>업로드 전, 실제 피드에서 보이는 모습을 확인해보세요.</div>' +
      '<div class="ig-card2">' +
        '<div class="ig-head2"><span class="ig-logo">Salon<br>Dearly</span><span class="ig-name2">Salon Dearly</span><span class="ig-loc">청담점</span><span class="ig-dots2">···</span></div>' +
        '<div class="ig-photo" style="background-image:url(' + esc(url) + ')"></div>' +
        '<div class="ig-act"><div class="ig-ic"><i class="ph-duotone ph-heart"></i><i class="ph-duotone ph-chat-circle"></i><i class="ph-duotone ph-paper-plane-tilt"></i></div>' +
          '<div class="ig-pager"><span class="d on"></span><span class="d"></span><span class="d"></span><span class="d"></span></div>' +
          '<div class="ig-save"><i class="ph-duotone ph-bookmark-simple"></i></div></div>' +
        '<div class="ig-copy2"><b>salondearly_official</b> <span data-fl-igcap>' + esc(d.caption || '') + '</span><br><span class="ig-hash">' + esc(d.hashtags.join(' ')) + '</span><div class="ig-ago">1분 전</div></div>' +
      '</div>' +
      '<button type="button" class="ig-preview-btn" data-fl="sharepreview">공유 전 미리보기</button>' +
      _publishBlock();
  }

  // 인스타 업로드 게이트 — 연결됐을 때만 실제 업로드, 아니면 준비/연결/복사/저장 (업로드 완료처럼 속이지 않음)
  function _publishBlock() {
    var connected = window.WorkspaceAdapter ? window.WorkspaceAdapter.instagram().connected : false;
    if (connected) {
      return '<button type="button" class="cap-preview" style="width:100%;margin-top:10px" data-fl="publish">인스타그램에 올리기</button>';
    }
    return '<div class="wsflow-prep">' +
      '<div class="wsflow-prep__note">인스타 계정이 연결되지 않아 바로 업로드할 수 없어요. 준비만 해둘게요.</div>' +
      '<div class="wsflow-prep__row">' +
        '<button type="button" data-fl="copycap">캡션 복사</button>' +
        '<button type="button" data-fl="saveimg">이미지 저장</button>' +
        '<button type="button" class="pink" data-fl="igconnect">인스타 연결</button>' +
      '</div></div>';
  }

  function renderConnect() {
    var recent = d.recent || [];
    var listHtml;
    if (recent.length) {
      listHtml = recent.map(function (c) {
        var sel = String(d.customerId) === String(c.id);
        return '<div class="cust-card' + (sel ? ' selected' : '') + '" data-fl-cust="' + esc(c.n) + '" data-fl-custid="' + esc(c.id) + '">' +
          '<span class="cust-avatar"></span>' +
          '<div class="cust-info"><h3>' + esc(c.n) + '</h3>' + (c.p ? '<p>' + esc(c.p) + '</p>' : '') + '</div>' +
          '<span class="cust-pick"><i class="ph-bold ' + (sel ? 'ph-check' : 'ph-plus') + '"></i></span></div>';
      }).join('');
    } else {
      listHtml = '<div class="cust-empty">' + (d.recentLoaded ? '최근 연결한 고객이 아직 없어요.<br>아래에서 고객을 선택/등록해 주세요.' : '불러오는 중…') + '</div>';
    }
    var linkedName = d.customerName || '';
    return '' +
      '<div class="screen-head"><h2>고객을 선택하거나<br>새로 연결해 주세요</h2><p>연결하면 작업실에 자동 저장되고, 시술 기록이 함께 남아요.</p></div>' +
      '<div class="cust-search"><i class="ph-duotone ph-magnifying-glass"></i><input data-fl-custsearch placeholder="이름, 전화번호 검색"></div>' +
      '<div class="cust-row"><b>최근 고객</b><a data-fl="pickcust">더보기 ›</a></div>' +
      '<div data-fl-custlist>' + listHtml + '</div>' +
      '<div class="linked-card"><div class="linked-title"><i class="ph-duotone ph-heart"></i> 연결된 고객</div>' +
        '<div class="linked-main"><span class="cust-avatar"></span><div><b>' + esc(linkedName || '고객 미선택') + '</b>' + (linkedName ? ' 고객과 연결됨' : '') + '<span>오늘 촬영한 전/후 사진과 캡션을 이 고객 기록에 저장해요.</span></div></div>' +
        '<div class="linked-actions"><button class="lk-btn pink" data-fl="pickcust">+ 새 고객 등록</button><button class="lk-btn" data-fl="skipcust">연결 없이 진행</button></div></div>';
  }

  var RENDER = { upload:renderUpload, edit:renderEdit, caption:renderCaption, preview:renderPreview, connect:renderConnect };

  // adjust 객체 → CSS filter (preview/bake 공용, 경량 근사)
  function filterCss(a) {
    a = a || {};
    var bright = 1 + ((a.brightness || 0) + (a.radiance || 0) * 0.5 + (a.glow || 0) * 0.4) / 220;
    var contr = 1 + ((a.contrast || 0) + (a.sharpness || 0) * 0.6 + (a.glow || 0) * 0.3 + (a.hairGloss || 0) * 0.4 + (a.hairSharp || 0) * 0.5 + (a.hairVolume || 0) * 0.3 + (a.hairTidy || 0) * 0.3) / 240;
    var sat = 1 + ((a.saturation || 0) + (a.skinTone || 0) * 0.3 - (a.redness || 0) * 0.5 - (a.hairCalm || 0) * 0.3) / 240;
    var hue = ((a.color || 0) * 0.5 - (a.redness || 0) * 0.3) / 1;
    var blur = Math.max(0, (a.smooth || 0) + (a.blemish || 0) * 0.6) / 45;
    var sep = Math.max(0, (a.skinTone || 0)) / 320;
    return 'brightness(' + bright.toFixed(3) + ') contrast(' + contr.toFixed(3) + ') saturate(' + Math.max(0, sat).toFixed(3) + ') hue-rotate(' + hue.toFixed(1) + 'deg) blur(' + blur.toFixed(2) + 'px) sepia(' + sep.toFixed(3) + ')';
  }

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
    if (name === 'connect') loadRecent();
    if (name === 'preview' && d.publish && (d.publish.status === 'draft' || !d.publish.status)) d.publish.status = 'preview_ready';
  }

  // 최근 고객 실데이터 lazy 로드 (Customer.list). 데모 데이터 없음.
  function loadRecent() {
    if (d.recentLoaded || d._recentLoading) return;
    if (!(window.WorkspaceAdapter && window.WorkspaceAdapter.recentCustomers)) { d.recentLoaded = true; return; }
    d._recentLoading = true;
    window.WorkspaceAdapter.recentCustomers(5).then(function (list) {
      d.recent = list || []; d.recentLoaded = true; d._recentLoading = false;
      if (cur === 'connect') setScreen('connect');
    });
  }

  // 실제 캡션 엔진(/persona/generate) 호출. 재업로드 없음(맥락은 photo_context 문자열).
  function doGenerate(extra, label) {
    var svc = String(d.service || '').trim();
    if (!svc) { toast('시술 내역을 먼저 입력해 주세요'); return; }
    if (!(window.WorkspaceAdapter && window.WorkspaceAdapter.generateCaption)) { toast('캡션 모듈을 불러오지 못했어요'); return; }
    d.capLoading = true; setScreen('caption');
    var opts = Object.assign({ slotId: d.slot && d.slot.id, service: svc, mode: d.captionMode || 'normal' }, extra || {});
    d.capLen = opts.length_tier || d.capLen || 'medium';
    d.capTone = opts.tone_override || d.capTone || 'normal';
    window.WorkspaceAdapter.generateCaption(opts).then(function (r) {
      d.capLoading = false;
      if (r.ok) { d.caption = r.caption; d.hashtags = (r.hashtags || []).slice(); d.logId = r.log_id || null; if (label) toast(label); }
      else { toast(r.toast || '캡션 생성에 실패했어요'); }
      setScreen('caption');
    });
  }

  /* ── 이벤트 ── */
  function bind() {
    el.addEventListener('click', function (e) {
      var t = e.target;
      var act = t.closest('[data-fl]'); var a = act && act.getAttribute('data-fl');
      if (a === 'back') { return back(); }
      if (a === 'cta') { return onCta(); }
      if (a === 'batoggle') { d.baMode = !d.baMode; reassignRoles(); setScreen('upload'); return; }
      if (a === 'gen') { return doGenerate({}, null); }
      if (a === 'regen') { return doGenerate({}, '문구를 다시 생성했어요'); }
      if (a === 'morehash') { return doGenerate({}, '해시태그를 새로 가져왔어요'); }
      if (a === 'topreview') { syncCaptionFromDom(); setScreen('preview'); return; }
      if (a === 'pickcust') { return pickCustomer(); }
      if (a === 'skipcust') { d.customerId = null; d.customerName = ''; return save(); }
      if (a === 'sharepreview') { toast('피드·스토리 비율과 캡션 줄바꿈을 확인했어요. (실제 업로드 아님)'); return; }
      if (a === 'crop') { return openCropFlow(); }
      if (a === 'roles') { toast('역할 — ' + _roleSummary()); return; }
      if (a === 'publish') { return publish(); }
      if (a === 'copycap') { window.WorkspaceAdapter && window.WorkspaceAdapter.copyText((d.caption || '') + (d.hashtags.length ? '\n\n' + d.hashtags.join(' ') : '')); _markPrepared(); return; }
      if (a === 'saveimg') { window.WorkspaceAdapter && window.WorkspaceAdapter.saveImage(photoUrl(curPhoto()), d.service || 'itdasy'); _markPrepared(); return; }
      if (a === 'igconnect') { window.WorkspaceAdapter && window.WorkspaceAdapter.connectInstagram(); return; }

      if (t.closest('[data-fl-pick]')) { el.querySelector('[data-fl-file]').click(); return; }
      var del = t.closest('[data-fl-del]'); if (del) { e.stopPropagation(); d.photos.splice(+del.getAttribute('data-fl-del'), 1); reassignRoles(); setScreen('upload'); return; }
      if (t.closest('[data-fl-edphoto]')) { return; } // 미리보기 전용 — 이동 없음
      var edtab = t.closest('[data-fl-edtab]'); if (edtab) { d.editTab = edtab.getAttribute('data-fl-edtab'); d.control = null; setScreen('edit'); return; }
      var edtool = t.closest('[data-fl-edtool]'); if (edtool) { d.control = edtool.getAttribute('data-fl-edtool'); setScreen('edit'); return; }
      var bgb = t.closest('[data-fl-bg]'); if (bgb) { return applyBg(bgb.getAttribute('data-fl-bg')); }
      var bgc = t.closest('[data-fl-bgcolor]'); if (bgc) { d.bgColor = bgc.getAttribute('data-fl-bgcolor'); return applyBg('color'); }
      var eb = t.closest('[data-fl-eb]'); if (eb) { return _editBottom(eb.getAttribute('data-fl-eb')); }
      var cust = t.closest('[data-fl-cust]'); if (cust) { d.customerId = cust.getAttribute('data-fl-custid'); d.customerName = cust.getAttribute('data-fl-cust'); setScreen('connect'); return; }
      var tplchip = t.closest('[data-fl-tplchip]'); if (tplchip) { el.querySelectorAll('[data-fl-tplchip]').forEach(function (x) { x.classList.remove('on'); }); tplchip.classList.add('on'); d.tplCat = tplchip.textContent.trim(); return; }
      var tpl = t.closest('[data-fl-tpl]'); if (tpl) { d.template = tpl.getAttribute('data-fl-tpl'); el.querySelectorAll('[data-fl-tpl]').forEach(function (x) { x.classList.remove('on'); }); tpl.classList.add('on'); toast("'" + d.template + "' 템플릿 선택"); setScreen('edit'); return; }
      var hash = t.closest('[data-fl-hash]'); if (hash) { var h = hash.getAttribute('data-fl-hash'); var k = d.hashtags.indexOf(h); if (k >= 0) d.hashtags.splice(k, 1); else d.hashtags.push(h); hash.classList.toggle('on'); var ch = el.querySelector('[data-fl-caphash]'); if (ch) ch.textContent = d.hashtags.join(' '); return; }
      var vv = t.closest('[data-fl-var]'); if (vv) { var vk = vv.getAttribute('data-fl-var'); return doGenerate(vk === 'long' ? { length_tier: 'long' } : { tone_override: vk }, '다시 생성했어요'); }
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
      if (e.target.matches('[data-fl-range]')) {
        var k = e.target.getAttribute('data-fl-range'); d.adjust[k] = +e.target.value;
        var p = el.querySelector('[data-fl-edphoto]'); if (p && !d.originalPreview) p.style.filter = filterCss(d.adjust);
        var v = el.querySelector('[data-fl-rangeval]'); if (v) v.textContent = (d.adjust[k] > 0 ? '+' : '') + d.adjust[k];
      }
      if (e.target.matches('[data-fl-service]')) { d.service = e.target.value; }
      if (e.target.matches('[data-fl-custsearch]')) { d.custQuery = e.target.value; }
    });
    // 슬라이더 조작 전후로 undo 스냅샷
    el.addEventListener('focusin', function (e) { if (e.target.matches('[data-fl-range]')) d._adjPrev = clone(d.adjust); });
    el.addEventListener('change', function (e) {
      if (e.target.matches('[data-fl-range]') && d._adjPrev) {
        d.undo = d.undo || []; d.undo.push(d._adjPrev); if (d.undo.length > 30) d.undo.shift(); d.redo = []; d._adjPrev = null;
      }
    });
  }

  function clone(o) { return JSON.parse(JSON.stringify(o || {})); }

  // 하단 액션 (전부 인플레이스 — PhotoEditor 이동 없음)
  function _editBottom(label) {
    if (label === '비교' || label === '원본보기') { d.originalPreview = !d.originalPreview; setScreen('edit'); return; }
    if (label === '되돌리기') { if (d.undo && d.undo.length) { d.redo = d.redo || []; d.redo.push(clone(d.adjust)); d.adjust = d.undo.pop(); setScreen('edit'); } return; }
    if (label === '다시실행') { if (d.redo && d.redo.length) { d.undo = d.undo || []; d.undo.push(clone(d.adjust)); d.adjust = d.redo.pop(); setScreen('edit'); } return; }
    if (label === '초기화') { if (typeof window.confirm === 'function' && !window.confirm('현재 보정을 초기화할까요?')) return; d.undo = d.undo || []; d.undo.push(clone(d.adjust)); d.adjust = newAdjust(); d.redo = []; setScreen('edit'); return; }
  }

  // 배경/누끼 — compose 엔진만 호출(어댑터), V2 화면 안에서 진행/결과 표시. PhotoEditor 안 띄움.
  function applyBg(action) {
    var photo = curPhoto();
    if (!photo) { toast('사진이 없어요'); return; }
    if (!(window.WorkspaceAdapter && window.WorkspaceAdapter.applyWorkspaceBgAction)) { toast('배경 모듈을 불러오지 못했어요'); return; }
    d.bgAction = action; d.bgBusy = true; setScreen('edit');
    window.WorkspaceAdapter.applyWorkspaceBgAction({ src: photo.editedDataUrl || photo.dataUrl, action: action, color: d.bgColor, ratio: CROP_RATIO[d.tplPurpose] || 'original' })
      .then(function (r) {
        d.bgBusy = false;
        if (r && r.ok && r.dataUrl) { photo.editedDataUrl = r.dataUrl; toast('배경 적용 완료'); }
        else { toast((r && r.toast) || '배경 처리에 실패했어요'); }
        setScreen('edit');
      });
  }

  // 저장 시 경량 보정(adjust)을 캔버스로 굽기 → editedDataUrl. PNG 소스 유지/그 외 JPEG.
  function bakeEdit() {
    var photo = curPhoto();
    var nonzero = photo && d.adjust && Object.keys(d.adjust).some(function (k) { return d.adjust[k]; });
    if (!photo || !nonzero) return Promise.resolve();
    var src = photo.editedDataUrl || photo.dataUrl;
    return new Promise(function (res) {
      var im = new Image();
      im.onload = function () {
        try {
          var cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height;
          var c = cv.getContext('2d'); c.filter = filterCss(d.adjust); c.drawImage(im, 0, 0);
          var png = /^data:image\/png/i.test(src);
          photo.editedDataUrl = png ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.92);
          photo.adjustments = clone(d.adjust);
        } catch (_e) { /* bake 실패 시 원본 유지 */ }
        res();
      };
      im.onerror = function () { res(); };
      im.src = src;
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
    if (c.to === '__save') return save();
    if (cur === 'caption') syncCaptionFromDom();
    // 편집 → 캡션: 경량 보정(adjust) 결과를 editedDataUrl 로 굽고 이동 (재업로드 없음)
    if (cur === 'edit') { return bakeEdit().then(function () { setScreen(c.to); }); }
    setScreen(c.to);
  }

  // 비율 자르기 — V2 크롭 모달. 결과는 editedDataUrl + cropMeta (originalUrl 미변경, role 불변).
  function openCropFlow() {
    if (!(window.WorkspaceAdapter && window.WorkspaceAdapter.openCrop)) { toast('크롭 모듈을 불러오지 못했어요'); return; }
    var idx = d.photos.indexOf(curPhoto()); if (idx < 0) idx = 0;
    window.WorkspaceAdapter.openCrop({
      photos: d.photos, index: idx, ratio: CROP_RATIO[d.tplPurpose] || '4:5',
      onApply: function (photoId, dataUrl, meta) {
        var p = d.photos.filter(function (x) { return x.id === photoId; })[0];
        if (p) { p.editedDataUrl = dataUrl; p.cropMeta = meta; }
        if (cur === 'edit') setScreen('edit');
      },
    });
  }

  function pickCustomer() {
    if (!window.WorkspaceAdapter) { toast('고객 모듈을 불러오지 못했어요'); return; }
    window.WorkspaceAdapter.pickCustomer(d.customerId).then(function (r) {
      if (r.ok) { d.customerId = r.id; d.customerName = r.name; setScreen('connect'); toast(r.name + ' 고객과 연결했어요.'); }
      else if (r.toast) toast(r.toast);
    });
  }

  function buildSlot() {
    var slot = d.slot || { id: uid(), order: 0, createdAt: Date.now() };
    var now = Date.now();
    slot.label = d.customerName || slot.label || (d.service ? d.service.split(',')[0].trim() : '새 콘텐츠');
    slot.photos = d.photos.map(function (p) { return { id: p.id, dataUrl: p.dataUrl, editedDataUrl: p.editedDataUrl || null, role: p.role, cropMeta: p.cropMeta || null, updatedAt: now }; });
    slot.caption = d.caption || '';
    slot.hashtags = d.hashtags.join(' ');
    slot.customer_id = d.customerId || null;
    slot.customer_name = d.customerName || '';
    slot.status = 'done';
    // [Phase 4A] additive — 기존 필드 보존하며 컨텍스트/캡션메타/게시상태 보강
    slot.workspaceContext = Object.assign({}, slot.workspaceContext, {
      type: TYPE_MAP[d.tplPurpose] || 'promo',
      expectedPhotos: d.tplPurpose === 'before_after' ? 2 : 1,
      defaultRatio: CROP_RATIO[d.tplPurpose] || '4:5',
      templatePurpose: d.tplPurpose || 'feed',
      captionMode: d.captionMode || 'normal',
      createdFrom: 'workspace_v2',
    });
    slot.captionMeta = {
      mode: d.captionMode || 'normal', length_tier: d.capLen || 'medium', tone_override: d.capTone || 'normal',
      generatedAt: d.caption ? ((slot.captionMeta && slot.captionMeta.generatedAt) || now) : null, log_id: d.logId || null,
    };
    slot.publish = Object.assign({ status: 'draft', instagramPreparedAt: null, publishedAt: null }, slot.publish, d.publish || {});
    return slot;
  }

  function save() {
    var slot = buildSlot();
    var done = function () {
      toast(d.customerName ? (d.customerName + ' 고객 기록에 저장했어요.') : '작업실에 저장했어요.');
      close();
      if (window.WorkspaceV2 && window.WorkspaceV2.refresh) window.WorkspaceV2.refresh();
    };
    if (window.WorkspaceAdapter && window.WorkspaceAdapter.saveItem) {
      window.WorkspaceAdapter.saveItem(slot).then(function (r) { if (r.ok) done(); else toast('저장에 실패했어요'); });
    } else { done(); }
  }

  // 업로드 준비 상태 반영 (미연결: 복사/저장 시) — slot.publish.status = upload_ready
  function _markPrepared() {
    if (!d.publish) d.publish = { status: 'draft', instagramPreparedAt: null, publishedAt: null };
    d.publish.status = 'upload_ready'; d.publish.instagramPreparedAt = Date.now();
  }

  // 실제 인스타 업로드(연결+확인 시에만). 미연결이면 noop(버튼 자체가 준비/연결로 표시됨).
  function publish() {
    if (!window.WorkspaceAdapter) return;
    if (!window.WorkspaceAdapter.instagram().connected) { toast('인스타 연결 후 올릴 수 있어요'); return; }
    syncCaptionFromDom();
    if (typeof window.confirm === 'function' && !window.confirm('인스타그램에 지금 올릴까요?')) return;
    window.WorkspaceAdapter.publishInstagram(buildSlot()).then(function (r) {
      if (r.ok) { if (!d.publish) d.publish = {}; d.publish.status = 'published'; d.publish.publishedAt = Date.now(); toast('인스타그램에 올렸어요'); }
      else if (r.reason === 'not_connected') toast('인스타 연결이 필요해요');
      else toast('업로드에 실패했어요 — 잠시 후 다시');
    });
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
    var wc = (slot && slot.workspaceContext) || null;       // [Phase 4] 복원 컨텍스트 우선
    var ctx = CAT_CTX[opts.cat] || {};
    var purpose = (wc && wc.templatePurpose) || ctx.purpose || 'feed';
    var capMode = (wc && wc.captionMode) || ctx.captionMode || 'normal';
    var cm = (slot && slot.captionMeta) || {};
    var hadRoles = !!(slot && slot.photos && slot.photos.some(function (p) { return p && p.role; }));
    d = {
      slot: slot,
      photos: slot && slot.photos ? slot.photos.map(function (p) { return { id: p.id || uid(), dataUrl: p.dataUrl, editedDataUrl: p.editedDataUrl, role: p.role || 'hero', cropMeta: p.cropMeta || null }; }) : [],
      baMode: purpose === 'before_after',
      template: null, tplCat: ctx.tplLabel || (wc && wc.type === 'before_after' ? '전후' : null),
      tplPurpose: purpose, captionMode: capMode, defaultRole: ctx.role || 'hero',
      service: slot && slot.service ? slot.service : '', caption: slot ? (slot.caption || '') : '', hashtags: slot && slot.hashtags ? String(slot.hashtags).split(/\s+/).filter(Boolean) : [],
      customerId: slot ? (slot.customer_id || null) : null, customerName: slot ? (slot.customer_name || '') : '', custQuery: '',
      capLen: cm.length_tier || 'medium', capTone: cm.tone_override || 'normal', logId: cm.log_id || null,
      publish: (slot && slot.publish) ? Object.assign({}, slot.publish) : { status: 'draft', instagramPreparedAt: null, publishedAt: null },
      recent: [], recentLoaded: false, capLoading: false,
      // [Phase 5-1] 인플레이스 편집 상태
      editTab: 'basic', control: null, adjust: newAdjust(), undo: [], redo: [], originalPreview: false, bgAction: null, bgColor: null, bgBusy: false,
    };
    // 신규 업로드/역할 없음일 때만 자동 역할 지정 — 복원 슬롯의 role 은 보존
    if (d.photos.length && !hadRoles) reassignRoles();
    el.classList.add('is-open');
    setScreen(opts.startScreen && SCREENS.indexOf(opts.startScreen) >= 0 ? opts.startScreen : 'upload');
  }
  function close() { if (el) el.classList.remove('is-open'); }

  window.WorkspaceFlow = { open: open, close: close };
})();
