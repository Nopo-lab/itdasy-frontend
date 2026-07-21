/* photo-brief-parser.js — 잇비 사진+자연어 브리핑 → 편집 레이어/시술 파서 [2026-07-22]
   "최근 원장 작업으로 좌측하단 텍스트에 시술내용 추가하고 스티커 덕지덕지 붙여줘. 22인치 재시술 손상모"
     → { service, wantsText, textPos, wantsSticker, stickerCount, useRecentStyle }
   좌표는 ItdEditor layer spec 규약(0~1 정규화, 중심 기준).
   순수 함수(휴리스틱)라 백엔드 불필요. window.ItdasyPhotoBrief.parse / buildLayers 노출. */
(function () {
  'use strict';

  // 편집 지시로 취급하는 토큰(시술내용 추출 시 이 문장은 제외) + 브리핑 감지
  var EDIT_RE = /텍스트|글씨|글자|타이포|시술내용|문구\s*넣|스티커|이모지|데코|꾸며|꾸미|붙여|좌측|우측|왼쪽|오른쪽|좌상|좌하|우상|우하|하단|상단|아래|위쪽|가운데|중앙|밝게|어둡게|보정|누끼|배경|레이아웃|편집|덕지덕지|넣어|추가해|올려\s*줘/;

  // 위치어 → {x,y,align} (ItdEditor 중심 기준, 0~1)
  function _pos(t) {
    var left = /좌측|왼쪽|좌하|좌상|왼/.test(t);
    var right = /우측|오른쪽|우하|우상|오른/.test(t);
    var bottom = /하단|좌하|우하|아래|밑|바닥/.test(t);
    var top = /상단|좌상|우상|위쪽|윗|위에/.test(t);
    var center = /가운데|중앙|센터|정중앙/.test(t);
    var x = 0.5, y = 0.88, align = 'center';
    if (left) { x = 0.25; align = 'left'; }
    else if (right) { x = 0.75; align = 'right'; }
    else if (center) { x = 0.5; align = 'center'; }
    if (top) y = 0.13;
    else if (bottom) y = 0.87;
    else if (center) y = 0.5;
    return { x: x, y: y, align: align };
  }

  // 시술내용 추출 — 편집 지시가 아닌 문장 우선, 없으면 시술 키워드 주변
  function _service(t) {
    var parts = t.split(/[.。\n·!?]| 그리고 | 하고\s|,\s/).map(function (s) { return s.trim(); }).filter(Boolean);
    var svc = parts.filter(function (s) { return s && !EDIT_RE.test(s); });
    if (svc.length) return svc.join(' ').replace(/\s+/g, ' ').slice(0, 60).trim();
    var m = t.match(/([0-9]+\s*인치[^,.]*|재시술[^,.]*|손상모[^,.]*|[가-힣]{0,6}(펌|염색|네일|속눈썹|왁싱|반영구|클리닉|리터치|다운펌|매직|볼륨)[^,.]*)/);
    return m ? m[0].trim() : '';
  }

  function parse(text) {
    var t = String(text == null ? '' : text).trim();
    if (!t) return null;
    var wantsText = /텍스트|글씨|글자|타이포|시술내용|문구/.test(t);
    var wantsSticker = /스티커|이모지|데코|꾸며|꾸미|덕지덕지/.test(t);
    var dense = /덕지덕지|잔뜩|많이|여러|가득|많은/.test(t);
    var few = /조금|살짝|약간|몇\s*개|한두/.test(t);
    var useRecentStyle = /최근|원장\s*작업|내\s*스타일|평소|늘\s*하던|하던\s*대로/.test(t);
    // 따옴표 안 텍스트가 있으면 그걸 문구로(시술내용보다 우선). "봄맞이 이벤트" 같은 명시 문구.
    var quoted = t.match(/["'“”‘’]([^"'“”‘’]{1,30})["'“”‘’]/);
    var explicitText = quoted ? quoted[1].trim() : '';
    var service = _service(t);
    return {
      raw: t,
      service: service,
      textContent: explicitText || service,   // 텍스트 레이어에 넣을 실제 문구(따옴표 우선)
      wantsText: wantsText,
      textPos: _pos(t),
      textColor: _color(t),
      textSize: /크게|크고|큼직|대문짝|잘\s*보이게/.test(t) ? 0.07 : (/작게|작은|자그|조그|은은하게\s*글/.test(t) ? 0.035 : 0.05),
      wantsSticker: wantsSticker,
      stickerCount: dense ? 8 : (few ? 2 : (wantsSticker ? 3 : 0)),
      stickerCat: _stickerCat(t),
      useRecentStyle: useRecentStyle,
      // 편집 브리핑으로 볼지(사진+이 텍스트면 오케스트레이터로 라우팅) — 실제 편집/꾸미기 의도가 있을 때만.
      //   시술내용만 있는 "게시글 써줘"류는 일반 카드/캡션 경로로(오케스트레이터 트리거 X).
      hasBrief: !!(wantsText || wantsSticker)
    };
  }

  // 색상어 → hex (없으면 흰색)
  function _color(t) {
    if (/빨간|빨강|레드|red/i.test(t)) return '#e53935';
    if (/파란|파랑|블루|blue|남색/i.test(t)) return '#1e88e5';
    if (/분홍|핑크|pink|로즈/i.test(t)) return '#ec407a';
    if (/노란|노랑|옐로|yellow|골드|금색/i.test(t)) return '#f6be00';
    if (/초록|녹색|그린|green/i.test(t)) return '#2e9e5b';
    if (/보라|퍼플|purple|자주/i.test(t)) return '#8e57c2';
    if (/검정|검은|블랙|black/i.test(t)) return '#1a1a1a';
    if (/흰|하얀|화이트|white/i.test(t)) return '#ffffff';
    return '#ffffff';
  }
  // 스티커 카테고리 힌트 → beauty|cute|mz|null
  function _stickerCat(t) {
    if (/귀여운|큐트|깜찍|하트|사랑스/i.test(t)) return 'cute';
    if (/트렌디|힙|요즘|mz|엠지|감성/i.test(t)) return 'mz';
    if (/뷰티|고급|우아|세련/i.test(t)) return 'beauty';
    return null;
  }

  // 파싱 결과 → ItdEditor layer spec 배열 (텍스트 + 스티커 흩뿌리기)
  //   스티커 소스: window.ItdStickers(이모지)/window.ItdDecos(SVG). 텍스트 위치를 피해 배치.
  function buildLayers(brief, opts) {
    opts = opts || {};
    var layers = [];
    var pos = (brief && brief.textPos) || { x: 0.5, y: 0.88, align: 'center' };
    // 1) 텍스트 레이어 — 문구(따옴표 우선, 없으면 시술내용) + 색/크기 반영
    var _txt = (brief && (brief.textContent || brief.service)) || '';
    if (brief && brief.wantsText && _txt) {
      layers.push({ type: 'text', role: '', text: _txt, x: pos.x, y: pos.y, w: 0.56,
        size: (brief.textSize || 0.05), align: pos.align, color: (brief.textColor || '#ffffff'), weight: 800, shadow: { on: true } });
    }
    // 2) 스티커 흩뿌리기 — 텍스트 반대쪽/가장자리에 랜덤하지 않게 고정 배치(재현성). 카테고리 힌트 우선.
    var n = (brief && brief.stickerCount) || 0;
    if (n > 0) {
      var ST = window.ItdStickers || {};
      var shopType = '';
      try { shopType = localStorage.getItem('itdasy:shop_type') || localStorage.getItem('shop_type') || ''; } catch (_e) { shopType = ''; }
      var emojis = [];
      var _cat = brief && brief.stickerCat;
      if (_cat === 'cute') emojis = emojis.concat(ST.cuteEmoji || []);
      else if (_cat === 'mz') emojis = emojis.concat(ST.mzEmoji || ST.cuteEmoji || []);
      else if (_cat === 'beauty') emojis = emojis.concat(ST.beautyEmoji || []);
      if (ST.shopEmojiByType && shopType && ST.shopEmojiByType[shopType]) emojis = emojis.concat(ST.shopEmojiByType[shopType]);
      emojis = emojis.concat(ST.beautyEmoji || []).concat(ST.cuteEmoji || []);
      // 중복 제거
      emojis = emojis.filter(function (e, i) { return e && emojis.indexOf(e) === i; });
      // 텍스트를 피한 고정 산포 좌표(가장자리 위주) — 텍스트가 하단이면 상단·측면에 더 배치
      var textBottom = pos.y > 0.6;
      var spots = textBottom
        ? [[0.16, 0.16], [0.5, 0.12], [0.84, 0.16], [0.13, 0.42], [0.87, 0.4], [0.28, 0.28], [0.72, 0.26], [0.5, 0.32], [0.9, 0.62], [0.1, 0.62]]
        : [[0.16, 0.84], [0.5, 0.9], [0.84, 0.84], [0.13, 0.6], [0.87, 0.62], [0.28, 0.74], [0.72, 0.76], [0.5, 0.68], [0.9, 0.4], [0.1, 0.4]];
      for (var i = 0; i < n && i < spots.length; i++) {
        var em = emojis[i % Math.max(1, emojis.length)];
        if (!em) continue;
        var sz = 0.09 + (i % 3) * 0.02;
        var rot = ((i * 37) % 40) - 20;   // -20~20도, 고정
        layers.push({ type: 'sticker', emoji: em, x: spots[i][0], y: spots[i][1], size: sz, rot: rot });
      }
    }
    return layers;
  }

  window.ItdasyPhotoBrief = { parse: parse, buildLayers: buildLayers };
})();
