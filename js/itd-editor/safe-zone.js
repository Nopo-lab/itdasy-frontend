/* safe-zone.js — 사진의 '얼굴/피사체 영역'을 추정해 텍스트 자동배치가 그 위를 안 덮게.
   [P2-1] window.ItdSafeZone.avoidBox(imgUrl) → Promise<{x,y,w,h}|null>  (모두 0..1 정규화)
   전략(안전): ① RegionMaskProvider.getMask('skinMask') 가 _dims 와 함께 신뢰도 있으면 그 bbox
              ② 안 되면 스킨톤 휴리스틱(32px 다운샘플, YCbCr 피부범위) — 오프라인서도 동작·검증가능
              ③ 둘 다 불확실(피부 비율 과소/과다) → null(폴백: 기존 배치 그대로)
   내용 분석이 아니라 '얼굴 위치만 피하기'. 권한 추가 없음(클라이언트 canvas + 기존 온디바이스 마스크). */
(function () {
  'use strict';
  if (window.ItdSafeZone) return;

  function _load(url) {
    return new Promise(function (res) {
      var im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = function () { res(im); }; im.onerror = function () { res(null); };
      im.src = url;
    });
  }

  // 스킨톤 bbox — YCbCr 피부 범위. 다운샘플 후 피부 픽셀의 경계상자(정규화).
  function _skinBox(img) {
    try {
      var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
      if (!iw || !ih) return null;
      var nw = 36, nh = Math.max(8, Math.round(nw * ih / iw));
      var c = document.createElement('canvas'); c.width = nw; c.height = nh;
      var g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0, nw, nh);
      var d = g.getImageData(0, 0, nw, nh).data;
      var minX = nw, minY = nh, maxX = -1, maxY = -1, skin = 0, total = nw * nh;
      for (var y = 0; y < nh; y++) for (var x = 0; x < nw; x++) {
        var i = (y * nw + x) * 4, r = d[i], gg = d[i + 1], b = d[i + 2];
        var Y = 0.299 * r + 0.587 * gg + 0.114 * b;
        var Cb = 128 - 0.168736 * r - 0.331264 * gg + 0.5 * b;
        var Cr = 128 + 0.5 * r - 0.418688 * gg - 0.081312 * b;
        var isSkin = Y > 45 && Cb >= 77 && Cb <= 130 && Cr >= 134 && Cr <= 176 && r > 60;
        if (isSkin) { skin++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
      }
      var frac = skin / total;
      if (maxX < 0 || frac < 0.03 || frac > 0.72) return null;   // 너무 적거나(피부 없음) 많으면(클로즈업/배경살색) 불확실 → 폴백
      return { x: minX / nw, y: minY / nh, w: (maxX - minX + 1) / nw, h: (maxY - minY + 1) / nh };
    } catch (_e) { return null; }
  }

  // RegionMaskProvider(skinMask) 의 _dims 가 있으면 그 bbox(더 정확). 없으면 null.
  function _providerBox(img) {
    try {
      var RM = window.RegionMaskProvider;
      if (!(RM && RM.getMask)) return Promise.resolve(null);
      return Promise.resolve(RM.getMask(img, 'skinMask')).then(function (r) {
        if (!r || !r.mask || (r.confidence != null && r.confidence < 0.25)) return null;
        var dims = r._dims; if (!dims || !dims.w || !dims.h) return null;
        var w = dims.w, h = dims.h, m = r.mask, minX = w, minY = h, maxX = -1, maxY = -1;
        for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
          if ((m[y * w + x] || 0) > 0.4) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
        }
        if (maxX < 0) return null;
        return { x: minX / w, y: minY / h, w: (maxX - minX + 1) / w, h: (maxY - minY + 1) / h };
      }).catch(function () { return null; });
    } catch (_e) { return Promise.resolve(null); }
  }

  // 공개: 회피 박스(정규화) 또는 null. 약간의 여백(버퍼) 추가.
  function avoidBox(imgUrl) {
    if (!imgUrl) return Promise.resolve(null);
    return _load(imgUrl).then(function (img) {
      if (!img) return null;
      return _providerBox(img).then(function (pb) {
        var box = pb || _skinBox(img);
        if (!box) return null;
        var pad = 0.04;   // 글자가 너무 붙지 않게 버퍼
        return {
          x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad),
          w: Math.min(1, box.w + pad * 2), h: Math.min(1, box.h + pad * 2),
          source: pb ? 'mask' : 'skin'
        };
      });
    }).catch(function () { return null; });
  }

  window.ItdSafeZone = { avoidBox: avoidBox, _skinBox: _skinBox };
})();
