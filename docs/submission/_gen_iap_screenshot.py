"""App Store Connect 심사용 IAP 스크린샷 임시 생성 (T-353).

Pro/Premium 각각 1242×2688 (iPhone 6.7" Pro Max) PNG 생성.
실제 앱 빌드 완료 후 실기기 캡처로 교체하는게 원칙 — 지금은 Connect 저장 통과용 임시.

실행: python3 _gen_iap_screenshot.py
출력: ./IAP-Screenshot-Pro.png, ./IAP-Screenshot-Premium.png
"""
from PIL import Image, ImageDraw, ImageFont
import os

W, H = 1242, 2688
OUT_DIR = os.path.dirname(os.path.abspath(__file__))

# 폰트 — macOS AppleSDGothicNeo (한글 + 영문)
FONT_PATH = "/System/Library/Fonts/AppleSDGothicNeo.ttc"

def _font(size):
    try:
        return ImageFont.truetype(FONT_PATH, size)
    except Exception:
        return ImageFont.load_default()

# 색상 (잇데이 브랜드)
PINK = (241, 128, 145)
PINK_DARK = (217, 95, 112)
BG = (255, 247, 249)
WHITE = (255, 255, 255)
TEXT = (34, 34, 34)
TEXT_SUB = (120, 120, 120)
BORDER = (238, 228, 232)
GOLD = (255, 200, 87)
GREEN = (46, 125, 50)

def _rounded_rect(draw, xy, radius, fill=None, outline=None, width=1):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)

def _render(plan_name: str, price_kr: str, price_us: str, features: list, highlight: bool, out_path: str):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    # 상단 그라데이션 헤더 배경
    for y in range(0, 720):
        ratio = y / 720
        r = int(241 + (255 - 241) * ratio * 0.3)
        g = int(128 + (180 - 128) * ratio * 0.3)
        b = int(145 + (200 - 145) * ratio * 0.3)
        d.line([(0, y), (W, y)], fill=(r, g, b))

    # 상단 상태바 (시간만)
    d.text((60, 50), "9:41", font=_font(44), fill=WHITE)

    # 닫기 + 타이틀
    d.text((70, 170), "X", font=_font(56), fill=WHITE)
    d.text((W // 2 - 180, 170), "플랜 업그레이드", font=_font(52), fill=WHITE)

    # 히어로 문구
    d.text((W // 2 - 310, 320), "잇데이 프리미엄 멤버십", font=_font(56), fill=WHITE)
    d.text((W // 2 - 380, 420), "AI 비서가 1인샵을 함께 돌봅니다", font=_font(42), fill=(255, 255, 255, 230))
    d.text((W // 2 - 380, 520), "— 고객 · 예약 · 매출 · 분석 · 캡션 —", font=_font(40), fill=(255, 255, 255, 210))

    # 메인 카드 — 플랜 선택
    card_x, card_y = 80, 780
    card_w, card_h = W - 160, 1200
    _rounded_rect(d, (card_x, card_y, card_x + card_w, card_y + card_h), radius=40, fill=WHITE)

    # 플랜 이름
    d.text((card_x + 60, card_y + 60), f"{plan_name}", font=_font(68), fill=TEXT)

    # 가격
    d.text((card_x + 60, card_y + 170), f"{price_kr} / 월", font=_font(84), fill=PINK_DARK)
    d.text((card_x + 60, card_y + 290), f"해외 {price_us} USD · 1주 무료 체험", font=_font(36), fill=TEXT_SUB)

    # 구분선
    d.line([(card_x + 60, card_y + 370), (card_x + card_w - 60, card_y + 370)], fill=BORDER, width=2)

    # 기능 목록
    y = card_y + 420
    for feat in features:
        d.text((card_x + 60, y), "✓", font=_font(44), fill=GREEN)
        d.text((card_x + 120, y), feat, font=_font(40), fill=TEXT)
        y += 90

    # 하이라이트 뱃지
    if highlight:
        badge_x, badge_y = card_x + card_w - 260, card_y + 40
        _rounded_rect(d, (badge_x, badge_y, badge_x + 200, badge_y + 64), radius=32, fill=GOLD)
        d.text((badge_x + 52, badge_y + 10), "BEST", font=_font(36), fill=(120, 70, 10))

    # CTA 버튼
    btn_y = card_y + card_h - 180
    _rounded_rect(d, (card_x + 60, btn_y, card_x + card_w - 60, btn_y + 120), radius=28, fill=PINK_DARK)
    d.text((card_x + card_w // 2 - 210, btn_y + 30), f"{plan_name} 시작하기", font=_font(48), fill=WHITE)

    # 하단 법적 고지
    legal_y = card_y + card_h + 80
    d.text((80, legal_y), "• 1주 무료 체험 후 자동 갱신 (월간).", font=_font(32), fill=TEXT_SUB)
    d.text((80, legal_y + 60), "• 갱신 24시간 전 해지 안 하면 다음 주기 결제됩니다.", font=_font(32), fill=TEXT_SUB)
    d.text((80, legal_y + 120), "• Apple ID → 구독 메뉴에서 언제든 해지.", font=_font(32), fill=TEXT_SUB)
    d.text((80, legal_y + 180), "• 이용약관 및 개인정보처리방침: itdasy.com", font=_font(32), fill=TEXT_SUB)

    # 저장
    img.save(out_path, "PNG", optimize=True)
    print(f"  → {out_path} ({os.path.getsize(out_path) // 1024} KB)")


def _render_promo(plan_name: str, price_kr: str, price_us: str, tagline: str, out_path: str):
    """App Store Connect 프로모션 이미지 — 정확히 1024x1024 PNG."""
    S = 1024
    img = Image.new("RGB", (S, S), PINK_DARK)
    d = ImageDraw.Draw(img)

    # 배경 그라데이션
    for y in range(S):
        ratio = y / S
        r = int(241 - (241 - 180) * ratio)
        g = int(128 - (128 - 80) * ratio)
        b = int(145 - (145 - 110) * ratio)
        d.line([(0, y), (S, y)], fill=(r, g, b))

    # 장식용 원 (배경 텍스처)
    d.ellipse([(-200, -200), (400, 400)], fill=(255, 255, 255, 40), outline=None)
    d.ellipse([(700, 700), (1300, 1300)], fill=(255, 180, 190, 80), outline=None)

    # 중앙 카드
    card = 80
    _rounded_rect(d, (card, card, S - card, S - card), radius=48, fill=WHITE)

    # 브랜드 마크
    d.text((S // 2 - 80, 180), "잇데이", font=_font(88), fill=PINK_DARK)
    d.text((S // 2 - 110, 290), "Itdasy", font=_font(52), fill=TEXT_SUB)

    # 플랜 뱃지
    badge_y = 410
    _rounded_rect(d, (S // 2 - 140, badge_y, S // 2 + 140, badge_y + 80), radius=40, fill=PINK)
    d.text((S // 2 - 80 if plan_name == "Pro" else S // 2 - 120, badge_y + 16), plan_name, font=_font(52), fill=WHITE)

    # 가격
    d.text((S // 2 - 160, 550), price_kr, font=_font(96), fill=TEXT)
    d.text((S // 2 - 120, 680), f"/ 월 · {price_us} USD", font=_font(36), fill=TEXT_SUB)

    # 태그라인
    d.text((S // 2 - len(tagline) * 14, 770), tagline, font=_font(34), fill=TEXT)

    # 하단 심볼 라인
    d.text((S // 2 - 230, 850), "1주 무료 · 언제든 해지", font=_font(32), fill=PINK_DARK)

    img.save(out_path, "PNG", optimize=True)
    print(f"  → {out_path} ({os.path.getsize(out_path) // 1024} KB · 1024x1024)")


def main():
    print("[IAP Screenshot] 생성 시작")

    pro_features = [
        "AI 캡션·해시태그 무제한",
        "파워뷰 (고객/예약/매출 통합)",
        "스마트 임포트 (엑셀/사진/카톡)",
        "이탈 위험 고객 자동 감지",
        "AI 비서 챗봇",
    ]
    premium_features = [
        "Pro 전체 기능 포함",
        "우선 고객 지원",
        "고급 분석 리포트",
        "월간 성장 스토리 이미지",
        "확장 통계 대시보드",
    ]

    _render("Pro", "₩3,900", "$2.99", pro_features, highlight=False,
            out_path=os.path.join(OUT_DIR, "IAP-Screenshot-Pro.png"))
    _render("Premium", "₩8,900", "$5.99", premium_features, highlight=True,
            out_path=os.path.join(OUT_DIR, "IAP-Screenshot-Premium.png"))

    # 1024x1024 프로모션 이미지 (선택사항 필드용)
    _render_promo("Pro", "₩3,900", "$2.99", "AI 가 1인샵을 함께 돌봅니다",
                  out_path=os.path.join(OUT_DIR, "IAP-Promo-Pro-1024.png"))
    _render_promo("Premium", "₩8,900", "$5.99", "모든 Pro 기능 + 고급 분석",
                  out_path=os.path.join(OUT_DIR, "IAP-Promo-Premium-1024.png"))

    print("[IAP Screenshot] 완료")


if __name__ == "__main__":
    main()
