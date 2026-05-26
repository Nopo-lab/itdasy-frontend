/* 사진 편집기 — AI 잇비 말 편집 패널 */
(function () {
  'use strict';
  if (window.PhotoEditorNLApply) return;

  const EXAMPLES = ['예쁘게 해줘', '헤어 윤기 살려줘', '전후사진 만들어줘', '덜 과하게'];

  function _html() {
    return `<label class="pe-field"><span>잇비에게 말하기</span>
      <textarea class="pe-input" data-pe-nl-text rows="3" maxlength="120" placeholder="예: 전후사진 만들어줘"></textarea></label>
      <div class="pe-panel-row pe-panel-grid-2" style="margin-top:8px;">
        ${EXAMPLES.map(x => `<button type="button" class="pe-chip-btn" data-pe-nl-example="${_esc(x)}">${_esc(x)}</button>`).join('')}
      </div>
      <div class="pe-panel-row" style="margin-top:10px;"><button type="button" class="pe-action-btn" data-pe-nl-run>적용하기</button></div>
      <div class="pe-hint">저장은 직접 누르기 전까지 하지 않아요. 마음에 안 들면 되돌리기를 누르면 됩니다.</div>`;
  }

  function _bind(panel, state, helpers) {
    panel.querySelectorAll('[data-pe-nl-example]').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = panel.querySelector('[data-pe-nl-text]');
        if (input) input.value = btn.dataset.peNlExample;
        apply(btn.dataset.peNlExample, state, helpers);
      });
    });
    panel.querySelector('[data-pe-nl-run]')?.addEventListener('click', () => {
      const input = panel.querySelector('[data-pe-nl-text]');
      apply(input ? input.value : '', state, helpers);
    });
  }

  function apply(text, state, helpers) {
    const PE = window.PhotoEditor;
    const st = state || PE?._internal?.getState?.();
    const h = helpers || PE?._internal?.helpers;
    if (!st || !h) return false;
    const parser = window.PhotoEditorIntentParser;
    const runner = window.PhotoEditorEditPlan;
    if (!parser || !runner) return _toast(h, '말 편집 모듈을 불러오는 중이에요');
    const plan = parser.parse(text);
    return runner.execute(plan, st, h);
  }

  function _toast(h, msg) {
    if (h && h.toast) h.toast(msg);
    return false;
  }

  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  }

  function _register() {
    const PE = window.PhotoEditor;
    if (!PE || !PE._internal) return false;
    PE._internal.registerTabPanel('ai', { html: _html, bind: _bind });
    return true;
  }

  if (!_register()) {
    let tries = 0;
    const iv = setInterval(() => { if (_register() || ++tries > 50) clearInterval(iv); }, 100);
  }

  window.PhotoEditorNLApply = { apply };
})();
