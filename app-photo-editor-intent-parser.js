/* 사진 편집기 — 말 명령 의도 파악 (v3 — 살롱 시술 전문 NL 확장) */
(function () {
  'use strict';
  if (window.PhotoEditorIntentParser) return;

  var PATTERNS = {
    bg:       /누끼|배경.*바꿔|배경.*색|배경.*제거|배경.*지우|핑크.*배경|배경.*핑크|배경.*넣|배경.*교체|투명|아웃포커|보케/,
    adjust:   /밝[게히]|어둡[게히]|채도|선명[하게]|따뜻[하게]|차갑[게히]|색온도|보정|대비|콘트라스트|하이라이트|그림자|노출|비네팅|글로우/,
    beautify: /예쁘게|자연스럽|피부|잡티|윤기|매끈|리터치|뷰티|헤어|네일|속눈썹|풍성|볼륨|잔머리|머리결|머리카락|두피|탈모|뿌리|염색|컬러|탈색|웨이브|파마|스트레이트|붉은기|다크서클|주름|모공|여드름|기미|주근깨|눈밑|입술|립|광대|턱|이마|코|브이라인|광택|손|발톱|큐티클|젤|아크릴|각질|왁싱|제모|메이크업|화장|아이라인|아이섀도|블러셔|치크|하이라이터|컨투어|파운데이션|눈썹|반영구|문신/,
    template: /전후|비포|애프터|인스타|피드|스토리|홍보|템플|가격표|후기|얹|올려|포트폴리오|명함|카드|배너|썸네일|블로그|리뷰|이벤트|할인|오픈|공지|안내|메뉴판/,
    retouch:  /지우[고개]|클론|힐링|부분.*블러|부분.*보정|스팟/,
    export:   /저장|내보내|다운로드|업로드|공유|보내/,
    modify:   /덜|좀 더|줄여|늘려|빼[줘고]|넣[어줘]|바꿔|원래대로|과해|강하게|약하게|살짝|많이|조금|확|팍|쎄게|연하게|진하게|흐리게|또렷하게|크게|작게|굵게|얇게|위로|아래로|왼쪽|오른쪽|가운데|중앙/,
  };

  var BG_COLORS = {
    핑크: 'pink_radial', 분홍: 'pink_radial', 로즈: 'pink_radial',
    베이지: 'beige', 아이보리: 'beige', 크림: 'beige',
    블랙: 'black_lux', 검정: 'black_lux', 검은: 'black_lux', 다크: 'black_lux',
    하양: 'white', 흰: 'white', 화이트: 'white', 하얀: 'white',
    회색: 'gray', 그레이: 'gray',
  };

  // [T-161] 라우팅 정책 — 상대조정(줄여/조금)이 붙어도 강화 효과로 보낼지 판단
  // 문제 완화형 부위·증상 키워드 (줄여/낮춰가 붙어도 '기능 intent')
  var PROBLEM = /여드름|트러블|잡티|기미|주근깨|다크서클|눈밑|칙칙|붉은기|홍조|노란기|누런|푸른기|푸르|모공|주름|피부\s*결|살결/;
  // 진짜 modify(이미 적용한 효과 강도 낮추기) 문맥
  var STRONG_MODIFY = /방금|전체|효과|너무|과해|과하|보정|진해|센\b|세게/;
  // 기능 효과 키워드 (조금/살짝 + 이거면 약한 강도 기능 preset)
  var FEATURE_KW = /풍성|볼륨|머리|헤어|모발|윤기|눈빛|반짝|속눈썹|네일|손톱|젤|입술|립|발색|색감|피부|잡티|모공|광택/;
  var WEAK = /조금|살짝|약간|은은/;

  var REDUCE_VERB = /줄여|낮춰|덜|약하게/; // 적용한 효과를 낮추라는 축소 동사

  // 줄여/조금이 붙어도 강화 효과(기능 intent)로 보낼 명령인가
  function _forceFeature(input) {
    if (STRONG_MODIFY.test(input)) return false;     // 방금/너무/과해 등은 modify 유지
    if (PROBLEM.test(input)) return true;            // 부위+증상 완화형(줄여 붙어도 보정 적용)
    // 조금/살짝 + 기능 → 약한 강도 기능. 단 '줄여/낮춰'(효과 축소)면 modify 로 보냄
    if (WEAK.test(input) && FEATURE_KW.test(input) && !REDUCE_VERB.test(input)) return true;
    return false;
  }

  // 조금/살짝 → 같은 기능을 약한 강도로 (set_beauty 값만 축소, adjust 는 유지)
  function _weaken(input, steps) {
    if (!(WEAK.test(input) && !STRONG_MODIFY.test(input))) return steps;
    return steps.map(function (s) {
      if (s.action !== 'set_beauty' || !s.params) return s;
      var p = {};
      for (var k in s.params) { var v = Math.round(s.params[k] * 0.45); p[k] = v > 0 ? Math.max(8, v) : v; }
      return { action: 'set_beauty', params: p, description_ko: (s.description_ko || '') + ' (살짝)' };
    });
  }

  function parse(text) {
    var input = String(text || '').trim();
    var intent = _intent(input);
    if (_forceFeature(input)) intent = 'beautify';   // [T-161] 완화형/약한 기능은 기능 intent
    var steps = _steps(input, intent);
    return {
      version: '1.0', intent: intent,
      confidence: input ? 0.88 : 0, steps: steps,
      safety: { preserveIdentity: true, requireUserConfirm: false },
      explanation_ko: _explain(input, intent),
    };
  }

  function _intent(input) {
    if (PATTERNS.modify.test(input)) return 'modify';
    if (PATTERNS.bg.test(input)) return 'bg';
    if (PATTERNS.template.test(input)) return 'template';
    if (PATTERNS.beautify.test(input)) return 'beautify';
    if (PATTERNS.adjust.test(input)) return 'adjust';
    if (PATTERNS.export.test(input)) return 'export';
    if (PATTERNS.retouch.test(input)) return 'retouch';
    return 'beautify';
  }

  function _steps(input, intent) {
    if (intent === 'bg') return _bgSteps(input);
    var template = window.PhotoEditorNLTemplate && window.PhotoEditorNLTemplate.plan ? window.PhotoEditorNLTemplate.plan(input) : null;
    if (template) return template.steps;
    // [T-161] 완화형/약한 기능 명령은 NLModify(상대조정)보다 먼저 강화 효과로 라우팅
    if (_forceFeature(input)) return _weaken(input, _beautySteps(input));
    var modify = window.PhotoEditorNLModify && window.PhotoEditorNLModify.plan ? window.PhotoEditorNLModify.plan(input) : null;
    if (modify) return modify.steps;
    if (intent === 'export') return [{ action: 'export', params: { format: 'png' }, description_ko: '저장' }];
    if (intent === 'adjust') return _adjustSteps(input);
    return _weaken(input, _beautySteps(input));
  }

  // ── 배경/누끼 ──
  function _bgSteps(input) {
    var bgType = null;
    for (var kw in BG_COLORS) { if (input.indexOf(kw) !== -1) { bgType = BG_COLORS[kw]; break; } }
    if (/아웃포커|보케|흐리/.test(input)) return [{ action: 'apply_bgblur', params: { strength: 65 }, description_ko: '배경 아웃포커스' }];
    if (/투명/.test(input)) return [{ action: 'apply_nukki', params: { bgType: 'transparent' }, description_ko: '배경 투명 처리' }];
    return [{ action: 'apply_nukki', params: { bgType: bgType || 'pink_radial' }, description_ko: '누끼 + 배경 적용' }];
  }

  // ── 수동 보정 ──
  function _adjustSteps(input) {
    var steps = [];
    var adj = {};
    if (/밝[게히]/.test(input)) adj.brightness = 114;
    if (/어둡[게히]/.test(input)) adj.brightness = 90;
    if (/채도/.test(input)) adj.saturate = /낮|줄/.test(input) ? 88 : 118;
    if (/선명/.test(input)) adj.sharpness = 28;
    if (/따뜻|웜/.test(input)) adj.temperature = 16;
    if (/차갑|쿨/.test(input)) adj.temperature = -12;
    if (/대비|콘트라스트/.test(input)) adj.saturate = 115;
    if (/글로우/.test(input)) { adj.brightness = 108; steps.push({ action: 'set_beauty', params: { skin: 14 }, description_ko: '글로우' }); }
    if (Object.keys(adj).length) steps.unshift({ action: 'set_adjust', params: adj, description_ko: '색감 보정' });
    return steps.length ? steps : [{ action: 'set_adjust', params: { brightness: 110, saturate: 108 }, description_ko: '기본 보정' }];
  }

  // ── 뷰티 ──
  function _beautySteps(input) {
    // 헤어 계열
    if (/풍성|볼륨/.test(input)) return [{ action: 'set_beauty', params: { hairVolume: 68, hairShine: 38, hairDetail: 22, hairEndsClean: 15 }, description_ko: '머리 풍성하게' }];
    if (/잔머리/.test(input)) return [{ action: 'set_beauty', params: { hairEndsClean: 65, hairDetail: 28 }, description_ko: '잔머리 정리' }];
    if (/머리\s*끝|모발\s*끝/.test(input)) return [{ action: 'set_beauty', params: { hairEndsClean: 55, hairDetail: 22, hairShine: 20 }, description_ko: '머리끝 정리' }];
    if (/머리결|머리카락/.test(input)) return [{ action: 'set_beauty', params: { hairShine: 55, hairVolume: 32, hairEndsClean: 30, hairDetail: 18 }, description_ko: '머리결 정리' }];
    if (/뿌리|두피|탈모/.test(input)) return [{ action: 'set_beauty', params: { scalpBoost: 55, hairVolume: 40 }, description_ko: '두피 톤 보강' }];
    if (/염색|컬러.*머리|헤어.*컬러|탈색/.test(input)) return [{ action: 'set_beauty', params: { hairColorPop: 55, hairColor: 30, hairShine: 25 }, description_ko: '염색 색감 강조' }];
    if (/웨이브|파마|컬/.test(input)) return [{ action: 'set_beauty', params: { hairVolume: 55, hairDetail: 35, hairShine: 30 }, description_ko: '웨이브 강조' }];
    if (/스트레이트|생머리/.test(input)) return [{ action: 'set_beauty', params: { hairShine: 55, hairEndsClean: 45, hairDetail: 15 }, description_ko: '생머리 윤기' }];
    if (/헤어|머리|윤기/.test(input)) return [{ action: 'apply_preset', params: { preset: 'hair-gloss' }, description_ko: '헤어 윤기' }];

    // 네일 계열
    if (/손\s*피부|손등|손\s*톤|손.*칙칙/.test(input)) return [{ action: 'set_beauty', params: { handSkin: 50, nailGloss: 15 }, description_ko: '손 피부톤 정리' }];
    if (/큐티클|각질.*손/.test(input)) return [{ action: 'set_beauty', params: { handSkin: 45, nailGloss: 30 }, description_ko: '큐티클 정리' }];
    if (/젤|아크릴|네일아트|네일.*반짝|네일.*광택|손톱.*광택/.test(input)) return [{ action: 'set_beauty', params: { nailGloss: 65, nailShape: 45, handSkin: 20 }, description_ko: '네일 광택' }];
    if (/네일.*경계|경계.*또렷|네일.*또렷|네일.*선명|손톱.*또렷/.test(input)) return [{ action: 'set_beauty', params: { nailShape: 48, nailGloss: 22, handSkin: 12 }, description_ko: '네일 경계 또렷' }];
    if (/손톱|네일/.test(input)) return [{ action: 'apply_preset', params: { preset: 'nail-crisp' }, description_ko: '네일 선명' }];

    // 속눈썹/눈 계열
    if (/눈빛|눈동자.*반짝|반짝.*눈|또렷.*눈빛/.test(input)) return [{ action: 'set_beauty', params: { catchLight: 32, irisClear: 22, lashSharp: 16 }, description_ko: '눈빛 또렷하게' }];
    if (/속눈썹|연장|펌.*눈/.test(input)) return [{ action: 'apply_preset', params: { preset: 'lash-clear' }, description_ko: '속눈썹 또렷' }];
    if (/다크서클|눈밑/.test(input)) return [{ action: 'set_beauty', params: { underEyeClean: 55, eyeShadow: 20 }, description_ko: '다크서클 완화' }];
    if (/눈썹|반영구.*눈/.test(input)) return [{ action: 'set_beauty', params: { browSharp: 50 }, description_ko: '눈썹·디테일 선명' }];
    if (/눈.*또렷|눈.*크[게게]|눈.*선명/.test(input)) return [{ action: 'set_beauty', params: { irisClear: 40, catchLight: 30, lashSharp: 35 }, description_ko: '눈 또렷하게' }];
    if (/아이.*색감|눈.*색감|아이.*컬러|아이라인|아이섀도/.test(input)) return [{ action: 'set_beauty', params: { eyeColor: 38, eyeShadow: 24, lashSharp: 18 }, description_ko: '아이 색감 강조' }];

    // 피부 계열
    if (/모공/.test(input)) return [{ action: 'set_beauty', params: { textureSmooth: 45, skin: 25, blemish: 15 }, description_ko: '모공 정리' }];
    if (/여드름|트러블/.test(input)) return [{ action: 'set_beauty', params: { blemish: 50, redness: 35, skin: 20, textureSmooth: 12 }, description_ko: '트러블 완화' }];
    if (/기미|주근깨|잡티/.test(input)) return [{ action: 'set_beauty', params: { blemish: 45, skin: 22, yellowness: 18 }, description_ko: '기미/잡티 완화' }];
    if (/주름/.test(input)) return [{ action: 'set_beauty', params: { textureSmooth: 40, skin: 20 }, description_ko: '주름 완화' }];
    if (/붉은기|홍조/.test(input)) return [{ action: 'set_beauty', params: { redness: 55, skin: 15 }, description_ko: '붉은기 진정' }];
    if (/푸른기|푸르|창백|핏기/.test(input)) return [{ action: 'set_beauty', params: { coolness: 38, skin: 12, redness: 10 }, description_ko: '푸른기 완화' }];
    if (/노란|누런|칙칙|피부톤/.test(input)) return [{ action: 'set_beauty', params: { yellowness: 40, skin: 18, coolness: 12 }, description_ko: '피부톤 정리' }];
    if (/화사|환하|광채|톤업/.test(input)) return [
      { action: 'set_adjust', params: { brightness: 112, temperature: 4 }, description_ko: '톤업' },
      { action: 'set_beauty', params: { skin: 22, redness: 18, yellowness: 15 }, description_ko: '피부 화사하게' },
    ];
    if (/피부\s*결|살결|결\s*정리/.test(input)) return [{ action: 'set_beauty', params: { textureSmooth: 42, skin: 18, blemish: 12 }, description_ko: '피부결 정리' }];
    if (/매끈|보들|부드럽/.test(input)) return [{ action: 'set_beauty', params: { textureSmooth: 38, skin: 28, blemish: 18 }, description_ko: '매끈한 피부' }];
    if (/피부/.test(input)) return [{ action: 'set_beauty', params: { skin: 28, redness: 22, blemish: 24, textureSmooth: 16 }, description_ko: '피부 정리' }];

    // 입술/립
    if (/입술|립/.test(input)) return [{ action: 'set_beauty', params: { lipPop: 45 }, description_ko: '입술 생기' }];

    // 메이크업 전체
    if (/메이크업|화장|풀메/.test(input)) return [
      { action: 'set_beauty', params: { skin: 25, lipPop: 30, eyeColor: 25, browSharp: 20, lashSharp: 25, blemish: 20 }, description_ko: '메이크업 보정' },
    ];

    // 왁싱/제모
    if (/왁싱|제모/.test(input)) return [{ action: 'set_beauty', params: { skin: 30, textureSmooth: 35, redness: 25 }, description_ko: '왁싱 후 피부 정리' }];

    // 반영구
    if (/반영구|문신/.test(input)) return [{ action: 'set_beauty', params: { browSharp: 45, lipPop: 30 }, description_ko: '반영구 선명' }];

    // 종합 프리셋
    if (/고급|프리미엄|럭셔리/.test(input)) return [{ action: 'apply_preset', params: { preset: 'premium-warm' }, description_ko: '프리미엄 톤' }];
    if (/밝/.test(input)) return [{ action: 'set_adjust', params: { brightness: 112 }, description_ko: '밝게' }];
    if (/따뜻|웜/.test(input)) return [{ action: 'set_adjust', params: { temperature: 15 }, description_ko: '따뜻한 톤' }];
    if (/자연|내추럴/.test(input)) return [{ action: 'apply_preset', params: { preset: 'natural-before' }, description_ko: '자연 보정' }];
    if (/깨끗|클린/.test(input)) return [{ action: 'apply_preset', params: { preset: 'salon-clean' }, description_ko: '깨끗한 피부' }];

    return [{ action: 'apply_preset', params: { preset: 'salon-clean' }, description_ko: '기본 예쁨 보정' }];
  }

  // [T-161] 완화형/약화/낮추기 맥락의 정직 안내문 — 일반 설명보다 먼저 (제거/완전 금지)
  function _explainRel(input) {
    if (PROBLEM.test(input) && !STRONG_MODIFY.test(input)) {
      if (/여드름|트러블/.test(input)) return '트러블이 덜 도드라지게 완화했어요.';
      if (/기미|주근깨|잡티/.test(input)) return WEAK.test(input) ? '잡티가 자연스럽게 덜 보이도록 약하게 보정했어요.' : '잡티가 덜 도드라지게 완화했어요.';
      if (/다크서클|눈밑|칙칙/.test(input)) return '눈밑 칙칙함이 덜해 보이도록 눈밑만 자연스럽게 밝혔어요.';
      if (/붉은기|홍조/.test(input)) return '붉은기를 자연스럽게 진정시켰어요.';
      if (/노란기|누런/.test(input)) return '노란기를 줄여 피부톤을 정리했어요.';
      if (/푸른기|푸르|창백|핏기/.test(input)) return '푸른기를 줄여 혈색을 자연스럽게 살렸어요.';
      if (/피부\s*결|살결/.test(input)) return WEAK.test(input) ? '피부결을 과하지 않게 살짝 정리했어요.' : '피부결을 자연스럽게 정리했어요.';
      if (/모공/.test(input)) return '모공을 자연스럽게 정리했어요.';
      if (/주름/.test(input)) return '주름이 덜 도드라지게 완화했어요.';
    }
    if (WEAK.test(input) && !STRONG_MODIFY.test(input) && !REDUCE_VERB.test(input)) {
      if (/입술|립|발색/.test(input)) return '입술 발색을 과하지 않게 살짝 살렸어요.';
      if (/눈빛|반짝/.test(input)) return '눈빛을 과하지 않게 살짝 또렷하게 살렸어요.';
      if (/속눈썹/.test(input)) return '속눈썹을 살짝 또렷하게 살렸어요.';
      if (/아이.*색감|눈.*색감/.test(input)) return '아이 색감을 과하지 않게 살짝 살렸어요.';
    }
    if (STRONG_MODIFY.test(input) || /줄여|낮춰|덜|약하게/.test(input)) {
      if (/풍성|볼륨/.test(input)) return '머리 볼륨을 조금 차분하게 줄였어요.';
      if (/광택|윤기/.test(input)) return '광택을 덜 도드라지게 줄였어요.';
      if (/입술|립|발색/.test(input)) return '입술 발색을 살짝 차분하게 낮췄어요.';
      if (/눈빛|반짝/.test(input)) return '눈빛 효과를 조금 차분하게 낮췄어요.';
      if (/속눈썹/.test(input)) return '속눈썹 강조를 살짝 낮췄어요.';
      if (/색감/.test(input)) return '색감을 조금 차분하게 낮췄어요.';
    }
    return null;
  }

  // ── 설명 생성 ──
  function _explain(input, intent) {
    if (intent === 'bg') {
      if (/아웃포커|보케/.test(input)) return '배경을 자연스럽게 흐리게 해요.';
      if (/투명/.test(input)) return '배경을 투명하게 제거해요.';
      return '배경을 제거하고 새 배경을 입혀요.';
    }
    var rel = _explainRel(input);
    if (rel) return rel;
    if (/풍성|볼륨/.test(input)) return '머리카락에 볼륨과 윤기를 더해요.';
    if (/머리\s*끝|모발\s*끝/.test(input)) return '머리끝을 정돈해 깔끔하게 보이도록 해요.';
    if (/잔머리/.test(input)) return '잔머리를 깔끔하게 정리해요.';
    if (/눈빛|눈동자.*반짝|반짝.*눈/.test(input)) return '눈동자 빛을 살려 눈빛을 또렷하게 보이도록 해요.';
    if (/아이.*색감|눈.*색감|아이.*컬러/.test(input)) return '아이 메이크업 색감을 또렷하게 살려요.';
    if (/네일.*반짝|네일.*광택|젤|아크릴/.test(input)) return '네일에 광택을 더해 또렷하게 보이도록 해요.';
    if (/네일.*경계|경계.*또렷|네일.*또렷|네일.*선명|손톱/.test(input)) return '네일 경계를 또렷하게 다듬어요.';
    if (/손\s*피부|손등|손\s*톤/.test(input)) return '손 피부톤을 자연스럽게 정리해요.';
    if (/피부\s*결|살결/.test(input)) return '피부결을 매끄럽게 정리해요.';
    if (/속눈썹|연장|펌.*눈/.test(input)) return '속눈썹을 또렷하게 살려요.';
    if (/눈썹|반영구.*눈/.test(input)) return '눈썹 주변 디테일이 또렷해 보이도록 선명도를 보강했어요.';
    if (/눈.*또렷|눈.*크[게게]|눈.*선명/.test(input)) return '눈동자와 속눈썹을 또렷하게 살려요.';
    if (/입술|립/.test(input)) return '입술 발색을 생기있게 살려요.';
    if (/기미|주근깨|잡티/.test(input)) return '잡티를 자연스럽게 완화해요.';
    if (/매끈|보들|부드럽/.test(input)) return '피부를 매끄럽게 정리해요.';
    if (/머리결|머리카락|윤기|생머리|스트레이트/.test(input)) return '머리결에 윤기를 더해 정돈해요.';
    if (/염색|컬러/.test(input)) return '염색 색감을 더 선명하게 살려요.';
    if (/모공/.test(input)) return '모공을 자연스럽게 정리해요.';
    if (/다크서클|눈밑/.test(input)) return '눈 밑 칙칙함과 다크서클을 완화해요.';
    if (/여드름|트러블/.test(input)) return '트러블 부위를 자연스럽게 완화해요.';
    if (/붉은기|홍조/.test(input)) return '붉은기를 진정시켜요.';
    if (/왁싱|제모/.test(input)) return '왁싱 후 피부를 깔끔하게 정리해요.';
    if (/반영구/.test(input)) return '반영구 시술 결과를 선명하게 보여줘요.';
    if (/메이크업|화장/.test(input)) return '메이크업을 더 또렷하게 살려요.';
    var map = {
      adjust: '밝기와 색감을 맞춰요.',
      beautify: '시술 사진이 자연스럽게 좋아 보이도록 정리해요.',
      template: '홍보용 전후사진 틀을 골라요.',
      retouch: '부분 보정으로 보기 싫은 부분을 줄여요.',
      export: '현재 편집본을 저장해요.',
      modify: '방금 한 보정을 조금 조절해요.',
    };
    return map[intent] || map.beautify;
  }

  window.PhotoEditorIntentParser = { parse };
})();
