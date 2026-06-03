/* 사진 편집기 — 추천 보정 버튼
   기존 뷰티 슬라이더 위에 1탭 레시피만 추가한다. */
(function () {
  'use strict';
  if (window.PhotoEditorBeautyAI) return;

  const RECIPES = {
    natural: {
      label: '내추럴',
      patch: { skin: 18, redness: 16, textureSmooth: 12, lipPop: 8, browSharp: 8 },
    },
    glam: {
      label: '글램',
      patch: { skin: 20, redness: 12, lipPop: 28, eyeColor: 22, browSharp: 24, catchLight: 16 },
    },
    lash_focus: {
      label: '속눈썹',
      patch: { lashSharp: 32, irisClear: 18, catchLight: 20, underEyeClean: 16, eyeRedness: 18 },
    },
    lip_focus: {
      label: '입술',
      patch: { lipPop: 34, skin: 14, redness: 10, yellowness: 10, textureSmooth: 8 },
    },
    brow_focus: {
      label: '눈썹',
      patch: { browSharp: 34, eyeColor: 12, skin: 12, redness: 10, closeUpDetail: 10 },
    },
    // 네일 — v348 자연스러운 광택 강화와 어울리게 "고급스럽게 반짝임" 중심.
    // 손톱 표면 위주로 정리, 피부/붉은기/텍스처는 약하게, 전체 샤픈·과밝기 없음.
    nail_focus: {
      label: '네일',
      patch: { nailGloss: 62, nailShape: 32, handSkin: 16, skin: 12, redness: 8, textureSmooth: 6 },
      note: '네일 광택과 글리터를 자연스럽게 살렸어요 — 과한 보정 없이 손톱 표면 중심으로 정리했어요',
    },
    // 헤어 — hairMask/hairBoundary 안정 가정, 모발 윤기·결감 중심. 피부 보정은 약하게.
    hair_focus: {
      label: '헤어',
      patch: { hairShine: 38, hairDetail: 35, hairVolume: 25, hairColorPop: 18, hairEndsClean: 18, skin: 10, redness: 8 },
      note: '헤어 윤기와 결감을 살렸어요 — 머리카락 디테일은 살리고 피부 보정은 과하지 않게 맞췄어요',
    },
  };

  function _shopTypeRaw() {
    try { return String(localStorage.getItem('shop_type') || ''); }
    catch (_e) { return ''; }
  }

  // shop_type → 레시피. app-core 의 itdasyNormalizeShopType(8종 cat) 활용.
  //   미용·헤어샵·두피탈모·풋케어·네일아트·extension 등 변형까지 안정 판별.
  //   헬퍼 미로드 시 raw 정규식 폴백. 속눈썹/눈썹 분리는 cat(lash) 먼저 → glam 회귀 방지.
  function _byShopType(raw) {
    const norm = (typeof window.itdasyNormalizeShopType === 'function')
      ? window.itdasyNormalizeShopType(raw) : null;
    if (norm) {
      const cat = norm.cat;
      if (cat === 'nail') return 'nail_focus';
      if (cat === 'hair' || cat === 'scalp') return 'hair_focus';
      if (cat === 'lash') return 'lash_focus';
      // makeup cat 은 메이크업+눈썹 공용 → 눈썹은 brow_focus 유지
      if (cat === 'makeup') return /(눈썹|brow)/.test(raw.toLowerCase()) ? 'brow_focus' : 'glam';
      if (cat === 'skin') return 'natural';
      // wax / general: 명시 카테고리는 없지만 raw 에 헤어/네일 단서(염색·펌 등)가 있으면 활용
      const r = raw.toLowerCase();
      if (/(염색|펌|웨이브|머릿결|머리|헤어)/.test(r)) return 'hair_focus';
      if (/(네일|손톱|젤네일)/.test(r)) return 'nail_focus';
      return null; // 단서 없음 → 키워드·fallback 으로
    }
    // 폴백: 헬퍼 미로드 (속눈썹 부분일치 방지 위해 lash 먼저)
    const t = raw.toLowerCase();
    if (/(속눈썹|lash)/.test(t)) return 'lash_focus';
    if (/(네일|패디|풋케어|nail|pedi|foot)/.test(t)) return 'nail_focus';
    if (/(헤어|미용|붙임머리|염색|펌|두피|탈모|extension|hair)/.test(t)) return 'hair_focus';
    if (/(눈썹|brow)/.test(t)) return 'brow_focus';
    if (/(메이크업|makeup)/.test(t)) return 'glam';
    if (/(피부|skin)/.test(t)) return 'natural';
    return null;
  }

  // shop_type / 명령 키워드 → 레시피 라우팅.
  // 1순위 shop_type, 2순위 사용자 명령 키워드, 둘 다 없으면 natural fallback.
  function recommend(cmd) {
    // ── 1순위: shop_type ──
    const byShop = _byShopType(_shopTypeRaw());
    if (byShop) return byShop;
    // ── 2순위: 사용자 명령 키워드 ──
    if (cmd) {
      const c = String(cmd).toLowerCase();
      if (/(네일|손톱|젤네일|글리터|프렌치|파츠|큐티클|nail)/.test(c)) return 'nail_focus';
      if (/(헤어|머리|염색|컬러|뿌리|윤기|볼륨|웨이브|붙임머리|hair)/.test(c)) return 'hair_focus';
    }
    // ── 3순위: natural fallback ──
    return 'natural';
  }

  function _api() {
    return window.PhotoEditor && window.PhotoEditor._internal;
  }

  function _applyInputs(panel, patch) {
    Object.keys(patch).forEach(key => {
      const input = panel.querySelector(`[data-pe-slider="${key}"]`);
      const out = panel.querySelector(`[data-pe-slider-val="${key}"]`);
      if (input) input.value = patch[key];
      if (out) out.textContent = patch[key];
    });
  }

  function apply(recipeId) {
    const api = _api();
    const state = api && api.getState && api.getState();
    const recipe = RECIPES[recipeId] || RECIPES[recommend()];
    if (!state || !recipe) return false;
    state.beauty = Object.assign({}, state.beauty || {}, recipe.patch);
    const panel = document.getElementById('pePanel');
    if (panel) _applyInputs(panel, recipe.patch);
    api.helpers && api.helpers.scheduleRedraw && api.helpers.scheduleRedraw();
    api.helpers && api.helpers.pushHistory && api.helpers.pushHistory();
    if (api.helpers && api.helpers.toast) api.helpers.toast(recipe.note || ('추천 보정: ' + recipe.label));
    return true;
  }

  function _chip(id, recipe, on) {
    return `<button type="button" data-beauty-ai="${id}" class="pe-chip-btn${on ? ' on' : ''}" style="white-space:nowrap;">${recipe.label}</button>`;
  }

  function _inject(panel) {
    if (!panel || panel.querySelector('[data-beauty-ai-wrap]')) return;
    const selected = recommend();
    const html = Object.keys(RECIPES).map(id => _chip(id, RECIPES[id], id === selected)).join('');
    const box = document.createElement('div');
    box.dataset.beautyAiWrap = '1';
    box.innerHTML = `<div class="pe-group-label" style="color:#7C3AED;font-weight:800;">추천 보정</div>
      <div style="display:flex;gap:6px;overflow-x:auto;margin:6px 0 10px;">${html}</div>`;
    panel.insertBefore(box, panel.firstChild);
    box.addEventListener('click', e => {
      const id = e.target.closest('[data-beauty-ai]')?.dataset.beautyAi;
      if (id) apply(id);
    });
  }

  function _watch() {
    const panel = document.getElementById('pePanel');
    const api = _api();
    const state = api && api.getState && api.getState();
    if (panel && state && state.activeTab === 'beauty') _inject(panel);
  }

  const observer = new MutationObserver(_watch);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.PhotoEditorBeautyAI = { RECIPES, recommend, apply };
})();
