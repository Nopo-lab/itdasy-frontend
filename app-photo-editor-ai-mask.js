/* 사진 편집기 — 보수적 AI 영역(사람/배경) */
(function () {
  'use strict';
  if (window.PhotoEditorAIMask) return;

  function _ensureSel(state) {
    if (!state.selective) state.selective = { pins: [], activeId: null, enabled: false };
    return state.selective;
  }

  function subSectionHTML() {
    return `<div style="margin-top:14px;padding-top:14px;border-top:1px dashed rgba(255,255,255,0.08);">
      <div class="pe-field-label"><svg class="pe-ic" viewBox="0 0 24 24"><use href="#ic-wand-sparkles"/></svg> 정밀 영역 보정 (처음만 느림)</div>
      <div class="pe-panel-row" style="display:flex;gap:6px;flex-wrap:wrap;">
        <button type="button" class="pe-chip-btn" data-ai-mask="person">사람/시술</button>
        <button type="button" class="pe-chip-btn" data-ai-mask="background">배경</button>
      </div>
      <div class="pe-hint">먼저 빠른 로컬 판단으로 잡고, 나중에 모델이 준비되면 같은 버튼에서 사람/배경 마스크를 더 정밀하게 씁니다.</div>
    </div>`;
  }

  function bindSubSection(panel, state, helpers) {
    panel.querySelectorAll('[data-ai-mask]').forEach(btn => {
      btn.addEventListener('click', () => _addMask(state, btn.dataset.aiMask, helpers));
    });
  }

  function _addMask(state, mode, helpers) {
    const sel = _ensureSel(state);
    const max = (window.PhotoEditorSelective && window.PhotoEditorSelective.MAX_PINS) || 3;
    if (sel.pins.length >= max) return helpers.toast('핀은 최대 ' + max + '개까지');
    const id = 'ai-' + mode + '-' + Date.now();
    sel.pins.push({
      id,
      type: 'smart-mask',
      mode,
      regionLabel: mode === 'background' ? '배경' : '사람',
      exposure: mode === 'background' ? -8 : 8,
      contrast: 0,
      saturation: mode === 'background' ? -6 : 6,
      structure: 0,
    });
    sel.activeId = id;
    helpers.renderPanel();
    helpers.scheduleRedraw();
    if (helpers.pushHistory) helpers.pushHistory();
    helpers.toast((mode === 'background' ? '배경' : '사람/시술') + ' 영역 추가');
  }

  window.PhotoEditorAIMask = { subSectionHTML, bindSubSection };
})();
