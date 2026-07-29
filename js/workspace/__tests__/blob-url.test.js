'use strict';

/* blob-url.js — 표시용 dataURL → blob URL 캐시 (P0-1, 2026-07-20)
   핵심 계약:
     ① 비-dataURL(http·blob·빈값·null)은 반드시 원본 그대로 (렌더 함수 어디서 불러도 no-op 안전)
     ② dataURL 은 blob URL 로 변환하고, 같은 dataURL 은 메모이즈 → createObjectURL 1회만
     ③ 지원 안 되는 환경(atob/Blob/URL 없음)이면 통째로 no-op */

const fs = require('fs');
const path = require('path');

function loadBlobUrl(env) {
  const w = {};
  global.window = w;
  // 지원 환경 스텁 — 로드 시점에 _supported 가 굳으므로 eval 전에 심는다.
  if (env !== 'unsupported') {
    let seq = 0;
    global.URL = { createObjectURL: () => 'blob:mock/' + (++seq), revokeObjectURL() {} };
    global.Blob = function (parts, opts) { this.parts = parts; this.type = opts && opts.type; };
    global.atob = (b64) => Buffer.from(b64, 'base64').toString('binary');
    global.Uint8Array = Uint8Array;
    global.TextEncoder = TextEncoder;
  } else {
    delete global.URL; delete global.Blob; delete global.atob;
  }
  const file = path.join(__dirname, '..', 'blob-url.js');
  // eslint-disable-next-line no-eval
  eval(fs.readFileSync(file, 'utf8'));
  return w.WSBlobUrl;
}

afterEach(() => { delete global.URL; delete global.Blob; delete global.atob; });

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('disp — 비-dataURL passthrough', () => {
  test('http URL 은 그대로', () => {
    const B = loadBlobUrl();
    expect(B.disp('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg');
  });
  test('빈 문자열·null·undefined 는 그대로', () => {
    const B = loadBlobUrl();
    expect(B.disp('')).toBe('');
    expect(B.disp(null)).toBe(null);
    expect(B.disp(undefined)).toBe(undefined);
  });
  test('이미 blob: URL 이면 그대로', () => {
    const B = loadBlobUrl();
    expect(B.disp('blob:mock/xyz')).toBe('blob:mock/xyz');
  });
});

describe('disp — dataURL 변환·메모이즈', () => {
  test('dataURL 은 blob URL 로', () => {
    const B = loadBlobUrl();
    const out = B.disp(PNG);
    expect(out).toMatch(/^blob:mock\//);
  });
  test('같은 dataURL 은 같은 blob URL (createObjectURL 1회)', () => {
    const B = loadBlobUrl();
    let calls = 0;
    const orig = global.URL.createObjectURL;
    global.URL.createObjectURL = (b) => { calls++; return orig(b); };
    const a = B.disp(PNG);
    const b = B.disp(PNG);
    expect(a).toBe(b);
    expect(calls).toBe(1);
  });
  test('다른 dataURL 은 다른 blob URL', () => {
    const B = loadBlobUrl();
    const PNG2 = PNG.replace('iVBOR', 'iVBOX');
    expect(B.disp(PNG)).not.toBe(B.disp(PNG2));
  });
});

describe('disp — 미지원 환경', () => {
  test('atob/Blob/URL 없으면 dataURL 도 원본 그대로', () => {
    const B = loadBlobUrl('unsupported');
    expect(B.disp(PNG)).toBe(PNG);
  });
});

describe('_toBlob — mime 추출', () => {
  test('png base64 → image/png Blob', () => {
    const B = loadBlobUrl();
    const blob = B._internals._toBlob(PNG);
    expect(blob.type).toBe('image/png');
  });
});
