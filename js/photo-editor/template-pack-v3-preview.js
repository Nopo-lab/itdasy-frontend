/* 템플릿 리빌드 팩 v3 — 독립 preview 렌더러 (앱 미연결)
 *
 * window.PhotoEditorTemplatePackV3.TEMPLATES 를 순회해 DOM 카드로 렌더한다.
 * 캔버스는 실제 비율(4:5 / 1:1) 박스. 폰트는 cqw(컨테이너 폭) 기준이라 모바일/데스크탑 동일 비율.
 * 팔레트는 캔버스 엘리먼트에 CSS변수(--bg/--ink/...)로 주입.
 *
 * 의존: template-pack-v3-data.js, photo-editor-template-pack-v3.css
 */
(function () {
  'use strict';

  var PACK = window.PhotoEditorTemplatePackV3;
  if (!PACK) { console.error('[tpv3] data pack not loaded'); return; }

  // ── 유틸 ──────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  // hex → 살짝 밝게/어둡게 (placeholder 그라데용)
  function shade(hex, amt) {
    try {
      var n = parseInt(hex.slice(1), 16);
      var r = Math.max(0, Math.min(255, (n >> 16) + amt));
      var g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
      var b = Math.max(0, Math.min(255, (n & 255) + amt));
      return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    } catch (_e) { return hex; }
  }

  var SILHOUETTE = '<svg viewBox="0 0 64 64" fill="#fff"><path d="M32 33c7 0 12-5.6 12-12.5S39 8 32 8 20 13.6 20 20.5 25 33 32 33zm0 5c-9.4 0-22 4.8-22 14v3h44v-3c0-9.2-12.6-14-22-14z"/></svg>';

  function placeholder(pal, label) {
    var ph = el('div', 'tpv3-ph');
    ph.style.setProperty('--ph-a', shade(pal.accent, 40));
    ph.style.setProperty('--ph-b', shade(pal.accent, -10));
    ph.innerHTML = SILHOUETTE + '<span class="lab">' + esc(label || 'PHOTO') + '</span>';
    return ph;
  }

  function header(d, center) {
    var h = el('div', 'tpv3-head-wrap' + (center ? ' tpv3-center' : ''));
    if (d.shop_name) h.appendChild(el('div', 'tpv3-shop', esc(d.shop_name)));
    if (d.headline) h.appendChild(el('div', 'tpv3-head', esc(d.headline)));
    if (d.subtitle) h.appendChild(el('div', 'tpv3-sub', esc(d.subtitle)));
    return h;
  }
  function ctaEl(d) {
    if (!d.cta) return null;
    var c = el('div', 'tpv3-cta', esc(d.cta));
    return c;
  }

  // ── kind 별 렌더 ──────────────────────────────────────
  function renderPrice(pad, t) {
    var d = t.defaultCopy;
    pad.appendChild(header(d, t.styleFamily !== 'luxe' ? true : false));
    var svc = el('div', 'tpv3-svc');
    (d.services || []).slice(0, 6).forEach(function (s) {
      var row = el('div', 'tpv3-svc-row');
      row.appendChild(el('div', 'tpv3-svc-ic',
        '<svg viewBox="0 0 24 24" width="55%" fill="none" stroke="' + esc(t.palette.accent) + '" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>'));
      var main = el('div', 'tpv3-svc-main');
      main.appendChild(el('div', 'tpv3-svc-name', esc(s.name)));
      if (s.desc) main.appendChild(el('div', 'tpv3-svc-desc', esc(s.desc)));
      row.appendChild(main);
      row.appendChild(el('div', 'tpv3-svc-price', esc(s.price)));
      svc.appendChild(row);
    });
    pad.appendChild(svc);
    var cta = ctaEl(d); if (cta) pad.appendChild(cta);
    if (d.phone) pad.appendChild(el('div', 'tpv3-phone', esc(d.phone)));
  }

  function renderBeforeAfter(pad, t) {
    var d = t.defaultCopy;
    pad.appendChild(header(d, true));
    if (t.styleFamily === 'luxe') {
      var full = el('div', 'tpv3-fullphoto');
      [['before', d.before_label, d.before_caption], ['after', d.after_label, d.after_caption]].forEach(function (p) {
        var box = el('div', 'tpv3-ba-photo');
        box.appendChild(placeholder(t.palette, p[1]));
        box.appendChild(el('div', 'tpv3-ba-lab', esc(p[1])));
        full.appendChild(box);
      });
      pad.appendChild(full);
    } else {
      var pair = el('div', 'tpv3-ba-pair');
      var cols = [['before', d.before_label, d.before_caption], ['after', d.after_label, d.after_caption]];
      cols.forEach(function (p, i) {
        if (i === 1) pair.appendChild(el('div', 'tpv3-ba-arrow', '&rsaquo;'));
        var col = el('div', 'tpv3-ba-col');
        var box = el('div', 'tpv3-ba-photo');
        box.appendChild(placeholder(t.palette, p[1]));
        box.appendChild(el('div', 'tpv3-ba-lab', esc(p[1])));
        col.appendChild(box);
        col.appendChild(el('div', 'tpv3-ba-cap' + (i === 0 ? ' sub' : ''), esc(p[2])));
        pair.appendChild(col);
      });
      pad.appendChild(pair);
    }
    // 효과 행
    var fx = el('div', 'tpv3-effects');
    ['피부톤 개선', '수분 진정', '피부결 케어', '장벽 강화'].slice(0, t.styleFamily === 'luxe' ? 4 : 3).forEach(function (txt) {
      var e = el('div', 'tpv3-effect');
      e.appendChild(el('div', 'dot', '<svg viewBox="0 0 24 24" width="50%" fill="none" stroke="' + esc(t.palette.accent) + '" stroke-width="2"><path d="M12 3l2 5 5 .5-4 3.5 1.5 5L12 19l-4.5 3 1.5-5-4-3.5 5-.5z"/></svg>'));
      e.appendChild(el('div', 't', esc(txt)));
      fx.appendChild(e);
    });
    pad.appendChild(fx);
    var cta = ctaEl(d); if (cta) pad.appendChild(cta);
  }

  function renderReview(pad, t) {
    var d = t.defaultCopy;
    pad.appendChild(header(d, true));
    var card = el('div', 'tpv3-review-card');
    card.appendChild(el('div', 'tpv3-stars', '★★★★★'));
    card.appendChild(el('div', 'tpv3-quote', '“' + esc(d.review_text) + '”'));
    var rv = el('div', 'tpv3-reviewer');
    var ava = el('div', 'ava'); ava.appendChild(placeholder(t.palette, ''));
    rv.appendChild(ava);
    rv.appendChild(el('div', 'who', esc(d.customer_label)));
    card.appendChild(rv);
    pad.appendChild(card);
    var cta = ctaEl(d); if (cta) pad.appendChild(cta);
  }

  function renderGeneric(pad, t) {
    var d = t.defaultCopy;
    var center = t.cat === 'event' || t.cat === 'card';
    pad.appendChild(header(d, center));
    // 이벤트/샵소개: photo placeholder 또는 데코
    var decor = (t.previewMeta && t.previewMeta.decor) || [];
    if (decor.indexOf('big-badge') >= 0) {
      pad.classList.add('tpv3-has-badge');   // 헤더를 배지 아래로 내려 겹침 방지
      var b = el('div', 'tpv3-big-badge', 'EVENT');
      b.style.background = t.palette.badge;
      pad.appendChild(b);
    }
    if ((t.previewMeta.photoSlots || []).indexOf('main') >= 0 && decor.indexOf('coupon-perforation') < 0) {
      var ph = el('div', 'tpv3-ba-photo'); ph.style.aspectRatio = '16/9'; ph.style.margin = '4% 0';
      ph.appendChild(placeholder(t.palette, 'PHOTO'));
      pad.appendChild(ph);
    }
    if (decor.indexOf('coupon-perforation') >= 0) {
      var cp = el('div', 'tpv3-coupon');
      cp.appendChild(el('div', 'tpv3-head', esc(d.headline)));
      cp.appendChild(el('div', 'tpv3-sub', esc(d.subtitle)));
      pad.appendChild(cp);
    }
    if (decor.indexOf('info-rows') >= 0) {
      // 아이콘 규칙: UI 라벨에 이모지 금지 → 텍스트만
      var info = el('div', 'tpv3-info');
      ['서울시 강남구 도산대로 123, 2층', '평일 10:00–20:00 (일요일 휴무)', '예약 문의 @ourshop'].forEach(function (r) {
        info.appendChild(el('div', 'r', esc(r)));
      });
      pad.appendChild(info);
    }
    var cta = ctaEl(d); if (cta) pad.appendChild(cta);
  }

  var RENDERERS = { price: renderPrice, before_after: renderBeforeAfter, review: renderReview, generic: renderGeneric };

  function renderTemplate(t) {
    var item = el('div', 'tpv3-item');
    item.setAttribute('data-cat', t.cat);

    var head = el('div', 'tpv3-item-head');
    head.appendChild(el('div', 'tpv3-item-title', esc(t.label)));
    head.appendChild(el('span', 'tpv3-badge ' + (t.tier === 'pro' ? 'pro' : 'free'), t.tier.toUpperCase()));
    head.appendChild(el('span', 'tpv3-badge style', esc(t.styleFamily)));
    item.appendChild(head);
    item.appendChild(el('div', 'tpv3-item-id', esc(t.id)));

    var canvas = el('div', 'tpv3-canvas');
    canvas.setAttribute('data-ratio', t.ratio);
    canvas.setAttribute('data-style', t.styleFamily);
    var p = t.palette;
    canvas.style.setProperty('--bg', p.bg);
    canvas.style.setProperty('--ink', p.ink);
    canvas.style.setProperty('--sub', p.sub);
    canvas.style.setProperty('--accent', p.accent);
    canvas.style.setProperty('--line', p.line);
    canvas.style.setProperty('--badge', p.badge);
    var fam = PACK.STYLE_FAMILIES[t.styleFamily];
    if (fam && fam.fontPair) canvas.style.setProperty('--head', fam.fontPair.head);

    var pad = el('div', 'tpv3-pad');
    try {
      (RENDERERS[t.kind] || renderGeneric)(pad, t);
    } catch (e) {
      console.error('[tpv3] render fail', t.id, e);
      pad.appendChild(el('div', '', '⚠ render error: ' + esc(t.id)));
    }
    canvas.appendChild(pad);
    item.appendChild(canvas);
    return item;
  }

  // ── 마운트 + 컨트롤 ──────────────────────────────────
  function mount(rootId) {
    var root = document.getElementById(rootId || 'tpv3-grid');
    if (!root) return;
    root.innerHTML = '';
    PACK.TEMPLATES.forEach(function (t) { root.appendChild(renderTemplate(t)); });
    var n = document.getElementById('tpv3-count');
    if (n) n.textContent = PACK.TEMPLATES.length + '종';
  }

  function bindControls() {
    // 디바이스 토글
    document.querySelectorAll('[data-tpv3-device]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var dev = btn.getAttribute('data-tpv3-device');
        document.body.setAttribute('data-device', dev);
        document.querySelectorAll('[data-tpv3-device]').forEach(function (b) {
          b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
        });
      });
    });
    // 카테고리 필터
    document.querySelectorAll('[data-tpv3-filter]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var cat = btn.getAttribute('data-tpv3-filter');
        document.querySelectorAll('[data-tpv3-filter]').forEach(function (b) {
          b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
        });
        document.querySelectorAll('.tpv3-item').forEach(function (it) {
          var show = (cat === 'all') || (it.getAttribute('data-cat') === cat);
          it.classList.toggle('tpv3-hidden', !show);
        });
      });
    });
  }

  window.PhotoEditorTemplatePackV3Preview = { mount: mount };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { mount(); bindControls(); });
  } else { mount(); bindControls(); }
})();
