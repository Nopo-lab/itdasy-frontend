/* assistant-intent-router.js — P0-1: FE intent pre-parser
   목적: 명확한 단답 의도(인사·감사·도움말)에 한해 BE/LLM 호출 0회로 즉시 응답.
         매출·예약 SQL-first 응답은 P0-1.5에서 별도 추가 예정.

   사용:
     const r = window.AssistantIntent.classifyObvious(text);
     if (r.matched) {  // 즉시 응답 가능
       // r.response 텍스트로 답변 + return (LLM 호출 skip)
     }

   설계 원칙:
     - 순수 함수. 외부 state 없음. BE 호출 없음.
     - 매칭 안 되면 그대로 false 반환 → 기존 흐름 유지 (안전).
     - 롤백 플래그: localStorage.assistant_router_disabled === '1' 이면 항상 false 반환.
     - 측정: window.__assistantRouterStats.hits / .total 카운트.
*/
(function () {
  'use strict';

  const STATS_KEY = '__assistantRouterStats';
  if (!window[STATS_KEY]) {
    window[STATS_KEY] = { hits: 0, total: 0, byType: {} };
  }

  function _disabled() {
    try { return localStorage.getItem('assistant_router_disabled') === '1'; }
    catch (_e) { void _e; return false; }
  }

  function _trim(s) { return String(s == null ? '' : s).trim(); }

  function _bumpStats(type) {
    try {
      const s = window[STATS_KEY];
      s.total += 1;
      if (type) {
        s.hits += 1;
        s.byType[type] = (s.byType[type] || 0) + 1;
      }
    } catch (_e) { void _e; }
  }

  // ─── 매칭 규칙 ─────────────────────────────────────────
  // 각 규칙은 { test(q), type, response } 형태.
  // response 는 함수 가능 — 시간대별 분기 등.

  const RULES = [
    // 인사
    {
      type: 'greeting',
      test: (q) => /^(안녕|하이|hi|hello|halo|반가워|반갑|좋은\s*(아침|오후|저녁))/i.test(q),
      response: () => {
        const h = new Date().getHours();
        const part = h < 5 ? '늦은 시간까지' : h < 12 ? '좋은 아침이에요' : h < 18 ? '좋은 오후예요' : '좋은 저녁이에요';
        return `${part}, 사장님 😊\n오늘은 뭘 도와드릴까요? 예약·매출·고객·캡션 다 가능해요.`;
      },
    },
    // 감사
    {
      type: 'thanks',
      test: (q) => /^(고마(워|워요|웠|웠어)|감사(해|합니다|요)|땡큐|thx|thanks|thank\s*you)/i.test(q),
      response: '별말씀을요! 또 필요한 거 있으면 편하게 말씀해주세요 🙌',
    },
    // 사과·격려 응답
    {
      type: 'sorry',
      test: (q) => /^(미안|죄송|쏘리|sorry)/i.test(q),
      response: '괜찮아요, 사장님! 다시 편하게 말씀해주세요.',
    },
    // 도움말
    {
      type: 'help',
      test: (q) => /^(뭐\s*할\s*수\s*있|기능\s*(알려|보여|뭐)?|도움말|help|메뉴얼|매뉴얼|사용법|어떻게\s*써)/i.test(_trim(q)),
      response:
        '제가 도와드릴 수 있는 일이에요:\n\n' +
        '📅 예약: "내일 오후 2시 김민지 리터치"\n' +
        '💰 매출: "오늘 매출 얼마?", "이번 달 매출"\n' +
        '👥 고객: "김민지 정보", "새 고객 추가"\n' +
        '📸 사진: 사진 던지면 자동 보정·캡션·인스타\n' +
        '🤖 자동화: DM 자동응답, 리뷰 요청, 이탈 고객 관리\n\n' +
        '편하게 말씀해주세요!',
    },
    // 너 누구야 / 정체
    {
      type: 'who',
      test: (q) => /^(너\s*누구|니가\s*누구|넌\s*누구|자기소개|소개\s*해|who\s*are\s*you)/i.test(_trim(q)),
      response: '저는 잇데이 AI 잇비예요. 사장님의 1인샵 운영을 도와드리는 만능 도우미예요. 예약·매출·고객·사진·마케팅 다 해드릴게요 😊',
    },
  ];

  // ─── 메인 분류 함수 ─────────────────────────────────────
  function classifyObvious(text) {
    _bumpStats(null); // total 카운트
    if (_disabled()) return { matched: false, reason: 'disabled' };

    const q = _trim(text);
    if (!q || q.length > 80) {
      // 너무 길면 LLM 영역. 단답 의도가 아닐 가능성 큼.
      return { matched: false };
    }

    for (const rule of RULES) {
      try {
        if (rule.test(q)) {
          const response = typeof rule.response === 'function' ? rule.response(q) : rule.response;
          _bumpStats(rule.type);
          return { matched: true, type: rule.type, response };
        }
      } catch (_e) { void _e; /* 매칭 실패 시 다음 규칙으로 */ }
    }
    return { matched: false };
  }

  // ─── [P0-1.5] SQL-first 비동기 규칙 ─────────────────────
  // 매출/예약 단순 조회 — BE 의 가벼운 endpoint 호출, LLM 0회.
  // BE 의 /revenue·/bookings 는 이미 KV 캐시 + SQL 직조회 → 빠름 (50~300ms).
  // 응답 포맷:
  //   - RevenueListOut: { items, total, count, net_total, margin_total }
  //   - BookingListOut: { items: [{ starts_at, customer_name, service_name, ... }] }

  function _krw(v) {
    try { return Number(v || 0).toLocaleString('ko-KR') + '원'; }
    catch (_e) { void _e; return (v || 0) + '원'; }
  }

  function _dayRangeISO(offsetDays) {
    const t = new Date();
    if (offsetDays) t.setDate(t.getDate() + offsetDays);
    const s = new Date(t.getFullYear(), t.getMonth(), t.getDate(), 0, 0, 0);
    const e = new Date(t.getFullYear(), t.getMonth(), t.getDate(), 23, 59, 59);
    return { from: s.toISOString(), to: e.toISOString() };
  }

  function _weekRangeISO() {
    const t = new Date();
    const day = t.getDay() || 7; // 일=0 → 7로 환산 (월요일 시작 주)
    const start = new Date(t.getFullYear(), t.getMonth(), t.getDate() - (day - 1), 0, 0, 0);
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
    return { from: start.toISOString(), to: end.toISOString() };
  }

  function _formatBookings(items, label) {
    if (!items || !items.length) return `📅 ${label} 예약 없어요.`;
    const lines = items.slice(0, 8).map((b) => {
      const t = new Date(b.starts_at);
      const hh = String(t.getHours()).padStart(2, '0');
      const mm = String(t.getMinutes()).padStart(2, '0');
      const who = b.customer_name || '손님';
      const svc = b.service_name || '';
      return `${hh}:${mm} ${who}${svc ? ' · ' + svc : ''}`;
    });
    let out = `📅 ${label} 예약 ${items.length}건\n` + lines.join('\n');
    if (items.length > 8) out += `\n... 외 ${items.length - 8}건`;
    return out;
  }

  async function _fetchJson(path) {
    const auth = (typeof window.authHeader === 'function') ? window.authHeader() : {};
    const r = await apiFetch(path, { headers: auth });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  const ASYNC_RULES = [
    // 매출 — 오늘
    {
      type: 'revenue_today',
      test: (q) => /^(오늘|금일)\s*(의)?\s*(매출|얼마|벌)/.test(q) || /오늘\s*얼마/.test(q),
      fetch: () => _fetchJson('/revenue?period=today'),
      format: (d) => {
        const t = d.total || 0;
        const c = d.count || 0;
        if (c === 0) return '📊 오늘 매출 아직 없어요. 화이팅 💪';
        return `📊 오늘 매출 **${_krw(t)}** (${c}건)`;
      },
    },
    // 매출 — 이번 주
    {
      type: 'revenue_week',
      test: (q) => /(이번|금)\s*주.*(매출|얼마|벌)/.test(q),
      fetch: () => _fetchJson('/revenue?period=week'),
      format: (d) => `📊 이번 주 매출 **${_krw(d.total || 0)}** (${d.count || 0}건)`,
    },
    // 매출 — 이번 달
    {
      type: 'revenue_month',
      test: (q) => /((이번|금|이)\s*달|월\s*매출|이달).*(매출|얼마|벌)?/.test(q) && /(매출|얼마|벌)/.test(q),
      fetch: () => _fetchJson('/revenue?period=month'),
      format: (d) => `📊 이번 달 매출 **${_krw(d.total || 0)}** (${d.count || 0}건)`,
    },
    // 매출 — 지난 달
    {
      type: 'revenue_last_month',
      test: (q) => /(지난|저번)\s*달.*(매출|얼마|벌)/.test(q),
      fetch: () => _fetchJson('/revenue?period=last_month'),
      format: (d) => `📊 지난 달 매출 **${_krw(d.total || 0)}** (${d.count || 0}건)`,
    },
    // 예약 — 오늘
    {
      type: 'bookings_today',
      test: (q) => /^(오늘|금일)\s*(의)?\s*예약/.test(q) || /^오늘\s*예약\s*(몇|얼마)?/.test(q),
      fetch: () => {
        const r = _dayRangeISO(0);
        return _fetchJson(`/bookings?from=${encodeURIComponent(r.from)}&to=${encodeURIComponent(r.to)}`);
      },
      format: (d) => _formatBookings(d.items, '오늘'),
    },
    // 예약 — 내일
    {
      type: 'bookings_tomorrow',
      test: (q) => /^내일\s*예약/.test(q) || /내일\s*몇\s*건/.test(q),
      fetch: () => {
        const r = _dayRangeISO(1);
        return _fetchJson(`/bookings?from=${encodeURIComponent(r.from)}&to=${encodeURIComponent(r.to)}`);
      },
      format: (d) => _formatBookings(d.items, '내일'),
    },
    // 예약 — 이번 주
    {
      type: 'bookings_week',
      test: (q) => /(이번|금)\s*주\s*예약/.test(q),
      fetch: () => {
        const r = _weekRangeISO();
        return _fetchJson(`/bookings?from=${encodeURIComponent(r.from)}&to=${encodeURIComponent(r.to)}`);
      },
      format: (d) => _formatBookings(d.items, '이번 주'),
    },
  ];

  // 매칭만 — 동기. fetch 진입 전 사용자 메시지 표시 + loading 띄울 수 있도록 분리.
  function findAsyncRule(text) {
    if (_disabled()) return null;
    const q = _trim(text);
    if (!q || q.length > 40) return null;
    for (const rule of ASYNC_RULES) {
      try { if (rule.test(q)) return rule; }
      catch (_e) { void _e; }
    }
    return null;
  }

  // 매칭된 규칙 실행 — async. fetch 실패 시 throw → caller 가 LLM fallback 또는 에러 메시지 결정.
  async function execAsyncRule(rule) {
    const data = await rule.fetch();
    const response = rule.format(data);
    _bumpStats(rule.type);
    return { matched: true, type: rule.type, response };
  }

  // ─── [P0-4-SQL] 예약 취소 SQL-first ─────────────────────
  // "{이름} 예약 취소" 패턴 매칭 → FE 가 직접 customer + booking 조회
  // → cancel_booking action 객체 만들어서 호출자에게 반환
  // → 호출자(app-assistant.js)가 기존 카드 렌더링 흐름에 그대로 투입
  // → 사장님이 카드 '실행' 버튼 → P0-4 nativeConfirm → /assistant/execute
  // LLM 안 거침. SYSTEM_PROMPT 이슈 우회. 즉시 카드 표시.

  // "취소" 또는 "캔슬" 동사 패턴
  const _CANCEL_VERB = /(취소|삭제|지워|없애|캔슬)/;
  // "전부 / 모두 / 다 / 싹 / 전체 / 모조리" — 일괄 취소 의도
  const _CANCEL_ALL = /(전부|모두|모조리|싹|전체|싸그리)|(\s|^)다\s*(취소|지워|삭제|캔슬)/;

  // 이름 추출 노이즈 차단 — 날짜·시간·서비스명·일반 동사 제거
  const _NAME_STOP_WORDS = new Set([
    '예약', '취소', '삭제', '캔슬', '전부', '모두', '전체', '모조리',
    '오늘', '내일', '모레', '어제', '이번', '다음', '저번', '지난',
    '주말', '평일', '월요', '화요', '수요', '목요', '금요', '토요', '일요',
    '리터치', '볼륨', '머리', '자연', '붙임', '옴브레', '커트', '염색',
    '하라', '하라고', '해줘', '해주', '부탁', '제발',
    '라고', '이라고', '이라', '에게', '한테', '에서', '으로', '까지',
  ]);

  // 날짜·시간 토큰을 공백으로 치환 (이름 후보에서 "5월 21일거"의 "일거" 같은 가짜 후보 차단)
  function _stripDateTokens(t) {
    return t
      .replace(/\d+\s*월\s*\d+\s*일(?:거|치|에|은|이|을|의)?/g, ' ')  // "5월 21일", "5월 21일거"
      .replace(/\d{1,2}\/\d{1,2}/g, ' ')                                  // "5/21"
      .replace(/\d{1,2}:\d{2}/g, ' ')                                     // "03:00"
      .replace(/\d+\s*시(\s*\d+\s*분)?/g, ' ')                            // "3시", "3시 30분"
      .replace(/\d+\s*분/g, ' ')
      .replace(/(오늘|내일|모레|어제|이번\s*주|다음\s*주|저번\s*주|지난\s*주|이번\s*달|지난\s*달|다음\s*달|이번\s*주말|주말|평일|월요일?|화요일?|수요일?|목요일?|금요일?|토요일?|일요일?)/g, ' ');
  }

  // 날짜 힌트 추출 → { y, m, d } 또는 { dayOffset: 0|1|2 } 또는 null
  function _extractDateHint(q) {
    const today = new Date();
    const md = q.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/) || q.match(/(\d{1,2})\/(\d{1,2})/);
    if (md) {
      return { y: today.getFullYear(), m: parseInt(md[1], 10), d: parseInt(md[2], 10) };
    }
    if (/오늘|금일/.test(q))  return { dayOffset: 0 };
    if (/내일/.test(q))      return { dayOffset: 1 };
    if (/모레/.test(q))      return { dayOffset: 2 };
    return null;
  }

  // 예약이 날짜 힌트와 매칭되는지 확인
  function _bookingMatchesDate(b, hint) {
    if (!hint || !b || !b.starts_at) return true;
    const t = new Date(b.starts_at);
    if (hint.dayOffset != null) {
      const ref = new Date();
      ref.setDate(ref.getDate() + hint.dayOffset);
      return t.getFullYear() === ref.getFullYear()
          && t.getMonth() === ref.getMonth()
          && t.getDate() === ref.getDate();
    }
    if (hint.y != null) {
      return t.getFullYear() === hint.y
          && (t.getMonth() + 1) === hint.m
          && t.getDate() === hint.d;
    }
    return true;
  }

  // 이름 추출 — 날짜 토큰 제거 후 한글 2~5자 후보 중 stop-word 제외, 마지막 후보 우선.
  // 이유: "5월 21일거 예약취소하라고 장수아" 같이 이름이 뒤쪽에 오는 자연어 패턴 대응.
  function _extractCancelTarget(q) {
    const t = _trim(q);
    if (!_CANCEL_VERB.test(t)) return null;
    if (!/예약/.test(t)) return null;
    const stripped = _stripDateTokens(t);
    const candidates = [];
    const re = /([가-힣]{2,5})/g;
    let m;
    while ((m = re.exec(stripped)) !== null) {
      const w = m[1];
      if (_NAME_STOP_WORDS.has(w)) continue;
      // stop word 가 후보 안에 부분 포함된 경우도 제외 ("취소하" → '취소' 포함)
      let blocked = false;
      _NAME_STOP_WORDS.forEach((s) => { if (w.includes(s)) blocked = true; });
      if (blocked) continue;
      candidates.push(w);
    }
    if (!candidates.length) return null;
    // 마지막 후보를 이름으로 (취소 동사 뒤에 이름이 오는 한국어 패턴 우세)
    return { name: candidates[candidates.length - 1], all: _CANCEL_ALL.test(t), dateHint: _extractDateHint(t) };
  }

  // 두 이름 유사도 — fuzzy match (포함 / 정확 / 끝글자 매칭)
  function _nameMatches(target, candidate) {
    if (!target || !candidate) return false;
    if (target === candidate) return 100;
    if (candidate.includes(target)) return 90;
    if (target.includes(candidate)) return 80;
    // 끝 2글자 매칭 (성 제외 이름)
    if (target.length >= 2 && candidate.length >= 2 && target.slice(-2) === candidate.slice(-2)) return 60;
    return 0;
  }

  function _formatBookingShort(b) {
    try {
      const t = new Date(b.starts_at);
      const m = String(t.getMonth() + 1).padStart(2, '0');
      const d = String(t.getDate()).padStart(2, '0');
      const hh = String(t.getHours()).padStart(2, '0');
      const mm = String(t.getMinutes()).padStart(2, '0');
      return `${m}/${d} ${hh}:${mm}`;
    } catch (_e) { void _e; return ''; }
  }

  // 결과 객체:
  //   { matched: true, kind: 'card', action: {...} }  → caller 가 카드 렌더
  //   { matched: true, kind: 'message', text: '...' } → caller 가 텍스트만 표시
  //   { matched: true, kind: 'choices', candidates: [...] }  → 후보 여러 명
  async function tryCancelBooking(text) {
    if (_disabled()) return null;
    const target = _extractCancelTarget(text);
    if (!target) return null;

    // 1) 고객 검색 — 전체 리스트 받아서 FE 필터 (BE 에 q 파라미터 없음)
    let customers;
    try {
      const r = await _fetchJson('/customers?limit=500');
      customers = (r && r.items) || [];
    } catch (_e) {
      void _e;
      return { matched: true, kind: 'message', text: '⚠️ 고객 정보 조회 실패. 잠시 후 다시.' };
    }

    const scored = customers
      .map((c) => ({ c, score: _nameMatches(target.name, c.name || '') }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      return { matched: true, kind: 'message', text: `🔍 ${target.name}님 정보를 찾지 못했어요. 이름 다시 확인해 주세요.` };
    }

    // 동점 후보 여러 명이면 선택 안내
    const topScore = scored[0].score;
    const tied = scored.filter((x) => x.score === topScore);
    if (tied.length > 1 && topScore < 100) {
      const lines = tied.slice(0, 5).map((x) => `· ${x.c.name}${x.c.phone ? ' (' + x.c.phone + ')' : ''}`);
      return {
        matched: true,
        kind: 'message',
        text: `🔍 비슷한 이름 ${tied.length}명 있어요. 정확한 이름·전화번호로 다시 알려주세요:\n${lines.join('\n')}`,
      };
    }

    const customer = tied[0].c; // 최고 점수 1명

    // 2) 미래 예약 조회
    const nowISO = new Date().toISOString();
    const futureEndISO = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(); // 90일 안
    let bookings;
    try {
      const r = await _fetchJson(`/bookings?from=${encodeURIComponent(nowISO)}&to=${encodeURIComponent(futureEndISO)}`);
      bookings = ((r && r.items) || []).filter((b) =>
        b.customer_id === customer.id || (b.customer_name && b.customer_name === customer.name)
      ).filter((b) => b.status !== 'cancelled');
    } catch (_e) {
      void _e;
      return { matched: true, kind: 'message', text: '⚠️ 예약 정보 조회 실패. 잠시 후 다시.' };
    }

    if (bookings.length === 0) {
      return { matched: true, kind: 'message', text: `📅 ${customer.name}님의 예정된 예약이 없어요.` };
    }

    // 날짜 힌트가 있으면 해당 날짜로 필터링 (예: "5월 21일거 장수아 예약취소")
    let filtered = bookings;
    if (target.dateHint) {
      filtered = bookings.filter((b) => _bookingMatchesDate(b, target.dateHint));
      if (filtered.length === 0) {
        const lines = bookings.slice(0, 5).map((b) => `· ${_formatBookingShort(b)}${b.service_name ? ' ' + b.service_name : ''}`);
        return {
          matched: true,
          kind: 'message',
          text: `📅 ${customer.name}님 해당 날짜에 예약 없어요. 예정 예약 ${bookings.length}건:\n${lines.join('\n')}`,
        };
      }
    }

    // "전부 / 모두 / 다" — 일괄 취소 카드 (한 번 확인 → 순차 실행)
    if (target.all && filtered.length > 1) {
      const lines = filtered.map((b) => `· ${_formatBookingShort(b)}${b.service_name ? ' ' + b.service_name : ''}`);
      const action = {
        kind: 'cancel_booking_bulk',
        payload: {
          booking_ids: filtered.map((b) => b.id),
          customer_id: customer.id,
          customer_name: customer.name,
        },
        confirmation_text: `${customer.name}님 예정 예약 ${filtered.length}건 전부 취소할까요?\n${lines.join('\n')}`,
        confidence: 0.95,
        _source_question: text,
      };
      _bumpStats('cancel_booking_bulk');
      return { matched: true, kind: 'card', action, customer };
    }

    if (filtered.length > 1) {
      const lines = filtered.slice(0, 5).map((b) => `· ${_formatBookingShort(b)}${b.service_name ? ' ' + b.service_name : ''}`);
      return {
        matched: true,
        kind: 'message',
        text: `📅 ${customer.name}님 예정 예약 ${filtered.length}건. 어느 예약 취소할지 시간 알려주세요 (전부 취소하려면 "전부" 라고 말씀해주세요):\n${lines.join('\n')}`,
      };
    }

    // 정확히 1건 → cancel_booking action 객체 생성 → caller 가 카드로 렌더
    const b = filtered[0];
    const action = {
      kind: 'cancel_booking',
      payload: {
        booking_id: b.id,
        customer_id: customer.id,
        customer_name: customer.name,
      },
      confirmation_text: `${customer.name}님 ${_formatBookingShort(b)}${b.service_name ? ' ' + b.service_name : ''} 예약 취소할까요?`,
      confidence: 0.95,
      _source_question: text,
      _ai_original: { booking_id: b.id, customer_name: customer.name },
    };
    _bumpStats('cancel_booking');
    return { matched: true, kind: 'card', action, customer, booking: b };
  }

  // ─── [T-008] 예약 생성 자연어 ("{이름} 예약 잡아줘") ────────
  //   안전 설계: 자연어 시간 파싱은 오인 위험이 커서 하지 않고, 고객을 해석해
  //   예약 화면을 고객까지 채워서 연다(대시보드 "예약 잡기"와 동일 _pendingBookingCustomer 패턴).
  const _CREATE_VERB = /예약\s*(을|를)?\s*(잡아\s*줘|잡아주|잡아|잡아라|잡|추가|등록|넣어\s*줘|넣어|만들어\s*줘|만들어)/;
  const _CREATE_STOPS = new Set(['잡아', '잡아줘', '추가', '등록', '넣어', '만들어', '손님', '고객', '님', '이', '그', '저', '새']);

  function _extractCreateTarget(q) {
    const t = _trim(q);
    if (_CANCEL_VERB.test(t)) return null;   // 취소 의도가 우선
    if (!_CREATE_VERB.test(t)) return null;
    if (!/예약/.test(t)) return null;
    const stripped = _stripDateTokens(t);
    const candidates = [];
    const re = /([가-힣]{2,5})/g;
    let m;
    while ((m = re.exec(stripped)) !== null) {
      const w = m[1];
      if (_NAME_STOP_WORDS.has(w) || _CREATE_STOPS.has(w)) continue;
      let blocked = false;
      _NAME_STOP_WORDS.forEach((s) => { if (w.includes(s)) blocked = true; });
      _CREATE_STOPS.forEach((s) => { if (s.length >= 2 && w.includes(s)) blocked = true; });
      if (blocked) continue;
      candidates.push(w);
    }
    // 이름 없으면("이 손님 예약 잡아줘") name='' → 고객 미지정으로 예약 화면 오픈.
    return { name: candidates.length ? candidates[candidates.length - 1] : '', dateHint: _extractDateHint(t) };
  }

  // 결과: { matched, kind:'open_booking', customer:{id,name}|null, text } 또는 { kind:'message', text }
  async function tryCreateBooking(text) {
    if (_disabled()) return null;
    const target = _extractCreateTarget(text);
    if (!target) return null;

    if (!target.name) {
      return { matched: true, kind: 'open_booking', customer: null, text: '예약 화면을 열었어요. 고객과 시간을 골라주세요.' };
    }

    let customers;
    try {
      const r = await _fetchJson('/customers?limit=500');
      customers = (r && r.items) || [];
    } catch (_e) {
      void _e;
      return { matched: true, kind: 'message', text: '⚠️ 고객 정보 조회 실패. 잠시 후 다시.' };
    }

    const scored = customers
      .map((c) => ({ c, score: _nameMatches(target.name, c.name || '') }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      return { matched: true, kind: 'open_booking', customer: null,
        text: `🔍 ${target.name}님을 못 찾았어요. 예약 화면을 열었으니 새 고객으로 추가하거나 다른 고객을 선택해 주세요.` };
    }

    const topScore = scored[0].score;
    const tied = scored.filter((x) => x.score === topScore);
    if (tied.length > 1 && topScore < 100) {
      const lines = tied.slice(0, 5).map((x) => `· ${x.c.name}${x.c.phone ? ' (' + x.c.phone + ')' : ''}`);
      return { matched: true, kind: 'message',
        text: `🔍 비슷한 이름 ${tied.length}명 있어요. 정확한 이름으로 다시 알려주세요:\n${lines.join('\n')}` };
    }

    const customer = tied[0].c;
    _bumpStats('create_booking');
    return { matched: true, kind: 'open_booking', customer: { id: customer.id, name: customer.name },
      text: `${customer.name}님으로 예약 화면을 열었어요. 시간을 골라주세요.` };
  }

  // ─── public API ─────────────────────────────────────────
  window.AssistantIntent = {
    classifyObvious,
    findAsyncRule,
    execAsyncRule,
    tryCreateBooking,
    tryCancelBooking,
    // 디버깅용 — 현재 통계 조회
    getStats: () => ({ ...window[STATS_KEY], byType: { ...window[STATS_KEY].byType } }),
    // 디버깅용 — 통계 리셋
    resetStats: () => { window[STATS_KEY] = { hits: 0, total: 0, byType: {} }; },
  };
})();
