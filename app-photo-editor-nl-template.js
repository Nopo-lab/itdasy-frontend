/* 사진 편집기 — 말로 전후사진 템플릿 선택 (v2 확장) */
(function () {
  'use strict';
  if (window.PhotoEditorNLTemplate) return;

  var TRIGGER = /전후|비포|애프터|인스타|피드|스토리|홍보|템플|가격표|후기|얹|올려|포트폴리오|명함|카드|배너|썸네일|블로그|리뷰|이벤트|할인|오픈|공지|안내|메뉴판/;

  function plan(text) {
    var input = String(text || '');
    if (!TRIGGER.test(input)) return null;
    var tpl = _template(input);
    return { steps: [{ action: 'apply_template', params: tpl, description_ko: tpl.label + ' 적용' }] };
  }

  function _template(input) {
    // 스토리 계열 (9:16)
    if (/스토리/.test(input)) {
      if (/이벤트|할인/.test(input)) return { template: 'ba-event', ratio: '9:16', label: '이벤트 스토리' };
      if (/전후|비포|애프터/.test(input)) return { template: 'ba-2split-v', ratio: '9:16', label: '스토리 전후사진' };
      return { template: 'story-open', ratio: '9:16', label: '스토리 홍보' };
    }

    // 가격표
    if (/가격|메뉴판|시술.*표/.test(input)) {
      if (/헤어/.test(input)) return { template: 'price-hair', ratio: '4:5', label: '헤어 가격표' };
      if (/네일/.test(input)) return { template: 'price-nail', ratio: '4:5', label: '네일 가격표' };
      if (/속눈썹|래시/.test(input)) return { template: 'price-lash', ratio: '4:5', label: '속눈썹 가격표' };
      if (/메이크업/.test(input)) return { template: 'price-makeup', ratio: '4:5', label: '메이크업 가격표' };
      if (/왁싱/.test(input)) return { template: 'price-wax', ratio: '4:5', label: '왁싱 가격표' };
      if (/전후/.test(input)) return { template: 'ba-price', ratio: '4:5', label: '가격표 전후사진' };
      return { template: 'ba-price', ratio: '4:5', label: '가격표' };
    }

    // 후기/리뷰
    if (/후기|리뷰/.test(input)) return { template: 'ba-review', ratio: '4:5', label: '후기 전후사진' };

    // 이벤트/할인
    if (/이벤트|할인|프로모션|쿠폰/.test(input)) return { template: 'ba-event', ratio: '9:16', label: '이벤트 홍보' };

    // 오픈/공지/안내
    if (/오픈/.test(input)) return { template: 'story-open', ratio: '9:16', label: '오픈 알림' };
    if (/공지|안내/.test(input)) return { template: 'feed-notice', ratio: '4:5', label: '안내사항' };

    // 과정
    if (/과정|프로세스|순서/.test(input)) return { template: 'ba-3process', ratio: '4:5', label: '시술 과정' };

    // 포트폴리오/4컷
    if (/포트폴리오|4컷|네컷|모아/.test(input)) return { template: 'ba-4grid', ratio: '1:1', label: '포트폴리오 4컷' };

    // 명함/카드
    if (/명함|카드/.test(input)) {
      if (/골드/.test(input)) return { template: 'card-gold', ratio: '1:1', label: '골드 명함' };
      if (/핑크/.test(input)) return { template: 'card-pink', ratio: '1:1', label: '핑크 명함' };
      if (/다크|블랙/.test(input)) return { template: 'card-dark', ratio: '1:1', label: '다크 명함' };
      return { template: 'card-minimal', ratio: '1:1', label: '미니멀 명함' };
    }

    // 블로그/배너/썸네일
    if (/블로그|배너|썸네일/.test(input)) return { template: 'ba-2split-h', ratio: '4:5', label: '블로그 배너' };

    // 인스타 피드
    if (/인스타|피드/.test(input)) {
      if (/전후|비포|애프터/.test(input)) return { template: 'ba-2split-h', ratio: '4:5', label: '피드 전후사진' };
      return { template: 'feed-showcase', ratio: '4:5', label: '피드 홍보' };
    }

    // 기본 전후사진
    if (/전후|비포|애프터/.test(input)) {
      if (/세이지|그린|초록/.test(input)) return { template: 'ba-sage', ratio: '4:5', label: '세이지 전후사진' };
      if (/다크|블랙|어두/.test(input)) return { template: 'ba-dark', ratio: '4:5', label: '다크 전후사진' };
      return { template: 'ba-cream', ratio: '4:5', label: '전후사진' };
    }

    // 기본 홍보/템플릿
    return { template: 'ba-cream', ratio: '4:5', label: '홍보 템플릿' };
  }

  window.PhotoEditorNLTemplate = { plan };
})();
