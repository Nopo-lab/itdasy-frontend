/* 사진 편집기 — 배경·누끼 탭 확장 (자동 그림자 포함) */
(function () {
  'use strict';
  if (window.PhotoEditorBgTab) return;

  function _esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  function _ensure(state) {
    if (!state.shadow) state.shadow = { mode: 'none' };
    if (!state.bg) state.bg = { id: null };
  }

  function _html(state) {
    _ensure(state);
    const list = typeof window.GALLERY_BG_LIST === 'function' ? window.GALLERY_BG_LIST() : [];
    const shadowList = window.PhotoEditorBgCompose?.shadows || {};
    const shadowBtns = Object.keys(shadowList).map(id => {
      const on = state.shadow.mode === id;
      return `<button type="button" class="pe-chip-btn${on ? ' on' : ''}" data-pe-shadow="${id}">${_esc(shadowList[id].label)}</button>`;
    }).join('');
    const cards = list.map(bg => _bgCard(bg, state.bg && state.bg.id === bg.id)).join('');
    return `<div class="pe-field-label">자동 그림자</div>
      <div class="pe-panel-row pe-panel-grid-2" style="margin-bottom:10px;">${shadowBtns}</div>
      <div class="pe-field-label">배경 선택</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;">${cards || '<div class="pe-hint">배경 모듈 로드 중이에요.</div>'}</div>
      <div class="pe-panel-row pe-panel-grid-2">
        <button type="button" class="pe-chip-btn" data-pe-bg-restore>↺ 원본 사진</button>
        <button type="button" class="pe-chip-btn" data-pe-bg-open>기존 배경 화면</button>
      </div>
      <div class="pe-hint">그림자는 누끼 모양의 투명도만 써서 뒤에 깔아요. 저장 이미지에는 분홍 마스크나 선택선이 들어가지 않습니다.</div>`;
  }

  function _bgCard(bg, on) {
    const preview = bg.imageData
      ? `<img src="${_esc(bg.imageData)}" alt="${_esc(bg.name)}" style="width:100%;height:100%;object-fit:cover;display:block;" />`
      : `<div style="width:100%;height:100%;background:${_esc(bg.gradient || bg.color || '#fff')};"></div>`;
    return `<button type="button" data-pe-bg-id="${_esc(bg.id)}"
      style="position:relative;width:100%;aspect-ratio:1;border-radius:10px;overflow:hidden;border:${on ? '2px solid #D58A95' : '1.5px solid rgba(255,255,255,0.10)'};background:transparent;cursor:pointer;padding:0;">
      ${preview}<div style="position:absolute;left:0;right:0;bottom:0;padding:3px 6px;background:rgba(0,0,0,0.55);color:#fff;font-size:10px;font-weight:700;text-align:center;">${_esc(bg.name)}</div>
    </button>`;
  }

  function _bind(panel, state, helpers) {
    _ensure(state);
    panel.querySelectorAll('[data-pe-shadow]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.shadow.mode = btn.dataset.peShadow;
        helpers.renderPanel();
        if (state.bg && state.bg.id && state.preBgOriginalSrc) {
          helpers.toast('그림자 다시 적용 중...');
          _applyBgId(state.bg.id, state, helpers).catch(err => {
            console.warn('[photo-bg-tab] 그림자 재적용 실패:', err);
            helpers.toast('그림자 적용 실패');
          });
        } else if (helpers.pushHistory) helpers.pushHistory();
      });
    });
    panel.querySelectorAll('[data-pe-bg-id]').forEach(btn => btn.addEventListener('click', () => _applyBg(btn, state, helpers)));
    panel.querySelector('[data-pe-bg-restore]')?.addEventListener('click', () => _restore(state, helpers));
    panel.querySelector('[data-pe-bg-open]')?.addEventListener('click', () => (window.openGalleryBg || window.openBgGallery || window.openBgPanel || function () {})());
  }

  async function _applyBg(btn, state, helpers) {
    if (!state.originalImg) return helpers.toast('먼저 사진을 골라주세요');
    const bgId = btn.dataset.peBgId;
    const list = typeof window.GALLERY_BG_LIST === 'function' ? window.GALLERY_BG_LIST() : [];
    const bg = list.find(x => x.id === bgId);
    if (!bg || !window.PhotoEditorBgCompose) return helpers.toast('배경 모듈 로드 중이에요');
    btn.disabled = true;
    // [T-120] 진행 피드백 — compose 가 누끼+합성을 한 번에 처리(엔진 미수정)하므로,
    //   누끼 캐시 유무로 시작 단계 메시지를 분기한다.
    //   첫 적용=누끼 필요 → '누끼 정리 중…' / 캐시 재사용(그림자·다른 배경 재선택) → '배경 합성 중…'
    helpers.toast(state.removedBgDataUrl ? '배경 합성 중…' : '누끼 정리 중…');
    try {
      await _applyBgId(bgId, state, helpers, '배경 적용 완료');
    } catch (err) {
      console.warn('[photo-bg-tab] 합성 실패:', err);
      helpers.toast('배경 적용 실패: ' + ((err && err.message) || '알 수 없는 오류').slice(0, 60));
    } finally {
      btn.disabled = false;
    }
  }

  async function _applyBgId(bgId, state, helpers, doneMsg) {
    const list = typeof window.GALLERY_BG_LIST === 'function' ? window.GALLERY_BG_LIST() : [];
    const bg = list.find(x => x.id === bgId);
    if (!bg || !window.PhotoEditorBgCompose) throw new Error('배경 모듈 로드 실패');
    if (!state.preBgOriginalSrc) state.preBgOriginalSrc = state.originalSrc;
    // [T-120] 누끼가 끝난(캐시 확보) 뒤 합성/그림자 단계 진입을 알림 — 누끼 필요했던 경우에만.
    const needCutout = !state.removedBgDataUrl;
    const result = await window.PhotoEditorBgCompose.compose({
      srcUrl: state.preBgOriginalSrc,
      bg,
      targetRatio: state.ratio && state.ratio !== 'original' ? state.ratio : '1:1',
      preRemovedBgUrl: state.removedBgDataUrl,
      shadow: state.shadow,
    });
    state.bg = { id: bg.id };
    state.removedBgDataUrl = result.removedBgDataUrl;
    if (needCutout && doneMsg) helpers.toast('배경 합성 중…');
    await _swapImage(state, result.composedDataUrl, helpers);
    if (doneMsg) helpers.toast(doneMsg);
  }

  function _swapImage(state, src, helpers) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        state.originalImg = img;
        state.originalSrc = src;
        helpers.scheduleRedraw();
        if (helpers.pushHistory) helpers.pushHistory();
        resolve();
      };
      img.onerror = reject;
      img.src = src;
    });
  }

  function _restore(state, helpers) {
    if (!state.preBgOriginalSrc) return helpers.toast('원본이 이미 보이고 있어요');
    state.removedBgDataUrl = null;
    state.bg = { id: null };
    const src = state.preBgOriginalSrc;
    state.preBgOriginalSrc = null;
    _swapImage(state, src, helpers).then(() => helpers.toast('원본 사진으로 복원')).catch(() => helpers.toast('복원 실패'));
  }

  function _register() {
    const PE = window.PhotoEditor;
    if (!PE || !PE._internal || !PE._internal.registerTabPanel) return false;
    PE._internal.registerTabPanel('bg', { html: _html, bind: _bind });
    return true;
  }

  if (!_register()) {
    let tries = 0;
    const iv = setInterval(() => { if (_register() || ++tries > 60) clearInterval(iv); }, 100);
  }

  window.PhotoEditorBgTab = { register: _register };
})();
