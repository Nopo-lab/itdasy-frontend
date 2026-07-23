/* 시술 카테고리 사전 — 백엔드 config/services.py 와 **같은 값**이어야 한다.
 *
 * [2026-07-23] 예전엔 분류가 앱 안에 5벌 따로 있었고 서로 안 맞았다:
 *   프론트 app-caption.js(5종) / fewshot_builder(5종) / service_hashtags(6종) /
 *   config/services(2종) / schemas/persona Literal(5종).
 *   속눈썹·왁싱·반영구가 전부 'makeup' 한 통으로 들어가 성격이 완전히 다른 시술이
 *   같은 few-shot 풀과 같은 톤 지시를 받았다.
 *
 * 백엔드가 SSOT 이고 이 파일은 그 복제본이다. 한쪽만 고치면
 * itdasy_backend-test/backend/tests/test_service_categories.py 가 빨강이 된다.
 *
 * 카테고리를 고칠 땐 **백엔드부터** 고치고 여기로 옮겨 적는다.
 */
(function () {
  'use strict';

  // 검사 순서 — 모호성 적은 것부터. 복합 시술("속눈썹 연장 + 다운펌")은 먼저 걸리는 쪽이 이긴다.
  //   extension 이 hair 보다 앞: '붙임머리 레이어드컷' 은 더 구체적인 붙임머리가 이겨야 한다.
  //   hair 가 마지막: '펌·컷·염색' 어휘가 다른 카테고리 시술명에도 섞인다(예: '속눈썹펌'의 '펌').
  var ORDER = ['lash', 'nail', 'waxing', 'tattoo', 'skin', 'extension', 'hair'];

  var KEYWORDS = {
    lash:      ['속눈썹', '래쉬', 'lash', '언더래쉬', '러시안', '벨벳', '속눈썹펌', '눈썹펌'],
    nail:      ['네일', '젤네일', '네일아트', '패디', '페디', '큐티클', '젤',
                '손톱', '발톱', '매니큐어'],
    waxing:    ['왁싱', '브라질리언', '제모', '페이스왁싱'],
    tattoo:    ['반영구', '눈썹문신', '입술문신', '아이라인반영구', 'microblading', '엠보', '수지'],
    skin:      ['피부', '리프팅', '여드름', '스킨케어', '모공', '각질', '아쿠아필', '필링',
                '관리실', '스킨', '클렌징'],
    extension: ['붙임머리', '붙임 머리', '익스텐션', '헤어피스', '가발', '비드붙임',
                '테이프붙임', '클립인', '링붙임', '슬림땋기', '단발탈출'],
    hair:      ['커트', '컷', '레이어드', '레이어', '염색', '컬러', '펌', '매직', '클리닉',
                '드라이', '헤어', '단발', '머릿결', '볼륨매직', '탈색', '두피',
                '히피펌', '셋팅펌'],
  };

  var LABELS = {
    lash: '속눈썹', nail: '네일', hair: '헤어', extension: '붙임머리',
    skin: '피부', waxing: '왁싱', tattoo: '반영구',
  };

  /* 시술명·문맥 → 카테고리. 근거 없으면 null(억지 추론 금지).
   *
   * 예전엔 매칭 실패 시 무조건 'hair' 로 떨어졌다. 그래서 네일샵 원장님이 헤어 few-shot 을
   * 받아 엉뚱한 말투가 섞였다. 이제 null 을 보내면 백엔드가 전체 풀에서 뽑는다 —
   * 틀린 카테고리보다 미지정이 낫다. */
  function inferCategory(text) {
    var t = String(text || '').toLowerCase();
    if (!t) return null;
    for (var i = 0; i < ORDER.length; i++) {
      var cat = ORDER[i];
      var kws = KEYWORDS[cat];
      for (var j = 0; j < kws.length; j++) {
        if (t.indexOf(kws[j].toLowerCase()) >= 0) return cat;
      }
    }
    return null;
  }

  window.ServiceCategories = {
    ORDER: ORDER,
    KEYWORDS: KEYWORDS,
    LABELS: LABELS,
    infer: inferCategory,
  };
})();
