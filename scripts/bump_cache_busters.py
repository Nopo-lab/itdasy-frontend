#!/usr/bin/env python3
"""배포 시 모든 ?v= 캐시 버스터를 빌드 버전 하나로 통일한다. (2026-07-23)

왜 만들었나
-----------
`?v=` 를 사람이 손으로 올리는 규칙이었는데, **반드시 빠뜨린다.**
특히 치명적인 건 `index.html` 의 `js/load-groups.js?v=` 다. 이걸 안 올리면
브라우저가 옛 load-groups.js 를 그대로 쓰고, 그 안에 적힌 **옛 ?v= 로 파일을 불러온다** —
즉 load-groups 안의 버전을 아무리 올려도 통째로 무효가 된다.

2026-07-23 실측: caption-text.js 를 고치고 load-groups 의 ?v= 도 올렸는데 화면이 그대로였다.
로드된 script 태그가 `caption-text.js?v=20260714-fix-batch1`(9일 전)이었다.
그래서 "고쳤는데 안 보인다" 가 반복됐다.

무엇을 하나
-----------
`index.html` 과 `js/load-groups.js` 안에서 **이미 ?v= 가 붙어 있는 로컬 js/css** 를 찾아
전부 같은 값으로 바꾼다. CI 산출물만 바뀌고 레포 파일은 커밋하지 않는다(배포 워크플로 안에서만 실행).

일부러 안 하는 것
-----------------
- `?v=` 가 **없는** 항목에 새로 붙이지 않는다. 붙이면 로더 매니페스트의 의미가 바뀔 수 있어
  사람이 의도적으로 뺀 것(예: 외부 CDN, 캐시 불필요 자원)까지 건드리게 된다.
  → 새 파일을 추가할 땐 `?v=` 를 한 번은 손으로 붙여야 한다. 그 뒤부턴 이 스크립트가 관리한다.
- `//` 가 들어간 절대 URL(외부 CDN)은 건드리지 않는다.

로컬에서 확인:  python3 scripts/bump_cache_busters.py test-1234
"""
from __future__ import annotations

import io
import re
import sys

TARGETS = ("index.html", "js/load-groups.js")

# 따옴표 안의 (상대경로) *.js / *.css 뒤에 붙은 ?v=... 만 교체.
#   앞의 [\"'] 로 시작을 고정 → 주석·본문 텍스트를 잘못 건드리지 않는다.
#   경로에 `//` 가 있으면(=절대 URL) [\w./-]+ 가 `:` 를 못 먹어 자연히 제외된다.
PATTERN = re.compile(r"""(?P<q>["'])(?P<path>(?:\.{0,2}/)?[\w./-]+\.(?:js|css))\?v=[^"'?&]*""")


def bump(version: str) -> int:
    total = 0
    for path in TARGETS:
        try:
            src = io.open(path, encoding="utf-8").read()
        except FileNotFoundError:
            print(f"  skip {path} (없음)")
            continue
        new_src, n = PATTERN.subn(
            lambda m: f"{m.group('q')}{m.group('path')}?v={version}", src
        )
        if n:
            io.open(path, "w", encoding="utf-8").write(new_src)
        print(f"  {path}: {n}건")
        total += n
    return total


def main() -> int:
    if len(sys.argv) < 2 or not sys.argv[1].strip():
        print("사용법: bump_cache_busters.py <버전>", file=sys.stderr)
        return 2
    version = sys.argv[1].strip()
    print(f"🔄 ?v= 일괄 갱신 → {version}")
    total = bump(version)
    print(f"총 {total}건")
    if total == 0:
        # 패턴이 깨졌는데 조용히 통과하면 '캐시 안 도는 배포'가 나간다 — 그건 이 스크립트가
        # 막으려던 바로 그 사고다. 배포를 세운다.
        print("❌ ?v= 를 하나도 못 바꿨다 — 정규식이나 파일 구조가 바뀌었다", file=sys.stderr)
        return 1
    # load-groups 자신의 버전이 안 바뀌면 나머지 갱신이 전부 무효 → 반드시 확인한다.
    idx = io.open("index.html", encoding="utf-8").read()
    if f"js/load-groups.js?v={version}" not in idx:
        print("❌ index.html 의 js/load-groups.js?v= 가 안 바뀌었다 — 이게 안 되면 나머지도 무효",
              file=sys.stderr)
        return 1
    print("✅ load-groups.js 자체 버전까지 확인")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
