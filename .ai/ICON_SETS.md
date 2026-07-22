# 아이콘 세트 참고 (Iconify) — 스티커·UI 디자인용

_2026-07-23 작성. 작업실 스티커에 넣은 세트 + 나중에 UI 디자인 참고할 세트 목록._

---

## 🚦 먼저 — 우리 앱의 아이콘 규칙 두 갈래

헷갈리기 쉬운데 **용도가 완전히 다르다.**

| 구분 | 무엇 | 규칙 |
|---|---|---|
| **UI 아이콘** | 버튼·탭·카드·배지 등 앱 화면 요소 | **Lucide SVG 스프라이트만** (`<svg><use href="#ic-XXX"/></svg>`). 이모지 금지. 새 아이콘은 lucide.dev 에서 가져와 `index.html` 에 `<symbol id="ic-*">` 추가. (루트 CLAUDE.md 규칙) |
| **스티커** | 원장님이 사진 위에 얹는 꾸밈 = **콘텐츠** | UI 규칙 적용 안 됨. 컬러·이모지·아무 세트나 OK. 라이선스만 지키면 된다. |

> 이 문서는 **스티커** 이야기가 중심이고, 아래 "UI 디자인 참고" 절만 UI 쪽이다.

---

## ✅ 지금 앱에 들어간 스티커 세트 (96개)

파일: `js/itd-editor/data/itd-icon-stickers.js` (약 100KB, 로더 `photo` 그룹)
편집기 스티커 탭: **아이콘 / 컬러 / 라인** (각 32개)

| 탭 | Iconify 프리픽스 | 세트 | 라이선스 | 성격 |
|---|---|---|---|---|
| 아이콘 | `mingcute` | MingCute Icon (3,324개) | **Apache 2.0** | 단색 → 앱 스킨 색으로 치환해서 구움 |
| 컬러 | `fluent-emoji-flat` | Fluent Emoji Flat (3,145개) | **MIT** (Microsoft) | 컬러 이모지. 스티커로 제일 잘 붙음 |
| 라인 | `streamline-color` | Streamline color (2,000개) | **CC BY 4.0** | 파스텔 일러스트. ⚠️ 귀속 표기 의무 |

**핵심 설계 두 가지**

1. **런타임에 CDN 을 안 부른다.** 빌드 시점(Iconify API)에 받아 `data:image/svg+xml,...` 로 인라인.
   → 오프라인 PWA 에서도 뜨고, CSP·스토어 심사에서 외부 요청 이슈가 없다. 로딩 지연도 없다.
2. **단색 세트는 색을 입혀서 굽는다.** MingCute 는 `currentColor` 라 그대로 두면 검정 →
   사진 위에서 UI 아이콘처럼 보여 '스티커'로 안 읽힌다. 하트=로즈, 별/다이아=골드,
   케이크/풍선=핑크, 가위/거울=민트 식으로 성격에 맞춰 배색.

---

## ⚠️ 라이선스 — 넣기 전에 반드시 확인

세트를 추가할 때 **여기부터 본다.** 스토어·메타 심사가 걸린 상용 앱이다.

| 라이선스 | 상업 사용 | 귀속 표기 | 판단 |
|---|---|---|---|
| MIT / Apache 2.0 / ISC | ✅ | 권장(의무 아님) | **그냥 써도 됨** |
| CC0 (퍼블릭 도메인) | ✅ | 불필요 | **그냥 써도 됨** |
| **CC BY 4.0** | ✅ | **의무** | 쓰려면 앱 안에 출처를 노출해야 한다 |
| CC BY-SA | ⚠️ | 의무 + 동일조건 전파 | 피하는 게 안전 |
| 무료 티어 + 링크 의무 (Icons8 등) | ⚠️ | 사이트 링크 의무 | 유료 라이선스 사거나 안 쓰는 게 깔끔 |

### 🚨 아직 안 지킨 것 — CC BY 귀속 표기
`streamline-color` 가 **CC BY 4.0** 이라 앱 어딘가에 출처를 노출해야 한다.
데이터는 준비돼 있다: `window.ItdIconStickers.CREDITS` (이름·라이선스·URL 배열).
**설정 > 정보 같은 곳에 이걸 렌더하는 화면이 아직 없다.** 심사 전에 붙이거나,
아니면 `streamline-color` 탭을 빼면 의무가 사라진다. → 연준님 결정 필요.

### 요청받았지만 안 넣은 것 + 이유

| 세트 | 왜 안 넣었나 | 대안 |
|---|---|---|
| **Icons8** (icons8.com 본체) | 무료 티어는 **icons8.com 링크 노출 의무**. 유료는 연 구독. Iconify 의 `icons8` 는 "Windows 10 Icons" 234개(MIT)뿐이라 뷰티 스티커로 쓸 게 거의 없음(검색 결과 2개) | 유료 구매하면 그때 추가 |
| **3D Icons** (3dicons.co) | **CC0 라 라이선스는 자유**. 다만 Blender 렌더 **PNG** 라 개당 수십~수백 KB → 인라인하면 앱이 무거워짐. SVG 가 아니라 벡터 확대도 안 됨 | 꼭 필요하면 R2 에 올려 URL 참조(오프라인 포기) |
| **Streamline 유료 팩** | 무료 공개분(CC BY)만 Iconify 에 있음. 나머지는 유료 | 무료분으로 충분 |

---

## 🔁 재생성 절차 (세트 추가·교체할 때)

`js/itd-editor/data/itd-icon-stickers.js` 는 **손으로 고치지 말고 다시 생성**한다.

```bash
# 1) 세트 라이선스 먼저 확인 — 여기서 걸리면 나머지는 볼 것도 없다
curl -s "https://api.iconify.design/collections" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['mingcute']['license'])"

# 2) 뷰티샵 키워드로 아이콘 이름 수집
for q in heart star sparkle flower gift crown diamond lipstick nail scissors; do
  curl -s "https://api.iconify.design/search?query=$q&prefix=mingcute&limit=20"
done

# 3) SVG 받기 (height=120 고정 — 스티커 기본 크기)
curl -s "https://api.iconify.design/mingcute/heart-fill.svg?height=120"
```

**선별 규칙** (그냥 다 넣으면 쓰레기가 섞인다)
- `crack|broken|angry|sad|cry|skull` 같은 부정적 그림 제외 — 뷰티 게시글에 안 어울린다
- Fluent Emoji 의 피부톤 변형(`-light`/`-dark`/`-medium*`)·인물(`man-`/`woman-`) 제외 — 개수만 불림
- MingCute 는 `-fill` 만 (스티커는 채운 형태가 어울림, `-line` 은 얇아서 사진 위에서 안 보임)
- Streamline 은 `-flat` 변형 제외 (같은 그림 중복)
- 세트당 **32개 정도**. 더 넣으면 파일만 커지고 원장님은 스크롤만 한다

**넣은 뒤 반드시**
- `js/load-groups.js` 에서 `itd-icon-stickers.js` 가 `itd-editor.js` **앞**에 오는지 확인
  (뒤에 오면 `STK_TABS` 가 만들어질 때 데이터가 없어 탭이 안 생긴다)
- `?v=` 캐시 버전 올리기 (루트 CLAUDE.md 규칙 — 안 올리면 옛 파일이 계속 서빙된다)

---

## 🎨 UI 디자인 참고용 세트 (나중에 볼 것)

**지금 앱에 넣은 게 아니다.** UI 아이콘은 Lucide 규칙이 있으니, 아래는
"이런 스타일도 있다" 는 **디자인 레퍼런스**로만 본다. 필요해지면 그때 판단.

### 라인 아이콘 (UI 기본형 — Lucide 대체·보강 후보)
| 프리픽스 | 이름 | 개수 | 라이선스 | 특징 |
|---|---|---|---|---|
| `lucide` | Lucide | 1,748 | ISC | **우리 앱 정본**. Feather 후속 |
| `ph` | Phosphor | 9,072 | MIT | 굵기 6단계(thin~fill). 톤 조절 폭이 넓음 |
| `tabler` | Tabler | 5,900+ | MIT | 라인 굵기 균일, 깔끔 |
| `solar` | Solar | 7,401 | **CC BY 4.0** | 라인/볼드/덕톤 다양. 귀속 필요 |
| `mingcute` | MingCute | 3,324 | Apache 2.0 | 둥글둥글, 뷰티앱 톤에 잘 맞음 |

### 컬러·일러스트 (빈 화면·온보딩·성공 화면용)
| 프리픽스 | 이름 | 라이선스 | 쓸 곳 |
|---|---|---|---|
| `fluent-emoji-flat` | Fluent Emoji Flat | MIT | 빈 상태 일러스트, 스티커 |
| `streamline-color` | Streamline color | CC BY 4.0 | 온보딩 일러스트 |
| `noto` | Noto Emoji | Apache 2.0 | 이모지 대체(OS별 렌더 차이 제거) |
| `twemoji` | Twemoji | CC BY 4.0 | 트위터 이모지 |

> **OS 별 이모지 렌더 차이**가 신경 쓰이면 `noto`(Apache 2.0)를 SVG 로 박아 쓰면 된다.
> 루트 CLAUDE.md 가 UI 에 이모지를 금지한 이유가 정확히 이 렌더 편차인데,
> SVG 이모지는 어디서나 같게 나오므로 그 걱정이 없다.

### 브랜드 로고 (연동 화면용)
| 프리픽스 | 이름 | 라이선스 | 주의 |
|---|---|---|---|
| `simple-icons` | Simple Icons (3,000+) | CC0 | **아이콘은 CC0 지만 상표권은 별개.** 인스타·카카오·네이버 로고는 각 사 브랜드 가이드를 따라야 한다 |

---

## 🔗 링크

- Iconify 아이콘 검색: https://icon-sets.iconify.design
- Iconify API 문서: https://iconify.design/docs/api/
- 라이선스 한눈에: 각 세트 페이지 하단 License 섹션
- MingCute: https://github.com/Richard9394/MingCute
- Fluent Emoji: https://github.com/microsoft/fluentui-emoji
- Streamline: https://streamlinehq.com
- 3D Icons (CC0): https://3dicons.co
