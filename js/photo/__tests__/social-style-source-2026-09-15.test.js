'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const src = fs.readFileSync(path.join(ROOT, 'js/photo/social-style-source.js'), 'utf8');
const igSrc = fs.readFileSync(path.join(ROOT, 'js/photo/instagram-text-style.js'), 'utf8');

function boot(overrides = {}) {
  const calls = [];
  const win = Object.assign({
    authHeader: () => ({ Authorization: 'Bearer T' }),
    apiFetch: (p, o) => {
      calls.push({ path: p, opts: o });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({
        connected: true,
        available: true,
        username: 'target_salon',
        media: [
          { id: 'M1', thumb: 'https://cdn.example/m1.jpg', caption: '예약 DM', media_type: 'IMAGE' },
          { id: 'M2', thumbnail_url: 'https://cdn.example/m2.jpg', media_type: 'VIDEO' },
          { id: 'BAD' }
        ]
      }) });
    },
    InstagramTextStyle: { build: jest.fn(() => Promise.resolve({ source: 'instagram_observed' })) }
  }, overrides);
  new Function('window', src)(win);
  return { win, calls };
}

describe('SocialStyleSource — 공개 인스타 프로 계정 QA 입력', () => {
  test('username/프로필 URL을 정리해서 Business Discovery 엔드포인트를 호출한다', async () => {
    const { win, calls } = boot();
    const out = await win.SocialStyleSource.fetchPublicBusinessMedia('https://www.instagram.com/Target.Salon_1/?hl=ko', { limit: 99 });

    expect(calls[0].path).toBe('/instagram/business-discovery?username=Target.Salon_1&limit=24');
    expect(calls[0].opts.headers).toEqual({ Authorization: 'Bearer T' });
    expect(out.username).toBe('target_salon');
    expect(out.media).toHaveLength(2);
    expect(out.media[0]).toMatchObject({ id: 'M1', source: 'instagram_business_discovery', source_username: 'target_salon' });
  });

  test('스타일 미리보기는 저장 없이 InstagramTextStyle.build 를 호출한다', async () => {
    const { win } = boot();
    const out = await win.SocialStyleSource.previewProfile('@target_salon', { limit: 7 });

    expect(out.profile).toEqual({ source: 'instagram_observed' });
    expect(win.InstagramTextStyle.build).toHaveBeenCalledTimes(1);
    const [media, opts] = win.InstagramTextStyle.build.mock.calls[0];
    expect(media).toHaveLength(2);
    expect(opts).toMatchObject({ save: false });
  });

  test('사용 불가 계정은 빈 학습값으로 섞지 않는다', async () => {
    const { win } = boot({
      apiFetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ connected: true, available: false, media: [] }) })
    });
    const out = await win.SocialStyleSource.previewProfile('private_salon');

    expect(out.available).toBe(false);
    expect(out.profile).toBeNull();
    expect(win.InstagramTextStyle.build).not.toHaveBeenCalled();
  });

  test('외부 계정 모듈은 게시물 분석 저장소에 자동 저장하지 않는다', () => {
    expect(src).not.toMatch(/IgPostAnalysis\.collect/);
    expect(src).not.toMatch(/instagram-style\/posts/);
    expect(src).toMatch(/save:\s*false/);
  });
});

describe('InstagramTextStyle — 외부 계정 QA용 저장 끄기 지원', () => {
  test('build 옵션에 save:false 경로가 있다', () => {
    expect(igSrc).toMatch(/opts\.save !== false/);
    expect(igSrc).toMatch(/if \(opts\.save !== false\) _save\(prof\)/);
  });
});
