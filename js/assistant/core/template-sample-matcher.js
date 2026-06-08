/* 잇비 템플릿 샘플 매처 — PR-M1 (무연결 검증 단계, 2026-06-09)

   역할: 사용자 자연어를 template-sample-catalog 의 36개 샘플과 매칭/랭킹한다.
        실제 I2/I3 자동 적용에는 아직 연결하지 않는다(M2). 순수 함수 + 부수효과 0.

   API (window.ItdasyTemplateSampleMatcher / module.exports):
     matchTemplateSample(text, context)        → 최고점 샘플 1개 | null(MIN_SCORE 미달)
     rankTemplateSamples(text, context, limit)  → [{ sample, score, reasons[] }] (QA/debug)
     toAutoApplyPayload(sample, text, context)  → { templateId, purpose, industry, slotValues, overrides, photoPolicy, autoApplyEligible }
*/
(function () {
  'use strict';

  // ── 카탈로그 로드 (node: require, browser: window) ──
  function _catalog() {
    if (typeof window !== 'undefined' && window.ItdasyTemplateSampleCatalog) return window.ItdasyTemplateSampleCatalog;
    if (typeof require !== 'undefined') { try { return require('./template-sample-catalog'); } catch (_e) { /* noop */ } }
    return { SAMPLES: [] };
  }

  var MIN_SCORE = 14;   // QA 후 조정 가능. 이 미만이면 matchTemplateSample → null(폴백 유도).

  // ── purpose / industry 키워드 ──
  var PURPOSE_KW = {
    price: ['가격표', '메뉴판', '가격 안내', '시술가', '가격'],
    review: ['후기', '리뷰', 'review'],
    before_after: ['전후', '비포애프터', '비포 애프터', 'before after', 'beforeafter', 'b&a', '비교'],
    event: ['이벤트', '할인', '첫방문', '첫 방문', '재방문', '패키지'],
  };
  var INDUSTRY_KW = {
    skin: ['피부', '물광', '리쥬란', '여드름', '스킨부스터', '관리', '에스테틱'],
    nail: ['네일', '젤네일', '손젤', '패디', '페디', '아트', '손톱'],
    lash: ['속눈썹', '속눈썹펌', '연장', '래쉬'],
    hair: ['헤어', '두피', '클리닉', '염색', '펌', '붙임머리', '모발', '머릿결'],
    waxing: ['왁싱', '브라질리언', '눈썹왁싱', '제모'],
    makeup: ['메이크업', '데일리메이크업', '혼주', '촬영', '화장', '글램'],
  };

  // 금지어 → 완화 치환(긴 표현 먼저). 사용자 override 방어가 주 목적(카탈로그는 0건).
  var BANNED_MAP = [
    ['100% 좋아짐', '한층 정돈된 변화'],
    ['즉시 효과', '시술 후 변화가 더 잘 보이도록 정리'],
    ['부작용 없음', '편안하게 관리'],
    ['완치', '한결 정돈된 변화'],
    ['영구적', '오래 유지되는'],
    ['무조건', ''],
    ['100%', '한층'],
    ['보장', '약속'],
    ['치료', '케어'],
  ];

  function _norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ''); }

  function _detectPurposes(nt) {
    var out = [];
    Object.keys(PURPOSE_KW).forEach(function (p) {
      if (PURPOSE_KW[p].some(function (k) { return nt.indexOf(_norm(k)) !== -1; })) out.push(p);
    });
    return out;
  }
  function _detectIndustries(nt) {
    var out = [];
    Object.keys(INDUSTRY_KW).forEach(function (ind) {
      if (INDUSTRY_KW[ind].some(function (k) { return nt.indexOf(_norm(k)) !== -1; })) out.push(ind);
    });
    return out;
  }

  // 토큰 배열 중 정규화 텍스트에 포함된 개수(상한 cap), 매치된 토큰을 reasons 에 기록.
  function _hits(tokens, nt, cap, label, reasons, per) {
    var n = 0;
    (tokens || []).forEach(function (tok) {
      if (n >= cap) return;
      var k = _norm(tok);
      if (k && nt.indexOf(k) !== -1) { n++; reasons.push(label + ':' + tok + '+' + per); }
    });
    return n * per;
  }

  function _scoreSample(sample, nt, purposes, industries, ctx, reasons) {
    // 강한 제외: exclude / negativeTriggers 포함 시 컷.
    var excl = (sample.match && sample.match.exclude) || [];
    var neg = sample.negativeTriggers || [];
    var cutTok = excl.concat(neg).filter(function (t) { return nt.indexOf(_norm(t)) !== -1; });
    if (cutTok.length) { reasons.push('CUT(exclude/neg):' + cutTok.join(',')); return -Infinity; }

    var score = 0;
    if (purposes.indexOf(sample.purpose) !== -1) { score += 10; reasons.push('purpose:' + sample.purpose + '+10'); }
    if (industries.indexOf(sample.industry) !== -1) { score += 6; reasons.push('industry:' + sample.industry + '+6'); }
    score += _hits(sample.match && sample.match.strong, nt, 2, 'strong', reasons, 8);
    score += _hits(sample.triggers, nt, 2, 'trigger', reasons, 6);
    score += _hits(sample.match && sample.match.weak, nt, 3, 'weak', reasons, 2);

    // 사진 수 (before_after 전용)
    if (sample.purpose === 'before_after') {
      var pc = (ctx && typeof ctx.photoCount === 'number') ? ctx.photoCount : null;
      if (pc !== null) {
        if (pc >= 1) { score += 3; reasons.push('photo>=1+3'); }
        else { score -= 4; reasons.push('photo=0-4'); }
      }
    }
    // event(templateId=null): 자동 적용 후보 아님 → 약한 감점으로 실매칭보다 뒤로.
    if (sample.purpose === 'event' || sample.templateId == null) { score -= 2; reasons.push('event/no-tpl-2'); }

    // tie-break: scoreHints (작은 가중)
    var sh = sample.scoreHints || {};
    score += ((sh.purpose || 0) + (sh.industry || 0) + (sh.style || 0)) * 0.01;
    return score;
  }

  function rankTemplateSamples(text, context, limit) {
    limit = limit || 5;
    var nt = _norm(text);
    var purposes = _detectPurposes(nt);
    var industries = _detectIndustries(nt);
    var ranked = _catalog().SAMPLES.map(function (sample) {
      var reasons = [];
      var score = _scoreSample(sample, nt, purposes, industries, context, reasons);
      return { sample: sample, score: score, reasons: reasons };
    }).filter(function (r) { return r.score > -Infinity; });
    ranked.sort(function (a, b) { return b.score - a.score; });
    return ranked.slice(0, limit);
  }

  function matchTemplateSample(text, context) {
    var top = rankTemplateSamples(text, context, 1)[0];
    if (!top || top.score < MIN_SCORE) return null;
    return top.sample;
  }

  // ── 사용자 입력 override 추출 ──
  function _extractCustomerLabel(text) {
    var m = String(text || '').match(/([가-힣]{2,4})님/);
    return (m && m[1]) ? (m[1] + '님') : null;
  }
  function _extractServiceName(nt) {
    if (/네일|젤네일|손젤|패디|페디|아트/.test(nt)) return '네일';
    if (/속눈썹|래쉬/.test(nt)) return '속눈썹';
    if (/피부|물광|리쥬란|여드름/.test(nt)) return '피부관리';
    if (/헤어|두피|염색|모발|붙임머리/.test(nt)) return '헤어';
    if (/왁싱|제모/.test(nt)) return '왁싱';
    if (/메이크업|화장/.test(nt)) return '메이크업';
    return null;
  }

  function _sanitizeStr(s) {
    var out = String(s == null ? '' : s);
    BANNED_MAP.forEach(function (pair) { out = out.split(pair[0]).join(pair[1]); });
    return out.replace(/\s{2,}/g, ' ').trim();
  }
  // slotValues 의 모든 문자열(services 배열 포함) 안전 치환. 원본 불변(복사본 반환).
  function sanitizeCopy(slotValues) {
    var src = slotValues || {};
    var out = {};
    Object.keys(src).forEach(function (k) {
      var v = src[k];
      if (typeof v === 'string') out[k] = _sanitizeStr(v);
      else if (Array.isArray(v)) {
        out[k] = v.map(function (item) {
          if (item && typeof item === 'object') {
            var o = {};
            Object.keys(item).forEach(function (ik) { o[ik] = (typeof item[ik] === 'string') ? _sanitizeStr(item[ik]) : item[ik]; });
            return o;
          }
          return (typeof item === 'string') ? _sanitizeStr(item) : item;
        });
      } else out[k] = v;
    });
    return out;
  }

  function toAutoApplyPayload(sample, text, _context) {
    if (!sample) return null;
    var nt = _norm(text);
    var overrides = {};
    if (sample.purpose === 'review') {
      var cust = _extractCustomerLabel(text);
      if (cust) overrides.customer_label = cust;
      var svc = _extractServiceName(nt);
      if (svc) overrides.service_name = svc;
    }
    // sample.slotValues 위에 override 얕은 병합 → 안전 필터.
    var merged = Object.assign({}, sample.slotValues || {}, overrides);
    var slotValues = sanitizeCopy(merged);
    return {
      sampleId: sample.id,
      purpose: sample.purpose,
      industry: sample.industry,
      templateId: sample.templateId,
      slotValues: slotValues,
      overrides: overrides,
      // before_after 사진 정책은 M2에서 I3b 재사용. 여기선 힌트만.
      photoPolicy: sample.purpose === 'before_after' ? 'i3b' : 'single-or-none',
      autoApplyEligible: !!sample.templateId,   // event(null)=false
    };
  }

  var API = {
    MIN_SCORE: MIN_SCORE,
    matchTemplateSample: matchTemplateSample,
    rankTemplateSamples: rankTemplateSamples,
    toAutoApplyPayload: toAutoApplyPayload,
    sanitizeCopy: sanitizeCopy,
  };

  if (typeof window !== 'undefined') window.ItdasyTemplateSampleMatcher = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
