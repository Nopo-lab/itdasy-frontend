/* caption-keyword-tags.js — 캡션 입력의 '시술 키워드 태그' (업종별 기본 + 커스텀/삭제)
   [B-분할] app-caption.js 에서 분리(2026-06-30). 전역 함수 유지 — 호출부 그대로.
   상태/데이터(SHOP_KEYWORDS + localStorage 키워드)는 이 기능 전용 → 통째 이동.
   의존(전역, 코어): _capEsc / window._inlinePrompt.
   공개: renderCaptionKeywordTags() / toggleCaptionTag() / deleteCaptionKeyword() / showAddKeywordInput() / getShopKeywords() */

const SHOP_KEYWORDS = {
  '붙임머리': ['14인치','18인치','22인치','24인치','26인치','28인치','30인치','특수인치','옴브레','재시술','볼륨업','자연스러운','롱헤어'],
  '네일아트': ['젤네일','아트','프렌치','이달의아트','글리터','원톤','그라데이션','스톤','매트','자개'],
  '네일': ['젤네일','아트','프렌치','이달의아트','글리터','원톤','그라데이션','스톤','매트','자개'],
  '헤어': ['단발','투블럭','펌','염색','탈색','클리닉','레이어드','다운펌','뿌리염색','손상모','갈색염색','히피펌'],
  '미용실': ['단발','레이어드','다운펌','펌','염색','뿌리염색','갈색염색','손상모','클리닉','셋팅','남성컷','히피펌'],
  '속눈썹': ['볼륨','클래식','내추럴','C컬','D컬','J컬','CC컬','브라운','속눈썹펌','래쉬리프트','하속눈썹'],
  '왁싱': ['브라질리언','바디왁싱','페이스왁싱','겨드랑이','팔다리','인모','슈가링','재방문'],
  '피부': ['수분관리','여드름','모공','미백','탄력','스케일링','아쿠아필','리프팅'],
};

// 사용자 커스텀 키워드 (localStorage)
function _loadCustomKeywords() {
  try { return JSON.parse(localStorage.getItem('itdasy_custom_keywords') || '[]'); } catch(_) { return []; }
}
function _saveCustomKeywords(arr) {
  localStorage.setItem('itdasy_custom_keywords', JSON.stringify(arr));
}

// 삭제된 기본 키워드 (localStorage)
function _loadDeletedKeywords() {
  try { return JSON.parse(localStorage.getItem('itdasy_deleted_keywords') || '[]'); } catch(_) { return []; }
}
function _saveDeletedKeywords(arr) {
  localStorage.setItem('itdasy_deleted_keywords', JSON.stringify(arr));
}

// 영문/제네릭 업종값 → 한글 키 정규화. 'beauty'처럼 특정 업종이 아닌 값은 '' → 키워드 없음(업종 고르게).
const SHOP_TYPE_ALIAS = {
  hair: '헤어', salon: '미용실', nail: '네일', nailart: '네일아트', lash: '속눈썹', eyelash: '속눈썹',
  waxing: '왁싱', skin: '피부', skincare: '피부', extension: '붙임머리', hair_extension: '붙임머리', beauty: '',
};
function _resolveShopType() {
  let t = localStorage.getItem('shop_type') || '';
  if (Object.prototype.hasOwnProperty.call(SHOP_TYPE_ALIAS, t)) t = SHOP_TYPE_ALIAS[t];
  return t;
}
// 현재 업종에 맞는 키워드 목록 반환 (기본 - 삭제 + 커스텀)
// [fix] 업종 미설정/미매핑(beauty 등)이면 '붙임머리'로 폴백하지 않는다 — 미용실인데 인치태그 쏟아지던 버그.
function getShopKeywords() {
  const shopType = _resolveShopType();
  const base = SHOP_KEYWORDS[shopType];
  const custom = _loadCustomKeywords();
  if (!base) return [...new Set(custom)];   // 업종 미확정 → 커스텀만(자동 인치태그 금지)
  const deleted = _loadDeletedKeywords();
  const filtered = base.filter(k => !deleted.includes(k));
  return [...new Set([...filtered, ...custom])];
}

// ═══════════════════════════════════════════════════════
// 캡션 입력 UI 렌더링 (동적 키워드 태그)
// ═══════════════════════════════════════════════════════
function renderCaptionKeywordTags() {
  const container = document.getElementById('typeTags');
  if (!container) return;

  const keywords = getShopKeywords();

  // [SEC-R2-1] XSS 방지 — 키워드를 이스케이프하여 삽입
  container.innerHTML = keywords.map(k => {
    const safe = _capEsc(k);
    return `<span class="tag" data-v="${safe}" data-caption-tag>${safe}<button class="tag-delete" data-kw="${safe}" data-caption-delete-keyword>×</button></span>`;
  }).join('') + `<span class="tag tag-add" data-caption-add-keyword>+ 추가</span>`;
  container.querySelectorAll('[data-caption-tag]').forEach(tag => {
    tag.addEventListener('click', () => toggleCaptionTag(tag));
  });
  container.querySelectorAll('[data-caption-delete-keyword]').forEach(btn => {
    btn.addEventListener('click', event => deleteCaptionKeyword(btn.dataset.kw, event));
  });
  container.querySelector('[data-caption-add-keyword]')?.addEventListener('click', showAddKeywordInput);
}


function toggleCaptionTag(el) {
  if (el.classList.contains('tag-add')) return;
  el.classList.toggle('on');
}

function deleteCaptionKeyword(keyword, e) {
  e.stopPropagation();
  const base = SHOP_KEYWORDS[localStorage.getItem('shop_type') || '붙임머리'] || [];
  if (base.includes(keyword)) {
    // 기본 키워드는 삭제 목록에 추가
    const deleted = _loadDeletedKeywords();
    if (!deleted.includes(keyword)) {
      deleted.push(keyword);
      _saveDeletedKeywords(deleted);
    }
  } else {
    // 커스텀 키워드는 직접 삭제
    const custom = _loadCustomKeywords();
    _saveCustomKeywords(custom.filter(k => k !== keyword));
  }
  renderCaptionKeywordTags();
}

function showAddKeywordInput() {
  window._inlinePrompt('추가할 키워드를 입력하세요:', '', (keyword) => {
    const trimmed = keyword.trim();
    if (!trimmed) return;
    const custom = _loadCustomKeywords();
    if (!custom.includes(trimmed)) {
      custom.push(trimmed);
      _saveCustomKeywords(custom);
    }
    // 삭제 목록에서도 제거 (복원)
    const deleted = _loadDeletedKeywords();
    _saveDeletedKeywords(deleted.filter(k => k !== trimmed));
    renderCaptionKeywordTags();
    // 새로 추가된 태그 자동 선택
    setTimeout(() => {
      const tag = document.querySelector(`#typeTags .tag[data-v="${trimmed}"]`);
      if (tag) tag.classList.add('on');
    }, 50);
  });
  return;
}
