/* 잇비 마케팅/발송 액션 안전 라벨 (T-109 · 2026-05-30)

   목적: 발송 계열 액션의 확인 카드에서 "실행 전" 실제 발송 가능성을 명확히 표시.
   배경(P0-B 조사): send_message channel=sms 는 백엔드 SMS_API_KEY+URL env 가 켜져 있으면
     실제 고객에게 SMS 발송됨(없으면 mock). kakao/dm 은 항상 mock. publish_instagram 은
     게시 대기열/초안(직접 게시 아님). generate_bulk_message·draft_message 는 초안만.
   백엔드는 실행 후 "(mock)" 을 정직하게 알려주나, 실행 전에도 위험을 알려야 신뢰 유지.

   순수 표시 유틸 — 발송/외부호출 없음. kind/payload 기반으로 라벨만 계산.

   [danger 정책 메모] generate_bulk_message 는 현재 초안만(safe). 향후 실제 대량 발송이
     결선되면 즉시 level:'danger' 로 승격하고 RISKY_ACTION_KINDS(kind-core.js)에 추가해
     nativeConfirm 게이팅해야 함(T-111). */
(function () {
  'use strict';
  if (window.ItdasyMarketingSafety) return;

  // [T-111] 대량 메시지 정책 — 코드로 고정. 출시 전 안전 가드.
  //   현재(BULK_DRAFT): generate_bulk_message 는 초안만 생성, 실제 대량 발송 없음 → safe.
  //   향후(BULK_SEND): 실제 대량 발송이 결선되는 순간 반드시:
  //     ① level 'danger' 로 승격  ② RISKY_ACTION_KINDS(kind-core.js) 에 추가해 nativeConfirm 게이팅
  //     ③ 영향 고객 수 + 최종 확인 + 야간(21~08시) 광고 제한 안내  ④ 별도 kind(예: send_bulk_message) 권장.
  //   현재 BULK_SEND 는 미구현(NOT_IMPLEMENTED) — 프론트는 어떤 경우에도 대량 발송을 실행하지 않는다.
  const BULK_POLICY = {
    BULK_DRAFT: { level: 'safe', implemented: true,  note: '초안만 생성, 실제 대량 발송 없음' },
    BULK_SEND:  { level: 'danger', implemented: false, note: '대량 실발송 — 미구현. 결선 시 danger 승격 + nativeConfirm 필수' },
  };

  // 반환: { level:'safe'|'confirm'|'danger', badge, message } | null(비마케팅)
  function getMarketingSafetyLabel(action) {
    if (!action || !action.kind) return null;
    const kind = action.kind;
    const p = action.payload || {};
    const channel = String(p.channel || '').toLowerCase();

    if (kind === 'draft_message') {
      return { level: 'safe', badge: '초안',
        message: '메시지 초안만 만들어요. 실제 발송은 하지 않습니다. 복사·수정 후 사용하세요.' };
    }
    if (kind === 'generate_bulk_message') {
      // [T-111] 초안만(safe). 실발송 결선 시 danger 승격 — BULK_POLICY 참조.
      return { level: 'confirm', badge: '대량 초안',
        message: '여러 고객 대상 문구 초안만 만들어요. 실제 대량 발송은 하지 않습니다. (대량 발송 기능은 안전 확인 후 별도 제공 예정)' };
    }
    if (kind === 'send_message') {
      if (channel === 'kakao' || channel === 'dm') {
        return { level: 'confirm', badge: '테스트/준비중',
          message: '현재 채널 상태에 따라 테스트(mock) 또는 준비중일 수 있어요. 실행 결과 메시지를 확인하세요.' };
      }
      return { level: 'danger', badge: '실제 발송 가능',
        message: 'SMS 설정이 켜져 있으면 실제 고객에게 문자로 발송됩니다. 실행 전 내용을 꼭 확인하세요.' };
    }
    if (kind === 'reply_dm' || kind === 'send_dm') {
      return { level: 'confirm', badge: '테스트/준비중',
        message: '현재 채널 상태에 따라 테스트(mock) 또는 준비중일 수 있어요. 실행 결과 메시지를 확인하세요.' };
    }
    if (kind === 'publish_instagram') {
      return { level: 'confirm', badge: '게시 준비',
        message: '잇비에서는 게시 대기열/초안 단계로 처리돼요. 바로 게시되지 않고 확인 후 발행 단계로 넘어갑니다. (실제 발행은 갤러리·캡션 화면에서)' };
    }
    return null;
  }

  // 라벨 → 카드 안 배지+안내 HTML. _esc 는 호출측 제공(없으면 평문).
  function renderSafetyHTML(action, esc) {
    const lab = getMarketingSafetyLabel(action);
    if (!lab) return '';
    const e = (typeof esc === 'function') ? esc : (s) => String(s == null ? '' : s);
    const colors = {
      safe:   { bg: '#EAF7EE', fg: '#15803D', bd: '#BFE6CC' },
      confirm:{ bg: '#FFF7E6', fg: '#B45309', bd: '#FCE4B6' },
      danger: { bg: '#FDECEC', fg: '#C0392B', bd: '#F5C6C2' },
    };
    const c = colors[lab.level] || colors.confirm;
    return `<div style="margin:0 0 10px;padding:9px 11px;background:${c.bg};border:0.5px solid ${c.bd};border-radius:10px;display:flex;gap:8px;align-items:flex-start;">
      <span style="flex:none;font-size:10.5px;font-weight:800;color:${c.fg};background:#FFFFFF;border:0.5px solid ${c.bd};border-radius:6px;padding:2px 6px;letter-spacing:-0.2px;">${e(lab.badge)}</span>
      <span style="font-size:12px;color:${c.fg};line-height:1.45;font-weight:500;">${e(lab.message)}</span>
    </div>`;
  }

  // [T-111] 대량 실발송 차단 가드 — 현재 항상 true(미구현). 발송류 코드가 호출해 방어할 수 있게 노출.
  function isBulkSendBlocked() { return !BULK_POLICY.BULK_SEND.implemented; }

  window.ItdasyMarketingSafety = { getMarketingSafetyLabel, renderSafetyHTML, BULK_POLICY, isBulkSendBlocked };
})();
