/* 작업실 플로우 스텝 레지스트리 (flow/steps.js) — 단일 진실원(SSOT).
 *
 * [refactor S1] 기존엔 스텝 1개가 SCREENS·VISIBLE_SCREENS·TITLE·CTA 4개 맵에 흩어져
 *   플래그별로 3~4번씩 patch 됐다 → 워크플로 바꿀 때마다 여러 곳 수정, 하나 놓치면 고아(쓰레기)코드.
 * 이제 스텝의 제목·CTA를 여기 STEP 사전 한 곳에서 정의하고, 파생 구조(SCREENS/VISIBLE/TITLE/CTA)를
 *   build() 가 한 번에 산출한다. **S1은 무동작변경** — 기존 인라인 로직과 값이 100% 동일하게 재현.
 *
 * ⚠️ 순서 두 종류:
 *   - master(SCREENS): 슬라이드 방향 계산용 인덱스(workspace-v2-flow.js 의 SCREENS.indexOf). connect 가 preview 앞 — 기존 동작 보존.
 *   - visible(VISIBLE_SCREENS): 진행바/다음화면 UX 순서. preview 가 connect 앞.
 */
(function () {
  'use strict';

  function build(opts) {
    opts = opts || {};
    var hyper = opts.hyper === true;
    var simple = opts.simple !== false;

    // 스텝 사전 — 제목·CTA 정의(변경은 여기 한 곳)
    var STEP = {
      upload:   { title: '사진 업로드',     cta: { l: '편집으로 →', to: 'edit' } },
      layout:   { title: '레이아웃 고르기', cta: { l: '이대로 게시글 쓰기', to: 'caption' } },
      edit:     { title: '편집',            cta: { l: '저장하고 게시글 쓰기', to: 'caption' } },
      template: { title: '템플릿 선택',     cta: { l: '이대로 게시글 쓰기', to: 'caption' } },
      caption:  { title: '게시글 만들기',   cta: { l: '인스타 미리보기로', to: 'preview' } },
      connect:  { title: '고객 연결',       cta: { l: '저장하고 완료', to: '__save' } },
      preview:  { title: '인스타 미리보기', cta: { l: '고객 연결로', to: 'connect' } },
    };

    // master 순서(슬라이드 방향 — 기존 SCREENS 그대로: connect 가 preview 앞)
    var master = ['upload', 'edit', 'template', 'caption', 'connect', 'preview'];
    if (hyper) master.splice(1, 0, 'layout');   // upload 다음

    // visible 순서(진행바/다음화면 — preview 가 connect 앞)
    var visible;
    if (simple) visible = hyper ? ['upload', 'layout', 'caption', 'preview', 'connect'] : ['upload', 'caption', 'preview', 'connect'];
    else visible = master.slice();

    // 플래그 변형(기존 인라인과 동일 순서로 적용)
    if (simple) { STEP.upload.cta = { l: '사진 편집 →', to: '__edit' }; STEP.caption.title = '캡션 생성'; }
    if (hyper) { STEP.upload.cta = { l: '레이아웃 고르기 →', to: 'layout' }; }   // layout.cta 는 위에서 이미 정의됨

    // 파생 맵(master 에 포함된 스텝만 — 기존과 동일하게 layout 키는 hyper 일 때만 생김)
    var TITLE = {}, CTA = {};
    master.forEach(function (id) { TITLE[id] = STEP[id].title; CTA[id] = STEP[id].cta; });

    return { SCREENS: master, VISIBLE_SCREENS: visible, TITLE: TITLE, CTA: CTA, STEP: STEP };
  }

  window.WSFlowSteps = { build: build };
})();
