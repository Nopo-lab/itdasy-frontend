/* workspace-perf.js — 게시물별 성과 화면 (2026-07-14, 2026-07-15 학습화면으로 개편)
   작업실 홈 성과 버튼 → 여기. "어떻게 만든 게시물이 반응 좋았나"를 원장님이 알 수 있게 한다.
   숫자 나열이 목적이 아니다 — 다음 게시물을 어떻게 만들지 정하는 게 목적이다.

   데이터 4갈래:
   ① GET /instagram/insights      → 게시물별 좋아요·댓글·저장·도달 + 썸네일 (posts = 최근 25건)
   ② loadSlotsFromDB()            → 그 게시물을 만들 때 쓴 레이아웃·말투·사진 장수 — 발행 슬롯에 이미 있음
   ③ GET /bookings                → 예약. created_at(예약을 '잡은' 시각)으로 귀속. starts_at 아님.
   ④ GET /instagram/comment-queue → 게시물별 '아직 답 안 한' 문의 댓글 (가격·예약·위치 등)

   ①↔② 연결 열쇠 = slot.publish.igMediaId (발행 시 저장 — workspace-v2-flow.js).
   옛 슬롯엔 없어서 캡션 앞글자 + 발행시각 근접으로 폴백.

   귀속 규칙(정직하게): 예약 created_at 직전 7일 안에 올라온 '가장 최근' 게시물 1건에만 준다(last-touch).
     → 한 예약이 여러 게시물에 중복으로 안 잡힌다. 인스타는 유입 경로를 안 알려주므로 어디까지나 추정.
     단, 발행 시 고객연결(slot.customer_id)한 예약은 추정이 아니라 '확정'으로 표시.

   [2026-07-15] 표본 가드(MIN_POSTS): 1~2건으로 "이 레이아웃이 최고" 라고 단언하면 원장님이 그걸 믿고
     작업 방식을 바꾼다. 근거 없는 확신이 없느니만 못하므로 3건 미만은 순위를 안 매기고 그대로 말한다.

   DM 유입 귀속은 여전히 잠금 — 아래 LOCK 주석 참고.
   .subscreen-overlay + ss-* 재사용 → PC 사이드바 자동 안전. window.WorkspacePerf.open(). */
(function () {
  'use strict';

  var ID = 'wsPerfOverlay';
  var WINDOW_DAYS = 7;              // 발행 후 며칠까지 그 게시물 덕으로 볼지
  var DAY = 86400000;
  var MIN_POSTS = 3;                // 이 건수 미만이면 "먹혔다"고 말하지 않는다
  var ANALYZE_DAYS = 14;            // "무엇이 먹혔나" 분석 창 — 반년 전 글과 섞으면 요즘 감이 안 나온다
  var CQ_MEDIA_LIMIT = 12;          // /instagram/comment-queue 서버 상한(instagram.py: min(x,12))

  // 말투 키 → 라벨. workspace-v2-flow.js _TONE_CHIPS 와 같은 집합.
  var TONE_LABEL = { friendly: '친근', professional: '전문', emotional: '감성', event: '이벤트', review: '후기', normal: '기본' };
  var PURPOSE_LABEL = { before_after: '전후', feed: '피드', review: '후기', event: '이벤트', story: '스토리', price: '가격표' };
  // 문의 댓글 intent → 라벨. instagram.py _classify_comment 와 같은 집합.
  var INTENT_LABEL = { price: '가격', booking: '예약', location: '위치', hours: '영업시간', service: '시술', complaint: '불만' };

  function esc(v) { return window._esc ? window._esc(v) : String(v == null ? '' : v); }
  function toast(m) { if (window.showToast) window.showToast(m); }

  /** 조사 '으로/로' — 축 이름이 '레이아웃'(받침 ㅅ)·'말투'(받침 없음)로 섞여 있어 하드코딩하면 반드시 틀린다.
      한글 음절 종성이 없거나 ㄹ이면 '로', 그 외엔 '으로'. 한글이 아니면 안전하게 '으로'. */
  function _ro(word) {
    var s = String(word == null ? '' : word);
    var c = s.charCodeAt(s.length - 1) - 0xAC00;
    if (isNaN(c) || c < 0 || c > 11171) return '으로';
    var jong = c % 28;
    return (jong === 0 || jong === 8) ? '로' : '으로';
  }

  function _authGet(path) {
    var headers = window.authHeader ? window.authHeader() : {};
    if (!headers || !headers.Authorization) return Promise.reject(new Error('no-token'));
    var f = window.apiFetch ? window.apiFetch(path, { headers: headers })
      : fetch(((window.API || '') + path), { headers: headers });
    return Promise.resolve(f).then(function (r) {
      if (!r || !r.ok) throw new Error('HTTP ' + (r && r.status));
      return r.json();
    });
  }

  // ── 데이터 ────────────────────────────────────────────────
  function _loadInsights() {
    return _authGet('/instagram/insights').catch(function () { return { status: 'error', posts: [] }; });
  }

  function _loadSlots() {
    if (!window.loadSlotsFromDB) return Promise.resolve([]);
    return Promise.resolve(window.loadSlotsFromDB()).then(function (l) { return l || []; }).catch(function () { return []; });
  }

  // 예약은 starts_at 으로 필터되므로(라우터), 귀속에 쓰는 created_at 기준으로는 범위를 넓게 잡고
  //   클라이언트에서 created_at 으로 다시 거른다. 과거 예약 + 앞으로 잡힌 예약 모두 필요.
  function _loadBookings() {
    var from = new Date(Date.now() - 180 * DAY).toISOString();
    var to = new Date(Date.now() + 180 * DAY).toISOString();
    return _authGet('/bookings?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to))
      .then(function (j) { return (j && j.items) || []; })
      .catch(function () { return []; });
  }

  /** 문의 댓글 — 게시물별로 '아직 답 안 한' 것만 온다(서버가 CommentReplyLog 로 응대분을 뺌).
      스테이징은 INSTAGRAM_FULL_SCOPE=1 이라 켜져 있지만, 스코프 없는 토큰이면 permission_error 로 돈다.
      그 경우 조용히 없는 셈 치고(화면엔 안내만) 나머지는 그대로 그린다 — 성과 화면 전체가 죽으면 안 된다. */
  function _loadCommentQueue() {
    return _authGet('/instagram/comment-queue?media_limit=' + CQ_MEDIA_LIMIT)
      .catch(function () { return { items: [], _failed: true }; });
  }

  // ── 연결(조인) ────────────────────────────────────────────
  function _norm(s) { return String(s == null ? '' : s).replace(/\s+/g, '').slice(0, 40); }

  function _publishedSlots(slots) {
    return (slots || []).filter(function (s) {
      return s && s.publish && (s.publish.status === 'published' || s.instagramPublished);
    });
  }

  /** 인스타 게시물 ↔ 우리 슬롯 매칭. id 우선, 없으면 캡션 앞글자, 그 다음 발행시각 근접(10분). */
  function _matchSlot(post, slots) {
    var byId = null, byCap = null, byTime = null;
    var pts = post.timestamp ? Date.parse(post.timestamp) : 0;
    var pcap = _norm(post.caption);
    for (var i = 0; i < slots.length; i++) {
      var s = slots[i], pub = s.publish || {};
      if (pub.igMediaId && String(pub.igMediaId) === String(post.id)) { byId = s; break; }
      if (!byCap && pcap && _norm(s.caption) && _norm(s.caption) === pcap) byCap = s;
      if (!byTime && pts && pub.publishedAt && Math.abs(pub.publishedAt - pts) < 10 * 60000) byTime = s;
    }
    return byId || byCap || byTime || null;
  }

  function _toneOf(slot) {
    var t = slot && slot.captionMeta && slot.captionMeta.tone_override;
    return TONE_LABEL[t] ? t : (t ? t : 'normal');
  }

  /** wsl-* 프리셋 id → 사람이 읽는 이름. 스타터에 없으면 '내 레이아웃'(ShopStyle 확장)도 뒤진다. */
  function _presetName(id) {
    var WL = window.WorkspaceLayout;
    if (!id || !WL) return '';
    try {
      var p = WL.getById ? WL.getById(id) : null;
      if (p && p.name) return p.name;
      var mine = WL.getMyLayouts ? (WL.getMyLayouts() || []) : [];
      for (var i = 0; i < mine.length; i++) if (mine[i] && mine[i].id === id) return mine[i].name || '내 레이아웃';
    } catch (_e) { void _e; }
    return '';
  }

  /**
   * 게시물을 만들 때 쓴 레이아웃.
   * [2026-07-15 수정] 예전엔 workspaceContext.templateLabel 만 봐서 '전후'·'피드' 같은 뭉뚱그린 분류로
   *   뭉갰다 — 그러면 '전후·좌우'와 '전후·상하'가 같은 걸로 집계돼서 원장님한테 알려줄 게 없어진다.
   *   실제 프리셋 id 는 slot.templateOutputs[].templateId 에 그대로 있으므로 그걸 먼저 본다.
   *   (레이아웃 없이 사진만 올린 슬롯은 templateId=null — flow/layout.js:108. 그때만 옛 폴백.)
   */
  function _layoutOf(slot) {
    if (!slot) return '';
    var outs = slot.templateOutputs || [];
    for (var i = 0; i < outs.length; i++) {
      var id = outs[i] && outs[i].templateId;
      if (!id) continue;
      var nm = _presetName(id);
      if (nm) return nm;
    }
    var wc = slot.workspaceContext || {};
    return wc.templateLabel || PURPOSE_LABEL[wc.templatePurpose] || PURPOSE_LABEL[wc.type] || '';
  }

  /**
   * 사진 장수 — "몇 장 올린 게 반응 좋나"는 원장님이 바로 따라할 수 있는 축.
   * [2026-07-15] 인스타 응답(children_count) 우선, 없으면 슬롯. 작업실 밖에서 올린 글이나
   *   templateOutputs 가 없는 옛 글도 장수는 IG 가 직접 알려주므로 표본이 훨씬 넓어진다.
   */
  function _photoCountOf(slot, post) {
    var n = (post && post.children_count) || 0;
    if (!n && post && post.media_type && post.media_type !== 'CAROUSEL_ALBUM') n = 1;
    if (!n) n = (slot && slot.photos && slot.photos.length) || 0;
    return n ? (n >= 4 ? '4장 이상' : n + '장') : '';
  }

  /** 캡션 길이 — 원장님이 바로 조절할 수 있는 축. 인스타 캡션 그대로에서 뽑는다. */
  function _capLenOf(post) {
    var t = (post && post.caption) || '';
    if (!t) return '캡션 없음';
    var n = t.replace(/#\S+/g, '').trim().length;   // 해시태그 뺀 본문 길이
    if (n < 60) return '짧게';
    if (n < 180) return '보통';
    return '길게';
  }

  /** 해시태그 개수 — 뷰티 계정에서 유입에 크게 작용하는 축. */
  function _tagCountOf(post) {
    var t = (post && post.caption) || '';
    var m = t.match(/#\S+/g);
    var n = m ? m.length : 0;
    if (!n) return '없음';
    if (n <= 5) return '1~5개';
    if (n <= 15) return '6~15개';
    return '16개 이상';
  }

  /**
   * 예약 → 게시물 귀속(last-touch). rows 는 발행시각 내림차순이어야 한다.
   * 각 예약은 딱 한 게시물에만 붙는다.
   */
  function _attribute(rows, bookings) {
    rows.forEach(function (r) { r.bookings = []; });
    (bookings || []).forEach(function (b) {
      if (!b || b.status === 'cancelled') return;
      var made = b.created_at ? Date.parse(b.created_at) : 0;
      if (!made) return;
      var hit = null;
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        if (!r.publishedAt) continue;
        if (r.publishedAt > made) continue;                       // 예약보다 나중에 올린 글
        if (made - r.publishedAt > WINDOW_DAYS * DAY) break;       // 7일 넘음 — 더 옛날 글은 볼 필요 없음
        hit = r; break;                                            // 직전 게시물 1건
      }
      if (!hit) return;
      // 발행 때 고객연결한 슬롯 + 같은 고객 = 추정이 아니라 확정
      var sure = !!(hit.slot && hit.slot.customer_id && b.customer_id && String(hit.slot.customer_id) === String(b.customer_id));
      hit.bookings.push({ name: b.customer_name || '이름 없음', sure: sure });
    });
    rows.forEach(function (r) { r.sureCount = r.bookings.filter(function (b) { return b.sure; }).length; });
  }

  function _buildRows(insights, slots) {
    var pub = _publishedSlots(slots);
    var posts = (insights && (insights.posts && insights.posts.length ? insights.posts : insights.top_posts)) || [];
    var rows = posts.map(function (p) {
      var slot = _matchSlot(p, pub);
      var ts = p.timestamp ? Date.parse(p.timestamp) : 0;
      return {
        id: p.id, thumb: p.thumb_url || '', caption: p.caption || '', permalink: p.permalink || '',
        likes: p.like_count || 0, comments: p.comments_count || 0, saved: p.saved || 0, reach: p.reach || 0,
        shares: p.shares || 0,
        publishedAt: ts || (slot && slot.publish && slot.publish.publishedAt) || 0,
        slot: slot, tone: slot ? _toneOf(slot) : null, layout: slot ? _layoutOf(slot) : '',
        // 아래 3축은 슬롯이 없어도 인스타 응답만으로 뽑힌다 → 작업실 밖에서 올린 글도 분석에 들어간다
        photoCount: _photoCountOf(slot, p),
        capLen: _capLenOf(p),
        tagCount: _tagCountOf(p),
        title: (slot && (slot.service || slot.label)) || '', bookings: [], sureCount: 0,
        inquiries: 0, intents: []
      };
    });
    rows.sort(function (a, b) { return b.publishedAt - a.publishedAt; });
    return rows;
  }

  /** 문의 댓글 큐를 media_id 로 묶어 게시물에 붙인다. 큐엔 '미응대'만 들어있다(서버가 응대분 제외). */
  function _attachInquiries(rows, cq) {
    var items = (cq && cq.items) || [];
    if (!items.length) return;
    var byMedia = {};
    items.forEach(function (it) {
      var mid = it && it.media_id; if (!mid) return;
      if (!byMedia[mid]) byMedia[mid] = [];
      byMedia[mid].push(it.intent || null);
    });
    rows.forEach(function (r) {
      var list = byMedia[r.id]; if (!list) return;
      r.inquiries = list.length;
      var seen = {};
      r.intents = list.filter(function (x) { if (!x || seen[x]) return false; seen[x] = 1; return true; });
    });
  }

  /**
   * 반응 점수 — 가중치는 "원장님한테 얼마나 값진 행동인가" 순: 좋아요(1) < 저장(3) < 공유(4).
   *   저장·공유는 "나중에 여기 가야지"에 가까워서 좋아요보다 예약에 훨씬 가깝다.
   *
   * [2026-07-15 중요] 댓글은 점수에서 뺐다.
   *   인스타 comments_count 에는 **우리가 단 답글이 그대로 포함**된다. 자동응답이 답글을
   *   달수록 그 글 점수가 올라가는 순환 구조라, "답글 많이 단 글 = 반응 좋은 글" 이라는
   *   허구가 만들어진다. cbt4 실측에서 실제로 터졌다: 좋아요·저장·공유가 전부 0인데
   *   우리 답글 18개만으로 "사진 3장이 제일 반응 좋았어요" 라고 추천했다.
   *   comments_count 에서 우리 답글만 빼려면 게시물마다 댓글을 다 받아 작성자를 봐야 하는데
   *   (comment-queue 가 하는 일) 그건 최근 12건까지만 된다. 표본이 반토막 나느니
   *   손님만 남길 수 있는 지표(좋아요·저장·공유)로 판단한다. 댓글은 카드에 표시만 한다.
   *
   * 도달(reach)은 프로 계정 아니면 0이라 분모로 안 쓴다(%는 만들지 않는다).
   */
  function _score(r) {
    return (r.likes || 0) + (r.saved || 0) * 3 + (r.shares || 0) * 4;
  }

  /** 이 게시물에 손님 반응이라 할 만한 게 하나라도 있나 — 전부 0이면 추천의 근거가 될 수 없다. */
  function _hasSignal(r) { return _score(r) > 0; }

  function _agg(rows, keyFn) {
    var m = {};
    rows.forEach(function (r) {
      var k = keyFn(r);
      if (!k) return;
      if (!m[k]) m[k] = { key: k, posts: 0, bookings: 0, likes: 0, score: 0 };
      m[k].posts++; m[k].bookings += r.bookings.length; m[k].likes += r.likes; m[k].score += _score(r);
    });
    return Object.keys(m).map(function (k) {
      var o = m[k];
      o.perPost = o.posts ? o.bookings / o.posts : 0;
      o.likesPerPost = o.posts ? o.likes / o.posts : 0;
      o.scorePerPost = o.posts ? o.score / o.posts : 0;
      o.enough = o.posts >= MIN_POSTS;
      return o;
    }).sort(function (a, b) { return b.scorePerPost - a.scorePerPost || b.perPost - a.perPost; });
  }

  // ── 그리기 ────────────────────────────────────────────────
  function _fmtDate(ms) {
    if (!ms) return '';
    var d = new Date(ms);
    return (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
  }

  /* 맨 위 합계 띠. 화살표로 좋아요→댓글→예약 깔때기를 보여주던 걸, 저장·공유까지 포함한
     전체 지표 합계로 바꿨다(2026-07-15). 깔때기 비유는 사실이 아니었다 — 좋아요 누른 사람이
     댓글을 달고 그게 예약이 되는 게 아니라 서로 다른 사람이다. 화살표가 인과를 암시해서 뺐다. */
  function _summaryHtml(rows) {
    var t = { likes: 0, comments: 0, saved: 0, shares: 0, books: 0 };
    rows.forEach(function (r) {
      t.likes += r.likes || 0; t.comments += r.comments || 0;
      t.saved += r.saved || 0; t.shares += r.shares || 0; t.books += r.bookings.length;
    });
    var cells = [
      { n: t.likes, l: '좋아요' }, { n: t.comments, l: '댓글' },
      { n: t.saved, l: '저장' }, { n: t.shares, l: '공유' }, { n: t.books, l: '예약' },
    ];
    return '<div class="wsp-sum">' +
      '<div class="wsp-sum__tt">발행 ' + rows.length + '건이 이만큼 움직였어요</div>' +
      '<div class="wsp-sum__row">' +
      cells.map(function (c) { return '<div class="wsp-sum__c"><b>' + c.n + '</b><span>' + c.l + '</span></div>'; }).join('') +
      '</div></div>';
  }

  /** 한 축(레이아웃/말투/사진장수)의 순위 막대. 표본 부족분은 순위를 안 매기고 그대로 말한다. */
  function _axisHtml(label, list, icon) {
    var enough = list.filter(function (o) { return o.enough; });
    var head = '<div class="wsp-axis__k"><i class="ph-duotone ' + icon + '"></i>' + esc(label) + '</div>';
    if (!enough.length) {
      return '<div class="wsp-axis">' + head +
        '<div class="wsp-axis__none">같은 ' + esc(label) + _ro(label) + ' ' + MIN_POSTS + '건은 올려야 비교해드릴 수 있어요. ' +
        '지금은 ' + list.length + '가지를 조금씩만 써보셨어요.</div></div>';
    }
    // 비교 대상이 하나뿐이면 1등을 강조하지 않는다 — 막대 100% + 굵은 글씨는 "이게 최고" 로 읽히는데,
    //   견줄 게 없으면 그건 그냥 유일한 값이지 최고가 아니다.
    var comparable = enough.length >= 2;
    var max = enough[0].scorePerPost || 1;
    var bars = enough.map(function (o, i) {
      var pct = Math.max(4, Math.round((o.scorePerPost / max) * 100));
      return '<div class="wsp-bar' + (comparable && i === 0 ? ' is-top' : '') + '">' +
        '<div class="wsp-bar__k">' + esc(o.key) + '</div>' +
        '<div class="wsp-bar__t"><span style="width:' + pct + '%"></span></div>' +
        '<div class="wsp-bar__v">' + Math.round(o.scorePerPost) + '</div>' +
        '<div class="wsp-bar__s">' + o.posts + '건' + (o.bookings ? ' · 예약 ' + o.bookings + '건' : '') + '</div>' +
        '</div>';
    }).join('');
    var thin = list.length - enough.length;
    var note = '';
    if (!comparable) {
      note = '<div class="wsp-axis__thin">견줄 게 아직 없어요 — 다른 ' + esc(label) + _ro(label) + '도 올려보시면 비교해드릴게요</div>';
    } else if (thin) {
      note = '<div class="wsp-axis__thin">' + thin + '가지는 아직 ' + MIN_POSTS + '건이 안 돼서 뺐어요</div>';
    }
    return '<div class="wsp-axis">' + head + bars + note + '</div>';
  }

  /**
   * "무엇이 먹혔나" — 이 화면의 본론.
   * 원장님이 다음 게시물을 만들 때 따라할 수 있는 축만 놓는다: 레이아웃·말투·사진 장수.
   */
  function _compareHtml(rows) {
    /* [2026-07-15] 분석 창 = 최근 2주. 반년 전 글이랑 섞으면 '요즘 뭐가 먹히나'를 못 본다
       (인스타 알고리즘·계절·시술 유행이 다 바뀐다). 게시물 목록은 그대로 다 보여준다. */
    var cut = Date.now() - ANALYZE_DAYS * DAY;
    var win = rows.filter(function (r) { return r.publishedAt && r.publishedAt >= cut; });

    var head = '<div class="wsp-sect">무엇이 먹혔나 <span class="wsp-sect__s">최근 ' + ANALYZE_DAYS + '일</span></div>';
    if (!win.length) {
      return head + '<div class="wsp-empty">최근 ' + ANALYZE_DAYS + '일 안에 올린 글이 없어요.</div>';
    }

    /* 반응이 하나도 없으면 순위를 만들지 않는다.
       [중요] 여기서 억지로 1등을 뽑으면 '0점 vs 0점' 중 아무거나 고르는 꼴이라
         원장님이 그걸 믿고 작업 방식을 바꾼다. 없는 근거를 지어내느니 없다고 말한다.
         (cbt4 실측: 2주 13건에 좋아요 0·저장 0·공유 0 — 이 분기가 실제로 필요하다) */
    var signal = win.filter(_hasSignal);
    if (!signal.length) {
      return head + '<div class="wsp-empty">최근 ' + ANALYZE_DAYS + '일 글 ' + win.length + '건에 ' +
        '아직 <b>좋아요·저장·공유</b>가 없어서 뭐가 먹히는지 못 따져요.<br>' +
        '반응이 쌓이면 여기서 알려드릴게요.<br>' +
        '<span class="wsp-empty__s">댓글은 우리가 단 답글이 섞여 있어서 판단 근거로 안 써요.</span></div>';
    }

    /* 축 정의. lead 는 축마다 따로 쓴다 — "2장 사진 장수으로" 같은 조사 깨짐을 막고,
       원장님이 그대로 따라할 수 있는 문장으로 만든다.
       사진장수·캡션길이·해시태그는 슬롯이 없어도 인스타 응답만으로 뽑히므로 표본이 넓다.
       레이아웃·말투는 작업실에서 올린 글에만 있다 → 없으면 그 축은 자동으로 빠진다. */
    var AXES = [
      { label: '레이아웃', icon: 'ph-layout', keyFn: function (r) { return r.layout || null; },
        lead: function (k) { return '<b>' + esc(k) + '</b> 레이아웃으로 올린 글'; } },
      { label: '사진 장수', icon: 'ph-images', keyFn: function (r) { return r.photoCount || null; },
        lead: function (k) { return '사진 <b>' + esc(k) + '</b> 올린 글'; } },
      { label: '캡션 길이', icon: 'ph-text-align-left', keyFn: function (r) { return r.capLen || null; },
        lead: function (k) { return '캡션을 <b>' + esc(k) + '</b> 쓴 글'; } },
      { label: '말투', icon: 'ph-chat-circle-text', keyFn: function (r) { return r.tone ? (TONE_LABEL[r.tone] || r.tone) : null; },
        lead: function (k) { return '<b>' + esc(k) + '</b> 말투로 쓴 글'; } },
      { label: '해시태그', icon: 'ph-hash', keyFn: function (r) { return r.tagCount || null; },
        lead: function (k) { return '해시태그를 <b>' + esc(k) + '</b> 단 글'; } },
    ];
    AXES.forEach(function (x) { x.list = _agg(win, x.keyFn); });

    /* 맨 위 한 줄 결론.
       [주의] 축끼리 점수를 비교하면 안 된다 — 세 축은 같은 게시물을 다르게 자를 뿐이라, 대박 글 하나를
         우연히 잘 격리한 축이 늘 이긴다(의미 없는 1등). 대신 원장님이 따라하기 쉬운 순서로 고른다:
         레이아웃(다음 글에 그대로 적용 가능) > 말투 > 사진 장수. 표본 채운 첫 축을 쓴다. */
    var top = null;
    for (var i = 0; i < AXES.length && !top; i++) {
      var e = AXES[i].list.filter(function (o) { return o.enough; })[0];
      if (e && AXES[i].list.filter(function (o) { return o.enough; }).length >= 2) top = { ax: AXES[i], o: e };
    }
    var lead = top
      ? '<div class="wsp-lead">최근 ' + ANALYZE_DAYS + '일은 ' + top.ax.lead(top.o.key) + '이 제일 반응 좋았어요 ' +
        '<span>(' + top.o.posts + '건 기준)</span></div>'
      : '<div class="wsp-lead wsp-lead--thin">아직 뭐가 먹히는지 말하기엔 일러요. ' +
        '같은 방식으로 ' + MIN_POSTS + '건쯤 올려서 서로 비교되면 여기서 알려드릴게요.</div>';

    return head + lead + _recoHtml(AXES) +
      AXES.map(function (x) { return _axisHtml(x.label, x.list, x.icon); }).join('') +
      '<div class="wsp-legend">반응 = 좋아요 + 저장×3 + 공유×4. ' +
      '저장·공유를 크게 보는 건 "나중에 여기 가야지"에 더 가까워서예요. ' +
      '댓글은 우리가 단 답글이 섞여 있어서 뺐어요.</div>';
  }

  /**
   * 다음 글 추천 — 이 화면의 존재 이유. 분석만 보여주면 원장님이 뭘 해야 할지 모른다.
   * 표본(MIN_POSTS)과 비교군(2가지 이상)을 채운 축의 1등만 모아서 "이렇게 해보세요"로 낸다.
   *   → 근거 없는 축은 아예 문장에 안 넣는다. 채운 축이 하나도 없으면 카드 자체를 안 그린다.
   */
  function _recoHtml(axes) {
    var picks = axes.map(function (x) {
      var e = x.list.filter(function (o) { return o.enough; });
      return (e.length >= 2) ? { label: x.label, key: e[0].key, posts: e[0].posts } : null;
    }).filter(Boolean);
    if (!picks.length) return '';
    var items = picks.map(function (p) {
      return '<li><span class="wsp-reco__k">' + esc(p.label) + '</span>' +
        '<b>' + esc(p.key) + '</b><span class="wsp-reco__s">' + p.posts + '건 기준</span></li>';
    }).join('');
    return '<div class="wsp-reco">' +
      '<div class="wsp-reco__h"><i class="ph-duotone ph-lightbulb-filament"></i>다음 글은 이렇게 해보세요</div>' +
      '<ul class="wsp-reco__l">' + items + '</ul>' +
      '<div class="wsp-reco__d">최근 ' + ANALYZE_DAYS + '일 반응이 좋았던 방식이에요. ' +
      '똑같이 하라는 건 아니고, 애매할 때 참고하시라는 뜻이에요.</div></div>';
  }

  function _rowHtml(r) {
    var thumb = r.thumb
      ? '<img class="wsp-card__im" src="' + esc(r.thumb) + '" alt="" loading="lazy" referrerpolicy="no-referrer">'
      : '<div class="wsp-card__im wsp-card__im--none"><i class="ph-duotone ph-image"></i></div>';
    var chips = '';
    if (r.layout) chips += '<span class="wsp-chip">' + esc(r.layout) + '</span>';
    if (r.tone) chips += '<span class="wsp-chip">' + esc(TONE_LABEL[r.tone] || r.tone) + ' 말투</span>';
    if (r.photoCount) chips += '<span class="wsp-chip">' + esc(r.photoCount) + '</span>';
    if (!r.slot) chips += '<span class="wsp-chip wsp-chip--dim">작업실 밖에서 올린 글</span>';

    var n = r.bookings.length;
    var names = r.bookings.slice(0, 3).map(function (b) { return b.name; }).join(' · ');
    var conv;
    if (n) {
      conv = '<div class="wsp-conv is-hit">' +
        '<div class="wsp-conv__t"><i class="ph-duotone ph-calendar-check"></i>예약 <b>' + n + '건</b></div>' +
        '<div class="wsp-conv__s">' + esc(names) +
        (r.sureCount ? ' — ' + r.sureCount + '건은 고객연결로 확인' : '') +
        (r.sureCount < n ? ' — 올린 뒤 ' + WINDOW_DAYS + '일 안에 잡힌 예약으로 추정' : '') +
        '</div></div>';
    } else {
      conv = '<div class="wsp-conv">' +
        '<div class="wsp-conv__t"><i class="ph-duotone ph-calendar-blank"></i>예약 0건</div>' +
        (r.likes ? '<div class="wsp-conv__s">좋아요는 있는데 예약으로는 아직 안 이어졌어요</div>' : '') +
        '</div>';
    }

    // 답 안 한 문의 댓글 — 원장님이 지금 당장 할 일이라 예약 블록보다 위에 둔다.
    var inq = '';
    if (r.inquiries) {
      var kinds = r.intents.map(function (x) { return INTENT_LABEL[x] || x; }).join(' · ');
      inq = '<div class="wsp-inq" data-wsp-comments>' +
        '<i class="ph-duotone ph-chats-circle"></i>' +
        '<span>답 안 한 문의 <b>' + r.inquiries + '건</b>' + (kinds ? ' — ' + esc(kinds) : '') + '</span>' +
        '<i class="ph-duotone ph-caret-right"></i></div>';
    }

    return '<div class="wsp-card">' +
      '<div class="wsp-card__top">' + thumb +
        '<div class="wsp-card__meta">' +
          '<div class="wsp-card__tt">' + esc(r.title || (r.caption || '제목 없음').slice(0, 20)) + '</div>' +
          '<div class="wsp-chips">' + chips + '</div>' +
          '<div class="wsp-card__dt">' + _fmtDate(r.publishedAt) + ' 발행</div>' +
        '</div></div>' +
      _statsHtml(r) + inq + conv + '</div>';
  }

  /**
   * 게시물별 성과 지표 — 좋아요·댓글·저장·공유·도달을 **항상 전부** 보여준다.
   * [2026-07-15] 예전엔 저장·도달을 0이면 숨기고 공유는 아예 없었다. 그러면 원장님이
   *   "저장이 0이다" 와 "저장을 못 읽었다" 를 구분할 방법이 없다 — 숨기는 게 더 나쁘다.
   *   0 이면 0 이라고 보여주고, 계정 문제로 아예 안 나오는 경우는 아래 _statsNoteHtml 로 따로 말한다.
   * 순서는 값진 순(공유 > 저장 > 댓글 > 좋아요)이 아니라 원장님이 익숙한 순(인스타 표시 순)으로 둔다.
   */
  function _statsHtml(r) {
    var cells = [
      { ic: 'ph-heart', n: r.likes || 0, l: '좋아요' },
      { ic: 'ph-chat-circle', n: r.comments || 0, l: '댓글' },
      { ic: 'ph-bookmark-simple', n: r.saved || 0, l: '저장' },
      { ic: 'ph-paper-plane-tilt', n: r.shares || 0, l: '공유' },
      { ic: 'ph-eye', n: r.reach || 0, l: '도달' },
    ];
    return '<div class="wsp-stats">' + cells.map(function (c) {
      return '<div class="wsp-stat' + (c.n ? ' is-on' : '') + '">' +
        '<i class="ph-duotone ' + c.ic + '"></i>' +
        '<b>' + c.n + '</b><span>' + c.l + '</span></div>';
    }).join('') + '</div>';
  }

  /**
   * 저장·공유·도달이 전 게시물에서 통째로 0이면 계정 종류 문제일 수 있다.
   * 인스타는 프로(비즈니스/크리에이터) 계정에만 이 지표를 준다 — 개인 계정이면 영영 0이다.
   * 그걸 모르면 원장님은 "우리 글이 저장이 하나도 안 됐네" 라고 잘못 배운다.
   */
  function _statsNoteHtml(rows) {
    if (!rows.length) return '';
    var anyInsight = rows.some(function (r) { return (r.saved || 0) + (r.shares || 0) + (r.reach || 0) > 0; });
    if (anyInsight) return '';
    return '<div class="wsp-legend">저장·공유·도달이 계속 0으로 나오면 인스타가 <b>프로 계정</b>(비즈니스·크리에이터)에만 ' +
      '주는 지표라서 그럴 수 있어요. 인스타 설정에서 프로 계정으로 바꾸면 보여요.</div>';
  }

  /* [LOCK] DM 유입 귀속만 남았다. (댓글 문의 분류는 2026-07-15 열림 — 스테이징 INSTAGRAM_FULL_SCOPE=1,
       개발모드/테스터는 App Review 전에도 manage_comments 를 받을 수 있다. instagram.py:710 주석 참고.)
     DM 이 막힌 진짜 이유는 심사가 아니라 데이터가 없어서다:
       · /dm/conversations 는 '마지막 대화 시각'만 줘서 '이 게시물 보고 처음 연락했는지'를 알 수 없다.
       · messaging_referral 웹훅(게시물/광고 출처를 실어옴)은 구독은 돼 있는데 dm_autoreply.py:3100 에서
         파싱 없이 버려진다. 그걸 저장해도 오가닉 DM 엔 ref 가 안 붙을 공산이 커서, 커버리지를 실측하기
         전까지는 비율을 안 만든다. 추정치도 안 만든다(가짜 숫자 금지). */
  function _lockHtml() {
    return '<div class="wsp-lock">' +
      '<div class="wsp-lock__h"><i class="ph-duotone ph-lock-simple"></i>DM이 어느 글 보고 왔는지' +
        '<span class="wsp-lock__b">준비 중</span></div>' +
      '<div class="wsp-lock__d">인스타가 "이 DM은 어느 게시물 보고 온 건지"를 알려주지 않아서, 지금은 ' +
        '정확히 이어드릴 수가 없어요. 억지로 추측한 숫자를 보여드리면 오히려 판단을 그르치게 해서 ' +
        '비워뒀어요. 방법이 생기면 바로 채울게요.</div></div>';
  }

  /** 댓글 문의를 못 읽은 경우에만 뜬다 — 대개 인스타를 다시 연결하면 풀린다(스코프가 토큰에 박혀서). */
  function _cqNoticeHtml(cq) {
    if (!cq || !(cq.permission_error || cq._failed)) return '';
    if (cq.connected === false) return '';   // 인스타 미연결은 이미 다른 데서 안내함
    return '<div class="wsp-lock">' +
      '<div class="wsp-lock__h"><i class="ph-duotone ph-warning-circle"></i>문의 댓글을 못 읽었어요' +
        '<span class="wsp-lock__b">재연결 필요</span></div>' +
      '<div class="wsp-lock__d">인스타를 연결할 때 댓글 권한을 안 받아서예요. 설정에서 인스타를 ' +
        '다시 연결하면 게시물마다 답 안 한 문의를 모아서 보여드릴 수 있어요.</div></div>';
  }

  function _emptyHtml(insights) {
    var st = insights && insights.status;
    if (st === 'no_account') {
      return '<div class="wsp-empty"><b>인스타 연결이 필요해요</b><br>연결하면 올린 글의 좋아요·댓글이 여기 모여요.</div>';
    }
    if (st === 'error') {
      return '<div class="wsp-empty">인스타에서 성과를 못 받아왔어요. 잠시 뒤 다시 열어봐 주세요.</div>';
    }
    return '<div class="wsp-empty">아직 올린 게시물이 없어요. 작업실에서 첫 글을 올려보세요.</div>';
  }

  // 기존 AI 인사이트(이탈 고객·매출 예측) 진입. 성과 버튼을 이 화면이 가져갔으므로 어느 상태에서든
  //   반드시 같이 그린다 — 게시물 0건일 때 이것마저 빠지면 AI 인사이트로 갈 길이 아예 없어진다.
  function _moreHtml() {
    return '<button type="button" class="wsp-more" data-wsp-ai>고객·매출 인사이트 보기 ›</button>';
  }

  function _render(el, insights, rows, cq) {
    var body = el.querySelector('[data-wsp-body]');
    if (!body) return;
    if (!rows.length) { body.innerHTML = _emptyHtml(insights) + _lockHtml() + _moreHtml(); return; }
    body.innerHTML =
      _summaryHtml(rows) +
      _compareHtml(rows) +
      '<div class="wsp-sect">게시물별</div>' +
      rows.map(_rowHtml).join('') +
      _statsNoteHtml(rows) +
      _cqNoticeHtml(cq) +
      _lockHtml() +
      _moreHtml();
  }

  // ── 화면 ──────────────────────────────────────────────────
  function _ensureMounted() {
    var el = document.getElementById(ID);
    if (el) return el;
    el = document.createElement('div');
    el.id = ID; el.className = 'subscreen-overlay'; el.setAttribute('aria-hidden', 'true');
    el.innerHTML =
      '<header class="ss-topbar">' +
        '<button type="button" class="ss-back" data-wsp-back aria-label="뒤로">' +
          '<svg width="14" height="14" aria-hidden="true"><use href="#ic-chevron-left"/></svg></button>' +
        '<div class="ss-title">성과</div></header>' +
      '<div class="ss-body" data-wsp-body></div>';
    document.body.appendChild(el);
    el.addEventListener('click', function (e) {
      if (e.target.closest('[data-wsp-back]')) { close(); return; }
      // 기존 AI 인사이트(이탈 고객·매출 예측) 진입 — 성과 버튼을 이 화면이 가져가면서 갈 곳이 없어졌다.
      if (e.target.closest('[data-wsp-ai]')) {
        if (typeof window.openInsights === 'function') { close(); window.openInsights(); }
        else toast('인사이트를 불러오지 못했어요');
        return;
      }
      // 답 안 한 문의 → 댓글 응대 화면. 여기서 바로 답을 달게 해야 성과 화면이 '보고서'로 안 끝난다.
      if (e.target.closest('[data-wsp-comments]')) {
        if (typeof window.openCommentReplyQueue === 'function') { close(); window.openCommentReplyQueue(); }
        else toast('댓글 응대 화면을 불러오지 못했어요');
        return;
      }
    });
    el.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    return el;
  }

  function open() {
    var el = _ensureMounted();
    var body = el.querySelector('[data-wsp-body]');
    if (body) body.innerHTML = '<div class="wsp-empty">성과를 불러오는 중…</div>';
    el.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(function () { el.classList.add('is-open'); });

    Promise.all([_loadInsights(), _loadSlots(), _loadBookings(), _loadCommentQueue()]).then(function (res) {
      var insights = res[0], slots = res[1], bookings = res[2], cq = res[3];
      var rows = _buildRows(insights, slots);
      _attribute(rows, bookings);
      _attachInquiries(rows, cq);
      if (!document.getElementById(ID)) return;   // 로딩 중 닫힘
      _render(el, insights, rows, cq);
    }).catch(function (err) {
      console.warn('[wsperf] load fail', err);
      var b = el.querySelector('[data-wsp-body]');
      if (b) b.innerHTML = '<div class="wsp-empty">성과를 불러오지 못했어요. 잠시 뒤 다시 열어봐 주세요.</div>';
    });
  }

  function close() {
    var el = document.getElementById(ID); if (!el) return;
    el.classList.remove('is-open'); el.setAttribute('aria-hidden', 'true');
  }

  window.WorkspacePerf = {
    open: open, close: close,
    _internals: {
      _attribute: _attribute, _buildRows: _buildRows, _matchSlot: _matchSlot, _agg: _agg,
      _layoutOf: _layoutOf, _photoCountOf: _photoCountOf, _attachInquiries: _attachInquiries, _score: _score,
      _capLenOf: _capLenOf, _tagCountOf: _tagCountOf, _hasSignal: _hasSignal,
      _ro: _ro, MIN_POSTS: MIN_POSTS, ANALYZE_DAYS: ANALYZE_DAYS,
    },
  };
})();
