/* ───────────────────────────────────────────────────────────
   app-comment-reply-queue.js — 인스타 댓글 문의 응대 큐 (스캐폴딩)
   2026-07-10 신규 · 브랜치 feat/ig-comment-reply

   목적: "모든 댓글" 아니라 가격·예약·위치 문의 댓글만 골라 대댓글 + DM 퍼널.
   디자인: app-dm-confirm-queue.js 와 동일 언어(카드 r18·버블 #F2F4F6 꼬리·CTA #191F28·로즈 #BC6675).
   지금 단계: 백엔드 실연동은 Meta manage_comments 심사 전이라 SEED 데이터로 UI/동작만 검증.
   진입: window.openCommentReplyQueue()  · 플래그 window.ITDASY_IG_COMMENT_REPLY
   ─────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var ID = 'commentReplyQueueScreen';
  var _view = 'queue';           // 'queue' | 'settings'
  var _filter = 'all';

  function _esc(s) { return (window._esc ? window._esc(String(s == null ? '' : s)) : String(s == null ? '' : s)); }
  function _toast(m) { if (window.showToast) window.showToast(m); }
  function _haptic() { try { window.hapticLight && window.hapticLight(); } catch (_e) { void _e; } }

  // ── 시드 데이터 (실연동 전 UI 검증용) — 백엔드 붙으면 GET /instagram/comment-queue 로 교체 ──
  var SEED = [
    { id: 'c1', name: '@minji_nail', av: '민', intent: 'price', media: '내 속눈썹 게시물에 달린 댓글', likes: 12, waiting: 0,
      text: '여기 속눈썹 얼마예요? 예약도 되나요?',
      publicDraft: '문의 감사해요! 자세한 내용 DM으로 보내드렸어요, 편하게 봐주세요',
      dmDraft: '속눈썹 벨벳 5만원이에요. 예약은 여기서 → naver.me/xxxx' },
    { id: 'c2', name: '@yuna_daily', av: '유', intent: 'booking', media: '내 젤네일 게시물에 달린 댓글', likes: 3, waiting: 8,
      text: '이거 예약 어디서 해요?? 이번주 토요일 가능한가요',
      publicDraft: '예약 도와드릴게요, DM 확인해 주세요',
      dmDraft: '토요일 오후 2시·4시 자리 있어요. 예약 링크 → naver.me/xxxx' },
    { id: 'c3', name: '@soo_beauty', av: '수', intent: 'location', media: '내 왁싱 게시물에 달린 댓글', likes: 1, waiting: 21,
      text: '위치가 어디예요? 주차 되나요?',
      publicDraft: '위치·오시는 길 DM으로 보냈어요',
      dmDraft: '서울 강남구 테헤란로 12길 34, 5층이에요. 건물 주차 2시간 무료!' }
  ];

  var _INTENT_KO = { price: '가격 문의', booking: '예약 문의', location: '위치 문의', hours: '영업시간 문의' };
  var _FILTERS = [
    { k: 'all', label: '전체' }, { k: 'price', label: '가격' },
    { k: 'booking', label: '예약' }, { k: 'location', label: '위치' }
  ];

  var ITEMS = SEED.slice();   // 렌더 대상 — 실연동 성공 시 실댓글로 교체
  var _realMode = false;      // true = 실제 인스타 댓글 로드됨
  var _loading = false;

  // 샵 설정값(작업실 설정과 공유하는 itdasy:shop_* 키) — DM 상세에 사용
  function _shop(k, fb) { try { return localStorage.getItem('itdasy:shop_' + k) || fb || ''; } catch (_e) { return fb || ''; } }

  // 의도별 답장 초안 (공개=짧게 DM유도 / DM=상세, 샵설정 반영)
  function _drafts(intent) {
    var book = _shop('book', ''), addr = _shop('addr', _shop('location', '')), hours = _shop('hours', ''), phone = _shop('phone', '');
    var link = book ? ('\n예약은 여기서 → ' + book) : (phone ? ('\n예약 문의 → ' + phone) : '');
    if (intent === 'price') return { publicDraft: '문의 감사해요! 자세한 가격 DM으로 보내드렸어요, 편하게 봐주세요', dmDraft: '가격 안내드릴게요' + link };
    if (intent === 'booking') return { publicDraft: '예약 도와드릴게요, DM 확인해 주세요', dmDraft: '예약 도와드릴게요!' + link };
    if (intent === 'location') return { publicDraft: '위치·오시는 길 DM으로 보냈어요', dmDraft: (addr || '위치 안내드릴게요') + (book ? ('\n예약 → ' + book) : '') };
    if (intent === 'hours') return { publicDraft: '영업시간 DM으로 보내드렸어요', dmDraft: (hours ? ('영업시간: ' + hours) : '영업시간 안내드릴게요') + (book ? ('\n예약 → ' + book) : '') };
    return { publicDraft: '문의 감사해요! DM으로 안내드렸어요', dmDraft: '문의 주셔서 감사해요' + (book ? ('\n예약 → ' + book) : '') };
  }

  // 실 API 아이템 → 렌더 형식. 서버 페르소나 초안(public_draft/dm_draft) 우선, 없으면 템플릿 폴백.
  function _mapReal(it) {
    var d = _drafts(it.intent);
    return { id: it.comment_id, commentId: it.comment_id, name: it.username ? ('@' + it.username) : '손님',
      av: (it.username || '?').slice(0, 1), intent: it.intent, media: '게시물 댓글', likes: it.like_count || 0,
      waiting: 0, thumb: it.media_thumb || '', text: it.text || '',
      publicDraft: it.public_draft || d.publicDraft, dmDraft: it.dm_draft || d.dmDraft, _real: true };
  }

  // ── 인라인 아이콘 (스프라이트 밖은 svg, 봇은 #ic-bot) ──
  function _svg(inner, o) { o = o || {}; return '<svg width="' + (o.w || 14) + '" height="' + (o.h || o.w || 14) + '" viewBox="0 0 24 24" fill="' + (o.fill || 'none') + '" stroke="' + (o.stroke || 'currentColor') + '" stroke-width="' + (o.sw || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>'; }
  var IC = {
    gear: _svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>', { w: 19 }),
    ig: _svg('<rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>', { w: 12 }),
    camera: _svg('<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>', { w: 16 }),
    heart: _svg('<path d="M12 21s-7.5-4.6-10-9.3C.6 8.9 2 5.5 5.2 5.5c2 0 3.2 1.3 3.8 2.3.6-1 1.8-2.3 3.8-2.3 3.2 0 4.6 3.4 3.2 6.2C19.5 16.4 12 21 12 21z"/>', { w: 13, fill: 'currentColor', stroke: 'none' }),
    comment: _svg('<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4L3 21l1.1-4.1A8.4 8.4 0 1 1 21 11.5z"/>', { w: 12 }),
    mail: _svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>', { w: 12 }),
    send: _svg('<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>', { w: 15 })
  };
  function _botAvatar() {
    return '<div style="width:30px;height:30px;border-radius:50%;background:#F7EFF0;color:#BC6675;flex-shrink:0;display:flex;align-items:center;justify-content:center;"><svg width="16" height="16" aria-hidden="true"><use href="#ic-bot"/></svg></div>';
  }

  function _draftBlock(icon, label, text) {
    return '<div style="font-size:10.5px;color:#8B95A1;font-weight:600;margin-bottom:3px;display:flex;align-items:center;gap:4px;">' + icon + label + '</div>' +
      '<div style="background:#F2F4F6;color:#191F28;border-radius:13px;border-top-left-radius:4px;padding:10px 13px;font-size:13.5px;line-height:1.5;white-space:pre-wrap;word-break:break-word;">' + _esc(text) + '</div>';
  }

  function _cardHtml(it) {
    return '<div class="crq-item" data-id="' + _esc(it.id) + '" style="position:relative;background:#fff;border:.5px solid #E5E8EB;border-radius:18px;padding:14px;margin-bottom:10px;">' +
      '<span style="position:absolute;top:13px;right:13px;display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;color:#8B95A1;background:#F2F4F6;border-radius:9px;padding:3px 8px;">' + IC.ig + '인스타 댓글</span>' +
      // 발신자
      '<div style="display:flex;align-items:center;gap:9px;margin-bottom:11px;">' +
        '<div style="width:36px;height:36px;border-radius:50%;background:#F2F4F6;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#8B95A1;font-size:13px;font-weight:700;">' + _esc(it.av) + '</div>' +
        '<div style="flex:1;min-width:0;">' +
          '<div style="display:flex;align-items:center;gap:6px;"><span style="font-size:14px;font-weight:700;color:#191F28;">' + _esc(it.name) + '</span>' +
            '<span style="font-size:10px;font-weight:700;color:#BC6675;background:#F7EFF0;border-radius:8px;padding:2px 7px;">문의</span></div>' +
          '<div style="font-size:11px;color:#8B95A1;margin-top:1px;">' + (it.waiting <= 0 ? '방금' : it.waiting + '분 전') + ' · ' + _esc(_INTENT_KO[it.intent] || '문의') + '</div>' +
        '</div>' +
      '</div>' +
      // 게시물 + 좋아요
      '<div style="display:flex;align-items:center;gap:8px;background:#F7F8FA;border-radius:12px;padding:7px 10px;margin-bottom:10px;">' +
        (it.thumb
          ? '<div style="width:34px;height:34px;border-radius:8px;flex-shrink:0;background:#E5E8EB center/cover no-repeat;background-image:url(' + _esc(it.thumb) + ');"></div>'
          : '<div style="width:34px;height:34px;border-radius:8px;background:#E5E8EB;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#B0B8C1;">' + IC.camera + '</div>') +
        '<span style="font-size:11.5px;color:#8B95A1;flex:1;">' + _esc(it.media) + '</span>' +
        '<span style="display:inline-flex;align-items:center;gap:3px;font-size:11.5px;color:#8B95A1;font-weight:600;">' + IC.heart + it.likes + '</span>' +
      '</div>' +
      // 손님 댓글 원문
      '<div style="background:#fff;border:.5px solid #E5E8EB;color:#191F28;border-radius:13px;border-top-left-radius:4px;padding:10px 13px;font-size:13.5px;line-height:1.5;margin-bottom:12px;">' + _esc(it.text) + '</div>' +
      // 잇비 추천 답장 (공개 + 비공개)
      '<div style="display:flex;gap:8px;align-items:flex-start;">' + _botAvatar() +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:11px;color:#8B95A1;font-weight:600;margin-bottom:5px;">잇비 추천 답장</div>' +
          _draftBlock(IC.comment, '공개 답글 · 댓글에 달림', it.publicDraft) +
          '<div style="height:9px;"></div>' +
          _draftBlock(IC.mail, '비공개 DM · 상세', it.dmDraft) +
        '</div>' +
      '</div>' +
      // 액션
      '<div style="display:flex;gap:8px;margin-top:13px;">' +
        '<button class="crq-send" data-id="' + _esc(it.id) + '" style="flex:1;padding:11px;border:none;background:#191F28;color:#fff;font-weight:700;font-size:13px;border-radius:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;">' + IC.send + '답글 보내기</button>' +
        '<button class="crq-edit" data-id="' + _esc(it.id) + '" style="padding:11px 14px;border:1px solid #E5E8EB;background:#fff;color:#191F28;font-weight:600;font-size:13px;border-radius:13px;cursor:pointer;">수정</button>' +
        '<button class="crq-discard" data-id="' + _esc(it.id) + '" style="padding:11px 14px;border:1px solid #E5E8EB;background:#fff;color:#8B95A1;font-weight:600;font-size:13px;border-radius:13px;cursor:pointer;">무시</button>' +
      '</div>' +
    '</div>';
  }

  function _tabsHtml() {
    return '<div style="display:flex;gap:16px;margin-bottom:14px;border-bottom:.5px solid #F2F4F6;">' +
      _FILTERS.map(function (f) {
        var n = f.k === 'all' ? ITEMS.length : ITEMS.filter(function (x) { return x.intent === f.k; }).length;
        var on = _filter === f.k;
        return '<button class="crq-tab" data-filter="' + f.k + '" style="background:none;border:none;cursor:pointer;font-family:inherit;font-size:13.5px;font-weight:' + (on ? 700 : 500) + ';color:' + (on ? '#191F28' : '#8B95A1') + ';padding-bottom:8px;border-bottom:2px solid ' + (on ? '#191F28' : 'transparent') + ';">' + f.label + ' ' + n + '</button>';
      }).join('') + '</div>';
  }

  function _banner(bg, brd, fg, msg) {
    return '<div style="display:flex;align-items:flex-start;gap:8px;background:' + bg + ';border:.5px solid ' + brd + ';border-radius:12px;padding:10px 12px;margin-bottom:12px;">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="' + fg + '" stroke-width="2" stroke-linecap="round" style="flex-shrink:0;margin-top:1px;" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>' +
      '<span style="font-size:11.5px;color:' + fg + ';line-height:1.5;">' + msg + '</span></div>';
  }
  function _demoBanner() {
    if (_loading) return _banner('#F2F4F6', '#E5E8EB', '#4E5968', '실제 인스타 댓글을 불러오는 중…');
    if (_realMode) return _banner('#E7F6EF', '#A9DFC6', '#0F766E', '<b>실제 인스타 댓글</b>이에요. 문의(가격·예약·위치)만 골라 보여드려요.');
    return _banner('#FFF7ED', '#FED7AA', '#9A3412', '지금 보이는 댓글은 <b>예시</b>예요. 실제 댓글을 불러오려면 <b>인스타 연동 + 댓글 권한</b>이 필요해요. (연동돼도 문의 댓글이 없으면 예시가 보여요)');
  }
  function _queueBody() {
    var items = ITEMS.filter(function (it) { return _filter === 'all' || it.intent === _filter; });
    var cards = items.length ? items.map(_cardHtml).join('') :
      '<div style="text-align:center;color:#C9CDD4;font-size:13px;padding:40px 0;">이 조건의 문의 댓글이 없어요</div>';
    return _demoBanner() + _tabsHtml() + cards +
      '<div style="font-size:11px;color:#C9CDD4;text-align:center;margin-top:12px;">애매한 댓글은 큐에 안 올라와요 · 확실한 문의만</div>';
  }

  function _settingsBody() {
    function _chip(on, label) {
      return on
        ? '<span style="font-size:13px;font-weight:600;padding:7px 14px;border-radius:14px;background:#F7EFF0;color:#BC6675;">' + label + '</span>'
        : '<span style="font-size:13px;font-weight:500;padding:7px 14px;border-radius:14px;background:#F7F8FA;color:#C9CDD4;border:.5px solid #F2F4F6;">' + label + '</span>';
    }
    function _toggle(on) {
      return '<div style="width:46px;height:27px;border-radius:14px;background:' + (on ? '#191F28' : '#E5E8EB') + ';position:relative;flex-shrink:0;"><span style="position:absolute;top:3px;' + (on ? 'right:3px' : 'left:3px') + ';width:21px;height:21px;border-radius:50%;background:#fff;"></span></div>';
    }
    return '<div style="background:#fff;border-radius:16px;padding:4px 2px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:11px 2px;border-bottom:.5px solid #F2F4F6;">' +
        '<div><div style="font-size:14px;font-weight:600;">댓글 문의 자동 응대</div><div style="font-size:11.5px;color:#8B95A1;margin-top:1px;">문의성 댓글만 골라 대댓글</div></div>' + _toggle(true) + '</div>' +
      '<div style="padding:13px 2px 11px;border-bottom:.5px solid #F2F4F6;">' +
        '<div style="font-size:12px;color:#4E5968;font-weight:600;margin-bottom:9px;">어떤 문의에 답할까</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:7px;">' + _chip(true, '가격') + _chip(true, '예약') + _chip(true, '위치') + _chip(false, '영업시간') + '</div></div>' +
      '<div style="padding:13px 2px 11px;border-bottom:.5px solid #F2F4F6;">' +
        '<div style="font-size:12px;color:#4E5968;font-weight:600;margin-bottom:9px;">응대 방식</div>' +
        '<div style="display:flex;background:#F2F4F6;border-radius:12px;padding:3px;">' +
          '<span style="flex:1;text-align:center;font-size:13px;font-weight:700;padding:8px;border-radius:9px;background:#fff;color:#191F28;">검토 후 발송</span>' +
          '<span style="flex:1;text-align:center;font-size:13px;font-weight:500;padding:8px;color:#8B95A1;">바로 발송</span></div>' +
        '<div style="font-size:11px;color:#C9CDD4;margin-top:6px;">공개 노출이라 기본은 검토 모드 권장</div></div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:13px 2px 4px;">' +
        '<span style="font-size:14px;">좋아요 많은 문의 우선</span>' +
        '<span style="display:inline-flex;align-items:center;gap:4px;font-size:13px;color:#4E5968;font-weight:600;color:#BC6675;">' + IC.heart + ' 3개 이상</span></div>' +
      '<button class="crq-save" style="width:100%;margin-top:16px;background:#191F28;color:#fff;border:none;border-radius:13px;padding:13px;font-size:14px;font-weight:700;cursor:pointer;">저장</button>' +
    '</div>';
  }

  function _render() {
    var el = document.getElementById(ID);
    if (!el) return;
    var body = el.querySelector('.ss-body');
    var title = el.querySelector('.crq-title');
    if (title) title.textContent = _view === 'settings' ? '댓글 문의 응대 설정' : '댓글 문의 응대';
    var gear = el.querySelector('.crq-gear');
    if (gear) gear.style.visibility = _view === 'settings' ? 'hidden' : 'visible';
    if (body) body.innerHTML = _view === 'settings' ? _settingsBody() : _queueBody();
  }

  function _ensureMounted() {
    var el = document.getElementById(ID);
    if (el) return el;
    el = document.createElement('div');
    el.id = ID;
    el.className = 'subscreen-overlay';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML =
      '<header class="ss-topbar">' +
        '<button type="button" class="ss-back" data-crq-back aria-label="뒤로"><svg width="14" height="14" aria-hidden="true"><use href="#ic-chevron-left"/></svg></button>' +
        '<div class="ss-title crq-title">댓글 문의 응대</div>' +
        '<button type="button" class="crq-gear" aria-label="설정" style="margin-left:auto;background:none;border:none;cursor:pointer;color:#4E5968;display:inline-flex;align-items:center;padding:4px;">' + IC.gear + '</button>' +
      '</header>' +
      '<div class="ss-body" style="padding:14px;"></div>';
    document.body.appendChild(el);

    // 이벤트 위임
    el.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('button') : null;
      if (!t) return;
      if (t.hasAttribute('data-crq-back')) { _haptic(); if (_view === 'settings') { _view = 'queue'; _render(); } else { closeCommentReplyQueue(); } return; }
      if (t.classList.contains('crq-gear')) { _haptic(); _view = 'settings'; _render(); return; }
      if (t.classList.contains('crq-save')) { _haptic(); _toast('설정을 저장했어요'); _view = 'queue'; _render(); return; }
      if (t.classList.contains('crq-tab')) { _filter = t.getAttribute('data-filter'); _render(); return; }
      var id = t.getAttribute('data-id');
      if (t.classList.contains('crq-send')) { _haptic(); _sendReply(id); return; }
      if (t.classList.contains('crq-edit')) { _haptic(); _toast('초안 수정은 붙일 때 연결돼요 (스캐폴딩)'); return; }
      if (t.classList.contains('crq-discard')) { _haptic(); _removeItem(id); _toast('이 댓글은 응대하지 않아요'); return; }
    });
    return el;
  }

  function _removeItem(id) {
    var i = ITEMS.findIndex(function (x) { return x.id === id; });
    if (i >= 0) ITEMS.splice(i, 1);
    _render();
  }
  function _sendReply(id) {
    var it = ITEMS.find(function (x) { return x.id === id; });
    if (!it) return;
    if (it._real && it.commentId && window.apiFetch) {
      // 실제 인스타: 공개답글 + 비공개 DM 발송
      _removeItem(id);
      _toast('답글 보내는 중…');
      var auth = window.authHeader ? window.authHeader() : {};
      window.apiFetch(window.apiUrl('/instagram/comment-reply'), {
        method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, auth),
        body: JSON.stringify({ comment_id: it.commentId, public_text: it.publicDraft, dm_text: it.dmDraft })
      }).then(function (r) { return r.json().catch(function () { return {}; }); })
        .then(function (j) { _toast(j && j.ok ? ('공개답글 달림 · DM 전송됨 (' + it.name + ')') : ('일부 실패 — ' + JSON.stringify((j && (j.public || j.dm)) || j).slice(0, 80))); })
        .catch(function () { _toast('발송 실패 — 다시 시도해 주세요'); });
      return;
    }
    // 시드(예시): 목업 발송
    _removeItem(id);
    _toast('공개답글 달림 · DM 전송됨 (' + it.name + ') · 예시');
  }

  // 실제 인스타 댓글 로드 — 연동+권한 있으면 문의 댓글로 큐 교체, 아니면 시드 유지.
  function _loadReal() {
    var ig = window.WorkspaceAdapter && window.WorkspaceAdapter.instagram ? window.WorkspaceAdapter.instagram() : null;
    var connected = ig ? ig.connected : false;
    if (!connected || !window.apiFetch) { _realMode = false; ITEMS = SEED.slice(); return; }
    _loading = true; _render();
    var auth = window.authHeader ? window.authHeader() : {};
    window.apiFetch(window.apiUrl('/instagram/comment-queue'), { headers: auth })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (j) {
        _loading = false;
        var arr = (j && j.items) || [];
        if (arr.length) { ITEMS = arr.map(_mapReal); _realMode = true; }
        else { ITEMS = SEED.slice(); _realMode = false; }   // 권한 없음/문의 댓글 0 → 시드 폴백
      })
      .catch(function () { _loading = false; ITEMS = SEED.slice(); _realMode = false; })
      .then(function () { if (_view === 'queue') _render(); });
  }

  function openCommentReplyQueue() {
    if (window.ITDASY_IG_COMMENT_REPLY === false) { _toast('댓글 응대는 준비 중이에요'); return; }
    var el = _ensureMounted();
    _view = 'queue'; _filter = 'all';
    ITEMS = SEED.slice(); _realMode = false; _loading = false;
    _render();
    _loadReal();   // 연동됐으면 실댓글로 교체(비동기)
    el.classList.add('is-open');
    el.setAttribute('aria-hidden', 'false');
    if (window._registerSheet) window._registerSheet('crq', closeCommentReplyQueue);
    if (window._markSheetOpen) window._markSheetOpen('crq');
  }
  function closeCommentReplyQueue() {
    var el = document.getElementById(ID);
    if (!el) return;
    el.classList.remove('is-open');
    el.setAttribute('aria-hidden', 'true');
    if (window._markSheetClosed) window._markSheetClosed('crq');
  }

  window.openCommentReplyQueue = openCommentReplyQueue;
  window.closeCommentReplyQueue = closeCommentReplyQueue;

  // [dev] ?crq=1 이면 우측하단 테스트 진입 버튼(로그인 후 탭). 실배포 진입점은 연동 허브에 별도 연결 예정.
  try {
    var _crqDev = false;
    try {
      if (/[?&]crq=1/.test(location.search)) { localStorage.setItem('itdasy_crq', '1'); _crqDev = true; }
      else { _crqDev = localStorage.getItem('itdasy_crq') === '1'; }
    } catch (_ls) { _crqDev = /[?&]crq=1/.test(location.search); }
    if (_crqDev) {
      var _mountBtn = function () {
        if (document.getElementById('crqDevBtn')) return;
        var b = document.createElement('button');
        b.id = 'crqDevBtn';
        b.type = 'button';
        b.textContent = '댓글 응대(테스트)';
        b.style.cssText = 'position:fixed;right:16px;bottom:calc(80px + env(safe-area-inset-bottom,0px));z-index:9000;background:#191F28;color:#fff;border:none;border-radius:22px;padding:12px 18px;font-size:13px;font-weight:700;box-shadow:0 4px 14px rgba(0,0,0,.2);cursor:pointer;';
        b.addEventListener('click', openCommentReplyQueue);
        document.body.appendChild(b);
      };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _mountBtn);
      else _mountBtn();
    }
  } catch (_e) { void _e; }
})();
