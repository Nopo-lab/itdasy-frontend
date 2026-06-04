/* 사진 편집기 — 큐티클/손 주변 정리 (B안 온디바이스 PoC)
 *
 * 목적: 네일 사진에서 네일 디자인/색/파츠는 그대로 두고, 손톱 경계 "바깥 띠(ring)"의
 *       큐티클·거스러미·붉은기·지저분함만 아주 약하게 완화한다.
 *
 * 안전 원칙 (PoC 동결):
 *   - 디버그 전용 hidden 플래그로만 동작. SLIDERS(27키)·AI추천·NL·preset 에 노출 안 함.
 *   - 기본값 0 → flag 0 이면 putImageData 자체를 안 해서 출력 pixel-identical.
 *   - nailMask / skinMask 없으면 즉시 no-op (손 피부 전체 블러 경로 자체를 만들지 않음).
 *   - 손톱 안쪽(nail>0.20) skip → 네일 색/디자인/파츠 불변.
 *   - 손 피부(skin>0.25) 아닌 픽셀 skip → 배경 불변.
 *   - ring 가까운 띠만 처리(nail 경계에서 R px) → 손가락 윤곽 변경 없음(기하 연산 없음).
 *   - alpha 강한 cap → 과보정 방지.
 *
 * 트리거: window.PhotoEditorCuticle._poc.cuticleClean (0~100, 기본 0). 디버그 전용.
 *   어떤 기존 슬라이더도(handSkin/nailGloss/nailShape 포함) 이 효과를 켜지 않는다.
 */
(function () {
  'use strict';
  var root = (typeof window !== 'undefined') ? window : globalThis;

  // ── 튜닝 상수 (전부 약하게) ──
  var RING_PX = 3;          // 손톱 경계 바깥 띠 폭(px)
  var NAIL_PROTECT = 0.20;  // nail>이 값 = 손톱 영역 → 보호(skip)
  var NAIL_EDGE = 0.50;     // ring 판정 기준이 되는 "확실한 손톱" 값
  var SKIN_MIN = 0.25;      // skin<이 값 = 배경/비피부 → 제외
  var ALPHA_MAX = 0.18;     // 픽셀 최대 변화 비율(과보정 cap)
  var SMOOTH_K = 0.55;      // 거스러미/요철: 주변 피부 평균으로 끌어당기는 강도
  var REDNESS_K = 0.45;     // 붉은기: red 초과분 완화 강도

  function _maskAt(mask, mw, mh, x, y, w, h) {
    if (!mask) return 0;
    var mx = Math.min(mw - 1, Math.max(0, (x * mw / w) | 0));
    var my = Math.min(mh - 1, Math.max(0, (y * mh / h) | 0));
    return mask[my * mw + mx] || 0;
  }

  // 현재 픽셀이 손톱 경계 바깥 띠인지 → ring 강도(0~1, 경계에 가까울수록 1). 아니면 0.
  function _ringWeight(nail, mw, mh, x, y, w, h) {
    var dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
    for (var r = 1; r <= RING_PX; r++) {
      for (var di = 0; di < dirs.length; di++) {
        var nx = x + dirs[di][0] * r, ny = y + dirs[di][1] * r;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        if (_maskAt(nail, mw, mh, nx, ny, w, h) > NAIL_EDGE) {
          return 1 - (r - 1) / RING_PX; // 가까운 띠일수록 강함
        }
      }
    }
    return 0;
  }

  function active() {
    return (root.PhotoEditorCuticle && root.PhotoEditorCuticle._poc &&
      (root.PhotoEditorCuticle._poc.cuticleClean || 0) > 0);
  }

  function apply(ctx, w, h, b, regionMasks) {
    if (!active()) return;                                   // flag 0 → no-op (pixel-identical)
    if (!regionMasks || !regionMasks.useMasks) return;       // fallback no-op
    var nail = regionMasks.useMasks.nailMask;
    var skin = regionMasks.useMasks.skinMask;
    if (!nail || !skin) return;                              // 마스크 실패 → no-op (손 전체 블러 금지)

    var intensity = Math.min(1, (root.PhotoEditorCuticle._poc.cuticleClean || 0) / 100);
    var mw = regionMasks.maskW || w, mh = regionMasks.maskH || h;

    // 성능: 손톱 bbox 주변만 스캔
    var minX = w, minY = h, maxX = 0, maxY = 0;
    for (var sy = 0; sy < h; sy++) for (var sx = 0; sx < w; sx++) {
      if (_maskAt(nail, mw, mh, sx, sy, w, h) > 0.38) {
        if (sx < minX) minX = sx; if (sx > maxX) maxX = sx;
        if (sy < minY) minY = sy; if (sy > maxY) maxY = sy;
      }
    }
    if (maxX <= minX || maxY <= minY) return;                // 손톱 없음 → no-op
    minX = Math.max(1, minX - RING_PX - 1); minY = Math.max(1, minY - RING_PX - 1);
    maxX = Math.min(w - 2, maxX + RING_PX + 1); maxY = Math.min(h - 2, maxY + RING_PX + 1);

    var img;
    try { img = ctx.getImageData(0, 0, w, h); } catch (_e) { return; }
    var d = img.data, src = new Uint8ClampedArray(d);
    var touched = false;

    for (var y = minY; y <= maxY; y++) for (var x = minX; x <= maxX; x++) {
      if (_maskAt(nail, mw, mh, x, y, w, h) > NAIL_PROTECT) continue;   // 손톱 안쪽 보호
      var ms = _maskAt(skin, mw, mh, x, y, w, h);
      if (ms < SKIN_MIN) continue;                                     // 배경/비피부 제외
      var ring = _ringWeight(nail, mw, mh, x, y, w, h);
      if (ring <= 0) continue;                                         // ring 아님 → skip

      // 주변 피부 평균(거스러미/요철 평탄화 타겟) — 손톱·비피부 제외, src 기준
      var ar = 0, ag = 0, ab = 0, cnt = 0;
      for (var ky = -1; ky <= 1; ky++) for (var kx = -1; kx <= 1; kx++) {
        var px = x + kx, py = y + ky;
        if (px < 0 || px >= w || py < 0 || py >= h) continue;
        if (_maskAt(nail, mw, mh, px, py, w, h) > NAIL_PROTECT) continue;
        if (_maskAt(skin, mw, mh, px, py, w, h) < SKIN_MIN) continue;
        var si = (py * w + px) * 4;
        ar += src[si]; ag += src[si + 1]; ab += src[si + 2]; cnt++;
      }
      var i = (y * w + x) * 4;
      var tr = src[i], tg = src[i + 1], tb = src[i + 2];
      if (cnt > 0) {
        ar /= cnt; ag /= cnt; ab /= cnt;
        tr = tr + (ar - tr) * SMOOTH_K;        // 거스러미/요철 약하게 평탄화
        tg = tg + (ag - tg) * SMOOTH_K;
        tb = tb + (ab - tb) * SMOOTH_K;
      }
      var excess = tr - (tg + tb) / 2;          // 붉은기 완화
      if (excess > 0) tr -= excess * REDNESS_K;

      var a = Math.min(ALPHA_MAX, ring * intensity * ms);  // 과보정 cap
      d[i]     = d[i]     * (1 - a) + tr * a;
      d[i + 1] = d[i + 1] * (1 - a) + tg * a;
      d[i + 2] = d[i + 2] * (1 - a) + tb * a;
      touched = true;
    }

    if (touched) ctx.putImageData(img, 0, 0);
  }

  root.PhotoEditorCuticle = {
    _poc: { cuticleClean: 0 },   // 디버그 전용. 기본 0. UI/슬라이더/AI추천에 절대 노출 안 함.
    active: active,
    apply: apply,
    _maskAt: _maskAt,            // QA 용
    _ringWeight: _ringWeight     // QA 용
  };
})();
