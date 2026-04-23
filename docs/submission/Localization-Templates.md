# iOS / Android 다국어 템플릿 — 잇데이 / Itdasy

국제 출시용 문자열 로컬라이제이션 템플릿. `npx cap add ios` / `android` 이후 각 경로에 복사.

---

## 🍎 iOS — InfoPlist.strings

Xcode → `File → New → File... → Strings File` 로 생성 후 우측 Inspector 에서 "Localize..." → Korean / English 추가.

### `ios/App/App/ko.lproj/InfoPlist.strings`
```
/* Display Name */
"CFBundleDisplayName" = "잇데이";

/* Permission strings */
"NSCameraUsageDescription" = "시술 사진을 촬영하거나 고객 정보 스크린샷을 불러오기 위해 카메라를 사용합니다.";
"NSPhotoLibraryUsageDescription" = "시술 전·후 사진을 포트폴리오에 추가하고 인스타그램에 발행하기 위해 사진첩에 접근합니다.";
"NSPhotoLibraryAddUsageDescription" = "AI 가 생성한 스토리 이미지를 저장하기 위해 사진첩에 접근합니다.";
"NSMicrophoneUsageDescription" = "음성으로 고객·매출·예약을 빠르게 기록하기 위해 마이크를 사용합니다.";
"NSFaceIDUsageDescription" = "비밀번호 대신 Face ID 로 빠르게 로그인하기 위해 사용합니다.";
"NSContactsUsageDescription" = "기존 고객 연락처를 불러와 잇데이 고객 목록으로 이전하기 위해 주소록에 접근합니다 (선택 사항).";
"NSUserTrackingUsageDescription" = "잇데이는 사용자 추적을 하지 않습니다.";
```

### `ios/App/App/en.lproj/InfoPlist.strings`
```
/* Display Name */
"CFBundleDisplayName" = "Itdasy";

/* Permission strings */
"NSCameraUsageDescription" = "Take photos of treatments or capture screens from other apps.";
"NSPhotoLibraryUsageDescription" = "Access your photo library to select treatment photos for portfolio and Instagram posts.";
"NSPhotoLibraryAddUsageDescription" = "Save AI-generated story images to your photo library.";
"NSMicrophoneUsageDescription" = "Use microphone for voice-based quick recording of customers, revenue, and bookings.";
"NSFaceIDUsageDescription" = "Use Face ID for fast login without typing your password.";
"NSContactsUsageDescription" = "Import existing contacts to migrate into your Itdasy customer list (optional).";
"NSUserTrackingUsageDescription" = "Itdasy does not track users.";
```

### Project.pbxproj 에서 Localizations 활성화

Xcode → Project (not target) → **Info** tab → **Localizations** → `+` → Korean, English 추가.
기본 언어는 Korean (한국 시장 우선).

---

## 🤖 Android — strings.xml

### `android/app/src/main/res/values/strings.xml` (기본 — 한국어)
```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">잇데이</string>
    <string name="title_activity_main">잇데이</string>
    <string name="package_name">com.nopolab.itdasy</string>
    <string name="custom_url_scheme">itdasy</string>
</resources>
```

### `android/app/src/main/res/values-en/strings.xml` (영어)
```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Itdasy</string>
    <string name="title_activity_main">Itdasy</string>
</resources>
```

### Android 권한 문구 (AndroidManifest.xml 상 직접 작성은 불필요 — 런타임 권한 다이얼로그의 message 는 코드에서 제공)

Capacitor Camera / Push / etc. 플러그인은 자체 다이얼로그 메시지 사용. 직접 커스터마이즈 시 `@Plugin` 어노테이션에서 처리.

---

## 🌐 Capacitor Runtime — `appName` per-locale

Capacitor 자체는 단일 appName 만 지원. 해결법 2가지:

### 옵션 A: iOS/Android 네이티브 리소스로 오버라이드 (권장)
iOS 는 `CFBundleDisplayName` 로컬라이제이션, Android 는 `app_name` strings.xml → **위 템플릿 사용 시 자동 적용**.
`capacitor.config.json` 의 `appName` 은 fallback.

### 옵션 B: 빌드 시 치환 스크립트
```bash
# package.json scripts
"build:ios:en": "NODE_ENV=production APP_LOCALE=en npm run build && npx cap sync ios"
```
복잡도 높음, 권장 X.

---

## 🔤 앱 내부 UI 문자열 국제화 (Phase 2 이후)

현재 앱 UI 는 **한국어 하드코딩**. v1.0 출시 시 Primary Language: Korean 으로 설정.

다음 마일스톤 (v1.1+):
1. `i18n/ko.json`, `i18n/en.json` 디렉토리 구조 신설
2. `app-core.js` 에 `t(key)` 헬퍼 추가
3. HTML 의 `<span data-i18n="home.greeting">안녕하세요</span>` 패턴 일괄 적용
4. 런타임 locale 감지 (`navigator.language`) + 사용자 설정 오버라이드

**v1.0 영문 리뷰어 대응**: Review-Notes.md 에서 "Primary language: Korean. English not yet translated." 명시 → Apple 심사 통과 가능.

---

## 🌍 시장별 우선 언어

| 시장 | 우선 언어 | 비고 |
|---|---|---|
| 한국 (KR) | 한국어 | Primary |
| 미국·영국·호주·캐나다 | 영어 | 메타데이터만 영문 번역 |
| 일본 (JP, 향후) | 일본어 | v1.2 목표 (뷰티 시장 규모) |
| 중국 번체 (TW, HK) | 중국어 번체 | v1.3 목표 |
| 중국 간체 (CN) | 차후 검토 | GFW·IAP 정책 복잡 |

---

## 📋 체크리스트 — 국제 출시 전

- [x] 영문 Privacy Policy (`privacy-en.html`)
- [x] 영문 Terms of Service (`terms-en.html`)
- [x] App Store Connect 영문 메타데이터 (`App-Store-Metadata-EN.md`)
- [x] Play Store 영문 메타데이터 (`Play-Store-Metadata.md`)
- [x] Info.plist 권한 문구 영문 (`Info.plist-keys.md` 내 포함)
- [ ] iOS Localizations 활성화 (Xcode project settings)
- [ ] Android values-en/strings.xml 추가
- [ ] App Store Connect → Additional Language → English (U.S.)
- [ ] Play Console → Store listing → Languages → English (en-US) 추가
- [ ] 영문 스크린샷 5장 (or 한영 공용 스크린샷 + 영문 오버레이)
- [ ] Demo 계정 영어 인터페이스 설명 (Review-Notes.md 에 명시됨 ✅)

---

_Last updated: 2026-04-22 by Claude / 연준_
