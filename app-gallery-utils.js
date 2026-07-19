// ── 갤러리 공유 유틸 ──────────────────────────────────────────
// app-gallery-db / workshop / assign / slot-editor 모두 참조.
// 반드시 다른 gallery 스크립트보다 먼저 로드할 것.
// ─────────────────────────────────────────────────────────────

function _uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function _fileToDataUrl(file) {
  return new Promise(resolve => {
    const r = new FileReader();
    r.onload = e => resolve(e.target.result);
    r.readAsDataURL(file);
  });
}

// [A9] 2MB 초과 이미지 리사이징 — 업로드 전 클라이언트에서 축소
// [v779] ① HEIC(아이폰 기본 포맷) 먼저 JPEG 로 변환 — 안 하면 <img>/canvas 가 못 읽어 빈 화면·깨진 발행.
//        ② img.onerror + 타임아웃 방어 — 예전엔 onerror 가 없어, 디코드 실패(HEIC·손상·초대형)면 Promise 가
//           영영 안 끝나 addFiles 가 무한 행(빈 화면 고착)이었다. 실패해도 원본 파일로 진행해 안 멈추게 한다.
async function _resizeIfNeeded(file, maxWidth = 1920) {
  try {
    if (window.HeicConvert && window.HeicConvert.isHeic && window.HeicConvert.isHeic(file)) {
      file = await window.HeicConvert.toJpeg(file);   // 변환 실패면 throw → 아래 catch 로 원본 유지
    }
  } catch (_he) { void _he; }
  if (file.size < 2 * 1024 * 1024) return file; // 2MB 이하면 그대로
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    let done = false;
    const finish = (result) => { if (done) return; done = true; try { URL.revokeObjectURL(url); } catch (_e) { void _e; } resolve(result); };
    img.onload = () => {
      try {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          blob => finish(blob ? new File([blob], file.name, { type: 'image/jpeg' }) : file),
          'image/jpeg', 0.85
        );
      } catch (_e) { finish(file); }
    };
    img.onerror = () => finish(file);        // 디코드 실패 → 원본 그대로(최소한 무한 행 방지)
    setTimeout(() => finish(file), 15000);   // 최후 안전망 — 무슨 일이 있어도 15초 뒤엔 진행
    img.src = url;
  });
}

function _dataUrlToBlob(dataUrl) {
  const parts = dataUrl.split(',');
  const mime  = parts[0].match(/:(.*?);/)[1];
  const bin   = atob(parts[1]);
  const arr   = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
