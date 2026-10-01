/** Production bridge exchanges once, preserves other environments, and fails closed. */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const page = fs.readFileSync(path.join(__dirname, '..', 'oauth-return.html'), 'utf8');
const script = page.match(/<script>([\s\S]*?)<\/script>/)[1];
const origin = 'https://nopo-lab.github.io/itdasy-frontend/oauth-return.html';
const flush = async () => { for (let i = 0; i < 8; i += 1) await Promise.resolve(); };

function bridge(query, response) {
  const dom = new JSDOM(page, { url: origin + query, runScripts: 'outside-only' });
  const win = dom.window;
  win.setTimeout = jest.fn();
  win.fetch = jest.fn().mockResolvedValue(response);
  win.localStorage.setItem('itdasy_oauth_pkce', JSON.stringify({ v: 'test-only-verifier' }));
  win.localStorage.setItem('itdasy_token::staging', 'existing-test-session');
  win.eval(script);
  return dom;
}

test('successful production exchange stores only the production session', async () => {
  const dom = bridge('?code=test-only-code&provider=google', {
    ok: true, json: async () => ({ access_token: 'mock-server-issued-session' }),
  });
  await flush();
  const win = dom.window;
  expect(win.fetch).toHaveBeenCalledTimes(1);
  expect(win.fetch.mock.calls[0][0]).toBe('https://itdasy-backend-prod-644329093453.asia-northeast3.run.app/auth/oauth/exchange');
  expect(JSON.parse(win.fetch.mock.calls[0][1].body)).toEqual({ code: 'test-only-code', code_verifier: 'test-only-verifier' });
  expect(win.localStorage.getItem('itdasy_token::prod')).toBe('mock-server-issued-session');
  expect(win.localStorage.getItem('itdasy_token::staging')).toBe('existing-test-session');
  expect(win.localStorage.getItem('itdasy_api')).toBeNull();
  expect(win.localStorage.getItem('itdasy_oauth_pkce')).toBeNull();
  expect(win.location.search).toBe('');
  expect(win.document.getElementById('title').textContent).toContain('로그인 완료');
  dom.window.close();
});

test('failed exchange leaves production storage empty and provides a visible exit', async () => {
  const dom = bridge('?code=test-only-code', { ok: false });
  await flush();
  expect(dom.window.localStorage.getItem('itdasy_token::prod')).toBeNull();
  expect(dom.window.document.getElementById('title').textContent).toBe('로그인 실패');
  expect(dom.window.document.getElementById('backBtn').style.display).toBe('block');
  dom.window.close();
});

test('a token or alternate API in the URL cannot create a session', async () => {
  const dom = bridge('?token=untrusted-test-input&api=https%3A%2F%2Finvalid.example', { ok: true });
  await flush();
  expect(dom.window.fetch).not.toHaveBeenCalled();
  expect(dom.window.localStorage.getItem('itdasy_token::prod')).toBeNull();
  expect(dom.window.localStorage.getItem('itdasy_token::staging')).toBe('existing-test-session');
  dom.window.close();
});
