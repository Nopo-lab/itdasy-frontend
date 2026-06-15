/* 잇비 고객 추가 안전 확인
   "{이름} 고객 추가" 요청 시 같은 이름이 이미 있으면 먼저 확인한다. */
(function () {
  'use strict';

  const TTL_MS = 5 * 60 * 1000;
  let pending = null;

  function _trim(s) { return String(s == null ? '' : s).trim(); }
  function _fresh() { return pending && Date.now() - pending.ts < TTL_MS; }

  function _looksAddCustomer(q) {
    const t = _trim(q);
    if (!/(고객|손님)/.test(t) || !/(추가|등록|만들|넣어)/.test(t)) return false;
    return !/(예약|매출|사진|기록|문자|메시지|메세지|캡션|홍보|가격표|템플릿)/.test(t);
  }

  function _extractName(q) {
    let s = _trim(q).replace(/^잇비\s*/, ' ');
    s = s.replace(/(고객님|고객|손님|추가|등록|새로|새|만들어줘|만들어|만들|넣어줘|넣어|해줘|해|주세요|님)/g, ' ');
    const words = s.match(/[가-힣]{2,5}/g) || [];
    const stops = new Set(['잇비', '고객', '손님', '추가', '등록']);
    return words.find((w) => !stops.has(w)) || '';
  }

  async function _customers() {
    if (typeof window.apiFetch !== 'function') return [];
    const res = await window.apiFetch('/customers?limit=500', { headers: window.authHeader ? window.authHeader() : {} });
    if (!res || !res.ok) return [];
    const data = await res.json().catch(() => ({}));
    return (data && data.items) || [];
  }

  function _sameName(name, c) {
    return _trim(c && c.name) === name;
  }

  function _infoLines(c) {
    const lines = [`이름: ${_trim(c.name) || '이름 없음'}`];
    if (c.phone) lines.push(`연락처: ${c.phone}`);
    const memo = c.memo || c.notes || c.note || c.memo_md;
    if (memo) lines.push(`메모: ${String(memo).slice(0, 60)}`);
    if (c.last_visit_at || c.last_visit) lines.push(`최근 방문: ${String(c.last_visit_at || c.last_visit).slice(0, 10)}`);
    return lines;
  }

  function _existingResult(name, customer) {
    pending = { ts: Date.now(), name, customer };
    return {
      matched: true,
      kind: 'message',
      text: `${name}님은 고객 명단에 이미 있어요.\n\n이 고객님 맞나요?\n${_infoLines(customer).join('\n')}`,
      related: [`맞아요 ${name} 고객 기록 열기`, `${name} 새 고객으로 추가`, '아니에요'],
    };
  }

  function _createAction(name, source) {
    return {
      kind: 'create_customer',
      payload: { customer_name: name },
      confirmation_text: `${name}님을 새 고객으로 따로 추가할까요?`,
      _source_question: source,
    };
  }

  function _openExisting(customer) {
    setTimeout(() => {
      try {
        if (typeof window.openCustomerDashboard === 'function') window.openCustomerDashboard(customer.id);
        else if (typeof window.openCustomers === 'function') window.openCustomers();
      } catch (_e) { void _e; }
    }, 80);
  }

  function _followup(q) {
    if (!_fresh()) return null;
    const text = _trim(q);
    const p = pending;
    if (/(새|따로|추가|등록|새로)/.test(text)) {
      pending = null;
      return { matched: true, kind: 'card', action: _createAction(p.name, q) };
    }
    if (/^(응|네|맞아|맞아요|그거|그\s*사람|열어|보여)/.test(text)) {
      pending = null;
      _openExisting(p.customer);
      return { matched: true, kind: 'message', text: `${p.customer.name || p.name}님 고객 기록을 열게요.` };
    }
    if (/(아니|아냐|취소|그만)/.test(text)) {
      pending = null;
      return { matched: true, kind: 'message', text: '알겠어요. 새로 추가하지 않을게요.' };
    }
    return null;
  }

  async function tryRun(text) {
    const follow = _followup(text);
    if (follow) return follow;
    if (!_looksAddCustomer(text)) return null;
    const name = _extractName(text);
    if (!name) return null;
    const list = await _customers();
    const exact = list.find((c) => _sameName(name, c));
    if (exact) return _existingResult(name, exact);
    return null;
  }

  window.ItdasyCustomerAddGuard = { tryRun };
})();
