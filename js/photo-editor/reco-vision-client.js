/* 사진 편집기 — PE-AI-1B Vision API 클라이언트
   백엔드 프록시 POST /photo-editor/ai/analyze 만 호출한다. Vision(외부 모델) 직접 호출 0.
   이미지 소스 = 현재 편집 "원본"(state.originalImg) — 과보정된 캔버스 아님.
   has_before = state.secondImg 존재 여부.
   반환: { ok, data } 또는 { ok:false, code, status, detail }. */
(function () {
  'use strict';
  if (window.PhotoEditorVisionClient) return;

  var TIMEOUT_MS = 15000;

  function _authHeader() {
    try { return (typeof window.authHeader === 'function') ? window.authHeader() : {}; }
    catch (_e) { return {}; }
  }

  function _imgToBlob(img) {
    return new Promise(function (resolve) {
      try {
        if (!img) return resolve(null);
        var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
        if (!w || !h) return resolve(null);
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        if (c.toBlob) c.toBlob(function (b) { resolve(b); }, 'image/jpeg', 0.9);
        else resolve(null);
      } catch (_e) { resolve(null); }
    });
  }

  function analyze(state) {
    var img = state && state.originalImg;
    if (!img) return Promise.resolve({ ok: false, code: 'no_image', status: 0 });
    return _imgToBlob(img).then(function (blob) {
      if (!blob) return { ok: false, code: 'no_image', status: 0 };
      var fd = new FormData();
      fd.append('image', blob, 'photo.jpg');
      fd.append('has_before', String(!!(state && state.secondImg)));
      try {
        var st = (window.localStorage && localStorage.getItem('shop_type')) || '';
        if (st) fd.append('shop_type', st);
      } catch (_e) { /* noop */ }

      var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS) : null;

      return window.apiFetch('/photo-editor/ai/analyze', {
        method: 'POST',
        headers: _authHeader(),     // FormData → Content-Type 은 브라우저가 boundary 와 함께 설정
        body: fd,
        signal: ctrl ? ctrl.signal : undefined,
      }).then(function (res) {
        if (timer) clearTimeout(timer);
        if (!res.ok) {
          return res.json().catch(function () { return {}; }).then(function (j) {
            var detail = (j && j.detail) || '';
            var code = 'error';
            if (res.status === 403 && /consent/i.test(detail)) code = 'consent_required';
            else if (res.status === 403) code = 'pro_required';
            else if (res.status === 429) code = 'quota';
            else if (res.status === 401) code = 'auth';
            else if (res.status === 502) code = 'vision_failed';
            else if (res.status === 504) code = 'timeout';
            return { ok: false, code: code, status: res.status, detail: detail };
          });
        }
        return res.json().then(function (data) { return { ok: true, data: data, status: res.status }; })
          .catch(function () { return { ok: false, code: 'parse', status: res.status }; });
      }).catch(function (e) {
        if (timer) clearTimeout(timer);
        return { ok: false, code: (e && e.name === 'AbortError') ? 'timeout' : 'network', status: 0 };
      });
    });
  }

  window.PhotoEditorVisionClient = { analyze: analyze };
})();
