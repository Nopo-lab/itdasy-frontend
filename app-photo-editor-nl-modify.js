/* 사진 편집기 — 말로 추가 수정 (v2 확장) */
(function () {
  'use strict';
  if (window.PhotoEditorNLModify) return;

  function plan(text) {
    var input = String(text || '');

    // 되돌리기
    if (/원래대로|되돌|취소|리셋|초기화/.test(input)) return { steps: [{ action: 'undo', params: {}, description_ko: '되돌리기' }] };

    // 배경
    if (/배경.*흐리|아웃포커/.test(input)) return { steps: [{ action: 'apply_bgblur', params: { strength: 65 }, description_ko: '배경 흐림' }] };
    if (/배경.*선명|배경.*또렷/.test(input)) return { steps: [{ action: 'apply_bgblur', params: { strength: 0 }, description_ko: '배경 선명' }] };
    if (/누끼.*빼|배경.*제거|배경.*지우|배경.*없/.test(input)) return { steps: [{ action: 'apply_nukki', params: { bgType: 'white' }, description_ko: '배경 제거' }] };

    // 로고/워터마크
    if (/로고.*빼|워터마크.*빼|로고.*제거|워터마크.*제거/.test(input)) return { steps: [{ action: 'set_watermark', params: { value: '' }, description_ko: '로고 제거' }] };
    if (/로고.*넣|워터마크.*넣|로고.*추가/.test(input)) return { steps: [{ action: 'set_watermark', params: { value: '@itdasy', position: 'br', opacity: 0.8 }, description_ko: '로고 추가' }] };

    // 텍스트
    if (/가격.*넣|가격.*추가/.test(input)) return { steps: [{ action: 'add_text', params: { value: '가격 문의', y: 0.82, size: 5 }, description_ko: '가격 문구' }] };
    if (/예약.*넣|예약.*추가|전화.*넣/.test(input)) return { steps: [{ action: 'add_text', params: { value: '예약문의', y: 0.88, size: 4 }, description_ko: '예약 문구' }] };
    if (/샵이름|샵명|상호/.test(input)) return { steps: [{ action: 'add_text', params: { value: '', y: 0.06, size: 6 }, description_ko: '샵명 삽입' }] };
    if (/텍스트.*빼|글자.*빼|글씨.*지우/.test(input)) return { steps: [{ action: 'add_text', params: { value: '' }, description_ko: '텍스트 제거' }] };
    if (/텍스트.*크게|글자.*크게|글씨.*크게/.test(input)) return { steps: [{ action: 'add_text', params: { size: 9 }, description_ko: '텍스트 크게' }] };
    if (/텍스트.*작게|글자.*작게|글씨.*작게/.test(input)) return { steps: [{ action: 'add_text', params: { size: 3 }, description_ko: '텍스트 작게' }] };

    // 비율
    if (/스토리.*비율|세로.*비율|9.*16/.test(input)) return { steps: [{ action: 'set_ratio', params: { ratio: '9:16' }, description_ko: '스토리 비율' }] };
    if (/피드.*비율|4.*5/.test(input)) return { steps: [{ action: 'set_ratio', params: { ratio: '4:5' }, description_ko: '피드 비율' }] };
    if (/정사각|1.*1/.test(input)) return { steps: [{ action: 'set_ratio', params: { ratio: '1:1' }, description_ko: '정사각형' }] };
    if (/원본.*비율|원래.*비율/.test(input)) return { steps: [{ action: 'set_ratio', params: { ratio: 'original' }, description_ko: '원본 비율' }] };

    // 강도 줄이기/높이기
    if (/덜|과해|줄여|약하게|살짝만|연하게/.test(input)) return _lessPlan(input);
    if (/더|늘려|강하게|팍|쎄게|확|많이|진하게/.test(input)) return _morePlan(input);

    return null;
  }

  function _lessPlan(input) {
    var steps = [];
    if (/피부|뷰티|보정/.test(input) || !/밝|채도|선명/.test(input)) {
      steps.push({ action: 'set_beauty', params: { skin: 8, redness: 8, blemish: 6, textureSmooth: 4, hairShine: 12, nailGloss: 12, lashSharp: 10 }, description_ko: '뷰티 줄이기' });
    }
    if (/밝/.test(input)) steps.push({ action: 'set_adjust', params: { brightness: 98 }, description_ko: '밝기 줄이기' });
    if (/채도/.test(input)) steps.push({ action: 'set_adjust', params: { saturate: 96 }, description_ko: '채도 줄이기' });
    if (/선명/.test(input)) steps.push({ action: 'set_adjust', params: { sharpness: 4 }, description_ko: '선명도 줄이기' });
    if (!steps.length) steps.push(
      { action: 'set_adjust', params: { brightness: 103, saturate: 103, sharpness: 6 }, description_ko: '보정 줄이기' },
      { action: 'set_beauty', params: { skin: 8, redness: 8, blemish: 6, textureSmooth: 4 }, description_ko: '뷰티 줄이기' }
    );
    return { steps: steps };
  }

  function _morePlan(input) {
    var steps = [];
    if (/밝/.test(input)) steps.push({ action: 'set_adjust', params: { brightness: 120 }, description_ko: '더 밝게' });
    if (/선명/.test(input)) steps.push({ action: 'set_adjust', params: { sharpness: 32 }, description_ko: '더 선명하게' });
    if (/채도/.test(input)) steps.push({ action: 'set_adjust', params: { saturate: 122 }, description_ko: '채도 높이기' });
    if (/따뜻|웜/.test(input)) steps.push({ action: 'set_adjust', params: { temperature: 20 }, description_ko: '더 따뜻하게' });
    if (/피부|뷰티/.test(input)) steps.push({ action: 'set_beauty', params: { skin: 40, redness: 30, blemish: 35, textureSmooth: 25 }, description_ko: '뷰티 강화' });
    if (/윤기|광택/.test(input)) steps.push({ action: 'set_beauty', params: { hairShine: 65, nailGloss: 60 }, description_ko: '윤기 강화' });
    if (!steps.length) steps.push({ action: 'set_adjust', params: { brightness: 114, saturate: 114 }, description_ko: '조금 더 강하게' });
    return { steps: steps };
  }

  window.PhotoEditorNLModify = { plan };
})();
