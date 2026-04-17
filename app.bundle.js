// Itdasy Studio - Core (설정, 인증, 유틸, 탭, 온보딩)

// ===== 백엔드 설정 =====
const PROD_API = 'https://itdasy260417-production.up.railway.app';
const API = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:8000'
  : PROD_API;

let _instaHandle = '';  // checkInstaStatus에서 저장

function showToast(msg) {
  const t = document.getElementById('copyToast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

function showWelcome(shopName) {
  const overlay = document.getElementById('welcomeOverlay');
  const nameEl  = document.getElementById('welcomeShopName');
  if (!overlay) return;
  if (nameEl) nameEl.textContent = shopName || '사장';
  overlay.classList.add('show');
  setTimeout(() => {
    overlay.classList.add('hide');
    setTimeout(() => overlay.classList.remove('show', 'hide'), 400);
  }, 1800);
}

function isKakaoTalk() {
  return /KAKAOTALK/i.test(navigator.userAgent);
}

function showInstallGuide(extraMsg) {
  const el = document.getElementById('installGuideModal');
  const card = document.getElementById('installGuideCard');
  document.getElementById('installGuideExtra').textContent = extraMsg || '';
  el.style.display = 'flex';
  setTimeout(() => { card.style.transform = 'scale(1)'; card.style.opacity = '1'; }, 10);
}
function hideInstallGuide() {
  const el = document.getElementById('installGuideModal');
  const card = document.getElementById('installGuideCard');
  card.style.transform = 'scale(0.8)'; card.style.opacity = '0';
  setTimeout(() => { el.style.display = 'none'; }, 300);
}

async function loadSubscriptionBadge() {
  try {
    const r = await fetch(API + '/subscription/status', { headers: authHeader() });
    if (!r.ok) return;
    const d = await r.json();
    const badge = document.getElementById('planBadge');
    if (badge) {
      const labels = { free: 'Free', pro: 'Pro', premium: 'Premium' };
      badge.textContent = labels[d.plan] || 'Free';
      badge.style.background = d.plan === 'pro' ? 'linear-gradient(135deg,#f18091,#ff9aa8)' : d.plan === 'premium' ? 'linear-gradient(135deg,#833ab4,#fd1d1d)' : '#e0e0e0';
      badge.style.color = d.plan === 'free' ? '#888' : '#fff';
    }
  } catch(e) {}
}

function updateHeaderProfile(handle, tone, picUrl) {
  const el = document.getElementById('headerPersona');
  if (!el) return;
  el.style.display = 'flex';
  loadSubscriptionBadge();

  const shopName = localStorage.getItem('shop_name') || '사장님';
  const shopNameEl = document.getElementById('headerShopName');
  if (shopNameEl) shopNameEl.textContent = shopName;

  const publishLabel = document.getElementById('publishBtnLabel');
  if (publishLabel) publishLabel.textContent = `${shopName} 피드에 바로 올리기`;

  const statusEl = document.getElementById('headerPersonaName');
  if (statusEl) {
    statusEl.textContent = handle ? `${handle} · ${tone || '말투 분석 완료'}` : (tone || '말투 분석 대기 중');
  }

  // 헤더 아바타: 이미지 있으면 img, 없으면 이니셜
  const avatarEl = document.getElementById('headerAvatar');
  if (avatarEl) {
    if (picUrl) {
      avatarEl.innerHTML = `<img src="${picUrl}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    } else {
      const letter = (shopName || '사장님')[0]?.toUpperCase() || '✨';
      avatarEl.textContent = letter;
    }
  }

  // 인스타 프레임 핸들 + 아바타 갱신 (미리보기용)
  const fh = document.getElementById('frameHandle');
  if (fh && handle) fh.textContent = '@' + handle.replace('@','');
  const fi = document.getElementById('frameAvatarInner');
  if (fi) {
    if (picUrl) {
      fi.innerHTML = `<img src="${picUrl}" alt="" style="width:100%;height:100%;object-fit:cover;">`;
    } else {
      const letter = (shopName || '사장님')[0]?.toUpperCase() || '✨';
      fi.innerHTML = `<span id="frameAvatarLetter">${letter}</span>`;
    }
  }
}

// ───── 업종별 설정 ─────
const SHOP_CONFIG = {
  '붙임머리': {
    question:    '오늘 어떤 붙임머리 작업을 하셨나요? 💇',
    tagLabel:    '인치 선택',
    treatments:  ['18인치','20인치','22인치','24인치','26인치','28인치','30인치','특수인치','옴브레','재시술'],
    defaultTag:  '24인치',
    baGuide:     '시술 전후 머리 길이 변화를 극명하게 보여주세요. 옆모습 기준이 효과적이에요 💇',
  },
  '네일아트': {
    question:    '오늘 어떤 네일 작업을 하셨나요? 💅',
    tagLabel:    '시술 종류',
    treatments:  ['젤네일','아트네일','아크릴','스컬프처','네일케어','오프','재시술','페디큐어'],
    defaultTag:  '젤네일',
    baGuide:     '손톱 클로즈업으로 Before/After 변화를 선명하게 보여주세요 💅',
  },
};

function applyShopType(type) {
  const cfg = SHOP_CONFIG[type];
  if (!cfg) return;

  const shopName = localStorage.getItem('shop_name') || '사장님';

  // 홈 질문 카드 (개인화)
  const q = document.getElementById('homeQuestion');
  if (q) {
      // 구체적인 작업 유형 추출 (예: '붙임머리')
      const jobAction = cfg.tagLabel.replace(' 시술', '').replace(' 작업', '');
      q.innerHTML = `<span style="color:var(--accent2); font-weight:800;">${shopName}</span> 대표님!<br>오늘 어떤 <span style="background:rgba(241,128,145,0.08); padding:0 4px; border-radius:4px;">${jobAction}</span> 작업을 하셨나요? ✨`;
  }

  // 시술 태그 라벨
  const lbl = document.getElementById('typeTagLabel');
  if (lbl) lbl.textContent = cfg.tagLabel;

  // 시술 태그 재빌드
  const container = document.getElementById('typeTags');
  if (container) {
    container.innerHTML = '';
    cfg.treatments.forEach(t => {
      const span = document.createElement('span');
      span.className = 'tag' + (t === cfg.defaultTag ? ' on' : '');
      span.dataset.v = t;
      span.textContent = t;
      container.appendChild(span);
    });
    initSingle('typeTags');
  }

  // BA 가이드 텍스트
  const baGuide = document.getElementById('baGuideText');
  if (baGuide) baGuide.textContent = cfg.baGuide;
}

// ───── 온보딩 ─────
let obStep = 1;
let obShopType = '';

function checkOnboarding() {
  if (!localStorage.getItem('onboarding_done')) {
    document.getElementById('onboardingOverlay').classList.remove('hidden');
  } else {
    const savedType = localStorage.getItem('shop_type') || '';
    applyShopType(savedType);
  }
}

function updateHomeQuestion() {
  const type = localStorage.getItem('shop_type') || '';
  applyShopType(type);
}

function goCaption() {
  showTab('caption', document.querySelectorAll('.nav-btn')[2]);
}

function selectShopType(card) {
  document.querySelectorAll('.ob-shop-card:not(.disabled)').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  obShopType = card.dataset.type;
}

function obShowStep(n) {
  document.querySelectorAll('.ob-step').forEach(s => s.classList.remove('active'));
  document.getElementById('ob-step-' + n).classList.add('active');
  document.querySelectorAll('.ob-dot').forEach((d, i) => {
    d.classList.toggle('active', i < n);
  });
  const btn = document.getElementById('obBtn');
  btn.textContent = n === 4 ? '시작하기 🎉' : '계속하기';
  obStep = n;
}

async function obNext() {
  if (obStep === 1) {
    obShowStep(2);
  } else if (obStep === 2) {
    if (!obShopType) {
      // 선택 안 했으면 카드 살짝 흔들기
      document.querySelectorAll('.ob-shop-card:not(.disabled)').forEach(c => {
        c.style.transition = 'transform 0.1s';
        c.style.transform = 'scale(0.96)';
        setTimeout(() => c.style.transform = '', 150);
      });
      return;
    }
    obShowStep(3);
    setTimeout(() => document.getElementById('obShopNameInput').focus(), 300);
  } else if (obStep === 3) {
    const name = document.getElementById('obShopNameInput').value.trim();
    if (!name) {
      document.getElementById('obShopNameInput').style.borderBottomColor = '#E05555';
      setTimeout(() => document.getElementById('obShopNameInput').style.borderBottomColor = '', 1200);
      return;
    }
    localStorage.setItem('shop_name', name); // 로컬에도 저장해서 즉시 반영
    document.getElementById('obCompleteName').textContent = name;
    obShowStep(4);
    // 백엔드에 샵 이름 저장 (에러 무시)
    fetch(API + '/shop/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ shop_name: name })
    }).catch(() => {});
  } else if (obStep === 4) {
    const name = document.getElementById('obShopNameInput').value.trim();
    localStorage.setItem('onboarding_done', '1');
    localStorage.setItem('shop_type', obShopType);
    if (name) localStorage.setItem('shop_name', name);

    document.getElementById('onboardingOverlay').classList.add('hidden');
    applyShopType(obShopType);
    updateHeaderProfile(null, null, null);
  }
}

// Step 3 Enter 키
document.getElementById('obShopNameInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') obNext();
});

function getToken() {
  const t = localStorage.getItem('itdasy_token');
  if (!t) return null;
  try {
    const payload = JSON.parse(atob(t.split('.')[1]));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      localStorage.removeItem('itdasy_token');
      return null;
    }
  } catch { return null; }
  return t;
}
function setToken(t) { localStorage.setItem('itdasy_token', t); }
function authHeader() { return { 'Authorization': 'Bearer ' + getToken(), 'ngrok-skip-browser-warning': 'true' }; }

function getMyUserId() {
  try {
    const token = getToken();
    if (!token) return null;
    return parseInt(JSON.parse(atob(token.split('.')[1])).sub);
  } catch { return null; }
}

// ───── 스플래시 스크린 (iOS PWA 전용) ─────
(function initSplash() {
  const isPWA = window.navigator.standalone === true
             || window.matchMedia('(display-mode: standalone)').matches;
  if (!isPWA) return;

  const splash = document.getElementById('splashScreen');
  if (!splash) return;

  // 메인 콘텐츠 숨기고 스플래시 표시
  document.body.classList.add('splashing');
  splash.style.display = 'flex';

  // 2.0s → 페이드아웃 시작, 2.3s → 완전 제거
  setTimeout(() => {
    splash.classList.add('fade-out');
    setTimeout(() => {
      splash.style.display = 'none';
      document.body.classList.remove('splashing');
    }, 300);
  }, 2000);
})();

// ───── 설정 바텀시트 ─────
function openSettings() {
  const sheet = document.getElementById('settingsSheet');
  const card  = document.getElementById('settingsCard');

  // 프로필 카드 업데이트
  const shopName = localStorage.getItem('shop_name') || document.getElementById('headerShopName')?.textContent || '사장님';
  const profileNameEl  = document.getElementById('settingsProfileName');
  const profileHandleEl = document.getElementById('settingsProfileHandle');
  const settingsAvatarEl = document.getElementById('settingsAvatar');

  if (profileNameEl)   profileNameEl.textContent  = shopName;
  if (profileHandleEl) profileHandleEl.textContent = _instaHandle ? `@${_instaHandle}` : '인스타 미연동';

  // 헤더 아바타 복사
  const headerAvatarEl = document.getElementById('headerAvatar');
  if (settingsAvatarEl && headerAvatarEl) {
    const img = headerAvatarEl.querySelector('img');
    if (img) {
      settingsAvatarEl.innerHTML = `<img src="${img.src}" alt="">`;
    } else {
      settingsAvatarEl.textContent = headerAvatarEl.textContent || shopName[0] || '잇';
    }
  }

  // 먼저 display, 한 프레임 뒤 open (두 번 rAF로 확실히 렌더 후 transition 발동)
  card.classList.remove('open');
  sheet.style.display = 'flex';
  requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('open')));
}

function closeSettings() {
  const sheet = document.getElementById('settingsSheet');
  const card  = document.getElementById('settingsCard');
  card.classList.remove('open');
  setTimeout(() => { sheet.style.display = 'none'; }, 280);
}

function resetShopSetup() {
  if (!confirm('샵 이름과 종류를 다시 설정할까요?')) return;
  localStorage.removeItem('shop_name');
  localStorage.removeItem('shop_type');
  localStorage.removeItem('onboarding_done');
  const ob = document.getElementById('onboardingOverlay');
  if (ob) ob.classList.remove('hidden');
}

async function localReset() {
  if (!confirm('앱을 처음 상태로 초기화할까요?\n(로그인은 유지됩니다)')) return;
  ['itdasy_consented','itdasy_consented_at','itdasy_latest_analysis',
   'onboarding_done','shop_name','shop_type'].forEach(k => localStorage.removeItem(k));
  // 인스타 연동도 백엔드에서 해제
  try { await fetch(API + '/instagram/disconnect', { method: 'POST', headers: authHeader() }); } catch(_) {}
  location.reload();
}

function checkCbt1Reset() {
  if (getMyUserId() === 1) {
    const el = document.getElementById('cbt1ResetArea');
    if (el) el.style.display = 'block';
  }
}

async function fullReset() {
  if (!confirm('⚠️ 모든 데이터(온보딩·샵설정·인스타연동·말투분석)가 초기화됩니다.\n정말 처음부터 시작할까요?')) return;
  try {
    const res = await fetch(API + '/admin/reset', { method: 'POST', headers: authHeader() });
    if (!res.ok) throw new Error('초기화 실패');
    ['itdasy_token','itdasy_consented','itdasy_consented_at','itdasy_latest_analysis','onboarding_done','shop_name','shop_type','itdasy_master_set'].forEach(k => localStorage.removeItem(k));
    // 말투 카드 즉시 숨기기
    const pd = document.getElementById('personaDash');
    if (pd) { pd.style.display = 'none'; const pc = document.getElementById('personaContent'); if (pc) pc.innerHTML = ''; }
    alert('초기화 완료! 처음부터 시작합니다.');
    location.reload();
  } catch(e) {
    alert('오류: ' + e.message);
  }
}

function handle401() {
  setToken(null);
  document.body.style.transform  = '';
  document.body.style.transition = '';
  document.getElementById('lockOverlay').classList.remove('hidden');
  document.getElementById('sessionExpiredMsg').style.display = 'block';
}

async function logout() {
  if (!confirm("로그아웃 하시겠습니까? 세션과 캐시가 모두 초기화됩니다.")) return;

  // 1. 토큰 및 로컬 스토리지 삭제
  setToken(null);
  // 세션 관련 키만 삭제 (온보딩 등 설정 유지)
  ['itdasy_token', 'itdasy_consented', 'itdasy_consented_at', 'itdasy_latest_analysis'].forEach(k => localStorage.removeItem(k));

  // 2. 서비스 워커 캐시 강제 삭제
  if ('caches' in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
      console.log('Caches cleared');
    } catch (e) { console.error('Cache clear fail', e); }
  }

  // 3. 페이지 새로고침 (클린 캐시 상태로 진입)
  location.href = 'index.html'; // 아예 홈으로 보냄
}


// 로그인
async function login() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const btn = document.getElementById('loginBtn');
  const errEl = document.getElementById('loginError');
  errEl.style.display = 'none';
  if (!email || !password) { errEl.textContent = '이메일과 비밀번호를 입력해주세요.'; errEl.style.display = 'block'; return; }
  btn.textContent = '로그인 중...'; btn.disabled = true;
  try {
    const res = await fetch(API + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || '로그인 실패');
    setToken(data.access_token);
    document.getElementById('lockOverlay').classList.add('hidden');
    checkCbt1Reset();
    checkOnboarding();
    checkInstaStatus(true); // 로그인 직후: 서버 shop_name으로 환영 처리
  } catch(e) {
    errEl.textContent = e.message;
    errEl.style.display = 'block';
  }
  btn.textContent = '로그인'; btn.disabled = false;
}

// ===== 앱 초기화 (모든 모듈 로드 후 실행) =====
window.addEventListener('load', function() {
  // Enter 키 로그인
  document.getElementById('loginPassword').addEventListener('keydown', e => { if(e.key === 'Enter') login(); });

  // Chrome으로 이동 시 토큰 자동 복원 + 연동 자동 실행
  (function() {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('_t');
    if (t) {
      setToken(decodeURIComponent(t));
      history.replaceState(null, '', window.location.pathname);
    }
  })();

  // 토큰 있으면 자동 로그인
  if(getToken()) {
    document.getElementById('lockOverlay').classList.add('hidden');
    checkCbt1Reset();
    checkOnboarding();
    checkInstaStatus().then(() => {
      // 인스타 OAuth 콜백 후 내 말투 자동 완성
      const params = new URLSearchParams(window.location.search);
      if (params.get('connected') === 'success') {
        history.replaceState(null, '', window.location.pathname);
        setTimeout(runPersonaAnalyze, 800);
      }
      // Chrome 이동 후 자동 연동 시작
      if (params.get('auto_connect') === '1') {
        history.replaceState(null, '', window.location.pathname);
        setTimeout(connectInstagram, 500);
      }
    });

    // 기존 동의 완료 시각 복원
    const consentedAt = localStorage.getItem('itdasy_consented_at');
    const tsEl2 = document.getElementById('consentTimestampDisplay');
    if (tsEl2) {
      if (consentedAt) {
        tsEl2.textContent = `✅ 개인정보 동의 완료 · ${consentedAt}`;
        tsEl2.style.display = 'inline';
      } else {
        tsEl2.textContent = '';
        tsEl2.style.display = 'none';
      }
    }
  }
});

function expandSmartMenu() {
  openQuickAction();
}

function openQuickAction() {
  const popup = document.getElementById('quickActionPopup');
  const content = popup ? popup.querySelector('.popup-content') : null;
  if (!popup || !content) return;
  popup.style.display = 'flex';
  setTimeout(() => {
    content.style.transform = 'scale(1)';
    content.style.opacity = '1';
  }, 10);
}

function closeQuickAction() {
  const popup = document.getElementById('quickActionPopup');
  const content = popup ? popup.querySelector('.popup-content') : null;
  if (!popup || !content) return;
  content.style.transform = 'scale(0.8)';
  content.style.opacity = '0';
  setTimeout(() => {
    popup.style.display = 'none';
  }, 300);
}

// 탭 전환
function showTab(id, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const target = document.getElementById('tab-' + id);
  if (target) target.classList.add('active');
  if (btn) btn.classList.add('active');
  // 탭 전환 시 스크롤 맨 위로 리셋
  window.scrollTo(0, 0);
  document.body.scrollTop = 0;
  document.documentElement.scrollTop = 0;
}

// 태그 선택 (single)
function initSingle(id) {
  document.getElementById(id).querySelectorAll('.tag, .style-opt').forEach(t => {
    t.addEventListener('click', () => {
      document.getElementById(id).querySelectorAll('.tag, .style-opt').forEach(x => x.classList.remove('on'));
      t.classList.add('on');
    });
  });
}
// 태그 선택 (multi)
function initMulti(id) {
  document.getElementById(id).querySelectorAll('.tag').forEach(t => {
    t.addEventListener('click', () => t.classList.toggle('on'));
  });
}

// DOM 초기화 (DOMContentLoaded 보장)
document.addEventListener('DOMContentLoaded', function() {
  initSingle('typeTags');
  document.querySelectorAll('.style-opts').forEach(g => {
    g.querySelectorAll('.style-opt').forEach(t => {
      t.addEventListener('click', () => {
        g.querySelectorAll('.style-opt').forEach(x => x.classList.remove('on'));
        t.classList.add('on');
      });
    });
  });
  const bgOpts = document.getElementById('bgOpts');
  if (bgOpts) bgOpts.querySelectorAll('.style-opt').forEach(t => {
    t.addEventListener('click', () => {
      bgOpts.querySelectorAll('.style-opt').forEach(x => x.classList.remove('on'));
      t.classList.add('on');
      window._customBgUrl = null;
      const toggleBtn = document.getElementById('bgStoreToggle');
      if (toggleBtn && toggleBtn.textContent.includes('선택됨')) toggleBtn.textContent = '📦 배경 창고 열기';
      document.querySelectorAll('#bgStoreGrid > div').forEach(cell => { cell.style.outline = ''; });
    });
  });
  const editWmOpts = document.getElementById('editWmOpts');
  if (editWmOpts) editWmOpts.querySelectorAll('.style-opt').forEach(t => {
    t.addEventListener('click', () => {
      editWmOpts.querySelectorAll('.style-opt').forEach(x => x.classList.remove('on'));
      t.classList.add('on');
    });
  });
});

function getSel(id) {
  return [...document.getElementById(id).querySelectorAll('.tag.on, .style-opt.on')].map(t => t.dataset.v || t.textContent.trim());
}

// ─────────────────────────────────────────────
//  Service Worker 등록 — 새 버전 배포 시 캐시 자동 갱신
// ─────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/itdasy-frontend/sw.js')
    .then(reg => {
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'activated') {
            console.log('[SW] 새 버전 적용됨 — 캐시 갱신 완료');
          }
        });
      });
    })
    .catch(err => console.warn('[SW] 등록 실패:', err));

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
}

// ───── Pull-to-Refresh (iOS PWA 전용) ─────
(function initPTR() {
  if (!window.navigator.standalone) return;

  const THRESHOLD  = 120;
  const RESISTANCE = 0.4;
  const SPRING     = 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1)';
  const BAR_H      = 56;

  const LABEL = document.getElementById('ptrLabel');
  const EMOJI = document.getElementById('ptrEmoji');

  let startY    = 0;
  let pulling   = false;
  let triggered = false;
  let loading   = false;

  function applyMove(move) {
    document.body.style.transition = 'none';
    document.body.style.transform  = `translateY(${move}px)`;
  }

  function springBack(onDone) {
    document.body.style.transition = SPRING;
    document.body.style.transform  = 'translateY(0)';
    setTimeout(() => {
      document.body.style.transition = '';
      document.body.style.transform  = '';
      if (onDone) onDone();
    }, 500);
  }

  function resetIndicator() {
    LABEL.textContent    = '당겨서 새로고침';
    LABEL.style.color    = '';
    EMOJI.style.transform = '';
    EMOJI.style.color     = '';
    EMOJI.classList.remove('spin');
  }

  document.addEventListener('touchstart', e => {
    if (loading) return;
    const lock = document.getElementById('lockOverlay');
    if (lock && !lock.classList.contains('hidden')) return;
    const ob = document.getElementById('onboardingOverlay');
    if (ob && !ob.classList.contains('hidden')) return;
    if ((window.scrollY || document.documentElement.scrollTop) > 0) return;
    if (e.touches.length !== 1) return;
    startY    = e.touches[0].clientY;
    pulling   = true;
    triggered = false;
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (!pulling || loading) return;
    if (e.touches.length !== 1) { pulling = false; springBack(); return; }

    const dy   = e.touches[0].clientY - startY;
    if (dy <= 0) { pulling = false; return; }

    e.preventDefault();

    const move = dy * RESISTANCE;
    applyMove(move);

    if (dy >= THRESHOLD) {
      if (!triggered) {
        triggered = true;
        LABEL.textContent    = '놓으면 새로고침!';
        LABEL.style.color    = '#F18091';
        EMOJI.style.transform = 'scale(1.35)';
        EMOJI.style.color     = '#F18091';
      }
    } else {
      if (triggered) {
        triggered = false;
        LABEL.textContent    = '당겨서 새로고침';
        LABEL.style.color    = '';
        EMOJI.style.transform = 'scale(1)';
        EMOJI.style.color     = '';
      }
    }
  }, { passive: false });

  document.addEventListener('touchend', async () => {
    if (!pulling) return;
    pulling = false;

    if (!triggered) {
      springBack(resetIndicator);
      return;
    }

    loading = true;
    LABEL.textContent    = '확인 중...';
    EMOJI.classList.add('spin');
    EMOJI.style.transform = '';

    try { await checkInstaStatus(); } catch (_) {}

    springBack(() => {
      resetIndicator();
      loading = false;
      showToast('✨ 최신 상태예요!');
    });
  });
})();

// Module에서 접근 가능하도록 window에 노출
window.API = API;
window.authHeader = authHeader;

// 비밀번호 재설정 요청
async function forgotPassword() {
  const email = document.getElementById('loginEmail').value;
  if (!email) { alert('이메일을 먼저 입력해주세요.'); return; }
  try {
    const r = await fetch(API + '/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const d = await r.json();
    alert(d.message || '재설정 링크를 이메일로 보냈습니다.');
  } catch(e) { alert('서버 연결 실패'); }
}

// ── 구독 플랜 팝업 ──
let _selectedPlan = 'pro';
let _currentPlan = 'free';

function openPlanPopup() {
  const popup = document.getElementById('planPopup');
  popup.style.display = 'flex';
  popup.onclick = (e) => { if (e.target === popup) closePlanPopup(); };
  loadPlanUsage();
  _selectedPlan = 'pro';
  highlightCurrentPlan();
}

function closePlanPopup() {
  document.getElementById('planPopup').style.display = 'none';
}

async function loadPlanUsage() {
  try {
    const r = await fetch(API + '/subscription/usage', { headers: authHeader() });
    if (!r.ok) return;
    const d = await r.json();
    _currentPlan = d.plan;
    const box = document.getElementById('planUsageContent');
    box.innerHTML = `
      캡션 생성: <b>${d.caption.used}/${d.caption.limit === 999 ? '무제한' : d.caption.limit}</b> (${d.caption.period === 'daily' ? '오늘' : '이번 달'})<br>
      누끼: <b>${d.removebg.used}/${d.removebg.limit === 999 ? '무제한' : d.removebg.limit}</b> (${d.removebg.period === 'daily' ? '오늘' : '이번 달'})<br>
      인스타 발행: <b>${d.publish.used}/${d.publish.limit === 999 ? '무제한' : d.publish.limit}</b> (이번 달)<br>
      AI 분석: <b>${d.analyze.used}/${d.analyze.limit === 999 ? '무제한' : d.analyze.limit}</b> (이번 달)
    `;
    highlightCurrentPlan();
  } catch(e) {}
}

function highlightCurrentPlan() {
  ['free','pro','premium'].forEach(p => {
    const card = document.getElementById('planCard' + p.charAt(0).toUpperCase() + p.slice(1));
    if (card) {
      if (p === _currentPlan) {
        card.style.opacity = '1';
        card.querySelector('div').insertAdjacentHTML('beforeend',
          card.querySelector('.current-tag') ? '' : '<span class="current-tag" style="margin-left:8px;font-size:10px;background:#28a745;color:#fff;padding:2px 6px;border-radius:6px;">현재</span>');
      }
    }
  });
  updatePlanButton();
}

function selectPlan(plan) {
  _selectedPlan = plan;
  document.querySelectorAll('.plan-card').forEach(c => c.style.transform = 'scale(1)');
  const card = document.getElementById('planCard' + plan.charAt(0).toUpperCase() + plan.slice(1));
  if (card) card.style.transform = 'scale(1.02)';
  updatePlanButton();
}

function updatePlanButton() {
  const btn = document.getElementById('planActionBtn');
  if (_selectedPlan === _currentPlan) {
    btn.textContent = '현재 플랜입니다';
    btn.style.background = '#e0e0e0';
    btn.style.cursor = 'default';
  } else if (_selectedPlan === 'free') {
    btn.textContent = 'Free로 변경';
    btn.style.background = '#888';
    btn.style.cursor = 'pointer';
  } else {
    btn.textContent = _currentPlan === 'free' ? '14일 무료체험 시작하기' : `${_selectedPlan === 'pro' ? 'Pro' : 'Premium'}로 변경`;
    btn.style.background = _selectedPlan === 'premium' ? 'linear-gradient(135deg,#833ab4,#fd1d1d)' : 'linear-gradient(135deg,#f18091,#ff9aa8)';
    btn.style.cursor = 'pointer';
  }
}

async function doPlanAction() {
  if (_selectedPlan === _currentPlan) return;

  if (_selectedPlan === 'free') {
    if (!confirm('Free 플랜으로 변경하면 기능이 제한됩니다. 계속할까요?')) return;
    try {
      await fetch(API + '/subscription/cancel', { method: 'POST', headers: authHeader() });
      showToast('Free 플랜으로 변경되었습니다');
      closePlanPopup();
      loadSubscriptionBadge();
    } catch(e) { alert('변경 실패'); }
    return;
  }

  // Pro/Premium 선택
  if (_currentPlan === 'free') {
    try {
      const r = await fetch(API + '/subscription/start-trial', { method: 'POST', headers: authHeader() });
      const d = await r.json();
      if (r.ok) {
        showToast(d.message || '무료체험이 시작되었습니다!');
        closePlanPopup();
        loadSubscriptionBadge();
      } else {
        alert(d.detail || '실패');
      }
    } catch(e) { alert('서버 연결 실패'); }
  } else {
    alert('플랜 변경은 고객센터로 문의해주세요.\nitdasy.official@gmail.com');
  }
}
// Itdasy Studio - Runtime payload spec validator
// 파일: app-spec-validator.js
// 역할: shared/schemas.json 기반 API payload 드리프트 조기 감지 레이더
//   * 실제 요청을 막지 않음 — 경고(console.warn + 토스트)만
//   * schemas.json 없거나 로드 실패 시 pass-through (앱 동작 영향 없음)
//   * app-core.js 이후, 다른 app-*.js 보다 먼저 로드 필요
//
// schemas.json 구조: { version, endpoints: { "METHOD /path": { request: { properties, required } } } }

(function () {
  'use strict';

  // null = 미로드 or 로드 실패(defensive pass-through)
  let _specSchemas = null;

  // ── schemas.json 1회 비동기 로드 ──────────────────────────────────
  // 상대 경로 사용 — GitHub Pages, localhost 양쪽 호환
  fetch('shared/schemas.json')
    .then(function (r) {
      if (!r.ok) return null; // 404 등 — 조용히 무시
      return r.json();
    })
    .then(function (data) {
      if (data && typeof data === 'object' && data.endpoints) {
        _specSchemas = data.endpoints; // endpoints 맵만 저장
      }
    })
    .catch(function () {
      // 네트워크 오류 / JSON 파싱 실패 — pass-through 유지
    });

  // ── 기본 타입 체크 헬퍼 ──────────────────────────────────────────
  function _checkType(value, expectedType) {
    if (expectedType === 'array')  return Array.isArray(value);
    if (expectedType === 'object') return (
      typeof value === 'object' && !Array.isArray(value) && value !== null
    );
    return typeof value === expectedType; // string / number / boolean
  }

  // ── anyOf 포함 enum 추출 헬퍼 ────────────────────────────────────
  // {"enum": [...]} or {"anyOf": [{"enum": [...]}, {"type": "null"}]} 처리
  function _extractEnum(def) {
    if (def.enum && def.enum.length > 0) return def.enum;
    if (Array.isArray(def.anyOf)) {
      var merged = [];
      def.anyOf.forEach(function (sub) {
        if (sub.enum) merged = merged.concat(sub.enum);
      });
      return merged.length > 0 ? merged : null;
    }
    return null;
  }

  // ── anyOf 포함 type 추출 헬퍼 ────────────────────────────────────
  function _extractTypes(def) {
    if (def.type) return [def.type];
    if (Array.isArray(def.anyOf)) {
      return def.anyOf.map(function (sub) { return sub.type; }).filter(Boolean);
    }
    return [];
  }

  // ── 공개 함수: _validatePayload ──────────────────────────────────
  // 반환: {ok, missing:[], unknown:[], enumMismatch:[], typeMismatch:[]}
  window._validatePayload = function (endpointKey, payload) {
    if (!_specSchemas) return { ok: true, warnings: [] };

    var ep = _specSchemas[endpointKey];
    if (!ep) return { ok: true, warnings: [] }; // 등록 안 된 엔드포인트 — pass

    var schema     = ep.request || ep; // request 키 하위 또는 루트
    var required   = schema.required   || [];
    var properties = schema.properties || {};
    var propKeys   = Object.keys(properties);

    var missing      = [];
    var unknown      = [];
    var enumMismatch = [];
    var typeMismatch = [];

    // a) 필수 필드 누락 체크
    for (var i = 0; i < required.length; i++) {
      var k = required[i];
      var v = payload[k];
      if (v === undefined || v === null || v === '') {
        missing.push(k);
      }
    }

    // b) 알 수 없는 필드 (properties 정의가 있을 때만 체크, 경고만)
    if (propKeys.length > 0) {
      Object.keys(payload).forEach(function (pk) {
        if (!(pk in properties)) unknown.push(pk);
      });
    }

    // c) enum + d) 타입 체크 (anyOf 포함)
    for (var ki = 0; ki < propKeys.length; ki++) {
      var key = propKeys[ki];
      var def = properties[key];
      var val = payload[key];
      if (val === undefined || val === null) continue; // 미입력 or nullable — skip

      // 타입 체크: anyOf 중 하나라도 맞으면 통과
      var types = _extractTypes(def);
      if (types.length > 0) {
        var typeOk = types.some(function (t) { return _checkType(val, t); });
        if (!typeOk) {
          typeMismatch.push({ key: key, expected: types.join('|'), actual: typeof val });
        }
      }

      // enum 체크: null은 anyOf nullable이므로 통과
      var enumVals = _extractEnum(def);
      if (enumVals && !enumVals.includes(val)) {
        enumMismatch.push({ key: key, expected: enumVals, actual: val });
      }
    }

    var ok = (missing.length === 0 && enumMismatch.length === 0 && typeMismatch.length === 0);
    return { ok: ok, missing: missing, unknown: unknown, enumMismatch: enumMismatch, typeMismatch: typeMismatch };
  };

  // ── 공개 함수: _assertSpec ────────────────────────────────────────
  // ok=false 면 console.warn + 토스트. 요청은 항상 진행.
  window._assertSpec = function (endpointKey, payload) {
    var result;
    try {
      result = window._validatePayload(endpointKey, payload);
    } catch (e) {
      return; // 검증 자체 오류 — 무시하고 요청 진행
    }

    if (!result.ok) {
      console.warn('[SPEC MISMATCH]', endpointKey, {
        missing:      result.missing,
        enumMismatch: result.enumMismatch,
        typeMismatch: result.typeMismatch,
      });
      // app-core.js showToast 재사용 (로드 보장됨)
      if (typeof showToast === 'function') {
        showToast('\u26a0 스키마 불일치: ' + endpointKey);
      }
    }

    // unknown 필드는 별도 warn (ok에 영향 없음 — 경고만)
    if (result.unknown && result.unknown.length > 0) {
      console.warn('[SPEC UNKNOWN FIELDS]', endpointKey, result.unknown);
    }
  };

})();
// Itdasy Studio - Instagram 연동 & 말투분석

// ===== 인스타그램 연동 =====
async function checkInstaStatus(fromLogin = false) {
  if (!getToken()) return;
  try {
    const res = await fetch(API + '/instagram/status', { headers: authHeader() });
    if (!res.ok) return;
    const data = await res.json();

    // 서버에 shop_name 있으면 → 재로그인 환영 (로그인 직후 1회만)
    if (fromLogin && data.shop_name) {
      showWelcome(data.shop_name);
    }

    if (data.connected) {
      document.getElementById('homePreConnect').style.display = 'none';
      document.getElementById('homePostConnect').style.display = 'flex';
      _instaHandle = data.handle || '';
      updateHeaderProfile(_instaHandle, data.persona ? data.persona.tone : null, data.profile_picture_url || '');
      // 실제 분석 완료된 경우에만 말투 카드 표시
      if (data.persona && data.persona.style_summary) renderPersonaDash(data.persona);
      else document.getElementById('personaDash').style.display = 'none';
    } else {
      document.getElementById('homePreConnect').style.display = 'flex';
      document.getElementById('homePostConnect').style.display = 'none';
    }
  } catch(e) {}
}

function renderPersonaDash(p, showTestBtn) {
  document.getElementById('personaDash').style.display = 'block';
  const content = document.getElementById('personaContent');
  if (content) {
    content.innerHTML = `
      <div style="background:rgba(241,128,145,0.04); padding:14px; border-radius:14px; border:0.5px solid rgba(241,128,145,0.15); margin-bottom:16px;">
        <div style="margin-bottom:8px; font-size:11px; color:var(--accent2); font-weight:700; letter-spacing:-0.2px;">💬 말투 요약</div>
        <div style="font-size:13px; color:var(--text); line-height:1.6; font-weight:500;">"${p.tone || '친근하고 공손한 말투'}"</div>
      </div>

      <div style="display:flex; flex-direction:column; gap:8px;">
        ${showTestBtn ? `<button class="btn-primary" style="width:100%; height:44px; font-size:13px; font-weight:700;" onclick="showOnboardingCaptionPopup()">✍️ 내 말투로 테스트 글 만들기</button>` : ''}
        <button class="btn-copy" style="width:100%; height:42px; font-size:13px; font-weight:600; border:1px solid var(--accent2); background:white; color:var(--accent2); border-radius:10px;" onclick="showDetailedAnalysis()">📋 전체 분석 리포트 확인</button>
      </div>
    `;
  }
}

function showDetailedAnalysis() {
  const raw = JSON.parse(localStorage.getItem('itdasy_latest_analysis') || '{}');
  if (!raw.tone_summary) {
    alert('학습된 말투 데이터가 없습니다. 먼저 분석을 진행해주세요!');
    return;
  }
  // 팝업 데이터 렌더링 (runPersonaAnalyze에 있는 로직 재사용)
  renderDetailedPopup({ raw_analysis: raw, persona: { avg_caption_length: raw.avg_caption_length || 0, emojis: raw.emojis, hashtags: raw.hashtags, style_summary: raw.style_summary } });
  document.getElementById('analyzeResultPopup').style.display = 'block';
  const closeBtn2 = document.querySelector('#analyzeResultPopup button');
  if (closeBtn2) {
    closeBtn2.addEventListener('click', () => {
      if (typeof window.openPersonaPopup === 'function') {
        setTimeout(() => window.openPersonaPopup(), 300);
      }
    }, { once: true });
  }
}

function renderDetailedPopup(data) {
    const p = data.persona;
    const raw = data.raw_analysis || {};
    const tFeatures = raw.tone_features || raw.tone_traits || [];

    // 유연한 키 매핑 (Gemini 응답 변동성 대비)
    const top5 = raw.top5_analysis || raw.top_5_analysis || raw.top5 || raw.success_highlights || [];

    document.getElementById('analyzeResultBody').innerHTML = `
    <div style="margin-bottom:24px; padding:16px; background:rgba(241,128,145,0.04); border-radius:16px; border:1px solid rgba(241,128,145,0.08);">
        <div style="color:var(--accent2); font-size:11px; font-weight:700; margin-bottom:6px; letter-spacing:0.5px;">분석 완료</div>
        <div style="font-size:15px; font-weight:700; color:var(--text);">최근 게시물 기준 · 평균 ${p.avg_caption_length}자 글쓰기</div>
    </div>

    <div style="margin-bottom:28px;">
        <div style="color:var(--accent2); font-size:11px; font-weight:700; margin-bottom:10px; letter-spacing:0.5px;">사장님 말투 스타일</div>
        <div style="font-size:17px; font-weight:800; color:var(--text); margin-bottom:12px; line-height:1.4; word-break:keep-all;">"${raw.tone_summary || p.tone}"</div>
        <div style="display:flex; flex-wrap:wrap; gap:8px;">
        ${tFeatures.map(f => `<span style="background:rgba(241,128,145,0.07); color:var(--accent2); padding:6px 12px; border-radius:20px; font-size:12px; font-weight:600;">${f}</span>`).join('')}
        </div>
    </div>

    <div style="margin-bottom:32px;">
        <div style="color:var(--accent2); font-size:11px; font-weight:700; margin-bottom:12px; letter-spacing:0.5px;">잘 되는 게시물 비결 TOP 5</div>
        <div style="display:flex; flex-direction:column; gap:12px;">
        ${top5.length > 0 ? top5.map(item => `
            <div style="background:white; border-radius:14px; padding:16px; border:1px solid rgba(0,0,0,0.04); box-shadow:0 4px 12px rgba(0,0,0,0.02); display:flex; gap:12px; align-items:flex-start;">
                <div style="width:24px; height:24px; background:var(--accent2); color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:900; flex-shrink:0;">${item.rank}</div>
                <div style="font-size:13px; color:var(--text); line-height:1.5; font-weight:500; word-break:keep-all;">${item.why}</div>
            </div>
        `).join('') : '<div style="font-size:13px; color:var(--text3); text-align:center; padding:20px; background:#f9f9f9; border-radius:14px;">아직 데이터가 충분하지 않아요 🙏</div>'}
        </div>
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:24px;">
        <div style="padding:16px; background:#f9f9f9; border-radius:16px;">
            <div style="color:var(--text3); font-size:10px; font-weight:700; margin-bottom:8px;">자주 쓰는 이모지</div>
            <div style="font-size:16px; letter-spacing:3px; word-break:break-all;">${p.emojis || '✨'}</div>
        </div>
        <div style="padding:16px; background:#f9f9f9; border-radius:16px; overflow:hidden;">
            <div style="color:var(--text3); font-size:10px; font-weight:700; margin-bottom:8px;">자주 쓰는 해시태그</div>
            <div style="font-size:11px; color:var(--accent); line-height:1.6; word-break:break-all;">${(p.hashtags || '#잇데이').replace(/,/g, ' ')}</div>
        </div>
    </div>

    <div style="padding:24px; background:linear-gradient(135deg, #fffcfd, #fff5f7); border-radius:24px; border:1.5px solid rgba(241,128,145,0.2);">
        <div style="color:var(--accent2); font-size:11px; font-weight:700; margin-bottom:10px; letter-spacing:0.5px;">이렇게 쓰면 잘 돼요</div>
        <div style="font-size:14px; font-weight:700; color:var(--text); line-height:1.7; word-break:keep-all;">" ${raw.style_summary || p.style_summary || '사장님만의 감성을 살려서 써보세요!'} "</div>
    </div>
    `;
}

function reAnalyzePersona() {
  if (confirm('최신 게시물들을 바탕으로 말투와 성과 비결을 다시 분석하시겠습니까?')) {
    runPersonaAnalyze();
  }
}

async function runPersonaAnalyze() {
  const overlay = document.getElementById('analyzeOverlay');
  const bar     = document.getElementById('analyzeProgressBar');
  const stepTxt = document.getElementById('analyzeStepText');
  const subTxt  = document.getElementById('analyzeSubText');

  const steps = [
    { pct: 10, text: '게시물 수집 중...', sub: '최근 30개 게시물을 가져오고 있어요' },
    { pct: 35, text: '말투 분석 중...', sub: '사장님만의 문체 패턴을 파악하는 중' },
    { pct: 55, text: '해시태그 패턴 분석 중...', sub: '자주 쓰신 해시태그 top20 추출 중' },
    { pct: 75, text: '인기 게시물 특징 분석 중...', sub: '좋아요·댓글 많은 게시물의 공통점 파악 중' },
    { pct: 90, text: '말투 데이터 완성 중...', sub: 'AI가 분석 결과를 정리하고 있어요' },
  ];

  overlay.style.display = 'flex';
  let stepIdx = 0;

  // 애니메이션: API 응답 전까지 단계 순서대로 진행
  const ticker = setInterval(() => {
    if (stepIdx < steps.length) {
      const s = steps[stepIdx++];
      bar.style.width = s.pct + '%';
      stepTxt.textContent = s.text;
      subTxt.textContent  = s.sub;
    }
  }, 2200);

  try {
    const res = await fetch(API + '/instagram/analyze', {
      method: 'POST',
      headers: authHeader()
    });
    clearInterval(ticker);

    if (!res.ok) {
      const err = await res.json();
      overlay.style.display = 'none';
      alert('분석 실패: ' + (err.detail || '알 수 없는 오류'));
      return;
    }

    const data = await res.json();
    const p = data.persona;
    const raw = data.raw_analysis || {};

    // 로컬 스토리지에 최신 분석 결과 저장 (자세히보기용)
    localStorage.setItem('itdasy_latest_analysis', JSON.stringify({
        ...raw,
        avg_caption_length: p.avg_caption_length,
        emojis: p.emojis,
        hashtags: p.hashtags,
        style_summary: p.style_summary
    }));

    bar.style.width = '100%';
    stepTxt.textContent = '분석 성공! 🎉';
    subTxt.textContent  = '말투 데이터가 업데이트됐어요';

    // 헤더 + 대시보드 갱신
    const curPic = document.getElementById('headerAvatar').querySelector('img')?.src || '';
    updateHeaderProfile(_instaHandle, p.tone, curPic);
    renderPersonaDash(p);

    setTimeout(() => {
      overlay.style.display = 'none';
      renderPersonaDash(p, true);
      // 분석 완료 팝업 자동 오픈
      renderDetailedPopup({ raw_analysis: raw, persona: p });
      document.getElementById('analyzeResultPopup').style.display = 'block';
      // Phase 1-A: 분석완료 팝업 닫으면 말투검증 팝업 자동 오픈
      const closeBtn = document.querySelector('#analyzeResultPopup button');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          if (typeof window.openPersonaPopup === 'function') {
            setTimeout(() => window.openPersonaPopup(), 300);
          }
        }, { once: true });
      }
    }, 800);

  } catch(e) {
    clearInterval(ticker);
    overlay.style.display = 'none';
    alert('분석 오류: ' + e.message);
  }
}

async function disconnectInstagram() {
  if (!confirm('인스타 연동을 해제하시겠습니까? 데이터가 다시 연결될 때까지 글 자동 생성이 끊어집니다.')) return;
  try {
    await fetch(API + '/instagram/disconnect', { method: 'POST', headers: authHeader() });

    // 로컬 스토리지에 저장된 동의 및 분석 데이터 초기화
    localStorage.removeItem('itdasy_consented');
    localStorage.removeItem('itdasy_consented_at');
    localStorage.removeItem('itdasy_latest_analysis');

    // UI 초기화 (타임스탬프 등)
    const tsEl = document.getElementById('consentTimestampDisplay');
    if (tsEl) tsEl.textContent = '';

    checkInstaStatus();
  } catch(e) {
    alert('해제 오류: ' + e.message);
  }
}

async function connectInstagram() {
  if (!getToken()) {
    document.getElementById('lockOverlay').classList.remove('hidden');
    return;
  }

  const btn = document.getElementById('instaBtn');

  // PWA(홈화면 추가) 모드인지 확인
  const isPWA = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  // 카톡 인앱브라우저: Safari로 열도록 안내
  if (isKakaoTalk()) {
    showInstallGuide('카카오톡 내부 브라우저에서는 인스타 연동이 안 됩니다.');
    return;
  }

  // iOS Safari (비PWA): 홈화면 추가 안내
  if (isIOS && !isPWA) {
    showInstallGuide();
    return;
  }

  btn.textContent = '연결 중...';
  btn.disabled = true;


  try {
    // 동의 내역 서버 로그 및 로컬 저장 (타임스탬프 포함)
    fetch(API + '/instagram/consent', { method: 'POST', headers: authHeader() })
      .then(() => {
        const now = new Date().toLocaleString('ko-KR');
        localStorage.setItem('itdasy_consented', 'true');
        localStorage.setItem('itdasy_consented_at', now);
        const tsEl = document.getElementById('consentTimestampDisplay');
        if (tsEl) { tsEl.textContent = `✅ 동의 완료: ${now}`; tsEl.style.display = 'block'; }
      })
      .catch(e => {});

    // iOS Universal Link 우회: 백엔드 ngrok URL로 이동 (instagram.com 직접 아님)
    // 백엔드가 302로 인스타에 전달 → 앱 납치 없이 Safari에서 OAuth 진행
    const token = getToken();
    let baseOrigin = window.location.origin;
    if (baseOrigin === 'null' || baseOrigin === 'file://') {
      baseOrigin = window.location.href.split('/index.html')[0];
    } else {
      baseOrigin += window.location.pathname.replace(/\/index\.html$/, '');
    }
    const origin = encodeURIComponent(baseOrigin);
    window.location.href = `${API}/instagram/go?token=${encodeURIComponent(token)}&origin=${origin}`;

  } catch(e) {
    alert('연동 오류: ' + e.message + '\n\n지속될 경우 크롬이나 사파리 앱에서 직접 접속해주세요!');
    btn.textContent = '연동하기';
    btn.disabled = false;
  }
}
// Itdasy Studio - 캡션 생성 (슬롯머신, 톤 컨트롤, 해시태그)

// ═══════════════════════════════════════════════════════
// 업종별 기본 키워드 config
// ═══════════════════════════════════════════════════════
const SHOP_KEYWORDS = {
  '붙임머리': ['14인치','18인치','22인치','24인치','26인치','28인치','30인치','특수인치','옴브레','재시술','볼륨업','자연스러운','롱헤어'],
  '네일아트': ['젤네일','아트','프렌치','이달의아트','글리터','원톤','그라데이션','스톤','매트','자개'],
  '네일': ['젤네일','아트','프렌치','이달의아트','글리터','원톤','그라데이션','스톤','매트','자개'],
  '헤어': ['단발','투블럭','남성','여성','펌','염색','탈색','클리닉','셋팅','레이어드','히피펌','S컬'],
  '속눈썹': ['볼륨','클래식','내추럴','C컬','D컬','J컬','CC컬','브라운','속눈썹펌','래쉬리프트','하속눈썹'],
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

// 현재 업종에 맞는 키워드 목록 반환 (기본 - 삭제 + 커스텀)
function getShopKeywords() {
  const shopType = localStorage.getItem('shop_type') || '붙임머리';
  const base = SHOP_KEYWORDS[shopType] || SHOP_KEYWORDS['붙임머리'];
  const deleted = _loadDeletedKeywords();
  const custom = _loadCustomKeywords();
  const filtered = base.filter(k => !deleted.includes(k));
  return [...new Set([...filtered, ...custom])];
}

// ===== 해시태그 셔플 믹싱 =====
// 이전에 사용한 태그 순서 기록 → 매번 다른 조합·순서로 노출
function shuffleHashtags(tags) {
  if (!tags || tags.length === 0) return tags;

  // 이전 사용 기록 로드
  let history = [];
  try { history = JSON.parse(localStorage.getItem('itdasy_hash_history') || '[]'); } catch(_) {}

  // 핵심 태그(앞 3개)는 고정, 나머지를 셔플 대상으로 분리
  const core = tags.slice(0, 3);
  const pool = tags.slice(3);

  // 이전 마지막 조합과 겹치는 인덱스 파악
  const lastCombo = history[history.length - 1] || [];
  // 피셔-예이츠 셔플 후, 직전 순서와 최소 2개 이상 다르면 채택
  let shuffled;
  let attempts = 0;
  do {
    shuffled = [...pool].sort(() => Math.random() - 0.5);
    attempts++;
  } while (
    attempts < 8 &&
    pool.length >= 4 &&
    shuffled.slice(0, 4).every((t, i) => lastCombo[i] === t)
  );

  const result = [...core, ...shuffled];

  // 히스토리 최대 5개 유지
  history.push(result.map(h => h.replace(/^#/, '')));
  if (history.length > 5) history.shift();
  localStorage.setItem('itdasy_hash_history', JSON.stringify(history));

  return result;
}

// ===== 캡션 로딩 팝업 (슬롯머신) =====
const SLOT_KEYWORDS = [
  ['따뜻한','친근한','유머러스','전문적인','감성적인','활발한','차분한','트렌디한','포근한','자연스러운'],
  ['짧게','보통','길게','핵심만','상세하게','간결하게','풍부하게','딱맞게','깔끔하게','진심으로'],
  ['✨','🎀','💕','🌸','😊','💫','🔥','🌿','💗','🙏'],
];
let _slotTimers = [];
let _slotLocked = [false, false, false];
let _personaFinalWords = ['자연스러운', '보통', '✨'];

function _initSlotStrip(idx) {
  const strip = document.getElementById('slotStrip' + idx);
  if (!strip) return;
  strip.innerHTML = '';
  const words = [...SLOT_KEYWORDS[idx], ...SLOT_KEYWORDS[idx], ...SLOT_KEYWORDS[idx]];
  words.forEach(w => {
    const div = document.createElement('div');
    div.className = 'slot-item';
    div.textContent = w;
    strip.appendChild(div);
  });
  strip.style.transition = 'none';
  strip.style.transform = 'translateY(0px)';
}

function _spinReel(idx) {
  const strip = document.getElementById('slotStrip' + idx);
  if (!strip) return;
  let offset = 0;
  const itemH = 44;
  const total = SLOT_KEYWORDS[idx].length * 3;
  const speed = 100 + idx * 35;
  const timer = setInterval(() => {
    if (_slotLocked[idx]) { clearInterval(timer); return; }
    offset -= itemH;
    if (offset < -(total - SLOT_KEYWORDS[idx].length) * itemH) {
      offset = -Math.floor(Math.random() * SLOT_KEYWORDS[idx].length) * itemH;
      strip.style.transition = 'none';
      strip.style.transform = `translateY(${offset}px)`;
      return;
    }
    strip.style.transition = `transform ${speed * 0.9}ms linear`;
    strip.style.transform = `translateY(${offset}px)`;
  }, speed);
  _slotTimers.push(timer);
}

function _lockReel(idx, keyword) {
  _slotLocked[idx] = true;
  const lockEl = document.getElementById('slotLock' + idx);
  if (lockEl) {
    lockEl.textContent = keyword;
    lockEl.classList.add('active');
  }
  // 슬롯 윈도우 숨겨서 글자 겹침 방지
  const stripEl = document.getElementById('slotStrip' + idx);
  if (stripEl) {
    const winEl = stripEl.closest('.slot-window');
    if (winEl) winEl.style.visibility = 'hidden';
  }
}

function showCaptionLoader() {
  const popup = document.getElementById('captionLoadingPopup');
  popup.style.display = 'flex';
  _slotLocked = [false, false, false];
  _slotTimers.forEach(t => { clearInterval(t); clearTimeout(t); });
  _slotTimers = [];

  // 페르소나 데이터로 최종 잠금 키워드 설정
  const raw = JSON.parse(localStorage.getItem('itdasy_latest_analysis') || '{}');
  const avgLen = parseInt(raw.avg_caption_length) || 0;
  const lenWord = avgLen > 0 ? (avgLen < 50 ? '짧게' : avgLen > 120 ? '길게' : '보통') : '보통';
  const emojiMatch = (raw.emojis || '').match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u);
  const emojiWord = emojiMatch ? emojiMatch[0] : '✨';
  const toneWord = (raw.tone_summary || raw.tone || '').replace(/["']/g, '').trim().split(/[\s,·]+/)[0] || '자연스러운';
  _personaFinalWords = [toneWord, lenWord, emojiWord];

  [0,1,2].forEach(i => {
    const lock = document.getElementById('slotLock' + i);
    if (lock) lock.classList.remove('active');
    // 슬롯 윈도우 다시 표시
    const stripEl = document.getElementById('slotStrip' + i);
    if (stripEl) {
      const winEl = stripEl.closest('.slot-window');
      if (winEl) winEl.style.visibility = '';
    }
    _initSlotStrip(i);
    setTimeout(() => _spinReel(i), i * 120);
  });
  document.getElementById('clMsg').textContent = '원장님 말투로 조합 중...';
  document.getElementById('clHint').textContent = '키워드 조합 중이에요 ✨';

  // 메시지 순환
  const _clMsgs = ['원장님 말투 불러오는 중...', 'AI가 글 구상 중이에요...', '해시태그 고르는 중...', '거의 다 됐어요...'];
  let _clMsgIdx = 0;
  const _clMsgTimer = setInterval(() => {
    _clMsgIdx = Math.min(_clMsgIdx + 1, _clMsgs.length - 1);
    if (!_slotLocked[0]) document.getElementById('clMsg').textContent = _clMsgs[_clMsgIdx];
  }, 1600);
  _slotTimers.push(_clMsgTimer);

}

function hideCaptionLoader(success, onClose) {
  // 아직 안 잠긴 릴만 순차 잠금 (150ms 간격) — API 응답 완료 시점에 맞춰 빠르게 종료
  const finalWords = [
    _personaFinalWords[0] || SLOT_KEYWORDS[0][Math.floor(Math.random() * SLOT_KEYWORDS[0].length)],
    _personaFinalWords[1] || SLOT_KEYWORDS[1][Math.floor(Math.random() * SLOT_KEYWORDS[1].length)],
    _personaFinalWords[2] || SLOT_KEYWORDS[2][Math.floor(Math.random() * SLOT_KEYWORDS[2].length)],
  ];
  let lastLockDelay = 0;
  [0, 1, 2].forEach(i => {
    if (!_slotLocked[i]) {
      setTimeout(() => _lockReel(i, finalWords[i]), i * 150);
      lastLockDelay = i * 150;
    }
  });
  // 마지막 릴 잠금 후 350ms 뒤 닫기
  setTimeout(() => {
    _slotTimers.forEach(t => { clearInterval(t); clearTimeout(t); });
    _slotTimers = [];
    document.getElementById('captionLoadingPopup').style.display = 'none';
    _slotLocked = [false, false, false];
    if (onClose) setTimeout(onClose, 80);
  }, lastLockDelay + 350);
}

// ===== 온보딩 캡션 테스트 팝업 =====
async function showOnboardingCaptionPopup() {
  const popup = document.getElementById('onboardingCaptionPopup');
  const ta = document.getElementById('ocpTextarea');

  // 팝업을 먼저 열고, 생성 중 상태로 표시
  const loadingMsgs = ['AI가 말투를 분석하고 있어요...✨', '게시물 스타일 학습 중...🎀', '피드 글 초안 작성 중...📝', '거의 다 됐어요!💫'];
  let msgIdx = 0;
  ta.value = loadingMsgs[0];
  ta.readOnly = true;
  ta.style.opacity = '0.5';
  popup.style.display = 'flex';
  const loadingTimer = setInterval(() => { msgIdx = (msgIdx + 1) % loadingMsgs.length; ta.value = loadingMsgs[msgIdx]; }, 2000);

  // 저장 버튼도 비활성화
  const saveBtn = popup.querySelector('.ocp-save');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.style.opacity = '0.5'; }

  try {
    const shopType = localStorage.getItem('shop_type') || '붙임머리';
    const res = await fetch(API + '/caption/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ description: `${shopType} 시술. 오늘 새로운 손님. 결과 대만족.`, platform: 'instagram' }),
    });
    if (res.ok) {
      const d = await res.json();
      ta.value = d.caption.trim();
    } else {
      ta.value = '직접 평소 쓰시는 말투로 한 문단 입력해주시면 학습할게요!';
    }
  } catch(e) {
    ta.value = '직접 평소 쓰시는 말투로 한 문단 입력해주시면 학습할게요!';
  } finally {
    clearInterval(loadingTimer);
    ta.readOnly = false;
    ta.style.opacity = '1';
    if (saveBtn) { saveBtn.disabled = false; saveBtn.style.opacity = '1'; }
  }
}

function closeOnboardingCaptionPopup() {
  document.getElementById('onboardingCaptionPopup').style.display = 'none';
}

async function saveOnboardingCaption() {
  const ta = document.getElementById('ocpTextarea');
  const text = ta.value.trim();
  if (!text || text.length < 10) { showToast('글을 조금 더 입력해주세요!'); return; }

  try {
    const res = await fetch(API + '/shop/persona/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ corrected_caption: text }),
    });
    if (!res.ok) throw new Error();
    closeOnboardingCaptionPopup();
    showToast('학습 완료! 앞으로 모든 글에 반영됩니다! 🎉');
  } catch(e) {
    showToast('저장에 실패했어요. 다시 시도해주세요.');
  }
}

// ===== 캡션 탭 사진 영역 (드래그 순서 변경) =====
let _captionPhotosReordered = null; // 재정렬된 사진 배열 (null = 슬롯 기본 순서)

function _captionOpenSlotPicker() {
  const picker = document.getElementById('captionSlotPicker');
  if (picker) {
    picker.style.display = 'block';
    if (typeof initCaptionSlotPicker === 'function') initCaptionSlotPicker();
    picker.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function _renderCaptionPhotoRow() {
  const strip = document.getElementById('captionPhotoThumbRow');
  if (!strip) return;

  const slot = (typeof _captionSlotId !== 'undefined' && _captionSlotId && typeof _slots !== 'undefined')
    ? _slots.find(s => s.id === _captionSlotId) : null;

  if (!slot) {
    strip.innerHTML = `<div onclick="_captionOpenSlotPicker()" style="width:72px;height:72px;border-radius:10px;border:1.5px dashed var(--border);display:flex;align-items:center;justify-content:center;font-size:22px;color:var(--text3);cursor:pointer;flex-shrink:0;">📷</div>`;
    return;
  }

  const basePhotos = slot.photos.filter(p => !p.hidden);
  if (!_captionPhotosReordered || _captionPhotosReordered._slotId !== _captionSlotId) {
    _captionPhotosReordered = [...basePhotos];
    _captionPhotosReordered._slotId = _captionSlotId;
  }

  strip.innerHTML = '';
  _captionPhotosReordered.forEach((p, i) => {
    const src = p.editedDataUrl || p.dataUrl || '';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;flex-shrink:0;user-select:none;';
    wrap.draggable = true;
    wrap.dataset.capPhotoIdx = i;

    wrap.innerHTML = `
      <img src="${src}" draggable="false" style="width:72px;height:72px;object-fit:cover;border-radius:10px;display:block;pointer-events:none;">
      <button onclick="_removeCapPhoto(${i},event)" style="position:absolute;top:2px;right:2px;width:18px;height:18px;border-radius:50%;border:none;background:rgba(0,0,0,0.55);color:#fff;font-size:10px;line-height:1;cursor:pointer;">×</button>
      <div style="position:absolute;bottom:2px;left:50%;transform:translateX(-50%);font-size:8px;color:rgba(255,255,255,0.8);background:rgba(0,0,0,0.35);border-radius:3px;padding:0 3px;">${i+1}</div>
    `;

    // HTML5 drag (desktop + PWA)
    wrap.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', String(i)); wrap.style.opacity = '0.4'; });
    wrap.addEventListener('dragend', () => wrap.style.opacity = '1');
    wrap.addEventListener('dragover', e => { e.preventDefault(); wrap.style.outline = '2px solid var(--accent)'; });
    wrap.addEventListener('dragleave', () => wrap.style.outline = '');
    wrap.addEventListener('drop', e => {
      e.preventDefault(); wrap.style.outline = '';
      const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
      const toIdx = parseInt(wrap.dataset.capPhotoIdx, 10);
      if (isNaN(fromIdx) || fromIdx === toIdx) return;
      const arr = [..._captionPhotosReordered];
      const [removed] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, removed);
      _captionPhotosReordered = arr;
      _captionPhotosReordered._slotId = _captionSlotId;
      _renderCaptionPhotoRow();
    });

    // Long-press (300ms) → touch drag
    let _lpTimer = null, _lpActive = false;
    wrap.addEventListener('touchstart', () => {
      _lpTimer = setTimeout(() => {
        _lpActive = true;
        wrap.style.opacity = '0.5';
        if (navigator.vibrate) navigator.vibrate(20);
      }, 300);
    }, { passive: true });
    wrap.addEventListener('touchend', () => {
      clearTimeout(_lpTimer);
      if (_lpActive) { wrap.style.opacity = '1'; _lpActive = false; }
    });
    wrap.addEventListener('touchmove', e => {
      if (!_lpActive) { clearTimeout(_lpTimer); return; }
      e.preventDefault();
      const touch = e.touches[0];
      const el = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('[data-cap-photo-idx]');
      if (el && el !== wrap) {
        const fromIdx = parseInt(wrap.dataset.capPhotoIdx, 10);
        const toIdx   = parseInt(el.dataset.capPhotoIdx, 10);
        const arr = [..._captionPhotosReordered];
        const [removed] = arr.splice(fromIdx, 1);
        arr.splice(toIdx, 0, removed);
        _captionPhotosReordered = arr;
        _captionPhotosReordered._slotId = _captionSlotId;
        _renderCaptionPhotoRow();
      }
    }, { passive: false });

    strip.appendChild(wrap);
  });

  const addBtn = document.createElement('div');
  addBtn.style.cssText = 'width:72px;height:72px;border-radius:10px;border:1.5px dashed var(--border);display:flex;align-items:center;justify-content:center;font-size:22px;color:var(--text3);cursor:pointer;flex-shrink:0;';
  addBtn.textContent = '+';
  addBtn.onclick = _captionOpenSlotPicker;
  strip.appendChild(addBtn);
}

function _removeCapPhoto(idx, e) {
  e?.stopPropagation();
  if (!_captionPhotosReordered) return;
  const slotId = _captionPhotosReordered._slotId;
  _captionPhotosReordered = _captionPhotosReordered.filter((_, i) => i !== idx);
  _captionPhotosReordered._slotId = slotId;
  _renderCaptionPhotoRow();
}


// ===== 편집 로그 PATCH (debounce 800ms) =====
let _lastLogId = null;     // 최근 생성된 generation_log.id
let _capAiDraft = '';      // AI 초안 원본 (edited_amount 계산용)
let _capPatchTimer = null;

function _capAutoGrow(ta) {
  ta.style.height = 'auto';
  ta.style.height = Math.min(ta.scrollHeight, 400) + 'px';
}

function _capSchedulePatch(text) {
  if (!_lastLogId) return;
  clearTimeout(_capPatchTimer);
  _capPatchTimer = setTimeout(() => _capPatchLog(text), 800);
}

async function _capPatchLog(text) {
  if (!_lastLogId || !text.trim()) return;
  // edited_amount: 글자 차이 % (간단 추정)
  const pct = _capAiDraft
    ? Math.round(Math.abs(text.length - _capAiDraft.length) / Math.max(_capAiDraft.length, 1) * 100)
    : 0;
  const micro = document.getElementById('captionEditMicro');
  const pctEl = document.getElementById('captionEditPct');
  if (pctEl) pctEl.textContent = pct > 0 ? `${pct}% 수정됨` : '';

  try {
    await _personaFetch('PATCH', `/persona/generation_logs/${_lastLogId}`, { final_text: text });
  } catch(_e) {} // 조용히 실패
}

// ═══════════════════════════════════════════════════════
// 캡션 입력 UI 렌더링 (동적 키워드 태그)
// ═══════════════════════════════════════════════════════
function renderCaptionKeywordTags() {
  const container = document.getElementById('typeTags');
  if (!container) return;

  const keywords = getShopKeywords();
  const deleted = _loadDeletedKeywords();

  container.innerHTML = keywords.map(k =>
    `<span class="tag" data-v="${k}" onclick="toggleCaptionTag(this)">${k}<button class="tag-delete" onclick="deleteCaptionKeyword('${k}',event)">×</button></span>`
  ).join('') + `<span class="tag tag-add" onclick="showAddKeywordInput()">+ 추가</span>`;
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
  const keyword = prompt('추가할 키워드를 입력하세요:');
  if (!keyword || !keyword.trim()) return;
  const trimmed = keyword.trim();
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
}

// ===== 캡션 생성 — POST /persona/generate =====
// TD-020: POST /persona/generate 해시태그 반환 필드 추가 필요

// shopType → schemas.json category enum 매핑
const _CAP_CAT_MAP = {'붙임머리':'extension','네일아트':'nail','네일':'nail'};

// 400 에러 코드 → 사용자 안내 메시지
const _CAP_ERR_MSG = {
  'identity_incomplete': '페르소나 탭 필수 5필드부터 채워주세요',
  'consent_missing':     '페르소나 탭 하단 동의를 먼저 해주세요',
  'insufficient_posts':  '포스트가 5개 이상 필요합니다. 인스타 연동에서 포스트를 더 불러와주세요.',
  'fingerprint_missing': '포스트가 5개 이상 필요합니다. 인스타 연동에서 포스트를 더 불러와주세요.',
};

function generateCaption() {
  openCaptionScenarioPopup();
}

// 시나리오 선택 바텀시트 팝업
function openCaptionScenarioPopup() {
  if (typeof window.renderScenarioSelector !== 'function') {
    showToast('잠시 후 다시 시도해주세요.');
    return;
  }

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9000;display:flex;align-items:flex-end;justify-content:center;animation:pp-bg-in .2s ease;';

  const sheet = document.createElement('div');
  sheet.style.cssText = 'width:100%;max-width:480px;background:#fff;border-radius:24px 24px 0 0;padding:24px 20px 36px;box-sizing:border-box;max-height:88vh;overflow-y:auto;animation:pp-sheet-in .22s cubic-bezier(.32,1.1,.68,1);';

  const handle = document.createElement('div');
  handle.style.cssText = 'width:36px;height:4px;background:#e0e0e0;border-radius:2px;margin:0 auto 20px;';
  sheet.appendChild(handle);

  const title = document.createElement('div');
  title.style.cssText = 'font-size:17px;font-weight:800;color:#1a1a1a;margin-bottom:16px;';
  title.textContent = '어떤 상황이에요?';
  sheet.appendChild(title);

  const selectorWrap = document.createElement('div');
  sheet.appendChild(selectorWrap);

  overlay.appendChild(sheet);
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) _closeCaptionScenarioPopup(overlay);
  });

  window.renderScenarioSelector(selectorWrap, async (result) => {
    selectorWrap.innerHTML = '<div style="text-align:center;padding:32px 0;color:#aaa;font-size:14px;">캡션 만드는 중 ✨</div>';
    title.textContent = '잠깐만요!';
    await _doGenerateCaption(result, () => _closeCaptionScenarioPopup(overlay));
  });
}

function _closeCaptionScenarioPopup(overlay) {
  overlay.style.opacity = '0';
  overlay.style.transition = 'opacity .15s';
  setTimeout(() => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 160);
  const btn = document.getElementById('captionBtn');
  if (btn) { btn.innerHTML = '만들기 ✨'; btn.disabled = false; }
}

async function _doGenerateCaption(scenario, closePopup) {
  const btn = document.getElementById('captionBtn');
  if (btn) btn.disabled = true;

  showCaptionLoader();

  const shopType = localStorage.getItem('shop_type') || '붙임머리';
  const cfg = SHOP_CONFIG[shopType] || SHOP_CONFIG['붙임머리'];
  const types = getSel('typeTags');
  const typeStr = types.length > 0 ? types.join(', ') : cfg.defaultTag;

  // 작업실 슬롯 연결 정보
  const slotNote = (typeof _captionSlotId !== 'undefined' && _captionSlotId && typeof _slots !== 'undefined')
    ? (() => { const s = _slots.find(sl => sl.id === _captionSlotId); return s ? `손님: ${s.label}. 사진 ${s.photos.filter(p=>!p.hidden).length}장. ` : ''; })()
    : '';

  const axes = (scenario && scenario.axes) ? scenario.axes : {};
  const axesText = axes.customer
    ? `${axes.customer} 손님. ${axes.situation}. ${axes.photo}.`
    : '';
  const specialText = (scenario && scenario.special_context) ? scenario.special_context : '';

  const category      = _CAP_CAT_MAP[shopType] || 'extension';
  const photo_context = `${shopType} 시술. ${cfg.tagLabel}: ${typeStr}. ${slotNote}${axesText} ${specialText}`.trim();
  const length_tier   = 'medium';
  const tone_override = 'normal';

  const payload = { category, photo_context, length_tier, tone_override };
  if (typeof window._assertSpec === 'function') window._assertSpec('POST /persona/generate', payload);

  try {
    const res = await _personaFetch('POST', '/persona/generate', payload);
    const data = await res.json();

    if (!res.ok) {
      const code = data.code || data.detail || '';
      const msg = _CAP_ERR_MSG[code] || '캡션 생성에 실패했습니다. 다시 시도해주세요.';
      hideCaptionLoader(false, () => {
        closePopup();
        showToast(msg);
      });
      return;
    }

    const finalCaption = data.caption || '';
    const hashes = ''; // TD-020: 해시태그 미반환 — 추후 추가 예정

    // TD-022: 응답에 log_id 없음 — 백엔드 GenerateResponse에 log_id 필드 추가 필요
    if (data.log_id) {
      _lastLogId = data.log_id;
    } else {
      console.warn('[TD-022] log_id missing in POST /persona/generate response — PATCH 비활성');
      _lastLogId = null;
    }
    _capAiDraft = finalCaption;

    // [WIRING] 요청값 vs 서버 응답값 일치 확인
    const respLT = data.length_tier;
    const respTO = data.used_tone;
    if (respLT && respLT !== length_tier)
      console.warn('[WIRING-MISMATCH] length_tier sent:', length_tier, '/ server used:', respLT);
    if (respTO && respTO !== tone_override)
      console.warn('[WIRING-MISMATCH] tone_override sent:', tone_override, '/ server used:', respTO);
    console.log('[WIRING] sent:', { length_tier, tone_override }, '| resp:', { length_tier: respLT, used_tone: respTO });

    hideCaptionLoader(true, () => {
      closePopup();
      const ta = document.getElementById('captionText');
      ta.value = finalCaption;
      _capAutoGrow(ta);
      document.getElementById('captionHash').value = hashes;

      const micro = document.getElementById('captionEditMicro');
      if (micro) micro.style.display = _lastLogId ? 'flex' : 'none';

      if (typeof _captionSlotId !== 'undefined' && _captionSlotId && typeof _slots !== 'undefined') {
        const slot = _slots.find(s => s.id === _captionSlotId);
        if (slot) {
          slot.caption = finalCaption;
          slot.hashtags = hashes;
          if (typeof saveSlotToDB === 'function') saveSlotToDB(slot).catch(() => {});
        }
      }

      _renderCaptionActionBar(finalCaption, hashes);
      if (btn) { btn.innerHTML = '만들기 ✨'; btn.disabled = false; }
    });
  } catch(e) {
    if (e.message === '401') return; // _personaFetch가 401 처리
    hideCaptionLoader(false, () => {
      closePopup();
      showToast('일시적 오류. 다시 시도해주세요.');
    });
  }
}

// ===== 업로드 진행/완료 팝업 =====
function setUploadProgress(pct, msg) {
  document.getElementById('upPct').textContent = pct + '%';
  document.getElementById('upMsg').textContent = msg;
  document.getElementById('upFill').style.width = pct + '%';
}

function openInstagramProfile() {
  const handle = (_instaHandle || '').replace('@', '');
  window.location.href = handle ? `instagram://user?username=${handle}` : 'instagram://';
}

function closeUploadDone() {
  document.getElementById('uploadDonePopup').style.display = 'none';
}

function copyCaption() {
  navigator.clipboard.writeText(document.getElementById('captionText').value)
    .then(() => showToast('글 복사 완료! 📋'));
}
function copyAll() {
  const c = document.getElementById('captionText').value;
  const h = document.getElementById('captionHash').value;
  navigator.clipboard.writeText(c + '\n\n' + h).then(() => showToast('전체 복사 완료! 📋'));
}
function flashBtn(btn, msg) {
  const orig = btn.textContent;
  btn.textContent = msg;
  setTimeout(() => btn.textContent = orig, 1500);
}

// ===== Before/After =====
const imgs = { before: null, after: null };

function loadImage(input, side) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      imgs[side] = img;
      const preview = document.getElementById(side + 'Preview');
      const area = document.getElementById(side + 'Area');
      preview.src = e.target.result;
      preview.style.display = 'block';
      area.style.display = 'none';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function renderBA() {
  if (!imgs.before || !imgs.after) {
    alert('Before, After 사진을 모두 선택해주세요!');
    return;
  }
  const layout = document.querySelector('.style-opts .style-opt.on[data-v]') ?
    document.querySelectorAll('.style-opts .style-opt.on')[0].dataset.v : 'side';
  const wm = document.querySelectorAll('.style-opts .style-opt.on')[1]?.dataset.v || 'wm1';

  const canvas = document.getElementById('baCanvas');
  const ctx = canvas.getContext('2d');

  let W, H;
  if (layout === 'side' || layout === 'square') {
    W = 1080; H = 1080;
  } else {
    W = 1080; H = 1350;
  }
  canvas.width = W; canvas.height = H;
  canvas.style.display = 'block';

  ctx.fillStyle = '#0f0608';
  ctx.fillRect(0, 0, W, H);

  function drawCropped(img, x, y, w, h) {
    const scale = Math.max(w / img.width, h / img.height);
    const sw = w / scale, sh = h / scale;
    const sx = (img.width - sw) / 2, sy = (img.height - sh) / 2;
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }

  const PAD = 6;
  if (layout === 'side' || layout === 'square') {
    const hw = (W - PAD * 3) / 2;
    const ih = H - PAD * 2 - 80;
    drawCropped(imgs.before, PAD, PAD, hw, ih);
    drawCropped(imgs.after, PAD * 2 + hw, PAD, hw, ih);
    // 라벨
    const ly = ih + PAD + 10;
    drawLabel(ctx, 'BEFORE', PAD + hw / 2, ly, W);
    drawLabel(ctx, 'AFTER ✨', PAD * 2 + hw + hw / 2, ly, W);
  } else {
    const hh = (H - PAD * 3 - 80) / 2;
    drawCropped(imgs.before, PAD, PAD, W - PAD * 2, hh);
    drawCropped(imgs.after, PAD, PAD * 2 + hh, W - PAD * 2, hh);
    drawLabel(ctx, 'BEFORE', W / 2, hh + PAD + 14, W);
    drawLabel(ctx, 'AFTER ✨', W / 2, hh * 2 + PAD * 2 + 14, W);
  }

  // 워터마크
  if (wm !== 'wm0') {
    const wmText = wm === 'wm1' ? '🎀 @itdasy' : '잇데이 붙임머리';
    ctx.fillStyle = 'rgba(232,160,176,0.9)';
    ctx.font = '500 28px "Noto Sans KR", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(wmText, W / 2, H - 22);
  }

}

function resetBA() {
  imgs.before = null; imgs.after = null;
  document.getElementById('beforePreview').style.display = 'none';
  document.getElementById('afterPreview').style.display = 'none';
  document.getElementById('beforeArea').style.display = 'block';
  document.getElementById('afterArea').style.display = 'block';
  document.getElementById('baCanvas').style.display = 'none';
  document.getElementById('saveBtn').style.display = 'none';
  document.getElementById('resetBaBtn').style.display = 'none';
  document.querySelectorAll('#tab-ba input[type=file]').forEach(i => i.value = '');
}

function drawLabel(ctx, text, x, y, W) {
  ctx.fillStyle = 'rgba(15,6,8,0.7)';
  ctx.roundRect(x - 70, y - 22, 140, 34, 17);
  ctx.fill();
  ctx.fillStyle = '#f0e8ea';
  ctx.font = '500 18px "Noto Sans KR", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
}

function saveCanvas() {
  const canvas = document.getElementById('baCanvas');
  const a = document.createElement('a');
  a.download = 'itdasy_ba_' + Date.now() + '.jpg';
  a.href = canvas.toDataURL('image/jpeg', 0.92);
  a.click();
}

function createConfetti() {
  const c = document.createElement('div');
  c.textContent = ['🎀','✨','💎','🩷'][Math.floor(Math.random()*4)];
  c.className = 'confetti';
  c.style.left = Math.random() * 100 + 'vw';
  c.style.animationDuration = Math.random() * 2 + 3 + 's';
  document.body.appendChild(c);
  setTimeout(() => c.remove(), 5000);
}

// ═══════════════════════════════════════════════════════
// 캡션 완료 후 액션바 (갤러리 저장 + 다음 손님 유도)
// ═══════════════════════════════════════════════════════
function _renderCaptionActionBar(caption, hashtags) {
  const actionBar = document.getElementById('captionActionBar');
  if (!actionBar) return;

  // 슬롯 진행 현황
  let doneCount = 0, totalCount = 0, nextSlot = null;
  if (typeof _slots !== 'undefined' && _slots.length > 0) {
    doneCount = _slots.filter(s => s.status === 'done').length;
    totalCount = _slots.length;
    // 다음 미완료 슬롯 찾기
    nextSlot = _slots.find(s => s.status !== 'done' && s.photos.length > 0);
  }

  const hasNextSlot = !!nextSlot;
  const progressText = totalCount > 0 ? `(완료 ${doneCount}/${totalCount})` : '';

  actionBar.style.display = 'block';
  actionBar.innerHTML = `
    <div style="background:rgba(76,175,80,0.08);border:1.5px solid rgba(76,175,80,0.25);border-radius:14px;padding:14px;margin-bottom:10px;">
      <div style="font-size:12px;font-weight:700;color:#388e3c;margin-bottom:10px;">✅ 캡션 생성 완료!</div>
      <button onclick="saveCaptionToGallery()" style="width:100%;padding:12px;border-radius:12px;border:none;background:linear-gradient(135deg,#4caf50,#388e3c);color:#fff;font-size:13px;font-weight:700;cursor:pointer;">📁 갤러리에 저장하기</button>
    </div>
    ${hasNextSlot ? `
    <div style="background:rgba(241,128,145,0.07);border:1.5px solid rgba(241,128,145,0.2);border-radius:14px;padding:14px;">
      <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:10px;">다음 손님 글 써볼까요? ${progressText}</div>
      <div style="display:flex;gap:8px;">
        <button onclick="goToNextSlotCaption('${nextSlot.id}')" style="flex:1;padding:12px;border-radius:12px;border:none;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;font-size:13px;font-weight:700;cursor:pointer;">${nextSlot.label} 글쓰기 →</button>
        <button onclick="showTab('finish',document.querySelectorAll('.nav-btn')[4]); initFinishTab();" style="padding:12px 16px;border-radius:12px;border:1.5px solid var(--border);background:transparent;color:var(--text2);font-size:12px;font-weight:600;cursor:pointer;">마무리로 →</button>
      </div>
    </div>
    ` : `
    <div style="display:flex;gap:8px;">
      <button onclick="showTab('finish',document.querySelectorAll('.nav-btn')[4]); initFinishTab();" style="flex:1;padding:12px;border-radius:14px;border:none;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;font-size:13px;font-weight:700;cursor:pointer;">마무리로 이동 →</button>
    </div>
    `}
  `;
}

// 다음 슬롯으로 이동해서 캡션 작성
function goToNextSlotCaption(slotId) {
  if (typeof loadSlotForCaption === 'function') {
    loadSlotForCaption(slotId);
  }
  const ta = document.getElementById('captionText');
  if (ta) { ta.value = ''; _capAutoGrow(ta); }
  document.getElementById('captionActionBar').style.display = 'none';
  const micro = document.getElementById('captionEditMicro');
  if (micro) micro.style.display = 'none';
  _lastLogId = null;
  _captionPhotosReordered = null;
  _renderCaptionPhotoRow();
  // 태그 선택 해제
  document.querySelectorAll('#typeTags .tag.on').forEach(t => t.classList.remove('on'));
  // 스크롤 맨 위로
  document.getElementById('tab-caption').scrollTo({ top: 0, behavior: 'smooth' });
}

// 갤러리에 캡션 저장
async function saveCaptionToGallery() {
  if (typeof _captionSlotId === 'undefined' || !_captionSlotId) {
    showToast('먼저 작업실 슬롯을 선택해주세요');
    return;
  }
  const slot = typeof _slots !== 'undefined' ? _slots.find(s => s.id === _captionSlotId) : null;
  if (!slot) {
    showToast('슬롯을 찾을 수 없어요');
    return;
  }

  // 선택된 키워드를 태그로 변환
  const selectedTags = getSel('typeTags');
  slot.tags = selectedTags;
  slot.caption = document.getElementById('captionText').value;
  slot.hashtags = document.getElementById('captionHash').value;

  try {
    if (typeof saveToGallery === 'function') {
      await saveToGallery(slot);
    }
    if (typeof saveSlotToDB === 'function') {
      await saveSlotToDB(slot);
    }
    showToast('갤러리에 저장됐어요 📁');

    // 저장 완료 후 다음 손님 유도 갱신
    _renderCaptionActionBar(slot.caption, slot.hashtags);
  } catch(e) {
    showToast('저장 실패: ' + e.message);
  }
}
// Itdasy Studio - AI 추천 탭 (갤러리/미발행 슬롯 연동)

// =====================================================================
// ===== AI 추천 탭 — 미발행 슬롯 카드 =====
// =====================================================================
let _aiRecommendChecked = new Set();

async function initAiRecommendTab() {
  const root = document.getElementById('tab-ai-suggest');
  if (!root) return;

  let slots = [];
  try { slots = await loadSlotsFromDB(); } catch(_e) {}

  // 미발행 슬롯: instagramPublished !== true (완료/미완료 모두 포함)
  const unpublished = slots.filter(s => !s.instagramPublished);

  // 정렬: ① 완성(사진+캡션+done) 우선 → ② deferred → ③ 오래된 순
  unpublished.sort((a, b) => {
    // 완성도 체크
    const aComplete = a.status === 'done' && a.photos.length > 0 && !!a.caption;
    const bComplete = b.status === 'done' && b.photos.length > 0 && !!b.caption;
    if (aComplete !== bComplete) return aComplete ? -1 : 1;

    // deferred 우선
    const aDeferred = !!a.deferredAt;
    const bDeferred = !!b.deferredAt;
    if (aDeferred !== bDeferred) return aDeferred ? -1 : 1;
    if (aDeferred && bDeferred) return (a.deferredAt || 0) - (b.deferredAt || 0);

    // 오래된 순
    return (a.createdAt || a.order || 0) - (b.createdAt || b.order || 0);
  });

  _aiRecommendChecked.clear();
  _renderAiRecommendTab(root, unpublished);
}

function _renderAiRecommendTab(root, slots) {
  if (!slots.length) {
    root.innerHTML = `
      <div class="sec-title" style="margin-bottom:4px;">AI 추천 ✨</div>
      <div style="text-align:center;padding:60px 20px;">
        <div style="font-size:40px;margin-bottom:12px;">🌸</div>
        <div style="font-size:15px;font-weight:800;color:var(--text);margin-bottom:6px;">올릴 게 없어요!</div>
        <div style="font-size:13px;color:var(--text3);margin-bottom:20px;">오늘 작업하러 가볼까요?</div>
        <button onclick="showTab('workshop',document.querySelectorAll('.nav-btn')[1]); initWorkshopTab();" style="padding:12px 24px;border-radius:14px;border:none;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;font-size:13px;font-weight:800;cursor:pointer;">작업실로 →</button>
      </div>`;
    return;
  }

  // 완성/미완성 카운트
  const completeN = slots.filter(s => s.status === 'done' && s.photos.length > 0 && !!s.caption).length;
  const incompleteN = slots.length - completeN;

  const cardsHtml = slots.map(slot => {
    const visPhotos = slot.photos.filter(p => !p.hidden);
    const thumb = visPhotos[0] || slot.photos[0];
    const thumbSrc = thumb ? (thumb.editedDataUrl || thumb.dataUrl) : '';
    const dateStr = slot.createdAt
      ? new Date(slot.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
      : (slot.deferredAt ? new Date(slot.deferredAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) : '');
    const isChecked = _aiRecommendChecked.has(slot.id);
    const isDeferred = !!slot.deferredAt;

    // 상태 분석
    const isWorkshopDone = slot.status === 'done';
    const hasPhotos = slot.photos.length > 0;
    const hasCaption = !!slot.caption;
    const isComplete = isWorkshopDone && hasPhotos && hasCaption;

    // 뱃지
    let badges = '';
    if (!isWorkshopDone) badges += '<div style="font-size:9px;background:rgba(255,152,0,0.15);color:#e65100;border-radius:4px;padding:1px 5px;font-weight:700;">작업실 미완료</div>';
    if (!hasCaption) badges += '<div style="font-size:9px;background:rgba(156,39,176,0.12);color:#7b1fa2;border-radius:4px;padding:1px 5px;font-weight:700;">캡션 없음</div>';
    if (hasCaption) badges += '<div style="font-size:9px;background:rgba(76,175,80,0.15);color:#388e3c;border-radius:4px;padding:1px 5px;font-weight:700;">캡션✓</div>';
    if (isDeferred) badges += '<div style="font-size:9px;background:rgba(255,193,7,0.2);color:#f57c00;border-radius:4px;padding:1px 5px;font-weight:700;">나중에</div>';

    // 캡션 미리보기
    const capPreview = slot.caption
      ? slot.caption.slice(0, 50) + (slot.caption.length > 50 ? '…' : '')
      : '(캡션을 작성해주세요)';

    // 테두리 색상: 완성=초록, 미완성=주황, deferred=노랑, 체크=핑크
    const borderColor = isChecked ? 'var(--accent)' : isComplete ? 'rgba(76,175,80,0.35)' : isDeferred ? 'rgba(255,193,7,0.4)' : 'rgba(255,152,0,0.35)';

    return `
      <div data-ai-card="${slot.id}" style="background:#fff;border:1.5px solid ${borderColor};border-radius:16px;padding:12px;margin-bottom:10px;position:relative;">
        <!-- 체크박스 -->
        <div onclick="_toggleAiCheck('${slot.id}',event)" style="position:absolute;top:12px;left:12px;z-index:2;width:20px;height:20px;border-radius:5px;border:2px solid ${isChecked ? 'var(--accent)' : 'rgba(0,0,0,0.2)'};background:${isChecked ? 'var(--accent)' : 'rgba(255,255,255,0.9)'};display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;cursor:pointer;">${isChecked ? '✓' : ''}</div>
        <!-- 삭제 버튼 -->
        <button onclick="_deleteAiSlot('${slot.id}',event)" style="position:absolute;top:10px;right:10px;background:transparent;border:none;font-size:16px;color:var(--text3);cursor:pointer;line-height:1;padding:2px 6px;">✕</button>
        <!-- 카드 본문: 상태에 따라 다른 탭으로 -->
        <div onclick="_goToSlotStep('${slot.id}')" style="display:flex;gap:12px;align-items:center;cursor:pointer;padding:0 24px 0 28px;">
          ${thumbSrc
            ? `<img src="${thumbSrc}" style="width:72px;height:72px;object-fit:cover;border-radius:10px;flex-shrink:0;">`
            : `<div style="width:72px;height:72px;border-radius:10px;background:var(--bg2);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:24px;">📷</div>`}
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;flex-wrap:wrap;">
              <div style="font-size:13px;font-weight:800;color:var(--text);">${slot.label}</div>
              ${badges}
            </div>
            <div style="font-size:11px;color:var(--text3);margin-bottom:4px;">${visPhotos.length || slot.photos.length}장 · ${dateStr}</div>
            <div style="font-size:11px;color:var(--text2);line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${capPreview}</div>
          </div>
        </div>
      </div>`;
  }).join('');

  const subText = incompleteN > 0
    ? `미발행 ${slots.length}개 (준비완료 ${completeN}개, 미완료 ${incompleteN}개)`
    : `미발행 ${slots.length}개 · 탭하면 마무리로 이동해요`;

  root.innerHTML = `
    <div class="sec-title" style="margin-bottom:4px;">AI 추천 ✨</div>
    <div class="sec-sub" style="margin-bottom:16px;">${subText}</div>
    ${cardsHtml}
    <div id="aiRecommendBatchBar" style="display:none;position:fixed;bottom:65px;left:0;right:0;z-index:200;padding:10px 16px;background:rgba(255,255,255,0.97);backdrop-filter:blur(8px);border-top:1px solid var(--border);box-shadow:0 -2px 16px rgba(0,0,0,0.1);">
      <button onclick="_batchDeleteAiSlots()" style="width:100%;padding:12px;border-radius:12px;border:none;background:linear-gradient(135deg,#dc3545,#c82333);color:#fff;font-size:13px;font-weight:800;cursor:pointer;">선택한 작업 삭제</button>
    </div>`;
}

function _toggleAiCheck(id, e) {
  e?.stopPropagation();
  _aiRecommendChecked.has(id) ? _aiRecommendChecked.delete(id) : _aiRecommendChecked.add(id);
  const bar = document.getElementById('aiRecommendBatchBar');
  if (bar) bar.style.display = _aiRecommendChecked.size > 0 ? 'block' : 'none';
  // 카드 border 색상만 업데이트
  document.querySelectorAll('[data-ai-card]').forEach(card => {
    const cardId = card.dataset.aiCard;
    const checked = _aiRecommendChecked.has(cardId);
    const slot = (typeof _slots !== 'undefined' ? _slots : []).find(s => s.id === cardId);
    const isDeferred = slot?.deferredAt;
    card.style.borderColor = checked ? 'var(--accent)' : isDeferred ? 'rgba(255,193,7,0.4)' : 'rgba(241,128,145,0.2)';
    const cb = card.querySelector('[onclick^="_toggleAiCheck"]');
    if (cb) {
      cb.style.borderColor = checked ? 'var(--accent)' : 'rgba(0,0,0,0.2)';
      cb.style.background = checked ? 'var(--accent)' : 'rgba(255,255,255,0.9)';
      cb.textContent = checked ? '✓' : '';
    }
  });
}

async function _deleteAiSlot(id, e) {
  e?.stopPropagation();
  if (!confirm('이 작업을 삭제할까요?')) return;
  try {
    await deleteSlotFromDB(id);
    if (typeof _slots !== 'undefined') _slots = _slots.filter(s => s.id !== id);
  } catch(_e) {}
  _aiRecommendChecked.delete(id);
  initAiRecommendTab();
}

async function _batchDeleteAiSlots() {
  if (!_aiRecommendChecked.size) return;
  if (!confirm(`선택한 ${_aiRecommendChecked.size}개를 삭제할까요?`)) return;
  for (const id of [..._aiRecommendChecked]) {
    try { await deleteSlotFromDB(id); } catch(_e) {}
    if (typeof _slots !== 'undefined') _slots = _slots.filter(s => s.id !== id);
  }
  _aiRecommendChecked.clear();
  initAiRecommendTab();
}

function _goToFinishSlot(slotId) {
  showTab('finish', document.querySelectorAll('.nav-btn')[4]);
  initFinishTab().catch ? initFinishTab().catch(() => {}) : setTimeout(initFinishTab, 0);
  setTimeout(() => {
    const el = document.querySelector(`[data-finish-slot="${slotId}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 350);
}

// 슬롯 상태에 따라 해당 단계로 이동
async function _goToSlotStep(slotId) {
  let slots = [];
  try { slots = await loadSlotsFromDB(); } catch(_e) {}
  const slot = slots.find(s => s.id === slotId);
  if (!slot) return;

  const isWorkshopDone = slot.status === 'done';
  const hasCaption = !!slot.caption;

  if (!isWorkshopDone || slot.photos.length === 0) {
    // 작업실 미완료 → 작업실로
    showTab('workshop', document.querySelectorAll('.nav-btn')[1]);
    initWorkshopTab();
    setTimeout(() => {
      const el = document.querySelector(`[data-slot-id="${slotId}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  } else if (!hasCaption) {
    // 캡션 없음 → 글쓰기 탭으로 (해당 슬롯 선택)
    window._selectedSlotForCaption = slot;
    showTab('caption', document.querySelectorAll('.nav-btn')[2]);
    if (typeof initCaptionTab === 'function') initCaptionTab();
  } else {
    // 완성 → 마무리 탭으로
    _goToFinishSlot(slotId);
  }
}


// =====================================================================
// ===== 예약 송출 =====
// =====================================================================
async function createSchedule() {
  const dt = document.getElementById('scheduleDateTime')?.value;
  if (!dt) { showToast('날짜와 시간을 선택해주세요!'); return; }
  const caption = document.getElementById('captionText')?.value || '';
  const hash = document.getElementById('captionHash')?.value || '';
  const hashtags = hash.replace(/#/g, '').split(/\s+/).filter(Boolean).join(',');
  const imageUrl = window._lastPublishedImageUrl || '';
  try {
    const res = await fetch(API + '/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({
        image_url: imageUrl,
        caption: caption.trim(),
        hashtags,
        scheduled_at: new Date(dt).toISOString(),
      }),
    });
    if (!res.ok) throw new Error((await res.json()).detail || '예약 실패');
    const panel = document.getElementById('schedulePanel');
    if (panel) panel.style.display = 'none';
    const btn = document.getElementById('scheduleToggleBtn');
    if (btn) btn.style.display = 'none';
    showToast('예약 등록됐어요! ⏰ ' + dt.replace('T', ' '));
  } catch(e) {
    showToast('예약 실패: ' + e.message);
  }
}
// Itdasy Studio - 작업실 & 마무리 (갤러리, 슬롯, IndexedDB)
// 캔버스 합성은 app-portfolio.js의 공유 유틸 사용:
//   compositePersonOnCanvas(), renderBASplit(), _loadImageSrc(), _drawCoverCtx(), getCloudBg()

// ═══════════════════════════════════════════════════════
// IndexedDB
// ═══════════════════════════════════════════════════════
const _GDB_NAME = 'itdasy-gallery';
const _GDB_STORE = 'slots';
let _gdb = null;

const _GALLERY_STORE = 'gallery';

function openGalleryDB() {
  return new Promise((resolve, reject) => {
    if (_gdb) return resolve(_gdb);
    const req = indexedDB.open(_GDB_NAME, 2);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(_GDB_STORE)) {
        const store = db.createObjectStore(_GDB_STORE, { keyPath: 'id' });
        store.createIndex('order', 'order', { unique: false });
      }
      if (!db.objectStoreNames.contains(_GALLERY_STORE)) {
        const gs = db.createObjectStore(_GALLERY_STORE, { keyPath: 'id' });
        gs.createIndex('date', 'date', { unique: false });
      }
    };
    req.onsuccess = e => { _gdb = e.target.result; resolve(_gdb); };
    req.onerror  = () => reject(req.error);
  });
}

async function saveToGallery(slot) {
  const db = await openGalleryDB();
  const item = {
    id: _uid(),
    slotId: slot.id,
    date: new Date().toISOString().slice(0, 10),
    label: slot.label,
    photos: slot.photos.map(p => ({ id: p.id, dataUrl: p.editedDataUrl || p.dataUrl, mode: p.mode })),
    caption: slot.caption || '',
    hashtags: slot.hashtags || '',
    savedAt: Date.now(),
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(_GALLERY_STORE, 'readwrite');
    tx.objectStore(_GALLERY_STORE).put(item);
    tx.oncomplete = () => resolve(item);
    tx.onerror = () => reject(tx.error);
  });
}

async function loadGalleryItems() {
  const db = await openGalleryDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(_GALLERY_STORE, 'readonly');
    const req = tx.objectStore(_GALLERY_STORE).getAll();
    req.onsuccess = () => resolve((req.result || []).sort((a, b) => b.savedAt - a.savedAt));
    req.onerror   = () => reject(req.error);
  });
}

async function deleteGalleryItem(id) {
  const db = await openGalleryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(_GALLERY_STORE, 'readwrite');
    tx.objectStore(_GALLERY_STORE).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function saveSlotToDB(slot) {
  const db = await openGalleryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(_GDB_STORE, 'readwrite');
    tx.objectStore(_GDB_STORE).put(slot);
    tx.oncomplete = resolve;
    tx.onerror    = () => reject(tx.error);
  });
}

async function loadSlotsFromDB() {
  const db = await openGalleryDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(_GDB_STORE, 'readonly');
    const req = tx.objectStore(_GDB_STORE).getAll();
    req.onsuccess = () => resolve((req.result || []).sort((a, b) => a.order - b.order));
    req.onerror   = () => reject(req.error);
  });
}

async function deleteSlotFromDB(id) {
  const db = await openGalleryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(_GDB_STORE, 'readwrite');
    tx.objectStore(_GDB_STORE).delete(id);
    tx.oncomplete = resolve;
    tx.onerror    = () => reject(tx.error);
  });
}

// ═══════════════════════════════════════════════════════
// 유틸
// ═══════════════════════════════════════════════════════
function _uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function _fileToDataUrl(file) {
  return new Promise(resolve => {
    const r = new FileReader();
    r.onload = e => resolve(e.target.result);
    r.readAsDataURL(file);
  });
}
function _loadImageSrc(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('이미지 로드 실패: ' + src?.slice(0, 50)));
    img.src = src;
  });
}
function _dataUrlToBlob(dataUrl) {
  const parts = dataUrl.split(',');
  const mime  = parts[0].match(/:(.*?);/)[1];
  const bin   = atob(parts[1]);
  const arr   = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

// ═══════════════════════════════════════════════════════
// 상태
// ═══════════════════════════════════════════════════════
let _photos         = [];        // [{ id, file, dataUrl }] — 미배정 사진 풀
let _slots          = [];        // IndexedDB에서 로드
let _selectedIds    = new Set(); // 그리드 탭-체크 선택 (사진 배정용)
let _popupSelIds    = new Set(); // 팝업 내 사진 선택 (일괄 편집용)
let _wsInited       = false;
let _dragPhotoId    = null;
let _dragSrcEl      = null;
let _popupSlotId    = null;
let _popupUsage     = null;
let _captionSlotId  = null;      // 글쓰기탭에 연결된 슬롯 ID
let _previewPhotoIdx = 0;        // 미리보기 팝업 현재 사진 인덱스
let _baMode         = false;     // 비포/애프터 모드 활성화 여부

// ═══════════════════════════════════════════════════════
// 홈 탭 퀵액션
// ═══════════════════════════════════════════════════════
function goWorkshopUpload() {
  showTab('workshop', document.querySelectorAll('.nav-btn')[1]);
  initWorkshopTab();
  setTimeout(() => {
    const zone = document.getElementById('wsDropZone');
    if (zone) {
      zone.scrollIntoView({ behavior: 'smooth', block: 'center' });
      zone.style.borderColor = 'var(--accent)';
      zone.style.background = 'rgba(241,128,145,0.06)';
      setTimeout(() => { zone.style.borderColor = ''; zone.style.background = ''; }, 1500);
    }
  }, 300);
}

// ═══════════════════════════════════════════════════════
// 작업실 탭 초기화
// ═══════════════════════════════════════════════════════
async function initWorkshopTab() {
  const root = document.getElementById('workshopRoot');
  if (!root) return;

  if (!_wsInited) {
    _wsInited = true;
    root.innerHTML = _buildWorkshopHTML();
    _initDragEvents();
  }

  try { _slots = await loadSlotsFromDB(); } catch(_e) { _slots = []; }
  _renderPhotoGrid();
  _renderSlotCards();
  _renderCompletionBanner();
}

function _buildWorkshopHTML() {
  return `
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
    <div class="sec-title" style="margin:0;">작업실 📷</div>
    <div style="display:flex;align-items:center;gap:8px;">
      <button id="wsResetBtn" onclick="resetWorkshop()" style="display:none;padding:5px 12px;border-radius:8px;border:1px solid rgba(220,53,69,0.3);background:transparent;color:#dc3545;font-size:11px;font-weight:700;cursor:pointer;">재시작</button>
      <div id="wsCompletionBadge" style="font-size:11px;font-weight:700;color:var(--accent2);"></div>
    </div>
  </div>
  <div class="sec-sub" style="margin-bottom:16px;">오늘 시술 결과를 인스타용으로 꾸며요</div>

  <!-- 사진 올리기 (메인 CTA) -->
  <div id="wsDropZone" style="background:var(--bg2);border:1.5px dashed rgba(241,128,145,0.4);border-radius:18px;padding:24px;text-align:center;margin-bottom:16px;cursor:pointer;transition:border-color 0.2s,background 0.2s;"
    onclick="document.getElementById('galleryFileInput').click()"
    ondragover="event.preventDefault();this.style.borderColor='var(--accent)';this.style.background='rgba(241,128,145,0.06)';"
    ondragleave="this.style.borderColor='';this.style.background='';"
    ondrop="_handleDropZoneDrop(event)"
    oncontextmenu="return false">
    <input type="file" id="galleryFileInput" accept="image/*" multiple style="display:none;" onchange="handleGalleryUpload(this)">
    <div style="font-size:36px;margin-bottom:8px;">📷</div>
    <div style="font-size:14px;font-weight:700;color:var(--text);">시술 사진 올려서 작업 시작</div>
    <div style="font-size:12px;color:var(--text3);margin-top:4px;">탭해서 사진 선택 · 최대 20장</div>
  </div>

  <!-- 슬롯 카드 (가로 스크롤) -->
  <div id="slotCardHeader" style="display:none;margin-bottom:12px;">
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <div style="font-size:13px;font-weight:800;color:var(--text);">👤 손님별 사진</div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span id="wsCompletionCount" style="font-size:11px;color:var(--text3);"></span>
        <button onclick="openAssignPopup()" style="padding:6px 12px;border-radius:8px;border:none;background:var(--accent);color:#fff;font-size:11px;font-weight:700;cursor:pointer;">+ 배정하기</button>
      </div>
    </div>
    <div style="font-size:11px;color:var(--text3);margin-top:6px;">💡 카드를 탭하면 배경/텍스트 편집할 수 있어요</div>
  </div>
  <div id="slotCardList" style="display:flex;gap:12px;overflow-x:auto;padding:4px 0 12px;-webkit-overflow-scrolling:touch;"></div>
  <div id="wsBanner" style="display:none;margin-bottom:8px;"></div>
  `;
}
// ═══════════════════════════════════════════════════════
// 사진 업로드
// ═══════════════════════════════════════════════════════
async function handleGalleryUpload(input) {
  const files     = Array.isArray(input) ? input : Array.from(input.files || []);
  const remaining = 20 - _photos.length;
  const toAdd     = files.slice(0, remaining);
  for (const file of toAdd) {
    _photos.push({ id: _uid(), file, dataUrl: await _fileToDataUrl(file) });
  }
  if (files.length > remaining) showToast(`최대 20장까지 가능해요 (${remaining}장 추가됨)`);
  if (!Array.isArray(input)) input.value = '';
  const zone = document.getElementById('wsDropZone');
  if (zone) { zone.style.borderColor = ''; zone.style.background = ''; }

  // 슬롯 없으면 자동 생성 (손님 1)
  if (_slots.length === 0 && toAdd.length > 0) {
    const slot = { id: _uid(), label: '손님 1', order: 0, photos: [], caption: '', hashtags: '', status: 'open', instagramPublished: false, deferredAt: null, createdAt: Date.now() };
    _slots.push(slot);
    try { await saveSlotToDB(slot); } catch(_e) {}
  }

  _renderPhotoGrid();
  _renderSlotCards();

  // 사진 추가했으면 배정 팝업 바로 열기
  if (toAdd.length > 0) {
    setTimeout(() => openAssignPopup(), 100);
  }
}

async function _handleDropZoneDrop(e) {
  e.preventDefault();
  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
  if (!files.length) { showToast('이미지 파일만 올릴 수 있어요'); return; }
  await handleGalleryUpload(files);
}

async function resetWorkshop() {
  if (!confirm('전체 초기화할까요?\n모든 사진과 슬롯이 삭제됩니다.')) return;
  for (const slot of _slots) {
    try { await deleteSlotFromDB(slot.id); } catch(_e) {}
  }
  _photos = []; _slots = [];
  _selectedIds.clear(); _popupSelIds.clear();
  _wsInited = false;
  const root = document.getElementById('workshopRoot');
  if (root) { root.innerHTML = _buildWorkshopHTML(); _initDragEvents(); }
  showToast('초기화 완료 ✅');
}

// ═══════════════════════════════════════════════════════
// UI 상태 업데이트
// ═══════════════════════════════════════════════════════
function _renderPhotoGrid() {
  // 재시작 버튼: 사진이나 슬롯이 있으면 표시
  const resetBtn = document.getElementById('wsResetBtn');
  if (resetBtn) resetBtn.style.display = (_photos.length > 0 || _slots.length > 0) ? 'block' : 'none';

  // 배정 팝업이 열려있으면 갱신
  const pop = document.getElementById('_assignPopup');
  if (pop && pop.style.display === 'flex') {
    _renderAssignPopup();
  }
}

function _isAssigned(id) {
  return _slots.some(s => s.photos?.some(p => p.id === id));
}

function togglePhotoSelect(id) {
  _selectedIds.has(id) ? _selectedIds.delete(id) : _selectedIds.add(id);
  _updateAssignBottomSheet();
}

// ═══════════════════════════════════════════════════════
// 통합 배정 팝업 (사진 + 슬롯 한 화면에서)
// ═══════════════════════════════════════════════════════
function openAssignPopup() {
  _selectedIds.clear();
  let pop = document.getElementById('_assignPopup');
  if (!pop) {
    pop = document.createElement('div');
    pop.id = '_assignPopup';
    pop.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,0.6);display:flex;align-items:flex-end;justify-content:center;';
    pop.onclick = e => { if (e.target === pop) closeAssignPopup(); };
    document.body.appendChild(pop);
  }
  _renderAssignPopup();
  pop.style.display = 'flex';
}

function closeAssignPopup() {
  const pop = document.getElementById('_assignPopup');
  if (pop) pop.style.display = 'none';
  _selectedIds.clear();
  _renderSlotCards();
  _renderPhotoGrid();
}

function _renderAssignPopup() {
  const pop = document.getElementById('_assignPopup');
  if (!pop) return;

  const unassigned = _photos.filter(p => !_isAssigned(p.id));

  // 미배정 사진 없고 모든 슬롯에 사진 있으면 완료
  if (unassigned.length === 0 && _slots.length > 0 && _slots.every(s => s.photos.length > 0)) {
    closeAssignPopup();
    showToast('배정 완료! 슬롯 카드를 탭해서 편집하세요 ✨');
    return;
  }

  // 슬롯별 썸네일 (가로 스크롤로 보여주기)
  const slotsHtml = _slots.map(slot => {
    const photos = (slot.photos || []).filter(p => !p.hidden);
    // 슬롯 내 사진들을 가로로 나열
    const photosPreview = photos.length > 0
      ? photos.slice(0, 4).map(p => `<img src="${p.editedDataUrl || p.dataUrl}" style="width:32px;height:32px;object-fit:cover;border-radius:6px;flex-shrink:0;">`).join('') + (photos.length > 4 ? `<div style="width:32px;height:32px;border-radius:6px;background:rgba(0,0,0,0.5);color:#fff;font-size:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">+${photos.length-4}</div>` : '')
      : '<div style="font-size:11px;color:var(--text3);">비어있음</div>';

    return `<div data-slot-drop="${slot.id}" onclick="${_selectedIds.size > 0 ? `_assignToSlotFromPopup('${slot.id}')` : ''}" style="flex-shrink:0;width:140px;background:#fff;border:2px solid ${_selectedIds.size > 0 ? 'var(--accent)' : 'var(--border)'};border-radius:14px;padding:10px;position:relative;${_selectedIds.size > 0 ? 'cursor:pointer;' : ''}">
      <button onclick="_deleteSlotInPopup('${slot.id}');event.stopPropagation();" style="position:absolute;top:4px;right:4px;width:18px;height:18px;border-radius:50%;background:rgba(0,0,0,0.08);border:none;color:#999;font-size:10px;cursor:pointer;z-index:2;">✕</button>
      <div style="font-size:12px;font-weight:800;color:var(--text);margin-bottom:6px;">${slot.label}</div>
      <div style="display:flex;gap:4px;overflow-x:auto;min-height:32px;align-items:center;">${photosPreview}</div>
      ${_selectedIds.size > 0 ? `<div style="margin-top:8px;padding:6px;border-radius:8px;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;font-size:11px;font-weight:700;text-align:center;">여기에 넣기</div>` : ''}
    </div>`;
  }).join('');

  pop.innerHTML = `
    <div style="width:100%;max-width:480px;background:#fff;border-radius:24px 24px 0 0;max-height:85vh;overflow:hidden;display:flex;flex-direction:column;" oncontextmenu="return false">
      <!-- 헤더 -->
      <div style="display:flex;justify-content:center;padding:10px 0 4px;">
        <div style="width:40px;height:4px;border-radius:2px;background:rgba(0,0,0,0.12);"></div>
      </div>
      <div style="padding:8px 16px 12px;border-bottom:1px solid var(--border);">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div style="font-size:16px;font-weight:800;color:var(--text);">📷 사진 → 손님 배정</div>
          <button onclick="closeAssignPopup()" style="background:transparent;border:none;font-size:24px;color:#aaa;cursor:pointer;padding:0 4px;">×</button>
        </div>
        <div style="font-size:11px;color:var(--text3);margin-top:4px;">사진 선택 후 아래 손님 카드를 탭하세요</div>
      </div>

      <!-- 미배정 사진 (가로 스와이프) -->
      <div style="padding:12px 16px;border-bottom:1px solid var(--border);background:#fafafa;">
        <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:8px;">📸 미배정 ${unassigned.length}장</div>
        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
          <div style="display:flex;gap:8px;min-width:max-content;padding:2px;">
            ${unassigned.length ? unassigned.map(photo => {
              const sel = _selectedIds.has(photo.id);
              return `<div onclick="togglePhotoSelect('${photo.id}');_renderAssignPopup();" style="flex-shrink:0;width:64px;cursor:pointer;">
                <div style="position:relative;width:64px;height:64px;border-radius:10px;overflow:hidden;border:3px solid ${sel ? 'var(--accent)' : 'transparent'};box-shadow:${sel ? '0 2px 8px rgba(241,128,145,0.4)' : 'none'};">
                  <img src="${photo.dataUrl}" style="width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;">
                  <div style="position:absolute;top:2px;right:2px;width:18px;height:18px;border-radius:50%;border:2px solid #fff;background:${sel ? 'var(--accent)' : 'rgba(0,0,0,0.3)'};display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff;">${sel ? '✓' : ''}</div>
                </div>
              </div>`;
            }).join('') : '<div style="padding:16px;text-align:center;color:var(--accent2);font-size:12px;font-weight:600;">모든 사진 배정 완료 ✅</div>'}
          </div>
        </div>
      </div>

      <!-- 손님 슬롯 (가로 스와이프) -->
      <div style="flex:1;padding:12px 16px;overflow:hidden;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <div style="font-size:11px;font-weight:700;color:var(--text3);">👤 손님 슬롯 ${_slots.length}개</div>
          <button onclick="_addSlotInPopup()" style="padding:5px 10px;border-radius:6px;border:1.5px solid var(--accent);background:transparent;color:var(--accent);font-size:10px;font-weight:700;cursor:pointer;">+ 추가</button>
        </div>
        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:8px;">
          <div style="display:flex;gap:10px;min-width:max-content;">
            ${slotsHtml || '<div style="padding:20px;color:var(--text3);font-size:12px;">슬롯이 없어요. + 추가를 눌러주세요</div>'}
          </div>
        </div>
      </div>

      <!-- 하단: 선택 삭제 -->
      ${_selectedIds.size > 0 ? `
        <div style="padding:10px 16px;border-top:1px solid var(--border);background:#fff;display:flex;align-items:center;justify-content:space-between;">
          <div style="font-size:12px;font-weight:700;color:var(--accent);">${_selectedIds.size}장 선택됨</div>
          <button onclick="_deleteSelectedInPopup()" style="padding:8px 14px;border-radius:8px;border:1px solid rgba(220,53,69,0.4);background:transparent;color:#dc3545;font-size:11px;font-weight:600;cursor:pointer;">삭제</button>
        </div>
      ` : ''}
    </div>
  `;
}

async function _addSlotInPopup() {
  // 번호 재정렬 후 다음 번호 사용
  await _renumberSlots();
  const num = _slots.length + 1;
  const slot = { id: _uid(), label: `손님 ${num}`, order: num - 1, photos: [], caption: '', hashtags: '', status: 'open', instagramPublished: false, deferredAt: null, createdAt: Date.now() };
  _slots.push(slot);
  try { await saveSlotToDB(slot); } catch(_e) {}
  _renderAssignPopup();
}

async function _deleteSlotInPopup(slotId) {
  const slot = _slots.find(s => s.id === slotId);
  // 배정된 사진들을 미배정 풀로 복귀
  if (slot) {
    slot.photos.forEach(sp => {
      if (!_photos.find(p => p.id === sp.id)) {
        _photos.push({ id: sp.id, file: null, dataUrl: sp.dataUrl });
      }
    });
  }
  _slots = _slots.filter(s => s.id !== slotId);
  try { await deleteSlotFromDB(slotId); } catch(_e) {}
  // 슬롯 번호 재정렬
  _renumberSlots();
  _renderAssignPopup();
}

function _assignToSlotFromPopup(slotId) {
  if (!_selectedIds.size) return;
  [..._selectedIds].forEach(id => _assignToSlot(id, slotId));
  _selectedIds.clear();
  showToast('배정 완료 ✅');
  _renderAssignPopup();
}

function _deleteSelectedInPopup() {
  if (!_selectedIds.size) return;
  _photos = _photos.filter(p => !_selectedIds.has(p.id));
  _selectedIds.clear();
  showToast('삭제됨');
  _renderAssignPopup();
}

// 슬롯 번호 재정렬 (삭제 후)
async function _renumberSlots() {
  _slots.forEach((slot, i) => {
    slot.label = `손님 ${i + 1}`;
    slot.order = i;
  });
  for (const slot of _slots) {
    try { await saveSlotToDB(slot); } catch(_e) {}
  }
}

// 기존 함수들 호환용
function _updateAssignBottomSheet() { _renderAssignPopup(); }

// ═══════════════════════════════════════════════════════
// 슬롯 카드 (가로 스크롤)
// ═══════════════════════════════════════════════════════
function _renderSlotCards() {
  const list   = document.getElementById('slotCardList');
  const header = document.getElementById('slotCardHeader');
  const completionEl = document.getElementById('wsCompletionCount');
  if (!list) return;

  if (!_slots.length) {
    list.innerHTML = '';
    if (header) header.style.display = 'none';
    return;
  }

  if (header) header.style.display = 'block';
  const doneCount = _slots.filter(s => s.status === 'done').length;
  if (completionEl) completionEl.textContent = doneCount > 0 ? `${doneCount}/${_slots.length} 완료` : '';

  list.innerHTML = '';
  _slots.forEach(slot => {
    const done = slot.status === 'done';
    const visiblePhotos = (slot.photos || []).filter(p => !p.hidden);
    const thumb = visiblePhotos[0];
    const photoCount = visiblePhotos.length;

    const card = document.createElement('div');
    card.style.cssText = `flex-shrink:0;width:140px;background:#fff;border:2px solid ${done ? 'rgba(76,175,80,0.5)' : 'var(--border)'};border-radius:14px;padding:10px;user-select:none;-webkit-user-select:none;position:relative;`;
    card.dataset.slotId = slot.id;
    card.setAttribute('oncontextmenu', 'return false');

    const thumbHtml = thumb
      ? `<div onclick="openSlotPopup('${slot.id}')" style="position:relative;width:100%;aspect-ratio:1/1;border-radius:10px;overflow:hidden;cursor:pointer;">
          <img src="${thumb.editedDataUrl || thumb.dataUrl}" style="width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;">
          ${photoCount > 1 ? `<div style="position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,0.6);border-radius:6px;padding:2px 6px;font-size:9px;color:#fff;font-weight:700;">+${photoCount}</div>` : ''}
        </div>`
      : `<div onclick="openAssignPopup()" style="width:100%;aspect-ratio:1/1;border-radius:10px;border:2px dashed rgba(241,128,145,0.35);display:flex;align-items:center;justify-content:center;cursor:pointer;background:rgba(241,128,145,0.03);font-size:20px;color:var(--text3);">+</div>`;

    card.innerHTML = `
      <button onclick="deleteSlot('${slot.id}',event)" style="position:absolute;top:6px;right:6px;z-index:2;background:rgba(255,255,255,0.9);border:none;font-size:12px;color:var(--text3);cursor:pointer;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;">✕</button>
      ${thumbHtml}
      <div style="margin-top:6px;text-align:center;">
        <div style="font-size:11px;font-weight:800;color:var(--text);">${slot.label}${done ? ' ✅' : ''}</div>
        <div style="font-size:10px;color:var(--text3);margin-top:2px;">${photoCount}장</div>
      </div>
    `;
    list.appendChild(card);
  });

  // 재시작 버튼
  const resetBtn = document.getElementById('wsResetBtn');
  if (resetBtn) resetBtn.style.display = _slots.length > 0 ? 'block' : 'none';
}

async function deleteSlot(slotId, e) {
  e?.stopPropagation();
  const slot = _slots.find(s => s.id === slotId);
  // 배정된 사진들을 미배정 풀로 복귀
  if (slot) {
    slot.photos.forEach(sp => {
      if (!_photos.find(p => p.id === sp.id)) {
        _photos.push({ id: sp.id, file: null, dataUrl: sp.dataUrl });
      }
    });
  }
  _slots = _slots.filter(s => s.id !== slotId);
  try { await deleteSlotFromDB(slotId); } catch(_e) {}
  // 슬롯 번호 재정렬
  await _renumberSlots();
  _renderSlotCards();
  _renderPhotoGrid();
  _renderCompletionBanner();
}

// ═══════════════════════════════════════════════════════
// 완료 현황 배너 + 다음 손님 유도
// ═══════════════════════════════════════════════════════
function _renderCompletionBanner() {
  const badge  = document.getElementById('wsCompletionBadge');
  const banner = document.getElementById('wsBanner');
  if (!_slots.length) {
    if (badge)  badge.textContent  = '';
    if (banner) banner.style.display = 'none';
    return;
  }
  const done  = _slots.filter(s => s.status === 'done').length;
  const total = _slots.length;
  if (badge) badge.textContent = `${done}/${total} 완료`;

  if (banner) {
    if (done > 0) {
      banner.style.display = 'block';
      const allDone = done === total;
      // 다음 미완료 슬롯 찾기 (사진이 있는 것 우선)
      const nextSlot = _slots.find(s => s.status !== 'done' && s.photos.length > 0)
                    || _slots.find(s => s.status !== 'done');

      if (allDone) {
        // 모든 작업 완료
        banner.innerHTML = `
          <div style="background:rgba(76,175,80,0.1);border:1.5px solid rgba(76,175,80,0.3);border-radius:16px;padding:14px 16px;">
            <div style="font-size:13px;font-weight:700;color:#388e3c;margin-bottom:10px;">🎉 모든 작업 완료!</div>
            <button onclick="showTab('caption',document.querySelectorAll('.nav-btn')[2]); initCaptionSlotPicker(); if(typeof renderCaptionKeywordTags==='function')renderCaptionKeywordTags();" style="width:100%;padding:12px;border-radius:12px;border:none;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;font-size:13px;font-weight:800;cursor:pointer;">지금 글쓰기로 →</button>
          </div>
        `;
      } else {
        // 일부 완료 + 다음 손님 유도
        const nextLabel = nextSlot ? nextSlot.label : '다음 손님';
        banner.innerHTML = `
          <div style="background:rgba(241,128,145,0.07);border:1.5px solid rgba(241,128,145,0.2);border-radius:16px;padding:14px 16px;">
            <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:10px;">${nextLabel} 작업할까요? <span style="color:var(--text3);font-weight:400;">(완료 ${done}/${total})</span></div>
            <div style="display:flex;gap:8px;">
              ${nextSlot ? `<button onclick="openSlotPopup('${nextSlot.id}')" style="flex:1;padding:10px 14px;border-radius:10px;border:none;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;font-size:12px;font-weight:700;cursor:pointer;">${nextLabel} →</button>` : ''}
              <button onclick="showTab('caption',document.querySelectorAll('.nav-btn')[2]); initCaptionSlotPicker(); if(typeof renderCaptionKeywordTags==='function')renderCaptionKeywordTags();" style="flex:1;padding:10px 14px;border-radius:10px;border:1.5px solid var(--accent);background:transparent;color:var(--accent);font-size:12px;font-weight:700;cursor:pointer;">지금 글쓰기로 →</button>
            </div>
          </div>
        `;
      }
    } else {
      banner.style.display = 'none';
    }
  }
}

// ═══════════════════════════════════════════════════════
// 사진 배정
// ═══════════════════════════════════════════════════════

function _assignToSlot(photoId, slotId) {
  const photo = _photos.find(p => p.id === photoId);
  const slot  = _slots.find(s => s.id === slotId);
  if (!photo || !slot || slot.photos.find(p => p.id === photoId)) return;
  slot.photos.push({ id: photo.id, dataUrl: photo.dataUrl, mode: 'original', editedDataUrl: null });
  saveSlotToDB(slot).catch(() => {});
}

// ═══════════════════════════════════════════════════════
// 드래그 (Touch + Mouse)
// ═══════════════════════════════════════════════════════
function _initDragEvents() {
  document.addEventListener('touchmove',  _moveDragInd, { passive: true });
  document.addEventListener('mousemove',  _moveDragIndMouse);
  document.addEventListener('touchend',   _onDragEnd, { passive: false });
  document.addEventListener('mouseup',    _onDragEnd);
}

function _showDragIndicator(dataUrl) {
  let ind = document.getElementById('_gDragInd');
  if (!ind) {
    ind = document.createElement('div');
    ind.id = '_gDragInd';
    ind.style.cssText = 'position:fixed;width:60px;height:60px;border-radius:10px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.25);pointer-events:none;z-index:9999;opacity:0.85;display:none;transition:none;';
    ind.innerHTML = '<img style="width:100%;height:100%;object-fit:cover;">';
    document.body.appendChild(ind);
  }
  ind.querySelector('img').src = dataUrl;
  ind.style.display = 'block';
}

function _moveDragInd(e) {
  if (!_dragPhotoId) return;
  const ind = document.getElementById('_gDragInd');
  if (!ind) return;
  const t = e.touches[0];
  ind.style.left = (t.clientX - 30) + 'px';
  ind.style.top  = (t.clientY - 30) + 'px';
}

function _moveDragIndMouse(e) {
  if (!_dragPhotoId) return;
  const ind = document.getElementById('_gDragInd');
  if (!ind) return;
  ind.style.left = (e.clientX - 30) + 'px';
  ind.style.top  = (e.clientY - 30) + 'px';
}

function _hideDragIndicator() {
  const ind = document.getElementById('_gDragInd');
  if (ind) ind.style.display = 'none';
}

function _onDragEnd() {
  if (_dragPhotoId) { _hideDragIndicator(); _dragPhotoId = null; _dragSrcEl = null; }
}

// ═══════════════════════════════════════════════════════
// 슬롯 팝업 (풀스크린)
// ═══════════════════════════════════════════════════════
async function openSlotPopup(slotId) {
  const slot = _slots.find(s => s.id === slotId);
  if (!slot) return;
  _popupSlotId = slotId;
  _popupSelIds.clear();

  document.getElementById('slotPopupLabel').textContent = slot.label + (slot.status === 'done' ? ' ✅' : '');
  document.getElementById('slotPopup').style.display = 'flex';

  try {
    const res = await fetch(API + '/image/usage', { headers: authHeader() });
    if (res.ok) _popupUsage = await res.json();
  } catch(_e) { _popupUsage = null; }

  _renderPopupBody(slot);
}

function closeSlotPopup() {
  document.getElementById('slotPopup').style.display = 'none';
  _popupSlotId = null;
  _popupSelIds.clear();
  _renderSlotCards();
  _renderPhotoGrid();
}

async function saveAndCloseSlotPopup() {
  const slot = _slots.find(s => s.id === _popupSlotId);
  if (slot) {
    slot.status = 'done';
    try { await saveSlotToDB(slot); } catch(_e) {}
  }
  closeSlotPopup();
  _renderCompletionBanner();

  // 완료 후 다음 손님 유도 토스트
  const done = _slots.filter(s => s.status === 'done').length;
  const total = _slots.length;
  const nextSlot = _slots.find(s => s.status !== 'done' && s.photos.length > 0);

  if (nextSlot) {
    _showNextSlotGuide(nextSlot, done, total);
  } else if (done === total) {
    showToast('🎉 모든 작업 완료! 글쓰기로 이동하세요');
  }
}

// 다음 손님 유도 바텀시트
function _showNextSlotGuide(nextSlot, doneCount, totalCount) {
  let pop = document.getElementById('_nextSlotGuide');
  if (!pop) {
    pop = document.createElement('div');
    pop.id = '_nextSlotGuide';
    pop.style.cssText = 'position:fixed;inset:0;z-index:9400;background:rgba(0,0,0,0.4);display:flex;align-items:flex-end;justify-content:center;';
    pop.onclick = e => { if (e.target === pop) pop.style.display = 'none'; };
    document.body.appendChild(pop);
  }
  pop.innerHTML = `
    <div style="width:100%;max-width:480px;background:#fff;border-radius:20px 20px 0 0;padding:20px 16px 28px;">
      <div style="display:flex;justify-content:center;padding:0 0 12px;">
        <div style="width:36px;height:4px;border-radius:2px;background:rgba(0,0,0,0.12);"></div>
      </div>
      <div style="text-align:center;margin-bottom:16px;">
        <div style="font-size:32px;margin-bottom:8px;">✅</div>
        <div style="font-size:15px;font-weight:800;color:var(--text);">${nextSlot.label.replace('손님','손님 ')}도 작업할까요?</div>
        <div style="font-size:12px;color:var(--text3);margin-top:4px;">완료 ${doneCount}/${totalCount}</div>
      </div>
      <div style="display:flex;gap:10px;">
        <button onclick="document.getElementById('_nextSlotGuide').style.display='none';openSlotPopup('${nextSlot.id}')" style="flex:1;padding:14px;border-radius:14px;border:none;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;font-size:14px;font-weight:800;cursor:pointer;">${nextSlot.label} →</button>
        <button onclick="document.getElementById('_nextSlotGuide').style.display='none';showTab('caption',document.querySelectorAll('.nav-btn')[2]);initCaptionSlotPicker();if(typeof renderCaptionKeywordTags==='function')renderCaptionKeywordTags();" style="flex:1;padding:14px;border-radius:14px;border:1.5px solid var(--accent);background:transparent;color:var(--accent);font-size:14px;font-weight:700;cursor:pointer;">지금 글쓰기로 →</button>
      </div>
    </div>
  `;
  pop.style.display = 'flex';
}

function _renderPopupBody(slot) {
  const body = document.getElementById('slotPopupBody');
  if (!body) return;

  const usageHtml = _popupUsage
    ? `<div style="font-size:11px;color:var(--text3);margin-bottom:12px;">AI 누끼따기 남은 횟수: <b style="color:var(--accent);">${_popupUsage.limit - _popupUsage.used}/${_popupUsage.limit}회</b></div>`
    : '';

  body.innerHTML = `
    ${usageHtml}
    <!-- 사진 추가 -->
    <div style="margin-bottom:12px;">
      <input type="file" id="popupPhotoInput" accept="image/*" multiple style="display:none;" onchange="addPhotosToPopup(this)">
      <button onclick="document.getElementById('popupPhotoInput').click()" style="width:100%;padding:11px;border-radius:12px;border:1.5px dashed rgba(241,128,145,0.4);background:transparent;color:var(--accent2);font-size:12px;font-weight:700;cursor:pointer;">+ 사진 추가</button>
    </div>
    <!-- 사진 그리드 -->
    <div id="popupPhotoGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:12px;"></div>
    <!-- 선택 삭제 (선택 시 노출) -->
    <div id="popupBulkBar" style="display:none;background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:12px;margin-bottom:12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div style="font-size:12px;font-weight:700;color:var(--text);"><span id="popupSelCount">0</span>장 선택됨</div>
        <button onclick="_bulkDeletePopup()" style="padding:8px 14px;border-radius:8px;border:1px solid rgba(220,53,69,0.4);background:transparent;color:#dc3545;font-size:11px;font-weight:700;cursor:pointer;">선택 삭제</button>
      </div>
    </div>
    <div id="popupProgress" style="display:none;text-align:center;padding:16px;font-size:13px;color:var(--text3);">처리 중... ⏳</div>
    <!-- 안내 문구 -->
    <div style="text-align:center;padding:8px;font-size:11px;color:var(--text3);background:rgba(241,128,145,0.06);border-radius:10px;">
      💡 배경 편집은 하단 <b>배경</b> 탭에서 할 수 있어요
    </div>
  `;
  _renderPopupPhotoGrid(slot);
}

function _renderPopupPhotoGrid(slot) {
  const grid = document.getElementById('popupPhotoGrid');
  const bulkBar = document.getElementById('popupBulkBar');
  const selCount = document.getElementById('popupSelCount');
  if (!grid) return;

  const visiblePhotos = (slot.photos || []).filter(p => !p.hidden);

  if (!visiblePhotos.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;font-size:13px;color:var(--text3);">사진을 추가해주세요</div>';
    if (bulkBar) bulkBar.style.display = 'none';
    return;
  }

  if (selCount) selCount.textContent = _popupSelIds.size;
  if (bulkBar)  bulkBar.style.display = _popupSelIds.size > 0 ? 'block' : 'none';

  // 선택 순서에 따른 BEFORE/AFTER 라벨 (비포/애프터 모드일 때만)
  const selArr = [..._popupSelIds];
  const baLabelMap = {};
  if (_baMode) {
    if (selArr[0]) baLabelMap[selArr[0]] = 'BEFORE';
    if (selArr[1]) baLabelMap[selArr[1]] = 'AFTER';
  }

  const modeColor = { original: 'var(--text3)', ai_bg: 'var(--accent)', ba: '#8fa4ff' };
  const modeLabel = { original: '원본', ai_bg: 'AI합성', ba: '비포/애프터' };

  grid.innerHTML = '';
  visiblePhotos.forEach(photo => {
    const sel   = _popupSelIds.has(photo.id);
    const baLbl = baLabelMap[photo.id];

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:3px;user-select:none;-webkit-user-select:none;';
    wrap.setAttribute('oncontextmenu', 'return false');

    const imgBox = document.createElement('div');
    imgBox.style.cssText = `position:relative;aspect-ratio:1/1;border-radius:10px;overflow:hidden;border:2.5px solid ${sel ? 'var(--accent)' : 'transparent'};cursor:pointer;user-select:none;-webkit-user-select:none;`;
    imgBox.innerHTML = `
      <img src="${photo.editedDataUrl || photo.dataUrl}" style="width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;user-select:none;-webkit-user-select:none;-webkit-user-drag:none;">
      <div style="position:absolute;top:3px;right:3px;width:18px;height:18px;border-radius:50%;border:2px solid #fff;background:${sel ? 'var(--accent)' : 'rgba(0,0,0,0.3)'};display:flex;align-items:center;justify-content:center;font-size:9px;color:#fff;">${sel ? '✓' : ''}</div>
      <div style="position:absolute;bottom:0;left:0;right:0;padding:3px 5px;background:rgba(0,0,0,0.55);font-size:9px;color:${modeColor[photo.mode]};font-weight:700;">${modeLabel[photo.mode] || '원본'}</div>
      ${baLbl ? `<div style="position:absolute;top:3px;left:3px;background:${baLbl==='BEFORE'?'rgba(100,149,237,0.92)':'rgba(241,128,145,0.92)'};border-radius:4px;padding:2px 6px;font-size:9px;color:#fff;font-weight:800;">${baLbl}</div>` : ''}
      <button onclick="unassignPopupPhoto('${photo.id}',event)" style="position:absolute;top:${baLbl?'22':'3'}px;left:3px;width:18px;height:18px;border-radius:50%;background:rgba(0,0,0,0.5);border:none;color:#fff;font-size:9px;cursor:pointer;z-index:2;line-height:1;">↩</button>
    `;
    imgBox.addEventListener('click', e => { e.stopPropagation(); togglePopupPhotoSel(photo.id); });
    // 텍스트 선택 방지
    imgBox.addEventListener('touchstart', e => { e.preventDefault(); }, { passive: false });
    wrap.appendChild(imgBox);

    if (photo.mode === 'ba') {
      const restoreBtn = document.createElement('button');
      restoreBtn.textContent = '↩ 되돌리기';
      restoreBtn.style.cssText = 'width:100%;padding:3px;border-radius:6px;border:1px solid rgba(143,164,255,0.5);background:transparent;font-size:10px;color:#8fa4ff;cursor:pointer;font-weight:700;';
      restoreBtn.onclick = () => restoreBAPhoto(photo.id);
      wrap.appendChild(restoreBtn);
    }

    const previewBtn = document.createElement('button');
    previewBtn.textContent = '미리보기';
    previewBtn.style.cssText = 'width:100%;padding:3px;border-radius:6px;border:1px solid var(--border);background:transparent;font-size:10px;color:var(--text3);cursor:pointer;';
    previewBtn.onclick = () => showPhotoInstaPreview(photo.editedDataUrl || photo.dataUrl);
    wrap.appendChild(previewBtn);

    grid.appendChild(wrap);
  });
}

function togglePopupPhotoSel(id) {
  _popupSelIds.has(id) ? _popupSelIds.delete(id) : _popupSelIds.add(id);
  const slot = _slots.find(s => s.id === _popupSlotId);
  if (slot) _renderPopupPhotoGrid(slot);
  // 비포/애프터 모드에서 2장 선택시 자동 적용
  if (_baMode && _popupSelIds.size >= 2) {
    setTimeout(() => _checkAndApplyBA(), 100);
  }
}

// 팝업에서 사진 배정 취소 (미배정 풀로 복귀)
async function unassignPopupPhoto(photoId, e) {
  e?.stopPropagation();
  const slot = _slots.find(s => s.id === _popupSlotId);
  if (!slot) return;
  const sp = slot.photos.find(p => p.id === photoId);
  if (sp && !_photos.find(p => p.id === photoId)) {
    _photos.push({ id: sp.id, file: null, dataUrl: sp.dataUrl });
  }
  slot.photos = slot.photos.filter(p => p.id !== photoId);
  _popupSelIds.delete(photoId);
  try { await saveSlotToDB(slot); } catch(_e) {}
  _renderPopupPhotoGrid(slot);
  showToast('배정 취소됨 — 미배정 사진으로 돌아갔어요');
}

async function addPhotosToPopup(input) {
  const slot = _slots.find(s => s.id === _popupSlotId);
  if (!slot) return;
  for (const file of Array.from(input.files)) {
    const dataUrl = await _fileToDataUrl(file);
    const id = _uid();
    slot.photos.push({ id, dataUrl, mode: 'original', editedDataUrl: null });
    _photos.push({ id, file, dataUrl });
  }
  input.value = '';
  try { await saveSlotToDB(slot); } catch(_e) {}
  _renderPopupPhotoGrid(slot);
}

// 비포/애프터 모드 토글
function toggleBAMode() {
  _baMode = !_baMode;
  const btn = document.getElementById('baBtnToolbar');
  if (btn) {
    btn.style.background = _baMode ? 'linear-gradient(135deg,#8fa4ff,#a3b4ff)' : '#fff';
    btn.style.color = _baMode ? '#fff' : 'var(--text)';
    btn.style.borderColor = _baMode ? '#8fa4ff' : 'var(--border)';
  }
  if (_baMode) {
    _popupSelIds.clear();
    showToast('비포/애프터 모드 ON\n사진 2장을 순서대로 선택하세요');
  } else {
    showToast('비포/애프터 모드 OFF');
  }
  const slot = _slots.find(s => s.id === _popupSlotId);
  if (slot) _renderPopupPhotoGrid(slot);
}

// 비포/애프터 모드에서 2장 선택 완료시 자동 적용
async function _checkAndApplyBA() {
  if (!_baMode || _popupSelIds.size < 2) return;
  await _bulkApplyBA();
  _baMode = false;
  const btn = document.getElementById('baBtnToolbar');
  if (btn) {
    btn.style.background = '#fff';
    btn.style.color = 'var(--text)';
    btn.style.borderColor = 'var(--border)';
  }
}

async function _bulkApplyBA() {
  if (_popupSelIds.size < 2) {
    showToast('사진 2장 선택해주세요');
    return;
  }
  const slot = _slots.find(s => s.id === _popupSlotId);
  if (!slot) return;
  const selArr   = [..._popupSelIds];
  const beforeId = selArr[0];
  const afterId  = selArr[1];
  const before   = slot.photos.find(p => p.id === beforeId);
  const after    = slot.photos.find(p => p.id === afterId);
  if (!before || !after) return;
  const progress = document.getElementById('popupProgress');
  if (progress) progress.style.display = 'block';
  await _applyBABetween(before, after, slot);
  // AFTER 사진 숨김 처리 + 연결 ID 저장 (되돌리기용)
  before.baAfterRefId = afterId;
  after.hidden = true;
  try { await saveSlotToDB(slot); } catch(_e) {}
  if (progress) progress.style.display = 'none';
  _popupSelIds.clear();
  _renderPopupPhotoGrid(slot);
  showToast('비포/애프터 완료! [되돌리기]로 원본 복원 가능해요 ✅');
}

async function restoreBAPhoto(baPhotoId) {
  const slot = _slots.find(s => s.id === _popupSlotId);
  if (!slot) return;
  const baPhoto = slot.photos.find(p => p.id === baPhotoId);
  if (!baPhoto) return;
  if (baPhoto.baAfterRefId) {
    const afterPhoto = slot.photos.find(p => p.id === baPhoto.baAfterRefId);
    if (afterPhoto) afterPhoto.hidden = false;
  }
  baPhoto.mode = 'original';
  baPhoto.editedDataUrl = null;
  baPhoto.baAfterRefId = null;
  try { await saveSlotToDB(slot); } catch(_e) {}
  _renderPopupPhotoGrid(slot);
  showToast('원본 2장으로 복원됐어요');
}

function showPhotoInstaPreview(dataUrl) {
  let pop = document.getElementById('_wsInstaPreviewPop');
  if (!pop) {
    pop = document.createElement('div');
    pop.id = '_wsInstaPreviewPop';
    pop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:10000;display:flex;align-items:center;justify-content:center;flex-direction:column;padding:20px;box-sizing:border-box;';
    pop.innerHTML = `
      <div style="width:100%;max-width:380px;">
        <div style="background:#fff;border-radius:14px;overflow:hidden;">
          <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #f0f0f0;">
            <div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent2));display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:800;">잇</div>
            <div style="font-size:13px;font-weight:700;">@itdasy</div>
          </div>
          <img id="_wsPreviewImg" style="width:100%;aspect-ratio:1/1;object-fit:cover;display:block;">
          <div style="padding:8px 12px;font-size:11px;color:#888;">인스타 피드 1:1 비율 미리보기</div>
        </div>
      </div>
      <button onclick="document.getElementById('_wsInstaPreviewPop').style.display='none'" style="margin-top:16px;color:#fff;background:transparent;border:1px solid rgba(255,255,255,0.3);border-radius:20px;padding:8px 20px;font-size:13px;cursor:pointer;">닫기</button>
    `;
    document.body.appendChild(pop);
  }
  document.getElementById('_wsPreviewImg').src = dataUrl;
  pop.style.display = 'flex';
}

async function _bulkDeletePopup() {
  const slot = _slots.find(s => s.id === _popupSlotId);
  if (!slot || !_popupSelIds.size) return;
  if (!confirm(`선택한 ${_popupSelIds.size}장을 삭제할까요?`)) return;
  slot.photos = slot.photos.filter(p => !_popupSelIds.has(p.id));
  try { await saveSlotToDB(slot); } catch(_e) {}
  _popupSelIds.clear();
  _renderPopupPhotoGrid(slot);
  _renderSlotCards();
  showToast('삭제됨');
}

// ═══════════════════════════════════════════════════════
// 비포/애프터 합성 (app-portfolio.js 공유 유틸 사용)
// ═══════════════════════════════════════════════════════
async function _applyBABetween(before, after, slot) {
  try {
    const beforeImg = await _loadImageSrc(before.editedDataUrl || before.dataUrl);
    const afterImg  = await _loadImageSrc(after.editedDataUrl || after.dataUrl);
    const canvas    = document.createElement('canvas');
    renderBASplit(canvas, beforeImg, afterImg, 1080, 1080);
    before.editedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
    before.mode = 'ba';
    await saveSlotToDB(slot);
  } catch(e) { showToast('오류: ' + e.message); }
}

// Itdasy Studio - 배경창고 + 템플릿 (app-gallery.js에서 분리)

// ═══════════════════════════════════════════════════════
// 배경창고 (슬롯 편집 도구)
// ═══════════════════════════════════════════════════════
const DEFAULT_BACKGROUNDS = [
  { id: 'cloud_bw', name: '구름(흑백)', type: 'preset', color: '#f5f5f5', gradient: 'linear-gradient(180deg,#e8e8e8 0%,#f8f8f8 50%,#e0e0e0 100%)' },
  { id: 'cloud_color', name: '구름(컬러)', type: 'preset', color: '#e8f4fc', gradient: 'linear-gradient(180deg,#d4e8f7 0%,#f0f7fc 50%,#c5dff0 100%)' },
  { id: 'pink', name: '핑크', type: 'preset', color: '#fff0f3', gradient: 'linear-gradient(180deg,#ffe4ec 0%,#fff5f7 50%,#ffd6e0 100%)' },
  { id: 'white', name: '화이트', type: 'preset', color: '#ffffff', gradient: 'linear-gradient(180deg,#f8f8f8 0%,#ffffff 50%,#f5f5f5 100%)' },
];

let _selectedBgId = 'cloud_bw';

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
  document.getElementById('bgPanel').style.display = 'block';
  _renderBgPanel();
}
function closeBgPanel() {
  document.getElementById('bgPanel').style.display = 'none';
}

function _renderBgPanel() {
  const body = document.getElementById('bgPanelBody');
  if (!body) return;

  const userBgs = _loadUserBgs();
  const favIds = _loadFavBgs();
  const allBgs = [...DEFAULT_BACKGROUNDS, ...userBgs];

  // 즐겨찾기 상단, 나머지 아래
  const favBgs = allBgs.filter(b => favIds.includes(b.id));
  const otherBgs = allBgs.filter(b => !favIds.includes(b.id));

  const renderCard = (bg, isFav) => {
    const isSelected = _selectedBgId === bg.id;
    const isUser = bg.type === 'user';
    const preview = bg.imageData
      ? `<img src="${bg.imageData}" style="width:100%;height:100%;object-fit:cover;">`
      : `<div style="width:100%;height:100%;background:${bg.gradient || bg.color};"></div>`;

    return `
      <div onclick="selectBg('${bg.id}')" style="position:relative;cursor:pointer;">
        <div style="aspect-ratio:1/1;border-radius:12px;overflow:hidden;border:${isSelected ? '3px solid var(--accent)' : '1.5px solid var(--border)'};">
          ${preview}
        </div>
        <div style="font-size:10px;color:var(--text2);text-align:center;margin-top:4px;font-weight:600;">${bg.name}</div>
        <!-- 즐겨찾기 토글 -->
        <button onclick="toggleFavBg('${bg.id}',event)" style="position:absolute;top:4px;left:4px;width:24px;height:24px;border-radius:50%;border:none;background:rgba(255,255,255,0.9);font-size:12px;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,0.15);">${isFav ? '⭐' : '☆'}</button>
        ${isUser ? `<button onclick="deleteUserBg('${bg.id}',event)" style="position:absolute;top:4px;right:4px;width:24px;height:24px;border-radius:50%;border:none;background:rgba(255,255,255,0.9);color:#dc3545;font-size:14px;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,0.15);">×</button>` : ''}
      </div>
    `;
  };

  body.innerHTML = `
    ${favBgs.length ? `
      <div style="margin-bottom:16px;">
        <div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:10px;">⭐ 즐겨찾기</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;">
          ${favBgs.map(bg => renderCard(bg, true)).join('')}
        </div>
      </div>
    ` : ''}
    <div style="margin-bottom:16px;">
      <div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:10px;">🎨 배경 선택</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;">
        ${otherBgs.map(bg => renderCard(bg, false)).join('')}
        <!-- 추가 버튼 -->
        <div onclick="addUserBg()" style="cursor:pointer;">
          <div style="aspect-ratio:1/1;border-radius:12px;border:1.5px dashed var(--border);display:flex;align-items:center;justify-content:center;font-size:24px;color:var(--text3);">+</div>
          <div style="font-size:10px;color:var(--text3);text-align:center;margin-top:4px;">추가</div>
        </div>
      </div>
    </div>
    <input type="file" id="bgUploadInput" accept="image/*" style="display:none;" onchange="handleBgUpload(this)">
    <button onclick="applySelectedBg()" style="width:100%;padding:14px;border-radius:14px;border:none;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;font-size:14px;font-weight:800;cursor:pointer;">선택한 배경 적용하기</button>
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
    const name = prompt('배경 이름을 입력하세요:', file.name.replace(/\.[^.]+$/, ''));
    if (!name) return;
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
  };
  reader.readAsDataURL(file);
  input.value = '';
}

function deleteUserBg(id, e) {
  e.stopPropagation();
  if (!confirm('이 배경을 삭제할까요?')) return;
  const userBgs = _loadUserBgs();
  _saveUserBgs(userBgs.filter(b => b.id !== id));
  const favs = _loadFavBgs();
  _saveFavBgs(favs.filter(f => f !== id));
  if (_selectedBgId === id) _selectedBgId = 'cloud_bw';
  _renderBgPanel();
  showToast('삭제됐어요');
}

async function applySelectedBg() {
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
      await _applyBgToPhoto(photo, bg, slot);
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

async function _applyBgToPhoto(photo, bg, slot) {
  // 누끼 이미지가 있으면 사용, 없으면 API 호출
  let personImg;
  if (photo.removedBgUrl) {
    personImg = await _loadImageSrc(photo.removedBgUrl);
  } else {
    // 서버 API로 누끼 처리 (Replicate → Remove.bg 폴백은 서버에서 처리)
    let removedBlob;
    const fd = new FormData();
    fd.append('file', _dataUrlToBlob(photo.dataUrl), 'photo.jpg');
    const res = await fetch(API + '/image/remove-bg', { method: 'POST', headers: authHeader(), body: fd });
    if (res.status === 429) throw new Error('오늘 누끼따기 한도를 다 썼어요');
    if (!res.ok) throw new Error('누끼 처리에 실패했어요. 잠시 후 다시 시도해주세요.');
    removedBlob = await res.blob();
    const tmpUrl = URL.createObjectURL(removedBlob);
    personImg = await _loadImageSrc(tmpUrl);
    URL.revokeObjectURL(tmpUrl);
    const cc = document.createElement('canvas');
    cc.width = personImg.width; cc.height = personImg.height;
    cc.getContext('2d').drawImage(personImg, 0, 0);
    photo.removedBgUrl = cc.toDataURL('image/png');
  }

  // 배경 이미지 로드 또는 그라데이션 캔버스 생성
  let bgCanvas;
  if (bg.imageData) {
    const bgImg = await _loadImageSrc(bg.imageData);
    bgCanvas = document.createElement('canvas');
    bgCanvas.width = 1080; bgCanvas.height = 1080;
    const ctx = bgCanvas.getContext('2d');
    _drawCoverCtx(ctx, bgImg, 0, 0, 1080, 1080);
  } else {
    bgCanvas = document.createElement('canvas');
    bgCanvas.width = 1080; bgCanvas.height = 1080;
    const ctx = bgCanvas.getContext('2d');
    if (bg.gradient) {
      const grad = ctx.createLinearGradient(0, 0, 0, 1080);
      // 파싱 간소화: 단색 폴백
      ctx.fillStyle = bg.color || '#fff';
      ctx.fillRect(0, 0, 1080, 1080);
      // 그라데이션 효과 추가
      const grad2 = ctx.createLinearGradient(0, 0, 0, 1080);
      grad2.addColorStop(0, 'rgba(0,0,0,0.03)');
      grad2.addColorStop(0.5, 'rgba(255,255,255,0.05)');
      grad2.addColorStop(1, 'rgba(0,0,0,0.05)');
      ctx.fillStyle = grad2;
      ctx.fillRect(0, 0, 1080, 1080);
    } else {
      ctx.fillStyle = bg.color || '#fff';
      ctx.fillRect(0, 0, 1080, 1080);
    }
  }

  // 합성
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = 1080; finalCanvas.height = 1080;
  const fCtx = finalCanvas.getContext('2d');
  fCtx.drawImage(bgCanvas, 0, 0);

  // 인물 중앙 배치 (비율 유지)
  const scale = Math.min(1080 / personImg.width, 1080 / personImg.height) * 0.9;
  const pw = personImg.width * scale;
  const ph = personImg.height * scale;
  fCtx.drawImage(personImg, (1080 - pw) / 2, (1080 - ph) / 2, pw, ph);

  photo.editedDataUrl = finalCanvas.toDataURL('image/jpeg', 0.9);
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
  document.getElementById('templatePanel').style.display = 'block';
  _renderTemplatePanel();
}
function closeTemplatePanel() {
  document.getElementById('templatePanel').style.display = 'none';
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
      ? `<img src="${bg.imageData}" style="width:100%;height:100%;object-fit:cover;">`
      : `<div style="width:100%;height:100%;background:${bg.gradient || bg.color};"></div>`;
    return `
      <div style="position:relative;cursor:pointer;" onclick="applyTemplate('${tpl.id}')">
        <div style="aspect-ratio:1/1;border-radius:12px;overflow:hidden;border:1.5px solid var(--border);">${preview}</div>
        <div style="font-size:10px;color:var(--text2);text-align:center;margin-top:4px;font-weight:600;">${tpl.name}</div>
        ${isUser ? `<button onclick="deleteTemplate('${tpl.id}',event)" style="position:absolute;top:2px;right:2px;width:20px;height:20px;border-radius:50%;border:none;background:rgba(220,53,69,0.9);color:#fff;font-size:12px;cursor:pointer;">×</button>` : ''}
      </div>
    `;
  };

  body.innerHTML = `
    ${userTemplates.length ? `<div style="margin-bottom:16px;"><div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:10px;">💾 내 템플릿</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">${userTemplates.map(t => renderCard(t, true)).join('')}</div></div>` : ''}
    <div style="margin-bottom:16px;">
      <div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:10px;">📐 기본 템플릿 (${shopType})</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">${defaultForShop.map(t => renderCard(t, false)).join('')}</div>
    </div>
    <div style="border-top:1px solid var(--border);padding-top:16px;">
      <div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:10px;">현재 설정을 템플릿으로 저장</div>
      <div style="display:flex;gap:8px;">
        <input type="text" id="newTemplateName" placeholder="템플릿 이름" style="flex:1;padding:10px 12px;border-radius:10px;border:1px solid var(--border);font-size:13px;">
        <button onclick="saveCurrentAsTemplate()" style="padding:10px 16px;border-radius:10px;border:none;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;font-size:12px;font-weight:700;cursor:pointer;">저장</button>
      </div>
    </div>
  `;
}

async function applyTemplate(tplId) {
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
    if (bg) try { await _applyBgToPhoto(photo, bg, slot); } catch(_e) {}
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

function deleteTemplate(id, e) {
  e.stopPropagation();
  if (!confirm('이 템플릿을 삭제할까요?')) return;
  _saveUserTemplates(_loadUserTemplates().filter(t => t.id !== id));
  _renderTemplatePanel();
}

// Itdasy Studio - 요소창고 (app-gallery.js에서 분리)

// ═══════════════════════════════════════════════════════
// 요소창고 (로고, 브랜드 이미지)
// ═══════════════════════════════════════════════════════
let _userElements = [];
let _elementEditState = null; // { photoId, elementId, x, y, scale, opacity, imgData }

// 기본 텍스트 요소 생성
function _createDefaultTextElement(text, color = '#f18091') {
  const canvas = document.createElement('canvas');
  canvas.width = 300; canvas.height = 100;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 48px sans-serif';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 150, 50);
  return canvas.toDataURL('image/png');
}

function _loadUserElements() {
  try { return JSON.parse(localStorage.getItem('itdasy_user_elements') || '[]'); } catch(_) { return []; }
}
function _saveUserElements(arr) {
  localStorage.setItem('itdasy_user_elements', JSON.stringify(arr));
}

function openElementPanel() {
  document.getElementById('elementPanel').style.display = 'block';
  _renderElementPanel();
}
function closeElementPanel() {
  document.getElementById('elementPanel').style.display = 'none';
}

function _renderElementPanel() {
  const body = document.getElementById('elementPanelBody');
  if (!body) return;

  _userElements = _loadUserElements();

  const slot = _slots.find(s => s.id === _popupSlotId);
  const selectedPhotos = slot ? slot.photos.filter(p => _popupSelIds.has(p.id) && !p.hidden) : [];

  // 기본 "잇데이" 텍스트 요소 이미지
  const itdasyImg = _createDefaultTextElement('잇데이', '#f18091');

  body.innerHTML = `
    <!-- 기본 텍스트 요소 -->
    <div style="margin-bottom:16px;">
      <div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:10px;">✨ 기본 텍스트</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;">
        <div style="cursor:pointer;" onclick="selectDefaultElement('itdasy')">
          <div style="aspect-ratio:1/1;border-radius:12px;overflow:hidden;border:1.5px solid var(--accent);background:#fff5f7;display:flex;align-items:center;justify-content:center;">
            <img src="${itdasyImg}" style="width:90%;height:auto;object-fit:contain;">
          </div>
          <div style="font-size:9px;color:var(--accent);text-align:center;margin-top:4px;font-weight:700;">잇데이</div>
        </div>
      </div>
    </div>
    <!-- 내 요소 -->
    <div style="margin-bottom:16px;">
      <div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:10px;">📦 내 요소 (로고, 브랜드 이미지)</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;">
        ${_userElements.map(el => `
          <div style="position:relative;cursor:pointer;" onclick="selectElement('${el.id}')">
            <div style="aspect-ratio:1/1;border-radius:12px;overflow:hidden;border:1.5px solid var(--border);background:#f5f5f5;">
              <img src="${el.imageData}" style="width:100%;height:100%;object-fit:contain;">
            </div>
            <div style="font-size:9px;color:var(--text2);text-align:center;margin-top:4px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${el.name}</div>
            <button onclick="deleteElement('${el.id}',event)" style="position:absolute;top:2px;right:2px;width:20px;height:20px;border-radius:50%;border:none;background:rgba(220,53,69,0.9);color:#fff;font-size:12px;cursor:pointer;">×</button>
          </div>
        `).join('')}
        <!-- 추가 버튼 -->
        <div onclick="addUserElement()" style="cursor:pointer;">
          <div style="aspect-ratio:1/1;border-radius:12px;border:1.5px dashed var(--border);display:flex;align-items:center;justify-content:center;font-size:24px;color:var(--text3);">+</div>
          <div style="font-size:9px;color:var(--text3);text-align:center;margin-top:4px;">추가</div>
        </div>
      </div>
    </div>
    <input type="file" id="elementUploadInput" accept="image/*" style="display:none;" onchange="handleElementUpload(this)">
    ${selectedPhotos.length === 0 ? `
      <div style="padding:16px;background:var(--bg2);border-radius:12px;text-align:center;color:var(--text3);font-size:12px;">
        사진을 먼저 선택한 후 요소를 탭하세요
      </div>
    ` : `
      <div style="padding:12px;background:rgba(241,128,145,0.08);border-radius:12px;text-align:center;color:var(--accent2);font-size:12px;font-weight:600;">
        ${selectedPhotos.length}장 선택됨 — 요소를 탭하면 편집 화면으로 이동해요
      </div>
    `}
  `;
}

function addUserElement() {
  document.getElementById('elementUploadInput').click();
}

function handleElementUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const name = prompt('요소 이름 (예: 로고, 워터마크):', file.name.replace(/\.[^.]+$/, ''));
    if (!name) return;
    const elements = _loadUserElements();
    elements.push({
      id: 'el_' + Date.now(),
      name: name.slice(0, 12),
      imageData: e.target.result,
    });
    _saveUserElements(elements);
    _renderElementPanel();
    showToast('요소가 추가됐어요!');
  };
  reader.readAsDataURL(file);
  input.value = '';
}

function deleteElement(id, e) {
  e.stopPropagation();
  if (!confirm('이 요소를 삭제할까요?')) return;
  const elements = _loadUserElements();
  _saveUserElements(elements.filter(el => el.id !== id));
  _renderElementPanel();
}

function selectElement(elementId) {
  const slot = _slots.find(s => s.id === _popupSlotId);
  if (!slot) return;

  const selectedPhotos = slot.photos.filter(p => _popupSelIds.has(p.id) && !p.hidden);
  if (!selectedPhotos.length) {
    showToast('먼저 사진을 선택해주세요');
    return;
  }

  const element = _loadUserElements().find(el => el.id === elementId);
  if (!element) return;

  // 첫 번째 선택 사진으로 편집기 열기
  const photo = selectedPhotos[0];
  _elementEditState = {
    photoId: photo.id,
    allPhotoIds: selectedPhotos.map(p => p.id),
    elementId,
    elementImg: element.imageData,
    x: 50, y: 50, // % 기준 중앙
    scale: 30, // % 기준
    opacity: 100,
  };

  closeElementPanel();
  _openElementEditor(photo);
}

function selectDefaultElement(type) {
  const slot = _slots.find(s => s.id === _popupSlotId);
  if (!slot) return;

  const selectedPhotos = slot.photos.filter(p => _popupSelIds.has(p.id) && !p.hidden);
  if (!selectedPhotos.length) {
    showToast('먼저 사진을 선택해주세요');
    return;
  }

  // 기본 텍스트 요소 생성
  let elementImg;
  if (type === 'itdasy') {
    elementImg = _createDefaultTextElement('잇데이', '#f18091');
  } else {
    return;
  }

  const photo = selectedPhotos[0];
  _elementEditState = {
    photoId: photo.id,
    allPhotoIds: selectedPhotos.map(p => p.id),
    elementId: '_default_' + type,
    elementImg,
    x: 50, y: 85, // 하단 중앙
    scale: 25,
    opacity: 100,
  };

  closeElementPanel();
  _openElementEditor(photo);
}

function _openElementEditor(photo) {
  const editor = document.getElementById('elementEditor');
  const canvas = document.getElementById('elementEditorCanvas');
  editor.style.display = 'block';

  const photoSrc = photo.editedDataUrl || photo.dataUrl;
  canvas.innerHTML = `
    <div id="elemEditWrap" style="position:relative;width:90%;max-width:400px;aspect-ratio:1/1;">
      <img src="${photoSrc}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">
      <img id="elemOverlay" src="${_elementEditState.elementImg}" style="position:absolute;left:${_elementEditState.x}%;top:${_elementEditState.y}%;transform:translate(-50%,-50%);width:${_elementEditState.scale}%;opacity:${_elementEditState.opacity/100};pointer-events:none;">
    </div>
  `;

  document.getElementById('elementOpacity').value = _elementEditState.opacity;
  document.getElementById('elementOpacityVal').textContent = _elementEditState.opacity + '%';

  // 터치/마우스 드래그 설정
  _setupElementDrag();
}

function _setupElementDrag() {
  const wrap = document.getElementById('elemEditWrap');
  const overlay = document.getElementById('elemOverlay');
  if (!wrap || !overlay) return;

  let dragging = false, startX, startY, startElemX, startElemY;
  let pinching = false, startDist, startScale;

  const getPos = (clientX, clientY) => {
    const rect = wrap.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    };
  };

  const updateOverlay = () => {
    overlay.style.left = _elementEditState.x + '%';
    overlay.style.top = _elementEditState.y + '%';
    overlay.style.width = _elementEditState.scale + '%';
    overlay.style.opacity = _elementEditState.opacity / 100;
  };

  // 터치
  wrap.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      pinching = true;
      startDist = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
      startScale = _elementEditState.scale;
    } else if (e.touches.length === 1) {
      dragging = true;
      const pos = getPos(e.touches[0].clientX, e.touches[0].clientY);
      startX = pos.x; startY = pos.y;
      startElemX = _elementEditState.x; startElemY = _elementEditState.y;
    }
  }, { passive: true });

  wrap.addEventListener('touchmove', e => {
    if (pinching && e.touches.length === 2) {
      const dist = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
      _elementEditState.scale = Math.max(10, Math.min(80, startScale * (dist / startDist)));
      updateOverlay();
      e.preventDefault();
    } else if (dragging && e.touches.length === 1) {
      const pos = getPos(e.touches[0].clientX, e.touches[0].clientY);
      _elementEditState.x = Math.max(5, Math.min(95, startElemX + (pos.x - startX)));
      _elementEditState.y = Math.max(5, Math.min(95, startElemY + (pos.y - startY)));
      updateOverlay();
    }
  }, { passive: false });

  wrap.addEventListener('touchend', () => { dragging = false; pinching = false; });

  // 마우스
  wrap.addEventListener('mousedown', e => {
    dragging = true;
    const pos = getPos(e.clientX, e.clientY);
    startX = pos.x; startY = pos.y;
    startElemX = _elementEditState.x; startElemY = _elementEditState.y;
    e.preventDefault();
  });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    const rect = wrap.getBoundingClientRect();
    const pos = { x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 };
    _elementEditState.x = Math.max(5, Math.min(95, startElemX + (pos.x - startX)));
    _elementEditState.y = Math.max(5, Math.min(95, startElemY + (pos.y - startY)));
    updateOverlay();
  });
  window.addEventListener('mouseup', () => { dragging = false; });

  // 마우스 휠 크기 조절
  wrap.addEventListener('wheel', e => {
    e.preventDefault();
    _elementEditState.scale = Math.max(10, Math.min(80, _elementEditState.scale - e.deltaY * 0.05));
    updateOverlay();
  }, { passive: false });
}

function updateElementOpacity(val) {
  _elementEditState.opacity = parseInt(val);
  document.getElementById('elementOpacityVal').textContent = val + '%';
  const overlay = document.getElementById('elemOverlay');
  if (overlay) overlay.style.opacity = val / 100;
}

function cancelElementEdit() {
  document.getElementById('elementEditor').style.display = 'none';
  _elementEditState = null;
}

async function saveElementEdit() {
  if (!_elementEditState) return;

  const slot = _slots.find(s => s.id === _popupSlotId);
  if (!slot) return;

  const progress = document.getElementById('popupProgress');
  document.getElementById('elementEditor').style.display = 'none';

  const photoIds = _elementEditState.allPhotoIds;
  if (progress) { progress.style.display = 'block'; progress.textContent = `요소 적용 중... 0/${photoIds.length}`; }

  for (let i = 0; i < photoIds.length; i++) {
    const photo = slot.photos.find(p => p.id === photoIds[i]);
    if (!photo) continue;
    if (progress) progress.textContent = `요소 적용 중... ${i + 1}/${photoIds.length}`;
    await _applyElementToPhoto(photo, slot);
  }

  if (progress) progress.style.display = 'none';
  _popupSelIds.clear();
  _elementEditState = null;
  _renderPopupPhotoGrid(slot);
  showToast(`${photoIds.length}장에 요소 적용 완료!`);
}

async function _applyElementToPhoto(photo, slot) {
  const state = _elementEditState;
  const canvas = document.createElement('canvas');
  canvas.width = 1080; canvas.height = 1080;
  const ctx = canvas.getContext('2d');

  // 베이스 이미지
  const baseImg = await _loadImageSrc(photo.editedDataUrl || photo.dataUrl);
  _drawCoverCtx(ctx, baseImg, 0, 0, 1080, 1080);

  // 요소 이미지
  const elemImg = await _loadImageSrc(state.elementImg);
  const elemW = 1080 * (state.scale / 100);
  const elemH = elemW * (elemImg.height / elemImg.width);
  const elemX = 1080 * (state.x / 100) - elemW / 2;
  const elemY = 1080 * (state.y / 100) - elemH / 2;

  ctx.globalAlpha = state.opacity / 100;
  ctx.drawImage(elemImg, elemX, elemY, elemW, elemH);
  ctx.globalAlpha = 1;

  photo.editedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
  photo.mode = 'element';
  await saveSlotToDB(slot);
}

// Itdasy Studio - 리뷰 스티커 (app-gallery.js에서 분리)

// ═══════════════════════════════════════════════════════
// 리뷰 스티커 (Gemini Vision 텍스트 추출 + 감성 카드)
// ═══════════════════════════════════════════════════════
let _reviewEditState = null;
let _reviewStickerCache = [];

async function _smartCropScreenshot(dataUrl) {
  const img = await _loadImageSrc(dataUrl);
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const w = img.width, h = img.height;
  const data = ctx.getImageData(0, 0, w, h).data;

  function rowAvg(y) {
    let r = 0, g = 0, b = 0;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      r += data[i]; g += data[i+1]; b += data[i+2];
    }
    return [r / w, g / w, b / w];
  }

  function rowDelta(y1, y2) {
    const a = rowAvg(y1), b = rowAvg(y2);
    return Math.abs(a[0]-b[0]) + Math.abs(a[1]-b[1]) + Math.abs(a[2]-b[2]);
  }

  const DELTA = 30;
  const TOP_LIMIT = Math.min(Math.floor(h * 0.2), 250);
  const BOT_LIMIT = Math.max(Math.floor(h * 0.8), h - 250);

  let topCrop = 0;
  for (let y = 5; y < TOP_LIMIT; y++) {
    if (rowDelta(y - 1, y) > DELTA) { topCrop = y; break; }
  }
  let bottomCrop = h;
  for (let y = h - 5; y > BOT_LIMIT; y--) {
    if (rowDelta(y, y + 1) > DELTA) { bottomCrop = y; break; }
  }

  const cropH = bottomCrop - topCrop;
  if (cropH < h * 0.5) return dataUrl;

  const out = document.createElement('canvas');
  out.width = w; out.height = cropH;
  out.getContext('2d').drawImage(img, 0, topCrop, w, cropH, 0, 0, w, cropH);
  return out.toDataURL('image/png');
}

function openReviewPanel() {
  document.getElementById('reviewPanel').style.display = 'block';
  _renderReviewPanel();
}
function closeReviewPanel() {
  document.getElementById('reviewPanel').style.display = 'none';
}

function _renderReviewPanel() {
  const body = document.getElementById('reviewPanelBody');
  if (!body) return;
  body.innerHTML = `
    <div style="margin-bottom:16px;">
      <div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:10px;">📸 리뷰 스크린샷 업로드</div>
      <div style="text-align:center;padding:20px;border:2px dashed var(--border);border-radius:14px;cursor:pointer;background:var(--bg2);" onclick="document.getElementById('reviewUploadInput').click()">
        <div style="font-size:32px;margin-bottom:8px;">📱</div>
        <div style="font-size:13px;color:var(--text2);font-weight:600;">네이버/카톡 리뷰 캡처 올리기</div>
      </div>
      <input type="file" id="reviewUploadInput" accept="image/*" style="display:none;" onchange="handleReviewUpload(this)">
    </div>
    <div id="reviewExtractResult" style="display:none;margin-bottom:16px;"></div>
    ${_reviewStickerCache.length ? `<div style="margin-bottom:16px;"><div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:10px;">📸 업로드된 리뷰 (탭해서 선택)</div><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;">${_reviewStickerCache.map((s,i) => `<div style="border-radius:12px;overflow:hidden;border:1.5px solid var(--border);"><img src="${s}" style="width:100%;display:block;"><div style="display:flex;gap:4px;padding:6px;"><button onclick="selectReviewSticker(${i})" style="flex:1;padding:6px;border:none;border-radius:8px;background:var(--bg3);font-size:11px;font-weight:700;cursor:pointer;">전체 사용</button><button onclick="selectReviewTextOnly(${i})" style="flex:1;padding:6px;border:none;border-radius:8px;background:var(--accent);color:#fff;font-size:11px;font-weight:700;cursor:pointer;">텍스트만</button></div></div>`).join('')}</div></div>` : ''}
  `;
}

async function handleReviewUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const resultDiv = document.getElementById('reviewExtractResult');
  resultDiv.style.display = 'block';
  resultDiv.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text3);">스크린샷 준비 중... ✨</div>`;
  try {
    const rawUrl = await _fileToDataUrl(file);
    const dataUrl = await _smartCropScreenshot(rawUrl);
    _reviewStickerCache.unshift(dataUrl);
    if (_reviewStickerCache.length > 6) _reviewStickerCache.pop();
    resultDiv.innerHTML = `<div style="background:var(--bg2);border:1.5px solid var(--border);border-radius:14px;padding:14px;text-align:center;">
      <div style="font-size:12px;color:var(--text3);margin-bottom:8px;">업로드된 리뷰 스크린샷</div>
      <img src="${dataUrl}" style="max-width:100%;max-height:200px;border-radius:10px;object-fit:contain;">
    </div>`;
    _renderReviewPanel();
    showToast('스크린샷이 추가됐어요! 아래에서 선택해 사진에 붙이세요 ✨');
  } catch(e) { resultDiv.innerHTML = `<div style="color:#dc3545;">업로드 실패: ${e.message}</div>`; }
  input.value = '';
}

function selectReviewSticker(idx) {
  const slot = _slots.find(s => s.id === _popupSlotId);
  if (!slot) return;
  const selectedPhotos = slot.photos.filter(p => _popupSelIds.has(p.id) && !p.hidden);
  if (!selectedPhotos.length) { showToast('먼저 사진을 선택해주세요'); return; }
  const stickerDataUrl = _reviewStickerCache[idx];
  if (!stickerDataUrl) return;
  _reviewEditState = { photoId: selectedPhotos[0].id, allPhotoIds: selectedPhotos.map(p => p.id), stickerImg: stickerDataUrl, x: 50, y: 75, scale: 40, opacity: 100 };
  closeReviewPanel();
  _openReviewEditor(selectedPhotos[0]);
}

function _openReviewEditor(photo) {
  const editor = document.getElementById('reviewEditor');
  const canvas = document.getElementById('reviewEditorCanvas');
  editor.style.display = 'block';
  canvas.innerHTML = `<div id="reviewEditWrap" style="position:relative;width:90%;max-width:400px;aspect-ratio:1/1;"><img src="${photo.editedDataUrl || photo.dataUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;"><img id="reviewOverlay" src="${_reviewEditState.stickerImg}" style="position:absolute;left:${_reviewEditState.x}%;top:${_reviewEditState.y}%;transform:translate(-50%,-50%);width:${_reviewEditState.scale}%;opacity:${_reviewEditState.opacity/100};pointer-events:none;"></div>`;
  document.getElementById('reviewScale').value = _reviewEditState.scale;
  document.getElementById('reviewScaleVal').textContent = _reviewEditState.scale + '%';
  _setupReviewDrag();
}

function _setupReviewDrag() {
  const wrap = document.getElementById('reviewEditWrap');
  const overlay = document.getElementById('reviewOverlay');
  if (!wrap || !overlay) return;
  let dragging = false, startX, startY, startElemX, startElemY, pinching = false, startDist, startScale;
  const getPos = (x, y) => { const r = wrap.getBoundingClientRect(); return { x: ((x - r.left) / r.width) * 100, y: ((y - r.top) / r.height) * 100 }; };
  const update = () => { overlay.style.left = _reviewEditState.x + '%'; overlay.style.top = _reviewEditState.y + '%'; overlay.style.width = _reviewEditState.scale + '%'; overlay.style.opacity = _reviewEditState.opacity / 100; };
  wrap.addEventListener('touchstart', e => { e.preventDefault(); if (e.touches.length === 2) { pinching = true; startDist = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY); startScale = _reviewEditState.scale; } else { dragging = true; const p = getPos(e.touches[0].clientX, e.touches[0].clientY); startX = p.x; startY = p.y; startElemX = _reviewEditState.x; startElemY = _reviewEditState.y; } }, { passive: false });
  wrap.addEventListener('touchmove', e => { if (pinching && e.touches.length === 2) { const d = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY); _reviewEditState.scale = Math.max(15, Math.min(80, startScale * (d / startDist))); update(); e.preventDefault(); } else if (dragging) { const p = getPos(e.touches[0].clientX, e.touches[0].clientY); _reviewEditState.x = Math.max(10, Math.min(90, startElemX + (p.x - startX))); _reviewEditState.y = Math.max(10, Math.min(90, startElemY + (p.y - startY))); update(); } }, { passive: false });
  wrap.addEventListener('touchend', () => { dragging = false; pinching = false; });
  wrap.addEventListener('mousedown', e => { dragging = true; const p = getPos(e.clientX, e.clientY); startX = p.x; startY = p.y; startElemX = _reviewEditState.x; startElemY = _reviewEditState.y; e.preventDefault(); });
  window.addEventListener('mousemove', e => { if (!dragging) return; const r = wrap.getBoundingClientRect(); const p = { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 }; _reviewEditState.x = Math.max(10, Math.min(90, startElemX + (p.x - startX))); _reviewEditState.y = Math.max(10, Math.min(90, startElemY + (p.y - startY))); update(); });
  window.addEventListener('mouseup', () => { dragging = false; });
  wrap.addEventListener('wheel', e => { e.preventDefault(); _reviewEditState.scale = Math.max(15, Math.min(80, _reviewEditState.scale - e.deltaY * 0.05)); update(); }, { passive: false });
}

function updateReviewScale(val) {
  _reviewEditState.scale = parseInt(val);
  document.getElementById('reviewScaleVal').textContent = val + '%';
  const o = document.getElementById('reviewOverlay');
  if (o) o.style.width = val + '%';
}

function cancelReviewEdit() {
  document.getElementById('reviewEditor').style.display = 'none';
  _reviewEditState = null;
}

async function saveReviewEdit() {
  if (!_reviewEditState) return;
  const slot = _slots.find(s => s.id === _popupSlotId);
  if (!slot) return;
  const progress = document.getElementById('popupProgress');
  document.getElementById('reviewEditor').style.display = 'none';
  const photoIds = _reviewEditState.allPhotoIds;
  if (progress) { progress.style.display = 'block'; progress.textContent = `스티커 적용 중...`; }
  for (const pid of photoIds) {
    const photo = slot.photos.find(p => p.id === pid);
    if (!photo) continue;
    await _applyReviewToPhoto(photo, slot);
  }
  if (progress) progress.style.display = 'none';
  _popupSelIds.clear();
  _reviewEditState = null;
  _renderPopupPhotoGrid(slot);
  showToast(`${photoIds.length}장에 스티커 적용 완료!`);
}

async function _applyReviewToPhoto(photo, slot) {
  const state = _reviewEditState;
  const canvas = document.createElement('canvas');
  canvas.width = 1080; canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  const baseImg = await _loadImageSrc(photo.editedDataUrl || photo.dataUrl);
  _drawCoverCtx(ctx, baseImg, 0, 0, 1080, 1080);
  const stickerImg = await _loadImageSrc(state.stickerImg);
  const stickerW = 1080 * (state.scale / 100);
  const stickerH = stickerW * (stickerImg.height / stickerImg.width);
  ctx.globalAlpha = state.opacity / 100;
  ctx.drawImage(stickerImg, 1080 * (state.x / 100) - stickerW / 2, 1080 * (state.y / 100) - stickerH / 2, stickerW, stickerH);
  ctx.globalAlpha = 1;
  photo.editedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
  photo.mode = 'review_sticker';
  await saveSlotToDB(slot);
}


async function extractReviewTextRegion(dataUrl) {
  const blob = _dataUrlToBlob(dataUrl);
  const fd = new FormData();
  fd.append('file', blob, 'review.png');
  const res = await fetch(API + '/image/extract-review-region', {
    method: 'POST', headers: authHeader(), body: fd
  });
  if (res.status === 429) { showToast('오늘 텍스트 추출 한도를 다 썼어요'); throw new Error('한도초과'); }
  if (!res.ok) throw new Error('텍스트 영역 감지 실패');
  const region = await res.json();

  const img = await _loadImageSrc(dataUrl);
  const sx = Math.round(img.width * (region.left || 0));
  const sy = Math.round(img.height * (region.top || 0));
  const sw = Math.round(img.width * ((region.right || 1) - (region.left || 0)));
  const sh = Math.round(img.height * ((region.bottom || 1) - (region.top || 0)));
  if (sw < 10 || sh < 10) return dataUrl;

  const canvas = document.createElement('canvas');
  canvas.width = sw; canvas.height = sh;
  canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas.toDataURL('image/png');
}

async function selectReviewTextOnly(idx) {
  const slot = _slots.find(s => s.id === _popupSlotId);
  if (!slot) return;
  const selectedPhotos = slot.photos.filter(p => _popupSelIds.has(p.id) && !p.hidden);
  if (!selectedPhotos.length) { showToast('먼저 사진을 선택해주세요'); return; }
  showToast('텍스트 영역 찾는 중...');
  try {
    const textOnly = await extractReviewTextRegion(_reviewStickerCache[idx]);
    _reviewEditState = {
      photoId: selectedPhotos[0].id,
      allPhotoIds: selectedPhotos.map(p => p.id),
      stickerImg: textOnly,
      x: 50, y: 75, scale: 40, opacity: 100
    };
    closeReviewPanel();
    _openReviewEditor(selectedPhotos[0]);
  } catch(e) {
    showToast('텍스트 추출 실패. 전체 캡처로 붙일게요');
    selectReviewSticker(idx);
  }
}
// Itdasy Studio - 글쓰기 탭 (app-gallery.js에서 분리)

// ═══════════════════════════════════════════════════════
// 피크 캐러셀 (글쓰기 슬롯 사진 / 미리보기 공용)
// ═══════════════════════════════════════════════════════
function _buildPeekCarousel(photos, id) {
  if (!photos.length) return '<div style="color:var(--text3);text-align:center;padding:16px;font-size:12px;">사진 없음</div>';
  const total = photos.length;
  if (total === 1) {
    return `<div style="width:70%;margin:0 auto;aspect-ratio:1/1;border-radius:14px;overflow:hidden;">
      <img src="${photos[0].editedDataUrl || photos[0].dataUrl}" style="width:100%;height:100%;object-fit:cover;">
    </div>`;
  }
  return `
    <div id="${id}" style="overflow:hidden;position:relative;user-select:none;touch-action:pan-y;">
      <div id="${id}_t" style="display:flex;transform:translateX(15%);transition:transform .35s cubic-bezier(.25,.46,.45,.94);">
        ${photos.map((p, i) => `
          <div style="flex-shrink:0;width:70%;padding:0 2%;box-sizing:border-box;">
            <div class="${id}_s" style="aspect-ratio:1/1;border-radius:14px;overflow:hidden;transition:transform .35s,filter .35s;transform:scale(${i===0?1:.85});filter:${i===0?'none':'brightness(.6)'};">
              <img src="${p.editedDataUrl || p.dataUrl}" style="width:100%;height:100%;object-fit:cover;display:block;">
            </div>
          </div>`).join('')}
      </div>
      <div style="display:flex;justify-content:center;gap:5px;padding:8px 0 0;" id="${id}_dots">
        ${photos.map((_,i) => `<div id="${id}_d${i}" style="height:6px;border-radius:3px;background:${i?'rgba(0,0,0,0.15)':'var(--accent)'};width:${i?'6':'18'}px;transition:all .3s;"></div>`).join('')}
      </div>
    </div>
  `;
}

function _initPeekCarousel(id, total) {
  const track = document.getElementById(id + '_t');
  if (!track || total < 2) return;
  let cur = 0;
  let offsetPx = 0; // 실시간 드래그 오프셋
  const container = document.getElementById(id);
  const containerW = container?.offsetWidth || 300;
  const slideW = containerW * 0.7; // 70%

  function go(n, animate = true) {
    cur = Math.max(0, Math.min(total - 1, n));
    offsetPx = -cur * slideW;
    track.style.transition = animate ? 'transform .35s cubic-bezier(.25,.46,.45,.94)' : 'none';
    track.style.transform = `translateX(calc(15% + ${offsetPx}px))`;
    track.querySelectorAll('.' + id + '_s').forEach((el, i) => {
      el.style.transform = i === cur ? 'scale(1)' : 'scale(.85)';
      el.style.filter = i === cur ? 'none' : 'brightness(.6)';
    });
    for (let i = 0; i < total; i++) {
      const d = document.getElementById(id + '_d' + i);
      if (d) { d.style.width = i === cur ? '18px' : '6px'; d.style.background = i === cur ? 'var(--accent)' : 'rgba(0,0,0,0.15)'; }
    }
  }

  // 모멘텀 계산용 변수
  let sx = 0, st = 0, dragging = false, lastX = 0, velocity = 0, lastTime = 0;

  track.addEventListener('touchstart', e => {
    sx = e.touches[0].clientX;
    lastX = sx;
    st = Date.now();
    lastTime = st;
    velocity = 0;
    dragging = true;
    track.style.transition = 'none';
  }, { passive: true });

  track.addEventListener('touchmove', e => {
    if (!dragging) return;
    const x = e.touches[0].clientX;
    const dx = x - sx;
    const now = Date.now();
    const dt = now - lastTime;
    if (dt > 0) velocity = (x - lastX) / dt; // px/ms
    lastX = x;
    lastTime = now;
    // 실시간 드래그 반영
    track.style.transform = `translateX(calc(15% + ${offsetPx + dx}px))`;
    if (Math.abs(dx) > 10) e.preventDefault();
  }, { passive: false });

  track.addEventListener('touchend', e => {
    if (!dragging) return;
    dragging = false;
    const dx = e.changedTouches[0].clientX - sx;
    // 모멘텀: 속도 기반으로 몇 슬라이드 이동할지 결정
    const momentum = velocity * 150; // 150ms 관성
    const totalMove = dx + momentum;
    const slidesToMove = Math.round(-totalMove / slideW);
    go(cur + slidesToMove);
  }, { passive: true });

  // 마우스 드래그
  let msx = 0, mst = 0, md = false, mLastX = 0, mVelocity = 0, mLastTime = 0;
  track.addEventListener('mousedown', e => {
    msx = e.clientX;
    mLastX = msx;
    mst = Date.now();
    mLastTime = mst;
    mVelocity = 0;
    md = true;
    track.style.transition = 'none';
    e.preventDefault();
  });
  window.addEventListener('mousemove', e => {
    if (!md) return;
    const x = e.clientX;
    const dx = x - msx;
    const now = Date.now();
    const dt = now - mLastTime;
    if (dt > 0) mVelocity = (x - mLastX) / dt;
    mLastX = x;
    mLastTime = now;
    track.style.transform = `translateX(calc(15% + ${offsetPx + dx}px))`;
  });
  window.addEventListener('mouseup', e => {
    if (!md) return;
    md = false;
    const dx = e.clientX - msx;
    const momentum = mVelocity * 150;
    const totalMove = dx + momentum;
    const slidesToMove = Math.round(-totalMove / slideW);
    go(cur + slidesToMove);
  });
}

// ═══════════════════════════════════════════════════════
// 글쓰기 탭 — 슬롯 픽커
// ═══════════════════════════════════════════════════════
function initCaptionSlotPicker() {
  const doneSlots = _slots.filter(s => s.status === 'done' && s.photos.length > 0);
  const container = document.getElementById('captionSlotPicker');
  if (!container) return;

  // 키워드 태그 렌더링
  if (typeof renderCaptionKeywordTags === 'function') renderCaptionKeywordTags();

  if (!doneSlots.length) { container.style.display = 'none'; return; }
  container.style.display = 'block';
  container.innerHTML = `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:12px 14px;">
      <div style="font-size:12px;font-weight:800;color:var(--text);margin-bottom:10px;">작업실 슬롯 <span style="font-size:10px;color:var(--text3);font-weight:400;">— 탭하면 사진이 연결돼요</span></div>
      <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;" id="captionSlotCards">
        ${doneSlots.map(slot => {
          const thumb = slot.photos.filter(p => !p.hidden)[0];
          if (!thumb) return '';
          return `
            <div id="csPick_${slot.id}" onclick="loadSlotForCaption('${slot.id}')" style="flex-shrink:0;width:64px;cursor:pointer;text-align:center;">
              <img src="${thumb.editedDataUrl || thumb.dataUrl}" style="width:64px;height:64px;object-fit:cover;border-radius:10px;border:2px solid transparent;transition:border-color 0.2s;" id="csThumb_${slot.id}">
              <div style="font-size:9px;color:var(--text2);margin-top:3px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${slot.label}</div>
            </div>
          `;
        }).join('')}
      </div>
      <div id="captionSlotPhotoStrip" style="display:none;margin-top:10px;"></div>
    </div>
  `;
}

async function loadSlotForCaption(slotId) {
  const slot = _slots.find(s => s.id === slotId);
  if (!slot) return;
  _captionSlotId = slotId;

  // 슬롯 카드 선택 표시
  document.querySelectorAll('[id^="csThumb_"]').forEach(el => {
    el.style.borderColor = 'transparent';
  });
  const pickedThumb = document.getElementById(`csThumb_${slotId}`);
  if (pickedThumb) pickedThumb.style.borderColor = 'var(--accent)';

  // 보이는 사진만 (hidden 제외)
  const visPhotos = slot.photos.filter(p => !p.hidden);

  // 사진 피크 캐러셀 표시
  const strip = document.getElementById('captionSlotPhotoStrip');
  if (strip && visPhotos.length > 0) {
    strip.style.display = 'block';
    strip.innerHTML = _buildPeekCarousel(visPhotos, 'cs_carousel');
    setTimeout(() => _initPeekCarousel('cs_carousel', visPhotos.length), 50);
  } else if (strip) {
    strip.style.display = 'none';
  }

  showToast(`${slot.label} 연결됐어요 ✅`);

  // 단일 작업 카드의 사진 영역 갱신 (app-caption.js)
  if (typeof _captionPhotosReordered !== 'undefined') _captionPhotosReordered = null;
  if (typeof _renderCaptionPhotoRow === 'function') _renderCaptionPhotoRow();
}


// Itdasy Studio - 마무리 탭 (app-gallery.js에서 분리)

// ═══════════════════════════════════════════════════════
// 마무리 탭
// ═══════════════════════════════════════════════════════
async function initFinishTab() {
  const root = document.getElementById('finishRoot');
  if (!root) return;
  try { _slots = await loadSlotsFromDB(); } catch(_e) { _slots = []; }
  let galleryItems = [];
  try { galleryItems = await loadGalleryItems(); } catch(_e) {}
  _renderFinishTab(root, galleryItems);
}

function _renderFinishTab(root, galleryItems = []) {
  const doneSlots   = _slots.filter(s => s.status === 'done' && s.photos.length > 0 && !s.instagramPublished);
  const incompleteN = _slots.filter(s => !s.instagramPublished && (s.status !== 'done' || !s.photos.length)).length;

  if (!_slots.length) {
    root.innerHTML = `
      <div class="sec-title" style="margin-bottom:4px;">마무리 🎀</div>
      <div style="text-align:center;padding:60px 20px;">
        <div style="font-size:40px;margin-bottom:12px;">📭</div>
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:6px;">작업실에서 슬롯을 먼저 만들어보세요</div>
        <button onclick="showTab('workshop',document.querySelectorAll('.nav-btn')[1]); initWorkshopTab();" style="margin-top:16px;padding:10px 20px;border-radius:12px;border:1.5px solid var(--accent2);background:transparent;color:var(--accent2);font-weight:700;cursor:pointer;font-size:12px;">작업실로 이동 →</button>
      </div>
    `;
    return;
  }

  const incompleteHtml = incompleteN > 0
    ? `<div style="font-size:11px;color:var(--text3);margin-bottom:14px;">미완료 ${incompleteN}개 있어요 · <button onclick="showTab('tab-ai-suggest',document.querySelectorAll('.nav-btn')[0]); initAiRecommendTab();" style="background:transparent;border:none;color:var(--accent2);font-size:11px;font-weight:700;cursor:pointer;padding:0;">AI추천에서 확인 →</button></div>`
    : '';

  if (!doneSlots.length) {
    root.innerHTML = `
      <div class="sec-title" style="margin-bottom:4px;">마무리 🎀</div>
      ${incompleteHtml}
      <div style="text-align:center;padding:40px 20px;">
        <div style="font-size:32px;margin-bottom:10px;">⏳</div>
        <div style="font-size:13px;font-weight:700;color:var(--text);">완료된 슬롯이 없어요</div>
        <div style="font-size:11px;color:var(--text3);margin-top:4px;">작업실에서 슬롯을 완료(✅)하면 여기 표시돼요</div>
      </div>
    `;
    return;
  }

  const slotsHtml = doneSlots.map(slot => {
    const visPhotos = slot.photos.filter(p => !p.hidden);
    const thumbs = (visPhotos.length ? visPhotos : slot.photos).slice(0, 2).map(p =>
      `<img src="${p.editedDataUrl || p.dataUrl}" style="width:56px;height:56px;object-fit:cover;border-radius:8px;">`
    ).join('');
    const cap = slot.caption
      ? `<div style="font-size:11px;color:var(--text3);margin-top:4px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${slot.caption.slice(0, 60)}${slot.caption.length > 60 ? '…' : ''}</div>`
      : '';
    const isDeferred = !!slot.deferredAt;
    return `
      <div data-finish-slot="${slot.id}" style="background:#fff;border:1.5px solid ${isDeferred ? 'rgba(255,193,7,0.4)' : 'rgba(76,175,80,0.3)'};border-radius:16px;padding:14px;margin-bottom:10px;">
        <!-- 슬롯 정보 -->
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px;">
          <div style="display:flex;gap:4px;">${thumbs}</div>
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              <div style="font-size:13px;font-weight:800;color:var(--text);">${slot.label} ✅</div>
              ${slot.caption ? '<span style="font-size:9px;background:rgba(76,175,80,0.15);color:#388e3c;border-radius:4px;padding:1px 5px;font-weight:700;">캡션✓</span>' : ''}
              ${isDeferred ? '<span style="font-size:9px;background:rgba(255,193,7,0.15);color:#f57c00;border-radius:4px;padding:1px 5px;font-weight:700;">나중에</span>' : ''}
            </div>
            <div style="font-size:11px;color:var(--text3);">${visPhotos.length}장</div>
            ${cap}
          </div>
          <button onclick="openSlotPopup('${slot.id}')" style="flex-shrink:0;padding:6px 12px;border-radius:10px;border:1px solid var(--border);background:transparent;font-size:11px;color:var(--text2);cursor:pointer;font-weight:600;">편집</button>
        </div>
        <!-- 5가지 선택지 -->
        <div style="display:flex;flex-direction:column;gap:6px;">
          <button onclick="publishSlotToInstagram('${slot.id}')" style="width:100%;padding:12px;border-radius:12px;border:none;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;font-size:13px;font-weight:800;cursor:pointer;">📸 인스타에 올리기</button>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
            <button onclick="_saveSlotToGallery('${slot.id}')" style="padding:10px;border-radius:10px;border:1.5px solid rgba(241,128,145,0.3);background:transparent;color:var(--accent);font-size:11px;font-weight:700;cursor:pointer;">📁 갤러리에만 보관</button>
            <button onclick="downloadSlotPhotos('${slot.id}')" style="padding:10px;border-radius:10px;border:1.5px solid var(--border);background:transparent;color:var(--text2);font-size:11px;font-weight:700;cursor:pointer;">📥 내 폰에 저장</button>
          </div>
          <div style="display:flex;gap:6px;">
            <button onclick="_deferSlot('${slot.id}')" style="flex:1;padding:8px;border-radius:10px;border:1.5px solid rgba(255,193,7,0.5);background:transparent;color:#f57c00;font-size:11px;font-weight:700;cursor:pointer;">🕐 나중에</button>
            <button onclick="deleteSlotFinish('${slot.id}')" style="padding:8px 14px;border-radius:10px;border:1.5px solid rgba(220,53,69,0.3);background:transparent;color:#dc3545;font-size:11px;cursor:pointer;font-weight:600;">삭제</button>
            <button onclick="showToast('슬롯이 유지돼요 🌸')" style="padding:8px 14px;border-radius:10px;border:1.5px solid var(--border);background:transparent;color:var(--text3);font-size:11px;cursor:pointer;">취소</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // 갤러리 섹션
  const galleryHtml = galleryItems.length ? (() => {
    // 날짜별 그룹
    const byDate = {};
    galleryItems.forEach(item => {
      const d = item.date || '날짜 없음';
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push(item);
    });
    const dateHtml = Object.entries(byDate).map(([date, items]) => `
      <div style="margin-bottom:14px;">
        <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:8px;">${date}</div>
        <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch;">
          ${items.map(item => {
            const thumb = item.photos?.[0];
            return thumb ? `
              <div style="flex-shrink:0;width:80px;cursor:pointer;" onclick="_galleryItemDetail('${item.id}')">
                <div style="position:relative;width:80px;height:80px;border-radius:10px;overflow:hidden;">
                  <img src="${thumb.dataUrl}" style="width:100%;height:100%;object-fit:cover;">
                  ${item.photos.length > 1 ? `<div style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.55);border-radius:4px;padding:1px 4px;font-size:9px;color:#fff;">+${item.photos.length}</div>` : ''}
                </div>
                <div style="font-size:9px;color:var(--text2);margin-top:3px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.label}</div>
              </div>
            ` : '';
          }).join('')}
        </div>
      </div>
    `).join('');
    return `
      <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border);">
        <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:12px;">갤러리 📁 <span style="font-size:11px;color:var(--text3);font-weight:400;">${galleryItems.length}개</span></div>
        ${dateHtml}
      </div>`;
  })() : '';

  root.innerHTML = `
    <div class="sec-title" style="margin-bottom:4px;">마무리 🎀</div>
    ${incompleteHtml}
    <div class="sec-sub" style="margin-bottom:16px;">완료 ${doneSlots.length}개 · 원하는 방법으로 마무리하세요</div>
    ${slotsHtml}
    ${galleryHtml}
  `;
}

function _galleryItemDetail(galleryId) {
  loadGalleryItems().then(items => {
    const item = items.find(i => i.id === galleryId);
    if (!item) return;
    const photos = item.photos || [];
    let pop = document.getElementById('_galleryDetailPop');
    if (!pop) {
      pop = document.createElement('div');
      pop.id = '_galleryDetailPop';
      pop.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,0.7);display:flex;align-items:flex-end;justify-content:center;';
      pop.onclick = e => { if (e.target === pop) pop.style.display = 'none'; };
      document.body.appendChild(pop);
    }
    const escapedCaption = (item.caption || '').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    pop.innerHTML = `
      <div style="width:100%;max-width:480px;background:#fff;border-radius:20px 20px 0 0;max-height:90vh;overflow-y:auto;padding:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <div style="font-size:14px;font-weight:800;">${item.label} <span style="font-size:11px;color:var(--text3);font-weight:400;">${item.date}</span></div>
          <button onclick="document.getElementById('_galleryDetailPop').style.display='none'" style="background:transparent;border:none;font-size:20px;color:#aaa;cursor:pointer;">×</button>
        </div>
        ${_buildPeekCarousel(photos, 'gd_carousel')}
        ${escapedCaption ? `<div style="margin-top:12px;font-size:13px;color:#333;white-space:pre-wrap;line-height:1.6;">${escapedCaption}</div>` : ''}
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:14px;">
          <button onclick="_republishGalleryItem('${item.id}')" style="width:100%;padding:12px;border-radius:12px;border:none;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;font-size:13px;font-weight:800;cursor:pointer;">📸 다시 올리기</button>
          <div style="display:flex;gap:8px;">
            <button onclick="downloadGalleryItem('${item.id}')" style="flex:1;padding:10px;border-radius:12px;border:1.5px solid var(--border);background:transparent;font-size:12px;color:var(--text2);cursor:pointer;font-weight:600;">📥 저장</button>
            <button onclick="deleteGalleryItem('${item.id}').then(()=>{document.getElementById('_galleryDetailPop').style.display='none';initFinishTab();})" style="flex:1;padding:10px;border-radius:12px;border:1.5px solid rgba(220,53,69,0.3);background:transparent;font-size:12px;color:#dc3545;cursor:pointer;">삭제</button>
          </div>
        </div>
      </div>
    `;
    pop.style.display = 'flex';
    setTimeout(() => _initPeekCarousel('gd_carousel', photos.length), 80);
  });
}

async function _republishGalleryItem(galleryId) {
  const items = await loadGalleryItems();
  const item = items.find(i => i.id === galleryId);
  if (!item?.photos?.length) { showToast('사진이 없어요'); return; }
  const photo = item.photos[0];
  const fullCaption = (item.caption || '') + (item.hashtags ? '\n\n' + item.hashtags : '');
  const pop = document.getElementById('_galleryDetailPop');
  if (pop) pop.style.display = 'none';
  try {
    const blob = _dataUrlToBlob(photo.editedDataUrl || photo.dataUrl);
    const fd = new FormData();
    fd.append('image', blob, 'gallery_photo.jpg');
    fd.append('photo_type', 'after');
    fd.append('main_tag', item.label || '');
    const upRes = await fetch(API + '/portfolio', { method: 'POST', headers: authHeader(), body: fd });
    if (!upRes.ok) { showToast('업로드 실패'); return; }
    const upData = await upRes.json();
    const imgUrl = upData.image_url?.startsWith('http') ? upData.image_url : API + (upData.image_url || '');
    if (typeof doInstagramPublish === 'function') {
      const success = await doInstagramPublish(imgUrl, fullCaption);
      if (success) showToast('다시 업로드 완료! ✨');
    }
  } catch(e) { showToast('오류: ' + e.message); }
}

async function downloadGalleryItem(galleryId) {
  const items = await loadGalleryItems();
  const item = items.find(i => i.id === galleryId);
  if (!item?.photos?.length) { showToast('사진이 없어요'); return; }
  item.photos.forEach((p, i) => {
    const a = document.createElement('a');
    a.download = `itdasy_${item.label || 'gallery'}_${i + 1}_${Date.now()}.jpg`;
    a.href = p.editedDataUrl || p.dataUrl;
    a.click();
  });
  showToast('사진 저장 중... 📥');
}

async function _saveSlotToGallery(slotId) {
  const slot = _slots.find(s => s.id === slotId);
  if (!slot) return;
  try {
    await saveToGallery(slot);
    showToast('갤러리에 보관됐어요 📁');
    initFinishTab();
    // AI 추천 탭이 열려있으면 갱신
    const aiTab = document.getElementById('tab-ai-suggest');
    if (aiTab && aiTab.classList.contains('active') && typeof initAiRecommendTab === 'function') {
      initAiRecommendTab();
    }
  } catch(e) { showToast('저장 실패: ' + e.message); }
}

async function publishSlotToInstagram(slotId) {
  const slot = _slots.find(s => s.id === slotId);
  if (!slot?.photos.length) { showToast('사진이 없어요'); return; }
  const visPhotos = slot.photos.filter(p => !p.hidden);
  const photo = visPhotos[0] || slot.photos[0];
  const fullCaption = (slot.caption || '') + (slot.hashtags ? '\n\n' + slot.hashtags : '');
  try {
    const blob = _dataUrlToBlob(photo.editedDataUrl || photo.dataUrl);
    const fd   = new FormData();
    fd.append('image', blob, 'slot_photo.jpg');
    fd.append('photo_type', 'after');
    fd.append('main_tag', slot.label);
    fd.append('tags', '');
    const upRes  = await fetch(API + '/portfolio', { method: 'POST', headers: authHeader(), body: fd });
    if (!upRes.ok) { showToast('업로드 실패'); return; }
    const upData = await upRes.json();
    const imgUrl = upData.image_url?.startsWith('http') ? upData.image_url : API + (upData.image_url || '');
    if (typeof doInstagramPublish === 'function') {
      const success = await doInstagramPublish(imgUrl, fullCaption);
      if (success) {
        slot.instagramPublished = true;
        slot.deferredAt = null;
        await saveSlotToDB(slot);
        // 갤러리 자동 저장
        try { await saveToGallery(slot); } catch(_e) {}
        initFinishTab();
      }
    }
  } catch(e) { showToast('오류: ' + e.message); }
}

async function _deferSlot(slotId) {
  const slot = _slots.find(s => s.id === slotId);
  if (!slot) return;
  slot.deferredAt = Date.now();
  try { await saveSlotToDB(slot); } catch(_e) {}
  showToast('AI 추천 탭에서 다시 볼 수 있어요 🕐');
  initFinishTab();
}

function downloadSlotPhotos(slotId) {
  const slot = _slots.find(s => s.id === slotId);
  if (!slot?.photos.length) { showToast('사진이 없어요'); return; }
  slot.photos.forEach((p, i) => {
    const a   = document.createElement('a');
    a.download = `itdasy_${slot.label}_${i + 1}_${Date.now()}.jpg`;
    a.href    = p.editedDataUrl || p.dataUrl;
    a.click();
  });
}

async function deleteSlotFinish(slotId) {
  if (!confirm('슬롯을 삭제할까요?')) return;
  _slots = _slots.filter(s => s.id !== slotId);
  try { await deleteSlotFromDB(slotId); } catch(_e) {}
  await _renumberSlots();
  initFinishTab();
}
// Itdasy Studio - C3-B 페르소나 서명블록 설정
// 파일: app-persona.js  (신규)
// 의존: app-core.js 의 API, authHeader(), handle401()

// ── 세션 내 포스트 카운트 (ingest 응답 total_after 로만 업데이트)
// 주의: count API 없음 → 탭 재진입해도 값 유지되나 새 페이지 로드 시 0으로 초기화
let _pPostCount = 0;
let _detectCandidates = [];
let _pIdentityLoaded = null;
let _pNicknames = [];

// ── 기본정보 상수
const SUPPORTED_CATEGORIES = {"붙임머리":"extension","네일":"nail"};
const AGE_LABELS = {"10s":"10대","20s_early":"20대 초","20s_late":"20대 후","30s":"30대","40s_plus":"40대+"};
const GENDER_LABELS = {"female":"여성","male":"남성","both":"전체"};
const TONE_OPTIONS = [
  {key:"casual_friendly", label:"친근반말",  example:"오늘도 예쁘게 해줬어요~"},
  {key:"polite_formal",   label:"공손존댓",  example:"오늘도 예쁘게 해드렸습니다."},
  {key:"lively_emoji",    label:"활기이모지", example:"완성 🤍✨ 너무 예뻐요!!"},
  {key:"calm_premium",    label:"차분고급",  example:"차분한 무드로 마무리했습니다."},
  {key:"mixed",           label:"혼합",      example:"상황별로 다르게"},
];

// ── 공용 fetch 헬퍼 (app-caption.js 에서도 참조) ────────────────
async function _personaFetch(method, path, body) {
  const headers = { ...authHeader() };
  let bodyStr;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    bodyStr = JSON.stringify(body);
  }
  const res = await fetch(API + path, { method, headers, body: bodyStr });
  if (res.status === 401) { handle401(); throw new Error('401'); }
  return res;
}

// ── XSS 방지 ─────────────────────────────────────────────────────
function _esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── 진입점 (nav 버튼 onclick) ─────────────────────────────────────
async function initPersonaTab() {
  _renderShell();
  await Promise.all([
    _loadIdentity(),
    _loadConsent(),
    _loadInstaStatus(),
    _loadSignatureList(),
  ]);
  _syncDetectBtn();
}

// ─────────────────────────────────────────────────────────────────
// 셸 렌더
// ─────────────────────────────────────────────────────────────────
function _renderShell() {
  const root = document.getElementById('personaRoot');
  if (!root) return;
  root.innerHTML = `
<div style="padding:16px 16px 100px;">
  <div class="sec-title">페르소나 설정</div>
  <div class="sec-sub">포스트를 수집하고 서명블록을 관리합니다</div>

  ${_renderConsentBlock()}

  <!-- ── 블록 A: 포스트 수집 ──────────────────────── -->
  <div style="margin-bottom:16px; background:#fff; border-radius:16px; border:1px solid var(--border); padding:16px;">
    <div style="font-size:13px; font-weight:800; color:var(--text); margin-bottom:10px;">A. 포스트 수집</div>

    <div id="pA-status" style="font-size:12px; color:var(--text3); margin-bottom:10px;">확인 중…</div>
    <div id="pA-actions"></div>
    <div id="pA-ingestMsg" style="margin-top:8px; font-size:12px; color:var(--text3);"></div>

    <div style="margin-top:12px;">
      <button onclick="_toggleManual()" style="font-size:12px; color:var(--accent2); background:transparent; border:none; cursor:pointer; padding:0; text-decoration:underline;">수동 붙여넣기 ▾</button>
      <div id="pA-manual" style="display:none; margin-top:10px;">
        <textarea id="pA-manualText" rows="5"
          placeholder="게시글을 붙여넣으세요.&#10;빈 줄 2개(Enter 3번)로 게시글을 구분합니다."
          style="width:100%; box-sizing:border-box; font-size:12px; border:1px solid var(--border); border-radius:10px; padding:10px; resize:vertical;"></textarea>
        <div style="display:flex; align-items:center; gap:8px; margin-top:8px;">
          <button id="pA-manualBtn" onclick="_ingestManual()" style="padding:9px 20px; border-radius:10px; border:none; background:var(--accent); color:#fff; font-size:12px; font-weight:700; cursor:pointer;">추가</button>
          <span id="pA-manualMsg" style="font-size:12px; color:var(--text3);"></span>
        </div>
      </div>
    </div>
  </div>

  <!-- ── 블록 B: 자동 감지 ────────────────────────── -->
  <div style="margin-bottom:16px; background:#fff; border-radius:16px; border:1px solid var(--border); padding:16px;">
    <div style="font-size:13px; font-weight:800; color:var(--text); margin-bottom:8px;">B. 서명블록 자동 감지</div>
    <div id="pB-countMsg" style="font-size:12px; color:var(--text3); margin-bottom:10px;">—</div>
    <div style="display:flex; align-items:center; gap:10px;">
      <button id="pB-detectBtn" onclick="_runDetect()" disabled
        style="padding:10px 20px; border-radius:10px; border:none; background:var(--accent); color:#fff; font-size:12px; font-weight:700; cursor:pointer; opacity:0.4;">자동 감지</button>
      <span id="pB-detectHint" style="font-size:11px; color:var(--text3);">10건 이상 필요</span>
    </div>
    <div id="pB-detectResult" style="margin-top:12px;"></div>
  </div>

  <!-- ── 블록 C: 목록 ──────────────────────────────── -->
  <div style="background:#fff; border-radius:16px; border:1px solid var(--border); padding:16px;">
    <div style="font-size:13px; font-weight:800; color:var(--text); margin-bottom:12px;">C. 내 서명블록 목록</div>
    <div id="pC-list"><div style="font-size:12px; color:var(--text3);">불러오는 중…</div></div>

    <!-- 직접 추가 폼 -->
    <div style="margin-top:16px; padding-top:16px; border-top:1px solid var(--border);">
      <div style="font-size:12px; font-weight:700; color:var(--text3); margin-bottom:10px;">+ 직접 추가</div>
      <input id="pC-label" type="text" placeholder="이름 (예: 기본 서명블록)"
        style="width:100%; box-sizing:border-box; font-size:12px; border:1px solid var(--border); border-radius:8px; padding:8px 10px; margin-bottom:8px;">
      <textarea id="pC-content" rows="4" placeholder="서명블록 내용"
        style="width:100%; box-sizing:border-box; font-size:12px; border:1px solid var(--border); border-radius:8px; padding:8px 10px; resize:vertical; margin-bottom:8px;"></textarea>
      <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px; flex-wrap:wrap;">
        <select id="pC-position" style="font-size:12px; border:1px solid var(--border); border-radius:8px; padding:7px 10px; background:#fff;">
          <option value="bottom">하단</option>
          <option value="top">상단</option>
        </select>
        <label style="font-size:12px; color:var(--text2); display:flex; align-items:center; gap:4px; cursor:pointer;">
          <input type="checkbox" id="pC-isDefault"> 기본값으로 설정
        </label>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <button id="pC-addBtn" onclick="_addManualSig()" style="padding:10px 20px; border-radius:10px; border:none; background:var(--accent); color:#fff; font-size:12px; font-weight:700; cursor:pointer;">추가</button>
        <span id="pC-addMsg" style="font-size:12px; color:var(--text3);"></span>
      </div>
    </div>
  </div>

  <!-- 말투 재분석 링크 -->
  <div style="text-align:center;padding:8px 0 4px;">
    <button onclick="_refreshFingerprint()" style="background:none;border:none;font-size:12px;color:var(--text3);cursor:pointer;text-decoration:underline;padding:4px 8px;">말투 다시 분석</button>
  </div>
</div>
  `;
}

// ─────────────────────────────────────────────────────────────────
// 말투 재분석 (POST /persona/fingerprint/refresh)
// ─────────────────────────────────────────────────────────────────
async function _refreshFingerprint() {
  showToast('분석 중...');
  try {
    const res = await _personaFetch('POST', '/persona/fingerprint/refresh');
    if (!res.ok) { showToast('분석 실패: ' + res.status); return; }
    const d = await res.json();
    const n = d.source_post_count ?? d.post_count ?? '';
    showToast('분석 완료' + (n ? ` (${n}개 포스트 반영)` : ''));
  } catch(e) {
    if (e.message !== '401') showToast('분석 오류: ' + e.message);
  }
}

// ─────────────────────────────────────────────────────────────────
// 블록 A — 인스타 연동 상태 + 수집
// ─────────────────────────────────────────────────────────────────
async function _loadInstaStatus() {
  const statusEl  = document.getElementById('pA-status');
  const actionsEl = document.getElementById('pA-actions');
  if (!statusEl || !actionsEl) return;
  try {
    const res  = await _personaFetch('GET', '/instagram/status');
    if (!res.ok) throw new Error('status ' + res.status);
    const data = await res.json();

    if (data.connected) {
      statusEl.textContent = `✅ 인스타 연동됨: @${_esc(data.handle || '')}`;
      actionsEl.innerHTML  = `
        <button id="pA-instaBtn" onclick="_ingestInstagram()"
          style="padding:10px 20px; border-radius:10px; border:none; background:var(--accent); color:#fff; font-size:12px; font-weight:700; cursor:pointer;">
          인스타 포스트 가져오기
        </button>`;
    } else {
      statusEl.textContent = '⚠️ 인스타 미연동';
      const token  = getToken() || '';
      const origin = encodeURIComponent(
        window.location.origin +
        window.location.pathname.replace(/\/index\.html$/, '')
      );
      actionsEl.innerHTML  = `
        <button onclick="window.location.href='${_esc(API)}/instagram/go?token=${encodeURIComponent(token)}&origin=${origin}'"
          style="padding:10px 20px; border-radius:10px; border:none; background:var(--accent); color:#fff; font-size:12px; font-weight:700; cursor:pointer;">
          인스타 연동하기
        </button>`;
    }
  } catch (e) {
    if (statusEl) statusEl.textContent = '인스타 상태 확인 실패: ' + e.message;
  }
}

async function _ingestInstagram() {
  const btn      = document.getElementById('pA-instaBtn');
  const msgEl    = document.getElementById('pA-ingestMsg');
  if (!btn || !msgEl) return;
  btn.disabled = true; btn.textContent = '처리중…';
  msgEl.textContent = '';
  try {
    const res  = await _personaFetch('POST', '/persona/posts/ingest/instagram');
    const data = await res.json();
    if (!res.ok) { msgEl.textContent = '오류: ' + (data.detail || res.status); return; }
    msgEl.textContent = `추가 ${data.inserted}건 · 중복 ${data.skipped_duplicates}건 · 빈값 ${data.skipped_empty}건 · 누적 ${data.total_after}건`;
    _pPostCount = data.total_after;
    _syncDetectBtn();
  } catch (e) {
    msgEl.textContent = '오류: ' + e.message;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '인스타 포스트 가져오기'; }
  }
}

function _toggleManual() {
  const el = document.getElementById('pA-manual');
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

async function _ingestManual() {
  const textEl = document.getElementById('pA-manualText');
  const btn    = document.getElementById('pA-manualBtn');
  const msgEl  = document.getElementById('pA-manualMsg');
  if (!textEl || !btn || !msgEl) return;

  const raw = textEl.value.trim();
  if (!raw) { msgEl.textContent = '내용을 입력하세요.'; return; }

  // 빈 줄 2개(=연속 3개 이상 개행)로 포스트 구분
  const posts = raw.split(/\n{3,}/).map(s => s.trim()).filter(Boolean);
  if (!posts.length) { msgEl.textContent = '포스트를 인식하지 못했습니다.'; return; }

  btn.disabled = true; btn.textContent = '처리중…';
  msgEl.textContent = `${posts.length}건 전송 중…`;
  try {
    window._assertSpec('POST /persona/posts/ingest/manual', { posts });
    const res  = await _personaFetch('POST', '/persona/posts/ingest/manual', { posts });
    const data = await res.json();
    if (!res.ok) { msgEl.textContent = '오류: ' + (data.detail || res.status); return; }
    msgEl.textContent = `추가 ${data.inserted}건 · 중복 ${data.skipped_duplicates}건 · 빈값 ${data.skipped_empty}건 · 누적 ${data.total_after}건`;
    textEl.value = '';
    _pPostCount = data.total_after;
    _syncDetectBtn();
  } catch (e) {
    msgEl.textContent = '오류: ' + e.message;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '추가'; }
  }
}

// ─────────────────────────────────────────────────────────────────
// 블록 B — 자동 감지
// ─────────────────────────────────────────────────────────────────
function _syncDetectBtn() {
  const btn     = document.getElementById('pB-detectBtn');
  const hintEl  = document.getElementById('pB-detectHint');
  const countEl = document.getElementById('pB-countMsg');
  const enough  = _pPostCount >= 10;

  if (countEl) {
    if (_pPostCount === 0) {
      countEl.textContent = '포스트를 먼저 수집하세요.';
    } else {
      countEl.textContent = `수집된 포스트: ${_pPostCount}건`;
    }
  }
  if (btn) {
    btn.disabled = !enough;
    btn.style.opacity = enough ? '1' : '0.4';
    btn.style.cursor  = enough ? 'pointer' : 'not-allowed';
  }
  if (hintEl) {
    hintEl.textContent = enough ? '' : '10건 이상 필요';
  }
}

async function _runDetect() {
  const btn      = document.getElementById('pB-detectBtn');
  const resultEl = document.getElementById('pB-detectResult');
  if (!btn || !resultEl) return;
  btn.disabled = true; btn.textContent = '처리중…';
  resultEl.innerHTML = '';
  try {
    const res  = await _personaFetch('POST', '/persona/signature/detect');
    const data = await res.json();
    if (!res.ok) {
      resultEl.innerHTML = `<div style="font-size:12px; color:var(--accent);">오류: ${_esc(data.detail || res.status)}</div>`;
      return;
    }
    _detectCandidates = data.candidates || [];
    if (!_detectCandidates.length) {
      resultEl.innerHTML = '<div style="font-size:12px; color:var(--text3);">감지된 후보가 없습니다.</div>';
      return;
    }
    resultEl.innerHTML = _detectCandidates.map((c, i) => `
      <div id="dcard-${i}" style="border:1px solid var(--border); border-radius:10px; padding:12px; margin-bottom:10px;">
        <div style="font-size:11px; color:var(--text3); margin-bottom:6px;">
          빈도 ${(c.frequency * 100).toFixed(1)}% · ${c.suggested_position === 'top' ? '상단' : '하단'}
        </div>
        <pre style="font-size:11px; color:var(--text); white-space:pre-wrap; word-break:break-all; margin:0 0 10px; background:var(--bg3); padding:8px; border-radius:8px; font-family:inherit;">${_esc(c.content)}</pre>
        <button id="dadd-${i}" onclick="_addDetected(${i})"
          style="padding:7px 14px; border-radius:8px; border:none; background:var(--accent); color:#fff; font-size:11px; font-weight:700; cursor:pointer;">
          추가
        </button>
      </div>
    `).join('');
  } catch (e) {
    resultEl.innerHTML = `<div style="font-size:12px; color:var(--accent);">오류: ${_esc(e.message)}</div>`;
  } finally {
    if (btn) {
      btn.textContent = '자동 감지';
      _syncDetectBtn(); // 10건 미만이면 다시 비활성
    }
  }
}

async function _addDetected(idx) {
  const c   = _detectCandidates[idx];
  const btn = document.getElementById('dadd-' + idx);
  if (!c || !btn) return;
  btn.disabled = true; btn.textContent = '처리중…';
  try {
    const sigBody = {
      label:              `자동감지 #${idx + 1}`,
      content:            c.content,
      position:           c.suggested_position,
      is_default:         true,
      source:             'detected',
      detected_frequency: c.frequency,
    };
    window._assertSpec('POST /persona/signature-blocks', sigBody);
    const res  = await _personaFetch('POST', '/persona/signature', sigBody);
    const data = await res.json();
    if (!res.ok) {
      btn.textContent = '오류';
      btn.disabled    = false;
      return;
    }
    btn.textContent = '추가됨 ✓';
    // 목록 갱신
    await _loadSignatureList();
  } catch (e) {
    btn.textContent = '오류';
    btn.disabled    = false;
  }
}

// ─────────────────────────────────────────────────────────────────
// 블록 C — 서명블록 목록
// ─────────────────────────────────────────────────────────────────
async function _loadSignatureList() {
  const listEl = document.getElementById('pC-list');
  if (!listEl) return;
  try {
    const res  = await _personaFetch('GET', '/persona/signature');
    const raw  = await res.json();
    if (!res.ok) {
      listEl.innerHTML = `<div style="font-size:12px; color:var(--text3);">불러오기 실패: ${_esc(raw.detail || res.status)}</div>`;
      return;
    }
    const sigs = Array.isArray(raw) ? raw : (raw.signatures || raw.items || []);
    if (!sigs.length) {
      listEl.innerHTML = '<div style="font-size:12px; color:var(--text3);">등록된 서명블록이 없습니다.</div>';
      return;
    }
    listEl.innerHTML = sigs.map(s => `
      <div id="sig-${s.id}" style="border:1px solid var(--border); border-radius:10px; padding:12px; margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px;">
          <input value="${_esc(s.label || '')}" readonly
            style="flex:1; font-size:12px; font-weight:700; border:none; background:transparent; color:var(--text); padding:0; min-width:0;">
          <button onclick="_deleteSig(${s.id})"
            style="flex-shrink:0; padding:5px 10px; border-radius:8px; border:1px solid var(--border); background:#fff; font-size:11px; color:var(--text3); cursor:pointer;">
            삭제
          </button>
        </div>
        <textarea readonly rows="3"
          style="width:100%; box-sizing:border-box; font-size:11px; border:1px solid var(--border); border-radius:8px; padding:8px; resize:none; background:var(--bg3); color:var(--text); font-family:inherit;"
        >${_esc(s.content || '')}</textarea>
        <div style="display:flex; gap:12px; align-items:center; margin-top:8px; flex-wrap:wrap;">
          <select disabled style="font-size:11px; border:1px solid var(--border); border-radius:6px; padding:4px 8px; background:var(--bg3);">
            <option value="bottom" ${s.position !== 'top' ? 'selected' : ''}>하단</option>
            <option value="top"    ${s.position === 'top' ? 'selected' : ''}>상단</option>
          </select>
          <label style="font-size:11px; color:var(--text2); display:flex; align-items:center; gap:4px;">
            <input type="checkbox" disabled ${s.is_default ? 'checked' : ''}> 기본값
          </label>
          ${s.source ? `<span style="font-size:10px; color:var(--text3); background:var(--bg3); padding:2px 6px; border-radius:4px;">${_esc(s.source)}</span>` : ''}
        </div>
      </div>
    `).join('');
  } catch (e) {
    if (listEl) listEl.innerHTML = `<div style="font-size:12px; color:var(--text3);">오류: ${_esc(e.message)}</div>`;
  }
}

async function _deleteSig(id) {
  const itemEl = document.getElementById('sig-' + id);
  if (itemEl) { itemEl.style.opacity = '0.5'; }
  try {
    const res = await _personaFetch('DELETE', '/persona/signature/' + id);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (itemEl) { itemEl.style.opacity = '1'; itemEl.style.outline = '1.5px solid var(--accent)'; }
      return;
    }
    if (itemEl) itemEl.remove();
    // 목록이 비었으면 메시지 표시
    const listEl = document.getElementById('pC-list');
    if (listEl && !listEl.querySelector('[id^="sig-"]')) {
      listEl.innerHTML = '<div style="font-size:12px; color:var(--text3);">등록된 서명블록이 없습니다.</div>';
    }
  } catch (e) {
    if (itemEl) { itemEl.style.opacity = '1'; itemEl.style.outline = '1.5px solid var(--accent)'; }
  }
}


function _updateIdStatus() {
  let done = 0;
  if ((document.getElementById('pid-shop_name_intro')?.value || '').trim()) done++;
  if (Object.values(SUPPORTED_CATEGORIES).some(k => document.getElementById('pid-svc-' + k)?.checked)) done++;
  if (Object.keys(AGE_LABELS).some(a => Object.keys(GENDER_LABELS).some(g => document.getElementById(`pid-aud-${a}_${g}`)?.checked))) done++;
  if (document.querySelector('input[name="pid-tone"]:checked')) done++;
  if ((document.getElementById('pid-location')?.value || '').trim()) done++;
  const el = document.getElementById('_pIdStatus');
  if (el) el.textContent = `필수 ${done}/5 완료`;
}

async function _loadIdentity() {
  try {
    const [resData, resSt] = await Promise.all([
      _personaFetch('GET', '/persona/identity'),
      _personaFetch('GET', '/persona/identity/status'),
    ]);
    const data = resData.ok ? await resData.json() : null;
    const st   = resSt.ok  ? await resSt.json()   : null;

    if (data) {
      _pIdentityLoaded = data;

      // Q1
      const sniEl = document.getElementById('pid-shop_name_intro');
      if (sniEl && data.shop_name_intro) {
        sniEl.value = data.shop_name_intro;
        const cntEl = document.getElementById('pid-sni-count');
        if (cntEl) cntEl.textContent = data.shop_name_intro.length + '/50';
      }

      // Q2 services: [{category, sub_services:[]}] or {extension:[...], nail:[...]}
      if (data.services) {
        const svcMap = {};
        if (Array.isArray(data.services)) {
          data.services.forEach(s => { svcMap[s.category] = s.sub_services || []; });
        } else {
          Object.assign(svcMap, data.services);
        }
        Object.values(SUPPORTED_CATEGORIES).forEach(key => {
          if (svcMap[key] !== undefined) {
            const cb = document.getElementById('pid-svc-' + key);
            if (cb) cb.checked = true;
            const subEl = document.getElementById('pid-sub-' + key);
            if (subEl && Array.isArray(svcMap[key])) subEl.value = svcMap[key].join(', ');
          }
        });
      }

      // Q3 target_audience: ["10s_female", ...]
      if (Array.isArray(data.target_audience)) {
        data.target_audience.forEach(v => {
          const cb = document.getElementById('pid-aud-' + v);
          if (cb) cb.checked = true;
        });
      }

      // Q4 tone_preference
      if (data.tone_preference) {
        const r = document.getElementById('pid-tone-' + data.tone_preference);
        if (r) r.checked = true;
      }

      // Q8 location
      const locEl = document.getElementById('pid-location');
      if (locEl && data.location) locEl.value = data.location;

      // Q5 nicknames
      if (Array.isArray(data.nicknames)) {
        _pNicknames = data.nicknames.slice();
        _renderNicknameTags();
      }
      // Q6 signature_vocab
      if (Array.isArray(data.signature_vocab)) {
        const svEl = document.getElementById('pid-sig-vocab');
        if (svEl) svEl.value = data.signature_vocab.join(', ');
      }
      // Q9 personality_line
      if (data.personality_line) {
        const plEl = document.getElementById('pid-personality');
        if (plEl) {
          plEl.value = data.personality_line;
          const cntEl = document.getElementById('pid-plc-count');
          if (cntEl) cntEl.textContent = data.personality_line.length + '/200';
        }
      }
    }

    // 진행률: 서버 status 우선, 없으면 DOM 기반 계산
    if (st && typeof st.required_completed === 'number' && typeof st.required_total === 'number') {
      const el = document.getElementById('_pIdStatus');
      if (el) el.textContent = `필수 ${st.required_completed}/${st.required_total} 완료`;
    } else {
      _updateIdStatus();
    }
  } catch (e) {
    _updateIdStatus();
  }
}

async function _saveIdentity() {
  const btn   = document.getElementById('pid-saveBtn');
  const msgEl = document.getElementById('pid-saveMsg');
  if (!btn || !msgEl) return;
  btn.disabled = true; btn.textContent = '저장 중…';
  msgEl.textContent = '';

  // 현재 폼 수집
  const shop = (document.getElementById('pid-shop_name_intro')?.value || '').trim();
  const services = [];
  Object.values(SUPPORTED_CATEGORIES).forEach(key => {
    const cb = document.getElementById('pid-svc-' + key);
    if (cb?.checked) {
      const raw = (document.getElementById('pid-sub-' + key)?.value || '').trim();
      const sub = raw ? raw.split(',').map(s => s.trim()).filter(Boolean).slice(0, 10) : [];
      services.push({category: key, sub_services: sub});
    }
  });
  const audience = [];
  Object.keys(AGE_LABELS).forEach(a => {
    Object.keys(GENDER_LABELS).forEach(g => {
      if (document.getElementById(`pid-aud-${a}_${g}`)?.checked) audience.push(`${a}_${g}`);
    });
  });
  const toneEl = document.querySelector('input[name="pid-tone"]:checked');
  const tone   = toneEl?.value || '';
  const loc    = (document.getElementById('pid-location')?.value || '').trim();

  // diff: 변경됐거나 처음 채운 필드만 body에 포함, 빈 값 제외
  const loaded = _pIdentityLoaded || {};
  const body   = {};

  if (shop && shop !== (loaded.shop_name_intro || ''))               body.shop_name_intro   = shop;
  if (services.length && JSON.stringify(services) !== JSON.stringify(loaded.services || []))
                                                                      body.services          = services;
  if (audience.length && JSON.stringify(audience.sort()) !== JSON.stringify((loaded.target_audience || []).slice().sort()))
                                                                      body.target_audience   = audience;
  if (tone && tone !== (loaded.tone_preference || ''))               body.tone_preference   = tone;
  if (loc  && loc  !== (loaded.location || ''))                      body.location          = loc;

  // 선택 4필드 (빈 배열/빈문자열도 변경이면 포함)
  const nicknames = _pNicknames.slice();
  if (JSON.stringify(nicknames) !== JSON.stringify(loaded.nicknames || []))
                                                                      body.nicknames         = nicknames;

  const svRaw   = (document.getElementById('pid-sig-vocab')?.value || '').trim();
  const sigVocab = svRaw ? svRaw.split(',').map(s => s.trim()).filter(Boolean).slice(0, 20) : [];
  if (JSON.stringify(sigVocab) !== JSON.stringify(loaded.signature_vocab || []))
                                                                      body.signature_vocab   = sigVocab;

  const pLine  = (document.getElementById('pid-personality')?.value || '').trim();
  if (pLine !== (loaded.personality_line || ''))                      body.personality_line  = pLine;

  if (!Object.keys(body).length) {
    msgEl.textContent = '변경 사항 없음';
    btn.disabled = false; btn.textContent = '저장';
    return;
  }

  try {
    window._assertSpec('PUT /persona/identity', body);
    const res  = await _personaFetch('PUT', '/persona/identity', body);
    const data = await res.json();
    if (!res.ok) { msgEl.textContent = '오류: ' + (data.detail || res.status); return; }

    // 저장 성공 → 로컬 캐시 갱신
    _pIdentityLoaded = Object.assign({}, loaded, body);
    msgEl.textContent = '저장됨 ✓';
    setTimeout(() => { const m = document.getElementById('pid-saveMsg'); if (m) m.textContent = ''; }, 2500);

    // status 재조회
    const resSt = await _personaFetch('GET', '/persona/identity/status');
    if (resSt.ok) {
      const st = await resSt.json();
      if (typeof st.required_completed === 'number') {
        const el = document.getElementById('_pIdStatus');
        if (el) el.textContent = `필수 ${st.required_completed}/${st.required_total} 완료`;
      }
    } else {
      _updateIdStatus();
    }
  } catch (e) {
    msgEl.textContent = '오류: ' + e.message;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '저장'; }
  }
}

// ─────────────────────────────────────────────────────────────────
// Q5 닉네임 태그 입력
// ─────────────────────────────────────────────────────────────────
function _addNicknameTag() {
  const inp = document.getElementById('pid-nick-inp');
  if (!inp) return;
  const val = inp.value.trim();
  if (!val || _pNicknames.length >= 5 || _pNicknames.includes(val)) { inp.value = ''; return; }
  _pNicknames.push(val);
  inp.value = '';
  _renderNicknameTags();
}

function _removeNicknameTag(i) {
  _pNicknames.splice(i, 1);
  _renderNicknameTags();
}

function _renderNicknameTags() {
  const el = document.getElementById('pid-nick-tags');
  if (!el) return;
  el.innerHTML = _pNicknames.map((t, i) =>
    `<span style="display:inline-flex;align-items:center;gap:4px;background:var(--bg3);border:1px solid var(--border);border-radius:20px;padding:3px 10px 3px 12px;font-size:11px;color:var(--text2);">
      ${_esc(t)}
      <button onclick="_removeNicknameTag(${i})" style="background:none;border:none;cursor:pointer;padding:0;font-size:13px;color:var(--text3);line-height:1;margin-left:2px;">×</button>
    </span>`
  ).join('');
  const hint = document.getElementById('pid-nick-hint');
  if (hint) hint.textContent = _pNicknames.length >= 5 ? '최대 5개' : '';
}

// ─────────────────────────────────────────────────────────────────
// 동의 블록 (C4-UI-2)
// ─────────────────────────────────────────────────────────────────
function _renderConsentBlock() {
  return `
  <div id="pId-consent" style="margin-bottom:16px;background:#fff;border-radius:16px;border:1px solid var(--border);padding:16px;">
    <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:12px;">서비스 동의</div>
    <div id="pcon-body"><div style="font-size:12px;color:var(--text3);">불러오는 중…</div></div>
  </div>`;
}

async function _loadConsent() {
  const bodyEl = document.getElementById('pcon-body');
  if (!bodyEl) return;
  try {
    const [resExist, resText] = await Promise.all([
      _personaFetch('GET', '/persona/consent'),
      _personaFetch('GET', '/persona/consent/text'),
    ]);
    const existing = resExist.ok ? await resExist.json() : null;

    // 이미 동의 완료 → 접힌 상태
    if (existing && existing.pipa_collect && existing.ai_processing) {
      const date = (existing.agreed_at || '').slice(0, 10);
      bodyEl.innerHTML = `<div style="font-size:12px;color:var(--text3);">✓ 동의 완료${date ? ' (' + date + ')' : ''}</div>`;
      return;
    }

    const texts  = resText.ok ? await resText.json() : {};
    // API 키 이름이 다를 수 있으므로 양쪽 시도
    const pipaText = texts.pipa_collect_v1_0 || texts['pipa_collect_v1.0'] || texts.pipa_collect || '';
    const aiText   = texts.ai_processing_v1_0 || texts['ai_processing_v1.0'] || texts.ai_processing || '';

    bodyEl.innerHTML = `
      <details style="margin-bottom:10px;">
        <summary style="font-size:12px;cursor:pointer;color:var(--text2);font-weight:600;padding:2px 0;">개인정보 수집·이용 동의서 보기</summary>
        <pre style="font-size:11px;color:var(--text3);white-space:pre-wrap;word-break:break-all;margin:8px 0 0;background:var(--bg3);padding:10px;border-radius:8px;font-family:inherit;max-height:180px;overflow-y:auto;">${_esc(pipaText)}</pre>
      </details>
      <details style="margin-bottom:14px;">
        <summary style="font-size:12px;cursor:pointer;color:var(--text2);font-weight:600;padding:2px 0;">AI 처리 동의서 보기</summary>
        <pre style="font-size:11px;color:var(--text3);white-space:pre-wrap;word-break:break-all;margin:8px 0 0;background:var(--bg3);padding:10px;border-radius:8px;font-family:inherit;max-height:180px;overflow-y:auto;">${_esc(aiText)}</pre>
      </details>
      <label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer;font-size:12px;">
        <input type="checkbox" id="pcon-pipa" onchange="_syncConsentBtn();">
        개인정보 수집·이용 동의 <span style="color:var(--accent);">(필수)</span>
      </label>
      <label style="display:flex;align-items:center;gap:8px;margin-bottom:14px;cursor:pointer;font-size:12px;">
        <input type="checkbox" id="pcon-ai" onchange="_syncConsentBtn();">
        AI 처리 동의 <span style="color:var(--accent);">(필수)</span>
      </label>
      <div style="display:flex;align-items:center;gap:10px;">
        <button id="pcon-btn" onclick="_saveConsent()" disabled
          style="padding:10px 24px;border-radius:10px;border:none;background:var(--accent);color:#fff;font-size:12px;font-weight:700;cursor:not-allowed;opacity:0.4;">
          동의 저장
        </button>
        <span id="pcon-msg" style="font-size:12px;color:var(--text3);"></span>
      </div>`;
  } catch (e) {
    if (bodyEl) bodyEl.innerHTML = `<div style="font-size:12px;color:var(--text3);">불러오기 실패: ${_esc(e.message)}</div>`;
  }
}

function _syncConsentBtn() {
  const both = document.getElementById('pcon-pipa')?.checked && document.getElementById('pcon-ai')?.checked;
  const btn  = document.getElementById('pcon-btn');
  if (!btn) return;
  btn.disabled     = !both;
  btn.style.opacity = both ? '1' : '0.4';
  btn.style.cursor  = both ? 'pointer' : 'not-allowed';
}

async function _saveConsent() {
  const btn   = document.getElementById('pcon-btn');
  const msgEl = document.getElementById('pcon-msg');
  if (!btn || !msgEl) return;
  btn.disabled = true; btn.textContent = '저장 중…';
  msgEl.textContent = '';
  try {
    const consentBody = {
      pipa_collect: true, ai_processing: true,
      versions: {pipa_collect: '1.0', ai_processing: '1.0'},
    };
    window._assertSpec('POST /persona/consent', consentBody);
    const res  = await _personaFetch('POST', '/persona/consent', consentBody);
    const data = await res.json();
    if (!res.ok) {
      msgEl.textContent = '오류: ' + (data.detail || res.status);
      btn.disabled = false; btn.textContent = '동의 저장';
      return;
    }
    const bodyEl = document.getElementById('pcon-body');
    if (bodyEl) {
      const date = (data.agreed_at || new Date().toISOString()).slice(0, 10);
      bodyEl.innerHTML = `<div style="font-size:12px;color:var(--text3);">✓ 동의 완료 (${date})</div>`;
    }
  } catch (e) {
    if (msgEl) msgEl.textContent = '오류: ' + e.message;
    if (btn) { btn.disabled = false; btn.textContent = '동의 저장'; }
  }
}

async function _addManualSig() {
  const label     = (document.getElementById('pC-label')?.value   || '').trim();
  const content   = (document.getElementById('pC-content')?.value || '').trim();
  const position  = document.getElementById('pC-position')?.value  || 'bottom';
  const isDefault = document.getElementById('pC-isDefault')?.checked || false;
  const btn       = document.getElementById('pC-addBtn');
  const msgEl     = document.getElementById('pC-addMsg');
  if (!msgEl) return;

  if (!label)   { msgEl.textContent = '이름을 입력하세요.';   return; }
  if (!content) { msgEl.textContent = '내용을 입력하세요.';   return; }

  btn.disabled = true; btn.textContent = '처리중…';
  msgEl.textContent = '';
  try {
    const sigBody = { label, content, position, is_default: isDefault, source: 'manual' };
    window._assertSpec('POST /persona/signature-blocks', sigBody);
    const res  = await _personaFetch('POST', '/persona/signature', sigBody);
    const data = await res.json();
    if (!res.ok) { msgEl.textContent = '오류: ' + (data.detail || res.status); return; }
    msgEl.textContent = '추가 완료';
    document.getElementById('pC-label').value    = '';
    document.getElementById('pC-content').value  = '';
    document.getElementById('pC-isDefault').checked = false;
    await _loadSignatureList();
  } catch (e) {
    msgEl.textContent = '오류: ' + e.message;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '추가'; }
  }
}
