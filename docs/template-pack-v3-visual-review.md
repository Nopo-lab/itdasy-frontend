# Template Pack v3 Visual Review

> 작성 2026-06-08 · 브랜치 `claude/template-pack-v3` · 독립 preview 눈검수 (앱 미연결)
> 검수 도구: Chrome headless 스크린샷 (데스크탑 1480px / 모바일 412px)
> 캡처 원본: `docs/captures/` (카테고리×디바이스 9장)

## 캡처 인덱스
| 파일 | 내용 |
|---|---|
| `captures/v3-all-desktop.png` | 16종 전체 (데스크탑 4열) |
| `captures/v3-price-desktop.png` / `captures/v3-price-mobile.png` | 가격표 6종 |
| `captures/v3-ba-desktop.png` / `captures/v3-ba-mobile.png` | 전후 5종 |
| `captures/v3-event-desktop.png` / `captures/v3-event-mobile.png` | 이벤트 3종 |
| `captures/v3-card-desktop.png` / `captures/v3-card-mobile.png` | 후기·샵소개 2종 |

---

## 총평

- **완성도 상위군**: 전후(5종)·후기(1종)는 preview 렌더가 데이터를 충실히 반영해 **그대로 보여줄 수준**.
  before/after 2분할 + 라벨 + 효과 아이콘 행, 후기 별점+인용 카드 모두 위계·가독성 양호.
- **데이터는 좋으나 렌더가 단순한 군**: 가격표(6종)는 팔레트·카피가 차별화돼 있으나, 현재
  **preview 렌더러가 모든 가격표를 동일 레이아웃(중앙 헤더 + 아이콘 행 + CTA)으로** 그린다.
  `previewMeta`의 decor(번호 썸네일·섹션 탭·사진+배지·아이콘 원)와 `photoSlots`가 **시각에 미반영**.
  → 이 차별화는 **앱 연결 PR의 canvas 렌더**에서 구현 예정(데이터엔 이미 의도가 들어있음).
- **컨셉 데코 미구현군**: 이벤트(스크랩북/쿠폰)는 종이·테이프·꽃 같은 데코가 미구현이라 레퍼런스의
  "감성 콜라주" 무드가 약하다. 볼드 할인 배지는 정상 표시(헤더 겹침 해소 완료).
- **QA 안정성**: 16종 전부 렌더, pageerror 0, 모바일 가로 스크롤(overflow) 없음, 렌더 실패 0.

레퍼런스 대비: 전후·후기·럭셔리 가격표는 레퍼런스에 근접. 가격표 SNS/이벤트 감성군은 데코 구현 전이라
레퍼런스 대비 60~70% 수준(데이터는 준비됨, 렌더만 보강하면 도달).

---

## 16종 템플릿 평가표

가독성·모바일: ◎ 우수 / ○ 양호 / △ 보강필요. 우선순위: 1(높음)~3(낮음).

| id | 용도 | 스타일 | 제목 가독성 | 정보 가독성 | 사진 균형 | CTA | 모바일 390 | 레퍼런스 대비 | 앱 연결 우선순위 | 수정 필요점 |
|---|---|---|---|---|---|---|---|---|---|---|
| v3-price-clean-rose | 가격표 | clean | ◎ | ◎ | – (사진없음) | ◎ | ◎ | 높음 | **1** | 없음 (그대로 OK) |
| v3-price-clean-multi | 가격표 3섹션 | clean | ◎ | ○ | △ | ◎ | ◎ | 중 | **1** | 섹션 구분(피부/속눈썹/네일) 렌더 필요 |
| v3-price-luxe-dark | 가격표 럭셔리 | luxe | ◎ | ◎ | △ | ◎ | ◎ | 높음 | **1** | 모델 사이드포토 슬롯 렌더(연결 시) |
| v3-price-clean-photo | 가격표 사진+배지 | clean | ◎ | ◎ | △ | ◎ | ◎ | 중 | 2 | 상단 사진 + BEST/NEW 배지 미반영 |
| v3-price-sns-pastel | 가격표 SNS | pastel | ○ | ○ | △ | ◎ | ◎ | 2 | 중 | 헤드라인 중복·번호 썸네일 미반영 |
| v3-price-sns-icon | 가격표 SNS | pastel | ○ | ○ | △ | ◎ | ◎ | 3 | 중 | ⑤와 시각 거의 동일·PICK 카드 미반영 |
| v3-ba-clean-rose | 전후 | clean | ◎ | ◎ | ◎ | ◎ | ◎ | 높음 | **1** | 없음 (그대로 OK) |
| v3-ba-clean-blue | 전후 | clean | ◎ | ◎ | ◎ | ◎ | ◎ | 높음 | **1** | 없음 (그대로 OK) |
| v3-ba-sns-pink | 전후 | pastel | ◎ | ○ | ◎ | ◎ | ◎ | 중 | **1** | 손글씨·하트 체크리스트는 연결 시 |
| v3-ba-polaroid | 전후 | pastel | ◎ | ○ | ○ | ◎ | ◎ | 중 | 2 | 폴라로이드 틀/테이프 데코 미반영 |
| v3-ba-luxe-dark | 전후 럭셔리 | luxe | ◎ | ○ | ◎ | ◎ | ◎ | 높음 | **1** | 효과 캡션 대비 약간 약함 |
| v3-event-scrapbook | 이벤트 | pastel | ◎ | ○ | ○ | ◎ | ○ | 낮 | 3 | 종이/테이프/꽃 데코 미구현(컨셉 약) |
| v3-event-bold | 이벤트 | pastel | ◎ | ○ | ○ | ◎ | ◎ | 중 | 2 | 배지 정상·헤드라인 우측 여백 빠듯 |
| v3-event-coupon | 이벤트 | clean | ◎ | ○ | – | ◎ | ◎ | 중 | 2 | 헤더/쿠폰 박스 문구 중복 |
| v3-review-card | 후기 | clean | ◎ | ◎ | ○ | ◎ | ◎ | 높음 | **1** | 프로필 placeholder 라벨만 정리 |
| v3-card-shop-intro | 샵소개 | clean | ◎ | ○ | ○ | ◎ | ◎ | 중 | 2 | subtitle ↔ info 행 정보 중복 |

---

## 1차 앱 연결 추천 TOP 8

렌더 완성도 + 범용 수요 기준. (★ = 즉시 연결 가능, 렌더 보강 거의 불필요)

1. **v3-ba-clean-rose** ★ — 피부 전후 범용, 완성도 최상
2. **v3-review-card** ★ — 후기 수요 큼, 별점+인용 완성도 최상
3. **v3-price-clean-rose** ★ — 가격표 기본형, 그대로 사용 가능
4. **v3-ba-clean-blue** ★ — 전후 톤 다양성(블루), 완성도 높음
5. **v3-price-luxe-dark** — 프리미엄 가격표, pro 가치(모델포토 슬롯만 연결)
6. **v3-ba-luxe-dark** — 럭셔리 전후, pro 가치
7. **v3-ba-sns-pink** ★ — 네일/SNS 감성 전후, 완성도 높음
8. **v3-price-clean-multi** — 멀티업종 가격표(연결 시 섹션 렌더 추가 권장)

> ★ 5종은 canvas 포팅만 하면 바로 노출 가능. 5·6·8은 사진/섹션 슬롯 렌더가 함께 필요.

---

## 보류 / 수정 필요한 템플릿

- **v3-price-sns-pastel / v3-price-sns-icon** — 둘 다 헤드라인 "이달의 가격표"로 중복 + 렌더가 동일.
  → 카피 차별화(예: ⑤ "이달의 가격표", ⑥ "LASH & NAIL 가격표") + 번호 썸네일/아이콘 원/PICK 카드 렌더 구현.
- **v3-event-scrapbook** — 스크랩북 컨셉(찢어진 종이·테이프·꽃)이 미구현 → 일반 헤더+사진으로 보임.
  데코 구현 전까지 연결 보류 권장.
- **v3-event-coupon** — 헤더와 쿠폰 박스가 같은 "신규 고객 30% 할인"을 반복.
  → 쿠폰 박스엔 할인코드/유효기간 등 별도 정보로.
- **v3-card-shop-intro** — subtitle(주소·시간)과 하단 info 행이 정보 중복. → 한쪽만 유지.
- **v3-price-clean-photo** — "사진+카드행+배지" 의도가 현재 일반 표로만 표시. 사진 슬롯·배지 렌더 필요.

---

## 추가로 만들면 좋은 템플릿

- **9:16 스토리형** 가격표/전후/이벤트 (현재 4:5·1:1만 있음 — 인스타 스토리 수요 큼)
- **명함/예약 카드** (영업시간·오시는길 중심, 1:1)
- **시술 과정 3단계** (전→중→후, 포트폴리오)
- **멤버십/회원권** 가격표 (정기권·패키지 강조)
- **리뷰 모음(다중 후기)** — 후기 2~3개 그리드

---

## QA 결과

- **pageerror**: 0 (Chrome headless `--dump-dom` + 콘솔 로그 확인, tpv3 관련 에러 없음)
- **모바일 overflow**: 가로 스크롤 없음 (캔버스 `overflow:hidden` + cqw 비율 폰트).
  일부 긴 헤드라인이 캔버스 폭에 빠듯하나 `word-break:keep-all`로 잘림 방어.
- **렌더 실패**: 0 (16/16 렌더, `render error` 표식 0, 가격행 24개 = 6종×4행 정상)
- **검증 카운트**: `tpv3-item` 16 · `tpv3-canvas` 16 · `tpv3-svc-row` 24

### preview 한계 메모 (데이터 결함 아님)
현재 DOM preview 렌더러는 kind별 기본 레이아웃만 구현하고 `previewMeta.decor`/`photoSlots`는 미반영.
가격표·이벤트의 시각 차별화는 **앱 연결 PR에서 canvas slot-aware 렌더로 구현**하면 데이터 그대로 도달 가능.
