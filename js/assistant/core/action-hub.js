/* 잇비 Action Hub (J-1 MVP · 2026-06-01)

   목적: 잇비 결과 메시지가 말로 끝나지 않고 "다음 행동" 버튼으로 이어지게 하는 공통층.
   이 모듈은 버튼 규격(정규화)·렌더·클릭 라우팅만 담당. 기능 자체는 기존 경로 재사용.

   액션 규격: { id, label, phase:'safe'|'confirm'|'danger', kind, payload, route?:'hub'|'photo'|'brief' }

   안전 정책(v1):
   - safe   : 화면 이동 / 캡션·문자 초안 / 복사 / 템플릿 보기 / 빈시간 조회 / 사진편집기 열기 → 즉시 연결
   - confirm: 고객기록 저장 / 예약 생성·변경 / 매출 기록 → 자동 실행 금지. 기존 confirm·pending 경로로만, 없으면 안내
   - danger : 실제 발송·게시·자동예약·자동 고객추측 → 실행 차단. "안전 확인 후 제공 예정" 안내만
   재사용: window.PhotoEditor / openInstagramPreview / openCalendarView / openCustomers /
           openRevenueHub / showTab / ItdasyDailyBriefing.runAction. */
(function () {
  'use strict';
  if (window.ItdasyActionHub) return;

  // kind → 안전 단계. (명시 phase 가 있으면 그게 우선)
  var PHASE = {
    // safe — 조회/이동/초안/복사/열기
    copy_caption: 'safe', open_photo_editor: 'safe', open_template_panel: 'safe',
    open_calendar: 'safe', open_customer: 'safe', open_revenue: 'safe', open_workshop: 'safe',
    show_unlinked_photos: 'safe', show_empty_slots: 'safe', open_instagram: 'safe', export_image: 'safe',
    chat_suggest: 'safe',  // 잇비 입력창에 문장 채워 보냄(초안/조회 등 기존 경로로 위임 — 발송/생성 아님)
    // safe — 브리핑 추천(T-115: 화면이동/초안 경로만)
    retouch_draft: 'safe', open_unlinked_photos: 'safe', open_unrecorded: 'safe',
    open_at_risk: 'safe', open_empty_slot: 'safe',
    // confirm — 자동 실행 금지, 확인/pending 경로로만
    save_photo_to_customer: 'confirm', create_booking: 'confirm', record_revenue: 'confirm',
    save_treatment: 'confirm', cancel_booking: 'confirm', update_booking: 'confirm',
    // danger — v1 실행 차단
    send_message: 'danger', send_bulk_message: 'danger', send_dm: 'danger', reply_dm: 'danger',
    publish_instagram: 'danger', auto_book: 'danger', auto_attach_customer: 'danger',
  };

  var DANGER_MSG = '이 기능은 안전 확인 후 제공 예정입니다. (실제 발송·게시·자동 처리는 잇비가 임의로 실행하지 않아요)';
  var CONFIRM_MSG = {
    save_photo_to_customer: '고객 기록에 저장할까요? 고객을 확인한 뒤 "저장해줘"라고 말씀해 주세요. (자동 저장은 하지 않아요)',
    create_booking: '예약은 확인 카드에서 잡을 수 있어요. "○○님 ○시 예약 잡아줘"처럼 말씀해 주세요. (자동 예약은 하지 않아요)',
    record_revenue: '매출 기록은 완료 처리/확인 단계가 필요해요. 예약 화면에서 정리할 수 있어요.',
  };

  function _phaseOf(a) {
    if (a && (a.phase === 'safe' || a.phase === 'confirm' || a.phase === 'danger')) return a.phase;
    var byKind = PHASE[(a && a.kind) || (a && a.id)];
    if (byKind) return byKind;
    if (a && (a.safety === 'confirm' || a.safety === 'danger' || a.safety === 'safe')) return a.safety;
    return 'safe';
  }

  function isDangerAction(a) { return _phaseOf(a) === 'danger'; }

  // 느슨한 액션들 → 표준 규격으로. id/label 없으면 제외.
  function normalizeActions(actions, defaultRoute) {
    if (!Array.isArray(actions)) return [];
    var out = [];
    for (var i = 0; i < actions.length; i++) {
      var a = actions[i]; if (!a) continue;
      var id = a.id || a.kind; var label = a.label;
      if (!id || !label) continue;
      out.push({
        id: String(id), label: String(label), kind: String(a.kind || a.id),
        phase: _phaseOf(a), payload: a.payload || {}, route: a.route || defaultRoute || 'hub',
      });
    }
    return out;
  }

  var _ATTR = { hub: 'data-asst-hub-act', photo: 'data-asst-photo-act', brief: 'data-asst-brief-act' };
  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function _btnStyle(phase) {
    var base = 'padding:9px 16px;border-radius:999px;cursor:pointer;font-size:13px;font-weight:600;';
    if (phase === 'confirm') return base + 'border:0.5px solid #C9D2DB;background:#F2F4F6;color:#3182F6;';
    if (phase === 'danger') return base + 'border:0.5px dashed #D1D6DB;background:#FAFAFB;color:#8B95A1;';
    return base + 'border:0.5px solid #E5E8EB;background:#FFFFFF;color:#4E5968;';
  }

  // 정규화된 액션 배열 → 버튼 HTML. idx = _history 인덱스(클릭 시 메시지 역참조).
  function renderActionHub(actions, opts) {
    var list = normalizeActions(actions, (opts && opts.defaultRoute) || 'hub');
    if (!list.length) return '';
    var idx = (opts && opts.idx != null) ? opts.idx : '';
    var btns = list.map(function (a) {
      var attr = _ATTR[a.route] || _ATTR.hub;
      return '<button ' + attr + '="' + _esc(idx) + ':' + _esc(a.id) + '" data-hub-phase="' + a.phase +
        '" style="' + _btnStyle(a.phase) + '">' + _esc(a.label) + '</button>';
    }).join('');
    return '<div class="asst-chips asst-chips--hub" style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px;">' + btns + '</div>';
  }

  function _nav(fn) { try { if (typeof fn === 'function') { fn(); return true; } } catch (_e) { void 0; } return false; }
  function _copy(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(String(text || '')); return true; }
    } catch (_e) { void 0; }
    return false;
  }

  // 브리핑 kind 는 기존 T-115 라우팅(daily-briefing.runAction)에 위임 — 안전 경로 유지.
  var BRIEF_KINDS = { retouch_draft: 1, open_unlinked_photos: 1, open_unrecorded: 1, open_at_risk: 1, open_empty_slot: 1 };

  // 클릭 라우팅. 반환 { message?, chatInput?, navigated?, blocked? }.
  function handleActionClick(action, _deps) {
    if (!action || !action.kind) return { message: '' };
    var phase = _phaseOf(action);
    if (phase === 'danger') return { blocked: true, message: DANGER_MSG };
    var kind = action.kind; var p = action.payload || {};

    if (BRIEF_KINDS[kind] && window.ItdasyDailyBriefing && typeof window.ItdasyDailyBriefing.runAction === 'function') {
      return window.ItdasyDailyBriefing.runAction(action) || { message: '' };
    }
    if (phase === 'confirm') return _confirmMsg(kind, p);
    return _safeRoute(kind, p);
  }

  function _confirmMsg(kind, p) {
    // 고객기록 저장은 고객 인지형 안내(자동 저장 X) — 실제 저장은 기존 pending/confirmSave 경로(사용자 "저장해줘").
    if (kind === 'save_photo_to_customer') {
      return { message: p.customerName
        ? ('이 사진을 ' + p.customerName + '님 기록에 저장할까요? "저장해줘"라고 말씀해 주세요. (자동 저장은 하지 않아요)')
        : '고객을 먼저 선택해 주세요. 고객을 선택하면 이 보정본을 기록에 저장할 수 있어요.' };
    }
    return { message: CONFIRM_MSG[kind] || '확인 단계가 필요한 작업이에요. 확인 후 진행할 수 있어요.' };
  }

  // safe 라우팅 (기존 화면이동/복사/초안 경로 위임)
  function _safeRoute(kind, p) {
    switch (kind) {
      case 'chat_suggest':
        return { chatInput: p.text || p.chatInput || '' };
      case 'copy_caption':
        return { message: _copy(p.caption || p.text || '') ? '캡션을 복사했어요. 붙여넣어 사용하세요.' : '복사할 캡션이 없어요.' };
      case 'open_photo_editor':
        _nav(function () { window.PhotoEditor && window.PhotoEditor.open && window.PhotoEditor.open({ src: p.dataUrl, initial_tab: p.tab || 'tune' }); });
        return { navigated: true };
      case 'open_template_panel':
        _nav(function () {
          // [TPL-3] 추천 id 있으면 템플릿 갤러리를 추천 3개 상단 고정으로 연다.
          var recos = (p.recommendedIds && p.recommendedIds.length) ? p.recommendedIds : null;
          if (recos && window.PhotoEditorTemplatesV2 && typeof window.PhotoEditorTemplatesV2.open === 'function') {
            window.PhotoEditorTemplatesV2.open({ recommendedIds: recos });
            return;
          }
          var PE = window.PhotoEditor; var pe = PE && PE._internal;
          // 편집기가 이미 열려 있으면 사진 유지한 채 탭만 전환, 아니면 src 로 새로 열기.
          if (pe && typeof pe.applyStatePatch === 'function' && pe.getState && pe.getState()) pe.applyStatePatch({ activeTab: 'template' });
          else if (PE && PE.open) PE.open({ src: p.dataUrl, initial_tab: 'template' });
        });
        return { navigated: true, message: (p.recommendedIds && p.recommendedIds.length) ? '추천 템플릿을 열었어요.' : '템플릿 탭을 열었어요.' };
      case 'open_instagram':
        _nav(function () { window.openInstagramPreview && window.openInstagramPreview({ src: p.dataUrl, ratio: p.ratio || '4:5', caption: p.caption || '', enableUpload: true }); });
        return { navigated: true };
      case 'export_image':
        return { message: _exportImage(p.dataUrl) ? '이미지를 저장했어요.' : '저장할 이미지가 없어요.' };
      case 'open_calendar': case 'show_empty_slots':
        _nav(function () { window.openCalendarView && window.openCalendarView(); });
        return { navigated: true, message: '예약 화면을 열었어요.' };
      case 'open_customer':
        _nav(function () { window.openCustomers && window.openCustomers(); });
        return { navigated: true, message: '고객 화면을 열었어요.' };
      case 'open_revenue':
        _nav(function () { window.openRevenueHub && window.openRevenueHub(); });
        return { navigated: true, message: '매출 화면을 열었어요.' };
      case 'open_workshop': case 'show_unlinked_photos':
        _nav(function () { window.showTab && window.showTab('workshop'); });
        return { navigated: true, message: '작업실을 열었어요.' };
      default:
        return { message: '' };
    }
  }

  function _exportImage(dataUrl) {
    if (!dataUrl) return false;
    try {
      var a = document.createElement('a');
      a.href = dataUrl; a.download = 'itdasy-' + Date.now() + '.jpg';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      return true;
    } catch (_e) { return false; }
  }

  // context → 기본 액션 셋(향후 J-2~J-5 재사용). type 별 안전 기본 버튼만.
  function buildCommonActions(context) {
    var c = context || {}; var acts = [];
    if (c.type === 'photo_result') {
      if (c.caption) acts.push({ id: 'copy_caption', kind: 'copy_caption', label: '캡션 복사', payload: { caption: c.caption } });
      acts.push({ id: 'open_template_panel', kind: 'open_template_panel', label: '템플릿 보기', payload: { dataUrl: c.dataUrl } });
      acts.push({ id: 'save_photo_to_customer', kind: 'save_photo_to_customer', label: '고객기록에 저장', payload: {} });
    }
    return normalizeActions(acts, 'hub');
  }

  window.ItdasyActionHub = { PHASE, normalizeActions, isDangerAction, renderActionHub, handleActionClick, buildCommonActions };
})();
