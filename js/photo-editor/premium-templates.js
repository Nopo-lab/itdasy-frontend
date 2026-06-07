/* 사진 편집기 — 30종 템플릿 프리미엄 렌더러 (v234)
   기존 템플릿 목록은 유지하고, 결과 캔버스 합성만 살롱 홍보용 디자인으로 교체한다. */
(function () {
  'use strict';
  if (window.PhotoEditorPremiumTemplates) return;

  const META = {
    'feed-showcase':  ['feedHero', 'PORTFOLIO', '오늘의 시술', '예약 문의는 프로필 링크'],
    'feed-new-menu':  ['feedCard', 'NEW SERVICE', '신메뉴 출시', '첫 주 한정 혜택'],
    'feed-review':    ['feedReview', 'REAL REVIEW', '고객 후기', '사진으로 증명하는 결과'],
    'feed-price':     ['feedPrice', 'LIMITED OFFER', '특가 진행 중', '이번 주 예약 가능'],
    'feed-notice':    ['feedNotice', 'NOTICE', '안내 드립니다', '방문 전 꼭 확인해주세요'],
    'story-count':    ['storyCount', 'COUNTDOWN', 'D-3', '오픈 혜택 곧 마감'],
    'story-open':     ['storyOpen', 'OPEN NOW', 'OPEN', '오늘 예약 열렸어요'],
    'story-attend':   ['storyCheck', 'CHECK-IN', 'CHECK-IN', '방문할수록 혜택이 쌓여요'],
    'story-qa':       ['storyQA', 'ASK ME', 'Q&A 받습니다', '궁금한 점을 남겨주세요'],
    'story-poll':     ['storyPoll', 'PICK YOUR STYLE', '어떤 게 좋아요?', '고객 취향 투표'],
    'reels-ba':       ['verticalSplit', 'BEFORE / AFTER', 'BEFORE → AFTER', '결과 비교 컷'],
    'reels-price':    ['verticalPrice', 'PRICE OPEN', '가격 공개', '시술별 안내'],
    'reels-newmenu':  ['verticalNew', 'NEW DROP', 'NEW', '이번 시즌 추천'],
    'reels-review':   ['verticalReview', 'CLIENT NOTE', 'REAL REVIEW', '재방문 후기'],
    'reels-process':  ['verticalSteps', 'PROCESS', 'PROCESS', '상담부터 마무리까지'],
    'event-discount': ['eventSale', 'SALON BENEFIT', '50% OFF', '선착순 한정'],
    'event-member':   ['eventMember', 'MEMBER ONLY', 'MEMBER ONLY', '멤버 전용 혜택'],
    'event-newcomer': ['eventNew', 'FIRST VISIT', '신규 -30%', '첫 방문 고객 혜택'],
    'event-deadline': ['eventDeadline', 'LAST CALL', '오늘까지', '예약 마감 임박'],
    'event-gift':     ['eventGift', 'GIFT SERVICE', '+ FREE GIFT', '방문 고객 증정'],
    'price-hair':     ['priceTable', 'HAIR MENU', '헤어 메뉴', '컷 / 펌 / 컬러 / 케어'],
    'price-nail':     ['priceTable', 'NAIL MENU', '네일 메뉴', '젤 / 아트 / 케어 / 연장'],
    'price-lash':     ['priceTable', 'LASH MENU', '속눈썹 메뉴', '펌 / 연장 / 리터치'],
    'price-makeup':   ['priceTable', 'MAKEUP MENU', '메이크업 메뉴', '데일리 / 촬영 / 웨딩'],
    'price-wax':      ['priceTable', 'WAX MENU', '왁싱 메뉴', '페이스 / 바디 / 케어'],
    'card-minimal':   ['cardMinimal', 'APPOINTMENT', '샵 안내', '예약 / 위치 / 운영시간'],
    'card-gold':      ['cardGold', 'PRIVATE STUDIO', 'OUR SHOP', '프리미엄 살롱'],
    'card-pink':      ['cardSoft', 'WELCOME', 'WELCOME', '처음 오시는 고객님께'],
    'card-dark':      ['cardDark', 'STUDIO', 'STUDIO', '시술 상담 가능'],
    'card-nature':    ['cardNature', 'CALM BEAUTY', 'STUDIO', '편안한 관리 공간'],
    'ba-cream':        ['baCompose', 'BEFORE / AFTER', 'Before & After', '결과 비교 컷'],
    'ba-flower-shadow':['baCompose', 'BEFORE / AFTER', 'Before & After', '시술 전후 모습을 확인해 보세요!'],
    'ba-polaroid':     ['baCompose', 'BEFORE / AFTER', 'Before & After', '인스타 피드용 전후사진'],
    'ba-editorial':    ['baCompose', 'BEFORE / AFTER', 'Before & After', '프리미엄 결과 컷'],
    'ba-sage':         ['baCompose', 'BEFORE / AFTER', 'Before & After', '자연스러운 변화'],
    'ba-dark':         ['baCompose', 'BEFORE / AFTER', 'Before & After', '프리미엄 결과'],
    'ba-2split-h':     ['baCompose', 'BEFORE / AFTER', 'Before & After', '피드용 전후사진'],
    'ba-2split-v':     ['baCompose', 'STORY BEFORE / AFTER', 'Before & After', '스토리용 전후사진'],
    'ba-3process':     ['baCompose', 'PROCESS', 'Before → After', '과정까지 보여주는 전후사진'],
    'ba-4grid':        ['baCompose', 'PORTFOLIO', 'Portfolio', '대표 결과 모음'],
    'ba-price':        ['baCompose', 'PRICE', 'Before & After', '가격 안내'],
    'ba-event':        ['baCompose', 'EVENT', 'Before & After', '이번 주 예약 가능'],
    'ba-review':       ['baCompose', 'REAL REVIEW', 'Real Review', '고객 후기'],
    // v326 — BA 12종 시리즈 (부위 × 스타일). baCompose 로 위임, 라우팅은 ba-compose.js
    'ba-hair-cream':    ['baCompose', 'HAIR BEFORE / AFTER', 'Hair Transformation', '시술 전후 모습'],
    'ba-hair-polaroid': ['baCompose', 'HAIR BEFORE / AFTER', 'Hair Before & After', '인스타 피드용'],
    'ba-hair-dark':     ['baCompose', 'HAIR DETAIL',         'Hair Style Change', '프리미엄 결과'],
    'ba-nail-cream':    ['baCompose', 'NAIL BEFORE / AFTER', 'Nail Before & After', '깨끗하게 정돈된 네일'],
    'ba-nail-polaroid': ['baCompose', 'NAIL BEFORE / AFTER', 'Fresh Nail Look', '손끝 변화 컷'],
    'ba-nail-dark':     ['baCompose', 'NAIL DETAIL',         'Nail Art Detail', '디테일 강조'],
    'ba-lash-cream':    ['baCompose', 'LASH BEFORE / AFTER', 'Lash Before & After', '풍성한 속눈썹 컷'],
    'ba-lash-polaroid': ['baCompose', 'LASH BEFORE / AFTER', 'New Lash Look', '눈매가 또렷해진 결과'],
    'ba-lash-dark':     ['baCompose', 'LASH DETAIL',         'Lash Volume Detail', '디테일 강조'],
    'ba-skin-cream':    ['baCompose', 'SKIN BEFORE / AFTER', 'Skin Care Result', '결이 매끈한 결과'],
    'ba-skin-polaroid': ['baCompose', 'SKIN BEFORE / AFTER', 'Clear Skin Glow', '맑아진 피부 컷'],
    'ba-skin-dark':     ['baCompose', 'SKIN DETAIL',         'Skin Texture Detail', '디테일 강조'],
    // [V3-1] 템플릿 팩 v3 TOP 5 — 렌더 경로 매핑(갤러리 미노출, 적용 시에만 동작). palette 는 found 에서 주입.
    'v3-price-clean-rose': ['priceTable', 'PRICE LIST',  '시술 가격표',       '프리미엄 시술로 더 아름다운 변화를 경험하세요.'],
    'v3-review-card':      ['feedReview', 'REAL REVIEW',  '고객님의 진심 후기', '시술 후 달라진 변화를 직접 확인해보세요.'],
    'v3-ba-clean-rose':   ['baCompose',  'BEFORE / AFTER', '시술 전후',        '한 눈에 비교해보세요. 달라진 아름다움의 차이'],
    'v3-ba-clean-blue':   ['baCompose',  'BEFORE / AFTER', '시술 전후',        '맑고 환한 피부 변화를 경험해보세요.'],
    'v3-ba-sns-pink':     ['baCompose',  'BEFORE / AFTER', '시술 전후',        '달라진 모습을 눈으로 확인해보세요!'],
  };

  const PAL = {
    ink: '#111217', paper: '#f8f3eb', cream: '#fffaf2', sage: '#7f9279',
    rose: '#d28b8f', clay: '#b98265', copper: '#c69b63', charcoal: '#24252b',
    line: 'rgba(255,255,255,0.32)', smoke: 'rgba(10,11,15,0.58)',
  };

  function _getTemplates() {
    const base = window.PhotoEditorTemplatesV2;
    return base && Array.isArray(base.TEMPLATES) ? base.TEMPLATES : [];
  }

  function _brandData(tpl) {
    const shop = window.PhotoEditorShopData?.get?.() || {};
    return {
      shop: tpl.shopName || shop.shopName || '잇데이 스튜디오',
      accent: _safeColor(tpl.bg || shop.primaryColor, PAL.copper),
      bg: _safeColor(tpl.bg, PAL.copper),
      price: tpl.price || '',
      review: tpl.review || '',
    };
  }

  function _safeColor(color, fallback) {
    return /^#[0-9a-f]{3,8}$/i.test(color || '') ? color : fallback;
  }

  // [V3-1] palette 헬퍼 — d.palette[key] 있으면 그 색, 없으면 fallback(기존 PAL/하드코딩) → 무회귀.
  //   v3 템플릿만 d.palette 가 채워지고, 기존 템플릿은 null 이라 항상 fallback(기존 동작 동일).
  function _pal(d, key, fallback) {
    const p = d && d.palette;
    return (p && typeof p[key] === 'string' && p[key]) ? p[key] : fallback;
  }

  const SLOT_IMAGE_CACHE = {};

  function _primeImage(src, img) {
    if (src && img) SLOT_IMAGE_CACHE[src] = img;
  }

  function _slotImage(src) {
    if (!src) return null;
    const cached = SLOT_IMAGE_CACHE[src];
    if (cached && (cached.complete || cached.naturalWidth || cached.width)) return cached;
    const img = cached || new Image();
    SLOT_IMAGE_CACHE[src] = img;
    img.onload = () => {
      try { window.PhotoEditor?._internal?.helpers?.scheduleRedraw?.(); } catch (_e) { /* ignore */ }
    };
    img.onerror = () => { delete SLOT_IMAGE_CACHE[src]; };
    if (!cached) img.src = src;
    return (img.complete || img.naturalWidth || img.width) ? img : null;
  }

  function _drawCover(ctx, img, x, y, w, h) {
    const iw = img && (img.naturalWidth || img.width), ih = img && (img.naturalHeight || img.height);
    if (!iw || !ih) return;
    const sAR = iw / ih, dAR = w / h;
    let sx, sy, sw, sh;
    if (sAR > dAR) { sh = ih; sw = sh * dAR; sx = (iw - sw) / 2; sy = 0; }
    else { sw = iw; sh = sw / dAR; sx = 0; sy = (ih - sh) / 2; }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }

  // [S2.1] 반환값 = 실제로 그렸는지(true/false). v2 hook 이 위임 후 fallback 판단에 사용.
  function _premiumHook(ctx, dw, dh, state) {
    const tpl = state && state.tplV2;
    if (!tpl) return false;
    // [V3-1] found 조회에 v3 TOP5 포함(market-data.V3_TOP5). 기존 경로 우선, 없으면 v3.
    const MD = window.PhotoEditorTemplateMarketData;
    const found = _getTemplates().find(t => t.id === tpl.id) || (MD && MD.v3ById && MD.v3ById(tpl.id)) || null;
    const meta = META[tpl.id];
    if (!found || !meta) return false;
    const b = _brandData(tpl);
    // [V3-1] palette — v3 템플릿이면 found.palette, 기존은 null(→ _pal 가 기존색 반환, 무회귀).
    const palette = (found && found.palette) || null;
    // [S1] editable slot 얕은 연결 — slotValues 있으면 우선, 없으면 기존과 동일(무회귀).
    const sv = (tpl && tpl.slotValues) || {};
    const mainPhotoSrc = tpl && tpl.imageSlots && tpl.imageSlots.main_photo && tpl.imageSlots.main_photo.src;
    const mainPhoto = _slotImage(mainPhotoSrc);
    const data = { type: meta[0], kicker: meta[1], palette: palette,
      head: sv.headline || found.prefillText || meta[2],
      sub: sv.subtitle || meta[3],
      shop: sv.shop_name || b.shop,
      accent: (palette && palette.accent) || b.accent, price: b.price, review: sv.review_text || b.review,
      // [S2] 편집 가능 슬롯 추가 연결(없으면 undefined → 렌더러가 기존 동작 유지)
      services: sv.services, cta: sv.cta, phone: sv.phone, customer: sv.customer_label,
      beforeLabel: sv.before_label, afterLabel: sv.after_label,
      beforeCap: sv.before_caption, afterCap: sv.after_caption, mainPhoto: mainPhoto };
    if (meta[0] === 'baCompose' && window.PhotoEditorBACompose) {
      window.PhotoEditorBACompose.draw(ctx, dw, dh, state, tpl, data);
      return true;
    }
    _draw(ctx, dw, dh, data);
    return true;
  }

  function _draw(ctx, w, h, d) {
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (d.mainPhoto) _drawCover(ctx, d.mainPhoto, 0, 0, w, h);
    if (d.type.startsWith('feed')) _drawFeed(ctx, w, h, d);
    else if (d.type.startsWith('story')) _drawStory(ctx, w, h, d);
    else if (d.type.startsWith('vertical')) _drawVertical(ctx, w, h, d);
    else if (d.type.startsWith('event')) _drawEvent(ctx, w, h, d);
    else if (d.type === 'priceTable') _drawPrice(ctx, w, h, d);
    else _drawCard(ctx, w, h, d);
    ctx.restore();
  }

  function _drawFeed(ctx, w, h, d) {
    _scrim(ctx, w, h, d.type === 'feedNotice' ? 0.44 : 0.34);
    if (d.type === 'feedHero') return _bottomEditorial(ctx, w, h, d);
    if (d.type === 'feedReview') return _quoteCard(ctx, w, h, d);
    if (d.type === 'feedPrice') return _offerBand(ctx, w, h, d);
    if (d.type === 'feedNotice') return _noticeCard(ctx, w, h, d);
    _panel(ctx, w * 0.07, h * 0.62, w * 0.86, h * 0.25, PAL.paper, 22);
    _label(ctx, d.kicker, w * 0.11, h * 0.69, d.accent);
    _headline(ctx, d.head, w * 0.11, h * 0.77, w * 0.78, '#17181d', 0.055);
    _small(ctx, d.sub, w * 0.11, h * 0.84, '#555');
    _brand(ctx, w, h, d);
  }

  function _drawStory(ctx, w, h, d) {
    _scrim(ctx, w, h, 0.42);
    if (d.type === 'storyCount') {
      _label(ctx, d.kicker, w * 0.1, h * 0.22, d.accent);
      _big(ctx, d.head, w * 0.1, h * 0.52, w * 0.8, '#fff', 0.17);
      _rule(ctx, w * 0.1, h * 0.58, w * 0.36, d.accent);
      _small(ctx, d.sub, w * 0.1, h * 0.64, 'rgba(255,255,255,0.88)');
    } else if (d.type === 'storyOpen') {
      _panel(ctx, w * 0.12, h * 0.34, w * 0.76, h * 0.22, PAL.cream, 28);
      _center(ctx, d.kicker, w / 2, h * 0.41, d.accent, 0.02, 700);
      _center(ctx, d.head, w / 2, h * 0.5, PAL.ink, 0.072, 900);
      _pill(ctx, w * 0.3, h * 0.61, w * 0.4, h * 0.055, d.sub, d.accent, '#fff');
    } else {
      _storyInteractive(ctx, w, h, d);
    }
    _brand(ctx, w, h, d);
  }

  function _drawVertical(ctx, w, h, d) {
    _scrim(ctx, w, h, 0.36);
    if (d.type === 'verticalSplit') {
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = Math.max(2, w * 0.006);
      ctx.beginPath(); ctx.moveTo(w * 0.12, h * 0.5); ctx.lineTo(w * 0.88, h * 0.5); ctx.stroke();
      _pill(ctx, w * 0.09, h * 0.13, w * 0.32, h * 0.052, 'BEFORE', PAL.ink, '#fff');
      _pill(ctx, w * 0.59, h * 0.82, w * 0.32, h * 0.052, 'AFTER', d.accent, '#fff');
    } else if (d.type === 'verticalSteps') {
      _steps(ctx, w, h, d.accent);
    } else {
      _panel(ctx, w * 0.08, h * 0.37, w * 0.84, h * 0.22, 'rgba(255,250,242,0.94)', 24);
    }
    _label(ctx, d.kicker, w * 0.1, h * 0.43, d.accent);
    _headline(ctx, d.head, w * 0.1, h * 0.52, w * 0.8, d.type === 'verticalSplit' ? '#fff' : PAL.ink, 0.058);
    _small(ctx, d.sub, w * 0.1, h * 0.6, d.type === 'verticalSplit' ? '#fff' : '#555');
    _brand(ctx, w, h, d);
  }

  function _drawEvent(ctx, w, h, d) {
    ctx.fillStyle = d.type === 'eventMember' || d.type === 'eventDeadline' ? 'rgba(12,13,18,0.68)' : 'rgba(248,243,235,0.78)';
    ctx.fillRect(0, 0, w, h);
    if (d.type === 'eventNew') ctx.fillStyle = _grad(ctx, 0, 0, w, 0, d.accent, PAL.sage), ctx.fillRect(0, 0, w * 0.42, h);
    _panel(ctx, w * 0.11, h * 0.23, w * 0.78, h * 0.48, d.type === 'eventMember' || d.type === 'eventDeadline' ? 'rgba(17,18,23,0.82)' : PAL.cream, 26);
    _center(ctx, d.kicker, w / 2, h * 0.36, d.accent, 0.022, 800);
    _center(ctx, d.head, w / 2, h * 0.5, d.type === 'eventMember' || d.type === 'eventDeadline' ? '#fff' : PAL.ink, 0.075, 900);
    _center(ctx, d.sub, w / 2, h * 0.61, d.type === 'eventMember' || d.type === 'eventDeadline' ? 'rgba(255,255,255,0.78)' : '#555', 0.024, 600);
    _brand(ctx, w, h, d);
  }

  function _drawPrice(ctx, w, h, d) {
    _scrim(ctx, w, h, 0.26);
    _panel(ctx, w * 0.07, h * 0.1, w * 0.86, h * 0.8, 'rgba(255,250,242,0.94)', 24);
    _label(ctx, d.kicker, w * 0.13, h * 0.2, d.accent);
    _headline(ctx, d.head, w * 0.13, h * 0.28, w * 0.72, PAL.ink, 0.044);
    // [S2] slotValues.services 우선(빈 행 제외, 최대 5행 표시), 없으면 kicker 프리셋.
    const rows = _svcRows(d);
    const n = Math.max(rows.length, 1);
    const step = Math.min(0.09, 0.4 / n);
    rows.forEach((row, i) => {
      const y = h * (0.42 + step * i);
      _small(ctx, row[0], w * 0.14, y, PAL.ink);
      _small(ctx, row[1], w * 0.72, y, d.accent);
      _rule(ctx, w * 0.14, y + step * h * 0.28, w * 0.72, 'rgba(17,18,23,0.12)');
    });
    // [S2] cta/phone 있으면 하단 중앙에, 없으면 기존 shop.
    if (d.cta || d.phone) {
      _center(ctx, d.cta || '예약 문의', w / 2, h * 0.845, d.accent, 0.022, 800);
      if (d.phone) _center(ctx, d.phone, w / 2, h * 0.875, PAL.ink, 0.024, 700);
    } else {
      _small(ctx, d.shop, w * 0.14, h * 0.84, '#777');
    }
  }

  // [S2] 가격 행 — services(편집값) 우선, 없으면 kicker 프리셋. [name, price] 형태.
  function _svcRows(d) {
    const FT = window.PhotoEditorTemplateFitText;
    if (Array.isArray(d.services) && d.services.length) {
      return d.services
        .filter(s => s && (s.name || s.price))
        .slice(0, 5)
        .map(s => [s.name || '', s.price ? (FT ? FT.formatPrice(s.price) : s.price) : '']);
    }
    return _priceRows(d.kicker);
  }

  function _drawCard(ctx, w, h, d) {
    const dark = d.type === 'cardGold' || d.type === 'cardDark';
    const softBg = d.type === 'cardSoft' ? '#f1d8dd' : d.type === 'cardNature' ? '#e5eadf' : '#efe6d9';
    ctx.fillStyle = dark ? PAL.ink : softBg;
    ctx.fillRect(0, 0, w, h);
    if (!dark) {
      ctx.fillStyle = 'rgba(17,18,23,0.055)';
      ctx.fillRect(0, h * 0.78, w, h * 0.22);
      _frame(ctx, w, h, 'rgba(17,18,23,0.16)');
    }
    if (d.type === 'cardNature') _natureLine(ctx, w, h);
    if (d.type === 'cardGold') _frame(ctx, w, h, PAL.copper);
    if (d.type === 'cardSoft') _panel(ctx, w * 0.16, h * 0.34, w * 0.68, h * 0.28, PAL.cream, 24);
    const main = dark ? '#fff' : PAL.ink;
    _center(ctx, d.shop, w / 2, h * 0.46, main, 0.045, d.type === 'cardMinimal' ? 300 : 800);
    _center(ctx, d.head, w / 2, h * 0.57, d.accent, 0.024, 700);
    _center(ctx, d.sub, w / 2, h * 0.69, dark ? 'rgba(255,255,255,0.66)' : '#666', 0.02, 500);
  }

  function _bottomEditorial(ctx, w, h, d) {
    _label(ctx, d.kicker, w * 0.08, h * 0.71, d.accent);
    _headline(ctx, d.head, w * 0.08, h * 0.81, w * 0.84, '#fff', 0.065);
    _rule(ctx, w * 0.08, h * 0.86, w * 0.22, d.accent);
    _small(ctx, d.shop, w * 0.08, h * 0.92, 'rgba(255,255,255,0.82)');
  }

  function _quoteCard(ctx, w, h, d) {
    const FT = window.PhotoEditorTemplateFitText;
    // [S2] 후기 본문(review)이 있으면 후기 카드 레이아웃, 없으면 기존(헤드+부제+샵).
    if (d.review && FT) {
      _panel(ctx, w * 0.08, h * 0.55, w * 0.84, h * 0.37, 'rgba(255,250,242,0.96)', 24);
      _label(ctx, d.kicker, w * 0.13, h * 0.62, d.accent);
      _headline(ctx, d.head, w * 0.13, h * 0.69, w * 0.74, PAL.ink, 0.036);
      FT.drawFitText(ctx, '“' + d.review + '”', { x: w * 0.13, y: h * 0.73, w: w * 0.74, h: h * 0.11 },
        { maxFontSize: Math.round(h * 0.026), minFontSize: Math.round(h * 0.017), maxLines: 3, lineHeight: 1.34, color: '#444', weight: 500, valign: 'top' });
      const foot = [d.customer || '', d.cta || ''].filter(Boolean).join('  ·  ') || (d.sub + ' · ' + d.shop);
      _small(ctx, foot, w * 0.13, h * 0.88, '#666');
      return;
    }
    _panel(ctx, w * 0.08, h * 0.6, w * 0.84, h * 0.28, 'rgba(255,250,242,0.96)', 24);
    _label(ctx, d.kicker, w * 0.13, h * 0.68, d.accent);
    _headline(ctx, d.head, w * 0.13, h * 0.76, w * 0.74, PAL.ink, 0.038);
    _small(ctx, d.sub + ' · ' + d.shop, w * 0.13, h * 0.83, '#666');
  }

  function _offerBand(ctx, w, h, d) {
    _panel(ctx, w * 0.07, h * 0.39, w * 0.86, h * 0.2, d.accent, 18);
    _center(ctx, d.kicker, w / 2, h * 0.46, 'rgba(255,255,255,0.78)', 0.018, 800);
    _center(ctx, d.head, w / 2, h * 0.54, '#fff', 0.065, 900);
    _brand(ctx, w, h, d);
  }

  function _noticeCard(ctx, w, h, d) {
    _panel(ctx, w * 0.1, h * 0.55, w * 0.8, h * 0.32, PAL.cream, 24);
    _label(ctx, d.kicker, w * 0.15, h * 0.64, d.accent);
    _headline(ctx, d.head, w * 0.15, h * 0.74, w * 0.7, PAL.ink, 0.038);
    _small(ctx, d.sub, w * 0.15, h * 0.81, '#666');
  }

  function _storyInteractive(ctx, w, h, d) {
    _label(ctx, d.kicker, w * 0.11, h * 0.29, d.accent);
    _headline(ctx, d.head, w * 0.11, h * 0.38, w * 0.78, '#fff', 0.042);
    if (d.type === 'storyCheck') for (let i = 0; i < 5; i++) _dot(ctx, w * (0.18 + i * 0.16), h * 0.53, w * 0.038, i < 3 ? d.accent : 'rgba(255,255,255,0.32)');
    else if (d.type === 'storyPoll') ['A STYLE', 'B STYLE'].forEach((x, i) => _pill(ctx, w * 0.15, h * (0.48 + i * 0.08), w * 0.7, h * 0.055, x, i ? PAL.cream : d.accent, i ? PAL.ink : '#fff'));
    else _panel(ctx, w * 0.13, h * 0.48, w * 0.74, h * 0.12, 'rgba(255,255,255,0.92)', 18), _center(ctx, '답변을 남겨주세요', w / 2, h * 0.55, '#777', 0.022, 600);
    _small(ctx, d.sub, w * 0.11, h * 0.68, 'rgba(255,255,255,0.82)');
  }

  function _steps(ctx, w, h, accent) {
    for (let i = 0; i < 4; i++) {
      const x = w * (0.18 + i * 0.21), y = h * 0.72;
      _dot(ctx, x, y, w * 0.04, accent);
      _center(ctx, String(i + 1), x, y + h * 0.01, '#fff', 0.024, 900);
      if (i < 3) _rule(ctx, x + w * 0.055, y, w * 0.11, 'rgba(255,255,255,0.6)');
    }
  }

  function _priceRows(k) {
    if (k.includes('NAIL')) return [['젤 원컬러', '50,000'], ['아트 추가', '10,000~'], ['케어', '25,000'], ['연장', '70,000~']];
    if (k.includes('LASH')) return [['펌', '55,000'], ['연장', '80,000'], ['리터치', '45,000'], ['제거', '10,000']];
    if (k.includes('MAKEUP')) return [['데일리', '60,000'], ['촬영', '120,000'], ['웨딩', '200,000'], ['속눈썹 추가', '15,000']];
    if (k.includes('WAX')) return [['브라질리언', '60,000'], ['페이스', '25,000'], ['바디', '50,000~'], ['진정 케어', '20,000']];
    return [['컷', '45,000'], ['펌', '180,000~'], ['컬러', '220,000~'], ['클리닉', '80,000~']];
  }

  function _scrim(ctx, w, h, alpha) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, `rgba(8,9,12,${alpha * 0.52})`);
    g.addColorStop(0.52, `rgba(8,9,12,${alpha * 0.18})`);
    g.addColorStop(1, `rgba(8,9,12,${alpha})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function _panel(ctx, x, y, w, h, color, r) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.26)';
    ctx.shadowBlur = Math.max(12, h * 0.08);
    ctx.shadowOffsetY = Math.max(4, h * 0.025);
    ctx.fillStyle = color;
    _rr(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.restore();
  }

  function _brand(ctx, w, h, d) {
    ctx.textAlign = 'left';
    _small(ctx, d.shop, w * 0.08, h * 0.94, 'rgba(255,255,255,0.82)');
    _rule(ctx, w * 0.08, h * 0.9, w * 0.18, d.accent);
  }

  function _label(ctx, text, x, y, color) {
    ctx.textAlign = 'left'; ctx.fillStyle = color;
    ctx.font = `800 ${Math.round(Math.max(11, ctx.canvas.height * 0.018))}px sans-serif`;
    ctx.fillText(String(text).toUpperCase(), x, y);
  }

  function _headline(ctx, text, x, y, maxW, color, scale) {
    ctx.textAlign = 'left'; ctx.fillStyle = color;
    ctx.font = `900 ${Math.round(ctx.canvas.height * scale)}px sans-serif`;
    _fit(ctx, text, x, y, maxW, ctx.canvas.height * scale * 1.12, 2);
  }

  function _big(ctx, text, x, y, maxW, color, scale) {
    ctx.textAlign = 'left'; ctx.fillStyle = color;
    ctx.font = `900 ${Math.round(ctx.canvas.height * scale)}px sans-serif`;
    _fit(ctx, text, x, y, maxW, ctx.canvas.height * scale, 1);
  }

  function _small(ctx, text, x, y, color) {
    ctx.textAlign = 'left'; ctx.fillStyle = color;
    ctx.font = `600 ${Math.round(Math.max(12, ctx.canvas.height * 0.021))}px sans-serif`;
    ctx.fillText(text, x, y);
  }

  function _center(ctx, text, x, y, color, scale, weight) {
    ctx.textAlign = 'center'; ctx.fillStyle = color;
    ctx.font = `${weight || 700} ${Math.round(ctx.canvas.height * scale)}px sans-serif`;
    ctx.fillText(text, x, y);
  }

  function _pill(ctx, x, y, w, h, text, bg, fg) {
    ctx.fillStyle = bg; _rr(ctx, x, y, w, h, h / 2); ctx.fill();
    _center(ctx, text, x + w / 2, y + h * 0.64, fg, 0.02, 800);
  }

  function _rule(ctx, x, y, w, color) {
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, ctx.canvas.width * 0.004);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.stroke();
  }

  function _dot(ctx, x, y, r, color) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  function _frame(ctx, w, h, color) {
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(3, w * 0.008);
    _rr(ctx, w * 0.08, h * 0.08, w * 0.84, h * 0.84, w * 0.04); ctx.stroke();
  }

  function _natureLine(ctx, w, h) {
    ctx.strokeStyle = PAL.sage; ctx.lineWidth = Math.max(2, w * 0.004);
    ctx.beginPath(); ctx.moveTo(w * 0.12, h * 0.32); ctx.bezierCurveTo(w * 0.36, h * 0.22, w * 0.6, h * 0.42, w * 0.88, h * 0.28); ctx.stroke();
  }

  function _fit(ctx, text, x, y, maxW, lineH, maxLines) {
    const words = String(text).split(/\s+/), lines = [];
    let cur = '';
    words.forEach(word => {
      const test = cur ? cur + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = word; } else cur = test;
    });
    if (cur) lines.push(cur);
    lines.slice(0, maxLines).forEach((line, i) => ctx.fillText(line, x, y + i * lineH));
  }

  function _grad(ctx, x0, y0, x1, y1, a, b) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, a); g.addColorStop(1, b);
    return g;
  }

  function _rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // [T1+T2 2026-06-06] 캔바식 갤러리로 통합 — "프리미엄 템플릿 30종" 별도 버튼 강제 노출 제거.
  //   렌더 hook(_premiumHook)·register 는 그대로 유지(적용·프리뷰 품질 동일).
  function _watchPanel() { _register(); }

  function _register() {
    const PE = window.PhotoEditor;
    if (!PE || !PE._internal || !PE._internal.registerDrawHook) return false;
    PE._internal.registerDrawHook('tplV2_overlay', _premiumHook);
    return true;
  }

  function _boot() {
    if (!_register()) setTimeout(_boot, 400);
    let tries = 0;
    const iv = setInterval(() => {
      _register();
      tries += 1;
      if (tries > 24) clearInterval(iv);
    }, 250);
    _watchPanel();
  }

  // renderHook: 갤러리 프리뷰가 "현재 사진 + 템플릿" 합성에 재사용(적용 결과와 동일한 렌더).
  window.PhotoEditorPremiumTemplates = { register: _register, renderHook: _premiumHook, primeImage: _primeImage };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _boot);
  else _boot();
})();
