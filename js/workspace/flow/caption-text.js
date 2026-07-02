/* caption-text.js — 시술 입력 텍스트 파싱(고객명·샵이름 분리, 시술명/내용 분할)
   [B-분할] workspace-v2-flow.js IIFE 에서 분리(2026-06-30). 전부 순수함수(상호참조 + window.BrandKit/localStorage).
   window.WSCaptionText 로 노출 → flow IIFE 가 동명 alias 로 받아 호출부 그대로. */
(function () {
  'use strict';
  function _extractCustomer(svc) {
    var out = String(svc || ''), name = '';
    // [#1] 이름 아닌 일반 수식어가 '고객/님' 앞에 오면 고객명으로 오인 금지(예: "남성 고객", "단골 손님").
    var CUST_BLOCK = /^(원장|선생|사장|대표|점장|실장|디자이너|고객|손님|남성|여성|남자|여자|남|여|단골|신규|기존|첫|재방문|소개|단체|커플|모녀|자매|학생|직장인|주부|신부|예민|민감|약해진)$/;
    var m = out.match(/([가-힣A-Za-z]{1,12}?)\s*고객님?/);
    if (m && !CUST_BLOCK.test(m[1])) { name = m[1]; out = out.replace(m[0], ' '); }
    else {
      var m2 = out.match(/([가-힣]{2,4})\s*님(?=\s|$|[,·、])/);
      if (m2 && !CUST_BLOCK.test(m2[1])) { name = m2[1]; out = out.replace(m2[0], ' '); }
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
  var _WORD_DROP = /(남친|여친|남자친구|여자친구|친구|함께|같이|커플|모녀|자매|왔|옴|오셨|오심|재밌|웃|기분|단골|소개|가격|비용|얼마|원짜리|만원|천원|짜리|말투|이모지|해시태그|글자|부탁|느낌|추천|골라|써줘|해줘)/;
  function _splitServiceForLayers(svc) {
    var s = String(svc || '')
      .replace(/(?:인스타|sns|감성|내추럴|모던|빈티지|러블리|시크|트렌디|미니멀|청순|글램|깔끔|세련|화사)?\s*(?:톤앤무드|톤앤매너|톤|느낌|감성|무드|분위기|바이브)\s*(?:으로|로|하게|있게|스럽게)\s*(?:마무리|마감|연출|편집|보정|작성)?/gi, ' ');
    s = _cleanService(s).service;   // [v590·#A][#1] 오버레이에 고객명·샵이름 안 박힘
    s = s.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu, ' ');   // 이모지 제거
    s = s.replace(/\d+\s*자(?:\s*(?:이내|로|정도))?/g, ' ');   // '300자' 같은 글자수 지시 제거
    var segs = s.split(/[\n,·、.]+/).map(function (x) { return x.trim(); })
      .filter(function (x) { return x && !_OVL_DROP.test(x); });   // [#10] 지시·사담 세그먼트 제거
    // [#4] 세그먼트가 전부 걸러졌으면(구분자 없는 한 덩어리에 사담 섞임) 단어 단위로 시술어만 추출.
    if (!segs.length) {
      var kept = s.split(/[\n,·、.\s]+/).map(function (x) { return x.trim(); })
        .filter(function (w) { return w && !_WORD_DROP.test(w); });
      if (!kept.length) return { title: '', sub: '', body: '' };
      if (kept.length >= 3) return { title: kept.slice(0, 2).join(' '), sub: kept.slice(2).join(' '), body: '' };
      if (kept.length === 2) return { title: kept[0], sub: kept[1], body: '' };
      return { title: kept[0], sub: '', body: '' };
    }
    if (segs.length >= 2) return { title: segs[0], sub: segs[1], body: '' };   // [#10] body 덤프 금지(사적내용 방지)
    // [v590·#A] 단일 구문: 길이/스펙(28인치 등)을 부제로 떼고 컷·스타일명은 제목으로 통째 유지(첫 단어만 떼던 회귀 수정).
    //   [#4] 사담 토큰(남친/28만원짜리 등)은 단어 단위로 제거 후 처리.
    var one = (segs[0] || '').split(/\s+/).filter(function (w) { return w && !_WORD_DROP.test(w); }).join(' ');
    var lm = one.match(/^(.*?\S)\s+(\d+\s*(?:인치|호|cm|mm|단|레벨|톤|등급)\b.*)$/);
    if (lm && lm[1].trim()) return { title: lm[1].trim(), sub: lm[2].trim(), body: '' };
    var w = one.split(/\s+/).filter(Boolean);
    if (w.length >= 3) return { title: w.slice(0, 2).join(' '), sub: w.slice(2).join(' '), body: '' };
    if (w.length === 2) return { title: w[0], sub: w[1], body: '' };
    return { title: w[0] || '', sub: '', body: '' };
  }
  window.WSCaptionText = {
    extractCustomer: _extractCustomer, shopName: _shopName, stripShopName: _stripShopName,
    detectShopName: _detectShopName, cleanService: _cleanService, splitServiceForLayers: _splitServiceForLayers,
  };
})();
