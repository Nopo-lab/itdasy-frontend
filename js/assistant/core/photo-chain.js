/* 잇비 홍보용 사진 체인 (J-2 MVP · 2026-06-01)

   "이 사진 홍보용으로 예쁘게 해줘 / 인스타 올릴 느낌으로 / 시술 사진 홍보용으로 정리해줘" →
     사진 보정(기존 v369~v371 경로 재사용) → 캡션 초안 → 템플릿 추천 → Action Hub 버튼.

   원칙: 새 보정 엔진/로직 0. 기존 재사용만.
   - 보정: window.ItdasyPhotoFlow.runPromoFlow (업종 판단 + 보정 적용 + 저장 pending 까지)
   - 버튼: window.ItdasyActionHub (phase safe/confirm/danger)
   - 저장: 자동 저장 X. confirm/pending(저장해줘) 경로로만. 게시/발송 0. */
(function () {
  'use strict';
  if (window.ItdasyPromoPhotoChain) return;

  // 업종/목적별 안전 캡션 초안(의료·효과보장·과장 금지). recipeId = photo-flow 가 고른 레시피.
  var CAPTION = {
    nail_focus: '은은한 광택감과 손끝 라인이 살아나는 깔끔한 네일 디자인이에요. 부담스럽지 않게 포인트를 주고 싶은 분들께 추천드려요.',
    hair_focus: '머릿결의 윤기와 스타일 라인을 자연스럽게 살린 시술 사진이에요. 분위기 전환을 원하시는 분들께 잘 어울리는 스타일입니다.',
    lash_focus: '눈매가 또렷해 보이도록 자연스러운 컬감을 살린 시술이에요. 과하지 않은 변화를 원하시는 분들께 추천드려요.',
    natural: '피부결과 톤이 편안해 보이도록 자연스럽게 정리한 관리 사진이에요. 부담 없이 관리받고 싶은 분들께 어울려요.',
    glam: '포인트는 또렷하게, 전체는 자연스럽게 살린 메이크업 사진이에요. 특별한 날 분위기를 더하고 싶은 분들께 추천드려요.',
    brow_focus: '눈썹 라인을 또렷하면서도 자연스럽게 정리한 시술 사진이에요. 인상을 부드럽게 다듬고 싶은 분들께 어울려요.',
    lip_focus: '입술 발색을 생기 있게 살린 시술 사진이에요. 화사한 분위기를 원하시는 분들께 추천드려요.',
  };
  var EFFECT = {
    nail_focus: '네일 광택과 손끝 라인을 자연스럽게 살리고, 인스타 피드에 쓰기 좋게 정리했어요.',
    hair_focus: '머릿결 윤기와 스타일 라인을 살리고, 홍보에 쓰기 좋게 정리했어요.',
    lash_focus: '눈매와 컬감을 또렷하게 살리고, 홍보에 쓰기 좋게 정리했어요.',
    natural: '피부결과 톤을 편안하게 정리하고, 홍보에 쓰기 좋게 다듬었어요.',
    glam: '메이크업 포인트를 화사하게 살리고, 홍보에 쓰기 좋게 정리했어요.',
    brow_focus: '눈썹 라인을 또렷하게 정리하고, 홍보에 쓰기 좋게 다듬었어요.',
    lip_focus: '입술 발색을 생기 있게 살리고, 홍보에 쓰기 좋게 정리했어요.',
  };
  var DEFAULT_CAPTION = '시술 결과가 잘 보이도록 자연스럽게 정리한 사진이에요. 편하게 둘러보고 마음에 드시면 예약 문의 주세요.';
  var DEFAULT_EFFECT = '핵심 포인트를 자연스럽게 살리고, 홍보에 쓰기 좋게 정리했어요.';

  function detectPromoPhotoChain(text, _ctx) {
    return !!(window.ItdasyPhotoFlow && typeof window.ItdasyPhotoFlow.detectPhotoFlowIntent === 'function'
      && window.ItdasyPhotoFlow.detectPhotoFlowIntent(text));
  }

  // [CF-4] 내보내기/게시 준비 이미지는 photo-chain 이 고정 캡처하지 않고, 클릭 시점에 action-hub 가 라이브 재캡처.

  function buildPromoCaptionDraft(recipeId) {
    // [J-5] 공통 마케팅 정책으로 캡션 톤·금지어 통일. 모듈 없으면 로컬 폴백.
    var P = window.ItdasyMarketingDraftPolicy;
    if (P && typeof P.caption === 'function') return P.caption(recipeId);
    return CAPTION[recipeId] || DEFAULT_CAPTION;
  }

  function buildPromoTemplateSuggestion(_recipeId) {
    return '바로 쓸 만한 템플릿 3개를 골라봤어요. 카드를 눌러 미리보고 적용하세요.';
  }

  // [TPL-3] 업종/목적 기반 추천 템플릿 3개 id. market-data.recommendTemplates 위임.
  function buildPromoTemplateRecos(text, ctx) {
    try {
      var MD = window.PhotoEditorTemplateMarketData;
      if (MD && typeof MD.recommendTemplates === 'function') {
        return MD.recommendTemplates(text, ctx, 3).map(function (t) { return t.id; });
      }
    } catch (_e) { void 0; }
    return [];
  }

  // Action Hub 버튼: 템플릿보기·인스타 미리보기·캡션복사·내보내기(safe) + 고객기록저장(confirm, 보조).
  //   [TPL-3] '템플릿 보기'에 추천 id 전달. [CF-3] 인스타 미리보기(게시 준비, 실게시 아님) 추가.
  //   [CF-4] export/instagram dataUrl 은 payload 고정 안 함 — 클릭 시점에 action-hub 가 라이브 캔버스 재캡처.
  function buildPromoActions(ctx, recipeId, caption, recoIds) {
    var cust = ctx && ctx.currentCustomer;
    var acts = [
      { id: 'pe_template', kind: 'open_template_panel', label: '템플릿 보기', phase: 'safe', payload: { recommendedIds: recoIds || [] } },
      { id: 'ig_preview', kind: 'open_instagram', label: '인스타 미리보기', phase: 'safe', payload: { caption: caption } },
      { id: 'copy_caption', kind: 'copy_caption', label: '캡션 복사', phase: 'safe', payload: { caption: caption } },
      { id: 'export', kind: 'export_image', label: '내보내기', phase: 'safe', payload: {} },
      { id: 'save_customer', kind: 'save_photo_to_customer', label: '고객기록에 저장', phase: 'confirm',
        payload: { customerName: (cust && cust.name) || '' } },
    ];
    return (window.ItdasyActionHub && window.ItdasyActionHub.normalizeActions)
      ? window.ItdasyActionHub.normalizeActions(acts, 'hub') : acts;
  }

  // 메인: 보정 + 캡션 + 템플릿 + 버튼. 채팅 푸시는 호출측(app-assistant).
  function runPromoPhotoChain(text, ctx) {
    ctx = ctx || (window.ItdasyAssistantContext && window.ItdasyAssistantContext.collect()) || {};
    if (!(window.ItdasyPhotoFlow && typeof window.ItdasyPhotoFlow.runPromoFlow === 'function')) {
      return { ok: false, message: '사진 홍보 모듈을 불러오는 중이에요. 잠시 후 다시 시도해 주세요.' };
    }
    // 보정 적용 + 업종 판단 + 저장 pending (기존 T-104/T-104.5 흐름 그대로)
    var res = window.ItdasyPhotoFlow.runPromoFlow(text, ctx) || {};
    if (res.needsPhoto) {
      // [CF-1] 안내만 하지 말고 "사진 열기" 다음 행동 버튼 제공.
      var openActs = (window.ItdasyActionHub && window.ItdasyActionHub.normalizeActions)
        ? window.ItdasyActionHub.normalizeActions([{ id: 'open_pe', kind: 'open_photo_editor', label: '사진 열기', phase: 'safe', payload: {} }], 'hub')
        : [{ id: 'open_pe', kind: 'open_photo_editor', label: '사진 열기', phase: 'safe', payload: {} }];
      return { ok: false, needsPhoto: true,
        message: '먼저 편집할 사진을 열어주세요. 사진을 열면 홍보용 보정, 캡션, 템플릿 추천까지 이어서 도와드릴게요.',
        hubActions: openActs };
    }
    var recipeId = res.recipeId || 'natural';
    var caption = buildPromoCaptionDraft(recipeId);
    var effect = res.ok ? (EFFECT[recipeId] || DEFAULT_EFFECT) : '보정 적용 중 일부 문제가 있어 편집기에서 직접 조정할 수 있어요.';
    var recoIds = buildPromoTemplateRecos(text, ctx);   // [TPL-3] 추천 템플릿 3개
    var msg = '홍보용으로 보정했어요.\n' + effect
      + '\n\n캡션 초안:\n"' + caption + '"'
      + '\n\n' + buildPromoTemplateSuggestion(recipeId)
      + '\n\n실제 게시나 발송은 하지 않았어요.';
    return { ok: !!res.ok, recipeId: recipeId, caption: caption, message: msg,
      templateRecos: recoIds, hubActions: buildPromoActions(ctx, recipeId, caption, recoIds) };
  }

  window.ItdasyPromoPhotoChain = {
    detectPromoPhotoChain, runPromoPhotoChain, buildPromoTemplateRecos,
    buildPromoCaptionDraft, buildPromoTemplateSuggestion, buildPromoActions,
  };
})();
