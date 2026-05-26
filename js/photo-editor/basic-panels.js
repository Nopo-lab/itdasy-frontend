/* 사진 편집기 — 기본 화면 패널 (자동/보정/배경/텍스트/브랜드/저장) */
(function () {
  'use strict';

  if (window.PhotoEditorBasicPanels) return;

  const FAV_KEY = 'itdasy_pe_favorites';
  const FONTS = [
    { id: 'sans', label: 'Sans' }, { id: 'serif', label: 'Serif' },
    { id: 'playfair', label: 'Playfair' }, { id: 'nserif', label: '명조' },
    { id: 'bhan', label: '블랙 한산스' }, { id: 'gowun', label: '고운 도담' },
    { id: 'gaegu', label: '개구' }, { id: 'nanumpen', label: '나눔 펜' },
    { id: 'hand', label: '핸드' },
  ];
  const COLORS = ['#ffffff', '#1a1a20', '#D58A95', '#FFC83D'];
  const COLOR_LABEL = { '#ffffff': '흰', '#1a1a20': '검', '#D58A95': '핑크', '#FFC83D': '노랑' };

  function _esc(h, s) {
    if (h && typeof h.esc === 'function') return h.esc(s);
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  }

  function _chip(h, attr, val, label, on) {
    return `<button type="button" class="pe-chip-btn${on ? ' on' : ''}" data-pe-${attr}="${_esc(h, val)}">${_esc(h, label)}</button>`;
  }

  function _slider(h, label, key, val, min, max, step) {
    if (h && typeof h.slider === 'function') return h.slider(label, key, val, min, max, step);
    return `<label class="pe-slider"><div class="pe-slider-head"><span>${_esc(h, label)}</span><span class="pe-slider-val" data-pe-slider-val="${key}">${val}</span></div><input type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-pe-slider="${key}" /></label>`;
  }

  function _each(panel, sel, ev, fn) {
    panel.querySelectorAll(sel).forEach(el => el.addEventListener(ev, fn));
  }

  function _on(panel, sel, ev, fn) {
    panel.querySelector(sel)?.addEventListener(ev, fn);
  }

  function _toast(h, msg) {
    if (h && typeof h.toast === 'function') h.toast(msg);
  }

  function _shopPresetLabel() {
    try {
      const p = window.PhotoEnhance?.getShopPreset?.();
      return (p && p.label) || '일반';
    } catch (_e) { return '일반'; }
  }

  function _loadFavorites() {
    try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]') || []; }
    catch (_e) { return []; }
  }

  function _saveFavoritesList(list) {
    try { localStorage.setItem(FAV_KEY, JSON.stringify(list.slice(0, 5))); }
    catch (_e) { void _e; }
  }

  function _favoriteSnapshot(state, name) {
    return {
      name: String(name).slice(0, 20),
      adjust: JSON.parse(JSON.stringify(state.adjust)),
      beauty: JSON.parse(JSON.stringify(state.beauty)),
      film: JSON.parse(JSON.stringify(state.film || {})),
      shadow: JSON.parse(JSON.stringify(state.shadow || { mode: 'none' })),
      watermark: JSON.parse(JSON.stringify(state.watermark || {})),
      bg: JSON.parse(JSON.stringify(state.bg || { id: null })),
    };
  }

  function _saveCurrentAsFavorite(state, h) {
    const list = _loadFavorites();
    if (list.length >= 5) return _toast(h, '5개 한도. 기존 프리셋 길게 눌러 삭제 후 다시 저장');
    window._inlinePrompt('프리셋 이름 (예: 헤어 진하게)', '내 프리셋 ' + (list.length + 1), (name) => {
      list.push(_favoriteSnapshot(state, name));
      _saveFavoritesList(list);
      h.renderPanel();
      _toast(h, '프리셋 저장: ' + name);
    });
    return true;
  }

  function _applyFavorite(idx, state, h) {
    const f = _loadFavorites()[idx];
    if (!f) return _toast(h, '프리셋을 찾지 못했어요');
    if (f.adjust) Object.assign(state.adjust, f.adjust);
    if (f.beauty) Object.assign(state.beauty, f.beauty);
    if (f.film) state.film = JSON.parse(JSON.stringify(f.film));
    if (f.shadow) state.shadow = JSON.parse(JSON.stringify(f.shadow));
    if (f.watermark) Object.assign(state.watermark, f.watermark);
    if (f.bg) state.bg = JSON.parse(JSON.stringify(f.bg));
    h.redraw(); h.pushHistory();
    _toast(h, '적용: ' + f.name);
  }

  function _panelAuto(state, h) {
    const cur = state.autoIntensity || 'standard';
    const intChip = (k, label) => `<button type="button" class="pe-chip-btn${cur === k ? ' on' : ''}" data-pe-auto-intensity="${k}">${label}</button>`;
    const favs = _loadFavorites();
    const favHtml = favs.length
      ? favs.map((f, i) => `<button type="button" class="pe-chip-btn" data-pe-fav-apply="${i}" title="${_esc(h, f.name)}">★ ${_esc(h, f.name)}</button>`).join('')
      : '<div class="pe-hint" style="margin:0;">아직 저장된 프리셋이 없어요. 슬라이더 조정 후 ↓ 버튼으로 저장.</div>';
    return `<div class="pe-panel-row"><button type="button" class="pe-action-btn" data-pe-auto="all">⚡ 한 번에 자동 보정</button></div>
      <div class="pe-panel-row"><button type="button" class="pe-action-btn" data-pe-auto="shop">⚡ 우리 샵 업종 자동 (현재: ${_esc(h, _shopPresetLabel())})</button></div>
      <div class="pe-field-label" style="margin-top:10px;">강도</div>
      <div class="pe-panel-row pe-panel-grid-4">${intChip('natural','자연')}${intChip('standard','표준')}${intChip('strong','강조')}</div>
      <div class="pe-field-label" style="margin-top:10px;">업종별 자동 (강도 적용)</div>
      <div class="pe-panel-row pe-panel-grid-2">${_chip(h, 'auto','hair','헤어·붙임머리')}${_chip(h, 'auto','scalp','두피·탈모')}${_chip(h, 'auto','makeup','메이크업·눈썹')}${_chip(h, 'auto','lash','속눈썹')}${_chip(h, 'auto','nail','네일·패디')}${_chip(h, 'auto','wax','왁싱·바디·피부')}</div>
      <div class="pe-field-label" style="margin-top:10px;">분위기</div>
      <div class="pe-panel-row pe-panel-grid-4">${_chip(h, 'auto','bright','밝게')}${_chip(h, 'auto','vivid','선명')}${_chip(h, 'auto','warm','따뜻')}${_chip(h, 'auto','cool','차갑게')}</div>
      <div class="pe-field-label" style="margin-top:14px;">★ 내 즐겨찾기 프리셋 (${favs.length}/5)</div>
      <div class="pe-panel-row pe-panel-grid-2" style="flex-wrap:wrap;">${favHtml}</div>
      <div class="pe-panel-row" style="margin-top:6px;"><button type="button" class="pe-chip-btn" data-pe-fav-save>현재 슬라이더 → 프리셋 저장</button></div>
      <div class="pe-hint">표준이 기본. 자연은 0.7배, 강조는 1.4배.</div>`;
  }

  function _panelTune(state, h) {
    const a = state.adjust;
    return `${_slider(h, '밝기','brightness',a.brightness,50,150,1)}${_slider(h, '채도','saturate',a.saturate,50,150,1)}${_slider(h, '선명도','sharpness',a.sharpness,0,100,1)}${_slider(h, '색온도','temperature',a.temperature,-50,50,1)}
      <div class="pe-field-label" style="margin-top:10px;">방향 (v202 신규)</div>
      <div class="pe-panel-row pe-panel-grid-4">
        <button type="button" class="pe-chip-btn" data-pe-transform="rotL">↺ 90°</button>
        <button type="button" class="pe-chip-btn" data-pe-transform="rotR">↻ 90°</button>
        <button type="button" class="pe-chip-btn" data-pe-transform="flipH">⇋ 좌우</button>
        <button type="button" class="pe-chip-btn" data-pe-transform="flipV">⇵ 상하</button>
      </div>
      <div class="pe-panel-row" style="margin-top:8px;"><button type="button" class="pe-chip-btn" data-pe-tune-reset>슬라이더 초기화</button></div>
      <div class="pe-hint">방향 버튼은 원본 이미지를 회전·반전 시킵니다. 슬라이더는 따로 초기화.</div>`;
  }

  function _bgCard(bg, h) {
    const preview = bg.imageData
      ? `<img src="${_esc(h, bg.imageData)}" alt="${_esc(h, bg.name)}" style="width:100%;height:100%;object-fit:cover;display:block;" />`
      : `<div style="width:100%;height:100%;background:${_esc(h, bg.gradient || bg.color || '#fff')};"></div>`;
    return `<button type="button" data-pe-bg-id="${_esc(h, bg.id)}" style="position:relative;width:100%;aspect-ratio:1;border-radius:10px;overflow:hidden;border:1.5px solid rgba(255,255,255,0.10);background:transparent;cursor:pointer;padding:0;">
      ${preview}<div style="position:absolute;left:0;right:0;bottom:0;padding:3px 6px;background:rgba(0,0,0,0.55);color:#fff;font-size:10px;font-weight:700;text-align:center;">${_esc(h, bg.name)}</div>
    </button>`;
  }

  function _panelBg(_state, h) {
    const list = typeof window.GALLERY_BG_LIST === 'function' ? window.GALLERY_BG_LIST() : [];
    if (!list.length) {
      return `<div class="pe-panel-row"><button type="button" class="pe-action-btn" data-pe-bg="open-existing">기존 누끼·배경 화면 열기</button></div>
        <div class="pe-hint">배경 모듈 로드 중이에요. 잠시 후 다시 열어주세요.</div>`;
    }
    return `<div class="pe-field-label">배경 선택 (누끼 후 자동 합성)</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;">${list.map(bg => _bgCard(bg, h)).join('')}</div>
      <div class="pe-panel-row pe-panel-grid-2">
        <button type="button" class="pe-chip-btn" data-pe-bg="restore">↺ 원본 사진으로</button>
        <button type="button" class="pe-chip-btn" data-pe-bg="open-existing">기존 배경 화면</button>
      </div>
      <div class="pe-hint">카드 누르면 자동 누끼 + 합성. 같은 사진은 누끼 캐시되어 다른 배경 즉시 적용. Free 한도 누끼 2/일.</div>`;
  }

  function _layerListHTML(state, h) {
    const layers = state.layers || [];
    if (layers.length <= 1) return '';
    const buttons = layers.map((l, i) => `<button type="button" class="pe-chip-btn${l.id === state.activeLayerId ? ' on' : ''}" data-pe-layer-select="${l.id}" title="${_esc(h, l.value || '(빈 텍스트)').slice(0, 20)}">${i + 1}. ${_esc(h, (l.value || '빈 텍스트').slice(0, 8))}</button>`).join('');
    return `<div class="pe-field-label">텍스트 레이어 (${layers.length})</div><div class="pe-panel-row" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;">${buttons}</div>`;
  }

  function _layerActionsHTML(state) {
    const more = (state.layers || []).length > 1;
    return `<div class="pe-panel-row" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">
      <button type="button" class="pe-chip-btn" data-pe-layer-add>＋ 새 텍스트</button>
      <button type="button" class="pe-chip-btn" data-pe-sticker-open>🎨 스티커</button>
      ${more ? '<button type="button" class="pe-chip-btn" data-pe-layer-del>🗑 삭제</button>' : ''}
      ${more ? '<button type="button" class="pe-chip-btn" data-pe-layer-up>↑ 위로</button>' : ''}
    </div>`;
  }

  function _fontButtons(t) {
    return FONTS.map(f => `<button type="button" class="pe-chip-btn${t.font === f.id ? ' on' : ''}" data-pe-text-font="${f.id}">${f.label}</button>`).join('');
  }

  function _colorButtons(t) {
    return COLORS.map(c => `<button type="button" class="pe-chip-btn${t.color === c ? ' on' : ''}" data-pe-text-color="${c}" style="background:${c};color:${c === '#ffffff' || c === '#FFC83D' ? '#222' : '#fff'};">${COLOR_LABEL[c]}</button>`).join('');
  }

  function _panelText(state, h) {
    h.ensureLayers();
    const t = state.text;
    return `${_layerListHTML(state, h)}${_layerActionsHTML(state)}
      <label class="pe-field"><span>텍스트 (여러 줄 가능 — Enter)</span><textarea class="pe-input" data-pe-text-val rows="3" maxlength="120" placeholder="시술명·이벤트 문구 등&#10;여러 줄도 OK">${_esc(h, t.value)}</textarea></label>
      <div class="pe-panel-row pe-panel-grid-2" style="margin-top:8px;">${_chip(h, 'text-prefill','service','시술 선택')}${_chip(h, 'text-prefill','price','가격 넣기')}</div>
      <div class="pe-field-label" style="margin-top:10px;">폰트</div><div class="pe-panel-row pe-panel-grid-4">${_fontButtons(t)}</div>
      <div class="pe-field-label" style="margin-top:10px;">색상</div><div class="pe-panel-row pe-panel-grid-4">${_colorButtons(t)}</div>
      <div class="pe-panel-row" style="margin-top:6px;align-items:center;gap:8px;"><label style="font-size:11px;color:#c9c9d0;display:inline-flex;align-items:center;gap:8px;cursor:pointer;"><span>커스텀 색상:</span><input type="color" data-pe-text-color-picker value="${_esc(h, t.color)}" style="width:36px;height:36px;border:none;border-radius:8px;cursor:pointer;background:transparent;" /></label></div>
      <label class="pe-slider"><div class="pe-slider-head"><span>크기</span><span class="pe-slider-val">${t.size}</span></div><input type="range" min="3" max="12" value="${t.size}" data-pe-text-size /></label>
      <label class="pe-slider"><div class="pe-slider-head"><span>위치 (위↔아래)</span><span class="pe-slider-val">${Math.round(t.y * 100)}</span></div><input type="range" min="5" max="95" value="${Math.round(t.y * 100)}" data-pe-text-y /></label>
      <label class="pe-slider"><div class="pe-slider-head"><span>위치 (좌↔우)</span><span class="pe-slider-val">${Math.round(t.x * 100)}</span></div><input type="range" min="5" max="95" value="${Math.round(t.x * 100)}" data-pe-text-x /></label>
      <label class="pe-slider"><div class="pe-slider-head"><span>회전 (°)</span><span class="pe-slider-val">${t.rot}</span></div><input type="range" min="-45" max="45" value="${t.rot}" data-pe-text-rot /></label>
      <div class="pe-panel-row pe-panel-grid-2" style="margin-top:8px;"><button type="button" class="pe-chip-btn${t.bg ? ' on' : ''}" data-pe-text-bg>배경 박스 ${t.bg ? '끄기' : '켜기'}</button><button type="button" class="pe-chip-btn${t.stroke ? ' on' : ''}" data-pe-text-stroke>외곽선 ${t.stroke ? '끄기' : '켜기'}</button></div>`;
  }

  function _panelBrand(state, h) {
    const w = state.watermark, sym = { tl:'↖', tr:'↗', bl:'↙', br:'↘' };
    return `<label class="pe-field"><span>워터마크 문구</span><input type="text" class="pe-input" data-pe-wm-val placeholder="@샵아이디 · 샵이름" value="${_esc(h, w.value)}" maxlength="40" /></label>
      <div class="pe-field-label">위치</div>
      <div class="pe-panel-row pe-panel-grid-4">${['tl','tr','bl','br'].map(p => _chip(h, 'wm-pos', p, sym[p], w.position === p)).join('')}</div>
      <label class="pe-slider"><div class="pe-slider-head"><span>투명도</span><span class="pe-slider-val">${Math.round(w.opacity * 100)}%</span></div><input type="range" min="20" max="100" value="${Math.round(w.opacity * 100)}" data-pe-wm-opacity /></label>
      <div class="pe-panel-row pe-panel-grid-2" style="margin-top:8px;"><button type="button" class="pe-chip-btn" data-pe-wm-save>기본값으로 저장</button><button type="button" class="pe-chip-btn" data-pe-wm-kit>Brand Kit 전체 설정</button></div>`;
  }

  function _panelExport(state, h) {
    const batch = window.PhotoEditorBatch;
    const slotInfo = batch && typeof batch.getCurrentSlot === 'function' ? batch.getCurrentSlot() : null;
    const batchHtml = slotInfo
      ? `<div class="pe-field-label" style="margin-top:12px;">배치 편집 (v206)</div><div class="pe-panel-row"><button type="button" class="pe-action-btn" data-pe-batch-apply>📦 이 슬롯 사진 ${slotInfo.count}장 모두 같은 보정 일괄 적용</button></div><div class="pe-hint">현재 슬라이더 설정으로 슬롯 (${_esc(h, slotInfo.label)}) 다른 사진까지 한 번에 보정.</div>`
      : '';
    return `<div class="pe-field-label">비율</div>
      <div class="pe-panel-row pe-panel-grid-4">${['original','1:1','4:5','9:16'].map(rv => _chip(h, 'ratio', rv, rv === 'original' ? '원본' : rv, state.ratio === rv)).join('')}</div>
      <div class="pe-panel-row pe-panel-grid-2" style="margin-top:12px;"><button type="button" class="pe-action-btn" data-pe-export="png">PNG 저장</button><button type="button" class="pe-action-btn" data-pe-export="jpg">JPG 저장</button></div>
      <div class="pe-panel-row pe-panel-grid-2" style="margin-top:8px;"><button type="button" class="pe-chip-btn" data-pe-export="png2">2배 고화질</button><button type="button" class="pe-chip-btn" data-pe-export="webp">WebP 저장</button></div>
      <div class="pe-panel-row" style="margin-top:8px;"><button type="button" class="pe-action-btn" data-pe-export="set">피드+스토리 세트 저장</button></div>${batchHtml}
      <div class="pe-hint">저장 시 원본은 보존됩니다. 편집본만 다운로드 또는 갤러리에 추가돼요.</div>`;
  }

  function _bindAuto(panel, state, h) {
    _each(panel, '[data-pe-auto]', 'click', e => h.applyAuto(e.currentTarget.dataset.peAuto));
    _each(panel, '[data-pe-auto-intensity]', 'click', e => {
      state.autoIntensity = e.currentTarget.dataset.peAutoIntensity;
      h.renderPanel();
      _toast(h, '강도: ' + (state.autoIntensity === 'natural' ? '자연' : state.autoIntensity === 'strong' ? '강조' : '표준'));
    });
    _each(panel, '[data-pe-fav-apply]', 'click', e => _applyFavorite(+e.currentTarget.dataset.peFavApply, state, h));
    _each(panel, '[data-pe-fav-apply]', 'contextmenu', e => _deleteFavorite(e, h));
    _on(panel, '[data-pe-fav-save]', 'click', () => _saveCurrentAsFavorite(state, h));
  }

  function _deleteFavorite(e, h) {
    e.preventDefault();
    const i = +e.currentTarget.dataset.peFavApply;
    const list = _loadFavorites();
    window._inlineConfirm('프리셋 "' + (list[i] && list[i].name) + '" 삭제할까요?', () => {
      list.splice(i, 1);
      _saveFavoritesList(list);
      h.renderPanel();
      _toast(h, '프리셋 삭제');
    });
  }

  function _bindTune(panel, state, h) {
    _each(panel, '[data-pe-slider]', 'input', e => _updateAdjust(e, panel, state, h));
    _each(panel, '[data-pe-slider]', 'change', () => h.pushHistory());
    _each(panel, '[data-pe-slider]', 'dblclick', e => _resetAdjustOne(e, state, h));
    _on(panel, '[data-pe-tune-reset]', 'click', () => {
      state.adjust = { brightness: 100, saturate: 100, sharpness: 0, temperature: 0 };
      h.renderPanel(); h.redraw(); h.pushHistory();
    });
    _each(panel, '[data-pe-transform]', 'click', e => h.applyTransform(e.currentTarget.dataset.peTransform));
  }

  function _updateAdjust(e, panel, state, h) {
    const inp = e.currentTarget, key = inp.dataset.peSlider;
    state.adjust[key] = +inp.value;
    const out = panel.querySelector(`[data-pe-slider-val="${key}"]`);
    if (out) out.textContent = inp.value;
    h.scheduleRedraw();
  }

  function _resetAdjustOne(e, state, h) {
    const key = e.currentTarget.dataset.peSlider;
    const reset = { brightness: 100, saturate: 100, sharpness: 0, temperature: 0 };
    state.adjust[key] = reset[key] || 0;
    h.renderPanel(); h.redraw(); h.pushHistory();
    _toast(h, '초기화: ' + key);
  }

  function _bindBg(panel, state, h) {
    _on(panel, '[data-pe-bg="open-existing"]', 'click', () => {
      _toast(h, '기존 누끼·배경 화면을 여는 중…');
      (window.openGalleryBg || window.openBgGallery || window.openBgPanel || (() => {}))();
    });
    _on(panel, '[data-pe-bg="restore"]', 'click', () => _restoreBg(state, h));
    _each(panel, '[data-pe-bg-id]', 'click', e => _composeBg(e.currentTarget, state, h));
  }

  function _restoreBg(state, h) {
    if (!state.preBgOriginalSrc) return _toast(h, '원본이 이미 보이고 있어요');
    h.loadImage(state.preBgOriginalSrc);
    state.removedBgDataUrl = null;
    state.preBgOriginalSrc = null;
    _toast(h, '원본 사진으로 복원');
  }

  async function _composeBg(btn, state, h) {
    if (!state.originalImg) return _toast(h, '먼저 사진을 골라주세요');
    if (typeof window.composeBgForEditor !== 'function') return _toast(h, '배경 모듈 로드 중이에요. 잠시 후 다시.');
    btn.disabled = true;
    _toast(h, '누끼 + 배경 합성 중…');
    try {
      await _composeBgInner(btn.dataset.peBgId, state, h);
      btn.disabled = false;
    } catch (err) {
      _toast(h, '합성 실패: ' + ((err && err.message) || '').slice(0, 60));
      btn.disabled = false;
    }
  }

  async function _composeBgInner(bgId, state, h) {
    if (!state.preBgOriginalSrc) state.preBgOriginalSrc = state.originalSrc;
    const ratio = state.ratio && state.ratio !== 'original' ? state.ratio : '1:1';
    const result = await window.composeBgForEditor(state.preBgOriginalSrc, bgId, ratio, state.removedBgDataUrl);
    state.removedBgDataUrl = result.removedBgDataUrl;
    h.replaceImage(result.composedDataUrl, '배경 적용 완료');
  }

  function _bindText(panel, state, h) {
    _bindTextLayers(panel, h);
    _bindTextValues(panel, state, h);
    _bindTextStyles(panel, state, h);
    _bindTextPrefill(panel, state, h);
  }

  function _bindTextLayers(panel, h) {
    _on(panel, '[data-pe-layer-add]', 'click', () => h.addLayer());
    _on(panel, '[data-pe-layer-del]', 'click', () => h.deleteLayer());
    _on(panel, '[data-pe-layer-up]', 'click', () => h.moveLayerUp());
    _on(panel, '[data-pe-sticker-open]', 'click', () => _openSticker(h));
    _each(panel, '[data-pe-layer-select]', 'click', e => h.selectLayer(e.currentTarget.dataset.peLayerSelect));
  }

  function _openSticker(h) {
    if (window.PhotoEditor && typeof window.PhotoEditor.openStickerLibrary === 'function') {
      window.PhotoEditor.openStickerLibrary();
      return;
    }
    _toast(h, '스티커 모듈 로드 중이에요');
  }

  function _bindTextValues(panel, state, h) {
    _on(panel, '[data-pe-text-val]', 'input', e => { state.text.value = e.target.value; h.syncTextToLayer(); h.scheduleRedraw(); });
    _on(panel, '[data-pe-text-y]', 'input', e => { state.text.y = +e.target.value / 100; h.scheduleRedraw(); });
    _on(panel, '[data-pe-text-x]', 'input', e => { state.text.x = +e.target.value / 100; h.scheduleRedraw(); });
    _on(panel, '[data-pe-text-rot]', 'input', e => { state.text.rot = +e.target.value; h.scheduleRedraw(); });
    _on(panel, '[data-pe-text-size]', 'input', e => { state.text.size = +e.target.value; h.scheduleRedraw(); });
  }

  function _bindTextStyles(panel, state, h) {
    _on(panel, '[data-pe-text-stroke]', 'click', () => _toggleTextFlag(state, h, 'stroke'));
    _on(panel, '[data-pe-text-bg]', 'click', () => _toggleTextFlag(state, h, 'bg'));
    _each(panel, '[data-pe-text-font]', 'click', e => _setTextValue(state, h, 'font', e.currentTarget.dataset.peTextFont));
    _each(panel, '[data-pe-text-color]', 'click', e => _setTextValue(state, h, 'color', e.currentTarget.dataset.peTextColor));
    _on(panel, '[data-pe-text-color-picker]', 'input', e => { state.text.color = e.target.value; h.scheduleRedraw(); });
    _on(panel, '[data-pe-text-color-picker]', 'change', () => h.pushHistory());
  }

  function _toggleTextFlag(state, h, key) {
    state.text[key] = !state.text[key];
    h.renderPanel(); h.redraw(); h.pushHistory();
  }

  function _setTextValue(state, h, key, value) {
    state.text[key] = value;
    h.renderPanel(); h.redraw(); h.pushHistory();
  }

  function _bindTextPrefill(panel, state, h) {
    _each(panel, '[data-pe-text-prefill]', 'click', e => {
      const w = e.currentTarget.dataset.peTextPrefill;
      if (_openServicePickerIfNeeded(w, state)) return;
      state.text.value = _prefillValue(w, state);
      h.syncTextToLayer(); h.renderPanel(); h.redraw(); h.pushHistory();
    });
  }

  function _openServicePickerIfNeeded(w, state) {
    if (w === 'service' && window.PhotoEditorServicePicker?.open) { window.PhotoEditorServicePicker.open(w); return true; }
    if (w === 'price' && !state.price && window.PhotoEditorServicePicker?.open) { window.PhotoEditorServicePicker.open(w); return true; }
    return false;
  }

  function _prefillValue(w, state) {
    if (w === 'service') return state.serviceName || '시술 결과';
    if (window.PhotoEditorServicePicker?.formatPrice) return window.PhotoEditorServicePicker.formatPrice(state.price);
    return state.price ? (state.price / 10000).toFixed(0) + '만원' : '가격 문의';
  }

  function _bindBrand(panel, state, h) {
    _on(panel, '[data-pe-wm-val]', 'input', e => { state.watermark.value = e.target.value; h.scheduleRedraw(); });
    _each(panel, '[data-pe-wm-pos]', 'click', e => { state.watermark.position = e.currentTarget.dataset.peWmPos; h.renderPanel(); h.redraw(); });
    _on(panel, '[data-pe-wm-opacity]', 'input', e => { state.watermark.opacity = +e.target.value / 100; h.scheduleRedraw(); });
    _on(panel, '[data-pe-wm-save]', 'click', () => _saveBrandWm(state, h));
    _on(panel, '[data-pe-wm-kit]', 'click', () => _openBrandKit(h));
    _bindBrandKitSync(state, h);
    _prefillWatermark(state, panel, h);
  }

  function _saveBrandWm(state, h) {
    try {
      const wm = state.watermark;
      const p = { watermark_text: wm.value, watermark_position: wm.position, watermark_opacity: wm.opacity };
      if (window.BrandKit && typeof window.BrandKit.save === 'function') window.BrandKit.save(p);
      else localStorage.setItem('itdasy_brand_kit', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('itdasy_brand_kit') || '{}'), p)));
      _toast(h, '워터마크 기본값을 저장했어요');
    } catch (_e) { _toast(h, '저장에 실패했어요'); }
  }

  function _openBrandKit(h) {
    if (window.BrandKit && typeof window.BrandKit.open === 'function') window.BrandKit.open();
    else _toast(h, 'Brand Kit 모듈을 불러오는 중이에요');
  }

  function _bindBrandKitSync(state, h) {
    window.addEventListener('itdasy:brand-kit:updated', () => _syncBrandKit(state, h), { once: true });
  }

  function _syncBrandKit(state, h) {
    try {
      const bk = window.BrandKit?.get?.();
      if (!bk) return;
      if (bk.watermark_text) state.watermark.value = bk.watermark_text;
      else if (bk.shop_name) state.watermark.value = bk.shop_name + (bk.instagram_handle ? ' · @' + bk.instagram_handle : '');
      if (bk.watermark_position) state.watermark.position = bk.watermark_position;
      if (typeof bk.watermark_opacity === 'number') state.watermark.opacity = bk.watermark_opacity;
      h.renderPanel(); h.redraw();
    } catch (_e) { void _e; }
  }

  function _prefillWatermark(state, panel, h) {
    if (state.watermark.value || !state.shopName) return;
    state.watermark.value = state.shopName;
    const inp = panel.querySelector('[data-pe-wm-val]');
    if (inp) inp.value = state.watermark.value;
    h.redraw();
  }

  function _bindExport(panel, state, h) {
    _each(panel, '[data-pe-ratio]', 'click', e => {
      state.ratio = e.currentTarget.dataset.peRatio;
      h.renderPanel(); h.redraw(); h.pushHistory();
    });
    _each(panel, '[data-pe-export]', 'click', e => h.exportImage(e.currentTarget.dataset.peExport));
    _on(panel, '[data-pe-batch-apply]', 'click', e => _applyBatch(state, h, e.currentTarget));
  }

  function _applyBatch(state, h, btn) {
    const batch = window.PhotoEditorBatch;
    if (!batch || typeof batch.applyToSlot !== 'function') return _toast(h, '배치 편집 모듈을 불러오는 중이에요');
    batch.applyToSlot(state, h, btn);
  }

  function _wrapHtml(fn) {
    return state => fn(state, window.PhotoEditor?._internal?.helpers || {});
  }

  const PANELS = {
    auto: { html: _wrapHtml(_panelAuto), bind: _bindAuto },
    tune: { html: _wrapHtml(_panelTune), bind: _bindTune },
    bg: { html: _wrapHtml(_panelBg), bind: _bindBg },
    text: { html: _wrapHtml(_panelText), bind: _bindText },
    brand: { html: _wrapHtml(_panelBrand), bind: _bindBrand },
    export: { html: _wrapHtml(_panelExport), bind: _bindExport },
  };

  function register() {
    const internal = window.PhotoEditor && window.PhotoEditor._internal;
    if (!internal || typeof internal.registerTabPanel !== 'function') return false;
    Object.keys(PANELS).forEach(id => internal.registerTabPanel(id, PANELS[id]));
    return true;
  }

  window.PhotoEditorBasicPanels = { register };

  if (!register()) {
    let tries = 0;
    const iv = setInterval(() => {
      if (register() || ++tries > 50) clearInterval(iv);
    }, 100);
  }
})();
