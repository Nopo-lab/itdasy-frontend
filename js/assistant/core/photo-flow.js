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
    // [T-104.5] 저장 제안 pending 남김 — 사용자가 "저장해줘/응" 하면 confirmSave 가 실제 저장.
    _setPendingSave(ctx, res.recipeId);
    return { ok: res.applied, recipeId: res.recipeId, message: message };
  }

  // ───────── T-104.5: 저장 확인 흐름 (자동 저장 금지, 사용자 명령 후에만) ─────────
  const PENDING_TTL_MS = 5 * 60 * 1000;
  const _SAVE_RE = /(저장|기록\s*(에)?\s*(저장|남겨|남길|첨부)|첨부|남겨\s*줘|기록해)/;
  const _AFFIRM_RE = /^(응|어|어어|네|예|그래|그래줘|좋아|좋|ㅇㅇ|당연|해줘|진행)$/i;

  function _setPendingSave(ctx, recipeId) {
    try {
      const cust = ctx && ctx.currentCustomer;
      const photo = ctx && ctx.currentPhoto;
      window.__ITDASY_PENDING_PHOTO_FLOW = {
        type: 'attach_current_photo_to_customer',
        customerId: cust ? cust.id : null,
        customerName: cust ? (cust.name || '') : '',
        serviceName: (photo && photo.serviceName) || '',
        recipeId: recipeId || '',
        source: 'assistant',
        createdAt: Date.now(),
      };
    } catch (_e) { void 0; }
  }

  function _getValidPending() {
    try {
      const p = window.__ITDASY_PENDING_PHOTO_FLOW;
      if (!p || p.type !== 'attach_current_photo_to_customer') return null;
      if (Date.now() - (p.createdAt || 0) > PENDING_TTL_MS) { window.__ITDASY_PENDING_PHOTO_FLOW = null; return null; }
      return p;
    } catch (_e) { return null; }
  }

  function hasPendingSave() { return !!_getValidPending(); }

  function _isSaveReply(text) {
    const t = String(text || '').trim();
    return _SAVE_RE.test(t) || _AFFIRM_RE.test(t);
  }

  function _currentCanvasUrl() {
    const cv = document.getElementById('peCanvas');
    if (!cv || !cv.width || !cv.height) return '';
    try { return cv.toDataURL('image/jpeg', 0.92); }
    catch (_e) { return ''; }
  }

  // 사용자의 "저장해줘/응" 응답 처리. pending 없거나 저장의도 아니면 null(파이프라인 계속).
  async function confirmSave(text, ctx) {
    const pending = _getValidPending();
    if (!pending) return null;                 // photo-flow pending 없음 → 이 경로 아님
    if (!_isSaveReply(text)) return null;       // 저장/확정 의도 아님 → pending 유지(만료까지)
    window.__ITDASY_PENDING_PHOTO_FLOW = null;  // consume

    ctx = ctx || (window.ItdasyAssistantContext && window.ItdasyAssistantContext.collect()) || {};
    const dataUrl = _currentCanvasUrl();
    if (!dataUrl) {
      return { ok: false, message: '현재 편집 중인 사진이 없어서 저장할 수 없어요. 먼저 사진을 열어주세요.' };
    }
    // 고객: 현재 선택 우선, 없으면 pending 의 고객, 그래도 없으면 안내(자동 추측 금지).
    const live = ctx.currentCustomer;
    const cust = (live && live.id != null) ? { id: live.id, name: live.name || '' }
      : (pending.customerId != null ? { id: pending.customerId, name: pending.customerName || '' } : null);
    if (!cust) {
      return { ok: false, needCustomer: true,
        message: '어느 고객에게 저장할까요? 고객을 먼저 선택한 뒤 다시 "저장해줘"라고 말씀해 주세요.' };
    }
    if (!(window.TreatmentLink && typeof window.TreatmentLink.attachPhotoToCustomer === 'function')) {
      return { ok: false, message: '저장 모듈을 불러오는 중이에요. 잠시 후 다시 시도해 주세요.' };
    }
    const res = await window.TreatmentLink.attachPhotoToCustomer({
      customer: cust,
      dataUrl: dataUrl,
      serviceName: pending.serviceName || '',
      source: 'assistant',
    });
    const name = cust.name || '고객';
    let message;
    if (res && res.wasDuplicate) message = `이미 ${name}님 기록에 저장된 사진이라 중복 저장하지 않았어요.`;
    else if (res && res.ok && res.remote) message = `${name}님 시술 사진 기록에 저장했어요.`;
    else if (res && res.ok) message = `${name}님 기록(로컬)에는 저장했지만 서버 동기화는 실패했어요. 네트워크 확인 후 다시 시도할 수 있어요.`;
    else message = '저장에 실패했어요. 잠시 후 다시 시도해 주세요.';
    return { ok: !!(res && res.ok), wasDuplicate: !!(res && res.wasDuplicate), message: message };
  }

  window.ItdasyPhotoFlow = { canRun, detectPhotoFlowIntent, runPromoFlow, applyBestBeautyPreset, suggestNextStep, confirmSave, hasPendingSave };
})();
