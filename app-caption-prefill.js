/* app-caption-prefill.js — 사진 편집기 → 캡션 자동 prefill (§10 P2-10)
 * 의존: window.openCaptionScenarioPopup (2026-07-22: 옛 PhotoEditor 의존 제거)
 *
 * 동작:
 *  1) 잇비·인스타 등이 CaptionPrefill.set(text) 로 prefill 을 localStorage 에 저장
 *  2) captionText 가 채워질 때 (MutationObserver + 입력 이벤트) prefill 을 첫 줄에 한 번 prepend
 *
 * CLAUDE.md "시나리오 팝업 본문 불가침" — 시나리오 팝업의 흐름은 그대로. 결과 textarea 만 prepend.
 *
 * 공개 (선택):
 *   window.CaptionPrefill.set(text)      → localStorage 에 prefill 저장
 *   window.CaptionPrefill.clear()
 *   window.CaptionPrefill.consume()      → 한 번 읽고 비움
 */
(function () {
  'use strict';

  const KEY = 'caption_prefill';
  const FLAG = 'data-caption-prefilled';

  function _set(text) {
    const t = String(text == null ? '' : text).trim();
    if (!t) return false;
    try { localStorage.setItem(KEY, t); return true; }
    catch (_e) { return false; }
  }
  function _get() {
    try { return localStorage.getItem(KEY) || ''; } catch (_e) { return ''; }
  }
  function _clear() {
    try { localStorage.removeItem(KEY); } catch (_e) { void _e; }
  }
  function _consume() {
    const v = _get();
    _clear();
    return v;
  }

  // [2026-07-22] 옛 PhotoEditor 배선 제거 — PE.open 래핑(_wrapPhotoEditor)·로드 폴링·
  //   옛 편집기 다음스텝 모달(#peNextStepsModal [data-pe-ns="caption"]) 클릭 감지는
  //   옛 편집기가 더 이상 열리지 않아 전부 死코드였다.
  //   현재 작업실은 시술명·가격을 자체 캡션 흐름에서 채우고,
  //   CaptionPrefill.set/get/clear 공개 API 는 잇비·인스타가 그대로 쓴다(유지).

  // ── captionText 채워질 때 한 번 prepend ──────────────
  // caption.js 가 textarea.value 를 직접 할당하므로 input/change 이벤트가 안 뜸 →
  // MutationObserver 로 textarea 가 추가될 때까지 기다린 뒤, 부모 트리 변경 감지로 채워짐 시점 잡기.
  // value 변경은 DOM mutation 안 일어남 → setTimeout polling 으로 보강.
  let _watching = false;
  function _maybeApplyPrefill() {
    const ta = document.getElementById('captionText');
    if (!ta) return false;
    if (ta.hasAttribute(FLAG)) return false; // 이미 적용
    const prefill = _get();
    if (!prefill) return false;
    const cur = ta.value || '';
    // caption 결과 도착 시점: 비어있지 않고 길이 > 5
    if (!cur || cur.length < 5) return false;
    // 이미 prefill 줄을 포함하면 skip
    if (cur.indexOf(prefill) === 0) {
      ta.setAttribute(FLAG, '1');
      _clear();
      return true;
    }
    ta.value = prefill + '\n\n' + cur;
    ta.setAttribute(FLAG, '1');
    // textarea auto-grow 가 있으면 트리거
    try {
      if (typeof window._capAutoGrow === 'function') window._capAutoGrow(ta);
      const ev = new Event('input', { bubbles: true });
      ta.dispatchEvent(ev);
    } catch (_e) { void _e; }
    _clear();
    return true;
  }

  function _startCaptionWatcher() {
    if (_watching) return;
    _watching = true;
    // body 에 mutation observer — captionText 가 새로 생기거나 화면 전환될 때.
    const mo = new MutationObserver(() => { _maybeApplyPrefill(); });
    try { mo.observe(document.body, { childList: true, subtree: true }); }
    catch (_e) { void _e; }
    // value 변경은 mutation 안 잡힘 → 짧은 폴링 (prefill 있을 때만 활성).
    setInterval(() => {
      const has = !!_get();
      if (has) _maybeApplyPrefill();
    }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _startCaptionWatcher, { once: true });
  } else {
    _startCaptionWatcher();
  }

  window.CaptionPrefill = {
    set: _set,
    get: _get,
    clear: _clear,
    consume: _consume,
  };
})();
