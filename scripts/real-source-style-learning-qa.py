#!/usr/bin/env python3
"""Real public beauty-image style QA.

Downloads public beauty/salon social-style images and derives a lightweight local
style profile from the actual pixels. This does not bypass Instagram/TikTok login
or scrape private accounts. If backend auth is unavailable, it records that and
still gives us a repeatable real-image QA fixture.
"""
from __future__ import annotations

import json
import math
import os
import re
import statistics
import sys
import time
import urllib.request
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "real-source-style-learning-qa"
IMG_DIR = OUT / "images"
OUT.mkdir(parents=True, exist_ok=True)
IMG_DIR.mkdir(parents=True, exist_ok=True)

SOURCES = [
    {
        "id": "lemon8_lash_before_after",
        "service": "속눈썹",
        "platform": "Lemon8/TikTok CDN",
        "page": "https://www.lemon8-app.com/%40lasheswithnatt/7571189537997603342?region=us",
        "image": "https://p19-lemon8-sign-useast5.tiktokcdn-us.com/tos-useast8-i-3931-tx2/ogAKAfekDEApFA013SERktEbECVIcqkAkctcWD~tplv-pyavlv3z7u-text-logo%3AQGxhc2hlc3dpdGhuYXR0%3Aq75.jpeg?lk3s=c7f08e79&source=lemon8_seo&x-expires=1776967200&x-signature=x4OrX51G%2BTcVH6sPVklngejfWcQ%3D",
    },
    {
        "id": "marketing_hair_story_before_after",
        "service": "헤어",
        "platform": "Salon marketing public page",
        "page": "https://salonmarketingco.ca/story-posts",
        "image": "https://storage.googleapis.com/msgsndr/DFgZN2wLgp72JHTmvPGP/media/690e4c7d5542aee8c350490f.png",
    },
    {
        "id": "ameba_nail_handcare_before_after",
        "service": "네일",
        "platform": "Ameba public blog",
        "page": "https://ameblo.jp/70017001777/entry-12637503306.html",
        "image": "https://stat.ameba.jp/user_images/20191028/13/70017001777/91/72/j/o0864108014625716714.jpg",
    },
    {
        "id": "rakuten_lash_lift_before_after",
        "service": "속눈썹",
        "platform": "Rakuten Beauty public salon page",
        "page": "https://beauty.rakuten.co.jp/s8000035120/tk10/",
        "image": "https://cloudinary-a.akamaihd.net/vivivi/image/upload/t_beauty%2Cf_auto%2Cdpr_2.0%2Cq_auto%3Agood/c_pad%2Cw_370%2Ch_370/v1763452887/tk0035120_010_04.jpg",
    },
    {
        "id": "canva_hair_treatment_instagram_post",
        "service": "헤어",
        "platform": "Canva public template image",
        "page": "https://www.canva.com/templates/",
        "image": "https://marketplace.canva.com/EAGNOni_vo4/2/0/1600w/canva-brown-and-green-gloral-hair-treatment-befor-after-instagram-post-K0BJw-RprAE.jpg",
    },

    {
        "id": "librelash_sydney_lash_extensions",
        "service": "속눈썹",
        "platform": "Libre Lash Sydney public site",
        "page": "https://www.librelashsydney.com.au/",
        "image": "https://images.squarespace-cdn.com/content/v1/5dd218b1db0ebb79e9527357/5e866bae-2d7e-4f3f-9a64-1ee4b936c4e0/IMG_20211023_175058%2B-%2BCopy.jpg",
    },
    {
        "id": "soomgo_forehead_waxing_before_after",
        "service": "왁싱",
        "platform": "Soomgo public portfolio image",
        "page": "https://soomgo.com/a.%EA%B2%BD%EA%B8%B0/%EC%99%81%EC%8B%B1",
        "image": "https://static.cdn.soomgo.com/upload/portfolio/6e3ae581-635f-4129-b6fb-81635b244382.jpg",
    },
    {
        "id": "lashinc_sg_4d_lash_extensions",
        "service": "속눈썹",
        "platform": "Lash Inc SG public shop image",
        "page": "https://lashincsg.com/",
        "image": "https://lashincsg.com/cdn/shop/products/4DVolumeLashExtensionsLashIncSg_80d91727-c931-420e-8e9e-99ccf5054b0c_500x.png?v=1632406117",
    },
    {
        "id": "canva_hair_story_book_now",
        "service": "헤어",
        "platform": "Canva public template image",
        "page": "https://www.canva.com/templates/s/collage/",
        "image": "https://marketplace.canva.com/EAGQe2e2eJQ/2/0/450w/canva-black-and-white-photo-collage-hair-salon-before-after-instagram-story-DGhaWTYbOuc.jpg",
    },
]


def safe_name(s: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_.-]+", "_", s)


def download(src: dict[str, str]) -> tuple[Path | None, str | None]:
    ext = ".jpg"
    if ".png" in src["image"].split("?")[0].lower():
        ext = ".png"
    path = IMG_DIR / f"{safe_name(src['id'])}{ext}"
    req = urllib.request.Request(src["image"], headers={"User-Agent": "Mozilla/5.0 itdasy-real-source-qa/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = r.read()
        if len(data) < 1024:
            return None, f"too small: {len(data)} bytes"
        path.write_bytes(data)
        return path, None
    except Exception as e:  # noqa: BLE001
        return None, f"{type(e).__name__}: {e}"


def rgb_to_hsv_stats(arr: np.ndarray) -> dict[str, float]:
    rgb = arr.astype(np.float32) / 255.0
    mx = rgb.max(axis=2)
    mn = rgb.min(axis=2)
    sat = np.divide(mx - mn, mx, out=np.zeros_like(mx), where=mx != 0)
    lum = 0.2126 * rgb[:, :, 0] + 0.7152 * rgb[:, :, 1] + 0.0722 * rgb[:, :, 2]
    warmth = rgb[:, :, 0] - rgb[:, :, 2]
    return {
        "brightness": round(float(np.median(lum)), 3),
        "saturation": round(float(np.median(sat)), 3),
        "warmth": round(float(np.median(warmth)), 3),
    }


def zone(x: float, y: float) -> str:
    v = "upper" if y < 0.33 else "middle" if y < 0.67 else "lower"
    h = "left" if x < 0.33 else "center" if x < 0.67 else "right"
    return f"{v}-{h}"


def align_from_x(x: float) -> str:
    return "left" if x < 0.42 else "right" if x > 0.58 else "center"


def analyze_image(path: Path) -> dict[str, Any]:
    im = Image.open(path).convert("RGB")
    w, h = im.size
    small = im.copy()
    small.thumbnail((640, 640))
    arr = np.array(small)
    hh, ww = arr.shape[:2]
    stats = rgb_to_hsv_stats(arr)

    # Text-overlay proxy: high-contrast edge pixels that are near white or near black.
    # It is intentionally conservative. It does not OCR; it estimates placement/color
    # from actual pixels so the QA remains repeatable without credentials.
    gray = small.convert("L")
    edges = np.array(gray.filter(ImageFilter.FIND_EDGES)).astype(np.float32)
    lum = np.array(gray).astype(np.float32)
    rgb = arr.astype(np.int16)
    chroma = rgb.max(axis=2) - rgb.min(axis=2)
    white = (lum > 205) & (edges > 25) & (chroma < 80)
    dark = (lum < 70) & (edges > 25)

    # Avoid counting outer image borders and huge photo edges.
    margin_x = max(2, ww // 80)
    margin_y = max(2, hh // 80)
    border = np.zeros((hh, ww), dtype=bool)
    border[:margin_y, :] = True
    border[-margin_y:, :] = True
    border[:, :margin_x] = True
    border[:, -margin_x:] = True
    white &= ~border
    dark &= ~border

    masks = {"white": white, "dark": dark}
    counts = {k: int(v.sum()) for k, v in masks.items()}
    text_color = "#FFFFFF" if counts["white"] >= counts["dark"] else "#15181D"
    mask = masks["white"] if text_color == "#FFFFFF" else masks["dark"]
    # If both are too small, mark text as absent.
    total_candidate = counts["white"] + counts["dark"]
    text_present = total_candidate > (ww * hh * 0.003)
    if text_present:
        ys, xs = np.where(mask)
        if len(xs) < 10:
            ys, xs = np.where(white | dark)
        cx = float(np.median(xs) / max(1, ww - 1))
        cy = float(np.median(ys) / max(1, hh - 1))
        pos = zone(cx, cy)
        aln = align_from_x(cx)
        size_ratio = round(min(0.16, max(0.035, math.sqrt(total_candidate / (ww * hh)) * 0.42)), 3)
    else:
        cx = cy = None
        pos = aln = None
        size_ratio = None

    return {
        "width": w,
        "height": h,
        "aspect": round(w / h, 3),
        "visual": stats,
        "textProxy": {
            "present": text_present,
            "candidatePixels": total_candidate,
            "whiteEdgePixels": counts["white"],
            "darkEdgePixels": counts["dark"],
            "alignment": aln,
            "position": pos,
            "color": text_color if text_present else None,
            "sizeRatio": size_ratio,
            "center": [round(cx, 3), round(cy, 3)] if text_present else None,
            "engine": "local_pixel_proxy_v1",
            "note": "OCR 아님. 실제 픽셀의 고대비 흰/검정 글자 후보로 위치·색만 추정."
        }
    }


def aggregate_by_service(rows: list[dict[str, Any]]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for service in sorted({r["service"] for r in rows if r.get("ok")}):
        items = [r for r in rows if r.get("ok") and r["service"] == service]
        texts = [r["analysis"]["textProxy"] for r in items if r["analysis"]["textProxy"]["present"]]
        visual = [r["analysis"]["visual"] for r in items]
        def mode(key: str):
            vals = [t[key] for t in texts if t.get(key) is not None]
            if not vals:
                return None
            return sorted(set(vals), key=lambda v: (-vals.count(v), str(v)))[0]
        out[service] = {
            "sampleCount": len(items),
            "textUsageRate": round(len(texts) / len(items), 3) if items else 0,
            "axes": {
                "align": mode("alignment"),
                "position": mode("position"),
                "color": mode("color"),
                "sizeRatioMedian": round(statistics.median([t["sizeRatio"] for t in texts if t.get("sizeRatio")]), 3) if texts else None,
                "tone": {
                    "brightness": round(statistics.median([v["brightness"] for v in visual]), 3),
                    "saturation": round(statistics.median([v["saturation"] for v in visual]), 3),
                    "warmth": round(statistics.median([v["warmth"] for v in visual]), 3),
                } if visual else None,
            },
            "sourceIds": [r["id"] for r in items],
        }
    return out


def backend_probe() -> dict[str, Any]:
    url = "https://itdasy-backend-staging-644329093453.asia-northeast3.run.app/instagram-style/analyze"
    try:
        req = urllib.request.Request(url, method="POST", headers={"User-Agent": "itdasy-real-source-qa/1.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            body = r.read(300).decode("utf-8", "replace")
            return {"url": url, "status": r.status, "bodyHead": body}
    except urllib.error.HTTPError as e:
        body = e.read(300).decode("utf-8", "replace")
        return {"url": url, "status": e.code, "bodyHead": body}
    except Exception as e:  # noqa: BLE001
        return {"url": url, "status": None, "error": f"{type(e).__name__}: {e}"}


def main() -> int:
    rows = []
    for src in SOURCES:
        path, err = download(src)
        row = {k: src[k] for k in ["id", "service", "platform", "page", "image"]}
        if err:
            row.update({"ok": False, "error": err})
        else:
            try:
                row.update({"ok": True, "localPath": str(path.relative_to(ROOT)), "analysis": analyze_image(path)})
            except Exception as e:  # noqa: BLE001
                row.update({"ok": False, "localPath": str(path.relative_to(ROOT)), "error": f"analyze {type(e).__name__}: {e}"})
        rows.append(row)

    result = {
        "generatedAt": int(time.time()),
        "backendProbe": backend_probe(),
        "sources": rows,
        "serviceProfiles": aggregate_by_service(rows),
        "safety": {
            "privateOrLoggedInBypass": False,
            "officialApiTokenAvailable": False,
            "note": "공개 이미지 URL만 다운로드. 비공개/로그인 우회/무단 대량 수집 없음."
        }
    }
    (OUT / "real-source-style-learning-qa.json").write_text(json.dumps(result, ensure_ascii=False, indent=2))

    md = ["# ITDASY — 실제 공개 뷰티 이미지 스타일 학습 QA", "", "## 서버 API 확인", ""]
    bp = result["backendProbe"]
    md.append(f"- `/instagram-style/analyze` 호출 결과: HTTP `{bp.get('status')}`")
    if bp.get("status") == 401:
        md.append("- 의미: 서버 Vision 분석은 로그인 토큰 없이는 막혀 있음. 정상적인 차단.")
    md += ["", "## 실제 이미지 다운로드/분석 결과", ""]
    for r in rows:
        if not r.get("ok"):
            md.append(f"- FAIL `{r['id']}` — {r.get('error')}")
            continue
        tp = r["analysis"]["textProxy"]
        vi = r["analysis"]["visual"]
        md.append(f"- `{r['id']}` ({r['platform']}, {r['service']})")
        md.append(f"  - 로컬 파일: `{r['localPath']}`")
        md.append(f"  - 크기: {r['analysis']['width']}×{r['analysis']['height']}, 밝기 {vi['brightness']}, 채도 {vi['saturation']}, 온도 {vi['warmth']}")
        md.append(f"  - 글자 후보: present={tp['present']}, color={tp['color']}, pos={tp['position']}, align={tp['alignment']}, size={tp['sizeRatio']}")
    md += ["", "## 서비스별 학습 프로필", ""]
    for svc, prof in result["serviceProfiles"].items():
        md.append(f"- {svc}: samples={prof['sampleCount']}, textUsage={prof['textUsageRate']}, axes={json.dumps(prof['axes'], ensure_ascii=False)}")
    md += ["", "## 한계", "", "- 로컬 분석은 OCR이 아니라 픽셀 기반 글자 후보 추정이다.", "- QA 로그인 토큰이 있으면 같은 이미지 파일을 서버 Vision API로 다시 돌릴 수 있다."]
    (OUT / "REAL_SOURCE_STYLE_LEARNING_QA.md").write_text("\n".join(md) + "\n")

    ok = [r for r in rows if r.get("ok")]
    print(json.dumps({
        "downloaded": len(ok),
        "failed": len(rows) - len(ok),
        "backendStatus": result["backendProbe"].get("status"),
        "out": str((OUT / "real-source-style-learning-qa.json").relative_to(ROOT)),
        "profiles": result["serviceProfiles"],
    }, ensure_ascii=False, indent=2))
    return 0 if len(ok) >= 4 else 1


if __name__ == "__main__":
    raise SystemExit(main())
