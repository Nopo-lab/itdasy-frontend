/* 잇비 AssistantContext — 현재 앱 상황 수집 → context_hint 문자열 (T-101 · 2026-05-30)

   목적: 잇비가 "이 손님 / 이 사진 / 지금 화면 / 방금 작업"을 알아먹게 한다.
   백엔드 계약: /assistant/ask 가 context_hint(≤500)를 받아 LLM 프롬프트 [힌트] 블록에
                실제 주입함(assistant.py:2956). 그래서 프론트만으로 1차 구현 가능.

   설계 원칙:
   - 전부 try/catch — 실패해도 '' 반환 → ask 는 {question, session_id} 로 정상 동작(하위호환).
   - 개인정보 최소: UI 에 이미 표시된 이름만. 전화/주소/생일 금지.
   - 추측 금지: 현재 고객/사진이 없으면 "현재고객 없음/현재사진 없음" 으로 명시.
   - 길이 ≤500 hard truncate. */
(function () {
  'use strict';

  if (window.ItdasyAssistantContext) return;

  // 탭 id → 사람이 읽는 화면명 (없으면 raw id)
  const SCREEN_LABELS = {
    home: '홈', dashboard: '내샵관리', workshop: '작업실', caption: '글작성',
    portfolio: '포트폴리오', finish: '시술완료', 'ai-suggest': 'AI제안',
  };

  function _shopType() {
    try {
      const raw = localStorage.getItem('shop_type') || '';
      if (!raw) return null;
      const norm = (typeof window.itdasyNormalizeShopType === 'function')
        ? window.itdasyNormalizeShopType(raw) : null;
      return norm ? { label: norm.label || raw, cat: norm.cat || '' } : { label: raw, cat: '' };
    } catch (_e) { return null; }
  }

  function _screen() {
    try { return window.__ITDASY_CURRENT_TAB__ || null; } catch (_e) { return null; }
  }

  // 작업실이 열려 있고 사진이 있을 때만 currentPhoto.
  // [2026-07-22] 옛 PhotoEditor(#photoEditorSheet + _internal.getState) 기준 → 현재 작업실.
  //   옛 편집기는 더 이상 열리지 않아 이 함수가 항상 null 이었고, 그만큼 잇비가 '지금 편집 중'
  //   맥락을 잃고 있었다. WorkspaceFlow.getActiveSlot() 으로 복구.
  function _currentPhoto() {
    try {
      const WF = window.WorkspaceFlow;
      if (!WF || typeof WF.getActiveSlot !== 'function') return null;
      const slot = WF.getActiveSlot();
      if (!slot || !slot.open || !slot.photoCount) return null;
      return {
        serviceName: slot.service || '',
        activeTab: slot.screen || '',
        customerId: null,
        customerName: '',
        hasPrice: false,
      };
    } catch (_e) { return null; }
  }

  function _currentCustomer() {
    try {
      const c = window.__ITDASY_CURRENT_CUSTOMER__;
      return (c && c.id != null) ? { id: c.id, name: c.name || '' } : null;
    } catch (_e) { return null; }
  }

  function _recentAction() {
    try { return window.__ITDASY_LAST_ACTION__ || null; } catch (_e) { return null; }
  }

  // 원시 컨텍스트 객체 (지시어 해석/디버그용)
  function collect() {
    return {
      shopType: _shopType(),
      screen: _screen(),
      currentPhoto: _currentPhoto(),
      currentCustomer: _currentCustomer(),
      recentAction: _recentAction(),
    };
  }

  // ≤500자 한국어 요약 문자열. 비면 null.
  function buildHint() {
    try {
      const c = collect();
      const parts = [];

      if (c.screen) parts.push('화면=' + (SCREEN_LABELS[c.screen] || c.screen));
      if (c.shopType) parts.push('업종=' + c.shopType.label + (c.shopType.cat ? '(' + c.shopType.cat + ')' : ''));

      if (c.currentCustomer) {
        parts.push('현재고객=' + (c.currentCustomer.name || '고객') + '#' + c.currentCustomer.id);
      } else {
        parts.push('현재고객 없음');
      }

      if (c.currentPhoto) {
        const seg = ['편집중'];
        if (c.currentPhoto.serviceName) seg.push('서비스=' + c.currentPhoto.serviceName);
        if (c.currentPhoto.customerName) seg.push('연결고객=' + c.currentPhoto.customerName);
        if (c.currentPhoto.activeTab) seg.push('탭=' + c.currentPhoto.activeTab);
        parts.push('현재사진=' + seg.join('/'));
      } else {
        // [P0a] 편집기엔 없어도 잇비 SourceImage(작업실 active/채팅 업로드)가 잡은 사진이 있으면 출처를 알린다.
        let srcNote = null;
        try {
          const s = window.ItdasySourceImage && window.ItdasySourceImage.resolve();
          if (s) srcNote = (s.origin === 'chat') ? '채팅업로드' : (s.origin === 'workshop' ? '작업실선택' : '편집기');
        } catch (_e) { void _e; }
        parts.push(srcNote ? ('현재사진=' + srcNote) : '현재사진 없음');
      }

      if (c.recentAction) parts.push('최근작업=' + c.recentAction);

      if (!parts.length) return null;
      let hint = '[현재상황] ' + parts.join(', ');
      if (hint.length > 500) hint = hint.slice(0, 500);
      return hint;
    } catch (_e) { return null; }
  }

  // 잇비 액션/사진작업이 호출해 "방금 작업"을 기록 (1줄 훅용)
  function markRecentAction(label) {
    try { if (label) window.__ITDASY_LAST_ACTION__ = String(label).slice(0, 40); } catch (_e) { void 0; }
  }

  window.ItdasyAssistantContext = { collect, buildHint, markRecentAction };
})();
