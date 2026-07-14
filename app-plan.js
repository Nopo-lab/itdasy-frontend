/* ─────────────────────────────────────────────────────────────
   플랜 팝업 — md 정리: 월 6,900원 단일 멤버십 + 사용량 안내

   기존 planPopup HTML은 있었으나 열기·액션 함수가 없어서
   모든 플랜 배지·업그레이드 버튼이 무반응이던 버그 수정.
   ──────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  let _selectedPlan = 'pro';
  let _currentPlan = 'free';
  let _cancelScheduled = false;   // 취소 예약(만료일까지 유지)
  let _periodEnd = null;          // 다음 결제일/만료일

  function _planDisplayName(plan) {
    if (plan === 'free') return '체험';
    return '잇데이';
  }

  async function openPlanPopup() {
    const pop = document.getElementById('planPopup');
    if (!pop) return;

    _selectedPlan = 'pro';
    pop.style.display = 'flex';
    _updatePlanCardHighlight();
    _stylePopularCard();
    if (window.hapticLight) window.hapticLight();

    // 사용량/상태 로드 + 결제 가능여부(graceful)
    _loadUsage().catch(() => {});
    _loadStatus().then(() => _applyBillingAvailability()).catch(() => {});

    // 취소 버튼 바인딩 (idempotent)
    const cancelBtn = document.getElementById('planCancelBtn');
    if (cancelBtn && !cancelBtn._bound) {
      cancelBtn._bound = true;
      cancelBtn.addEventListener('click', doCancelSubscription);
    }

    // 카드 클릭 바인딩 (idempotent)
    document.querySelectorAll('#planPopup .plan-card').forEach((card) => {
      if (card._bound) return;
      card._bound = true;
      card.addEventListener('click', () => {
        _selectedPlan = card.dataset.plan;
        _updatePlanCardHighlight();
        if (window.hapticLight) window.hapticLight();
      });
    });

    const closeBtn = document.getElementById('planCloseBtn');
    if (closeBtn && !closeBtn._bound) {
      closeBtn._bound = true;
      closeBtn.addEventListener('click', () => { pop.style.display = 'none'; });
    }
    // 배경 클릭으로 닫기
    if (!pop._bgBound) {
      pop._bgBound = true;
      pop.addEventListener('click', (e) => { if (e.target === pop) pop.style.display = 'none'; });
    }
  }

  function closePlanPopup() {
    const pop = document.getElementById('planPopup');
    if (pop) pop.style.display = 'none';
  }

  // 추천(pro) 카드 — index.html 수정 없이 JS에서 플랫 로즈 배지/보더로 통일
  function _stylePopularCard() {
    const proCard = document.getElementById('planCardPro');
    if (!proCard) return;
    proCard.style.border = '2px solid var(--brand)';
    const badge = Array.from(proCard.children).find((el) => el.style && el.style.position === 'absolute');
    if (badge) {
      badge.textContent = '가장 인기';
      badge.style.background = 'var(--brand)';
      badge.style.borderRadius = 'var(--r-pill,999px)';
      badge.style.fontSize = '11px';
      badge.style.fontWeight = '700';
      badge.style.padding = '3px 10px';
    }
  }

  function _updatePlanCardHighlight() {
    document.querySelectorAll('#planPopup .plan-card').forEach((card) => {
      const selected = card.dataset.plan === _selectedPlan;
      card.style.transform = selected ? 'scale(1.02)' : 'scale(1)';
      card.style.boxShadow = selected ? 'var(--shadow-brand)' : 'none';
    });
    _updateActionButton();
  }

  function _updateActionButton() {
    const btn = document.getElementById('planActionBtn');
    if (!btn) return;
    if (_selectedPlan === _currentPlan) {
      btn.textContent = '현재 이용 중인 플랜입니다';
      btn.disabled = true;
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';
      return;
    }
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.style.cursor = 'pointer';
    if (_selectedPlan === 'free') {
      btn.textContent = '체험 상태로 유지';
      btn.style.background = 'var(--text-subtle,#888)';
    } else if (_selectedPlan === 'pro') {
      btn.textContent = (_currentPlan === 'free') ? '월 6,900원 시작하기' : '잇데이 멤버십으로 전환';
      btn.style.background = 'var(--brand)';
    } else if (_selectedPlan === 'premium') {
      btn.textContent = '잇데이 멤버십으로 전환';
      btn.style.background = 'var(--brand)';
    }
  }

  async function _loadUsage() {
    const headers = window.authHeader && window.authHeader();
    if (!window.API || !headers || !headers.Authorization) return;
    const box = document.getElementById('planUsageContent');
    if (!box) return;
    try {
      const res = await apiFetch('/subscription/usage', { headers });
      if (!res.ok) throw new Error('usage ' + res.status);
      const u = await res.json();
      // [버그6] BE 실제 응답 shape는 중첩 객체 — { plan, caption:{used,limit,period}, removebg:{…}, publish:{…}, analyze:{…}, portfolio_tag:{…} }
      // 기존 코드는 평면 필드(u.caption_today)를 읽어 항상 rows=0 → "불러올 수 없어요"로 빠지던 버그.
      const _fmtLimit = (l) => (l == null || l < 0) ? '∞' : l;
      const _defs = [
        ['caption', 'AI 캡션/해시태그', ''],
        ['removebg', '누끼·배경', ''],
        ['analyze', '말투 분석', ' (이번 달)'],
        ['publish', '인스타 발행', ' (이번 달)'],
        ['portfolio_tag', '포트폴리오 자동태그', ''],
      ];
      const rows = [];
      let recognized = false; // 예상 shape의 키를 하나라도 이해했는지 (파싱 성공 판정)
      for (const [key, label, suffix] of _defs) {
        const it = u && u[key];
        if (it && typeof it === 'object' && it.used !== undefined) {
          recognized = true;
          rows.push(`• ${label}: ${it.used}/${_fmtLimit(it.limit)}${suffix}`);
        }
      }
      if (rows.length) box.innerHTML = rows.join('<br>');
      else if (recognized) box.textContent = '아직 사용 내역이 없어요'; // 200이지만 집계 전/빈 경우
      else box.textContent = '사용량 정보를 표시할 수 없어요'; // 응답 shape 예상 밖 (파싱 실패)
    } catch (_) {
      box.textContent = '사용량을 불러오지 못했어요'; // 네트워크/HTTP 실패
    }
  }

  async function _loadStatus() {
    const headers = window.authHeader && window.authHeader();
    if (!window.API || !headers || !headers.Authorization) return;
    try {
      const res = await apiFetch('/subscription/status', { headers });
      if (!res.ok) return;
      const d = await res.json();
      _currentPlan = (d.plan || 'free').toLowerCase();
      _cancelScheduled = !!d.cancel_at_period_end;
      _periodEnd = d.current_period_end || d.next_bill_at || null;
      _updateActionButton();
      _updatePlanBadgeUI(_currentPlan);
      _renderSubMeta();
    } catch (_) { void 0; }
  }

  // 구독 메타(만료일/취소 예약) + 취소 버튼 노출. planPopup 안에서만 의미 있음.
  function _renderSubMeta() {
    const meta = document.getElementById('planSubMeta');
    const cancelBtn = document.getElementById('planCancelBtn');
    const paid = _currentPlan === 'pro' || _currentPlan === 'premium';
    if (meta) {
      if (paid && _periodEnd) {
        const dt = new Date(_periodEnd);
        const ds = isNaN(dt.getTime()) ? '' : (dt.getFullYear() + '.' + (dt.getMonth() + 1) + '.' + dt.getDate());
        meta.textContent = _cancelScheduled ? ('취소 예약됨 · ' + ds + '까지 이용 가능') : ('다음 결제일 ' + ds);
        meta.style.display = 'block';
      } else {
        meta.style.display = 'none';
      }
    }
    if (cancelBtn) cancelBtn.style.display = (paid && !_cancelScheduled) ? 'block' : 'none';
  }

  // [graceful disable] 웹에서 결제 불가(env 미설정)면 결제 버튼 비활성. 네이티브는 별도(IAP).
  async function _applyBillingAvailability() {
    const btn = document.getElementById('planActionBtn');
    if (!btn || _selectedPlan === _currentPlan || _isNative()) return;
    if (!window.ItdasyBilling) return;
    try {
      const avail = await window.ItdasyBilling.isWebBillingAvailable();
      if (!avail) {
        btn.disabled = true; btn.style.opacity = '0.5'; btn.style.cursor = 'not-allowed';
        btn.textContent = '결제 준비 중';
      }
    } catch (_e) { void 0; }
  }

  function _updatePlanBadgeUI(plan) {
    const badge = document.getElementById('planBadge');
    if (!badge) return;
    if (plan === 'pro') {
      badge.textContent = _planDisplayName(plan);
      badge.style.background = 'var(--brand)';
      badge.style.color = '#fff';
    } else if (plan === 'premium') {
      badge.textContent = _planDisplayName(plan);
      badge.style.background = 'var(--brand)';
      badge.style.color = '#fff';
    } else {
      badge.textContent = _planDisplayName(plan);
      badge.style.background = '#e0e0e0';
      badge.style.color = 'var(--text-subtle,#888)';
    }
    try {
      window.dispatchEvent(new CustomEvent('itdasy:plan-updated', { detail: { plan } }));
    } catch (_) { void 0; }
  }

  function _isNative() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  }

  async function doPlanAction() {
    if (_selectedPlan === _currentPlan) return;
    if (_selectedPlan === 'free') {
      if (window.hapticMedium) window.hapticMedium();
      if (typeof window.showToast === 'function') window.showToast('체험 상태 변경은 설정에서 진행해주세요');
      return;
    }

    // 네이티브 앱: 앱스토어 IAP 만 사용 (Apple/Google anti-steering — 웹 PG 호출 금지).
    if (_isNative()) {
      if (window.hapticMedium) window.hapticMedium();
      if (typeof window.showToast === 'function') window.showToast('앱에서는 앱스토어 결제로 진행돼요 (준비중)');
      // TODO: @capacitor-community/in-app-purchases 플러그인 호출
      return;
    }

    // 웹/PC: 포트원 PG 결제 (빌링키 우선, 단건 폴백 — app-billing.js)
    if (!window.ItdasyBilling) {
      if (typeof window.showToast === 'function') window.showToast('결제 모듈을 불러오지 못했어요');
      return;
    }
    const btn = document.getElementById('planActionBtn');
    const orig = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; btn.textContent = '결제 진행 중…'; }
    try {
      const r = await window.ItdasyBilling.startWebSubscription('pro');
      if (r && r.ok) {
        if (window.hapticSuccess) window.hapticSuccess();
        _currentPlan = 'pro';
        _updateActionButton();
        _updatePlanBadgeUI('pro');
        setTimeout(closePlanPopup, 1200);
      } else if (btn) {
        btn.disabled = false; btn.style.opacity = '1'; btn.textContent = orig;
      }
    } catch (e) {
      if (window.hapticError) window.hapticError();
      if (typeof window.showToast === 'function') window.showToast('결제 실패: ' + (e.message || ''));
      if (btn) { btn.disabled = false; btn.style.opacity = '1'; btn.textContent = orig; }
    }
  }

  // 구독 취소 — 만료일까지 Pro 유지(서버 cancel_at_period_end).
  async function doCancelSubscription() {
    if (!window.ItdasyBilling) return;
    if (!window.confirm('구독을 취소할까요? 만료일까지는 계속 이용할 수 있어요.')) return;
    const r = await window.ItdasyBilling.cancelSubscription();
    if (r && r.ok) { _cancelScheduled = true; _renderSubMeta(); }
  }

  // 전역 노출 (index.html onclick 에서 참조)
  window.openPlanPopup = openPlanPopup;
  window.closePlanPopup = closePlanPopup;
  window.doPlanAction = doPlanAction;
  window.doCancelSubscription = doCancelSubscription;
  window.refreshPlanStatus = _loadStatus;   // 결제/취소 성공 후 app-billing 이 호출

  // 외부에서 현재 플랜 조회 (고객·매출 한도 분기용)
  window.getCurrentPlan = () => _currentPlan;
  window.getCurrentPlanLabel = () => _planDisplayName(_currentPlan);
  window.isPaidPlan = () => _currentPlan === 'pro' || _currentPlan === 'premium';

  // planActionBtn 클릭 이벤트 바인딩 (app-core.js 의 on() 등록 외에 안전장치)
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('planActionBtn');
    if (btn && !btn._planActionBound) {
      btn._planActionBound = true;
      btn.addEventListener('click', doPlanAction);
    }
    // 초기 진입 시 현재 플랜 로드
    setTimeout(() => { if (window.API && window.authHeader && window.authHeader()?.Authorization) _loadStatus().catch(() => {}); }, 1500);
  });
})();
