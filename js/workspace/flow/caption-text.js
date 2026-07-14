/* caption-text.js — 시술 입력 텍스트 파싱(고객명·샵이름 분리, 시술명/내용 분할)
   [B-분할] workspace-v2-flow.js IIFE 에서 분리(2026-06-30). 전부 순수함수(상호참조 + window.BrandKit/localStorage).
   window.WSCaptionText 로 노출 → flow IIFE 가 동명 alias 로 받아 호출부 그대로. */
(function () {
  'use strict';
  // [버그수정 2026-07-06] 시술어 사전 — 이 뿌리를 포함한 토큰은 '시술명'이라 고객명·사담 필터에서 보호.
  //   예전엔 "붙임머리 고객님"→고객명 '붙임머리'로 오인돼 시술 소실, "커플네일"→'커플' 부분일치로 통째 삭제.
  // [다양성 팩 2026-07-12] 시술어 SSOT = window.ItdasyServiceVocab(js/data/service-vocab.js). 8버티컬로 확장.
  //   모듈이 없으면(로드 순서·구버전) 아래 인라인 폴백을 그대로 사용 → 회귀 없음. 첫 사용 시 한 번만 빌드·캐시.
  var _SERVICE_ROOT_FALLBACK = /(머리|펌|염색|염|탈색|컷|커트|네일|속눈썹|눈썹|왁싱|케어|클리닉|트리트먼트|매직|볼륨|붙임|연장|리터치|드라이|메이크업|메컵|피부|두피|스케일링|아트|페디|젤|매니큐어|룩|스타일|샴푸|마사지|관리|왁스|타투|반영구|앞머리|단발|레이어드|허쉬|볼륨펌|디자인)/;
  var _svcRootCache = null;
  function _svcRootRe() {
    if (_svcRootCache) return _svcRootCache;
    try { if (window.ItdasyServiceVocab && window.ItdasyServiceVocab.rootRegex) { _svcRootCache = window.ItdasyServiceVocab.rootRegex(); return _svcRootCache; } } catch (_e) { void _e; }
    return _SERVICE_ROOT_FALLBACK;   // 캐시 안 함 — 모듈이 나중에 로드되면 다음 호출서 채택
  }
  var _SERVICE_ROOT = { test: function (t) { return _svcRootRe().test(t); } };   // 호출부 _SERVICE_ROOT.test(x) 그대로
  // 시술어 뒤 동사/형용사 활용 어미(예: "염색하신", "단발컷한", "펌하신") — 이름 아님.
  var _VERB_END = /(한|신|하신|했|되신|된|해주신|해드린|받으신|오신)$/;
  function _extractCustomer(svc) {
    var out = String(svc || ''), name = '';
    // [#1] 이름 아닌 일반 수식어가 '고객/님' 앞에 오면 고객명으로 오인 금지(예: "남성 고객", "단골 손님").
    var CUST_BLOCK = /^(원장|선생|사장|대표|점장|실장|디자이너|고객|손님|남성|여성|남자|여자|남|여|단골|신규|기존|첫|재방문|소개|단체|커플|모녀|자매|학생|직장인|주부|신부|예민|민감|약해진)$/;
    // 후보가 시술어(붙임머리 등)·시술활용형(염색하신)이면 이름 아님 → '고객(님)' 존칭만 떼고 후보는 시술로 남긴다.
    function _isNotName(t) { return CUST_BLOCK.test(t) || _SERVICE_ROOT.test(t) || _VERB_END.test(t); }
    var m = out.match(/([가-힣A-Za-z]{1,12}?)\s*고객님?/);
    if (m && !_isNotName(m[1])) { name = m[1]; out = out.replace(m[0], ' '); }
    else if (m) { out = out.replace(/\s*고객님?/, ' '); }   // 시술어+고객님 → 존칭만 제거(시술 보존)
    else {
      var m2 = out.match(/([가-힣]{2,4})\s*님(?=\s|$|[,·、])/);
      if (m2 && !_isNotName(m2[1])) { name = m2[1]; out = out.replace(m2[0], ' '); }
    }
    return { service: out.replace(/\s*,(?:\s*,)+/g, ',').replace(/\s{2,}/g, ' ').replace(/^[\s,]+|[\s,]+$/g, '').trim(), customer: name };
  }
  // [#1] 등록된 샵 이름 — 시술 텍스트에서 빼고(AI가 시술/고객으로 오인 방지) 백엔드엔 별도 전달.
  //   ShopStyle.name 은 이제 '레이아웃 A' 같은 레이아웃명이라 샵 이름으로 쓰지 않는다(BrandKit·localStorage만).
  function _shopName() {
    try { if (window.BrandKit && window.BrandKit.get) { var bk = window.BrandKit.get(); if (bk && bk.shop_name) return String(bk.shop_name).trim(); } } catch (_e) { void _e; }
    try { var s = localStorage.getItem('shop_name'); if (s) return String(s).trim(); } catch (_e2) { void _e2; }
    return '';
  }
  function _stripShopName(text) {
    var sn = _shopName(); if (!sn || sn.length < 2) return text;
    var esc1 = sn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return String(text || '').replace(new RegExp(esc1, 'g'), ' ').replace(/\s{2,}/g, ' ').replace(/^[\s,]+|[\s,]+$/g, '').trim();
  }
  // [#1] 시술칸에 직접 친 샵 이름 감지 — 등록 안 했어도 잡는다. 샵/미용실/살롱/스튜디오/에스테틱 등 명확한
  //   상호 접미사로 끝나는 토큰만(예: "구월동붙임머리연준샵"). '헤어/네일' 단독은 시술 카테고리라 제외.
  function _detectShopName(svc) {
    var s = String(svc || '');
    // [#1] 상호 접미사로 끝나는 토큰. 앞에 지역어(구월동 등)+공백이 붙으면 함께 잡는다("구월동 뷰티풀샵").
    var m = s.match(/(?:^|[\s,·、\n])((?:[가-힣]{2,4}(?:동|읍|면|리|역|구|시|군|점)\s)?[가-힣A-Za-z0-9]{2,24}(?:뷰티샵|헤어샵|네일샵|왁싱샵|미용실|살롱|스튜디오|에스테틱|샵))(?=[\s,·、\n]|$)/);
    return m ? m[1].trim() : '';
  }
  // [#1] 시술 텍스트에서 고객명·샵이름을 모두 떼고 깨끗한 시술만 남긴다(오버레이·백엔드 공통).
  //   [수정] 등록샵·인라인샵 둘 다 제거. 반환 shop 은 '사용자가 친 인라인'을 우선(stale 등록값이 덮어쓰는 것 방지).
  function _cleanService(svc) {
    var c = _extractCustomer(svc);
    var reg = _shopName(), inline = _detectShopName(c.service);
    var service = _stripShopName(c.service);   // 등록샵 제거
    [inline, reg].forEach(function (sh) {
      if (sh && sh.length >= 2) { var esc = sh.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); service = service.replace(new RegExp(esc, 'g'), ' '); }
    });
    service = service.replace(/\s*,(?:\s*,)+/g, ',').replace(/\s{2,}/g, ' ').replace(/^[\s,]+|[\s,]+$/g, '').trim();
    return { service: service, customer: c.customer, shop: inline || reg };
  }
  // [#10] 사진 위 오버레이는 '시술명'만 — 말투/이모지 지시·글자수·사담(여친/재밌었음 등)은 절대 안 박히게.
  var _OVL_DROP = /말투|이모지|해시태그|글자|자\s*이내|자로|부탁|써\s*줘|써줘|넣어|느낌으로|재밌|웃겼|웃음|여친|여자친구|남친|남자친구|오신듯|같이\s*옴|함께\s*옴|단골|기분|친절|후기|정도로|처럼|해\s*줘|해줘|골라|추천해/;
  // [#4] 단어 단위로 뺄 '사적/가격/지시' 토큰 — 구분자 없는 한 덩어리 입력도 시술어만 남기고 사담만 제거.
  var _WORD_DROP = /(남친|여친|남자친구|여자친구|친구|함께|같이|커플|모녀|자매|왔|오셨|오심|오신|재밌|기분|단골|소개|가격|비용|얼마|원짜리|만원|천원|짜리|말투|이모지|해시태그|글자|부탁|느낌|추천|골라|써줘|해줘|해주세|해주셨|감사|축하|환영|만족|드려요|드립니다|주셔|주셨|와주|입니다|했어요|였어요|재방문|고객|손님|예약|문의)/;
  // [버그6 2026-07-14] 정제 파이프라인 공통 추출 — '사담/가격/지시/이모지/고객명/샵명 제거'까지만 하고 자르지 않는다.
  //   오버레이(_splitServiceForLayers)는 여기서 앞 4단어만 쓰고, 캡션 API(_publicServiceKeywords)는 전체를 쓴다.
  function _svcWords(svc) {
    var s = String(svc || '')
      .replace(/(?:인스타|sns|감성|내추럴|모던|빈티지|러블리|시크|트렌디|미니멀|청순|글램|깔끔|세련|화사)?\s*(?:톤앤무드|톤앤매너|톤|느낌|감성|무드|분위기|바이브)\s*(?:으로|로|하게|있게|스럽게)\s*(?:마무리|마감|연출|편집|보정|작성)?/gi, ' ');
    s = _cleanService(s).service;   // [v590·#A][#1] 오버레이에 고객명·샵이름 안 박힘
    s = s.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu, ' ');   // 이모지 제거
    s = s.replace(/\d+\s*자(?:\s*(?:이내|로|정도))?/g, ' ');   // '300자' 같은 글자수 지시 제거
    return s.split(/[\n,·、.\s]+/).map(function (x) { return x.trim(); })
      // [버그수정 2026-07-06] 시술어 포함 토큰(커플네일·모녀펌·자매룩 등)은 사담 필터에서 보호 — 부분일치 오삭제 방지.
      .filter(function (w) { return w && (_SERVICE_ROOT.test(w) || (!_WORD_DROP.test(w) && !_OVL_DROP.test(w))); });
  }
  // [버그6 2026-07-14] 캡션 API 전용 — 절단 없는 '공개 시술 키워드' 전체.
  //   기존엔 flow 가 오버레이용 title+sub(앞 4단어)를 캡션 입력에 재사용해, 시술명 5개 이상 입력 시 뒤가 통째로 소실됐다.
  //   ("레이어드컷 뿌리염색 클리닉 두피스케일링 앞머리펌" → '앞머리펌' 유실)
  function _publicServiceKeywords(svc) { return _svcWords(svc).join(' ').trim(); }
  function _splitServiceForLayers(svc) {
    // [distill] 사진 위 오버레이엔 '딱 핵심(시술명 + 포인트 스펙)'만 — 사적·인사·지시·긴 서술은 넣지 않는다.
    //   예: "붙임머리 비드 방식 26인치 옴브레 자연스러운 볼륨감 김수현 고객님 재방문 감사합니다 롱헤어 완성"
    //     → 제목 "붙임머리 비드 방식" / 부제 "26인치 옴브레" (뒤 사담·서술은 전부 제외).
    var words = _svcWords(svc);
    if (!words.length) return { title: '', sub: '', body: '' };
    var specRe = /^\d+\s*(?:인치|호|cm|mm|단|레벨|톤|등급|번|주|주차)$/;
    var specIdx = -1;
    for (var i = 0; i < words.length; i++) { if (specRe.test(words[i])) { specIdx = i; break; } }
    var title, sub;
    if (specIdx > 0) {                       // 스펙(26인치 등)이 있으면: 앞=시술명(최대 3단어), 부제=스펙+포인트 1개
      title = words.slice(0, Math.min(specIdx, 3)).join(' ');
      sub = words.slice(specIdx, specIdx + 2).join(' ');
    } else {                                 // 스펙 없으면: 앞 2단어=제목, 다음 2단어=부제
      title = words.slice(0, 2).join(' ');
      sub = words.slice(2, 4).join(' ');
    }
    if (title.length > 16) title = words.slice(0, 2).join(' ');   // 제목 과도하게 길면 2단어로 축소
    if (sub.length > 14) sub = sub.split(/\s+/)[0];               // 부제 과도하게 길면 1단어로 축소
    return { title: title, sub: sub, body: '' };
  }
  window.WSCaptionText = {
    extractCustomer: _extractCustomer, shopName: _shopName, stripShopName: _stripShopName,
    detectShopName: _detectShopName, cleanService: _cleanService, splitServiceForLayers: _splitServiceForLayers,
    publicServiceKeywords: _publicServiceKeywords,
  };
})();
