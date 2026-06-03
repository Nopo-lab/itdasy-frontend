/* 사진 편집기 — 템플릿 캔버스 합성 */
(function () {
  'use strict';

  if (window.PhotoEditorTemplateOverlay) return;

  // [T-006] 가격표 메뉴 — 샵의 실제 서비스가 있으면 그것, 없으면 전달된 업종 기본값.
  function _menu(fallback) {
    try {
      if (window.ItdasyPriceMenu && typeof window.ItdasyPriceMenu.shopMenu === 'function') {
        const real = window.ItdasyPriceMenu.shopMenu();
        if (real && real.length) return real;
      }
    } catch (_e) { void 0; }
    return fallback;
  }

  function draw(ctx, dw, dh, t, brand) {
    const accent = brand.bg || '#7b61ff';
    const shopName = brand.shopName || '잇데이 스튜디오';
    const head = t.prefillText || t.label;
    ctx.save();
    const dispatch = {
      'feed-showcase': () => _drawFeedShowcase(ctx, dw, dh, head, accent, shopName),
      'feed-new-menu': () => _drawFeedNewMenu(ctx, dw, dh, head, accent, shopName),
      'feed-review': () => _drawFeedReview(ctx, dw, dh, head, accent, shopName),
      'feed-price': () => _drawFeedPrice(ctx, dw, dh, head, accent, shopName),
      'feed-notice': () => _drawFeedNotice(ctx, dw, dh, head, accent, shopName),
      'story-count': () => _drawStoryCount(ctx, dw, dh, head, accent, shopName),
      'story-open': () => _drawStoryOpen(ctx, dw, dh, head, accent, shopName),
      'story-attend': () => _drawStoryAttend(ctx, dw, dh, head, accent, shopName),
      'story-qa': () => _drawStoryQA(ctx, dw, dh, head, accent, shopName),
      'story-poll': () => _drawStoryPoll(ctx, dw, dh, head, accent, shopName),
      'reels-ba': () => _drawReelsBA(ctx, dw, dh, head, accent, shopName),
      'reels-price': () => _drawReelsPrice(ctx, dw, dh, head, accent, shopName),
      'reels-newmenu': () => _drawReelsNew(ctx, dw, dh, head, accent, shopName),
      'reels-review': () => _drawReelsReview(ctx, dw, dh, head, accent, shopName),
      'reels-process': () => _drawReelsProcess(ctx, dw, dh, head, accent, shopName),
      'event-discount': () => _drawEventDiscount(ctx, dw, dh, head, accent, shopName),
      'event-member': () => _drawEventMember(ctx, dw, dh, head, accent, shopName),
      'event-newcomer': () => _drawEventNewcomer(ctx, dw, dh, head, accent, shopName),
      'event-deadline': () => _drawEventDeadline(ctx, dw, dh, head, accent, shopName),
      'event-gift': () => _drawEventGift(ctx, dw, dh, head, accent, shopName),
      // [T-006] 샵의 실제 서비스 우선(_menu), 없으면 업종 기본 메뉴 폴백.
      'price-hair': () => _drawPriceTable(ctx, dw, dh, '헤어 메뉴', accent, shopName, _menu(['컷 / 45,000원','펌 / 180,000원','컬러 / 220,000원','드라이 / 25,000원'])),
      'price-nail': () => _drawPriceTable(ctx, dw, dh, '네일 메뉴', accent, shopName, _menu(['젤네일 / 50,000원','속눈썹 / 60,000원','케어 / 25,000원','연장 / 70,000원'])),
      'price-lash': () => _drawPriceTable(ctx, dw, dh, '속눈썹 메뉴', accent, shopName, _menu(['풀세트 / 80,000원','리터치 / 45,000원','클렌징 / 15,000원','제거 / 10,000원'])),
      'price-makeup': () => _drawPriceTable(ctx, dw, dh, '메이크업 메뉴', accent, shopName, _menu(['데일리 / 60,000원','파티 / 90,000원','웨딩 / 200,000원','촬영 / 120,000원'])),
      'price-wax': () => _drawPriceTable(ctx, dw, dh, '왁싱 메뉴', accent, shopName, _menu(['브라질리언 / 60,000원','다리 / 50,000원','얼굴 / 25,000원','겨드랑이 / 20,000원'])),
      // [UX-BA-2 P1] ba-cream/sage/dark 는 dispatch 에서 제거 → 아래 /^ba-/ 위임으로 BACompose 렌더.
      //   기존 _drawBACream/Sage/Dark 는 사진 없이 빈 프레임만 그려, "시술 전후" 추천인데 편집 사진이
      //   After 에 안 들어가던 문제(redRatio 0) 수정. (구 함수는 잔존하나 미참조 — varsIgnorePattern ^_ 로 lint-safe)
      'card-minimal': () => _drawCardMinimal(ctx, dw, dh, head, accent, shopName),
      'card-gold': () => _drawCardGold(ctx, dw, dh, head, accent, shopName),
      'card-pink': () => _drawCardPink(ctx, dw, dh, head, accent, shopName),
      'card-dark': () => _drawCardDark(ctx, dw, dh, head, accent, shopName),
      'card-nature': () => _drawCardNature(ctx, dw, dh, head, accent, shopName),
    };
    const fn = dispatch[t.id];
    if (fn) {
      fn();
    } else if (typeof t.id === 'string' && /^ba-/.test(t.id) && window.PhotoEditorBACompose && typeof window.PhotoEditorBACompose.draw === 'function') {
      // v327 fix — dispatch 에 없는 BA 시리즈(예: ba-hair-cream)는 BACompose 로 위임.
      //   templates-v2 ↔ premium-templates 가 같은 'tplV2_overlay' hook 을 register 해서 경합.
      //   어느 쪽이 winner 든 BA 합성이 그려지도록 양쪽에서 동일 경로 보장.
      try {
        const st = window.PhotoEditor && window.PhotoEditor._internal && window.PhotoEditor._internal.getState
          ? window.PhotoEditor._internal.getState() : null;
        const data = { head: head, sub: t.label || '', shop: shopName, accent: accent };
        window.PhotoEditorBACompose.draw(ctx, dw, dh, st, t, data);
      } catch (e) { console.warn('[template-overlay] BACompose 위임 실패:', e && e.message); }
    }
    ctx.restore();
  }

  function _shadow(ctx, alpha, blur, oy) { ctx.shadowColor = `rgba(0,0,0,${alpha})`; ctx.shadowBlur = blur; ctx.shadowOffsetY = oy || 0; }
  function _clearShadow(ctx) { ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
  function _grad(ctx, x0, y0, x1, y1, c0, c1) { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, c0); g.addColorStop(1, c1); return g; }

  function _drawFeedShowcase(ctx, dw, dh, head, accent, shop) {
    ctx.fillStyle = _grad(ctx, 0, dh*0.7, 0, dh, 'rgba(0,0,0,0)', accent);
    ctx.fillRect(0, dh*0.7, dw, dh*0.3); ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; _shadow(ctx, 0.4, 14, 4);
    ctx.font = `800 ${Math.round(dh*0.05)}px sans-serif`; ctx.fillText(head, dw*0.06, dh*0.86);
    _clearShadow(ctx); ctx.font = `500 ${Math.round(dh*0.022)}px sans-serif`; ctx.globalAlpha = 0.92;
    ctx.fillText(shop, dw*0.06, dh*0.94); ctx.globalAlpha = 1;
  }

  function _drawFeedNewMenu(ctx, dw, dh, head, accent, shop) {
    ctx.fillStyle = accent; _roundRect(ctx, dw*0.06, dh*0.05, dw*0.18, dh*0.05, 8); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.font = `800 ${Math.round(dh*0.022)}px sans-serif`; ctx.fillText('NEW', dw*0.09, dh*0.085);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, dh*0.78, dw, dh*0.22);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = `800 ${Math.round(dh*0.045)}px sans-serif`; ctx.fillText(head, dw/2, dh*0.88);
    ctx.font = `500 ${Math.round(dh*0.022)}px sans-serif`; ctx.fillText(shop, dw/2, dh*0.95);
  }

  function _drawFeedReview(ctx, dw, dh, head, accent, shop) {
    const boxW = dw*0.84, boxH = dh*0.28, x = (dw-boxW)/2, y = dh*0.66;
    ctx.fillStyle = 'rgba(255,255,255,0.96)'; _roundRect(ctx, x, y, boxW, boxH, 20); ctx.fill();
    ctx.fillStyle = accent; ctx.textAlign = 'left'; ctx.font = `800 ${Math.round(dh*0.06)}px serif`; ctx.fillText('"', x+12, y+dh*0.07);
    ctx.fillStyle = '#222'; ctx.font = `600 ${Math.round(dh*0.028)}px sans-serif`; ctx.fillText(head, x+dw*0.06, y+dh*0.12);
    ctx.fillStyle = '#888'; ctx.font = `400 ${Math.round(dh*0.018)}px sans-serif`; ctx.fillText('— ' + shop + ' 고객 후기', x+dw*0.06, y+boxH-dh*0.03);
  }

  function _drawFeedPrice(ctx, dw, dh, head, accent, shop) {
    ctx.fillStyle = accent; ctx.fillRect(0, dh*0.42, dw, dh*0.16); ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.font = `900 ${Math.round(dh*0.07)}px sans-serif`; ctx.fillText(head, dw/2, dh*0.52);
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, dh*0.85, dw, dh*0.15);
    ctx.fillStyle = '#fff'; ctx.font = `500 ${Math.round(dh*0.025)}px sans-serif`; ctx.fillText(shop + ' · 한정 진행', dw/2, dh*0.92);
  }

  function _drawFeedNotice(ctx, dw, dh, head, accent, shop) {
    ctx.fillStyle = accent + 'e0'; ctx.fillRect(0, 0, dw, dh*0.13); ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.font = `800 ${Math.round(dh*0.035)}px sans-serif`; ctx.fillText('📢 안내사항', dw/2, dh*0.08);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, dh*0.72, dw, dh*0.28);
    ctx.fillStyle = '#fff'; ctx.font = `600 ${Math.round(dh*0.032)}px sans-serif`; ctx.fillText(head, dw/2, dh*0.85);
    ctx.font = `400 ${Math.round(dh*0.02)}px sans-serif`; ctx.globalAlpha = 0.85; ctx.fillText(shop, dw/2, dh*0.93); ctx.globalAlpha = 1;
  }

  function _drawStoryCount(ctx, dw, dh, head, accent, shop) {
    ctx.fillStyle = accent; ctx.fillRect(0, 0, dw, dh); ctx.globalAlpha = 0.92; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, dw, dh); ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = `900 ${Math.round(dh*0.18)}px sans-serif`; _shadow(ctx, 0.5, 24, 6);
    ctx.fillText(head, dw/2, dh*0.55); _clearShadow(ctx); ctx.font = `600 ${Math.round(dh*0.025)}px sans-serif`; ctx.fillText(shop, dw/2, dh*0.65);
  }

  function _drawStoryOpen(ctx, dw, dh, head, accent, shop) {
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, dw, dh); ctx.fillStyle = accent; _roundRect(ctx, dw*0.15, dh*0.4, dw*0.7, dh*0.16, 30); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = `900 ${Math.round(dh*0.07)}px sans-serif`; ctx.fillText(head, dw/2, dh*0.51);
    ctx.fillStyle = accent; ctx.font = `700 ${Math.round(dh*0.028)}px sans-serif`; ctx.fillText(shop, dw/2, dh*0.62);
  }

  function _drawStoryAttend(ctx, dw, dh, head, accent, shop) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0, dh*0.3, dw, dh*0.4); ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.font = `800 ${Math.round(dh*0.04)}px sans-serif`; ctx.fillText(head, dw/2, dh*0.42);
    for (let i = 0; i < 5; i++) {
      const x = dw*0.18 + i*dw*0.16;
      ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(x, dh*0.55, dw*0.04, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round(dh*0.025)}px sans-serif`; ctx.fillText((i+1).toString(), x, dh*0.56);
    }
    ctx.fillStyle = '#fff'; ctx.font = `500 ${Math.round(dh*0.022)}px sans-serif`; ctx.fillText(shop + ' · 5회 방문 시 혜택', dw/2, dh*0.68);
  }

  function _drawStoryQA(ctx, dw, dh, head, accent, shop) {
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, dw, dh); ctx.fillStyle = accent; _roundRect(ctx, dw*0.1, dh*0.35, dw*0.8, dh*0.08, 16); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = `800 ${Math.round(dh*0.03)}px sans-serif`; ctx.fillText('Q: ' + head, dw/2, dh*0.41);
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 2; _roundRect(ctx, dw*0.1, dh*0.46, dw*0.8, dh*0.12, 16); ctx.stroke();
    ctx.fillStyle = '#aaa'; ctx.font = `500 ${Math.round(dh*0.024)}px sans-serif`; ctx.fillText('답변을 입력하세요...', dw/2, dh*0.535);
    ctx.fillStyle = accent; ctx.font = `700 ${Math.round(dh*0.022)}px sans-serif`; ctx.fillText(shop, dw/2, dh*0.94);
  }

  function _drawStoryPoll(ctx, dw, dh, head, accent, shop) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, dh*0.3, dw, dh*0.4); ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.font = `800 ${Math.round(dh*0.035)}px sans-serif`; ctx.fillText(head, dw/2, dh*0.4);
    ['A 옵션', 'B 옵션'].forEach((label, i) => {
      ctx.fillStyle = i === 0 ? accent : '#fff'; _roundRect(ctx, dw*0.15, dh*(0.48 + i*0.08), dw*0.7, dh*0.06, 20); ctx.fill();
      ctx.fillStyle = i === 0 ? '#fff' : accent; ctx.font = `700 ${Math.round(dh*0.024)}px sans-serif`; ctx.fillText(label, dw/2, dh*(0.518 + i*0.08));
    });
    ctx.fillStyle = '#fff'; ctx.font = `500 ${Math.round(dh*0.02)}px sans-serif`; ctx.fillText(shop, dw/2, dh*0.7);
  }

  function _drawReelsBA(ctx, dw, dh, head, accent, shop) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, dh*0.42, dw, dh*0.16); ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.font = `900 ${Math.round(dh*0.05)}px sans-serif`; ctx.fillText(head, dw/2, dh*0.51);
    ctx.fillStyle = accent; ctx.fillRect(0, dh*0.08, dw*0.32, dh*0.05); ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round(dh*0.025)}px sans-serif`;
    ctx.textAlign = 'left'; ctx.fillText('BEFORE', dw*0.04, dh*0.115); ctx.fillStyle = accent; ctx.fillRect(dw*0.68, dh*0.85, dw*0.32, dh*0.05);
    ctx.fillStyle = '#fff'; ctx.fillText('AFTER', dw*0.72, dh*0.885); ctx.textAlign = 'center'; ctx.font = `600 ${Math.round(dh*0.022)}px sans-serif`; ctx.fillText(shop, dw/2, dh*0.95);
  }

  function _drawReelsPrice(ctx, dw, dh, head, accent, shop) {
    ctx.fillStyle = '#000'; ctx.globalAlpha = 0.5; ctx.fillRect(0, 0, dw, dh); ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.font = `900 ${Math.round(dh*0.08)}px sans-serif`; _shadow(ctx, 0.6, 24, 6); ctx.fillText(head, dw/2, dh*0.5); _clearShadow(ctx);
    ctx.fillStyle = accent; ctx.font = `800 ${Math.round(dh*0.035)}px sans-serif`; ctx.fillText('탭하여 자세히 보기 →', dw/2, dh*0.6);
    ctx.fillStyle = '#fff'; ctx.font = `500 ${Math.round(dh*0.022)}px sans-serif`; ctx.fillText(shop, dw/2, dh*0.95);
  }

  function _drawReelsNew(ctx, dw, dh, head, accent, shop) {
    ctx.fillStyle = accent; ctx.fillRect(0, 0, dw, dh*0.15); ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.font = `900 ${Math.round(dh*0.07)}px sans-serif`; ctx.fillText('✨ NEW', dw/2, dh*0.1);
    ctx.fillStyle = '#000'; ctx.globalAlpha = 0.4; ctx.fillRect(0, dh*0.4, dw, dh*0.2); ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round(dh*0.045)}px sans-serif`; ctx.fillText(head, dw/2, dh*0.52);
    ctx.font = `500 ${Math.round(dh*0.022)}px sans-serif`; ctx.fillText(shop, dw/2, dh*0.95);
  }

  function _drawReelsReview(ctx, dw, dh, head, accent, shop) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, dh*0.3, dw, dh*0.3); ctx.fillStyle = '#FFD700'; ctx.textAlign = 'center';
    ctx.font = `800 ${Math.round(dh*0.05)}px sans-serif`; ctx.fillText('★★★★★', dw/2, dh*0.4);
    ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round(dh*0.035)}px sans-serif`; ctx.fillText(head, dw/2, dh*0.5);
    ctx.fillStyle = accent; ctx.font = `600 ${Math.round(dh*0.022)}px sans-serif`; ctx.fillText('— ' + shop, dw/2, dh*0.58);
  }

  function _drawReelsProcess(ctx, dw, dh, head, accent, shop) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, dh*0.3, dw, dh*0.4); ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.font = `800 ${Math.round(dh*0.04)}px sans-serif`; ctx.fillText(head, dw/2, dh*0.4);
    for (let i = 0; i < 4; i++) {
      const x = dw*0.15 + i*dw*0.22;
      ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(x, dh*0.55, dw*0.04, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `900 ${Math.round(dh*0.028)}px sans-serif`; ctx.fillText((i+1).toString(), x, dh*0.563);
      if (i < 3) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + dw*0.04, dh*0.55); ctx.lineTo(x + dw*0.18, dh*0.55); ctx.stroke(); }
    }
    ctx.fillStyle = '#fff'; ctx.font = `500 ${Math.round(dh*0.022)}px sans-serif`; ctx.fillText(shop, dw/2, dh*0.95);
  }

  function _drawEventDiscount(ctx, dw, dh, head, accent, shop) {
    ctx.save(); ctx.translate(dw*0.7, dh*0.25); ctx.rotate(-Math.PI/12); ctx.fillStyle = accent; _roundRect(ctx, -dw*0.18, -dh*0.06, dw*0.36, dh*0.12, 18); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = `900 ${Math.round(dh*0.06)}px sans-serif`; ctx.fillText('SALE', 0, dh*0.02); ctx.restore();
    ctx.fillStyle = accent; _roundRect(ctx, dw*0.1, dh*0.4, dw*0.8, dh*0.25, 24); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = `900 ${Math.round(dh*0.1)}px sans-serif`; ctx.fillText(head, dw/2, dh*0.55);
    ctx.fillStyle = '#000'; ctx.font = `700 ${Math.round(dh*0.025)}px sans-serif`; ctx.fillText(shop + ' · 한정 진행', dw/2, dh*0.92);
  }

  function _drawEventMember(ctx, dw, dh, head, accent, shop) {
    ctx.strokeStyle = accent; ctx.lineWidth = Math.max(4, dw*0.01); _roundRect(ctx, dw*0.05, dh*0.05, dw*0.9, dh*0.9, 28); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; _roundRect(ctx, dw*0.12, dh*0.35, dw*0.76, dh*0.3, 20); ctx.fill();
    ctx.fillStyle = accent; ctx.textAlign = 'center'; ctx.font = `900 ${Math.round(dh*0.04)}px sans-serif`; ctx.fillText('VIP MEMBERS', dw/2, dh*0.43);
    ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round(dh*0.055)}px sans-serif`; ctx.fillText(head, dw/2, dh*0.55);
    ctx.font = `500 ${Math.round(dh*0.022)}px sans-serif`; ctx.fillText(shop, dw/2, dh*0.62);
  }

  function _drawEventNewcomer(ctx, dw, dh, head, accent, shop) {
    ctx.fillStyle = accent; ctx.fillRect(0, 0, dw*0.45, dh); ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
    ctx.font = `900 ${Math.round(dh*0.045)}px sans-serif`; ctx.fillText('첫 방문', dw*0.05, dh*0.45); ctx.fillText('할인 이벤트', dw*0.05, dh*0.55);
    ctx.fillStyle = '#000'; ctx.fillRect(dw*0.45, 0, dw*0.55, dh); ctx.fillStyle = accent; ctx.textAlign = 'center';
    ctx.font = `900 ${Math.round(dh*0.1)}px sans-serif`; ctx.fillText(head, dw*0.72, dh*0.55);
    ctx.fillStyle = '#fff'; ctx.font = `500 ${Math.round(dh*0.02)}px sans-serif`; ctx.fillText(shop, dw*0.72, dh*0.92);
  }

  function _drawEventDeadline(ctx, dw, dh, head, accent, shop) {
    ctx.fillStyle = '#ef4444'; ctx.fillRect(0, dh*0.2, dw, dh*0.15); ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.font = `900 ${Math.round(dh*0.045)}px sans-serif`; ctx.fillText('⏰ 마감 임박', dw/2, dh*0.295);
    ctx.fillStyle = accent; _roundRect(ctx, dw*0.1, dh*0.45, dw*0.8, dh*0.2, 20); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `900 ${Math.round(dh*0.07)}px sans-serif`; ctx.fillText(head, dw/2, dh*0.58);
    ctx.fillStyle = '#000'; ctx.font = `500 ${Math.round(dh*0.022)}px sans-serif`; ctx.fillText(shop, dw/2, dh*0.92);
  }

  function _drawEventGift(ctx, dw, dh, head, accent, shop) {
    ctx.fillStyle = accent + '30'; ctx.fillRect(0, 0, dw, dh); ctx.fillStyle = accent; _roundRect(ctx, dw*0.2, dh*0.35, dw*0.6, dh*0.3, 24); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(dw*0.48, dh*0.35, dw*0.04, dh*0.3); ctx.fillRect(dw*0.2, dh*0.48, dw*0.6, dh*0.04);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = `900 ${Math.round(dh*0.06)}px sans-serif`; _shadow(ctx, 0.5, 12, 4); ctx.fillText('🎁', dw/2, dh*0.46); _clearShadow(ctx);
    ctx.fillStyle = '#000'; ctx.font = `800 ${Math.round(dh*0.04)}px sans-serif`; ctx.fillText(head, dw/2, dh*0.75);
    ctx.fillStyle = accent; ctx.font = `600 ${Math.round(dh*0.022)}px sans-serif`; ctx.fillText(shop, dw/2, dh*0.85);
  }

  function _drawPriceTable(ctx, dw, dh, title, accent, shop, items) {
    ctx.fillStyle = accent; ctx.fillRect(0, 0, dw, dh*0.15); ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
    ctx.font = `800 ${Math.round(dh*0.04)}px sans-serif`; ctx.fillText(title, dw*0.06, dh*0.09);
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fillRect(0, dh*0.55, dw, dh*0.45);
    ctx.fillStyle = '#222'; ctx.font = `600 ${Math.round(dh*0.028)}px sans-serif`; items.forEach((row, i) => ctx.fillText(row, dw*0.08, dh*0.63 + i*dh*0.06));
    ctx.fillStyle = accent; ctx.font = `500 ${Math.round(dh*0.02)}px sans-serif`; ctx.fillText(shop, dw*0.06, dh*0.97);
  }

  function _drawBACream(ctx, dw, dh, _head, _accent, shop) {
    ctx.fillStyle = _grad(ctx, 0, 0, 0, dh, '#f5efe6', '#e8ddd0');
    ctx.fillRect(0, 0, dw, dh);
    for (let i = 0; i < 5; i++) { ctx.fillStyle = 'rgba(180,160,130,0.04)'; ctx.beginPath(); ctx.ellipse(dw * (0.2 + i * 0.18), dh * (0.15 + i * 0.12), dw * 0.25, dh * 0.08, -0.3, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#6b5c4c'; ctx.textAlign = 'center';
    ctx.font = `400 ${Math.round(dh * 0.022)}px sans-serif`; ctx.fillText('@' + (shop || 'salon'), dw / 2, dh * 0.06);
    ctx.font = `italic 700 ${Math.round(dh * 0.055)}px "Playfair Display", Georgia, serif`; ctx.fillText('Before & After', dw / 2, dh * 0.14);
    const fw = dw * 0.4, fh = dh * 0.5, gap = dw * 0.04, y = dh * 0.2;
    const x1 = dw / 2 - fw - gap / 2, x2 = dw / 2 + gap / 2;
    ctx.strokeStyle = 'rgba(160,140,110,0.35)'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
    _roundRect(ctx, x1 - 4, y - 4, fw + 8, fh + 8, 14); ctx.stroke();
    _roundRect(ctx, x2 - 4, y - 4, fw + 8, fh + 8, 14); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; _roundRect(ctx, x1, y, fw, fh, 12); ctx.fill();
    _roundRect(ctx, x2, y, fw, fh, 12); ctx.fill();
    ctx.fillStyle = '#5a4e40'; ctx.font = `600 ${Math.round(dh * 0.024)}px sans-serif`;
    ctx.fillText('Before', x1 + fw / 2, y + fh + dh * 0.04);
    ctx.fillStyle = '#999'; ctx.font = `400 ${Math.round(dh * 0.018)}px sans-serif`;
    ctx.fillText('시술전', x1 + fw / 2, y + fh + dh * 0.065);
    ctx.fillStyle = '#5a4e40'; ctx.font = `600 ${Math.round(dh * 0.024)}px sans-serif`;
    ctx.fillText('After', x2 + fw / 2, y + fh + dh * 0.04);
    ctx.fillStyle = '#999'; ctx.font = `400 ${Math.round(dh * 0.018)}px sans-serif`;
    ctx.fillText('시술후', x2 + fw / 2, y + fh + dh * 0.065);
    ctx.fillStyle = 'rgba(240,232,218,0.95)'; _roundRect(ctx, dw * 0.2, dh * 0.88, dw * 0.6, dh * 0.05, 20); ctx.fill();
    ctx.fillStyle = '#8a7a65'; ctx.font = `500 ${Math.round(dh * 0.018)}px sans-serif`;
    ctx.fillText('@' + (shop || 'salon'), dw / 2, dh * 0.912);
    ctx.fillStyle = '#b8a88a'; ctx.font = `400 ${Math.round(dh * 0.016)}px sans-serif`;
    ctx.fillText(shop || 'Beauty Salon', dw / 2, dh * 0.97);
  }

  function _drawBASage(ctx, dw, dh, _head, _accent, shop) {
    ctx.fillStyle = _grad(ctx, 0, 0, dw, dh, '#c5cdb8', '#a8b299');
    ctx.fillRect(0, 0, dw, dh);
    ctx.globalAlpha = 0.06;
    for (let i = 0; i < 3; i++) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(dw * (0.7 + i * 0.1), dh * (0.2 + i * 0.25), dw * 0.15, dh * 0.3, 0.5, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#3d4a2e'; ctx.textAlign = 'center';
    ctx.font = `italic 700 ${Math.round(dh * 0.045)}px "Playfair Display", Georgia, serif`; ctx.fillText('Before & After', dw / 2, dh * 0.07);
    ctx.font = `400 ${Math.round(dh * 0.02)}px sans-serif`; ctx.fillText('시술 전후 모습을 확인해 보세요!', dw / 2, dh * 0.105);
    const fw = dw * 0.42, fh = dh * 0.55, gap = dw * 0.03, y = dh * 0.16;
    const x1 = dw / 2 - fw - gap / 2, x2 = dw / 2 + gap / 2;
    ctx.strokeStyle = 'rgba(61,74,46,0.3)'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
    _roundRect(ctx, x1 - 3, y - 3, fw + 6, fh + 6, 16); ctx.stroke();
    _roundRect(ctx, x2 - 3, y - 3, fw + 6, fh + 6, 16); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(210,218,198,0.5)'; _roundRect(ctx, x1, y, fw, fh, 14); ctx.fill();
    _roundRect(ctx, x2, y, fw, fh, 14); ctx.fill();
    ctx.fillStyle = '#3d4a2e'; ctx.font = `italic 600 ${Math.round(dh * 0.026)}px "Playfair Display", Georgia, serif`;
    ctx.fillText('Before', x1 + fw / 2, y + fh + dh * 0.035);
    ctx.fillText('After', x2 + fw / 2, y + fh + dh * 0.035);
    ctx.fillStyle = '#5d6e4a'; ctx.font = `400 ${Math.round(dh * 0.016)}px sans-serif`;
    ctx.fillText('전', x1 + fw / 2, y + fh + dh * 0.06);
    ctx.fillText('후', x2 + fw / 2, y + fh + dh * 0.06);
    ctx.strokeStyle = '#3d4a2e'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(dw * 0.15, dh * 0.86); ctx.lineTo(dw * 0.85, dh * 0.86); ctx.stroke();
    ctx.fillStyle = '#3d4a2e'; ctx.font = `600 ${Math.round(dh * 0.016)}px sans-serif`;
    ctx.fillText(shop ? shop.toUpperCase() : 'BEAUTY SALON', dw / 2, dh * 0.9);
  }

  function _drawBADark(ctx, dw, dh, _head, accent, shop) {
    ctx.fillStyle = '#1a1a1f'; ctx.fillRect(0, 0, dw, dh);
    const goldGrad = _grad(ctx, 0, 0, dw, 0, '#c9a96e', '#e8cc8c');
    ctx.fillStyle = goldGrad; ctx.textAlign = 'center';
    ctx.font = `italic 700 ${Math.round(dh * 0.05)}px "Playfair Display", Georgia, serif`; ctx.fillText('Before & After', dw / 2, dh * 0.08);
    ctx.strokeStyle = 'rgba(201,169,110,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(dw * 0.1, dh * 0.11); ctx.lineTo(dw * 0.9, dh * 0.11); ctx.stroke();
    const fw = dw * 0.42, fh = dh * 0.58, gap = dw * 0.03, y = dh * 0.15;
    const x1 = dw / 2 - fw - gap / 2, x2 = dw / 2 + gap / 2;
    ctx.strokeStyle = 'rgba(201,169,110,0.25)'; ctx.lineWidth = 1.5;
    _roundRect(ctx, x1 - 3, y - 3, fw + 6, fh + 6, 10); ctx.stroke();
    _roundRect(ctx, x2 - 3, y - 3, fw + 6, fh + 6, 10); ctx.stroke();
    ctx.fillStyle = goldGrad; ctx.font = `600 ${Math.round(dh * 0.022)}px sans-serif`;
    ctx.fillText('BEFORE', x1 + fw / 2, y + fh + dh * 0.035);
    ctx.fillText('AFTER', x2 + fw / 2, y + fh + dh * 0.035);
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = `400 ${Math.round(dh * 0.016)}px sans-serif`;
    ctx.fillText('시술전', x1 + fw / 2, y + fh + dh * 0.058);
    ctx.fillText('시술후', x2 + fw / 2, y + fh + dh * 0.058);
    ctx.strokeStyle = 'rgba(201,169,110,0.2)'; ctx.beginPath(); ctx.moveTo(dw * 0.1, dh * 0.88); ctx.lineTo(dw * 0.9, dh * 0.88); ctx.stroke();
    ctx.fillStyle = goldGrad; ctx.font = `500 ${Math.round(dh * 0.018)}px sans-serif`;
    ctx.fillText(shop ? shop.toUpperCase() : 'BEAUTY STUDIO', dw / 2, dh * 0.93);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = `400 ${Math.round(dh * 0.014)}px sans-serif`;
    ctx.fillText(accent === 'gold' ? 'Premium Beauty Service' : shop, dw / 2, dh * 0.96);
  }

  function _drawCardMinimal(ctx, dw, dh, head, accent, shop) {
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, dw, dh); ctx.strokeStyle = '#222'; ctx.lineWidth = Math.max(2, dw*0.004);
    ctx.beginPath(); ctx.moveTo(dw*0.1, dh*0.5); ctx.lineTo(dw*0.9, dh*0.5); ctx.stroke();
    ctx.fillStyle = '#222'; ctx.textAlign = 'center'; ctx.font = `300 ${Math.round(dh*0.04)}px sans-serif`; ctx.fillText(shop, dw/2, dh*0.45);
    ctx.fillStyle = accent; ctx.font = `700 ${Math.round(dh*0.022)}px sans-serif`; ctx.fillText(head, dw/2, dh*0.6);
  }

  function _drawCardGold(ctx, dw, dh, head, accent, shop) {
    ctx.fillStyle = '#0e0e10'; ctx.fillRect(0, 0, dw, dh); const goldGrad = _grad(ctx, 0, 0, dw, dh, '#fdc66b', '#9a6a1a');
    ctx.strokeStyle = goldGrad; ctx.lineWidth = Math.max(4, dw*0.01); _roundRect(ctx, dw*0.08, dh*0.08, dw*0.84, dh*0.84, 24); ctx.stroke();
    ctx.fillStyle = goldGrad; ctx.textAlign = 'center'; ctx.font = `900 ${Math.round(dh*0.05)}px serif`; ctx.fillText(shop, dw/2, dh*0.48);
    ctx.fillStyle = '#fff'; ctx.font = `400 ${Math.round(dh*0.022)}px sans-serif`; ctx.fillText(head, dw/2, dh*0.58);
  }

  function _drawCardPink(ctx, dw, dh, head, accent, shop) {
    ctx.fillStyle = _grad(ctx, 0, 0, dw, dh, '#ffe4ea', '#ffc8d4'); ctx.fillRect(0, 0, dw, dh); ctx.fillStyle = '#fff';
    _roundRect(ctx, dw*0.15, dh*0.35, dw*0.7, dh*0.3, 28); ctx.fill();
    ctx.fillStyle = accent; ctx.textAlign = 'center'; ctx.font = `800 ${Math.round(dh*0.045)}px sans-serif`; ctx.fillText(shop, dw/2, dh*0.5);
    ctx.fillStyle = '#888'; ctx.font = `500 ${Math.round(dh*0.022)}px sans-serif`; ctx.fillText(head, dw/2, dh*0.58);
  }

  function _drawCardDark(ctx, dw, dh, head, accent, shop) {
    ctx.fillStyle = '#1a1a1f'; ctx.fillRect(0, 0, dw, dh); ctx.fillStyle = accent; ctx.fillRect(0, dh*0.4, dw, dh*0.04);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = `300 ${Math.round(dh*0.06)}px sans-serif`; ctx.fillText(shop, dw/2, dh*0.36);
    ctx.fillStyle = accent; ctx.font = `700 ${Math.round(dh*0.025)}px sans-serif`; ctx.fillText(head, dw/2, dh*0.52);
  }

  function _drawCardNature(ctx, dw, dh, head, accent, shop) {
    ctx.fillStyle = _grad(ctx, 0, 0, 0, dh, '#f0e8d5', '#d4c9a8'); ctx.fillRect(0, 0, dw, dh);
    ctx.strokeStyle = '#5d6e3f'; ctx.lineWidth = Math.max(2, dw*0.003);
    ctx.beginPath(); ctx.moveTo(dw*0.1, dh*0.5); ctx.bezierCurveTo(dw*0.3, dh*0.4, dw*0.5, dh*0.45, dw*0.9, dh*0.5); ctx.stroke();
    ctx.fillStyle = '#3a4a23'; ctx.textAlign = 'center'; ctx.font = `700 ${Math.round(dh*0.04)}px serif`; ctx.fillText(shop, dw/2, dh*0.45);
    ctx.fillStyle = '#5d6e3f'; ctx.font = `400 ${Math.round(dh*0.022)}px sans-serif`; ctx.fillText(head, dw/2, dh*0.6);
  }

  function _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  window.PhotoEditorTemplateOverlay = { draw };
})();
