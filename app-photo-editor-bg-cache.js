/* 사진 편집기 — 누끼 결과 재사용 캐시 */
(function () {
  'use strict';
  if (window.PhotoEditorBgCache) return;

  const cache = new Map();
  let wrapped = false;

  function keyOf(src) {
    const s = String(src || '');
    return [s.length, s.slice(0, 120), s.slice(-120)].join('|');
  }

  function remember(key, removed) {
    if (!key || !removed) return;
    cache.set(key, removed);
    while (cache.size > 6) cache.delete(cache.keys().next().value);
  }

  function wrap() {
    if (wrapped || typeof window.composeBgForEditor !== 'function') return false;
    const original = window.composeBgForEditor;
    window.composeBgForEditor = async function (srcUrl, bgId, ratio, preRemovedBgUrl) {
      const k = keyOf(srcUrl);
      const cached = preRemovedBgUrl || cache.get(k) || null;
      const result = await original(srcUrl, bgId, ratio, cached);
      remember(k, result && result.removedBgDataUrl);
      return result;
    };
    wrapped = true;
    return true;
  }

  function boot() {
    if (wrap()) return;
    let tries = 0;
    const iv = setInterval(() => { if (wrap() || ++tries > 80) clearInterval(iv); }, 100);
  }

  window.PhotoEditorBgCache = { wrap, size: () => cache.size, clear: () => cache.clear() };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
