/* 사진 편집기 — AI 메이크업 추천 버튼
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

  function _shopType() {
    try { return String(localStorage.getItem('shop_type') || '').toLowerCase(); }
    catch (_e) { return ''; }
  }

  // shop_type / 명령 키워드 → 레시피 라우팅.
  // 1순위 shop_type, 2순위 사용자 명령 키워드, 둘 다 없으면 natural fallback.
  function recommend(cmd) {
    const t = _shopType();
    // ── 1순위: shop_type ──
    if (/(네일|네일샵|패디|패디큐어|nail|pedi)/.test(t)) return 'nail_focus';
    if (/(헤어|붙임머리|염색|펌|두피|hair)/.test(t)) return 'hair_focus';
    if (/(속눈썹|lash)/.test(t)) return 'lash_focus';
    if (/(눈썹|brow)/.test(t)) return 'brow_focus';
    if (/(메이크업|makeup)/.test(t)) return 'glam';
    if (/(피부|skin)/.test(t)) return 'natural';
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
    if (api.helpers && api.helpers.toast) api.helpers.toast(recipe.note || ('AI 추천: ' + recipe.label));
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
    box.innerHTML = `<div class="pe-group-label" style="color:#7C3AED;font-weight:800;">AI 추천 메이크업</div>
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
