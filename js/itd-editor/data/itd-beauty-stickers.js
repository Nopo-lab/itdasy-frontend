/* itd-beauty-stickers.js — 1인 뷰티샵 사진용 차분한 SVG 스티커.
   각 항목은 추천 문맥과 기본 배치를 함께 가진다. 편집기는 src만 저장하므로 예전 저장본과 호환된다. */
(function () {
  'use strict';

  var ALL = ['붙임머리', '헤어', '네일', '속눈썹', '눈썹', '왁싱', '피부관리', '메이크업', '기타'];
  function svg(w, h, body) {
    var raw = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' + body + '</svg>';
    return 'data:image/svg+xml,' + encodeURIComponent(raw);
  }
  function item(id, name, category, industries, occasions, size, position, contrast, src) {
    return { id: id, name: name, category: category, industries: industries, occasions: occasions,
      defaultSize: size, defaultPosition: position, contrast: contrast, src: src };
  }
  function labelSvg(text, fill, ink, stroke) {
    return svg(220, 74, '<rect x="3" y="3" width="214" height="68" rx="34" fill="' + fill + '" stroke="' + stroke + '" stroke-width="3"/><text x="110" y="46" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" font-weight="700" letter-spacing="1" fill="' + ink + '">' + text + '</text>');
  }

  var dark = '#211A1D', nude = '#D9B8A7', rose = '#B76E79', cream = '#FFF9F5';
  var catalog = [
    item('reserve_dark', '예약 문의', '예약 유도', ALL, ['예약 유도', '완성샷'], 132, 'bottom-center', '밝은 사진',
      svg(200, 72, '<rect x="2" y="2" width="196" height="68" rx="34" fill="' + dark + '"/><text x="100" y="45" text-anchor="middle" font-family="Arial,sans-serif" font-size="25" font-weight="700" fill="#fff">RESERVATION</text>')),
    item('booking_open', '예약 가능', '예약 유도', ALL, ['예약 유도', '공지'], 126, 'bottom-center', '밝고 어두운 사진',
      svg(200, 72, '<rect x="3" y="3" width="194" height="66" rx="33" fill="' + cream + '" stroke="' + dark + '" stroke-width="4"/><circle cx="35" cy="36" r="6" fill="' + rose + '"/><text x="116" y="44" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" font-weight="700" fill="' + dark + '">BOOKING OPEN</text>')),
    item('event_nude', '이벤트', '이벤트', ALL, ['이벤트'], 112, 'top-right', '밝고 어두운 사진',
      svg(160, 86, '<path d="M8 18Q8 8 18 8h124q10 0 10 10v50q0 10-10 10H18Q8 78 8 68z" fill="' + nude + '"/><text x="80" y="53" text-anchor="middle" font-family="Arial,sans-serif" font-size="27" font-weight="800" letter-spacing="2" fill="' + dark + '">EVENT</text>')),
    item('new_outline', '새 시술', '이벤트', ALL, ['완성샷', '공지'], 98, 'top-right', '밝고 어두운 사진',
      svg(132, 72, '<rect x="3" y="3" width="126" height="66" rx="10" fill="rgba(255,255,255,.92)" stroke="' + dark + '" stroke-width="4"/><text x="66" y="46" text-anchor="middle" font-family="Arial,sans-serif" font-size="28" font-weight="800" fill="' + dark + '">NEW</text>')),
    item('before_after', '전후 비교', '전후사진', ALL, ['전후사진'], 156, 'top-center', '밝고 어두운 사진',
      svg(240, 64, '<rect x="2" y="2" width="236" height="60" rx="30" fill="rgba(33,26,29,.88)"/><text x="64" y="41" text-anchor="middle" font-family="Arial,sans-serif" font-size="23" font-weight="700" fill="#fff">BEFORE</text><path d="M112 18l16 14-16 14" fill="none" stroke="' + nude + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><text x="181" y="41" text-anchor="middle" font-family="Arial,sans-serif" font-size="23" font-weight="700" fill="#fff">AFTER</text>')),
    item('review_quote', '후기', '리뷰/후기', ALL, ['후기'], 116, 'top-left', '밝고 어두운 사진',
      svg(160, 100, '<path d="M10 18Q10 8 20 8h120q10 0 10 10v56q0 10-10 10H56L35 96l5-12H20Q10 84 10 74z" fill="' + cream + '" stroke="' + dark + '" stroke-width="3"/><path d="M52 33h22L62 59H43zm45 0h22l-12 26H88z" fill="' + rose + '"/>')),
    item('hair_flow', '머릿결 포인트', '헤어/붙임머리', ['붙임머리', '헤어'], ['완성샷', '리터치'], 104, 'top-right', '어두운 사진',
      svg(120, 120, '<path d="M24 20c52 18 14 54 70 78M45 12c38 26 4 55 50 88M18 47c34 7 19 41 55 57" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/><circle cx="91" cy="25" r="5" fill="' + nude + '"/>')),
    item('extension_22', '22인치', '헤어/붙임머리', ['붙임머리'], ['완성샷'], 118, 'bottom-left', '밝고 어두운 사진', labelSvg('22 INCH', cream, dark, nude)),
    item('extension_seamless', '자연스러운 연결', '헤어/붙임머리', ['붙임머리'], ['완성샷'], 132, 'bottom-center', '밝은 사진', labelSvg('SEAMLESS', dark, cream, dark)),
    item('extension_retouch', '붙임머리 리터치', '헤어/붙임머리', ['붙임머리', '헤어'], ['리터치'], 120, 'top-left', '밝고 어두운 사진', labelSvg('RETOUCH', nude, dark, nude)),
    item('extension_remove', '붙임머리 제거', '헤어/붙임머리', ['붙임머리'], ['공지', '리터치'], 114, 'top-right', '밝고 어두운 사진', labelSvg('REMOVAL', cream, dark, rose)),
    item('nail_gloss', '네일 광택', '네일', ['네일'], ['완성샷', '이벤트'], 90, 'top-right', '밝고 어두운 사진',
      svg(120, 120, '<path d="M60 12c5 27 12 34 40 40-28 6-35 13-40 42-6-29-13-36-40-42 27-6 34-13 40-40z" fill="' + cream + '" stroke="' + rose + '" stroke-width="3"/><circle cx="95" cy="92" r="9" fill="' + nude + '"/>')),
    item('nail_new_color', '새 컬러', '네일', ['네일'], ['완성샷', '이벤트'], 112, 'top-left', '밝고 어두운 사진', labelSvg('NEW COLOR', cream, dark, rose)),
    item('nail_glossy_label', '글로시 네일', '네일', ['네일'], ['완성샷'], 104, 'bottom-right', '밝은 사진', labelSvg('GLOSSY', dark, cream, dark)),
    item('nail_monthly', '이달의 네일', '네일', ['네일'], ['이벤트', '완성샷'], 126, 'bottom-center', '밝고 어두운 사진', labelSvg('MONTHLY NAIL', nude, dark, nude)),
    item('nail_art_point', '아트 포인트', '네일', ['네일'], ['완성샷'], 112, 'top-right', '밝고 어두운 사진', labelSvg('ART POINT', cream, dark, nude)),
    item('lash_arc', '속눈썹 라인', '속눈썹/눈썹', ['속눈썹', '눈썹', '메이크업'], ['완성샷', '리터치'], 110, 'bottom-right', '밝은 사진',
      svg(180, 96, '<path d="M18 63Q90 5 162 63Q91 89 18 63z" fill="none" stroke="' + dark + '" stroke-width="5" stroke-linecap="round"/><path d="M54 43l-8-19m28 10-3-22m27 22 4-22m23 31 10-18" stroke="' + dark + '" stroke-width="4" stroke-linecap="round"/>')),
    item('lash_extension', '속눈썹 연장', '속눈썹/눈썹', ['속눈썹'], ['완성샷'], 132, 'bottom-center', '밝고 어두운 사진', labelSvg('LASH EXTENSION', cream, dark, nude)),
    item('lash_natural', '내추럴 속눈썹', '속눈썹/눈썹', ['속눈썹', '눈썹'], ['완성샷'], 108, 'top-left', '밝은 사진', labelSvg('NATURAL', dark, cream, dark)),
    item('lash_volume', '볼륨 속눈썹', '속눈썹/눈썹', ['속눈썹'], ['완성샷'], 108, 'top-right', '밝고 어두운 사진', labelSvg('VOLUME', nude, dark, nude)),
    item('lash_retouch', '속눈썹 리터치', '속눈썹/눈썹', ['속눈썹', '눈썹'], ['리터치'], 112, 'bottom-left', '밝고 어두운 사진', labelSvg('RETOUCH', cream, dark, rose)),
    item('skin_leaf', '맑은 피부 포인트', '왁싱/피부', ['왁싱', '피부관리', '메이크업'], ['완성샷', '리터치'], 96, 'top-right', '밝고 어두운 사진',
      svg(120, 120, '<path d="M99 19C51 18 21 44 22 91c42 2 73-25 77-72z" fill="' + cream + '" stroke="' + dark + '" stroke-width="3"/><path d="M34 84c20-21 37-34 55-48" fill="none" stroke="' + rose + '" stroke-width="4" stroke-linecap="round"/>')),
    item('skin_clean', '클린 케어', '왁싱/피부', ['왁싱', '피부관리'], ['완성샷'], 104, 'top-left', '밝은 사진', labelSvg('CLEAN', dark, cream, dark)),
    item('skin_smooth', '스무스 케어', '왁싱/피부', ['왁싱', '피부관리'], ['완성샷'], 108, 'bottom-right', '밝고 어두운 사진', labelSvg('SMOOTH', cream, dark, nude)),
    item('skin_aftercare', '애프터 케어', '왁싱/피부', ['왁싱', '피부관리'], ['공지', '리터치'], 122, 'bottom-center', '밝고 어두운 사진', labelSvg('AFTER CARE', nude, dark, nude)),
    item('skin_calm', '진정 케어', '왁싱/피부', ['왁싱', '피부관리'], ['완성샷', '리터치'], 102, 'top-right', '밝고 어두운 사진', labelSvg('CALM', cream, dark, rose)),
    item('soft_arrow', '부드러운 화살표', '화살표/강조', ALL, ['완성샷', '전후사진', '이벤트'], 92, 'bottom-right', '어두운 사진',
      svg(120, 120, '<path d="M18 28c11 45 38 61 78 56" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/><path d="M78 66l22 18-20 19" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>')),
    item('price_tag', '가격 안내', '가격/할인', ALL, ['이벤트', '공지'], 108, 'bottom-left', '밝고 어두운 사진',
      svg(170, 100, '<path d="M8 20Q8 8 20 8h100l42 42-42 42H20Q8 92 8 80z" fill="' + dark + '"/><circle cx="126" cy="50" r="7" fill="' + cream + '"/><text x="68" y="59" text-anchor="middle" font-family="Arial,sans-serif" font-size="25" font-weight="800" fill="#fff">PRICE</text>')),
    item('salon_spark', '살롱 포인트', '감성 포인트', ALL, ['완성샷', '후기'], 76, 'top-right', '밝고 어두운 사진',
      svg(120, 120, '<path d="M42 8c4 23 9 28 32 32-23 5-28 10-32 34-5-24-10-29-34-34 24-4 29-9 34-32z" fill="' + cream + '" stroke="' + nude + '" stroke-width="3"/><path d="M88 57c3 14 7 18 21 21-14 3-18 7-21 22-3-15-7-19-22-22 15-3 19-7 22-21z" fill="' + nude + '"/>'))
  ];

  window.ItdBeautyStickers = catalog;
}());
