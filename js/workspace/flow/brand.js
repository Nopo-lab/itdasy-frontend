/* workspace/flow/brand.js — 우리샵 스타일(브랜드킷·레이아웃 프리셋) 클러스터 분리 (T-104 P5, 2026-07-10)
   추천색/폰트/하모니/알아서예쁘게/업종/로고 + 레이아웃 프리셋 A~G(적용·이름변경·복사·썸네일).
   대체로 ShopStyle(우리샵 스타일)·localStorage 를 다룬다. context 주입: D()=현재 d.
   setScreen/curPhoto/cleanBase/dispUrl 은 ctx, toast/_extractPalette/_thEsc 는 WSFlowUtil,
   _splitServiceForLayers 는 WSCaptionText. window.WSFlowBrand.create(ctx) → 함수 묶음(노출 11개). */
(function () {
  'use strict';
  function create(ctx) {
    var WSU = window.WSFlowUtil || {}, toast = WSU.toast, _extractPalette = WSU._extractPalette, _thEsc = WSU._thEsc;
    var setScreen = ctx.setScreen, curPhoto = ctx.curPhoto, _cleanBase = ctx.cleanBase, dispUrl = ctx.dispUrl;
    function D() { return ctx.d(); }
    function _splitServiceForLayers(s) { return (window.WSCaptionText && window.WSCaptionText.splitServiceForLayers) ? window.WSCaptionText.splitServiceForLayers(s) : {}; }

    // 추천 색 → 활성 우리샵 스타일의 모든 텍스트 역할 글자색에 적용(저장 + 미리보기 재합성).
    function _applyBrandColor(hex) {
      try {
        var SS = window.ShopStyle; if (!(SS && SS.getActive && SS.save)) return;
        var ss = SS.getActive(); if (!ss || !Array.isArray(ss.layers)) return;
        var TEXT = { title: 1, sub: 1, body: 1, hashtag: 1 };
        var layers = ss.layers.map(function (L) { return TEXT[L.role] ? Object.assign({}, L, { color: hex }) : L; });
        SS.save(ss.id, { layers: layers });
        (D().photos || []).forEach(function (p) { p._tplSig = null; });   // 미리보기 재합성 유도
        toast('우리샵 글자색을 바꿨어요');
        setScreen('caption');
      } catch (_e) { void _e; }
    }
    function _applyBrandFont(key) {
      try {
        var SS = window.ShopStyle; if (!(SS && SS.getActive && SS.save)) return;
        var ss = SS.getActive(); if (!ss || !Array.isArray(ss.layers)) return;
        var TEXT = { title: 1, sub: 1, body: 1, hashtag: 1 };
        var layers = ss.layers.map(function (L) { return TEXT[L.role] ? Object.assign({}, L, { font: key }) : L; });
        SS.save(ss.id, { layers: layers });
        (D().photos || []).forEach(function (p) { p._tplSig = null; });
        toast('우리샵 폰트를 바꿨어요'); setScreen('caption');
      } catch (_e) { void _e; }
    }
    function _applyHarmony(key) {
      try {
        var h = (window.WSHarmony || []).filter(function (x) { return x.key === key; })[0]; if (!h) return;
        var SS = window.ShopStyle; if (!(SS && SS.getActive && SS.save)) return;
        var ss = SS.getActive(); if (!ss || !Array.isArray(ss.layers)) return;
        var layers = ss.layers.map(function (L) {
          if (L.role === 'title') return Object.assign({}, L, { font: h.titleFont, color: h.color });
          if (L.role === 'sub' || L.role === 'body' || L.role === 'hashtag') return Object.assign({}, L, { font: h.bodyFont, color: h.sub || h.color });
          return L;
        });
        SS.save(ss.id, { layers: layers });
        (D().photos || []).forEach(function (p) { p._tplSig = null; });
        toast('어울리는 조합을 적용했어요'); setScreen('caption');
      } catch (_e) { void _e; }
    }
    // [다양성 팩 2026-07-12] 업종(shop_type) → 어울리는 하모니 매핑. 피부과·Y2K네일 등이 같은 크림/로즈
    //   쓰던 문제 해소 — 버티컬별로 서로 다른 색·폰트 조합을 기본 적용. 웜 계열(헤어·속눈썹 등)은 사진 밝기로.
    function _harmonyForShop() {
      var raw = ''; try { raw = localStorage.getItem('shop_type') || ''; } catch (_e) { raw = ''; }
      var ALIAS = (window.ItdasyServiceVocab && window.ItdasyServiceVocab.ALIAS) || {};
      var vert = ALIAS[raw] || ALIAS[String(raw).toLowerCase()] || raw;
      var MAP = { '피부': 'clinic', '에스테틱': 'clinic', '두피': 'clinic', '네일': 'y2k', '네일아트': 'y2k', '반영구': 'noir', '메이크업': 'noir', '태닝': 'bold', '왁싱': 'botanical' };
      return MAP[vert] || null;   // null → 웜(밝기 기반 rose/cream)
    }
    // 원탭 '알아서 예쁘게' — 프리셋 A + 어울리는 색·폰트(하모니). 업종 매핑 우선, 없으면 대표색으로 rose/cream.
    function _autoPretty() {
      try {
        if (window.ShopStyle && window.ShopStyle.ensureSeed) window.ShopStyle.ensureSeed();
        D().useShopStyle = true;
        var apply = function (harmonyKey) {
          try { _applyPreset('A'); } catch (_e1) { void _e1; }   // 깔끔한 레이아웃(검증된 경로)
          _applyHarmony(harmonyKey);   // 색·폰트 입힘(setScreen 포함) → 마지막 한 번만 렌더
        };
        var vKey = _harmonyForShop();
        if (vKey) { apply(vKey); return; }   // 업종 전용 조합(clinic/y2k/noir/bold/botanical)
        var p0 = curPhoto && curPhoto(); var url = p0 && _cleanBase(p0);
        if (url && typeof _extractPalette === 'function') {
          _extractPalette(url, function (cols) {
            var dark = false;
            if (cols && cols[0]) { var h = cols[0].replace('#', ''); var r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16); dark = (0.299 * r + 0.587 * g + 0.114 * b) < 130; }
            apply(dark ? 'rose' : 'cream');
          });
        } else { apply('cream'); }
      } catch (_e) { void _e; }
    }
    // 업종(shop_type) 설정 — 캡션 카테고리·키워드 기준.
    function _setShopType(t) {
      try { localStorage.setItem('shop_type', t); } catch (_e) { void _e; }
      try { if (typeof window.renderCaptionKeywordTags === 'function') window.renderCaptionKeywordTags(); } catch (_e2) { void _e2; }
      toast('업종을 ‘' + t + '’로 설정했어요'); setScreen('caption');
    }
    // 로고 등록/제거 — 활성 스타일에 저장하면 _buildShopStyleLayers 가 모든 게시물에 자동 합성.
    function _setBrandLogo(dataUrl) {
      try {
        var SS = window.ShopStyle; var ss = SS && SS.getActive && SS.getActive(); if (!ss) return;
        SS.save(ss.id, { logo: Object.assign({ x: 0.72, y: 0.07, w: 0.22, opacity: 0.95 }, ss.logo || {}, { dataUrl: dataUrl }) });
        (D().photos || []).forEach(function (p) { p._tplSig = null; });
        toast('로고를 등록했어요'); setScreen('caption');
      } catch (_e) { void _e; }
    }
    function _clearBrandLogo() {
      try { var SS = window.ShopStyle; var ss = SS && SS.getActive(); if (!ss) return; SS.save(ss.id, { logo: null }); (D().photos || []).forEach(function (p) { p._tplSig = null; }); toast('로고를 뺐어요'); setScreen('caption'); } catch (_e) { void _e; }
    }
    function _brandLogoFromFile(file, cb) {
      if (!file || !/^image\//.test(file.type)) return;
      var rd = new FileReader();
      rd.onload = function () {
        var img = new Image();
        img.onload = function () {
          var max = 400, sc = Math.min(1, max / Math.max(img.width, img.height));
          var w = Math.max(1, Math.round(img.width * sc)), h = Math.max(1, Math.round(img.height * sc));
          var cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').drawImage(img, 0, 0, w, h);
          var url; try { url = cv.toDataURL('image/png'); } catch (_) { url = rd.result; } cb(url);
        };
        img.onerror = function () { cb(rd.result); };
        img.src = rd.result;
      };
      rd.readAsDataURL(file);
    }
    // 초보자 레이아웃 프리셋 A~G — 시술명(굵게)/선/시술내용 레이어 세트. 폰트는 ItdEditor 키.
    function _presetLayers(key) {
      if (key === 'B') return [
        { type: 'line', x: 0.43, y: 0.405, w: 0.14, size: 0.004, color: '#ffffff', opacity: 0.92 },
        { role: 'title', x: 0.08, y: 0.475, w: 0.84, size: 0.062, weight: 700, font: 'songmyung', color: '#ffffff', align: 'center', letterSpacing: 0.06, lineHeight: 1.22, shadow: { on: true } },
        { role: 'body', x: 0.10, y: 0.545, w: 0.80, size: 0.030, weight: 500, font: 'dodum', color: '#ffffff', align: 'center', letterSpacing: 0.02, lineHeight: 1.5, opacity: 0.95, shadow: { on: true } },
        { type: 'line', x: 0.43, y: 0.60, w: 0.14, size: 0.004, color: '#ffffff', opacity: 0.92 }
      ];
      if (key === 'C') return [
        { type: 'line', x: 0.075, y: 0.845, w: 0.13, size: 0.008, color: '#ffffff', rot: 90 },
        { role: 'title', x: 0.155, y: 0.815, w: 0.74, size: 0.060, weight: 800, font: 'jua', color: '#ffffff', align: 'left', lineHeight: 1.12, shadow: { on: true } },
        { role: 'body', x: 0.155, y: 0.882, w: 0.74, size: 0.031, weight: 500, font: 'dodum', color: '#ffffff', align: 'left', lineHeight: 1.45, opacity: 0.95, shadow: { on: true } }
      ];
      if (key === 'D') return [
        { role: 'title', x: 0.10, y: 0.105, w: 0.80, size: 0.050, weight: 800, font: 'dohyeon', color: '#ffffff', align: 'center', lineHeight: 1.1, shadow: { on: true } },
        { role: 'body', x: 0.12, y: 0.162, w: 0.76, size: 0.028, weight: 500, font: 'dodum', color: '#ffffff', align: 'center', opacity: 0.95, shadow: { on: true } }
      ];
      if (key === 'E') return [
        { type: 'line', x: 0.83, y: 0.845, w: 0.13, size: 0.008, color: '#ffffff', rot: 90 },
        { role: 'title', x: 0.08, y: 0.815, w: 0.74, size: 0.060, weight: 800, font: 'black', color: '#ffffff', align: 'right', lineHeight: 1.1, shadow: { on: true } },
        { role: 'body', x: 0.08, y: 0.882, w: 0.74, size: 0.031, weight: 500, font: 'dodum', color: '#ffffff', align: 'right', opacity: 0.95, shadow: { on: true } }
      ];
      if (key === 'F') return [
        { role: 'title', x: 0.10, y: 0.46, w: 0.80, size: 0.072, weight: 400, font: 'pen', color: '#ffffff', align: 'center', lineHeight: 1.18, shadow: { on: true } },
        { role: 'body', x: 0.12, y: 0.55, w: 0.76, size: 0.028, weight: 500, font: 'dodum', color: '#ffffff', align: 'center', opacity: 0.92, shadow: { on: true } }
      ];
      if (key === 'G') return [
        { type: 'rect', x: 0.0, y: 0.80, w: 1.0, h: 0.20, color: 'rgba(18,14,16,.40)', radius: 0, role: 'panel' },
        { role: 'title', x: 0.07, y: 0.825, w: 0.82, size: 0.058, weight: 800, font: 'gothica1', color: '#ffffff', align: 'left', lineHeight: 1.1 },
        { role: 'body', x: 0.07, y: 0.880, w: 0.62, size: 0.030, weight: 500, font: 'dodum', color: '#ffffff', align: 'left', opacity: 0.95 },
        { type: 'badge', text: '예약 DM', x: 0.72, y: 0.875, w: 0.21, size: 0.026, bg: '#BC6675', color: '#ffffff', font: 'dodum', align: 'center' }
      ];
      return [
        { type: 'rect', x: 0.072, y: 0.745, w: 0.055, h: 0.028, color: '#BC6675', radius: 5, role: 'accent' },
        { role: 'title', x: 0.07, y: 0.795, w: 0.82, size: 0.068, weight: 800, font: 'black', color: '#ffffff', align: 'left', letterSpacing: -0.01, lineHeight: 1.06, shadow: { on: true } },
        { type: 'line', x: 0.072, y: 0.857, w: 0.15, size: 0.006, color: '#BC6675' },
        { role: 'body', x: 0.072, y: 0.902, w: 0.82, size: 0.033, weight: 500, font: 'dodum', color: '#ffffff', align: 'left', letterSpacing: 0.01, lineHeight: 1.45, opacity: 0.95, shadow: { on: true } }
      ];
    }
    function _presetName(key) { try { var m = JSON.parse(localStorage.getItem('itdasy:preset_names') || '{}'); return m[key] || ('레이아웃 ' + key); } catch (_e) { return '레이아웃 ' + key; } }
    function _setPresetName(key, name) { try { var m = JSON.parse(localStorage.getItem('itdasy:preset_names') || '{}'); m[key] = name; localStorage.setItem('itdasy:preset_names', JSON.stringify(m)); } catch (_e) { void _e; } }
    function _findPresetStyle(key) { return ((window.ShopStyle && window.ShopStyle.list) ? window.ShopStyle.list() : []).filter(function (s) { return s.presetKey === key || s.name === ('기본 레이아웃 ' + key) || s.name === _presetName(key); })[0]; }
    function _presetThumb(key) {
      var W = 46, H = 58, ls = _presetLayers(key);
      var photoSrc = dispUrl(curPhoto());
      var rt = _splitServiceForLayers(D().service || '');
      var labelFor = function (role) {
        if (role === 'title') return rt.title || '텍스트1';
        if (role === 'sub') return rt.sub || '텍스트2';
        if (role === 'body') return rt.body || (rt.sub ? '' : '내용');
        if (role === 'hashtag') return '#태그';
        return '';
      };
      var els = ls.map(function (L) {
        if (L.type === 'line') {
          var lw = (L.w != null ? L.w : 0.1) * W, th = Math.max(1.2, (L.size || 0.005) * H * 4.2);
          var cxv = (L.x + (L.w != null ? L.w : 0.1) / 2) * W, cyv = L.y * H;
          return '<rect x="' + (cxv - lw / 2).toFixed(1) + '" y="' + (cyv - th / 2).toFixed(1) + '" width="' + lw.toFixed(1) + '" height="' + th.toFixed(1) + '" rx="1" fill="#fff"/>';
        }
        var txt = labelFor(L.role); if (!txt) return '';
        txt = txt.length > 9 ? txt.slice(0, 9) : txt;
        var fs = Math.max(3.4, Math.min(6.2, (L.size || 0.05) * H * 1.15));
        var anchor = (L.align === 'center') ? 'middle' : 'start';
        var tx = (L.align === 'center') ? W / 2 : (L.x != null ? L.x : 0.07) * W;
        var ty = L.y * H + fs * 0.35;
        return '<text x="' + tx.toFixed(1) + '" y="' + ty.toFixed(1) + '" font-size="' + fs.toFixed(1) + '" text-anchor="' + anchor + '" fill="#fff" font-weight="' + (L.role === 'title' ? 800 : 600) + '" font-family="sans-serif">' + _thEsc(txt) + '</text>';
      }).join('');
      var photoEl = photoSrc
        ? '<image href="' + photoSrc + '" x="0" y="0" width="' + W + '" height="' + H + '" preserveAspectRatio="xMidYMid slice" clip-path="url(#pclip)"/>'
        : '<rect width="' + W + '" height="' + H + '" rx="4" fill="#9a8478"/>';
      return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="cap-preset__thumb" preserveAspectRatio="none"><defs><clipPath id="pclip"><rect width="' + W + '" height="' + H + '" rx="4"/></clipPath><linearGradient id="pgr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient></defs>' + photoEl + '<rect width="' + W + '" height="' + H + '" rx="4" fill="url(#pgr)"/>' + els + '</svg>';
    }
    function _renamePreset(key) {
      var nv = window.prompt('레이아웃 이름', _presetName(key)); if (nv == null) return; nv = String(nv).trim(); if (!nv) return;
      _setPresetName(key, nv);
      var st = _findPresetStyle(key); if (st && window.ShopStyle.save) window.ShopStyle.save(st.id, { name: nv, presetKey: key });
      toast('이름을 바꿨어요'); setScreen('caption');
    }
    function _applyPreset(key) {
      try {
        var SS = window.ShopStyle; if (!(SS && SS.create)) return;
        var nm = _presetName(key); var ex = _findPresetStyle(key);
        if (ex) { SS.save(ex.id, { layers: _presetLayers(key), name: nm, presetKey: key }); SS.setActive(ex.id); }
        else SS.create({ name: nm, layers: _presetLayers(key), presetKey: key }, true);
        (D().photos || []).forEach(function (p) { p._tplSig = null; });   // 미리보기 재합성
        D().useShopStyle = true;
        toast(nm + ' 적용했어요'); setScreen('caption');
      } catch (_e) { void _e; }
    }
    function _copyPreset(key) {
      try {
        var SS = window.ShopStyle; if (!SS) return;
        var st = _findPresetStyle(key); var nm = _presetName(key) + ' 복사'; var nid = null;
        if (st && SS.duplicate) { var dup = SS.duplicate(st.id); nid = dup && dup.id; }
        else if (SS.create) { var c = SS.create({ name: nm, layers: _presetLayers(key) }, true); nid = c.id; }
        if (nid) { if (SS.save) SS.save(nid, { name: nm, presetKey: null }); if (SS.setActive) SS.setActive(nid); }
        (D().photos || []).forEach(function (p) { p._tplSig = null; });
        D().useShopStyle = true;
        toast('복사본을 만들었어요 · 사진 편집에서 글자를 옮기면 저장돼요'); setScreen('caption');
      } catch (_e) { void _e; }
    }

    return {
      _applyBrandColor: _applyBrandColor, _applyBrandFont: _applyBrandFont, _applyHarmony: _applyHarmony,
      _autoPretty: _autoPretty, _setShopType: _setShopType, _setBrandLogo: _setBrandLogo,
      _clearBrandLogo: _clearBrandLogo, _brandLogoFromFile: _brandLogoFromFile,
      _renamePreset: _renamePreset, _applyPreset: _applyPreset, _copyPreset: _copyPreset,
      _presetThumb: _presetThumb, _presetName: _presetName
    };
  }
  window.WSFlowBrand = { create: create };
})();
