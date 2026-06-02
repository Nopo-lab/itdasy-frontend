/* 잇비 오늘 브리핑 — 매출 우선순위 랭킹 (④ · 2026-06-02)

   신호 나열 대신 "매출 영향 × 긴급도 × 실행 쉬움 × 신뢰도"로 점수화 → TOP 랭킹.
   잇데이 정체성: "오늘 돈 되는 일 먼저". 자동 발송/예약/매출생성 0 — 추천·초안·confirm 버튼만.

   입력: signals = { retouch:{count,customers[]}, emptySlots:[{from}], atRisk:{count},
                     unrecorded:{count}, unlinked:{count}, revenueTotal, avgTicket? }
   출력: { items: [{key,title,reason,effect,safety, actions:[{...}]}], summaryLine, fallback? } */
(function () {
  'use strict';
  if (window.ItdasyBriefingPriority) return;

  // 매출 추정 — 객단가(avgTicket) 있을 때만 보수 범위, 없으면 정성 표현(허위 예측 금지).
  function _estRange(n, avgTicket, lo, hi) {
    if (!avgTicket || avgTicket <= 0 || !n) return '';
    var min = Math.round(n * avgTicket * lo / 10000), max = Math.round(n * avgTicket * hi / 10000);
    if (max <= 0) return '';
    return min === max ? ('추정 ' + min + '만원') : ('추정 ' + min + '~' + max + '만원');
  }

  // 각 신호 → 점수 컴포넌트. score = revenueImpact + urgency + actionability + confidence.
  function _candidates(s, avgTicket) {
    var c = [];
    if (s.retouch && s.retouch.count > 0) {
      var rc = s.retouch.count, custs = (s.retouch.customers || []).slice(0, 3);
      var est = _estRange(Math.min(rc, 3), avgTicket, 0.7, 1.0);
      c.push({ key: 'retouch', score: 5 + 4 + 4 + 3, count: rc,
        title: '리터치 안내 ' + rc + '명' + (est ? ' — ' + est + ' 회수 가능' : ' — 재방문 회수 가능'),
        reason: '최근 시술 후 재방문 타이밍이에요. 안내 한 번이면 예약으로 이어지기 쉬워요.',
        effect: est || '재방문 가능성이 높은 액션',
        actions: [
          { id: 'retouch_draft', kind: 'retouch_draft', label: '리터치 초안 만들기', safety: 'safe', payload: { customers: custs } },
          { id: 'retouch_cust', kind: 'open_at_risk', label: '고객 상태 확인', safety: 'safe', payload: {} },
        ] });
    }
    if (s.unrecorded && s.unrecorded.count > 0) {
      var uc = s.unrecorded.count, uEst = _estRange(uc, avgTicket, 1.0, 1.0);
      c.push({ key: 'unrecorded', score: 6 + 3 + 4 + 4, count: uc,
        title: '미기록 매출 ' + uc + '건' + (uEst ? ' — ' + uEst + ' 정산 누락 가능' : ' — 정산 누락 가능'),
        reason: '완료된 예약인데 매출 기록이 비어 있어요. 정리하면 매출 누락을 막아요.',
        effect: uEst ? uEst + ' 누락 방지' : '매출 누락 방지',
        actions: [
          { id: 'unrec_open', kind: 'open_unrecorded', label: '매출 확인', safety: 'safe', payload: {} },
          { id: 'unrec_rec', kind: 'record_revenue', label: '매출 기록하기', safety: 'confirm', payload: {} },
        ] });
    }
    if (s.emptySlots && s.emptySlots.length > 0) {
      var first = s.emptySlots[0] && s.emptySlots[0].from;
      c.push({ key: 'empty_slot', score: 3 + 4 + 3 + 3, count: s.emptySlots.length,
        title: '빈 시간 ' + s.emptySlots.length + '개 — 예약 유도 가능' + (first ? ' (' + first + ' 등)' : ''),
        reason: '오늘 공백을 단골·이탈 고객 안내로 채우면 매출 회수에 도움돼요.',
        effect: '빈 시간 회수 가능',
        actions: [
          { id: 'slot_view', kind: 'open_empty_slot', label: '빈시간 보기', safety: 'safe', payload: {} },
          { id: 'slot_revisit', kind: 'at_risk_revisit', label: '재방문 초안', safety: 'safe', payload: {} },
        ] });
    }
    if (s.atRisk && s.atRisk.count > 0) {
      c.push({ key: 'at_risk', score: 4 + 3 + 3 + 2, count: s.atRisk.count,
        title: '한동안 안 오신 고객 ' + s.atRisk.count + '명 — 재방문 유도',
        reason: '방문 주기가 늘어진 고객이에요. 안부·재방문 안내로 이탈을 늦출 수 있어요.',
        effect: '이탈 방지 / 재방문 유도',
        actions: [
          { id: 'risk_revisit', kind: 'at_risk_revisit', label: '재방문 초안', safety: 'safe', payload: {} },
          { id: 'risk_cust', kind: 'open_at_risk', label: '고객 상태 확인', safety: 'safe', payload: {} },
        ] });
    }
    if (s.unlinked && s.unlinked.count > 0) {
      c.push({ key: 'unlinked', score: 3 + 2 + 4 + 4, count: s.unlinked.count,
        title: '미연결 사진 ' + s.unlinked.count + '장 — 콘텐츠·기록 활용',
        reason: '저장만 된 시술 사진이에요. 고객 기록에 붙이거나 홍보물로 만들 수 있어요.',
        effect: '콘텐츠·재방문 마케팅 자산',
        actions: [
          { id: 'unlinked_view', kind: 'open_unlinked_photos', label: '사진 기록 확인', safety: 'safe', payload: {} },
          { id: 'unlinked_promo', kind: 'promo_from_photo', label: '홍보용으로 정리', safety: 'safe', payload: {} },
        ] });
    }
    return c;
  }

  // 신호 → TOP n 랭킹. 없으면 fallback(빈 화면 방지).
  function rank(signals, opts) {
    opts = opts || {};
    var s = signals || {};
    var avgTicket = +s.avgTicket || 0;
    var cands = _candidates(s, avgTicket);
    cands.sort(function (a, b) { return b.score - a.score; });
    var top = cands.slice(0, opts.limit || 3);
    if (!top.length) {
      return { items: [], fallback: true,
        summaryLine: '오늘은 급한 매출 액션은 적어요. 대신 홍보 사진 1장 만들기나 고객 기록 정리부터 추천해요.',
        fallbackActions: [
          { id: 'fb_promo', kind: 'promo_from_photo', label: '홍보 사진 만들기', safety: 'safe', payload: {} },
          { id: 'fb_unlinked', kind: 'open_unlinked_photos', label: '고객 기록 정리', safety: 'safe', payload: {} },
        ] };
    }
    var order = top.map(function (t) {
      return ({ retouch: '리터치 안내', unrecorded: '미기록 매출', empty_slot: '빈 시간 회수', at_risk: '재방문 유도', unlinked: '사진 정리' })[t.key];
    });
    return { items: top, fallback: false,
      summaryLine: '오늘은 ' + order.join(' → ') + ' 순으로 챙기면 좋아요.' };
  }

  window.ItdasyBriefingPriority = { rank };
})();
