/* Workspace V2 플로우 — 프로토타입 2~6 화면(업로드→편집→게시글→고객연결→미리보기→게시).
   [C4] 캡션→게시글 네이밍, 가짜 HASHES 제거, [다시]/[더 짧게]/[더 길게] 버튼.
   [C5] 고객연결 — 그라데이션 아바타 제거, _barClass(vc) 컬러바+N회 배지.
   [C6] 단계 순서: upload→edit→caption(게시글)→connect→preview→게시. 발행=uploadProgressPopup.
   진입: WorkspaceFlow.open({ slot?, startScreen?, cat?, files?, textOnly? }). */
(function () {
  'use strict';

  // [v542] ?photoDebug=1 → 보정 디버그 전역 플래그 활성([photofx] 로그·마스크 오버레이·디버그 패널).
  try { if (/[?&]photoDebug=1/.test(location.search || '')) window.__ITDASY_PHOTO_DEBUG__ = true; } catch (_e) { void _e; }

  // [C6] 단계 순서 변경: connect가 preview 앞으로
  // [v560] 'template' step 신설 — 편집과 게시글 사이. 전/후 클릭 지정 + 템플릿 선택을 한 화면에서.
  var SCREENS = ['upload', 'edit', 'template', 'caption', 'connect', 'preview'];
  // [Phase A-1] 심플 플로우 — 편집/템플릿 단계를 기본 경로에서 숨김(사진→게시글→고객→미리보기).
  //   기능/코드는 삭제하지 않고 보존: edit/template 화면·핸들러 그대로 두고 '기본 다음 경로'에서만 제외.
  //   (Phase A-2에서 캡션 화면의 '직접 편집' 진입점으로 edit/template 도달 경로를 다시 연결한다.)
  //   롤백: window.ITDASY_WS_SIMPLE_FLOW = false → 기존 6단계 플로우 그대로 복원.
  var SIMPLE_FLOW = (window.ITDASY_WS_SIMPLE_FLOW !== false);
  // 진행 표시(단계 X/N·진행바)·다음 화면 계산에 쓰는 '실제로 보이는 단계' 목록.
  // [v583·C] 인스타 미리보기 단계 폐지 — 미리보기 디자인+업로드는 캡션 결과 화면에 통합. 고객연결이 마지막 단계.
  var VISIBLE_SCREENS = SIMPLE_FLOW ? ['upload', 'caption', 'connect'] : SCREENS;
  var TITLE = { upload:'사진 업로드', edit:'편집', template:'템플릿 선택', caption:'게시글 만들기', connect:'고객 연결', preview:'인스타 미리보기' };
  var CTA = {
    upload: { l:'편집으로 →', to:'edit' },   // '추가'(머무름)와 구분 — 이 버튼만 편집 화면으로 이동
    edit:   { l:'저장하고 게시글 쓰기', to:'caption' },   // [v560] 좌측 절반. 우측 'cta2'=템플릿 선택하기.
    template:{ l:'이대로 게시글 쓰기', to:'caption' },
    caption:{ l:'고객 연결로', to:'connect' },
    connect:{ l:'저장하고 완료', to:'__save' },   // [v583·C] 고객연결=마지막 단계 → 저장 후 작업실로
  };
  // [Phase A-1] 심플 플로우: 업로드 다음 단계를 '편집'이 아닌 '캡션 생성(caption)'으로 직행.
  if (SIMPLE_FLOW) CTA.upload = { l:'캡션 생성 →', to:'caption' };
  // [Phase A-2] 캡션 화면 명칭을 스펙(이미지 01)에 맞춰 '캡션 생성'으로(상단 타이틀).
  if (SIMPLE_FLOW) TITLE.caption = '캡션 생성';
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
	      // [v560] 기능명 정직화 — 효과는 '보정/완화(enhancement)'이지 '생성'이 아니므로 '~감/완화'로 표기.
	      { k: 'hairDetail', l: '머릿결 선명도', ic: 'ph-wind' },
	      { k: 'hairVolume', l: '볼륨감 보정', ic: 'ph-waves' },
	      { k: 'hairShine', l: '윤기감 보정', ic: 'ph-sparkle' },
		      { k: 'hairEndsClean', l: '잔머리 완화', ic: 'ph-scissors' } ] },
	    { k: 'eyes', label: '눈썹·눈가', ic: 'ph-eye', controls: [
	      { k: 'browSharp', l: '눈썹 선명도', ic: 'ph-pencil-simple' },
	      { k: 'lashSharp', l: '눈가 선명도', ic: 'ph-eye' },
	      { k: 'eyeRedness', l: '눈 맑게', ic: 'ph-drop' },
	      { k: 'catchLight', l: '눈 밝게', ic: 'ph-sun' } ] },
	    { k: 'nail', label: '네일', ic: 'ph-hand-heart', controls: [
	      { k: 'nailGloss', l: '네일 광택', ic: 'ph-sparkle' },
	      { k: 'nailShape', l: '네일 경계', ic: 'ph-lightning' } ] },
	    { k: 'tools', label: '고급', ic: 'ph-faders', controls: [] },
	  ];
	  var WORKSPACE_TEMPLATES = [
	    { key: 'ba', label: '전후 비교', use: '전후 2장', chip: '전후', id: 'wm-ba-feed', purpose: 'before_after', captionMode: 'normal' },
    // [BA-PACK v533] 전후 에디토리얼 5종 — 작업실 갤러리 노출(레이아웃 명확히 구분).
    { key: 'ba-premium', label: '프리미엄 전후', use: '정보카드형', chip: '전후', id: 'bp-ba-premium-infographic', purpose: 'before_after', captionMode: 'normal' },
    { key: 'ba-luxury', label: '럭셔리 후기 전후', use: '대형 타이포·별점', chip: '전후', id: 'bp-ba-luxury-review', purpose: 'before_after', captionMode: 'normal' },
    { key: 'ba-story', label: '스토리 전후', use: '추천·정보·후기', chip: '전후', id: 'bp-ba-story-signature', purpose: 'before_after', captionMode: 'normal' },
    { key: 'ba-classic', label: '클래식 포스터 전후', use: '대각 리본', chip: '전후', id: 'bp-ba-classic-poster', purpose: 'before_after', captionMode: 'normal' },
    { key: 'ba-care', label: '케어 가이드 전후', use: '시술정보형', chip: '전후', id: 'bp-ba-care-guide', purpose: 'before_after', captionMode: 'normal' },
	    { key: 'showcase', label: '시술 자랑', use: '완성컷 강조', chip: '시술 자랑', id: 'wm-show-feed', purpose: 'feed', captionMode: 'normal' },
	    { key: 'review', label: '고객 후기', use: '후기 카드', chip: '고객 후기', id: 'wm-review-feed', purpose: 'review', captionMode: 'review' },
	    { key: 'event', label: '이벤트 안내', use: '혜택 안내', chip: '이벤트', id: 'wm-event-feed', purpose: 'event', captionMode: 'normal' },
	    { key: 'feed', label: '인스타 피드', use: '피드용 안내', chip: '시술 자랑', id: 'wm-promo-feed', purpose: 'feed', captionMode: 'normal' },
	    { key: 'story', label: '스토리 홍보', use: '세로 홍보', chip: '스토리', id: 'wm-promo-story', purpose: 'story', captionMode: 'normal' },
	    // [v561·항목5] 단순 사진 붙이기 — 꾸밈 없이 2장을 50:50 으로. before_after 처럼 2장 필요.
	    { key: 'stitch-lr', label: '좌우 붙이기', use: '두 장 나란히', chip: '붙이기', id: 'wm-stitch-lr', purpose: 'collage', collage: 'lr', captionMode: 'normal' },
	    { key: 'stitch-tb', label: '상하 붙이기', use: '두 장 위아래', chip: '붙이기', id: 'wm-stitch-tb', purpose: 'collage', collage: 'tb', captionMode: 'normal' },
	  ];
	  function newAdjust() { return { brightness:0, contrast:0, saturation:0, sharpness:0, color:0 }; }
	  function newBeauty() { return { skin:0, textureSmooth:0, blemish:0, hairDetail:0, hairVolume:0, hairShine:0, hairFull:0, hairEndsClean:0, browSharp:0, lashSharp:0, eyeRedness:0, catchLight:0, nailGloss:0, nailShape:0, handSkin:0 }; }
  var d = null;
  var el = null;
  var cur = 'upload';
  // [nav] 방문 히스토리 스택 — 뒤로가기는 정적 SCREENS 인덱스가 아니라 '실제로 거쳐온 화면'으로 복귀.
  //  textOnly(게시물만 쓰기)로 caption에 바로 진입하면 스택이 비어 있어 뒤로가기가 작업실 홈으로 닫힌다.
  var navStack = [];
  // [#1] 안드로이드/PWA 시스템 back 안정화 — 단계마다 실제 history 엔트리를 쌓는다(navStack 과 1:1).
  //   기존엔 진입 시 1개만 push 하고 popstate 안에서 재push(재무장)했는데, 일부 안드로이드 WebView 가
  //   popstate 도중의 pushState 를 무시해 두 번째 back 에서 history 가 비어 앱이 종료됐다.
  //   이제 각 단계 진입에서 미리 엔트리를 쌓으므로 back 1회 = 한 화면 복귀, 재무장 불필요.
  var _histDepth = 0;      // 우리가 push 한 단계 엔트리 수
  var _popBound = false;   // popstate 리스너 1회 등록 가드
  var _closingHist = false; // 프로그램적 close(저장/게시) 시 history 되감기 중 popstate 무시
  function _pushHist() {
    try { history.pushState({ wsv2: 'step' }, '', '#wsv2flow'); _histDepth++; } catch (_e) { void _e; }
  }
  function _bindPop() {
    if (_popBound) return; _popBound = true;
    // 단계가 남아있으면 한 화면 뒤로 — 시스템 back/브라우저 back/인앱 back 모두 동일 결과.
    //  베이스(#wsv2flow 마지막 엔트리)가 빠질 땐 전역 sheet 레지스트리(_systemBack)가 닫고 작업실 홈으로.
    window.addEventListener('popstate', function () {
      if (_closingHist) return;
      _navBack();
    });
  }
  // [v531] 한 단계 뒤로 — 시스템/브라우저/인앱 back 공통. 캡션 결과 화면이면 먼저 캡션 입력으로(편집으로 안 튐).
  function _navBack() {
    if (!el || !el.classList.contains('is-open')) return false;
    // [v587·#5] 편집기(seOverlay)가 열렸거나 방금 popstate 로 닫힌 back 이면 flow 가 같은 back 을 중복 처리하지 않는다.
    //   (전역 시트 시스템이 편집기를 먼저 닫음 → 작업실 단계는 그대로 유지, 앱 종료 방지.)
    if (window.__seOpen || window.__seSwallowPop) return false;
    // 캡션 생성 완료(결과) + 그 위에 우리가 push한 'caption' 마커가 있으면 → 결과를 비우고 캡션 입력 화면으로.
    if (cur === 'caption' && String(d.caption || '').trim() && navStack.length && navStack[navStack.length - 1] === 'caption') {
      if (_histDepth > 0) _histDepth--;
      navStack.pop();
      d.caption = ''; d.hashtags = []; d.selectedHashes = []; d.logId = null;
      setScreen('caption', { push: false });
      return true;
    }
    if (navStack.length) {
      if (_histDepth > 0) _histDepth--;
      if (cur === 'caption') flushCaptionInputs();
      setScreen(navStack.pop(), { push: false });
      return true;
    }
    return false;
  }

  function uid() { return (typeof window._uid === 'function') ? window._uid() : 'wf_' + Math.random().toString(36).slice(2); }
  function toast(m) { if (window.showToast) window.showToast(m); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]; }); }
  function fileToDataUrl(f) {
    if (typeof window._fileToDataUrl === 'function') return window._fileToDataUrl(f);
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsDataURL(f); });
  }
  // [#2] 선택된 사진만(해제=selected:false 제외) · 선택순(selSeq)으로 정렬 → 순서배지/대표사진 일관.
  function editablePhotos() {
    return d.photos.filter(function (x) { return x.selected !== false && x.role !== 'exclude'; })
      .sort(function (a, b) { return (a.selSeq || 0) - (b.selSeq || 0); });
  }
  // 선택 사진을 선택순으로 — 순서배지 계산용(표시는 업로드 배열순 유지, 배지 숫자만 선택순 랭크).
  function _selectedOrdered() {
    return d.photos.filter(function (x) { return x.selected !== false; })
      .slice().sort(function (a, b) { return (a.selSeq || 0) - (b.selSeq || 0); });
  }
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
    // [이슈3] 즉시 시각 피드백 — 선택 테두리/aria 를 동기로 토글(무거운 bake/렌더를 기다리지 않음).
    if (el) {
      el.querySelectorAll('[data-fs="edit"] [data-fl-editsel]').forEach(function (b) {
        var on = +b.getAttribute('data-fl-editsel') === idx;
        b.classList.toggle('on', on); b.setAttribute('aria-selected', on);
      });
    }
    // 현재 보정은 백그라운드로 굽고(다른 사진 오적용 방지), 끝나면 편집 상태만 부분 갱신.
    bakeEdit().then(function () {
      d.editIdx = idx;
	      d.adjust = newAdjust(); d.beauty = newBeauty(); d.undo = []; d.redo = []; d.previewUrl = null;
      d.originalPreview = false; d.basicTool = null;
      d.bgAction = null; d.bgColor = null; d.bgFail = false; d.bgBusy = false;
      d.zoom = { s: 1, tx: 0, ty: 0 };
      // [이슈3] setScreen('edit') 전체 재렌더(템플릿 6칸 대용량 dataURL 재디코딩) 대신 필요한 섹션만 교체 → 즉각 전환.
      _paintEditPhoto();
      _setEditSection('[data-ed-switcher]', _editSwitcherHtml());
      _setEditSection('[data-ed-basic]', _mainAdjustHtml());
      _setEditSection('[data-ed-bottom]', _editBottomHtml());
      _setEditSection('[data-ed-adv]', _advFoldHtml());
      if (d.maskView) _renderMaskOverlay();   // [v539] 사진 전환 시 마스크 overlay 갱신
      if (d.maskPaint) { _ensurePaintDims(function () { _renderPaintOverlay(); }); }   // [v561] 칠하기 모드 유지 시 새 사진 기준 재렌더
      _warmEditMasks();
    });
  }
  function photoUrl(p) { return p ? (p.editedDataUrl || p.dataUrl) : ''; }
  // [이슈2/11] 게시 대표 이미지 — 전후 템플릿 "적용 결과물"(d.templateOutput)이 있으면 그것을, 없으면 대표 사진.
  //   합성 결과물은 별도 필드로만 관리한다. 편집화면 사진 스트립/썸네일은 절대 이 값을 쓰지 않으므로
  //   원본/후사진 슬롯이 합성본으로 오염되지 않는다(이슈2). 해제하면 d.templateOutput=null → 원본 복귀(이슈11).
  function outputUrl() {
    // [다중pair] 캐러셀에서 선택된 결과물/사진(activeDisplayId)이 있으면 그것을, 없으면 첫 결과물 → 대표 사진.
    if (d && d.activeDisplayId) {
      var outs = d.templateOutputs || [];
      for (var i = 0; i < outs.length; i++) { if (outs[i].pairId === d.activeDisplayId) return outs[i].outputUrl; }
      var ph = (d.photos || []).filter(function (p) { return p.id === d.activeDisplayId; })[0];
      if (ph) return photoUrl(ph);
    }
    return (d && d.templateOutput) || (d && d.templateOutputs && d.templateOutputs[0] && d.templateOutputs[0].outputUrl) || dispUrl(curPhoto());
  }

  // [Phase B-1] 스토리 편집기 진입 — 사진 + 우리샵 스타일 좌표로 텍스트 자동배치 → StoryEditor.
  //   시술 내용(여러 줄)을 제목/부제목/본문 레이어로 매핑. 저장 시 baked 결과를 대표 사진 editedDataUrl 로.
  // [v583] 시술내역을 시술명/시술내용으로 분리(편집기 레이어로 각각 뜨게). 말투 지시어는 본문 텍스트에서 제거.
  //   줄바꿈/콤마/가운뎃점으로 우선 분리, 한 줄 입력이면 첫 토큰=시술명·나머지=시술내용.
  function _splitServiceForLayers(svc) {
    var s = String(svc || '')
      .replace(/(?:인스타|sns|감성|내추럴|모던|빈티지|러블리|시크|트렌디|미니멀|청순|글램|깔끔|세련|화사)?\s*(?:톤앤무드|톤앤매너|톤|느낌|감성|무드|분위기|바이브)\s*(?:으로|로|하게|있게|스럽게)\s*(?:마무리|마감|연출|편집|보정|작성)?/gi, ' ');
    var segs = s.split(/[\n,·、]+/).map(function (x) { return x.trim(); }).filter(Boolean);
    if (segs.length >= 2) return { title: segs[0], sub: segs[1], body: segs.slice(2).join(' ') };
    var w = (segs[0] || '').split(/\s+/).filter(Boolean);
    if (w.length >= 2) return { title: w[0], sub: w.slice(1).join(' '), body: '' };
    return { title: w[0] || '', sub: '', body: '' };
  }
  // [v587] 깨끗한 합성 기준 사진 — 편집기·자동합성 모두 '텍스트가 안 박힌 원본' 위에 올린다(이중 합성 방지).
  function _cleanBase(p) { return p ? (p.baseUrl || p.dataUrl) : ''; }
  // [v591·#6] 사진에서 대표 색 추출 — 클라이언트 canvas(서버/AI 비용 0). 28px 다운샘플 후
  //   근사 흰/검 제외하고 5비트 버킷 빈도순 상위색 반환. 폰트/로고 자동추출은 부정확해 미지원(수동).
  function _extractPalette(url, cb) {
    try {
      var img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = function () {
        try {
          var n = 28, c = document.createElement('canvas'); c.width = n; c.height = n;
          var g = c.getContext('2d'); g.drawImage(img, 0, 0, n, n);
          var data = g.getImageData(0, 0, n, n).data, buckets = {};
          for (var i = 0; i < data.length; i += 4) {
            var r = data[i], gg = data[i + 1], b = data[i + 2], a = data[i + 3];
            if (a < 128) continue;
            var mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
            if (mx > 240 && mn > 228) continue;   // 근사 흰색 제외
            if (mx < 26) continue;                 // 근사 검정 제외
            var key = (r >> 5) + ',' + (gg >> 5) + ',' + (b >> 5);
            var k = buckets[key] || (buckets[key] = { n: 0, r: 0, g: 0, b: 0 });
            k.n++; k.r += r; k.g += gg; k.b += b;
          }
          var arr = Object.keys(buckets).map(function (key) { var k = buckets[key]; return { n: k.n, r: Math.round(k.r / k.n), g: Math.round(k.g / k.n), b: Math.round(k.b / k.n) }; });
          arr.sort(function (x, y) { return y.n - x.n; });
          cb(arr.slice(0, 6).map(function (k) { return '#' + [k.r, k.g, k.b].map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join(''); }));
        } catch (_e) { cb([]); }
      };
      img.onerror = function () { cb([]); };
      img.src = url;
    } catch (_e) { cb([]); }
  }
  // [v591·#6] 추천 색 탭 → 활성 우리샵 스타일의 모든 텍스트 역할 글자색에 적용(저장 + 미리보기 재합성).
  function _applyBrandColor(hex) {
    try {
      var SS = window.ShopStyle; if (!(SS && SS.getActive && SS.save)) return;
      var ss = SS.getActive(); if (!ss || !Array.isArray(ss.layers)) return;
      var TEXT = { title: 1, sub: 1, body: 1, hashtag: 1 };
      var layers = ss.layers.map(function (L) { return TEXT[L.role] ? Object.assign({}, L, { color: hex }) : L; });
      SS.save(ss.id, { layers: layers });
      (d.photos || []).forEach(function (p) { p._tplSig = null; });   // 미리보기 재합성 유도
      toast('우리샵 글자색을 바꿨어요');
      setScreen('caption');
    } catch (_e) { void _e; }
  }
  // [v587·C] 우리샵 스타일 레이어 빌더 — 편집기 진입과 헤드리스 자동합성이 공유.
  function _buildShopStyleLayers() {
    var ss = (window.ShopStyle && window.ShopStyle.getActive) ? window.ShopStyle.getActive() : null;
    var roleText = _splitServiceForLayers(d.service);   // [v583·A] 시술명/시술내용 분리
    var layers = [];
    var autoArranged = false;
    if (ss && d.useShopStyle !== false) {
      // [v587·B-3] 해시태그도 오버레이 레이어로 — 생성된 해시태그 상위 4개만(사진 위 과밀 방지).
      var hs = (d.selectedHashes && d.selectedHashes.length ? d.selectedHashes : (d.hashtags || []));
      var hashText = hs.slice(0, 4).join(' ');
      ss.layers.forEach(function (L) {
        // [v590] 사용자가 이전에 편집기에서 제거한 레이어(예: 해시태그)는 enabled:false → 다음부터 자동배치 제외.
        if (L.enabled === false) return;
        var text = (L.role === 'hashtag') ? hashText : roleText[L.role];
        if (!text) return;
        // [v583·B] shop-style 좌표는 좌상단(좌측 끝) 기준 → story-editor 중앙 기준으로 변환(화면 밖 이탈 방지).
        var cx = (L.x != null ? L.x + (L.w != null ? L.w : 0.84) / 2 : 0.5);
        cx = Math.max(0.14, Math.min(0.86, cx));
        layers.push(Object.assign({}, L, { text: text, x: cx }));
      });
      // [C] 우리샵 브랜드 자산 완전 자동배치 — 로고(이미지)·워터마크(텍스트)도 함께 올림.
      var _cx = function (x, w) { return Math.max(0.1, Math.min(0.9, (x != null ? x + (w != null ? w : 0.2) / 2 : 0.82))); };
      if (ss.logo && ss.logo.dataUrl) {
        layers.push({ type: 'image', role: 'logo', src: ss.logo.dataUrl, x: _cx(ss.logo.x, ss.logo.w), y: (ss.logo.y != null ? ss.logo.y : 0.1), w: (ss.logo.w != null ? ss.logo.w : 0.24), opacity: (ss.logo.opacity != null ? ss.logo.opacity : 1) });
      }
      if (ss.watermark && (ss.watermark.text || '').trim()) {
        layers.push({ type: 'badge', role: 'watermark', text: ss.watermark.text.trim(), x: _cx(ss.watermark.x, 0.3), y: (ss.watermark.y != null ? ss.watermark.y : 0.93), size: 0.032, bg: 'rgba(0,0,0,.32)', color: (ss.watermark.color || '#ffffff'), opacity: (ss.watermark.opacity != null ? ss.watermark.opacity : 0.9) });
      }
      autoArranged = layers.length > 0;   // 우리샵 스타일로 자동배치됨 → AI 배치 배너+다시배치 노출
    }
    if (!layers.length) layers = [{ text: roleText.title || '텍스트', role: 'title', x: 0.5, y: 0.5, w: 0.8, size: 0.08, align: 'center' }];
    return { ss: ss, layers: layers, ratio: ss ? ss.frame.ratio : '4:5', autoArranged: autoArranged };
  }
  // [v589·#3] 표시용 URL — 입력 화면/뒤로가기는 '원본', 캡션 '결과' 화면에서만 템플릿 적용 미리보기를 보여준다.
  //   사진 자체(editedDataUrl)는 절대 건드리지 않으므로(수동 '사진 꾸미기' 저장 제외) 뒤로가기 시 원본 유지.
  //   tplPreviewUrl = 결과 전용 합성본(헤드리스). storyEdited(수동 편집)면 그 결과가 우선.
  function dispUrl(p) {
    if (!p) return '';
    if (!p.storyEdited && String(d.caption || '').trim() && p.tplPreviewUrl) return p.tplPreviewUrl;
    return p.editedDataUrl || p.dataUrl;
  }
  // [v589·#3] 캡션 결과 화면에서 우리샵 스타일을 각 사진에 헤드리스 합성 → tplPreviewUrl(결과 전용).
  //   사진 원본은 그대로. 입력 시그니처로 1회만(서비스/해시/스타일 동일하면 생략). 멀티포토 각각 합성.
  function _autoComposeTemplate() {
    try {
      if (d.useShopStyle === false) return;
      if (!(window.StoryEditor && window.StoryEditor.compose)) return;
      var built = _buildShopStyleLayers();
      if (!built.autoArranged) return;
      var hsig = (d.selectedHashes && d.selectedHashes.length ? d.selectedHashes : d.hashtags) || [];
      var sigBase = JSON.stringify({ s: d.service, h: hsig, r: built.ratio, n: built.layers.length, v: (built.ss && built.ss.version) });
      var photos = editablePhotos(); if (!photos.length) return;
      // [v590·#3] 성능 — 화면에 보이는(활성) 사진을 먼저 합성해 결과가 즉시 반영되게(나머지는 뒤따라).
      var active = curPhoto();
      var ordered = photos.slice().sort(function (a, b) { return (a === active ? -1 : 0) - (b === active ? -1 : 0); });
      var refresh = function () { if (cur === 'caption' && String(d.caption || '').trim()) { d.previewUrl = null; setScreen('caption'); } };
      var jobs = [];
      ordered.forEach(function (p) {
        if (p.storyEdited) return;                 // 수동 편집 사진은 그대로
        if (p._tplSig === sigBase && p.tplPreviewUrl) return;   // 동일 입력 → 재합성 생략
        p._tplSig = sigBase;
        jobs.push(window.StoryEditor.compose({ photoUrl: p.dataUrl, ratio: built.ratio, layers: built.layers })
          .then(function (url) { if (url) { p.tplPreviewUrl = url; if (p === active) refresh(); } }));   // 활성 사진 끝나면 즉시 갱신
      });
      if (jobs.length) Promise.all(jobs).then(refresh);   // 나머지까지 완료되면 최종 갱신
    } catch (_e) { void _e; }
  }
  function _openStoryEditor() {
    // [itd-editor] 플래그 ON 이면 새 인스타식 편집기(ItdEditor), 아니면 기존 StoryEditor.
    //   동일 계약(open{photoUrl,onDone(dataUrl,meta)}) → 진입점/되먹임 그대로.
    var Editor = (window.ITDASY_ITD_EDITOR && window.ItdEditor && window.ItdEditor.open) ? window.ItdEditor : window.StoryEditor;
    if (!(Editor && Editor.open)) { toast('편집 모듈을 불러오지 못했어요'); return; }
    var p0 = curPhoto(); if (p0 && !p0.baseUrl) p0.baseUrl = p0.dataUrl;
    var photo = _cleanBase(p0) || outputUrl();   // [v587] 편집기는 항상 깨끗한 원본 위에서 시작(이중 합성 방지)
    var built = _buildShopStyleLayers();
    var layers = built.layers, autoArranged = built.autoArranged;
    // [v590] 진입 시 올린 텍스트 역할 기록 — 저장 시 빠진 역할(사용자가 지움)을 스타일에서 비활성화하는 비교 기준.
    d._editorOpenRoles = layers.filter(function (l) { return l.type === 'text' && l.role; }).map(function (l) { return l.role; });
    Editor.open({
      photoUrl: photo,
      photos: (editablePhotos() || []).map(function (p) { return _cleanBase(p) || photoUrl(p); }),   // [itd] 좌우2장/4장 콜라주용
      ratio: built.ratio,
      layers: layers,
      autoArranged: autoArranged,
      onDone: function (dataUrl, meta) {
        var p = curPhoto();
        if (p) { p.editedDataUrl = dataUrl; p.storyEdited = true; }
        d.previewUrl = null;
        _learnShopStyle(meta && meta.layers);   // [v587·C] 편집 결과를 우리샵 스타일로 학습
        if (cur === 'caption') setScreen('caption');
        toast('사진을 꾸몄어요');
      }
    });
  }
  // [v587·C] ShopStyle 학습 피드백 루프 — 편집기에서 바꾼 폰트/색/위치/외곽선을 활성 스타일에
  //   되저장해 다음 사진부터 같은 스타일로 자동배치한다. (중앙x → 좌상단x 역변환)
  function _learnShopStyle(layers) {
    try {
      if (!Array.isArray(layers)) return;
      if (d.useShopStyle === false) return;
      var SS = window.ShopStyle; if (!(SS && SS.getActive && SS.save)) return;
      var ss = SS.getActive(); if (!ss || !Array.isArray(ss.layers)) return;
      var byRole = {};
      layers.forEach(function (l) { if (l && l.type === 'text' && l.role && !byRole[l.role]) byRole[l.role] = l; });
      var TEXT_ROLES = { title: 1, sub: 1, body: 1, hashtag: 1 };
      var openedRoles = d._editorOpenRoles || [];   // 이번 편집에 '올라갔던' 역할들(빠지면 사용자가 지운 것)
      var changed = false;
      var newLayers = ss.layers.map(function (L) {
        if (!TEXT_ROLES[L.role]) return L;
        var e = byRole[L.role];
        if (e) {
          // 존재 → 폰트/색/위치/외곽선 학습 + 다시 활성화.
          changed = true;
          var w = (e.w != null ? e.w : (L.w != null ? L.w : 0.84));
          var leftX = Math.max(0, Math.min(1, (e.x != null ? e.x - w / 2 : L.x)));
          return Object.assign({}, L, {
            x: leftX, y: (e.y != null ? e.y : L.y), w: w,
            font: e.font || L.font, color: e.color || L.color,
            size: (e.size != null ? e.size : L.size), weight: (e.weight != null ? e.weight : L.weight),
            align: e.align || L.align,
            lineHeight: (e.lineHeight != null ? e.lineHeight : L.lineHeight),
            letterSpacing: (e.letterSpacing != null ? e.letterSpacing : L.letterSpacing),
            opacity: (e.opacity != null ? e.opacity : L.opacity),
            outline: Object.assign({}, L.outline || {}, { on: !!e.stroke }),
            shadow: Object.assign({}, L.shadow || {}, { on: !!e.shadow }),
            enabled: true
          });
        }
        // [v590] 올렸는데 저장 결과에 없음 = 사용자가 편집기에서 제거 → 비활성화(다음부터 이 스타일은 해당 레이어 안 올림).
        if (openedRoles.indexOf(L.role) >= 0 && L.enabled !== false) { changed = true; return Object.assign({}, L, { enabled: false }); }
        return L;
      });
      if (!changed) return;
      SS.save(ss.id, { layers: newLayers });
    } catch (_e) { void _e; }
  }
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
      '<div class="wsv2flow__progress">' + VISIBLE_SCREENS.map(function () { return '<i class="pg-seg"></i>'; }).join('') + '</div>' +
      '<div class="wsv2flow__screens">' +
        '<section class="wsv2flow__s" data-fs="upload"></section>' +
        '<section class="wsv2flow__s" data-fs="edit"></section>' +
        '<section class="wsv2flow__s" data-fs="template"></section>' +
        '<section class="wsv2flow__s" data-fs="caption"></section>' +
        '<section class="wsv2flow__s" data-fs="connect"></section>' +
        '<section class="wsv2flow__s" data-fs="preview"></section>' +
      '</div>' +
      // [v560] 편집 화면은 CTA 2분할 — 좌:저장하고 게시글 쓰기 / 우:템플릿 선택하기(cta2). 그 외 화면은 단일.
      '<footer class="wsv2flow__actionbar"><button class="wsv2flow__cta wsv2flow__cta--alt hidden" data-fl="cta2"></button><button class="wsv2flow__cta" data-fl="cta">다음</button></footer>' +
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

  // [업로드 우선] 사진은 업로드가 먼저 — 클릭순 순서배지 + 사진별 전/후/기본 역할.
  //  탭 = 맨 앞으로(순서 조정), 휴지통 = 삭제. 전후 묶기 확장 위해 role(before/after/hero) 구조 유지.
  var _ROLE_SEG = [['before', '전'], ['after', '후'], ['hero', '기본']];
  // [#2] 인스타식 다중선택 — 탭하면 선택/해제 토글. 선택된 사진만 순서배지(선택순 랭크)·역할 세그먼트 노출.
  //   해제하면 배지 사라지고 남은 선택 사진이 1부터 다시 매겨짐(건너뛴 번호 없음). 다시 누르면 맨 끝 순서로.
  // [v531 렉] 역할 세그 HTML — 부분 갱신(_repaintUpload)에서도 재사용.
  function _segHtml(role, i) {
    return '<div class="thumb-seg" role="group" aria-label="이 사진 역할 지정">' +
      _ROLE_SEG.map(function (rl) {
        return '<button type="button" class="thumb-seg-b' + (rl[0] === 'hero' ? ' basic' : '') + (role === rl[0] ? ' on' : '') + '" data-fl-setrole="' + i + ':' + rl[0] + '">' + rl[1] + '</button>';
      }).join('') +
    '</div>';
  }
  function _upTileHtml(p, i, multi, order) {
    var selected = p.selected !== false;
    var role = p.role || 'hero';
    var seg = (multi && selected) ? _segHtml(role, i) : '';
    return '<div class="photo-tile' + (selected ? ' selected' : '') + '" style="background-image:url(' + esc(p.dataUrl) + ')" data-fl-tile="' + i + '" aria-pressed="' + selected + '">' +
      (selected ? '<span class="thumb-order">' + order + '</span>' : '') +
      '<button class="thumb-del" data-fl-del="' + i + '" aria-label="이 사진 삭제"><i class="ph-bold ph-trash"></i></button>' +
      seg + '</div>';
  }
  function _upSummaryHtml(n, multi, cnt, pairs) {
    if (!n) return '';
    return '<div class="up-summary"><span class="up-chip">선택 <b>' + n + '</b></span>' +
      (multi
        ? '<span class="up-chip">전 <b>' + cnt.before + '</b></span>' +
          '<span class="up-chip">후 <b>' + cnt.after + '</b></span>' +
          '<span class="up-chip">기본 <b>' + cnt.hero + '</b></span>' +
          // [Phase A-1] '전후쌍'은 템플릿 합성 단계 전용 표기 → 심플 플로우에선 숨김(역할 칩만 노출).
          (SIMPLE_FLOW ? '' : '<span class="up-chip">전후쌍 <b>' + pairs + '</b></span>')
        : '') + '</div>';
  }
  function renderUpload() {
    var n = d.photos.length;
    // [#2] 선택순 랭크 맵 — 배지 숫자는 선택순(selSeq) 1..k. 표시 순서는 업로드 배열순 유지.
    var selOrdered = _selectedOrdered();
    var selCount = selOrdered.length, multi = selCount >= 2;
    var rank = {};
    selOrdered.forEach(function (p, idx) { rank[p.id] = idx + 1; });
    var cnt = { before: 0, after: 0, hero: 0 };
    selOrdered.forEach(function (p) { var r = p.role || 'hero'; if (cnt[r] != null) cnt[r]++; else cnt.hero++; });
    var pairs = Math.min(cnt.before, cnt.after);
    var tiles = d.photos.map(function (p, i) { return _upTileHtml(p, i, multi, rank[p.id]); }).join('');
    var guide = n
      ? '<div class="up-guide">' +
          '<div class="up-guide-c"><b>1</b><small>사진을 탭해<br>선택·해제</small></div>' +
          '<div class="up-guide-c"><b>2</b><small>전·후·기본<br>역할 선택</small></div>' +
          '<div class="up-guide-c"><b>3</b><small>' + (SIMPLE_FLOW ? '캡션<br>생성' : '편집·템플릿<br>으로') + '</small></div>' +
        '</div>'
      : '';
    return '' +
      '<div class="up-kicker"><span class="up-kicker-dot"></span>' + (SIMPLE_FLOW ? '사진을 올리면 AI가 게시글을 만들어요' : '전후 템플릿은 업로드가 먼저예요') + '</div>' +
      '<div class="up-drop" data-fl-pick>' +
        '<span class="up-cloud"><i class="ph-duotone ph-cloud-arrow-up"></i></span>' +
        '<b>사진을 드래그하거나 여기를 눌러 업로드</b>' +
        '<span class="up-note">여러 장 한 번에 · JPG · PNG 최대 20MB</span>' +
        // [Phase A-1] 템플릿 단계가 숨겨진 심플 플로우에선 '전후 템플릿' 안내 문구 제거.
        (SIMPLE_FLOW ? '' : '<span class="up-note up-note--rose">최소 2장부터 전후 템플릿 적용 · 1장이면 자동완성하지 않아요</span>') +
      '</div>' + guide +
      '<div class="up-section">업로드한 사진 <b>' + n + '</b> / 10' +
        (n ? ' <span class="up-rolehint">· 탭해 <b>선택/해제</b>' + (multi ? ' · 전후는 사진마다 <b>전·후</b> 지정' : '') + '</span>' : '') + '</div>' +
      '<div class="upload-grid">' + tiles +
        '<div class="grid-add" data-fl-pick><i class="ph-bold ph-plus"></i><span>추가</span></div>' +
      '</div>' +
      '<div class="up-foot" data-up-foot>' + _upSummaryHtml(selCount, multi, cnt, pairs) + _pairPreviewHtml(cnt) + '</div>';
  }
  // [v531 렉] 역할/선택 변경 시 전체 재렌더(이미지 6장 base64 재파싱) 대신 in-place 갱신.
  //   타일 이미지 DOM 은 유지하고 selected 클래스·순서배지·역할 세그 on 상태만 바꾼다.
  //   요약/페어 미리보기는 rAF 로 묶어 빠른 연타에도 1프레임 1회만 재계산.
  function _repaintUpload() {
    if (!el || cur !== 'upload') return;
    var root = el.querySelector('[data-fs="upload"]'); if (!root) return;
    var selOrdered = _selectedOrdered();
    var multi = selOrdered.length >= 2;
    var rank = {}; selOrdered.forEach(function (p, idx) { rank[p.id] = idx + 1; });
    d.photos.forEach(function (p, i) {
      var tile = root.querySelector('[data-fl-tile="' + i + '"]'); if (!tile) return;
      var selected = p.selected !== false;
      tile.classList.toggle('selected', selected);
      tile.setAttribute('aria-pressed', selected);
      var ord = tile.querySelector('.thumb-order');
      if (selected) {
        if (!ord) { ord = document.createElement('span'); ord.className = 'thumb-order'; tile.insertBefore(ord, tile.firstChild); }
        ord.textContent = rank[p.id];
      } else if (ord) { ord.parentNode.removeChild(ord); }
      var seg = tile.querySelector('.thumb-seg');
      var role = p.role || 'hero';
      if (multi && selected) {
        if (!seg) { tile.insertAdjacentHTML('beforeend', _segHtml(role, i)); }
        else {
          var btns = seg.querySelectorAll('.thumb-seg-b');
          for (var k = 0; k < btns.length; k++) {
            btns[k].classList.toggle('on', btns[k].getAttribute('data-fl-setrole') === (i + ':' + role));
          }
        }
      } else if (seg) { seg.parentNode.removeChild(seg); }
    });
    _schedulePairPreview();
  }
  var _ppRaf = 0;
  function _schedulePairPreview() {
    if (_ppRaf) return;
    var raf = window.requestAnimationFrame || function (f) { return setTimeout(f, 16); };
    _ppRaf = raf(function () {
      _ppRaf = 0;
      if (!el || cur !== 'upload') return;
      var root = el.querySelector('[data-fs="upload"]'); if (!root) return;
      var foot = root.querySelector('[data-up-foot]'); if (!foot) return;
      var selOrdered = _selectedOrdered();
      var multi = selOrdered.length >= 2;
      var cnt = { before: 0, after: 0, hero: 0 };
      selOrdered.forEach(function (p) { var r = p.role || 'hero'; if (cnt[r] != null) cnt[r]++; else cnt.hero++; });
      foot.innerHTML = _upSummaryHtml(selOrdered.length, multi, cnt, Math.min(cnt.before, cnt.after)) + _pairPreviewHtml(cnt);
    });
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
    // [배경 정리] 개발자식 '누끼/배경제거/배경흐림' → 배경색 아이콘처럼 직관적인 아이콘 칩 한 줄로 통일.
    //  칩을 누르면 바로 인물 분리 후 적용. 보정은 인물에만 적용(배경은 그대로). 첫 클릭 즉시 처리 상태 노출.
    var bgOpts = [
      { act: 'reset',    ic: 'ph-arrow-counter-clockwise', lbl: '원본' },
      { act: 'removeBg', ic: 'ph-scissors',                lbl: '인물만' },
      { act: 'blur',     ic: 'ph-drop-half',               lbl: '배경 흐림' },
      { act: 'image',    ic: 'ph-image-square',            lbl: '내 배경', pick: true }
    ];
    var optsHtml = bgOpts.map(function (o) {
      var on = (o.act === 'reset') ? !d.bgAction : (bgcur === o.act);
      var attr = o.pick ? 'data-fl-bgpick' : ('data-fl-bg="' + o.act + '"');
      return '<button type="button" class="ed-bg__opt' + (on ? ' on' : '') + '" ' + attr + (d.bgBusy ? ' disabled' : '') +
        ' aria-label="' + esc(o.lbl) + '"><span class="ed-bg__opticon"><i class="ph-duotone ' + o.ic + '"></i></span><em>' + esc(o.lbl) + '</em></button>';
    }).join('');
    return '<div class="ed-bg">' +
        '<div class="ed-bg__sublabel">배경 정리</div>' +
        '<div class="ed-bg__opts">' + optsHtml + '</div>' +
        (d.customBgName ? '<div class="ed-bg__status">올린 배경: ' + esc(d.customBgName) + '</div>' : '') +
        '<div class="ed-bg__sublabel">배경 색으로 채우기</div>' +
        '<div class="ed-bg__colors">' + bgColors.map(function (c) {
          return '<button type="button" class="ed-bg__color' + (d.bgColor === c ? ' on' : '') + '" data-fl-bgcolor="' + c + '" style="background:' + c + '" aria-label="배경색"' + (d.bgBusy ? ' disabled' : '') + '></button>';
        }).join('') + '</div>' +
        '<div class="ed-bg__status' + (d.bgFail ? ' is-fail' : (d.bgBusy ? ' is-busy' : '')) + '" data-fl-bgstatus>' + (d.bgBusy ? '<i class="ph-duotone ph-spinner-gap ed-bg__spin"></i>배경 정리 중… (몇 초 걸려요)' : (d.bgFail ? esc(d.bgFailMsg || '배경 처리에 실패했어요') : (d.bgAction ? '적용됨 — 밝기·보정은 인물에만 적용돼요(배경 그대로)' : '아이콘을 누르면 바로 인물을 분리해요'))) + '</div>' +
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
  function _editPhotoLabel(p, i) {
    return p && p.role === 'before' ? '전 사진' : (p && p.role === 'after' ? '후 사진' : ('사진 ' + (i + 1)));
  }
  // [v550] 큰 편집 사진을 좌우로 넘기는 carousel 네비 — 상단 큰 썸네일 rail 대신 컴팩트 dot+카운터+
  //   "이 사진 편집 중" pill + PC 화살표. 실제 전환은 큰 프리뷰 스와이프(_bindSwipe)/화살표/키보드.
  function _editSwitcherHtml() {
    var eps = editablePhotos();
    if (eps.length < 2) return '';
    var curIdx = (d.editIdx == null) ? 0 : d.editIdx;
    var dots = eps.map(function (p, i) {
      return '<button type="button" class="ed-carnav__dot' + (i === curIdx ? ' on' : '') + '" data-fl-editsel="' + i + '" role="tab" aria-selected="' + (i === curIdx) + '" aria-label="' + esc(_editPhotoLabel(p, i)) + '"></button>';
    }).join('');
    return '<div class="ed-carnav" role="tablist" aria-label="편집할 사진 전환">' +
      '<button type="button" class="ed-carnav__arw ed-carnav__arw--prev" data-fl-edswipe="prev" aria-label="이전 사진"' + (curIdx <= 0 ? ' disabled' : '') + '><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>' +
      '<div class="ed-carnav__mid">' +
        '<span class="ed-carnav__pill">이 사진 편집 중 · <b>' + esc(_editPhotoLabel(eps[curIdx], curIdx)) + '</b></span>' +
        '<div class="ed-carnav__dots">' + dots + '</div>' +
        '<span class="ed-carnav__count">' + (curIdx + 1) + ' / ' + eps.length + '</span>' +
      '</div>' +
      '<button type="button" class="ed-carnav__arw ed-carnav__arw--next" data-fl-edswipe="next" aria-label="다음 사진"' + (curIdx >= eps.length - 1 ? ' disabled' : '') + '><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>' +
    '</div>';
  }
  function _editBottomHtml() {
    return '<div class="ed-bottom">' +
      '<div class="eb' + (d.undo && d.undo.length ? '' : ' disabled') + '" data-fl-eb="되돌리기"><svg class="eb-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a4 4 0 0 1 0 8h-1"/></svg>되돌리기</div>' +
      '<div class="eb' + (d.redo && d.redo.length ? '' : ' disabled') + '" data-fl-eb="다시실행"><svg class="eb-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 14 5-5-5-5"/><path d="M20 9H9a4 4 0 0 0 0 8h1"/></svg>다시실행</div>' +
      // [v560] '비교'·'원본보기' 중복 버튼 통합 — 단일 '원본보기'(비파괴 비교 토글, active 표시).
      '<div class="eb' + (d.originalPreview ? ' active' : '') + '" data-fl-eb="원본보기"><span class="activebox"><svg class="eb-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg></span>원본보기</div>' +
      '<div class="eb" data-fl-eb="초기화"><svg class="eb-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-6.4 2.6L3 8"/><path d="M3 3v5h5"/></svg>초기화</div>' +
      '</div>';
  }
  function _caret(open) { return '<svg class="ed-fold__caret" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#ic-chevron-' + (open ? 'up' : 'down') + '"/></svg>'; }
  // [v538] '전·후 사진 확인' 인라인 패널 — 토스트 대신, 선택 사진마다 전/후/기본을 바로 재지정.
  //   화면 이동 없이 고급 탭 안에서 완결(CLAUDE.md 인라인 편집 철학). 기존 _setRole/_ROLE_SEG 재사용.
  function _roleSegInline(role, i) {
    return '<div class="ed-roles__seg" role="group" aria-label="이 사진 역할 지정">' +
      _ROLE_SEG.map(function (rl) {
        return '<button type="button" class="ed-roles__b' + (rl[0] === 'before' ? ' before' : '') + (role === rl[0] ? ' on' : '') + '" data-fl-setrole="' + i + ':' + rl[0] + '">' + rl[1] + '</button>';
      }).join('') + '</div>';
  }
  function _rolesPanelHtml() {
    var eps = editablePhotos();
    if (!eps.length) return '<div class="ed-roles-empty">선택된 사진이 없어요. 먼저 사진을 골라 주세요.</div>';
    return '<div class="ed-roles">' + eps.map(function (p) {
      var idx = d.photos.indexOf(p);
      var role = p.role || 'hero';
      return '<div class="ed-roles__row"><span class="ed-roles__thumb" style="background-image:url(' + esc(photoUrl(p)) + ')"></span>' + _roleSegInline(role, idx) + '</div>';
    }).join('') + '<div class="ed-roles__hint">전후 비교 템플릿은 <b>전</b>·<b>후</b>를 각각 1장 이상 지정하세요.</div></div>';
  }
  function _advFoldHtml() {
    var prec = PRECISION_TABS;
    var ptab = d.editTab && prec.some(function (t) { return t.k === d.editTab; }) ? d.editTab : prec[0].k;
    var ptabObj = prec.filter(function (t) { return t.k === ptab; })[0];
    var precBody = '';
    // [v554] 정밀 조정 항상 펼침 — advOpen 게이트 제거(접기 토글이 없어 false 가 되면 영구 사라지는 함정 방지).
    {
      var inner;
      if (ptab === 'tools') {
        // [v560] '전·후 사진 확인'(roles)은 '템플릿 선택' 화면으로 이동 — 고급탭엔 자르기만.
        inner = '<div class="ed-adv">' +
          '<button type="button" class="ed-adv__btn" data-fl="crop"><i class="ph-duotone ph-crop"></i>자르기</button>' +
          '</div>';
      } else {
        inner = '<div class="ed-adv">' + _beautySlider(ptabObj.controls || [], d.precTool) + '</div>';
      }
      var precTabsHtml = '<div class="ed-tabs">' + prec.map(function (t) {
        return '<div class="ed-tab' + (t.k === ptab ? ' on' : '') + '" data-fl-edtab="' + t.k + '"><i class="ph-duotone ' + t.ic + '"></i>' + t.label + '</div>';
      }).join('') + '</div>';
      // [v540] 마스크 보기 — 정밀 조정 안으로 이동. 효과 부위 탭(피부/헤어/눈·눈썹/네일)에서만 노출(고급 제외).
      // [v561] '직접 칠하기'(수동 마스크) — 자동 인식이 틀리거나 못 잡을 때 원장님이 영역을 직접 칠해 교정.
      // [v566·scope4] 보정 슬라이더가 먼저, '영역 다듬기(마스크 도구)'는 그 아래 보조 영역으로.
      var maskPill = (ptab !== 'tools')
        ? '<div class="ed-masktools">' +
            '<div class="ed-mask-subhead"><i class="ph-duotone ph-selection-plus" aria-hidden="true"></i>' + esc(ptabObj.label) + ' 영역 다듬기 <span>자동 인식이 어긋날 때만 직접 칠해 교정</span><span class="ed-mask-stat" data-fl-maskbadge hidden></span></div>' +
            '<div class="ed-maskpill-row">' +
              '<button type="button" class="ed-maskpill' + (d.maskView && !d.maskPaint ? ' on' : '') + '" data-fl-eb="마스크" aria-pressed="' + (d.maskView && !d.maskPaint ? 'true' : 'false') + '"><i class="ph-duotone ph-stack"></i>마스크 보기</button>' +
              '<button type="button" class="ed-maskpill' + (d.maskPaint ? ' on' : '') + '" data-fl="maskpaint" aria-pressed="' + (d.maskPaint ? 'true' : 'false') + '"><i class="ph-duotone ph-pencil-simple"></i>직접 칠하기</button>' +
              (d.maskPaint ? _maskPaintControlsHtml() : '') +
              '<div class="ed-mask-helper" data-fl-maskhelper hidden></div>' +
            '</div>' +
          '</div>'
        : '';
      // [v566·scope4] 순서: 탭 → 보정 슬라이더(inner) → 마스크 도구(maskPill).
      precBody = '<div class="ed-panel">' + precTabsHtml + inner + maskPill + (ptab !== 'tools' ? _photoDebugPanelHtml() : '') + '</div>';
    }
    // [v554] 정밀 조정 항상 펼침 — 접기/펼치기 버튼·caret(chevron) 제거(기능 숨김 오해 방지). 정적 헤더만 노출.
    return '<div class="ed-prec-head"><i class="ph-duotone ph-faders" aria-hidden="true"></i><span>정밀 조정</span></div>' + precBody;
  }
  // [#3] 템플릿 카드 썸네일 = 고정 예시 뷰티 이미지(번들 자산). 업로드 사진은 절대 카드에 주입하지 않는다.
  //   사용자 사진은 applyTemplate(적용) 단계에서만 실제 캔버스에 렌더된다.
  var _TPL_EX = {
    before_after: 'assets/workshop-cats/cat-1.jpg',
    feed:         'assets/workshop-cats/cat-3.jpg',
    review:       'assets/workshop-cats/cat-4.jpg',
    event:        'assets/workshop-cats/cat-5.jpg',
    story:        'assets/workshop-cats/cat-3.jpg'
  };
  function _tplExample(tpl) { return _TPL_EX[tpl.purpose] || _TPL_EX.feed; }
  // [이슈4] 카드 썸네일 = "실제 적용되는 템플릿 자체"의 미리보기(사진 없이 레이아웃/배지/카피 렌더).
  //   PhotoEditorTemplateThumb.make 가 templateId 로 진짜 템플릿을 그려 dataURL 반환 → id별 1회 캐시.
  //   미로드/실패 시에만 고정 예시(_TPL_EX)로 폴백 — 업로드 사진은 어떤 경우에도 카드에 쓰지 않는다.
  var _tplThumbCache = {};
  // [v561·항목5] 붙이기 카드 썸네일 — 사진 없이 분할 레이아웃만(좌우/상하) 그려 의도를 명확히.
  function _collageThumb(layout) {
    try {
      var W = 320, H = 400, gap = 6, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      var ctx = cv.getContext('2d'); ctx.fillStyle = '#EFE7EA'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#C9B3BC';
      if (layout === 'tb') { var hh = (H - gap) / 2; ctx.fillRect(0, 0, W, hh); ctx.fillRect(0, hh + gap, W, hh); }
      else { var hw = (W - gap) / 2; ctx.fillRect(0, 0, hw, H); ctx.fillRect(hw + gap, 0, hw, H); }
      ctx.fillStyle = '#7A5C66'; ctx.font = '700 30px Pretendard, "Noto Sans KR", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(layout === 'tb' ? '상하' : '좌우', W / 2, H / 2);
      return cv.toDataURL('image/png');
    } catch (_e) { return _TPL_EX.feed; }
  }
  // [v535] 템플릿 카드 썸네일 = 사진 없는 '템플릿 디자인 자체'만 렌더(레이아웃/배지/카피).
  //   업로드 사진은 물론 샘플 사진(cat-*)도 주입하지 않는다 — 카드엔 '이상한 미리 적용 사진'이 보이면 안 됨.
  //   (v534 에서 넣었던 cat-1/cat-2 샘플 주입 제거. 사진은 적용(applyTemplate) 단계에서만 실제로 들어간다.)
  function _tplThumb(tpl) {
    if (_tplThumbCache[tpl.id]) return _tplThumbCache[tpl.id];
    // [v561·항목5] 붙이기 템플릿은 레이아웃 자체(좌우/상하 분할)를 그려 보여준다.
    if (tpl.purpose === 'collage') { var cu = _collageThumb(tpl.collage || 'lr'); _tplThumbCache[tpl.id] = cu; return cu; }
    var url = null;
    try {
      if (window.PhotoEditorTemplateThumb && window.PhotoEditorTemplateThumb.make) {
        var ratio = tpl.purpose === 'story' ? '9:16' : (tpl.purpose === 'event' ? '1:1' : '4:5');
        var shop = '';
        try { shop = localStorage.getItem('shop_name') || ''; } catch (_e) { shop = ''; }
        // 사진 미주입 → beautyPack 렌더러가 사진 슬롯을 깔끔한 플레이스홀더로 그린다.
        url = window.PhotoEditorTemplateThumb.make({ id: tpl.id, label: tpl.label }, { ratio: ratio, shopName: shop });
      }
    } catch (_e2) { url = null; }
    url = url || _tplExample(tpl);
    _tplThumbCache[tpl.id] = url;
    return url;
  }
  // [v531] purpose ↔ 콘텐츠 유형(cat) 매핑 + 유형별 기본 템플릿 조회(home.js 와 공유 저장소).
  function _purposeCat(purpose) { return { before_after: 'ba', review: 'review', event: 'event', feed: 'flex', story: 'flex' }[purpose] || 'flex'; }
  function _getDefaultTpl(cat) { return (window.WorkspaceDefaultTpl && window.WorkspaceDefaultTpl.get(cat)) || ''; }
  // [v531] 템플릿 적용 상태 — 명확한 배너(결과물 N장) + 결과물 스트립(Pair N 결과) + 해제/바꾸기.
  // [v541] 적용 결과 — 작은 스트립 → 인스타식 큰 4:5 캐러셀(Pair 스와이프). 액션은 active Pair 기준.
  //   스크롤 동기 기계(_carSyncActive/_carItems)와 정합 위해 _displayItems() 동일 소스 사용.
  function _carItemLabel(it, i) {
    if (it.kind !== 'output') return it.label || '사진';
    var base = it.label || ('Pair ' + (i + 1)), tn = '';
    var o = (d.templateOutputs || []).filter(function (x) { return x.pairId === it.id; })[0];
    if (o && o.templateId) { var _t = WORKSPACE_TEMPLATES.filter(function (x) { return x.id === o.templateId; })[0]; tn = _t ? _t.label : ''; }
    return base + (tn ? ' · ' + tn : '');   // [v541] active 라벨에 현재 Pair 템플릿명 표시(짝별 개별 적용 확인)
  }
  function _tplResultCarousel() {
    var items = _displayItems(); if (!items.length) return '';
    var n = items.length;
    var active = (function () { for (var i = 0; i < items.length; i++) if (items[i].id === d.activeDisplayId) return d.activeDisplayId; return items[0].id; })();
    var actIdx = 0; for (var k = 0; k < items.length; k++) if (items[k].id === active) actIdx = k;
    var slides = items.map(function (it) {
      return '<div class="cap-car__slide" data-fl-carslide="' + esc(it.id) + '">' +
        '<div class="cap-car__img" style="background-image:url(' + esc(it.url) + ')"></div></div>';
    }).join('');
    var dots = n > 1 ? '<div class="cap-car__dots">' + items.map(function (it) {
      return '<button type="button" class="cap-car__dot' + (it.id === active ? ' on' : '') + '" data-fl-cardot="' + esc(it.id) + '" aria-label="이 결과 보기"></button>';
    }).join('') + '</div>' : '';
    var pills = n > 1 ? '<div class="tpl-car__pills">' + items.map(function (it, i) {
      return '<button type="button" class="tpl-car__pill' + (it.id === active ? ' on' : '') + '" data-fl-cardot="' + esc(it.id) + '">' + esc(_carItemLabel(it, i)) + '</button>';
    }).join('') + '</div>' : '';
    return '<div class="cap-car tpl-car" data-fl-carousel>' +
        '<div class="cap-car__track" data-fl-cartrack>' + slides + '</div>' + dots + pills +
        '<div class="tpl-car__actions"><span class="tpl-car__active" data-fl-tpl-activelabel>' + esc(_carItemLabel(items[actIdx], actIdx)) + '</span>' +
          '<button type="button" class="tpl-car__change" data-fl="tplchange-active">템플릿 바꾸기</button>' +
          '<button type="button" class="tpl-car__edit" data-fl="tpledit-active">템플릿 수정</button>' +
        '</div></div>';
  }
  // [v559] 템플릿 결과를 '큰 preview 와 한 흐름'으로 — 별도 fold 카루셀 대신, 적용 시 항상 보이는 인라인 결과.
  //   활성 pair 의 합성 결과(전+후 한 장)를 크게 + '적용됨' badge + (다중)pair chip + 바꾸기/해제.
  function _tplAppliedHtml() {
    if (!d.templateId) return '';
    var outs = d.templateOutputs || [];
    if (!outs.length) return '';
    var isBA = d.tplPurpose === 'before_after';
    var activeId = _activeOutputPair();
    var active = null; for (var i = 0; i < outs.length; i++) { if (outs[i].pairId === activeId) { active = outs[i]; break; } }
    if (!active) active = outs[0];
    var actIdx = 0; for (var k = 0; k < outs.length; k++) { if (outs[k].pairId === active.pairId) { actIdx = k; break; } }
    // [v561·항목4] 다중 결과물은 '1번 보기/2번 보기' 텍스트 버튼 대신 좌우 스와이프 + dot + n/N 카운터.
    var badge = '<div class="tplres__badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' +
        '<b>' + (isBA ? '전후 템플릿 적용됨' : '템플릿 적용됨') + '</b>' +
        (outs.length > 1 ? '<em>' + (actIdx + 1) + ' / ' + outs.length + '</em>' : '') + '</div>';
    var img = '<div class="tplres__img" data-fl-tplresult style="background-image:url(' + esc(active.outputUrl) + ')"></div>';
    var pairs = outs.length > 1 ? '<div class="tplres__nav" role="tablist" aria-label="결과물 전환 — 좌우로 넘기기">' +
        '<button type="button" class="tplres__arw" data-fl-pairstep="prev" aria-label="이전 결과물"' + (actIdx <= 0 ? ' disabled' : '') + '><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>' +
        '<div class="tplres__dots">' + outs.map(function (o, i) {
          return '<button type="button" class="tplres__dot' + (o.pairId === active.pairId ? ' on' : '') + '" data-fl-pairsel="' + esc(o.pairId) + '" role="tab" aria-selected="' + (o.pairId === active.pairId) + '" aria-label="' + (i + 1) + '번째 결과물"></button>';
        }).join('') + '</div>' +
        '<button type="button" class="tplres__arw" data-fl-pairstep="next" aria-label="다음 결과물"' + (actIdx >= outs.length - 1 ? ' disabled' : '') + '><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>' +
      '</div>' : '';
    var actions = '<div class="tplres__act">' +
        '<button type="button" class="tplres__change" data-fl="tplchange-active">템플릿 바꾸기</button>' +   // [v565·scope3] 현재 보고 있는 결과 1장만 교체(전역 일괄 금지)
        (!isBA ? '<button type="button" class="tplres__edit" data-fl="tpleditactive">문구 수정</button>' : '') +
        '<button type="button" class="tplres__release" data-fl="tplrelease">해제</button>' +
      '</div>';
    return '<div class="tplres">' + badge + img + pairs + actions + '</div>';
  }
  function _activeOutputPair() {
    var outs = d.templateOutputs || [];
    if (d.activeDisplayId && outs.some(function (o) { return o.pairId === d.activeDisplayId; })) return d.activeDisplayId;
    return outs[0] ? outs[0].pairId : null;
  }
  // [v561·항목4] 결과물 전환 후 현재 화면만 부분 재렌더(템플릿 화면이면 그쪽, 아니면 인라인 결과 섹션).
  function _rerenderTplResult() { if (cur === 'template') _rerenderTemplate(); else _renderTplSection(); }
  function _stepPair(dir) {
    var outs = d.templateOutputs || []; if (outs.length < 2) return;
    var cap = _activeOutputPair();
    var idx = 0; for (var i = 0; i < outs.length; i++) { if (outs[i].pairId === cap) { idx = i; break; } }
    var ni = Math.max(0, Math.min(outs.length - 1, idx + dir));
    if (ni === idx) return;
    d.activeDisplayId = outs[ni].pairId; _rerenderTplResult();
  }
  // [v541] 템플릿 섹션 재렌더 + 결과 캐러셀 스와이프 바인딩(전체 재렌더 없이).
  function _renderTplSection() {
    _setEditSection('[data-ed-tpl]', _tplFoldHtml());
    var raf = window.requestAnimationFrame || function (f) { return setTimeout(f, 16); };
    raf(function () { _mountCarousel(); });
  }
  // [v560] 'template' step 전용 재렌더 — 전/후 지정·카테고리 칩·템플릿 적용 결과를 그 화면에서 갱신.
  function _rerenderTemplate() {
    var sec = el && el.querySelector('.wsv2flow__s[data-fs="template"]');
    if (!sec) return;
    // [v566·scope5] 사진 스트립 가로 스크롤 위치 보존 — 재렌더로 '4번째 보던 사진'이 1번째로 튕기는 문제 차단.
    var prevStrip = sec.querySelector('[data-fl-tplstrip]');
    var prevLeft = prevStrip ? prevStrip.scrollLeft : 0;
    sec.innerHTML = renderTemplate();
    var nstrip = sec.querySelector('[data-fl-tplstrip]');
    if (nstrip && prevLeft) nstrip.scrollLeft = prevLeft;
    var raf = window.requestAnimationFrame || function (f) { return setTimeout(f, 16); };
    raf(function () { _mountCarousel(); });
  }
  function _tplById(id) { return WORKSPACE_TEMPLATES.filter(function (t) { return t.id === id; })[0] || null; }
  // [v559] 현재 편집 사진의 보정을 전후 템플릿 결과에 반영 — 그 사진이 속한 pair 를 라이브 미리보기(d.previewUrl,
  //   없으면 baked)로 비파괴 재합성(클라 캔버스). 원본 photo 객체는 안 건드리고 templateOutputs 만 갱신 → 결과 인라인 즉시 반영.
  function _recompositeActivePair() {
    if (d.tplPurpose !== 'before_after' || !d.templateId) return;
    if (!(window.WorkspaceAdapter && window.WorkspaceAdapter.applyWorkspaceTemplate)) return;
    var photo = curEditPhoto(); if (!photo) return;
    var outs = (d.templateOutputs || []).slice(); if (!outs.length) return;
    var pairs = _computePairs().pairs;
    var liveUrl = (!d.originalPreview && d.previewUrl) ? d.previewUrl : photoUrl(photo);
    var jobs = [];
    outs.forEach(function (o, idx) {
      if (o.beforePhotoId !== photo.id && o.afterPhotoId !== photo.id) return;
      var pr = null; for (var i = 0; i < pairs.length; i++) { if (pairs[i].before.id === o.beforePhotoId && pairs[i].after.id === o.afterPhotoId) { pr = pairs[i]; break; } }
      if (!pr) return;
      var tplObj = _tplById(o.templateId); if (!tplObj) return;
      var bef = pr.before.id === photo.id ? Object.assign({}, pr.before, { editedDataUrl: liveUrl }) : pr.before;
      var aft = pr.after.id === photo.id ? Object.assign({}, pr.after, { editedDataUrl: liveUrl }) : pr.after;
      jobs.push(window.WorkspaceAdapter.applyWorkspaceTemplate({ template: tplObj, photos: [bef, aft], service: d.service, customerName: d.customerName, caption: d.caption })
        .then(function (r) { if (r && r.ok && r.dataUrl) outs[idx] = Object.assign({}, o, { outputUrl: r.dataUrl }); }).catch(function () { }));
    });
    if (!jobs.length) return;
    var tok = (d._recTok = (d._recTok || 0) + 1);
    Promise.all(jobs).then(function () {
      if (tok !== d._recTok) return;
      d.templateOutputs = outs;
      d.templateOutput = (outs[0] && outs[0].outputUrl) || d.templateOutput;
      _renderTplSection();
    });
  }
  function _tplFoldHtml() {
    // [v561·항목1] 편집 화면의 '템플릿 꾸미기' 접이식 그리드 제거 — 템플릿 선택은 전용 '템플릿 선택하기'
    //   화면(하단 CTA)으로 일원화. 편집 화면엔 이미 적용된 결과 미리보기만 인라인으로 둔다(없으면 빈 출력).
    return _tplAppliedHtml();
  }
  // [v575·필수8/11] 사진 '아래' slim 도구바 — 사진 위 overlay 전면 제거(사진 안 가림).
  //   확대/축소·화면맞춤·전체화면만. 마스크 보기/직접 칠하기는 정밀 조정 메뉴(ed-maskpill) 1세트로 일원화(여기엔 없음).
  function _vpToolsHtml() {
    var z = d.zoom || { s: 1 };
    var pct = Math.round((z.s || 1) * 100);
    return '<div class="ed-vptools" data-ed-vptools>' +
      '<button type="button" class="ed-vpbtn ed-vpbtn--fs" data-fl="edfull" aria-label="' + (d.edFull ? '전체화면 닫기' : '크게 보기') + '"><i class="ph-duotone ph-' + (d.edFull ? 'arrows-in' : 'arrows-out') + '"></i><span>' + (d.edFull ? '닫기' : '크게') + '</span></button>' +
      '<div class="ed-vpzoom">' +
        '<button type="button" class="ed-vpbtn ed-vpbtn--ic" data-fl="edzoomout" aria-label="축소">−</button>' +
        '<button type="button" class="ed-vpbtn ed-vpbtn--pct" data-fl="edzoomfit" aria-label="화면맞춤"><span data-ed-zoompct>' + pct + '%</span></button>' +
        '<button type="button" class="ed-vpbtn ed-vpbtn--ic" data-fl="edzoomin" aria-label="확대">+</button>' +
      '</div>' +
    '</div>';
  }
  function _renderVpTools() {
    var c = el && el.querySelector('[data-fs="edit"] [data-ed-vptools]');
    if (c) { var tmp = document.createElement('div'); tmp.innerHTML = _vpToolsHtml(); c.replaceWith(tmp.firstChild); }
  }
  function _updateZoomPct() {
    var s = el && el.querySelector('[data-fs="edit"] [data-ed-zoompct]');
    if (s) s.textContent = Math.round((((d.zoom && d.zoom.s) || 1)) * 100) + '%';
  }
  function renderEdit() {
    d.zoom = { s: 1, tx: 0, ty: 0 };   // 편집화면 새로 그릴 때(진입/사진전환) 줌 초기화
    var pu = _editPhotoUrls();
    return '' +
      '<div class="ed-sec" data-ed-switcher>' + _editSwitcherHtml() + '</div>' +
      '<div class="ed-photo-vp" data-fl-edvp><div class="ed-photo" data-fl-edphoto style="background-image:url(' + esc(pu.url) + ');filter:' + pu.preview + '"></div><canvas class="ed-mask-ov" data-fl-maskov hidden></canvas></div>' + _vpToolsHtml() +
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
    var tf = 'translate(' + z.tx + 'px,' + z.ty + 'px) scale(' + z.s + ')';
    p.style.transform = tf;
    var ov = el.querySelector('[data-fs="edit"] [data-fl-maskov]');   // [v539] 마스크 overlay 도 동일 변환
    if (ov) ov.style.transform = tf;
    _updateZoomPct();   // [v568·B-1] floating 도구바의 배율 % 갱신
  }

  // ── [v542] 보정 디버그 패널 — 개발자모드(__ITDASY_PHOTO_DEBUG__ 또는 ?photoDebug=1)에서만 ──
  function _photoDebugOn() {
    try { if (window.__ITDASY_PHOTO_DEBUG__) return true; return /[?&]photoDebug=1/.test(location.search || ''); } catch (_e) { return false; }
  }
  var _FX_MASK = { skin: 'skinMask', redness: 'skinMask', blemish: 'skinMask(spot)', textureSmooth: 'skinMask', yellowness: 'skinMask', hairDetail: 'hairMask', hairVolume: 'hairMask+경계', hairShine: 'hairMask', hairFull: 'hairW 휴리스틱', hairEndsClean: 'hairMask 외곽띠', browSharp: 'browMask→eyeROI', lashSharp: 'lashMask→eyeROI', eyeRedness: 'scleraMask→eyeW', catchLight: 'eyeMask', irisClear: 'eyeMask', nailGloss: 'nailMask 필수', nailShape: 'nailMask 필수', handSkin: 'handSkinMask 필수' };
  var _FX_MULT = { textureSmooth: 0.72, blemish: 0.8, skin: 1, redness: 1, hairFull: 0.34, hairEndsClean: 0.42, hairDetail: '1/150~300', lashSharp: '1/65~120', browSharp: '1/90~400', nailShape: '1/55~200', catchLight: 0.38 };
  function _activePrecKey() {
    var tab = d.editTab || 'skin';
    var to = PRECISION_TABS.filter(function (t) { return t.k === tab; })[0];
    if (!to || !to.controls || !to.controls.length) return null;
    if (d.precTool && to.controls.some(function (c) { return c.k === d.precTool; })) return d.precTool;
    return to.controls[0].k;
  }
  function _activePrecLabel(key) {
    var tab = d.editTab || 'skin';
    var to = PRECISION_TABS.filter(function (t) { return t.k === tab; })[0];
    var c = to && to.controls ? to.controls.filter(function (x) { return x.k === key; })[0] : null;
    return c ? c.l : key;
  }
  function _photoDebugPanelHtml() {
    if (!_photoDebugOn()) return '';
    var key = _activePrecKey(); if (!key) return '';
    var val = (d.beauty && d.beauty[key]) || 0;
    var last = window.__photofxLast || {};
    var cov = (typeof d._maskCovPct === 'number' && d._maskCovKey === key) ? (d._maskCovPct + '%') : '— (마스크 보기 ON 시)';
    var rows = [
      ['기능', _activePrecLabel(key)],
      ['uiKey / engineKey', key],
      ['mask', _FX_MASK[key] || '—'],
      ['value / norm', val + ' / ' + (val / 100).toFixed(2)],
      ['mask coverage', cov],
      ['render', (last.time != null ? last.time + 'ms · ' + (last.path || '?') + ' · ' + last.w + 'x' + last.h + (last.cacheReuse ? ' · cache' : '') : '—')],
      ['tuningMultiplier', String(_FX_MULT[key] != null ? _FX_MULT[key] : '—')],
    ];
    var grid = rows.map(function (r) { return '<div class="ed-fxdebug__r"><span>' + esc(r[0]) + '</span><b>' + esc(String(r[1])) + '</b></div>'; }).join('');
    return '<div class="ed-fxdebug" data-fl-fxdebug>' +
        '<div class="ed-fxdebug__hd">보정 디버그 <em>개발자모드</em></div>' + grid +
        '<div class="ed-fxdebug__btns">' +
          '<button type="button" data-fl-fxv="0">0 보기</button>' +
          '<button type="button" data-fl-fxv="50">50 보기</button>' +
          '<button type="button" data-fl-fxv="100">100 보기</button>' +
          '<button type="button" data-fl="fxcopy" class="ed-fxdebug__copy">현재값 복사</button>' +
        '</div>' +
        '<div class="ed-fxdebug__note">마스크 잘 잡히는데 delta 낮으면 엔진/강도 문제 · coverage 0이면 fallback ROI</div>' +
      '</div>';
  }
  // 현재 효과를 다운스케일 샘플에 적용해 마스크 안/밖 delta 실측(현재값 복사용).
  // [v545] 효과별 coverage/delta 판정에 쓰는 '실제 사용 마스크' 키. native useMasks 또는 별도 게터(brow/lash 는 m.*).
  var _FX_MASKKEY = { skin: 'skinMask', redness: 'skinMask', blemish: 'skinMask', textureSmooth: 'skinMask', yellowness: 'skinMask', handSkin: 'handSkinMask', hairDetail: 'hairMask', hairVolume: 'hairMask', hairShine: 'hairMask', hairFull: 'hairMask', hairEndsClean: 'hairMask', browSharp: 'browMask', lashSharp: 'lashMask', eyeRedness: 'scleraMask', catchLight: 'eyeMask', irisClear: 'eyeMask', nailGloss: 'nailMask', nailShape: 'nailMask' };
  // 실제 apply 경로(어댑터 _beautyMasksAsync)와 동일하게 마스크 페치 — getMasksForBeauty + brow/sclera/nail/lash 게터.
  function _fxFetchMasks(img, beauty, done) {
    var MA = window.MaskApplication;
    if (!MA || typeof MA.getMasksForBeauty !== 'function') { done(null); return; }
    Promise.resolve(MA.getMasksForBeauty(img)).then(function (base) {
      var m = base ? { useMasks: Object.assign({}, base.useMasks), _scale: Object.assign({}, base._scale), maskW: base.maskW, maskH: base.maskH } : null;
      function ensure() { return m || (m = { useMasks: {}, _scale: {}, maskW: img.naturalWidth || img.width, maskH: img.naturalHeight || img.height }); }
      try {
        if ((beauty.lashSharp || 0) > 0 && MA.getLashMaskSync) { var l = MA.getLashMaskSync(img); if (l) { ensure().lashMask = l.mask; m.lashScale = l.scale; } }
        if ((beauty.eyeRedness || 0) > 0 && MA.getScleraMaskSync) { var sc = MA.getScleraMaskSync(img); if (sc) { ensure().useMasks.scleraMask = sc.mask; m._scale.scleraMask = sc.scale; } }
        if ((beauty.browSharp || 0) > 0 && MA.getBrowMaskSync) { var br = MA.getBrowMaskSync(img); if (br) { ensure().browMask = br.mask; m.browScale = br.scale; } }
        if (((beauty.nailGloss || 0) > 0 || (beauty.nailShape || 0) > 0) && MA.getNailMaskSync) { var nl = MA.getNailMaskSync(img); if (nl) { ensure().useMasks.nailMask = nl.mask; m._scale.nailMask = nl.scale; } }
        if ((beauty.handSkin || 0) > 0 && MA.getHandSkinMaskSync) { var hs = MA.getHandSkinMaskSync(img); if (hs) { ensure().useMasks.handSkinMask = hs.mask; m._scale.handSkinMask = hs.scale; } }
      } catch (_e) { void _e; }
      done(m);
    }).catch(function () { done(null); });
  }
  function _measureFx(key, value, cb) {
    var photo = curEditPhoto(); if (!photo) { cb(null); return; }
    var url = photo.editedDataUrl || photo.dataUrl;
    var img = new Image();
    img.onload = function () {
      var MX = 360, iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
      var s = Math.min(1, MX / Math.max(iw, ih)), w = Math.max(1, Math.round(iw * s)), h = Math.max(1, Math.round(ih * s));
      var beauty = {}; beauty[key] = value;
      _fxFetchMasks(img, beauty, function (masks) {
        try {
          var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
          var cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0, w, h);
          var before = cx.getImageData(0, 0, w, h).data.slice();
          var t0 = performance.now();
          // value=0 은 엔진 no-op(coeffs=0) — 측정도 그대로 0 확인.
          if (window.PhotoEditorBeautyEngine && value !== 0) window.PhotoEditorBeautyEngine.apply(cx, w, h, beauty, false, masks);
          var ms = Math.round(performance.now() - t0);
          var after = cx.getImageData(0, 0, w, h).data;
          var mtype = _FX_MASKKEY[key];
          var mask = masks ? ((masks.useMasks && masks.useMasks[mtype]) || masks[mtype] || null) : null;   // useMasks 또는 m.browMask/lashMask
          var mw = masks ? masks.maskW : 0, mh = masks ? masks.maskH : 0;
          var inS = 0, inN = 0, outS = 0, outN = 0, cov = 0, tot = 0;
          for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
            var i = (y * w + x) * 4, dd = Math.abs(after[i] - before[i]) + Math.abs(after[i + 1] - before[i + 1]) + Math.abs(after[i + 2] - before[i + 2]);
            var inMask = 1;
            if (mask) { var mx2 = Math.min(mw - 1, (x * mw / w) | 0), my2 = Math.min(mh - 1, (y * mh / h) | 0); var mv = mask[my2 * mw + mx2] || 0; inMask = mv > 0.3 ? 1 : 0; if (mv > 0.3) cov++; tot++; }
            if (inMask) { inS += dd; inN += 3; } else { outS += dd; outN += 3; }
          }
          cb({ target: +(inS / Math.max(1, inN)).toFixed(2), outside: +(outS / Math.max(1, outN)).toFixed(2), coverage: tot ? +(cov / tot * 100).toFixed(1) : null, time: ms, hasMask: !!mask, fallbackUsed: !mask, noop: value === 0 });
        } catch (_e3) { cb(null); }
      });
    };
    img.onerror = function () { cb(null); };
    img.src = url;
  }
  // ── [v539] 마스크 보기 overlay — 현재 정밀 부위가 어디에 인식됐는지 반투명으로 표시 ──
  // [v548] 활성 기능별 마스크 + 스펙 색상(눈=파랑 / 눈썹=초록 / 손=주황 / 네일=핑크). QA 가 ROI 위치를 색으로 확인.
  function _maskInfoForTab() {
    var k = _activePrecKey() || '', tab = d.editTab || 'skin';
    if (k === 'browSharp') return { type: 'browMask', label: '눈썹', tint: [90, 200, 110] };       // 초록
    if (k === 'lashSharp' || k === 'eyeRedness' || k === 'catchLight' || k === 'irisClear')
      return { type: k === 'eyeRedness' ? 'scleraMask' : 'eyeMask', label: k === 'eyeRedness' ? '흰자' : '눈', tint: [70, 130, 240] };   // 파랑
    if (k === 'handSkin') return { type: 'handSkinMask', label: '손 피부', tint: [240, 160, 70] };   // 주황
    if (k === 'nailGloss' || k === 'nailShape') return { type: 'nailMask', label: '네일', tint: [240, 110, 175] };  // 핑크
    if (tab === 'hair') return { type: 'hairMask', label: '헤어', tint: [145, 90, 220] };  // 보라
    if (tab === 'eyes') return { type: 'eyeMask', label: '눈', tint: [70, 130, 240] };
    if (tab === 'nail') return { type: 'nailMask', label: '네일', tint: [240, 110, 175] };
    return { type: 'skinMask', label: '피부·얼굴', tint: [236, 120, 150] };   // skin/default
  }
  function _containBlit(ctx, srcCanvas, dw, dh) {
    var iw = srcCanvas.width, ih = srcCanvas.height; if (!iw || !ih) return;
    var s = Math.min(dw / iw, dh / ih), rw = iw * s, rh = ih * s;
    var dx = (dw - rw) / 2, dy = (dh - rh) / 2;
    ctx.drawImage(srcCanvas, 0, 0, iw, ih, dx, dy, rw, rh);
  }
  function _paintMaskCanvas(vp, mask, mw, mh, info, badge) {
    var ov = vp.querySelector('[data-fl-maskov]');
    if (!ov) return;
    var helper = el && el.querySelector('[data-fs="edit"] [data-fl-maskhelper]');
    if (!mask || !mw || !mh) {
      // [v540] 못 찾음 경고를 사진 좌상단(가림)에서 → 정밀 조정 패널 inline helper(부드럽게)로 이동.
      ov.hidden = true;
      if (badge) badge.hidden = true;
      if (helper) { helper.hidden = false; helper.textContent = info.label + ' 영역을 인식하지 못했습니다'; }
      if (window.__ITDASY_PHOTO_DEBUG__) { try { console.log('[photofx] mask=' + info.type + ' detector-miss coverage=0%'); } catch (_e) { void _e; } }
      return;
    }
    if (helper) helper.hidden = true;
    // mask(0..1) → tinted ImageData(mw×mh)
    var tmp = document.createElement('canvas'); tmp.width = mw; tmp.height = mh;
    var tctx = tmp.getContext('2d'); var idata = tctx.createImageData(mw, mh); var dd = idata.data;
    var R = info.tint[0], G = info.tint[1], B = info.tint[2], hit = 0, tot = mw * mh;
    for (var i = 0; i < tot; i++) {
      var m = mask[i] || 0; if (m > 0.3) hit++;
      var a = m > 0.04 ? Math.min(0.55, m * 0.6) : 0;
      var j = i * 4; dd[j] = R; dd[j + 1] = G; dd[j + 2] = B; dd[j + 3] = (a * 255) | 0;
    }
    tctx.putImageData(idata, 0, 0);
    var vw = vp.clientWidth || 1, vh = vp.clientHeight || 1;
    ov.width = vw; ov.height = vh; ov.hidden = false;
    var octx = ov.getContext('2d'); octx.clearRect(0, 0, vw, vh);
    _containBlit(octx, tmp, vw, vh);
    var cov = Math.round(hit / tot * 1000) / 10;
    d._maskCovPct = cov; d._maskCovKey = _activePrecKey();   // [v542] 디버그 패널 coverage 표시용
    if (badge) { badge.hidden = false; badge.textContent = info.label + ' 인식됨 · ' + cov + '%'; }
    if (window.__ITDASY_PHOTO_DEBUG__) { try { console.log('[photofx] mask=' + info.type + ' coverage=' + cov + '% dims=' + mw + 'x' + mh); } catch (_e) { void _e; } }
  }
  function _renderMaskOverlay() {
    if (d.maskPaint) { _renderPaintOverlay(); return; }   // [v561] 칠하기 모드면 칠한 영역을 표시
    var vp = el && el.querySelector('[data-fs="edit"] [data-fl-edvp]'); if (!vp) return;
    var ov = vp.querySelector('[data-fl-maskov]'), badge = el.querySelector('[data-fs="edit"] [data-fl-maskbadge]');
    var helper0 = el.querySelector('[data-fs="edit"] [data-fl-maskhelper]');
    if (!d.maskView || d.originalPreview) { if (ov) ov.hidden = true; if (badge) badge.hidden = true; if (helper0) helper0.hidden = true; return; }
    var photo = curEditPhoto(); if (!photo) return;
    var MA = window.MaskApplication;
    var info = _maskInfoForTab();
    if (badge) { badge.hidden = false; badge.textContent = info.label + ' 인식 중…'; }
    if (!MA || typeof MA.getDetectorMask !== 'function') { if (badge) badge.textContent = '마스크 모듈을 불러오지 못했어요'; return; }
    var token = (d._maskTok = (d._maskTok || 0) + 1);
    var url = photo.editedDataUrl || photo.dataUrl;
    var img = new Image();
    img.onload = function () {
      if (token !== d._maskTok || !d.maskView) return;
      Promise.resolve(MA.getDetectorMask(img, info.type)).then(function (rr) {
        if (token !== d._maskTok || !d.maskView) return;
        var mask = null, mw = 0, mh = 0;
        if (rr && rr.mask) { mask = rr.mask; mw = img.naturalWidth || img.width; mh = img.naturalHeight || img.height; }
        _paintMaskCanvas(vp, mask, mw, mh, info, badge);
      }).catch(function () { _paintMaskCanvas(vp, null, 0, 0, info, badge); });
    };
    img.onerror = function () { if (badge) badge.textContent = '사진을 불러오지 못했어요'; };
    img.src = url;
  }

  // ── [v561] 직접 칠하기(수동 마스크) — 자동 검출이 틀리거나 못 잡을 때 원장님이 영역을 직접 칠해 교정 ──
  //   칠한 영역은 사진 해상도 캔버스(흰색=마스크값)로 누적 → applyWorkspaceCorrections 에 manualMasks 로 전달 →
  //   adapter 가 useMasks[type] 를 덮어써 그 부위에만 보정 적용. 검출 실패(네일 클로즈업 등)도 칠하면 먹힌다.
  function _maskPaintControlsHtml() {
    var info = _maskInfoForTab();
    var br = d.maskBrush || 26;
    return '<div class="ed-paintctl" data-fl-paintctl>' +
        '<div class="ed-paintctl__lbl"><b>' + esc(info.label) + '</b> 영역을 칠하면 그 부위에만 보정돼요</div>' +
        '<div class="ed-paintctl__row">' +
          '<button type="button" class="ed-paintb' + (!d.maskErase ? ' on' : '') + '" data-fl="paintdraw"><i class="ph-duotone ph-pen"></i>칠하기</button>' +
          '<button type="button" class="ed-paintb' + (d.maskErase ? ' on' : '') + '" data-fl="painterase"><i class="ph-duotone ph-eraser"></i>지우개</button>' +
          '<button type="button" class="ed-paintb" data-fl="paintclear"><i class="ph-duotone ph-trash"></i>비우기</button>' +
        '</div>' +
        '<label class="ed-paintbrush">붓 <input type="range" min="10" max="64" step="2" value="' + br + '" data-fl-brush aria-label="붓 크기"></label>' +
      '</div>';
  }
  function _maskTypeForPaint() { return _maskInfoForTab().type; }
  function _photoUid(p) { return p && (p._uid || (p._uid = 'm' + Math.random().toString(36).slice(2, 9))); }
  // 진입 시 현재 편집 사진의 자연 해상도 확보 — paint 캔버스 종횡비를 사진과 일치시켜 좌표 매핑 정합 유지.
  function _ensurePaintDims(cb) {
    var photo = curEditPhoto(); if (!photo) { if (cb) cb(); return; }
    if (photo._natW && photo._natH) { if (cb) cb(); return; }
    var im = new Image();
    im.onload = function () { photo._natW = im.naturalWidth || im.width || 1024; photo._natH = im.naturalHeight || im.height || 1024; if (cb) cb(); };
    im.onerror = function () { photo._natW = 1024; photo._natH = 1024; if (cb) cb(); };
    im.src = photo.dataUrl || photoUrl(photo);
  }
  function _getPaintCanvas(photo, type, create) {
    if (!photo || !type) return null;
    var uid = _photoUid(photo);
    if (!d._paintCv) d._paintCv = {};
    if (!d._paintCv[uid]) d._paintCv[uid] = {};
    var cv = d._paintCv[uid][type];
    if (!cv && create) {
      var iw = photo._natW || 1024, ih = photo._natH || 1024;
      cv = document.createElement('canvas'); cv.width = iw; cv.height = ih; cv._inked = false;
      d._paintCv[uid][type] = cv;
    }
    return cv || null;
  }
  // 현재 편집 사진에서 칠해진(잉크 있는) 모든 부위 캔버스를 { maskType: canvas } 로 반환 — 보정 적용 시 주입.
  function _manualMasksForCurrent() {
    var photo = curEditPhoto(); if (!photo || !photo._uid || !d._paintCv) return null;
    var store = d._paintCv[photo._uid]; if (!store) return null;
    var out = null;
    Object.keys(store).forEach(function (type) {
      var cv = store[type];
      if (cv && cv._inked) { out = out || {}; out[type] = cv; }
    });
    return out;
  }
  // paint 캔버스(흰 알파)를 탭 색으로 tint 해 overlay 에 contain-blit — 칠하는 동안 실시간 피드백.
  function _renderPaintOverlay() {
    var vp = el && el.querySelector('[data-fs="edit"] [data-fl-edvp]'); if (!vp) return;
    var ov = vp.querySelector('[data-fl-maskov]'), badge = el.querySelector('[data-fs="edit"] [data-fl-maskbadge]');
    var helper0 = el.querySelector('[data-fs="edit"] [data-fl-maskhelper]'); if (!ov) return;
    if (d.originalPreview) { ov.hidden = true; if (badge) badge.hidden = true; return; }
    var info = _maskInfoForTab(), photo = curEditPhoto();
    var cv = _getPaintCanvas(photo, info.type, false);
    var vw = vp.clientWidth || 1, vh = vp.clientHeight || 1;
    ov.width = vw; ov.height = vh; ov.hidden = false;
    var octx = ov.getContext('2d'); octx.clearRect(0, 0, vw, vh);
    if (cv && cv.width && cv.height) {
      var tmp = document.createElement('canvas'); tmp.width = cv.width; tmp.height = cv.height;
      var tctx = tmp.getContext('2d'); tctx.drawImage(cv, 0, 0);
      tctx.globalCompositeOperation = 'source-in';
      tctx.fillStyle = 'rgba(' + info.tint[0] + ',' + info.tint[1] + ',' + info.tint[2] + ',0.5)';
      tctx.fillRect(0, 0, cv.width, cv.height);
      _containBlit(octx, tmp, vw, vh);
    }
    if (helper0) helper0.hidden = true;
    if (badge) { badge.hidden = false; badge.textContent = info.label + ' 직접 칠하는 중'; }
  }
  // [v561·항목4] 다중 결과물 큰 이미지 좌우 스와이프 → pair 전환(48px 임계, 수평 우세 시).
  function _bindTplResultSwipe() {
    if (!el || el._tplSwBound) return; el._tplSwBound = true;
    var s = null;
    el.addEventListener('touchstart', function (e) {
      var img = e.target.closest && e.target.closest('[data-fl-tplresult]');
      if (!img || e.touches.length !== 1) { s = null; return; }
      s = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: true });
    el.addEventListener('touchend', function (e) {
      if (!s) return;
      var t = (e.changedTouches && e.changedTouches[0]) || null; if (!t) { s = null; return; }
      var dx = t.clientX - s.x, dy = t.clientY - s.y;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) _stepPair(dx < 0 ? 1 : -1);
      s = null;
    });
  }
  function _bindPaint() {
    if (!el || el._paintBound) return; el._paintBound = true;
    // [v565·scope2] 단일 포인터 그리기와 두 손가락 핀치/팬을 명확히 분리.
    //   pointers/pcount = 현재 화면에 닿은 포인터 수. gestureLock = 핀치가 시작된 후 그리기 봉인 플래그.
    var drawing = false, last = null, pointers = {}, pcount = 0, gestureLock = false, drawId = null, started = false;
    function vpEl() { return el.querySelector('[data-fs="edit"] [data-fl-edvp]'); }
    function geom(vp) {
      var cv = _getPaintCanvas(curEditPhoto(), _maskTypeForPaint(), true); if (!cv) return null;
      var iw = cv.width, ih = cv.height, vw = vp.clientWidth || 1, vh = vp.clientHeight || 1;
      var s = Math.min(vw / iw, vh / ih);
      return { cv: cv, s: s, dx: (vw - iw * s) / 2, dy: (vh - ih * s) / 2 };
    }
    // [v565] 확대(zoom transform) 상태에서도 정확히 칠하도록 — 화면좌표를 줌 역변환(translate+scale, origin=center) 후 캔버스로 매핑.
    function toImg(e, vp, gm) {
      var r = vp.getBoundingClientRect();
      var rx = e.clientX - r.left, ry = e.clientY - r.top;
      var z = d.zoom || { s: 1, tx: 0, ty: 0 };
      if (z.s && z.s !== 1) {
        var cx = (vp.clientWidth || r.width) / 2, cy = (vp.clientHeight || r.height) / 2;
        rx = (rx - cx - (z.tx || 0)) / z.s + cx;
        ry = (ry - cy - (z.ty || 0)) / z.s + cy;
      }
      return { x: (rx - gm.dx) / gm.s, y: (ry - gm.dy) / gm.s };
    }
    function stroke(gm, a, b) {
      var ctx = gm.cv.getContext('2d'), rad = Math.max(2, ((d.maskBrush || 26) / 2) / gm.s);
      ctx.globalCompositeOperation = d.maskErase ? 'destination-out' : 'source-over';
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = rad * 2;
      ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff';
      if (a) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(b.x, b.y, rad, 0, 6.2832); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      if (!d.maskErase) gm.cv._inked = true;
    }
    function stopDraw() { if (!drawing) return; drawing = false; last = null; drawId = null; started = false; if (_hasValues(d.beauty)) _refreshPreview(); }
    el.addEventListener('pointerdown', function (e) {
      if (cur !== 'edit' || !d.maskPaint) return;
      var vp = vpEl(); if (!vp || !vp.contains(e.target)) return;
      if (!pointers[e.pointerId]) { pointers[e.pointerId] = 1; pcount++; }
      // [v565] 두 번째 손가락 감지 → 진행 중 stroke 즉시 중단 + 핀치/줌/팬 모드로 잠금(그리기는 _bindZoom 이 아닌 paint 가 봉인).
      if (pcount >= 2) {
        if (drawing) stopDraw();   // 아직 첫 잉크 전(started=false)이면 잔점 없이 깨끗이 취소.
        gestureLock = true;
        try { if (vp.releasePointerCapture && drawId != null) vp.releasePointerCapture(drawId); } catch (_e0) { void _e0; }
        return;
      }
      if (gestureLock) return;   // [v565] gesture 가 끝나기(모든 손가락 떨어짐) 전엔 단일 포인터라도 그리기 금지.
      var gm = geom(vp); if (!gm) return;
      // [v565] 첫 잉크는 pointerdown 이 아니라 '첫 move(또는 단일 탭 시 pointerup)' 에서 — 핀치 시작 잔점 0.
      drawing = true; drawId = e.pointerId; started = false; last = toImg(e, vp, gm);
      try { if (vp.setPointerCapture) vp.setPointerCapture(e.pointerId); } catch (_e) { void _e; }
      e.preventDefault();
    });
    el.addEventListener('pointermove', function (e) {
      if (!drawing || !d.maskPaint || gestureLock || pcount >= 2 || e.pointerId !== drawId) return;
      var vp = vpEl(); if (!vp) return; var gm = geom(vp); if (!gm) return;
      var pt = toImg(e, vp, gm);
      if (!started) { stroke(gm, null, last); started = true; }   // 단일 포인터 확정 후 시작점부터 잉크.
      stroke(gm, last, pt); last = pt; _renderPaintOverlay(); e.preventDefault();
    });
    function up(e) {
      if (pointers[e.pointerId]) { delete pointers[e.pointerId]; pcount--; if (pcount < 0) pcount = 0; }
      if (e.pointerId === drawId) {
        // [v565] 움직임 없이 뗀 '단일 탭'(핀치 아님) 은 점 하나 — 핀치(gestureLock)면 잉크 0.
        if (drawing && !started && !gestureLock) {
          var vp = vpEl(), gm = vp && geom(vp);
          if (gm) { stroke(gm, null, last); _renderPaintOverlay(); }
        }
        stopDraw();
      }
      if (pcount === 0) gestureLock = false;   // [v565] 모든 손가락이 떨어지면 잠금 해제 → 다음 새 pointerdown 부터 다시 그림.
    }
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  // [v567·필수3] 뷰포트 크기 변경(브라우저 리사이즈/전체화면/방향전환) 시 마스크 overlay 재투영.
  //   마스크 stroke 는 사진 자연해상도(이미지좌표)로 저장되므로 데이터는 보존되지만, overlay 캔버스
  //   비트맵은 칠한 시점의 vp 크기로 고정돼 있어 리사이즈하면 CSS 가 늘여 위치가 틀어진다(절반→풀스크린 드리프트).
  //   여기서 새 vp 크기로 overlay 를 다시 그려(이미지좌표 → 현재 contain rect 재투영) 위치를 항상 정확히 유지.
  function _bindEditResize() {
    if (!el || el._edResizeBound) return; el._edResizeBound = true;
    var _rt = null;
    function reproject() {
      _rt = null;
      if (cur !== 'edit') return;
      if (d.maskPaint || d.maskView) _renderMaskOverlay();   // maskPaint 면 내부에서 _renderPaintOverlay 로 분기
    }
    function onResize() {
      if (cur !== 'edit') return;
      if (_rt) clearTimeout(_rt);
      _rt = setTimeout(reproject, 120);
    }
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    if (window.visualViewport && window.visualViewport.addEventListener) {
      window.visualViewport.addEventListener('resize', onResize);
    }
    document.addEventListener('fullscreenchange', onResize);
  }

  function _roleSummary() {
    var r = {};
    (d.photos || []).forEach(function (p) { r[p.role || 'hero'] = (r[p.role || 'hero'] || 0) + 1; });
    return Object.keys(r).map(function (k) { return ({ before: '전', after: '후', hero: '홍보컷', exclude: '제외' }[k] || k) + ' ' + r[k]; }).join(' · ') || '없음';
  }

  // [시술고정] 시술내역 placeholder 를 온보딩 업종(shop_type) 예시로. 타업종(네일/레이어드컷) 하드코딩 노출 방지.
  function _servicePlaceholder() {
    var st = '';
    try { st = localStorage.getItem('shop_type') || ''; } catch (_e) { st = ''; }
    var cfg = (window.SHOP_CONFIG && window.SHOP_CONFIG[st]) || null;
    var ts = cfg && cfg.treatments && cfg.treatments.length ? cfg.treatments : null;
    if (!ts) return '예: 시술명, 강조 포인트';
    var first = cfg.defaultTag || ts[0];
    var firstInch = /인치/.test(first);
    var second = '';
    for (var i = 0; i < ts.length; i++) {
      if (ts[i] === first) continue;
      if (firstInch && /인치/.test(ts[i])) continue;
      second = ts[i]; break;
    }
    if (!second) { for (var j = 0; j < ts.length; j++) { if (ts[j] !== first) { second = ts[j]; break; } } }
    return '예: ' + first + (second ? ', ' + second : '');
  }

  // [FC4] 게시글 화면 — 3x3 시나리오칩(scenario-selector 재사용) + 고정멘트 꼬리
  function renderCaption() {
    var url = outputUrl();
    if (d.capLoading) {
      return '<div class="cap-loading"><div class="cap-loading-spin"></div><p>AI가 게시글을 쓰는 중…</p></div>';
    }
	    if (!d.caption) {
	      // [v558] 캡션 UX 리뉴얼 — 시나리오 버튼 제거. 사진 → 시술 문구 입력 → 말투 6칩 → 길이 → 해시태그 토글 → 단일 생성 버튼.
	      var photoThumb = _capCarouselHtml() || ((!d.textOnly && url) ?
	        '<div class="cap-photo cap-photo--sm" style="background-image:url(' + esc(url) + ')"></div>' : '');
	      // [Phase A-2] 심플 캡션 — 말투/길이/해시태그 칩 제거. 시술 내용 입력 + 우리샵 스타일 적용 + 캡션 생성.
	      //   레거시(말투 6카드·길이·페르소나·해시태그 토글)는 SIMPLE_FLOW=false 에서 그대로 복원.
	      if (SIMPLE_FLOW) {
	        var _useStyle = (d.useShopStyle !== false);   // 기본 ON
	        var _svc = d.service || '';
	        // [Phase A-3] 활성 우리샵 스타일 카드 — 토글 ON일 때 노출(데이터모델 첫 연결점).
	        //   '변경'(다중 스타일 선택)·실제 자동배치는 Phase C. 여기선 활성 스타일 표시까지.
	        var _ss = (window.ShopStyle && window.ShopStyle.ensureSeed) ? window.ShopStyle.ensureSeed() : null;
	        var _ssCard = (_useStyle && _ss) ? (
	          '<div class="cap-stylecard">' +
	            '<span class="cap-stylecard__ic"><i class="ph-duotone ph-paint-brush-broad"></i></span>' +
	            '<span class="cap-stylecard__tx"><b>' + esc(_ss.name) + (_ss.isDefault ? ' <em>기본</em>' : '') + '</b>' +
	              '<small>최근 수정 ' + esc(window.ShopStyle.formatUpdated(_ss)) + '</small></span>' +
	          '</div>' +
          ((!d.textOnly) ? '<div class="cap-palette" data-fl-palette hidden></div>' : '')) : '';   // [v591·#6] 사진 추천색(async)
	        return photoThumb +
	          '<div class="screen-head"><h2>캡션 생성</h2><p class="screen-head__sub">시술 내용을 입력하면 AI가 우리샵 스타일에 맞춰 게시글을 만들어드려요.</p></div>' +
	          '<label class="cap-field-label">시술 내용</label>' +
	          '<div class="cap-svc-wrap">' +
	            '<textarea class="service-input cap-svc-area" data-fl-service rows="5" maxlength="500" placeholder="자유롭게 입력해 주세요&#10;&#10;예)&#10;레이어드컷&#10;28인치&#10;재시술&#10;자연스러운 느낌으로 부탁해!">' + esc(_svc) + '</textarea>' +
	            '<span class="cap-svc-count"><span data-fl-svccount>' + _svc.length + '</span>/500</span>' +
	          '</div>' +
	          '<div class="cap-style-row">' +
	            '<div class="cap-style-row__tx"><span class="cap-field-label" style="margin:0">우리샵 스타일 적용</span>' +
	              '<span class="cap-style-row__d">' + (_useStyle ? '우리샵 디자인에 맞춰 자동으로 배치해요' : '사진은 그대로 두고 글만 만들어요') + '</span></div>' +
	            '<button type="button" class="cap-switch' + (_useStyle ? ' on' : '') + '" data-fl-cshopstyle role="switch" aria-checked="' + _useStyle + '"><span class="cap-switch__dot"></span></button>' +
	          '</div>' +
	          _ssCard +
	          '<button type="button" class="cap-gen-btn" data-fl-cgen><i class="ph-duotone ph-sparkle"></i> 캡션 생성</button>';
	      }
	      var _tone = d.capTone || 'natural', _len = d.capLen || 'medium', _hashOn = (d.capHashOn !== false);
	      var _chip = function (group, val, label, cur) { return '<button type="button" class="cap-chip' + (cur === val ? ' on' : '') + '" data-fl-' + group + '="' + val + '">' + label + '</button>'; };
	      // [v569·B-1] 말투 선택 = 카드형 리스트('어떤 말투로 써볼까요?'). 값(natural/emotional/…)은 그대로 유지(생성 매핑 불변).
      var toneCards = [
        ['natural', '자연스럽게', '동네 원장님이 설명하듯 편안하고 담백하게.', 'ph-chat-circle-dots'],
        ['emotional', '인스타 감성', '분위기와 무드를 살리는 잔잔한 감성 톤.', 'ph-sparkle'],
        ['professional', '전문가 느낌', '시술 포인트를 또렷하게, 신뢰감 있게.', 'ph-seal-check'],
        ['friendly', '친근하게', '단골에게 말하듯 다정하고 부담 없이.', 'ph-hand-heart'],
        ['premium', '프리미엄', '고급스럽고 차분하게, 절제된 표현으로.', 'ph-crown-simple'],
        ['mz', 'MZ 감성', '짧고 리듬감 있게, 요즘 트렌디한 말투로.', 'ph-lightning']
      ].map(function (o) {
        var on = _tone === o[0];
        return '<button type="button" class="cap-tonecard' + (on ? ' on' : '') + '" data-fl-ctone="' + o[0] + '" aria-pressed="' + on + '">' +
          '<span class="cap-tonecard__ic"><i class="ph-duotone ' + o[3] + '"></i></span>' +
          '<span class="cap-tonecard__tx"><span class="cap-tonecard__t">' + o[1] + '</span><span class="cap-tonecard__d">' + o[2] + '</span></span>' +
          '<span class="cap-tonecard__chk" aria-hidden="true"><i class="ph-bold ph-check"></i></span>' +
        '</button>';
      }).join('');
	      var lenChips = [['short', '짧게'], ['medium', '보통'], ['long', '길게'], ['max', '아주 길게']].map(function (o) { return _chip('clen', o[0], o[1], _len); }).join('');
	      // [v567] 원장님 말투 반영 토글 — 인스타 연동(말투분석 소스) 있을 때만 활성. 기본 OFF(안전).
	      var _igConnIn = (window.WorkspaceAdapter && window.WorkspaceAdapter.instagram) ? window.WorkspaceAdapter.instagram().connected : false;
	      var _useP = (d.capUsePersona === true) && _igConnIn;
	      var personaRow = '<div class="cap-hash-row">' +
	          '<span class="cap-field-label" style="margin:0">원장님 말투 반영' + (_igConnIn ? '' : ' <em style="font-weight:400;color:#9aa3ad;font-style:normal">· 인스타 연동 후 사용</em>') + '</span>' +
	          '<button type="button" class="cap-switch' + (_useP ? ' on' : '') + '"' + (_igConnIn ? '' : ' disabled aria-disabled="true"') + ' data-fl-cpersona role="switch" aria-checked="' + _useP + '"><span class="cap-switch__dot"></span></button></div>';
	      return photoThumb +
	        '<div class="screen-head"><h2>게시글 문구 만들기</h2><p class="screen-head__sub">사진과 시술 내용을 바탕으로 인스타 게시글 문구를 만들어드려요.</p></div>' +
        '<label class="cap-field-label">시술 내용</label>' +
	        '<input class="service-input cap-svc-lg" data-fl-service value="' + esc(d.service || '') + '" placeholder="예: 레이어드컷 28인치 붙임머리, 김수현 고객님, 자연스러운 볼륨감 중심" enterkeyhint="send">' +
	        '<p class="cap-field-hint">시술명·고객님·포인트를 한 줄로 적으면 더 자연스러워요.</p>' +
	        '<div class="cap-tonehead"><span class="cap-tonehead__t">어떤 말투로 써볼까요?</span><span class="cap-tonehead__d">처음 홍보글을 써도 어색하지 않게, 원하는 분위기를 골라보세요.</span></div>' +
        '<div class="cap-tonecards">' + toneCards + '</div>' +
        '<p class="cap-tonefoot">고른 말투로 캡션을 만들어드려요. 선택한 시술 특징도 자연스럽게 반영돼요.</p>' +
	        '<label class="cap-field-label">길이</label><div class="cap-chips cap-chips--seg">' + lenChips + '</div>' +
	        personaRow +
	        '<div class="cap-hash-row"><span class="cap-field-label" style="margin:0">해시태그</span>' +
	          '<button type="button" class="cap-switch' + (_hashOn ? ' on' : '') + '" data-fl-chash role="switch" aria-checked="' + _hashOn + '"><span class="cap-switch__dot"></span></button></div>' +
	        // [v589] 고정 꼬리말 — 한 번 저장해두면 게시글마다 자동으로 붙음. 결과화면이 아닌 설정에서 관리.
        '<div class="captail">' +
          '<div class="captail__head"><span class="captail__label">고정 꼬리말 <em style="font-weight:400;color:#9aa3ad;font-style:normal">· 한 번 저장하면 매번 자동으로 붙어요</em></span>' +
            (d.captionTemplate ? '<button type="button" class="captail__clear" data-fl="footerclear">비우기</button>' : '') +
          '</div>' +
          '<textarea class="captail__edit" data-fl-footer rows="2" placeholder="매장 고정 문구(예약 DM·영업시간). 비우면 게시글에 안 붙어요.">' + esc(d.captionTemplate || '') + '</textarea>' +
          '<button type="button" class="captail__save" data-fl="footersave">이 꼬리말 저장</button>' +
        '</div>' +
        '<button type="button" class="cap-gen-btn" data-fl-cgen>문구 생성하기</button>';
	    }
    // 결과 화면 — [v583·C] 인스타 미리보기 디자인 카드 + 아래 편집 + 인스타 업로드(별도 미리보기 단계 폐지).
    return '' +
	      '<div class="cap-byline">원장님 인스타 글 학습 완료</div>' +
	      '<label class="cap-field-label">게시글 <span>미리보기에서 바로 고쳐 쓸 수 있어요 · 시술을 바꾸려면 아래 처음부터 다시 쓰기</span></label>' +
	      _igPreviewCard(url, true) +   // [v584] 카드 안 캡션 직접 편집(별도 편집칸 제거)
      // [v589] 꼬리말 블록 폐지 → 설정폼으로 이동. 복사/다시생성/저장은 카드 액션줄로 이동.
      // [v587] 별도 해시태그 편집칸 폐지 — 위 미리보기 카드의 해시태그(.ig-hash-edit)를 직접 편집.
      // [Phase B-1] 스토리 편집 진입 — 사진 위에 우리샵 스타일 텍스트를 올려 편집.
      ((SIMPLE_FLOW && !d.textOnly && url) ? '<button type="button" class="cap-edit-btn" data-fl="storyedit"><i class="ph-duotone ph-magic-wand"></i> 사진 편집</button>' : '') +
      
		      _publishBlock() +
		      _feedPreview(url) +   // [v589] 피드 미리보기 — 올리면 내 피드가 어떻게 보이는지
		      '<button type="button" class="cap-restart" data-fl-var="reset">처음부터 다시 쓰기</button>';
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
    _mountCarousel();   // [v531] 결과 캐러셀 스와이프 바인딩(결과 화면엔 scenario 없어 아래 early-return 전에 먼저)
    // [v558] 시나리오 선택기 제거 — 입력화면은 시술 문구 입력 + 말투/길이/해시태그 칩 + 단일 생성 버튼.
    // [v531] 키워드 입력 후 Enter → 바로 생성(편의). 주 경로는 '게시글 만들기' 버튼(data-fl-cgen).
    var svcInput = el.querySelector('[data-fl-service]');
    if (svcInput && !svcInput._wsGenBound) {
      svcInput._wsGenBound = true;
      // [Phase A-2] 멀티라인 textarea(심플 캡션)에선 Enter=줄바꿈 → 생성은 '캡션 생성' 버튼으로만.
      //   기존 한 줄 input(레거시)에서만 Enter→즉시 생성 유지.
      if (svcInput.tagName === 'INPUT') {
        svcInput.addEventListener('keydown', function (e) {
          // [v532] 한글 IME 조합 중 Enter(조합 확정용)는 무시 — 이때 생성하면 마지막 음절이 빠진 채 들어가
          //   '엔터 경로만 키워드 반영이 덜 되는' 증상이 났음. 조합이 끝난 뒤 Enter 에서만 생성.
          if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;
          e.preventDefault();
          _triggerCaptionGenerate(null);
        });
      }
      // [Phase A-2] textarea 글자수 카운터(0/500) 라이브 갱신.
      var _cnt = el.querySelector('[data-fl-svccount]');
      if (_cnt) svcInput.addEventListener('input', function () { _cnt.textContent = String(svcInput.value.length); });
    }
    // [v584·C] 결과 화면 — 카드 안 캡션(contenteditable)을 고치면 d.caption 즉시 동기화(아래 별도 편집칸 폐지).
    var igCap = el.querySelector('[data-fl-igcap]');
    if (igCap && igCap.isContentEditable && !igCap._wsLiveBound) {
      igCap._wsLiveBound = true;
      igCap.addEventListener('input', function () { d.caption = igCap.textContent; });
    }
    // [v587] 카드 안 해시태그(contenteditable)를 고치면 d.hashtags/selectedHashes 즉시 동기화(별도 편집칸 폐지).
    var igHash = el.querySelector('[data-fl-ighash]');
    if (igHash && igHash.isContentEditable && !igHash._wsLiveBound) {
      igHash._wsLiveBound = true;
      igHash.addEventListener('input', function () {
        var hs = _parseHashes(igHash.textContent); d.hashtags = hs; d.selectedHashes = hs.slice();
      });
    }
    // [v589·#3] 결과 화면이면 각 사진에 우리샵 스타일 적용 미리보기 합성(원본은 보존, 결과 표시 전용).
    if (String(d.caption || '').trim()) _autoComposeTemplate();
    // [v591·#6] 입력 화면 + 스타일 ON + 사진 있으면 — 사진에서 추천 색 추출해 팔레트 채움(클라이언트, 무료).
    var pal = el.querySelector('[data-fl-palette]');
    if (pal && !String(d.caption || '').trim() && d.useShopStyle !== false && !d.textOnly) {
      var cp = curPhoto();
      if (cp && cp.dataUrl) {
        _extractPalette(cp.dataUrl, function (cols) {
          if (!cols.length || !pal.isConnected) return;
          pal.innerHTML = '<span class="cap-palette__label">이 사진에서 뽑은 색 · 탭하면 글자색에 적용</span>' +
            '<div class="cap-palette__row">' + cols.map(function (h) { return '<button type="button" class="cap-pal" data-fl-brandcolor="' + esc(h) + '" style="background:' + esc(h) + '" aria-label="' + esc(h) + '"></button>'; }).join('') + '</div>';
          pal.hidden = false;
        });
      }
    }
  }
  // [v532] 캡션 생성 단일 진입점 — Enter/상황버튼 어느 경로든 동일하게:
  //   ① DOM 에서 키워드 최신값 동기화 ② 상황축 반영(없으면 기본 '시술 완성') ③ doGenerate.
  //   두 경로가 같은 함수를 타도록 통합해 입력 반영 차이를 제거한다.
  function _triggerCaptionGenerate(axes) {
    syncServiceFromDom();
    if (axes) d.captionAxes = axes;
    if (!String(d.service || '').trim()) { toast('시술내역/키워드를 입력하면 바로 만들어드려요'); return; }
    if (!d.captionAxes) d.captionAxes = { situation: '시술 완성' };
    doGenerate({}, null);
  }

	  // [v564·필수6] 인스타 미리보기 사진 carousel — 게시글/캡션 화면과 동일한 _displayItems 사용.
	  //   템플릿 적용 pair = 결과 1장, 미적용 = 원본 개별. 좌우 스와이프 + index 도트.
	  function _igCarouselHtml(fallbackUrl) {
	    var items = _displayItems();
	    if (items.length <= 1) {
	      var u = items.length ? items[0].url : fallbackUrl;
	      return '<div class="ig-photo" style="background-image:url(' + esc(u) + ')"></div>';
	    }
	    var active = (d.activeDisplayId && items.some(function (it) { return it.id === d.activeDisplayId; })) ? d.activeDisplayId : items[0].id;
	    var slides = items.map(function (it) {
	      var toggleAttr = it.kind === 'output' && it.expandable ? ' data-fl-tplexpand="' + esc(it.id) + '"'
	        : (it.ofPair ? ' data-fl-tplcollapse="' + esc(it.ofPair) + '"' : '');
	      return '<div class="ig-car__slide" data-fl-carslide="' + esc(it.id) + '"' + toggleAttr + '>' +
	        '<div class="ig-car__img" style="background-image:url(' + esc(it.url) + ')"></div></div>';
	    }).join('');
	    var dots = items.map(function (it) { return '<button type="button" class="ig-car__dot' + (it.id === active ? ' on' : '') + '" data-fl-cardot="' + esc(it.id) + '" aria-label="이 사진 보기"></button>'; }).join('');
	    return '<div class="ig-car cap-car" data-fl-carousel>' +
	      '<div class="ig-car__track cap-car__track" data-fl-cartrack>' + slides + '</div>' +
	      '<div class="ig-car__dots">' + dots + '</div>' +
	    '</div>';
	  }
	  // [v583] 인스타 미리보기 카드(.ig-card2) — 캡션 결과 화면과 (구)preview 화면이 공유.
	  // [v584] editable=true 면 카드 안 캡션을 그 자리에서 직접 편집(아래 별도 편집칸 폐지).
	  function _igPreviewCard(url, editable) {
	    var ig = window.WorkspaceAdapter && window.WorkspaceAdapter.instagramProfile ? window.WorkspaceAdapter.instagramProfile() : { connected: false };
	    var handle = ig.connected && ig.handle ? ig.handle : '인스타 미연동';
	    var name = ig.connected ? (ig.displayName || handle) : '인스타 미연동';
	    var avatar = ig.connected && ig.profilePic
	      ? '<span class="ig-logo ig-logo--photo" style="background-image:url(' + esc(ig.profilePic) + ')"></span>'
	      : '<span class="ig-logo ig-logo--empty"><i class="ph-duotone ph-instagram-logo"></i></span>';
	    return '<div class="ig-card2">' +
	        '<div class="ig-head2">' + avatar + '<span class="ig-name2">' + esc(name) + '</span><span class="ig-loc">' + esc(ig.connected ? '샵 인스타' : '연결 필요') + '</span><span class="ig-dots2">···</span></div>' +
	        _igCarouselHtml(url) +
	        // [v589] 카드 액션줄 기능화 — 인스타 아이콘 자리에 복사·다시생성·저장(결과화면에서만)
	        (editable
	          ? '<div class="ig-act ig-act--fn">' +
	              '<button type="button" class="ig-actbtn" data-fl="copycap" aria-label="게시글 복사"><i class="ph-duotone ph-copy"></i><b>복사</b></button>' +
	              '<button type="button" class="ig-actbtn" data-fl-var="regen" aria-label="다시 생성"><i class="ph-duotone ph-arrows-clockwise"></i><b>다시 생성</b></button>' +
	              '<button type="button" class="ig-actbtn" data-fl="saveimg" aria-label="이미지 저장"><i class="ph-duotone ph-download-simple"></i><b>저장</b></button>' +
	            '</div>'
	          : '<div class="ig-act"><div class="ig-ic"><i class="ph-duotone ph-heart"></i><i class="ph-duotone ph-chat-circle"></i><i class="ph-duotone ph-paper-plane-tilt"></i></div>' +
	            '<div class="ig-save"><i class="ph-duotone ph-bookmark-simple"></i></div></div>') +
	        '<div class="ig-copy2"><b>' + esc(handle) + '</b> <span data-fl-igcap' + (editable ? ' class="ig-cap-edit" contenteditable="true" role="textbox" aria-label="게시글 편집" spellcheck="false"' : '') + '>' + esc(d.caption || '') + '</span><br><span class="ig-hash' + (editable ? ' ig-hash-edit" contenteditable="true" role="textbox" aria-label="해시태그 편집" spellcheck="false' : '') + '" data-fl-ighash>' + esc((d.selectedHashes && d.selectedHashes.length ? d.selectedHashes : d.hashtags).join(' ')) + '</span><div class="ig-ago">' + (editable ? '게시글·해시태그를 눌러 바로 고쳐 쓰기' : '미리보기') + '</div></div>' +
	      '</div>';
	  }
	  // [v589] 피드 미리보기 — 이 사진을 올리면 내 프로필 피드가 어떻게 보일지 그리드로.
	  function _feedPreview(url) {
	    if (!url) return '';
	    var ig = window.WorkspaceAdapter && window.WorkspaceAdapter.instagramProfile ? window.WorkspaceAdapter.instagramProfile() : { connected: false };
	    // 기존 피드 사진이 어댑터에 있으면 사용, 없으면 부드러운 자리표시(라이트 톤)
	    var recent = (ig && ig.media && ig.media.length) ? ig.media.slice(0, 8) : [];
	    var cells = '<div class="wsfeed__cell wsfeed__cell--new" style="background-image:url(' + esc(url) + ')"><span class="wsfeed__new">NEW</span></div>';
	    for (var i = 0; i < 8; i++) {
	      cells += recent[i]
	        ? '<div class="wsfeed__cell" style="background-image:url(' + esc(recent[i]) + ')"></div>'
	        : '<div class="wsfeed__cell wsfeed__cell--ph"></div>';
	    }
	    var stat = ig.connected
	      ? '<div class="wsfeed__prof"><span class="wsfeed__av"' + (ig.profilePic ? ' style="background-image:url(' + esc(ig.profilePic) + ')"' : '') + '></span><b>' + esc(ig.handle || '내 계정') + '</b></div>'
	      : '';
	    return '<div class="wsfeed">' +
	      '<label class="cap-field-label wsfeed__lbl">피드 미리보기 <span>올리면 내 피드가 이렇게 보여요</span></label>' +
	      '<div class="wsfeed__card">' + stat +
	        '<div class="wsfeed__grid">' + cells + '</div>' +
	        '<p class="wsfeed__cap">왼쪽 위가 이번에 올릴 사진이에요' + (ig.connected ? '' : ' · 인스타 연결하면 실제 피드로 보여드려요') + '</p>' +
	      '</div></div>';
	  }
	  function renderPreview() {
	    var url = outputUrl();
	    var custLine = d.customerName ?
	      '<div class="confirmline">연결 손님: <b>' + esc(d.customerName) + '</b>' + (d.customerVc ? ' · ' + d.customerVc + '회 방문' : ' · 첫 방문') + '</div>' : '';
	    return '' + custLine + _igPreviewCard(url) + _publishBlock();
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

  var RENDER = { upload:renderUpload, edit:renderEdit, template:renderTemplate, caption:renderCaption, connect:renderConnect, preview:renderPreview };

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

  // [이슈9] 편집 진입 시 현재 편집 사진의 부위 마스크/모델을 미리 워밍업(사진별 1회).
  //   슬라이더를 만지기 전에 sclera/brow/eyelash 마스크가 캐시에 차도록 → 헤어볼륨/눈썹/눈가가 실제로 적용됨.
  function _warmEditMasks() {
    try {
      var p = curEditPhoto(); if (!p) return;
      var src = p.editedDataUrl || p.dataUrl; if (!src) return;
      d._warmed = d._warmed || {};
      if (d._warmed[p.id]) return; d._warmed[p.id] = true;
      if (window.WorkspaceAdapter && window.WorkspaceAdapter.warmMasks) window.WorkspaceAdapter.warmMasks(src);
    } catch (_e) { /* 워밍업 실패는 무해 — 휴리스틱 폴백 유지 */ }
  }

  /* ── 라우팅 ── */
  function setScreen(name, opts) {
    opts = opts || {};
    // [v531] 캡션 화면을 떠날 땐 항상 입력(본문·해시태그·꼬리말) 확정 → 저장/미리보기/복사에 편집분 반영(어떤 경로든).
    if (cur === 'caption' && name !== 'caption' && el && el.classList.contains('is-open')) flushCaptionInputs();
    // 같은 화면 재렌더(doGenerate/loadRecent 등)는 push 안 함. 뒤로가기(fromBack)도 push 안 함.
    if (name !== cur && opts.push !== false && el && el.classList.contains('is-open')) { navStack.push(cur); _pushHist(); }
    cur = name;
    var to = SCREENS.indexOf(name);
    el.querySelectorAll('.wsv2flow__s').forEach(function (s) {
      var i = SCREENS.indexOf(s.dataset.fs);
      var on = s.dataset.fs === name;
      if (on) {
        // [v566·scope5] 템플릿 사진 스트립의 가로 스크롤 위치 보존(재렌더로 1번째로 튕김 방지).
        var _ps = s.querySelector('[data-fl-tplstrip]');
        var _pl = _ps ? _ps.scrollLeft : 0;
        s.innerHTML = RENDER[name]();
        if (_pl) { var _ns = s.querySelector('[data-fl-tplstrip]'); if (_ns) _ns.scrollLeft = _pl; }
      }
      s.classList.toggle('active', on);
      s.classList.toggle('prev', !on && i < to);
    });
    el.querySelector('[data-fl-title]').textContent = TITLE[name];
    // [Phase A-1] 진행 표시는 '보이는 단계' 기준. 숨김 화면(edit/template)은 SCREENS 인덱스로 폴백(범위 보호).
    var vis = VISIBLE_SCREENS.indexOf(name);
    if (vis < 0) vis = Math.min(to, VISIBLE_SCREENS.length - 1);
    el.querySelector('[data-fl-step]').textContent = (vis + 1) + ' / ' + VISIBLE_SCREENS.length;
    el.querySelectorAll('.wsv2flow__progress .pg-seg').forEach(function (sg, i) { sg.classList.toggle('done', i <= vis); });
    var bar = el.querySelector('.wsv2flow__actionbar'), cta = el.querySelector('[data-fl="cta"]');
    if (CTA[name]) { bar.classList.remove('hidden'); cta.textContent = CTA[name].l; } else bar.classList.add('hidden');
    // [v560] 편집 화면에서만 CTA 2분할(좌:저장하고 게시글 쓰기 / 우:템플릿 선택하기). 그 외엔 단일.
    var cta2 = el.querySelector('[data-fl="cta2"]');
    if (cta2) {
      if (name === 'edit') { cta2.classList.remove('hidden'); cta2.textContent = '템플릿 선택하기'; cta.classList.add('wsv2flow__cta--half'); cta2.classList.add('wsv2flow__cta--half'); }
      else { cta2.classList.add('hidden'); cta.classList.remove('wsv2flow__cta--half'); }
    }
    // [캡션] 생성 트리거는 아래 '시나리오 칩(상황 선택)' 하나로 통일.
    //  생성 전(결과 없음)엔 하단 CTA 숨김 → 칩을 눌러 생성. 생성 후 '고객 연결로' 노출.
    if (name === 'caption' && !String(d.caption || '').trim()) bar.classList.add('hidden');
    var act = el.querySelector('.wsv2flow__s.active'); if (act) act.scrollTop = 0;
    if (name === 'caption') _mountCaption();
    if (name === 'edit') { _warmEditMasks(); var _rc = window.requestAnimationFrame || function (f) { return setTimeout(f, 16); }; _rc(function () { _mountCarousel(); }); }   // [v541] 결과 캐러셀 스와이프 바인딩
    if (name === 'template') { var _rt = window.requestAnimationFrame || function (f) { return setTimeout(f, 16); }; _rt(function () { _mountCarousel(); }); }   // [v560] 템플릿 화면 상단 큰 사진 스와이프
    if (name === 'preview') { var _rp = window.requestAnimationFrame || function (f) { return setTimeout(f, 16); }; _rp(function () { _mountCarousel(); }); }   // [v564·필수6] 인스타 미리보기 carousel 스와이프
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
	  // [v532] extra_notes 빌더 — 핵심: 백엔드 fewshot(샵 과거글)은 '말투'만 참고, '시술 내용'은 입력값만.
	  //   기존엔 category=extension fewshot 이 붙임머리/단발탈출/슬림땋기 등 엉뚱한 시술명을 캡션에 흘렸음.
	  //   → "과거 글은 말투·길이만, 시술명·인치·기법·재료는 입력값만" 으로 프론트에서 강제 차단.
	  //   regenSeq 가 있으면 '앞 글과 다른 구성으로' 변형 지시 추가('다시 쓰기' 가 동일 캡션 반복하던 회귀 해소).
	  function _buildExtraNotes(svc, regenSeq) {
	    var s = String(svc || '').trim().slice(0, 60);
	    var note = '이 게시글의 시술은 오직 "' + s + '". 과거 글·예시는 말투와 문장 길이만 참고하고, 시술명·인치·기법·재료는 입력값만 쓰세요. ' +
	      '입력에 없는 다른 시술/상품명(붙임머리·단발·땋기·매듭·펌 등)은 사진이나 예시에 보여도 절대 언급하지 마세요. ' +
	      '샵·디자이너 이름을 모르면 지어내지 말고 "저희 샵"으로. 구어/비속어는 그대로 쓰지 말고 의미만 뷰티 인스타 톤으로 정제.';
	    if (regenSeq && regenSeq > 0) note += ' (재생성 ' + regenSeq + '회차: 앞 글과 도입부·문장 구성·표현을 다르게, 같은 내용 다른 말로.)';
	    return note.slice(0, 300);
	  }
	  // [v566·scope7] 프론트 렌더 직전 최종 스크러버 — 백엔드 방어를 우회한(구버전 캐시/예외) 상투 누출
	  //   문단을 화면에 그리기 전에 문장째 제거 + 마크다운 원문 제거(이중 안전망).
	  var _CAP_FORBIDDEN = [
	    '시술 전후 차이가 보이시나요', '전후 차이가 보이시나요', '여신 머리', '여신머리',
	    '짧은 단발에서', '단발에서 여신', '변신하는 건 한순간', '변신하는건 한순간',
	    '한 끗', '한끗', '디테일은 한 끗', '묶었을 때 티', '티 나지 않는', '슬림한 매듭',
	    '두상 커', '내 머리 같은 가벼움', '드디어 정착', '정착할 곳', '긴 머리가 주는 무드',
	    '머리가 주는 무드',
	    // 주의: 시술명(붙임머리/매듭/네일 등)은 넣지 않음 — 정당한 시술 캡션 보존(타업종 혼입은 백엔드 도메인 스크럽이 처리).
	  ];
	  // [v570·필수3] 프론트 최소 방어 오타/중복 정리(백엔드가 1차 처리, 표시 직전 백스톱).
	  function _fixTypos(text) {
	    if (!text) return text;
	    return String(text)
	      .replace(/레이아드컷/g, '레이어드컷').replace(/레이아드/g, '레이어드')
	      .replace(/레이어드\s+컷/g, '레이어드컷')
	      .replace(/고객고객님/g, '고객님').replace(/고\s*고객님/g, '고객님')
	      .replace(/(고객님)(?:\s*고객님)+/g, '고객님');
	  }
	  function _scrubCaption(text) {
	    if (!text) return text;
	    text = _fixTypos(text);
	    var nomd = String(text).replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1')
	      .replace(/(^|\n)\s{0,3}#{1,6}\s*/g, '$1').replace(/`/g, '');
	    var out = nomd.split('\n').map(function (line) {
	      var parts = line.split(/(?<=[.!?…])\s+/);
	      return parts.filter(function (s) { return !_CAP_FORBIDDEN.some(function (b) { return s.indexOf(b) >= 0; }); }).join(' ').trim();
	    }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
	    return out || nomd.trim();   // 전부 걸러지면(극단) 마크다운만 제거한 본문 유지
	  }
	  function doGenerate(extra, label) {
	    syncServiceFromDom();
	    var svc = String(d.service || '').trim();
	    if (!svc) { toast('시술 내역을 먼저 입력해 주세요'); return; }
	    if (!(window.WorkspaceAdapter && window.WorkspaceAdapter.generateCaption)) { toast('게시글 생성 모듈을 불러오지 못했어요'); return; }
	    var _wasEmpty = !String(d.caption || '').trim();   // [v531] 입력→결과 최초 전환이면 뒤로가기용 history 마커 push
    // [v532] 재생성('다시 쓰기/더 길게/인스타 톤/짧게')이면 회차 카운터 증가 → extra_notes 변형 지시에 사용(동일 캡션 반복 방지).
    if (extra && extra._regen) d.regenSeq = (d.regenSeq || 0) + 1;
	    d.capLoading = true; setScreen('caption');
	    var photoCtx = d.captionAxes ? [d.captionAxes.situation, d.captionAxes.customer, d.captionAxes.photo].filter(Boolean).join(' / ') : _roleSummary();
	    var opts = Object.assign({ slotId: d.slot && d.slot.id, service: svc, photo_context: photoCtx, mode: d.captionMode || 'normal' }, extra || {});
    delete opts._regen;   // [v532] 내부 재생성 플래그 — 페이로드로 내보내지 않음
    // [v532] 사용자 입력을 캡션 최우선 context 로. '입력 키워드만 시술명으로, 과거 글은 말투만 참고'를 명시 —
    //   백엔드 fewshot(샵 과거글)이 엉뚱한 시술명(붙임머리·단발 등)으로 새는 것을 프론트에서 차단.
    if (svc) {
      opts.photo_context = '시술/키워드(이 게시글의 유일한 시술): ' + svc +
        '. 이 키워드만 시술명으로 쓰고, 입력에 없는 다른 시술/상품명은 절대 만들지 마세요. 과거 글은 말투만 참고' +
        (opts.photo_context ? ' · ' + opts.photo_context : '');
    }
    // [다중pair] 결과물 여러 장이면 '캐러셀 게시글' 기준 — 중립적 전후 변화로(특정 시술명 가정 금지).
    var _outs = d.templateOutputs || [];
    if (_outs.length >= 2) opts.photo_context += ' · 전후 결과물 ' + _outs.length + '장(인스타 캐러셀 한 편). 각 장은 같은 고객의 시술 전/후 변화 컷.';
    else if (_outs.length === 1 && d.tplPurpose === 'before_after') opts.photo_context += ' · 시술 전후 변화 1장.';
    // [v532] photo_context 백엔드 상한 500자 — 다중 pair 노트까지 붙은 뒤 초과 시 422(생성 실패) 방지로 클램프.
    if (opts.photo_context && opts.photo_context.length > 480) opts.photo_context = opts.photo_context.slice(0, 480);
    // [v532] extra_notes — 시술 내용은 입력값만(과거 글은 말투만) + 재생성 변형 지시. 백엔드 상한 300자 내 보장.
    opts.extra_notes = _buildExtraNotes(svc, d.regenSeq);
    // [v534] 백엔드 우선맥락/variation 필드 — 백엔드가 service/treatment_keyword 를 prompt 에 직접 주입하고
    //   caption_intent 별 분기 + previous_caption 반복 방지 + variation_seed 로 동일 결과를 막는다.
    opts.treatment_keyword = svc;
    opts.content_type = d.tplPurpose || 'feed';
    opts.caption_intent = opts.caption_intent || 'generate';
    opts.strict_user_context = true;
    if (opts.caption_intent !== 'generate' && String(d.caption || '').trim()) {
      opts.previous_caption = String(d.caption).slice(0, 1200);   // 변형 시 직전 캡션 반복 방지
    }
    opts.variation_seed = opts.caption_intent + '-' + (d.regenSeq || 0) + '-' + Date.now();
    // [Step5] 다중 결과물/템플릿 요약(트레이스용 — 백엔드 스키마엔 photo_context/extra_notes 텍스트로만 반영).
    opts.selectedTemplateId = d.templateId || null;
    opts.templateOutputs = _outs.map(function (o) { return { pairId: o.pairId, templateId: o.templateId, beforePhotoId: o.beforePhotoId, afterPhotoId: o.afterPhotoId, pairLabel: o.pairLabel }; });
    opts.activeDisplayId = d.activeDisplayId || (_outs[0] && _outs[0].pairId) || null;
    // [v558] 입력화면에서 고른 말투/길이를 생성에 주입(재생성 버튼이 명시 override 하면 그 값 우선).
    opts.tone_override = opts.tone_override || d.capTone || 'natural';
    opts.length_tier = opts.length_tier || d.capLen || 'medium';
    d.capLen = opts.length_tier;
    d.capTone = opts.tone_override;
    // [v567] 원장님 말투 반영 — 토글 ON + 인스타 연동(말투분석 소스 존재) 시에만 페르소나 반영.
    var _igConn = (window.WorkspaceAdapter && window.WorkspaceAdapter.instagram) ? window.WorkspaceAdapter.instagram().connected : false;
    opts.use_persona = (d.capUsePersona === true) && _igConn;
    window.WorkspaceAdapter.generateCaption(opts).then(function (r) {
      d.capLoading = false;
      if (r.ok) {
        var fresh = (r.hashtags || []).map(function (h) { return _fixTypos(h); });   // [v570·3] 태그 오타 백스톱
        if (opts.hashtag_mode === 'more' && d.caption) {
          // [#3] '해시태그 더'/'더 가져오기' = 캡션 유지, 새 해시태그만 누적(중복 제거).
          var merged = (d.hashtags || []).slice();
          fresh.forEach(function (h) { if (merged.indexOf(h) < 0) merged.push(h); });
          var added = merged.length - (d.hashtags || []).length;
          d.hashtags = merged;
          d.selectedHashes = (d.selectedHashes && d.selectedHashes.length ? d.selectedHashes : []).slice();
          fresh.forEach(function (h) { if (d.selectedHashes.indexOf(h) < 0) d.selectedHashes.push(h); });
          if (label) toast(added > 0 ? label : '새 해시태그가 더 없어요');
        } else {
          // [v558] 해시태그 토글 OFF → 게시글에 해시태그 비표시(백엔드는 그대로 생성, 프론트에서만 숨김).
          if (d.capHashOn === false) fresh = [];
          d.caption = _scrubCaption(r.caption); d.hashtags = fresh; d.selectedHashes = fresh.slice();   // [v566·scope7] 렌더 직전 상투/마크다운 제거
          // [v531] 캡션 입력→결과 최초 전환 시 history 마커 1개 push → 결과 화면에서 뒤로가기 = 캡션 입력 화면(편집 X).
          if (_wasEmpty) { navStack.push('caption'); _pushHist(); }
          // [#6] 꼬리말(captionTemplate)은 어댑터가 돌려주지 않으므로 여기서 덮어쓰지 않는다.
          //  (기존 'r.caption_template || ""' 는 재생성 때마다 사용자가 입력한 고정 꼬리말을 빈값으로 지우는 회귀였음)
          if (r.caption_template != null) d.captionTemplate = r.caption_template;
          if (label) toast(label);
        }
        d.logId = r.log_id || d.logId || null;
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
      // [v560] 편집 화면 우측 CTA — 현재 보정 굽고 '템플릿 선택' 화면으로.
      if (a === 'cta2') { return bakeEdit().then(function () { setScreen('template'); }); }
      if (a === 'batoggle') { d.baMode = !d.baMode; d.photos.forEach(function (p) { p.roleManual = false; }); reassignRoles(); _repaintUpload(); return; }
      if (a === 'gen') { return doGenerate({}, null); }
      if (a === 'regen') { return doGenerate({ caption_intent: 'rewrite', _regen: true }, '게시글을 다시 생성했어요'); }
      if (a === 'footersave') { return saveFooter(d.captionTemplate || ''); }
      if (a === 'footerclear') { return saveFooter('', true); }
      if (a === 'toconnect') { flushCaptionInputs(); setScreen('connect'); return; }
      if (a === 'topreview') { flushCaptionInputs(); setScreen('caption'); return; }
      if (a === 'storyedit') { flushCaptionInputs(); return _openStoryEditor(); }
      if (a === 'pickcust') { return pickCustomer(); }
      if (a === 'skipcust') { d.customerId = null; d.customerName = ''; d.customerVc = 0; save(); return; }   // [v583·C] 연결 없이 진행=저장 후 완료
      if (a === 'sharepreview') { toast('피드·스토리 비율과 게시글 줄바꿈을 확인했어요. (실제 업로드 아님)'); return; }
      if (a === 'crop') { return openCropFlow(); }
      // [v568·B-1] 전체화면 편집 — body 클래스로 .ed-photo-vp 를 화면 가득. ESC/버튼으로 닫기. 토글 후 마스크 재투영.
      if (a === 'edfull') {
        d.edFull = !d.edFull;
        try { document.body.classList.toggle('itd-edit-fs', !!d.edFull); } catch (_ef) { void _ef; }
        _renderVpTools();
        setTimeout(function () { if (d.maskPaint || d.maskView) _renderMaskOverlay(); _applyZoomTransform(); }, 60);
        return;
      }
      if (a === 'edzoomfit') { d.zoom = { s: 1, tx: 0, ty: 0 }; _applyZoomTransform(); return; }
      if (a === 'edzoomin') { d.zoom = d.zoom || { s: 1, tx: 0, ty: 0 }; d.zoom.s = Math.min(4, (d.zoom.s || 1) + 0.5); _applyZoomTransform(); return; }
      if (a === 'edzoomout') { d.zoom = d.zoom || { s: 1, tx: 0, ty: 0 }; d.zoom.s = Math.max(1, (d.zoom.s || 1) - 0.5); if (d.zoom.s === 1) { d.zoom.tx = 0; d.zoom.ty = 0; } _applyZoomTransform(); return; }
      if (a === 'roles') { d.rolesOpen = !d.rolesOpen; _setEditSection('[data-ed-adv]', _advFoldHtml()); return; }
      // [v561] 직접 칠하기(수동 마스크) — 자동 인식이 틀릴 때 원장님이 부위를 직접 칠해 교정.
      if (a === 'maskpaint') {
        d.maskPaint = !d.maskPaint;
        if (d.maskPaint) { d.maskView = false; d.maskErase = false; }
        _setEditSection('[data-ed-adv]', _advFoldHtml()); _renderVpTools();
        if (d.maskPaint) { _ensurePaintDims(function () { _renderPaintOverlay(); }); toast(_maskInfoForTab().label + ' 영역을 칠해 교정하세요'); }
        else { _renderMaskOverlay(); }
        return;
      }
      if (a === 'paintdraw') { d.maskErase = false; _setEditSection('[data-ed-adv]', _advFoldHtml()); _renderVpTools(); return; }
      if (a === 'painterase') { d.maskErase = true; _setEditSection('[data-ed-adv]', _advFoldHtml()); _renderVpTools(); return; }
      if (a === 'paintclear') {
        var _pc = _getPaintCanvas(curEditPhoto(), _maskTypeForPaint(), false);
        if (_pc) { _pc.getContext('2d').clearRect(0, 0, _pc.width, _pc.height); _pc._inked = false; }
        _renderPaintOverlay(); if (_hasValues(d.beauty)) _refreshPreview();
        toast('칠한 영역을 비웠어요'); return;
      }
      if (a === 'tplrelease') { return releaseTemplate(); }
      if (a === 'applydefault') {
        // [v531] '기본 템플릿 적용하기' — 현재 유형의 기본 템플릿 자동 적용. 없으면 안내 후 카드에서 고르도록.
        var _cat = _purposeCat(d.tplPurpose);
        var _defId = _getDefaultTpl(_cat);
        if (!_defId) { toast('아직 기본 템플릿이 없어요. 먼저 사용할 템플릿을 골라 기본으로 설정해 주세요.'); return; }
        var _dt = WORKSPACE_TEMPLATES.filter(function (x) { return x.id === _defId; })[0];
        if (!_dt) { toast('기본 템플릿을 찾지 못했어요'); return; }
        return applyTemplate(_dt.key);
      }
      var setdef = t.closest('[data-fl-setdefault]'); if (setdef) {
        // [v531] '기본으로 설정' — 이 템플릿을 해당 유형 기본으로 저장(localStorage, 홈 카드/적용에 반영).
        var _sk = setdef.getAttribute('data-fl-setdefault'); var _st = _tplByKey(_sk); if (!_st) return;
        var _ok = window.WorkspaceDefaultTpl && window.WorkspaceDefaultTpl.set(_purposeCat(_st.purpose), _st.id);
        toast(_ok ? (_st.label + '을(를) 기본 템플릿으로 설정했어요') : '기본 템플릿 저장에 실패했어요');
        _renderTplSection();
        return;
      }
      if (a === 'tplchange') {
        // [v531] '전체 바꾸기'(일괄) — 템플릿 카드 목록을 열고 스크롤. 다른 카드 선택 시 모든 짝에 일괄 재적용.
        // [v532] 짝별 타깃 해제 → 다음 카드 선택은 일괄 적용 경로를 탄다.
        d.tplTargetPair = null;
        d.tplOpen = true; _renderTplSection();
        var grid = el.querySelector('[data-ed-tpl] .tpl-grid2'); if (grid && grid.scrollIntoView) grid.scrollIntoView({ block: 'center' });
        toast('위 템플릿 카드에서 다른 디자인을 고르면 모든 짝에 다시 적용돼요');
        return;
      }
      // [v532] 짝별 '템플릿 바꾸기' — 이 짝만 타깃으로 잡고 갤러리 오픈. 다음 카드 선택은 이 짝만 교체.
      var tplpair = t.closest('[data-fl-tplpair]'); if (tplpair) {
        d.tplTargetPair = tplpair.getAttribute('data-fl-tplpair');
        var _outs0 = d.templateOutputs || [];
        var _idx0 = -1; for (var _pi = 0; _pi < _outs0.length; _pi++) { if (_outs0[_pi].pairId === d.tplTargetPair) { _idx0 = _pi; break; } }
        d.tplOpen = true; _renderTplSection();
        var grid2 = el.querySelector('[data-ed-tpl] .tpl-grid2'); if (grid2 && grid2.scrollIntoView) grid2.scrollIntoView({ block: 'center' });
        toast('이 디자인을 고르면 Pair ' + (_idx0 >= 0 ? _idx0 + 1 : '') + ' 결과만 바뀌어요 (다른 짝은 그대로)');
        return;
      }
      // [v534] 짝별 '템플릿 수정' — 텍스트 레이어 편집 시트 오픈(이 짝만 반영).
      var tpledit = t.closest('[data-fl-tpledit]'); if (tpledit) { return _openTplEdit(tpledit.getAttribute('data-fl-tpledit')); }
      if (a === 'tpleditactive') { return _openTplEdit(d.activeDisplayId || (d.templateOutputs && d.templateOutputs[0] && d.templateOutputs[0].pairId)); }
      // [v541] 결과 캐러셀 — 현재 보고 있는 Pair 기준 '템플릿 바꾸기'/'템플릿 수정'(기존 짝별 로직 재사용).
      if (a === 'tplchange-active') {
        var _apc = _activeOutputPair(); if (!_apc) { toast('바꿀 결과물을 찾지 못했어요'); return; }
        d.tplTargetPair = _apc;
        var _ocs = d.templateOutputs || []; var _ci = -1; for (var _cj = 0; _cj < _ocs.length; _cj++) { if (_ocs[_cj].pairId === _apc) { _ci = _cj; break; } }
        d.tplOpen = true; _renderTplSection();
        var _g = el.querySelector('[data-ed-tpl] .tpl-grid2'); if (_g && _g.scrollIntoView) _g.scrollIntoView({ block: 'center' });
        toast('이 디자인을 고르면 Pair ' + (_ci >= 0 ? _ci + 1 : '') + ' 결과만 바뀌어요 (다른 짝은 그대로)');
        return;
      }
      if (a === 'tpledit-active') { var _ape = _activeOutputPair(); if (!_ape) { toast('수정할 결과물을 찾지 못했어요'); return; } return _openTplEdit(_ape); }
      if (a === 'publish') { return publish(); }
      if (a === 'copycap') { flushCaptionInputs(); window.WorkspaceAdapter && window.WorkspaceAdapter.copyText((d.caption || '') + (d.hashtags.length ? '\n\n' + d.hashtags.join(' ') : '')); _markPrepared(); toast('게시글을 복사했어요'); return; }
      if (a === 'saveimg') { window.WorkspaceAdapter && window.WorkspaceAdapter.saveImage(outputUrl(), d.service || 'itdasy'); _markPrepared(); _askPublishedSheet(); return; }   // [v547] 저장 후 게시 확인 sheet
      if (a === 'pubnot') { return _closePublishSheet(); }
      if (a === 'pubdone') { return _markPublishedNow(); }
      if (a === 'igconnect') { window.WorkspaceAdapter && window.WorkspaceAdapter.connectInstagram(); return; }

      if (t.closest('[data-fl-pick]')) { el.querySelector('[data-fl-file]').click(); return; }
      var del = t.closest('[data-fl-del]'); if (del) { e.stopPropagation(); d.photos.splice(+del.getAttribute('data-fl-del'), 1); reassignRoles(); setScreen('upload'); return; }
      var roleBtn = t.closest('[data-fl-setrole]'); if (roleBtn) { e.stopPropagation(); var _pr = roleBtn.getAttribute('data-fl-setrole').split(':'); _setRole(+_pr[0], _pr[1]); if (cur === 'template') _rerenderTemplate(); else if (d.rolesOpen) _setEditSection('[data-ed-adv]', _advFoldHtml()); return; }
      // [#2] 타일 탭 = 선택/해제 토글. 역할/삭제 버튼은 위에서 이미 처리됨.
      var upTile = t.closest('[data-fl-tile]'); if (upTile && cur === 'upload') { e.stopPropagation(); _toggleSelect(+upTile.getAttribute('data-fl-tile')); return; }
      if (t.closest('[data-fl-edphoto]')) { return; }
      // [perf] 버튼 탭은 해당 섹션만 갱신 — 전체 편집화면(템플릿 6칸 대용량 dataURL) 재생성 안 함.
      // [v554] 'adv'(정밀 조정) 토글 분기 제거 — 항상 펼침이라 접기 동작 없음. bg/tpl 토글은 유지.
      var fold = t.closest('[data-fl-fold]'); if (fold) { var fk = fold.getAttribute('data-fl-fold'); if (fk === 'bg') { d.bgOpen = !d.bgOpen; _setEditSection('[data-ed-basic]', _mainAdjustHtml()); } else if (fk === 'tpl') { d.tplOpen = !d.tplOpen; _renderTplSection(); } return; }
      var edsel = t.closest('[data-fl-editsel]'); if (edsel) { return switchEditPhoto(+edsel.getAttribute('data-fl-editsel')); }
      var edswipe = t.closest('[data-fl-edswipe]'); if (edswipe) { return _stepEditPhoto(edswipe.getAttribute('data-fl-edswipe') === 'next' ? 1 : -1); }   // [v550] PC 화살표
	      var basictool = t.closest('[data-fl-basictool]'); if (basictool) { d.basicTool = basictool.getAttribute('data-fl-basictool'); _setEditSection('[data-ed-basic]', _mainAdjustHtml()); return; }
	      var edtab = t.closest('[data-fl-edtab]'); if (edtab) { d.editTab = edtab.getAttribute('data-fl-edtab'); d.control = null; _setEditSection('[data-ed-adv]', _advFoldHtml()); _renderVpTools(); if (d.maskView || d.maskPaint) _renderMaskOverlay(); return; }
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
      // [v568·B-5] 사진 캐러셀 화살표 / 점 — 한 칸씩 또는 지정 사진으로 스크롤(스냅).
      var tplnav = t.closest('[data-fl-tplnav]'); if (tplnav) { _tplScrollBy(+tplnav.getAttribute('data-fl-tplnav')); return; }
      var tpldot = t.closest('[data-fl-tpldot]'); if (tpldot) { _tplScrollTo(+tpldot.getAttribute('data-fl-tpldot')); return; }
      var tplpick = t.closest('[data-fl-tplpick]'); if (tplpick) { _pickTplRole(tplpick.getAttribute('data-fl-tplpick')); return; }   // [v562·항목3] 클릭순 전/후
      var tplchip = t.closest('[data-fl-tplchip]'); if (tplchip) { d.tplCat = tplchip.textContent.trim(); if (cur === 'template') _rerenderTemplate(); else _renderTplSection(); return; }
	      // [v542] 보정 디버그 — 0/50/100 즉시 적용(실제 프리뷰) + 현재값 복사
	      var fxv = t.closest('[data-fl-fxv]'); if (fxv) {
	        var _fk = _activePrecKey(); if (!_fk) return;
	        var _fv = +fxv.getAttribute('data-fl-fxv'); d.beauty[_fk] = _fv;
	        var _inp = el.querySelector('[data-ed-adv] [data-fl-beautyrange="' + _fk + '"]'); if (_inp) _inp.value = _fv;
	        _setEditSection('[data-ed-adv]', _advFoldHtml()); _refreshPreview();
	        if (d.maskView) _renderMaskOverlay();
	        return;
	      }
	      if (a === 'fxcopy') {
	        var _ck = _activePrecKey(); if (!_ck) return;
	        var _cv = (d.beauty && d.beauty[_ck]) || 0;
	        // [v545] 실제 슬라이더 value 로 측정(0 포함) — 과거 _cv||50 버그로 0/50 동일 delta 찍히던 것 수정.
	        _measureFx(_ck, _cv, function (m) {
	          var log = 'effect=' + _ck + '\nuiKey=' + _ck + '\nengineKey=' + _ck + '\nmask=' + (_FX_MASK[_ck] || '-') +
	            '\nmaskType=' + (m ? (m.hasMask ? 'native' : 'fallback') : '-') + '\nfallbackUsed=' + (m ? m.fallbackUsed : '-') +
	            '\ncoverage=' + (m && m.coverage != null ? m.coverage : '-') +
	            '\nvalue=' + _cv + '\nnorm=' + (_cv / 100).toFixed(2) + '\nnoop=' + (m ? m.noop : (_cv === 0)) +
	            '\ntargetDelta=' + (m ? m.target : '-') + '\noutsideDelta=' + (m ? m.outside : '-') +
	            '\ntime=' + (m ? m.time : (window.__photofxLast || {}).time || '-') + 'ms' +
	            '\ntuningMultiplier=' + (_FX_MULT[_ck] != null ? _FX_MULT[_ck] : '-') +
	            '\nhasMask=' + (m ? m.hasMask : '-') + '\nbuild=' + (window.APP_BUILD || '-');
	          try { console.log('[photofx:copy]\n' + log); } catch (_e) { void _e; }
	          try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(log); } catch (_e2) { void _e2; }
	          toast('현재값을 복사했어요 (콘솔에도 출력)');
	        });
	        return;
	      }
	      // [v541] 확대 미리보기 시트 액션
	      if (t.closest('[data-fl-tppclose]')) { return _closeTplPreview(); }
	      var tppApply = t.closest('[data-fl-tppapply]'); if (tppApply) { _closeTplPreview(); return applyTemplate(tppApply.getAttribute('data-fl-tppapply')); }
	      var tppDef = t.closest('[data-fl-tppdef]'); if (tppDef) {
	        var _dk = tppDef.getAttribute('data-fl-tppdef'); var _dt = _tplByKey(_dk); if (!_dt) return;
	        var _dok = window.WorkspaceDefaultTpl && window.WorkspaceDefaultTpl.set(_purposeCat(_dt.purpose), _dt.id);
	        toast(_dok ? (_dt.label + '을(를) 기본 템플릿으로 설정했어요') : '기본 템플릿 저장에 실패했어요');
	        _renderTplSection(); _closeTplPreview(); return;
	      }
	      var tpl = t.closest('[data-fl-tpl]'); if (tpl) {
	        if (_lpAt && Date.now() - _lpAt < 700) return;
	        var _tk0 = tpl.getAttribute('data-fl-tpl');
	        // [v565·scope3] 이미 결과물이 있는 상태에서 카드 재선택 = '현재 active 결과 1장만' 교체.
	        //   타깃 미지정 + 전후 다중 결과면 active pair 로 한정(초기 적용은 결과물이 없어 전체에 적용됨).
	        var _tko = _tplByKey(_tk0);
	        if (!d.tplTargetPair && _tko && _tko.purpose === 'before_after'
	            && d.tplPurpose === 'before_after' && d.templateOutputs && d.templateOutputs.length) {
	          d.tplTargetPair = _activeOutputPair();
	        }
	        return applyTemplate(_tk0);
	      }
      // [다중pair] 캡션 결과물 캐러셀 — 좌우 화살표/dot 으로 active 결과물 전환(부분 갱신).
      // [v564·필수3] 템플릿 결과 카드 ↔ 원본 전/후 2장 토글
      var tplexp = t.closest('[data-fl-tplexpand]'); if (tplexp) { _togglePairExpand(tplexp.getAttribute('data-fl-tplexpand'), true); return; }
      var tplcol = t.closest('[data-fl-tplcollapse]'); if (tplcol) { _togglePairExpand(tplcol.getAttribute('data-fl-tplcollapse'), false); return; }
      var cardot = t.closest('[data-fl-cardot]'); if (cardot) { return _carSet(cardot.getAttribute('data-fl-cardot')); }
      // [v559] 인라인 결과 pair chip — 활성 pair 전환 후 결과 섹션만 갱신(별도 carousel 스크롤 없음).
      var psel = t.closest('[data-fl-pairsel]'); if (psel) { d.activeDisplayId = psel.getAttribute('data-fl-pairsel'); _rerenderTplResult(); return; }
      var pstep = t.closest('[data-fl-pairstep]'); if (pstep) { _stepPair(pstep.getAttribute('data-fl-pairstep') === 'next' ? 1 : -1); return; }
      // [v532] 추천 해시태그 칩 제거 — 해시태그 토글 핸들러도 함께 삭제(편집은 textarea 직접 입력으로 일원화).
      // [v558] 캡션 입력화면 칩/토글/생성 — 말투/길이/해시태그 선택 + 단일 생성 버튼.
      var ct = t.closest('[data-fl-ctone]'); if (ct) { d.capTone = ct.getAttribute('data-fl-ctone'); setScreen('caption'); return; }
      var cl = t.closest('[data-fl-clen]'); if (cl) { d.capLen = cl.getAttribute('data-fl-clen'); setScreen('caption'); return; }
      var ch = t.closest('[data-fl-chash]'); if (ch) { d.capHashOn = (d.capHashOn === false); setScreen('caption'); return; }
      // [v567] 원장님 말투 반영 토글 — 인스타 미연동이면 안내 후 무시(데이터 없는 반영 금지).
      var cpr = t.closest('[data-fl-cpersona]'); if (cpr) { if (cpr.hasAttribute('disabled')) { toast('인스타를 연동하고 말투를 분석하면 켤 수 있어요'); return; } d.capUsePersona = !(d.capUsePersona === true); setScreen('caption'); return; }
      // [Phase A-2] 우리샵 스타일 적용 토글 — 생성 직전 syncServiceFromDom 으로 입력 보존 후 재렌더.
      var css = t.closest('[data-fl-cshopstyle]'); if (css) { syncServiceFromDom(); d.useShopStyle = !(d.useShopStyle !== false); setScreen('caption'); return; }
      var bc = t.closest('[data-fl-brandcolor]'); if (bc) { syncServiceFromDom(); _applyBrandColor(bc.getAttribute('data-fl-brandcolor')); return; }   // [v591·#6] 추천색 적용
      var cg = t.closest('[data-fl-cgen]'); if (cg) { return _triggerCaptionGenerate(null); }
      // [C4] 재생성 버튼: data-fl-var="regen|short|long"
      var vv = t.closest('[data-fl-var]'); if (vv) {
        var vk = vv.getAttribute('data-fl-var');
	        if (vk === 'short') { return doGenerate({ length_tier: 'short', caption_intent: 'rewrite', _regen: true }, '짧게 다시 생성했어요'); }
	        if (vk === 'long')  { var _nl = (d.capLen === 'long' || d.capLen === 'max') ? 'max' : 'long'; return doGenerate({ length_tier: _nl, caption_intent: 'longer', _regen: true }, _nl === 'max' ? '아주 길게 다시 생성했어요' : '길게 다시 생성했어요'); }
	        if (vk === 'reset') { d.caption = ''; d.hashtags = []; d.selectedHashes = []; d.capLen = 'medium'; d.capTone = 'natural'; d.regenSeq = 0; d.captionMode = (d.tplPurpose === 'review') ? 'review' : 'normal'; d.logId = null; setScreen('caption'); toast('게시글을 초기화했어요 (사진은 그대로예요)'); return; }
	        /* [v532] 'hashtags'(더 가져오기) 케이스 제거 — 추천 칩/더가져오기 UI 삭제로 더 이상 트리거 없음. */
	        // [v532] '인스타 톤' = 백엔드 tone_override enum 의 'ornate'(풍부·SNS 감성)로 매핑. 기존 'instagram' 은 enum(plain/normal/ornate)에 없어 422 → '캡션 생성 실패' 의 직접 원인.
		        if (vk === 'insta') { return doGenerate({ tone_override: 'ornate', caption_intent: 'instagram', _regen: true }, '인스타 톤으로 다시 생성했어요'); }
	        return doGenerate({ caption_intent: 'rewrite', _regen: true }, '게시글을 다시 생성했어요');
	      }
      var seg = t.closest('[data-fl-seg]'); if (seg) { d.capSeg = seg.getAttribute('data-fl-seg'); setScreen('caption'); if (d.capSeg === 'write') { var bd = el.querySelector('[data-fl-igcap],[data-fl-capbody]'); if (bd) bd.focus(); } return; }
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
        var k = e.target.getAttribute('data-fl-range'); d.adjust[k] = +e.target.value;
        var p = el.querySelector('[data-fl-edphoto]');
        var _cep = curEditPhoto();
        var _hasBg = !!(_cep && _cep.bgSpec && _cep.fgCutout);
        if (_hasBg) {
          // [v559] 누끼+배경: 드래그 중에도 인물(fgCutout)에만 보정 — throttle 재합성(배경 불변).
          //   cheap CSS 는 합성본 전체를 필터링해 배경까지 밝아지던 문제(손 떼면 _refreshPreview 가 교정하던 것을 드래그 중에도 일치시킴).
          _throttleRefreshPreview();
        } else if (p && !d.originalPreview) {
          // 누끼 없는 사진: 기존 cheap CSS 필터(부드러움) 유지.
          d.previewUrl = null; p.style.backgroundImage = 'url(' + esc(photoUrl(_cep)) + ')'; p.style.filter = filterCss(d.adjust);
        }
	      }
	      if (e.target.matches('[data-fl-beautyrange]')) {
	        // 정밀(부위) 보정: 무거운 픽셀 연산은 손 뗄 때(change)만 — 드래그 중 점멸/끊김 방지.
	        var bk = e.target.getAttribute('data-fl-beautyrange'); d.beauty[bk] = +e.target.value;
	      }
	      if (e.target.matches('[data-fl-brush]')) { d.maskBrush = +e.target.value; return; }   // [v561] 붓 크기
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
	        // [v559] 전후 템플릿 적용 중이면 보정 결과를 합성 결과에도 반영(디바운스 — _refreshPreview 가 previewUrl 채운 뒤 재합성).
	        if (d.templateId && d.tplPurpose === 'before_after') { if (d._recDeb) clearTimeout(d._recDeb); d._recDeb = setTimeout(_recompositeActivePair, 450); }
	      }
	    });
    _bindZoom();
    _bindPaint();   // [v561] 직접 칠하기(수동 마스크) 포인터 바인딩
    _bindEditResize();   // [v567] 리사이즈/전체화면 시 마스크 overlay 재투영(이미지좌표 보존)
    _bindTplResultSwipe();   // [v561·항목4] 다중 결과물 좌우 스와이프
    _bindTplLongPress();   // [v541] 템플릿 썸네일 long press 확대 미리보기
    _bindTplCarousel();   // [v568·B-5] 사진 캐러셀 PC 드래그 + 점 활성 동기화
  }

  // [v568·B-5] 사진 캐러셀 — 한 칸(슬라이드 폭)씩 스크롤 / 지정 인덱스로 이동 / 점 활성 동기화.
  function _tplStripEl() { return el && el.querySelector('[data-fs="template"] [data-fl-tplstrip], [data-fs="edit"] [data-fl-tplstrip]'); }
  function _tplSlideStep(strip) { var sl = strip.querySelector('.tpls-slide'); return sl ? (sl.getBoundingClientRect().width + 10) : strip.clientWidth; }
  function _tplScrollBy(dir) { var s = _tplStripEl(); if (!s) return; var left = s.scrollLeft + dir * _tplSlideStep(s); if (s.scrollTo) s.scrollTo({ left: left, behavior: 'smooth' }); else s.scrollLeft = left; }
  function _tplScrollTo(i) { var s = _tplStripEl(); if (!s) return; var left = i * _tplSlideStep(s); if (s.scrollTo) s.scrollTo({ left: left, behavior: 'smooth' }); else s.scrollLeft = left; }
  function _tplSyncDots() {
    var s = _tplStripEl(); if (!s) return;
    var dots = el.querySelectorAll('[data-fl-tpldots] .tpls-dot'); if (!dots.length) return;
    var idx = Math.round(s.scrollLeft / Math.max(1, _tplSlideStep(s)));
    for (var i = 0; i < dots.length; i++) dots[i].classList.toggle('on', i === idx);
  }
  function _bindTplCarousel() {
    if (!el || el._tplCarBound) return; el._tplCarBound = true;
    var down = null;
    el.addEventListener('scroll', function (e) { if (e.target && e.target.closest && e.target.closest('[data-fl-tplstrip]')) _tplSyncDots(); }, true);
    // PC 마우스 드래그로 가로 스크롤(클릭과 구분: 5px 이상 움직였을 때만 드래그로 간주).
    el.addEventListener('mousedown', function (e) {
      var s = e.target.closest && e.target.closest('[data-fl-tplstrip]'); if (!s) return;
      down = { s: s, x: e.clientX, sl: s.scrollLeft, moved: false };
    });
    el.addEventListener('mousemove', function (e) {
      if (!down) return; var dx = e.clientX - down.x;
      if (Math.abs(dx) > 5) { down.moved = true; down.s.scrollLeft = down.sl - dx; e.preventDefault(); }
    });
    function _up() { if (down && down.moved) { var snap = down; setTimeout(function () { _tplSyncDots(); void snap; }, 30); } down = null; }
    el.addEventListener('mouseup', _up); el.addEventListener('mouseleave', _up);
    // 드래그 직후 click(전/후 지정) 억제 — 캡처 단계에서 가로채 우발적 역할지정 방지.
    el.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('[data-fl-tplstrip]') && el._tplDragSuppress) { e.stopPropagation(); e.preventDefault(); el._tplDragSuppress = false; } }, true);
    el.addEventListener('mousemove', function () { if (down && down.moved) el._tplDragSuppress = true; });
  }

  // [v541] 템플릿 썸네일 long press(500ms) → 확대 미리보기. short tap → 기존 선택/적용(아래 click 가드).
  //   _lpAt = long press 발화 시각. 직후 click(적용)만 700ms 창으로 억제 → 자동 만료라 '다음 정상 탭'은 안 먹힘.
  var _lpAt = 0;
  function _bindTplLongPress() {
    if (!el || el._tplLpBound) return; el._tplLpBound = true;
    var timer = null, sx = 0, sy = 0, key = null;
    var clear = function () { if (timer) { clearTimeout(timer); timer = null; } key = null; };
    el.addEventListener('pointerdown', function (e) {
      var it = e.target.closest && e.target.closest('[data-fl-tpl]');
      if (!it || cur !== 'edit') return;
      key = it.getAttribute('data-fl-tpl'); sx = e.clientX; sy = e.clientY;
      timer = setTimeout(function () { timer = null; _lpAt = Date.now(); if (key) _openTplPreview(key); }, 500);
    });
    el.addEventListener('pointermove', function (e) {
      if (timer && (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10)) clear();   // 스크롤/드래그 → long press 취소
    });
    el.addEventListener('pointerup', clear);
    el.addEventListener('pointercancel', clear);
  }
  function _tplPreviewSampleCard(tpl) {
    // 업로드 사진이 아닌 '샘플' 템플릿 미리보기(_tplThumb = 사진 미주입 플레이스홀더 렌더).
    return '<div class="tpl-preview__card" style="background-image:url(' + esc(_tplThumb(tpl)) + ')"></div>';
  }
  function _openTplPreview(key) {
    var tpl = _tplByKey(key); if (!tpl) return;
    _closeTplPreview();
    var isDef = _getDefaultTpl(_purposeCat(tpl.purpose)) === tpl.id;
    var wrap = document.createElement('div');
    wrap.className = 'tpl-preview'; wrap.setAttribute('data-fl-tplpreview', '');
    wrap.innerHTML =
      '<div class="tpl-preview__backdrop" data-fl-tppclose></div>' +
      '<div class="tpl-preview__sheet" role="dialog" aria-label="' + esc(tpl.label) + ' 미리보기">' +
        '<div class="tpl-preview__grip"></div>' +
        _tplPreviewSampleCard(tpl) +
        '<div class="tpl-preview__name"><b>' + esc(tpl.label) + '</b><span>' + esc(tpl.use) + '</span></div>' +
        '<div class="tpl-preview__btns">' +
          '<button type="button" class="tpl-preview__apply" data-fl-tppapply="' + esc(key) + '">적용하기</button>' +
          '<button type="button" class="tpl-preview__def' + (isDef ? ' on' : '') + '" data-fl-tppdef="' + esc(key) + '">' + (isDef ? '기본 템플릿' : '기본으로 설정') + '</button>' +
          '<button type="button" class="tpl-preview__close" data-fl-tppclose>닫기</button>' +
        '</div>' +
      '</div>';
    (el || document.body).appendChild(wrap);
    var raf = window.requestAnimationFrame || function (f) { return setTimeout(f, 16); };
    raf(function () { wrap.classList.add('open'); });
  }
  function _closeTplPreview() {
    var w = el && el.querySelector('[data-fl-tplpreview]');
    if (w && w.parentNode) w.parentNode.removeChild(w);
  }
  // 편집 사진 핀치 줌(2손가락) + 1손가락 팬(확대 시) + 더블탭 확대/축소. 뷰포트(.ed-photo-vp) 내부 클립.
  // [v550] 편집 사진 좌우 전환 — 스와이프/화살표/키보드 공용. 굽기(bakeEdit) 포함된 switchEditPhoto 재사용.
  function _stepEditPhoto(dir) {
    var n = editablePhotos().length; if (n < 2) return;
    var cur0 = (d.editIdx == null) ? 0 : d.editIdx;
    var nx = cur0 + dir; if (nx < 0 || nx >= n) return;   // 끝에서는 더 안 넘김(루프 없음)
    switchEditPhoto(nx);
  }
  function _bindZoom() {
    if (!el || el._zoomBound) return; el._zoomBound = true;
    var g = null, lastTap = 0, sw = null;
    function inVp(t) { return t && t.closest && t.closest('[data-fl-edvp]'); }
    el.addEventListener('touchstart', function (e) {
      if (cur !== 'edit' || !inVp(e.target)) return;
      if (!d.zoom) d.zoom = { s: 1, tx: 0, ty: 0 };
      // [v565] 두 손가락 = 확대/이동(pinch+pan). 칠하기 모드에서도 허용 → 확대해서 작은 부위 정밀 마스크.
      if (e.touches.length >= 2) {
        var dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY;
        g = { mode: 'pinch', dist: Math.hypot(dx, dy) || 1, s0: d.zoom.s,
              mx: (e.touches[0].clientX + e.touches[1].clientX) / 2, my: (e.touches[0].clientY + e.touches[1].clientY) / 2,
              tx0: d.zoom.tx, ty0: d.zoom.ty }; sw = null; e.preventDefault();
        return;
      }
      // [v565] 칠하기 모드의 단일 포인터는 paint 핸들러가 담당 — 줌/스와이프/팬 금지(칠하기 우선).
      if (d.maskPaint) return;
      if (e.touches.length === 1 && d.zoom.s > 1) {
        g = { mode: 'pan', x: e.touches[0].clientX, y: e.touches[0].clientY, tx0: d.zoom.tx, ty0: d.zoom.ty }; sw = null; e.preventDefault();
      } else if (e.touches.length === 1 && d.zoom.s <= 1 && editablePhotos().length > 1) {
        sw = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };   // [v550] 줌 아닐 때만 좌우 스와이프 후보
      }
    }, { passive: false });
    el.addEventListener('touchmove', function (e) {
      // [v565·scope1] 스와이프는 sw 만 세팅(g 는 null) → '!g' 로 막지 않는다. 핀치는 칠하기 모드에서도 처리.
      if (cur !== 'edit' || !d.zoom) return;
      if (g && g.mode === 'pinch' && e.touches.length >= 2) {
        var dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY;
        var nmx = (e.touches[0].clientX + e.touches[1].clientX) / 2, nmy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        d.zoom.s = Math.max(1, Math.min(4, g.s0 * (Math.hypot(dx, dy) / g.dist)));
        if (d.zoom.s === 1) { d.zoom.tx = 0; d.zoom.ty = 0; }
        else { d.zoom.tx = g.tx0 + (nmx - g.mx); d.zoom.ty = g.ty0 + (nmy - g.my); }
        _applyZoomTransform(); e.preventDefault();
        return;
      }
      if (d.maskPaint) return;   // [v565] 칠하기 모드 단일 포인터는 무시(paint 담당)
      if (g && g.mode === 'pan' && e.touches.length === 1) {
        d.zoom.tx = g.tx0 + (e.touches[0].clientX - g.x); d.zoom.ty = g.ty0 + (e.touches[0].clientY - g.y);
        _applyZoomTransform(); e.preventDefault();
      } else if (sw && e.touches.length === 1) {
        // [v550] 좌우 스와이프 추적 — 수평이 우세할 때만 큰 프리뷰를 손가락 따라 살짝 끌어 피드백.
        var mx = e.touches[0].clientX - sw.x, my = e.touches[0].clientY - sw.y;
        if (!sw.lock) { if (Math.abs(mx) > 10 || Math.abs(my) > 10) sw.lock = Math.abs(mx) > Math.abs(my) ? 'h' : 'v'; }
        if (sw.lock === 'h') {
          var ph = el.querySelector('[data-fl-edphoto]'); if (ph) ph.style.transform = 'translate3d(' + (mx * 0.42) + 'px,0,0)';   // [v566] GPU 가속(translate3d) + 추종비 상향으로 끈적임 완화
          e.preventDefault();
        }
      }
    }, { passive: false });
    el.addEventListener('touchend', function () {
      if (g && d.zoom && d.zoom.s <= 1) { d.zoom.tx = 0; d.zoom.ty = 0; _applyZoomTransform(); }
      if (sw && sw.lock === 'h') {
        var ph = el.querySelector('[data-fl-edphoto]');
        var mx = sw.lastX != null ? sw.lastX - sw.x : 0;
        if (Math.abs(mx) > 48) { if (ph) ph.style.transform = ''; _stepEditPhoto(mx < 0 ? 1 : -1); }   // 확정: 전환(switchEditPhoto가 재페인트)
        else if (ph) { ph.classList.add('is-swipeback'); ph.style.transform = ''; setTimeout(function () { ph.classList.remove('is-swipeback'); }, 220); }   // 미확정: 부드럽게 원위치
      }
      g = null; sw = null;
    });
    el.addEventListener('touchmove', function (e) { if (sw && e.touches.length === 1) sw.lastX = e.touches[0].clientX; }, { passive: true });
    el.addEventListener('click', function (e) {
      if (cur !== 'edit' || !inVp(e.target)) return;
      var now = Date.now();
      if (now - lastTap < 320) { d.zoom = (d.zoom && d.zoom.s > 1) ? { s: 1, tx: 0, ty: 0 } : { s: 2, tx: 0, ty: 0 }; _applyZoomTransform(); }
      lastTap = now;
    });
    // [v550] PC 키보드 좌우 화살표로 편집 사진 전환(입력란 포커스 중엔 무시). [v568] ESC = 전체화면 닫기.
    document.addEventListener('keydown', function (e) {
      if (cur !== 'edit' || !el || el.hidden) return;
      if (e.key === 'Escape' && d.edFull) { d.edFull = false; try { document.body.classList.remove('itd-edit-fs'); } catch (_x) { void _x; } _renderVpTools(); setTimeout(function () { if (d.maskPaint || d.maskView) _renderMaskOverlay(); _applyZoomTransform(); }, 60); return; }
      var ae = document.activeElement, tag = ae && ae.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (ae && ae.isContentEditable)) return;
      if (e.key === 'ArrowLeft') { _stepEditPhoto(-1); } else if (e.key === 'ArrowRight') { _stepEditPhoto(1); }
    });
    _bindEditPC();
  }
  // [v568·B-3] PC 마우스 — 휠 확대/축소, 드래그(줌>1 팬 / 줌=1 좌우 사진 넘김). 칠하기 모드 단일 포인터는 paint 가 담당.
  function _bindEditPC() {
    if (!el || el._edPcBound) return; el._edPcBound = true;
    var md = null;
    function inVp(t) { return t && t.closest && t.closest('[data-fl-edvp]'); }
    el.addEventListener('wheel', function (e) {
      if (cur !== 'edit' || !inVp(e.target)) return;
      if (!d.zoom) d.zoom = { s: 1, tx: 0, ty: 0 };
      var ns = Math.max(1, Math.min(4, (d.zoom.s || 1) + (e.deltaY < 0 ? 0.25 : -0.25)));
      d.zoom.s = ns; if (ns === 1) { d.zoom.tx = 0; d.zoom.ty = 0; }
      _applyZoomTransform(); e.preventDefault();
    }, { passive: false });
    el.addEventListener('mousedown', function (e) {
      if (cur !== 'edit' || !inVp(e.target) || d.maskPaint) return;
      if (!d.zoom) d.zoom = { s: 1, tx: 0, ty: 0 };
      md = { x: e.clientX, y: e.clientY, tx0: d.zoom.tx, ty0: d.zoom.ty, pan: d.zoom.s > 1, moved: 0 };
    });
    el.addEventListener('mousemove', function (e) {
      if (!md) return;
      md.moved = Math.max(md.moved, Math.abs(e.clientX - md.x));
      if (md.pan) { d.zoom.tx = md.tx0 + (e.clientX - md.x); d.zoom.ty = md.ty0 + (e.clientY - md.y); _applyZoomTransform(); e.preventDefault(); }
      else if (editablePhotos().length > 1) { var ph = el.querySelector('[data-fl-edphoto]'); if (ph) ph.style.transform = 'translate3d(' + ((e.clientX - md.x) * 0.42) + 'px,0,0)'; }
    });
    function _endDrag(e) {
      if (!md) return;
      if (!md.pan && editablePhotos().length > 1) {
        var ph = el.querySelector('[data-fl-edphoto]'); var mx = (e && e.clientX != null) ? e.clientX - md.x : 0;
        if (Math.abs(mx) > 60) { if (ph) ph.style.transform = ''; _stepEditPhoto(mx < 0 ? 1 : -1); }
        else if (ph) { ph.classList.add('is-swipeback'); ph.style.transform = ''; setTimeout(function () { ph.classList.remove('is-swipeback'); }, 220); }
      }
      md = null;
    }
    el.addEventListener('mouseup', _endDrag);
    el.addEventListener('mouseleave', _endDrag);
  }

  function _snapEdit() { return { adjust: clone(d.adjust), beauty: clone(d.beauty) }; }
  function _syncEbState() {
    if (!el) return;
    var u = el.querySelector('[data-fl-eb="되돌리기"]'); if (u) u.classList.toggle('disabled', !(d.undo && d.undo.length));
    var r = el.querySelector('[data-fl-eb="다시실행"]'); if (r) r.classList.toggle('disabled', !(d.redo && d.redo.length));
  }

	  function _refreshPreview() {
	    var photo = curEditPhoto(); if (!photo) return;
	    // [레이어 분리] 누끼+배경 적용본은 인물(fgCutout)/배경(bgSpec)을 분리 보관 →
	    //  밝기/대비 등 보정은 인물에만 적용하고 배경 위에 재합성한다(배경은 보정 영향 안 받음).
	    var hasBg = !!(photo.bgSpec && photo.fgCutout);
	    var base = hasBg ? photo.fgCutout : (photo.editedDataUrl || photo.dataUrl);
	    var p = el.querySelector('[data-fl-edphoto]');
	    var nonzero = _hasValues(d.adjust) || _hasValues(d.beauty);
	    if (!nonzero) {
	      var show = hasBg ? (photo.editedDataUrl || base) : base;
	      d.previewUrl = null; if (p && !d.originalPreview) { p.style.backgroundImage = 'url(' + esc(show) + ')'; p.style.filter = 'none'; } return;
	    }
	    if (!(window.WorkspaceAdapter && window.WorkspaceAdapter.applyWorkspaceCorrections)) { if (p && !d.originalPreview) p.style.filter = filterCss(d.adjust); return; }
	    var token = (d._pvTok = (d._pvTok || 0) + 1);
	    // 정밀(피부/헤어) 보정은 손 뗄 때 픽셀 연산(수백 ms) — 처리 중 표시로 "안 먹는 듯한" 체감 제거.
	    var vp = el.querySelector('[data-fl-edvp]'); if (vp && _hasValues(d.beauty)) vp.classList.add('is-processing');
	    var done = function () { var v = el.querySelector('[data-fl-edvp]'); if (v) v.classList.remove('is-processing'); };
	    // [v539] 화면 미리보기는 다운스케일(긴 변 1100px)로 처리 → release 체감 렉 대폭 완화.
	    //   실제 저장/템플릿 적용(applyEditToPhoto)은 previewMaxPx 없이 풀해상도로 재적용하므로 품질 손실 없음.
	    window.WorkspaceAdapter.applyWorkspaceCorrections({ src: base, adjust: d.adjust, beauty: d.beauty, previewMaxPx: 1100, manualMasks: _manualMasksForCurrent(), maskKey: (photo && (photo._uid || (photo._uid = 'm' + Math.random().toString(36).slice(2, 9)))) }).then(function (r) {
	      if (token !== d._pvTok) { done(); return; }
	      if (!(r && r.ok && r.dataUrl)) { done(); return; }
	      _handleRoiFailures(r.roiFailures || []);
	      var paint = function (url) {
	        done();
	        if (token !== d._pvTok) return;
	        d.previewUrl = url;
	        var p2 = el.querySelector('[data-fl-edphoto]');
	        if (p2 && !d.originalPreview) { p2.style.backgroundImage = 'url(' + url + ')'; p2.style.filter = 'none'; }
	      };
	      if (hasBg) { _compositeBg(photo.bgSpec, r.dataUrl).then(paint); }
	      else { paint(r.dataUrl); }
	    }, done);
	  }
	  // [v559] 누끼+배경 사진 드래그 중 '피사체만 보정' 라이브 미리보기 — _refreshPreview(인물 재합성)를
	  //   throttle(140ms, trailing 보장)로 호출. cheap CSS(합성본 전체 필터→배경까지 밝아짐) 대체.
	  function _throttleRefreshPreview() {
	    var WAIT = 140, now = Date.now();
	    if (!d._pvLast) d._pvLast = 0;
	    var since = now - d._pvLast;
	    if (since >= WAIT) { d._pvLast = now; _refreshPreview(); return; }
	    if (d._pvTrail) clearTimeout(d._pvTrail);
	    d._pvTrail = setTimeout(function () { d._pvTrail = null; d._pvLast = Date.now(); _refreshPreview(); }, WAIT - since);
	  }
	  function _handleRoiFailures(failures) {
	    if (!failures || !failures.length) return;
	    if (failures.indexOf('hand') >= 0) { d.beauty.handSkin = 0; var h = el.querySelector('[data-fl-beautyrange="handSkin"]'); if (h) h.value = 0; toast('손을 인식하지 못했습니다'); }
	    if (failures.indexOf('nail') >= 0) {
	      ['nailGloss', 'nailShape'].forEach(function (k) { d.beauty[k] = 0; var n = el.querySelector('[data-fl-beautyrange="' + k + '"]'); if (n) n.value = 0; });
	      toast('네일을 인식하지 못했습니다');
	    }
	  }
	  // 배경 spec + (보정된) 투명 인물 누끼 → 한 장으로 재합성. 배경은 보정값을 안 받는다.
	  function _coverDraw(c, img, w, h) {
	    var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
	    var s = Math.max(w / iw, h / ih), dw = iw * s, dh = ih * s;
	    c.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
	  }
	  // [v539] 보정된 인물(fgUrl, 투명) + 배경 재합성. rect 점프 수정:
	  //   배경 '적용' 때와 동일한 PhotoEditorBgCompose.compose 경로를 재사용해 같은 ratio/배치/출력크기로 뽑는다.
	  //   (과거엔 fgCutout 원본 크기로 합성 → editedDataUrl(4:5 등)과 aspect 불일치 → cover 에서 크기/위치 점프)
	  //   compose 는 preRemovedBgUrl 로 매팅 스킵(빠름). srcUrl=원본(블러 배경 소스용).
	  function _compositeBg(bgSpec, fgUrl) {
	    var BC = window.PhotoEditorBgCompose;
	    if (BC && typeof BC.compose === 'function' && bgSpec) {
	      var bgd = bgSpec.action === 'image' ? { imageData: bgSpec.bgImage }
	        : bgSpec.action === 'color' ? { type: 'procedural', color: bgSpec.color || '#ffffff' }
	        : bgSpec.action === 'blur' ? { type: 'blur' } : { type: 'none' };
	      return Promise.resolve(BC.compose({ srcUrl: bgSpec.origUrl || fgUrl, preRemovedBgUrl: fgUrl, bg: bgd, targetRatio: bgSpec.ratio || 'original' }))
	        .then(function (r) { return (r && r.composedDataUrl) || fgUrl; })
	        .catch(function () { return fgUrl; });
	    }
	    return new Promise(function (resolve) {
	      var fg = new Image();
	      fg.onload = function () {
	        var w = fg.naturalWidth || fg.width, h = fg.naturalHeight || fg.height;
	        var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
	        var c = cv.getContext('2d');
	        var drawFg = function () { try { c.drawImage(fg, 0, 0, w, h); resolve(cv.toDataURL('image/png')); } catch (_e) { resolve(fgUrl); } };
	        var act = bgSpec && bgSpec.action;
	        if (act === 'color') { c.fillStyle = bgSpec.color || '#ffffff'; c.fillRect(0, 0, w, h); drawFg(); }
	        else if (act === 'image' && bgSpec.bgImage) { var bi = new Image(); bi.onload = function () { _coverDraw(c, bi, w, h); drawFg(); }; bi.onerror = drawFg; bi.src = bgSpec.bgImage; }
	        else if (act === 'blur' && bgSpec.origUrl) { var bo = new Image(); bo.onload = function () { c.save(); c.filter = 'blur(' + Math.max(6, Math.round(Math.min(w, h) * 0.03)) + 'px)'; _coverDraw(c, bo, w, h); c.filter = 'none'; c.restore(); drawFg(); }; bo.onerror = drawFg; bo.src = bgSpec.origUrl; }
	        else { drawFg(); }   // removeBg/none → 투명 배경
	      };
	      fg.onerror = function () { resolve(fgUrl); };
	      fg.src = fgUrl;
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
  // [v540] 내 콘텐츠 편집 딥링크 — 진입 직후 해당 섹션으로 스크롤(+crop 은 비율 시트 바로 오픈).
  function _applyFocusScroll() {
    if (!d || !d._focusIntent || cur !== 'edit' || !el) return;
    var intent = d._focusIntent; d._focusIntent = null;
    if (window.__ITDASY_PHOTO_DEBUG__) { try { console.log('[workspace-route] intent=' + intent + ' editTab=' + d.editTab + ' bgOpen=' + d.bgOpen + ' tplOpen=' + d.tplOpen); } catch (_e) { void _e; } }
    var sel = intent === 'template' ? '[data-ed-tpl]' : intent === 'crop' ? '[data-ed-adv]' : '[data-ed-basic]';
    var node = el.querySelector('[data-fs="edit"] ' + sel);
    if (node && node.scrollIntoView) { try { node.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (_e2) { try { node.scrollIntoView(); } catch (_e3) { void _e3; } } }
    if (intent === 'crop' && typeof openCropFlow === 'function') { try { openCropFlow(); } catch (_e4) { void _e4; } }
  }
  function _editBottom(label) {
    if (label === '마스크') { d.maskView = !d.maskView; if (d.maskView) d.maskPaint = false; _setEditSection('[data-ed-adv]', _advFoldHtml()); _renderVpTools(); _renderMaskOverlay(); if (d.maskView) toast('현재 부위 마스크를 표시해요'); return; }
    if (label === '비교' || label === '원본보기') { d.originalPreview = !d.originalPreview; _paintEditPhoto(); _setEditSection('[data-ed-bottom]', _editBottomHtml()); if (!d.originalPreview) _refreshPreview(); _renderMaskOverlay(); return; }
    // [v560] 되돌리기/다시실행/초기화는 비교(원본보기) 모드를 자동 해제 — 안 그러면 복원 결과가
    //   원본 프리뷰에 가려 '작업이 날아간 것처럼' 보임(_refreshPreview 가 originalPreview 시 미페인트).
    if (label === '되돌리기') { if (d.undo && d.undo.length) { d.redo = d.redo || []; d.redo.push(_snapEdit()); var s = d.undo.pop(); d.adjust = s.adjust || newAdjust(); d.beauty = s.beauty || newBeauty(); d.previewUrl = null; d.originalPreview = false; _repaintEditAfterAdjust(); } return; }
    if (label === '다시실행') { if (d.redo && d.redo.length) { d.undo = d.undo || []; d.undo.push(_snapEdit()); var r = d.redo.pop(); d.adjust = r.adjust || newAdjust(); d.beauty = r.beauty || newBeauty(); d.previewUrl = null; d.originalPreview = false; _repaintEditAfterAdjust(); } return; }
	    if (label === '초기화') { d.undo = d.undo || []; d.undo.push(_snapEdit()); if (d.undo.length > 30) d.undo.shift(); d.redo = []; d.adjust = newAdjust(); d.beauty = newBeauty(); d.previewUrl = null; d.originalPreview = false; var _ip = curEditPhoto(); if (_ip && _ip._uid && d._paintCv) delete d._paintCv[_ip._uid]; if (d.maskPaint) _renderPaintOverlay(); _repaintEditAfterAdjust(); toast('보정을 초기화했어요'); return; }
  }

	  function applyBg(action) {
	    var photo = curEditPhoto();
    if (!photo) { toast('사진이 없어요'); return; }
    // 원본 되돌리기 — 배경 적용 전 사진(preBgUrl)으로 복귀, 레이어 상태 해제.
    if (action === 'reset' || action === 'original') {
      if (photo.preBgUrl) photo.editedDataUrl = photo.preBgUrl;
      photo.bgSpec = null; photo.fgCutout = null; d.bgAction = null; d.bgColor = null; d.previewUrl = null;
      setScreen('edit'); _refreshPreview(); toast('배경을 원래대로 되돌렸어요'); return;
    }
    if (!(window.WorkspaceAdapter && window.WorkspaceAdapter.applyWorkspaceBgAction)) { toast('배경 모듈을 불러오지 못했어요'); return; }
    var prev = d.bgAction;
    // 항상 '배경 적용 전 원본'에서 재합성 — 색→흐림 등 옵션 전환 시 합성본을 또 누끼하지 않도록.
    var composeSrc = photo.preBgUrl || photo.editedDataUrl || photo.dataUrl;
    d.bgAction = action; d.bgBusy = true; d.bgFail = false; setScreen('edit');
    window.WorkspaceAdapter.applyWorkspaceBgAction({ src: composeSrc, action: action, color: d.bgColor, bgImage: d.customBg, ratio: CROP_RATIO[d.tplPurpose] || 'original' })
      .then(function (r) {
        d.bgBusy = false;
        if (r && r.ok && r.dataUrl) {
          if (!photo.preBgUrl) photo.preBgUrl = composeSrc;   // 최초 1회 원본 보관(되돌리기용)
          photo.editedDataUrl = r.dataUrl;
          photo.fgCutout = r.removedBg || null;   // 투명 인물 — 이후 보정은 여기에만
          // [v539] ratio 저장 — 직후 슬라이더 재합성(_compositeBg)이 적용 때와 '동일 비율/배치'로 출력해야
          //   크기 점프가 안 생긴다. (editedDataUrl 은 ratioToSize(ratio) 크기, fgCutout 은 원본 크기라 불일치했음)
          photo.bgSpec = photo.fgCutout ? { action: action, color: d.bgColor, bgImage: d.customBg, origUrl: photo.preBgUrl, ratio: CROP_RATIO[d.tplPurpose] || 'original' } : null;
          d.previewUrl = null; d.bgFail = false; toast('배경 적용 완료'); setScreen('edit'); _refreshPreview();
        }
        else { d.bgAction = prev; d.bgFail = true; d.bgFailMsg = (r && r.toast) || '배경 처리에 실패했어요'; toast(d.bgFailMsg); setScreen('edit'); }
	      });
	  }

	  function _tplByKey(key) {
	    return WORKSPACE_TEMPLATES.filter(function (t) { return t.key === key; })[0] || null;
	  }
	  // [v560] 템플릿 적용 후 복귀 화면 — 'template' step 에서 적용하면 그 화면 유지(편집으로 안 튐), 그 외엔 편집.
	  function _tplReturnScreen() { return cur === 'template' ? 'template' : 'edit'; }
	  // [v560] '템플릿 선택' 전용 화면 — 상단 큰 사진(좌우 스와이프) + 전·후 클릭 지정 + 템플릿 목록.
	  //   기존 렌더(_rolesPanelHtml/_tplAppliedHtml/_tplThumb)와 핸들러(data-fl-setrole/tpl/tplchip) 재사용.
	  // [v562·항목3] 클릭순 전/후 — d.tplPickSeq(사진 id 클릭 순서) 기준으로 role 부여(짝수=전/홀수=후).
	  function _syncPickSeq() {
	    var eps = editablePhotos();
	    if (!d.tplPickSeq) d.tplPickSeq = [];
	    // 삭제된 사진 id 제거
	    d.tplPickSeq = d.tplPickSeq.filter(function (pid) { return eps.some(function (x) { return String(x.id) === String(pid); }); });
	    // 시퀀스가 비어 있으면 현재 역할(자동 배치 결과)에서 순서 복원 → 첫 탭부터 자연스럽게 토글.
	    if (!d.tplPickSeq.length) {
	      var bef = eps.filter(function (p) { return p.role === 'before'; });
	      var aft = eps.filter(function (p) { return p.role === 'after'; });
	      var seq = [];
	      for (var i = 0; i < Math.max(bef.length, aft.length); i++) { if (bef[i]) seq.push(String(bef[i].id)); if (aft[i]) seq.push(String(aft[i].id)); }
	      d.tplPickSeq = seq;
	    }
	    return d.tplPickSeq;
	  }
	  function _pickSeqNo(id) {
	    var seq = d.tplPickSeq || []; var k = seq.indexOf(String(id));
	    if (k < 0 || seq.length <= 2) return '';   // 2장(1짝)이면 번호 생략
	    return String(Math.floor(k / 2) + 1);      // 짝 번호(1,1,2,2,…)
	  }
	  function _applyPickRoles() {
	    var eps = editablePhotos(); var seq = d.tplPickSeq || [];
	    eps.forEach(function (p) {
	      var k = seq.indexOf(String(p.id));
	      if (k < 0) { p.role = 'hero'; p.roleManual = false; }
	      else { p.role = (k % 2 === 0) ? 'before' : 'after'; p.roleManual = true; }
	    });
	  }
	  function _pickTplRole(id) {
	    var eps = editablePhotos();
	    if (!eps.some(function (x) { return String(x.id) === String(id); })) return;
	    _syncPickSeq();
	    var sid = String(id), k = d.tplPickSeq.indexOf(sid);
	    if (k >= 0) d.tplPickSeq.splice(k, 1);   // 다시 탭 → 해제
	    else d.tplPickSeq.push(sid);             // 새 탭 → 다음 순서(전/후/전/후…)
	    _applyPickRoles();
	    d.templateId = null; d.templateOutputs = []; d.templateOutput = null;   // 역할 바뀌면 기존 결과 무효화
	    _rerenderTemplate();
	  }
	  function renderTemplate() {
	    _syncPickSeq();
	    var eps = editablePhotos();
	    // [v562·항목3] 상단 사진을 '순서대로 탭'하면 전/후 자동 지정(첫 탭=전, 둘째 탭=후, 다시 탭=해제).
	    //   다중(4장)이면 전·후·전·후 순으로 짝이 만들어진다. 좌우 스와이프(스크롤)는 그대로.
	    var strip = eps.map(function (p, i) {
	      var role = p.role || 'hero';
	      var rl = role === 'before' ? '전' : (role === 'after' ? '후' : '');
	      var seqNo = _pickSeqNo(p.id);   // 전/후 짝 번호(2짝 이상일 때만 표시)
	      return '<button type="button" class="tpls-slide' + (rl ? ' is-' + role : '') + '" data-fl-tplpick="' + esc(p.id) + '" style="background-image:url(' + esc(photoUrl(p)) + ')" aria-label="' + esc(_editPhotoLabel(p, i)) + ' — 탭하면 전/후 지정">' +
	        (rl ? '<span class="tpls-slide__role">' + rl + (seqNo ? '<em>' + seqNo + '</em>' : '') + '</span>'
	            : '<span class="tpls-slide__tag">탭 → 전/후</span>') +
	      '</button>';
	    }).join('');
	    var chips = ['전체', '전후', '붙이기', '시술 자랑', '고객 후기', '이벤트', '스토리'];
	    var shown = WORKSPACE_TEMPLATES.filter(function (tpl) { return !d.tplCat || d.tplCat === '전체' || tpl.chip === d.tplCat; });
	    var grid = shown.map(function (tpl) {
	      var on = d.templateId === tpl.id;
	      return '<div class="tpl-itemwrap"><button type="button" class="tpl-item' + (on ? ' on' : '') + '" data-fl-tpl="' + esc(tpl.key) + '" aria-label="' + esc(tpl.label) + ' 템플릿' + (on ? ' (적용됨)' : '') + '" style="background-image:url(' + esc(_tplThumb(tpl)) + ')"><i class="tpl-badge">' + esc(tpl.chip) + '</i>' + (on ? '<i class="tpl-onpill">적용됨</i>' : '') + '</button></div>';
	    }).join('');
	    return '<div class="tpls">' +
	      '<div class="tpls-carousel' + (eps.length > 1 ? ' is-multi' : '') + '" data-fl-tplcar>' + (eps.length > 1 ? '<button type="button" class="tpls-nav tpls-nav--prev" data-fl-tplnav="-1" aria-label="이전 사진"><i class="ph-bold ph-caret-left"></i></button>' : '') + '<div class="tpls-strip" data-fl-tplstrip aria-label="편집한 사진 — 좌우로 넘겨 확인">' + (strip || '<div class="tpls-empty">선택된 사진이 없어요. 먼저 사진을 골라 주세요.</div>') + '</div>' + (eps.length > 1 ? '<button type="button" class="tpls-nav tpls-nav--next" data-fl-tplnav="1" aria-label="다음 사진"><i class="ph-bold ph-caret-right"></i></button>' : '') + '</div>' + (eps.length > 1 ? '<div class="tpls-dots" data-fl-tpldots>' + eps.map(function (p, i) { return '<button type="button" class="tpls-dot' + (i === 0 ? ' on' : '') + '" data-fl-tpldot="' + i + '" aria-label="' + (i + 1) + '번째 사진으로"></button>'; }).join('') + '</div>' : '') +
	      _tplAppliedHtml() +
	      (eps.length >= 2 ? '<div class="tpls-sec"><div class="cap-field-label">전·후 지정 <span>위 사진을 순서대로 탭 — 첫 탭 <b>전</b>, 둘째 탭 <b>후</b> (다시 탭하면 해제)</span></div></div>' : '') +
	      '<div class="tpls-sec"><div class="cap-field-label">템플릿 고르기 <span>탭하면 바로 적용돼요</span></div>' +
	        '<div class="tpl-chips">' + chips.map(function (c, i) { return '<span class="tpl-chip' + ((d.tplCat ? d.tplCat === c : i === 0) ? ' on' : '') + '" data-fl-tplchip>' + esc(c) + '</span>'; }).join('') + '</div>' +
	        '<div class="tpl-grid2">' + grid + '</div>' +
	      '</div>' +
	    '</div>';
	  }
	  // [v561·항목5] 2장 50:50 합성(좌우/상하) — cover 크롭으로 비율 깨짐 최소화, 1px 흰 거터.
	  function _composeCollage(urlA, urlB, layout) {
	    return new Promise(function (resolve) {
	      var imgs = [], done = 0, fail = false;
	      [urlA, urlB].forEach(function (u, i) {
	        var im = new Image();
	        im.onload = function () { imgs[i] = im; if (++done === 2 && !fail) _draw(); };
	        im.onerror = function () { fail = true; resolve(null); };
	        im.src = u;
	      });
	      function _coverBlit(ctx, im, dx, dy, dw, dh) {
	        var iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
	        var s = Math.max(dw / iw, dh / ih), sw = dw / s, sh = dh / s;
	        var sx = (iw - sw) / 2, sy = (ih - sh) / 2;
	        ctx.drawImage(im, sx, sy, sw, sh, dx, dy, dw, dh);
	      }
	      function _draw() {
	        var W = 1080, H = 1080, gap = 4;   // 정사각 캔버스 + 가는 흰 거터
	        var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
	        var ctx = cv.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
	        if (layout === 'tb') {
	          var hh = (H - gap) / 2;
	          _coverBlit(ctx, imgs[0], 0, 0, W, hh);
	          _coverBlit(ctx, imgs[1], 0, hh + gap, W, hh);
	        } else {   // 'lr'
	          var hw = (W - gap) / 2;
	          _coverBlit(ctx, imgs[0], 0, 0, hw, H);
	          _coverBlit(ctx, imgs[1], hw + gap, 0, hw, H);
	        }
	        resolve(cv.toDataURL('image/jpeg', 0.92));
	      }
	    });
	  }
	  function _applyCollage(tpl) {
	    var eps = editablePhotos();
	    if (eps.length < 2) { toast('붙이기 템플릿은 사진 2장이 필요해요 · 사진을 더 추가해 주세요'); setScreen('upload'); return; }
	    // 전·후 역할이 지정돼 있으면 그 순서(전→후), 아니면 선택 순서 첫 2장.
	    var pairs = _computePairs().pairs;
	    var a, b;
	    if (pairs.length) { a = pairs[0].before; b = pairs[0].after; }
	    else { a = eps[0]; b = eps[1]; }
	    d.templateBusy = tpl.key; setScreen(_tplReturnScreen());
	    _composeCollage(photoUrl(a), photoUrl(b), tpl.collage || 'lr').then(function (url) {
	      d.templateBusy = null;
	      if (url) {
	        d.templateOutput = url; d.templateOutputId = tpl.id;
	        d.templateOutputs = [{ pairId: 'pair-0', templateId: tpl.id, beforePhotoId: a.id, afterPhotoId: b.id, outputUrl: url, pairLabel: '결과물' }];
	        d.activeDisplayId = null;
	        d.template = tpl.label; d.templateId = tpl.id;
	        d.tplPurpose = tpl.purpose; d.captionMode = tpl.captionMode || d.captionMode;
	        d.previewUrl = null; toast(tpl.label + ' 완료');
	      } else { toast('사진을 붙이지 못했어요 · 다시 시도해 주세요'); }
	      setScreen(_tplReturnScreen());
	    });
	  }
	  function applyTemplate(key) {
	    var tpl = _tplByKey(key);
	    if (!tpl) { toast('템플릿을 찾지 못했어요'); return; }
	    if (!(window.WorkspaceAdapter && window.WorkspaceAdapter.applyWorkspaceTemplate)) { toast('템플릿 적용 모듈을 불러오지 못했어요'); return; }
	    if (!d.photos.length) { toast('사진을 먼저 추가해 주세요'); return; }
	    // [v532] 짝별 타깃은 전후 템플릿에서만 의미 — 비전후 템플릿을 고르면 타깃을 비우고 일반(일괄) 전환으로.
	    if (tpl.purpose !== 'before_after') d.tplTargetPair = null;
	    // [v561·항목5] 단순 붙이기(collage) — 2장을 50:50 으로 캔버스 합성. 꾸밈/텍스트 없음.
	    if (tpl.purpose === 'collage') { _applyCollage(tpl); return; }
	    // [버그5] 전후 템플릿은 최소 2장 — 1장이면 자동완성/자동보정 금지, 업로드 화면으로 보내 사진 추가 유도(편집기 점프 금지).
	    // [#7] 전후 템플릿은 최소 2장 — 1장이면 자동완성/자동보정 금지. 안내 후 업로드 화면으로(편집기 점프 금지).
	    if (tpl.purpose === 'before_after' && editablePhotos().length < 2) {
	      toast('전후 템플릿은 최소 2장의 사진이 필요해요 · 전 사진과 후 사진을 추가해 주세요');
	      setScreen('upload'); return;
	    }
	    // [다중pair] 전후 템플릿: 완성 가능한 모든 페어에 같은 템플릿을 각각 적용 → 결과물 N개.
	    //   roles 가 이미 페어를 이루면(수동/복원) 보존하고, 못 이루면(2장 신규 드롭) 첫=전·둘째=후 자동.
	    if (tpl.purpose === 'before_after') {
	      d.baMode = true;
	      if (_computePairs().pairs.length === 0) reassignRoles();
	      var pairs = _computePairs().pairs;
	      // [v532] 짝별 개별 적용 — 타깃 짝이 지정되어 있으면 그 짝만 새 템플릿으로 재합성하고 나머지는 그대로 둔다.
	      if (d.tplTargetPair) {
	        var _tgtId = d.tplTargetPair;
	        var _outsP = (d.templateOutputs || []).slice();
	        var _oidx = -1; for (var _ok = 0; _ok < _outsP.length; _ok++) { if (_outsP[_ok].pairId === _tgtId) { _oidx = _ok; break; } }
	        if (_oidx < 0) { d.tplTargetPair = null; toast('바꿀 짝을 찾지 못했어요 — 전체 적용으로 진행해 주세요'); return; }
	        var _exist = _outsP[_oidx];
	        // 저장된 before/after 사진 id 로 현재 페어를 매칭(선택/역할 변동에도 정확히 그 짝을 재합성). 없으면 인덱스 폴백.
	        var _pr = null;
	        for (var _pj = 0; _pj < pairs.length; _pj++) { if (pairs[_pj].before.id === _exist.beforePhotoId && pairs[_pj].after.id === _exist.afterPhotoId) { _pr = pairs[_pj]; break; } }
	        if (!_pr) _pr = pairs[_oidx];
	        if (!_pr) { d.tplTargetPair = null; toast('이 짝의 사진을 찾지 못했어요'); return; }
	        d.templateBusy = tpl.key; setScreen(_tplReturnScreen());
	        window.WorkspaceAdapter.applyWorkspaceTemplate({
	          template: tpl, photos: [_pr.before, _pr.after], service: d.service,
	          customerName: d.customerName, caption: d.caption,
	        }).then(function (r) {
	          d.templateBusy = null; d.tplTargetPair = null;
	          if (r && r.ok && r.dataUrl) {
	            _outsP[_oidx] = { pairId: _tgtId, templateId: tpl.id, beforePhotoId: _pr.before.id, afterPhotoId: _pr.after.id, outputUrl: r.dataUrl, pairLabel: _exist.pairLabel || ('Pair ' + (_oidx + 1)) };
	            d.templateOutputs = _outsP;
	            d.templateOutput = _outsP[0] && _outsP[0].outputUrl;   // 대표 미리보기 = 첫 짝
	            d.templateId = d.templateId || tpl.id;                 // '적용됨' 마커 유지
	            d.tplPurpose = tpl.purpose; d.previewUrl = null;
	            toast('Pair ' + (_oidx + 1) + ' 결과를 ' + tpl.label + '(으)로 바꿨어요');
	          } else { toast((r && r.toast) || '이 짝은 아직 적용하지 못했어요'); }
	          setScreen(_tplReturnScreen());
	        }).catch(function () { d.templateBusy = null; d.tplTargetPair = null; toast('이 짝 적용 중 오류가 났어요'); setScreen(_tplReturnScreen()); });
	        return;
	      }
	      d.templateBusy = tpl.key; setScreen(_tplReturnScreen());
	      Promise.all(pairs.map(function (pr, i) {
	        // 페어 1개씩 어댑터에 2장만 넘김(어댑터는 before/after 1쌍을 합성). 실패 페어는 null → 격리.
	        return window.WorkspaceAdapter.applyWorkspaceTemplate({
	          template: tpl, photos: [pr.before, pr.after], service: d.service,
	          customerName: d.customerName, caption: d.caption,
	        }).then(function (r) {
	          return (r && r.ok && r.dataUrl)
	            ? { pairId: 'pair-' + i, templateId: tpl.id, beforePhotoId: pr.before.id, afterPhotoId: pr.after.id, outputUrl: r.dataUrl, pairLabel: 'Pair ' + (i + 1) }
	            : null;
	        }).catch(function () { return null; });
	      })).then(function (list) {
	        d.templateBusy = null;
	        var outs = list.filter(Boolean);
	        if (outs.length) {
	          // [이슈2] 합성 결과물은 전용 배열에만 보관 — 원본 photos(전/후/기본)는 비오염.
	          d.templateOutputs = outs;
	          d.templateOutput = outs[0].outputUrl; d.templateOutputId = tpl.id;
	          d.activeDisplayId = null;
	          d.template = tpl.label; d.templateId = tpl.id;
	          d.tplPurpose = tpl.purpose; d.captionMode = tpl.captionMode || d.captionMode;
	          d.previewUrl = null;
	          var failed = pairs.length - outs.length;
	          toast(failed > 0
	            ? (tpl.label + ' · ' + outs.length + '개 적용 (' + failed + '개는 원본 유지)')
	            : (tpl.label + ' 적용 완료 · 결과물 ' + outs.length + '개'));
	        } else { toast('이 템플릿은 아직 적용하지 못했어요'); }
	        setScreen(_tplReturnScreen());
	      });
	      return;
	    }
	    // 비전후(시술자랑/후기/이벤트/스토리 등) — 단일 결과물.
	    d.templateBusy = tpl.key; setScreen(_tplReturnScreen());
	    window.WorkspaceAdapter.applyWorkspaceTemplate({
	      template: tpl, photos: editablePhotos(), service: d.service,
	      customerName: d.customerName, caption: d.caption,
	    }).then(function (r) {
	      d.templateBusy = null;
	      if (r && r.ok && r.dataUrl) {
	        // [이슈2] 합성 결과물은 전용 필드에만 보관(원본 비오염).
	        d.templateOutput = r.dataUrl; d.templateOutputId = tpl.id;
	        d.templateOutputs = [{ pairId: 'pair-0', templateId: tpl.id, beforePhotoId: null, afterPhotoId: null, outputUrl: r.dataUrl, pairLabel: '결과물' }];
	        d.activeDisplayId = null;
	        d.template = tpl.label; d.templateId = tpl.id;
	        d.tplPurpose = tpl.purpose; d.captionMode = tpl.captionMode || d.captionMode;
	        d.previewUrl = null; toast(tpl.label + ' 템플릿 적용 완료');
	      } else { toast((r && r.toast) || '이 템플릿은 아직 적용하지 못했어요'); }
	      setScreen(_tplReturnScreen());
	    });
	  }
	  // [v534] 짝별 템플릿 텍스트 레이어 수정 — 편집 시트 오픈 → onApply 로 해당 Pair 결과/slotValues 만 갱신.
  function _openTplEdit(pairId) {
    if (!(window.WorkspaceTplEdit && window.WorkspaceTplEdit.open)) { toast('템플릿 수정 모듈을 불러오지 못했어요'); return; }
    var outs = d.templateOutputs || [];
    var idx = -1; for (var i = 0; i < outs.length; i++) { if (outs[i].pairId === pairId) { idx = i; break; } }
    if (idx < 0) { toast('수정할 결과물을 찾지 못했어요'); return; }
    var o = outs[idx];
    var _photoUrl = function (pid) { var p = (d.photos || []).filter(function (x) { return String(x.id) === String(pid); })[0]; return p ? (p.editedDataUrl || p.dataUrl) : null; };
    window.WorkspaceTplEdit.open({
      templateId: o.templateId,
      pairLabel: 'Pair ' + (idx + 1),
      slotValues: o.slotValues || null,
      beforeUrl: _photoUrl(o.beforePhotoId),
      afterUrl: _photoUrl(o.afterPhotoId),
      onApply: function (res) {
        outs[idx].slotValues = res.slotValues;          // [v534] Pair별 slotValues 저장(다른 짝 비영향)
        if (res.outputUrl) outs[idx].outputUrl = res.outputUrl;
        d.templateOutputs = outs;
        d.templateOutput = outs[0] && outs[0].outputUrl;
        d.previewUrl = null;
        _renderTplSection();
        toast('Pair ' + (idx + 1) + ' 템플릿을 수정했어요');
      },
    });
  }
  // [이슈11] 템플릿 해제 — 적용 결과물만 비우고 원본 사진 리스트는 그대로 복구.
	  //   원본(d.photos)은 애초에 손대지 않았으므로(이슈2) 결과물 필드만 비우면 원본 상태로 돌아간다.
	  function releaseTemplate() {
	    if (!d.templateId && !d.templateOutput) { toast('적용된 템플릿이 없어요'); return; }
	    d.templateOutput = null; d.templateOutputId = null;
	    d.templateOutputs = []; d.activeDisplayId = null;   // [다중pair] 결과물 배열도 비움 → 원본 복구
	    d.template = null; d.templateId = null;
	    d.tplTargetPair = null;   // [v532] 짝별 타깃도 초기화
	    d.previewUrl = null;
	    _renderTplSection();
	    toast('템플릿을 해제했어요 — 원본 사진으로 돌아갔어요');
	  }

	  function bakeEdit() {
	    var photo = curEditPhoto();
	    var nonzero = photo && (_hasValues(d.adjust) || _hasValues(d.beauty));
	    if (!photo || !nonzero) return Promise.resolve();
	    var hasBg = !!(photo.bgSpec && photo.fgCutout);
	    var src = hasBg ? photo.fgCutout : (photo.editedDataUrl || photo.dataUrl);   // bg면 인물 누끼에만 보정
	    if (window.WorkspaceAdapter && window.WorkspaceAdapter.applyWorkspaceCorrections) {
	      return window.WorkspaceAdapter.applyWorkspaceCorrections({ src: src, adjust: d.adjust, beauty: d.beauty, manualMasks: _manualMasksForCurrent(), maskKey: (photo && (photo._uid || (photo._uid = 'm' + Math.random().toString(36).slice(2, 9)))) }).then(function (r) {
	        if (!(r && r.ok && r.dataUrl)) return _bakeCss(photo, src);
	        photo.adjustments = clone(d.adjust); photo.beautyAdjustments = clone(d.beauty); d.adjust = newAdjust(); d.beauty = newBeauty(); d.previewUrl = null;
	        // [v561] 굽고 나면 수동 마스크 효과는 픽셀에 반영됨 — 중복 적용 방지 위해 해당 사진의 칠한 영역 비움.
	        if (photo._uid && d._paintCv) { delete d._paintCv[photo._uid]; } d.maskPaint = false;
	        if (hasBg) { photo.fgCutout = r.dataUrl; return _compositeBg(photo.bgSpec, r.dataUrl).then(function (comp) { photo.editedDataUrl = comp; }); }
	        photo.editedDataUrl = r.dataUrl;
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

	  // [이슈1] 전후 페어링 산출 — 선택순(selSeq)으로 전(before)·후(after)를 1:1 zip.
	  //   전 N + 후 M → min(N,M)쌍. 남는 전 = "후 사진 부족", 남는 후 = "전 사진 부족".
	  //   어댑터 _pickPhoto(첫 전+첫 후) 와 동일 순서 → 화면에 보이는 짝과 실제 합성 짝이 일치.
	  function _computePairs() {
	    var sel = _selectedOrdered();
	    var befores = sel.filter(function (p) { return p.role === 'before'; });
	    var afters  = sel.filter(function (p) { return p.role === 'after'; });
	    var n = Math.min(befores.length, afters.length), pairs = [];
	    for (var i = 0; i < n; i++) pairs.push({ before: befores[i], after: afters[i] });
	    return { pairs: pairs, leftBefore: befores.slice(n), leftAfter: afters.slice(n) };
	  }

	  // [다중pair] slot → templateOutputs 배열 hydrate. 구 슬롯(단일 templateOutput) 호환:
	  //   templateOutputs 있으면 그대로(얕은 복제), 없고 templateOutput만 있으면 1개짜리로 변환.
	  function _hydrateOutputs(slot, wc) {
	    if (!slot) return [];
	    if (slot.templateOutputs && slot.templateOutputs.length) {
	      return slot.templateOutputs.map(function (o) { return Object.assign({}, o); });
	    }
	    if (slot.templateOutput) {
	      return [{ pairId: 'pair-0', templateId: (wc && wc.templateId) || null, beforePhotoId: null, afterPhotoId: null, outputUrl: slot.templateOutput, pairLabel: 'Pair 1' }];
	    }
	    return [];
	  }

	  // [다중pair] 캡션 상단 캐러셀 표시 아이템 — 템플릿 결과물(들) + (전후) 미적용 원본(남은 전/후·기본).
	  function _unpairedPhotos() {
	    var used = {};
	    (d.templateOutputs || []).forEach(function (o) { if (o.beforePhotoId) used[o.beforePhotoId] = 1; if (o.afterPhotoId) used[o.afterPhotoId] = 1; });
	    return _selectedOrdered().filter(function (p) { return !used[p.id]; });
	  }
	  function _photoById(id) { return (d.photos || []).filter(function (p) { return String(p.id) === String(id); })[0] || null; }
	  // [v564·공통 preview model] 모든 화면(편집 결과·게시글·미리보기·인스타)이 쓰는 단일 표시 목록.
	  //   · 템플릿 적용 결과 = 1장으로 collapse (전후 pair → 결과 1장)
	  //   · 펼침 토글(d.expandedOutputs)된 pair = 원본 전/후 2장으로 expand
	  //   · 템플릿 미적용 = 편집 사진 개별 표시 → 어느 화면이든 동일 순서로 스와이프
	  //   원본(d.photos)은 절대 변형하지 않고, 렌더용 리스트에서만 1장/2장 표현을 바꾼다.
	  function _displayItems() {
	    var outs = d.templateOutputs || [];
	    if (outs.length) {
	      var items = [];
	      outs.forEach(function (o) {
	        if (d.expandedOutputs && d.expandedOutputs[o.pairId]) {
	          // 펼침 — 원본 전/후 2장으로
	          var bp = _photoById(o.beforePhotoId), ap = _photoById(o.afterPhotoId);
	          if (bp) items.push({ kind: 'photo', id: 'exp:' + o.pairId + ':b', url: photoUrl(bp), label: '전', ofPair: o.pairId });
	          if (ap) items.push({ kind: 'photo', id: 'exp:' + o.pairId + ':a', url: photoUrl(ap), label: '후', ofPair: o.pairId });
	          if (!bp && !ap) items.push({ kind: 'output', id: o.pairId, url: o.outputUrl, label: o.pairLabel, expandable: false });
	        } else {
	          items.push({ kind: 'output', id: o.pairId, url: o.outputUrl, label: o.pairLabel, expandable: !!(o.beforePhotoId || o.afterPhotoId) });
	        }
	      });
	      if (d.tplPurpose === 'before_after') {
	        _unpairedPhotos().forEach(function (p) {
	          items.push({ kind: 'photo', id: p.id, url: photoUrl(p), label: p.role === 'before' ? '남은 전' : (p.role === 'after' ? '남은 후' : '기본 사진') });
	        });
	      }
	      return items;
	    }
	    // 템플릿 미적용 → 편집 사진 개별 표시(공통 carousel 소스)
	    return editablePhotos().map(function (p, i) {
	      return { kind: 'photo', id: p.id, url: dispUrl(p), label: _editPhotoLabel(p, i) };   // [v589] 결과=적용 미리보기
	    });
	  }
	  // [v564·필수3] 전후 pair 결과 ↔ 원본 전/후 2장 토글. 원본은 보존, 표시 리스트만 펼침/접힘.
	  function _togglePairExpand(pairId, expand) {
	    if (!d.expandedOutputs) d.expandedOutputs = {};
	    if (expand) d.expandedOutputs[pairId] = true; else delete d.expandedOutputs[pairId];
	    d.activeDisplayId = null;
	    if (cur === 'caption' && typeof syncCaptionFromDom === 'function') { try { syncCaptionFromDom(); } catch (_e) { void _e; } }
	    setScreen(cur, { push: false });
	  }
	  function _capCarouselHtml() {
	    var items = _displayItems();
	    if (items.length < 2) return '';   // 결과물/표시 아이템 1개 이하 → 캐러셀 없이 기존 단일 프리뷰
	    var active = d.activeDisplayId || items[0].id;
	    var n = items.length;
	    // [v531] scroll-snap 가로 캐러셀 — 손가락 스와이프로 넘김(슬라이드를 한 줄로 깔고 overflow 스크롤).
	    var slides = items.map(function (it, i) {
	      // [v564·필수3] 템플릿 결과 카드는 탭하면 원본 전/후 2장으로 펼침, 펼친 사진은 탭하면 결과로 접힘.
	      var toggleAttr = it.kind === 'output' && it.expandable ? ' data-fl-tplexpand="' + esc(it.id) + '"'
	        : (it.ofPair ? ' data-fl-tplcollapse="' + esc(it.ofPair) + '"' : '');
	      var toggleHint = it.kind === 'output' && it.expandable ? '<span class="cap-car__toggle">탭 → 전·후 펼치기</span>'
	        : (it.ofPair ? '<span class="cap-car__toggle">탭 → 결과로 접기</span>' : '');
	      return '<div class="cap-car__slide" data-fl-carslide="' + esc(it.id) + '"' + toggleAttr + '>' +
	        '<span class="cap-car__badge">' + (i + 1) + ' / ' + n + ' · ' + esc(it.label) + '</span>' + toggleHint +
	        '<div class="cap-car__img" style="background-image:url(' + esc(it.url) + ')"></div></div>';
	    }).join('');
	    var dots = items.map(function (it) { return '<button type="button" class="cap-car__dot' + (it.id === active ? ' on' : '') + '" data-fl-cardot="' + esc(it.id) + '" aria-label="이 결과물 보기"></button>'; }).join('');
	    var outN = (d.templateOutputs || []).length;
	    return '<div class="cap-car" data-fl-carousel>' +
	      '<div class="cap-car__track" data-fl-cartrack>' + slides + '</div>' +
	      '<div class="cap-car__dots">' + dots + '</div>' +
	      (outN >= 2 ? '<p class="cap-car__hint">' + outN + '장의 전후 결과물로 게시글을 만들어요</p>' : '') +
	    '</div>';
	  }
	  function _carItems() { return _displayItems(); }
	  function _carIndexOf(id) { var its = _carItems(); for (var i = 0; i < its.length; i++) { if (its[i].id === id) return i; } return 0; }
	  function _carPaintDots(id) {
	    var root = el && el.querySelector('[data-fl-carousel]'); if (!root) return;
	    root.querySelectorAll('[data-fl-cardot]').forEach(function (dt) { dt.classList.toggle('on', dt.getAttribute('data-fl-cardot') === id); });
	    // [v541] 결과 캐러셀 active Pair 라벨 동기화(스크롤/도트/필 전환 시). 전체 재렌더 없음.
	    var lbl = el.querySelector('[data-fl-tpl-activelabel]');
	    if (lbl) { var its = _carItems(); for (var i = 0; i < its.length; i++) { if (its[i].id === id) { lbl.textContent = _carItemLabel(its[i], i); break; } } }
	  }
	  // [v531] 스크롤 위치 → active 결과물/dot 동기화(passive 스크롤 + rAF 스로틀, 전체 재렌더 없음).
	  function _carSyncActive() {
	    var track = el && el.querySelector('[data-fl-cartrack]'); if (!track) return;
	    if (track.__prog && Date.now() < track.__prog) return;   // dot 클릭 등 프로그램적 스크롤 중엔 sync 억제(dot 깜빡임 방지)
	    var its = _carItems(); if (!its.length) return;
	    var idx = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
	    idx = Math.max(0, Math.min(its.length - 1, idx));
	    var id = its[idx].id;
	    if (id === d.activeDisplayId) return;
	    d.activeDisplayId = id; _carPaintDots(id);
	  }
	  // dot 클릭 → 해당 슬라이드로 부드럽게 스크롤(스크롤 이벤트가 active 동기화).
	  function _carSet(id) {
	    d.activeDisplayId = id;
	    var track = el && el.querySelector('[data-fl-cartrack]'); if (!track) { _carPaintDots(id); return; }
	    track.__prog = Date.now() + 700;   // 스크롤 정착까지 scroll-sync 억제 → 선택한 dot 유지
	    var left = _carIndexOf(id) * track.clientWidth;
	    if (track.scrollTo) track.scrollTo({ left: left, behavior: 'smooth' }); else track.scrollLeft = left;
	    _carPaintDots(id);
	  }
	  var _carRaf = 0;
	  function _mountCarousel() {
	    var track = el && el.querySelector('[data-fl-cartrack]'); if (!track || track._wsBound) return;
	    track._wsBound = true;
	    // 재렌더 시 현재 active 위치로 점프(스크롤 보존)
	    track.scrollLeft = _carIndexOf(d.activeDisplayId || (_carItems()[0] && _carItems()[0].id)) * track.clientWidth;
	    track.addEventListener('scroll', function () {
	      if (_carRaf) return;
	      var raf = window.requestAnimationFrame || function (f) { return setTimeout(f, 32); };
	      _carRaf = raf(function () { _carRaf = 0; _carSyncActive(); });
	    }, { passive: true });
	  }
	  function _pairThumb(p, tag) {
	    return '<span class="up-pair__thumb" style="background-image:url(' + esc(p.dataUrl) + ')"><em>' + tag + '</em></span>';
	  }
	  // [이슈1] 전후가 어떻게 묶이는지 사용자에게 명확히: Pair 1(전+후) · 남은 사진은 부족 안내.
	  function _pairPreviewHtml(cnt) {
	    // [Phase A-1] 'Pair N' 미리보기는 전후 템플릿 합성 단계 전용 → 심플 플로우에선 미노출(타일 역할칩으로 충분).
	    if (SIMPLE_FLOW) return '';
	    if (!cnt.before && !cnt.after) return '';
	    var pp = _computePairs();
	    var rows = pp.pairs.map(function (pr, i) {
	      return '<div class="up-pair"><span class="up-pair__n">Pair ' + (i + 1) + '</span>' +
	        _pairThumb(pr.before, '전') + '<i class="up-pair__plus">+</i>' + _pairThumb(pr.after, '후') + '</div>';
	    }).join('');
	    var leftover = '';
	    pp.leftBefore.forEach(function (p) { leftover += '<div class="up-pair up-pair--left">' + _pairThumb(p, '전') + '<span class="up-pair__need">후 사진 1장이 더 필요해요</span></div>'; });
	    pp.leftAfter.forEach(function (p) { leftover += '<div class="up-pair up-pair--left">' + _pairThumb(p, '후') + '<span class="up-pair__need">전 사진 1장이 더 필요해요</span></div>'; });
	    var head = pp.pairs.length ? ('전후 ' + pp.pairs.length + '쌍 만들 수 있어요') : '전·후를 한 장씩 지정하면 짝이 만들어져요';
	    return '<div class="up-pairs"><div class="up-pairs__head">' + esc(head) + '</div>' + rows + leftover + '</div>';
	  }
	  // [#2/#5] 선택된 사진(선택순)만 대상으로 첫=전/둘째=후 자동 배치. 수동지정(roleManual)은 보존.
	  function reassignRoles() {
	    var sel = _selectedOrdered();
	    sel.forEach(function (p, i) {
	      if (p.roleManual) return;   // 사용자가 직접 지정한 사진은 자동배치에서 보존
	      if (i === 0 && sel.length >= 2) p.role = 'before';   // 2장 이상이면 첫=전/둘째=후 자동(나머지는 중립)
	      else if (i === 1) p.role = 'after';
	      else p.role = 'hero';
	    });
	  }
	  // [#5] 사진별 전/후 직접 지정. 같은 값 다시 누르면 해제(자동 배치로 복귀).
	  function _setRole(i, role) {
	    var p = d.photos[i]; if (!p) return;
	    if (p.role === role && p.roleManual) { p.roleManual = false; reassignRoles(); }
	    else { p.role = role; p.roleManual = true; }
	    // [v531] 역할이 바뀌면 이미 적용된 전후 결과물은 무효 — 다시 적용해야 함(합성 재실행은 적용 버튼에서만).
	    if (d.templateOutputs && d.templateOutputs.length) {
	      d.templateOutputs = []; d.templateOutput = null; d.templateOutputId = null; d.templateId = null; d.template = null; d.activeDisplayId = null;
	      toast('역할이 바뀌어 템플릿을 다시 적용해야 해요');
	    }
	    _repaintUpload();   // [v531 렉] 전체 재렌더 금지 — in-place 갱신
	  }
	  // [#2] 타일 탭 → 선택/해제 토글. 선택 시 맨 끝 순서(selSeq)로, 해제 시 배지 제거·수동역할 해제.
	  //   남은 선택 사진은 reassignRoles+랭크 재계산으로 1부터 빈번호 없이 다시 매겨진다.
	  function _toggleSelect(i) {
	    var p = d.photos[i]; if (!p) return;
	    if (p.selected === false) { p.selected = true; p.selSeq = ++d._selSeq; }
	    else { p.selected = false; p.roleManual = false; }
	    reassignRoles(); _repaintUpload();   // [v531 렉] 선택 토글도 in-place 갱신
	  }
	  function addFiles(files, showToast, toEdit) {
	    files = Array.from(files || []).slice(0, 10);
	    if (!files.length) return Promise.resolve([]);
	    return Promise.all(files.map(fileToDataUrl)).then(function (urls) {
	      urls.forEach(function (u) { d.photos.push({ id: uid(), dataUrl: u, role: 'hero', selected: true, selSeq: ++d._selSeq }); });
	      // [QA hotfix] 다중 업로드 시 전후/홍보컷 자동 확정 금지 — 사용자가 '전/후 토글' 또는
	      //   카테고리/템플릿으로 직접 용도를 고르게 한다. (전/후 카테고리로 진입한 경우만 baMode 유지)
	      reassignRoles();
	      // [v564·필수1] 홈 '시작하기'→파일선택→바로 편집. 중간 업로드 화면을 건너뛴다.
	      // [v575·필수1] 직행 진입은 편집을 '베이스 화면'으로 — push:false 로 navStack 을 비워 둔다.
	      //   기존엔 기본 push 로 cur('upload')가 navStack 에 쌓여, 뒤로가기 시 안 거쳐온 '업로드 화면'이 떴다.
	      //   이제 navStack 이 비어 back → _systemBack → close → 작업실 홈으로 바로 복귀(중간 업로드 화면 X).
	      // [v590·#1] 심플 플로우면 업로드 진입경로(홈 시작하기 포함) 불문하고 '캡션 생성'으로 직행.
      //   기존엔 toEdit(홈→편집) 우선이라 사진편집으로 새던 회귀. SIMPLE_FLOW 최우선.
      if (SIMPLE_FLOW && !d.textOnly && editablePhotos().length) { setScreen('caption', { push: false }); }
      else if (toEdit && editablePhotos().length) { d.editIdx = 0; setScreen('edit', { push: false }); }  // [v588·#1] 업로드 직후 바로 캡션
	      else { setScreen('upload'); }
	      if (showToast) toast(urls.length + '장 추가됨');
	      return urls;
	    });
	  }
	  function syncCaptionFromDom() {
	    // [v584] 캡션은 카드 안 contenteditable(igcap)이 원본. (레거시 capbody 도 호환)
	    var ig = el.querySelector('[data-fl-igcap]');
	    if (ig && ig.isContentEditable) { d.caption = (ig.textContent || '').trim(); return; }
	    var b = el.querySelector('[data-fl-capbody]'); if (b && b.getAttribute('data-empty') !== '1') d.caption = (b.value != null ? b.value : b.textContent).trim();
	    if (ig) ig.textContent = d.caption;
	  }

  // 캡션 화면을 떠나거나 다음 단계로 갈 때 — 입력창 3종(시술명/본문/꼬리말)의 최신값을 한 번에 state 로 확정.
  //  입력값을 버튼 클릭 시점에만 저장하던 회귀를 막아, 위쪽 '이대로 작성' 없이 하단 CTA 만으로도 반영되게 한다.
  // [v531] 해시태그 문자열 → #태그 배열(중복 제거). 본문과 분리된 해시태그 편집칸 파싱.
  function _parseHashes(text) {
    var seen = Object.create(null), out = [];
    String(text || '').split(/[\s,]+/).forEach(function (t) {
      var tag = t.trim().replace(/^#+/, ''); if (!tag) return;
      var k = tag.toLowerCase(); if (seen[k]) return; seen[k] = 1; out.push('#' + tag);
    });
    return out;
  }
  function flushCaptionInputs() {
    syncServiceFromDom();
    if (!el) return;
    var ig = el.querySelector('[data-fl-igcap]');   // [v584] 카드 안 캡션 편집(원본)
    if (ig && ig.isContentEditable) { d.caption = (ig.textContent || '').trim(); }
    else { var b = el.querySelector('[data-fl-capbody]'); if (b && b.getAttribute('data-empty') !== '1') d.caption = (b.value != null ? b.value : b.textContent).trim(); }
    var f = el.querySelector('[data-fl-footer]'); if (f && typeof f.value === 'string') d.captionTemplate = f.value;
    // [v587] 해시태그 = 카드 안 contenteditable(.ig-hash-edit) → d.hashtags/selectedHashes(저장·미리보기·복사 반영).
    var h = el.querySelector('[data-fl-ighash]');
    if (h && h.isContentEditable) { var hs = _parseHashes(h.textContent); d.hashtags = hs; d.selectedHashes = hs.slice(); }
  }

  function back() {
    // [#1] 인앱 back = 시스템 back 과 100% 동일하게 history.back() 으로 통일.
    //  단계가 남았으면 popstate 리스너가 한 화면 복귀, 베이스면 _systemBack 이 닫는다.
    if (cur === 'caption') flushCaptionInputs();
    history.back();
  }
  function onCta() {
    var c = CTA[cur]; if (!c) return;
    if (cur === 'upload' && !d.textOnly) {
      if (!d.photos.length) { toast('사진을 먼저 추가해 주세요.'); return; }
      if (!editablePhotos().length) { toast('사진을 1장 이상 선택해 주세요.'); return; }
    }
    if (c.to === '__save') return save();
    if (cur === 'caption') {
      flushCaptionInputs();
      // [캡션 스킵 방지] 게시글 안 만든 채로 고객연결/미리보기로 못 넘어가게 — 시술명 있으면 바로 생성, 없으면 안내.
      if (!String(d.caption || '').trim()) {
        if (String(d.service || '').trim()) { doGenerate({}, '게시글을 만들었어요'); }
        else { toast('시술 내역/키워드를 입력하면 게시글을 만들어 드려요'); }
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
	    // [이슈2] 전후 템플릿 합성 결과물은 사진 배열과 분리된 전용 필드로 저장(원본 슬롯 비오염).
	    // [다중pair] 페어별 결과물 배열 저장 + 단일 templateOutput 미러(구 코드/홈 썸네일 하위호환).
	    slot.templateOutputs = (d.templateOutputs && d.templateOutputs.length) ? d.templateOutputs.slice() : [];
	    slot.templateOutput = d.templateOutput || (slot.templateOutputs[0] && slot.templateOutputs[0].outputUrl) || null;
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
  // [v547] 게시 완료 자동화/복귀 — 실 IG 업로드(publishInstagramV2)는 성공 시 이미 자동 published(아래 publish()).
  //   하지만 '이미지 저장→수동 게시' 흐름은 콜백이 없어, 저장 직후 확인 sheet 로 게시 완료를 표시·영속.
  function _askPublishedSheet() {
    if (!el) return;
    _closePublishSheet();
    var wrap = document.createElement('div');
    wrap.className = 'pub-ask'; wrap.setAttribute('data-fl-pubask', '');
    wrap.innerHTML =
      '<div class="pub-ask__bd" data-fl="pubnot"></div>' +
      '<div class="pub-ask__sheet" role="dialog" aria-label="게시 확인">' +
        '<div class="pub-ask__grip"></div>' +
        '<div class="pub-ask__t">인스타에 게시했나요?</div>' +
        '<div class="pub-ask__d">이미지를 저장했어요. 인스타에 올렸다면 게시 완료로 표시해 둘게요.</div>' +
        '<div class="pub-ask__btns">' +
          '<button type="button" class="pub-ask__not" data-fl="pubnot">아직이에요</button>' +
          '<button type="button" class="pub-ask__done" data-fl="pubdone">게시 완료로 표시</button>' +
        '</div></div>';
    el.appendChild(wrap);
    var raf = window.requestAnimationFrame || function (f) { return setTimeout(f, 16); };
    raf(function () { wrap.classList.add('open'); });
  }
  function _closePublishSheet() { var w = el && el.querySelector('[data-fl-pubask]'); if (w && w.parentNode) w.parentNode.removeChild(w); }
  function _markPublishedNow() {
    d.publish = d.publish || {}; d.publish.status = 'published'; d.publish.publishedAt = Date.now();
    if (window.WorkspaceAdapter && window.WorkspaceAdapter.saveItem) { try { window.WorkspaceAdapter.saveItem(buildSlot()); } catch (_e) { void _e; } }
    _closePublishSheet();
    toast('게시물이 저장되었습니다');
    // [v548] 게시 완료 시 작업이 끝났음을 명확히 — 플로우 닫고 작업실 홈으로(카드 게시완료 badge 갱신).
    if (window.WorkspaceV2 && window.WorkspaceV2.refresh) window.WorkspaceV2.refresh();
    close();
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
	    d._publishing = true; setScreen('caption');
    var slot = buildSlot();
    _pubShow();
    Promise.resolve(window.WorkspaceAdapter.saveItem ? window.WorkspaceAdapter.saveItem(slot) : { ok: true }).then(function (sr) {
	      if (!sr || !sr.ok) { d._publishing = false; _pubHide(); toast('저장에 실패해 게시를 중단했어요'); setScreen('caption'); return; }
      d.slot = slot;
      if (!window.WorkspaceAdapter.publishInstagramV2) {
	        d._publishing = false; _pubHide(); _markPrepared(); setScreen('caption'); toast('게시 준비 완료 — 업로드 기능을 불러오지 못했어요'); return;
      }
      var cap = (d.caption || '') + (d.hashtags.length ? '\n\n' + d.hashtags.join(' ') : '');
      window.WorkspaceAdapter.publishInstagramV2({ slotId: slot.id, imageUrl: outputUrl(), caption: cap }).then(function (r) {
        r = r || {};
        if (r.ok) {
          d.publish = d.publish || {}; d.publish.status = 'published'; d.publish.publishedAt = Date.now();
          // [v542] 게시 완료 상태를 저장소에 반영(이전엔 게시 전 slot 만 저장 → 새로고침 시 badge 사라짐).
          if (window.WorkspaceAdapter.saveItem) { try { window.WorkspaceAdapter.saveItem(buildSlot()); } catch (_e) { void _e; } }
          _pubFinish(function () {
            d._publishing = false;
            toast('게시물이 저장되었습니다 · 인스타그램에 올렸어요');
            if (window.WorkspaceV2 && window.WorkspaceV2.refresh) window.WorkspaceV2.refresh();
            close();   // [v548] 게시 완료 → 작업실 홈으로(끝났음을 명확히)
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
        setScreen('caption');
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
    _bindPop();
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
      photos: slot && slot.photos ? slot.photos.map(function (p, i) { return { id: p.id || uid(), dataUrl: p.dataUrl, editedDataUrl: p.editedDataUrl, role: p.role || 'hero', cropMeta: p.cropMeta || null, selected: true, selSeq: i + 1 }; }) : [],
      _selSeq: (slot && slot.photos ? slot.photos.length : 0),
      baMode: purpose === 'before_after',
	      template: (wc && wc.templateLabel) || null, templateId: (wc && wc.templateId) || null,
	      templateOutput: (slot && slot.templateOutput) || null, templateOutputId: (wc && wc.templateId) || null,
	      templateOutputs: _hydrateOutputs(slot, wc), activeDisplayId: null,
	      tplCat: ctx.tplLabel || (wc && wc.type === 'before_after' ? '전후' : null),
	      tplPurpose: purpose, captionMode: capMode, defaultRole: ctx.role || 'hero',
      textOnly: !!(opts.textOnly),
      service: slot && slot.service ? slot.service : '', caption: slot ? (slot.caption || '') : '', hashtags: slot && slot.hashtags ? String(slot.hashtags).split(/\s+/).filter(Boolean) : [], selectedHashes: [],
      customerId: slot ? (slot.customer_id || null) : null, customerName: slot ? (slot.customer_name || '') : '', customerVc: 0, custQuery: '',
      capLen: cm.length_tier || 'medium', capTone: cm.tone_override || 'normal', logId: cm.log_id || null,
      publish: (slot && slot.publish) ? Object.assign({}, slot.publish) : { status: 'draft', instagramPreparedAt: null, publishedAt: null },
      recent: [], recentLoaded: false, capLoading: false, capSeg: 'rec',
	      editTab: 'skin', control: null, basicTool: 'brightness', precTool: null, editIdx: null, bgOpen: false, advOpen: true, tplOpen: true, adjust: newAdjust(), beauty: newBeauty(), undo: [], redo: [], originalPreview: false, previewUrl: null, bgAction: null, bgColor: null, bgBusy: false, bgFail: false,
      maskPaint: false, maskBrush: 26, maskErase: false, _paintCv: {},   // [v561] 직접 칠하기(수동 마스크)
	      captionAxes: null, captionTemplate: '',
	    };
	    if (d.photos.length && !hadRoles) reassignRoles();
    el.classList.add('is-open');
    navStack = []; _histDepth = 0;   // 새 세션 — 방문 히스토리 초기화
    // 시스템 back(안드로이드 하드웨어/스와이프, popstate)을 전역 sheet-back 레지스트리에 편입.
    //  미등록 시 안드로이드 back 이 오버레이를 안 닫고 홈 탭으로 점프해 오버레이가 떠버린 채 남는다.
    if (window._registerSheet) window._registerSheet('wsv2flow', _systemBack);
    if (window._markSheetOpen) window._markSheetOpen('wsv2flow');
    // textOnly → 바로 게시글 화면으로
    var startScreen = opts.startScreen && SCREENS.indexOf(opts.startScreen) >= 0 ? opts.startScreen : 'upload';
	    if (d.textOnly && startScreen === 'upload') startScreen = 'caption';
	    // [v540] 내 콘텐츠 편집 딥링크 — 버튼 의도(focus)에 맞춰 진입 탭/섹션 상태 미리 세팅(기존 콘텐츠 유지).
	    d._focusIntent = (startScreen === 'edit' && opts.focus) ? opts.focus : null;
	    if (d._focusIntent === 'background') { d.bgOpen = true; d.basicTool = 'background'; }
	    else if (d._focusIntent === 'crop') { d.editTab = 'tools'; d.advOpen = true; }
	    else if (d._focusIntent === 'template') { d.tplOpen = true; }
	    // [v564·필수1] 홈에서 파일과 함께 edit 로 바로 진입 시, 사진 로드 전 '빈 편집화면'이 깜빡이지
	    //   않도록 setScreen 을 addFiles 완료까지 미룬다(업로드 화면을 거치지 않음).
	    var _deferEdit = (startScreen === 'edit' && incomingFiles.length && !d.photos.length);
	    if (!_deferEdit) setScreen(startScreen, { push: false });
	    if (d._focusIntent) { var _rafF = window.requestAnimationFrame || function (f) { return setTimeout(f, 16); }; _rafF(function () { _applyFocusScroll(); }); }
	    if (incomingFiles.length) addFiles(incomingFiles, true, startScreen === 'edit');
	    // [구조 통합] 잇비 채팅 사진(dataURL)을 작업실로 바로 투입 — File 변환 없이 직접.
	    if (opts.photoUrls && opts.photoUrls.length) addPhotoUrls(opts.photoUrls, true);
	  }
	  // dataURL 배열을 사진으로 추가(잇비 채팅 사진 핸드오프). addFiles 와 동일 규약, File 변환만 생략.
	  function addPhotoUrls(urls, showToast) {
	    urls = (urls || []).filter(function (u) { return typeof u === 'string' && u; }).slice(0, 10);
	    if (!urls.length || !d) return 0;
	    urls.forEach(function (u) { d.photos.push({ id: uid(), dataUrl: u, role: 'hero', selected: true, selSeq: ++d._selSeq }); });
	    reassignRoles();
    // [v588·#1] 심플 플로우 — 사진 들어오면 업로드 화면 건너뛰고 바로 캡션 생성.
    if (cur === 'upload') { setScreen((SIMPLE_FLOW && !d.textOnly && editablePhotos().length) ? 'caption' : 'upload', { push: false }); }
	    if (showToast) toast(urls.length + '장 추가됨');
	    return urls.length;
	  }
  // 전역 sheet 레지스트리 진입점 — 베이스(#wsv2flow) 가 history 에서 빠질 때 호출됨.
  //  단계 복귀는 _bindPop 의 popstate 리스너가 담당하므로, 여기선 단계 남으면 복귀/없으면 닫기만.
  function _systemBack() {
    if (!el || !el.classList.contains('is-open')) return;
    if (el.querySelector('[data-fl-tplpreview]')) { _closeTplPreview(); return; }   // [v541] 미리보기 시트 먼저 닫기
    if (el.querySelector('[data-fl-pubask]')) { _closePublishSheet(); return; }   // [v547] 게시 확인 sheet 먼저 닫기
    if (!_navBack()) close();   // [v531] navStack 비면 close → 작업실 홈
  }
  function close() {
    if (el) el.classList.remove('is-open');
    var leftover = _histDepth;
    navStack = [];
    _histDepth = 0;
    // [#1] 저장/게시 등으로 흐름 도중 프로그램적으로 닫을 때 — 쌓아둔 단계 엔트리를 되감아 stale 방지.
    //  되감기 중 발생하는 popstate 는 _closingHist 로 무시. 이후 _markSheetClosed 가 #wsv2flow hash 제거.
    if (leftover > 0) {
      _closingHist = true;
      try { history.go(-leftover); } catch (_e) { void _e; }
      setTimeout(function () { _closingHist = false; if (window._markSheetClosed) window._markSheetClosed('wsv2flow'); }, 60);
      return;
    }
    if (window._markSheetClosed) window._markSheetClosed('wsv2flow');
  }

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
  // 이름으로 고객 연결 — 전역 Customer.search 우선, 없으면 최근 고객 매칭. 못 찾으면 connect 화면 안내.
  function _connectByName(name) {
    name = String(name || '').trim();
    if (!name) { setScreen('connect'); return { ok: true, matched: false }; }
    d.custQuery = name;
    var hit = null;
    try {
      if (window.Customer && typeof window.Customer.search === 'function') {
        var m = window.Customer.search(name) || [];
        if (m[0]) hit = { id: m[0].id, n: m[0].name, vc: m[0].visit_count || m[0].vc || 0 };
      }
    } catch (_e) { hit = null; }
    if (!hit) hit = (d.recent || []).filter(function (c) { return c && c.n && (c.n === name || c.n.indexOf(name) >= 0 || name.indexOf(c.n) >= 0); })[0] || null;
    if (hit) { d.customerId = hit.id; d.customerName = hit.n; d.customerVc = hit.vc || 0; setScreen('connect'); toast(hit.n + ' 고객과 연결했어요'); return { ok: true, matched: true }; }
    setScreen('connect'); toast('"' + name + '" 고객을 못 찾았어요 — 목록에서 골라주세요'); return { ok: true, matched: false };
  }
  function command(cmd) {
    cmd = cmd || {};
    switch (cmd.type) {
      case 'open':
        open({ cat: cmd.cat || null, startScreen: cmd.screen || 'upload', textOnly: !!cmd.textOnly, files: cmd.files || null, photoUrls: cmd.photoUrls || null });
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
        if (cmd.axes) d.captionAxes = cmd.axes;   // [구조 통합] 상황(시술완성/신규 등)을 말로 받아 시나리오 칩 없이 생성
        // 항상 재렌더 → 입력창이 최신 service 를 반영(doGenerate 가 DOM 에서 다시 읽으므로 필수).
        setScreen('caption');
        doGenerate(cmd.extra || {}, cmd.label || null); return { ok: true };
      case 'customer':   // [구조 통합] "OOO 손님이랑 연결" 자연어로 고객 연결
        if (!_flowReady()) return { ok: false, reason: 'not_open' };
        if (cur !== 'connect') setScreen('connect');
        return _connectByName(cmd.name);
      case 'capvar':   // 다시/더길게/짧게/인스타 톤/초기화
        if (!_flowReady() || cur !== 'caption') return { ok: false, reason: 'not_caption' };
        if (cmd.variant === 'reset') { d.caption = ''; d.hashtags = []; d.selectedHashes = []; d.capLen = 'medium'; d.capTone = 'normal'; d.regenSeq = 0; d.logId = null; setScreen('caption'); return { ok: true }; }
        // [v532] insta → 백엔드 enum 'ornate'(기존 'instagram' 은 422 → 생성 실패). 모든 변형에 _regen 부여(동일 캡션 반복 방지).
        { var ex = { regen: { _regen: true }, long: { length_tier: 'long', _regen: true }, short: { length_tier: 'short', _regen: true }, insta: { tone_override: 'ornate', _regen: true } }[cmd.variant] || { _regen: true };
          doGenerate(ex, cmd.label || null); return { ok: true }; }
      case 'save':
        if (!_flowReady()) return { ok: false, reason: 'not_open' };
        save(); return { ok: true };
      case 'publish':
        if (!_flowReady()) return { ok: false, reason: 'not_open' };
        setScreen('caption'); publish(); return { ok: true };
      default:
        return { ok: false, reason: 'unknown' };
    }
  }
  function isOpen() { return _flowReady(); }

  window.WorkspaceFlow = { open: open, close: close, command: command, isOpen: isOpen };
})();
