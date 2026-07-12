/* caption-onboarding.js — 온보딩 '말투 학습' 캡션 테스트 팝업
   [B-분할] app-caption.js 에서 분리(2026-06-30). 전역 함수 유지 — window.showOnboardingCaptionPopup 등 호출부 그대로.
   의존(전역, 다른 파일): apiFetch / authHeader / showToast. 자체 상태 없음.
   공개: showOnboardingCaptionPopup() / closeOnboardingCaptionPopup() / saveOnboardingCaption() */

// ===== 온보딩 캡션 테스트 팝업 =====
async function showOnboardingCaptionPopup() {
  const popup = document.getElementById('onboardingCaptionPopup');
  const ta = document.getElementById('ocpTextarea');

  // 팝업을 먼저 열고, 생성 중 상태로 표시
  const loadingMsgs = ['AI가 말투를 분석하고 있어요...✨', '게시물 스타일 학습 중...🎀', '피드 글 초안 작성 중...📝', '거의 다 됐어요!💫'];
  let msgIdx = 0;
  ta.value = loadingMsgs[0];
  ta.readOnly = true;
  ta.style.opacity = '0.5';
  popup.style.display = 'flex';
  const loadingTimer = setInterval(() => { msgIdx = (msgIdx + 1) % loadingMsgs.length; ta.value = loadingMsgs[msgIdx]; }, 2000);

  // 저장 버튼도 비활성화
  const saveBtn = popup.querySelector('.ocp-save');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.style.opacity = '0.5'; }

  try {
    const shopType = localStorage.getItem('shop_type') || '붙임머리';
    const res = await apiFetch('/caption/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ description: `${shopType} 시술. 오늘 새로운 손님. 결과 대만족.`, platform: 'instagram' }),
    });
    if (res.ok) {
      const d = await res.json();
      ta.value = d.caption.trim();
    } else {
      // [2026-04-26] 무음 실패 금지 — 사용자한테 명시적으로 알림 (Meta 심사 블로커)
      const errMsg = (await res.text().catch(() => '')) || `HTTP ${res.status}`;
      console.warn('[caption] 생성 실패:', errMsg);
      if (typeof showToast === 'function') {
        showToast('AI 글 만들기에 실패했어요 — 잠시 후 다시 시도해주세요', 'error');
      }
      ta.value = '직접 평소 쓰시는 말투로 한 문단 입력해주시면 학습할게요!';
    }
  } catch(e) {
    ta.value = '직접 평소 쓰시는 말투로 한 문단 입력해주시면 학습할게요!';
  } finally {
    clearInterval(loadingTimer);
    ta.readOnly = false;
    ta.style.opacity = '1';
    if (saveBtn) { saveBtn.disabled = false; saveBtn.style.opacity = '1'; }
  }
}

function closeOnboardingCaptionPopup() {
  document.getElementById('onboardingCaptionPopup').style.display = 'none';
}

async function saveOnboardingCaption() {
  const ta = document.getElementById('ocpTextarea');
  const text = ta.value.trim();
  if (!text || text.length < 10) { showToast('글을 조금 더 입력해주세요!'); return; }

  try {
    const res = await apiFetch('/shop/persona/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ corrected_caption: text }),
    });
    if (!res.ok) throw new Error();
    closeOnboardingCaptionPopup();
    showToast('학습 완료! 앞으로 모든 글에 반영됩니다!');
  } catch(e) {
    showToast('저장에 실패했어요. 다시 시도해주세요.');
  }
}
