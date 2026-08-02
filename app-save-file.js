/* 파일 저장 공용 헬퍼 — 네이티브에서도 실제로 저장되게, 그리고 거짓 성공을 안 띄우게.
 *
 * [출시감사 2026-08-01 P0] 앱 곳곳이 이렇게 저장하고 있었다:
 *     const a = document.createElement('a'); a.href = blobUrl; a.download = name; a.click();
 *     toast('저장 완료');                       ← ★ 성공 여부와 무관하게 무조건
 *
 *   문제: **iOS WKWebView·Android Capacitor WebView 는 `<a download>` 로 data:/blob: 를
 *   저장하지 못한다.** 아무 일도 안 일어나는데 "저장했어요" 가 뜬다.
 *   원장님은 저장된 줄 알고 앱을 닫고, 사진첩을 열면 사진이 없다.
 *   백업·데이터 내보내기(개인정보 이동권 대응)도 같은 이유로 파일이 안 생기는데
 *   "내보내기 완료" 만 떴다 — 심사·법무 리스크.
 *
 *   같은 레포 app-gallery-finish.js:290 이 이미 올바른 패턴(navigator.share + canShare)을
 *   쓰고 있었고 @capacitor/share 도 설치돼 있다. 그걸 공용으로 뽑았다.
 *
 * 사용법:
 *   const r = await window.saveFile(blobOrDataUrl, 'itdasy_backup.zip');
 *   if (r.ok) toast('저장했어요'); else toast('저장하지 못했어요');
 *   // r.reason: 'aborted'(사용자가 공유 시트 닫음) | 'native_no_share' | 'failed'
 *
 * 반환은 항상 Promise. **성공했을 때만 ok:true** 다 — 호출부는 이 값으로만 토스트를 띄울 것.
 */
(function () {
  'use strict';

  function _isNative() {
    try {
      return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    } catch (_e) { return false; }
  }

  function _toBlob(src, mime) {
    if (src instanceof Blob) return Promise.resolve(src);
    // data: / blob: URL 문자열
    return fetch(src).then(function (r) { return r.blob(); }).catch(function () {
      return mime ? new Blob([src], { type: mime }) : null;
    });
  }

  /**
   * @param {Blob|string} src  Blob 또는 data:/blob: URL
   * @param {string} filename  확장자 포함
   * @returns {Promise<{ok:boolean, via?:string, reason?:string}>}
   */
  function saveFile(src, filename) {
    if (!src) return Promise.resolve({ ok: false, reason: 'no_data' });
    var name = filename || 'itdasy';

    return _toBlob(src).then(function (blob) {
      if (!blob) return { ok: false, reason: 'no_data' };

      // 1) 공유 시트 — 네이티브에서 사진첩/파일앱에 실제로 저장되는 유일한 경로
      var canShareFiles = false;
      var files = null;
      try {
        files = [new File([blob], name, { type: blob.type || 'application/octet-stream' })];
        canShareFiles = !!(navigator.share && navigator.canShare && navigator.canShare({ files: files }));
      } catch (_e) { canShareFiles = false; }

      if (canShareFiles) {
        return navigator.share({ files: files, title: name })
          .then(function () { return { ok: true, via: 'share' }; })
          .catch(function (e) {
            // 사용자가 시트를 닫은 건 오류가 아니다 — 성공 토스트만 안 띄운다.
            if (e && e.name === 'AbortError') return { ok: false, reason: 'aborted' };
            return _viaDownload(blob, name);
          });
      }
      return _viaDownload(blob, name);
    }).catch(function () {
      return { ok: false, reason: 'failed' };
    });
  }

  function _viaDownload(blob, name) {
    // 네이티브인데 공유가 안 되면 저장할 방법이 없다. **거짓 성공을 만들지 않는다.**
    if (_isNative()) return { ok: false, reason: 'native_no_share' };
    try {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click();
      setTimeout(function () {
        try { a.remove(); URL.revokeObjectURL(url); } catch (_e) { void _e; }
      }, 1000);
      return { ok: true, via: 'download' };
    } catch (_e) {
      return { ok: false, reason: 'failed' };
    }
  }

  window.saveFile = saveFile;
})();
