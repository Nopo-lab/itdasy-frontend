/* 첫 로딩 분할 로더 (1단계 · 2026-06-11)
   목적: 첫 진입에 271개 스크립트를 전부 실행하던 것을 그룹 분리 —
   사진(편집기+갤러리) 그룹은 ①홈 렌더 후 유휴 시간에 선로딩 ②그 전에
   사진 기능 진입 시 ensure() 가 로드를 보장.

   사용: AppLoader.ensure('photo').then(...) / AppLoader.loaded('photo')
   매니페스트: js/load-groups.js (window.APP_LOAD_GROUPS — index.html 원래 순서 보존)

   동작 원리: 동적 script 에 async=false → 다운로드는 병렬, 실행은 삽입 순서 보장
   (기존 defer 와 동일한 순서 의미론. 전역 의존 모듈 안전). */
(function () {
  'use strict';
  if (window.AppLoader) return;

  const _done = {};     // group → true (전부 로드·실행 완료)
  const _inflight = {}; // group → Promise

  function _loadOne(src) {
    return new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = false; // 순서 보장 (ordered async)
      s.onload = () => resolve(true);
      s.onerror = () => {
        // 한 파일 실패로 전체 그룹을 막지 않음 — sw.js install 의 allSettled 와 동일 철학
        console.warn('[loader] 로드 실패:', src);
        resolve(false);
      };
      document.head.appendChild(s);
    });
  }

  function ensure(group) {
    if (_done[group]) return Promise.resolve(true);
    if (_inflight[group]) return _inflight[group];
    const list = (window.APP_LOAD_GROUPS || {})[group];
    if (!Array.isArray(list) || !list.length) {
      console.warn('[loader] 알 수 없는 그룹:', group);
      return Promise.resolve(false);
    }
    _inflight[group] = Promise.all(list.map(_loadOne)).then(() => {
      _done[group] = true;
      delete _inflight[group];
      try { window.dispatchEvent(new CustomEvent('apploader:loaded', { detail: { group } })); }
      catch (_e) { void _e; }
      return true;
    });
    return _inflight[group];
  }

  function loaded(group) { return !!_done[group]; }

  window.AppLoader = { ensure, loaded };

  /* ── 사진 기능 진입 안전망 ──────────────────────────────
     유휴 선로딩이 끝나기 전(부팅 직후 수 초)에 사용자가 사진 기능에
     진입하면 그룹 로드 후 진짜 함수로 이어준다. 그룹 D 모듈이 로드되며
     아래 스텁을 자기 정의로 덮어쓰므로 1회성. */
  function _stub(name, after) {
    const stub = function () {
      const args = arguments;
      if (window.showToast) window.showToast('사진 도구 준비 중…');
      ensure('photo').then(() => {
        const real = window[name];
        if (typeof real === 'function' && real !== stub) real.apply(null, args);
        else if (typeof after === 'function') after.apply(null, args);
      });
    };
    stub._loaderStub = true;
    if (typeof window[name] !== 'function') window[name] = stub;
  }
  _stub('initWorkshopTab');
  _stub('initFinishTab');
  _stub('initAiRecommendTab');
  _stub('openGalleryWrite');

  /* ── 유휴 선로딩 — 홈 첫 페인트를 막지 않게 load 이후 idle 에 시작 ── */
  function _prefetch() {
    const go = () => { ensure('photo'); };
    if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 4000 });
    else setTimeout(go, 1500);
  }
  if (document.readyState === 'complete') _prefetch();
  else window.addEventListener('load', _prefetch, { once: true });
})();
