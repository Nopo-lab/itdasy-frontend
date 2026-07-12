/* 사진 편집기 — 템플릿 editable slot 메타데이터 (PR-S1 2026-06-06)

   목표: 템플릿마다 "사용자가 바꿔도 되는 슬롯"을 선언적으로 정의 + 안전한 기본값 생성.
   - UI(편집 시트)는 S2에서. 이번 PR은 기반 구조(슬롯 정의 + 기본값 + 병합)만.
   - 종류: price | review | before_after | generic
   - 3종(price/review/before_after) 샘플 메타만 충실히, 나머지는 generic fallback.

   외부 노출: window.PhotoEditorTemplateSlots
     getSlots(templateId, templateData)              → slot 정의 배열
     getDefaultValues(templateId, templateData, ctx) → { key: value } 기본값
     mergeValues(slots, savedValues)                 → 저장값 우선 병합
     inferTemplateKind(templateId, templateData)     → 'price'|'review'|'before_after'|'generic'
*/
(function () {
  'use strict';
  if (window.PhotoEditorTemplateSlots) return;

  // ── 슬롯 정의 (kind 별) ─────────────────────────────────
  //   type: text | textarea | list | image  ·  role: image 슬롯 용도
  const SLOTS = {
    price: [
      { key: 'shop_name', type: 'text', label: '샵 이름', max: 24 },
      { key: 'headline', type: 'text', label: '제목', max: 20, maxLines: 2 },
      { key: 'subtitle', type: 'textarea', label: '부제', max: 60, maxLines: 2 },
      { key: 'services', type: 'list', label: '시술·가격', item: ['name', 'desc', 'price'] },
      { key: 'cta', type: 'text', label: '행동 유도', max: 16 },
      { key: 'phone', type: 'text', label: '연락처', max: 20 },
      { key: 'main_photo', type: 'image', label: '배경 사진', role: 'main' },
    ],
    review: [
      { key: 'shop_name', type: 'text', label: '샵 이름', max: 24 },
      { key: 'headline', type: 'text', label: '제목', max: 20, maxLines: 2 },
      { key: 'subtitle', type: 'textarea', label: '부제', max: 60, maxLines: 2 },
      { key: 'review_text', type: 'textarea', label: '후기 문구', max: 120, maxLines: 4 },
      { key: 'customer_label', type: 'text', label: '작성자', max: 20 },
      { key: 'cta', type: 'text', label: '행동 유도', max: 16 },
      { key: 'main_photo', type: 'image', label: '배경 사진', role: 'main' },
    ],
    before_after: [
      { key: 'shop_name', type: 'text', label: '샵 이름', max: 24 },
      { key: 'headline', type: 'text', label: '제목', max: 20, maxLines: 2 },
      { key: 'subtitle', type: 'textarea', label: '부제', max: 60, maxLines: 2 },
      { key: 'before_label', type: 'text', label: 'Before 라벨', max: 12 },
      { key: 'after_label', type: 'text', label: 'After 라벨', max: 12 },
      { key: 'before_caption', type: 'text', label: 'Before 설명', max: 24 },
      { key: 'after_caption', type: 'text', label: 'After 설명', max: 24 },
      { key: 'cta', type: 'text', label: '행동 유도', max: 16 },
      { key: 'before_photo', type: 'image', label: '시술 전 사진', role: 'before' },
      { key: 'after_photo', type: 'image', label: '시술 후 사진', role: 'after' },
    ],
    generic: [
      { key: 'shop_name', type: 'text', label: '샵 이름', max: 24 },
      { key: 'headline', type: 'text', label: '제목', max: 20, maxLines: 2 },
      { key: 'subtitle', type: 'textarea', label: '부제', max: 60, maxLines: 2 },
      { key: 'cta', type: 'text', label: '행동 유도', max: 16 },
      { key: 'main_photo', type: 'image', label: '배경 사진', role: 'main' },
    ],
  };

  function inferTemplateKind(templateId, templateData) {
    const id = String(templateId || '');
    const d = templateData || {};
    if (/^ba-|before|after|전후|2split|3process|4grid/.test(id) || d.purpose === 'before_after' || d.cat === 'ba') return 'before_after';
    if (d.purpose === 'price' || d.cat === 'price' || /price|가격|menu|메뉴/.test(id)) return 'price';
    if (d.purpose === 'review' || /review|후기/.test(id)) return 'review';
    return 'generic';
  }

  function getSlots(templateId, templateData) {
    const kind = inferTemplateKind(templateId, templateData);
    const base = SLOTS[kind] || SLOTS.generic;
    // [WM] 템플릿별 추가 편집 슬롯(extraSlots) — 선언한 템플릿에만 append(중복 key 제외).
    //   다른 템플릿은 extraSlots 없음 → base 그대로 반환(무회귀).
    const extra = templateData && Array.isArray(templateData.extraSlots) ? templateData.extraSlots : null;
    if (!extra || !extra.length) return base;
    const have = {};
    base.forEach((s) => { have[s.key] = 1; });
    const merged = base.slice();
    extra.forEach((s) => { if (s && s.key && !have[s.key]) { have[s.key] = 1; merged.push(s); } });
    return merged;
  }

  // ── kind 별 기본값 ──────────────────────────────────────
  function _shopName(ctx) {
    if (ctx && ctx.shopName) return ctx.shopName;
    try {
      const bk = window.BrandKit && window.BrandKit.get && window.BrandKit.get();
      if (bk && bk.shopName) return bk.shopName;
    } catch (_e) { /* ignore */ }
    return '우리 살롱';
  }

  // [HF1] badge·origPrice 는 optional — v3 렌더(_drawV3Price)만 표시, 기존 렌더·edit-sheet 는 무시(무회귀).
  //   [정합성] 업종 중립 placeholder — 네일/헤어/속눈썹/피부 어디서 가격표를 열어도 '남의 업종' 시술명이
  //   채워지지 않게(예전 '물광케어/여드름케어' 는 피부 전용이라 네일샵에 어색). 사용자가 바로 교체하는 예시값.
  const PRICE_SAMPLE = [
    { name: '시그니처 메뉴', desc: '대표 인기 시술', price: '80,000원', origPrice: '100,000원', badge: 'BEST' },
    { name: '베이직 메뉴', desc: '기본 시술', price: '50,000원' },
    { name: '프리미엄 메뉴', desc: '집중 케어', price: '120,000원', origPrice: '150,000원', badge: 'EVENT' },
    { name: '데일리 메뉴', desc: '간편 시술', price: '40,000원' },
  ];

  function getDefaultValues(templateId, templateData, ctx) {
    const kind = inferTemplateKind(templateId, templateData);
    const shop = _shopName(ctx);
    const base = { shop_name: shop, cta: '예약 문의' };
    let out;
    if (kind === 'price') {
      out = Object.assign(base, {
        headline: '시술 가격표',
        subtitle: '아름다움을 위한 특별한 관리, 합리적인 가격으로 만나보세요.',
        services: PRICE_SAMPLE.map(s => Object.assign({}, s)),
        phone: (ctx && ctx.phone) || '',
      });
    } else if (kind === 'review') {
      out = Object.assign(base, {
        headline: '고객님의 진심 후기',
        subtitle: '시술 후 달라진 변화를 확인해보세요.',
        // [정합성] 업종 중립 후기 — 피부 전용 표현('피부 결/화장 잘 먹어요') 제거.
        review_text: '처음부터 끝까지 꼼꼼하게 신경 써주셔서 결과가 정말 마음에 들어요. 다음에도 또 받으러 올게요 :)',
        customer_label: (ctx && ctx.customerName) ? (ctx.customerName + ' 고객님') : '30대 / 단골 고객님',
        service_name: '',                 // [HF1] optional — v3 렌더만 작은 라벨로 표시(업종 중립 위해 기본 비움)
        date: '',                         // [HF1] optional
        cta: '상담 예약하기',
      });
    } else if (kind === 'before_after') {
      out = Object.assign(base, {
        headline: '시술 전후',
        subtitle: '한눈에 비교해보세요. 달라진 아름다움의 차이',
        before_label: 'BEFORE',
        after_label: 'AFTER',
        // [정합성] 업종 중립 캡션 — 피부 가정('칙칙한 피부 톤') 제거. BEFORE/AFTER 라벨은 위에 유지.
        before_caption: '시술 전',
        after_caption: '시술 후',
        cta: '상담 예약하기',
      });
    } else {
      // generic — 기존 렌더 무회귀: headline 은 템플릿 고유 문구 유지
      out = Object.assign(base, {
        headline: (templateData && (templateData.prefillText || templateData.label)) || '오늘의 시술',
        subtitle: '',
      });
    }
    // [BP-3] 템플릿 고유 defaultCopy 우선 — 현재 beauty 팩 엔트리만 보유(TOP5/legacy 는 defaultCopy 없음 → 무영향).
    if (templateData && templateData.defaultCopy) {
      Object.assign(out, templateData.defaultCopy);
      // [정합성] 데모 카피의 샵 이름이 실제 사용자 샵명을 덮지 않게 — 사용자 BrandKit/ctx 값이 우선.
      //   ('에끌레르 에스테틱'·'루미네일' 같은 레퍼런스 데모명이 모든 사용자 카드에 박히던 문제.)
      out.shop_name = _shopName(ctx);
    }
    return out;
  }

  // 저장값 우선 병합. slots 에 정의된 key 만 반영(이상 key 무시).
  function mergeValues(slots, savedValues) {
    const out = {};
    const saved = savedValues || {};
    (slots || []).forEach((slot) => {
      if (slot.type === 'image') return;   // imageSlots 는 별도 관리
      if (Object.prototype.hasOwnProperty.call(saved, slot.key)) out[slot.key] = saved[slot.key];
    });
    return out;
  }

  window.PhotoEditorTemplateSlots = { getSlots, getDefaultValues, mergeValues, inferTemplateKind };
})();
