/* 잇비 템플릿 자동 적용 — I3a 후기 카드 (2026-06-08)

   목표: "고객 후기 카드 만들어줘" 류 요청을 받으면 실제 사진편집기 상태에
        v3-review-card 를 적용하고 slotValues 를 채워(문구 편집 시트까지 열어) 사용자가
        문구 편집/저장/인스타 미리보기로 이어가게 한다. (I2b/I2c 가격표 흐름 미러)

   원칙(엄수):
   - 오프스크린 renderHook 합성 안 함. 실제 편집기 캔버스가 단일 진실원.
   - PhotoEditorTemplatesV2.apply() 시그니처 변경 안 함 → apply 후 state.tplV2 patch.
   - premium-templates / ba-compose / edit-sheet / S4 / onSave / IndexedDB 미수정(호출만).
   - dataURL 은 편집기 state/imageSlots 범위에서만. 채팅 history 에 큰 dataURL 미저장.
   - 자동 저장/업로드/게시 0. 실패해도 throw 0(null 반환).
*/
(function () {
  'use strict';
  if (window.ItdasyTemplateAutoApply) return;

  var REVIEW_TPL_ID = 'v3-review-card';

  // 후기 의도: (후기|리뷰) + 만들기류, 단 메시지/DM 명령은 제외.
  var TRIGGER = /(후기|리뷰|review)/i;
  var CREATE = /(카드|만들|제작|뽑|생성|해\s*줘|해줘|넣어)/;
  var MSG_SIG = /(문자|dm|디엠|메시지|카톡|발송|보내)/i;

  function detectReviewCard(text) {
    var t = String(text || '').trim();
    if (!t || MSG_SIG.test(t)) return false;
    return TRIGGER.test(t) && CREATE.test(t);
  }

  // 텍스트에서 시술명 추정(규칙 기반). 없으면 ''.
  function _serviceName(t) {
    t = String(t || '');
    if (/(네일|손톱|젤네일|패디|발톱)/.test(t)) return '네일';
    if (/(헤어|머리|모발|펌|염색|컬러|붙임머리)/.test(t)) return '헤어';
    if (/(속눈썹|래쉬|연장)/.test(t)) return '속눈썹';
    if (/(피부|잡티|모공|결|톤|관리)/.test(t)) return '피부 관리';
    if (/(눈썹|반영구)/.test(t)) return '눈썹';
    if (/(메이크업|화장|글램)/.test(t)) return '메이크업';
    if (/(왁싱|제모)/.test(t)) return '왁싱';
    return '';
  }

  function _today() {
    try {
      var d = new Date();
      var p = function (n) { return (n < 10 ? '0' : '') + n; };
      return d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate());
    } catch (_e) { return ''; }
  }

  // 사용자가 따옴표로 후기를 직접 준 경우만 추출(자연어 고도화는 I3d). 없으면 ''.
  function _extractReview(t) {
    var m = String(t || '').match(/["“'`']([^"”'`']{4,120})["”'`']/);
    return (m && m[1]) ? m[1].trim() : '';
  }

  // getDefaultValues 결과 위에 review 필드 override(가격표 _injectPriceSlotValues 미러).
  function buildReviewSlotValues(base, ctx, text) {
    var next = Object.assign({}, base || {});
    var cust = ctx && ctx.currentCustomer;
    next.headline = '고객님의 진심 후기';
    next.subtitle = '시술 후 남겨주신 소중한 후기';
    next.review_text = _extractReview(text)
      || '믿고 맡겼는데 결과가 너무 마음에 들어요. 디테일까지 꼼꼼하게 봐주셔서 다음에도 꼭 다시 올게요!';
    next.customer_label = (cust && cust.name) ? (cust.name + '님') : '고객님';
    next.cta = '예약 문의 주세요';
    next.service_name = _serviceName(text) || next.service_name || '';
    next.date = _today() || next.date || '';
    return next;
  }

  // 사진이 없을 때만 쓰는 단색 베이스(편집기 캔버스가 보이게 — review 렌더가 bg 를 덮음).
  //   오프스크린 "합성"이 아니라 빈 베이스 1장일 뿐. history 미저장.
  function _solidBase() {
    try {
      var c = document.createElement('canvas');
      c.width = 1080; c.height = 1350;
      var g = c.getContext('2d');
      g.fillStyle = '#FBEFEF'; g.fillRect(0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.85);
    } catch (_e) { return ''; }
  }

  // 후기 카드 자동 적용 본체. 성공 시 완료 카드용 요약(payload, dataURL 없음) 반환, 실패 시 null.
  function handleReviewCard(text, ctx) {
    var PE = window.PhotoEditor;
    var TV = window.PhotoEditorTemplatesV2;
    if (!PE || !PE.open || !PE._internal || !TV || typeof TV.apply !== 'function') return null;

    var SI = window.ItdasySourceImage;
    var src = (SI && typeof SI.resolve === 'function') ? SI.resolve() : null;
    var photoUrl = (src && src.dataUrl) ? src.dataUrl : '';
    var hadPhoto = !!photoUrl;
    if (!photoUrl) photoUrl = _solidBase();   // 텍스트형 후기 카드(사진 없을 때)
    if (!photoUrl) return null;               // 베이스조차 못 만들면 조용히 실패

    PE.open({ src: photoUrl, initial_tab: 'template' });
    TV.apply(REVIEW_TPL_ID);

    var state = (PE._internal.getState && PE._internal.getState()) || null;
    if (!state || !state.tplV2) return null;

    state.tplV2.slotValues = buildReviewSlotValues(state.tplV2.slotValues, ctx, text);
    if (hadPhoto && state.tplV2.imageSlots && state.tplV2.imageSlots.main_photo) {
      state.tplV2.imageSlots.main_photo.src = photoUrl;
    }

    var helpers = PE._internal.helpers || {};
    if (helpers.renderPanel) { try { helpers.renderPanel(); } catch (_e) { void _e; } }
    if (helpers.scheduleRedraw) { try { helpers.scheduleRedraw(); } catch (_e) { void _e; } }
    if (helpers.pushHistory) { try { helpers.pushHistory(); } catch (_e) { void _e; } }

    // 문구 편집 시트(호출만 — edit-sheet 내부 미수정).
    try {
      var ES = window.PhotoEditorTemplateEditSheet;
      var tpl = null;
      try { tpl = (TV.TEMPLATES || []).find(function (t) { return t && t.id === REVIEW_TPL_ID; }) || null; } catch (_e2) { tpl = null; }
      if (ES && typeof ES.open === 'function') {
        ES.open({ templateId: REVIEW_TPL_ID, templateData: tpl, state: state, helpers: helpers, onChange: function () {} });
      }
    } catch (_e3) { void _e3; }

    var sv = state.tplV2.slotValues || {};
    return {
      templateId: REVIEW_TPL_ID,
      templateLabel: '후기 인용 카드',
      reviewExcerpt: String(sv.review_text || '').slice(0, 40),
      customerLabel: sv.customer_label || '고객님',
      hadPhoto: hadPhoto,
    };
  }

  window.ItdasyTemplateAutoApply = {
    detectReviewCard: detectReviewCard,
    buildReviewSlotValues: buildReviewSlotValues,
    handleReviewCard: handleReviewCard,
  };
})();
