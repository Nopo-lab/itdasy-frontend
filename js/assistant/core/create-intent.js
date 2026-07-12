/* 잇비 "카드 만들어줘" 경량 create-intent 폴백 — FE 가로채기 (2026-06-12)

   문제(QA 퍼징): "가격표 만들어줘 / 후기 카드 만들어줘 / 이벤트 카드 만들어줘"처럼
     업종 키워드가 없는 생성문은 template-sample-matcher 의 점수 임계치(MIN_SCORE)를 못 넘어
     null → 백엔드 LLM 으로 새버렸다(= 작업실/템플릿으로 안 이어짐).
   해결: 매처/가격표/후기/전후 샷컷이 모두 실패한 뒤(=업종 없는 bare 생성), 백엔드 전송 직전에
     이 폴백이 가로채 '목적(purpose)'만 판별해 해당 템플릿 편집/피커로 연결한다.
     매처는 손대지 않는다(업종 있으면 앞단 매처가 이미 처리). 목적만 결정론적으로 매핑.

   분류 안전(엄수):
     - 명확한 '생성' 동사(만들/제작/뽑아/디자인해)가 있을 때만.
     - 조회/수정/메모/사진·발송/예약·고객·매출 은 절대 create 로 안 잡음(앞단에서 이미 가로채지만 이중 가드).
     - 목적 명사(가격표/후기/전후/이벤트/카드)가 있어야 함. "만들어줘" 단독(목적 불명)은 null → 기존 흐름.

   외부: window.ItbiCreateIntent = { classify } */
(function () {
  'use strict';
  if (window.ItbiCreateIntent) return;

  // 명확한 생성 동사.
  var CREATE_RE = /(만들|맹글|제작|뽑아|뽑아줘|디자인\s*해|새로\s*만|하나\s*만들|만들어|제작해|만들자|만들래|하자|해보자)/;
  // [P1-3] 축약 생성 신호 — '목적명사'와 함께일 때만 생성으로 본다(단독 "ㄱ"/"하나"는 목적명사 없어 null).
  //   "가격표 ㄱ", "후기 하나", "이벤트 ㄱㄱ" 처럼 원장님 최빈 축약. 조회/수정/저장 동사가 섞이면 NOT_CREATE 가 먼저 차단.
  var SHORT_CREATE_RE = /(하나|한\s*개|두\s*개|(^|\s)ㄱㄱ?($|\s)|뚝딱)/;
  // 생성이 아닌 신호(조회/수정/메모/사진·발송) — 하나라도 있으면 create 아님.
  var NOT_CREATE_RE = /(보여|보고\s*싶|열어|열어봐|다시|목록|꺼내|찾아|수정|편집|고쳐|고치|바꿔|바꾸|기억|메모|잊어|삭제|지워|저장|보관|올려|업로드|인스타|게시|누끼|보정|캡션|전송|발송|문자|공유|보내)/;
  // 타도메인(예약/고객/매출…) 생성 = 디자인 카드 아님 → 양보(예약 카드 만들기 등은 예약 플로우/백엔드).
  var DOMAIN_RE = /(예약|고객|손님|매출|회원|명단|연락처|예약금|문자|dm|디엠|환불|정산)/i;

  // 목적 매핑(결정론적 — purpose 헷갈림 방지). 우선순위: 전후 > 이벤트 > 후기 > 가격표 > 일반.
  function _purpose(t) {
    if (/(전후|비포\s*애프터|비포애프터|before\s*after|비포\b|애프터\b)/i.test(t)) return 'before_after';
    if (/(이벤트|행사|프로모션|세일|할인|기념|오픈\s*기념)/.test(t)) return 'event';
    if (/(후기|리뷰|review)/i.test(t)) return 'review';
    if (/(가격표|메뉴판|단가표|프라이스|price|가격\s*안내)/i.test(t)) return 'price';
    if (/(카드|템플릿|디자인|홍보물|게시물|버전)/.test(t)) return 'generic';
    if (/(예쁘|고급|깔끔|감성|인스타|고객(님)?(한테|에게)?\s*보낼)/.test(t)) return 'generic';
    return null;
  }

  // 분류: { purpose:'price'|'review'|'before_after'|'event'|'generic' } 또는 null.
  function classify(q) {
    var t = String(q || '').trim();
    if (!t) return null;
    // 목적명사(가격표/후기/전후/이벤트/카드/템플릿…)가 먼저 있어야 함 →
    //   단독 "ㄱ"/"하나"/"그거 하나"(목적명사 없음)는 여기서 null → fallback/문맥으로.
    var purpose = _purpose(t);
    if (!purpose) return null;
    var cardCreate = /(카드|템플릿|게시물|홍보물|버전)/.test(t) && CREATE_RE.test(t);
    var sendVersion = /고객(님)?(한테|에게)?\s*보낼\s*버전/.test(t) && CREATE_RE.test(t);
    if (DOMAIN_RE.test(t) && !sendVersion) return null;     // 고객/예약/매출 카드 → 양보
    // '보여/수정/저장/기억' 등 다른 의도가 섞이면 그쪽 우선(앞단에서 잡히지만 이중 가드).
    if (NOT_CREATE_RE.test(t) && !cardCreate && !sendVersion) return null;
    // 명시 생성동사(만들/뽑아…) 또는 축약 생성신호(하나/ㄱ/ㄱㄱ…)가 있어야 create.
    if (CREATE_RE.test(t) || SHORT_CREATE_RE.test(t)) return { purpose: purpose };
    return null;
  }

  window.ItbiCreateIntent = { classify: classify, purposeOf: _purpose };
})();
