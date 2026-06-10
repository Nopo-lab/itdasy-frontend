/* 잇비 결과 카드 v0 — 오케스트레이터 (조립만, 새 기능/버튼 아님)
 *
 * 원장이 채팅에서 "네일 홍보용으로 예쁘게 해줘"라고 하면, 잇비가 기존 도구(ChatAutoEdit)로
 * 만든 보정 결과를 "결과 카드 3개"로 보여주고, [적용]을 누르면 원본 + 적용 파라미터(initialState)
 * 로 편집기를 열어 보정값이 유지되게 한다.
 *
 * v0 범위:
 *   - 카드 ①자연스럽게 보정 = 실제 headless preview(result.dataUrl) 사용
 *   - 카드 ②홍보컷 / ③템플릿+캡션 = v0 에선 ① 썸네일 + 배지/설명. 실제 bg/template/caption 은
 *     적용 후 편집기 기존 경로(initial_tab=bg/template)에서 수행하거나 후속 PR.
 *   - 카드는 미리보기일 뿐, [적용] 누르기 전엔 편집기 state 를 절대 바꾸지 않음.
 *
 * 하지 않는 것: 생성형 provider, 백엔드 호출, 자동 저장/게시, 과금/크레딧, 버튼 통합/슬라이더 접기.
 */
(function () {
  'use strict';
  var root = (typeof window !== 'undefined') ? window : globalThis;

  function _esc(s) { return window._esc(s); } /* [2026-06-11] 중복 제거 — app-core 정본 위임 */

  // ── 기존 processPhoto 결과 1건으로 카드 3개 구성 (추가 렌더 없음, 동기) ──
  function fromResult(result, opts) {
    if (!result || !result.dataUrl) return null;
    opts = opts || {};
    var baseState = {
      beauty: result.beauty || null,
      adjust: result.adjust || null,
      ratio: result.ratio || 'original',
      autoIntensity: result.intensity || 'standard',
    };
    // [PR2] intent/meta — 실제 편집값(state) 과 분리. 편집기는 보관만 하고 자동 실행 안 함.
    var shopType = (opts.shop_type || _readShopType() || '') + '';
    var originalPrompt = (opts.question || '') + '';
    var beautySummary = _beautySummary(result.beauty);
    var publishMeta = {
      templateIntent: { source: 'itbi_card' },
      captionContext: { shopType: shopType, originalPrompt: originalPrompt, appliedBeautySummary: beautySummary },
      shopType: shopType,
      originalPrompt: originalPrompt,
      appliedBeautySummary: beautySummary,
    };
    var preview = result.dataUrl;
    return [
      {
        id: 'natural', title: '자연스럽게 보정', badge: '',
        desc: '시술 결과를 살린 기본 보정',
        preview: preview, state: baseState, initial_tab: 'beauty', meta: null,
      },
      {
        id: 'promo', title: '홍보컷 만들기', badge: '배경 정리',
        desc: '기본 보정 후 배경까지 정리 (적용하면 배경 탭에서 이어서)',
        preview: preview, state: baseState, initial_tab: 'bg',
        meta: { bgIntent: { kind: 'clean_background', source: 'itbi_card' } },
      },
      {
        id: 'publish', title: '템플릿·캡션 게시준비', badge: '템플릿+캡션',
        desc: '보정 후 템플릿·캡션으로 게시 준비 (적용하면 템플릿 탭에서 이어서)',
        preview: preview, state: baseState, initial_tab: 'template', meta: publishMeta,
      },
    ];
  }

  function _readShopType() {
    try { return (root.localStorage && localStorage.getItem('shop_type')) || ''; } catch (_e) { return ''; }
  }

  // 적용한 보정의 0 아닌 슬라이더 요약(캡션 맥락용). 실제 적용 X — 텍스트 메타만.
  function _beautySummary(beauty) {
    if (!beauty || typeof beauty !== 'object') return [];
    return Object.keys(beauty).filter(function (k) { return (beauty[k] || 0) > 0; });
  }

  // ── 채팅 결과 영역에 들어갈 카드 HTML (버튼 추가 아님 — 결과 카드) ──
  function renderHTML(cards, idx) {
    if (!Array.isArray(cards) || !cards.length) return '';
    var items = cards.map(function (c) {
      var badge = c.badge
        ? '<span style="font-size:11px;color:#8B5CF6;background:#F3EEFF;border-radius:8px;padding:1px 6px;margin-left:6px;">' + _esc(c.badge) + '</span>'
        : '';
      return '' +
        '<div style="display:flex;gap:10px;align-items:center;padding:8px;border:0.5px solid #E5E8EB;border-radius:14px;background:#fff;">' +
          '<img src="' + _esc(c.preview) + '" alt="' + _esc(c.title) + '" style="width:54px;height:68px;object-fit:cover;border-radius:10px;flex-shrink:0;" />' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:13px;font-weight:700;color:#191F28;">' + _esc(c.title) + badge + '</div>' +
            '<div style="font-size:11px;color:#8B95A1;margin-top:2px;line-height:1.4;">' + _esc(c.desc) + '</div>' +
          '</div>' +
          '<button data-asst-itbi-card="' + idx + ':' + _esc(c.id) + '" ' +
            'style="padding:7px 14px;border:0;border-radius:999px;background:#191F28;color:#fff;cursor:pointer;font-size:12px;font-weight:700;flex-shrink:0;">적용</button>' +
        '</div>';
    }).join('');
    return '<div class="asst-itbi-cards" data-asst-itbi-cards="' + idx + '" ' +
      'style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">' + items + '</div>';
  }

  // ── initialState 화이트리스트 병합 (순수 함수, Node 테스트 가능) ──
  //   state.beauty/state.adjust 에 "이미 존재하는 키"에만 유한 숫자를 덮어씀 → 미지 키 무시.
  //   initialState 가 없으면 호출자가 호출하지 않으므로 기존 _open 동작 100% 동일.
  var _AUTO_INTENSITY = { natural: 1, standard: 1, strong: 1 };
  var _TEMPLATE_KEYS = ['id', 'leftLabel', 'rightLabel', 'reviewText', 'priceLines'];

  function mergeInitialState(state, init) {
    if (!state || !init || typeof init !== 'object') return state;
    if (init.beauty && typeof init.beauty === 'object' && state.beauty) {
      Object.keys(state.beauty).forEach(function (k) {
        var v = init.beauty[k];
        if (typeof v === 'number' && isFinite(v)) state.beauty[k] = v;
      });
    }
    if (init.adjust && typeof init.adjust === 'object' && state.adjust) {
      Object.keys(state.adjust).forEach(function (k) {
        var v = init.adjust[k];
        if (typeof v === 'number' && isFinite(v)) state.adjust[k] = v;
      });
    }
    if (typeof init.ratio === 'string' && init.ratio) state.ratio = init.ratio;
    if (typeof init.autoIntensity === 'string' && _AUTO_INTENSITY[init.autoIntensity]) {
      state.autoIntensity = init.autoIntensity;
    }
    if (init.template && typeof init.template === 'object' && state.template) {
      _TEMPLATE_KEYS.forEach(function (k) {
        if (init.template[k] != null) state.template[k] = init.template[k];
      });
    }
    return state;
  }

  // [PR2] itbiMeta 화이트리스트 정제(순수). 편집기는 이 결과를 _state.itbiMeta 에 "보관만" — 자동 실행 X.
  //   알 수 없는 키는 버림. 빈 결과면 null 반환(없으면 기존 open 과 완전 동일).
  var _BG_KINDS = { clean_background: 1 };
  function sanitizeMeta(meta) {
    if (!meta || typeof meta !== 'object') return null;
    var out = {};
    if (meta.bgIntent && typeof meta.bgIntent === 'object' && _BG_KINDS[meta.bgIntent.kind]) {
      out.bgIntent = { kind: meta.bgIntent.kind, source: String(meta.bgIntent.source || 'itbi_card') };
    }
    if (meta.templateIntent && typeof meta.templateIntent === 'object') {
      out.templateIntent = { source: String(meta.templateIntent.source || 'itbi_card') };
    }
    if (meta.captionContext && typeof meta.captionContext === 'object') {
      out.captionContext = {
        shopType: String(meta.captionContext.shopType || ''),
        originalPrompt: String(meta.captionContext.originalPrompt || ''),
        appliedBeautySummary: Array.isArray(meta.captionContext.appliedBeautySummary) ? meta.captionContext.appliedBeautySummary.slice(0, 30) : [],
      };
    }
    if (typeof meta.shopType === 'string') out.shopType = meta.shopType;
    if (typeof meta.originalPrompt === 'string') out.originalPrompt = meta.originalPrompt;
    if (Array.isArray(meta.appliedBeautySummary)) out.appliedBeautySummary = meta.appliedBeautySummary.slice(0, 30);
    return Object.keys(out).length ? out : null;
  }

  root.PhotoEditorItbiCards = {
    fromResult: fromResult,
    renderHTML: renderHTML,
    mergeInitialState: mergeInitialState,
    sanitizeMeta: sanitizeMeta,
  };
})();
