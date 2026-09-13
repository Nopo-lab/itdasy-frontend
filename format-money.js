/**
 * 잇데이 금액 포맷 공통 유틸
 * 규칙 (원영 확정 2026-05-19):
 *   - ₩ 접두어 금지. 전부 "원" 접미어
 *   - 실제 매출 = 원 단위 정확 (반올림 없음)
 *   - 예상매출만 1,000원 단위 반올림 허용
 *   - 만원 단위 표기: "419.5만원" 형태
 */
(function () {
  'use strict';

  function _comma(n) {
    return Math.floor(n).toLocaleString('ko-KR');
  }

  function formatMoney(v) {
    const n = Number(v) || 0;
    return _comma(n) + '원';
  }

  function formatEstimate(v) {
    const n = Math.round((Number(v) || 0) / 1000) * 1000;
    return _comma(n) + '원';
  }

  function formatMan(v) {
    const n = Number(v) || 0;
    if (n === 0) return '0원';
    const man = Math.round(n / 1000) / 10;
    return man + '만원';
  }

  window.formatMoney = formatMoney;
  window.formatEstimate = formatEstimate;
  window.formatMan = formatMan;

  // ── 사람이 읽는 한글 날짜/시간 (예약 카드·상세·잇비 공용) ─────────────
  //   [핫픽스D] ISO("2026-06-17T03:00:00")·"YYYY-MM-DD" 노출 금지.
  //   요구 포맷: "오늘 오후 3:00" · "내일 오후 4:00" · "6월 19일 오후 1:00"
  //             범위 "오후 1:00 ~ 오후 4:00" · "6월 19일 오후 1:00 ~ 오후 4:00"
  function _toDate(input) {
    if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
    if (input == null || input === '') return null;   // new Date(null)=epoch 방지
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }
  function _kHour(d) {
    const h = d.getHours(), m = d.getMinutes();
    const ap = h < 12 ? '오전' : '오후';
    const h12 = (h % 12) === 0 ? 12 : (h % 12);
    return ap + ' ' + h12 + ':' + String(m).padStart(2, '0');
  }
  function _sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }
  // "오늘"/"내일"/"모레"/"어제"/"6월 19일"
  function fmtKDateLabel(input) {
    const d = _toDate(input); if (!d) return '';
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = Math.round((target - today) / 86400000);
    if (diff === 0) return '오늘';
    if (diff === 1) return '내일';
    if (diff === 2) return '모레';
    if (diff === -1) return '어제';
    return (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
  }
  // "오후 3:00"
  function fmtKTime(input) {
    const d = _toDate(input); if (!d) return '';
    return _kHour(d);
  }
  // "내일 오후 4:00" · "6월 19일 오후 1:00"
  function fmtKDateTime(input) {
    const d = _toDate(input); if (!d) return '';
    return fmtKDateLabel(d) + ' ' + _kHour(d);
  }
  // 시작~끝 — 같은 날이면 날짜 1회: "내일 오후 1:00 ~ 오후 4:00"
  function fmtKRange(startInput, endInput) {
    const s = _toDate(startInput); if (!s) return '';
    const head = fmtKDateTime(s);
    const e = _toDate(endInput); if (!e) return head;
    return _sameDay(s, e) ? (head + ' ~ ' + _kHour(e)) : (head + ' ~ ' + fmtKDateTime(e));
  }

  /* [2026-09-13 P2] 서버가 주는 시각은 UTC(tz-aware) 다. 그걸 **문자열로 자르면 안 된다** —
     실측: `2026-09-12T18:00:00+00:00` 은 KST 9/13 03:00 인데 잘라 쓰면 09/12 로 나왔다.
     위의 fmtK* 는 기기 로컬 시각을 쓴다. 장부·시술 기록은 샵 기준(KST)으로 고정해야 하므로
     app-revenue-calendar.js `_kstDay()` 와 같은 의미로 Asia/Seoul 을 명시한다.
     (같은 변환을 세 번째로 복붙하지 않으려고 날짜 포맷이 모여 있는 여기로 올렸다) */
  function _kstParts(input) {
    const d = _toDate(input); if (!d) return null;
    try {
      // en-CA 는 YYYY-MM-DD 고정폭이라 잘라 쓰기 안전하다.
      const day = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
      const time = d.toLocaleTimeString('en-GB', {
        timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false,
      });
      return { day: day, time: time };
    } catch (_e) { return null; }
  }
  /** "09/13" — 날짜만, KST */
  function fmtKMonthDay(input) {
    const p = _kstParts(input);
    return p ? p.day.slice(5).replace('-', '/') : '';
  }
  /** "09-13 12:36" — 날짜+시각, KST */
  function fmtKShortDateTime(input) {
    const p = _kstParts(input);
    return p ? (p.day.slice(5) + ' ' + p.time) : '';
  }

  window.fmtKMonthDay = fmtKMonthDay;
  window.fmtKShortDateTime = fmtKShortDateTime;
  window.fmtKDateLabel = fmtKDateLabel;
  window.fmtKTime = fmtKTime;
  window.fmtKDateTime = fmtKDateTime;
  window.fmtKRange = fmtKRange;
})();
