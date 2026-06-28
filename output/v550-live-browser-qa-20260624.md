# v550 라이브 브라우저 실QA (신선 캡처)

- 일시: 2026-06-24
- 커밋: `b9c730d` (fe/T-600-v550-roi-safety)
- 환경: 로컬 정적서버 `localhost:8093` + 프리뷰 Chrome, cbt4@itdasy.com 토큰 주입 로그인
- 환경 능력: 외부 CDN 200 OK, WebGL true → **MediaPipe 실검출 가능** (이전 세션 PC 모델 실패 환경과 다름)
- 백엔드: 프리뷰 origin(localhost:8093) CORS 미허용 → 데이터 API는 막힘. 마스크 파이프라인은 클라이언트 전용이라 무관.

## 1. detector 실작동 (실제 인물 사진 qa-person.jpg 588×771)

| 마스크 | status | tier | coverage | conf | 비고 |
|---|---|---|---|---|---|
| skinMask | ready | 2 | 0.1023 | 0.85 | FaceMesh faceOval − eye/lip |
| hairMask | ready | **1** | 0.0675 | 0.85 | hair_segmenter.tflite 작동 |
| eyeMask | ready | 2 | 0.0041 | 0.85 | leftEye∪rightEye |
| browMask | ready | 2 | 0.0108 | 0.75 | eyebrow convex hull |
| lipMask | ready | 2 | 0.0049 | 0.90 | |
| **scleraMask** | ready | 2 | **0.0007** | **0** | 흰자 = eye−iris. 거의 비어있음 ❌ |

FaceMesh 478 landmark(iris 포함) 검출 성공. 첫 detect 8s(모델 로드), 이후 캐시.

## 2. 좌표 정렬 시각 검증 (마스크 데이터 → 원본 이미지 위 overlay)

- 얼굴: 눈(파랑)·눈썹(초록)·흰자(하늘) 모두 사진 위 얼굴에 얹힘, 스케일 정확, **사진 밖 스필 없음**.
  - ⚠️ 눈썹(초록)이 실제 눈썹보다 위(이마)로 번지고 두꺼움 → dilation 0.01 과함.
  - ⚠️ 흰자(하늘) 373px만 표시 → 사실상 안 보임(검출 실패).
- 손/네일(10-complex-hand 1024×1536): 손(주황) convex hull이 손 위, 네일(핑크) 타원이 손톱 끝에 얹힘. 좌표 정확.

## 3. 손/네일 검출 능력

| 사진 | HandLandmarker | nailMask | handSkinMask |
|---|---|---|---|
| 06-palm (손바닥 전체) | 1 hand | ready 0.0086 | ready 0.2586 |
| 10-complex-hand (손등 전체) | 1 hand | ready 0.0077 | ready 0.1939 |
| 09-french-nail (네일 클로즈업) | **noHand** | **noHand** | **noHand** |

→ 손 전체가 보이면 검출 OK. **네일 클로즈업(손 구조 부족)은 HandLandmarker 자체가 손을 못 잡아 noHand**.
   v550 strict 정책이 추정 없이 보정 차단 = 의도대로 동작(추정 금지 준수).
   단 네일샵 실사진의 핵심인 손톱 클로즈업에 네일 보정이 전혀 안 걸리는 능력 한계는 남음.

## 4. 판정

PASS:
- 좌표계: 마스크가 실제 사진 위 정확 정렬, 사진 밖 표시 없음 (v550 contain 수정 검증).
- 얼굴 detector(눈/눈썹/헤어/피부/입술) 실작동.
- strict 정책: 손/네일 미검출 시 추정 없이 보정 차단.

FAIL/갭:
1. scleraMask 검출 실패(conf 0, cov 0.0006) → 눈맑게가 실제로 안 걸림.
2. browMask dilation 과함 → 눈썹 위 이마로 번짐.
3. 네일 클로즈업 검출 불가(HandLandmarker 한계). 안전 차단은 정상이나 보정 능력 부재.

미검증(후속):
- 에디터 통합 "마스크 보기" 토글 + 모바일 업로드 플로우(업로드 경로 필요).

---

## 5. 후속 수정 + 재검증 (실제 Chrome, 실GPU)

### v551 — 눈썹 dilation 축소 (커밋 d60a3cb)
- region-mask-provider: 눈썹 dilation 0.01→0.004 (반경 6→2px)
- 실QA: browCov 0.0106→0.0068, 초록 마스크 두께 -36%, 이마 번짐 해소. 눈(파랑) 정렬 그대로 정확.

### v552 — 흰자 마스크 사용가능화 + 눈맑게 엄격 (커밋 fd2e234)
- 근본원인: mask-confidence 전역 `coverage<0.001→conf 0` 컷오프가 해부학적으로 작은 흰자(≈0.0006)를 항상 conf 0 으로 → 게이트 영구 탈락 → 휴리스틱 폴백(보기≠적용).
- 수정1: 흰자만 하한 0.0002 분리 → 실QA conf 0→0.8, 게이트 통과, 흰자 overlay 가 실제 눈 흰자위(홍채 양옆)에 정확 표시.
- 수정2(엄격): 흰자 미연결 시 눈맑게를 눈영역 휴리스틱으로 폴백하지 않고 차단 + '흰자 영역을 인식하지 못했습니다'.
- 실QA: 얼굴=흰자 검출→적용(faceStrict []), 손/얼굴없음=차단+안내(handStrict ['sclera']). 보기=적용 일치 달성.

## 6. 남은 이슈
1. 네일 클로즈업(손 구조 없음) 검출 불가 — HandLandmarker 한계. strict 차단은 정상. 전용 nail-plate 검출기는 별도 티켓(ML).
2. 에디터 통합 '마스크 보기' 토글 + 모바일 업로드 UI 플로우 — 실제 업로드 경로 구동 미검증(마스크 데이터 정렬은 검증됨).
3. skinMask/hairMask 의 Tier3 색상·어두운영역 휴리스틱 fallback 잔존 — 실사진선 Tier1/2 우선 동작하나, 엄격 정책 확장 시 후속 정리 대상.

## 7. 커밋
- b9c730d — v550 strict ROI 체크포인트 (손/네일 fallback 제거, PC contain 정렬)
- d60a3cb — v551 눈썹 dilation 축소
- fd2e234 — v552 흰자 사용가능화 + 눈맑게 엄격
- push: 미실행 (원칙상 최종 승인 전 보류)
