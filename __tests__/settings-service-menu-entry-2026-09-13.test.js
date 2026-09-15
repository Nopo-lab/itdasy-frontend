'use strict';
/** [2026-09-13 UX] 시술 메뉴(이름·가격·시간) 화면을 여는 버튼이 앱에 없었다 · '샵 정보' 설명이 없는 '시술 메뉴' 를 약속 · 온보딩 업종 아이콘 중복. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
test('설정에 시술 메뉴 줄이 있고 기존 화면을 연다', () => {
  const s = fs.readFileSync(path.join(ROOT, 'app-settings-hub.js'), 'utf8');
  expect(s).toMatch(/_rowHTML\('services', 'ic-scissors', '시술 메뉴'/);
  expect(s).toMatch(/if \(act === 'services'\)\s*\{ close\(\); setTimeout\(\(\) => window\.openServiceTemplates && window\.openServiceTemplates\(\), 200\); return; \}/);
  expect(s).not.toMatch(/'샵 정보',\s*'영업시간 · 시술 메뉴'/);
});
test('시술 메뉴 화면 제목은 원장 말(프리셋 X)', () => {
  const s = fs.readFileSync(path.join(ROOT, 'app-service-templates.js'), 'utf8');
  expect(s).not.toMatch(/>시술 프리셋<|title: '시술 프리셋'/);
});
test('온보딩 업종 아이콘이 서로 겹치지 않는다', () => {
  const h = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const icons = [...h.matchAll(/class="ob-shop-card"[\s\S]*?ph-duotone (ph-[a-z-]+)/g)].map((m) => m[1]);
  expect(icons.length).toBeGreaterThanOrEqual(13);
  expect(new Set(icons).size).toBe(icons.length);
});
