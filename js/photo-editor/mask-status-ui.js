/* 사진 편집기 — 정밀 마스크 상태 UI (PE-R5a-1)
   RegionMaskProvider/MaskApplication 상태를 읽어 사용자에게 정직하게 표시한다.
   보정 결과는 바꾸지 않는다. */
(function () {
  'use strict';
  if (window.MaskStatusUI) return;

  const REGIONS = [
    { id: 'skinMask', label: '피부', note: '피부톤·결 보정에 사용' },
    { id: 'hairMask', label: '헤어', note: '피부/배경과 헷갈리면 기본 보정' },
    { id: 'eyeMask', label: '눈', note: '눈빛·속눈썹 보정 보조' },
    { id: 'lipMask', label: '입술', note: '발색 보정 보조' },
    { id: 'nailMask', label: '네일', note: '네일 광택·모양 보정을 켤 때 사용', conditional: true },
    { id: 'handSkinMask', label: '손', note: '손·발 톤은 기본 피부 보정으로 처리', unwired: true },
    { id: 'scleraMask', label: '흰자', note: '눈 충혈 완화 보정을 켤 때 사용', conditional: true },
    { id: 'browMask', label: '눈썹', note: '눈썹 선명(browSharp) 보정을 켤 때 사용', conditional: true,
      labels: { strong: '눈썹 선명 보정에 정밀 사용', weak: '눈썹 선명 보정에 약하게 참고', fallback: '기본 선명도 방식으로 처리 중', disable: '눈썹 정밀 마스크 미사용' } },
    { id: 'backgroundMask', label: '배경', note: '상태 표시/합성 준비용' },
  ];
  const LAZY = new Set(['nailMask', 'handSkinMask', 'scleraMask', 'browMask']);

  function _esc(s) { return window._esc(s); } /* [2026-06-11] 중복 제거 — app-core 정본 위임 */

  function _flag(key) {
    try { return window.localStorage && localStorage.getItem(key) === '1'; }
    catch (_e) { return false; }
  }

  function _statsMap(img) {
    const RP = window.RegionMaskProvider;
    if (!img || !RP || typeof RP.getStats !== 'function') return {};
    const out = {};
    try {
      (RP.getStats(img) || []).forEach(row => { if (row && row.maskType) out[row.maskType] = row; });
    } catch (_e) { return {}; }
    return out;
  }

  function _statusFor(region, row, hasPhoto, flags) {
    const L = region.labels || {};                       // [PE-M2] 영역별 문구 오버라이드(눈썹 등)
    const FB = L.fallback || '기본 보정으로 처리 중';
    if (!hasPhoto) return _row(region, 'disabled', '사진을 먼저 열어주세요', 0, '');
    if (flags.all) return _row(region, 'disabled', '비활성화됨', 0, '전체 마스크가 꺼져 있어 기본 보정으로 처리합니다.');   // 전체 OFF 는 일괄 문구
    if (region.id === 'nailMask' && flags.nail) return _row(region, 'disabled', '비활성화됨', 0, '네일 마스크가 꺼져 있어 기본 보정으로 처리합니다.');
    if (region.id === 'scleraMask' && flags.sclera) return _row(region, 'disabled', '비활성화됨', 0, '흰자 마스크가 꺼져 있어 기본 보정으로 처리합니다.');
    if (region.id === 'browMask' && flags.brow) return _row(region, 'disabled', L.disable || '비활성화됨', 0, '눈썹 정밀 마스크가 꺼져 있어 기본 선명도로 처리합니다.');  // [PE-M2]
    // [PE-R5a-2] 엔진 미연결 영역(손) — '정밀 적용됨'처럼 보이지 않게 항상 정직한 fallback 표기.
    //   손/발 톤 보정은 현재 기본 피부 보정(skinW) 경로로 처리됨. 손 전용 정밀 마스크는 미연결.
    if (region.unwired) return _row(region, 'fallback', '기본 보정으로 처리 중', 0, '손·발 톤은 기본 피부 보정으로 처리해요. 손 전용 정밀 마스크는 준비 중이에요.');
    if (!row) {
      const label = LAZY.has(region.id) ? FB : '준비 중';
      const detail = LAZY.has(region.id)
        ? '필요할 때 계산됩니다. 아직은 기본 보정으로 처리합니다.'
        : '사진 분석이 끝나면 상태가 바뀝니다.';
      return _row(region, LAZY.has(region.id) ? 'fallback' : 'pending', label, 0, detail);
    }
    const conf = Number(row.confidence || 0);
    if (row.status === 'failed' || row.status === 'noHand' || row.status === 'pendingImplementation') {
      return _row(region, 'fallback', FB, conf, row.reason || '마스크를 안정적으로 찾지 못했습니다.');
    }
    // [PE-R5a-2/PE-M2] nail/sclera/brow 는 해당 보정 켤 때만 적용 → 조건부·영역별 문구로 오해 방지.
    if (conf >= 0.7) return _row(region, 'strong', L.strong || (region.conditional ? '필요 시 정밀 적용' : '정밀 적용됨'), conf, _detail(row));
    if (conf >= 0.4) return _row(region, 'weak', L.weak || (region.conditional ? '필요 시 약하게 적용' : '약하게 적용됨'), conf, _detail(row));
    return _row(region, 'fallback', FB, conf, row.reason || '신뢰도가 낮아 기본 보정으로 처리합니다.');
  }

  function _detail(row) {
    const parts = [];
    if (row.status) parts.push(row.status);
    if (row.sourceTier) parts.push('Tier ' + row.sourceTier);
    if (typeof row.coverage === 'number') parts.push('범위 ' + Math.round(row.coverage * 1000) / 10 + '%');
    return parts.join(' · ');
  }

  function _row(region, tone, status, confidence, detail) {
    return {
      id: region.id,
      label: region.label,
      note: region.note,
      tone,
      status,
      confidence: Math.max(0, Math.min(1, confidence || 0)),
      detail: detail || '',
    };
  }

  function buildModel(state) {
    const img = state && state.originalImg;
    const hasPhoto = !!img;
    const stats = _statsMap(img);
    const flags = { all: _flag('PE_MASK_DISABLE'), nail: _flag('PE_NAIL_MASK_DISABLE'), sclera: _flag('PE_SCLERA_MASK_DISABLE'), brow: _flag('PE_BROW_MASK_DISABLE') };
    return {
      hasPhoto,
      providerReady: !!(window.RegionMaskProvider && window.RegionMaskProvider.isReady && window.RegionMaskProvider.isReady()),
      flags,
      rows: REGIONS.map(region => _statusFor(region, stats[region.id], hasPhoto, flags)),
    };
  }

  function html(state) {
    const model = buildModel(state);
    const disabled = !model.hasPhoto ? ' disabled' : '';
    return `<section class="pe-mask-status" data-mask-status-card>
      <div class="pe-field-label">정밀 마스크 상태</div>
      <div class="pe-hint">사진을 분석해 피부·헤어·눈·입술 같은 영역을 더 안전하게 보정해요.</div>
      <div class="pe-hint">신뢰도가 높으면 정밀 마스크로, 중간이면 정밀 마스크를 약하게 참고하고, 낮으면 기본 보정으로 처리해요. (네일·흰자는 해당 보정을 켤 때만 적용)</div>
      <div class="pe-panel-row" style="margin:10px 0;"><button type="button" class="pe-chip-btn" data-mask-status-refresh${disabled}>상태 새로고침</button></div>
      ${!model.hasPhoto ? '<div class="pe-hint">사진을 먼저 열어주세요.</div>' : ''}
      <div class="pe-mask-status-grid">${model.rows.map(_rowHtml).join('')}</div>
      <div class="pe-hint" style="margin-top:10px;">일부 영역은 사진에 따라 인식이 달라질 수 있어요. 배경은 이번 단계에서 상태 표시/합성 준비용입니다.</div>
    </section>`;
  }

  function _rowHtml(row) {
    const pct = Math.round(row.confidence * 100);
    return `<div class="pe-mask-status-row" data-mask-region="${_esc(row.id)}">
      <div><strong>${_esc(row.label)}</strong><small>${_esc(row.note)}</small></div>
      <span class="pe-mask-badge ${_esc(row.tone)}">${_esc(row.status)}</span>
      <em>신뢰도 ${pct}%${row.detail ? ' · ' + _esc(row.detail) : ''}</em>
    </div>`;
  }

  function bind(panel, state, helpers) {
    const btn = panel && panel.querySelector('[data-mask-status-refresh]');
    if (!btn) return;
    btn.addEventListener('click', () => refresh(state, helpers, true));
  }

  async function refresh(state, helpers, force) {
    const img = state && state.originalImg;
    const RP = window.RegionMaskProvider;
    if (!img || !RP) return false;
    if (force && typeof RP.invalidate === 'function') {
      try { RP.invalidate(img); }
      catch (err) { console.warn('[MaskStatusUI] 마스크 상태 초기화 실패', err); }
    }
    if (typeof RP.precompute === 'function') {
      try { await RP.precompute(img); }
      catch (err) { console.warn('[MaskStatusUI] 마스크 상태 계산 실패', err); }
    }
    if (helpers && typeof helpers.renderPanel === 'function') helpers.renderPanel();
    return true;
  }

  window.MaskStatusUI = { REGIONS, buildModel, html, bind, refresh };
})();
