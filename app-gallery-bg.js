// Itdasy Studio - 배경창고 + 템플릿 (app-gallery.js에서 분리)

// ═══════════════════════════════════════════════════════
// 배경창고 (슬롯 편집 도구)
// ═══════════════════════════════════════════════════════
const DEFAULT_BACKGROUNDS = [
  { id: 'cloud_bw', name: '구름(흑백)', type: 'preset', color: '#f5f5f5', gradient: 'linear-gradient(180deg,#e8e8e8 0%,#f8f8f8 50%,#e0e0e0 100%)' },
  { id: 'cloud_color', name: '구름(컬러)', type: 'preset', color: '#e8f4fc', gradient: 'linear-gradient(180deg,#d4e8f7 0%,#f0f7fc 50%,#c5dff0 100%)' },
  { id: 'pink', name: '핑크', type: 'preset', color: '#fff0f3', gradient: 'linear-gradient(180deg,#ffe4ec 0%,#fff5f7 50%,#ffd6e0 100%)' },
  { id: 'white', name: '화이트', type: 'preset', color: '#ffffff', gradient: 'linear-gradient(180deg,#f8f8f8 0%,#ffffff 50%,#f5f5f5 100%)' },
  // [2026-05-18] 설계 §12.3 — 고급 배경 4종. type:'procedural' 분기는 _applyBgToPhoto 캔버스에서 처리.
  // 썸네일 미리보기는 CSS gradient(아래 gradient 필드)로 그려지고, 실제 합성은 비율(1:1/4:5/9:16)에 맞춰 캔버스 procedural 로 재생성.
  { id: 'bg_marble', name: '대리석', type: 'procedural', render: 'marble', color: '#f4f2ef', gradient: 'linear-gradient(135deg,#f6f4f1 0%,#eceae6 45%,#f8f6f3 70%,#dcd9d4 100%)' },
  { id: 'bg_beige_minimal', name: '베이지 미니멀', type: 'procedural', render: 'beige', color: '#f5ebdd', gradient: 'linear-gradient(180deg,#f7eee1 0%,#f0e3d0 100%)' },
  { id: 'bg_pink_gradient', name: '핑크 그라데이션', type: 'procedural', render: 'pink_radial', color: '#fdd8e0', gradient: 'radial-gradient(circle at 50% 40%,#fdd8e0 0%,#f5a9b8 60%,#f18091 100%)' },
  { id: 'bg_black_lux', name: '블랙 럭셔리', type: 'procedural', render: 'black_lux', color: '#1a1a1f', gradient: 'linear-gradient(180deg,#22222a 0%,#1a1a1f 60%,#0f0f13 100%)' },
];

let _selectedBgId = 'cloud_bw';
const _mkIc = (p) => `<svg class="ic ic--xs" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const _IC_PALETTE = _mkIc('<path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10a2.5 2.5 0 0 0 2.5-2.5c0-.63-.24-1.2-.64-1.67-.15-.17-.25-.38-.25-.62 0-.56.45-1.01 1-1.01H16c3.31 0 6-2.69 6-6C22 6.5 17.52 2 12 2z"/><circle cx="6.5" cy="11.5" r="1.5"/><circle cx="9.5" cy="7.5" r="1.5"/><circle cx="14.5" cy="7.5" r="1.5"/><circle cx="17.5" cy="11.5" r="1.5"/>');
const _IC_SAVE    = _mkIc('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>');
const _IC_GRID    = _mkIc('<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>');
const _IC_STAR    = '<i class="ph-duotone ph-star" aria-hidden="true"></i>';

function _loadUserBgs() {
  try { return JSON.parse(localStorage.getItem('itdasy_user_bgs') || '[]'); } catch(_) { return []; }
}
function _saveUserBgs(arr) {
  localStorage.setItem('itdasy_user_bgs', JSON.stringify(arr));
}
function _loadFavBgs() {
  try { return JSON.parse(localStorage.getItem('itdasy_fav_bgs') || '[]'); } catch(_) { return []; }
}
function _saveFavBgs(arr) {
  localStorage.setItem('itdasy_fav_bgs', JSON.stringify(arr));
}

function openBgPanel() {
  document.getElementById('bgPanel').classList.add('ws-panel--open');
  _renderBgPanel();
}
function closeBgPanel() {
  document.getElementById('bgPanel').classList.remove('ws-panel--open');
}

function _renderBgPanel() {
  const body = document.getElementById('bgPanelBody');
  if (!body) return;

  const userBgs = _loadUserBgs();
  const favIds = _loadFavBgs();
  const allBgs = [...DEFAULT_BACKGROUNDS, ...userBgs];

  const favBgs = allBgs.filter(b => favIds.includes(b.id));
  const otherBgs = allBgs.filter(b => !favIds.includes(b.id));

  const renderCard = (bg, isFav) => {
    const isSelected = _selectedBgId === bg.id;
    const isUser = bg.type === 'user';
    const preview = bg.imageData
      ? `<img src="${bg.imageData}" alt="${bg.name}">`
      : `<div style="width:100%;height:100%;background:${bg.gradient || bg.color};"></div>`;
    const _bid = (bg.id || '').replace(/['"<>&]/g, '');
    const _bnm = String(bg.name || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    return `
      <div class="gp-card" data-bgid="${_bid}" onclick="selectBg(this.dataset.bgid)">
        <div class="gp-card__thumb${isSelected ? ' gp-card__thumb--sel' : ''}">${preview}</div>
        <div class="gp-card__name">${_bnm}</div>
        <button class="gp-fav-btn" data-bgid="${_bid}" onclick="toggleFavBg(this.dataset.bgid,event)" aria-label="${isFav ? '즐겨찾기 해제' : '즐겨찾기 추가'}">${isFav ? '⭐' : '☆'}</button>
        ${isUser ? `<button class="gp-del-btn" data-bgid="${_bid}" onclick="deleteUserBg(this.dataset.bgid,event)" aria-label="삭제">×</button>` : ''}
      </div>`;
  };

  body.innerHTML = `
    ${favBgs.length ? `
      <div class="gp-section">
        <p class="gp-section-lbl">${_IC_STAR} 즐겨찾기</p>
        <div class="gp-grid gp-grid--4">${favBgs.map(bg => renderCard(bg, true)).join('')}</div>
      </div>` : ''}
    <div class="gp-section">
      <p class="gp-section-lbl">${_IC_PALETTE} 배경 선택</p>
      <div class="gp-grid gp-grid--4">
        ${otherBgs.map(bg => renderCard(bg, false)).join('')}
        <div class="gp-add-card" onclick="addUserBg()">
          <div class="gp-add-card__thumb">+</div>
          <div class="gp-card__name">추가</div>
        </div>
      </div>
    </div>
    <input type="file" id="bgUploadInput" accept="image/*" style="display:none;" onchange="handleBgUpload(this)">
    <button onclick="applySelectedBg()" class="btn-primary">선택한 배경 적용하기</button>
  `;
}

function selectBg(id) {
  _selectedBgId = id;
  _renderBgPanel();
}

function toggleFavBg(id, e) {
  e.stopPropagation();
  const favs = _loadFavBgs();
  if (favs.includes(id)) {
    _saveFavBgs(favs.filter(f => f !== id));
  } else {
    _saveFavBgs([...favs, id]);
  }
  _renderBgPanel();
}

function addUserBg() {
  document.getElementById('bgUploadInput').click();
}

function handleBgUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    window._inlinePrompt('배경 이름을 입력하세요:', file.name.replace(/\.[^.]+$/, ''), (name) => {
      const userBgs = _loadUserBgs();
      userBgs.push({
        id: 'user_' + Date.now(),
        name: name.slice(0, 10),
        type: 'user',
        imageData: e.target.result,
      });
      _saveUserBgs(userBgs);
      _renderBgPanel();
      showToast('배경이 추가됐어요!');
    });
  };
  reader.readAsDataURL(file);
  input.value = '';
}

async function deleteUserBg(id, e) {
  e.stopPropagation();
  if (!(await nativeConfirm('배경 삭제', '이 배경을 삭제할까요?', '삭제'))) return;
  const userBgs = _loadUserBgs();
  _saveUserBgs(userBgs.filter(b => b.id !== id));
  const favs = _loadFavBgs();
  _saveFavBgs(favs.filter(f => f !== id));
  if (_selectedBgId === id) _selectedBgId = 'cloud_bw';
  _renderBgPanel();
  showToast('삭제됐어요');
}

// [2026-05-17] target_ratio 옵션 인자 추가 — 미지정 시 '1:1' (기존 동작).
// 호출 예: applySelectedBg({ target_ratio: '4:5' })  // 인스타 피드 4:5
//          applySelectedBg()                           // 기존 1:1 호환
async function applySelectedBg(opts = {}) {
  const target_ratio = opts.target_ratio || '1:1';
  const slot = _slots.find(s => s.id === _popupSlotId);
  if (!slot) return;

  const selectedPhotos = slot.photos.filter(p => _popupSelIds.has(p.id) && !p.hidden);
  if (!selectedPhotos.length) {
    showToast('먼저 사진을 선택해주세요');
    return;
  }

  const allBgs = [...DEFAULT_BACKGROUNDS, ..._loadUserBgs()];
  const bg = allBgs.find(b => b.id === _selectedBgId);
  if (!bg) return;

  closeBgPanel();
  const progress = document.getElementById('popupProgress');
  if (progress) { progress.style.display = 'block'; progress.textContent = `배경 합성 중... 0/${selectedPhotos.length}`; }

  let failCount = 0;
  for (let i = 0; i < selectedPhotos.length; i++) {
    const photo = selectedPhotos[i];
    if (progress) progress.textContent = `배경 합성 중... ${i + 1}/${selectedPhotos.length}`;
    try {
      await _applyBgToPhoto(photo, bg, slot, target_ratio);
    } catch(e) {
      console.warn('배경 합성 실패:', e);
      failCount++;
    }
  }

  if (progress) progress.style.display = 'none';
  _popupSelIds.clear();
  _renderPopupPhotoGrid(slot);
  if (failCount === selectedPhotos.length) {
    showToast('배경 적용에 실패했어요. 다시 시도해주세요');
  } else if (failCount > 0) {
    showToast(`${failCount}장 실패 — ${selectedPhotos.length - failCount}장만 적용됐어요`);
  } else {
    showToast(`${selectedPhotos.length}장에 배경 적용 완료!`);
  }
}

async function _applyBgToPhoto(photo, bg, slot, target_ratio = '1:1') {
  const Composer = window.PhotoEditorBgCompose;
  if (!Composer || typeof Composer.compose !== 'function') throw new Error('배경 합성 모듈 로드 실패');
  const result = await Composer.compose({
    srcUrl: photo.dataUrl || photo.editedDataUrl,
    bg,
    targetRatio: target_ratio,
    preRemovedBgUrl: photo.removedBgUrl,
    shadow: photo.shadow || { mode: 'none' },
  });
  photo.editedDataUrl = result.composedDataUrl;
  photo.removedBgUrl = result.removedBgDataUrl;
  photo.mode = 'bg_' + bg.id;
  await saveSlotToDB(slot);
}

// ═══════════════════════════════════════════════════════
// 템플릿 (배경 + 요소 조합)
// ═══════════════════════════════════════════════════════
const DEFAULT_TEMPLATES = [
  { id: 'tpl_hair1', name: '붙임머리 기본', shopType: '붙임머리', bgId: 'pink', elements: [] },
  { id: 'tpl_hair2', name: '붙임머리 심플', shopType: '붙임머리', bgId: 'white', elements: [] },
  { id: 'tpl_nail1', name: '네일 핑크', shopType: '네일', bgId: 'pink', elements: [] },
  { id: 'tpl_nail2', name: '네일 클라우드', shopType: '네일', bgId: 'cloud_color', elements: [] },
];

function _loadUserTemplates() {
  try { return JSON.parse(localStorage.getItem('itdasy_user_templates') || '[]'); } catch(_) { return []; }
}
function _saveUserTemplates(arr) {
  localStorage.setItem('itdasy_user_templates', JSON.stringify(arr));
}

function openTemplatePanel() {
  document.getElementById('templatePanel').classList.add('ws-panel--open');
  _renderTemplatePanel();
}
function closeTemplatePanel() {
  document.getElementById('templatePanel').classList.remove('ws-panel--open');
}

function _renderTemplatePanel() {
  const body = document.getElementById('templatePanelBody');
  if (!body) return;

  const shopType = localStorage.getItem('shop_type') || '붙임머리';
  const userTemplates = _loadUserTemplates();
  const defaultForShop = DEFAULT_TEMPLATES.filter(t => t.shopType === shopType || t.shopType === '공통');
  const allBgs = [...DEFAULT_BACKGROUNDS, ..._loadUserBgs()];

  const renderCard = (tpl, isUser) => {
    const bg = allBgs.find(b => b.id === tpl.bgId) || allBgs[0];
    const preview = bg.imageData
      ? `<img src="${bg.imageData}" alt="${tpl.name}">`
      : `<div style="width:100%;height:100%;background:${bg.gradient || bg.color};"></div>`;
    return `
      <div class="gp-card" onclick="applyTemplate('${tpl.id}')">
        <div class="gp-card__thumb">${preview}</div>
        <div class="gp-card__name">${tpl.name}</div>
        ${isUser ? `<button class="gp-del-btn" onclick="deleteTemplate('${tpl.id}',event)" aria-label="삭제">×</button>` : ''}
      </div>`;
  };

  body.innerHTML = `
    ${userTemplates.length ? `
      <div class="gp-section">
        <p class="gp-section-lbl">${_IC_SAVE} 내 템플릿</p>
        <div class="gp-grid gp-grid--3">${userTemplates.map(t => renderCard(t, true)).join('')}</div>
      </div>` : ''}
    <div class="gp-section">
      <p class="gp-section-lbl">${_IC_GRID} 기본 템플릿 (${shopType})</p>
      <div class="gp-grid gp-grid--3">${defaultForShop.map(t => renderCard(t, false)).join('')}</div>
    </div>
    <div class="gp-save-section">
      <p class="gp-section-lbl">현재 설정을 템플릿으로 저장</p>
      <div class="gp-save-row">
        <input type="text" id="newTemplateName" placeholder="템플릿 이름" class="gp-field">
        <button onclick="saveCurrentAsTemplate()" class="btn-primary">저장</button>
      </div>
    </div>
  `;
}

// [2026-05-17] target_ratio 옵션 인자 추가 — 미지정 시 '1:1' (기존 동작).
async function applyTemplate(tplId, opts = {}) {
  const target_ratio = opts.target_ratio || '1:1';
  const slot = _slots.find(s => s.id === _popupSlotId);
  if (!slot) return;
  const selectedPhotos = slot.photos.filter(p => _popupSelIds.has(p.id) && !p.hidden);
  if (!selectedPhotos.length) { showToast('먼저 사진을 선택해주세요'); return; }
  const allTemplates = [...DEFAULT_TEMPLATES, ..._loadUserTemplates()];
  const tpl = allTemplates.find(t => t.id === tplId);
  if (!tpl) return;
  closeTemplatePanel();
  const progress = document.getElementById('popupProgress');
  if (progress) { progress.style.display = 'block'; progress.textContent = `템플릿 적용 중...`; }
  const allBgs = [...DEFAULT_BACKGROUNDS, ..._loadUserBgs()];
  const bg = allBgs.find(b => b.id === tpl.bgId);
  for (const photo of selectedPhotos) {
    if (bg) try { await _applyBgToPhoto(photo, bg, slot, target_ratio); } catch (_e) { /* ignore */ }
  }
  if (progress) progress.style.display = 'none';
  _popupSelIds.clear();
  _renderPopupPhotoGrid(slot);
  showToast(`${selectedPhotos.length}장에 템플릿 적용 완료!`);
}

function saveCurrentAsTemplate() {
  const name = document.getElementById('newTemplateName')?.value?.trim();
  if (!name) { showToast('템플릿 이름을 입력해주세요'); return; }
  const templates = _loadUserTemplates();
  templates.push({ id: 'tpl_user_' + Date.now(), name: name.slice(0, 12), shopType: localStorage.getItem('shop_type') || '붙임머리', bgId: _selectedBgId || 'white', elements: [] });
  _saveUserTemplates(templates);
  _renderTemplatePanel();
  showToast('템플릿 저장됨!');
}

async function deleteTemplate(id, e) {
  e.stopPropagation();
  if (!(await nativeConfirm('템플릿 삭제', '이 템플릿을 삭제할까요?', '삭제'))) return;
  _saveUserTemplates(_loadUserTemplates().filter(t => t.id !== id));
  _renderTemplatePanel();
}

// ═══════════════════════════════════════════════════════
// [v186 2026-05-18] 사진 편집기 통합용 외부 API
//   편집기 bg 탭에서 직접 배경 카드 클릭 → 누끼 + 합성 결과 dataURL 반환.
//   _applyBgToPhoto 의 합성 로직 재활용 (fake photo / slot 주입).
// ═══════════════════════════════════════════════════════
window.GALLERY_BG_LIST = function () {
  // DEFAULT (procedural 포함) + 사용자 추가 배경
  return [...DEFAULT_BACKGROUNDS, ..._loadUserBgs()];
};

// composeBgForEditor(srcUrl, bgId, targetRatio, preRemovedBgUrl?)
//   → { composedDataUrl, removedBgDataUrl } — removedBgDataUrl 캐시해서 다음 호출 시 재활용
window.composeBgForEditor = async function (srcUrl, bgId, target_ratio, preRemovedBgUrl, opts = {}) {
  const allBgs = window.GALLERY_BG_LIST();
  const bg = allBgs.find(b => b.id === bgId);
  if (!bg) throw new Error('배경을 찾지 못했어요: ' + bgId);
  const Composer = window.PhotoEditorBgCompose;
  if (!Composer || typeof Composer.compose !== 'function') throw new Error('배경 합성 모듈 로드 실패');
  return await Composer.compose({
    srcUrl,
    bg,
    targetRatio: target_ratio || '1:1',
    preRemovedBgUrl,
    shadow: opts.shadow || { mode: 'none' },
  });
};

