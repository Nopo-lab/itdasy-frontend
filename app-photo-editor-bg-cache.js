/* 사진 편집기 — 누끼 결과 재사용 캐시 */
(function () {
  'use strict';
  if (window.PhotoEditorBgCache) return;

  const cache = new Map();
  let wrapped = false;

  function keyOf(src) {
    // [2026-06-10] 길이+앞뒤 조각만 보던 키 → 1KB 간격 샘플링 해시 추가.
    //   같은 사진을 못 알아보고 유료 누끼 API 를 또 부르던 충돌/미스 감소 (비용 방어).
    const s = String(src || '');
    let h = 5381;
    for (let i = 0; i < s.length; i += 1024) h = (((h << 5) + h) + s.charCodeAt(i)) >>> 0;
    return s.length + ':' + h + ':' + s.slice(-64);
  }

  function remember(key, removed) {
    if (!key || !removed) return;
    cache.set(key, removed);
    // [2026-06-10] 6 → 10장 — 한 세션에서 여러 장 작업 시 재누끼 빈도 축소
    while (cache.size > 10) cache.delete(cache.keys().next().value);
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
