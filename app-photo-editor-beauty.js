/* 사진 편집기 — 뷰티 모듈 */
(function () {
  'use strict';

  // ── 슬라이더 정의 (key → meta) ──
  const SLIDERS = {
    // 얼굴·피부
    skin:          { label: '피부톤 정리',     group: 'face', min: 0,   max: 100, step: 1 },
    redness:       { label: '붉은기 완화',     group: 'face', min: 0,   max: 100, step: 1 },
    blemish:       { label: '잡티 완화',       group: 'face', min: 0,   max: 100, step: 1 },
    eyeShadow:     { label: '눈가 그림자',     group: 'face', min: 0,   max: 100, step: 1 },
    textureSmooth: { label: '결 정리 (자연)',  group: 'face', min: 0,   max: 100, step: 1 },
    yellowness:    { label: '노란기 완화',     group: 'face', min: 0,   max: 100, step: 1 },
    // 메이크업 (v192 신규)
    lipPop:        { label: '입술 발색',       group: 'face', min: 0,   max: 100, step: 1 },
    eyeColor:      { label: '아이 색감',       group: 'face', min: 0,   max: 100, step: 1 },
    browSharp:     { label: '선명도 (눈썹 포함)', group: 'face', min: 0,   max: 100, step: 1 },
    // 손·네일
    handSkin:      { label: '손/발 피부톤',    group: 'hand', min: 0,   max: 100, step: 1 },
    nailGloss:     { label: '네일 광택',       group: 'hand', min: 0,   max: 100, step: 1 },
    coolness:      { label: '푸른기 완화 (손)', group: 'hand', min: 0,   max: 100, step: 1 },
    nailShape:     { label: '네일 경계 선명',  group: 'hand', min: 0,   max: 100, step: 1 },
    // 모발
    hairShine:     { label: '모발 윤기',       group: 'hair', min: 0,   max: 100, step: 1 },
    hairVolume:    { label: '모발 볼륨감 보정', group: 'hair', min: 0,   max: 100, step: 1 },   // [v574] 입체감+숱 풍성감 통합
    hairEndsClean: { label: '머리끝·잔머리 정돈',   group: 'hair', min: 0,   max: 100, step: 1 },
    hairColor:     { label: '모발 색감 (- 차가운 / + 따뜻)', group: 'hair', min: -50, max: 50, step: 1 },
    hairDetail:    { label: '머리결 선명도 (전체)', group: 'hair', min: 0,   max: 100, step: 1 },
    hairColorPop:  { label: '염색 컬러 강조',  group: 'hair', min: 0,   max: 100, step: 1 },
    scalpBoost:    { label: '두피 톤 보정',    group: 'hair', min: 0,   max: 100, step: 1 },
    hairyArm:      { label: '팔/다리 톤 보정', group: 'face', min: 0, max: 100, step: 1 },
    // 속눈썹
    eyeRedness:    { label: '눈 붉음 완화',     group: 'lash', min: 0,   max: 100, step: 1 },
    irisClear:     { label: '눈동자 또렷',      group: 'lash', min: 0,   max: 100, step: 1 },
    catchLight:    { label: '눈빛 반짝임',      group: 'lash', min: 0,   max: 100, step: 1 },
    underEyeClean: { label: '눈밑 칙칙함',      group: 'lash', min: 0,   max: 100, step: 1 },
    lashSharp:     { label: '속눈썹 선명도',   group: 'lash', min: 0,   max: 100, step: 1 },
    closeUpDetail: { label: '전체 선명도 (클로즈업)', group: 'lash', min: 0,   max: 100, step: 1 },
  };

  // shop_type → 추천 보정 슬라이더 우선순위. v192 신규 3 카테고리 (makeup/scalp/general).
  const SHOP_FEATURED = {
    hair:    ['hairVolume', 'hairEndsClean', 'hairShine', 'hairDetail', 'hairColorPop', 'hairColor'],
    scalp:   ['scalpBoost', 'hairVolume', 'hairShine', 'hairDetail', 'skin', 'redness'],
    makeup:  ['skin', 'redness', 'lipPop', 'eyeColor', 'browSharp', 'yellowness'],
    lash:    ['eyeRedness', 'irisClear', 'catchLight', 'lashSharp', 'underEyeClean', 'closeUpDetail'],
    nail:    ['nailGloss', 'handSkin', 'coolness', 'nailShape', 'yellowness', 'redness'],
    wax:     ['skin', 'redness', 'blemish', 'textureSmooth', 'eyeShadow', 'hairyArm'],
    skin:    ['skin', 'redness', 'blemish', 'textureSmooth', 'eyeShadow'],
    general: ['skin', 'redness', 'blemish', 'textureSmooth'],
  };

  // [PR-4b] 부위 소분류 — 샵분기(헤어/네일추천) 대신 부위로. 슬라이더는 해당 region.keys 에만 배치(코 없음).
  const REGIONS = [
    { id: 'eye',  label: '눈',      keys: ['eyeRedness', 'irisClear', 'catchLight', 'underEyeClean', 'lashSharp', 'eyeColor', 'eyeShadow'] },
    { id: 'brow', label: '눈썹',    keys: ['browSharp'] },
    { id: 'lip',  label: '입',      keys: ['lipPop'] },
    { id: 'skin', label: '피부',    keys: ['skin', 'redness', 'blemish', 'textureSmooth', 'yellowness'] },
    { id: 'hair', label: '헤어',    keys: ['hairDetail', 'hairVolume', 'hairShine', 'hairEndsClean', 'hairColor', 'hairColorPop', 'scalpBoost'] },
    { id: 'hand', label: '손·네일', keys: ['handSkin', 'nailGloss', 'coolness', 'nailShape'] },
  ];
  const REGION_ETC_KEYS = ['hairyArm', 'closeUpDetail'];   // 기타/고급(부위 밖)
  // 샵 종류 → 기본 진입 부위 힌트(추천 메뉴 아님, 첫 선택만).
  const SHOPCAT_TO_REGION = { hair: 'hair', scalp: 'hair', lash: 'eye', makeup: 'skin', nail: 'hand', wax: 'skin', skin: 'skin', general: 'skin' };
  function _defaultRegion() { return SHOPCAT_TO_REGION[_detectShopCat() || 'general'] || 'skin'; }

  const AI_FEATURES = {
    hair:   ['컬·웨이브 또렷하게', '잔머리 정리', '모발 입체감 강화', '두피·정수리 휑함 완화', '붙임머리 결합부 자연스럽게'],
    scalp:  ['두피 휑함 자연 보완', '잔모 강조', '모발 입체감 보정'],
    makeup: ['추천 보정', '발색 자연 보강', '얼굴 부위 자동 마스크'],
    lash:   ['빈 부분 자연스럽게 보완', '연장 결합부 정리'],
    nail:   ['큐티클·주변부 정리', '컬러 정확도 보정', '배경 깔끔화'],
    wax:    ['부위 강조 자동', '결 자연 보정 (강도)'],
    skin:   ['자극 부위 자연 복원', '잡티 완화 보강'],
    general: ['추천 보정 보강'],
  };
  const BEAUTY_LOOKS = [
    { id: 'classic', label: '클래식 모드', cat: 'general', icon: '◉', patch: { skin: 16, redness: 18, textureSmooth: 12 } },
    { id: 'soft-clean', label: '결 정리', cat: 'skin', icon: '✦', patch: { skin: 24, blemish: 26, textureSmooth: 20, eyeShadow: 12 } },
    { id: 'proof', label: '컨셉 화보', cat: 'makeup', icon: '▣', patch: { skin: 18, lipPop: 20, eyeColor: 14, browSharp: 18, catchLight: 16 } },
    { id: 'natural-light', label: '자연광', cat: 'general', icon: '▢', patch: { skin: 10, redness: 14, textureSmooth: 6 } },
    { id: 'clear-detail', label: '또렷한 결', cat: 'hair', icon: '◎', patch: { hairDetail: 28, hairShine: 26, closeUpDetail: 18 } },
    { id: 'film-soft', label: '필름톤', cat: 'general', icon: '◌', patch: { skin: 10, redness: 10, lipPop: 12 } },
    { id: 'hair', label: '헤어 컬러', cat: 'hair', icon: '⌁', patch: { hairShine: 48, hairDetail: 34, hairColorPop: 30, hairVolume: 18 } },
    { id: 'lash', label: '속눈썹', cat: 'lash', icon: '⌕', patch: { lashSharp: 52, irisClear: 30, catchLight: 26, underEyeClean: 18 } },
    { id: 'nail', label: '네일', cat: 'nail', icon: '◧', patch: { nailGloss: 58, nailShape: 40, handSkin: 18, coolness: 18 } },
    { id: 'glow', label: '글로우 보정', cat: 'skin', icon: '✧', patch: { skin: 24, redness: 22, blemish: 18, catchLight: 26 } },
  ];
  const BEAUTY_FOCUS = [
    { id: 'general', label: 'Hot🔥' },
    { id: 'hair', label: '헤어' },
    { id: 'skin', label: '피부' },
    { id: 'lash', label: '속눈썹' },
    { id: 'nail', label: '네일' },
    { id: 'makeup', label: '메이크업' },
  ];

  // [v192] 정규화 헬퍼 (app-core.js itdasyNormalizeShopType) 활용. 없으면 폴백 분기.
  function _detectShopCat() {
    try {
      if (typeof window.itdasyNormalizeShopType === 'function') {
        const r = window.itdasyNormalizeShopType(localStorage.getItem('shop_type') || '');
        return r.cat;  // 'hair' | 'scalp' | 'makeup' | 'lash' | 'nail' | 'wax' | 'skin' | 'general'
      }
      const t = (localStorage.getItem('shop_type') || '').toLowerCase();
      if (!t) return null;
      if (/(두피|탈모|scalp)/.test(t)) return 'scalp';
      if (/(헤어|붙임머리|미용|hair|extension)/.test(t)) return 'hair';
      if (/(속눈썹|lash)/.test(t)) return 'lash';
      if (/(메이크업|눈썹|makeup|brow)/.test(t)) return 'makeup';
      if (/(네일|nail|패디|풋케어|pedi|foot)/.test(t)) return 'nail';
      if (/(왁싱|바디|wax|body)/.test(t)) return 'wax';
      if (/(피부|반영구|문신|skin|tattoo)/.test(t)) return 'skin';
    } catch (_e) { void _e; }
    return 'general';
  }

  function _slider(esc, key, val) {
    const m = SLIDERS[key];
    return `
      <label class="pe-slider">
        <div class="pe-slider-head">
          <span>${esc(m.label)}</span>
          <span class="pe-slider-val" data-pe-slider-val="${key}">${val}</span>
        </div>
        <input type="range" min="${m.min}" max="${m.max}" step="${m.step}" value="${val}" data-pe-slider="${key}" />
      </label>
    `;
  }

  function _groupedHTML(esc, keys, b) {
    const GROUPS = { face: '얼굴 · 피부', hand: '손 · 네일', hair: '모발', lash: '속눈썹' };
    let html = '';
    Object.keys(GROUPS).forEach(g => {
      const gk = keys.filter(k => SLIDERS[k] && SLIDERS[k].group === g);
      if (!gk.length) return;
      html += `<div class="pe-group-label">${GROUPS[g]}</div>`;
      html += gk.map(k => _slider(esc, k, b[k])).join('');
    });
    return html;
  }

  function _panelBeautyHTML(state) {
    const DEF = Object.keys(SLIDERS).reduce((a, k) => { a[k] = 0; return a; }, {});
    const b = Object.assign({}, DEF, state.beauty || {});
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, ch =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
    // [PR-4b] 보정 진입 = 부위 소분류 단일 흐름. 샵분기(beautyFocus/SHOP_FEATURED) 칩 제거.
    const region = state.beautyRegion || _defaultRegion();
    const reg = REGIONS.find(r => r.id === region) || REGIONS[0];

    // [PR-4b] 룩 그리드(클래식/글램/헤어컬러/네일 프리셋)는 기본 노출 제거 — 목표 UX = 추천 카드 1개 + 부위보정.
    //   _beautyQuickHTML/_applyBeautyLook 함수는 보존(기능 삭제 아님), 렌더만 제외.
    // PE-AI-1A — 부위 기반 추천 카드 (온디바이스, 슬라이더 위 = 잇비 추천 1개). 모듈 없으면 빈 문자열.
    const recoHtml = (window.PhotoEditorRecoCards && typeof window.PhotoEditorRecoCards.html === 'function')
      ? window.PhotoEditorRecoCards.html(state) : '';

    // [PR-4b] 부위 칩: 눈/눈썹/입/피부/헤어/손·네일. 선택 부위 슬라이더만 표시.
    const regionChips = `<div class="pe-beauty-focus" role="tablist">${REGIONS.map(r =>
      `<button type="button" class="${reg.id === r.id ? 'on' : ''}" data-pe-beauty-region="${r.id}">${esc(r.label)}</button>`
    ).join('')}</div>`;
    const regionSliders = reg.keys.map(k => _slider(esc, k, b[k])).join('');

    // [v536] 부위 보정 탭에도 '정밀 마스크 상태'를 노출(접힘 기본) — 정밀(AI)인지 일반 보정(휴리스틱)인지
    //   사용자가 알 수 있게. 무작정 적용되는 인상 제거. 상세 카드는 기존 MaskStatusUI 재사용.
    const maskStatus = (window.MaskStatusUI && typeof window.MaskStatusUI.html === 'function')
      ? `<details class="pe-beauty-maskstatus" style="margin:2px 0 10px;border:1px solid #F1DFE3;border-radius:12px;padding:2px 10px;background:#FFFCFD;">
           <summary style="cursor:pointer;font-size:12.5px;font-weight:700;color:#BC6675;padding:8px 0;list-style:none;">정밀 인식 상태 보기 · 어떻게 적용되는지</summary>
           ${window.MaskStatusUI.html(state)}
         </details>` : '';

    // 세부 조정(고급) — 부위 밖 기타(전체 선명도/팔다리 톤). 기본 접힘.
    const advBody = REGION_ETC_KEYS.map(k => _slider(esc, k, b[k])).join('');
    const advHtml = `<button type="button" data-pe-beauty-adv="1" class="pe-beauty-adv-toggle" aria-expanded="false"
            style="margin:14px 0 4px;width:100%;padding:11px;background:rgba(0,0,0,0.04);color:#4E5968;border:1px solid #E5E8EB;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">세부 조정 (고급) ▾</button>
         <div id="peBeautyAdv" hidden>${advBody}</div>`;
    return `${recoHtml}${maskStatus}${regionChips}${regionSliders}${advHtml}<div class="pe-hint">시술 왜곡 없이 자연 보정 위주로 동작해요. 슬라이더는 손 떼는 순간 반영됩니다.</div>`;
  }

  function _beautyQuickHTML(esc, cat) {
    return `<div class="pe-beauty-hero">
      <div>
        <div class="pe-beauty-hero-kicker">살롱 사진 빠른 보정</div>
        <strong>원하는 느낌을 먼저 고르세요</strong>
        <p>선택 후 아래 슬라이더로 세기만 살짝 조절</p>
      </div>
    </div>
    <div class="pe-beauty-look-grid">${_beautyLooksFor(cat).map(item => `
      <button type="button" class="pe-beauty-look" data-pe-beauty-look="${item.id}">
        <span>${esc(item.icon)}</span>
        <b>${esc(item.label)}</b>
      </button>
    `).join('')}</div>`;
  }

  function _beautyLooksFor(cat) {
    return BEAUTY_LOOKS
      .filter(item => cat === 'general' || item.cat === cat || item.cat === 'general')
      .slice(0, 8);
  }

  // v343 — fast preview 활성 여부 (PE_FAST_PREVIEW_DISABLE='1' → v342 방식 풀해상도 즉시)
  function _fastPreviewOn() {
    try { return !(window.localStorage && localStorage.getItem('PE_FAST_PREVIEW_DISABLE') === '1'); }
    catch (_e) { return true; }
  }

  function _bindBeautyPanel(panel, state, helpers) {
    const scheduleRedraw = helpers.scheduleRedraw;
    const pushHistory = helpers.pushHistory;
    // [v536] 정밀 마스크 상태 카드(접힘) 새로고침 버튼 바인드.
    if (window.MaskStatusUI && typeof window.MaskStatusUI.bind === 'function') {
      try { window.MaskStatusUI.bind(panel, state, helpers); } catch (_e) { try { console.warn('[PhotoEditor:Mask] status bind 실패:', _e && _e.message); } catch (_l) { void _l; } }
    }
    _bindBeautyQuick(panel, state, helpers);
    // PE-AI-1A — 부위 기반 추천 카드 바인드 (적용은 아래 슬라이더 경로와 동일).
    if (window.PhotoEditorRecoCards && typeof window.PhotoEditorRecoCards.bind === 'function') {
      try { window.PhotoEditorRecoCards.bind(panel, state, helpers); } catch (_e) { void _e; }
    }
    panel.querySelectorAll('[data-pe-slider]').forEach(inp => {
      inp.addEventListener('input', () => {
        const key = inp.dataset.peSlider;
        const v = +inp.value;
        if (state.beauty[key] === v) return;   // 같은 값 → redraw 중복 방지 (렉 완화)
        state.beauty[key] = v;
        const out = panel.querySelector(`[data-pe-slider-val="${key}"]`);
        if (out) out.textContent = inp.value;
        if (window.__ITDASY_PHOTO_DEBUG__) {   // [v537] per-slider trace (debug only)
          try { console.log(`[photofx] ${key} value=${v} norm=${(v / (SLIDERS[key] ? SLIDERS[key].max : 100)).toFixed(2)} region=${state.beautyRegion || '-'}`); } catch (_e) { void _e; }
        }
        scheduleRedraw(_fastPreviewOn());   // v343 — 드래그 중 저해상도 preview (플래그 OFF 면 full)
      });
      // v343 — 손 뗄 때 풀해상도 final 1회 (+히스토리). pointerup/touchend 는 final redraw 만(coalesced).
      inp.addEventListener('change', () => { scheduleRedraw(); pushHistory(); });
      inp.addEventListener('pointerup', () => scheduleRedraw());
      inp.addEventListener('touchend', () => scheduleRedraw());
      // [v202 2026-05-18] 더블탭 reset (S1-2)
      inp.addEventListener('dblclick', () => {
        const key = inp.dataset.peSlider;
        state.beauty[key] = 0;
        inp.value = 0;
        const out = panel.querySelector(`[data-pe-slider-val="${key}"]`);
        if (out) out.textContent = 0;
        scheduleRedraw(); pushHistory();
        if (helpers && helpers.toast) helpers.toast('초기화: ' + (SLIDERS[key] ? SLIDERS[key].label : key));
      });
    });
    // 전체 보정 보기 토글
    const toggleBtn = panel.querySelector('[data-pe-beauty-toggle]');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const more = panel.querySelector('#peBeautyMore');
        if (!more) return;
        if (more.hidden) {
          more.hidden = false;
          toggleBtn.textContent = '－ 추천 보정만 보기';
        } else {
          more.hidden = true;
          toggleBtn.textContent = '＋ 전체 보정 보기';
        }
      });
    }
    // [PR3a] 세부 조정(고급) 접힘 토글 — featured+more 슬라이더 전체를 감싼 영역. 기존 peBeautyMore 와 독립.
    const advBtn = panel.querySelector('[data-pe-beauty-adv]');
    if (advBtn) {
      advBtn.addEventListener('click', () => {
        const adv = panel.querySelector('#peBeautyAdv');
        if (!adv) return;
        adv.hidden = !adv.hidden;
        advBtn.setAttribute('aria-expanded', adv.hidden ? 'false' : 'true');
        advBtn.textContent = adv.hidden ? '세부 조정 (고급) ▾' : '세부 조정 닫기 ▴';
        if (!adv.hidden) _focusFirstSlider(panel);   // 펼칠 때만 첫 슬라이더로 스크롤
      });
    }
    // AI 준비 중 클릭 → 토스트
    panel.querySelectorAll('[data-pe-ai-coming]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (window.showToast) window.showToast('AI 보정은 카드 발급 후 활성화 예정이에요');
      });
    });
    // T-117 — 패널 진입/카테고리 전환 직후 첫 슬라이더가 화면 안에 들어오게 자동 스크롤
    _focusFirstSlider(panel);
  }

  // T-117 — 추천 보정 라벨(또는 첫 슬라이더)을 패널 가시영역 상단 근처로.
  //   패널 내부 스크롤만 이동(window/페이지 점프 없음). 앵커를 패널 상단 10px
  //   지점으로 맞추되, 레이아웃 안정화 타이밍 차로 생기는 over/under-shoot 를
  //   몇 프레임에 걸쳐 양방향 보정해 수렴시킨다. 콘텐츠가 다 보이면 scrollTop
  //   이 0 으로 클램프되어 no-op → 회귀 위험 없음.
  //   ⚠️ html 이 scroll-behavior:smooth 라 panel.scrollTop= 도 애니메이션이 걸려
  //      rAF 보정 루프와 충돌(읽는 값이 애니메이션 중간값) → 일시적으로 auto 로
  //      우회해 즉시 이동시킨다.
  function _focusFirstSlider(panel) {
    if (!panel) return;
    let tries = 0;
    const adjust = () => {
      // 첫 번째 "보이는" 슬라이더 기준(상단의 AI 추천/hero/칩 라벨은 앵커로 쓰지 않는다).
      const sliders = panel.querySelectorAll('.pe-slider');
      let firstSlider = null;
      for (let i = 0; i < sliders.length; i++) {
        if (sliders[i].offsetParent !== null) { firstSlider = sliders[i]; break; }
      }
      if (!firstSlider) return;
      // 슬라이더 바로 위 그룹 라벨이 있으면 그 라벨까지 보이게 라벨을 앵커로.
      let anchor = firstSlider;
      const prev = firstSlider.previousElementSibling;
      if (prev && prev.classList && prev.classList.contains('pe-group-label')) anchor = prev;
      try {
        const cTop = panel.getBoundingClientRect().top;
        const aTop = anchor.getBoundingClientRect().top;
        const delta = (aTop - cTop) - 10;   // 앵커가 패널 상단 10px 아래에 오도록
        if (Math.abs(delta) > 4) {
          const prevSB = panel.style.scrollBehavior;
          panel.style.scrollBehavior = 'auto';   // smooth 우회 → 즉시 이동
          panel.scrollTop = Math.max(0, panel.scrollTop + delta);
          panel.style.scrollBehavior = prevSB || '';
        }
      } catch (_e) { void _e; }
      if (++tries < 3) requestAnimationFrame(adjust);
    };
    requestAnimationFrame(adjust);
  }

  function _bindBeautyQuick(panel, state, helpers) {
    // [PR-4b] 부위 칩 — 선택 부위만 슬라이더 표시. 재렌더는 기존 renderPanel 경로 재사용.
    panel.querySelectorAll('[data-pe-beauty-region]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.beautyRegion = btn.dataset.peBeautyRegion;
        helpers.renderPanel();
      });
    });
    // (구) 샵분기 focus 칩 — 잔존 시 호환(현재 미렌더)
    panel.querySelectorAll('[data-pe-beauty-focus]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.beautyFocus = btn.dataset.peBeautyFocus;
        helpers.renderPanel();
      });
    });
    panel.querySelectorAll('[data-pe-beauty-look]').forEach(btn => {
      btn.addEventListener('click', () => _applyBeautyLook(btn.dataset.peBeautyLook, state, helpers));
    });
  }

  function _applyBeautyLook(id, state, helpers) {
    const look = BEAUTY_LOOKS.find(item => item.id === id);
    if (!look) return;
    Object.assign(state.beauty, look.patch);
    if (look.cat && look.cat !== 'general') state.beautyFocus = look.cat;
    helpers.renderPanel();
    helpers.scheduleRedraw();
    helpers.pushHistory();
    if (helpers.toast) helpers.toast(look.label + ' 적용');
  }

  // 마스크 워밍 — 일반 마스크와 손·네일 필수 마스크를 비동기로 준비한 뒤 1회 다시 그린다.
  // 손·네일 검출 실패는 MaskStrictPolicy가 안내하고 엔진은 보정을 실행하지 않는다.
  function _warmMasks(img, beauty) {
    const policy = window.MaskStrictPolicy;
    if (!policy || typeof policy.warm !== 'function') return;
    policy.warm(img, beauty, () => {
      const PE = window.PhotoEditor;
      if (PE && PE._internal && typeof PE._internal.scheduleRedraw === 'function') PE._internal.scheduleRedraw(false);
    });
  }

  // ── 뷰티 보정 (픽셀 처리는 beauty-engine.js 담당) ──
  function _applyBeauty(ctx, w, h, b) {
    const engine = window.PhotoEditorBeautyEngine;
    if (!engine || typeof engine.apply !== 'function') return;
    let skinSmoothed = false;
    const txK = (b.textureSmooth || 0) / 100;
    const blemK = (b.blemish || 0) / 100;
    const smoothStr = Math.max(txK, blemK);
    if (smoothStr > 0) {
      const bilateral = window.PhotoEditorGLBilateral;
      if (bilateral && typeof bilateral.apply === 'function') {
        try {
          const result = bilateral.apply(ctx.canvas, smoothStr, _skinMaskCanvas(ctx.canvas));
          if (result) { ctx.drawImage(result, 0, 0); skinSmoothed = true; }
        } catch (_e) { void _e; }
      }
    }
    // v316 — RegionMask 우선 (sync 캐시 hit 만). 미캐시/비활성/conf<0.4 → null → v312 휴리스틱 fallback.
    let regionMasks = null;
    try {
      const MA = window.MaskApplication;
      const PE = window.PhotoEditor;
      const st = PE && PE._internal && PE._internal.getState ? PE._internal.getState() : null;
      const img = st && st.originalImg;
      _warmMasks(img, b);   // 마스크 미준비 시 비동기 계산 + 1회 재렌더(이미지당 1회)
      if (MA && typeof MA.getMasksForBeautySync === 'function' && img) {
        regionMasks = MA.getMasksForBeautySync(img);
      }
      // v317 — 속눈썹: lashSharp 사용 시에만 eyelashBandMask 페치 (conf≥0.4면 밴드만 샤픈, 아니면 전역 unsharp)
      if ((b.lashSharp || 0) > 10 && MA && typeof MA.getLashMaskSync === 'function' && img) {
        const lash = MA.getLashMaskSync(img);
        if (lash) {
          if (!regionMasks) regionMasks = { useMasks: {}, _scale: {}, maskW: (img.naturalWidth || img.width) | 0, maskH: (img.naturalHeight || img.height) | 0 };
          regionMasks.lashMask = lash.mask;
          regionMasks.lashScale = lash.scale;
        }
      }
      // v550 — 네일: 실제 nailMask가 있을 때만 보정한다.
      if (((b.nailGloss || 0) > 0 || (b.nailShape || 0) > 10 || (window.PhotoEditorCuticle && window.PhotoEditorCuticle.active())) && MA && typeof MA.getNailMaskSync === 'function' && img) {
        const nail = MA.getNailMaskSync(img);
        if (nail) {
          if (!regionMasks) regionMasks = { useMasks: {}, _scale: {}, maskW: (img.naturalWidth || img.width) | 0, maskH: (img.naturalHeight || img.height) | 0 };
          if (!regionMasks.useMasks) regionMasks.useMasks = {};
          if (!regionMasks._scale) regionMasks._scale = {};
          regionMasks.useMasks.nailMask = nail.mask;
          regionMasks._scale.nailMask = nail.scale;
        }
      }
      // v550 — 손 피부: 실제 handSkinMask가 있을 때만 보정한다.
      if ((b.handSkin || 0) > 0 && MA && typeof MA.getHandSkinMaskSync === 'function' && img) {
        const hand = MA.getHandSkinMaskSync(img);
        if (hand) {
          if (!regionMasks) regionMasks = { useMasks: {}, _scale: {}, maskW: (img.naturalWidth || img.width) | 0, maskH: (img.naturalHeight || img.height) | 0 };
          if (!regionMasks.useMasks) regionMasks.useMasks = {};
          if (!regionMasks._scale) regionMasks._scale = {};
          regionMasks.useMasks.handSkinMask = hand.mask;
          regionMasks._scale.handSkinMask = hand.scale;
        }
      }
      // PE-M1 — 흰자: eyeRedness 사용 시에만 scleraMask 페치. 안전 게이트 통과 시에만 useMasks 주입.
      //   미통과(refine 없음/저신뢰/coverage 밖) → null → beauty-engine 이 기존 PE-ER 휴리스틱(eyeW) 그대로.
      if ((b.eyeRedness || 0) > 0 && MA && typeof MA.getScleraMaskSync === 'function' && img) {
        const sclera = MA.getScleraMaskSync(img);
        if (sclera) {
          if (!regionMasks) regionMasks = { useMasks: {}, _scale: {}, maskW: (img.naturalWidth || img.width) | 0, maskH: (img.naturalHeight || img.height) | 0 };
          if (!regionMasks.useMasks) regionMasks.useMasks = {};
          if (!regionMasks._scale) regionMasks._scale = {};
          regionMasks.useMasks.scleraMask = sclera.mask;
          regionMasks._scale.scleraMask = sclera.scale;
        }
      }
      // PE-M2 — 눈썹: browSharp 사용 시에만 browMask 페치. 게이트 통과 시 regionMasks.browMask 주입(lashMask 패턴, useMasks 아님).
      //   미통과(랜드마크 없음/저신뢰/coverage 밖/disable) → null → beauty-engine 이 기존 eyeMask 상단 ROI → 약한 전역 유지.
      if ((b.browSharp || 0) > 10 && MA && typeof MA.getBrowMaskSync === 'function' && img) {
        const brow = MA.getBrowMaskSync(img);
        if (brow) {
          if (!regionMasks) regionMasks = { useMasks: {}, _scale: {}, maskW: (img.naturalWidth || img.width) | 0, maskH: (img.naturalHeight || img.height) | 0 };
          regionMasks.browMask = brow.mask;
          regionMasks.browScale = brow.scale;
        }
      }
    } catch (_e) { regionMasks = null; }
    engine.apply(ctx, w, h, b, skinSmoothed, regionMasks);
    _contractBoost(ctx, w, h, b, regionMasks);
  }

  function _maskAt(mask, mw, mh, x, y, w, h) {
    if (!mask) return 0;
    const mx = Math.min(mw - 1, Math.max(0, (x * mw / w) | 0));
    const my = Math.min(mh - 1, Math.max(0, (y * mh / h) | 0));
    return mask[my * mw + mx] || 0;
  }

  function _contractBoost(ctx, w, h, b, regionMasks) {
    if (!regionMasks || !regionMasks.useMasks) return;
    if ((b.hairVolume || 0) > 14) _hairShapeBoost(ctx, w, h, b, regionMasks);
    if ((b.nailGloss || 0) > 14) _nailGlossSweep(ctx, w, h, b, regionMasks);
    if (window.PhotoEditorCuticle && window.PhotoEditorCuticle.active()) window.PhotoEditorCuticle.apply(ctx, w, h, b, regionMasks);
  }

  function _hairShapeBoost(ctx, w, h, b, regionMasks) {
    const hair = regionMasks.useMasks.hairMask;
    if (!hair) return;
    let img;
    try { img = ctx.getImageData(0, 0, w, h); } catch (_e) { return; }
    const src = new Uint8ClampedArray(img.data);
    const d = img.data, mw = regionMasks.maskW || w, mh = regionMasks.maskH || h;
    const skin = regionMasks.useMasks.skinMask, k = Math.min(1, (b.hairVolume || 0) / 100);
    const rad = Math.max(1, Math.min(4, Math.round(1 + k * 3)));
    const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
    let minX = w, minY = h, maxX = 0, maxY = 0;
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) if (_maskAt(hair, mw, mh, x, y, w, h) > 0.28) {
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    if (maxX <= minX || maxY <= minY) return;
    minX = Math.max(1, minX - rad - 1); minY = Math.max(1, minY - rad - 1);
    maxX = Math.min(w - 2, maxX + rad + 1); maxY = Math.min(h - 2, maxY + rad + 1);
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      if (_maskAt(hair, mw, mh, x, y, w, h) > 0.28 || _maskAt(skin, mw, mh, x, y, w, h) > 0.22) continue;
      let si = -1;
      for (let di = 0; di < dirs.length && si < 0; di++) for (let r = 1; r <= rad; r++) {
        const nx = x + dirs[di][0] * r, ny = y + dirs[di][1] * r;
        if (nx <= 0 || nx >= w - 1 || ny <= 0 || ny >= h - 1) continue;
        if (_maskAt(hair, mw, mh, nx, ny, w, h) > 0.58) { si = (ny * w + nx) * 4; break; }
      }
      if (si < 0) continue;
      const i = (y * w + x) * 4, a = 0.07 + k * 0.16;
      d[i] = d[i] * (1 - a) + src[si] * a;
      d[i + 1] = d[i + 1] * (1 - a) + src[si + 1] * a;
      d[i + 2] = d[i + 2] * (1 - a) + src[si + 2] * a;
    }
    ctx.putImageData(img, 0, 0);
  }

  function _nailGlossSweep(ctx, w, h, b, regionMasks) {
    const nail = regionMasks.useMasks.nailMask;
    if (!nail) return;
    let img;
    try { img = ctx.getImageData(0, 0, w, h); } catch (_e) { return; }
    const d = img.data, mw = regionMasks.maskW || w, mh = regionMasks.maskH || h;
    let minX = w, minY = h, maxX = 0, maxY = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (_maskAt(nail, mw, mh, x, y, w, h) > 0.38) {
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    if (maxX <= minX || maxY <= minY) return;
    const gw = Math.max(1, maxX - minX), gh = Math.max(1, maxY - minY), k = Math.min(1, (b.nailGloss || 0) / 100);
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const m = _maskAt(nail, mw, mh, x, y, w, h);
      if (m <= 0.38) continue;
      const nx = (x - minX) / gw, ny = (y - minY) / gh;
      const line = Math.max(0, 1 - Math.abs((nx - ny * 0.25) - 0.62) / 0.11);
      const add = (18 + 18 * line) * k * m * line, i = (y * w + x) * 4;
      d[i] = Math.min(255, d[i] + add);
      d[i + 1] = Math.min(255, d[i + 1] + add);
      d[i + 2] = Math.min(255, d[i + 2] + add * 1.04);
    }
    ctx.putImageData(img, 0, 0);
  }

  function _skinMaskCanvas(canvas) {
    const SM = window.PhotoEditorSmartMask;
    if (!SM || typeof SM.classify !== 'function') return null;
    const w = canvas.width, h = canvas.height;
    let data;
    try { data = canvas.getContext('2d').getImageData(0, 0, w, h); }
    catch (_e) { return null; }
    const mask = document.createElement('canvas');
    mask.width = w; mask.height = h;
    const out = mask.getContext('2d').createImageData(w, h);
    _fillSkinMask(data.data, out.data, w, h, SM);
    mask.getContext('2d').putImageData(out, 0, 0);
    return mask;
  }

  function _fillSkinMask(src, dst, w, h, SM) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = src[i], g = src[i + 1], b = src[i + 2];
      const lum = r * 0.299 + g * 0.587 + b * 0.114;
      const p = SM.classify({ r, g, b, lum, maxCh: Math.max(r, g, b), minCh: Math.min(r, g, b), x, y, w, h });
      const v = Math.round(Math.max(p.skin || 0, Math.min(p.redness || 0, 0.5)) * 255);
      dst[i] = v; dst[i + 1] = v; dst[i + 2] = v; dst[i + 3] = 255;
    }
  }

  // ── 메인 모듈 준비될 때까지 폴링 후 등록 ──
  function _register() {
    if (!window.PhotoEditor || !window.PhotoEditor._internal) return false;
    const i = window.PhotoEditor._internal;
    i.registerTabPanel('beauty', { html: _panelBeautyHTML, bind: _bindBeautyPanel });
    i.registerDrawHook('beauty', _applyBeauty);
    return true;
  }
  if (!_register()) {
    let tries = 0;
    const iv = setInterval(() => {
      if (_register() || ++tries > 50) clearInterval(iv);
    }, 100);
  }
})();
