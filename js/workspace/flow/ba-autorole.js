/* ba-autorole.js — 전후(before/after) 역할 자동추정 (다양성 팩, 2026-07-12)
   업로드 순서(첫=전·둘째=후) 기본은 유지하되, 자동배치된 2장에 한해 순서를 재추정:
     ① EXIF 촬영시각 — 먼저 찍은 사진이 '전'(신뢰 우선)
     ② 밝기 폴백 — 시술 후가 보통 더 화사. '전'이 '후'보다 확연히 밝으면(>margin) 뒤바뀐 것으로 보고 스왑
   순수 헬퍼 + 판정만. 사용자가 직접 지정(roleManual)한 사진은 절대 안 건드림(호출부에서 가드).
   window.WSBAAutoRole 로 노출. 모듈이 없으면 flow 는 기존 순서배치 그대로(회귀 0). */
(function () {
  'use strict';
  if (window.WSBAAutoRole) return;

  var LUM_MARGIN = 18;   // 0..255. 밝기 스왑은 확연한 차이일 때만(오판 방지).

  // JPEG APP1 EXIF 에서 DateTimeOriginal(0x9003)/DateTime(0x0132) → 비교용 epoch(ms). 실패 시 null.
  function readExifTime(file) {
    return new Promise(function (resolve) {
      try {
        if (!file || !/jpe?g/i.test(file.type || '') || !file.slice) { resolve(null); return; }
        var fr = new FileReader();
        fr.onerror = function () { resolve(null); };
        fr.onload = function () {
          try {
            var dv = new DataView(fr.result);
            if (dv.getUint16(0) !== 0xFFD8) { resolve(null); return; }
            var off = 2, len = dv.byteLength;
            while (off + 4 <= len) {
              var marker = dv.getUint16(off); off += 2;
              if (marker === 0xFFE1) {
                if (dv.getUint32(off + 2) !== 0x45786966) { resolve(null); return; }   // "Exif"
                var tiff = off + 8;
                var little = dv.getUint16(tiff) === 0x4949;
                var u16 = function (o) { return dv.getUint16(o, little); };
                var u32 = function (o) { return dv.getUint32(o, little); };
                var ifd0 = tiff + u32(tiff + 4);
                var exifIFD = null, e0 = u16(ifd0), i;
                for (i = 0; i < e0; i++) { var en = ifd0 + 2 + i * 12; if (u16(en) === 0x8769) { exifIFD = tiff + u32(en + 8); break; } }
                var scan = function (ifd) {
                  if (!ifd || ifd + 2 > len) return null;
                  var n = u16(ifd);
                  for (var j = 0; j < n; j++) {
                    var ee = ifd + 2 + j * 12, tag = u16(ee);
                    if (tag === 0x9003 || tag === 0x0132) {
                      var cnt = u32(ee + 4), vo = u32(ee + 8) + tiff, s = '';
                      for (var k = 0; k < cnt - 1 && vo + k < len; k++) s += String.fromCharCode(dv.getUint8(vo + k));
                      return s;
                    }
                  }
                  return null;
                };
                var dt = scan(exifIFD) || scan(ifd0);
                var m = dt && dt.match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
                resolve(m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null);
                return;
              }
              if ((marker & 0xFF00) !== 0xFF00) { resolve(null); return; }
              off += dv.getUint16(off);
            }
            resolve(null);
          } catch (_e) { resolve(null); }
        };
        fr.readAsArrayBuffer(file.slice(0, 131072));   // EXIF 는 헤더 근처 — 앞 128KB 만
      } catch (_e) { resolve(null); }
    });
  }

  // 다운스케일(32x32) 평균 휘도 0..255. 실패 시 null.
  function imgLuma(src) {
    return new Promise(function (resolve) {
      if (!src) { resolve(null); return; }
      var img = new Image();
      if (/^https?:/.test(src)) img.crossOrigin = 'anonymous';
      img.onerror = function () { resolve(null); };
      img.onload = function () {
        try {
          var w = 32, h = 32, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
          var ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
          var data = ctx.getImageData(0, 0, w, h).data, sum = 0;
          for (var i = 0; i < data.length; i += 4) sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          resolve(sum / (w * h));
        } catch (_e) { resolve(null); }
      };
      img.src = src;
    });
  }

  // 순서배치된 쌍 [first(전), second(후)] 이 뒤바뀌었는지 판정. { swap, by }.
  function decide(first, second) {
    if (!first || !second) return { swap: false };
    var ft = first._captureTime, st = second._captureTime;
    if (ft != null && st != null && ft !== st) return { swap: ft > st, by: 'exif' };   // 첫 사진이 더 나중 촬영이면 스왑
    if (first._lum != null && second._lum != null && (first._lum - second._lum) > LUM_MARGIN) return { swap: true, by: 'lum' };
    return { swap: false };
  }

  window.WSBAAutoRole = { readExifTime: readExifTime, imgLuma: imgLuma, decide: decide, _margin: LUM_MARGIN };
})();
