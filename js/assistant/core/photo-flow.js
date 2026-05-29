/* 잇비 사진 홍보 풀체인 오케스트레이터 (T-104 MVP · 2026-05-30)

   "이 사진 (네일) 홍보용으로 예쁘게 해줘" 한 문장 →
     ① 현재 사진 확인 ② 업종/의도 판단 ③ 업종별 보정 적용 ④ 다음 단계(템플릿/캡션/고객저장) 제안.

   1차 MVP 원칙:
   - 보정 적용까지만 실제 실행. 템플릿/캡션/고객 기록 저장은 **제안만**(자동 실행 금지).
   - 자동 인스타 업로드·DM 발송 금지. 고객 기록 자동 저장 금지(중복/고객오인 위험).
   - 각 단계 실패해도 중단 메시지 대신 다음 단계 안내.
   - 재사용: window.PhotoEditorBeautyAI.apply/recommend/RECIPES, AssistantContext, PhotoEditor._internal.
   - 채팅 메시지는 호출측(app-assistant)이 푸시. 이 모듈은 보정 적용 + 메시지 문자열 생성만. */
(function () {
  'use strict';
  if (window.ItdasyPhotoFlow) return;

  // 홍보/게시 의도 신호 + 사진 신호. 메시지/DM 의도는 제외(사진 흐름 아님).
  const PROMO = /(홍보|스토리|피드|인스타|sns|게시|올릴|업로드용|홍보용|예쁘게\s*(만들|해)|꾸며)/i;
  const PHOTO_SIG = /(사진|이미지|포토|보정|편집|만들|예쁘게|꾸며)/;
  const MSG_SIG = /(문자|dm|디엠|메시지|카톡|발송|보내)/i;

  const EFFECT = {
    nail_focus: '네일 광택과 손끝 선명도', hair_focus: '머릿결 윤기와 컬러',
    lash_focus: '눈빛과 눈가 선명도', natural: '피부톤·붉은기·잡티 정리',
    glam: '메이크업 화사함', brow_focus: '눈썹 선명도', lip_focus: '입술 생기',
  };
  const LABEL = {
    nail_focus: '네일', hair_focus: '헤어', lash_focus: '속눈썹',
    natural: '피부', glam: '메이크업', brow_focus: '눈썹', lip_focus: '입술',
  };

  // 텍스트 키워드 → beauty-ai 레시피 id (없거나 미존재면 null → recommend() 가 shop_type 으로 결정)
  function _recipeFromText(t) {
    if (/(네일|손톱|젤네일|패디|발톱)/.test(t)) return 'nail_focus';
    if (/(헤어|머리|모발|펌|염색|컬러|붙임머리)/.test(t)) return 'hair_focus';
    if (/(속눈썹|래쉬|연장)/.test(t)) return 'lash_focus';
    if (/(피부|잡티|모공|결|톤)/.test(t)) return 'natural';
    if (/(눈썹|반영구)/.test(t)) return 'brow_focus';
    if (/(메이크업|화장|글램)/.test(t)) return 'glam';
    return null;
  }

  function _editorState() {
    try { return window.PhotoEditor && window.PhotoEditor._internal && window.PhotoEditor._internal.getState(); }
    catch (_e) { return null; }
  }
  function _hasPhoto() {
    const st = _editorState();
    const sheet = document.getElementById('photoEditorSheet');
    const visible = !!(sheet && sheet.style.display !== 'none');
    return !!(visible && st && st.originalImg);
  }

  function canRun() { return !!(window.PhotoEditorBeautyAI && _hasPhoto()); }

  function detectPhotoFlowIntent(text) {
    const t = String(text || '').trim();
    if (!t || MSG_SIG.test(t)) return false;
    return PROMO.test(t) && PHOTO_SIG.test(t);
  }

  // 적용 레시피 결정: 텍스트 키워드 우선(존재하는 레시피만), 없으면 recommend()(shop_type 반영).
  function _pickRecipe(text) {
    const R = (window.PhotoEditorBeautyAI && window.PhotoEditorBeautyAI.RECIPES) || {};
    const fromText = _recipeFromText(text);
    if (fromText && R[fromText]) return fromText;
    try {
      if (typeof window.PhotoEditorBeautyAI.recommend === 'function') {
        const rec = window.PhotoEditorBeautyAI.recommend(text);
        if (rec && R[rec]) return rec;
      }
    } catch (_e) { void 0; }
    return R.natural ? 'natural' : Object.keys(R)[0];
  }

  // 보정 적용(실제 실행). beauty 탭 전환 후 레시피 적용 → 사용자가 결과 보고 미세조정 가능.
  function applyBestBeautyPreset(text) {
    const recipeId = _pickRecipe(text);
    let applied = false;
    try {
      const internal = window.PhotoEditor && window.PhotoEditor._internal;
      if (internal && typeof internal.applyStatePatch === 'function') internal.applyStatePatch({ activeTab: 'beauty' });
      applied = !!(window.PhotoEditorBeautyAI && window.PhotoEditorBeautyAI.apply(recipeId));
    } catch (_e) { applied = false; }
    return { recipeId, applied };
  }

  // 다음 단계 제안(실행 아님). 고객 있으면 저장 제안, 없으면 선택 안내.
  function suggestNextStep(recipeId, ctx) {
    const cust = ctx && ctx.currentCustomer;
    const lines = ['다음으로 전후 템플릿이나 스토리 문구를 만들 수 있어요.'];
    if (cust && cust.name) lines.push(`현재 고객이 ${cust.name}님으로 잡혀 있어요. 이 편집본을 고객 기록에 저장할까요? ("저장해줘"라고 말씀해 주세요)`);
    else lines.push('고객을 선택하면 이 편집본을 고객 기록에 저장할 수 있어요.');
    return lines;
  }

  // 메인: 한 문장 → 보정 + 다음 단계 제안. (채팅 푸시는 호출측)
  function runPromoFlow(text, ctx) {
    ctx = ctx || (window.ItdasyAssistantContext && window.ItdasyAssistantContext.collect()) || {};
    if (!canRun()) {
      return { ok: false, needsPhoto: true,
        message: '먼저 사진을 열어주세요. 사진 편집기에서 사진을 선택하면 홍보용으로 만들어드릴게요.' };
    }
    const res = applyBestBeautyPreset(text);
    const label = LABEL[res.recipeId] || '';
    const effect = EFFECT[res.recipeId] || '핵심 포인트';
    const head = res.applied
      ? `${label ? label + ' ' : ''}홍보용으로 ${effect}를 살렸어요.`
      : '보정을 적용하는 중 문제가 있었어요. 편집기에서 직접 조정해 주세요.';
    const message = [head].concat(suggestNextStep(res.recipeId, ctx)).join('\n');
    try { window.ItdasyAssistantContext && window.ItdasyAssistantContext.markRecentAction('홍보용 보정'); } catch (_e) { void 0; }
    return { ok: res.applied, recipeId: res.recipeId, message: message };
  }

  window.ItdasyPhotoFlow = { canRun, detectPhotoFlowIntent, runPromoFlow, applyBestBeautyPreset, suggestNextStep };
})();
