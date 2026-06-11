/* 잇비 메모리(영구 메모) 인텐트 — 클라이언트 가로채기 (2026-06-12)

   문제(QA #7): "기억해"가 백엔드 LLM 으로 가서, 같은 의미를 다시 말해도
     - 매번 "메모에 추가할게요" 응답(이미 기억 중인지 판단 못함)
     - 백엔드 dedupe 가 '정확 일치'뿐이라 재표현 변형("보정전 확인" vs "보정 전 확인하는 것")이 중복 저장됨.
   해결: 채팅 전송 전에 클라이언트가 메모 의도를 가로채서
     1) 기존 메모(GET /assistant/facts) 와 정규화/유사 비교로 dedupe
     2) 중복이면 저장 안 하고 "이미 기억하고 있어요" 응답
     3) 새거면 POST /assistant/facts → "기억할게요" 응답
     4) "기억하고 있어?"·"뭐 기억해?" = 회상, "기억하지 마"·"잊어줘" = 삭제
   persistence 는 기존 facts API(Supabase) 그대로 → 새로고침 후에도 동일 동작.

   외부: window.ItbiMemoryIntent = { classify, handle, normalize, isSimilar } */
(function () {
  'use strict';
  if (window.ItbiMemoryIntent) return;

  // 저장 트리거(= "기억해" 류). 백엔드 _capture_user_memo 와 동일 의미군.
  var SAVE_TRIG = ['기억해줘', '기억해둬', '기억해 둬', '기억해', '기억하고', '꼭 기억', '기억 좀',
    '메모해줘', '메모해', '메모로 남겨', '메모 남겨', '노트해', '적어둬', '적어 둬', '잊지마', '잊지 마', '잊지말'];
  // 회상(= "뭐 기억해?")
  var RECALL_RE = /(기억하고\s*있어|기억\s*나|뭐\s*기억|무엇을?\s*기억|뭐라?고?\s*기억|기억하라\s*했|기억한\s*거|메모\s*(보여|뭐|목록|확인)|뭐\s*메모)/;
  // 삭제(= "기억하지 마")
  var FORGET_RE = /(기억하지\s*마|기억\s*하지마|잊어줘|잊어버려|잊어\s|메모\s*(지워|삭제|빼)|그거\s*(지워|잊)|기억\s*(삭제|지워))/;

  // 토큰 끝 조사/어미 제거(정규화·핵심어 추출 공용).
  function _stripTail(tok) {
    return tok
      .replace(/(하는\s*거|하는\s*것|하는거|하는것|하기|할게|할께|해줘|해주|하고|해요|합니다|한다)$/g, '')
      .replace(/(은|는|이|가|을|를|에|도|만|의|로|으로|랑|이랑|와|과|께|에게|한테|부터|까지|보다)$/g, '')
      .replace(/(거|것|걸|게|요|줘|함|해)$/g, '');
  }

  // 공백/문장부호 제거 + 소문자. 유사도(부분포함·bigram)용.
  function normalize(s) {
    return String(s || '').toLowerCase()
      .replace(/[\s,.!?~·…"'()[\]{}<>\-—:;]/g, '')
      .replace(/(기억해줘|기억해둬|기억해|메모해줘|메모해|잊지마|잊지말|잊지\s*마)/g, '');
  }

  var FILLER = { '그': 1, '거': 1, '이거': 1, '그거': 1, '좀': 1, '꼭': 1, '항상': 1, '매번': 1, '그냥': 1, '그리고': 1, '나': 1, '내가': 1, '제발': 1, '먼저': 1, '다시': 1 };
  // 핵심어 집합(공백 분리 → 조사/어미 strip → 2자 이상 content 토큰).
  function coreTokens(s) {
    var raw = String(s || '').toLowerCase()
      .replace(/[,.!?~·…"'()[\]{}<>\-—:;]/g, ' ')
      .replace(/(기억해줘|기억해둬|기억해|메모해줘|메모해|잊지마|잊지말|잊지\s*마|꼭|좀)/g, ' ');
    var set = {};
    raw.split(/\s+/).forEach(function (t) {
      var k = _stripTail(t.trim());
      if (k.length >= 2 && !FILLER[k]) set[k] = 1;
    });
    return Object.keys(set);
  }

  // 두 메모가 같은 의미인지 판정.
  //   [2026-06-12 병합QA] 기존 bigram Jaccard≥0.6 / 핵심어 부분커버리지(≥0.6) 경로는
  //     "화요일/수요일", "김민지/김민수", "건물 앞/뒤" 처럼 구별 토큰만 다른 별개 메모를
  //     거짓 병합(=저장 거부 데이터 손실)했다. → 제거하고 "짧은 쪽 토큰이 전부 포함될 때"만 인정.
  //   인정: 정규화 정확일치 / 한쪽이 다른쪽 완전포함(≥4자) / 핵심어 짧은쪽 100% 커버(≥2토큰).
  function isSimilar(a, b) {
    var na = normalize(a), nb = normalize(b);
    if (!na || !nb) return false;
    if (na === nb) return true;
    if (na.length >= 4 && nb.length >= 4 && (na.indexOf(nb) !== -1 || nb.indexOf(na) !== -1)) return true;
    // 핵심어 커버리지 — 조사/어미 strip 후, 짧은 쪽 토큰이 (부분포함 매칭으로) 모두 긴 쪽에 있을 때만.
    //   "보정전"⊃"보정", "확인하"⊃"확인" 변형은 흡수, 구별 토큰이 하나라도 빠지면 별개로 본다.
    var ca = coreTokens(a), cb = coreTokens(b);
    if (ca.length >= 2 && cb.length >= 2) {
      var shorter = ca.length <= cb.length ? ca : cb;
      var longer = ca.length <= cb.length ? cb : ca;
      var covered = shorter.filter(function (s) {
        return longer.some(function (l) {
          return l === s || (s.length >= 2 && l.indexOf(s) !== -1) || (l.length >= 2 && s.indexOf(l) !== -1);
        });
      }).length;
      if (covered === shorter.length) return true;
    }
    return false;
  }

  // 저장 모드일 때 메모 본문 추출(백엔드 _capture_user_memo 와 동일 규칙).
  function _extractMemo(q) {
    var t = String(q || '').trim();
    var trig = null, idx = -1;
    for (var i = 0; i < SAVE_TRIG.length; i++) {
      var p = t.indexOf(SAVE_TRIG[i]);
      if (p !== -1) { trig = SAVE_TRIG[i]; idx = p; break; }
    }
    if (trig == null) return '';
    var before = t.slice(0, idx).replace(/[\s,.\-—:]+$/, '').trim();
    var after = t.slice(idx + trig.length).replace(/^[\s,.\-—:]+/, '').trim();
    var memo = before.length >= 2 ? before : (after.length >= 2 ? after : t.replace(trig, '').trim());
    return memo.slice(0, 500).trim();
  }

  function classify(q) {
    var t = String(q || '').trim();
    if (!t) return null;
    if (FORGET_RE.test(t)) return { mode: 'forget' };
    // 회상은 "기억해"(저장)보다 먼저 — "뭐 기억해?"가 저장으로 오분류되지 않게.
    if (RECALL_RE.test(t)) return { mode: 'recall' };
    for (var i = 0; i < SAVE_TRIG.length; i++) {
      if (t.indexOf(SAVE_TRIG[i]) !== -1) {
        var memo = _extractMemo(t);
        if (memo.length < 2) return { mode: 'save_empty' };
        return { mode: 'save', text: memo };
      }
    }
    return null;
  }

  async function _facts() {
    try {
      var headers = window.authHeader ? window.authHeader() : {};
      var res = await window.apiFetch('/assistant/facts', { headers: headers });
      if (!res.ok) return [];
      var data = await res.json().catch(function () { return []; });
      return Array.isArray(data) ? data : [];
    } catch (_e) { return []; }
  }
  async function _addFact(text) {
    var headers = window.authHeader ? window.authHeader() : {};
    headers['Content-Type'] = 'application/json';
    var res = await window.apiFetch('/assistant/facts', { method: 'POST', headers: headers, body: JSON.stringify({ text: text, kind: 'permanent' }) });
    return res.ok;
  }
  async function _delFact(id) {
    var headers = window.authHeader ? window.authHeader() : {};
    var res = await window.apiFetch('/assistant/facts/' + id, { method: 'DELETE', headers: headers });
    return res.ok;
  }

  // 반환: { reply, saved?, duplicate? } — app-assistant 가 채팅 말풍선으로 렌더.
  async function handle(q) {
    var c = classify(q);
    if (!c) return null;

    if (c.mode === 'save_empty') {
      return { reply: '무엇을 기억할까요? "화요일 오전 예약 안 받음" 처럼 알려주시면 메모에 적어둘게요.' };
    }

    if (c.mode === 'recall') {
      var facts = await _facts();
      if (!facts.length) return { reply: '아직 기억하고 있는 메모가 없어요. "○○ 기억해" 라고 알려주시면 챙길게요.' };
      var lines = facts.slice(0, 12).map(function (f) { return '• ' + f.text; }).join('\n');
      var more = facts.length > 12 ? ('\n…외 ' + (facts.length - 12) + '개') : '';
      return { reply: '지금 이런 걸 기억하고 있어요 🧠\n' + lines + more, openSheet: true };
    }

    if (c.mode === 'forget') {
      // 본문이 함께 오면 그 메모를 찾아 삭제, 아니면 메모 시트를 열어 직접 고르게.
      var body = String(q).replace(FORGET_RE, '').replace(/[\s,.\-—:]+/g, ' ').trim();
      var all = await _facts();
      if (body.length >= 2 && all.length) {
        var hit = all.find(function (f) { return isSimilar(f.text, body); });
        if (hit) {
          var ok = await _delFact(hit.id);
          return { reply: ok ? ('"' + hit.text + '" 메모를 지웠어요.') : '메모 삭제에 실패했어요. 잠시 후 다시 시도해 주세요.' };
        }
      }
      return { reply: '어떤 메모를 지울지 메모장에서 골라주세요.', openSheet: true };
    }

    // save
    var existing = await _facts();
    var dup = existing.find(function (f) { return isSimilar(f.text, c.text); });
    if (dup) {
      return { reply: '이미 기억하고 있어요. "' + dup.text + '" 챙길게요 🙂', saved: false, duplicate: true };
    }
    var added = await _addFact(c.text);
    return added
      ? { reply: '기억했어요 🧠 "' + c.text + '" — 앞으로 참고할게요.', saved: true }
      : { reply: '메모 저장에 실패했어요. 잠시 후 다시 시도해 주세요.', saved: false };
  }

  window.ItbiMemoryIntent = { classify: classify, handle: handle, normalize: normalize, isSimilar: isSimilar, coreTokens: coreTokens };
})();
