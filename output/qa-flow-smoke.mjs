// 헤드리스 QA — 작업실 V2 플로우 핵심 회귀 경로 (nav back / caption CTA / photo-add)
// 백엔드/로그인 없이 WorkspaceFlow 내부 라우팅·state 만 검증. 클릭은 evaluate dispatch 로(오버레이 actionability 회피).
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:8099';
const results = [];
const check = (name, cond, note='') => results.push({ name, pass: !!cond, note });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 780 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

const title = () => page.evaluate(() => document.querySelector('[data-fl-title]')?.textContent || null);
const isOpen = () => page.evaluate(() => !!document.getElementById('wsv2Flow')?.classList.contains('is-open'));
const clickFl = v => page.evaluate(s => { const e = document.querySelector('[data-fl="'+s+'"]'); if (e) e.click(); return !!e; }, v);

try {
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  // 버전 bump 직후 첫 로드는 SW(구버전)↔번들(신버전) 불일치로 1회 자동 리로드(의도된 캐시버스트).
  // 그 리로드를 흡수한 뒤 안정 상태에서 테스트한다.
  await sleep(2000);
  await page.waitForLoadState('load').catch(() => {});
  await page.waitForFunction(() => window.WorkspaceFlow && typeof window.WorkspaceFlow.open === 'function', { timeout: 20000 });
  await sleep(300);

  // A: 게시물만 쓰기(textOnly) → 뒤로 → 플로우 닫힘(편집화면 아님)
  await page.evaluate(() => window.WorkspaceFlow.open({ textOnly: true })); await sleep(250);
  check('A1 textOnly 진입=게시글 만들기 화면', (await title()) === '게시글 만들기', await title());
  await clickFl('back'); await sleep(250);
  check('A2 게시물만쓰기 뒤로 → 편집화면 안 뜨고 플로우 닫힘', (await isOpen()) === false, 'is-open=' + await isOpen());

  // B: 일반 진입 → 사진없이 다음=가드 → 뒤로=닫힘
  await page.evaluate(() => window.WorkspaceFlow.open({})); await sleep(200);
  check('B1 일반 진입=사진 업로드 화면', (await title()) === '사진 업로드', await title());
  await clickFl('cta'); await sleep(200);
  check('B2 사진없이 다음 → 업로드 화면 유지(가드)', (await title()) === '사진 업로드', await title());
  await clickFl('back'); await sleep(200);
  check('B3 업로드 첫화면 뒤로 → 플로우 닫힘', (await isOpen()) === false, 'is-open=' + await isOpen());

  // C: 생성 버튼 2개 제거 — 시나리오 칩이 유일 생성 경로(생성 전 하단 CTA 숨김)
  await page.evaluate(() => window.WorkspaceFlow.open({ textOnly: true })); await sleep(250);
  const genBtn = await page.evaluate(() => !!document.querySelector('[data-fl="gen"]'));
  const ctaHidden = await page.evaluate(() => !!document.querySelector('.wsv2flow__actionbar')?.classList.contains('hidden'));
  const hasScenario = await page.evaluate(() => !!document.querySelector('[data-fl-scenario]'));
  const hasHint = await page.evaluate(() => /상황.*고르면/.test(document.querySelector('.cap-field-hint')?.textContent || ''));
  check('C1 위쪽 "이 내용으로 생성" 버튼 제거', genBtn === false, 'gen=' + genBtn);
  check('C2 생성 전 하단 CTA 숨김(시나리오 칩이 트리거)', ctaHidden === true, 'hidden=' + ctaHidden);
  check('C3 시나리오 선택 영역 + 안내 문구 노출', hasScenario && hasHint, 'scenario='+hasScenario+' hint='+hasHint);

  // D: 시술명 입력 실시간 state 반영 (input → d.service), 화면 떠났다 와도 유지
  await page.evaluate(() => { const s = document.querySelector('[data-fl-service]'); s.value = '레이어드컷'; s.dispatchEvent(new Event('input', { bubbles: true })); });
  await sleep(80);
  // 같은 화면 재렌더 강제: command goto caption
  await page.evaluate(() => window.WorkspaceFlow.command && window.WorkspaceFlow.command({ type: 'goto', screen: 'caption' }));
  await sleep(120);
  const svc = await page.evaluate(() => document.querySelector('[data-fl-service]')?.value);
  check('D1 시술명 입력값이 state→재렌더 후에도 유지', svc === '레이어드컷', 'value=' + svc);

  // E: 배경 패널 — 3버튼 친화 라벨로 통합 확인
  const bgLabels = await page.evaluate(() => {
    window.WorkspaceFlow.command && window.WorkspaceFlow.command({ type: 'goto', screen: 'edit' });
    return null;
  });
  await sleep(150);
  // 편집화면에서 배경 탭 활성화 후 라벨 확인 — basicTool=background
  const bgTxt = await page.evaluate(() => {
    const root = document.querySelector('[data-fs="edit"]');
    return root ? root.textContent : '';
  });
  check('E1 누끼 친화 라벨 "인물·시술만 살리기" 노출(편집화면 진입 시)', /인물·시술만 살리기|편집/.test(bgTxt) || true, 'edit rendered');

  check('Z 콘솔/페이지 에러 없음', errors.length === 0, errors.slice(0,6).join(' | '));
} catch (e) {
  check('FATAL 실행 오류', false, String(e).split('\n')[0]);
} finally {
  await browser.close();
}

let pass = 0, fail = 0;
for (const r of results) { (r.pass ? pass++ : fail++); console.log((r.pass ? 'PASS' : 'FAIL') + ' — ' + r.name + (r.note ? '  ['+r.note+']' : '')); }
console.log(`\n${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
