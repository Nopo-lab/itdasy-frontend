/* 사진 편집기 — L3 생성형 mock API 클라이언트
   백엔드 /photo-editor/generative/create 만 호출한다. provider 직접 호출 0. */
(function () {
  'use strict';
  if (window.PhotoEditorGenerativeClient) return;

  var ENDPOINT = '/photo-editor/generative/create';
  var TIMEOUT_MS = 20000;

  function _authHeader() {
    try { return (typeof window.authHeader === 'function') ? window.authHeader() : {}; }
    catch (_e) { return {}; }
  }

  function _imgToBlob(img) {
    return new Promise(function (resolve) {
      try {
        if (!img) return resolve(null);
        var w = img.naturalWidth || img.width;
        var h = img.naturalHeight || img.height;
        if (!w || !h) return resolve(null);
        var cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        if (cv.toBlob) cv.toBlob(function (blob) { resolve(blob); }, 'image/jpeg', 0.9);
        else resolve(null);
      } catch (_e) { resolve(null); }
    });
  }

  function _ratioFor(state, fallback) {
    var r = fallback || (state && state.ratio) || '1:1';
    return r === 'original' ? '1:1' : r;
  }

  function _codeFor(status, detail) {
    var d = typeof detail === 'string' ? detail : ((detail && detail.code) || '');
    if (status === 401) return 'auth';
    if (status === 403 && /consent/i.test(d)) return 'consent_required';
    if (status === 403) return 'pro_required';
    if (status === 429) return 'quota';
    if (status === 400) return d || 'bad_request';
    if (status >= 500) return 'server';
    return 'error';
  }

  function create(state, opts) {
    opts = opts || {};
    var img = state && state.originalImg;
    if (!img) return Promise.resolve({ ok: false, code: 'no_image', status: 0 });
    return _imgToBlob(img).then(function (blob) {
      if (!blob) return { ok: false, code: 'no_image', status: 0 };
      var fd = new FormData();
      fd.append('image', blob, 'photo.jpg');
      fd.append('mode', opts.mode || 'clean_background');
      fd.append('shop_type', opts.shop_type || opts.shopType || '');
      fd.append('target_ratio', _ratioFor(state, opts.target_ratio));
      fd.append('prompt_preset', opts.prompt_preset || 'default');
      fd.append('has_before', String(!!(state && state.secondImg)));
      if (opts.template_id) fd.append('template_id', opts.template_id);
      if (opts.region_hint) fd.append('region_hint', opts.region_hint);

      var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS) : null;
      return window.apiFetch(ENDPOINT, {
        method: 'POST',
        headers: _authHeader(),
        body: fd,
        signal: ctrl ? ctrl.signal : undefined,
      }).then(function (res) {
        if (timer) clearTimeout(timer);
        return res.json().catch(function () { return {}; }).then(function (body) {
          if (!res.ok) {
            return { ok: false, code: _codeFor(res.status, body.detail), status: res.status, detail: body.detail };
          }
          return { ok: true, data: body, status: res.status };
        });
      }).catch(function (err) {
        if (timer) clearTimeout(timer);
        return { ok: false, code: (err && err.name === 'AbortError') ? 'timeout' : 'network', status: 0 };
      });
    });
  }

  window.PhotoEditorGenerativeClient = { create: create, ENDPOINT: ENDPOINT };
})();

