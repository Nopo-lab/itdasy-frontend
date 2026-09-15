/*
 * work-memory-policy.js — 작업 기억 안전 정책
 *
 * 저장·선택·미리보기 경로가 같은 안전 기준을 쓰도록 작은 정책 모듈로 분리한다.
 * 업종은 문자열을 넓게 추측하지 않고, 등록 시술/명시된 문맥에서만 결정한다.
 */
(function () {
  'use strict';
  if (window.WorkMemoryPolicy) return;

  var VERSION = 'wm-consent-1';
  var INDUSTRIES = ['붙임머리', '헤어', '네일', '속눈썹', '눈썹', '왁싱', '피부관리', '메이크업', '기타', 'unknown'];
  var OCCASIONS = ['완성샷', '전후사진', '이벤트', '예약유도', '후기', '리터치', '공지', 'unknown'];
  var ALIASES = {
    '붙임머리': '붙임머리', '연장': '붙임머리', '헤어': '헤어', '커트': '헤어', '펌': '헤어', '염색': '헤어',
    '네일': '네일', '젤네일': '네일', '속눈썹': '속눈썹', '래쉬': '속눈썹', '눈썹': '눈썹',
    '왁싱': '왁싱', '피부': '피부관리', '피부관리': '피부관리', '메이크업': '메이크업'
  };
  function clean(v) { return String(v == null ? '' : v).trim(); }
  function industry(v) {
    var s = clean(v); if (INDUSTRIES.indexOf(s) >= 0) return s;
    return ALIASES[s] || 'unknown';
  }
  function occasion(v, kind, hasBeforeAfter) {
    var s = clean(v); if (OCCASIONS.indexOf(s) >= 0 && s !== 'unknown') return s;
    if (hasBeforeAfter) return '전후사진';
    if (kind === 'promotion') return '이벤트';
    if (kind === 'notice') return '공지';
    if (kind === 'service') return '완성샷';
    return 'unknown';
  }
  function context(input) {
    input = input || {};
    var kind = clean(input.kind);
    return {
      industry: industry(input.industry || input.serviceIndustry || input.service),
      occasion: occasion(input.occasion || input.photoOccasion, kind, !!input.hasBeforeAfter),
      accountId: clean(input.accountId || input.ownerId || input.tenantId) || null
    };
  }
  function isLegacy(rec) {
    return !rec || rec.consentVersion !== VERSION || !rec.industry || !rec.occasion || rec.industry === 'unknown' || rec.occasion === 'unknown';
  }
  function sameAccount(rec, ctx) {
    return !!(rec && rec.ownerId && ctx && ctx.accountId && String(rec.ownerId) === String(ctx.accountId));
  }
  function sameContext(rec, ctx) {
    return !isLegacy(rec) && sameAccount(rec, ctx) && rec.industry === ctx.industry && rec.occasion === ctx.occasion;
  }
  function canAutoApply(rec, input) {
    var ctx = context(input);
    return !!(rec && rec.autoApplyAllowed === true && !isLegacy(rec) && ctx.industry !== 'unknown' && sameContext(rec, ctx));
  }
  function canRecommend(rec, input) {
    var ctx = context(input);
    return !!(rec && !isLegacy(rec) && ctx.industry !== 'unknown' && sameContext(rec, ctx));
  }
  function metadata(input, consent) {
    var ctx = context(input);
    return {
      industry: ctx.industry,
      occasion: ctx.occasion,
      consentVersion: consent ? VERSION : null,
      autoApplyAllowed: false,
      createdFrom: clean(input && input.createdFrom) || 'workspace-save',
      ownerId: ctx.accountId
    };
  }
  window.WorkMemoryPolicy = {
    VERSION: VERSION, INDUSTRIES: INDUSTRIES, OCCASIONS: OCCASIONS,
    context: context, metadata: metadata, isLegacy: isLegacy,
    sameAccount: sameAccount, sameContext: sameContext, canRecommend: canRecommend, canAutoApply: canAutoApply,
    industry: industry, occasion: occasion
  };
})();
