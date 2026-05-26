/* 사진 편집기 — 템플릿 캔버스 합성 */
(function () {
  'use strict';

  if (window.PhotoEditorTemplateOverlay) return;

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
      'price-hair': () => _drawPriceTable(ctx, dw, dh, '헤어 메뉴', accent, shopName, ['컷 / 45,000원','펌 / 180,000원','컬러 / 220,000원','드라이 / 25,000원']),
      'price-nail': () => _drawPriceTable(ctx, dw, dh, '네일 메뉴', accent, shopName, ['젤네일 / 50,000원','속눈썹 / 60,000원','케어 / 25,000원','연장 / 70,000원']),
      'price-lash': () => _drawPriceTable(ctx, dw, dh, '속눈썹 메뉴', accent, shopName, ['풀세트 / 80,000원','리터치 / 45,000원','클렌징 / 15,000원','제거 / 10,000원']),
      'price-makeup': () => _drawPriceTable(ctx, dw, dh, '메이크업 메뉴', accent, shopName, ['데일리 / 60,000원','파티 / 90,000원','웨딩 / 200,000원','촬영 / 120,000원']),
      'price-wax': () => _drawPriceTable(ctx, dw, dh, '왁싱 메뉴', accent, shopName, ['브라질리언 / 60,000원','다리 / 50,000원','얼굴 / 25,000원','겨드랑이 / 20,000원']),
      'card-minimal': () => _drawCardMinimal(ctx, dw, dh, head, accent, shopName),
      'card-gold': () => _drawCardGold(ctx, dw, dh, head, accent, shopName),
      'card-pink': () => _drawCardPink(ctx, dw, dh, head, accent, shopName),
      'card-dark': () => _drawCardDark(ctx, dw, dh, head, accent, shopName),
      'card-nature': () => _drawCardNature(ctx, dw, dh, head, accent, shopName),
    };
    const fn = dispatch[t.id];
    if (fn) fn();
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
