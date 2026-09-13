/**
 * @jest-environment jsdom
 */
'use strict';
/**
 * [2026-09-13 ZH S20 Run4] 전·후 합치기 결과 미리보기에서 'BEFORE' 가 'RE' 로 잘려 보였다.
 * 실측(라이브): 결과물 1080×1080 (레이아웃 합성본은 1:1 로 구워지고 그대로 발행) · 미리보기 칸 558×698(4:5, cover).
 * 원칙: 구워진 결과물은 **실제 픽셀 크기**로. 원본 사진은 기존 동작 유지. 비율 추측 금지.
 */
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'workspace-v2-flow.js'), 'utf8');

function slice(startMarker, endMarker) {
  const i = SRC.indexOf(startMarker); const j = SRC.indexOf(endMarker, i);
  if (i < 0 || j < 0) throw new Error('marker missing: ' + startMarker);
  return SRC.slice(i, j);
}

// jsdom 의 CSSOM 은 aspect-ratio 를 모른다(설정해도 버림) → 렌더 결과는 style 속성 문자열로,
// 로드 후 갱신은 style 을 평범한 객체로 바꿔 끼워서 본다(실브라우저 확인은 라이브에서 따로 함).
const inlineAR = (n) => ((n.getAttribute('style') || '').match(/aspect-ratio:([^;"]+)/) || [])[1] || '';
function plainStyles() {
  document.querySelectorAll('.ig-photo').forEach((n) => {
    const bg = (n.getAttribute('style') || '').match(/background-image:(url\([^)]*\))/);
    Object.defineProperty(n, 'style', { value: { backgroundImage: bg ? bg[1] : '', aspectRatio: '' }, configurable: true });
  });
}
function load({ items, capDims = {}, fmt = '45' }) {
  const probe = slice('  var _outDims = {};', '  function _blobDisp(u) {');
  const car = slice('	  function _igCarouselHtml(fallbackUrl) {', '	    var active =') + '}';
  const images = [];
  const env = {
    Image: function () { const o = { src: '' }; images.push(o); return o; },
    document, _blobDisp: (u) => 'blob:' + u, esc: (s) => String(s), _wsFormat: () => fmt,
    _displayItems: () => items, _capPreviewDims: capDims,
  };
  // eslint-disable-next-line no-new-func
  const f = new Function(...Object.keys(env), probe + car + '; return { _igCarouselHtml, _probeOutDims, get dims(){ return _outDims; } };');
  return { api: f(...Object.values(env)), images };
}

test('🔴 구워진 1:1 결과물 — 처음엔 기존 칸, 크기를 읽으면 칸이 1:1 로 맞춰진다(잘림 없음)', () => {
  const { api, images } = load({ items: [{ kind: 'output', url: 'ba1' }] });
  document.body.innerHTML = api._igCarouselHtml('x');
  const n = document.querySelector('.ig-photo');
  expect(n.getAttribute('data-fl-igout')).toBe('1');
  expect(inlineAR(n)).toBe('');
  expect(images).toHaveLength(1);
  expect(images[0].src).toBe('blob:ba1');
  document.body.innerHTML = api._igCarouselHtml('x');   // 읽는 중 재렌더 — 중복 요청 없음
  expect(images).toHaveLength(1);
  plainStyles();
  images[0].naturalWidth = 1080; images[0].naturalHeight = 1080; images[0].onload();
  expect(document.querySelector('.ig-photo').style.aspectRatio).toBe('1080 / 1080');
  // 다시 그리면 처음부터 1:1 (밀림 없음) · 다시 읽지 않음
  document.body.innerHTML = api._igCarouselHtml('x');
  expect(inlineAR(document.querySelector('.ig-photo'))).toBe('1080 / 1080');
  expect(images).toHaveLength(1);
});

test('캡션 화면에서 이미 디코드된 크기가 있으면 바로 쓴다', () => {
  const { api, images } = load({ items: [{ kind: 'output', url: 'ba1' }], capDims: { ba1: { w: 1080, h: 1350 } } });
  document.body.innerHTML = api._igCarouselHtml('x');
  expect(inlineAR(document.querySelector('.ig-photo'))).toBe('1080 / 1350');
  expect(images).toHaveLength(0);
});

test('원본 사진(kind photo)은 기존 동작 그대로(규격 칸)', () => {
  const { api, images } = load({ items: [{ kind: 'photo', url: 'raw' }] });
  document.body.innerHTML = api._igCarouselHtml('x');
  const n = document.querySelector('.ig-photo');
  expect(n.hasAttribute('data-fl-igout')).toBe(false);
  expect(inlineAR(n)).toBe('');
  expect(images).toHaveLength(0);
});

test('디코드 실패·0 크기는 추측하지 않고 다음 렌더에서 다시 읽는다', () => {
  const { api, images } = load({ items: [{ kind: 'output', url: 'bad' }] });
  document.body.innerHTML = api._igCarouselHtml('x');
  images[0].onerror();
  expect(inlineAR(document.querySelector('.ig-photo'))).toBe('');
  document.body.innerHTML = api._igCarouselHtml('x');
  expect(images).toHaveLength(2);
  plainStyles();
  images[1].naturalWidth = 0; images[1].naturalHeight = 0; images[1].onload();
  expect(document.querySelector('.ig-photo').style.aspectRatio).toBe('');
  expect(api.dims.bad).toBeUndefined();
});

test('다른 결과물 칸에는 크기를 적지 않는다', () => {
  const { api, images } = load({ items: [{ kind: 'output', url: 'a' }] });
  document.body.innerHTML = api._igCarouselHtml('x') + '<div class="ig-photo" data-fl-igout="1" style="background-image:url(blob:zzz)"></div>';
  plainStyles();
  images[0].naturalWidth = 1080; images[0].naturalHeight = 1080; images[0].onload();
  const ns = document.querySelectorAll('.ig-photo');
  expect(ns[0].style.aspectRatio).toBe('1080 / 1080');
  expect(ns[1].style.aspectRatio).toBe('');
});
