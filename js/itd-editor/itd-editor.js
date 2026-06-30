/* itd-editor.js — 인스타 스토리식 사진 편집기 (Phase 2/3)
   window.ItdEditor.open({ photo, onDone(dataUrl), onCancel })
   도구: 텍스트 · 스티커 · 레이아웃(반달) · 그리기. 색은 --accent 토큰.
   설계: 레이어(텍스트/스티커)는 DOM, 그리기는 canvas. 완료 시 canvas 합성으로 dataURL. */
(function () {
  'use strict';
  if (window.ItdEditor) return;

  // 모두 OFL/오픈소스(Google Fonts) — 상업 사용 자유, 법적 문제 없음. index.html 의 fonts.googleapis 링크와 동기화.
  var FONTS = [
    { key: 'pretendard', label: '모던',  family: 'Pretendard, sans-serif',     weight: 800 },
    { key: 'black',      label: '또렷',  family: '"Black Han Sans", sans-serif', weight: 400 },
    { key: 'jua',        label: '동글',  family: '"Jua", sans-serif',           weight: 400 },
    { key: 'dohyeon',    label: '진한',  family: '"Do Hyeon", sans-serif',      weight: 400 },
    { key: 'gothica1',   label: '깔끔',  family: '"Gothic A1", sans-serif',     weight: 800 },
    { key: 'serif',      label: '클래식', family: '"Noto Serif KR", serif',     weight: 700 },
    { key: 'songmyung',  label: '단정',  family: '"Song Myung", serif',         weight: 400 },
    { key: 'dodum',      label: '도톰',  family: '"Gowun Dodum", sans-serif',   weight: 400 },
    { key: 'gaegu',      label: '손글씨', family: '"Gaegu", cursive',           weight: 700 },
    { key: 'pen',        label: '감성',  family: '"Nanum Pen Script", cursive', weight: 400 },
    { key: 'gamja',      label: '귀염',  family: '"Gamja Flower", cursive',     weight: 400 },
    { key: 'himelody',   label: '하늘',  family: '"Hi Melody", cursive',        weight: 400 }
  ];
  var COLORS = ['#FFFFFF', '#15181D', '#BC6675', '#E08A6E', '#E6B45A', '#86B06E', '#6E9BC4', '#A98AC4'];
  var SHOP_STK = ['🌸', '✨', '💗', '🎀', '👑'];
  var EMOJI = ['💄', '💅', '🔥', '😍', '🥰', '💎', '🌟', '🫶', '💖', '🌿', '☁️', '🎉'];
  var LAYOUTS = [
    { key: 'single', label: '1장',     kind: 'single', frame: '' },
    { key: 'soft',   label: '감성 무드', kind: 'single', frame: 'fr-soft' },
    { key: 'duo',    label: '좌우 2장', kind: 'grid2' },
    { key: 'quad',   label: '4장',     kind: 'grid4' }
  ];
  var BRUSHES = ['pen', 'marker', 'neon', 'eraser'];
  // [#8] 도형 — 편집 가능한 레이어로 삽입(드래그/회전/크기). 그리기와 달리 '한번 세팅하면 그대로 재사용'.
  var SHAPES = [
    { key: 'line', label: '선' }, { key: 'rect', label: '사각형' },
    { key: 'round', label: '둥근사각' }, { key: 'circle', label: '원' }
  ];
  var STK_KEY = 'itdasy:itd_stickers';   // [#7] 내 스티커(업로드) 로컬 저장(무료, 클라이언트)

  function svg(path, sw) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 1.8) + '" stroke-linecap="round" stroke-linejoin="round">' + path + '</svg>'; }
  var IC = {
    x: svg('<path d="M18 6L6 18M6 6l12 12"/>'),
    text: 'Aa',
    sticker: svg('<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4 4 0 0 0 7 0"/><circle cx="9" cy="10" r="1"/><circle cx="15" cy="10" r="1"/>'),
    layout: svg('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 9v12"/>'),
    draw: svg('<path d="M12 19l7-7-3-3-7 7-1 4 4-1z"/><path d="M16 8l3 3"/>'),
    alnL: svg('<path d="M4 6h16M4 12h10M4 18h13"/>'),
    alnC: svg('<path d="M4 6h16M7 12h10M6 18h12"/>'),
    alnR: svg('<path d="M4 6h16M10 12h10M7 18h13"/>'),
    search: svg('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/>'),
    loc: svg('<path d="M12 21s-7-5.2-7-10a7 7 0 0 1 14 0c0 4.8-7 10-7 10z"/><circle cx="12" cy="11" r="2.2"/>'),
    book: svg('<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4"/>'),
    price: svg('<path d="M20 12l-8 8-9-9V3h8l9 9z"/><circle cx="7.5" cy="7.5" r="1.3"/>'),
    time: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    pen: svg('<path d="M12 19l7-7-3-3-7 7-1 4 4-1z"/><path d="M16 8l3 3"/>'),
    marker: svg('<path d="M5 19h14"/><path d="M9 15l8-8 3 3-8 8H9v-3z"/>'),
    neon: svg('<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/>'),
    eraser: svg('<path d="M7 21h13"/><path d="M5 15l6-6 7 7-4 4H9l-4-4z"/>'),
    shape: svg('<rect x="3" y="3" width="11" height="11" rx="2"/><circle cx="16.5" cy="16.5" r="5"/>'),
    rs: svg('<path d="M21 15v6h-6M3 9V3h6M21 21l-7-7M3 3l7 7"/>', 2.2),
    upload: svg('<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 20h16"/>'),
    adjust: svg('<path d="M4 7h11M19 7h1M4 12h3M11 12h9M4 17h7M15 17h5"/><circle cx="17" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="13" cy="17" r="2"/>'),
    addphoto: svg('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 16l5-5 4 4 3-3 6 6"/><circle cx="9" cy="9" r="1.6"/>'),
    cut: svg('<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.1 8.1 20 18M8.1 15.9 20 6"/>')
  };
  // [보정] 사진별 보정값 — CSS filter / canvas ctx.filter 동일 문법으로 라이브·내보내기 일치.
  function defAdj() { return { b: 100, c: 100, s: 100, w: 0, sh: 0, rot: 0 }; }
  function filterStr(a) {
    if (!a) return 'none';
    var con = (a.c + a.sh * 0.4) / 100;   // 선명도는 대비 가산 근사(canvas sharpen 미지원 대체)
    var f = 'brightness(' + (a.b / 100).toFixed(2) + ') contrast(' + con.toFixed(2) + ') saturate(' + (a.s / 100).toFixed(2) + ')';
    if (a.w > 0) f += ' sepia(' + (a.w / 100 * 0.45).toFixed(2) + ')';
    return f;
  }
  var ADJ_CTRLS = [
    { k: 'b', label: '밝기', min: 60, max: 140 }, { k: 'c', label: '대비', min: 60, max: 140 },
    { k: 's', label: '채도', min: 0, max: 200 }, { k: 'w', label: '온도', min: 0, max: 100 },
    { k: 'sh', label: '선명도', min: 0, max: 100 }
  ];

  // [#6] 오리지널 데코 스티커 — 직접 그린 SVG(저작권 안전). img(svg dataURL) 레이어로 올림.
  function svgStk(inner) {
    return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">' + inner + '</svg>');
  }
  var DECO = [
    svgStk('<path d="M60 104 24 64c-12-13-11-30 2-39 11-7 24-3 32 8 8-11 21-15 32-8 13 9 14 26 2 39z" fill="#E8536B"/>'),
    svgStk('<path d="M60 14 72 46l34 2-26 22 8 33-28-18-28 18 8-33-26-22 34-2z" fill="#E6B45A"/>'),
    svgStk('<path d="M60 16c4 22 6 24 28 28-22 4-24 6-28 28-4-22-6-24-28-28 22-4 24-6 28-28z" fill="#F6D365"/>'),
    svgStk('<g fill="#F2A6B6"><circle cx="60" cy="32" r="16"/><circle cx="88" cy="52" r="16"/><circle cx="78" cy="84" r="16"/><circle cx="42" cy="84" r="16"/><circle cx="32" cy="52" r="16"/></g><circle cx="60" cy="58" r="13" fill="#E6B45A"/>'),
    svgStk('<path d="M30 34 40 58 22 58z M90 34 80 58 98 58z" fill="#C9A78F"/><circle cx="60" cy="64" r="34" fill="#E8D3C2"/><circle cx="49" cy="60" r="4" fill="#3a2a22"/><circle cx="71" cy="60" r="4" fill="#3a2a22"/><path d="M55 72q5 5 10 0" stroke="#3a2a22" stroke-width="2.5" fill="none" stroke-linecap="round"/>'),
    svgStk('<ellipse cx="30" cy="52" rx="12" ry="20" fill="#B07A4F"/><ellipse cx="90" cy="52" rx="12" ry="20" fill="#B07A4F"/><circle cx="60" cy="62" r="32" fill="#D9A36B"/><circle cx="50" cy="58" r="4" fill="#3a2a22"/><circle cx="70" cy="58" r="4" fill="#3a2a22"/><ellipse cx="60" cy="72" rx="6" ry="4" fill="#3a2a22"/>'),
    svgStk('<circle cx="38" cy="40" r="12" fill="#B98A5E"/><circle cx="82" cy="40" r="12" fill="#B98A5E"/><circle cx="60" cy="62" r="32" fill="#D2A878"/><circle cx="50" cy="58" r="3.5" fill="#3a2a22"/><circle cx="70" cy="58" r="3.5" fill="#3a2a22"/><circle cx="60" cy="70" r="7" fill="#7a5638"/>'),
    svgStk('<ellipse cx="48" cy="28" rx="8" ry="22" fill="#F0E0E6"/><ellipse cx="72" cy="28" rx="8" ry="22" fill="#F0E0E6"/><circle cx="60" cy="70" r="30" fill="#FBF1F4"/><circle cx="51" cy="66" r="3.5" fill="#C06A7A"/><circle cx="69" cy="66" r="3.5" fill="#C06A7A"/><circle cx="60" cy="76" r="4" fill="#E8839A"/>'),
    svgStk('<path d="M58 60 28 42v36z M62 60 92 42v36z" fill="#E07A99"/><circle cx="60" cy="60" r="9" fill="#C85F82"/>'),
    svgStk('<g fill="#ffffff" stroke="#D9CFC9" stroke-width="2"><circle cx="44" cy="66" r="18"/><circle cx="70" cy="60" r="22"/><circle cx="86" cy="70" r="14"/></g><rect x="40" y="70" width="50" height="16" rx="8" fill="#ffffff"/>'),
    svgStk('<path d="M28 84 24 44l18 16 18-26 18 26 18-16-4 40z" fill="#E6B45A"/><rect x="28" y="84" width="64" height="8" rx="3" fill="#D29B3E"/>'),
    svgStk('<path d="M60 56c-10-12-30-10-34 0 6 4 6 10 0 12 12 10 24 10 34 4 10 6 22 6 34-4-6-2-6-8 0-12-4-10-24-12-34 0z" fill="#D64C6A"/>'),
    svgStk('<rect x="14" y="20" width="92" height="56" rx="16" fill="#ffffff" stroke="#E6C9D2" stroke-width="2"/><path d="M40 76 38 94 56 76z" fill="#ffffff" stroke="#E6C9D2" stroke-width="2"/><text x="60" y="54" font-family="Pretendard,sans-serif" font-size="22" font-weight="800" fill="#BC6675" text-anchor="middle">예뻐요</text>'),
    svgStk('<g stroke="#7C8B9A" stroke-width="5" fill="none" stroke-linecap="round"><circle cx="34" cy="84" r="10"/><circle cx="34" cy="54" r="10"/><path d="M42 78 96 36M42 60 96 100"/></g>'),
    svgStk('<circle cx="34" cy="40" r="14" fill="#B9B2AE"/><circle cx="86" cy="40" r="14" fill="#B9B2AE"/><circle cx="60" cy="64" r="30" fill="#CFC8C3"/><circle cx="50" cy="60" r="3.5" fill="#3a2a22"/><circle cx="70" cy="60" r="3.5" fill="#3a2a22"/><circle cx="60" cy="70" r="4" fill="#E89BB0"/>'),
    svgStk('<path d="M30 30 44 56 22 54z" fill="#E08A4E"/><path d="M90 30 76 56 98 54z" fill="#E08A4E"/><path d="M60 30c18 0 30 14 30 34 0 14-14 26-30 26S30 78 30 64c0-20 12-34 30-34z" fill="#E89B5E"/><path d="M60 64c-9 0-16 8-16 16 0 8 7 14 16 14s16-6 16-14c0-8-7-16-16-16z" fill="#fff"/><circle cx="50" cy="58" r="3.5" fill="#3a2a22"/><circle cx="70" cy="58" r="3.5" fill="#3a2a22"/><circle cx="60" cy="74" r="3" fill="#3a2a22"/>'),
    svgStk('<circle cx="34" cy="36" r="12" fill="#2b2b2b"/><circle cx="86" cy="36" r="12" fill="#2b2b2b"/><circle cx="60" cy="64" r="32" fill="#ffffff" stroke="#E2DAD5" stroke-width="2"/><ellipse cx="48" cy="62" rx="8" ry="10" fill="#2b2b2b"/><ellipse cx="72" cy="62" rx="8" ry="10" fill="#2b2b2b"/><circle cx="60" cy="76" r="4" fill="#2b2b2b"/>'),
    svgStk('<circle cx="60" cy="64" r="30" fill="#F6D365"/><path d="M60 32c3-8 12-10 12-10s-3 9-12 10z" fill="#F2A33C"/><circle cx="52" cy="60" r="3.5" fill="#3a2a22"/><circle cx="68" cy="60" r="3.5" fill="#3a2a22"/><path d="M56 70 60 76 64 70z" fill="#EF8B2C"/>'),
    svgStk('<ellipse cx="60" cy="66" rx="22" ry="16" fill="#F4C443"/><path d="M50 54v24M62 52v28M74 56v18" stroke="#2b2b2b" stroke-width="5"/><ellipse cx="44" cy="46" rx="12" ry="8" fill="#cfe6f5" stroke="#9cc3dd" stroke-width="1.5" transform="rotate(-25 44 46)"/><ellipse cx="76" cy="46" rx="12" ry="8" fill="#cfe6f5" stroke="#9cc3dd" stroke-width="1.5" transform="rotate(25 76 46)"/><circle cx="60" cy="40" r="3" fill="#2b2b2b"/>'),
    svgStk('<path d="M60 60c-6-22-40-26-40-4 0 16 26 18 40 8z" fill="#E07A99"/><path d="M60 60c6-22 40-26 40-4 0 16-26 18-40 8z" fill="#E07A99"/><path d="M60 60c-5 18-30 22-30 4 0-12 20-14 30-8z" fill="#F2A6B6"/><path d="M60 60c5 18 30 22 30 4 0-12-20-14-30-8z" fill="#F2A6B6"/><rect x="58" y="40" width="4" height="44" rx="2" fill="#5a4636"/>'),
    svgStk('<circle cx="60" cy="64" r="28" fill="#E24B4A"/><path d="M60 36v56" stroke="#2b2b2b" stroke-width="3"/><ellipse cx="60" cy="38" rx="14" ry="10" fill="#2b2b2b"/><circle cx="48" cy="56" r="5" fill="#2b2b2b"/><circle cx="72" cy="56" r="5" fill="#2b2b2b"/><circle cx="50" cy="74" r="5" fill="#2b2b2b"/><circle cx="70" cy="74" r="5" fill="#2b2b2b"/>'),
    svgStk('<rect x="48" y="54" width="24" height="46" rx="4" fill="#C9A227"/><path d="M50 54h20l-2-22c0-6-16-6-16 0z" fill="#D64C6A"/>'),
    svgStk('<rect x="46" y="56" width="28" height="42" rx="6" fill="#E07A99"/><rect x="54" y="40" width="12" height="18" fill="#6E5A50"/><rect x="52" y="32" width="16" height="9" rx="2" fill="#3a2a22"/>'),
    svgStk('<rect x="44" y="52" width="32" height="46" rx="7" fill="#cfe6f5" stroke="#9cc3dd" stroke-width="2"/><rect x="54" y="40" width="12" height="14" fill="#bcd9ea"/><rect x="52" y="30" width="16" height="10" rx="2" fill="#C9A227"/><rect x="46" y="64" width="28" height="20" rx="3" fill="#E6C9D2"/>'),
    svgStk('<circle cx="60" cy="48" r="24" fill="#dce8f0" stroke="#C9A227" stroke-width="4"/><rect x="56" y="72" width="8" height="28" rx="4" fill="#C9A227"/>'),
    svgStk('<path d="M40 80 16 56a14 14 0 0 1 24-14 14 14 0 0 1 24 14z" fill="#E8839A"/><path d="M76 92 52 68a14 14 0 0 1 24-14 14 14 0 0 1 24 14z" fill="#E8536B"/>'),
    svgStk('<circle cx="60" cy="60" r="20" fill="#F6C545"/><g stroke="#F6C545" stroke-width="5" stroke-linecap="round"><path d="M60 24v12M60 84v12M24 60h12M84 60h12M35 35l8 8M77 77l8 8M85 35l-8 8M43 77l-8 8"/></g>'),
    svgStk('<path d="M72 28a34 34 0 1 0 20 58A28 28 0 0 1 72 28z" fill="#F0D98C"/>'),
    svgStk('<path d="M18 90a42 42 0 0 1 84 0" fill="none" stroke="#E24B4A" stroke-width="7"/><path d="M28 90a32 32 0 0 1 64 0" fill="none" stroke="#F2A33C" stroke-width="7"/><path d="M38 90a22 22 0 0 1 44 0" fill="none" stroke="#86B06E" stroke-width="7"/><path d="M48 90a12 12 0 0 1 24 0" fill="none" stroke="#6E9BC4" stroke-width="7"/>'),
    svgStk('<path d="M34 46h44v26a22 22 0 0 1-44 0z" fill="#ffffff" stroke="#C9B8AE" stroke-width="2"/><path d="M78 52h10a10 10 0 0 1 0 20h-10" fill="none" stroke="#C9B8AE" stroke-width="3"/><path d="M44 36c0-6 6-6 6-12M56 36c0-6 6-6 6-12M68 36c0-6 6-6 6-12" stroke="#C9B8AE" stroke-width="3" fill="none"/>'),
    svgStk('<rect x="30" y="52" width="60" height="42" rx="4" fill="#E07A99"/><rect x="30" y="46" width="60" height="14" rx="3" fill="#C85F82"/><rect x="55" y="46" width="10" height="48" fill="#F2C84B"/><path d="M60 46c-8-14-24-6-16 2 4 4 16-2 16-2zM60 46c8-14 24-6 16 2-4 4-16-2-16-2z" fill="#F2C84B"/>'),
    svgStk('<ellipse cx="60" cy="50" rx="22" ry="26" fill="#E8536B"/><path d="M60 76l-4 8h8z" fill="#E8536B"/><path d="M60 84c0 8 6 8 6 16" stroke="#C9B8AE" stroke-width="2" fill="none"/>'),
    svgStk('<g fill="#C9A78F"><ellipse cx="60" cy="74" rx="18" ry="14"/><circle cx="38" cy="52" r="8"/><circle cx="52" cy="42" r="8"/><circle cx="68" cy="42" r="8"/><circle cx="82" cy="52" r="8"/></g>'),
    svgStk('<circle cx="60" cy="60" r="34" fill="#86B06E"/><path d="M44 62l11 11 22-24" stroke="#ffffff" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
    svgStk('<rect x="14" y="24" width="92" height="52" rx="14" fill="#BC6675"/><path d="M40 76 38 92 56 76z" fill="#BC6675"/><text x="60" y="58" font-family="Pretendard,sans-serif" font-size="24" font-weight="800" fill="#ffffff" text-anchor="middle">NEW</text>'),
    svgStk('<path d="M60 16l10 10 14-2 2 14 10 10-10 10-2 14-14-2-10 10-10-10-14 2-2-14L18 60l10-10-2-14 14 2z" fill="#E24B4A"/><text x="60" y="68" font-family="Pretendard,sans-serif" font-size="19" font-weight="800" fill="#ffffff" text-anchor="middle">SALE</text>'),
    svgStk('<path d="M30 36 40 58 24 56z" fill="#E8A23C"/><path d="M90 36 80 58 96 56z" fill="#E8A23C"/><circle cx="60" cy="64" r="32" fill="#F2B454"/><path d="M44 50v10M52 46v12M68 46v12M76 50v10" stroke="#7a4a1a" stroke-width="3"/><circle cx="50" cy="62" r="3.5" fill="#3a2a22"/><circle cx="70" cy="62" r="3.5" fill="#3a2a22"/><path d="M54 74h12" stroke="#3a2a22" stroke-width="3" stroke-linecap="round"/>'),
    svgStk('<circle cx="60" cy="62" r="32" fill="#F2B0C0"/><ellipse cx="60" cy="70" rx="14" ry="10" fill="#E68AA0"/><circle cx="52" cy="70" r="2.6" fill="#7a3a4a"/><circle cx="68" cy="70" r="2.6" fill="#7a3a4a"/><circle cx="50" cy="56" r="3" fill="#3a2a22"/><circle cx="70" cy="56" r="3" fill="#3a2a22"/><path d="M36 44 30 36M84 44 90 36" stroke="#E68AA0" stroke-width="8" stroke-linecap="round"/>'),
    svgStk('<circle cx="60" cy="64" r="32" fill="#8DBE5A"/><circle cx="44" cy="44" r="12" fill="#8DBE5A"/><circle cx="76" cy="44" r="12" fill="#8DBE5A"/><circle cx="44" cy="44" r="7" fill="#fff"/><circle cx="76" cy="44" r="7" fill="#fff"/><circle cx="44" cy="44" r="3.5" fill="#222"/><circle cx="76" cy="44" r="3.5" fill="#222"/><path d="M48 70q12 8 24 0" stroke="#2c4a1a" stroke-width="3" fill="none" stroke-linecap="round"/>'),
    svgStk('<ellipse cx="60" cy="60" rx="26" ry="32" fill="#2b3a4a"/><ellipse cx="60" cy="66" rx="18" ry="24" fill="#fff"/><path d="M60 50 52 60h16z" fill="#E8A23C"/><circle cx="51" cy="48" r="3" fill="#222"/><circle cx="69" cy="48" r="3" fill="#222"/><path d="M40 78 30 88M80 78 90 88" stroke="#E8A23C" stroke-width="6" stroke-linecap="round"/>'),
    svgStk('<circle cx="60" cy="58" r="30" fill="#C9A06A"/><circle cx="44" cy="58" r="14" fill="#F0E0C0"/><circle cx="76" cy="58" r="14" fill="#F0E0C0"/><circle cx="48" cy="56" r="4" fill="#222"/><circle cx="72" cy="56" r="4" fill="#222"/><path d="M40 36 34 26M80 36 86 26" stroke="#C9A06A" stroke-width="7" stroke-linecap="round"/><path d="M54 70q6 6 12 0" stroke="#7a5638" stroke-width="3" fill="none" stroke-linecap="round"/>'),
    svgStk('<ellipse cx="60" cy="72" rx="30" ry="20" fill="#7BBF6A"/><circle cx="60" cy="44" r="22" fill="#8DCB78"/><circle cx="52" cy="42" r="4" fill="#222"/><circle cx="68" cy="42" r="4" fill="#222"/><path d="M50 52q10 8 20 0" stroke="#3a5a2a" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M40 28 34 20M80 28 86 20" stroke="#8DCB78" stroke-width="6" stroke-linecap="round"/>'),
    svgStk('<path d="M60 28c-3 0-6 8-6 18 0 6 4 9 6 9s6-3 6-9c0-10-3-18-6-18z" fill="#E6B45A"/><circle cx="60" cy="72" r="26" fill="#fff"/><path d="M60 46c-14 0-26 12-26 26 0 8 6 14 14 14h24c8 0 14-6 14-14 0-14-12-26-26-26z" fill="#F7F1EF"/><path d="M54 64q6-5 12 0" stroke="#C06A7A" stroke-width="2.5" fill="none"/><circle cx="50" cy="68" r="3" fill="#3a2a22"/><circle cx="70" cy="68" r="3" fill="#3a2a22"/><path d="M44 54l-8-6M76 54l8-6" stroke="#E6B45A" stroke-width="4" stroke-linecap="round"/>'),
    svgStk('<path d="M44 96c-4-18-4-30 0-42 3-9 9-14 16-14s13 5 16 14c4 12 4 24 0 42z" fill="#7BBF6A"/><ellipse cx="60" cy="40" rx="18" ry="20" fill="#9ED98A"/><circle cx="60" cy="44" r="9" fill="#6B4A2A"/>'),
    svgStk('<circle cx="60" cy="60" r="30" fill="#F4C98A"/><circle cx="60" cy="60" r="16" fill="#6B4A2A"/><g fill="#fff"><circle cx="50" cy="52" r="2"/><circle cx="70" cy="54" r="2"/><circle cx="60" cy="70" r="2"/><circle cx="48" cy="66" r="2"/><circle cx="72" cy="68" r="2"/></g><path d="M36 40q24-14 48 0" stroke="#E89B5E" stroke-width="6" fill="none"/>'),
    svgStk('<path d="M40 56h40l-4 36a8 8 0 0 1-8 7H52a8 8 0 0 1-8-7z" fill="#F6D7A0"/><rect x="36" y="48" width="48" height="12" rx="6" fill="#E08A6E"/><circle cx="50" cy="42" r="5" fill="#E8536B"/><circle cx="62" cy="38" r="5" fill="#F4C443"/><circle cx="74" cy="42" r="5" fill="#86B06E"/>'),
    svgStk('<path d="M60 96 38 72c-6-7-6-16 0-22 5-5 14-4 19 2l3 4 3-4c5-6 14-7 19-2 6 6 6 15 0 22z" fill="#E8536B"/><path d="M48 60h8M64 60h8" stroke="#fff" stroke-width="3" stroke-linecap="round"/>'),
    svgStk('<circle cx="60" cy="66" r="22" fill="#E24B4A"/><path d="M58 44c0-8 8-12 8-12s2 8-6 12z" fill="#7BBF6A"/><circle cx="53" cy="62" r="2.4" fill="#fff"/><circle cx="64" cy="66" r="2.4" fill="#fff"/>'),
    svgStk('<path d="M44 30c0 10 16 10 16 0M76 30c0 10-16 10-16 0" stroke="#6B4A2A" stroke-width="4" fill="none"/><circle cx="48" cy="62" r="18" fill="#E24B4A"/><circle cx="72" cy="62" r="18" fill="#C0392B"/><circle cx="44" cy="56" r="3" fill="#fff"/><circle cx="68" cy="56" r="3" fill="#fff"/>'),
    svgStk('<path d="M40 46h40l-3 18H43z" fill="#F2A6B6"/><path d="M43 64h34l-3 28a6 6 0 0 1-6 5H52a6 6 0 0 1-6-5z" fill="#F6D7A0"/><circle cx="60" cy="40" r="6" fill="#E8536B"/>'),
    svgStk('<rect x="46" y="40" width="22" height="40" rx="4" fill="#F0E0C0"/><path d="M46 56c-8 0-12 6-12 12s6 12 14 12h20V56z" fill="#F0E0C0"/><path d="M68 40h6a14 14 0 0 1 0 28h-6" fill="none" stroke="#C9A06A" stroke-width="4"/><circle cx="56" cy="58" r="4" fill="#fff"/>')
  ];

  var S = null;   // session state
  var root = null, refs = {};

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  function build() {
    root = el('div', 'itded');
    root.innerHTML =
      '<div class="itded__stage" data-r="stage">' +
        '<div class="itded__photowrap" data-r="photowrap"><div class="itded__photo" data-r="photo"></div><div class="itded__collage" data-r="collage" hidden></div></div>' +
        '<div class="itded__scrim"></div>' +
        '<div class="itded__frame" data-r="frame"></div>' +
        '<canvas class="itded__draw" data-r="draw"></canvas>' +
        '<div class="itded__layers" data-r="layers"></div>' +
        '<div class="itded__grid" data-r="grid"></div>' +
      '</div>' +
      '<div class="itded__top">' +
        '<button class="itded__ic" data-r="cancel" aria-label="닫기">' + IC.x + '</button>' +
        '<button class="itded__done" data-r="done">완료</button>' +
      '</div>' +
      '<div class="itded__rail" data-r="rail">' +
        '<button class="itrb on" data-tool="text">Aa</button>' +
        '<button class="itrb" data-tool="adjust">' + IC.adjust + '</button>' +
        '<button class="itrb" data-tool="sticker">' + IC.sticker + '</button>' +
        '<button class="itrb" data-tool="layout">' + IC.layout + '</button>' +
        '<button class="itrb" data-tool="shape">' + IC.shape + '</button>' +
        '<button class="itrb" data-tool="draw">' + IC.draw + '</button>' +
      '</div>' +
      buildText() + buildAdjust() + buildSticker() + buildLayout() + buildShape() + buildDraw();
    document.body.appendChild(root);
    cacheRefs();
    wire();
    preloadFonts();   // [#6] 폰트칩이 각 폰트 디자인대로 보이도록 즉시 로드(지연/FOUT 방지)
  }
  // [#6] 칩에 쓰는 폰트를 강제 로드 — 안 그러면 첫 렌더 때 폴백되어 'Aa가'가 다 똑같아 보임.
  function preloadFonts() {
    if (!document.fonts || !document.fonts.load) return;
    FONTS.forEach(function (f) { try { document.fonts.load((f.weight || 700) + ' 16px ' + f.family); } catch (_) { void _; } });
  }

  function buildText() {
    var fonts = FONTS.map(function (f, i) {
      // [#8] 'Aa가'는 그 폰트로 렌더 + 작은 이름표(모던/손글씨…) 항상 표시 → 폰트 미로딩이어도 구분 가능.
      return '<button class="itfont' + (i === 0 ? ' on' : '') + '" data-font="' + f.key + '" aria-label="' + f.label + '">' +
        '<span class="itfont__s" style="font-family:' + f.family + (f.key === 'pen' || f.key === 'gamja' || f.key === 'himelody' ? ';font-size:24px' : '') + '">Aa가</span>' +
        '<span class="itfont__n">' + f.label + '</span></button>';
    }).join('');
    var colors = COLORS.map(function (c, i) {
      return '<button class="itsw' + (i === 0 ? ' on' : '') + '" data-color="' + c + '" style="background:' + c + '"></button>';
    }).join('');
    return '<div class="itpanel ittext is-open" data-panel="text">' +
        '<div class="ittext__top">' +
          '<span class="italn" data-r="aln">' +
            '<button data-aln="left" class="on">' + IC.alnL + '</button>' +
            '<button data-aln="center">' + IC.alnC + '</button>' +
            '<button data-aln="right">' + IC.alnR + '</button>' +
          '</span>' +
          '<span class="itsize">크기<input type="range" min="0.5" max="2.6" step="0.02" value="1" data-r="size"></span>' +
        '</div>' +
        '<div class="itfonts" data-r="fonts">' + fonts + '</div>' +
        '<div class="itcolors" data-r="colors">' + colors + '</div>' +
      '</div>';
  }
  // [보정] 사진별 보정 패널 — 위 사진 스트립에서 사진 고르고 아래 슬라이더로 그 사진만 보정.
  function buildAdjust() {
    var sliders = ADJ_CTRLS.map(function (c) {
      return '<div class="itadj__row"><span>' + c.label + '</span>' +
        '<input type="range" min="' + c.min + '" max="' + c.max + '" step="1" data-adj="' + c.k + '">' +
        '<b data-adjout="' + c.k + '">0</b></div>';
    }).join('');
    return '<div class="itpanel itadj" data-panel="adjust">' +
      '<div class="itadj__sub">보정할 사진을 고르세요</div>' +
      '<div class="itadj__strip" data-r="adjStrip"></div>' +
      '<div class="itadj__bgrow"><button class="itadj__bg" data-r="adjCut">' + IC.cut + ' 배경 지우기(누끼)</button>' +
        '<button class="itadj__bg itadj__bg--undo" data-r="adjUncut">원본</button></div>' +
      '<div class="itadj__row itadj__rotrow"><span>수평</span>' +
        '<input type="range" min="-15" max="15" step="0.5" value="0" data-r="adjRot"><b data-r="adjRotOut">0°</b></div>' +
      sliders +
      '<button class="itadj__reset" data-r="adjReset">이 사진 보정 초기화</button>' +
    '</div>';
  }
  function buildSticker() {
    var shop = SHOP_STK.map(function (s) { return '<button data-stk="' + s + '">' + s + '</button>'; }).join('');
    var emo = EMOJI.map(function (s) { return '<button data-stk="' + s + '">' + s + '</button>'; }).join('');
    var deco = DECO.map(function (u, i) { return '<button class="itdeco" data-deco="' + i + '"><img src="' + u + '" alt="" draggable="false"></button>'; }).join('');
    return '<div class="itpanel" data-panel="sticker">' +
      '<div class="itstk" data-r="stkSheet">' +
        '<div class="itgrip"></div>' +
        '<div class="itstk__search">' + IC.search + '스티커 검색</div>' +
        '<div class="itfstk">' +
          '<button type="button" class="itfs loc" data-feat="loc" data-r="featLoc">' + IC.loc + '<span data-r="featLocTx">우리샵</span></button>' +
          '<button type="button" class="itfs book" data-feat="book">' + IC.book + '예약하기</button>' +
          '<button type="button" class="itfs price" data-feat="price">' + IC.price + '가격</button>' +
          '<button type="button" class="itfs time" data-feat="time">' + IC.time + '시간</button>' +
        '</div>' +
        // [#7] 내 스티커 — 업로드 버튼 + 저장된 내 스티커 그리드(동적 렌더)
        '<div class="itssub itssub--row"><span>내 스티커</span>' +
          '<label class="itstk__up">' + IC.upload + '추가<input type="file" accept="image/*" data-r="stkUpload" hidden></label></div>' +
        '<div class="itsgrid itsgrid--my" data-r="myStk"></div>' +
        // [#6] 캐릭터·데코(오리지널 SVG)
        '<div class="itssub" style="margin-top:14px">캐릭터·데코</div><div class="itsgrid">' + deco + '</div>' +
        '<div class="itssub" style="margin-top:14px">우리샵 에셋</div><div class="itsgrid">' + shop + '</div>' +
        '<div class="itssub" style="margin-top:14px">이모지</div><div class="itsgrid">' + emo + '</div>' +
      '</div></div>';
  }
  // [#8] 도형 패널(하단바) — 선/사각형/둥근사각/원 + 채움 토글 + 굵기 + 색.
  function buildShape() {
    var chips = SHAPES.map(function (s) {
      return '<button class="itshp" data-shape="' + s.key + '" aria-label="' + s.label + '"><span class="itshp__ic itshp__ic--' + s.key + '"></span><em>' + s.label + '</em></button>';
    }).join('');
    var colors = COLORS.map(function (c, i) {
      return '<button class="itscw' + (i === 2 ? ' on' : '') + '" data-scolor="' + c + '" style="background:' + c + '"></button>';
    }).join('');
    return '<div class="itpanel itshape" data-panel="shape">' +
      '<div class="itshape__row">' + chips + '</div>' +
      '<div class="itshape__opts">' +
        '<span class="itshape__fill" data-r="shapeFill"><button data-shapefill="0" class="on">선만</button><button data-shapefill="1">채움</button></span>' +
        '<span class="itshape__thick">굵기<input type="range" min="2" max="26" step="1" value="6" data-r="shapeThick"></span>' +
      '</div>' +
      '<div class="itshape__colors">' + colors + '</div>' +
    '</div>';
  }
  // [레이아웃] 목업식 — 타입 칩(1장/좌우2장/4장) + 렌더된 사진을 순서대로 탭해 자리에 채움.
  var LAY_TYPES = [{ i: 0, name: '1장' }, { i: 2, name: '좌우 2장' }, { i: 3, name: '4장' }];
  var BG_COLORS = ['#FFFFFF', '#FBF7F5', '#F4E9E4', '#E8D3C2', '#F2D7DE', '#E6C9D2', '#D9B8C4', '#BC6675', '#E08A6E', '#E6B45A', '#BFD0C4', '#A7C4B5', '#9DB7C9', '#C9C2E0', '#7A6E78', '#2C2226', '#15181D'];
  function buildLayout() {
    var chips = LAY_TYPES.map(function (t, idx) {
      return '<button class="itlaytype' + (idx === 0 ? ' on' : '') + '" data-lay="' + t.i + '">' + t.name + '</button>';
    }).join('');
    var bg = BG_COLORS.map(function (c, i) { return '<button class="itlaybg' + (i === 0 ? ' on' : '') + '" data-bg="' + c + '" style="background:' + c + '"></button>'; }).join('');
    return '<div class="itpanel itlay2" data-panel="layout">' +
      '<div class="itlay2__hint" data-r="layHint"></div>' +
      '<div class="itlay2__types">' + chips + '</div>' +
      '<div class="itlay2__sub">렌더된 사진 — 순서대로 누르세요</div>' +
      '<div class="itlay2__strip" data-r="layStrip"></div>' +
      '<div class="itlay2__ctrls">' +
        '<span class="itlay2__fit" data-r="layFit"><button data-fit="cover" class="on">꽉 채움</button><button data-fit="contain">전체</button></span>' +
        '<span class="itlay2__gap">간격<input type="range" min="0" max="24" step="1" value="3" data-r="layGap"></span>' +
        '<span class="itlay2__bg">' + bg + '</span>' +
        '<label class="itlay2__add itlay2__bgimg">' + IC.addphoto + '배경<input type="file" accept="image/*" data-r="layBgImg" hidden></label>' +
        '<label class="itlay2__add">' + IC.addphoto + '사진<input type="file" accept="image/*" data-r="layAdd" hidden></label>' +
      '</div>' +
    '</div>';
  }
  function _layPos(kind) { return kind === 'grid4' ? ['좌상', '우상', '좌하', '우하'] : ['왼쪽', '오른쪽']; }
  function _layNeed(kind) { return kind === 'grid4' ? 4 : (kind === 'grid2' ? 2 : 1); }
  function buildDraw() {
    var brushes = BRUSHES.map(function (b, i) {
      return '<button class="itbrush' + (i === 0 ? ' on' : '') + '" data-brush="' + b + '">' + IC[b] + '</button>';
    }).join('');
    var colors = COLORS.map(function (c, i) {
      return '<button class="itdsw' + (i === 2 ? ' on' : '') + '" data-dcolor="' + c + '" style="background:' + c + '"></button>';
    }).join('');
    return '<div class="itpanel" data-panel="draw">' +
      '<div class="itdraw__top">' + brushes + '</div>' +
      '<div class="itbsize"><input type="range" min="3" max="40" step="1" value="10" data-r="brushSize"></div>' +
      '<div class="itdraw__colors">' + colors + '</div>' +
    '</div>';
  }

  function cacheRefs() {
    ['stage', 'photowrap', 'photo', 'collage', 'frame', 'draw', 'layers', 'rail', 'cancel', 'done', 'aln', 'size', 'fonts', 'colors', 'stkSheet', 'layHint', 'layStrip', 'layGap', 'layAdd', 'brushSize', 'featLocTx', 'myStk', 'stkUpload', 'shapeThick', 'adjStrip', 'adjReset', 'adjRot', 'adjRotOut', 'grid', 'adjCut', 'adjUncut', 'layFit', 'layBgImg'].forEach(function (k) {
      refs[k] = root.querySelector('[data-r="' + k + '"]');
    });
    refs.panels = {};
    root.querySelectorAll('[data-panel]').forEach(function (p) { refs.panels[p.getAttribute('data-panel')] = p; });
    refs.ctx = refs.draw.getContext('2d');
  }

  /* ── 도구 전환 ── */
  function setTool(tool) {
    S.tool = tool;
    root.querySelectorAll('.itrb').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tool') === tool); });
    Object.keys(refs.panels).forEach(function (k) { refs.panels[k].classList.toggle('is-open', k === tool); });
    var drawing = tool === 'draw', inLayout = tool === 'layout';
    refs.draw.classList.toggle('is-armed', drawing);
    refs.draw.style.zIndex = drawing ? '5' : '3';
    // [셀 크롭] 레이아웃 도구에선 콜라주 칸이 포인터를 받게(레이어/캔버스 위로) → 칸 드래그/핀치 재구도
    refs.draw.style.pointerEvents = inLayout ? 'none' : 'auto';
    refs.layers.style.pointerEvents = (drawing || inLayout) ? 'none' : '';
    refs.collage.classList.toggle('is-cropping', inLayout);
    if (tool === 'text' && !S.layers.some(function (l) { return l.type === 'text'; })) addText();
    if (tool === 'layout') { renderLayoutStrip(); renderLayoutHint(); }
    if (tool === 'sticker') renderMyStickers();
    if (tool === 'adjust') renderAdjust();
  }

  /* ── 레이어 공통(드래그) ── */
  function makeLayer(type) {
    var box = el('div', 'itl');
    box.innerHTML = '<button class="itl__del">' + svg('<path d="M18 6L6 18M6 6l12 12"/>', 2.4) + '</button>' +
      '<button class="itl__rot">' + svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>', 2.2) + '</button>' +
      '<button class="itl__rs">' + IC.rs + '</button>';
    var L = { type: type, el: box, x: 0, y: 0, scale: 1, rot: 0 };
    box.addEventListener('pointerdown', function (e) { onLayerDown(e, L); });
    box.querySelector('.itl__del').addEventListener('click', function (e) { e.stopPropagation(); removeLayer(L); });
    box.querySelector('.itl__rot').addEventListener('pointerdown', function (e) { onRotDown(e, L); });
    box.querySelector('.itl__rs').addEventListener('pointerdown', function (e) { onRsDown(e, L); });
    refs.layers.appendChild(box);
    S.layers.push(L);
    return L;
  }
  function placeCenter(L, w, h) {
    var r = refs.stage.getBoundingClientRect();
    L.x = r.width / 2 - (w || L.el.offsetWidth) / 2;
    L.y = r.height / 2 - (h || L.el.offsetHeight) / 2;
    applyXf(L);
  }
  function applyXf(L) { L.el.style.transform = 'translate(' + L.x + 'px,' + L.y + 'px) rotate(' + (L.rot || 0) + 'deg) scale(' + L.scale + ')'; }
  // [#2] 직각 자석 — 0·90·180·270 근처(±7°)면 딱 맞춤(수직/수평 느낌으로 중력이 잡아주듯).
  function snapAngle(deg) {
    var n = Math.round(deg / 90) * 90;
    return Math.abs(deg - n) <= 7 ? n : deg;
  }
  var rotd = null;
  function onRotDown(e, L) {
    e.preventDefault(); e.stopPropagation(); selectLayer(L);
    var b = L.el.getBoundingClientRect();
    rotd = { L: L, cx: b.left + b.width / 2, cy: b.top + b.height / 2, start: (L.rot || 0), a0: Math.atan2(e.clientY - (b.top + b.height / 2), e.clientX - (b.left + b.width / 2)) };
    try { e.target.setPointerCapture(e.pointerId); } catch (_) { void _; }
  }
  // 크기조절 핸들 — 중심에서의 거리 비율로 scale 조정(모든 레이어 공통).
  var rsd = null;
  function onRsDown(e, L) {
    e.preventDefault(); e.stopPropagation(); selectLayer(L);
    var b = L.el.getBoundingClientRect(); var cx = b.left + b.width / 2, cy = b.top + b.height / 2;
    rsd = { L: L, cx: cx, cy: cy, d0: Math.max(8, Math.hypot(e.clientX - cx, e.clientY - cy)), s0: (L.scale || 1) };
    try { e.target.setPointerCapture(e.pointerId); } catch (_) { void _; }
  }
  function selectLayer(L) {
    S.active = L;
    S.layers.forEach(function (x) { x.el.classList.toggle('is-active', x === L); });
    if (L && L.type === 'text') syncTextControls(L);
  }
  function removeLayer(L) {
    var i = S.layers.indexOf(L); if (i >= 0) S.layers.splice(i, 1);
    L.el.remove(); if (S.active === L) S.active = null;
  }
  var drag = null, lpinch = null;
  function onLayerDown(e, L) {
    e.preventDefault(); selectLayer(L);
    L._pts = L._pts || {}; L._pts[e.pointerId] = { x: e.clientX, y: e.clientY };
    try { L.el.setPointerCapture(e.pointerId); } catch (_) { void _; }
    var ids = Object.keys(L._pts);
    if (ids.length >= 2) {   // [#4] 두 손가락 → 핀치(크기+회전), 단일 드래그 중지
      drag = null;
      var q1 = L._pts[ids[0]], q2 = L._pts[ids[1]];
      lpinch = { L: L, ids: [ids[0], ids[1]], d0: Math.max(8, Math.hypot(q1.x - q2.x, q1.y - q2.y)), a0: Math.atan2(q2.y - q1.y, q2.x - q1.x), s0: L.scale || 1, r0: L.rot || 0 };
      return;
    }
    if (L.type === 'text' && L._tapEdit && Date.now() - L._tapEdit < 350) { editText(L); return; }
    L._tapEdit = Date.now();
    drag = { L: L, pid: e.pointerId, sx: e.clientX, sy: e.clientY, ox: L.x, oy: L.y };
    L.el.style.cursor = 'grabbing';
  }
  document.addEventListener('pointermove', function (e) {
    if (lpinch) {
      var L = lpinch.L; if (L._pts[e.pointerId]) L._pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      var p1 = L._pts[lpinch.ids[0]], p2 = L._pts[lpinch.ids[1]]; if (!p1 || !p2) return;
      var dd = Math.hypot(p1.x - p2.x, p1.y - p2.y), aa = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      L.scale = Math.max(0.2, Math.min(8, lpinch.s0 * dd / lpinch.d0));
      L.rot = snapAngle(lpinch.r0 + (aa - lpinch.a0) * 180 / Math.PI); applyXf(L);
      if (L.type === 'text' && refs.size) refs.size.value = L.scale; return;
    }
    if (rsd) {
      var d = Math.hypot(e.clientX - rsd.cx, e.clientY - rsd.cy);
      rsd.L.scale = Math.max(0.2, Math.min(6, rsd.s0 * d / rsd.d0)); applyXf(rsd.L);
      if (rsd.L.type === 'text' && refs.size) refs.size.value = rsd.L.scale; return;
    }
    if (rotd) {
      var a = Math.atan2(e.clientY - rotd.cy, e.clientX - rotd.cx);
      rotd.L.rot = snapAngle(rotd.start + (a - rotd.a0) * 180 / Math.PI); applyXf(rotd.L); return;
    }
    if (!drag) return;
    drag.L.x = drag.ox + (e.clientX - drag.sx);
    drag.L.y = drag.oy + (e.clientY - drag.sy);
    applyXf(drag.L);
  });
  document.addEventListener('pointerup', cleanupLayerPointer);
  document.addEventListener('pointercancel', cleanupLayerPointer);
  function cleanupLayerPointer(e) {
    // [#1 드래그 회귀] 어느 경로로 끝나든 모든 레이어의 포인터 추적을 지운다(안 지우면 stale 포인터로 다음 드래그가 핀치로 오인됨).
    (S && S.layers || []).forEach(function (L) { if (L._pts) delete L._pts[e.pointerId]; });
    if (lpinch && (!lpinch.L._pts || Object.keys(lpinch.L._pts).length < 2)) lpinch = null;
    if (drag) { drag.L.el.style.cursor = 'grab'; drag = null; }
    rotd = null; rsd = null;
  }

  /* ── 사진 핀치 확대/이동 (두 손가락, 빈 배경에서) ── */
  var pinchPts = {}, pinch0 = null;
  function pdist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  // [#3] 사진 수평 맞추기 — 회전 시 빈 모서리 안 생기게 cover 스케일 보정.
  function coverScaleForRot(deg) {
    var r = Math.abs(deg) * Math.PI / 180; var st = refs.stage.getBoundingClientRect(); var W = st.width || 1, H = st.height || 1;
    return Math.max((W * Math.cos(r) + H * Math.sin(r)) / W, (W * Math.sin(r) + H * Math.cos(r)) / H, 1);
  }
  function applyPhotoTransform() {
    var deg = 0; try { var idx = S.photos.indexOf(S.photoUrl); deg = (adjOf(idx < 0 ? 0 : idx).rot) || 0; } catch (_) { void _; }
    var cs = deg ? coverScaleForRot(deg) : 1;
    refs.photowrap.style.transform = 'translate(' + S.pz.tx + 'px,' + S.pz.ty + 'px) scale(' + ((S.pz.scale || 1) * cs) + ') rotate(' + deg + 'deg)';
  }
  function applyPz() { applyPhotoTransform(); }
  function applyStraighten() { applyPhotoTransform(); }
  function stageDown(e) {
    if (S.tool === 'draw' || (e.target.closest && (e.target.closest('.itl') || e.target.closest('.itrb') || e.target.closest('.itpanel')))) return;
    pinchPts[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(pinchPts);
    if (ids.length === 2) { var a = pinchPts[ids[0]], b = pinchPts[ids[1]]; pinch0 = { d: pdist(a, b), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, s: S.pz.scale, tx: S.pz.tx, ty: S.pz.ty }; }
  }
  function stageMove(e) {
    if (!pinchPts[e.pointerId]) return;
    pinchPts[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(pinchPts);
    if (ids.length === 2 && pinch0) {
      var a = pinchPts[ids[0]], b = pinchPts[ids[1]], d = pdist(a, b);
      S.pz.scale = Math.max(1, Math.min(4, pinch0.s * d / pinch0.d));
      S.pz.tx = pinch0.tx + ((a.x + b.x) / 2 - pinch0.mx);
      S.pz.ty = pinch0.ty + ((a.y + b.y) / 2 - pinch0.my);
      applyPz();
    }
  }
  function stageUp(e) { delete pinchPts[e.pointerId]; if (Object.keys(pinchPts).length < 2) pinch0 = null; }

  /* ── 텍스트 ── */
  function addText() {
    var L = makeLayer('text');
    L.font = FONTS[0]; L.color = COLORS[0]; L.align = 'center'; L.fontSize = 30; L.text = '내용을 입력하세요';
    var t = el('div', 'itl-text'); t.textContent = L.text; t.style.cssText = 'font-family:' + L.font.family + ';font-weight:' + L.font.weight + ';color:' + L.color + ';text-align:center;font-size:' + L.fontSize + 'px';
    L.el.appendChild(t); L.tx = t;
    placeCenter(L, 180, 50); selectLayer(L);
    setTimeout(function () { editText(L); }, 30);
    return L;
  }
  function editText(L) {
    L.tx.setAttribute('contenteditable', 'true'); L.tx.focus();
    document.execCommand && document.execCommand('selectAll', false, null);
    L.tx.addEventListener('blur', function () {
      L.tx.removeAttribute('contenteditable'); L.text = L.tx.textContent || '';
    }, { once: true });
  }
  /* ── 우리샵 스타일 입력 레이어 렌더(학습 round-trip용) ── */
  function fontByKey(k) { for (var i = 0; i < FONTS.length; i++) { if (FONTS[i].key === k) return FONTS[i]; } return null; }
  function addShopLayer(spec, R) {
    if (spec.type === 'image') return addShopImage(spec, R);
    if (spec.type === 'line') return addShopLine(spec, R);
    var isBadge = spec.type === 'badge';
    var L = makeLayer(isBadge ? 'badge' : 'text');
    L.role = spec.role || '';
    L.font = fontByKey(spec.font) || FONTS[0];
    L.color = spec.color || '#FFFFFF';
    L.align = spec.align || 'center';
    L.fontSize = Math.max(12, Math.round((spec.size != null ? spec.size : 0.06) * R.height));
    L.text = spec.text || '';
    L.stroke = !!(spec.outline && spec.outline.on) || !!spec.stroke;
    L.shadow = isBadge || !!(spec.shadow && spec.shadow.on) || !!spec.shadow;
    var t = el('div', 'itl-text'); t.textContent = L.text;
    var css = 'font-family:' + L.font.family + ';font-weight:' + (spec.weight || L.font.weight) + ';color:' + L.color + ';text-align:' + L.align + ';font-size:' + L.fontSize + 'px;white-space:pre-wrap';
    if (spec.w != null) css += ';max-width:' + Math.round(spec.w * R.width) + 'px';
    if (L.stroke) css += ';-webkit-text-stroke:1px rgba(0,0,0,.5)';
    if (L.shadow) css += ';text-shadow:0 2px 8px rgba(0,0,0,.35)';
    if (isBadge) css += ';background:' + (spec.bg || 'rgba(0,0,0,.32)') + ';padding:4px 10px;border-radius:8px';
    if (spec.opacity != null) css += ';opacity:' + spec.opacity;
    t.style.cssText = css; L.el.appendChild(t); L.tx = t;
    var bw = L.el.offsetWidth, bh = L.el.offsetHeight;
    L.x = (spec.x != null ? spec.x : 0.5) * R.width - bw / 2;
    L.y = (spec.y != null ? spec.y : 0.5) * R.height - bh / 2;
    applyXf(L);
    return L;
  }
  // [#14] 우리샵 스타일에서 들어온 구분선 → 편집 가능한 line 도형 레이어로.
  function addShopLine(spec, R) {
    var L = makeLayer('shape'); L.shape = 'line'; L.color = spec.color || '#ffffff'; L.fill = true; L.role = 'rule'; L.rot = spec.rot || 0;
    L.strokeW = Math.max(2, Math.round((spec.size != null ? spec.size : 0.006) * R.height));
    var w = Math.round((spec.w != null ? spec.w : 0.11) * R.width);
    var d = el('div', 'itl-shape'); styleShape(d, L); d.style.width = w + 'px'; L.el.appendChild(d); L.tx = d;
    var bh = Math.max(L.strokeW, 22);
    L.x = (spec.x != null ? spec.x : 0.5) * R.width - w / 2;
    L.y = (spec.y != null ? spec.y : 0.88) * R.height - bh / 2;
    applyXf(L);
    return L;
  }
  function addShopImage(spec, R) {
    var L = makeLayer('image'); L.role = spec.role || 'logo'; L.src = spec.src;
    var im = document.createElement('img'); im.src = spec.src; im.alt = '';
    im.style.cssText = 'display:block;width:' + Math.round((spec.w != null ? spec.w : 0.24) * R.width) + 'px;height:auto;opacity:' + (spec.opacity != null ? spec.opacity : 1) + ';pointer-events:none';
    L.el.appendChild(im); L.tx = im;
    var place = function () {
      var bw = L.el.offsetWidth || ((spec.w || 0.24) * R.width), bh = L.el.offsetHeight || bw;
      L.x = (spec.x != null ? spec.x : 0.82) * R.width - bw / 2;
      L.y = (spec.y != null ? spec.y : 0.1) * R.height - bh / 2; applyXf(L);
    };
    if (im.complete && im.naturalWidth) place(); else im.onload = place;
    place();
    return L;
  }
  function renderIncoming(layers) {
    if (!Array.isArray(layers) || !layers.length) return;
    var R = refs.stage.getBoundingClientRect();
    layers.forEach(function (spec) { try { addShopLayer(spec, R); } catch (_) { void _; } });
    _deOverlapIncoming();   // [#2] 텍스트 길이 무관 — 자동배치 글자/선이 서로 안 겹치게 세로로 벌림
    S.active = null; S.layers.forEach(function (x) { x.el.classList.remove('is-active'); });
  }
  // [#2] 자동배치 역할 레이어(시술명/내용/선)가 겹치면 세로로 벌리고, 화면 밖이면 그룹을 위로 당겨 유지.
  function _deOverlapIncoming() {
    var R = refs.stage.getBoundingClientRect(); if (!R.height) return;
    var arr = S.layers.filter(function (L) { return ((L.type === 'text' || L.type === 'badge') && L.role) || (L.type === 'shape' && L.role === 'rule'); });
    if (arr.length < 2) return;
    arr.sort(function (a, b) { return a.el.getBoundingClientRect().top - b.el.getBoundingClientRect().top; });
    var GAP = R.height * 0.010, moved = false;
    for (var i = 1; i < arr.length; i++) {
      var pb = arr[i - 1].el.getBoundingClientRect(), cb = arr[i].el.getBoundingClientRect();
      if (cb.top < pb.bottom + GAP) { arr[i].y += (pb.bottom + GAP) - cb.top; applyXf(arr[i]); moved = true; }
    }
    if (moved) {
      var last = arr[arr.length - 1].el.getBoundingClientRect();
      var overflow = last.bottom - (R.bottom - R.height * 0.02);
      if (overflow > 0) arr.forEach(function (L) { L.y -= overflow; applyXf(L); });
    }
  }
  function syncTextControls(L) {
    root.querySelectorAll('[data-font]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-font') === L.font.key); });
    root.querySelectorAll('[data-color]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-color') === L.color); });
    refs.aln.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-aln') === L.align); });
    refs.size.value = L.scale;
  }
  function applyFont(key) { var L = activeText(); if (!L) return; var f = FONTS.filter(function (x) { return x.key === key; })[0]; L.font = f; L.tx.style.fontFamily = f.family; L.tx.style.fontWeight = f.weight; }
  function applyColor(c) { var L = activeText(); if (!L) return; L.color = c; L.tx.style.color = c; }
  function applyAlign(a) { var L = activeText(); if (!L) return; L.align = a; L.tx.style.textAlign = a; }
  function applyScale(v) { var L = S.active; if (!L) return; L.scale = parseFloat(v); applyXf(L); }
  function activeText() { return S.active && S.active.type === 'text' ? S.active : null; }

  /* ── 스티커 ── */
  function addSticker(emoji) {
    var L = makeLayer('sticker'); L.emoji = emoji; L.fontSize = 64;
    var s = el('div', 'itl-sticker'); s.textContent = emoji; L.el.appendChild(s); L.tx = s;
    placeCenter(L, 64, 64); selectLayer(L);
    closeStickerSheet();   // [②] 스티커 하나 고르면 하단 시트 내려가고 사진 위에서 바로 배치
  }
  // [③] 우리샵 피처 칩(위치/예약/가격/시간) — 탭하면 텍스트 레이어로 사진 위에 올림(클릭 동작).
  function addFeatureLayer(kind) {
    var map = {
      loc:   { text: (S.shopName || '우리샵'),   color: '#FFFFFF', accent: false },
      book:  { text: '예약하기',                 color: '#FFFFFF', accent: true  },
      price: { text: '가격 문의',                color: '#FFFFFF', accent: false },
      time:  { text: '영업시간 안내',            color: '#FFFFFF', accent: false }
    };
    var m = map[kind]; if (!m) return;
    var L = makeLayer('text');
    L.font = FONTS[0]; L.color = m.color; L.align = 'center'; L.fontSize = 26; L.text = m.text;
    L.shadow = true; L.role = (kind === 'loc' ? 'shop' : kind);
    var t = el('div', 'itl-text'); t.textContent = m.text;
    var css = 'font-family:' + L.font.family + ';font-weight:800;color:' + m.color + ';text-align:center;font-size:26px;text-shadow:0 2px 8px rgba(0,0,0,.4)';
    if (m.accent) { css += ';background:linear-gradient(135deg,#D58A95,#BC6675);padding:8px 18px;border-radius:999px;text-shadow:none'; L.badge = true; }
    t.style.cssText = css; L.el.appendChild(t); L.tx = t;
    placeCenter(L, 150, 46); selectLayer(L);
    closeStickerSheet();
  }
  // [②] 스티커 시트 닫기 — 도구 비활성(사진 위에서 바로 만지도록). 닫아도 우측 레일은 그대로.
  function closeStickerSheet() {
    S.tool = null;
    root.querySelectorAll('.itrb').forEach(function (b) { b.classList.remove('on'); });
    if (refs.panels.sticker) refs.panels.sticker.classList.remove('is-open');
    if (refs.stkSheet) refs.stkSheet.classList.remove('is-tall');
    refs.draw.classList.remove('is-armed'); refs.draw.style.zIndex = '3';
    refs.layers.style.pointerEvents = '';
  }
  /* ── 이미지 스티커(데코·내 스티커) #6/#7 ── */
  function addImageSticker(src) {
    var L = makeLayer('image'); L.role = 'sticker'; L.src = src;
    var im = document.createElement('img'); im.src = src; im.alt = ''; im.setAttribute('draggable', 'false');
    im.style.cssText = 'display:block;width:120px;height:auto;pointer-events:none';
    L.el.appendChild(im); L.tx = im;
    var place = function () { placeCenter(L, L.el.offsetWidth || 120, L.el.offsetHeight || 120); };
    if (im.complete && im.naturalWidth) place(); else im.onload = place;
    place(); selectLayer(L); closeStickerSheet();
  }
  function loadMyStk() { try { return JSON.parse(localStorage.getItem(STK_KEY) || '[]'); } catch (_) { return []; } }
  function saveMyStk(arr) { try { localStorage.setItem(STK_KEY, JSON.stringify(arr.slice(-30))); } catch (_) { void _; } }
  function renderMyStickers() {
    if (!refs.myStk) return;
    var arr = loadMyStk();
    if (!arr.length) { refs.myStk.innerHTML = '<div class="itstk__empty">사진을 올리면 내 스티커로 저장돼 언제든 쓸 수 있어요</div>'; return; }
    refs.myStk.innerHTML = arr.map(function (u, i) {
      return '<button class="itdeco itmine" data-mine="' + i + '"><img src="' + u + '" alt="" draggable="false"><span class="itmine__x" data-minedel="' + i + '">×</span></button>';
    }).join('');
  }
  function addMyStickerFromFile(file) {
    if (!file || !/^image\//.test(file.type)) return;
    var rd = new FileReader();
    rd.onload = function () {
      var img = new Image();
      img.onload = function () {
        var max = 256, sc = Math.min(1, max / Math.max(img.width, img.height));
        var w = Math.max(1, Math.round(img.width * sc)), h = Math.max(1, Math.round(img.height * sc));
        var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        var url; try { url = cv.toDataURL('image/png'); } catch (_) { url = rd.result; }
        var arr = loadMyStk(); arr.push(url); saveMyStk(arr); renderMyStickers();
      };
      img.onerror = function () { var arr = loadMyStk(); arr.push(rd.result); saveMyStk(arr); renderMyStickers(); };
      img.src = rd.result;
    };
    rd.readAsDataURL(file);
  }
  function delMyStk(i) { var arr = loadMyStk(); arr.splice(i, 1); saveMyStk(arr); renderMyStickers(); }

  /* ── 도형 #8 ── */
  function styleShape(d, L) {
    var c = L.color, sw = L.strokeW || 6;
    if (L.shape === 'line') {
      // 박스는 잡기 쉽게(>=22px), 보이는 막대는 굵기(sw)만큼 가운데 — 내보내기도 sw 두께로 그림.
      d.style.cssText = 'width:180px;height:' + Math.max(sw, 22) + 'px;border-radius:' + (sw / 2) + 'px;background:linear-gradient(' + c + ',' + c + ') center/100% ' + sw + 'px no-repeat';
    } else {
      var base = 'box-sizing:border-box;width:120px;height:120px;';
      base += L.fill ? ('background:' + c + ';border:0;') : ('background:transparent;border:' + sw + 'px solid ' + c + ';');
      base += L.shape === 'circle' ? 'border-radius:50%' : (L.shape === 'round' ? 'border-radius:18px' : 'border-radius:0');
      d.style.cssText = base;
    }
  }
  function addShape(kind) {
    var L = makeLayer('shape');
    L.shape = kind; L.color = S.shapeColor; L.fill = !!S.shapeFill; L.strokeW = S.shapeThick;
    var d = el('div', 'itl-shape'); styleShape(d, L); L.el.appendChild(d); L.tx = d;
    var w = kind === 'line' ? 180 : 120, h = kind === 'line' ? Math.max(L.strokeW || 6, 22) : 120;
    placeCenter(L, w, h); selectLayer(L);
  }
  // [#5] 활성 도형에 색/채움/굵기 즉시 반영(새로 만드는 것뿐 아니라 선택된 것에도).
  function applyShapeStyle() {
    var L = S.active; if (!L || L.type !== 'shape') return;
    L.color = S.shapeColor; L.fill = !!S.shapeFill; L.strokeW = S.shapeThick;
    if (L.shape === 'line') { var cw = parseFloat(L.tx.style.width) || L.tx.offsetWidth || 180; styleShape(L.tx, L); L.tx.style.width = cw + 'px'; }
    else styleShape(L.tx, L);
  }
  // [①] PC/모바일 공통 — 가로 스크롤 줄(폰트/색/칩)을 드래그로 넘김(인스타식 스와이프).
  function enableDragScroll(elm) {
    if (!elm || elm._dragScroll) return; elm._dragScroll = true;
    var down = false, sx = 0, sl = 0, moved = 0;
    elm.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch') return;   // 터치는 네이티브 관성 스크롤 그대로
      down = true; sx = e.clientX; sl = elm.scrollLeft; moved = 0; elm.classList.add('is-dragging');
    });
    elm.addEventListener('pointermove', function (e) {
      if (!down) return; var dx = e.clientX - sx; moved = Math.max(moved, Math.abs(dx)); elm.scrollLeft = sl - dx;
    });
    var up = function () { down = false; elm.classList.remove('is-dragging'); };
    elm.addEventListener('pointerup', up); elm.addEventListener('pointerleave', up);
    // 드래그였으면 버튼 클릭 무효화(드래그 끝의 의도치 않은 선택 방지)
    elm.addEventListener('click', function (e) { if (moved > 6) { e.stopPropagation(); e.preventDefault(); moved = 0; } }, true);
  }

  /* ── 레이아웃(타입 칩 + 사진 순서 선택) ── */
  function selectLayout(i) {
    S.layout = LAYOUTS[i];
    S.layoutOrder = []; S.cellCrop = [];   // 타입 바꾸면 자리 선택·셀 크롭 초기화
    refs.frame.className = 'itded__frame ' + (S.layout.frame || '');
    root.querySelectorAll('.itlaytype').forEach(function (b) { b.classList.toggle('on', +b.getAttribute('data-lay') === i); });
    renderCollage(); renderLayoutStrip(); renderLayoutHint();
  }
  // 사진 순서 탭 — grid면 자리(좌우/4분할)에 순서대로 배정, 1장이면 그 사진을 단일 배경으로.
  function onLayThumb(idx) {
    var kind = S.layout.kind || 'single';
    if (kind === 'single') {
      S.photoUrl = S.photos[idx]; S.photoCss = 'url("' + S.photos[idx] + '")';
      refs.photo.style.backgroundImage = S.photoCss;
      renderLayoutStrip(); renderLayoutHint(); return;
    }
    var at = S.layoutOrder.indexOf(idx);
    if (at >= 0) S.layoutOrder.splice(at, 1);              // 다시 누르면 해제(뒤 번호 당겨짐)
    else if (S.layoutOrder.length < _layNeed(kind)) S.layoutOrder.push(idx);
    renderCollage(); renderLayoutStrip(); renderLayoutHint();
  }
  function renderLayoutStrip() {
    if (!refs.layStrip) return;
    var kind = S.layout.kind || 'single';
    refs.layStrip.innerHTML = (S.photos || []).map(function (u, i) {
      var ord = (kind === 'single') ? (S.photoUrl === u ? 0 : -1) : S.layoutOrder.indexOf(i);
      var badge = (kind !== 'single' && ord >= 0) ? '<span class="itlaybadge">' + (ord + 1) + '</span>' : '';
      var sel = (kind === 'single' && S.photoUrl === u) ? ' on' : (ord >= 0 ? ' on' : '');
      return '<button class="itlaythumb' + sel + '" data-laythumb="' + i + '" style="background-image:url(\'' + u + '\')">' + badge + '</button>';
    }).join('');
  }
  function renderLayoutHint() {
    if (!refs.layHint) return;
    var kind = S.layout.kind || 'single';
    if (kind === 'single') { refs.layHint.textContent = '1장 — 넣을 사진 하나를 누르세요.'; return; }
    var pos = _layPos(kind), need = _layNeed(kind);
    refs.layHint.innerHTML = '<b>' + S.layout.label + '</b> · 사진을 순서대로 누르세요 — ' +
      pos.map(function (p, i) { return (i + 1) + '=' + p; }).join(' · ') + ' (' + S.layoutOrder.length + '/' + need + ')' +
      (S.layoutOrder.length ? '<span class="itlay2__tip">칸을 끌어 위치 조정 · 두 손가락으로 확대</span>' : '');
  }
  // 콜라주(좌우2장/4장) — 단일이면 collage 숨김. grid면 선택 순서(layoutOrder)대로 칸 채움(미선택=자리표시).
  function renderCollage() {
    var kind = S.layout.kind || 'single';
    var fit = S.fitMode || 'cover';
    if (kind === 'single') { refs.collage.hidden = true; refs.collage.className = 'itded__collage'; refs.collage.innerHTML = ''; refs.photo.style.backgroundImage = S.photoCss; refs.photo.style.backgroundSize = fit; refs.photo.style.backgroundColor = (fit === 'contain' ? (S.collageBg || '#fff') : 'transparent'); return; }
    refs.collage.className = 'itded__collage is-' + kind;   // is-grid2 / is-grid4 → 2열/2x2 그리드
    var n = _layNeed(kind), pos = _layPos(kind), cells = '';
    for (var k = 0; k < n; k++) {
      var idx = S.layoutOrder[k];
      if (idx != null && S.photos[idx]) cells += '<div class="itded__cell" data-ci="' + idx + '" data-cell="' + k + '" style="filter:' + filterStr(adjOf(idx)) + '"><img class="itcellimg" src="' + S.photos[idx] + '" draggable="false" style="object-fit:' + fit + ';transform:' + cropXf(k) + '"></div>';
      else cells += '<div class="itded__cell itded__cell--empty">' + (k + 1) + '번<br>' + pos[k] + '</div>';
    }
    refs.collage.style.gap = (S.collageGap != null ? S.collageGap : 3) + 'px';
    refs.collage.style.background = S.collageBgImg ? ('center/cover no-repeat url("' + S.collageBgImg + '")') : (S.collageBg || '#fff');
    refs.collage.innerHTML = cells; refs.collage.hidden = false;
  }
  // [#5] 꽉 채움(cover)/전체(contain) — 풀 사진이 잘리지 않게 '전체'면 여백에 배경색.
  function applyFit() {
    var fit = S.fitMode || 'cover';
    if ((S.layout.kind || 'single') === 'single') {
      refs.photo.style.backgroundSize = fit; refs.photo.style.backgroundColor = (fit === 'contain' ? (S.collageBg || '#fff') : 'transparent');
    } else { renderCollage(); }
  }
  /* ── 셀별 크롭(콜라주 칸마다 드래그/핀치 재구도) ── */
  function cropOf(k) { if (!S.cellCrop[k]) S.cellCrop[k] = { s: 1, tx: 0, ty: 0 }; return S.cellCrop[k]; }
  function cropXf(k) { var c = (S.cellCrop && S.cellCrop[k]) || { s: 1, tx: 0, ty: 0 }; return 'translate(' + c.tx + 'px,' + c.ty + 'px) scale(' + c.s + ')'; }
  function cellElByK(k) { return refs.collage.querySelector('[data-cell="' + k + '"]'); }
  function clampCrop(k) { var c = cropOf(k), el2 = cellElByK(k); if (!el2) return; var r = el2.getBoundingClientRect(); var mx = (c.s - 1) * r.width / 2, my = (c.s - 1) * r.height / 2; c.tx = Math.max(-mx, Math.min(mx, c.tx)); c.ty = Math.max(-my, Math.min(my, c.ty)); }
  function applyCrop(k) { clampCrop(k); var el2 = cellElByK(k); var im = el2 && el2.querySelector('.itcellimg'); if (im) im.style.transform = cropXf(k); }
  function selectCell(k) { S.cellSel = k; refs.collage.querySelectorAll('[data-cell]').forEach(function (c) { c.classList.toggle('is-cellsel', +c.getAttribute('data-cell') === k); }); }
  var cropDrag = null, cropPinch = null, cellPts = {};
  function onCellDown(e) {
    if (refs.collage.hidden) return;
    var cell = e.target.closest && e.target.closest('[data-cell]'); if (!cell) return;
    e.preventDefault();
    var k = +cell.getAttribute('data-cell'); selectCell(k);
    cellPts[k] = cellPts[k] || {}; cellPts[k][e.pointerId] = { x: e.clientX, y: e.clientY };
    try { refs.collage.setPointerCapture(e.pointerId); } catch (_) { void _; }
    var ids = Object.keys(cellPts[k]); var c = cropOf(k);
    if (ids.length >= 2) { cropDrag = null; var p1 = cellPts[k][ids[0]], p2 = cellPts[k][ids[1]]; cropPinch = { k: k, ids: [ids[0], ids[1]], d0: Math.max(8, Math.hypot(p1.x - p2.x, p1.y - p2.y)), s0: c.s }; return; }
    cropDrag = { k: k, sx: e.clientX, sy: e.clientY, tx0: c.tx, ty0: c.ty };
  }
  function onCellMove(e) {
    if (cropPinch) {
      var k = cropPinch.k; if (cellPts[k] && cellPts[k][e.pointerId]) cellPts[k][e.pointerId] = { x: e.clientX, y: e.clientY };
      var p1 = cellPts[k] && cellPts[k][cropPinch.ids[0]], p2 = cellPts[k] && cellPts[k][cropPinch.ids[1]]; if (!p1 || !p2) return;
      var c = cropOf(k); c.s = Math.max(1, Math.min(4, cropPinch.s0 * Math.hypot(p1.x - p2.x, p1.y - p2.y) / cropPinch.d0)); applyCrop(k); return;
    }
    if (cropDrag) { var c2 = cropOf(cropDrag.k); c2.tx = cropDrag.tx0 + (e.clientX - cropDrag.sx); c2.ty = cropDrag.ty0 + (e.clientY - cropDrag.sy); applyCrop(cropDrag.k); }
  }
  function onCellUp(e) {
    var kk; for (kk in cellPts) { if (cellPts[kk] && cellPts[kk][e.pointerId]) delete cellPts[kk][e.pointerId]; }
    if (cropPinch && (!cellPts[cropPinch.k] || Object.keys(cellPts[cropPinch.k]).length < 2)) cropPinch = null;
    cropDrag = null;
  }

  /* ── 사진별 보정(밝기/대비/채도/온도/선명도) ── */
  function adjOf(i) { if (!S.adj[i]) S.adj[i] = defAdj(); return S.adj[i]; }
  function adjReadout(c, v) { return (c.k === 'w' || c.k === 'sh') ? ('' + v) : ((v - 100 >= 0 ? '+' : '') + (v - 100)); }
  var _adjRaf = 0;
  function applyAdjThrottled() { if (_adjRaf) return; var raf = window.requestAnimationFrame || function (f) { return setTimeout(f, 16); }; _adjRaf = raf(function () { _adjRaf = 0; applyAdjToDisplay(); }); }
  function applyAdjToDisplay() {
    if ((S.layout.kind || 'single') === 'single') {
      var idx = S.photos.indexOf(S.photoUrl); refs.photo.style.filter = filterStr(adjOf(idx < 0 ? 0 : idx));   // straighten 은 회전/사진전환 때만(여기선 호출 안 함 → 매 틱 reflow 제거)
    } else {
      // [#1 끊김] 셀 innerHTML 재생성(배경이미지 재디코딩) 대신 필터만 in-place 갱신
      refs.collage.querySelectorAll('.itded__cell[data-ci]').forEach(function (cell) { cell.style.filter = filterStr(adjOf(+cell.getAttribute('data-ci'))); });
    }
  }
  function syncAdjSliders() {
    var a = adjOf(S.adjSel);
    ADJ_CTRLS.forEach(function (c) {
      var inp = root.querySelector('[data-adj="' + c.k + '"]'); if (inp) inp.value = a[c.k];
      var out = root.querySelector('[data-adjout="' + c.k + '"]'); if (out) out.textContent = adjReadout(c, a[c.k]);
    });
    if (refs.adjRot) refs.adjRot.value = a.rot || 0;
    if (refs.adjRotOut) refs.adjRotOut.textContent = (a.rot || 0) + '°';
  }
  function renderAdjust() {
    if (!refs.adjStrip) return;
    refs.adjStrip.innerHTML = (S.photos || []).map(function (u, i) {
      return '<button class="itadjthumb' + (i === S.adjSel ? ' on' : '') + '" data-adjthumb="' + i + '" style="background-image:url(\'' + u + '\');filter:' + filterStr(adjOf(i)) + '"></button>';
    }).join('');
    syncAdjSliders();
  }
  function onAdjThumb(i) {
    S.adjSel = i;
    if ((S.layout.kind || 'single') === 'single') { S.photoUrl = S.photos[i]; S.photoCss = 'url("' + S.photos[i] + '")'; refs.photo.style.backgroundImage = S.photoCss; }
    applyAdjToDisplay(); applyStraighten(); renderAdjust();
  }
  // [#4] 배경 선호(색/이미지) 기억 — 다음에도 같은 배경.
  function loadBgPref() { try { return JSON.parse(localStorage.getItem('itdasy:itd_bg') || '{}'); } catch (_) { return {}; } }
  function saveBgPref() { try { localStorage.setItem('itdasy:itd_bg', JSON.stringify({ color: S.collageBg, img: S.collageBgImg || null })); } catch (_) { void _; } }
  // [누끼] 사진 배경 제거 → '고른 배경'(색/이미지)으로 합성. 매트(removedBg)를 캐시해 다음 배경 변경은 0초(API 0).
  function doCutout(idx, silent) {
    if (!(window.PhotoEditorBgCompose && window.PhotoEditorBgCompose.compose)) { if (!silent) toastIt('배경 제거 모듈을 불러오지 못했어요'); return; }
    var i = (idx != null ? idx : S.adjSel);
    if (!S.origPhotos) S.origPhotos = []; if (S.origPhotos[i] == null) S.origPhotos[i] = S.photos[i];   // 원본 1회 보관
    var src = S.origPhotos[i]; if (!src) return;
    S.matte = S.matte || {}; S.cutSet = S.cutSet || {};
    var cached = S.matte[i] || null;   // 매트 있으면 누끼 재요청 없이 배경만 다시 입힘(빠름)
    if (!silent && refs.adjCut) { refs.adjCut.disabled = true; refs.adjCut.classList.add('is-busy'); }
    if (!silent) toastIt(cached ? '배경 입히는 중…' : '배경 지우는 중…');
    var bg = S.collageBgImg ? { imageData: S.collageBgImg } : { color: S.collageBg || '#FFFFFF' };
    window.PhotoEditorBgCompose.compose({ srcUrl: src, bg: bg, targetRatio: '4:5', preRemovedBgUrl: cached }).then(function (r) {
      if (!silent && refs.adjCut) { refs.adjCut.disabled = false; refs.adjCut.classList.remove('is-busy'); }
      if (!r || !r.composedDataUrl) { if (!silent) toastIt('배경 제거에 실패했어요'); return; }
      if (r.removedBgDataUrl) S.matte[i] = r.removedBgDataUrl;   // 매트 캐시
      S.cutSet[i] = true;
      var wasShown = (S.photoUrl === S.photos[i]);
      S.photos[i] = r.composedDataUrl;
      if (wasShown) { S.photoUrl = r.composedDataUrl; S.photoCss = 'url("' + r.composedDataUrl + '")'; refs.photo.style.backgroundImage = S.photoCss; }
      renderAdjust(); renderLayoutStrip(); renderCollage(); applyAdjToDisplay();
      if (!silent) toastIt('배경을 정리했어요');
    }).catch(function () { if (!silent && refs.adjCut) { refs.adjCut.disabled = false; refs.adjCut.classList.remove('is-busy'); } if (!silent) toastIt('배경 제거 실패 — 네트워크를 확인해 주세요'); });
  }
  // 배경(색/이미지) 바뀌면 이미 누끼한 사진들을 캐시 매트로 즉시 재합성(0초).
  function recutWithBg() { if (!S.cutSet) return; Object.keys(S.cutSet).forEach(function (k) { if (S.cutSet[k]) doCutout(+k, true); }); }
  function undoCutout() {
    var i = S.adjSel; if (!(S.origPhotos && S.origPhotos[i] != null)) { toastIt('되돌릴 원본이 없어요'); return; }
    var wasShown = (S.photoUrl === S.photos[i]); var orig = S.origPhotos[i];
    S.photos[i] = orig; if (S.cutSet) S.cutSet[i] = false;
    if (wasShown) { S.photoUrl = orig; S.photoCss = 'url("' + orig + '")'; refs.photo.style.backgroundImage = S.photoCss; }
    renderAdjust(); renderLayoutStrip(); renderCollage(); applyAdjToDisplay();
    toastIt('원본으로 되돌렸어요');
  }
  function toastIt(m) { try { (window.toast || function () {})(m); } catch (_) { void _; } }
  function addPhotoFromFile(file) {
    if (!file || !/^image\//.test(file.type)) return;
    var rd = new FileReader();
    rd.onload = function () {
      S.photos.push(rd.result); S.adj.push(defAdj());
      renderLayoutStrip(); renderAdjust();
    };
    rd.readAsDataURL(file);
  }
  // [#4] 배경 사진 업로드 — 축소 저장 → 콜라주/누끼 배경으로 + 기억(persist).
  function addBgImageFromFile(file) {
    if (!file || !/^image\//.test(file.type)) return;
    var rd = new FileReader();
    rd.onload = function () {
      var img = new Image();
      img.onload = function () {
        var max = 900, sc = Math.min(1, max / Math.max(img.width, img.height));
        var w = Math.max(1, Math.round(img.width * sc)), h = Math.max(1, Math.round(img.height * sc));
        var cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').drawImage(img, 0, 0, w, h);
        try { S.collageBgImg = cv.toDataURL('image/jpeg', 0.85); } catch (_) { S.collageBgImg = rd.result; }
        saveBgPref(); renderCollage(); applyFit(); recutWithBg(); toastIt('배경 사진을 정했어요');
      };
      img.onerror = function () { S.collageBgImg = rd.result; saveBgPref(); renderCollage(); applyFit(); };
      img.src = rd.result;
    };
    rd.readAsDataURL(file);
  }

  /* ── 그리기 ── */
  function initCanvas() {
    var r = refs.stage.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    refs.draw.width = Math.round(r.width * dpr); refs.draw.height = Math.round(r.height * dpr);
    refs.draw.style.width = r.width + 'px'; refs.draw.style.height = r.height + 'px';
    refs.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); refs.ctx.lineCap = 'round'; refs.ctx.lineJoin = 'round';
  }
  function strokeStyle() {
    var c = refs.ctx; c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.shadowBlur = 0; c.shadowColor = 'transparent';
    c.lineWidth = S.brushSize; c.strokeStyle = S.drawColor;
    if (S.brush === 'marker') { c.globalAlpha = 0.4; c.lineWidth = S.brushSize * 1.8; }
    else if (S.brush === 'neon') { c.shadowBlur = 12; c.shadowColor = S.drawColor; }
    else if (S.brush === 'eraser') { c.globalCompositeOperation = 'destination-out'; c.lineWidth = S.brushSize * 1.6; }
  }
  var dpos = null, _drawRect = null;
  function drawDown(e) {
    if (S.tool !== 'draw') return;
    _drawRect = refs.stage.getBoundingClientRect();   // [⑤렉] 스트로크 시작 때 1회만 측정 → move 마다 reflow 제거
    dpos = { x: e.clientX - _drawRect.left, y: e.clientY - _drawRect.top };
    strokeStyle(); refs.ctx.beginPath(); refs.ctx.moveTo(dpos.x, dpos.y); refs.ctx.lineTo(dpos.x + 0.1, dpos.y + 0.1); refs.ctx.stroke();
    try { refs.draw.setPointerCapture(e.pointerId); } catch (_) { void _; }
  }
  function drawMove(e) {
    if (!dpos || S.tool !== 'draw') return;
    var r = _drawRect || refs.stage.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    refs.ctx.beginPath(); refs.ctx.moveTo(dpos.x, dpos.y); refs.ctx.lineTo(x, y); refs.ctx.stroke();
    dpos = { x: x, y: y };
  }
  function drawUp() { dpos = null; }

  /* ── 합성 내보내기 (사진 줌·콜라주·레이어 회전 반영) ── */
  function loadImg(url) { return new Promise(function (res) { var im = new Image(); im.crossOrigin = 'anonymous'; im.onload = function () { res(im); }; im.onerror = function () { res(null); }; im.src = url; }); }
  function coverRect(im, w, h) { var sc = Math.max(w / im.width, h / im.height); return { dw: im.width * sc, dh: im.height * sc }; }
  function containRect(im, w, h) { var sc = Math.min(w / im.width, h / im.height); return { dw: im.width * sc, dh: im.height * sc }; }
  function fitRect(im, w, h) { return (S.fitMode === 'contain') ? containRect(im, w, h) : coverRect(im, w, h); }
  function rrPath(c, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2)); c.beginPath();
    if (c.roundRect) { c.roundRect(x, y, w, h, r); return; }
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  // 도형 캔버스 합성 — 회전/스케일은 호출부에서 translate+rotate 후, 비회전 크기(ow/oh)로 그림.
  function drawShape(c, L, ow, oh) {
    var sw = (L.strokeW || 6) * (L.scale || 1);
    c.fillStyle = L.color; c.strokeStyle = L.color; c.lineWidth = sw; c.lineJoin = 'round';
    if (L.shape === 'line') { rrPath(c, -ow / 2, -sw / 2, ow, sw, sw / 2); c.fill(); return; }
    if (L.shape === 'circle') {
      var rx = Math.max(1, (ow - (L.fill ? 0 : sw)) / 2), ry = Math.max(1, (oh - (L.fill ? 0 : sw)) / 2);
      c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); if (L.fill) c.fill(); else c.stroke(); return;
    }
    var rad = (L.shape === 'round' ? 18 : 0) * (L.scale || 1);
    if (L.fill) { rrPath(c, -ow / 2, -oh / 2, ow, oh, rad); c.fill(); }
    else { rrPath(c, -ow / 2 + sw / 2, -oh / 2 + sw / 2, ow - sw, oh - sw, Math.max(0, rad - sw / 2)); c.stroke(); }
  }
  function exportComposite(cb) {
    var r = refs.stage.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    var cv = document.createElement('canvas'); cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    var kind = S.layout.kind || 'single';
    var baseDone;
    if (kind === 'single') {
      var sIdx = S.photos.indexOf(S.photoUrl);
      var sDeg = (adjOf(sIdx < 0 ? 0 : sIdx).rot) || 0, sCs = sDeg ? coverScaleForRot(sDeg) : 1;
      if (S.fitMode === 'contain') { c.fillStyle = S.collageBg || '#fff'; c.fillRect(0, 0, r.width, r.height); }   // [#5] 전체 모드 여백 배경
      baseDone = loadImg(S.photoUrl).then(function (img) {
        if (!img) return; var cr = fitRect(img, r.width, r.height);
        c.save();
        c.translate(S.pz.tx, S.pz.ty); c.translate(r.width / 2, r.height / 2);
        c.scale(S.pz.scale * sCs, S.pz.scale * sCs); c.rotate(sDeg * Math.PI / 180); c.translate(-r.width / 2, -r.height / 2);
        c.filter = filterStr(adjOf(sIdx < 0 ? 0 : sIdx));
        c.drawImage(img, (r.width - cr.dw) / 2, (r.height - cr.dh) / 2, cr.dw, cr.dh);
        c.restore();
      });
    } else {
      var n = kind === 'grid4' ? 4 : 2, gap = S.collageGap != null ? S.collageGap : 3;
      c.fillStyle = S.collageBg || '#fff'; c.fillRect(0, 0, r.width, r.height);   // 간격 사이 배경색
      var idxs = []; for (var k = 0; k < n; k++) { var oi = S.layoutOrder[k]; idxs.push((oi != null && S.photos[oi] != null) ? oi : (S.photos[k] != null ? k : 0)); }
      var urls = idxs.map(function (i) { return S.photos[i] || S.photoUrl; });
      baseDone = Promise.all(urls.map(loadImg)).then(function (imgs) {
        var cols = 2, rows = kind === 'grid4' ? 2 : 1;
        var cw = r.width / cols, ch = r.height / rows;
        imgs.forEach(function (img, k) {
          if (!img) return;
          var x = (k % cols) * cw + gap / 2, y = Math.floor(k / cols) * ch + gap / 2, w = cw - gap, h = ch - gap;
          var cr = fitRect(img, w, h);
          c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
          c.filter = filterStr(adjOf(idxs[k]));
          var cp = (S.cellCrop && S.cellCrop[k]) || { s: 1, tx: 0, ty: 0 };   // [셀 크롭] 재구도 반영(중심 기준 scale+translate)
          if (cp.s !== 1 || cp.tx || cp.ty) { var ccx = x + w / 2, ccy = y + h / 2; c.translate(ccx + cp.tx, ccy + cp.ty); c.scale(cp.s, cp.s); c.translate(-ccx, -ccy); }
          c.drawImage(img, x + (w - cr.dw) / 2, y + (h - cr.dh) / 2, cr.dw, cr.dh); c.restore();
        });
      });
    }
    baseDone.then(function () {
      c.drawImage(refs.draw, 0, 0, r.width, r.height);   // 드로잉
      S.layers.forEach(function (L) {
        var b = L.el.getBoundingClientRect();
        var cx = b.left - r.left + b.width / 2, cy = b.top - r.top + b.height / 2;
        // 비회전 크기(레이아웃 기준 × scale) — 회전 레이어도 정확히 합성(AABB 왜곡 방지)
        var ow = (L.el.offsetWidth || b.width) * (L.scale || 1), oh = (L.el.offsetHeight || b.height) * (L.scale || 1);
        c.save(); c.translate(cx, cy); if (L.rot) c.rotate(L.rot * Math.PI / 180);
        if (L.type === 'shape') {
          drawShape(c, L, ow, oh);
        } else if (L.type === 'image') {
          try { c.drawImage(L.tx, -ow / 2, -oh / 2, ow, oh); } catch (_ei) { void _ei; }
        } else if (L.type === 'sticker') {
          c.font = (L.fontSize * L.scale) + 'px serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText(L.emoji, 0, 0);
        } else {
          var lines = (L.text || '').split('\n'); var fs = L.fontSize * L.scale;
          c.font = L.font.weight + ' ' + fs + 'px ' + L.font.family; c.fillStyle = L.color;
          c.textAlign = 'center'; c.textBaseline = 'middle'; c.shadowBlur = 8; c.shadowColor = 'rgba(0,0,0,.35)';
          var total = lines.length * fs * 1.16, sy = -total / 2 + fs * 0.58;
          lines.forEach(function (ln, i) { c.fillText(ln, 0, sy + i * fs * 1.16); });
          c.shadowBlur = 0;
        }
        c.restore();
      });
      try { cb(cv.toDataURL('image/jpeg', 0.92)); } catch (e) { void e; cb(null); }
    });
  }

  /* ── 배선 ── */
  function wire() {
    refs.rail.addEventListener('click', function (e) { var b = e.target.closest('[data-tool]'); if (b) setTool(b.getAttribute('data-tool')); });
    refs.stage.addEventListener('pointerdown', function (e) { if (e.target === refs.stage || e.target === refs.photo || e.target.classList.contains('itded__scrim')) selectLayer(null); });
    // 텍스트 컨트롤
    refs.fonts.addEventListener('click', function (e) { var b = e.target.closest('[data-font]'); if (!b) return; applyFont(b.getAttribute('data-font')); root.querySelectorAll('[data-font]').forEach(function (x) { x.classList.toggle('on', x === b); }); });
    refs.colors.addEventListener('click', function (e) { var b = e.target.closest('[data-color]'); if (!b) return; applyColor(b.getAttribute('data-color')); root.querySelectorAll('[data-color]').forEach(function (x) { x.classList.toggle('on', x === b); }); });
    refs.aln.addEventListener('click', function (e) { var b = e.target.closest('[data-aln]'); if (!b) return; applyAlign(b.getAttribute('data-aln')); refs.aln.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); }); });
    refs.size.addEventListener('input', function () { applyScale(refs.size.value); });
    // 스티커 — 이모지/우리샵 칩/데코/내 스티커 탭 → 레이어로 추가
    refs.stkSheet.addEventListener('click', function (e) {
      var del = e.target.closest('[data-minedel]'); if (del) { e.stopPropagation(); delMyStk(+del.getAttribute('data-minedel')); return; }
      var mine = e.target.closest('[data-mine]'); if (mine) { var arr = loadMyStk(); var u = arr[+mine.getAttribute('data-mine')]; if (u) addImageSticker(u); return; }
      var dc = e.target.closest('[data-deco]'); if (dc) { addImageSticker(DECO[+dc.getAttribute('data-deco')]); return; }
      var f = e.target.closest('[data-feat]'); if (f) { addFeatureLayer(f.getAttribute('data-feat')); return; }
      var b = e.target.closest('[data-stk]'); if (b) addSticker(b.getAttribute('data-stk'));
    });
    // [#7] 내 스티커 업로드(사진 선택 → 축소 저장 → 그리드 갱신)
    if (refs.stkUpload) refs.stkUpload.addEventListener('change', function () { var fl = refs.stkUpload.files && refs.stkUpload.files[0]; if (fl) addMyStickerFromFile(fl); refs.stkUpload.value = ''; });
    // [#8] 도형 패널 — 도형 탭=삽입, 채움 토글, 굵기, 색
    refs.panels.shape.addEventListener('click', function (e) {
      var sh = e.target.closest('[data-shape]'); if (sh) { addShape(sh.getAttribute('data-shape')); return; }
      var fl = e.target.closest('[data-shapefill]'); if (fl) { S.shapeFill = fl.getAttribute('data-shapefill') === '1'; refs.panels.shape.querySelectorAll('[data-shapefill]').forEach(function (x) { x.classList.toggle('on', x === fl); }); applyShapeStyle(); return; }
      var sc = e.target.closest('[data-scolor]'); if (sc) { S.shapeColor = sc.getAttribute('data-scolor'); refs.panels.shape.querySelectorAll('[data-scolor]').forEach(function (x) { x.classList.toggle('on', x === sc); }); applyShapeStyle(); return; }
    });
    refs.shapeThick.addEventListener('input', function () { S.shapeThick = +refs.shapeThick.value; applyShapeStyle(); });
    // [②] grip — 클릭=더 펼치기 토글, 아래로 드래그=시트 닫기(PC 마우스 포함)
    var grip = refs.stkSheet.querySelector('.itgrip');
    var gd = null;
    grip.addEventListener('pointerdown', function (e) { gd = { y: e.clientY, moved: false }; try { grip.setPointerCapture(e.pointerId); } catch (_) { void _; } });
    grip.addEventListener('pointermove', function (e) { if (!gd) return; var dy = e.clientY - gd.y; if (Math.abs(dy) > 4) gd.moved = true; });
    grip.addEventListener('pointerup', function (e) {
      if (!gd) { return; } var dy = e.clientY - gd.y; var was = gd; gd = null;
      if (dy > 56) { closeStickerSheet(); return; }              // 아래로 끌면 닫기
      if (dy < -40) { refs.stkSheet.classList.add('is-tall'); return; }   // 위로 끌면 더 펼치기
      if (!was.moved) refs.stkSheet.classList.toggle('is-tall');  // 그냥 탭이면 토글
    });
    // [①] 가로 스크롤 줄 드래그 스와이프(폰트/색/칩)
    enableDragScroll(refs.fonts); enableDragScroll(refs.colors);
    enableDragScroll(refs.stkSheet.querySelector('.itfstk'));
    enableDragScroll(refs.panels.shape.querySelector('.itshape__row'));
    enableDragScroll(refs.panels.shape.querySelector('.itshape__colors'));
    // 레이아웃 — 타입 칩 선택 + 렌더된 사진 순서 탭 + 배경색
    refs.panels.layout.addEventListener('click', function (e) {
      var t = e.target.closest('[data-lay]'); if (t) { selectLayout(+t.getAttribute('data-lay')); return; }
      var th = e.target.closest('[data-laythumb]'); if (th) { onLayThumb(+th.getAttribute('data-laythumb')); return; }
      var bg = e.target.closest('[data-bg]'); if (bg) { S.collageBg = bg.getAttribute('data-bg'); S.collageBgImg = null; saveBgPref(); refs.panels.layout.querySelectorAll('[data-bg]').forEach(function (x) { x.classList.toggle('on', x === bg); }); renderCollage(); applyFit(); recutWithBg(); return; }
      var ft = e.target.closest('[data-fit]'); if (ft) { S.fitMode = ft.getAttribute('data-fit'); refs.layFit.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === ft); }); applyFit(); return; }
    });
    enableDragScroll(refs.layStrip); enableDragScroll(refs.panels.layout.querySelector('.itlay2__types'));
    refs.layGap.addEventListener('input', function () { S.collageGap = +refs.layGap.value; renderCollage(); });
    refs.layAdd.addEventListener('change', function () { var fl = refs.layAdd.files && refs.layAdd.files[0]; if (fl) addPhotoFromFile(fl); refs.layAdd.value = ''; });
    if (refs.layBgImg) refs.layBgImg.addEventListener('change', function () { var fl = refs.layBgImg.files && refs.layBgImg.files[0]; if (fl) addBgImageFromFile(fl); refs.layBgImg.value = ''; });
    // [셀 크롭] 콜라주 칸 드래그/핀치 재구도(레이아웃 도구에서만 포인터 활성)
    refs.collage.addEventListener('pointerdown', onCellDown);
    document.addEventListener('pointermove', onCellMove);
    document.addEventListener('pointerup', onCellUp);
    // 보정 — 사진 선택 + 슬라이더(선택 사진만) + 초기화
    refs.panels.adjust.addEventListener('click', function (e) { var t = e.target.closest('[data-adjthumb]'); if (t) onAdjThumb(+t.getAttribute('data-adjthumb')); });
    refs.panels.adjust.addEventListener('input', function (e) {
      var s = e.target.closest('[data-adj]'); if (!s) return; var k = s.getAttribute('data-adj'); adjOf(S.adjSel)[k] = +s.value;
      var c0 = ADJ_CTRLS.filter(function (x) { return x.k === k; })[0]; var out = root.querySelector('[data-adjout="' + k + '"]'); if (out) out.textContent = adjReadout(c0, +s.value);
      applyAdjThrottled(); var th = refs.adjStrip && refs.adjStrip.querySelector('[data-adjthumb="' + S.adjSel + '"]'); if (th) th.style.filter = filterStr(adjOf(S.adjSel));
    });
    // [#3] 수평 슬라이더 — 가이드 그리드 표시 + 사진 회전
    if (refs.adjRot) refs.adjRot.addEventListener('input', function () {
      var rv = +refs.adjRot.value; if (Math.abs(rv) < 1.5) { rv = 0; refs.adjRot.value = 0; }   // [#2] 0° 근처면 수평으로 잠금
      adjOf(S.adjSel).rot = rv; if (refs.adjRotOut) refs.adjRotOut.textContent = rv.toFixed(1).replace(/\.0$/, '') + '°';
      root.classList.add('is-leveling'); clearTimeout(S._lvlT); S._lvlT = setTimeout(function () { root.classList.remove('is-leveling'); }, 900);
      applyStraighten();
    });
    refs.adjReset.addEventListener('click', function () { S.adj[S.adjSel] = defAdj(); syncAdjSliders(); applyAdjToDisplay(); applyStraighten(); renderAdjust(); });
    if (refs.adjCut) refs.adjCut.addEventListener('click', function () { doCutout(); });
    if (refs.adjUncut) refs.adjUncut.addEventListener('click', undoCutout);
    enableDragScroll(refs.adjStrip);
    // 그리기
    root.querySelector('[data-panel="draw"] .itdraw__top').addEventListener('click', function (e) { var b = e.target.closest('[data-brush]'); if (!b) return; S.brush = b.getAttribute('data-brush'); root.querySelectorAll('[data-brush]').forEach(function (x) { x.classList.toggle('on', x === b); }); });
    refs.brushSize.addEventListener('input', function () { S.brushSize = +refs.brushSize.value; });
    root.querySelector('[data-panel="draw"] .itdraw__colors').addEventListener('click', function (e) { var b = e.target.closest('[data-dcolor]'); if (!b) return; S.drawColor = b.getAttribute('data-dcolor'); root.querySelectorAll('[data-dcolor]').forEach(function (x) { x.classList.toggle('on', x === b); }); });
    refs.draw.addEventListener('pointerdown', drawDown);
    refs.draw.addEventListener('pointermove', drawMove);
    refs.draw.addEventListener('pointerup', drawUp);
    // 사진 핀치 확대/이동
    refs.stage.addEventListener('pointerdown', stageDown);
    refs.stage.addEventListener('pointermove', stageMove);
    refs.stage.addEventListener('pointerup', stageUp);
    refs.stage.addEventListener('pointercancel', stageUp);
    // 닫기/완료
    refs.cancel.addEventListener('click', function () { close(); if (S && S.onCancel) S.onCancel(); });
    refs.done.addEventListener('click', function () {
      var cb = S.onDone; refs.done.textContent = '저장 중…'; refs.done.disabled = true;
      exportComposite(function (url) {
        var meta = { layers: metaLayers() };   // [학습] close() 전에 좌표 계산(닫으면 stage rect=0 → NaN)
        close(); refs.done.textContent = '완료'; refs.done.disabled = false;
        if (cb) cb(url, meta);   // StoryEditor 계약 호환(meta.layers)
      });
    });
  }
  // 저장 시 레이어를 ShopStyle 학습 계약으로 — role·정규화 중심좌표(x/y)·폭·폰트·색·크기·외곽선/그림자.
  function metaLayers() {
    var R = refs.stage.getBoundingClientRect();
    return S.layers.map(function (L) {
      // 도형·장식용 이미지 스티커는 '우리샵 스타일' 학습 대상 아님(결과 이미지엔 이미 합성됨).
      if (L.type === 'shape') return null;
      if (L.type === 'image' && L.role === 'sticker') return null;
      var b = L.el.getBoundingClientRect();
      var cx = (b.left - R.left + b.width / 2) / R.width;
      var cy = (b.top - R.top + b.height / 2) / R.height;
      var w = b.width / R.width;
      if (L.type === 'image') return { type: 'image', role: L.role || 'logo', src: L.src, x: cx, y: cy, w: w };
      if (L.type === 'sticker') return { type: 'emoji', emoji: L.emoji, x: cx, y: cy };
      var fs = (L.fontSize || 30) * (L.scale || 1);
      return { type: 'text', role: L.role || '', text: L.text, x: cx, y: cy, w: w,
        font: L.font && L.font.key, color: L.color, align: L.align,
        size: fs / R.height, weight: L.font && L.font.weight,
        stroke: !!L.stroke, shadow: !!L.shadow };
    }).filter(Boolean);
  }

  function open(opts) {
    opts = opts || {};
    if (!root) build();
    var photo = opts.photo || opts.photoUrl || '';   // StoryEditor 계약(photoUrl) 호환
    var photos = (opts.photos && opts.photos.length) ? opts.photos.slice() : [photo];
    S = { layers: [], active: null, tool: 'text', layout: LAYOUTS[0], layoutOrder: [],
      brush: 'pen', brushSize: 10, drawColor: COLORS[2],
      shapeColor: COLORS[2], shapeFill: false, shapeThick: 6,
      adj: photos.map(function () { return defAdj(); }), adjSel: 0, collageGap: 3,
      collageBg: (loadBgPref().color || '#FFFFFF'), collageBgImg: (loadBgPref().img || null), cellCrop: [], cellSel: -1, fitMode: 'cover',
      photoUrl: photo, photoCss: 'url("' + photo + '")', photos: photos,
      shopName: (opts.shopName || '').trim(),
      pz: { scale: 1, tx: 0, ty: 0 }, incoming: (opts.layers || []),
      onDone: opts.onDone, onCancel: opts.onCancel };
    if (refs.featLocTx) refs.featLocTx.textContent = S.shopName || '우리샵';   // [③] 위치 칩에 실제 샵 이름
    refs.layers.innerHTML = ''; refs.frame.className = 'itded__frame';
    refs.photo.style.backgroundImage = S.photoCss; refs.photo.style.filter = ''; refs.photo.style.backgroundSize = 'cover'; refs.photo.style.backgroundColor = 'transparent';
    refs.collage.hidden = true; refs.collage.innerHTML = '';
    refs.photowrap.style.transform = '';
    root.classList.add('is-open');
    // [#9] 시스템 back 으로 편집기가 '먼저' 닫히게 — history 엔트리 1개 push + flow 가 단계 pop 안 하도록 __seOpen 플래그.
    try {
      window.__seOpen = true;
      S._popHandler = function () {
        if (!root || !root.classList.contains('is-open')) return;
        S._histPushed = false;
        window.__seSwallowPop = true; setTimeout(function () { window.__seSwallowPop = false; }, 0);
        _teardownBack(true); root.classList.remove('is-open');
        if (S && S.onCancel) S.onCancel();   // 시스템 back = 취소로 닫기
      };
      window.addEventListener('popstate', S._popHandler);
      history.pushState({ itded: 1 }, ''); S._histPushed = true;
    } catch (_e) { void _e; }
    // 우리샵 자동배치 텍스트/로고/워터마크를 먼저 올린 뒤 도구 표시(기본 빈 텍스트 자동생성 방지).
    requestAnimationFrame(function () { initCanvas(); renderIncoming(S.incoming); setTool('text'); });
  }
  function _teardownBack(fromPop) {
    window.__seOpen = false;
    if (S && S._popHandler) { try { window.removeEventListener('popstate', S._popHandler); } catch (_e) { void _e; } S._popHandler = null; }
    if (!fromPop && S && S._histPushed) { S._histPushed = false; window.__seSwallowPop = true; setTimeout(function () { window.__seSwallowPop = false; }, 0); try { history.back(); } catch (_e2) { void _e2; } }
  }
  function close() { if (!root || !root.classList.contains('is-open')) return; _teardownBack(false); root.classList.remove('is-open'); }

  // [#2 단일화] 헤드리스 합성 — 캡션 미리보기를 '편집기와 동일한 렌더러'로 그린다(미리보기=편집기).
  //   화면 밖 고정크기로 렌더 → 폰트/줄바꿈/겹침방지까지 편집기와 100% 동일. 편집 중이면 스킵(상태 충돌 방지).
  // 공유 root/S 를 쓰므로 동시 호출(멀티포토)을 직렬화한다.
  var _composeQ = Promise.resolve();
  function compose(opts) { var run = function () { return _composeOne(opts); }; _composeQ = _composeQ.then(run, run); return _composeQ; }
  function _composeOne(opts) {
    opts = opts || {};
    if (!root) build();
    if (root.classList.contains('is-open')) return Promise.resolve(null);
    var photo = opts.photoUrl || opts.photo || '';
    var photos = (opts.photos && opts.photos.length) ? opts.photos.slice() : [photo];
    var rp = String(opts.ratio || '4:5').split(':'); var rw = +rp[0] || 4, rh = +rp[1] || 5;
    var Wpx = 432, Hpx = Math.round(Wpx * rh / rw);
    S = { layers: [], active: null, tool: null, layout: LAYOUTS[0], layoutOrder: [],
      brush: 'pen', brushSize: 10, drawColor: COLORS[2], shapeColor: COLORS[2], shapeFill: false, shapeThick: 6,
      adj: photos.map(function () { return defAdj(); }), adjSel: 0, collageGap: 3, collageBg: '#FFFFFF', collageBgImg: null, cellCrop: [], cellSel: -1, fitMode: 'cover',
      photoUrl: photo, photoCss: 'url("' + photo + '")', photos: photos, shopName: '', pz: { scale: 1, tx: 0, ty: 0 }, incoming: (opts.layers || []) };
    refs.layers.innerHTML = ''; refs.frame.className = 'itded__frame';
    refs.photo.style.backgroundImage = S.photoCss; refs.photo.style.filter = ''; refs.photo.style.backgroundSize = 'cover'; refs.photo.style.backgroundColor = 'transparent';
    refs.collage.hidden = true; refs.collage.innerHTML = ''; refs.photowrap.style.transform = '';
    // display:flex !important + right/bottom:auto — 베이스 .itded{display:none}·inset:0 와의 충돌 방지(off-screen 0크기 방지).
    root.style.cssText = 'display:flex !important;position:fixed;left:-99999px;top:0;right:auto;bottom:auto;width:' + Wpx + 'px;height:' + Hpx + 'px;opacity:0;pointer-events:none;z-index:-1';
    return new Promise(function (res) {
      var done = false;
      var fin = function (url) { if (done) return; done = true; root.style.cssText = ''; res(url); };
      // 폰트 로드를 기다리되 무한대기 방지(최대 500ms). off-screen rAF throttle 회피로 setTimeout 사용.
      var fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
      Promise.race([fontsReady, new Promise(function (r) { setTimeout(r, 500); })]).then(function () {
        setTimeout(function () {
          try { initCanvas(); renderIncoming(S.incoming); } catch (_e) { void _e; }
          setTimeout(function () { try { exportComposite(fin); } catch (_e2) { fin(null); } }, 40);
        }, 0);
      });
      setTimeout(function () { fin(null); }, 6000);   // 안전망 — 어떤 경우에도 행 방지
    });
  }

  window.ItdEditor = { open: open, close: close, compose: compose, isOpen: function () { return !!(root && root.classList.contains('is-open')); } };
})();
