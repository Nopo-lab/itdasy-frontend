/* 잇비 마케팅 초안 공통 정책 (J-5 · 2026-06-01)

   리터치/재방문/안부/후기/캡션/사진메모/빈시간/이벤트 초안의 톤·금지어·안전 라벨·발송안함 문구를 한 곳으로 통일.
   새 LLM/백엔드 0 — 기존 draft_message·caption 출력을 공통 정책으로 정렬(sanitize/normalize)만.

   재사용처: photo-mode-support(캡션) · customer-status-card(초안 프롬프트) · daily-briefing(추천 문구) · app-assistant(draft 표시 sanitize).
   안전: 실제 발송/게시/예약/저장 자동 실행 0. 이 모듈은 문자열 생성/정리만 한다. */
(function () {
  'use strict';
  if (window.ItdasyMarketingDraftPolicy) return;

  // 초안 타입
  var TYPES = ['retouch_offer', 'rebook_nudge', 'warm_checkin', 'review_request',
    'promo_caption', 'photo_record_note', 'empty_slot_fill', 'event_notice'];

  // 금지어/과장어 → 안전 표현. (의료·효과보장·과장 차단)
  var FORBIDDEN = [
    [/잡티\s*(제거|없애|없앰|없앰)/g, '잡티가 덜 도드라지게 정리'],
    [/여드름\s*(제거|완치|치료)/g, '트러블이 자연스럽게 완화되어 보이게'],
    [/트러블\s*커버/g, '트러블이 자연스럽게 완화되어 보이게'],
    [/탈모\s*치료/g, '두피·모발 관리'],
    [/모발\s*재생/g, '모발 손질감 관리'],
    [/피부\s*질환\s*개선|피부질환/g, '피부 정돈'],
    [/의학적\s*개선|의학적/g, '자연스러운'],
    [/효과\s*보장|효과보장/g, '자연스러운 변화'],
    [/부작용\s*없(음|이|어요)?/g, '편안하게'],
    [/즉시\s*완치|완치/g, '정돈'],
    [/전부\s*사라짐|완전\s*제거|완전히|완전\b/g, '깔끔하게 정리'],
    [/확실히\s*좋아(짐|져요|져)?/g, '한결 정돈된 느낌'],
    [/100\s*%|백\s*퍼(센트)?|무조건/g, '자연스럽게'],
    [/영구적|영구/g, '오래 유지되도록'],
    [/치료/g, '관리'],
  ];

  function sanitize(text) {
    var t = String(text == null ? '' : text);
    for (var i = 0; i < FORBIDDEN.length; i++) t = t.replace(FORBIDDEN[i][0], FORBIDDEN[i][1]);
    return t;
  }
  // QA용 — 금지어가 남아있는지(원문 기준). 대체 후엔 false 여야 함.
  function hasForbidden(text) {
    var raw = String(text == null ? '' : text);
    return /잡티\s*(제거|없애|없앰)|여드름\s*(제거|완치)|탈모\s*치료|모발\s*재생|피부질환|의학적|효과\s*보장|부작용\s*없|완치|완전\s*제거|확실히\s*좋아|100\s*%|무조건|영구|치료/.test(raw);
  }

  var CONTACT = { retouch_offer: 1, rebook_nudge: 1, warm_checkin: 1, review_request: 1, empty_slot_fill: 1, event_notice: 1 };
  function safetyNote(type) {
    if (type === 'promo_caption') return '게시용 초안이에요. 실제 게시는 하지 않았어요.';
    if (type === 'photo_record_note') return '기록용 메모 초안이에요. 자동 저장은 하지 않았어요.';
    if (CONTACT[type]) return '초안만 만들었어요. 실제 발송은 하지 않았어요.';
    return '초안만 만들었어요.';
  }

  // 업종별 안전 캡션(사진편집 모드 재사용). recipeId = 사진 보정 성격.
  var CAPTION = {
    nail_focus: '은은한 광택감과 손끝 라인이 살아나는 깔끔한 네일 디자인이에요. 부담스럽지 않게 포인트를 주고 싶은 분들께 추천드려요.',
    hair_focus: '머릿결의 윤기와 스타일 라인을 자연스럽게 살린 시술 사진이에요. 분위기 전환을 원하시는 분들께 잘 어울리는 스타일입니다.',
    lash_focus: '눈매가 또렷해 보이도록 자연스러운 컬감을 살린 시술이에요. 과하지 않은 변화를 원하시는 분들께 추천드려요.',
    natural: '피부결과 톤이 편안해 보이도록 자연스럽게 정리한 관리 사진이에요. 부담 없이 관리받고 싶은 분들께 어울려요.',
    glam: '포인트는 또렷하게, 전체는 자연스럽게 살린 메이크업 사진이에요. 특별한 날 분위기를 더하고 싶은 분들께 추천드려요.',
    brow_focus: '눈썹 라인을 또렷하면서도 자연스럽게 정리한 시술 사진이에요. 인상을 부드럽게 다듬고 싶은 분들께 어울려요.',
    lip_focus: '입술 발색을 생기 있게 살린 시술 사진이에요. 화사한 분위기를 원하시는 분들께 추천드려요.',
  };
  var DEFAULT_CAPTION = '시술 결과가 잘 보이도록 자연스럽게 정리한 사진이에요. 편하게 둘러보고 마음에 드시면 예약 문의 주세요.';
  function caption(recipeId) { return sanitize(CAPTION[recipeId] || DEFAULT_CAPTION); }

  // 업종 톤 키워드(참고/QA).
  var TONE = {
    nail: ['손끝', '광택', '컬러감', '라인', '깔끔한 마무리', '유지 관리'],
    hair: ['윤기', '결', '볼륨감', '라인', '손질감', '스타일 유지'],
    lash: ['눈매', '또렷함', '자연스러운 라인', '정돈감'],
    skin: ['피부결', '톤', '칙칙함 완화', '편안한 인상', '자연스러운 정돈'],
    makeup: ['분위기', '발색', '균형', '자연스러운 포인트'],
  };
  function toneGuide(industry) { return TONE[industry] || []; }

  // 고객 연락 초안 프롬프트(기존 draft_message 경로로 전송할 문장 — 검증된 표현으로 통일).
  function chatSuggest(type, ctx) {
    var nm = (ctx && ctx.name) ? (ctx.name + '님 ') : '';
    switch (type) {
      case 'retouch_offer': return nm + '리터치 안내 문구 만들어줘';
      case 'rebook_nudge': return nm + '재방문 안내 문구 만들어줘';
      case 'warm_checkin': return nm + '안부 문구 만들어줘';
      case 'review_request': return nm + '후기 요청 문구 만들어줘';
      case 'empty_slot_fill': return '빈 시간에 단골 안내 문구 만들어줘';
      case 'event_notice': return '이벤트 안내 문구 만들어줘';
      default: return nm + '안내 문구 만들어줘';
    }
  }

  // 타입별 기본 안전 템플릿(백엔드 draft 없을 때 폴백/QA용). 전부 sanitize 적용·과장 0.
  function template(type, ctx) {
    var nm = (ctx && ctx.name) || '고객';
    var svc = (ctx && ctx.service) ? ctx.service : '';
    var T = {
      retouch_offer: nm + '님, 지난 ' + (svc || '시술') + ' 잘 유지되고 계신가요? 슬슬 정돈하기 좋은 시기예요. 편하실 때 한 번 방문 어떠세요?',
      rebook_nudge: nm + '님, 오랜만이에요. 다음 관리 생각 있으시면 편한 시간에 가볍게 들러 주세요.',
      warm_checkin: nm + '님, 잘 지내시죠? 안부차 인사드려요. 필요하실 때 언제든 편하게 연락 주세요.',
      review_request: nm + '님, 지난 방문은 어떠셨어요? 괜찮으셨다면 짧은 후기 한 줄 남겨주시면 큰 힘이 돼요. (부담 없이 편하게요)',
      empty_slot_fill: '이번 주 비어 있는 시간이 있어요. 가볍게 관리 받고 싶으셨다면 편한 시간에 들러 주세요.',
      event_notice: '이번에 작은 이벤트를 준비했어요. 관심 있으시면 편하게 문의 주세요.',
      photo_record_note: (svc || '시술') + ' 기록용 메모',
      promo_caption: DEFAULT_CAPTION,
    };
    return sanitize(T[type] || (nm + '님께 보낼 안내 초안이에요.'));
  }

  window.ItdasyMarketingDraftPolicy = {
    TYPES, sanitize, hasForbidden, safetyNote, caption, toneGuide, chatSuggest, template,
  };
})();
