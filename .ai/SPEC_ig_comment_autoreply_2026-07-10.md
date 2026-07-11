# 스펙 — 인스타 댓글 선택적 자동 대댓글 (2026-07-10)

> 한 줄: **모든 댓글이 아니라, "가격·예약·위치" 문의 댓글만 골라 대댓글 + DM 퍼널.** 기본은 원장 검토(confirm) 모드.
> 기반: 기존 DM 엔진·confirm 큐·채널 어댑터 재사용 (신규 코드 최소). 관문 = Meta 심사(`manage_comments`).

---

## 1. 원칙

1. **선택적** — 문의성 댓글만. 단순 칭찬/이모지는 무시(또는 좋아요만).
2. **댓글→DM 퍼널** — 공개답글은 짧게 "DM 드렸어요", 상세(가격·링크)는 비공개 DM.
3. **검토 우선** — 공개 노출이라 오답=브랜드 타격. 기본 confirm(초안→원장 탭→발송). 자동은 고급 옵션.
4. **재사용 최대화** — 댓글 = 인바운드 텍스트 = 우리 DM 엔진이 이미 처리하는 형태.

---

## 2. 아키텍처 (재사용 vs 신규)

```
[인스타 웹훅 comments]
   → dm_autoreply.py 웹훅 분기에 field=="comments" 추가        (신규: 몇 줄)
   → services/channels/instagram_comments.py  parse_webhook     (신규: 어댑터 1개)
   → 댓글 필터 comment_filter.py  (의도 화이트리스트 + like_count) (신규: 필터 1개)
        ├ 문의 아님 → 종료(무시)
        └ 문의 → dm_intent.py 의도확정 → dm_context_builder → 초안 2종
                   · 공개답글 초안(짧게)      · 비공개 DM 초안(상세, shop_* 설정)
   → dm_confirm_queue (channel='ig_comment')                    (재사용)
   → 원장 검토/발송
        · 공개답글  POST /{comment-id}/replies                   (어댑터 send)
        · 비공개DM  POST /{ig-id}/messages recipient=comment_id  (재사용 messaging)
```

**재사용(그대로):** `dm_intent.py`, `dm_manual_matcher.py`, `dm_context_builder.py`, `dm_free_reply.py`, `dm_confirm_queue.py`, `services/channels/base.py`, `medical_ad_guard.py`, `channel-mark.js`, `app-dm-confirm-queue.js`.
**신규:** ①댓글 채널 어댑터 ②댓글 필터 ③웹훅 comments 분기 ④설정(댓글용) ⑤FE 설정 화면 + 큐 채널 배지.

---

## 3. 필터 룰 (2단계 — 오탐 최소화)

### ① 의도 화이트리스트 (pre-filter, 키워드)
| 의도 | 트리거 키워드(예) | 답글 |
|---|---|---|
| 가격 | 얼마, 가격, 비용, 금액, 페이, ○○원?, price | ✅ |
| 예약 | 예약, 어떻게, 어디서, 링크, 방문, 잡고싶, dm | ✅ |
| 위치 | 어디, 위치, 주소, 오시는, 지역, ○○동 | ✅ |
| 시간/영업 | 몇시, 영업, 오픈, 언제, 쉬는날, 가능 | ✅(옵션) |
| 단순 칭찬/이모지 | 예뻐, 대박, 최고, 짱, ❤️/😍 only | ❌ 무시 |

- 화이트리스트 통과 → `dm_intent.py`로 **의도 재확정**(2차 검증). 둘 다 만족해야 초안 생성.
- **애매(confidence 낮음)** → 답글 X, **원장에게 "이거 문의 같아요?" 제안만**.

### ② 인게이지먼트 우선순위 (정렬)
- 댓글 API가 주는 **`like_count`** 로 "좋아요 많은 문의 댓글 우선".
- 원장 설정: `min_like`(기본 0), `recent_first`(최근 우선). 노출 큰 것부터 큐 상단.

### 안전
- 같은 댓글 **1회만**(idempotency, DMMessageLog 재사용). Meta 댓글 답글 rate limit 준수.
- 공개답글 문구는 `medical_ad_guard`·`marketing-draft-policy` 통과(과장·의료 금지어 차단).

---

## 4. 데이터 모델 (재사용 우선)

- **DMMessageLog** 재사용 + 필드: `channel='ig_comment'`, `comment_id`, `media_id`, `like_count`, `is_public_reply`(공개/비공개).
- **DMConversationContext** 재사용 (댓글 작성자 기준 문맥).
- **설정**: `DMAutoReplySetting` 확장 — `comment_enabled`, `comment_intents`(price/booking/location/hours), `comment_mode`(review|auto), `comment_min_like`, `comment_funnel_dm`(공개답글+DM 동시).
- Alembic 없음 → `main.py` 런타임 스키마 진화(자동 ALTER)로 컬럼 추가.

---

## 5. 백엔드 작업 체크리스트

- [ ] `instagram.py` `_FULL_SCOPE`에 `instagram_business_manage_comments` 추가.
- [ ] `subscribe-app` `subscribed_fields`에 `comments` 추가.
- [ ] `dm_autoreply.py` 웹훅 loop `field=="comments"` 분기 → 댓글 파이프라인.
- [ ] `services/channels/instagram_comments.py` — `parse_webhook`(comment payload→{media_id,comment_id,text,from,like_count}), `send`(공개=`/replies`, 비공개=`/messages`).
- [ ] `services/comment_filter.py` — 화이트리스트 + intent + like 필터.
- [ ] confirm 큐에 `channel='ig_comment'` 태우기(초안 2종: public_reply / private_dm).
- [ ] 설정 엔드포인트: `GET/POST /instagram/comment-autoreply/settings`.

## 6. 프론트 작업 체크리스트

- [ ] 설정 화면 — 의도 토글(가격/예약/위치/시간) + 모드(검토/자동) + 최소 좋아요 + 퍼널 ON. (`app-dm-menu.js` 패턴 재사용, 연동 허브에 진입점)
- [ ] confirm 큐 — 댓글 카드에 채널 배지(`ChannelMark.mark('instagram')`) + "공개답글 미리보기/비공개DM 미리보기" 2단 + [발송]/[수정]/[안함].
- [ ] 결과 표시 — 발송 후 "공개답글 달림 · DM 전송됨" 상태.

---

## 7. UI/UX/CTA (필수만)

**화면 A — 설정 (연동 허브 안)**
- 상단: "댓글 문의 자동 응대" 토글(마스터)
- 어떤 문의에 답할까: `가격`·`예약`·`위치`·`영업시간` 칩 토글(기본 가격·예약·위치 ON)
- 응대 방식: `검토 후 발송`(기본) / `바로 발송`(고급) 세그먼트
- 옵션: "공개답글 + 비공개 DM 같이" 토글(ON), "좋아요 N개 이상만" 슬라이더
- CTA: **[이렇게 저장]**

**화면 B — confirm 큐 카드 (핵심)**
- 상단: 채널배지(IG) + 게시물 썸네일 + `♥ 12` (댓글 좋아요)
- 손님 댓글 원문: *"여기 속눈썹 얼마예요?"* + 의도칩 `가격 문의`
- 초안 2단:
  - 💬 공개답글: *"문의 감사해요! 확인하고 DM 드렸어요 편하게 봐주세요"*
  - ✉️ 비공개 DM: *"속눈썹 벨벳 5만원이에요. 예약은 여기서 → (링크)"*
- CTA: **[답글 보내기]** (주버튼) · [수정] · [안 함]

**화면 C — 결과**
- "공개답글 달림 · DM 전송됨" 체크 + "이번 주 문의 응대 8건" 미니 통계

**CTA 문구 세트 (공개답글, 짧고 안전 · 퍼널)**
- 가격: "문의 감사해요! 자세한 가격 DM 드렸어요"
- 예약: "예약 도와드릴게요, DM 확인해 주세요"
- 위치: "위치·오시는 길 DM으로 보냈어요"
- 애매: (공개답글 X) 원장에게 "이 댓글 문의 같아요 — 답할까요?" 제안

---

## 8. Meta 심사 명분 (justification)

> "1인 뷰티샵 사장이 게시물 댓글로 들어오는 **가격·예약·위치 문의**에 신속·정확히 응대하기 위한 기능. 자동 스팸이 아니라 문의성 댓글만 필터링해 사장 검토 후 응대. `content_publish`와 함께 신청."

- content_publish 재심사 때 **묶어서 신청** (어차피 심사 1회 더).

---

## 9. 단계

- **P1 (MVP)**: 검토 모드만, 화이트리스트 3종(가격/예약/위치), 공개답글+DM 퍼널, 큐 재사용. 자동발송 없음.
- **P2**: 자동 모드(확실+좋아요 조건), 페르소나 말투, 좋아요 우선정렬, 응대 통계.
- **P0 선행**: Meta `manage_comments` 심사(코드보다 이게 리드타임 김).

## 10. 리스크

| 리스크 | 대응 |
|---|---|
| 공개 오답 노출 | 기본 검토 모드, 화이트리스트 2중, 애매하면 답 안 함 |
| Meta 심사 지연 | content_publish와 묶어 신청, 코드는 env off로 미리 머지 |
| 댓글 답글 rate limit | 큐잉·1댓글1회·우선순위 발송 |
| 과장·의료 표현 | medical_ad_guard·draft-policy 통과 강제 |

_결론: 신규 코드 작음(어댑터+필터+분기), 진짜 관문은 Meta 심사. 선택적 필터 = 위험↓·가치↑·심사명분↑._

---

## 11. 고도화 진행 (2026-07-11)

**완료·배포:**
- 분류 v2/v3: 스팸·칭찬·제품출처 제외 / 불만(complaint, 최우선)·시술(service)·단골(returning) 추가 / 코퍼스 60+건 0오분류.
- 톤 분기: 불만=사과·비영업, 시술=안내, 단골=반갑게. 오해방지(공개답글 "DM보냈어요" 단정 금지).
- idempotency: CommentReplyLog로 응대한 댓글 큐 영구 제외(실검증 완료).
- 비용: CommentDraftCache로 댓글당 LLM 1회.
- 말투 학습: DMOwnerReplySample few-shot 주입 + 편집발송 학습(DM과 통합).
- 확신도: high/low(불만=high). FE '확실' 배지.
- DM처럼: 매뉴얼 멘트 재사용('내 멘트'), 인라인 수정('수정함').

**남은 것 — Phase 3 실시간 자동응답(웹훅) — 미구현·검증필요:**
1. Meta 앱 대시보드에서 **`comments` 필드 웹훅 구독**(원장 설정, manage_comments처럼).
2. 웹훅 핸들러: 댓글 수신 → 분류 → **confidence=high & intent≠complaint & 미응대 & 자동모드ON** 이면 자동 공개답글, 아니면 큐로.
3. 안전장치: 불만·애매(low)는 절대 자동 X, rate limit, CommentReplyLog idempotency, 기본 OFF(opt-in).
4. ⚠️ **공개 오발송 위험 + 실댓글 웹훅 없이는 E2E 검증 불가** → 켜기 전 반드시 실검증. 검증 없이 자동 공개발송 활성화 금지.
