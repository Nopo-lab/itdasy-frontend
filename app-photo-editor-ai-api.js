/* 사진 편집기 — AI API 연동 (업스케일 / 오브젝트 제거 / 배경 생성)
   백엔드 프록시: /image/enhance, /image/remove-object, /image/generate-bg
   Replicate (업스케일+오브젝트) + fal.ai (배경 생성)
   Pro/Premium 플랜만 사용 가능 (백엔드에서 플랜 체크)
*/
(function () {
  'use strict';
  if (window.PhotoEditorAI) return;

  function _toast(msg) { if (window.showToast) window.showToast(msg); }

  function _blobFromDataUrl(dataUrl) {
    const parts = dataUrl.split(',');
    const mime = parts[0].match(/:(.*?);/)[1];
    const bin = atob(parts[1]);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  async function _callApi(path, formData) {
    const res = await window.apiFetch(path, {
      method: 'POST',
      headers: window.authHeader(),
      body: formData,
    });
    if (res.status === 402) throw new Error('Pro 플랜 이상에서 사용 가능해요');
    if (res.status === 429) throw new Error('오늘 AI 보정 한도를 다 썼어요');
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(body || 'AI 처리 실패 (서버 오류)');
    }
    return res;
  }

  async function enhance(srcDataUrl) {
    _toast('AI 화질 향상 중… (2~5초)');
    const fd = new FormData();
    fd.append('file', _blobFromDataUrl(srcDataUrl), 'photo.jpg');
    fd.append('scale', '2');
    const res = await _callApi('/image/enhance', fd);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }

  async function removeObject(srcDataUrl, maskDataUrl) {
    _toast('AI 오브젝트 제거 중… (3~6초)');
    const fd = new FormData();
    fd.append('file', _blobFromDataUrl(srcDataUrl), 'photo.jpg');
    fd.append('mask', _blobFromDataUrl(maskDataUrl), 'mask.png');
    const res = await _callApi('/image/remove-object', fd);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }

  async function generateBg(srcDataUrl, prompt) {
    _toast('AI 배경 생성 중… (5~10초)');
    const fd = new FormData();
    fd.append('file', _blobFromDataUrl(srcDataUrl), 'photo.jpg');
    fd.append('prompt', prompt || 'professional beauty salon studio background, clean, soft lighting');
    const res = await _callApi('/image/generate-bg', fd);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }

  function _panelHTML(state) {
    const hasSrc = !!(state && state.originalImg);
    return `<div class="pe-field-label">AI 보정</div>
      <div class="pe-panel-row"><button type="button" class="pe-action-btn" data-ai-action="enhance" ${hasSrc ? '' : 'disabled'}>AI 화질 향상 (2x 업스케일)</button></div>
      <div class="pe-hint" style="margin-bottom:12px;">흐릿한 핸드폰 사진 → 선명한 고화질. Replicate Real-ESRGAN.</div>
      <div class="pe-field-label">AI 배경 생성</div>
      <label class="pe-field"><span>배경 설명 (선택)</span><input type="text" class="pe-input" data-ai-bg-prompt placeholder="예: 고급 대리석 배경, 살롱 인테리어" maxlength="100" /></label>
      <div class="pe-panel-row"><button type="button" class="pe-action-btn" data-ai-action="generate-bg" ${hasSrc ? '' : 'disabled'}>AI 배경 생성</button></div>
      <div class="pe-hint" style="margin-bottom:12px;">누끼 따고 AI가 배경을 새로 만들어요. fal.ai Flux.</div>
      <div class="pe-field-label">AI 오브젝트 제거</div>
      <div class="pe-panel-row"><button type="button" class="pe-action-btn" data-ai-action="remove-object" ${hasSrc ? '' : 'disabled'}>브러시로 영역 선택 → AI 제거</button></div>
      <div class="pe-hint">지우고 싶은 부분을 브러시로 칠한 후 실행. Replicate LaMa.</div>
      <div class="pe-hint" style="margin-top:12px;color:#D58A95;">Pro/Premium 플랜 전용 기능이에요.</div>`;
  }

  function _bindPanel(panel, state, helpers) {
    panel.querySelectorAll('[data-ai-action]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!state || !state.originalImg) return _toast('먼저 사진을 올려주세요');
        btn.disabled = true;
        const action = btn.dataset.aiAction;
        try {
          if (action === 'enhance') {
            const url = await enhance(state.originalSrc);
            helpers.replaceImage(url, 'AI 화질 향상 완료');
          } else if (action === 'generate-bg') {
            const prompt = panel.querySelector('[data-ai-bg-prompt]')?.value || '';
            const bgUrl = await _generateBgWithNukki(state, prompt);
            if (bgUrl) helpers.replaceImage(bgUrl, 'AI 배경 생성 완료');
          } else if (action === 'remove-object') {
            _toast('부분 보정 탭에서 지울 영역을 칠한 후 다시 눌러주세요');
            state.activeTab = 'brush';
            state._pendingAiRemove = true;
            helpers.renderPanel();
          }
        } catch (err) {
          _toast(err.message || 'AI 처리 실패');
        } finally { btn.disabled = false; }
      });
    });
  }

  async function _generateBgWithNukki(state, prompt) {
    let removedSrc = state.removedBgDataUrl;
    if (!removedSrc) {
      _toast('누끼 따는 중…');
      try {
        const bgCompose = window.composeBgForEditor;
        if (!bgCompose) throw new Error('누끼 모듈 없음');
        const result = await bgCompose(state.originalSrc, 'transparent', '1:1', null);
        removedSrc = result.removedBgDataUrl;
        state.removedBgDataUrl = removedSrc;
      } catch (e) {
        _toast('누끼 실패: ' + (e.message || ''));
        return null;
      }
    }
    return await generateBg(removedSrc, prompt);
  }

  function _register() {
    const PE = window.PhotoEditor;
    if (!PE || !PE._internal) return false;
    PE._internal.registerTabPanel('ai', { html: _panelHTML, bind: _bindPanel });
    return true;
  }
  if (!_register()) {
    let t = 0;
    const iv = setInterval(() => { if (_register() || ++t > 50) clearInterval(iv); }, 100);
  }

  window.PhotoEditorAI = { enhance, removeObject, generateBg };
})();
