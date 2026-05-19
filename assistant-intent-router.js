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
      response: '저는 잇데이 AI 비서예요. 사장님의 1인샵 운영을 도와드리는 만능 도우미예요. 예약·매출·고객·사진·마케팅 다 해드릴게요 😊',
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

  // ─── public API ─────────────────────────────────────────
  window.AssistantIntent = {
    classifyObvious,
    // 디버깅용 — 현재 통계 조회
    getStats: () => ({ ...window[STATS_KEY], byType: { ...window[STATS_KEY].byType } }),
    // 디버깅용 — 통계 리셋
    resetStats: () => { window[STATS_KEY] = { hits: 0, total: 0, byType: {} }; },
  };
})();
