'use strict';

/* 성과 화면 진입점이 살아있는지 (2026-07-15).

   이 테스트가 생긴 이유: v748-wsredesign 이 홈 카드를 정리하면서 성과 버튼
   (data-wsv2-insights)을 같이 지웠고, 그 뒤로 WorkspacePerf.open() 을 부르는 곳이
   코드 전체에 하나도 없었다. 화면·집계·테스트는 다 멀쩡한데 열 방법이 없는 상태로
   여러 버전이 배포됐다. 아무도 못 여는 기능은 없는 기능이다.

   소스를 grep 하는 이유: 진입점은 '연결됐나' 자체가 계약이라 DOM 렌더까지 안 가도
   깨진 걸 잡을 수 있고, 홈 렌더러 전체를 띄우는 것보다 훨씬 싸다. */

const fs = require('fs');
const path = require('path');

const HOME = path.join(__dirname, '..', 'workspace-v2-home.js');
const src = fs.readFileSync(HOME, 'utf8');

describe('성과 진입점', () => {
  test('작업실 홈이 WorkspacePerf.open 을 부른다', () => {
    expect(src).toMatch(/window\.WorkspacePerf\s*&&\s*window\.WorkspacePerf\.open/);
    expect(src).toMatch(/WorkspacePerf\.open\(\)/);
  });

  /* [#14 2026-07-17] 진입점이 ⋯ 메뉴 → 홈 본문(필터 줄)으로 옮겨졌다.
     원장 요청("성과 버튼 작업실 홈으로 꺼내. 설정에 넣지 말고").
     이 테스트가 지키려는 건 '어느 메뉴에 있냐'가 아니라 **열 방법이 존재하냐** 이므로
     위치는 새 것으로 갱신하되 버튼+핸들러 쌍은 계속 잠근다. */
  test('홈 본문에 성과 버튼이 있다', () => {
    expect(src).toMatch(/data-wsv2-perf/);
    expect(src).toContain('성과</button>');
  });

  test('성과 버튼 클릭 핸들러가 있다', () => {
    // 버튼만 있고 핸들러가 없으면 눌러도 아무 일도 안 난다(v748 이 딱 그 상태였음)
    expect(src).toMatch(/closest\('\[data-wsv2-perf\]'\)/);
  });

  test('성과가 ⋯ 메뉴에 중복으로 남아있지 않다', () => {
    // 같은 걸 두 곳에 두면 어디가 진짜인지 모른다 — 옮겼으면 옛 자리는 지운다
    expect(src).not.toMatch(/data-wsv2-menu-act="perf"/);
  });

  test('성과를 못 불러와도 앱이 죽지 않고 안내한다', () => {
    expect(src).toMatch(/성과를 불러오지 못했어요/);
  });
});

describe('workspace-perf.js 가 로드된다', () => {
  test('load-groups 에 등록돼 있다', () => {
    const lg = fs.readFileSync(path.join(__dirname, '..', '..', 'load-groups.js'), 'utf8');
    expect(lg).toMatch(/workspace\/workspace-perf\.js/);
  });
});
