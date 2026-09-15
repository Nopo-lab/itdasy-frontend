'use strict';

/*
 * 원장 스타일 학습 실사용자형 QA (2026-09-15)
 *
 * 임의 인스타 계정을 무단으로 긁지 않고, 서버 Vision/InstagramTextStyle 이 저장하는
 * 실제 프로필 모양 그대로 여러 원장을 만든다. 여기서 보고 싶은 건 "예쁘냐"보다 더 위험한 것:
 *   - 한 원장의 피드 습관이 다른 원장에게 새지 않는가
 *   - 인스타 관찰값은 cold-start 에만 쓰이고, 앱 안에서 원장이 직접 고친 값이 항상 이기는가
 *   - 글자를 안 쓰는 원장을 억지로 글자 많은 원장으로 만들지 않는가
 *   - 업종/피드 성향이 달라도 반복된 축만 채택하고 갈린 축은 비워두는가
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const igSrc = fs.readFileSync(path.join(ROOT, 'js/photo/instagram-text-style.js'), 'utf8');
const baseSrc = fs.readFileSync(path.join(ROOT, 'js/photo/shop-baseline.js'), 'utf8');

function mem(init = {}) {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    _map: m
  };
}

function boot(store, prefsByTenant = {}) {
  const win = {
    localStorage: store,
    BrandKit: { get: () => ({ brand_color: '#D58A95', watermark_text: '' }) },
    ShopStyleCandidate: { get: () => null },
    CategoryPrior: {
      get: () => ({ confidence: 0.42, typography: { align: 'center', sizeRatio: 0.07 },
        textZone: ['lower-center'], subjectZoneHint: ['center'] }),
      generic: () => ({ confidence: 0.3, typography: { align: 'center', sizeRatio: 0.07 },
        textZone: ['lower-center'], subjectZoneHint: ['center'] })
    },
    WMPrefs: {
      resolve: (feature) => Promise.resolve((prefsByTenant[store.getItem('last_user_id')] || {})[feature] || null),
      list: () => Promise.resolve(Object.values(prefsByTenant[store.getItem('last_user_id')] || {}).filter(Boolean))
    }
  };
  new Function('window', 'localStorage', igSrc)(win, store);
  new Function('window', 'localStorage', baseSrc)(win, store);
  return win;
}

function loadIG() {
  const win = {};
  new Function('window', igSrc)(win);
  return win.InstagramTextStyle;
}

const IG = loadIG();

const block = (o = {}) => Object.assign({ text: '예약 문의 DM', alignment: 'left', position: 'lower-left',
  color: '#FFFFFF', font_family_class: 'sans', font_weight: 'bold', size_ratio: 0.08, confidence: 0.84 }, o);
const post = (blocks, o = {}) => Object.assign({ text_blocks: blocks, composition: 'text_overlay',
  is_ui_screenshot: false, confidence: 0.86, engine: 'gemini' }, o);
const grid = () => post([], { composition: 'collage', is_ui_screenshot: false });

function repeated(n, make) { return Array.from({ length: n }, (_, i) => make(i)); }
function pref(feature, value, confidence = 0.9) {
  return { feature, value, confidence, sampleCount: 12, positive: 24, negative: 0,
    decayedPositive: 24, decayedNegative: 0 };
}

const CTX_NAIL = { category: 'nail', service: '젤네일', photoCount: 1, kind: 'service', hasBeforeAfter: false };

function buildProfiles() {
  return {
    nailSoft: IG._aggregate([
      ...repeated(6, () => post([block({ alignment: 'left', position: 'lower-left', color: '#FFFFFF', size_ratio: 0.08 })])),
      grid()
    ]),
    lashQuiet: IG._aggregate(repeated(6, () => post([]))),
    hairDark: IG._aggregate(repeated(6, () => post([block({ alignment: 'right', position: 'upper-right',
      color: '#15181D', font_family_class: 'serif', size_ratio: 0.06 })]))),
    waxingMixed: IG._aggregate([
      ...repeated(3, () => post([block({ alignment: 'left', position: 'lower-left', color: '#111111' })])),
      ...repeated(3, () => post([block({ alignment: 'center', position: 'lower-left', color: '#111111' })]))
    ])
  };
}

describe('원장 스타일 학습 — 여러 인스타 피드처럼 넣어 보는 QA', () => {
  test('네일 원장: 반복된 글자 습관만 잡고 UI 격자 캡처는 버린다', () => {
    const p = buildProfiles().nailSoft;
    expect(p.source).toBe('instagram_observed');
    expect(p.counts.genuine).toBe(6);
    expect(p.counts.clearUi).toBe(1);
    expect(p.axes.align.value).toBe('left');
    expect(p.axes.position.value).toBe('lower-left');
    expect(p.axes.color.value).toBe('#FFFFFF');
    expect(p.axes.sizeRatio.value).toBeCloseTo(0.08, 5);
  });

  test('속눈썹 원장: 글자를 거의 안 쓰는 것도 습관으로 남긴다', () => {
    const p = buildProfiles().lashQuiet;
    expect(p.enough).toBe(true);
    expect(p.textUsage.value).toBe(0);
    ['align', 'position', 'fontClass', 'fontWeight', 'color', 'sizeRatio'].forEach((k) => {
      expect(p.axes[k]).toBeNull();
    });
  });

  test('왁싱/피부 원장: 축이 반반 갈리면 억지로 하나를 고르지 않는다', () => {
    const p = buildProfiles().waxingMixed;
    expect(p.axes.align).toBeNull();
    expect(p.axes.position.value).toBe('lower-left');
    expect(p.axes.color.value).toBe('#111111');
  });

  test('같은 브라우저 저장소에서도 원장별 인스타 관찰값은 섞이지 않는다', async () => {
    const profiles = buildProfiles();
    const store = mem({ last_user_id: 'owner-nail' });
    store.setItem('itdasy:ig_text_style::owner-nail', JSON.stringify(profiles.nailSoft));
    store.setItem('itdasy:ig_text_style::owner-hair', JSON.stringify(profiles.hairDark));
    const win = boot(store);

    const nail = await win.ShopBaseline.resolve(CTX_NAIL);
    expect(nail.axes.align).toMatchObject({ value: 'left', source: 'instagram_observed' });
    expect(nail.axes.color).toMatchObject({ value: '#FFFFFF', source: 'instagram_observed' });

    store.setItem('last_user_id', 'owner-hair');
    const hair = await win.ShopBaseline.resolve(Object.assign({}, CTX_NAIL, { category: 'hair', service: '헤어' }));
    expect(hair.axes.align).toMatchObject({ value: 'right', source: 'instagram_observed' });
    expect(hair.axes.color).toMatchObject({ value: '#15181D', source: 'instagram_observed' });
  });

  test('앱 안에서 원장이 직접 고친 값은 인스타 관찰값보다 항상 이긴다', async () => {
    const profiles = buildProfiles();
    const store = mem({ last_user_id: 'owner-nail' });
    store.setItem('itdasy:ig_text_style::owner-nail', JSON.stringify(profiles.nailSoft));
    const win = boot(store, {
      'owner-nail': {
        color: pref('color', '#BC6675'),
        align: pref('align', 'center')
      }
    });

    const out = await win.ShopBaseline.resolve(CTX_NAIL);
    expect(out.axes.color).toMatchObject({ value: '#BC6675', source: 'editor_observed' });
    expect(out.axes.align).toMatchObject({ value: 'center', source: 'editor_observed' });
    expect(out.axes.textZone).toMatchObject({ value: ['lower-left'], source: 'instagram_observed' });
  });

  test('원장이 브랜드색을 명시 저장하면 인스타/편집기보다 브랜드색이 이긴다', async () => {
    const profiles = buildProfiles();
    const store = mem({ last_user_id: 'owner-nail', itdasy_brand_kit: JSON.stringify({ brand_color: '#2A211F' }) });
    store.setItem('itdasy:ig_text_style::owner-nail', JSON.stringify(profiles.nailSoft));
    const win = boot(store, { 'owner-nail': { color: pref('color', '#BC6675') } });
    win.BrandKit.get = () => ({ brand_color: '#2A211F', watermark_text: '' });

    const out = await win.ShopBaseline.resolve(CTX_NAIL);
    expect(out.axes.color).toMatchObject({ value: '#2A211F', source: 'explicit_brandkit', confidence: 1 });
  });
});
