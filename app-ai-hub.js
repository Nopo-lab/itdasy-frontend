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
  // [2026-06-25] 빠른 안내(dmmenu) 마스터 토글 — localStorage 는 즉시 UI 표시용 캐시일 뿐.
  //   실제 on/off 는 백엔드 /shop/dm-menu 의 enabled 가 정본. (열 때 GET 으로 캐시 교정)
  const KEY_DMMENU = 'itdasy:aih:dmmenu_enabled';

  function _getToggle(key) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? true : v === 'true';
    } catch (_e) { return true; }
  }
  function _setToggle(key, on) {
    try { localStorage.setItem(key, on ? 'true' : 'false'); } catch (_e) { void _e; }
  }

  // [2026-07-13] 댓글 문의 응대 ON/OFF = 단일 진실원(app-comment-reply-queue.js 의 itdasy:crq_settings.enabled).
  //   목록 토글과 설정창 상태 스트립이 이 값 하나를 공유 — 별도 boolean 키 만들지 않음.
  function _getCommentOn() {
    try { var s = JSON.parse(localStorage.getItem('itdasy:crq_settings') || 'null'); return !s || s.enabled !== false; } catch (_e) { return true; }
  }
  function _setCommentOn(on) {
    try { var s = JSON.parse(localStorage.getItem('itdasy:crq_settings') || 'null') || {}; s.enabled = !!on; localStorage.setItem('itdasy:crq_settings', JSON.stringify(s)); } catch (_e) { void _e; }
  }

  function _esc(s) { return window._esc(s); } /* [2026-06-11] 중복 제거 — app-core 정본 위임 */

  // ── 행 정의 ──────────────────────────────────────────────
  // type: 'toggle' | 'tag' | 'badge' | 'plain'
  function _rows() {
    return [
      // [2026-06-11] 사진편집기 AI허브 노출 제거 — 작업실 내부 진입으로 통일
      // [2026-05-25] SNS 캡션 + AI 페르소나 통합 — 'AI 페르소나' 단일 진입점.
      //   클릭 시 바텀시트로 3개 옵션(SNS 캡션 / 말투 새로 분석 / 분석 리포트 보기).
      { act: 'hashtag', icon: 'ph-hash', boxColor: 'teal',
        name: '해시태그 매니저', meta: '업종별 추천 · 원터치 복사',
        type: 'plain' },
      { act: 'persona', icon: 'ph-user-circle-gear', boxColor: 'pink',
        name: '내 말투', meta: 'SNS 캡션 · 말투 분석 · 리포트',
        type: 'tag', tagText: '학습됨' },
      { act: 'dm', icon: 'ph-chat-circle-dots', boxColor: 'blue',
        name: 'DM 자동응답', meta: '인스타 DM → AI 자동 답장',
        type: 'toggle', toggleKey: KEY_DM },
      // [2026-07-10] 댓글 문의 응대 — DM 자동응답 바로 아래(나중에 DM 엔진에 통합 예정).
      // [2026-07-13] DM 처럼 목록 토글로 승격 — ON/OFF 는 여기서만(설정창엔 토글 없음).
      { act: 'comment', icon: 'ph-chat-teardrop-text', boxColor: 'coral',
        name: '댓글 문의 응대', meta: '게시물 댓글 문의 → 답글 + DM 유도',
        type: 'toggle' },
      { act: 'dmmenu', icon: 'ph-list-checks', boxColor: 'teal',
        name: '빠른 안내', meta: '손님 탭 버튼(예약·영업시간·가격…)',
        type: 'toggle', toggleKey: KEY_DMMENU },
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
    if (_getCommentOn()) n++;
    if (_getToggle(KEY_KAKAO)) n++;
    if (_getToggle(KEY_DMMENU)) n++;
    n += 1; // 페르소나 학습됨
    return n;
  }

  // ── 행 우측 영역 마크업 ────────────────────────────────────────
  function _rightHtml(row) {
    const chev = `<svg width="14" height="14" aria-hidden="true"><use href="#ic-chevron-right"/></svg>`;
    if (row.type === 'toggle') {
      const on = row.act === 'comment' ? _getCommentOn() : _getToggle(row.toggleKey);
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
            <div id="aihTitle" class="ms-sheet__title">잇비 · 자동화</div>
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
    let next;
    if (act === 'comment') {
      next = !_getCommentOn();
      _setCommentOn(next);
    } else {
      const key = act === 'dm' ? KEY_DM
        : (act === 'kakao' ? KEY_KAKAO : (act === 'dmmenu' ? KEY_DMMENU : null));
      if (!key) return;
      next = !_getToggle(key);
      _setToggle(key, next);
    }
    btn.classList.toggle('is-on', next);
    btn.setAttribute('aria-pressed', next ? 'true' : 'false');
    const sub = sheet.querySelector('#aihSub');
    if (sub) sub.textContent = `${_rows().length}가지 · ${_onCount()}개 켜짐`;
    try { window.hapticLight && window.hapticLight(); } catch (_e) { void _e; }
    // [2026-06-25] 빠른 안내만 백엔드 동기화 — 나머지(dm/kakao)는 기존대로 localStorage UI 토글.
    if (act === 'dmmenu') _syncDmMenuEnabled(next, btn, sheet);
    try {
      window.dispatchEvent(new CustomEvent('itdasy:data-changed', {
        detail: { kind: 'aih_toggle', act, on: next },
      }));
    } catch (_e) { void _e; }
  }

  // ── 빠른 안내 enabled 백엔드 반영 — 반드시 GET 먼저 → 그 객체에서 enabled 만 바꿔 PUT.
  //   (캐시를 PUT 소스로 쓰면 메뉴·인사멘트가 통째로 날아감. 동봉 소스 = GET 결과로 고정.) ──
  async function _syncDmMenuEnabled(on, btn, sheet) {
    try {
      const auth = window.authHeader ? window.authHeader() : {};
      const res = await window.apiFetch(window.apiUrl('/shop/dm-menu'), { headers: auth });
      const menu = await res.json().catch(() => null);
      if (!menu || typeof menu !== 'object' || !Array.isArray(menu.items)) {
        throw new Error('메뉴를 불러오지 못했어요');
      }
      menu.enabled = !!on; // enabled 만 변경, items/greeting/ice_breakers 는 GET 결과 그대로 동봉
      const put = await window.apiFetch(window.apiUrl('/shop/dm-menu'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify(menu),
      });
      if (!put.ok) throw new Error('HTTP ' + put.status);
    } catch (e) {
      // 실패 → UI/캐시 롤백
      _setToggle(KEY_DMMENU, !on);
      if (btn) {
        btn.classList.toggle('is-on', !on);
        btn.setAttribute('aria-pressed', (!on) ? 'true' : 'false');
      }
      const sub = sheet && sheet.querySelector('#aihSub');
      if (sub) sub.textContent = `${_rows().length}가지 · ${_onCount()}개 켜짐`;
      if (window.showToast) window.showToast('빠른 안내 ' + (on ? '켜기' : '끄기') + ' 실패 — 다시 시도해주세요');
    }
  }

  // ── 시트 열 때 백엔드 enabled 로 토글 캐시 교정 (localStorage 가 stale 일 수 있음) ──
  async function _refreshDmMenuToggle(sheet) {
    try {
      const res = await window.apiFetch(window.apiUrl('/shop/dm-menu'), { headers: window.authHeader ? window.authHeader() : {} });
      const menu = await res.json().catch(() => null);
      if (!menu || typeof menu.enabled === 'undefined') return;
      _setToggle(KEY_DMMENU, !!menu.enabled);
      const btn = sheet.querySelector('[data-toggle="dmmenu"]');
      if (btn) {
        btn.classList.toggle('is-on', !!menu.enabled);
        btn.setAttribute('aria-pressed', menu.enabled ? 'true' : 'false');
      }
      const sub = sheet.querySelector('#aihSub');
      if (sub) sub.textContent = `${_rows().length}가지 · ${_onCount()}개 켜짐`;
    } catch (_e) { void _e; }
  }

  // ── 항목 라우터 ─────────────────────────────
  const _ROUTE_MAP = {
    dm:      'openDMAutoreplySettings',
    comment: 'openCommentReplyQueue',   // [2026-07-10] 댓글 문의 응대 (extras lazy — _route 에서 로드 보장)
    dmmenu:  'openDMMenuSettings',
    kakao:   'openKakaoHub',
    persona: '__personaHubOpen',   // [2026-05-25] SNS 캡션 + 페르소나 통합 시트
    hashtag: '__snsHashtagOpen',
    posts:   null,
    // caption 단독 라우트는 persona 시트의 'SNS 캡션 만들기' 옵션으로 흡수 (2026-05-25)
    // memo / capture 라우트는 잇비 채팅에서 직접 호출 (행 자체 제거됨, 2026-05-25)
    photoEditor: '__photoEditorOpen',   // 함수 매핑 — 아래 _route에서 공통 편집기 진입점으로 분기
  };

  function _canRoute(act) {
    if (act === 'comment') return true;   // extras lazy — _route 에서 로드 보장 후 진입
    if (act === 'posts') return typeof window.openFinishTab === 'function' || typeof window.showTab === 'function';
    if (act === 'photoEditor') return !!(window.PhotoEditor && typeof window.PhotoEditor.open === 'function');
    if (act === 'hashtag') return !!(window.SNSHashtag && typeof window.SNSHashtag.open === 'function');
    if (act === 'persona') return true;   // 항상 진입 가능 (옵션 가용성은 시트 안에서 분기)
    const fn = _ROUTE_MAP[act];
    return !!(fn && typeof window[fn] === 'function');
  }

  function _route(act) {
    const map = _ROUTE_MAP;
    if (act === 'comment') {
      // extras 그룹(app-comment-reply-queue.js) 로드 보장 후 진입 — 첫 탭에도 열리게.
      const _open = function () {
        if (typeof window.openCommentReplyQueue === 'function') window.openCommentReplyQueue();
        else if (window.showToast) window.showToast('댓글 응대를 여는 중 문제가 생겼어요');
      };
      if (typeof window.openCommentReplyQueue === 'function') { _open(); return; }
      if (window.AppLoader && window.AppLoader.ensure) {
        Promise.resolve(window.AppLoader.ensure('extras')).then(_open).catch(_open);
      } else { _open(); }
      return;
    }
    if (act === 'persona') {
      if (typeof window.showDetailedAnalysis === 'function') window.showDetailedAnalysis();
      return;
    }
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
    _refreshDmMenuToggle(sheet); // 백엔드 enabled 로 빠른 안내 토글 교정
    _refreshCommentCount(sheet); // '댓글 문의 응대' 대기 건수 뱃지(원장이 놓치지 않게)
  }

  // 댓글 문의 대기 건수 → '댓글 문의 응대' 행에 뱃지(초안 생성 없이 count_only, 저비용)
  async function _refreshCommentCount(sheet) {
    try {
      const ig = window.WorkspaceAdapter && window.WorkspaceAdapter.instagram ? window.WorkspaceAdapter.instagram() : null;
      if (!ig || !ig.connected || !window.apiFetch) return;
      const res = await window.apiFetch(window.apiUrl('/instagram/comment-queue?count_only=1'), { headers: window.authHeader ? window.authHeader() : {} });
      const j = await res.json().catch(() => ({}));
      const n = (j && j.count) || 0;
      const right = sheet.querySelector('.ms-aih__row[data-act="comment"] .ms-aih__right');
      if (!right) return;
      const old = right.querySelector('.aih-crq-count'); if (old) old.remove();
      if (n > 0) {
        const b = document.createElement('span');
        b.className = 'aih-crq-count';
        b.textContent = n + '건 대기';
        b.style.cssText = 'font-size:11px;font-weight:700;color:#fff;background:' + (j.complaint > 0 ? '#DC2626' : '#BC6675') + ';border-radius:10px;padding:2px 9px;margin-right:6px;white-space:nowrap;';
        right.insertBefore(b, right.firstChild);
      }
    } catch (_e) { void _e; }
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
