# v550 ROI 안전 수정 보고서

작성일: 2026-06-24  
브랜치: `fe/T-600-v550-roi-safety`  
현재 판정: **PC PASS / Android 실제 기기 미실행**

## 1. 원인 분석

손과 네일 영역을 못 찾은 뒤에도 보정 엔진이 다른 값을 대신 사용했습니다.

| 기능 | 이전 행동 | 문제 |
|---|---|---|
| 손 피부톤 | 손 마스크가 없으면 피부색 전체 사용 | 얼굴·배경·손과 비슷한 색까지 변화 |
| 네일 광택 | 네일 마스크가 없으면 밝기·채도·반짝임으로 추정 | 손 피부와 밝은 배경까지 변화 |
| 네일 경계 | 추정 네일 영역 또는 약한 전체 선명도 | 손톱 밖 선명도 변화 |
| 마스크 보기 | 추정 영역을 실제 검출처럼 표시 | 사용자가 인식 성공으로 오해 |
| PC 표시 | 사진은 전체 보기, 마스크는 화면 채우기 | 이마·관자놀이·사진 밖으로 위치 이탈 |

## 2. 수정 내용

- 손 마스크가 없으면 손 피부톤 보정을 실행하지 않습니다.
- 네일 마스크가 없으면 네일 광택·경계 보정을 실행하지 않습니다.
- 실패 시 슬라이더를 0으로 돌리고 다음 안내를 표시합니다.
  - `손을 인식하지 못했습니다`
  - `네일을 인식하지 못했습니다`
- 마스크 보기에는 실제 검출 결과만 표시합니다.
- 사진과 마스크 모두 `contain` 기준의 같은 위치·크기를 사용합니다.
- 마스크 색을 통일했습니다.
  - 눈 파랑
  - 눈썹 초록
  - 손 주황
  - 네일 핑크
  - 헤어 보라
- 눈·눈썹·헤어 검출 방식은 변경하지 않았습니다.

## 3. 수정 파일

| 기능 | 파일 |
|---|---|
| 손·네일 엄격 적용 | `js/photo-editor/beauty-engine.js` |
| 검출 결과 안전 확인 | `js/photo-editor/mask-application.js` |
| 실패 안내·재그리기 | `js/photo-editor/mask-strict-policy.js`, `app-photo-editor-beauty.js` |
| 손·네일 추정 차단 | `js/photo-editor/region-mask-provider.js`, `app-photo-editor-smart-mask.js` |
| 작업실 적용·안내 | `js/workspace/workspace-adapter.js`, `js/workspace/workspace-v2-flow.js` |
| 마스크 색·상태 | `js/photo-editor/mask-debug-overlay.js`, `js/photo-editor/mask-status-ui.js`, `js/photo-editor/mask-qa-tool.js` |
| 자동 확인 | `js/photo-editor/__tests__/strict-roi.test.js`, `scripts/photo-mask-nail-qa.js`, `scripts/photo-mask-status-qa.js` |
| 새 버전 반영 | `app-core.js`, `index.html`, `js/load-groups.js`, `sw.js` |

## 4. fallback 전수조사

| 파일 | 함수·위치 | 이전 행동 | 처리 |
|---|---|---|---|
| `beauty-engine.js` | `_pixel`의 `handW` | 손 마스크 없음 → 피부색 | **제거**. 없으면 0 |
| `beauty-engine.js` | `_nailWeight`, `_nailBlend` | 밝기·채도·반짝임 추정 | **제거** |
| `beauty-engine.js` | `_applyDetail` | 네일 마스크 없이 광택 | **제거** |
| `beauty-engine.js` | `_applySharpen` | 네일 마스크 없이 경계 선명 | **제거** |
| `region-mask-provider.js` | `_tier3_heuristic` | 손·네일 색상 추정 허용 | **금지** |
| `region-mask-provider.js` | `nailMask`, `handSkinMask` | 손 모델 실패 시 추정값 사용 | **제거**. 실패 결과 반환 |
| `app-photo-editor-smart-mask.js` | `_nailScore` | 반짝임·채도로 네일 추정 | **제거**. 네일 점수 0 |
| `workspace-v2-flow.js` | `_heuristicRoi` | 추정 손·네일 마스크 표시 | **함수 제거** |
| `workspace-v2-flow.js` | `_renderMaskOverlay` | 추정 결과도 화면 표시 | **제거**. 실제 검출만 표시 |
| `mask-application.js` | `_nailGatePass`, `_handGatePass` | 손·네일 사용 조건 | **유지·강화**. 기기 검출 결과만 허용 |
| `workspace-adapter.js` | `_beautyMasksAsync` | 손·네일 준비 전 보정 진행 | **수정**. 검출 완료를 기다림 |

남겨둔 경로:

- 눈·눈썹·헤어의 기존 보정 경로는 이번 지시대로 수정하지 않았습니다.
- PC에서 헤어 모델이 그래픽 기능 문제로 실패하는 현상도 이번 손·네일 수정 범위에서 제외했습니다.

## 5. PC 마스크 표시 수정

이전:

- 사진: 전체가 보이게 표시
- 마스크: 화면을 가득 채우며 일부 잘라 표시

수정:

1. 사진 원본 비율과 화면 영역으로 실제 표시 사각형 계산
2. 마스크를 같은 사각형에 그림
3. 사진과 마스크에 같은 확대·이동값 사용
4. 사진 밖 영역은 투명 유지

## 6. QA 결과

### 자동 확인

| 확인 | 결과 |
|---|---|
| 전체 테스트 140개 | PASS |
| 기본 실행 확인 95개 파일 | PASS |
| 손·네일 엄격 규칙 4개 | PASS |
| 네일 마스크 검사 17개 | PASS |
| 마스크 상태 검사 18개 | PASS |
| 눈썹 마스크 검사 16개 | PASS |
| 파일 깨짐 검사 | PASS |
| 자동 검사 | 빨간 오류 0개, 기존 노란 경고만 존재 |

눈 흰자 전용 옛날 검사 3개는 v549 원본에서도 동일하게 실패했습니다. 이번 변경으로 생긴 문제는 아니며, “눈·눈썹·헤어는 실제 휴대폰 근거 없이 수정 금지” 지시에 따라 손대지 않았습니다.

### PC Chrome 800×600

| 사진·기능 | 결과 |
|---|---|
| 세로 얼굴 눈 마스크 | PASS — 실제 눈 위, 사진 밖 표시 없음 |
| 가로 얼굴 눈 마스크 | PASS — 회전된 눈 위치와 일치, 사진 밖 표시 없음 |
| 정사각 얼굴 눈 마스크 | PASS — 실제 눈 위치와 일치 |
| 얼굴 사진에 손 피부톤 100 | PASS — 검출 실패, 값 0, 보정 없음, 안내 확인 |
| 얼굴 사진에 네일 광택 100 | PASS — 검출 실패, 값 0, 보정 없음, 안내 확인 |
| 손등 | PASS 조건 충족 — 손 검출 실패 시 보정 없음 |
| 손바닥 | PASS 조건 충족 — 손 검출 실패 시 보정 없음 |
| 누드톤·투명젤·프렌치·컬러 네일 | PASS 조건 충족 — 네일 검출 실패 시 보정 없음 |
| 눈썹·헤어 | PC에서는 검출 실패. 검출 방식 미수정 |

증거: `output/v550-browser-qa/`

### Android 실제 기기

**미실행**

- Android 도구는 설치돼 있습니다.
- `adb devices -l` 결과 연결된 기기가 0대입니다.
- 실제 기기 PASS 전에는 커밋·푸시하지 않는다는 작업 원칙을 적용했습니다.

## 7. 남은 이슈

1. Android 실제 기기를 USB 디버깅으로 연결해 같은 사진을 다시 확인해야 합니다.
2. 실제 기기에서 눈·눈썹·헤어는 기존처럼 정상인지 스크린샷을 저장해야 합니다.
3. 손·네일 검출률 자체는 아직 낮습니다. 이번 수정은 못 찾았을 때 엉뚱한 곳을 보정하지 않도록 막은 작업입니다.
4. 흰자 옛날 자동 검사는 v549부터 실패 중이며 별도 작업이 필요합니다.

## 8. Commit / Push

| 항목 | 결과 |
|---|---|
| Commit SHA | 없음 — Android 실제 기기 QA 대기 |
| Push | 미실행 — QA 통과 전 push 금지 원칙 준수 |

## 9. 파일 크기/분리 판단

- 기존 큰 파일에는 보정 차단과 연결 부분만 최소 수정했습니다.
- 실패 안내와 준비 상태는 새 파일 `mask-strict-policy.js`로 분리했습니다.
- `beauty-engine.js`는 네일 추정 코드를 제거해 오히려 줄었습니다.
- `workspace-v2-flow.js`도 추정 마스크 생성 함수를 제거해 줄었습니다.

