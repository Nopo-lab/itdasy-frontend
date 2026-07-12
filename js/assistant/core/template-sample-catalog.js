/* 잇비 템플릿 샘플 카탈로그 — 집계(aggregator). 데이터 전용. (2026-06-08)

   purpose별 파일을 합쳐 최종 API 를 제공한다(매처가 읽는 단일 진입점):
     window.ItdasyTemplateSampleCatalog = { VERSION, SAMPLES }   // SAMPLES = price+review+ba+event
   node 검증에서는 require('./template-sample-catalog') 로 동일 객체를 얻는다.

   분리 파일(각 500줄 이하):
     template-sample-catalog-price.js   (가격표 12)
     template-sample-catalog-review.js  (후기 10)
     template-sample-catalog-ba.js      (전후 10)
     template-sample-catalog-event.js   (이벤트 5)

   금지(이 파일 범위): matcher 구현 / app-assistant·template-autoapply 연결 / 렌더러·편집기·S4·onSave 수정.
*/
(function () {
  'use strict';

  // node: require, browser: 이미 로드된 window 전역. 둘 다 배열 반환(없으면 []).
  function _load(fileBase, globalKey) {
    if (typeof require !== 'undefined' && typeof module !== 'undefined' && module.exports) {
      try { return require('./' + fileBase); } catch (_e) { /* fall through */ }
    }
    if (typeof window !== 'undefined' && Array.isArray(window[globalKey])) return window[globalKey];
    return [];
  }

  var price = _load('template-sample-catalog-price', 'ItdasyTemplateSampleCatalogPrice');
  var review = _load('template-sample-catalog-review', 'ItdasyTemplateSampleCatalogReview');
  var ba = _load('template-sample-catalog-ba', 'ItdasyTemplateSampleCatalogBA');
  var event = _load('template-sample-catalog-event', 'ItdasyTemplateSampleCatalogEvent');

  var SAMPLES = [].concat(price, review, ba, event);

  var CATALOG = { VERSION: '20260608-v1', SAMPLES: SAMPLES };

  if (typeof window !== 'undefined') window.ItdasyTemplateSampleCatalog = CATALOG;
  if (typeof module !== 'undefined' && module.exports) module.exports = CATALOG;
})();
