/* Workspace V2 플로우 — 프로토타입 2~6 화면(업로드→편집→게시글→고객연결→미리보기→게시).
   [C4] 캡션→게시글 네이밍, 가짜 HASHES 제거, [다시]/[더 짧게]/[더 길게] 버튼.
   [C5] 고객연결 — 그라데이션 아바타 제거, _barClass(vc) 컬러바+N회 배지.
   [C6] 단계 순서: upload→edit→caption(게시글)→connect→preview→게시. 발행=uploadProgressPopup.
   진입: WorkspaceFlow.open({ slot?, startScreen?, cat?, files?, textOnly? }). */
(function () {
  'use strict';

  // [C6] 단계 순서 변경: connect가 preview 앞으로
  var SCREENS = ['upload', 'edit', 'caption', 'connect', 'preview'];
  var TITLE = { upload:'사진 업로드', edit:'편집 및 템플릿', caption:'게시글 만들기', connect:'고객 연결', preview:'인스타 미리보기' };
  var CTA = {
    upload: { l:'다음', to:'edit' },
    edit:   { l:'저장하고 게시글 쓰기', to:'caption' },
    caption:{ l:'고객 연결로', to:'connect' },
    connect:{ l:'미리보기', to:'preview' },
  };
  // preview: CTA 없음(미리보기 화면에 게시 버튼 직접 존재)
  var CAT_CTX = {
    ba:     { purpose: 'before_after', captionMode: 'normal', role: 'auto', tplLabel: '전후' },
    flex:   { purpose: 'feed',         captionMode: 'normal', role: 'hero', tplLabel: '시술 자랑' },
    review: { purpose: 'review',       captionMode: 'review', role: 'hero', tplLabel: '고객 후기' },
    event:  { purpose: 'event',        captionMode: 'normal', role: 'hero', tplLabel: '이벤트' }
  };
	  var CROP_RATIO = { before_after: '4:5', feed: '4:5', review: '4:5', event: '1:1', story: '9:16', price: 'free' };
	  var TYPE_MAP = { before_after: 'before_after', feed: 'promo', review: 'review', event: 'event', story: 'story', price: 'price' };
	  // 슬라이더는 숫자/동적문구 없이 좌(lo)·우(hi) 고정 라벨만 노출 (뷰티앱 미니멀).
	  var MAIN_TOOLS = [
	    { k: 'brightness', l: '밝기', ic: 'ph-sun', lo: '어두움', hi: '밝음' },
	    { k: 'contrast', l: '대비', ic: 'ph-circle-half', lo: '은은함', hi: '뚜렷함' },
	    { k: 'saturation', l: '채도', ic: 'ph-sparkle', lo: '차분함', hi: '선명함' },
	    { k: 'sharpness', l: '선명도', ic: 'ph-lightning', lo: '부드러움', hi: '또렷함' },
	    { k: 'color', l: '색감', ic: 'ph-palette', lo: '쿨톤', hi: '웜톤' },
	    { k: 'background', l: '배경', ic: 'ph-image' },
	  ];
	  var PRECISION_TABS = [
	    { k: 'skin', label: '피부', ic: 'ph-user', controls: [
	      { k: 'skin', l: '피부톤', ic: 'ph-sun' },
	      { k: 'textureSmooth', l: '피부결', ic: 'ph-sparkle' },
	      { k: 'blemish', l: '잡티 정리', ic: 'ph-bandage' } ] },
	    { k: 'hair', label: '헤어', ic: 'ph-wind', controls: [
	      { k: 'hairDetail', l: '헤어결', ic: 'ph-wind' },
	      { k: 'hairVolume', l: '헤어 볼륨', ic: 'ph-waves' },
	      { k: 'hairShine', l: '헤어 윤기', ic: 'ph-sparkle' } ] },
	    { k: 'eyes', label: '눈썹·눈가', ic: 'ph-eye', controls: [
	      { k: 'browSharp', l: '눈썹 선명도', ic: 'ph-pencil-simple' },
	      { k: 'lashSharp', l: '눈가 선명도', ic: 'ph-eye' },
	      { k: 'eyeRedness', l: '눈 맑게', ic: 'ph-drop' } ] },
	    { k: 'tools', label: '고급', ic: 'ph-faders', controls: [] },
	  ];
	  var WORKSPACE_TEMPLATES = [
	    { key: 'ba', label: '전후 비교', use: '전후 2장', chip: '전후', id: 'v3-ba-clean-rose', purpose: 'before_after', captionMode: 'normal' },
	    { key: 'showcase', label: '시술 자랑', use: '완성컷 강조', chip: '시술 자랑', id: 'feed-showcase', purpose: 'feed', captionMode: 'normal' },
	    { key: 'review', label: '고객 후기', use: '후기 카드', chip: '고객 후기', id: 'v3-review-card', purpose: 'review', captionMode: 'review' },
	    { key: 'event', label: '이벤트 안내', use: '혜택 안내', chip: '이벤트', id: 'event-discount', purpose: 'event', captionMode: 'normal' },
	    { key: 'feed', label: '인스타 피드', use: '피드용 안내', chip: '시술 자랑', id: 'feed-notice', purpose: 'feed', captionMode: 'normal' },
	    { key: 'story', label: '스토리 홍보', use: '세로 홍보', chip: '스토리', id: 'story-open', purpose: 'story', captionMode: 'normal' },
	  ];
	  function newAdjust() { return { brightness:0, contrast:0, saturation:0, sharpness:0, color:0 }; }
	  function newBeauty() { return { skin:0, textureSmooth:0, blemish:0, hairDetail:0, hairVolume:0, hairShine:0, browSharp:0, lashSharp:0, eyeRedness:0 }; }
  var d = null;
  var el = null;
  var cur = 'upload';

  function uid() { return (typeof window._uid === 'function') ? window._uid() : 'wf_' + Math.random().toString(36).slice(2); }
  function toast(m) { if (window.showToast) window.showToast(m); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]; }); }
  function fileToDataUrl(f) {
    if (typeof window._fileToDataUrl === 'function') return window._fileToDataUrl(f);
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsDataURL(f); });
  }
  function editablePhotos() { return d.photos.filter(function (x) { return x.role !== 'exclude'; }); }
  // 대표 사진 — 캡션/미리보기/저장 썸네일/게시 이미지(전후면 '후' 우선). 기존 동작 유지.
  function curPhoto() { var p = editablePhotos(); return (p[1] || p[0] || d.photos[0]); }
  // 편집 대상 사진 — 편집 화면에서 전/후 전환(editIdx)으로 선택. 전후면 '전(before)' 기본, 일반은 첫 사진.
  function curEditPhoto() {
    var p = editablePhotos();
    if (!p.length) return d.photos[0];
    if (d.editIdx == null) d.editIdx = 0;
    if (d.editIdx < 0 || d.editIdx >= p.length) d.editIdx = 0;
    return p[d.editIdx];
  }
  // 전/후(또는 다중) 편집 대상 전환 — 현재 보정을 먼저 굽고(다른 사진 오적용 방지) 편집 상태 초기화.
  function switchEditPhoto(idx) {
    var p = editablePhotos();
    if (idx < 0 || idx >= p.length || idx === (d.editIdx || 0)) return;
    bakeEdit().then(function () {
      d.editIdx = idx;
	      d.adjust = newAdjust(); d.beauty = newBeauty(); d.undo = []; d.redo = []; d.previewUrl = null;
      d.originalPreview = false; d.basicTool = null;
      d.bgAction = null; d.bgColor = null; d.bgFail = false; d.bgBusy = false;
      setScreen('edit');
    });
  }
  function photoUrl(p) { return p ? (p.editedDataUrl || p.dataUrl) : ''; }
  // [C5] _barClass: vc(방문횟수) → b1/b2/b3 클래스
  function barClass(vc) {
    if (vc >= 10) return 'b3';
    if (vc >= 3)  return 'b2';
    return 'b1';
  }

  /* ── 화면 마크업 ── */
  function shell() {
    return '' +
      '<div class="wsv2flow__bar">' +
        '<button type="button" class="wsv2flow__back" data-fl="back" aria-label="뒤로"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#ic-chevron-left"/></svg></button>' +
        '<div class="wsv2flow__title" data-fl-title>사진 업로드</div>' +
        '<span class="wsv2flow__step" data-fl-step></span>' +
      '</div>' +
      '<div class="wsv2flow__progress">' + '<i class="pg-seg"></i><i class="pg-seg"></i><i class="pg-seg"></i><i class="pg-seg"></i><i class="pg-seg"></i>' + '</div>' +
      '<div class="wsv2flow__screens">' +
        '<section class="wsv2flow__s" data-fs="upload"></section>' +
        '<section class="wsv2flow__s" data-fs="edit"></section>' +
        '<section class="wsv2flow__s" data-fs="caption"></section>' +
        '<section class="wsv2flow__s" data-fs="connect"></section>' +
        '<section class="wsv2flow__s" data-fs="preview"></section>' +
      '</div>' +
      '<footer class="wsv2flow__actionbar"><button class="wsv2flow__cta" data-fl="cta">다음</button></footer>' +
      '<input type="file" accept="image/*" multiple data-fl-file hidden>' +
      '<input type="file" accept="image/*" data-fl-bgfile hidden>' +
      // 올리기 로딩 — 시안 B(잇비 봇 둥둥 + 점3개 + 단계 멘트/인디케이터)
      '<div class="wsv2pub" data-fl-pub hidden aria-live="polite">' +
        '<div class="wsv2pub__card">' +
          '<div class="wsv2pub__bot"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#ic-bot"/></svg></div>' +
          '<div class="wsv2pub__dots"><span></span><span></span><span></span></div>' +
          '<div class="wsv2pub__t" data-fl-pub-t>올리는 중…</div>' +
          '<div class="wsv2pub__s" data-fl-pub-s>사진을 인스타로 보내고 있어요</div>' +
          '<div class="wsv2pub__steps" data-fl-pub-steps><i class="on"></i><i></i><i></i></div>' +
        '</div>' +
      '</div>';
  }

  function renderUpload() {
    var tiles = d.photos.map(function (p, i) {
      // 자동 분류 금지: 사용자가 직접 지정(roleManual)했거나 전/후 토글 ON 일 때만 역할 라벨, 그 외엔 중립 '사진 N'.
      var role = p.role || 'hero';
      var showRole = p.roleManual || d.baMode;
      var tag = '사진 ' + (i + 1), cls = '';
      if (showRole && role === 'before') { tag = '전'; cls = 'before'; }
      else if (showRole && role === 'after') { tag = '후'; cls = 'after'; }
      else if (showRole && role === 'exclude') { tag = '제외'; cls = 'exclude'; }
      else if (showRole && role === 'hero') { tag = '홍보컷'; }
      return '<div class="photo-tile" style="background-image:url(' + esc(p.dataUrl) + ')" data-fl-tile="' + i + '">' +
        '<button class="thumb-del" data-fl-del="' + i + '" aria-label="이 사진 삭제"><i class="ph-bold ph-trash"></i></button>' +
        '<button type="button" class="thumb-tag ' + cls + '" data-fl-role="' + i + '" aria-label="이 사진 용도 바꾸기(홍보컷·전·후·제외)">' + tag + '</button></div>';
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
      '<div class="up-section">선택한 사진 <b>' + d.photos.length + '</b> / 10' +
        (d.photos.length >= 2 ? ' <span class="up-rolehint">· 사진 라벨을 눌러 전·후·홍보컷·제외 직접 지정</span>' : '') + '</div>' +
      '<div class="upload-grid">' + tiles +
        '<div class="grid-add" data-fl-pick><i class="ph-bold ph-plus"></i><span>추가</span></div>' +
      '</div>';
  }

	  function _toolByKey(list, key) {
	    return (list || []).filter(function (c) { return c.k === key; })[0] || (list || [])[0];
	  }
	  function _hasValues(obj) {
	    return !!(obj && Object.keys(obj).some(function (k) { return +obj[k] !== 0; }));
	  }
	  function _bgPanelHtml() {
    var bgcur = d.bgAction || '';
    var bgColors = ['#ffffff', '#f7f3ee', '#fbeaef', '#fce8d8', '#fdf6c9', '#eaf3fc', '#e7f4ec', '#efe9f7', '#3a322c', '#1f1b18'];
    return '<div class="ed-bg">' +
        '<button type="button" class="ed-bg__btn' + (bgcur === 'removeBg' ? ' on' : '') + '" data-fl-bg="removeBg"><i class="ph-duotone ph-scissors"></i>누끼 / 배경 제거</button>' +
        '<button type="button" class="ed-bg__btn' + (bgcur === 'blur' ? ' on' : '') + '" data-fl-bg="blur"><i class="ph-duotone ph-drop-half"></i>배경 흐림</button>' +
        '<button type="button" class="ed-bg__btn' + (bgcur === 'image' ? ' on' : '') + '" data-fl-bgpick><i class="ph-duotone ph-image-square"></i>내 배경 직접 올리기</button>' +
        (d.customBgName ? '<div class="ed-bg__status">올린 배경: ' + esc(d.customBgName) + '</div>' : '') +
        '<div class="ed-note"><i class="ph-duotone ph-info"></i>배경 색·흐림·내 배경은 먼저 인물을 분리(누끼)한 뒤 적용돼요. 잠시 걸릴 수 있어요.</div>' +
        '<div class="ed-bg__colors">' + bgColors.map(function (c) {
          return '<button type="button" class="ed-bg__color' + (d.bgColor === c ? ' on' : '') + '" data-fl-bgcolor="' + c + '" style="background:' + c + '" aria-label="배경색"></button>';
        }).join('') + '</div>' +
        '<div class="ed-bg__status' + (d.bgFail ? ' is-fail' : '') + '" data-fl-bgstatus>' + (d.bgBusy ? '배경 처리 중…' : (d.bgFail ? esc(d.bgFailMsg || '배경 처리에 실패했어요') : (d.bgAction ? '적용됨' : '배경 옵션을 선택하세요'))) + '</div>' +
      '</div>';
	  }
	  function _toolButtons(ctrls, activeKey, attr) {
	    return '<div class="ed-tools">' + ctrls.map(function (c) {
	      return '<div class="ed-tool' + (c.k === activeKey ? ' on' : '') + '" ' + attr + '="' + c.k + '"><span class="ed-circle"><i class="ph-duotone ' + c.ic + '"></i></span>' + c.l + '</div>';
	    }).join('') + '</div>';
	  }
	  // 좌·우 고정 라벨만 있는 슬라이더 row (가운데 숫자/동적문구 없음).
	  function _labeledRange(lo, hi, min, max, val, attr, key, extraCls) {
	    return '<div class="ed-slider ed-slider--labeled' + (extraCls ? ' ' + extraCls : '') + '">' +
	      '<span class="ed-slabel ed-slabel--lo">' + esc(lo) + '</span>' +
	      '<input type="range" min="' + min + '" max="' + max + '" value="' + val + '" ' + attr + '="' + key + '">' +
	      '<span class="ed-slabel ed-slabel--hi">' + esc(hi) + '</span></div>';
	  }
	  function _ctrlSlider(ctrls, activeKey, toolAttr) {
	    var active = activeKey && ctrls.some(function (c) { return c.k === activeKey; }) ? activeKey : ctrls[0].k;
	    var actObj = _toolByKey(ctrls, active);
	    var val = (d.adjust && d.adjust[active]) || 0;
	    return _toolButtons(ctrls, active, toolAttr) +
	      _labeledRange(actObj.lo || '약하게', actObj.hi || '강하게', -100, 100, val, 'data-fl-range', active);
	  }
	  function _mainAdjustHtml() {
	    var active = d.basicTool || 'brightness';
	    var buttons = _toolButtons(MAIN_TOOLS, active, 'data-fl-basictool');
	    if (active === 'background') return buttons + '<div class="ed-panel">' + _bgPanelHtml() + '</div>';
	    var actObj = _toolByKey(MAIN_TOOLS, active);
	    var val = (d.adjust && d.adjust[active]) || 0;
	    return buttons + _labeledRange(actObj.lo || '약하게', actObj.hi || '강하게', -100, 100, val, 'data-fl-range', active);
	  }
	  function _beautySlider(ctrls, activeKey) {
	    var active = activeKey && ctrls.some(function (c) { return c.k === activeKey; }) ? activeKey : ctrls[0].k;
	    var actObj = _toolByKey(ctrls, active);
	    var val = (d.beauty && d.beauty[active]) || 0;
	    return _toolButtons(ctrls, active, 'data-fl-beautytool') +
	      _labeledRange('자연', '강하게', 0, 100, val, 'data-fl-beautyrange', active, 'ed-slider--beauty');
	  }

  // ── 편집화면: 섹션별 빌더 (버튼 탭 시 해당 섹션만 갱신 → 전체 재렌더/대용량 dataURL 재디코딩 제거) ──
  function _editPhotoUrls() {
    var _ep = curEditPhoto();
    var base = photoUrl(_ep);                          // 현재 작업본(편집 반영)
    var orig = _ep ? (_ep.dataUrl || base) : base;     // 손대기 전 진짜 원본
    var url = d.originalPreview ? orig : (d.previewUrl || base);
    var preview = (d.originalPreview || d.previewUrl) ? 'none' : filterCss(d.adjust);
    return { url: url, preview: preview };
  }
  function _editSwitcherHtml() {
    var eps = editablePhotos();
    if (eps.length < 2) return '';
    var curIdx = (d.editIdx == null) ? 0 : d.editIdx;
    return '<div class="ed-baswitch" role="tablist">' + eps.map(function (p, i) {
      var lbl = p.role === 'before' ? '전 사진' : (p.role === 'after' ? '후 사진' : ('사진 ' + (i + 1)));
      return '<button type="button" class="ed-baswitch__btn' + (i === curIdx ? ' on' : '') + '" data-fl-editsel="' + i + '" role="tab" aria-selected="' + (i === curIdx) + '" style="background-image:url(' + esc(photoUrl(p)) + ')"><span>' + esc(lbl) + '</span></button>';
    }).join('') + '</div>';
  }
  function _editBottomHtml() {
    return '<div class="ed-bottom">' +
      '<div class="eb' + (d.undo && d.undo.length ? '' : ' disabled') + '" data-fl-eb="되돌리기"><svg class="eb-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a4 4 0 0 1 0 8h-1"/></svg>되돌리기</div>' +
      '<div class="eb' + (d.redo && d.redo.length ? '' : ' disabled') + '" data-fl-eb="다시실행"><svg class="eb-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 14 5-5-5-5"/><path d="M20 9H9a4 4 0 0 0 0 8h1"/></svg>다시실행</div>' +
      '<div class="eb' + (d.originalPreview ? ' active' : '') + '" data-fl-eb="비교"><span class="activebox"><svg class="eb-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v18"/><rect x="3" y="6" width="6" height="12" rx="1"/><rect x="15" y="8" width="6" height="8" rx="1"/></svg></span>비교</div>' +
      '<div class="eb" data-fl-eb="원본보기"><svg class="eb-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>원본보기</div>' +
      '<div class="eb" data-fl-eb="초기화"><svg class="eb-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-6.4 2.6L3 8"/><path d="M3 3v5h5"/></svg>초기화</div>' +
      '</div>';
  }
  function _caret(open) { return '<svg class="ed-fold__caret" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#ic-chevron-' + (open ? 'up' : 'down') + '"/></svg>'; }
  function _advFoldHtml() {
    var prec = PRECISION_TABS;
    var ptab = d.editTab && prec.some(function (t) { return t.k === d.editTab; }) ? d.editTab : prec[0].k;
    var ptabObj = prec.filter(function (t) { return t.k === ptab; })[0];
    var precBody = '';
    if (d.advOpen) {
      var inner;
      if (ptab === 'tools') {
        inner = '<div class="ed-adv">' +
          '<button type="button" class="ed-adv__btn" data-fl="crop"><i class="ph-duotone ph-crop"></i>비율 자르기 (1:1·4:5·9:16·자유)</button>' +
          '<button type="button" class="ed-adv__btn" data-fl="roles"><i class="ph-duotone ph-images"></i>역할 확인 (' + esc(_roleSummary()) + ')</button>' +
          '</div>';
      } else {
        inner = '<div class="ed-adv">' + _beautySlider(ptabObj.controls || [], d.precTool) + '</div>';
      }
      var precTabsHtml = '<div class="ed-tabs">' + prec.map(function (t) {
        return '<div class="ed-tab' + (t.k === ptab ? ' on' : '') + '" data-fl-edtab="' + t.k + '"><i class="ph-duotone ' + t.ic + '"></i>' + t.label + '</div>';
      }).join('') + '</div>';
      precBody = '<div class="ed-panel">' + precTabsHtml + inner + '</div>';
    }
    return '<button type="button" class="ed-fold' + (d.advOpen ? ' open' : '') + '" data-fl-fold="adv"><span>정밀 조정 <em>피부·헤어·눈가·고급</em></span>' + _caret(d.advOpen) + '</button>' + precBody;
  }
  function _tplFoldHtml() {
    var tplBody = '';
    if (d.tplOpen) {
      var chips = ['전체', '전후', '시술 자랑', '고객 후기', '이벤트', '스토리'];
      var shown = WORKSPACE_TEMPLATES.filter(function (tpl) { return !d.tplCat || d.tplCat === '전체' || tpl.chip === d.tplCat; });
      var thumb = photoUrl(curPhoto());
      tplBody = '<div class="ed-panel"><div class="ed-foldbody">' +
        '<div class="tpl-chips">' + chips.map(function (c, i) { return '<span class="tpl-chip' + ((d.tplCat ? d.tplCat === c : i === 0) ? ' on' : '') + '" data-fl-tplchip>' + esc(c) + '</span>'; }).join('') + '</div>' +
        '<div class="tpl-grid2">' + shown.map(function (tpl) {
          return '<button type="button" class="tpl-item' + (d.templateId === tpl.id ? ' on' : '') + '" data-fl-tpl="' + esc(tpl.key) + '"' + (thumb ? ' style="background-image:url(' + esc(thumb) + ')"' : '') + '>' +
            '<span><b>' + esc(tpl.label) + '</b><em>' + esc(tpl.use) + '</em></span></button>';
        }).join('') + '</div>' +
        (d.template ? '<div class="tpl-picked">적용됨: ' + esc(d.template) + '</div>' : '') +
        '</div></div>';
    }
    return '<button type="button" class="ed-fold' + (d.tplOpen ? ' open' : '') + '" data-fl-fold="tpl"><span>템플릿 <em>' + (d.template ? esc(d.template) : '꾸미기') + '</em></span>' + _caret(d.tplOpen) + '</button>' + tplBody;
  }
  function renderEdit() {
    d.zoom = { s: 1, tx: 0, ty: 0 };   // 편집화면 새로 그릴 때(진입/사진전환) 줌 초기화
    var pu = _editPhotoUrls();
    return '' +
      '<div class="ed-sec" data-ed-switcher>' + _editSwitcherHtml() + '</div>' +
      '<div class="ed-photo-vp" data-fl-edvp><div class="ed-photo" data-fl-edphoto style="background-image:url(' + esc(pu.url) + ');filter:' + pu.preview + '"></div></div>' +
      '<div class="ed-sec" data-ed-basic>' + _mainAdjustHtml() + '</div>' +
      '<div class="ed-sec" data-ed-bottom>' + _editBottomHtml() + '</div>' +
      '<div class="ed-sec" data-ed-adv>' + _advFoldHtml() + '</div>' +
      '<div class="ed-sec" data-ed-tpl>' + _tplFoldHtml() + '</div>';
  }
  // 특정 섹션만 교체 (전체 재렌더 회피)
  function _setEditSection(sel, html) { if (!el) return; var c = el.querySelector('[data-fs="edit"] ' + sel); if (c) c.innerHTML = html; }
  function _paintEditPhoto() {
    var p = el && el.querySelector('[data-fs="edit"] [data-fl-edphoto]'); if (!p) return;
    var pu = _editPhotoUrls();
    p.style.backgroundImage = 'url(' + pu.url + ')'; p.style.filter = pu.preview;
    _applyZoomTransform();
  }
  function _applyZoomTransform() {
    var p = el && el.querySelector('[data-fs="edit"] [data-fl-edphoto]'); if (!p) return;
    var z = d.zoom || { s: 1, tx: 0, ty: 0 };
    p.style.transform = 'translate(' + z.tx + 'px,' + z.ty + 'px) scale(' + z.s + ')';
  }

  function _roleSummary() {
    var r = {};
    (d.photos || []).forEach(function (p) { r[p.role || 'hero'] = (r[p.role || 'hero'] || 0) + 1; });
    return Object.keys(r).map(function (k) { return ({ before: '전', after: '후', hero: '홍보컷', exclude: '제외' }[k] || k) + ' ' + r[k]; }).join(' · ') || '없음';
  }

  // [FC4] 게시글 화면 — 3x3 시나리오칩(scenario-selector 재사용) + 고정멘트 꼬리
  function renderCaption() {
    var url = photoUrl(curPhoto());
    if (d.capLoading) {
      return '<div class="cap-loading"><div class="cap-loading-spin"></div><p>AI가 게시글을 쓰는 중…</p></div>';
    }
	    if (!d.caption) {
	      var photoThumb = (!d.textOnly && url) ?
	        '<div class="cap-photo cap-photo--sm" style="background-image:url(' + esc(url) + ')"></div>' : '';
	      return photoThumb +
	        '<div class="screen-head"><h2>어떤 게시글을<br>써드릴까요?</h2></div>' +
	        '<label class="cap-field-label">시술내역 / 키워드 <span>다른 단어로 다시 만들 수 있어요</span></label>' +
	        '<input class="service-input" data-fl-service value="' + esc(d.service || '') + '" placeholder="예: 레이어드컷, 애쉬브라운 염색">' +
	        '<button type="button" class="cap-preview cap-preview--inline" data-fl="gen">이 내용으로 생성</button>' +
	        '<div data-fl-scenario></div>';
	    }
    // 결과 화면
    var hashHtml = d.hashtags.map(function (h) {
      return '<button class="hash-chip' + (d.selectedHashes && d.selectedHashes.indexOf(h) >= 0 ? ' on' : '') + '" data-fl-hash="' + esc(h) + '">' + esc(h) + '</button>';
    }).join('');
    var photoHtml = (!d.textOnly && url) ?
      '<div class="cap-photo" style="background-image:url(' + esc(url) + ')"><span class="cap-pill"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width:13px;height:13px;stroke:var(--brand-strong)"><use href="#ic-tag"/></svg><span data-fl-capsvc>' + esc((d.service || '시술').split(',')[0]) + '</span></span></div>' : '';
    return '' +
	      '<div class="cap-byline">원장님 인스타 글 학습 완료</div>' +
	      '<label class="cap-field-label">게시글 <span>바로 고쳐 쓸 수 있어요 · 키워드 바꾸려면 아래 초기화</span></label>' +
	      '<div class="cap-card">' +
	        photoHtml +
	        '<div class="cap-text">' +
	          '<textarea class="cap-body" data-fl-capbody rows="8">' + esc(d.caption) + '</textarea>' +
	          '<div class="cap-hash" data-fl-caphash>' + esc((d.selectedHashes && d.selectedHashes.length ? d.selectedHashes : d.hashtags).join(' ')) + '</div>' +
	          '<span class="cap-count"><span data-fl-capcount>' + (d.caption || '').length + '</span>/200</span>' +
	        '</div>' +
      '</div>' +
      '<div class="captail">' +
        '<div class="captail__head"><span class="captail__label">고정 꼬리말</span>' +
          (d.captionTemplate ? '<button type="button" class="captail__clear" data-fl="footerclear">비우기</button>' : '') +
        '</div>' +
        '<textarea class="captail__edit" data-fl-footer rows="2" placeholder="매장 고정 문구(예약 DM·영업시간). 비우면 게시글에 안 붙어요.">' + esc(d.captionTemplate || '') + '</textarea>' +
        '<button type="button" class="captail__save" data-fl="footersave">이 꼬리말 저장</button>' +
      '</div>' +
      (hashHtml ? '<div class="cust-row"><b>해시태그</b><a data-fl="morehash">새로고침 ›</a></div><div class="hash-chips">' + hashHtml + '</div>' : '') +
      '<div class="cap-regen-row">' +
	        '<button class="cap-regen-btn" data-fl-var="regen">다시</button>' +
	        '<button class="cap-regen-btn" data-fl-var="long">더 길게</button>' +
	        '<button class="cap-regen-btn" data-fl-var="reset">초기화</button>' +
	        '<button class="cap-regen-btn" data-fl-var="hashtags">해시태그 더</button>' +
	        '<button class="cap-regen-btn" data-fl-var="insta">인스타스럽게</button>' +
	      '</div>';
	  }

  // 고정 꼬리말 저장/비우기 — persona.caption_template 영속화(빈 값이면 다음 생성부터 미부착)
  function saveFooter(text, isClear) {
    text = String(text == null ? '' : text);
    if (!(window.WorkspaceAdapter && window.WorkspaceAdapter.setCaptionTemplate)) { toast('설정 저장 모듈을 불러오지 못했어요'); return; }
    // 비우기: 현재 미리보기 캡션에 이미 붙은 꼬리말도 best-effort 로 제거
    if (isClear && d.captionTemplate && d.caption) {
      var tail = d.captionTemplate.trim();
      var idx = d.caption.lastIndexOf(tail);
      if (idx >= 0) d.caption = d.caption.slice(0, idx).replace(/\s+$/, '');
    }
    d.captionTemplate = text;
    window.WorkspaceAdapter.setCaptionTemplate(text).then(function (r) {
      toast(r && r.ok ? (isClear ? '고정 꼬리말을 비웠어요' : '고정 꼬리말을 저장했어요') : ((r && r.toast) || '저장에 실패했어요'));
      setScreen('caption');
    });
  }

  function _mountCaption() {
    var container = el.querySelector('[data-fl-scenario]');
    if (!container) return;
    if (typeof renderScenarioSelector !== 'function') { toast('시나리오 선택기를 불러오지 못했어요'); return; }
    renderScenarioSelector(container, function (result) {
      d.captionAxes = result.axes;
      var axesStr = [result.axes.situation, result.axes.customer, (d.textOnly ? null : result.axes.photo)].filter(Boolean).join(' / ');
      // [QA hotfix] 사용자가 입력창에 친 시술명/키워드를 시나리오가 덮어쓰지 않게 — 입력값을 service로 유지.
      syncServiceFromDom();
      var typed = String(d.service || '').trim();
      if (!typed) d.service = result.special_context || axesStr;   // 입력 없을 때만 시나리오로 대체
      doGenerate({ photo_context: axesStr || d.service, special_context: result.special_context || '' }, null);
    });
  }

	  function renderPreview() {
	    var url = photoUrl(curPhoto());
	    var ig = window.WorkspaceAdapter && window.WorkspaceAdapter.instagramProfile ? window.WorkspaceAdapter.instagramProfile() : { connected: false };
	    var handle = ig.connected && ig.handle ? ig.handle : '인스타 미연동';
	    var name = ig.connected ? (ig.displayName || handle) : '인스타 미연동';
	    var avatar = ig.connected && ig.profilePic
	      ? '<span class="ig-logo ig-logo--photo" style="background-image:url(' + esc(ig.profilePic) + ')"></span>'
	      : '<span class="ig-logo ig-logo--empty"><i class="ph-duotone ph-instagram-logo"></i></span>';
	    var custLine = d.customerName ?
	      '<div class="confirmline">연결 손님: <b>' + esc(d.customerName) + '</b>' + (d.customerVc ? ' · ' + d.customerVc + '회 방문' : ' · 첫 방문') + '</div>' : '';
	    return '' +
	      custLine +
	      '<div class="ig-card2">' +
	        '<div class="ig-head2">' + avatar + '<span class="ig-name2">' + esc(name) + '</span><span class="ig-loc">' + esc(ig.connected ? '샵 인스타' : '연결 필요') + '</span><span class="ig-dots2">···</span></div>' +
	        '<div class="ig-photo" style="background-image:url(' + esc(url) + ')"></div>' +
	        '<div class="ig-act"><div class="ig-ic"><i class="ph-duotone ph-heart"></i><i class="ph-duotone ph-chat-circle"></i><i class="ph-duotone ph-paper-plane-tilt"></i></div>' +
	          '<div class="ig-save"><i class="ph-duotone ph-bookmark-simple"></i></div></div>' +
	        '<div class="ig-copy2"><b>' + esc(handle) + '</b> <span data-fl-igcap>' + esc(d.caption || '') + '</span><br><span class="ig-hash">' + esc(d.hashtags.join(' ')) + '</span><div class="ig-ago">미리보기</div></div>' +
	      '</div>' +
	      _publishBlock();
	  }

  function _publishBlock() {
	    var connected = window.WorkspaceAdapter ? window.WorkspaceAdapter.instagram().connected : false;
	    if (connected) {
	      return '<button type="button" class="cap-preview cap-preview--send" style="width:100%;margin-top:10px" data-fl="publish"' + (d._publishing ? ' disabled' : '') + '>' + (d._publishing ? '<i class="ph-duotone ph-spinner"></i>올리는 중…' : '<i class="ph-duotone ph-paper-plane-tilt"></i>인스타그램에 올리기') + '</button>';
	    }
    return '<div class="wsflow-prep">' +
      '<div class="wsflow-prep__note">인스타 계정이 연결되지 않아 바로 업로드할 수 없어요. 준비만 해둘게요.</div>' +
      '<div class="wsflow-prep__row">' +
        '<button type="button" data-fl="copycap">게시글 복사</button>' +
        '<button type="button" data-fl="saveimg">이미지 저장</button>' +
        '<button type="button" class="pink" data-fl="igconnect">인스타 연결</button>' +
      '</div></div>';
  }

  // [C5] 고객 연결 — 컬러바+방문횟수 배지, 아바타 없음
  function renderConnect() {
    var recent = d.recent || [];
    var listHtml;
    if (recent.length) {
      listHtml = recent.map(function (c) {
        var sel = String(d.customerId) === String(c.id);
        var bc = barClass(c.vc || 0);
        var vcLabel = c.vc ? c.vc + '회' : '첫 방문';
        return '<div class="cust-card' + (sel ? ' selected' : '') + '" data-fl-cust="' + esc(c.n) + '" data-fl-custid="' + esc(c.id) + '">' +
          '<span class="cust-bar ' + bc + '"></span>' +
          '<div class="cust-info"><h3>' + esc(c.n) + '<span class="cust-badge ' + bc + '">' + esc(vcLabel) + '</span></h3>' + (c.p ? '<p>' + esc(c.p) + '</p>' : '') + '</div>' +
          '<span class="cust-pick"><i class="ph-bold ' + (sel ? 'ph-check' : 'ph-plus') + '"></i></span></div>';
      }).join('');
    } else {
      listHtml = '<div class="cust-empty">' + (d.recentLoaded ? '최근 연결한 고객이 아직 없어요.<br>아래에서 고객을 선택/등록해 주세요.' : '불러오는 중…') + '</div>';
    }
    var linkedName = d.customerName || '';
    var linkedVc = d.customerVc || 0;
    var linkedBc = barClass(linkedVc);
    return '' +
      '<div class="screen-head"><h2>고객을 선택하거나<br>새로 연결해 주세요</h2><p>연결하면 작업실에 자동 저장되고, 시술 기록이 함께 남아요.</p></div>' +
      '<div class="cust-search"><i class="ph-duotone ph-magnifying-glass"></i><input data-fl-custsearch placeholder="이름, 전화번호 검색"></div>' +
      '<div class="cust-row"><b>최근 고객</b><a data-fl="pickcust">더보기 ›</a></div>' +
      '<div data-fl-custlist>' + listHtml + '</div>' +
      '<div class="linked-card"><div class="linked-title"><i class="ph-duotone ph-user-circle"></i> 연결된 고객</div>' +
        '<div class="linked-main">' +
          '<span class="cust-bar ' + (linkedName ? linkedBc : 'b1') + '"></span>' +
          '<div><b>' + esc(linkedName || '고객 미선택') + '</b>' + (linkedName ? '<span class="cust-badge ' + linkedBc + '">' + (linkedVc ? linkedVc + '회' : '첫 방문') + '</span>' : '') + '<span>오늘 촬영한 사진과 게시글을 이 고객 기록에 저장해요.</span></div>' +
        '</div>' +
        '<div class="linked-actions"><button class="lk-btn pink" data-fl="pickcust">+ 새 고객 등록</button><button class="lk-btn" data-fl="skipcust">연결 없이 진행</button></div></div>';
  }

  var RENDER = { upload:renderUpload, edit:renderEdit, caption:renderCaption, connect:renderConnect, preview:renderPreview };

  // 드래그 중 라이브 미리보기(CSS). 손 떼면 applyWorkspaceCorrections(실픽셀)로 확정.
  //  - 밝기/대비/채도: 좌=낮음, 우=높음
  //  - 선명도: 우(+)=또렷(대비 미세 상승), 좌(-)=부드러움(블러)
  //  - 색감: 우(+)=웜(sepia), 좌(-)=쿨(hue를 파랑 쪽으로) — 확정 픽셀은 실제 색온도로 적용
  function filterCss(a) {
    a = a || {};
    var bright = Math.max(0, 1 + (a.brightness || 0) * 0.6 / 100);
    var contr = Math.max(0, 1 + (a.contrast || 0) / 100);
    var sat = Math.max(0, 1 + (a.saturation || 0) * 0.8 / 100);
    var shp = a.sharpness || 0;
    var contrSharp = shp > 0 ? (contr + shp * 0.2 / 100) : contr;
    var soft = shp < 0 ? (Math.min(100, -shp) * 0.012) : 0;   // 0~1.2px
    var color = a.color || 0;
    var sepia = color > 0 ? Math.min(0.55, color * 0.5 / 100) : 0;   // 웜
    var coolHue = color < 0 ? color * 0.35 : 0;                       // 쿨(파랑 쪽)
    var f = 'brightness(' + bright.toFixed(3) + ') contrast(' + contrSharp.toFixed(3) + ') saturate(' + sat.toFixed(3) + ')';
    if (sepia > 0) f += ' sepia(' + sepia.toFixed(3) + ')';
    f += ' hue-rotate(' + coolHue.toFixed(1) + 'deg)';
    if (soft > 0) f += ' blur(' + soft.toFixed(2) + 'px)';
    return f;
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
    el.querySelector('[data-fl-step]').textContent = (to + 1) + ' / ' + SCREENS.length;
    el.querySelectorAll('.wsv2flow__progress .pg-seg').forEach(function (sg, i) { sg.classList.toggle('done', i <= to); });
    var bar = el.querySelector('.wsv2flow__actionbar'), cta = el.querySelector('[data-fl="cta"]');
    if (CTA[name]) { bar.classList.remove('hidden'); cta.textContent = CTA[name].l; } else bar.classList.add('hidden');
    // [캡션 스킵 방지] 게시글 생성 전(결과 없음)엔 하단 '고객 연결로' CTA 숨김 → 인라인 '이 내용으로 생성'으로만 진행.
    if (name === 'caption' && !String(d.caption || '').trim()) bar.classList.add('hidden');
    var act = el.querySelector('.wsv2flow__s.active'); if (act) act.scrollTop = 0;
    if (name === 'caption') _mountCaption();
    if (name === 'connect') loadRecent();
    if (name === 'preview' && d.publish && (d.publish.status === 'draft' || !d.publish.status)) d.publish.status = 'preview_ready';
  }

  function loadRecent() {
    if (d.recentLoaded || d._recentLoading) return;
    if (!(window.WorkspaceAdapter && window.WorkspaceAdapter.recentCustomers)) { d.recentLoaded = true; return; }
    d._recentLoading = true;
    window.WorkspaceAdapter.recentCustomers(5).then(function (list) {
      d.recent = list || []; d.recentLoaded = true; d._recentLoading = false;
      if (cur === 'connect') setScreen('connect');
    });
  }

	  // 생성 직전 입력창의 최신 값을 직접 읽음 — input 이벤트 누락/IME 미확정으로 키워드 빠지는 것 방지.
	  function syncServiceFromDom() {
	    if (!el) return;
	    var s = el.querySelector('[data-fl-service]');
	    if (s && typeof s.value === 'string') d.service = s.value;
	  }
	  function doGenerate(extra, label) {
	    syncServiceFromDom();
	    var svc = String(d.service || '').trim();
	    if (!svc) { toast('시술 내역을 먼저 입력해 주세요'); return; }
	    if (!(window.WorkspaceAdapter && window.WorkspaceAdapter.generateCaption)) { toast('게시글 생성 모듈을 불러오지 못했어요'); return; }
	    d.capLoading = true; setScreen('caption');
	    var photoCtx = d.captionAxes ? [d.captionAxes.situation, d.captionAxes.customer, d.captionAxes.photo].filter(Boolean).join(' / ') : _roleSummary();
	    var opts = Object.assign({ slotId: d.slot && d.slot.id, service: svc, photo_context: photoCtx, mode: d.captionMode || 'normal' }, extra || {});
    d.capLen = opts.length_tier || d.capLen || 'medium';
    d.capTone = opts.tone_override || d.capTone || 'normal';
    window.WorkspaceAdapter.generateCaption(opts).then(function (r) {
      d.capLoading = false;
      if (r.ok) {
        d.caption = r.caption; d.hashtags = (r.hashtags || []).slice(); d.selectedHashes = d.hashtags.slice();
        d.captionTemplate = r.caption_template || '';
        d.logId = r.log_id || null; if (label) toast(label);
      } else { toast(r.toast || '게시글 생성에 실패했어요'); }
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
      if (a === 'batoggle') { d.baMode = !d.baMode; d.photos.forEach(function (p) { p.roleManual = false; }); reassignRoles(); setScreen('upload'); return; }
      if (a === 'gen') { return doGenerate({}, null); }
      if (a === 'regen') { return doGenerate({}, '게시글을 다시 생성했어요'); }
      if (a === 'morehash') { return doGenerate({}, '해시태그를 새로 가져왔어요'); }
      if (a === 'footersave') { return saveFooter(d.captionTemplate || ''); }
      if (a === 'footerclear') { return saveFooter('', true); }
      if (a === 'toconnect') { syncCaptionFromDom(); setScreen('connect'); return; }
      if (a === 'topreview') { syncCaptionFromDom(); setScreen('preview'); return; }
      if (a === 'pickcust') { return pickCustomer(); }
      if (a === 'skipcust') { d.customerId = null; d.customerName = ''; d.customerVc = 0; setScreen('preview'); return; }
      if (a === 'sharepreview') { toast('피드·스토리 비율과 게시글 줄바꿈을 확인했어요. (실제 업로드 아님)'); return; }
      if (a === 'crop') { return openCropFlow(); }
      if (a === 'roles') { toast('역할 — ' + _roleSummary()); return; }
      if (a === 'publish') { return publish(); }
      if (a === 'copycap') { window.WorkspaceAdapter && window.WorkspaceAdapter.copyText((d.caption || '') + (d.hashtags.length ? '\n\n' + d.hashtags.join(' ') : '')); _markPrepared(); return; }
      if (a === 'saveimg') { window.WorkspaceAdapter && window.WorkspaceAdapter.saveImage(photoUrl(curPhoto()), d.service || 'itdasy'); _markPrepared(); return; }
      if (a === 'igconnect') { window.WorkspaceAdapter && window.WorkspaceAdapter.connectInstagram(); return; }

      if (t.closest('[data-fl-pick]')) { el.querySelector('[data-fl-file]').click(); return; }
      var del = t.closest('[data-fl-del]'); if (del) { e.stopPropagation(); d.photos.splice(+del.getAttribute('data-fl-del'), 1); reassignRoles(); setScreen('upload'); return; }
      var roleBtn = t.closest('[data-fl-role]'); if (roleBtn) { e.stopPropagation(); _cycleRole(+roleBtn.getAttribute('data-fl-role')); return; }
      if (t.closest('[data-fl-edphoto]')) { return; }
      // [perf] 버튼 탭은 해당 섹션만 갱신 — 전체 편집화면(템플릿 6칸 대용량 dataURL) 재생성 안 함.
      var fold = t.closest('[data-fl-fold]'); if (fold) { var fk = fold.getAttribute('data-fl-fold'); if (fk === 'bg') { d.bgOpen = !d.bgOpen; _setEditSection('[data-ed-basic]', _mainAdjustHtml()); } else if (fk === 'adv') { d.advOpen = !d.advOpen; _setEditSection('[data-ed-adv]', _advFoldHtml()); } else if (fk === 'tpl') { d.tplOpen = !d.tplOpen; _setEditSection('[data-ed-tpl]', _tplFoldHtml()); } return; }
      var edsel = t.closest('[data-fl-editsel]'); if (edsel) { return switchEditPhoto(+edsel.getAttribute('data-fl-editsel')); }
	      var basictool = t.closest('[data-fl-basictool]'); if (basictool) { d.basicTool = basictool.getAttribute('data-fl-basictool'); _setEditSection('[data-ed-basic]', _mainAdjustHtml()); return; }
	      var edtab = t.closest('[data-fl-edtab]'); if (edtab) { d.editTab = edtab.getAttribute('data-fl-edtab'); d.control = null; _setEditSection('[data-ed-adv]', _advFoldHtml()); return; }
	      var beautytool = t.closest('[data-fl-beautytool]'); if (beautytool) { d.precTool = beautytool.getAttribute('data-fl-beautytool'); _setEditSection('[data-ed-adv]', _advFoldHtml()); return; }
	      var edtool = t.closest('[data-fl-edtool]'); if (edtool) { d.control = edtool.getAttribute('data-fl-edtool'); _setEditSection('[data-ed-adv]', _advFoldHtml()); return; }
      if (t.closest('[data-fl-bgpick]')) { el.querySelector('[data-fl-bgfile]').click(); return; }
      var bgb = t.closest('[data-fl-bg]'); if (bgb) { return applyBg(bgb.getAttribute('data-fl-bg')); }
      var bgc = t.closest('[data-fl-bgcolor]'); if (bgc) { d.bgColor = bgc.getAttribute('data-fl-bgcolor'); return applyBg('color'); }
      var eb = t.closest('[data-fl-eb]'); if (eb) { return _editBottom(eb.getAttribute('data-fl-eb')); }
      var cust = t.closest('[data-fl-cust]'); if (cust) {
        d.customerId = cust.getAttribute('data-fl-custid'); d.customerName = cust.getAttribute('data-fl-cust');
        // vc 찾기 — recent 캐시에서
        var found = (d.recent || []).filter(function (c) { return String(c.id) === String(d.customerId); })[0];
        d.customerVc = found ? (found.vc || 0) : 0;
        setScreen('connect'); return;
      }
      var tplchip = t.closest('[data-fl-tplchip]'); if (tplchip) { d.tplCat = tplchip.textContent.trim(); _setEditSection('[data-ed-tpl]', _tplFoldHtml()); return; }
	      var tpl = t.closest('[data-fl-tpl]'); if (tpl) { return applyTemplate(tpl.getAttribute('data-fl-tpl')); }
      // [C4] 해시태그 선택 → selectedHashes 토글
      var hash = t.closest('[data-fl-hash]'); if (hash) {
        var h = hash.getAttribute('data-fl-hash');
        d.selectedHashes = d.selectedHashes || [];
        var k = d.selectedHashes.indexOf(h); if (k >= 0) d.selectedHashes.splice(k, 1); else d.selectedHashes.push(h);
        hash.classList.toggle('on'); var ch = el.querySelector('[data-fl-caphash]'); if (ch) ch.textContent = d.selectedHashes.join(' '); return;
      }
      // [C4] 재생성 버튼: data-fl-var="regen|short|long"
      var vv = t.closest('[data-fl-var]'); if (vv) {
        var vk = vv.getAttribute('data-fl-var');
	        if (vk === 'short') { return doGenerate({ length_tier: 'short' }, '짧게 다시 생성했어요'); }
	        if (vk === 'long')  { return doGenerate({ length_tier: 'long' }, '길게 다시 생성했어요'); }
	        if (vk === 'reset') { d.caption = ''; d.hashtags = []; d.selectedHashes = []; d.capLen = 'medium'; d.capTone = 'normal'; d.captionMode = (d.tplPurpose === 'review') ? 'review' : 'normal'; d.logId = null; setScreen('caption'); toast('게시글을 초기화했어요 (사진은 그대로예요)'); return; }
	        if (vk === 'hashtags') { return doGenerate({ hashtag_mode: 'more' }, '해시태그를 더 가져왔어요'); }
	        if (vk === 'insta') { return doGenerate({ tone_override: 'instagram' }, '인스타스럽게 다시 생성했어요'); }
	        return doGenerate({}, '게시글을 다시 생성했어요');
	      }
      var seg = t.closest('[data-fl-seg]'); if (seg) { d.capSeg = seg.getAttribute('data-fl-seg'); setScreen('caption'); if (d.capSeg === 'write') { var bd = el.querySelector('[data-fl-capbody]'); if (bd) bd.focus(); } return; }
    });
    el.querySelector('[data-fl-file]').addEventListener('change', function (e) {
      var files = Array.from(e.target.files || []); e.target.value = '';
      if (!files.length) return;
	      addFiles(files, true);
	    });
    el.querySelector('[data-fl-bgfile]').addEventListener('change', function (e) {
      var f = (e.target.files || [])[0]; e.target.value = '';
      if (!f) return;
      var r = new FileReader();
      r.onload = function () { d.customBg = r.result; d.customBgName = f.name || '내 배경'; applyBg('image'); };
      r.onerror = function () { toast('배경 이미지를 불러오지 못했어요'); };
      r.readAsDataURL(f);
    });
	    el.addEventListener('input', function (e) {
	      if (e.target.matches('[data-fl-range]')) {
        // 기본 보정: 드래그 중에는 가벼운 CSS 필터로만 라이브 미리보기 → 부드럽게.
        var k = e.target.getAttribute('data-fl-range'); d.adjust[k] = +e.target.value;
        var p = el.querySelector('[data-fl-edphoto]');
        if (p && !d.originalPreview) { d.previewUrl = null; p.style.backgroundImage = 'url(' + esc(photoUrl(curEditPhoto())) + ')'; p.style.filter = filterCss(d.adjust); }
	      }
	      if (e.target.matches('[data-fl-beautyrange]')) {
	        // 정밀(부위) 보정: 무거운 픽셀 연산은 손 뗄 때(change)만 — 드래그 중 점멸/끊김 방지.
	        var bk = e.target.getAttribute('data-fl-beautyrange'); d.beauty[bk] = +e.target.value;
	      }
	      if (e.target.matches('[data-fl-capbody]')) { d.caption = e.target.value; var cc = el.querySelector('[data-fl-capcount]'); if (cc) cc.textContent = (d.caption || '').length; }
      if (e.target.matches('[data-fl-footer]')) { d.captionTemplate = e.target.value; }
      if (e.target.matches('[data-fl-service]')) { d.service = e.target.value; }
      if (e.target.matches('[data-fl-custsearch]')) { d.custQuery = e.target.value; }
    });
    el.addEventListener('focusin', function (e) {
      // 보정·정밀 슬라이더 모두 한 스냅샷(adjust+beauty)으로 묶어 되돌리기/다시실행 일원화.
      if (e.target.matches('[data-fl-range],[data-fl-beautyrange]')) { if (!d._editPrev) d._editPrev = _snapEdit(); }
	      if (e.target.matches('[data-fl-capbody]') && e.target.getAttribute('data-empty') === '1') { e.target.value = ''; e.target.removeAttribute('data-empty'); e.target.style.color = ''; }
	    });
    el.addEventListener('change', function (e) {
      if (e.target.matches('[data-fl-range],[data-fl-beautyrange]')) {
        if (d._editPrev) { d.undo = d.undo || []; d.undo.push(d._editPrev); if (d.undo.length > 30) d.undo.shift(); d.redo = []; d._editPrev = null; }
	        // 손 뗄 때 한 번만 실픽셀 확정 + 되돌리기/다시실행 버튼 상태 갱신(전체 재렌더 없이).
	        _refreshPreview();
	        _syncEbState();
	      }
	    });
    _bindZoom();
  }

  // 편집 사진 핀치 줌(2손가락) + 1손가락 팬(확대 시) + 더블탭 확대/축소. 뷰포트(.ed-photo-vp) 내부 클립.
  function _bindZoom() {
    if (!el || el._zoomBound) return; el._zoomBound = true;
    var g = null, lastTap = 0;
    function inVp(t) { return t && t.closest && t.closest('[data-fl-edvp]'); }
    el.addEventListener('touchstart', function (e) {
      if (cur !== 'edit' || !inVp(e.target)) return;
      if (!d.zoom) d.zoom = { s: 1, tx: 0, ty: 0 };
      if (e.touches.length === 2) {
        var dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY;
        g = { mode: 'pinch', dist: Math.hypot(dx, dy) || 1, s0: d.zoom.s }; e.preventDefault();
      } else if (e.touches.length === 1 && d.zoom.s > 1) {
        g = { mode: 'pan', x: e.touches[0].clientX, y: e.touches[0].clientY, tx0: d.zoom.tx, ty0: d.zoom.ty }; e.preventDefault();
      }
    }, { passive: false });
    el.addEventListener('touchmove', function (e) {
      if (cur !== 'edit' || !g || !d.zoom) return;
      if (g.mode === 'pinch' && e.touches.length === 2) {
        var dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY;
        d.zoom.s = Math.max(1, Math.min(4, g.s0 * (Math.hypot(dx, dy) / g.dist)));
        if (d.zoom.s === 1) { d.zoom.tx = 0; d.zoom.ty = 0; }
        _applyZoomTransform(); e.preventDefault();
      } else if (g.mode === 'pan' && e.touches.length === 1) {
        d.zoom.tx = g.tx0 + (e.touches[0].clientX - g.x); d.zoom.ty = g.ty0 + (e.touches[0].clientY - g.y);
        _applyZoomTransform(); e.preventDefault();
      }
    }, { passive: false });
    el.addEventListener('touchend', function () {
      if (g && d.zoom && d.zoom.s <= 1) { d.zoom.tx = 0; d.zoom.ty = 0; _applyZoomTransform(); }
      g = null;
    });
    el.addEventListener('click', function (e) {
      if (cur !== 'edit' || !inVp(e.target)) return;
      var now = Date.now();
      if (now - lastTap < 320) { d.zoom = (d.zoom && d.zoom.s > 1) ? { s: 1, tx: 0, ty: 0 } : { s: 2, tx: 0, ty: 0 }; _applyZoomTransform(); }
      lastTap = now;
    });
  }

  function _snapEdit() { return { adjust: clone(d.adjust), beauty: clone(d.beauty) }; }
  function _syncEbState() {
    if (!el) return;
    var u = el.querySelector('[data-fl-eb="되돌리기"]'); if (u) u.classList.toggle('disabled', !(d.undo && d.undo.length));
    var r = el.querySelector('[data-fl-eb="다시실행"]'); if (r) r.classList.toggle('disabled', !(d.redo && d.redo.length));
  }

	  function _refreshPreview() {
	    var photo = curEditPhoto(); if (!photo) return;
	    var base = photo.editedDataUrl || photo.dataUrl;
	    var p = el.querySelector('[data-fl-edphoto]');
	    var nonzero = _hasValues(d.adjust) || _hasValues(d.beauty);
	    if (!nonzero) { d.previewUrl = null; if (p && !d.originalPreview) { p.style.backgroundImage = 'url(' + esc(base) + ')'; p.style.filter = 'none'; } return; }
	    if (!(window.WorkspaceAdapter && window.WorkspaceAdapter.applyWorkspaceCorrections)) { if (p && !d.originalPreview) p.style.filter = filterCss(d.adjust); return; }
	    var token = (d._pvTok = (d._pvTok || 0) + 1);
	    window.WorkspaceAdapter.applyWorkspaceCorrections({ src: base, adjust: d.adjust, beauty: d.beauty }).then(function (r) {
	      if (token !== d._pvTok) return;
      if (r && r.ok && r.dataUrl) {
        d.previewUrl = r.dataUrl;
        var p2 = el.querySelector('[data-fl-edphoto]');
        if (p2 && !d.originalPreview) { p2.style.backgroundImage = 'url(' + r.dataUrl + ')'; p2.style.filter = 'none'; }
      }
    });
  }

  function clone(o) { return JSON.parse(JSON.stringify(o || {})); }

  // 보정 변경 후 화면 갱신 — 사진/슬라이더/정밀/하단버튼 섹션만 (전체 재렌더 회피)
  function _repaintEditAfterAdjust() {
    _paintEditPhoto();
    _setEditSection('[data-ed-basic]', _mainAdjustHtml());
    _setEditSection('[data-ed-adv]', _advFoldHtml());
    _setEditSection('[data-ed-bottom]', _editBottomHtml());
    _refreshPreview();
  }
  function _editBottom(label) {
    if (label === '비교' || label === '원본보기') { d.originalPreview = !d.originalPreview; _paintEditPhoto(); _setEditSection('[data-ed-bottom]', _editBottomHtml()); if (!d.originalPreview) _refreshPreview(); return; }
    if (label === '되돌리기') { if (d.undo && d.undo.length) { d.redo = d.redo || []; d.redo.push(_snapEdit()); var s = d.undo.pop(); d.adjust = s.adjust || newAdjust(); d.beauty = s.beauty || newBeauty(); d.previewUrl = null; _repaintEditAfterAdjust(); } return; }
    if (label === '다시실행') { if (d.redo && d.redo.length) { d.undo = d.undo || []; d.undo.push(_snapEdit()); var r = d.redo.pop(); d.adjust = r.adjust || newAdjust(); d.beauty = r.beauty || newBeauty(); d.previewUrl = null; _repaintEditAfterAdjust(); } return; }
	    if (label === '초기화') { d.undo = d.undo || []; d.undo.push(_snapEdit()); if (d.undo.length > 30) d.undo.shift(); d.redo = []; d.adjust = newAdjust(); d.beauty = newBeauty(); d.previewUrl = null; _repaintEditAfterAdjust(); toast('보정을 초기화했어요'); return; }
  }

	  function applyBg(action) {
	    var photo = curEditPhoto();
    if (!photo) { toast('사진이 없어요'); return; }
    if (!(window.WorkspaceAdapter && window.WorkspaceAdapter.applyWorkspaceBgAction)) { toast('배경 모듈을 불러오지 못했어요'); return; }
    var prev = d.bgAction;
    d.bgAction = action; d.bgBusy = true; d.bgFail = false; setScreen('edit');
    window.WorkspaceAdapter.applyWorkspaceBgAction({ src: photo.editedDataUrl || photo.dataUrl, action: action, color: d.bgColor, bgImage: d.customBg, ratio: CROP_RATIO[d.tplPurpose] || 'original' })
      .then(function (r) {
        d.bgBusy = false;
        if (r && r.ok && r.dataUrl) { photo.editedDataUrl = r.dataUrl; d.previewUrl = null; d.bgFail = false; toast('배경 적용 완료'); setScreen('edit'); _refreshPreview(); }
        else { d.bgAction = prev; d.bgFail = true; d.bgFailMsg = (r && r.toast) || '배경 처리에 실패했어요'; toast(d.bgFailMsg); setScreen('edit'); }
	      });
	  }

	  function _tplByKey(key) {
	    return WORKSPACE_TEMPLATES.filter(function (t) { return t.key === key; })[0] || null;
	  }
	  function applyTemplate(key) {
	    var tpl = _tplByKey(key);
	    if (!tpl) { toast('템플릿을 찾지 못했어요'); return; }
	    if (!(window.WorkspaceAdapter && window.WorkspaceAdapter.applyWorkspaceTemplate)) { toast('템플릿 적용 모듈을 불러오지 못했어요'); return; }
	    if (!d.photos.length) { toast('사진을 먼저 추가해 주세요'); return; }
	    if (tpl.purpose === 'before_after') { d.baMode = true; reassignRoles(); }
	    d.templateBusy = tpl.key; setScreen('edit');
	    window.WorkspaceAdapter.applyWorkspaceTemplate({
	      template: tpl, photos: editablePhotos(), service: d.service,
	      customerName: d.customerName, caption: d.caption,
	    }).then(function (r) {
	      d.templateBusy = null;
	      if (r && r.ok && r.dataUrl) {
	        var p = curPhoto();
	        p.editedDataUrl = r.dataUrl; p.templateId = tpl.id;
	        d.template = tpl.label; d.templateId = tpl.id;
	        d.tplPurpose = tpl.purpose; d.captionMode = tpl.captionMode || d.captionMode;
	        d.previewUrl = null; toast(tpl.label + ' 템플릿 적용 완료');
	      } else { toast((r && r.toast) || '이 템플릿은 아직 적용하지 못했어요'); }
	      setScreen('edit');
	    });
	  }

	  function bakeEdit() {
	    var photo = curEditPhoto();
	    var nonzero = photo && (_hasValues(d.adjust) || _hasValues(d.beauty));
	    if (!photo || !nonzero) return Promise.resolve();
	    var src = photo.editedDataUrl || photo.dataUrl;
	    if (window.WorkspaceAdapter && window.WorkspaceAdapter.applyWorkspaceCorrections) {
	      return window.WorkspaceAdapter.applyWorkspaceCorrections({ src: src, adjust: d.adjust, beauty: d.beauty }).then(function (r) {
	        if (r && r.ok && r.dataUrl) { photo.editedDataUrl = r.dataUrl; photo.adjustments = clone(d.adjust); photo.beautyAdjustments = clone(d.beauty); d.adjust = newAdjust(); d.beauty = newBeauty(); d.previewUrl = null; }
	        else { return _bakeCss(photo, src); }
	      });
    }
    return _bakeCss(photo, src);
  }
  function _bakeCss(photo, src) {
    return new Promise(function (res) {
      var im = new Image();
      im.onload = function () {
        try {
          var cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height;
          var c = cv.getContext('2d'); c.filter = filterCss(d.adjust); c.drawImage(im, 0, 0);
          var png = /^data:image\/png/i.test(src);
          photo.editedDataUrl = png ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.92);
          photo.adjustments = clone(d.adjust); d.adjust = newAdjust(); d.previewUrl = null;
        } catch (_e) { /* 실패 시 원본 유지 */ }
        res();
      };
      im.onerror = function () { res(); };
      im.src = src;
    });
  }

	  function reassignRoles() {
	    d.photos.forEach(function (p, i) {
	      if (p.roleManual) return;   // 사용자가 직접 지정(전/후/홍보컷/제외)한 사진은 자동배치에서 보존
	      if (d.baMode && i === 0) p.role = 'before';
	      else if (d.baMode && i === 1) p.role = 'after';
	      else p.role = 'hero';
	    });
	  }
	  // 업로드 화면에서 사진 라벨 탭 → 역할 직접 순환(홍보컷→전→후→제외). 5장 등 직접 묶기 지원.
	  var _ROLE_CYCLE = ['hero', 'before', 'after', 'exclude'];
	  function _cycleRole(i) {
	    var p = d.photos[i]; if (!p) return;
	    var idx = _ROLE_CYCLE.indexOf(p.role || 'hero'); if (idx < 0) idx = 0;
	    p.role = _ROLE_CYCLE[(idx + 1) % _ROLE_CYCLE.length];
	    p.roleManual = true;
	    setScreen('upload');
	  }
	  function addFiles(files, showToast) {
	    files = Array.from(files || []).slice(0, 10);
	    if (!files.length) return Promise.resolve([]);
	    return Promise.all(files.map(fileToDataUrl)).then(function (urls) {
	      urls.forEach(function (u) { d.photos.push({ id: uid(), dataUrl: u, role: 'hero' }); });
	      // [QA hotfix] 다중 업로드 시 전후/홍보컷 자동 확정 금지 — 사용자가 '전/후 토글' 또는
	      //   카테고리/템플릿으로 직접 용도를 고르게 한다. (전/후 카테고리로 진입한 경우만 baMode 유지)
	      reassignRoles(); setScreen('upload');
	      if (showToast) toast(urls.length + '장 추가됨');
	      return urls;
	    });
	  }
	  function syncCaptionFromDom() {
	    var b = el.querySelector('[data-fl-capbody]'); if (b && b.getAttribute('data-empty') !== '1') d.caption = (b.value != null ? b.value : b.textContent).trim();
	    var ig = el.querySelector('[data-fl-igcap]'); if (ig) ig.textContent = d.caption;
	  }

  function back() {
    var i = SCREENS.indexOf(cur);
    if (i > 0) setScreen(SCREENS[i - 1]); else close();
  }
  function onCta() {
    var c = CTA[cur]; if (!c) return;
    if (cur === 'upload' && !d.photos.length && !d.textOnly) { toast('사진을 먼저 추가해 주세요.'); return; }
    if (c.to === '__save') return save();
    if (cur === 'caption') {
      syncCaptionFromDom();
      // [캡션 스킵 방지] 게시글 안 만든 채로 고객연결/미리보기로 못 넘어가게 — 시술명 있으면 바로 생성, 없으면 안내.
      if (!String(d.caption || '').trim()) {
        if (String(d.service || '').trim()) { doGenerate({}, '게시글을 만들었어요'); }
        else { toast('게시글을 먼저 만들어 주세요'); }
        return;
      }
    }
    if (cur === 'edit') { return bakeEdit().then(function () { setScreen(c.to); }); }
    setScreen(c.to);
  }

  function openCropFlow() {
    if (!(window.WorkspaceAdapter && window.WorkspaceAdapter.openCrop)) { toast('크롭 모듈을 불러오지 못했어요'); return; }
    var idx = d.photos.indexOf(curEditPhoto()); if (idx < 0) idx = 0;
    window.WorkspaceAdapter.openCrop({
      photos: d.photos, index: idx, ratio: CROP_RATIO[d.tplPurpose] || '4:5',
      onApply: function (photoId, dataUrl, meta) {
        var p = d.photos.filter(function (x) { return x.id === photoId; })[0];
        if (p) { p.editedDataUrl = dataUrl; p.cropMeta = meta; }
        d.previewUrl = null;
        if (cur === 'edit') { setScreen('edit'); _refreshPreview(); }
      },
    });
  }

  function pickCustomer() {
    if (!window.WorkspaceAdapter) { toast('고객 모듈을 불러오지 못했어요'); return; }
    window.WorkspaceAdapter.pickCustomer(d.customerId).then(function (r) {
      if (r.ok) {
        d.customerId = r.id; d.customerName = r.name; d.customerVc = r.vc || 0;
        setScreen('connect'); toast(r.name + ' 고객과 연결했어요.');
      } else if (r.toast) toast(r.toast);
    });
  }

  function buildSlot() {
    var slot = d.slot || { id: uid(), order: 0, createdAt: Date.now() };
    var now = Date.now();
	    slot.label = d.customerName || slot.label || (d.service ? d.service.split(',')[0].trim() : '새 콘텐츠');
	    slot.photos = d.photos.map(function (p) { return { id: p.id, dataUrl: p.dataUrl, editedDataUrl: p.editedDataUrl || null, role: p.role, cropMeta: p.cropMeta || null, templateId: p.templateId || null, updatedAt: now }; });
	    slot.service = d.service || '';
	    slot.caption = d.caption || '';
    slot.hashtags = (d.selectedHashes && d.selectedHashes.length ? d.selectedHashes : d.hashtags).join(' ');
    slot.customer_id = d.customerId || null;
    slot.customer_name = d.customerName || '';
    slot.status = 'done';
    slot.workspaceContext = Object.assign({}, slot.workspaceContext, {
      type: TYPE_MAP[d.tplPurpose] || 'promo',
      expectedPhotos: d.tplPurpose === 'before_after' ? 2 : 1,
      defaultRatio: CROP_RATIO[d.tplPurpose] || '4:5',
	      templatePurpose: d.tplPurpose || 'feed',
	      templateId: d.templateId || null,
	      templateLabel: d.template || '',
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

  function _markPrepared() {
    if (!d.publish) d.publish = { status: 'draft', instagramPreparedAt: null, publishedAt: null };
    d.publish.status = 'upload_ready'; d.publish.instagramPreparedAt = Date.now();
  }

  // [C6/#10] 게시 — 잇비 봇 로딩 모달(시안 B). 단계 멘트 + 최소 노출감
  var PUB_MSG = [
    ['올리는 중…', '사진을 인스타로 보내고 있어요'],
    ['글 입히는 중…', '게시글·해시태그를 붙이는 중'],
    ['게시 완료!', '인스타그램에 올라갔어요'],
  ];
  var _pubTimer = null;
  function _pubQ(sel) { return el ? el.querySelector(sel) : null; }
  function _pubStage(i) {
    var t = _pubQ('[data-fl-pub-t]'), s = _pubQ('[data-fl-pub-s]');
    if (t) t.textContent = PUB_MSG[i][0];
    if (s) s.textContent = PUB_MSG[i][1];
    var steps = el ? el.querySelectorAll('[data-fl-pub-steps] i') : null;
    if (steps && steps.length) Array.prototype.forEach.call(steps, function (n, j) { n.className = j < i ? 'done' : (j === i ? 'on' : ''); });
    var card = _pubQ('.wsv2pub__card'); if (card) card.classList.toggle('is-done', i >= 2);
  }
  function _pubShow() {
    var p = _pubQ('[data-fl-pub]'); if (!p) return;
    p.hidden = false; p.classList.add('is-open'); _pubStage(0);
    if (_pubTimer) clearTimeout(_pubTimer);
    _pubTimer = setTimeout(function () { _pubStage(1); }, 1100);
  }
  function _pubHide() {
    if (_pubTimer) { clearTimeout(_pubTimer); _pubTimer = null; }
    var p = _pubQ('[data-fl-pub]'); if (p) { p.hidden = true; p.classList.remove('is-open'); }
  }
  function _pubFinish(cb) {
    if (_pubTimer) { clearTimeout(_pubTimer); _pubTimer = null; }
    _pubStage(1);
    setTimeout(function () { _pubStage(2); setTimeout(function () { _pubHide(); if (cb) cb(); }, 1200); }, 350);
  }

	  function publish() {
	    if (!window.WorkspaceAdapter) return;
	    if (!window.WorkspaceAdapter.instagram().connected) { toast('인스타 연결 후 올릴 수 있어요'); return; }
	    if (d._publishing) return;
	    syncCaptionFromDom();
	    d._publishing = true; setScreen('preview');
    var slot = buildSlot();
    _pubShow();
    Promise.resolve(window.WorkspaceAdapter.saveItem ? window.WorkspaceAdapter.saveItem(slot) : { ok: true }).then(function (sr) {
	      if (!sr || !sr.ok) { d._publishing = false; _pubHide(); toast('저장에 실패해 게시를 중단했어요'); setScreen('preview'); return; }
      d.slot = slot;
      if (!window.WorkspaceAdapter.publishInstagramV2) {
	        d._publishing = false; _pubHide(); _markPrepared(); setScreen('preview'); toast('게시 준비 완료 — 업로드 기능을 불러오지 못했어요'); return;
      }
      var cap = (d.caption || '') + (d.hashtags.length ? '\n\n' + d.hashtags.join(' ') : '');
      window.WorkspaceAdapter.publishInstagramV2({ slotId: slot.id, imageUrl: photoUrl(curPhoto()), caption: cap }).then(function (r) {
        r = r || {};
        if (r.ok) {
          d.publish = d.publish || {}; d.publish.status = 'published'; d.publish.publishedAt = Date.now();
          _pubFinish(function () {
            d._publishing = false;
            toast('인스타그램에 올렸어요');
            if (window.WorkspaceV2 && window.WorkspaceV2.refresh) window.WorkspaceV2.refresh();
            setScreen('preview');
          });
          return;
        }
        d._publishing = false; _pubHide();
        if (r.reason === 'ambiguous') { _markPrepared(); toast('게시 준비 완료 — 업로드 결과 확인이 필요해요'); }
	        else {
	          var m = { not_connected: '인스타 연결이 필요해요', blob: '이미지 생성에 실패했어요', api: '업로드 API 호출에 실패했어요', server: '서버가 업로드를 거부했어요' }[r.reason] || '업로드에 실패했어요';
	          console.warn('[wsv2flow] instagram publish failed', r);
	          toast(r.detail ? (m + ' — ' + r.detail) : m);
	        }
        setScreen('preview');
      });
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
	    var incomingFiles = Array.from(opts.files || []);
	    var wc = (slot && slot.workspaceContext) || null;
	    var ctx = CAT_CTX[opts.cat] || {};
	    // [QA hotfix] 사진 2장+ 라고 전후로 자동 확정하지 않음. 전후는 '전후' 카테고리 선택 또는 토글로만.
	    var purpose = (wc && wc.templatePurpose) || ctx.purpose || 'feed';
    var capMode = (wc && wc.captionMode) || ctx.captionMode || 'normal';
    var cm = (slot && slot.captionMeta) || {};
    var hadRoles = !!(slot && slot.photos && slot.photos.some(function (p) { return p && p.role; }));
    d = {
      slot: slot,
      photos: slot && slot.photos ? slot.photos.map(function (p) { return { id: p.id || uid(), dataUrl: p.dataUrl, editedDataUrl: p.editedDataUrl, role: p.role || 'hero', cropMeta: p.cropMeta || null }; }) : [],
      baMode: purpose === 'before_after',
	      template: null, templateId: (wc && wc.templateId) || null, tplCat: ctx.tplLabel || (wc && wc.type === 'before_after' ? '전후' : null),
	      tplPurpose: purpose, captionMode: capMode, defaultRole: ctx.role || 'hero',
      textOnly: !!(opts.textOnly),
      service: slot && slot.service ? slot.service : '', caption: slot ? (slot.caption || '') : '', hashtags: slot && slot.hashtags ? String(slot.hashtags).split(/\s+/).filter(Boolean) : [], selectedHashes: [],
      customerId: slot ? (slot.customer_id || null) : null, customerName: slot ? (slot.customer_name || '') : '', customerVc: 0, custQuery: '',
      capLen: cm.length_tier || 'medium', capTone: cm.tone_override || 'normal', logId: cm.log_id || null,
      publish: (slot && slot.publish) ? Object.assign({}, slot.publish) : { status: 'draft', instagramPreparedAt: null, publishedAt: null },
      recent: [], recentLoaded: false, capLoading: false, capSeg: 'rec',
	      editTab: 'skin', control: null, basicTool: 'brightness', precTool: null, editIdx: null, bgOpen: false, advOpen: true, tplOpen: true, adjust: newAdjust(), beauty: newBeauty(), undo: [], redo: [], originalPreview: false, previewUrl: null, bgAction: null, bgColor: null, bgBusy: false, bgFail: false,
	      captionAxes: null, captionTemplate: '',
	    };
	    if (d.photos.length && !hadRoles) reassignRoles();
    el.classList.add('is-open');
    // textOnly → 바로 게시글 화면으로
    var startScreen = opts.startScreen && SCREENS.indexOf(opts.startScreen) >= 0 ? opts.startScreen : 'upload';
	    if (d.textOnly && startScreen === 'upload') startScreen = 'caption';
	    setScreen(startScreen);
	    if (incomingFiles.length) addFiles(incomingFiles, true);
	  }
  function close() { if (el) el.classList.remove('is-open'); }

  // ── [구조 통합] 프로그램/자연어 명령 API — 잇비가 작업실 전 기능을 호출하는 단일 진입점 ──
  //   기존 내부 함수만 재사용(로직/저장 스키마 미변경). 화면 안 열렸을 때 'open' 외 명령은 무시.
  function _flowReady() { return !!(el && el.classList.contains('is-open') && d); }
  function _applyAdjustPatch(opts) {
    if (!_flowReady()) return { ok: false, reason: 'not_open' };
    d.undo = d.undo || []; d.undo.push(_snapEdit()); if (d.undo.length > 30) d.undo.shift(); d.redo = [];
    var set = opts.set || null, delta = opts.delta || null;
    if (set) Object.keys(set).forEach(function (k) { if (k in d.adjust) d.adjust[k] = Math.max(-100, Math.min(100, +set[k] || 0)); });
    if (delta) Object.keys(delta).forEach(function (k) { if (k in d.adjust) d.adjust[k] = Math.max(-100, Math.min(100, (+d.adjust[k] || 0) + (+delta[k] || 0))); });
    if (opts.beauty) Object.keys(opts.beauty).forEach(function (k) { if (k in d.beauty) d.beauty[k] = Math.max(0, Math.min(100, +opts.beauty[k] || 0)); });
    if (cur === 'edit') { _paintEditPhoto(); _setEditSection('[data-ed-basic]', _mainAdjustHtml()); _setEditSection('[data-ed-adv]', _advFoldHtml()); _setEditSection('[data-ed-bottom]', _editBottomHtml()); }
    _refreshPreview();
    return { ok: true };
  }
  function command(cmd) {
    cmd = cmd || {};
    switch (cmd.type) {
      case 'open':
        open({ cat: cmd.cat || null, startScreen: cmd.screen || 'upload', textOnly: !!cmd.textOnly, files: cmd.files || null });
        return { ok: true };
      case 'goto':
        if (!_flowReady() || SCREENS.indexOf(cmd.screen) < 0) return { ok: false, reason: 'not_open' };
        setScreen(cmd.screen); return { ok: true };
      case 'adjust':
        return _applyAdjustPatch(cmd);
      case 'edit':   // 되돌리기/다시실행/비교/초기화
        if (!_flowReady()) return { ok: false, reason: 'not_open' };
        if (cur !== 'edit') setScreen('edit');
        _editBottom(cmd.action); return { ok: true };
      case 'bg':
        if (!_flowReady()) return { ok: false, reason: 'not_open' };
        if (cur !== 'edit') setScreen('edit');
        if (cmd.color) d.bgColor = cmd.color;
        applyBg(cmd.action || 'removeBg'); return { ok: true };
      case 'template':
        if (!_flowReady()) return { ok: false, reason: 'not_open' };
        if (cur !== 'edit') setScreen('edit');
        applyTemplate(cmd.key); return { ok: true };
      case 'caption':
        if (!_flowReady()) return { ok: false, reason: 'not_open' };
        if (cmd.service != null) d.service = String(cmd.service);
        if (cur !== 'caption') setScreen('caption');
        doGenerate(cmd.extra || {}, cmd.label || null); return { ok: true };
      case 'capvar':   // 다시/더길게/짧게/해시태그더/인스타스럽게/초기화
        if (!_flowReady() || cur !== 'caption') return { ok: false, reason: 'not_caption' };
        if (cmd.variant === 'reset') { d.caption = ''; d.hashtags = []; d.selectedHashes = []; d.capLen = 'medium'; d.capTone = 'normal'; d.logId = null; setScreen('caption'); return { ok: true }; }
        { var ex = { regen: {}, long: { length_tier: 'long' }, short: { length_tier: 'short' }, hashtags: { hashtag_mode: 'more' }, insta: { tone_override: 'instagram' } }[cmd.variant] || {};
          doGenerate(ex, cmd.label || null); return { ok: true }; }
      case 'save':
        if (!_flowReady()) return { ok: false, reason: 'not_open' };
        save(); return { ok: true };
      case 'publish':
        if (!_flowReady()) return { ok: false, reason: 'not_open' };
        setScreen('preview'); publish(); return { ok: true };
      default:
        return { ok: false, reason: 'unknown' };
    }
  }
  function isOpen() { return _flowReady(); }

  window.WorkspaceFlow = { open: open, close: close, command: command, isOpen: isOpen };
})();
