/* 잇비 자연어 → 작업실(V2 WorkspaceFlow) 명령 브릿지 — [구조 통합 Phase 1]
   원칙:
   - WorkspaceFlow.command() 공개 API 만 호출(작업실 내부 로직/저장 스키마 미변경).
   - 작업실 플로우가 "열려 있을 때만" 동작 → 일반 채팅/다른 의도 가로채기 0.
   - 매칭 안 되면 false 반환 → 잇비 기존 파이프라인(LLM 포함)으로 그대로 흘려보냄.
   확장: COMMANDS 에 {test, cmd, label} 추가하면 새 자연어 명령이 늘어남. */
(function () {
  'use strict';

  // cmd 는 객체 또는 (text)=>객체. WorkspaceFlow.command(cmd) 스키마를 그대로 사용.
  var COMMANDS = [
    // ── 고객 연결(이름 추출) ──
    { test: /(고객|손님|님).*(연결|연동|붙여)|(연결|붙여)\s*(해|줘)/, cmd: function (q) {
      var m = q.match(/([가-힣A-Za-z]{2,12})\s*(손님|고객|님)?\s*(이?랑|와|과|에게|을|를|한테)?\s*(연결|연동|붙여)/);
      var name = m && m[1] ? m[1].replace(/(손님|고객|님)$/, '').trim() : '';
      if (/^(고객|손님|연결|연동)$/.test(name)) name = '';
      return name ? { type: 'customer', name: name } : { type: 'goto', screen: 'connect' };
    }, label: null },
    { test: /(미리보기|인스타.*미리|preview)/, cmd: { type: 'goto', screen: 'preview' }, label: '미리보기로 이동했어요' },
    { test: /(인스타).*(올려|게시|발행|업로드)|(올려|게시|발행)\s*(줘|해)/, cmd: { type: 'publish' }, label: '인스타에 올릴게요' },
    { test: /작업실.*(저장)|(저장)\s*(해|할래|해줘)$/, cmd: { type: 'save' }, label: '작업실에 저장했어요' },

    // ── 배경/누끼 ──
    { test: /(누끼|배경)\s*(제거|지워|따|빼|없애)|누끼/, cmd: { type: 'bg', action: 'removeBg' }, label: '배경(누끼)을 제거할게요' },
    { test: /(배경)\s*(흐림|흐리게|블러)/, cmd: { type: 'bg', action: 'blur' }, label: '배경을 흐리게 할게요' },

    // ── 템플릿 ──
    { test: /(전후|비포\s*애프터|before\s*after)\s*(템플릿|카드|만들|적용)?/, cmd: { type: 'template', key: 'ba' }, label: '전후 비교 템플릿을 적용할게요' },
    { test: /(시술\s*자랑|완성컷|자랑)\s*(템플릿|카드|만들|적용)?/, cmd: { type: 'template', key: 'showcase' }, label: '시술 자랑 템플릿을 적용할게요' },
    { test: /(후기|리뷰)\s*(템플릿|카드|만들|적용)?/, cmd: { type: 'template', key: 'review' }, label: '고객 후기 템플릿을 적용할게요' },
    { test: /(이벤트|할인|혜택)\s*(템플릿|카드|안내|만들|적용)?/, cmd: { type: 'template', key: 'event' }, label: '이벤트 템플릿을 적용할게요' },
    { test: /(스토리)\s*(템플릿|홍보|만들|적용)?/, cmd: { type: 'template', key: 'story' }, label: '스토리 템플릿을 적용할게요' },
    { test: /(피드)\s*(템플릿|안내|만들|적용)?/, cmd: { type: 'template', key: 'feed' }, label: '인스타 피드 템플릿을 적용할게요' },

    // ── 정밀(부위) 보정 ──
    { test: /(피부|잡티|붉은기|피부톤)\s*(보정|정리|매끈|살려|좋게)?/, cmd: { type: 'adjust', beauty: { skin: 35, blemish: 40, textureSmooth: 28 } }, label: '피부를 자연스럽게 정리했어요' },
    { test: /(머리|헤어|모발|머릿결).*(볼륨|풍성|윤기|결|살려|보정)?/, cmd: { type: 'adjust', beauty: { hairDetail: 38, hairVolume: 34, hairShine: 40 } }, label: '머릿결과 볼륨을 살렸어요' },
    { test: /(눈|눈썹|눈가|속눈썹).*(또렷|선명|맑게|살려|보정)?/, cmd: { type: 'adjust', beauty: { browSharp: 34, lashSharp: 32, eyeRedness: 24 } }, label: '눈가를 또렷하게 보정했어요' },

    // ── 기본 보정(방향) ──
    { test: /(자동\s*보정|자동보정|예쁘게|알아서\s*보정|한\s*번에)/, cmd: { type: 'adjust', set: { brightness: 12, saturation: 16, sharpness: 18, color: 6 } }, label: '빠른 자동 보정을 적용했어요' },
    { test: /(더\s*)?(밝게|환하게)|밝기\s*(올|높)/, cmd: { type: 'adjust', delta: { brightness: 25 } }, label: '밝기를 올렸어요' },
    { test: /(어둡게|어둡)|밝기\s*(낮|내)/, cmd: { type: 'adjust', delta: { brightness: -25 } }, label: '밝기를 낮췄어요' },
    { test: /(채도|색).*(올|높|진하|선명)|쨍하게/, cmd: { type: 'adjust', delta: { saturation: 25 } }, label: '채도를 올렸어요' },
    { test: /(채도|색).*(낮|내|연하|차분)/, cmd: { type: 'adjust', delta: { saturation: -25 } }, label: '채도를 낮췄어요' },
    { test: /(대비|뚜렷)\s*(올|높)?/, cmd: { type: 'adjust', delta: { contrast: 25 } }, label: '대비를 올렸어요' },
    { test: /(은은|대비\s*낮)/, cmd: { type: 'adjust', delta: { contrast: -25 } }, label: '대비를 낮췄어요' },
    { test: /(선명|또렷|샤프)\s*(하게|올|높)?/, cmd: { type: 'adjust', delta: { sharpness: 25 } }, label: '선명도를 올렸어요' },
    { test: /(부드럽게|소프트|뭉개)/, cmd: { type: 'adjust', delta: { sharpness: -25 } }, label: '부드럽게 했어요' },
    { test: /(따뜻|웜톤|노란빛|따숩)/, cmd: { type: 'adjust', delta: { color: 25 } }, label: '따뜻한 톤으로 맞췄어요' },
    { test: /(차갑|쿨톤|시원|푸른빛)/, cmd: { type: 'adjust', delta: { color: -25 } }, label: '시원한 톤으로 맞췄어요' },

    // ── 편집 되돌리기/비교/초기화 ──
    { test: /(되돌려|이전으로|편집\s*취소|언두)/, cmd: { type: 'edit', action: '되돌리기' }, label: '한 단계 되돌렸어요' },
    { test: /(다시\s*실행|리두)/, cmd: { type: 'edit', action: '다시실행' }, label: '다시 실행했어요' },
    { test: /(원본\s*(보기|비교)|비교해)/, cmd: { type: 'edit', action: '비교' }, label: '원본과 비교 중이에요' },
    { test: /(보정\s*(초기화|지워|리셋)|편집\s*초기화)/, cmd: { type: 'edit', action: '초기화' }, label: '보정을 초기화했어요' },

    // ── 캡션(게시글) ──
    { test: /(게시글|캡션|문구).*(초기화|지워|리셋)/, cmd: { type: 'capvar', variant: 'reset' }, label: '게시글을 초기화했어요' },
    { test: /(더\s*길게|길게\s*(써|해)|분량\s*(늘|많))/, cmd: { type: 'capvar', variant: 'long' }, label: '더 길게 다시 썼어요' },
    { test: /(짧게|간결|줄여)/, cmd: { type: 'capvar', variant: 'short' }, label: '짧게 다시 썼어요' },
    { test: /(해시태그|태그).*(더|많이|추가)/, cmd: { type: 'capvar', variant: 'hashtags' }, label: '해시태그를 더 가져왔어요' },
    { test: /(인스타스럽게|인스타\s*(말투|느낌|st|스타일))/, cmd: { type: 'capvar', variant: 'insta' }, label: '인스타 말투로 다시 썼어요' },
    { test: /(게시글|캡션|문구).*(다시|새로|재생성)|(다시)\s*(써|생성|만들)/, cmd: { type: 'capvar', variant: 'regen' }, label: '게시글을 다시 만들었어요' },
    { test: /(게시글|캡션|문구).*(만들|써|생성|작성)/, cmd: function (q) {
      var out = { type: 'caption' };
      var m = q.match(/(.+?)\s*(으로|로)?\s*(게시글|캡션|문구)\s*(써|쓰|작성|만들|생성)/);
      var svc = m && m[1] ? m[1].replace(/(으로|로|을|를)$/, '').trim() : '';
      if (svc && !/^(이|그|저|새|다시)$/.test(svc)) out.service = svc;   // 시술명/키워드를 말에서 추출
      var sit = /신규|첫\s*방문|처음/.test(q) ? '신규 고객' : (/재방문|단골|또\s*오/.test(q) ? '재방문' : (/완성|시술\s*완료/.test(q) ? '시술 완성' : ''));
      if (sit) out.axes = { situation: sit };
      return out;
    }, label: '게시글을 만들고 있어요' },
  ];

  // [구조 통합 P2] 작업실이 "닫혀 있을 때" 자연어로 여는 명령 — 명시 발화만(작업실/게시글만)이라
  //   기존 잇비 사진모드(photo-mode, "사진 편집해줘"류)와 충돌 안 함.
  var OPEN_COMMANDS = [
    { test: /작업실.*(전후|비포\s*애프터)|전후.*작업실/, cmd: { type: 'open', cat: 'ba' }, label: '작업실에서 전후 만들기를 열었어요' },
    { test: /작업실.*(후기|리뷰)|후기.*작업실/, cmd: { type: 'open', cat: 'review' }, label: '작업실에서 고객 후기 만들기를 열었어요' },
    { test: /작업실.*(이벤트|할인|혜택)/, cmd: { type: 'open', cat: 'event' }, label: '작업실에서 이벤트 만들기를 열었어요' },
    { test: /작업실.*(시술\s*자랑|자랑|완성컷|피드)/, cmd: { type: 'open', cat: 'flex' }, label: '작업실에서 시술 자랑 만들기를 열었어요' },
    { test: /작업실.*(게시글|글|캡션|문구)/, cmd: { type: 'open', textOnly: true, screen: 'caption' }, label: '작업실에서 게시글 쓰기를 열었어요' },
    { test: /작업실\s*(열어?\s*줘?|열기|시작|보여\s*줘?|들어가|가자|가\s*줘|이동|켜\s*줘?|만들|편집)/, cmd: { type: 'open' }, label: '작업실을 열었어요' },
    { test: /^작업실(로|에|좀)?\s*$/, cmd: { type: 'open' }, label: '작업실을 열었어요' },
    { test: /(게시글만|글만|문구만|캡션만)\s*(써|쓰|작성|만들|생성)/, cmd: { type: 'open', textOnly: true, screen: 'caption' }, label: '게시글 쓰기를 열었어요' },
  ];

  function _toast(m) { if (m && window.showToast) window.showToast(m); }
  function _flowOpen() {
    try { return !!(window.WorkspaceFlow && window.WorkspaceFlow.isOpen && window.WorkspaceFlow.isOpen()); }
    catch (_e) { return false; }
  }
  // 닫힌 작업실을 자연어로 연다. 명시 발화만 처리, 아니면 false(기존 파이프라인으로 통과).
  function tryOpen(input, q, deps) {
    var text = String(q || (input && input.value) || '').trim();
    if (!text || !window.WorkspaceFlow || typeof window.WorkspaceFlow.command !== 'function') return false;
    if (_flowOpen()) return false;   // 이미 열려 있으면 in-flow(tryRun)에 맡김
    // 잇비 채팅에 올린 사진이 있으면 작업실로 함께 투입(게시글만 흐름 제외).
    var photoUrls = null;
    try {
      if (window.ItdasySourceImage && typeof window.ItdasySourceImage.resolve === 'function') {
        var src = window.ItdasySourceImage.resolve();
        if (src && src.dataUrl) photoUrls = [src.dataUrl];
      }
    } catch (_e) { photoUrls = null; }
    for (var i = 0; i < OPEN_COMMANDS.length; i++) {
      var c = OPEN_COMMANDS[i];
      if (!c.test.test(text)) continue;
      var ocmd = Object.assign({}, c.cmd);
      if (photoUrls && !ocmd.textOnly) ocmd.photoUrls = photoUrls;
      try { window.WorkspaceFlow.command(ocmd); }
      catch (_e2) { return false; }
      if (deps && typeof deps.clearInput === 'function') deps.clearInput(input);
      else if (input) input.value = '';
      _toast(c.label);
      return true;
    }
    return false;
  }

  // 자연어 1건 처리. 작업실 열려 있고 명령 매칭 시 실행 → {handled, message}. 아니면 {handled:false}.
  function run(text) {
    var q = String(text == null ? '' : text).trim();
    if (!q || !_flowOpen() || !window.WorkspaceFlow || typeof window.WorkspaceFlow.command !== 'function') return { handled: false };
    for (var i = 0; i < COMMANDS.length; i++) {
      var c = COMMANDS[i];
      if (!c.test.test(q)) continue;
      var cmd = typeof c.cmd === 'function' ? c.cmd(q) : c.cmd;
      if (!cmd) continue;
      var res;
      try { res = window.WorkspaceFlow.command(cmd); }
      catch (_e) { res = { ok: false, reason: 'error' }; }
      if (res && res.ok) return { handled: true, message: c.label || '' };
      // 명령은 맞았지만 현재 단계에서 불가(예: 캡션 화면 아님) → 안내만, 가로채지 않음.
      return { handled: false, reason: (res && res.reason) || 'failed' };
    }
    return { handled: false };
  }

  // 잇비 _send 체인용 래퍼 — 처리 시 입력창 비우고 true.
  function tryRun(input, q, deps) {
    var text = String(q || (input && input.value) || '').trim();
    var r = run(text);
    if (!r.handled) return false;
    if (deps && typeof deps.clearInput === 'function') deps.clearInput(input);
    else if (input) input.value = '';
    _toast(r.message);
    return true;
  }

  window.ItdasyWorkspaceNL = { run: run, tryRun: tryRun, tryOpen: tryOpen, COMMANDS: COMMANDS, OPEN_COMMANDS: OPEN_COMMANDS };
})();
