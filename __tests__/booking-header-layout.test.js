/* 예약 캘린더 헤더 — 가운데 년월이 좌우 컨트롤과 겹치지 않는다.
 *
 * 왜 (2026-09-02 PC/모바일 전수감사 실측):
 *   타이틀이 position:absolute(left:50%) 로 **흐름 밖**에 있었다. 오른쪽 그룹은 자기 옆에
 *   뭐가 있는지 모르므로, 오른쪽이 커지면 그냥 겹친다.
 *   390×844 실측 — 타이틀 132~258 · 오른쪽 240~376 → 18px 겹침.
 *   화면엔 `2026년 9월 >오프라인` 처럼 배지가 다음달 화살표를 덮었다.
 *
 *   ⚠️ 오른쪽이 커지는 건 **#cal-offline-badge 가 뜰 때뿐**이다. 즉 네트워크가 살아 있으면
 *      절대 재현되지 않는다 — 정상 상태만 보는 QA 로는 영영 못 잡는다. 그래서 테스트로 잠근다.
 *
 * jsdom 은 레이아웃 엔진이 없어 실제 겹침(rect)을 잴 수 없다. 그래서 **겹침을 만든 CSS 계약**을
 * 잠근다: 이 헤더는 3열 그리드여야 하고, 타이틀은 흐름 밖으로 나가면 안 된다.
 */
const fs = require('fs');
const path = require('path');

// 주석을 먼저 지운다 — 안 지우면 셀렉터 앞의 /* ... */ 가 셀렉터 문자열에 붙어 매칭이 통째로 빗나간다.
const CSS = fs.readFileSync(
  path.join(__dirname, '..', 'css', 'screens', 'booking-v4.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/** 셀렉터 하나의 선언 블록을 전부 모아서 돌려준다(같은 셀렉터가 여러 번 나올 수 있다) */
function declarationsFor(selector) {
  const out = [];
  const re = /([^{}]+)\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(CSS))) {
    const sels = m[1].split(',').map((s) => s.trim().replace(/\s+/g, ' '));
    if (sels.includes(selector)) out.push(m[2]);
  }
  return out.join(';');
}

/* [2026-09-03 운영 승격] 헤더 3열 그리드 계약은 **운영에 해당 없음** 이라 뺐다.
   운영의 .bk-header__title-wrap 은 text-align:center; flex:1 (일반 플렉스)로,
   스테이징이 2026-08-31 에 도입한 position:absolute 중앙정렬이 없다.
   즉 오프라인 배지 겹침 버그 자체가 운영엔 존재하지 않는다 — 확인 후 CSS 도 안 넣었다.
   여기 남긴 건 운영에도 실재하는 44px 미달 컨트롤 가드뿐이다. */
describe('작은 컨트롤 손가락 영역 (44px)', () => {
  const POLISH = fs.readFileSync(path.join(__dirname, '..', 'style-polish.css'), 'utf8');

  test('월 이동 화살표·닫기 버튼에 44px 히트 영역이 붙어 있다', () => {
    // 실측(390×844): 21×26 / 24×24 / 26×26 — 전부 44px 미달이었고 부모가 대신 받지도 않았다
    for (const sel of ['#bk-month-prev', '#bk-month-next', '.rvcal-x', '.rvm5-hd .ar']) {
      expect(POLISH.includes(sel + '::after')).toBe(true);
    }
    expect(POLISH).toMatch(/width:\s*44px/);
    expect(POLISH).toMatch(/height:\s*44px/);
  });

  test('style-polish.css 는 @import 라 style.css 의 ?v= 를 손으로 올려야 한다', () => {
    // 배포 자동 범프는 <link> 만 건드린다 — @import 는 제외라, 안 올리면 수정이 영영 반영 안 된다
    const STYLE = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
    const m = STYLE.match(/style-polish\.css\?v=([^"')]+)/);
    expect(m).toBeTruthy();
    expect(m[1]).not.toBe('20260505-v97');   // 히트 영역 추가 이전 버전
  });
});
