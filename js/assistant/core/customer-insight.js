/* 잇비 고객 인사이트 (⑤ · 2026-06-02)

   고객 상태 카드를 "정보 요약"에서 "지금 이 고객에게 할 일"로 — 선호 스타일 추정 / 리터치 타이밍 / 추천 행동.
   기존 데이터(사진 라벨·시술명·메모)만 사용, 신규 백엔드 0. 자동 발송/예약/저장 0.
   추정은 보수적: "최근 기록 기준 / 추정 / 자주 보임"만, "확정" 금지. 데이터 부족이면 단정 안 함. */
(function () {
  'use strict';
  if (window.ItdasyCustomerInsight) return;

  // 업종별 스타일 키워드(사진 라벨/시술명/메모에서 검출).
  var STYLE_KW = {
    nail: ['글리터', '프렌치', '누드', '파츠', '원컬러', '젤', '아트', '그라데이션'],
    hair: ['염색', '톤다운', '탈색', '클리닉', '컷', '레이어드', '펌', '컬러'],
    lash: ['연장', '펌', '자연', '또렷', '컬', '래쉬'],
    skin: ['톤', '결', '윤기', '자연', '깨끗', '모공', '관리'],
    makeup: ['데일리', '파티', '웨딩', '촬영', '발색', '음영'],
  };
  // 업종별 재방문/리터치 권장 주기(주) [min,max].
  var CYCLE_WK = { nail: [2, 4], lash: [3, 5], hair: [4, 8], skin: [2, 4], brow: [4, 8], makeup: null };

  // texts: 고객의 사진 라벨/시술명/메모 문자열 배열. industry: nail/hair/...
  // 반환: { styles:[...], summary, hasData }
  function inferStyle(texts, industry) {
    var joined = (texts || []).filter(Boolean).join(' ');
    if (!joined.trim()) return { styles: [], summary: '선호 스타일을 판단할 기록이 아직 부족해요.', hasData: false };
    var kws = STYLE_KW[industry] || [];
    var hits = {};
    kws.forEach(function (k) { var n = (joined.match(new RegExp(k, 'g')) || []).length; if (n > 0) hits[k] = n; });
    var sorted = Object.keys(hits).sort(function (a, b) { return hits[b] - hits[a]; });
    if (!sorted.length) return { styles: [], summary: '최근 기록 기준으로는 뚜렷한 선호 스타일이 아직 안 보여요.', hasData: false };
    var top = sorted.slice(0, 2);
    return { styles: top, hasData: true, summary: '최근 기록 기준 ' + top.join('/') + ' 계열이 자주 보여요.' };
  }

  // lastVisitDays + industry → early/due/overdue/unknown + 문구.
  function retouchTiming(lastVisitDays, industry) {
    var cyc = CYCLE_WK[industry];
    if (industry === 'makeup') return { state: 'na', text: '메이크업은 이벤트성이라 재방문보다 후기·사진 활용을 추천해요.' };
    if (lastVisitDays == null) return { state: 'unknown', text: '방문 기록이 없어 리터치 타이밍은 판단하기 어려워요.' };
    if (!cyc) return { state: 'unknown', text: '업종 기준이 없어 타이밍은 참고만 해주세요.' };
    var lo = cyc[0] * 7, hi = cyc[1] * 7;
    var wkTxt = cyc[0] + '~' + cyc[1] + '주';
    if (lastVisitDays < lo) return { state: 'early', text: '마지막 방문 후 아직 이른 편이에요(' + (industry || '') + ' 권장 ' + wkTxt + '). 조금 더 기다려도 좋아요.' };
    if (lastVisitDays <= hi) return { state: 'due', text: '마지막 방문 후 ' + Math.round(lastVisitDays / 7) + '주 구간이라 부담 없는 리터치/안부 안내를 보내기 좋은 시점이에요.' };
    return { state: 'overdue', text: '권장 주기(' + wkTxt + ')를 지나 재방문 유도를 추천해요. 부담 없는 안내가 적합해요.' };
  }

  // 상태 → 추천 행동 랭킹(2~4). 각 { key, label, why }.
  //   리터치 due/overdue 우선 → 사진 있으면 홍보 → 예약없음+빈시간 → 최근방문직후 후기 → 부족시 정리.
  function recommendActions(ctx) {
    ctx = ctx || {};
    var out = [];
    var t = ctx.timing || {};
    if (t.state === 'due' || t.state === 'overdue' || ctx.isRetouchDue) {
      out.push({ key: 'retouch', label: '리터치 안내 초안 만들기', why: t.text || '리터치 안내 시점이에요.' });
    }
    if (ctx.photoCount > 0) out.push({ key: 'promo', label: '최근 사진으로 홍보 템플릿 만들기', why: '사진 기록 ' + ctx.photoCount + '장을 홍보물로 활용할 수 있어요.' });
    if (ctx.noNext) {
      out.push({ key: 'revisit', label: '빈 시간에 맞춰 재방문 안내하기', why: '다음 예약이 없어 재방문 안내가 도움돼요.' });
    }
    if (ctx.lastVisitDays != null && ctx.lastVisitDays <= 3 && out.length < 4) {
      out.push({ key: 'review', label: '후기 요청 초안 만들기', why: '최근 방문 직후라 후기 요청이 자연스러워요.' });
    }
    if (!out.length) {
      out.push({ key: 'tidy', label: '고객 기록·사진 정리하기', why: '아직 기록이 적어 정리부터 추천해요.' });
    }
    return out.slice(0, 4);
  }

  window.ItdasyCustomerInsight = { inferStyle, retouchTiming, recommendActions, STYLE_KW: STYLE_KW, CYCLE_WK: CYCLE_WK };
})();
