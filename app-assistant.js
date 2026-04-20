/* ─────────────────────────────────────────────────────────────
   AI 비서 챗봇 (2026-04-21)

   원장님 자연어 질문 → POST /assistant/ask → 답변.
   대화 UI + 추천 질문 3개.
   ──────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const SUGGESTIONS = [
    '이번 주 매출 어때?',
    '제일 잘 팔리는 시술 뭐야?',
    '이탈 임박 고객 알려줘',
    '요즘 흐름 어때?',
    '오늘 예약 누구야?',
  ];

  let _history = [];  // [{role, text}]

  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  }

  function _ensureSheet() {
    let sheet = document.getElementById('assistantSheet');
    if (sheet) return sheet;
    sheet = document.createElement('div');
    sheet.id = 'assistantSheet';
    sheet.style.cssText = 'position:fixed;inset:0;z-index:9999;display:none;background:rgba(0,0,0,0.5);';
    sheet.innerHTML = `
      <div style="position:absolute;inset:auto 0 0 0;background:var(--bg,#fff);border-radius:20px 20px 0 0;height:88vh;display:flex;flex-direction:column;padding:16px;padding-bottom:max(12px,env(safe-area-inset-bottom));">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <span style="font-size:22px;">🤖</span>
          <strong style="font-size:17px;">AI 비서</strong>
          <span style="font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(139,92,246,0.15);color:#7C3AED;font-weight:700;">베타</span>
          <button onclick="closeAssistant()" style="margin-left:auto;background:rgba(0,0,0,0.05);border:none;width:32px;height:32px;border-radius:50%;font-size:16px;cursor:pointer;">✕</button>
        </div>
        <div id="asstBody" style="flex:1;overflow-y:auto;padding:4px;"></div>
        <div id="asstSuggest" style="display:flex;gap:6px;overflow-x:auto;margin-top:8px;padding:4px 0;"></div>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <input id="asstInput" placeholder="샵 관련해서 물어보세요…" maxlength="300" style="flex:1;padding:12px;border:1px solid #ddd;border-radius:10px;font-size:14px;" />
          <button id="asstSend" style="padding:12px 18px;border:none;border-radius:10px;background:linear-gradient(135deg,#F18091,#D95F70);color:#fff;cursor:pointer;font-weight:800;">보내기</button>
        </div>
      </div>
    `;
    document.body.appendChild(sheet);
    sheet.addEventListener('click', (e) => { if (e.target === sheet) closeAssistant(); });
    sheet.querySelector('#asstSend').addEventListener('click', _send);
    sheet.querySelector('#asstInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _send(); }
    });
    _renderSuggest();
    return sheet;
  }

  function _renderHistory() {
    const body = document.getElementById('asstBody');
    if (!body) return;
    if (!_history.length) {
      body.innerHTML = `
        <div style="padding:30px 20px;text-align:center;">
          <div style="font-size:40px;margin-bottom:10px;">🤖</div>
          <div style="font-size:14px;color:#555;line-height:1.6;">안녕하세요 원장님 👋<br>샵 현황이 궁금하면 편하게 물어보세요.<br><span style="font-size:11px;color:#888;">예: "이번 주 매출", "제일 잘 팔린 시술"</span></div>
        </div>
      `;
      return;
    }
    body.innerHTML = _history.map(m => {
      if (m.role === 'user') {
        return `<div style="display:flex;justify-content:flex-end;margin-bottom:8px;">
          <div style="max-width:80%;padding:10px 14px;background:linear-gradient(135deg,#F18091,#D95F70);color:#fff;border-radius:16px 16px 4px 16px;font-size:13px;line-height:1.5;">${_esc(m.text)}</div>
        </div>`;
      }
      if (m.role === 'assistant') {
        return `<div style="display:flex;gap:8px;margin-bottom:8px;align-items:flex-start;">
          <div style="width:28px;height:28px;border-radius:50%;background:rgba(139,92,246,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px;">🤖</div>
          <div style="max-width:80%;padding:10px 14px;background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:16px 16px 16px 4px;font-size:13px;line-height:1.6;color:#222;white-space:pre-wrap;">${_esc(m.text)}</div>
        </div>`;
      }
      // loading
      return `<div style="display:flex;gap:8px;margin-bottom:8px;align-items:flex-start;">
        <div style="width:28px;height:28px;border-radius:50%;background:rgba(139,92,246,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px;">🤖</div>
        <div style="padding:10px 14px;background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:16px;">
          <span style="display:inline-block;animation:asstDots 1.4s infinite;font-size:20px;color:#bbb;">···</span>
        </div>
      </div>
      <style>@keyframes asstDots { 0%,20% { opacity:0.2; } 50% { opacity:1; } 100% { opacity:0.2; } }</style>`;
    }).join('');
    body.scrollTop = body.scrollHeight;
  }

  function _renderSuggest() {
    const el = document.getElementById('asstSuggest');
    if (!el) return;
    el.innerHTML = SUGGESTIONS.map(s => `
      <button data-suggest="${_esc(s)}" style="padding:8px 12px;border:1px solid #ddd;border-radius:100px;background:#fff;cursor:pointer;font-size:11px;color:#555;white-space:nowrap;">${_esc(s)}</button>
    `).join('');
    el.querySelectorAll('[data-suggest]').forEach(btn => btn.addEventListener('click', () => {
      document.getElementById('asstInput').value = btn.dataset.suggest;
      _send();
    }));
  }

  async function _send() {
    const input = document.getElementById('asstInput');
    const q = input.value.trim();
    if (!q) return;
    input.value = '';
    _history.push({ role: 'user', text: q });
    _history.push({ role: 'loading', text: '' });
    _renderHistory();

    try {
      const res = await fetch(window.API + '/assistant/ask', {
        method: 'POST',
        headers: { ...window.authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const d = await res.json();
      _history = _history.filter(m => m.role !== 'loading');
      _history.push({ role: 'assistant', text: d.answer || '답을 만들지 못했어요.' });
      _renderHistory();
      if (window.hapticLight) window.hapticLight();
    } catch (e) {
      _history = _history.filter(m => m.role !== 'loading');
      _history.push({ role: 'assistant', text: '잠시 연결이 불안정해요. 다시 시도해 주세요. (' + e.message + ')' });
      _renderHistory();
    }
  }

  window.openAssistant = function () {
    _ensureSheet();
    document.getElementById('assistantSheet').style.display = 'block';
    document.body.style.overflow = 'hidden';
    _renderHistory();
    setTimeout(() => document.getElementById('asstInput')?.focus(), 100);
  };
  window.closeAssistant = function () {
    const sheet = document.getElementById('assistantSheet');
    if (sheet) sheet.style.display = 'none';
    document.body.style.overflow = '';
  };
})();
