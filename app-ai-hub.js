/* AI 자동화 허브 v3 — 리스트 + 토글 시트 (2026-04-30)
   사용:
     window.openAiHub()   — 시트 열기
     window.closeAiHub()  — 시트 닫기

   디자인: mockups/03-myshop.html "AI · 자동화" 시트
   CSS:    css/screens/myshop-v3.css (.ms-sheet*, .ms-aih*, .ms-toggle*)
   라우트:  주요 항목 → 기존 진입 함수 (변경 X)
*/
(function () {
  'use strict';

  // ── 토글 상태 키 (UI 빠른 ON/OFF — 백엔드 동기화는 상세 시트에서) ─
  const KEY_DM = 'itdasy:aih:dm_enabled';
  const KEY_KAKAO = 'itdasy:aih:kakao_enabled';

  function _getToggle(key) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? true : v === 'true';
    } catch (_e) { return true; }
  }
  function _setToggle(key, on) {
    try { localStorage.setItem(key, on ? 'true' : 'false'); } catch (_e) { void _e; }
  }

  function _esc(s) { return window._esc(s); } /* [2026-06-11] 중복 제거 — app-core 정본 위임 */

  // ── 행 정의 ──────────────────────────────────────────────
  // type: 'toggle' | 'tag' | 'badge' | 'plain'
  function _rows() {
    return [
      { act: 'photoEditor', icon: 'ph-magic-wand', boxColor: 'pink',
        name: '사진 편집기', meta: '자동 보정 · Before/After · 템플릿',
        type: 'badge' },
      // [2026-05-25] SNS 캡션 + AI 페르소나 통합 — 'AI 페르소나' 단일 진입점.
      //   클릭 시 바텀시트로 3개 옵션(SNS 캡션 / 말투 새로 분석 / 분석 리포트 보기).
      { act: 'hashtag', icon: 'ph-hash', boxColor: 'teal',
        name: '해시태그 매니저', meta: '업종별 추천 · 원터치 복사',
        type: 'plain' },
      { act: 'persona', icon: 'ph-user-circle-gear', boxColor: 'pink',
        name: 'AI 페르소나', meta: 'SNS 캡션 · 말투 분석 · 리포트',
        type: 'tag', tagText: '학습됨' },
      { act: 'dm', icon: 'ph-chat-circle-dots', boxColor: 'blue',
        name: 'DM 자동응답', meta: '인스타 DM → AI 자동 답장',
        type: 'toggle', toggleKey: KEY_DM },
      { act: 'kakao', icon: 'ph-bell-ringing', boxColor: 'amber',
        name: '카카오 알림톡', meta: '예약확정 · 리마인드 · 생일',
        type: 'toggle', toggleKey: KEY_KAKAO },
      { act: 'posts', icon: 'ph-squares-four', boxColor: 'teal',
        name: '게시물 관리', meta: '완료 슬롯 · 마무리 탭',
        type: 'plain' },
      // [2026-05-25] AI 잇비 메모 / 스마트 캡처 행 제거 — 잇비 대화창 안에서 직접 호출.
      //   메모 = 잇비 채팅 헤더 메뉴, 카톡·명함·가격표 OCR = 잇비 채팅 + 버튼.
    ];
  }

  // ── 켜진 개수 (DM ON + 카카오 ON + 페르소나 학습됨 1 고정) ──
  function _onCount() {
    let n = 0;
    if (_getToggle(KEY_DM)) n++;
    if (_getToggle(KEY_KAKAO)) n++;
    n += 1; // 페르소나 학습됨
    return n;
  }

  // ── 행 우측 영역 마크업 ────────────────────────────────────────
  function _rightHtml(row) {
    const chev = `<svg width="14" height="14" aria-hidden="true"><use href="#ic-chevron-right"/></svg>`;
    if (row.type === 'toggle') {
      const on = _getToggle(row.toggleKey);
      return `
        <div class="ms-aih__right">
          <button type="button" class="ms-toggle ${on ? 'is-on' : ''}" data-toggle="${_esc(row.act)}" aria-label="${_esc(row.name)} ${on ? '끄기' : '켜기'}" aria-pressed="${on ? 'true' : 'false'}">
            <span class="ms-toggle__track"></span>
            <span class="ms-toggle__knob"></span>
          </button>
        </div>`;
    }
    if (row.type === 'tag') {
      return `<div class="ms-aih__right"><span class="ms-aih__tag is-ok">${_esc(row.tagText)}</span>${chev}</div>`;
    }
    if (row.type === 'badge') {
      return `<div class="ms-aih__right">${chev}</div>`;
    }
    return `<div class="ms-aih__right">${chev}</div>`;
  }

  // ── 행 마크업 (NEW 배지는 이름 옆) ─────────────────────────────
  // <button> 안에 <button>(토글) 중첩 invalid HTML — Safari가 분리시킴
  // 그래서 row 자체는 <div role="button"> 으로 래핑
  function _rowHtml(row) {
    const newBadge = row.type === 'badge'
      ? `<span class="ms-aih__badge-new">NEW</span>` : '';
    // Phosphor vs 레거시 SVG
    const isPhosphor = row.icon.startsWith('ph-');
    const iconInner = isPhosphor
      ? `<i class="ph-duotone ${_esc(row.icon)}" aria-hidden="true"></i>`
      : `<svg width="16" height="16" aria-hidden="true"><use href="#${_esc(row.icon)}"/></svg>`;
    const boxCls = row.boxColor ? `ic-box ic-box--sm ic-box--${_esc(row.boxColor)}` : '';
    const iconHtml = boxCls
      ? `<span class="${boxCls}">${iconInner}</span>`
      : iconInner;
    return `
      <div class="ms-aih__row" role="button" tabindex="0" data-act="${_esc(row.act)}" data-type="${_esc(row.type || '')}">
        <span class="ms-aih__icon">${iconHtml}</span>
        <span class="ms-aih__info">
          <span class="ms-aih__name">${_esc(row.name)}${newBadge}</span>
          <span class="ms-aih__meta">${_esc(row.meta)}</span>
        </span>
        ${_rightHtml(row)}
      </div>`;
  }

  // ── 시트 마크업 빌드 ──────────────────────────────────────────
  function _buildSheet() {
    const items = _rows();
    const rows = items.map(_rowHtml).join('');
    const sub = `${items.length}가지 · ${_onCount()}개 켜짐`;
    return `
      <div class="ms-sheet__overlay" data-close="1"></div>
      <div id="aihCard" class="ms-sheet" role="dialog" aria-modal="true" aria-labelledby="aihTitle">
        <div class="ms-sheet__handle"></div>
        <div class="ms-sheet__head">
          <div class="ms-sheet__head-left">
            <div id="aihTitle" class="ms-sheet__title">AI · 자동화</div>
            <div class="ms-sheet__sub" id="aihSub">${_esc(sub)}</div>
          </div>
          <button type="button" class="ms-sheet__close" data-close="1" aria-label="닫기">✕</button>
        </div>
        <div class="ms-sheet__body">
          <div class="ms-aih">${rows}</div>
          <div style="margin-top:12px;padding:10px 12px;background:var(--surface-2);border-radius:var(--r-sm);font-size:11px;color:var(--text-subtle);line-height:1.5;">
            토글 있는 항목은 즉시 켜고 끄기 · 행을 누르면 상세 설정으로
          </div>
        </div>
      </div>`;
  }

  // ── 시트 DOM 보장 + 핸들러 바인딩 ──────────────────────────────
  function _ensureSheet() {
    let sheet = document.getElementById('aiHubSheet');
    if (sheet) {
      sheet.innerHTML = _buildSheet();
      // 핸들러는 sheet 엘리먼트에 1회만 attach (innerHTML 교체해도 부모 리스너는 살아남음)
      // 이전엔 매번 attach 해서 N번 open 후 N번 fire → 토글 / route 다중 발생 버그
      return sheet;
    }
    sheet = document.createElement('div');
    sheet.id = 'aiHubSheet';
    sheet.style.cssText = 'position:fixed;inset:0;z-index:9985;display:none;';
    sheet.innerHTML = _buildSheet();
    document.body.appendChild(sheet);
    _bindHandlers(sheet);
    return sheet;
  }

  // ── 핸들러: 닫기 / 토글 / 행 클릭 + 키보드(div role=button 접근성) ──
  function _bindHandlers(sheet) {
    sheet.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) { close(); return; }

      const tgl = e.target.closest('[data-toggle]');
      if (tgl) {
        e.stopPropagation();
        e.stopImmediatePropagation();
        e.preventDefault();
        _onToggleClick(tgl, sheet);
        return;
      }

      const row = e.target.closest('.ms-aih__row');
      if (row) {
        // [2026-06-07] 토글 행도 텍스트 영역 탭 → 상세 진입 (토글 클릭은 위에서 stopPropagation 으로 처리됨).
        //   이전엔 여기서 return 해서 DM 자동화 행이 토글 전용 → 상세 진입 불가 버그.
        const act = row.dataset.act;
        // [2026-05-12 QA #7] 진입점 함수가 없을 때 sheet 만 닫혀서 사용자가
        // "다른 이상한 페이지로 이동한" 인상 받던 문제. 함수 존재 선검증.
        if (!_canRoute(act)) {
          if (window.showToast) window.showToast('아직 준비 중이에요. 잠시 후 다시 시도해주세요.');
          return; // sheet 유지
        }
        close();
        setTimeout(() => _route(act), 200);
      }
    });
    sheet.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      // 토글 버튼에 포커스된 채 Enter/Space — 네이티브 click 으로 토글만 (상세 진입 X)
      if (e.target.closest('[data-toggle]')) return;
      const row = e.target.closest('.ms-aih__row');
      if (!row) return;
      // [2026-06-07] 토글 행도 키보드 Enter/Space → 상세 진입 허용 (행 = role=button)
      e.preventDefault();
      const act = row.dataset.act;
      if (!_canRoute(act)) {
        if (window.showToast) window.showToast('아직 준비 중이에요.');
        return;
      }
      close();
      setTimeout(() => _route(act), 200);
    });
  }

  // ── 토글 클릭 처리 ────────────────────────────────────────────
  function _onToggleClick(btn, sheet) {
    const act = btn.dataset.toggle;
    const key = act === 'dm' ? KEY_DM : (act === 'kakao' ? KEY_KAKAO : null);
    if (!key) return;
    const next = !_getToggle(key);
    _setToggle(key, next);
    btn.classList.toggle('is-on', next);
    btn.setAttribute('aria-pressed', next ? 'true' : 'false');
    const sub = sheet.querySelector('#aihSub');
    if (sub) sub.textContent = `${_rows().length}가지 · ${_onCount()}개 켜짐`;
    try { window.hapticLight && window.hapticLight(); } catch (_e) { void _e; }
    try {
      window.dispatchEvent(new CustomEvent('itdasy:data-changed', {
        detail: { kind: 'aih_toggle', act, on: next },
      }));
    } catch (_e) { void _e; }
  }

  // ── 항목 라우터 ─────────────────────────────
  const _ROUTE_MAP = {
    dm:      'openDMAutoreplySettings',
    kakao:   'openKakaoHub',
    persona: '__personaHubOpen',   // [2026-05-25] SNS 캡션 + 페르소나 통합 시트
    hashtag: '__snsHashtagOpen',
    posts:   null,
    // caption 단독 라우트는 persona 시트의 'SNS 캡션 만들기' 옵션으로 흡수 (2026-05-25)
    // memo / capture 라우트는 잇비 채팅에서 직접 호출 (행 자체 제거됨, 2026-05-25)
    photoEditor: '__photoEditorOpen',   // 함수 매핑 — 아래 _route에서 공통 편집기 진입점으로 분기
  };

  function _canRoute(act) {
    if (act === 'posts') return typeof window.openFinishTab === 'function' || typeof window.showTab === 'function';
    if (act === 'photoEditor') return !!(window.PhotoEditor && typeof window.PhotoEditor.open === 'function');
    if (act === 'hashtag') return !!(window.SNSHashtag && typeof window.SNSHashtag.open === 'function');
    if (act === 'persona') return true;   // 항상 진입 가능 (옵션 가용성은 시트 안에서 분기)
    const fn = _ROUTE_MAP[act];
    return !!(fn && typeof window[fn] === 'function');
  }

  function _personaOption(k, t, sub, color) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.personaOpt = k;
    b.style.cssText = `text-align:left;padding:16px 18px;border:1px solid rgba(213,138,149,0.2);border-radius:16px;background:linear-gradient(135deg,#fffcfd,${color || '#fff5f7'});cursor:pointer;display:flex;flex-direction:column;gap:4px;`;
    b.innerHTML = `<div style="font-size:14px;font-weight:800;color:#191F28;letter-spacing:-0.2px;">${t}</div><div style="font-size:11.5px;color:#6B7684;">${sub}</div>`;
    return b;
  }

  function _hasPersonaReportData() {
    try {
      const raw = JSON.parse(localStorage.getItem('itdasy_latest_analysis') || '{}') || {};
      return !!(raw && (raw.tone_summary || raw.style_summary || raw.tone));
    } catch (_e) {
      return false;
    }
  }

  function _runPersonaRelearn() {
    if (typeof window.runPersonaAnalyze === 'function') return window.runPersonaAnalyze(true);
    if (typeof window.runAutoAnalysisAfterConnect === 'function') return window.runAutoAnalysisAfterConnect();
    if (window.showToast) window.showToast('분석 모듈 로드 중 — 1~2초 후 다시 눌러주세요');
    return null;
  }

  function _openPersonaReport() {
    if (_hasPersonaReportData() && typeof window.showDetailedAnalysis === 'function') {
      return window.showDetailedAnalysis();
    }
    if (typeof window.runPersonaAnalyze === 'function') {
      if (window.showToast) window.showToast('아직 분석 데이터가 없어요. 지금 분석을 시작할게요.');
      return window.runPersonaAnalyze(true);
    }
    if (window.showToast) window.showToast('인스타 연동 후 말투 분석을 진행해주세요');
    return null;
  }

  function _handlePersonaOption(opt) {
    if (opt === 'caption' && typeof window.openCaptionScenarioPopup === 'function') {
      return window.openCaptionScenarioPopup();
    }
    if (opt === 'relearn') return _runPersonaRelearn();
    if (opt === 'report') return _openPersonaReport();
    if (window.showToast) window.showToast('해당 기능을 찾을 수 없어요. 잠시 후 다시 시도해주세요');
    return null;
  }

  function _personaOptionsBox(close) {
    const optBox = document.createElement('div');
    optBox.style.cssText = 'display:flex;flex-direction:column;gap:10px;';
    optBox.appendChild(_personaOption('caption', '캡션 만들기', '사진 → 글·해시태그까지 한 번에', '#fff5f7'));
    optBox.appendChild(_personaOption('relearn', '말투 새로 분석', '최근 게시물로 다시 학습 (인스타 필요)', '#F7EFF0'));
    optBox.appendChild(_personaOption('report',  '분석 리포트 보기', '말투 패턴 · TOP5 · 이모지 · 해시태그', '#F0F9FF'));
    optBox.addEventListener('click', e => {
      const btn = e.target.closest('[data-persona-opt]');
      if (!btn) return;
      close();
      try { _handlePersonaOption(btn.dataset.personaOpt); }
      catch (_e) { if (window.showToast) window.showToast('화면을 여는 중 문제가 생겼어요'); }
    });
    return optBox;
  }

  // [2026-05-25] AI 페르소나 통합 시트 — 3개 옵션 (SNS 캡션 / 말투 새로 분석 / 분석 리포트 보기).
  function _openPersonaHub() {
    const id = 'aihPersonaSheet';
    let overlay = document.getElementById(id);
    if (overlay) { try { overlay.remove(); } catch (_e) { /* ignore */ } }
    overlay = document.createElement('div');
    overlay.id = id;
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9100;display:flex;align-items:flex-end;justify-content:center;';
    const sheet = document.createElement('div');
    sheet.style.cssText = 'width:100%;max-width:480px;background:#fff;border-radius:24px 24px 0 0;padding:24px 20px 36px;box-sizing:border-box;max-height:88vh;overflow-y:auto;';
    sheet.innerHTML = '<div style="width:36px;height:4px;background:#e0e0e0;border-radius:2px;margin:0 auto 20px;"></div><div style="font-size:17px;font-weight:800;color:#1a1a1a;margin-bottom:6px;">AI 페르소나</div><div style="font-size:12px;color:#888;margin-bottom:18px;line-height:1.5;">원장님 말투 학습으로 SNS·DM 톤을 일관되게 유지해요.</div>';
    const close = () => { try { overlay.remove(); } catch (_e) { /* ignore */ } };
    sheet.appendChild(_personaOptionsBox(close));
    overlay.appendChild(sheet);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
  }

  function _route(act) {
    const map = _ROUTE_MAP;
    if (act === 'persona') { _openPersonaHub(); return; }
    if (act === 'photoEditor') {
      if (typeof window.openPhotoEditorFromAction === 'function') {
        window.openPhotoEditorFromAction({ initial_tab: 'auto' });
        return;
      }
      try { window.PhotoEditor.open({}); }
      catch (_e) { if (window.showToast) window.showToast('편집기를 여는 중 문제가 생겼어요'); }
      return;
    }
    if (act === 'hashtag') {
      try { window.SNSHashtag.open(); }
      catch (err) {
        console.warn('[AIHub] 해시태그 매니저 열기 실패', err);
        if (window.showToast) window.showToast('해시태그 매니저를 여는 중 문제가 생겼어요');
      }
      return;
    }
    if (act === 'posts') {
      try {
        if (typeof window.openFinishTab === 'function') {
          window.openFinishTab();
        } else if (window.showToast) {
          window.showToast('게시물 관리 화면을 찾을 수 없어요');
        }
      } catch (e) {
        if (window.showToast) window.showToast('게시물 관리 진입 실패 — ' + (e && e.message || ''));
      }
      return;
    }
    const fnName = map[act];
    if (fnName && typeof window[fnName] === 'function') {
      try { window[fnName](); }
      catch (_e) { if (window.showToast) window.showToast('화면을 여는 중 문제가 생겼어요'); }
    } else if (window.showToast) {
      window.showToast('아직 준비 중이에요');
    }
  }

  // ── 열기/닫기 (시그니처 유지) ─────────────────────────────────
  function open() {
    const sheet = _ensureSheet();
    const card = sheet.querySelector('#aihCard');
    if (window.SheetAnim) window.SheetAnim.open(sheet, card);
    else sheet.style.display = 'block';
  }
  function close() {
    const sheet = document.getElementById('aiHubSheet');
    if (!sheet) return;
    const card = sheet.querySelector('#aihCard');
    if (window.SheetAnim) window.SheetAnim.close(sheet, card);
    else sheet.style.display = 'none';
  }

  window.openAiHub = open;
  window.closeAiHub = close;
  // 2026-05-01 ── 다른 모듈(myshop)에서 ai-hub 와 동일한 카운트 쓸 수 있게 export.
  // 이전엔 myshop 이 자체 키로 0 만 표시했지만 aihub 는 7개 중 3개 ON 으로 표시 → 불일치.
  window.aihGetOnCount = _onCount;
})();
