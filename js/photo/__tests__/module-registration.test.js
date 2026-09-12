/* 🔴 2026-08-22 실사고 회귀 — **만들어놓고 안 부르는 모듈**.
 *
 * `draft-quality.js` 를 만들고 manifest 에 등록했다고 생각했는데 안 돼 있었다.
 * 등록 스크립트의 문자열이 안 맞아 **조용히 실패**했는데 성공 메시지는 그대로 찍혔다.
 *
 * 증상이 고약하다: 파일은 저장소에 멀쩡히 있고, 문법도 맞고, 유닛테스트도 통과한다.
 * 그냥 **브라우저가 안 부를 뿐**이다. 배포도 성공한다. 아무 데서도 안 걸린다.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');

describe('[회귀] js/photo 모듈은 전부 로더가 부른다', () => {
  const manifest = fs.readFileSync(path.join(ROOT, 'js/load-groups.js'), 'utf8');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

  test('등록 안 된 모듈이 없다', () => {
    const dir = path.join(ROOT, 'js/photo');
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js'));
    const missing = files.filter((f) => {
      const ref = 'js/photo/' + f;
      return !manifest.includes(ref) && !html.includes(ref);
    });
    expect(missing).toEqual([]);
  });

  test('로더가 부르는 js/photo 파일은 전부 실재한다 (반대 방향)', () => {
    const refs = [...manifest.matchAll(/'(js\/photo\/[\w-]+\.js)\?/g)].map((m) => m[1]);
    const gone = refs.filter((r) => !fs.existsSync(path.join(ROOT, r)));
    expect(gone).toEqual([]);
  });
});
