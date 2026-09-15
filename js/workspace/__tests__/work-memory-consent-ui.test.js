/** @jest-environment jsdom */
'use strict';

const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'work-memory-consent-ui.js'), 'utf8');

function load() {
  document.body.innerHTML = '';
  window.WorkMemoryConsentUI = null;
  window.WorkMemoryPolicy = { isLegacy: () => false };
  window.WorkMemory = {
    captureFromSlot: jest.fn(() => ({ id: 'm1', industry: '네일' })),
    allowAuto: jest.fn(() => true), setAutoOn: jest.fn(), get: jest.fn(() => ({ id: 'm1', industry: '네일' })),
    showCaptureCard: jest.fn()
  };
  // eslint-disable-next-line no-eval
  eval(src);
  return window.WorkMemory;
}

describe('작업 기억 두 단계 동의', () => {
  test('이번만을 누르면 저장하지 않는다', () => {
    const WM = load(); window.WorkMemoryConsentUI.show({ id: 's1' }, { service: '네일' });
    document.querySelector('.wm-cap__once').click();
    expect(WM.captureFromSlot).not.toHaveBeenCalled();
  });

  test('기억하기만으로 자동 적용은 켜지지 않는다', () => {
    const WM = load(); window.WorkMemoryConsentUI.show({ id: 's1' }, { service: '네일' });
    document.querySelector('.wm-cap__save').click();
    expect(WM.captureFromSlot).toHaveBeenCalledWith(expect.anything(), expect.anything(), { consent: true });
    expect(document.body.textContent).toContain('추천만 보기');
    document.querySelector('.wm-cap__once').click();
    expect(WM.allowAuto).not.toHaveBeenCalled();
    expect(WM.setAutoOn).not.toHaveBeenCalled();
  });

  test('자동 적용 켜기를 따로 눌러야 기록과 전체 설정이 켜진다', () => {
    const WM = load(); window.WorkMemoryConsentUI.show({ id: 's1' }, { service: '네일' });
    document.querySelector('.wm-cap__save').click();
    document.querySelector('.wm-cap__save').click();
    expect(WM.allowAuto).toHaveBeenCalledWith('m1', true);
    expect(WM.setAutoOn).toHaveBeenCalledWith(true);
  });
});
