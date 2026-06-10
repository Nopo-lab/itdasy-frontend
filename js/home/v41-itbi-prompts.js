/* HomeV41 잇비 첫 추천 버튼 */
(function () {
  'use strict';
  if (window.HomeV41ItbiPrompts) return;

  const PROMPTS = [
    { key: 'photo_promo', label: '사진 홍보용으로 만들기', text: '이 사진 인스타 홍보용으로 예쁘게 해줘', primary: true },
    { key: 'revenue', label: '오늘 매출 우선순위 보기', text: '오늘 뭐부터 챙기면 매출에 좋아?' },
    { key: 'retouch', label: '고객 리터치 챙기기', text: '고객 리터치 챙기기' },
  ];

  function _esc(s) { return window._esc(s); } /* [2026-06-11] 중복 제거 — app-core 정본 위임 */

  function _buttonStyle(item) {
    const base = 'border-radius:999px;padding:8px 11px;font-size:11.5px;font-weight:700;cursor:pointer;';
    if (!item.primary) return base + 'border:1px solid #E5E8EB;background:#fff;color:#4E5968;';
    return base + 'border:0;background:#191F28;color:#fff;font-weight:800;box-shadow:0 5px 14px rgba(25,31,40,.18);';
  }

  function render(esc) {
    const safe = typeof esc === 'function' ? esc : _esc;
    const buttons = PROMPTS.map(item => (
      `<button type="button" data-itbi-prompt="${safe(item.key)}" style="${_buttonStyle(item)}">${safe(item.label)}</button>`
    )).join('');
    return `<div class="hv5-itbi-prompts" style="display:flex;gap:6px;flex-wrap:wrap;margin:-2px 0 10px;">${buttons}</div>`;
  }

  function text(key) {
    const item = PROMPTS.find(p => p.key === key);
    return item ? item.text : '';
  }

  function bind(container, deps) {
    const openSheet = deps && deps.openSheet;
    const fileInput = deps && deps.fileInput;
    container.querySelectorAll('[data-itbi-prompt]').forEach(btn => {
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const key = btn.dataset.itbiPrompt || '';
        const prompt = text(key) || btn.textContent || '';
        if (key === 'photo_promo') {
          if (fileInput) fileInput.dataset.itbiPrompt = prompt;
          fileInput?.click();
          return;
        }
        if (typeof openSheet === 'function') openSheet({ sendImmediate: prompt });
      });
    });
  }

  window.HomeV41ItbiPrompts = { render, text, bind };
})();
