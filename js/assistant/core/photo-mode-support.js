/* 잇비 사진편집 모드 공통 도우미
   옛 photo-chain 의 문구/추천/버튼 조각만 재사용하고, 즉시 실행 흐름은 만들지 않는다. */
(function () {
  'use strict';
  if (window.ItdasyPhotoModeSupport) return;

  var START_RE = /(사진|이미지|포토|촬영본).*(편집|만들|꾸미|시켜|보정|수정|홍보|예쁘|카드|전후|후기|리뷰|인스타|sns|피드|스토리|캡션|문구|해시\s*태그|올릴|게시)|(전후|비포\s*애프터|before\s*after|후기|리뷰)\s*(사진|카드|템플릿)?\s*(만들|해줘|뽑아|꾸며|보정|제작)?/i;
  var CAPTION_RE = /(캡션|홍보\s*글|홍보글|해시\s*태그|문구|인스타\s*(글|피드\s*글)|sns\s*글)/i;
  var BLOCK_RE = /(가격표|메뉴판|문자|디엠|\bdm\b|메시지|메세지|카톡|알림톡|발송)/i;
  // [이슈1] 사진이 함께 올라온 경우, 명사(사진/이미지) 없이도 편집·홍보 의도 동사만으로 사진편집 모드 진입.
  //   "홍보용으로 예쁘게 해줘" 처럼 START_RE 의 명사 조건에 안 걸리던 발화를 photo-mode 로 흡수.
  //   가격표/OCR(영수증·매출) 등은 BLOCK_RE/_uploadPhotos 가드가 먼저 제외하므로 안전.
  var EDIT_RE = /(편집|보정|꾸며|꾸미|예쁘|예쁜|이쁘|홍보|시켜|손질|화사|자연스럽|카드\s*만들|템플릿|전후|비포|후기|리뷰)/i;

  var EFFECT = {
    nail_focus: '손끝 라인과 광택이 사진에서 더 또렷해 보이도록 정리했어요.',
    hair_focus: '머릿결 윤기와 전체 분위기를 자연스럽게 살렸어요.',
    lash_focus: '눈매가 더 또렷해 보이도록 디테일을 정리했어요.',
    natural: '피부결과 톤을 과하지 않게 정리했어요.',
    glam: '입술·눈가 색감이 사진에서 자연스럽게 살아나도록 정리했어요.',
    brow_focus: '눈썹 라인이 사진에서 또렷해 보이도록 정리했어요.',
    lip_focus: '입술 색감이 사진에서 자연스럽게 살아나도록 정리했어요.',
  };
  var INDUSTRY = {
    nail_focus: '네일', hair_focus: '헤어', lash_focus: '속눈썹',
    natural: '피부', glam: '메이크업', brow_focus: '눈썹', lip_focus: '메이크업',
  };

  function isExcluded(text) { return BLOCK_RE.test(String(text || '')); }

  function shouldStart(text, opts) {
    var q = String(text || '').trim();
    if (!q || isExcluded(q)) return false;
    if (opts && opts.hasPhoto && CAPTION_RE.test(q)) return true;
    // [이슈1] 사진 동반 발화는 편집/홍보 동사만으로도 진입(명사 생략 허용).
    if (opts && opts.hasPhoto && EDIT_RE.test(q)) return true;
    return START_RE.test(q);
  }

  function recipeFromText(text, preset) {
    var t = String(text || '');
    if (/(네일|손톱|젤네일|패디)/.test(t) || preset === 'nail') return 'nail_focus';
    if (/(헤어|머리|모발|펌|염색|컬러|붙임머리)/.test(t) || preset === 'hair') return 'hair_focus';
    if (/(속눈썹|래쉬|연장)/.test(t) || preset === 'lash') return 'lash_focus';
    if (/(메이크업|화장|입술|눈가)/.test(t)) return 'glam';
    if (/(눈썹|반영구)/.test(t)) return 'brow_focus';
    return 'natural';
  }

  function buildCaptionDraft(recipeId) {
    var P = window.ItdasyMarketingDraftPolicy;
    if (P && typeof P.caption === 'function') return P.caption(recipeId);
    return '시술 결과가 잘 보이도록 자연스럽게 정리한 사진이에요. 편하게 둘러보고 마음에 드시면 예약 문의 주세요.';
  }

  function buildTemplateRecos(text, ctx) {
    try {
      var MD = window.PhotoEditorTemplateMarketData;
      if (MD && typeof MD.recommendTemplates === 'function') {
        return MD.recommendTemplates(text, ctx, 3).map(function (t) { return t.id; });
      }
    } catch (_e) { void 0; }
    return ['ba-cream', 'feed-showcase', 'feed-review'].slice(0, 3);
  }

  function buildEffectText(recipeId) { return EFFECT[recipeId] || '홍보용으로 자연스럽게 정리했어요.'; }

  function buildIndustryLabel(recipeId) { return INDUSTRY[recipeId] || '뷰티'; }

  function buildActions(ctx, recipeId, caption, recoIds, dataUrl) {
    var cust = ctx && ctx.currentCustomer;
    var retouchText = cust && cust.name
      ? cust.name + '님 리터치 안내 문구까지 만들어줘'
      : '고객 리터치 안내 문구까지 만들어줘';
    var acts = [
      { id: 'ig_preview', kind: 'open_instagram', label: '인스타 미리보기', phase: 'safe', payload: { caption: caption, dataUrl: dataUrl } },
      { id: 'export', kind: 'export_image', label: '내보내기', phase: 'safe', payload: { dataUrl: dataUrl } },
      { id: 'pe_template', kind: 'open_template_panel', label: '템플릿 보기', phase: 'safe', payload: { recommendedIds: recoIds || [], dataUrl: dataUrl } },
      { id: 'save_customer', kind: 'save_photo_to_customer', label: '고객기록에 저장', phase: 'confirm', payload: { customerName: (cust && cust.name) || '' } },
      { id: 'retouch_draft', kind: 'chat_suggest', label: '리터치 안내 초안', phase: 'safe', payload: { text: retouchText } },
    ];
    return (window.ItdasyActionHub && window.ItdasyActionHub.normalizeActions)
      ? window.ItdasyActionHub.normalizeActions(acts, 'hub') : acts;
  }

  window.ItdasyPhotoModeSupport = {
    START_RE: START_RE,
    CAPTION_RE: CAPTION_RE,
    isExcluded: isExcluded,
    shouldStart: shouldStart,
    recipeFromText: recipeFromText,
    buildCaptionDraft: buildCaptionDraft,
    buildTemplateRecos: buildTemplateRecos,
    buildEffectText: buildEffectText,
    buildIndustryLabel: buildIndustryLabel,
    buildActions: buildActions,
  };
})();
