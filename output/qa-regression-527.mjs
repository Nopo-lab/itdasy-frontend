// 헤드리스 QA — v527 회귀 수정 검증 (back history / 선택순서 / 템플릿썸네일 분리 / 전후게이트)
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8099';
const R = [];
const ok = (n, c, note='') => R.push({ n, pass: !!c, note });
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 1x1 PNG 3장 (서로 다른 색) — 업로드 사진 대용
const PX = c => `data:image/png;base64,${c}`;
const URLS = [
  PX('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='),
  PX('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwAEhgGAa0+lYwAAAABJRU5ErkJggg=='),
  PX('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z/C/HgAGgwJ/lK3Q6wAAAABJRU5ErkJggg=='),
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 780 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

const title = () => page.evaluate(() => document.querySelector('[data-fl-title]')?.textContent || null);
const orders = () => page.evaluate(() => Array.from(document.querySelectorAll('[data-fs="upload"].active .photo-tile')).map(t => {
  const b = t.querySelector('.thumb-order'); return b ? b.textContent : null;
}));
const setScreen = s => page.evaluate(name => window.WorkspaceFlow.command({ type:'goto', screen:name }), s);

try {
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await sleep(2200);
  await page.waitForFunction(() => window.WorkspaceFlow && typeof window.WorkspaceFlow.open === 'function', { timeout: 20000 });
  await sleep(300);

  // ── 이슈2: 선택 순서 ──
  await page.evaluate(u => window.WorkspaceFlow.open({ photoUrls: u }), URLS); await sleep(400);
  ok('flow open + 3 photos', (await page.evaluate(() => document.querySelectorAll('[data-fs="upload"].active .photo-tile').length)) === 3);
  ok('초기 배지 1,2,3', JSON.stringify(await orders()) === JSON.stringify(['1','2','3']), JSON.stringify(await orders()));
  // 1번 타일 탭 → 해제
  await page.evaluate(() => document.querySelector('[data-fs="upload"].active [data-fl-tile="0"]').click()); await sleep(200);
  const o2 = await orders();
  ok('해제 후 tile0 배지 없음', o2[0] === null, JSON.stringify(o2));
  ok('남은 배지 1,2 재정렬', o2[1] === '1' && o2[2] === '2', JSON.stringify(o2));
  // 다시 탭 → 맨 끝(3)
  await page.evaluate(() => document.querySelector('[data-fs="upload"].active [data-fl-tile="0"]').click()); await sleep(200);
  const o3 = await orders();
  ok('재선택 tile0 마지막 순서=3', o3[0] === '3', JSON.stringify(o3));
  ok('빈번호 없음(1,2,3 집합)', JSON.stringify([...o3].sort()) === JSON.stringify(['1','2','3']), JSON.stringify(o3));

  // ── 이슈3: 템플릿 카드 = 고정 예시(업로드 사진 아님) ──
  await setScreen('edit'); await sleep(400);
  const tplBg = await page.evaluate(() => Array.from(document.querySelectorAll('[data-fs="edit"] .tpl-item')).map(b => b.style.backgroundImage));
  ok('템플릿 카드 존재', tplBg.length > 0, 'count=' + tplBg.length);
  ok('카드 배경=workshop-cats 예시', tplBg.every(b => /workshop-cats\/cat-\d/.test(b)), tplBg[0]);
  ok('카드 배경에 업로드 dataURL 미포함', tplBg.every(b => !b.includes('base64')), tplBg.find(b=>b.includes('base64'))||'clean');
  const badge = await page.evaluate(() => !!document.querySelector('[data-fs="edit"] .tpl-item .tpl-badge'));
  ok('타입 뱃지 표시', badge);

  // ── 이슈1: 단계별 back ── (앞 테스트 플로우를 닫아 history 정리 후 새 세션)
  await page.evaluate(() => window.WorkspaceFlow.close()); await sleep(300);
  await page.evaluate(u => window.WorkspaceFlow.open({ photoUrls: u }), URLS); await sleep(400);
  // 단계 전진: upload→edit→caption→connect→preview (command goto = push)
  for (const s of ['edit','caption','connect','preview']) { await setScreen(s); await sleep(120); }
  ok('preview 도달', (await title()) === '인스타 미리보기', await title());
  const seq = [];
  for (let i=0;i<5;i++){ await page.evaluate(() => history.back()); await sleep(180); seq.push(await title()); }
  ok('back 1: preview→connect', seq[0] === '고객 연결', seq.join(' / '));
  ok('back 2: connect→캡션', seq[1] === '게시글 만들기', seq.join(' / '));
  ok('back 3: 캡션→편집', seq[2] === '편집 및 템플릿', seq.join(' / '));
  ok('back 4: 편집→업로드', seq[3] === '사진 업로드', seq.join(' / '));
  const closedAfter = await page.evaluate(() => !document.getElementById('wsv2Flow')?.classList.contains('is-open'));
  ok('back 5: 업로드→플로우 닫힘(홈)', closedAfter, 'title5=' + seq[4]);

  // ── 이슈7: 1장 전후 게이트 ──
  await page.evaluate(u => window.WorkspaceFlow.open({ photoUrls: [u] }), URLS[0]); await sleep(350);
  await setScreen('edit'); await sleep(300);
  // before_after 템플릿 적용 시도 (key 'ba')
  await page.evaluate(() => window.WorkspaceFlow.command({ type:'template', key:'ba' })); await sleep(400);
  ok('1장 전후 → 업로드로 복귀(편집기 점프X)', (await title()) === '사진 업로드', await title());

  ok('페이지 에러 없음', errors.length === 0, errors.slice(0,3).join(' | '));
} catch (e) {
  ok('스크립트 예외', false, String(e));
}
await browser.close();
const pass = R.filter(r=>r.pass).length;
console.log(`\n=== QA v527: ${pass}/${R.length} PASS ===`);
R.forEach(r => console.log(`${r.pass?'✅':'❌'} ${r.n}${r.note?'  ('+r.note+')':''}`));
process.exit(R.every(r=>r.pass)?0:1);
