/* 잇비 예약 생성 draft — 슬롯필링(고객/날짜/시간/시술) 컨텍스트 유지 [핫픽스F #5]
   문제였던 것:
     - "예약 잡기" 후 고객명만 입력하면 방문주기 추천으로 새던 것 → draft 가 customer 슬롯을 채운다.
     - 고객+날짜만 있고 "오후 2시"만 와도 못 알아듣던 것 → time 슬롯만 채워 카드 생성.
     - 직전 고객 컨텍스트가 있으면 "내일 오후 2시 예약 추가"가 그 고객으로 이어진다(lastCustomer).
   설계: 순수 상태 + AssistantIntent(resolveCustomer/composeBooking/resolveDateBase/resolveTime/extractService) 재사용.
   외부: window.ItbiBookingDraft = { isActive, arm, clear, tryDraft, rememberCustomer, lastCustomer } */
(function () {
  'use strict';
  if (window.ItbiBookingDraft) return;

  var TTL = 10 * 60 * 1000;        // draft 유지 10분
  var LAST_TTL = 15 * 60 * 1000;   // 직전 고객 기억 15분
  var D = null;   // { mode:'add', customer:{id,name}|null, dateBase:Date|null, time, service, ts }
  var L = null;   // { customer:{id,name}, ts }  — 직전 예약 고객

  function _trim(s) { return String(s == null ? '' : s).trim(); }
  function _draftFresh() { return !!(D && (Date.now() - (D.ts || 0) < TTL)); }
  function isActive() { return _draftFresh(); }
  function clear() { D = null; }
  function _touch() { if (D) D.ts = Date.now(); }
  function _AI() { return window.AssistantIntent || null; }

  function rememberCustomer(c) {
    if (c && c.id != null) L = { customer: { id: c.id, name: c.name || '고객' }, ts: Date.now() };
  }
  function lastCustomer() {
    return (L && (Date.now() - (L.ts || 0) < LAST_TTL)) ? L.customer : null;
  }

  // draft 무장/갱신. opts: { mode, customer, dateBase }
  function arm(opts) {
    opts = opts || {};
    if (!_draftFresh()) D = { mode: 'add', customer: null, dateBase: null, time: null, service: '', ts: Date.now() };
    D.ts = Date.now();
    if (opts.mode) D.mode = opts.mode;
    if (opts.customer && opts.customer.id != null) { D.customer = { id: opts.customer.id, name: opts.customer.name || '고객' }; rememberCustomer(D.customer); }
    if (opts.dateBase instanceof Date) D.dateBase = opts.dateBase;
    return D;
  }

  function _tomorrow() { var d = new Date(); d.setDate(d.getDate() + 1); d.setHours(0, 0, 0, 0); return d; }
  function _dateLabel(d) {
    if (!(d instanceof Date)) return '';
    var t = new Date(); t.setHours(0, 0, 0, 0);
    var x = new Date(d); x.setHours(0, 0, 0, 0);
    var diff = Math.round((x - t) / 86400000);
    if (diff === 0) return '오늘';
    if (diff === 1) return '내일';
    if (diff === 2) return '모레';
    return (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
  }

  function _shopTreatments() {
    try { var st = localStorage.getItem('shop_type') || ''; var cfg = (window.SHOP_CONFIG && window.SHOP_CONFIG[st]) || null; return (cfg && cfg.treatments) || []; }
    catch (_e) { return []; }
  }

  // 고객명 후보 추출 — 예약/날짜/시간/동사·시술명 제거 후 한글 2~5자.
  function _extractName(q) {
    var s = _trim(q)
      .replace(/(오늘|내일|모레|예약|시간|오전|오후|저녁|아침|새벽|점심|밤|추가|등록|잡아줘|잡아|잡기|잡|넣어줘|넣어|만들어줘|만들어|해줘|해|취소|변경|바꿔|손님|고객|님|좀|부탁|이|그|저|새)/g, ' ')
      .replace(/\d{1,2}\s*:\s*\d{2}|\d+\s*시\s*(\d+\s*분)?|\d+\s*월\s*\d+\s*일|\d{1,2}\/\d{1,2}/g, ' ');
    _shopTreatments().forEach(function (sv) { if (sv) s = s.split(sv).join(' '); });
    var m = s.match(/[가-힣]{2,5}/);
    return m ? m[0] : '';
  }

  // 진행 중 draft 에서 다른 도메인(취소/변경·매출·사진·문자)으로 명확히 벗어나면 양보(null) → 기존 라우팅이 처리.
  function _yieldsToOther(q) {
    if (/(취소|삭제|지워|없애|캔슬|시간\s*바꿔|시간\s*변경|예약\s*변경|복구|되돌)/.test(q)) return true;
    if (/(매출|정산|얼마\s*(벌|썼))/.test(q)) return true;
    if (/(누끼|배경\s*(지워|바꿔)|보정|캡션|홍보\s*글|템플릿|사진\s*편집)/.test(q)) return true;
    return false;
  }

  // 진행 중 draft 에 텍스트 1건 반영 → 메시지 객체 | { __card } | null(양보).
  async function tryDraft(q) {
    if (!isActive()) return null;
    q = _trim(q);
    _touch();
    // 그만두기
    if (/^(취소|그만|아니|아니요|관둬|안\s*할래|안할래|됐어|예약\s*안\s*할)/.test(q)) { clear(); return { text: '예약 잡기를 멈췄어요. 다른 것도 도와드릴게요 🙂' }; }
    // 다른 도메인으로 명확히 전환 → 양보(draft 종료)
    if (_yieldsToOther(q)) { clear(); return null; }
    var AI = _AI();
    if (!AI || !AI.composeBooking) return null;

    // 슬롯 병합
    try {
      var db = AI.resolveDateBase && AI.resolveDateBase(q);
      if (db instanceof Date) D.dateBase = db;
      var tm = AI.resolveTime && AI.resolveTime(q);
      if (tm && (tm.concrete || tm.period)) D.time = tm;
      var svc = AI.extractService && AI.extractService(q);
      if (svc && q.indexOf(svc) >= 0) D.service = svc;   // 발화에 실제 시술명이 있을 때만(기본값 폴백 무시)
    } catch (_e) { void _e; }

    // 고객 미정 → 이름 확정(직전 고객 폴백)
    if (!D.customer) {
      var name = _extractName(q);
      if (name && AI.resolveCustomer) {
        var rc = await AI.resolveCustomer(name);
        if (rc && rc.askText) return { text: rc.askText };
        if (rc && rc.customer) { D.customer = rc.customer; rememberCustomer(D.customer); }
        else if (rc && rc.none) return { text: name + '님을 못 찾았어요. 이름을 다시 확인해 주시거나, 새 고객이면 고객 추가 후 예약해 주세요.', related: ['취소'] };
      }
      if (!D.customer) {
        var lc = lastCustomer();
        if (lc) { D.customer = lc; }
        else return { text: '어느 고객 예약을 잡을까요? 고객 이름을 알려주세요. (그만하려면 "취소")', related: ['취소'] };
      }
    }

    // 시간 미정 → 같은 context 유지하고 다시 질문
    if (!(D.time && D.time.concrete)) {
      var label = _dateLabel(D.dateBase || _tomorrow());
      var askSvc = /(시술|메뉴).*(뭐|무엇|뭔|어떤|있|종류)|뭐\s*있/.test(q);
      var ts = _shopTreatments();
      if (askSvc && ts.length) {
        return { text: D.customer.name + '님 ' + label + ' 몇 시에 예약할까요? 시술은 말씀하시는 대로 잡아드려요. 예: ' + ts.slice(0, 6).join(', '), related: ts.slice(0, 4) };
      }
      var ex = (D.service ? D.service : (ts[0] || '붙임머리'));
      return { text: D.customer.name + '님 ' + label + ' 몇 시에, 어떤 시술로 예약할까요? (예: "오후 2시 ' + ex + '")' };
    }

    // 고객 + 시간 확정 → 카드(날짜 없으면 내일 기본)
    var base = D.dateBase || _tomorrow();
    var res = await AI.composeBooking(D.customer, { dateBase: base, time: D.time, service: D.service }, 'booking_draft');
    if (res && res.kind === 'card') { var c = D.customer; clear(); rememberCustomer(c); res.__draftCustomer = c; return { __card: res }; }
    // 충돌/빈시간 추천 — 시간을 다시 받아야 함(고객/날짜 유지).
    D.time = null;
    return { text: (res && res.text) || (D.customer.name + '님 몇 시에 예약할까요?') };
  }

  window.ItbiBookingDraft = { isActive: isActive, arm: arm, clear: clear, tryDraft: tryDraft, rememberCustomer: rememberCustomer, lastCustomer: lastCustomer };
})();
