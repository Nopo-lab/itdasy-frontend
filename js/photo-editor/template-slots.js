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
    return SLOTS[kind] || SLOTS.generic;
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
  const PRICE_SAMPLE = [
    { name: '물광케어', desc: '수분 집중 케어', price: '80,000원', origPrice: '100,000원', badge: 'BEST' },
    { name: '진정관리', desc: '민감 피부 진정', price: '120,000원' },
    { name: '리프팅관리', desc: '탄력 개선 관리', price: '150,000원', origPrice: '180,000원', badge: 'EVENT' },
    { name: '여드름케어', desc: '트러블 집중 케어', price: '90,000원' },
  ];

  function getDefaultValues(templateId, templateData, ctx) {
    const kind = inferTemplateKind(templateId, templateData);
    const shop = _shopName(ctx);
    const base = { shop_name: shop, cta: '예약 문의' };
    if (kind === 'price') {
      return Object.assign(base, {
        headline: '시술 가격표',
        subtitle: '아름다움을 위한 특별한 관리, 합리적인 가격으로 만나보세요.',
        services: PRICE_SAMPLE.map(s => Object.assign({}, s)),
        phone: (ctx && ctx.phone) || '',
      });
    }
    if (kind === 'review') {
      return Object.assign(base, {
        headline: '고객님의 진심 후기',
        subtitle: '시술 후 달라진 변화를 확인해보세요.',
        review_text: '피부 결이 매끈해지고 화장이 훨씬 잘 먹어요. 꾸준히 관리받고 있어요 :)',
        customer_label: (ctx && ctx.customerName) ? (ctx.customerName + ' 고객님') : '30대 / 단골 고객님',
        service_name: '물광 피부관리',   // [HF1] optional — v3 렌더만 작은 라벨로 표시
        date: '',                         // [HF1] optional
        cta: '상담 예약하기',
      });
    }
    if (kind === 'before_after') {
      return Object.assign(base, {
        headline: '시술 전후',
        subtitle: '한눈에 비교해보세요. 달라진 아름다움의 차이',
        before_label: 'BEFORE',
        after_label: 'AFTER',
        before_caption: '칙칙한 피부 톤',
        after_caption: '맑고 균일한 피부 톤',
        cta: '상담 예약하기',
      });
    }
    // generic — 기존 렌더 무회귀: headline 은 템플릿 고유 문구 유지
    return Object.assign(base, {
      headline: (templateData && (templateData.prefillText || templateData.label)) || '오늘의 시술',
      subtitle: '',
    });
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
