# iOS Info.plist 권한 사용 사유 (2026-04-22)

Xcode → `ios/App/App/Info.plist` 에 다음 키 추가. 한국어는 UI 표시용, 영문은 해외 리뷰어 대응.

## 필수 키

```xml
<key>NSCameraUsageDescription</key>
<string>시술 사진을 촬영하거나 고객 정보 스크린샷을 불러오기 위해 카메라를 사용합니다. Take photos of treatments or capture screens of legacy apps.</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>시술 전·후 사진을 포트폴리오에 추가하고 인스타그램에 발행하기 위해 사진첩에 접근합니다. Access your photo library to select treatment photos for portfolio and Instagram posts.</string>

<key>NSPhotoLibraryAddUsageDescription</key>
<string>AI 가 생성한 스토리 이미지를 저장하기 위해 사진첩에 접근합니다. Save AI-generated story images to your photo library.</string>

<key>NSMicrophoneUsageDescription</key>
<string>음성으로 고객·매출·예약을 빠르게 기록하기 위해 마이크를 사용합니다. Use microphone for voice-based quick recording of customers, revenue, and bookings.</string>

<key>NSFaceIDUsageDescription</key>
<string>비밀번호 대신 Face ID 로 빠르게 로그인하기 위해 사용합니다. Use Face ID for fast login without typing password.</string>

<key>NSContactsUsageDescription</key>
<string>기존 고객 연락처를 불러와 잇데이 고객 목록으로 이전하기 위해 주소록에 접근합니다(선택). Import existing contacts to migrate to Itdasy customers (optional).</string>

<key>NSUserTrackingUsageDescription</key>
<string>잇데이는 사용자 추적을 하지 않습니다. 이 항목은 미사용. Itdasy does not track users.</string>
```

## 네트워크 권한 (App Transport Security)

Capacitor 는 기본적으로 ATS 강제. Railway staging 서버는 HTTPS 이므로 별도 예외 불필요.

인스타그램 OAuth 는 api.instagram.com 을 쓰는데 Capacitor `allowNavigation` 에 이미 등록됨 (capacitor.config.json).

## 제출 시 확인

Apple 리뷰어는 권한 팝업 문구를 확인. **"~를 위해 사용합니다"** 형식으로 구체 목적 명시 필수. "디바이스 접근" 같은 포괄적 문구는 반려 사유.
