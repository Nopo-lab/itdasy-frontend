/* 사진 편집기 — AI 잇비 말 편집 패널 (v2 — 카테고리별 예시) */
(function () {
  'use strict';
  if (window.PhotoEditorNLApply) return;

  var EXAMPLE_GROUPS = [
    { label: '헤어', items: ['머리 풍성하게', '머리끝 정리', '잔머리 정리', '헤어 윤기', '염색 색감 살려줘'] },
    { label: '피부', items: ['피부결 정리', '붉은기 줄여줘', '모공 정리', '잡티 완화', '톤업 해줘'] },
    { label: '눈/입', items: ['눈빛 반짝이게', '속눈썹 또렷', '다크서클 완화', '입술 발색', '아이 색감 살려줘'] },
    { label: '네일', items: ['네일 경계 또렷하게', '네일 반짝이게', '손 피부톤 정리'] },
    { label: '배경', items: ['누끼 핑크색으로', '배경 흐리게', '배경 베이지로', '배경 블랙으로'] },
    { label: '홍보', items: ['전후사진 만들어줘', '인스타 피드용', '가격표 템플릿', '이벤트 스토리', '포트폴리오 4컷'] },
    { label: '조정', items: ['더 밝게', '덜 과하게', '따뜻한 톤으로', '원래대로'] },
  ];

  function _html(state) {
    var chips = EXAMPLE_GROUPS.map(function (g) {
      var btns = g.items.map(function (x) {
        return '<button type="button" class="pe-chip-btn" data-pe-nl-example="' + _esc(x) + '">' + _esc(x) + '</button>';
      }).join('');
      return '<div class="pe-nl-group"><span class="pe-nl-group-label">' + _esc(g.label) + '</span>' +
        '<div class="pe-nl-group-chips">' + btns + '</div></div>';
    }).join('');
    var maskStatus = window.MaskStatusUI && typeof window.MaskStatusUI.html === 'function'
      ? window.MaskStatusUI.html(state) : '';

    return maskStatus + '<label class="pe-field"><span>잇비에게 말하기</span>' +
      '<textarea class="pe-input" data-pe-nl-text rows="3" maxlength="200" placeholder="예: 머리 풍성하게 해줘, 누끼 핑크색으로"></textarea></label>' +
      '<div class="pe-nl-examples" style="margin-top:8px;max-height:220px;overflow-y:auto;">' + chips + '</div>' +
      '<div class="pe-panel-row" style="margin-top:10px;"><button type="button" class="pe-action-btn" data-pe-nl-run>적용하기</button></div>' +
      '<div class="pe-hint">저장은 직접 누르기 전까지 하지 않아요. 되돌리기로 언제든 원래대로 돌릴 수 있어요.</div>';
  }

  function _bind(panel, state, helpers) {
    if (window.MaskStatusUI && typeof window.MaskStatusUI.bind === 'function') {
      window.MaskStatusUI.bind(panel, state, helpers);
    }
    panel.querySelectorAll('[data-pe-nl-example]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var input = panel.querySelector('[data-pe-nl-text]');
        if (input) input.value = btn.dataset.peNlExample;
        apply(btn.dataset.peNlExample, state, helpers);
      });
    });
    var runBtn = panel.querySelector('[data-pe-nl-run]');
    if (runBtn) runBtn.addEventListener('click', function () {
      var input = panel.querySelector('[data-pe-nl-text]');
      apply(input ? input.value : '', state, helpers);
    });
  }

  function apply(text, state, helpers) {
    var PE = window.PhotoEditor;
    var st = state || (PE && PE._internal && PE._internal.getState ? PE._internal.getState() : null);
    var h = helpers || (PE && PE._internal ? PE._internal.helpers : null);
    if (!st || !h) return false;
    var parser = window.PhotoEditorIntentParser;
    var runner = window.PhotoEditorEditPlan;
    if (!parser || !runner) return _toast(h, '말 편집 모듈을 불러오는 중이에요');
    var plan = parser.parse(text);
    return runner.execute(plan, st, h);
  }

  function _toast(h, msg) {
    if (h && h.toast) h.toast(msg);
    return false;
  }

  function _esc(s) { return window._esc(s); } /* [2026-06-11] 중복 제거 — app-core 정본 위임 */

  function _register() {
    var PE = window.PhotoEditor;
    if (!PE || !PE._internal) return false;
    PE._internal.registerTabPanel('ai', { html: _html, bind: _bind });
    return true;
  }

  if (!_register()) {
    var tries = 0;
    var iv = setInterval(function () { if (_register() || ++tries > 50) clearInterval(iv); }, 100);
  }

  window.PhotoEditorNLApply = { apply: apply };
})();
