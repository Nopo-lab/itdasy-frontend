/* 사진 편집기 — 말 명령 의도 파악 */
(function () {
  'use strict';
  if (window.PhotoEditorIntentParser) return;

  const PATTERNS = {
    adjust: /밝[게히]|어둡|채도|선명|따뜻|차갑|색온도|보정/,
    beautify: /예쁘게|자연스럽|피부|잡티|윤기|매끈|리터치|뷰티|헤어|네일|속눈썹/,
    template: /전후|비포|애프터|인스타|피드|스토리|홍보|템플|가격표|후기/,
    retouch: /지우|클론|힐링|블러|부분|잡티/,
    export: /저장|내보내|다운로드/,
    modify: /덜|더|줄여|늘려|빼|넣|바꿔|원래대로|과해/,
  };

  function parse(text) {
    const input = String(text || '').trim();
    const intent = _intent(input);
    const steps = _steps(input, intent);
    return {
      version: '1.0',
      intent,
      confidence: input ? 0.86 : 0,
      steps,
      safety: { preserveIdentity: true, requireUserConfirm: false },
      explanation_ko: _explain(intent),
    };
  }

  function _intent(input) {
    if (PATTERNS.modify.test(input)) return 'modify';
    if (PATTERNS.template.test(input)) return 'template';
    if (PATTERNS.beautify.test(input)) return 'beautify';
    if (PATTERNS.adjust.test(input)) return 'adjust';
    if (PATTERNS.export.test(input)) return 'export';
    if (PATTERNS.retouch.test(input)) return 'retouch';
    return 'beautify';
  }

  function _steps(input, intent) {
    const template = window.PhotoEditorNLTemplate?.plan?.(input);
    if (template) return template.steps;
    const modify = window.PhotoEditorNLModify?.plan?.(input);
    if (modify) return modify.steps;
    if (intent === 'export') return [{ action: 'export', params: { format: 'png' }, description_ko: '저장' }];
    return _beautySteps(input);
  }

  function _beautySteps(input) {
    if (/헤어|머리|윤기/.test(input)) return [{ action: 'apply_preset', params: { preset: 'hair-gloss' }, description_ko: '헤어 윤기' }];
    if (/네일|손톱/.test(input)) return [{ action: 'apply_preset', params: { preset: 'nail-crisp' }, description_ko: '네일 선명' }];
    if (/속눈썹|눈썹|눈/.test(input)) return [{ action: 'apply_preset', params: { preset: 'lash-clear' }, description_ko: '눈가 선명' }];
    if (/밝/.test(input)) return [{ action: 'set_adjust', params: { brightness: 112 }, description_ko: '밝게' }];
    if (/따뜻|웜/.test(input)) return [{ action: 'set_adjust', params: { temperature: 15 }, description_ko: '따뜻한 톤' }];
    if (/자연/.test(input)) return [{ action: 'apply_preset', params: { preset: 'natural-before' }, description_ko: '자연 보정' }];
    return [{ action: 'apply_preset', params: { preset: 'salon-clean' }, description_ko: '기본 예쁨 보정' }];
  }

  function _explain(intent) {
    const map = {
      adjust: '밝기와 색감을 맞춰요.',
      beautify: '시술 사진이 자연스럽게 좋아 보이도록 정리해요.',
      template: '홍보용 전후사진 틀을 골라요.',
      retouch: '부분 보정으로 보기 싫은 부분을 줄여요.',
      export: '현재 편집본을 저장해요.',
      modify: '방금 한 보정을 조금 조절해요.',
    };
    return map[intent] || map.beautify;
  }

  window.PhotoEditorIntentParser = { parse };
})();
