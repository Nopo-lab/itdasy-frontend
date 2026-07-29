#!/usr/bin/env python3
"""잇데이 프론트 → 기능별 연결 그래프 빌드 (자립형, API 키 불필요).

런타임 JS 를 AST 로 추출해 파일 간 호출/의존 그래프를 만들고,
커뮤니티를 Louvain 이 아니라 **기능 도메인**(작업실·DM·사진편집…)으로 지정해
`graphify export html` 이 도메인 버블로 집계하도록 한다.

로컬:  python3 scripts/build_feature_graph.py
CI  :  pip install graphifyy && python3 scripts/build_feature_graph.py

산출: graphify-out/graph.json + graphify-out/graph.html + graphify-out/.graphify_labels.json
"""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "graphify-out"
OUT.mkdir(exist_ok=True)

# 앱 런타임이 아닌 디렉토리(QA스크립트·빌드·워크트리 등) 제외
EXCLUDE_TOP = {"output", "scripts", ".husky", "android", "ios", ".claude",
               "node_modules", "test", "docs", "assets", ".git", "graphify-out"}


# 런타임 아닌 설정/도구 파일 (그래프에서 제외)
EXCLUDE_NAMES = {".eslintrc.js", "commitlint.config.js", "capacitor.config.js"}


def runtime_js():
    files = []
    for pat in ("*.js", "*.mjs"):
        for f in ROOT.rglob(pat):
            rel = f.relative_to(ROOT)
            if rel.parts[0] in EXCLUDE_TOP or f.name in EXCLUDE_NAMES:
                continue
            files.append(rel.as_posix())
    return sorted(set(files))


def domain(f: str) -> str:
    """파일 경로 → 기능 도메인(친구가 딱 보면 아는 이름)."""
    b = f.lower()
    def has(*ks): return any(k in b for k in ks)
    if has("assistant", "itbi", "intent", "nlu"):                 return "잇비 챗봇·NLU"
    if has("dm-", "dm_", "/dm/", "autoreply", "comment-reply"):   return "DM·댓글 자동응답"
    if has("workspace", "/flow/", "feed-planner", "itd-editor"):  return "작업실(콘텐츠 제작)"
    if has("photo-editor", "gallery", "mask", "template", "beauty",
           "photo-enhance", "photo-match", "auto-ba", "ba-auto", "smart-capture",
           "heic", "photo-filter"):                               return "사진편집·갤러리"
    if has("caption"):                                            return "캡션 생성"
    if has("revenue", "dashboard", "insight", "report", "growth-story", "killer-widget"): return "매출·대시보드·인사이트"
    if has("calendar", "booking", "reserv"):                      return "캘린더·예약"
    if has("customer", "retention", "review", "birthday", "crm", "reminder", "waitlist"): return "고객관리·리텐션"
    if has("instagram", "sns", "hashtag", "naver", "kakao", "integrations-hub", "channel"): return "SNS·채널연동"
    if has("inventory", "service-template", "service-vocab", "vocab", "consumption",
           "membership", "pricelist", "receipt", "portfolio"):    return "재고·시술·포트폴리오"
    if has("oauth", "login", "biometric", "auth", "push", "iap", "billing", "plan",
           "secure-storage", "cookie-consent"):                   return "인증·결제·푸시"
    if has("myshop", "shop-settings", "settings-hub", "brand-kit", "persona", "onboard", "import-wizard", "import"): return "내샵 설정·온보딩"
    if has("home", "empty-state", "nav", "sheet", "gesture", "haptic", "drawer",
           "today", "notifications", "phase9", "support", "scenario", "prototype-render"): return "홈·네비·UX"
    if has("ai-hub", "ai-suggestion", "app-ai", "chat-auto-edit", "autocomplete", "auto-trigger", "complete-flow"): return "AI 어시스트·자동화"
    if b.endswith("app-core.js") or has("core", "app-api", "perf", "spec-validator", "theme",
           "backup", "data-export", "debug-panel", "loader", "load-groups", "format-money",
           "emoji-storage", "sw.js"):                             return "코어·API·성능"
    return "기타 유틸"


def main():
    from collections import defaultdict
    from graphify.extract import extract
    from graphify.build import build_from_json
    from graphify.export import to_json, to_html

    files = runtime_js()
    print(f"[graph] 런타임 JS {len(files)}개 AST 추출…")
    res = extract([ROOT / f for f in files], cache_root=ROOT)
    print(f"[graph] {len(res['nodes'])} 노드, {len(res['edges'])} 엣지")

    G = build_from_json({"nodes": res["nodes"], "edges": res["edges"],
                         "hyperedges": [], "input_tokens": 0, "output_tokens": 0},
                        root=str(ROOT), directed=False)
    if G.number_of_nodes() == 0:
        print("[graph] ERROR: 빈 그래프"); sys.exit(1)

    # 노드 → 기능 도메인.  communities = {도메인id: [노드목록]}, labels = {도메인id: 이름}
    node_file = {n["id"]: n.get("source_file", "") for n in res["nodes"]}
    doms = sorted({domain(f) for f in files})
    dom_id = {d: i for i, d in enumerate(doms)}
    communities = defaultdict(list)
    for nid in G.nodes():
        communities[dom_id[domain(node_file.get(nid, ""))]].append(nid)
    communities = dict(communities)
    labels = {i: d for d, i in dom_id.items()}

    # force=True: 매 빌드가 현재 코드의 진본. dead code 삭제로 노드가 줄어도 갱신돼야 함.
    to_json(G, communities, str(OUT / "graph.json"), community_labels=labels, force=True)
    (OUT / ".graphify_labels.json").write_text(
        json.dumps({str(k): v for k, v in labels.items()}, ensure_ascii=False), encoding="utf-8")
    print(f"[graph] {len(doms)}개 기능 도메인으로 그룹핑: {', '.join(doms)}")

    # 도메인 버블 HTML (node_limit 초과 → community=도메인 으로 집계)
    to_html(G, communities, str(OUT / "graph.html"),
            community_labels=labels, node_limit=5000)
    print("[graph] graphify-out/graph.html 생성 완료")


if __name__ == "__main__":
    main()
