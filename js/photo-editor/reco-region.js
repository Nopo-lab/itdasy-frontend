/* 사진 편집기 — PE-AI-1A presentRegions 빌더 (온디바이스)
   RegionMaskProvider / MaskApplication 의 "기존 게이트"를 그대로 재사용한다.
   새 임계값을 만들지 않는다. 픽셀은 건드리지 않는다 (읽기 전용).

   상태 구분:
     'strong'  = 정밀 마스크 신뢰 (conf ≥ 0.7)
     'weak'    = 약하게 참고 (0.4 ≤ conf < 0.7)
     'pending' = 아직 계산 안 됨 → 카드 숨김, 다음 갱신에서 재평가
     'absent'  = 게이트 실패/저신뢰 → 추천 안 함 (없는 부위)

   eager(skin/hair/eye/lip): RegionMaskProvider.getStats() 의 status/confidence.
   lazy(nail/sclera/brow/lash): MaskApplication.get___MaskSync() (게이트 내장).
     - 객체 반환 = 게이트 통과(존재). null = 미통과/미준비 → pending 처리. */
(function () {
  'use strict';
  if (window.PhotoEditorRecoRegion) return;

  function _statByType(img) {
    const RP = window.RegionMaskProvider;
    const out = {};
    if (!img || !RP || typeof RP.getStats !== 'function') return out;
    try {
      (RP.getStats(img) || []).forEach(r => { if (r && r.maskType) out[r.maskType] = r; });
    } catch (_e) { void _e; }
    return out;
  }

  // eager 마스크: getStats row → 상태. row 없음 = 아직 미계산(pending).
  function _eager(row) {
    if (!row) return { present: false, state: 'pending', conf: 0 };
    const conf = Number(row.confidence || 0);
    const st = row.status;
    if (st === 'notReady' || st === 'pendingImplementation') return { present: false, state: 'pending', conf };
    if (st === 'failed' || st === 'noHand') return { present: false, state: 'absent', conf };
    if (conf >= 0.7) return { present: true, state: 'strong', conf };
    if (conf >= 0.4) return { present: true, state: 'weak', conf };
    return { present: false, state: 'absent', conf };
  }

  // lazy 마스크: get___MaskSync 결과. null = 미통과/미준비 → pending(숨김, 재평가).
  function _lazy(res) {
    if (!res) return { present: false, state: 'pending', conf: 0 };
    const conf = Number(res.confidence || 0);
    if (conf >= 0.7) return { present: true, state: 'strong', conf };
    return { present: true, state: 'weak', conf };
  }

  function build(img) {
    if (!img) return null;
    const MA = window.MaskApplication;
    const s = _statByType(img);
    const region = {
      skin: _eager(s.skinMask),
      hair: _eager(s.hairMask),
      eye:  _eager(s.eyeMask),
      lip:  _eager(s.lipMask),
      nail:   _lazy(MA && typeof MA.getNailMaskSync   === 'function' ? MA.getNailMaskSync(img)   : null),
      sclera: _lazy(MA && typeof MA.getScleraMaskSync === 'function' ? MA.getScleraMaskSync(img) : null),
      brow:   _lazy(MA && typeof MA.getBrowMaskSync   === 'function' ? MA.getBrowMaskSync(img)   : null),
      lash:   _lazy(MA && typeof MA.getLashMaskSync   === 'function' ? MA.getLashMaskSync(img)   : null),
    };
    // 손: handSkinMask 는 엔진 미연결(unwired). 손 존재 신호는 nailMask(Hand Landmarker Tier1)로 대체.
    //   손이 감지된 경우에만, 그리고 항상 "약하게"만 추천(정밀 마스크 없음).
    if (region.nail.present) region.hand = { present: true, state: 'weak', conf: region.nail.conf };
    else if (region.nail.state === 'pending') region.hand = { present: false, state: 'pending', conf: 0 };
    else region.hand = { present: false, state: 'absent', conf: 0 };
    return region;
  }

  window.PhotoEditorRecoRegion = { build };
})();
