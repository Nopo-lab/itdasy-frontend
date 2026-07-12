/* caption-publish.js — 인스타 실제 발행 + 업로드 진행/완료 팝업 + 복사/컨페티
   [B-분할] app-caption.js 에서 분리(2026-06-30). 전역 함수 유지 — 호출부 그대로. 공유 캡션 상태 미사용(순수).
   의존(전역, 다른 파일): apiFetch / authHeader / showToast / _instaHandle / window._humanError / closePublishPreview(코어).
   공개: setUploadProgress · openInstagramProfile · closeUploadDone · doActualPublish · copyCaption · copyAll · flashBtn · createConfetti */

// ===== 업로드 진행/완료 팝업 =====
function setUploadProgress(pct, msg) {
  document.getElementById('upPct').textContent = pct + '%';
  document.getElementById('upMsg').textContent = msg;
  document.getElementById('upFill').style.width = pct + '%';
}

function openInstagramProfile() {
  const handle = (_instaHandle || '').replace('@', '');
  window.location.href = handle ? `instagram://user?username=${handle}` : 'instagram://';
}

function closeUploadDone() {
  document.getElementById('uploadDonePopup').style.display = 'none';
}

// ===== 마스터: 인스타 자동 발행 (2단계: 실제 API 호출) =====
async function doActualPublish() {
  const btn = document.getElementById('doPublishBtn');
  const finalCaption = document.getElementById('previewFinalCaption').textContent;
  btn.disabled = true;

  const upPopup = document.getElementById('uploadProgressPopup');
  upPopup.style.display = 'flex';
  setUploadProgress(10, '이미지 준비 중...');

  try {
    const canvas = document.getElementById('baCanvas');
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const formData = new FormData();
    formData.append('image', blob, 'instagram_post.png');
    formData.append('caption', finalCaption);

    setUploadProgress(30, '서버에 전송 중...');

    // 2026-05-01 ── 엔드포인트 미스매치 픽스: /publish 는 JSON image_url 받음.
    // multipart FormData 는 /publish-file 에 보내야 함.
    const res = await apiFetch('/instagram/publish-file', {
      method: 'POST',
      headers: authHeader(),
      body: formData
    });

    setUploadProgress(60, '인스타에 업로드 중...');

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || '업로드 실패');

    setUploadProgress(95, '마무리 중...');
    await new Promise(r => setTimeout(r, 400));
    setUploadProgress(100, '완료!');

    setTimeout(() => {
      upPopup.style.display = 'none';
      closePublishPreview();
      document.getElementById('uploadDonePopup').style.display = 'flex';
      document.getElementById('uploadDoneMsg').textContent = '인스타 피드에 올라갔어요!';
      for(let i = 0; i < 20; i++) setTimeout(createConfetti, i * 100);
    }, 1200);

  } catch(e) {
    upPopup.style.display = 'none';
    showToast('오류: ' + (window._humanError ? window._humanError(e) : e.message));
    btn.textContent = '다시 시도하기 🚀';
    btn.disabled = false;
  }
}

function copyCaption() {
  navigator.clipboard.writeText(document.getElementById('captionText').value)
    .then(() => showToast('글 복사 완료! 📋'));
}
function copyAll() {
  const c = document.getElementById('captionText').value;
  const h = document.getElementById('captionHash').value;
  navigator.clipboard.writeText(c + '\n\n' + h).then(() => showToast('전체 복사 완료! 📋'));
}
function flashBtn(btn, msg) {
  const orig = btn.textContent;
  btn.textContent = msg;
  setTimeout(() => btn.textContent = orig, 1500);
}

function createConfetti() {
  const c = document.createElement('div');
  c.textContent = ['🎀','✨','💎','🩷'][Math.floor(Math.random()*4)];
  c.className = 'confetti';
  c.style.left = Math.random() * 100 + 'vw';
  c.style.animationDuration = Math.random() * 2 + 3 + 's';
  document.body.appendChild(c);
  setTimeout(() => c.remove(), 5000);
}
