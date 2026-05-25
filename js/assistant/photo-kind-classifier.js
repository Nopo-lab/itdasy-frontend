/* AI 잇비 — 첨부 사진 종류 가벼운 추정
   무거운 글자 인식 없이 사진 비율/밝은 배경 비율만 보고 버튼 강조에만 사용한다. */
(function () {
  'use strict';

  function _fileToImage(file) {
    return new Promise(resolve => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  }

  function _sampleImage(img) {
    const max = 96;
    const ratio = img.width / Math.max(1, img.height);
    const w = ratio >= 1 ? max : Math.max(1, Math.round(max * ratio));
    const h = ratio >= 1 ? Math.max(1, Math.round(max / ratio)) : max;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    return { ratio, data: ctx.getImageData(0, 0, w, h).data };
  }

  function _whiteRatio(data) {
    let white = 0;
    const total = Math.max(1, data.length / 4);
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r > 226 && g > 226 && b > 226 && Math.abs(r - g) < 24 && Math.abs(g - b) < 24) white += 1;
    }
    return white / total;
  }

  async function classify(file) {
    try {
      const img = await _fileToImage(file);
      if (!img) return 'enhance';
      const sample = _sampleImage(img);
      const white = _whiteRatio(sample.data);
      if (sample.ratio < 0.72) return 'kakao';
      if (sample.ratio > 1.45 && sample.ratio < 1.85 && white > 0.62) return 'card';
      if (white > 0.72) return 'price';
    } catch (_e) {
      return 'enhance';
    }
    return 'enhance';
  }

  window.ItdasyAssistantPhotoKind = { classify };
})();
